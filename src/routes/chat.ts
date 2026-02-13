/**
 * S3: 壁打ちチャット API
 * 
 * POST /api/chat/precheck - 壁打ち開始前の事前判定
 * POST /api/chat/sessions - セッション作成
 * GET  /api/chat/sessions - セッション一覧
 * GET  /api/chat/sessions/:id - セッション詳細
 * POST /api/chat/sessions/:id/message - メッセージ送信
 * 
 * A-3-5: normalized のみ参照に変更、input_type 推測ロジック排除
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';
import { getMockSubsidyDetail, MOCK_SUBSIDIES } from '../lib/mock-subsidies';
import { 
  getNormalizedSubsidyDetail,
  type NormalizedSubsidyDetail,
  type WallChatQuestion,
} from '../lib/ssot';
import {
  generateAIResponse,
  generateAIResponseStream,
  type ConversationContext,
  type ChatMessage as AIChatMessage,
  type CompanyContext,
} from '../lib/ai-concierge';
import { syncFactsToProfile } from '../lib/fact-sync';
import { safeJsonParse } from '../lib/ssot';

const chat = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
chat.use('*', requireAuth);

// =====================================================
// subsidy_cache フォールバック: SSOT 解決失敗時に cache から NSD を構築
// canonical / source_link に紐付いていない補助金（REAL-xxx 等）でも
// detail_json があれば壁打ちチャットを利用可能にする
// =====================================================
async function buildNsdFromCache(
  db: D1Database,
  subsidyId: string
): Promise<NormalizedSubsidyDetail | null> {
  try {
    const row = await db.prepare(`
      SELECT id, title, detail_json, subsidy_max_limit, subsidy_rate,
             target_area_search, acceptance_start_datetime, acceptance_end_datetime,
             request_reception_display_flag, wall_chat_ready, wall_chat_missing
      FROM subsidy_cache WHERE id = ?
    `).bind(subsidyId).first<Record<string, any>>();
    
    if (!row) return null;
    
    const detail = row.detail_json ? safeJsonParse(row.detail_json) : {};
    
    console.log(`[Chat] buildNsdFromCache: building NSD from cache for ${subsidyId} (detail_json: ${row.detail_json ? 'yes' : 'no'})`);
    
    // detail_json から eligibility_rules / required_documents 等を抽出
    const eligibilityRules = detail.eligibility_rules || detail.content?.eligibility_rules || [];
    const eligibleExpenses = detail.eligible_expenses || detail.content?.eligible_expenses || { required: [], categories: [], excluded: [], notes: null };
    const requiredDocuments = detail.required_documents || detail.content?.required_documents || [];
    const bonusPoints = detail.bonus_points || detail.content?.bonus_points || [];
    const requiredForms = detail.required_forms || detail.content?.required_forms || [];
    
    // wall_chat_missing をパース
    let wallChatMissing: string[] = [];
    try {
      wallChatMissing = typeof row.wall_chat_missing === 'string' 
        ? JSON.parse(row.wall_chat_missing) 
        : (row.wall_chat_missing || []);
    } catch { wallChatMissing = []; }
    
    const nsd: NormalizedSubsidyDetail = {
      schema_version: '1.0',
      ids: {
        input_id: subsidyId,
        canonical_id: subsidyId, // canonical未紐付きだが、chat内では自己参照
        cache_id: subsidyId,
        snapshot_id: null,
      },
      source: {
        primary_source_type: 'cache' as any,
        primary_source_id: subsidyId,
        links: [],
      },
      acceptance: {
        is_accepting: row.request_reception_display_flag === 1,
        acceptance_start: row.acceptance_start_datetime || null,
        acceptance_end: row.acceptance_end_datetime || null,
        acceptance_end_reason: null,
      },
      display: {
        title: row.title || '補助金名未設定',
        issuer_name: detail.subsidy_executing_organization || detail.display?.issuer_name || null,
        target_area_text: row.target_area_search || null,
        subsidy_max_limit: row.subsidy_max_limit || null,
        subsidy_rate_text: row.subsidy_rate || null,
      },
      overview: {
        summary: detail.subsidy_summary || detail.overview?.summary || null,
        purpose: detail.purpose || detail.overview?.purpose || null,
        target_business: detail.target_industry || detail.overview?.target_business || null,
      },
      electronic_application: {
        is_electronic_application: detail.is_electronic_application || null,
        portal_name: null,
        portal_url: null,
        notes: null,
      },
      wall_chat: {
        mode: (row.wall_chat_ready ? 'enabled' : 'unknown') as any,
        ready: row.wall_chat_ready === 1,
        missing: wallChatMissing,
        questions: [],
      },
      content: {
        eligibility_rules: eligibilityRules,
        eligible_expenses: eligibleExpenses,
        required_documents: requiredDocuments,
        bonus_points: bonusPoints,
        required_forms: requiredForms,
        attachments: [],
      },
      provenance: {
        koubo_source_urls: [],
        pdf_urls: [],
        pdf_hashes: [],
        last_normalized_at: new Date().toISOString(),
      },
    };
    
    console.log(`[Chat] buildNsdFromCache: success - ${subsidyId}, eligibility_rules: ${eligibilityRules.length}, required_docs: ${requiredDocuments.length}`);
    return nsd;
  } catch (err) {
    console.error(`[Chat] buildNsdFromCache failed for ${subsidyId}:`, err);
    return null;
  }
}

// =====================================================
// 型定義
// =====================================================

interface MissingItem {
  key: string;
  label: string;
  input_type: 'boolean' | 'number' | 'text' | 'select';
  options?: string[];
  source: 'eligibility' | 'document' | 'profile';
  priority: number;
}

interface PrecheckResult {
  status: 'NG' | 'OK' | 'OK_WITH_MISSING';
  eligible: boolean;
  blocked_reasons: string[];
  missing_items: MissingItem[];
  subsidy_info?: {
    id: string;
    title: string;
    acceptance_end?: string;
    max_amount?: number;
  };
  company_info?: {
    id: string;
    name: string;
    prefecture: string;
    employee_count: number;
  };
  // 電子申請情報 (v3)
  electronic_application?: {
    is_electronic: boolean;
    system_name?: string;
    url?: string;
    notice?: string;  // ユーザーへの案内メッセージ
  };
}

// =====================================================
// ユーザーの会社を自動取得するミドルウェア
// =====================================================

chat.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    }, 401);
  }
  
  // ユーザーがメンバーとなっている会社を取得
  // 正テーブル: user_companies（company_membershipsは非推奨）
  const membership = await c.env.DB.prepare(`
    SELECT c.* FROM companies c
    INNER JOIN user_companies uc ON c.id = uc.company_id
    WHERE uc.user_id = ?
    ORDER BY uc.joined_at ASC
    LIMIT 1
  `).bind(user.id).first();
  
  if (membership) {
    c.set('company', membership as any);
  }
  
  await next();
});

// =====================================================
// POST /api/chat/precheck - 事前判定
// =====================================================

chat.post('/precheck', async (c) => {
  const user = c.get('user')!;
  const company = c.get('company');
  
  try {
    const { company_id, subsidy_id } = await c.req.json();
    
    // company_id が指定されていない場合はユーザーの会社を使用
    const targetCompanyId = company_id || company?.id;
    
    if (!targetCompanyId) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NO_COMPANY', message: '会社情報が登録されていません' }
      }, 400);
    }
    
    if (!subsidy_id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'subsidy_id is required' }
      }, 400);
    }
    
    // 会社情報取得
    const companyInfo = await c.env.DB.prepare(`
      SELECT c.*, cp.* FROM companies c
      LEFT JOIN company_profile cp ON c.id = cp.company_id
      WHERE c.id = ?
    `).bind(targetCompanyId).first() as Record<string, any> | null;
    
    if (!companyInfo) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: '会社が見つかりません' }
      }, 404);
    }
    
    // A-3-5: SSOT（getNormalizedSubsidyDetail）から補助金情報取得
    const ssotResult = await getNormalizedSubsidyDetail(c.env.DB, subsidy_id);
    let normalized: NormalizedSubsidyDetail | null = ssotResult?.normalized || null;
    
    // SSOT で見つからない場合は subsidy_cache から直接構築（REAL-xxx 等の非canonical補助金対応）
    if (!normalized) {
      normalized = await buildNsdFromCache(c.env.DB, subsidy_id);
      if (normalized) {
        console.log(`[Chat Precheck] Cache fallback resolved: ${subsidy_id}`);
      }
    }
    
    // それでも見つからない場合はモックデータからフォールバック
    if (!normalized) {
      const mockDetail = getMockSubsidyDetail(subsidy_id);
      if (mockDetail) {
        console.log(`[Chat Precheck] Using mock subsidy data for ${subsidy_id}`);
      }
    } else {
      console.log(`[Chat Precheck] Resolved: ${subsidy_id} → canonical_id: ${normalized.ids.canonical_id}`);
    }
    
    // eligibility_rules 取得（Fallback用）
    const eligibilityRules = await c.env.DB.prepare(`
      SELECT * FROM eligibility_rules WHERE subsidy_id = ?
    `).bind(subsidy_id).all();
    
    // required_documents 取得（Fallback用）
    const requiredDocs = await c.env.DB.prepare(`
      SELECT rd.*, rdm.name as doc_name, rdm.description as doc_description
      FROM required_documents_by_subsidy rd
      LEFT JOIN required_documents_master rdm ON rd.doc_code = rdm.doc_code
      WHERE rd.subsidy_id = ?
    `).bind(subsidy_id).all();
    
    // 既に回答済みのfacts取得
    const existingFacts = await c.env.DB.prepare(`
      SELECT fact_key, fact_value FROM chat_facts
      WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
    `).bind(targetCompanyId, subsidy_id).all();
    
    const factsMap = new Map<string, string>();
    for (const fact of (existingFacts.results || [])) {
      factsMap.set((fact as any).fact_key, (fact as any).fact_value);
    }
    
    // A-3-5: 判定ロジック（normalized を使用）
    const result = performPrecheck(companyInfo, normalized, eligibilityRules.results || [], requiredDocs.results || [], factsMap);
    
    return c.json<ApiResponse<PrecheckResult>>({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Precheck error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to perform precheck' }
    }, 500);
  }
});

/**
 * 事前判定ロジック
 * 
 * A-3-5: normalized を使用して情報を取得
 */
function performPrecheck(
  company: Record<string, any>,
  normalized: NormalizedSubsidyDetail | null,
  rules: any[],
  docs: any[],
  existingFacts: Map<string, string>
): PrecheckResult {
  const blockedReasons: string[] = [];
  const missingItems: MissingItem[] = [];
  
  // 補助金情報がない場合
  if (!normalized) {
    return {
      status: 'OK_WITH_MISSING',
      eligible: true,
      blocked_reasons: [],
      missing_items: [{
        key: 'subsidy_not_in_cache',
        label: '補助金の詳細情報がキャッシュされていません。要件を直接確認してください。',
        input_type: 'text',
        source: 'eligibility',
        priority: 1
      }],
      subsidy_info: undefined, // 補助金情報なし
      company_info: {
        id: company.id,
        name: company.name,
        prefecture: company.prefecture,
        employee_count: company.employee_count
      }
    };
  }
  
  // AUTO判定（即座にNG判定可能なもの）
  for (const rule of rules) {
    if (rule.check_type === 'auto') {
      const checkResult = evaluateAutoRule(rule, company);
      if (checkResult.blocked) {
        blockedReasons.push(checkResult.reason);
      }
    }
  }
  
  // MANUAL判定が必要な項目を抽出
  for (const rule of rules) {
    if (rule.check_type === 'manual') {
      const factKey = `eligibility_${rule.id}`;
      
      // 既に回答済みならスキップ
      if (existingFacts.has(factKey)) {
        continue;
      }
      
      missingItems.push({
        key: factKey,
        label: rule.rule_text || '要件を確認してください',
        input_type: determineInputType(rule.category),
        source: 'eligibility',
        priority: rule.category === 'must' ? 1 : 2
      });
    }
  }
  
  // 必要書類の確認項目
  for (const doc of docs) {
    const factKey = `doc_${doc.doc_code}`;
    
    // 既に回答済みならスキップ
    if (existingFacts.has(factKey)) {
      continue;
    }
    
    // 必須書類のみ質問に追加
    if (doc.required_level === 'required' || doc.required_level === 'conditional') {
      missingItems.push({
        key: factKey,
        label: `${doc.doc_name || doc.doc_code} を準備できますか？`,
        input_type: 'boolean',
        source: 'document',
        priority: doc.required_level === 'required' ? 1 : 2
      });
    }
  }
  
  // A-3-5: 補助金固有の追加質問（normalized.wall_chat.questions から取得）
  const additionalQuestions = generateAdditionalQuestions(company, normalized, existingFacts);
  missingItems.push(...additionalQuestions);
  
  // 優先度でソート
  missingItems.sort((a, b) => a.priority - b.priority);
  
  // ステータス判定
  let status: 'NG' | 'OK' | 'OK_WITH_MISSING';
  if (blockedReasons.length > 0) {
    status = 'NG';
  } else if (missingItems.length > 0) {
    status = 'OK_WITH_MISSING';
  } else {
    status = 'OK';
  }
  
  // A-3-5: 電子申請情報を normalized から取得
  let electronicApplication: PrecheckResult['electronic_application'];
  if (normalized.electronic_application.is_electronic_application) {
    electronicApplication = {
      is_electronic: true,
      system_name: normalized.electronic_application.portal_name || undefined,
      url: normalized.electronic_application.portal_url || undefined,
      notice: normalized.electronic_application.notes || 
              `この補助金は${normalized.electronic_application.portal_name || '電子申請システム'}での申請が必要です。` +
              `壁打ちでは申請前の準備をサポートしますが、実際の申請書類の作成は電子申請システム上で行ってください。`
    };
  }
  
  return {
    status,
    eligible: blockedReasons.length === 0,
    blocked_reasons: blockedReasons,
    missing_items: missingItems.slice(0, 10), // 最大10件
    subsidy_info: {
      id: normalized.ids.canonical_id,
      title: normalized.display.title,
      acceptance_end: normalized.acceptance.acceptance_end || undefined,
      max_amount: normalized.display.subsidy_max_limit || undefined
    },
    company_info: {
      id: company.id,
      name: company.name,
      prefecture: company.prefecture,
      employee_count: company.employee_count
    },
    electronic_application: electronicApplication
  };
}

/**
 * AUTO判定ルールの評価
 * 
 * Phase 19-QA: JSON.parse の安全性確保、型検証強化
 */
function evaluateAutoRule(rule: any, company: Record<string, any>): { blocked: boolean; reason: string } {
  let params: Record<string, any> = {};
  try {
    params = rule.parameters ? JSON.parse(rule.parameters) : {};
  } catch (e) {
    console.warn(`[Chat] Invalid rule parameters JSON for rule ${rule.id}:`, e);
    return { blocked: false, reason: '' };
  }
  
  const category = rule.category;
  
  // 従業員数チェック
  if (category === 'employee_count' || rule.rule_text?.includes('従業員')) {
    const empCount = typeof company.employee_count === 'number' ? company.employee_count : 0;
    if (typeof params.max === 'number' && empCount > params.max) {
      return { blocked: true, reason: `従業員数が上限（${params.max}人）を超えています` };
    }
    if (typeof params.min === 'number' && empCount < params.min) {
      return { blocked: true, reason: `従業員数が下限（${params.min}人）を下回っています` };
    }
  }
  
  // 資本金チェック
  if (category === 'capital' || rule.rule_text?.includes('資本金')) {
    const cap = typeof company.capital === 'number' ? company.capital : null;
    if (typeof params.max === 'number' && cap != null && cap > params.max) {
      return { blocked: true, reason: `資本金が上限（${formatCurrency(params.max)}）を超えています` };
    }
  }
  
  // 業種チェック
  if (category === 'industry' || rule.rule_text?.includes('業種')) {
    if (Array.isArray(params.excluded) && company.industry_major && params.excluded.includes(company.industry_major)) {
      return { blocked: true, reason: '対象外の業種です' };
    }
  }
  
  // 地域チェック
  if (category === 'region' || rule.rule_text?.includes('地域')) {
    if (Array.isArray(params.prefectures) && company.prefecture && !params.prefectures.includes(company.prefecture)) {
      return { blocked: true, reason: '対象地域外です' };
    }
  }
  
  return { blocked: false, reason: '' };
}

/**
 * 入力タイプの判定
 * 
 * Phase 19-QA: デフォルトを 'text' に変更（boolean 偏重の解消）
 * カテゴリが明示的に boolean である場合のみ boolean を返す
 */
function determineInputType(category: string): 'boolean' | 'number' | 'text' | 'select' {
  if (!category) return 'text';
  
  const booleanCategories = ['has_employees', 'past_subsidy', 'tax_arrears', 'profitable',
    'has_certification', 'has_license', 'is_registered'];
  const numberCategories = ['employee_count', 'capital', 'revenue', 'amount', 'count',
    'age', 'year', 'sales', 'budget'];
  
  if (booleanCategories.some(c => category?.includes(c))) {
    return 'boolean';
  }
  if (numberCategories.some(c => category?.includes(c))) {
    return 'number';
  }
  // Phase 19-QA: デフォルトは text（boolean 偏重を解消）
  return 'text';
}

/**
 * 追加質問の生成（company_profileにない項目 + normalized.wall_chat.questions）
 * 
 * A-3-5: input_type 推測ロジック排除
 * - normalized.wall_chat.questions のみを参照
 * - 推測禁止: input_type が定義されていなければ text 固定（normalizeSubsidyDetail で処理済み）
 */
/**
 * Freeze-WALLCHAT-2: フォールバック質問の多様化
 * 
 * - normalized.wall_chat.questions が利用可能な場合はそれを優先
 * - 無い場合は多様なフォールバック質問を提供（boolean だけでなく text/number も含む）
 * - input_type は normalizeSubsidyDetail で質問文からパターンマッチ済み
 */
function generateAdditionalQuestions(
  company: Record<string, any>,
  normalized: NormalizedSubsidyDetail | null,
  existingFacts: Map<string, string>
): MissingItem[] {
  const questions: MissingItem[] = [];
  
  // ===== 1. normalized.wall_chat.questions からの質問を最優先 =====
  // Freeze-WALLCHAT-1: input_type は normalizeSubsidyDetail で質問文からパターンマッチ推測済み
  if (normalized?.wall_chat.questions && normalized.wall_chat.questions.length > 0) {
    const wcQuestions = normalized.wall_chat.questions;
    
    wcQuestions.forEach((wq: WallChatQuestion) => {
      const factKey = `wc_${normalized.ids.canonical_id}_${wq.key}`;
      
      // 既に回答済みならスキップ
      if (existingFacts.has(factKey)) {
        return;
      }
      
      // DBに既に登録されている情報と重複する質問はスキップ
      const qLower = wq.question.toLowerCase();
      if (qLower.includes('従業員') && company.employee_count && company.employee_count > 0) return;
      if (qLower.includes('資本金') && company.capital && company.capital > 0) return;
      if (qLower.includes('年商') && company.annual_revenue && company.annual_revenue > 0) return;
      if (qLower.includes('設立') && company.established_date) return;
      if (qLower.includes('所在地') && company.prefecture) return;
      if (qLower.includes('業種') && company.industry_major) return;
      
      questions.push({
        key: factKey,
        label: wq.question,
        input_type: wq.input_type,
        options: wq.options,
        source: 'eligibility',
        priority: wq.priority
      });
    });
    
    // 質問が追加できた場合はフォールバックを抑制
    if (questions.length > 0) {
      return questions;
    }
  }
  
  // ===== 2. フォールバック質問（多様化: boolean/number/text） =====
  // Phase 19-QA: 聞き取り不足を補完
  // 補助金申請に必要な情報を網羅的に収集するための汎用質問
  
  // --- 事業内容（最重要: 申請書の核心） ---
  if (!existingFacts.has('business_purpose')) {
    questions.push({
      key: 'business_purpose',
      label: '今回の補助金で実施したい事業内容を簡単に教えてください。（例：新製品開発、設備導入、IT化推進など）',
      input_type: 'text',
      source: 'profile',
      priority: 1
    });
  }

  if (!existingFacts.has('investment_amount')) {
    questions.push({
      key: 'investment_amount',
      label: '予定している投資額（設備費・開発費など）はおおよそいくらですか？（万円単位でお答えください）',
      input_type: 'number',
      source: 'profile',
      priority: 2
    });
  }
  
  if (!existingFacts.has('current_challenge')) {
    questions.push({
      key: 'current_challenge',
      label: '現在の経営課題は何ですか？（例：人手不足、生産性低下、売上減少、後継者問題など）',
      input_type: 'text',
      source: 'profile',
      priority: 3
    });
  }

  // --- 基本確認（boolean） ---
  if (!existingFacts.has('tax_arrears') && company.tax_arrears === null) {
    questions.push({
      key: 'tax_arrears',
      label: '税金の滞納はありませんか？（法人税、消費税、社会保険料など）',
      input_type: 'boolean',
      source: 'profile',
      priority: 4
    });
  }
  
  if (!existingFacts.has('past_subsidy_same_type') && !company.past_subsidies_json) {
    questions.push({
      key: 'past_subsidy_same_type',
      label: '過去3年以内に同種の補助金を受給していますか？',
      input_type: 'boolean',
      source: 'profile',
      priority: 5
    });
  }

  // --- 数値情報（number） ---
  if (!existingFacts.has('employee_count') && !company.employee_count) {
    questions.push({
      key: 'employee_count',
      label: '現在の従業員数は何名ですか？（役員を除くパート・アルバイト含む）',
      input_type: 'number',
      source: 'profile',
      priority: 6
    });
  }
  
  if (!existingFacts.has('annual_revenue') && !company.annual_revenue) {
    questions.push({
      key: 'annual_revenue',
      label: '直近1年間の年商（売上高）はいくらですか？（万円単位でお答えください）',
      input_type: 'number',
      source: 'profile',
      priority: 7
    });
  }

  // --- 効果・期待（text: 申請書に直結） ---
  if (!existingFacts.has('expected_effect')) {
    questions.push({
      key: 'expected_effect',
      label: '補助金を活用することで期待する効果を具体的に教えてください。（例：売上20%増加、作業時間50%削減など、数値目標があればより良い）',
      input_type: 'text',
      source: 'profile',
      priority: 8
    });
  }

  // --- 申請準備状況（boolean + text） ---
  if (!existingFacts.has('has_gbiz_id')) {
    questions.push({
      key: 'has_gbiz_id',
      label: 'GビズIDプライムアカウントを取得済みですか？（電子申請に必要です）',
      input_type: 'boolean',
      source: 'profile',
      priority: 9
    });
  }

  if (!existingFacts.has('has_business_plan')) {
    questions.push({
      key: 'has_business_plan',
      label: '事業計画書を作成していますか？（または作成予定がありますか？）',
      input_type: 'boolean',
      source: 'profile',
      priority: 10
    });
  }

  if (!existingFacts.has('desired_timeline')) {
    questions.push({
      key: 'desired_timeline',
      label: '事業の実施時期はいつ頃を予定していますか？（例：2026年4月〜9月）',
      input_type: 'text',
      source: 'profile',
      priority: 11
    });
  }

  if (!existingFacts.has('is_wage_raise_planned')) {
    questions.push({
      key: 'is_wage_raise_planned',
      label: '今後1年以内に賃上げ（給与のベースアップ）を予定していますか？（加点項目になる可能性があります）',
      input_type: 'boolean',
      source: 'profile',
      priority: 12
    });
  }
  
  return questions;
}

/**
 * 通貨フォーマット
 */
function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}億円`;
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}万円`;
  }
  return `${value}円`;
}

// =====================================================
// POST /api/chat/sessions - セッション作成
// =====================================================

chat.post('/sessions', async (c) => {
  const user = c.get('user')!;
  const company = c.get('company');
  
  try {
    const { company_id, subsidy_id } = await c.req.json();
    
    const targetCompanyId = company_id || company?.id;
    
    if (!targetCompanyId || !subsidy_id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'company_id and subsidy_id are required' }
      }, 400);
    }
    
    // 既存のアクティブセッションをチェック（collecting または consulting）
    const existingSession = await c.env.DB.prepare(`
      SELECT cs.*, sc.title as subsidy_title FROM chat_sessions cs
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE cs.company_id = ? AND cs.subsidy_id = ? AND cs.status IN ('collecting', 'consulting', 'completed')
      ORDER BY cs.updated_at DESC
      LIMIT 1
    `).bind(targetCompanyId, subsidy_id).first();
    
    if (existingSession) {
      // 既存セッションを返す（全メッセージ + precheck情報付き）
      const existSession = existingSession as any;
      const messages = await c.env.DB.prepare(`
        SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC
      `).bind(existSession.id).all();
      
      // 会社・補助金情報を取得（下部パネル表示用 + 質問再生成用）
      const existCompanyFull = await c.env.DB.prepare(`
        SELECT c.*, cp.* FROM companies c
        LEFT JOIN company_profile cp ON c.id = cp.company_id
        WHERE c.id = ?
      `).bind(existSession.company_id).first() as Record<string, any> | null;
      
      const existSsot = await getNormalizedSubsidyDetail(c.env.DB, existSession.subsidy_id);
      let existNormalized = existSsot?.normalized || null;
      // Cache fallback for non-canonical subsidies
      if (!existNormalized) {
        existNormalized = await buildNsdFromCache(c.env.DB, existSession.subsidy_id as string);
      }
      
      // missing_items を毎回再生成（会社情報の更新を反映するため）
      const existFactsResult = await c.env.DB.prepare(`
        SELECT fact_key, fact_value FROM chat_facts
        WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
      `).bind(existSession.company_id, existSession.subsidy_id).all();
      const existFactsMap = new Map<string, string>();
      for (const f of (existFactsResult.results || []) as any[]) {
        existFactsMap.set(f.fact_key, f.fact_value);
      }
      // 回答済みメッセージのstructured_keyもfactsとして追加
      const answeredKeys = await c.env.DB.prepare(`
        SELECT DISTINCT structured_key FROM chat_messages
        WHERE session_id = ? AND role = 'user' AND structured_key IS NOT NULL
      `).bind(existSession.id).all();
      for (const ak of (answeredKeys.results || []) as any[]) {
        if (ak.structured_key) existFactsMap.set(ak.structured_key, 'answered');
      }
      
      let existRules: any[] = [];
      let existDocs: any[] = [];
      try {
        const rulesResult = await c.env.DB.prepare(`
          SELECT * FROM eligibility_rules WHERE subsidy_id = ?
        `).bind(existSession.subsidy_id).all();
        existRules = (rulesResult.results || []) as any[];
        
        const docsResult = await c.env.DB.prepare(`
          SELECT rbs.*, rdm.doc_name FROM required_documents_by_subsidy rbs
          LEFT JOIN required_documents_master rdm ON rbs.doc_code = rdm.doc_code
          WHERE rbs.subsidy_id = ?
        `).bind(existSession.subsidy_id).all();
        existDocs = (docsResult.results || []) as any[];
      } catch { }
      
      const refreshedPrecheck = existCompanyFull && existNormalized
        ? performPrecheck(existCompanyFull, existNormalized, existRules, existDocs, existFactsMap)
        : null;
      
      // 再生成した missing_items をDBにも更新
      if (refreshedPrecheck && existSession.status === 'collecting') {
        try {
          await c.env.DB.prepare(`
            UPDATE chat_sessions SET missing_items = ?, updated_at = datetime('now') WHERE id = ?
          `).bind(JSON.stringify(refreshedPrecheck.missing_items), existSession.id).run();
        } catch { }
      }
      
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          session: existingSession,
          messages: messages.results || [],
          precheck: refreshedPrecheck || {
            status: 'OK_WITH_MISSING',
            eligible: true,
            blocked_reasons: [],
            missing_items: [],
          },
          is_new: false
        }
      });
    }
    
    // 事前判定を実行
    const companyInfo = await c.env.DB.prepare(`
      SELECT c.*, cp.* FROM companies c
      LEFT JOIN company_profile cp ON c.id = cp.company_id
      WHERE c.id = ?
    `).bind(targetCompanyId).first() as Record<string, any> | null;
    
    // A-3-5: SSOT（getNormalizedSubsidyDetail）から補助金情報取得
    const ssotResult = await getNormalizedSubsidyDetail(c.env.DB, subsidy_id);
    let normalized: NormalizedSubsidyDetail | null = ssotResult?.normalized || null;
    
    // SSOT で見つからない場合は subsidy_cache から直接構築
    if (!normalized) {
      normalized = await buildNsdFromCache(c.env.DB, subsidy_id);
      if (normalized) {
        console.log(`[Chat Session] Cache fallback resolved: ${subsidy_id}`);
      }
    }
    
    // それでも見つからない場合はモックデータからフォールバック
    if (!normalized) {
      const mockDetail = getMockSubsidyDetail(subsidy_id);
      if (mockDetail) {
        console.log(`[Chat Session] Using mock subsidy data for ${subsidy_id}`);
      }
    } else {
      console.log(`[Chat Session] Resolved: ${subsidy_id} → canonical_id: ${normalized.ids.canonical_id}`);
    }
    
    const eligibilityRules = await c.env.DB.prepare(`
      SELECT * FROM eligibility_rules WHERE subsidy_id = ?
    `).bind(subsidy_id).all();
    
    const requiredDocs = await c.env.DB.prepare(`
      SELECT rd.*, rdm.name as doc_name
      FROM required_documents_by_subsidy rd
      LEFT JOIN required_documents_master rdm ON rd.doc_code = rdm.doc_code
      WHERE rd.subsidy_id = ?
    `).bind(subsidy_id).all();
    
    const existingFacts = await c.env.DB.prepare(`
      SELECT fact_key, fact_value FROM chat_facts
      WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
    `).bind(targetCompanyId, subsidy_id).all();
    
    const factsMap = new Map<string, string>();
    for (const fact of (existingFacts.results || [])) {
      factsMap.set((fact as any).fact_key, (fact as any).fact_value);
    }
    
    // A-3-5: 判定ロジック（normalized を使用）
    const precheckResult = performPrecheck(
      companyInfo || {},
      normalized,
      eligibilityRules.results || [],
      requiredDocs.results || [],
      factsMap
    );
    
    // 新規セッション作成
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await c.env.DB.prepare(`
      INSERT INTO chat_sessions (id, user_id, company_id, subsidy_id, status, precheck_result, missing_items, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'collecting', ?, ?, ?, ?)
    `).bind(
      sessionId,
      user.id,
      targetCompanyId,
      subsidy_id,
      JSON.stringify(precheckResult),
      JSON.stringify(precheckResult.missing_items),
      now,
      now
    ).run();
    
    // A-3-5: 初期システムメッセージ作成（normalized から取得）
    const subsidyTitle = normalized?.display.title || '選択された補助金';
    const subsidyRate = normalized?.display.subsidy_rate_text || '';
    const subsidyMaxLimit = normalized?.display.subsidy_max_limit;
    const overviewSummary = normalized?.overview.summary || '';
    
    let systemMessage: string;
    
    // 電子申請の案内を追加 (v3)
    const electronicNotice = precheckResult.electronic_application?.is_electronic
      ? `\n\n📋 **電子申請について**\nこの補助金は「${precheckResult.electronic_application.system_name || '電子申請システム'}」での申請が必要です。` +
        `ここでは申請前の準備（要件確認・情報整理）をサポートします。` +
        (precheckResult.electronic_application.url ? `\n申請先: ${precheckResult.electronic_application.url}` : '')
      : '';
    
    // Phase 19-D: 概要付きの充実したシステムメッセージ
    const overviewNote = overviewSummary 
      ? `\n\n📝 **補助金の概要**\n${overviewSummary.substring(0, 200)}${overviewSummary.length > 200 ? '...' : ''}`
      : '';
    
    const infoNote = (subsidyMaxLimit || subsidyRate)
      ? `\n\n💰 **基本情報**` +
        (subsidyMaxLimit ? `\n・補助上限: ${subsidyMaxLimit >= 100000000 ? (subsidyMaxLimit / 100000000).toFixed(1) + '億円' : subsidyMaxLimit >= 10000 ? Math.floor(subsidyMaxLimit / 10000) + '万円' : subsidyMaxLimit + '円'}` : '') +
        (subsidyRate ? `\n・補助率: ${subsidyRate}` : '')
      : '';
    
    if (precheckResult.status === 'NG') {
      systemMessage = `申し訳ございません。「${subsidyTitle}」への申請要件を満たしていない可能性があります。\n\n【該当しない理由】\n${precheckResult.blocked_reasons.map(r => `・${r}`).join('\n')}\n\n条件を満たせる場合は、会社情報を更新してから再度お試しください。${electronicNotice}`;
    } else if (precheckResult.missing_items.length > 0) {
      systemMessage = `「${subsidyTitle}」への申請準備を進めます！${overviewNote}${infoNote}\n\n会社情報を確認しました。${precheckResult.missing_items.length}件の質問にお答えいただくことで、申請可否を判定し、申請書のドラフト作成に進むことができます。${electronicNotice}`;
    } else {
      systemMessage = `「${subsidyTitle}」への申請準備が整っています。${overviewNote}${infoNote}\n\n必要な情報は揃っていますので、申請書ドラフトの作成に進むことができます。${electronicNotice}`;
    }
    
    const systemMsgId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'system', ?, ?)
    `).bind(systemMsgId, sessionId, systemMessage, now).run();
    
    // 最初の質問メッセージ（missing_itemsがある場合）
    const messages: any[] = [{ id: systemMsgId, role: 'system', content: systemMessage, created_at: now }];
    
    if (precheckResult.missing_items.length > 0 && precheckResult.status !== 'NG') {
      const firstQuestion = precheckResult.missing_items[0];
      const questionMsgId = crypto.randomUUID();
      const questionContent = formatQuestion(firstQuestion);
      
      await c.env.DB.prepare(`
        INSERT INTO chat_messages (id, session_id, role, content, structured_key, created_at)
        VALUES (?, ?, 'assistant', ?, ?, ?)
      `).bind(questionMsgId, sessionId, questionContent, firstQuestion.key, now).run();
      
      messages.push({ id: questionMsgId, role: 'assistant', content: questionContent, structured_key: firstQuestion.key, created_at: now });
    }
    
    // === usage_events に壁打ちセッション開始イベントを必ず記録 ===
    const eventId = crypto.randomUUID();
    try {
      await c.env.DB.prepare(`
        INSERT INTO usage_events (
          id, user_id, company_id, event_type, provider, 
          tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
        ) VALUES (?, ?, ?, 'CHAT_SESSION_STARTED', 'internal', 0, 0, 0, ?, datetime('now'))
      `).bind(
        eventId,
        user.id,
        targetCompanyId,
        JSON.stringify({
          session_id: sessionId,
          subsidy_id,
          precheck_status: precheckResult.status,
          missing_items_count: precheckResult.missing_items.length,
          blocked_reasons_count: precheckResult.blocked_reasons.length,
        })
      ).run();
    } catch (eventError) {
      console.error('Failed to record chat session event:', eventError);
    }
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        session: {
          id: sessionId,
          user_id: user.id,
          company_id: targetCompanyId,
          subsidy_id,
          status: 'collecting',
          precheck_result: precheckResult,
          created_at: now
        },
        messages,
        precheck: precheckResult,
        is_new: true
      }
    });
    
  } catch (error) {
    console.error('Create session error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create session' }
    }, 500);
  }
});

/**
 * 質問のフォーマット
 * 
 * Freeze-WALLCHAT-3: input_type に応じた適切な回答ガイドを表示
 */
function formatQuestion(item: MissingItem): string {
  let question = item.label;
  
  if (item.input_type === 'boolean') {
    question += '\n\n「はい」または「いいえ」でお答えください。';
  } else if (item.input_type === 'number') {
    question += '\n\n数値でお答えください。（例：10、100、1000）';
  } else if (item.input_type === 'select' && item.options) {
    question += `\n\n以下から選択してください：\n${item.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
  } else if (item.input_type === 'text') {
    // textタイプは自由回答を促すメッセージを表示
    question += '\n\n自由にお答えください。';
  }
  
  return question;
}

// =====================================================
// GET /api/chat/sessions - セッション一覧
// =====================================================

chat.get('/sessions', async (c) => {
  const user = c.get('user')!;
  const company = c.get('company');
  
  try {
    const companyId = c.req.query('company_id') || company?.id;
    
    if (!companyId) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NO_COMPANY', message: '会社情報が登録されていません' }
      }, 400);
    }
    
    const sessions = await c.env.DB.prepare(`
      SELECT cs.*, sc.title as subsidy_title
      FROM chat_sessions cs
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE cs.company_id = ?
      ORDER BY cs.created_at DESC
      LIMIT 50
    `).bind(companyId).all();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: sessions.results || []
    });
    
  } catch (error) {
    console.error('Get sessions error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get sessions' }
    }, 500);
  }
});

// =====================================================
// GET /api/chat/sessions/:id - セッション詳細
// =====================================================

// P2-3: UUID形式検証用正規表現
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

chat.get('/sessions/:id', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  
  // P2-3: セッションID形式検証
  if (!UUID_REGEX.test(sessionId)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid session ID format' }
    }, 400);
  }
  
  try {
    const session = await c.env.DB.prepare(`
      SELECT cs.*, sc.title as subsidy_title
      FROM chat_sessions cs
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE cs.id = ? AND cs.user_id = ?
    `).bind(sessionId, user.id).first();
    
    if (!session) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      }, 404);
    }
    
    const messages = await c.env.DB.prepare(`
      SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC
    `).bind(sessionId).all();
    
    // precheck情報を再構築（復元用）
    const sess = session as any;
    let missingItems: MissingItem[] = [];
    try {
      missingItems = JSON.parse(sess.missing_items || '[]');
    } catch { }
    
    // 会社・補助金情報を取得（下部パネル表示用）
    const detailCompany = await c.env.DB.prepare(`
      SELECT id, name, prefecture, employee_count FROM companies WHERE id = ?
    `).bind(sess.company_id).first() as any;
    
    const detailSsot = await getNormalizedSubsidyDetail(c.env.DB, sess.subsidy_id);
    let detailNormalized = detailSsot?.normalized || null;
    // Cache fallback for non-canonical subsidies (REAL-xxx etc.)
    if (!detailNormalized) {
      detailNormalized = await buildNsdFromCache(c.env.DB, sess.subsidy_id as string);
    }
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        session,
        messages: messages.results || [],
        precheck: {
          status: 'OK_WITH_MISSING',
          eligible: true,
          blocked_reasons: [],
          missing_items: missingItems,
          company_info: detailCompany ? {
            id: detailCompany.id,
            name: detailCompany.name,
            prefecture: detailCompany.prefecture,
            employee_count: detailCompany.employee_count,
          } : undefined,
          subsidy_info: detailNormalized ? {
            id: detailNormalized.ids.canonical_id,
            title: detailNormalized.display.title,
            acceptance_end: detailNormalized.acceptance.acceptance_end || undefined,
            max_amount: detailNormalized.display.subsidy_max_limit || undefined,
          } : undefined,
        },
      }
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get session' }
    }, 500);
  }
});

// =====================================================
// POST /api/chat/sessions/:id/message - メッセージ送信
// =====================================================

chat.post('/sessions/:id/message', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  
  // P2-3: セッションID形式検証
  if (!UUID_REGEX.test(sessionId)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid session ID format' }
    }, 400);
  }
  
  try {
    const { content } = await c.req.json();
    
    // Phase 19-QA: 入力安全性の強化
    if (!content || typeof content !== 'string') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'content is required' }
      }, 400);
    }
    
    // 文字列の正規化とサニタイズ
    const sanitizedContent = content.trim().slice(0, 2000); // 最大2000文字
    if (sanitizedContent.length === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'content must not be empty' }
      }, 400);
    }
    
    // セッション取得
    const session = await c.env.DB.prepare(`
      SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first() as any;
    
    if (!session) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      }, 404);
    }
    
    // Phase 19: completedセッションでもconsultingに移行可能
    if (session.status === 'completed') {
      // consultingモードに移行
      await c.env.DB.prepare(`
        UPDATE chat_sessions SET status = 'consulting', updated_at = datetime('now') WHERE id = ?
      `).bind(sessionId).run();
      session.status = 'consulting';
    }
    
    const now = new Date().toISOString();
    
    // 最後のassistantメッセージのstructured_keyを取得
    const lastAssistantMsg = await c.env.DB.prepare(`
      SELECT structured_key FROM chat_messages
      WHERE session_id = ? AND role = 'assistant' AND structured_key IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(sessionId).first() as any;
    
    const currentKey = lastAssistantMsg?.structured_key;
    
    // ユーザーメッセージを保存
    const userMsgId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, structured_key, created_at)
      VALUES (?, ?, 'user', ?, ?, ?)
    `).bind(userMsgId, sessionId, sanitizedContent, currentKey, now).run();
    
    // Phase 20: 回答バリデーション付きで構造化保存
    let answerValidation: { valid: boolean; reason?: string } = { valid: true };
    let currentItemInputType = 'text';
    let currentItemLabel = '';
    
    if (currentKey) {
      // missing_items から現在の質問の型情報を取得
      let factType = 'text';
      let factCategory = 'general';
      let factMetadata: Record<string, any> = {};
      
      try {
        const currentMissingItems: MissingItem[] = JSON.parse(session.missing_items || '[]');
        const currentItem = currentMissingItems.find(item => item.key === currentKey);
        if (currentItem) {
          currentItemInputType = currentItem.input_type || 'text';
          currentItemLabel = currentItem.label || '';
          factType = currentItemInputType;
          factCategory = currentItem.source === 'profile' ? 'profile' : 
                        currentItem.source === 'eligibility' ? 'eligibility' : 'general';
        }
      } catch { /* missing_items parse failure - non-critical */ }
      
      // Phase 20: 回答バリデーション
      answerValidation = validateAnswer(sanitizedContent, currentItemInputType);
      
      if (answerValidation.valid) {
        // バリデーション通過: input_type を渡して適切にパース
        const structuredValue = parseAnswer(sanitizedContent, currentItemInputType);
        factMetadata = {
          input_type: currentItemInputType,
          question_label: currentItemLabel,
          raw_answer: sanitizedContent,
          parsed_answer: structuredValue,
        };
        
        const factId = crypto.randomUUID();
        await c.env.DB.prepare(`
          INSERT INTO chat_facts (id, user_id, company_id, subsidy_id, fact_key, fact_value, fact_type, fact_category, metadata, source, session_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'chat', ?, ?, ?)
          ON CONFLICT(company_id, subsidy_id, fact_key) DO UPDATE SET
            fact_value = excluded.fact_value,
            fact_type = excluded.fact_type,
            metadata = excluded.metadata,
            session_id = excluded.session_id,
            updated_at = excluded.updated_at
        `).bind(
          factId,
          user.id,
          session.company_id,
          session.subsidy_id,
          currentKey,
          structuredValue,
          factType,
          factCategory,
          JSON.stringify(factMetadata),
          sessionId,
          now,
          now
        ).run();
      }
      // answerValidation.valid === false の場合は fact を保存せず、再質問する
    }
    
    // missing_items 取得
    let missingItems: MissingItem[] = [];
    try {
      missingItems = JSON.parse(session.missing_items || '[]');
    } catch (parseErr) {
      console.warn('[Chat] Invalid missing_items format:', parseErr);
    }
    
    // 回答済みの質問を除外
    const answeredFacts = await c.env.DB.prepare(`
      SELECT fact_key, fact_value FROM chat_facts
      WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
    `).bind(session.company_id, session.subsidy_id).all();
    
    const answeredKeys = new Set((answeredFacts.results || []).map((f: any) => f.fact_key));
    const factsMap: Record<string, string> = {};
    for (const f of (answeredFacts.results || []) as any[]) {
      factsMap[f.fact_key] = f.fact_value;
    }
    const remainingItems = missingItems.filter(item => !answeredKeys.has(item.key));
    
    // === Phase 19: AIコンシェルジュ統合 ===
    // Phase 20: バリデーション失敗時は再質問（同じ質問をもう一度聞く）
    const answerWasInvalid = !answerValidation.valid && currentKey;
    const isConsultingMode = !answerWasInvalid && (session.status === 'consulting' || remainingItems.length === 0);
    
    let responseContent: string;
    let responseKey: string | null = null;
    let sessionCompleted = false;
    let mode: 'structured' | 'free' = 'structured';
    let suggestedQuestions: string[] | undefined;
    let nextQuestionForResponse: MissingItem | undefined; // レスポンス用の次の質問情報
    
    // 補助金情報を取得（AI回答生成用）
    const ssotResult = await getNormalizedSubsidyDetail(c.env.DB, session.subsidy_id);
    let normalized = ssotResult?.normalized || null;
    // Cache fallback for non-canonical subsidies (REAL-xxx etc.)
    if (!normalized) {
      normalized = await buildNsdFromCache(c.env.DB, session.subsidy_id as string);
      if (normalized) console.log(`[Chat Message] Cache fallback resolved: ${session.subsidy_id}`);
    }
    
    // 企業情報を取得（Phase 19-QA: company_profile の全情報をAIに渡す）
    const companyInfo = await c.env.DB.prepare(`
      SELECT c.*, cp.corp_type, cp.founding_year, cp.business_summary, 
             cp.main_products, cp.main_customers, cp.competitive_advantage,
             cp.is_profitable, cp.past_subsidies_json, cp.certifications_json
      FROM companies c
      LEFT JOIN company_profile cp ON c.id = cp.company_id
      WHERE c.id = ?
    `).bind(session.company_id).first() as any;
    
    // Phase 19-QA: company_profile のパース済み情報
    let pastSubsidies: string[] = [];
    let certifications: string[] = [];
    try {
      if (companyInfo?.past_subsidies_json) {
        const parsed = JSON.parse(companyInfo.past_subsidies_json);
        pastSubsidies = Array.isArray(parsed) ? parsed.map((s: any) => typeof s === 'string' ? s : s.name || '') : [];
      }
    } catch { /* ignore parse errors */ }
    try {
      if (companyInfo?.certifications_json) {
        const parsed = JSON.parse(companyInfo.certifications_json);
        certifications = Array.isArray(parsed) ? parsed.map((s: any) => typeof s === 'string' ? s : s.name || '') : [];
      }
    } catch { /* ignore parse errors */ }

    const companyContext: CompanyContext = {
      id: companyInfo?.id || session.company_id,
      name: companyInfo?.name || '不明',
      prefecture: companyInfo?.prefecture || '不明',
      city: companyInfo?.city,
      industry_major: companyInfo?.industry_major || '不明',
      employee_count: companyInfo?.employee_count || 0,
      capital: companyInfo?.capital,
      annual_revenue: companyInfo?.annual_revenue,
      established_date: companyInfo?.established_date,
      profile: {
        corp_type: companyInfo?.corp_type || undefined,
        founding_year: companyInfo?.founding_year || undefined,
        business_summary: companyInfo?.business_summary || undefined,
        main_products: companyInfo?.main_products || undefined,
        main_customers: companyInfo?.main_customers || undefined,
        competitive_advantage: companyInfo?.competitive_advantage || undefined,
        is_profitable: companyInfo?.is_profitable != null ? Boolean(companyInfo.is_profitable) : undefined,
        past_subsidies: pastSubsidies.length > 0 ? pastSubsidies : undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
      },
    };
    
    // 会話履歴を取得（最新10件）
    const historyMessages = await c.env.DB.prepare(`
      SELECT role, content FROM chat_messages
      WHERE session_id = ? AND role IN ('user', 'assistant')
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(sessionId).all();
    
    const history: AIChatMessage[] = (historyMessages.results || []).reverse().map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    
    if (isConsultingMode) {
      // === 自由会話モード（AIコンシェルジュ） ===
      mode = 'free';
      
      // 構造化質問が完了した直後でまだconsultingに移行していない場合
      if (session.status === 'collecting' && remainingItems.length === 0) {
        await c.env.DB.prepare(`
          UPDATE chat_sessions SET status = 'consulting', updated_at = ? WHERE id = ?
        `).bind(now, sessionId).run();
        
        // Phase 20: chat_facts → company_profile 自動反映
        try {
          const syncResult = await syncFactsToProfile(c.env.DB, session.company_id, session.subsidy_id);
          console.log(`[Chat] Facts synced to profile: ${syncResult.synced} items, ${syncResult.errors.length} errors`);
          if (syncResult.errors.length > 0) {
            console.warn('[Chat] Sync errors:', syncResult.errors);
          }
        } catch (syncError) {
          console.error('[Chat] Facts sync failed:', syncError);
          // 同期失敗はクリティカルではないので続行
        }
      }
      
      const ctx: ConversationContext = {
        mode: 'free',
        subsidy: normalized,
        company: companyContext,
        facts: factsMap,
        history,
        remainingQuestions: [],
        sessionStatus: 'consulting',
      };
      
      try {
        const aiResponse = await generateAIResponse(c.env, ctx, sanitizedContent);
        responseContent = aiResponse.content;
        suggestedQuestions = aiResponse.suggested_questions;
        
        // 使用トークン記録
        if (aiResponse.tokens_used) {
          const eventId = crypto.randomUUID();
          try {
            await c.env.DB.prepare(`
              INSERT INTO usage_events (
                id, user_id, company_id, event_type, provider,
                tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
              ) VALUES (?, ?, ?, 'CHAT_AI_RESPONSE', 'openai', ?, ?, ?, ?, datetime('now'))
            `).bind(
              eventId,
              user.id,
              session.company_id,
              aiResponse.tokens_used.prompt,
              aiResponse.tokens_used.completion,
              ((aiResponse.tokens_used.prompt * 0.00015 + aiResponse.tokens_used.completion * 0.0006) / 1000),
              JSON.stringify({ session_id: sessionId, mode: 'free' })
            ).run();
          } catch (e) {
            console.error('Failed to record AI usage:', e);
          }
        }
      } catch (aiError) {
        console.error('[Chat AI] Error:', aiError);
        responseContent = '申し訳ありません、一時的に回答を生成できませんでした。もう一度お試しください。';
      }
      
    } else {
      // === 構造化質問フェーズ（AI強化版） ===
      mode = 'structured';
      
      // Phase 20: バリデーション失敗時は同じ質問を再度聞く
      let targetQuestion: MissingItem | undefined;
      let isRetry = false;
      
      if (answerWasInvalid) {
        // 現在の質問を再度聞く（回答がまだ保存されていないので remaining に含まれている）
        const currentMissingItems: MissingItem[] = JSON.parse(session.missing_items || '[]');
        const retryItem = currentMissingItems.find(item => item.key === currentKey);
        targetQuestion = retryItem || remainingItems[0];
        isRetry = true;
      } else {
        targetQuestion = remainingItems[0];
      }
      
      const nextQuestion = targetQuestion;
      nextQuestionForResponse = nextQuestion; // レスポンス用に保存
      
      // Phase 24-fix: nextQuestion が undefined の場合の安全な処理
      if (!nextQuestion) {
        console.warn('[Chat] No next question available, switching to consulting mode');
        // 質問がない場合はコンシェルジュモードに移行
        responseContent = '基本情報の確認が完了しました。何かご不明な点があれば、お気軽にご質問ください。';
        responseKey = null;
        mode = 'free';
        // セッションステータスを更新
        await c.env.DB.prepare(`
          UPDATE chat_sessions SET status = 'consulting', updated_at = ? WHERE id = ?
        `).bind(now, sessionId).run();
      } else {
      
      // AIで自然な応答を生成試行
      if (c.env.OPENAI_API_KEY) {
        const ctx: ConversationContext = {
          mode: 'structured',
          subsidy: normalized,
          company: companyContext,
          facts: factsMap,
          history,
          remainingQuestions: remainingItems.map(i => ({
            key: i.key,
            label: i.label,
            input_type: i.input_type,
            options: i.options,
            source: i.source,
            priority: i.priority,
          })),
          sessionStatus: 'collecting',
        };
        
        // Phase 20: バリデーション失敗時は再質問を促すプロンプト
        let promptForAI: string;
        if (isRetry && answerValidation.reason) {
          const retryHints: Record<string, string> = {
            'number_got_boolean': `ユーザーが「${sanitizedContent}」と答えましたが、この質問は数値（数字）での回答が必要です。「はい・いいえ」ではなく、具体的な数字で教えてもらうよう丁寧に聞き直してください。`,
            'number_no_digits': `ユーザーが「${sanitizedContent}」と答えましたが、数値が含まれていません。具体的な数字で教えてもらうよう丁寧に聞き直してください。`,
            'text_got_boolean': `ユーザーが「${sanitizedContent}」と答えましたが、この質問は具体的な内容（文章）での回答が必要です。もう少し具体的に教えてもらうよう丁寧に聞き直してください。`,
            'text_too_short': `ユーザーの回答が短すぎます。もう少し具体的に教えてもらうよう丁寧に聞き直してください。`,
          };
          promptForAI = `${retryHints[answerValidation.reason] || 'ユーザーの回答が質問の形式に合っていません。丁寧に聞き直してください。'}

重要: ユーザーを責めない。「もう少し詳しく」「具体的に」と優しく促す。回答例を示すとよい。200文字以内で簡潔に。マークダウン記法は使わない。`;
        } else {
          // 通常の次の質問への遷移（AIはリアクションのみ、質問はシステムが表示）
          promptForAI = `ユーザーの回答: 「${sanitizedContent}」

この回答に対して、共感・補足のリアクションを1〜2文で返してください。

重要ルール:
- 質問文は絶対に含めないこと（「〜ですか？」「〜でしょうか？」禁止）
- 次の質問はシステムが自動表示するので、あなたは質問しない
- ユーザーの回答内容に触れて、共感や補足情報を簡潔に述べるだけ
- 200文字以内で簡潔に
- マークダウン記法は使わない`;
        }
        
        try {
          const aiResponse = await generateAIResponse(c.env, ctx, promptForAI);
          responseContent = aiResponse.content;
          
          if (aiResponse.tokens_used) {
            const eventId = crypto.randomUUID();
            try {
              await c.env.DB.prepare(`
                INSERT INTO usage_events (
                  id, user_id, company_id, event_type, provider,
                  tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
                ) VALUES (?, ?, ?, 'CHAT_AI_RESPONSE', 'openai', ?, ?, ?, ?, datetime('now'))
              `).bind(
                eventId,
                user.id,
                session.company_id,
                aiResponse.tokens_used.prompt,
                aiResponse.tokens_used.completion,
                ((aiResponse.tokens_used.prompt * 0.00015 + aiResponse.tokens_used.completion * 0.0006) / 1000),
                JSON.stringify({ session_id: sessionId, mode: 'structured', is_retry: isRetry })
              ).run();
            } catch (e) {
              console.error('Failed to record AI usage:', e);
            }
          }
        } catch (aiError) {
          console.error('[Chat AI Structured] Error:', aiError);
          // AIフォールバック: 改良型応答
          responseContent = buildFallbackStructuredResponse(sanitizedContent, nextQuestion!, answeredKeys.size, remainingItems.length, isRetry, answerValidation.reason);
        }
      } else {
        // OPENAI_API_KEYがない場合: 改良型フォールバック応答
        responseContent = buildFallbackStructuredResponse(sanitizedContent, nextQuestion!, answeredKeys.size, remainingItems.length, isRetry, answerValidation.reason);
      }
      
      responseKey = nextQuestion.key;
      } // end of nextQuestion exists block
    }
    
    // アシスタントメッセージを保存
    const assistantMsgId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, structured_key, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?)
    `).bind(assistantMsgId, sessionId, responseContent, responseKey, now).run();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        user_message: {
          id: userMsgId,
          role: 'user',
          content: sanitizedContent,
          structured_key: currentKey,
          created_at: now
        },
        assistant_message: {
          id: assistantMsgId,
          role: 'assistant',
          content: responseContent,
          structured_key: responseKey,
          created_at: now
        },
        session_completed: false,  // Phase 19: 構造化質問完了後もconsultingモードで継続
        mode,
        // Phase 20: バリデーション失敗時は remaining を減らさない
        remaining_questions: answerWasInvalid ? remainingItems.length : (remainingItems.length > 0 ? remainingItems.length - 1 : 0),
        suggested_questions: suggestedQuestions,
        consulting_mode: isConsultingMode,
        // Phase 20: フロントエンドにバリデーション結果を通知
        answer_invalid: answerWasInvalid ? true : undefined,
        answer_invalid_reason: answerValidation.reason || undefined,
        // 次の質問情報（フロントエンドがinput_type判定に使用）
        next_question: (mode === 'structured' && !isConsultingMode && nextQuestionForResponse) ? {
          key: responseKey,
          label: nextQuestionForResponse.label || null,
          input_type: nextQuestionForResponse.input_type || null,
          options: nextQuestionForResponse.options || null,
        } : undefined,
      }
    });
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error('Send message error:', errMsg);
    console.error('Send message stack:', errStack);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send message: ' + errMsg.slice(0, 100) }
    }, 500);
  }
});

// =====================================================
// POST /api/chat/sessions/:id/message/stream - SSEストリーミング
// Phase 20: AI回答をリアルタイム表示（コンシェルジュモード専用）
// =====================================================

chat.post('/sessions/:id/message/stream', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  
  if (!UUID_REGEX.test(sessionId)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid session ID format' }
    }, 400);
  }
  
  try {
    const { content } = await c.req.json();
    
    if (!content || typeof content !== 'string') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'content is required' }
      }, 400);
    }
    
    const sanitizedContent = content.trim().slice(0, 2000);
    if (sanitizedContent.length === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'content must not be empty' }
      }, 400);
    }
    
    // セッション取得
    const session = await c.env.DB.prepare(`
      SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first() as any;
    
    if (!session) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      }, 404);
    }
    
    // ストリーミングはコンシェルジュモード（free）でのみ対応
    if (session.status !== 'consulting' && session.status !== 'completed') {
      // 構造化質問フェーズは通常のエンドポイントにフォールバック
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_STREAMING', message: 'Streaming only available in consulting mode' }
      }, 400);
    }
    
    // completedセッションでもconsultingに移行
    if (session.status === 'completed') {
      await c.env.DB.prepare(`
        UPDATE chat_sessions SET status = 'consulting', updated_at = datetime('now') WHERE id = ?
      `).bind(sessionId).run();
    }
    
    const now = new Date().toISOString();
    
    // ユーザーメッセージを保存
    const userMsgId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'user', ?, ?)
    `).bind(userMsgId, sessionId, sanitizedContent, now).run();
    
    // 企業・補助金情報取得
    const ssotResult = await getNormalizedSubsidyDetail(c.env.DB, session.subsidy_id);
    let normalized = ssotResult?.normalized || null;
    // Cache fallback for non-canonical subsidies (REAL-xxx etc.)
    if (!normalized) {
      normalized = await buildNsdFromCache(c.env.DB, session.subsidy_id as string);
      if (normalized) console.log(`[Chat Stream] Cache fallback resolved: ${session.subsidy_id}`);
    }
    
    const companyInfo = await c.env.DB.prepare(`
      SELECT c.*, cp.corp_type, cp.founding_year, cp.business_summary,
             cp.main_products, cp.main_customers, cp.competitive_advantage,
             cp.is_profitable, cp.past_subsidies_json, cp.certifications_json
      FROM companies c
      LEFT JOIN company_profile cp ON c.id = cp.company_id
      WHERE c.id = ?
    `).bind(session.company_id).first() as any;
    
    let pastSubsidies: string[] = [];
    let certifications: string[] = [];
    try {
      if (companyInfo?.past_subsidies_json) {
        pastSubsidies = JSON.parse(companyInfo.past_subsidies_json);
      }
    } catch { }
    try {
      if (companyInfo?.certifications_json) {
        certifications = JSON.parse(companyInfo.certifications_json);
      }
    } catch { }
    
    const companyContext: CompanyContext = {
      id: companyInfo?.id || session.company_id,
      name: companyInfo?.name || '不明',
      prefecture: companyInfo?.prefecture || '不明',
      city: companyInfo?.city,
      industry_major: companyInfo?.industry_major || '不明',
      employee_count: companyInfo?.employee_count || 0,
      capital: companyInfo?.capital,
      annual_revenue: companyInfo?.annual_revenue,
      established_date: companyInfo?.established_date,
      profile: {
        corp_type: companyInfo?.corp_type || undefined,
        founding_year: companyInfo?.founding_year || undefined,
        business_summary: companyInfo?.business_summary || undefined,
        main_products: companyInfo?.main_products || undefined,
        main_customers: companyInfo?.main_customers || undefined,
        competitive_advantage: companyInfo?.competitive_advantage || undefined,
        is_profitable: companyInfo?.is_profitable != null ? Boolean(companyInfo.is_profitable) : undefined,
        past_subsidies: pastSubsidies.length > 0 ? pastSubsidies : undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
      },
    };
    
    // facts 取得
    const answeredFacts = await c.env.DB.prepare(`
      SELECT fact_key, fact_value FROM chat_facts
      WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
    `).bind(session.company_id, session.subsidy_id).all();
    
    const factsMap: Record<string, string> = {};
    for (const f of (answeredFacts.results || []) as any[]) {
      factsMap[f.fact_key] = f.fact_value;
    }
    
    // 会話履歴
    const historyMessages = await c.env.DB.prepare(`
      SELECT role, content FROM chat_messages
      WHERE session_id = ? AND role IN ('user', 'assistant')
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(sessionId).all();
    
    const history: AIChatMessage[] = (historyMessages.results || []).reverse().map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    
    const ctx: ConversationContext = {
      mode: 'free',
      subsidy: normalized,
      company: companyContext,
      facts: factsMap,
      history,
      remainingQuestions: [],
      sessionStatus: 'consulting',
    };
    
    // ストリーミングレスポンスを取得
    const stream = await generateAIResponseStream(c.env, ctx, sanitizedContent);
    
    if (!stream) {
      // ストリーミング不可: 通常APIでフォールバック
      const aiResponse = await generateAIResponse(c.env, ctx, sanitizedContent);
      
      // メッセージ保存
      const assistantMsgId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO chat_messages (id, session_id, role, content, created_at)
        VALUES (?, ?, 'assistant', ?, ?)
      `).bind(assistantMsgId, sessionId, aiResponse.content, now).run();
      
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          user_message: { id: userMsgId, role: 'user', content: sanitizedContent, created_at: now },
          assistant_message: { id: assistantMsgId, role: 'assistant', content: aiResponse.content, created_at: now },
          mode: 'free',
          consulting_mode: true,
          suggested_questions: aiResponse.suggested_questions,
          streamed: false,
        }
      });
    }
    
    // SSEストリーミングレスポンス
    const assistantMsgId = crypto.randomUUID();
    let fullContent = '';
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const sseStream = new ReadableStream({
      async start(controller) {
        // 初期イベント: user_message情報
        const initEvent = `data: ${JSON.stringify({
          type: 'init',
          user_message: { id: userMsgId, role: 'user', content: sanitizedContent, created_at: now },
          assistant_message_id: assistantMsgId,
        })}\n\n`;
        controller.enqueue(encoder.encode(initEvent));
        
        const reader = stream.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // OpenAI SSEフォーマットをパース
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    fullContent += delta;
                    const tokenEvent = `data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`;
                    controller.enqueue(encoder.encode(tokenEvent));
                  }
                } catch { /* ignore parse errors in stream */ }
              }
            }
          }
        } catch (streamError) {
          console.error('[Chat SSE] Stream read error:', streamError);
        }
        
        // 完了イベント
        try {
          // メッセージをDBに保存
          await c.env.DB.prepare(`
            INSERT INTO chat_messages (id, session_id, role, content, created_at)
            VALUES (?, ?, 'assistant', ?, ?)
          `).bind(assistantMsgId, sessionId, fullContent, now).run();
          
          // 使用トークンの概算記録
          const eventId = crypto.randomUUID();
          await c.env.DB.prepare(`
            INSERT INTO usage_events (
              id, user_id, company_id, event_type, provider,
              tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
            ) VALUES (?, ?, ?, 'CHAT_AI_RESPONSE', 'openai', 0, 0, 0, ?, datetime('now'))
          `).bind(
            eventId,
            user.id,
            session.company_id,
            JSON.stringify({ session_id: sessionId, mode: 'free', streamed: true, content_length: fullContent.length })
          ).run();
        } catch (saveError) {
          console.error('[Chat SSE] Save error:', saveError);
        }
        
        // suggested_questions を抽出して完了イベントを送信
        const suggestedQuestions = extractSuggestedQuestionsFromContent(fullContent);
        const doneEvent = `data: ${JSON.stringify({
          type: 'done',
          assistant_message: { id: assistantMsgId, role: 'assistant', content: fullContent, created_at: now },
          consulting_mode: true,
          suggested_questions: suggestedQuestions,
        })}\n\n`;
        controller.enqueue(encoder.encode(doneEvent));
        
        controller.close();
      },
    });
    
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Stream message error:', errMsg);
    console.error('Stream message stack:', error instanceof Error ? error.stack : '');
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to stream message: ' + errMsg.slice(0, 100) }
    }, 500);
  }
});

/**
 * suggested_questions をAI回答文から抽出
 */
function extractSuggestedQuestionsFromContent(content: string): string[] {
  const questions: string[] = [];
  const matches = content.match(/[^\n。！]*(?:ですか|でしょうか|ましょうか|いかがですか)[？?]/g);
  if (matches) {
    questions.push(...matches.slice(-2));
  }
  return questions;
}

/**
 * 回答のパース（input_type を考慮した型安全なパース）
 * 
 * Phase 20: input_type を受け取り、型に合わない回答を検出
 * - boolean 質問: はい/いいえ系のみ true/false に変換
 * - number 質問: 数値のみ抽出、非数値は raw テキストとして保持
 * - text 質問: そのまま保持
 * - 全型共通: 「わからない」系は 'unknown'
 */
function parseAnswer(content: string, inputType?: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) return '';
  
  const lower = trimmed.toLowerCase();
  
  // 「わからない」系は全型で共通処理
  if (['わからない', 'わかりません', '不明', '未定'].includes(lower)) {
    return 'unknown';
  }
  
  const truePatterns = ['はい', 'yes', 'true', '○', 'あります', 'できます', 'います', '該当します'];
  const falsePatterns = ['いいえ', 'no', 'false', '×', 'ありません', 'できません', 'いません', '該当しません', 'ない'];
  
  if (inputType === 'boolean') {
    // boolean 質問: はい/いいえ系のみ変換、それ以外はそのまま保持（再質問トリガー）
    if (truePatterns.includes(lower)) return 'true';
    if (falsePatterns.includes(lower)) return 'false';
    // boolean 質問に対する非boolean回答 → そのまま返す（バリデーションで検出）
    return trimmed;
  }
  
  if (inputType === 'number') {
    // number 質問: 数値を抽出
    const numOnly = trimmed.replace(/[,，\s]/g, '');
    if (/^\d+(\.\d+)?$/.test(numOnly)) return numOnly;
    // 「1000万」「3億」等の日本語数値
    const jpNumMatch = numOnly.match(/^(\d+(?:\.\d+)?)\s*(万|億|千)?(円)?$/);
    if (jpNumMatch) {
      let val = parseFloat(jpNumMatch[1]);
      if (jpNumMatch[2] === '億') val *= 100000000;
      else if (jpNumMatch[2] === '万') val *= 10000;
      else if (jpNumMatch[2] === '千') val *= 1000;
      return String(val);
    }
    // 文中から数値を抽出試行（「約50名」「10人」等）
    const numInText = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(?:名|人|万円|円|万|億|千|個|台|件)?/);
    if (numInText) {
      return numInText[1].replace(/[,，]/g, '');
    }
    // boolean 回答を number 質問に誤入力した場合 → そのまま返す（バリデーションで検出）
    return trimmed;
  }
  
  // text / select / デフォルト: boolean 変換せず、そのまま保持
  // （text 質問に「はい」と答えた場合、それ自体が回答として有用でない可能性がある）
  if (inputType === 'text') {
    // 「はい」「いいえ」だけの回答は text 質問には不十分 → そのまま返す（バリデーションで検出）
    return trimmed;
  }
  
  // inputType 不明の場合: 従来の変換ロジック
  if (truePatterns.includes(lower)) return 'true';
  if (falsePatterns.includes(lower)) return 'false';
  
  const numOnly = trimmed.replace(/[,，]/g, '');
  if (/^\d+(\.\d+)?$/.test(numOnly)) return numOnly;
  
  return trimmed;
}

/**
 * 回答のバリデーション: input_type に対して回答が適切かチェック
 * 
 * Phase 20: 不適切な回答を検出し、再質問を促す
 * 戻り値: { valid: true } or { valid: false, reason: string }
 */
function validateAnswer(content: string, inputType: string): { valid: boolean; reason?: string } {
  const trimmed = content.trim().toLowerCase();
  
  // 「わからない」は全型で有効
  if (['わからない', 'わかりません', '不明', '未定'].includes(trimmed)) {
    return { valid: true };
  }
  
  const booleanWords = ['はい', 'yes', 'true', '○', 'いいえ', 'no', 'false', '×',
    'あります', 'できます', 'います', '該当します',
    'ありません', 'できません', 'いません', '該当しません', 'ない'];
  
  if (inputType === 'number') {
    // boolean 回答は number 質問に不適切
    if (booleanWords.includes(trimmed)) {
      return { valid: false, reason: 'number_got_boolean' };
    }
    // 最低限、数字が含まれているか
    if (!/\d/.test(content)) {
      return { valid: false, reason: 'number_no_digits' };
    }
    return { valid: true };
  }
  
  if (inputType === 'text') {
    // 「はい」「いいえ」だけの回答は text 質問に不十分
    if (booleanWords.includes(trimmed)) {
      return { valid: false, reason: 'text_got_boolean' };
    }
    // 1文字回答は不十分
    if (content.trim().length < 2) {
      return { valid: false, reason: 'text_too_short' };
    }
    return { valid: true };
  }
  
  // boolean, select, その他 → 全て有効
  return { valid: true };
}

/**
 * 構造化質問フェーズの改良型フォールバック応答
 * 
 * Phase 20: 機械的な「ありがとうございます。次の質問です。」を排除
 * バリデーション失敗時の再質問、回答に対する反応の多様化
 */
function buildFallbackStructuredResponse(
  userAnswer: string,
  nextQuestion: MissingItem,
  answeredCount: number,
  remainingCount: number,
  isRetry: boolean,
  retryReason?: string,
): string {
  // バリデーション失敗時: 丁寧に聞き直す（質問文はフロントエンドUIが表示するため含めない）
  if (isRetry) {
    if (retryReason === 'number_got_boolean' || retryReason === 'number_no_digits') {
      const examples: Record<string, string> = {
        'employee_count': '例えば「10名」「50」のように',
        'annual_revenue': '例えば「5000万円」「3億」のように',
        'investment_amount': '例えば「500万円」「1000」のように',
      };
      const hint = Object.entries(examples).find(([k]) => nextQuestion.key.includes(k))?.[1] 
        || '具体的な数字で';
      return `すみません、この質問は数値でお答えいただけると助かります。${hint}教えてください。`;
    }
    if (retryReason === 'text_got_boolean' || retryReason === 'text_too_short') {
      return 'ありがとうございます。もう少し具体的に教えていただけると、より的確なアドバイスができます。';
    }
    return 'すみません、もう少し具体的に教えていただけますか？';
  }
  
  // 通常の応答: 回答に対する反応のみ（質問はフロントエンドUIが表示）
  const reactions = [
    'ご回答ありがとうございます。',
    '承知しました。',
    'なるほど、分かりました。',
    '確認できました。',
    'ありがとうございます、把握しました。',
  ];
  
  // 進捗に応じた追加コメント
  let progressComment = '';
  if (remainingCount <= 2) {
    progressComment = 'もうすぐ全ての確認が完了します！';
  } else if (remainingCount <= 4) {
    progressComment = '残りわずかです。もう少しお付き合いください。';
  } else if (answeredCount === 0) {
    progressComment = '';
  }
  
  const reaction = reactions[answeredCount % reactions.length];
  return progressComment ? `${reaction} ${progressComment}` : reaction;
}

// =====================================================
// POST /api/chat/sessions/:id/upload - 資料アップロード
// Phase 20: R2連携でチャット経由の書類アップロード
// =====================================================

chat.post('/sessions/:id/upload', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  
  if (!UUID_REGEX.test(sessionId)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid session ID format' }
    }, 400);
  }
  
  try {
    // セッション取得
    const session = await c.env.DB.prepare(`
      SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first() as any;
    
    if (!session) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      }, 404);
    }
    
    // multipart/form-data からファイルを取得
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const docType = (formData.get('doc_type') as string) || 'other';
    
    if (!file || !(file instanceof File)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ファイルが選択されていません' }
      }, 400);
    }
    
    // ファイルサイズ制限（10MB）
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'ファイルサイズは10MB以下にしてください' }
      }, 400);
    }
    
    // 許可するファイルタイプ
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/msword', // doc
      'application/vnd.ms-excel', // xls
      'text/plain', 'text/csv',
    ];
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_FILE_TYPE', message: 'このファイル形式はサポートされていません。PDF、画像、Word、Excelファイルをアップロードしてください。' }
      }, 400);
    }
    
    // R2にアップロード
    const docId = crypto.randomUUID();
    const ext = file.name.split('.').pop() || 'bin';
    const r2Key = `documents/${session.company_id}/${docId}.${ext}`;
    
    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_KNOWLEDGE.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalFilename: file.name,
        docType: docType,
        companyId: session.company_id,
        sessionId: sessionId,
        uploadedBy: user.id,
      },
    });
    
    // DBに記録
    const now = new Date().toISOString();
    await c.env.DB.prepare(`
      INSERT INTO company_documents (
        id, company_id, doc_type, original_filename, content_type, size_bytes,
        storage_backend, r2_key, status, session_id, uploaded_via, uploaded_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'r2', ?, 'uploaded', ?, 'chat', ?, ?)
    `).bind(
      docId,
      session.company_id,
      docType,
      file.name,
      file.type,
      file.size,
      r2Key,
      sessionId,
      now,
      now
    ).run();
    
    // チャットメッセージに記録（アシスタントメッセージとして通知）
    const DOC_TYPE_LABELS: Record<string, string> = {
      'financial_statement': '決算書',
      'tax_return': '確定申告書',
      'business_plan': '事業計画書',
      'registration': '登記簿謄本',
      'quotation': '見積書',
      'other': 'その他の資料',
    };
    const docLabel = DOC_TYPE_LABELS[docType] || docType;
    
    // ユーザーメッセージ（アップロード通知）
    const userMsgId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'user', ?, ?)
    `).bind(
      userMsgId,
      sessionId,
      `📎 ${file.name}（${docLabel}）をアップロードしました`,
      now
    ).run();
    
    // アシスタント確認メッセージ
    const assistantMsgId = crypto.randomUUID();
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const confirmMsg = `ファイルを受け取りました。\n\n📄 ${file.name}\n📂 種類: ${docLabel}\n💾 サイズ: ${sizeMB}MB\n\nこの書類は申請準備の参考資料として保存しました。申請書ドラフト作成時に活用いたします。\n\n他にも準備している書類があればアップロードしてください。`;
    
    await c.env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'assistant', ?, ?)
    `).bind(assistantMsgId, sessionId, confirmMsg, now).run();
    
    // chat_facts にドキュメント関連factを記録
    const factId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO chat_facts (
        id, user_id, company_id, subsidy_id, fact_key, fact_value,
        fact_type, fact_category, metadata, source, session_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'file', 'document', ?, 'chat', ?, ?, ?)
      ON CONFLICT(company_id, subsidy_id, fact_key) DO UPDATE SET
        fact_value = excluded.fact_value,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `).bind(
      factId,
      user.id,
      session.company_id,
      session.subsidy_id,
      `doc_uploaded_${docType}`,
      'true',
      JSON.stringify({
        document_id: docId,
        filename: file.name,
        doc_type: docType,
        size_bytes: file.size,
        content_type: file.type,
        r2_key: r2Key,
      }),
      sessionId,
      now,
      now
    ).run();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        document: {
          id: docId,
          doc_type: docType,
          original_filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          status: 'uploaded',
          uploaded_at: now,
        },
        user_message: {
          id: userMsgId,
          role: 'user',
          content: `📎 ${file.name}（${docLabel}）をアップロードしました`,
          created_at: now,
        },
        assistant_message: {
          id: assistantMsgId,
          role: 'assistant',
          content: confirmMsg,
          created_at: now,
        },
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'ファイルのアップロードに失敗しました' }
    }, 500);
  }
});

// =====================================================
// GET /api/chat/documents/:companyId - 企業の書類一覧
// =====================================================

chat.get('/documents/:companyId', async (c) => {
  const user = c.get('user')!;
  const company = c.get('company');
  const companyId = c.req.param('companyId');
  
  // 認可チェック: ユーザーが所属する会社の書類のみアクセス可能
  if (!company || company.id !== companyId) {
    // ミドルウェアで取得した company と不一致 → 追加検証
    const membership = await c.env.DB.prepare(`
      SELECT 1 FROM user_companies WHERE user_id = ? AND company_id = ?
    `).bind(user.id, companyId).first();
    
    if (!membership) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'FORBIDDEN', message: 'この企業の書類へのアクセス権がありません' }
      }, 403);
    }
  }
  
  try {
    const docs = await c.env.DB.prepare(`
      SELECT id, doc_type, original_filename, content_type, size_bytes, status,
             session_id, uploaded_via, uploaded_at
      FROM company_documents
      WHERE company_id = ?
      ORDER BY uploaded_at DESC
      LIMIT 50
    `).bind(companyId).all();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: docs.results || []
    });
  } catch (error) {
    console.error('Get documents error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get documents' }
    }, 500);
  }
});

export default chat;

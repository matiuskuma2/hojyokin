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

const chat = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
chat.use('*', requireAuth);

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
    
    // SSOT で見つからない場合はモックデータからフォールバック
    if (!normalized) {
      const mockDetail = getMockSubsidyDetail(subsidy_id);
      if (mockDetail) {
        console.log(`[Chat] Using mock subsidy data for ${subsidy_id}`);
        // モックデータの場合は normalized を null のまま（performPrecheck で処理）
      }
    } else {
      console.log(`[Chat] SSOT resolved: ${subsidy_id} → canonical_id: ${normalized.ids.canonical_id}`);
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
 */
function evaluateAutoRule(rule: any, company: Record<string, any>): { blocked: boolean; reason: string } {
  const params = rule.parameters ? JSON.parse(rule.parameters) : {};
  const category = rule.category;
  
  // 従業員数チェック
  if (category === 'employee_count' || rule.rule_text?.includes('従業員')) {
    if (params.max && company.employee_count > params.max) {
      return { blocked: true, reason: `従業員数が上限（${params.max}人）を超えています` };
    }
    if (params.min && company.employee_count < params.min) {
      return { blocked: true, reason: `従業員数が下限（${params.min}人）を下回っています` };
    }
  }
  
  // 資本金チェック
  if (category === 'capital' || rule.rule_text?.includes('資本金')) {
    if (params.max && company.capital && company.capital > params.max) {
      return { blocked: true, reason: `資本金が上限（${formatCurrency(params.max)}）を超えています` };
    }
  }
  
  // 業種チェック
  if (category === 'industry' || rule.rule_text?.includes('業種')) {
    if (params.excluded && params.excluded.includes(company.industry_major)) {
      return { blocked: true, reason: '対象外の業種です' };
    }
  }
  
  // 地域チェック
  if (category === 'region' || rule.rule_text?.includes('地域')) {
    if (params.prefectures && !params.prefectures.includes(company.prefecture)) {
      return { blocked: true, reason: '対象地域外です' };
    }
  }
  
  return { blocked: false, reason: '' };
}

/**
 * 入力タイプの判定
 */
function determineInputType(category: string): 'boolean' | 'number' | 'text' | 'select' {
  const booleanCategories = ['has_employees', 'past_subsidy', 'tax_arrears', 'profitable'];
  const numberCategories = ['employee_count', 'capital', 'revenue'];
  
  if (booleanCategories.some(c => category?.includes(c))) {
    return 'boolean';
  }
  if (numberCategories.some(c => category?.includes(c))) {
    return 'number';
  }
  return 'boolean'; // デフォルトはYes/No
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
  // 補助金固有の質問が無い場合の汎用質問
  
  // --- 基本確認（boolean） ---
  if (!existingFacts.has('past_subsidy_same_type') && !company.past_subsidies_json) {
    questions.push({
      key: 'past_subsidy_same_type',
      label: '過去3年以内に同種の補助金を受給していますか？',
      input_type: 'boolean',
      source: 'profile',
      priority: 1
    });
  }
  
  if (!existingFacts.has('tax_arrears') && company.tax_arrears === null) {
    questions.push({
      key: 'tax_arrears',
      label: '税金の滞納はありませんか？',
      input_type: 'boolean',
      source: 'profile',
      priority: 1
    });
  }
  
  // --- 数値情報（number） ---
  if (!existingFacts.has('employee_count') && !company.employee_count) {
    questions.push({
      key: 'employee_count',
      label: '現在の従業員数は何名ですか？（役員を除く）',
      input_type: 'number',
      source: 'profile',
      priority: 2
    });
  }
  
  if (!existingFacts.has('annual_revenue') && !company.annual_revenue) {
    questions.push({
      key: 'annual_revenue',
      label: '直近1年間の年商（売上高）はいくらですか？（万円単位でお答えください）',
      input_type: 'number',
      source: 'profile',
      priority: 3
    });
  }
  
  // --- 自由記述（text） ---
  if (!existingFacts.has('business_purpose')) {
    questions.push({
      key: 'business_purpose',
      label: '今回の補助金で実施したい事業内容を簡単に教えてください。',
      input_type: 'text',
      source: 'profile',
      priority: 4
    });
  }
  
  if (!existingFacts.has('expected_effect')) {
    questions.push({
      key: 'expected_effect',
      label: '補助金を活用することで期待する効果は何ですか？（例：生産性向上、人手不足解消、売上増加など）',
      input_type: 'text',
      source: 'profile',
      priority: 5
    });
  }
  
  // --- 追加確認（boolean） ---
  if (!existingFacts.has('has_business_plan')) {
    questions.push({
      key: 'has_business_plan',
      label: '事業計画書を作成していますか？（または作成予定がありますか？）',
      input_type: 'boolean',
      source: 'profile',
      priority: 6
    });
  }
  
  if (!existingFacts.has('has_gbiz_id')) {
    questions.push({
      key: 'has_gbiz_id',
      label: 'GビズIDプライムアカウントを取得済みですか？',
      input_type: 'boolean',
      source: 'profile',
      priority: 7
    });
  }
  
  if (!existingFacts.has('is_wage_raise_planned')) {
    questions.push({
      key: 'is_wage_raise_planned',
      label: '今後1年以内に賃上げを予定していますか？',
      input_type: 'boolean',
      source: 'profile',
      priority: 8
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
    
    // 既存のアクティブセッションをチェック
    const existingSession = await c.env.DB.prepare(`
      SELECT * FROM chat_sessions
      WHERE company_id = ? AND subsidy_id = ? AND status = 'collecting'
    `).bind(targetCompanyId, subsidy_id).first();
    
    if (existingSession) {
      // 既存セッションを返す
      const messages = await c.env.DB.prepare(`
        SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC
      `).bind((existingSession as any).id).all();
      
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          session: existingSession,
          messages: messages.results || [],
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
    
    // SSOT で見つからない場合はモックデータからフォールバック
    if (!normalized) {
      const mockDetail = getMockSubsidyDetail(subsidy_id);
      if (mockDetail) {
        console.log(`[Chat Session] Using mock subsidy data for ${subsidy_id}`);
      }
    } else {
      console.log(`[Chat Session] SSOT resolved: ${subsidy_id} → canonical_id: ${normalized.ids.canonical_id}`);
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
    let systemMessage: string;
    
    // 電子申請の案内を追加 (v3)
    const electronicNotice = precheckResult.electronic_application?.is_electronic
      ? `\n\n【📋 電子申請について】\nこの補助金は「${precheckResult.electronic_application.system_name || '電子申請システム'}」での申請が必要です。` +
        `ここでは申請前の準備（要件確認・情報整理）をサポートしますが、実際の申請書類は電子申請システム上で作成してください。` +
        (precheckResult.electronic_application.url ? `\n申請先: ${precheckResult.electronic_application.url}` : '')
      : '';
    
    if (precheckResult.status === 'NG') {
      systemMessage = `申し訳ございません。「${subsidyTitle}」への申請要件を満たしていない可能性があります。\n\n【該当しない理由】\n${precheckResult.blocked_reasons.map(r => `・${r}`).join('\n')}\n\n条件を満たせる場合は、会社情報を更新してから再度お試しください。${electronicNotice}`;
    } else if (precheckResult.missing_items.length > 0) {
      systemMessage = `「${subsidyTitle}」への申請準備を進めます。\n\n会社情報を確認したところ、以下の点について追加で確認が必要です。順番にお答えください。${electronicNotice}`;
    } else {
      systemMessage = `「${subsidyTitle}」への申請準備が整っています。\n\n必要な情報は揃っていますので、申請書ドラフトの作成に進むことができます。${electronicNotice}`;
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
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        session,
        messages: messages.results || []
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
    
    if (!content || typeof content !== 'string') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'content is required' }
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
    
    if (session.status === 'completed') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'SESSION_COMPLETED', message: 'This session is already completed' }
      }, 400);
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
    `).bind(userMsgId, sessionId, content, currentKey, now).run();
    
    // 回答を構造化して保存
    if (currentKey) {
      const structuredValue = parseAnswer(content);
      
      // chat_factsに保存（次回以降聞かない）
      const factId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO chat_facts (id, user_id, company_id, subsidy_id, fact_key, fact_value, source, session_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'chat', ?, ?, ?)
      `).bind(
        factId,
        user.id,
        session.company_id,
        session.subsidy_id,
        currentKey,
        structuredValue,
        sessionId,
        now,
        now
      ).run();
    }
    
    // 次の質問を生成
    // P1-5: JSON.parse の例外処理
    let missingItems: MissingItem[] = [];
    try {
      missingItems = JSON.parse(session.missing_items || '[]');
    } catch (parseErr) {
      console.warn('[Chat] Invalid missing_items format:', parseErr);
    }
    
    // 回答済みの質問を除外
    const answeredFacts = await c.env.DB.prepare(`
      SELECT fact_key FROM chat_facts
      WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
    `).bind(session.company_id, session.subsidy_id).all();
    
    const answeredKeys = new Set((answeredFacts.results || []).map((f: any) => f.fact_key));
    const remainingItems = missingItems.filter(item => !answeredKeys.has(item.key));
    
    let responseContent: string;
    let responseKey: string | null = null;
    let sessionCompleted = false;
    
    if (remainingItems.length > 0) {
      // 次の質問
      const nextQuestion = remainingItems[0];
      responseContent = `ありがとうございます。\n\n次の質問です。\n\n${formatQuestion(nextQuestion)}`;
      responseKey = nextQuestion.key;
    } else {
      // 全ての質問に回答済み
      responseContent = `ありがとうございました。必要な情報が揃いました。\n\n申請書ドラフトの作成に進むことができます。\n「申請書を作成」ボタンをクリックして、次のステップに進んでください。`;
      sessionCompleted = true;
      
      // セッションを完了に更新
      await c.env.DB.prepare(`
        UPDATE chat_sessions SET status = 'completed', updated_at = ? WHERE id = ?
      `).bind(now, sessionId).run();
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
          content,
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
        session_completed: sessionCompleted,
        remaining_questions: remainingItems.length - 1
      }
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' }
    }, 500);
  }
});

/**
 * 回答のパース（Yes/No → true/false 等）
 */
function parseAnswer(content: string): string {
  const lower = content.toLowerCase().trim();
  
  // Yes/No判定
  if (['はい', 'yes', 'あります', 'ある', 'できます', 'できる', 'いる', 'います', '該当', '該当します', 'true', '○'].includes(lower)) {
    return 'true';
  }
  if (['いいえ', 'no', 'ない', 'ありません', 'できない', 'できません', 'いない', 'いません', '該当しない', '該当しません', 'false', '×'].includes(lower)) {
    return 'false';
  }
  
  // 数値判定
  const numMatch = content.match(/(\d+)/);
  if (numMatch) {
    return numMatch[1];
  }
  
  // そのまま返す
  return content;
}

export default chat;

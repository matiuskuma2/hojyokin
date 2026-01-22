/**
 * S4: 申請書ドラフト生成 API
 * 
 * POST /api/draft/generate - ドラフト生成（テンプレート or LLM）
 * GET  /api/draft/:id - ドラフト取得
 * PUT  /api/draft/:id - ドラフト更新
 * POST /api/draft/:id/check-ng - NGチェック再実行
 * GET  /api/draft/by-session/:session_id - セッションからドラフト取得
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';

// =====================================================
// 型定義
// =====================================================

interface Sections {
  background: string;      // 背景・課題
  purpose: string;         // 事業目的
  plan: string;            // 実施内容・方法
  team: string;            // 実施体制
  budget_overview: string; // 資金計画（概要）
}

interface NgHit {
  pattern: string;
  reason: string;
  section: keyof Sections | 'unknown';
  excerpt: string;
}

interface NgResult {
  score: number;
  hits: NgHit[];
}

interface DraftData {
  id: string;
  session_id: string;
  user_id: string;
  company_id: string;
  subsidy_id: string;
  status: 'draft' | 'final';
  version: number;
  sections_json: string;
  ng_result_json: string | null;
  trace_json: string | null;
  created_at: string;
  updated_at: string;
}

const draft = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
draft.use('*', requireAuth);

// =====================================================
// ヘルパー関数
// =====================================================

function nowIso(): string {
  return new Date().toISOString();
}

// Phase 1: 最小NGルール（後でDB化可能）
const NG_RULES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(必ず採択|絶対に通る|100%|確実に採択)/g, reason: '断定表現（採択保証と誤解される）' },
  { pattern: /(裏技|抜け道|抜け穴)/g, reason: '不適切表現（不正を想起）' },
  { pattern: /(架空|偽造|水増し|虚偽)/g, reason: '不正を示唆する表現' },
  { pattern: /(脱税|粉飾|横領)/g, reason: '不適切表現（コンプライアンス）' },
  { pattern: /(転売目的|投機目的)/g, reason: '補助金の目的外使用を想起' },
  { pattern: /(儲けるだけ|利益だけ)/g, reason: '公益性の欠如を想起' },
];

function checkNg(sections: Sections): NgResult {
  const hits: NgHit[] = [];
  const entries = Object.entries(sections) as Array<[keyof Sections, string]>;

  for (const [section, text] of entries) {
    if (!text) continue;
    
    for (const rule of NG_RULES) {
      // RegExpのlastIndexをリセット
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const idx = match.index;
        const excerpt = text.slice(Math.max(0, idx - 20), Math.min(text.length, idx + 40));
        hits.push({
          pattern: match[0],
          reason: rule.reason,
          section,
          excerpt: `...${excerpt}...`
        });
      }
    }
  }

  // score: 100から減点（ヒット数×10）
  const score = Math.max(0, 100 - hits.length * 10);
  return { score, hits };
}

/**
 * テンプレートベースのドラフト生成
 */
function generateTemplateDraft(input: {
  companyName?: string;
  businessSummary?: string;
  subsidyTitle?: string;
  prefecture?: string;
  employeeCount?: number;
  industry?: string;
  facts?: Record<string, string>;
}): Sections {
  const company = input.companyName || '（会社名未入力）';
  const biz = input.businessSummary || '（事業内容未入力：会社情報ページで入力、または書類アップロードで補完できます）';
  const subsidy = input.subsidyTitle || '（補助金名）';
  const pref = input.prefecture || '（所在地）';
  const emp = input.employeeCount ? `${input.employeeCount}名` : '（従業員数未入力）';

  const background = `【背景・課題】

${company}は、${pref}において「${biz}」を営む企業です。従業員数は${emp}です。

現在、以下のような課題を抱えています：
・（課題1：生産性/品質/人手不足/販路など、具体的な課題を記載してください）
・（課題2：業界動向や外部環境の変化による影響など）
・（課題3：現状の体制・設備では対応が困難な点など）

今回「${subsidy}」を活用することで、これらの課題を解決し、事業の安定・成長を目指します。

※このセクションを充実させるポイント：
- 課題は具体的な数値（○○が△△%減少、□□に××時間かかっている等）で示すと説得力が増します
- 業界全体の課題と自社固有の課題を分けて記載すると整理されます`;

  const purpose = `【事業目的】

本事業の目的は、${company}の業務プロセスを改善し、以下の成果を実現することです：

1. 生産性の向上
   - 目標：（具体的なKPI：処理時間○○%短縮、生産量○○%増加など）

2. 品質・サービスの向上
   - 目標：（具体的なKPI：不良率○○%削減、顧客満足度○○%向上など）

3. 収益性の改善
   - 目標：（具体的なKPI：売上○○%増、粗利率○○%改善など）

補助事業終了後も継続的に運用できる体制を構築し、中長期的な企業価値向上を図ります。

※このセクションを充実させるポイント：
- 目的は「なぜこの補助金を使うのか」が明確になるよう記載してください
- 定量的な目標を設定することで、事業の実効性をアピールできます`;

  const plan = `【実施内容・方法】

本事業は以下のステップで実施します：

■ Phase 1：現状分析・計画策定（○ヶ月目）
・対象業務の棚卸しと課題の定量化
・導入する設備/システムの選定・見積取得
・実施スケジュールの詳細化

■ Phase 2：導入・実装（○〜○ヶ月目）
・（導入物1：具体的なツール名/設備名を記載）
・（導入物2：外注する場合はその内容も）
・従業員への教育・研修

■ Phase 3：運用定着・効果測定（○〜○ヶ月目）
・マニュアル整備と運用ルールの策定
・効果測定（KPI：処理時間、ミス率、稼働率、売上など）
・改善点の洗い出しと対応

■ 導入予定の設備・システム
・（具体名を記載してください）
・（見積書の内容と整合させてください）

※このセクションを充実させるポイント：
- 「いつ・誰が・何を」が明確になるスケジュールを記載してください
- 導入物は見積書と一致させてください`;

  const team = `【実施体制】

本事業の実施体制は以下の通りです：

■ 社内体制
・事業責任者：（役職・氏名）
  - 全体統括、意思決定、対外折衝

・実務担当者：（役職・氏名）
  - 日常的な進捗管理、導入作業の実施

・経理担当：（役職・氏名）
  - 補助金関連の経理処理、証憑管理

■ 外部支援体制（該当する場合）
・認定支援機関：（機関名）
・外注先：（会社名・担当業務）

■ 意思決定・報告フロー
1. 週次：実務担当者→事業責任者への進捗報告
2. 月次：経営会議での報告・承認
3. 随時：重要事項の即時エスカレーション

※このセクションを充実させるポイント：
- 小規模企業でも役割分担を明確にすることで実現可能性をアピールできます
- 外部支援を活用する場合は、その役割も明記してください`;

  const budget_overview = `【資金計画（概要）】

■ 事業費総額：○○○万円

■ 主な費目
1. 設備費：○○○万円
   - （具体的な設備名と金額）

2. システム導入費：○○○万円
   - （具体的なシステム名と金額）

3. 外注費：○○○万円（該当する場合）
   - （外注内容と金額）

4. その他経費：○○○万円
   - （内訳）

■ 補助金申請額
・補助率：○/○
・補助上限：○○○万円
・申請額：○○○万円

■ 自己負担分の資金手当て
・自己資金：○○○万円
・金融機関融資（予定）：○○○万円

※このセクションを充実させるポイント：
- 見積書の金額と一致させてください
- 自己負担分の資金手当ての目処を示すことで実現可能性をアピールできます`;

  return { background, purpose, plan, team, budget_overview };
}

// =====================================================
// POST /api/draft/generate - ドラフト生成
// =====================================================

draft.post('/generate', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  try {
    const body = await c.req.json<{ session_id: string; mode?: 'template' | 'llm' }>();

    if (!body?.session_id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'session_id is required' }
      }, 400);
    }

    // セッション取得
    const session = await db.prepare(`
      SELECT cs.*, sc.title as subsidy_title
      FROM chat_sessions cs
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE cs.id = ? AND cs.user_id = ?
    `).bind(body.session_id, user.id).first<any>();

    if (!session) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat session not found' }
      }, 404);
    }

    // 既存のドラフトがあれば返す
    const existingDraft = await db.prepare(`
      SELECT * FROM application_drafts
      WHERE session_id = ? AND user_id = ? AND status = 'draft'
      ORDER BY version DESC
      LIMIT 1
    `).bind(session.id, user.id).first<DraftData>();

    if (existingDraft) {
      const sections = JSON.parse(existingDraft.sections_json) as Sections;
      const ng = existingDraft.ng_result_json ? JSON.parse(existingDraft.ng_result_json) as NgResult : { score: 100, hits: [] };
      
      return c.json<ApiResponse<{ draft_id: string; sections: Sections; ng: NgResult; is_new: boolean }>>({
        success: true,
        data: {
          draft_id: existingDraft.id,
          sections,
          ng,
          is_new: false
        }
      });
    }

    // 会社情報取得
    const company = await db.prepare(`
      SELECT * FROM companies WHERE id = ?
    `).bind(session.company_id).first<any>();

    // 会社プロフィール取得
    const profile = await db.prepare(`
      SELECT * FROM company_profile WHERE company_id = ?
    `).bind(session.company_id).first<any>();

    // chat_facts取得
    const factsResult = await db.prepare(`
      SELECT fact_key, fact_value FROM chat_facts
      WHERE company_id = ? AND (subsidy_id IS NULL OR subsidy_id = ?)
    `).bind(session.company_id, session.subsidy_id).all();

    const facts: Record<string, string> = {};
    for (const row of (factsResult.results || []) as any[]) {
      facts[row.fact_key] = row.fact_value;
    }

    // テンプレートでドラフト生成
    const sections = generateTemplateDraft({
      companyName: company?.name,
      businessSummary: profile?.business_summary,
      subsidyTitle: session.subsidy_title,
      prefecture: company?.prefecture,
      employeeCount: company?.employee_count,
      industry: company?.industry_major,
      facts
    });

    // NGチェック
    const ng = checkNg(sections);

    // DB保存
    const draftId = crypto.randomUUID();
    const now = nowIso();

    await db.prepare(`
      INSERT INTO application_drafts (
        id, session_id, user_id, company_id, subsidy_id,
        status, version, sections_json, ng_result_json, trace_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?)
    `).bind(
      draftId,
      session.id,
      user.id,
      session.company_id,
      session.subsidy_id,
      JSON.stringify(sections),
      JSON.stringify(ng),
      JSON.stringify({
        generated_at: now,
        mode: body.mode || 'template',
        used_profile_fields: Object.keys(profile || {}),
        used_facts: Object.keys(facts),
        company_id: session.company_id,
        subsidy_id: session.subsidy_id
      }),
      now,
      now
    ).run();

    return c.json<ApiResponse<{ draft_id: string; sections: Sections; ng: NgResult; is_new: boolean }>>({
      success: true,
      data: {
        draft_id: draftId,
        sections,
        ng,
        is_new: true
      }
    });

  } catch (error) {
    console.error('Generate draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate draft' }
    }, 500);
  }
});

// =====================================================
// GET /api/draft/:id - ドラフト取得
// =====================================================

draft.get('/:draft_id', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const row = await db.prepare(`
      SELECT ad.*, cs.subsidy_id, sc.title as subsidy_title
      FROM application_drafts ad
      LEFT JOIN chat_sessions cs ON ad.session_id = cs.id
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE ad.id = ? AND ad.user_id = ?
    `).bind(draftId, user.id).first<any>();

    if (!row) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        ...row,
        sections: JSON.parse(row.sections_json),
        ng: row.ng_result_json ? JSON.parse(row.ng_result_json) : null,
        trace: row.trace_json ? JSON.parse(row.trace_json) : null
      }
    });

  } catch (error) {
    console.error('Get draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get draft' }
    }, 500);
  }
});

// =====================================================
// GET /api/draft/by-session/:session_id - セッションからドラフト取得
// =====================================================

draft.get('/by-session/:session_id', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const sessionId = c.req.param('session_id');

  try {
    const row = await db.prepare(`
      SELECT ad.*, sc.title as subsidy_title
      FROM application_drafts ad
      LEFT JOIN chat_sessions cs ON ad.session_id = cs.id
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE ad.session_id = ? AND ad.user_id = ?
      ORDER BY ad.version DESC
      LIMIT 1
    `).bind(sessionId, user.id).first<any>();

    if (!row) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found for this session' }
      }, 404);
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        ...row,
        sections: JSON.parse(row.sections_json),
        ng: row.ng_result_json ? JSON.parse(row.ng_result_json) : null,
        trace: row.trace_json ? JSON.parse(row.trace_json) : null
      }
    });

  } catch (error) {
    console.error('Get draft by session error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get draft' }
    }, 500);
  }
});

// =====================================================
// PUT /api/draft/:id - ドラフト更新
// =====================================================

draft.put('/:draft_id', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const body = await c.req.json<{ sections: Sections }>();

    if (!body?.sections) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sections is required' }
      }, 400);
    }

    // 既存ドラフト確認
    const existing = await db.prepare(`
      SELECT * FROM application_drafts WHERE id = ? AND user_id = ?
    `).bind(draftId, user.id).first<DraftData>();

    if (!existing) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    // NGチェック
    const ng = checkNg(body.sections);

    // 更新
    await db.prepare(`
      UPDATE application_drafts
      SET sections_json = ?, ng_result_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      JSON.stringify(body.sections),
      JSON.stringify(ng),
      draftId
    ).run();

    return c.json<ApiResponse<{ draft_id: string; ng: NgResult }>>({
      success: true,
      data: { draft_id: draftId, ng }
    });

  } catch (error) {
    console.error('Update draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update draft' }
    }, 500);
  }
});

// =====================================================
// POST /api/draft/:id/check-ng - NGチェック再実行
// =====================================================

draft.post('/:draft_id/check-ng', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const row = await db.prepare(`
      SELECT sections_json FROM application_drafts WHERE id = ? AND user_id = ?
    `).bind(draftId, user.id).first<{ sections_json: string }>();

    if (!row) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    const sections = JSON.parse(row.sections_json) as Sections;
    const ng = checkNg(sections);

    // 結果保存
    await db.prepare(`
      UPDATE application_drafts SET ng_result_json = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(JSON.stringify(ng), draftId).run();

    return c.json<ApiResponse<NgResult>>({
      success: true,
      data: ng
    });

  } catch (error) {
    console.error('Check NG error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check NG' }
    }, 500);
  }
});

// =====================================================
// POST /api/draft/:id/finalize - ドラフト確定
// =====================================================

draft.post('/:draft_id/finalize', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const existing = await db.prepare(`
      SELECT * FROM application_drafts WHERE id = ? AND user_id = ?
    `).bind(draftId, user.id).first<DraftData>();

    if (!existing) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    // ステータスを final に更新
    await db.prepare(`
      UPDATE application_drafts SET status = 'final', updated_at = datetime('now') WHERE id = ?
    `).bind(draftId).run();

    return c.json<ApiResponse<{ draft_id: string; status: string }>>({
      success: true,
      data: { draft_id: draftId, status: 'final' }
    });

  } catch (error) {
    console.error('Finalize draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to finalize draft' }
    }, 500);
  }
});

export default draft;

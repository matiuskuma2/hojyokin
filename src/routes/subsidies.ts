/**
 * 補助金ルート（Adapter経由版）
 * 
 * GET /api/subsidies/search - 補助金検索（Jグランツ Adapter + スクリーニング）
 * GET /api/subsidies/:subsidy_id - 補助金詳細取得
 * GET /api/subsidies/evaluations/:company_id - 評価結果一覧
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, Company, Subsidy, ApiResponse, MatchResult, SubsidySearchParams } from '../types';
import { requireAuth, requireCompanyAccess, getCurrentUser } from '../middleware/auth';
import { createJGrantsAdapter, getJGrantsMode } from '../lib/jgrants-adapter';
import { JGrantsError } from '../lib/jgrants';
import { performBatchScreening, sortByStatus, sortByScore } from '../lib/screening';
import { 
  resolveSubsidyRef, 
  normalizeSubsidyDetail, 
  safeJsonParse,
  type NormalizedSubsidyDetail 
} from '../lib/ssot';

const subsidies = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
subsidies.use('/*', requireAuth);

// ============================================================
// キャッシュ設定（同接1000対応）
// ============================================================
const SEARCH_CACHE_TTL = 120; // 2分（検索結果キャッシュ）

/**
 * キャッシュキー生成
 * company_id + filters + sort + page をハッシュ化
 */
function generateSearchCacheKey(params: {
  companyId: string;
  keyword?: string;
  acceptance: number;
  sort: string;
  order: string;
  limit: number;
  offset: number;
}): string {
  const key = `search:${params.companyId}:${params.keyword || ''}:${params.acceptance}:${params.sort}:${params.order}:${params.limit}:${params.offset}`;
  // 簡易ハッシュ（URLセーフ）
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return `subsidy-search-${Math.abs(hash).toString(36)}`;
}

/**
 * 補助金検索（企業情報とマッチング）
 * 
 * Query Parameters:
 * - company_id: 企業ID（必須）
 * - keyword: キーワード
 * - acceptance: 受付中のみ (1) / すべて (0)
 * - sort: ソートキー (acceptance_end_datetime, subsidy_max_limit)
 * - order: ソート順 (ASC, DESC)
 * - limit: 取得件数（デフォルト: 20、最大: 100）
 * - offset: オフセット
 * - no_cache: キャッシュ無効（super_adminのみ）
 */
subsidies.get('/search', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  
  try {
    // クエリパラメータ取得
    const companyId = c.req.query('company_id');
    const keyword = c.req.query('keyword');
    const acceptance = c.req.query('acceptance') === '1' ? 1 : 0;
    const sort = c.req.query('sort') as SubsidySearchParams['sort'] || 'acceptance_end_datetime';
    const order = c.req.query('order') as 'ASC' | 'DESC' || 'ASC';
    
    // P1-1: limit/offset の境界値チェック（負数・NaN対策）
    const rawLimit = parseInt(c.req.query('limit') || '20', 10);
    const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(rawLimit, 500);
    const rawOffset = parseInt(c.req.query('offset') || '0', 10);
    const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
    
    // P0-2-1: debug パラメータ（super_adminのみ有効）
    const debug = c.req.query('debug') === '1';
    const noCache = c.req.query('no_cache') === '1';
    const user = getCurrentUser(c);
    const allowUnready = (user?.role === 'super_admin') && debug;
    
    // キャッシュチェック（同接1000対策）
    if (!noCache && companyId) {
      const cacheKey = generateSearchCacheKey({
        companyId,
        keyword: keyword || undefined,
        acceptance,
        sort,
        order,
        limit,
        offset,
      });
      
      // Cloudflare Cache API
      const cache = caches.default;
      const cacheUrl = new URL(`https://cache.internal/${cacheKey}`);
      const cachedResponse = await cache.match(cacheUrl);
      
      if (cachedResponse) {
        const cachedData = await cachedResponse.json();
        console.log(`[Search] Cache HIT: ${cacheKey}`);
        return c.json({
          ...cachedData,
          meta: {
            ...cachedData.meta,
            cached: true,
            cached_at: cachedResponse.headers.get('x-cached-at'),
          },
        });
      }
    }
    
    if (!companyId) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'company_id is required',
        },
      }, 400);
    }
    
    // 企業情報取得
    const company = await db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .bind(companyId)
      .first<Company>();
    
    if (!company) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Company not found',
        },
      }, 404);
    }
    
    // Adapter経由で補助金検索
    const adapter = createJGrantsAdapter(c.env);
    const mode = getJGrantsMode(c.env);
    
    console.log(`JGrants Adapter mode: ${mode}, allowUnready: ${allowUnready}`);
    
    const searchResponse = await adapter.search({
      keyword,
      acceptance,
      target_area_search: company.prefecture,
      limit,
      offset,
      sort,
      order,
      includeUnready: allowUnready, // P0-2-1: super_admin debug時のみ未整備も含める
    });
    
    const jgrantsResults = searchResponse.subsidies;
    const totalCount = searchResponse.total_count;
    const source = searchResponse.source;
    
    // スクリーニング実行
    const matchResults = performBatchScreening(company, jgrantsResults);
    
    // ステータスでソート（推奨 > 注意 > 非推奨）
    const sortedResults = sortByStatus(matchResults);
    
    // === usage_events に検索イベントを必ず記録 ===
    // user は上で既に取得済み（P0-2-1 debug用）
    const eventId = uuidv4();
    try {
      await db.prepare(`
        INSERT INTO usage_events (
          id, user_id, company_id, event_type, provider, 
          tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
        ) VALUES (?, ?, ?, 'SUBSIDY_SEARCH', 'jgrants', 0, 0, 0, ?, datetime('now'))
      `).bind(
        eventId,
        user.id,
        companyId,
        JSON.stringify({
          keyword: keyword || null,
          acceptance,
          results_count: sortedResults.length,
          total_count: totalCount,
          source,
          proceed_count: sortedResults.filter(r => r.evaluation.status === 'PROCEED').length,
          caution_count: sortedResults.filter(r => r.evaluation.status === 'CAUTION').length,
          no_count: sortedResults.filter(r => r.evaluation.status === 'NO').length,
        })
      ).run();
    } catch (eventError) {
      // イベント記録失敗はログに出すが、検索自体は続行
      console.error('Failed to record search event:', eventError);
    }
    
    // 評価結果をD1に保存（バッチ）
    if (sortedResults.length > 0) {
      const evaluationStatements = sortedResults.map(result => {
        const evalId = uuidv4();
        return db.prepare(`
          INSERT OR REPLACE INTO evaluation_runs 
          (id, company_id, subsidy_id, status, match_score, match_reasons, risk_flags, explanation, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          evalId,
          companyId,
          result.subsidy.id,
          result.evaluation.status,
          result.evaluation.score,
          JSON.stringify(result.evaluation.match_reasons),
          JSON.stringify(result.evaluation.risk_flags),
          result.evaluation.explanation
        );
      });
      
      await db.batch(evaluationStatements);
    }
    
    const responseData: ApiResponse<MatchResult[]> = {
      success: true,
      data: sortedResults,
      meta: {
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        limit,
        has_more: offset + limit < totalCount,
        source, // データソース（live / mock / cache）
        gate: searchResponse.gate || 'searchable-only', // P0-2-1: 品質ゲート
      },
    };
    
    // キャッシュに保存（同接1000対策）
    if (!noCache && companyId && sortedResults.length > 0) {
      try {
        const cacheKey = generateSearchCacheKey({
          companyId,
          keyword: keyword || undefined,
          acceptance,
          sort,
          order,
          limit,
          offset,
        });
        
        const cache = caches.default;
        const cacheUrl = new URL(`https://cache.internal/${cacheKey}`);
        const now = new Date().toISOString();
        
        const cacheResponse = new Response(JSON.stringify(responseData), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${SEARCH_CACHE_TTL}`,
            'x-cached-at': now,
          },
        });
        
        c.executionCtx.waitUntil(cache.put(cacheUrl, cacheResponse));
        console.log(`[Search] Cache SET: ${cacheKey}, TTL=${SEARCH_CACHE_TTL}s`);
      } catch (cacheError) {
        console.warn('[Search] Cache write failed:', cacheError);
      }
    }
    
    return c.json(responseData);
  } catch (error) {
    console.error('Search subsidies error:', error);
    
    if (error instanceof JGrantsError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'JGRANTS_ERROR',
          message: error.message,
        },
      }, error.statusCode >= 500 ? 502 : 400);
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search subsidies',
      },
    }, 500);
  }
});

/**
 * 補助金詳細取得
 * 
 * Query Parameters:
 * - company_id: 企業ID（任意、指定時は評価結果も返す）
 * 
 * レスポンス（v1.0 Freeze）:
 * - normalized: NormalizedSubsidyDetail v1.0（フロントはこれのみ参照）
 * - subsidy: legacy（互換用、将来削除）
 */
subsidies.get('/:subsidy_id', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  const companyId = c.req.query('company_id');
  
  try {
    // ========================================
    // Step 1: SSOT ID解決（Freeze-REF-0）
    // ========================================
    const ref = await resolveSubsidyRef(db, subsidyId);
    
    if (!ref) {
      // canonical解決できない → 404（Freeze）
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subsidy not found',
        },
      }, 404);
    }
    
    console.log(`[API /subsidies/${subsidyId}] resolved:`, {
      input_id: ref.input_id,
      canonical_id: ref.canonical_id,
      cache_id: ref.cache_id,
      snapshot_id: ref.snapshot_id,
      primary_source_type: ref.primary_source_type,
    });
    
    // ========================================
    // Step 2: canonical / snapshot / cache 取得
    // ========================================
    const canonicalRow = await db
      .prepare('SELECT * FROM subsidy_canonical WHERE id = ?')
      .bind(ref.canonical_id)
      .first();
    
    const snapshotRow = ref.snapshot_id 
      ? await db.prepare('SELECT * FROM subsidy_snapshot WHERE id = ?').bind(ref.snapshot_id).first()
      : null;
    
    const cacheRow = ref.cache_id
      ? await db.prepare('SELECT * FROM subsidy_cache WHERE id = ?').bind(ref.cache_id).first()
      : null;
    
    // detail_json パース
    const detailJson = safeJsonParse(cacheRow?.detail_json as string);
    
    // ========================================
    // Step 3: NormalizedSubsidyDetail 生成（Freeze-NORM-0）
    // ========================================
    let normalized: NormalizedSubsidyDetail | null = null;
    try {
      normalized = normalizeSubsidyDetail({
        ref,
        canonicalRow,
        snapshotRow,
        cacheRow,
        detailJson,
      });
      
      console.log(`[API /subsidies/${subsidyId}] normalized:`, {
        title: normalized.display.title,
        summary: normalized.overview.summary?.substring(0, 50),
        eligibility_rules_count: normalized.content.eligibility_rules.length,
        wall_chat_ready: normalized.wall_chat.ready,
      });
    } catch (normalizeError) {
      // 正規化失敗してもAPIは返す（互換維持）
      console.error(`[API /subsidies/${subsidyId}] Normalize error:`, normalizeError);
    }
    
    // ========================================
    // Step 4: 評価結果取得（company_id 指定時）
    // ========================================
    let evaluation = null;
    if (companyId) {
      // canonical_id と cache_id 両方で検索（互換性）
      const evalResult = await db
        .prepare(`
          SELECT status, match_score, match_reasons, risk_flags, explanation, created_at
          FROM evaluation_runs
          WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id = ?)
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(companyId, ref.canonical_id, ref.cache_id || ref.canonical_id)
        .first();
      
      if (evalResult) {
        evaluation = {
          status: evalResult.status,
          score: evalResult.match_score,
          match_reasons: JSON.parse(evalResult.match_reasons as string || '[]'),
          risk_flags: JSON.parse(evalResult.risk_flags as string || '[]'),
          explanation: evalResult.explanation,
          evaluated_at: evalResult.created_at,
        };
      }
    }
    
    // ========================================
    // Step 5: Legacy互換（Adapter経由）
    // ========================================
    const adapter = createJGrantsAdapter(c.env);
    let detailResponse: any = null;
    try {
      detailResponse = await adapter.getDetail(subsidyId);
    } catch {
      // Adapter失敗時は normalized のみで返す
      console.warn(`[API /subsidies/${subsidyId}] Adapter fallback failed`);
    }
    
    const subsidyDetail = detailResponse || {
      id: ref.canonical_id,
      title: normalized?.display.title || '補助金名未設定',
      subsidy_max_limit: normalized?.display.subsidy_max_limit,
      subsidy_rate: normalized?.display.subsidy_rate_text,
      target_area_search: normalized?.display.target_area_text,
      // フロントエンド用エイリアス
      subsidy_summary: normalized?.overview.summary,
      outline: normalized?.overview.summary,
      overview: normalized?.overview.summary,
      target: normalized?.overview.target_business,
      target_businesses: normalized?.overview.target_business,
      subsidy_executing_organization: normalized?.display.issuer_name,
      target_area: normalized?.display.target_area_text,
      attachments: normalized?.content.attachments || [],
    };
    
    const source = detailResponse?.source || ref.primary_source_type;
    
    // 添付ファイルはメタ情報のみ返す
    const attachments = (subsidyDetail.attachments || normalized?.content.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      file_type: a.file_type,
      file_size: a.file_size,
      status: 'not_processed',
    }));
    
    // ========================================
    // Step 6: レスポンス返却
    // ========================================
    return c.json<ApiResponse<{
      // v1.0 Freeze: フロントはこれのみ参照
      normalized: NormalizedSubsidyDetail | null;
      // Legacy互換（将来削除予定）
      subsidy: typeof subsidyDetail;
      attachments: typeof attachments;
      evaluation: typeof evaluation;
      source: string;
      detail_ready: boolean;
      wall_chat_ready: boolean;
      wall_chat_missing: string[];
      detail_json?: Record<string, any> | null;
      required_forms?: any;
      // メタ情報
      meta?: {
        resolved_canonical_id: string;
        resolved_cache_id: string | null;
        resolved_snapshot_id: string | null;
        schema_version: string;
      };
    }>>({
      success: true,
      data: {
        // v1.0 Freeze: normalized を追加
        normalized,
        // Legacy互換
        subsidy: subsidyDetail,
        attachments,
        evaluation,
        source,
        detail_ready: detailResponse?.detail_ready ?? (normalized !== null),
        wall_chat_ready: normalized?.wall_chat.ready ?? detailResponse?.wall_chat_ready ?? false,
        wall_chat_missing: normalized?.wall_chat.missing ?? detailResponse?.wall_chat_missing ?? [],
        detail_json: detailResponse?.detail_json ?? detailJson,
        required_forms: detailResponse?.required_forms ?? normalized?.content.required_forms,
        // メタ情報
        meta: {
          resolved_canonical_id: ref.canonical_id,
          resolved_cache_id: ref.cache_id,
          resolved_snapshot_id: ref.snapshot_id,
          schema_version: '1.0',
        },
      },
    });
  } catch (error) {
    console.error('Get subsidy detail error:', error);
    
    if (error instanceof JGrantsError) {
      if (error.statusCode === 404) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Subsidy not found',
          },
        }, 404);
      }
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'JGRANTS_ERROR',
          message: error.message,
        },
      }, error.statusCode >= 500 ? 502 : 400);
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get subsidy detail',
      },
    }, 500);
  }
});

/**
 * 評価結果一覧取得（特定企業の全評価）
 */
subsidies.get('/evaluations/:company_id', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('company_id');
  
  // P0-3: status パラメータのバリデーション
  const VALID_STATUSES = ['PROCEED', 'CAUTION', 'NO', 'DO_NOT_PROCEED'];
  const rawStatus = c.req.query('status');
  const status = rawStatus && VALID_STATUSES.includes(rawStatus) ? rawStatus : null;
  
  // P1-1: limit/offset の境界値チェック
  const rawLimit = parseInt(c.req.query('limit') || '50', 10);
  const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 50 : Math.min(rawLimit, 100);
  const rawOffset = parseInt(c.req.query('offset') || '0', 10);
  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  
  try {
    let query = `
      SELECT 
        er.*,
        sc.title as subsidy_title,
        sc.subsidy_max_limit,
        sc.acceptance_end_datetime
      FROM evaluation_runs er
      LEFT JOIN subsidy_cache sc ON er.subsidy_id = sc.id
      WHERE er.company_id = ?
    `;
    const params: any[] = [companyId];
    
    if (status) {
      query += ' AND er.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY er.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await db
      .prepare(query)
      .bind(...params)
      .all();
    
    // カウント取得
    let countQuery = 'SELECT COUNT(*) as count FROM evaluation_runs WHERE company_id = ?';
    const countParams: any[] = [companyId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const countResult = await db
      .prepare(countQuery)
      .bind(...countParams)
      .first<{ count: number }>();
    
    const evaluations = (result.results || []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id,
      subsidy_id: row.subsidy_id,
      subsidy_title: row.subsidy_title,
      subsidy_max_limit: row.subsidy_max_limit,
      acceptance_end_datetime: row.acceptance_end_datetime,
      status: row.status,
      score: row.match_score,
      match_reasons: JSON.parse(row.match_reasons || '[]'),
      risk_flags: JSON.parse(row.risk_flags || '[]'),
      explanation: row.explanation,
      created_at: row.created_at,
    }));
    
    return c.json<ApiResponse<typeof evaluations>>({
      success: true,
      data: evaluations,
      meta: {
        total: countResult?.count || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        has_more: offset + limit < (countResult?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get evaluations error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get evaluations',
      },
    }, 500);
  }
});

/**
 * 補助金の申請要件取得
 * - eligibility_rules テーブルから取得（従来）
 * - detail_json.eligibility_requirements から取得（手動登録補助金）
 */
subsidies.get('/:subsidy_id/eligibility', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  
  try {
    // 1. eligibility_rules テーブルから取得
    const rules = await db
      .prepare(`
        SELECT 
          id, subsidy_id, category, rule_text, check_type, 
          parameters, source_text, page_number, created_at
        FROM eligibility_rules
        WHERE subsidy_id = ?
        ORDER BY category, created_at
      `)
      .bind(subsidyId)
      .all();
    
    // 従来のルールがある場合はそのまま返す
    if (rules.results && rules.results.length > 0) {
      return c.json<ApiResponse<unknown[]>>({
        success: true,
        data: rules.results.map((rule: any) => ({
          ...rule,
          parameters: rule.parameters ? JSON.parse(rule.parameters) : null,
        })),
      });
    }
    
    // 2. detail_json から eligibility_requirements を取得（手動登録補助金用）
    // SSOT対応: canonical_id → latest_cache_id → subsidy_cache
    let cache = await db
      .prepare(`
        SELECT detail_json FROM subsidy_cache WHERE id = ?
      `)
      .bind(subsidyId)
      .first<{ detail_json: string | null }>();
    
    // canonical_id として扱い latest_cache_id 経由で検索
    if (!cache) {
      cache = await db
        .prepare(`
          SELECT sc.detail_json
          FROM subsidy_canonical c
          JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
          WHERE c.id = ?
        `)
        .bind(subsidyId)
        .first<{ detail_json: string | null }>();
    }
    
    if (cache?.detail_json) {
      try {
        const detail = JSON.parse(cache.detail_json);
        const eligibility = detail.eligibility_requirements;
        
        if (eligibility) {
          const generatedRules: any[] = [];
          
          // ======== 新構造対応（IT導入補助金2026等）========
          // basic_requirements（基本要件）
          if (eligibility.basic_requirements && Array.isArray(eligibility.basic_requirements)) {
            eligibility.basic_requirements.forEach((req: string, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-basic-${idx}`,
                subsidy_id: subsidyId,
                category: '基本要件',
                rule_text: req,
                check_type: 'MANUAL',
                source_text: '公募要領より',
              });
            });
          }
          
          // productivity_requirements（生産性向上要件）
          if (eligibility.productivity_requirements && Array.isArray(eligibility.productivity_requirements)) {
            eligibility.productivity_requirements.forEach((req: string, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-productivity-${idx}`,
                subsidy_id: subsidyId,
                category: '生産性向上要件',
                rule_text: req,
                check_type: 'AUTO',
                source_text: '公募要領より',
              });
            });
          }
          
          // wage_requirements_150over（賃金要件 150万円以上）
          if (eligibility.wage_requirements_150over && Array.isArray(eligibility.wage_requirements_150over)) {
            eligibility.wage_requirements_150over.forEach((req: string, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-wage150-${idx}`,
                subsidy_id: subsidyId,
                category: '賃金引上げ要件（150万円以上）',
                rule_text: req,
                check_type: 'AUTO',
                source_text: '公募要領より',
              });
            });
          }
          
          // wage_requirements_past_recipients（賃金要件 過去交付決定者向け）
          if (eligibility.wage_requirements_past_recipients && Array.isArray(eligibility.wage_requirements_past_recipients)) {
            eligibility.wage_requirements_past_recipients.forEach((req: string, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-wagepast-${idx}`,
                subsidy_id: subsidyId,
                category: '賃金引上げ要件（過去交付決定者）',
                rule_text: req,
                check_type: 'AUTO',
                source_text: '公募要領より',
              });
            });
          }
          
          // enterprise_definitions（事業者定義・規模要件）
          if (eligibility.enterprise_definitions && Array.isArray(eligibility.enterprise_definitions)) {
            eligibility.enterprise_definitions.forEach((def: any, idx: number) => {
              const ruleText = def.industry 
                ? `${def.industry}: 資本金${def.capital || '制限なし'}、従業員${def.employees || '制限なし'}`
                : `資本金${def.capital || '制限なし'}、従業員${def.employees || '制限なし'}`;
              generatedRules.push({
                id: `${subsidyId}-enterprise-${idx}`,
                subsidy_id: subsidyId,
                category: '対象事業者（規模定義）',
                rule_text: ruleText,
                check_type: 'AUTO',
                source_text: '公募要領より',
              });
            });
          }
          
          // ======== 旧構造対応（ものづくり補助金等）========
          // basic requirements（旧構造）
          if (eligibility.basic && Array.isArray(eligibility.basic)) {
            eligibility.basic.forEach((req: string, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-basic-${idx}`,
                subsidy_id: subsidyId,
                category: '基本要件',
                rule_text: req,
                check_type: 'MANUAL',
                source_text: '公募要領より',
              });
            });
          }
          
          // mandatory_commitments (必須コミットメント)
          if (eligibility.mandatory_commitments && Array.isArray(eligibility.mandatory_commitments)) {
            eligibility.mandatory_commitments.forEach((commit: any, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-mandatory-${idx}`,
                subsidy_id: subsidyId,
                category: '必須要件',
                rule_text: `${commit.item}: ${commit.requirement}${commit.verification ? ` (確認方法: ${commit.verification})` : ''}`,
                check_type: 'AUTO',
                source_text: '公募要領より',
              });
            });
          }
          
          // creation_requirements (創業型用)
          if (eligibility.creation_requirements && Array.isArray(eligibility.creation_requirements)) {
            eligibility.creation_requirements.forEach((req: any, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-creation-${idx}`,
                subsidy_id: subsidyId,
                category: '創業要件',
                rule_text: `${req.item}: ${req.requirement}${req.note ? ` (${req.note})` : ''}`,
                check_type: 'MANUAL',
                source_text: '公募要領より',
              });
            });
          }
          
          // scale_requirements (規模要件 - 旧構造)
          if (eligibility.scale_requirements && Array.isArray(eligibility.scale_requirements)) {
            eligibility.scale_requirements.forEach((scale: any, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-scale-${idx}`,
                subsidy_id: subsidyId,
                category: '規模要件',
                rule_text: `${scale.industry}: 従業員${scale.max_employees}人以下`,
                check_type: 'AUTO',
                source_text: '公募要領より',
              });
            });
          }
          
          // exclusions (除外条件)
          if (eligibility.exclusions && Array.isArray(eligibility.exclusions)) {
            eligibility.exclusions.forEach((excl: string, idx: number) => {
              generatedRules.push({
                id: `${subsidyId}-excl-${idx}`,
                subsidy_id: subsidyId,
                category: '対象外',
                rule_text: excl,
                check_type: 'MANUAL',
                source_text: '公募要領より',
              });
            });
          }
          
          if (generatedRules.length > 0) {
            return c.json<ApiResponse<unknown[]>>({
              success: true,
              data: generatedRules,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to parse detail_json for eligibility:', e);
      }
    }
    
    // データがない場合は空配列
    return c.json<ApiResponse<unknown[]>>({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('Get eligibility rules error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get eligibility rules',
      },
    }, 500);
  }
});

/**
 * 補助金の必要書類取得
 * - required_documents_by_subsidy テーブルから取得（従来）
 * - detail_json.required_documents から取得（手動登録補助金）
 */
subsidies.get('/:subsidy_id/documents', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  
  try {
    // 1. required_documents_by_subsidy テーブルから取得
    const docs = await db
      .prepare(`
        SELECT 
          rds.id, rds.subsidy_id, rds.doc_code, rds.required_level,
          rds.notes, rds.confidence, rds.needs_review,
          rdm.name, rdm.phase, rdm.description, rdm.sort_order
        FROM required_documents_by_subsidy rds
        LEFT JOIN required_documents_master rdm ON rds.doc_code = rdm.doc_code
        WHERE rds.subsidy_id = ?
        ORDER BY rdm.sort_order, rds.doc_code
      `)
      .bind(subsidyId)
      .all();
    
    // 従来の書類データがある場合はそのまま返す
    if (docs.results && docs.results.length > 0) {
      return c.json<ApiResponse<unknown[]>>({
        success: true,
        data: docs.results,
      });
    }
    
    // 2. detail_json から required_documents を取得（手動登録補助金用）
    // SSOT対応: canonical_id → latest_cache_id → subsidy_cache
    let cache = await db
      .prepare(`
        SELECT detail_json FROM subsidy_cache WHERE id = ?
      `)
      .bind(subsidyId)
      .first<{ detail_json: string | null }>();
    
    // canonical_id として扱い latest_cache_id 経由で検索
    if (!cache) {
      cache = await db
        .prepare(`
          SELECT sc.detail_json
          FROM subsidy_canonical c
          JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
          WHERE c.id = ?
        `)
        .bind(subsidyId)
        .first<{ detail_json: string | null }>();
    }
    
    if (cache?.detail_json) {
      try {
        const detail = JSON.parse(cache.detail_json);
        const reqDocs = detail.required_documents;
        
        if (reqDocs) {
          const generatedDocs: any[] = [];
          let sortOrder = 0;
          
          // common documents
          if (reqDocs.common && Array.isArray(reqDocs.common)) {
            reqDocs.common.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-common-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: 'required',
                description: doc.description || doc.period || '',
                notes: doc.requirement || doc.deadline || '',
                phase: '共通',
                sort_order: sortOrder++,
              });
            });
          }
          
          // main_forms (主要様式)
          if (reqDocs.main_forms && Array.isArray(reqDocs.main_forms)) {
            reqDocs.main_forms.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-form-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: 'required',
                description: doc.description || '',
                notes: doc.deadline || '',
                phase: '申請様式',
                sort_order: sortOrder++,
              });
            });
          }
          
          // corporation documents
          if (reqDocs.corporation && Array.isArray(reqDocs.corporation)) {
            reqDocs.corporation.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-corp-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: 'conditional',
                description: doc.period || doc.requirement || '',
                notes: '法人のみ',
                phase: '法人向け',
                sort_order: sortOrder++,
              });
            });
          }
          
          // individual documents
          if (reqDocs.individual && Array.isArray(reqDocs.individual)) {
            reqDocs.individual.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-ind-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: 'conditional',
                description: doc.period || '',
                notes: '個人事業主のみ',
                phase: '個人向け',
                sort_order: sortOrder++,
              });
            });
          }
          
          // optional documents
          if (reqDocs.optional && Array.isArray(reqDocs.optional)) {
            reqDocs.optional.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-opt-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: 'optional',
                description: doc.condition || '',
                notes: '該当者のみ',
                phase: '任意',
                sort_order: sortOrder++,
              });
            });
          }
          
          // special_optional (特例用書類)
          if (reqDocs.special_optional && Array.isArray(reqDocs.special_optional)) {
            reqDocs.special_optional.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-special-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: 'conditional',
                description: doc.condition || '',
                notes: '特例適用時',
                phase: '特例',
                sort_order: sortOrder++,
              });
            });
          }
          
          // additional (追加書類)
          if (reqDocs.additional && Array.isArray(reqDocs.additional)) {
            reqDocs.additional.forEach((doc: any, idx: number) => {
              generatedDocs.push({
                id: `${subsidyId}-add-${idx}`,
                subsidy_id: subsidyId,
                doc_code: doc.name,
                name: doc.name,
                required_level: doc.requirement === '必須' ? 'required' : 'conditional',
                description: doc.requirement || '',
                notes: '',
                phase: '追加',
                sort_order: sortOrder++,
              });
            });
          }
          
          if (generatedDocs.length > 0) {
            return c.json<ApiResponse<unknown[]>>({
              success: true,
              data: generatedDocs,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to parse detail_json for documents:', e);
      }
    }
    
    // データがない場合は空配列
    return c.json<ApiResponse<unknown[]>>({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('Get required documents error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get required documents',
      },
    }, 500);
  }
});

/**
 * 補助金の対象経費取得
 * - detail_json.eligible_expenses から取得（手動登録補助金用）
 */
subsidies.get('/:subsidy_id/expenses', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  
  try {
    // detail_json から eligible_expenses を取得
    // SSOT対応: canonical_id → latest_cache_id → subsidy_cache
    let cache = await db
      .prepare(`
        SELECT detail_json FROM subsidy_cache WHERE id = ?
      `)
      .bind(subsidyId)
      .first<{ detail_json: string | null }>();
    
    // canonical_id として扱い latest_cache_id 経由で検索
    if (!cache) {
      cache = await db
        .prepare(`
          SELECT sc.detail_json
          FROM subsidy_canonical c
          JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
          WHERE c.id = ?
        `)
        .bind(subsidyId)
        .first<{ detail_json: string | null }>();
    }
    
    if (cache?.detail_json) {
      try {
        const detail = JSON.parse(cache.detail_json);
        const expenses = detail.eligible_expenses;
        
        if (expenses) {
          return c.json<ApiResponse<{
            required: any;
            categories: any[];
            not_eligible: string[];
          }>>({
            success: true,
            data: {
              required: expenses.required || null,
              categories: expenses.categories || expenses.optional || [],
              not_eligible: expenses.not_eligible || [],
            },
          });
        }
      } catch (e) {
        console.warn('Failed to parse detail_json for expenses:', e);
      }
    }
    
    // データがない場合
    return c.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error('Get eligible expenses error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get eligible expenses',
      },
    }, 500);
  }
});

/**
 * 補助金の加点項目取得
 * - detail_json.bonus_points / evaluation_criteria.bonus_review から取得
 */
subsidies.get('/:subsidy_id/bonus-points', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  
  try {
    // SSOT対応: canonical_id → latest_cache_id → subsidy_cache
    let cache = await db
      .prepare(`
        SELECT detail_json FROM subsidy_cache WHERE id = ?
      `)
      .bind(subsidyId)
      .first<{ detail_json: string | null }>();
    
    // canonical_id として扱い latest_cache_id 経由で検索
    if (!cache) {
      cache = await db
        .prepare(`
          SELECT sc.detail_json
          FROM subsidy_canonical c
          JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
          WHERE c.id = ?
        `)
        .bind(subsidyId)
        .first<{ detail_json: string | null }>();
    }
    
    if (cache?.detail_json) {
      try {
        const detail = JSON.parse(cache.detail_json);
        
        // bonus_points（省力化投資補助金形式）
        if (detail.bonus_points && Array.isArray(detail.bonus_points)) {
          return c.json<ApiResponse<any[]>>({
            success: true,
            data: detail.bonus_points,
          });
        }
        
        // evaluation_criteria.bonus_review（持続化補助金形式）
        if (detail.evaluation_criteria?.bonus_review) {
          const bonusReview = detail.evaluation_criteria.bonus_review;
          const bonusPoints: any[] = [];
          
          // 重点政策加点
          if (bonusReview['重点政策加点']?.options) {
            bonusReview['重点政策加点'].options.forEach((opt: any) => {
              bonusPoints.push({
                category: '重点政策加点',
                name: typeof opt === 'string' ? opt : opt.name,
                description: typeof opt === 'object' ? opt.description : '',
              });
            });
          }
          
          // 政策加点
          if (bonusReview['政策加点']?.options) {
            bonusReview['政策加点'].options.forEach((opt: any) => {
              bonusPoints.push({
                category: '政策加点',
                name: typeof opt === 'string' ? opt : opt.name,
                description: typeof opt === 'object' ? opt.description : '',
              });
            });
          }
          
          if (bonusPoints.length > 0) {
            return c.json<ApiResponse<any[]>>({
              success: true,
              data: bonusPoints,
              meta: { note: bonusReview.note || '' },
            });
          }
        }
      } catch (e) {
        console.warn('Failed to parse detail_json for bonus points:', e);
      }
    }
    
    return c.json<ApiResponse<any[]>>({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('Get bonus points error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get bonus points',
      },
    }, 500);
  }
});

export default subsidies;

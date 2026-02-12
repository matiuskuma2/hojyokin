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
import { createJGrantsAdapter, getJGrantsMode, getSearchBackend } from '../lib/jgrants-adapter';
import { JGrantsError } from '../lib/jgrants';
// v1 screening は廃止。v2 のみ使用 (2026-02-07)
import { performBatchScreeningV2, sortByStatusV2, sortByScoreV2, type ScreeningResultV2 } from '../lib/screening-v2';
import { getCompanySSOT, type CompanySSOT } from '../lib/ssot/getCompanySSOT';
import { 
  resolveSubsidyRef, 
  normalizeSubsidyDetail, 
  safeJsonParse,
  getNormalizedSubsidyDetail,
  type NormalizedSubsidyDetail,
  type EligibilityRule,
  type RequiredDocument,
  type EligibleExpenses,
  type BonusPoint,
} from '../lib/ssot';

const subsidies = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
subsidies.use('/*', requireAuth);

// ============================================================
// キャッシュ設定（同接1000対応）
// ============================================================
// TODO: 要確認 - キャッシュTTLの妥当性。データ更新頻度に応じて調整が必要
//   JGrants APIの更新頻度は日次（深夜バッチ）。TTL 120秒は検索体験優先の設定。
//   受け入れ基準: JGrants更新サイクルをヒアリングし、TTLを120〜300秒の範囲で確定
//   リスク: 締切直前データが古い可能性。acceptance_end_datetime が今日〜3日後の場合は短TTL推奨
// TODO: 要確認 - キャッシュ無効化戦略（補助金データ更新時のキャッシュバスト）
//   受け入れ基準: admin-opsのSSOT更新処理にcache.delete呼び出しを追加、テストケース実装
//   方式案: (1) TTL自然失効, (2) SSOT更新時にpurge API呼び出し, (3) バージョンタグ付きキー
const SEARCH_CACHE_TTL = 120; // 2分（検索結果キャッシュ）

/**
 * キャッシュキー生成（P2-4: SHA-256 風ハッシュ化）
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
  prefecture?: string;
}): string {
  const key = `search:${params.companyId}:${params.keyword || ''}:${params.acceptance}:${params.sort}:${params.order}:${params.limit}:${params.offset}:${params.prefecture || ''}`;
  // 改善されたハッシュ（FNV-1a風、衝突率低減）
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `subsidy-search-${(hash >>> 0).toString(36)}`;
}

/**
 * キーワードをトークンに分割（部分一致検索用）
 * - 全角/半角スペースで分割
 * - 空トークンを除外
 * - 各トークンは LIKE %token% で検索
 */
function tokenizeKeyword(keyword: string): string[] {
  if (!keyword || !keyword.trim()) return [];
  // 全角スペース → 半角スペースに正規化してから分割
  return keyword
    .replace(/\u3000/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .slice(0, 5); // 最大5トークン（DoS対策）
}

/**
 * 補助金検索（企業情報とマッチング）
 * 
 * Query Parameters:
 * - company_id: 企業ID（必須）
 * - keyword: キーワード（スペース区切りで複数条件 AND 検索）
 * - acceptance: 受付中のみ (1) / すべて (0)
 * - sort: ソートキー (acceptance_end_datetime, subsidy_max_limit)
 * - order: ソート順 (ASC, DESC)
 * - limit: 取得件数（デフォルト: 20、最大: 500）
 * - offset: オフセット
 * - prefecture: 都道府県フィルター（指定時は地域絞り込み）
 * - no_cache: キャッシュ無効（super_adminのみ）
 */
subsidies.get('/search', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  
  // デバッグ用: 処理開始ログ
  console.log('[Search] START - request received');
  
  try {
    // クエリパラメータ取得
    const companyId = c.req.query('company_id');
    const keyword = c.req.query('keyword');
    const acceptance = c.req.query('acceptance') === '1' ? 1 : 0;
    const sortRaw = c.req.query('sort');
    // sort=score は有効な値として扱う
    const sort = (sortRaw === 'score' || sortRaw === 'acceptance_end_datetime' || sortRaw === 'subsidy_max_limit' || sortRaw === 'created_at') 
      ? sortRaw as SubsidySearchParams['sort']
      : 'acceptance_end_datetime';
    const order = c.req.query('order') as 'ASC' | 'DESC' || 'ASC';
    // 都道府県フィルター（新規パラメータ）
    const prefecture = c.req.query('prefecture')?.trim() || undefined;
    
    console.log(`[Search] Params: companyId=${companyId}, sort=${sort}, sortRaw=${sortRaw}, acceptance=${acceptance}, prefecture=${prefecture || 'none'}`);
    
    // P1-1: limit/offset の境界値チェック（負数・NaN対策）
    const rawLimit = parseInt(c.req.query('limit') || '20', 10);
    const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(rawLimit, 500);
    const rawOffset = parseInt(c.req.query('offset') || '0', 10);
    const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
    
    // P0-2-1: debug パラメータ（super_adminのみ有効）
    // TODO: 要確認 - debugパラメータのCSRFトークンバリデーション
    //   受け入れ基準: super_admin以外がdebug=1を使った場合に400を返す（現在は暗黙に無視）
    //   テストケース: 一般ユーザーがdebug=1→結果に影響なし、super_adminがdebug=1→allowUnready=true
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
        prefecture,
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
    
    // ============================================================
    // P2-2: Adapter検索 + CompanySSOT取得を並列実行
    // ============================================================
    const adapter = createJGrantsAdapter(c.env);
    const mode = getJGrantsMode(c.env);
    
    console.log(`[Search] JGrants Adapter mode: ${mode}, allowUnready: ${allowUnready}`);
    
    // STEP 1+3 並列: adapter.search と getCompanySSOT を同時実行
    console.log('[Search] STEP1+3 - calling adapter.search AND getCompanySSOT in parallel');
    const searchStartTime = Date.now();
    
    const [searchResponse, companySSOT] = await Promise.all([
      adapter.search({
        keyword,
        acceptance,
        // 都道府県: パラメータ指定優先、なければ企業の都道府県
        target_area_search: prefecture || company.prefecture,
        limit,
        offset,
        sort,
        order,
        includeUnready: allowUnready,
      }),
      getCompanySSOT(db, companyId),
    ]);
    
    const parallelTime = Date.now() - searchStartTime;
    console.log(`[Search] STEP1+3 completed in ${parallelTime}ms`);
    
    const jgrantsResults = searchResponse.subsidies;
    const totalCount = searchResponse.total_count;
    const source = searchResponse.source;
    
    console.log(`[Search] STEP2 - adapter.search results: ${jgrantsResults.length}, total=${totalCount}, source=${source}`);
    
    // ============================================================
    // Freeze-MATCH: v2 スクリーニング（SSOT統一版）
    // ============================================================
    
    if (!companySSOT) {
      console.error(`[Search] CompanySSOT not found for company: ${companyId}`);
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve company SSOT data',
        },
      }, 500);
    }
    
    // ============================================================
    // 検索バックエンドに応じた処理分岐
    // - cache/ssot(fallback to cache): 正規化をスキップし、cache行から直接スクリーニング
    //   → cache backend の subsidy_cache.id は subsidy_canonical と紐づかないケースが多く、
    //     getNormalizedSubsidyDetail が全件失敗する問題を回避
    // - ssot: 正規化 → v2スクリーニング（従来通り）
    // ============================================================
    const searchBackend = getSearchBackend(c.env);
    const isCacheBackend = searchResponse.source === 'cache' || searchResponse.backend === 'cache';
    
    let sortedResults: any[];
    let screeningVersion: string;
    let fetchedCount: number;
    let normalizedCount: number;
    let normalizationFailedCount: number;
    let nsdTime: number = 0;
    
    if (isCacheBackend) {
      // ============================================================
      // Cache Backend 高速パス: 正規化をスキップ
      // cache行から直接 NormalizedSubsidyDetail を構築してスクリーニング
      // ============================================================
      console.log('[Search] STEP4-FAST - cache backend: building NSD from search results directly');
      const nsdStartTime = Date.now();
      
      fetchedCount = jgrantsResults.length;
      
      // cache行からminimal NormalizedSubsidyDetail を構築
      const minimalNSDs: NormalizedSubsidyDetail[] = jgrantsResults.map(result => {
        const r = result as any;
        return {
          schema_version: '1.0' as const,
          ids: {
            input_id: result.id,
            canonical_id: r.canonical_id || result.id,
            cache_id: result.id,
            snapshot_id: null,
          },
          source: {
            primary_source_type: r.source_type || 'jgrants' as any,
            primary_source_id: result.id,
            links: [],
          },
          acceptance: {
            is_accepting: r.request_reception_display_flag === 1,
            acceptance_start: r.acceptance_start_datetime || null,
            acceptance_end: r.acceptance_end_datetime || null,
            acceptance_end_reason: null,
          },
          display: {
            title: result.title || '補助金名未設定',
            issuer_name: r.subsidy_executing_organization || null,
            target_area_text: r.target_area_search || null,
            subsidy_max_limit: result.subsidy_max_limit || null,
            subsidy_rate_text: result.subsidy_rate || null,
          },
          overview: {
            summary: null,
            purpose: null,
            target_business: r.target_industry || null,
          },
          electronic_application: {
            is_electronic_application: r.is_electronic_application || null,
            portal_name: null,
            portal_url: null,
            notes: null,
          },
          wall_chat: {
            mode: (r.wall_chat_ready ? 'enabled' : 'unknown') as any,
            ready: r.wall_chat_ready === true || r.wall_chat_ready === 1,
            missing: (() => {
              try {
                return typeof r.wall_chat_missing === 'string' ? JSON.parse(r.wall_chat_missing) : (r.wall_chat_missing || []);
              } catch { return []; }
            })(),
            questions: [],
          },
          content: {
            eligibility_rules: [],
            eligible_expenses: { required: [], categories: [], excluded: [], notes: null },
            required_documents: [],
            bonus_points: [],
            required_forms: [],
            attachments: [],
          },
          provenance: {
            koubo_source_urls: [],
            pdf_urls: [],
            pdf_hashes: [],
            last_normalized_at: new Date().toISOString(),
          },
        };
      });
      
      normalizedCount = minimalNSDs.length;
      normalizationFailedCount = 0;
      nsdTime = Date.now() - nsdStartTime;
      console.log(`[Search] STEP4-FAST complete - built ${normalizedCount} NSD from cache in ${nsdTime}ms`);
      
      // v2 スクリーニング実行
      console.log('[Search] STEP5 - performing v2 screening (cache path)');
      const screeningResultsV2 = performBatchScreeningV2(companySSOT, minimalNSDs);
      console.log(`[Search] STEP5 complete - screening returned ${screeningResultsV2.length} results`);
      
      // ソート処理
      console.log(`[Search] STEP6 - sorting by: ${sort}`);
      const sortedResultsV2 = sort === 'score' 
        ? sortByScoreV2(screeningResultsV2, order)
        : sortByStatusV2(screeningResultsV2);
      console.log(`[Search] STEP6 complete - sorted ${sortedResultsV2.length} results`);
      
      // フロントエンド互換形式に変換
      sortedResults = sortedResultsV2.map(v2Result => ({
        subsidy: {
          id: v2Result.subsidy_canonical_id,
          source: 'jgrants' as const,
          title: v2Result.subsidy_title,
          subsidy_max_limit: v2Result.subsidy_summary.subsidy_max_limit,
          subsidy_rate: v2Result.subsidy_summary.subsidy_rate_text,
          target_area_search: v2Result.subsidy_summary.target_area_text,
          acceptance_end_datetime: v2Result.subsidy_summary.acceptance_end,
          wall_chat_ready: v2Result.subsidy_summary.wall_chat_ready,
          canonical_id: v2Result.subsidy_canonical_id,
          source_id: v2Result.subsidy_canonical_id,
        },
        evaluation: v2Result.evaluation,
        missing_fields: v2Result.missing_fields,
      }));
      
      screeningVersion = 'v2-cache';
      
    } else {
      // ============================================================
      // SSOT Backend: 従来の正規化 → v2スクリーニング
      // ============================================================
      
      // 2. P2-3: 検索結果を NormalizedSubsidyDetail に並列変換（Promise.allSettled）
      console.log('[Search] STEP4 - normalizing subsidies (parallel)');
      const nsdStartTime = Date.now();
      const normalizedPromises = jgrantsResults.map(result =>
        getNormalizedSubsidyDetail(db, result.id, { debug: false })
          .then(r => ({ result: r, sourceId: result.id }))
          .catch(err => {
            console.warn(`[Search] Failed to normalize subsidy ${result.id}:`, err);
            return { result: null, sourceId: result.id };
          })
      );
      const normalizedResults = await Promise.all(normalizedPromises);
      
      const normalizedSubsidies: NormalizedSubsidyDetail[] = [];
      const subsidyIdMapping = new Map<string, { source_id: string; cache_id: string | null; canonical_id: string }>();
      
      for (const { result: normalizedResult, sourceId } of normalizedResults) {
        if (normalizedResult && normalizedResult.normalized) {
          normalizedSubsidies.push(normalizedResult.normalized);
          subsidyIdMapping.set(normalizedResult.normalized.ids.canonical_id, {
            source_id: sourceId,
            cache_id: normalizedResult.ref.cache_id,
            canonical_id: normalizedResult.ref.canonical_id,
          });
        }
      }
      nsdTime = Date.now() - nsdStartTime;
      fetchedCount = jgrantsResults.length;
      normalizedCount = normalizedSubsidies.length;
      normalizationFailedCount = fetchedCount - normalizedCount;
      console.log(`[Search] STEP4 complete - normalized ${normalizedCount}/${fetchedCount} subsidies in ${nsdTime}ms (${normalizationFailedCount} failed)`);
      
      // 3. v2 スクリーニング実行（SSOT 入力のみ）
      console.log('[Search] STEP5 - performing v2 screening');
      const screeningResultsV2 = performBatchScreeningV2(companySSOT, normalizedSubsidies);
      console.log(`[Search] STEP5 complete - screening returned ${screeningResultsV2.length} results`);
      
      // 4. ソート処理（sort パラメータに応じて切り替え）
      console.log(`[Search] STEP6 - sorting by: ${sort}`);
      const sortedResultsV2 = sort === 'score' 
        ? sortByScoreV2(screeningResultsV2, order)
        : sortByStatusV2(screeningResultsV2);
      console.log(`[Search] STEP6 complete - sorted ${sortedResultsV2.length} results`);
      
      // 5. 旧形式 MatchResult への変換（フロントエンド互換）
      console.log('[Search] STEP7 - converting to frontend format');
      sortedResults = sortedResultsV2.map(v2Result => {
        const mapping = subsidyIdMapping.get(v2Result.subsidy_canonical_id);
        return {
          subsidy: {
            id: v2Result.subsidy_canonical_id,
            source: 'jgrants' as const,
            title: v2Result.subsidy_title,
            subsidy_max_limit: v2Result.subsidy_summary.subsidy_max_limit,
            subsidy_rate: v2Result.subsidy_summary.subsidy_rate_text,
            target_area_search: v2Result.subsidy_summary.target_area_text,
            acceptance_end_datetime: v2Result.subsidy_summary.acceptance_end,
            wall_chat_ready: v2Result.subsidy_summary.wall_chat_ready,
            // v2 拡張フィールド
            canonical_id: v2Result.subsidy_canonical_id,
            source_id: mapping?.source_id || v2Result.subsidy_canonical_id,
          },
          evaluation: v2Result.evaluation,
          // v2 拡張: missing_fields
          missing_fields: v2Result.missing_fields,
        };
      });
      
      screeningVersion = 'v2';
    }
    
    // === usage_events に検索イベントを必ず記録 ===
    // user は上で既に取得済み（P0-2-1 debug用）
    const totalSearchTime = Date.now() - searchStartTime;
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
          prefecture: prefecture || null,
          results_count: sortedResults.length,
          total_count: totalCount,
          source,
          proceed_count: sortedResults.filter(r => r.evaluation.status === 'PROCEED').length,
          caution_count: sortedResults.filter(r => r.evaluation.status === 'CAUTION').length,
          no_count: sortedResults.filter(r => r.evaluation.status === 'DO_NOT_PROCEED').length,
          // KPI: パフォーマンス計測 (P50/P95/P99 算出用)
          perf_ms: {
            total: totalSearchTime,
            search_and_ssot: parallelTime,
            nsd_normalize: nsdTime,
          },
        })
      ).run();
    } catch (eventError) {
      // イベント記録失敗はログに出すが、検索自体は続行
      console.error('Failed to record search event:', eventError);
    }
    
    // ============================================================
    // 評価結果をD1に保存（バッチ）
    // Gate-A: screening_version を保存
    // Gate-B: canonical_id + source_id + cache_id を分離保存
    // ============================================================
    if (sortedResults.length > 0) {
      const evaluationStatements = sortedResults.map((result: any) => {
        const evalId = uuidv4();
        
        const canonicalId = result.subsidy?.canonical_id || result.subsidy?.id;
        const sourceId = result.subsidy?.source_id || null;
        const cacheId = isCacheBackend ? result.subsidy?.id : null;
        
        return db.prepare(`
          INSERT OR REPLACE INTO evaluation_runs 
          (id, company_id, subsidy_id, subsidy_source_id, subsidy_cache_id, 
           status, match_score, match_reasons, risk_flags, explanation, 
           screening_version, missing_fields_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          evalId,
          companyId,
          canonicalId,
          sourceId,
          cacheId,
          result.evaluation.status,
          result.evaluation.score,
          JSON.stringify(result.evaluation.match_reasons),
          JSON.stringify(result.evaluation.risk_flags),
          result.evaluation.explanation,
          screeningVersion,
          JSON.stringify(result.missing_fields || [])
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
        offset,
        has_more: offset + limit < totalCount,
        // 件数内訳（フロントエンドの正確な表示に必要）
        fetched_count: fetchedCount,         // API/DBから取得した件数
        normalized_count: normalizedCount,    // 正規化成功件数
        screened_count: sortedResults.length, // スクリーニング後の件数（= data.length）
        normalization_failed: normalizationFailedCount, // 正規化失敗件数
        source, // データソース（live / mock / cache）
        gate: searchResponse.gate || 'searchable-only', // P0-2-1: 品質ゲート
        // KPI計測用: 応答時間をフロントに返す（ユーザー体感把握用）
        perf_total_ms: totalSearchTime,
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
          prefecture,
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
    
    console.log('[Search] SUCCESS - returning response');
    return c.json(responseData);
  } catch (error) {
    // 詳細なエラーログを出力
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Search] ERROR:', {
      message: errorMessage,
      stack: errorStack,
      companyId: c.req.query('company_id'),
      keyword: c.req.query('keyword'),
      sort: c.req.query('sort'),
    });
    
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
    
    // detail_json パース（snapshotRow優先、cacheRowで補完）
    // Freeze-GET-1: snapshotRow.detail_json に wall_chat_questions/required_forms 等が格納されている
    // SSOT補助金はsnapshotにdetail_jsonがあり、cacheRowがない場合がある
    const snapshotDetailJson = safeJsonParse(snapshotRow?.detail_json as string);
    const cacheDetailJson = safeJsonParse(cacheRow?.detail_json as string);
    // merge: snapshotDetailJson を優先し、cacheDetailJson を補完（getNormalizedSubsidyDetail.ts と同じロジック）
    const detailJson = {
      ...cacheDetailJson,
      ...snapshotDetailJson,
    };
    
    console.log(`[API /subsidies/${subsidyId}] detail_json sources:`, {
      has_cacheRow: !!cacheRow,
      has_snapshotRow: !!snapshotRow,
      cacheDetailJson_keys: cacheDetailJson ? Object.keys(cacheDetailJson).slice(0, 5) : null,
      snapshotDetailJson_keys: snapshotDetailJson ? Object.keys(snapshotDetailJson).slice(0, 5) : null,
      detailJson_keys: detailJson ? Object.keys(detailJson).slice(0, 5) : null,
      has_required_forms: !!detailJson?.required_forms,
      has_wall_chat_questions: !!detailJson?.wall_chat_questions,
    });
    
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
        required_forms_count: normalized.content.required_forms.length,
        wall_chat_ready: normalized.wall_chat.ready,
        wall_chat_questions_count: normalized.wall_chat.questions.length,
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
    // attachmentsがオブジェクト形式（カテゴリ別）の場合はフラット化
    let rawAttachments = subsidyDetail.attachments || normalized?.content.attachments || [];
    if (rawAttachments && typeof rawAttachments === 'object' && !Array.isArray(rawAttachments)) {
      // オブジェクト形式: { koubo_documents: [...], application_forms: [...], ... }
      rawAttachments = Object.values(rawAttachments).flat();
    }
    const attachments = (Array.isArray(rawAttachments) ? rawAttachments : []).map((a: any) => ({
      id: a.id || a.filename,
      name: a.name,
      url: a.url,
      file_type: a.file_type || a.filename?.split('.').pop(),
      file_size: a.file_size,
      category: a.category,
      updated_at: a.updated_at,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Get subsidy detail error:', errorMessage, errorStack);
    
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
    
    // SEC-1: 本番環境ではdebug情報を返さない（情報漏洩防止）
    const isProduction = (c.env as any).ENVIRONMENT === 'production' || (c.env as any).JGRANTS_MODE === 'cached-only';
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get subsidy detail',
        ...(isProduction ? {} : {
          debug_message: errorMessage,
          debug_stack: errorStack?.split('\n').slice(0, 5).join(' | '),
        }),
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
  // Note: 'NO' はレガシー互換。新規データは 'DO_NOT_PROCEED' のみ使用
  const VALID_STATUSES = ['PROCEED', 'CAUTION', 'DO_NOT_PROCEED', 'NO'];
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
 * 
 * A-3-1: normalized.content.eligibility_rules を SSOT として返却
 * 
 * Fallback: eligibility_rules テーブルにデータがある場合は従来通り返す（互換性維持）
 * 
 * NOTE (2026-02-07): eligibility_rules テーブルは現在0件。
 * SSOT は NormalizedSubsidyDetail.content.eligibility_rules (detail_json から正規化)。
 * テーブルは将来の手動ルール追加・外部連携用にFallbackとして保持。
 */
subsidies.get('/:subsidy_id/eligibility', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  const debug = c.req.query('debug') === '1';
  
  try {
    // ========================================
    // Step 1: eligibility_rules テーブルから取得（Fallback）
    // ========================================
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
    
    // 従来のルールがある場合はそのまま返す（互換性維持）
    if (rules.results && rules.results.length > 0) {
      if (debug) {
        console.log(`[A-3-1] /eligibility: Fallback to eligibility_rules table for ${subsidyId}`);
      }
      return c.json<ApiResponse<unknown[]>>({
        success: true,
        data: rules.results.map((rule: any) => ({
          ...rule,
          parameters: rule.parameters ? JSON.parse(rule.parameters) : null,
        })),
        meta: { source: 'eligibility_rules_table' },
      });
    }
    
    // ========================================
    // Step 2: SSOT（getNormalizedSubsidyDetail）から取得
    // ========================================
    const result = await getNormalizedSubsidyDetail(db, subsidyId, { debug });
    
    if (!result) {
      // 補助金が見つからない場合は空配列（404ではない - 互換性維持）
      return c.json<ApiResponse<EligibilityRule[]>>({
        success: true,
        data: [],
        meta: { source: 'not_found' },
      });
    }
    
    const { normalized } = result;
    const eligibilityRules = normalized.content.eligibility_rules;
    
    if (debug) {
      console.log(`[A-3-1] /eligibility: SSOT returned ${eligibilityRules.length} rules for ${subsidyId}`);
    }
    
    // normalized.content.eligibility_rules をそのまま返却
    return c.json<ApiResponse<EligibilityRule[]>>({
      success: true,
      data: eligibilityRules,
      meta: { 
        source: 'normalized',
        canonical_id: result.ref.canonical_id,
      },
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
 * 
 * A-3-2: normalized.content.required_documents を SSOT として返却
 * 
 * Fallback: required_documents_by_subsidy テーブルにデータがある場合は従来通り返す（互換性維持）
 */
subsidies.get('/:subsidy_id/documents', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  const debug = c.req.query('debug') === '1';
  
  try {
    // ========================================
    // Step 1: required_documents_by_subsidy テーブルから取得（Fallback）
    // ========================================
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
    
    // 従来の書類データがある場合はそのまま返す（互換性維持）
    if (docs.results && docs.results.length > 0) {
      if (debug) {
        console.log(`[A-3-2] /documents: Fallback to required_documents_by_subsidy table for ${subsidyId}`);
      }
      return c.json<ApiResponse<unknown[]>>({
        success: true,
        data: docs.results,
        meta: { source: 'required_documents_table' },
      });
    }
    
    // ========================================
    // Step 2: SSOT（getNormalizedSubsidyDetail）から取得
    // ========================================
    const result = await getNormalizedSubsidyDetail(db, subsidyId, { debug });
    
    if (!result) {
      // 補助金が見つからない場合は空配列（404ではない - 互換性維持）
      return c.json<ApiResponse<RequiredDocument[]>>({
        success: true,
        data: [],
        meta: { source: 'not_found' },
      });
    }
    
    const { normalized } = result;
    const requiredDocuments = normalized.content.required_documents;
    
    if (debug) {
      console.log(`[A-3-2] /documents: SSOT returned ${requiredDocuments.length} documents for ${subsidyId}`);
    }
    
    // normalized.content.required_documents をそのまま返却
    return c.json<ApiResponse<RequiredDocument[]>>({
      success: true,
      data: requiredDocuments,
      meta: { 
        source: 'normalized',
        canonical_id: result.ref.canonical_id,
      },
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
 * 
 * A-3-3: normalized.content.eligible_expenses を SSOT として返却
 */
subsidies.get('/:subsidy_id/expenses', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  const debug = c.req.query('debug') === '1';
  
  try {
    // ========================================
    // SSOT（getNormalizedSubsidyDetail）から取得
    // ========================================
    const result = await getNormalizedSubsidyDetail(db, subsidyId, { debug });
    
    if (!result) {
      // 補助金が見つからない場合は null（互換性維持）
      return c.json<ApiResponse<null>>({
        success: true,
        data: null,
        meta: { source: 'not_found' },
      });
    }
    
    const { normalized } = result;
    const eligibleExpenses = normalized.content.eligible_expenses;
    
    if (debug) {
      console.log(`[A-3-3] /expenses: SSOT returned for ${subsidyId}`, {
        required_count: eligibleExpenses.required.length,
        categories_count: eligibleExpenses.categories.length,
        excluded_count: eligibleExpenses.excluded.length,
      });
    }
    
    // normalized.content.eligible_expenses をそのまま返却
    return c.json<ApiResponse<EligibleExpenses>>({
      success: true,
      data: eligibleExpenses,
      meta: { 
        source: 'normalized',
        canonical_id: result.ref.canonical_id,
      },
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
 * 
 * A-3-4: normalized.content.bonus_points を SSOT として返却
 */
subsidies.get('/:subsidy_id/bonus-points', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  const debug = c.req.query('debug') === '1';
  
  try {
    // ========================================
    // SSOT（getNormalizedSubsidyDetail）から取得
    // ========================================
    const result = await getNormalizedSubsidyDetail(db, subsidyId, { debug });
    
    if (!result) {
      // 補助金が見つからない場合は空配列（互換性維持）
      return c.json<ApiResponse<BonusPoint[]>>({
        success: true,
        data: [],
        meta: { source: 'not_found' },
      });
    }
    
    const { normalized } = result;
    const bonusPoints = normalized.content.bonus_points;
    
    if (debug) {
      console.log(`[A-3-4] /bonus-points: SSOT returned ${bonusPoints.length} bonus points for ${subsidyId}`);
    }
    
    // normalized.content.bonus_points をそのまま返却
    return c.json<ApiResponse<BonusPoint[]>>({
      success: true,
      data: bonusPoints,
      meta: { 
        source: 'normalized',
        canonical_id: result.ref.canonical_id,
      },
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

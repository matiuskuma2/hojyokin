/**
 * Admin Dashboard: コスト・ディスカバリー・進捗
 * 
 * GET /cost/summary            - コストサマリー
 * GET /cost/logs               - コストログ
 * GET /discovery/stats         - ディスカバリー統計
 * GET /discovery/missing-fields - 不足フィールド
 * GET /jgrants/pdf-coverage    - PDF カバレッジ
 * GET /jgrants/pdf-missing-types - PDF不足タイプ
 * GET /progress/wall-chat-ready - 壁打ち準備状況
 * GET /ssot-diagnosis          - SSOT診断
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../../middleware/auth';

const costDiscovery = new Hono<{ Bindings: Env; Variables: Variables }>();

costDiscovery.get('/cost/summary', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin のみ許可
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }
  
  try {
    // P1-1: days 範囲を 1〜90 に固定（SQLite負荷対策）
    const rawDays = parseInt(c.req.query('days') || '7', 10);
    const days = Math.max(1, Math.min(isNaN(rawDays) ? 7 : rawDays, 90));
    
    // P1-1: SQLite の datetime 関数を使用（ISO文字列比較を避ける）
    // SQLite: datetime('now', '-N days') で期間指定
    const daysParam = `-${days} days`;
    
    // 1. 総計
    // P0-2: unknown_billing_count を追加（metadata_json->>'$.billing' = 'unknown' のカウント）
    const summary = await db.prepare(`
      SELECT 
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        COALESCE(SUM(units), 0) as total_units,
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count,
        SUM(CASE WHEN metadata_json IS NOT NULL AND json_valid(metadata_json) = 1 AND json_extract(metadata_json, '$.billing') = 'unknown' THEN 1 ELSE 0 END) as unknown_billing_count
      FROM api_cost_logs
      WHERE created_at >= datetime('now', ?)
    `).bind(daysParam).first<{
      total_cost_usd: number;
      total_units: number;
      total_calls: number;
      success_count: number;
      failure_count: number;
      unknown_billing_count: number;
    }>();
    
    // 2. サービス別内訳
    // P0-2: unknown_billing_count をサービス別にも追加
    const byServiceResult = await db.prepare(`
      SELECT 
        service,
        SUM(cost_usd) as cost_usd,
        SUM(units) as units,
        COUNT(*) as calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN metadata_json IS NOT NULL AND json_valid(metadata_json) = 1 AND json_extract(metadata_json, '$.billing') = 'unknown' THEN 1 ELSE 0 END) as unknown_billing_count
      FROM api_cost_logs
      WHERE created_at >= datetime('now', ?)
      GROUP BY service
      ORDER BY cost_usd DESC
    `).bind(daysParam).all<{
      service: string;
      cost_usd: number;
      units: number;
      calls: number;
      success_count: number;
      unknown_billing_count: number;
    }>();
    
    // 3. 日別推移
    const byDateResult = await db.prepare(`
      SELECT 
        DATE(created_at) as date,
        service,
        SUM(cost_usd) as cost_usd,
        COUNT(*) as calls
      FROM api_cost_logs
      WHERE created_at >= datetime('now', ?)
      GROUP BY DATE(created_at), service
      ORDER BY date DESC, service
    `).bind(daysParam).all<{
      date: string;
      service: string;
      cost_usd: number;
      calls: number;
    }>();
    
    // 4. コスト上位補助金（上位10件、LIMIT固定で負荷上限）
    const topSubsidiesResult = await db.prepare(`
      SELECT 
        acl.subsidy_id,
        sc.title,
        SUM(acl.cost_usd) as cost_usd,
        COUNT(*) as calls
      FROM api_cost_logs acl
      LEFT JOIN subsidy_cache sc ON acl.subsidy_id = sc.id
      WHERE acl.created_at >= datetime('now', ?) AND acl.subsidy_id IS NOT NULL
      GROUP BY acl.subsidy_id
      ORDER BY cost_usd DESC
      LIMIT 10
    `).bind(daysParam).all<{
      subsidy_id: string;
      title: string | null;
      cost_usd: number;
      calls: number;
    }>();
    
    // 5. 直近のエラー（最新20件、LIMIT固定）
    const recentErrorsResult = await db.prepare(`
      SELECT 
        id,
        service,
        action,
        url,
        error_code,
        error_message,
        cost_usd,
        created_at
      FROM api_cost_logs
      WHERE success = 0 AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(daysParam).all<{
      id: number;
      service: string;
      action: string;
      url: string | null;
      error_code: string | null;
      error_message: string | null;
      cost_usd: number;
      created_at: string;
    }>();
    
    // 6. 累計（全期間）
    const allTime = await db.prepare(`
      SELECT 
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        COUNT(*) as total_calls
      FROM api_cost_logs
    `).first<{ total_cost_usd: number; total_calls: number }>();
    
    return c.json<ApiResponse<{
      period: { days: number; since: string };
      summary: typeof summary;
      allTime: typeof allTime;
      byService: typeof byServiceResult.results;
      byDate: typeof byDateResult.results;
      topSubsidies: typeof topSubsidiesResult.results;
      recentErrors: typeof recentErrorsResult.results;
    }>>({
      success: true,
      data: {
        period: { days, since: `datetime('now', '${daysParam}')` },
        summary: summary || {
          total_cost_usd: 0,
          total_units: 0,
          total_calls: 0,
          success_count: 0,
          failure_count: 0,
          unknown_billing_count: 0, // P0-2: unknown_billing_count 追加
        },
        allTime: allTime || { total_cost_usd: 0, total_calls: 0 },
        byService: byServiceResult.results || [],
        byDate: byDateResult.results || [],
        topSubsidies: topSubsidiesResult.results || [],
        recentErrors: recentErrorsResult.results || [],
      },
    });
    
  } catch (error) {
    console.error('Cost summary error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/cost/logs
 * 
 * APIコストログ一覧（super_admin専用）
 * 
 * Query params:
 *   - limit: 取得件数（デフォルト: 50, 最大: 200）
 *   - offset: オフセット
 *   - service: サービスでフィルタ
 *   - success: 成功/失敗でフィルタ（0 or 1）
 */
costDiscovery.get('/cost/logs', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }
  
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const service = c.req.query('service');
    const successFilter = c.req.query('success');
    
    let whereClause = '1=1';
    const params: (string | number)[] = [];
    
    if (service) {
      whereClause += ' AND service = ?';
      params.push(service);
    }
    if (successFilter !== undefined && successFilter !== '') {
      whereClause += ' AND success = ?';
      params.push(parseInt(successFilter, 10));
    }
    
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM api_cost_logs WHERE ${whereClause}
    `).bind(...params).first<{ total: number }>();
    
    const logsResult = await db.prepare(`
      SELECT 
        id, service, action, source_id, subsidy_id, discovery_item_id,
        url, units, unit_type, cost_usd, currency,
        success, http_status, error_code, error_message,
        metadata_json, created_at
      FROM api_cost_logs
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<{
      id: number;
      service: string;
      action: string;
      source_id: string | null;
      subsidy_id: string | null;
      discovery_item_id: string | null;
      url: string | null;
      units: number;
      unit_type: string;
      cost_usd: number;
      currency: string;
      success: number;
      http_status: number | null;
      error_code: string | null;
      error_message: string | null;
      metadata_json: string | null;
      created_at: string;
    }>();
    
    return c.json<ApiResponse<{
      logs: typeof logsResult.results;
      pagination: { total: number; limit: number; offset: number };
    }>>({
      success: true,
      data: {
        logs: logsResult.results || [],
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      },
    });
    
  } catch (error) {
    console.error('Cost logs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Discovery Items 統計（super_admin限定）
// ============================================================

/**
 * discovery_items のステージ別・ソース別統計
 * 
 * GET /api/admin-ops/discovery/stats
 * 
 * 不足フィールド分析、ステージ分布、促進状況を可視化
 */
costDiscovery.get('/discovery/stats', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  
  // super_admin 限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }
  
  try {
    // 1. ソース×ステージ別件数
    const stageDistribution = await db.prepare(`
      SELECT 
        source_id,
        source_type,
        stage,
        COUNT(*) as count
      FROM discovery_items
      GROUP BY source_id, source_type, stage
      ORDER BY source_id, stage
    `).all<{
      source_id: string;
      source_type: string;
      stage: string;
      count: number;
    }>();
    
    // 2. フィールド充足率
    const fieldCompleteness = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN title IS NOT NULL AND LENGTH(title) > 10 THEN 1 ELSE 0 END) as has_title,
        SUM(CASE WHEN summary IS NOT NULL AND LENGTH(summary) > 0 THEN 1 ELSE 0 END) as has_summary,
        SUM(CASE WHEN prefecture_code IS NOT NULL THEN 1 ELSE 0 END) as has_prefecture,
        SUM(CASE WHEN url IS NOT NULL THEN 1 ELSE 0 END) as has_url,
        SUM(CASE WHEN quality_score >= 50 THEN 1 ELSE 0 END) as tier1_ready,
        SUM(CASE WHEN quality_score >= 70 THEN 1 ELSE 0 END) as tier2_ready
      FROM discovery_items
    `).first<{
      total: number;
      has_title: number;
      has_summary: number;
      has_prefecture: number;
      has_url: number;
      tier1_ready: number;
      tier2_ready: number;
    }>();
    
    // 3. 今日の昇格状況
    const today = new Date().toISOString().split('T')[0];
    const todayPromoted = await db.prepare(`
      SELECT 
        source_id,
        COUNT(*) as promoted_count
      FROM discovery_items
      WHERE date(promoted_at) = ?
      GROUP BY source_id
    `).bind(today).all<{
      source_id: string;
      promoted_count: number;
    }>();
    
    // 4. 最近のfeed_failures（discover段階）
    const recentFailures = await db.prepare(`
      SELECT 
        source_id,
        error_type,
        COUNT(*) as count
      FROM feed_failures
      WHERE stage = 'discover'
        AND created_at >= datetime('now', '-24 hours')
      GROUP BY source_id, error_type
      ORDER BY count DESC
      LIMIT 20
    `).all<{
      source_id: string;
      error_type: string;
      count: number;
    }>();
    
    // 5. subsidy_cache のソース別件数
    const cacheBySource = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as count,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as wall_chat_ready_count
      FROM subsidy_cache
      GROUP BY source
      ORDER BY count DESC
    `).all<{
      source: string;
      count: number;
      wall_chat_ready_count: number;
    }>();
    
    // 6. quality_score 分布
    const scoreDistribution = await db.prepare(`
      SELECT 
        CASE 
          WHEN quality_score >= 100 THEN '100+'
          WHEN quality_score >= 70 THEN '70-99'
          WHEN quality_score >= 50 THEN '50-69'
          WHEN quality_score >= 30 THEN '30-49'
          ELSE '0-29'
        END as score_range,
        COUNT(*) as count
      FROM discovery_items
      GROUP BY score_range
      ORDER BY 
        CASE score_range
          WHEN '100+' THEN 1
          WHEN '70-99' THEN 2
          WHEN '50-69' THEN 3
          WHEN '30-49' THEN 4
          ELSE 5
        END
    `).all<{
      score_range: string;
      count: number;
    }>();
    
    // 充足率計算
    const total = fieldCompleteness?.total || 1;
    const completenessRates = {
      title: Math.round(((fieldCompleteness?.has_title || 0) / total) * 100),
      summary: Math.round(((fieldCompleteness?.has_summary || 0) / total) * 100),
      prefecture: Math.round(((fieldCompleteness?.has_prefecture || 0) / total) * 100),
      url: Math.round(((fieldCompleteness?.has_url || 0) / total) * 100),
      tier1_rate: Math.round(((fieldCompleteness?.tier1_ready || 0) / total) * 100),
      tier2_rate: Math.round(((fieldCompleteness?.tier2_ready || 0) / total) * 100),
    };
    
    return c.json<ApiResponse<{
      stage_distribution: typeof stageDistribution.results;
      field_completeness: typeof fieldCompleteness;
      completeness_rates: typeof completenessRates;
      today_promoted: typeof todayPromoted.results;
      recent_failures: typeof recentFailures.results;
      cache_by_source: typeof cacheBySource.results;
      score_distribution: typeof scoreDistribution.results;
      generated_at: string;
    }>>({
      success: true,
      data: {
        stage_distribution: stageDistribution.results || [],
        field_completeness: fieldCompleteness!,
        completeness_rates,
        today_promoted: todayPromoted.results || [],
        recent_failures: recentFailures.results || [],
        cache_by_source: cacheBySource.results || [],
        score_distribution: scoreDistribution.results || [],
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Discovery stats error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * discovery_items の不足フィールド詳細
 * 
 * GET /api/admin-ops/discovery/missing-fields
 * 
 * どのフィールドが欠けているアイテムがどれだけあるかを詳細に分析
 */
costDiscovery.get('/discovery/missing-fields', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  
  // super_admin 限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }
  
  try {
    // 不足パターン分析
    // 各組み合わせがどれだけあるか
    const missingPatterns = await db.prepare(`
      SELECT 
        CASE WHEN title IS NULL OR LENGTH(title) <= 10 THEN 1 ELSE 0 END as missing_title,
        CASE WHEN summary IS NULL OR LENGTH(summary) = 0 THEN 1 ELSE 0 END as missing_summary,
        CASE WHEN prefecture_code IS NULL THEN 1 ELSE 0 END as missing_prefecture,
        CASE WHEN url IS NULL THEN 1 ELSE 0 END as missing_url,
        COUNT(*) as count
      FROM discovery_items
      WHERE stage IN ('raw', 'validated')
      GROUP BY missing_title, missing_summary, missing_prefecture, missing_url
      ORDER BY count DESC
      LIMIT 20
    `).all<{
      missing_title: number;
      missing_summary: number;
      missing_prefecture: number;
      missing_url: number;
      count: number;
    }>();
    
    // タイトルなし（最も致命的）
    const noTitleSamples = await db.prepare(`
      SELECT id, url, stage, quality_score, first_seen_at
      FROM discovery_items
      WHERE (title IS NULL OR LENGTH(title) <= 10)
        AND stage IN ('raw', 'validated')
      ORDER BY first_seen_at DESC
      LIMIT 10
    `).all<{
      id: string;
      url: string;
      stage: string;
      quality_score: number;
      first_seen_at: string;
    }>();
    
    // 概要なし
    const noSummarySamples = await db.prepare(`
      SELECT id, title, url, stage, quality_score, first_seen_at
      FROM discovery_items
      WHERE (summary IS NULL OR LENGTH(summary) = 0)
        AND title IS NOT NULL AND LENGTH(title) > 10
        AND stage IN ('raw', 'validated')
      ORDER BY first_seen_at DESC
      LIMIT 10
    `).all<{
      id: string;
      title: string;
      url: string;
      stage: string;
      quality_score: number;
      first_seen_at: string;
    }>();
    
    // 都道府県なし
    const noPrefectureSamples = await db.prepare(`
      SELECT id, title, url, stage, quality_score, first_seen_at
      FROM discovery_items
      WHERE prefecture_code IS NULL
        AND title IS NOT NULL AND LENGTH(title) > 10
        AND stage IN ('raw', 'validated')
      ORDER BY first_seen_at DESC
      LIMIT 10
    `).all<{
      id: string;
      title: string;
      url: string;
      stage: string;
      quality_score: number;
      first_seen_at: string;
    }>();
    
    // 改善可能件数（URLはあるが他が欠けている）
    const improvableCounts = await db.prepare(`
      SELECT 
        SUM(CASE WHEN (title IS NULL OR LENGTH(title) <= 10) AND url IS NOT NULL THEN 1 ELSE 0 END) as needs_title,
        SUM(CASE WHEN (summary IS NULL OR LENGTH(summary) = 0) AND url IS NOT NULL THEN 1 ELSE 0 END) as needs_summary,
        SUM(CASE WHEN prefecture_code IS NULL AND url IS NOT NULL THEN 1 ELSE 0 END) as needs_prefecture
      FROM discovery_items
      WHERE stage IN ('raw', 'validated')
    `).first<{
      needs_title: number;
      needs_summary: number;
      needs_prefecture: number;
    }>();
    
    return c.json<ApiResponse<{
      missing_patterns: typeof missingPatterns.results;
      samples: {
        no_title: typeof noTitleSamples.results;
        no_summary: typeof noSummarySamples.results;
        no_prefecture: typeof noPrefectureSamples.results;
      };
      improvable_counts: typeof improvableCounts;
      recommendation: string;
    }>>({
      success: true,
      data: {
        missing_patterns: missingPatterns.results || [],
        samples: {
          no_title: noTitleSamples.results || [],
          no_summary: noSummarySamples.results || [],
          no_prefecture: noPrefectureSamples.results || [],
        },
        improvable_counts: improvableCounts!,
        recommendation: improvableCounts?.needs_title && improvableCounts.needs_title > 100
          ? 'タイトルが欠けているアイテムが多数あります。詳細ページのスクレイピングを推奨します。'
          : improvableCounts?.needs_summary && improvableCounts.needs_summary > 100
          ? '概要が欠けているアイテムが多数あります。詳細ページから概要を抽出することを推奨します。'
          : improvableCounts?.needs_prefecture && improvableCounts.needs_prefecture > 100
          ? '都道府県情報が欠けているアイテムが多数あります。都道府県の推論ロジック追加を推奨します。'
          : 'フィールド充足率は良好です。',
      },
    });
    
  } catch (error) {
    console.error('Missing fields analysis error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// A. PDF Coverage Dashboard (jGrants)
// GET /api/admin-ops/jgrants/pdf-coverage
// ============================================================

costDiscovery.get('/jgrants/pdf-coverage', async (c) => {
  const db = c.env.DB;
  const days = parseInt(c.req.query('days') || '90', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  
  try {
    const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();
    const now = new Date().toISOString();
    
    // Summary: 全体のPDF有無・enriched_v2・ready数
    const summary = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN detail_json IS NOT NULL AND json_valid(detail_json) = 1 
            AND json_extract(detail_json, '$.enriched_version') = 'v2' THEN 1 ELSE 0 END) as enriched_v2,
        SUM(CASE WHEN detail_json IS NOT NULL AND json_valid(detail_json) = 1 
            AND json_extract(detail_json, '$.pdf_urls') IS NOT NULL 
            AND json_extract(detail_json, '$.pdf_urls') != '[]' THEN 1 ELSE 0 END) as has_pdf_urls,
        SUM(CASE WHEN detail_json IS NOT NULL AND json_valid(detail_json) = 1 
            AND (json_extract(detail_json, '$.related_url') IS NOT NULL 
                 OR json_extract(detail_json, '$.reference_urls') IS NOT NULL) THEN 1 ELSE 0 END) as has_related_urls,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as wall_chat_ready,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL 
            AND acceptance_end_datetime > ? THEN 1 ELSE 0 END) as active_acceptance
      FROM subsidy_cache 
      WHERE source = 'jgrants'
    `).bind(now).first<{
      total: number;
      enriched_v2: number;
      has_pdf_urls: number;
      has_related_urls: number;
      wall_chat_ready: number;
      active_acceptance: number;
    }>();
    
    // Top: PDFあり（期限近い順）
    const topPdfYes = await db.prepare(`
      SELECT 
        id, title, 
        acceptance_end_datetime,
        json_extract(detail_json, '$.pdf_urls') as pdf_urls,
        json_extract(detail_json, '$.subsidy_max_limit') as max_limit,
        wall_chat_ready
      FROM subsidy_cache 
      WHERE source = 'jgrants'
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND json_extract(detail_json, '$.pdf_urls') IS NOT NULL 
        AND json_extract(detail_json, '$.pdf_urls') != '[]'
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
      ORDER BY 
        CASE WHEN acceptance_end_datetime IS NOT NULL THEN 0 ELSE 1 END,
        acceptance_end_datetime ASC
      LIMIT ? OFFSET ?
    `).bind(now, limit, offset).all<{
      id: string;
      title: string;
      acceptance_end_datetime: string | null;
      pdf_urls: string | null;
      max_limit: number | null;
      wall_chat_ready: number;
    }>();
    
    // Top: PDFなし（期限近い・Tier1優先）
    const tier1Keywords = ['ものづくり', '持続化', '事業再構築', '再構築', 'IT導入', '省力化'];
    const tier1Condition = tier1Keywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    
    const topPdfNo = await db.prepare(`
      SELECT 
        id, title, 
        acceptance_end_datetime,
        json_extract(detail_json, '$.related_url') as related_url,
        json_extract(detail_json, '$.reference_urls') as reference_urls,
        json_extract(detail_json, '$.enriched_version') as enriched_version,
        CASE WHEN (${tier1Condition}) THEN 1 ELSE 0 END as is_tier1,
        wall_chat_ready
      FROM subsidy_cache 
      WHERE source = 'jgrants'
        AND (detail_json IS NULL 
             OR json_valid(detail_json) = 0
             OR json_extract(detail_json, '$.pdf_urls') IS NULL 
             OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
      ORDER BY 
        CASE WHEN (${tier1Condition}) THEN 0 ELSE 1 END,
        CASE WHEN acceptance_end_datetime IS NOT NULL THEN 0 ELSE 1 END,
        acceptance_end_datetime ASC
      LIMIT ? OFFSET ?
    `).bind(now, limit, offset).all<{
      id: string;
      title: string;
      acceptance_end_datetime: string | null;
      related_url: string | null;
      reference_urls: string | null;
      enriched_version: string | null;
      is_tier1: number;
      wall_chat_ready: number;
    }>();
    
    // PDFなし but related/reference_urls あり（次の取り方候補）
    const pdfNoButHasUrls = await db.prepare(`
      SELECT 
        id, title, 
        acceptance_end_datetime,
        json_extract(detail_json, '$.related_url') as related_url,
        json_extract(detail_json, '$.reference_urls') as reference_urls,
        wall_chat_ready
      FROM subsidy_cache 
      WHERE source = 'jgrants'
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL 
             OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (json_extract(detail_json, '$.related_url') IS NOT NULL 
             OR json_extract(detail_json, '$.reference_urls') IS NOT NULL)
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
      ORDER BY 
        CASE WHEN acceptance_end_datetime IS NOT NULL THEN 0 ELSE 1 END,
        acceptance_end_datetime ASC
      LIMIT 50
    `).bind(now).all<{
      id: string;
      title: string;
      acceptance_end_datetime: string | null;
      related_url: string | null;
      reference_urls: string | null;
      wall_chat_ready: number;
    }>();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        summary: {
          ...summary,
          pdf_coverage_rate: summary?.total ? ((summary.has_pdf_urls || 0) / summary.total * 100).toFixed(1) + '%' : '0%',
          enriched_rate: summary?.total ? ((summary.enriched_v2 || 0) / summary.total * 100).toFixed(1) + '%' : '0%',
          ready_rate: summary?.total ? ((summary.wall_chat_ready || 0) / summary.total * 100).toFixed(1) + '%' : '0%',
        },
        top_pdf_yes: topPdfYes.results?.map(r => ({
          ...r,
          pdf_urls: r.pdf_urls ? JSON.parse(r.pdf_urls) : [],
          pdf_count: r.pdf_urls ? JSON.parse(r.pdf_urls).length : 0,
        })) || [],
        top_pdf_no: topPdfNo.results || [],
        pdf_no_but_has_urls: pdfNoButHasUrls.results?.map(r => ({
          ...r,
          reference_urls: r.reference_urls ? JSON.parse(r.reference_urls) : [],
        })) || [],
        query_params: { days, limit, offset },
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('PDF coverage error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// B. PDF Missing Types Classification
// GET /api/admin-ops/jgrants/pdf-missing-types
// ============================================================

costDiscovery.get('/jgrants/pdf-missing-types', async (c) => {
  const db = c.env.DB;
  const days = parseInt(c.req.query('days') || '180', 10);
  
  try {
    const now = new Date().toISOString();
    
    // 分類の定義とカウント
    // 1. E-APPLY: 電子申請/オンライン完結
    const eApplyCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'jgrants'
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (json_extract(detail_json, '$.is_electronic_application') = 1
             OR json_extract(detail_json, '$.overview') LIKE '%電子申請%'
             OR json_extract(detail_json, '$.overview') LIKE '%jGrants%'
             OR json_extract(detail_json, '$.overview') LIKE '%GビズID%'
             OR json_extract(detail_json, '$.overview') LIKE '%オンライン%申請%')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
    `).bind(now).first<{ cnt: number }>();
    
    // 2. HAS_RELATED_URL: related_urlはあるがpdf_urlsなし
    const hasRelatedCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'jgrants'
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (json_extract(detail_json, '$.related_url') IS NOT NULL 
             OR json_extract(detail_json, '$.reference_urls') IS NOT NULL)
        AND NOT (json_extract(detail_json, '$.is_electronic_application') = 1
             OR json_extract(detail_json, '$.overview') LIKE '%電子申請%')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
    `).bind(now).first<{ cnt: number }>();
    
    // 3. NO_URLS: related_urlすら無い
    const noUrlsCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'jgrants'
        AND (detail_json IS NULL 
             OR json_valid(detail_json) = 0
             OR (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
                AND json_extract(detail_json, '$.related_url') IS NULL 
                AND json_extract(detail_json, '$.reference_urls') IS NULL)
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
    `).bind(now).first<{ cnt: number }>();
    
    // 4. ENDED_OR_UNKNOWN: 募集終了/期限不明
    const endedCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'jgrants'
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND acceptance_end_datetime IS NOT NULL 
        AND acceptance_end_datetime <= ?
    `).bind(now).first<{ cnt: number }>();
    
    // 5. NEEDS_MANUAL: 主要補助金なのにPDFなし
    const tier1Keywords = ['ものづくり', '持続化', '事業再構築', '再構築', 'IT導入', '省力化', 'DX', '創業'];
    const tier1Condition = tier1Keywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    
    const needsManualCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'jgrants'
        AND (${tier1Condition})
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
    `).bind(now).first<{ cnt: number }>();
    
    // 各バケットのサンプル10件
    const eApplySamples = await db.prepare(`
      SELECT id, title, acceptance_end_datetime,
        json_extract(detail_json, '$.related_url') as related_url
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (json_extract(detail_json, '$.is_electronic_application') = 1
             OR json_extract(detail_json, '$.overview') LIKE '%電子申請%'
             OR json_extract(detail_json, '$.overview') LIKE '%jGrants%')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
      LIMIT 10
    `).bind(now).all<{ id: string; title: string; acceptance_end_datetime: string | null; related_url: string | null }>();
    
    const hasRelatedSamples = await db.prepare(`
      SELECT id, title, acceptance_end_datetime,
        json_extract(detail_json, '$.related_url') as related_url,
        json_extract(detail_json, '$.reference_urls') as reference_urls
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (json_extract(detail_json, '$.related_url') IS NOT NULL 
             OR json_extract(detail_json, '$.reference_urls') IS NOT NULL)
        AND NOT (json_extract(detail_json, '$.overview') LIKE '%電子申請%')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
      LIMIT 10
    `).bind(now).all<{ id: string; title: string; acceptance_end_datetime: string | null; related_url: string | null; reference_urls: string | null }>();
    
    const needsManualSamples = await db.prepare(`
      SELECT id, title, acceptance_end_datetime,
        json_extract(detail_json, '$.related_url') as related_url
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND (${tier1Condition})
        AND detail_json IS NOT NULL AND json_valid(detail_json) = 1
        AND (json_extract(detail_json, '$.pdf_urls') IS NULL OR json_extract(detail_json, '$.pdf_urls') = '[]')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > ?)
      LIMIT 10
    `).bind(now).all<{ id: string; title: string; acceptance_end_datetime: string | null; related_url: string | null }>();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        buckets: {
          E_APPLY: {
            label: '電子申請/オンライン完結',
            description: 'jGrants/GビズID等で電子申請。PDFなしでも壁打ち可能候補',
            count: eApplyCount?.cnt || 0,
            samples: eApplySamples.results || [],
          },
          HAS_RELATED_URL: {
            label: '外部URLあり（PDF未取得）',
            description: 'related_url/reference_urlsはあるがPDF未取得。スクレイプ対象',
            count: hasRelatedCount?.cnt || 0,
            samples: hasRelatedSamples.results?.map(r => ({
              ...r,
              reference_urls: r.reference_urls ? JSON.parse(r.reference_urls) : null,
            })) || [],
          },
          NO_URLS: {
            label: 'URLなし',
            description: 'related_urlすら無い。APIメタのみで情報が薄い',
            count: noUrlsCount?.cnt || 0,
            samples: [],
          },
          ENDED_OR_UNKNOWN: {
            label: '募集終了/期限切れ',
            description: '期限切れのため優先度を下げる',
            count: endedCount?.cnt || 0,
            samples: [],
          },
          NEEDS_MANUAL: {
            label: '主要補助金（要対応）',
            description: 'ものづくり/持続化/再構築等の主要補助金でPDFなし。別手段が必要',
            count: needsManualCount?.cnt || 0,
            samples: needsManualSamples.results || [],
          },
        },
        tier1_keywords: tier1Keywords,
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('PDF missing types error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// C. Wall Chat Ready Progress Trend
// GET /api/admin-ops/progress/wall-chat-ready
// ============================================================

costDiscovery.get('/progress/wall-chat-ready', async (c) => {
  const db = c.env.DB;
  const days = parseInt(c.req.query('days') || '60', 10);
  
  try {
    // Source別の現在の状態（Active中心）
    const bySource = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL 
            AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready_all,
        SUM(CASE WHEN wall_chat_ready = 1 
            AND acceptance_end_datetime IS NOT NULL 
            AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as ready_active,
        SUM(CASE WHEN detail_json LIKE '%"enriched_version":"v2"%' THEN 1 ELSE 0 END) as enriched_v2,
        SUM(CASE WHEN json_extract(detail_json, '$.base64_processed') = 1 THEN 1 ELSE 0 END) as base64_processed,
        SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM json_each(json_extract(detail_json, '$.pdf_urls'))
            WHERE value LIKE 'r2://%'
          ) THEN 1 ELSE 0 END
        ) as has_r2_pdf,
        SUM(CASE WHEN json_extract(detail_json, '$.extracted_from_pdf') IS NOT NULL THEN 1 ELSE 0 END) as extracted
      FROM subsidy_cache
      GROUP BY source
      ORDER BY active DESC
    `).all<{
      source: string;
      total: number;
      active: number;
      ready_all: number;
      ready_active: number;
      enriched_v2: number;
      base64_processed: number;
      has_r2_pdf: number;
      extracted: number;
    }>();
    
    // 全体サマリー（Active中心）
    const totalSummary = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL 
            AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready_all,
        SUM(CASE WHEN wall_chat_ready = 1 
            AND acceptance_end_datetime IS NOT NULL 
            AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as ready_active,
        SUM(CASE WHEN detail_json LIKE '%"enriched_version"%' THEN 1 ELSE 0 END) as enriched,
        SUM(CASE WHEN json_extract(detail_json, '$.base64_processed') = 1 THEN 1 ELSE 0 END) as base64_processed,
        SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM json_each(json_extract(detail_json, '$.pdf_urls'))
            WHERE value LIKE 'r2://%'
          ) THEN 1 ELSE 0 END
        ) as has_r2_pdf
      FROM subsidy_cache
    `).first<{ total: number; active: number; ready_all: number; ready_active: number; enriched: number; base64_processed: number; has_r2_pdf: number }>();
    
    // cron_runs から日別の enrichment 実績を取得（wall_chat_ready増加の代替指標）
    const dailyEnrichment = await db.prepare(`
      SELECT 
        date(completed_at) as date,
        job_name,
        SUM(COALESCE(json_extract(metadata_json, '$.items_ready'), 0)) as ready_added,
        SUM(items_inserted) as items_enriched,
        COUNT(*) as run_count
      FROM cron_runs
      WHERE job_name LIKE '%enrich%'
        AND completed_at IS NOT NULL
        AND completed_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(completed_at), job_name
      ORDER BY date DESC
      LIMIT 100
    `).bind(days).all<{
      date: string;
      job_name: string;
      ready_added: number;
      items_enriched: number;
      run_count: number;
    }>();
    
    // extraction_queue の処理状況
    const extractionStats = await db.prepare(`
      SELECT 
        status,
        job_type,
        COUNT(*) as count
      FROM extraction_queue
      GROUP BY status, job_type
    `).all<{ status: string; job_type: string; count: number }>();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        summary: {
          total: totalSummary?.total || 0,
          active: totalSummary?.active || 0,
          ready_all: totalSummary?.ready_all || 0,
          ready_active: totalSummary?.ready_active || 0,
          enriched: totalSummary?.enriched || 0,
          base64_processed: totalSummary?.base64_processed || 0,
          has_r2_pdf: totalSummary?.has_r2_pdf || 0,
          // Active中心のReady率
          ready_rate: totalSummary?.active 
            ? ((totalSummary.ready_active || 0) / totalSummary.active * 100).toFixed(1) + '%' 
            : '0%',
          // 後方互換性
          ready: totalSummary?.ready_active || 0,
        },
        by_source: bySource.results?.map(r => ({
          ...r,
          // Active中心のReady率
          ready_rate: r.active ? ((r.ready_active / r.active) * 100).toFixed(1) + '%' : '0%',
          enriched_rate: r.total ? ((r.enriched_v2 / r.total) * 100).toFixed(1) + '%' : '0%',
          // 後方互換性
          ready: r.ready_active,
        })) || [],
        daily_enrichment: dailyEnrichment.results || [],
        extraction_queue: extractionStats.results || [],
        query_params: { days },
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Wall chat ready progress error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// P1: SSOT検索診断API（24時間監視用）
// ============================================================

/**
 * SSOT検索診断API（super_admin限定）
 * 差分を「募集開始前」「欠損」「その他」に自動分類してJSONで返す
 * 
 * GET /api/admin-ops/ssot-diagnosis
 */
costDiscovery.get('/ssot-diagnosis', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }
  
  const db = c.env.DB;
  
  try {
    // 1) /api/health相当の基本カウント
    const ssotCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM subsidy_canonical c
      JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
      WHERE c.is_active = 1 AND s.is_accepting = 1
    `).first<{ count: number }>();
    
    const cacheCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND request_reception_display_flag = 1
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime > datetime('now')
    `).first<{ count: number }>();
    
    // 2) cache > ssot の差分（cacheにあってSSOTにない）を抽出
    //    「募集開始前」（acceptance_start > now）かどうかで分類
    const diffItems = await db.prepare(`
      SELECT
        sc.id,
        sc.title,
        sc.acceptance_start_datetime,
        sc.acceptance_end_datetime,
        CASE 
          WHEN sc.acceptance_start_datetime > datetime('now') THEN 'pre_start'
          ELSE 'other'
        END as diff_reason
      FROM subsidy_cache sc
      LEFT JOIN subsidy_source_link l
        ON l.source_type='jgrants' AND l.source_id=sc.id
      LEFT JOIN subsidy_canonical c
        ON c.id=l.canonical_id
      LEFT JOIN subsidy_snapshot s
        ON s.id=c.latest_snapshot_id
      WHERE sc.source='jgrants'
        AND sc.request_reception_display_flag=1
        AND sc.acceptance_end_datetime > datetime('now')
        AND (s.is_accepting IS NULL OR s.is_accepting != 1)
      ORDER BY sc.acceptance_start_datetime ASC
      LIMIT 50
    `).all<{
      id: string;
      title: string;
      acceptance_start_datetime: string | null;
      acceptance_end_datetime: string | null;
      diff_reason: 'pre_start' | 'other';
    }>();
    
    const diffResults = diffItems.results || [];
    const preStartCount = diffResults.filter(d => d.diff_reason === 'pre_start').length;
    const otherCount = diffResults.filter(d => d.diff_reason === 'other').length;
    
    // 3) 整合性チェック（P1検証用）
    const integrityCheck = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN latest_cache_id IS NOT NULL THEN 1 ELSE 0 END) as has_latest_cache_id,
        SUM(CASE WHEN latest_snapshot_id IS NOT NULL THEN 1 ELSE 0 END) as has_latest_snapshot_id
      FROM subsidy_canonical
    `).first<{ total: number; has_latest_cache_id: number; has_latest_snapshot_id: number }>();
    
    // 4) 合格判定
    const passStatus = {
      // 必須: SSOT_SEARCH_ERROR = 0件 → ログベースなのでここでは判定不可
      // 必須: missing_in_ssot = 0件（other が 0）
      missing_in_ssot_zero: otherCount === 0,
      // 許容: cache > ssot の差分が全て「募集開始前」
      diff_explained: otherCount === 0,
      // 整合性: latest_cache_id と latest_snapshot_id が 100%
      integrity_ok: 
        integrityCheck?.has_latest_cache_id === integrityCheck?.total &&
        integrityCheck?.has_latest_snapshot_id === integrityCheck?.total,
    };
    
    const overallPass = passStatus.missing_in_ssot_zero && passStatus.integrity_ok;
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        // 基本カウント
        counts: {
          ssot_accepting_count: ssotCount?.count || 0,
          cache_accepting_count: cacheCount?.count || 0,
          diff: (cacheCount?.count || 0) - (ssotCount?.count || 0),
        },
        // 差分分類
        diff_classification: {
          pre_start: preStartCount,  // 許容（募集開始前）
          other: otherCount,         // NG（要調査）
          total: diffResults.length,
        },
        // 差分詳細（上位10件）
        diff_items_top10: diffResults.slice(0, 10).map(d => ({
          id: d.id,
          title: d.title?.substring(0, 50) + (d.title && d.title.length > 50 ? '...' : ''),
          acceptance_start: d.acceptance_start_datetime,
          acceptance_end: d.acceptance_end_datetime,
          reason: d.diff_reason,
        })),
        // 整合性
        integrity: {
          canonical_total: integrityCheck?.total || 0,
          has_latest_cache_id: integrityCheck?.has_latest_cache_id || 0,
          has_latest_snapshot_id: integrityCheck?.has_latest_snapshot_id || 0,
        },
        // 合格判定
        pass_status: passStatus,
        overall_pass: overallPass,
        // 推奨アクション
        recommendation: overallPass 
          ? 'PASS: SEARCH_BACKEND=ssot に切替可能'
          : otherCount > 0 
            ? `FAIL: other=${otherCount}件を要調査（募集開始前以外の差分あり）`
            : 'FAIL: 整合性チェックを確認してください',
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('SSOT diagnosis error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// 泉(izumi)→canonical 紐付けAPI（super_admin限定）
// ============================================================

/**
 * 泉→canonical 紐付け処理
 * D1のLIKE制限を回避するため、アプリケーション側で処理
 */

export default costDiscovery;

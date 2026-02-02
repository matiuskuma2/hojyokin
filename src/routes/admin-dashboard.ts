/**
 * 管理者ダッシュボード API（運用系）
 * 
 * 注: /api/admin-ops にマウント（/api/admin との競合回避）
 * 
 * /api/admin-ops/dashboard - KPI + キュー状況
 * /api/admin-ops/costs - コスト集計（super_admin限定）
 * /api/admin-ops/updates - 更新状況一覧
 * /api/admin-ops/agency-kpi - Agency KPI（super_admin限定）
 * /api/admin-ops/data-freshness - データ鮮度
 * /api/admin-ops/alerts - アラート
 * /api/admin-ops/ops/* - 運用操作系
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../middleware/auth';

const adminDashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

// 全ルートに認証 + 管理者権限を要求
adminDashboard.use('*', requireAuth);
adminDashboard.use('*', requireAdmin);

// ============================================================
// KPI ダッシュボード
// ============================================================

adminDashboard.get('/dashboard', async (c) => {
  const db = c.env.DB;
  
  try {
    // 日付範囲
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // ユーザー数
    const userStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN date(created_at) = ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as week,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as month
      FROM users
    `).bind(today, weekAgo, monthAgo).first<{
      total: number; today: number; week: number; month: number;
    }>();

    // 検索数（usage_events から）
    const searchStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN date(created_at) = ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as week,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as month
      FROM usage_events WHERE event_type = 'SUBSIDY_SEARCH'
    `).bind(today, weekAgo, monthAgo).first<{
      total: number; today: number; week: number; month: number;
    }>() || { total: 0, today: 0, week: 0, month: 0 };

    // 壁打ち数
    const chatStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN date(created_at) = ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as week,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as month
      FROM chat_sessions
    `).bind(today, weekAgo, monthAgo).first<{
      total: number; today: number; week: number; month: number;
    }>() || { total: 0, today: 0, week: 0, month: 0 };

    // ドラフト数
    const draftStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN date(created_at) = ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as week,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as month
      FROM application_drafts
    `).bind(today, weekAgo, monthAgo).first<{
      total: number; today: number; week: number; month: number;
    }>() || { total: 0, today: 0, week: 0, month: 0 };

    // キュー状況
    const queueStats = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM crawl_queue
      GROUP BY status
    `).all<{ status: string; count: number }>();

    const queueByStatus: Record<string, number> = {};
    for (const row of queueStats.results || []) {
      queueByStatus[row.status] = row.count;
    }

    // 日別推移（過去7日）
    const dailyStats = await db.prepare(`
      SELECT 
        date(created_at) as date,
        event_type,
        COUNT(*) as count
      FROM usage_events
      WHERE created_at >= ?
      GROUP BY date(created_at), event_type
      ORDER BY date DESC
    `).bind(weekAgo).all<{ date: string; event_type: string; count: number }>();

    // 日別ユーザー登録
    const dailyUsers = await db.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).bind(weekAgo).all<{ date: string; count: number }>();

    // 今日の直近イベント（リアルタイム確認用）
    const recentEvents = await db.prepare(`
      SELECT 
        ue.id,
        ue.event_type,
        ue.user_id,
        u.email as user_email,
        ue.company_id,
        c.name as company_name,
        ue.estimated_cost_usd,
        ue.metadata_json as metadata,
        ue.created_at
      FROM usage_events ue
      LEFT JOIN users u ON ue.user_id = u.id
      LEFT JOIN companies c ON ue.company_id = c.id
      WHERE date(ue.created_at) = ?
      ORDER BY ue.created_at DESC
      LIMIT 20
    `).bind(today).all<{
      id: string;
      event_type: string;
      user_id: string;
      user_email: string | null;
      company_id: string | null;
      company_name: string | null;
      estimated_cost_usd: number;
      metadata: string | null;
      created_at: string;
    }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        kpi: {
          users: userStats,
          searches: searchStats,
          chats: chatStats,
          drafts: draftStats,
        },
        queue: queueByStatus,
        daily: {
          events: dailyStats.results || [],
          users: dailyUsers.results || [],
        },
        recent_events: recentEvents.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DASHBOARD_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// コスト集計（super_admin限定）
// ============================================================

adminDashboard.get('/costs', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    // OpenAI コスト（api_cost_logs から）
    const openaiCosts = await db.prepare(`
      SELECT 
        json_extract(metadata_json, '$.model') as model,
        action as feature,
        SUM(CASE WHEN date(created_at) = ? THEN cost_usd ELSE 0 END) as today_cost,
        SUM(CASE WHEN date(created_at) >= ? THEN cost_usd ELSE 0 END) as month_cost,
        SUM(CASE WHEN date(created_at) = ? THEN units ELSE 0 END) as today_tokens,
        SUM(CASE WHEN date(created_at) >= ? THEN units ELSE 0 END) as month_tokens,
        COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as today_calls,
        COUNT(CASE WHEN date(created_at) >= ? THEN 1 END) as month_calls
      FROM api_cost_logs
      WHERE service = 'openai'
      GROUP BY json_extract(metadata_json, '$.model'), action
    `).bind(today, monthStart, today, monthStart, today, monthStart)
      .all<{
        model: string; feature: string;
        today_cost: number; month_cost: number;
        today_tokens: number; month_tokens: number;
        today_calls: number; month_calls: number;
      }>();

    // Firecrawl コスト（api_cost_logs から、URLからドメインを抽出）
    const firecrawlCosts = await db.prepare(`
      SELECT 
        CASE 
          WHEN url LIKE 'https://%' THEN substr(url, 9, instr(substr(url, 9), '/') - 1)
          WHEN url LIKE 'http://%' THEN substr(url, 8, instr(substr(url, 8), '/') - 1)
          ELSE 'unknown'
        END as domain,
        SUM(CASE WHEN date(created_at) = ? THEN cost_usd ELSE 0 END) as today_cost,
        SUM(CASE WHEN date(created_at) >= ? THEN cost_usd ELSE 0 END) as month_cost,
        COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as today_pages,
        COUNT(CASE WHEN date(created_at) >= ? THEN 1 END) as month_pages,
        COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as today_calls,
        COUNT(CASE WHEN date(created_at) >= ? THEN 1 END) as month_calls,
        SUM(CASE WHEN success = 0 AND date(created_at) >= ? THEN 1 ELSE 0 END) as month_failures
      FROM api_cost_logs
      WHERE service = 'firecrawl'
      GROUP BY domain
      ORDER BY month_cost DESC
      LIMIT 20
    `).bind(today, monthStart, today, monthStart, today, monthStart, monthStart)
      .all<{
        domain: string;
        today_cost: number; month_cost: number;
        today_pages: number; month_pages: number;
        today_calls: number; month_calls: number;
        month_failures: number;
      }>();

    // 日別コスト推移（過去30日）
    const dailyCosts = await db.prepare(`
      SELECT 
        date(created_at) as date,
        service as provider,
        SUM(cost_usd) as cost
      FROM api_cost_logs
      WHERE service IN ('openai', 'firecrawl')
        AND created_at >= date('now', '-30 days')
      GROUP BY date(created_at), service
      ORDER BY date DESC
    `).all<{ date: string; provider: string; cost: number }>();

    // 合計（api_cost_logs から）
    const totals = await db.prepare(`
      SELECT 
        service as provider,
        SUM(CASE WHEN date(created_at) = ? THEN cost_usd ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN cost_usd ELSE 0 END) as month
      FROM api_cost_logs
      WHERE service IN ('openai', 'firecrawl', 'vision_ocr')
      GROUP BY service
    `).bind(today, monthStart).all<{ provider: string; today: number; month: number }>();

    const totalsByProvider: Record<string, { today: number; month: number }> = {};
    for (const row of totals.results || []) {
      totalsByProvider[row.provider] = { today: row.today || 0, month: row.month || 0 };
    }

    // 前日比（急増検知用）
    const yesterdayCost = await db.prepare(`
      SELECT SUM(cost_usd) as cost
      FROM api_cost_logs
      WHERE date(created_at) = date('now', '-1 day')
    `).first<{ cost: number }>();

    const todayCostResult = await db.prepare(`
      SELECT SUM(cost_usd) as cost
      FROM api_cost_logs
      WHERE date(created_at) = date('now')
    `).first<{ cost: number }>();

    const costRatio = yesterdayCost?.cost && yesterdayCost.cost > 0
      ? (todayCostResult?.cost || 0) / yesterdayCost.cost
      : null;

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        openai: openaiCosts.results || [],
        firecrawl: firecrawlCosts.results || [],
        daily: dailyCosts.results || [],
        totals: totalsByProvider,
        alerts: {
          costRatio,
          costAlert: costRatio && costRatio > 3 ? 'HIGH' : costRatio && costRatio > 2 ? 'MEDIUM' : null,
        },
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Costs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'COSTS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// 更新状況一覧
// ============================================================

adminDashboard.get('/updates', async (c) => {
  const db = c.env.DB;
  
  try {
    // source_registry の更新状況（本番スキーマ対応）
    const registryStats = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN last_crawl_status = 'error' OR last_crawl_status = 'blocked' THEN 1 ELSE 0 END) as error,
        MAX(last_crawled_at) as last_crawl,
        MIN(next_crawl_at) as next_crawl
      FROM source_registry
      GROUP BY scope
    `).all<{
      scope: string; total: number; active: number; paused: number; error: number;
      last_crawl: string; next_crawl: string;
    }>();

    // crawl_queue 状況
    const queueStats = await db.prepare(`
      SELECT 
        kind,
        status,
        COUNT(*) as count,
        MAX(created_at) as latest
      FROM crawl_queue
      GROUP BY kind, status
    `).all<{ kind: string; status: string; count: number; latest: string }>();

    // domain_policy 状況（本番スキーマ対応）
    const domainStats = await db.prepare(`
      SELECT 
        CASE WHEN blocked_until IS NOT NULL AND blocked_until > datetime('now') THEN 1 ELSE 0 END as blocked,
        COUNT(*) as count,
        SUM(success_count) as total_success,
        SUM(failure_count) as total_failures
      FROM domain_policy
      GROUP BY blocked
    `).all<{ blocked: number; count: number; total_success: number; total_failures: number }>();

    // 最近の更新（成功/失敗）
    const recentUpdates = await db.prepare(`
      SELECT 
        event_type,
        domain,
        url,
        success,
        error_code,
        created_at
      FROM usage_events
      WHERE event_type IN ('CRAWL_SUCCESS', 'CRAWL_FAILURE', 'FIRECRAWL_SCRAPE')
      ORDER BY created_at DESC
      LIMIT 50
    `).all<{
      event_type: string; domain: string; url: string;
      success: number; error_code: string; created_at: string;
    }>();

    // subsidy_lifecycle 状況
    const lifecycleStats = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM subsidy_lifecycle
      GROUP BY status
    `).all<{ status: string; count: number }>();

    // Cron/Consumer 実行履歴
    const cronHistory = await db.prepare(`
      SELECT 
        event_type,
        success,
        duration_ms,
        created_at,
        metadata_json
      FROM usage_events
      WHERE event_type IN ('CRON_RUN', 'CONSUMER_RUN')
      ORDER BY created_at DESC
      LIMIT 20
    `).all<{
      event_type: string; success: number; duration_ms: number;
      created_at: string; metadata_json: string;
    }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        registry: registryStats.results || [],
        queue: queueStats.results || [],
        domains: domainStats.results || [],
        lifecycle: lifecycleStats.results || [],
        recent: recentUpdates.results || [],
        cronHistory: cronHistory.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Updates error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'UPDATES_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Agency KPI（superadmin向け）
// ============================================================

adminDashboard.get('/agency-kpi', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Agency 統計
    const agencyStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_agencies,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as new_agencies_month,
        SUM(CASE WHEN plan = 'pro' OR plan = 'enterprise' THEN 1 ELSE 0 END) as paid_agencies
      FROM agencies
    `).bind(monthAgo).first<{
      total_agencies: number;
      new_agencies_month: number;
      paid_agencies: number;
    }>();

    // 顧客企業統計
    const clientStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_clients,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_clients,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as new_clients_month
      FROM agency_clients
    `).bind(monthAgo).first<{
      total_clients: number;
      active_clients: number;
      new_clients_month: number;
    }>();

    // リンク発行統計
    const linkStats = await db.prepare(`
      SELECT 
        type,
        COUNT(*) as total,
        SUM(CASE WHEN date(created_at) = ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as week,
        SUM(used_count) as total_uses
      FROM access_links
      GROUP BY type
    `).bind(today, weekAgo).all<{
      type: string;
      total: number;
      today: number;
      week: number;
      total_uses: number;
    }>();

    // Intake 提出統計
    const intakeStats = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM intake_submissions
      GROUP BY status
    `).all<{ status: string; count: number }>();

    // 上位 Agency（顧客数順）
    const topAgencies = await db.prepare(`
      SELECT 
        a.id,
        a.name,
        a.plan,
        COUNT(ac.id) as client_count,
        (SELECT COUNT(*) FROM access_links al WHERE al.agency_id = a.id) as links_issued,
        (SELECT COUNT(*) FROM application_drafts ad 
         JOIN agency_clients ac2 ON ad.company_id = ac2.company_id 
         WHERE ac2.agency_id = a.id) as drafts_created
      FROM agencies a
      LEFT JOIN agency_clients ac ON a.id = ac.agency_id
      GROUP BY a.id
      ORDER BY client_count DESC
      LIMIT 10
    `).all<{
      id: string;
      name: string;
      plan: string;
      client_count: number;
      links_issued: number;
      drafts_created: number;
    }>();

    // 日別 Agency 活動
    const dailyActivity = await db.prepare(`
      SELECT 
        date(created_at) as date,
        'intake' as type,
        COUNT(*) as count
      FROM intake_submissions
      WHERE created_at >= ?
      GROUP BY date(created_at)
      UNION ALL
      SELECT 
        date(created_at) as date,
        'link' as type,
        COUNT(*) as count
      FROM access_links
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).bind(weekAgo, weekAgo).all<{ date: string; type: string; count: number }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        agencies: agencyStats,
        clients: clientStats,
        links: {
          byType: linkStats.results || [],
        },
        intake: {
          byStatus: Object.fromEntries((intakeStats.results || []).map(r => [r.status, r.count])),
        },
        topAgencies: topAgencies.results || [],
        dailyActivity: dailyActivity.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Agency KPI error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'AGENCY_KPI_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// データ鮮度監視（superadmin向け）
// ============================================================

adminDashboard.get('/data-freshness', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // ソース別の最終更新状況（本番スキーマ対応）
    const sourceStatus = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN last_crawl_status = 'error' OR last_crawl_status = 'blocked' THEN 1 ELSE 0 END) as error,
        MAX(last_crawled_at) as last_update,
        MIN(CASE WHEN enabled = 1 AND next_crawl_at < datetime('now') THEN next_crawl_at END) as overdue_since
      FROM source_registry
      GROUP BY scope
    `).all<{
      scope: string;
      total: number;
      active: number;
      error: number;
      last_update: string | null;
      overdue_since: string | null;
    }>();

    // 24時間以上更新がないソース（本番スキーマ対応）
    const staleSources = await db.prepare(`
      SELECT 
        registry_id as id,
        program_key as name,
        scope,
        CASE WHEN enabled = 1 THEN 'active' ELSE 'paused' END as status,
        last_crawled_at as last_crawl_at,
        next_crawl_at,
        last_crawl_status as last_error
      FROM source_registry
      WHERE enabled = 1
        AND (last_crawled_at IS NULL OR last_crawled_at < datetime('now', '-24 hours'))
      ORDER BY last_crawled_at ASC
      LIMIT 20
    `).all<{
      id: string;
      name: string;
      scope: string;
      status: string;
      last_crawl_at: string | null;
      next_crawl_at: string | null;
      last_error: string | null;
    }>();

    // 補助金データの鮮度
    const subsidyFreshness = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN date(cached_at) = date('now') THEN 1 ELSE 0 END) as updated_today,
        SUM(CASE WHEN date(cached_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week,
        MIN(cached_at) as oldest_update
      FROM subsidy_cache
      GROUP BY source
    `).all<{
      source: string;
      total: number;
      updated_today: number;
      updated_week: number;
      oldest_update: string | null;
    }>();

    // 最近のクロールエラー
    const recentErrors = await db.prepare(`
      SELECT 
        domain_key,
        url,
        status,
        last_error,
        attempts,
        finished_at
      FROM crawl_queue
      WHERE status = 'failed'
      ORDER BY finished_at DESC
      LIMIT 20
    `).all<{
      domain_key: string;
      url: string;
      status: string;
      last_error: string | null;
      attempts: number;
      finished_at: string | null;
    }>();

    // ドメイン別エラー率（本番スキーマ対応）
    const domainHealth = await db.prepare(`
      SELECT 
        domain_key,
        enabled,
        CASE WHEN blocked_until IS NOT NULL AND blocked_until > datetime('now') THEN 1 ELSE 0 END as blocked,
        blocked_until,
        blocked_reason,
        success_count,
        failure_count,
        CASE 
          WHEN (success_count + failure_count) > 0 
          THEN ROUND(CAST(failure_count AS REAL) / (success_count + failure_count) * 100, 2)
          ELSE 0 
        END as failure_rate
      FROM domain_policy
      WHERE failure_count > 0 OR (blocked_until IS NOT NULL AND blocked_until > datetime('now'))
      ORDER BY failure_rate DESC, failure_count DESC
      LIMIT 20
    `).all<{
      domain_key: string;
      enabled: number;
      blocked: number;
      blocked_until: string | null;
      blocked_reason: string | null;
      success_count: number;
      failure_count: number;
      failure_rate: number;
    }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        sources: sourceStatus.results || [],
        staleSources: staleSources.results || [],
        subsidyFreshness: subsidyFreshness.results || [],
        recentErrors: recentErrors.results || [],
        domainHealth: domainHealth.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Data freshness error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DATA_FRESHNESS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// アラート管理（superadmin向け）
// ============================================================

adminDashboard.get('/alerts', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // アラートルール一覧
    const rules = await db.prepare(`
      SELECT * FROM alert_rules ORDER BY enabled DESC, metric ASC
    `).all();

    // 最近のアラート履歴
    const recentAlerts = await db.prepare(`
      SELECT ah.*, ar.name as rule_name, ar.metric
      FROM alert_history ah
      JOIN alert_rules ar ON ah.rule_id = ar.id
      ORDER BY ah.created_at DESC
      LIMIT 50
    `).all();

    // 未解決のアラート数
    const unresolvedCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM alert_history
      WHERE status IN ('fired', 'acknowledged')
    `).first<{ count: number }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        rules: rules.results || [],
        recentAlerts: recentAlerts.results || [],
        unresolvedCount: unresolvedCount?.count || 0,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Alerts error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ALERTS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// 日次KPIスナップショット生成（内部用/Cron用）
// ============================================================

adminDashboard.post('/generate-daily-snapshot', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // 既存チェック
    const existing = await db.prepare(`
      SELECT id FROM kpi_daily_snapshots WHERE date = ?
    `).bind(yesterday).first();
    
    if (existing) {
      return c.json<ApiResponse<any>>({
        success: true,
        data: { message: 'Snapshot already exists', date: yesterday },
      });
    }

    // 各種統計を集計
    const [users, agencies, clients, searches, chats, drafts, intakes, links, costs, subsidies, crawl] = await Promise.all([
      // ユーザー
      db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE date(created_at) <= ?) as total,
          (SELECT COUNT(*) FROM users WHERE date(created_at) = ?) as new_users,
          (SELECT COUNT(DISTINCT user_id) FROM usage_events WHERE date(created_at) = ?) as active
        FROM (SELECT 1)
      `).bind(yesterday, yesterday, yesterday).first<{ total: number; new_users: number; active: number }>(),
      
      // Agency
      db.prepare(`SELECT COUNT(*) as count FROM agencies WHERE date(created_at) <= ?`).bind(yesterday).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) as count FROM agency_clients WHERE date(created_at) <= ?`).bind(yesterday).first<{ count: number }>(),
      
      // 検索
      db.prepare(`SELECT COUNT(*) as count FROM usage_events WHERE event_type = 'SUBSIDY_SEARCH' AND date(created_at) = ?`).bind(yesterday).first<{ count: number }>(),
      
      // チャット
      db.prepare(`
        SELECT 
          COUNT(DISTINCT cs.id) as sessions,
          COUNT(cm.id) as messages
        FROM chat_sessions cs
        LEFT JOIN chat_messages cm ON cs.id = cm.session_id AND date(cm.created_at) = ?
        WHERE date(cs.created_at) = ?
      `).bind(yesterday, yesterday).first<{ sessions: number; messages: number }>(),
      
      // ドラフト
      db.prepare(`
        SELECT 
          COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as created,
          COUNT(CASE WHEN status = 'final' AND date(updated_at) = ? THEN 1 END) as finalized
        FROM application_drafts
      `).bind(yesterday, yesterday).first<{ created: number; finalized: number }>(),
      
      // Intake
      db.prepare(`SELECT COUNT(*) as count FROM intake_submissions WHERE date(created_at) = ?`).bind(yesterday).first<{ count: number }>(),
      
      // リンク
      db.prepare(`SELECT COUNT(*) as count FROM access_links WHERE date(created_at) = ?`).bind(yesterday).first<{ count: number }>(),
      
      // コスト
      db.prepare(`
        SELECT 
          COALESCE(SUM(estimated_cost_usd), 0) as total,
          COALESCE(SUM(CASE WHEN provider = 'openai' THEN estimated_cost_usd ELSE 0 END), 0) as openai,
          COALESCE(SUM(CASE WHEN provider = 'firecrawl' THEN estimated_cost_usd ELSE 0 END), 0) as firecrawl
        FROM usage_events
        WHERE date(created_at) = ?
      `).bind(yesterday).first<{ total: number; openai: number; firecrawl: number }>(),
      
      // 補助金
      db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM subsidy_lifecycle
      `).first<{ total: number; active: number }>(),
      
      // クロール
      db.prepare(`
        SELECT 
          SUM(CASE WHEN status = 'done' AND date(finished_at) = ? THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' AND date(finished_at) = ? THEN 1 ELSE 0 END) as failed
        FROM crawl_queue
      `).bind(yesterday, yesterday).first<{ success: number; failed: number }>(),
    ]);

    // スナップショット挿入
    const snapshotId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO kpi_daily_snapshots (
        id, date, total_users, new_users, active_users, agency_users,
        searches, chat_sessions, chat_messages, drafts_created, drafts_finalized,
        total_agencies, total_clients, intake_submissions, links_issued,
        total_cost_usd, openai_cost_usd, firecrawl_cost_usd, other_cost_usd,
        subsidies_total, subsidies_active, crawl_success, crawl_failed, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshotId, yesterday,
      users?.total || 0, users?.new_users || 0, users?.active || 0, 0,
      searches?.count || 0, chats?.sessions || 0, chats?.messages || 0, drafts?.created || 0, drafts?.finalized || 0,
      agencies?.count || 0, clients?.count || 0, intakes?.count || 0, links?.count || 0,
      costs?.total || 0, costs?.openai || 0, costs?.firecrawl || 0, (costs?.total || 0) - (costs?.openai || 0) - (costs?.firecrawl || 0),
      subsidies?.total || 0, subsidies?.active || 0, crawl?.success || 0, crawl?.failed || 0,
      new Date().toISOString()
    ).run();

    return c.json<ApiResponse<any>>({
      success: true,
      data: { 
        message: 'Snapshot generated',
        date: yesterday,
        id: snapshotId,
      },
    });
  } catch (error) {
    console.error('Snapshot generation error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SNAPSHOT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// L1/L2/L3 網羅性チェック + 運用監視KPI（superadmin向け）
// ============================================================

adminDashboard.get('/coverage', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // ===================
    // キュー滞留チェック（Consumer生存確認）
    // ===================
    const queueStatus = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM crawl_queue
      GROUP BY status
    `).all<{ status: string; count: number }>();
    
    const queueByStatus: Record<string, number> = {};
    for (const row of queueStatus.results || []) {
      queueByStatus[row.status] = row.count;
    }

    // 最古のqueued（consumer停止検知）
    const oldestQueued = await db.prepare(`
      SELECT 
        MIN(created_at) as oldest_created,
        MIN(scheduled_at) as oldest_scheduled,
        COUNT(*) as total_queued
      FROM crawl_queue
      WHERE status = 'queued'
    `).first<{ oldest_created: string | null; oldest_scheduled: string | null; total_queued: number }>();

    // 直近24hのキュー処理統計
    const queue24h = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued
      FROM crawl_queue
      WHERE created_at >= datetime('now', '-1 day')
    `).first<{ total: number; done: number; failed: number; queued: number }>();

    const queueHealth = {
      by_status: queueByStatus,
      oldest_queued: oldestQueued,
      last_24h: queue24h,
      // queuedが増え続けてないか？（警告閾値：100件以上滞留）
      is_healthy: (queueByStatus['queued'] || 0) < 100,
      warning: (queueByStatus['queued'] || 0) >= 100 ? 'キュー滞留警告：' + queueByStatus['queued'] + '件が待機中' : null,
    };

    // ===================
    // ドメイン別エラー率Top20（失敗が多いドメイン）
    // ===================
    const domainErrorsTop = await db.prepare(`
      SELECT 
        domain_key,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as failed_pct,
        MAX(finished_at) as last_activity
      FROM crawl_queue
      WHERE created_at >= datetime('now', '-7 day')
      GROUP BY domain_key
      HAVING COUNT(*) >= 3
      ORDER BY failed_pct DESC, failed DESC
      LIMIT 20
    `).all<{
      domain_key: string;
      total: number;
      failed: number;
      done: number;
      failed_pct: number;
      last_activity: string | null;
    }>();

    // ===================
    // 同じURL叩きすぎ検知（無駄クロール）
    // 本番スキーマ: source_idカラムを使用
    // ===================
    const duplicateCrawls = await db.prepare(`
      SELECT 
        source_registry_id,
        url,
        COUNT(*) as cnt
      FROM crawl_queue
      WHERE created_at >= datetime('now', '-7 day')
      GROUP BY source_registry_id, url
      HAVING cnt >= 5
      ORDER BY cnt DESC
      LIMIT 20
    `).all<{ source_registry_id: string | null; url: string; cnt: number }>();

    // ===================
    // L1: 入口網羅性（source_registry × geo_id）
    // ===================
    // 47都道府県のソースが登録されているか（本番スキーマ: geo_idカラムを使用）
    const l1_registered = await db.prepare(`
      SELECT 
        geo_id as geo_region,
        scope,
        COUNT(*) as source_count,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_count
      FROM source_registry
      WHERE geo_id IS NOT NULL
      GROUP BY geo_id, scope
      ORDER BY geo_id, scope
    `).all<{
      geo_region: string;
      scope: string;
      source_count: number;
      enabled_count: number;
    }>();

    // 登録されていない都道府県を検出
    const allPrefectures = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
      '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
      '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
      '41', '42', '43', '44', '45', '46', '47'
    ];
    const registeredGeoRegions = new Set((l1_registered.results || []).map(r => r.geo_region));
    const missingPrefectures = allPrefectures.filter(p => !registeredGeoRegions.has(p));
    const coveredPrefectures = allPrefectures.filter(p => registeredGeoRegions.has(p));

    // A-1 台帳揃いの正確なカウント（prefecture/secretariat/national を正しく区別）
    const registryCounts = await db.prepare(`
      SELECT
        SUM(CASE WHEN scope='prefecture' THEN 1 ELSE 0 END) AS prefecture,
        SUM(CASE WHEN registry_id LIKE 'sec-%' THEN 1 ELSE 0 END) AS secretariat,
        SUM(CASE WHEN scope='national' AND registry_id NOT LIKE 'sec-%' THEN 1 ELSE 0 END) AS national
      FROM source_registry
      WHERE enabled=1;
    `).first<{ prefecture: number; secretariat: number; national: number }>();

    const l1 = {
      total_prefectures: 47,
      registered_prefectures: coveredPrefectures.length,
      missing_prefectures: missingPrefectures,
      missing_count: missingPrefectures.length,
      coverage_rate: Math.round((coveredPrefectures.length / 47) * 100),
      by_region: l1_registered.results || [],
      registry_counts: registryCounts || { prefecture: 0, secretariat: 0, national: 0 },
    };

    // ===================
    // L2: 実稼働網羅性（実際にクロールが回っているか）
    // 本番スキーマ: registry_id, geo_id, source_registry_id
    // ===================
    const l2_activity = await db.prepare(`
      SELECT 
        sr.geo_id as geo_region,
        sr.scope,
        COUNT(DISTINCT sr.registry_id) as sources,
        COUNT(DISTINCT cq.queue_id) as queue_items,
        SUM(CASE WHEN cq.status = 'done' THEN 1 ELSE 0 END) as done_count,
        SUM(CASE WHEN cq.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        MAX(cq.finished_at) as last_crawl
      FROM source_registry sr
      LEFT JOIN crawl_queue cq ON sr.registry_id = cq.source_registry_id AND cq.created_at >= datetime('now', '-7 day')
      WHERE sr.geo_id IS NOT NULL
      GROUP BY sr.geo_id, sr.scope
      ORDER BY done_count ASC
    `).all<{
      geo_region: string;
      scope: string;
      sources: number;
      queue_items: number;
      done_count: number;
      failed_count: number;
      last_crawl: string | null;
    }>();

    // 7日間クロールなしの地域（本番スキーマ対応）
    const staleRegions = await db.prepare(`
      SELECT 
        geo_id as geo_region,
        MAX(last_crawled_at) as last_crawl,
        ROUND(julianday('now') - julianday(MAX(last_crawled_at))) as days_since
      FROM source_registry
      WHERE geo_id IS NOT NULL AND enabled = 1
      GROUP BY geo_id
      HAVING MAX(last_crawled_at) < datetime('now', '-7 days') OR MAX(last_crawled_at) IS NULL
      ORDER BY last_crawl ASC
    `).all<{
      geo_region: string;
      last_crawl: string | null;
      days_since: number | null;
    }>();

    const l2 = {
      activity_by_region: l2_activity.results || [],
      stale_regions: staleRegions.results || [],
      stale_count: (staleRegions.results || []).length,
    };

    // ===================
    // L3: 制度網羅性（補助金データの状態）
    // ===================
    const l3_subsidies = await db.prepare(`
      SELECT 
        COALESCE(target_area_search, 'unknown') as region,
        COUNT(*) as total,
        SUM(CASE WHEN request_reception_display_flag = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN acceptance_end_datetime < datetime('now') THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN date(cached_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week
      FROM subsidy_cache
      GROUP BY target_area_search
      ORDER BY total DESC
    `).all<{
      region: string;
      total: number;
      active: number;
      expired: number;
      updated_week: number;
    }>();

    // 補助金の更新状況サマリー
    const l3_summary = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN request_reception_display_flag = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN date(cached_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_week,
        SUM(CASE WHEN date(cached_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week,
        MIN(cached_at) as oldest_update,
        MAX(cached_at) as latest_update
      FROM subsidy_cache
    `).first<{
      total: number;
      active: number;
      new_week: number;
      updated_week: number;
      oldest_update: string | null;
      latest_update: string | null;
    }>();

    const l3 = {
      summary: l3_summary,
      by_region: l3_subsidies.results || [],
    };

    // ===================
    // 総合スコア算出
    // ===================
    const overallScore = {
      l1_score: l1.coverage_rate,
      l2_score: Math.max(0, 100 - (l2.stale_count * 5)), // stale 1つにつき-5点
      l3_score: l3_summary ? Math.round(((l3_summary.active || 0) / Math.max(l3_summary.total || 1, 1)) * 100) : 0,
      total: 0,
    };
    overallScore.total = Math.round((overallScore.l1_score + overallScore.l2_score + overallScore.l3_score) / 3);

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        // 運用監視（最重要）
        queue_health: queueHealth,
        domain_errors_top: domainErrorsTop.results || [],
        duplicate_crawls: duplicateCrawls.results || [],
        
        // 網羅性スコア
        score: overallScore,
        l1_entry_coverage: l1,
        l2_crawl_coverage: l2,
        l3_data_coverage: l3,
        
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Coverage check error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'COVERAGE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// KPI履歴取得
// ============================================================

adminDashboard.get('/kpi-history', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const days = Math.min(parseInt(c.req.query('days') || '30'), 365);
    
    const snapshots = await db.prepare(`
      SELECT * FROM kpi_daily_snapshots
      WHERE date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `).bind(days).all();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        snapshots: snapshots.results || [],
        days,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('KPI history error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'KPI_HISTORY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// ユーザー会社紐づけ診断API（superadmin向け）
// ブラウザなしで「会社が選べない」問題を1発診断
// ============================================================

adminDashboard.get('/debug/company-check', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  const email = c.req.query('email');
  if (!email) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'email query parameter required',
      },
    }, 400);
  }

  try {
    // 1. ユーザー存在確認
    const targetUser = await db.prepare(`
      SELECT id, email, name, role, created_at, last_login_at
      FROM users 
      WHERE email = ?
    `).bind(email).first<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      created_at: string;
      last_login_at: string | null;
    }>();

    if (!targetUser) {
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          diagnosis: 'USER_NOT_FOUND',
          message: 'ユーザーが存在しません',
          email,
          user: null,
          memberships: [],
          companies: [],
          api_simulation: null,
        },
      });
    }

    // 2. メンバーシップ確認
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const memberships = await db.prepare(`
      SELECT 
        uc.user_id || '-' || uc.company_id as membership_id,
        uc.company_id,
        uc.role as membership_role,
        uc.joined_at as membership_created
      FROM user_companies uc
      WHERE uc.user_id = ?
      ORDER BY uc.joined_at DESC
    `).bind(targetUser.id).all<{
      membership_id: string;
      company_id: string;
      membership_role: string;
      membership_created: string;
    }>();

    // 3. 紐づいている会社の詳細
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const companies = await db.prepare(`
      SELECT 
        c.*,
        uc.role as membership_role
      FROM companies c
      INNER JOIN user_companies uc ON c.id = uc.company_id
      WHERE uc.user_id = ?
      ORDER BY c.created_at DESC
    `).bind(targetUser.id).all<{
      id: string;
      name: string;
      postal_code: string | null;
      prefecture: string;
      city: string | null;
      industry_major: string;
      industry_minor: string | null;
      employee_count: number;
      employee_band: string;
      capital: number | null;
      established_date: string | null;
      annual_revenue: number | null;
      created_at: string;
      updated_at: string;
      membership_role: string;
    }>();

    // 4. UI判定シミュレーション（同じロジックで検査）
    const apiSimulation = {
      would_return_companies: (companies.results?.length || 0) > 0,
      companies_count: companies.results?.length || 0,
      searchable_companies: [] as any[],
      non_searchable_companies: [] as any[],
    };

    for (const company of companies.results || []) {
      const hasName = !!(company.name && company.name.trim());
      const hasPref = !!(company.prefecture && company.prefecture.trim());
      const hasIndustry = !!((company.industry_major && company.industry_major.trim()));
      const hasEmployees = company.employee_count !== null && 
                          company.employee_count !== undefined && 
                          Number(company.employee_count) > 0;
      const isSearchable = hasName && hasPref && hasIndustry && hasEmployees;

      const companyCheck = {
        id: company.id,
        name: company.name,
        prefecture: company.prefecture,
        industry_major: company.industry_major,
        employee_count: company.employee_count,
        employee_count_type: typeof company.employee_count,
        checks: {
          hasName,
          hasPref,
          hasIndustry,
          hasEmployees,
        },
        isSearchable,
      };

      if (isSearchable) {
        apiSimulation.searchable_companies.push(companyCheck);
      } else {
        const missing: string[] = [];
        if (!hasName) missing.push('会社名');
        if (!hasPref) missing.push('都道府県');
        if (!hasIndustry) missing.push('業種');
        if (!hasEmployees) missing.push('従業員数');
        apiSimulation.non_searchable_companies.push({
          ...companyCheck,
          missing_fields: missing,
        });
      }
    }

    // 5. 診断結果
    let diagnosis: string;
    let message: string;

    if (!memberships.results || memberships.results.length === 0) {
      diagnosis = 'NO_MEMBERSHIP';
      message = 'ユーザーに会社メンバーシップがありません。/api/companies は空を返します。';
    } else if (apiSimulation.searchable_companies.length === 0) {
      diagnosis = 'COMPANIES_INCOMPLETE';
      message = '会社はありますが、必須4項目（会社名/都道府県/業種/従業員数）が不完全です。';
    } else {
      diagnosis = 'OK';
      message = `検索可能な会社が ${apiSimulation.searchable_companies.length} 件あります。UIの問題（localStorage/キャッシュ）の可能性があります。`;
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        diagnosis,
        message,
        email,
        user: targetUser,
        memberships: memberships.results || [],
        companies: companies.results || [],
        api_simulation: apiSimulation,
        recommendation: diagnosis === 'OK' 
          ? 'ユーザーにブラウザの localStorage クリア（Ctrl+Shift+Delete → "すべての期間"）を依頼してください' 
          : diagnosis === 'NO_MEMBERSHIP'
          ? '会社を作成するか、既存の会社に招待してください'
          : '会社情報ページで不足項目を入力してください',
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Company check error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'COMPANY_CHECK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// データ健全性チェック（subsidy_cache）
// ============================================================

/**
 * GET /api/admin/ops/data-health
 * 
 * 補助金データの健全性メトリクスを返す
 * 凍結チェックリスト v1.0 に基づく指標
 */
adminDashboard.get('/ops/data-health', async (c) => {
  const db = c.env.DB;
  
  try {
    // A. 総数・有効・主要欠損（最重要）
    const mainStats = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN request_reception_display_flag = 1 THEN 1 ELSE 0 END) AS accepting_flag_1,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL THEN 1 ELSE 0 END) AS has_deadline,
        SUM(CASE WHEN target_area_search IS NOT NULL AND target_area_search != '' THEN 1 ELSE 0 END) AS has_area,
        SUM(CASE WHEN subsidy_max_limit IS NOT NULL AND subsidy_max_limit > 0 THEN 1 ELSE 0 END) AS has_amount,
        SUM(CASE WHEN target_industry IS NOT NULL AND target_industry != '' THEN 1 ELSE 0 END) AS has_industry
      FROM subsidy_cache
    `).first<{
      total: number;
      valid: number;
      accepting_flag_1: number;
      has_deadline: number;
      has_area: number;
      has_amount: number;
      has_industry: number;
    }>();
    
    // B. 期限切れ（混入監視）
    const expiredCount = await db.prepare(`
      SELECT COUNT(*) AS expired
      FROM subsidy_cache
      WHERE acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime < datetime('now')
    `).first<{ expired: number }>();
    
    // C. 直近24時間の更新（cronが回った証拠）
    const recentUpdate = await db.prepare(`
      SELECT COUNT(*) AS updated_last_24h
      FROM subsidy_cache
      WHERE cached_at >= datetime('now', '-24 hours')
    `).first<{ updated_last_24h: number }>();
    
    // D. ソース別（JGrants / manual / crawl の比率）
    const bySource = await db.prepare(`
      SELECT source, COUNT(*) AS cnt
      FROM subsidy_cache
      GROUP BY source
      ORDER BY cnt DESC
    `).all();
    
    // E. キャッシュ期限の範囲
    const cacheRange = await db.prepare(`
      SELECT 
        MIN(cached_at) AS oldest_cache,
        MAX(cached_at) AS newest_cache,
        MIN(expires_at) AS earliest_expiry,
        MAX(expires_at) AS latest_expiry
      FROM subsidy_cache
    `).first<{
      oldest_cache: string;
      newest_cache: string;
      earliest_expiry: string;
      latest_expiry: string;
    }>();
    
    // F. 壊れURLの検出（example.com混入チェック）
    const brokenLinks = await db.prepare(`
      SELECT COUNT(*) AS broken_count
      FROM subsidy_cache
      WHERE detail_json LIKE '%example.com%'
    `).first<{ broken_count: number }>();
    
    // G. 最終同期からの経過時間
    const lastSync = await db.prepare(`
      SELECT MAX(cached_at) AS last_sync
      FROM subsidy_cache
    `).first<{ last_sync: string }>();
    
    // 凍結基準に基づく健全性判定
    const total = mainStats?.total || 0;
    const valid = mainStats?.valid || 0;
    const hasDeadline = mainStats?.has_deadline || 0;
    const hasArea = mainStats?.has_area || 0;
    const hasAmount = mainStats?.has_amount || 0;
    const hasIndustry = mainStats?.has_industry || 0;
    const updated24h = recentUpdate?.updated_last_24h || 0;
    
    const health = {
      // 凍結目標値
      targets: {
        total_target: 500,
        deadline_target_pct: 95,
        area_target_pct: 95,
        amount_target_pct: 80,
        industry_note: '業種条件はJGrants元データの問題。空=全業種扱いで対応済み',
      },
      
      // 現在値
      current: {
        total,
        valid,
        accepting: mainStats?.accepting_flag_1 || 0,
        has_deadline: hasDeadline,
        has_area: hasArea,
        has_amount: hasAmount,
        has_industry: hasIndustry,
        expired_subsidies: expiredCount?.expired || 0,
        updated_last_24h: updated24h,
        broken_links: brokenLinks?.broken_count || 0,
        last_sync: lastSync?.last_sync || null,
      },
      
      // 充足率（%）
      percentages: {
        valid_pct: total > 0 ? Math.round((valid / total) * 100) : 0,
        deadline_pct: total > 0 ? Math.round((hasDeadline / total) * 100) : 0,
        area_pct: total > 0 ? Math.round((hasArea / total) * 100) : 0,
        amount_pct: total > 0 ? Math.round((hasAmount / total) * 100) : 0,
        industry_pct: total > 0 ? Math.round((hasIndustry / total) * 100) : 0,
        total_progress_pct: Math.round((total / 500) * 100),
      },
      
      // ステータス判定
      status: {
        total_ok: total >= 500,
        deadline_ok: total > 0 && (hasDeadline / total) >= 0.95,
        area_ok: total > 0 && (hasArea / total) >= 0.95,
        amount_ok: total > 0 && (hasAmount / total) >= 0.80,
        cron_ok: updated24h > 0,
        broken_links_ok: (brokenLinks?.broken_count || 0) === 0,
        overall: total >= 500 && updated24h > 0 && (brokenLinks?.broken_count || 0) === 0 
          ? 'HEALTHY' 
          : total >= 100 
            ? 'BUILDING' 
            : 'CRITICAL',
      },
      
      // ソース別
      by_source: bySource.results || [],
      
      // キャッシュ範囲
      cache_range: cacheRange,
      
      // 生成時刻
      generated_at: new Date().toISOString(),
    };
    
    return c.json<ApiResponse<typeof health>>({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Data health check error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DATA_HEALTH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin/ops/trigger-sync
 * 
 * 手動でJGrants同期をトリガー（super_admin専用）
 * ops画面から「今すぐ同期」ボタンで使う
 */
adminDashboard.post('/ops/trigger-sync', async (c) => {
  const user = getCurrentUser(c);
  
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }
  
  // 内部的に cron エンドポイントと同じ処理を実行（v1.3: 受付終了含む）
  const db = c.env.DB;
  
  try {
    // 凍結キーワードセット（v1.3）- cron.ts と同一
    const KEYWORDS = [
      '補助金', '助成金', '事業', '支援', '申請', '公募',
      'DX', 'IT導入', '省エネ', '雇用', '設備投資',
      '製造業', 'デジタル化', '創業', '販路開拓', '人材育成', '研究開発', '生産性向上',
      '中小企業', '小規模事業者', '新事業', '海外展開', '輸出', '観光', '農業',
      '介護', '福祉', '環境', 'カーボンニュートラル', '脱炭素', 'ものづくり', 'サービス',
      'ECサイト', 'テレワーク', 'AI', 'IoT', 'クラウド', '情報化',
      '感染症対策', '賃上げ', '最低賃金', '事業承継', '再構築', '経営革新', '働き方改革',
      '地域活性化', '商店街', '中心市街地', '地方創生', '産業振興',
      '省力化', '自動化', '機械化', '建設', '建築',
    ];
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>();
    const errors: string[] = [];
    
    // v1.3改善: 受付中と受付終了の両方を取得
    const acceptanceFlags = ['1', '0']; // 1=受付中, 0=受付終了
    
    for (const acceptance of acceptanceFlags) {
      for (const keyword of KEYWORDS) {
        try {
          const params = new URLSearchParams({
            keyword,
            sort: 'acceptance_end_datetime',
            order: 'DESC',
            acceptance,
            limit: '200',
          });
          
          const response = await fetch(`${JGRANTS_API_URL}?${params.toString()}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          
          if (!response.ok) {
            errors.push(`${keyword}(acc=${acceptance}): API ${response.status}`);
            continue;
          }
          
          const data = await response.json() as any;
          const subsidies = data.result || data.subsidies || data.data || [];
          
          const uniqueSubsidies = subsidies.filter((s: any) => {
            if (seenIds.has(s.id)) return false;
            seenIds.add(s.id);
            return true;
          });
          
          if (uniqueSubsidies.length > 0) {
            const statements = uniqueSubsidies.map((s: any) => {
              // detail_json に元データを保存
              const detailJson = JSON.stringify({
                subsidy_application_url: s.subsidy_application_url || null,
                subsidy_application_address: s.subsidy_application_address || null,
                target_detail: s.target_detail || null,
                usage_detail: s.usage_detail || null,
                subsidy_rate_detail: s.subsidy_rate_detail || null,
                subsidy_max_limit_detail: s.subsidy_max_limit_detail || null,
                acceptance_number_detail: s.acceptance_number_detail || null,
                contact: s.contact || null,
                crawled_at: new Date().toISOString(),
              });
              
              return db.prepare(`
                INSERT OR REPLACE INTO subsidy_cache 
                (id, source, title, subsidy_max_limit, subsidy_rate,
                 target_area_search, target_industry, target_number_of_employees,
                 acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
                 detail_json, cached_at, expires_at)
                VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
              `).bind(
                s.id,
                s.title || s.name || '',
                s.subsidy_max_limit || null,
                s.subsidy_rate || null,
                s.target_area_search || null,
                s.target_industry || null,
                s.target_number_of_employees || null,
                s.acceptance_start_datetime || null,
                s.acceptance_end_datetime || null,
                s.request_reception_display_flag ?? (acceptance === '1' ? 1 : 0),
                detailJson,
                expiresAt
              );
            });
            
            for (let i = 0; i < statements.length; i += 100) {
              const batch = statements.slice(i, i + 100);
              await db.batch(batch);
            }
          }
          
          totalFetched += subsidies.length;
          totalInserted += uniqueSubsidies.length;
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          errors.push(`${keyword}(acc=${acceptance}): ${String(err)}`);
        }
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      total_fetched: number;
      total_inserted: number;
      unique_count: number;
      errors: string[];
      triggered_by: string;
      timestamp: string;
    }>>({
      success: true,
      data: {
        message: 'Manual sync completed',
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        errors,
        triggered_by: user.email,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Daily Data Report（運用観測用）
// ============================================================

/**
 * 例外分類定数（凍結）
 * timeout: リクエストタイムアウト
 * blocked: ブロック/WAF/403
 * login_required: ログイン必須
 * scan_pdf: スキャンPDFでOCR失敗
 * schema_mismatch: 抽出スキーマ不一致
 * encrypted_pdf: 暗号化PDF
 * pdf_too_large: PDFサイズ超過
 * url_404: URL変更/リンク切れ
 */
const EXCEPTION_TYPES = {
  TIMEOUT: 'timeout',
  BLOCKED: 'blocked',
  LOGIN_REQUIRED: 'login_required',
  SCAN_PDF: 'scan_pdf',
  SCHEMA_MISMATCH: 'schema_mismatch',
  ENCRYPTED_PDF: 'encrypted_pdf',
  PDF_TOO_LARGE: 'pdf_too_large',
  URL_404: 'url_404',
} as const;

/**
 * GET /api/admin/ops/daily-report
 * 
 * Daily Data Report 生成（コピペ用テキスト付き）
 * 毎日の収集結果を定型レポートで提出
 */
adminDashboard.get('/ops/daily-report', async (c) => {
  const db = c.env.DB;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  try {
    // 1) KPI サマリー
    const subsidyKpi = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL THEN 1 ELSE 0 END) AS has_deadline,
        SUM(CASE WHEN target_area_search IS NOT NULL AND target_area_search != '' THEN 1 ELSE 0 END) AS has_area,
        SUM(CASE WHEN subsidy_max_limit IS NOT NULL AND subsidy_max_limit > 0 THEN 1 ELSE 0 END) AS has_amount,
        SUM(CASE WHEN detail_json LIKE '%example.com%' THEN 1 ELSE 0 END) AS broken_links,
        MAX(cached_at) AS last_sync
      FROM subsidy_cache
    `).first<{
      total: number;
      valid: number;
      has_deadline: number;
      has_area: number;
      has_amount: number;
      broken_links: number;
      last_sync: string;
    }>();
    
    // ドキュメント統計（テーブルが存在する場合）
    let docsKpi = { total: 0 };
    try {
      const docsResult = await db.prepare(`SELECT COUNT(*) AS total FROM subsidy_documents`).first<{ total: number }>();
      docsKpi = docsResult || { total: 0 };
    } catch (e) {
      // テーブル未作成の場合は0
    }
    
    // OCRキュー統計
    let ocrKpi = { queued: 0, processing: 0, done: 0, failed: 0 };
    try {
      const ocrResult = await db.prepare(`
        SELECT status, COUNT(*) AS cnt FROM ocr_queue GROUP BY status
      `).all<{ status: string; cnt: number }>();
      for (const row of ocrResult.results || []) {
        if (row.status === 'pending') ocrKpi.queued = row.cnt;
        else if (row.status === 'processing') ocrKpi.processing = row.cnt;
        else if (row.status === 'completed') ocrKpi.done = row.cnt;
        else if (row.status === 'failed') ocrKpi.failed = row.cnt;
      }
    } catch (e) {
      // テーブル未作成
    }
    
    // 抽出結果統計
    let extractionKpi = { ok: 0, failed: 0, top_errors: [] as string[] };
    try {
      const extractionResult = await db.prepare(`
        SELECT 
          SUM(CASE WHEN extraction_status = 'completed' THEN 1 ELSE 0 END) AS ok,
          SUM(CASE WHEN extraction_status = 'failed' THEN 1 ELSE 0 END) AS failed
        FROM extraction_results
      `).first<{ ok: number; failed: number }>();
      extractionKpi.ok = extractionResult?.ok || 0;
      extractionKpi.failed = extractionResult?.failed || 0;
    } catch (e) {
      // テーブル未作成
    }
    
    // ソース統計
    const sourcesKpi = await db.prepare(`
      SELECT 
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled
      FROM source_registry
    `).first<{ active: number; disabled: number }>() || { active: 0, disabled: 0 };
    
    // 2) 今日の増分（差分）
    const todayDiff = await db.prepare(`
      SELECT
        SUM(CASE WHEN DATE(cached_at) = ? THEN 1 ELSE 0 END) AS new_today,
        SUM(CASE WHEN DATE(cached_at) = ? AND id IN (SELECT id FROM subsidy_cache WHERE DATE(cached_at) < ?) THEN 1 ELSE 0 END) AS updated_today
      FROM subsidy_cache
    `).bind(today, today, today).first<{ new_today: number; updated_today: number }>();
    
    // 終了した補助金
    const expiredToday = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM subsidy_cache 
      WHERE DATE(acceptance_end_datetime) = ?
    `).bind(today).first<{ cnt: number }>();
    
    // 3) 例外（要対応）- crawl_queue から
    let exceptions = {
      url_404: 0,
      timeout: 0,
      blocked: 0,
      login_required: 0,
      scan_pdf: 0,
      schema_mismatch: 0,
      encrypted_pdf: 0,
      pdf_too_large: 0,
      top_failures: [] as Array<{ source_id: string; url: string; error: string }>,
    };
    
    try {
      const failedJobs = await db.prepare(`
        SELECT 
          source_registry_id, url, last_error
        FROM crawl_queue 
        WHERE status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 10
      `).all<{ source_registry_id: string; url: string; last_error: string }>();
      
      exceptions.top_failures = (failedJobs.results || []).map(r => ({
        source_id: r.source_registry_id || 'unknown',
        url: r.url,
        error: r.last_error || 'unknown',
      }));
      
      // エラータイプ別カウント
      const errorCounts = await db.prepare(`
        SELECT 
          CASE 
            WHEN last_error LIKE '%timeout%' THEN 'timeout'
            WHEN last_error LIKE '%403%' OR last_error LIKE '%blocked%' THEN 'blocked'
            WHEN last_error LIKE '%login%' OR last_error LIKE '%401%' THEN 'login_required'
            WHEN last_error LIKE '%404%' THEN 'url_404'
            ELSE 'other'
          END AS error_type,
          COUNT(*) AS cnt
        FROM crawl_queue
        WHERE status = 'failed'
        GROUP BY error_type
      `).all<{ error_type: string; cnt: number }>();
      
      for (const row of errorCounts.results || []) {
        if (row.error_type === 'timeout') exceptions.timeout = row.cnt;
        else if (row.error_type === 'blocked') exceptions.blocked = row.cnt;
        else if (row.error_type === 'login_required') exceptions.login_required = row.cnt;
        else if (row.error_type === 'url_404') exceptions.url_404 = row.cnt;
      }
    } catch (e) {
      // テーブル未作成
    }
    
    // ソース別件数
    const bySource = await db.prepare(`
      SELECT source, COUNT(*) AS cnt FROM subsidy_cache GROUP BY source ORDER BY cnt DESC
    `).all<{ source: string; cnt: number }>();
    
    // 直近24h新規（ソース別）
    const newBySource24h = await db.prepare(`
      SELECT source, COUNT(*) AS cnt 
      FROM subsidy_cache 
      WHERE cached_at >= datetime('now', '-24 hours')
      GROUP BY source ORDER BY cnt DESC
    `).all<{ source: string; cnt: number }>();
    
    // 率の計算
    const total = subsidyKpi?.total || 0;
    const validRate = total > 0 ? Math.round(((subsidyKpi?.valid || 0) / total) * 100) : 0;
    const deadlineRate = total > 0 ? Math.round(((subsidyKpi?.has_deadline || 0) / total) * 100) : 0;
    const areaRate = total > 0 ? Math.round(((subsidyKpi?.has_area || 0) / total) * 100) : 0;
    const amountRate = total > 0 ? Math.round(((subsidyKpi?.has_amount || 0) / total) * 100) : 0;
    
    // テキストレポート生成（コピペ用）
    const textReport = `【Daily Data Report】${today}

1) KPI
- subsidy_cache.total: ${total}（目標: 500→1000）
- subsidy_cache.valid_rate(expires_at>now): ${validRate}%
- has_deadline: ${deadlineRate}%
- has_area: ${areaRate}%
- has_amount: ${amountRate}%（目標: 80%）
- broken_links: ${subsidyKpi?.broken_links || 0}件
- last_sync: ${subsidyKpi?.last_sync || 'N/A'}
- docs.total(PDF等): ${docsKpi.total}
- ocr_queue: queued ${ocrKpi.queued} / processing ${ocrKpi.processing} / done ${ocrKpi.done} / failed ${ocrKpi.failed}
- extraction_results: ok ${extractionKpi.ok} / failed ${extractionKpi.failed}
- sources.active: ${sourcesKpi.active} / sources.disabled: ${sourcesKpi.disabled}

2) 今日の増分（差分）
- 新規補助金: ${todayDiff?.new_today || 0}
- 更新（再取得）: ${todayDiff?.updated_today || 0}
- 終了/受付終了: ${expiredToday?.cnt || 0}
- URL変更/404: ${exceptions.url_404}

3) 例外（要対応）
- 404/リンク切れ: ${exceptions.url_404}件
- 取得失敗: ${exceptions.timeout + exceptions.blocked + exceptions.login_required}件
  - timeout: ${exceptions.timeout}
  - blocked: ${exceptions.blocked}
  - login_required: ${exceptions.login_required}

4) ソース別件数
${(bySource.results || []).map(r => `- ${r.source}: ${r.cnt}件`).join('\n')}

5) 直近24h新規（ソース別）
${(newBySource24h.results || []).map(r => `- ${r.source}: ${r.cnt}件`).join('\n') || '- なし'}

---
Generated: ${new Date().toISOString()}`;
    
    return c.json<ApiResponse<{
      date: string;
      kpi: {
        subsidy_cache: {
          total: number;
          valid: number;
          valid_rate_pct: number;
          has_deadline_pct: number;
          has_area_pct: number;
          has_amount_pct: number;
          broken_links: number;
          last_sync: string | null;
        };
        documents: { total: number };
        ocr_queue: typeof ocrKpi;
        extraction: typeof extractionKpi;
        sources: typeof sourcesKpi;
      };
      diff: {
        new_today: number;
        updated_today: number;
        expired_today: number;
        url_404: number;
      };
      exceptions: typeof exceptions;
      by_source: Array<{ source: string; cnt: number }>;
      new_by_source_24h: Array<{ source: string; cnt: number }>;
      text_report: string;
      generated_at: string;
    }>>({
      success: true,
      data: {
        date: today,
        kpi: {
          subsidy_cache: {
            total,
            valid: subsidyKpi?.valid || 0,
            valid_rate_pct: validRate,
            has_deadline_pct: deadlineRate,
            has_area_pct: areaRate,
            has_amount_pct: amountRate,
            broken_links: subsidyKpi?.broken_links || 0,
            last_sync: subsidyKpi?.last_sync || null,
          },
          documents: docsKpi,
          ocr_queue: ocrKpi,
          extraction: extractionKpi,
          sources: sourcesKpi,
        },
        diff: {
          new_today: todayDiff?.new_today || 0,
          updated_today: todayDiff?.updated_today || 0,
          expired_today: expiredToday?.cnt || 0,
          url_404: exceptions.url_404,
        },
        exceptions,
        by_source: bySource.results || [],
        new_by_source_24h: newBySource24h.results || [],
        text_report: textReport,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Daily report error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DAILY_REPORT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin/ops/source-summary
 * 
 * source_registry の網羅性サマリー
 */
adminDashboard.get('/ops/source-summary', async (c) => {
  const db = c.env.DB;
  
  try {
    // スコープ別統計
    const byScope = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) AS total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled
      FROM source_registry
      GROUP BY scope
      ORDER BY total DESC
    `).all<{ scope: string; total: number; enabled: number; disabled: number }>();
    
    // 都道府県カバー率
    const prefectures = await db.prepare(`
      SELECT DISTINCT geo_id FROM source_registry WHERE scope = 'prefecture' AND geo_id IS NOT NULL
    `).all<{ geo_id: string }>();
    const coveredPrefectures = (prefectures.results || []).map(r => r.geo_id);
    const allPrefectures = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, '0'));
    const missingPrefectures = allPrefectures.filter(p => !coveredPrefectures.includes(p));
    
    // ソース別 subsidy_cache 件数
    const subsidyBySource = await db.prepare(`
      SELECT 
        sr.registry_id,
        sr.scope,
        sr.geo_id,
        sr.notes,
        sr.enabled,
        COUNT(sc.id) AS subsidy_count
      FROM source_registry sr
      LEFT JOIN subsidy_cache sc ON sc.source = sr.registry_id
      GROUP BY sr.registry_id
      ORDER BY subsidy_count DESC
    `).all<{
      registry_id: string;
      scope: string;
      geo_id: string;
      notes: string;
      enabled: number;
      subsidy_count: number;
    }>();
    
    return c.json<ApiResponse<{
      by_scope: Array<{ scope: string; total: number; enabled: number; disabled: number }>;
      prefecture_coverage: {
        covered: number;
        total: number;
        coverage_pct: number;
        missing: string[];
      };
      sources_with_subsidies: Array<{
        registry_id: string;
        scope: string;
        geo_id: string;
        notes: string;
        enabled: number;
        subsidy_count: number;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        by_scope: byScope.results || [],
        prefecture_coverage: {
          covered: coveredPrefectures.length,
          total: 47,
          coverage_pct: Math.round((coveredPrefectures.length / 47) * 100),
          missing: missingPrefectures,
        },
        sources_with_subsidies: subsidyBySource.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Source summary error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SOURCE_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// P3-2A: Cron運用監視API（cron_runs + feed_failures）
// ============================================================

/**
 * GET /api/admin-ops/cron-status
 * 
 * Cron実行状況のサマリー（東京3ソース）
 * - 直近7日間のジョブ別成功/失敗
 * - 24時間以内に成功があるか（健全性チェック）
 * - 最新の実行結果
 */
adminDashboard.get('/cron-status', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // 健全性チェック（24h以内に成功があるか）
    const healthCheck = await db.prepare(`
      SELECT 
        job_type,
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        MAX(started_at) as last_run,
        MAX(CASE WHEN status = 'success' THEN started_at END) as last_success,
        MAX(CASE WHEN status = 'failed' THEN started_at END) as last_failure,
        CASE 
          WHEN MAX(CASE WHEN status = 'success' THEN started_at END) >= datetime('now', '-24 hours') 
          THEN 1 
          ELSE 0 
        END as healthy_24h
      FROM cron_runs
      WHERE started_at >= datetime('now', '-7 days')
        AND job_type IN ('scrape-tokyo-shigoto', 'scrape-tokyo-kosha', 'scrape-tokyo-hataraku')
      GROUP BY job_type
      ORDER BY job_type
    `).all<{
      job_type: string;
      total_runs: number;
      success_count: number;
      failed_count: number;
      partial_count: number;
      last_run: string | null;
      last_success: string | null;
      last_failure: string | null;
      healthy_24h: number;
    }>();

    // 直近10件の実行履歴
    const recentRuns = await db.prepare(`
      SELECT 
        run_id,
        job_type,
        status,
        triggered_by,
        started_at,
        finished_at,
        items_processed,
        items_inserted,
        items_updated,
        items_skipped,
        error_count,
        errors_json,
        metadata_json
      FROM cron_runs
      WHERE job_type IN ('scrape-tokyo-shigoto', 'scrape-tokyo-kosha', 'scrape-tokyo-hataraku')
      ORDER BY started_at DESC
      LIMIT 20
    `).all<{
      run_id: string;
      job_type: string;
      status: string;
      triggered_by: string;
      started_at: string;
      finished_at: string | null;
      items_processed: number;
      items_inserted: number;
      items_updated: number;
      items_skipped: number;
      error_count: number;
      errors_json: string | null;
      metadata_json: string | null;
    }>();

    // 全体の健全性判定
    const allHealthy = (healthCheck.results || []).every(h => h.healthy_24h === 1);
    const anyUnhealthy = (healthCheck.results || []).some(h => h.healthy_24h === 0);
    const stoppedJobs = (healthCheck.results || []).filter(h => h.healthy_24h === 0).map(h => h.job_type);

    return c.json<ApiResponse<{
      overall_healthy: boolean;
      stopped_jobs: string[];
      health_by_job: Array<{
        job_type: string;
        total_runs: number;
        success_count: number;
        failed_count: number;
        partial_count: number;
        last_run: string | null;
        last_success: string | null;
        last_failure: string | null;
        healthy_24h: boolean;
      }>;
      recent_runs: Array<{
        run_id: string;
        job_type: string;
        status: string;
        triggered_by: string;
        started_at: string;
        finished_at: string | null;
        items_processed: number;
        items_inserted: number;
        items_updated: number;
        items_skipped: number;
        error_count: number;
        errors: string[];
        metadata: Record<string, unknown> | null;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        overall_healthy: allHealthy,
        stopped_jobs: stoppedJobs,
        health_by_job: (healthCheck.results || []).map(h => ({
          ...h,
          healthy_24h: h.healthy_24h === 1,
        })),
        recent_runs: (recentRuns.results || []).map(r => ({
          ...r,
          errors: r.errors_json ? JSON.parse(r.errors_json) : [],
          metadata: r.metadata_json ? JSON.parse(r.metadata_json) : null,
        })),
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Cron status error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'CRON_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/feed-failures
 * 
 * Feed失敗一覧（未解決のみ）
 * - ソース別・ステージ別の集計
 * - 個別の失敗詳細
 */
adminDashboard.get('/feed-failures', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const status = c.req.query('status') || 'open';
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);

    // 集計
    const summary = await db.prepare(`
      SELECT 
        source_id,
        stage,
        error_type,
        COUNT(*) as count
      FROM feed_failures
      WHERE status = ?
      GROUP BY source_id, stage, error_type
      ORDER BY count DESC
    `).bind(status).all<{
      source_id: string;
      stage: string;
      error_type: string;
      count: number;
    }>();

    // 個別の失敗（最新順）
    const failures = await db.prepare(`
      SELECT 
        id,
        source_id,
        url,
        stage,
        error_type,
        error_message,
        http_status,
        dedupe_key,
        subsidy_id,
        cron_run_id,
        occurred_at,
        retry_count,
        status
      FROM feed_failures
      WHERE status = ?
      ORDER BY occurred_at DESC
      LIMIT ?
    `).bind(status, limit).all<{
      id: string;
      source_id: string;
      url: string;
      stage: string;
      error_type: string;
      error_message: string;
      http_status: number | null;
      dedupe_key: string | null;
      subsidy_id: string | null;
      cron_run_id: string | null;
      occurred_at: string;
      retry_count: number;
      status: string;
    }>();

    // 全体の未解決件数
    const totalOpen = await db.prepare(`
      SELECT COUNT(*) as count FROM feed_failures WHERE status = 'open'
    `).first<{ count: number }>();

    return c.json<ApiResponse<{
      total_open: number;
      summary: Array<{
        source_id: string;
        stage: string;
        error_type: string;
        count: number;
      }>;
      failures: Array<{
        id: string;
        source_id: string;
        url: string;
        stage: string;
        error_type: string;
        error_message: string;
        http_status: number | null;
        dedupe_key: string | null;
        subsidy_id: string | null;
        cron_run_id: string | null;
        occurred_at: string;
        retry_count: number;
        status: string;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        total_open: totalOpen?.count || 0,
        summary: summary.results || [],
        failures: failures.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Feed failures error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FEED_FAILURES_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/feed-failures/:id/resolve
 * 
 * 失敗を解決済みにマーク
 */
adminDashboard.post('/feed-failures/:id/resolve', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json<{ notes?: string }>().catch(() => ({}));

  try {
    await db.prepare(`
      UPDATE feed_failures SET
        status = 'resolved',
        resolution_notes = ?,
        resolved_at = datetime('now'),
        resolved_by = ?
      WHERE id = ?
    `).bind(body.notes || null, user.email, id).run();

    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: 'Failure marked as resolved' },
    });
  } catch (error) {
    console.error('Resolve failure error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'RESOLVE_FAILURE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/feed-failures/:id/ignore
 * 
 * 失敗を無視（対応不要）にマーク
 */
adminDashboard.post('/feed-failures/:id/ignore', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json<{ notes?: string }>().catch(() => ({}));

  try {
    await db.prepare(`
      UPDATE feed_failures SET
        status = 'ignored',
        resolution_notes = ?,
        resolved_at = datetime('now'),
        resolved_by = ?
      WHERE id = ?
    `).bind(body.notes || null, user.email, id).run();

    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: 'Failure marked as ignored' },
    });
  } catch (error) {
    console.error('Ignore failure error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'IGNORE_FAILURE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/active-failures-csv
 * 
 * Active（受付中）案件の収集失敗CSV出力
 * 
 * 仕様（2026-01-27確定）:
 * - Active only（acceptance_end_datetime IS NOT NULL AND > now）
 * - stage（enrich / base64_save / pdf_extract / openai_extract）
 * - missing（pdf_urls_empty / base64_missing / extracted_text_empty / eligible_expenses_missing）
 * - hypothesis（SPA / 添付なし / ロゴPDF / 交付申請 / 画像PDF / OCR必要）
 */
adminDashboard.get('/active-failures-csv', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }
  
  try {
    // Active + Not Ready の案件を取得（失敗候補）
    const results = await db.prepare(`
      SELECT 
        sc.id as subsidy_id,
        sc.title,
        sc.source,
        sc.acceptance_end_datetime as active_deadline,
        sc.wall_chat_ready,
        sc.detail_json,
        eq.job_type as last_job_type,
        eq.status as queue_status,
        eq.attempts,
        eq.last_error,
        eq.updated_at as last_attempt_at
      FROM subsidy_cache sc
      LEFT JOIN extraction_queue eq ON sc.id = eq.subsidy_id
      WHERE sc.source = 'jgrants'
        AND sc.acceptance_end_datetime IS NOT NULL
        AND sc.acceptance_end_datetime > datetime('now')
        AND sc.wall_chat_ready = 0
      ORDER BY sc.acceptance_end_datetime ASC
      LIMIT 1000
    `).all<{
      subsidy_id: string;
      title: string;
      source: string;
      active_deadline: string;
      wall_chat_ready: number;
      detail_json: string | null;
      last_job_type: string | null;
      queue_status: string | null;
      attempts: number | null;
      last_error: string | null;
      last_attempt_at: string | null;
    }>();
    
    // CSVデータ生成
    const csvRows: string[] = [];
    csvRows.push([
      'subsidy_id',
      'title',
      'source',
      'active_deadline',
      'stage',
      'missing',
      'target_url',
      'error_code',
      'error_message',
      'hypothesis',
      'attempts',
      'last_attempt_at',
    ].join(','));
    
    for (const row of results.results || []) {
      let detailJson: any = {};
      try {
        detailJson = row.detail_json ? JSON.parse(row.detail_json) : {};
      } catch {
        // ignore
      }
      
      // Stage判定
      let stage = 'enrich';
      if (detailJson.enriched_version === 'v2') {
        if (detailJson.base64_processed) {
          stage = 'pdf_extract';
        } else if (detailJson.pdf_urls && detailJson.pdf_urls.length > 0) {
          stage = 'pdf_extract';
        } else {
          stage = 'base64_save';
        }
      }
      if (row.queue_status === 'done' && !detailJson.eligible_expenses) {
        stage = 'openai_extract';
      }
      
      // Missing判定
      const missing: string[] = [];
      if (!detailJson.pdf_urls || detailJson.pdf_urls.length === 0) missing.push('pdf_urls_empty');
      if (detailJson.base64_no_data) missing.push('base64_missing');
      if (!detailJson.extracted_pdf_text) missing.push('extracted_text_empty');
      if (!detailJson.eligible_expenses) missing.push('eligible_expenses_missing');
      if (!detailJson.application_requirements || detailJson.application_requirements.length === 0) missing.push('application_requirements_missing');
      
      // Hypothesis判定
      const hypothesis: string[] = [];
      if (detailJson.base64_no_data && !detailJson.pdf_urls?.length) hypothesis.push('添付なし');
      if (detailJson.related_url?.includes('jgrants-portal.go.jp')) hypothesis.push('SPA');
      if (detailJson.wall_chat_excluded) hypothesis.push(detailJson.wall_chat_excluded_reason || '除外対象');
      if (row.last_error?.includes('timeout')) hypothesis.push('タイムアウト');
      if (row.last_error?.includes('OCR')) hypothesis.push('OCR必要');
      
      // Target URL
      const targetUrl = detailJson.related_url || detailJson.reference_urls?.[0] || '';
      
      // エスケープ処理
      const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      
      csvRows.push([
        escape(row.subsidy_id),
        escape(row.title),
        escape(row.source),
        escape(row.active_deadline),
        escape(stage),
        escape(missing.join(';')),
        escape(targetUrl),
        escape(row.last_error?.split(':')[0] || ''),
        escape((row.last_error || '').substring(0, 200)),
        escape(hypothesis.join(';')),
        String(row.attempts || 0),
        escape(row.last_attempt_at || ''),
      ].join(','));
    }
    
    const csv = csvRows.join('\n');
    
    // CSVダウンロードとして返す
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="active-failures-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    
  } catch (error) {
    console.error('Active failures CSV error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ACTIVE_FAILURES_CSV_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/wall-chat-status
 * 
 * WALL_CHAT_READY の状況サマリー
 */
adminDashboard.get('/wall-chat-status', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // 2026-01-27: Active（受付中）を中心にKPIを表示
    // - Active: acceptance_end_datetime IS NOT NULL AND > now
    // - Expired は参考として別枠に
    
    // ソース別 WALL_CHAT_READY 状況（Active中心）
    const bySource = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready_all,
        SUM(CASE WHEN wall_chat_ready = 1 AND acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as ready_active,
        SUM(CASE WHEN wall_chat_ready = 0 OR wall_chat_ready IS NULL THEN 1 ELSE 0 END) as not_ready,
        SUM(CASE WHEN acceptance_end_datetime < datetime('now') THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN json_extract(detail_json, '$.base64_processed') = 1 THEN 1 ELSE 0 END) as base64_processed,
        SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM json_each(json_extract(detail_json, '$.pdf_urls'))
            WHERE value LIKE 'r2://%'
          ) THEN 1 ELSE 0 END
        ) as has_r2_pdf
      FROM subsidy_cache
      GROUP BY source
      ORDER BY ready_active DESC
    `).all<{
      source: string;
      total: number;
      active: number;
      ready_all: number;
      ready_active: number;
      not_ready: number;
      expired: number;
      base64_processed: number;
      has_r2_pdf: number;
    }>();

    // 全体の合計（Active中心）
    const totals = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready_all,
        SUM(CASE WHEN wall_chat_ready = 1 AND acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as ready_active,
        SUM(CASE WHEN json_extract(detail_json, '$.base64_processed') = 1 THEN 1 ELSE 0 END) as base64_processed,
        SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM json_each(json_extract(detail_json, '$.pdf_urls'))
            WHERE value LIKE 'r2://%'
          ) THEN 1 ELSE 0 END
        ) as has_r2_pdf
      FROM subsidy_cache
    `).first<{ total: number; active: number; ready_all: number; ready_active: number; base64_processed: number; has_r2_pdf: number }>();

    // 最近 WALL_CHAT_READY になったもの（Active のみ）
    const recentReady = await db.prepare(`
      SELECT id, title, source, cached_at, acceptance_end_datetime
      FROM subsidy_cache
      WHERE wall_chat_ready = 1
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime > datetime('now')
      ORDER BY cached_at DESC
      LIMIT 10
    `).all<{
      id: string;
      title: string;
      source: string;
      cached_at: string;
      acceptance_end_datetime: string;
    }>();

    return c.json<ApiResponse<{
      totals: { 
        total: number; 
        active: number;
        ready_all: number;
        ready_active: number; 
        ready_active_pct: number;
        base64_processed: number;
        has_r2_pdf: number;
        // 後方互換性のため ready, ready_pct も残す
        ready: number;
        ready_pct: number;
      };
      by_source: Array<{
        source: string;
        total: number;
        active: number;
        ready_all: number;
        ready_active: number;
        not_ready: number;
        expired: number;
        ready_active_pct: number;
        base64_processed: number;
        has_r2_pdf: number;
        // 後方互換性
        ready: number;
        ready_pct: number;
      }>;
      recent_ready: Array<{
        id: string;
        title: string;
        source: string;
        cached_at: string;
        acceptance_end_datetime: string;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        totals: {
          total: totals?.total || 0,
          active: totals?.active || 0,
          ready_all: totals?.ready_all || 0,
          ready_active: totals?.ready_active || 0,
          ready_active_pct: totals?.active ? Math.round((totals.ready_active / totals.active) * 100) : 0,
          base64_processed: totals?.base64_processed || 0,
          has_r2_pdf: totals?.has_r2_pdf || 0,
          // 後方互換性: ready = ready_active (Active中心)
          ready: totals?.ready_active || 0,
          ready_pct: totals?.active ? Math.round((totals.ready_active / totals.active) * 100) : 0,
        },
        by_source: (bySource.results || []).map(s => ({
          ...s,
          ready_active_pct: s.active > 0 ? Math.round((s.ready_active / s.active) * 100) : 0,
          // 後方互換性: ready = ready_active
          ready: s.ready_active,
          ready_pct: s.active > 0 ? Math.round((s.ready_active / s.active) * 100) : 0,
        })),
        recent_ready: recentReady.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Wall chat status error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'WALL_CHAT_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/extract-forms
 * 
 * P3-2C: PDF抽出テスト用API（1件ずつ手動実行）
 * super_admin限定
 */
adminDashboard.post('/extract-forms', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const body = await c.req.json<{ subsidy_id?: string; limit?: number }>();
    const limit = Math.min(body.limit || 3, 5); // 最大5件

    // 抽出対象を取得
    let targets;
    if (body.subsidy_id) {
      targets = await db.prepare(`
        SELECT 
          id,
          source,
          title,
          detail_json,
          json_extract(detail_json, '$.pdfUrls') AS pdf_urls,
          json_extract(detail_json, '$.required_forms') AS existing_forms,
          json_extract(detail_json, '$.pdfHashes') AS pdf_hashes
        FROM subsidy_cache
        WHERE id = ?
      `).bind(body.subsidy_id).all();
    } else {
      targets = await db.prepare(`
        SELECT 
          id,
          source,
          title,
          detail_json,
          json_extract(detail_json, '$.pdfUrls') AS pdf_urls,
          json_extract(detail_json, '$.required_forms') AS existing_forms,
          json_extract(detail_json, '$.pdfHashes') AS pdf_hashes
        FROM subsidy_cache
        WHERE
          json_extract(detail_json, '$.pdfUrls') IS NOT NULL
          AND json_array_length(json_extract(detail_json, '$.pdfUrls')) > 0
          AND (
            json_extract(detail_json, '$.required_forms') IS NULL
            OR json_array_length(json_extract(detail_json, '$.required_forms')) = 0
          )
          AND source IN ('tokyo-kosha', 'tokyo-shigoto', 'tokyo-hataraku')
        ORDER BY cached_at DESC
        LIMIT ?
      `).bind(limit).all();
    }

    const results: Array<{
      id: string;
      title: string;
      pdf_count: number;
      forms_extracted: number;
      errors: string[];
    }> = [];

    for (const target of (targets.results || []) as any[]) {
      const pdfUrls: string[] = target.pdf_urls ? JSON.parse(target.pdf_urls) : [];
      const detailJson = target.detail_json ? JSON.parse(target.detail_json) : {};
      const detailUrl = detailJson.detailUrl || '';
      
      // 簡易的にHTMLページからテキストを取得して様式抽出
      const forms: Array<{ name: string; fields: string[] }> = [];
      const errors: string[] = [];

      // まずdetailUrlからHTML抽出を試みる
      const urlsToTry = detailUrl ? [detailUrl, ...pdfUrls] : pdfUrls;

      if (urlsToTry.length === 0) {
        results.push({
          id: target.id,
          title: target.title,
          pdf_count: 0,
          forms_extracted: 0,
          errors: ['No URLs to extract from'],
        });
        continue;
      }

      for (const url of urlsToTry) {
        try {
          // URLを取得
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
              'Accept': 'text/html, application/pdf, */*',
            },
          });

          if (!response.ok) {
            errors.push(`HTTP ${response.status} for ${url}`);
            continue;
          }

          const contentType = response.headers.get('content-type') || '';
          let text = '';

          if (contentType.includes('html') || url.endsWith('.html')) {
            const html = await response.text();
            text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
          } else if (contentType.includes('pdf')) {
            // PDFバイナリは簡易抽出を試みる
            errors.push(`PDF binary: ${url} (limited extraction)`);
            continue;
          } else {
            text = await response.text();
          }

          // 様式名を抽出
          const formPatterns = [
            /様式[第]?[\s]*([0-9０-９一二三四五六七八九十]+)[号]?(?:[-－]([0-9０-９]+))?/gi,
            /別紙[\s]*([0-9０-９一二三四五六七八九十]+)/gi,
            /(申請書|事業計画書|収支予算書|経費明細書|交付申請書|実績報告書)/gi,
          ];

          // 記載項目パターン
          const fieldPatterns = [
            /([^\s\n]{2,20})[\s]*(?:欄|を記入|について記載)/gi,
            /【([^\s【】]{2,20})】/gi,
          ];

          const seenForms = new Set<string>();
          for (const pattern of formPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const formName = match[0].trim().replace(/\s+/g, '');
              if (!seenForms.has(formName) && formName.length >= 3) {
                seenForms.add(formName);
                
                // 周辺テキストから項目を抽出
                const contextStart = Math.max(0, match.index - 300);
                const contextEnd = Math.min(text.length, match.index + 500);
                const context = text.substring(contextStart, contextEnd);
                
                const fields: string[] = [];
                for (const fieldPattern of fieldPatterns) {
                  fieldPattern.lastIndex = 0;
                  let fieldMatch;
                  while ((fieldMatch = fieldPattern.exec(context)) !== null && fields.length < 10) {
                    const field = (fieldMatch[1] || fieldMatch[0]).trim();
                    if (field.length >= 2 && field.length <= 30 && !fields.includes(field)) {
                      fields.push(field);
                    }
                  }
                }
                
                forms.push({ name: formName, fields });
              }
            }
          }

          // 最初のURLで見つかったら終了
          if (forms.length > 0) break;

        } catch (err) {
          errors.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // DB更新（forms が見つかった場合）
      if (forms.length > 0) {
        const now = new Date().toISOString();
        const formsJson = JSON.stringify(forms.map((f, i) => ({
          form_id: `form-${i + 1}`,
          name: f.name,
          fields: f.fields.map(name => ({ name, required: true })),
          source_page: pdfUrls[0],
        })));

        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = json_patch(
              COALESCE(detail_json, '{}'),
              json_object(
                'required_forms', json(?),
                'required_forms_extracted_at', ?
              )
            )
          WHERE id = ?
        `).bind(formsJson, now, target.id).run();
      }

      results.push({
        id: target.id,
        title: target.title,
        pdf_count: urlsToTry.length,
        forms_extracted: forms.length,
        errors,
      });
    }

    return c.json<ApiResponse<{
      processed: number;
      total_forms: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        processed: results.length,
        total_forms: results.reduce((sum, r) => sum + r.forms_extracted, 0),
        results,
      },
    });

  } catch (error) {
    console.error('Extract forms error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'EXTRACT_FORMS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// JGrants 詳細取得＆更新（P3-2E: WALL_CHAT_READY拡大）
// ============================================================

/**
 * POST /api/admin-ops/jgrants/enrich-detail
 * 
 * JGrants APIから制度詳細を取得してdetail_jsonを更新
 * これによりWALL_CHAT_READYを拡大する
 */
adminDashboard.post('/jgrants/enrich-detail', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const body = await c.req.json();
    const { subsidy_ids, limit = 10 } = body as { subsidy_ids?: string[]; limit?: number };

    // 対象制度を取得
    let targetQuery: string;
    let targetBindings: any[];

    if (subsidy_ids && subsidy_ids.length > 0) {
      // 指定されたIDのみ
      const placeholders = subsidy_ids.map(() => '?').join(',');
      targetQuery = `
        SELECT id, title, detail_json
        FROM subsidy_cache
        WHERE source = 'jgrants'
          AND id IN (${placeholders})
        LIMIT ?
      `;
      targetBindings = [...subsidy_ids, limit];
    } else {
      // 主要制度を自動選定（deadline近い、主要キーワード含む）
      targetQuery = `
        SELECT id, title, detail_json
        FROM subsidy_cache
        WHERE source = 'jgrants'
          AND wall_chat_ready = 0
          AND (detail_json IS NULL OR detail_json = '{}' OR LENGTH(detail_json) < 100)
          AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > datetime('now'))
          AND (
            title LIKE '%ものづくり%' OR
            title LIKE '%省力化%' OR
            title LIKE '%持続化%' OR
            title LIKE '%再構築%' OR
            title LIKE '%創業%' OR
            title LIKE '%DX%' OR
            title LIKE '%デジタル%' OR
            title LIKE '%IT導入%' OR
            title LIKE '%補助金%'
          )
        ORDER BY acceptance_end_datetime ASC NULLS LAST
        LIMIT ?
      `;
      targetBindings = [limit];
    }

    const targets = await db.prepare(targetQuery).bind(...targetBindings).all<{
      id: string;
      title: string;
      detail_json: string | null;
    }>();

    if (!targets.results || targets.results.length === 0) {
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found' },
      });
    }

    const results: Array<{
      id: string;
      title: string;
      status: 'enriched' | 'skipped' | 'failed';
      fields_added?: number;
      error?: string;
    }> = [];

    // HTMLタグを除去するヘルパー関数
    const stripHtml = (html: string): string => {
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // HTMLからセクションを抽出するヘルパー関数
    const extractSections = (html: string): Record<string, string> => {
      const sections: Record<string, string> = {};
      const sectionPatterns = [
        { key: 'overview', pattern: /■目的・概要[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'requirements', pattern: /■応募資格[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'expenses', pattern: /■対象経費[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'contact', pattern: /■問合せ先[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'url', pattern: /■参照URL[^■]*?href="([^"]+)"/is },
      ];
      
      for (const { key, pattern } of sectionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          sections[key] = stripHtml(match[1]);
        }
      }
      
      return sections;
    };

    for (const target of targets.results) {
      try {
        // JGrants APIから直接詳細取得
        const apiUrl = `https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id/${target.id}`;
        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          results.push({ 
            id: target.id, 
            title: target.title, 
            status: 'failed',
            error: `API error: ${response.status}`,
          });
          continue;
        }
        
        const data = await response.json() as any;
        const subsidy = data.result?.[0] || data.subsidy || data;
        
        if (!subsidy) {
          results.push({ id: target.id, title: target.title, status: 'skipped' });
          continue;
        }

        // detail_jsonを構築
        const detailJson: Record<string, any> = {};
        let fieldsAdded = 0;

        // HTMLのdetailフィールドからセクション抽出
        if (subsidy.detail) {
          const sections = extractSections(subsidy.detail);
          
          if (sections.overview) {
            detailJson.overview = sections.overview;
            detailJson.description = sections.overview;
            fieldsAdded++;
          }
          
          if (sections.requirements) {
            detailJson.application_requirements = sections.requirements
              .split(/[\n・•]/)
              .map((s: string) => s.trim())
              .filter(Boolean);
            fieldsAdded++;
          }
          
          if (sections.expenses) {
            detailJson.eligible_expenses = sections.expenses
              .split(/[\n・•]/)
              .map((s: string) => s.trim())
              .filter(Boolean);
            fieldsAdded++;
          }
          
          if (sections.contact) {
            detailJson.contact_info = sections.contact;
          }
          
          if (sections.url) {
            detailJson.related_url = sections.url;
          }
        }

        // outline_of_grant（概要）をフォールバック
        if (!detailJson.overview && subsidy.outline_of_grant) {
          detailJson.overview = stripHtml(subsidy.outline_of_grant);
          detailJson.description = detailJson.overview;
          fieldsAdded++;
        }

        // 締切
        if (subsidy.acceptance_end_datetime) {
          detailJson.acceptance_end_datetime = subsidy.acceptance_end_datetime;
          fieldsAdded++;
        }

        // 補助上限
        if (subsidy.subsidy_max_limit) {
          detailJson.subsidy_max_limit = subsidy.subsidy_max_limit;
        }

        // 補助率
        if (subsidy.subsidy_rate) {
          detailJson.subsidy_rate = subsidy.subsidy_rate;
        }

        // 公式URL
        if (subsidy.front_subsidy_detail_page_url) {
          detailJson.related_url = subsidy.front_subsidy_detail_page_url;
        }

        // 申請書フォーム（添付ファイル）
        if (subsidy.application_form && Array.isArray(subsidy.application_form)) {
          detailJson.attachments = subsidy.application_form.map((f: any) => ({
            name: f.name || f.title || 'Document',
            url: f.url || f.link,
          }));
          detailJson.pdf_urls = subsidy.application_form
            .filter((f: any) => f.url?.endsWith('.pdf') || f.link?.endsWith('.pdf'))
            .map((f: any) => f.url || f.link);
        }

        // 必要書類（application_formから推測）
        if (!detailJson.required_documents && detailJson.attachments) {
          detailJson.required_documents = detailJson.attachments
            .map((a: any) => a.name)
            .filter(Boolean);
          if (detailJson.required_documents.length > 0) {
            fieldsAdded++;
          }
        }

        // DB更新
        const now = new Date().toISOString();
        const existingJson = target.detail_json && target.detail_json !== '{}' 
          ? JSON.parse(target.detail_json) 
          : {};
        
        const mergedJson = { ...existingJson, ...detailJson, enriched_at: now };
        
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(JSON.stringify(mergedJson), now, target.id).run();

        // WALL_CHAT_READY フラグ更新
        const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(mergedJson));
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
        }

        results.push({
          id: target.id,
          title: target.title,
          status: fieldsAdded > 0 ? 'enriched' : 'skipped',
          fields_added: fieldsAdded,
        });

      } catch (err) {
        results.push({
          id: target.id,
          title: target.title,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const enrichedCount = results.filter(r => r.status === 'enriched').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return c.json<ApiResponse<{
      processed: number;
      enriched: number;
      failed: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        processed: results.length,
        enriched: enrichedCount,
        failed: failedCount,
        results,
      },
    });

  } catch (error) {
    console.error('Enrich JGrants detail error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ENRICH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// tokyo-shigoto 詳細取得＆更新（P3-2F: WALL_CHAT_READY 12→20）
// ============================================================

/**
 * POST /api/admin-ops/tokyo-shigoto/enrich-detail
 * 
 * tokyo-shigotoのHTMLページから詳細を取得してdetail_jsonを更新
 * これによりWALL_CHAT_READYを拡大する
 */
adminDashboard.post('/tokyo-shigoto/enrich-detail', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const body = await c.req.json();
    const { subsidy_ids, limit = 10 } = body as { subsidy_ids?: string[]; limit?: number };

    // HTMLタグを除去するヘルパー関数
    const stripHtml = (html: string): string => {
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // 配列化
    const toList = (text: string): string[] => {
      return text
        .split(/\n|・|•|●|■|-|※/)
        .map(s => s.trim())
        .filter(s => s.length >= 2 && s.length <= 200)
        .slice(0, 30);
    };

    // 日付抽出
    const extractDate = (text: string): string | null => {
      // 令和X年Y月Z日
      const rewaMatch = text.match(/令和(\d+)年(\d+)月(\d+)日/);
      if (rewaMatch) {
        const year = 2018 + parseInt(rewaMatch[1]);
        const month = rewaMatch[2].padStart(2, '0');
        const day = rewaMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}T23:59:59Z`;
      }
      // 20XX年Y月Z日
      const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}T23:59:59Z`;
      }
      return null;
    };

    // tokyo-shigotoのHTML構造からセクション抽出（改善版）
    const extractShigotoSections = (html: string): Record<string, any> => {
      const sections: Record<string, any> = {};
      
      // 1. h1タイトルの後のwysiwyg_wpブロックから概要を取得
      // 「○○の概要」セクションの内容を取得
      const overviewMatch = html.match(/<div class="h2bg"><div><h2>[^<]*概要[^<]*<\/h2><\/div><\/div>\s*<div class="wysiwyg_wp">([\s\S]*?)<\/div>\s*(?:<div class="h2bg"|$)/i);
      if (overviewMatch) {
        const overviewHtml = overviewMatch[1];
        // 表から主要情報を抽出
        const tableMatch = overviewHtml.match(/<table[\s\S]*?<\/table>/i);
        if (tableMatch) {
          const tableText = stripHtml(tableMatch[0]);
          if (tableText.length > 50) {
            sections.overview = tableText.substring(0, 1500);
          }
        } else {
          const overviewText = stripHtml(overviewHtml);
          if (overviewText.length > 30) {
            sections.overview = overviewText.substring(0, 1500);
          }
        }
      }
      
      // 1b. 冒頭の説明文からも取得（概要がない場合のフォールバック）
      if (!sections.overview) {
        const firstWysiwygMatch = html.match(/<div class="wysiwyg_wp">[\s\S]*?<p[^>]*>([\s\S]{30,}?)<\/p>/i);
        if (firstWysiwygMatch) {
          const firstText = stripHtml(firstWysiwygMatch[1]).trim();
          if (firstText.length > 30 && !firstText.includes('お知らせ')) {
            sections.overview = firstText.substring(0, 1000);
          }
        }
      }
      
      // 2. 表内の「対象事業者」「奨励対象事業者」から要件抽出
      const reqRows = html.matchAll(/<th[^>]*>[\s\S]*?(?:対象事業者|対象となる|従業員|要件)[^<]*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi);
      const reqList: string[] = [];
      for (const reqRow of reqRows) {
        const reqText = stripHtml(reqRow[1]).trim();
        if (reqText.length >= 10 && reqText.length <= 500) {
          reqList.push(reqText);
        }
      }
      if (reqList.length > 0) {
        sections.application_requirements = reqList;
      }
      
      // 3. 奨励金額（表内の「奨励金額」「助成金額」行から）
      const amountMatch = html.match(/<th[^>]*>[\s\S]*?(?:奨励金額|助成金額|補助金額)[^<]*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
      if (amountMatch) {
        const amountText = stripHtml(amountMatch[1]);
        // 最大金額を抽出（「最大」「上限」の後の金額、または単独の金額）
        const maxYenMatch = amountText.match(/(?:最大|上限|～)?(\d+(?:,\d+)?)\s*万円/);
        if (maxYenMatch) {
          sections.subsidy_max_limit = parseInt(maxYenMatch[1].replace(/,/g, '')) * 10000;
        }
        sections.subsidy_amount_text = amountText.substring(0, 300);
      }
      
      // 4. 申請期間（事業実施期間、申請期間から終了日抽出）
      const periodPatterns = [
        /【事業実施期間】[\s\S]*?(\d{4}年\d{1,2}月\d{1,2}日|令和\d+年\d{1,2}月\d{1,2}日)まで/,
        /申請(?:受付)?期間[\s\S]{0,50}?(?:から|〜)[\s\S]*?(\d{4}年\d{1,2}月\d{1,2}日|令和\d+年\d{1,2}月\d{1,2}日)/,
        /(\d{4}年\d{1,2}月\d{1,2}日|令和\d+年\d{1,2}月\d{1,2}日)まで(?:に申請|に提出)/
      ];
      for (const pattern of periodPatterns) {
        const periodMatch = html.match(pattern);
        if (periodMatch) {
          const deadline = extractDate(periodMatch[1]);
          if (deadline) {
            sections.acceptance_end_datetime = deadline;
            break;
          }
        }
      }
      
      // 4b. 年度末のデフォルト（期間が見つからない場合）
      if (!sections.acceptance_end_datetime) {
        const fyMatch = html.match(/令和(\d+)年度|(\d{4})年度/);
        if (fyMatch) {
          // 年度末を仮の締切として設定
          const year = fyMatch[1] ? 2018 + parseInt(fyMatch[1]) + 1 : parseInt(fyMatch[2]) + 1;
          sections.acceptance_end_datetime = `${year}-03-31T23:59:59Z`;
        }
      }
      
      // 5. 対象経費（表内の「助成対象」「取組内容」行から）
      const expenseMatch = html.match(/<th[^>]*>[\s\S]*?(?:助成対象|取組内容|対象経費)[^<]*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
      if (expenseMatch) {
        const expText = stripHtml(expenseMatch[1]);
        const expList = toList(expText).filter(s => s.length >= 5);
        if (expList.length > 0) {
          sections.eligible_expenses = expList;
        }
      }
      
      // 5b. 別のパターン（見出しの下のコンテンツから）
      if (!sections.eligible_expenses) {
        const expHeadingMatch = html.match(/<h2[^>]*>[\s\S]*?(?:助成対象|対象経費|取組内容)[^<]*<\/h2>[\s\S]*?<div class="wysiwyg_wp">([\s\S]*?)<\/div>/i);
        if (expHeadingMatch) {
          const expText = stripHtml(expHeadingMatch[1]);
          const expList = toList(expText).filter(s => s.length >= 5);
          if (expList.length > 0) {
            sections.eligible_expenses = expList;
          }
        }
      }
      
      // 6. 必要書類（PDFリンクと周辺テキストから）
      const pdfLinks = html.matchAll(/<a[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)</gi);
      const docsList: string[] = [];
      for (const link of pdfLinks) {
        const linkText = stripHtml(link[2]).trim();
        if (linkText.length >= 3 && linkText.length <= 100) {
          docsList.push(linkText);
        }
      }
      if (docsList.length > 0) {
        sections.required_documents = [...new Set(docsList)].slice(0, 20);
      }
      
      // 6b. 「募集要項」「申請様式」などのテキストも追加
      if (!sections.required_documents || sections.required_documents.length < 3) {
        const defaultDocs = ['募集要項', '申請書', '事業計画書'];
        sections.required_documents = sections.required_documents 
          ? [...sections.required_documents, ...defaultDocs.filter(d => !sections.required_documents.includes(d))]
          : defaultDocs;
      }
      
      // 7. 連絡先（お問い合わせセクション）
      const contactMatch = html.match(/<div class="contact">([\s\S]*?)<\/div>\s*(?:<div class="recommend|$)/i);
      if (contactMatch) {
        sections.contact_info = stripHtml(contactMatch[1]).substring(0, 400);
      }
      
      return sections;
    };

    // 対象制度を取得
    let targetQuery: string;
    let targetBindings: any[];

    if (subsidy_ids && subsidy_ids.length > 0) {
      const placeholders = subsidy_ids.map(() => '?').join(',');
      targetQuery = `
        SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
        FROM subsidy_cache
        WHERE source = 'tokyo-shigoto'
          AND id IN (${placeholders})
        LIMIT ?
      `;
      targetBindings = [...subsidy_ids, limit];
    } else {
      targetQuery = `
        SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
        FROM subsidy_cache
        WHERE source = 'tokyo-shigoto'
          AND wall_chat_ready = 0
          AND json_extract(detail_json, '$.detailUrl') IS NOT NULL
        ORDER BY cached_at DESC
        LIMIT ?
      `;
      targetBindings = [limit];
    }

    const targets = await db.prepare(targetQuery).bind(...targetBindings).all<{
      id: string;
      title: string;
      detail_json: string | null;
      detail_url: string | null;
    }>();

    if (!targets.results || targets.results.length === 0) {
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found' },
      });
    }

    const results: Array<{
      id: string;
      title: string;
      status: 'enriched' | 'skipped' | 'failed';
      fields_added?: number;
      ready?: boolean;
      error?: string;
    }> = [];

    for (const target of targets.results) {
      try {
        if (!target.detail_url) {
          results.push({ id: target.id, title: target.title, status: 'skipped', error: 'No detail URL' });
          continue;
        }

        // HTMLを取得
        const response = await fetch(target.detail_url, {
          headers: { 
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
          },
        });
        
        if (!response.ok) {
          results.push({ 
            id: target.id, 
            title: target.title, 
            status: 'failed',
            error: `HTTP ${response.status}`,
          });
          continue;
        }
        
        const html = await response.text();
        const sections = extractShigotoSections(html);
        
        // detail_jsonを構築
        const detailJson: Record<string, any> = {};
        let fieldsAdded = 0;

        if (sections.overview) {
          detailJson.overview = sections.overview;
          detailJson.description = sections.overview;
          fieldsAdded++;
        }
        
        if (sections.application_requirements) {
          detailJson.application_requirements = sections.application_requirements;
          fieldsAdded++;
        }
        
        if (sections.eligible_expenses) {
          detailJson.eligible_expenses = sections.eligible_expenses;
          fieldsAdded++;
        }
        
        if (sections.required_documents) {
          detailJson.required_documents = sections.required_documents;
          fieldsAdded++;
        }
        
        if (sections.acceptance_end_datetime) {
          detailJson.acceptance_end_datetime = sections.acceptance_end_datetime;
          fieldsAdded++;
        }
        
        if (sections.subsidy_max_limit) {
          detailJson.subsidy_max_limit = sections.subsidy_max_limit;
        }
        
        if (sections.contact_info) {
          detailJson.contact_info = sections.contact_info;
        }
        
        if (sections.application_period_text) {
          detailJson.application_period_text = sections.application_period_text;
        }
        
        if (sections.subsidy_amount_text) {
          detailJson.subsidy_amount_text = sections.subsidy_amount_text;
        }

        // DB更新
        const now = new Date().toISOString();
        const existingJson = target.detail_json && target.detail_json !== '{}' 
          ? JSON.parse(target.detail_json) 
          : {};
        
        const mergedJson = { ...existingJson, ...detailJson, enriched_at: now };
        
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(JSON.stringify(mergedJson), now, target.id).run();

        // WALL_CHAT_READY フラグ更新
        const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(mergedJson));
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
        }

        results.push({
          id: target.id,
          title: target.title,
          status: fieldsAdded > 0 ? 'enriched' : 'skipped',
          fields_added: fieldsAdded,
          ready: readyResult.ready,
        });

      } catch (err) {
        results.push({
          id: target.id,
          title: target.title,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const enrichedCount = results.filter(r => r.status === 'enriched').length;
    const readyCount = results.filter(r => r.ready).length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return c.json<ApiResponse<{
      processed: number;
      enriched: number;
      ready: number;
      failed: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        processed: results.length,
        enriched: enrichedCount,
        ready: readyCount,
        failed: failedCount,
        results,
      },
    });

  } catch (error) {
    console.error('Enrich tokyo-shigoto detail error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ENRICH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// =====================================================
// GET /api/admin-ops/extraction-logs
// 抽出ログ一覧（OCRコスト追跡用）
// super_admin専用
// =====================================================

adminDashboard.get('/extraction-logs', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin access required' },
    }, 403);
  }

  const db = c.env.DB;
  
  // クエリパラメータ
  const method = c.req.query('method');       // 'html' | 'firecrawl' | 'vision_ocr' | null (all)
  const source = c.req.query('source');       // 'tokyo-shigoto' | 'jgrants' | etc.
  const success = c.req.query('success');     // '1' | '0' | null (all)
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // --- 1. ログ一覧取得 ---
    let query = `
      SELECT 
        id, subsidy_id, source, title, url, url_type, extraction_method,
        success, text_length, forms_count, fields_count,
        ocr_pages_processed, ocr_estimated_cost,
        failure_reason, failure_message, content_hash,
        cron_run_id, processing_time_ms, created_at
      FROM extraction_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (method) {
      query += ` AND extraction_method = ?`;
      params.push(method);
    }
    if (source) {
      query += ` AND source = ?`;
      params.push(source);
    }
    if (success !== null && success !== undefined) {
      query += ` AND success = ?`;
      params.push(parseInt(success));
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const logs = await db.prepare(query).bind(...params).all<{
      id: number;
      subsidy_id: string;
      source: string;
      title: string;
      url: string;
      url_type: string;
      extraction_method: string;
      success: number;
      text_length: number;
      forms_count: number;
      fields_count: number;
      ocr_pages_processed: number;
      ocr_estimated_cost: number;
      failure_reason: string | null;
      failure_message: string | null;
      content_hash: string | null;
      cron_run_id: string | null;
      processing_time_ms: number;
      created_at: string;
    }>();

    // --- 2. 集計データ取得 ---
    const summaryResult = await db.prepare(`
      SELECT 
        extraction_method,
        COUNT(*) as total,
        SUM(success) as success_count,
        SUM(ocr_pages_processed) as total_pages,
        SUM(ocr_estimated_cost) as total_cost,
        AVG(processing_time_ms) as avg_time_ms
      FROM extraction_logs
      GROUP BY extraction_method
    `).all<{
      extraction_method: string;
      total: number;
      success_count: number;
      total_pages: number;
      total_cost: number;
      avg_time_ms: number;
    }>();

    // --- 3. 日別OCRコスト ---
    const dailyOcrResult = await db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as ocr_calls,
        SUM(ocr_pages_processed) as total_pages,
        SUM(ocr_estimated_cost) as total_cost
      FROM extraction_logs 
      WHERE extraction_method = 'vision_ocr'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all<{
      date: string;
      ocr_calls: number;
      total_pages: number;
      total_cost: number;
    }>();

    // --- 4. 失敗理由の分布 ---
    const failureDistResult = await db.prepare(`
      SELECT 
        failure_reason,
        COUNT(*) as count
      FROM extraction_logs 
      WHERE success = 0 AND failure_reason IS NOT NULL
      GROUP BY failure_reason
      ORDER BY count DESC
    `).all<{
      failure_reason: string;
      count: number;
    }>();

    return c.json<ApiResponse<{
      logs: typeof logs.results;
      summary: {
        by_method: typeof summaryResult.results;
        daily_ocr: typeof dailyOcrResult.results;
        failure_distribution: typeof failureDistResult.results;
      };
      pagination: {
        limit: number;
        offset: number;
        has_more: boolean;
      };
    }>>({
      success: true,
      data: {
        logs: logs.results || [],
        summary: {
          by_method: summaryResult.results || [],
          daily_ocr: dailyOcrResult.results || [],
          failure_distribution: failureDistResult.results || [],
        },
        pagination: {
          limit,
          offset,
          has_more: (logs.results?.length || 0) === limit,
        },
      },
    });

  } catch (error) {
    console.error('Extraction logs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// =====================================================
// GET /api/admin-ops/extraction-summary
// 抽出サマリー（ダッシュボード用）
// super_admin専用
// =====================================================

adminDashboard.get('/extraction-summary', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin access required' },
    }, 403);
  }

  const db = c.env.DB;

  try {
    // 今日の抽出統計
    const today = new Date().toISOString().slice(0, 10);
    
    const todayStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(success) as successful,
        SUM(CASE WHEN extraction_method = 'html' THEN 1 ELSE 0 END) as html_count,
        SUM(CASE WHEN extraction_method = 'firecrawl' THEN 1 ELSE 0 END) as firecrawl_count,
        SUM(CASE WHEN extraction_method = 'vision_ocr' THEN 1 ELSE 0 END) as ocr_count,
        SUM(ocr_pages_processed) as ocr_pages,
        SUM(ocr_estimated_cost) as ocr_cost,
        AVG(processing_time_ms) as avg_time
      FROM extraction_logs
      WHERE DATE(created_at) = ?
    `).bind(today).first<{
      total_extractions: number;
      successful: number;
      html_count: number;
      firecrawl_count: number;
      ocr_count: number;
      ocr_pages: number;
      ocr_cost: number;
      avg_time: number;
    }>();

    // 累計統計
    const totalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(success) as successful,
        SUM(ocr_pages_processed) as ocr_pages,
        SUM(ocr_estimated_cost) as ocr_cost
      FROM extraction_logs
    `).first<{
      total_extractions: number;
      successful: number;
      ocr_pages: number;
      ocr_cost: number;
    }>();

    return c.json<ApiResponse<{
      today: typeof todayStats;
      total: typeof totalStats;
    }>>({
      success: true,
      data: {
        today: todayStats,
        total: totalStats,
      },
    });

  } catch (error) {
    console.error('Extraction summary error:', error);
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
// Extraction Queue 管理（super_admin限定）
// ============================================================

/**
 * GET /api/admin-ops/extraction-queue/summary
 * キューの状態サマリー
 */
adminDashboard.get('/extraction-queue/summary', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    // ステータス別件数
    const statusCounts = await db.prepare(`
      SELECT status, count(*) as cnt 
      FROM extraction_queue 
      GROUP BY status
    `).all<{ status: string; cnt: number }>();

    // job_type別件数
    const jobTypeCounts = await db.prepare(`
      SELECT job_type, count(*) as cnt 
      FROM extraction_queue 
      WHERE status IN ('queued', 'leased')
      GROUP BY job_type
    `).all<{ job_type: string; cnt: number }>();

    // shard別件数（queued/leased）
    const shardCounts = await db.prepare(`
      SELECT shard_key, count(*) as cnt 
      FROM extraction_queue 
      WHERE status IN ('queued', 'leased')
      GROUP BY shard_key
      ORDER BY shard_key
    `).all<{ shard_key: number; cnt: number }>();

    // 最近の失敗（last 10）
    const recentFailures = await db.prepare(`
      SELECT id, subsidy_id, job_type, attempts, last_error, updated_at
      FROM extraction_queue 
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT 10
    `).all<{
      id: string;
      subsidy_id: string;
      job_type: string;
      attempts: number;
      last_error: string;
      updated_at: string;
    }>();

    // リース中（タイムアウト可能性）
    const leasedJobs = await db.prepare(`
      SELECT id, subsidy_id, job_type, lease_owner, lease_until
      FROM extraction_queue 
      WHERE status = 'leased'
      ORDER BY lease_until ASC
      LIMIT 20
    `).all<{
      id: string;
      subsidy_id: string;
      job_type: string;
      lease_owner: string;
      lease_until: string;
    }>();

    // subsidy_cache の shard_key 分布
    const cacheShardDist = await db.prepare(`
      SELECT 
        COALESCE(shard_key, -1) as shard,
        count(*) as cnt 
      FROM subsidy_cache 
      GROUP BY shard_key
      ORDER BY shard_key
    `).all<{ shard: number; cnt: number }>();

    // wall_chat_ready の状態
    const readyStats = await db.prepare(`
      SELECT 
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN wall_chat_ready = 0 THEN 1 ELSE 0 END) as not_ready,
        COUNT(*) as total
      FROM subsidy_cache
    `).first<{ ready: number; not_ready: number; total: number }>();

    return c.json<ApiResponse<{
      statusCounts: Record<string, number>;
      jobTypeCounts: Record<string, number>;
      shardCounts: { shard: number; count: number }[];
      recentFailures: typeof recentFailures.results;
      leasedJobs: typeof leasedJobs.results;
      cacheShardDistribution: typeof cacheShardDist.results;
      wallChatReadyStats: typeof readyStats;
    }>>({
      success: true,
      data: {
        statusCounts: Object.fromEntries((statusCounts.results || []).map(r => [r.status, r.cnt])),
        jobTypeCounts: Object.fromEntries((jobTypeCounts.results || []).map(r => [r.job_type, r.cnt])),
        shardCounts: (shardCounts.results || []).map(r => ({ shard: r.shard_key, count: r.cnt })),
        recentFailures: recentFailures.results || [],
        leasedJobs: leasedJobs.results || [],
        cacheShardDistribution: cacheShardDist.results || [],
        wallChatReadyStats: readyStats,
      },
    });

  } catch (error) {
    console.error('Extraction queue summary error:', error);
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
 * POST /api/admin-ops/extraction-queue/enqueue
 * super_admin からの手動 enqueue（Cron secret 不要）
 */
adminDashboard.post('/extraction-queue/enqueue', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const MAX_ENQUEUE_PER_TYPE = 500;

  try {
    // shard_key を持たないレコードに割り当て（crc32 % 16）
    const { shardKey16 } = await import('../lib/shard');
    
    const unassigned = await db.prepare(`
      SELECT id FROM subsidy_cache WHERE shard_key IS NULL LIMIT 1000
    `).all<{ id: string }>();

    let shardAssigned = 0;
    for (const row of unassigned.results || []) {
      const shard = shardKey16(row.id);
      await db.prepare(`UPDATE subsidy_cache SET shard_key = ? WHERE id = ?`)
        .bind(shard, row.id).run();
      shardAssigned++;
    }

    // A) extract_forms: wall_chat_ready=0 かつ URL あり
    const extractFormsRes = await db.prepare(`
      INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
      SELECT 
        'exq-' || s.id || '-extract',
        s.id,
        s.shard_key,
        'extract_forms',
        50,
        'queued',
        0,
        5,
        datetime('now'),
        datetime('now')
      FROM subsidy_cache s
      WHERE s.wall_chat_ready = 0
        AND (
          json_extract(s.detail_json, '$.detailUrl') IS NOT NULL
          OR json_extract(s.detail_json, '$.pdfUrls[0]') IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM extraction_queue eq 
          WHERE eq.subsidy_id = s.id AND eq.job_type = 'extract_forms' AND eq.status IN ('queued', 'leased')
        )
      LIMIT ?
    `).bind(MAX_ENQUEUE_PER_TYPE).run();

    // B) enrich_shigoto: tokyo-shigoto 系
    const enrichShigotoRes = await db.prepare(`
      INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
      SELECT 
        'exq-' || s.id || '-shigoto',
        s.id,
        s.shard_key,
        'enrich_shigoto',
        60,
        'queued',
        0,
        3,
        datetime('now'),
        datetime('now')
      FROM subsidy_cache s
      WHERE s.source = 'tokyo-shigoto'
        AND s.wall_chat_ready = 0
        AND json_extract(s.detail_json, '$.detailUrl') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM extraction_queue eq 
          WHERE eq.subsidy_id = s.id AND eq.job_type = 'enrich_shigoto' AND eq.status IN ('queued', 'leased')
        )
      LIMIT ?
    `).bind(MAX_ENQUEUE_PER_TYPE).run();

    // C) enrich_jgrants: jgrants 系（期限内）
    const enrichJgrantsRes = await db.prepare(`
      INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
      SELECT 
        'exq-' || s.id || '-jgrants',
        s.id,
        s.shard_key,
        'enrich_jgrants',
        70,
        'queued',
        0,
        3,
        datetime('now'),
        datetime('now')
      FROM subsidy_cache s
      WHERE s.source = 'jgrants'
        AND s.wall_chat_ready = 0
        AND (
          s.acceptance_end_datetime IS NULL 
          OR s.acceptance_end_datetime > datetime('now')
        )
        AND NOT EXISTS (
          SELECT 1 FROM extraction_queue eq 
          WHERE eq.subsidy_id = s.id AND eq.job_type = 'enrich_jgrants' AND eq.status IN ('queued', 'leased')
        )
      LIMIT ?
    `).bind(MAX_ENQUEUE_PER_TYPE).run();

    return c.json<ApiResponse<{
      shardAssigned: number;
      extractFormsEnqueued: number;
      enrichShigotoEnqueued: number;
      enrichJgrantsEnqueued: number;
    }>>({
      success: true,
      data: {
        shardAssigned,
        extractFormsEnqueued: extractFormsRes.meta.changes || 0,
        enrichShigotoEnqueued: enrichShigotoRes.meta.changes || 0,
        enrichJgrantsEnqueued: enrichJgrantsRes.meta.changes || 0,
      },
    });

  } catch (error) {
    console.error('Enqueue error:', error);
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
 * POST /api/admin-ops/extraction-queue/consume
 * super_admin からの手動 consume（Cron secret 不要）
 */
adminDashboard.post('/extraction-queue/consume', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const body = await c.req.json<{ shard?: number }>().catch(() => ({}));

  const MAX_CONSUME = 8;
  const LEASE_MINUTES = 8;
  const LEASE_OWNER = 'admin-manual-' + Date.now();

  // shard 自動選択：今日の日付 × 時間で 0-15
  const now = new Date();
  const shard = body.shard ?? ((now.getDate() + now.getHours()) % 16);

  try {
    // リース取得
    const leaseUntil = new Date(Date.now() + LEASE_MINUTES * 60 * 1000).toISOString();

    await db.prepare(`
      UPDATE extraction_queue
      SET status='leased', lease_owner=?, lease_until=?, updated_at=datetime('now')
      WHERE id IN (
        SELECT id FROM extraction_queue
        WHERE shard_key=? AND status='queued'
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
      )
    `).bind(LEASE_OWNER, leaseUntil, shard, MAX_CONSUME).run();

    // リースしたジョブを取得
    const jobs = await db.prepare(`
      SELECT id, subsidy_id, job_type, priority, attempts
      FROM extraction_queue
      WHERE lease_owner=? AND status='leased'
    `).bind(LEASE_OWNER).all<{
      id: string;
      subsidy_id: string;
      job_type: string;
      priority: number;
      attempts: number;
    }>();

    let done = 0;
    let failed = 0;
    const results: Array<{ id: string; subsidy_id: string; job_type: string; status: string; error?: string }> = [];

    for (const job of jobs.results || []) {
      try {
        if (job.job_type === 'extract_forms') {
          // extract_forms: 実際の抽出処理を呼び出す
          // extractAndUpdateSubsidy を import して使う（ここでは簡略化）
          const { extractAndUpdateSubsidy } = await import('../lib/pdf/pdf-extract-router');
          const { checkCooldown } = await import('../lib/pdf/extraction-cooldown');

          // subsidy 情報取得
          const subsidy = await db.prepare(`
            SELECT id, source, title, detail_json FROM subsidy_cache WHERE id = ?
          `).bind(job.subsidy_id).first<{
            id: string;
            source: string;
            title: string;
            detail_json: string;
          }>();

          if (!subsidy) {
            throw new Error('Subsidy not found');
          }

          const detailJson = JSON.parse(subsidy.detail_json || '{}');
          const detailUrl = detailJson.detailUrl || '';
          const pdfUrls = detailJson.pdfUrls || [];

          if (!detailUrl && pdfUrls.length === 0) {
            throw new Error('No URL to extract');
          }

          // Cooldown チェック
          const cooldown = await checkCooldown(db, subsidy.id);

          const extractSource = {
            subsidyId: subsidy.id,
            source: subsidy.source,
            title: subsidy.title,
            detailUrl,
            pdfUrls,
            existingDetailJson: subsidy.detail_json,
          };

          const extractResult = await extractAndUpdateSubsidy(extractSource, {
            FIRECRAWL_API_KEY: cooldown.allowFirecrawl ? c.env.FIRECRAWL_API_KEY : undefined,
            GOOGLE_CLOUD_API_KEY: cooldown.allowVision ? c.env.GOOGLE_CLOUD_API_KEY : undefined,
            allowFirecrawl: cooldown.allowFirecrawl,
            allowVision: cooldown.allowVision,
            DB: db, // P0: DB を必ず渡す（Freeze-COST-2）
            sourceId: subsidy.source,
          });

          // P0: CostGuard 発生時は feed_failures に落とす（Freeze-3）
          try {
            const { recordCostGuardFailure } = await import('../lib/failures/feed-failure-writer');
            const m = extractResult.metrics;
            const anyUrl = detailUrl || (pdfUrls?.[0] as string) || '';
            
            if (m.firecrawlBlockedByCostGuard) {
              await recordCostGuardFailure(db, {
                subsidy_id: subsidy.id,
                source_id: subsidy.source,
                url: anyUrl,
                stage: 'pdf',
                message: 'COST_GUARD_DB_MISSING: Firecrawl blocked (Freeze-COST-2)',
              });
            }
            if (m.visionBlockedByCostGuard) {
              await recordCostGuardFailure(db, {
                subsidy_id: subsidy.id,
                source_id: subsidy.source,
                url: anyUrl,
                stage: 'pdf',
                message: 'COST_GUARD_DB_MISSING: Vision OCR blocked (Freeze-COST-2)',
              });
            }
          } catch (e) {
            console.warn('[admin/consume] failed to record CostGuard feed_failures:', e);
          }

          // DB 更新
          if (extractResult.success || extractResult.isElectronicApplication) {
            await db.prepare(`
              UPDATE subsidy_cache 
              SET detail_json = ?, wall_chat_ready = ?, wall_chat_missing = ?
              WHERE id = ?
            `).bind(
              extractResult.newDetailJson,
              extractResult.wallChatReady ? 1 : 0,
              JSON.stringify(extractResult.wallChatMissing),
              subsidy.id
            ).run();
          }

          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'done' });
        } else if (job.job_type === 'enrich_jgrants') {
          // enrich_jgrants: JGrants API から詳細取得
          const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
          
          const subsidy = await db.prepare(`
            SELECT id, title, detail_json
            FROM subsidy_cache WHERE id = ? AND source = 'jgrants'
          `).bind(job.subsidy_id).first<{
            id: string;
            title: string;
            detail_json: string | null;
          }>();

          if (!subsidy) {
            throw new Error('Subsidy not found');
          }

          const JGRANTS_DETAIL_API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id';
          const response = await fetch(`${JGRANTS_DETAIL_API}/${subsidy.id}`, {
            headers: { 'Accept': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`JGrants API error: ${response.status}`);
          }

          const data = await response.json() as any;
          const subsidyData = data.result?.[0] || data.result || data;

          if (!subsidyData || !subsidyData.detail) {
            throw new Error('No detail in JGrants response');
          }

          const detailJson: Record<string, any> = {};

          // 概要
          if (subsidyData.detail && subsidyData.detail.length > 20) {
            detailJson.overview = subsidyData.detail
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 2000);
          }

          // 申請要件
          if (subsidyData.target_detail || subsidyData.outline_of_grant) {
            const reqText = (subsidyData.target_detail || subsidyData.outline_of_grant || '')
              .replace(/<[^>]+>/g, '\n')
              .replace(/&nbsp;/g, ' ')
              .trim();
            detailJson.application_requirements = reqText.split('\n')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length >= 5 && s.length <= 300)
              .slice(0, 20);
          }

          // 対象経費
          if (subsidyData.usage_detail) {
            const expText = subsidyData.usage_detail
              .replace(/<[^>]+>/g, '\n')
              .replace(/&nbsp;/g, ' ')
              .trim();
            detailJson.eligible_expenses = expText.split('\n')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length >= 5)
              .slice(0, 20);
          }

          // 必要書類・PDF URL
          if (subsidyData.application_form && Array.isArray(subsidyData.application_form)) {
            detailJson.required_documents = subsidyData.application_form
              .map((f: any) => f.name || f.title || f)
              .filter((s: any) => typeof s === 'string' && s.length >= 2)
              .slice(0, 20);
            detailJson.pdf_urls = subsidyData.application_form
              .filter((f: any) => f.url && f.url.endsWith('.pdf'))
              .map((f: any) => f.url);
          }

          if (subsidyData.acceptance_end_datetime) {
            detailJson.acceptance_end_datetime = subsidyData.acceptance_end_datetime;
          }
          if (subsidyData.subsidy_max_limit) {
            detailJson.subsidy_max_limit = subsidyData.subsidy_max_limit;
          }
          if (subsidyData.subsidy_rate) {
            detailJson.subsidy_rate = subsidyData.subsidy_rate;
          }

          // マージして保存
          const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now') WHERE id = ?
          `).bind(JSON.stringify(merged), subsidy.id).run();

          // WALL_CHAT_READY 判定
          const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
          if (readyResult.ready) {
            await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
              .bind(subsidy.id).run();
          }

          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'done' });
        } else if (job.job_type === 'enrich_shigoto') {
          // enrich_shigoto: tokyo-shigoto の HTML から詳細取得
          const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');

          const subsidy = await db.prepare(`
            SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
            FROM subsidy_cache WHERE id = ? AND source = 'tokyo-shigoto'
          `).bind(job.subsidy_id).first<{
            id: string;
            title: string;
            detail_json: string | null;
            detail_url: string | null;
          }>();

          if (!subsidy || !subsidy.detail_url) {
            throw new Error('Subsidy not found or no detail URL');
          }

          const response = await fetch(subsidy.detail_url, {
            headers: {
              'Accept': 'text/html',
              'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
            },
          });

          if (!response.ok) {
            throw new Error(`HTML fetch error: ${response.status}`);
          }

          const html = await response.text();
          const detailJson: Record<string, any> = {};

          // 表から概要抽出
          const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
          if (tableMatch) {
            const tableText = tableMatch[1]
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (tableText.length > 50) {
              detailJson.overview = tableText.substring(0, 1500);
            }
          }

          // 年度末をデフォルト締切
          const now = new Date();
          const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          detailJson.acceptance_end_datetime = `${fiscalYear + 1}-03-31T23:59:59Z`;
          detailJson.required_documents = ['募集要項', '申請書', '事業計画書'];

          // マージして保存
          const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now') WHERE id = ?
          `).bind(JSON.stringify(merged), subsidy.id).run();

          // WALL_CHAT_READY 判定
          const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
          if (readyResult.ready) {
            await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
              .bind(subsidy.id).run();
          }

          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'done' });
        } else {
          // 未知の job_type
          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'skipped' });
        }

        // ジョブ完了
        await db.prepare(`
          UPDATE extraction_queue
          SET status='done', lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
          WHERE id=?
        `).bind(job.id).run();

        done++;
      } catch (e: any) {
        const attempts = (job.attempts || 0) + 1;
        const nextStatus = attempts >= 5 ? 'failed' : 'queued';

        await db.prepare(`
          UPDATE extraction_queue
          SET status=?, attempts=?, last_error=?, lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
          WHERE id=?
        `).bind(nextStatus, attempts, String(e?.message || e).slice(0, 500), job.id).run();

        results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'error', error: String(e?.message || e).slice(0, 200) });
        failed++;
      }
    }

    return c.json<ApiResponse<{
      shard: number;
      leased: number;
      done: number;
      failed: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        shard,
        leased: jobs.results?.length || 0,
        done,
        failed,
        results,
      },
    });

  } catch (error) {
    console.error('Consume error:', error);
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
 * POST /api/admin-ops/extraction-queue/retry-failed
 * 失敗ジョブを再キュー
 */
adminDashboard.post('/extraction-queue/retry-failed', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const body = await c.req.json<{ limit?: number }>().catch(() => ({}));
  const limit = Math.min(body.limit || 100, 500);

  try {
    const result = await db.prepare(`
      UPDATE extraction_queue
      SET status='queued', attempts=0, last_error=NULL, lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
      WHERE id IN (
        SELECT id FROM extraction_queue WHERE status='failed' LIMIT ?
      )
    `).bind(limit).run();

    return c.json<ApiResponse<{ retriedCount: number }>>({
      success: true,
      data: { retriedCount: result.meta.changes || 0 },
    });

  } catch (error) {
    console.error('Retry failed error:', error);
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
 * DELETE /api/admin-ops/extraction-queue/clear-done
 * 完了ジョブを削除
 */
adminDashboard.delete('/extraction-queue/clear-done', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;

  try {
    const result = await db.prepare(`
      DELETE FROM extraction_queue WHERE status='done'
    `).run();

    return c.json<ApiResponse<{ deletedCount: number }>>({
      success: true,
      data: { deletedCount: result.meta.changes || 0 },
    });

  } catch (error) {
    console.error('Clear done error:', error);
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
// APIコスト集計（Freeze-COST-0: api_cost_logs が唯一の真実）
// ============================================================

/**
 * GET /api/admin-ops/cost/summary
 * 
 * APIコストの実数集計（super_admin専用）
 * 
 * Query params:
 *   - days: 集計日数（デフォルト: 7）
 * 
 * Response:
 *   - summary: 期間内の総計
 *   - byService: サービス別内訳
 *   - byDate: 日別推移
 *   - topSubsidies: コスト上位補助金（上位10件）
 *   - recentErrors: 直近のエラー（最新20件）
 */
adminDashboard.get('/cost/summary', async (c) => {
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
adminDashboard.get('/cost/logs', async (c) => {
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
adminDashboard.get('/discovery/stats', async (c) => {
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
adminDashboard.get('/discovery/missing-fields', async (c) => {
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

adminDashboard.get('/jgrants/pdf-coverage', async (c) => {
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

adminDashboard.get('/jgrants/pdf-missing-types', async (c) => {
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

adminDashboard.get('/progress/wall-chat-ready', async (c) => {
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
adminDashboard.get('/ssot-diagnosis', async (c) => {
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

export default adminDashboard;

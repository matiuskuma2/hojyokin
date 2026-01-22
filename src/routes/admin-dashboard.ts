/**
 * 管理者ダッシュボード API
 * 
 * /api/admin/dashboard - KPI + キュー状況
 * /api/admin/costs - コスト集計（super_admin限定）
 * /api/admin/updates - 更新状況一覧
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
        ue.metadata,
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
    const lastMonthStart = new Date(new Date(monthStart).getTime() - 86400000).toISOString().slice(0, 7) + '-01';

    // OpenAI コスト
    const openaiCosts = await db.prepare(`
      SELECT 
        model,
        feature,
        SUM(CASE WHEN date(created_at) = ? THEN estimated_cost_usd ELSE 0 END) as today_cost,
        SUM(CASE WHEN date(created_at) >= ? THEN estimated_cost_usd ELSE 0 END) as month_cost,
        SUM(CASE WHEN date(created_at) = ? THEN total_tokens ELSE 0 END) as today_tokens,
        SUM(CASE WHEN date(created_at) >= ? THEN total_tokens ELSE 0 END) as month_tokens,
        COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as today_calls,
        COUNT(CASE WHEN date(created_at) >= ? THEN 1 END) as month_calls
      FROM usage_events
      WHERE provider = 'openai'
      GROUP BY model, feature
    `).bind(today, monthStart, today, monthStart, today, monthStart)
      .all<{
        model: string; feature: string;
        today_cost: number; month_cost: number;
        today_tokens: number; month_tokens: number;
        today_calls: number; month_calls: number;
      }>();

    // Firecrawl コスト
    const firecrawlCosts = await db.prepare(`
      SELECT 
        domain,
        SUM(CASE WHEN date(created_at) = ? THEN estimated_cost_usd ELSE 0 END) as today_cost,
        SUM(CASE WHEN date(created_at) >= ? THEN estimated_cost_usd ELSE 0 END) as month_cost,
        SUM(CASE WHEN date(created_at) = ? THEN pages_count ELSE 0 END) as today_pages,
        SUM(CASE WHEN date(created_at) >= ? THEN pages_count ELSE 0 END) as month_pages,
        COUNT(CASE WHEN date(created_at) = ? THEN 1 END) as today_calls,
        COUNT(CASE WHEN date(created_at) >= ? THEN 1 END) as month_calls,
        SUM(CASE WHEN success = 0 AND date(created_at) >= ? THEN 1 ELSE 0 END) as month_failures
      FROM usage_events
      WHERE provider = 'firecrawl'
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
        provider,
        SUM(estimated_cost_usd) as cost
      FROM usage_events
      WHERE provider IN ('openai', 'firecrawl')
        AND created_at >= date('now', '-30 days')
      GROUP BY date(created_at), provider
      ORDER BY date DESC
    `).all<{ date: string; provider: string; cost: number }>();

    // 合計
    const totals = await db.prepare(`
      SELECT 
        provider,
        SUM(CASE WHEN date(created_at) = ? THEN estimated_cost_usd ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN estimated_cost_usd ELSE 0 END) as month
      FROM usage_events
      WHERE provider IN ('openai', 'firecrawl', 'aws')
      GROUP BY provider
    `).bind(today, monthStart).all<{ provider: string; today: number; month: number }>();

    const totalsByProvider: Record<string, { today: number; month: number }> = {};
    for (const row of totals.results || []) {
      totalsByProvider[row.provider] = { today: row.today || 0, month: row.month || 0 };
    }

    // 前日比（急増検知用）
    const yesterdayCost = await db.prepare(`
      SELECT SUM(estimated_cost_usd) as cost
      FROM usage_events
      WHERE date(created_at) = date('now', '-1 day')
    `).first<{ cost: number }>();

    const todayCost = await db.prepare(`
      SELECT SUM(estimated_cost_usd) as cost
      FROM usage_events
      WHERE date(created_at) = date('now')
    `).first<{ cost: number }>();

    const costRatio = yesterdayCost?.cost && yesterdayCost.cost > 0
      ? (todayCost?.cost || 0) / yesterdayCost.cost
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
        SUM(CASE WHEN date(updated_at) = date('now') THEN 1 ELSE 0 END) as updated_today,
        SUM(CASE WHEN date(updated_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week,
        MIN(updated_at) as oldest_update
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

    const l1 = {
      total_prefectures: 47,
      registered_prefectures: coveredPrefectures.length,
      missing_prefectures: missingPrefectures,
      missing_count: missingPrefectures.length,
      coverage_rate: Math.round((coveredPrefectures.length / 47) * 100),
      by_region: l1_registered.results || [],
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
        COALESCE(target_area, 'unknown') as region,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN application_end < datetime('now') THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN date(updated_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week
      FROM subsidies
      GROUP BY target_area
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
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN date(created_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_week,
        SUM(CASE WHEN date(updated_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week,
        MIN(updated_at) as oldest_update,
        MAX(updated_at) as latest_update
      FROM subsidies
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
    const memberships = await db.prepare(`
      SELECT 
        cm.id as membership_id,
        cm.company_id,
        cm.role as membership_role,
        cm.created_at as membership_created
      FROM company_memberships cm
      WHERE cm.user_id = ?
      ORDER BY cm.created_at DESC
    `).bind(targetUser.id).all<{
      membership_id: string;
      company_id: string;
      membership_role: string;
      membership_created: string;
    }>();

    // 3. 紐づいている会社の詳細
    const companies = await db.prepare(`
      SELECT 
        c.*,
        cm.role as membership_role
      FROM companies c
      INNER JOIN company_memberships cm ON c.id = cm.company_id
      WHERE cm.user_id = ?
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

export default adminDashboard;

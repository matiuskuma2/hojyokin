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
    // source_registry の更新状況
    const registryStats = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        MAX(last_crawl_at) as last_crawl,
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

    // domain_policy 状況
    const domainStats = await db.prepare(`
      SELECT 
        blocked,
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

export default adminDashboard;

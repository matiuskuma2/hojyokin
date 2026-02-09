/**
 * 定点観測API (Koubo Monitor)
 * 
 * GET  /api/admin/monitors/dashboard  - ダッシュボード概要
 * GET  /api/admin/monitors/alerts     - アラート一覧（url_lost/needs_manual/discontinued）
 * GET  /api/admin/monitors/discoveries - 新規発見キュー
 * GET  /api/admin/monitors/:id        - 個別モニター詳細
 * POST /api/admin/monitors/:id/discontinue - 補助金廃止登録
 * POST /api/admin/monitors/:id/update-url  - URL手動更新
 * POST /api/admin/monitors/:id/schedule    - スケジュール変更
 * GET  /api/admin/monitors/crawl-log  - クロール実行履歴
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const monitors = new Hono<{ Bindings: Env; Variables: Variables }>();

// =============================
// ダッシュボード概要
// =============================
monitors.get('/dashboard', async (c) => {
  const db = c.env.DB;
  
  // 全体統計
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'url_lost' THEN 1 ELSE 0 END) as url_lost,
      SUM(CASE WHEN status = 'needs_manual' THEN 1 ELSE 0 END) as needs_manual,
      SUM(CASE WHEN status = 'discontinued' THEN 1 ELSE 0 END) as discontinued,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      SUM(CASE WHEN koubo_pdf_url IS NOT NULL THEN 1 ELSE 0 END) as with_pdf,
      SUM(CASE WHEN last_crawl_result = 'success' THEN 1 ELSE 0 END) as last_success,
      SUM(CASE WHEN crawl_schedule = 'pre_koubo' THEN 1 ELSE 0 END) as pre_koubo,
      SUM(CASE WHEN crawl_schedule = 'monthly' THEN 1 ELSE 0 END) as monthly,
      SUM(CASE WHEN next_crawl_at < datetime('now') THEN 1 ELSE 0 END) as overdue
    FROM koubo_monitors
  `).first();

  // 公募時期分布
  const periodDist = await db.prepare(`
    SELECT koubo_period_type, COUNT(*) as cnt
    FROM koubo_monitors
    GROUP BY koubo_period_type
    ORDER BY cnt DESC
  `).all();

  // 今日のアクション必要件数
  const actionRequired = await db.prepare(`
    SELECT COUNT(*) as cnt FROM koubo_monitors
    WHERE status IN ('url_lost', 'needs_manual')
       OR (next_crawl_at < datetime('now') AND status = 'active')
  `).first();

  // 新規発見件数
  const discoveries = await db.prepare(`
    SELECT COUNT(*) as cnt FROM koubo_discovery_queue
    WHERE status = 'pending'
  `).first();

  return c.json({
    success: true,
    data: {
      stats,
      period_distribution: periodDist.results,
      action_required: actionRequired?.cnt || 0,
      pending_discoveries: discoveries?.cnt || 0,
      generated_at: new Date().toISOString()
    }
  });
});

// =============================
// アラート一覧
// =============================
monitors.get('/alerts', async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status') || 'all';
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  let whereClause = '';
  if (status === 'url_lost') {
    whereClause = "WHERE km.status = 'url_lost'";
  } else if (status === 'needs_manual') {
    whereClause = "WHERE km.status = 'needs_manual'";
  } else if (status === 'discontinued') {
    whereClause = "WHERE km.status = 'discontinued'";
  } else if (status === 'overdue') {
    whereClause = "WHERE km.next_crawl_at < datetime('now') AND km.status = 'active'";
  } else {
    whereClause = "WHERE km.status IN ('url_lost', 'needs_manual') OR (km.next_crawl_at < datetime('now') AND km.status = 'active')";
  }

  const alerts = await db.prepare(`
    SELECT 
      km.subsidy_id,
      sc.title,
      sc.source,
      km.status,
      km.koubo_pdf_url,
      km.koubo_page_url,
      km.koubo_pdf_backup_urls,
      km.last_crawl_result,
      km.last_crawl_at,
      km.next_crawl_at,
      km.url_change_count,
      km.fallback_search_query,
      km.notes,
      km.updated_at,
      CASE 
        WHEN km.status = 'url_lost' THEN 'URL消失 - 再探索必要'
        WHEN km.status = 'needs_manual' THEN '手動対応必要'
        WHEN km.status = 'discontinued' THEN '補助金廃止'
        WHEN km.next_crawl_at < datetime('now') THEN 'クロール期限超過'
        ELSE 'OK'
      END as alert_message
    FROM koubo_monitors km
    LEFT JOIN subsidy_cache sc ON sc.id = km.subsidy_id
    ${whereClause}
    ORDER BY 
      CASE km.status
        WHEN 'url_lost' THEN 1
        WHEN 'needs_manual' THEN 2
        WHEN 'active' THEN 3
      END,
      km.updated_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await db.prepare(`
    SELECT COUNT(*) as cnt FROM koubo_monitors km ${whereClause}
  `).first();

  return c.json({
    success: true,
    data: {
      alerts: alerts.results,
      total: total?.cnt || 0,
      limit,
      offset
    }
  });
});

// =============================
// 新規発見キュー
// =============================
monitors.get('/discoveries', async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status') || 'pending';
  const limit = parseInt(c.req.query('limit') || '50');

  const items = await db.prepare(`
    SELECT 
      kdq.*,
      sc.title as parent_title
    FROM koubo_discovery_queue kdq
    LEFT JOIN subsidy_cache sc ON sc.id = kdq.discovered_from_subsidy_id
    WHERE kdq.status = ?
    ORDER BY kdq.created_at DESC
    LIMIT ?
  `).bind(status, limit).all();

  return c.json({
    success: true,
    data: items.results
  });
});

// =============================
// 個別モニター詳細
// =============================
monitors.get('/:id', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('id');

  const monitor = await db.prepare(`
    SELECT km.*, sc.title, sc.source, sc.acceptance_start_datetime, sc.acceptance_end_datetime
    FROM koubo_monitors km
    LEFT JOIN subsidy_cache sc ON sc.id = km.subsidy_id
    WHERE km.subsidy_id = ?
  `).bind(subsidyId).first();

  if (!monitor) {
    return c.json({ success: false, error: 'Monitor not found' }, 404);
  }

  // 最近のクロール履歴
  const crawlHistory = await db.prepare(`
    SELECT * FROM koubo_crawl_log
    WHERE subsidy_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(subsidyId).all();

  return c.json({
    success: true,
    data: {
      monitor,
      crawl_history: crawlHistory.results
    }
  });
});

// =============================
// 補助金廃止登録
// =============================
monitors.post('/:id/discontinue', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('id');
  const body = await c.req.json<{ reason?: string }>();

  await db.prepare(`
    UPDATE koubo_monitors 
    SET status = 'discontinued',
        discontinued_reason = ?,
        discontinued_at = datetime('now'),
        crawl_schedule = 'stopped',
        updated_at = datetime('now')
    WHERE subsidy_id = ?
  `).bind(body.reason || '補助金廃止', subsidyId).run();

  // クロール履歴にも記録
  await db.prepare(`
    INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, finished_at)
    VALUES (?, 'manual', 'subsidy_discontinued', datetime('now'))
  `).bind(subsidyId).run();

  return c.json({ success: true, message: `${subsidyId} を廃止として記録しました` });
});

// =============================
// URL手動更新
// =============================
monitors.post('/:id/update-url', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('id');
  const body = await c.req.json<{ pdf_url: string; page_url?: string }>();

  // 現在のURLをバックアップ履歴に追加
  const current = await db.prepare(`
    SELECT koubo_pdf_url, koubo_pdf_backup_urls FROM koubo_monitors WHERE subsidy_id = ?
  `).bind(subsidyId).first();

  let backups: string[] = [];
  if (current?.koubo_pdf_backup_urls) {
    try { backups = JSON.parse(current.koubo_pdf_backup_urls as string); } catch {}
  }
  if (current?.koubo_pdf_url) {
    backups.push(current.koubo_pdf_url as string);
  }

  await db.prepare(`
    UPDATE koubo_monitors 
    SET koubo_pdf_url = ?,
        koubo_page_url = COALESCE(?, koubo_page_url),
        koubo_pdf_backup_urls = ?,
        status = 'active',
        last_crawl_result = 'success',
        last_crawl_at = datetime('now'),
        next_crawl_at = datetime('now', '+30 days'),
        url_change_count = url_change_count + 1,
        last_url_change_at = datetime('now'),
        updated_at = datetime('now')
    WHERE subsidy_id = ?
  `).bind(body.pdf_url, body.page_url || null, JSON.stringify(backups), subsidyId).run();

  // 記録
  await db.prepare(`
    INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, found_pdf_url, previous_pdf_url, finished_at)
    VALUES (?, 'manual', 'new_url_found', ?, ?, datetime('now'))
  `).bind(subsidyId, body.pdf_url, current?.koubo_pdf_url || null).run();

  return c.json({ success: true, message: `${subsidyId} のURLを更新しました` });
});

// =============================
// スケジュール変更
// =============================
monitors.post('/:id/schedule', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('id');
  const body = await c.req.json<{
    crawl_schedule: string;
    koubo_period_type?: string;
    koubo_month_start?: number;
    koubo_month_end?: number;
    koubo_next_expected_at?: string;
  }>();

  await db.prepare(`
    UPDATE koubo_monitors 
    SET crawl_schedule = ?,
        koubo_period_type = COALESCE(?, koubo_period_type),
        koubo_month_start = COALESCE(?, koubo_month_start),
        koubo_month_end = COALESCE(?, koubo_month_end),
        koubo_next_expected_at = ?,
        next_crawl_at = CASE 
          WHEN ? = 'pre_koubo' AND ? IS NOT NULL 
          THEN date(?, '-14 days')
          WHEN ? = 'weekly' THEN datetime('now', '+7 days')
          WHEN ? = 'biweekly' THEN datetime('now', '+14 days')
          WHEN ? = 'monthly' THEN datetime('now', '+30 days')
          WHEN ? = 'quarterly' THEN datetime('now', '+90 days')
          ELSE next_crawl_at
        END,
        updated_at = datetime('now')
    WHERE subsidy_id = ?
  `).bind(
    body.crawl_schedule,
    body.koubo_period_type || null,
    body.koubo_month_start || null,
    body.koubo_month_end || null,
    body.koubo_next_expected_at || null,
    body.crawl_schedule, body.koubo_next_expected_at,
    body.koubo_next_expected_at || '',
    body.crawl_schedule, body.crawl_schedule,
    body.crawl_schedule, body.crawl_schedule,
    subsidyId
  ).run();

  return c.json({ success: true, message: `${subsidyId} のスケジュールを更新しました` });
});

// =============================
// クロール実行履歴
// =============================
monitors.get('/crawl-log', async (c) => {
  const db = c.env.DB;
  const limit = parseInt(c.req.query('limit') || '50');
  const result = c.req.query('result');

  let whereClause = '';
  if (result) {
    whereClause = `WHERE cl.result = '${result}'`;
  }

  const logs = await db.prepare(`
    SELECT cl.*, sc.title
    FROM koubo_crawl_log cl
    LEFT JOIN subsidy_cache sc ON sc.id = cl.subsidy_id
    ${whereClause}
    ORDER BY cl.created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return c.json({
    success: true,
    data: logs.results
  });
});

export default monitors;

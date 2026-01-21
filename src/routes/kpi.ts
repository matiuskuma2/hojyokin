import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * KPI API
 * - /api/kpi/daily   : 日次集計
 * - /api/kpi/domains : ドメイン別
 * - /api/kpi/queue   : キュー滞留
 *
 * 前提テーブル:
 * - crawl_queue(queue_id, domain_key, status, attempts, created_at, scheduled_at, started_at, finished_at, last_error, ...)
 * - domain_policy(domain_key, enabled, blocked_until, blocked_reason, success_count, failure_count, last_success_at, last_failure_at, last_error_code, ...)
 */

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function parseDays(q: string | undefined, def: number) {
  const n = Number(q);
  if (!Number.isFinite(n)) return def;
  return clampInt(Math.floor(n), 1, 365);
}

/**
 * /api/kpi/daily
 * 日次集計（picked/succeeded/failed/retried/domains_blocked）
 *
 * 仕様:
 * - days=7 のように指定。デフォルト 14日
 * - picked は started_at があるもの
 * - succeeded は status='done'
 * - failed は status='failed'
 * - retried は attempts>=1 のもの（当日中に動いた分）
 * - domains_blocked は domain_policy の enabled=0 または blocked_until>now の件数
 */
app.get('/daily', requireAuth, async (c) => {
  const days = parseDays(c.req.query('days'), 14);
  const { DB } = c.env;

  try {
    // domain_policy 側（現在ブロック中）
    const blocked = await DB.prepare(`
      SELECT COUNT(*) AS blocked_domains
      FROM domain_policy
      WHERE enabled = 0
         OR (blocked_until IS NOT NULL AND blocked_until > datetime('now'))
    `).first<{ blocked_domains: number }>();

    // crawl_queue 側（日次）
    // 何を基準日にするか: started_at を優先。無ければ created_at。
    const rows = await DB.prepare(`
      WITH base AS (
        SELECT
          date(COALESCE(started_at, created_at)) AS day,
          status,
          attempts,
          started_at,
          finished_at
        FROM crawl_queue
        WHERE COALESCE(started_at, created_at) >= datetime('now', '-' || ? || ' days')
      )
      SELECT
        day,
        SUM(CASE WHEN started_at IS NOT NULL THEN 1 ELSE 0 END) AS picked,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS succeeded,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN attempts >= 1 THEN 1 ELSE 0 END) AS retried
      FROM base
      GROUP BY day
      ORDER BY day DESC
    `).bind(days).all<{
      day: string;
      picked: number;
      succeeded: number;
      failed: number;
      retried: number;
    }>();

    return c.json<ApiResponse<{
      days: number;
      domains_blocked: number;
      rows: Array<{
        day: string;
        picked: number;
        succeeded: number;
        failed: number;
        retried: number;
      }>;
    }>>({
      success: true,
      data: {
        days,
        domains_blocked: blocked?.blocked_domains ?? 0,
        rows: rows.results ?? [],
      },
    });
  } catch (e) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(e) },
    }, 500);
  }
});

/**
 * /api/kpi/domains
 * ドメイン別の失敗率・ブロック状況
 *
 * 仕様:
 * - days=7 のように指定。デフォルト 14日
 * - failures/successes は crawl_queue から集計（status=done/failed）
 * - blocked は domain_policy を優先表示
 * - timeout_count は last_error に "timeout" を含む件数（運用の見える化）
 */
app.get('/domains', requireAuth, async (c) => {
  const days = parseDays(c.req.query('days'), 14);
  const limit = clampInt(Number(c.req.query('limit') ?? 200), 1, 1000);
  const { DB } = c.env;

  try {
    const rows = await DB.prepare(`
      WITH agg AS (
        SELECT
          domain_key,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS succeeded,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
          SUM(CASE WHEN last_error LIKE '%timeout%' THEN 1 ELSE 0 END) AS timeout_count,
          AVG(CASE
                WHEN started_at IS NOT NULL AND finished_at IS NOT NULL
                THEN (julianday(finished_at) - julianday(started_at)) * 86400
              END) AS avg_duration_sec
        FROM crawl_queue
        WHERE created_at >= datetime('now', '-' || ? || ' days')
          AND domain_key IS NOT NULL AND domain_key <> ''
        GROUP BY domain_key
      )
      SELECT
        COALESCE(dp.domain_key, agg.domain_key) AS domain_key,
        COALESCE(dp.enabled, 1) AS enabled,
        dp.blocked_until,
        dp.blocked_reason,
        dp.last_error_code,
        dp.last_failure_at,
        dp.last_success_at,
        COALESCE(agg.succeeded, 0) AS succeeded,
        COALESCE(agg.failed, 0) AS failed,
        COALESCE(agg.queued, 0) AS queued,
        COALESCE(agg.running, 0) AS running,
        COALESCE(agg.timeout_count, 0) AS timeout_count,
        COALESCE(agg.avg_duration_sec, NULL) AS avg_duration_sec,
        CASE
          WHEN (COALESCE(agg.succeeded,0) + COALESCE(agg.failed,0)) = 0 THEN NULL
          ELSE ROUND( (CAST(agg.failed AS REAL) / (agg.succeeded + agg.failed)) * 100, 2 )
        END AS failure_rate_pct
      FROM agg
      LEFT JOIN domain_policy dp ON dp.domain_key = agg.domain_key
      UNION ALL
      SELECT
        dp.domain_key,
        dp.enabled,
        dp.blocked_until,
        dp.blocked_reason,
        dp.last_error_code,
        dp.last_failure_at,
        dp.last_success_at,
        0,0,0,0,0,NULL,NULL
      FROM domain_policy dp
      WHERE dp.domain_key NOT IN (SELECT domain_key FROM agg)
      ORDER BY enabled ASC, failure_rate_pct DESC NULLS LAST, timeout_count DESC, failed DESC
      LIMIT ?
    `).bind(days, limit).all<{
      domain_key: string;
      enabled: number;
      blocked_until: string | null;
      blocked_reason: string | null;
      last_error_code: string | null;
      last_failure_at: string | null;
      last_success_at: string | null;
      succeeded: number;
      failed: number;
      queued: number;
      running: number;
      timeout_count: number;
      avg_duration_sec: number | null;
      failure_rate_pct: number | null;
    }>();

    return c.json<ApiResponse<{
      days: number;
      limit: number;
      domains: Array<{
        domain_key: string;
        enabled: boolean;
        blocked_until: string | null;
        blocked_reason: string | null;
        last_error_code: string | null;
        last_failure_at: string | null;
        last_success_at: string | null;
        succeeded: number;
        failed: number;
        queued: number;
        running: number;
        timeout_count: number;
        avg_duration_sec: number | null;
        failure_rate_pct: number | null;
      }>;
    }>>({
      success: true,
      data: {
        days,
        limit,
        domains: (rows.results ?? []).map(r => ({
          ...r,
          enabled: r.enabled === 1,
        })),
      },
    });
  } catch (e) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(e) },
    }, 500);
  }
});

/**
 * /api/kpi/queue
 * キュー滞留状況
 *
 * 仕様:
 * - status別件数
 * - 平均待機時間:
 *   - queued: now - created_at
 *   - running/done/failed: started_at - created_at
 * - 最古のqueued（詰まり監視）
 */
app.get('/queue', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const counts = await DB.prepare(`
      SELECT status, COUNT(*) AS cnt
      FROM crawl_queue
      GROUP BY status
    `).all<{ status: string; cnt: number }>();

    const avgQueuedWait = await DB.prepare(`
      SELECT
        AVG((julianday('now') - julianday(created_at)) * 86400) AS avg_wait_sec
      FROM crawl_queue
      WHERE status = 'queued'
    `).first<{ avg_wait_sec: number | null }>();

    const avgStartedWait = await DB.prepare(`
      SELECT
        AVG((julianday(started_at) - julianday(created_at)) * 86400) AS avg_wait_sec
      FROM crawl_queue
      WHERE started_at IS NOT NULL
    `).first<{ avg_wait_sec: number | null }>();

    const oldestQueued = await DB.prepare(`
      SELECT queue_id, url, domain_key, created_at, scheduled_at, attempts
      FROM crawl_queue
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).first<{
      queue_id: string;
      url: string;
      domain_key: string | null;
      created_at: string;
      scheduled_at: string | null;
      attempts: number;
    }>();

    // 参考: running の平均処理時間
    const avgDurationDone = await DB.prepare(`
      SELECT
        AVG((julianday(finished_at) - julianday(started_at)) * 86400) AS avg_duration_sec
      FROM crawl_queue
      WHERE finished_at IS NOT NULL AND started_at IS NOT NULL AND status = 'done'
    `).first<{ avg_duration_sec: number | null }>();

    return c.json<ApiResponse<{
      counts_by_status: Record<string, number>;
      avg_wait_sec_queued: number | null;
      avg_wait_sec_started: number | null;
      avg_duration_sec_done: number | null;
      oldest_queued: typeof oldestQueued | null;
    }>>({
      success: true,
      data: {
        counts_by_status: Object.fromEntries((counts.results ?? []).map(r => [r.status, r.cnt])),
        avg_wait_sec_queued: avgQueuedWait?.avg_wait_sec ?? null,
        avg_wait_sec_started: avgStartedWait?.avg_wait_sec ?? null,
        avg_duration_sec_done: avgDurationDone?.avg_duration_sec ?? null,
        oldest_queued: oldestQueued ?? null,
      },
    });
  } catch (e) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(e) },
    }, 500);
  }
});

export default app;

/**
 * Consumer - crawl_queue を処理するワーカー
 * 
 * 責務:
 * 1. crawl_queue から status='queued' を priority 順に取得
 * 2. Firecrawl でスクレイプ/クロール
 * 3. 成功: raw を R2 保存 → done
 * 4. 失敗: attempts++, last_error → 3回失敗で blocked
 * 
 * 重処理（PDF/巨大ファイル/LLM抽出）は AWS に委譲
 */

import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import type { Env, Variables } from '../types';
import { firecrawlScrape, type FirecrawlContext } from '../lib/cost';

type HonoEnv = { Bindings: Env; Variables: Variables };

// domain-utils から extractDomainKey を import
function extractDomainKey(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const parts = hostname.split('.');
    if (parts.length < 2) return hostname;
    if (hostname.endsWith('.go.jp') || hostname.endsWith('.lg.jp')) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  } catch {
    return 'unknown';
  }
}

// SHA-256 ハッシュ計算
async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const app = new Hono<HonoEnv>();

// 認証ミドルウェア（全ルートに適用）
app.use('/*', async (c, next) => {
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET not configured');
    return c.json({ success: false, error: 'AUTH_ERROR', message: 'Authentication not configured' }, 500);
  }
  return jwt({ secret: jwtSecret, alg: 'HS256' })(c, next);
});

/**
 * キューからジョブを取得して処理（手動トリガー用）
 * POST /api/consumer/run
 * Body: { limit?: number, kinds?: string[] }
 */
app.post('/run', async (c) => {
  const { env } = c;
  const body = await c.req.json().catch(() => ({}));
  const limit = Math.min(body.limit ?? 10, 50);
  const kinds = body.kinds ?? ['REGISTRY_CRAWL', 'SUBSIDY_CHECK', 'URL_CRAWL'];

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    details: [] as { queue_id: string; kind: string; url: string; status: string; error?: string }[]
  };

  try {
    // 1. キューから取得（status=queued, priority順, scheduled_at順）
    const kindPlaceholders = kinds.map(() => '?').join(',');
    const queue = await env.DB.prepare(`
      SELECT 
        queue_id, kind, scope, geo_id,
        subsidy_id, source_registry_id,
        url, domain_key,
        crawl_strategy, max_depth, priority,
        attempts, max_attempts
      FROM crawl_queue
      WHERE status = 'queued'
        AND kind IN (${kindPlaceholders})
        AND scheduled_at <= datetime('now')
      ORDER BY priority ASC, scheduled_at ASC
      LIMIT ?
    `).bind(...kinds, limit).all<{
      queue_id: string;
      kind: string;
      scope: string;
      geo_id: string | null;
      subsidy_id: string | null;
      source_registry_id: string | null;
      url: string;
      domain_key: string;
      crawl_strategy: string;
      max_depth: number;
      priority: number;
      attempts: number;
      max_attempts: number;
    }>();

    if (!queue.results?.length) {
      return c.json({
        success: true,
        data: { ...results, message: 'No queued jobs found' }
      });
    }

    // 2. 各ジョブを処理
    for (const job of queue.results) {
      results.processed++;

      // 2.1 domain_policy チェック
      const domainPolicy = await env.DB.prepare(`
        SELECT enabled, failure_count, consecutive_failures_threshold
        FROM domain_policy
        WHERE domain_key = ?
      `).bind(job.domain_key).first<{ enabled: number; failure_count: number; consecutive_failures_threshold: number }>();

      if (domainPolicy?.enabled === 0) {
        // ブロックされているドメイン
        await env.DB.prepare(`
          UPDATE crawl_queue
          SET status = 'blocked', last_error = 'Domain blocked', updated_at = datetime('now')
          WHERE queue_id = ?
        `).bind(job.queue_id).run();
        results.blocked++;
        results.details.push({ queue_id: job.queue_id, kind: job.kind, url: job.url, status: 'blocked', error: 'Domain blocked' });
        continue;
      }

      // 2.2 ステータスを running に更新
      await env.DB.prepare(`
        UPDATE crawl_queue
        SET status = 'running', started_at = datetime('now'), updated_at = datetime('now')
        WHERE queue_id = ?
      `).bind(job.queue_id).run();

      try {
        // 2.3 重処理判定（PDF/大きなファイルは AWS へ）
        const urlLower = job.url.toLowerCase();
        const isHeavy = urlLower.endsWith('.pdf') || 
                        urlLower.endsWith('.docx') || 
                        urlLower.endsWith('.xlsx') ||
                        job.crawl_strategy === 'crawl' && job.max_depth > 1;

        if (isHeavy) {
          // TODO: AWS SQS へ送信
          // 今は保留状態にしてスキップ
          await env.DB.prepare(`
            UPDATE crawl_queue
            SET status = 'queued', last_error = 'Heavy job - AWS pending', updated_at = datetime('now')
            WHERE queue_id = ?
          `).bind(job.queue_id).run();
          results.skipped++;
          results.details.push({ queue_id: job.queue_id, kind: job.kind, url: job.url, status: 'skipped', error: 'Heavy job - AWS pending' });
          continue;
        }

        // 2.4 Firecrawl スクレイプ（Freeze-COST-2: wrapper経由必須）
        const firecrawlKey = env.FIRECRAWL_API_KEY;
        if (!firecrawlKey) {
          throw new Error('FIRECRAWL_API_KEY not configured');
        }

        const fcCtx: FirecrawlContext = {
          db: env.DB,
          apiKey: firecrawlKey,
          subsidyId: job.subsidy_id || undefined,
          sourceId: job.source_registry_id || undefined,
        };
        const scrapeResult = await firecrawlScrape(job.url, fcCtx);

        if (!scrapeResult.success || !scrapeResult.text) {
          throw new Error(scrapeResult.error || 'No markdown returned');
        }

        const markdown = scrapeResult.text;
        const contentHash = await computeHash(markdown);

        // 2.5 R2 に raw 保存
        const urlHash = await computeHash(job.url);
        const rawKey = job.subsidy_id
          ? `raw/${job.subsidy_id}/${urlHash}.md`
          : `raw/registry/${job.source_registry_id ?? 'unknown'}/${urlHash}.md`;

        await env.R2_KNOWLEDGE.put(rawKey, markdown, {
          httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
          customMetadata: {
            url: job.url,
            kind: job.kind,
            scope: job.scope,
            crawled_at: new Date().toISOString()
          }
        });

        // 2.6 成功 → done
        await env.DB.prepare(`
          UPDATE crawl_queue
          SET status = 'done',
              finished_at = datetime('now'),
              result_raw_key = ?,
              result_hash = ?,
              updated_at = datetime('now')
          WHERE queue_id = ?
        `).bind(rawKey, contentHash, job.queue_id).run();

        // 2.7 domain_policy の failure_count をリセット、成功カウントを増加
        await env.DB.prepare(`
          UPDATE domain_policy
          SET failure_count = 0, success_count = success_count + 1, last_success_at = datetime('now'), updated_at = datetime('now')
          WHERE domain_key = ?
        `).bind(job.domain_key).run();

        results.succeeded++;
        results.details.push({ queue_id: job.queue_id, kind: job.kind, url: job.url, status: 'done' });

      } catch (err) {
        // 2.8 失敗処理
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newAttempts = job.attempts + 1;
        const newStatus = newAttempts >= job.max_attempts ? 'failed' : 'queued';

        await env.DB.prepare(`
          UPDATE crawl_queue
          SET status = ?,
              attempts = ?,
              last_error = ?,
              finished_at = datetime('now'),
              updated_at = datetime('now')
          WHERE queue_id = ?
        `).bind(newStatus, newAttempts, errorMsg.substring(0, 500), job.queue_id).run();

        // domain_policy の failure_count を増加
        await env.DB.prepare(`
          INSERT INTO domain_policy (domain_key, enabled, failure_count, created_at, updated_at)
          VALUES (?, 1, 1, datetime('now'), datetime('now'))
          ON CONFLICT(domain_key) DO UPDATE SET
            failure_count = failure_count + 1,
            last_failure_at = datetime('now'),
            last_error_code = ?,
            updated_at = datetime('now')
        `).bind(job.domain_key, errorMsg.substring(0, 100)).run();

        // 連続失敗閾値を超えたら自動ブロック
        const policy = await env.DB.prepare(`
          SELECT failure_count, consecutive_failures_threshold FROM domain_policy WHERE domain_key = ?
        `).bind(job.domain_key).first<{ failure_count: number; consecutive_failures_threshold: number }>();
        
        const threshold = policy?.consecutive_failures_threshold ?? 3;
        if (policy && policy.failure_count >= threshold) {
          await env.DB.prepare(`
            UPDATE domain_policy
            SET enabled = 0, blocked_until = datetime('now', '+7 days'), notes = 'Auto-blocked: exceeded failure threshold', updated_at = datetime('now')
            WHERE domain_key = ?
          `).bind(job.domain_key).run();
        }

        results.failed++;
        results.details.push({ queue_id: job.queue_id, kind: job.kind, url: job.url, status: newStatus, error: errorMsg.substring(0, 100) });
      }
    }

    // 3. KPI 記録
    try {
      await env.DB.prepare(`
        INSERT INTO crawl_stats (id, stat_day, metric, value, created_at)
        VALUES (?, date('now'), 'consumer_processed', ?, datetime('now'))
      `).bind(crypto.randomUUID(), results.processed).run();

      await env.DB.prepare(`
        INSERT INTO crawl_stats (id, stat_day, metric, value, created_at)
        VALUES (?, date('now'), 'consumer_succeeded', ?, datetime('now'))
      `).bind(crypto.randomUUID(), results.succeeded).run();

      await env.DB.prepare(`
        INSERT INTO crawl_stats (id, stat_day, metric, value, created_at)
        VALUES (?, date('now'), 'consumer_failed', ?, datetime('now'))
      `).bind(crypto.randomUUID(), results.failed).run();
    } catch {
      // KPI 失敗しても続行
    }

    return c.json({ success: true, data: results });

  } catch (err) {
    console.error('Consumer run error:', err);
    return c.json({
      success: false,
      error: 'CONSUMER_ERROR',
      message: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});

/**
 * キュー状態の確認
 * GET /api/consumer/status
 */
app.get('/status', async (c) => {
  const { env } = c;

  try {
    const stats = await env.DB.prepare(`
      SELECT 
        status,
        kind,
        COUNT(*) as count
      FROM crawl_queue
      GROUP BY status, kind
      ORDER BY status, kind
    `).all<{ status: string; kind: string; count: number }>();

    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    const details: { status: string; kind: string; count: number }[] = [];

    for (const row of stats.results ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + row.count;
      byKind[row.kind] = (byKind[row.kind] ?? 0) + row.count;
      details.push(row);
    }

    // 最近のジョブ
    const recent = await env.DB.prepare(`
      SELECT queue_id, kind, url, status, created_at, finished_at
      FROM crawl_queue
      ORDER BY created_at DESC
      LIMIT 10
    `).all<{
      queue_id: string;
      kind: string;
      url: string;
      status: string;
      created_at: string;
      finished_at: string | null;
    }>();

    return c.json({
      success: true,
      data: {
        summary: {
          total: Object.values(byStatus).reduce((a, b) => a + b, 0),
          byStatus,
          byKind
        },
        details,
        recent: recent.results ?? []
      }
    });

  } catch (err) {
    console.error('Consumer status error:', err);
    return c.json({
      success: false,
      error: 'STATUS_ERROR',
      message: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});

/**
 * 特定ジョブの再キュー
 * POST /api/consumer/requeue/:queueId
 */
app.post('/requeue/:queueId', async (c) => {
  const { env } = c;
  const queueId = c.req.param('queueId');

  try {
    const result = await env.DB.prepare(`
      UPDATE crawl_queue
      SET status = 'queued',
          attempts = 0,
          last_error = NULL,
          started_at = NULL,
          finished_at = NULL,
          updated_at = datetime('now')
      WHERE queue_id = ?
        AND status IN ('failed', 'blocked')
    `).bind(queueId).run();

    if (result.meta.changes === 0) {
      return c.json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Job not found or not in failed/blocked status'
      }, 404);
    }

    return c.json({ success: true, data: { queue_id: queueId, status: 'requeued' } });

  } catch (err) {
    console.error('Requeue error:', err);
    return c.json({
      success: false,
      error: 'REQUEUE_ERROR',
      message: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});

/**
 * 失敗/ブロック済みジョブの一括削除（クリーンアップ）
 * DELETE /api/consumer/cleanup?days=30
 */
app.delete('/cleanup', async (c) => {
  const { env } = c;
  const days = parseInt(c.req.query('days') ?? '30', 10);

  try {
    const result = await env.DB.prepare(`
      DELETE FROM crawl_queue
      WHERE status IN ('done', 'failed', 'blocked')
        AND finished_at < datetime('now', ?)
    `).bind(`-${days} days`).run();

    return c.json({
      success: true,
      data: { deleted: result.meta.changes }
    });

  } catch (err) {
    console.error('Cleanup error:', err);
    return c.json({
      success: false,
      error: 'CLEANUP_ERROR',
      message: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});

export default app;

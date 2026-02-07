/**
 * Admin Dashboard: 抽出キュー管理
 * 
 * GET    /extraction-queue/summary      - キューサマリー
 * POST   /extraction-queue/enqueue      - キュー投入
 * POST   /extraction-queue/consume      - キュー消化
 * POST   /extraction-queue/retry-failed - 失敗再試行
 * DELETE /extraction-queue/clear-done   - 完了クリア
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';

const queueManagement = new Hono<{ Bindings: Env; Variables: Variables }>();

queueManagement.get('/extraction-queue/summary', async (c) => {
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
queueManagement.post('/extraction-queue/enqueue', async (c) => {
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
    const { shardKey16 } = await import('../../lib/shard');
    
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
queueManagement.post('/extraction-queue/consume', async (c) => {
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
          const { extractAndUpdateSubsidy } = await import('../../lib/pdf/pdf-extract-router');
          const { checkCooldown } = await import('../../lib/pdf/extraction-cooldown');

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
            const { recordCostGuardFailure } = await import('../../lib/failures/feed-failure-writer');
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
          const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
          
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
          const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');

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
queueManagement.post('/extraction-queue/retry-failed', async (c) => {
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
queueManagement.delete('/extraction-queue/clear-done', async (c) => {
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



export default queueManagement;

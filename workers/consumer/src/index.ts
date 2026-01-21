/**
 * Consumer Worker - crawl_queue からジョブを取得して処理
 * 
 * 処理フロー:
 * 1) crawl_queue から status='queued' を priority順に取得
 * 2) status='running' に更新
 * 3) Firecrawl でクロール
 * 4) R2 に raw Markdown 保存
 * 5) D1 doc_object 更新
 * 6) status='done' に更新（失敗時は attempts++ して再キューイング）
 * 
 * 分岐ルール:
 * - 軽量（HTML/Markdown、50KB未満）→ Cloudflare で処理
 * - 重処理（PDF、crawl(max_depth>1)、大きいファイル）→ AWS へ SQS 投入
 */

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ENVIRONMENT: string;
  CONSUMER_BATCH_SIZE: string;
  CONSUMER_TIMEOUT_MS: string;
  FIRECRAWL_API_KEY?: string;
}

type QueueJob = {
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
  status: string;
  attempts: number;
  max_attempts: number;
};

type ConsumerResult = {
  now: string;
  jobs_picked: number;
  jobs_succeeded: number;
  jobs_failed: number;
  jobs_forwarded_to_aws: number;
};

/**
 * SHA-256 ハッシュを計算
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Firecrawl でスクレイプ
 */
async function firecrawlScrape(
  url: string,
  apiKey: string,
  timeoutMs: number
): Promise<{ success: boolean; markdown?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: Math.floor(timeoutMs / 1000)
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Firecrawl error: ${response.status} ${errorText}` };
    }

    const result = await response.json() as { success: boolean; data?: { markdown?: string } };
    if (!result.success || !result.data?.markdown) {
      return { success: false, error: 'Firecrawl returned no markdown' };
    }

    return { success: true, markdown: result.data.markdown };
  } catch (e) {
    clearTimeout(timeoutId);
    const errMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Firecrawl exception: ${errMsg}` };
  }
}

/**
 * R2 に raw Markdown を保存
 */
async function saveToR2(
  r2: R2Bucket,
  key: string,
  content: string
): Promise<void> {
  await r2.put(key, content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' }
  });
}

/**
 * ジョブを running に更新
 */
async function markRunning(db: D1Database, queueId: string): Promise<void> {
  await db.prepare(`
    UPDATE crawl_queue
    SET status = 'running', started_at = datetime('now'), updated_at = datetime('now')
    WHERE queue_id = ?
  `).bind(queueId).run();
}

/**
 * ジョブを done に更新
 */
async function markDone(
  db: D1Database,
  queueId: string,
  resultRawKey: string,
  resultHash: string
): Promise<void> {
  await db.prepare(`
    UPDATE crawl_queue
    SET status = 'done',
        finished_at = datetime('now'),
        result_raw_key = ?,
        result_hash = ?,
        updated_at = datetime('now')
    WHERE queue_id = ?
  `).bind(resultRawKey, resultHash, queueId).run();
}

/**
 * ジョブを failed に更新（リトライ上限到達）
 */
async function markFailed(
  db: D1Database,
  queueId: string,
  error: string
): Promise<void> {
  await db.prepare(`
    UPDATE crawl_queue
    SET status = 'failed',
        finished_at = datetime('now'),
        last_error = ?,
        updated_at = datetime('now')
    WHERE queue_id = ?
  `).bind(error, queueId).run();
}

/**
 * ジョブを queued に戻す（リトライ）
 */
async function markRetry(
  db: D1Database,
  queueId: string,
  error: string,
  attempts: number
): Promise<void> {
  await db.prepare(`
    UPDATE crawl_queue
    SET status = 'queued',
        attempts = ?,
        last_error = ?,
        scheduled_at = datetime('now', '+5 minutes'),
        started_at = NULL,
        updated_at = datetime('now')
    WHERE queue_id = ?
  `).bind(attempts, error, queueId).run();
}

/**
 * domain_policy の失敗カウントを増やす
 */
async function incrementDomainFailure(db: D1Database, domainKey: string): Promise<void> {
  // UPSERT: なければ作成、あれば failure_count++
  await db.prepare(`
    INSERT INTO domain_policy (domain_key, enabled, failure_count, created_at, updated_at)
    VALUES (?, 1, 1, datetime('now'), datetime('now'))
    ON CONFLICT(domain_key) DO UPDATE SET
      failure_count = failure_count + 1,
      updated_at = datetime('now')
  `).bind(domainKey).run();

  // 3回以上失敗で自動 blocked
  await db.prepare(`
    UPDATE domain_policy
    SET enabled = 0, blocked_reason = 'Auto-blocked: 3 consecutive failures', updated_at = datetime('now')
    WHERE domain_key = ? AND failure_count >= 3
  `).bind(domainKey).run();
}

/**
 * doc_object を更新または作成
 */
async function upsertDocObject(
  db: D1Database,
  job: QueueJob,
  rawKey: string,
  contentHash: string
): Promise<void> {
  // subsidy_id がある場合のみ doc_object を更新
  if (!job.subsidy_id) return;

  const urlHash = await sha256(job.url);
  const docId = `${job.subsidy_id}-${urlHash.substring(0, 8)}`;

  await db.prepare(`
    INSERT INTO doc_object (
      doc_id, subsidy_id, url, url_hash, r2_key_raw, content_hash,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ok', datetime('now'), datetime('now'))
    ON CONFLICT(doc_id) DO UPDATE SET
      r2_key_raw = ?,
      content_hash = ?,
      status = 'ok',
      updated_at = datetime('now')
  `).bind(
    docId, job.subsidy_id, job.url, urlHash, rawKey, contentHash,
    rawKey, contentHash
  ).run();
}

/**
 * 重処理が必要か判定
 * - PDF/Word/Excel → AWS
 * - max_depth > 1 → AWS
 * - その他 → Cloudflare
 */
function needsHeavyProcessing(job: QueueJob): boolean {
  // URLの拡張子をチェック
  const url = job.url.toLowerCase();
  if (url.endsWith('.pdf') || url.endsWith('.docx') || url.endsWith('.xlsx')) {
    return true;
  }
  // crawl で max_depth > 1 は重処理
  if (job.crawl_strategy === 'crawl' && job.max_depth > 1) {
    return true;
  }
  return false;
}

/**
 * AWS へ SQS 投入（将来実装）
 */
async function forwardToAWS(job: QueueJob): Promise<void> {
  // TODO: AWS SQS への投入を実装
  // 今は単にログだけ
  console.log(`[FORWARD_TO_AWS] job=${job.queue_id} url=${job.url}`);
}

/**
 * Consumer メイン処理
 */
async function runConsumer(env: Env, batchSize: number, timeoutMs: number): Promise<ConsumerResult> {
  const now = new Date().toISOString();
  const db = env.DB;
  const r2 = env.R2;

  // Firecrawl API キーを取得
  const apiKey = env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error('[CONSUMER] FIRECRAWL_API_KEY not configured');
    return {
      now,
      jobs_picked: 0,
      jobs_succeeded: 0,
      jobs_failed: 0,
      jobs_forwarded_to_aws: 0
    };
  }

  // 1) crawl_queue から status='queued' を取得
  const jobs = await db.prepare(`
    SELECT queue_id, kind, scope, geo_id, subsidy_id, source_registry_id,
           url, domain_key, crawl_strategy, max_depth, priority, status, attempts, max_attempts
    FROM crawl_queue
    WHERE status = 'queued'
      AND scheduled_at <= datetime('now')
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT ?
  `).bind(batchSize).all<QueueJob>();

  const picked = jobs.results ?? [];
  let succeeded = 0;
  let failed = 0;
  let forwardedToAws = 0;

  // 2) 各ジョブを処理
  for (const job of picked) {
    // 重処理が必要なら AWS へ転送
    if (needsHeavyProcessing(job)) {
      await forwardToAWS(job);
      await db.prepare(`
        UPDATE crawl_queue
        SET status = 'done', result_raw_key = 'FORWARDED_TO_AWS', updated_at = datetime('now')
        WHERE queue_id = ?
      `).bind(job.queue_id).run();
      forwardedToAws++;
      continue;
    }

    // running に更新
    await markRunning(db, job.queue_id);

    // Firecrawl でスクレイプ
    const result = await firecrawlScrape(job.url, apiKey, timeoutMs);

    if (result.success && result.markdown) {
      // 成功: R2 に保存
      const contentHash = await sha256(result.markdown);
      const urlHash = await sha256(job.url);
      const rawKey = `raw/${job.kind.toLowerCase()}/${urlHash.substring(0, 8)}.md`;

      await saveToR2(r2, rawKey, result.markdown);
      await upsertDocObject(db, job, rawKey, contentHash);
      await markDone(db, job.queue_id, rawKey, contentHash);
      succeeded++;
    } else {
      // 失敗: リトライまたは failed
      const newAttempts = job.attempts + 1;
      const error = result.error ?? 'Unknown error';

      if (newAttempts >= job.max_attempts) {
        await markFailed(db, job.queue_id, error);
        await incrementDomainFailure(db, job.domain_key);
        failed++;
      } else {
        await markRetry(db, job.queue_id, error, newAttempts);
        // リトライ待ちなので succeeded/failed にはカウントしない
      }
    }
  }

  // KPI 記録
  try {
    await db.prepare(`
      INSERT INTO crawl_queue_stats (stat_id, stat_day, metric, scope, value)
      VALUES (?, date('now'), 'consumer_processed', 'ALL', ?)
    `).bind(crypto.randomUUID(), picked.length).run();
  } catch {
    // 無視
  }

  return {
    now,
    jobs_picked: picked.length,
    jobs_succeeded: succeeded,
    jobs_failed: failed,
    jobs_forwarded_to_aws: forwardedToAws
  };
}

export default {
  /**
   * Cron Trigger（5分ごと）
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const batchSize = parseInt(env.CONSUMER_BATCH_SIZE ?? '10', 10);
    const timeoutMs = parseInt(env.CONSUMER_TIMEOUT_MS ?? '30000', 10);

    const result = await runConsumer(env, batchSize, timeoutMs);
    console.log(`[CONSUMER_CRON] ${JSON.stringify(result)}`);
  },

  /**
   * HTTP Handler（手動実行・ヘルスチェック用）
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'hojyokin-consumer',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Manual run
    if (url.pathname === '/consumer/run') {
      const batchSize = parseInt(url.searchParams.get('batch') ?? env.CONSUMER_BATCH_SIZE ?? '10', 10);
      const timeoutMs = parseInt(url.searchParams.get('timeout') ?? env.CONSUMER_TIMEOUT_MS ?? '30000', 10);

      const result = await runConsumer(env, batchSize, timeoutMs);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Queue stats
    if (url.pathname === '/consumer/stats') {
      const stats = await env.DB.prepare(`
        SELECT status, COUNT(*) as count
        FROM crawl_queue
        GROUP BY status
      `).all<{ status: string; count: number }>();

      return new Response(JSON.stringify({
        success: true,
        data: {
          queue_stats: stats.results ?? [],
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'NOT_FOUND',
      message: `Route not found: ${request.method} ${url.pathname}`
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

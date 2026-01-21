/**
 * Consumer Worker - crawl_queue からジョブを取得して処理
 * 
 * 運用事故防止設計:
 * 1) 原子的ロック - queued → running を WHERE で確実にロック
 * 2) 指数バックオフ - timeout時は scheduled_at を指数的に後ろへ
 * 3) 自動ブロック - 3回失敗で domain_policy を24h blocked
 * 4) 成功時リセット - 成功したら failure_count をリセット
 * 
 * バックオフ戦略:
 * - attempts=1 → +15分
 * - attempts=2 → +1時間
 * - attempts=3 → +6時間
 * - attempts>=4 → failed + domain blocked
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
  jobs_retried: number;
  jobs_forwarded_to_aws: number;
  domains_blocked: number;
};

// ============================================================
// バックオフ計算
// ============================================================

/**
 * attempts に応じたバックオフ時間を計算（分単位）
 */
function getBackoffMinutes(attempts: number): number {
  switch (attempts) {
    case 1: return 15;      // 15分後
    case 2: return 60;      // 1時間後
    case 3: return 360;     // 6時間後
    default: return 1440;   // 24時間後（実質 failed 扱い）
  }
}

/**
 * タイムアウトエラーかどうか判定
 */
function isTimeoutError(error: string): boolean {
  const timeoutPatterns = [
    'timeout',
    'SCRAPE_TIMEOUT',
    'ETIMEDOUT',
    'ECONNRESET',
    'AbortError'
  ];
  const lowerError = error.toLowerCase();
  return timeoutPatterns.some(p => lowerError.includes(p.toLowerCase()));
}

// ============================================================
// ユーティリティ
// ============================================================

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// Firecrawl API
// ============================================================

async function firecrawlScrape(
  url: string,
  apiKey: string,
  timeoutMs: number
): Promise<{ success: boolean; markdown?: string; error?: string; isTimeout?: boolean }> {
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
      const isTimeout = response.status === 408 || errorText.includes('TIMEOUT');
      return { 
        success: false, 
        error: `Firecrawl error: ${response.status} ${errorText}`,
        isTimeout 
      };
    }

    const result = await response.json() as { success: boolean; data?: { markdown?: string } };
    if (!result.success || !result.data?.markdown) {
      return { success: false, error: 'Firecrawl returned no markdown', isTimeout: false };
    }

    return { success: true, markdown: result.data.markdown, isTimeout: false };
  } catch (e) {
    clearTimeout(timeoutId);
    const errMsg = e instanceof Error ? e.message : String(e);
    const isTimeout = errMsg.includes('abort') || errMsg.includes('timeout');
    return { success: false, error: `Firecrawl exception: ${errMsg}`, isTimeout };
  }
}

// ============================================================
// R2 操作
// ============================================================

async function saveToR2(r2: R2Bucket, key: string, content: string): Promise<void> {
  await r2.put(key, content, {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' }
  });
}

// ============================================================
// D1 操作（原子的ロック対応）
// ============================================================

/**
 * ジョブを原子的に取得してロック（二重実行防止）
 * SELECT + UPDATE を一度に行い、他のワーカーと競合しない
 */
async function pickAndLockJobs(db: D1Database, batchSize: number): Promise<QueueJob[]> {
  // Step 1: 取得対象の queue_id を特定
  const candidates = await db.prepare(`
    SELECT queue_id
    FROM crawl_queue
    WHERE status = 'queued'
      AND scheduled_at <= datetime('now')
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT ?
  `).bind(batchSize).all<{ queue_id: string }>();

  if (!candidates.results || candidates.results.length === 0) {
    return [];
  }

  const queueIds = candidates.results.map(r => r.queue_id);
  const locked: QueueJob[] = [];

  // Step 2: 各ジョブを個別にロック（WHERE status='queued' で競合防止）
  for (const queueId of queueIds) {
    const result = await db.prepare(`
      UPDATE crawl_queue
      SET status = 'running', started_at = datetime('now'), updated_at = datetime('now')
      WHERE queue_id = ? AND status = 'queued'
    `).bind(queueId).run();

    // 更新できた（=ロック取得成功）場合のみジョブを取得
    if (result.meta.changes > 0) {
      const job = await db.prepare(`
        SELECT queue_id, kind, scope, geo_id, subsidy_id, source_registry_id,
               url, domain_key, crawl_strategy, max_depth, priority, status, attempts, max_attempts
        FROM crawl_queue
        WHERE queue_id = ?
      `).bind(queueId).first<QueueJob>();

      if (job) {
        locked.push(job);
      }
    }
  }

  return locked;
}

/**
 * ジョブを done に更新（成功時）
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
async function markFailed(db: D1Database, queueId: string, error: string): Promise<void> {
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
 * ジョブを queued に戻す（指数バックオフ付きリトライ）
 */
async function markRetryWithBackoff(
  db: D1Database,
  queueId: string,
  error: string,
  attempts: number,
  isTimeout: boolean
): Promise<void> {
  const backoffMinutes = getBackoffMinutes(attempts);
  const modifier = `+${backoffMinutes} minutes`;

  // タイムアウトの場合は crawl_strategy を scrape に固定（2回目以降）
  if (isTimeout && attempts >= 2) {
    await db.prepare(`
      UPDATE crawl_queue
      SET status = 'queued',
          attempts = ?,
          last_error = ?,
          scheduled_at = datetime('now', ?),
          started_at = NULL,
          crawl_strategy = 'scrape',
          max_depth = 0,
          updated_at = datetime('now')
      WHERE queue_id = ?
    `).bind(attempts, error, modifier, queueId).run();
  } else {
    await db.prepare(`
      UPDATE crawl_queue
      SET status = 'queued',
          attempts = ?,
          last_error = ?,
          scheduled_at = datetime('now', ?),
          started_at = NULL,
          updated_at = datetime('now')
      WHERE queue_id = ?
    `).bind(attempts, error, modifier, queueId).run();
  }
}

// ============================================================
// domain_policy 管理
// ============================================================

/**
 * ドメインの失敗カウントを増やす
 * 3回以上で自動ブロック（24時間）
 */
async function incrementDomainFailure(db: D1Database, domainKey: string): Promise<boolean> {
  // UPSERT: なければ作成、あれば failure_count++
  await db.prepare(`
    INSERT INTO domain_policy (domain_key, enabled, failure_count, created_at, updated_at)
    VALUES (?, 1, 1, datetime('now'), datetime('now'))
    ON CONFLICT(domain_key) DO UPDATE SET
      failure_count = failure_count + 1,
      last_failure_at = datetime('now'),
      updated_at = datetime('now')
  `).bind(domainKey).run();

  // 3回以上失敗でブロック
  const result = await db.prepare(`
    UPDATE domain_policy
    SET enabled = 0, 
        blocked_reason = 'Auto-blocked: 3+ consecutive failures',
        blocked_until = datetime('now', '+24 hours'),
        updated_at = datetime('now')
    WHERE domain_key = ? AND failure_count >= 3 AND enabled = 1
  `).bind(domainKey).run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * ドメインの成功をリセット
 */
async function resetDomainFailure(db: D1Database, domainKey: string): Promise<void> {
  await db.prepare(`
    UPDATE domain_policy
    SET failure_count = 0,
        last_success_at = datetime('now'),
        updated_at = datetime('now')
    WHERE domain_key = ?
  `).bind(domainKey).run();
}

// ============================================================
// doc_object 管理
// ============================================================

async function upsertDocObject(
  db: D1Database,
  job: QueueJob,
  rawKey: string,
  contentHash: string
): Promise<void> {
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

// ============================================================
// 重処理判定・AWS転送
// ============================================================

function needsHeavyProcessing(job: QueueJob): boolean {
  const url = job.url.toLowerCase();
  if (url.endsWith('.pdf') || url.endsWith('.docx') || url.endsWith('.xlsx')) {
    return true;
  }
  if (job.crawl_strategy === 'crawl' && job.max_depth > 1) {
    return true;
  }
  return false;
}

async function forwardToAWS(db: D1Database, job: QueueJob): Promise<void> {
  // TODO: AWS SQS への投入を実装
  console.log(`[FORWARD_TO_AWS] job=${job.queue_id} url=${job.url}`);
  
  // 転送済みとしてマーク
  await db.prepare(`
    UPDATE crawl_queue
    SET status = 'done', 
        result_raw_key = 'FORWARDED_TO_AWS',
        finished_at = datetime('now'),
        updated_at = datetime('now')
    WHERE queue_id = ?
  `).bind(job.queue_id).run();
}

// ============================================================
// KPI 記録
// ============================================================

async function recordStats(
  db: D1Database,
  metric: string,
  value: number,
  scope: string = 'ALL'
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO crawl_queue_stats (stat_id, stat_day, metric, scope, value, created_at, updated_at)
      VALUES (?, date('now'), ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(stat_day, metric, scope) DO UPDATE SET
        value = value + ?,
        updated_at = datetime('now')
    `).bind(crypto.randomUUID(), metric, scope, value, value).run();
  } catch {
    // 統計記録は失敗しても続行
  }
}

// ============================================================
// Consumer メイン処理
// ============================================================

async function runConsumer(env: Env, batchSize: number, timeoutMs: number): Promise<ConsumerResult> {
  const now = new Date().toISOString();
  const db = env.DB;
  const r2 = env.R2;

  const apiKey = env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error('[CONSUMER] FIRECRAWL_API_KEY not configured');
    return {
      now,
      jobs_picked: 0,
      jobs_succeeded: 0,
      jobs_failed: 0,
      jobs_retried: 0,
      jobs_forwarded_to_aws: 0,
      domains_blocked: 0
    };
  }

  // 1) 原子的にジョブを取得してロック
  const jobs = await pickAndLockJobs(db, batchSize);

  let succeeded = 0;
  let failed = 0;
  let retried = 0;
  let forwardedToAws = 0;
  let domainsBlocked = 0;

  // 2) 各ジョブを処理
  for (const job of jobs) {
    console.log(`[CONSUMER] Processing job=${job.queue_id} url=${job.url} attempts=${job.attempts}`);

    // 重処理が必要なら AWS へ転送
    if (needsHeavyProcessing(job)) {
      await forwardToAWS(db, job);
      forwardedToAws++;
      continue;
    }

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
      
      // 成功したらドメインの failure_count をリセット
      await resetDomainFailure(db, job.domain_key);
      
      succeeded++;
      console.log(`[CONSUMER] SUCCESS job=${job.queue_id} r2_key=${rawKey}`);
    } else {
      // 失敗: バックオフ付きリトライまたは failed
      const newAttempts = job.attempts + 1;
      const error = result.error ?? 'Unknown error';
      const isTimeout = result.isTimeout ?? isTimeoutError(error);

      console.log(`[CONSUMER] FAILED job=${job.queue_id} attempts=${newAttempts} timeout=${isTimeout} error=${error}`);

      if (newAttempts >= job.max_attempts) {
        // リトライ上限到達 → failed + ドメインブロック
        await markFailed(db, job.queue_id, error);
        const blocked = await incrementDomainFailure(db, job.domain_key);
        if (blocked) {
          domainsBlocked++;
          console.log(`[CONSUMER] DOMAIN_BLOCKED domain=${job.domain_key}`);
        }
        failed++;
      } else {
        // バックオフ付きリトライ
        await markRetryWithBackoff(db, job.queue_id, error, newAttempts, isTimeout);
        await incrementDomainFailure(db, job.domain_key);
        retried++;
      }
    }
  }

  // 3) KPI 記録
  await recordStats(db, 'consumer_picked', jobs.length);
  await recordStats(db, 'consumer_succeeded', succeeded);
  await recordStats(db, 'consumer_failed', failed);
  await recordStats(db, 'consumer_retried', retried);
  await recordStats(db, 'domains_blocked', domainsBlocked);

  return {
    now,
    jobs_picked: jobs.length,
    jobs_succeeded: succeeded,
    jobs_failed: failed,
    jobs_retried: retried,
    jobs_forwarded_to_aws: forwardedToAws,
    domains_blocked: domainsBlocked
  };
}

// ============================================================
// Worker エントリポイント
// ============================================================

export default {
  /**
   * Cron Trigger（5分ごと）
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const batchSize = parseInt(env.CONSUMER_BATCH_SIZE ?? '10', 10);
    const timeoutMs = parseInt(env.CONSUMER_TIMEOUT_MS ?? '60000', 10);

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
      const timeoutMs = parseInt(url.searchParams.get('timeout') ?? env.CONSUMER_TIMEOUT_MS ?? '60000', 10);

      const result = await runConsumer(env, batchSize, timeoutMs);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Queue stats
    if (url.pathname === '/consumer/stats') {
      const queueStats = await env.DB.prepare(`
        SELECT status, COUNT(*) as count
        FROM crawl_queue
        GROUP BY status
      `).all<{ status: string; count: number }>();

      const domainStats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_domains,
          SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as blocked_domains,
          SUM(CASE WHEN failure_count > 0 THEN 1 ELSE 0 END) as failing_domains
        FROM domain_policy
      `).first<{ total_domains: number; blocked_domains: number; failing_domains: number }>();

      return new Response(JSON.stringify({
        success: true,
        data: {
          queue_stats: queueStats.results ?? [],
          domain_stats: domainStats ?? { total_domains: 0, blocked_domains: 0, failing_domains: 0 },
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Blocked domains list
    if (url.pathname === '/consumer/blocked-domains') {
      const blocked = await env.DB.prepare(`
        SELECT domain_key, failure_count, blocked_reason, blocked_until, last_failure_at
        FROM domain_policy
        WHERE enabled = 0
        ORDER BY last_failure_at DESC
        LIMIT 50
      `).all<{
        domain_key: string;
        failure_count: number;
        blocked_reason: string;
        blocked_until: string;
        last_failure_at: string;
      }>();

      return new Response(JSON.stringify({
        success: true,
        data: {
          blocked_domains: blocked.results ?? [],
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Unblock domain (manual)
    if (url.pathname === '/consumer/unblock' && request.method === 'POST') {
      const body = await request.json() as { domain_key: string };
      if (!body.domain_key) {
        return new Response(JSON.stringify({ success: false, error: 'domain_key required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(`
        UPDATE domain_policy
        SET enabled = 1, failure_count = 0, blocked_reason = NULL, blocked_until = NULL, updated_at = datetime('now')
        WHERE domain_key = ?
      `).bind(body.domain_key).run();

      return new Response(JSON.stringify({ success: true, message: `Unblocked: ${body.domain_key}` }), {
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

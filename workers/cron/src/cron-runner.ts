/**
 * Cron Runner - due抽出 → crawl_queue投入 → next更新
 * 
 * 変更点: crawl_job → crawl_queue へ移行
 * - crawl_job は url_id/subsidy_id NOT NULL で Cron 用途に不適
 * - crawl_queue は Cron 専用キュー（kind/scope/url ベース）
 * 
 * 冪等性:
 * - 先に next_* を更新してから crawl_queue を投入
 * - 重複投入は24h以内の同一kind+urlをスキップ
 */

import { extractDomainKey } from './domain-utils';
import { computeNextCrawlAtISO, computeNextCheckAtISO, UpdateFrequency } from './cron-utils';

export type CronRunResult = {
  now: string;
  registry_due: number;
  lifecycle_due: number;
  jobs_enqueued: number;
  jobs_skipped_domain_blocked: number;
  jobs_skipped_duplicate_guard: number;
};

type DueRegistryRow = {
  registry_id: string;
  scope: string;
  geo_id: string | null;
  root_url: string;
  crawl_strategy: string;
  max_depth: number;
  update_freq: UpdateFrequency;
  priority: number;
  enabled: number;
};

type DueLifecycleRow = {
  subsidy_id: string;
  status: string;
  priority: number;
};

type JobKind = 'REGISTRY_CRAWL' | 'SUBSIDY_CHECK' | 'URL_CRAWL';
type CrawlStrategy = 'scrape' | 'crawl' | 'map';

/**
 * domain_policy でブロックされているか確認
 */
async function isDomainBlocked(db: D1Database, domainKey: string): Promise<boolean> {
  try {
    const row = await db.prepare(`SELECT enabled FROM domain_policy WHERE domain_key=?`)
      .bind(domainKey).first<{ enabled: number }>();
    if (!row) return false; // 未登録は許可
    return row.enabled === 0;
  } catch {
    return false; // エラー時も止めない
  }
}

/**
 * crawl_queue にジョブ投入（重複ガード付き）
 */
async function insertQueue(
  db: D1Database,
  job: {
    kind: JobKind;
    scope: string;
    geo_id?: string | null;
    subsidy_id?: string | null;
    source_registry_id?: string | null;
    url: string;
    domain_key: string;
    crawl_strategy: CrawlStrategy;
    max_depth: number;
    priority: number;
  }
): Promise<{ inserted: boolean; skippedDuplicate: boolean }> {
  // 直近24hで同じkind+url が queued/running ならスキップ
  const dup = await db.prepare(`
    SELECT queue_id
    FROM crawl_queue
    WHERE kind = ?
      AND url = ?
      AND status IN ('queued','running')
      AND created_at >= datetime('now','-1 day')
    LIMIT 1
  `).bind(job.kind, job.url).first<{ queue_id: string }>();

  if (dup?.queue_id) return { inserted: false, skippedDuplicate: true };

  const queueId = crypto.randomUUID();
  
  await db.prepare(`
    INSERT INTO crawl_queue (
      queue_id, kind, scope, geo_id,
      subsidy_id, source_registry_id,
      url, domain_key,
      crawl_strategy, max_depth, priority,
      status, scheduled_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      'queued', datetime('now'), datetime('now'), datetime('now')
    )
  `).bind(
    queueId,
    job.kind,
    job.scope,
    job.geo_id ?? null,
    job.subsidy_id ?? null,
    job.source_registry_id ?? null,
    job.url,
    job.domain_key,
    job.crawl_strategy,
    job.max_depth,
    job.priority
  ).run();

  return { inserted: true, skippedDuplicate: false };
}

/**
 * source_registry の next_crawl_at を更新
 */
async function bumpRegistryNextCrawlAt(db: D1Database, registryId: string, freq: UpdateFrequency): Promise<void> {
  const next = computeNextCrawlAtISO(freq);
  await db.prepare(`
    UPDATE source_registry
    SET next_crawl_at = ?, updated_at = datetime('now')
    WHERE registry_id = ?
  `).bind(next, registryId).run();
}

/**
 * subsidy_lifecycle の next_check_at を更新
 */
async function bumpLifecycleNextCheckAt(db: D1Database, subsidyId: string, status: string, priority: number): Promise<void> {
  const { next, freq } = computeNextCheckAtISO(status, priority);
  await db.prepare(`
    UPDATE subsidy_lifecycle
    SET next_check_at = ?, check_frequency = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
    WHERE subsidy_id = ?
  `).bind(next, freq, subsidyId).run();
}

/**
 * Cron メイン処理
 */
export async function runCronOnce(db: D1Database, limitRegistry = 200, limitLifecycle = 50): Promise<CronRunResult> {
  const now = new Date().toISOString();

  // 1) source_registry の due 抽出（scope/geo_id/crawl_strategy/max_depth も取得）
  const registry = await db.prepare(`
    SELECT registry_id, scope, geo_id, root_url, crawl_strategy, max_depth, update_freq, priority, enabled
    FROM source_registry
    WHERE enabled = 1
      AND (next_crawl_at IS NULL OR next_crawl_at <= datetime('now'))
    ORDER BY priority ASC, next_crawl_at ASC
    LIMIT ?
  `).bind(limitRegistry).all<DueRegistryRow>();

  // 2) subsidy_lifecycle の due 抽出
  const lifecycle = await db.prepare(`
    SELECT subsidy_id, status, priority
    FROM subsidy_lifecycle
    WHERE (next_check_at IS NULL OR next_check_at <= datetime('now'))
    ORDER BY priority ASC, next_check_at ASC
    LIMIT ?
  `).bind(limitLifecycle).all<DueLifecycleRow>();

  let jobs_enqueued = 0;
  let jobs_skipped_domain_blocked = 0;
  let jobs_skipped_duplicate_guard = 0;

  // 3) 先に next_* を更新（冪等性確保）
  for (const r of registry.results ?? []) {
    await bumpRegistryNextCrawlAt(db, r.registry_id, r.update_freq);
  }
  for (const s of lifecycle.results ?? []) {
    await bumpLifecycleNextCheckAt(db, s.subsidy_id, s.status, s.priority);
  }

  // 4) registry → REGISTRY_CRAWL (crawl_queue へ)
  for (const r of registry.results ?? []) {
    const domainKey = extractDomainKey(r.root_url);
    if (await isDomainBlocked(db, domainKey)) {
      jobs_skipped_domain_blocked++;
      continue;
    }
    const ins = await insertQueue(db, {
      kind: 'REGISTRY_CRAWL',
      scope: r.scope ?? 'prefecture',
      geo_id: r.geo_id,
      subsidy_id: null,
      source_registry_id: r.registry_id,
      url: r.root_url,
      domain_key: domainKey,
      crawl_strategy: (r.crawl_strategy as CrawlStrategy) ?? 'scrape',
      max_depth: r.max_depth ?? 1,
      priority: r.priority ?? 4
    });
    if (ins.skippedDuplicate) jobs_skipped_duplicate_guard++;
    if (ins.inserted) jobs_enqueued++;
  }

  // 5) lifecycle → 代表URL（最大3件）→ SUBSIDY_CHECK
  for (const s of lifecycle.results ?? []) {
    // 代表URL候補: source_type/doc_type の優先順位で最大3件
    const urls = await db.prepare(`
      SELECT url, source_type, doc_type
      FROM source_url
      WHERE subsidy_id = ?
        AND status IN ('ok','pending','needs_review')
      ORDER BY
        CASE source_type
          WHEN 'secretariat' THEN 1
          WHEN 'prefecture' THEN 2
          WHEN 'city' THEN 3
          WHEN 'ministry' THEN 4
          WHEN 'portal' THEN 5
          ELSE 6
        END,
        CASE doc_type
          WHEN 'faq' THEN 1
          WHEN 'news' THEN 2
          WHEN 'guideline' THEN 3
          WHEN 'form' THEN 4
          ELSE 9
        END
      LIMIT 3
    `).bind(s.subsidy_id).all<{ url: string; source_type: string; doc_type: string | null }>();

    for (const u of urls.results ?? []) {
      const domainKey = extractDomainKey(u.url);
      if (await isDomainBlocked(db, domainKey)) {
        jobs_skipped_domain_blocked++;
        continue;
      }
      // SUBSIDY_CHECK の scope は source_type を使う
      const scope = ['secretariat', 'prefecture', 'city'].includes(u.source_type)
        ? u.source_type
        : 'national';
      
      const ins = await insertQueue(db, {
        kind: 'SUBSIDY_CHECK',
        scope: scope,
        geo_id: null, // subsidy から取得可能だが、今回は省略
        subsidy_id: s.subsidy_id,
        source_registry_id: null,
        url: u.url,
        domain_key: domainKey,
        crawl_strategy: 'scrape', // check は単ページ
        max_depth: 0,
        priority: s.priority ?? 3
      });
      if (ins.skippedDuplicate) jobs_skipped_duplicate_guard++;
      if (ins.inserted) jobs_enqueued++;
    }
  }

  // 6) KPI記録（失敗しても止めない）
  try {
    await db.prepare(`
      INSERT INTO crawl_stats (id, stat_day, metric, value, created_at)
      VALUES (?, date('now'), 'cron_jobs_enqueued', ?, datetime('now'))
    `).bind(crypto.randomUUID(), jobs_enqueued).run();
  } catch {
    // crawl_stats テーブルがなくても続行
  }

  return {
    now,
    registry_due: registry.results?.length ?? 0,
    lifecycle_due: lifecycle.results?.length ?? 0,
    jobs_enqueued,
    jobs_skipped_domain_blocked,
    jobs_skipped_duplicate_guard
  };
}

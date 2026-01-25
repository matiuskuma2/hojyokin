export interface Env {
  DB: D1Database;
  PAGES_BASE_URL: string;
  CRON_SECRET: string;
}

// ★ v3.5.2: 64分割で偏り対策
const SHARD_COUNT = 64;

// 1回のenqueueでやりすぎない（D1/CPU安全）
const ASSIGN_SHARD_BATCH = 800;     // shard_key未設定を毎回少しずつ埋める
const ENQUEUE_PER_TYPE = 800;       // job_typeごと投入上限（必要なら後で増やす）

// ★ v3.5.2: 1回で2shard消化（対角shardを同時に処理して偏り解消）
const CONSUME_SHARD_BATCH_RUNS = 2; // 1回のscheduledで消化するshard数

// ★ 優先度設定（締切ベース）
// 基本優先度: extract_forms=50, enrich_shigoto=60, enrich_jgrants=70
// 締切補正: 7日以内=-30, 30日以内=-15, それ以外=0
const BASE_PRIORITY = {
  extract_forms: 50,
  enrich_shigoto: 60,
  enrich_jgrants: 70,
};

/**
 * crc32 (fast, small) → shardKey16 = crc32(id) % 16
 */
function crc32(str: string): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();
function shardKey16(id: string): number {
  return crc32(id) % SHARD_COUNT;
}

// ★ v3.5.2: shard巡回（5分ごとに1 shard, 64分割）: UTCの分を使う
function currentShardBy5Min(d: Date = new Date()): number {
  const totalMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return Math.floor(totalMin / 5) % SHARD_COUNT;
}

// ★ v3.5.2: 対角shard（偏り対策: 反対側のshardを同時に処理）
function oppositeShardBy5Min(d: Date = new Date()): number {
  const primary = currentShardBy5Min(d);
  return (primary + Math.floor(SHARD_COUNT / 2)) % SHARD_COUNT;
}

/**
 * Pages の cron API を叩く（consumeだけはPages側の既存ロジックを利用）
 */
async function postToPages(path: string, env: Env): Promise<Response> {
  const url = new URL(path, env.PAGES_BASE_URL).toString();
  return fetch(url, {
    method: "POST",
    headers: {
      "X-Cron-Secret": env.CRON_SECRET,
    },
  });
}

/**
 * ★D1直 enqueue（締切ベースの動的優先度付き）
 *  - shard_key 未設定を少しずつ埋める（ASSIGN_SHARD_BATCH）
 *  - extraction_queue に job_type別で投入（INSERT OR IGNORE）
 *  - 締切が近い制度ほど priority を小さく（先に処理）
 */
async function enqueueToD1(env: Env) {
  const db = env.DB;

  // (A) shard_key を埋める（LIMIT分だけ）
  const unassigned = await db
    .prepare(`SELECT id FROM subsidy_cache WHERE shard_key IS NULL LIMIT ?`)
    .bind(ASSIGN_SHARD_BATCH)
    .all<{ id: string }>();

  if (unassigned.results?.length) {
    const stmts: D1PreparedStatement[] = [];
    for (const r of unassigned.results) {
      stmts.push(
        db.prepare(`UPDATE subsidy_cache SET shard_key = ? WHERE id = ?`).bind(shardKey16(r.id), r.id)
      );
    }
    await db.batch(stmts);
  }

  const now = new Date().toISOString();

  // ★ (B) extract_forms: 締切ベースの動的優先度
  // 7日以内: priority 20, 30日以内: priority 35, それ以外: priority 50
  const insertExtractForms = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue
      (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
    SELECT
      'exq-' || sc.id || '-extract',
      sc.id,
      sc.shard_key,
      'extract_forms',
      CASE
        WHEN sc.acceptance_end_datetime IS NOT NULL 
             AND sc.acceptance_end_datetime <= datetime('now', '+7 days') THEN 20
        WHEN sc.acceptance_end_datetime IS NOT NULL 
             AND sc.acceptance_end_datetime <= datetime('now', '+30 days') THEN 35
        ELSE 50
      END,
      'queued',
      0,
      5,
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND sc.detail_json IS NOT NULL AND sc.detail_json != '{}'
      AND (
        json_extract(sc.detail_json, '$.detailUrl') IS NOT NULL
        OR (json_extract(sc.detail_json, '$.pdfUrls') IS NOT NULL AND json_array_length(json_extract(sc.detail_json, '$.pdfUrls')) > 0)
      )
      -- ★ 締切が過去のものを除外（締切NULLは許可）
      AND (sc.acceptance_end_datetime IS NULL OR sc.acceptance_end_datetime > datetime('now'))
      AND NOT EXISTS (
        SELECT 1 FROM extraction_queue eq
        WHERE eq.subsidy_id = sc.id AND eq.job_type = 'extract_forms' AND eq.status IN ('queued','leased')
      )
    ORDER BY 
      CASE WHEN sc.acceptance_end_datetime IS NULL THEN 1 ELSE 0 END,
      sc.acceptance_end_datetime ASC
    LIMIT ?
  `).bind(now, now, ENQUEUE_PER_TYPE).run();

  // ★ (C) tokyo-shigoto enrich: 締切ベースの動的優先度
  // 7日以内: priority 30, 30日以内: priority 45, それ以外: priority 60
  const insertShigoto = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue
      (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
    SELECT
      'exq-' || sc.id || '-shigoto',
      sc.id,
      sc.shard_key,
      'enrich_shigoto',
      CASE
        WHEN sc.acceptance_end_datetime IS NOT NULL 
             AND sc.acceptance_end_datetime <= datetime('now', '+7 days') THEN 30
        WHEN sc.acceptance_end_datetime IS NOT NULL 
             AND sc.acceptance_end_datetime <= datetime('now', '+30 days') THEN 45
        ELSE 60
      END,
      'queued',
      0,
      3,
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.source = 'tokyo-shigoto'
      AND sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND json_extract(sc.detail_json, '$.detailUrl') IS NOT NULL
      -- ★ 締切が過去のものを除外（締切NULLは許可）
      AND (sc.acceptance_end_datetime IS NULL OR sc.acceptance_end_datetime > datetime('now'))
      AND NOT EXISTS (
        SELECT 1 FROM extraction_queue eq
        WHERE eq.subsidy_id = sc.id AND eq.job_type = 'enrich_shigoto' AND eq.status IN ('queued','leased')
      )
    ORDER BY 
      CASE WHEN sc.acceptance_end_datetime IS NULL THEN 1 ELSE 0 END,
      sc.acceptance_end_datetime ASC
    LIMIT ?
  `).bind(now, now, ENQUEUE_PER_TYPE).run();

  // ★ (D) jgrants enrich: 締切ベースの動的優先度
  // 7日以内: priority 40, 30日以内: priority 55, それ以外: priority 70
  const insertJgrants = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue
      (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
    SELECT
      'exq-' || sc.id || '-jgrants',
      sc.id,
      sc.shard_key,
      'enrich_jgrants',
      CASE
        WHEN sc.acceptance_end_datetime IS NOT NULL 
             AND sc.acceptance_end_datetime <= datetime('now', '+7 days') THEN 40
        WHEN sc.acceptance_end_datetime IS NOT NULL 
             AND sc.acceptance_end_datetime <= datetime('now', '+30 days') THEN 55
        ELSE 70
      END,
      'queued',
      0,
      3,
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.source = 'jgrants'
      AND sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND (sc.detail_json IS NULL OR sc.detail_json = '{}' OR LENGTH(sc.detail_json) < 100)
      AND (sc.acceptance_end_datetime IS NULL OR sc.acceptance_end_datetime > datetime('now'))
      AND NOT EXISTS (
        SELECT 1 FROM extraction_queue eq
        WHERE eq.subsidy_id = sc.id AND eq.job_type = 'enrich_jgrants' AND eq.status IN ('queued','leased')
      )
    ORDER BY 
      CASE WHEN sc.acceptance_end_datetime IS NULL THEN 1 ELSE 0 END,
      sc.acceptance_end_datetime ASC
    LIMIT ?
  `).bind(now, now, Math.floor(ENQUEUE_PER_TYPE / 4)).run();

  return {
    shardAssigned: unassigned.results?.length || 0,
    enqueued: {
      extract_forms: insertExtractForms.meta?.changes || 0,
      enrich_shigoto: insertShigoto.meta?.changes || 0,
      enrich_jgrants: insertJgrants.meta?.changes || 0,
    },
  };
}

export default {
  /**
   * scheduled: 5分ごと
   *  - ★ v3.5.2: shard を2つ消化（対角shardで偏り対策）
   *  - 00:00 UTC のときだけ D1直 enqueue
   *  - 毎日04:00 UTCにcleanup-queueも実行
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const now = new Date();

    // 00:00 UTC に enqueue（だけ）実行
    if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
      ctx.waitUntil(enqueueToD1(env));
    }
    
    // ★ v3.5.2: 04:00 UTC に cleanup-queue を実行（doneローテーション）
    if (now.getUTCHours() === 4 && now.getUTCMinutes() < 5) {
      ctx.waitUntil(postToPages('/api/cron/cleanup-queue', env));
    }

    // ★ v3.5.2: shard消化（2 shardを同時に処理）
    const shardA = currentShardBy5Min(now);
    const shardB = oppositeShardBy5Min(now);

    // 2つのshardを並列消化
    ctx.waitUntil(
      Promise.all([
        postToPages(`/api/cron/consume-extractions?shard=${shardA}`, env),
        postToPages(`/api/cron/consume-extractions?shard=${shardB}`, env),
      ])
    );
  },

  /**
   * 手動確認
   */
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (url.pathname === "/status") {
      return new Response(JSON.stringify({
        current_shard: currentShardBy5Min(new Date()),
        timestamp: new Date().toISOString(),
      }), { headers: { "Content-Type": "application/json" }});
    }

    if (url.pathname === "/enqueue" && req.method === "POST") {
      const result = await enqueueToD1(env);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/trigger" && req.method === "POST") {
      const shard = url.searchParams.get("shard");
      const s = shard ? Math.max(0, Math.min(15, parseInt(shard, 10) || 0)) : currentShardBy5Min(new Date());
      const res = await postToPages(`/api/cron/consume-extractions?shard=${s}`, env);
      const txt = await res.text();
      return new Response(txt, { headers: { "Content-Type": "application/json" } });
    }

    return new Response("ok", { status: 200 });
  },
};

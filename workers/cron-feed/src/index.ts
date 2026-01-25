/**
 * hojyokin-cron-feed
 *
 * 🔒 凍結Worker（Feed同期専用）
 *
 * 【責務】
 * - Cloudflare Workers Cron Trigger で起動される
 * - Pages API の /api/cron/* を順番に叩くだけ
 * - 順序保証: sync → promote の順で await 実行
 *
 * 【絶対にやらないこと】
 * - DB操作
 * - Firecrawl / PDF / OCR
 * - ループで大量処理
 * - ビジネスロジック判断
 *
 * 【拡張ルール】
 * - postCron を1本追加するだけ
 * - 既存の postCron は触らない
 *
 * ⚠️ 凍結注意
 *
 * この Worker に以下を追加するのは禁止：
 * - DB操作
 * - Firecrawl / OCR
 * - for/while ループ
 * - if による判断ロジック
 *
 * 理由：
 * - Feed 同期は Pages API + Queue で制御する設計のため
 */

export interface Env {
  PAGES_BASE_URL: string;
  CRON_SECRET: string;
}

/**
 * Pages API を叩く（await で順序保証）
 * 失敗時は throw でログが残る
 */
async function postCron(env: Env, path: string): Promise<string> {
  const url = `${env.PAGES_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Cron-Secret': env.CRON_SECRET,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();

  if (!res.ok) {
    console.error(`[cron-feed] FAILED ${path} status=${res.status} body=${text.slice(0, 500)}`);
    throw new Error(`cron failed: ${path} ${res.status}`);
  }
  console.log(`[cron-feed] OK ${path}`);
  return text;
}

export default {
  /**
   * Cron Trigger Entry
   * 
   * スケジュール: 毎日 06:00 JST (21:00 UTC)
   * 
   * 順序保証:
   * 1. sync-jnet21 (成功するまで待つ)
   * 2. promote-jnet21 (sync成功後にのみ実行)
   */
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ) {
    console.log('[cron-feed] start', new Date().toISOString());

    /**
     * ===============================
     * 1) Feed / Discover
     * ===============================
     */

    // J-Net21 RSS → discovery_items (stage=raw)
    await postCron(env, '/api/cron/sync-jnet21');

    /**
     * ===============================
     * 2) Promote（sync成功後にのみ実行）
     * ===============================
     */

    // discovery_items → subsidy_cache（品質判定後）
    await postCron(env, '/api/cron/promote-jnet21');

    /**
     * ===============================
     * 将来拡張（ここに足すだけ）
     * ===============================
     *
     * 例：
     * await postCron(env, '/api/cron/sync-pref-tokyo');
     * await postCron(env, '/api/cron/sync-pref-osaka');
     */

    console.log('[cron-feed] done');
  },

  /**
   * HTTP handler - ヘルスチェック用
   */
  async fetch(_req: Request, _env: Env): Promise<Response> {
    return Response.json({
      status: 'ok',
      worker: 'hojyokin-cron-feed',
      timestamp: new Date().toISOString(),
    });
  },
};

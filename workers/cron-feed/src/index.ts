/**
 * hojyokin-cron-feed
 *
 * 🔒 凍結Worker（Feed同期専用）
 *
 * 【責務】
 * - Cloudflare Workers Cron Trigger で起動される
 * - Pages API の /api/cron/* を順番に叩くだけ
 *
 * 【絶対にやらないこと】
 * - DB操作
 * - Firecrawl / PDF / OCR
 * - ループで大量処理
 * - 条件分岐による判断
 *
 * 【拡張ルール】
 * - fetch を1本追加するだけ
 * - 既存の fetch は触らない
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

async function callCron(
  env: Env,
  path: string,
  ctx: ExecutionContext
) {
  const url = `${env.PAGES_BASE_URL}${path}`;

  ctx.waitUntil(
    fetch(url, {
      method: 'POST',
      headers: {
        'X-Cron-Secret': env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
    }).then(async (res) => {
      if (!res.ok) {
        console.error(`[cron-feed] FAILED ${path}`, await res.text());
      } else {
        console.log(`[cron-feed] OK ${path}`);
      }
    }).catch((err) => {
      console.error(`[cron-feed] ERROR ${path}`, err);
    })
  );
}

export default {
  /**
   * Cron Trigger Entry
   * 
   * スケジュール: 毎日 06:00 JST (21:00 UTC)
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ) {
    console.log('[cron-feed] start', new Date().toISOString());

    /**
     * ===============================
     * Feed / Discover
     * ===============================
     */

    // J-Net21 RSS → discovery_items (stage=raw)
    callCron(env, '/api/cron/sync-jnet21', ctx);

    /**
     * ===============================
     * Promote
     * ===============================
     */

    // discovery_items → subsidy_cache（品質判定後）
    // sync の後に実行されるよう、少し遅延を入れる
    setTimeout(() => {
      callCron(env, '/api/cron/promote-jnet21', ctx);
    }, 60000); // 1分後

    /**
     * ===============================
     * 将来拡張（ここに足すだけ）
     * ===============================
     *
     * 例：
     * callCron(env, '/api/cron/sync-pref-tokyo', ctx);
     * callCron(env, '/api/cron/sync-pref-osaka', ctx);
     */

    console.log('[cron-feed] scheduled dispatched');
  },

  /**
   * HTTP handler - 手動実行・ステータス確認用
   */
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        worker: 'hojyokin-cron-feed',
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({ status: 'ok', worker: 'hojyokin-cron-feed' });
  },
};

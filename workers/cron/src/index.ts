/**
 * hojyokin-cron - Cron専用Worker
 * 
 * 役割:
 * - source_registry / subsidy_lifecycle のdue抽出
 * - crawl_job への投入（擬似Queue）
 * - domain_policy の尊重
 * 
 * スケジュール: 毎日 03:00 JST (18:00 UTC)
 */

import { runCronOnce } from './cron-runner';

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  CRON_REGISTRY_LIMIT?: string;
  CRON_LIFECYCLE_LIMIT?: string;
  CRON_MANUAL_TOKEN?: string;
}

export default {
  /**
   * Scheduled handler - Cloudflare Cron Triggers
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const limitRegistry = Number(env.CRON_REGISTRY_LIMIT ?? 200);
      const limitLifecycle = Number(env.CRON_LIFECYCLE_LIMIT ?? 50);
      
      try {
        const res = await runCronOnce(env.DB, limitRegistry, limitLifecycle);
        console.log('cron.ok', JSON.stringify(res));
      } catch (e) {
        console.error('cron.fail', String(e));
      }
    })());
  },

  /**
   * HTTP handler - 手動実行用（検証/緊急対応用）
   * 
   * GET /cron/run?limitRegistry=50&limitLifecycle=20
   * Header: x-cron-token: <CRON_MANUAL_TOKEN>
   */
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    
    // Health check
    if (url.pathname === '/health') {
      return Response.json({ 
        status: 'ok', 
        worker: 'hojyokin-cron',
        timestamp: new Date().toISOString() 
      });
    }
    
    // Cron manual trigger
    if (url.pathname === '/cron/run') {
      // 認証チェック
      const token = req.headers.get('x-cron-token');
      const expected = env.CRON_MANUAL_TOKEN;
      if (expected && token !== expected) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const limitRegistry = Number(url.searchParams.get('limitRegistry') ?? env.CRON_REGISTRY_LIMIT ?? 200);
      const limitLifecycle = Number(url.searchParams.get('limitLifecycle') ?? env.CRON_LIFECYCLE_LIMIT ?? 50);

      try {
        const res = await runCronOnce(env.DB, limitRegistry, limitLifecycle);
        return Response.json({ success: true, data: res });
      } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
      }
    }
    
    return Response.json({ success: false, error: 'Not Found' }, { status: 404 });
  }
};

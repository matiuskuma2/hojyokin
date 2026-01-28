/**
 * hojyokin-cron - Cron専用Worker
 * 
 * 役割:
 * - source_registry / subsidy_lifecycle のdue抽出
 * - crawl_job への投入（擬似Queue）
 * - domain_policy の尊重
 * - daily-ready-boost: Ready率最大化パイプライン（毎日実行）
 * 
 * スケジュール:
 * - 0 18 * * * (03:00 JST): sync-jgrants + daily-ready-boost
 * - 0 20 * * * (05:00 JST): daily-ready-boost のみ（追加実行）
 */

import { runCronOnce } from './cron-runner';
import { runDailyReadyBoost, type ReadyBoostResult } from './ready-boost';

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  CRON_REGISTRY_LIMIT?: string;
  CRON_LIFECYCLE_LIMIT?: string;
  CRON_MANUAL_TOKEN?: string;
  PAGES_API_URL?: string;    // Pages API URL (https://hojyokin.pages.dev)
  CRON_SECRET?: string;       // Pages API認証用
}

export default {
  /**
   * Scheduled handler - Cloudflare Cron Triggers
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const cron = event.cron;
      console.log(`[Cron] Triggered: ${cron}`);
      
      // 03:00 JST (18:00 UTC): フルパイプライン
      if (cron === '0 18 * * *') {
        // 1) Registry/Lifecycle処理
        const limitRegistry = Number(env.CRON_REGISTRY_LIMIT ?? 200);
        const limitLifecycle = Number(env.CRON_LIFECYCLE_LIMIT ?? 50);
        
        try {
          const res = await runCronOnce(env.DB, limitRegistry, limitLifecycle);
          console.log('[Cron] runCronOnce.ok', JSON.stringify(res));
        } catch (e) {
          console.error('[Cron] runCronOnce.fail', String(e));
        }
        
        // 2) Daily Ready Boost
        try {
          const boostRes = await runDailyReadyBoost(env.DB);
          console.log('[Cron] dailyReadyBoost.ok', JSON.stringify(boostRes));
        } catch (e) {
          console.error('[Cron] dailyReadyBoost.fail', String(e));
        }
      }
      
      // 05:00 JST (20:00 UTC): Ready Boost のみ
      if (cron === '0 20 * * *') {
        try {
          const boostRes = await runDailyReadyBoost(env.DB);
          console.log('[Cron] dailyReadyBoost.ok', JSON.stringify(boostRes));
        } catch (e) {
          console.error('[Cron] dailyReadyBoost.fail', String(e));
        }
      }
    })());
  },

  /**
   * HTTP handler - 手動実行用（検証/緊急対応用）
   * 
   * GET /health
   * GET /cron/run - Registry/Lifecycle処理
   * GET /cron/ready-boost - Daily Ready Boost
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
    
    // Ready Boost manual trigger
    if (url.pathname === '/cron/ready-boost') {
      const token = req.headers.get('x-cron-token');
      const expected = env.CRON_MANUAL_TOKEN;
      if (expected && token !== expected) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const res = await runDailyReadyBoost(env.DB);
        return Response.json({ success: true, data: res });
      } catch (e) {
        return Response.json({ success: false, error: String(e) }, { status: 500 });
      }
    }
    
    return Response.json({ success: false, error: 'Not Found' }, { status: 404 });
  }
};

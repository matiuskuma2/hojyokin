/**
 * hojyokin-cron Worker
 * 
 * Cloudflare Workers Cron Triggers で定期実行するスケジューラー。
 * 本体の hojyokin Pages アプリのCronエンドポイントを呼び出す。
 * 
 * スケジュール:
 * - 0 21 * * *    (06:00 JST): JGrants同期 + enrich + daily-ready-boost
 * - every 15 min:  izumiクロール (10件/回)
 * - 0 22 * * *    (07:00 JST): recalc-wall-chat-ready + cleanup
 */

interface Env {
  CRON_SECRET: string;
  APP_BASE_URL: string; // https://hojyokin.pages.dev
}

interface CronJob {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  timeoutMs: number;
}

// ========================================
// ジョブ定義
// ========================================

const DAILY_SYNC_JOBS: CronJob[] = [
  { name: 'sync-jgrants', endpoint: '/api/cron/sync-jgrants', method: 'POST', timeoutMs: 25000 },
  { name: 'enrich-jgrants', endpoint: '/api/cron/enrich-jgrants', method: 'POST', timeoutMs: 25000 },
  { name: 'daily-ready-boost', endpoint: '/api/cron/daily-ready-boost', method: 'POST', timeoutMs: 25000 },
];

const IZUMI_CRAWL_JOBS: CronJob[] = [
  { name: 'crawl-izumi-details', endpoint: '/api/cron/crawl-izumi-details?mode=upgrade', method: 'POST', timeoutMs: 28000 },
];

const DAILY_MAINTENANCE_JOBS: CronJob[] = [
  { name: 'recalc-wall-chat-ready', endpoint: '/api/cron/recalc-wall-chat-ready', method: 'POST', timeoutMs: 25000 },
  { name: 'consume-extractions', endpoint: '/api/cron/consume-extractions', method: 'POST', timeoutMs: 25000 },
  { name: 'cleanup-stuck-runs', endpoint: '/api/cron/cleanup-stuck-runs', method: 'POST', timeoutMs: 10000 },
];

// ========================================
// ジョブ実行
// ========================================

async function executeJob(env: Env, job: CronJob): Promise<{ success: boolean; data?: any; error?: string }> {
  const url = `${env.APP_BASE_URL}${job.endpoint}`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), job.timeoutMs);
    
    const response = await fetch(url, {
      method: job.method,
      headers: {
        'X-Cron-Secret': env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    const data = await response.json();
    console.log(`[${job.name}] ${response.status}: ${JSON.stringify(data).substring(0, 500)}`);
    
    return { success: response.ok, data };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${job.name}] ERROR: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

async function executeJobSequence(env: Env, jobs: CronJob[], label: string): Promise<void> {
  console.log(`=== ${label} started at ${new Date().toISOString()} ===`);
  
  for (const job of jobs) {
    const result = await executeJob(env, job);
    if (!result.success) {
      console.warn(`[${label}] Job ${job.name} failed, continuing...`);
    }
  }
  
  console.log(`=== ${label} completed at ${new Date().toISOString()} ===`);
}

// ========================================
// Scheduled Handler
// ========================================

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    
    switch (cron) {
      // 毎日 06:00 JST (21:00 UTC): メイン同期 + メンテナンス
      case '0 21 * * *':
        await executeJobSequence(env, DAILY_SYNC_JOBS, 'Daily Sync');
        await executeJobSequence(env, DAILY_MAINTENANCE_JOBS, 'Daily Maintenance');
        break;
      
      // 毎時: izumiクロール + extractions
      case '0 */1 * * *':
        await executeJobSequence(env, IZUMI_CRAWL_JOBS, 'Izumi Crawl');
        break;
      
      default:
        console.log(`Unknown cron: ${cron}`);
    }
  },
  
  // デバッグ用HTTPエンドポイント
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        worker: 'hojyokin-cron',
        app_base_url: env.APP_BASE_URL,
        has_secret: !!env.CRON_SECRET,
        schedules: [
          '0 21 * * * (06:00 JST): Daily Sync',
          '*/15 * * * * (every 15min): Izumi Crawl',
          '0 22 * * * (07:00 JST): Daily Maintenance',
        ],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 手動トリガー
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const { job } = await request.json() as { job: string };
      
      let jobs: CronJob[];
      let label: string;
      
      switch (job) {
        case 'sync':
          jobs = DAILY_SYNC_JOBS;
          label = 'Manual Sync';
          break;
        case 'crawl-izumi':
          jobs = IZUMI_CRAWL_JOBS;
          label = 'Manual Izumi Crawl';
          break;
        case 'maintenance':
          jobs = DAILY_MAINTENANCE_JOBS;
          label = 'Manual Maintenance';
          break;
        default:
          return new Response(JSON.stringify({ error: 'Unknown job. Use: sync, crawl-izumi, maintenance' }), { status: 400 });
      }
      
      // waitUntil で非同期実行
      const execCtx = {
        waitUntil: (promise: Promise<any>) => promise,
      };
      await executeJobSequence(env, jobs, label);
      
      return new Response(JSON.stringify({ success: true, job, label }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('hojyokin-cron worker', { status: 200 });
  },
};

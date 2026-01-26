/**
 * Cron Trigger Worker
 * 
 * Cloudflare Workers の Cron Triggers で定期実行し、
 * Pages アプリの /api/cron/* エンドポイントを呼び出す
 */

interface Env {
  PAGES_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const cron = event.cron;
    const startTime = Date.now();
    console.log(`[Cron] Triggered: ${cron} at ${new Date().toISOString()}`);

    if (!env.CRON_SECRET) {
      console.error('[Cron] CRON_SECRET not configured');
      return;
    }

    const baseUrl = env.PAGES_URL || 'https://hojyokin.pages.dev';
    let endpoint: string;

    // 実行するジョブを決定
    const jobs: string[] = [];
    
    switch (cron) {
      case '0 21 * * *': // 06:00 JST - sync + enrich を順次実行
        jobs.push('/api/cron/sync-jgrants', '/api/cron/enrich-jgrants');
        break;
      case '15 * * * *': // 毎時15分 - PDF抽出
        jobs.push('/api/cron/consume-extractions');
        break;
      default:
        console.warn(`[Cron] Unknown schedule: ${cron}`);
        return;
    }
    
    // 各ジョブを順次実行
    for (const endpoint of jobs) {

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'X-Cron-Secret': env.CRON_SECRET,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();
        console.log(`[Cron] ${endpoint} completed in ${Date.now() - startTime}ms:`, 
          response.status, JSON.stringify(result).substring(0, 500));
        
        // 次のジョブまで少し待機
        if (jobs.length > 1) {
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (error) {
        console.error(`[Cron] ${endpoint} failed:`, error);
      }
    }
  },

  // HTTP リクエストでも手動実行可能
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/trigger' && request.method === 'POST') {
      const secret = request.headers.get('X-Cron-Secret');
      if (secret !== env.CRON_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }

      const { job } = await request.json() as { job: string };
      const validJobs = ['sync-jgrants', 'enrich-jgrants', 'consume-extractions'];
      
      if (!validJobs.includes(job)) {
        return new Response(JSON.stringify({ error: 'Invalid job' }), { status: 400 });
      }

      const baseUrl = env.PAGES_URL || 'https://hojyokin.pages.dev';
      const response = await fetch(`${baseUrl}/api/cron/${job}`, {
        method: 'POST',
        headers: {
          'X-Cron-Secret': env.CRON_SECRET,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      return new Response(JSON.stringify({ triggered: job, result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Hojyokin Cron Worker', { status: 200 });
  },
};

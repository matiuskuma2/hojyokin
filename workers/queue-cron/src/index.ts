/**
 * hojyokin-queue-cron
 * 
 * 5分ごとに extraction_queue の shard を1つ消化する Workers Cron
 * 
 * 設計思想:
 * - 16 shard を 80分で一周（5分 × 16）
 * - 1回の実行で 1 shard だけ消化
 * - consume API を叩くだけなので軽量
 * - 失敗してもリトライ（キューに戻る）
 * 
 * 設定:
 * - wrangler secret put CRON_SECRET（Pagesと同じ値）
 */

export interface Env {
  PAGES_BASE_URL: string;
  CRON_SECRET: string;
}

/**
 * 現在時刻から shard 番号を計算（5分刻み）
 * UTC で固定、80分で 0-15 を一周
 */
function currentShardBy5Min(date = new Date()): number {
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return Math.floor(totalMinutes / 5) % 16;
}

/**
 * consume API を叩いてキューを消化
 */
async function consumeQueue(env: Env, shard: number): Promise<{
  success: boolean;
  leased?: number;
  done?: number;
  failed?: number;
  error?: string;
}> {
  const url = `${env.PAGES_BASE_URL}/api/cron/consume-extractions?shard=${shard}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Cron-Secret': env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json() as { success: boolean; data?: any };
    if (!json.success) {
      return { success: false, error: 'API returned failure' };
    }

    const data = json.data || {};
    return {
      success: true,
      leased: data.leased ?? 0,
      done: data.done ?? 0,
      failed: data.failed ?? 0,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * enqueue API を叩いてキューを補充（1日1回推奨）
 */
async function enqueueJobs(env: Env): Promise<{
  success: boolean;
  shardAssigned?: number;
  extractFormsEnqueued?: number;
  error?: string;
}> {
  const url = `${env.PAGES_BASE_URL}/api/cron/enqueue-extractions`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Cron-Secret': env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json() as { success: boolean; data?: any };
    if (!json.success) {
      return { success: false, error: 'API returned failure' };
    }

    const data = json.data || {};
    return {
      success: true,
      shardAssigned: data.updated_shard_key_rows ?? 0,
      extractFormsEnqueued: data.extract_forms_queued ?? 0,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export default {
  /**
   * Cron トリガー（5分ごと）
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const shard = currentShardBy5Min();
    const now = new Date();
    
    // 毎日 00:00-00:05 UTC に enqueue も実行（1日1回）
    const isEnqueueTime = now.getUTCHours() === 0 && now.getUTCMinutes() < 5;
    
    if (isEnqueueTime) {
      console.log(`[queue-cron] Running daily enqueue at ${now.toISOString()}`);
      const enqueueResult = await enqueueJobs(env);
      console.log(`[queue-cron] enqueue: success=${enqueueResult.success}, shardAssigned=${enqueueResult.shardAssigned ?? '-'}, extractForms=${enqueueResult.extractFormsEnqueued ?? '-'}, error=${enqueueResult.error ?? '-'}`);
    }
    
    // consume は常に実行
    const result = await consumeQueue(env, shard);
    console.log(`[queue-cron] shard=${shard} success=${result.success} leased=${result.leased ?? '-'} done=${result.done ?? '-'} failed=${result.failed ?? '-'} error=${result.error ?? '-'}`);
  },

  /**
   * HTTP トリガー（手動実行用）
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // /trigger?shard=N で手動実行
    if (url.pathname === '/trigger') {
      const shardParam = url.searchParams.get('shard');
      const shard = shardParam ? parseInt(shardParam, 10) : currentShardBy5Min();
      
      const result = await consumeQueue(env, shard);
      return new Response(JSON.stringify({ shard, ...result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // /enqueue で enqueue 実行
    if (url.pathname === '/enqueue') {
      const result = await enqueueJobs(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // /status で現在の shard を返す
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        current_shard: currentShardBy5Min(),
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('hojyokin-queue-cron\n\nEndpoints:\n- /status - Current shard\n- /trigger?shard=N - Trigger consume\n- /enqueue - Trigger enqueue', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};

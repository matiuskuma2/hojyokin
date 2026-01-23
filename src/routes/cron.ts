/**
 * Cron用API（外部Cronサービスから呼び出し）
 * 
 * POST /api/cron/sync-jgrants - JGrantsデータ同期
 * 
 * 認証: X-Cron-Secret ヘッダーで CRON_SECRET と照合
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';

const cron = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Cron用 JGrants同期エンドポイント
 * 
 * POST /api/cron/sync-jgrants
 * 
 * Header: X-Cron-Secret: {CRON_SECRET}
 * 
 * 外部Cronサービス（cron-job.org等）から日次で呼び出し
 */
cron.post('/sync-jgrants', async (c) => {
  const db = c.env.DB;
  
  // シークレット認証
  const cronSecret = c.req.header('X-Cron-Secret');
  const expectedSecret = (c.env as any).CRON_SECRET;
  
  if (!expectedSecret) {
    console.warn('CRON_SECRET not configured');
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Cron not configured',
      },
    }, 500);
  }
  
  if (cronSecret !== expectedSecret) {
    console.warn('Invalid cron secret attempt');
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid cron secret',
      },
    }, 401);
  }
  
  try {
    // 凍結キーワードセット（データ収集パイプライン v1.1）
    // 目標: 500件以上の補助金データを収集
    const KEYWORDS = [
      // 基本キーワード
      '補助金',
      '助成金', 
      '事業',
      // テーマ別
      'DX',
      'IT導入',
      '省エネ',
      '雇用',
      '設備投資',
      '製造業',
      'デジタル化',
      '創業',
      '販路開拓',
      '人材育成',
      '研究開発',
      '生産性向上',
      // 追加キーワード (v1.1)
      '中小企業',
      '小規模事業者',
      '新事業',
      '海外展開',
      '輸出',
      '観光',
      '農業',
      '介護',
      '福祉',
      '環境',
      'カーボンニュートラル',
      '脱炭素',
      'ものづくり',
      'サービス',
      'ECサイト',
      'テレワーク',
      '感染症対策',
      '賃上げ',
      '最低賃金',
      '事業承継',
      '再構築',
    ];
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>();
    const errors: string[] = [];
    
    for (const keyword of KEYWORDS) {
      try {
        const params = new URLSearchParams({
          keyword,
          sort: 'acceptance_end_datetime',
          order: 'DESC',
          acceptance: '1',
          limit: '200',
        });
        
        console.log(`Cron sync: keyword=${keyword}`);
        
        const response = await fetch(`${JGRANTS_API_URL}?${params.toString()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          errors.push(`${keyword}: API ${response.status}`);
          continue;
        }
        
        const data = await response.json() as any;
        const subsidies = data.result || data.subsidies || data.data || [];
        
        // 重複排除
        const uniqueSubsidies = subsidies.filter((s: any) => {
          if (seenIds.has(s.id)) return false;
          seenIds.add(s.id);
          return true;
        });
        
        if (uniqueSubsidies.length > 0) {
          const statements = uniqueSubsidies.map((s: any) => 
            db.prepare(`
              INSERT OR REPLACE INTO subsidy_cache 
              (id, source, title, subsidy_max_limit, subsidy_rate,
               target_area_search, target_industry, target_number_of_employees,
               acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
               cached_at, expires_at)
              VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            `).bind(
              s.id,
              s.title || s.name || '',
              s.subsidy_max_limit || null,
              s.subsidy_rate || null,
              s.target_area_search || null,
              s.target_industry || null,
              s.target_number_of_employees || null,
              s.acceptance_start_datetime || null,
              s.acceptance_end_datetime || null,
              s.request_reception_display_flag ?? 1,
              expiresAt
            )
          );
          
          // D1バッチ実行（100件ごと）
          for (let i = 0; i < statements.length; i += 100) {
            const batch = statements.slice(i, i + 100);
            await db.batch(batch);
          }
        }
        
        totalFetched += subsidies.length;
        totalInserted += uniqueSubsidies.length;
        
        // レート制限対策: 300ms待機
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        errors.push(`${keyword}: ${String(err)}`);
      }
    }
    
    // 同期結果をログ
    console.log(`Cron JGrants sync completed: fetched=${totalFetched}, inserted=${totalInserted}, unique=${seenIds.size}, errors=${errors.length}`);
    
    return c.json<ApiResponse<{
      message: string;
      total_fetched: number;
      total_inserted: number;
      unique_count: number;
      errors: string[];
      timestamp: string;
    }>>({
      success: true,
      data: {
        message: 'Cron JGrants sync completed',
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        errors,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Cron JGrants sync error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Failed to sync: ${error}`,
      },
    }, 500);
  }
});

/**
 * Cron ヘルスチェック
 * 
 * GET /api/cron/health
 */
cron.get('/health', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret');
  const expectedSecret = (c.env as any).CRON_SECRET;
  
  return c.json<ApiResponse<{
    status: string;
    cron_configured: boolean;
    secret_valid: boolean;
    timestamp: string;
  }>>({
    success: true,
    data: {
      status: 'ok',
      cron_configured: !!expectedSecret,
      secret_valid: cronSecret === expectedSecret,
      timestamp: new Date().toISOString(),
    },
  });
});

export default cron;

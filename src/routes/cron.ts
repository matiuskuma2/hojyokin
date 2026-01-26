/**
 * Cron用API（外部Cronサービスから呼び出し）
 * 
 * POST /api/cron/sync-jgrants - JGrantsデータ同期（discovery_items → subsidy_cache）
 * POST /api/cron/scrape-tokyo-kosha - 東京都中小企業振興公社スクレイピング
 * POST /api/cron/scrape-tokyo-shigoto - 東京しごと財団スクレイピング
 * POST /api/cron/cleanup-queue - done 7日ローテーション
 * 
 * 認証: X-Cron-Secret ヘッダーで CRON_SECRET と照合
 * 
 * P2-0 安全ゲート仕様:
 * - CRON_SECRET 必須（未設定/不一致は403）
 * - 冪等性保証（dedupe_key + ON CONFLICT）
 * - 監査ログ（cron_runs テーブルに実行履歴を記録）
 * - エラー時のトランザクション安全性
 * 
 * NOTE: J-Net21は制度収集から撤去（2026-01-26）。士業ニュース専用に降格。
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../services/firecrawl';
import { shardKey16, currentShardByHour } from '../lib/shard';

const cron = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// P2-0: Cron安全ゲート用ヘルパー
// =====================================================

/**
 * UUID v4 生成
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Cron実行ログを開始
 */
async function startCronRun(
  db: D1Database,
  jobType: string,
  triggeredBy: 'cron' | 'manual' | 'api' = 'cron'
): Promise<string> {
  const runId = generateUUID();
  // Note: 本番DBのカラム名は run_id
  await db.prepare(`
    INSERT INTO cron_runs (run_id, job_type, status, triggered_by)
    VALUES (?, ?, 'running', ?)
  `).bind(runId, jobType, triggeredBy).run();
  return runId;
}

/**
 * Cron実行ログを完了
 */
async function finishCronRun(
  db: D1Database,
  runId: string,
  status: 'success' | 'failed' | 'partial',
  stats: {
    items_processed?: number;
    items_inserted?: number;
    items_updated?: number;
    items_skipped?: number;
    error_count?: number;
    errors?: string[];
    metadata?: Record<string, any>;
  }
): Promise<void> {
  // Note: 本番DBのカラム名は run_id
  await db.prepare(`
    UPDATE cron_runs SET
      status = ?,
      finished_at = datetime('now'),
      items_processed = ?,
      items_inserted = ?,
      items_updated = ?,
      items_skipped = ?,
      error_count = ?,
      errors_json = ?,
      metadata_json = ?
    WHERE run_id = ?
  `).bind(
    status,
    stats.items_processed ?? 0,
    stats.items_inserted ?? 0,
    stats.items_updated ?? 0,
    stats.items_skipped ?? 0,
    stats.error_count ?? (stats.errors?.length ?? 0),
    stats.errors ? JSON.stringify(stats.errors.slice(0, 100)) : null, // 最大100件
    stats.metadata ? JSON.stringify(stats.metadata) : null,
    runId
  ).run();
}

/**
 * CRON_SECRET 検証（P2-0 安全ゲート）
 * 未設定または不一致の場合は403を返す
 */
function verifyCronSecret(c: any): { valid: boolean; error?: { code: string; message: string; status: number } } {
  const cronSecret = c.req.header('X-Cron-Secret');
  const expectedSecret = (c.env as any).CRON_SECRET;
  
  // CRON_SECRET未設定の場合は403
  if (!expectedSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return {
      valid: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Cron not configured: CRON_SECRET is required',
        status: 403,
      },
    };
  }
  
  // シークレット不一致の場合は403
  if (cronSecret !== expectedSecret) {
    console.warn('[Cron] Invalid cron secret attempt');
    return {
      valid: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid cron secret',
        status: 403,
      },
    };
  }
  
  return { valid: true };
}

/**
 * Cron用 JGrants同期エンドポイント
 * 
 * POST /api/cron/sync-jgrants
 * 
 * Header: X-Cron-Secret: {CRON_SECRET}
 * 
 * 外部Cronサービス（cron-job.org等）から日次で呼び出し
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（INSERT OR REPLACE）
 */
cron.post('/sync-jgrants', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'sync-jgrants', 'cron');
  } catch (logErr) {
    console.warn('[Cron] Failed to start cron_run log:', logErr);
    // ログ失敗は処理を止めない
  }
  
  try {
    // =====================================================================
    // 凍結キーワードセット（データ収集パイプライン v1.3）
    // Phase1-1: 500件達成を目標
    // 
    // 変更履歴:
    // v1.2 -> v1.3: 受付終了分も取得（acceptance='0'を追加）
    // =====================================================================
    const KEYWORDS = [
      // 基本キーワード（汎用性が高く、多くの補助金をカバー）
      '補助金',
      '助成金', 
      '事業',
      '支援',
      '申請',
      '公募',
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
      // 企業規模・業種
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
      // IT・デジタル関連
      'ECサイト',
      'テレワーク',
      'AI',
      'IoT',
      'クラウド',
      '情報化',
      // 経営・人事関連
      '感染症対策',
      '賃上げ',
      '最低賃金',
      '事業承継',
      '再構築',
      '経営革新',
      '働き方改革',
      // 地域・産業振興
      '地域活性化',
      '商店街',
      '中心市街地',
      '地方創生',
      '産業振興',
      // インフラ・設備
      '省力化',
      '自動化',
      '機械化',
      '建設',
      '建築',
    ];
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>();
    const errors: string[] = [];
    
    // Phase1-1改善: 受付中と受付終了の両方を取得
    const acceptanceFlags = ['1', '0']; // 1=受付中, 0=受付終了
    
    for (const acceptance of acceptanceFlags) {
      for (const keyword of KEYWORDS) {
        try {
          const params = new URLSearchParams({
            keyword,
            sort: 'acceptance_end_datetime',
            order: 'DESC',
            acceptance,
            limit: '200',
          });
          
          console.log(`Cron sync: keyword=${keyword}, acceptance=${acceptance}`);
          
          const response = await fetch(`${JGRANTS_API_URL}?${params.toString()}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          
          if (!response.ok) {
            errors.push(`${keyword}(acc=${acceptance}): API ${response.status}`);
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
            const statements = uniqueSubsidies.map((s: any) => {
              // detail_json に元データを保存（Phase1-2でOCR/抽出時に使用）
              const detailJson = JSON.stringify({
                subsidy_application_url: s.subsidy_application_url || null,
                subsidy_application_address: s.subsidy_application_address || null,
                target_detail: s.target_detail || null,
                usage_detail: s.usage_detail || null,
                subsidy_rate_detail: s.subsidy_rate_detail || null,
                subsidy_max_limit_detail: s.subsidy_max_limit_detail || null,
                acceptance_number_detail: s.acceptance_number_detail || null,
                contact: s.contact || null,
                crawled_at: new Date().toISOString(),
              });
              
              return db.prepare(`
                INSERT OR REPLACE INTO subsidy_cache 
                (id, source, title, subsidy_max_limit, subsidy_rate,
                 target_area_search, target_industry, target_number_of_employees,
                 acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
                 detail_json, cached_at, expires_at)
                VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
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
                s.request_reception_display_flag ?? (acceptance === '1' ? 1 : 0),
                detailJson,
                expiresAt
              );
            });
            
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
          errors.push(`${keyword}(acc=${acceptance}): ${String(err)}`);
        }
      }
    }
    
    // 同期結果をログ
    console.log(`Cron JGrants sync completed: fetched=${totalFetched}, inserted=${totalInserted}, unique=${seenIds.size}, errors=${errors.length}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: seenIds.size,
          items_inserted: totalInserted,
          error_count: errors.length,
          errors: errors,
          metadata: { total_fetched: totalFetched },
        });
      } catch (logErr) {
        console.warn('[Cron] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      total_fetched: number;
      total_inserted: number;
      unique_count: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Cron JGrants sync completed',
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        errors,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
  } catch (error) {
    console.error('Cron JGrants sync error:', error);
    
    // P2-0: 失敗ログ
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Cron] Failed to finish cron_run log:', logErr);
      }
    }
    
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
 * 東京都中小企業振興公社 助成金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-kosha
 * 
 * Phase1: 東京都の補助金データ収集パイロット
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（INSERT OR REPLACE）
 */
cron.post('/scrape-tokyo-kosha', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'scrape-tokyo-kosha', 'cron');
  } catch (logErr) {
    console.warn('[Cron] Failed to start cron_run log:', logErr);
  }
  
  try {
    const BASE_URL = 'https://www.tokyo-kosha.or.jp';
    const LIST_URL = `${BASE_URL}/support/josei/index.html`;
    
    console.log(`[Tokyo-Kosha] Starting scrape: ${LIST_URL}`);
    
    // 1. 一覧ページを取得
    const listResult = await simpleScrape(LIST_URL);
    if (!listResult.success || !listResult.html) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'SCRAPE_ERROR', message: listResult.error || 'Failed to fetch list page' },
      }, 500);
    }
    
    // 2. 一覧ページから助成金リンクを抽出（正規表現で改善）
    const html = listResult.html;
    const subsidies: any[] = [];
    
    // 各助成金カードを抽出する改善版パターン
    // サイト構造: <a href="/support/josei/jigyo/xxx.html"> の形式
    const linkPattern = /href="(\/support\/josei\/(?:jigyo|shien|medical)[^"]+\.html)"/gi;
    const seenUrls = new Set<string>();
    
    let linkMatch;
    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const detailPath = linkMatch[1];
      const fullUrl = `${BASE_URL}${detailPath}`;
      
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);
    }
    
    console.log(`[Tokyo-Kosha] Found ${seenUrls.size} unique subsidy links`);
    
    // 3. 各詳細ページを取得（最大20件をパイロット取得）
    const MAX_PILOT = 20;
    const detailUrls = Array.from(seenUrls).slice(0, MAX_PILOT);
    const results: any[] = [];
    const errors: string[] = [];
    
    for (const detailUrl of detailUrls) {
      try {
        console.log(`[Tokyo-Kosha] Fetching: ${detailUrl}`);
        
        const detailResult = await simpleScrape(detailUrl);
        if (!detailResult.success || !detailResult.html) {
          errors.push(`${detailUrl}: ${detailResult.error || 'No HTML'}`);
          continue;
        }
        
        const detailHtml = detailResult.html;
        
        // タイトル抽出
        const titleMatch = detailHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          detailHtml.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';
        
        // ステータス抽出
        let status = 'unknown';
        if (detailHtml.includes('募集中') || detailHtml.includes('申請受付中')) {
          status = 'open';
        } else if (detailHtml.includes('受付終了') || detailHtml.includes('募集終了')) {
          status = 'closed';
        } else if (detailHtml.includes('募集準備中') || detailHtml.includes('近日公開')) {
          status = 'upcoming';
        }
        
        // 助成限度額抽出
        const amountMatch = detailHtml.match(/助成(?:限度)?額[：:]\s*([0-9,，]+)万円/i) ||
                           detailHtml.match(/上限[：:]\s*([0-9,，]+)万円/i);
        const maxAmount = amountMatch ? parseInt(amountMatch[1].replace(/[,，]/g, '')) * 10000 : null;
        
        // 助成率抽出
        const rateMatch = detailHtml.match(/助成率[：:]\s*([0-9/／]+)\s*以内/i) ||
                         detailHtml.match(/補助率[：:]\s*([0-9/／]+)/i);
        const subsidyRate = rateMatch ? rateMatch[1].replace('／', '/') : null;
        
        // 申請期間・締切抽出
        const deadlineMatch = detailHtml.match(/(?:申請|受付)期[間限][：:]\s*([^<\n]+)/i);
        const deadline = deadlineMatch ? deadlineMatch[1].trim() : null;
        
        // 概要抽出
        const descMatch = detailHtml.match(/(?:事業概要|概要)[：:]\s*([^<]{50,500})/i);
        const description = descMatch ? descMatch[1].trim() : null;
        
        // 対象者抽出
        const targetMatch = detailHtml.match(/(?:対象者|対象事業者)[：:]\s*([^<]+)/i);
        const eligibility = targetMatch ? targetMatch[1].trim() : null;
        
        // PDF抽出
        const pdfUrls = extractPdfLinks(detailHtml, detailUrl);
        
        // コンテンツハッシュ計算（差分検知用）
        const contentHash = await calculateContentHash(detailHtml);
        
        // ID生成（URLパスから）
        const pathPart = detailUrl.split('/').pop()?.replace('.html', '') || '';
        const id = `tokyo-kosha-${pathPart}`;
        
        const subsidyData = {
          id,
          title: title || `東京都公社助成金 ${pathPart}`,
          source: 'tokyo-kosha',
          sourceUrl: LIST_URL,
          detailUrl,
          status,
          maxAmount,
          subsidyRate,
          deadline,
          description,
          eligibility,
          issuerName: '東京都中小企業振興公社',
          targetAreas: ['東京都'],
          pdfUrls,
          contentHash,
          extractedAt: new Date().toISOString(),
        };
        
        results.push(subsidyData);
        
        // レート制限: 500ms待機
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        errors.push(`${detailUrl}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Tokyo-Kosha] Extracted ${results.length} subsidies, ${errors.length} errors`);
    
    // 4. DBに保存（subsidy_cache + crawl_results）
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    let insertedCount = 0;
    
    for (const subsidy of results) {
      try {
        // subsidy_cache に保存
        await db.prepare(`
          INSERT OR REPLACE INTO subsidy_cache 
          (id, source, title, subsidy_max_limit, subsidy_rate,
           target_area_search, target_industry, target_number_of_employees,
           acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
           detail_json, cached_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).bind(
          subsidy.id,
          subsidy.source,
          subsidy.title,
          subsidy.maxAmount,
          subsidy.subsidyRate,
          '東京都',  // target_area_search
          null,      // target_industry（後で抽出）
          null,      // target_number_of_employees
          null,      // acceptance_start_datetime
          subsidy.deadline,  // acceptance_end_datetime（簡易版）
          subsidy.status === 'open' ? 1 : 0,
          JSON.stringify({
            detailUrl: subsidy.detailUrl,
            description: subsidy.description,
            eligibility: subsidy.eligibility,
            issuerName: subsidy.issuerName,
            pdfUrls: subsidy.pdfUrls,
            contentHash: subsidy.contentHash,
            extractedAt: subsidy.extractedAt,
          }),
          expiresAt
        ).run();
        
        insertedCount++;
      } catch (dbErr) {
        errors.push(`DB insert ${subsidy.id}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      }
    }
    
    console.log(`[Tokyo-Kosha] Inserted ${insertedCount} to DB`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: results.length,
          items_inserted: insertedCount,
          error_count: errors.length,
          errors: errors,
          metadata: { links_found: seenUrls.size },
        });
      } catch (logErr) {
        console.warn('[Cron] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      links_found: number;
      details_fetched: number;
      inserted: number;
      results: any[];
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Tokyo-Kosha scrape completed',
        links_found: seenUrls.size,
        details_fetched: results.length,
        inserted: insertedCount,
        results,
        errors,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Tokyo-Kosha] Scrape error:', error);
    
    // P2-0: 失敗ログ
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Cron] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Scrape failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * 取得したデータの品質検証API
 * 
 * GET /api/cron/verify-data-quality
 * 
 * 壁打ち機能に必要な項目が揃っているかチェック
 */
cron.get('/verify-data-quality', async (c) => {
  const db = c.env.DB;
  
  try {
    // 東京都公社のデータを取得
    const result = await db.prepare(`
      SELECT 
        id, title, source, subsidy_max_limit, subsidy_rate,
        acceptance_end_datetime, detail_json
      FROM subsidy_cache
      WHERE source = 'tokyo-kosha'
      ORDER BY cached_at DESC
      LIMIT 50
    `).all();
    
    const subsidies = result.results || [];
    
    // 品質指標を計算
    const qualityMetrics = {
      total: subsidies.length,
      hasTitle: 0,
      hasMaxAmount: 0,
      hasSubsidyRate: 0,
      hasDeadline: 0,
      hasDescription: 0,
      hasEligibility: 0,
      hasPdfUrls: 0,
      fullyComplete: 0,  // 壁打ちに必要な全項目あり
    };
    
    const detailedResults: any[] = [];
    
    for (const s of subsidies as any[]) {
      const detail = s.detail_json ? JSON.parse(s.detail_json) : {};
      
      const hasTitle = !!s.title && s.title.length > 0;
      const hasMaxAmount = s.subsidy_max_limit !== null && s.subsidy_max_limit > 0;
      const hasSubsidyRate = !!s.subsidy_rate;
      const hasDeadline = !!s.acceptance_end_datetime || !!detail.deadline;
      const hasDescription = !!detail.description && detail.description.length > 20;
      const hasEligibility = !!detail.eligibility;
      const hasPdfUrls = detail.pdfUrls && detail.pdfUrls.length > 0;
      
      if (hasTitle) qualityMetrics.hasTitle++;
      if (hasMaxAmount) qualityMetrics.hasMaxAmount++;
      if (hasSubsidyRate) qualityMetrics.hasSubsidyRate++;
      if (hasDeadline) qualityMetrics.hasDeadline++;
      if (hasDescription) qualityMetrics.hasDescription++;
      if (hasEligibility) qualityMetrics.hasEligibility++;
      if (hasPdfUrls) qualityMetrics.hasPdfUrls++;
      
      // 壁打ちに必要な最低限: タイトル + (金額 or 率) + (説明 or 対象者)
      const isComplete = hasTitle && (hasMaxAmount || hasSubsidyRate) && (hasDescription || hasEligibility);
      if (isComplete) qualityMetrics.fullyComplete++;
      
      detailedResults.push({
        id: s.id,
        title: s.title,
        checks: {
          hasTitle,
          hasMaxAmount,
          hasSubsidyRate,
          hasDeadline,
          hasDescription,
          hasEligibility,
          hasPdfUrls,
          isComplete,
        },
        maxAmount: s.subsidy_max_limit,
        subsidyRate: s.subsidy_rate,
        pdfCount: detail.pdfUrls?.length || 0,
      });
    }
    
    // 品質スコア計算
    const completenessScore = qualityMetrics.total > 0
      ? Math.round((qualityMetrics.fullyComplete / qualityMetrics.total) * 100)
      : 0;
    
    return c.json<ApiResponse<{
      metrics: typeof qualityMetrics;
      completenessScore: number;
      recommendation: string;
      details: typeof detailedResults;
    }>>({
      success: true,
      data: {
        metrics: qualityMetrics,
        completenessScore,
        recommendation: completenessScore >= 60
          ? '品質OK: 壁打ち機能で検証可能'
          : completenessScore >= 30
          ? '要改善: PDFからの詳細抽出が必要'
          : '要大幅改善: スクレイピングロジックの見直しが必要',
        details: detailedResults,
      },
    });
    
  } catch (error) {
    console.error('[Verify] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * 東京しごと財団 助成金・奨励金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-shigoto
 * 
 * Phase1: 東京都の補助金データ収集（推奨1番目ソース）
 * URL: https://www.koyokankyo.shigotozaidan.or.jp/
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（dedupe_key + ON CONFLICT）
 * - 差分検知（新規/更新/スキップを区別）
 * 
 * P2-2 定期実行設計:
 * - Cron schedule推奨: 毎日 06:00 JST (cron-job.org等で設定)
 * - dedupe_keyベースで重複防止
 * - content_hashで変更検知
 */
cron.post('/scrape-tokyo-shigoto', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証（未設定/不一致は403）
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'scrape-tokyo-shigoto', 'cron');
  } catch (logErr) {
    console.warn('[Tokyo-Shigoto] Failed to start cron_run log:', logErr);
    // ログ失敗は処理を止めない
  }
  
  // P2-2: 差分検知用カウンター
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  
  try {
    const BASE_URL = 'https://www.koyokankyo.shigotozaidan.or.jp';
    const LIST_URL = `${BASE_URL}/index.html`;
    
    console.log(`[Tokyo-Shigoto] Starting scrape: ${LIST_URL}`);
    
    // 1. トップページを取得
    const listResult = await simpleScrape(LIST_URL);
    if (!listResult.success || !listResult.html) {
      // P2-0: エラー時もログ記録
      if (runId) {
        await finishCronRun(db, runId, 'failed', {
          items_processed: 0,
          errors: [listResult.error || 'Failed to fetch list page'],
        });
      }
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'SCRAPE_ERROR', message: listResult.error || 'Failed to fetch list page' },
      }, 500);
    }
    
    const html = listResult.html;
    const results: any[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();
    
    // 2. 助成金・奨励金リンクを抽出
    // パターン: /jigyo/xxx/xxx.html で 助成|奨励 を含むもの
    const linkPattern = /href="(\/jigyo\/[^"]+\.html)"[^>]*>([^<]*(?:助成|奨励|支援)[^<]*)</gi;
    let linkMatch;
    
    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const path = linkMatch[1];
      const linkText = linkMatch[2].trim();
      const fullUrl = `${BASE_URL}${path}`;
      
      if (seenUrls.has(fullUrl)) continue;
      if (linkText.length < 3) continue; // 空リンクを除外
      
      seenUrls.add(fullUrl);
    }
    
    // 追加パターン: keyword-link クラスのリンク
    const keywordPattern = /<a[^>]*class="keyword-link[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)</gi;
    while ((linkMatch = keywordPattern.exec(html)) !== null) {
      const path = linkMatch[1];
      const linkText = linkMatch[2].trim();
      
      // 相対パスと絶対パスの両方に対応
      const fullUrl = path.startsWith('/') ? `${BASE_URL}${path}` : path;
      
      if (seenUrls.has(fullUrl)) continue;
      if (!fullUrl.includes('koyokankyo.shigotozaidan.or.jp')) continue;
      
      seenUrls.add(fullUrl);
    }
    
    console.log(`[Tokyo-Shigoto] Found ${seenUrls.size} unique subsidy links`);
    
    // 3. 各詳細ページを取得（最大25件）
    const MAX_PILOT = 25;
    const detailUrls = Array.from(seenUrls).slice(0, MAX_PILOT);
    
    for (const detailUrl of detailUrls) {
      try {
        console.log(`[Tokyo-Shigoto] Fetching: ${detailUrl}`);
        
        const detailResult = await simpleScrape(detailUrl);
        if (!detailResult.success || !detailResult.html) {
          errors.push(`${detailUrl}: ${detailResult.error || 'No HTML'}`);
          continue;
        }
        
        const detailHtml = detailResult.html;
        
        // タイトル抽出
        const titleMatch = detailHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          detailHtml.match(/<title>([^<]+)<\/title>/i) ||
                          detailHtml.match(/class="page-title"[^>]*>([^<]+)</i);
        let title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';
        title = title.replace(/\|.*$/, '').trim(); // サイト名を除去
        
        // ステータス抽出
        let status = 'unknown';
        if (detailHtml.includes('申請受付中') || detailHtml.includes('募集中') || detailHtml.includes('受付中')) {
          status = 'open';
        } else if (detailHtml.includes('受付終了') || detailHtml.includes('募集終了') || detailHtml.includes('予算上限')) {
          status = 'closed';
        } else if (detailHtml.includes('募集準備中') || detailHtml.includes('近日') || detailHtml.includes('概要')) {
          status = 'upcoming';
        }
        
        // 助成額・奨励額抽出
        const amountMatch = detailHtml.match(/(?:助成|奨励|補助)(?:金額?|上限)[：:\s]*(?:最大)?([0-9,，]+)万円/i) ||
                           detailHtml.match(/上限[：:\s]*([0-9,，]+)万円/i) ||
                           detailHtml.match(/([0-9,，]+)万円.*(?:助成|奨励|補助)/i);
        const maxAmount = amountMatch ? parseInt(amountMatch[1].replace(/[,，]/g, '')) * 10000 : null;
        
        // 助成率抽出
        const rateMatch = detailHtml.match(/(?:助成|補助)率[：:\s]*([0-9/／]+(?:分の[0-9]+)?)/i) ||
                         detailHtml.match(/([0-9/／]+)\s*(?:以内|まで)/i);
        const subsidyRate = rateMatch ? rateMatch[1].replace('／', '/') : null;
        
        // 対象者抽出
        const targetMatch = detailHtml.match(/(?:対象(?:者|企業|事業者)?)[：:\s]*([^<]{10,200})/i);
        const eligibility = targetMatch ? targetMatch[1].trim() : null;
        
        // 概要抽出
        const descMatch = detailHtml.match(/(?:事業概要|概要|内容)[：:\s]*([^<]{30,500})/i);
        const description = descMatch ? descMatch[1].trim() : null;
        
        // PDF抽出
        const pdfUrls = extractPdfLinks(detailHtml, detailUrl);
        
        // コンテンツハッシュ計算
        const contentHash = await calculateContentHash(detailHtml);
        
        // ID生成（URLパスから）
        const pathParts = detailUrl.split('/').filter(p => p && p !== 'index.html' && !p.includes('.'));
        const pathPart = pathParts.slice(-2).join('-') || 'item';
        const id = `tokyo-shigoto-${pathPart}`;
        
        // dedupe_key 生成
        const urlHash = contentHash.slice(0, 12);
        const dedupeKey = `tokyo-shigoto:${urlHash}`;
        
        const subsidyData = {
          id,
          dedupeKey,
          title: title || `東京しごと財団 ${pathPart}`,
          source: 'tokyo-shigoto',
          sourceUrl: LIST_URL,
          detailUrl,
          status,
          maxAmount,
          subsidyRate,
          description,
          eligibility,
          issuerName: '東京しごと財団',
          prefectureCode: '13',
          targetAreas: ['東京都'],
          pdfUrls,
          contentHash,
          extractedAt: new Date().toISOString(),
        };
        
        results.push(subsidyData);
        
        // レート制限: 500ms待機
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        errors.push(`${detailUrl}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Tokyo-Shigoto] Extracted ${results.length} subsidies, ${errors.length} errors`);
    
    // 4. DBに保存（subsidy_cache + subsidy_feed_items）
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    let insertedCount = 0;
    let feedInsertedCount = 0;
    
    for (const subsidy of results) {
      try {
        // subsidy_cache に保存（既存互換）
        await db.prepare(`
          INSERT OR REPLACE INTO subsidy_cache 
          (id, source, title, subsidy_max_limit, subsidy_rate,
           target_area_search, target_industry, target_number_of_employees,
           acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
           detail_json, cached_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).bind(
          subsidy.id,
          subsidy.source,
          subsidy.title,
          subsidy.maxAmount,
          subsidy.subsidyRate,
          '東京都',
          null,
          null,
          null,
          null,
          subsidy.status === 'open' ? 1 : 0,
          JSON.stringify({
            detailUrl: subsidy.detailUrl,
            description: subsidy.description,
            eligibility: subsidy.eligibility,
            issuerName: subsidy.issuerName,
            pdfUrls: subsidy.pdfUrls,
            contentHash: subsidy.contentHash,
            extractedAt: subsidy.extractedAt,
          }),
          expiresAt
        ).run();
        
        insertedCount++;
        
        // subsidy_feed_items にも保存（新仕様 + P2-2 差分検知）
        // dedupe_key をベースにしてid重複問題を回避
        try {
          // 既存レコードを確認
          const existing = await db.prepare(`
            SELECT content_hash FROM subsidy_feed_items WHERE dedupe_key = ?
          `).bind(subsidy.dedupeKey).first<{ content_hash: string }>();
          
          if (existing) {
            // 既存レコードあり: content_hashで変更を検知
            if (existing.content_hash === subsidy.contentHash) {
              // 変更なし: last_seen_at のみ更新
              await db.prepare(`
                UPDATE subsidy_feed_items SET last_seen_at = datetime('now') WHERE dedupe_key = ?
              `).bind(subsidy.dedupeKey).run();
              itemsSkipped++;
            } else {
              // 変更あり: 更新
              await db.prepare(`
                UPDATE subsidy_feed_items SET
                  title = ?,
                  summary = ?,
                  subsidy_amount_max = ?,
                  subsidy_rate_text = ?,
                  status = ?,
                  content_hash = ?,
                  is_new = 0,
                  last_seen_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE dedupe_key = ?
              `).bind(
                subsidy.title,
                subsidy.description,
                subsidy.maxAmount,
                subsidy.subsidyRate,
                subsidy.status,
                subsidy.contentHash,
                subsidy.dedupeKey
              ).run();
              itemsUpdated++;
              feedInsertedCount++;
            }
          } else {
            // 新規レコード: dedupe_keyからidを生成してUNIQUE制約を回避
            const safeId = subsidy.dedupeKey.replace(':', '-');
            await db.prepare(`
              INSERT INTO subsidy_feed_items 
              (id, dedupe_key, source_id, source_type, title, summary, url, detail_url,
               pdf_urls, issuer_name, prefecture_code, target_area_codes,
               subsidy_amount_max, subsidy_rate_text, status, raw_json, content_hash,
               is_new, first_seen_at, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `).bind(
              safeId,
              subsidy.dedupeKey,
              'src-tokyo-shigoto',
              'prefecture',  // CHECK制約: platform, support_info, prefecture, municipal, ministry, other_public
              subsidy.title,
              subsidy.description,
              subsidy.detailUrl,
              subsidy.detailUrl,
              JSON.stringify(subsidy.pdfUrls),
              subsidy.issuerName,
              subsidy.prefectureCode,
              JSON.stringify(['13']),
              subsidy.maxAmount,
              subsidy.subsidyRate,
              subsidy.status,
              JSON.stringify(subsidy),
              subsidy.contentHash
            ).run();
            itemsNew++;
            feedInsertedCount++;
          }
        } catch (feedErr) {
          // feed_itemsへの保存エラーは警告のみ（後方互換）
          console.warn(`[Tokyo-Shigoto] Feed insert warning: ${feedErr}`);
        }
        
      } catch (dbErr) {
        errors.push(`DB insert ${subsidy.id}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      }
    }
    
    console.log(`[Tokyo-Shigoto] Inserted ${insertedCount} to cache, ${feedInsertedCount} to feed_items`);
    console.log(`[Tokyo-Shigoto] New: ${itemsNew}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: results.length,
          items_inserted: itemsNew,
          items_updated: itemsUpdated,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors,
          metadata: {
            links_found: seenUrls.size,
            cache_inserted: insertedCount,
            feed_inserted: feedInsertedCount,
          },
        });
      } catch (logErr) {
        console.warn('[Tokyo-Shigoto] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      links_found: number;
      details_fetched: number;
      inserted: number;
      feed_inserted: number;
      items_new: number;
      items_updated: number;
      items_skipped: number;
      results: any[];
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Tokyo-Shigoto scrape completed',
        links_found: seenUrls.size,
        details_fetched: results.length,
        inserted: insertedCount,
        feed_inserted: feedInsertedCount,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        items_skipped: itemsSkipped,
        results,
        errors,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Tokyo-Shigoto] Scrape error:', error);
    
    // P2-0: 失敗ログ
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Tokyo-Shigoto] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Scrape failed: ${error instanceof Error ? error.message : String(error)}`,
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

/**
 * P1-3-1: Suggestion生成ジョブ
 * 
 * POST /api/cron/generate-suggestions
 * 
 * 凍結仕様 v1:
 * - 入力: agency_clients × subsidy_cache
 * - 出力: agency_suggestions_cache に上位3件/顧客をキャッシュ
 * - スコアリング:
 *   - 地域一致 +40、全国 +20
 *   - 業種一致 +25、全業種 +10
 *   - 従業員条件マッチ +25、不一致 -30
 *   - 締切14日以内 -10、7日以内 -20
 *   - 受付中フラグが外なら score = 0
 * - ステータス判定: 80以上 PROCEED, 50〜79 CAUTION, 0〜49 NO
 * - BLOCKED顧客は除外（事故防止）
 */
cron.post('/generate-suggestions', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'generate-suggestions', 'cron');
  } catch (logErr) {
    console.warn('[Suggestions] Failed to start cron_run log:', logErr);
  }
  
  // 凍結: 統計カウンター（finally で必ず cron_runs を閉じるため外に出す）
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  let clientsProcessed = 0;
  let subsidiesCount = 0;
  const errors: string[] = [];
  let finalStatus: 'success' | 'failed' | 'partial' = 'success';
  
  try {
    // 1. 全Agencyの顧客を取得（BLOCKEDを除外）
    // employee_countはcompaniesテーブルに直接存在
    const clientsResult = await db.prepare(`
      SELECT 
        ac.id as client_id,
        ac.agency_id,
        ac.company_id,
        ac.status,
        c.name as company_name,
        c.prefecture,
        c.industry_major,
        c.employee_count,
        c.employee_band
      FROM agency_clients ac
      JOIN companies c ON ac.company_id = c.id
      WHERE ac.status != 'blocked'
        AND c.employee_count > 0
    `).all();
    
    const clients = (clientsResult.results || []) as any[];
    clientsProcessed = clients.length;
    console.log(`[Suggestions] Processing ${clients.length} eligible clients`);
    
    // 凍結: 0件でも success、後続処理をスキップして finally へ
    if (clients.length > 0) {
    // 2. 補助金データを取得（スコアリング用）
    const subsidiesResult = await db.prepare(`
      SELECT 
        id,
        title,
        target_area_search,
        target_industry,
        target_number_of_employees,
        acceptance_end_datetime,
        request_reception_display_flag,
        subsidy_max_limit,
        subsidy_rate
      FROM subsidy_cache
      ORDER BY cached_at DESC
      LIMIT 500
    `).all();
    
    const subsidies = (subsidiesResult.results || []) as any[];
    subsidiesCount = subsidies.length;
    console.log(`[Suggestions] Found ${subsidies.length} subsidies to score`);
    
    // 3. 各顧客に対してスコアリング
    const today = new Date();
    
    for (const client of clients) {
      try {
        // 凍結推奨: 旧キャッシュを消し込み（過去の補助金が表示され続ける事故を防止）
        // 新しい上位3件を生成する前に、この顧客の古いsuggestionを全て削除
        await db.prepare(`
          DELETE FROM agency_suggestions_cache 
          WHERE agency_id = ? AND company_id = ?
        `).bind(client.agency_id, client.company_id).run();
        
        const scored: any[] = [];
        
        for (const subsidy of subsidies) {
          let score = 0;
          const matchReasons: string[] = [];
          const riskFlags: string[] = [];
          
          // 受付中フラグ確認
          const isAccepting = subsidy.request_reception_display_flag === 1;
          if (!isAccepting) {
            // 受付終了でもスコア計算は行うが、上位になりにくくする
            score = 0;
            riskFlags.push('現在受付停止中');
          } else {
            // 地域マッチング
            const targetArea = (subsidy.target_area_search || '').toLowerCase();
            const clientPref = normalizePrefecture(client.prefecture || '');
            
            if (targetArea.includes('全国') || targetArea === '' || targetArea === 'null') {
              score += 20;
              matchReasons.push('全国対象の補助金');
            } else if (clientPref && targetArea.includes(clientPref)) {
              score += 40;
              matchReasons.push(`${clientPref}対象の補助金`);
            } else {
              riskFlags.push('対象地域外の可能性');
            }
            
            // 業種マッチング
            const targetIndustry = (subsidy.target_industry || '').toLowerCase();
            const clientIndustry = (client.industry_major || '').toLowerCase();
            
            if (targetIndustry === '' || targetIndustry === 'null' || targetIndustry.includes('全業種')) {
              score += 10;
              matchReasons.push('業種制限なし');
            } else if (clientIndustry && targetIndustry.includes(clientIndustry)) {
              score += 25;
              matchReasons.push(`${client.industry_major}向け補助金`);
            } else if (clientIndustry) {
              riskFlags.push('業種条件の確認が必要');
            }
            
            // 従業員数マッチング
            const employeeCount = parseEmployeeCount(client.employee_count);
            const targetEmployees = subsidy.target_number_of_employees || '';
            
            if (targetEmployees === '' || targetEmployees === 'null') {
              score += 15;
              matchReasons.push('従業員数制限なし');
            } else if (employeeCount > 0 && checkEmployeeMatch(employeeCount, targetEmployees)) {
              score += 25;
              matchReasons.push('従業員数条件に適合');
            } else if (employeeCount > 0) {
              score -= 30;
              riskFlags.push('従業員数条件を確認してください');
            }
            
            // 締切チェック
            if (subsidy.acceptance_end_datetime && subsidy.acceptance_end_datetime !== 'null') {
              try {
                const deadline = new Date(subsidy.acceptance_end_datetime);
                const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysUntil <= 0) {
                  score = 0;
                  riskFlags.push('申請期限終了');
                } else if (daysUntil <= 7) {
                  score -= 20;
                  riskFlags.push(`申請期限まで${daysUntil}日`);
                } else if (daysUntil <= 14) {
                  score -= 10;
                  riskFlags.push(`申請期限まで${daysUntil}日`);
                }
              } catch (e) {
                // 日付パースエラーは無視
              }
            }
          }
          
          // スコアを0〜100に正規化
          score = Math.max(0, Math.min(100, score));
          
          // ステータス判定
          let status: 'PROCEED' | 'CAUTION' | 'NO';
          if (score >= 80) {
            status = 'PROCEED';
          } else if (score >= 50) {
            status = 'CAUTION';
          } else {
            status = 'NO';
          }
          
          scored.push({
            subsidyId: subsidy.id,
            title: subsidy.title,
            score,
            status,
            matchReasons,
            riskFlags,
            subsidyMaxLimit: subsidy.subsidy_max_limit,
            subsidyRate: subsidy.subsidy_rate,
            deadline: subsidy.acceptance_end_datetime,
            isAccepting,
          });
        }
        
        // 凍結: 上位3件を選択（決定的ソート＝同じ入力なら同じ結果）
        // ORDER BY: score DESC, isAccepting DESC, deadline ASC (早い順), subsidyId ASC
        scored.sort((a, b) => {
          // 1. スコア降順
          if (b.score !== a.score) return b.score - a.score;
          // 2. 受付中優先
          if (b.isAccepting !== a.isAccepting) return b.isAccepting ? 1 : -1;
          // 3. 締切が早い順（NULLは後ろ）
          const aDeadline = a.deadline && a.deadline !== 'null' ? a.deadline : 'z';
          const bDeadline = b.deadline && b.deadline !== 'null' ? b.deadline : 'z';
          if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
          // 4. subsidy_id 昇順（最終タイブレーク）
          return a.subsidyId.localeCompare(b.subsidyId);
        });
        
        const top3 = scored.slice(0, 3);
        
        // 4. agency_suggestions_cache にUPSERT
        for (let rank = 0; rank < top3.length; rank++) {
          const item = top3[rank];
          const suggestionId = generateUUID();
          const dedupeKey = `${client.agency_id}:${client.company_id}:${item.subsidyId}`;
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          
          // 既存確認
          const existing = await db.prepare(`
            SELECT id FROM agency_suggestions_cache WHERE dedupe_key = ?
          `).bind(dedupeKey).first<{ id: string }>();
          
          // 凍結: match_reasons/risk_flags は必ず string[] として保存
          // 配列以外や object 配列は許可しない
          const safeMatchReasons = ensureStringArray(item.matchReasons);
          const safeRiskFlags = ensureStringArray(item.riskFlags);
          const matchReasonsJson = JSON.stringify(safeMatchReasons);
          const riskFlagsJson = JSON.stringify(safeRiskFlags);
          
          if (existing) {
            // 更新
            await db.prepare(`
              UPDATE agency_suggestions_cache SET
                rank = ?,
                score = ?,
                status = ?,
                match_reasons_json = ?,
                risk_flags_json = ?,
                subsidy_title = ?,
                subsidy_max_amount = ?,
                subsidy_rate = ?,
                deadline = ?,
                expires_at = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(
              rank + 1,
              item.score,
              item.status,
              matchReasonsJson,
              riskFlagsJson,
              item.title,
              item.subsidyMaxLimit,
              item.subsidyRate,
              item.deadline !== 'null' ? item.deadline : null,
              expiresAt,
              existing.id
            ).run();
            itemsUpdated++;
          } else {
            // 新規挿入
            await db.prepare(`
              INSERT INTO agency_suggestions_cache (
                id, agency_id, company_id, subsidy_id, dedupe_key,
                rank, score, status, match_reasons_json, risk_flags_json,
                subsidy_title, subsidy_max_amount, subsidy_rate, deadline,
                expires_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).bind(
              suggestionId,
              client.agency_id,
              client.company_id,
              item.subsidyId,
              dedupeKey,
              rank + 1,
              item.score,
              item.status,
              matchReasonsJson,
              riskFlagsJson,
              item.title,
              item.subsidyMaxLimit,
              item.subsidyRate,
              item.deadline !== 'null' ? item.deadline : null,
              expiresAt
            ).run();
            itemsNew++;
          }
        }
        
      } catch (clientErr) {
        errors.push(`Client ${client.company_id}: ${clientErr instanceof Error ? clientErr.message : String(clientErr)}`);
      }
    }
    
    console.log(`[Suggestions] Completed: new=${itemsNew}, updated=${itemsUpdated}, skipped=${itemsSkipped}, errors=${errors.length}`);
    } // end if (clients.length > 0)
    
    // 凍結: エラーがあれば partial、なければ success
    finalStatus = errors.length > 0 ? 'partial' : 'success';
    
  } catch (error) {
    console.error('[Suggestions] Generation error:', error);
    finalStatus = 'failed';
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    // 凍結: 必ず cron_runs を閉じる（running のまま残さない）
    if (runId) {
      try {
        await finishCronRun(db, runId, finalStatus, {
          items_processed: clientsProcessed,
          items_inserted: itemsNew,
          items_updated: itemsUpdated,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors.slice(0, 100), // 最大100件
          metadata: {
            subsidies_count: subsidiesCount,
            final_status: finalStatus,
          },
        });
      } catch (logErr) {
        console.error('[Suggestions] CRITICAL: Failed to finish cron_run log:', logErr);
      }
    }
  }
  
  // 凍結: レスポンスは finally の後で返す
  if (finalStatus === 'failed') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Generation failed: ${errors[0] || 'Unknown error'}`,
      },
    }, 500);
  }
  
  return c.json<ApiResponse<{
    message: string;
    clients_processed: number;
    items_new: number;
    items_updated: number;
    items_skipped: number;
    errors: string[];
    timestamp: string;
    run_id?: string;
  }>>({
    success: true,
    data: {
      message: clientsProcessed === 0 
        ? 'No eligible clients to process' 
        : 'Suggestions generated successfully',
      clients_processed: clientsProcessed,
      items_new: itemsNew,
      items_updated: itemsUpdated,
      items_skipped: itemsSkipped,
      errors,
      timestamp: new Date().toISOString(),
      run_id: runId ?? undefined,
    },
  });
});

/**
 * 凍結: 配列を string[] に正規化
 * - 配列以外 → []
 * - object要素 → reason/text/message/description を優先、なければ stringify
 * - 100文字で切る（UX上の可読性）
 * - null/undefined → []
 */
function ensureStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  const MAX_LENGTH = 100;
  return arr.map((item: any) => {
    if (typeof item === 'string') {
      return item.length > MAX_LENGTH ? item.slice(0, MAX_LENGTH) + '…' : item;
    }
    if (item === null || item === undefined) return '';
    // objectは可読性の高いフィールドを優先
    if (typeof item === 'object') {
      const readable = item.reason || item.text || item.message || item.description || item.name;
      if (readable && typeof readable === 'string') {
        return readable.length > MAX_LENGTH ? readable.slice(0, MAX_LENGTH) + '…' : readable;
      }
      // フォールバック: stringify（ただし長さ制限）
      try {
        const json = JSON.stringify(item);
        return json.length > MAX_LENGTH ? json.slice(0, MAX_LENGTH) + '…' : json;
      } catch {
        return '[変換エラー]';
      }
    }
    const str = String(item);
    return str.length > MAX_LENGTH ? str.slice(0, MAX_LENGTH) + '…' : str;
  }).filter((s: string) => s.length > 0);
}

/**
 * 都道府県名を正規化（コード/漢字名どちらでも対応）
 */
function normalizePrefecture(input: string): string {
  const prefMap: Record<string, string> = {
    '13': '東京', '東京都': '東京', '東京': '東京',
    '14': '神奈川', '神奈川県': '神奈川', '神奈川': '神奈川',
    '11': '埼玉', '埼玉県': '埼玉', '埼玉': '埼玉',
    '12': '千葉', '千葉県': '千葉', '千葉': '千葉',
    '27': '大阪', '大阪府': '大阪', '大阪': '大阪',
    '23': '愛知', '愛知県': '愛知', '愛知': '愛知',
    '40': '福岡', '福岡県': '福岡', '福岡': '福岡',
    '01': '北海道', '北海道': '北海道',
  };
  return prefMap[input] || input.replace(/[都道府県]$/, '');
}

/**
 * 従業員数を数値にパース
 */
function parseEmployeeCount(input: string | number | null): number {
  if (typeof input === 'number') return input;
  if (!input || input === 'null' || input === '') return 0;
  
  // "1-5", "6-20" のような範囲表記の場合、中間値を返す
  const rangeMatch = input.match(/(\d+)\s*[-〜~]\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = parseInt(rangeMatch[2]);
    return Math.floor((min + max) / 2);
  }
  
  // "300人以上" のような表記
  const overMatch = input.match(/(\d+)[人名]?以上/);
  if (overMatch) {
    return parseInt(overMatch[1]);
  }
  
  // 単純な数値
  const num = parseInt(input.replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * 従業員数条件にマッチするか判定
 */
function checkEmployeeMatch(count: number, condition: string): boolean {
  if (!condition || condition === 'null') return true;
  
  // "中小企業" などの曖昧な条件は true
  if (condition.includes('中小') || condition.includes('小規模')) {
    return count <= 300;
  }
  
  // "300人以下" のような条件
  const underMatch = condition.match(/(\d+)[人名]?以下/);
  if (underMatch) {
    return count <= parseInt(underMatch[1]);
  }
  
  // "50人以上" のような条件
  const overMatch = condition.match(/(\d+)[人名]?以上/);
  if (overMatch) {
    return count >= parseInt(overMatch[1]);
  }
  
  return true; // 判定できない場合はマッチとみなす
}

/**
 * TOKYOはたらくネット 助成金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-hataraku
 * 
 * P3-1B: 東京3ソース目（discover フェーズ）
 * URL: https://www.hataraku.metro.tokyo.lg.jp/
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（dedupe_key + ON CONFLICT）
 * - 差分検知（新規/更新/スキップを区別）
 * - 失敗はerrors_jsonに記録（握りつぶしNG）
 */
cron.post('/scrape-tokyo-hataraku', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // feed_sourcesでenabled確認
  const sourceResult = await db.prepare(`
    SELECT is_active FROM feed_sources WHERE id = 'src-tokyo-hataraku'
  `).first<{ is_active: number }>();
  
  if (!sourceResult || sourceResult.is_active !== 1) {
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'src-tokyo-hataraku is disabled in feed_sources. Set is_active=1 to enable.',
      },
    });
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'scrape-tokyo-hataraku', 'cron');
  } catch (logErr) {
    console.warn('[Tokyo-Hataraku] Failed to start cron_run log:', logErr);
  }
  
  // P2-2: 差分検知用カウンター
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  
  try {
    const BASE_URL = 'https://www.hataraku.metro.tokyo.lg.jp';
    const LIST_URLS = [
      `${BASE_URL}/shien/`,  // 支援一覧
      `${BASE_URL}/haken/`,  // 派遣・請負
    ];
    
    console.log(`[Tokyo-Hataraku] Starting scrape`);
    
    const results: any[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();
    
    for (const listUrl of LIST_URLS) {
      try {
        console.log(`[Tokyo-Hataraku] Fetching list: ${listUrl}`);
        const listResult = await simpleScrape(listUrl);
        
        if (!listResult.success || !listResult.html) {
          errors.push(`${listUrl}: ${listResult.error || 'Failed to fetch'}`);
          continue;
        }
        
        const html = listResult.html;
        
        // 助成金・奨励金リンクを抽出
        // パターン: 助成|奨励|補助|支援 を含むページへのリンク
        const linkPattern = /href="([^"]*(?:josei|shien|hojo|shoreikin|jyosei)[^"]*\.html?)"/gi;
        let linkMatch;
        
        while ((linkMatch = linkPattern.exec(html)) !== null) {
          const path = linkMatch[1];
          let fullUrl: string;
          
          if (path.startsWith('http')) {
            fullUrl = path;
          } else if (path.startsWith('/')) {
            fullUrl = `${BASE_URL}${path}`;
          } else {
            fullUrl = `${listUrl}${path}`;
          }
          
          // 同じドメインのみ対象
          if (!fullUrl.includes('hataraku.metro.tokyo.lg.jp')) continue;
          if (seenUrls.has(fullUrl)) continue;
          
          seenUrls.add(fullUrl);
        }
        
        // 追加パターン: 一般的な助成金リンク
        const generalPattern = /<a[^>]*href="([^"]+)"[^>]*>[^<]*(?:助成|奨励|補助|支援金)[^<]*<\/a>/gi;
        while ((linkMatch = generalPattern.exec(html)) !== null) {
          const path = linkMatch[1];
          let fullUrl: string;
          
          if (path.startsWith('http')) {
            fullUrl = path;
          } else if (path.startsWith('/')) {
            fullUrl = `${BASE_URL}${path}`;
          } else {
            fullUrl = `${listUrl}${path}`;
          }
          
          if (!fullUrl.includes('hataraku.metro.tokyo.lg.jp')) continue;
          if (seenUrls.has(fullUrl)) continue;
          
          seenUrls.add(fullUrl);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (listErr) {
        errors.push(`List ${listUrl}: ${listErr instanceof Error ? listErr.message : String(listErr)}`);
      }
    }
    
    console.log(`[Tokyo-Hataraku] Found ${seenUrls.size} unique links`);
    
    // 各詳細ページを取得（最大20件）
    const MAX_PILOT = 20;
    const detailUrls = Array.from(seenUrls).slice(0, MAX_PILOT);
    
    for (const detailUrl of detailUrls) {
      try {
        console.log(`[Tokyo-Hataraku] Fetching: ${detailUrl}`);
        
        const detailResult = await simpleScrape(detailUrl);
        if (!detailResult.success || !detailResult.html) {
          errors.push(`${detailUrl}: ${detailResult.error || 'No HTML'}`);
          continue;
        }
        
        const detailHtml = detailResult.html;
        
        // タイトル抽出
        const titleMatch = detailHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          detailHtml.match(/<title>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';
        title = title.replace(/\|.*$/, '').replace(/｜.*$/, '').trim();
        
        if (!title || title.length < 5) {
          errors.push(`${detailUrl}: No valid title found`);
          continue;
        }
        
        // 締切抽出
        const deadlineMatch = detailHtml.match(/(?:申請期限|締切|期限)[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/i) ||
                             detailHtml.match(/令和[0-9]+年[0-9]{1,2}月[0-9]{1,2}日/);
        const deadlineText = deadlineMatch ? deadlineMatch[0] : null;
        
        // PDF抽出
        const pdfUrls = extractPdfLinks(detailHtml, detailUrl);
        
        // コンテンツハッシュ計算
        const contentHash = await calculateContentHash(detailHtml);
        
        // ID生成
        const urlHash = contentHash.slice(0, 8);
        const id = `tokyo-hataraku-${urlHash}`;
        const dedupeKey = `tokyo-hataraku:${urlHash}`;
        
        const subsidyData = {
          id,
          dedupeKey,
          title,
          source: 'tokyo-hataraku',
          sourceUrl: BASE_URL,
          detailUrl,
          deadline: deadlineText,
          issuerName: 'TOKYOはたらくネット（東京都産業労働局）',
          prefectureCode: '13',
          targetAreas: ['東京都'],
          pdfUrls,
          contentHash,
          extractedAt: new Date().toISOString(),
        };
        
        results.push(subsidyData);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        errors.push(`${detailUrl}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Tokyo-Hataraku] Extracted ${results.length} subsidies, ${errors.length} errors`);
    
    // DBに保存
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    let insertedCount = 0;
    let feedInsertedCount = 0;
    
    for (const subsidy of results) {
      try {
        // subsidy_cache に保存
        await db.prepare(`
          INSERT OR REPLACE INTO subsidy_cache 
          (id, source, title, subsidy_max_limit, subsidy_rate,
           target_area_search, target_industry, target_number_of_employees,
           acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
           detail_json, cached_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).bind(
          subsidy.id,
          subsidy.source,
          subsidy.title,
          null,
          null,
          '東京都',
          null,
          null,
          null,
          subsidy.deadline,
          1, // discover段階ではとりあえず受付中扱い
          JSON.stringify({
            detailUrl: subsidy.detailUrl,
            issuerName: subsidy.issuerName,
            pdfUrls: subsidy.pdfUrls,
            contentHash: subsidy.contentHash,
            extractedAt: subsidy.extractedAt,
          }),
          expiresAt
        ).run();
        
        insertedCount++;
        
        // subsidy_feed_items にも保存
        try {
          const existing = await db.prepare(`
            SELECT content_hash FROM subsidy_feed_items WHERE dedupe_key = ?
          `).bind(subsidy.dedupeKey).first<{ content_hash: string }>();
          
          if (existing) {
            if (existing.content_hash === subsidy.contentHash) {
              await db.prepare(`
                UPDATE subsidy_feed_items SET last_seen_at = datetime('now') WHERE dedupe_key = ?
              `).bind(subsidy.dedupeKey).run();
              itemsSkipped++;
            } else {
              await db.prepare(`
                UPDATE subsidy_feed_items SET
                  title = ?,
                  content_hash = ?,
                  is_new = 0,
                  last_seen_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE dedupe_key = ?
              `).bind(subsidy.title, subsidy.contentHash, subsidy.dedupeKey).run();
              itemsUpdated++;
              feedInsertedCount++;
            }
          } else {
            const safeId = subsidy.dedupeKey.replace(':', '-');
            await db.prepare(`
              INSERT INTO subsidy_feed_items 
              (id, dedupe_key, source_id, source_type, title, summary, url, detail_url,
               pdf_urls, issuer_name, prefecture_code, target_area_codes,
               subsidy_amount_max, subsidy_rate_text, status, raw_json, content_hash,
               is_new, first_seen_at, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `).bind(
              safeId,
              subsidy.dedupeKey,
              'src-tokyo-hataraku',
              'prefecture',
              subsidy.title,
              null,
              subsidy.detailUrl,
              subsidy.detailUrl,
              JSON.stringify(subsidy.pdfUrls),
              subsidy.issuerName,
              subsidy.prefectureCode,
              JSON.stringify(['13']),
              null,
              null,
              'unknown',
              JSON.stringify(subsidy),
              subsidy.contentHash
            ).run();
            itemsNew++;
            feedInsertedCount++;
          }
        } catch (feedErr) {
          console.warn(`[Tokyo-Hataraku] Feed insert warning: ${feedErr}`);
        }
        
      } catch (dbErr) {
        errors.push(`DB insert ${subsidy.id}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      }
    }
    
    console.log(`[Tokyo-Hataraku] Inserted ${insertedCount} to cache, ${feedInsertedCount} to feed_items`);
    console.log(`[Tokyo-Hataraku] New: ${itemsNew}, Updated: ${itemsUpdated}, Skipped: ${itemsSkipped}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: results.length,
          items_inserted: itemsNew,
          items_updated: itemsUpdated,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors,
          metadata: {
            links_found: seenUrls.size,
            cache_inserted: insertedCount,
            feed_inserted: feedInsertedCount,
          },
        });
      } catch (logErr) {
        console.warn('[Tokyo-Hataraku] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      links_found: number;
      details_fetched: number;
      inserted: number;
      items_new: number;
      items_updated: number;
      items_skipped: number;
      results: any[];
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Tokyo-Hataraku scrape completed',
        links_found: seenUrls.size,
        details_fetched: results.length,
        inserted: insertedCount,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        items_skipped: itemsSkipped,
        results,
        errors,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Tokyo-Hataraku] Scrape error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Tokyo-Hataraku] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Scrape failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * 全東京ソース一括実行
 * 
 * POST /api/cron/scrape-tokyo-all
 * 
 * P3-1B: tokyo-shigoto + tokyo-kosha + tokyo-hataraku を順次実行
 */
cron.post('/scrape-tokyo-all', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'scrape-tokyo-all', 'cron');
  } catch (logErr) {
    console.warn('[Tokyo-All] Failed to start cron_run log:', logErr);
  }
  
  const results: any[] = [];
  const errors: string[] = [];
  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  // 各ソースを順次実行
  const sources = ['tokyo-shigoto', 'tokyo-kosha', 'tokyo-hataraku'];
  const baseUrl = `http://localhost:3000/api/cron`;
  const cronSecret = (c.env as any).CRON_SECRET;
  
  for (const source of sources) {
    try {
      console.log(`[Tokyo-All] Running: ${source}`);
      
      const response = await fetch(`${baseUrl}/scrape-${source}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': cronSecret,
        },
      });
      
      const result = await response.json() as any;
      
      if (result.success) {
        results.push({
          source,
          status: 'success',
          items_new: result.data?.items_new ?? 0,
          items_updated: result.data?.items_updated ?? 0,
          items_skipped: result.data?.items_skipped ?? 0,
        });
        totalNew += result.data?.items_new ?? 0;
        totalUpdated += result.data?.items_updated ?? 0;
        totalSkipped += result.data?.items_skipped ?? 0;
      } else {
        results.push({
          source,
          status: 'failed',
          error: result.error?.message ?? 'Unknown error',
        });
        errors.push(`${source}: ${result.error?.message ?? 'Unknown error'}`);
      }
      
      // 各ソース間で1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({
        source,
        status: 'error',
        error: errMsg,
      });
      errors.push(`${source}: ${errMsg}`);
    }
  }
  
  // P2-0: 実行ログ完了
  if (runId) {
    try {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: sources.length,
        items_inserted: totalNew,
        items_updated: totalUpdated,
        items_skipped: totalSkipped,
        error_count: errors.length,
        errors: errors,
        metadata: {
          sources_run: sources,
          results,
        },
      });
    } catch (logErr) {
      console.warn('[Tokyo-All] Failed to finish cron_run log:', logErr);
    }
  }
  
  return c.json<ApiResponse<{
    message: string;
    total_new: number;
    total_updated: number;
    total_skipped: number;
    results: any[];
    errors: string[];
    timestamp: string;
    run_id?: string;
  }>>({
    success: true,
    data: {
      message: 'Tokyo all sources scrape completed',
      total_new: totalNew,
      total_updated: totalUpdated,
      total_skipped: totalSkipped,
      results,
      errors,
      timestamp: new Date().toISOString(),
      run_id: runId ?? undefined,
    },
  });
});

/**
 * JGrants detail_json エンリッチジョブ v2
 * 
 * POST /api/cron/enrich-jgrants
 * 
 * P3-2F改: JGrants WALL_CHAT_READY拡大（毎日50件バッチ）
 * 
 * 改善点（v2）:
 * - V2 API使用: workflow（公募回ごとの期間情報）を取得
 * - detail HTMLからPDFリンクを正規表現で抽出
 * - 抽出したPDFリンクをextraction_queueに登録
 * - 主要補助金を最優先処理（ものづくり/持続化/事業再構築）
 * - 優先度による3段階処理（Tier1/Tier2/通常）
 * 
 * 推奨Cronスケジュール: 毎日 07:00 JST (sync-jgrantsの1時間後)
 */
cron.post('/enrich-jgrants', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'enrich-jgrants', 'cron');
  } catch (logErr) {
    console.warn('[Enrich-JGrants] Failed to start cron_run log:', logErr);
  }
  
  // forceモード: v2エンリッチ済みでもeligible_expensesがないものを再処理
  const forceMode = c.req.query('force') === 'true';
  // allモード: 期限切れも含めて全件を対象にする
  const allMode = c.req.query('all') === 'true';
  
  // 設定 (Cloudflare Worker 30秒制限のため10件に制限)
  const MAX_ITEMS_PER_RUN = 10;
  const JGRANTS_DETAIL_API_V2 = 'https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id';
  
  let itemsEnriched = 0;
  let itemsSkipped = 0;
  let itemsReady = 0;
  let pdfLinksQueued = 0;
  const errors: string[] = [];
  
  // =====================================================
  // ヘルパー関数
  // =====================================================
  
  /**
   * HTMLからPDFリンクを抽出
   */
  function extractPdfLinksFromHtml(html: string): string[] {
    const pdfUrls: string[] = [];
    // href="...pdf" パターン
    const hrefPattern = /href=["']([^"']*\.pdf)["']/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      pdfUrls.push(match[1]);
    }
    // http(s)://...pdf パターン（テキスト内）
    const urlPattern = /https?:\/\/[^\s"'<>]+\.pdf/gi;
    while ((match = urlPattern.exec(html)) !== null) {
      if (!pdfUrls.includes(match[0])) {
        pdfUrls.push(match[0]);
      }
    }
    return pdfUrls;
  }
  
  /**
   * HTMLから参照URL（外部サイト）を抽出
   * jGrants以外のドメインへのリンクを取得
   */
  function extractReferenceUrls(html: string): string[] {
    const refUrls: string[] = [];
    // href属性からURL抽出
    const hrefPattern = /href=["'](https?:\/\/[^"']+)["']/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      const url = match[1];
      // jGrants以外のドメインを対象とする
      if (!url.includes('jgrants-portal.go.jp') && 
          !url.includes('javascript:') &&
          !url.includes('#')) {
        // 末尾のエスケープ文字を除去
        const cleanUrl = url.replace(/\\+$/, '').replace(/\\/g, '');
        if (!refUrls.includes(cleanUrl)) {
          refUrls.push(cleanUrl);
        }
      }
    }
    return refUrls;
  }
  
  /**
   * 概要テキストから申請要件・対象経費・対象者を簡易抽出
   * セクションヘッダー「■」「◆」「●」などで区切られた箇所から抽出
   */
  function extractFieldsFromOverview(overviewText: string): {
    application_requirements?: string[];
    eligible_expenses?: string[];
    target_businesses?: string[];
  } {
    const result: {
      application_requirements?: string[];
      eligible_expenses?: string[];
      target_businesses?: string[];
    } = {};
    
    // セクション名のパターン（日本語の一般的なヘッダー）
    const sections = overviewText.split(/[■◆●▼]/);
    
    for (const section of sections) {
      const sectionText = section.trim();
      if (sectionText.length < 10) continue;
      
      // セクション名は最初の空白または改行まで
      const headerEndIdx = sectionText.search(/[\s。、]/);
      const header = headerEndIdx > 0 ? sectionText.substring(0, Math.min(headerEndIdx, 20)) : sectionText.substring(0, 20);
      const content = headerEndIdx > 0 ? sectionText.substring(headerEndIdx).trim() : sectionText;
      
      // 対象者・対象事業者
      if (header.includes('対象者') || header.includes('対象事業者') || 
          header.includes('申請対象') || header.includes('交付対象者')) {
        const cleanContent = content.substring(0, 500).trim();
        if (cleanContent.length > 20 && !result.target_businesses) {
          result.target_businesses = [cleanContent];
        }
      }
      
      // 申請要件・補助要件・要件
      else if (header.includes('要件') || header.includes('条件')) {
        const cleanContent = content.substring(0, 500).trim();
        if (cleanContent.length > 20 && !result.application_requirements) {
          result.application_requirements = [cleanContent];
        }
      }
      
      // 対象経費・補助対象経費・助成対象（事業内容含む）
      else if (header.includes('対象経費') || header.includes('補助対象') || 
          header.includes('助成対象経費') || header.includes('助成対象') ||
          header.includes('対象事業')) {
        const cleanContent = content.substring(0, 500).trim();
        if (cleanContent.length > 20 && !result.eligible_expenses) {
          result.eligible_expenses = [cleanContent];
        }
      }
      
      // 支援内容・助成金の額（対象経費の代替）
      else if (header.includes('支援内容') || header.includes('補助内容') || 
          header.includes('助成内容') || header.includes('助成金の額') ||
          header.includes('補助金額') || header.includes('助成額')) {
        const cleanContent = content.substring(0, 500).trim();
        if (cleanContent.length > 20 && !result.eligible_expenses) {
          result.eligible_expenses = [cleanContent];
        }
      }
    }
    
    return result;
  }
  
  /**
   * HTMLからテキストを抽出（タグ除去、正規化）
   */
  function htmlToText(html: string, maxLength: number = 3000): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
  }
  
  /**
   * extraction_queueにPDF抽出ジョブを登録
   */
  async function queuePdfExtraction(
    subsidyId: string,
    pdfUrls: string[],
    priority: number = 100
  ): Promise<number> {
    let queued = 0;
    for (const pdfUrl of pdfUrls.slice(0, 5)) { // 最大5件/制度
      try {
        const queueId = generateUUID();
        const shard = shardKey16(subsidyId);
        await db.prepare(`
          INSERT OR IGNORE INTO extraction_queue 
            (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
          VALUES (?, ?, ?, 'extract_pdf', ?, 'queued', datetime('now'), datetime('now'))
        `).bind(queueId, subsidyId, shard, priority).run();
        
        // pdf_urlをmetadataとして別途管理（detail_jsonに保存済み）
        queued++;
      } catch (err) {
        // 重複は無視
      }
    }
    return queued;
  }
  
  try {
    console.log(`[Enrich-JGrants-v2] Starting batch enrichment (max ${MAX_ITEMS_PER_RUN})`);
    
    // =====================================================
    // 優先度3段階: Tier1(主要) > Tier2(準主要) > 通常
    // =====================================================
    const tier1Keywords = ['ものづくり', '持続化', '事業再構築', '再構築'];
    const tier2Keywords = ['省力化', 'IT導入', 'DX', '創業', 'デジタル'];
    
    // Tier1: 主要補助金（最優先、priority=10）
    const tier1Condition = tier1Keywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    // Tier2: 準主要補助金（priority=50）
    const tier2Condition = tier2Keywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    // 全キーワード
    const allKeywords = [...tier1Keywords, ...tier2Keywords, '補助金', '助成'];
    const allCondition = allKeywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    
    // 対象制度を取得（優先度順）
    // v2未エンリッチ + 受付中 + キーワードマッチ
    // forceモード: v2済みでもeligible_expensesがないものを対象
    const enrichmentCondition = forceMode
      ? `(detail_json IS NULL OR detail_json NOT LIKE '%"enriched_version":"v2"%' OR (json_extract(detail_json, '$.eligible_expenses') IS NULL AND detail_json LIKE '%"enriched_version":"v2"%'))`
      : `(detail_json IS NULL OR detail_json NOT LIKE '%"enriched_version":"v2"%')`;
    
    // allモードの場合は期限切れも含める
    const dateCondition = allMode 
      ? '1=1' 
      : `(acceptance_end_datetime IS NULL OR acceptance_end_datetime > datetime('now'))`;
    
    const targets = await db.prepare(`
      SELECT 
        id, title, detail_json, acceptance_end_datetime,
        CASE 
          WHEN (${tier1Condition}) THEN 1
          WHEN (${tier2Condition}) THEN 2
          ELSE 3
        END as priority_tier
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND wall_chat_ready = 0
        AND ${enrichmentCondition}
        AND ${dateCondition}
        AND (${allCondition})
      ORDER BY 
        priority_tier ASC,
        CASE WHEN acceptance_end_datetime IS NOT NULL THEN 0 ELSE 1 END,
        acceptance_end_datetime ASC
      LIMIT ?
    `).bind(MAX_ITEMS_PER_RUN).all<{
      id: string;
      title: string;
      detail_json: string | null;
      acceptance_end_datetime: string | null;
      priority_tier: number;
    }>();
    
    const tier1Count = targets.results?.filter(t => t.priority_tier === 1).length ?? 0;
    const tier2Count = targets.results?.filter(t => t.priority_tier === 2).length ?? 0;
    console.log(`[Enrich-JGrants-v2] Found ${targets.results?.length ?? 0} targets (Tier1: ${tier1Count}, Tier2: ${tier2Count})`);
    
    if (!targets.results || targets.results.length === 0) {
      // 優先キーワードなしの全件から取得を試みる
      const fallbackTargets = await db.prepare(`
        SELECT id, title, detail_json, acceptance_end_datetime, 3 as priority_tier
        FROM subsidy_cache
        WHERE source = 'jgrants'
          AND wall_chat_ready = 0
          AND ${enrichmentCondition}
          AND ${dateCondition}
        ORDER BY acceptance_end_datetime ASC
        LIMIT ?
      `).bind(MAX_ITEMS_PER_RUN).all<{
        id: string;
        title: string;
        detail_json: string | null;
        acceptance_end_datetime: string | null;
        priority_tier: number;
      }>();
      
      if (!fallbackTargets.results || fallbackTargets.results.length === 0) {
        if (runId) {
          await finishCronRun(db, runId, 'success', {
            items_processed: 0,
            metadata: { message: 'No targets found' },
          });
        }
        return c.json<ApiResponse<{ message: string }>>({
          success: true,
          data: { message: 'No targets found for enrichment' },
        });
      }
      targets.results = fallbackTargets.results;
    }
    
    // 各制度の詳細を取得
    for (const target of targets.results) {
      try {
        console.log(`[Enrich-JGrants-v2] Fetching (Tier${target.priority_tier}): ${target.id} - ${target.title.substring(0, 50)}`);
        
        // V2 API から詳細取得
        const response = await fetch(`${JGRANTS_DETAIL_API_V2}/${target.id}`, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          errors.push(`${target.id}: HTTP ${response.status}`);
          itemsSkipped++;
          continue;
        }
        
        const data = await response.json() as any;
        const subsidy = data.result?.[0] || data.result || data;
        
        if (!subsidy) {
          errors.push(`${target.id}: No result in response`);
          itemsSkipped++;
          continue;
        }
        
        // =====================================================
        // detail_json構築（v2拡張版）
        // =====================================================
        const detailJson: Record<string, any> = {};
        
        // 1. 概要（overview）- detailから抽出
        if (subsidy.detail && subsidy.detail.length > 20) {
          detailJson.overview = htmlToText(subsidy.detail, 3000);
          detailJson.overview_html_length = subsidy.detail.length;
          
          // 1.5. 概要テキストから申請要件・対象経費・対象者を簡易抽出
          const extractedFields = extractFieldsFromOverview(detailJson.overview);
          if (extractedFields.application_requirements) {
            detailJson.application_requirements = extractedFields.application_requirements;
          }
          if (extractedFields.eligible_expenses) {
            detailJson.eligible_expenses = extractedFields.eligible_expenses;
          }
          if (extractedFields.target_businesses) {
            detailJson.target_businesses = extractedFields.target_businesses;
          }
        }
        
        // 2. キャッチフレーズ
        if (subsidy.subsidy_catch_phrase) {
          detailJson.catch_phrase = subsidy.subsidy_catch_phrase;
        }
        
        // 3. 用途
        if (subsidy.use_purpose) {
          detailJson.use_purpose = subsidy.use_purpose;
        }
        
        // 4. 対象業種
        if (subsidy.industry) {
          detailJson.target_industry = subsidy.industry;
        }
        
        // 5. 対象従業員数
        if (subsidy.target_number_of_employees) {
          detailJson.target_employees = subsidy.target_number_of_employees;
        }
        
        // 6. 補助率
        if (subsidy.subsidy_rate) {
          detailJson.subsidy_rate = subsidy.subsidy_rate;
        }
        
        // 7. 補助上限
        if (subsidy.subsidy_max_limit) {
          detailJson.subsidy_max_limit = subsidy.subsidy_max_limit;
        }
        
        // 8. 複数申請可否
        if (subsidy.is_enable_multiple_request !== undefined) {
          detailJson.is_enable_multiple_request = subsidy.is_enable_multiple_request;
        }
        
        // 9. 申請受付有無
        if (subsidy.request_reception_presence) {
          detailJson.request_reception_presence = subsidy.request_reception_presence;
        }
        
        // 10. 型（一般型、特別枠など）
        if (subsidy.granttype) {
          detailJson.grant_type = subsidy.granttype;
        }
        
        // 11. 公募詳細ページURL
        if (subsidy.front_subsidy_detail_page_url) {
          detailJson.related_url = subsidy.front_subsidy_detail_page_url;
        }
        
        // 12. workflow（V2専用: 公募回ごとの期間情報）
        if (subsidy.workflow && Array.isArray(subsidy.workflow) && subsidy.workflow.length > 0) {
          detailJson.workflows = subsidy.workflow.map((w: any) => ({
            id: w.id,
            target_area: w.target_area_search,
            target_area_detail: w.target_area_detail,
            fiscal_year_round: w.fiscal_year_round,
            acceptance_start: w.acceptance_start_datetime,
            acceptance_end: w.acceptance_end_datetime,
            project_end: w.project_end_deadline,
          }));
          // 最新の締切を採用
          const latestEnd = subsidy.workflow
            .map((w: any) => w.acceptance_end_datetime)
            .filter(Boolean)
            .sort()
            .pop();
          if (latestEnd) {
            detailJson.acceptance_end_datetime = latestEnd;
          }
        }
        
        // 13. PDFリンク抽出（detail HTMLから）
        const pdfUrls: string[] = [];
        if (subsidy.detail) {
          const extractedPdfs = extractPdfLinksFromHtml(subsidy.detail);
          pdfUrls.push(...extractedPdfs);
        }
        
        // 13.5. 参照URL抽出（外部サイトへのリンク）
        if (subsidy.detail) {
          const refUrls = extractReferenceUrls(subsidy.detail);
          if (refUrls.length > 0) {
            detailJson.reference_urls = refUrls;
            console.log(`[Enrich-JGrants-v2] Found ${refUrls.length} reference URLs for ${target.id}`);
          }
        }
        
        // 14. API添付ファイル（application_guidelines, outline_of_grant, application_form）
        const attachments: Array<{ name: string; type: string; has_data: boolean }> = [];
        
        if (subsidy.application_guidelines && Array.isArray(subsidy.application_guidelines)) {
          for (const ag of subsidy.application_guidelines) {
            attachments.push({
              name: ag.name || '公募要領',
              type: 'application_guidelines',
              has_data: !!(ag.data && ag.data.length > 0),
            });
          }
        }
        if (subsidy.outline_of_grant && Array.isArray(subsidy.outline_of_grant)) {
          for (const og of subsidy.outline_of_grant) {
            attachments.push({
              name: og.name || '交付要綱',
              type: 'outline_of_grant',
              has_data: !!(og.data && og.data.length > 0),
            });
          }
        }
        if (subsidy.application_form && Array.isArray(subsidy.application_form)) {
          for (const af of subsidy.application_form) {
            attachments.push({
              name: af.name || '申請様式',
              type: 'application_form',
              has_data: !!(af.data && af.data.length > 0),
            });
          }
        }
        
        if (attachments.length > 0) {
          detailJson.attachments = attachments;
        }
        
        // 15. PDF URLs統合
        if (pdfUrls.length > 0) {
          detailJson.pdf_urls = [...new Set(pdfUrls)]; // 重複除去
        }
        
        // 16. 必要書類リスト（application_formから名前抽出）
        if (subsidy.application_form && Array.isArray(subsidy.application_form)) {
          const docNames = subsidy.application_form
            .map((f: any) => f.name || f.title)
            .filter((s: any) => typeof s === 'string' && s.length >= 2);
          if (docNames.length > 0) {
            detailJson.required_documents = docNames;
          }
        }
        
        // 17. エンリッチメタ情報
        detailJson.enriched_at = new Date().toISOString();
        detailJson.enriched_version = 'v2';
        detailJson.api_version = 'v2';
        
        // 既存detail_jsonとマージ
        const existing = target.detail_json ? JSON.parse(target.detail_json) : {};
        const merged = { ...existing, ...detailJson };
        
        // DB更新
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            cached_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(merged), target.id).run();
        
        // PDFをextraction_queueに登録（Tier1は高優先度）
        if (pdfUrls.length > 0) {
          const queuePriority = target.priority_tier === 1 ? 10 : (target.priority_tier === 2 ? 50 : 100);
          const queued = await queuePdfExtraction(target.id, pdfUrls, queuePriority);
          pdfLinksQueued += queued;
        }
        
        // WALL_CHAT_READY判定
        const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
          itemsReady++;
        }
        
        itemsEnriched++;
        
        // レート制限: 300ms待機（v2: やや短縮）
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        itemsSkipped++;
      }
    }
    
    console.log(`[Enrich-JGrants-v2] Completed: enriched=${itemsEnriched}, ready=${itemsReady}, pdfs_queued=${pdfLinksQueued}, skipped=${itemsSkipped}, errors=${errors.length}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > itemsEnriched ? 'partial' : 'success', {
          items_processed: targets.results.length,
          items_inserted: itemsEnriched,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors.slice(0, 50),
          metadata: {
            items_ready: itemsReady,
            pdf_links_queued: pdfLinksQueued,
            tier1_count: tier1Count,
            tier2_count: tier2Count,
            max_items_per_run: MAX_ITEMS_PER_RUN,
            api_version: 'v2',
          },
        });
      } catch (logErr) {
        console.warn('[Enrich-JGrants-v2] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_enriched: number;
      items_ready: number;
      items_skipped: number;
      pdf_links_queued: number;
      tier1_count: number;
      tier2_count: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'JGrants enrichment completed (v2)',
        items_enriched: itemsEnriched,
        items_ready: itemsReady,
        items_skipped: itemsSkipped,
        pdf_links_queued: pdfLinksQueued,
        tier1_count: tier1Count,
        tier2_count: tier2Count,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Enrich-JGrants-v2] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Enrich-JGrants-v2] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * Tokyo-Shigoto detail_json エンリッチジョブ
 * 
 * POST /api/cron/enrich-tokyo-shigoto
 * 
 * P3-2F: tokyo-shigoto WALL_CHAT_READY拡大
 * - 対象: wall_chat_ready=0 かつ detailUrl がある制度
 * - HTMLページから詳細を取得してdetail_jsonを充実化
 */
cron.post('/enrich-tokyo-shigoto', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // admin-dashboard の enrich API を内部呼び出し
  const adminUrl = 'http://localhost:3000/api/admin-ops/tokyo-shigoto/enrich-detail';
  const cronSecret = (c.env as any).CRON_SECRET;
  
  try {
    // admin APIを呼び出し（内部的にはauth不要だが、外部からの呼び出しには必要）
    // ここではCron経由なので直接DBアクセスする方が安全
    
    // P2-0: 実行ログ開始
    let runId: string | null = null;
    try {
      runId = await startCronRun(db, 'enrich-tokyo-shigoto', 'cron');
    } catch (logErr) {
      console.warn('[Enrich-Tokyo-Shigoto] Failed to start cron_run log:', logErr);
    }
    
    // 対象制度を取得（最大10件）
    const targets = await db.prepare(`
      SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
      FROM subsidy_cache
      WHERE source = 'tokyo-shigoto'
        AND wall_chat_ready = 0
        AND json_extract(detail_json, '$.detailUrl') IS NOT NULL
      ORDER BY cached_at DESC
      LIMIT 10
    `).all<{
      id: string;
      title: string;
      detail_json: string | null;
      detail_url: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) {
        await finishCronRun(db, runId, 'success', {
          items_processed: 0,
          metadata: { message: 'No targets found' },
        });
      }
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found for enrichment' },
      });
    }
    
    let itemsEnriched = 0;
    let itemsReady = 0;
    const errors: string[] = [];
    
    for (const target of targets.results) {
      if (!target.detail_url) continue;
      
      try {
        // HTMLを取得
        const response = await fetch(target.detail_url, {
          headers: { 
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
          },
        });
        
        if (!response.ok) {
          errors.push(`${target.id}: HTTP ${response.status}`);
          continue;
        }
        
        const html = await response.text();
        
        // 簡易的な詳細抽出（admin-dashboard.tsの詳細版はそちらで実行）
        const detailJson: Record<string, any> = {};
        
        // 概要を表から抽出
        const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
        if (tableMatch) {
          const tableText = tableMatch[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (tableText.length > 50) {
            detailJson.overview = tableText.substring(0, 1500);
          }
        }
        
        // 年度末をデフォルト締切として設定
        const now = new Date();
        const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        detailJson.acceptance_end_datetime = `${fiscalYear + 1}-03-31T23:59:59Z`;
        
        // デフォルトの必要書類
        detailJson.required_documents = ['募集要項', '申請書', '事業計画書'];
        
        // 既存とマージ
        const existing = target.detail_json ? JSON.parse(target.detail_json) : {};
        const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };
        
        // DB更新
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            cached_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(merged), target.id).run();
        
        // WALL_CHAT_READY判定
        const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
          itemsReady++;
        }
        
        itemsEnriched++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // P2-0: 実行ログ完了
    if (runId) {
      await finishCronRun(db, runId, errors.length > itemsEnriched ? 'partial' : 'success', {
        items_processed: targets.results.length,
        items_inserted: itemsEnriched,
        error_count: errors.length,
        errors: errors,
        metadata: { items_ready: itemsReady },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_enriched: number;
      items_ready: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Tokyo-Shigoto enrichment completed',
        items_enriched: itemsEnriched,
        items_ready: itemsReady,
        errors,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Enrich-Tokyo-Shigoto] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

// =====================================================
// A-4: PDF抽出Cronジョブ（統一入口）- 完成版
// POST /api/cron/extract-pdf-forms
// 
// ハイブリッド構成:
// 1. HTML抽出（最優先・最安）
// 2. Firecrawl（テキスト埋め込みPDF用）
// 3. Google Vision OCR（画像PDF用・最後の手段）
// 
// 失敗は feed_failures に記録、メトリクスを cron_runs に保存
// =====================================================

import { extractAndUpdateSubsidy, type ExtractSource } from '../lib/pdf/pdf-extract-router';
import { checkCooldown, DEFAULT_COOLDOWN_POLICY } from '../lib/pdf/extraction-cooldown';
import { recordCostGuardFailure } from '../lib/failures/feed-failure-writer';

cron.post('/extract-pdf-forms', async (c) => {
  const db = c.env.DB;
  const env = c.env;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'extract-pdf-forms', 'cron');
  } catch (logErr) {
    console.warn('[Extract-PDF-Forms] Failed to start cron_run log:', logErr);
  }
  
  // --- 定数（凍結仕様）---
  const MAX_ITEMS_PER_RUN = 10;      // 1回あたり最大10件（Firecrawl呼び出しによるタイムアウト防止）
  const MIN_FORMS = 2;               // 最低フォーム数
  
  // 環境変数チェック
  const hasFirecrawl = !!env.FIRECRAWL_API_KEY;
  const hasVision = !!env.GOOGLE_CLOUD_API_KEY;
  console.log(`[Extract-PDF-Forms] API Keys: Firecrawl=${hasFirecrawl}, Vision=${hasVision}`);
  
  try {
    // --- Step 1: 抽出対象を取得 ---
    const targets = await db.prepare(`
      SELECT 
        id,
        source,
        title,
        detail_json
      FROM subsidy_cache
      WHERE wall_chat_ready = 0
        AND detail_json IS NOT NULL
        AND detail_json != '{}'
        AND (
          json_extract(detail_json, '$.detailUrl') IS NOT NULL
          OR json_extract(detail_json, '$.pdfUrls') IS NOT NULL
        )
        AND (
          json_extract(detail_json, '$.required_forms') IS NULL
          OR json_array_length(json_extract(detail_json, '$.required_forms')) < ?
        )
      ORDER BY 
        CASE 
          WHEN source IN ('tokyo-shigoto', 'tokyo-kosha', 'tokyo-hataraku') THEN 1
          WHEN source = 'jgrants' THEN 2
          ELSE 3
        END,
        cached_at DESC
      LIMIT ?
    `).bind(MIN_FORMS, MAX_ITEMS_PER_RUN).all<{
      id: string;
      source: string;
      title: string;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) {
        await finishCronRun(db, runId, 'success', {
          items_processed: 0,
          metadata: { message: 'No targets to extract' },
        });
      }
      
      return c.json<ApiResponse<{ processed: number; message: string }>>({
        success: true,
        data: {
          processed: 0,
          message: 'No targets to extract',
        },
      });
    }
    
    console.log(`[Extract-PDF-Forms] Found ${targets.results.length} targets`);
    
    // --- Step 2: 各制度を処理（統一入口経由）---
    const results: Array<{
      id: string;
      source: string;
      success: boolean;
      extractedFrom: string;
      formsCount: number;
      fieldsTotal: number;
      wallChatReady: boolean;
      error?: string;
    }> = [];
    
    const errors: string[] = [];
    let successCount = 0;
    let failCount = 0;
    let readyCount = 0;
    
    // メトリクス集計
    const totalMetrics = {
      htmlAttempted: 0,
      htmlSuccess: 0,
      firecrawlAttempted: 0,
      firecrawlSuccess: 0,
      firecrawlSkippedByCooldown: 0,  // cooldown でスキップした件数
      visionAttempted: 0,
      visionSuccess: 0,
      visionSkippedByCooldown: 0,     // cooldown でスキップした件数
      visionPagesTotal: 0,
      dedupeSkipped: 0,
    };
    
    for (const target of targets.results) {
      try {
        // detail_json をパース
        let detail: any = {};
        try {
          detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        } catch {
          detail = {};
        }
        
        const detailUrl = detail.detailUrl || null;
        const pdfUrls = detail.pdfUrls || detail.pdf_urls || [];
        
        // URL が無い場合はスキップ
        if (!detailUrl && (!Array.isArray(pdfUrls) || pdfUrls.length === 0)) {
          results.push({
            id: target.id,
            source: target.source,
            success: false,
            extractedFrom: 'none',
            formsCount: 0,
            fieldsTotal: 0,
            wallChatReady: false,
            error: 'No URL to extract',
          });
          failCount++;
          continue;
        }
        
        // --- cooldown チェック（Firecrawl 6h / Vision 24h）---
        const cooldown = await checkCooldown(db, target.id, DEFAULT_COOLDOWN_POLICY);
        
        // --- 統一入口で抽出実行 ---
        const extractSource: ExtractSource = {
          subsidyId: target.id,
          source: target.source,
          title: target.title,
          detailUrl,
          pdfUrls: Array.isArray(pdfUrls) ? pdfUrls : [],
          existingDetailJson: target.detail_json,
        };
        
        const extractResult = await extractAndUpdateSubsidy(extractSource, {
          FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY,
          GOOGLE_CLOUD_API_KEY: env.GOOGLE_CLOUD_API_KEY,
          allowFirecrawl: cooldown.allowFirecrawl,
          allowVision: cooldown.allowVision,
          DB: db, // P0: DB を必ず渡す（Freeze-COST-2）
          sourceId: target.source,
        });
        
        // P0: CostGuard 発生時は feed_failures に落とす（Freeze-3）
        try {
          const m = extractResult.metrics;
          const anyUrl = detailUrl || (pdfUrls?.[0] as string) || '';
          
          if (m.firecrawlBlockedByCostGuard) {
            await recordCostGuardFailure(db, {
              subsidy_id: target.id,
              source_id: target.source,
              url: anyUrl,
              stage: 'pdf',
              message: 'COST_GUARD_DB_MISSING: Firecrawl blocked because env.DB was missing (Freeze-COST-2)',
            });
          }
          if (m.visionBlockedByCostGuard) {
            await recordCostGuardFailure(db, {
              subsidy_id: target.id,
              source_id: target.source,
              url: anyUrl,
              stage: 'pdf',
              message: 'COST_GUARD_DB_MISSING: Vision OCR blocked because env.DB was missing (Freeze-COST-2)',
            });
          }
        } catch (e) {
          console.warn('[cron/extract-pdf-forms] failed to record CostGuard feed_failures:', e);
        }
        
        // メトリクス集計
        if (extractResult.metrics.htmlAttempted) totalMetrics.htmlAttempted++;
        if (extractResult.metrics.htmlSuccess) totalMetrics.htmlSuccess++;
        if (extractResult.metrics.firecrawlAttempted) totalMetrics.firecrawlAttempted++;
        if (extractResult.metrics.firecrawlSuccess) totalMetrics.firecrawlSuccess++;
        if (extractResult.metrics.firecrawlSkippedByCooldown) totalMetrics.firecrawlSkippedByCooldown++;
        if (extractResult.metrics.visionAttempted) totalMetrics.visionAttempted++;
        if (extractResult.metrics.visionSuccess) totalMetrics.visionSuccess++;
        if (extractResult.metrics.visionSkippedByCooldown) totalMetrics.visionSkippedByCooldown++;
        totalMetrics.visionPagesTotal += extractResult.metrics.visionPagesProcessed;
        
        // --- extraction_logs に記録 ---
        try {
          // OCRコスト概算（Google Vision: $1.50/1000ページ）
          const ocrEstimatedCost = extractResult.metrics.visionPagesProcessed * 0.0015;
          
          await db.prepare(`
            INSERT INTO extraction_logs (
              subsidy_id, source, title, url, url_type, extraction_method,
              success, text_length, forms_count, fields_count,
              ocr_pages_processed, ocr_estimated_cost,
              failure_reason, failure_message, content_hash,
              cron_run_id, processing_time_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            target.id,
            target.source,
            target.title,
            detailUrl || (pdfUrls[0] || ''),
            detailUrl ? 'html' : 'pdf',
            extractResult.extractedFrom,
            extractResult.success ? 1 : 0,
            extractResult.metrics.textLengthExtracted,
            extractResult.formsCount,
            extractResult.fieldsTotal,
            extractResult.metrics.visionPagesProcessed,
            ocrEstimatedCost,
            extractResult.failureReason || null,
            extractResult.failureMessage || null,
            extractResult.contentHash || null,
            runId,
            extractResult.metrics.processingTimeMs
          ).run();
        } catch (logErr) {
          console.warn(`[Extract-PDF-Forms] Failed to log extraction for ${target.id}:`, logErr);
        }
        
        // 成功 または 電子申請検出時はDB更新 (v3)
        const shouldUpdate = extractResult.success || extractResult.isElectronicApplication;
        
        if (shouldUpdate) {
          // DB更新
          await db.prepare(`
            UPDATE subsidy_cache 
            SET detail_json = ?,
                wall_chat_ready = ?,
                wall_chat_missing = ?
            WHERE id = ?
          `).bind(
            extractResult.newDetailJson,
            extractResult.wallChatReady ? 1 : 0,
            JSON.stringify(extractResult.wallChatMissing),
            target.id
          ).run();
          
          results.push({
            id: target.id,
            source: target.source,
            success: extractResult.success,
            extractedFrom: extractResult.extractedFrom,
            formsCount: extractResult.formsCount,
            fieldsTotal: extractResult.fieldsTotal,
            wallChatReady: extractResult.wallChatReady,
            isElectronicApplication: extractResult.isElectronicApplication,
          });
          
          if (extractResult.success) successCount++;
          if (extractResult.wallChatReady) readyCount++;
          
          // feed_failures を resolved に
          await resolveFailure(db, target.id, detailUrl || '');
        } else {
          // 失敗記録
          if (extractResult.failureReason) {
            await recordFailure(
              db, 
              target.id, 
              target.source, 
              detailUrl || (pdfUrls[0] || ''), 
              'extract', 
              extractResult.failureReason,
              extractResult.failureMessage || 'Unknown error'
            );
          }
          
          results.push({
            id: target.id,
            source: target.source,
            success: false,
            extractedFrom: extractResult.extractedFrom,
            formsCount: extractResult.formsCount,
            fieldsTotal: extractResult.fieldsTotal,
            wallChatReady: false,
            error: extractResult.failureMessage,
          });
          failCount++;
        }
        
      } catch (e: any) {
        console.error(`[Extract-PDF-Forms] Error processing ${target.id}:`, e.message);
        errors.push(`${target.id}: ${e.message}`);
        results.push({
          id: target.id,
          source: target.source,
          success: false,
          extractedFrom: 'none',
          formsCount: 0,
          fieldsTotal: 0,
          wallChatReady: false,
          error: e.message,
        });
        failCount++;
      }
    }
    
    // --- Step 3: 実行ログ完了（メトリクス含む）---
    if (runId) {
      await finishCronRun(db, runId, failCount === 0 ? 'success' : 'partial', {
        items_processed: targets.results.length,
        items_inserted: 0,
        items_updated: successCount,
        items_skipped: failCount,
        error_count: errors.length,
        errors: errors.slice(0, 20),
        metadata: {
          ready_count: readyCount,
          sources: [...new Set(targets.results.map(t => t.source))],
          // 計測メトリクス
          metrics: totalMetrics,
          api_keys_configured: {
            firecrawl: hasFirecrawl,
            vision: hasVision,
          },
        },
      });
    }
    
    return c.json<ApiResponse<{
      processed: number;
      succeeded: number;
      failed: number;
      newReady: number;
      metrics: typeof totalMetrics;
      results: typeof results;
      run_id?: string;
    }>>({
      success: true,
      data: {
        processed: targets.results.length,
        succeeded: successCount,
        failed: failCount,
        newReady: readyCount,
        metrics: totalMetrics,
        results,
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Extract-PDF-Forms] Error:', error);
    
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

// --- ヘルパー関数 ---

function extractFormsSimple(text: string): Array<{ name: string; form_id?: string; fields: string[] }> {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const forms: Array<{ name: string; form_id?: string; fields: string[] }> = [];
  
  // 様式パターン
  const formPatterns = [
    /様式\s*第?\s*(\d+)\s*号?/,
    /様式\s*(\d+(?:-\d+)?)/,
    /別紙\s*(\d+)/,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 様式名マッチ
    let formId: string | undefined;
    for (const p of formPatterns) {
      const m = line.match(p);
      if (m) {
        formId = m[0].replace(/\s+/g, '');
        break;
      }
    }
    
    // 様式っぽい行（キーワードチェック）
    const isFormLine = formId || 
      (/(申請書|計画書|報告書|明細書|予算書|様式|別紙)/.test(line) && line.length >= 5 && line.length <= 80);
    
    if (!isFormLine) continue;
    
    // 以降の行からフィールドを抽出
    const fields: string[] = [];
    const windowLines = lines.slice(i + 1, i + 20);
    
    for (const wl of windowLines) {
      // 次のフォームが始まったら終了
      if (/様式|別紙/.test(wl) && wl !== line) break;
      
      // 箇条書きパターン
      const bulletMatch = wl.match(/^(?:[・●◯○]|[0-9]{1,2}[.)]|[①-⑳])\s*(.+)$/);
      if (bulletMatch && bulletMatch[1].length >= 2 && bulletMatch[1].length <= 60) {
        fields.push(bulletMatch[1]);
      }
      
      // フィールドキーワードを含む短い行
      const fieldKeywords = ['事業者名', '代表者', '住所', '電話', '資本金', '従業員', '申請金額', '事業名', '目的'];
      if (wl.length >= 3 && wl.length <= 40 && fieldKeywords.some(kw => wl.includes(kw))) {
        if (!fields.includes(wl)) fields.push(wl);
      }
      
      if (fields.length >= 15) break;
    }
    
    if (fields.length >= 1) {
      forms.push({
        name: line.slice(0, 80),
        form_id: formId,
        fields: fields.slice(0, 20),
      });
    }
    
    if (forms.length >= 15) break;
  }
  
  return forms;
}

function checkWallChatReady(detail: any): boolean {
  const hasOverview = !!(detail.overview || detail.description);
  const hasRequirements = Array.isArray(detail.application_requirements) 
    ? detail.application_requirements.length > 0 
    : !!(detail.application_requirements);
  const hasExpenses = Array.isArray(detail.eligible_expenses)
    ? detail.eligible_expenses.length > 0
    : !!(detail.eligible_expenses);
  const hasDocuments = Array.isArray(detail.required_documents)
    ? detail.required_documents.length > 0
    : !!(detail.required_documents);
  const hasDeadline = !!(detail.acceptance_end_datetime || detail.deadline);
  
  return hasOverview && hasRequirements && hasExpenses && hasDocuments && hasDeadline;
}

function getWallChatMissing(detail: any): string[] {
  const missing: string[] = [];
  if (!(detail.overview || detail.description)) missing.push('overview');
  if (!(Array.isArray(detail.application_requirements) ? detail.application_requirements.length > 0 : detail.application_requirements)) missing.push('application_requirements');
  if (!(Array.isArray(detail.eligible_expenses) ? detail.eligible_expenses.length > 0 : detail.eligible_expenses)) missing.push('eligible_expenses');
  if (!(Array.isArray(detail.required_documents) ? detail.required_documents.length > 0 : detail.required_documents)) missing.push('required_documents');
  if (!(detail.acceptance_end_datetime || detail.deadline)) missing.push('deadline');
  return missing;
}

async function recordFailure(
  db: D1Database,
  subsidyId: string,
  sourceId: string,
  url: string,
  stage: string,
  reason: string,
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // ★ v3.7.1: error_type を feed_failures CHECK制約に準拠
  // 許容値: 'HTTP', 'timeout', 'parse', 'db', 'validation', 'unknown'
  const errorTypeMap: Record<string, string> = {
    'FETCH_FAILED': 'HTTP',
    'PARSE_FAILED': 'parse',
    'FORMS_NOT_FOUND': 'validation',
    'UPSERT_FAILED': 'db',
    'DB_ERROR': 'db',
    'TIMEOUT': 'timeout',
  };
  const errorType = errorTypeMap[reason] || 'unknown';
  
  const priority = reason === 'FETCH_FAILED' ? 1 : reason === 'PARSE_FAILED' ? 2 : reason === 'FORMS_NOT_FOUND' ? 3 : 4;
  
  try {
    await db.prepare(`
      INSERT INTO feed_failures (
        subsidy_id, source_id, url, stage, error_type, error_message,
        retry_count, occurred_at, last_retry_at,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'open')
      ON CONFLICT (subsidy_id, url, stage) DO UPDATE SET
        error_type = excluded.error_type,
        error_message = excluded.error_message,
        retry_count = retry_count + 1,
        last_retry_at = excluded.last_retry_at,
        status = 'open'
    `).bind(subsidyId, sourceId, url, stage, errorType, message.slice(0, 500), now, now).run();
  } catch (e) {
    console.warn('[recordFailure] Failed:', e);
  }
}

async function resolveFailure(db: D1Database, subsidyId: string, url: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.prepare(`
      UPDATE feed_failures SET status = 'resolved', resolved_at = ?
      WHERE subsidy_id = ? AND url = ? AND status = 'open'
    `).bind(now, subsidyId, url).run();
  } catch (e) {
    console.warn('[resolveFailure] Failed:', e);
  }
}

// =====================================================
// キュー基盤（17,000件運用向け shard/queue）
// =====================================================

type EnqueueJobType = 'extract_forms' | 'enrich_jgrants' | 'enrich_shigoto';

// job_type別に優先度（小さいほど先）
const JOB_PRIORITY: Record<EnqueueJobType, number> = {
  extract_forms: 50,     // 壁打ち成立の核
  enrich_shigoto: 60,    // HTML埋め
  enrich_jgrants: 70,    // 毎日少量で増やす
};

/**
 * POST /api/cron/enqueue-extractions
 * 
 * extraction_queue にジョブを投入
 * 1回で入れすぎない（MAX_ENQUEUE_PER_TYPE で制限）
 */
cron.post('/enqueue-extractions', async (c) => {
  const db = c.env.DB;

  const auth = verifyCronSecret(c);
  if (!auth.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: auth.error!,
    }, auth.error!.status);
  }

  // 1回で入れすぎない
  const MAX_ENQUEUE_PER_TYPE = 500;

  const now = new Date().toISOString();

  // 1) shard_key未付与の行に shard_key を付ける（増分でOK）
  const candidates = await db.prepare(`
    SELECT id FROM subsidy_cache
    WHERE shard_key IS NULL
    LIMIT 1000
  `).all<{ id: string }>();

  let shardUpdated = 0;
  for (const row of candidates.results || []) {
    const sk = shardKey16(row.id);
    await db.prepare(`UPDATE subsidy_cache SET shard_key = ? WHERE id = ?`)
      .bind(sk, row.id).run();
    shardUpdated++;
  }

  // 2) job_typeごとにキュー投入（INSERT OR IGNORE）

  // A) extract_forms: wall_chat_ready=0 かつ detailUrl/pdfUrlsあり
  const exForms = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
    SELECT 
      lower(hex(randomblob(16))),
      sc.id,
      sc.shard_key,
      'extract_forms',
      ?,
      'queued',
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
    ORDER BY sc.cached_at DESC
    LIMIT ?
  `).bind(JOB_PRIORITY.extract_forms, now, now, MAX_ENQUEUE_PER_TYPE).run();

  // B) enrich_shigoto: tokyo-shigoto で未READY & detailUrlあり
  const exShigoto = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
    SELECT 
      lower(hex(randomblob(16))),
      sc.id,
      sc.shard_key,
      'enrich_shigoto',
      ?,
      'queued',
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.source = 'tokyo-shigoto'
      AND sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND json_extract(sc.detail_json, '$.detailUrl') IS NOT NULL
    ORDER BY sc.cached_at DESC
    LIMIT ?
  `).bind(JOB_PRIORITY.enrich_shigoto, now, now, MAX_ENQUEUE_PER_TYPE).run();

  // C) enrich_jgrants: jgrants でdetail_jsonが薄い & 期限内
  const exJgrants = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
    SELECT 
      lower(hex(randomblob(16))),
      sc.id,
      sc.shard_key,
      'enrich_jgrants',
      ?,
      'queued',
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.source = 'jgrants'
      AND sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND (sc.detail_json IS NULL OR sc.detail_json = '{}' OR LENGTH(sc.detail_json) < 100)
      AND (sc.acceptance_end_datetime IS NULL OR sc.acceptance_end_datetime > datetime('now'))
    ORDER BY sc.acceptance_end_datetime ASC NULLS LAST
    LIMIT ?
  `).bind(JOB_PRIORITY.enrich_jgrants, now, now, MAX_ENQUEUE_PER_TYPE).run();

  return c.json<ApiResponse<{
    message: string;
    updated_shard_key_rows: number;
    enqueued: { extract_forms: number; enrich_shigoto: number; enrich_jgrants: number };
  }>>({
    success: true,
    data: {
      message: 'enqueue ok',
      updated_shard_key_rows: shardUpdated,
      enqueued: {
        extract_forms: exForms.meta?.changes || 0,
        enrich_shigoto: exShigoto.meta?.changes || 0,
        enrich_jgrants: exJgrants.meta?.changes || 0,
      },
    },
  });
});

type ConsumeJob = {
  id: string;
  subsidy_id: string;
  shard_key: number;
  job_type: EnqueueJobType;
  attempts: number;
  max_attempts: number;
};

// 1回の消化上限（止まらない設定）
const CONSUME_BATCH = 3;          // D1 subrequest上限対策：3件に絞る
const LEASE_MINUTES = 8;          // リース期限
const LEASE_OWNER = 'pages-cron'; // ざっくり識別

/**
 * POST /api/cron/consume-extractions
 * 
 * extraction_queue から shard 単位でジョブを取り出して処理
 * ?shard=N で指定可能（省略時は時刻から自動決定）
 */
cron.post('/consume-extractions', async (c) => {
  const db = c.env.DB;
  const env = c.env;

  const auth = verifyCronSecret(c);
  if (!auth.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: auth.error!,
    }, auth.error!.status);
  }

  // shard指定がなければ自動決定
  // ★ v3.5.2 fix: SHARD_COUNT=64 に合わせて範囲を 0-63 に修正
  const q = c.req.query();
  const shard = q.shard !== undefined 
    ? Math.max(0, Math.min(63, parseInt(q.shard, 10) || 0))
    : currentShardByHour();

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60 * 1000).toISOString();

  // 0) 期限切れleasedを回収（ISO形式で比較）
  const nowIso = now.toISOString();
  await db.prepare(`
    UPDATE extraction_queue
    SET status='queued', lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
    WHERE status='leased' AND lease_until IS NOT NULL AND lease_until < ?
  `).bind(nowIso).run();

  // 1) queuedからshard分だけ取る（優先度順）
  const queued = await db.prepare(`
    SELECT id, subsidy_id, shard_key, job_type, attempts, max_attempts
    FROM extraction_queue
    WHERE shard_key = ?
      AND status = 'queued'
    ORDER BY priority ASC, updated_at ASC
    LIMIT ?
  `).bind(shard, CONSUME_BATCH).all<ConsumeJob>();

  const jobs = queued.results || [];
  if (jobs.length === 0) {
    return c.json<ApiResponse<{ shard: number; processed: number; message: string }>>({
      success: true,
      data: { shard, processed: 0, message: 'no jobs' },
    });
  }

  // 2) リース獲得（原子的に leased へ）
  const leasedIds: string[] = [];
  for (const job of jobs) {
    const res = await db.prepare(`
      UPDATE extraction_queue
      SET status='leased', lease_owner=?, lease_until=?, updated_at=datetime('now')
      WHERE id=? AND status='queued'
    `).bind(LEASE_OWNER, leaseUntil, job.id).run();

    if ((res.meta?.changes || 0) === 1) leasedIds.push(job.id);
  }

  if (leasedIds.length === 0) {
    return c.json<ApiResponse<{ shard: number; processed: number; message: string }>>({
      success: true,
      data: { shard, processed: 0, message: 'lease race lost' },
    });
  }

  // 3) 実処理（job_typeごとに処理）
  let done = 0;
  let failed = 0;

  for (const queueId of leasedIds) {
    const job = jobs.find(j => j.id === queueId);
    if (!job) continue;

    try {
      // job_typeに応じた処理
      if (job.job_type === 'extract_forms') {
        // 既存の extractAndUpdateSubsidy を呼ぶ
        const subsidy = await db.prepare(`
          SELECT id, source, title, detail_json
          FROM subsidy_cache WHERE id = ?
        `).bind(job.subsidy_id).first<{
          id: string;
          source: string;
          title: string;
          detail_json: string | null;
        }>();

        if (subsidy) {
          let detail: any = {};
          try {
            detail = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          } catch { detail = {}; }

          const detailUrl = detail.detailUrl || null;
          const pdfUrls = detail.pdfUrls || detail.pdf_urls || [];

          if (detailUrl || (Array.isArray(pdfUrls) && pdfUrls.length > 0)) {
            // cooldown チェック
            const cooldown = await checkCooldown(db, subsidy.id, DEFAULT_COOLDOWN_POLICY);

            const extractSource: ExtractSource = {
              subsidyId: subsidy.id,
              source: subsidy.source,
              title: subsidy.title,
              detailUrl,
              pdfUrls: Array.isArray(pdfUrls) ? pdfUrls : [],
              existingDetailJson: subsidy.detail_json,
            };

            const extractResult = await extractAndUpdateSubsidy(extractSource, {
              FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY,
              GOOGLE_CLOUD_API_KEY: env.GOOGLE_CLOUD_API_KEY,
              allowFirecrawl: cooldown.allowFirecrawl,
              allowVision: cooldown.allowVision,
              DB: db, // P0: DB を必ず渡す（Freeze-COST-2）
              sourceId: subsidy.source,
            });

            // P0: CostGuard 発生時は feed_failures に落とす（Freeze-3）
            try {
              const m = extractResult.metrics;
              const anyUrl = detailUrl || (pdfUrls?.[0] as string) || '';
              
              if (m.firecrawlBlockedByCostGuard) {
                await recordCostGuardFailure(db, {
                  subsidy_id: subsidy.id,
                  source_id: subsidy.source,
                  url: anyUrl,
                  stage: 'pdf',
                  message: 'COST_GUARD_DB_MISSING: Firecrawl blocked because env.DB was missing (Freeze-COST-2)',
                });
              }
              if (m.visionBlockedByCostGuard) {
                await recordCostGuardFailure(db, {
                  subsidy_id: subsidy.id,
                  source_id: subsidy.source,
                  url: anyUrl,
                  stage: 'pdf',
                  message: 'COST_GUARD_DB_MISSING: Vision OCR blocked because env.DB was missing (Freeze-COST-2)',
                });
              }
            } catch (e) {
              console.warn('[cron/consume-extractions] failed to record CostGuard feed_failures:', e);
            }

            // 成功/電子申請検出時はDB更新
            if (extractResult.success || extractResult.isElectronicApplication) {
              await db.prepare(`
                UPDATE subsidy_cache 
                SET detail_json = ?, wall_chat_ready = ?, wall_chat_missing = ?
                WHERE id = ?
              `).bind(
                extractResult.newDetailJson,
                extractResult.wallChatReady ? 1 : 0,
                JSON.stringify(extractResult.wallChatMissing),
                subsidy.id
              ).run();
            }
          }
        }
      }
      // enrich_jgrants: JGrants API から詳細取得
      if (job.job_type === 'enrich_jgrants') {
        const subsidy = await db.prepare(`
          SELECT id, title, detail_json
          FROM subsidy_cache WHERE id = ? AND source = 'jgrants'
        `).bind(job.subsidy_id).first<{
          id: string;
          title: string;
          detail_json: string | null;
        }>();

        if (subsidy) {
          const JGRANTS_DETAIL_API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id';
          const response = await fetch(`${JGRANTS_DETAIL_API}/${subsidy.id}`, {
            headers: { 'Accept': 'application/json' },
          });

          if (response.ok) {
            const data = await response.json() as any;
            const subsidyData = data.result?.[0] || data.result || data;

            if (subsidyData && subsidyData.detail) {
              const detailJson: Record<string, any> = {};

              // 概要
              if (subsidyData.detail && subsidyData.detail.length > 20) {
                detailJson.overview = subsidyData.detail
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 2000);
              }

              // 申請要件（文字列でない場合は JSON.stringify で変換）
              const rawReq = subsidyData.target_detail || subsidyData.outline_of_grant;
              if (rawReq) {
                const reqStr = typeof rawReq === 'string' ? rawReq : JSON.stringify(rawReq);
                const reqText = reqStr
                  .replace(/<[^>]+>/g, '\n')
                  .replace(/&nbsp;/g, ' ')
                  .trim();
                detailJson.application_requirements = reqText.split('\n')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length >= 5 && s.length <= 300)
                  .slice(0, 20);
              }

              // 対象経費（文字列でない場合は JSON.stringify で変換）
              if (subsidyData.usage_detail) {
                const usageStr = typeof subsidyData.usage_detail === 'string' 
                  ? subsidyData.usage_detail 
                  : JSON.stringify(subsidyData.usage_detail);
                const expText = usageStr
                  .replace(/<[^>]+>/g, '\n')
                  .replace(/&nbsp;/g, ' ')
                  .trim();
                detailJson.eligible_expenses = expText.split('\n')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length >= 5)
                  .slice(0, 20);
              }

              // 必要書類・PDF URL
              if (subsidyData.application_form && Array.isArray(subsidyData.application_form)) {
                detailJson.required_documents = subsidyData.application_form
                  .map((f: any) => f.name || f.title || f)
                  .filter((s: any) => typeof s === 'string' && s.length >= 2)
                  .slice(0, 20);
                detailJson.pdf_urls = subsidyData.application_form
                  .filter((f: any) => f.url && f.url.endsWith('.pdf'))
                  .map((f: any) => f.url);
              }

              // 締切・補助金情報
              if (subsidyData.acceptance_end_datetime) {
                detailJson.acceptance_end_datetime = subsidyData.acceptance_end_datetime;
              }
              if (subsidyData.subsidy_max_limit) {
                detailJson.subsidy_max_limit = subsidyData.subsidy_max_limit;
              }
              if (subsidyData.subsidy_rate) {
                detailJson.subsidy_rate = subsidyData.subsidy_rate;
              }
              if (subsidyData.front_subsidy_detail_page_url) {
                detailJson.related_url = subsidyData.front_subsidy_detail_page_url;
              }

              // マージして保存
              const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
              const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
              `).bind(JSON.stringify(merged), subsidy.id).run();

              // WALL_CHAT_READY 判定
              const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
              const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
              if (readyResult.ready) {
                await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                  .bind(subsidy.id).run();
              }
            }
          }
        }
      }

      // extract_pdf: PDFからFirecrawl+OpenAIで構造化データ抽出
      // 参照URLがある場合はそこからPDFを収集することも試みる
      if (job.job_type === 'extract_pdf') {
        const subsidy = await db.prepare(`
          SELECT id, title, detail_json
          FROM subsidy_cache WHERE id = ?
        `).bind(job.subsidy_id).first<{
          id: string;
          title: string;
          detail_json: string | null;
        }>();

        if (subsidy) {
          let detail: any = {};
          try {
            detail = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          } catch { detail = {}; }

          let pdfUrls = detail.pdf_urls || [];
          
          // 参照URLからPDFを収集（pdf_urlsが空または少ない場合）
          if ((!Array.isArray(pdfUrls) || pdfUrls.length < 3) && Array.isArray(detail.reference_urls)) {
            const firecrawlKey = env.FIRECRAWL_API_KEY;
            
            for (const refUrl of detail.reference_urls.slice(0, 2)) { // 最大2つの参照URLを処理
              try {
                console.log(`[extract_pdf] Scraping reference URL: ${refUrl}`);
                
                // HTMLを取得（Firecrawlまたは直接fetch）
                let pageHtml = '';
                
                if (firecrawlKey) {
                  const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${firecrawlKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: refUrl, formats: ['html'] }),
                  });
                  
                  if (fcResponse.ok) {
                    const fcData = await fcResponse.json() as any;
                    pageHtml = fcData.data?.html || '';
                  }
                } else {
                  // Firecrawlがない場合は直接fetch
                  const response = await fetch(refUrl, {
                    headers: {
                      'Accept': 'text/html',
                      'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
                    },
                  });
                  if (response.ok) {
                    pageHtml = await response.text();
                  }
                }
                
                // HTMLからPDFリンクを抽出
                if (pageHtml) {
                  const pdfPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
                  let match;
                  const baseUrl = new URL(refUrl);
                  
                  while ((match = pdfPattern.exec(pageHtml)) !== null) {
                    let pdfLink = match[1];
                    // 相対URLを絶対URLに変換
                    if (pdfLink.startsWith('./')) {
                      pdfLink = `${baseUrl.origin}${baseUrl.pathname.replace(/\/[^/]*$/, '')}/${pdfLink.substring(2)}`;
                    } else if (pdfLink.startsWith('/')) {
                      pdfLink = `${baseUrl.origin}${pdfLink}`;
                    } else if (!pdfLink.startsWith('http')) {
                      pdfLink = `${baseUrl.origin}${baseUrl.pathname.replace(/\/[^/]*$/, '')}/${pdfLink}`;
                    }
                    
                    if (!pdfUrls.includes(pdfLink)) {
                      pdfUrls.push(pdfLink);
                      console.log(`[extract_pdf] Found PDF: ${pdfLink}`);
                    }
                  }
                }
              } catch (e) {
                console.warn(`[extract_pdf] Failed to scrape reference URL ${refUrl}:`, e);
              }
            }
            
            // 新しいPDFが見つかったらdetail_jsonを更新
            if (pdfUrls.length > (detail.pdf_urls?.length || 0)) {
              detail.pdf_urls = [...new Set(pdfUrls)];
              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                WHERE id = ?
              `).bind(JSON.stringify(detail), subsidy.id).run();
              console.log(`[extract_pdf] Updated pdf_urls for ${subsidy.id}: ${pdfUrls.length} PDFs`);
            }
          }
          
          if (Array.isArray(pdfUrls) && pdfUrls.length > 0) {
            const firecrawlKey = env.FIRECRAWL_API_KEY;
            const openaiKey = env.OPENAI_API_KEY;
            
            // 最初のPDFをスクレイピング
            const pdfUrl = pdfUrls[0];
            let pdfText = '';
            
            if (firecrawlKey) {
              try {
                const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${firecrawlKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ url: pdfUrl, formats: ['markdown'] }),
                });
                
                if (fcResponse.ok) {
                  const fcData = await fcResponse.json() as any;
                  pdfText = fcData.data?.markdown || '';
                }
              } catch (e) {
                console.warn(`[extract_pdf] Firecrawl failed for ${pdfUrl}:`, e);
              }
            }
            
            // OpenAI で構造化データ抽出
            if (pdfText && pdfText.length > 100 && openaiKey) {
              try {
                const { extractSubsidyDataFromPdf, mergeExtractedData } = await import('../services/openai-extractor');
                const extracted = await extractSubsidyDataFromPdf(pdfText, openaiKey);
                
                if (extracted) {
                  // 既存データとマージ (mergeExtractedData を使用)
                  const merged = mergeExtractedData(detail, extracted);
                  merged.extracted_pdf_text = pdfText.substring(0, 5000);
                  merged.extracted_at = new Date().toISOString();
                  
                  await db.prepare(`
                    UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                    WHERE id = ?
                  `).bind(JSON.stringify(merged), subsidy.id).run();
                  
                  // WALL_CHAT_READY 判定
                  const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
                  const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
                  if (readyResult.ready) {
                    await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                      .bind(subsidy.id).run();
                  }
                }
              } catch (e) {
                console.warn(`[extract_pdf] OpenAI extraction failed for ${subsidy.id}:`, e);
                // OpenAIが失敗してもFirecrawlの結果は保存
                if (pdfText.length > 100) {
                  const merged = {
                    ...detail,
                    extracted_pdf_text: pdfText.substring(0, 5000),
                    extracted_at: new Date().toISOString(),
                  };
                  await db.prepare(`
                    UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                    WHERE id = ?
                  `).bind(JSON.stringify(merged), subsidy.id).run();
                }
              }
            } else if (pdfText && pdfText.length > 100) {
              // OpenAI キーがない場合は生テキストだけ保存
              const merged = {
                ...detail,
                extracted_pdf_text: pdfText.substring(0, 5000),
                extracted_at: new Date().toISOString(),
              };
              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                WHERE id = ?
              `).bind(JSON.stringify(merged), subsidy.id).run();
            }
          }
        }
      }

      // enrich_shigoto: tokyo-shigoto の HTML から詳細取得
      if (job.job_type === 'enrich_shigoto') {
        const subsidy = await db.prepare(`
          SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
          FROM subsidy_cache WHERE id = ? AND source = 'tokyo-shigoto'
        `).bind(job.subsidy_id).first<{
          id: string;
          title: string;
          detail_json: string | null;
          detail_url: string | null;
        }>();

        if (subsidy && subsidy.detail_url) {
          const response = await fetch(subsidy.detail_url, {
            headers: {
              'Accept': 'text/html',
              'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
            },
          });

          if (response.ok) {
            const html = await response.text();
            const detailJson: Record<string, any> = {};

            // 表から概要抽出
            const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
            if (tableMatch) {
              const tableText = tableMatch[1]
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (tableText.length > 50) {
                detailJson.overview = tableText.substring(0, 1500);
              }
            }

            // 年度末をデフォルト締切
            const now = new Date();
            const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            detailJson.acceptance_end_datetime = `${fiscalYear + 1}-03-31T23:59:59Z`;
            detailJson.required_documents = ['募集要項', '申請書', '事業計画書'];

            // マージして保存
            const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
            const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

            await db.prepare(`
              UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
            `).bind(JSON.stringify(merged), subsidy.id).run();

            // WALL_CHAT_READY 判定
            const { checkWallChatReadyFromJson } = await import('../lib/wall-chat-ready');
            const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
            if (readyResult.ready) {
              await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                .bind(subsidy.id).run();
            }
          }
        }
      }

      // ジョブ完了
      await db.prepare(`
        UPDATE extraction_queue
        SET status='done', lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
        WHERE id=?
      `).bind(queueId).run();

      done++;
    } catch (e: any) {
      const attempts = (job.attempts || 0) + 1;
      const nextStatus = attempts >= (job.max_attempts || 5) ? 'failed' : 'queued';

      await db.prepare(`
        UPDATE extraction_queue
        SET status=?, attempts=?, last_error=?, lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
        WHERE id=?
      `).bind(nextStatus, attempts, String(e?.message || e).slice(0, 500), queueId).run();

      failed++;
    }
  }

  return c.json<ApiResponse<{
    shard: number;
    leased: number;
    done: number;
    failed: number;
  }>>({
    success: true,
    data: {
      shard,
      leased: leasedIds.length,
      done,
      failed,
    },
  });
});

// =====================================================
// [REMOVED v4.1.0] J-Net21 制度収集エンドポイント
// 
// sync-jnet21 / sync-jnet21-catalog / promote-jnet21 は削除
// 
// 理由: J-Net21は「制度データ」ではなく「ニュース」
// - discovery_items / subsidy_cache に入れない
// - 壁打ち（申請書生成）のナレッジに使わない
// - 士業ダッシュボードの「ニュース枠」専用
//
// 詳細: docs/FROZEN_RULES_INDEX.md「ニュースソース凍結」参照
// =====================================================

/**
 * extraction_queue のdoneローテーション（DB肥大対策）
 * 
 * POST /api/cron/cleanup-queue
 * 
 * v3.5.2: DB肥大で止まるのを防ぐ
 * - done は7日で削除
 * - failed は残す（調査用）
 * - 監査は cron_runs / extraction_logs / feed_failures に残るのでOK
 * 
 * 推奨Cronスケジュール: 毎日 04:00 UTC (日本時間13:00)
 */
cron.post('/cleanup-queue', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'cleanup-queue', 'cron');
  } catch (logErr) {
    console.warn('[Cleanup-Queue] Failed to start cron_run log:', logErr);
  }
  
  try {
    console.log('[Cleanup-Queue] Starting cleanup...');
    
    // 7日より古いdoneを削除
    const RETENTION_DAYS = 7;
    
    // 削除前にカウント（参考情報）
    const beforeCount = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'leased' THEN 1 ELSE 0 END) as leased
      FROM extraction_queue
    `).first<{
      total: number;
      done: number;
      failed: number;
      queued: number;
      leased: number;
    }>();
    
    // 削除対象をカウント
    const toDelete = await db.prepare(`
      SELECT COUNT(*) as cnt FROM extraction_queue
      WHERE status = 'done'
        AND updated_at < datetime('now', '-${RETENTION_DAYS} days')
    `).first<{ cnt: number }>();
    
    // 削除実行
    const result = await db.prepare(`
      DELETE FROM extraction_queue
      WHERE status = 'done'
        AND updated_at < datetime('now', '-${RETENTION_DAYS} days')
    `).run();
    
    const deletedCount = result.meta?.changes || 0;
    
    // 削除後にカウント
    const afterCount = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'leased' THEN 1 ELSE 0 END) as leased
      FROM extraction_queue
    `).first<{
      total: number;
      done: number;
      failed: number;
      queued: number;
      leased: number;
    }>();
    
    console.log(`[Cleanup-Queue] Deleted ${deletedCount} done records (older than ${RETENTION_DAYS} days)`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, 'success', {
          items_processed: toDelete?.cnt || 0,
          items_inserted: deletedCount,
          metadata: {
            retention_days: RETENTION_DAYS,
            before: beforeCount,
            after: afterCount,
          },
        });
      } catch (logErr) {
        console.warn('[Cleanup-Queue] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      deleted_count: number;
      retention_days: number;
      before: typeof beforeCount;
      after: typeof afterCount;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Cleanup completed: ${deletedCount} done records deleted`,
        deleted_count: deletedCount,
        retention_days: RETENTION_DAYS,
        before: beforeCount!,
        after: afterCount!,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Cleanup-Queue] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Cleanup-Queue] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * J-Net21 Discovery Items 昇格 (discovery_items → subsidy_cache)
 * 
 * POST /api/cron/promote-jnet21
 * 
 * v3.6.0: Freeze-4準拠 - discovery_items から subsidy_cache への昇格
 * - discovery_items (stage='raw') → validated → promoted
 * - quality_score 計算（タイトル/説明/都道府県の充実度）
 * - subsidy_cache へ UPSERT
 * - discovery_promote_log に履歴記録
 * 
 * 推奨Cronスケジュール: 毎日 06:00 UTC (日本時間15:00)
 * ※ sync-jnet21 の1時間後に実行
 */
cron.post('/promote-jnet21', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'promote-jnet21', 'cron');
  } catch (logErr) {
    console.warn('[Promote-J-Net21] Failed to start cron_run log:', logErr);
  }
  
  const SOURCE_KEY = 'src-jnet21';
  const errors: string[] = [];
  let itemsValidated = 0;
  let itemsPromoted = 0;
  let itemsSkipped = 0;
  let totalProcessed = 0;
  
  try {
    console.log('[Promote-J-Net21] Starting promotion process...');
    
    // Step 1: raw → validated (品質スコア計算)
    // 品質スコア計算ルール:
    // - タイトル長 > 10: +30点
    // - 説明あり: +30点
    // - 都道府県コードあり: +20点
    // - URLあり: +20点
    // 合計 50点以上で validated
    // v4.0.0: LIMIT拡大 (500 → 2000)
    // 一覧クロールで大量にrawが入るため、処理能力を拡大
    const rawItems = await db.prepare(`
      SELECT id, title, summary, url, prefecture_code, raw_json
      FROM discovery_items
      WHERE source_id = ? AND stage = 'raw'
      ORDER BY first_seen_at DESC
      LIMIT 2000
    `).bind(SOURCE_KEY).all<{
      id: string;
      title: string;
      summary: string | null;
      url: string;
      prefecture_code: string | null;
      raw_json: string | null;
    }>();
    
    totalProcessed = rawItems.results?.length || 0;
    console.log(`[Promote-J-Net21] Found ${totalProcessed} raw items to process`);
    
    for (const item of rawItems.results || []) {
      try {
        // 品質スコア計算
        let qualityScore = 0;
        if (item.title && item.title.length > 10) qualityScore += 30;
        if (item.summary && item.summary.length > 0) qualityScore += 30;
        if (item.prefecture_code) qualityScore += 20;
        if (item.url) qualityScore += 20;
        
        const now = new Date().toISOString();
        
        if (qualityScore >= 50) {
          // validated に昇格
          await db.prepare(`
            UPDATE discovery_items
            SET stage = 'validated', quality_score = ?, validation_notes = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            qualityScore,
            `Auto-validated: score=${qualityScore}`,
            now,
            item.id
          ).run();
          itemsValidated++;
        } else {
          // スコア不足 → rejected
          await db.prepare(`
            UPDATE discovery_items
            SET stage = 'rejected', quality_score = ?, validation_notes = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            qualityScore,
            `Rejected: score=${qualityScore} (min=50)`,
            now,
            item.id
          ).run();
          itemsSkipped++;
        }
      } catch (validErr) {
        const errMsg = validErr instanceof Error ? validErr.message : String(validErr);
        errors.push(`Validation error (${item.id}): ${errMsg}`);
        console.warn(`[Promote-J-Net21] Validation error:`, validErr);
      }
    }
    
    console.log(`[Promote-J-Net21] Validation: validated=${itemsValidated}, rejected=${itemsSkipped}`);
    
    // Step 2: validated → promoted (subsidy_cache へ UPSERT)
    // v4.0.0: LIMIT拡大 (100 → 500)
    // 検索に出す件数を早く増やすため
    const validatedItems = await db.prepare(`
      SELECT id, dedupe_key, title, summary, url, prefecture_code, content_hash, quality_score, raw_json
      FROM discovery_items
      WHERE source_id = ? AND stage = 'validated'
      ORDER BY quality_score DESC, first_seen_at DESC
      LIMIT 500
    `).bind(SOURCE_KEY).all<{
      id: string;
      dedupe_key: string;
      title: string;
      summary: string | null;
      url: string;
      prefecture_code: string | null;
      content_hash: string | null;
      quality_score: number;
      raw_json: string | null;
    }>();
    
    console.log(`[Promote-J-Net21] Found ${validatedItems.results?.length || 0} validated items to promote`);
    
    for (const item of validatedItems.results || []) {
      try {
        const now = new Date().toISOString();
        const subsidyId = item.id; // discovery_items.id をそのまま使用
        const shardKey = shardKey16(subsidyId);
        
        // detail_json に追加情報を埋め込む（本番 subsidy_cache にないカラムの代替）
        // 本番スキーマ: id, source, title, detail_json, cached_at, expires_at, shard_key, wall_chat_ready 等のみ
        // description, detail_url, prefecture_code, content_hash, discovery_item_id は detail_json 内に格納
        let rawData: Record<string, any> = {};
        try {
          rawData = item.raw_json ? JSON.parse(item.raw_json) : {};
        } catch {
          rawData = {};
        }
        
        const detailJson = JSON.stringify({
          ...rawData,
          // 検索/表示に必要な追加フィールド
          detailUrl: item.url,
          description: item.summary || '',
          prefecture_code: item.prefecture_code,
          content_hash: item.content_hash,
          discovery_item_id: item.id,
          quality_score: item.quality_score,
          source: 'jnet21',
          promoted_at: now,
        });
        
        // ★ 本番 subsidy_cache スキーマに100%一致する INSERT
        // 存在するカラムのみ: id, source, title, detail_json, cached_at, expires_at, shard_key
        await db.prepare(`
          INSERT INTO subsidy_cache (
            id, source, title, detail_json, cached_at, expires_at, shard_key
          ) VALUES (?, 'jnet21', ?, ?, datetime('now'), datetime('now', '+7 days'), ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            detail_json = excluded.detail_json,
            cached_at = datetime('now'),
            expires_at = datetime('now', '+7 days')
        `).bind(
          subsidyId,
          item.title,
          detailJson,
          shardKey
        ).run();
        
        // discovery_items を promoted に更新
        await db.prepare(`
          UPDATE discovery_items
          SET stage = 'promoted', promoted_at = ?, promoted_to_id = ?, updated_at = ?
          WHERE id = ?
        `).bind(now, subsidyId, now, item.id).run();
        
        // discovery_promote_log に記録
        const logId = generateUUID();
        await db.prepare(`
          INSERT INTO discovery_promote_log (id, discovery_item_id, subsidy_cache_id, source_id, action, quality_score, notes, created_at)
          VALUES (?, ?, ?, ?, 'promote', ?, ?, ?)
        `).bind(
          logId,
          item.id,
          subsidyId,
          SOURCE_KEY,
          item.quality_score,
          `Promoted from discovery_items`,
          now
        ).run();
        
        itemsPromoted++;
      } catch (promoteErr) {
        const errMsg = promoteErr instanceof Error ? promoteErr.message : String(promoteErr);
        errors.push(`Promote error (${item.id}): ${errMsg}`);
        console.warn(`[Promote-J-Net21] Promote error:`, promoteErr);
      }
    }
    
    console.log(`[Promote-J-Net21] Completed: validated=${itemsValidated}, promoted=${itemsPromoted}, skipped=${itemsSkipped}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: totalProcessed,
          items_inserted: itemsPromoted,
          items_updated: itemsValidated,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors.slice(0, 10),
          metadata: {
            source_key: SOURCE_KEY,
            validated: itemsValidated,
            promoted: itemsPromoted,
            rejected: itemsSkipped,
          },
        });
      } catch (logErr) {
        console.warn('[Promote-J-Net21] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      total_processed: number;
      validated: number;
      promoted: number;
      rejected: number;
      errors: number;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'J-Net21 promotion completed',
        total_processed: totalProcessed,
        validated: itemsValidated,
        promoted: itemsPromoted,
        rejected: itemsSkipped,
        errors: errors.length,
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Promote-J-Net21] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          items_processed: totalProcessed,
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Promote-J-Net21] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'PROMOTE_JNET21_ERROR',
        message: `J-Net21 promotion failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * J-Net21 一覧ページクロール (全件取得拡張)
 * 
 * POST /api/cron/sync-jnet21-catalog
 * 
 * v4.0.0: 一覧ページから全記事URLを取得し discovery_items へ投入
 * - Firecrawl で一覧ページをクロール（コスト: 1 credit/page）
 * - 記事URL抽出（/snavi/articles/{id}）
 * - discovery_items (stage=raw) へ UPSERT
 * - RSS (sync-jnet21) の補完/代替
 * 
 * 推奨Cronスケジュール: 毎日 05:00 UTC (日本時間14:00)
 * ※ sync-jnet21 (RSS) よりも先に実行推奨
 */
cron.post('/sync-jnet21-catalog', async (c) => {
  const db = c.env.DB;
  const FIRECRAWL_API_KEY = c.env.FIRECRAWL_API_KEY;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // Firecrawl APIキーチェック
  if (!FIRECRAWL_API_KEY) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'FIRECRAWL_API_KEY not configured',
      },
    }, 500);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'sync-jnet21-catalog', 'cron');
  } catch (logErr) {
    console.warn('[J-Net21-Catalog] Failed to start cron_run log:', logErr);
  }
  
  const SOURCE_KEY = 'src-jnet21-catalog';
  const errors: string[] = [];
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  let totalArticles = 0;
  let pagesCrawled = 0;
  let firecrawlCost = 0;
  
  // パラメータ（将来的にクエリパラメータで上書き可能）
  const MAX_PAGES = 100;      // 最大クロールページ数
  const PER_PAGE = 50;        // 1ページあたりの記事数
  const START_PAGE = 1;       // 開始ページ
  
  try {
    console.log('[J-Net21-Catalog] Starting catalog crawl...');
    
    // Firecrawl wrapper をインポート
    const { firecrawlScrape, FirecrawlScrapeResult } = await import('../lib/cost/firecrawl');
    
    // ページネーションループ
    let hasNextPage = true;
    let currentPage = START_PAGE;
    
    while (hasNextPage && currentPage <= MAX_PAGES) {
      // J-Net21 一覧URL（補助金・助成金・融資カテゴリ）
      // category[]=2 は「補助金・助成金・融資」
      const listUrl = `https://j-net21.smrj.go.jp/snavi/articles?category%5B%5D=2&page=${currentPage}&num=${PER_PAGE}`;
      
      console.log(`[J-Net21-Catalog] Fetching page ${currentPage}: ${listUrl}`);
      
      // Freeze-COST-2: Firecrawl wrapper 経由
      const result = await firecrawlScrape(listUrl, {
        db,
        apiKey: FIRECRAWL_API_KEY,
        sourceId: SOURCE_KEY,
      });
      
      pagesCrawled++;
      firecrawlCost += result.costUsd;
      
      if (!result.success) {
        console.warn(`[J-Net21-Catalog] Page ${currentPage} failed: ${result.error}`);
        errors.push(`Page ${currentPage}: ${result.error}`);
        
        // ★ 失敗を feed_failures に記録
        try {
          await recordFailure(
            db,
            `jnet21-catalog-page-${currentPage}`,
            SOURCE_KEY,
            listUrl,
            'discover',
            'FIRECRAWL_FAILED',
            result.error || 'Unknown error'
          );
        } catch (recordErr) {
          console.warn('[J-Net21-Catalog] Failed to record failure:', recordErr);
        }
        
        // 3回連続失敗で中断
        if (errors.length >= 3) {
          console.error('[J-Net21-Catalog] Too many errors, stopping crawl');
          break;
        }
        
        currentPage++;
        continue;
      }
      
      // 記事URL抽出（/snavi/articles/{数字}）
      const articleUrls = extractJNet21ArticleUrls(result.text);
      
      console.log(`[J-Net21-Catalog] Page ${currentPage}: found ${articleUrls.length} articles`);
      
      if (articleUrls.length === 0) {
        // 記事がない = 最終ページに到達
        hasNextPage = false;
        console.log(`[J-Net21-Catalog] No more articles, stopping at page ${currentPage}`);
        break;
      }
      
      totalArticles += articleUrls.length;
      
      // discovery_items へ UPSERT
      for (const articleUrl of articleUrls) {
        try {
          const urlHash = await calculateContentHash(articleUrl);
          const dedupeKey = `src-jnet21:${urlHash.slice(0, 8)}`;
          const itemId = `jnet21-${urlHash.slice(0, 8)}`;
          const now = new Date().toISOString();
          
          // タイトルは後で詳細ページから取得するため、URLから簡易生成
          const articleId = articleUrl.match(/\/articles\/(\d+)/)?.[1] || '';
          const tempTitle = `J-Net21 記事 #${articleId}`;
          
          // 既存レコードチェック
          const existing = await db.prepare(`
            SELECT id, content_hash, stage FROM discovery_items WHERE dedupe_key = ?
          `).bind(dedupeKey).first<{ id: string; content_hash: string; stage: string }>();
          
          if (existing) {
            // 既存 → last_seen_at 更新のみ
            await db.prepare(`
              UPDATE discovery_items SET last_seen_at = ?, updated_at = ? WHERE id = ?
            `).bind(now, now, existing.id).run();
            itemsSkipped++;
          } else {
            // 新規 → stage='raw' で投入
            await db.prepare(`
              INSERT INTO discovery_items (
                id, dedupe_key, source_id, source_type, title, summary, url,
                prefecture_code, stage, quality_score, content_hash, raw_json,
                first_seen_at, last_seen_at, created_at, updated_at
              ) VALUES (?, ?, ?, 'catalog', ?, '', ?, NULL, 'raw', 0, ?, ?, ?, ?, ?, ?)
            `).bind(
              itemId,
              dedupeKey,
              SOURCE_KEY,
              tempTitle,
              articleUrl,
              urlHash,
              JSON.stringify({
                catalog_page: currentPage,
                article_id: articleId,
                discovered_at: now,
              }),
              now,
              now,
              now,
              now
            ).run();
            itemsNew++;
          }
        } catch (itemErr) {
          const errMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
          errors.push(`Article ${articleUrl}: ${errMsg}`);
          console.warn(`[J-Net21-Catalog] Item error:`, itemErr);
        }
      }
      
      // 次ページ判定（記事数がPER_PAGE未満なら最終ページ）
      if (articleUrls.length < PER_PAGE) {
        hasNextPage = false;
        console.log(`[J-Net21-Catalog] Reached last page (${articleUrls.length} < ${PER_PAGE})`);
      } else {
        currentPage++;
        
        // レート制限: 500ms待機
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[J-Net21-Catalog] Completed: pages=${pagesCrawled}, articles=${totalArticles}, new=${itemsNew}, updated=${itemsUpdated}, skipped=${itemsSkipped}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: totalArticles,
          items_inserted: itemsNew,
          items_updated: itemsUpdated,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors.slice(0, 10),
          metadata: {
            source_key: SOURCE_KEY,
            pages_crawled: pagesCrawled,
            firecrawl_cost_usd: firecrawlCost,
          },
        });
      } catch (logErr) {
        console.warn('[J-Net21-Catalog] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      pages_crawled: number;
      articles_found: number;
      new_items: number;
      updated_items: number;
      skipped_items: number;
      firecrawl_cost_usd: number;
      errors: number;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'J-Net21 catalog sync completed',
        pages_crawled: pagesCrawled,
        articles_found: totalArticles,
        new_items: itemsNew,
        updated_items: itemsUpdated,
        skipped_items: itemsSkipped,
        firecrawl_cost_usd: firecrawlCost,
        errors: errors.length,
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[J-Net21-Catalog] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          items_processed: totalArticles,
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
          metadata: {
            pages_crawled: pagesCrawled,
            firecrawl_cost_usd: firecrawlCost,
          },
        });
      } catch (logErr) {
        console.warn('[J-Net21-Catalog] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'JNET21_CATALOG_ERROR',
        message: `J-Net21 catalog sync failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * J-Net21 記事URLを抽出
 * 
 * パターン: /snavi/articles/{数字}
 * 絶対URLに変換して返却
 */
function extractJNet21ArticleUrls(markdown: string): string[] {
  const BASE_URL = 'https://j-net21.smrj.go.jp';
  const urls = new Set<string>();
  
  // パターン1: 相対URL (/snavi/articles/123456)
  const relativePattern = /\/snavi\/articles\/(\d+)/g;
  let match;
  while ((match = relativePattern.exec(markdown)) !== null) {
    urls.add(`${BASE_URL}/snavi/articles/${match[1]}`);
  }
  
  // パターン2: 絶対URL (https://j-net21.smrj.go.jp/snavi/articles/123456)
  const absolutePattern = /https?:\/\/j-net21\.smrj\.go\.jp\/snavi\/articles\/(\d+)/g;
  while ((match = absolutePattern.exec(markdown)) !== null) {
    urls.add(`${BASE_URL}/snavi/articles/${match[1]}`);
  }
  
  return Array.from(urls);
}

export default cron;

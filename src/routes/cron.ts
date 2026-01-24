/**
 * Cron用API（外部Cronサービスから呼び出し）
 * 
 * POST /api/cron/sync-jgrants - JGrantsデータ同期
 * POST /api/cron/scrape-tokyo-kosha - 東京都中小企業振興公社スクレイピング
 * POST /api/cron/scrape-tokyo-shigoto - 東京しごと財団スクレイピング
 * 
 * 認証: X-Cron-Secret ヘッダーで CRON_SECRET と照合
 * 
 * P2-0 安全ゲート仕様:
 * - CRON_SECRET 必須（未設定/不一致は403）
 * - 冪等性保証（dedupe_key + ON CONFLICT）
 * - 監査ログ（cron_runs テーブルに実行履歴を記録）
 * - エラー時のトランザクション安全性
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../services/firecrawl';

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
 * - object要素 → JSON.stringify
 * - null/undefined → []
 */
function ensureStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item: any) => {
    if (typeof item === 'string') return item;
    if (item === null || item === undefined) return '';
    // objectや配列は文字列化（[object Object]防止）
    try {
      return typeof item === 'object' ? JSON.stringify(item) : String(item);
    } catch {
      return '[変換エラー]';
    }
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

export default cron;

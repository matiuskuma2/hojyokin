/**
 * Cron用API（外部Cronサービスから呼び出し）
 * 
 * POST /api/cron/sync-jgrants - JGrantsデータ同期
 * 
 * 認証: X-Cron-Secret ヘッダーで CRON_SECRET と照合
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../services/firecrawl';

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
 * 東京都中小企業振興公社 助成金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-kosha
 * 
 * Phase1: 東京都の補助金データ収集パイロット
 */
cron.post('/scrape-tokyo-kosha', async (c) => {
  const db = c.env.DB;
  
  // シークレット認証
  const cronSecret = c.req.header('X-Cron-Secret');
  const expectedSecret = (c.env as any).CRON_SECRET;
  
  if (expectedSecret && cronSecret !== expectedSecret) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' },
    }, 401);
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
    
    return c.json<ApiResponse<{
      message: string;
      links_found: number;
      details_fetched: number;
      inserted: number;
      results: any[];
      errors: string[];
      timestamp: string;
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
      },
    });
    
  } catch (error) {
    console.error('[Tokyo-Kosha] Scrape error:', error);
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

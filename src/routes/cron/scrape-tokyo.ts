/**
 * Cron: 東京都スクレイピング
 * 
 * POST /scrape-tokyo-kosha    - 東京都中小企業振興公社
 * POST /scrape-tokyo-shigoto  - 東京しごと財団
 * POST /scrape-tokyo-hataraku - TOKYOはたらくネット
 * POST /scrape-tokyo-all      - 全東京ソース一括
 * POST /enrich-tokyo-shigoto  - 東京しごと財団エンリッチ
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../../services/firecrawl';
import { shardKey16, currentShardByHour } from '../../lib/shard';
import { checkExclusion, checkWallChatReadyFromJson, selectBestPdfs, scorePdfUrl, type ExclusionReasonCode } from '../../lib/wall-chat-ready';
import { logFirecrawlCost, logOpenAICost } from '../../lib/cost/cost-logger';

const scrapeTokyo = new Hono<{ Bindings: Env; Variables: Variables }>();

scrapeTokyo.post('/scrape-tokyo-kosha', async (c) => {
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

scrapeTokyo.post('/scrape-tokyo-shigoto', async (c) => {
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

scrapeTokyo.post('/scrape-tokyo-hataraku', async (c) => {
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
scrapeTokyo.post('/scrape-tokyo-all', async (c) => {
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

scrapeTokyo.post('/enrich-tokyo-shigoto', async (c) => {
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
        
        // ページ全体のテキスト抽出
        const bodyText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 5000);

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
        // フォールバック: tableがない場合はbodyTextから概要取得
        if (!detailJson.overview && bodyText.length > 100) {
          detailJson.overview = bodyText.substring(0, 1500);
        }

        // application_requirements 抽出
        const reqPatterns = [
          /(?:対象者|対象事業者|助成対象|申請資格|応募資格|交付対象)[：:\s]*([^\n]{20,500})/,
          /(?:中小企業|都内).{5,200}(?:事業者|企業|団体|法人)/,
        ];
        for (const pat of reqPatterns) {
          if (!detailJson.application_requirements) {
            const m = bodyText.match(pat);
            if (m) {
              detailJson.application_requirements = [(m[1] || m[0]).trim().substring(0, 500)];
            }
          }
        }

        // eligible_expenses 抽出
        const expPatterns = [
          /(?:対象経費|助成対象経費|補助対象|助成内容|支援内容|助成事業)[：:\s]*([^\n]{20,500})/,
          /(?:助成金額|助成率|補助率|助成限度額)[：:\s]*([^\n]{10,300})/,
        ];
        for (const pat of expPatterns) {
          if (!detailJson.eligible_expenses) {
            const m = bodyText.match(pat);
            if (m) {
              detailJson.eligible_expenses = [(m[1] || m[0]).trim().substring(0, 500)];
            }
          }
        }

        // 年度末をデフォルト締切として設定
        const now = new Date();
        const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        detailJson.acceptance_end_datetime = `${fiscalYear + 1}-03-31T23:59:59Z`;
        
        // デフォルトの必要書類
        if (!existing.required_documents || existing.required_documents.length === 0) {
          detailJson.required_documents = ['募集要項', '申請書', '事業計画書'];
        }
        
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
        const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
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
// P3-4: JGrants詳細ページスクレイピング（pdf_urls補完）
// POST /api/cron/scrape-jgrants-detail
// 
// 対象: pdf_urls が空でfront_subsidy_detail_page_urlがある制度
// 目的: 詳細ページからPDFリンクを抽出してextraction_queueに登録
// =====================================================

export default scrapeTokyo;

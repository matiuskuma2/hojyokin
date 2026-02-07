/**
 * Cron: キュー管理 + J-Net21 (ニュース用のみ)
 * 
 * POST /cleanup-queue       - done 7日ローテーション
 * POST /promote-jnet21      - J-Net21 ニュース昇格
 * POST /sync-jnet21-catalog - J-Net21 カタログ同期
 * 
 * NOTE: J-Net21は制度収集から撤去（2026-01-26）。士業ニュース専用に降格。
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';

const jnet21 = new Hono<{ Bindings: Env; Variables: Variables }>();

jnet21.post('/cleanup-queue', async (c) => {
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
jnet21.post('/promote-jnet21', async (c) => {
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
jnet21.post('/sync-jnet21-catalog', async (c) => {
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
    const { firecrawlScrape, FirecrawlScrapeResult } = await import('../../lib/cost/firecrawl');
    
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

// =====================================================
// POST /api/cron/apply-field-fallbacks
// 
// Ready率向上のためのフォールバック補完戦略
// - application_requirements がない場合: JGrants APIフィールドから生成
// - eligible_expenses がない場合: 補助金カテゴリに基づくデフォルト値
// 
// これにより、PDF抽出に依存せずReady条件を満たせる
// =====================================================


export default jnet21;

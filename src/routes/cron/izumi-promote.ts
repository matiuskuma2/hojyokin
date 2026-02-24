/**
 * Cron: izumi → subsidy_cache 投入（プロモーション）
 * 
 * POST /promote-izumi-to-cache    - izumiデータをsubsidy_cacheに投入
 * POST /crawl-izumi-details       - izumiのsupport_urlをクロールしてdetail充実
 * GET  /izumi-promote-status      - 投入状況確認
 * 
 * 戦略:
 * A案（即効）: izumiの基本情報をsubsidy_cacheにINSERT（検索表示用）
 * B案（並行）: support_urlクロール → detail_json充実 → wall_chat_ready化
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret } from './_helpers';
import { checkExclusion, checkWallChatReadyFromJson } from '../../lib/wall-chat-ready';
import { simpleScrape } from '../../services/firecrawl';
import { logSimpleScrapeCost } from '../../lib/cost/cost-logger';

const izumiPromote = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// Phase 2-A: izumi → subsidy_cache 直接投入
// POST /api/cron/promote-izumi-to-cache
// 
// izumi_subsidiesの基本情報をsubsidy_cacheに投入
// source='izumi', wall_chat_mode='pending'
// 重複排除: idがizumi-XXXXXの形式
// =====================================================

izumiPromote.post('/promote-izumi-to-cache', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 200; // 1回あたりの投入件数（Workers CPU制限対応）
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'promote-izumi-to-cache', authResult.triggeredBy);
    
    const url = new URL(c.req.url);
    const batchSize = Math.min(parseInt(url.searchParams.get('batch') || String(MAX_ITEMS)), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // izumiの未投入データを取得（subsidy_cacheに存在しないもの）
    const targets = await db.prepare(`
      SELECT 
        iz.id,
        iz.policy_id,
        iz.title,
        iz.issuer,
        iz.max_amount_text,
        iz.max_amount_value,
        iz.difficulty,
        iz.difficulty_level,
        iz.support_url,
        iz.support_urls_all,
        iz.period,
        iz.prefecture_code
      FROM izumi_subsidies iz
      WHERE iz.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM subsidy_cache sc WHERE sc.id = iz.id
        )
      ORDER BY iz.policy_id ASC
      LIMIT ?
      OFFSET ?
    `).bind(batchSize, offset).all<{
      id: string;
      policy_id: number;
      title: string;
      issuer: string | null;
      max_amount_text: string | null;
      max_amount_value: number | null;
      difficulty: string | null;
      difficulty_level: number | null;
      support_url: string | null;
      support_urls_all: string | null;
      period: string | null;
      prefecture_code: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { 
        items_processed: 0, 
        metadata: { message: 'No more izumi items to promote' } 
      });
      return c.json<ApiResponse<{ message: string; promoted: number }>>({
        success: true,
        data: { message: 'No more izumi items to promote', promoted: 0 },
      });
    }
    
    let promoted = 0;
    let skipped = 0;
    let excluded = 0;
    const errors: string[] = [];
    
    // バッチINSERT用のステートメント
    for (const iz of targets.results) {
      try {
        // 除外判定（タイトルベース）
        const exclusionResult = checkExclusion(iz.title, '');
        
        // detail_json構築
        const detailJson: Record<string, any> = {
          source: 'izumi',
          izumi_policy_id: iz.policy_id,
          izumi_detail_url: `https://j-izumi.com/policy/${iz.policy_id}/detail`,
        };
        
        // 金額情報
        if (iz.max_amount_text) {
          detailJson.max_amount_text = iz.max_amount_text;
        }
        if (iz.max_amount_value) {
          detailJson.subsidy_max_limit = iz.max_amount_value;
        }
        
        // 難易度
        if (iz.difficulty) {
          detailJson.difficulty = iz.difficulty;
          detailJson.difficulty_level = iz.difficulty_level;
        }
        
        // 発行者
        if (iz.issuer && iz.issuer.length > 0) {
          detailJson.issuer = iz.issuer;
        }
        
        // 期間情報
        if (iz.period && iz.period.length > 0) {
          detailJson.period = iz.period;
        }
        
        // support URL
        if (iz.support_url) {
          detailJson.official_url = iz.support_url;
          detailJson.related_url = iz.support_url;
        }
        
        // 全support URLs（PDF含む）
        if (iz.support_urls_all) {
          const allUrls = iz.support_urls_all.split(' | ').filter(u => u.length > 0);
          if (allUrls.length > 1) {
            detailJson.reference_urls = allUrls;
          }
          // PDFリンクを抽出
          const pdfUrls = allUrls.filter(u => u.toLowerCase().endsWith('.pdf') || u.includes('.pdf?'));
          if (pdfUrls.length > 0) {
            detailJson.pdf_urls = pdfUrls;
          }
        }
        
        // 都道府県コード → 対象地域テキスト
        const prefName = iz.prefecture_code ? prefectureCodeToName(iz.prefecture_code) : null;
        
        if (exclusionResult.excluded) {
          detailJson.wall_chat_excluded = true;
          detailJson.wall_chat_excluded_reason = exclusionResult.reason_code;
          detailJson.wall_chat_excluded_reason_ja = exclusionResult.reason_ja;
        }
        
        // subsidy_cacheにINSERT
        await db.prepare(`
          INSERT OR IGNORE INTO subsidy_cache (
            id, source, title, subsidy_max_limit, subsidy_rate,
            target_area_search, target_industry, target_number_of_employees,
            acceptance_start_datetime, acceptance_end_datetime,
            request_reception_display_flag, detail_json,
            cached_at, expires_at,
            wall_chat_ready, wall_chat_excluded, wall_chat_mode,
            is_visible
          ) VALUES (
            ?, 'izumi', ?, ?, NULL,
            ?, NULL, NULL,
            NULL, NULL,
            1, ?,
            datetime('now'), datetime('now', '+90 days'),
            0, ?, 'pending',
            1
          )
        `).bind(
          iz.id,
          iz.title,
          iz.max_amount_value || null,
          prefName || '全国',
          JSON.stringify(detailJson),
          exclusionResult.excluded ? 1 : 0,
        ).run();
        
        if (exclusionResult.excluded) {
          excluded++;
        } else {
          promoted++;
        }
        
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // UNIQUE constraint violationは重複なのでスキップ
        if (errMsg.includes('UNIQUE') || errMsg.includes('constraint')) {
          skipped++;
        } else {
          errors.push(`${iz.id}: ${errMsg}`);
        }
      }
    }
    
    // 残件数を確認
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM izumi_subsidies iz
      WHERE iz.is_active = 1 
        AND NOT EXISTS (SELECT 1 FROM subsidy_cache sc WHERE sc.id = iz.id)
    `).first<{ cnt: number }>();
    
    console.log(`[Promote-Izumi] Completed: promoted=${promoted}, excluded=${excluded}, skipped=${skipped}, remaining=${remaining?.cnt || 0}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: targets.results.length,
        items_inserted: promoted,
        items_skipped: skipped + excluded,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: {
          promoted,
          excluded,
          skipped,
          remaining: remaining?.cnt || 0,
          batch_size: batchSize,
          offset,
        },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      promoted: number;
      excluded: number;
      skipped: number;
      remaining: number;
      errors_count: number;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Izumi promotion completed: ${promoted} promoted, ${excluded} excluded`,
        promoted,
        excluded,
        skipped,
        remaining: remaining?.cnt || 0,
        errors_count: errors.length,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Promote-Izumi] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Promotion failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// Phase 2-B: izumi support_url クロール → detail_json充実
// POST /api/cron/crawl-izumi-details
//
// subsidy_cache (source=izumi) の support_url をクロール
// HTML からテキスト抽出 → overview, eligible_expenses 等を補完
// wall_chat_ready判定を実行
// =====================================================

izumiPromote.post('/crawl-izumi-details', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 30; // v3: バッチサイズ引上げ（15min間隔で120件/時目標）
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'crawl-izumi-details', authResult.triggeredBy);
    
    const url = new URL(c.req.url);
    const mode = url.searchParams.get('mode') || 'uncrawled'; // uncrawled | upgrade | pdf_mark
    
    // ★ v4.0: mode=upgrade を改善 - PDF URLのみのアイテムも処理対象に含める
    // mode=uncrawled: 未クロールのHTML URLを優先
    // mode=upgrade: フォールバックのみのready済みをリアルデータに差し替え（PDF含む）
    // mode=pdf_mark: PDFのみのURLにcrawled_atをマーク + extraction_queueに投入
    let query: string;
    if (mode === 'upgrade') {
      // ★ v4.0: PDF URL制限を撤廃 → PDF URLのみのアイテムも取得する
      query = `
        SELECT sc.id, sc.title, sc.detail_json
        FROM subsidy_cache sc
        WHERE sc.source = 'izumi'
          AND sc.wall_chat_excluded = 0
          AND json_extract(sc.detail_json, '$.overview_source') = 'title_fallback_v1'
          AND json_extract(sc.detail_json, '$.crawled_at') IS NULL
          AND json_extract(sc.detail_json, '$.official_url') IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
      `;
    } else if (mode === 'pdf_mark') {
      // ★ v4.0 新モード: PDFのみのURLを一括マーク
      query = `
        SELECT sc.id, sc.title, sc.detail_json
        FROM subsidy_cache sc
        WHERE sc.source = 'izumi'
          AND sc.wall_chat_excluded = 0
          AND json_extract(sc.detail_json, '$.crawled_at') IS NULL
          AND json_extract(sc.detail_json, '$.official_url') IS NOT NULL
          AND json_extract(sc.detail_json, '$.official_url') LIKE '%.pdf%'
        ORDER BY RANDOM()
        LIMIT ?
      `;
    } else {
      query = `
        SELECT sc.id, sc.title, sc.detail_json
        FROM subsidy_cache sc
        WHERE sc.source = 'izumi'
          AND sc.wall_chat_excluded = 0
          AND (
            sc.detail_json IS NULL 
            OR json_extract(sc.detail_json, '$.crawled_at') IS NULL
          )
          AND json_extract(sc.detail_json, '$.official_url') IS NOT NULL
          AND json_extract(sc.detail_json, '$.official_url') NOT LIKE '%.pdf%'
        ORDER BY RANDOM()
        LIMIT ?
      `;
    }
    
    const targets = await db.prepare(query).bind(MAX_ITEMS).all<{
      id: string;
      title: string;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { items_processed: 0, metadata: { mode } });
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: `No izumi items to crawl (mode=${mode})` },
      });
    }
    
    let crawled = 0;
    let readyAfter = 0;
    let upgraded = 0;
    let pdfMarked = 0;
    let crawlFailed = 0;
    const errors: string[] = [];
    
    for (const target of targets.results) {
      try {
        const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        
        // support_urlを決定: HTML URLを優先
        let crawlUrl = detail.official_url || detail.related_url;
        if (!crawlUrl) {
          detail.crawled_at = new Date().toISOString();
          detail.crawl_error = 'no_support_url';
          await db.prepare(`UPDATE subsidy_cache SET detail_json = ? WHERE id = ?`)
            .bind(JSON.stringify(detail), target.id).run();
          crawlFailed++;
          continue;
        }
        
        // PDFリンクならスキップ（reference_urlsからHTMLを探す）
        if (crawlUrl.toLowerCase().includes('.pdf')) {
          const altHtmlUrl = (detail.reference_urls || []).find(
            (u: string) => !u.toLowerCase().includes('.pdf')
          );
          if (altHtmlUrl) {
            crawlUrl = altHtmlUrl;
          } else {
            // ★ v4.0: PDF URLのみの場合 → crawled_at をマーク + extraction_queue に投入
            detail.crawled_at = new Date().toISOString();
            detail.crawl_error = 'pdf_url_only';
            detail.crawl_source_url = crawlUrl;
            if (!detail.pdf_urls) detail.pdf_urls = [];
            if (!detail.pdf_urls.includes(crawlUrl)) detail.pdf_urls.push(crawlUrl);
            await db.prepare(`UPDATE subsidy_cache SET detail_json = ? WHERE id = ?`)
              .bind(JSON.stringify(detail), target.id).run();
            
            // extraction_queue に extract_pdf ジョブとして投入（既存がなければ）
            try {
              const { shardKey16 } = await import('../../lib/shard');
              const sk = shardKey16(target.id);
              await db.prepare(`
                INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
                VALUES (lower(hex(randomblob(16))), ?, ?, 'extract_pdf', 50, 'queued', datetime('now'), datetime('now'))
              `).bind(target.id, sk).run();
            } catch (eqErr) {
              console.warn(`[crawl-izumi] Failed to enqueue PDF extraction for ${target.id}:`, eqErr);
            }
            
            pdfMarked++;
            continue;
          }
        }
        
        // HTML取得
        const scrapeResult = await simpleScrape(crawlUrl);
        
        // コスト記録（simpleScrape: $0だが呼び出し数を管理画面で可視化）
        try {
          await logSimpleScrapeCost(db, {
            url: crawlUrl,
            success: scrapeResult.success,
            httpStatus: scrapeResult.error?.startsWith('HTTP ') ? parseInt(scrapeResult.error.split(' ')[1]) : undefined,
            errorCode: scrapeResult.success ? undefined : scrapeResult.error,
            errorMessage: scrapeResult.success ? undefined : scrapeResult.error,
            subsidyId: target.id,
            sourceId: 'izumi',
            responseSize: scrapeResult.html?.length || 0,
          });
        } catch (costErr) {
          // コスト記録失敗はクロールを止めない
          console.warn(`[cost-log] Failed for ${target.id}:`, costErr);
        }
        
        if (!scrapeResult.success || !scrapeResult.html) {
          detail.crawled_at = new Date().toISOString();
          detail.crawl_error = scrapeResult.error || 'scrape_failed';
          await db.prepare(`UPDATE subsidy_cache SET detail_json = ? WHERE id = ?`)
            .bind(JSON.stringify(detail), target.id).run();
          crawlFailed++;
          continue;
        }
        
        // PDFレスポンスを検出
        const rawHtml = scrapeResult.html;
        if (rawHtml.startsWith('%PDF') || rawHtml.substring(0, 100).includes('%PDF')) {
          detail.crawled_at = new Date().toISOString();
          detail.crawl_error = 'pdf_response';
          detail.crawl_source_url = crawlUrl;
          if (!detail.pdf_urls) detail.pdf_urls = [];
          if (!detail.pdf_urls.includes(crawlUrl)) detail.pdf_urls.push(crawlUrl);
          await db.prepare(`UPDATE subsidy_cache SET detail_json = ? WHERE id = ?`)
            .bind(JSON.stringify(detail), target.id).run();
          crawlFailed++;
          continue;
        }
        
        // v2: main/article優先のテキスト抽出
        const extractedText = htmlToPlainTextV2(rawHtml, 5000);
        const extractedFields = extractFieldsFromTextV2(extractedText, target.title);
        
        // overviewの品質チェック: ナビゲーションゴミが多い場合はスキップ
        const wasUpgrade = detail.overview_source === 'title_fallback_v1';
        if (extractedText.length > 80) {
          detail.overview = extractedText.substring(0, 2000);
          detail.overview_source = 'crawl_v2';
        }
        
        // 抽出フィールドがフォールバックより良い場合のみ上書き
        if (extractedFields.eligible_expenses.length > 0) {
          detail.eligible_expenses = extractedFields.eligible_expenses;
          detail.eligible_expenses_source = 'crawl_extraction_v2';
        }
        if (extractedFields.application_requirements.length > 0) {
          detail.application_requirements = extractedFields.application_requirements;
          detail.application_requirements_source = 'crawl_extraction_v2';
        }
        if (extractedFields.required_documents.length > 0) {
          detail.required_documents = extractedFields.required_documents;
          detail.required_documents_source = 'crawl_extraction_v2';
        }
        if (extractedFields.deadline) {
          detail.deadline = extractedFields.deadline;
          detail.acceptance_end_datetime = extractedFields.deadline;
          detail.deadline_source = 'crawl_extraction_v2';
        }
        if (extractedFields.subsidy_rate) {
          detail.subsidy_rate_text = extractedFields.subsidy_rate;
        }
        if (extractedFields.subsidy_amount) {
          detail.subsidy_amount_text = extractedFields.subsidy_amount;
        }
        if (extractedFields.target_businesses) {
          detail.target_businesses = extractedFields.target_businesses;
        }
        
        // PDFリンク抽出
        const pdfLinks = extractPdfLinksFromHtml(rawHtml, crawlUrl);
        if (pdfLinks.length > 0) {
          detail.pdf_urls = [...new Set([...(detail.pdf_urls || []), ...pdfLinks])];
        }
        
        // deadline フォールバック
        if (!detail.deadline && !detail.acceptance_end_datetime) {
          detail.deadline = '通年募集（予算がなくなり次第終了）';
          detail.deadline_source = 'izumi_default_fallback';
        }
        
        detail.crawled_at = new Date().toISOString();
        detail.crawl_source_url = crawlUrl;
        detail.crawl_html_length = rawHtml.length;
        detail.enriched_version = 'izumi_crawl_v2';
        
        // acceptance_end_datetime をテーブルカラムにも反映
        // detail_json内の値とsubsidy_cacheカラムを同期させる
        const deadlineForColumn = detail.acceptance_end_datetime || null;
        
        // wall_chat_ready判定
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache 
            SET detail_json = ?, wall_chat_ready = 1, wall_chat_excluded = 0, wall_chat_mode = 'pending',
                acceptance_end_datetime = COALESCE(?, acceptance_end_datetime)
            WHERE id = ?
          `).bind(JSON.stringify(detail), deadlineForColumn, target.id).run();
          readyAfter++;
        } else if (readyResult.excluded) {
          detail.wall_chat_excluded_reason = readyResult.exclusion_reason;
          detail.wall_chat_excluded_reason_ja = readyResult.exclusion_reason_ja;
          await db.prepare(`
            UPDATE subsidy_cache 
            SET detail_json = ?, wall_chat_ready = 0, wall_chat_excluded = 1,
                acceptance_end_datetime = COALESCE(?, acceptance_end_datetime)
            WHERE id = ?
          `).bind(JSON.stringify(detail), deadlineForColumn, target.id).run();
        } else {
          await db.prepare(`
            UPDATE subsidy_cache 
            SET detail_json = ?, acceptance_end_datetime = COALESCE(?, acceptance_end_datetime)
            WHERE id = ?
          `).bind(JSON.stringify(detail), deadlineForColumn, target.id).run();
        }
        
        crawled++;
        if (wasUpgrade) upgraded++;
        
        // レート制限: 300ms待機
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // 残件確認（全URL - crawled_at未設定のもの）
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'izumi' AND wall_chat_excluded = 0
        AND (detail_json IS NULL OR json_extract(detail_json, '$.crawled_at') IS NULL)
    `).first<{ cnt: number }>();
    
    const remainingFallback = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'izumi' AND wall_chat_excluded = 0
        AND json_extract(detail_json, '$.overview_source') = 'title_fallback_v1'
        AND json_extract(detail_json, '$.crawled_at') IS NULL
    `).first<{ cnt: number }>();
    
    console.log(`[Crawl-Izumi-v2] crawled=${crawled}, upgraded=${upgraded}, pdfMarked=${pdfMarked}, ready=${readyAfter}, failed=${crawlFailed}, remaining=${remaining?.cnt || 0}, remaining_fallback=${remainingFallback?.cnt || 0}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: targets.results.length,
        items_inserted: readyAfter,
        items_updated: crawled + pdfMarked,
        items_skipped: crawlFailed,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: { crawled, upgraded, pdf_marked: pdfMarked, ready_after: readyAfter, crawl_failed: crawlFailed, remaining: remaining?.cnt || 0, remaining_fallback: remainingFallback?.cnt || 0, mode },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      crawled: number;
      upgraded: number;
      pdf_marked: number;
      ready_after: number;
      crawl_failed: number;
      remaining: number;
      remaining_fallback: number;
      errors_count: number;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Izumi crawl v2: ${crawled} crawled, ${upgraded} upgraded, ${pdfMarked} pdf_marked, ${readyAfter} ready`,
        crawled,
        upgraded,
        pdf_marked: pdfMarked,
        ready_after: readyAfter,
        crawl_failed: crawlFailed,
        remaining: remaining?.cnt || 0,
        remaining_fallback: remainingFallback?.cnt || 0,
        errors_count: errors.length,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Crawl-Izumi-v2] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Crawl failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// POST /api/cron/ready-boost-izumi
// 
// izumiデータのwall_chat_ready率を最大化（フォールバックベース）
// クロールなしでdetail_jsonに必須5フィールドをフォールバック設定
// 品質はフォールバックレベルだが、検索・壁打ちに表示可能にする
// =====================================================

izumiPromote.post('/ready-boost-izumi', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 200;
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'ready-boost-izumi', authResult.triggeredBy);
    
    // 未ready かつ 未excluded かつ 未クロールのizumiアイテム
    const targets = await db.prepare(`
      SELECT id, title, detail_json
      FROM subsidy_cache
      WHERE source = 'izumi'
        AND wall_chat_ready = 0
        AND wall_chat_excluded = 0
        AND (
          json_extract(detail_json, '$.enriched_version') IS NULL
          OR json_extract(detail_json, '$.enriched_version') != 'izumi_fallback_v1'
        )
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(MAX_ITEMS).all<{
      id: string;
      title: string;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return c.json<ApiResponse<{ message: string; ready: number }>>({
        success: true,
        data: { message: 'No more izumi items to boost', ready: 0 },
      });
    }
    
    let readied = 0;
    let excludedCount = 0;
    let notReady = 0;
    const errors: string[] = [];
    
    for (const target of targets.results) {
      try {
        const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        
        // 除外判定
        const exclusionResult = checkExclusion(target.title, detail.overview || '');
        if (exclusionResult.excluded) {
          detail.wall_chat_excluded_reason = exclusionResult.reason_code;
          detail.wall_chat_excluded_reason_ja = exclusionResult.reason_ja;
          await db.prepare(`
            UPDATE subsidy_cache 
            SET wall_chat_excluded = 1, detail_json = ?
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          excludedCount++;
          continue;
        }
        
        // 必須フィールドのフォールバック設定
        let modified = false;
        
        // 1. overview: タイトルから自動生成（既存がなければ）
        if (!detail.overview || detail.overview.length < 10) {
          const amountText = detail.max_amount_text || (detail.subsidy_max_limit ? `${(detail.subsidy_max_limit / 10000).toLocaleString()}万円` : '');
          detail.overview = `${target.title}${amountText ? `（補助上限: ${amountText}）` : ''}。詳細は公式サイトをご確認ください。`;
          detail.overview_source = 'title_fallback_v1';
          modified = true;
        }
        
        // 2. application_requirements
        if (!detail.application_requirements || !Array.isArray(detail.application_requirements) || detail.application_requirements.length === 0) {
          detail.application_requirements = [
            '日本国内に事業所を有すること',
            '税務申告を適正に行っていること',
            '反社会的勢力に該当しないこと',
          ];
          detail.application_requirements_source = 'izumi_default_fallback_v1';
          modified = true;
        }
        
        // 3. eligible_expenses (タイトルベース)
        if (!detail.eligible_expenses || !Array.isArray(detail.eligible_expenses) || detail.eligible_expenses.length === 0) {
          const t = target.title.toLowerCase();
          if (t.includes('設備') || t.includes('機械') || t.includes('導入')) {
            detail.eligible_expenses = ['機械装置・システム構築費', '設備購入費'];
          } else if (t.includes('it') || t.includes('デジタル') || t.includes('dx')) {
            detail.eligible_expenses = ['ソフトウェア購入費', 'クラウド利用費'];
          } else if (t.includes('研修') || t.includes('人材') || t.includes('育成')) {
            detail.eligible_expenses = ['研修費', '外部専門家経費'];
          } else if (t.includes('販路') || t.includes('海外') || t.includes('展示会')) {
            detail.eligible_expenses = ['広報費', '展示会出展費'];
          } else if (t.includes('創業') || t.includes('起業')) {
            detail.eligible_expenses = ['設備費', '広報費', '開業費'];
          } else {
            detail.eligible_expenses = ['補助対象経費（詳細は公募要領参照）'];
          }
          detail.eligible_expenses_source = 'title_category_fallback_v1';
          modified = true;
        }
        
        // 4. required_documents
        if (!detail.required_documents || !Array.isArray(detail.required_documents) || detail.required_documents.length === 0) {
          detail.required_documents = ['申請書', '事業計画書', '見積書'];
          detail.required_documents_source = 'default_fallback_v1';
          modified = true;
        }
        
        // 5. deadline
        if (!detail.deadline && !detail.acceptance_end_datetime) {
          detail.deadline = '通年募集（予算がなくなり次第終了）';
          detail.deadline_source = 'izumi_default_fallback';
          modified = true;
        }
        
        if (modified) {
          detail.enriched_version = 'izumi_fallback_v1';
          detail.enriched_at = new Date().toISOString();
        }
        
        // wall_chat_ready判定
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache 
            SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          readied++;
        } else if (readyResult.excluded) {
          detail.wall_chat_excluded_reason = readyResult.exclusion_reason;
          detail.wall_chat_excluded_reason_ja = readyResult.exclusion_reason_ja;
          await db.prepare(`
            UPDATE subsidy_cache 
            SET wall_chat_excluded = 1, detail_json = ?
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          excludedCount++;
        } else {
          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          notReady++;
        }
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // 残件確認
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'izumi' AND wall_chat_ready = 0 AND wall_chat_excluded = 0
    `).first<{ cnt: number }>();
    
    console.log(`[Ready-Boost-Izumi] readied=${readied}, excluded=${excludedCount}, not_ready=${notReady}, remaining=${remaining?.cnt || 0}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: targets.results.length,
        items_inserted: readied,
        items_skipped: excludedCount + notReady,
        error_count: errors.length,
        metadata: { readied, excluded: excludedCount, not_ready: notReady, remaining: remaining?.cnt || 0 },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      readied: number;
      excluded: number;
      not_ready: number;
      remaining: number;
      errors_count: number;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Izumi ready boost: ${readied} readied, ${excludedCount} excluded`,
        readied,
        excluded: excludedCount,
        not_ready: notReady,
        remaining: remaining?.cnt || 0,
        errors_count: errors.length,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Ready-Boost-Izumi] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) },
    }, 500);
  }
});

// =====================================================
// GET /api/cron/izumi-promote-status
// 投入状況サマリ
// =====================================================

izumiPromote.get('/izumi-promote-status', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  try {
    // izumi_subsidies 総数
    const izumiTotal = await db.prepare(`
      SELECT COUNT(*) as total FROM izumi_subsidies WHERE is_active = 1
    `).first<{ total: number }>();
    
    // subsidy_cache(source=izumi)の状態
    const cacheStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN wall_chat_excluded = 1 THEN 1 ELSE 0 END) as excluded,
        SUM(CASE WHEN wall_chat_ready = 0 AND wall_chat_excluded = 0 THEN 1 ELSE 0 END) as not_ready,
        SUM(CASE WHEN json_extract(detail_json, '$.crawled_at') IS NOT NULL THEN 1 ELSE 0 END) as crawled
      FROM subsidy_cache
      WHERE source = 'izumi'
    `).first<{
      total: number;
      ready: number;
      excluded: number;
      not_ready: number;
      crawled: number;
    }>();
    
    // 未投入件数
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM izumi_subsidies iz
      WHERE iz.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM subsidy_cache sc WHERE sc.id = iz.id)
    `).first<{ cnt: number }>();
    
    // 全体のcache統計
    const overallStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        source, COUNT(*) as cnt
      FROM subsidy_cache
      GROUP BY source
      ORDER BY cnt DESC
    `).all();
    
    return c.json<ApiResponse<{
      izumi_total: number;
      promoted_to_cache: number;
      remaining_to_promote: number;
      cache_izumi: {
        total: number;
        ready: number;
        excluded: number;
        not_ready: number;
        crawled: number;
      };
      by_source: any[];
    }>>({
      success: true,
      data: {
        izumi_total: izumiTotal?.total || 0,
        promoted_to_cache: cacheStats?.total || 0,
        remaining_to_promote: remaining?.cnt || 0,
        cache_izumi: {
          total: cacheStats?.total || 0,
          ready: cacheStats?.ready || 0,
          excluded: cacheStats?.excluded || 0,
          not_ready: cacheStats?.not_ready || 0,
          crawled: cacheStats?.crawled || 0,
        },
        by_source: overallStats.results || [],
      },
    });
    
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) },
    }, 500);
  }
});

// =====================================================
// ヘルパー関数
// =====================================================

/**
 * 都道府県コード → 名前変換
 */
function prefectureCodeToName(code: string): string | null {
  const map: Record<string, string> = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県',
  };
  return map[code] || null;
}

/**
 * HTML → プレーンテキスト変換（軽量版 - 後方互換用）
 */
function htmlToPlainText(html: string, maxLength: number = 5000): string {
  return htmlToPlainTextV2(html, maxLength);
}

/**
 * HTML → プレーンテキスト変換 v2
 * main/article/content領域を優先抽出、ナビゲーション除去強化
 */
function htmlToPlainTextV2(html: string, maxLength: number = 5000): string {
  // Step 1: main content領域を探す
  let contentHtml = html;
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*(?:id|class)=["'][^"']*(?:content|main|honbun|mainContents|entry-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div[^>]*(?:id|class)=["'][^"']*(?:footer|sidebar|sub|navi))/i,
  ];
  
  for (const pattern of mainPatterns) {
    const match = pattern.exec(html);
    if (match && match[1] && match[1].length > 200) {
      contentHtml = match[1];
      break;
    }
  }
  
  let text = contentHtml
    // 不要タグ除去
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // 構造タグ → 改行
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th|dt|dd|section|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // HTMLエンティティ
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&rsaquo;/g, '>')
    .replace(/&lsaquo;/g, '<')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/gi, '')
    // 空白正規化
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // ナビゲーション行を除去（短い行が連続する部分）
  const lines = text.split('\n');
  const filteredLines: string[] = [];
  let shortLineStreak = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { shortLineStreak = 0; continue; }
    
    // 除外パターン: サイト共通ナビゲーション等
    if (/^(ホーム|トップ|HOME|TOP|サイトマップ|お問い合わせ|閲覧補助|文字サイズ|Foreign|Select Language|検索|メニュー|印刷|ページの先頭|本文へ|このページ|JavaScriptが無効|くらし|健康|税金|子育て|防災|移住|閉じる|共通メニュー|操作補助)/.test(trimmed)) {
      continue;
    }
    // 非常に短い行が連続したらナビゲーション判定
    if (trimmed.length <= 6) {
      shortLineStreak++;
      if (shortLineStreak >= 3) continue;
    } else {
      shortLineStreak = 0;
    }
    
    if (trimmed.length >= 4) {
      filteredLines.push(trimmed);
    }
  }
  
  return filteredLines.join('\n').substring(0, maxLength);
}

/**
 * テキストからフィールド抽出 (後方互換用)
 */
function extractFieldsFromText(text: string, title: string) {
  return extractFieldsFromTextV2(text, title);
}

/**
 * テキストからフィールド抽出 v2
 * パターン拡充: 補助率、金額、対象事業者も抽出
 */
function extractFieldsFromTextV2(text: string, title: string): {
  eligible_expenses: string[];
  application_requirements: string[];
  required_documents: string[];
  deadline: string | null;
  subsidy_rate: string | null;
  subsidy_amount: string | null;
  target_businesses: string | null;
} {
  const result = {
    eligible_expenses: [] as string[],
    application_requirements: [] as string[],
    required_documents: [] as string[],
    deadline: null as string | null,
    subsidy_rate: null as string | null,
    subsidy_amount: null as string | null,
    target_businesses: null as string | null,
  };
  
  // === 対象経費の抽出 ===
  const expensePatterns = [
    /(?:補助|助成|対象)(?:の)?(?:対象)?(?:経費|費用|事業)[：:は]\s*(.+?)(?:\n|$)/gi,
    /(?:対象となる)(?:経費|費用|事業)[：:は]\s*(.+?)(?:\n|$)/gi,
    /(?:補助対象内容)[\s\n]*(.+?)(?:\n\n|$)/gi,
  ];
  for (const pattern of expensePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const items = match[1].split(/[、，,・\n]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 80);
      result.eligible_expenses.push(...items);
    }
  }
  // 重複除去
  result.eligible_expenses = [...new Set(result.eligible_expenses)].slice(0, 10);
  
  // === 申請要件・対象者 ===
  const reqPatterns = [
    /(?:補助|助成|給付|交付)?(?:の)?(?:対象|要件|資格)[：:は]\s*(.+?)(?:\n\n|$)/gi,
    /(?:対象者|対象事業者|申請資格|交付対象|給付対象者)[：:は]?\s*(.+?)(?:\n\n|$)/gis,
    /(?:次の.{0,10}に該当)(.{10,300}?)(?:\n\n)/gis,
  ];
  for (const pattern of reqPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const block = match[1];
      const items = block.split(/[\n]/).map(s => s.trim()).filter(s => s.length >= 5 && s.length <= 200);
      result.application_requirements.push(...items);
    }
  }
  result.application_requirements = [...new Set(result.application_requirements)].slice(0, 15);
  
  // === 必要書類 ===
  const docPatterns = [
    /(?:必要|提出|申請)?書類[：:は]?\s*(.+?)(?:\n\n|$)/gi,
    /(?:添付書類|提出物|必要なもの)[：:は]?\s*(.+?)(?:\n\n|$)/gi,
  ];
  for (const pattern of docPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const items = match[1].split(/[、，,・\n]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 60 && !s.includes('ワード形式') && !s.includes('PDF形式') && !s.includes('エクセル'));
      result.required_documents.push(...items);
    }
  }
  // テキスト内の書類名直接検出
  const docKeywords = ['申請書', '事業計画書', '見積書', '決算書', '確定申告書', '登記簿謄本', '印鑑証明書', '納税証明書', '住民票', '定款', '経費明細', '交付申請書', '実績報告書', '概算払請求書'];
  for (const kw of docKeywords) {
    if (text.includes(kw) && !result.required_documents.includes(kw)) {
      result.required_documents.push(kw);
    }
  }
  result.required_documents = [...new Set(result.required_documents)].slice(0, 10);
  
  // === 締切日 ===
  const deadlinePatterns = [
    /(?:締切|期限|期日|〆切|しめきり|受付終了)[：:日は]?\s*(令和\d+年\d+月\d+日|20\d{2}[年\/\-]\d{1,2}[月\/\-]\d{1,2}日?)/gi,
    /(?:受付期間|募集期間|申請期間|公募期間)[：:は]?[\s\S]{0,50}?(?:～|~|〜|まで|から)\s*(令和\d+年\d+月\d+日|20\d{2}[年\/\-]\d{1,2}[月\/\-]\d{1,2}日?)/gi,
    /(令和\d+年\d+月\d+日)\s*(?:まで|締切|迄)/gi,
  ];
  for (const pattern of deadlinePatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.deadline = match[1];
      break;
    }
  }
  
  // === 補助率 ===
  const ratePatterns = [
    /(?:補助率|助成率|補助割合)[：:は]?\s*([0-9\/１-９／]+(?:分の[0-9１-９]+)?|[0-9]+[%％])/gi,
    /(?:対象経費の)\s*([0-9\/１-９／]+(?:分の[0-9１-９]+)?|[0-9]+[%％])\s*(?:以内|を補助)/gi,
  ];
  for (const pattern of ratePatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.subsidy_rate = match[1];
      break;
    }
  }
  
  // === 補助金額 ===
  const amountPatterns = [
    /(?:補助(?:金額|上限|限度額)|助成(?:金額|上限|限度額)|上限額)[：:は]?\s*([0-9,，]+万?円(?:以内)?)/gi,
    /(?:1(?:件|事業所|法人|人)あたり|1(?:件|事業所|法人|人)当たり)\s*(?:最大)?\s*([0-9,，]+万?円)/gi,
  ];
  for (const pattern of amountPatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.subsidy_amount = match[1];
      break;
    }
  }
  
  // === 対象事業者 ===
  const bizPatterns = [
    /(?:対象(?:と)?(?:なる)?(?:事業者|企業|者))[：:は]?\s*(.{10,200}?)(?:\n\n|\n(?:[0-9０-９]|\(|（))/gis,
  ];
  for (const pattern of bizPatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.target_businesses = match[1].trim().substring(0, 200);
      break;
    }
  }
  
  return result;
}

/**
 * HTMLからPDFリンクを抽出
 */
function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const pdfUrls: string[] = [];
  const hrefPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  let match;
  
  while ((match = hrefPattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        url = `${base.protocol}//${base.host}${url}`;
      } catch { continue; }
    } else if (!url.startsWith('http')) {
      continue;
    }
    pdfUrls.push(url);
  }
  
  return [...new Set(pdfUrls)];
}

export default izumiPromote;

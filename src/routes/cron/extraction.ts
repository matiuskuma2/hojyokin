/**
 * Cron: PDF抽出・OCR・キュー管理
 * 
 * POST /save-base64-pdfs     - Base64 PDF保存
 * POST /extract-pdf-forms    - PDF→OpenAI Vision抽出
 * POST /enqueue-extractions  - 抽出キューへ投入
 * POST /consume-extractions  - 抽出キュー消化
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../../services/firecrawl';
import { shardKey16, currentShardByHour } from '../../lib/shard';
import { checkExclusion, checkWallChatReadyFromJson, selectBestPdfs, scorePdfUrl, type ExclusionReasonCode } from '../../lib/wall-chat-ready';
import { logFirecrawlCost, logOpenAICost } from '../../lib/cost/cost-logger';

const extraction = new Hono<{ Bindings: Env; Variables: Variables }>();

extraction.post('/save-base64-pdfs', async (c) => {
  const db = c.env.DB;
  const r2 = c.env.R2_KNOWLEDGE;
  
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
  
  // 設定 (Cloudflare Worker 30秒制限のため3件に制限)
  const MAX_ITEMS_PER_RUN = 3;
  const JGRANTS_DETAIL_API_V2 = 'https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id';
  
  let runId: string | null = null;
  let itemsProcessed = 0;
  let pdfsSaved = 0;
  let itemsQueued = 0;
  let itemsSkipped = 0;
  const errors: string[] = [];
  
  try {
    runId = await startCronRun(db, 'save-base64-pdfs', 'cron');
    
    // Active + pdf_urls が空の案件を取得
    const targets = await db.prepare(`
      SELECT 
        id, title, detail_json
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND wall_chat_ready = 0
        AND detail_json IS NOT NULL
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime > datetime('now')
        AND (
          json_extract(detail_json, '$.pdf_urls') IS NULL 
          OR json_extract(detail_json, '$.pdf_urls') = '[]'
          OR json_array_length(json_extract(detail_json, '$.pdf_urls')) = 0
        )
        AND json_extract(detail_json, '$.base64_processed') IS NULL
      ORDER BY acceptance_end_datetime ASC
      LIMIT ?
    `).bind(MAX_ITEMS_PER_RUN).all<{
      id: string;
      title: string;
      detail_json: string;
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
        data: { message: 'No targets found for Base64 PDF processing' },
      });
    }
    
    console.log(`[Save-Base64-PDFs] Found ${targets.results.length} targets`);
    
    for (const target of targets.results) {
      try {
        // v2 API から詳細を取得
        const apiUrl = `${JGRANTS_DETAIL_API_V2}/${target.id}`;
        console.log(`[Save-Base64-PDFs] Fetching ${target.id}: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          errors.push(`${target.id}: API ${response.status}`);
          itemsSkipped++;
          continue;
        }
        
        const data = await response.json() as any;
        const subsidy = data.result?.[0];
        
        if (!subsidy) {
          errors.push(`${target.id}: No result in API response`);
          itemsSkipped++;
          continue;
        }
        
        const detailJson = JSON.parse(target.detail_json || '{}');
        const savedPdfUrls: string[] = [];
        
        // application_guidelines（公募要領）を処理
        if (subsidy.application_guidelines && Array.isArray(subsidy.application_guidelines)) {
          for (const ag of subsidy.application_guidelines) {
            if (!ag.data || !ag.name) continue;
            
            // PDFスコアリング（score < 0 は保存しない）
            const score = scorePdfUrl(ag.name, ag.name);
            if (score.score < 0) {
              console.log(`[Save-Base64-PDFs] Skipping ${ag.name}: score=${score.score} (${score.reason})`);
              continue;
            }
            
            try {
              // Base64 decode
              const binaryString = atob(ag.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // ファイルハッシュ生成（簡易）
              const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const fileHash = hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
              
              // R2に保存
              const r2Key = `pdf/${target.id}/${fileHash}.pdf`;
              await r2.put(r2Key, bytes, {
                httpMetadata: {
                  contentType: 'application/pdf',
                },
                customMetadata: {
                  subsidyId: target.id,
                  originalName: ag.name,
                  source: 'jgrants_application_guidelines',
                  savedAt: new Date().toISOString(),
                  scoreCategory: score.category,
                },
              });
              
              // R2 URL（公開バケットの場合）または内部参照用URL
              // Note: R2は公開設定が必要。ここでは内部参照用キーを保存
              const r2Url = `r2://subsidy-knowledge/${r2Key}`;
              savedPdfUrls.push(r2Url);
              pdfsSaved++;
              
              console.log(`[Save-Base64-PDFs] Saved ${ag.name} -> ${r2Key} (score: ${score.score})`);
              
            } catch (saveErr) {
              console.warn(`[Save-Base64-PDFs] Failed to save ${ag.name}:`, saveErr);
              errors.push(`${target.id}/${ag.name}: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`);
            }
          }
        }
        
        // detail_json 更新
        if (savedPdfUrls.length > 0) {
          detailJson.pdf_urls = savedPdfUrls;
          detailJson.base64_processed = true;
          detailJson.base64_processed_at = new Date().toISOString();
          
          await db.prepare(`
            UPDATE subsidy_cache SET
              detail_json = ?,
              cached_at = datetime('now')
            WHERE id = ?
          `).bind(JSON.stringify(detailJson), target.id).run();
          
          // extraction_queue に登録
          const queueId = generateUUID();
          const shard = shardKey16(target.id);
          await db.prepare(`
            INSERT OR IGNORE INTO extraction_queue 
              (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
            VALUES (?, ?, ?, 'extract_pdf', 50, 'queued', datetime('now'), datetime('now'))
          `).bind(queueId, target.id, shard).run();
          itemsQueued++;
          
          console.log(`[Save-Base64-PDFs] ${target.id}: Saved ${savedPdfUrls.length} PDFs, queued for extraction`);
        } else {
          // Base64 データがなかった場合もマーク（再処理防止）
          detailJson.base64_processed = true;
          detailJson.base64_processed_at = new Date().toISOString();
          detailJson.base64_no_data = true;
          
          await db.prepare(`
            UPDATE subsidy_cache SET
              detail_json = ?,
              cached_at = datetime('now')
            WHERE id = ?
          `).bind(JSON.stringify(detailJson), target.id).run();
          
          console.log(`[Save-Base64-PDFs] ${target.id}: No Base64 PDF data found`);
        }
        
        itemsProcessed++;
        
        // レート制限
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        itemsSkipped++;
      }
    }
    
    if (runId) {
      await finishCronRun(db, runId, 'success', {
        items_processed: itemsProcessed,
        items_inserted: pdfsSaved,
        items_updated: itemsQueued,
        items_skipped: itemsSkipped,
        error_count: errors.length,
        errors: errors.slice(0, 20),
        metadata: {
          pdfs_saved: pdfsSaved,
          items_queued: itemsQueued,
        },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_processed: number;
      pdfs_saved: number;
      items_queued: number;
      items_skipped: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Base64 PDF processing completed',
        items_processed: itemsProcessed,
        pdfs_saved: pdfsSaved,
        items_queued: itemsQueued,
        items_skipped: itemsSkipped,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Save-Base64-PDFs] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Save-Base64-PDFs] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Base64 PDF processing failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

// =====================================================
// A-3.5: WALL_CHAT_READY 再計算エンドポイント
// POST /api/cron/recalc-wall-chat-ready
// 
// 正規ロジック (checkWallChatReadyFromJson) を使って wall_chat_ready を再計算
// - 5項目が揃っている案件を ready=1 に
// - 除外対象を wall_chat_excluded=1 に
// =====================================================


extraction.post('/extract-pdf-forms', async (c) => {
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
extraction.post('/enqueue-extractions', async (c) => {
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

  // C) enrich_jgrants: jgrants でdetail_jsonが薄い & Active only
  // 2026-01-27 確定方針: acceptance_end_datetime IS NOT NULL AND > now のみ
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
      AND sc.acceptance_end_datetime IS NOT NULL 
      AND sc.acceptance_end_datetime > datetime('now')
    ORDER BY sc.acceptance_end_datetime ASC
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
extraction.post('/consume-extractions', async (c) => {
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
              const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
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
            
            // v4: PDF選別スコアリングで公募要領を優先
            // attachments情報があれば使う（ファイル名でスコアリング精度向上）
            const attachments = detail.attachments as Array<{ name: string; type: string; url?: string }> | undefined;
            const prioritizedPdfs = selectBestPdfs(pdfUrls, 3, attachments);
            
            console.log(`[extract_pdf] ${subsidy.id}: ${pdfUrls.length} PDFs, prioritized ${prioritizedPdfs.length}`);
            if (prioritizedPdfs.length > 0) {
              const topScore = scorePdfUrl(prioritizedPdfs[0]);
              console.log(`[extract_pdf] Top PDF: ${prioritizedPdfs[0].substring(0, 80)}... (score: ${topScore.score}, ${topScore.reason})`);
            }
            
            let pdfText = '';
            let successfulPdfUrl = '';
            
            // R2 URL を署名付き HTTP URL に変換するヘルパー
            // r2://subsidy-knowledge/pdf/xxx.pdf → https://hojyokin.pages.dev/api/r2-pdf?key=...&exp=...&sig=...
            const convertR2UrlToHttp = async (url: string): Promise<{ isR2: boolean; httpUrl: string; r2Key: string | null }> => {
              const r2Prefix = 'r2://subsidy-knowledge/';
              if (url.startsWith(r2Prefix)) {
                const r2Key = url.substring(r2Prefix.length); // pdf/xxx.pdf
                const baseUrl = env.CLOUDFLARE_API_BASE_URL || 'https://hojyokin.pages.dev';
                const signingSecret = env.R2_PDF_SIGNING_SECRET;
                
                if (signingSecret) {
                  // 署名付きURL生成（有効期限10分）
                  const { buildSignedR2PdfUrl } = await import('../../lib/r2-sign');
                  const httpUrl = await buildSignedR2PdfUrl(baseUrl, r2Key, signingSecret, 600);
                  return { isR2: true, httpUrl, r2Key };
                } else {
                  // 署名シークレット未設定（開発環境用）
                  console.warn('[extract_pdf] R2_PDF_SIGNING_SECRET not set - using unsigned URL');
                  const httpUrl = `${baseUrl}/api/r2-pdf?key=${encodeURIComponent(r2Key)}`;
                  return { isR2: true, httpUrl, r2Key };
                }
              }
              return { isR2: false, httpUrl: url, r2Key: null };
            };
            
            // フォールバック付きでPDFを順番に試行
            for (const pdfUrl of prioritizedPdfs) {
              if (pdfText && pdfText.length > 100) break; // 成功したら終了
              
              const pdfScore = scorePdfUrl(pdfUrl);
              if (pdfScore.score < 0) {
                console.log(`[extract_pdf] Skipping low-score PDF: ${pdfUrl.substring(0, 60)}... (score: ${pdfScore.score})`);
                continue;
              }
              
              // R2 URL の変換（署名付き）
              const { isR2, httpUrl, r2Key } = await convertR2UrlToHttp(pdfUrl);
              
              // ===== R2 PDF: 直接 R2 から取得してテキスト化 =====
              if (isR2 && r2Key && env.R2_KNOWLEDGE) {
                try {
                  console.log(`[extract_pdf] Fetching R2 PDF: ${r2Key}`);
                  const r2Object = await env.R2_KNOWLEDGE.get(r2Key);
                  
                  if (r2Object) {
                    // R2 の PDF を取得成功 → Firecrawl 経由で変換
                    // Firecrawl は HTTP URL が必要なので内部ブリッジを使う
                    if (firecrawlKey) {
                      console.log(`[extract_pdf] Converting R2 PDF via internal bridge: ${httpUrl}`);
                      const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${firecrawlKey}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ url: httpUrl, formats: ['markdown'] }),
                      });
                      
                      const fcSuccess = fcResponse.ok;
                      let fcText = '';
                      
                      if (fcSuccess) {
                        const fcData = await fcResponse.json() as any;
                        fcText = fcData.data?.markdown || '';
                        if (fcText.length > 100) {
                          pdfText = fcText;
                          successfulPdfUrl = pdfUrl; // 元の r2:// URL を記録
                          console.log(`[extract_pdf] R2 PDF Success: ${pdfUrl.substring(0, 60)}... (${fcText.length} chars)`);
                        }
                      } else {
                        console.warn(`[extract_pdf] Firecrawl failed for R2 PDF: ${fcResponse.status}`);
                      }
                      
                      // Firecrawl コスト記録 (1 credit per scrape)
                      await logFirecrawlCost(db, {
                        credits: 1,
                        costUsd: 0.001,
                        url: httpUrl,
                        success: fcSuccess,
                        httpStatus: fcResponse.status,
                        subsidyId: subsidy.id,
                        billing: 'known',
                        rawUsage: { markdown_length: fcText.length },
                      });
                    }
                  } else {
                    console.warn(`[extract_pdf] R2 object not found: ${r2Key}`);
                  }
                } catch (e) {
                  console.warn(`[extract_pdf] R2 PDF processing failed for ${pdfUrl}:`, e);
                }
                continue; // R2 PDF は処理完了、次へ
              }
              
              // ===== 通常の HTTP(S) URL: 従来通り Firecrawl に渡す =====
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
                  
                  const fcSuccess = fcResponse.ok;
                  let fcText = '';
                  
                  if (fcSuccess) {
                    const fcData = await fcResponse.json() as any;
                    fcText = fcData.data?.markdown || '';
                    if (fcText.length > 100) {
                      pdfText = fcText;
                      successfulPdfUrl = pdfUrl;
                      console.log(`[extract_pdf] Success: ${pdfUrl.substring(0, 60)}... (${fcText.length} chars)`);
                    }
                  }
                  
                  // Firecrawl コスト記録 (1 credit per scrape)
                  await logFirecrawlCost(db, {
                    credits: 1,
                    costUsd: 0.001,
                    url: pdfUrl,
                    success: fcSuccess,
                    httpStatus: fcResponse.status,
                    subsidyId: subsidy.id,
                    billing: 'known',
                    rawUsage: { markdown_length: fcText.length },
                  });
                } catch (e) {
                  console.warn(`[extract_pdf] Firecrawl failed for ${pdfUrl}:`, e);
                  // 失敗時もコスト記録 (Freeze-COST-3)
                  await logFirecrawlCost(db, {
                    credits: 1,
                    costUsd: 0.001,
                    url: pdfUrl,
                    success: false,
                    subsidyId: subsidy.id,
                    errorMessage: e instanceof Error ? e.message : 'Unknown error',
                    billing: 'known',
                  });
                }
              }
            }
            
            // OpenAI で構造化データ抽出
            if (pdfText && pdfText.length > 100 && openaiKey) {
              try {
                const { extractSubsidyDataFromPdf, mergeExtractedData, ExtractedResult } = await import('../../services/openai-extractor');
                const extractResult = await extractSubsidyDataFromPdf(pdfText, openaiKey, 'gpt-4o-mini', true) as import('../../services/openai-extractor').ExtractedResult;
                
                // OpenAI コスト記録
                const inputTokens = extractResult.usage?.prompt_tokens || 0;
                const outputTokens = extractResult.usage?.completion_tokens || 0;
                // gpt-4o-mini: $0.15/1M input, $0.60/1M output
                const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
                
                await logOpenAICost(db, {
                  model: extractResult.model,
                  inputTokens,
                  outputTokens,
                  costUsd,
                  action: 'extract_pdf',
                  success: extractResult.success,
                  subsidyId: subsidy.id,
                  rawUsage: extractResult.usage,
                });
                
                if (extractResult.data) {
                  // 既存データとマージ (mergeExtractedData を使用)
                  const merged = mergeExtractedData(detail, extractResult.data);
                  merged.extracted_pdf_text = pdfText.substring(0, 5000);
                  merged.extracted_at = new Date().toISOString();
                  merged.extracted_from_pdf = successfulPdfUrl; // どのPDFから抽出したか記録
                  
                  await db.prepare(`
                    UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                    WHERE id = ?
                  `).bind(JSON.stringify(merged), subsidy.id).run();
                  
                  // WALL_CHAT_READY 判定（v4: タイトルも渡す）
                  const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged), subsidy.title);
                  if (readyResult.ready) {
                    await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                      .bind(subsidy.id).run();
                  }
                }
              } catch (e) {
                console.warn(`[extract_pdf] OpenAI extraction failed for ${subsidy.id}:`, e);
                // 失敗時もコスト記録 (推定値)
                await logOpenAICost(db, {
                  model: 'gpt-4o-mini',
                  inputTokens: 0,
                  outputTokens: 0,
                  costUsd: 0,
                  action: 'extract_pdf',
                  success: false,
                  subsidyId: subsidy.id,
                  errorMessage: e instanceof Error ? e.message : 'Unknown error',
                });
                // OpenAIが失敗してもFirecrawlの結果は保存
                if (pdfText.length > 100) {
                  const merged = {
                    ...detail,
                    extracted_pdf_text: pdfText.substring(0, 5000),
                    extracted_at: new Date().toISOString(),
                    extracted_from_pdf: successfulPdfUrl,
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
                extracted_from_pdf: successfulPdfUrl,
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
            const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
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

export default extraction;

/**
 * Cron: PDF操作 - 保存・抽出・wall_chat_ready再計算
 * 
 * POST /save-base64-pdfs  - Base64 PDF保存
 * POST /extract-pdf-forms - PDF→OpenAI Vision抽出
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret } from './_helpers';
import { shardKey16 } from '../../lib/shard';
import { checkWallChatReadyFromJson, scorePdfUrl } from '../../lib/wall-chat-ready';

const pdfOperations = new Hono<{ Bindings: Env; Variables: Variables }>();

pdfOperations.post('/save-base64-pdfs', async (c) => {
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


pdfOperations.post('/extract-pdf-forms', async (c) => {
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


export default pdfOperations;

/**
 * Cron: PDF自動監視パイプライン (P6)
 * 
 * POST /scan-subsidy-pdfs     - 全監視対象サイトをスキャンしてPDFリンクを検出
 * POST /process-detected-pdfs - 検出されたPDFを取得・R2保存・テキスト抽出
 * GET  /monitor-dashboard     - 監視状況ダッシュボード用データ
 * POST /force-scan-single     - 特定のmonitor_idを即座にスキャン
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret } from './_helpers';

const pdfMonitor = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// ヘルパー: HTMLからPDFリンクを抽出
// =====================================================
function extractPdfUrls(html: string, baseUrl: string): Array<{url: string; text: string; context: string}> {
  const results: Array<{url: string; text: string; context: string}> = [];
  
  // href="...pdf" パターン
  const hrefRegex = /<a\s+[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    let url = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim().substring(0, 200);
    url = resolveUrl(url, baseUrl);
    if (url) {
      results.push({ url, text: linkText, context: 'a_href' });
    }
  }
  
  // src="...pdf" (embed/iframe等)
  const srcRegex = /(?:src|data)=["']([^"']*\.pdf[^"']*)["']/gi;
  while ((match = srcRegex.exec(html)) !== null) {
    const url = resolveUrl(match[1], baseUrl);
    if (url) {
      results.push({ url, text: '', context: 'embed_src' });
    }
  }
  
  // *.zip パターンも拾う（申請様式等）
  const zipRegex = /<a\s+[^>]*href=["']([^"']*\.zip[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = zipRegex.exec(html)) !== null) {
    let url = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim().substring(0, 200);
    url = resolveUrl(url, baseUrl);
    if (url) {
      results.push({ url, text: linkText, context: 'zip_file' });
    }
  }
  
  // 重複除去
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    }
    // 相対パス
    const lastSlash = baseUrl.lastIndexOf('/');
    return baseUrl.substring(0, lastSlash + 1) + url;
  } catch {
    return '';
  }
}

// =====================================================
// ヘルパー: 期限近接度に基づくチェック間隔の自動調整
// =====================================================
function calculateAdaptiveInterval(
  deadlineStr: string | null,
  baseIntervalHours: number
): number {
  if (!deadlineStr) return baseIntervalHours;
  
  try {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysUntilDeadline < 0) {
      // 期限切れ → 次回公募を待つ（長めのインターバル）
      return Math.max(baseIntervalHours, 48);
    }
    if (daysUntilDeadline <= 3) {
      // 3日以内 → 2時間ごと
      return 2;
    }
    if (daysUntilDeadline <= 7) {
      // 1週間以内 → 4時間ごと
      return 4;
    }
    if (daysUntilDeadline <= 14) {
      // 2週間以内 → 6時間ごと
      return 6;
    }
    if (daysUntilDeadline <= 30) {
      // 1ヶ月以内 → 12時間ごと
      return 12;
    }
    
    return baseIntervalHours;
  } catch {
    return baseIntervalHours;
  }
}

// =====================================================
// SHA-256 ハッシュ
// =====================================================
async function sha256Hash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// =====================================================
// POST /api/cron/scan-subsidy-pdfs
// 全監視対象サイトをスキャンしてPDFリンクを検出
// =====================================================
pdfMonitor.post('/scan-subsidy-pdfs', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'scan-subsidy-pdfs', 'cron');
  } catch (e) {
    console.warn('[ScanPDFs] Failed to log cron run:', e);
  }
  
  const errors: string[] = [];
  let monitorsScanned = 0;
  let newPdfsDetected = 0;
  let pdfLinksUpdated = 0;
  const detectedPdfs: Array<{monitor_id: string; source_name: string; pdf_url: string; link_text: string; status: string}> = [];
  
  try {
    // --- 1. チェック対象の監視レコードを取得 ---
    // 適応的インターバルを考慮: check_interval_hours分経過したものを取得
    // 期限近接の場合は自動で短縮される
    const monitors = await db.prepare(`
      SELECT 
        dsm.*,
        sc.acceptance_end_datetime as deadline
      FROM data_source_monitors dsm
      LEFT JOIN subsidy_cache sc ON sc.id = dsm.subsidy_cache_id
      WHERE dsm.status = 'active'
      AND (dsm.last_checked_at IS NULL OR 
           datetime(dsm.last_checked_at, '+' || dsm.check_interval_hours || ' hours') < datetime('now'))
      ORDER BY 
        CASE WHEN dsm.last_checked_at IS NULL THEN 0 ELSE 1 END,
        dsm.last_checked_at ASC
      LIMIT 15
    `).all();
    
    console.log(`[ScanPDFs] Found ${monitors.results?.length || 0} monitors to scan`);
    
    for (const monitor of (monitors.results || []) as any[]) {
      try {
        console.log(`[ScanPDFs] Scanning: ${monitor.source_name} → ${monitor.source_url}`);
        
        // --- 2. ページを取得 ---
        const response = await fetch(monitor.source_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.9',
          },
          redirect: 'follow',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        const pageHash = await sha256Hash(html);
        
        // --- 3. ページ変更検出 ---
        const pageChanged = monitor.last_page_hash !== pageHash;
        
        if (!pageChanged && monitor.last_checked_at) {
          console.log(`[ScanPDFs] No page changes: ${monitor.source_name}`);
          
          // 適応的インターバル更新
          const adaptiveInterval = calculateAdaptiveInterval(
            monitor.deadline,
            monitor.check_interval_hours
          );
          
          await db.prepare(`
            UPDATE data_source_monitors 
            SET last_checked_at = datetime('now'),
                check_interval_hours = ?,
                error_count = 0,
                consecutive_errors = 0
            WHERE id = ?
          `).bind(adaptiveInterval, monitor.id).run();
          
          monitorsScanned++;
          continue;
        }
        
        // --- 4. PDFリンクを抽出 ---
        const pdfLinks = extractPdfUrls(html, monitor.source_url);
        console.log(`[ScanPDFs] Found ${pdfLinks.length} PDF/ZIP links on ${monitor.source_name}`);
        
        // URL パターンフィルタリング
        const urlPatterns = JSON.parse(monitor.url_patterns || '[]') as string[];
        
        const matchedLinks = pdfLinks.filter(link => {
          if (urlPatterns.length === 0) return true; // パターンなし = 全PDFを対象
          return urlPatterns.some(pattern => {
            try {
              return new RegExp(pattern, 'i').test(link.url);
            } catch { return false; }
          });
        });
        
        console.log(`[ScanPDFs] ${matchedLinks.length} links match URL patterns`);
        
        // --- 5. monitored_files と照合 ---
        const monitoredFiles = await db.prepare(`
          SELECT * FROM monitored_files WHERE monitor_id = ? AND status IN ('active', 'changed')
        `).bind(monitor.id).all();
        
        for (const mf of (monitoredFiles.results || []) as any[]) {
          const pattern = new RegExp(mf.url_pattern, 'i');
          const matchingLink = matchedLinks.find(l => pattern.test(l.url));
          
          if (matchingLink) {
            if (!mf.file_url || mf.file_url !== matchingLink.url) {
              // 新規PDF検出 or URL変更
              const changeType = mf.file_url ? 'url_change' : 'new_file';
              
              console.log(`[ScanPDFs] ${changeType}: ${mf.file_name} → ${matchingLink.url}`);
              
              // file_change_history に記録
              const changeId = generateUUID();
              await db.prepare(`
                INSERT INTO file_change_history (
                  id, monitored_file_id, monitor_id, subsidy_id,
                  old_url, new_url, change_type, detected_at, process_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'pending')
              `).bind(
                changeId,
                mf.id,
                monitor.id,
                monitor.subsidy_cache_id,
                mf.file_url || mf.last_url,
                matchingLink.url,
                changeType
              ).run();
              
              // monitored_files を更新
              await db.prepare(`
                UPDATE monitored_files 
                SET file_url = ?, last_url = ?, status = 'changed',
                    last_checked_at = datetime('now'), updated_at = datetime('now')
                WHERE id = ?
              `).bind(matchingLink.url, matchingLink.url, mf.id).run();
              
              newPdfsDetected++;
              detectedPdfs.push({
                monitor_id: monitor.id,
                source_name: monitor.source_name,
                pdf_url: matchingLink.url,
                link_text: matchingLink.text || mf.file_name,
                status: changeType,
              });
              
            } else {
              // URLに変更なし
              await db.prepare(`
                UPDATE monitored_files 
                SET last_checked_at = datetime('now')
                WHERE id = ?
              `).bind(mf.id).run();
              pdfLinksUpdated++;
            }
          }
        }
        
        // --- 6. パターンに合致しないが新規のPDFリンクも検出候補として記録 ---
        const knownUrls = new Set(
          ((monitoredFiles.results || []) as any[]).map(mf => mf.file_url).filter(Boolean)
        );
        const unknownPdfs = matchedLinks.filter(l => !knownUrls.has(l.url));
        
        if (unknownPdfs.length > 0) {
          console.log(`[ScanPDFs] ${unknownPdfs.length} unknown PDFs detected on ${monitor.source_name}`);
          
          for (const unknown of unknownPdfs.slice(0, 10)) { // 最大10件
            // 自動で monitored_files に追加（importance=medium, status=changed）
            const newFileId = `MF-AUTO-${generateUUID().substring(0, 8).toUpperCase()}`;
            const fileName = decodeURIComponent(unknown.url.split('/').pop() || 'unknown.pdf');
            
            await db.prepare(`
              INSERT OR IGNORE INTO monitored_files (
                id, monitor_id, file_name, file_url, last_url, url_pattern,
                file_type, importance, status, last_checked_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'medium', 'changed', datetime('now'))
            `).bind(
              newFileId,
              monitor.id,
              unknown.text || fileName,
              unknown.url,
              unknown.url,
              fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // エスケープしたファイル名
              unknown.url.endsWith('.pdf') ? 'pdf' : 'zip'
            ).run();
            
            // 変更履歴に記録
            await db.prepare(`
              INSERT INTO file_change_history (
                id, monitored_file_id, monitor_id, subsidy_id,
                new_url, change_type, detected_at, process_status
              ) VALUES (?, ?, ?, ?, ?, 'new_file', datetime('now'), 'pending')
            `).bind(
              generateUUID(),
              newFileId,
              monitor.id,
              monitor.subsidy_cache_id,
              unknown.url
            ).run();
            
            newPdfsDetected++;
            detectedPdfs.push({
              monitor_id: monitor.id,
              source_name: monitor.source_name,
              pdf_url: unknown.url,
              link_text: unknown.text || fileName,
              status: 'auto_discovered',
            });
          }
        }
        
        // --- 7. 適応的インターバル更新 ---
        const adaptiveInterval = calculateAdaptiveInterval(
          monitor.deadline,
          monitor.check_interval_hours
        );
        
        await db.prepare(`
          UPDATE data_source_monitors 
          SET last_checked_at = datetime('now'),
              last_page_hash = ?,
              last_changed_at = CASE WHEN ? != COALESCE(last_page_hash, '') THEN datetime('now') ELSE last_changed_at END,
              check_interval_hours = ?,
              error_count = 0,
              consecutive_errors = 0,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(pageHash, pageHash, adaptiveInterval, monitor.id).run();
        
        monitorsScanned++;
        
      } catch (err) {
        const errorMsg = `${monitor.source_name}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        console.error(`[ScanPDFs] Error:`, errorMsg);
        
        await db.prepare(`
          UPDATE data_source_monitors 
          SET error_count = error_count + 1,
              consecutive_errors = consecutive_errors + 1,
              last_error = ?,
              last_error_at = datetime('now'),
              status = CASE WHEN consecutive_errors >= 5 THEN 'error' ELSE status END,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(errorMsg.substring(0, 500), monitor.id).run();
      }
    }
    
    // --- 8. 結果サマリー ---
    console.log(`[ScanPDFs] Done: scanned=${monitorsScanned}, new_pdfs=${newPdfsDetected}, updated=${pdfLinksUpdated}, errors=${errors.length}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: monitorsScanned,
        items_inserted: newPdfsDetected,
        items_updated: pdfLinksUpdated,
        error_count: errors.length,
        errors: errors.slice(0, 20),
        metadata: { detected_pdfs: detectedPdfs.slice(0, 30) },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      monitors_scanned: number;
      new_pdfs_detected: number;
      pdf_links_confirmed: number;
      detected_pdfs: typeof detectedPdfs;
      errors: string[];
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Scan complete: ${newPdfsDetected} new PDFs detected across ${monitorsScanned} sites`,
        monitors_scanned: monitorsScanned,
        new_pdfs_detected: newPdfsDetected,
        pdf_links_confirmed: pdfLinksUpdated,
        detected_pdfs: detectedPdfs,
        errors: errors.slice(0, 10),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[ScanPDFs] Fatal error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Scan failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// POST /api/cron/process-detected-pdfs
// 検出されたPDFをR2に保存し、テキスト情報を抽出
// =====================================================
pdfMonitor.post('/process-detected-pdfs', async (c) => {
  const db = c.env.DB;
  const r2 = c.env.R2_KNOWLEDGE;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'process-detected-pdfs', 'cron');
  } catch (e) {
    console.warn('[ProcessPDFs] Failed to log cron run:', e);
  }
  
  const errors: string[] = [];
  let processed = 0;
  let saved = 0;
  let skipped = 0;
  const processedFiles: Array<{file_name: string; pdf_url: string; r2_key: string; size_bytes: number}> = [];
  
  try {
    // 未処理の変更履歴を取得（新しいPDFのみ）
    const pendingChanges = await db.prepare(`
      SELECT 
        fch.*,
        mf.file_name,
        mf.file_type,
        mf.importance,
        dsm.subsidy_cache_id,
        dsm.source_name
      FROM file_change_history fch
      JOIN monitored_files mf ON mf.id = fch.monitored_file_id
      JOIN data_source_monitors dsm ON dsm.id = fch.monitor_id
      WHERE fch.process_status = 'pending'
        AND fch.new_url IS NOT NULL
        AND fch.new_url LIKE '%.pdf'
      ORDER BY 
        CASE mf.importance 
          WHEN 'critical' THEN 0 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END,
        fch.detected_at ASC
      LIMIT 5
    `).all();
    
    console.log(`[ProcessPDFs] Found ${pendingChanges.results?.length || 0} pending PDF changes`);
    
    for (const change of (pendingChanges.results || []) as any[]) {
      try {
        console.log(`[ProcessPDFs] Processing: ${change.file_name} → ${change.new_url}`);
        
        // ステータスを processing に更新
        await db.prepare(`
          UPDATE file_change_history SET process_status = 'processing', processed_at = datetime('now') WHERE id = ?
        `).bind(change.id).run();
        
        // PDFをダウンロード
        const pdfResponse = await fetch(change.new_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/pdf,*/*',
          },
          redirect: 'follow',
        });
        
        if (!pdfResponse.ok) {
          throw new Error(`PDF download failed: HTTP ${pdfResponse.status}`);
        }
        
        const pdfBuffer = await pdfResponse.arrayBuffer();
        const pdfSize = pdfBuffer.byteLength;
        
        if (pdfSize < 100) {
          throw new Error(`PDF too small (${pdfSize} bytes) - likely not a real PDF`);
        }
        
        // R2に保存
        const subsidyId = change.subsidy_cache_id || 'unlinked';
        const fileName = change.new_url.split('/').pop() || 'document.pdf';
        const r2Key = `pdf/${subsidyId}/${fileName}`;
        
        await r2.put(r2Key, pdfBuffer, {
          customMetadata: {
            source_url: change.new_url,
            file_name: change.file_name,
            monitor_id: change.monitor_id || '',
            detected_at: new Date().toISOString(),
            subsidy_id: subsidyId,
          },
        });
        
        // コンテンツハッシュ計算
        const hashArray = Array.from(new Uint8Array(
          await crypto.subtle.digest('SHA-256', pdfBuffer)
        ));
        const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
        
        // 処理完了を記録
        await db.prepare(`
          UPDATE file_change_history 
          SET process_status = 'processed',
              new_content_hash = ?,
              new_size = ?,
              process_result = ?,
              processed_at = datetime('now')
          WHERE id = ?
        `).bind(
          contentHash,
          pdfSize,
          JSON.stringify({ r2_key: r2Key, size_bytes: pdfSize, content_hash: contentHash }),
          change.id
        ).run();
        
        // monitored_files を更新
        await db.prepare(`
          UPDATE monitored_files 
          SET last_content_hash = ?, last_size = ?, status = 'active', updated_at = datetime('now')
          WHERE id = ?
        `).bind(contentHash, pdfSize, change.monitored_file_id).run();
        
        // update_detection_log に記録（subsidy_cache_id がある場合）
        if (change.subsidy_cache_id) {
          await db.prepare(`
            INSERT INTO update_detection_log (
              id, subsidy_id, source_url, source_type,
              new_content_hash, changes_detected,
              change_summary, status
            ) VALUES (?, ?, ?, 'pdf', ?, ?, ?, 'pending')
          `).bind(
            generateUUID(),
            change.subsidy_cache_id,
            change.new_url,
            contentHash,
            JSON.stringify(['pdf_updated']),
            `${change.file_name}が更新されました（${(pdfSize / 1024).toFixed(1)}KB）。R2: ${r2Key}`
          ).run();
        }
        
        saved++;
        processedFiles.push({
          file_name: change.file_name,
          pdf_url: change.new_url,
          r2_key: r2Key,
          size_bytes: pdfSize,
        });
        
        console.log(`[ProcessPDFs] Saved to R2: ${r2Key} (${(pdfSize / 1024).toFixed(1)}KB)`);
        
      } catch (err) {
        const errorMsg = `${change.file_name}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        console.error(`[ProcessPDFs] Error:`, errorMsg);
        
        await db.prepare(`
          UPDATE file_change_history 
          SET process_status = 'error',
              process_result = ?,
              processed_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify({ error: errorMsg }), change.id).run();
      }
      
      processed++;
    }
    
    console.log(`[ProcessPDFs] Done: processed=${processed}, saved=${saved}, errors=${errors.length}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: processed,
        items_inserted: saved,
        items_skipped: skipped,
        error_count: errors.length,
        errors: errors.slice(0, 20),
        metadata: { processed_files: processedFiles },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      processed: number;
      saved_to_r2: number;
      processed_files: typeof processedFiles;
      errors: string[];
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Processed ${processed} PDFs, saved ${saved} to R2`,
        processed,
        saved_to_r2: saved,
        processed_files: processedFiles,
        errors: errors.slice(0, 10),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[ProcessPDFs] Fatal error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Processing failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// GET /api/cron/monitor-dashboard
// 監視状況ダッシュボード用データ（認証不要 = 読み取り専用）
// =====================================================
pdfMonitor.get('/monitor-dashboard', async (c) => {
  const db = c.env.DB;
  
  try {
    // 1. 監視対象サマリー
    const monitorSummary = await db.prepare(`
      SELECT 
        dsm.id,
        dsm.source_name,
        dsm.source_url,
        dsm.status,
        dsm.check_interval_hours,
        dsm.last_checked_at,
        dsm.last_changed_at,
        dsm.consecutive_errors,
        dsm.last_error,
        dsm.subsidy_cache_id,
        sc.title as subsidy_title,
        sc.acceptance_end_datetime as deadline,
        (SELECT COUNT(*) FROM monitored_files WHERE monitor_id = dsm.id) as file_count,
        (SELECT COUNT(*) FROM monitored_files WHERE monitor_id = dsm.id AND status = 'changed') as changed_count,
        (SELECT COUNT(*) FROM file_change_history WHERE monitor_id = dsm.id AND process_status = 'pending') as pending_count
      FROM data_source_monitors dsm
      LEFT JOIN subsidy_cache sc ON sc.id = dsm.subsidy_cache_id
      ORDER BY 
        CASE dsm.status WHEN 'active' THEN 0 WHEN 'error' THEN 1 ELSE 2 END,
        dsm.last_checked_at DESC
    `).all();
    
    // 2. 最近の変更検出
    const recentChanges = await db.prepare(`
      SELECT 
        fch.id,
        fch.change_type,
        fch.old_url,
        fch.new_url,
        fch.detected_at,
        fch.process_status,
        fch.new_size,
        mf.file_name,
        mf.importance,
        dsm.source_name,
        dsm.subsidy_cache_id
      FROM file_change_history fch
      JOIN monitored_files mf ON mf.id = fch.monitored_file_id
      JOIN data_source_monitors dsm ON dsm.id = fch.monitor_id
      ORDER BY fch.detected_at DESC
      LIMIT 30
    `).all();
    
    // 3. 全体統計
    const stats = await db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM data_source_monitors WHERE status = 'active') as active_monitors,
        (SELECT COUNT(*) FROM data_source_monitors WHERE status = 'error') as error_monitors,
        (SELECT COUNT(*) FROM monitored_files WHERE status = 'active') as active_files,
        (SELECT COUNT(*) FROM monitored_files WHERE status = 'changed') as changed_files,
        (SELECT COUNT(*) FROM file_change_history WHERE process_status = 'pending') as pending_processing,
        (SELECT COUNT(*) FROM file_change_history WHERE process_status = 'processed') as total_processed,
        (SELECT COUNT(*) FROM file_change_history WHERE detected_at > datetime('now', '-24 hours')) as changes_24h,
        (SELECT MAX(last_checked_at) FROM data_source_monitors) as last_scan_time
    `).first();
    
    return c.json<ApiResponse<{
      monitors: any[];
      recent_changes: any[];
      stats: any;
    }>>({
      success: true,
      data: {
        monitors: monitorSummary.results as any[],
        recent_changes: recentChanges.results as any[],
        stats,
      },
    });
    
  } catch (error) {
    console.error('[MonitorDashboard] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Dashboard data failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// POST /api/cron/force-scan-single
// 特定のmonitor_idを即座にスキャン（デバッグ/手動用）
// =====================================================
pdfMonitor.post('/force-scan-single', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  try {
    const body = await c.req.json();
    const { monitor_id } = body as { monitor_id: string };
    
    if (!monitor_id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'monitor_id is required' },
      }, 400);
    }
    
    // last_checked_at をNULLに戻して強制チェック対象にする
    const result = await db.prepare(`
      UPDATE data_source_monitors 
      SET last_checked_at = NULL
      WHERE id = ?
    `).bind(monitor_id).run();
    
    if (result.meta.changes === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: `Monitor not found: ${monitor_id}` },
      }, 404);
    }
    
    return c.json<ApiResponse<{ message: string; monitor_id: string }>>({
      success: true,
      data: {
        message: `Monitor ${monitor_id} queued for immediate scan. Call /scan-subsidy-pdfs to execute.`,
        monitor_id,
      },
    });
    
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Force scan failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

export default pdfMonitor;

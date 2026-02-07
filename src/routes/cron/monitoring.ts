/**
 * Cron: データソース監視 (P4/P5)
 * 
 * POST /check-updates   - データソース更新チェック
 * POST /monitor-status  - 監視ステータス取得
 * POST /approve-update  - 更新承認/却下
 * POST /add-monitor     - 監視対象追加
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';
import { simpleScrape, calculateContentHash } from '../../services/firecrawl';

const monitoring = new Hono<{ Bindings: Env; Variables: Variables }>();

monitoring.post('/check-updates', async (c) => {
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
  
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'check-updates', 'cron');
  } catch (logErr) {
    console.warn('[CheckUpdates] Failed to start cron_run log:', logErr);
  }
  
  const errors: string[] = [];
  let monitorsChecked = 0;
  let changesDetected = 0;
  const changedFiles: Array<{ monitor_id: string; file_name: string; change_type: string }> = [];
  
  try {
    // アクティブな監視対象を取得（最後のチェックから指定時間経過したもの）
    const monitors = await db.prepare(`
      SELECT * FROM data_source_monitors 
      WHERE status = 'active'
      AND (last_checked_at IS NULL OR 
           datetime(last_checked_at, '+' || check_interval_hours || ' hours') < datetime('now'))
      ORDER BY last_checked_at ASC
      LIMIT 10
    `).all();
    
    console.log(`[CheckUpdates] Found ${monitors.results?.length || 0} monitors to check`);
    
    for (const monitor of (monitors.results || []) as any[]) {
      try {
        console.log(`[CheckUpdates] Checking: ${monitor.source_name} (${monitor.source_url})`);
        
        // ページを取得
        const response = await fetch(monitor.source_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HojyorakuBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // ページ全体のハッシュを計算
        const pageHash = await calculateSimpleHash(html);
        
        // ページハッシュが変わっていない場合はスキップ
        if (monitor.last_page_hash === pageHash) {
          console.log(`[CheckUpdates] No page changes for ${monitor.source_name}`);
          await db.prepare(`
            UPDATE data_source_monitors SET last_checked_at = datetime('now'), error_count = 0, consecutive_errors = 0
            WHERE id = ?
          `).bind(monitor.id).run();
          monitorsChecked++;
          continue;
        }
        
        // URLパターンに基づいてファイルURLを抽出
        const urlPatterns = JSON.parse(monitor.url_patterns || '[]');
        const extractedUrls = extractUrlsFromHtml(html, urlPatterns, monitor.source_url);
        
        console.log(`[CheckUpdates] Extracted ${extractedUrls.length} URLs matching patterns`);
        
        // 監視対象ファイルを取得
        const monitoredFiles = await db.prepare(`
          SELECT * FROM monitored_files WHERE monitor_id = ? AND status = 'active'
        `).bind(monitor.id).all();
        
        for (const file of (monitoredFiles.results || []) as any[]) {
          const pattern = new RegExp(file.url_pattern);
          const matchingUrl = extractedUrls.find(u => pattern.test(u));
          
          if (matchingUrl && matchingUrl !== file.last_url) {
            // URL変更を検出
            console.log(`[CheckUpdates] URL change detected for ${file.file_name}: ${file.last_url} -> ${matchingUrl}`);
            
            // ファイル変更履歴に記録
            const changeId = generateUUID();
            await db.prepare(`
              INSERT INTO file_change_history (
                id, monitored_file_id, monitor_id, subsidy_id,
                old_url, new_url, change_type, detected_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'url_change', datetime('now'))
            `).bind(
              changeId,
              file.id,
              monitor.id,
              monitor.subsidy_cache_id,
              file.last_url,
              matchingUrl
            ).run();
            
            // 監視対象ファイルを更新
            await db.prepare(`
              UPDATE monitored_files 
              SET last_url = ?, file_url = ?, status = 'changed', last_checked_at = datetime('now'), updated_at = datetime('now')
              WHERE id = ?
            `).bind(matchingUrl, matchingUrl, file.id).run();
            
            changesDetected++;
            changedFiles.push({
              monitor_id: monitor.id,
              file_name: file.file_name,
              change_type: 'url_change',
            });
            
            // 更新検出ログに記録
            await db.prepare(`
              INSERT INTO update_detection_log (
                id, subsidy_id, source_url, source_type,
                old_content_hash, new_content_hash, 
                changes_detected, change_summary, status
              ) VALUES (?, ?, ?, 'webpage', ?, ?, ?, ?, 'pending')
            `).bind(
              generateUUID(),
              monitor.subsidy_cache_id,
              monitor.source_url,
              file.last_url,
              matchingUrl,
              JSON.stringify(['file_url']),
              `${file.file_name}のURLが変更されました: ${file.last_url} → ${matchingUrl}`
            ).run();
          } else if (!matchingUrl && file.last_url) {
            // ファイルが見つからなくなった
            console.log(`[CheckUpdates] File missing: ${file.file_name}`);
            await db.prepare(`
              UPDATE monitored_files SET status = 'missing', updated_at = datetime('now') WHERE id = ?
            `).bind(file.id).run();
          }
        }
        
        // 監視ステータス更新
        await db.prepare(`
          UPDATE data_source_monitors 
          SET last_checked_at = datetime('now'), 
              last_page_hash = ?,
              error_count = 0,
              consecutive_errors = 0,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(pageHash, monitor.id).run();
        
        monitorsChecked++;
        
      } catch (err) {
        const errorMsg = `Monitor ${monitor.id}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        console.error(`[CheckUpdates] Error:`, errorMsg);
        
        // エラーカウント更新
        await db.prepare(`
          UPDATE data_source_monitors 
          SET error_count = error_count + 1,
              consecutive_errors = consecutive_errors + 1,
              last_error = ?,
              last_error_at = datetime('now'),
              status = CASE WHEN consecutive_errors >= 3 THEN 'error' ELSE status END,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(errorMsg, monitor.id).run();
      }
    }
    
    // Slack通知（変更があった場合）
    if (changesDetected > 0) {
      const slackWebhook = (c.env as any).SLACK_WEBHOOK_URL;
      if (slackWebhook) {
        try {
          const message = {
            text: `📋 公募要領変更検出: ${changesDetected}件`,
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: '📋 公募要領変更検出' },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: changedFiles.map(f => `• *${f.file_name}*: ${f.change_type}`).join('\n'),
                },
              },
              {
                type: 'context',
                elements: [
                  { type: 'mrkdwn', text: `検出日時: ${new Date().toISOString()}` },
                ],
              },
            ],
          };
          await fetch(slackWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
          });
          console.log('[CheckUpdates] Slack notification sent');
        } catch (slackErr) {
          console.error('[CheckUpdates] Slack notification failed:', slackErr);
        }
      }
    }
    
    console.log(`[CheckUpdates] Completed: checked=${monitorsChecked}, changes=${changesDetected}, errors=${errors.length}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: monitorsChecked,
        items_updated: changesDetected,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: { changed_files: changedFiles },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      monitors_checked: number;
      changes_detected: number;
      changed_files: Array<{ monitor_id: string; file_name: string; change_type: string }>;
      errors: string[];
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Update check completed',
        monitors_checked: monitorsChecked,
        changes_detected: changesDetected,
        changed_files: changedFiles,
        errors: errors.slice(0, 10),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[CheckUpdates] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Update check failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

/**
 * 簡易ハッシュ計算（ページ変更検出用）
 */
async function calculateSimpleHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * HTMLからURLを抽出（パターンマッチ）
 */
function extractUrlsFromHtml(html: string, patterns: string[], baseUrl: string): string[] {
  const urls: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    let url = match[1];
    
    // 相対URLを絶対URLに変換
    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      url = `${base.protocol}//${base.host}${url}`;
    } else if (!url.startsWith('http')) {
      continue; // 相対パスは無視
    }
    
    // パターンマッチング
    for (const pattern of patterns) {
      try {
        if (new RegExp(pattern).test(url)) {
          urls.push(url);
          break;
        }
      } catch (e) {
        // 無効な正規表現は無視
      }
    }
  }
  
  return [...new Set(urls)]; // 重複除去
}

// =====================================================
// P5: データソース監視 - 手動チェック
// =====================================================

/**
 * POST /api/cron/monitor-status
 * 
 * 監視状態のサマリーを取得
 */
monitoring.post('/monitor-status', async (c) => {
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
  
  try {
    // 監視対象サマリー
    const monitorSummary = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM data_source_monitors
      GROUP BY status
    `).all();
    
    // 最近の変更
    const recentChanges = await db.prepare(`
      SELECT 
        fch.id,
        fch.change_type,
        fch.old_url,
        fch.new_url,
        fch.detected_at,
        fch.process_status,
        mf.file_name,
        dsm.source_name
      FROM file_change_history fch
      JOIN monitored_files mf ON mf.id = fch.monitored_file_id
      JOIN data_source_monitors dsm ON dsm.id = fch.monitor_id
      ORDER BY fch.detected_at DESC
      LIMIT 20
    `).all();
    
    // 保留中の更新
    const pendingUpdates = await db.prepare(`
      SELECT 
        pu.id,
        pu.field_name,
        pu.old_value,
        pu.new_value,
        pu.status,
        pu.created_at,
        sc.title as subsidy_title
      FROM pending_updates pu
      LEFT JOIN subsidy_cache sc ON sc.id = pu.subsidy_id
      WHERE pu.status = 'pending'
      ORDER BY pu.created_at DESC
      LIMIT 20
    `).all();
    
    // エラー状態の監視対象
    const errorMonitors = await db.prepare(`
      SELECT id, source_name, source_url, last_error, last_error_at, consecutive_errors
      FROM data_source_monitors
      WHERE status = 'error' OR consecutive_errors > 0
      ORDER BY consecutive_errors DESC
      LIMIT 10
    `).all();
    
    return c.json<ApiResponse<{
      summary: { status: string; count: number }[];
      recent_changes: any[];
      pending_updates: any[];
      error_monitors: any[];
    }>>({
      success: true,
      data: {
        summary: monitorSummary.results as any[],
        recent_changes: recentChanges.results as any[],
        pending_updates: pendingUpdates.results as any[],
        error_monitors: errorMonitors.results as any[],
      },
    });
    
  } catch (error) {
    console.error('[MonitorStatus] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Failed to get monitor status: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

/**
 * POST /api/cron/approve-update
 * 
 * 保留中の更新を承認/却下
 */
monitoring.post('/approve-update', async (c) => {
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
  
  try {
    const body = await c.req.json();
    const { update_id, action, notes } = body as { update_id: string; action: 'approve' | 'reject'; notes?: string };
    
    if (!update_id || !action) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'update_id and action are required' },
      }, 400);
    }
    
    // 更新を取得
    const update = await db.prepare(`
      SELECT * FROM pending_updates WHERE id = ?
    `).bind(update_id).first();
    
    if (!update) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Update not found' },
      }, 404);
    }
    
    if (action === 'approve') {
      // subsidy_cache を更新
      const subsidy = await db.prepare(`
        SELECT detail_json FROM subsidy_cache WHERE id = ?
      `).bind((update as any).subsidy_id).first<{ detail_json: string }>();
      
      if (subsidy && subsidy.detail_json) {
        try {
          const detail = JSON.parse(subsidy.detail_json);
          // フィールドパスに基づいて更新
          const fieldPath = (update as any).field_path.split('.');
          let current = detail;
          for (let i = 0; i < fieldPath.length - 1; i++) {
            if (!current[fieldPath[i]]) current[fieldPath[i]] = {};
            current = current[fieldPath[i]];
          }
          current[fieldPath[fieldPath.length - 1]] = JSON.parse((update as any).new_value);
          
          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ?, updated_at = datetime('now') WHERE id = ?
          `).bind(JSON.stringify(detail), (update as any).subsidy_id).run();
        } catch (e) {
          console.error('[ApproveUpdate] Failed to apply update:', e);
        }
      }
      
      // ステータス更新
      await db.prepare(`
        UPDATE pending_updates 
        SET status = 'approved', reviewed_at = datetime('now'), review_notes = ?
        WHERE id = ?
      `).bind(notes || null, update_id).run();
      
    } else {
      // 却下
      await db.prepare(`
        UPDATE pending_updates 
        SET status = 'rejected', reviewed_at = datetime('now'), review_notes = ?
        WHERE id = ?
      `).bind(notes || null, update_id).run();
    }
    
    return c.json<ApiResponse<{ message: string; action: string }>>({
      success: true,
      data: {
        message: `Update ${action === 'approve' ? 'approved' : 'rejected'}`,
        action,
      },
    });
    
  } catch (error) {
    console.error('[ApproveUpdate] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Failed to process update: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

/**
 * POST /api/cron/add-monitor
 * 
 * 新しい監視対象を追加
 */
monitoring.post('/add-monitor', async (c) => {
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
  
  try {
    const body = await c.req.json();
    const {
      subsidy_cache_id,
      source_name,
      source_url,
      url_patterns,
      files,
    } = body as {
      subsidy_cache_id: string;
      source_name: string;
      source_url: string;
      url_patterns: string[];
      files?: Array<{ file_name: string; url_pattern: string; file_type: string; importance?: string }>;
    };
    
    if (!source_name || !source_url) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'source_name and source_url are required' },
      }, 400);
    }
    
    const monitorId = `MONITOR-${generateUUID().substring(0, 8).toUpperCase()}`;
    
    // 監視対象を追加
    await db.prepare(`
      INSERT INTO data_source_monitors (
        id, subsidy_cache_id, source_name, source_url, monitor_type,
        check_interval_hours, url_patterns, status
      ) VALUES (?, ?, ?, ?, 'webpage', 24, ?, 'active')
    `).bind(
      monitorId,
      subsidy_cache_id || null,
      source_name,
      source_url,
      JSON.stringify(url_patterns || [])
    ).run();
    
    // 監視対象ファイルを追加
    if (files && files.length > 0) {
      for (const file of files) {
        await db.prepare(`
          INSERT INTO monitored_files (
            id, monitor_id, file_name, url_pattern, file_type, importance, status
          ) VALUES (?, ?, ?, ?, ?, ?, 'active')
        `).bind(
          `MF-${generateUUID().substring(0, 8).toUpperCase()}`,
          monitorId,
          file.file_name,
          file.url_pattern,
          file.file_type,
          file.importance || 'high'
        ).run();
      }
    }
    
    return c.json<ApiResponse<{ message: string; monitor_id: string }>>({
      success: true,
      data: {
        message: 'Monitor added successfully',
        monitor_id: monitorId,
      },
    });
    
  } catch (error) {
    console.error('[AddMonitor] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Failed to add monitor: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});


export default monitoring;

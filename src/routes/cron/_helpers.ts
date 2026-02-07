/**
 * Cron共通ヘルパー関数
 * 
 * cron配下の全モジュールが使用するユーティリティ
 */

import type { Env, Variables, ApiResponse } from '../../types';

/**
 * UUID v4 生成
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Cron実行ログを開始
 */
export async function startCronRun(
  db: D1Database,
  jobType: string,
  triggeredBy: 'cron' | 'manual' | 'api' = 'cron'
): Promise<string> {
  const runId = generateUUID();
  await db.prepare(`
    INSERT INTO cron_runs (run_id, job_type, status, triggered_by)
    VALUES (?, ?, 'running', ?)
  `).bind(runId, jobType, triggeredBy).run();
  return runId;
}

/**
 * Cron実行ログを完了
 */
export async function finishCronRun(
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
    stats.errors ? JSON.stringify(stats.errors.slice(0, 100)) : null,
    stats.metadata ? JSON.stringify(stats.metadata) : null,
    runId
  ).run();
}

/**
 * CRON_SECRET 検証（P2-0 安全ゲート）
 */
export function verifyCronSecret(c: any): { valid: boolean; error?: { code: string; message: string; status: number } } {
  const cronSecret = c.req.header('X-Cron-Secret');
  const expectedSecret = (c.env as any).CRON_SECRET;
  
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
 * 簡易ハッシュ計算（ページ変更検出用）
 */
export async function calculateSimpleHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * HTMLからURLを抽出（パターンマッチ）
 */
export function extractUrlsFromHtml(html: string, patterns: string[], baseUrl: string): string[] {
  const urls: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    let url = match[1];
    
    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      url = `${base.protocol}//${base.host}${url}`;
    } else if (!url.startsWith('http')) {
      continue;
    }
    
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
  
  return [...new Set(urls)];
}

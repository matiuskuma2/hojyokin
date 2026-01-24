/**
 * PDF抽出失敗の記録（A-3の一部）
 * 
 * 失敗分類（凍結仕様）:
 * 1. FETCH_FAILED: HTTP/403/404/timeout - HTMLまたはPDFの取得失敗
 * 2. PARSE_FAILED: PDF解析失敗 - PDFテキスト抽出エラー
 * 3. FORMS_NOT_FOUND: forms < 2 - 様式が見つからない
 * 4. FIELDS_INSUFFICIENT: fields < 3 - 記載項目が足りない
 * 
 * feed_failures テーブルに記録され、super_admin で潰せる順に表示される。
 */

// --- 型定義 ---
export type PdfFailureReason = 
  | 'FETCH_FAILED'
  | 'PARSE_FAILED'
  | 'FORMS_NOT_FOUND'
  | 'FIELDS_INSUFFICIENT';

export type PdfFailureStage = 
  | 'discover'    // URL発見フェーズ
  | 'detail'      // 詳細取得フェーズ
  | 'pdf'         // PDF抽出フェーズ
  | 'extract'     // データ抽出フェーズ
  | 'validation'; // 品質検証フェーズ

export type PdfFailureRecord = {
  subsidyId: string;
  sourceId: string;
  url: string;
  stage: PdfFailureStage;
  reason: PdfFailureReason;
  errorType: string;      // より詳細なエラータイプ
  message: string;
  httpStatus?: number;
  retryCount: number;
  firstOccurredAt: string; // ISO datetime
  lastOccurredAt: string;  // ISO datetime
  affectedCount: number;   // 影響件数（同一URLの場合）
};

// --- 優先度マッピング（凍結仕様）---
export const FAILURE_PRIORITY: Record<PdfFailureReason, number> = {
  'FETCH_FAILED': 1,          // 最優先で潰す（HTTP/timeout）
  'PARSE_FAILED': 2,          // PDFが壊れている可能性
  'FORMS_NOT_FOUND': 3,       // 様式が見つからない
  'FIELDS_INSUFFICIENT': 4,   // 項目不足
};

export const FAILURE_LABELS: Record<PdfFailureReason, string> = {
  'FETCH_FAILED': 'HTTP/取得失敗',
  'PARSE_FAILED': 'PDF解析失敗',
  'FORMS_NOT_FOUND': '様式未検出',
  'FIELDS_INSUFFICIENT': '項目不足',
};

// --- DB操作 ---

/**
 * 失敗を feed_failures テーブルに記録
 */
export async function recordPdfFailure(
  env: { DB: D1Database },
  failure: Omit<PdfFailureRecord, 'firstOccurredAt' | 'lastOccurredAt' | 'retryCount' | 'affectedCount'>
): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    // UPSERT: 同一 subsidyId + url + stage の場合は更新
    await env.DB.prepare(`
      INSERT INTO feed_failures (
        subsidy_id, source_id, url, stage, error_type, message,
        http_status, retry_count, first_occurred_at, last_occurred_at,
        status, affected_count, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'open', 1, ?)
      ON CONFLICT (subsidy_id, url, stage) DO UPDATE SET
        error_type = excluded.error_type,
        message = excluded.message,
        http_status = excluded.http_status,
        retry_count = retry_count + 1,
        last_occurred_at = excluded.last_occurred_at,
        status = 'open'
    `).bind(
      failure.subsidyId,
      failure.sourceId,
      failure.url,
      failure.stage,
      failure.reason, // error_type として保存
      failure.message,
      failure.httpStatus || null,
      now,
      now,
      FAILURE_PRIORITY[failure.reason]
    ).run();
  } catch (e: any) {
    console.error('[recordPdfFailure] Failed to record failure:', e.message);
    // 記録失敗はログのみで握りつぶす（メイン処理を止めない）
  }
}

/**
 * 成功時に feed_failures を resolved にする
 */
export async function resolvePdfFailure(
  env: { DB: D1Database },
  subsidyId: string,
  url: string,
  stage: PdfFailureStage
): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    await env.DB.prepare(`
      UPDATE feed_failures 
      SET status = 'resolved', resolved_at = ?
      WHERE subsidy_id = ? AND url = ? AND stage = ? AND status = 'open'
    `).bind(now, subsidyId, url, stage).run();
  } catch (e: any) {
    console.error('[resolvePdfFailure] Failed to resolve failure:', e.message);
  }
}

/**
 * バッチで失敗を記録
 */
export async function recordPdfFailuresBatch(
  env: { DB: D1Database },
  failures: Array<Omit<PdfFailureRecord, 'firstOccurredAt' | 'lastOccurredAt' | 'retryCount' | 'affectedCount'>>
): Promise<{ recorded: number; errors: number }> {
  let recorded = 0;
  let errors = 0;
  
  for (const failure of failures) {
    try {
      await recordPdfFailure(env, failure);
      recorded++;
    } catch {
      errors++;
    }
  }
  
  return { recorded, errors };
}

/**
 * 失敗一覧を取得（優先度順）
 */
export async function getPdfFailures(
  env: { DB: D1Database },
  options: {
    status?: 'open' | 'resolved' | 'ignored';
    sourceId?: string;
    reason?: PdfFailureReason;
    limit?: number;
    offset?: number;
  } = {}
): Promise<PdfFailureRecord[]> {
  const { status = 'open', sourceId, reason, limit = 50, offset = 0 } = options;
  
  let query = `
    SELECT 
      subsidy_id as subsidyId,
      source_id as sourceId,
      url,
      stage,
      error_type as reason,
      error_type as errorType,
      message,
      http_status as httpStatus,
      retry_count as retryCount,
      first_occurred_at as firstOccurredAt,
      last_occurred_at as lastOccurredAt,
      affected_count as affectedCount
    FROM feed_failures
    WHERE status = ?
  `;
  
  const params: any[] = [status];
  
  if (sourceId) {
    query += ` AND source_id = ?`;
    params.push(sourceId);
  }
  
  if (reason) {
    query += ` AND error_type = ?`;
    params.push(reason);
  }
  
  query += ` ORDER BY priority ASC, last_occurred_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  try {
    const result = await env.DB.prepare(query).bind(...params).all<PdfFailureRecord>();
    return result.results || [];
  } catch (e: any) {
    console.error('[getPdfFailures] Query failed:', e.message);
    return [];
  }
}

/**
 * 失敗の集計を取得
 */
export async function getPdfFailuresSummary(
  env: { DB: D1Database },
  status: 'open' | 'resolved' | 'ignored' = 'open'
): Promise<{
  total: number;
  byReason: Record<PdfFailureReason, number>;
  bySource: Record<string, number>;
}> {
  const byReason: Record<PdfFailureReason, number> = {
    FETCH_FAILED: 0,
    PARSE_FAILED: 0,
    FORMS_NOT_FOUND: 0,
    FIELDS_INSUFFICIENT: 0,
  };
  
  const bySource: Record<string, number> = {};
  
  try {
    // 理由別集計
    const reasonResult = await env.DB.prepare(`
      SELECT error_type as reason, COUNT(*) as count
      FROM feed_failures
      WHERE status = ?
      GROUP BY error_type
    `).bind(status).all<{ reason: PdfFailureReason; count: number }>();
    
    for (const row of reasonResult.results || []) {
      if (row.reason in byReason) {
        byReason[row.reason] = row.count;
      }
    }
    
    // ソース別集計
    const sourceResult = await env.DB.prepare(`
      SELECT source_id as source, COUNT(*) as count
      FROM feed_failures
      WHERE status = ?
      GROUP BY source_id
    `).bind(status).all<{ source: string; count: number }>();
    
    for (const row of sourceResult.results || []) {
      bySource[row.source] = row.count;
    }
    
    const total = Object.values(byReason).reduce((a, b) => a + b, 0);
    
    return { total, byReason, bySource };
  } catch (e: any) {
    console.error('[getPdfFailuresSummary] Query failed:', e.message);
    return { total: 0, byReason, bySource };
  }
}

/**
 * 失敗を無視（ignore）に設定
 */
export async function ignorePdfFailure(
  env: { DB: D1Database },
  subsidyId: string,
  url: string,
  stage: PdfFailureStage
): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    await env.DB.prepare(`
      UPDATE feed_failures 
      SET status = 'ignored', resolved_at = ?
      WHERE subsidy_id = ? AND url = ? AND stage = ?
    `).bind(now, subsidyId, url, stage).run();
  } catch (e: any) {
    console.error('[ignorePdfFailure] Failed:', e.message);
  }
}

/**
 * 失敗をリトライ対象に戻す
 */
export async function reopenPdfFailure(
  env: { DB: D1Database },
  subsidyId: string,
  url: string,
  stage: PdfFailureStage
): Promise<void> {
  try {
    await env.DB.prepare(`
      UPDATE feed_failures 
      SET status = 'open', resolved_at = NULL
      WHERE subsidy_id = ? AND url = ? AND stage = ?
    `).bind(subsidyId, url, stage).run();
  } catch (e: any) {
    console.error('[reopenPdfFailure] Failed:', e.message);
  }
}

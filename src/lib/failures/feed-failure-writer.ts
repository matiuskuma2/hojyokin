/**
 * feed-failure-writer.ts - feed_failures に "運用上の障害" を安全に記録
 * 
 * 循環import回避のため、pdf-failures.ts とは別ファイルに切り出し
 * 
 * 用途:
 *   - CostGuard（DB欠如による外部API呼び出しブロック）の記録
 *   - その他の運用障害の記録
 * 
 * 凍結ルール:
 *   - Freeze-3: Cron失敗は feed_failures に必ず落とす（運用で見える化）
 */

export interface CostGuardFailureArgs {
  subsidy_id: string;
  source_id: string;
  url: string;
  stage: string;   // 'pdf' | 'extract' | 'discover' など
  message: string; // 500文字以内推奨
}

/**
 * CostGuard 発生時に feed_failures へ記録
 * 
 * @param db - D1Database インスタンス
 * @param args - 記録する障害情報
 */
export async function recordCostGuardFailure(
  db: D1Database,
  args: CostGuardFailureArgs
): Promise<void> {
  const now = new Date().toISOString();

  // feed_failures.error_type CHECK制約に準拠: 'db'
  const error_type = 'db';

  try {
    await db.prepare(`
      INSERT INTO feed_failures (
        subsidy_id, source_id, url, stage, error_type, error_message,
        retry_count, occurred_at, last_retry_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'open')
      ON CONFLICT (subsidy_id, url, stage) DO UPDATE SET
        error_type = excluded.error_type,
        error_message = excluded.error_message,
        retry_count = feed_failures.retry_count + 1,
        last_retry_at = excluded.last_retry_at,
        status = 'open'
    `).bind(
      args.subsidy_id,
      args.source_id,
      args.url,
      args.stage,
      error_type,
      (args.message ?? '').slice(0, 500),
      now,
      now
    ).run();
  } catch (e) {
    // ここで throw すると本処理が止まるのでログだけ
    console.warn('[recordCostGuardFailure] failed:', e);
  }
}

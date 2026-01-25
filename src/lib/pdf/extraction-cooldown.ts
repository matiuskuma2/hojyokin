/**
 * 抽出クールダウン管理
 * 
 * 同じ補助金に対して短時間で Firecrawl / Vision OCR が連発して
 * 課金されることを防ぐ。
 * 
 * 凍結仕様:
 * - Firecrawl: 直近6時間に1回でも実行していたらスキップ
 * - Vision OCR: 直近24時間に1回でも実行していたらスキップ
 * - HTML: 常にOK（最安なのでcooldown対象外）
 * 
 * 注意: success/failed問わず「実行された」こと自体で抑止する（課金防止が目的）
 */

export type ExtractionMethod = 'html' | 'firecrawl' | 'vision_ocr' | 'none';

export type CooldownPolicy = {
  firecrawlHours: number; // デフォルト: 6
  visionHours: number;    // デフォルト: 24
};

export const DEFAULT_COOLDOWN_POLICY: CooldownPolicy = {
  firecrawlHours: 6,
  visionHours: 24,
};

export type CooldownResult = {
  allowFirecrawl: boolean;
  allowVision: boolean;
  firecrawlBlockedReason?: string;
  visionBlockedReason?: string;
  firecrawlLastAttempt?: string;
  visionLastAttempt?: string;
};

/**
 * extraction_logs をチェックして cooldown 状態を判定
 */
export async function checkCooldown(
  db: D1Database,
  subsidyId: string,
  policy: CooldownPolicy = DEFAULT_COOLDOWN_POLICY
): Promise<CooldownResult> {
  try {
    // Firecrawl の最終実行日時を取得
    const firecrawlRow = await db.prepare(`
      SELECT created_at, success
      FROM extraction_logs
      WHERE subsidy_id = ?
        AND extraction_method = 'firecrawl'
        AND created_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(subsidyId, policy.firecrawlHours).first<{ created_at: string; success: number }>();

    // Vision OCR の最終実行日時を取得
    const visionRow = await db.prepare(`
      SELECT created_at, success
      FROM extraction_logs
      WHERE subsidy_id = ?
        AND extraction_method = 'vision_ocr'
        AND created_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(subsidyId, policy.visionHours).first<{ created_at: string; success: number }>();

    const allowFirecrawl = !firecrawlRow;
    const allowVision = !visionRow;

    return {
      allowFirecrawl,
      allowVision,
      firecrawlBlockedReason: firecrawlRow 
        ? `cooldown:${policy.firecrawlHours}h (last: ${firecrawlRow.created_at})` 
        : undefined,
      visionBlockedReason: visionRow 
        ? `cooldown:${policy.visionHours}h (last: ${visionRow.created_at})` 
        : undefined,
      firecrawlLastAttempt: firecrawlRow?.created_at,
      visionLastAttempt: visionRow?.created_at,
    };
  } catch (error) {
    // extraction_logs テーブルがない場合やクエリエラー時は許可
    console.warn('[checkCooldown] Error checking cooldown, allowing all:', error);
    return {
      allowFirecrawl: true,
      allowVision: true,
    };
  }
}

/**
 * 複数の補助金に対して一括で cooldown チェック
 * （バッチ処理の高速化用）
 */
export async function checkCooldownBatch(
  db: D1Database,
  subsidyIds: string[],
  policy: CooldownPolicy = DEFAULT_COOLDOWN_POLICY
): Promise<Map<string, CooldownResult>> {
  const results = new Map<string, CooldownResult>();
  
  if (subsidyIds.length === 0) {
    return results;
  }
  
  try {
    // Firecrawl の最終実行を一括取得
    const firecrawlPlaceholders = subsidyIds.map(() => '?').join(',');
    const firecrawlRows = await db.prepare(`
      SELECT subsidy_id, MAX(created_at) as last_attempt
      FROM extraction_logs
      WHERE subsidy_id IN (${firecrawlPlaceholders})
        AND extraction_method = 'firecrawl'
        AND created_at >= datetime('now', '-' || ? || ' hours')
      GROUP BY subsidy_id
    `).bind(...subsidyIds, policy.firecrawlHours).all<{ subsidy_id: string; last_attempt: string }>();
    
    const firecrawlMap = new Map<string, string>();
    for (const row of firecrawlRows.results || []) {
      firecrawlMap.set(row.subsidy_id, row.last_attempt);
    }
    
    // Vision OCR の最終実行を一括取得
    const visionRows = await db.prepare(`
      SELECT subsidy_id, MAX(created_at) as last_attempt
      FROM extraction_logs
      WHERE subsidy_id IN (${firecrawlPlaceholders})
        AND extraction_method = 'vision_ocr'
        AND created_at >= datetime('now', '-' || ? || ' hours')
      GROUP BY subsidy_id
    `).bind(...subsidyIds, policy.visionHours).all<{ subsidy_id: string; last_attempt: string }>();
    
    const visionMap = new Map<string, string>();
    for (const row of visionRows.results || []) {
      visionMap.set(row.subsidy_id, row.last_attempt);
    }
    
    // 結果をマップに格納
    for (const subsidyId of subsidyIds) {
      const firecrawlLast = firecrawlMap.get(subsidyId);
      const visionLast = visionMap.get(subsidyId);
      
      results.set(subsidyId, {
        allowFirecrawl: !firecrawlLast,
        allowVision: !visionLast,
        firecrawlBlockedReason: firecrawlLast 
          ? `cooldown:${policy.firecrawlHours}h (last: ${firecrawlLast})` 
          : undefined,
        visionBlockedReason: visionLast 
          ? `cooldown:${policy.visionHours}h (last: ${visionLast})` 
          : undefined,
        firecrawlLastAttempt: firecrawlLast,
        visionLastAttempt: visionLast,
      });
    }
    
    return results;
  } catch (error) {
    console.warn('[checkCooldownBatch] Error checking cooldown batch, allowing all:', error);
    // エラー時は全て許可
    for (const subsidyId of subsidyIds) {
      results.set(subsidyId, {
        allowFirecrawl: true,
        allowVision: true,
      });
    }
    return results;
  }
}

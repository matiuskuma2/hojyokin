/**
 * resolveSubsidyRef.ts
 * 
 * SSOT ID解決の唯一の入口（Freeze-REF-0）
 * 
 * 目的:
 * - canonical_id / cache_id 問題を根絶
 * - 全APIでこの関数を通してIDを解決
 * 
 * 優先順位（Freeze）:
 * 1. subsidy_canonical.id = input_id → canonical ヒット
 * 2. subsidy_cache.id = input_id → cache ヒット → canonical 逆引き
 * 3. どちらもヒットしない → null（呼び出し元で404）
 */

export type SourceType = 'jgrants' | 'manual' | 'izumi' | 'prefecture' | 'platform' | 'support_info' | 'other';
export type MatchType = 'auto' | 'manual' | 'system';

export interface SourceLink {
  source_type: SourceType;
  source_id: string;
  match_type: MatchType;
  verified: boolean;
}

export interface ResolveSubsidyRefResult {
  input_id: string;
  canonical_id: string;
  cache_id: string | null;
  snapshot_id: string | null;
  primary_source_type: SourceType;
  primary_source_id: string | null;
  links: SourceLink[];
}

/**
 * 補助金IDを解決（canonical_id / cache_id どちらでも受け付ける）
 * 
 * @param db D1Database インスタンス
 * @param inputId canonical_id または cache_id
 * @returns ResolveSubsidyRefResult または null（見つからない場合）
 */
export async function resolveSubsidyRef(
  db: D1Database,
  inputId: string
): Promise<ResolveSubsidyRefResult | null> {
  try {
    // ========================================
    // Step 1: canonical_id として検索
    // ========================================
    const canonicalRow = await db
      .prepare(`
        SELECT
          c.id AS canonical_id,
          c.latest_cache_id AS cache_id,
          c.latest_snapshot_id AS snapshot_id
        FROM subsidy_canonical c
        WHERE c.id = ?
        LIMIT 1
      `)
      .bind(inputId)
      .first<{
        canonical_id: string;
        cache_id: string | null;
        snapshot_id: string | null;
      }>();

    if (canonicalRow) {
      // canonical ヒット → links と primary_source を取得
      const { links, primarySource } = await getLinksAndPrimarySource(db, canonicalRow.canonical_id);
      
      return {
        input_id: inputId,
        canonical_id: canonicalRow.canonical_id,
        cache_id: canonicalRow.cache_id,
        snapshot_id: canonicalRow.snapshot_id,
        primary_source_type: primarySource.type,
        primary_source_id: primarySource.id,
        links,
      };
    }

    // ========================================
    // Step 2: cache_id として検索 → canonical 逆引き
    // ========================================
    const cacheRow = await db
      .prepare(`
        SELECT
          l.canonical_id AS canonical_id,
          c.latest_cache_id AS cache_id,
          c.latest_snapshot_id AS snapshot_id
        FROM subsidy_source_link l
        JOIN subsidy_canonical c ON c.id = l.canonical_id
        WHERE l.source_id = ?
          AND c.latest_cache_id = ?
        LIMIT 1
      `)
      .bind(inputId, inputId)
      .first<{
        canonical_id: string;
        cache_id: string | null;
        snapshot_id: string | null;
      }>();

    if (cacheRow) {
      // cache → canonical 逆引き成功
      const { links, primarySource } = await getLinksAndPrimarySource(db, cacheRow.canonical_id);
      
      return {
        input_id: inputId,
        canonical_id: cacheRow.canonical_id,
        cache_id: cacheRow.cache_id,
        snapshot_id: cacheRow.snapshot_id,
        primary_source_type: primarySource.type,
        primary_source_id: primarySource.id,
        links,
      };
    }

    // ========================================
    // Step 2b: cache_id として直接検索（レガシー互換）
    // subsidy_source_link が無い場合でも cache から canonical を逆引き
    // ========================================
    const legacyCacheRow = await db
      .prepare(`
        SELECT
          c.id AS canonical_id,
          c.latest_cache_id AS cache_id,
          c.latest_snapshot_id AS snapshot_id
        FROM subsidy_canonical c
        WHERE c.latest_cache_id = ?
        LIMIT 1
      `)
      .bind(inputId)
      .first<{
        canonical_id: string;
        cache_id: string | null;
        snapshot_id: string | null;
      }>();

    if (legacyCacheRow) {
      const { links, primarySource } = await getLinksAndPrimarySource(db, legacyCacheRow.canonical_id);
      
      return {
        input_id: inputId,
        canonical_id: legacyCacheRow.canonical_id,
        cache_id: legacyCacheRow.cache_id,
        snapshot_id: legacyCacheRow.snapshot_id,
        primary_source_type: primarySource.type,
        primary_source_id: primarySource.id,
        links,
      };
    }

    // ========================================
    // Step 3: どちらもヒットしない → null
    // ========================================
    console.warn(`[resolveSubsidyRef] Not found: ${inputId}`);
    return null;

  } catch (error) {
    console.error('[resolveSubsidyRef] Error:', error);
    return null;
  }
}

/**
 * links一覧と primary_source を取得
 */
async function getLinksAndPrimarySource(
  db: D1Database,
  canonicalId: string
): Promise<{
  links: SourceLink[];
  primarySource: { type: SourceType; id: string | null };
}> {
  // links 取得（優先順でソート）
  const linksResult = await db
    .prepare(`
      SELECT
        source_type,
        source_id,
        match_type,
        CASE WHEN verified = 1 THEN 1 ELSE 0 END AS verified
      FROM subsidy_source_link
      WHERE canonical_id = ?
      ORDER BY
        CASE source_type
          WHEN 'jgrants' THEN 1
          WHEN 'manual' THEN 2
          WHEN 'prefecture' THEN 3
          WHEN 'platform' THEN 4
          WHEN 'support_info' THEN 5
          WHEN 'izumi' THEN 9
          ELSE 99
        END,
        verified DESC,
        id ASC
    `)
    .bind(canonicalId)
    .all<{
      source_type: string;
      source_id: string;
      match_type: string;
      verified: number;
    }>();

  const links: SourceLink[] = (linksResult.results || []).map(row => ({
    source_type: row.source_type as SourceType,
    source_id: row.source_id,
    match_type: row.match_type as MatchType,
    verified: row.verified === 1,
  }));

  // primary_source は links の先頭（優先順でソート済み）
  const primarySource: { type: SourceType; id: string | null } = links.length > 0
    ? { type: links[0].source_type, id: links[0].source_id }
    : { type: 'manual', id: null }; // links が無い場合は manual 扱い

  return { links, primarySource };
}

/**
 * 補助金IDを解決し、存在しない場合は例外をスロー
 * 
 * @throws Error 補助金が見つからない場合
 */
export async function resolveSubsidyRefOrThrow(
  db: D1Database,
  inputId: string
): Promise<ResolveSubsidyRefResult> {
  const result = await resolveSubsidyRef(db, inputId);
  if (!result) {
    throw new Error(`Subsidy not found: ${inputId}`);
  }
  return result;
}

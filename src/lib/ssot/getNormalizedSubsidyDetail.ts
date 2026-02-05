/**
 * getNormalizedSubsidyDetail.ts
 * 
 * A-3-0: SSOT共通読み取り関数（Freeze-GET-0）
 * 
 * 目的:
 * - 全APIで共有するNormalizedSubsidyDetail取得のエントリーポイント
 * - canonical_id / cache_id / detail_json のズレを解消
 * - どのAPI叩いても normalized を SSOT として参照できる状態を実現
 * 
 * I/O:
 * - in: db, inputId
 * - out: { ref, normalized, canonicalRow, snapshotRow, cacheRow, detailJson }
 */

import { resolveSubsidyRef, type ResolveSubsidyRefResult } from './resolveSubsidyRef';
import { normalizeSubsidyDetail, safeJsonParse, type NormalizedSubsidyDetail } from './normalizeSubsidyDetail';

// ========================================
// 型定義
// ========================================

export interface GetNormalizedSubsidyDetailResult {
  /** SSOT ID解決結果 */
  ref: ResolveSubsidyRefResult;
  /** 正規化済み補助金詳細（NormalizedSubsidyDetail v1.0） */
  normalized: NormalizedSubsidyDetail;
  /** subsidy_canonical テーブルの行（生データ） */
  canonicalRow: Record<string, unknown> | null;
  /** subsidy_snapshot テーブルの行（生データ） */
  snapshotRow: Record<string, unknown> | null;
  /** subsidy_cache テーブルの行（生データ） */
  cacheRow: Record<string, unknown> | null;
  /** detail_json のパース済みオブジェクト */
  detailJson: Record<string, unknown>;
}

// ========================================
// DEBUG設定
// ========================================

/**
 * DEBUG_SSOT=1 のときのみログ出力
 */
function debugLog(message: string, data?: unknown): void {
  // 環境変数は Workers 環境では直接参照できないため、呼び出し側でガード
  // この関数はログを出力する役割のみ
  console.log(`[SSOT] ${message}`, data !== undefined ? data : '');
}

// ========================================
// メイン関数
// ========================================

/**
 * 補助金IDからNormalizedSubsidyDetailを取得（SSOT共通エントリーポイント）
 * 
 * @param db D1Database インスタンス
 * @param inputId canonical_id または cache_id
 * @param options.debug DEBUG_SSOT=1 相当のログ出力フラグ（デフォルト: false）
 * @returns GetNormalizedSubsidyDetailResult または null（見つからない場合）
 */
export async function getNormalizedSubsidyDetail(
  db: D1Database,
  inputId: string,
  options?: { debug?: boolean }
): Promise<GetNormalizedSubsidyDetailResult | null> {
  const debug = options?.debug ?? false;

  try {
    // ========================================
    // Step 1: SSOT ID解決（Freeze-REF-0）
    // ========================================
    const ref = await resolveSubsidyRef(db, inputId);

    if (!ref) {
      if (debug) {
        debugLog(`Not found: ${inputId}`);
      }
      return null;
    }

    if (debug) {
      debugLog(`Resolved: ${inputId}`, {
        canonical_id: ref.canonical_id,
        cache_id: ref.cache_id,
        snapshot_id: ref.snapshot_id,
        primary_source_type: ref.primary_source_type,
      });
    }

    // ========================================
    // Step 2: canonical / snapshot / cache 取得
    // ========================================
    const canonicalRow = await db
      .prepare('SELECT * FROM subsidy_canonical WHERE id = ?')
      .bind(ref.canonical_id)
      .first<Record<string, unknown>>();

    const snapshotRow = ref.snapshot_id
      ? await db
          .prepare('SELECT * FROM subsidy_snapshot WHERE id = ?')
          .bind(ref.snapshot_id)
          .first<Record<string, unknown>>()
      : null;

    const cacheRow = ref.cache_id
      ? await db
          .prepare('SELECT * FROM subsidy_cache WHERE id = ?')
          .bind(ref.cache_id)
          .first<Record<string, unknown>>()
      : null;

    // detail_json パース（snapshotRow 優先、fallback で cacheRow）
    // Freeze-GET-1: snapshotRow.detail_json に wall_chat_questions 等が格納されているため
    const snapshotDetailJson = safeJsonParse(snapshotRow?.detail_json as string);
    const cacheDetailJson = safeJsonParse(cacheRow?.detail_json as string);
    // merge: snapshotDetailJson を優先し、cacheDetailJson を補完
    const detailJson = {
      ...cacheDetailJson,
      ...snapshotDetailJson,
    };

    if (debug) {
      debugLog(`Rows fetched`, {
        has_canonical: !!canonicalRow,
        has_snapshot: !!snapshotRow,
        has_cache: !!cacheRow,
        detail_json_keys: Object.keys(detailJson).length,
      });
    }

    // ========================================
    // Step 3: NormalizedSubsidyDetail 生成（Freeze-NORM-0）
    // ========================================
    const normalized = normalizeSubsidyDetail({
      ref,
      canonicalRow,
      snapshotRow,
      cacheRow,
      detailJson,
    });

    if (debug) {
      debugLog(`Normalized`, {
        title: normalized.display.title,
        eligibility_rules_count: normalized.content.eligibility_rules.length,
        required_documents_count: normalized.content.required_documents.length,
        bonus_points_count: normalized.content.bonus_points.length,
        wall_chat_ready: normalized.wall_chat.ready,
      });
    }

    return {
      ref,
      normalized,
      canonicalRow,
      snapshotRow,
      cacheRow,
      detailJson,
    };
  } catch (error) {
    console.error('[getNormalizedSubsidyDetail] Error:', error);
    return null;
  }
}

/**
 * 補助金IDからNormalizedSubsidyDetailを取得し、見つからない場合は例外をスロー
 * 
 * @throws Error 補助金が見つからない場合
 */
export async function getNormalizedSubsidyDetailOrThrow(
  db: D1Database,
  inputId: string,
  options?: { debug?: boolean }
): Promise<GetNormalizedSubsidyDetailResult> {
  const result = await getNormalizedSubsidyDetail(db, inputId, options);
  if (!result) {
    throw new Error(`Subsidy not found: ${inputId}`);
  }
  return result;
}

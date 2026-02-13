/**
 * resolveOpeningId.ts
 * 
 * Freeze v3.0 §17-18: 回次Gate
 * 
 * 壁打ちチャットのセッション開始時に、入力IDを「回次ID（cache_id）」に解決する。
 * 
 * ルール:
 * - RULE-GATE-1: 壁打ちは cache_id（回次ID）のみ受け付ける
 * - RULE-GATE-2: canonical_id → latest_cache_id に自動変換
 * - RULE-GATE-3: 受付終了した回次はブロック（管理者除外オプションあり）
 * - RULE-GATE-4: canonical 未解決でも cache 存在時はフォールバック許可
 * 
 * @module
 */

export interface OpeningIdResult {
  /** 回次ID（壁打ちで使用する唯一のキー） */
  openingId: string;
  /** 制度ID（canonical_id）- 制度レベルの追跡用、null は未紐付き */
  schemeId: string | null;
  /** 入力IDが canonical → cache に変換されたか */
  isConverted: boolean;
  /** 補助金タイトル（セッション固定情報として保存） */
  subsidyTitle: string;
  /** 受付終了日時（セッション固定情報として保存） */
  acceptanceEnd: string | null;
  /** NSDのソース種別 */
  nsdSource: 'ssot' | 'cache' | 'mock';
  /** 警告メッセージ（締切未設定等） */
  warning: string | null;
}

export class GateError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'ROUND_CLOSED' | 'SCHEME_NO_OPENING' | 'EXCLUDED',
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'GateError';
  }
}

/**
 * 入力IDを回次ID（opening_id = cache_id）に解決する
 * 
 * Freeze v3.0 準拠の Gate 関数
 * 
 * @param db - D1Database インスタンス
 * @param inputId - フロントエンドから渡されるID（canonical_id or cache_id）
 * @param options - オプション
 * @returns OpeningIdResult
 * @throws GateError - 回次解決不可、受付終了、対象外の場合
 */
export async function resolveOpeningId(
  db: D1Database,
  inputId: string,
  options: {
    /** 管理者は受付終了でも壁打ち可能（過去検証モード） */
    allowClosed?: boolean;
  } = {}
): Promise<OpeningIdResult> {
  
  // ========================================
  // Step 1: canonical_id として検索
  // ========================================
  const canonicalRow = await db.prepare(`
    SELECT 
      c.id AS canonical_id,
      c.latest_cache_id,
      c.name AS canonical_name
    FROM subsidy_canonical c
    WHERE c.id = ?
    LIMIT 1
  `).bind(inputId).first<{
    canonical_id: string;
    latest_cache_id: string | null;
    canonical_name: string | null;
  }>();

  if (canonicalRow) {
    // RULE-GATE-2: canonical → latest_cache_id に変換
    if (!canonicalRow.latest_cache_id) {
      // RULE-SCHEME-NO-OPENING: canonical は存在するが回次が無い
      throw new GateError(
        `制度「${canonicalRow.canonical_name || inputId}」には現在有効な公募回がありません`,
        'SCHEME_NO_OPENING',
        { canonical_id: inputId, canonical_name: canonicalRow.canonical_name }
      );
    }

    // latest_cache_id の詳細を取得
    const cacheRow = await db.prepare(`
      SELECT id, title, acceptance_end_datetime, request_reception_display_flag,
             wall_chat_excluded, canonical_id
      FROM subsidy_cache
      WHERE id = ?
      LIMIT 1
    `).bind(canonicalRow.latest_cache_id).first<CacheRow>();

    if (!cacheRow) {
      throw new GateError(
        `制度「${canonicalRow.canonical_name || inputId}」の最新回次データが見つかりません`,
        'SCHEME_NO_OPENING',
        { canonical_id: inputId, latest_cache_id: canonicalRow.latest_cache_id }
      );
    }

    // 受付終了チェック
    checkAcceptanceClosed(cacheRow, options.allowClosed);

    // 除外チェック
    if (cacheRow.wall_chat_excluded) {
      throw new GateError(
        `「${cacheRow.title}」は壁打ち対象外です`,
        'EXCLUDED',
        { cache_id: cacheRow.id, title: cacheRow.title }
      );
    }

    console.log(`[resolveOpeningId] canonical → cache: ${inputId} → ${cacheRow.id} (scheme: ${canonicalRow.canonical_id})`);

    return {
      openingId: cacheRow.id,
      schemeId: canonicalRow.canonical_id,
      isConverted: true,
      subsidyTitle: cacheRow.title,
      acceptanceEnd: cacheRow.acceptance_end_datetime || null,
      nsdSource: 'ssot',
      warning: cacheRow.acceptance_end_datetime ? null : '⚠️ 締切日が未設定です。公式サイトで最新情報をご確認ください。',
    };
  }

  // ========================================
  // Step 2: cache_id として直接検索（回次IDが直接渡された場合）
  // ========================================
  const directCacheRow = await db.prepare(`
    SELECT id, title, acceptance_end_datetime, request_reception_display_flag,
           wall_chat_excluded, canonical_id, source
    FROM subsidy_cache
    WHERE id = ?
    LIMIT 1
  `).bind(inputId).first<CacheRow & { source: string | null }>();

  if (directCacheRow) {
    // 受付終了チェック
    checkAcceptanceClosed(directCacheRow, options.allowClosed);

    // 除外チェック
    if (directCacheRow.wall_chat_excluded) {
      throw new GateError(
        `「${directCacheRow.title}」は壁打ち対象外です`,
        'EXCLUDED',
        { cache_id: directCacheRow.id, title: directCacheRow.title }
      );
    }

    // canonical_id が存在する場合は schemeId として利用
    const schemeId = directCacheRow.canonical_id || null;

    // canonical 紐付きかどうかで nsdSource を決定
    // canonical_id があり、かつ subsidy_canonical にも存在する → ssot
    // それ以外 → cache
    let nsdSource: 'ssot' | 'cache' = 'cache';
    if (schemeId) {
      const canonicalExists = await db.prepare(`
        SELECT 1 FROM subsidy_canonical WHERE id = ? LIMIT 1
      `).bind(schemeId).first();
      if (canonicalExists) {
        nsdSource = 'ssot';
      }
    }

    console.log(`[resolveOpeningId] direct cache: ${inputId} (scheme: ${schemeId}, source: ${nsdSource})`);

    return {
      openingId: directCacheRow.id,
      schemeId,
      isConverted: false,
      subsidyTitle: directCacheRow.title,
      acceptanceEnd: directCacheRow.acceptance_end_datetime || null,
      nsdSource,
      warning: directCacheRow.acceptance_end_datetime ? null : '⚠️ 締切日が未設定です。公式サイトで最新情報をご確認ください。',
    };
  }

  // ========================================
  // Step 3: どちらでも見つからない → NOT_FOUND
  // ========================================
  throw new GateError(
    '補助金が見つかりません',
    'NOT_FOUND',
    { input_id: inputId }
  );
}

// =====================================================
// 内部ヘルパー
// =====================================================

interface CacheRow {
  id: string;
  title: string;
  acceptance_end_datetime: string | null;
  request_reception_display_flag: number | null;
  wall_chat_excluded: number | null;
  canonical_id: string | null;
}

/**
 * 受付終了チェック（RULE-GATE-3）
 * 
 * 判定基準:
 * 1. request_reception_display_flag === 0 → 受付停止
 * 2. acceptance_end_datetime が過去日時 → 受付終了
 */
function checkAcceptanceClosed(
  row: CacheRow,
  allowClosed?: boolean
): void {
  if (allowClosed) return;

  // フラグによる受付停止チェック
  if (row.request_reception_display_flag === 0) {
    throw new GateError(
      `「${row.title}」は現在受付を停止しています`,
      'ROUND_CLOSED',
      {
        cache_id: row.id,
        title: row.title,
        reason: 'display_flag_off',
      }
    );
  }

  // 日時による受付終了チェック
  if (row.acceptance_end_datetime) {
    const endDate = new Date(row.acceptance_end_datetime);
    const now = new Date();
    if (endDate < now) {
      throw new GateError(
        `「${row.title}」の受付は終了しています（締切: ${row.acceptance_end_datetime}）`,
        'ROUND_CLOSED',
        {
          cache_id: row.id,
          title: row.title,
          acceptance_end: row.acceptance_end_datetime,
          reason: 'deadline_passed',
        }
      );
    }
  }
}

/**
 * NSD コンテンツハッシュを生成
 * 
 * detail_json の内容から簡易ハッシュを生成。
 * セッション開始時に保存し、再開時に変更を検知する。
 * 
 * Cloudflare Workers で使用可能な Web Crypto API を使用。
 */
export async function computeNsdContentHash(
  detailJson: string | null
): Promise<string> {
  if (!detailJson) return 'empty';
  
  // Web Crypto API (SubtleCrypto) を使用
  const encoder = new TextEncoder();
  const data = encoder.encode(detailJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // 先頭16文字のみ使用（比較用途なので完全ハッシュ不要）
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

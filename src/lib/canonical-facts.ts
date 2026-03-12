/**
 * Canonical Fact Keys — 正準 fact キーの一元定義
 * 
 * Phase 0.5 の 5-A で定義された会社レベル fact (subsidy_id = NULL) の正準キー。
 * BUG-2 再発防止のため、fact_key の定義はこのファイルのみで行う。
 * 
 * 参照箇所:
 * - profile.ts (法人UI: facts の保存)
 * - agency/clients.ts (士業UI: facts の GET/PUT)
 * - getCompanySSOT.ts (SSOT 読み取り — キーリストは直接参照しないが、値の読み方は同じ)
 * - screening-v2.ts (スクリーニング — SSOT 経由で参照)
 */

// ============================================================
// 正準キー定義
// ============================================================

/**
 * 会社レベル fact の正準キー一覧
 * 
 * これ以外のキーを chat_facts に書き込む場合はチャット由来のみ許可。
 * UI（法人・士業）からの書き込みはこのリストに限定する。
 */
export const CANONICAL_FACT_KEYS = [
  'has_gbiz_id',
  'is_invoice_registered',
  'plans_wage_raise',
  'tax_arrears',
  'past_subsidy_same_type',
  'has_business_plan',
  'has_keiei_kakushin',
  'has_jigyou_keizoku',
] as const;

export type CanonicalFactKey = typeof CANONICAL_FACT_KEYS[number];

// ============================================================
// 日本語ラベル
// ============================================================

export const FACT_KEY_LABELS_JA: Readonly<Record<CanonicalFactKey, string>> = {
  has_gbiz_id: 'GビズIDプライム取得済み',
  is_invoice_registered: 'インボイス登録済み',
  plans_wage_raise: '賃上げ予定',
  tax_arrears: '税金滞納',
  past_subsidy_same_type: '同種補助金受給歴',
  has_business_plan: '事業計画書あり',
  has_keiei_kakushin: '経営革新計画承認',
  has_jigyou_keizoku: '事業継続力強化計画認定',
} as const;

// ============================================================
// boolean 値の正規化
// ============================================================

/**
 * fact_value を正規化する
 * 
 * Phase 0.5 の 5-B ルール:
 * - true/1/yes/はい → "true"
 * - false/0/no/いいえ → "false"
 * - null → null（「未確認に戻す」）
 * - undefined → undefined（「スキップ」— 呼び出し元で処理）
 */
export function normalizeBooleanFactValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  
  const strVal = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'はい'].includes(strVal)) return 'true';
  if (['false', '0', 'no', 'いいえ'].includes(strVal)) return 'false';
  
  // パースできない場合はそのまま文字列として保存
  return String(value);
}

// ============================================================
// ヘルパー
// ============================================================

/**
 * キーが canonical かどうかを判定
 */
export function isCanonicalFactKey(key: string): key is CanonicalFactKey {
  return (CANONICAL_FACT_KEYS as readonly string[]).includes(key);
}

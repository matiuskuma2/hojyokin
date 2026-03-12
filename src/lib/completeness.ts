/**
 * Completeness（完成度）計算の共通関数
 * 
 * Phase 2a: 3箇所に分散していた completeness 計算を統一。
 * 
 * 参照元（消費者）:
 * - GET /api/agency/clients      — 一覧用の簡易 OK/BLOCKED（calculateSimpleCompleteness）
 * - GET /api/agency/clients/:id  — 詳細用の完全版（calculateCompleteness）
 * - GET /api/companies/:id/completeness — 汎用API（calculateCompleteness）
 * - GET /api/profile/completeness       — 法人UI用（calculateDetailedCompleteness）
 * 
 * 注意:
 * - 既存の profile.ts, companies.ts のレスポンス形式は変更しない（後方互換）
 * - この関数は「計算ロジック」のみを提供。DB クエリは呼び出し元が行う
 * - getCompanySSOT.ts とは責務が異なる（SSOT=マッチング入力、completeness=UI表示）
 */

// ============================================================
// 型定義
// ============================================================

export interface CompletenessField {
  field: string;
  label: string;
  source: 'company' | 'profile';
  weight: number;
  category: 'required' | 'recommended' | 'optional';
}

/**
 * 共通 completeness 結果型
 */
export interface CompletenessResult {
  /** OK(全必須充足+推奨充足), NEEDS_RECOMMENDED(必須充足+推奨不足), BLOCKED(必須不足) */
  status: 'OK' | 'NEEDS_RECOMMENDED' | 'BLOCKED';
  /** 重み付きパーセンテージ (0-100) */
  percentage: number;
  required: {
    total: number;
    filled: number;
    fields: Record<string, boolean>;
  };
  recommended: {
    total: number;
    filled: number;
    fields: Record<string, boolean>;
  };
  optional: {
    total: number;
    filled: number;
  };
  missing_required: Array<{ field: string; label: string }>;
  missing_recommended: Array<{ field: string; label: string }>;
  /** マッチング検索可能かどうか */
  ready_for_search: boolean;
  /** 次のアクション推奨 */
  next_actions: string[];
}

/**
 * 簡易 completeness 結果型（一覧用）
 */
export interface SimpleCompletenessResult {
  status: 'OK' | 'BLOCKED';
  missing_fields: string[];
}

// ============================================================
// フィールド定義（凍結仕様 — 変更時は全消費者への影響を確認）
// ============================================================

/**
 * 必須 4 項目（マッチングに最低限必要）
 * 変更凍結: companies.ts, clients.ts, profile.ts で共通使用
 */
export const REQUIRED_FIELDS: ReadonlyArray<{
  field: string;
  label: string;
  source: 'company' | 'profile';
}> = [
  { field: 'name', label: '会社名', source: 'company' },
  { field: 'prefecture', label: '都道府県', source: 'company' },
  { field: 'industry_major', label: '業種', source: 'company' },
  { field: 'employee_count', label: '従業員数', source: 'company' },
] as const;

/**
 * 推奨項目（マッチング精度向上）
 */
export const RECOMMENDED_FIELDS: ReadonlyArray<{
  field: string;
  label: string;
  source: 'company' | 'profile';
}> = [
  { field: 'city', label: '市区町村', source: 'company' },
  { field: 'capital', label: '資本金', source: 'company' },
  { field: 'annual_revenue', label: '年商', source: 'company' },
  { field: 'established_date', label: '設立年月', source: 'company' },
  { field: 'corp_type', label: '法人種別', source: 'profile' },
  { field: 'representative_name', label: '代表者名', source: 'profile' },
  { field: 'business_summary', label: '事業概要', source: 'profile' },
  { field: 'is_profitable', label: '直近収益性', source: 'profile' },
] as const;

/**
 * 加点項目（スコアアップに寄与）
 */
export const OPTIONAL_FIELDS: ReadonlyArray<{
  field: string;
  label: string;
  source: 'company' | 'profile';
}> = [
  { field: 'past_subsidies_json', label: '過去の補助金実績', source: 'profile' },
  { field: 'certifications_json', label: '保有認証', source: 'profile' },
  { field: 'has_young_employees', label: '若年従業員', source: 'profile' },
  { field: 'has_female_executives', label: '女性役員', source: 'profile' },
  { field: 'has_senior_employees', label: 'シニア従業員', source: 'profile' },
  { field: 'plans_to_hire', label: '採用予定', source: 'profile' },
] as const;

/**
 * 全フィールドの重みマップ（profile.ts との後方互換用）
 */
export const FIELD_WEIGHTS: Readonly<Record<string, number>> = {
  // required (weight: 10 each)
  name: 10,
  prefecture: 10,
  industry_major: 10,
  employee_count: 10,
  // recommended (weight: 5-8)
  city: 5,
  capital: 5,
  annual_revenue: 5,
  established_date: 5,
  corp_type: 5,
  representative_name: 5,
  business_summary: 8,
  is_profitable: 5,
  // optional (weight: 2-5)
  past_subsidies_json: 5,
  certifications_json: 3,
  has_young_employees: 2,
  has_female_executives: 2,
  has_senior_employees: 2,
  plans_to_hire: 2,
};

// ============================================================
// 値チェックヘルパー
// ============================================================

/**
 * 値が「入力済み」かどうかを判定
 * 
 * - null/undefined/'' → false
 * - 0 → true（数値 0 は有効な入力）
 * - employee_count は特別扱い（0 は未入力とみなす）
 */
function isFieldFilled(value: unknown, fieldName: string): boolean {
  if (value === null || value === undefined) return false;
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    // employee_count が文字列 "0" の場合は未入力
    if (fieldName === 'employee_count' && (trimmed === '0')) return false;
    return true;
  }
  
  if (typeof value === 'number') {
    // employee_count の 0 は未入力
    if (fieldName === 'employee_count' && value <= 0) return false;
    return true;
  }
  
  if (typeof value === 'boolean') return true;
  
  return !!value;
}

// ============================================================
// 共通 completeness 計算
// ============================================================

/**
 * 完全な completeness 計算（詳細画面用）
 * 
 * @param company companies テーブルの行（Record<string, unknown>）
 * @param profile company_profile テーブルの行、なければ null
 * @returns CompletenessResult
 */
export function calculateCompleteness(
  company: Record<string, unknown> | null,
  profile: Record<string, unknown> | null,
): CompletenessResult {
  const requiredFields: Record<string, boolean> = {};
  const missingRequired: Array<{ field: string; label: string }> = [];
  let requiredFilled = 0;

  for (const f of REQUIRED_FIELDS) {
    const source = f.source === 'company' ? company : profile;
    const filled = isFieldFilled(source?.[f.field], f.field);
    requiredFields[f.field] = filled;
    if (filled) {
      requiredFilled++;
    } else {
      missingRequired.push({ field: f.field, label: f.label });
    }
  }

  const recommendedFields: Record<string, boolean> = {};
  const missingRecommended: Array<{ field: string; label: string }> = [];
  let recommendedFilled = 0;

  for (const f of RECOMMENDED_FIELDS) {
    const source = f.source === 'company' ? company : profile;
    const filled = isFieldFilled(source?.[f.field], f.field);
    recommendedFields[f.field] = filled;
    if (filled) {
      recommendedFilled++;
    } else {
      missingRecommended.push({ field: f.field, label: f.label });
    }
  }

  let optionalFilled = 0;
  for (const f of OPTIONAL_FIELDS) {
    const source = f.source === 'company' ? company : profile;
    if (isFieldFilled(source?.[f.field], f.field)) {
      optionalFilled++;
    }
  }

  // 重み付きパーセンテージ計算
  let totalWeight = 0;
  let filledWeight = 0;

  const allFields = [...REQUIRED_FIELDS, ...RECOMMENDED_FIELDS, ...OPTIONAL_FIELDS];
  for (const f of allFields) {
    const weight = FIELD_WEIGHTS[f.field] || 1;
    totalWeight += weight;
    const source = f.source === 'company' ? company : profile;
    if (isFieldFilled(source?.[f.field], f.field)) {
      filledWeight += weight;
    }
  }

  const percentage = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;

  // ステータス判定
  const allRequiredFilled = requiredFilled === REQUIRED_FIELDS.length;
  const allRecommendedFilled = recommendedFilled === RECOMMENDED_FIELDS.length;

  let status: CompletenessResult['status'];
  if (!allRequiredFilled) {
    status = 'BLOCKED';
  } else if (!allRecommendedFilled) {
    status = 'NEEDS_RECOMMENDED';
  } else {
    status = 'OK';
  }

  // 次のアクション推奨
  const nextActions = generateNextActions(missingRequired, missingRecommended);

  return {
    status,
    percentage,
    required: {
      total: REQUIRED_FIELDS.length,
      filled: requiredFilled,
      fields: requiredFields,
    },
    recommended: {
      total: RECOMMENDED_FIELDS.length,
      filled: recommendedFilled,
      fields: recommendedFields,
    },
    optional: {
      total: OPTIONAL_FIELDS.length,
      filled: optionalFilled,
    },
    missing_required: missingRequired,
    missing_recommended: missingRecommended,
    ready_for_search: allRequiredFilled,
    next_actions: nextActions,
  };
}

/**
 * 簡易 completeness 計算（一覧用）
 * 
 * 必須4項目のみチェック → OK / BLOCKED
 * 
 * @param company companies テーブルのカラム（name, prefecture, industry_major/industry, employee_count）
 */
export function calculateSimpleCompleteness(company: {
  company_name?: unknown;
  name?: unknown;
  prefecture?: unknown;
  industry_major?: unknown;
  industry?: unknown;
  employee_count?: unknown;
}): SimpleCompletenessResult {
  const missingFields: string[] = [];

  const name = company.company_name ?? company.name;
  if (!isFieldFilled(name, 'name')) missingFields.push('会社名');

  if (!isFieldFilled(company.prefecture, 'prefecture')) missingFields.push('都道府県');

  const industry = company.industry_major ?? company.industry;
  if (!isFieldFilled(industry, 'industry_major')) missingFields.push('業種');

  if (!isFieldFilled(company.employee_count, 'employee_count')) missingFields.push('従業員数');

  return {
    status: missingFields.length === 0 ? 'OK' : 'BLOCKED',
    missing_fields: missingFields,
  };
}

// ============================================================
// ヘルパー
// ============================================================

function generateNextActions(
  missingRequired: Array<{ field: string; label: string }>,
  missingRecommended: Array<{ field: string; label: string }>,
): string[] {
  const actions: string[] = [];

  if (missingRequired.length > 0) {
    actions.push(`必須情報を入力してください: ${missingRequired.map(f => f.label).join('、')}`);
  }

  if (missingRecommended.length > 3) {
    actions.push('詳細情報を追加すると、補助金の適合度判定が改善されます');
  } else if (missingRecommended.length > 0) {
    actions.push(`推奨情報の入力: ${missingRecommended.map(f => f.label).join('、')}`);
  }

  return actions;
}

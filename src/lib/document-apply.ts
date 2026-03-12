/**
 * Document Apply — 抽出結果(extracted_json)を companies/company_profile に反映する共通ヘルパー
 * 
 * Phase 3b: agency 側 extract/apply の実装。
 * 将来的に profile.ts の apply も統一可能な設計。
 * 
 * 責務:
 * 1. doc_type ごとの抽出キー allowlist（文書種別に応じた適用可能キーの制限）
 * 2. extracted_json → intake_field_mappings 経由で companies/company_profile に仕分け
 * 3. fill_empty / overwrite モードの判定（null/undefined/空文字/空配列を未入力扱い）
 * 4. apply_result に適用/スキップ/理由を全て返す
 * 
 * 安全装置:
 * - target_table は companies / company_profile のみ（Phase 3a と同じ制限）
 * - chat_facts / company_documents 自体の更新は apply の責務外
 * - doc_type → allowlist → mapping の3段フィルタ
 */

import { getIntakeFieldMappings, splitPayloadByTarget } from './intake-field-mappings';
import type { IntakeFieldMapping } from './intake-field-mappings';

// ============================================================
// 型定義
// ============================================================

export type ApplyMode = 'fill_empty' | 'overwrite';

/** apply 結果の詳細 */
export interface DocumentApplyResult {
  document_id: string;
  doc_type: string;
  apply_mode: ApplyMode;
  mapping_source: 'db' | 'fallback' | 'db+fallback';
  /** companies テーブルに適用されたカラム */
  applied_companies: string[];
  /** company_profile テーブルに適用されたカラム */
  applied_profile: string[];
  /** fill_empty で既存値があったためスキップ */
  skipped_existing: string[];
  /** extracted_json にキーがあるがマッピングに無い */
  skipped_unmapped: string[];
  /** doc_type の allowlist でフィルタされた */
  skipped_doc_type_filtered: string[];
  /** target_table/column が不正 */
  skipped_invalid_target: string[];
  /** 総適用フィールド数 */
  applied_count: number;
}

/** 抽出結果の表示用（GET extracted レスポンス） */
export interface ExtractedView {
  document_id: string;
  doc_type: string;
  status: string;
  extracted: Record<string, unknown> | null;
  confidence: number | null;
  /** このドキュメントから apply 可能なフィールドのマッピング情報 */
  apply_mapping: ApplyMappingEntry[];
  updated_at: string;
}

export interface ApplyMappingEntry {
  /** extracted_json のキー */
  source_key: string;
  /** 反映先テーブル.カラム */
  target: string;
  /** 日本語ラベル */
  label_ja: string;
  /** 抽出された値 */
  value: unknown;
}

// ============================================================
// doc_type ごとの抽出キー allowlist
// 文書種別に応じて適用可能なキーを制限する（3段フィルタの第1段）
// ============================================================

const DOC_TYPE_ALLOWED_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  // 登記簿謄本
  corp_registry: new Set([
    'company_name', 'name',
    'address',
    'representative_name',
    'representative_title',
    'established_date', 'founded_date',
    'capital',
    'business_purpose', 'business_summary',
    'corp_number',
    'prefecture', 'city',
  ]),
  // 決算書・財務諸表
  financials: new Set([
    'fiscal_year_end',
    'sales', 'annual_revenue',
    'employee_count',
    'is_profitable',
    'total_assets', 'net_assets',
    'capital',
  ]),
  // 納税証明書
  tax_return: new Set([
    'annual_revenue', 'sales',
    'is_profitable',
    'fiscal_year_end',
  ]),
  // 事業計画書
  business_plan: new Set([
    'business_summary',
    'business_purpose',
    'employee_count',
    'products_services',
    'target_customers',
    'competitive_advantage',
  ]),
};

/**
 * doc_type から allowlist を取得。
 * 未知の doc_type（'other' 含む）は空 Set → 全キーが doc_type_filtered になる
 */
function getDocTypeAllowedKeys(docType: string): ReadonlySet<string> {
  return DOC_TYPE_ALLOWED_KEYS[docType] || new Set();
}

// ============================================================
// extracted_json → intake_field_mappings キーへの変換マップ
// 
// extracted_json のキー名と intake_field_mappings の field_key は
// 必ずしも一致しないため、ブリッジマッピングを提供する。
// 例: extracted_json.sales → annual_revenue
//     extracted_json.business_purpose → business_summary
// ============================================================

const EXTRACTED_TO_FIELD_KEY: Readonly<Record<string, string>> = {
  // corp_registry
  'company_name': 'company_name',
  'name': 'name',
  'address': 'address',
  'representative_name': 'representative_name',
  'representative_title': 'representative_title',
  'established_date': 'founded_date',
  'founded_date': 'founded_date',
  'capital': 'capital',
  'business_purpose': 'business_summary',  // 登記簿の目的 → business_summary
  'business_summary': 'business_summary',
  'corp_number': 'corp_number',
  'prefecture': 'prefecture',
  'city': 'city',

  // financials
  'fiscal_year_end': 'fiscal_year_end',
  'sales': 'annual_revenue',             // 決算書の売上高 → annual_revenue
  'annual_revenue': 'annual_revenue',
  'employee_count': 'employee_count',
  'is_profitable': 'is_profitable',

  // business_plan
  'products_services': 'products_services',
  'target_customers': 'target_customers',
  'competitive_advantage': 'competitive_advantage',
};

// ============================================================
// fill_empty 判定
// 
// 「未入力扱い」の定義（fill_empty でのみ上書き許可）:
// - null
// - undefined
// - '' (空文字)
// - 空配列 []
// - '[]' (JSON の空配列文字列)
// - '{}' (JSON の空オブジェクト文字列)
// 
// 0 や false は「入力済み」扱い（意味のある値）
// ============================================================

export function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return true;
    if (trimmed === '[]' || trimmed === '{}') return true;
    return false;
  }
  if (Array.isArray(value) && value.length === 0) return true;
  // 0, false, {} with keys → 入力済み
  return false;
}

// ============================================================
// extracted_json → apply_mapping 表示用（GET extracted 用）
// ============================================================

/**
 * 抽出結果から apply 可能なフィールドの一覧を生成する。
 * doc_type allowlist で絞り込んだ結果のみ返す。
 */
export function buildApplyMapping(
  docType: string,
  extracted: Record<string, unknown> | null,
  mappings: Map<string, IntakeFieldMapping>,
): ApplyMappingEntry[] {
  if (!extracted) return [];

  const allowedKeys = getDocTypeAllowedKeys(docType);
  const entries: ApplyMappingEntry[] = [];

  for (const [key, value] of Object.entries(extracted)) {
    if (value === undefined || value === null) continue;

    // doc_type allowlist チェック
    if (!allowedKeys.has(key)) continue;

    // extracted キーを intake_field_mappings の field_key に変換
    const fieldKey = EXTRACTED_TO_FIELD_KEY[key] || key;
    const mapping = mappings.get(fieldKey);

    if (mapping) {
      entries.push({
        source_key: key,
        target: `${mapping.target_table}.${mapping.target_column}`,
        label_ja: mapping.label_ja,
        value,
      });
    }
  }

  return entries;
}

// ============================================================
// apply ロジック本体
// ============================================================

interface ApplyInput {
  db: D1Database;
  companyId: string;
  documentId: string;
  docType: string;
  extracted: Record<string, unknown>;
  applyMode: ApplyMode;
}

/**
 * extracted_json の内容を companies/company_profile に反映する。
 * 
 * 処理フロー:
 * 1. intake_field_mappings を取得（DB + fallback）
 * 2. extracted キーを field_key に変換
 * 3. doc_type allowlist でフィルタ
 * 4. splitPayloadByTarget で仕分け
 * 5. fill_empty/overwrite で既存値チェック
 * 6. UPDATE (+ INSERT fallback for company_profile)
 * 
 * @returns apply 結果の詳細
 */
export async function applyExtractedToCompany(input: ApplyInput): Promise<DocumentApplyResult> {
  const { db, companyId, documentId, docType, extracted, applyMode } = input;

  const result: DocumentApplyResult = {
    document_id: documentId,
    doc_type: docType,
    apply_mode: applyMode,
    mapping_source: 'fallback',
    applied_companies: [],
    applied_profile: [],
    skipped_existing: [],
    skipped_unmapped: [],
    skipped_doc_type_filtered: [],
    skipped_invalid_target: [],
    applied_count: 0,
  };

  // Step 1: intake_field_mappings を取得
  const { mappings, source } = await getIntakeFieldMappings(db);
  result.mapping_source = source;

  // Step 2 & 3: extracted キーを field_key に変換 + doc_type allowlist フィルタ
  const allowedKeys = getDocTypeAllowedKeys(docType);
  const convertedPayload: Record<string, unknown> = {};

  for (const [extractedKey, value] of Object.entries(extracted)) {
    if (value === undefined || value === null) continue;

    // doc_type allowlist チェック（第1段フィルタ）
    // allowedKeys が空（= 未知の doc_type / 'other'）→ 全キーをフィルタ
    if (allowedKeys.size === 0 || !allowedKeys.has(extractedKey)) {
      result.skipped_doc_type_filtered.push(extractedKey);
      continue;
    }

    // extracted キーを intake field_key に変換
    const fieldKey = EXTRACTED_TO_FIELD_KEY[extractedKey] || extractedKey;

    // business_purpose は配列の場合がある → 文字列に変換
    if (extractedKey === 'business_purpose' && Array.isArray(value)) {
      convertedPayload[fieldKey] = value.join('、');
    } else {
      convertedPayload[fieldKey] = value;
    }
  }

  // Step 4: splitPayloadByTarget で仕分け（第2段 + 第3段フィルタ: mapping + column allowlist）
  const split = splitPayloadByTarget(convertedPayload, mappings);
  result.skipped_unmapped = split.skipped_unmapped;
  result.skipped_invalid_target = split.skipped_invalid_target;

  // ログ出力
  if (split.skipped_unmapped.length > 0) {
    console.warn(
      `[document-apply] Unmapped keys (doc=${documentId}, type=${docType}):`,
      split.skipped_unmapped.join(', ')
    );
  }
  if (result.skipped_doc_type_filtered.length > 0) {
    console.info(
      `[document-apply] Doc type filtered keys (doc=${documentId}, type=${docType}):`,
      result.skipped_doc_type_filtered.join(', ')
    );
  }

  // Step 5: fill_empty/overwrite で既存値チェック
  const company = await db.prepare(
    'SELECT * FROM companies WHERE id = ?'
  ).bind(companyId).first<Record<string, unknown>>();

  const profileData = await db.prepare(
    'SELECT * FROM company_profile WHERE company_id = ?'
  ).bind(companyId).first<Record<string, unknown>>();

  const now = new Date().toISOString();

  // companies 更新フィールドを構築
  const companyUpdates: string[] = [];
  const companyValues: unknown[] = [];

  for (const [col, val] of Object.entries(split.companies)) {
    if (applyMode === 'fill_empty' && company && !isFieldEmpty(company[col])) {
      result.skipped_existing.push(`companies.${col}`);
      continue;
    }
    companyUpdates.push(`${col} = ?`);
    companyValues.push(val);
    result.applied_companies.push(col);
  }

  // employee_count → employee_band 自動計算（Phase 3a と同じ）
  if (split.companies.employee_count !== undefined && result.applied_companies.includes('employee_count')) {
    const empCount = Number(split.companies.employee_count) || 0;
    companyUpdates.push('employee_band = ?');
    companyValues.push(calculateEmployeeBandLocal(empCount));
    result.applied_companies.push('employee_band');
  }

  // company_profile 更新フィールドを構築
  const profileUpdates: string[] = [];
  const profileValues: unknown[] = [];

  for (const [col, val] of Object.entries(split.company_profile)) {
    if (applyMode === 'fill_empty' && profileData && !isFieldEmpty(profileData[col])) {
      result.skipped_existing.push(`company_profile.${col}`);
      continue;
    }
    profileUpdates.push(`${col} = ?`);
    profileValues.push(val);
    result.applied_profile.push(col);
  }

  // Step 6: DB 更新実行
  if (companyUpdates.length > 0) {
    companyUpdates.push('updated_at = ?');
    companyValues.push(now, companyId);
    await db.prepare(
      `UPDATE companies SET ${companyUpdates.join(', ')} WHERE id = ?`
    ).bind(...companyValues).run();
  }

  if (profileUpdates.length > 0) {
    profileUpdates.push('updated_at = ?');
    profileValues.push(now);

    if (profileData) {
      // UPDATE
      profileValues.push(companyId);
      await db.prepare(
        `UPDATE company_profile SET ${profileUpdates.join(', ')} WHERE company_id = ?`
      ).bind(...profileValues).run();
    } else {
      // INSERT fallback（company_profile が無い場合）
      console.info(`[document-apply] company_profile not found for ${companyId}, creating via INSERT`);
      const insertCols = ['company_id', 'created_at'];
      const insertVals: unknown[] = [companyId, now];

      for (let i = 0; i < profileUpdates.length; i++) {
        const colMatch = profileUpdates[i].match(/^(\w+) = \?$/);
        if (colMatch) {
          insertCols.push(colMatch[1]);
          insertVals.push(profileValues[i]);
        }
      }

      await db.prepare(
        `INSERT INTO company_profile (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`
      ).bind(...insertVals).run();
    }
  }

  // ドキュメントステータスを 'applied' に更新
  await db.prepare(
    `UPDATE company_documents SET status = 'applied', updated_at = ? WHERE id = ?`
  ).bind(now, documentId).run();

  result.applied_count = result.applied_companies.length + result.applied_profile.length;

  return result;
}

// ============================================================
// employee_band 計算（_helpers.ts と同じロジックだが依存を減らすためローカル定義）
// ============================================================

function calculateEmployeeBandLocal(count: number): string {
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  if (count <= 100) return '51-100';
  if (count <= 300) return '101-300';
  return '301+';
}

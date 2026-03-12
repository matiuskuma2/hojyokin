/**
 * Intake Field Mappings — intake_field_mappings テーブルのランタイム SSOT
 * 
 * Phase 3a: submissions.ts の approve 経路をマッピング駆動に置き換えるための共通モジュール。
 * 
 * 責務:
 * 1. DB (intake_field_mappings) からマッピング定義を読み取る
 * 2. DB 取得失敗時はハードコードフォールバックにフォールバック（warn ログ付き）
 * 3. payload_json を target_table ごとに仕分ける (splitPayloadByTarget)
 * 4. 安全装置: target_table は allowlist (companies / company_profile) に限定
 * 
 * 今回 Phase 3a で触る消費者:
 * - submissions.ts (approve) ← マッピング駆動に置き換え
 * 
 * 今回触らない:
 * - profile.ts, clients.ts, portal.ts, extract/apply, chat_facts
 * 
 * 参照元:
 * - 0020_agency_intake_extension.sql (テーブル定義 + INSERT)
 * - 0128_fix_intake_field_mapping_bug.sql (annual_revenue の target_table 修正)
 */

// ============================================================
// 型定義
// ============================================================

/** DB 行の型（intake_field_mappings テーブル） */
export interface IntakeFieldMapping {
  id: string;
  field_key: string;
  label_ja: string;
  input_type: string;
  options_json: string | null;
  target_table: string;
  target_column: string;
  validation_json: string | null;
  category: string | null;
  sort_order: number;
}

/** payload 仕分け結果 */
export interface SplitPayloadResult {
  /** companies テーブルに書き込む { dbColumn: value } */
  companies: Record<string, unknown>;
  /** company_profile テーブルに書き込む { dbColumn: value } */
  company_profile: Record<string, unknown>;
  /** マッピングに一致しなかった payload キー（ログ・監査用） */
  skipped_unmapped: string[];
  /** target_table が allowlist 外だったためスキップされたキー */
  skipped_invalid_target: string[];
  /** 適用されたマッピング数 */
  applied_count: number;
}

/** approve 適用結果のサマリー */
export interface ApproveApplyResult {
  companies_updated: string[];
  profile_updated: string[];
  skipped_unmapped: string[];
  skipped_invalid_target: string[];
  mapping_source: 'db' | 'fallback' | 'db+fallback';
}

// ============================================================
// 安全装置: 許可される target_table
// ============================================================

const ALLOWED_TARGET_TABLES = new Set(['companies', 'company_profile']);

// ============================================================
// 許可カラム allowlist
// Phase 3a: target_column がこのリストに無ければスキップ + ログ
// ============================================================

const ALLOWED_COLUMNS: Readonly<Record<string, ReadonlySet<string>>> = {
  companies: new Set([
    'name', 'postal_code', 'prefecture', 'city',
    'industry_major', 'industry_minor',
    'employee_count', 'employee_band',
    'capital', 'annual_revenue', 'established_date',
  ]),
  company_profile: new Set([
    'corp_number', 'corp_type',
    'representative_name', 'representative_title',
    'founding_year', 'founding_month',
    'website_url', 'contact_email', 'contact_phone',
    'business_summary', 'main_products', 'main_customers',
    'competitive_advantage', 'fiscal_year_end',
    'is_profitable', 'has_debt',
    'past_subsidies_json', 'desired_investments_json', 'current_challenges_json',
    'has_young_employees', 'has_female_executives', 'has_senior_employees', 'plans_to_hire',
    'certifications_json', 'constraints_json', 'notes',
    // 0020 追加カラム
    'postal_code', 'address', 'contact_name', 'products_services', 'target_customers',
  ]),
};

// ============================================================
// ハードコードフォールバック
// 
// 設計方針:
// - DB (intake_field_mappings) が正本（最小マッピング: 14行）
// - このフォールバックは「互換拡張 + 不足補完」（38行）
// - DB と fallback は同一内容ではない
//   DB 未登録の camelCase エイリアスや profile extras を fallback が補う
// 
// ソース:
// - submissions.ts 旧 L194-257 + 0020_agency_intake_extension.sql INSERT
// - 0128_fix_intake_field_mapping_bug.sql の修正（annual_revenue → companies）反映済み
// 
// field_key は portal.ts のフォーム name 属性と一致する。
// 加えて、camelCase バリアント（companyName, employeeCount 等）も
// payload_json のキー揺れ対応として含める。
// ============================================================

const FALLBACK_MAPPINGS: ReadonlyArray<IntakeFieldMapping> = [
  // === basic ===
  { id: 'ifm_001', field_key: 'company_name', label_ja: '会社名', input_type: 'text', options_json: null, target_table: 'companies', target_column: 'name', validation_json: '{"required":true,"maxLength":200}', category: 'basic', sort_order: 10 },
  { id: 'ifm_001a', field_key: 'name', label_ja: '会社名', input_type: 'text', options_json: null, target_table: 'companies', target_column: 'name', validation_json: '{"required":true,"maxLength":200}', category: 'basic', sort_order: 10 },
  { id: 'ifm_001b', field_key: 'companyName', label_ja: '会社名', input_type: 'text', options_json: null, target_table: 'companies', target_column: 'name', validation_json: '{"required":true,"maxLength":200}', category: 'basic', sort_order: 10 },
  { id: 'ifm_002', field_key: 'representative_name', label_ja: '代表者名', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'representative_name', validation_json: '{"maxLength":100}', category: 'basic', sort_order: 20 },
  { id: 'ifm_002a', field_key: 'representativeName', label_ja: '代表者名', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'representative_name', validation_json: '{"maxLength":100}', category: 'basic', sort_order: 20 },
  { id: 'ifm_003', field_key: 'founded_date', label_ja: '設立日', input_type: 'date', options_json: null, target_table: 'companies', target_column: 'established_date', validation_json: null, category: 'basic', sort_order: 30 },
  { id: 'ifm_003a', field_key: 'establishedDate', label_ja: '設立日', input_type: 'date', options_json: null, target_table: 'companies', target_column: 'established_date', validation_json: null, category: 'basic', sort_order: 30 },
  { id: 'ifm_004', field_key: 'employee_count', label_ja: '従業員数', input_type: 'number', options_json: null, target_table: 'companies', target_column: 'employee_count', validation_json: '{"min":0,"max":999999}', category: 'basic', sort_order: 40 },
  { id: 'ifm_004a', field_key: 'employeeCount', label_ja: '従業員数', input_type: 'number', options_json: null, target_table: 'companies', target_column: 'employee_count', validation_json: '{"min":0,"max":999999}', category: 'basic', sort_order: 40 },

  // === location ===
  { id: 'ifm_010', field_key: 'prefecture', label_ja: '都道府県', input_type: 'select', options_json: null, target_table: 'companies', target_column: 'prefecture', validation_json: '{"required":true}', category: 'location', sort_order: 50 },
  { id: 'ifm_011', field_key: 'city', label_ja: '市区町村', input_type: 'text', options_json: null, target_table: 'companies', target_column: 'city', validation_json: '{"maxLength":100}', category: 'location', sort_order: 60 },
  { id: 'ifm_012', field_key: 'address', label_ja: '住所', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'address', validation_json: '{"maxLength":300}', category: 'location', sort_order: 70 },
  { id: 'ifm_013', field_key: 'postal_code', label_ja: '郵便番号', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'postal_code', validation_json: '{"pattern":"^[0-9]{3}-?[0-9]{4}$"}', category: 'location', sort_order: 65 },

  // === business ===
  { id: 'ifm_020', field_key: 'industry', label_ja: '業種', input_type: 'select', options_json: null, target_table: 'companies', target_column: 'industry_major', validation_json: null, category: 'business', sort_order: 80 },
  { id: 'ifm_020a', field_key: 'industry_major', label_ja: '業種', input_type: 'select', options_json: null, target_table: 'companies', target_column: 'industry_major', validation_json: null, category: 'business', sort_order: 80 },
  { id: 'ifm_020b', field_key: 'industry_minor', label_ja: '業種（小分類）', input_type: 'text', options_json: null, target_table: 'companies', target_column: 'industry_minor', validation_json: null, category: 'business', sort_order: 81 },
  { id: 'ifm_021', field_key: 'business_summary', label_ja: '事業概要', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'business_summary', validation_json: '{"maxLength":2000}', category: 'business', sort_order: 90 },
  { id: 'ifm_021a', field_key: 'businessSummary', label_ja: '事業概要', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'business_summary', validation_json: '{"maxLength":2000}', category: 'business', sort_order: 90 },
  { id: 'ifm_022', field_key: 'products_services', label_ja: '主な製品・サービス', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'products_services', validation_json: '{"maxLength":2000}', category: 'business', sort_order: 100 },
  { id: 'ifm_023', field_key: 'target_customers', label_ja: 'ターゲット顧客', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'target_customers', validation_json: '{"maxLength":1000}', category: 'business', sort_order: 110 },

  // === financial ===
  { id: 'ifm_030', field_key: 'capital', label_ja: '資本金', input_type: 'number', options_json: null, target_table: 'companies', target_column: 'capital', validation_json: '{"min":0}', category: 'financial', sort_order: 120 },
  { id: 'ifm_031', field_key: 'annual_revenue', label_ja: '年間売上高', input_type: 'number', options_json: null, target_table: 'companies', target_column: 'annual_revenue', validation_json: '{"min":0}', category: 'financial', sort_order: 130 },
  { id: 'ifm_031a', field_key: 'annualRevenue', label_ja: '年間売上高', input_type: 'number', options_json: null, target_table: 'companies', target_column: 'annual_revenue', validation_json: '{"min":0}', category: 'financial', sort_order: 130 },
  { id: 'ifm_032', field_key: 'fiscal_year_end', label_ja: '決算期', input_type: 'select', options_json: null, target_table: 'company_profile', target_column: 'fiscal_year_end', validation_json: null, category: 'financial', sort_order: 140 },

  // === contact ===
  { id: 'ifm_040', field_key: 'contact_name', label_ja: '担当者名', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'contact_name', validation_json: '{"maxLength":100}', category: 'contact', sort_order: 150 },
  { id: 'ifm_041', field_key: 'contact_email', label_ja: 'メールアドレス', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'contact_email', validation_json: '{"pattern":"email"}', category: 'contact', sort_order: 160 },
  { id: 'ifm_041a', field_key: 'contactEmail', label_ja: 'メールアドレス', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'contact_email', validation_json: '{"pattern":"email"}', category: 'contact', sort_order: 160 },
  { id: 'ifm_042', field_key: 'contact_phone', label_ja: '電話番号', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'contact_phone', validation_json: '{"pattern":"phone"}', category: 'contact', sort_order: 170 },
  { id: 'ifm_042a', field_key: 'contactPhone', label_ja: '電話番号', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'contact_phone', validation_json: '{"pattern":"phone"}', category: 'contact', sort_order: 170 },

  // === profile extras (旧 submissions.ts にあったが DB には無い camelCase) ===
  { id: 'ifm_050', field_key: 'representative_title', label_ja: '代表肩書', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'representative_title', validation_json: null, category: 'basic', sort_order: 21 },
  { id: 'ifm_050a', field_key: 'representativeTitle', label_ja: '代表肩書', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'representative_title', validation_json: null, category: 'basic', sort_order: 21 },
  { id: 'ifm_051', field_key: 'website_url', label_ja: 'ウェブサイト', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'website_url', validation_json: null, category: 'contact', sort_order: 155 },
  { id: 'ifm_051a', field_key: 'websiteUrl', label_ja: 'ウェブサイト', input_type: 'text', options_json: null, target_table: 'company_profile', target_column: 'website_url', validation_json: null, category: 'contact', sort_order: 155 },
  { id: 'ifm_052', field_key: 'main_products', label_ja: '主力商品', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'main_products', validation_json: null, category: 'business', sort_order: 95 },
  { id: 'ifm_052a', field_key: 'mainProducts', label_ja: '主力商品', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'main_products', validation_json: null, category: 'business', sort_order: 95 },
  { id: 'ifm_053', field_key: 'main_customers', label_ja: '主要顧客', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'main_customers', validation_json: null, category: 'business', sort_order: 96 },
  { id: 'ifm_053a', field_key: 'mainCustomers', label_ja: '主要顧客', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'main_customers', validation_json: null, category: 'business', sort_order: 96 },
  { id: 'ifm_054', field_key: 'competitive_advantage', label_ja: '競争優位性', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'competitive_advantage', validation_json: null, category: 'business', sort_order: 97 },
  { id: 'ifm_054a', field_key: 'competitiveAdvantage', label_ja: '競争優位性', input_type: 'textarea', options_json: null, target_table: 'company_profile', target_column: 'competitive_advantage', validation_json: null, category: 'business', sort_order: 97 },
];

// ============================================================
// DB 読み取り + フォールバック
// ============================================================

/**
 * intake_field_mappings を DB から取得する。
 * 
 * 取得成功: DB 行 + camelCase エイリアスを返す
 * 取得失敗: FALLBACK_MAPPINGS を返す + console.warn
 * 
 * 返り値は field_key → IntakeFieldMapping のマップ。
 * 同じ target_column に複数の field_key がマッピングされる場合がある（キー揺れ対応）。
 */
export async function getIntakeFieldMappings(
  db: D1Database,
): Promise<{ mappings: Map<string, IntakeFieldMapping>; source: 'db' | 'fallback' | 'db+fallback' }> {
  try {
    const result = await db.prepare(
      'SELECT id, field_key, label_ja, input_type, options_json, target_table, target_column, validation_json, category, sort_order FROM intake_field_mappings ORDER BY sort_order'
    ).all<IntakeFieldMapping>();

    const rows = result.results || [];

    if (rows.length === 0) {
      console.warn('[intake-field-mappings] DB returned 0 rows — falling back to hardcoded mappings');
      return { mappings: buildMappingMap(FALLBACK_MAPPINGS), source: 'fallback' };
    }

    // DB の行を基本マッピングとして採用し、camelCase エイリアスを追加
    const dbWithAliases = addCamelCaseAliases(rows);
    
    // DB 行をベースに、フォールバックに含まれるが DB に無いマッピングを補完
    // これにより DB に INSERT されていない新しいマッピング（0020 カラム等の
    // camelCase エイリアスや profile extras）もカバーされる
    const merged = mergeWithFallback(dbWithAliases, FALLBACK_MAPPINGS);
    const source = merged.length > dbWithAliases.length ? 'db+fallback' : 'db';
    
    if (source === 'db+fallback') {
      console.info(
        `[intake-field-mappings] DB has ${rows.length} rows, supplemented ${merged.length - dbWithAliases.length} from fallback`
      );
    }
    
    return { mappings: buildMappingMap(merged), source };
  } catch (err) {
    console.error('[intake-field-mappings] DB read failed, using fallback:', err);
    return { mappings: buildMappingMap(FALLBACK_MAPPINGS), source: 'fallback' };
  }
}

// ============================================================
// payload 仕分け
// ============================================================

/**
 * payload_json のオブジェクトを、マッピング定義に従って
 * companies / company_profile に仕分ける。
 * 
 * - 同じ target_column に複数 field_key がマッピングされている場合、先に見つかった値を採用
 * - target_table が allowlist 外 → スキップ + 記録
 * - target_column が allowlist 外 → スキップ + 記録
 * - マッピングに無い payload キー → skipped_unmapped に記録
 */
export function splitPayloadByTarget(
  payload: Record<string, unknown>,
  mappings: Map<string, IntakeFieldMapping>,
): SplitPayloadResult {
  const companies: Record<string, unknown> = {};
  const company_profile: Record<string, unknown> = {};
  const skipped_unmapped: string[] = [];
  const skipped_invalid_target: string[] = [];
  let applied_count = 0;

  // 同じ target_column への重複書き込みを防ぐ
  const processedColumns = {
    companies: new Set<string>(),
    company_profile: new Set<string>(),
  };

  const payloadKeys = Object.keys(payload);

  for (const key of payloadKeys) {
    const value = payload[key];
    if (value === undefined) continue;

    const mapping = mappings.get(key);

    if (!mapping) {
      skipped_unmapped.push(key);
      continue;
    }

    const { target_table, target_column } = mapping;

    // 安全装置 A: target_table allowlist
    if (!ALLOWED_TARGET_TABLES.has(target_table)) {
      console.warn(`[intake-field-mappings] Rejected target_table '${target_table}' for field_key '${key}'`);
      skipped_invalid_target.push(key);
      continue;
    }

    // 安全装置 B: target_column allowlist
    const allowedCols = ALLOWED_COLUMNS[target_table];
    if (allowedCols && !allowedCols.has(target_column)) {
      console.warn(`[intake-field-mappings] Rejected unknown column '${target_table}.${target_column}' for field_key '${key}'`);
      skipped_invalid_target.push(key);
      continue;
    }

    // 重複防止: 同じ dbColumn への書き込みは最初の値を採用
    const processedSet = processedColumns[target_table as keyof typeof processedColumns];
    if (processedSet.has(target_column)) {
      continue; // 同じ列に対する別エイリアスの値 → スキップ（静かに）
    }

    // 仕分け
    if (target_table === 'companies') {
      companies[target_column] = value;
    } else {
      company_profile[target_column] = value;
    }
    processedSet.add(target_column);
    applied_count++;
  }

  return {
    companies,
    company_profile,
    skipped_unmapped,
    skipped_invalid_target,
    applied_count,
  };
}

// ============================================================
// ヘルパー
// ============================================================

function buildMappingMap(rows: ReadonlyArray<IntakeFieldMapping>): Map<string, IntakeFieldMapping> {
  const map = new Map<string, IntakeFieldMapping>();
  for (const row of rows) {
    if (!map.has(row.field_key)) {
      map.set(row.field_key, row);
    }
  }
  return map;
}

/**
 * DB から取得したマッピング（エイリアス追加済み）に、
 * フォールバックの中で DB にまだ無い field_key を補完する。
 * DB 行が優先（上書きしない）。
 */
function mergeWithFallback(
  dbMappings: IntakeFieldMapping[],
  fallbackMappings: ReadonlyArray<IntakeFieldMapping>,
): IntakeFieldMapping[] {
  const existingKeys = new Set(dbMappings.map(m => m.field_key));
  const merged = [...dbMappings];

  for (const fb of fallbackMappings) {
    if (!existingKeys.has(fb.field_key)) {
      merged.push(fb);
      existingKeys.add(fb.field_key);
    }
  }

  return merged;
}

/**
 * DB のスネークケース行に対して camelCase エイリアスを追加する。
 * DB には snake_case の field_key しか入っていないが、
 * portal.ts のフォームから camelCase で送られるケースに対応する。
 */
function addCamelCaseAliases(rows: IntakeFieldMapping[]): IntakeFieldMapping[] {
  const result: IntakeFieldMapping[] = [...rows];

  // 既知の snake→camelCase エイリアスマップ
  const ALIASES: Record<string, string[]> = {
    'company_name': ['name', 'companyName'],
    'employee_count': ['employeeCount'],
    'founded_date': ['establishedDate'],
    'annual_revenue': ['annualRevenue'],
    'representative_name': ['representativeName'],
    'representative_title': ['representativeTitle'],
    'website_url': ['websiteUrl'],
    'contact_email': ['contactEmail'],
    'contact_phone': ['contactPhone'],
    'business_summary': ['businessSummary'],
    'main_products': ['mainProducts'],
    'main_customers': ['mainCustomers'],
    'competitive_advantage': ['competitiveAdvantage'],
    'industry': ['industry_major'],
    'industry_major': ['industry'],
  };

  for (const row of rows) {
    const aliases = ALIASES[row.field_key];
    if (aliases) {
      for (const alias of aliases) {
        result.push({
          ...row,
          id: `${row.id}_alias_${alias}`,
          field_key: alias,
        });
      }
    }
  }

  return result;
}

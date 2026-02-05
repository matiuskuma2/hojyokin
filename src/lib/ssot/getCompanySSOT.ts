/**
 * CompanySSOT - 会社情報のSingle Source of Truth
 * 
 * Freeze-MATCH-0: マッチングエンジンへの会社入力を統一
 * 
 * companies + company_profile + chat_facts を統合した読み取り専用ビュー
 * screening.ts はこれのみを参照する
 */

import type { D1Database } from '@cloudflare/workers-types';

// ============================================================
// 型定義
// ============================================================

/**
 * CompanyProfile - company_profile テーブルの型
 */
export interface CompanyProfile {
  company_id: string;
  corp_number: string | null;
  corp_type: string | null;
  representative_name: string | null;
  representative_title: string | null;
  founding_year: number | null;
  founding_month: number | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_summary: string | null;
  main_products: string | null;
  main_customers: string | null;
  competitive_advantage: string | null;
  fiscal_year_end: number | null;
  is_profitable: boolean | null;
  has_debt: boolean | null;
  past_subsidies_json: string | null;
  desired_investments_json: string | null;
  current_challenges_json: string | null;
  has_young_employees: boolean | null;
  has_female_executives: boolean | null;
  has_senior_employees: boolean | null;
  plans_to_hire: boolean | null;
  certifications_json: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * ChatFact - chat_facts テーブルから取得した回答
 */
export interface ChatFact {
  fact_key: string;
  fact_value: string;
  updated_at: string;
}

/**
 * CompanySSOT - マッチングエンジンへの入力型（凍結）
 * 
 * Freeze-MATCH-0: この型のみを performScreening に渡す
 */
export interface CompanySSOT {
  // === companies テーブル（基本情報） ===
  id: string;
  name: string;
  postal_code: string | null;
  prefecture: string | null;          // 都道府県（マッチング必須）
  city: string | null;
  industry_major: string | null;      // 業種大分類（マッチング必須）
  industry_minor: string | null;
  employee_count: number;             // 従業員数（マッチング必須）
  employee_band: string;
  capital: number | null;             // 資本金（中小企業判定）
  established_date: string | null;
  annual_revenue: number | null;
  
  // === company_profile テーブル（詳細情報） ===
  profile: {
    corp_number: string | null;       // 法人番号
    corp_type: string | null;         // 法人種別
    founding_year: number | null;     // 創業年（創業枠判定）
    founding_month: number | null;
    is_profitable: boolean | null;    // 黒字（一部補助金の要件）
    has_debt: boolean | null;
    past_subsidies: string[];         // 過去の補助金受給歴
    certifications: string[];         // 取得認証
    plans_to_hire: boolean | null;    // 採用予定（賃上げ関連）
    has_young_employees: boolean | null;
    has_female_executives: boolean | null;
    has_senior_employees: boolean | null;
    business_summary: string | null;
    main_products: string | null;
    main_customers: string | null;
  };
  
  // === chat_facts テーブル（壁打ちで回答済みの情報） ===
  facts: {
    has_gbiz_id: boolean | null;      // GビズID取得済み
    is_invoice_registered: boolean | null;  // インボイス登録済み
    plans_wage_raise: boolean | null; // 賃上げ予定
    tax_arrears: boolean | null;      // 税金滞納なし
    past_subsidy_same_type: boolean | null; // 同種補助金受給歴
    has_business_plan: boolean | null; // 事業計画書あり
    has_keiei_kakushin: boolean | null; // 経営革新計画承認
    has_jigyou_keizoku: boolean | null; // 事業継続力強化計画認定
    // 任意の追加facts
    [key: string]: boolean | string | null | undefined;
  };
  
  // === 不足情報（マッチングで使用） ===
  missing_fields: MissingField[];
}

/**
 * 不足フィールド情報
 */
export interface MissingField {
  field: string;
  source: 'company' | 'profile' | 'fact';
  severity: 'critical' | 'important' | 'optional';
  label: string;
}

// ============================================================
// 取得関数
// ============================================================

/**
 * CompanySSOT を取得
 * 
 * @param db D1Database インスタンス
 * @param companyId 会社ID
 * @param subsidyId 補助金ID（オプション、補助金固有のfactsを含める場合）
 * @returns CompanySSOT | null
 */
export async function getCompanySSOT(
  db: D1Database,
  companyId: string,
  subsidyId?: string
): Promise<CompanySSOT | null> {
  // 1. companies テーブルから基本情報を取得
  const company = await db
    .prepare(`
      SELECT 
        id, name, postal_code, prefecture, city,
        industry_major, industry_minor, employee_count, employee_band,
        capital, established_date, annual_revenue
      FROM companies
      WHERE id = ?
    `)
    .bind(companyId)
    .first<{
      id: string;
      name: string;
      postal_code: string | null;
      prefecture: string | null;
      city: string | null;
      industry_major: string | null;
      industry_minor: string | null;
      employee_count: number;
      employee_band: string;
      capital: number | null;
      established_date: string | null;
      annual_revenue: number | null;
    }>();
  
  if (!company) {
    return null;
  }
  
  // 2. company_profile テーブルから詳細情報を取得
  const profile = await db
    .prepare(`
      SELECT 
        corp_number, corp_type, founding_year, founding_month,
        is_profitable, has_debt, past_subsidies_json, certifications_json,
        plans_to_hire, has_young_employees, has_female_executives, has_senior_employees,
        business_summary, main_products, main_customers
      FROM company_profile
      WHERE company_id = ?
    `)
    .bind(companyId)
    .first<{
      corp_number: string | null;
      corp_type: string | null;
      founding_year: number | null;
      founding_month: number | null;
      is_profitable: number | null;
      has_debt: number | null;
      past_subsidies_json: string | null;
      certifications_json: string | null;
      plans_to_hire: number | null;
      has_young_employees: number | null;
      has_female_executives: number | null;
      has_senior_employees: number | null;
      business_summary: string | null;
      main_products: string | null;
      main_customers: string | null;
    }>();
  
  // ============================================================
  // 3. chat_facts テーブルからファクト情報を取得
  // 
  // Freeze-Company-SSOT-1: chat_facts 集約ルール凍結
  // 
  // 集約ルール:
  //   1. ORDER BY updated_at DESC で最新順にソート
  //   2. 同じ fact_key がある場合は最初の（最新の）値を採用
  //   3. subsidyId 指定時: subsidy_id = ? OR subsidy_id IS NULL を対象
  //      → 補助金固有の回答 > 全般的回答の優先順
  //   4. subsidyId 未指定時: subsidy_id IS NULL のみを対象
  //
  // 再現性: 同じ companyId + subsidyId で呼び出せば同じ結果
  // ============================================================
  const factsQuery = subsidyId
    ? `SELECT fact_key, fact_value, updated_at FROM chat_facts 
       WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
       ORDER BY 
         CASE WHEN subsidy_id = ? THEN 0 ELSE 1 END,  -- 補助金固有が優先
         updated_at DESC`
    : `SELECT fact_key, fact_value, updated_at FROM chat_facts 
       WHERE company_id = ? AND subsidy_id IS NULL
       ORDER BY updated_at DESC`;
  
  const factsResult = subsidyId
    ? await db.prepare(factsQuery).bind(companyId, subsidyId, subsidyId).all<ChatFact>()
    : await db.prepare(factsQuery).bind(companyId).all<ChatFact>();
  
  // Freeze-Company-SSOT-1: 同じキーは最初の（優先度が高い）ものを採用
  const factsMap = new Map<string, string>();
  for (const fact of (factsResult.results || [])) {
    if (!factsMap.has(fact.fact_key)) {
      factsMap.set(fact.fact_key, fact.fact_value);
    }
  }
  
  // 4. JSON フィールドをパース
  const pastSubsidies = safeJsonParseArray(profile?.past_subsidies_json);
  const certifications = safeJsonParseArray(profile?.certifications_json);
  
  // 5. facts を構造化
  const facts: CompanySSOT['facts'] = {
    has_gbiz_id: parseBooleanFact(factsMap.get('has_gbiz_id')),
    is_invoice_registered: parseBooleanFact(factsMap.get('is_invoice_registered')),
    plans_wage_raise: parseBooleanFact(factsMap.get('plans_wage_raise')),
    tax_arrears: parseBooleanFact(factsMap.get('tax_arrears')),
    past_subsidy_same_type: parseBooleanFact(factsMap.get('past_subsidy_same_type')),
    has_business_plan: parseBooleanFact(factsMap.get('has_business_plan')),
    has_keiei_kakushin: parseBooleanFact(factsMap.get('has_keiei_kakushin')),
    has_jigyou_keizoku: parseBooleanFact(factsMap.get('has_jigyou_keizoku')),
  };
  
  // 追加の facts をマージ
  for (const [key, value] of factsMap.entries()) {
    if (!(key in facts)) {
      facts[key] = value;
    }
  }
  
  // 6. 不足フィールドを検出
  const missingFields = detectMissingFields(company, profile, facts);
  
  // 7. CompanySSOT を構築
  return {
    id: company.id,
    name: company.name,
    postal_code: company.postal_code,
    prefecture: company.prefecture,
    city: company.city,
    industry_major: company.industry_major,
    industry_minor: company.industry_minor,
    employee_count: company.employee_count || 0,
    employee_band: company.employee_band || '1-5',
    capital: company.capital,
    established_date: company.established_date,
    annual_revenue: company.annual_revenue,
    profile: {
      corp_number: profile?.corp_number || null,
      corp_type: profile?.corp_type || null,
      founding_year: profile?.founding_year || null,
      founding_month: profile?.founding_month || null,
      is_profitable: profile?.is_profitable !== null ? Boolean(profile.is_profitable) : null,
      has_debt: profile?.has_debt !== null ? Boolean(profile.has_debt) : null,
      past_subsidies: pastSubsidies,
      certifications: certifications,
      plans_to_hire: profile?.plans_to_hire !== null ? Boolean(profile.plans_to_hire) : null,
      has_young_employees: profile?.has_young_employees !== null ? Boolean(profile.has_young_employees) : null,
      has_female_executives: profile?.has_female_executives !== null ? Boolean(profile.has_female_executives) : null,
      has_senior_employees: profile?.has_senior_employees !== null ? Boolean(profile.has_senior_employees) : null,
      business_summary: profile?.business_summary || null,
      main_products: profile?.main_products || null,
      main_customers: profile?.main_customers || null,
    },
    facts,
    missing_fields: missingFields,
  };
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * JSON 配列を安全にパース
 */
function safeJsonParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * facts の値を boolean に変換
 */
function parseBooleanFact(value: string | undefined): boolean | null {
  if (value === undefined || value === null || value === '') return null;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'はい') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'いいえ') return false;
  return null;
}

/**
 * 不足フィールドを検出
 * 
 * マッチングに必要な情報が欠けている場合に missing_fields に追加
 */
function detectMissingFields(
  company: { prefecture: string | null; industry_major: string | null; employee_count: number; capital: number | null },
  profile: { founding_year: number | null; is_profitable: number | null } | null,
  facts: CompanySSOT['facts']
): MissingField[] {
  const missing: MissingField[] = [];
  
  // === Critical（マッチング判定に必須） ===
  if (!company.prefecture) {
    missing.push({
      field: 'prefecture',
      source: 'company',
      severity: 'critical',
      label: '都道府県',
    });
  }
  
  if (!company.industry_major) {
    missing.push({
      field: 'industry_major',
      source: 'company',
      severity: 'critical',
      label: '業種',
    });
  }
  
  if (!company.employee_count || company.employee_count <= 0) {
    missing.push({
      field: 'employee_count',
      source: 'company',
      severity: 'critical',
      label: '従業員数',
    });
  }
  
  // === Important（多くの補助金で使用） ===
  if (company.capital === null || company.capital === undefined) {
    missing.push({
      field: 'capital',
      source: 'company',
      severity: 'important',
      label: '資本金',
    });
  }
  
  if (!profile?.founding_year) {
    missing.push({
      field: 'founding_year',
      source: 'profile',
      severity: 'important',
      label: '創業年',
    });
  }
  
  // === Optional（特定の補助金で使用） ===
  if (facts.has_gbiz_id === null) {
    missing.push({
      field: 'has_gbiz_id',
      source: 'fact',
      severity: 'optional',
      label: 'GビズID',
    });
  }
  
  if (facts.is_invoice_registered === null) {
    missing.push({
      field: 'is_invoice_registered',
      source: 'fact',
      severity: 'optional',
      label: 'インボイス登録',
    });
  }
  
  if (facts.plans_wage_raise === null) {
    missing.push({
      field: 'plans_wage_raise',
      source: 'fact',
      severity: 'optional',
      label: '賃上げ予定',
    });
  }
  
  return missing;
}

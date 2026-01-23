/**
 * データモデル型定義
 */

// ユーザー
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: 'user' | 'admin' | 'super_admin' | 'agency';
  email_verified_at: string | null;
  password_reset_token: string | null;
  password_reset_expires: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreateInput {
  email: string;
  password: string;
  name?: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string | null;
  role: string;
  email_verified_at: string | null;
  created_at: string;
}

// 企業
export interface Company {
  id: string;
  name: string;
  postal_code: string | null;
  prefecture: string;
  city: string | null;
  industry_major: string;
  industry_minor: string | null;
  employee_count: number;
  employee_band: EmployeeBand;
  capital: number | null;
  established_date: string | null;
  annual_revenue: number | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeBand = '1-5' | '6-20' | '21-50' | '51-100' | '101-300' | '301+';

export interface CompanyCreateInput {
  name: string;
  postal_code?: string;
  prefecture: string;
  city?: string;
  industry_major: string;
  industry_minor?: string;
  employee_count: number;
  capital?: number;
  established_date?: string;
  annual_revenue?: number;
}

export interface CompanyUpdateInput extends Partial<CompanyCreateInput> {}

// 企業メンバーシップ
export interface CompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

// 補助金（正規化）
export interface Subsidy {
  id: string;
  source: 'jgrants' | 'crawled';
  title: string;
  subsidy_max_limit: number | null;
  subsidy_rate: string | null;
  target_area_search: string | null;
  target_industry: string | null;
  target_number_of_employees: string | null;
  acceptance_start_datetime: string | null;
  acceptance_end_datetime: string | null;
  request_reception_display_flag: number;
  detail_json: string | null;
  cached_at: string;
  expires_at: string;
}

// 評価結果
export type EvaluationStatus = 'PROCEED' | 'CAUTION' | 'DO_NOT_PROCEED';

export interface RiskFlag {
  type: 'FINANCING' | 'ORGANIZATION' | 'EXPENSE' | 'BUSINESS_MODEL' | 'COMPLIANCE';
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface MatchReason {
  field: string;
  matched: boolean;
  reason: string;
}

export interface EvaluationRun {
  id: string;
  company_id: string;
  subsidy_id: string;
  status: EvaluationStatus;
  match_score: number;
  match_reasons: MatchReason[];
  risk_flags: RiskFlag[];
  explanation: string;
  created_at: string;
}

// Jグランツ API レスポンス型
export interface JGrantsSearchResult {
  id: string;
  title: string;
  name?: string;
  subsidy_max_limit?: number;
  subsidy_rate?: string;
  target_area_search?: string;
  target_industry?: string;
  target_number_of_employees?: string;
  acceptance_start_datetime?: string;
  acceptance_end_datetime?: string;
  request_reception_display_flag?: number;
}

export interface JGrantsDetailResult extends JGrantsSearchResult {
  description?: string;
  target_area_detail?: string;
  application_requirements?: string;
  eligible_expenses?: string;
  required_documents?: string;
  application_procedure?: string;
  contact_info?: string;
  related_url?: string;
  attachments?: JGrantsAttachment[];
}

export interface JGrantsAttachment {
  id: string;
  name: string;
  url: string;
  file_type?: string;
  file_size?: number;
}

// API レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    has_more?: boolean;
  };
}

// 検索パラメータ
export interface SubsidySearchParams {
  company_id: string;
  keyword?: string;
  acceptance?: 0 | 1;
  sort?: 'acceptance_end_datetime' | 'subsidy_max_limit' | 'created_at';
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

// マッチング結果
export interface MatchResult {
  subsidy: Subsidy;
  evaluation: {
    status: EvaluationStatus;
    score: number;
    match_reasons: MatchReason[];
    risk_flags: RiskFlag[];
    explanation: string;
  };
}

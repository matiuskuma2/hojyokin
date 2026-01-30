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
// P0-2: prefecture, industry_major, employee_count を nullable に変更
// agency経由で登録された顧客は必須項目が未設定の状態で保存される可能性がある
export interface Company {
  id: string;
  name: string;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  industry_major: string | null;
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

// P0-2: CompanyCreateInput でも nullable 許容（agency経由の登録用）
export interface CompanyCreateInput {
  name: string;
  postal_code?: string;
  prefecture?: string | null;
  city?: string;
  industry_major?: string | null;
  industry_minor?: string;
  employee_count?: number;
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
  // P0-2-1: 品質ゲートフラグ
  detail_ready?: boolean; // SEARCHABLE条件を満たすか
  // WALL_CHAT_READY: 壁打ち可能判定
  wall_chat_ready?: boolean;
  wall_chat_missing?: string[];
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
  // 基本情報
  description?: string;
  overview?: string;                      // 事業概要
  
  // 対象・要件
  target_area_detail?: string;            // 対象地域詳細
  target_businesses?: string;             // 対象事業
  target_applicants?: string;             // 対象者詳細（法人・個人等）
  application_requirements?: string;      // 申請要件
  eligible_expenses?: string;             // 対象経費
  
  // 金額情報
  subsidy_min_limit?: number;             // 補助下限額
  subsidy_rate_detail?: string;           // 補助率詳細
  
  // スケジュール
  application_period?: string;            // 申請期間（テキスト）
  deadline?: string;                      // 締切
  
  // 書類・手続き
  required_documents?: string;            // 必要書類
  application_procedure?: string;         // 申請手続き
  
  // お問い合わせ
  contact_info?: string;                  // お問い合わせ（テキスト）
  contact?: {                             // お問い合わせ（構造化）
    organization?: string;
    department?: string;
    phone?: string;
    fax?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
  
  // URL・添付ファイル
  related_url?: string;
  official_url?: string;                  // 公式ページURL
  attachments?: JGrantsAttachment[];
  
  // メタ情報
  fiscal_year?: string;                   // 年度
  implementing_agency?: string;           // 実施機関
  funding_source?: string;                // 財源
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

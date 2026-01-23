-- =====================================================
-- Migration: 0099_reconcile_schema.sql
-- Purpose: 本番DBスキーマとの整合性を確保する reconcile マイグレーション
-- Date: 2026-01-22
-- Updated: 2026-01-23 (FK制約問題修正)
-- =====================================================
-- 
-- 設計原則:
-- 1. 追加のみ（削除・変更なし）
-- 2. 冪等（IF NOT EXISTS / OR IGNORE を活用）
-- 3. 既存データを破壊しない
-- 4. 手動 ALTER が混在していた問題を吸収
--
-- 使用方法:
-- ローカル: npx wrangler d1 execute DB --local --file=migrations/0099_reconcile_schema.sql
-- 本番:     npx wrangler d1 execute DB --remote --file=migrations/0099_reconcile_schema.sql
--
-- 注意: wrangler d1 migrations apply ではなく --file で直接実行を推奨
--       （他のマイグレーションとの競合を避けるため）
--
-- =====================================================

-- 外部キー制約を一時的に無効化（テーブル作成順序の問題を回避）
PRAGMA foreign_keys=OFF;

-- =====================================================
-- PHASE 1: 基本テーブル（0001_initial_schema.sql 相当）
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  email_verified_at TEXT,
  password_reset_token TEXT,
  password_reset_expires TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  postal_code TEXT,
  prefecture TEXT NOT NULL,
  city TEXT,
  industry_major TEXT NOT NULL,
  industry_minor TEXT,
  employee_count INTEGER NOT NULL,
  employee_band TEXT NOT NULL,
  capital INTEGER,
  established_date TEXT,
  annual_revenue INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_prefecture ON companies(prefecture);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry_major, industry_minor);
CREATE INDEX IF NOT EXISTS idx_companies_employee_band ON companies(employee_band);

CREATE TABLE IF NOT EXISTS company_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);

CREATE TABLE IF NOT EXISTS subsidy_cache (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'jgrants',
  title TEXT NOT NULL,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  target_area_search TEXT,
  target_industry TEXT,
  target_number_of_employees TEXT,
  acceptance_start_datetime TEXT,
  acceptance_end_datetime TEXT,
  request_reception_display_flag INTEGER,
  detail_json TEXT,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_acceptance ON subsidy_cache(acceptance_end_datetime);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_area ON subsidy_cache(target_area_search);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_expires ON subsidy_cache(expires_at);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  status TEXT NOT NULL,
  match_score INTEGER NOT NULL,
  match_reasons TEXT,
  risk_flags TEXT,
  explanation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evaluations_company ON evaluation_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_subsidy ON evaluation_runs(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluation_runs(status);

CREATE TABLE IF NOT EXISTS search_cache (
  id TEXT PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  result_json TEXT NOT NULL,
  total_count INTEGER NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_company ON api_usage(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON api_usage(created_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- =====================================================
-- PHASE 2: Knowledge Pipeline (0003, 0005 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS doc_object (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT,
  kind TEXT NOT NULL DEFAULT 'html',
  title TEXT,
  content_text TEXT,
  content_markdown TEXT,
  content_json TEXT,
  page_count INTEGER,
  file_size INTEGER,
  extract_schema TEXT,
  extracted_at TEXT,
  metadata_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_doc_object_url_hash ON doc_object(url_hash);
CREATE INDEX IF NOT EXISTS idx_doc_object_kind ON doc_object(kind);
CREATE INDEX IF NOT EXISTS idx_doc_object_status ON doc_object(status);

CREATE TABLE IF NOT EXISTS source_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region_type TEXT NOT NULL DEFAULT 'national',
  geo_region TEXT,
  base_url TEXT NOT NULL,
  list_url TEXT,
  list_selector TEXT,
  detail_selector TEXT,
  scrape_strategy TEXT NOT NULL DEFAULT 'firecrawl',
  schedule_cron TEXT,
  priority INTEGER DEFAULT 50,
  enabled INTEGER DEFAULT 1,
  last_crawled_at TEXT,
  last_success_at TEXT,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  metadata_json TEXT,
  scope TEXT DEFAULT 'general',
  scope_rules_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_source_registry_region ON source_registry(region_type, geo_region);
CREATE INDEX IF NOT EXISTS idx_source_registry_enabled ON source_registry(enabled);
CREATE INDEX IF NOT EXISTS idx_source_registry_priority ON source_registry(priority);
CREATE INDEX IF NOT EXISTS idx_source_registry_scope ON source_registry(scope);

CREATE TABLE IF NOT EXISTS subsidies (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  source_url TEXT,
  doc_id TEXT,
  external_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  target_area TEXT,
  target_industry TEXT,
  target_employee_count TEXT,
  subsidy_amount TEXT,
  subsidy_rate TEXT,
  application_start TEXT,
  application_end TEXT,
  status TEXT DEFAULT 'active',
  raw_json TEXT,
  embedding_vector TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES source_registry(id),
  FOREIGN KEY (doc_id) REFERENCES doc_object(id)
);
CREATE INDEX IF NOT EXISTS idx_subsidies_source ON subsidies(source_id);
CREATE INDEX IF NOT EXISTS idx_subsidies_status ON subsidies(status);
CREATE INDEX IF NOT EXISTS idx_subsidies_end ON subsidies(application_end);
CREATE INDEX IF NOT EXISTS idx_subsidies_area ON subsidies(target_area);

CREATE TABLE IF NOT EXISTS domain_policy (
  domain_key TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 50,
  rate_limit_rpm INTEGER DEFAULT 10,
  blocked_until TEXT,
  blocked_reason TEXT,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error_code TEXT,
  error_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  avg_response_ms INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_domain_policy_enabled ON domain_policy(enabled);
CREATE INDEX IF NOT EXISTS idx_domain_policy_blocked ON domain_policy(blocked_until);

-- =====================================================
-- PHASE 3-A: Crawl Job (0003, 0007 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS crawl_job (
  job_id TEXT PRIMARY KEY,
  url_id TEXT,                                       -- NULLable for registry-based crawls
  subsidy_id TEXT,                                   -- NULLable
  job_type TEXT NOT NULL DEFAULT 'scrape',           -- 'scrape' | 'crawl' | 'extract' | 'pdf_convert' | 'JOB_REGISTRY_CRAWL' | 'JOB_SUBSIDY_CHECK'
  status TEXT NOT NULL DEFAULT 'pending',            -- 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  progress INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  payload TEXT,                                      -- JSON
  root_url TEXT,                                     -- for source_registry crawls
  source_registry_id TEXT,
  priority INTEGER DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_job_status ON crawl_job(status);
CREATE INDEX IF NOT EXISTS idx_crawl_job_type ON crawl_job(job_type);
CREATE INDEX IF NOT EXISTS idx_crawl_job_cron_dedup ON crawl_job(job_type, root_url, status, created_at);
CREATE INDEX IF NOT EXISTS idx_crawl_job_queue ON crawl_job(status, priority, created_at);

-- Crawl Stats (KPI記録用)
CREATE TABLE IF NOT EXISTS crawl_stats (
  id TEXT PRIMARY KEY,
  stat_date TEXT NOT NULL,                           -- date('now') 形式
  stat_hour INTEGER,                                 -- hour (0-23)
  total_requests INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  error_502_count INTEGER DEFAULT 0,
  error_403_count INTEGER DEFAULT 0,
  error_timeout_count INTEGER DEFAULT 0,
  error_other_count INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  extract_count INTEGER DEFAULT 0,
  extract_success_count INTEGER DEFAULT 0,
  missing_required_fields_count INTEGER DEFAULT 0,
  needs_review_count INTEGER DEFAULT 0,
  estimated_firecrawl_credits REAL DEFAULT 0,
  estimated_llm_tokens INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_stats_date ON crawl_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_crawl_stats_date_hour ON crawl_stats(stat_date, stat_hour);

-- =====================================================
-- PHASE 3-B: Crawl Queue (0008, 0009 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS crawl_queue (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  domain_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'list',
  source_id TEXT,
  parent_id TEXT,
  priority INTEGER DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  picked_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  result_doc_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status ON crawl_queue(status);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_domain ON crawl_queue(domain_key);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_priority ON crawl_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_url_hash ON crawl_queue(url_hash);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_source ON crawl_queue(source_id);

-- =====================================================
-- PHASE 4: Company Profile (0015 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS company_profile (
  company_id TEXT PRIMARY KEY,
  corp_number TEXT,
  corp_type TEXT,
  representative_name TEXT,
  representative_title TEXT,
  founding_year INTEGER,
  founding_month INTEGER,
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  business_summary TEXT,
  main_products TEXT,
  main_customers TEXT,
  competitive_advantage TEXT,
  fiscal_year_end INTEGER,
  is_profitable INTEGER,
  has_debt INTEGER,
  past_subsidies_json TEXT,
  desired_investments_json TEXT,
  current_challenges_json TEXT,
  has_young_employees INTEGER,
  has_female_executives INTEGER,
  has_senior_employees INTEGER,
  plans_to_hire INTEGER,
  certifications_json TEXT,
  constraints_json TEXT,
  notes TEXT,
  -- 0020 で追加されるカラム
  postal_code TEXT,
  address TEXT,
  contact_name TEXT,
  products_services TEXT,
  target_customers TEXT,
  -- fiscal_year_end は INTEGER で定義済み（TEXT版は不要）
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_profile_corp_number ON company_profile(corp_number) WHERE corp_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_profile_founding ON company_profile(founding_year);
CREATE INDEX IF NOT EXISTS idx_company_profile_profitable ON company_profile(is_profitable);
CREATE INDEX IF NOT EXISTS idx_company_profile_hire ON company_profile(plans_to_hire);

-- =====================================================
-- PHASE 5: Chat & Draft (0016 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'collecting',
  precheck_result TEXT,
  missing_items TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company ON chat_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_subsidy ON chat_sessions(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_key TEXT,
  structured_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS chat_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  subsidy_id TEXT,
  fact_key TEXT NOT NULL,
  fact_value TEXT,
  confidence REAL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'chat',
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_facts_company ON chat_facts(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_facts_user ON chat_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_facts_key ON chat_facts(fact_key);

CREATE TABLE IF NOT EXISTS application_drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  sections_json TEXT NOT NULL,
  ng_result_json TEXT,
  trace_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_application_drafts_session ON application_drafts(session_id);
CREATE INDEX IF NOT EXISTS idx_application_drafts_company ON application_drafts(company_id);
CREATE INDEX IF NOT EXISTS idx_application_drafts_status ON application_drafts(status);

CREATE TABLE IF NOT EXISTS company_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  storage_backend TEXT NOT NULL DEFAULT 'r2',
  r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  extracted_json TEXT,
  confidence REAL,
  raw_text TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_doc_type ON company_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_company_documents_status ON company_documents(status);

-- =====================================================
-- PHASE 6: Usage Events (0018 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  company_id TEXT,
  subsidy_id TEXT,
  session_id TEXT,
  provider TEXT,
  model TEXT,
  feature TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd REAL,
  duration_ms INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_date ON usage_events(date(created_at));
CREATE INDEX IF NOT EXISTS idx_usage_events_provider_date ON usage_events(provider, date(created_at));

-- =====================================================
-- PHASE 7: Agency Tables (0019 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  max_clients INTEGER DEFAULT 10,
  settings_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agencies_owner ON agencies(owner_user_id);

CREATE TABLE IF NOT EXISTS agency_members (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',
  permissions_json TEXT,
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(agency_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user ON agency_members(user_id);

CREATE TABLE IF NOT EXISTS agency_clients (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  tags_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(agency_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_clients_agency ON agency_clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_company ON agency_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_status ON agency_clients(status);

CREATE TABLE IF NOT EXISTS access_links (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  short_code TEXT UNIQUE,
  expires_at TEXT NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  revoked_at TEXT,
  issued_by_user_id TEXT NOT NULL,
  last_used_at TEXT,
  last_used_ip TEXT,
  last_used_ua TEXT,
  label TEXT,
  message TEXT,
  template_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_access_links_agency ON access_links(agency_id);
CREATE INDEX IF NOT EXISTS idx_access_links_company ON access_links(company_id);
CREATE INDEX IF NOT EXISTS idx_access_links_token ON access_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_access_links_short ON access_links(short_code);
CREATE INDEX IF NOT EXISTS idx_access_links_expires ON access_links(expires_at);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id TEXT PRIMARY KEY,
  access_link_id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  documents_json TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewed_at TEXT,
  reviewed_by_user_id TEXT,
  review_notes TEXT,
  submitted_ip TEXT,
  submitted_ua TEXT,
  validation_errors_json TEXT,
  source_template_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (access_link_id) REFERENCES access_links(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_agency ON intake_submissions(agency_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_company ON intake_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_status ON intake_submissions(status);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_link ON intake_submissions(access_link_id);

CREATE TABLE IF NOT EXISTS chat_answers (
  id TEXT PRIMARY KEY,
  access_link_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  merged_at TEXT,
  merged_by_user_id TEXT,
  submitted_ip TEXT,
  submitted_ua TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (access_link_id) REFERENCES access_links(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (merged_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_answers_link ON chat_answers(access_link_id);
CREATE INDEX IF NOT EXISTS idx_chat_answers_session ON chat_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_answers_status ON chat_answers(status);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- =====================================================
-- PHASE 8: Intake Templates (0020 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS intake_link_templates (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'intake',
  fields_json TEXT NOT NULL,
  header_text TEXT,
  footer_text TEXT,
  branding_json TEXT,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_intake_link_templates_agency ON intake_link_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_intake_link_templates_type ON intake_link_templates(type);

CREATE TABLE IF NOT EXISTS intake_field_mappings (
  id TEXT PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label_ja TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text',
  options_json TEXT,
  target_table TEXT NOT NULL,
  target_column TEXT,
  validation_json TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_field_mappings_category ON intake_field_mappings(category);

CREATE TABLE IF NOT EXISTS agency_client_history (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changes_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_agency ON agency_client_history(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_company ON agency_client_history(company_id);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_created ON agency_client_history(created_at);

-- =====================================================
-- PHASE 9: KPI & Monitoring (0021 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_subtype TEXT,
  severity TEXT DEFAULT 'info',
  user_id TEXT,
  user_role TEXT,
  agency_id TEXT,
  company_id TEXT,
  request_id TEXT,
  request_method TEXT,
  request_path TEXT,
  request_query TEXT,
  request_body_hash TEXT,
  response_status INTEGER,
  response_time_ms INTEGER,
  metadata_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  country_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_user ON event_log(user_id);
CREATE INDEX IF NOT EXISTS idx_event_log_agency ON event_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
CREATE INDEX IF NOT EXISTS idx_event_log_severity ON event_log(severity);
CREATE INDEX IF NOT EXISTS idx_event_log_request_id ON event_log(request_id);

CREATE TABLE IF NOT EXISTS cost_usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  agency_id TEXT,
  company_id TEXT,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  operation TEXT,
  input_units INTEGER,
  output_units INTEGER,
  total_units INTEGER,
  unit_cost_usd REAL,
  estimated_cost_usd REAL NOT NULL,
  request_id TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  metadata_json TEXT,
  billing_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_user ON cost_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_agency ON cost_usage_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_provider ON cost_usage_log(provider);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_created ON cost_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_billing ON cost_usage_log(billing_status);

CREATE TABLE IF NOT EXISTS data_freshness_log (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_url TEXT,
  check_type TEXT NOT NULL,
  check_result TEXT NOT NULL,
  last_modified_at TEXT,
  content_hash TEXT,
  previous_hash TEXT,
  changes_detected INTEGER DEFAULT 0,
  records_count INTEGER,
  new_records INTEGER,
  updated_records INTEGER,
  deleted_records INTEGER,
  check_duration_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  alert_sent INTEGER DEFAULT 0,
  alert_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_source ON data_freshness_log(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_result ON data_freshness_log(check_result);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_created ON data_freshness_log(created_at);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_alert ON data_freshness_log(alert_sent, alert_type);

CREATE TABLE IF NOT EXISTS kpi_daily_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  agency_users INTEGER DEFAULT 0,
  searches INTEGER DEFAULT 0,
  chat_sessions INTEGER DEFAULT 0,
  chat_messages INTEGER DEFAULT 0,
  drafts_created INTEGER DEFAULT 0,
  drafts_finalized INTEGER DEFAULT 0,
  total_agencies INTEGER DEFAULT 0,
  total_clients INTEGER DEFAULT 0,
  intake_submissions INTEGER DEFAULT 0,
  links_issued INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  openai_cost_usd REAL DEFAULT 0,
  firecrawl_cost_usd REAL DEFAULT 0,
  other_cost_usd REAL DEFAULT 0,
  subsidies_total INTEGER DEFAULT 0,
  subsidies_active INTEGER DEFAULT 0,
  crawl_success INTEGER DEFAULT 0,
  crawl_failed INTEGER DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kpi_daily_snapshots_date ON kpi_daily_snapshots(date);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold REAL NOT NULL,
  time_window_minutes INTEGER DEFAULT 60,
  action_type TEXT NOT NULL,
  action_config_json TEXT,
  enabled INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  trigger_count INTEGER DEFAULT 0,
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);

CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  metric_value REAL,
  threshold REAL,
  message TEXT,
  status TEXT DEFAULT 'fired',
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at);

-- =====================================================
-- PHASE 10: Audit Log (0014 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- =====================================================
-- PHASE 11: セキュリティテーブル (0017 相当)
-- =====================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id TEXT PRIMARY KEY,
  bucket_key TEXT NOT NULL UNIQUE,
  tokens INTEGER NOT NULL DEFAULT 0,
  last_refill_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_key ON rate_limit_buckets(bucket_key);

-- =====================================================
-- PHASE 12: Default Data (冪等挿入)
-- =====================================================

-- デフォルトフィールドマッピング
INSERT OR IGNORE INTO intake_field_mappings (id, field_key, label_ja, input_type, target_table, target_column, category, sort_order, validation_json) VALUES
  ('ifm_001', 'company_name', '会社名', 'text', 'companies', 'name', 'basic', 10, '{"required":true,"maxLength":200}'),
  ('ifm_002', 'representative_name', '代表者名', 'text', 'company_profile', 'representative_name', 'basic', 20, '{"maxLength":100}'),
  ('ifm_003', 'founded_date', '設立日', 'date', 'companies', 'established_date', 'basic', 30, NULL),
  ('ifm_004', 'employee_count', '従業員数', 'number', 'companies', 'employee_count', 'basic', 40, '{"min":0,"max":999999}'),
  ('ifm_010', 'prefecture', '都道府県', 'select', 'companies', 'prefecture', 'location', 50, '{"required":true}'),
  ('ifm_011', 'city', '市区町村', 'text', 'companies', 'city', 'location', 60, '{"maxLength":100}'),
  ('ifm_012', 'address', '住所', 'text', 'company_profile', 'address', 'location', 70, '{"maxLength":300}'),
  ('ifm_013', 'postal_code', '郵便番号', 'text', 'company_profile', 'postal_code', 'location', 65, '{"pattern":"^[0-9]{3}-?[0-9]{4}$"}'),
  ('ifm_020', 'industry', '業種', 'select', 'companies', 'industry_major', 'business', 80, NULL),
  ('ifm_021', 'business_summary', '事業概要', 'textarea', 'company_profile', 'business_summary', 'business', 90, '{"maxLength":2000}'),
  ('ifm_022', 'products_services', '主な製品・サービス', 'textarea', 'company_profile', 'products_services', 'business', 100, '{"maxLength":2000}'),
  ('ifm_023', 'target_customers', 'ターゲット顧客', 'textarea', 'company_profile', 'target_customers', 'business', 110, '{"maxLength":1000}'),
  ('ifm_030', 'capital', '資本金', 'number', 'companies', 'capital', 'financial', 120, '{"min":0}'),
  ('ifm_031', 'annual_revenue', '年間売上高', 'number', 'company_profile', 'annual_revenue', 'financial', 130, '{"min":0}'),
  ('ifm_032', 'fiscal_year_end', '決算期', 'select', 'company_profile', 'fiscal_year_end', 'financial', 140, NULL),
  ('ifm_040', 'contact_name', '担当者名', 'text', 'company_profile', 'contact_name', 'contact', 150, '{"maxLength":100}'),
  ('ifm_041', 'contact_email', 'メールアドレス', 'text', 'company_profile', 'contact_email', 'contact', 160, '{"pattern":"email"}'),
  ('ifm_042', 'contact_phone', '電話番号', 'text', 'company_profile', 'contact_phone', 'contact', 170, '{"pattern":"phone"}');

-- デフォルト intake テンプレート
INSERT OR IGNORE INTO intake_link_templates (id, agency_id, name, type, fields_json, header_text, footer_text, is_default, status) VALUES
  ('default_intake_full', 'SYSTEM', '標準企業情報（フル）', 'intake', 
   '[{"key":"company_name","required":true},{"key":"representative_name"},{"key":"prefecture","required":true},{"key":"city"},{"key":"address"},{"key":"industry"},{"key":"employee_count"},{"key":"capital"},{"key":"annual_revenue"},{"key":"business_summary"},{"key":"contact_name"},{"key":"contact_email"},{"key":"contact_phone"}]',
   '以下のフォームに企業情報をご入力ください。', 
   'ご入力ありがとうございました。担当者が確認後、ご連絡いたします。',
   1, 'active'),
  ('default_intake_simple', 'SYSTEM', '簡易企業情報', 'intake',
   '[{"key":"company_name","required":true},{"key":"prefecture","required":true},{"key":"industry"},{"key":"employee_count"},{"key":"business_summary"}]',
   '基本情報をご入力ください。',
   'ご入力ありがとうございました。',
   0, 'active');

-- デフォルトアラートルール
INSERT OR IGNORE INTO alert_rules (id, name, description, metric, operator, threshold, time_window_minutes, action_type, enabled) VALUES
  ('alert_cost_spike', 'コスト急増検知', '日次コストが前日の3倍を超えた場合', 'cost_daily_ratio', 'gt', 3.0, 1440, 'log', 1),
  ('alert_error_rate', 'エラー率上昇', 'クロールエラー率が20%を超えた場合', 'crawl_error_rate', 'gt', 0.2, 60, 'log', 1),
  ('alert_stale_data', 'データ鮮度低下', '24時間以上更新がないソースがある場合', 'stale_sources_count', 'gt', 0, 1440, 'log', 1),
  ('alert_queue_depth', 'キュー滞留', '待機キューが1000件を超えた場合', 'queue_pending_count', 'gt', 1000, 30, 'log', 1);

-- 外部キー制約を有効化
PRAGMA foreign_keys=ON;

-- =====================================================
-- END OF RECONCILE MIGRATION
-- =====================================================

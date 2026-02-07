-- =====================================================
-- Development Schema for Local Testing
-- =====================================================
-- 
-- 本番マイグレーション (0001〜0122) を完全に統合したローカル開発スキーマ
-- v4.5.0 対応 (2026-02-07 同期)
-- 
-- 変更履歴:
--   2026-02-07: 本番と完全同期。45テーブル追加、company_memberships→user_companies統一
--   2026-01-24: 初版（32テーブル）
--
-- 使用方法:
--   npx wrangler d1 execute subsidy-matching-production --local --file=migrations/dev_schema.sql
--
-- 注意:
--   - IF NOT EXISTS で冪等（何回実行しても安全）
--   - FK制約なし（ローカル開発の柔軟性優先）
--   - 本番は個別マイグレーションで管理
--
-- =====================================================

PRAGMA foreign_keys=OFF;

-- =====================================================
-- PHASE 1: 認証・ユーザー・企業
-- (0001, 0012, 0013, 0017_security)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT DEFAULT 'active',
  email_verified_at TEXT,
  password_reset_token TEXT,
  password_reset_expires TEXT,
  -- 0012: 運用基盤拡張
  is_disabled INTEGER NOT NULL DEFAULT 0,
  disabled_reason TEXT,
  disabled_at TEXT,
  disabled_by TEXT,
  last_login_at TEXT,
  last_login_ip TEXT,
  created_ip TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  lockout_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_disabled ON users(is_disabled);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(lockout_until);

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

-- 正テーブル: user_companies (company_memberships は廃止)
CREATE TABLE IF NOT EXISTS user_companies (
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  is_primary INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_primary ON user_companies(is_primary);

-- 0015: 会社プロフィール拡張
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
  contact_name TEXT,
  postal_code TEXT,
  address TEXT,
  business_summary TEXT,
  main_products TEXT,
  products_services TEXT,
  main_customers TEXT,
  target_customers TEXT,
  competitive_advantage TEXT,
  fiscal_year_end TEXT,
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_profile_corp ON company_profile(corp_number) WHERE corp_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- 0013: パスワードリセットトークン
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token_hash);

-- 0017_security: セキュリティテーブル
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_timestamp ON rate_limit_log(key, timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp ON rate_limit_log(timestamp);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);

-- =====================================================
-- PHASE 2: 補助金キャッシュ・データソース
-- (0001, 0002, 0103, 0107, 0111 拡張カラム反映)
-- =====================================================

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
  -- 0103: wall_chat_ready 拡張
  wall_chat_ready INTEGER DEFAULT 0,
  wall_chat_missing TEXT,
  detail_score INTEGER DEFAULT 0,
  -- 0107: extraction_queue 拡張
  shard_key TEXT,
  -- 0111: canonical 拡張
  wall_chat_mode TEXT,
  canonical_id TEXT,
  is_visible INTEGER DEFAULT 1,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_acceptance ON subsidy_cache(acceptance_end_datetime);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_area ON subsidy_cache(target_area_search);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_expires ON subsidy_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_source ON subsidy_cache(source);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_wall_chat_ready ON subsidy_cache(wall_chat_ready);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_detail_score ON subsidy_cache(detail_score);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_canonical ON subsidy_cache(canonical_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_shard ON subsidy_cache(shard_key);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_searchable ON subsidy_cache(wall_chat_ready, source, acceptance_end_datetime DESC);

CREATE TABLE IF NOT EXISTS eligibility_rules (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  check_type TEXT NOT NULL,
  parameters TEXT,
  source_text TEXT,
  page_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_subsidy ON eligibility_rules(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_category ON eligibility_rules(category);

CREATE TABLE IF NOT EXISTS eligibility_extractions (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL UNIQUE,
  job_id TEXT,
  rules_count INTEGER NOT NULL DEFAULT 0,
  warnings TEXT,
  summary TEXT,
  extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eligibility_extractions_subsidy ON eligibility_extractions(subsidy_id);

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

-- =====================================================
-- PHASE 3: マスタデータ
-- (0028_crawler_mapping)
-- =====================================================

CREATE TABLE IF NOT EXISTS issuer_master (
  id TEXT PRIMARY KEY,
  issuer_type TEXT NOT NULL DEFAULT 'organization',
  name TEXT NOT NULL,
  name_short TEXT,
  name_kana TEXT,
  region_code TEXT,
  city_code TEXT,
  parent_id TEXT,
  subsidy_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_issuer_master_type ON issuer_master(issuer_type);

CREATE TABLE IF NOT EXISTS category_master (
  id TEXT PRIMARY KEY,
  category_type TEXT NOT NULL DEFAULT 'major',
  name TEXT NOT NULL,
  name_en TEXT,
  parent_id TEXT,
  keywords TEXT,
  subsidy_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_category_master_type ON category_master(category_type);

CREATE TABLE IF NOT EXISTS industry_master (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  name_short TEXT,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_industry_master_code ON industry_master(code);

-- =====================================================
-- PHASE 4: クロール・統計
-- (0003, 0007, 0008, 0010)
-- =====================================================

CREATE TABLE IF NOT EXISTS crawl_job (
  job_id TEXT PRIMARY KEY,
  url_id TEXT,
  subsidy_id TEXT,
  job_type TEXT NOT NULL DEFAULT 'scrape',
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  payload TEXT,
  root_url TEXT,
  source_registry_id TEXT,
  priority INTEGER DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_job_status ON crawl_job(status);
CREATE INDEX IF NOT EXISTS idx_crawl_job_type ON crawl_job(job_type);

CREATE TABLE IF NOT EXISTS crawl_stats (
  id TEXT PRIMARY KEY,
  stat_date TEXT NOT NULL,
  stat_hour INTEGER,
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

-- 0003: ナレッジパイプライン
CREATE TABLE IF NOT EXISTS doc_object (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT,
  url TEXT NOT NULL,
  url_hash TEXT,
  doc_type TEXT DEFAULT 'html',
  title TEXT,
  content TEXT,
  content_hash TEXT,
  extracted_at TEXT,
  status TEXT DEFAULT 'raw',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_doc_object_subsidy ON doc_object(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_doc_object_url_hash ON doc_object(url_hash);

CREATE TABLE IF NOT EXISTS source_url (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  url TEXT NOT NULL,
  url_type TEXT DEFAULT 'official',
  title TEXT,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_crawled_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_source_url_subsidy ON source_url(subsidy_id);

CREATE TABLE IF NOT EXISTS knowledge_summary (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  summary_type TEXT DEFAULT 'overview',
  content TEXT NOT NULL,
  source_doc_ids TEXT,
  confidence REAL,
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_summary_subsidy ON knowledge_summary(subsidy_id);

CREATE TABLE IF NOT EXISTS subsidy_metadata (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  source TEXT,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subsidy_metadata_subsidy ON subsidy_metadata(subsidy_id);

-- =====================================================
-- PHASE 5: チャット・ドラフト・ファクト
-- (0016, 0017_raw_text)
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  subsidy_id TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'collecting',
  precheck_result TEXT,
  missing_items TEXT,
  context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company ON chat_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_subsidy ON chat_sessions(subsidy_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  structured_key TEXT,
  structured_value TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS chat_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT,
  subsidy_id TEXT,
  fact_key TEXT NOT NULL,
  fact_value TEXT,
  confidence REAL,
  source TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_facts_company ON chat_facts(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_facts_subsidy ON chat_facts(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_chat_facts_key ON chat_facts(fact_key);

CREATE TABLE IF NOT EXISTS application_drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  company_id TEXT,
  subsidy_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  sections_json TEXT,
  ng_result_json TEXT,
  trace_json TEXT,
  title TEXT,
  content_json TEXT,
  parent_draft_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON application_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_subsidy ON application_drafts(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_drafts_session ON application_drafts(session_id);

CREATE TABLE IF NOT EXISTS company_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  doc_type TEXT,
  original_filename TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  storage_backend TEXT DEFAULT 'r2',
  r2_key TEXT,
  status TEXT,
  extracted_json TEXT,
  confidence REAL,
  raw_text TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);

-- =====================================================
-- PHASE 6: 評価・スクリーニング
-- (0001, 0122)
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT NOT NULL,
  subsidy_id TEXT,
  subsidy_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  score INTEGER DEFAULT 0,
  result_json TEXT,
  match_reasons_json TEXT,
  risk_flags_json TEXT,
  explanation TEXT,
  -- 0122: Freeze-MATCH 拡張
  screening_version TEXT,
  subsidy_source_id TEXT,
  subsidy_cache_id TEXT,
  missing_fields_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_company ON evaluation_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_subsidy ON evaluation_runs(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_status ON evaluation_runs(status);

-- =====================================================
-- PHASE 7: 利用イベント・監査・Cron
-- (0014, 0018, 0101)
-- =====================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT,
  event_type TEXT NOT NULL,
  event_data TEXT,
  provider TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  category TEXT,
  severity TEXT DEFAULT 'info',
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
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  items_processed INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors_json TEXT,
  metadata_json TEXT,
  triggered_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON cron_runs(started_at);

-- =====================================================
-- PHASE 8: Agency（士業）関連
-- (0019, 0020, 0023, 0102, 0113)
-- =====================================================

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  plan_type TEXT DEFAULT 'free',
  max_clients INTEGER DEFAULT 10,
  status TEXT DEFAULT 'active',
  settings_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agencies_owner ON agencies(owner_user_id);

CREATE TABLE IF NOT EXISTS agency_members (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',
  role TEXT NOT NULL DEFAULT 'member',
  permissions_json TEXT,
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  assigned_member_id TEXT,
  notes TEXT,
  tags_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agency_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_clients_agency ON agency_clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_company ON agency_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_status ON agency_clients(status);

CREATE TABLE IF NOT EXISTS access_links (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL DEFAULT 'intake',
  token_hash TEXT UNIQUE,
  short_code TEXT UNIQUE,
  title TEXT,
  description TEXT,
  template_id TEXT,
  fields_json TEXT,
  settings_json TEXT,
  expires_at TEXT,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  revoked_at TEXT,
  issued_by_user_id TEXT,
  last_used_at TEXT,
  last_used_ip TEXT,
  last_used_ua TEXT,
  label TEXT,
  message TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_access_links_short_code ON access_links(short_code);
CREATE INDEX IF NOT EXISTS idx_access_links_agency ON access_links(agency_id);
CREATE INDEX IF NOT EXISTS idx_access_links_token ON access_links(token_hash);

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
  validation_errors_json TEXT,
  source_template_id TEXT,
  submitted_ip TEXT,
  submitted_ua TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_agency ON intake_submissions(agency_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_company ON intake_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_status ON intake_submissions(status);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_answers_link ON chat_answers(access_link_id);
CREATE INDEX IF NOT EXISTS idx_chat_answers_session ON chat_answers(session_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);

-- 0020: Intake拡張
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_link_templates_agency ON intake_link_templates(agency_id);

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

CREATE TABLE IF NOT EXISTS agency_client_history (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changes_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_agency ON agency_client_history(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_company ON agency_client_history(company_id);

-- 0023: スタッフ招待
CREATE TABLE IF NOT EXISTS agency_member_invites (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',
  invite_token_hash TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by_user_id TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_agency ON agency_member_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_email ON agency_member_invites(email);
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_code ON agency_member_invites(invite_code);

-- 0102: 提案キャッシュ
CREATE TABLE IF NOT EXISTS agency_suggestions_cache (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NO',
  rank INTEGER NOT NULL DEFAULT 0,
  match_reasons TEXT,
  risk_flags TEXT,
  subsidy_title TEXT,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  acceptance_end_datetime TEXT,
  company_name TEXT,
  company_prefecture TEXT,
  company_industry TEXT,
  company_employee_count INTEGER,
  score_breakdown TEXT,
  llm_reason TEXT,
  llm_generated_at TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_suggestions_agency ON agency_suggestions_cache(agency_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_company ON agency_suggestions_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON agency_suggestions_cache(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_score ON agency_suggestions_cache(score DESC);

-- 0113: スタッフ認証
CREATE TABLE IF NOT EXISTS agency_staff_credentials (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  staff_email TEXT NOT NULL UNIQUE,
  staff_password_hash TEXT,
  staff_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  permissions_json TEXT,
  invite_token_hash TEXT,
  invite_code TEXT,
  invite_expires_at TEXT,
  invited_by_user_id TEXT,
  invited_at TEXT,
  is_active INTEGER DEFAULT 1,
  password_set_at TEXT,
  last_login_at TEXT,
  last_login_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agency_id, invite_code)
);
CREATE INDEX IF NOT EXISTS idx_staff_cred_agency ON agency_staff_credentials(agency_id);
CREATE INDEX IF NOT EXISTS idx_staff_cred_email ON agency_staff_credentials(staff_email);

-- 0026: フィード既読ステータス
CREATE TABLE IF NOT EXISTS agency_feed_read_status (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  feed_item_id TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agency_id, feed_item_id)
);
CREATE INDEX IF NOT EXISTS idx_feed_read_agency ON agency_feed_read_status(agency_id);

-- =====================================================
-- PHASE 9: フィードソース・アイテム
-- (0026, 0027, 0101, 0104)
-- =====================================================

CREATE TABLE IF NOT EXISTS feed_source_master (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_short TEXT,
  base_url TEXT,
  list_url TEXT,
  api_endpoint TEXT,
  geo_scope TEXT DEFAULT 'national',
  prefecture_code TEXT,
  city_code TEXT,
  data_format TEXT DEFAULT 'html',
  update_frequency TEXT DEFAULT 'daily',
  priority INTEGER DEFAULT 50,
  enabled INTEGER DEFAULT 1,
  requires_auth INTEGER DEFAULT 0,
  auth_config_json TEXT,
  selector_config_json TEXT,
  mapping_config_json TEXT,
  last_sync_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feed_source_type ON feed_source_master(source_type);
CREATE INDEX IF NOT EXISTS idx_feed_source_enabled ON feed_source_master(enabled);

CREATE TABLE IF NOT EXISTS feed_sources (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  region_code TEXT,
  region_name TEXT,
  city_code TEXT,
  city_name TEXT,
  source_name TEXT NOT NULL,
  source_name_short TEXT,
  source_org TEXT,
  source_url TEXT,
  feed_url TEXT,
  api_url TEXT,
  sub_category TEXT,
  parent_source_id TEXT,
  scrape_config_json TEXT,
  scrape_frequency TEXT DEFAULT 'daily',
  last_scraped_at TEXT,
  izumi_category TEXT,
  izumi_source_key TEXT,
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 50,
  news_count INTEGER DEFAULT 0,
  avg_news_per_week REAL DEFAULT 0,
  reliability_score REAL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feed_sources_category ON feed_sources(category);
CREATE INDEX IF NOT EXISTS idx_feed_sources_region ON feed_sources(region_code);
CREATE INDEX IF NOT EXISTS idx_feed_sources_active ON feed_sources(is_active);

CREATE TABLE IF NOT EXISTS subsidy_feed_items (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  source_id TEXT,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_normalized TEXT,
  summary TEXT,
  summary_sanitized TEXT,
  url TEXT NOT NULL,
  detail_url TEXT,
  pdf_urls TEXT,
  issuer_name TEXT,
  issuer_code TEXT,
  prefecture_code TEXT,
  city_code TEXT,
  target_area_codes TEXT,
  category_codes TEXT,
  industry_codes TEXT,
  subsidy_amount_min INTEGER,
  subsidy_amount_max INTEGER,
  subsidy_rate_min REAL,
  subsidy_rate_max REAL,
  subsidy_rate_text TEXT,
  deadline TEXT,
  deadline_text TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  tags_json TEXT,
  eligibility_json TEXT,
  raw_json TEXT,
  content_hash TEXT,
  is_new INTEGER DEFAULT 1,
  -- 0026 追加フィールド
  source_key TEXT,
  published_at TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  region_prefecture TEXT,
  region_city TEXT,
  event_type TEXT,
  subsidy_id TEXT,
  raw_ref TEXT,
  is_read INTEGER DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feed_items_dedupe ON subsidy_feed_items(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_feed_items_source ON subsidy_feed_items(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_prefecture ON subsidy_feed_items(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_feed_items_status ON subsidy_feed_items(status);
CREATE INDEX IF NOT EXISTS idx_feed_items_new ON subsidy_feed_items(is_new);

CREATE TABLE IF NOT EXISTS feed_import_batches (
  id TEXT PRIMARY KEY,
  uploaded_by TEXT NOT NULL,
  filename TEXT,
  format TEXT NOT NULL DEFAULT 'csv',
  row_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS feed_import_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  row_no INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  normalized_json TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  result_item_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feed_daily_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  source_id TEXT,
  total_items INTEGER DEFAULT 0,
  new_items INTEGER DEFAULT 0,
  updated_items INTEGER DEFAULT 0,
  removed_items INTEGER DEFAULT 0,
  active_items INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 0104: フィード障害
CREATE TABLE IF NOT EXISTS feed_failures (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  url TEXT,
  stage TEXT,
  error_type TEXT,
  error_message TEXT,
  http_status INTEGER,
  dedupe_key TEXT,
  subsidy_id TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_retry_at TEXT,
  retry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  resolution_notes TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  cron_run_id TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_feed_failures_source_id ON feed_failures(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_failures_status ON feed_failures(status);

-- =====================================================
-- PHASE 10: KPI・コスト・アラート
-- (0021, 0110)
-- =====================================================

CREATE TABLE IF NOT EXISTS kpi_daily_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0,
  total_agencies INTEGER DEFAULT 0,
  total_clients INTEGER DEFAULT 0,
  total_searches INTEGER DEFAULT 0,
  total_chats INTEGER DEFAULT 0,
  total_drafts INTEGER DEFAULT 0,
  total_intakes INTEGER DEFAULT 0,
  total_links INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  total_subsidies INTEGER DEFAULT 0,
  total_crawls INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  agency_id TEXT,
  company_id TEXT,
  subsidy_id TEXT,
  session_id TEXT,
  severity TEXT DEFAULT 'info',
  request_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_user ON event_log(user_id);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);

CREATE TABLE IF NOT EXISTS cost_usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  agency_id TEXT,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  input_units INTEGER DEFAULT 0,
  output_units INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  unit_type TEXT DEFAULT 'tokens',
  cost_usd REAL DEFAULT 0,
  billing_status TEXT DEFAULT 'known',
  request_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cost_usage_provider ON cost_usage_log(provider);
CREATE INDEX IF NOT EXISTS idx_cost_usage_created ON cost_usage_log(created_at);

CREATE TABLE IF NOT EXISTS api_cost_logs (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  action TEXT NOT NULL,
  source_id TEXT,
  subsidy_id TEXT,
  url TEXT,
  units INTEGER DEFAULT 0,
  unit_type TEXT,
  cost_usd REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  success INTEGER DEFAULT 1,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  raw_usage_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_service ON api_cost_logs(service);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_created ON api_cost_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_subsidy ON api_cost_logs(subsidy_id);

CREATE TABLE IF NOT EXISTS data_freshness_log (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT,
  check_result TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold REAL NOT NULL,
  window_minutes INTEGER DEFAULT 60,
  action TEXT DEFAULT 'log',
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  metric_value REAL,
  threshold REAL,
  status TEXT DEFAULT 'triggered',
  resolved_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);

-- =====================================================
-- PHASE 11: SSOT - Canonical / Snapshot / Izumi
-- (0111, 0112)
-- =====================================================

CREATE TABLE IF NOT EXISTS subsidy_canonical (
  id TEXT PRIMARY KEY,
  program_name TEXT NOT NULL,
  issuer_code TEXT,
  issuer_name TEXT,
  prefecture_code TEXT,
  category TEXT,
  is_active INTEGER DEFAULT 1,
  is_accepting INTEGER DEFAULT 0,
  latest_cache_id TEXT,
  latest_snapshot_id TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_canonical_issuer ON subsidy_canonical(issuer_code);
CREATE INDEX IF NOT EXISTS idx_canonical_pref ON subsidy_canonical(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_canonical_active ON subsidy_canonical(is_active, is_accepting);

CREATE TABLE IF NOT EXISTS subsidy_source_link (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  match_method TEXT,
  match_confidence REAL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_source_link_canonical ON subsidy_source_link(canonical_id);
CREATE INDEX IF NOT EXISTS idx_source_link_source ON subsidy_source_link(source_type, source_id);

CREATE TABLE IF NOT EXISTS subsidy_snapshot (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,
  round_key TEXT,
  acceptance_start TEXT,
  acceptance_end TEXT,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  target_area TEXT,
  target_industry TEXT,
  target_employees TEXT,
  application_url TEXT,
  guideline_url TEXT,
  guideline_pdf_url TEXT,
  detail_json TEXT,
  source TEXT NOT NULL DEFAULT 'jgrants',
  diff_against_snapshot_id TEXT,
  diff_json TEXT,
  is_active INTEGER DEFAULT 1,
  is_accepting INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshot_canonical ON subsidy_snapshot(canonical_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_active ON subsidy_snapshot(is_active, is_accepting);

CREATE TABLE IF NOT EXISTS izumi_subsidies (
  id TEXT PRIMARY KEY,
  policy_id TEXT,
  title TEXT NOT NULL,
  issuer TEXT,
  target_area TEXT,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  acceptance_start TEXT,
  acceptance_end TEXT,
  detail_url TEXT,
  status TEXT DEFAULT 'active',
  raw_json TEXT,
  row_hash TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_visible INTEGER DEFAULT 1,
  canonical_id TEXT,
  crawl_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_izumi_policy ON izumi_subsidies(policy_id);
CREATE INDEX IF NOT EXISTS idx_izumi_canonical ON izumi_subsidies(canonical_id);

CREATE TABLE IF NOT EXISTS izumi_urls (
  id TEXT PRIMARY KEY,
  izumi_subsidy_id TEXT NOT NULL,
  url TEXT NOT NULL,
  url_kind TEXT,
  source_of_truth_url TEXT,
  discovered_from_url TEXT,
  url_type TEXT DEFAULT 'detail',
  title TEXT,
  content_hash TEXT,
  crawl_status TEXT DEFAULT 'pending',
  last_crawled_at TEXT,
  extraction_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_subsidy ON izumi_urls(izumi_subsidy_id);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_crawl ON izumi_urls(crawl_status);

CREATE TABLE IF NOT EXISTS update_job_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  items_checked INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS update_failures (
  id TEXT PRIMARY KEY,
  job_run_id TEXT,
  subsidy_id TEXT,
  source_type TEXT,
  error_type TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_update_failures_status ON update_failures(status);

-- =====================================================
-- PHASE 12: 抽出パイプライン
-- (0106, 0107)
-- =====================================================

CREATE TABLE IF NOT EXISTS extraction_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_id TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT,
  url TEXT NOT NULL,
  url_type TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  text_length INTEGER DEFAULT 0,
  forms_count INTEGER DEFAULT 0,
  fields_count INTEGER DEFAULT 0,
  ocr_pages_processed INTEGER DEFAULT 0,
  ocr_estimated_cost REAL DEFAULT 0,
  failure_reason TEXT,
  failure_message TEXT,
  content_hash TEXT,
  cron_run_id TEXT,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_subsidy_id ON extraction_logs(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_method ON extraction_logs(extraction_method);

CREATE TABLE IF NOT EXISTS extraction_queue (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  shard_key TEXT,
  job_type TEXT NOT NULL DEFAULT 'extract',
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  picked_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_extraction_queue_status ON extraction_queue(status);
CREATE INDEX IF NOT EXISTS idx_extraction_queue_shard ON extraction_queue(shard_key);

-- =====================================================
-- PHASE 13: データパイプライン基盤
-- (0022, 0024)
-- =====================================================

CREATE TABLE IF NOT EXISTS program_items (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  source_registry_id TEXT,
  source_url TEXT,
  title TEXT NOT NULL,
  organizer TEXT,
  target_region TEXT,
  category TEXT,
  application_start TEXT,
  application_end TEXT,
  fiscal_year INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  matched_subsidy_id TEXT,
  match_status TEXT DEFAULT 'unmatched',
  match_confidence REAL,
  matched_at TEXT,
  raw_json TEXT,
  notes TEXT,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_program_items_status ON program_items(status);
CREATE INDEX IF NOT EXISTS idx_program_items_match ON program_items(match_status);

CREATE TABLE IF NOT EXISTS program_item_history (
  id TEXT PRIMARY KEY,
  program_item_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coverage_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  l1_total_sources INTEGER DEFAULT 0,
  l1_enabled_sources INTEGER DEFAULT 0,
  l1_prefectures_covered INTEGER DEFAULT 0,
  l1_score INTEGER DEFAULT 0,
  l2_crawled_today INTEGER DEFAULT 0,
  l2_success_rate REAL DEFAULT 0,
  l2_stale_sources INTEGER DEFAULT 0,
  l2_score INTEGER DEFAULT 0,
  l3_program_items_total INTEGER DEFAULT 0,
  l3_matched_count INTEGER DEFAULT 0,
  l3_unmatched_count INTEGER DEFAULT 0,
  l3_match_rate REAL DEFAULT 0,
  l3_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subsidy_rounds (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT,
  program_item_id TEXT,
  round_name TEXT,
  round_number INTEGER,
  fiscal_year INTEGER,
  application_start TEXT,
  application_end TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  budget_total INTEGER,
  source_url TEXT,
  raw_json TEXT,
  raw_json_hash TEXT,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subsidy_rounds_subsidy ON subsidy_rounds(subsidy_id);

CREATE TABLE IF NOT EXISTS subsidy_documents (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT,
  round_id TEXT,
  program_item_id TEXT,
  doc_type TEXT NOT NULL,
  title TEXT,
  source_url TEXT,
  file_url TEXT,
  file_hash TEXT,
  file_size INTEGER,
  mime_type TEXT,
  ocr_status TEXT DEFAULT 'pending',
  ocr_queued_at TEXT,
  ocr_completed_at TEXT,
  ocr_error TEXT,
  extraction_status TEXT DEFAULT 'pending',
  extraction_queued_at TEXT,
  extraction_completed_at TEXT,
  extraction_error TEXT,
  raw_text TEXT,
  raw_html TEXT,
  page_count INTEGER,
  language TEXT DEFAULT 'ja',
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_subsidy ON subsidy_documents(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_type ON subsidy_documents(doc_type);

CREATE TABLE IF NOT EXISTS ocr_queue (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  processor TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  result_text TEXT,
  result_confidence REAL,
  result_metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_status ON ocr_queue(status);

CREATE TABLE IF NOT EXISTS extraction_results (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  extractor_model TEXT,
  extractor_prompt_version TEXT,
  extracted_json TEXT NOT NULL,
  confidence_score REAL,
  has_purpose INTEGER DEFAULT 0,
  has_target_business INTEGER DEFAULT 0,
  has_target_applicant INTEGER DEFAULT 0,
  has_target_expenses INTEGER DEFAULT 0,
  has_subsidy_rate INTEGER DEFAULT 0,
  has_subsidy_limit INTEGER DEFAULT 0,
  has_required_docs INTEGER DEFAULT 0,
  has_application_procedure INTEGER DEFAULT 0,
  has_scoring_criteria INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_extraction_results_document ON extraction_results(document_id);

CREATE TABLE IF NOT EXISTS subsidy_requirements (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT,
  round_id TEXT,
  extraction_result_id TEXT,
  requirement_type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_normalized TEXT,
  category TEXT,
  is_mandatory INTEGER DEFAULT 1,
  amount INTEGER,
  rate TEXT,
  deadline TEXT,
  confidence REAL,
  source_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subsidy_requirements_subsidy ON subsidy_requirements(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_requirements_type ON subsidy_requirements(requirement_type);

CREATE TABLE IF NOT EXISTS pipeline_stats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  sources_total INTEGER DEFAULT 0,
  sources_enabled INTEGER DEFAULT 0,
  sources_crawled_today INTEGER DEFAULT 0,
  sources_failed_today INTEGER DEFAULT 0,
  documents_total INTEGER DEFAULT 0,
  documents_new_today INTEGER DEFAULT 0,
  ocr_queued INTEGER DEFAULT 0,
  ocr_completed_today INTEGER DEFAULT 0,
  extraction_queued INTEGER DEFAULT 0,
  extraction_completed_today INTEGER DEFAULT 0,
  cache_total INTEGER DEFAULT 0,
  cache_valid INTEGER DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- PHASE 14: ライフサイクル・ドキュメント管理
-- (0006)
-- =====================================================

CREATE TABLE IF NOT EXISTS subsidy_lifecycle (
  subsidy_id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'unknown',
  open_at TEXT,
  close_at TEXT,
  close_reason TEXT,
  budget_close_evidence_url TEXT,
  budget_close_evidence_quote TEXT,
  last_checked_at TEXT,
  next_check_at TEXT,
  check_frequency TEXT DEFAULT 'weekly',
  priority INTEGER DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_status ON subsidy_lifecycle(status);

CREATE TABLE IF NOT EXISTS required_documents_master (
  doc_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phase TEXT,
  default_required_level TEXT DEFAULT 'mandatory',
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS required_documents_by_subsidy (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  doc_code TEXT NOT NULL,
  required_level TEXT DEFAULT 'mandatory',
  notes TEXT,
  source_url TEXT,
  source_quote TEXT,
  confidence REAL,
  needs_review INTEGER DEFAULT 0,
  UNIQUE(subsidy_id, doc_code)
);
CREATE INDEX IF NOT EXISTS idx_req_docs_subsidy ON required_documents_by_subsidy(subsidy_id);

CREATE TABLE IF NOT EXISTS subsidy_status_history (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  prev_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  evidence_url TEXT,
  evidence_quote TEXT,
  changed_by TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_status_history_subsidy ON subsidy_status_history(subsidy_id);

CREATE TABLE IF NOT EXISTS budget_close_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  signal_type TEXT,
  confidence REAL DEFAULT 0.8,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- PHASE 15: P4/P5 更新検知・監視
-- (0120, 0120a, 0121)
-- =====================================================

CREATE TABLE IF NOT EXISTS update_detection_log (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_url TEXT,
  source_type TEXT DEFAULT 'pdf',
  old_content_hash TEXT,
  new_content_hash TEXT,
  changes_detected TEXT,
  change_summary TEXT,
  status TEXT DEFAULT 'pending',
  auto_applicable INTEGER DEFAULT 0,
  applied_at TEXT,
  applied_by TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_update_detection_subsidy ON update_detection_log(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_update_detection_status ON update_detection_log(status);

CREATE TABLE IF NOT EXISTS data_source_monitors (
  id TEXT PRIMARY KEY,
  subsidy_canonical_id TEXT,
  subsidy_cache_id TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  monitor_type TEXT DEFAULT 'webpage',
  check_interval_hours INTEGER DEFAULT 24,
  selectors TEXT,
  url_patterns TEXT,
  content_selectors TEXT,
  last_checked_at TEXT,
  last_changed_at TEXT,
  last_content_hash TEXT,
  last_page_hash TEXT,
  status TEXT DEFAULT 'active',
  error_count INTEGER DEFAULT 0,
  consecutive_errors INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_monitors_status ON data_source_monitors(status);
CREATE INDEX IF NOT EXISTS idx_monitors_subsidy ON data_source_monitors(subsidy_canonical_id);

CREATE TABLE IF NOT EXISTS monitored_files (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  file_name TEXT,
  file_description TEXT,
  file_url TEXT,
  url_pattern TEXT,
  selector TEXT,
  file_type TEXT,
  last_url TEXT,
  last_content_hash TEXT,
  last_modified TEXT,
  last_size INTEGER,
  last_etag TEXT,
  last_checked_at TEXT,
  status TEXT DEFAULT 'active',
  importance TEXT DEFAULT 'high',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_monitored_files_monitor ON monitored_files(monitor_id);

CREATE TABLE IF NOT EXISTS file_change_history (
  id TEXT PRIMARY KEY,
  monitored_file_id TEXT NOT NULL,
  monitor_id TEXT,
  subsidy_id TEXT,
  old_url TEXT,
  new_url TEXT,
  old_content_hash TEXT,
  new_content_hash TEXT,
  old_size INTEGER,
  new_size INTEGER,
  change_type TEXT NOT NULL,
  change_details TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  process_status TEXT DEFAULT 'pending',
  process_result TEXT,
  update_detection_log_id TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_change_history_file ON file_change_history(monitored_file_id);

CREATE TABLE IF NOT EXISTS pending_updates (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  update_type TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  detection_log_id TEXT,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pending_updates_status ON pending_updates(status);

CREATE TABLE IF NOT EXISTS update_notifications (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL,
  user_id TEXT,
  agency_id TEXT,
  notification_type TEXT DEFAULT 'email',
  status TEXT DEFAULT 'pending',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auto_update_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 0121: 不足要件キュー
CREATE TABLE IF NOT EXISTS missing_requirements_queue (
  id TEXT PRIMARY KEY,
  canonical_id TEXT,
  snapshot_id TEXT,
  cache_id TEXT,
  program_name TEXT,
  priority INTEGER DEFAULT 0,
  severity TEXT,
  missing_keys_json TEXT,
  missing_summary TEXT,
  status TEXT DEFAULT 'pending',
  guideline_url TEXT,
  guideline_pdf_url TEXT,
  application_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_missing_req_status ON missing_requirements_queue(status);
CREATE INDEX IF NOT EXISTS idx_missing_req_canonical ON missing_requirements_queue(canonical_id);

-- =====================================================
-- PHASE 16: Discovery Items
-- (0109)
-- =====================================================

CREATE TABLE IF NOT EXISTS discovery_items (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss',
  title TEXT NOT NULL,
  title_normalized TEXT,
  summary TEXT,
  url TEXT NOT NULL,
  detail_url TEXT,
  issuer_name TEXT,
  prefecture_code TEXT,
  target_area_codes TEXT,
  category_codes TEXT,
  subsidy_amount_max INTEGER,
  subsidy_rate_text TEXT,
  acceptance_start TEXT,
  acceptance_end TEXT,
  stage TEXT NOT NULL DEFAULT 'raw',
  quality_score INTEGER DEFAULT 0,
  validation_notes TEXT,
  promoted_at TEXT,
  promoted_to_id TEXT,
  content_hash TEXT,
  raw_json TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discovery_items_source ON discovery_items(source_id, stage);
CREATE INDEX IF NOT EXISTS idx_discovery_items_stage ON discovery_items(stage);
CREATE INDEX IF NOT EXISTS idx_discovery_items_dedupe ON discovery_items(dedupe_key);

CREATE TABLE IF NOT EXISTS discovery_promote_log (
  id TEXT PRIMARY KEY,
  discovery_item_id TEXT NOT NULL,
  subsidy_cache_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'promote',
  quality_score INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- PHASE 17: 補助金テーブル（0099 reconcile 由来）
-- =====================================================

CREATE TABLE IF NOT EXISTS subsidies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  organizer TEXT,
  target_area TEXT,
  target_industry TEXT,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  application_start TEXT,
  application_end TEXT,
  status TEXT DEFAULT 'active',
  source TEXT DEFAULT 'jgrants',
  source_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subsidies_status ON subsidies(status);

-- =====================================================
-- PHASE 18: シードデータ
-- =====================================================

-- 東京都ソース登録
INSERT OR IGNORE INTO feed_source_master (id, source_type, source_key, name, name_short, base_url, list_url, geo_scope, prefecture_code, data_format, update_frequency, priority, enabled) VALUES
  ('src-tokyo-hataraku', 'government', 'tokyo-hataraku', 'TOKYOはたらくネット', 'はたらくネット', 'https://www.hataraku.metro.tokyo.lg.jp', 'https://www.hataraku.metro.tokyo.lg.jp/shien/', 'prefecture', '13', 'html', 'daily', 10, 1),
  ('src-tokyo-kosha', 'government', 'tokyo-kosha', '東京都中小企業振興公社', '都中小公社', 'https://www.tokyo-kosha.or.jp', 'https://www.tokyo-kosha.or.jp/support/josei/index.html', 'prefecture', '13', 'html', 'daily', 10, 1),
  ('src-tokyo-shigoto', 'government', 'tokyo-shigoto', '東京しごと財団', 'しごと財団', 'https://www.shigotozaidan.or.jp', 'https://www.shigotozaidan.or.jp/joseikin/', 'prefecture', '13', 'html', 'daily', 10, 1);

-- J-Net21 ソース登録
INSERT OR IGNORE INTO feed_source_master (id, source_type, source_key, name, name_short, base_url, list_url, geo_scope, data_format, update_frequency, priority, enabled) VALUES
  ('src-jnet21', 'support_info', 'jnet21', 'J-Net21 支援情報ヘッドライン', 'J-Net21', 'https://j-net21.smrj.go.jp', 'https://j-net21.smrj.go.jp/headline/rss/shienjoho-rss.xml', 'national', 'rss', 'daily', 80, 1);

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

-- デフォルトフィールドマッピング
INSERT OR IGNORE INTO intake_field_mappings (id, field_key, label_ja, input_type, target_table, target_column, category, sort_order, validation_json) VALUES
  ('ifm_001', 'company_name', '会社名', 'text', 'companies', 'name', 'basic', 10, '{"required":true,"maxLength":200}'),
  ('ifm_002', 'representative_name', '代表者名', 'text', 'company_profile', 'representative_name', 'basic', 20, '{"maxLength":100}'),
  ('ifm_003', 'founded_date', '設立日', 'date', 'companies', 'established_date', 'basic', 30, NULL),
  ('ifm_004', 'employee_count', '従業員数', 'number', 'companies', 'employee_count', 'basic', 40, '{"min":0,"max":999999}'),
  ('ifm_010', 'prefecture', '都道府県', 'select', 'companies', 'prefecture', 'location', 50, '{"required":true}'),
  ('ifm_011', 'city', '市区町村', 'text', 'companies', 'city', 'location', 60, '{"maxLength":100}'),
  ('ifm_012', 'address', '住所', 'text', 'company_profile', 'address', 'location', 70, '{"maxLength":300}'),
  ('ifm_020', 'industry', '業種', 'select', 'companies', 'industry_major', 'business', 80, NULL),
  ('ifm_021', 'business_summary', '事業概要', 'textarea', 'company_profile', 'business_summary', 'business', 90, '{"maxLength":2000}'),
  ('ifm_030', 'capital', '資本金', 'number', 'companies', 'capital', 'financial', 120, '{"min":0}'),
  ('ifm_031', 'annual_revenue', '年間売上高', 'number', 'company_profile', 'annual_revenue', 'financial', 130, '{"min":0}'),
  ('ifm_040', 'contact_name', '担当者名', 'text', 'company_profile', 'contact_name', 'contact', 150, '{"maxLength":100}'),
  ('ifm_041', 'contact_email', 'メールアドレス', 'text', 'company_profile', 'contact_email', 'contact', 160, '{"pattern":"email"}'),
  ('ifm_042', 'contact_phone', '電話番号', 'text', 'company_profile', 'contact_phone', 'contact', 170, '{"pattern":"phone"}');

-- デフォルトアラートルール
INSERT OR IGNORE INTO alert_rules (id, name, metric, threshold, window_minutes, action, enabled) VALUES
  ('alert_cost_spike', 'コスト急増アラート', 'cost_daily_ratio', 3.0, 1440, 'log', 1),
  ('alert_error_rate', 'クロールエラー率', 'crawl_error_rate', 0.2, 60, 'log', 1),
  ('alert_stale_data', 'データ鮮度警告', 'stale_sources_count', 0, 1440, 'log', 1),
  ('alert_queue_depth', 'キュー深度警告', 'queue_pending_count', 1000, 30, 'log', 1);

-- 必要書類マスター
INSERT OR IGNORE INTO required_documents_master (doc_code, name, phase, default_required_level, sort_order) VALUES
  ('gbizid_prime', 'GビズIDプライム', 'account', 'mandatory', 10),
  ('jgrants_account', 'Jグランツアカウント', 'account', 'mandatory', 20),
  ('corp_registry', '履歴事項全部証明書', 'company', 'mandatory', 30),
  ('business_start_notice', '開業届', 'company', 'conditional', 40),
  ('articles_of_incorporation', '定款', 'company', 'conditional', 50),
  ('financials_2y', '直近2期の決算書', 'financial', 'mandatory', 60),
  ('financials_1y', '直近1期の決算書', 'financial', 'conditional', 70),
  ('business_plan', '事業計画書', 'plan', 'mandatory', 80),
  ('revenue_plan', '収支計画書', 'plan', 'mandatory', 90),
  ('quotes', '見積書', 'cost', 'mandatory', 100),
  ('tax_certificate', '納税証明書', 'compliance', 'mandatory', 110);

-- Discovery ビュー
CREATE VIEW IF NOT EXISTS v_discovery_stats AS
SELECT 
  source_id,
  stage,
  COUNT(*) as count,
  AVG(quality_score) as avg_quality,
  MIN(first_seen_at) as oldest,
  MAX(last_seen_at) as newest
FROM discovery_items
GROUP BY source_id, stage;

PRAGMA foreign_keys=ON;

-- =====================================================
-- END OF DEVELOPMENT SCHEMA
-- テーブル数: 77 (全コード参照テーブル + データ基盤テーブル)
-- 最終同期: 2026-02-07 v4.5.0
-- =====================================================

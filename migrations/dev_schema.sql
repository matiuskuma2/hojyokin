-- =====================================================
-- Development Schema for Local Testing
-- =====================================================
-- 
-- このファイルはローカル開発用の最小スキーマです。
-- 外部キー制約なしで、必要なテーブルのみを作成します。
-- 
-- 使用方法:
--   npx wrangler d1 execute subsidy-matching-production --local --file=migrations/dev_schema.sql
--
-- =====================================================

-- =====================================================
-- PHASE 1: 基本テーブル（認証・企業）
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

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

CREATE TABLE IF NOT EXISTS company_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- =====================================================
-- PHASE 2: 補助金キャッシュ・データソース
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
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_acceptance ON subsidy_cache(acceptance_end_datetime);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_area ON subsidy_cache(target_area_search);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_expires ON subsidy_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_source ON subsidy_cache(source);

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
-- PHASE 4: クロールジョブ・統計
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

-- =====================================================
-- PHASE 5: チャット・ドラフト
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  subsidy_id TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS application_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT,
  subsidy_id TEXT NOT NULL,
  title TEXT,
  content_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  parent_draft_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON application_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_subsidy ON application_drafts(subsidy_id);

-- =====================================================
-- PHASE 6: 利用イベント・監査
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

-- Cron実行履歴テーブル（P2-0 安全ゲート）
CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,              -- 'sync-jgrants', 'scrape-tokyo-kosha', 'scrape-tokyo-shigoto'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed', 'partial'
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  items_processed INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors_json TEXT,                    -- JSON array of error messages
  metadata_json TEXT,                  -- Additional job-specific metadata
  triggered_by TEXT,                   -- 'cron', 'manual', 'api'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON cron_runs(started_at);

-- =====================================================
-- PHASE 7: Agency（士業）関連
-- =====================================================

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL,
  plan_type TEXT DEFAULT 'free',
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
  role TEXT NOT NULL DEFAULT 'member',
  permissions_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agency_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON agency_members(agency_id);

CREATE TABLE IF NOT EXISTS agency_clients (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  assigned_member_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agency_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_clients_agency ON agency_clients(agency_id);

CREATE TABLE IF NOT EXISTS access_links (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT,
  short_code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'intake',
  title TEXT,
  description TEXT,
  template_id TEXT,
  fields_json TEXT,
  settings_json TEXT,
  expires_at TEXT,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  issued_by_user_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_access_links_short_code ON access_links(short_code);
CREATE INDEX IF NOT EXISTS idx_access_links_agency ON access_links(agency_id);

CREATE TABLE IF NOT EXISTS intake_responses (
  id TEXT PRIMARY KEY,
  access_link_id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  company_id TEXT,
  response_data TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_responses_link ON intake_responses(access_link_id);
CREATE INDEX IF NOT EXISTS idx_intake_responses_agency ON intake_responses(agency_id);

-- =====================================================
-- PHASE 8: フィードソース・アイテム（凍結仕様）
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
CREATE INDEX IF NOT EXISTS idx_feed_source_geo ON feed_source_master(geo_scope, prefecture_code);

CREATE TABLE IF NOT EXISTS subsidy_feed_items (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL,
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
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feed_items_dedupe ON subsidy_feed_items(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_feed_items_source ON subsidy_feed_items(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_prefecture ON subsidy_feed_items(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_feed_items_status ON subsidy_feed_items(status);
CREATE INDEX IF NOT EXISTS idx_feed_items_new ON subsidy_feed_items(is_new);
CREATE INDEX IF NOT EXISTS idx_feed_items_first_seen ON subsidy_feed_items(first_seen_at);

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
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON feed_import_batches(status);

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
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON feed_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON feed_import_rows(status);

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
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON feed_daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_source ON feed_daily_snapshots(source_id);

-- =====================================================
-- PHASE 9: KPIスナップショット
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
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date ON kpi_daily_snapshots(snapshot_date);

-- =====================================================
-- PHASE 10: 東京都ソース登録
-- =====================================================

INSERT OR IGNORE INTO feed_source_master (id, source_type, source_key, name, name_short, base_url, list_url, geo_scope, prefecture_code, data_format, update_frequency, priority, enabled) VALUES
  ('src-tokyo-hataraku', 'government', 'tokyo-hataraku', 'TOKYOはたらくネット', 'はたらくネット', 'https://www.hataraku.metro.tokyo.lg.jp', 'https://www.hataraku.metro.tokyo.lg.jp/shien/', 'prefecture', '13', 'html', 'daily', 10, 1),
  ('src-tokyo-kosha', 'government', 'tokyo-kosha', '東京都中小企業振興公社', '都中小公社', 'https://www.tokyo-kosha.or.jp', 'https://www.tokyo-kosha.or.jp/support/josei/index.html', 'prefecture', '13', 'html', 'daily', 10, 1),
  ('src-tokyo-shigoto', 'government', 'tokyo-shigoto', '東京しごと財団', 'しごと財団', 'https://www.shigotozaidan.or.jp', 'https://www.shigotozaidan.or.jp/joseikin/', 'prefecture', '13', 'html', 'daily', 10, 1);

-- =====================================================
-- END OF DEVELOPMENT SCHEMA
-- =====================================================

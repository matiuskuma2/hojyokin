-- =============================================================================
-- 0111_production.sql (Production Version)
-- Canonical Key + Snapshot + izumi tables + subsidy_cache enhancements
-- Feed_source_master dependency excluded
-- =============================================================================

-- =============================================================================
-- PART 1: Canonical Key（制度マスタ）
-- =============================================================================

CREATE TABLE IF NOT EXISTS subsidy_canonical (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT,
  issuer_code TEXT,
  issuer_name TEXT,
  prefecture_code TEXT,
  category_codes TEXT,
  industry_codes TEXT,
  latest_snapshot_id TEXT,
  latest_cache_id TEXT,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_updated_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_canonical_issuer ON subsidy_canonical(issuer_code);
CREATE INDEX IF NOT EXISTS idx_canonical_pref ON subsidy_canonical(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_canonical_name ON subsidy_canonical(name_normalized);
CREATE INDEX IF NOT EXISTS idx_canonical_active ON subsidy_canonical(is_active);
CREATE INDEX IF NOT EXISTS idx_canonical_latest ON subsidy_canonical(latest_cache_id);

-- =============================================================================
-- PART 2: Source Link（ソース紐付け）
-- =============================================================================

CREATE TABLE IF NOT EXISTS subsidy_source_link (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  round_key TEXT,
  match_type TEXT NOT NULL DEFAULT 'auto',
  match_score REAL,
  match_fields TEXT,
  match_reason TEXT,
  verified INTEGER DEFAULT 0,
  verified_by TEXT,
  verified_at TEXT,
  rejected INTEGER DEFAULT 0,
  rejected_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (canonical_id) REFERENCES subsidy_canonical(id) ON DELETE CASCADE,
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_link_canonical ON subsidy_source_link(canonical_id);
CREATE INDEX IF NOT EXISTS idx_link_source ON subsidy_source_link(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_link_match_type ON subsidy_source_link(match_type, verified);
CREATE INDEX IF NOT EXISTS idx_link_unverified ON subsidy_source_link(verified) WHERE verified = 0 AND rejected = 0;

-- =============================================================================
-- PART 3: Snapshot（時点スナップショット）
-- =============================================================================

CREATE TABLE IF NOT EXISTS subsidy_snapshot (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,
  source_link_id TEXT,
  round_key TEXT,
  fiscal_year TEXT,
  acceptance_start TEXT,
  acceptance_end TEXT,
  deadline_text TEXT,
  is_accepting INTEGER DEFAULT 0,
  subsidy_max_limit INTEGER,
  subsidy_min_limit INTEGER,
  subsidy_rate TEXT,
  subsidy_rate_max REAL,
  target_area_codes TEXT,
  target_area_text TEXT,
  target_industry_codes TEXT,
  target_employee_text TEXT,
  official_url TEXT,
  pdf_urls TEXT,
  attachments TEXT,
  detail_json TEXT,
  snapshot_at TEXT NOT NULL DEFAULT (datetime('now')),
  content_hash TEXT,
  superseded_by TEXT,
  diff_against_snapshot_id TEXT,
  diff_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canonical_id) REFERENCES subsidy_canonical(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshot_canonical ON subsidy_snapshot(canonical_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_round ON subsidy_snapshot(canonical_id, round_key);
CREATE INDEX IF NOT EXISTS idx_snapshot_accepting ON subsidy_snapshot(is_accepting, acceptance_end);
CREATE INDEX IF NOT EXISTS idx_snapshot_latest ON subsidy_snapshot(canonical_id, superseded_by) WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_snapshot_date ON subsidy_snapshot(snapshot_at);

-- =============================================================================
-- PART 4: izumi_subsidies（情報の泉メインテーブル）
-- =============================================================================

CREATE TABLE IF NOT EXISTS izumi_subsidies (
  id TEXT PRIMARY KEY,
  policy_id INTEGER NOT NULL UNIQUE,
  detail_url TEXT,
  title TEXT NOT NULL,
  issuer TEXT,
  area TEXT,
  prefecture_code TEXT,
  publish_date TEXT,
  period TEXT,
  max_amount_text TEXT,
  max_amount_value INTEGER,
  difficulty TEXT,
  difficulty_level INTEGER,
  start_fee TEXT,
  success_fee TEXT,
  support_url TEXT,
  support_urls_all TEXT,
  canonical_id TEXT,
  jgrants_id TEXT,
  match_score REAL,
  match_method TEXT,
  detail_ready INTEGER DEFAULT 0,
  wall_chat_ready INTEGER DEFAULT 0,
  wall_chat_mode TEXT DEFAULT 'pending',
  wall_chat_missing TEXT,
  crawl_status TEXT DEFAULT 'pending',
  last_crawled_at TEXT,
  crawl_error TEXT,
  source TEXT DEFAULT 'izumi',
  imported_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  raw_json TEXT,
  row_hash TEXT,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  is_visible INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_izumi_policy_id ON izumi_subsidies(policy_id);
CREATE INDEX IF NOT EXISTS idx_izumi_prefecture ON izumi_subsidies(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_izumi_canonical ON izumi_subsidies(canonical_id);
CREATE INDEX IF NOT EXISTS idx_izumi_jgrants ON izumi_subsidies(jgrants_id);
CREATE INDEX IF NOT EXISTS idx_izumi_crawl_status ON izumi_subsidies(crawl_status);
CREATE INDEX IF NOT EXISTS idx_izumi_wall_chat ON izumi_subsidies(wall_chat_ready, wall_chat_mode);
CREATE INDEX IF NOT EXISTS idx_izumi_active ON izumi_subsidies(is_active);
CREATE INDEX IF NOT EXISTS idx_izumi_row_hash ON izumi_subsidies(row_hash);
CREATE INDEX IF NOT EXISTS idx_izumi_visible ON izumi_subsidies(is_visible);

-- =============================================================================
-- PART 5: izumi_urls（URL管理）
-- =============================================================================

CREATE TABLE IF NOT EXISTS izumi_urls (
  id TEXT PRIMARY KEY,
  policy_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  url_type TEXT,
  is_primary INTEGER DEFAULT 0,
  domain TEXT,
  crawl_status TEXT DEFAULT 'pending',
  crawl_attempts INTEGER DEFAULT 0,
  last_crawled_at TEXT,
  last_error TEXT,
  http_status INTEGER,
  content_hash TEXT,
  extracted_json TEXT,
  extraction_status TEXT,
  extraction_method TEXT,
  url_kind TEXT,
  source_of_truth_url TEXT,
  discovered_from_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(policy_id, url_hash)
);

CREATE INDEX IF NOT EXISTS idx_izumi_urls_policy ON izumi_urls(policy_id);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_domain ON izumi_urls(domain);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_status ON izumi_urls(crawl_status);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_type ON izumi_urls(url_type);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_kind ON izumi_urls(url_kind);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_primary ON izumi_urls(policy_id, is_primary) WHERE is_primary = 1;

-- =============================================================================
-- PART 6: 更新ジョブ管理テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS update_job_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  source_type TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  items_total INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_runs_type ON update_job_runs(job_type);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON update_job_runs(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_started ON update_job_runs(started_at);

CREATE TABLE IF NOT EXISTS update_failures (
  id TEXT PRIMARY KEY,
  job_run_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  failure_type TEXT NOT NULL,
  failure_message TEXT,
  failure_url TEXT,
  failure_data TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TEXT,
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_run_id) REFERENCES update_job_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_failures_job ON update_failures(job_run_id);
CREATE INDEX IF NOT EXISTS idx_failures_source ON update_failures(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_failures_resolved ON update_failures(resolved);
CREATE INDEX IF NOT EXISTS idx_failures_retry ON update_failures(next_retry_at) WHERE resolved = 0;

-- =============================================================================
-- END OF PRODUCTION MIGRATION (TABLES ONLY)
-- =============================================================================

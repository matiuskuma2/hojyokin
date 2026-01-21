-- =====================================================
-- 補助金マッチングシステム D1 スキーマ (Phase 1-A)
-- =====================================================

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                          -- UUID
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                  -- pbkdf2_sha256$iterations$salt$hash
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',            -- 'user' | 'admin' | 'super_admin'
  email_verified_at TEXT,                       -- ISO8601
  password_reset_token TEXT,
  password_reset_expires TEXT,                  -- ISO8601
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

-- 企業テーブル
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,                          -- UUID
  name TEXT NOT NULL,
  postal_code TEXT,
  prefecture TEXT NOT NULL,                     -- 都道府県コード (01-47)
  city TEXT,
  industry_major TEXT NOT NULL,                 -- 大分類コード
  industry_minor TEXT,                          -- 中分類コード
  employee_count INTEGER NOT NULL,              -- 従業員数
  employee_band TEXT NOT NULL,                  -- 従業員帯 ('1-5', '6-20', '21-50', '51-100', '101-300', '301+')
  capital INTEGER,                              -- 資本金（円）
  established_date TEXT,                        -- 設立年月 (YYYY-MM)
  annual_revenue INTEGER,                       -- 年商（円）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_prefecture ON companies(prefecture);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry_major, industry_minor);
CREATE INDEX IF NOT EXISTS idx_companies_employee_band ON companies(employee_band);

-- 企業メンバーシップ（ユーザーと企業の紐付け）
CREATE TABLE IF NOT EXISTS company_memberships (
  id TEXT PRIMARY KEY,                          -- UUID
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',          -- 'owner' | 'admin' | 'member'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);

-- 補助金キャッシュテーブル（Jグランツから取得したデータをキャッシュ）
CREATE TABLE IF NOT EXISTS subsidy_cache (
  id TEXT PRIMARY KEY,                          -- Jグランツの補助金ID
  source TEXT NOT NULL DEFAULT 'jgrants',       -- データソース
  title TEXT NOT NULL,
  subsidy_max_limit INTEGER,                    -- 補助上限額
  subsidy_rate TEXT,                            -- 補助率
  target_area_search TEXT,                      -- 対象地域（検索用）
  target_industry TEXT,                         -- 対象業種
  target_number_of_employees TEXT,              -- 対象従業員規模
  acceptance_start_datetime TEXT,               -- 受付開始日時
  acceptance_end_datetime TEXT,                 -- 受付終了日時
  request_reception_display_flag INTEGER,       -- 受付中フラグ
  detail_json TEXT,                             -- 詳細情報（JSON）
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL                      -- キャッシュ有効期限
);

CREATE INDEX IF NOT EXISTS idx_subsidy_cache_acceptance ON subsidy_cache(acceptance_end_datetime);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_area ON subsidy_cache(target_area_search);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_expires ON subsidy_cache(expires_at);

-- 評価結果テーブル（企業×補助金のマッチング結果）
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,                          -- UUID
  company_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  status TEXT NOT NULL,                         -- 'PROCEED' | 'CAUTION' | 'DO_NOT_PROCEED'
  match_score INTEGER NOT NULL,                 -- 0-100
  match_reasons TEXT,                           -- JSON array
  risk_flags TEXT,                              -- JSON array
  explanation TEXT,                             -- 判定理由の説明
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evaluations_company ON evaluation_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_subsidy ON evaluation_runs(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluation_runs(status);

-- 検索結果キャッシュテーブル
CREATE TABLE IF NOT EXISTS search_cache (
  id TEXT PRIMARY KEY,                          -- ハッシュキー（検索条件から生成）
  query_hash TEXT NOT NULL UNIQUE,              -- 検索条件のハッシュ
  result_json TEXT NOT NULL,                    -- 検索結果（JSON）
  total_count INTEGER NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- API使用量追跡テーブル
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

-- リフレッシュトークンテーブル（将来用）
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

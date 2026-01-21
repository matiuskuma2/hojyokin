-- =============================================================================
-- Migration 0014: 監査ログ
-- 目的: 凍結・復活・再発行など "事故りやすい操作" を必ず追えるようにする
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,                           -- UUID
  
  -- 実行者・対象
  actor_user_id TEXT,                            -- 実行者（nullはシステム）
  target_user_id TEXT,                           -- 対象ユーザー
  target_company_id TEXT,                        -- 対象会社
  target_resource_type TEXT,                     -- 対象リソース種別（user, company, subsidy等）
  target_resource_id TEXT,                       -- 対象リソースID
  
  -- アクション詳細
  action TEXT NOT NULL,                          -- アクション種別（下記参照）
  action_category TEXT NOT NULL,                 -- カテゴリ（auth, admin, data, system）
  severity TEXT NOT NULL DEFAULT 'info',         -- info | warning | critical
  
  -- 詳細データ
  details_json TEXT,                             -- 変更前後・理由などのJSON
  
  -- リクエスト情報
  ip TEXT,
  user_agent TEXT,
  request_id TEXT,                               -- X-Request-Id
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- アクション種別の例:
-- 
-- auth カテゴリ:
--   LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, REGISTER, 
--   PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED,
--   EMAIL_VERIFIED, TOKEN_REFRESHED
--
-- admin カテゴリ:
--   USER_DISABLED, USER_ENABLED, USER_ROLE_CHANGED,
--   PASSWORD_RESET_ISSUED_BY_ADMIN, USER_DELETED,
--   COMPANY_VERIFIED, COMPANY_SUSPENDED
--
-- data カテゴリ:
--   COMPANY_CREATED, COMPANY_UPDATED, COMPANY_DELETED,
--   PROFILE_UPDATED, SUBSIDY_APPLIED
--
-- system カテゴリ:
--   CRON_RUN, CONSUMER_RUN, MIGRATION_APPLIED
-- =============================================================================

-- 実行者で検索（この管理者は何をしたか）
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);

-- 対象ユーザーで検索（このユーザーに何が起きたか）
CREATE INDEX IF NOT EXISTS idx_audit_target_user ON audit_log(target_user_id);

-- 対象会社で検索
CREATE INDEX IF NOT EXISTS idx_audit_target_company ON audit_log(target_company_id);

-- アクション種別で検索（LOGIN_FAILEDを全部出す等）
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- カテゴリで検索（admin操作を全部出す等）
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(action_category);

-- 重要度で検索（criticalだけ出す等）
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(severity);

-- 日時範囲検索
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- リクエストID検索（トラブル追跡）
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_log(request_id);

-- 複合インデックス（ダッシュボード用）
CREATE INDEX IF NOT EXISTS idx_audit_category_created ON audit_log(action_category, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_severity_created ON audit_log(severity, created_at);

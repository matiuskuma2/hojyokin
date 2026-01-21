-- =============================================================================
-- Migration 0012: ユーザー管理・運用基盤
-- 目的: 凍結/復活、最終ログイン、監査の根幹を確定
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. users テーブルに運用列を追加
-- 既存: id, email, password_hash, name, role, email_verified_at, 
--       password_reset_token, password_reset_expires, created_at, updated_at
-- -----------------------------------------------------------------------------

-- 凍結フラグ（運用事故の止血用）
ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;

-- 凍結理由（監査用）
ALTER TABLE users ADD COLUMN disabled_reason TEXT;

-- 凍結日時（いつ凍結されたか）
ALTER TABLE users ADD COLUMN disabled_at TEXT;

-- 凍結実行者（だれが凍結したか）
ALTER TABLE users ADD COLUMN disabled_by TEXT;

-- 最終ログイン日時
ALTER TABLE users ADD COLUMN last_login_at TEXT;

-- 最終ログインIP（不正アクセス検知用）
ALTER TABLE users ADD COLUMN last_login_ip TEXT;

-- 登録時IP（不正登録検知用）
ALTER TABLE users ADD COLUMN created_ip TEXT;

-- 連続ログイン失敗回数（ブルートフォース対策）
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;

-- ロックアウト解除時刻
ALTER TABLE users ADD COLUMN lockout_until TEXT;

-- -----------------------------------------------------------------------------
-- 2. インデックス追加（既存: idx_users_email, idx_users_role, idx_users_password_reset_token）
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_disabled ON users(is_disabled);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(lockout_until);

-- -----------------------------------------------------------------------------
-- 3. user_companies（ユーザーと会社の紐付け）
-- 1ユーザーが複数会社に所属可能な設計（将来拡張に備える）
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_companies (
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',           -- 'owner' | 'admin' | 'member'
  is_primary INTEGER NOT NULL DEFAULT 0,         -- メイン会社フラグ
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  PRIMARY KEY (user_id, company_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_primary ON user_companies(is_primary);

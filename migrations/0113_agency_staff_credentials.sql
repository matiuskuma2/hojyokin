-- =============================================================================
-- 0113_agency_staff_credentials.sql
-- スタッフ認証テーブル（1つのエージェンシーアカウントを複数人で共有）
-- =============================================================================
-- 
-- 設計思想:
-- - スタッフは「別のユーザーアカウント」ではない
-- - スタッフは「同じエージェンシーアカウントにログインできる追加の認証情報」
-- - スタッフがログインすると、エージェンシーオーナーと同じuser_idでセッションが発行される
-- =============================================================================

-- スタッフ認証情報テーブル
CREATE TABLE IF NOT EXISTS agency_staff_credentials (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  
  -- スタッフのログイン情報（エージェンシーオーナーとは別のメール/パスワード）
  staff_email TEXT NOT NULL,
  staff_password_hash TEXT,  -- NULL = 招待中（パスワード未設定）
  staff_name TEXT NOT NULL,
  
  -- 権限
  role TEXT NOT NULL DEFAULT 'staff',  -- 'admin' or 'staff'
  permissions_json TEXT,  -- 将来の細かい権限制御用
  
  -- 招待管理
  invite_token_hash TEXT,  -- パスワード設定用トークン
  invite_code TEXT,        -- 短縮コード
  invite_expires_at TEXT,
  invited_by_user_id TEXT,
  invited_at TEXT,
  
  -- 状態
  is_active INTEGER DEFAULT 1,
  password_set_at TEXT,  -- パスワード設定完了日時
  last_login_at TEXT,
  last_login_ip TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  UNIQUE(staff_email),  -- メールアドレスはシステム全体でユニーク
  UNIQUE(agency_id, invite_code)  -- 招待コードはエージェンシー内でユニーク
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_staff_cred_agency ON agency_staff_credentials(agency_id);
CREATE INDEX IF NOT EXISTS idx_staff_cred_email ON agency_staff_credentials(staff_email);
CREATE INDEX IF NOT EXISTS idx_staff_cred_invite_code ON agency_staff_credentials(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_cred_active ON agency_staff_credentials(agency_id, is_active) WHERE is_active = 1;

-- END OF MIGRATION

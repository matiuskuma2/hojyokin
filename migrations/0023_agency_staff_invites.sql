-- =====================================================
-- 0023_agency_staff_invites.sql
-- Agency スタッフ招待機能
-- =====================================================

-- スタッフ招待テーブル
CREATE TABLE IF NOT EXISTS agency_member_invites (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',  -- 'owner', 'admin', 'staff'
  invite_token_hash TEXT NOT NULL,
  invite_code TEXT NOT NULL,  -- 短いコード（メール用）
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by_user_id TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_agency ON agency_member_invites(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_email ON agency_member_invites(email);
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_code ON agency_member_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_agency_member_invites_token ON agency_member_invites(invite_token_hash);

-- agency_members に name カラムを追加（既存ユーザーの名前をキャッシュ）
-- ALTER TABLE agency_members ADD COLUMN display_name TEXT;
-- Note: SQLiteはALTER TABLE ADD COLUMNをサポートするが、既にテーブルがある場合は無視される

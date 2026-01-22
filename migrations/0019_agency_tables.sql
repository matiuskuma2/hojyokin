-- =====================================================
-- Migration: 0019_agency_tables.sql
-- Purpose: Agency (士業) 機能のためのテーブル追加
-- =====================================================

-- =====================================================
-- 1. agencies: 士業事務所/代理店
-- =====================================================
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  plan TEXT DEFAULT 'free',           -- free / pro / enterprise
  max_clients INTEGER DEFAULT 10,     -- プランによる上限
  settings_json TEXT,                 -- 事務所設定（通知設定など）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agencies_owner ON agencies(owner_user_id);

-- =====================================================
-- 2. agency_members: 事務所メンバー
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_members (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',  -- owner / staff
  permissions_json TEXT,              -- 個別権限（将来拡張用）
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_members_agency ON agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user ON agency_members(user_id);

-- =====================================================
-- 3. agency_clients: 顧客企業（agencyが管理）
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_clients (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,           -- 既存のcompaniesテーブルに紐づく
  client_name TEXT,                   -- 表示用名称（顧客名/担当者名）
  client_email TEXT,                  -- 連絡先メール
  client_phone TEXT,                  -- 連絡先電話
  status TEXT NOT NULL DEFAULT 'active',  -- active / paused / archived
  notes TEXT,                         -- 事務所用メモ
  tags_json TEXT,                     -- タグ（業種、地域など）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(agency_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_clients_agency ON agency_clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_company ON agency_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_status ON agency_clients(status);

-- =====================================================
-- 4. access_links: 顧客向けリンク発行
-- =====================================================
CREATE TABLE IF NOT EXISTS access_links (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  session_id TEXT,                    -- 壁打ちリンクの場合のみ
  type TEXT NOT NULL,                 -- intake / chat / upload
  token_hash TEXT NOT NULL UNIQUE,    -- 生tokenはハッシュ化して保存
  short_code TEXT UNIQUE,             -- 短縮コード（URLに使用）
  expires_at TEXT NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  revoked_at TEXT,
  issued_by_user_id TEXT NOT NULL,
  
  -- 使用履歴
  last_used_at TEXT,
  last_used_ip TEXT,
  last_used_ua TEXT,
  
  -- メタデータ
  label TEXT,                         -- 管理用ラベル
  message TEXT,                       -- 顧客への案内文
  
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

-- =====================================================
-- 5. intake_submissions: 顧客からの入力受付
-- =====================================================
CREATE TABLE IF NOT EXISTS intake_submissions (
  id TEXT PRIMARY KEY,
  access_link_id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  
  -- 入力データ
  payload_json TEXT NOT NULL,         -- 入力内容（JSON）
  documents_json TEXT,                -- アップロード書類情報
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'submitted',  -- submitted / approved / rejected / merged
  
  -- 審査
  reviewed_at TEXT,
  reviewed_by_user_id TEXT,
  review_notes TEXT,
  
  -- 顧客情報
  submitted_ip TEXT,
  submitted_ua TEXT,
  
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

-- =====================================================
-- 6. chat_answers: 顧客からの壁打ち回答（リンク経由）
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_answers (
  id TEXT PRIMARY KEY,
  access_link_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  
  -- 回答データ
  answers_json TEXT NOT NULL,         -- 回答内容（JSON）
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'submitted',  -- submitted / merged
  merged_at TEXT,
  merged_by_user_id TEXT,
  
  -- 顧客情報
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

-- =====================================================
-- 7. users テーブル拡張: agency_id カラム追加
-- =====================================================
-- 注意: SQLiteではALTER TABLEでカラム追加のみ可能
-- agency ロールのユーザーが所属する agency を紐づける

-- agency_id は agency_members で管理するため、usersへの追加は不要
-- role に 'agency' を追加するのみ（既存の user/admin/super_admin に追加）

-- =====================================================
-- 8. notifications: 通知テーブル（agency向け）
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- intake_submitted / chat_answered / deadline_reminder
  title TEXT NOT NULL,
  message TEXT,
  data_json TEXT,                     -- 関連データ（link_id, company_id など）
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- =============================================================================
-- 0016_s3_s4_chat_draft.sql
-- S3: 壁打ちチャット & S4: 申請書ドラフト
-- =============================================================================
-- 実行日: 2026-01-22
-- 説明:
--   - chat_sessions: 壁打ちチャットのセッション管理
--   - chat_messages: チャットメッセージ履歴
--   - chat_facts: チャットで収集した事実（次回以降聞かない資産）
--   - application_drafts: 申請書ドラフト（セクション分割・NG検出・トレース）
-- =============================================================================

-- S3: chat_sessions
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

-- S3: chat_messages
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

-- S3: chat_facts
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

-- S4: application_drafts
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

-- company_documents (IF NOT EXISTS)
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
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_doc_type ON company_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_company_documents_status ON company_documents(status);

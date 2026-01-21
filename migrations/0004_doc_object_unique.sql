-- =====================================================
-- Phase K1 修正: doc_object テーブルに url_id UNIQUE 制約追加
-- ON CONFLICT(url_id) を使うために必要
-- =====================================================

-- SQLiteでは既存テーブルにUNIQUE制約を直接追加できないため、
-- 新しいテーブルを作成してデータを移行する

-- 1. 一時テーブルを作成（UNIQUE制約付き）
CREATE TABLE IF NOT EXISTS doc_object_new (
  id TEXT PRIMARY KEY,
  url_id TEXT NOT NULL UNIQUE,                    -- ★ UNIQUE 追加
  subsidy_id TEXT NOT NULL,
  
  r2_key_raw TEXT,
  r2_key_structured TEXT,
  r2_key_pdf TEXT,
  
  extract_version TEXT DEFAULT 'v1',
  extracted_at TEXT,
  
  page_count INTEGER,
  word_count INTEGER,
  language TEXT DEFAULT 'ja',
  
  confidence REAL,
  needs_review INTEGER DEFAULT 0,
  missing_fields TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (url_id) REFERENCES source_url(url_id) ON DELETE CASCADE
);

-- 2. 既存データを移行（重複がある場合は最新のものを保持）
INSERT OR IGNORE INTO doc_object_new (
  id, url_id, subsidy_id, r2_key_raw, r2_key_structured, r2_key_pdf,
  extract_version, extracted_at, page_count, word_count, language,
  confidence, needs_review, missing_fields, created_at, updated_at
)
SELECT 
  id, url_id, subsidy_id, r2_key_raw, r2_key_structured, r2_key_pdf,
  extract_version, extracted_at, page_count, word_count, language,
  confidence, needs_review, missing_fields, created_at, updated_at
FROM doc_object;

-- 3. 旧テーブルを削除
DROP TABLE IF EXISTS doc_object;

-- 4. 新テーブルをリネーム
ALTER TABLE doc_object_new RENAME TO doc_object;

-- 5. インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_doc_object_url ON doc_object(url_id);
CREATE INDEX IF NOT EXISTS idx_doc_object_subsidy ON doc_object(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_doc_object_version ON doc_object(extract_version);
CREATE INDEX IF NOT EXISTS idx_doc_object_review ON doc_object(needs_review);

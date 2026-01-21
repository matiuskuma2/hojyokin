-- =====================================================
-- Phase K1: 外部ナレッジ収集パイプライン
-- JGrants差分検知→外部URL→Firecrawl→R2/D1保存
-- =====================================================

-- =====================================================
-- 1. subsidy_metadata: JGrantsからの補助金メタデータ
-- =====================================================
CREATE TABLE IF NOT EXISTS subsidy_metadata (
  subsidy_id TEXT PRIMARY KEY,                     -- JGrantsの補助金ID
  title TEXT NOT NULL,                             -- 補助金名
  agency TEXT,                                     -- 実施機関
  acceptance_start TEXT,                           -- 受付開始日 (ISO8601)
  acceptance_end TEXT,                             -- 受付終了日 (ISO8601)
  subsidy_max_limit INTEGER,                       -- 補助上限額
  subsidy_rate TEXT,                               -- 補助率
  target_area TEXT,                                -- 対象地域
  target_industry TEXT,                            -- 対象業種
  target_employees TEXT,                           -- 対象従業員規模
  
  -- 外部リンク（JGrants詳細から抽出）
  inquiry_url TEXT,                                -- 問い合わせURL
  detail_page_url TEXT,                            -- JGrants詳細ページURL
  external_links TEXT,                             -- 抽出した外部リンク (JSON array)
  
  -- 管理用
  jgrants_raw_json TEXT,                           -- JGrants APIレスポンス原文（監査用）
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- 変更検知用
  content_hash TEXT,                               -- 内容ハッシュ（差分検知）
  has_changes INTEGER DEFAULT 0                    -- 前回から変更があったか
);

CREATE INDEX IF NOT EXISTS idx_subsidy_metadata_acceptance ON subsidy_metadata(acceptance_end);
CREATE INDEX IF NOT EXISTS idx_subsidy_metadata_updated ON subsidy_metadata(updated_at);
CREATE INDEX IF NOT EXISTS idx_subsidy_metadata_changes ON subsidy_metadata(has_changes);

-- =====================================================
-- 2. source_url: 外部URL索引（クロール対象管理）
-- =====================================================
CREATE TABLE IF NOT EXISTS source_url (
  url_id TEXT PRIMARY KEY,                         -- UUID
  subsidy_id TEXT NOT NULL,                        -- 関連補助金ID
  url TEXT NOT NULL,                               -- 正規化済みURL
  url_hash TEXT NOT NULL,                          -- URL正規化後のSHA256ハッシュ
  
  -- 分類
  source_type TEXT NOT NULL DEFAULT 'other',       -- 'jgrants_detail' | 'secretariat' | 'prefecture' | 'city' | 'ministry' | 'portal' | 'other'
  doc_type TEXT,                                   -- 'guideline' | 'faq' | 'example' | 'form' | 'announcement' | 'other'
  
  -- クロール状態
  status TEXT NOT NULL DEFAULT 'pending',          -- 'pending' | 'ok' | 'error' | 'blocked' | 'needs_review'
  last_crawled_at TEXT,                            -- 最終クロール日時
  last_error TEXT,                                 -- 最終エラーメッセージ
  error_count INTEGER DEFAULT 0,                   -- 連続エラー回数
  
  -- コンテンツハッシュ（差分検知）
  content_hash TEXT,                               -- 本文Markdownのハッシュ
  etag TEXT,                                       -- HTTPレスポンスのETag
  
  -- 優先度
  priority INTEGER DEFAULT 5,                      -- 1-10 (1=最優先)
  crawl_depth INTEGER DEFAULT 0,                   -- 許可するクロール深度 (0=scrapeのみ)
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_metadata(subsidy_id) ON DELETE CASCADE,
  UNIQUE(url_hash)                                 -- 同一URLの重複防止
);

CREATE INDEX IF NOT EXISTS idx_source_url_subsidy ON source_url(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_source_url_status ON source_url(status);
CREATE INDEX IF NOT EXISTS idx_source_url_type ON source_url(source_type);
CREATE INDEX IF NOT EXISTS idx_source_url_priority ON source_url(priority);
CREATE INDEX IF NOT EXISTS idx_source_url_hash ON source_url(url_hash);

-- =====================================================
-- 3. doc_object: R2保存オブジェクト参照
-- =====================================================
CREATE TABLE IF NOT EXISTS doc_object (
  id TEXT PRIMARY KEY,                             -- UUID
  url_id TEXT NOT NULL,                            -- source_urlへの参照
  subsidy_id TEXT NOT NULL,                        -- 補助金ID（高速参照用）
  
  -- R2キー
  r2_key_raw TEXT,                                 -- raw/{subsidy_id}/{url_hash}.md
  r2_key_structured TEXT,                          -- structured/{subsidy_id}/{url_hash}.json
  r2_key_pdf TEXT,                                 -- pdf/{subsidy_id}/{filename}.pdf（PDF原本がある場合）
  
  -- 抽出メタ
  extract_version TEXT DEFAULT 'v1',               -- スキーマバージョン
  extracted_at TEXT,                               -- 抽出日時
  
  -- コンテンツ情報
  page_count INTEGER,                              -- ページ数（PDFの場合）
  word_count INTEGER,                              -- 文字数
  language TEXT DEFAULT 'ja',                      -- 言語
  
  -- 抽出品質
  confidence REAL,                                 -- 抽出信頼度 (0.0-1.0)
  needs_review INTEGER DEFAULT 0,                  -- 要レビューフラグ
  missing_fields TEXT,                             -- 欠落フィールド (JSON array)
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (url_id) REFERENCES source_url(url_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_object_url ON doc_object(url_id);
CREATE INDEX IF NOT EXISTS idx_doc_object_subsidy ON doc_object(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_doc_object_version ON doc_object(extract_version);
CREATE INDEX IF NOT EXISTS idx_doc_object_review ON doc_object(needs_review);

-- =====================================================
-- 4. crawl_job: クロールジョブキュー
-- =====================================================
CREATE TABLE IF NOT EXISTS crawl_job (
  job_id TEXT PRIMARY KEY,                         -- UUID
  url_id TEXT NOT NULL,                            -- source_urlへの参照
  subsidy_id TEXT NOT NULL,                        -- 補助金ID
  
  -- ジョブ種別
  job_type TEXT NOT NULL DEFAULT 'scrape',         -- 'scrape' | 'crawl' | 'extract' | 'pdf_convert'
  
  -- 状態
  status TEXT NOT NULL DEFAULT 'pending',          -- 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  progress INTEGER DEFAULT 0,                      -- 0-100
  
  -- 実行情報
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- ペイロード（Firecrawlオプション等）
  payload TEXT,                                    -- JSON
  result TEXT,                                     -- 結果JSON
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (url_id) REFERENCES source_url(url_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawl_job_status ON crawl_job(status);
CREATE INDEX IF NOT EXISTS idx_crawl_job_subsidy ON crawl_job(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_crawl_job_url ON crawl_job(url_id);
CREATE INDEX IF NOT EXISTS idx_crawl_job_created ON crawl_job(created_at);

-- =====================================================
-- 5. knowledge_summary: 壁打ち用の統合ナレッジ
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_summary (
  id TEXT PRIMARY KEY,                             -- UUID
  subsidy_id TEXT NOT NULL UNIQUE,                 -- 補助金ID（1対1）
  
  -- Schema v1の主要フィールド（検索・表示用に非正規化）
  eligibility_summary TEXT,                        -- 対象者要件の要約
  funding_summary TEXT,                            -- 補助金額・率の要約
  deadline_summary TEXT,                           -- 期限の要約
  documents_summary TEXT,                          -- 必要書類の要約
  
  -- 詳細JSON（壁打ちBot参照用）
  eligibility_json TEXT,                           -- 詳細な対象者要件 (JSON)
  funding_json TEXT,                               -- 詳細な補助金情報 (JSON)
  deadlines_json TEXT,                             -- 詳細な期限情報 (JSON)
  required_documents_json TEXT,                    -- 詳細な必要書類 (JSON)
  how_to_write_json TEXT,                          -- 記入例・審査観点 (JSON)
  examples_json TEXT,                              -- 活用事例 (JSON)
  
  -- ソース情報
  source_count INTEGER DEFAULT 0,                  -- 統合したソース数
  source_types TEXT,                               -- 使用したソースタイプ (JSON array)
  last_source_urls TEXT,                           -- 主要ソースURL (JSON array)
  
  -- 品質管理
  quality_score REAL,                              -- 総合品質スコア (0.0-1.0)
  warnings TEXT,                                   -- 警告 (JSON array)
  needs_update INTEGER DEFAULT 0,                  -- 更新が必要か
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_metadata(subsidy_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_summary_subsidy ON knowledge_summary(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_summary_quality ON knowledge_summary(quality_score);
CREATE INDEX IF NOT EXISTS idx_knowledge_summary_update ON knowledge_summary(needs_update);

-- =====================================================
-- 6. crawl_history: クロール履歴（差分追跡用）
-- =====================================================
CREATE TABLE IF NOT EXISTS crawl_history (
  id TEXT PRIMARY KEY,                             -- UUID
  url_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  
  -- スナップショット
  content_hash TEXT NOT NULL,                      -- コンテンツハッシュ
  r2_key_snapshot TEXT,                            -- 変更時のスナップショットR2キー
  
  -- 変更内容
  changed_fields TEXT,                             -- 変更されたフィールド (JSON array)
  change_type TEXT,                                -- 'created' | 'updated' | 'deleted'
  
  crawled_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (url_id) REFERENCES source_url(url_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawl_history_url ON crawl_history(url_id);
CREATE INDEX IF NOT EXISTS idx_crawl_history_subsidy ON crawl_history(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_crawl_history_crawled ON crawl_history(crawled_at);

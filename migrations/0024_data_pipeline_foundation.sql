-- =====================================================
-- Migration: 0024_data_pipeline_foundation.sql
-- Purpose: データ基盤構築 - 補助金データパイプライン
-- Date: 2026-01-23
-- =====================================================
--
-- 設計背景:
-- - 「量を追う」前に「構造を固める」
-- - raw保存 → OCR → 抽出 → 正規化のパイプライン
-- - 変更検知ベースの効率的な収集
-- - "申請書が全部違う"に対応（rounds/documents分離）
--
-- 新規テーブル:
-- 1. subsidy_rounds: 募集回（第○回・受付期間ごと）
-- 2. subsidy_documents: PDF/様式管理
-- 3. ocr_queue: OCR処理キュー
-- 4. extraction_results: 抽出結果
-- 5. subsidy_requirements: 要件・対象経費・必要書類
--
-- =====================================================

-- =====================================================
-- 1. subsidy_rounds: 募集回（制度×時期の軸）
-- =====================================================
-- 「申請書が全部同じになる」問題の解決策
-- 同じ制度でも募集回ごとに要件・様式が異なる
CREATE TABLE IF NOT EXISTS subsidy_rounds (
  id TEXT PRIMARY KEY,
  
  -- 親制度との紐付け
  subsidy_id TEXT,                           -- subsidy_cache.id（または program_items.id）
  program_item_id TEXT,                      -- program_items.id（L3突合用）
  
  -- 識別情報
  round_name TEXT,                           -- 第○回、令和○年度 etc.
  round_number INTEGER,                      -- 募集回番号（1, 2, 3...）
  fiscal_year INTEGER,                       -- 対象年度（2024, 2025...）
  
  -- 受付期間
  application_start TEXT,                    -- 募集開始日（ISO8601）
  application_end TEXT,                      -- 募集終了日（ISO8601）
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'unknown',    -- upcoming / open / closed / cancelled / unknown
  
  -- 金額・率（募集回ごとに変わる可能性）
  subsidy_max_limit INTEGER,                 -- 上限額（円）
  subsidy_rate TEXT,                         -- 補助率（例: "2/3", "1/2"）
  budget_total INTEGER,                      -- 予算総額
  
  -- メタデータ
  source_url TEXT,                           -- 情報取得元URL
  raw_json TEXT,                             -- 生データ（変更検知用）
  raw_json_hash TEXT,                        -- raw_jsonのハッシュ（変更検知用）
  
  -- タイムスタンプ
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_cache(id) ON DELETE SET NULL,
  FOREIGN KEY (program_item_id) REFERENCES program_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subsidy_rounds_subsidy ON subsidy_rounds(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_rounds_program ON subsidy_rounds(program_item_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_rounds_status ON subsidy_rounds(status);
CREATE INDEX IF NOT EXISTS idx_subsidy_rounds_end ON subsidy_rounds(application_end);
CREATE INDEX IF NOT EXISTS idx_subsidy_rounds_fiscal ON subsidy_rounds(fiscal_year);

-- =====================================================
-- 2. subsidy_documents: PDF/様式/要領管理
-- =====================================================
-- PDFは"資産"として貯め、後でOCR/抽出
CREATE TABLE IF NOT EXISTS subsidy_documents (
  id TEXT PRIMARY KEY,
  
  -- 紐付け（どちらか必須）
  subsidy_id TEXT,                           -- subsidy_cache.id
  round_id TEXT,                             -- subsidy_rounds.id
  program_item_id TEXT,                      -- program_items.id
  
  -- ドキュメント情報
  doc_type TEXT NOT NULL,                    -- guideline（公募要領）/ application_form（申請様式）/ 
                                             -- budget_form（収支予算書）/ checklist（チェックリスト）/
                                             -- guidelines_summary（概要）/ faq / other
  title TEXT,                                -- ドキュメントタイトル
  
  -- URL/ファイル
  source_url TEXT,                           -- 取得元URL
  file_url TEXT,                             -- 保存先URL（R2等）
  file_hash TEXT,                            -- ファイルハッシュ（変更検知用）
  file_size INTEGER,                         -- ファイルサイズ（bytes）
  mime_type TEXT,                            -- MIME type（application/pdf等）
  
  -- 処理ステータス
  ocr_status TEXT DEFAULT 'pending',         -- pending / queued / processing / completed / failed / skipped
  ocr_queued_at TEXT,
  ocr_completed_at TEXT,
  ocr_error TEXT,
  
  -- 抽出ステータス
  extraction_status TEXT DEFAULT 'pending',  -- pending / queued / processing / completed / failed
  extraction_queued_at TEXT,
  extraction_completed_at TEXT,
  extraction_error TEXT,
  
  -- raw保存（必須）
  raw_text TEXT,                             -- OCR結果 or HTMLテキスト
  raw_html TEXT,                             -- 元HTML（HTML形式の場合）
  
  -- メタデータ
  page_count INTEGER,                        -- ページ数（PDF）
  language TEXT DEFAULT 'ja',                -- 言語
  
  -- タイムスタンプ
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subsidy_documents_subsidy ON subsidy_documents(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_round ON subsidy_documents(round_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_program ON subsidy_documents(program_item_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_type ON subsidy_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_ocr ON subsidy_documents(ocr_status);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_extraction ON subsidy_documents(extraction_status);
CREATE INDEX IF NOT EXISTS idx_subsidy_documents_hash ON subsidy_documents(file_hash);

-- =====================================================
-- 3. ocr_queue: OCR処理キュー
-- =====================================================
-- PDF来たら必ずOCRキューへ
CREATE TABLE IF NOT EXISTS ocr_queue (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,                 -- subsidy_documents.id
  
  -- 処理情報
  status TEXT NOT NULL DEFAULT 'queued',     -- queued / processing / completed / failed / cancelled
  priority INTEGER DEFAULT 0,                -- 優先度（高いほど先）
  attempts INTEGER DEFAULT 0,                -- 試行回数
  max_attempts INTEGER DEFAULT 3,            -- 最大試行回数
  
  -- 処理詳細
  processor TEXT,                            -- 処理エンジン（aws-textract / google-vision / tesseract / gpt-4-vision）
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  
  -- 結果
  result_text TEXT,                          -- 抽出テキスト
  result_confidence REAL,                    -- 信頼度スコア（0-1）
  result_metadata TEXT,                      -- JSON: ページ別結果等
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (document_id) REFERENCES subsidy_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ocr_queue_status ON ocr_queue(status);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_priority ON ocr_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_document ON ocr_queue(document_id);

-- =====================================================
-- 4. extraction_results: 抽出結果（構造化データ）
-- =====================================================
-- OCRテキストから要件・経費・書類を抽出
CREATE TABLE IF NOT EXISTS extraction_results (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,                 -- subsidy_documents.id
  
  -- 抽出バージョン管理（再抽出時の比較用）
  version INTEGER DEFAULT 1,
  extractor_model TEXT,                      -- 使用モデル（gpt-4 / claude-3 / rule-based）
  extractor_prompt_version TEXT,             -- プロンプトバージョン
  
  -- 抽出結果（JSON）
  extracted_json TEXT NOT NULL,              -- 構造化された抽出結果
  confidence_score REAL,                     -- 全体の信頼度（0-1）
  
  -- 個別フィールドの抽出状態（品質観測用）
  has_purpose INTEGER DEFAULT 0,             -- 目的・概要
  has_target_business INTEGER DEFAULT 0,     -- 対象事業
  has_target_applicant INTEGER DEFAULT 0,    -- 対象者要件
  has_target_expenses INTEGER DEFAULT 0,     -- 対象経費
  has_subsidy_rate INTEGER DEFAULT 0,        -- 補助率
  has_subsidy_limit INTEGER DEFAULT 0,       -- 上限額
  has_required_docs INTEGER DEFAULT 0,       -- 必要書類
  has_application_procedure INTEGER DEFAULT 0, -- 申請手順
  has_scoring_criteria INTEGER DEFAULT 0,    -- 審査基準・加点項目
  
  -- ステータス
  status TEXT DEFAULT 'draft',               -- draft / reviewed / approved / rejected
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (document_id) REFERENCES subsidy_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_extraction_results_document ON extraction_results(document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_results_status ON extraction_results(status);
CREATE INDEX IF NOT EXISTS idx_extraction_results_version ON extraction_results(document_id, version);

-- =====================================================
-- 5. subsidy_requirements: 正規化された要件データ
-- =====================================================
-- extraction_resultsから抽出した要件を正規化
CREATE TABLE IF NOT EXISTS subsidy_requirements (
  id TEXT PRIMARY KEY,
  
  -- 紐付け
  subsidy_id TEXT,                           -- subsidy_cache.id
  round_id TEXT,                             -- subsidy_rounds.id
  extraction_result_id TEXT,                 -- extraction_results.id（抽出元）
  
  -- 要件タイプ
  requirement_type TEXT NOT NULL,            -- applicant（対象者）/ expense（対象経費）/ 
                                             -- document（必要書類）/ scoring（加点項目）/ 
                                             -- exclusion（除外条件）/ other
  
  -- 内容
  content TEXT NOT NULL,                     -- 要件内容
  content_normalized TEXT,                   -- 正規化された内容（マッチング用）
  category TEXT,                             -- サブカテゴリ
  is_mandatory INTEGER DEFAULT 1,            -- 必須か任意か
  
  -- 追加情報（タイプ別）
  amount INTEGER,                            -- 金額（対象経費の場合）
  rate TEXT,                                 -- 率（補助率の場合）
  deadline TEXT,                             -- 期限（書類の場合）
  
  -- 信頼度
  confidence REAL,                           -- 抽出信頼度
  source_text TEXT,                          -- 抽出元テキスト
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_cache(id) ON DELETE SET NULL,
  FOREIGN KEY (round_id) REFERENCES subsidy_rounds(id) ON DELETE SET NULL,
  FOREIGN KEY (extraction_result_id) REFERENCES extraction_results(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_subsidy_requirements_subsidy ON subsidy_requirements(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_requirements_round ON subsidy_requirements(round_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_requirements_type ON subsidy_requirements(requirement_type);
CREATE INDEX IF NOT EXISTS idx_subsidy_requirements_extraction ON subsidy_requirements(extraction_result_id);

-- =====================================================
-- 6. pipeline_stats: パイプライン統計（日次観測用）
-- =====================================================
CREATE TABLE IF NOT EXISTS pipeline_stats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  
  -- ソース統計
  sources_total INTEGER DEFAULT 0,
  sources_enabled INTEGER DEFAULT 0,
  sources_crawled_today INTEGER DEFAULT 0,
  sources_failed_today INTEGER DEFAULT 0,
  
  -- ドキュメント統計
  documents_total INTEGER DEFAULT 0,
  documents_new_today INTEGER DEFAULT 0,
  documents_pdf_count INTEGER DEFAULT 0,
  documents_html_count INTEGER DEFAULT 0,
  
  -- OCR統計
  ocr_queued INTEGER DEFAULT 0,
  ocr_processing INTEGER DEFAULT 0,
  ocr_completed_today INTEGER DEFAULT 0,
  ocr_failed_today INTEGER DEFAULT 0,
  
  -- 抽出統計
  extraction_queued INTEGER DEFAULT 0,
  extraction_completed_today INTEGER DEFAULT 0,
  extraction_failed_today INTEGER DEFAULT 0,
  
  -- 品質統計（抽出結果の充足率）
  fill_rate_purpose REAL DEFAULT 0,
  fill_rate_target REAL DEFAULT 0,
  fill_rate_expenses REAL DEFAULT 0,
  fill_rate_rate REAL DEFAULT 0,
  fill_rate_limit REAL DEFAULT 0,
  fill_rate_docs REAL DEFAULT 0,
  
  -- subsidy_cache統計
  cache_total INTEGER DEFAULT 0,
  cache_valid INTEGER DEFAULT 0,
  cache_has_documents INTEGER DEFAULT 0,
  cache_has_requirements INTEGER DEFAULT 0,
  
  -- タイムスタンプ
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stats_date ON pipeline_stats(date);

-- =====================================================
-- 7. source_registry 拡張（既存テーブルにカラム追加）
-- =====================================================
-- 変更検知用のカラムを追加

-- html_hash: 一覧ページのHTMLハッシュ（変更検知用）
-- last_html_hash: 前回のHTMLハッシュ
-- change_detected_at: 変更検知日時
-- ※ ALTER TABLE は既存カラムがあるとエラーになるため、存在チェックは省略
-- ※ 実運用では PRAGMA table_info でチェックしてから実行

-- 安全な追加方法（エラー無視）
-- SQLiteはIF NOT EXISTSをALTER TABLEでサポートしないため、
-- アプリ側で存在チェックするか、エラーを無視する

-- =====================================================
-- 8. ビュー: パイプライン状況サマリー
-- =====================================================
DROP VIEW IF EXISTS pipeline_summary;
CREATE VIEW pipeline_summary AS
SELECT 
  -- ソース
  (SELECT COUNT(*) FROM source_registry WHERE enabled = 1) as sources_enabled,
  (SELECT COUNT(*) FROM source_registry WHERE last_crawled_at >= datetime('now', '-24 hours')) as sources_crawled_24h,
  
  -- ドキュメント
  (SELECT COUNT(*) FROM subsidy_documents) as documents_total,
  (SELECT COUNT(*) FROM subsidy_documents WHERE doc_type = 'guideline') as documents_guidelines,
  (SELECT COUNT(*) FROM subsidy_documents WHERE doc_type = 'application_form') as documents_forms,
  (SELECT COUNT(*) FROM subsidy_documents WHERE ocr_status = 'pending') as ocr_pending,
  (SELECT COUNT(*) FROM subsidy_documents WHERE ocr_status = 'completed') as ocr_completed,
  (SELECT COUNT(*) FROM subsidy_documents WHERE extraction_status = 'completed') as extraction_completed,
  
  -- OCRキュー
  (SELECT COUNT(*) FROM ocr_queue WHERE status = 'queued') as ocr_queue_waiting,
  (SELECT COUNT(*) FROM ocr_queue WHERE status = 'processing') as ocr_queue_processing,
  
  -- 抽出結果の品質
  (SELECT COUNT(*) FROM extraction_results WHERE has_target_applicant = 1) as extractions_with_target,
  (SELECT COUNT(*) FROM extraction_results WHERE has_target_expenses = 1) as extractions_with_expenses,
  (SELECT COUNT(*) FROM extraction_results WHERE has_required_docs = 1) as extractions_with_docs,
  
  -- 要件
  (SELECT COUNT(*) FROM subsidy_requirements) as requirements_total,
  (SELECT COUNT(*) FROM subsidy_requirements WHERE requirement_type = 'applicant') as requirements_applicant,
  (SELECT COUNT(*) FROM subsidy_requirements WHERE requirement_type = 'expense') as requirements_expense,
  (SELECT COUNT(*) FROM subsidy_requirements WHERE requirement_type = 'document') as requirements_document,
  
  -- 募集回
  (SELECT COUNT(*) FROM subsidy_rounds) as rounds_total,
  (SELECT COUNT(*) FROM subsidy_rounds WHERE status = 'open') as rounds_open,
  
  -- キャッシュ
  (SELECT COUNT(*) FROM subsidy_cache) as cache_total,
  (SELECT COUNT(*) FROM subsidy_cache WHERE expires_at > datetime('now')) as cache_valid,
  
  datetime('now') as generated_at;

-- =====================================================
-- 9. ビュー: OCR処理待ちドキュメント（優先順）
-- =====================================================
DROP VIEW IF EXISTS ocr_pending_documents;
CREATE VIEW ocr_pending_documents AS
SELECT 
  d.id,
  d.title,
  d.doc_type,
  d.source_url,
  d.file_size,
  d.subsidy_id,
  d.round_id,
  sc.title as subsidy_title,
  d.discovered_at
FROM subsidy_documents d
LEFT JOIN subsidy_cache sc ON d.subsidy_id = sc.id
WHERE d.ocr_status = 'pending'
  AND d.mime_type = 'application/pdf'
ORDER BY 
  CASE d.doc_type 
    WHEN 'guideline' THEN 1 
    WHEN 'application_form' THEN 2 
    ELSE 3 
  END,
  d.discovered_at ASC;

-- =====================================================
-- 10. ビュー: 抽出品質ダッシュボード
-- =====================================================
DROP VIEW IF EXISTS extraction_quality_dashboard;
CREATE VIEW extraction_quality_dashboard AS
SELECT 
  COUNT(*) as total_extractions,
  SUM(has_purpose) as with_purpose,
  SUM(has_target_applicant) as with_target,
  SUM(has_target_expenses) as with_expenses,
  SUM(has_subsidy_rate) as with_rate,
  SUM(has_subsidy_limit) as with_limit,
  SUM(has_required_docs) as with_docs,
  SUM(has_application_procedure) as with_procedure,
  SUM(has_scoring_criteria) as with_scoring,
  ROUND(AVG(confidence_score) * 100, 1) as avg_confidence_pct,
  ROUND(SUM(has_purpose) * 100.0 / COUNT(*), 1) as fill_rate_purpose_pct,
  ROUND(SUM(has_target_applicant) * 100.0 / COUNT(*), 1) as fill_rate_target_pct,
  ROUND(SUM(has_target_expenses) * 100.0 / COUNT(*), 1) as fill_rate_expenses_pct,
  ROUND(SUM(has_required_docs) * 100.0 / COUNT(*), 1) as fill_rate_docs_pct
FROM extraction_results
WHERE status != 'rejected';

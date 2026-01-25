-- =====================================================
-- 0106_extraction_logs.sql
-- PDF/HTML抽出ログテーブル（OCRコスト追跡用）
-- 
-- 目的:
-- - 抽出処理の詳細ログを記録
-- - OCR実行回数・ページ数を可視化
-- - コスト分析・失敗原因の特定に使用
-- =====================================================

-- 抽出ログテーブル
CREATE TABLE IF NOT EXISTS extraction_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 対象制度
  subsidy_id TEXT NOT NULL,
  source TEXT NOT NULL,           -- 'tokyo-shigoto' | 'jgrants' | etc.
  title TEXT,
  
  -- 抽出元URL
  url TEXT NOT NULL,
  url_type TEXT NOT NULL,         -- 'html' | 'pdf'
  
  -- 抽出方法
  extraction_method TEXT NOT NULL, -- 'html' | 'firecrawl' | 'vision_ocr' | 'native_pdf'
  
  -- 結果
  success INTEGER NOT NULL DEFAULT 0,  -- 0=失敗, 1=成功
  text_length INTEGER DEFAULT 0,       -- 抽出されたテキスト長
  forms_count INTEGER DEFAULT 0,       -- 抽出されたフォーム数
  fields_count INTEGER DEFAULT 0,      -- 抽出されたフィールド総数
  
  -- OCR固有（vision_ocr の場合のみ）
  ocr_pages_processed INTEGER DEFAULT 0,
  ocr_estimated_cost REAL DEFAULT 0,   -- 概算コスト（USD）
  
  -- 失敗情報
  failure_reason TEXT,                 -- 'FETCH_FAILED' | 'PARSE_FAILED' | 'FORMS_NOT_FOUND' | 'FIELDS_INSUFFICIENT'
  failure_message TEXT,
  
  -- コンテンツハッシュ（差分検知用）
  content_hash TEXT,
  
  -- Cron実行ID（紐付け用）
  cron_run_id TEXT,
  
  -- タイムスタンプ
  processing_time_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- 外部キー（任意）
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_cache(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_extraction_logs_subsidy_id ON extraction_logs(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_source ON extraction_logs(source);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_method ON extraction_logs(extraction_method);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_at ON extraction_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_cron_run_id ON extraction_logs(cron_run_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_success ON extraction_logs(success);

-- 日次集計ビュー（パフォーマンス用）
-- Note: D1ではVIEWは手動クエリで代用

-- =====================================================
-- サンプルクエリ
-- =====================================================

-- 1. OCR実行ログ一覧（最新順）
-- SELECT * FROM extraction_logs 
-- WHERE extraction_method = 'vision_ocr' 
-- ORDER BY created_at DESC LIMIT 50;

-- 2. 日別OCRコスト集計
-- SELECT 
--   DATE(created_at) as date,
--   COUNT(*) as ocr_calls,
--   SUM(ocr_pages_processed) as total_pages,
--   SUM(ocr_estimated_cost) as total_cost
-- FROM extraction_logs 
-- WHERE extraction_method = 'vision_ocr'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;

-- 3. 抽出方法別の成功率
-- SELECT 
--   extraction_method,
--   COUNT(*) as total,
--   SUM(success) as success_count,
--   ROUND(100.0 * SUM(success) / COUNT(*), 1) as success_rate
-- FROM extraction_logs
-- GROUP BY extraction_method;

-- 4. 失敗理由の分布
-- SELECT 
--   failure_reason,
--   COUNT(*) as count
-- FROM extraction_logs 
-- WHERE success = 0 AND failure_reason IS NOT NULL
-- GROUP BY failure_reason
-- ORDER BY count DESC;

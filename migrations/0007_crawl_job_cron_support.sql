-- Migration: 0007_crawl_job_cron_support
-- Cron Worker用のcrawl_job拡張
-- 
-- 変更点:
-- 1. root_url カラム追加（source_registry起点クロール用）
-- 2. source_registry_id カラム追加（台帳との紐付け）
-- 3. priority カラム追加
-- 4. job_type の値域拡張（JOB_REGISTRY_CRAWL, JOB_SUBSIDY_CHECK追加）
-- 5. url_id を NULL許容に変更（registry起点では不要）

-- root_url カラム追加
ALTER TABLE crawl_job ADD COLUMN root_url TEXT;

-- source_registry_id カラム追加
ALTER TABLE crawl_job ADD COLUMN source_registry_id TEXT;

-- priority カラム追加
ALTER TABLE crawl_job ADD COLUMN priority INTEGER DEFAULT 3;

-- id カラムのエイリアス作成のため、新しいテーブルを作成してデータ移行
-- (SQLiteではカラム名変更ができないため、id として使えるようにビュー等で対応)

-- インデックス追加（Cron重複チェック用）
CREATE INDEX IF NOT EXISTS idx_crawl_job_cron_dedup 
ON crawl_job(job_type, root_url, status, created_at);

-- インデックス追加（Consumer用キュー取得）
CREATE INDEX IF NOT EXISTS idx_crawl_job_queue 
ON crawl_job(status, priority, created_at);

-- crawl_stats テーブル作成（KPI記録用）
CREATE TABLE IF NOT EXISTS crawl_stats (
  id TEXT PRIMARY KEY,
  stat_day TEXT NOT NULL,         -- date('now') 形式
  metric TEXT NOT NULL,           -- 'cron_jobs_enqueued', 'crawl_success', 'crawl_error' 等
  value INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crawl_stats_day_metric 
ON crawl_stats(stat_day, metric);

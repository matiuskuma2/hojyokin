-- P3-2A: feed_failures テーブル（失敗・不足データの可視化）
-- 目的: Cronで取れなかったデータを貯めて、super_adminが一覧で把握できる状態にする

-- ============================================
-- feed_failures: 個別失敗の記録
-- ============================================
CREATE TABLE IF NOT EXISTS feed_failures (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  
  -- どのソースで失敗したか
  source_id TEXT NOT NULL,              -- 'src-tokyo-shigoto', 'src-tokyo-kosha', 'src-tokyo-hataraku'
  
  -- どのURLで失敗したか
  url TEXT NOT NULL,                    -- 一覧ページURL or 詳細ページURL
  
  -- どの段階で失敗したか
  stage TEXT NOT NULL CHECK(stage IN ('discover', 'detail', 'pdf', 'extract', 'db')),
  
  -- エラーの種類
  error_type TEXT NOT NULL CHECK(error_type IN ('HTTP', 'timeout', 'parse', 'db', 'validation', 'unknown')),
  
  -- エラーメッセージ（短文）
  error_message TEXT NOT NULL,
  
  -- HTTPステータスコード（該当する場合）
  http_status INTEGER,
  
  -- 関連するdedupe_key（わかる場合）
  dedupe_key TEXT,
  
  -- 関連するsubsidy_cache.id（わかる場合）
  subsidy_id TEXT,
  
  -- タイムスタンプ
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_retry_at DATETIME,
  
  -- リトライ回数
  retry_count INTEGER DEFAULT 0 NOT NULL,
  
  -- ステータス
  status TEXT DEFAULT 'open' NOT NULL CHECK(status IN ('open', 'resolved', 'ignored', 'retrying')),
  
  -- 解決時のメモ
  resolution_notes TEXT,
  resolved_at DATETIME,
  resolved_by TEXT,
  
  -- cron_run との紐付け
  cron_run_id TEXT,
  
  -- 追加メタデータ
  metadata_json TEXT,
  
  -- 外部キー
  FOREIGN KEY (source_id) REFERENCES feed_sources(id),
  FOREIGN KEY (cron_run_id) REFERENCES cron_runs(run_id)
);

-- インデックス（運用画面でよく使うクエリ用）
CREATE INDEX IF NOT EXISTS idx_feed_failures_source_id ON feed_failures(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_failures_status ON feed_failures(status);
CREATE INDEX IF NOT EXISTS idx_feed_failures_stage ON feed_failures(stage);
CREATE INDEX IF NOT EXISTS idx_feed_failures_error_type ON feed_failures(error_type);
CREATE INDEX IF NOT EXISTS idx_feed_failures_occurred_at ON feed_failures(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_failures_url ON feed_failures(url);
CREATE INDEX IF NOT EXISTS idx_feed_failures_dedupe_key ON feed_failures(dedupe_key);

-- 複合インデックス（未解決の失敗を効率的に取得）
CREATE INDEX IF NOT EXISTS idx_feed_failures_open_by_source ON feed_failures(status, source_id, occurred_at DESC) WHERE status = 'open';

-- ============================================
-- cron_runs テーブルの拡張（存在チェック付き）
-- ============================================
-- metadata_json カラムが無ければ追加（既存テーブル対応）
-- SQLiteではALTER TABLE ADD COLUMNで条件付き追加ができないため、
-- 存在チェックはアプリケーション側で行う

-- ============================================
-- feed_failure_stats: 日次集計ビュー
-- ============================================
CREATE VIEW IF NOT EXISTS feed_failure_stats AS
SELECT 
  source_id,
  stage,
  error_type,
  status,
  DATE(occurred_at) as failure_date,
  COUNT(*) as failure_count,
  MAX(occurred_at) as last_failure
FROM feed_failures
GROUP BY source_id, stage, error_type, status, DATE(occurred_at);

-- ============================================
-- cron_health_check: Cronの健全性チェック用ビュー
-- ============================================
CREATE VIEW IF NOT EXISTS cron_health_check AS
SELECT 
  job_type,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  MAX(started_at) as last_run,
  MAX(CASE WHEN status = 'success' THEN started_at END) as last_success,
  MAX(CASE WHEN status = 'failed' THEN started_at END) as last_failure,
  -- 24時間以内に成功があるか
  CASE 
    WHEN MAX(CASE WHEN status = 'success' THEN started_at END) >= datetime('now', '-24 hours') 
    THEN 1 
    ELSE 0 
  END as healthy_24h,
  -- 最新の実行結果
  (SELECT status FROM cron_runs cr2 WHERE cr2.job_type = cron_runs.job_type ORDER BY started_at DESC LIMIT 1) as latest_status
FROM cron_runs
WHERE started_at >= datetime('now', '-7 days')
GROUP BY job_type;

-- ============================================
-- 初期データ: feed_sources に tokyo-hataraku が無ければ追加
-- ============================================
INSERT OR IGNORE INTO feed_sources (
  id, 
  source_name, 
  source_url, 
  category, 
  is_active, 
  scrape_frequency,
  created_at,
  updated_at
) VALUES (
  'src-tokyo-hataraku',
  'TOKYOはたらくネット',
  'https://www.hataraku.metro.tokyo.lg.jp/',
  'prefecture',
  1,
  'daily',
  datetime('now'),
  datetime('now')
);

-- ============================================
-- subsidy_cache にインデックス追加（検索高速化）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_wall_chat_ready ON subsidy_cache(wall_chat_ready);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_source ON subsidy_cache(source);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_detail_score ON subsidy_cache(detail_score DESC);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_expires_at ON subsidy_cache(expires_at);

-- 複合インデックス（検索で頻繁に使う組み合わせ）
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_searchable ON subsidy_cache(wall_chat_ready, source, acceptance_end_datetime DESC);

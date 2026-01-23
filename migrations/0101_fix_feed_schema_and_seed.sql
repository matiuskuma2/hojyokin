-- =====================================================================
-- Migration: 0101_fix_feed_schema_and_seed.sql
-- Purpose:
--   1) subsidy_feed_items を凍結スキーマへ統一（入れ替え方式）
--   2) 既存レコードの dedupe_key / content_hash / source_type を正規化
--   3) feed_sources の必須seedを投入（存在しなければ）
--   4) cron_runs が無ければ作成（安全ログ用）
--
-- Notes:
--   - SQLite(D1)は CHECK/UNIQUE を後付けで整えるのが難しいため
--     "新テーブル作成 → 既存データ移送 → rename" で確定させる。
--   - 既存の subsidy_feed_items は P2の途中でALTERでカラム追加済み前提
--     （dedupe_key/content_hash/prefecture_code 等が存在する前提）。
-- =====================================================================

PRAGMA foreign_keys = OFF;

-- --------------------------
-- 0) cron_runs が無ければ作成（運用ログ）
-- --------------------------
CREATE TABLE IF NOT EXISTS cron_runs (
  run_id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  triggered_by TEXT DEFAULT 'cron',
  status TEXT DEFAULT 'running',
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  items_processed INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors_json TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON cron_runs(started_at);

-- --------------------------
-- 1) feed_sources の必須seed
--    ※既存の 0027_feed_source_master.sql が feed_sources を使っている前提
-- --------------------------
CREATE TABLE IF NOT EXISTS feed_sources (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  region_code TEXT,
  region_name TEXT,
  source_name TEXT NOT NULL,
  source_org TEXT,
  izumi_category TEXT,
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 50,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

INSERT OR IGNORE INTO feed_sources
  (id, category, region_code, region_name, source_name, source_org, izumi_category, is_active, priority)
VALUES
  ('platform-news',     'platform',     '00', '全国', 'ホジョラク お知らせ', 'ホジョラク', 'プラットフォーム', 1, 100),
  ('platform-support',  'support_info', '00', '全国', '新着支援情報',        'ホジョラク', '新着支援情報',     1, 90),
  ('src-tokyo-shigoto', 'prefecture',   '13', '東京都', '東京しごと財団',       '東京しごと財団',       '都道府県NEWS', 1, 70),
  ('src-tokyo-kosha',   'prefecture',   '13', '東京都', '東京都中小企業振興公社','東京都中小企業振興公社','都道府県NEWS', 1, 70),
  ('src-tokyo-hataraku','prefecture',   '13', '東京都', 'TOKYOはたらくネット', '東京都産業労働局',     '都道府県NEWS', 0, 60);

-- --------------------------
-- 2) subsidy_feed_items の "凍結スキーマ" 新テーブル
-- --------------------------
DROP TABLE IF EXISTS subsidy_feed_items__v2;

CREATE TABLE subsidy_feed_items__v2 (
  -- identity
  id TEXT PRIMARY KEY,

  -- dedupe
  dedupe_key TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,

  -- source
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('platform','support_info','prefecture','municipal','ministry','other_public')),

  -- core fields
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  detail_url TEXT,

  -- optional enrichment
  pdf_urls TEXT,            -- JSON array string
  issuer_name TEXT,
  prefecture_code TEXT,     -- '01'..'47' or '00'
  target_area_codes TEXT,   -- JSON array string
  subsidy_amount_max INTEGER,
  subsidy_rate_text TEXT,
  status TEXT,              -- open/closed/unknown 等

  -- event tracking
  event_type TEXT DEFAULT 'info' CHECK (event_type IN ('new','updated','closing','alert','info')),
  priority INTEGER DEFAULT 50,

  -- timestamps
  published_at TEXT,
  detected_at TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  expires_at TEXT,

  -- raw payload (JSON string)
  raw_json TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_feed_items_v2_source_type ON subsidy_feed_items__v2(source_type, detected_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_v2_prefecture ON subsidy_feed_items__v2(prefecture_code, detected_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_v2_last_seen ON subsidy_feed_items__v2(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_v2_event_type ON subsidy_feed_items__v2(event_type, detected_at);

-- --------------------------
-- 3) 既存データを v2 に移送
--    重要:
--    - source_type が 'government' 等の場合は prefecture に丸める
--    - dedupe_key が NULL の legacy は 'legacy:'||id を付与
--    - content_hash が NULL の legacy は random blob で補完
--    - first_seen/last_seen が NULL の legacy は detected_at/published_at から補完
-- --------------------------
INSERT INTO subsidy_feed_items__v2 (
  id,
  dedupe_key,
  content_hash,
  source_id,
  source_type,
  title,
  summary,
  url,
  detail_url,
  pdf_urls,
  issuer_name,
  prefecture_code,
  target_area_codes,
  subsidy_amount_max,
  subsidy_rate_text,
  status,
  event_type,
  priority,
  published_at,
  detected_at,
  first_seen_at,
  last_seen_at,
  expires_at,
  raw_json,
  created_at,
  updated_at
)
SELECT
  -- id
  s.id,

  -- dedupe_key
  COALESCE(NULLIF(s.dedupe_key, ''), 'legacy:' || s.id) AS dedupe_key,

  -- content_hash (must be NOT NULL)
  COALESCE(NULLIF(s.content_hash, ''), lower(hex(randomblob(16)))) AS content_hash,

  -- source_id (must be NOT NULL)
  COALESCE(NULLIF(s.source_id, ''), 'platform-news') AS source_id,

  -- source_type (CHECK)
  CASE
    WHEN s.source_type IN ('platform','support_info','prefecture','municipal','ministry','other_public') THEN s.source_type
    WHEN s.source_type = 'government' THEN 'prefecture'
    ELSE 'platform'
  END AS source_type,

  -- core fields
  COALESCE(NULLIF(s.title, ''), '(無題)') AS title,
  s.summary,
  s.url,
  COALESCE(s.detail_url, s.url) AS detail_url,

  -- optional enrichment
  s.pdf_urls,
  s.issuer_name,
  COALESCE(s.prefecture_code, s.region_prefecture, '00') AS prefecture_code,
  s.target_area_codes,
  s.subsidy_amount_max,
  s.subsidy_rate_text,
  s.status,

  -- event
  CASE
    WHEN s.event_type IN ('new','updated','closing','alert','info') THEN s.event_type
    ELSE 'info'
  END AS event_type,
  COALESCE(s.priority, 50) AS priority,

  -- timestamps
  s.published_at,
  s.detected_at,
  COALESCE(s.first_seen_at, s.detected_at, s.published_at, datetime('now')) AS first_seen_at,
  COALESCE(s.last_seen_at, s.detected_at, s.published_at, datetime('now')) AS last_seen_at,
  s.expires_at,

  s.raw_json,
  COALESCE(s.created_at, datetime('now')) AS created_at,
  s.updated_at
FROM subsidy_feed_items s;

-- --------------------------
-- 4) テーブル入れ替え
-- --------------------------
DROP TABLE IF EXISTS subsidy_feed_items__old;
ALTER TABLE subsidy_feed_items RENAME TO subsidy_feed_items__old;
ALTER TABLE subsidy_feed_items__v2 RENAME TO subsidy_feed_items;

-- --------------------------
-- 5) 新インデックス作成（本テーブル）
-- --------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_dedupe ON subsidy_feed_items(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_feed_items_source_type ON subsidy_feed_items(source_type, detected_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_prefecture ON subsidy_feed_items(prefecture_code, detected_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_last_seen ON subsidy_feed_items(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_event_type ON subsidy_feed_items(event_type, detected_at);
CREATE INDEX IF NOT EXISTS idx_feed_items_is_new ON subsidy_feed_items(first_seen_at);

-- --------------------------
-- 6) 古いテーブルはバックアップとして残す（必要なら後でDROP）
-- --------------------------
-- DROP TABLE IF EXISTS subsidy_feed_items__old;

PRAGMA foreign_keys = ON;

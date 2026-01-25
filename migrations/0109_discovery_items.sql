-- =====================================================
-- 0109_discovery_items.sql - P1: Discovery Items テーブル
-- =====================================================
-- 
-- 目的:
-- - sync-jnet21 等の外部ソースから取得した補助金データを
--   検証前のステージングエリアとして保持
-- - promote ジョブで検証後に subsidy_cache へ昇格
-- - 母集団サイズ管理と検索UX保護を実現
--
-- 変更履歴:
-- - 2026-01-25: 初期作成（P1タスク）
--
-- 適用方法:
-- - ローカル: npx wrangler d1 execute subsidy-matching-production --local --file=migrations/0109_discovery_items.sql
-- - 本番: npx wrangler d1 migrations apply subsidy-matching-production
--
-- =====================================================

-- =====================================================
-- discovery_items テーブル
-- =====================================================
-- 
-- 外部ソースから取得した補助金データを検証前に保持
-- stage フィールドで状態管理:
--   - raw: 取得直後（未検証）
--   - validated: 検証済み（promote 可能）
--   - rejected: 品質不足（promote 不可）
--   - promoted: subsidy_cache へ昇格済み
--
CREATE TABLE IF NOT EXISTS discovery_items (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,        -- 重複排除用キー (source:hash)
  source_id TEXT NOT NULL,                -- feed_sources.id (例: src-jnet21)
  source_type TEXT NOT NULL DEFAULT 'rss', -- rss, api, scrape
  
  -- 基本情報
  title TEXT NOT NULL,
  title_normalized TEXT,                  -- 正規化済みタイトル（検索用）
  summary TEXT,
  url TEXT NOT NULL,
  detail_url TEXT,
  
  -- メタ情報
  issuer_name TEXT,
  prefecture_code TEXT,
  target_area_codes TEXT,                 -- JSON array of codes
  category_codes TEXT,                    -- JSON array of codes
  
  -- 金額・率
  subsidy_amount_max INTEGER,
  subsidy_rate_text TEXT,
  
  -- 期間
  acceptance_start TEXT,
  acceptance_end TEXT,
  
  -- 状態管理
  stage TEXT NOT NULL DEFAULT 'raw' CHECK (stage IN ('raw', 'validated', 'rejected', 'promoted')),
  quality_score INTEGER DEFAULT 0,        -- 0-100 (品質スコア)
  validation_notes TEXT,                  -- 検証時のメモ
  promoted_at TEXT,                       -- subsidy_cache へ昇格した日時
  promoted_to_id TEXT,                    -- 昇格先の subsidy_cache.id
  
  -- 差分検知
  content_hash TEXT,                      -- コンテンツのハッシュ値
  raw_json TEXT,                          -- 元データのJSON
  
  -- タイムスタンプ
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_discovery_items_source ON discovery_items(source_id, stage);
CREATE INDEX IF NOT EXISTS idx_discovery_items_stage ON discovery_items(stage);
CREATE INDEX IF NOT EXISTS idx_discovery_items_dedupe ON discovery_items(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_discovery_items_pref ON discovery_items(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_discovery_items_first_seen ON discovery_items(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_discovery_items_quality ON discovery_items(quality_score);

-- =====================================================
-- discovery_promote_log テーブル
-- =====================================================
-- 
-- discovery_items から subsidy_cache への昇格履歴を記録
-- 監査・デバッグ用
--
CREATE TABLE IF NOT EXISTS discovery_promote_log (
  id TEXT PRIMARY KEY,
  discovery_item_id TEXT NOT NULL,
  subsidy_cache_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'promote', -- promote, update, skip
  quality_score INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promote_log_discovery ON discovery_promote_log(discovery_item_id);
CREATE INDEX IF NOT EXISTS idx_promote_log_subsidy ON discovery_promote_log(subsidy_cache_id);
CREATE INDEX IF NOT EXISTS idx_promote_log_created ON discovery_promote_log(created_at);

-- =====================================================
-- 既存テーブルへの追加カラム（discovery 連携用）
-- =====================================================

-- subsidy_cache に discovery_item_id を追加（逆引き用）
-- ALTER TABLE は IF NOT EXISTS をサポートしていないため、
-- 既存の場合はエラーになるが、マイグレーション自体は成功する
-- 本番適用時は手動で確認すること

-- 注意: SQLite の ALTER TABLE ADD COLUMN は制限が多いため、
-- 既にカラムが存在する場合のエラーを無視する設計

-- =====================================================
-- 初期シードデータ（J-Net21 ソース登録）
-- =====================================================

-- feed_sources に J-Net21 RSS を登録（未登録の場合のみ）
INSERT OR IGNORE INTO feed_sources (
  id, source_type, name, name_short, base_url, rss_url,
  geo_scope, data_format, update_frequency, priority, is_active,
  created_at, updated_at
) VALUES (
  'src-jnet21',
  'support_info',
  'J-Net21 支援情報ヘッドライン',
  'J-Net21',
  'https://j-net21.smrj.go.jp',
  'https://j-net21.smrj.go.jp/headline/rss/shienjoho-rss.xml',
  'national',
  'rss',
  'daily',
  80,
  1,
  datetime('now'),
  datetime('now')
);

-- =====================================================
-- マイグレーション完了確認用ビュー
-- =====================================================

-- discovery_items の統計ビュー
CREATE VIEW IF NOT EXISTS v_discovery_stats AS
SELECT 
  source_id,
  stage,
  COUNT(*) as count,
  AVG(quality_score) as avg_quality,
  MIN(first_seen_at) as oldest,
  MAX(last_seen_at) as newest
FROM discovery_items
GROUP BY source_id, stage;

-- =====================================================
-- 注意事項
-- =====================================================
-- 
-- 1. このマイグレーション適用後、sync-jnet21 ジョブを
--    discovery_items への UPSERT に変更すること
-- 
-- 2. promote-jnet21 ジョブを追加して、
--    validated ステージのアイテムを subsidy_cache へ昇格
-- 
-- 3. 検索UX保護のため、subsidy_cache の件数上限を監視し、
--    promote 時に古いデータを適宜削除すること
--

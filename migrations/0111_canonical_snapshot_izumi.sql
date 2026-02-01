-- =============================================================================
-- 0111_canonical_snapshot_izumi.sql
-- Canonical Key設計 + Snapshot管理 + izumi統合
-- =============================================================================
-- 
-- 凍結仕様:
-- 1. subsidy_canonical: 制度の恒久ID（program_key）
-- 2. subsidy_source_link: ソース別IDの紐付け（jgrants/izumi/tokyo-*/etc.）
-- 3. subsidy_snapshot: 時点スナップショット（期間/金額/URL/資料）
-- 4. izumi_subsidies: 情報の泉データ（policy_id起点）
-- 5. izumi_urls: izumiのURL管理（クロール状態含む）
--
-- 原則:
-- - 検索/詳細は canonical（最新スナップショット）を見る
-- - 過去データの参照や監査は snapshot を見る
-- - policy_idが古くなっても "古いsnapshotとして残る"（消さない）
-- =============================================================================

-- =============================================================================
-- PART 1: Canonical Key（制度マスタ）
-- =============================================================================

-- subsidy_canonical: 制度の恒久キー（program_key）
-- 同一制度の複数回募集を束ねる
CREATE TABLE IF NOT EXISTS subsidy_canonical (
  id TEXT PRIMARY KEY,                    -- program_key（恒久キー）例: 'tokyo-kosha-iot-hojo'
  name TEXT NOT NULL,                     -- 制度名称（正式）
  name_normalized TEXT,                   -- 正規化名称（検索用、ひらがな/小文字化）
  issuer_code TEXT,                       -- 実施機関コード（issuer_master.id）
  issuer_name TEXT,                       -- 実施機関名称（非正規化、表示用）
  prefecture_code TEXT,                   -- 主たる都道府県コード（01-47, 00=全国）
  category_codes TEXT,                    -- カテゴリコード（JSON配列）
  industry_codes TEXT,                    -- 対象業種コード（JSON配列）
  
  -- 最新スナップショット参照（キャッシュ）
  latest_snapshot_id TEXT,                -- 最新の subsidy_snapshot.id
  latest_cache_id TEXT,                   -- 最新の subsidy_cache.id（検索用）
  
  -- メタ情報
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_updated_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,            -- 0=廃止制度
  notes TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_canonical_issuer ON subsidy_canonical(issuer_code);
CREATE INDEX IF NOT EXISTS idx_canonical_pref ON subsidy_canonical(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_canonical_name ON subsidy_canonical(name_normalized);
CREATE INDEX IF NOT EXISTS idx_canonical_active ON subsidy_canonical(is_active);
CREATE INDEX IF NOT EXISTS idx_canonical_latest ON subsidy_canonical(latest_cache_id);

-- =============================================================================
-- PART 2: Source Link（ソース紐付け）
-- =============================================================================

-- subsidy_source_link: 各ソースのIDとcanonicalの紐付け
-- jgrants_id, izumi_policy_id, tokyo_kosha_id などを管理
CREATE TABLE IF NOT EXISTS subsidy_source_link (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,             -- FK to subsidy_canonical.id
  source_type TEXT NOT NULL,              -- 'jgrants', 'izumi', 'tokyo-kosha', 'tokyo-shigoto', 'manual'
  source_id TEXT NOT NULL,                -- 各ソースのID（jgrants.id, izumi.policy_id等）
  round_key TEXT,                         -- 募集回キー（例: '2026-r1'）任意
  
  -- マッチング情報
  match_type TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'manual', 'system'
  match_score REAL,                       -- 自動マッチの信頼度 (0.0-1.0)
  match_fields TEXT,                      -- マッチに使った項目（JSON: ["title", "issuer", "amount"]）
  match_reason TEXT,                      -- マッチ理由（人間可読）
  
  -- 検証状態
  verified INTEGER DEFAULT 0,             -- 1=人間確認済み
  verified_by TEXT,                       -- 確認者ユーザーID
  verified_at TEXT,
  rejected INTEGER DEFAULT 0,             -- 1=明示的に不一致判定
  rejected_reason TEXT,
  
  -- プロベナンス
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (canonical_id) REFERENCES subsidy_canonical(id) ON DELETE CASCADE,
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_link_canonical ON subsidy_source_link(canonical_id);
CREATE INDEX IF NOT EXISTS idx_link_source ON subsidy_source_link(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_link_match_type ON subsidy_source_link(match_type, verified);
CREATE INDEX IF NOT EXISTS idx_link_unverified ON subsidy_source_link(verified) WHERE verified = 0 AND rejected = 0;

-- =============================================================================
-- PART 3: Snapshot（時点スナップショット）
-- =============================================================================

-- subsidy_snapshot: 特定時点のデータスナップショット
-- 期間/金額/URL/資料が変わるたびに新規作成（過去は消さない）
CREATE TABLE IF NOT EXISTS subsidy_snapshot (
  id TEXT PRIMARY KEY,                    -- UUID
  canonical_id TEXT NOT NULL,             -- FK to subsidy_canonical.id
  source_link_id TEXT,                    -- FK to subsidy_source_link.id（どのソースから来たか）
  
  -- 募集回情報
  round_key TEXT,                         -- 募集回（例: '2026-r1'）
  fiscal_year TEXT,                       -- 年度（例: '令和6年度'）
  
  -- 期間
  acceptance_start TEXT,                  -- 受付開始（YYYY-MM-DD or datetime）
  acceptance_end TEXT,                    -- 受付終了（YYYY-MM-DD or datetime）
  deadline_text TEXT,                     -- 締切テキスト（表示用）
  is_accepting INTEGER DEFAULT 0,         -- 現在受付中フラグ（計算値）
  
  -- 金額
  subsidy_max_limit INTEGER,              -- 補助上限額（円）
  subsidy_min_limit INTEGER,              -- 補助下限額（円）
  subsidy_rate TEXT,                      -- 補助率テキスト（例: '2/3'）
  subsidy_rate_max REAL,                  -- 補助率最大（0.0-1.0）
  
  -- 対象
  target_area_codes TEXT,                 -- 対象地域コード（JSON配列）
  target_area_text TEXT,                  -- 対象地域テキスト（表示用）
  target_industry_codes TEXT,             -- 対象業種コード（JSON配列）
  target_employee_text TEXT,              -- 対象従業員規模テキスト
  
  -- URL・資料
  official_url TEXT,                      -- 公式ページURL
  pdf_urls TEXT,                          -- PDFリスト（JSON配列）
  attachments TEXT,                       -- 添付ファイル情報（JSON配列）
  
  -- 詳細（検索には使わない、詳細表示用）
  detail_json TEXT,                       -- 全詳細情報（出典情報含む）
  
  -- スナップショットメタ
  snapshot_at TEXT NOT NULL DEFAULT (datetime('now')),  -- スナップショット取得日時
  content_hash TEXT,                      -- コンテンツハッシュ（変更検知用）
  superseded_by TEXT,                     -- 新しいスナップショットID（NULL=最新）
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (canonical_id) REFERENCES subsidy_canonical(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshot_canonical ON subsidy_snapshot(canonical_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_round ON subsidy_snapshot(canonical_id, round_key);
CREATE INDEX IF NOT EXISTS idx_snapshot_accepting ON subsidy_snapshot(is_accepting, acceptance_end);
CREATE INDEX IF NOT EXISTS idx_snapshot_latest ON subsidy_snapshot(canonical_id, superseded_by) WHERE superseded_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_snapshot_date ON subsidy_snapshot(snapshot_at);

-- =============================================================================
-- PART 4: izumi_subsidies（情報の泉メインテーブル）
-- =============================================================================

-- izumi_subsidies: 情報の泉から取得した補助金データ
CREATE TABLE IF NOT EXISTS izumi_subsidies (
  id TEXT PRIMARY KEY,                    -- 'izumi-{policy_id}'
  policy_id INTEGER NOT NULL UNIQUE,      -- 情報の泉の policy_id
  detail_url TEXT,                        -- https://j-izumi.com/policy/{id}/detail
  
  -- 基本情報
  title TEXT NOT NULL,
  issuer TEXT,                            -- 実施機関（テキスト）
  area TEXT,                              -- 対象地域（テキスト）
  prefecture_code TEXT,                   -- 都道府県コード（URLから推定）
  
  -- 日程
  publish_date TEXT,
  period TEXT,
  
  -- 金額
  max_amount_text TEXT,                   -- 元の金額テキスト（30万円等）
  max_amount_value INTEGER,               -- パース後の数値（300000等）
  
  -- 難易度
  difficulty TEXT,                        -- ★☆☆☆☆ 形式
  difficulty_level INTEGER,               -- 1-5 の数値
  
  -- 支援費用
  start_fee TEXT,
  success_fee TEXT,
  
  -- URL
  support_url TEXT,                       -- 主要URL
  support_urls_all TEXT,                  -- 全URL（|区切り or JSON配列）
  
  -- 紐付け情報
  canonical_id TEXT,                      -- FK to subsidy_canonical.id（紐付け後）
  jgrants_id TEXT,                        -- jGrantsとの紐付け（subsidy_cache.id）
  match_score REAL,                       -- 類似度スコア（0-1）
  match_method TEXT,                      -- 'exact_title', 'fuzzy', 'manual', 'unmatched'
  
  -- 壁打ち対応
  detail_ready INTEGER DEFAULT 0,         -- 詳細情報の充足フラグ
  wall_chat_ready INTEGER DEFAULT 0,      -- 壁打ち対応フラグ
  wall_chat_mode TEXT DEFAULT 'pending',  -- 'enabled', 'disabled_electronic', 'disabled_excluded', 'pending'
  wall_chat_missing TEXT,                 -- 不足項目（JSON配列）
  
  -- クロール状態
  crawl_status TEXT DEFAULT 'pending',    -- 'pending', 'success', 'failed', 'skipped'
  last_crawled_at TEXT,
  crawl_error TEXT,
  
  -- メタ情報
  source TEXT DEFAULT 'izumi',
  imported_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,            -- 0=削除済み/期限切れ
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_izumi_policy_id ON izumi_subsidies(policy_id);
CREATE INDEX IF NOT EXISTS idx_izumi_prefecture ON izumi_subsidies(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_izumi_canonical ON izumi_subsidies(canonical_id);
CREATE INDEX IF NOT EXISTS idx_izumi_jgrants ON izumi_subsidies(jgrants_id);
CREATE INDEX IF NOT EXISTS idx_izumi_crawl_status ON izumi_subsidies(crawl_status);
CREATE INDEX IF NOT EXISTS idx_izumi_wall_chat ON izumi_subsidies(wall_chat_ready, wall_chat_mode);
CREATE INDEX IF NOT EXISTS idx_izumi_active ON izumi_subsidies(is_active);

-- =============================================================================
-- PART 5: izumi_urls（URL管理）
-- =============================================================================

-- izumi_urls: izumiのURL管理（クロール状態含む）
CREATE TABLE IF NOT EXISTS izumi_urls (
  id TEXT PRIMARY KEY,                    -- UUID
  policy_id INTEGER NOT NULL,             -- FK to izumi_subsidies.policy_id
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,                 -- URLのハッシュ（重複排除用）
  
  -- URL分類
  url_type TEXT,                          -- 'html', 'pdf', 'unknown'
  is_primary INTEGER DEFAULT 0,           -- 主要URLフラグ
  domain TEXT,                            -- URLのドメイン
  
  -- クロール状態
  crawl_status TEXT DEFAULT 'pending',    -- 'pending', 'success', 'failed', 'skipped'
  crawl_attempts INTEGER DEFAULT 0,
  last_crawled_at TEXT,
  last_error TEXT,
  http_status INTEGER,                    -- 最後のHTTPステータス
  
  -- 抽出結果
  content_hash TEXT,                      -- コンテンツハッシュ（変更検知用）
  extracted_json TEXT,                    -- Firecrawl/LLM抽出結果
  extraction_status TEXT,                 -- 'pending', 'success', 'failed', 'skipped'
  extraction_method TEXT,                 -- 'firecrawl', 'vision_ocr', 'manual'
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(policy_id, url_hash)
);

CREATE INDEX IF NOT EXISTS idx_izumi_urls_policy ON izumi_urls(policy_id);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_domain ON izumi_urls(domain);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_status ON izumi_urls(crawl_status);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_type ON izumi_urls(url_type);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_primary ON izumi_urls(policy_id, is_primary) WHERE is_primary = 1;

-- =============================================================================
-- PART 6: subsidy_cache 拡張（wall_chat_mode追加）
-- =============================================================================

-- subsidy_cacheにwall_chat_mode追加
-- 'enabled', 'disabled_electronic', 'disabled_excluded'
ALTER TABLE subsidy_cache ADD COLUMN wall_chat_mode TEXT DEFAULT 'pending';

-- canonical_id参照追加
ALTER TABLE subsidy_cache ADD COLUMN canonical_id TEXT;

-- 出典管理用カラム追加（detail_jsonに入れるが、検索用にも）
ALTER TABLE subsidy_cache ADD COLUMN is_electronic_application INTEGER DEFAULT 0;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_wall_mode ON subsidy_cache(wall_chat_mode);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_canonical ON subsidy_cache(canonical_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_electronic ON subsidy_cache(is_electronic_application);

-- =============================================================================
-- PART 7: 更新ジョブ管理テーブル
-- =============================================================================

-- update_job_runs: 更新ジョブの実行履歴（cron_runsとは別に細分化）
CREATE TABLE IF NOT EXISTS update_job_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,                 -- 'discovery', 'core', 'doc', 'wallchat', 'failure_export'
  source_type TEXT,                       -- 'jgrants', 'izumi', 'tokyo-kosha', etc.
  
  -- 実行状態
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed', 'partial'
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  
  -- 結果統計
  items_total INTEGER DEFAULT 0,          -- 対象件数
  items_processed INTEGER DEFAULT 0,      -- 処理件数
  items_success INTEGER DEFAULT 0,        -- 成功件数
  items_failed INTEGER DEFAULT 0,         -- 失敗件数
  items_skipped INTEGER DEFAULT 0,        -- スキップ件数
  items_unchanged INTEGER DEFAULT 0,      -- 変更なし件数
  
  -- エラー情報
  errors_json TEXT,                       -- エラー詳細（JSON配列）
  
  -- メタ情報
  triggered_by TEXT,                      -- 'cron', 'manual', 'api'
  metadata_json TEXT,                     -- ジョブ固有のメタ情報
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_update_jobs_type ON update_job_runs(job_type, source_type);
CREATE INDEX IF NOT EXISTS idx_update_jobs_status ON update_job_runs(status);
CREATE INDEX IF NOT EXISTS idx_update_jobs_started ON update_job_runs(started_at);

-- update_failures: 更新失敗の詳細（CSV出力用）
CREATE TABLE IF NOT EXISTS update_failures (
  id TEXT PRIMARY KEY,
  job_run_id TEXT,                        -- FK to update_job_runs.id
  
  -- 対象特定
  source_type TEXT NOT NULL,              -- 'jgrants', 'izumi', etc.
  source_id TEXT NOT NULL,                -- 各ソースのID
  canonical_id TEXT,                      -- canonical IDがあれば
  
  -- 失敗情報
  failure_type TEXT NOT NULL,             -- 'fetch', 'parse', 'validate', 'save', 'timeout'
  failure_code TEXT,                      -- HTTPステータス or エラーコード
  failure_message TEXT,                   -- エラーメッセージ
  failure_url TEXT,                       -- 失敗したURL
  failure_field TEXT,                     -- 失敗したフィールド
  
  -- リトライ情報
  retry_count INTEGER DEFAULT 0,
  last_retry_at TEXT,
  resolved INTEGER DEFAULT 0,             -- 1=解決済み
  resolved_at TEXT,
  resolved_by TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_failures_job ON update_failures(job_run_id);
CREATE INDEX IF NOT EXISTS idx_failures_source ON update_failures(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_failures_unresolved ON update_failures(resolved) WHERE resolved = 0;
CREATE INDEX IF NOT EXISTS idx_failures_type ON update_failures(failure_type);

-- =============================================================================
-- PART 8: 初期データ投入（ソース登録）
-- =============================================================================

-- izumi ソースを feed_source_master に登録
INSERT OR IGNORE INTO feed_source_master (
  id, source_type, source_key, name, name_short, base_url, list_url,
  geo_scope, data_format, update_frequency, priority, enabled
) VALUES (
  'src-izumi',
  'aggregator',
  'izumi',
  '情報の泉',
  'izumi',
  'https://j-izumi.com',
  'https://j-izumi.com/policy/',
  'national',
  'html',
  'weekly',
  70,
  1
);

-- =============================================================================
-- PART 9: ビュー（運用支援）
-- =============================================================================

-- v_canonical_with_latest: canonicalと最新スナップショットの結合ビュー
CREATE VIEW IF NOT EXISTS v_canonical_with_latest AS
SELECT 
  c.id AS canonical_id,
  c.name,
  c.issuer_name,
  c.prefecture_code,
  c.is_active,
  s.id AS snapshot_id,
  s.acceptance_start,
  s.acceptance_end,
  s.is_accepting,
  s.subsidy_max_limit,
  s.subsidy_rate,
  s.official_url,
  sc.id AS cache_id,
  sc.wall_chat_ready,
  sc.wall_chat_mode
FROM subsidy_canonical c
LEFT JOIN subsidy_snapshot s ON c.latest_snapshot_id = s.id
LEFT JOIN subsidy_cache sc ON c.latest_cache_id = sc.id;

-- v_izumi_unmatched: jGrantsと紐付いていないizumiデータ
CREATE VIEW IF NOT EXISTS v_izumi_unmatched AS
SELECT 
  iz.id,
  iz.policy_id,
  iz.title,
  iz.issuer,
  iz.prefecture_code,
  iz.max_amount_value,
  iz.support_url,
  iz.crawl_status,
  iz.wall_chat_ready
FROM izumi_subsidies iz
WHERE iz.canonical_id IS NULL 
  AND iz.jgrants_id IS NULL
  AND iz.is_active = 1;

-- v_update_failures_pending: 未解決の更新失敗
CREATE VIEW IF NOT EXISTS v_update_failures_pending AS
SELECT 
  f.id,
  f.source_type,
  f.source_id,
  f.failure_type,
  f.failure_message,
  f.failure_url,
  f.retry_count,
  f.created_at,
  j.job_type,
  j.started_at AS job_started_at
FROM update_failures f
LEFT JOIN update_job_runs j ON f.job_run_id = j.id
WHERE f.resolved = 0
ORDER BY f.created_at DESC;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

-- =====================================================================
-- Migration: 0026_agency_dashboard_feed.sql
-- Date: 2026-01-23
-- Purpose: 士業ダッシュボード v1 - NEWSフィード基盤
-- 参考: 情報の泉型ダッシュボード設計
-- =====================================================================

-- =====================================================================
-- 1. subsidy_feed_items - NEWSフィードアイテム
-- =====================================================================
-- カテゴリ:
--   platform      - プラットフォームからのお知らせ（運営・重要告知）
--   support_info  - 新着支援情報サマリー（JGrants同期結果等）
--   prefecture    - 都道府県NEWS
--   municipal     - 市区町村NEWS
--   ministry      - 省庁NEWS（経産省・厚労省・国交省等）
--   other_public  - その他公的機関NEWS（商工会議所・支援機関等）
-- =====================================================================
CREATE TABLE IF NOT EXISTS subsidy_feed_items (
    id TEXT PRIMARY KEY,  -- hash(source_type + source_key + url) で重複排除
    
    -- ソース分類
    source_type TEXT NOT NULL CHECK (source_type IN (
        'platform', 'support_info', 'prefecture', 'municipal', 'ministry', 'other_public'
    )),
    source_key TEXT,  -- 例: pref-14, mhlw, jgrants, platform
    
    -- コンテンツ
    title TEXT NOT NULL,
    url TEXT,  -- リンク先（NULLの場合は詳細なし）
    summary TEXT,  -- 短文要約（なければNULL）
    
    -- 日時
    published_at TEXT,  -- 公開日時（不明ならNULL）
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),  -- 検知日時
    
    -- 地域（都道府県NEWS用）
    region_prefecture TEXT,  -- 都道府県コード（01-47）または '00' で全国
    region_city TEXT,  -- 市区町村コード（市区町村NEWS用）
    
    -- メタデータ
    tags_json TEXT DEFAULT '[]',  -- ["NEW","募集開始","締切更新"] 等
    event_type TEXT CHECK (event_type IN ('new', 'updated', 'closing', 'info', 'alert')),
    
    -- 参照
    subsidy_id TEXT,  -- subsidy_cacheとの紐付け（あれば）
    raw_ref TEXT,  -- 元データ参照（R2 key等）
    
    -- 管理
    is_read INTEGER DEFAULT 0,  -- 既読フラグ（agency単位では別テーブルで管理）
    priority INTEGER DEFAULT 0,  -- 表示優先度（大きいほど上）
    expires_at TEXT,  -- 表示期限（過ぎたら非表示）
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (subsidy_id) REFERENCES subsidy_cache(id) ON DELETE SET NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_feed_items_source_type ON subsidy_feed_items(source_type);
CREATE INDEX IF NOT EXISTS idx_feed_items_detected_at ON subsidy_feed_items(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_region_pref ON subsidy_feed_items(region_prefecture);
CREATE INDEX IF NOT EXISTS idx_feed_items_event_type ON subsidy_feed_items(event_type);
CREATE INDEX IF NOT EXISTS idx_feed_items_expires ON subsidy_feed_items(expires_at);

-- 重複排除用ユニーク制約（source_type + source_key + url の組み合わせ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_unique 
    ON subsidy_feed_items(source_type, source_key, url) 
    WHERE url IS NOT NULL;

-- =====================================================================
-- 2. agency_feed_read_status - 士業ごとの既読管理
-- =====================================================================
CREATE TABLE IF NOT EXISTS agency_feed_read_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id TEXT NOT NULL,
    feed_item_id TEXT NOT NULL,
    read_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
    FOREIGN KEY (feed_item_id) REFERENCES subsidy_feed_items(id) ON DELETE CASCADE,
    UNIQUE(agency_id, feed_item_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_read_agency ON agency_feed_read_status(agency_id);

-- =====================================================================
-- 3. feed_daily_snapshots - 日次集計（ダッシュボード高速化）
-- =====================================================================
CREATE TABLE IF NOT EXISTS feed_daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,  -- YYYY-MM-DD (JST)
    agency_id TEXT,  -- NULL=全体集計、値あり=agency個別
    
    -- カテゴリ別件数
    platform_count INTEGER DEFAULT 0,
    support_info_count INTEGER DEFAULT 0,
    prefecture_count INTEGER DEFAULT 0,
    municipal_count INTEGER DEFAULT 0,
    ministry_count INTEGER DEFAULT 0,
    other_public_count INTEGER DEFAULT 0,
    
    -- 詳細JSON（都道府県別件数等）
    prefecture_breakdown_json TEXT DEFAULT '{}',  -- {"14": 5, "13": 3, ...}
    
    -- 顧客関連（agency_id指定時のみ）
    client_prefecture_news_count INTEGER DEFAULT 0,  -- 顧客所在地の新着
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
    UNIQUE(snapshot_date, agency_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON feed_daily_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_agency ON feed_daily_snapshots(agency_id);

-- =====================================================================
-- 4. agency_suggestions_cache - 顧客おすすめキャッシュ
-- =====================================================================
-- 毎回評価を走らせず、日次/週次で事前計算した結果を保存
CREATE TABLE IF NOT EXISTS agency_suggestions_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id TEXT NOT NULL,
    agency_client_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    
    -- 推薦補助金
    subsidy_id TEXT NOT NULL,
    
    -- 評価結果（凍結: object禁止、string[]のみ）
    status TEXT NOT NULL CHECK (status IN ('PROCEED', 'CAUTION', 'NO')),
    score INTEGER NOT NULL DEFAULT 0,  -- 0-100
    match_reasons_json TEXT DEFAULT '[]',  -- string[]
    risk_flags_json TEXT DEFAULT '[]',  -- string[]
    
    -- 補助金情報スナップショット（詳細取得不要にするため）
    subsidy_title TEXT,
    subsidy_deadline TEXT,  -- acceptance_end_datetime
    subsidy_max_limit INTEGER,
    deadline_days INTEGER,  -- 締切まで日数
    
    -- ランキング
    rank_in_client INTEGER DEFAULT 1,  -- 顧客内順位（1,2,3...）
    
    -- 管理
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,  -- キャッシュ有効期限
    
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
    FOREIGN KEY (agency_client_id) REFERENCES agency_clients(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (subsidy_id) REFERENCES subsidy_cache(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suggestions_agency ON agency_suggestions_cache(agency_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_client ON agency_suggestions_cache(agency_client_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_expires ON agency_suggestions_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_rank ON agency_suggestions_cache(agency_id, agency_client_id, rank_in_client);

-- =====================================================================
-- 5. 初期プラットフォームお知らせ（サンプル）
-- =====================================================================
INSERT OR IGNORE INTO subsidy_feed_items (
    id, source_type, source_key, title, summary, event_type, priority, detected_at
) VALUES 
(
    'platform-welcome-v1',
    'platform',
    'platform',
    'ホジョラク 士業ダッシュボード v1 リリース',
    '顧客企業向けの補助金・助成金情報を効率的に管理できるダッシュボードをリリースしました。',
    'info',
    100,
    datetime('now')
);

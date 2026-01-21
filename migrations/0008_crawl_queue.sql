-- =====================================================
-- 0008_crawl_queue.sql
-- Cron専用キューテーブル（crawl_jobとは分離）
-- =====================================================

-- crawl_queue: Cron Worker が投入、Consumer Worker が処理
CREATE TABLE IF NOT EXISTS crawl_queue (
    queue_id TEXT PRIMARY KEY,
    
    -- ジョブ種別
    -- REGISTRY_CRAWL: source_registry起点の新規URL発見クロール
    -- SUBSIDY_CHECK: 既存制度の締切/予算枯渇チェック
    kind TEXT NOT NULL CHECK (kind IN ('REGISTRY_CRAWL', 'SUBSIDY_CHECK')),
    
    -- スコープ（どこから来たジョブか）
    scope TEXT NOT NULL CHECK (scope IN ('national', 'secretariat', 'prefecture', 'city')),
    
    -- 関連ID（nullable - 種別によって使い分け）
    geo_id TEXT,                      -- 都道府県/市区町村コード（prefecture/city の場合）
    subsidy_id TEXT,                  -- 制度ID（SUBSIDY_CHECK の場合）
    source_registry_id TEXT,          -- source_registry.registry_id（REGISTRY_CRAWL の場合）
    
    -- クロール対象
    url TEXT NOT NULL,                -- クロール対象URL
    domain_key TEXT,                  -- ドメインキー（domain_policy参照用）
    
    -- クロール設定
    crawl_strategy TEXT NOT NULL DEFAULT 'scrape' CHECK (crawl_strategy IN ('scrape', 'crawl', 'map')),
    max_depth INTEGER NOT NULL DEFAULT 1 CHECK (max_depth >= 0 AND max_depth <= 3),
    
    -- 優先度（1=最高、5=最低）
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    
    -- ステータス
    -- queued: 待機中
    -- running: 処理中
    -- done: 完了
    -- failed: 失敗（リトライ上限到達）
    -- cancelled: キャンセル
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    
    -- リトライ管理
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    
    -- 処理結果（成功時のメタデータ）
    result_payload TEXT,              -- JSON: { r2_key, content_hash, extracted_urls, ... }
    
    -- タイムスタンプ
    scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),  -- 予定実行時刻
    started_at TEXT,                  -- 処理開始時刻
    finished_at TEXT,                 -- 処理完了時刻
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Consumer用: status='queued' を priority順に取得
CREATE INDEX IF NOT EXISTS idx_crawl_queue_pick 
ON crawl_queue(status, priority, scheduled_at);

-- Cron用: 24h重複ガード（同一kind+url+statusの組み合わせ）
CREATE INDEX IF NOT EXISTS idx_crawl_queue_dedup 
ON crawl_queue(kind, url, status, created_at);

-- subsidy_id での検索用
CREATE INDEX IF NOT EXISTS idx_crawl_queue_subsidy 
ON crawl_queue(subsidy_id, status);

-- source_registry_id での検索用
CREATE INDEX IF NOT EXISTS idx_crawl_queue_registry 
ON crawl_queue(source_registry_id, status);

-- domain_key での検索用（ドメイン単位の失敗監視）
CREATE INDEX IF NOT EXISTS idx_crawl_queue_domain 
ON crawl_queue(domain_key, status);

-- =====================================================
-- crawl_queue_stats: Consumer の処理統計
-- =====================================================
CREATE TABLE IF NOT EXISTS crawl_queue_stats (
    stat_id TEXT PRIMARY KEY,
    stat_day TEXT NOT NULL,           -- YYYY-MM-DD
    metric TEXT NOT NULL,             -- enqueued, processed, succeeded, failed, domain_blocked
    scope TEXT,                       -- national, secretariat, prefecture, city, ALL
    value INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(stat_day, metric, scope)
);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_stats_day 
ON crawl_queue_stats(stat_day, metric);

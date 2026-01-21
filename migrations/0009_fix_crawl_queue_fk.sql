-- =====================================================
-- 0009: crawl_queue の subsidy FK 制約修正
-- =====================================================
-- subsidy テーブルが存在しないため、FK 制約を削除した新テーブルを作成

-- 1. 旧テーブルをリネーム
ALTER TABLE crawl_queue RENAME TO crawl_queue_old;

-- 2. 新テーブル作成（FK を geo_region と source_registry のみに限定）
CREATE TABLE crawl_queue (
  queue_id TEXT PRIMARY KEY,
  
  -- ジョブ種別
  kind TEXT NOT NULL CHECK (kind IN ('REGISTRY_CRAWL', 'SUBSIDY_CHECK', 'URL_CRAWL')),
  
  -- スコープと地域
  scope TEXT NOT NULL CHECK (scope IN ('national', 'secretariat', 'prefecture', 'city')),
  geo_id TEXT,
  
  -- 関連ID（nullable, FK なし）
  subsidy_id TEXT,
  source_registry_id TEXT,
  
  -- クロール対象
  url TEXT NOT NULL,
  domain_key TEXT NOT NULL,
  
  -- クロール設定
  crawl_strategy TEXT NOT NULL DEFAULT 'scrape' CHECK (crawl_strategy IN ('scrape', 'crawl', 'map')),
  max_depth INTEGER NOT NULL DEFAULT 1 CHECK (max_depth >= 0 AND max_depth <= 3),
  
  -- 優先度（1=最高, 5=最低）
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  
  -- ステータス管理
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed', 'blocked')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  
  -- 実行タイミング
  scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  
  -- 処理結果（nullable）
  result_raw_key TEXT,
  result_hash TEXT,
  
  -- 監査
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- FK は geo_region と source_registry のみ
  FOREIGN KEY (geo_id) REFERENCES geo_region(geo_id) ON DELETE SET NULL,
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(registry_id) ON DELETE SET NULL
);

-- 3. データ移行
INSERT INTO crawl_queue SELECT * FROM crawl_queue_old;

-- 4. 旧テーブル削除
DROP TABLE crawl_queue_old;

-- 5. インデックス再作成
CREATE INDEX IF NOT EXISTS idx_crawl_queue_pick 
  ON crawl_queue(status, priority, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_dedup 
  ON crawl_queue(kind, url, status, created_at);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_domain 
  ON crawl_queue(domain_key, status);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_subsidy 
  ON crawl_queue(subsidy_id, status);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_registry 
  ON crawl_queue(source_registry_id, status);

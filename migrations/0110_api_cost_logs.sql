-- =====================================================
-- 0110_api_cost_logs.sql
-- APIコスト記録テーブル（実数ベース・凍結運用）
-- 
-- 凍結ルール（Freeze-COST-0〜4）:
--   - Freeze-COST-0: api_cost_logs が唯一の真実（super_adminはこれのみ表示）
--   - Freeze-COST-1: 推定値はUI表示禁止、実数のみ集計・表示
--   - Freeze-COST-2: 外部API呼び出しは wrapper 経由必須
--   - Freeze-COST-3: 失敗時もコスト記録（credits消費は発生）
--   - Freeze-COST-4: モデル名/単価は metadata_json に保持
--
-- 既存テーブルとの関係:
--   - cost_usage_log (0021): 残置（移行コスト0件のため削除不要）
--   - extraction_logs (0106): 抽出ログ用として継続利用
--   - api_cost_logs (本ファイル): コスト集計の唯一の真実
-- =====================================================

-- APIコストログテーブル
CREATE TABLE IF NOT EXISTS api_cost_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- サービス情報
  service TEXT NOT NULL,              -- 'firecrawl' | 'vision_ocr' | 'openai' | 'anthropic'
  action TEXT NOT NULL,               -- 'scrape' | 'ocr' | 'chat_completion' | 'embedding'
  
  -- 関連エンティティ（nullable）
  source_id TEXT,                     -- feed_sources.id（例: 'src-jnet21'）
  subsidy_id TEXT,                    -- subsidy_cache.id
  discovery_item_id TEXT,             -- discovery_items.id
  
  -- リクエスト情報
  url TEXT,                           -- 対象URL（scrape/ocr時）
  
  -- 消費量（実数）
  units REAL NOT NULL DEFAULT 0,      -- 消費ユニット（credit / page / token）
  unit_type TEXT NOT NULL,            -- 'credit' | 'page' | 'input_token' | 'output_token'
  cost_usd REAL NOT NULL DEFAULT 0,   -- 実数コスト（USD）
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- 実行結果
  success INTEGER NOT NULL DEFAULT 1, -- 0=失敗, 1=成功
  http_status INTEGER,                -- HTTPステータスコード
  error_code TEXT,                    -- エラーコード（例: 'RATE_LIMITED'）
  error_message TEXT,                 -- エラーメッセージ
  
  -- 詳細情報（凍結ルール Freeze-COST-4）
  raw_usage_json TEXT,                -- API応答の生usage情報
  metadata_json TEXT,                 -- モデル名/単価/追加情報（{"model":"gpt-4o","rate":0.005}）
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス（検索パターンに基づく）
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_service ON api_cost_logs(service);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_created_at ON api_cost_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_subsidy ON api_cost_logs(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_source ON api_cost_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_discovery ON api_cost_logs(discovery_item_id);
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_service_date ON api_cost_logs(service, date(created_at));
CREATE INDEX IF NOT EXISTS idx_api_cost_logs_success ON api_cost_logs(success);

-- =====================================================
-- 集計クエリサンプル（super_admin用）
-- =====================================================

-- 1. 日次コスト集計（サービス別）
-- SELECT 
--   DATE(created_at) as date,
--   service,
--   SUM(cost_usd) as total_cost_usd,
--   SUM(units) as total_units,
--   COUNT(*) as call_count,
--   SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
--   SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
-- FROM api_cost_logs
-- WHERE created_at >= datetime('now', '-7 days')
-- GROUP BY DATE(created_at), service
-- ORDER BY date DESC, service;

-- 2. 補助金別コスト（上位10件）
-- SELECT 
--   subsidy_id,
--   SUM(cost_usd) as total_cost_usd,
--   COUNT(*) as call_count
-- FROM api_cost_logs
-- WHERE subsidy_id IS NOT NULL
-- GROUP BY subsidy_id
-- ORDER BY total_cost_usd DESC
-- LIMIT 10;

-- 3. 総累計コスト
-- SELECT 
--   service,
--   SUM(cost_usd) as total_cost_usd,
--   SUM(units) as total_units,
--   COUNT(*) as total_calls
-- FROM api_cost_logs
-- GROUP BY service;

-- 4. 失敗ログ分析
-- SELECT 
--   service,
--   error_code,
--   COUNT(*) as count,
--   SUM(cost_usd) as wasted_cost_usd
-- FROM api_cost_logs
-- WHERE success = 0
-- GROUP BY service, error_code
-- ORDER BY count DESC;

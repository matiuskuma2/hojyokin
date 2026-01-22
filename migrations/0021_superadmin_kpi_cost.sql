-- =====================================================
-- Migration: 0021_superadmin_kpi_cost.sql
-- Purpose: Superadmin KPI・コスト監視・データ鮮度監視テーブル
-- Date: 2026-01-22
-- =====================================================

-- =====================================================
-- 1. event_log: 汎用イベントログ（監査・分析用）
-- =====================================================
-- usage_events とは別に、より詳細な操作ログを記録
-- 監査証跡、セキュリティ分析、ユーザー行動分析に使用
CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  
  -- イベント情報
  event_type TEXT NOT NULL,              -- API_CALL / LOGIN / LOGOUT / SEARCH / CHAT / DRAFT / INTAKE / LINK_CREATED / ERROR
  event_subtype TEXT,                    -- 詳細分類（例: API_CALL の場合 GET_SUBSIDIES）
  severity TEXT DEFAULT 'info',          -- info / warning / error / critical
  
  -- アクター情報
  user_id TEXT,
  user_role TEXT,
  agency_id TEXT,
  company_id TEXT,
  
  -- リクエスト情報
  request_id TEXT,                       -- リクエスト追跡用ID
  request_method TEXT,
  request_path TEXT,
  request_query TEXT,
  request_body_hash TEXT,                -- ボディのハッシュ（PII保護）
  
  -- レスポンス情報
  response_status INTEGER,
  response_time_ms INTEGER,
  
  -- 詳細データ
  metadata_json TEXT,                    -- 追加のコンテキスト情報
  
  -- クライアント情報
  ip_address TEXT,
  user_agent TEXT,
  country_code TEXT,
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_user ON event_log(user_id);
CREATE INDEX IF NOT EXISTS idx_event_log_agency ON event_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
CREATE INDEX IF NOT EXISTS idx_event_log_severity ON event_log(severity);
CREATE INDEX IF NOT EXISTS idx_event_log_request_id ON event_log(request_id);

-- =====================================================
-- 2. cost_usage_log: コスト詳細ログ
-- =====================================================
-- 各API呼び出しのコストを詳細に記録
-- 請求、予算管理、コスト最適化に使用
CREATE TABLE IF NOT EXISTS cost_usage_log (
  id TEXT PRIMARY KEY,
  
  -- 発生源
  user_id TEXT,
  agency_id TEXT,
  company_id TEXT,
  
  -- サービス情報
  provider TEXT NOT NULL,                -- openai / firecrawl / aws / cloudflare
  service TEXT NOT NULL,                 -- gpt-4o / embedding / scrape / s3 / r2 / d1
  operation TEXT,                        -- completion / scrape / upload / query
  
  -- 使用量
  input_units INTEGER,                   -- 入力トークン / ページ数 / バイト数
  output_units INTEGER,                  -- 出力トークン
  total_units INTEGER,
  
  -- コスト
  unit_cost_usd REAL,                    -- 単位あたりコスト
  estimated_cost_usd REAL NOT NULL,      -- 推定コスト
  
  -- 関連情報
  request_id TEXT,
  related_entity_type TEXT,              -- subsidy / company / chat / draft
  related_entity_id TEXT,
  
  -- メタデータ
  metadata_json TEXT,                    -- モデル名、レイテンシなど
  
  -- ステータス
  billing_status TEXT DEFAULT 'pending', -- pending / billed / free_tier / error
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cost_usage_log_user ON cost_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_agency ON cost_usage_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_provider ON cost_usage_log(provider);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_created ON cost_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_usage_log_billing ON cost_usage_log(billing_status);

-- =====================================================
-- 3. data_freshness_log: データ鮮度監視ログ
-- =====================================================
-- 補助金データの更新状況を追跡
-- 古いデータの検出、クロールスケジュール最適化に使用
CREATE TABLE IF NOT EXISTS data_freshness_log (
  id TEXT PRIMARY KEY,
  
  -- 対象
  source_type TEXT NOT NULL,             -- jgrants / prefectural / municipal / custom
  source_id TEXT,                        -- source_registry.id
  source_url TEXT,
  
  -- チェック結果
  check_type TEXT NOT NULL,              -- scheduled / manual / on_access
  check_result TEXT NOT NULL,            -- fresh / stale / error / unchanged
  
  -- 詳細
  last_modified_at TEXT,                 -- ソースの最終更新日時
  content_hash TEXT,                     -- コンテンツハッシュ
  previous_hash TEXT,                    -- 前回のハッシュ
  changes_detected INTEGER DEFAULT 0,   -- 変更があったか
  
  -- データ統計
  records_count INTEGER,                 -- レコード数
  new_records INTEGER,                   -- 新規レコード数
  updated_records INTEGER,               -- 更新されたレコード数
  deleted_records INTEGER,               -- 削除されたレコード数
  
  -- パフォーマンス
  check_duration_ms INTEGER,
  
  -- エラー情報
  error_code TEXT,
  error_message TEXT,
  
  -- アラート
  alert_sent INTEGER DEFAULT 0,
  alert_type TEXT,                       -- stale_data / source_error / schema_change
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_data_freshness_log_source ON data_freshness_log(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_result ON data_freshness_log(check_result);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_created ON data_freshness_log(created_at);
CREATE INDEX IF NOT EXISTS idx_data_freshness_log_alert ON data_freshness_log(alert_sent, alert_type);

-- =====================================================
-- 4. kpi_daily_snapshots: 日次KPIスナップショット
-- =====================================================
-- 毎日のKPIを事前集計して保存
-- ダッシュボード表示の高速化に使用
CREATE TABLE IF NOT EXISTS kpi_daily_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,             -- YYYY-MM-DD
  
  -- ユーザーKPI
  total_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,        -- その日にログインしたユーザー数
  agency_users INTEGER DEFAULT 0,
  
  -- 利用KPI
  searches INTEGER DEFAULT 0,
  chat_sessions INTEGER DEFAULT 0,
  chat_messages INTEGER DEFAULT 0,
  drafts_created INTEGER DEFAULT 0,
  drafts_finalized INTEGER DEFAULT 0,
  
  -- Agency KPI
  total_agencies INTEGER DEFAULT 0,
  total_clients INTEGER DEFAULT 0,
  intake_submissions INTEGER DEFAULT 0,
  links_issued INTEGER DEFAULT 0,
  
  -- コストKPI
  total_cost_usd REAL DEFAULT 0,
  openai_cost_usd REAL DEFAULT 0,
  firecrawl_cost_usd REAL DEFAULT 0,
  other_cost_usd REAL DEFAULT 0,
  
  -- データKPI
  subsidies_total INTEGER DEFAULT 0,
  subsidies_active INTEGER DEFAULT 0,
  crawl_success INTEGER DEFAULT 0,
  crawl_failed INTEGER DEFAULT 0,
  
  -- メタ
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_daily_snapshots_date ON kpi_daily_snapshots(date);

-- =====================================================
-- 5. alert_rules: アラートルール設定
-- =====================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- 条件
  metric TEXT NOT NULL,                  -- cost_daily / error_rate / stale_data / queue_depth
  operator TEXT NOT NULL,                -- gt / lt / gte / lte / eq / neq
  threshold REAL NOT NULL,
  time_window_minutes INTEGER DEFAULT 60,
  
  -- アクション
  action_type TEXT NOT NULL,             -- email / slack / webhook / log
  action_config_json TEXT,               -- 通知先の設定
  
  -- 状態
  enabled INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  trigger_count INTEGER DEFAULT 0,
  cooldown_minutes INTEGER DEFAULT 60,   -- 再発報までの待機時間
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);

-- =====================================================
-- 6. alert_history: アラート発報履歴
-- =====================================================
CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  
  -- 発報情報
  metric_value REAL,
  threshold REAL,
  message TEXT,
  
  -- ステータス
  status TEXT DEFAULT 'fired',           -- fired / acknowledged / resolved
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved_at TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at);

-- =====================================================
-- 7. デフォルトアラートルールの投入
-- =====================================================
INSERT OR IGNORE INTO alert_rules (id, name, description, metric, operator, threshold, time_window_minutes, action_type, enabled) VALUES
  ('alert_cost_spike', 'コスト急増検知', '日次コストが前日の3倍を超えた場合', 'cost_daily_ratio', 'gt', 3.0, 1440, 'log', 1),
  ('alert_error_rate', 'エラー率上昇', 'クロールエラー率が20%を超えた場合', 'crawl_error_rate', 'gt', 0.2, 60, 'log', 1),
  ('alert_stale_data', 'データ鮮度低下', '24時間以上更新がないソースがある場合', 'stale_sources_count', 'gt', 0, 1440, 'log', 1),
  ('alert_queue_depth', 'キュー滞留', '待機キューが1000件を超えた場合', 'queue_pending_count', 'gt', 1000, 30, 'log', 1);

-- =====================================================
-- 8. usage_events にインデックス追加（KPI集計高速化）
-- =====================================================
-- 既存テーブルへのインデックス追加
CREATE INDEX IF NOT EXISTS idx_usage_events_date ON usage_events(date(created_at));
CREATE INDEX IF NOT EXISTS idx_usage_events_provider_date ON usage_events(provider, date(created_at));

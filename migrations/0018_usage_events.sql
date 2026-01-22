-- usage_events: 統合イベントログ基盤
-- KPI / コスト / 更新状況を全てここから集計可能にする

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  
  -- 主体（誰が）
  user_id TEXT,
  company_id TEXT,
  
  -- イベント種別
  event_type TEXT NOT NULL,
  -- REGISTER, LOGIN, SUBSIDY_SEARCH, CHAT_SESSION_START, CHAT_MESSAGE,
  -- DRAFT_GENERATE, DRAFT_FINALIZE, OPENAI_CALL, FIRECRAWL_SCRAPE,
  -- CRON_RUN, CONSUMER_RUN, CRAWL_SUCCESS, CRAWL_FAILURE
  
  -- プロバイダー（コスト計算用）
  provider TEXT, -- openai, firecrawl, aws, internal, jgrants
  
  -- OpenAI用
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  -- Firecrawl用
  domain TEXT,
  url TEXT,
  pages_count INTEGER,
  word_count INTEGER,
  
  -- コスト（USD）
  estimated_cost_usd REAL,
  
  -- 共通
  feature TEXT, -- chat, draft, extraction, knowledge, search
  success INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  
  -- メタデータ（柔軟に拡張）
  metadata_json TEXT,
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_company_id ON usage_events(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_feature ON usage_events(feature);

-- 日次集計用複合インデックス
CREATE INDEX IF NOT EXISTS idx_usage_events_daily ON usage_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_cost ON usage_events(provider, created_at, estimated_cost_usd);

-- OpenAIモデル別集計用
CREATE INDEX IF NOT EXISTS idx_usage_events_openai ON usage_events(provider, model, created_at);

-- =====================================================
-- 0121_missing_requirements_queue.sql
-- Gate: 不足チケット化（Freeze Gate v1）
-- =====================================================

CREATE TABLE IF NOT EXISTS missing_requirements_queue (
  id TEXT PRIMARY KEY,                      -- UUID
  canonical_id TEXT NOT NULL,               -- subsidy_canonical.id（SSOT恒久ID）
  snapshot_id TEXT,                         -- subsidy_snapshot.id（latest）
  cache_id TEXT,                            -- subsidy_cache.id（latest_cache_id）
  program_name TEXT NOT NULL,               -- 表示用（canonical.name など）
  priority INTEGER NOT NULL DEFAULT 50,      -- 0(最優先)〜100(低)
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','urgent')),

  -- 不足の中身（Freeze Gate v1）
  missing_keys_json TEXT NOT NULL,          -- JSON array of MissingKey
  missing_summary TEXT NOT NULL,            -- 人間向け要約

  -- Gate状態
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'needs_url',
    'monitor_registered',
    'awaiting_change',
    'ready_for_extract',
    'extracting',
    'resolved',
    'ignored'
  )),

  -- 人間が入力する欄
  source_urls_json TEXT,                    -- JSON array of URLs（公募ページ/要領DLページ等）
  pdf_urls_json TEXT,                       -- JSON array of URLs（公募要領PDF直リンク）
  url_note TEXT,

  -- 監視連携
  monitor_id TEXT,                          -- data_source_monitors.id
  monitored_files_count INTEGER NOT NULL DEFAULT 0,

  -- コストガード（Freeze）
  firecrawl_budget_pages INTEGER NOT NULL DEFAULT 3,
  ai_budget_pdfs INTEGER NOT NULL DEFAULT 2,
  ai_budget_tokens INTEGER NOT NULL DEFAULT 20000,

  -- 監査
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked_at TEXT,
  resolved_at TEXT,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_mrq_status_priority ON missing_requirements_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_mrq_canonical ON missing_requirements_queue(canonical_id);
CREATE INDEX IF NOT EXISTS idx_mrq_monitor ON missing_requirements_queue(monitor_id);

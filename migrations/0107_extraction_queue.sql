-- =====================================================================
-- Migration: 0107_extraction_queue.sql
-- Purpose : 17,000件運用向け shard/queue 基盤
-- Date    : 2026-01-25
-- =====================================================================

PRAGMA foreign_keys = OFF;

-- 1) extraction_queue: 抽出処理キュー（shard_keyで分割）
CREATE TABLE IF NOT EXISTS extraction_queue (
  id TEXT PRIMARY KEY,                -- uuid
  subsidy_id TEXT NOT NULL,
  shard_key INTEGER NOT NULL,          -- 0..15
  job_type TEXT NOT NULL,             -- 'extract_forms' | 'enrich_jgrants' | 'enrich_shigoto'
  priority INTEGER DEFAULT 100,        -- 小さいほど優先
  status TEXT DEFAULT 'queued',        -- queued | leased | done | failed | parked
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,

  lease_owner TEXT,
  lease_until DATETIME,
  last_error TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 二重投入防止（同じ制度×同じjob_typeは1つ）
CREATE UNIQUE INDEX IF NOT EXISTS uq_exq_dedupe
  ON extraction_queue (subsidy_id, job_type);

-- shard + status + priority で高速に取る
CREATE INDEX IF NOT EXISTS idx_exq_shard_status_pri
  ON extraction_queue (shard_key, status, priority, updated_at);

-- lease回収用
CREATE INDEX IF NOT EXISTS idx_exq_lease
  ON extraction_queue (status, lease_until);

-- 2) subsidy_cache.shard_key（任意だが超便利）
-- 既にある場合は無視される
ALTER TABLE subsidy_cache ADD COLUMN shard_key INTEGER;

CREATE INDEX IF NOT EXISTS idx_subsidy_cache_shard
  ON subsidy_cache (shard_key, source);

PRAGMA foreign_keys = ON;

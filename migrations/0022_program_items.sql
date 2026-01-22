-- =====================================================
-- Migration: 0022_program_items.sql
-- Purpose: L3網羅性測定のための募集案件台帳
-- Date: 2026-01-22
-- =====================================================
--
-- 設計背景:
-- - 現状は subsidies テーブルが「取得できた補助金」のみ
-- - 「存在するはずの補助金」を把握できない（網羅性測定不可）
-- - program_items は「公式に募集されている案件」の台帳
-- - subsidies との突合で「取りこぼし」を検出
--
-- 使用例:
-- - 経産省の補助金一覧（jGrants公式）
-- - 都道府県別の補助金情報ページ
-- - 各団体の公募一覧ページ
--
-- =====================================================

-- =====================================================
-- 1. program_items: 募集案件台帳
-- =====================================================
CREATE TABLE IF NOT EXISTS program_items (
  id TEXT PRIMARY KEY,
  
  -- 識別情報
  external_id TEXT,                      -- 外部システムID（jGrants ID等）
  source_registry_id TEXT,               -- 情報源
  source_url TEXT,                       -- 取得元URL
  
  -- 基本情報
  title TEXT NOT NULL,                   -- 案件名
  organizer TEXT,                        -- 実施機関
  target_region TEXT,                    -- 対象地域（都道府県コード or 'national'）
  category TEXT,                         -- カテゴリ（補助金/助成金/融資/税制優遇等）
  
  -- 募集期間
  application_start TEXT,                -- 募集開始日
  application_end TEXT,                  -- 募集終了日
  fiscal_year INTEGER,                   -- 対象年度
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'active', -- active / closed / cancelled / unknown
  
  -- 突合情報
  matched_subsidy_id TEXT,               -- 対応する subsidies.id
  match_status TEXT DEFAULT 'unmatched', -- unmatched / matched / partial / duplicate
  match_confidence REAL,                 -- マッチ確信度 (0-1)
  matched_at TEXT,                       -- 突合日時
  
  -- メタデータ
  raw_json TEXT,                         -- 生データ
  notes TEXT,                            -- 管理者メモ
  
  -- タイムスタンプ
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),  -- 発見日時
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(id) ON DELETE SET NULL,
  FOREIGN KEY (matched_subsidy_id) REFERENCES subsidies(id) ON DELETE SET NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_program_items_external_id ON program_items(external_id);
CREATE INDEX IF NOT EXISTS idx_program_items_source ON program_items(source_registry_id);
CREATE INDEX IF NOT EXISTS idx_program_items_region ON program_items(target_region);
CREATE INDEX IF NOT EXISTS idx_program_items_status ON program_items(status);
CREATE INDEX IF NOT EXISTS idx_program_items_match ON program_items(match_status);
CREATE INDEX IF NOT EXISTS idx_program_items_end ON program_items(application_end);
CREATE INDEX IF NOT EXISTS idx_program_items_fiscal ON program_items(fiscal_year);

-- external_id + source でユニーク（同じソースからの重複防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_items_external_source 
  ON program_items(external_id, source_registry_id) WHERE external_id IS NOT NULL;

-- =====================================================
-- 2. program_item_history: 変更履歴
-- =====================================================
-- 案件の状態変化を追跡（新規発見/更新/終了）
CREATE TABLE IF NOT EXISTS program_item_history (
  id TEXT PRIMARY KEY,
  program_item_id TEXT NOT NULL,
  
  event_type TEXT NOT NULL,              -- discovered / updated / closed / matched / unmatched
  old_value TEXT,
  new_value TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (program_item_id) REFERENCES program_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_program_item_history_item ON program_item_history(program_item_id);
CREATE INDEX IF NOT EXISTS idx_program_item_history_type ON program_item_history(event_type);
CREATE INDEX IF NOT EXISTS idx_program_item_history_created ON program_item_history(created_at);

-- =====================================================
-- 3. coverage_snapshots: 網羅性スナップショット
-- =====================================================
-- 日次で網羅性を記録
CREATE TABLE IF NOT EXISTS coverage_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  
  -- L1: 入口網羅性
  l1_total_sources INTEGER DEFAULT 0,
  l1_enabled_sources INTEGER DEFAULT 0,
  l1_prefectures_covered INTEGER DEFAULT 0,
  l1_score INTEGER DEFAULT 0,
  
  -- L2: 稼働網羅性
  l2_crawled_today INTEGER DEFAULT 0,
  l2_success_rate REAL DEFAULT 0,
  l2_stale_sources INTEGER DEFAULT 0,
  l2_score INTEGER DEFAULT 0,
  
  -- L3: 制度網羅性
  l3_program_items_total INTEGER DEFAULT 0,
  l3_matched_count INTEGER DEFAULT 0,
  l3_unmatched_count INTEGER DEFAULT 0,
  l3_match_rate REAL DEFAULT 0,
  l3_score INTEGER DEFAULT 0,
  
  -- 総合
  total_score INTEGER DEFAULT 0,
  
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coverage_snapshots_date ON coverage_snapshots(date);

-- =====================================================
-- 4. 初期データ: jGrants公式ソースを program_items 抽出対象に
-- =====================================================
-- source_registry に program_items 抽出フラグを追加
-- （既存テーブルへのカラム追加）
-- ALTER TABLE source_registry ADD COLUMN extract_program_items INTEGER DEFAULT 0;
-- ↑ reconcile で対応済みの場合は不要。以下は安全策として記載

-- =====================================================
-- 5. ビュー: 網羅性サマリー
-- =====================================================
-- SQLite はビューの IF NOT EXISTS をサポートしないため、
-- DROP IF EXISTS + CREATE の組み合わせで対応

DROP VIEW IF EXISTS coverage_summary;
CREATE VIEW coverage_summary AS
SELECT 
  -- L1
  (SELECT COUNT(*) FROM source_registry WHERE enabled = 1) as l1_enabled_sources,
  (SELECT COUNT(DISTINCT geo_region) FROM source_registry WHERE geo_region IS NOT NULL AND enabled = 1) as l1_regions_covered,
  
  -- L2
  (SELECT COUNT(*) FROM source_registry WHERE last_crawled_at >= datetime('now', '-24 hours')) as l2_crawled_24h,
  (SELECT COUNT(*) FROM source_registry WHERE enabled = 1 AND (last_crawled_at < datetime('now', '-7 days') OR last_crawled_at IS NULL)) as l2_stale_count,
  
  -- L3
  (SELECT COUNT(*) FROM program_items WHERE status = 'active') as l3_active_programs,
  (SELECT COUNT(*) FROM program_items WHERE match_status = 'matched') as l3_matched,
  (SELECT COUNT(*) FROM program_items WHERE match_status = 'unmatched' AND status = 'active') as l3_unmatched,
  
  -- 補助金
  (SELECT COUNT(*) FROM subsidies WHERE status = 'active') as subsidies_active,
  
  datetime('now') as generated_at;

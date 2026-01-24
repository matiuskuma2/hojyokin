-- Migration: 0103_wall_chat_ready.sql
-- Purpose: Add wall_chat_ready tracking columns to subsidy_cache
-- 
-- WALL_CHAT_READY 判定:
-- 壁打ちチャットが成立するために必要なデータが揃っているかを追跡
-- - wall_chat_ready: 1=壁打ち可能, 0=データ不足
-- - wall_chat_missing: 不足している項目のJSON配列
-- - detail_score: SEARCHABLE判定のスコア (0-5)

-- subsidy_cache に壁打ち判定カラムを追加
ALTER TABLE subsidy_cache ADD COLUMN wall_chat_ready INTEGER DEFAULT 0;
ALTER TABLE subsidy_cache ADD COLUMN wall_chat_missing TEXT DEFAULT '[]';
ALTER TABLE subsidy_cache ADD COLUMN detail_score INTEGER DEFAULT 0;

-- インデックス追加（壁打ち可能な補助金の検索用）
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_wall_chat_ready 
ON subsidy_cache(wall_chat_ready, request_reception_display_flag);

-- 既存データの wall_chat_ready を初期化（detail_json が十分なものを1に）
-- ※ これはJS側で再計算するため、ここでは最低限の初期化のみ
UPDATE subsidy_cache 
SET wall_chat_ready = 0, 
    detail_score = 0,
    wall_chat_missing = '["overview","application_requirements","eligible_expenses","required_documents","deadline","required_forms"]'
WHERE wall_chat_ready IS NULL;

-- REAL-001/002/003（3本柱）は detail_json が充実しているので wall_chat_ready = 1 にする
-- ※ 実際の判定はJS側で行うため、ここではプレースホルダ
-- UPDATE subsidy_cache 
-- SET wall_chat_ready = 1, detail_score = 5, wall_chat_missing = '[]'
-- WHERE id IN ('REAL-001', 'REAL-002', 'REAL-003')
--   AND detail_json IS NOT NULL 
--   AND LENGTH(detail_json) > 100;

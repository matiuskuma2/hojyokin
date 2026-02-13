-- =============================================================================
-- 0127_wallchat_v31_gate.sql
-- Freeze v3.0/v3.1: 回次Gate + セッション固定 + 経費審査基盤
-- =============================================================================
-- 実行日: 2026-02-13
-- 根拠: WALLCHAT_ARCHITECTURE_FREEZE.md §18.5, §23
-- 変更内容:
--   1. chat_sessions に回次スナップショット情報を追加（6カラム）
--   2. セッション開始時に回次情報を固定し、途中の公募要領変更による矛盾を防止
-- =============================================================================

-- 1. 制度ID（整理用、NULLable）
-- 壁打ちの SSOT は回次ID（subsidy_id）だが、制度IDを参照用に保存
ALTER TABLE chat_sessions ADD COLUMN scheme_id TEXT;

-- 2. 開始時点の補助金タイトル（スナップショット）
-- セッション中に公募タイトルが変更されても、開始時点の情報を保持
ALTER TABLE chat_sessions ADD COLUMN subsidy_title_at_start TEXT;

-- 3. 開始時点の締切日（スナップショット）
-- 受付期間変更があっても、セッション内では固定
ALTER TABLE chat_sessions ADD COLUMN acceptance_end_at_start TEXT;

-- 4. 開始時点のデータハッシュ
-- セッション再開時に現在のハッシュと比較し、変更検知に使用
ALTER TABLE chat_sessions ADD COLUMN nsd_content_hash TEXT;

-- 5. ドラフトモード（壁打ち開始時に決定）
-- 'full_template' | 'structured_outline' | 'eligibility_only'
ALTER TABLE chat_sessions ADD COLUMN draft_mode TEXT;

-- 6. データソース種別
-- 'ssot' = canonical+snapshot解決済み
-- 'cache' = subsidy_cacheフォールバック
-- 'mock' = モックデータ
ALTER TABLE chat_sessions ADD COLUMN nsd_source TEXT DEFAULT 'cache';

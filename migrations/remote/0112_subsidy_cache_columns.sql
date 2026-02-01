-- =============================================================================
-- 0112_subsidy_cache_columns.sql (Production Version)
-- Add columns to subsidy_cache for SSOT integration
-- =============================================================================

-- wall_chat_mode: 壁打ちモード
ALTER TABLE subsidy_cache ADD COLUMN wall_chat_mode TEXT DEFAULT 'pending';

-- canonical_id: canonical参照
ALTER TABLE subsidy_cache ADD COLUMN canonical_id TEXT;

-- is_electronic_application: 電子申請フラグ
ALTER TABLE subsidy_cache ADD COLUMN is_electronic_application INTEGER DEFAULT 0;

-- is_visible: 検索表示フラグ
ALTER TABLE subsidy_cache ADD COLUMN is_visible INTEGER DEFAULT 1;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_wall_mode ON subsidy_cache(wall_chat_mode);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_canonical ON subsidy_cache(canonical_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_electronic ON subsidy_cache(is_electronic_application);
CREATE INDEX IF NOT EXISTS idx_subsidy_cache_visible ON subsidy_cache(is_visible);

-- 既存データの初期化
UPDATE subsidy_cache SET is_visible = 1 WHERE is_visible IS NULL;
UPDATE subsidy_cache SET wall_chat_mode = 'pending' WHERE wall_chat_mode IS NULL;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

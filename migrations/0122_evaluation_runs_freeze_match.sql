-- ============================================================
-- Freeze-MATCH Gate: evaluation_runs スキーマ拡張
-- ============================================================
-- Gate-A: screening_version を追加（v1/v2 の追跡）
-- Gate-B: subsidy_source_id, subsidy_cache_id を追加（ID分離）
-- ============================================================

-- 1. screening_version カラム追加（v1/v2）
-- デフォルトは 'v1'（既存データとの互換性）
ALTER TABLE evaluation_runs ADD COLUMN screening_version TEXT DEFAULT 'v1';

-- 2. subsidy_source_id カラム追加（JGrants ID等の元ID）
-- canonical_id とは別に元のIDを保持（追跡用）
ALTER TABLE evaluation_runs ADD COLUMN subsidy_source_id TEXT;

-- 3. subsidy_cache_id カラム追加（使用したcache_id）
-- どのキャッシュを使って判定したかを記録
ALTER TABLE evaluation_runs ADD COLUMN subsidy_cache_id TEXT;

-- 4. missing_fields_json カラム追加（情報不足フィールド）
-- screening-v2 で検出した不足情報を保存
ALTER TABLE evaluation_runs ADD COLUMN missing_fields_json TEXT;

-- 5. インデックス追加
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_version 
  ON evaluation_runs(screening_version);
  
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_source_id 
  ON evaluation_runs(subsidy_source_id);

-- ============================================================
-- 既存データのバックフィル（必要に応じて）
-- ============================================================
-- 既存レコードは screening_version = 'v1' がデフォルトで入る
-- subsidy_source_id は後から埋める（または null のまま）

-- ============================================================
-- 凍結仕様（Freeze-MATCH）
-- ============================================================
-- subsidy_id: 常に canonical_id を格納（厳格）
-- subsidy_source_id: JGrants ID 等の元ID（nullable）
-- subsidy_cache_id: 使用した cache_id（nullable）
-- screening_version: 'v1' | 'v2'（必須）
-- missing_fields_json: JSON配列 [{ field, source, severity, label, reason }]

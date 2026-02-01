-- =============================================================================
-- 0112_ssot_enhancements.sql
-- SSOT統合スクリプト用のカラム追加・拡張
-- =============================================================================
-- 
-- 追加内容:
-- 1. izumi_subsidies: raw保全用カラム（raw_json, row_hash, first_seen_at, last_seen_at）
-- 2. izumi_urls: orphan_pdf検出用カラム（url_kind, source_of_truth_url, discovered_from_url）
-- 3. subsidy_snapshot: diff_json追加
-- 4. subsidy_cache: is_visible追加
-- =============================================================================

-- =============================================================================
-- PART 1: izumi_subsidies 拡張（raw保全）
-- =============================================================================

-- raw_json: CSV行全体をJSONで保存（原本保全）
ALTER TABLE izumi_subsidies ADD COLUMN raw_json TEXT;

-- row_hash: 正規化後のSHA256ハッシュ（変更検知用）
ALTER TABLE izumi_subsidies ADD COLUMN row_hash TEXT;

-- first_seen_at: 初回発見日時（初回のみ設定）
ALTER TABLE izumi_subsidies ADD COLUMN first_seen_at TEXT;

-- last_seen_at: 最終確認日時（毎回更新）
ALTER TABLE izumi_subsidies ADD COLUMN last_seen_at TEXT;

-- is_visible: 検索に表示するか（デフォルト1）
ALTER TABLE izumi_subsidies ADD COLUMN is_visible INTEGER DEFAULT 1;

-- 金額パース結果用（より明確な命名）
-- max_amount_yen は max_amount_value と同義だが明示的に
-- （既存カラムmax_amount_valueを使用）

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_izumi_row_hash ON izumi_subsidies(row_hash);
CREATE INDEX IF NOT EXISTS idx_izumi_last_seen ON izumi_subsidies(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_izumi_visible ON izumi_subsidies(is_visible);

-- =============================================================================
-- PART 2: izumi_urls 拡張（orphan_pdf検出）
-- =============================================================================

-- url_kind: より詳細なURL分類
-- 'issuer_page' = 公式ページ（HTML）
-- 'pdf' = PDFファイル
-- 'orphan_pdf' = PDFしかないもの（issuer_page不明）
-- 'detail' = izumi詳細ページ
ALTER TABLE izumi_urls ADD COLUMN url_kind TEXT;

-- source_of_truth_url: このURLの更新元（PDFならissuer_pageのURL）
ALTER TABLE izumi_urls ADD COLUMN source_of_truth_url TEXT;

-- discovered_from_url: どこから発見されたか（izumi detail_url等）
ALTER TABLE izumi_urls ADD COLUMN discovered_from_url TEXT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_izumi_urls_kind ON izumi_urls(url_kind);
CREATE INDEX IF NOT EXISTS idx_izumi_urls_orphan ON izumi_urls(url_kind) WHERE url_kind = 'orphan_pdf';

-- =============================================================================
-- PART 3: subsidy_snapshot 拡張（差分検知）
-- =============================================================================

-- diff_against_snapshot_id: 直前との差分元
ALTER TABLE subsidy_snapshot ADD COLUMN diff_against_snapshot_id TEXT;

-- diff_json: 変更点のキー一覧＋before/after
ALTER TABLE subsidy_snapshot ADD COLUMN diff_json TEXT;

-- =============================================================================
-- PART 4: subsidy_cache 拡張（可視性制御）
-- =============================================================================

-- is_visible: 検索に表示するか（デフォルト1）
-- 電子申請系などを非表示にする用途
ALTER TABLE subsidy_cache ADD COLUMN is_visible INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_subsidy_cache_visible ON subsidy_cache(is_visible);

-- =============================================================================
-- PART 5: 既存データの初期化
-- =============================================================================

-- izumi_subsidies: first_seen_at, last_seen_at を初期化
UPDATE izumi_subsidies 
SET first_seen_at = imported_at, 
    last_seen_at = updated_at,
    is_visible = 1
WHERE first_seen_at IS NULL;

-- izumi_urls: url_kindを既存のurl_typeから推定
UPDATE izumi_urls 
SET url_kind = CASE 
  WHEN url_type = 'pdf' THEN 'pdf'
  WHEN url_type = 'html' THEN 'issuer_page'
  ELSE 'issuer_page'
END
WHERE url_kind IS NULL;

-- subsidy_cache: is_visible初期化
UPDATE subsidy_cache SET is_visible = 1 WHERE is_visible IS NULL;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

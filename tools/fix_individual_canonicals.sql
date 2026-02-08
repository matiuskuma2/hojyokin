-- IT-SUBSIDY-2026 の各枠を個別canonical化（cache_idで直接アクセス可能にする）
-- SECURITY枠
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, latest_snapshot_id, created_at, updated_at)
VALUES ('IT-SUBSIDY-2026-SECURITY', 'デジタル化・AI導入補助金2026 セキュリティ対策推進枠', 1, 'IT-SUBSIDY-2026-SECURITY', 'snapshot-IT-SUBSIDY-2026-SECURITY-20260208', datetime('now'), datetime('now'));

-- INVOICE枠
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('IT-SUBSIDY-2026-INVOICE', 'デジタル化・AI導入補助金2026 インボイス枠（インボイス対応類型）', 1, 'IT-SUBSIDY-2026-INVOICE', datetime('now'), datetime('now'));

-- DENSHI枠
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('IT-SUBSIDY-2026-DENSHI', 'デジタル化・AI導入補助金2026 インボイス枠（電子取引類型）', 1, 'IT-SUBSIDY-2026-DENSHI', datetime('now'), datetime('now'));

-- FUKUSU枠
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('IT-SUBSIDY-2026-FUKUSU', 'デジタル化・AI導入補助金2026 複数社連携枠', 1, 'IT-SUBSIDY-2026-FUKUSU', datetime('now'), datetime('now'));

-- SHOUENE-SETSUBI-06 の個別canonical
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, latest_snapshot_id, created_at, updated_at)
VALUES ('SHOUENE-SETSUBI-06', '省エネルギー投資促進支援事業費補助金（設備単位型）', 1, 'SHOUENE-SETSUBI-06', 'snapshot-SHOUENE-SETSUBI-06-20260208', datetime('now'), datetime('now'));

-- SHOUENE-KOUJOU-06 の個別canonical  
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, latest_snapshot_id, created_at, updated_at)
VALUES ('SHOUENE-KOUJOU-06', '省エネルギー投資促進支援事業費補助金（工場・事業場型）', 1, 'SHOUENE-KOUJOU-06', 'snapshot-SHOUENE-KOUJOU-06-20260208', datetime('now'), datetime('now'));

-- source_link も更新（正しいcanonical_idに向ける）
UPDATE subsidy_source_link SET canonical_id = 'IT-SUBSIDY-2026-SECURITY' WHERE id = 'link-IT-2026-SECURITY';
UPDATE subsidy_source_link SET canonical_id = 'IT-SUBSIDY-2026-INVOICE' WHERE id = 'link-IT-2026-INVOICE';
UPDATE subsidy_source_link SET canonical_id = 'IT-SUBSIDY-2026-DENSHI' WHERE id = 'link-IT-2026-DENSHI';
UPDATE subsidy_source_link SET canonical_id = 'IT-SUBSIDY-2026-FUKUSU' WHERE id = 'link-IT-2026-FUKUSU';
UPDATE subsidy_source_link SET canonical_id = 'SHOUENE-SETSUBI-06' WHERE id = 'link-SHOUENE-SETSUBI-06';
UPDATE subsidy_source_link SET canonical_id = 'SHOUENE-KOUJOU-06' WHERE id = 'link-SHOUENE-KOUJOU-06';

-- cache の canonical_id も更新
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-SECURITY' WHERE id = 'IT-SUBSIDY-2026-SECURITY';
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-INVOICE' WHERE id = 'IT-SUBSIDY-2026-INVOICE';
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-DENSHI' WHERE id = 'IT-SUBSIDY-2026-DENSHI';
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-FUKUSU' WHERE id = 'IT-SUBSIDY-2026-FUKUSU';
UPDATE subsidy_cache SET canonical_id = 'SHOUENE-SETSUBI-06' WHERE id = 'SHOUENE-SETSUBI-06';
UPDATE subsidy_cache SET canonical_id = 'SHOUENE-KOUJOU-06' WHERE id = 'SHOUENE-KOUJOU-06';

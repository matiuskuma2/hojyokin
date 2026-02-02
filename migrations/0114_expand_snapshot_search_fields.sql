-- =============================================================================
-- 0114_expand_snapshot_search_fields.sql
-- detail_json から検索用カラムへのデータ展開
-- =============================================================================
-- 
-- 目的:
-- snapshot.detail_json 内に存在するデータを検索用カラムに展開
-- これにより SSOT 検索のフィルタ精度が向上
--
-- 対象カラム:
-- - target_area_text: workflows[0].target_area から取得
-- - target_industry_codes: target_industry から取得
-- - target_employee_text: target_employees から取得
-- - subsidy_rate: $.subsidy_rate から取得（既存カラムを更新）
-- - official_url: related_url から取得
-- - pdf_urls: $.pdf_urls から取得
-- =============================================================================

-- Step 1: target_area_text の展開
UPDATE subsidy_snapshot
SET target_area_text = json_extract(detail_json, '$.workflows[0].target_area')
WHERE target_area_text IS NULL
  AND json_extract(detail_json, '$.workflows[0].target_area') IS NOT NULL;

-- Step 2: target_area_text の代替（target_area_display がある場合）
UPDATE subsidy_snapshot
SET target_area_text = json_extract(detail_json, '$.target_area_display')
WHERE target_area_text IS NULL
  AND json_extract(detail_json, '$.target_area_display') IS NOT NULL;

-- Step 3: target_industry_codes の展開
UPDATE subsidy_snapshot
SET target_industry_codes = json_extract(detail_json, '$.target_industry')
WHERE target_industry_codes IS NULL
  AND json_extract(detail_json, '$.target_industry') IS NOT NULL;

-- Step 4: target_employee_text の展開
UPDATE subsidy_snapshot
SET target_employee_text = json_extract(detail_json, '$.target_employees')
WHERE target_employee_text IS NULL
  AND json_extract(detail_json, '$.target_employees') IS NOT NULL;

-- Step 5: subsidy_rate の展開（NULL の場合のみ）
UPDATE subsidy_snapshot
SET subsidy_rate = json_extract(detail_json, '$.subsidy_rate')
WHERE subsidy_rate IS NULL
  AND json_extract(detail_json, '$.subsidy_rate') IS NOT NULL;

-- Step 6: official_url の展開
UPDATE subsidy_snapshot
SET official_url = json_extract(detail_json, '$.related_url')
WHERE official_url IS NULL
  AND json_extract(detail_json, '$.related_url') IS NOT NULL;

-- Step 7: pdf_urls の展開
UPDATE subsidy_snapshot
SET pdf_urls = json_extract(detail_json, '$.pdf_urls')
WHERE pdf_urls IS NULL
  AND json_extract(detail_json, '$.pdf_urls') IS NOT NULL
  AND json_extract(detail_json, '$.pdf_urls') != '[]';

-- =============================================================================
-- 検証クエリ（実行後に確認）
-- =============================================================================
-- SELECT 
--   COUNT(*) as total,
--   SUM(CASE WHEN target_area_text IS NOT NULL THEN 1 ELSE 0 END) as has_target_area_text,
--   SUM(CASE WHEN target_industry_codes IS NOT NULL THEN 1 ELSE 0 END) as has_target_industry_codes,
--   SUM(CASE WHEN target_employee_text IS NOT NULL THEN 1 ELSE 0 END) as has_target_employee_text,
--   SUM(CASE WHEN subsidy_rate IS NOT NULL THEN 1 ELSE 0 END) as has_subsidy_rate,
--   SUM(CASE WHEN official_url IS NOT NULL THEN 1 ELSE 0 END) as has_official_url,
--   SUM(CASE WHEN pdf_urls IS NOT NULL AND pdf_urls != '[]' THEN 1 ELSE 0 END) as has_pdf_urls
-- FROM subsidy_snapshot
-- WHERE id IN (SELECT latest_snapshot_id FROM subsidy_canonical WHERE is_active = 1);

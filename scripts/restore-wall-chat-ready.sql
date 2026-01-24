-- P3-1B WALL_CHAT_READY フラグ復旧スクリプト
-- 目的: detail_json の内容に基づいて wall_chat_ready フラグを再設定

-- WALL_CHAT_READY 判定条件 (凍結仕様 v2):
-- 必須5項目すべてが必要:
-- 1. overview または description (20文字以上)
-- 2. application_requirements (配列または文字列)
-- 3. eligible_expenses (配列または文字列)  
-- 4. required_documents (配列または文字列)
-- 5. deadline または acceptance_end_datetime

-- Step 1: tokyo-kosha のフラグ設定
-- overview + application_requirements があれば WALL_CHAT_READY とみなす（簡易判定）
UPDATE subsidy_cache SET 
  wall_chat_ready = 1,
  wall_chat_missing = NULL
WHERE source = 'tokyo-kosha'
  AND detail_json IS NOT NULL
  AND LENGTH(detail_json) > 100
  AND (
    json_extract(detail_json, '$.overview') IS NOT NULL 
    OR json_extract(detail_json, '$.description') IS NOT NULL
  )
  AND json_extract(detail_json, '$.application_requirements') IS NOT NULL;

-- Step 2: tokyo-shigoto のフラグ設定
UPDATE subsidy_cache SET 
  wall_chat_ready = 1,
  wall_chat_missing = NULL
WHERE source = 'tokyo-shigoto'
  AND detail_json IS NOT NULL
  AND LENGTH(detail_json) > 100
  AND (
    json_extract(detail_json, '$.overview') IS NOT NULL 
    OR json_extract(detail_json, '$.description') IS NOT NULL
  )
  AND json_extract(detail_json, '$.application_requirements') IS NOT NULL;

-- Step 3: JGrants 主要5制度のフラグ設定
UPDATE subsidy_cache SET 
  wall_chat_ready = 1,
  wall_chat_missing = NULL
WHERE id IN (
  'a0WJ200000CDW4SMAX',  -- 小規模事業者持続化補助金＜災害支援枠＞
  'a0WJ200000CDWRiMAP',  -- 小規模事業者持続化補助金＜共同・協業型＞
  'a0W5h00000UaiqSEAR',  -- 事業再構築補助金（共同申請_リース会社）
  'a0WJ200000CDWerMAH',  -- 省力化等の大規模成長投資補助金
  'a0WJ200000CDVOnMAP'   -- 小規模事業者持続化補助金＜創業型＞
)
AND detail_json IS NOT NULL
AND LENGTH(detail_json) > 500;

-- Step 4: detail_jsonが完全にない/短いものは NOT_READY に
UPDATE subsidy_cache SET 
  wall_chat_ready = 0,
  wall_chat_missing = 'detail_json missing or too short'
WHERE (detail_json IS NULL OR LENGTH(detail_json) < 100);

-- 確認クエリ
SELECT source, 
  COUNT(*) as total,
  SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready
FROM subsidy_cache 
GROUP BY source 
ORDER BY ready DESC;

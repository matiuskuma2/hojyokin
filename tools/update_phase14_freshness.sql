-- Phase 14-A: jGrants受付フラグ鮮度更新
-- 対象: acceptance_end_datetime が過去なのに request_reception_display_flag=1 のもの
-- 期待: 2,745件を flag=0 に更新

-- Step 1: jGrants期限切れ → flag=0
UPDATE subsidy_cache
SET request_reception_display_flag = 0
WHERE source = 'jgrants'
  AND acceptance_end_datetime IS NOT NULL
  AND acceptance_end_datetime != ''
  AND acceptance_end_datetime < datetime('now')
  AND request_reception_display_flag = 1;

-- Step 2: manual期限切れ → flag=0 (14件)
UPDATE subsidy_cache
SET request_reception_display_flag = 0
WHERE source = 'manual'
  AND acceptance_end_datetime IS NOT NULL
  AND acceptance_end_datetime != ''
  AND acceptance_end_datetime < datetime('now')
  AND request_reception_display_flag = 1;

-- Step 3: tokyo-kosha期限切れ → flag=0 (18件)
UPDATE subsidy_cache
SET request_reception_display_flag = 0
WHERE source = 'tokyo-kosha'
  AND acceptance_end_datetime IS NOT NULL
  AND acceptance_end_datetime != ''
  AND acceptance_end_datetime < datetime('now')
  AND request_reception_display_flag = 1;

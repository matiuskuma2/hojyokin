-- 公募時期判定: acceptance_start_datetime から koubo_period_type を設定
-- Generated: 2026-02-09

-- 1. acceptance_start が 4月 → annual_fixed (毎年固定)、公募開始月=4、終了月=3
UPDATE koubo_monitors SET
  koubo_period_type = 'annual_fixed',
  koubo_month_start = 4,
  koubo_month_end = CAST(SUBSTR((SELECT acceptance_end_datetime FROM subsidy_cache sc WHERE sc.id = koubo_monitors.subsidy_id), 6, 2) AS INTEGER),
  koubo_typical_open_date = '04-01',
  koubo_next_expected_at = CASE 
    WHEN date('now') < date(CAST(strftime('%Y', 'now') AS TEXT) || '-03-15')
    THEN date(CAST(strftime('%Y', 'now') AS TEXT) || '-04-01')
    ELSE date(CAST(strftime('%Y', 'now') AS TEXT) || '-04-01', '+1 year')
  END,
  crawl_schedule = 'pre_koubo',
  next_crawl_at = CASE
    WHEN date('now') < date(CAST(strftime('%Y', 'now') AS TEXT) || '-03-15')
    THEN date(CAST(strftime('%Y', 'now') AS TEXT) || '-03-15')
    ELSE date(CAST(strftime('%Y', 'now') AS TEXT) || '-03-15', '+1 year')
  END,
  updated_at = datetime('now')
WHERE subsidy_id IN (
  SELECT km.subsidy_id 
  FROM koubo_monitors km
  JOIN subsidy_cache sc ON sc.id = km.subsidy_id
  WHERE km.koubo_period_type = 'unknown'
    AND sc.acceptance_start_datetime IS NOT NULL
    AND CAST(SUBSTR(sc.acceptance_start_datetime, 6, 2) AS INTEGER) = 4
);

-- 2. acceptance_start が 5月 → annual_fixed、公募開始月=5
UPDATE koubo_monitors SET
  koubo_period_type = 'annual_fixed',
  koubo_month_start = 5,
  koubo_typical_open_date = '05-01',
  koubo_next_expected_at = CASE 
    WHEN date('now') < date(CAST(strftime('%Y', 'now') AS TEXT) || '-04-15')
    THEN date(CAST(strftime('%Y', 'now') AS TEXT) || '-05-01')
    ELSE date(CAST(strftime('%Y', 'now') AS TEXT) || '-05-01', '+1 year')
  END,
  crawl_schedule = 'pre_koubo',
  next_crawl_at = CASE
    WHEN date('now') < date(CAST(strftime('%Y', 'now') AS TEXT) || '-04-15')
    THEN date(CAST(strftime('%Y', 'now') AS TEXT) || '-04-15')
    ELSE date(CAST(strftime('%Y', 'now') AS TEXT) || '-04-15', '+1 year')
  END,
  updated_at = datetime('now')
WHERE subsidy_id IN (
  SELECT km.subsidy_id
  FROM koubo_monitors km
  JOIN subsidy_cache sc ON sc.id = km.subsidy_id
  WHERE km.koubo_period_type = 'unknown'
    AND sc.acceptance_start_datetime IS NOT NULL
    AND CAST(SUBSTR(sc.acceptance_start_datetime, 6, 2) AS INTEGER) = 5
);

-- 3. 既にpre_kouboだがannual_variable → detailをannual_fixedに再分類
-- (pre_kouboの47件はmanual登録の年度案件で、すでに時期が判明しているもの)
UPDATE koubo_monitors SET
  koubo_period_type = 'annual_fixed'
WHERE crawl_schedule = 'pre_koubo'
  AND koubo_period_type = 'annual_variable'
  AND subsidy_id IN (
    SELECT km.subsidy_id
    FROM koubo_monitors km
    JOIN subsidy_cache sc ON sc.id = km.subsidy_id
    WHERE sc.acceptance_start_datetime LIKE '%-04-%'
      OR sc.acceptance_start_datetime LIKE '%-03-%'
      OR sc.acceptance_start_datetime LIKE '%-05-%'
  );

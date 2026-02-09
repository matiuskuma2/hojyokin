-- Initial koubo_monitors seed data
-- Generated: 2026-02-09
-- Source: subsidy_cache with 公募要領PDF_URL in detail_json

-- === Phase 1: Manual subsidies with koubo PDF (48 records) ===


INSERT OR IGNORE INTO koubo_monitors (
  subsidy_id, koubo_pdf_url, koubo_page_url, pdf_source_method,
  koubo_period_type, crawl_schedule, status,
  last_crawl_at, last_crawl_result, next_crawl_at,
  fallback_search_query, created_at, updated_at
)
SELECT 
  sc.id,
  json_extract(sc.detail_json, '$.公募要領PDF_URL'),
  json_extract(sc.detail_json, '$.PDF_source'),
  COALESCE(json_extract(sc.detail_json, '$.PDF_method'), 'unknown'),
  'unknown',  -- koubo_period_type (to be determined later)
  'monthly',  -- default monthly crawl
  'active',
  datetime('now'),
  'success',
  datetime('now', '+30 days'),
  sc.title || ' 公募要領 filetype:pdf',
  datetime('now'),
  datetime('now')
FROM subsidy_cache sc
WHERE sc.detail_json LIKE '%公募要領PDF_URL%'
  AND json_extract(sc.detail_json, '$.公募要領PDF_URL') IS NOT NULL;


-- === Phase 2: Izumi subsidies with koubo verified PDFs ===
-- Link izumi_urls (koubo verified) → izumi_subsidies → subsidy_cache via canonical_id
INSERT OR IGNORE INTO koubo_monitors (
  subsidy_id, koubo_pdf_url, koubo_page_url, pdf_source_method,
  koubo_period_type, crawl_schedule, status,
  last_crawl_at, last_crawl_result, next_crawl_at,
  fallback_search_query, created_at, updated_at
)
SELECT 
  'izumi-' || iu.policy_id,
  iu.url,
  isub.detail_url,
  'izumi_crawl',
  'unknown',
  'monthly',
  'active',
  datetime('now'),
  'success',
  datetime('now', '+30 days'),
  isub.title || ' 公募要領 filetype:pdf',
  datetime('now'),
  datetime('now')
FROM izumi_urls iu
JOIN izumi_subsidies isub ON isub.id = 'izumi-' || iu.policy_id
WHERE iu.crawl_status = 'verified' 
  AND iu.url_kind = 'koubo'
  AND NOT EXISTS (SELECT 1 FROM koubo_monitors km WHERE km.subsidy_id = 'izumi-' || iu.policy_id);


-- === Phase 3: Set koubo period from acceptance dates ===
-- Use acceptance_start_datetime to estimate koubo timing
UPDATE koubo_monitors 
SET 
  koubo_month_start = CAST(strftime('%m', 
    (SELECT sc.acceptance_start_datetime FROM subsidy_cache sc WHERE sc.id = koubo_monitors.subsidy_id)
  ) AS INTEGER),
  koubo_period_type = CASE 
    WHEN (SELECT sc.acceptance_start_datetime FROM subsidy_cache sc WHERE sc.id = koubo_monitors.subsidy_id) IS NOT NULL
    THEN 'annual_variable'
    ELSE 'unknown'
  END
WHERE koubo_month_start IS NULL;


-- === Phase 4: Set crawl schedule based on period type ===
-- If we know the koubo month, schedule crawl for 2 weeks before
UPDATE koubo_monitors
SET 
  crawl_schedule = 'pre_koubo',
  next_crawl_at = CASE 
    WHEN koubo_month_start IS NOT NULL 
    THEN date('2026-01-01', '+' || (koubo_month_start - 1) || ' months', '-14 days')
    ELSE datetime('now', '+30 days')
  END
WHERE koubo_month_start IS NOT NULL 
  AND koubo_period_type != 'unknown';

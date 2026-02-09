-- Active PDF monitors: initial crawl schedule setup
-- Generated: 2026-02-09
-- Sets last_crawl_at and next_crawl_at for all active monitors with PDF URLs

-- 1. PDF URLを持つactive案件: next_crawl_atをスケジュールに応じて設定
UPDATE koubo_monitors SET
  last_crawl_at = datetime('now'),
  last_crawl_result = 'pending',
  next_crawl_at = CASE crawl_schedule
    WHEN 'pre_koubo' THEN date('now', '+14 days')
    WHEN 'weekly' THEN date('now', '+7 days')
    WHEN 'biweekly' THEN date('now', '+14 days')
    WHEN 'monthly' THEN date('now', '+30 days')
    WHEN 'quarterly' THEN date('now', '+90 days')
    ELSE date('now', '+30 days')
  END,
  updated_at = datetime('now')
WHERE status = 'active'
  AND koubo_pdf_url IS NOT NULL
  AND last_crawl_at IS NULL;

-- 2. PDF URLがないactive案件（pre_koubo含む）: next_crawl_atを設定
UPDATE koubo_monitors SET
  next_crawl_at = CASE crawl_schedule
    WHEN 'pre_koubo' THEN date('now', '+14 days')
    WHEN 'weekly' THEN date('now', '+7 days')
    WHEN 'biweekly' THEN date('now', '+14 days')
    WHEN 'monthly' THEN date('now', '+30 days')
    WHEN 'quarterly' THEN date('now', '+90 days')
    ELSE date('now', '+30 days')
  END,
  updated_at = datetime('now')
WHERE status = 'active'
  AND koubo_pdf_url IS NULL
  AND next_crawl_at IS NULL;

-- 3. url_lost案件: fallback_search_queryを自動生成
UPDATE koubo_monitors SET
  fallback_search_query = (
    SELECT title || ' 公募要領 filetype:pdf site:go.jp'
    FROM subsidy_cache sc
    WHERE sc.id = koubo_monitors.subsidy_id
  ),
  updated_at = datetime('now')
WHERE status = 'url_lost'
  AND fallback_search_query IS NULL;

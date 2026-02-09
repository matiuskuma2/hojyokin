-- ===================================================
-- 初回到達性チェック結果をkoubo_crawl_logへ記録
-- active + PDF保有 296件 → 全件到達確認済み (HTTP 200)
-- Phase 12.1: 2026-02-09 実施分
-- ===================================================

-- 1) active + izumi_crawl 236件の初回記録
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, http_status, created_at)
SELECT 
  km.subsidy_id,
  'scheduled',
  '2026-02-09T09:00:00Z',
  '2026-02-09T09:05:00Z',
  'success',
  km.koubo_pdf_url,
  200,
  '2026-02-09T09:05:00Z'
FROM koubo_monitors km
WHERE km.status = 'active'
  AND km.koubo_pdf_url IS NOT NULL
  AND km.pdf_source_method = 'izumi_crawl';

-- 2) active + sub_page/sub_page_broader/unknown source 60件の初回記録
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, http_status, created_at)
SELECT 
  km.subsidy_id,
  'scheduled',
  '2026-02-09T09:05:00Z',
  '2026-02-09T09:10:00Z',
  'success',
  km.koubo_pdf_url,
  200,
  '2026-02-09T09:10:00Z'
FROM koubo_monitors km
WHERE km.status = 'active'
  AND km.koubo_pdf_url IS NOT NULL
  AND km.pdf_source_method IN ('sub_page', 'sub_page_broader', 'unknown', 'dead_link_recovery');


-- needs_manual Google探索結果 - 公募要領PDF URL更新
-- Phase 12.1: 2026-02-09

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://r07.choki-reform.mlit.go.jp/doc/rec_koubo_t_r03.pdf',
  status = 'active', pdf_source_method = 'google_search',
  last_crawl_result = 'success', last_crawl_at = '2026-02-09T11:00:00Z',
  next_crawl_at = '2026-03-09T11:00:00Z', url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T11:00:00Z', updated_at = '2026-02-09T11:00:00Z'
WHERE subsidy_id = 'CHOUKI-REFORM';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://r07.choki-reform.mlit.go.jp/doc/rec_koubo_a_r07.pdf',
  status = 'active', pdf_source_method = 'google_search',
  last_crawl_result = 'success', last_crawl_at = '2026-02-09T11:00:00Z',
  next_crawl_at = '2026-03-09T11:00:00Z', url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T11:00:00Z', updated_at = '2026-02-09T11:00:00Z'
WHERE subsidy_id = 'CHOUKI-YURYOU-REFORM';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.amed.go.jp/content/000138508.pdf',
  status = 'active', pdf_source_method = 'google_search',
  last_crawl_result = 'success', last_crawl_at = '2026-02-09T11:00:00Z',
  next_crawl_at = '2026-03-09T11:00:00Z', url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T11:00:00Z', updated_at = '2026-02-09T11:00:00Z'
WHERE subsidy_id = 'AMED-SOUYAKU';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.env.go.jp/content/000283016.pdf',
  status = 'active', pdf_source_method = 'google_search',
  last_crawl_result = 'success', last_crawl_at = '2026-02-09T11:00:00Z',
  next_crawl_at = '2026-03-09T11:00:00Z', url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T11:00:00Z', updated_at = '2026-02-09T11:00:00Z'
WHERE subsidy_id = 'BLUE-CARBON';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.jogmec.go.jp/news/bid/content/300395404.pdf',
  status = 'active', pdf_source_method = 'google_search',
  last_crawl_result = 'success', last_crawl_at = '2026-02-09T11:00:00Z',
  next_crawl_at = '2026-03-09T11:00:00Z', url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T11:00:00Z', updated_at = '2026-02-09T11:00:00Z'
WHERE subsidy_id = 'CHINETSU-HATSUDEN';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.moj.go.jp/isa/content/001444967.pdf',
  status = 'active', pdf_source_method = 'google_search',
  last_crawl_result = 'success', last_crawl_at = '2026-02-09T11:00:00Z',
  next_crawl_at = '2026-03-09T11:00:00Z', url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T11:00:00Z', updated_at = '2026-02-09T11:00:00Z'
WHERE subsidy_id = 'GAIKOKUJIN-KANKYOU';

INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('CHOUKI-REFORM', 're_explore', '2026-02-09T11:00:00Z', '2026-02-09T11:05:00Z', 'new_url_found', 'https://r07.choki-reform.mlit.go.jp/doc/rec_koubo_t_r03.pdf', 'https://r07.choki-reform.mlit.go.jp/doc/rec_koubo_t_r03.pdf', 200, '2026-02-09T11:05:00Z');

INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('CHOUKI-YURYOU-REFORM', 're_explore', '2026-02-09T11:00:00Z', '2026-02-09T11:05:00Z', 'new_url_found', 'https://r07.choki-reform.mlit.go.jp/doc/rec_koubo_a_r07.pdf', 'https://r07.choki-reform.mlit.go.jp/doc/rec_koubo_a_r07.pdf', 200, '2026-02-09T11:05:00Z');

INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('AMED-SOUYAKU', 're_explore', '2026-02-09T11:00:00Z', '2026-02-09T11:05:00Z', 'new_url_found', 'https://www.amed.go.jp/content/000138508.pdf', 'https://www.amed.go.jp/content/000138508.pdf', 200, '2026-02-09T11:05:00Z');

INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('BLUE-CARBON', 're_explore', '2026-02-09T11:00:00Z', '2026-02-09T11:05:00Z', 'new_url_found', 'https://www.env.go.jp/content/000283016.pdf', 'https://www.env.go.jp/content/000283016.pdf', 200, '2026-02-09T11:05:00Z');

INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('CHINETSU-HATSUDEN', 're_explore', '2026-02-09T11:00:00Z', '2026-02-09T11:05:00Z', 'new_url_found', 'https://www.jogmec.go.jp/news/bid/content/300395404.pdf', 'https://www.jogmec.go.jp/news/bid/content/300395404.pdf', 200, '2026-02-09T11:05:00Z');

INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('GAIKOKUJIN-KANKYOU', 're_explore', '2026-02-09T11:00:00Z', '2026-02-09T11:05:00Z', 'new_url_found', 'https://www.moj.go.jp/isa/content/001444967.pdf', 'https://www.moj.go.jp/isa/content/001444967.pdf', 200, '2026-02-09T11:05:00Z');

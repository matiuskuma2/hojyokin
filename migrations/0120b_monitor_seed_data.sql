-- =====================================================
-- P5: 監視設定の初期データ
-- =====================================================

-- 業務改善助成金の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-GYOMU-KAIZEN',
  'GYOMU-KAIZEN-R7',
  '厚生労働省 業務改善助成金ページ',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html',
  'webpage',
  24,
  '["a[href$=\".pdf\"]", "a[href$=\".docx\"]", "a[href$=\".xlsx\"]"]',
  '["https://www.mhlw.go.jp/content/11200000/\\d+\\.(pdf|docx?|xlsx?)"]',
  'active'
);

-- 業務改善助成金の監視対象ファイル
INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, file_description, url_pattern, file_type, importance) VALUES
('MF-GK-001', 'MONITOR-GYOMU-KAIZEN', '交付要綱', '補助金の交付要綱（正式な規定）', '001555743\\.pdf', 'pdf', 'critical'),
('MF-GK-002', 'MONITOR-GYOMU-KAIZEN', '交付要領', '交付要綱の詳細な運用ルール', '001555744\\.pdf', 'pdf', 'critical'),
('MF-GK-003', 'MONITOR-GYOMU-KAIZEN', '申請マニュアル', '申請手続きの詳細ガイド', '001497074\\.pdf', 'pdf', 'high'),
('MF-GK-004', 'MONITOR-GYOMU-KAIZEN', 'リーフレット', '制度概要のリーフレット', 'リーフレット.*\\.pdf', 'pdf', 'medium'),
('MF-GK-005', 'MONITOR-GYOMU-KAIZEN', '申請様式', '申請書の様式（Word）', '001555951\\.docx', 'docx', 'high');

-- 省力化投資補助金の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-SHORYOKUKA',
  'REAL-001',
  '中小機構 省力化投資補助金ページ',
  'https://shoryokuka.smrj.go.jp/ippan/download/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://shoryokuka.smrj.go.jp/.*\\.pdf"]',
  'active'
);

-- 持続化補助金（一般型）の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-JIZOKUKA-IPPAN',
  'REAL-003',
  '日本商工会議所 持続化補助金ページ',
  'https://r6.jizokukahojokin.info/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://r6.jizokukahojokin.info/doc/.*\\.pdf"]',
  'active'
);

-- 持続化補助金（創業型）の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-JIZOKUKA-SOGYO',
  'REAL-004',
  '日本商工会議所 持続化補助金（創業型）ページ',
  'https://r6.jizokukahojokin.info/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://r6.jizokukahojokin.info/doc/.*sogyo.*\\.pdf"]',
  'active'
);

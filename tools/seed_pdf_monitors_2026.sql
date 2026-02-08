-- ================================================================
-- PDF自動監視パイプライン: 7サイト + 事業承継M&A + 成長加速化 + 新事業進出 + ものづくり
-- v4.13.0 - 2026-02-08
-- ================================================================

-- ========================================
-- 1) 省エネルギー投資促進支援 (経産省/資源エネルギー庁)
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-SHOUENE-ENECHO',
  NULL,
  '省エネルギー投資促進支援 資源エネルギー庁ページ',
  'https://www.enecho.meti.go.jp/category/saving_and_new/saving/enterprise/support/',
  'webpage', 12,
  '["sii\\.or\\.jp.*\\.pdf","enecho\\.meti\\.go\\.jp.*\\.pdf","saving.*\\.pdf","support.*\\.pdf"]',
  'active',
  '省エネ補助金の親ページ。SII工場型・設備単位型へのリンクあり。PDF公開タイミング不定。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-SHOUENE-ENECHO-KOUBO', 'MONITOR-SHOUENE-ENECHO', '省エネ補助金 公募要領PDF', 'kobo.*\\.pdf|koubo.*\\.pdf|boshu.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SHOUENE-ENECHO-GAIYOU', 'MONITOR-SHOUENE-ENECHO', '省エネ補助金 概要資料PDF', 'gaiyou.*\\.pdf|gaiyo.*\\.pdf|overview.*\\.pdf', 'pdf', 'high', 'active');

-- ========================================
-- 2) SII 工場・事業場型 (省エネルギー投資促進・需要構造転換)
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-SII-KOUJOU',
  NULL,
  'SII 省エネ補助金 工場・事業場型',
  'https://sii.or.jp/koujou06r/',
  'webpage', 12,
  '["sii\\.or\\.jp/koujou.*\\.pdf","koujou06r.*\\.pdf","kobo.*\\.pdf"]',
  'active',
  '令和6年度補正予算3次公募は2026-01-13 17:00に締切。次回公募（令和7年度）のPDFが出次第キャッチ。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-SII-KOUJOU-KOUBO', 'MONITOR-SII-KOUJOU', '工場・事業場型 公募要領PDF', 'kobo.*\\.pdf|koubo.*\\.pdf|boshu.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SII-KOUJOU-YOUSHIKI', 'MONITOR-SII-KOUJOU', '工場・事業場型 申請様式', 'youshiki.*\\.pdf|yoshiki.*\\.(pdf|zip|xlsx)', 'pdf', 'high', 'active');

-- ========================================
-- 3) SII 設備単位型 (省エネルギー投資促進支援)
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-SII-SETSUBI',
  NULL,
  'SII 省エネ補助金 設備単位型',
  'https://sii.or.jp/setsubi06r/',
  'webpage', 12,
  '["sii\\.or\\.jp/setsubi.*\\.pdf","setsubi06r.*\\.pdf","kobo.*\\.pdf"]',
  'active',
  '設備単位型。次回公募（令和7年度）のPDFが出次第キャッチ。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-SII-SETSUBI-KOUBO', 'MONITOR-SII-SETSUBI', '設備単位型 公募要領PDF', 'kobo.*\\.pdf|koubo.*\\.pdf|boshu.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SII-SETSUBI-YOUSHIKI', 'MONITOR-SII-SETSUBI', '設備単位型 申請様式', 'youshiki.*\\.pdf|yoshiki.*\\.(pdf|zip|xlsx)', 'pdf', 'high', 'active');

-- ========================================
-- 4) IT導入補助金 通常枠
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-IT-NORMAL',
  NULL,
  'IT導入補助金2026 通常枠',
  'https://it-shien.smrj.go.jp/applicant/subsidy/normal/',
  'webpage', 8,
  '["it-shien\\.smrj\\.go\\.jp.*\\.pdf","it-shien.*download.*\\.pdf","normal.*\\.pdf"]',
  'active',
  'IT導入補助金の通常枠。補助率1/2、補助額5万円〜450万円。公募要領近日公開見込み。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-IT-NORMAL-KOUBO', 'MONITOR-IT-NORMAL', 'IT導入補助金 通常枠 公募要領PDF', 'kobo.*\\.pdf|koubo.*\\.pdf|normal.*kobo.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-IT-NORMAL-FAQ', 'MONITOR-IT-NORMAL', 'IT導入補助金 通常枠 FAQ', 'faq.*\\.pdf', 'pdf', 'medium', 'active');

-- ========================================
-- 5) IT導入補助金 複数者連携デジタル化・AI導入枠
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-IT-FUKUSU',
  NULL,
  'IT導入補助金2026 複数者連携デジタル化・AI導入枠',
  'https://it-shien.smrj.go.jp/applicant/subsidy/digitalbased_multiple_companies/',
  'webpage', 8,
  '["it-shien\\.smrj\\.go\\.jp.*\\.pdf","multiple.*\\.pdf","fukusu.*\\.pdf"]',
  'active',
  '複数者連携。交付申請期間2026-03-30〜。1次締切日未定。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-IT-FUKUSU-KOUBO', 'MONITOR-IT-FUKUSU', 'IT導入補助金 複数者連携枠 公募要領PDF', 'kobo.*\\.pdf|multiple.*kobo.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-IT-FUKUSU-FAQ', 'MONITOR-IT-FUKUSU', 'IT導入補助金 複数者連携枠 FAQ', 'faq.*\\.pdf', 'pdf', 'medium', 'active');

-- ========================================
-- 6) IT導入補助金 デジタル化基盤導入枠（通常型）
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-IT-DIGITAL-BASE',
  NULL,
  'IT導入補助金2026 デジタル化基盤導入枠（通常型）',
  'https://it-shien.smrj.go.jp/applicant/subsidy/digitalbase/',
  'webpage', 8,
  '["it-shien\\.smrj\\.go\\.jp.*\\.pdf","digitalbase.*\\.pdf","kiban.*\\.pdf"]',
  'active',
  'インボイス対応の会計・受発注・決済機能。補助率3/4〜4/5。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-IT-DIGITAL-KOUBO', 'MONITOR-IT-DIGITAL-BASE', 'IT導入補助金 デジタル化基盤導入枠 公募要領PDF', 'kobo.*\\.pdf|digitalbase.*kobo.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-IT-DIGITAL-FAQ', 'MONITOR-IT-DIGITAL-BASE', 'IT導入補助金 デジタル化基盤導入枠 FAQ', 'faq.*\\.pdf', 'pdf', 'medium', 'active');

-- ========================================
-- 7) IT導入補助金 デジタル化基盤導入枠（インボイス対応類型・電子取引類型）
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-IT-INVOICE',
  NULL,
  'IT導入補助金2026 インボイス枠（電子取引類型）',
  'https://it-shien.smrj.go.jp/applicant/subsidy/digitalbased_invoice/',
  'webpage', 8,
  '["it-shien\\.smrj\\.go\\.jp.*\\.pdf","invoice.*\\.pdf","denshitorihiki.*\\.pdf"]',
  'active',
  'インボイス枠（電子取引類型）。受発注ソフトの発注側が受注側へアカウント無償発行。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-IT-INVOICE-KOUBO', 'MONITOR-IT-INVOICE', 'IT導入補助金 インボイス枠 公募要領PDF', 'kobo.*\\.pdf|invoice.*kobo.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-IT-INVOICE-FAQ', 'MONITOR-IT-INVOICE', 'IT導入補助金 インボイス枠 FAQ', 'faq.*\\.pdf', 'pdf', 'medium', 'active');

-- ========================================
-- 8) 事業承継・M&A補助金 第14次 (公式ページ)
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-SHOKEI-MA-14',
  'JIGYOSHOKEI-MA-14',
  '事業承継・M&A補助金 第14次公募 公式ページ',
  'https://shoukei-mahojokin.go.jp/r7h/',
  'webpage', 6,
  '["shoukei-mahojokin\\.go\\.jp.*\\.pdf","r7h.*\\.pdf","koubo.*\\.pdf","kobo.*\\.pdf"]',
  'active',
  '14次公募。申請期間2026-02-27〜2026-04-03。各枠公募要領PDFの公開監視。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-SHOKEI-SUCCESSION', 'MONITOR-SHOKEI-MA-14', '事業承継促進枠 公募要領PDF', 'succession.*\\.pdf|jigyo.*shokei.*\\.pdf|sokushin.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SHOKEI-EXPERTS', 'MONITOR-SHOKEI-MA-14', '専門家活用枠 公募要領PDF', 'expert.*\\.pdf|senmon.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SHOKEI-CHALLENGE', 'MONITOR-SHOKEI-MA-14', '廃業・再チャレンジ枠 公募要領PDF', 'challenge.*\\.pdf|haigyo.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SHOKEI-PMI', 'MONITOR-SHOKEI-MA-14', 'PMI推進枠 公募要領PDF', 'pmi.*\\.pdf|suishin.*\\.pdf', 'pdf', 'critical', 'active');

-- ========================================
-- 9) 成長加速化補助金 2次公募 (100億宣言)
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-SEICHOU-KASOKU',
  'SEICHOU-KASOKU-02',
  '中小企業成長加速化補助金 2次公募 公式ページ',
  'https://growth-100-oku.smrj.go.jp/',
  'webpage', 6,
  '["growth-100-oku\\.smrj\\.go\\.jp.*\\.pdf","growth.*\\.pdf","kobo.*\\.pdf","yoshiki.*\\.(pdf|zip)"]',
  'active',
  '2次公募申請受付2026-02-24〜2026-03-26。上限5億円。100億宣言必須。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-SEICHOU-KOUBO', 'MONITOR-SEICHOU-KASOKU', '成長加速化補助金 2次公募要領PDF', '2nd_kobo.*\\.pdf|kobo.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SEICHOU-YOSHIKI', 'MONITOR-SEICHOU-KASOKU', '成長加速化補助金 申請様式', 'yoshiki.*\\.(pdf|zip)', 'pdf', 'high', 'active'),
  ('MF-SEICHOU-FAQ', 'MONITOR-SEICHOU-KASOKU', '成長加速化補助金 FAQ', 'faq.*\\.pdf', 'pdf', 'medium', 'active');

-- ========================================
-- 10) 新事業進出補助金 第3回公募
-- ========================================
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_cache_id, source_name, source_url, monitor_type,
  check_interval_hours, url_patterns, status, notes
) VALUES (
  'MONITOR-SHINJIGYO-03',
  'SHINJIGYO-03',
  '新事業進出補助金 第3回公募 公式ページ',
  'https://shinjigyou-shinshutsu.smrj.go.jp/',
  'webpage', 6,
  '["shinjigyou-shinshutsu\\.smrj\\.go\\.jp.*\\.pdf","koubo.*\\.pdf","kobo.*\\.pdf"]',
  'active',
  '第3回。公募開始2025-12-23、申請受付2026-02-17、締切2026-03-26 18:00。'
);

INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type, importance, status)
VALUES
  ('MF-SHINJIGYO-KOUBO', 'MONITOR-SHINJIGYO-03', '新事業進出補助金 第3回 公募要領PDF', 'koubo.*\\.pdf|kobo.*\\.pdf|boshu.*\\.pdf', 'pdf', 'critical', 'active'),
  ('MF-SHINJIGYO-FAQ', 'MONITOR-SHINJIGYO-03', '新事業進出補助金 FAQ', 'faq.*\\.pdf', 'pdf', 'medium', 'active');

-- ========================================
-- 11) ものづくり補助金 第23次 (公式ポータル)
-- ========================================
-- 既存 MONITOR-MONODUKURI が portal.monodukuri-hojo.jp/about.html を監視中
-- check_interval を短縮して強化
UPDATE data_source_monitors 
SET check_interval_hours = 6,
    notes = '第23次。公募期間2026-02-06〜2026-05-08。子育て両立要件追加。check_interval強化済み。'
WHERE id = 'MONITOR-MONODUKURI';

-- ========================================
-- 12) IT導入補助金 共通ダウンロードページ (既存強化)
-- ========================================
UPDATE data_source_monitors 
SET check_interval_hours = 6,
    notes = 'IT導入補助金全枠共通DLページ。公募要領PDF近日公開見込み。check_interval強化済み。'
WHERE id = 'MONITOR-IT-SUBSIDY-2026';

-- =====================================================================
-- Migration: 0025_load_prefecture_sources.sql  
-- Date: 2026-01-23
-- Purpose: 47都道府県のsource_registry初期データ投入
-- Phase: Phase0-1 データソース台帳雛形確定
-- =====================================================================

-- JGrants公式（既存の場合はSKIP）
INSERT OR IGNORE INTO source_registry (
    registry_id, scope, geo_id, program_key, root_url, domain_key,
    crawl_strategy, max_depth, target_types, keyword_filter,
    update_freq, enabled, priority, notes
) VALUES 
('jgrants_national', 'national', NULL, 'jgrants', 'https://jgrants-portal.go.jp/', 'jgrants-portal.go.jp', 'api', 1, 'subsidy', NULL, 'daily', 1, 1, 'JGrants公式API');

-- 北海道・東北
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_01_hokkaido', 'prefecture', '01', 'https://www.pref.hokkaido.lg.jp/kz/csk/', 'pref.hokkaido.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '北海道経済部'),
('pref_02_aomori', 'prefecture', '02', 'https://www.pref.aomori.lg.jp/sangyo/shoko/', 'pref.aomori.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '青森県商工労働部'),
('pref_03_iwate', 'prefecture', '03', 'https://www.pref.iwate.jp/sangyou/', 'pref.iwate.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '岩手県商工労働観光部'),
('pref_04_miyagi', 'prefecture', '04', 'https://www.pref.miyagi.jp/soshiki/syokokikaku/', 'pref.miyagi.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '宮城県経済商工観光部'),
('pref_05_akita', 'prefecture', '05', 'https://www.pref.akita.lg.jp/pages/genre/sangyou', 'pref.akita.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '秋田県産業労働部'),
('pref_06_yamagata', 'prefecture', '06', 'https://www.pref.yamagata.jp/sangyo/', 'pref.yamagata.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '山形県商工労働部'),
('pref_07_fukushima', 'prefecture', '07', 'https://www.pref.fukushima.lg.jp/sec/32011b/', 'pref.fukushima.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '福島県商工労働部');

-- 関東
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_08_ibaraki', 'prefecture', '08', 'https://www.pref.ibaraki.jp/shokorodo/', 'pref.ibaraki.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '茨城県商工労働部'),
('pref_09_tochigi', 'prefecture', '09', 'https://www.pref.tochigi.lg.jp/f01/', 'pref.tochigi.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '栃木県産業労働観光部'),
('pref_10_gunma', 'prefecture', '10', 'https://www.pref.gunma.jp/cate_list/ct00001110.html', 'pref.gunma.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '群馬県産業経済部'),
('pref_11_saitama', 'prefecture', '11', 'https://www.pref.saitama.lg.jp/a0801/', 'pref.saitama.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '埼玉県産業労働部'),
('pref_12_chiba', 'prefecture', '12', 'https://www.pref.chiba.lg.jp/syousei/', 'pref.chiba.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '千葉県商工労働部'),
('pref_13_tokyo', 'prefecture', '13', 'https://www.sangyo-rodo.metro.tokyo.lg.jp/chushou/', 'metro.tokyo.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 1, '東京都産業労働局'),
('pref_14_kanagawa', 'prefecture', '14', 'https://www.pref.kanagawa.jp/docs/m6c/', 'pref.kanagawa.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '神奈川県産業労働局');

-- 中部
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_15_niigata', 'prefecture', '15', 'https://www.pref.niigata.lg.jp/site/sanroushou/', 'pref.niigata.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '新潟県産業労働部'),
('pref_16_toyama', 'prefecture', '16', 'https://www.pref.toyama.jp/sections/1300/', 'pref.toyama.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '富山県商工労働部'),
('pref_17_ishikawa', 'prefecture', '17', 'https://www.pref.ishikawa.lg.jp/sanro/', 'pref.ishikawa.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '石川県商工労働部'),
('pref_18_fukui', 'prefecture', '18', 'https://www.pref.fukui.lg.jp/doc/sansei/', 'pref.fukui.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '福井県産業労働部'),
('pref_19_yamanashi', 'prefecture', '19', 'https://www.pref.yamanashi.jp/sangyo/', 'pref.yamanashi.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '山梨県産業労働部'),
('pref_20_nagano', 'prefecture', '20', 'https://www.pref.nagano.lg.jp/sansei/', 'pref.nagano.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '長野県産業労働部'),
('pref_21_gifu', 'prefecture', '21', 'https://www.pref.gifu.lg.jp/sangyo/', 'pref.gifu.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '岐阜県商工労働部'),
('pref_22_shizuoka', 'prefecture', '22', 'https://www.pref.shizuoka.jp/sansei/', 'pref.shizuoka.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '静岡県経済産業部'),
('pref_23_aichi', 'prefecture', '23', 'https://www.pref.aichi.jp/sanro/', 'pref.aichi.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 1, '愛知県経済産業局');

-- 近畿
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_24_mie', 'prefecture', '24', 'https://www.pref.mie.lg.jp/SHOUSEI/', 'pref.mie.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '三重県雇用経済部'),
('pref_25_shiga', 'prefecture', '25', 'https://www.pref.shiga.lg.jp/ippan/shigotosangyou/', 'pref.shiga.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '滋賀県商工観光労働部'),
('pref_26_kyoto', 'prefecture', '26', 'https://www.pref.kyoto.jp/sangyo/', 'pref.kyoto.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '京都府商工労働観光部'),
('pref_27_osaka', 'prefecture', '27', 'https://www.pref.osaka.lg.jp/shinshangyo/', 'pref.osaka.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 1, '大阪府商工労働部'),
('pref_28_hyogo', 'prefecture', '28', 'https://web.pref.hyogo.lg.jp/sr05/', 'web.pref.hyogo.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '兵庫県産業労働部'),
('pref_29_nara', 'prefecture', '29', 'https://www.pref.nara.jp/dd.aspx?menuid=1681', 'pref.nara.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '奈良県産業・雇用振興部'),
('pref_30_wakayama', 'prefecture', '30', 'https://www.pref.wakayama.lg.jp/prefg/060100/', 'pref.wakayama.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '和歌山県商工観光労働部');

-- 中国
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_31_tottori', 'prefecture', '31', 'https://www.pref.tottori.lg.jp/sangyo/', 'pref.tottori.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '鳥取県商工労働部'),
('pref_32_shimane', 'prefecture', '32', 'https://www.pref.shimane.lg.jp/industry/', 'pref.shimane.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '島根県商工労働部'),
('pref_33_okayama', 'prefecture', '33', 'https://www.pref.okayama.jp/site/sangyo/', 'pref.okayama.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '岡山県産業労働部'),
('pref_34_hiroshima', 'prefecture', '34', 'https://www.pref.hiroshima.lg.jp/soshiki/73/', 'pref.hiroshima.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '広島県商工労働局'),
('pref_35_yamaguchi', 'prefecture', '35', 'https://www.pref.yamaguchi.lg.jp/cms/a16000/', 'pref.yamaguchi.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '山口県商工労働部');

-- 四国
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_36_tokushima', 'prefecture', '36', 'https://www.pref.tokushima.lg.jp/jigyoshanokata/sangyo/', 'pref.tokushima.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '徳島県商工労働観光部'),
('pref_37_kagawa', 'prefecture', '37', 'https://www.pref.kagawa.lg.jp/sangyo/', 'pref.kagawa.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '香川県商工労働部'),
('pref_38_ehime', 'prefecture', '38', 'https://www.pref.ehime.jp/h30000/', 'pref.ehime.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '愛媛県経済労働部'),
('pref_39_kochi', 'prefecture', '39', 'https://www.pref.kochi.lg.jp/soshiki/150000/', 'pref.kochi.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '高知県商工労働部');

-- 九州・沖縄
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, root_url, domain_key, crawl_strategy, max_depth, target_types, keyword_filter, update_freq, enabled, priority, notes) VALUES 
('pref_40_fukuoka', 'prefecture', '40', 'https://www.pref.fukuoka.lg.jp/gyosei/sangyou/', 'pref.fukuoka.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 1, '福岡県商工部'),
('pref_41_saga', 'prefecture', '41', 'https://www.pref.saga.lg.jp/kiji00315/', 'pref.saga.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '佐賀県産業労働部'),
('pref_42_nagasaki', 'prefecture', '42', 'https://www.pref.nagasaki.jp/section/sanro/', 'pref.nagasaki.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '長崎県産業労働部'),
('pref_43_kumamoto', 'prefecture', '43', 'https://www.pref.kumamoto.jp/soshiki/63/', 'pref.kumamoto.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '熊本県商工観光労働部'),
('pref_44_oita', 'prefecture', '44', 'https://www.pref.oita.jp/soshiki/14000/', 'pref.oita.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '大分県商工観光労働部'),
('pref_45_miyazaki', 'prefecture', '45', 'https://www.pref.miyazaki.lg.jp/sangyo/', 'pref.miyazaki.lg.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '宮崎県商工観光労働部'),
('pref_46_kagoshima', 'prefecture', '46', 'https://www.pref.kagoshima.jp/sangyo/', 'pref.kagoshima.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '鹿児島県商工労働水産部'),
('pref_47_okinawa', 'prefecture', '47', 'https://www.pref.okinawa.jp/sangyo/', 'pref.okinawa.jp', 'scrape', 2, 'subsidy', '補助金|助成金', 'weekly', 1, 2, '沖縄県商工労働部');

-- 凍結ルール表示用メタデータ（source_registryのsummary用）
-- SELECT scope, COUNT(*) as cnt, GROUP_CONCAT(geo_id) as geo_ids 
-- FROM source_registry WHERE enabled = 1 GROUP BY scope;

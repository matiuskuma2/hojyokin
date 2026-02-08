-- =====================================================
-- Phase 2: デジタル化・AI導入補助金2026 整備 + 追加補助金
-- =====================================================

-- 1. 既存IT-SUBSIDY-2026系のcanonical_id紐付け
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026' WHERE id = 'IT-SUBSIDY-2026-TSUJYO' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026' WHERE id = 'IT-SUBSIDY-2026-INVOICE' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026' WHERE id = 'IT-SUBSIDY-2026-DENSHI' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026' WHERE id = 'IT-SUBSIDY-2026-FUKUSU' AND (canonical_id IS NULL OR canonical_id = '');

-- 2. セキュリティ対策推進枠 (新規cache追加)
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'IT-SUBSIDY-2026-SECURITY', 'manual',
  'デジタル化・AI導入補助金2026 セキュリティ対策推進枠',
  1500000, '1/2以内（小規模事業者は2/3以内）', '全国',
  '2026-03-01T00:00:00Z', '2026-12-31T23:59:59Z',
  1, 1, 1, 1, 'pending', 75, 'IT-SUBSIDY-2026',
  '{"subsidy_name":"デジタル化・AI導入補助金2026 セキュリティ対策推進枠","subsidy_overview":"独立行政法人情報処理推進機構（IPA）が公表する「サイバーセキュリティお助け隊サービスリスト」に掲載されているITツールを導入する際の費用を補助。中小企業・小規模事業者等のサイバーセキュリティ対策を強化する。","subsidy_amount":"5万円～150万円","subsidy_rate":"1/2以内（小規模事業者は2/3以内）","target_company":"中小企業・小規模事業者等（飲食、宿泊、卸・小売、運輸、医療・介護・保育、IT関連業等）","required_documents":["gBizIDプライムアカウント","SECURITY ACTION宣言済み","サイバーセキュリティお助け隊サービスの導入計画","交付申請書","事業計画書"],"application_period":"2026年3月頃～（公募要領準備中）","official_url":"https://it-shien.smrj.go.jp/applicant/subsidy/security/","pdf_urls":{"交付規程":"https://it-shien.smrj.go.jp/pdf/it2026_kitei_security.pdf","公募要領":"準備中"},"key_points":["IPAサイバーセキュリティお助け隊サービスの導入が対象","SECURITY ACTIONの宣言が必須","補助額は5万円～150万円","小規模事業者は補助率2/3に優遇","2025年版と同様の枠組みを予定"],"eligibility_notes":"中小企業・小規模事業者等であること。gBizIDプライムアカウントの取得が必要。SECURITY ACTIONの宣言が必要。","subsidy_purpose":"サイバー攻撃被害の拡大防止および中小企業等のサイバーセキュリティ対策強化"}',
  '2026-12-31T23:59:59Z', datetime('now')
);

-- 3. セキュリティ枠のsnapshot
INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-IT-SUBSIDY-2026-SECURITY-20260208', 'IT-SUBSIDY-2026', 'IT-SUBSIDY-2026-SECURITY',
  '2026-02-08T00:00:00Z',
  '{"subsidy_name":"デジタル化・AI導入補助金2026 セキュリティ対策推進枠","subsidy_amount":"5万円～150万円","subsidy_rate":"1/2以内（小規模事業者は2/3以内）","status":"公募要領準備中","official_url":"https://it-shien.smrj.go.jp/applicant/subsidy/security/"}'
);

-- 4. セキュリティ枠のモニター登録
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, subsidy_cache_id, source_name, source_url,
  monitor_type, check_interval_hours, url_patterns, status, created_at, updated_at
) VALUES
('MONITOR-IT-SECURITY', 'IT-SUBSIDY-2026', 'IT-SUBSIDY-2026-SECURITY',
 'デジタル化・AI導入補助金2026 セキュリティ対策推進枠',
 'https://it-shien.smrj.go.jp/applicant/subsidy/security/',
 'webpage', 8, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now'));

-- 5. IT-SUBSIDY-2026系のdetail_json/detail_score更新
-- 通常枠: 申請受付開始情報を追加
UPDATE subsidy_cache SET 
  acceptance_start_datetime = '2026-03-01T00:00:00Z',
  acceptance_end_datetime = '2026-12-31T23:59:59Z'
WHERE id = 'IT-SUBSIDY-2026-TSUJYO' AND acceptance_start_datetime IS NULL;

UPDATE subsidy_cache SET 
  acceptance_start_datetime = '2026-03-01T00:00:00Z',
  acceptance_end_datetime = '2026-12-31T23:59:59Z'
WHERE id = 'IT-SUBSIDY-2026-INVOICE' AND acceptance_start_datetime IS NULL;

UPDATE subsidy_cache SET 
  acceptance_start_datetime = '2026-03-01T00:00:00Z',
  acceptance_end_datetime = '2026-12-31T23:59:59Z'
WHERE id = 'IT-SUBSIDY-2026-DENSHI' AND acceptance_start_datetime IS NULL;

UPDATE subsidy_cache SET 
  acceptance_start_datetime = '2026-03-01T00:00:00Z',
  acceptance_end_datetime = '2026-12-31T23:59:59Z'
WHERE id = 'IT-SUBSIDY-2026-FUKUSU' AND acceptance_start_datetime IS NULL;

-- =====================================================
-- 6. 省エネ補助金（工場・事業場型）詳細登録
-- =====================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'SHOUENE-KOUJOU-06', 'manual',
  '省エネルギー投資促進支援事業費補助金（工場・事業場型）令和6年度補正',
  1500000000, '1/3～1/2', '全国',
  '2025-03-01T00:00:00Z', '2026-12-31T23:59:59Z',
  1, 1, 1, 1, 'pending', 70, 'SHOUENE-ENECHO',
  '{"subsidy_name":"省エネルギー投資促進支援事業費補助金（工場・事業場型）","subsidy_overview":"工場・事業場単位で省エネルギー性能の高い機器・設備への更新を支援。エネルギー消費原単位の改善やCO2排出量の削減を目指す設備投資を補助。一般社団法人環境共創イニシアチブ（SII）が事務局。","subsidy_amount":"上限15億円/事業所","subsidy_rate":"中小企業：1/2以内、大企業：1/3以内","target_company":"国内で事業活動を営む法人および個人事業主","required_documents":["省エネルギー計画書","エネルギー使用量報告","設備導入計画書","見積書","事業計画書"],"application_period":"公募時期はSIIサイトで公告","official_url":"https://sii.or.jp/koujou06r/","pdf_urls":{"公募要領":"https://sii.or.jp/koujou06r/uploads/koujou06r_koubo_01.pdf"},"key_points":["工場・事業場単位の包括的な省エネ設備投資が対象","省エネ計画に基づく設備更新を支援","中小企業は補助率1/2、大企業は1/3","SII（環境共創イニシアチブ）が審査・執行","エネルギー管理の見える化も推奨"],"eligibility_notes":"国内に事業所を有する法人または個人事業主。省エネルギー計画の策定が必要。"}',
  '2026-12-31T23:59:59Z', datetime('now')
);

-- 省エネ(設備単位型)
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'SHOUENE-SETSUBI-06', 'manual',
  '省エネルギー投資促進支援事業費補助金（設備単位型）令和6年度補正',
  100000000, '1/3', '全国',
  '2025-03-01T00:00:00Z', '2026-12-31T23:59:59Z',
  1, 1, 1, 1, 'pending', 70, 'SHOUENE-ENECHO',
  '{"subsidy_name":"省エネルギー投資促進支援事業費補助金（設備単位型）","subsidy_overview":"設備単位で省エネルギー性能の高い機器への更新を支援。対象設備カテゴリー（ボイラ、空調、照明、変圧器等）ごとに基準を設定し、基準を満たす設備への更新に対して補助。","subsidy_amount":"上限1億円/事業","subsidy_rate":"1/3以内","target_company":"国内で事業活動を営む法人および個人事業主","required_documents":["対象設備の仕様書","見積書","省エネ効果計算書","事業計画書"],"application_period":"公募時期はSIIサイトで公告","official_url":"https://sii.or.jp/setsubi06r/","pdf_urls":{"公募要領":"SIIサイトで公開"},"key_points":["設備単位での個別更新が対象","ボイラ、空調、照明、変圧器等のカテゴリーごとに基準あり","補助率は1/3","SIIが審査・執行","エネルギー消費効率の改善が要件"],"eligibility_notes":"国内に事業所を有する法人または個人事業主。対象設備カテゴリーの基準を満たす設備への更新であること。"}',
  '2026-12-31T23:59:59Z', datetime('now')
);

-- 省エネ canonical
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('SHOUENE-ENECHO', '省エネルギー投資促進支援事業費補助金', 1, 'SHOUENE-KOUJOU-06', datetime('now'), datetime('now'));

-- 省エネ snapshots
INSERT OR IGNORE INTO subsidy_snapshot (id, canonical_id, source_link_id, snapshot_at, detail_json)
VALUES 
  ('snapshot-SHOUENE-KOUJOU-06-20260208', 'SHOUENE-ENECHO', 'SHOUENE-KOUJOU-06', '2026-02-08T00:00:00Z',
   '{"subsidy_name":"省エネ補助金（工場・事業場型）","status":"公募中","official_url":"https://sii.or.jp/koujou06r/"}'),
  ('snapshot-SHOUENE-SETSUBI-06-20260208', 'SHOUENE-ENECHO', 'SHOUENE-SETSUBI-06', '2026-02-08T00:00:00Z',
   '{"subsidy_name":"省エネ補助金（設備単位型）","status":"公募中","official_url":"https://sii.or.jp/setsubi06r/"}');

-- =====================================================
-- 7. 業務改善助成金（令和7年度）詳細登録
-- =====================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'GYOMU-KAIZEN-R7', 'manual',
  '業務改善助成金（令和7年度）',
  6000000, '3/4～9/10', '全国',
  '2025-04-01T00:00:00Z', '2026-03-31T23:59:59Z',
  1, 0, 1, 1, 'pending', 75, 'GYOMU-KAIZEN',
  '{"subsidy_name":"業務改善助成金（令和7年度）","subsidy_overview":"事業場内最低賃金を30円以上引き上げた中小企業・小規模事業者に対し、その引上げに資する設備投資（機械設備、コンサルティング導入、人材育成等）の費用を一部助成する制度。生産性向上と賃上げを同時に実現する国の重点施策。","subsidy_amount":"30万円～600万円（引上げ額・引上げ人数により異なる）","subsidy_rate":"3/4～9/10（事業場内最低賃金により異なる）","target_company":"事業場内最低賃金と地域別最低賃金の差額が50円以内の事業場を持つ中小企業・小規模事業者","required_documents":["交付申請書","賃金引上計画","事業実施計画書","見積書（相見積もり）","賃金台帳","就業規則等"],"application_period":"通年申請可能（予算がなくなり次第終了）","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html","pdf_urls":{"概要資料":"https://www.mhlw.go.jp/content/11200000/001070651.pdf"},"key_points":["最低賃金引上げ+設備投資のセット要件","補助率は賃金水準により3/4～9/10と高い","機械設備だけでなくPOSレジ・コンサル等も対象","通年申請可能（予算消化ペースに注意）","引上げ額30円～90円以上の区分あり"],"eligibility_notes":"事業場内最低賃金と地域別最低賃金の差額が50円以内であること。賃金引上げ計画を策定・実施すること。","subsidy_tiers":[{"raise_amount":"30円以上","max_subsidy":"30万円～90万円","note":"引上げ人数1～10人以上"},{"raise_amount":"45円以上","max_subsidy":"45万円～180万円","note":"引上げ人数1～10人以上"},{"raise_amount":"60円以上","max_subsidy":"60万円～300万円","note":"引上げ人数1～10人以上"},{"raise_amount":"90円以上","max_subsidy":"90万円～600万円","note":"引上げ人数1～10人以上"}]}',
  '2026-03-31T23:59:59Z', datetime('now')
);

-- 業務改善 canonical update
UPDATE subsidy_canonical SET latest_cache_id = 'GYOMU-KAIZEN-R7', is_active = 1, updated_at = datetime('now') WHERE id = 'GYOMU-KAIZEN';
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('GYOMU-KAIZEN', '業務改善助成金', 1, 'GYOMU-KAIZEN-R7', datetime('now'), datetime('now'));

-- =====================================================
-- 8. 持続化補助金 一般型第19回 detail_json充実
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = '{"subsidy_name":"小規模事業者持続化補助金（一般型）第19回公募","subsidy_overview":"小規模事業者が自ら作成した経営計画に基づき、商工会・商工会議所の支援を受けながら行う販路開拓や業務効率化の取組を支援する補助金。地道な販路開拓等を支援し、小規模事業者の持続的な経営を後押し。","subsidy_amount":"通常枠：上限50万円（賃金引上げ枠・卒業枠・後継者支援枠・創業枠の場合は上限200万円）","subsidy_rate":"2/3（賃金引上げ枠の赤字事業者は3/4）","target_company":"商工会議所の管轄地域内で事業を営む小規模事業者","required_documents":["経営計画書（様式2）","補助事業計画書（様式3）","事業支援計画書（様式4：商工会議所が発行）","補助金交付申請書","直近の確定申告書","貸借対照表・損益計算書"],"application_period":"申請受付：2026年3月6日～締切：2026年4月30日","official_url":"https://r6.jizokukahojokin.info/","pdf_urls":{"公募要領":"https://r6.jizokukahojokin.info/doc/r6_jizokuka_koubo19_ippan.pdf"},"key_points":["商工会議所管轄地域の小規模事業者が対象","経営計画書の作成が必須","商工会議所の支援・確認（様式4）が必要","電子申請（jGrants）で申請","特別枠（賃金引上げ・卒業・後継者支援・創業）で上限200万円","インボイス特例で+50万円上乗せ可能"],"eligibility_notes":"小規模事業者（商業・サービス業は従業員5人以下、製造業等は20人以下）であること。","schedule":{"公募開始":"2026年1月28日","申請受付":"2026年3月6日","申請締切":"2026年4月30日","採択発表":"確定次第更新"}}',
  detail_score = 90,
  acceptance_start_datetime = '2026-03-06T00:00:00Z',
  acceptance_end_datetime = '2026-04-30T23:59:59Z'
WHERE id = 'JIZOKUKA-IPPAN-19';

-- 9. 持続化補助金 創業型第3回 detail_json充実
UPDATE subsidy_cache SET 
  detail_json = '{"subsidy_name":"小規模事業者持続化補助金（創業型）第3回公募","subsidy_overview":"創業者（産業競争力強化法に基づく認定市区町村による特定創業支援等事業の支援を受けた者）が行う販路開拓や業務効率化の取組を支援。創業期の事業者を重点的に後押しする補助金。","subsidy_amount":"上限200万円","subsidy_rate":"2/3","target_company":"産業競争力強化法に基づく特定創業支援等事業の支援を受けた小規模事業者","required_documents":["経営計画書","補助事業計画書","事業支援計画書（商工会議所発行）","特定創業支援等事業による支援を受けたことの証明書","補助金交付申請書"],"application_period":"申請受付：2026年3月6日～締切：2026年4月30日","official_url":"https://r6.jizokukahojokin.info/sogyo/","pdf_urls":{"公募要領":"https://r6.jizokukahojokin.info/doc/r6_jizokuka_koubo03_sogyo.pdf"},"key_points":["特定創業支援等事業の支援を受けた創業者が対象","補助上限額200万円（一般型の50万円より大幅に高い）","商工会議所の確認が必要","第3回公募は2026年4月30日締切","電子申請（jGrants）で申請"],"eligibility_notes":"産業競争力強化法に基づく認定市区町村の特定創業支援等事業の支援を受けた小規模事業者であること。","schedule":{"公募開始":"2026年1月28日","申請受付":"2026年3月6日","申請締切":"2026年4月30日","採択発表":"確定次第更新"}}',
  detail_score = 85,
  acceptance_start_datetime = '2026-03-06T00:00:00Z',
  acceptance_end_datetime = '2026-04-30T23:59:59Z'
WHERE id = 'JIZOKUKA-SOGYO-03';

-- =====================================================
-- 10. 持続化補助金 一般型19回/創業型3回 snapshots更新
-- =====================================================
INSERT OR REPLACE INTO subsidy_snapshot (id, canonical_id, source_link_id, snapshot_at, detail_json)
VALUES 
  ('snapshot-JIZOKUKA-IPPAN-19-20260208', 'JIZOKUKA-IPPAN-19', 'JIZOKUKA-IPPAN-19', '2026-02-08T00:00:00Z',
   '{"subsidy_name":"小規模事業者持続化補助金（一般型）第19回","status":"公募中（申請受付3/6～4/30）","official_url":"https://r6.jizokukahojokin.info/"}'),
  ('snapshot-JIZOKUKA-SOGYO-03-20260208', 'JIZOKUKA-SOGYO-03', 'JIZOKUKA-SOGYO-03', '2026-02-08T00:00:00Z',
   '{"subsidy_name":"小規模事業者持続化補助金（創業型）第3回","status":"公募中（申請受付3/6～4/30）","official_url":"https://r6.jizokukahojokin.info/sogyo/"}');

-- =====================================================
-- 11. canonical snapshot_id 更新
-- =====================================================
UPDATE subsidy_canonical SET latest_snapshot_id = 'snapshot-JIZOKUKA-IPPAN-19-20260208', updated_at = datetime('now') WHERE id = 'JIZOKUKA-IPPAN-19';
UPDATE subsidy_canonical SET latest_snapshot_id = 'snapshot-JIZOKUKA-SOGYO-03-20260208', updated_at = datetime('now') WHERE id = 'JIZOKUKA-SOGYO-03';

-- =====================================================
-- 12. 全canonical_id が NULLのcacheを修正（一括）
-- =====================================================
UPDATE subsidy_cache SET canonical_id = 'CAREER-UP-SEISHAIN' WHERE id = 'CAREER-UP-SEISHAIN' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'JINZAI-RESKILLING' WHERE id = 'JINZAI-RESKILLING' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'JINZAI-IKUSEI' WHERE id = 'JINZAI-IKUSEI' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'SHORYOKUKA-CATALOG' WHERE id = 'SHORYOKUKA-CATALOG' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'JIZOKUKA-KYODO-02' WHERE id = 'JIZOKUKA-KYODO-02' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'JIZOKUKA-NOTO-09' WHERE id = 'JIZOKUKA-NOTO-09' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'MONODUKURI-23' WHERE id = 'MONODUKURI-23' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'SEICHOU-KASOKU-02' WHERE id = 'SEICHOU-KASOKU-02' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'SHINJIGYO-03' WHERE id = 'SHINJIGYO-03' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'JIGYOSHOKEI-MA-14' WHERE id = 'JIGYOSHOKEI-MA-14' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'GYOMU-KAIZEN' WHERE id = 'GYOMU-KAIZEN-R7' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'SHOUENE-ENECHO' WHERE id = 'SHOUENE-KOUJOU-06' AND (canonical_id IS NULL OR canonical_id = '');
UPDATE subsidy_cache SET canonical_id = 'SHOUENE-ENECHO' WHERE id = 'SHOUENE-SETSUBI-06' AND (canonical_id IS NULL OR canonical_id = '');

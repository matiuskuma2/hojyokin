-- =====================================================
-- Part 1: 既存6件の補助金のdata_source_monitors登録
-- =====================================================

INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, subsidy_cache_id, source_name, source_url,
  monitor_type, check_interval_hours, url_patterns, status, created_at, updated_at
) VALUES
('MONITOR-SHORYOKUKA-CATALOG', 'SHORYOKUKA-CATALOG', 'SHORYOKUKA-CATALOG',
 '中小企業省力化投資補助金（カタログ注文型）公式ページ',
 'https://shoryokuka.smrj.go.jp/catalog/',
 'webpage', 12, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now')),
('MONITOR-JIZOKUKA-KYODO-02', 'JIZOKUKA-KYODO-02', 'JIZOKUKA-KYODO-02',
 '小規模事業者持続化補助金（共同・協業型）第2回公募ページ',
 'https://r6.jizokukahojokin.info/kyodo/',
 'webpage', 8, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now')),
('MONITOR-JIZOKUKA-NOTO-09', 'JIZOKUKA-NOTO-09', 'JIZOKUKA-NOTO-09',
 '小規模事業者持続化補助金（災害支援枠・能登）第9次ページ',
 'https://r6.jizokukahojokin.info/noto/',
 'webpage', 8, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now')),
('MONITOR-CAREER-UP-SEISHAIN', 'CAREER-UP-SEISHAIN', 'CAREER-UP-SEISHAIN',
 'キャリアアップ助成金（正社員化コース）厚労省ページ',
 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html',
 'webpage', 24, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now')),
('MONITOR-JINZAI-RESKILLING', 'JINZAI-RESKILLING', 'JINZAI-RESKILLING',
 '人材開発支援助成金（リスキリング支援コース）厚労省ページ',
 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html',
 'webpage', 24, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now')),
('MONITOR-JINZAI-IKUSEI', 'JINZAI-IKUSEI', 'JINZAI-IKUSEI',
 '人材開発支援助成金（人材育成支援コース）厚労省ページ',
 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html',
 'webpage', 24, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now'));

-- =====================================================
-- Part 2: 追加4件（ものづくり23次, 成長加速化2次, 新事業進出3回, 事業承継14次）
-- =====================================================

-- 2-1: ものづくり補助金 第23次 (subsidy_cache)
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score,
  detail_json, expires_at, cached_at
) VALUES (
  'MONODUKURI-23', 'manual',
  'ものづくり・商業・サービス生産性向上促進補助金（第23次公募）',
  250000000, '1/2～2/3', '全国',
  '2026-04-03T00:00:00Z', '2026-05-08T08:00:00Z',
  1, 1, 1, 1, 'pending', 90,
  json('{"subsidy_name":"ものづくり・商業・サービス生産性向上促進補助金（第23次公募）","subsidy_overview":"中小企業・小規模事業者等が革新的サービス開発・試作品開発・生産プロセスの改善に取り組み、生産性向上のための設備投資等を支援。","subsidy_purpose":"中小企業等の生産性向上を目的とした設備投資・システム導入を支援し、賃上げにもつなげる。","target_businesses":"中小企業者（製造業・建設業・運輸業：資本金3億円以下/従業員300人以下、卸売業：1億円以下/100人以下、サービス業：5,000万円以下/100人以下、小売業：5,000万円以下/50人以下）","subsidy_amount":"【製品・サービス高付加価値化枠】5人以下:750万円、6～20人:1,000万円、21～50人:1,500万円、51人以上:2,500万円（大幅賃上げで上乗せあり）。【グローバル枠】3,000万円（大幅賃上げで上乗せあり）","subsidy_rate":"1/2（小規模・再生事業者は2/3）","application_period":"公募:2026年2月6日～、申請受付:2026年4月3日17:00、申請締切:2026年5月8日17:00","eligible_expenses":["機械装置・システム構築費","技術導入費","専門家経費","運搬費","クラウドサービス利用費","原材料費","外注費","知的財産権等関連経費"],"required_documents":{"common":["事業計画書","賃金引上げ計画の誓約書","決算書（直近2年分）","従業員数確認書類","GビズIDプライムアカウント"]},"eligibility_rules":[{"rule":"日本国内に本社・補助事業の実施場所を有する中小企業者であること","auto_check":true,"field":"is_domestic_company"},{"rule":"付加価値額 年率平均3%以上増加の事業計画を策定すること","auto_check":false},{"rule":"給与支給総額 年率平均1.5%以上増加の事業計画を策定すること","auto_check":false},{"rule":"事業場内最低賃金を地域別最低賃金+30円以上の水準にすること","auto_check":false},{"rule":"GビズIDプライムアカウントを取得していること","auto_check":true,"field":"has_gbiz_id"}],"wall_chat_questions":[{"id":"wc_MONODUKURI-23_q_0","text":"御社の業種と従業員数を教えてください（補助上限額の算定に使用します）","type":"text","required":true},{"id":"wc_MONODUKURI-23_q_1","text":"どのような革新的な製品・サービス・生産プロセスの改善を計画していますか？","type":"text","required":true},{"id":"wc_MONODUKURI-23_q_2","text":"GビズIDプライムアカウントは取得済みですか？","type":"select","options":["取得済み","申請中","未取得"],"required":true},{"id":"wc_MONODUKURI-23_q_3","text":"導入予定の設備・システムの概算費用はいくらですか？","type":"number","required":true},{"id":"wc_MONODUKURI-23_q_4","text":"過去3年以内にものづくり補助金の交付を受けたことはありますか？","type":"select","options":["ない","ある（事業化状況報告済み）","ある（未報告）"],"required":true},{"id":"wc_MONODUKURI-23_q_5","text":"賃上げ計画（付加価値額年率3%以上、給与総額年率1.5%以上）は策定可能ですか？","type":"select","options":["可能","検討中","困難"],"required":true},{"id":"wc_MONODUKURI-23_q_6","text":"申請枠はどちらを検討していますか？","type":"select","options":["製品・サービス高付加価値化枠（通常類型）","製品・サービス高付加価値化枠（成長分野進出類型）","グローバル枠"],"required":true}]}'),
  datetime('now', '+365 days'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, latest_cache_id, latest_snapshot_id, is_active, created_at, updated_at
) VALUES ('MONODUKURI-23', 'ものづくり・商業・サービス生産性向上促進補助金（第23次公募）',
  'MONODUKURI-23', 'snapshot-MONODUKURI-23-20260208', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES ('snapshot-MONODUKURI-23-20260208', 'MONODUKURI-23', 1, 250000000, '1/2～2/3',
  '2026-04-03', '2026-05-08', '全国', 'https://portal.monodukuri-hojo.jp/about.html',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'MONODUKURI-23'),
  datetime('now'), datetime('now'));

INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, subsidy_cache_id, source_name, source_url,
  monitor_type, check_interval_hours, url_patterns, status, created_at, updated_at
) VALUES ('MONITOR-MONODUKURI-23', 'MONODUKURI-23', 'MONODUKURI-23',
  'ものづくり補助金 第23次公募 公募要領ページ',
  'https://portal.monodukuri-hojo.jp/about.html',
  'webpage', 8, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now'));


-- 2-2: 中小企業成長加速化補助金 第2次 (subsidy_cache)
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score,
  detail_json, expires_at, cached_at
) VALUES (
  'SEICHOU-KASOKU-02', 'manual',
  '中小企業成長加速化補助金（第2次公募）',
  500000000, '1/2以内', '全国',
  '2026-02-24T04:00:00Z', '2026-03-26T06:00:00Z',
  1, 1, 1, 1, 'pending', 90,
  json('{"subsidy_name":"中小企業成長加速化補助金（第2次公募）","subsidy_overview":"売上高100億円超を目指す中小企業の大胆な設備投資を支援。最大5億円、補助率1/2以内。","subsidy_purpose":"賃上げへの貢献、輸出による外需獲得、域内の仕入による地域経済への波及効果が大きい売上高100億円超を目指す中小企業の大胆な投資を支援する。","target_businesses":"中小企業基本法に定める中小企業者で、100億宣言を行った企業","subsidy_amount":"最大5億円","subsidy_rate":"1/2以内","application_period":"2026年2月24日（火）13:00～2026年3月26日（木）15:00","eligible_expenses":["建物費（拠点新設・増築等）","機械装置費（器具・備品費含む）","ソフトウェア費","外注費","専門家経費"],"required_documents":{"common":["投資計画書（様式1）","投資計画書別紙（様式2）","決算書（直近3期分）","100億宣言の公表証明","GビズIDプライムアカウント","リース取引に係る宣誓書（該当する場合）"]},"eligibility_rules":[{"rule":"中小企業基本法第2条に定める中小企業者であること","auto_check":true,"field":"is_sme"},{"rule":"申請時までに100億宣言を行い、ポータルサイトに公表されていること","auto_check":false},{"rule":"投資額が税抜き1億円以上であること","auto_check":false},{"rule":"賃上げ要件を満たす5年程度の事業計画を策定すること","auto_check":false},{"rule":"日本国内で補助事業を実施すること","auto_check":true,"field":"is_domestic_company"}],"wall_chat_questions":[{"id":"wc_SEICHOU-KASOKU-02_q_0","text":"御社の現在の売上高と、100億円達成の目標年を教えてください","type":"text","required":true},{"id":"wc_SEICHOU-KASOKU-02_q_1","text":"100億宣言はポータルサイトに公表済みですか？","type":"select","options":["公表済み","申請中","未申請"],"required":true},{"id":"wc_SEICHOU-KASOKU-02_q_2","text":"計画している投資の内容と概算額を教えてください（税抜き1億円以上が必要）","type":"text","required":true},{"id":"wc_SEICHOU-KASOKU-02_q_3","text":"投資により期待する効果（売上増加・輸出拡大・地域経済波及など）を教えてください","type":"text","required":true},{"id":"wc_SEICHOU-KASOKU-02_q_4","text":"直近3期の売上高の推移を教えてください","type":"text","required":true},{"id":"wc_SEICHOU-KASOKU-02_q_5","text":"賃上げ計画（補助事業終了後3年間）は策定可能ですか？","type":"select","options":["可能","検討中","困難"],"required":true}]}'),
  datetime('now', '+365 days'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, latest_cache_id, latest_snapshot_id, is_active, created_at, updated_at
) VALUES ('SEICHOU-KASOKU-02', '中小企業成長加速化補助金（第2次公募）',
  'SEICHOU-KASOKU-02', 'snapshot-SEICHOU-KASOKU-02-20260208', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES ('snapshot-SEICHOU-KASOKU-02-20260208', 'SEICHOU-KASOKU-02', 1, 500000000, '1/2以内',
  '2026-02-24', '2026-03-26', '全国', 'https://growth-100-oku.smrj.go.jp/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'SEICHOU-KASOKU-02'),
  datetime('now'), datetime('now'));


-- 2-3: 新事業進出補助金 第3回 (subsidy_cache)
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score,
  detail_json, expires_at, cached_at
) VALUES (
  'SHINJIGYO-03', 'manual',
  '中小企業新事業進出補助金（第3回公募）',
  900000000, '1/2～2/3', '全国',
  '2026-02-17T00:00:00Z', '2026-03-26T09:00:00Z',
  1, 1, 1, 1, 'pending', 90,
  json('{"subsidy_name":"中小企業新事業進出補助金（第3回公募）","subsidy_overview":"既存事業とは異なる新たな事業への進出を支援。新市場進出、事業転換、業種転換等に取り組む中小企業等の設備投資を補助。","subsidy_purpose":"ポストコロナ時代の経済社会の変化に対応するため、新市場進出・事業転換・業種転換等の事業再構築に挑む中小企業を支援する。","target_businesses":"中小企業基本法に定める中小企業者で、新たな事業進出に取り組む者","subsidy_amount":"【従業員規模別上限額】20人以下:2,500万円、21～50人:4,000万円、51～100人:5,500万円、101人以上:7,000万円（大幅賃上げでさらに上乗せ、最大9,000万円）","subsidy_rate":"1/2（小規模事業者・再生事業者は2/3）。賃金引上げ特例2/3。","application_period":"2026年2月17日（火）～2026年3月26日（木）18:00","eligible_expenses":["建物費","機械装置・システム構築費","技術導入費","専門家経費","運搬費","クラウドサービス利用費","外注費","知的財産権等関連経費","広告宣伝・販売促進費","研修費","廃業費"],"required_documents":{"common":["事業計画書","認定支援機関確認書","決算書（直近2期分）","従業員数確認書類","GビズIDプライムアカウント","賃金引上げ計画表明書"]},"eligibility_rules":[{"rule":"中小企業基本法に定める中小企業者であること","auto_check":true,"field":"is_sme"},{"rule":"新たな事業活動への進出であること","auto_check":false},{"rule":"認定経営革新等支援機関と事業計画を策定すること","auto_check":false},{"rule":"付加価値額の年率平均3.0%以上増加の事業計画を策定すること","auto_check":false},{"rule":"GビズIDプライムアカウントを取得していること","auto_check":true,"field":"has_gbiz_id"},{"rule":"口頭審査に事業者本人が対応すること","auto_check":false}],"wall_chat_questions":[{"id":"wc_SHINJIGYO-03_q_0","text":"御社の従業員数と業種を教えてください","type":"text","required":true},{"id":"wc_SHINJIGYO-03_q_1","text":"進出予定の新事業の内容を教えてください（既存事業との違いが重要です）","type":"text","required":true},{"id":"wc_SHINJIGYO-03_q_2","text":"認定経営革新等支援機関との連携は済んでいますか？","type":"select","options":["連携済み","交渉中","未着手"],"required":true},{"id":"wc_SHINJIGYO-03_q_3","text":"GビズIDプライムアカウントは取得済みですか？","type":"select","options":["取得済み","申請中","未取得"],"required":true},{"id":"wc_SHINJIGYO-03_q_4","text":"計画している投資額の概算を教えてください","type":"number","required":true},{"id":"wc_SHINJIGYO-03_q_5","text":"賃上げ計画（付加価値額年率3%以上増加等）は策定可能ですか？","type":"select","options":["可能","検討中","困難"],"required":true}]}'),
  datetime('now', '+365 days'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, latest_cache_id, latest_snapshot_id, is_active, created_at, updated_at
) VALUES ('SHINJIGYO-03', '中小企業新事業進出補助金（第3回公募）',
  'SHINJIGYO-03', 'snapshot-SHINJIGYO-03-20260208', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES ('snapshot-SHINJIGYO-03-20260208', 'SHINJIGYO-03', 1, 900000000, '1/2～2/3',
  '2026-02-17', '2026-03-26', '全国', 'https://shinjigyou-shinshutsu.smrj.go.jp/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'SHINJIGYO-03'),
  datetime('now'), datetime('now'));


-- 2-4: 事業承継・M&A補助金 第14次 (subsidy_cache)
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score,
  detail_json, expires_at, cached_at
) VALUES (
  'JIGYOSHOKEI-MA-14', 'manual',
  '事業承継・M&A補助金（第14次公募）',
  10000000, '1/2～2/3', '全国',
  '2026-02-27T00:00:00Z', '2026-04-03T08:00:00Z',
  1, 1, 1, 1, 'pending', 90,
  json('{"subsidy_name":"事業承継・M&A補助金（第14次公募）","subsidy_overview":"事業承継やM&Aに取り組む中小企業の経営資源の引継ぎを支援する補助金。","subsidy_purpose":"事業承継を契機とした新たな取組や、M&Aによる経営資源の有効活用を支援し、中小企業の生産性向上を図る。","target_businesses":"中小企業基本法に定める中小企業者で、事業承継やM&Aを行う又は行った事業者","subsidy_amount":"【事業承継促進枠】最大800万円（賃上げで1,000万円）+ 廃業費150万円。【専門家活用枠】買い手/売り手支援:最大600万円 + 上乗せ200万円。【廃業・再チャレンジ枠】最大150万円。【PMI推進枠】事業統合投資:最大1,000万円、専門家活用:最大150万円","subsidy_rate":"事業承継促進枠: 小規模2/3・それ以外1/2。専門家活用枠: 買い手2/3・売り手1/2又は2/3。","application_period":"2026年2月27日（金）～2026年4月3日（金）17:00","eligible_expenses":["設備費","外注費","委託費","謝金","旅費","システム利用料","保険料","廃業費"],"required_documents":{"common":["事業計画書","決算書（直近2期分）","認定経営革新等支援機関確認書","GビズIDプライムアカウント","事業承継に関する証明書類"]},"eligibility_rules":[{"rule":"中小企業者であること","auto_check":true,"field":"is_sme"},{"rule":"事業承継またはM&Aを実施する（した）事業者であること","auto_check":false},{"rule":"認定経営革新等支援機関の確認を受けること","auto_check":false},{"rule":"GビズIDプライムアカウントを取得していること","auto_check":true,"field":"has_gbiz_id"}],"wall_chat_questions":[{"id":"wc_JIGYOSHOKEI-MA-14_q_0","text":"事業承継・M&Aの種類を教えてください","type":"select","options":["親族内承継","従業員承継（MBO等）","第三者承継（M&A）","廃業・再チャレンジ"],"required":true},{"id":"wc_JIGYOSHOKEI-MA-14_q_1","text":"申請予定の枠を教えてください","type":"select","options":["事業承継促進枠","専門家活用枠（買い手）","専門家活用枠（売り手）","廃業・再チャレンジ枠","PMI推進枠"],"required":true},{"id":"wc_JIGYOSHOKEI-MA-14_q_2","text":"事業承継・M&Aの予定時期を教えてください","type":"text","required":true},{"id":"wc_JIGYOSHOKEI-MA-14_q_3","text":"認定経営革新等支援機関との連携状況を教えてください","type":"select","options":["連携済み","交渉中","未着手"],"required":true},{"id":"wc_JIGYOSHOKEI-MA-14_q_4","text":"GビズIDプライムアカウントは取得済みですか？","type":"select","options":["取得済み","申請中","未取得"],"required":true},{"id":"wc_JIGYOSHOKEI-MA-14_q_5","text":"計画している投資・経費の概算額を教えてください","type":"number","required":true}]}'),
  datetime('now', '+365 days'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, latest_cache_id, latest_snapshot_id, is_active, created_at, updated_at
) VALUES ('JIGYOSHOKEI-MA-14', '事業承継・M&A補助金（第14次公募）',
  'JIGYOSHOKEI-MA-14', 'snapshot-JIGYOSHOKEI-MA-14-20260208', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES ('snapshot-JIGYOSHOKEI-MA-14-20260208', 'JIGYOSHOKEI-MA-14', 1, 10000000, '1/2～2/3',
  '2026-02-27', '2026-04-03', '全国', 'https://shoukei-mahojokin.go.jp/r7h/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JIGYOSHOKEI-MA-14'),
  datetime('now'), datetime('now'));

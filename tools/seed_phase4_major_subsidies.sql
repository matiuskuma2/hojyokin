-- ===================================================================
-- Phase 4: 重要補助金・助成金 追加登録
-- 対象: 大規模成長投資補助金(第5次), 働き方改革推進支援助成金(2コース),
--        65歳超雇用推進助成金, トライアル雇用助成金,
--        SHINJIGYO-MONO-2026 canonical整備
-- 実行日: 2026-02-08
-- ===================================================================

-- ============================================
-- 1. 大規模成長投資補助金（第5次公募）
-- ============================================
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name,
  category_codes, latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'DAIKIBO-SEICHOU-05',
  '中堅・中小・スタートアップ企業の賃上げに向けた省力化等の大規模成長投資補助金（第5次公募）',
  'daikibo seichou toushi hojokin 5ji',
  'METI', '経済産業省・中小企業庁',
  '["investment","growth","wage"]',
  'DAIKIBO-SEICHOU-05', 'snapshot-DAIKIBO-SEICHOU-05-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_mode, detail_score,
  canonical_id, detail_json, cached_at, expires_at
) VALUES (
  'DAIKIBO-SEICHOU-05', 'manual',
  '中堅・中小・スタートアップ企業の賃上げに向けた省力化等の大規模成長投資補助金（第5次公募）',
  5000000000, '1/3以下',
  '全国', '2026-04-01T00:00:00Z', '2026-06-30T00:00:00Z',
  1, 1, 1, 1, 1, 85,
  'DAIKIBO-SEICHOU-05',
  json('{"subsidy_name":"中堅・中小・スタートアップ企業の賃上げに向けた省力化等の大規模成長投資補助金（第5次公募）","subsidy_amount":"最大50億円（補助率1/3以下）","subsidy_rate":"1/3以下","target_audience":"中堅・中小・スタートアップ企業（従業員2,000人以下）","investment_minimum":"20億円以上（100億宣言企業は15億円以上）","wage_requirement":"事業終了後3年間、従業員1人あたり給与支給総額の年平均上昇率5.0%以上（100億宣言企業は4.5%以上）","eligible_expenses":["建物費（拠点新設・増築・本社機能移転含む）","機械装置費（器具・備品費含む）","ソフトウェア費","外注費","専門家経費"],"application_period":"2026年春予定","schedule":{"公募開始":"2026年春","補助事業期間":"交付決定日～最長2028年12月末"},"screening_process":["一次審査：書類審査","二次審査：外部有識者へのプレゼンテーション"],"screening_criteria":["経営力","先進性・成長性","地域への波及効果","大規模投資・費用対効果","実現可能性"],"consortium":"最大10者の共同申請（コンソーシアム形式）可","exclusion":"みなし大企業は対象外","official_url":"https://seichotoushi-hojo.jp/","pdf_urls":["https://seichotoushi-hojo.jp/assets/pdf/5ji_public_overview.pdf"],"notes":"令和7年度補正予算 4,121億円（新規2,000億円、既存2,121億円）。前回第4次の平均投資額は約38億円、採択金額合計約1,138億円。","wall_chat_questions":["大規模成長投資補助金の第5次公募はいつ始まりますか？","補助上限額と補助率はいくらですか？","投資の下限額はありますか？","賃上げ要件はどのような内容ですか？","100億宣言企業の優遇措置はありますか？","コンソーシアム（共同申請）は可能ですか？","審査はどのように行われますか？","どのような経費が補助対象になりますか？"]}'),
  datetime('now'), datetime('now', '+90 days')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-DAIKIBO-SEICHOU-05-20260208',
  'DAIKIBO-SEICHOU-05', 'DAIKIBO-SEICHOU-05',
  '2026-02-08T00:00:00Z',
  json('{"subsidy_name":"大規模成長投資補助金（第5次）","amount":"最大50億円","rate":"1/3以下","investment_min":"20億円以上","status":"2026年春公募予定"}')
);

INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, verified, created_at
) VALUES (
  'link-DAIKIBO-05-cache', 'DAIKIBO-SEICHOU-05', 'manual', 'DAIKIBO-SEICHOU-05', 'system', 1, datetime('now')
);

-- モニター登録
INSERT OR IGNORE INTO data_source_monitors (
  id, source_name, source_url, monitor_type, check_interval_hours,
  url_patterns, status, created_at, updated_at
) VALUES (
  'MONITOR-DAIKIBO-SEICHOU',
  '大規模成長投資補助金 公式サイト',
  'https://seichotoushi-hojo.jp/',
  'webpage', 12,
  '[".*\\.pdf"]',
  'active', datetime('now'), datetime('now')
);

-- ============================================
-- 2. 働き方改革推進支援助成金（労働時間短縮・年休促進コース）
-- ============================================
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name,
  category_codes, latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'HATARAKIKATA-ROUDOU',
  '働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）',
  'hatarakikata kaikaku suishin shienkin roudou jikan tanshuku',
  'MHLW', '厚生労働省',
  '["employment","workstyle"]',
  'HATARAKIKATA-ROUDOU', 'snapshot-HATARAKIKATA-ROUDOU-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_mode, detail_score,
  canonical_id, detail_json, cached_at, expires_at
) VALUES (
  'HATARAKIKATA-ROUDOU', 'manual',
  '働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）',
  7300000, '3/4（一部4/5）',
  '全国', '2025-04-01T00:00:00Z', '2025-11-28T00:00:00Z',
  1, 0, 1, 1, 1, 85,
  'HATARAKIKATA-ROUDOU',
  json('{"subsidy_name":"働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）","subsidy_amount":"最大730万円（成果目標達成+賃上げ加算含む）","subsidy_rate":"3/4（事業規模30人以下は4/5）","target_audience":"中小企業事業主（労働者災害補償保険の適用事業主）","purpose":"時間外労働の上限規制への対応、年次有給休暇の取得促進","eligible_actions":["労務管理担当者に対する研修","労働者に対する研修、周知・啓発","外部専門家によるコンサルティング","就業規則・労使協定等の作成・変更","人材確保に向けた取組","労務管理用ソフトウェア・機器の導入・更新","テレワーク用通信機器の導入・更新","労働能率の増進に資する設備・機器等の導入・更新"],"goals":["月60時間超の時間外労働の引下げ","年次有給休暇の計画的付与制度の新規導入","時間単位年次有給休暇制度の新規導入","特別休暇の新規導入"],"wage_bonus":"賃上げ3%以上で1人2万円加算（上限60万円）、5%以上で1人8万円加算（上限240万円）","application_period":"令和7年4月1日～令和7年11月28日（予算に制約あり早期終了の可能性）","schedule":{"令和8年度":"令和8年4月以降に受付開始見込み"},"official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html","pdf_urls":["https://www.mhlw.go.jp/content/001486533.pdf"],"notes":"令和7年度は11月28日で受付終了済。令和8年度は4月以降に新年度の公募開始見込み。予算がなくなり次第終了。","wall_chat_questions":["働き方改革推進支援助成金の申請期限はいつですか？","最大でいくらまで助成されますか？","どのような取り組みが対象ですか？","賃上げ加算とは何ですか？","年次有給休暇の計画的付与制度とは？","時間単位年休制度の導入で助成金はもらえますか？","申請に必要な書類は何ですか？","成果目標を達成できなかった場合はどうなりますか？"]}'),
  datetime('now'), datetime('now', '+90 days')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-HATARAKIKATA-ROUDOU-20260208',
  'HATARAKIKATA-ROUDOU', 'HATARAKIKATA-ROUDOU',
  '2026-02-08T00:00:00Z',
  json('{"subsidy_name":"働き方改革推進支援助成金（労働時間短縮・年休促進）","amount":"最大730万円","rate":"3/4","status":"令和7年度受付終了、令和8年度4月以降開始見込み"}')
);

INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, verified, created_at
) VALUES (
  'link-HATARAKIKATA-ROUDOU-cache', 'HATARAKIKATA-ROUDOU', 'manual', 'HATARAKIKATA-ROUDOU', 'system', 1, datetime('now')
);

-- ============================================
-- 3. 働き方改革推進支援助成金（勤務間インターバル導入コース）
-- ============================================
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name,
  category_codes, latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'HATARAKIKATA-INTERVAL',
  '働き方改革推進支援助成金（勤務間インターバル導入コース）',
  'hatarakikata kaikaku kinmukan interval donyu',
  'MHLW', '厚生労働省',
  '["employment","workstyle"]',
  'HATARAKIKATA-INTERVAL', 'snapshot-HATARAKIKATA-INTERVAL-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_mode, detail_score,
  canonical_id, detail_json, cached_at, expires_at
) VALUES (
  'HATARAKIKATA-INTERVAL', 'manual',
  '働き方改革推進支援助成金（勤務間インターバル導入コース）',
  3400000, '3/4（一部4/5）',
  '全国', '2025-04-01T00:00:00Z', '2025-11-28T00:00:00Z',
  1, 0, 1, 1, 1, 80,
  'HATARAKIKATA-INTERVAL',
  json('{"subsidy_name":"働き方改革推進支援助成金（勤務間インターバル導入コース）","subsidy_amount":"最大340万円（成果目標達成+賃上げ加算含む）","subsidy_rate":"3/4（事業規模30人以下は4/5）","target_audience":"中小企業事業主","purpose":"勤務終了後から次の勤務までに一定時間以上の休息時間（インターバル）を設ける制度の導入","goals":["新規にインターバル時間数が9時間以上11時間未満の規定を導入：上限80万円","新規にインターバル時間数が11時間以上の規定を導入：上限100万円","既にインターバルを導入済で対象範囲拡大・時間延長：上限50万円"],"wage_bonus":"賃上げ3%以上で1人2万円加算（上限60万円）、5%以上で1人8万円加算（上限240万円）","application_period":"令和7年4月1日～令和7年11月28日（令和7年度）","schedule":{"令和8年度":"令和8年4月以降に受付開始見込み"},"official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000150891.html","notes":"令和7年度は11月28日で受付終了済。令和8年度は4月以降の公募開始見込み。","wall_chat_questions":["勤務間インターバル制度とは何ですか？","助成金の上限額はいくらですか？","9時間と11時間で助成額は変わりますか？","既にインターバル制度がある場合も使えますか？","賃上げ加算はどのくらいですか？","申請期限はいつですか？"]}'),
  datetime('now'), datetime('now', '+90 days')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-HATARAKIKATA-INTERVAL-20260208',
  'HATARAKIKATA-INTERVAL', 'HATARAKIKATA-INTERVAL',
  '2026-02-08T00:00:00Z',
  json('{"subsidy_name":"働き方改革推進支援助成金（勤務間インターバル導入コース）","amount":"最大340万円","rate":"3/4","status":"令和7年度受付終了、令和8年度4月以降開始見込み"}')
);

INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, verified, created_at
) VALUES (
  'link-HATARAKIKATA-INTERVAL-cache', 'HATARAKIKATA-INTERVAL', 'manual', 'HATARAKIKATA-INTERVAL', 'system', 1, datetime('now')
);

-- ============================================
-- 4. 65歳超雇用推進助成金（高年齢者無期雇用転換コース）
-- ============================================
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name,
  category_codes, latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'KOUREISHA-MUKI',
  '65歳超雇用推進助成金（高年齢者無期雇用転換コース）',
  '65sai chou koyou suishin joseikin kounenreisha muki koyou tenkan',
  'MHLW-JEED', '厚生労働省・高齢・障害・求職者雇用支援機構',
  '["employment","senior"]',
  'KOUREISHA-MUKI', 'snapshot-KOUREISHA-MUKI-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_mode, detail_score,
  canonical_id, detail_json, cached_at, expires_at
) VALUES (
  'KOUREISHA-MUKI', 'manual',
  '65歳超雇用推進助成金（高年齢者無期雇用転換コース）',
  300000, '定額',
  '全国', '2025-04-01T00:00:00Z', '2026-03-31T00:00:00Z',
  1, 0, 1, 1, 1, 80,
  'KOUREISHA-MUKI',
  json('{"subsidy_name":"65歳超雇用推進助成金（高年齢者無期雇用転換コース）","subsidy_amount":"1人あたり30万円（中小企業）、23万円（中小企業以外）","subsidy_rate":"定額","target_audience":"50歳以上かつ定年年齢未満の有期契約労働者を無期雇用に転換する事業主","purpose":"高年齢者の雇用安定と就労機会確保","requirements":["無期雇用転換計画書の認定を受けること","計画期間内に対象労働者を無期雇用に転換すること","転換後6ヶ月以上継続雇用すること"],"limit_per_year":"1適用事業所あたり年間10人まで","application_flow":["1. 無期雇用転換計画書を作成し、JEED各都道府県支部に提出","2. 計画の認定を受ける","3. 計画に沿って無期雇用転換を実施","4. 転換後6ヶ月経過後に支給申請"],"official_url":"https://www.jeed.go.jp/elderly/subsidy/subsidy_muki.html","notes":"通年受付。計画書は転換計画開始日の6ヶ月前から3ヶ月前までに提出が必要。","wall_chat_questions":["65歳超雇用推進助成金はいくらもらえますか？","対象となる労働者の条件は？","年間何人まで対象ですか？","申請の流れを教えてください","無期雇用転換計画書とは？","計画書の提出期限はありますか？"]}'),
  datetime('now'), datetime('now', '+90 days')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-KOUREISHA-MUKI-20260208',
  'KOUREISHA-MUKI', 'KOUREISHA-MUKI',
  '2026-02-08T00:00:00Z',
  json('{"subsidy_name":"65歳超雇用推進助成金（高年齢者無期雇用転換コース）","amount":"1人30万円","status":"通年受付中"}')
);

INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, verified, created_at
) VALUES (
  'link-KOUREISHA-MUKI-cache', 'KOUREISHA-MUKI', 'manual', 'KOUREISHA-MUKI', 'system', 1, datetime('now')
);

-- ============================================
-- 5. トライアル雇用助成金（一般トライアルコース）
-- ============================================
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name,
  category_codes, latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'TRIAL-KOYOU-IPPAN',
  'トライアル雇用助成金（一般トライアルコース）',
  'trial koyou joseikin ippan',
  'MHLW', '厚生労働省',
  '["employment","hiring"]',
  'TRIAL-KOYOU-IPPAN', 'snapshot-TRIAL-KOYOU-IPPAN-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_mode, detail_score,
  canonical_id, detail_json, cached_at, expires_at
) VALUES (
  'TRIAL-KOYOU-IPPAN', 'manual',
  'トライアル雇用助成金（一般トライアルコース）',
  120000, '定額',
  '全国', '2025-04-01T00:00:00Z', '2026-03-31T00:00:00Z',
  1, 0, 1, 1, 1, 80,
  'TRIAL-KOYOU-IPPAN',
  json('{"subsidy_name":"トライアル雇用助成金（一般トライアルコース）","subsidy_amount":"1人あたり月額最大4万円×最長3ヶ月（合計最大12万円）","subsidy_rate":"定額","target_audience":"職業経験の不足等により就職が困難な求職者を試行的に雇い入れる事業主","purpose":"トライアル雇用（原則3ヶ月）を通じた常用雇用への移行促進","target_workers":["2年以内に2回以上離職・転職を繰り返している者","離職している期間が1年を超えている者","妊娠・出産・育児を理由に離職し安定した職業に就いていない期間が1年超の者","ニートやフリーターなど55歳未満で安定した職業に就いていない者","特別な配慮が必要な者（生活困窮者、ホームレス等）"],"trial_period":"原則3ヶ月","flow":["1. ハローワーク等の紹介で求職者を原則3ヶ月のトライアル雇用で雇い入れ","2. トライアル雇用開始日から2週間以内に実施計画書を提出","3. トライアル雇用期間終了後2ヶ月以内に支給申請"],"mother_child_bonus":"母子家庭の母・父子家庭の父の場合は月額5万円","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/trial_koyou.html","notes":"通年受付。ハローワーク等の紹介が必要。常用雇用への移行率は約80%。","wall_chat_questions":["トライアル雇用助成金はいくらもらえますか？","対象となる求職者の条件は？","トライアル期間は何ヶ月ですか？","母子家庭の場合の加算はありますか？","申請の流れを教えてください","ハローワークの紹介が必要ですか？"]}'),
  datetime('now'), datetime('now', '+90 days')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-TRIAL-KOYOU-IPPAN-20260208',
  'TRIAL-KOYOU-IPPAN', 'TRIAL-KOYOU-IPPAN',
  '2026-02-08T00:00:00Z',
  json('{"subsidy_name":"トライアル雇用助成金（一般トライアル）","amount":"月4万円×3ヶ月","status":"通年受付中"}')
);

INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, verified, created_at
) VALUES (
  'link-TRIAL-KOYOU-IPPAN-cache', 'TRIAL-KOYOU-IPPAN', 'manual', 'TRIAL-KOYOU-IPPAN', 'system', 1, datetime('now')
);

-- ============================================
-- 6. SHINJIGYO-MONO-2026 canonical整備 + detail_json充実
-- ============================================
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name,
  category_codes, latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'SHINJIGYO-MONO-2026',
  '新事業進出・ものづくり補助金（2026年度統合版）',
  'shinjigyo shinshutsu monodukuri hojokin 2026 tougou',
  'METI-SMRJ', '経済産業省・中小企業基盤整備機構',
  '["business","manufacturing","innovation"]',
  'SHINJIGYO-MONO-2026', 'snapshot-SHINJIGYO-MONO-2026-20260208',
  1, datetime('now'), datetime('now')
);

UPDATE subsidy_cache SET
  canonical_id = 'SHINJIGYO-MONO-2026',
  detail_score = 90,
  wall_chat_ready = 1,
  detail_json = json('{"subsidy_name":"新事業進出・ものづくり補助金（2026年度統合版）","subsidy_amount":"最大9,000万円（グローバル枠は最大7,000万円）","subsidy_rate":"1/2（小規模は2/3）","target_audience":"中小企業・小規模事業者","purpose":"新事業進出補助金とものづくり補助金の2026年度統合再編。新市場進出・高付加価値化・グローバル展開を支援","expected_categories":["省力化・生産性向上枠","新市場進出枠（旧新事業進出）","高付加価値化枠","グローバル枠（上限7,000万円）"],"schedule":{"現行最終":"ものづくり第23次（申請：4/3～5/8）、新事業進出第3回（～3/26）","統合版":"2026年度後半に第1回公募開始見込み"},"current_status":"2026年度予算で統合が予定されているが、まず現行制度の最終公募が先行。統合版の詳細は令和8年度予算成立後に公表予定。","transition_notes":"ものづくり補助金第23次・新事業進出補助金第3回が現行最終公募。統合後は枠組みが大幅に変更される見込み。","official_urls":["https://portal.monodukuri-hojo.jp/","https://shinjigyou-shinshutsu.smrj.go.jp/"],"notes":"ものづくり補助金と新事業進出補助金が2026年度から統合再編予定。グローバル枠は最大7,000万円に拡充。現行制度への申請を検討中の方は早めに対応を。","wall_chat_questions":["ものづくり補助金と新事業進出補助金の統合はいつですか？","統合後の補助上限額はいくらですか？","グローバル枠はどう変わりますか？","現行制度の最終公募はいつですか？","統合前と統合後、どちらに申請すべきですか？","省力化枠はどのような内容ですか？","申請要件は変わりますか？"]}'),
  cached_at = datetime('now')
WHERE id = 'SHINJIGYO-MONO-2026';

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, source_link_id, snapshot_at, detail_json
) VALUES (
  'snapshot-SHINJIGYO-MONO-2026-20260208',
  'SHINJIGYO-MONO-2026', 'SHINJIGYO-MONO-2026',
  '2026-02-08T00:00:00Z',
  json('{"subsidy_name":"新事業進出・ものづくり補助金（2026年度統合版）","amount":"最大9,000万円","status":"2026年度後半に公募開始見込み"}')
);

INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, verified, created_at
) VALUES (
  'link-SHINJIGYO-MONO-2026-cache', 'SHINJIGYO-MONO-2026', 'manual', 'SHINJIGYO-MONO-2026', 'system', 1, datetime('now')
);

-- ============================================
-- 7. 既存補助金のcanonical_id未設定を一括修正
-- ============================================
UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-TSUJYO'
WHERE id = 'IT-SUBSIDY-2026-TSUJYO' AND canonical_id IS NULL;

UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-DENSHI'
WHERE id = 'IT-SUBSIDY-2026-DENSHI' AND canonical_id IS NULL;

UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-INVOICE'
WHERE id = 'IT-SUBSIDY-2026-INVOICE' AND canonical_id IS NULL;

UPDATE subsidy_cache SET canonical_id = 'IT-SUBSIDY-2026-FUKUSU'
WHERE id = 'IT-SUBSIDY-2026-FUKUSU' AND canonical_id IS NULL;

-- ============================================
-- 8. モニター追加（厚労省系助成金ページ）
-- ============================================
INSERT OR IGNORE INTO data_source_monitors (
  id, source_name, source_url, monitor_type, check_interval_hours,
  url_patterns, status, created_at, updated_at
) VALUES (
  'MONITOR-HATARAKIKATA-MHLW',
  '厚生労働省 働き方改革推進支援助成金ページ',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html',
  'webpage', 24,
  '[".*\\.pdf"]',
  'active', datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO data_source_monitors (
  id, source_name, source_url, monitor_type, check_interval_hours,
  url_patterns, status, created_at, updated_at
) VALUES (
  'MONITOR-TRIAL-KOYOU-MHLW',
  '厚生労働省 トライアル雇用助成金ページ',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/trial_koyou.html',
  'webpage', 24,
  '[".*\\.pdf"]',
  'active', datetime('now'), datetime('now')
);

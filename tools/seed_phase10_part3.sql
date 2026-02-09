-- Phase 10 Part 3: 新規50件（#337〜#386）
-- カテゴリ: 医療・ヘルスケア追加、スポーツ・文化芸術追加、教育・人材追加、
--           災害復旧・防災追加、環境・水・下水道追加、地方創生・過疎対策

-- ====== 1. 医療・ヘルスケア追加 (8件) ======

-- #337 医療施設耐震化臨時特例交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('IRYOU-TAISHIN', '医療施設耐震化臨時特例交付金', 'MHLW', '厚生労働省', '00', '["subsidy","health","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('IRYOU-TAISHIN', 'manual', '医療施設耐震化臨時特例交付金', 100000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"災害拠点病院・救命救急センター等の耐震化を緊急的に支援","target":"災害拠点病院、救命救急センター等の医療機関","amount":"耐震補強：補助率2/3、建替え：補助率2/3（上限あり）","period":"令和8年度","application":"都道府県を通じて厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/","source":"厚生労働省","requirements":["Is値0.6未満の医療施設","災害拠点病院又は救命救急センター","耐震化計画の策定"],"documents":["耐震診断結果","耐震化計画書","設計図書","資金計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'IRYOU-TAISHIN', 1);

-- #338 地域医療介護総合確保基金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-IRYOU-KIKIN', '地域医療介護総合確保基金', 'MHLW', '厚生労働省', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-IRYOU-KIKIN', 'manual', '地域医療介護総合確保基金', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域医療構想の実現、医療従事者の確保・養成、在宅医療の推進等を総合的に支援する基金","target":"医療機関、介護事業所、都道府県","amount":"各都道府県の計画に基づき配分（国2/3、都道府県1/3）","period":"令和8年度","application":"各都道府県に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000060713.html","source":"厚生労働省","requirements":["都道府県の地域医療構想に基づく事業","医療・介護の連携推進","人材確保・養成の取組"],"documents":["事業計画書","都道府県計画との整合確認","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-IRYOU-KIKIN', 1);

-- #339 オンライン診療推進支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ONLINE-SHINRYOU', 'オンライン診療推進支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","health","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ONLINE-SHINRYOU', 'manual', 'オンライン診療推進支援事業', 3000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"医療機関におけるオンライン診療システムの導入費用を支援","target":"病院・診療所","amount":"上限300万円（補助率1/2）","period":"令和8年度","application":"各都道府県を通じて申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/rinsyo/","source":"厚生労働省","requirements":["オンライン診療を新たに開始","オンライン診療の適切な実施に関する指針の遵守","医師のオンライン診療研修受講"],"documents":["導入計画書","システム仕様書","見積書","研修修了証"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ONLINE-SHINRYOU', 1);

-- #340 医療的ケア児支援体制整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('IRYOUTEKI-CARE', '医療的ケア児支援体制整備事業', 'CFA', 'こども家庭庁', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('IRYOUTEKI-CARE', 'manual', '医療的ケア児支援体制整備事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"医療的ケアが必要な児童の支援体制（コーディネーター配置・研修等）を整備","target":"都道府県、市区町村","amount":"コーディネーター配置：1人あたり約600万円、研修実施費等","period":"令和8年度","application":"都道府県・市区町村を通じて申請","url":"https://www.cfa.go.jp/policies/shougaijishien/","source":"こども家庭庁","requirements":["医療的ケア児支援法に基づく体制整備","医療的ケア児等コーディネーターの配置","関係機関との連携体制"],"documents":["体制整備計画書","コーディネーター配置計画","連携体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'IRYOUTEKI-CARE', 1);

-- #341 再生医療等安全性確保法関連支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAISEI-IRYOU', '再生医療・細胞治療産業化促進事業', 'MHLW', '厚生労働省', '00', '["subsidy","health","research"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAISEI-IRYOU', 'manual', '再生医療・細胞治療産業化促進事業', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"iPS細胞等を用いた再生医療の産業化・実用化を支援するAMED事業","target":"大学、研究機関、製薬企業","amount":"1課題あたり数千万円〜数億円","period":"令和8年度","application":"AMED（日本医療研究開発機構）に申請","url":"https://www.amed.go.jp/program/list/02/01/saisei.html","source":"厚生労働省（AMED）","requirements":["再生医療等の実用化に資する研究","安全性・有効性の確認","産業化への道筋"],"documents":["研究開発計画書","安全性評価計画","産業化計画書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAISEI-IRYOU', 1);

-- #342 創薬ベンチャー支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SOUYAKU-VENTURE', '創薬ベンチャー支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","health","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SOUYAKU-VENTURE', 'manual', '創薬ベンチャー支援事業（AMED CiCLE等）', 500000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"創薬ベンチャーの臨床試験（治験）段階の資金支援により新薬開発を加速","target":"創薬ベンチャー企業","amount":"1課題あたり数億円（治験段階の支援）","period":"令和8年度","application":"AMED（CiCLE事業）に申請","url":"https://www.amed.go.jp/program/list/02/01/cicle.html","source":"厚生労働省（AMED）","requirements":["有望な新薬候補を有するベンチャー","臨床試験（Phase I〜III）の実施計画","事業化・上市計画"],"documents":["治験計画書","非臨床試験データ","事業化計画","資金計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SOUYAKU-VENTURE', 1);

-- #343 健康経営優良法人認定制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KENKOU-KEIEI', '健康経営優良法人認定制度', 'METI', '経済産業省', '00', '["certification","health","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KENKOU-KEIEI', 'manual', '健康経営優良法人認定制度（ホワイト500等）', NULL, '認定制度', '全国', '2026-08-01', '2026-10-31',
'{"overview":"従業員の健康管理を経営的視点から実践する法人を認定し、インセンティブを提供","target":"全法人（大規模法人・中小規模法人）","amount":"認定による金融機関の融資優遇、自治体の入札加点等の間接メリット","period":"毎年8〜10月申請、翌3月認定","application":"日本健康会議（ACTION!健康経営ポータル）","url":"https://kenko-keiei.jp/","source":"経済産業省","requirements":["健康経営の取組実施","健康診断受診率の向上","メンタルヘルス対策の実施"],"documents":["健康経営度調査票","健康診断実施状況","ストレスチェック実施結果"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KENKOU-KEIEI', 1);

-- #344 ヘルスケア産業創出支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HEALTHCARE-SOUSHUTU', 'ヘルスケア産業創出支援事業', 'METI', '経済産業省', '00', '["subsidy","health","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HEALTHCARE-SOUSHUTU', 'manual', 'ヘルスケア産業創出支援事業', 20000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"予防・健康管理サービス等のヘルスケア産業の新規参入・事業化を支援","target":"ヘルスケア分野に参入する企業・スタートアップ","amount":"上限2,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/mono_info_service/healthcare/","source":"経済産業省","requirements":["ヘルスケアサービスの新規開発","科学的エビデンスに基づくサービス設計","事業化の見込み"],"documents":["事業計画書","エビデンス資料","収支計画書","サービス設計書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HEALTHCARE-SOUSHUTU', 1);

-- ====== 2. スポーツ・文化芸術追加 (6件) ======

-- #345 スポーツ振興くじ助成（toto助成）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOTO-JOSEI', 'スポーツ振興くじ助成（toto助成）', 'JSA', '日本スポーツ振興センター', '00', '["subsidy","sports"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOTO-JOSEI', 'manual', 'スポーツ振興くじ助成（toto助成・地域スポーツ施設整備等）', 30000000, '2/3', '全国', '2026-06-01', '2026-09-30',
'{"overview":"スポーツ振興くじ（toto・BIG）の収益を活用し、地域スポーツ施設整備・活動支援を助成","target":"地方公共団体、スポーツ団体、総合型地域スポーツクラブ","amount":"施設整備：上限3,000万円、活動助成：上限数百万円（補助率2/3）","period":"毎年6〜9月頃公募","application":"日本スポーツ振興センター（JSC）に申請","url":"https://www.jpnsport.go.jp/sinko/","source":"日本スポーツ振興センター","requirements":["スポーツの振興に資する事業","地域住民の利用に供する施設","団体の運営基盤の健全性"],"documents":["助成金申請書","事業計画書","予算書","団体概要"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOTO-JOSEI', 1);

-- #346 障害者スポーツ推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUGAI-SPORTS', '障害者スポーツ推進プロジェクト', 'SA', 'スポーツ庁', '00', '["subsidy","sports","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUGAI-SPORTS', 'manual', '障害者スポーツ推進プロジェクト', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"障害者のスポーツ参加機会の拡大、指導者育成、施設のバリアフリー化等を支援","target":"地方公共団体、障害者スポーツ団体、スポーツ施設","amount":"上限1,000万円","period":"令和8年度","application":"スポーツ庁に申請","url":"https://www.mext.go.jp/sports/b_menu/sports/mcatetop10/","source":"スポーツ庁","requirements":["障害者のスポーツ参加促進","指導者・ボランティアの育成","施設のバリアフリー化"],"documents":["事業計画書","対象者見込み","予算書","施設概要"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUGAI-SPORTS', 1);

-- #347 文化芸術振興費補助金（芸術文化活動支援）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUNKA-SHINKOU', '文化芸術振興費補助金（芸術文化活動支援）', 'ACA', '文化庁', '00', '["subsidy","culture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUNKA-SHINKOU', 'manual', '文化芸術振興費補助金（芸術文化活動支援）', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"舞台芸術・音楽・美術等の文化芸術活動の創造・発信を支援","target":"芸術文化団体、NPO法人、実行委員会","amount":"上限3,000万円","period":"令和8年度","application":"文化庁に申請","url":"https://www.bunka.go.jp/","source":"文化庁","requirements":["芸術文化の創造・発信に資する事業","公演・展示等の公開","事業の継続性・発展性"],"documents":["事業計画書","公演プログラム","出演者一覧","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUNKA-SHINKOU', 1);

-- #348 日本映画製作支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('EIGA-SEISAKU', '日本映画製作支援事業', 'ACA', '文化庁', '00', '["subsidy","culture","contents"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('EIGA-SEISAKU', 'manual', '日本映画製作支援事業（日本映画の海外展開等）', 50000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本映画の製作・海外展開を支援し、日本の映画産業の競争力強化を図る","target":"映画製作会社、映画監督、プロデューサー","amount":"上限5,000万円（補助率1/2）","period":"令和8年度","application":"文化庁（VIPO等の事務局）に申請","url":"https://www.bunka.go.jp/","source":"文化庁","requirements":["日本映画の製作又は海外展開","芸術性・文化的価値","国際映画祭への出品計画"],"documents":["製作計画書","脚本","スタッフ・キャスト一覧","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'EIGA-SEISAKU', 1);

-- #349 メディア芸術ナショナルセンター整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MEDIA-GEIJUTSU', 'メディア芸術活用・発信支援事業', 'ACA', '文化庁', '00', '["subsidy","culture","contents"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MEDIA-GEIJUTSU', 'manual', 'メディア芸術活用・発信支援事業（アニメ・マンガ・ゲーム等）', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"アニメ・マンガ・ゲーム等のメディア芸術の保存・活用・海外発信を支援","target":"メディア芸術関連団体、美術館・博物館、制作会社","amount":"上限2,000万円","period":"令和8年度","application":"文化庁に申請","url":"https://www.bunka.go.jp/","source":"文化庁","requirements":["メディア芸術の保存・活用に資する事業","アーカイブの構築","国際発信の取組"],"documents":["事業計画書","アーカイブ計画","展示計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MEDIA-GEIJUTSU', 1);

-- #350 文化財保存活用地域計画支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUNKAZAI-CHIIKI', '文化財保存活用地域計画支援事業', 'ACA', '文化庁', '00', '["subsidy","culture","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUNKAZAI-CHIIKI', 'manual', '文化財保存活用地域計画支援事業', 50000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域の文化財を総合的に保存・活用する計画策定及び計画に基づく事業を支援","target":"市区町村、文化財所有者","amount":"計画策定：上限500万円、事業実施：上限5,000万円（補助率1/2）","period":"令和8年度","application":"文化庁に申請","url":"https://www.bunka.go.jp/","source":"文化庁","requirements":["文化財保存活用地域計画の策定・認定","文化財の適切な保存管理","観光・まちづくりとの連携"],"documents":["地域計画書","文化財リスト","活用計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUNKAZAI-CHIIKI', 1);

-- ====== 3. 教育・人材育成追加 (8件) ======

-- #351 GIGAスクール構想推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GIGA-SCHOOL', 'GIGAスクール構想推進事業', 'MEXT', '文部科学省', '00', '["subsidy","education","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GIGA-SCHOOL', 'manual', 'GIGAスクール構想推進事業（1人1台端末更新等）', 55000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"児童生徒1人1台端末の更新・ネットワーク環境整備を支援するGIGAスクール構想の第2期","target":"地方公共団体（教育委員会）","amount":"端末1台あたり最大5.5万円の補助","period":"令和8年度","application":"文部科学省に申請","url":"https://www.mext.go.jp/a_menu/other/index_00001.htm","source":"文部科学省","requirements":["1人1台端末の計画的な更新","校内LAN環境の整備","教育DXの推進計画"],"documents":["端末整備計画書","ネットワーク整備計画","教育DX推進計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GIGA-SCHOOL', 1);

-- #352 リカレント教育推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RECURRENT-EDU', 'リカレント教育推進事業', 'MEXT', '文部科学省', '00', '["subsidy","education","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RECURRENT-EDU', 'manual', 'リカレント教育推進事業（社会人の学び直し）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"大学・専門学校等における社会人向けリカレント教育プログラムの開発・実施を支援","target":"大学、専門学校、教育機関","amount":"上限1,000万円","period":"令和8年度","application":"文部科学省に申請","url":"https://www.mext.go.jp/a_menu/ikusei/manabinaoshi/","source":"文部科学省","requirements":["社会人向けの教育プログラム開発","産業界のニーズに対応したカリキュラム","デジタル・DX分野の教育コンテンツ"],"documents":["プログラム開発計画書","カリキュラム概要","産業界との連携計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RECURRENT-EDU', 1);

-- #353 教育訓練給付金（専門実践）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KYOIKU-KUNREN-KYUFU', '教育訓練給付金（専門実践教育訓練）', 'MHLW', '厚生労働省', '00', '["subsidy","education","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KYOIKU-KUNREN-KYUFU', 'manual', '教育訓練給付金（専門実践教育訓練給付）', 560000, '最大70%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"厚労大臣指定の専門実践教育訓練講座の受講費用の最大70%を給付","target":"雇用保険の被保険者又は被保険者であった方","amount":"受講費用の50%（年間上限40万円）＋資格取得時20%追加（年間上限56万円）","period":"通年","application":"ハローワークに申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/kyouiku.html","source":"厚生労働省","requirements":["雇用保険の被保険者期間3年以上（初回は1年以上）","厚労大臣指定の講座受講","受講前にキャリアコンサルティングを受ける"],"documents":["教育訓練給付金支給申請書","受講証明書","領収書","資格取得証明（追加給付時）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KYOIKU-KUNREN-KYUFU', 1);

-- #354 高等職業訓練促進給付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOUTOU-KUNREN-KYUFU', '高等職業訓練促進給付金', 'MHLW', '厚生労働省', '00', '["subsidy","education","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOUTOU-KUNREN-KYUFU', 'manual', '高等職業訓練促進給付金（ひとり親向け）', 1400000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"ひとり親家庭の親が看護師等の資格取得のため修業する期間中の生活費を支給","target":"ひとり親家庭の父又は母","amount":"市民税非課税世帯：月額10万円、課税世帯：月額7万5千円（最終年は4万円増額）","period":"通年","application":"お住まいの市区町村の福祉窓口","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000062986.html","source":"厚生労働省","requirements":["ひとり親家庭の父又は母","養成機関で1年以上のカリキュラム修業","就業又は育児と修業の両立が困難"],"documents":["支給申請書","在学証明書","ひとり親証明書類","所得証明書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOUTOU-KUNREN-KYUFU', 1);

-- #355 スタートアップ創出促進保証制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('STARTUP-HOSHOU', 'スタートアップ創出促進保証制度', 'METI', '経済産業省', '00', '["finance","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('STARTUP-HOSHOU', 'manual', 'スタートアップ創出促進保証制度（経営者保証不要）', 35000000, '保証', '全国', '2026-04-01', '2027-03-31',
'{"overview":"創業時に経営者保証なしで融資を受けられる信用保証制度","target":"創業予定者及び創業後5年未満の法人・個人事業主","amount":"保証限度額3,500万円（経営者保証不要）","period":"通年","application":"金融機関を通じて信用保証協会に申請","url":"https://www.chusho.meti.go.jp/kinyu/shikinguri/startup_hosho/","source":"経済産業省","requirements":["創業予定又は創業後5年未満","創業計画書の策定","保証料率0.25%上乗せ"],"documents":["信用保証委託申込書","創業計画書","本人確認書類","開業届又は登記簿謄本"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'STARTUP-HOSHOU', 1);

-- #356 デジタル人材育成プラットフォーム事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DIGITAL-JINZAI-PF', 'デジタル人材育成プラットフォーム事業', 'METI', '経済産業省', '00', '["subsidy","digital","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DIGITAL-JINZAI-PF', 'manual', 'デジタル人材育成プラットフォーム事業（マナビDX等）', NULL, '無料/低額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"デジタルスキル習得のための学習コンテンツ・講座を提供するプラットフォーム","target":"デジタルスキルを習得したい個人・企業","amount":"無料又は低額の学習コンテンツ提供","period":"通年","application":"マナビDXポータルサイトからアクセス","url":"https://manabi-dx.ipa.go.jp/","source":"経済産業省・IPA","requirements":["特になし（誰でも利用可能）","DXリテラシー標準に準拠した学習","修了証の取得"],"documents":["特に不要（オンラインで利用登録）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DIGITAL-JINZAI-PF', 1);

-- #357 女性活躍推進法関連支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JOSEI-KATSUYAKU', '女性活躍推進法関連支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JOSEI-KATSUYAKU', 'manual', '女性活躍推進法関連支援事業（えるぼし認定等）', 600000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"女性活躍推進法に基づく行動計画策定・えるぼし認定取得を支援し、女性の活躍促進を図る","target":"女性活躍推進に取り組む中小企業","amount":"えるぼし認定取得企業への両立支援等助成金：最大60万円","period":"通年","application":"都道府県労働局に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000091025.html","source":"厚生労働省","requirements":["女性活躍推進法に基づく行動計画の策定・届出","えるぼし認定の取得","女性の採用・管理職比率等の改善"],"documents":["行動計画届出書","えるぼし認定申請書","女性活躍推進データベース登録"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JOSEI-KATSUYAKU', 1);

-- #358 外国人材受入れ環境整備交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GAIKOKUJIN-KANKYOU', '外国人材受入れ環境整備交付金', 'MOJ', '法務省', '00', '["subsidy","employment","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GAIKOKUJIN-KANKYOU', 'manual', '外国人材受入れ環境整備交付金（一元的相談窓口等）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"外国人住民向けの多言語相談窓口（一元的相談窓口）の設置・運営を支援","target":"地方公共団体","amount":"相談窓口運営費：上限1,000万円程度","period":"令和8年度","application":"出入国在留管理庁に申請","url":"https://www.moj.go.jp/isa/policies/coexistence/04_00017.html","source":"法務省出入国在留管理庁","requirements":["外国人向け一元的相談窓口の設置","多言語対応体制","関係機関との連携"],"documents":["交付申請書","運営計画書","多言語対応計画","連携体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GAIKOKUJIN-KANKYOU', 1);

-- ====== 4. 災害復旧・防災追加 (8件) ======

-- #359 被災中小企業復旧支援補助金（グループ補助金）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GROUP-HUKKYUU', '被災中小企業復旧支援補助金（グループ補助金）', 'METI', '経済産業省', '00', '["subsidy","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GROUP-HUKKYUU', 'manual', '中小企業等グループ施設等復旧整備補助事業（グループ補助金）', 1500000000, '3/4', '全国', NULL, NULL,
'{"overview":"自然災害により被災した中小企業グループの施設・設備の復旧を支援（災害発生時に発動）","target":"被災した中小企業グループ","amount":"補助率3/4（国1/2、県1/4）、上限は災害規模により設定","period":"大規模災害発生時に随時発動","application":"被災県を通じて申請","url":"https://www.chusho.meti.go.jp/earthquake/index.html","source":"経済産業省","requirements":["激甚災害等の指定を受けた地域","復興事業計画を策定したグループ","地域経済の核となる企業グループ"],"documents":["復興事業計画書","被害状況証明","見積書","グループ構成員一覧"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GROUP-HUKKYUU', 1);

-- #360 防災・安全交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BOUSAI-ANZEN-KOUFUKIN', '防災・安全交付金', 'MLIT', '国土交通省', '00', '["subsidy","disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BOUSAI-ANZEN-KOUFUKIN', 'manual', '防災・安全交付金（社会資本整備総合交付金）', 500000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"インフラの老朽化対策、耐震化、浸水対策等の防災・安全に関する社会資本整備を総合的に支援","target":"地方公共団体","amount":"交付率：事業費の概ね1/2〜2/3","period":"令和8年度","application":"国土交通省に整備計画を提出","url":"https://www.mlit.go.jp/sogoseisaku/region/sogoseisaku_region_fr1_000005.html","source":"国土交通省","requirements":["社会資本総合整備計画の策定","防災・安全に関するインフラ整備","事後評価の実施"],"documents":["社会資本総合整備計画","事業計画書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BOUSAI-ANZEN-KOUFUKIN', 1);

-- #361 国土強靱化地域計画策定支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOKUDO-CHIIKI-KEIKAKU', '国土強靱化地域計画策定支援事業', 'CAO', '内閣府', '00', '["subsidy","disaster","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOKUDO-CHIIKI-KEIKAKU', 'manual', '国土強靱化地域計画策定支援事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方公共団体の国土強靱化地域計画の策定・改定を支援","target":"都道府県、市区町村","amount":"上限1,000万円","period":"令和8年度","application":"内閣官房国土強靱化推進室に申請","url":"https://www.cas.go.jp/jp/seisaku/kokudo_kyoujinka/","source":"内閣府","requirements":["国土強靱化地域計画の策定又は改定","リスクシナリオの分析","脆弱性評価の実施"],"documents":["計画策定・改定方針","リスクシナリオ分析資料","脆弱性評価書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOKUDO-CHIIKI-KEIKAKU', 1);

-- #362 被災者生活再建支援金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HISAISHA-SAIKEN', '被災者生活再建支援金', 'CAO', '内閣府', '00', '["subsidy","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HISAISHA-SAIKEN', 'manual', '被災者生活再建支援金（自然災害時）', 3000000, '定額', '全国', NULL, NULL,
'{"overview":"自然災害により住宅が全壊等の被害を受けた世帯に対し、生活再建のための支援金を支給","target":"自然災害で住宅が全壊・大規模半壊等の被害を受けた世帯","amount":"基礎支援金：最大100万円＋加算支援金：最大200万円（合計最大300万円）","period":"自然災害発生時に随時","application":"被災市区町村に申請","url":"https://www.bousai.go.jp/taisaku/seikatsusaiken/","source":"内閣府","requirements":["自然災害による住宅被害","罹災証明書の取得","被災者生活再建支援法の適用地域"],"documents":["支給申請書","罹災証明書","住民票","預金通帳の写し"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HISAISHA-SAIKEN', 1);

-- #363 災害廃棄物処理事業補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAIGAI-HAIKIBUTSU', '災害廃棄物処理事業補助金', 'MOE', '環境省', '00', '["subsidy","disaster","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAIGAI-HAIKIBUTSU', 'manual', '災害廃棄物処理事業補助金', NULL, '1/2', '全国', NULL, NULL,
'{"overview":"自然災害により発生した災害廃棄物（がれき等）の処理費用を補助","target":"市区町村","amount":"処理費用の1/2（特別交付税と合わせて実質95%以上を国が負担）","period":"災害発生時に随時","application":"環境省に申請","url":"https://www.env.go.jp/recycle/waste/disaster/","source":"環境省","requirements":["自然災害による廃棄物の発生","災害廃棄物処理計画に基づく処理","適切な分別・リサイクルの実施"],"documents":["補助金交付申請書","災害廃棄物量の推計","処理計画書","費用見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAIGAI-HAIKIBUTSU', 1);

-- #364 消防団活動強化・充実事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUBOUDAN-KYOUKA', '消防団活動強化・充実事業', 'FDMA', '消防庁', '00', '["subsidy","disaster","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUBOUDAN-KYOUKA', 'manual', '消防団の力向上モデル事業', 5000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"消防団の活性化・装備充実・人材確保に向けたモデル的取組を支援","target":"市区町村、消防団","amount":"上限500万円","period":"令和8年度","application":"消防庁に申請","url":"https://www.fdma.go.jp/relocation/syobodan/","source":"消防庁","requirements":["消防団の活性化に資する取組","装備・訓練の充実","団員確保の取組"],"documents":["事業計画書","消防団の現況","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUBOUDAN-KYOUKA', 1);

-- #365 治水事業（河川改修・ダム整備）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHISUI-JIGYOU', '治水事業（河川改修・ダム等整備）', 'MLIT', '国土交通省', '00', '["subsidy","disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHISUI-JIGYOU', 'manual', '治水事業（河川改修・ダム・遊水池等の整備）', 1000000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"洪水・浸水被害を防止するための河川改修、ダム建設、遊水池整備等を支援","target":"都道府県、市区町村","amount":"補助率1/2〜2/3（事業内容により異なる）","period":"令和8年度","application":"国土交通省水管理・国土保全局に申請","url":"https://www.mlit.go.jp/river/","source":"国土交通省","requirements":["河川整備計画に基づく事業","流域治水の考え方に沿った取組","B/C（費用便益比）1.0以上"],"documents":["河川整備計画","事業計画書","費用便益分析","環境影響評価"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHISUI-JIGYOU', 1);

-- #366 緊急浚渫推進事業（特別交付税措置）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KINKYUU-SHUNSETSU', '緊急浚渫推進事業', 'MIC', '総務省', '00', '["subsidy","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KINKYUU-SHUNSETSU', 'manual', '緊急浚渫推進事業（地方債・特別交付税措置）', NULL, '地方財政措置70%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"河川・ダム・砂防・治山施設の土砂撤去・浚渫を緊急的に推進する地方財政措置","target":"都道府県、市区町村","amount":"地方債充当率100%、交付税措置率70%","period":"令和2年度〜令和8年度","application":"総務省（地方債の許可・同意）","url":"https://www.soumu.go.jp/","source":"総務省","requirements":["河川・ダム等の堆積土砂撤去","防災・減災に資する浚渫","個別施設計画に基づく実施"],"documents":["浚渫計画書","施設の現況調査","事業費見積"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KINKYUU-SHUNSETSU', 1);

-- ====== 5. 環境・水・下水道追加 (6件) ======

-- #367 浄化槽設置整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JOUKASOU-SEIBI', '浄化槽設置整備事業', 'MOE', '環境省', '00', '["subsidy","environment","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JOUKASOU-SEIBI', 'manual', '浄化槽設置整備事業（合併処理浄化槽への転換）', 1200000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"単独処理浄化槽やくみ取り便所から合併処理浄化槽への転換を支援","target":"住宅所有者、市区町村","amount":"5人槽：33.2万円、7人槽：41.4万円、10人槽：54.8万円（国1/3）＋市区町村上乗せ","period":"令和8年度","application":"市区町村を通じて申請","url":"https://www.env.go.jp/recycle/jokaso/","source":"環境省","requirements":["合併処理浄化槽への転換","下水道予定処理区域外","適正な維持管理の実施"],"documents":["設置届出書","設計図書","見積書","設置場所の確認書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JOUKASOU-SEIBI', 1);

-- #368 PCB廃棄物処理促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('PCB-SHORI', 'PCB廃棄物処理促進事業', 'MOE', '環境省', '00', '["subsidy","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('PCB-SHORI', 'manual', 'PCB廃棄物処理促進事業（中小企業向け処理費用軽減）', NULL, '最大95%軽減', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業が保管するPCB含有機器（変圧器・コンデンサ等）の処理費用を軽減","target":"PCB廃棄物を保管する中小企業者","amount":"処理費用の70%〜95%を軽減（企業規模による）","period":"処理期限まで","application":"JESCO（中間貯蔵・環境安全事業株式会社）に申請","url":"https://www.jesconet.co.jp/","source":"環境省（JESCO）","requirements":["PCB含有機器を保管していること","中小企業者であること","法定の処理期限内に処理"],"documents":["処理委託契約書","PCB含有機器の台帳","中小企業であることの証明"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'PCB-SHORI', 1);

-- #369 二酸化炭素排出抑制対策事業費等補助金（脱炭素先行地域づくり）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DATSUTANSO-SENKOU', '脱炭素先行地域づくり事業', 'MOE', '環境省', '00', '["subsidy","environment","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DATSUTANSO-SENKOU', 'manual', '脱炭素先行地域づくり事業（地域脱炭素移行・再エネ推進交付金）', 5000000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"2030年度までに脱炭素を達成する先行地域を選定し、再エネ導入等を集中的に支援","target":"地方公共団体（脱炭素先行地域に選定された団体）","amount":"最大50億円（補助率2/3等）","period":"令和8年度","application":"環境省に計画提案書を提出","url":"https://policies.env.go.jp/policy/roadmap/preceding-region/","source":"環境省","requirements":["脱炭素先行地域への選定","2030年度までのCO2排出実質ゼロ計画","地域の合意形成"],"documents":["脱炭素先行地域計画提案書","CO2排出削減計画","再エネ導入計画","地域合意形成資料"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DATSUTANSO-SENKOU', 1);

-- #370 廃棄物処理施設整備事業（循環型社会形成推進交付金）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JUNKAN-KOUFUKIN', '循環型社会形成推進交付金', 'MOE', '環境省', '00', '["subsidy","environment","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JUNKAN-KOUFUKIN', 'manual', '循環型社会形成推進交付金（廃棄物処理施設整備）', 5000000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"ごみ処理施設（焼却施設・リサイクル施設等）の整備を支援する交付金","target":"市区町村、一部事務組合","amount":"交付率1/3（施設整備費）","period":"令和8年度","application":"環境省に申請","url":"https://www.env.go.jp/recycle/waste/3r_network/","source":"環境省","requirements":["循環型社会形成推進地域計画の策定","廃棄物の3R推進","CO2排出削減への配慮"],"documents":["地域計画","施設整備計画書","設計図書","環境影響評価書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JUNKAN-KOUFUKIN', 1);

-- #371 自然公園等整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHIZEN-KOUEN', '自然公園等整備事業', 'MOE', '環境省', '00', '["subsidy","environment","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHIZEN-KOUEN', 'manual', '自然公園等整備事業（国立公園満喫プロジェクト等）', 100000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"国立公園等の利用施設（ビジターセンター・歩道・休憩所等）の整備を支援","target":"環境省、地方公共団体、国立公園内の事業者","amount":"施設整備費の1/2以内","period":"令和8年度","application":"環境省自然環境局に申請","url":"https://www.env.go.jp/nature/nationalparks/","source":"環境省","requirements":["国立・国定公園内の施設整備","利用者の安全確保","自然環境との調和"],"documents":["整備計画書","設計図書","環境配慮書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHIZEN-KOUEN', 1);

-- #372 生物多様性保全推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SEIBUTSU-TAYOUSEI', '生物多様性保全推進事業', 'MOE', '環境省', '00', '["subsidy","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SEIBUTSU-TAYOUSEI', 'manual', '生物多様性保全推進事業（30by30目標達成）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"30by30目標（2030年までに陸域・海域の30%を保全）の達成に向けた生物多様性保全を支援","target":"地方公共団体、NPO、企業","amount":"上限1,000万円","period":"令和8年度","application":"環境省自然環境局に申請","url":"https://www.env.go.jp/nature/biodic/","source":"環境省","requirements":["生物多様性の保全に資する活動","OECM（自然共生サイト）の認定推進","モニタリングの実施"],"documents":["保全活動計画書","対象エリアの生態系調査","モニタリング計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SEIBUTSU-TAYOUSEI', 1);

-- ====== 6. 地方創生・過疎対策 (14件) ======

-- #373 地方創生推進交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIHOU-SOUSEI-KOUFUKIN', '地方創生推進交付金', 'CAO', '内閣府', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIHOU-SOUSEI-KOUFUKIN', 'manual', '地方創生推進交付金', 100000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方版総合戦略に基づく自治体の自主的・主体的な地方創生の取組を支援する交付金","target":"都道府県、市区町村","amount":"交付率1/2（事業費の1/2以内、1事業あたり上限数千万円）","period":"令和8年度","application":"内閣府に申請","url":"https://www.chisou.go.jp/sousei/about/koufukin/","source":"内閣府","requirements":["地方版総合戦略に基づく事業","KPIの設定","PDCAサイクルの実施"],"documents":["交付金実施計画書","KPI設定書","予算書","地方版総合戦略"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIHOU-SOUSEI-KOUFUKIN', 1);

-- #374 過疎地域持続的発展支援交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KASO-CHIIKI', '過疎地域持続的発展支援交付金', 'MIC', '総務省', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KASO-CHIIKI', 'manual', '過疎地域持続的発展支援交付金', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"過疎地域の持続的発展に向けた地域の取組（移住促進・産業振興・生活支援等）を支援","target":"過疎地域の市区町村","amount":"ソフト事業：上限2,000万円、ハード事業：上限5,000万円","period":"令和8年度","application":"総務省に申請","url":"https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/2001/kaso/kasomain0.htm","source":"総務省","requirements":["過疎地域に指定されていること","過疎地域持続的発展計画の策定","具体的な成果目標の設定"],"documents":["事業計画書","過疎地域持続的発展計画","予算書","成果目標設定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KASO-CHIIKI', 1);

-- #375 地域おこし協力隊制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-OKOSHI', '地域おこし協力隊', 'MIC', '総務省', '00', '["subsidy","regional","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-OKOSHI', 'manual', '地域おこし協力隊（特別交付税措置）', 4700000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"都市部から過疎地域等に移住し、地域協力活動を行う隊員の活動費・報酬等を財政支援","target":"地方公共団体（条件不利地域）","amount":"1人あたり上限470万円（報酬等280万円＋活動費等200万円）＋起業支援100万円","period":"通年","application":"各市区町村が募集・受入れ","url":"https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/02gyosei08_03000066.html","source":"総務省","requirements":["3大都市圏等から過疎地域等への移住","1年〜3年の活動期間","地域協力活動の実施"],"documents":["募集要項","活動計画書","予算書（自治体が作成）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-OKOSHI', 1);

-- #376 移住支援金（地方創生移住支援事業）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('IJUU-SHIENKIN', '移住支援金（地方創生移住支援事業）', 'CAO', '内閣府', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('IJUU-SHIENKIN', 'manual', '移住支援金（東京圏→地方移住支援）', 1000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"東京23区に在住又は通勤する方が地方に移住して就業・起業等した場合に支援金を支給","target":"東京23区の在住者又は東京圏から23区への通勤者","amount":"世帯：100万円、単身：60万円＋子ども1人あたり100万円加算","period":"令和8年度","application":"移住先の都道府県・市区町村に申請","url":"https://www.chisou.go.jp/sousei/ijyu_shienkin.html","source":"内閣府","requirements":["東京23区に在住又は通勤","移住先の都道府県が事業実施","移住先で5年以上居住する意思"],"documents":["移住支援金申請書","在住・通勤証明","転入届","就業証明又は起業届"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'IJUU-SHIENKIN', 1);

-- #377 特定地域づくり事業協同組合制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOKUTEI-CHIIKIZUKURI', '特定地域づくり事業協同組合制度', 'MIC', '総務省', '00', '["subsidy","regional","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOKUTEI-CHIIKIZUKURI', 'manual', '特定地域づくり事業協同組合制度', 5000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"人口急減地域で季節ごとの労働力需要に対応するマルチワーカー（複業人材）の雇用を支援","target":"人口急減地域の事業協同組合","amount":"組合運営費の1/2（国1/4、都道府県1/4）、1組合あたり年間数百万円","period":"令和8年度","application":"都道府県知事の認定","url":"https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/tokutei_chiiki.html","source":"総務省","requirements":["人口急減地域に所在","4者以上の中小企業で構成","マルチワーカーの派遣事業"],"documents":["認定申請書","組合定款","事業計画書","派遣計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOKUTEI-CHIIKIZUKURI', 1);

-- #378 ふるさとテレワーク推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FURUSATO-TELEWORK', 'ふるさとテレワーク推進事業', 'MIC', '総務省', '00', '["subsidy","digital","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FURUSATO-TELEWORK', 'manual', 'ふるさとテレワーク推進事業', 30000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方でテレワーク拠点（サテライトオフィス・コワーキングスペース等）を整備し、都市部人材の地方進出を促進","target":"地方公共団体、民間企業","amount":"上限3,000万円（補助率1/2）","period":"令和8年度","application":"総務省に申請","url":"https://www.soumu.go.jp/main_sosiki/joho_tsusin/telework/","source":"総務省","requirements":["地方へのテレワーク拠点整備","都市部企業のサテライトオフィス誘致","ICT環境の整備"],"documents":["整備計画書","利用見込み調査","設計図書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FURUSATO-TELEWORK', 1);

-- #379 離島振興事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RITOU-SHINKOU', '離島活性化交付金', 'MLIT', '国土交通省', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RITOU-SHINKOU', 'manual', '離島活性化交付金', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"離島地域の活性化（産業振興・交流促進・定住促進等）を支援する交付金","target":"離島振興対策実施地域の市区町村","amount":"ソフト事業：上限2,000万円","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/kokudoseisaku/chirit/kokudoseisaku_chirit_tk_000027.html","source":"国土交通省","requirements":["離島振興法に基づく指定離島","離島振興計画に基づく事業","定住促進又は交流人口拡大"],"documents":["事業計画書","離島振興計画との整合確認","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RITOU-SHINKOU', 1);

-- #380 半島振興事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HANTOU-SHINKOU', '半島振興広域連携促進事業', 'MLIT', '国土交通省', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HANTOU-SHINKOU', 'manual', '半島振興広域連携促進事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"半島地域の広域連携による活性化（観光振興・産業振興・定住促進等）を支援","target":"半島振興対策実施地域の市区町村","amount":"上限1,000万円","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/kokudoseisaku/chirit/kokudoseisaku_chirit_tk_000014.html","source":"国土交通省","requirements":["半島振興法に基づく指定地域","広域連携による取組","産業振興又は定住促進"],"documents":["事業計画書","連携体制図","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HANTOU-SHINKOU', 1);

-- #381 豪雪地帯対策特別事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GOUSETSU-TAISAKU', '豪雪地帯対策特別事業', 'MLIT', '国土交通省', '00', '["subsidy","regional","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GOUSETSU-TAISAKU', 'manual', '豪雪地帯対策特別事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"豪雪地帯における除雪体制の確保、克雪住宅の普及、雪を活用した地域活性化等を支援","target":"豪雪地帯の市区町村","amount":"上限1,000万円","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/kokudoseisaku/chirit/kokudoseisaku_chirit_tk_000060.html","source":"国土交通省","requirements":["豪雪地帯対策特別措置法に基づく指定地域","雪対策に関する事業","地域の安全・安心の確保"],"documents":["事業計画書","雪対策計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GOUSETSU-TAISAKU', 1);

-- #382 山村振興事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SANSON-SHINKOU', '山村活性化支援交付金', 'MAFF', '農林水産省', '00', '["subsidy","regional","agriculture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SANSON-SHINKOU', 'manual', '山村活性化支援交付金', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"山村地域の農林水産物等の販売・加工、都市との交流、定住促進等を支援","target":"振興山村の市区町村","amount":"上限1,000万円（3年間）","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/nousin/tiiki/sanson/","source":"農林水産省","requirements":["山村振興法に基づく振興山村","地域資源を活用した取組","所得向上・雇用創出"],"documents":["事業計画書","地域資源調査","予算書","成果目標"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SANSON-SHINKOU', 1);

-- #383 中山間地域等直接支払制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHUUSANKAN-SHIHARAI', '中山間地域等直接支払制度', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHUUSANKAN-SHIHARAI', 'manual', '中山間地域等直接支払制度（第5期）', NULL, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中山間地域等の農業生産条件が不利な地域で農業生産活動を継続する農業者に交付金を支給","target":"中山間地域等の農業者（集落協定・個別協定）","amount":"田（急傾斜）：21,000円/10a、田（緩傾斜）：8,000円/10a等","period":"令和2年度〜令和6年度（第5期、延長の可能性あり）","application":"市町村を通じて申請","url":"https://www.maff.go.jp/j/nousin/tyusan/siharai_seido/","source":"農林水産省","requirements":["中山間地域等の農用地","5年以上の農業生産活動の継続","集落協定又は個別協定の締結"],"documents":["集落協定書又は個別協定書","農用地の面積証明","活動計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHUUSANKAN-SHIHARAI', 1);

-- #384 多面的機能支払交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TAMENTEKI-KINOU', '多面的機能支払交付金', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TAMENTEKI-KINOU', 'manual', '多面的機能支払交付金（農地維持・資源向上）', NULL, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"農業・農村の多面的機能（国土保全・水源涵養等）の維持・発揮のための地域活動を支援","target":"農業者を含む活動組織","amount":"農地維持支払：田3,000円/10a・畑2,000円/10a、資源向上支払：田2,400円/10a等","period":"令和8年度","application":"市町村を通じて申請","url":"https://www.maff.go.jp/j/nousin/kanri/tamen_siharai.html","source":"農林水産省","requirements":["農業者を含む活動組織の設立","農地・水路・農道等の保全管理","5年以上の活動計画"],"documents":["活動計画書","組織規約","構成員名簿","対象農用地の面積"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TAMENTEKI-KINOU', 1);

-- #385 デジタル田園都市国家構想交付金（デジ田交付金）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DIGIDEN-KOUFUKIN', 'デジタル田園都市国家構想交付金', 'CAO', '内閣府', '00', '["subsidy","digital","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DIGIDEN-KOUFUKIN', 'manual', 'デジタル田園都市国家構想交付金（TYPE1〜3）', 100000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"デジタル技術を活用した地域課題解決（DX型地方創生）を支援する交付金","target":"地方公共団体","amount":"TYPE1（デジ実装）：上限数千万円、TYPE2（転用）：〜1億円、TYPE3（地方創生テレワーク型）","period":"令和8年度","application":"内閣府に申請","url":"https://www.chisou.go.jp/sousei/about/mirai/","source":"内閣府","requirements":["デジタル技術を活用した地域課題解決","KPIの設定","他地域への横展開可能性"],"documents":["交付金実施計画書","デジタル活用計画","KPI設定書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DIGIDEN-KOUFUKIN', 1);

-- #386 企業版ふるさと納税（人材派遣型）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KIGYOU-FURUSATO', '企業版ふるさと納税（人材派遣型）', 'CAO', '内閣府', '00', '["tax","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KIGYOU-FURUSATO', 'manual', '企業版ふるさと納税（地方創生応援税制・人材派遣型）', NULL, '最大約9割の税額控除', '全国', '2026-04-01', '2027-03-31',
'{"overview":"企業が地方自治体の地方創生事業に寄附した場合の税額控除（最大約9割）と人材派遣の組合せ","target":"地方創生に取り組む企業","amount":"寄附額に対して法人税等の最大約9割の税額控除","period":"令和6年度末まで（延長の可能性あり）","application":"内閣府に申請（寄附先自治体との調整）","url":"https://www.chisou.go.jp/tiiki/tiikisaisei/kigyou_furusato.html","source":"内閣府","requirements":["地方公共団体の地方再生計画に寄附","本社所在地以外の自治体への寄附","人材派遣型は寄附＋専門人材の派遣"],"documents":["寄附申出書","地方再生計画認定書","確定申告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KIGYOU-FURUSATO', 1);

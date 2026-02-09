-- Phase 10 Part 4: 新規50件（#387〜#436）
-- カテゴリ: 製造業DX、中小企業金融追加、水産・林業追加、福祉用具・介護追加、
--           都道府県独自支援追加、IT・AI・セキュリティ追加

-- ====== 1. 製造業DX・ロボット・自動化 (8件) ======

-- #387 ロボット導入実証事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ROBOT-JISSHOU', 'ロボット導入実証事業', 'METI', '経済産業省', '00', '["subsidy","manufacturing","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ROBOT-JISSHOU', 'manual', 'ロボット導入実証事業（中小製造業向け）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小製造業へのロボット導入による自動化・省力化の実証を支援","target":"中小製造業者","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/robot/","source":"経済産業省","requirements":["ロボット導入による生産性向上計画","導入効果の定量評価","横展開への協力"],"documents":["導入計画書","見積書","生産性向上効果試算","事業概要"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ROBOT-JISSHOU', 1);

-- #388 FA（ファクトリーオートメーション）導入支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FA-DOUNYUU', 'ファクトリーオートメーション導入支援', 'METI', '経済産業省', '00', '["subsidy","manufacturing","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FA-DOUNYUU', 'manual', 'ファクトリーオートメーション（FA）導入支援事業', 30000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"製造現場のFA化（自動搬送・自動検査・IoTセンサー等）導入を支援","target":"中小製造業者","amount":"上限3,000万円（補助率1/2）","period":"令和8年度","application":"各地域の経済産業局に申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/smart_mono/","source":"経済産業省","requirements":["FA化による生産性向上計画","IoT・AIの活用","人手不足対策"],"documents":["FA導入計画書","設備仕様書","見積書","効果試算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FA-DOUNYUU', 1);

-- #389 3Dプリンター活用促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('3DPRINT-SOKUSHIN', '3Dプリンター活用促進事業', 'METI', '経済産業省', '00', '["subsidy","manufacturing","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('3DPRINT-SOKUSHIN', 'manual', '3Dプリンター（AM技術）活用促進事業', 20000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"金属・樹脂3Dプリンター（アディティブ・マニュファクチャリング）の製造業活用を支援","target":"中小製造業者","amount":"上限2,000万円（補助率1/2）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/","source":"経済産業省","requirements":["AM技術の活用計画","試作・小ロット生産への適用","技術者の育成計画"],"documents":["活用計画書","設備仕様書","見積書","製品設計データ"]}',
datetime('now'), datetime('now', '+90 days'), 90, '3DPRINT-SOKUSHIN', 1);

-- #390 製造業DXプラットフォーム構築事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SEIZOU-DX-PF', '製造業DXプラットフォーム構築事業', 'METI', '経済産業省', '00', '["subsidy","manufacturing","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SEIZOU-DX-PF', 'manual', '製造業DXプラットフォーム構築事業', 50000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"製造業のDX推進に向けたデータ連携基盤・プラットフォームの構築を支援","target":"製造業を営む中小・中堅企業コンソーシアム","amount":"上限5,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/mono_info_service/connected_industries/","source":"経済産業省","requirements":["複数企業によるデータ連携","製造プロセスのデジタル化","標準化・共通化の推進"],"documents":["プラットフォーム構築計画書","参加企業一覧","データ連携仕様書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SEIZOU-DX-PF', 1);

-- #391 IoTセンサー導入支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('IOT-SENSOR', 'IoTセンサー導入支援事業', 'METI', '経済産業省', '00', '["subsidy","manufacturing","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('IOT-SENSOR', 'manual', 'IoTセンサー導入による工場見える化支援事業', 5000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小製造業の工場にIoTセンサーを導入し、稼働状況・品質データの見える化を支援","target":"中小製造業者","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"各地域のものづくり支援機関に申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/smart_mono/","source":"経済産業省","requirements":["IoTセンサーによる製造データ収集","データ分析による改善活動","IT人材の育成"],"documents":["導入計画書","センサー仕様書","見積書","データ活用計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'IOT-SENSOR', 1);

-- #392 ものづくり人材育成支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MONODZUKURI-JINZAI', 'ものづくり人材育成支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","manufacturing","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MONODZUKURI-JINZAI', 'manual', 'ものづくり人材育成支援事業（認定職業訓練）', 5000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小製造業の技能者育成のための認定職業訓練の実施を支援","target":"認定職業訓練を実施する事業主・団体","amount":"訓練経費の一部補助","period":"令和8年度","application":"都道府県を通じて厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/","source":"厚生労働省","requirements":["認定職業訓練の実施","中小企業の技能者育成","訓練カリキュラムの策定"],"documents":["訓練計画書","カリキュラム","講師一覧","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MONODZUKURI-JINZAI', 1);

-- #393 中小企業省エネ設備導入促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHUSHO-SHOUENE-SETSUBI', '中小企業省エネ設備導入促進事業', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","environment","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHUSHO-SHOUENE-SETSUBI', 'manual', '中小企業省エネ設備導入促進事業', 10000000, '1/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"中小企業の省エネ設備（高効率空調・LED・コンプレッサー等）の更新を支援","target":"中小企業","amount":"上限1,000万円（補助率1/3）","period":"令和8年度","application":"SII（環境共創イニシアチブ）に申請","url":"https://sii.or.jp/","source":"資源エネルギー庁（SII）","requirements":["省エネ性能の向上","省エネ計算書の提出","エネルギー管理の実施"],"documents":["交付申請書","省エネ計算書","設備仕様書・見積書","エネルギー使用実績"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHUSHO-SHOUENE-SETSUBI', 1);

-- #394 工場立地促進補助金（自治体上乗せ）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOUJOU-RICCHI-JICHITAI', '工場立地促進補助金（自治体上乗せ型）', 'LOCAL', '各自治体', '00', '["subsidy","manufacturing","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOUJOU-RICCHI-JICHITAI', 'manual', '工場立地促進補助金（各自治体の企業誘致施策）', 500000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"工場の新設・増設を行う企業に対し、各自治体が固定資産税減免・補助金等のインセンティブを提供","target":"工場を新設・増設する企業","amount":"自治体により異なる（数百万円〜数億円規模）","period":"通年（自治体により異なる）","application":"各自治体の企業誘致担当課に相談","url":"各自治体の企業誘致ページ","source":"各自治体","requirements":["一定規模以上の設備投資","一定人数以上の新規雇用","自治体内への工場立地"],"documents":["事業計画書","設備投資計画","雇用計画","建築確認書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOUJOU-RICCHI-JICHITAI', 1);

-- ====== 2. 都道府県独自支援（政令指定都市・中核市） (10件) ======

-- #395 札幌市ものづくり産業振興補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAPPORO-MONO', '札幌市ものづくり産業振興補助金', 'SAPPORO', '札幌市', '01', '["subsidy","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAPPORO-MONO', 'manual', '札幌市ものづくり産業振興補助金', 5000000, '1/2', '北海道札幌市', '2026-04-01', '2026-12-31',
'{"overview":"札幌市内のものづくり企業の新製品開発・販路開拓等を支援","target":"札幌市内に事業所を有する中小製造業者","amount":"上限500万円（補助率1/2）","period":"令和8年度","application":"札幌市経済観光局に申請","url":"https://www.city.sapporo.jp/keizai/","source":"札幌市","requirements":["札幌市内に事業所","新製品開発又は販路開拓","市税の完納"],"documents":["申請書","事業計画書","見積書","決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAPPORO-MONO', 1);

-- #396 川崎市イノベーション推進補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAWASAKI-INNOVATION', '川崎市イノベーション推進補助金', 'KAWASAKI', '川崎市', '14', '["subsidy","technology","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAWASAKI-INNOVATION', 'manual', '川崎市イノベーション推進補助金', 3000000, '2/3', '神奈川県川崎市', '2026-04-01', '2026-12-31',
'{"overview":"川崎市内の中小企業による革新的な製品・サービスの開発を支援","target":"川崎市内に事業所を有する中小企業","amount":"上限300万円（補助率2/3）","period":"令和8年度","application":"川崎市経済労働局に申請","url":"https://www.city.kawasaki.jp/280/","source":"川崎市","requirements":["川崎市内に事業所","革新的な製品・サービス開発","市税の完納"],"documents":["申請書","事業計画書","見積書","決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAWASAKI-INNOVATION', 1);

-- #397 静岡県次世代産業創出支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHIZUOKA-JISEDAI', '静岡県次世代産業創出支援事業', 'SHIZUOKA', '静岡県', '22', '["subsidy","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHIZUOKA-JISEDAI', 'manual', '静岡県次世代産業創出支援事業', 10000000, '2/3', '静岡県', '2026-04-01', '2026-12-31',
'{"overview":"静岡県の次世代産業（EV・水素・医療機器等）への参入を支援","target":"静岡県内に事業所を有する中小企業","amount":"上限1,000万円（補助率2/3）","period":"令和8年度","application":"静岡県経済産業部に申請","url":"https://www.pref.shizuoka.jp/sangyou/","source":"静岡県","requirements":["静岡県内に事業所","次世代産業分野への新規参入","県税の完納"],"documents":["事業計画書","見積書","決算書","県税納税証明書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHIZUOKA-JISEDAI', 1);

-- #398 新潟県IoT・AI推進補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NIIGATA-IOTAI', '新潟県IoT・AI推進補助金', 'NIIGATA', '新潟県', '15', '["subsidy","digital","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NIIGATA-IOTAI', 'manual', '新潟県IoT・AI推進補助金', 5000000, '1/2', '新潟県', '2026-04-01', '2026-12-31',
'{"overview":"新潟県内の製造業等におけるIoT・AI導入を支援","target":"新潟県内に事業所を有する中小企業","amount":"上限500万円（補助率1/2）","period":"令和8年度","application":"新潟県産業労働部に申請","url":"https://www.pref.niigata.lg.jp/","source":"新潟県","requirements":["新潟県内に事業所","IoT・AIの導入計画","県税の完納"],"documents":["申請書","導入計画書","見積書","決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NIIGATA-IOTAI', 1);

-- #399 兵庫県中小企業成長促進補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HYOGO-SEICHOU', '兵庫県中小企業成長促進補助金', 'HYOGO', '兵庫県', '28', '["subsidy","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HYOGO-SEICHOU', 'manual', '兵庫県中小企業成長促進補助金', 5000000, '1/2', '兵庫県', '2026-04-01', '2026-12-31',
'{"overview":"兵庫県内の中小企業の成長促進（新製品開発・販路開拓・DX推進等）を支援","target":"兵庫県内に事業所を有する中小企業","amount":"上限500万円（補助率1/2）","period":"令和8年度","application":"ひょうご産業活性化センターに申請","url":"https://web.hyogo-iic.ne.jp/","source":"兵庫県","requirements":["兵庫県内に事業所","成長に向けた取組計画","県税の完納"],"documents":["申請書","事業計画書","見積書","決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HYOGO-SEICHOU', 1);

-- #400 長野県DX推進モデル事業補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NAGANO-DX', '長野県DX推進モデル事業補助金', 'NAGANO', '長野県', '20', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NAGANO-DX', 'manual', '長野県DX推進モデル事業補助金', 3000000, '2/3', '長野県', '2026-04-01', '2026-12-31',
'{"overview":"長野県内の中小企業のDX推進（業務効率化・顧客体験向上等）を支援","target":"長野県内に事業所を有する中小企業","amount":"上限300万円（補助率2/3）","period":"令和8年度","application":"長野県産業労働部に申請","url":"https://www.pref.nagano.lg.jp/","source":"長野県","requirements":["長野県内に事業所","DX推進計画の策定","県税の完納"],"documents":["申請書","DX推進計画書","見積書","決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NAGANO-DX', 1);

-- #401 石川県伝統工芸イノベーション補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ISHIKAWA-DENTOU', '石川県伝統工芸イノベーション補助金', 'ISHIKAWA', '石川県', '17', '["subsidy","culture","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ISHIKAWA-DENTOU', 'manual', '石川県伝統工芸イノベーション補助金', 3000000, '2/3', '石川県', '2026-04-01', '2026-12-31',
'{"overview":"石川県の伝統工芸品産業の新商品開発・販路開拓・デジタル活用を支援","target":"石川県内の伝統工芸品事業者","amount":"上限300万円（補助率2/3）","period":"令和8年度","application":"石川県商工労働部に申請","url":"https://www.pref.ishikawa.lg.jp/","source":"石川県","requirements":["石川県の伝統工芸品産業従事者","新商品開発又は販路開拓","県税の完納"],"documents":["事業計画書","見積書","伝統工芸品従事証明"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ISHIKAWA-DENTOU', 1);

-- #402 熊本県半導体関連企業支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KUMAMOTO-HANDOUTAI', '熊本県半導体関連企業支援補助金', 'KUMAMOTO', '熊本県', '43', '["subsidy","manufacturing","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KUMAMOTO-HANDOUTAI', 'manual', '熊本県半導体関連企業支援補助金（TSMC関連）', 20000000, '1/2', '熊本県', '2026-04-01', '2027-03-31',
'{"overview":"TSMC進出に伴う熊本県内の半導体関連サプライチェーンへの参入・設備投資を支援","target":"熊本県内に事業所を有する中小企業","amount":"上限2,000万円（補助率1/2）","period":"令和8年度","application":"熊本県商工観光労働部に申請","url":"https://www.pref.kumamoto.jp/","source":"熊本県","requirements":["熊本県内に事業所","半導体関連分野への参入計画","県税の完納"],"documents":["事業計画書","設備投資計画","見積書","半導体関連取引計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KUMAMOTO-HANDOUTAI', 1);

-- #403 沖縄県情報通信産業振興補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('OKINAWA-ICT', '沖縄県情報通信産業振興補助金', 'OKINAWA', '沖縄県', '47', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('OKINAWA-ICT', 'manual', '沖縄県情報通信産業振興補助金', 10000000, '2/3', '沖縄県', '2026-04-01', '2027-03-31',
'{"overview":"沖縄県のICT産業（ソフトウェア開発・データセンター・BPO等）の振興を支援","target":"沖縄県内に事業所を有するICT企業","amount":"上限1,000万円（補助率2/3）","period":"令和8年度","application":"沖縄県商工労働部に申請","url":"https://www.pref.okinawa.jp/","source":"沖縄県","requirements":["沖縄県内に事業所","情報通信産業の振興に資する事業","県税の完納"],"documents":["事業計画書","見積書","決算書","県税納税証明書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'OKINAWA-ICT', 1);

-- #404 宮城県新産業創出支援事業補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MIYAGI-SHINSANGYOU', '宮城県新産業創出支援事業補助金', 'MIYAGI', '宮城県', '04', '["subsidy","technology","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MIYAGI-SHINSANGYOU', 'manual', '宮城県新産業創出支援事業補助金', 5000000, '2/3', '宮城県', '2026-04-01', '2026-12-31',
'{"overview":"宮城県内の中小企業による新産業分野（医療・航空宇宙・環境等）への参入を支援","target":"宮城県内に事業所を有する中小企業","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"宮城県経済商工観光部に申請","url":"https://www.pref.miyagi.jp/","source":"宮城県","requirements":["宮城県内に事業所","新産業分野への参入計画","県税の完納"],"documents":["事業計画書","見積書","決算書","県税納税証明書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MIYAGI-SHINSANGYOU', 1);

-- ====== 3. 林業・水産業追加 (6件) ======

-- #405 森林・林業再生基盤づくり交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHINRIN-SAISEI', '森林・林業再生基盤づくり交付金', 'MAFF', '農林水産省', '00', '["subsidy","forestry"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHINRIN-SAISEI', 'manual', '森林・林業再生基盤づくり交付金', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"森林整備の効率化、木材利用の促進、林業の担い手育成等を総合的に支援","target":"都道府県、市町村、森林組合","amount":"事業内容に応じて交付","period":"令和8年度","application":"林野庁に申請","url":"https://www.rinya.maff.go.jp/","source":"農林水産省林野庁","requirements":["森林経営計画の策定","効率的な森林施業の実施","木材の安定供給"],"documents":["事業計画書","森林経営計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHINRIN-SAISEI', 1);

-- #406 CLT等新たな木材需要創出促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CLT-MOKUZAI', 'CLT等新たな木材需要創出促進事業', 'MAFF', '農林水産省', '00', '["subsidy","forestry","construction"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CLT-MOKUZAI', 'manual', 'CLT等新たな木材需要創出促進事業', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"CLT（直交集成板）等を活用した中高層木造建築の普及、非住宅分野での木材利用促進を支援","target":"建設業者、木材加工業者、設計事務所","amount":"上限3,000万円","period":"令和8年度","application":"林野庁に申請","url":"https://www.rinya.maff.go.jp/","source":"農林水産省林野庁","requirements":["CLT等の新たな木材利用","非住宅・中高層建築への木材活用","木材利用の普及啓発"],"documents":["事業計画書","建築計画書","木材利用計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CLT-MOKUZAI', 1);

-- #407 森林環境譲与税活用事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHINRIN-KANKYO-ZEI', '森林環境譲与税活用事業', 'MIC', '総務省', '00', '["tax","forestry","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHINRIN-KANKYO-ZEI', 'manual', '森林環境譲与税（森林整備・木材利用促進）', NULL, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"2024年度から課税開始の森林環境税（1人年額1,000円）を原資に、森林整備・木材利用を推進","target":"全市区町村・都道府県","amount":"人口・森林面積等に基づき各自治体に譲与（全国で年間約600億円）","period":"通年","application":"自治体が自主的に活用","url":"https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/04000067.html","source":"総務省","requirements":["森林の整備に関する施策","森林の整備を担う人材の育成・確保","木材の利用促進"],"documents":["使途の公表（各自治体が実施）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHINRIN-KANKYO-ZEI', 1);

-- #408 漁港・漁場整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GYOKOU-SEIBI', '漁港・漁場整備事業', 'MAFF', '農林水産省', '00', '["subsidy","fishery","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GYOKOU-SEIBI', 'manual', '漁港・漁場整備事業（水産基盤整備事業）', 500000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"漁港の機能保全・長寿命化、漁場の整備（増殖場・人工魚礁等）を支援","target":"都道府県、市町村、漁業協同組合","amount":"補助率1/2（漁港整備）〜2/3（特定漁港）","period":"令和8年度","application":"水産庁に申請","url":"https://www.jfa.maff.go.jp/","source":"農林水産省水産庁","requirements":["漁港漁場整備長期計画に基づく整備","施設の機能保全計画","漁業生産の維持・向上"],"documents":["整備計画書","施設の現況調査","設計図書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GYOKOU-SEIBI', 1);

-- #409 養殖業成長産業化推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YOUSHOKU-SEICHOU', '養殖業成長産業化推進事業', 'MAFF', '農林水産省', '00', '["subsidy","fishery"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YOUSHOKU-SEICHOU', 'manual', '養殖業成長産業化推進事業（マーケットイン型養殖）', 30000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"マーケットイン型の養殖業への転換、スマート養殖技術の導入等を支援","target":"養殖業者、漁業協同組合","amount":"上限3,000万円（補助率1/2）","period":"令和8年度","application":"水産庁に申請","url":"https://www.jfa.maff.go.jp/","source":"農林水産省水産庁","requirements":["養殖業成長産業化総合戦略に基づく取組","マーケットイン型への転換","スマート養殖技術の活用"],"documents":["事業計画書","マーケティング計画","技術導入計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'YOUSHOKU-SEICHOU', 1);

-- #410 漁業者向け省エネ機器導入支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GYOGYOU-SHOUENE', '漁業者向け省エネ機器導入支援', 'MAFF', '農林水産省', '00', '["subsidy","fishery","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GYOGYOU-SHOUENE', 'manual', '漁業構造改革総合対策事業（省エネ機器導入）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"漁船の省エネ機器（LED集魚灯・高効率エンジン等）の導入を支援","target":"漁業者、漁業協同組合","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","application":"水産庁に申請（漁協等を通じて）","url":"https://www.jfa.maff.go.jp/","source":"農林水産省水産庁","requirements":["省エネ効果が見込まれる機器の導入","燃油使用量の削減計画","漁業経営の改善"],"documents":["導入計画書","機器仕様書","見積書","燃油使用実績"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GYOGYOU-SHOUENE', 1);

-- ====== 4. AI・生成AI・量子関連 (8件) ======

-- #411 AI活用促進事業（中小企業向け）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('AI-CHUSHO', 'AI活用促進事業（中小企業向け）', 'METI', '経済産業省', '00', '["subsidy","digital","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('AI-CHUSHO', 'manual', 'AI活用促進事業（中小企業のAI導入支援）', 10000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業へのAI（画像認識・自然言語処理・需要予測等）導入を支援","target":"AIを導入する中小企業","amount":"上限1,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/it_policy/jinzai/AIutilization.html","source":"経済産業省","requirements":["AI導入による業務効率化・高度化","AI人材の育成計画","導入効果の検証"],"documents":["AI導入計画書","技術仕様書","見積書","効果検証計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'AI-CHUSHO', 1);

-- #412 生成AI利活用環境整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SEISEIAI-KANKYO', '生成AI利活用環境整備事業', 'METI', '経済産業省', '00', '["subsidy","digital","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SEISEIAI-KANKYO', 'manual', '生成AI利活用環境整備事業（GENIAC等）', 500000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本語対応の生成AIモデル開発・計算資源確保・利活用環境の整備を支援するGENIAC事業等","target":"AI開発企業、スタートアップ、研究機関","amount":"計算資源提供＋開発支援（数百万円〜数億円規模）","period":"令和5年度〜（継続事業）","application":"経済産業省・NEDO等","url":"https://www.meti.go.jp/policy/it_policy/generative_ai/","source":"経済産業省","requirements":["生成AIの開発又は利活用","日本語LLMの研究開発","安全性・信頼性の確保"],"documents":["研究開発計画書","計算資源利用計画","安全性評価計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SEISEIAI-KANKYO', 1);

-- #413 量子技術イノベーション推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RYOUSHI-INNOVATION-2', '量子技術イノベーション拠点形成事業', 'MEXT', '文部科学省', '00', '["research","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RYOUSHI-INNOVATION-2', 'manual', '量子技術イノベーション拠点形成事業（量子コンピュータ等）', 1000000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"量子コンピュータ・量子暗号・量子センサー等の量子技術の研究開発拠点を形成","target":"大学、研究機関、企業","amount":"プロジェクトごとに数億〜数十億円","period":"令和2年度〜（継続事業）","application":"文部科学省・理化学研究所等","url":"https://www.mext.go.jp/a_menu/shinkou/ryoushi/","source":"文部科学省","requirements":["量子技術の研究開発","産学連携体制","国際連携の推進"],"documents":["研究開発計画書","拠点形成計画","連携体制図","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RYOUSHI-INNOVATION-2', 1);

-- #414 クラウドコンピューティング基盤整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CLOUD-KIBAN', 'クラウドコンピューティング基盤整備事業', 'METI', '経済産業省', '00', '["subsidy","digital","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CLOUD-KIBAN', 'manual', 'クラウドコンピューティング基盤整備事業（国内データセンター等）', 10000000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"国内データセンターの整備、クラウド基盤の強化、AIトレーニング用GPU環境の整備を支援","target":"データセンター事業者、クラウドサービス提供者","amount":"数億〜数千億円規模（大型プロジェクト）","period":"令和6年度〜（複数年度）","application":"経済産業省・NEDO","url":"https://www.meti.go.jp/policy/it_policy/datacenter/","source":"経済産業省","requirements":["国内データセンターの新設・増設","経済安全保障の観点からの国内基盤強化","再エネ活用によるグリーンDC"],"documents":["整備計画書","技術仕様書","環境配慮計画","資金計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CLOUD-KIBAN', 1);

-- #415 Web3・ブロックチェーン活用推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('WEB3-BLOCKCHAIN', 'Web3・ブロックチェーン活用推進事業', 'METI', '経済産業省', '00', '["subsidy","digital","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('WEB3-BLOCKCHAIN', 'manual', 'Web3・ブロックチェーン活用推進事業', 20000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"Web3技術（DAO・NFT・DeFi等）を活用した新サービスの実証・社会実装を支援","target":"Web3関連スタートアップ、中小企業","amount":"上限2,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/it_policy/","source":"経済産業省","requirements":["Web3・ブロックチェーン技術の活用","社会課題の解決","法規制への対応"],"documents":["事業計画書","技術仕様書","法規制対応計画","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'WEB3-BLOCKCHAIN', 1);

-- #416 デジタルツイン活用実証事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DIGITAL-TWIN', 'デジタルツイン活用実証事業', 'MLIT', '国土交通省', '00', '["subsidy","digital","urban"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DIGITAL-TWIN', 'manual', 'デジタルツイン活用実証事業（PLATEAU等）', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"3D都市モデル（PLATEAU）等のデジタルツインを活用したまちづくり・防災等の実証を支援","target":"地方公共団体、民間企業","amount":"上限3,000万円","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/plateau/","source":"国土交通省","requirements":["PLATEAUの3D都市モデル活用","まちづくり・防災等への実装","オープンデータとしての公開"],"documents":["実証計画書","技術仕様書","データ活用計画","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DIGITAL-TWIN', 1);

-- #417 マイナポータル連携ビジネス推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MYNA-PORTAL-BIZ', 'マイナポータル連携ビジネス推進事業', 'DIGITAL', 'デジタル庁', '00', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MYNA-PORTAL-BIZ', 'manual', 'マイナポータル連携ビジネス推進事業', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"マイナポータルAPIを活用した民間サービスの開発・実証を支援","target":"マイナポータル連携サービスを開発する企業","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","application":"デジタル庁に申請","url":"https://www.digital.go.jp/","source":"デジタル庁","requirements":["マイナポータルAPIの活用","本人確認・情報連携の実装","セキュリティ基準の遵守"],"documents":["サービス開発計画書","API連携仕様書","セキュリティ対策計画","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MYNA-PORTAL-BIZ', 1);

-- #418 GovTech推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GOVTECH-SUISHIN', 'GovTech推進事業', 'DIGITAL', 'デジタル庁', '00', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GOVTECH-SUISHIN', 'manual', 'GovTech推進事業（行政DXスタートアップ支援）', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"行政のデジタル化に資するGovTechスタートアップの製品開発・実証を支援","target":"GovTech分野のスタートアップ・中小企業","amount":"上限2,000万円","period":"令和8年度","application":"デジタル庁に申請","url":"https://www.digital.go.jp/","source":"デジタル庁","requirements":["行政DXに資するプロダクト","自治体等との実証連携","スケーラブルなソリューション"],"documents":["製品概要書","実証計画書","自治体連携計画","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GOVTECH-SUISHIN', 1);

-- ====== 5. 食品・外食・農商工連携 (8件) ======

-- #419 6次産業化サポート事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ROKUJI-SUPPORT', '6次産業化サポート事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ROKUJI-SUPPORT', 'manual', '6次産業化サポート事業（6次産業化プランナー派遣等）', NULL, '無料', '全国', '2026-04-01', '2027-03-31',
'{"overview":"農林漁業者の6次産業化（加工・販売）を支援する専門プランナーの派遣等","target":"6次産業化に取り組む農林漁業者","amount":"プランナー派遣無料（国負担）","period":"令和8年度","application":"各都道府県の6次産業化サポートセンター","url":"https://www.maff.go.jp/j/shokusan/sanki/6jika.html","source":"農林水産省","requirements":["農林漁業者であること","6次産業化の意思","事業計画の策定意思"],"documents":["相談申込書（簡易）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ROKUJI-SUPPORT', 1);

-- #420 農商工連携促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NOUSHOUKOU-RENKEI', '農商工連携促進事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NOUSHOUKOU-RENKEI', 'manual', '農商工連携促進事業（農商工連携型新商品開発等）', 5000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"農林漁業者と中小企業者が連携して行う新商品・新サービスの開発を支援","target":"農林漁業者と中小企業者の連携体","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"農政局又は経済産業局に申請","url":"https://www.maff.go.jp/j/shokusan/sanki/nosyoko/","source":"農林水産省・経済産業省","requirements":["農商工連携促進法に基づく計画認定","農林漁業者と商工業者の連携","新商品・新サービスの開発"],"documents":["農商工連携事業計画書","連携協定書","見積書","収支計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NOUSHOUKOU-RENKEI', 1);

-- #421 食品産業の国際競争力強化事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOKUHIN-KOKUSAI', '食品産業の国際競争力強化事業', 'MAFF', '農林水産省', '00', '["subsidy","food","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOKUHIN-KOKUSAI', 'manual', '食品産業の国際競争力強化事業（輸出対応HACCP等）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"食品の輸出拡大に向けたHACCP対応、認証取得、海外規制対応等を支援","target":"食品製造業者、農林漁業者","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/shokusan/export/","source":"農林水産省","requirements":["食品の輸出拡大計画","HACCP対応又は認証取得","海外規制への対応"],"documents":["事業計画書","HACCP対応計画","認証取得計画","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOKUHIN-KOKUSAI', 1);

-- #422 GFP（グローバル・フードバリューチェーン推進）事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GFP-YUSHUTSU', 'GFP（グローバル・フードバリューチェーン推進）事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GFP-YUSHUTSU', 'manual', 'GFP（農林水産物・食品輸出プロジェクト）', NULL, '無料', '全国', '2026-04-01', '2027-03-31',
'{"overview":"農林水産物・食品の輸出を目指す事業者を総合的に支援するプロジェクト","target":"農林水産物・食品の輸出を目指す事業者","amount":"輸出診断・セミナー等無料、商談会の参加費補助","period":"通年","application":"GFPコミュニティへの登録","url":"https://www.gfp1.maff.go.jp/","source":"農林水産省","requirements":["GFPコミュニティへの登録（無料）","輸出の意思","農林水産物・食品の生産者又は事業者"],"documents":["GFP登録（オンライン）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GFP-YUSHUTSU', 1);

-- #423 食品ロス削減推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FOOD-LOSS-SUISHIN', '食品ロス削減推進事業', 'MAFF', '農林水産省', '00', '["subsidy","food","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FOOD-LOSS-SUISHIN', 'manual', '食品ロス削減推進事業（フードバンク支援等）', 5000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"食品ロスの削減に向けたフードバンク支援、商慣習の見直し、消費者啓発等を支援","target":"フードバンク団体、食品事業者、地方公共団体","amount":"上限500万円","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/shokusan/recycle/syoku_loss/","source":"農林水産省","requirements":["食品ロス削減に資する事業","フードバンク活動の支援","食品リサイクルの推進"],"documents":["事業計画書","活動計画書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FOOD-LOSS-SUISHIN', 1);

-- #424 有機農業推進総合対策事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YUUKI-SUISHIN', '有機農業推進総合対策事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YUUKI-SUISHIN', 'manual', '有機農業推進総合対策事業（オーガニックビレッジ等）', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"有機農業の推進に向けた産地づくり（オーガニックビレッジ）・販路開拓・技術支援等を実施","target":"有機農業者、市町村、農業団体","amount":"産地づくり：上限2,000万円","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/seisan/kankyo/yuuki/","source":"農林水産省","requirements":["有機農業の推進計画","2025年有機農業面積6.3万ha目標への貢献","地域ぐるみの取組"],"documents":["推進計画書","産地づくり計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'YUUKI-SUISHIN', 1);

-- #425 花き産業振興総合事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAKI-SHINKOU', '花き産業振興総合事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAKI-SHINKOU', 'manual', '花き産業振興総合事業', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"花き産業（花卉）の生産振興、需要拡大、輸出促進等を総合的に支援","target":"花き生産者、花き団体","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/seisan/kaki/flower/","source":"農林水産省","requirements":["花き産業の振興に資する事業","需要拡大又は輸出促進","生産コスト低減"],"documents":["事業計画書","生産計画","販売計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAKI-SHINKOU', 1);

-- #426 茶・果樹産地構造改革事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHA-KAJU-KAIKAKU', '茶・果樹産地構造改革事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHA-KAJU-KAIKAKU', 'manual', '茶・果樹産地構造改革事業', 20000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"茶・果樹産地の構造改革（高品質化・省力化・輸出対応等）を支援","target":"茶・果樹生産者、産地協議会","amount":"上限2,000万円（補助率1/2）","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/seisan/tokusan/","source":"農林水産省","requirements":["産地計画の策定","品質向上・省力化の取組","輸出促進又は需要拡大"],"documents":["産地計画書","事業計画書","見積書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHA-KAJU-KAIKAKU', 1);

-- ====== 6. 追加の重要制度 (10件) ======

-- #427 中小企業退職金共済制度（中退共）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHUTAIKYO-SEIDO', '中小企業退職金共済制度（中退共）', 'MHLW', '厚生労働省', '00', '["finance","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHUTAIKYO-SEIDO', 'manual', '中小企業退職金共済制度（中退共・掛金助成）', NULL, '掛金の1/2助成（加入後4ヶ月〜1年間）', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の従業員の退職金制度。国が掛金の一部を助成","target":"従業員を雇用する中小企業","amount":"新規加入：掛金月額の1/2を加入後4ヶ月〜1年間助成。月額増額：増額分の1/3を1年間助成","period":"通年","application":"中退共本部又は金融機関","url":"https://chutaikyo.taisyokukin.go.jp/","source":"厚生労働省（勤労者退職金共済機構）","requirements":["中小企業であること","雇用する従業員がいること","過去に中退共に加入していないこと（新規加入助成の場合）"],"documents":["共済契約申込書","従業員名簿","中小企業であることの証明"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHUTAIKYO-SEIDO', 1);

-- #428 経営力向上計画認定制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KEIEIYOKU-KOUJOU', '経営力向上計画認定制度', 'METI', '経済産業省', '00', '["tax","certification"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KEIEIYOKU-KOUJOU', 'manual', '経営力向上計画認定制度（中小企業等経営強化法）', NULL, '即時償却又は10%税額控除', '全国', '2026-04-01', '2027-03-31',
'{"overview":"経営力向上計画の認定を受けた中小企業が設備投資した場合の税制優遇（固定資産税減免等）","target":"中小企業・小規模事業者","amount":"設備投資の即時償却又は取得価額の10%税額控除、固定資産税3年間1/2","period":"通年","application":"事業分野の主務大臣に認定申請","url":"https://www.chusho.meti.go.jp/keiei/kyoka/","source":"経済産業省","requirements":["経営力向上計画の策定","労働生産性の向上目標","認定経営革新等支援機関の確認"],"documents":["経営力向上計画認定申請書","工業会証明書（設備関係）","確定申告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KEIEIYOKU-KOUJOU', 1);

-- #429 中小企業投資育成株式会社制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOUSHI-IKUSEI', '中小企業投資育成株式会社制度', 'METI', '経済産業省', '00', '["finance","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOUSHI-IKUSEI', 'manual', '中小企業投資育成株式会社制度', 300000000, '出資', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の自己資本充実のため、投資育成会社が株式引受け・増資引受けを行う公的投資制度","target":"資本金3億円以下の中小企業","amount":"1社あたり数百万円〜数億円の出資","period":"通年","application":"東京・名古屋・大阪の投資育成会社に申請","url":"https://www.sbic.co.jp/","source":"経済産業省","requirements":["資本金3億円以下の株式会社","経営の安定性・成長性","配当の見込み"],"documents":["投資申込書","決算書3期分","事業計画書","株主構成表"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOUSHI-IKUSEI', 1);

-- #430 災害時の資金繰り支援（日本公庫）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAIGAI-SHIKIN-JFC', '災害復旧貸付（日本政策金融公庫）', 'JFC', '日本政策金融公庫', '00', '["finance","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAIGAI-SHIKIN-JFC', 'manual', '災害復旧貸付（日本政策金融公庫・低利融資）', 600000000, '低利融資', '全国', NULL, NULL,
'{"overview":"自然災害により被害を受けた中小企業・農林漁業者等に対する低利の復旧融資","target":"災害により被害を受けた事業者","amount":"中小企業：各融資制度の限度額＋3,000万円、農林漁業：別枠設定","period":"災害発生時に随時","application":"日本政策金融公庫の各支店","url":"https://www.jfc.go.jp/n/finance/saftynet/","source":"日本政策金融公庫","requirements":["災害による直接被害又は間接被害","罹災証明書の取得","事業継続の意思"],"documents":["融資申込書","罹災証明書","被害状況報告書","決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAIGAI-SHIKIN-JFC', 1);

-- #431 雇用調整助成金（緊急対応時）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOYOU-CHOUSEI-KINKYUU', '雇用調整助成金（緊急対応期間）', 'MHLW', '厚生労働省', '00', '["subsidy","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOYOU-CHOUSEI-KINKYUU', 'manual', '雇用調整助成金（緊急対応期間・特例措置）', 15000, '最大10/10', '全国', NULL, NULL,
'{"overview":"経済危機・災害等により事業活動の縮小を余儀なくされた事業主が従業員の雇用を維持するための休業手当等を助成（通常版は既存、ここは緊急特例版）","target":"事業活動が縮小した全事業主","amount":"通常：休業手当の2/3（中小）〜1/2（大企業）。緊急特例時：最大10/10（日額上限15,000円）","period":"緊急時に特例発動","application":"ハローワークに申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html","source":"厚生労働省","requirements":["売上等が一定以上減少","休業等を実施","雇用保険適用事業所"],"documents":["支給申請書","休業協定書","賃金台帳","出勤簿"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOYOU-CHOUSEI-KINKYUU', 1);

-- #432 女性起業家支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JOSEI-KIGYOUKA', '女性起業家支援事業', 'METI', '経済産業省', '00', '["subsidy","startup","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JOSEI-KIGYOUKA', 'manual', '女性起業家支援事業（わたしの起業応援団等）', 2000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"女性起業家のネットワーク構築、メンタリング、資金調達支援等を実施","target":"起業を目指す又は起業後間もない女性","amount":"起業支援補助：上限200万円（補助率2/3）","period":"令和8年度","application":"各地域の女性起業家支援機関","url":"https://www.meti.go.jp/policy/economy/jinzai/diversity/","source":"経済産業省","requirements":["女性起業家又は起業予定者","事業計画の策定","支援プログラムへの参加"],"documents":["事業計画書","申込書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JOSEI-KIGYOUKA', 1);

-- #433 中小企業BCP策定支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BCP-SHIEN', '中小企業BCP策定支援事業', 'METI', '経済産業省', '00', '["subsidy","disaster","consulting"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BCP-SHIEN', 'manual', '中小企業BCP策定支援事業（事業継続力強化計画）', NULL, '無料', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の事業継続力強化計画（簡易版BCP）の策定支援と認定制度","target":"中小企業・小規模事業者","amount":"認定取得無料、認定による金融支援・税制優遇","period":"通年","application":"各経済産業局に認定申請","url":"https://www.chusho.meti.go.jp/keiei/antei/bousai/keizokuryoku.htm","source":"経済産業省","requirements":["事業継続力強化計画の策定","自然災害等のリスク分析","初動対応手順の整備"],"documents":["事業継続力強化計画認定申請書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BCP-SHIEN', 1);

-- #434 中小企業新事業活動促進法（経営革新計画）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KEIEI-KAKUSHIN-KEIKAKU', '経営革新計画認定制度', 'METI', '経済産業省', '00', '["certification","subsidy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KEIEI-KAKUSHIN-KEIKAKU', 'manual', '経営革新計画認定制度（融資・保証の優遇措置）', NULL, '認定制度', '全国', '2026-04-01', '2027-03-31',
'{"overview":"新事業活動（新商品開発・新サービス等）の計画が認定されると各種支援を受けられる制度","target":"中小企業・小規模事業者","amount":"日本公庫の特別利率融資、信用保証の特例、補助金加点等","period":"通年","application":"都道府県知事に認定申請","url":"https://www.chusho.meti.go.jp/keiei/kakushin/","source":"経済産業省","requirements":["新事業活動の計画策定","付加価値額の年率3%以上向上","経常利益の年率1%以上向上"],"documents":["経営革新計画承認申請書","事業計画書","直近の決算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KEIEI-KAKUSHIN-KEIKAKU', 1);

-- #435 地域未来投資促進法（地域経済牽引事業計画）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-MIRAI-KEIKAKU', '地域未来投資促進法（地域経済牽引事業計画）', 'METI', '経済産業省', '00', '["tax","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-MIRAI-KEIKAKU', 'manual', '地域未来投資促進法（地域経済牽引事業計画・税制優遇）', NULL, '特別償却40%又は税額控除4%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域の特性を活用した事業で高い付加価値を創出する計画が認定されると税制優遇等を受けられる","target":"地域経済を牽引する事業を行う企業","amount":"設備投資の特別償却40%又は税額控除4%、固定資産税の課税免除・不均一課税","period":"通年","application":"都道府県知事に認定申請","url":"https://www.meti.go.jp/policy/sme_chiiki/chiikimiraitoushi/","source":"経済産業省","requirements":["地域経済牽引事業計画の策定","付加価値の高い事業","地域への経済的波及効果"],"documents":["地域経済牽引事業計画承認申請書","事業計画書","地域への波及効果分析"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-MIRAI-KEIKAKU', 1);

-- #436 事業適応計画認定制度（産業競争力強化法）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JIGYOU-TEKIOU', '事業適応計画認定制度', 'METI', '経済産業省', '00', '["tax","certification"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JIGYOU-TEKIOU', 'manual', '事業適応計画認定制度（DX投資促進税制・CN投資促進税制）', NULL, '特別償却又は税額控除', '全国', '2026-04-01', '2027-03-31',
'{"overview":"DX投資又はカーボンニュートラル投資の事業適応計画が認定されると税制優遇を受けられる","target":"DX又はCN投資を行う企業（全規模）","amount":"DX投資：特別償却30%又は税額控除3〜5%、CN投資：特別償却50%又は税額控除5〜10%","period":"通年","application":"経済産業大臣に認定申請","url":"https://www.meti.go.jp/policy/economy/keiei_innovation/jigyou_saihen/jigyou-tekiou.html","source":"経済産業省","requirements":["DX又はCN投資計画の策定","生産性向上・CO2削減目標","認定支援機関の確認（中小企業の場合）"],"documents":["事業適応計画認定申請書","投資計画書","効果見込み書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JIGYOU-TEKIOU', 1);

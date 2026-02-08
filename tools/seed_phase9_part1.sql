-- Phase 9 Part 1: 新規50件の重要補助金・助成金（#137〜#186）
-- カテゴリ: 医療・福祉系、DX・テクノロジー系、地方自治体独自系、物流・運輸系、
--           食品・農林水産加工系、文化・クリエイティブ系、防災・BCP系、研究開発系

-- ====== 1. 医療・福祉・介護系 (10件) ======

-- #137 医療施設等設備整備費補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('IRYOU-SETSUBI', '医療施設等設備整備費補助金', 'MHLW', '厚生労働省', '00', '["health","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('IRYOU-SETSUBI', 'manual', '医療施設等設備整備費補助金', 50000000, '1/2〜2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"病院・診療所等の施設整備及び医療機器の整備を支援する補助金","target":"医療法人・社会福祉法人等の医療施設開設者","amount":"補助率1/2〜2/3（施設区分により異なる）","period":"令和8年度通年","application":"各都道府県を通じて申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/","source":"厚生労働省","requirements":["医療計画に基づく施設整備であること","地域医療構想に適合すること","耐震化・防災対策を含むこと"],"documents":["施設整備計画書","建築設計図書","収支計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'IRYOU-SETSUBI', 1);

-- #138 介護ロボット導入支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAIGO-ROBOT', '介護ロボット導入支援事業', 'MHLW', '厚生労働省', '00', '["health","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAIGO-ROBOT', 'manual', '介護ロボット導入支援事業', 1000000, '3/4', '全国', '2026-04-01', '2026-12-31',
'{"overview":"介護従事者の負担軽減を図るため、介護ロボット（移乗支援・移動支援・排泄支援・見守り・入浴支援・介護業務支援等）の導入を支援","target":"介護保険施設・事業所","amount":"1機器あたり上限100万円（補助率3/4）、見守りセンサー等は上限30万円","period":"令和8年度","application":"各都道府県の地域医療介護総合確保基金を通じて申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000209634.html","source":"厚生労働省","requirements":["介護保険法に基づく指定を受けた事業所","導入計画の策定","効果検証への協力"],"documents":["介護ロボット導入計画書","見積書","事業所の指定通知書の写し"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAIGO-ROBOT', 1);

-- #139 ICT導入支援事業（介護分野）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAIGO-ICT', '介護分野ICT導入支援事業', 'MHLW', '厚生労働省', '00', '["health","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAIGO-ICT', 'manual', '介護分野ICT導入支援事業', 2600000, '3/4', '全国', '2026-04-01', '2026-12-31',
'{"overview":"介護記録のICT化、情報共有システム等の導入を支援し、介護現場の生産性向上を図る","target":"介護保険施設・事業所","amount":"職員1人以上の事業所：上限100万円、職員11人以上：上限160万円、職員21人以上：上限200万円、職員31人以上：上限260万円","period":"令和8年度","application":"各都道府県の地域医療介護総合確保基金を通じて申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000209634.html","source":"厚生労働省","requirements":["LIFE（科学的介護情報システム）へのデータ提出","ケアプラン連携標準仕様の導入","他事業所との情報連携体制構築"],"documents":["ICT導入計画書","見積書","LIFE対応計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAIGO-ICT', 1);

-- #140 障害者就労支援設備等整備助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUGAI-SHUROU', '障害者就労支援設備等整備助成金', 'MHLW', '厚生労働省', '00', '["employment","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUGAI-SHUROU', 'manual', '障害者就労支援設備等整備助成金', 2400000, '3/4', '全国', '2026-04-01', '2027-03-31',
'{"overview":"障害者の職場適応を促進するための作業設備・福祉施設の整備費用を助成","target":"障害者を雇用する事業主","amount":"1件あたり上限240万円（補助率3/4）","period":"通年受付","application":"独立行政法人高齢・障害・求職者雇用支援機構に申請","url":"https://www.jeed.go.jp/disability/subsidy/","source":"厚生労働省（JEED）","requirements":["障害者雇用率を満たしていること","雇用管理に関する計画を策定すること"],"documents":["助成金支給申請書","障害者手帳の写し","設備見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUGAI-SHUROU', 1);

-- #141 医療情報化支援基金（電子カルテ標準化）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DENSHI-KARTE', '医療情報化支援基金（電子カルテ標準化等）', 'MHLW', '厚生労働省', '00', '["health","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DENSHI-KARTE', 'manual', '医療情報化支援基金（電子カルテ標準化等）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"医療機関における電子カルテシステムの導入・標準化対応を支援する基金事業","target":"病院・診療所","amount":"病院：上限1,000万円、診療所：上限200万円（補助率1/2）","period":"令和8年度","application":"社会保険診療報酬支払基金を通じて申請","url":"https://iryohokenjyoho.service-now.com/csm","source":"厚生労働省","requirements":["電子カルテの新規導入または標準規格対応","HL7 FHIR等の標準規格への対応","オンライン資格確認等システムとの連携"],"documents":["導入計画書","システム仕様書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DENSHI-KARTE', 1);

-- #142 保育所等整備交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HOIKUJO-SEIBI', '保育所等整備交付金', 'CFA', 'こども家庭庁', '00', '["health","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HOIKUJO-SEIBI', 'manual', '保育所等整備交付金', 100000000, '3/4', '全国', '2026-04-01', '2027-03-31',
'{"overview":"保育所・認定こども園等の新設・増改築・大規模修繕等を支援する交付金","target":"市区町村、社会福祉法人、学校法人等","amount":"施設整備費の3/4以内（国1/2、市区町村1/4）","period":"令和8年度","application":"市区町村を通じて申請","url":"https://www.cfa.go.jp/policies/hoiku/","source":"こども家庭庁","requirements":["待機児童解消に資する整備であること","地域の保育ニーズに基づく計画","耐震基準を満たす施設"],"documents":["施設整備計画書","設計図書","収支計画書","利用児童見込み数"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HOIKUJO-SEIBI', 1);

-- #143 放課後児童クラブ整備費補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HOUKAGO-JIDOU', '放課後児童クラブ整備費等補助金', 'CFA', 'こども家庭庁', '00', '["health","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HOUKAGO-JIDOU', 'manual', '放課後児童クラブ整備費等補助金', 70000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"放課後児童クラブ（学童保育）の施設整備・改修を支援","target":"市区町村、社会福祉法人等","amount":"新設：上限7,000万円、改修：上限2,000万円（補助率2/3）","period":"令和8年度","application":"市区町村を通じて申請","url":"https://www.cfa.go.jp/policies/kosodateshien/houkago/","source":"こども家庭庁","requirements":["放課後児童健全育成事業として届出","児童福祉法に基づく運営基準を満たすこと"],"documents":["整備計画書","設計図書","運営計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HOUKAGO-JIDOU', 1);

-- #144 勤労者退職金共済機構 建退共制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KENTAIKYO', '建設業退職金共済制度（建退共）', 'MHLW', '厚生労働省', '00', '["employment","construction"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KENTAIKYO', 'manual', '建設業退職金共済制度（建退共）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"建設業で働く労働者の退職金制度。事業主が掛金を納付し、労働者が退職時に退職金を受け取る共済制度","target":"建設業を営む事業主（元請・下請問わず）","amount":"掛金日額330円/日、新規加入時50日分の掛金を国が助成","period":"通年","application":"建退共都道府県支部で手続き","url":"https://www.kentaikyo.taisyokukin.go.jp/","source":"厚生労働省（建退共機構）","requirements":["建設業を営む事業主であること","労働者ごとに共済手帳を取得"],"documents":["共済契約申込書","労働者名簿"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KENTAIKYO', 1);

-- #145 ストレスチェック助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('STRESS-CHECK', 'ストレスチェック助成金', 'MHLW', '厚生労働省', '00', '["employment","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('STRESS-CHECK', 'manual', 'ストレスチェック助成金（小規模事業場向け）', 250000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"従業員50人未満の小規模事業場がストレスチェックを実施する際の費用を助成","target":"従業員50人未満の事業場","amount":"1従業員あたり500円（上限）＋ストレスチェック後の面接指導1回あたり21,500円（上限3回）","period":"令和8年度","application":"独立行政法人労働者健康安全機構に申請","url":"https://www.johas.go.jp/sangyouhoken/stresscheck/tabid/1005/Default.aspx","source":"厚生労働省（労働者健康安全機構）","requirements":["従業員50人未満の事業場","ストレスチェックの実施","産業医等による面接指導の実施"],"documents":["助成金支給申請書","ストレスチェック実施報告書","領収書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'STRESS-CHECK', 1);

-- #146 職場環境改善計画助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOKUBA-KAIZEN', '職場環境改善計画助成金', 'MHLW', '厚生労働省', '00', '["employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOKUBA-KAIZEN', 'manual', '職場環境改善計画助成金', 100000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"ストレスチェック後の集団分析結果を活用した職場環境改善計画の策定・実施を支援","target":"ストレスチェックの集団分析を実施した事業場","amount":"専門家活用コース：上限10万円、建設現場コース：上限10万円","period":"令和8年度","application":"独立行政法人労働者健康安全機構に申請","url":"https://www.johas.go.jp/sangyouhoken/stresscheck/tabid/1005/Default.aspx","source":"厚生労働省（労働者健康安全機構）","requirements":["ストレスチェック後の集団分析を実施","専門家の助言に基づく職場環境改善計画を策定"],"documents":["助成金支給申請書","集団分析結果","職場環境改善計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOKUBA-KAIZEN', 1);

-- ====== 2. DX・テクノロジー・サイバーセキュリティ系 (10件) ======

-- #147 サイバーセキュリティお助け隊サービス
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CYBER-OTASUKE', 'サイバーセキュリティお助け隊サービス制度', 'METI', '経済産業省', '00', '["digital","security"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CYBER-OTASUKE', 'manual', 'サイバーセキュリティお助け隊サービス制度', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業向けのサイバーセキュリティ対策パッケージサービス。IPA（情報処理推進機構）が認定したサービスを低価格で利用可能","target":"中小企業・小規模事業者","amount":"サービス利用料月額1万円程度〜（IT導入補助金セキュリティ対策推進枠との併用可）","period":"通年","application":"IPA認定サービス提供事業者を通じて利用","url":"https://www.ipa.go.jp/security/otasuketai-pr/","source":"IPA（情報処理推進機構）","requirements":["中小企業であること","認定サービスの利用開始"],"documents":["サービス利用申込書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CYBER-OTASUKE', 1);

-- #148 中小企業DX推進指標自己診断支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DX-SHINDAN', 'DX推進指標自己診断支援・DX認定制度', 'METI', '経済産業省', '00', '["digital","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DX-SHINDAN', 'manual', 'DX推進指標自己診断・DX認定制度', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"経済産業省のDX推進指標に基づく自己診断と、DX認定制度を通じた税制優遇・各種支援施策へのアクセスを支援","target":"全業種の中小企業〜大企業","amount":"DX認定取得により、DX投資促進税制（5%税額控除等）、日本政策金融公庫の低利融資等の優遇","period":"通年","application":"IPAのDX推進ポータルから申請","url":"https://www.meti.go.jp/policy/it_policy/investment/dx-nintei/dx-nintei.html","source":"経済産業省","requirements":["DX推進指標の自己診断実施","デジタルガバナンス・コードへの対応"],"documents":["DX認定申請書","デジタルガバナンス対応状況"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DX-SHINDAN', 1);

-- #149 AI活用実証事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('AI-KATSUYOU', 'AI活用高度化推進事業', 'METI', '経済産業省', '00', '["digital","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('AI-KATSUYOU', 'manual', 'AI活用高度化推進事業（中小企業向け）', 5000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"中小企業のAI導入・活用を支援し、業務効率化・生産性向上を図る実証事業","target":"中小企業・小規模事業者","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"NEDO・IPA等の公募に応じて申請","url":"https://www.meti.go.jp/policy/it_policy/jinzai/AI_utilization.html","source":"経済産業省","requirements":["AI導入による業務改善計画の策定","成果の公表への同意","専門家の伴走支援の受入"],"documents":["AI導入計画書","効果検証計画","事業計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'AI-KATSUYOU', 1);

-- #150 情報セキュリティ対策支援制度（SECURITY ACTION）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SECURITY-ACTION', 'SECURITY ACTION（情報セキュリティ自己宣言）', 'IPA', '情報処理推進機構', '00', '["digital","security"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SECURITY-ACTION', 'manual', 'SECURITY ACTION制度（IT導入補助金の申請要件）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業が情報セキュリティ対策に自ら取り組むことを宣言する制度。IT導入補助金の申請要件","target":"中小企業・小規模事業者","amount":"制度自体は無料。SECURITY ACTION宣言がIT導入補助金等の申請要件","period":"通年","application":"IPAのSECURITY ACTIONポータルから宣言","url":"https://www.ipa.go.jp/security/security-action/","source":"IPA（情報処理推進機構）","requirements":["一つ星：情報セキュリティ5か条への取組","二つ星：5分でできる自社診断シートの実施"],"documents":["自己宣言書（オンライン）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SECURITY-ACTION', 1);

-- #151 デジタル人材育成プラットフォーム
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DIGITAL-JINZAI', 'デジタル人材育成プラットフォーム（マナビDX）', 'METI', '経済産業省', '00', '["digital","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DIGITAL-JINZAI', 'manual', 'デジタル人材育成プラットフォーム（マナビDX・マナビDX Quest）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"デジタルスキル標準に準じたデジタル人材育成講座を無料〜低価格で提供するプラットフォーム","target":"個人・企業","amount":"マナビDXポータル：無料〜有料講座掲載、マナビDX Quest：実践プログラム（一部無料）","period":"通年","application":"マナビDXポータルから講座受講","url":"https://manabi-dx.ipa.go.jp/","source":"経済産業省・IPA","requirements":["受講登録","企業の場合はDXリテラシー標準に基づく育成計画の策定推奨"],"documents":["受講登録（オンライン）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DIGITAL-JINZAI', 1);

-- #152 クラウド利用促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CLOUD-SOKUSHIN', 'クラウドサービス利用促進・安全評価制度（ISMAP）', 'NISC', '内閣サイバーセキュリティセンター', '00', '["digital","security"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CLOUD-SOKUSHIN', 'manual', 'ISMAP（政府情報システムのためのセキュリティ評価制度）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"政府が求めるセキュリティ基準を満たしたクラウドサービスをリスト化。政府調達の前提要件","target":"クラウドサービス提供事業者","amount":"ISMAP認定取得により政府調達参加資格。ISMAP-LIU（低リスク向け）は中小向けの簡易評価あり","period":"通年","application":"ISMAP管理基準に基づく評価を受けて申請","url":"https://www.ismap.go.jp/","source":"デジタル庁・総務省・経済産業省","requirements":["ISMAP管理基準への適合","第三者監査の実施"],"documents":["申請書","監査報告書","セキュリティポリシー"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CLOUD-SOKUSHIN', 1);

-- #153 テレワーク推進強化奨励金（東京都以外の自治体向け）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TELEWORK-MHLW', 'テレワークに関する助成・支援（厚労省）', 'MHLW', '厚生労働省', '00', '["employment","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TELEWORK-MHLW', 'manual', '厚生労働省テレワーク推進関連支援策', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"テレワーク導入に関する厚生労働省の各種支援策（相談センター、ガイドライン、好事例集等）","target":"テレワーク導入を検討する企業","amount":"テレワーク相談センター：無料、コンサルティング支援：無料、人材確保等支援助成金テレワークコースと併用可","period":"通年","application":"テレワーク相談センターへ相談","url":"https://telework.mhlw.go.jp/","source":"厚生労働省","requirements":["テレワーク導入・拡大を検討中の企業"],"documents":["相談申込書（オンライン可）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TELEWORK-MHLW', 1);

-- #154 中小企業デジタル化応援隊
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DIGITAL-OUEN', 'みらデジ（デジタル化支援ポータル）', 'METI', '経済産業省', '00', '["digital","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DIGITAL-OUEN', 'manual', 'みらデジ（中小企業デジタル化支援ポータルサイト）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業のデジタル化を総合的に支援するポータル。経営課題のデジタル化診断から、支援施策のマッチングまで一気通貫で提供","target":"中小企業・小規模事業者","amount":"利用無料。デジタル化診断→課題可視化→支援施策紹介→専門家伴走支援","period":"通年","application":"みらデジポータルサイトから登録","url":"https://www.miradigi.go.jp/","source":"経済産業省","requirements":["みらデジ経営チェックの実施（IT導入補助金の加点要件にもなる）"],"documents":["オンライン登録のみ"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DIGITAL-OUEN', 1);

-- #155 Web3.0関連事業支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('WEB3-SHIEN', 'Web3.0・ブロックチェーン関連事業支援', 'METI', '経済産業省', '00', '["digital","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('WEB3-SHIEN', 'manual', 'Web3.0・ブロックチェーン技術を活用した事業支援', 30000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"ブロックチェーン技術やDAO等のWeb3.0技術を活用したサービス開発・実証を支援","target":"Web3.0関連事業を行う企業・スタートアップ","amount":"NEDO各種事業：上限3,000万円程度（プログラムにより異なる）","period":"令和8年度","application":"NEDO・経済産業省の公募に応じて申請","url":"https://www.meti.go.jp/policy/economy/keiei_innovation/sangyotech/web3.html","source":"経済産業省","requirements":["Web3.0技術を活用した具体的な事業計画","社会実装の見通し","成果の公表"],"documents":["事業計画書","技術仕様書","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'WEB3-SHIEN', 1);

-- #156 半導体・デジタル産業基盤強化
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HANDOUTAI-KIBAN', '半導体・デジタル産業基盤強化推進事業', 'METI', '経済産業省', '00', '["digital","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HANDOUTAI-KIBAN', 'manual', '半導体・デジタル産業基盤強化推進事業（ポスト5G基金含む）', NULL, '1/3〜1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"半導体の設計・製造・後工程等のサプライチェーン全体の強靱化を図る大規模支援事業","target":"半導体関連企業、デジタルインフラ事業者","amount":"事業規模数十億〜数兆円規模（TSMC関連等の大型案件含む）、中小向けは研究開発助成等","period":"令和8年度","application":"NEDO等の公募に応じて申請","url":"https://www.meti.go.jp/policy/mono_info_service/joho/semiconductor.html","source":"経済産業省","requirements":["半導体関連事業の実績","国内生産体制の強化に資すること","経済安全保障上の重要性"],"documents":["事業計画書","設備投資計画","技術仕様書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HANDOUTAI-KIBAN', 1);

-- ====== 3. 物流・運輸・モビリティ系 (8件) ======

-- #157 トラック運送事業者燃料費高騰対策
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TRUCK-NENRYO', 'トラック運送事業者燃料価格高騰対策支援', 'MLIT', '国土交通省', '00', '["logistics","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TRUCK-NENRYO', 'manual', 'トラック運送事業者燃料価格高騰対策・省エネ支援', 5000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"トラック運送事業者の燃料費高騰への対策として、省エネ設備導入や燃費改善を支援","target":"一般貨物自動車運送事業者、貨物軽自動車運送事業者","amount":"エコタイヤ・デジタコ等省エネ機器導入：上限500万円（補助率1/2）","period":"令和8年度","application":"全日本トラック協会等を通じて申請","url":"https://www.mlit.go.jp/jidosha/jidosha_tk2_000073.html","source":"国土交通省","requirements":["貨物運送事業の許可を有すること","省エネ計画の策定"],"documents":["申請書","車両一覧","省エネ機器見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TRUCK-NENRYO', 1);

-- #158 物流DX推進事業（2024年問題対策）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUTSURYU-DX', '物流効率化・DX推進事業', 'MLIT', '国土交通省', '00', '["logistics","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUTSURYU-DX', 'manual', '物流効率化・DX推進事業（物流2024年問題対策）', 30000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"物流の2024年問題（ドライバーの時間外労働上限規制）への対策として、DX・自動化・共同配送等を支援","target":"物流事業者、荷主企業","amount":"物流DXシステム導入：上限3,000万円（補助率1/2）、自動荷役機器：上限5,000万円","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/seisakutokatsu/freight/butsuryu_2024.html","source":"国土交通省","requirements":["物流改善計画の策定","荷主・物流事業者の連携体制","KPIの設定と効果検証"],"documents":["事業計画書","物流改善計画","投資計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUTSURYU-DX', 1);

-- #159 グリーン物流パートナーシップ支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GREEN-BUTSURYU', 'グリーン物流パートナーシップ会議支援事業', 'MLIT', '国土交通省', '00', '["logistics","green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GREEN-BUTSURYU', 'manual', 'グリーン物流パートナーシップ会議・物流CO2削減支援', 20000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"物流分野のCO2排出削減を目的に、モーダルシフト・共同輸配送・EVトラック導入等を支援","target":"物流事業者と荷主企業のパートナーシップ","amount":"モーダルシフト等補助金：上限2,000万円（補助率1/2）","period":"令和8年度","application":"国土交通省・経済産業省の共同公募","url":"https://www.greenpartnership.jp/","source":"国土交通省・経済産業省","requirements":["荷主と物流事業者の連携","CO2削減目標の設定","モーダルシフト等の具体的計画"],"documents":["事業計画書","CO2削減計画","連携協定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GREEN-BUTSURYU', 1);

-- #160 タクシー・バス事業者支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TAXI-BUS-SHIEN', '地域公共交通確保維持改善事業', 'MLIT', '国土交通省', '00', '["logistics","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TAXI-BUS-SHIEN', 'manual', '地域公共交通確保維持改善事業費補助金', NULL, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方部のバス路線・デマンド交通等の維持・確保、利便性向上を支援する補助金","target":"地方公共団体、バス・タクシー事業者","amount":"幹線バス補助：欠損額の1/2、地域内フィーダー補助：欠損額の1/2、車両購入補助等","period":"令和8年度","application":"地方運輸局を通じて申請","url":"https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000055.html","source":"国土交通省","requirements":["地域公共交通計画に基づく事業","地域関係者の合意形成","持続可能性の確保"],"documents":["事業計画書","収支計画","地域公共交通計画との整合性資料"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TAXI-BUS-SHIEN', 1);

-- #161 自動運転実証事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JIDOU-UNTEN', '自動運転実証調査事業', 'MLIT', '国土交通省', '00', '["logistics","innovation","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JIDOU-UNTEN', 'manual', '自動運転実証調査事業・地域における自動運転サービス導入支援', 50000000, '1/2〜10/10', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域における自動運転サービスの社会実装を推進するための実証事業支援","target":"地方公共団体、自動運転関連企業、交通事業者","amount":"実証事業：上限5,000万円程度（定額補助〜1/2補助）","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/jidosha/jidosha_tk7_000067.html","source":"国土交通省","requirements":["自動運転レベル4以上を目指す実証計画","地域の交通課題解決に資すること","安全確保計画の策定"],"documents":["実証計画書","安全確保計画","地域連携体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JIDOU-UNTEN', 1);

-- #162 内航海運・船舶省エネ化
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NAIKO-KAIUNN', '内航海運省エネルギー化推進事業', 'MLIT', '国土交通省', '00', '["logistics","green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NAIKO-KAIUNN', 'manual', '内航海運省エネルギー化推進事業費補助金', 100000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"内航船舶の省エネ性能向上のための設備導入・建造を支援する補助金","target":"内航海運事業者","amount":"省エネ設備導入：補助率1/3、代替燃料船建造支援等","period":"令和8年度","application":"国土交通省海事局の公募に応じて申請","url":"https://www.mlit.go.jp/maritime/maritime_tk1_000076.html","source":"国土交通省","requirements":["内航海運業法に基づく事業者","省エネ効果の定量的計画","CO2削減目標の設定"],"documents":["事業計画書","省エネ効果算定書","船舶仕様書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NAIKO-KAIUNN', 1);

-- #163 ドローン物流実証事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DRONE-BUTSURYU', 'ドローンを活用した物流実証事業', 'MLIT', '国土交通省', '00', '["logistics","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DRONE-BUTSURYU', 'manual', 'ドローン物流サービス社会実装推進事業', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"過疎地域等におけるドローンを活用した物流サービスの社会実装を推進する実証事業","target":"物流事業者、地方公共団体、ドローン関連企業","amount":"実証事業費：上限3,000万円程度（定額補助）","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/kouku/drone_logistics.html","source":"国土交通省","requirements":["レベル3.5〜4飛行を目指す実証計画","地域の物流課題解決","安全管理体制の構築"],"documents":["実証計画書","安全管理体制","飛行計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DRONE-BUTSURYU', 1);

-- #164 MaaS推進関連事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MAAS-SUISHIN', 'MaaS（次世代モビリティサービス）推進事業', 'MLIT', '国土交通省', '00', '["logistics","digital","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MAAS-SUISHIN', 'manual', 'MaaS推進・スマートモビリティチャレンジ事業', 30000000, '定額〜1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域の移動課題を解決するMaaS（Mobility as a Service）の実装を支援。複数交通モードの統合、デマンド交通等","target":"地方公共団体、交通事業者、MaaS関連企業","amount":"実証事業：上限3,000万円程度","period":"令和8年度","application":"国土交通省・経済産業省の公募に応じて申請","url":"https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000117.html","source":"国土交通省・経済産業省","requirements":["地域の交通課題の明確化","複数事業者間の連携","持続可能なビジネスモデルの構築"],"documents":["事業計画書","連携体制図","持続可能性計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MAAS-SUISHIN', 1);

-- ====== 4. 食品加工・6次産業化・農業テック系 (8件) ======

-- #165 食品製造業等生産性向上支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOKUHIN-SEISAN', '食品製造業等生産性向上促進事業', 'MAFF', '農林水産省', '00', '["food","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOKUHIN-SEISAN', 'manual', '食品製造業等生産性向上促進事業', 50000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"食品製造業における生産性向上のための設備導入・自動化・HACCP対応等を支援","target":"食品製造業者","amount":"設備導入：上限5,000万円（補助率1/2）","period":"令和8年度","application":"農林水産省の公募に応じて申請","url":"https://www.maff.go.jp/j/shokusan/seizo/seisansei.html","source":"農林水産省","requirements":["食品製造業であること","生産性向上計画の策定","HACCP対応"],"documents":["事業計画書","設備投資計画","生産性向上効果の見込み"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOKUHIN-SEISAN', 1);

-- #166 6次産業化ネットワーク活動交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ROKUJI-SANGYOU', '6次産業化ネットワーク活動交付金', 'MAFF', '農林水産省', '00', '["agriculture","food"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ROKUJI-SANGYOU', 'manual', '6次産業化ネットワーク活動交付金', 30000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"農林漁業者が加工・販売等の6次産業化に取り組む際の計画策定から事業化までを一体的に支援","target":"農林漁業者、6次産業化プランナー、食品事業者","amount":"事業化段階：上限3,000万円（補助率1/2）、加工施設整備等","period":"令和8年度","application":"六次産業化・地産地消法に基づく総合化事業計画の認定を受けて申請","url":"https://www.maff.go.jp/j/shokusan/sanki/6jika.html","source":"農林水産省","requirements":["総合化事業計画の認定","農林漁業者が主体であること","加工・販売等の新たな取組"],"documents":["総合化事業計画書","収支計画","投資計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ROKUJI-SANGYOU', 1);

-- #167 スマート農業総合推進対策事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SMART-AGRI', 'スマート農業総合推進対策事業', 'MAFF', '農林水産省', '00', '["agriculture","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SMART-AGRI', 'manual', 'スマート農業総合推進対策事業費補助金', 15000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"ロボット・AI・IoT等の先端技術を活用したスマート農業の普及を推進する事業","target":"農業者、農業法人、農業協同組合","amount":"実証事業：上限1,500万円（補助率1/2）、スマート農業機械の導入支援","period":"令和8年度","application":"農林水産省・地方農政局の公募に応じて申請","url":"https://www.maff.go.jp/j/kanbo/smart/","source":"農林水産省","requirements":["スマート農業技術の実証計画","産地レベルでの普及展開計画","データの活用と共有"],"documents":["実証計画書","スマート農業技術仕様書","普及展開計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SMART-AGRI', 1);

-- #168 輸出向け施設整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YUSHUTSU-SHISETSU', '農林水産物・食品輸出促進対策事業（施設整備）', 'MAFF', '農林水産省', '00', '["agriculture","food","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YUSHUTSU-SHISETSU', 'manual', '農林水産物・食品輸出促進対策事業費補助金（施設整備）', 100000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"農林水産物・食品の輸出拡大に向けた施設整備（冷凍・冷蔵施設、加工施設等）を支援","target":"輸出に取り組む食品製造業者、農林漁業者","amount":"施設整備：上限1億円（補助率1/2）","period":"令和8年度","application":"農林水産省の公募に応じて申請","url":"https://www.maff.go.jp/j/shokusan/export/e_kikaku.html","source":"農林水産省","requirements":["輸出事業計画の策定","HACCP・ISO22000等の認証取得計画","輸出先国の基準への適合"],"documents":["輸出事業計画書","施設設計図書","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'YUSHUTSU-SHISETSU', 1);

-- #169 有機農業推進総合対策事業（みどりの食料システム戦略）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YUUKI-NOUGYOU', '有機農業推進総合対策事業', 'MAFF', '農林水産省', '00', '["agriculture","green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YUUKI-NOUGYOU', 'manual', '有機農業推進総合対策事業（みどりの食料システム戦略関連）', 10000000, '定額〜1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"有機農業の拡大に向けた栽培技術の開発・普及、産地づくり、販路開拓等を総合的に支援","target":"有機農業者、市区町村、農業団体","amount":"産地づくり事業：上限1,000万円、技術支援・販路開拓等","period":"令和8年度","application":"農林水産省の公募に応じて申請","url":"https://www.maff.go.jp/j/seisan/kankyo/yuuki/","source":"農林水産省","requirements":["有機JAS認証の取得または取得計画","産地ぐるみの取組体制","みどりの食料システム法に基づく計画"],"documents":["事業計画書","有機JAS認証関連書類","産地づくり計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'YUUKI-NOUGYOU', 1);

-- #170 畜産クラスター事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIKUSAN-CLUSTER', '畜産クラスター事業', 'MAFF', '農林水産省', '00', '["agriculture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIKUSAN-CLUSTER', 'manual', '畜産クラスター事業（畜産・酪農収益力強化整備等特別対策事業）', 500000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"地域の関係者が連携した畜産クラスター計画に基づく施設整備・機械導入を支援","target":"畜産クラスター協議会の構成員（畜産経営体等）","amount":"施設整備：上限5億円（補助率1/2以内）","period":"令和8年度","application":"都道府県を通じて申請","url":"https://www.maff.go.jp/j/chikusan/kikaku/chikusan_cluster.html","source":"農林水産省","requirements":["畜産クラスター計画の策定","地域の畜産関係者の連携","収益力向上の数値目標"],"documents":["畜産クラスター計画書","施設整備計画","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIKUSAN-CLUSTER', 1);

-- #171 林業成長産業化推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RINGYOU-SEICHOU', '林業・木材産業成長産業化推進対策', 'MAFF', '農林水産省（林野庁）', '00', '["agriculture","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RINGYOU-SEICHOU', 'manual', '林業・木材産業成長産業化推進対策交付金', 50000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"林業・木材産業の成長産業化のための路網整備、高性能林業機械導入、木材加工施設整備等を支援","target":"森林組合、林業事業体、木材加工業者","amount":"高性能林業機械導入：上限5,000万円（補助率1/2）","period":"令和8年度","application":"都道府県を通じて申請","url":"https://www.rinya.maff.go.jp/j/rinsei/yosankesan/ringyou_seichou.html","source":"林野庁","requirements":["林業経営計画の認定","森林経営管理制度への対応","担い手確保計画"],"documents":["事業計画書","林業経営計画","設備投資計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RINGYOU-SEICHOU', 1);

-- #172 水産業成長産業化推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SUISAN-SEICHOU', '水産業成長産業化沿岸地域創出事業', 'MAFF', '農林水産省（水産庁）', '00', '["agriculture","food"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SUISAN-SEICHOU', 'manual', '水産業成長産業化沿岸地域創出事業', 50000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"漁業の成長産業化のための養殖拡大、水産加工施設整備、スマート水産業の導入等を支援","target":"漁業協同組合、水産加工業者、漁業者","amount":"施設整備：上限5,000万円（補助率1/2）","period":"令和8年度","application":"水産庁の公募に応じて申請","url":"https://www.jfa.maff.go.jp/j/budget/","source":"水産庁","requirements":["浜の活力再生プランの策定","収益力向上の目標設定","水産資源の持続的利用"],"documents":["事業計画書","浜の活力再生プラン","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SUISAN-SEICHOU', 1);

-- ====== 5. 文化・クリエイティブ・コンテンツ系 (6件) ======

-- #173 コンテンツ海外展開促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CONTENTS-KAIGAI', 'コンテンツ海外展開促進事業', 'METI', '経済産業省', '00', '["culture","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CONTENTS-KAIGAI', 'manual', 'コンテンツ海外展開促進・基盤強化事業費補助金', 50000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"日本のアニメ・ゲーム・映画・音楽等のコンテンツの海外展開を支援する補助金","target":"コンテンツ制作会社、出版社、ゲーム会社等","amount":"海外展開事業：上限5,000万円（補助率1/2）","period":"令和8年度","application":"経済産業省の公募に応じて申請","url":"https://www.meti.go.jp/policy/mono_info_service/contents/","source":"経済産業省","requirements":["海外展開計画の策定","コンテンツの権利を有すること","収益化計画"],"documents":["事業計画書","海外展開計画","コンテンツ概要資料"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CONTENTS-KAIGAI', 1);

-- #174 文化芸術活動特別支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUNKA-GEIJUTSU', '文化芸術活動基盤強化事業', 'MEXT', '文部科学省（文化庁）', '00', '["culture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUNKA-GEIJUTSU', 'manual', '文化芸術活動基盤強化事業（文化庁）', 20000000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"文化芸術団体等の活動基盤強化、公演・展覧会等の実施を支援する事業","target":"文化芸術団体、劇場・音楽堂、美術館等","amount":"公演等実施：上限2,000万円（定額補助）","period":"令和8年度","application":"文化庁の公募に応じて申請","url":"https://www.bunka.go.jp/shinsei_boshu/","source":"文化庁","requirements":["文化芸術活動の実績","入場料収入等の見込み","次年度以降の継続計画"],"documents":["事業計画書","公演等企画書","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUNKA-GEIJUTSU', 1);

-- #175 伝統的工芸品産業支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DENTOU-KOUGEI', '伝統的工芸品産業支援補助金', 'METI', '経済産業省', '00', '["culture","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DENTOU-KOUGEI', 'manual', '伝統的工芸品産業支援補助金', 20000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"伝統的工芸品産業の振興を図るための後継者育成、需要開拓、産地振興等を支援","target":"伝統的工芸品の製造事業者、産地組合","amount":"各事業上限2,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省の公募に応じて申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/nichiyo-densan/","source":"経済産業省","requirements":["伝統的工芸品産業振興法に基づく指定を受けた産地","振興計画の策定"],"documents":["事業計画書","産地振興計画","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DENTOU-KOUGEI', 1);

-- #176 映像コンテンツ制作支援（ロケーション支援）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('EIZOU-LOCATION', '映像制作支援（ロケーションジャパン・ロケ誘致等）', 'METI', '経済産業省', '00', '["culture","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('EIZOU-LOCATION', 'manual', '映像コンテンツ制作支援（ロケーション支援・ロケ誘致）', 20000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"映画・ドラマ・アニメ等の制作を地域で行う際のロケ支援、インセンティブ制度","target":"映像制作会社、地方公共団体（フィルムコミッション）","amount":"ロケ支援：上限2,000万円程度（補助率1/2）、各自治体の独自制度もあり","period":"令和8年度","application":"各地域のフィルムコミッション、経済産業省等に相談","url":"https://www.meti.go.jp/policy/mono_info_service/contents/movie_incentive.html","source":"経済産業省","requirements":["日本国内でのロケーション撮影","地域経済への波及効果","映像作品の完成・公開計画"],"documents":["企画書","ロケ計画","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'EIZOU-LOCATION', 1);

-- #177 デザイン経営支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DESIGN-KEIEI', 'デザイン経営・知的財産経営支援事業', 'METI', '経済産業省', '00', '["management","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DESIGN-KEIEI', 'manual', 'デザイン経営宣言に基づく知的財産経営支援', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"デザイン経営（デザイン思考を経営に活かす）の導入を支援。特許庁のIP経営支援等と連携","target":"中小企業","amount":"デザイン経営ハンドブック・セミナー：無料、知財経営コンサルティング：無料〜一部有償","period":"通年","application":"特許庁INPIT、各地域知財総合支援窓口に相談","url":"https://www.jpo.go.jp/support/chusho/design-keiei.html","source":"経済産業省・特許庁","requirements":["デザイン経営の導入意欲","経営課題の明確化"],"documents":["相談申込書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DESIGN-KEIEI', 1);

-- #178 地域文化財総合活用推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUNKAZAI-KATSUYOU', '地域文化財総合活用推進事業', 'MEXT', '文部科学省（文化庁）', '00', '["culture","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUNKAZAI-KATSUYOU', 'manual', '地域文化財総合活用推進事業', 10000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"地域の文化財を活用した観光振興、まちづくり、教育普及活動等を支援","target":"市区町村、文化財保存活用団体","amount":"事業費上限1,000万円（補助率1/2）","period":"令和8年度","application":"都道府県を通じて文化庁に申請","url":"https://www.bunka.go.jp/seisaku/bunkazai/","source":"文化庁","requirements":["文化財保存活用地域計画の策定","地域の文化財の活用計画","持続可能な運営計画"],"documents":["事業計画書","文化財保存活用地域計画","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUNKAZAI-KATSUYOU', 1);

-- ====== 6. 防災・BCP・レジリエンス系 (8件) ======

-- #179 中小企業BCP策定支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BCP-SAKUTEI', '中小企業BCP策定運用指針に基づく支援', 'METI', '経済産業省（中小企業庁）', '00', '["management","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BCP-SAKUTEI', 'manual', '中小企業BCP策定運用指針・事業継続力強化計画認定制度', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業がBCP（事業継続計画）を策定し、事業継続力強化計画の認定を受けることで各種支援を受けられる制度","target":"中小企業・小規模事業者","amount":"認定取得により、信用保証枠の拡大（通常の2倍）、税制優遇（防災・減災投資促進税制）、補助金加点","period":"通年","application":"経済産業局に認定申請","url":"https://www.chusho.meti.go.jp/keiei/antei/bousai/keizokuryoku.htm","source":"中小企業庁","requirements":["事業継続力強化計画の策定","自然災害等のリスクの特定","初動対応手順の策定"],"documents":["事業継続力強化計画書","リスク分析資料"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BCP-SAKUTEI', 1);

-- #180 防災・安全交付金（社会資本整備総合交付金）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BOUSAI-ANZEN', '防災・安全交付金', 'MLIT', '国土交通省', '00', '["disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BOUSAI-ANZEN', 'manual', '防災・安全交付金（社会資本整備総合交付金の防災分）', NULL, '1/2〜2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方公共団体のインフラ老朽化対策、防災・減災対策等の社会資本整備を支援する交付金","target":"地方公共団体","amount":"事業費の1/2〜2/3（事業種別により異なる）","period":"令和8年度","application":"地方公共団体が国土交通省に計画を提出","url":"https://www.mlit.go.jp/sogoseisaku/region/sougouseisaku_region_fr_000004.html","source":"国土交通省","requirements":["社会資本総合整備計画の策定","防災・減災対策の必要性","国土強靱化地域計画との整合"],"documents":["社会資本総合整備計画","事前評価書","事業計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BOUSAI-ANZEN', 1);

-- #181 グループ補助金（災害復旧）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GROUP-HOJO', 'グループ補助金（中小企業等グループ施設等復旧整備補助事業）', 'METI', '経済産業省', '00', '["disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GROUP-HOJO', 'manual', 'グループ補助金（中小企業等グループ施設等復旧整備補助事業）', 150000000, '3/4', '被災地域', '2026-04-01', '2027-03-31',
'{"overview":"大規模災害で被災した中小企業等がグループを形成し、復旧計画を策定して施設・設備の復旧を行う際の費用を補助","target":"被災した中小企業等のグループ","amount":"上限1.5億円（補助率3/4：国1/2、県1/4）","period":"災害発生後に随時公募","application":"都道府県を通じて申請","url":"https://www.chusho.meti.go.jp/earthquake2011/download/GH-hojo.html","source":"経済産業省（中小企業庁）","requirements":["被災地域の中小企業等であること","グループの復旧計画の策定","地域経済の復興に資する事業"],"documents":["復旧計画書","被災状況報告書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GROUP-HOJO', 1);

-- #182 耐震改修促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TAISHIN-KAISHU', '建築物耐震改修促進事業', 'MLIT', '国土交通省', '00', '["disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TAISHIN-KAISHU', 'manual', '建築物耐震改修促進事業（耐震診断・耐震改修補助金）', 60000000, '1/3〜2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"旧耐震基準の建築物の耐震診断・耐震改修を促進するための補助金","target":"建築物の所有者（民間企業、個人等）","amount":"耐震診断：補助率2/3、耐震改修：上限6,000万円（補助率1/3〜23%）","period":"令和8年度","application":"市区町村を通じて申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr_000043.html","source":"国土交通省","requirements":["1981年以前の旧耐震基準の建築物","耐震診断の結果、耐震性能不足と判定","耐震改修計画の策定"],"documents":["耐震診断報告書","耐震改修計画書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TAISHIN-KAISHU', 1);

-- #183 災害時事業継続性強化計画認定（中小企業強靱化法）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KYOUJINKA-NINTEI', '事業継続力強化計画認定制度', 'METI', '経済産業省', '00', '["management","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KYOUJINKA-NINTEI', 'manual', '事業継続力強化計画認定制度（中小企業強靱化法）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業が自然災害等のリスクに備えるための事業継続力強化計画を経済産業大臣が認定する制度","target":"中小企業・小規模事業者","amount":"認定メリット：①金融支援（信用保証枠拡大）②税制優遇（防災・減災投資促進税制20%特別償却）③補助金加点④損害保険料の優遇","period":"通年申請","application":"中小企業庁のフォームから電子申請","url":"https://www.chusho.meti.go.jp/keiei/antei/bousai/keizokuryoku.htm","source":"中小企業庁","requirements":["自然災害リスクの認識","被害想定","初動対応体制の整備","自社の経営資源の把握"],"documents":["事業継続力強化計画申請書（様式第1）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KYOUJINKA-NINTEI', 1);

-- #184 国土強靱化関連融資
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOKUDO-KYOUJIN', '国土強靱化関連融資（社会環境対応施設整備資金）', 'JFC', '日本政策金融公庫', '00', '["finance","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOKUDO-KYOUJIN', 'manual', '社会環境対応施設整備資金（BCP関連融資）', 72000000, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"事業継続力強化計画認定を受けた中小企業が防災・減災設備に投資する際の低利融資","target":"事業継続力強化計画の認定を受けた中小企業","amount":"融資限度額7,200万円（基準利率-0.9%の特別利率）","period":"通年","application":"日本政策金融公庫の支店に申込","url":"https://www.jfc.go.jp/n/finance/search/syakaikankyou.html","source":"日本政策金融公庫","requirements":["事業継続力強化計画の認定取得","防災・減災関連設備への投資"],"documents":["事業継続力強化計画認定書","設備投資計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOKUDO-KYOUJIN', 1);

-- #185 消防施設等整備費補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUBOU-SEIBI', '消防施設等整備費補助金', 'FDMA', '総務省消防庁', '00', '["disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUBOU-SEIBI', 'manual', '消防施設等整備費補助金', NULL, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"市区町村の消防力の充実強化を図るため、消防施設・消防車両等の整備を支援する補助金","target":"市区町村","amount":"消防庁舎：補助率1/3、消防車両・資機材等","period":"令和8年度","application":"総務省消防庁の公募に応じて申請","url":"https://www.fdma.go.jp/mission/prepare/post6.html","source":"総務省消防庁","requirements":["消防力の整備指針に基づく整備計画","市区町村消防の充実強化"],"documents":["整備計画書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUBOU-SEIBI', 1);

-- #186 被災中小企業復興支援（なりわい再建補助金）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NARIWAI-SAIKEN', 'なりわい再建支援補助金', 'METI', '経済産業省', '00', '["disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NARIWAI-SAIKEN', 'manual', 'なりわい再建支援補助金（被災中小企業・小規模事業者再建支援）', 50000000, '3/4', '被災地域', '2026-04-01', '2027-03-31',
'{"overview":"大規模災害で被災した中小企業の事業再建のため、施設・設備の復旧費用を補助","target":"被災した中小企業・小規模事業者","amount":"上限5,000万円（補助率3/4、小規模事業者は定額補助もあり）","period":"災害発生後に随時公募","application":"各都道府県の窓口に申請","url":"https://www.chusho.meti.go.jp/earthquake2011/download/nariwai.html","source":"経済産業省（中小企業庁）","requirements":["被災地域の中小企業であること","り災証明書の取得","復旧計画の策定"],"documents":["交付申請書","り災証明書","復旧計画書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NARIWAI-SAIKEN', 1);

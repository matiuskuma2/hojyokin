-- =============================================
-- 2026年度 主要補助金データ 一括投入・更新スクリプト
-- 実行日: 2026-02-08
-- 対象: 新規5件 + 既存修復5件 + 期限切れ更新3件
-- =============================================

-- =============================================
-- 1. 新規追加: ものづくり補助金 第23次公募（2026年2月6日公開）
-- =============================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json,
  cached_at, expires_at,
  wall_chat_ready, wall_chat_missing, detail_score,
  wall_chat_excluded, wall_chat_mode, is_electronic_application, is_visible
) VALUES (
  'MONODUKURI-23',
  'manual',
  'ものづくり・商業・サービス生産性向上促進補助金（第23次公募）',
  40000000,
  '中小企業1/2、小規模・再生2/3',
  '全国',
  '全業種',
  '中小企業・小規模事業者',
  '2026-04-03T17:00:00Z',
  '2026-05-08T17:00:00Z',
  1,
  '{"id":"MONODUKURI-23","title":"ものづくり・商業・サービス生産性向上促進補助金（第23次公募）","official_name":"ものづくり・商業・サービス生産性向上促進補助金","round":"第23次公募","description":"中小企業・小規模事業者等が取り組む革新的な製品・サービスの開発、生産プロセスの省力化に必要な設備投資等を支援します。2026年度は賃上げ要件の強化と大幅賃上げ特例が拡充されています。","subsidy_amount":{"description":"従業員数により補助上限額が変動","tiers":[{"employees":"5人以下","normal":7500000,"with_wage_increase":8500000},{"employees":"6〜20人","normal":10000000,"with_wage_increase":12500000},{"employees":"21〜50人","normal":15000000,"with_wage_increase":25000000},{"employees":"51人以上","normal":25000000,"with_wage_increase":35000000}],"special_condition":"大幅賃上げを行う場合は()内の金額に引上げ"},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"1/2"},{"type":"小規模企業者・小規模事業者","rate":"2/3"},{"type":"再生事業者","rate":"2/3"},{"type":"賃金特例適用","rate":"2/3（通常1/2の事業者が引上げ）"}]},"target_area_search":"全国","target_industry":"全業種（製造業、サービス業、商業等）","target_number_of_employees":"中小企業基本法に定める中小企業者","eligibility_requirements":{"basic":["日本国内に法人登記があり、国内で事業を営む中小企業等","GビズIDプライムアカウントを取得していること","みなし大企業に該当しないこと"],"mandatory_commitments":[{"item":"労働生産性向上","requirement":"事業計画期間（3〜5年）で年平均成長率+4.0%以上向上"},{"item":"賃上げ","requirement":"1人当たり給与支給総額を年平均成長率+3.5%以上増加"},{"item":"最低賃金","requirement":"事業場内最低賃金を都道府県別最低賃金+30円以上に設定"}]},"eligible_expenses":[{"category":"機械装置・システム構築費","description":"単価50万円（税抜）以上の設備投資","required":true},{"category":"技術導入費","description":"知的財産権等の導入に要する経費"},{"category":"専門家経費","description":"技術指導等の専門家活用"},{"category":"運搬費","description":"設備の運搬に必要な経費"},{"category":"クラウドサービス利用費","description":"クラウドサービスの利用料"}],"schedule":{"公募要領公開":"2026年2月6日","電子申請受付":"2026年4月3日17:00〜","申請締切":"2026年5月8日17:00","採択公表":"2026年8月上旬頃予定"},"application_method":"jGrants（電子申請のみ）","required_documents":["事業計画書","決算書（直近2期分）","従業員数確認書類","GビズIDプライムアカウント","認定支援機関確認書"],"official_url":"https://portal.monodukuri-hojo.jp/","contact":"ものづくり補助金事務局"}',
  datetime('now'),
  '2026-05-08T17:00:00Z',
  1, '[]', 80,
  0, 'ready', 1, 1
);

-- =============================================
-- 2. 新規追加: 新事業進出補助金 第3回公募（受付中）
-- =============================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json,
  cached_at, expires_at,
  wall_chat_ready, wall_chat_missing, detail_score,
  wall_chat_excluded, wall_chat_mode, is_electronic_application, is_visible
) VALUES (
  'SHINJIGYO-03',
  'manual',
  '中小企業新事業進出補助金（第3回公募）',
  90000000,
  '1/2〜2/3',
  '全国',
  '全業種',
  '中小企業',
  '2025-12-23T00:00:00Z',
  '2026-03-26T17:00:00Z',
  1,
  '{"id":"SHINJIGYO-03","title":"中小企業新事業進出補助金（第3回公募）","official_name":"中小企業新事業進出補助事業","round":"第3回公募","description":"中小企業者等が既存事業で培ったノウハウを活かし、既存事業とは異なる新市場への進出を支援する制度です。新製品・新サービスの開発にとどまらず、顧客層やビジネスモデルの転換を伴う事業展開を想定しています。事業再構築補助金の後継制度。","subsidy_amount":{"description":"従業員数により補助上限額が変動","tiers":[{"employees":"20人以下","normal":25000000,"with_wage_increase":30000000},{"employees":"21〜50人","normal":40000000,"with_wage_increase":50000000},{"employees":"51〜100人","normal":55000000,"with_wage_increase":70000000},{"employees":"101人以上","normal":70000000,"with_wage_increase":90000000}],"special_condition":"大幅賃上げを行う場合は()内の金額に引上げ","minimum":1000000},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"1/2"},{"type":"賃金特例適用","rate":"2/3（1/2→引上げ）"}]},"target_area_search":"全国","target_industry":"全業種","target_number_of_employees":"中小企業基本法に規定する中小企業者","eligibility_requirements":{"basic":["日本国内に法人登記があり、国内で事業を営む中小企業等","GビズIDプライムアカウントを取得していること","事業計画を認定経営革新等支援機関と共同で策定すること","既存事業とは異なる新市場への進出であること"],"mandatory_commitments":[{"item":"付加価値額の向上","requirement":"補助事業終了後3〜5年で年平均+4.0%以上の向上"},{"item":"賃上げ","requirement":"1人当たり給与支給総額を年平均成長率+3.0%以上増加"},{"item":"最低賃金","requirement":"事業場内最低賃金が地域別最低賃金+30円以上"}],"exclusions":["みなし大企業","政治団体・宗教団体","反社会的勢力"]},"eligible_expenses":[{"category":"建物費","description":"工場・物流拠点の新設・改修（必要に応じて）"},{"category":"機械装置・システム構築費","description":"設備投資"},{"category":"技術導入費","description":"知的財産権等の導入"},{"category":"外注費","description":"製品開発の外注等"},{"category":"専門家経費","description":"コンサルタント活用等"},{"category":"クラウドサービス利用費","description":"ITサービス利用"},{"category":"広告宣伝・販売促進費","description":"新事業の広告宣伝"}],"schedule":{"公募開始":"2025年12月23日","申請締切":"2026年3月26日17:00","第4回公募":"2026年度に予定（新事業進出・ものづくり補助金に統合予定）"},"application_method":"jGrants（電子申請のみ）","required_documents":["事業計画書","決算書（直近2期分）","認定経営革新等支援機関の確認書","GビズIDプライムアカウント"],"notes":"2026年度以降は「新事業進出・ものづくり補助金」として統合予定","official_url":"https://shinjigyou-shinshutsu.smrj.go.jp/","contact":"新事業進出補助金事務局"}',
  datetime('now'),
  '2026-03-26T17:00:00Z',
  1, '[]', 85,
  0, 'ready', 1, 1
);

-- =============================================
-- 3. 新規追加: 中小企業成長加速化補助金（2次公募）
-- =============================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json,
  cached_at, expires_at,
  wall_chat_ready, wall_chat_missing, detail_score,
  wall_chat_excluded, wall_chat_mode, is_electronic_application, is_visible
) VALUES (
  'SEICHOU-KASOKU-02',
  'manual',
  '中小企業成長加速化補助金（2次公募）',
  500000000,
  '1/2',
  '全国',
  '全業種',
  '売上高10億円以上100億円未満の中小企業',
  '2026-02-24T00:00:00Z',
  '2026-03-26T15:00:00Z',
  1,
  '{"id":"SEICHOU-KASOKU-02","title":"中小企業成長加速化補助金（2次公募）","official_name":"中小企業成長加速化補助金","round":"2次公募","description":"売上高100億円を目指す成長志向型の中小企業による大胆な設備投資を支援し、地域経済に大きな影響を与える「100億企業」の創出を目的とした補助金。最大5億円を補助。物価高や人手不足に直面する中で、企業の稼ぐ力を底上げし、賃上げやサプライチェーンへの波及効果を通じて日本経済の好循環を全国に広げることを目指しています。","subsidy_amount":{"upper_limit":500000000,"lower_limit":100000000,"rate":"1/2","note":"補助対象経費のうち投資額（建物費+機械装置費+ソフトウェア費）が1億円以上必須"},"subsidy_rate":{"categories":[{"type":"全対象者共通","rate":"1/2"}]},"target_area_search":"全国","target_industry":"全業種","target_number_of_employees":"売上高10億円以上100億円未満の中小企業","eligibility_requirements":{"basic":["売上高10億円以上100億円未満の中小企業であること","中小企業基本法の定義に合致すること","みなし大企業・みなし同一法人に該当しないこと","直近過去3年分の課税所得の年平均額が15億円を超えていないこと"],"mandatory_commitments":[{"item":"100億宣言","requirement":"申請時までに100億宣言ポータルサイトで将来の売上高100億円を目指す決意や具体的措置を公表"},{"item":"大規模投資","requirement":"補助対象経費のうち建物費・機械装置費・ソフトウェア費の合計（投資額）が1億円以上（税抜き）"},{"item":"賃上げ計画","requirement":"補助事業終了後3年間、従業員1人当たりの給与支給総額を年平均4.5%以上引上げ","note":"未達成時は返還規定あり"}],"100_oku_sengen":{"記載内容":["企業概要（足元の売上高・従業員数）","売上高100億円実現の目標と課題","具体的措置（生産体制増強・海外展開・M&A等）","実施体制","経営者のコミットメント"]}},"eligible_expenses":[{"category":"建物費","description":"工場・物流拠点・販売施設の新設・増築・改修（単価100万円以上）"},{"category":"機械装置費","description":"製造装置・検査工具・器具備品の購入・製作（単価100万円以上）"},{"category":"ソフトウェア費","description":"専用ソフトウェア・情報システム・クラウドサービス利用料（単価100万円以上）"},{"category":"外注費","description":"投資額未満であること"},{"category":"専門家経費","description":"投資額未満であること"}],"ineligible_expenses":["土地代","老朽化設備の単なる入れ替え（更新投資）","公道を走る車両","汎用的なPC・タブレット"],"schedule":{"公募要領公開":"2025年12月26日","申請受付":"2026年2月24日〜3月26日 15:00","1次審査結果":"2026年5月下旬","2次審査（プレゼン）":"2026年6月22日〜7月10日","採択結果":"2026年7月下旬以降","事業実施期間":"交付決定から24か月以内"},"application_method":"jGrants（電子申請のみ）、GビズIDプライムアカウント必須","selection_process":"1次審査（書面）→2次審査（プレゼンテーション、代表者本人の出席必須）","required_documents":["事業計画書","決算書（直近3期分）","100億宣言","賃上げ計画書","GビズIDプライムアカウント"],"official_url":"https://growth-100-oku.smrj.go.jp/","contact":"中小企業成長加速化補助金事務局"}',
  datetime('now'),
  '2026-03-26T15:00:00Z',
  1, '[]', 90,
  0, 'ready', 1, 1
);

-- =============================================
-- 4. 新規追加: 事業承継・M&A補助金（14次公募）
-- =============================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json,
  cached_at, expires_at,
  wall_chat_ready, wall_chat_missing, detail_score,
  wall_chat_excluded, wall_chat_mode, is_electronic_application, is_visible
) VALUES (
  'JIGYOSHOKEI-MA-14',
  'manual',
  '事業承継・M&A補助金（14次公募）',
  20000000,
  '1/2〜2/3',
  '全国',
  '全業種',
  '中小企業・小規模事業者',
  '2026-02-27T00:00:00Z',
  '2026-04-03T17:00:00Z',
  1,
  '{"id":"JIGYOSHOKEI-MA-14","title":"事業承継・M&A補助金（14次公募）","official_name":"中小企業生産性革命推進事業 事業承継・M&A補助金","round":"14次公募","description":"事業承継やM&Aを行う中小企業・小規模事業者を対象に、経営資源の引継ぎや事業再編に伴う費用を補助する制度。4つの支援枠（事業承継促進枠・専門家活用枠・PMI推進枠・廃業再チャレンジ枠）で、親族内承継からM&A後の統合まで幅広く支援。","subsidy_amount":{"枠別上限額":[{"枠":"事業承継促進枠","上限":10000000,"下限":1000000,"概要":"親族内承継・従業員承継の設備投資","条件":"一定の賃上げ実施で1,000万円、それ以外は800万円"},{"枠":"専門家活用枠（買い手）","上限":9500000,"下限":500000,"概要":"M&A時のFA・仲介・DD費用","条件":"基本600万円+DD200万円+廃業費150万円"},{"枠":"専門家活用枠（売り手）","上限":9500000,"下限":500000,"概要":"M&A時のFA・仲介費用","条件":"基本600万円+DD200万円+廃業費150万円"},{"枠":"PMI推進枠（専門家活用類型）","上限":1500000,"下限":500000,"概要":"M&A後のPMI専門家活用"},{"枠":"PMI推進枠（事業統合投資類型）","上限":10000000,"下限":1000000,"概要":"M&A後の設備投資","条件":"一定の賃上げ実施で1,000万円"},{"枠":"廃業・再チャレンジ枠","上限":1500000,"概要":"事業廃業に伴う費用"}]},"subsidy_rate":{"categories":[{"type":"小規模事業者","rate":"2/3"},{"type":"中小企業","rate":"1/2"},{"type":"売り手（赤字等）","rate":"2/3"}]},"target_area_search":"全国","target_industry":"全業種","target_number_of_employees":"中小企業・小規模事業者","eligibility_requirements":{"事業承継促進枠":{"概要":"親族内承継・従業員承継を予定","要件":["承継予定者が3年以上の役員経験or雇用経験、又は親族","5年後までに事業承継を完了する蓋然性が高いこと","認定経営革新等支援機関による確認書"]},"専門家活用枠":{"概要":"M&Aの専門家活用費用を支援","要件":["M&A支援機関登録制度に登録された専門家の利用","デューディリジェンス（DD）の実施","実質的な事業再編・事業統合であること"]},"PMI推進枠":{"概要":"M&A後の経営統合支援","要件":["M&Aクロージング後1年以内の取組","DDが実施済みであること"]}},"schedule":{"公募要領公開":"2026年1月30日","申請受付":"2026年2月27日〜4月3日 17:00","採択結果":"2026年6月頃予定"},"application_method":"jGrants（電子申請のみ）","required_documents":["事業計画書","決算書","認定経営革新等支援機関の確認書","GビズIDプライムアカウント"],"official_url":"https://shoukei-mahojokin.go.jp/","contact":"事業承継・M&A補助金事務局"}',
  datetime('now'),
  '2026-04-03T17:00:00Z',
  1, '[]', 85,
  0, 'ready', 1, 1
);

-- =============================================
-- 5. 新規追加: 新事業進出・ものづくり補助金（統合版・2026年度予定）
-- =============================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json,
  cached_at, expires_at,
  wall_chat_ready, wall_chat_missing, detail_score,
  wall_chat_excluded, wall_chat_mode, is_electronic_application, is_visible
) VALUES (
  'SHINJIGYO-MONO-2026',
  'manual',
  '新事業進出・ものづくり補助金（2026年度統合版）',
  90000000,
  '1/2〜2/3',
  '全国',
  '全業種',
  '中小企業',
  '2026-06-01T00:00:00Z',
  '2026-12-31T23:59:00Z',
  1,
  '{"id":"SHINJIGYO-MONO-2026","title":"新事業進出・ものづくり補助金（2026年度統合版）","official_name":"新事業進出・ものづくり補助金","round":"2026年度（公募時期未定）","description":"2026年度以降、新事業進出補助金とものづくり補助金が統合され実施される新制度。革新的新製品・サービス枠、新事業進出枠、グローバル枠の3つの申請枠で構成。制度設計は公表済みだが、公募開始時期は未定（新事業進出補助金第4回公募終了後に開始予定）。","subsidy_amount":{"枠別":{"革新的新製品・サービス枠":{"description":"ものづくり補助金と同程度","tiers":[{"employees":"5人以下","normal":7500000,"with_wage_increase":8500000},{"employees":"6〜20人","normal":10000000,"with_wage_increase":12500000},{"employees":"21〜50人","normal":15000000,"with_wage_increase":25000000},{"employees":"51人以上","normal":25000000,"with_wage_increase":35000000}]},"新事業進出枠":{"description":"新事業進出補助金と同程度","tiers":[{"employees":"20人以下","normal":25000000,"with_wage_increase":30000000},{"employees":"21〜50人","normal":40000000,"with_wage_increase":50000000},{"employees":"51〜100人","normal":55000000,"with_wage_increase":70000000},{"employees":"101人以上","normal":70000000,"with_wage_increase":90000000}]},"グローバル枠":{"description":"従業員規模に応じた上限額（補助率2/3）","note":"統合前は上限3,000万円だったが、統合後は従業員規模ごとに設定"}}},"subsidy_rate":{"categories":[{"枠":"革新的新製品・サービス枠","中小企業":"1/2","小規模・再生":"2/3","賃金特例":"2/3に引上げ"},{"枠":"新事業進出枠","中小企業":"1/2","賃金特例":"2/3に引上げ"},{"枠":"グローバル枠","全事業者":"2/3"}]},"target_area_search":"全国","target_industry":"全業種","status":"公募時期未定（2026年度後半に開始見込み）","schedule":{"新事業進出補助金第3回公募":"〜2026年3月26日","新事業進出補助金第4回公募":"2026年度前半","統合版公募開始":"第4回終了後（2026年度後半見込み）","公募回数":"年間2〜4回程度を予定"},"application_method":"jGrants（電子申請のみ）","source_info":"中小企業庁 令和8年度予算資料","official_url":"https://www.chusho.meti.go.jp/koukai/yosan/r8/shinjigy_mono.pdf"}',
  datetime('now'),
  '2026-12-31T23:59:00Z',
  1, '[]', 75,
  0, 'ready', 1, 1
);


-- =============================================
-- 6. 既存修復: REAL-006 省エネルギー投資促進支援事業費補助金
-- =============================================
UPDATE subsidy_cache SET
  detail_json = '{"id":"REAL-006","title":"省エネルギー投資促進支援事業費補助金","official_name":"省エネルギー投資促進支援事業費補助金（省エネ補助金）","description":"工場・事業場における省エネルギー設備への更新や新規導入を支援する補助金。先進設備、オーダーメイド設備、指定設備、エネルギー需要最適化対策の4つの事業区分から選択可能。中小企業は補助率1/2。","subsidy_amount":{"upper_limit":150000000,"事業区分別":[{"区分":"(I) 工場・事業場型","上限":"1億5,000万円/事業全体","下限":"100万円"},{"区分":"(II) 電化・脱炭素燃転型","上限":"1億5,000万円/事業全体","下限":"100万円"},{"区分":"(III) 指定設備導入事業","上限":"1億円/事業全体","下限":"30万円"},{"区分":"(IV) エネルギー需要最適化対策事業","上限":"1億円/事業全体","下限":"30万円"}]},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"1/2以内"},{"type":"大企業","rate":"1/3以内"}]},"target_area_search":"全国","target_industry":"全業種","target_number_of_employees":"全企業（中小企業は補助率優遇）","eligibility_requirements":{"basic":["国内で事業を営む法人又は個人事業者","省エネ法に基づく定期報告義務に対応","エネルギー使用量の削減計画を策定"]},"eligible_expenses":[{"category":"設備費","description":"省エネルギー設備の購入・設置"},{"category":"工事費","description":"設備の設置に伴う工事"},{"category":"設計費","description":"省エネ設計に関する経費"}],"schedule":{"令和6年度補正予算":"1次公募〜3次公募まで実施済","令和7年度予算":"2026年度に追加公募の可能性あり"},"application_method":"SII（一般社団法人環境共創イニシアチブ）のシステムから申請","official_url":"https://sii.or.jp/","contact":"環境共創イニシアチブ(SII)"}',
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  detail_score = 70
WHERE id = 'REAL-006';

-- =============================================
-- 7. 既存修復: REAL-004 事業再構築補助金（第13回公募）※最終回・受付終了
-- =============================================
UPDATE subsidy_cache SET
  detail_json = '{"id":"REAL-004","title":"事業再構築補助金（第13回公募）","official_name":"事業再構築補助金","round":"第13回公募（最終回）","description":"新型コロナウイルス感染症の影響を受け、新分野展開、業態転換、事業・業種転換、事業再編等に取り組む中小企業等を支援する補助金。第13回公募が最終回で、新規応募は終了。2026年度以降は後継制度として「新事業進出・ものづくり補助金」に統合予定。","subsidy_amount":{"枠別":[{"枠":"成長分野進出枠（通常類型）","従業員20人以下":15000000,"従業員21〜50人":30000000,"従業員51〜100人":40000000,"従業員101人以上":60000000},{"枠":"成長分野進出枠（GX進出類型）","従業員20人以下":30000000,"従業員21〜50人":50000000,"従業員51〜100人":70000000,"従業員101人以上":100000000},{"枠":"コロナ回復加速化枠（最低賃金類型）","従業員5人以下":5000000,"従業員6〜20人":10000000,"従業員21人以上":15000000}],"大幅賃上げ特例":"各枠の上限を引上げ"},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"1/2（通常）〜2/3（一部枠）"},{"type":"中堅企業","rate":"1/3"}]},"target_area_search":"全国","target_industry":"全業種","status":"受付終了（第13回が最終回）","schedule":{"公募期間":"2025年1月10日〜3月26日","採択結果":"2025年6月頃公表","注記":"新規応募申請受付は第13回で終了"},"note":"後継制度: 新事業進出補助金（現在公募中）→ 新事業進出・ものづくり補助金（2026年度統合予定）","official_url":"https://jigyou-saikouchiku.go.jp/","contact":"事業再構築補助金事務局"}',
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  detail_score = 65,
  acceptance_end_datetime = '2025-03-26T17:00:00Z'
WHERE id = 'REAL-004';

-- =============================================
-- 8. 既存修復: REAL-007 東京都中小企業デジタル化支援助成事業
-- =============================================
UPDATE subsidy_cache SET
  detail_json = '{"id":"REAL-007","title":"東京都中小企業デジタル化支援助成事業","official_name":"東京都中小企業デジタル化支援助成事業","description":"東京都内の中小企業がデジタル技術を活用した業務効率化、生産性向上のためのITツール・設備導入を支援する助成事業。ソフトウェア、クラウドサービス、IoT機器等の導入費用を助成。","subsidy_amount":{"upper_limit":10000000,"lower_limit":300000},"subsidy_rate":{"categories":[{"type":"助成率","rate":"2/3以内"}]},"target_area_search":"東京都","target_industry":"全業種","target_number_of_employees":"都内に事業所を有する中小企業","eligibility_requirements":{"basic":["東京都内に事業所（本社又は支社）を有する中小企業","法人又は個人事業者","みなし大企業に該当しないこと"]},"eligible_expenses":[{"category":"ソフトウェア導入費","description":"業務システム、クラウドサービス等"},{"category":"IoT機器導入費","description":"センサー、通信機器等"},{"category":"デジタル関連機器","description":"PC、タブレット等（業務用途に限る）"}],"application_method":"東京都中小企業振興公社のシステムから申請","official_url":"https://www.tokyo-kosha.or.jp/","contact":"東京都中小企業振興公社"}',
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  detail_score = 60
WHERE id = 'REAL-007';

-- =============================================
-- 9. 既存修復: REAL-005 業務改善助成金
-- =============================================
UPDATE subsidy_cache SET
  detail_json = '{"id":"REAL-005","title":"業務改善助成金","official_name":"業務改善助成金","description":"事業場内で最も低い賃金（事業場内最低賃金）の引き上げと設備投資等を行う中小企業・小規模事業者を支援する助成金。賃上げ額に応じて最大600万円を助成。厚生労働省が所管。","subsidy_amount":{"description":"引上げ額と引上げ人数に応じた上限額","tiers":[{"引上げ額":"30円以上","引上げ人数1人":"300000","引上げ人数2〜3人":"400000","引上げ人数4〜6人":"600000","引上げ人数7人以上":"600000","引上げ人数10人以上":"600000"},{"引上げ額":"45円以上","引上げ人数1人":"450000","引上げ人数2〜3人":"600000","引上げ人数4〜6人":"800000","引上げ人数7人以上":"1000000","引上げ人数10人以上":"1200000"},{"引上げ額":"60円以上","引上げ人数1人":"600000","引上げ人数2〜3人":"800000","引上げ人数4〜6人":"1000000","引上げ人数7人以上":"1500000","引上げ人数10人以上":"1800000"},{"引上げ額":"90円以上","引上げ人数1人":"600000","引上げ人数2〜3人":"1000000","引上げ人数4〜6人":"1500000","引上げ人数7人以上":"2700000","引上げ人数10人以上":"3600000"}],"最大助成額":6000000},"subsidy_rate":{"categories":[{"type":"助成率","rate":"設備投資等の費用の一部（3/4〜4/5）"}]},"target_area_search":"全国","target_industry":"全業種","target_number_of_employees":"中小企業・小規模事業者（常時使用する労働者が30人以下又は100人以下）","eligibility_requirements":{"basic":["事業場内最低賃金と地域別最低賃金の差額が50円以内","事業場規模が100人以下","事業場内最低賃金を30円以上引上げること","設備投資等を行うこと"]},"eligible_expenses":[{"category":"機械設備","description":"POSレジ、リフト等"},{"category":"コンサルティング","description":"業務改善コンサルティング"},{"category":"人材育成・教育訓練","description":"従業員の能力向上のための研修"},{"category":"その他","description":"業務改善に資する設備投資等"}],"application_method":"各都道府県の労働局に申請書を提出","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html","contact":"各都道府県の労働局"}',
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  detail_score = 65
WHERE id = 'REAL-005';

-- =============================================
-- 10. 既存修復: REAL-008 大阪府DX推進支援補助金
-- =============================================
UPDATE subsidy_cache SET
  detail_json = '{"id":"REAL-008","title":"大阪府DX推進支援補助金","official_name":"大阪府DX推進支援補助金","description":"大阪府内の中小企業がDX（デジタルトランスフォーメーション）を推進するための設備投資やシステム導入を支援する補助金。AI、IoT、クラウド等のデジタル技術活用による業務効率化・生産性向上を支援。","subsidy_amount":{"upper_limit":3000000,"lower_limit":100000},"subsidy_rate":{"categories":[{"type":"補助率","rate":"1/2以内"}]},"target_area_search":"大阪府","target_industry":"全業種","target_number_of_employees":"大阪府内の中小企業","eligibility_requirements":{"basic":["大阪府内に事業所を有する中小企業","DX推進計画を策定していること"]},"eligible_expenses":[{"category":"ソフトウェア導入費","description":"DX関連ソフトウェア・クラウドサービス"},{"category":"システム構築費","description":"DX推進のためのシステム構築"},{"category":"デジタル機器導入費","description":"IoT機器等の導入"}],"application_method":"大阪府の公募サイトから申請","official_url":"https://www.pref.osaka.lg.jp/","contact":"大阪府商工労働部"}',
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  detail_score = 55
WHERE id = 'REAL-008';

-- =============================================
-- 11. 期限切れ更新: MONODUKURI-GLOBAL → 第23次公募の情報へ更新
-- =============================================
UPDATE subsidy_cache SET
  title = 'ものづくり・商業・サービス生産性向上促進補助金（グローバル枠）※第22次で受付終了',
  acceptance_end_datetime = '2026-01-30T17:00:00Z',
  wall_chat_excluded = 1,
  wall_chat_mode = 'expired',
  is_visible = 0
WHERE id = 'MONODUKURI-GLOBAL';

-- =============================================
-- 12. 期限切れ更新: MONODUKURI-KOUFU-SEICHOU → 受付終了に更新
-- =============================================
UPDATE subsidy_cache SET
  title = 'ものづくり補助金（製品・サービス高付加価値化枠・成長分野進出類型）※第22次で受付終了',
  wall_chat_excluded = 1,
  wall_chat_mode = 'expired',
  is_visible = 0
WHERE id = 'MONODUKURI-KOUFU-SEICHOU';

-- =============================================
-- 13. 期限切れ更新: MONODUKURI-KOUFU-TSUJO → 受付終了に更新
-- =============================================
UPDATE subsidy_cache SET
  title = 'ものづくり補助金（製品・サービス高付加価値化枠・通常類型）※第22次で受付終了',
  wall_chat_excluded = 1,
  wall_chat_mode = 'expired',
  is_visible = 0
WHERE id = 'MONODUKURI-KOUFU-TSUJO';

-- =============================================
-- 14. 事業再構築補助金を受付終了として更新
-- =============================================
UPDATE subsidy_cache SET
  wall_chat_excluded = 1,
  wall_chat_mode = 'expired',
  is_visible = 0
WHERE id = 'REAL-004';

-- tokyo-koshaデータ投入（WALL_CHAT_READY対応版）
-- 主要10件を手動でdetail_json充実させて投入

-- 1. 製品開発着手支援助成事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-chakushu',
  'tokyo-kosha',
  '製品開発着手支援助成事業',
  15000000,
  '2/3',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-09-30T17:00:00Z',
  1,
  '{"description":"都内中小企業者等が、自社における新製品・新技術の研究開発を行うにあたり、その前段階である製品開発の着手（企画・設計段階の取組）に係る経費の一部を助成することにより、イノベーション創出の促進を図ります。","overview":"製品開発の企画・設計段階の取組に係る経費を助成","application_requirements":"都内に主たる事業所を有する中小企業者、または都内での創業を具体的に計画している者。新製品・新技術の研究開発を行う計画があること。","eligible_expenses":"原材料費、機械装置費、委託費、産業財産権出願導入費、専門家指導費","required_documents":"申請書、事業計画書、会社概要、決算書（直近2期分）、登記簿謄本、見積書","deadline":"2025-09-30T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/chakushu.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000dtcu-att/R7chakushu_flyer.pdf","https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000dtcu-att/R7chakushu_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 2. 新製品・新技術開発助成事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-shinseihin',
  'tokyo-kosha',
  '新製品・新技術開発助成事業',
  15000000,
  '1/2',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-10-31T17:00:00Z',
  1,
  '{"description":"都内中小企業者等が行う新製品・新技術の研究開発に要する経費の一部を助成することにより、技術力の強化、新事業の創出および経営基盤の強化を図ります。","overview":"新製品・新技術の研究開発に要する経費を助成","application_requirements":"都内に主たる事業所を有する中小企業者であること。自社で研究開発を行う能力を有すること。申請テーマが自社にとって新規性があること。","eligible_expenses":"原材料費、機械装置費、外注加工費、委託費、産業財産権出願導入費、専門家指導費、直接人件費","required_documents":"申請書、事業計画書、会社概要、決算書（直近2期分）、登記簿謄本、見積書、研究開発体制図","deadline":"2025-10-31T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/shinseihin.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000ec2j-att/R7shinseihin_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 3. 中小企業デジタルツール導入促進支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-digital-tool',
  'tokyo-kosha',
  '中小企業デジタルツール導入促進支援事業',
  1500000,
  '1/2',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-12-26T17:00:00Z',
  1,
  '{"description":"都内中小企業者等のデジタル化を促進するため、業務効率化や売上向上に資するデジタルツールの導入に係る経費の一部を助成します。","overview":"業務効率化・売上向上のためのデジタルツール導入費用を助成","application_requirements":"都内に主たる事業所を有する中小企業者であること。デジタルツールの導入により業務効率化または売上向上を図る計画があること。","eligible_expenses":"ソフトウェア導入費、クラウドサービス利用費、機器購入費、設定・導入支援費","required_documents":"申請書、事業計画書、会社概要、決算書（直近1期分）、見積書、導入予定ツールの仕様書","deadline":"2025-12-26T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/digital-tool.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002z8qy-att/R7-2_digitaltool_youkou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 4. 事業承継支援助成金
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-shoukei',
  'tokyo-kosha',
  '令和7年度 第2回 事業承継支援助成金',
  2000000,
  '2/3',
  '東京都',
  '全業種',
  '中小企業',
  '2025-06-01',
  '2025-08-31T17:00:00Z',
  1,
  '{"description":"都内中小企業者等の事業承継を支援するため、事業承継に係る専門家への相談費用や、事業承継後の経営安定化に向けた取組に要する経費の一部を助成します。","overview":"事業承継に係る専門家相談費用や経営安定化費用を助成","application_requirements":"都内に主たる事業所を有する中小企業者であること。事業承継計画を有していること。東京都事業承継・引継ぎ支援センター等の支援機関を利用していること。","eligible_expenses":"専門家謝金、調査費、契約関連費用、広報費、研修費","required_documents":"申請書、事業承継計画書、会社概要、決算書（直近2期分）、登記簿謄本、支援機関利用証明書","deadline":"2025-08-31T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/shoukei.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000emfd-att/2boshuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 5. 受動喫煙防止対策支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-judokitsuen',
  'tokyo-kosha',
  '事業環境変化に対応した経営基盤強化事業（受動喫煙防止対策支援コース）',
  4000000,
  '2/3',
  '東京都',
  '飲食業、サービス業',
  '中小企業・小規模企業',
  '2025-04-01',
  '2025-12-27T17:00:00Z',
  1,
  '{"description":"改正健康増進法および東京都受動喫煙防止条例の施行に伴い、受動喫煙防止対策に取り組む中小企業者等を支援するため、喫煙専用室等の設置または撤去に要する経費の一部を助成します。","overview":"喫煙専用室の設置・撤去費用を助成","application_requirements":"都内に主たる事業所を有する中小企業者であること。飲食店または宿泊施設を経営していること。喫煙専用室の設置または撤去を行う計画があること。","eligible_expenses":"設計費、施工費、備品購入費、撤去工事費","required_documents":"申請書、工事計画書、会社概要、決算書、見積書、図面、営業許可証の写し","deadline":"2025-12-27T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/jyudoukitsuen-boushitaisaku.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002puyi-att/boshu01secchi.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 6. エネルギー自給促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-energy-jikyu',
  'tokyo-kosha',
  '中小企業の経営安定化に向けたエネルギー自給促進事業',
  15000000,
  '1/2',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-15',
  '2025-08-29T17:00:00Z',
  1,
  '{"description":"エネルギー価格高騰の影響を受ける都内中小企業者等の経営安定化を図るため、太陽光発電システムや蓄電池等の自家消費型再生可能エネルギー設備の導入に要する経費の一部を助成します。","overview":"太陽光発電・蓄電池等の再エネ設備導入費用を助成","application_requirements":"都内に主たる事業所を有する中小企業者であること。自家消費型の再生可能エネルギー設備を導入する計画があること。専門家派遣を受けていること。","eligible_expenses":"太陽光発電設備費、蓄電池設備費、設置工事費、電気工事費","required_documents":"申請書、設備導入計画書、会社概要、決算書、見積書、専門家派遣利用証明書、電力使用実績","deadline":"2025-08-29T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/energy_jikyu.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cn9h-att/r7_energy_jikyu_joseikin_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 7. オフィスビルエネルギー効率化事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-building-energy',
  'tokyo-kosha',
  'オフィスビル等のエネルギー効率化による経営安定事業',
  30000000,
  '1/2',
  '東京都',
  '不動産業、ビル管理業',
  '中小企業',
  '2025-04-01',
  '2025-10-31T16:30:00Z',
  1,
  '{"description":"オフィスビル等を所有する中小企業者等を対象に、省エネ設備の導入によるエネルギー効率化を支援し、経営の安定化を図ります。","overview":"オフィスビルの省エネ設備導入費用を助成","application_requirements":"都内にオフィスビル等を所有する中小企業者であること。省エネ設備の導入計画があること。専門家派遣を受けていること。","eligible_expenses":"空調設備費、照明設備費、エネルギー管理システム費、設置工事費","required_documents":"申請書、設備導入計画書、会社概要、決算書、見積書、建物登記簿謄本、専門家派遣利用証明書","deadline":"2025-10-31T16:30:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/building_energy.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cnc7-att/r7_office_building_energy_joseikin_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 8. TOKYO戦略的イノベーション促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-tokyo-innovation',
  'tokyo-kosha',
  '令和7年度 TOKYO戦略的イノベーション促進事業',
  80000000,
  '2/3',
  '東京都',
  '製造業、情報通信業',
  '中小企業',
  '2025-04-01',
  '2025-06-30T17:00:00Z',
  1,
  '{"description":"東京都が推進する成長産業分野において、革新的な技術・製品・サービスの開発を行う都内中小企業者等を支援し、東京の産業の持続的な発展を図ります。","overview":"成長産業分野での革新的技術開発を支援","application_requirements":"都内に主たる事業所を有する中小企業者であること。東京都が指定する成長産業分野（DX、GX、バイオ等）での技術開発を行う計画があること。","eligible_expenses":"原材料費、機械装置費、委託費、専門家指導費、直接人件費、特許出願費","required_documents":"申請書、事業計画書、会社概要、決算書（直近2期分）、登記簿謄本、技術開発体制図、見積書","deadline":"2025-06-30T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/tokyo-innovation.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002621v-att/R7_boshuyoukoukai_tokyo-innovation.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 9. 地域資源等を活用したイノベーション創出事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-chiiki',
  'tokyo-kosha',
  'TOKYO地域資源等を活用したイノベーション創出事業',
  15000000,
  '2/3',
  '東京都',
  '製造業、食品製造業、伝統工芸',
  '中小企業',
  '2025-04-01',
  '2025-07-31T17:00:00Z',
  1,
  '{"description":"東京の地域資源（農林水産物、伝統工芸品、観光資源等）を活用した新製品・新サービスの開発を支援し、地域経済の活性化を図ります。","overview":"地域資源を活用した新製品・サービス開発を支援","application_requirements":"都内に主たる事業所を有する中小企業者であること。東京の地域資源を活用した新製品・サービス開発を行う計画があること。","eligible_expenses":"原材料費、機械装置費、委託費、デザイン費、広報費","required_documents":"申請書、事業計画書、会社概要、決算書、地域資源活用計画書、見積書","deadline":"2025-07-31T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/chiiki.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal00000269ce-att/chiikishigenbosyuuyoukou_2.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 10. ゼロエミッション推進に向けた事業転換支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-zeroemi',
  'tokyo-kosha',
  'ゼロエミッション推進に向けた事業転換支援事業（製品開発助成）',
  10000000,
  '2/3',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-09-30T17:00:00Z',
  1,
  '{"description":"脱炭素社会の実現に向け、環境負荷低減に資する製品の開発・改良を行う都内中小企業者等を支援します。","overview":"環境負荷低減製品の開発・改良を支援","application_requirements":"都内に主たる事業所を有する中小企業者であること。環境負荷低減に資する製品の開発・改良を行う計画があること。","eligible_expenses":"原材料費、機械装置費、委託費、産業財産権出願費、専門家指導費","required_documents":"申請書、事業計画書、会社概要、決算書、環境負荷低減効果説明書、見積書","deadline":"2025-09-30T17:00:00Z","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/zeroemi_kaihatsu.html","issuerName":"東京都中小企業振興公社","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002zq9v-att/03_1_tanndokusinnsei_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

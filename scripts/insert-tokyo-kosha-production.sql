-- tokyo-kosha データを本番DBに投入
-- 17件の補助金データ + WALL_CHAT_READYに必要な情報を追加

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
  '1/2以内',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-09-30',
  1,
  json_object(
    'overview', '東京都内の中小企業が行う新製品・新技術の研究開発のうち、製品化に向けた開発の初期段階（製品開発着手期）に要する経費の一部を助成します。',
    'description', '都内中小企業者が、自社で取り組む技術・製品開発のうち、基礎研究の完了後の応用研究・開発段階（製品開発着手期）に必要な経費を助成します。助成限度額は1,500万円、助成率は1/2以内です。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
令和7年4月1日現在で、引き続き2年以上事業を営んでいること
申請テーマが、基礎研究を完了しているものであること
同一テーマで公社・国・都道府県・区市町村等から助成を受けていないこと',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
技術指導受入れ費
展示会等参加費',
    'required_documents', '申請書（様式第1号）
事業計画書
会社概要
直近2期分の確定申告書
履歴事項全部証明書
納税証明書',
    'deadline', '2025-09-30',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/chakushu.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000dtcu-att/R7chakushu_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 2. 製品改良／規格適合・認証取得支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-kairyo',
  'tokyo-kosha',
  '製品改良／規格適合・認証取得支援事業',
  5000000,
  '1/2以内',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-08-31',
  1,
  json_object(
    'overview', '自社既存製品等の改良や規格適合・認証取得に取り組む都内中小企業者に対し、必要となる経費を助成します。',
    'description', '市場ニーズの変化や技術の進歩に対応するため、自社の既存製品・技術の改良、または規格適合・認証取得に必要な経費の一部を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
改良対象となる自社製品を有していること
規格適合・認証取得を目指す具体的な計画があること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
規格認証・登録費
技術指導受入れ費',
    'required_documents', '申請書
事業計画書
既存製品の資料
会社概要
確定申告書',
    'deadline', '2025-08-31',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/kairyo.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000egr5-att/05_R7kairyo_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 3. TOKYO戦略的イノベーション促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-tokyo-innovation',
  'tokyo-kosha',
  'TOKYO戦略的イノベーション促進事業',
  80000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-07-31',
  1,
  json_object(
    'overview', '東京の産業の活性化に向け、都が定めた「イノベーションマップ」のテーマに基づく、技術・製品開発を行う中小企業グループを支援します。',
    'description', '革新的な技術・製品開発を目指す中小企業グループに対し、開発に必要な経費を最大8,000万円まで助成します。イノベーションマップに示された重点分野での開発が対象です。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
2社以上の中小企業でグループを構成すること
イノベーションマップのテーマに合致した開発計画であること
原則として開発期間は2年以内であること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
技術指導受入れ費
直接人件費
展示会等参加費',
    'required_documents', '申請書
事業計画書
グループ構成企業一覧
各企業の会社概要
確定申告書
履歴事項全部証明書',
    'deadline', '2025-07-31',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/tokyo-innovation.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002621v-att/R7_boshuyoukoukai_tokyo-innovation.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 4. TOKYO地域資源等を活用したイノベーション創出事業
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
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-08-29',
  1,
  json_object(
    'overview', '東京の地域資源等を活用した新製品・新サービスの開発を行う中小企業を支援します。',
    'description', '東京都内の地域資源（伝統工芸品、農林水産物、観光資源等）を活用して、新製品・新サービスの開発を行う都内中小企業に対し、開発費用の一部を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
東京の地域資源を活用した開発計画であること
事業化の見込みがあること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
直接人件費
マーケティング調査費',
    'required_documents', '申請書
事業計画書
地域資源活用の説明資料
会社概要
確定申告書',
    'deadline', '2025-08-29',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/chiiki.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal00000269ce-att/chiikishigenbosyuuyoukou_2.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 5. 安全・安心な東京の実現に向けた製品開発支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-anzen-anshin',
  'tokyo-kosha',
  '安全・安心な東京の実現に向けた製品開発支援事業',
  15000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-09-30',
  1,
  json_object(
    'overview', '防災・減災、感染症対策等、都民の安全・安心に資する製品・技術の開発を行う中小企業を支援します。',
    'description', '東京都の安全・安心に貢献する製品・技術の開発に取り組む中小企業に対し、開発費用の一部を助成します。防災、感染症対策、セキュリティ等の分野が対象です。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
安全・安心分野の製品開発計画であること
都民の安全・安心に資する製品であること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
規格認証・登録費
直接人件費',
    'required_documents', '申請書
事業計画書
製品の安全・安心への貢献説明書
会社概要
確定申告書',
    'deadline', '2025-09-30',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/anzen-anshin.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cv3a-att/r7_anzen-anshin_guideline.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 6. 新製品・新技術開発助成事業
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
  '1/2以内',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-09-30',
  1,
  json_object(
    'overview', '都内中小企業者が行う新製品・新技術の研究開発に要する経費の一部を助成します。',
    'description', '実用化の見込みのある新製品・新技術の自社開発を行う都内中小企業者に対し、試作品開発や研究等に必要な経費を助成します。助成限度額は1,500万円です。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
令和7年4月1日現在で、引き続き2年以上事業を営んでいること
開発内容に新規性・市場性があること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
技術指導受入れ費',
    'required_documents', '申請書（様式第1号）
事業計画書
会社概要
直近2期分の確定申告書
履歴事項全部証明書',
    'deadline', '2025-09-30',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/shinseihin.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000ec2j-att/R7shinseihin_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 7. ゼロエミッション推進に向けた事業転換支援事業（製品開発助成）
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
  '2/3以内',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-08-29',
  1,
  json_object(
    'overview', '脱炭素社会の実現に向け、ゼロエミッション関連の製品開発に取り組む中小企業を支援します。',
    'description', 'カーボンニュートラルの実現に貢献する製品・技術の開発を行う中小企業に対し、開発費用の一部を助成します。省エネ、再エネ、リサイクル等の分野が対象です。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
ゼロエミッション関連の製品開発計画であること
CO2削減効果が見込めること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
直接人件費',
    'required_documents', '申請書
事業計画書
CO2削減効果の試算書
会社概要
確定申告書',
    'deadline', '2025-08-29',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/zeroemi_kaihatsu.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002zq9v-att/03_1_tanndokusinnsei_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 8. 受動喫煙防止対策支援コース
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-judoukitsuen',
  'tokyo-kosha',
  '事業環境変化に対応した経営基盤強化事業（受動喫煙防止対策支援コース）',
  4000000,
  '2/3以内',
  '東京都',
  '飲食業、サービス業',
  '中小企業・小規模企業',
  '2025-04-01',
  '2025-12-27',
  1,
  json_object(
    'overview', '受動喫煙防止対策に取り組む中小飲食店等に対し、喫煙専用室等の設置に要する経費を助成します。',
    'description', '改正健康増進法の施行に伴い、受動喫煙防止対策として喫煙専用室等の設置や既存の喫煙専用室等の撤去に要する経費を助成します。',
    'application_requirements', '都内の中小飲食店等であること
喫煙専用室等を設置または撤去する計画があること
健康増進法に基づく基準を満たすこと',
    'eligible_expenses', '喫煙専用室等設置工事費
換気設備費
間仕切り工事費
撤去工事費',
    'required_documents', '申請書
設置計画書・図面
見積書
営業許可証の写し
確定申告書',
    'deadline', '2025-12-27',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/jyudoukitsuen-boushitaisaku.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002puyi-att/boshu01secchi.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 9. 中小企業デジタルツール導入促進支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-digital-tool',
  'tokyo-kosha',
  '中小企業デジタルツール導入促進支援事業',
  1000000,
  '1/2以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-11-28',
  1,
  json_object(
    'overview', '都内中小企業のデジタル化を促進するため、デジタルツール導入に係る経費の一部を助成します。',
    'description', '業務効率化や生産性向上のためにデジタルツール（ソフトウェア、クラウドサービス等）を導入する都内中小企業に対し、導入費用の一部を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
公社の「デジタル技術アドバイザーによる支援」を受けていること
デジタルツール導入計画を策定していること',
    'eligible_expenses', 'ソフトウェア購入費
クラウドサービス利用料（最大1年分）
機器購入費
導入サポート費',
    'required_documents', '申請書
デジタルツール導入計画書
見積書
会社概要
確定申告書',
    'deadline', '2025-11-28',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/digital-tool.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002z8qy-att/R7-2_digitaltool_youkou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 10. エネルギー自給促進事業
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
  '1/2以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-15',
  '2025-08-29',
  1,
  json_object(
    'overview', 'エネルギー価格高騰対策として、自家消費型太陽光発電設備等の導入を支援します。',
    'description', 'エネルギーコストの削減と経営の安定化を図るため、自家消費型太陽光発電設備や蓄電池の導入に要する経費の一部を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
公社の専門家派遣を受けていること
自家消費型の設備導入計画があること',
    'eligible_expenses', '太陽光発電設備購入・設置費
蓄電池購入・設置費
付帯設備費
設計費',
    'required_documents', '申請書
設備導入計画書
専門家派遣利用証明
見積書
会社概要',
    'deadline', '2025-08-29',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/energy_jikyu.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cn9h-att/r7_energy_jikyu_joseikin_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 11. オフィスビル等のエネルギー効率化事業
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
  '1/2以内',
  '東京都',
  '不動産業',
  '中小企業',
  '2025-04-01',
  '2025-10-31',
  1,
  json_object(
    'overview', '中小企業が所有するオフィスビル等の省エネ改修を支援し、経営の安定化を図ります。',
    'description', 'オフィスビル等の所有者である中小企業に対し、省エネルギー設備の導入や改修に要する経費の一部を助成します。',
    'application_requirements', '都内のオフィスビル等を所有する中小企業者であること
公社の専門家派遣を受けていること
省エネ改修計画を策定していること',
    'eligible_expenses', '空調設備更新費
照明設備LED化費
断熱工事費
BEMS導入費
設計費',
    'required_documents', '申請書
省エネ改修計画書
専門家派遣利用証明
見積書
建物登記簿謄本',
    'deadline', '2025-10-31',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/building_energy.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cnc7-att/r7_office_building_energy_joseikin_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 12. 事業承継支援助成金
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-shoukei',
  'tokyo-kosha',
  '事業承継支援助成金',
  2000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-09-30',
  1,
  json_object(
    'overview', '事業承継に取り組む都内中小企業に対し、事業承継に係る経費の一部を助成します。',
    'description', '後継者への円滑な事業承継を支援するため、M&A仲介、デューデリジェンス、事業計画策定等に要する経費を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
事業承継・引継ぎ支援センター東京等の支援を受けていること
事業承継計画を策定していること',
    'eligible_expenses', 'M&A仲介手数料
デューデリジェンス費用
事業計画策定費用
株式・事業譲渡に係る専門家費用
登録免許税相当額',
    'required_documents', '申請書
事業承継計画書
支援機関の支援証明書
見積書・契約書
会社概要',
    'deadline', '2025-09-30',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/shoukei.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000emfd-att/2boshuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 13. 高齢者向け新ビジネス創出支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-koureisha',
  'tokyo-kosha',
  '高齢者向け新ビジネス創出支援事業',
  15000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-08-29',
  1,
  json_object(
    'overview', '高齢者の生活を支援する製品・サービスの開発を行う中小企業を支援します。',
    'description', '超高齢社会に対応した製品・サービスの開発を行う中小企業に対し、開発費用の一部を助成します。介護、見守り、生活支援等の分野が対象です。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
高齢者向け製品・サービスの開発計画があること
高齢者の生活の質向上に資すること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
直接人件費
モニター調査費',
    'required_documents', '申請書
事業計画書
高齢者ニーズの調査資料
会社概要
確定申告書',
    'deadline', '2025-08-29',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/koureisha/index.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/koureisha/o9p1db0000000oi9-att/r7_koureisha_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 14. 医療機器産業参入促進助成事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-iryokiki',
  'tokyo-kosha',
  '医療機器産業参入促進助成事業',
  5000000,
  '1/2以内',
  '東京都',
  '製造業',
  '中小企業',
  '2025-04-01',
  '2025-08-08',
  1,
  json_object(
    'overview', '医療機器産業への参入を目指す中小企業を支援します。',
    'description', '医療機器の開発・製造に新規参入する中小企業に対し、開発に必要な経費の一部を助成します。事業化コースと開発着手コースがあります。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
医療機器の開発計画があること
薬機法に基づく許認可取得を目指すこと',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
規格認証・登録費
技術指導受入れ費',
    'required_documents', '申請書
事業計画書
医療機器開発の概要資料
会社概要
確定申告書',
    'deadline', '2025-08-08',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/medical/index.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/medical/rmepal0000000ec2-att/22th_jigyouka_youkou_0808.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 15. フェムテック開発支援・普及促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-femtech',
  'tokyo-kosha',
  '女性活躍のためのフェムテック開発支援・普及促進事業',
  15000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-08-29',
  1,
  json_object(
    'overview', '女性特有の健康課題を解決するフェムテック製品・サービスの開発を支援します。',
    'description', 'フェムテック（Female + Technology）分野において、女性特有の健康課題を解決する製品・サービスの開発を行う中小企業を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
フェムテック分野の製品・サービス開発計画があること
女性の健康課題解決に資すること',
    'eligible_expenses', '原材料・副資材費
機械装置・工具器具費
委託・外注費
産業財産権出願・導入費
直接人件費
市場調査費',
    'required_documents', '申請書
事業計画書
フェムテック製品の概要資料
会社概要
確定申告書',
    'deadline', '2025-08-29',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/femtech/index.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/femtech/ucg1fj0000002ff9-att/r7_femtech_bosyuuyoukou.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 16. 経営展開サポート事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-kankyo-sokuo',
  'tokyo-kosha',
  '新たな事業環境に即応した経営展開サポート事業',
  8000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-04-01',
  '2025-10-31',
  1,
  json_object(
    'overview', '経営環境の変化に対応した事業転換・多角化に取り組む中小企業を支援します。',
    'description', 'ポストコロナ・脱炭素等の事業環境の変化に対応するため、新たな事業展開や経営改善に取り組む中小企業の経費を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
新たな事業展開または経営改善計画があること
事業環境の変化への対応策であること',
    'eligible_expenses', '設備購入費
システム導入費
広告宣伝費
展示会出展費
専門家謝金',
    'required_documents', '申請書
事業計画書
事業環境変化への対応説明
会社概要
確定申告書',
    'deadline', '2025-10-31',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/kankyo-sokuo/index.html',
    'pdfUrls', json_array()
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

-- 17. 障害者向け製品等の販路開拓支援事業  
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime, 
  request_reception_display_flag, detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-shogaisha',
  'tokyo-kosha',
  '障害者向け製品等の販路開拓支援事業',
  3000000,
  '2/3以内',
  '東京都',
  '全業種',
  '中小企業',
  '2025-06-24',
  '2025-08-19',
  1,
  json_object(
    'overview', '障害者の自立を支援する製品・サービスの販路開拓を行う中小企業を支援します。',
    'description', '障害者向け製品・サービスの開発・改良および販路開拓に取り組む中小企業に対し、必要な経費の一部を助成します。',
    'application_requirements', '都内に主たる事業所を有する中小企業者であること
障害者向け製品・サービスを有していること
販路開拓の具体的計画があること',
    'eligible_expenses', '製品改良費
広告宣伝費
展示会出展費
カタログ・パンフレット作成費
市場調査費',
    'required_documents', '申請書
事業計画書
製品・サービスの説明資料
会社概要
確定申告書',
    'deadline', '2025-08-19',
    'issuerName', '東京都中小企業振興公社',
    'detailUrl', 'https://www.tokyo-kosha.or.jp/support/josei/jigyo/shogaisha.html',
    'pdfUrls', json_array(
      'https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002xq7z-att/R6_shogaisha_bosyuuyoukou_jimunotebiki_0717.pdf'
    )
  ),
  datetime('now'),
  datetime('now', '+7 days')
);

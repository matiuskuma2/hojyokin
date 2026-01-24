-- tokyo-kosha データを本番DBに投入
-- P3-3: WALL_CHAT_READY を増やす

-- 1. 製品開発着手支援助成事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-chakushu',
  'tokyo-kosha',
  '製品開発着手支援助成事業',
  5000000,
  '1/2',
  '東京都',
  '2026-03-31T17:00:00Z',
  1,
  '{"description":"東京都内中小企業者等が行う技術・製品開発の初期段階における取組を支援します。新製品・新技術の開発に着手するために必要な経費の一部を助成。","overview":"新製品・新技術開発の着手段階を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・申請テーマについて、自社で研究開発等を行う技術力及び開発体制を有していること\n・申請に必要な書類が整っていること","eligible_expenses":"原材料・副資材費、機械装置・工具器具費、委託・外注費、産業財産権出願・導入費、直接人件費、技術指導受入費","required_documents":"申請書、事業計画書、見積書、直近2期分の確定申告書、登記簿謄本、会社概要","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/chakushu.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000dtcu-att/R7chakushu_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 2. 新製品・新技術開発助成事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-shinseihin',
  'tokyo-kosha',
  '新製品・新技術開発助成事業',
  15000000,
  '1/2',
  '東京都',
  '2026-03-31T17:00:00Z',
  1,
  '{"description":"東京都内中小企業者等の新製品・新技術開発を支援する助成事業です。技術力向上と製品の高付加価値化を促進します。","overview":"新製品・新技術の開発を支援する東京都の助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・新規性・革新性のある製品・技術開発であること\n・開発に必要な技術力及び開発体制を有すること","eligible_expenses":"原材料・副資材費、機械装置・工具器具費、委託・外注費、産業財産権出願・導入費、直接人件費","required_documents":"申請書、事業計画書、見積書、直近2期分の確定申告書、登記簿謄本、会社概要、開発体制図","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/shinseihin.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000ec2j-att/R7shinseihin_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 3. TOKYO戦略的イノベーション促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-tokyo-innovation',
  'tokyo-kosha',
  '令和7年度 TOKYO戦略的イノベーション促進事業',
  80000000,
  '2/3',
  '東京都',
  '2026-06-30T17:00:00Z',
  1,
  '{"description":"東京発のイノベーションを創出するため、社会課題の解決に資する製品・サービスの事業化に取り組む中小企業等を支援します。","overview":"社会課題解決型のイノベーション創出を支援する大型助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・社会課題の解決に資する革新的な製品・サービス開発であること\n・事業化に向けた計画が具体的であること\n・必要な技術力・開発体制・資金調達計画を有すること","eligible_expenses":"機械装置・工具器具費、原材料・副資材費、委託・外注費、直接人件費、産業財産権出願費、広報費、展示会出展費","required_documents":"申請書、事業計画書、収支計画書、見積書、直近3期分の決算書、登記簿謄本、会社概要、技術資料","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/tokyo-innovation.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002621v-att/R7_boshuyoukoukai_tokyo-innovation.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 4. 中小企業デジタルツール導入促進支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-digital-tool',
  'tokyo-kosha',
  '中小企業デジタルツール導入促進支援事業',
  1500000,
  '1/2',
  '東京都',
  '2026-09-30T17:00:00Z',
  1,
  '{"description":"東京都内中小企業のDX推進を支援するため、デジタルツール導入に係る経費の一部を助成します。業務効率化・生産性向上を実現。","overview":"中小企業のデジタルツール導入を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者\n・常時使用する従業員が300人以下であること\n・導入するデジタルツールの活用計画があること","eligible_expenses":"ソフトウェア導入費、クラウドサービス利用費、デジタル機器購入費、導入支援費","required_documents":"申請書、導入計画書、見積書、直近の確定申告書、登記簿謄本（法人）または開業届（個人）","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/digital-tool.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002z8qy-att/R7-2_digitaltool_youkou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 5. 事業承継支援助成金
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-shoukei',
  'tokyo-kosha',
  '令和7年度 第2回 事業承継支援助成金',
  2000000,
  '2/3',
  '東京都',
  '2026-06-30T17:00:00Z',
  1,
  '{"description":"中小企業の円滑な事業承継を支援するため、事業承継に係る経費の一部を助成します。後継者不在による廃業を防止。","overview":"中小企業の事業承継を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者\n・事業承継計画を策定していること\n・承継予定日から5年以内であること","eligible_expenses":"専門家謝金、設備導入費、広報費、人材採用費、研修費","required_documents":"申請書、事業承継計画書、見積書、直近2期分の決算書、登記簿謄本、承継計画認定書（該当する場合）","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/shoukei.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000emfd-att/2boshuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 6. ゼロエミッション推進に向けた事業転換支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-zeroemi_kaihatsu',
  'tokyo-kosha',
  'ゼロエミッション推進に向けた事業転換支援事業（製品開発助成）',
  10000000,
  '2/3',
  '東京都',
  '2026-09-30T17:00:00Z',
  1,
  '{"description":"2050年カーボンニュートラル実現に向け、ゼロエミッションに資する製品・技術開発を行う中小企業等を支援します。","overview":"脱炭素・ゼロエミッションに資する製品開発を支援","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・ゼロエミッションに資する製品・技術開発であること\n・環境負荷低減効果が見込めること","eligible_expenses":"原材料・副資材費、機械装置費、外注・委託費、直接人件費、産業財産権出願費","required_documents":"申請書、事業計画書、見積書、直近2期分の決算書、登記簿謄本、環境負荷低減効果の説明資料","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/zeroemi_kaihatsu.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002zq9v-att/03_1_tanndokusinnsei_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 7. 高齢者向け新ビジネス創出支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-koureisha',
  'tokyo-kosha',
  '令和7年度 高齢者向け新ビジネス創出支援事業',
  15000000,
  '2/3',
  '東京都',
  '2026-06-30T17:00:00Z',
  1,
  '{"description":"高齢者の生活の質向上に資する製品・サービスの開発を支援します。超高齢社会における新たなビジネス創出を促進。","overview":"高齢者向け製品・サービス開発を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・高齢者の生活の質向上に資する製品・サービス開発であること\n・事業化に向けた計画が具体的であること","eligible_expenses":"機械装置費、原材料費、外注・委託費、直接人件費、広報費、展示会出展費","required_documents":"申請書、事業計画書、見積書、直近2期分の決算書、登記簿謄本、ターゲット高齢者層の説明資料","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/koureisha/index.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/koureisha/o9p1db0000000oi9-att/r7_koureisha_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 8. 受動喫煙防止対策支援コース
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-jyudoukitsuen',
  'tokyo-kosha',
  '事業環境変化に対応した経営基盤強化事業（受動喫煙防止対策支援コース）',
  4000000,
  '2/3',
  '東京都',
  '2026-12-31T17:00:00Z',
  1,
  '{"description":"受動喫煙防止対策に取り組む中小飲食店等を支援します。喫煙専用室設置等に係る経費の一部を助成。","overview":"受動喫煙防止対策に取り組む中小企業を支援","application_requirements":"・東京都内に主たる事業所を有する中小企業者\n・飲食店等で受動喫煙防止対策を実施すること\n・改正健康増進法等の規制に適合すること","eligible_expenses":"喫煙専用室設置費、既存喫煙室撤去費、換気設備費、工事費","required_documents":"申請書、工事計画書、見積書、図面、直近の確定申告書、登記簿謄本","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/jyudoukitsuen-boushitaisaku.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000002puyi-att/boshu01secchi.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 9. オフィスビル等のエネルギー効率化による経営安定事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-building_energy',
  'tokyo-kosha',
  'オフィスビル等のエネルギー効率化による経営安定事業',
  30000000,
  '1/2',
  '東京都',
  '2026-10-31T16:30:00Z',
  1,
  '{"description":"オフィスビル等の省エネルギー化を推進し、中小企業の経営安定を支援します。エネルギーコスト削減とCO2排出削減を実現。","overview":"オフィスビルの省エネ改修を支援する助成事業","application_requirements":"・東京都内にオフィスビル等を所有・賃借する中小企業者\n・省エネルギー診断を受けていること\n・導入設備の省エネ効果が見込めること","eligible_expenses":"省エネ設備導入費、LED照明設備費、空調設備更新費、専門家派遣費","required_documents":"申請書、省エネ計画書、見積書、省エネ診断報告書、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/building_energy.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cnc7-att/r7_office_building_energy_joseikin_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 10. エネルギー自給促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-energy_jikyu',
  'tokyo-kosha',
  '中小企業の経営安定化に向けたエネルギー自給促進事業',
  15000000,
  '1/2',
  '東京都',
  '2026-08-29T17:00:00Z',
  1,
  '{"description":"エネルギー価格高騰に対応するため、自家発電設備等の導入を支援します。エネルギー自給率向上で経営安定化。","overview":"太陽光発電等の自家発電設備導入を支援","application_requirements":"・東京都内に主たる事業所を有する中小企業者\n・自家発電設備等を導入すること\n・エネルギー自給率向上計画があること","eligible_expenses":"太陽光発電設備費、蓄電池設備費、設置工事費、専門家派遣費","required_documents":"申請書、エネルギー自給計画書、見積書、設備仕様書、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/energy_jikyu.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cn9h-att/r7_energy_jikyu_joseikin_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 11. 製品改良／規格適合・認証取得支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-kairyo',
  'tokyo-kosha',
  '製品改良／規格適合・認証取得支援事業',
  5000000,
  '1/2',
  '東京都',
  '2026-03-31T17:00:00Z',
  1,
  '{"description":"既存製品の改良や規格適合・認証取得を支援します。製品の競争力強化と新市場開拓を促進。","overview":"製品改良・規格認証取得を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・既存製品の改良または規格適合・認証取得を行うこと\n・改良・認証取得により販路拡大が見込めること","eligible_expenses":"試験・検査費、認証取得費、外注・委託費、原材料費、直接人件費","required_documents":"申請書、製品改良計画書、見積書、対象製品の説明資料、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/kairyo.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000000egr5-att/05_R7kairyo_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 12. 安全・安心な東京の実現に向けた製品開発支援事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-anzen-anshin',
  'tokyo-kosha',
  '安全・安心な東京の実現に向けた製品開発支援事業',
  15000000,
  '2/3',
  '東京都',
  '2026-06-30T17:00:00Z',
  1,
  '{"description":"都民の安全・安心に資する製品・技術の開発を支援します。防災・減災・セキュリティ関連の製品開発を促進。","overview":"安全・安心に資する製品開発を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・都民の安全・安心に資する製品・技術開発であること\n・実用化・事業化に向けた計画があること","eligible_expenses":"機械装置費、原材料費、外注・委託費、直接人件費、産業財産権出願費","required_documents":"申請書、事業計画書、見積書、製品概要説明資料、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/anzen-anshin.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal000003cv3a-att/r7_anzen-anshin_guideline.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 13. TOKYO地域資源等を活用したイノベーション創出事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-chiiki',
  'tokyo-kosha',
  'TOKYO地域資源等を活用したイノベーション創出事業',
  15000000,
  '2/3',
  '東京都',
  '2026-06-30T17:00:00Z',
  1,
  '{"description":"東京の地域資源（伝統工芸品、農林水産物等）を活用した新製品・新サービスの開発を支援します。","overview":"地域資源を活用した新製品開発を支援","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・東京の地域資源を活用した製品・サービス開発であること\n・地域経済の活性化に資すること","eligible_expenses":"原材料費、機械装置費、外注・委託費、直接人件費、広報費","required_documents":"申請書、事業計画書、見積書、地域資源活用の説明資料、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/chiiki.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/rmepal00000269ce-att/chiikishigenbosyuuyoukou_2.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 14. 医療機器産業参入促進助成事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-medical',
  'tokyo-kosha',
  '医療機器産業参入促進助成事業',
  10000000,
  '2/3',
  '東京都',
  '2026-08-31T17:00:00Z',
  1,
  '{"description":"医療機器産業への新規参入を目指す中小企業等を支援します。医療機器の開発・製造に必要な経費の一部を助成。","overview":"医療機器産業への参入を支援する助成事業","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・医療機器の開発・製造を行うこと\n・医療機器製造業許可取得または取得予定であること","eligible_expenses":"開発試作費、試験・検査費、外注・委託費、認証取得費、直接人件費","required_documents":"申請書、事業計画書、見積書、医療機器製造業許可書（または取得計画）、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/medical/index.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/medical/rmepal0000000ec2-att/22th_jigyouka_youkou_0808.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

-- 15. フェムテック開発支援・普及促進事業
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate, 
  target_area_search, acceptance_end_datetime, request_reception_display_flag,
  detail_json, cached_at, expires_at
) VALUES (
  'tokyo-kosha-femtech',
  'tokyo-kosha',
  '女性活躍のためのフェムテック開発支援・普及促進事業',
  15000000,
  '2/3',
  '東京都',
  '2026-06-30T17:00:00Z',
  1,
  '{"description":"女性特有の健康課題をテクノロジーで解決するフェムテック製品・サービスの開発を支援します。","overview":"フェムテック製品・サービス開発を支援","application_requirements":"・東京都内に主たる事業所を有する中小企業者等\n・女性の健康課題解決に資する製品・サービス開発であること\n・事業化に向けた計画が具体的であること","eligible_expenses":"機械装置費、原材料費、外注・委託費、直接人件費、広報費、臨床試験費","required_documents":"申請書、事業計画書、見積書、製品概要説明資料、登記簿謄本、直近2期分の決算書","issuerName":"東京都中小企業振興公社","detailUrl":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/femtech/index.html","pdfUrls":["https://www.tokyo-kosha.or.jp/support/josei/jigyo/femtech/ucg1fj0000002ff9-att/r7_femtech_bosyuuyoukou.pdf"]}',
  datetime('now'),
  datetime('now', '+7 days')
);

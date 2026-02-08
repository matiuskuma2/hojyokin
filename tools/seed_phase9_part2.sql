-- Phase 9 Part 2: 新規50件の重要補助金・助成金（#187〜#236）
-- カテゴリ: 研究開発・知財系、国際展開・貿易系、まちづくり・不動産系、
--           教育・人材系、環境・循環経済系、建設・インフラ系、都道府県独自主要系

-- ====== 7. 研究開発・知財・特許系 (8件) ======

-- #187 中小企業知的財産活動支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIZAI-SHIEN', '中小企業知的財産活動支援事業費補助金', 'METI', '経済産業省（特許庁）', '00', '["innovation","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIZAI-SHIEN', 'manual', '中小企業知的財産活動支援事業費補助金', 5000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"中小企業の知的財産の創造・保護・活用を一体的に支援する事業","target":"中小企業","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"特許庁・INPIT経由で公募","url":"https://www.jpo.go.jp/support/chusho/","source":"特許庁","requirements":["知的財産活用計画の策定","特許・商標等の出願計画"],"documents":["事業計画書","知的財産活用計画","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIZAI-SHIEN', 1);

-- #188 特許料等減免制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOKKYO-GENMEN', '特許料等減免制度', 'JPO', '特許庁', '00', '["innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOKKYO-GENMEN', 'manual', '特許料等減免制度（中小企業・スタートアップ向け）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業やスタートアップ企業の特許出願・審査請求・特許料の減免制度","target":"中小企業、小規模企業、スタートアップ（設立10年未満）","amount":"審査請求料1/2〜1/3軽減、特許料（第1〜10年）1/2〜1/3軽減、国際出願手数料の減免","period":"通年","application":"特許庁に出願時に申請","url":"https://www.jpo.go.jp/system/process/tesuryo/genmen/genmen20190401/index.html","source":"特許庁","requirements":["中小企業基本法に定める中小企業であること","スタートアップの場合は設立10年未満"],"documents":["減免申請書","中小企業であることの証明書類"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOKKYO-GENMEN', 1);

-- #189 戦略的基盤技術高度化支援事業（サポイン）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAPOIN', '戦略的基盤技術高度化支援事業（サポイン）', 'METI', '経済産業省', '00', '["innovation","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAPOIN', 'manual', '戦略的基盤技術高度化支援事業（サポイン・Go-Tech統合）', 90000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"中小企業の基盤技術（精密加工、表面処理、情報処理等）の高度化を支援する研究開発補助金。Go-Tech事業として統合","target":"中小企業（ものづくり基盤技術）","amount":"単年度上限9,000万円（2〜3年計画で最大2.25億円）、補助率2/3","period":"令和8年度","application":"経済産業省の公募に応じて申請（Go-Tech事業として）","url":"https://www.chusho.meti.go.jp/keiei/sapoin/","source":"経済産業省","requirements":["中小ものづくり高度化法に基づく特定ものづくり基盤技術","大学・研究機関との共同研究","事業化計画"],"documents":["研究開発計画書","共同研究体制","事業化計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAPOIN', 1);

-- #190 研究開発税制
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RD-ZEISEI', '研究開発税制（試験研究費の税額控除）', 'METI', '経済産業省', '00', '["innovation","tax"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RD-ZEISEI', 'manual', '研究開発税制（試験研究費の税額控除制度）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"企業が支出した試験研究費に対して税額控除を認める制度。AI・DX投資を含む","target":"全業種の法人（中小企業は控除率が有利）","amount":"総額型：試験研究費の2〜14%を税額控除、中小企業技術基盤強化税制：12〜17%を控除","period":"通年（確定申告時に適用）","application":"確定申告時に申告","url":"https://www.meti.go.jp/policy/tech_promotion/tax.html","source":"経済産業省","requirements":["試験研究費の支出実績","確定申告書への記載"],"documents":["確定申告書","試験研究費の明細書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RD-ZEISEI', 1);

-- #191 オープンイノベーション促進税制
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('OPEN-INNOVATION', 'オープンイノベーション促進税制', 'METI', '経済産業省', '00', '["innovation","tax"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('OPEN-INNOVATION', 'manual', 'オープンイノベーション促進税制（スタートアップへの出資優遇）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"事業会社がスタートアップに一定の出資を行った場合、出資額の25%を所得控除できる税制","target":"スタートアップに出資する事業会社","amount":"出資額の25%を所得控除（1件あたり出資額1億円以上、外国法人は5億円以上）","period":"令和8年度末まで","application":"経済産業大臣の証明を受けた上で確定申告","url":"https://www.meti.go.jp/policy/economy/keiei_innovation/open_innovation/","source":"経済産業省","requirements":["スタートアップへの新規出資","出資額1億円以上","経営資源の活用に関する計画"],"documents":["オープンイノベーション証明書","出資契約書","確定申告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'OPEN-INNOVATION', 1);

-- #192 NEDO先導研究プログラム
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NEDO-SENDO', 'NEDO先導研究プログラム', 'NEDO', '新エネルギー・産業技術総合開発機構', '00', '["innovation","green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NEDO-SENDO', 'manual', 'NEDO先導研究プログラム・ムーンショット型研究開発', 100000000, '定額〜2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"NEDOの先導研究プログラムとして、革新的技術シーズの発掘・育成を行う研究開発支援","target":"企業、大学、研究機関","amount":"テーマにより異なる。先導研究：上限数千万〜1億円","period":"令和8年度","application":"NEDO公募に応じて申請","url":"https://www.nedo.go.jp/activities/introducing.html","source":"NEDO","requirements":["革新的な技術シーズ","事業化への見通し","産学連携体制"],"documents":["研究開発計画書","体制図","予算計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NEDO-SENDO', 1);

-- #193 JST A-STEP（研究成果最適展開支援プログラム）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JST-ASTEP', 'JST A-STEP（研究成果最適展開支援プログラム）', 'JST', '科学技術振興機構', '00', '["innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JST-ASTEP', 'manual', 'A-STEP（研究成果最適展開支援プログラム）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"大学等の研究成果を基にした技術移転・実用化を支援するプログラム","target":"大学等の研究者と企業の共同研究チーム","amount":"トライアウト：上限300万円、産学共同：上限5,000万円","period":"令和8年度","application":"JSTの公募に応じて申請","url":"https://www.jst.go.jp/a-step/","source":"科学技術振興機構（JST）","requirements":["大学等の基礎研究成果","産学共同体制","事業化計画"],"documents":["研究計画書","産学連携体制","知財戦略"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JST-ASTEP', 1);

-- #194 知財総合支援窓口
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIZAI-SOUDAN', '知財総合支援窓口', 'INPIT', '工業所有権情報・研修館', '00', '["innovation","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIZAI-SOUDAN', 'manual', '知財総合支援窓口（全国47都道府県設置・無料相談）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"全国47都道府県に設置された知的財産に関する無料相談窓口。弁理士・弁護士等の専門家による支援","target":"中小企業、個人事業主、スタートアップ","amount":"相談無料、専門家派遣無料","period":"通年","application":"電話・メール・来訪で相談","url":"https://chizai-portal.inpit.go.jp/","source":"INPIT（工業所有権情報・研修館）","requirements":["特になし（誰でも利用可能）"],"documents":["相談申込（口頭可）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIZAI-SOUDAN', 1);

-- ====== 8. 国際展開・貿易・海外事業系 (8件) ======

-- #195 海外展開・事業再編資金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAIGAI-YUSHI', '海外展開・事業再編資金（日本政策金融公庫）', 'JFC', '日本政策金融公庫', '00', '["finance","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAIGAI-YUSHI', 'manual', '海外展開・事業再編資金（中小企業の海外進出支援融資）', 72000000, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"海外展開を行う中小企業への低利融資。海外直接投資、輸出拡大、事業再編等を支援","target":"海外展開を行う中小企業","amount":"融資限度額7,200万円（運転資金含む）、特別利率適用","period":"通年","application":"日本政策金融公庫の支店に申込","url":"https://www.jfc.go.jp/n/finance/search/kaigaitenkai.html","source":"日本政策金融公庫","requirements":["海外展開事業計画の策定","海外直接投資・輸出等の計画"],"documents":["事業計画書","海外展開計画","財務諸表"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAIGAI-YUSHI', 1);

-- #196 中小企業海外ビジネス人材育成支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAIGAI-JINZAI', 'JETRO新輸出大国コンソーシアム', 'JETRO', '日本貿易振興機構', '00', '["export","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAIGAI-JINZAI', 'manual', 'JETRO新輸出大国コンソーシアム（海外展開総合支援）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"JETROを中心とした関係機関の連携により、中小企業の海外展開を総合的に支援するコンソーシアム","target":"海外展開を目指す中小企業","amount":"相談・支援は原則無料、海外展示会出展費等の補助（上限あり）","period":"通年","application":"JETROの地域事務所に相談","url":"https://www.jetro.go.jp/services/consortium/","source":"JETRO","requirements":["海外展開の意欲・計画","中小企業であること"],"documents":["相談申込書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAIGAI-JINZAI', 1);

-- #197 貿易保険（NEXI）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BOUEKI-HOKEN', '貿易保険（NEXI）', 'NEXI', '日本貿易保険', '00', '["export","finance"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BOUEKI-HOKEN', 'manual', '貿易保険・中小企業輸出代金保険', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"輸出取引等に伴う代金回収不能リスクをカバーする公的保険。中小企業向けの簡易プランあり","target":"輸出を行う企業（特に中小企業向けプランあり）","amount":"中小企業向け：保険料率の割引、簡易引受基準の適用","period":"通年","application":"NEXIに直接申込","url":"https://www.nexi.go.jp/product/","source":"日本貿易保険（NEXI）","requirements":["輸出契約の締結","信用調査への協力"],"documents":["保険申込書","輸出契約書","信用調査資料"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BOUEKI-HOKEN', 1);

-- #198 外国人材受入・共生支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GAIKOKUJIN-UKEIRE', '外国人材の受入れ・共生のための総合的対応策', 'MOJ', '法務省（出入国在留管理庁）', '00', '["employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GAIKOKUJIN-UKEIRE', 'manual', '外国人材受入・共生支援（特定技能・技能実習制度関連）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"外国人材の受入・共生に関する各種支援策。特定技能制度、育成就労制度（旧技能実習）等の活用支援","target":"外国人材を受け入れる企業","amount":"人材確保等支援助成金（外国人就労環境整備コース）との連携、各自治体独自の支援金あり","period":"通年","application":"出入国在留管理庁、地方出入国在留管理局に相談","url":"https://www.moj.go.jp/isa/policies/coexistence/index.html","source":"出入国在留管理庁","requirements":["在留資格に基づく適正な受入","支援計画の策定","日本語教育の機会提供"],"documents":["在留資格申請書","支援計画書","雇用契約書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GAIKOKUJIN-UKEIRE', 1);

-- #199 EPA活用支援（経済連携協定関連）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('EPA-KATSUYOU', 'EPA活用支援（経済連携協定による関税優遇）', 'METI', '経済産業省', '00', '["export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('EPA-KATSUYOU', 'manual', 'EPA/FTA活用による関税削減・貿易促進支援', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本が締結したEPA/FTA（RCEP、TPP11、日EU EPA等）を活用した関税削減のための支援","target":"輸出入を行う企業","amount":"EPA利用による関税削減（原産地証明書の取得支援は無料）","period":"通年","application":"日本商工会議所（特定原産地証明書）、JETRO（相談）","url":"https://www.meti.go.jp/policy/trade_policy/epa/","source":"経済産業省","requirements":["EPA締約国との取引","原産地規則の充足"],"documents":["特定原産地証明書申請書","原産品申告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'EPA-KATSUYOU', 1);

-- #200 JICA中小企業海外展開支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JICA-CHUSHO', 'JICA中小企業・SDGsビジネス支援事業', 'JICA', '国際協力機構', '00', '["export","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JICA-CHUSHO', 'manual', 'JICA中小企業・SDGsビジネス支援事業', 50000000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"開発途上国の課題解決に資する中小企業の製品・技術の海外展開を支援する事業","target":"中小企業","amount":"基礎調査：上限300万円、案件化調査：上限2,500万円、普及実証：上限5,000万円","period":"令和8年度","application":"JICAの公募に応じて申請","url":"https://www.jica.go.jp/priv_partner/activities/sme/","source":"JICA","requirements":["途上国の開発課題解決に資する製品・技術","事業化の見通し","SDGsへの貢献"],"documents":["提案書","企業概要","技術概要書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JICA-CHUSHO', 1);

-- #201 クールジャパン機構（海外展開支援投資）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('COOL-JAPAN', 'クールジャパン機構', 'CJF', '海外需要開拓支援機構', '00', '["export","culture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('COOL-JAPAN', 'manual', 'クールジャパン機構（海外需要開拓支援機構）による投資支援', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本の魅力ある商品・サービスの海外展開を、リスクマネー供給（出資・融資）で支援する官民ファンド","target":"海外展開を目指す日本企業","amount":"出資・融資（案件ごとに個別判断、数千万〜数十億円規模）","period":"通年","application":"クールジャパン機構に事業提案","url":"https://www.cj-fund.co.jp/","source":"海外需要開拓支援機構","requirements":["日本の魅力あるコンテンツ・商品の海外展開","収益性・事業性","波及効果"],"documents":["事業計画書","収支計画","海外市場調査"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'COOL-JAPAN', 1);

-- #202 海外サプライチェーン多元化等支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SUPPLY-TAGENKA', '海外サプライチェーン多元化等支援事業', 'METI', '経済産業省', '00', '["export","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SUPPLY-TAGENKA', 'manual', '海外サプライチェーン多元化等支援事業費補助金', 100000000, '1/2〜2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"経済安全保障の観点から、サプライチェーンの多元化・強靱化のための海外拠点整備等を支援","target":"製造業を中心とした企業","amount":"設備導入・実証事業：上限1億円（補助率1/2〜2/3）","period":"令和8年度","application":"経済産業省の公募に応じて申請","url":"https://www.meti.go.jp/policy/trade_policy/supply_chain/","source":"経済産業省","requirements":["サプライチェーンの脆弱性分析","多元化計画の策定","経済安全保障上の必要性"],"documents":["事業計画書","サプライチェーン分析","投資計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SUPPLY-TAGENKA', 1);

-- ====== 9. まちづくり・不動産・空き家対策系 (8件) ======

-- #203 空き家対策総合支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('AKIYA-TAISAKU', '空き家対策総合支援事業', 'MLIT', '国土交通省', '00', '["facility","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('AKIYA-TAISAKU', 'manual', '空き家対策総合支援事業（空家等対策特別措置法関連）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"空き家の除却、活用、適正管理を促進するための補助金。市区町村を通じた支援","target":"空き家の所有者、市区町村","amount":"除却：上限1,000万円、活用：上限1,000万円（補助率1/2）","period":"令和8年度","application":"市区町村を通じて申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000035.html","source":"国土交通省","requirements":["空家等対策計画に基づく事業","空き家の実態調査","地域への活用計画"],"documents":["事業計画書","空き家調査報告","活用計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'AKIYA-TAISAKU', 1);

-- #204 まちなか再生推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MACHINAKA-SAISEI', 'まちなか再生推進事業', 'MLIT', '国土交通省', '00', '["regional","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MACHINAKA-SAISEI', 'manual', 'まちなか再生推進事業（都市構造再編集中支援事業）', NULL, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中心市街地の再生、コンパクトシティの推進、都市機能の集約を支援する事業","target":"市区町村、まちづくり会社、商業施設管理者","amount":"都市機能誘導施設整備：補助率1/2等","period":"令和8年度","application":"国土交通省に計画を提出","url":"https://www.mlit.go.jp/toshi/toshi_machi_tk_000070.html","source":"国土交通省","requirements":["立地適正化計画の策定","都市機能誘導区域への施設整備","コンパクトシティの推進"],"documents":["立地適正化計画","施設整備計画","費用対効果分析"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MACHINAKA-SAISEI', 1);

-- #205 商店街活性化・観光消費創出事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUTENGAI-KASSEI', '商店街活性化・観光消費創出事業', 'METI', '経済産業省', '00', '["regional","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUTENGAI-KASSEI', 'manual', '商店街活性化・観光消費創出事業費補助金', 20000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"商店街等が行う活性化イベント、ICT活用、インバウンド対応等の取組を支援","target":"商店街振興組合、商工会・商工会議所","amount":"上限2,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省の公募に応じて申請","url":"https://www.chusho.meti.go.jp/shogyo/shogyo/","source":"経済産業省","requirements":["商店街の活性化計画","地域と連携した取組","持続可能な運営計画"],"documents":["事業計画書","商店街活性化計画","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUTENGAI-KASSEI', 1);

-- #206 サービス付き高齢者向け住宅整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAKOUJU', 'サービス付き高齢者向け住宅整備事業', 'MLIT', '国土交通省', '00', '["health","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAKOUJU', 'manual', 'サービス付き高齢者向け住宅整備事業（サ高住補助金）', 1200000, '1/10〜1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"サービス付き高齢者向け住宅（サ高住）の整備を支援する補助金","target":"サ高住の事業者（建設・改修）","amount":"新築：上限120万円/戸、改修：上限195万円/戸","period":"令和8年度","application":"サ高住の登録申請と併せて補助申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000007.html","source":"国土交通省","requirements":["高齢者住まい法に基づくサ高住の登録","バリアフリー基準の充足","安否確認・生活相談サービスの提供"],"documents":["補助金交付申請書","設計図書","登録申請書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAKOUJU', 1);

-- #207 住宅セーフティネット制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAFETY-NET-JUTAKU', '住宅セーフティネット制度', 'MLIT', '国土交通省', '00', '["facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAFETY-NET-JUTAKU', 'manual', '住宅セーフティネット制度（住宅確保要配慮者専用賃貸住宅改修費補助）', 2000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"低額所得者、高齢者、障害者、外国人等の住宅確保要配慮者の入居を拒まない住宅の改修費を補助","target":"セーフティネット住宅の賃貸人","amount":"改修費上限200万円/戸（補助率1/3、国1/3・地方1/3）","period":"令和8年度","application":"市区町村・都道府県を通じて申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000055.html","source":"国土交通省","requirements":["セーフティネット住宅としての登録","バリアフリー改修等","入居者の入居拒否をしないこと"],"documents":["補助申請書","改修計画","登録申請書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAFETY-NET-JUTAKU', 1);

-- #208 立地適正化計画関連事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RICCHI-TEKISEI', '立地適正化計画策定・推進支援事業', 'MLIT', '国土交通省', '00', '["regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RICCHI-TEKISEI', 'manual', '立地適正化計画策定・推進支援事業', 15000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"コンパクトシティ実現のための立地適正化計画の策定・推進を支援","target":"市区町村","amount":"計画策定費：上限1,500万円（定額補助）","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/toshi/toshi_machi_tk_000070.html","source":"国土交通省","requirements":["コンパクトシティの推進方針","都市機能誘導区域の設定","居住誘導区域の設定"],"documents":["計画策定方針","基礎調査データ","住民説明資料"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RICCHI-TEKISEI', 1);

-- #209 PPP/PFI推進支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('PPP-PFI', 'PPP/PFI推進支援事業', 'CAO', '内閣府', '00', '["facility","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('PPP-PFI', 'manual', 'PPP/PFI推進アクションプラン関連支援', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"公共施設の整備・運営に民間資金・ノウハウを活用するPPP/PFI事業の導入を支援","target":"地方公共団体、民間事業者","amount":"調査検討費：上限1,000万円程度（定額補助）","period":"令和8年度","application":"内閣府の公募に応じて申請","url":"https://www8.cao.go.jp/pfi/pfi_jouhou/pfi_jouhou_index.html","source":"内閣府","requirements":["PPP/PFI手法の導入検討","VFM（バリュー・フォー・マネー）の検証"],"documents":["検討報告書","VFM評価","事業スキーム案"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'PPP-PFI', 1);

-- #210 マンション管理適正化推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MANSION-KANRI', 'マンション管理適正化推進事業', 'MLIT', '国土交通省', '00', '["facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MANSION-KANRI', 'manual', 'マンション管理適正化推進事業・マンションストック長寿命化等モデル事業', 10000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"マンションの適正管理・長寿命化のためのモデル事業。管理計画認定制度と連携","target":"マンション管理組合、マンション管理業者","amount":"計画策定：上限1,000万円（補助率1/3）","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk5_000052.html","source":"国土交通省","requirements":["管理計画認定制度への対応","長期修繕計画の策定","管理組合の合意形成"],"documents":["事業計画書","管理計画","長期修繕計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MANSION-KANRI', 1);

-- ====== 10. 環境・循環経済・カーボンニュートラル系 (8件) ======

-- #211 GXリーグ参画支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GX-LEAGUE', 'GXリーグ・カーボンプライシング', 'METI', '経済産業省', '00', '["green","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GX-LEAGUE', 'manual', 'GXリーグ・GX経済移行債を活用した支援策', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"GX（グリーントランスフォーメーション）リーグへの参画とカーボンプライシングを通じた脱炭素投資支援","target":"GXリーグ参画企業（大企業〜中小企業）","amount":"GX経済移行債（20兆円規模）を原資とした各種GX投資支援","period":"2023年〜","application":"GXリーグ事務局に参画申請","url":"https://gx-league.go.jp/","source":"経済産業省","requirements":["2050年カーボンニュートラルへのコミット","排出削減目標の設定","GXダッシュボードでの開示"],"documents":["GXリーグ参画申請書","排出削減計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GX-LEAGUE', 1);

-- #212 環境省ESGリース促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ESG-LEASE', 'ESGリース促進事業', 'MOE', '環境省', '00', '["green","finance"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ESG-LEASE', 'manual', 'ESGリース促進事業（環境配慮型リース補助金）', NULL, '1〜4%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"脱炭素機器（省エネ機器、再エネ設備等）をリースで導入する際の総リース料を軽減する補助金","target":"中小企業（リース契約で脱炭素機器を導入）","amount":"総リース料の1〜4%を補助","period":"令和8年度","application":"ESGリース促進事業の指定リース事業者を通じて申請","url":"https://www.env.go.jp/earth/post_28.html","source":"環境省","requirements":["脱炭素機器のリース契約","指定リース事業者の利用","ESG要素の考慮"],"documents":["リース契約書","機器仕様書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ESG-LEASE', 1);

-- #213 J-クレジット制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('J-CREDIT', 'J-クレジット制度', 'METI', '経済産業省・環境省・農林水産省', '00', '["green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('J-CREDIT', 'manual', 'J-クレジット制度（温室効果ガス排出削減・吸収のクレジット化）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"省エネ設備の導入や再生可能エネルギーの利用等による温室効果ガスの排出削減・吸収量をクレジットとして売買できる制度","target":"排出削減に取り組む企業・団体","amount":"クレジット売却収入（1トンCO2あたり数千〜数万円で取引）","period":"通年","application":"J-クレジット制度事務局に申請","url":"https://japancredit.go.jp/","source":"経済産業省・環境省・農林水産省","requirements":["温室効果ガス排出削減・吸収プロジェクトの実施","モニタリング計画の策定","第三者検証"],"documents":["プロジェクト計画書","モニタリング報告書","検証報告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'J-CREDIT', 1);

-- #214 食品ロス削減推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FOOD-LOSS', '食品ロス削減推進事業', 'MAFF', '農林水産省', '00', '["food","green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FOOD-LOSS', 'manual', '食品ロス削減推進事業費補助金', 20000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"食品ロスの削減に向けた取組（フードバンク活動、商慣習見直し、消費者啓発等）を支援","target":"食品事業者、フードバンク団体、地方公共団体","amount":"上限2,000万円（補助率1/2）","period":"令和8年度","application":"農林水産省の公募に応じて申請","url":"https://www.maff.go.jp/j/shokusan/recycle/syoku_loss/","source":"農林水産省","requirements":["食品ロス削減推進法に基づく取組","数値目標の設定","成果の公表"],"documents":["事業計画書","食品ロス削減計画","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FOOD-LOSS', 1);

-- #215 プラスチック資源循環促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('PLASTIC-JUNKAN', 'プラスチック資源循環促進事業', 'MOE', '環境省', '00', '["green","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('PLASTIC-JUNKAN', 'manual', 'プラスチック資源循環等推進事業費補助金', 30000000, '1/2〜2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"プラスチックの資源循環（リサイクル、バイオプラスチック導入等）を推進する設備導入・技術開発を支援","target":"プラスチック関連製造業者、リサイクル事業者","amount":"設備導入：上限3,000万円（補助率1/2〜2/3）","period":"令和8年度","application":"環境省の公募に応じて申請","url":"https://www.env.go.jp/recycle/plastic/","source":"環境省","requirements":["プラスチック資源循環促進法への対応","資源循環計画の策定","CO2削減効果の定量化"],"documents":["事業計画書","設備仕様書","CO2削減効果算定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'PLASTIC-JUNKAN', 1);

-- #216 SBT認定支援・TCFD開示支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SBT-TCFD', 'SBT認定・TCFD開示支援事業', 'MOE', '環境省', '00', '["green","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SBT-TCFD', 'manual', 'SBT認定取得・TCFD提言に沿った情報開示支援', 2000000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"中小企業のSBT（Science Based Targets）認定取得やTCFD提言に沿った気候関連情報開示を支援","target":"中小企業","amount":"SBT認定取得支援：上限200万円、TCFD開示支援：上限200万円","period":"令和8年度","application":"環境省の公募に応じて申請","url":"https://www.env.go.jp/earth/ondanka/supply_chain/gvc/","source":"環境省","requirements":["温室効果ガス排出量の算定","削減目標の設定","情報開示の意向"],"documents":["申請書","排出量算定結果","削減目標案"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SBT-TCFD', 1);

-- #217 フロン排出抑制対策事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FLON-YOKUSEI', 'フロン排出抑制対策支援事業', 'MOE', '環境省', '00', '["green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FLON-YOKUSEI', 'manual', 'フロン排出抑制対策・グリーン冷媒転換支援事業', 20000000, '1/3〜1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"冷凍冷蔵機器・空調機器のノンフロン・低GWP化、グリーン冷媒への転換を支援","target":"冷凍冷蔵機器を使用する事業者、機器メーカー","amount":"設備導入：上限2,000万円（補助率1/3〜1/2）","period":"令和8年度","application":"環境省の公募に応じて申請","url":"https://www.env.go.jp/earth/ozone/hcfc.html","source":"環境省","requirements":["フロン排出抑制法への対応","グリーン冷媒機器への転換計画","GWP削減効果の定量化"],"documents":["事業計画書","機器仕様書","GWP削減効果算定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FLON-YOKUSEI', 1);

-- #218 バイオマス産業都市構想推進
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BIOMASS-TOSHI', 'バイオマス産業都市構想推進事業', 'MAFF', '農林水産省', '00', '["green","agriculture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BIOMASS-TOSHI', 'manual', 'バイオマス産業都市構想推進・バイオマス利活用事業', 50000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"バイオマス資源（木質、食品廃棄物、家畜排せつ物等）の活用による地域循環共生圏の構築を支援","target":"市区町村、バイオマス事業者","amount":"施設整備：上限5,000万円（補助率1/2）","period":"令和8年度","application":"農林水産省の公募に応じて申請","url":"https://www.maff.go.jp/j/shokusan/biomass/","source":"農林水産省","requirements":["バイオマス産業都市構想の策定","地域のバイオマス資源の賦存量調査","事業化計画"],"documents":["バイオマス産業都市構想","事業計画書","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BIOMASS-TOSHI', 1);

-- ====== 11. 建設・インフラ・都道府県主要系 (10件) ======

-- #219 建設業働き方改革推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KENSETSU-HATARAKIKATA', '建設業働き方改革推進事業', 'MLIT', '国土交通省', '00', '["construction","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KENSETSU-HATARAKIKATA', 'manual', '建設業働き方改革推進事業（週休二日制推進等）', 5000000, '定額〜1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"建設業における働き方改革（週休二日制、ICT活用、処遇改善等）を推進する支援事業","target":"建設業者","amount":"ICT導入支援：上限500万円、週休二日制推進等","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/tochi_fudousan_kensetsugyo_tk1_000001_00029.html","source":"国土交通省","requirements":["建設業許可を有すること","働き方改革行動計画の策定"],"documents":["事業計画書","働き方改革行動計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KENSETSU-HATARAKIKATA', 1);

-- #220 i-Construction推進事業（建設DX）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('I-CONSTRUCTION', 'i-Construction（建設DX）推進事業', 'MLIT', '国土交通省', '00', '["construction","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('I-CONSTRUCTION', 'manual', 'i-Construction推進事業（ICT活用工事・BIM/CIM）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"建設現場のICT化（3D測量、ドローン、BIM/CIM等）を推進する事業。生産性向上を図る","target":"建設業者、建設コンサルタント","amount":"ICT機器導入：上限1,000万円（補助率1/2）、BIM/CIM導入支援","period":"令和8年度","application":"国土交通省の公募に応じて申請","url":"https://www.mlit.go.jp/tec/i-construction/","source":"国土交通省","requirements":["ICT活用工事の実施計画","3D測量・設計データの活用","BIM/CIM対応の意向"],"documents":["事業計画書","ICT活用計画","投資計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'I-CONSTRUCTION', 1);

-- #221 下水道施設改築推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GESUIDOU-KAIKAKU', '下水道施設改築推進事業', 'MLIT', '国土交通省', '00', '["facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GESUIDOU-KAIKAKU', 'manual', '下水道施設改築推進事業（下水道長寿命化・脱炭素化）', NULL, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"老朽化した下水道施設の改築・長寿命化、省エネ・脱炭素化を支援する事業","target":"地方公共団体","amount":"施設改築費の1/2等","period":"令和8年度","application":"国土交通省に計画を提出","url":"https://www.mlit.go.jp/mizukokudo/sewerage/","source":"国土交通省","requirements":["下水道ストックマネジメント計画の策定","施設の機能診断結果","改築計画"],"documents":["ストックマネジメント計画","機能診断結果","改築計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GESUIDOU-KAIKAKU', 1);

-- #222 東京都中小企業振興公社 各種助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOKYO-SHINKOU', '東京都中小企業振興公社 各種助成金', 'TOKYO-SME', '東京都中小企業振興公社', '13', '["regional","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOKYO-SHINKOU', 'manual', '東京都中小企業振興公社 各種助成金（総合案内）', NULL, NULL, '東京都', '2026-04-01', '2027-03-31',
'{"overview":"東京都の中小企業向け各種助成金の総合案内。創業、設備投資、DX、海外展開等の多様な支援メニュー","target":"東京都内の中小企業","amount":"メニューにより異なる（例：創業助成金300万円、設備投資助成1億円等）","period":"令和8年度（各助成金の公募時期による）","application":"東京都中小企業振興公社に申請","url":"https://www.tokyo-kosha.or.jp/support/josei/","source":"東京都中小企業振興公社","requirements":["東京都内に事業所を有すること","各助成金の個別要件"],"documents":["各助成金の申請書","事業計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOKYO-SHINKOU', 1);

-- #223 大阪府中小企業DX推進支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('OSAKA-DX', '大阪府中小企業DX推進支援事業', 'OSAKA', '大阪府', '27', '["regional","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('OSAKA-DX', 'manual', '大阪府中小企業DX推進支援事業（おおさかDX推進プロジェクト）', 2000000, '1/2〜2/3', '大阪府', '2026-04-01', '2027-02-28',
'{"overview":"大阪府内の中小企業のDX推進（デジタル化診断、IT導入、業務効率化等）を支援する事業","target":"大阪府内の中小企業","amount":"DXコンサルティング：無料、設備導入補助：上限200万円（補助率1/2〜2/3）","period":"令和8年度","application":"大阪産業局を通じて申請","url":"https://www.pref.osaka.lg.jp/o180060/keieishien/dx/","source":"大阪府","requirements":["大阪府内に事業所を有すること","DX推進計画の策定"],"documents":["申請書","DX推進計画","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'OSAKA-DX', 1);

-- #224 愛知県あいちスタートアップ支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('AICHI-STARTUP', 'あいちスタートアップ支援事業', 'AICHI', '愛知県', '23', '["regional","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('AICHI-STARTUP', 'manual', 'あいちスタートアップ戦略・PRE-STATION Ai', 5000000, '定額〜2/3', '愛知県', '2026-04-01', '2027-02-28',
'{"overview":"愛知県のスタートアップエコシステム構築。STATION Aiを拠点とした起業支援、アクセラレーション","target":"愛知県内のスタートアップ、起業家","amount":"起業支援金：上限500万円、アクセラレーションプログラム等","period":"令和8年度","application":"STATION Ai、愛知県スタートアップ推進課に相談","url":"https://aichi-startup.jp/","source":"愛知県","requirements":["愛知県内での事業展開","スタートアップ・起業の意向"],"documents":["事業計画書","企業概要"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'AICHI-STARTUP', 1);

-- #225 福岡県スタートアップ支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FUKUOKA-STARTUP', '福岡スタートアップ支援（Fukuoka Growth Next）', 'FUKUOKA', '福岡市・福岡県', '40', '["regional","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FUKUOKA-STARTUP', 'manual', '福岡スタートアップ支援（Fukuoka Growth Next・グローバル創業特区）', 5000000, '定額〜2/3', '福岡県', '2026-04-01', '2027-02-28',
'{"overview":"福岡市のスタートアップ支援拠点Fukuoka Growth Nextを中心としたエコシステム。グローバル創業特区としての各種優遇","target":"福岡県内のスタートアップ、起業家","amount":"起業支援金：上限500万円、各種アクセラレーションプログラム","period":"令和8年度","application":"Fukuoka Growth Next、福岡市スタートアップ支援課に相談","url":"https://growth-next.com/","source":"福岡市・福岡県","requirements":["福岡県内での事業展開","スタートアップ・起業の意向"],"documents":["事業計画書","企業概要"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FUKUOKA-STARTUP', 1);

-- #226 北海道ゼロカーボン推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HOKKAIDO-ZERO-C', '北海道ゼロカーボン推進事業', 'HOKKAIDO', '北海道', '01', '["regional","green"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HOKKAIDO-ZERO-C', 'manual', '北海道ゼロカーボン推進事業費補助金', 10000000, '1/2', '北海道', '2026-04-01', '2027-02-28',
'{"overview":"北海道の豊富な再生可能エネルギー資源を活用したゼロカーボン推進事業","target":"北海道内の事業者","amount":"再エネ設備導入：上限1,000万円（補助率1/2）","period":"令和8年度","application":"北海道経済部に申請","url":"https://www.pref.hokkaido.lg.jp/kz/kke/","source":"北海道","requirements":["北海道内に事業所を有すること","CO2削減計画の策定"],"documents":["申請書","CO2削減計画","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HOKKAIDO-ZERO-C', 1);

-- #227 沖縄振興特別推進交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('OKINAWA-SHINKOU', '沖縄振興特別推進交付金（一括交付金）', 'CAO', '内閣府沖縄担当部局', '47', '["regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('OKINAWA-SHINKOU', 'manual', '沖縄振興特別推進交付金（一括交付金・ソフト交付金）', NULL, '8/10', '沖縄県', '2026-04-01', '2027-03-31',
'{"overview":"沖縄県の振興を目的とした特別交付金。産業振興、観光振興、人材育成等の幅広い事業に活用可能","target":"沖縄県、沖縄県内市町村","amount":"交付率8/10（補助率80%）","period":"令和8年度","application":"沖縄県・市町村を通じて申請","url":"https://www.pref.okinawa.jp/site/kikaku/chosei/kikaku/ikkatsu-koufukin.html","source":"内閣府","requirements":["沖縄振興に資する事業","沖縄21世紀ビジョン基本計画との整合"],"documents":["事業計画書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'OKINAWA-SHINKOU', 1);

-- #228 埼玉県中小企業・スタートアップ支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAITAMA-SME', '埼玉県中小企業・スタートアップ支援施策', 'SAITAMA', '埼玉県', '11', '["regional","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAITAMA-SME', 'manual', '埼玉県中小企業・スタートアップ支援（渋沢栄一起業家サロン等）', 3000000, '1/2〜2/3', '埼玉県', '2026-04-01', '2027-02-28',
'{"overview":"埼玉県の中小企業向け支援施策。渋沢栄一起業家サロン、デジタル化支援、経営革新支援等","target":"埼玉県内の中小企業・スタートアップ","amount":"各種補助金：上限300万円程度（プログラムにより異なる）","period":"令和8年度","application":"埼玉県産業振興公社に相談","url":"https://www.pref.saitama.lg.jp/a0803/","source":"埼玉県","requirements":["埼玉県内に事業所を有すること"],"documents":["申請書","事業計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAITAMA-SME', 1);

-- ====== 12. その他重要支援系 (8件) ======

-- #229 中小企業活性化パッケージ
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KASSEIKA-PKG', '中小企業活性化パッケージ', 'METI', '経済産業省（中小企業庁）', '00', '["management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KASSEIKA-PKG', 'manual', '中小企業活性化パッケージ（総合支援策）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"資金繰り支援、事業再生支援、経営改善支援等を一体的に提供する中小企業向け総合パッケージ","target":"経営課題を抱える中小企業","amount":"各種支援策の組み合わせ（融資、補助金、専門家派遣等）","period":"通年","application":"中小企業活性化協議会、よろず支援拠点等に相談","url":"https://www.chusho.meti.go.jp/kinyu/package/","source":"中小企業庁","requirements":["経営上の課題を抱えていること"],"documents":["相談申込書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KASSEIKA-PKG', 1);

-- #230 ふるさと納税活用型クラウドファンディング
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FURUSATO-CF', 'ふるさと納税活用型クラウドファンディング', 'MIC', '総務省', '00', '["regional","finance"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FURUSATO-CF', 'manual', 'ふるさと納税活用型クラウドファンディング（ガバメントクラウドファンディング）', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"ふるさと納税の仕組みを活用したクラウドファンディング。地域の課題解決プロジェクトへの寄付を募集","target":"地方公共団体","amount":"プロジェクト規模による（数十万〜数千万円）","period":"通年","application":"ふるさとチョイス等のプラットフォームを通じて実施","url":"https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/","source":"総務省","requirements":["ふるさと納税の対象となる地方公共団体","プロジェクトの公益性"],"documents":["プロジェクト企画書","予算計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FURUSATO-CF', 1);

-- #231 スポーツ産業振興事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SPORTS-SHINKOU', 'スポーツ産業振興事業', 'MEXT', '文部科学省（スポーツ庁）', '00', '["culture","innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SPORTS-SHINKOU', 'manual', 'スポーツ産業振興・スポーツオープンイノベーション推進事業', 10000000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"スポーツ産業の成長促進、スポーツテックの活用、地域スポーツ振興等を支援する事業","target":"スポーツ関連企業、地方公共団体、スポーツ団体","amount":"上限1,000万円程度（定額補助）","period":"令和8年度","application":"スポーツ庁の公募に応じて申請","url":"https://www.mext.go.jp/sports/b_menu/sports/mcatetop08/list/1372039.htm","source":"スポーツ庁","requirements":["スポーツ産業の成長に資する事業","技術活用の見通し","持続可能性"],"documents":["事業計画書","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SPORTS-SHINKOU', 1);

-- #232 宇宙産業基盤強化事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('UCHUU-KIBAN', '宇宙産業基盤強化事業', 'METI', '経済産業省', '00', '["innovation","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('UCHUU-KIBAN', 'manual', '宇宙産業技術情報基盤整備事業・宇宙開発利用推進費', 50000000, '定額〜2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"宇宙分野のスタートアップ支援、衛星データ活用、宇宙ビジネスの創出を支援","target":"宇宙関連企業、スタートアップ","amount":"上限5,000万円程度（プログラムにより異なる）","period":"令和8年度","application":"経済産業省・JAXA等の公募に応じて申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/space/","source":"経済産業省","requirements":["宇宙関連技術・サービスの開発計画","事業化の見通し"],"documents":["事業計画書","技術仕様書","収支計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'UCHUU-KIBAN', 1);

-- #233 量子技術イノベーション推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RYOUSHI-INNOVATION', '量子技術イノベーション推進事業', 'MEXT', '文部科学省', '00', '["innovation"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RYOUSHI-INNOVATION', 'manual', '量子技術イノベーション拠点・産業利用推進事業', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"量子コンピュータ・量子通信等の量子技術の研究開発・産業利用を推進する事業","target":"研究機関、大学、量子技術関連企業","amount":"プログラムにより異なる（数千万〜1億円規模）","period":"令和8年度","application":"文部科学省・NICT等の公募に応じて申請","url":"https://www.mext.go.jp/a_menu/shinkou/ryoushi/","source":"文部科学省","requirements":["量子技術の研究開発計画","産学連携体制","社会実装の見通し"],"documents":["研究開発計画書","体制図","予算計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RYOUSHI-INNOVATION', 1);

-- #234 教育訓練給付金（一般・専門実践）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KYOUIKU-KUNREN', '教育訓練給付金制度', 'MHLW', '厚生労働省', '00', '["employment","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KYOUIKU-KUNREN', 'manual', '教育訓練給付金制度（一般教育訓練・専門実践教育訓練）', 1120000, '20〜70%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"厚生労働大臣が指定する教育訓練を受講・修了した場合に、受講費用の一部が支給される制度","target":"雇用保険の一般被保険者（在職者）または離職後1年以内の者","amount":"一般教育訓練：受講費の20%（上限10万円）、専門実践：受講費の50〜70%（年間上限56万円×最長4年=最大224万円）","period":"通年","application":"ハローワークに申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/kyouiku.html","source":"厚生労働省","requirements":["雇用保険の被保険者期間要件","指定教育訓練講座の受講・修了"],"documents":["教育訓練給付金支給申請書","受講修了証明書","領収書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KYOUIKU-KUNREN', 1);

-- #235 高等職業訓練促進給付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOUTOU-KUNREN', '高等職業訓練促進給付金', 'CFA', 'こども家庭庁', '00', '["employment","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOUTOU-KUNREN', 'manual', '高等職業訓練促進給付金（ひとり親家庭向け）', 1400000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"ひとり親家庭の親が看護師・介護福祉士等の資格取得のために養成機関で修業する際の生活費を支給","target":"ひとり親家庭の母または父","amount":"市民税非課税世帯：月額14万円（最終年は月額18万円）、課税世帯：月額11万円（最終年は月額14万円）","period":"通年","application":"市区町村の窓口に申請","url":"https://www.cfa.go.jp/policies/hitori-oya/kunren-kyufu/","source":"こども家庭庁","requirements":["ひとり親家庭であること","養成機関での修業期間が6月以上","所得制限あり"],"documents":["申請書","在学証明書","所得証明書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOUTOU-KUNREN', 1);

-- #236 中小企業のための海外リスクマネジメント支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAIGAI-RISK', '海外リスクマネジメント支援（中小機構）', 'SMRJ', '中小企業基盤整備機構', '00', '["export","management"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAIGAI-RISK', 'manual', '中小機構 海外リスクマネジメント支援・海外展開支援', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の海外展開におけるリスク（知財侵害、取引紛争、カントリーリスク等）に対する支援","target":"海外展開を行う中小企業","amount":"相談：無料、海外展開アドバイザー派遣：無料、F/S支援等","period":"通年","application":"中小機構の地域事務所に相談","url":"https://www.smrj.go.jp/tool/supporter/overseas/","source":"中小企業基盤整備機構","requirements":["中小企業であること","海外展開の計画または実績"],"documents":["相談申込書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAIGAI-RISK', 1);

-- Phase 10 Part 6: 新規50件（#492〜#541）
-- カテゴリ: 港湾・海洋、鉄道・交通インフラ、食品加工、伝統工芸、
--           障害者就労B型追加、女性活躍推加、外国人材、再犯防止、
--           動物愛護、消費者保護、郵便局活用、空き家対策追加、スマートシティ

-- ====== 1. 港湾・海洋・水運 (6件) ======

-- #492 港湾施設改良事業補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOUWAN-SHISETSU', '港湾施設改良事業補助金', 'MLIT', '国土交通省', '00', '["subsidy","infrastructure"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOUWAN-SHISETSU', 'manual', '港湾施設改良事業補助金（岸壁・防波堤等の整備）', 500000000, '1/2〜2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"港湾施設（岸壁、防波堤、航路浚渫等）の改良・整備を支援し、物流効率化と防災機能強化を図る","target":"港湾管理者（地方自治体）","amount":"事業費の1/2〜2/3","period":"令和8年度","application":"国土交通省港湾局に申請","url":"https://www.mlit.go.jp/kowan/","source":"国土交通省","requirements":["港湾計画に基づく事業","費用対効果の確認","環境アセスメント"],"documents":["事業計画書","設計図書","費用便益分析","環境影響評価書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOUWAN-SHISETSU', 1);

-- #493 離島航路補助金（離島航路確保維持）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RITOU-KOURO', '離島航路補助金', 'MLIT', '国土交通省', '00', '["subsidy","transport","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RITOU-KOURO', 'manual', '離島航路補助金（離島航路確保維持事業）', 100000000, '欠損補助', '全国（離島地域）', '2026-04-01', '2027-03-31',
'{"overview":"離島住民の生活に不可欠な航路の維持・確保のため、航路運営事業者の欠損に対して補助","target":"離島航路事業者","amount":"航路運営欠損額の補助","period":"令和8年度","application":"国土交通省海事局に申請","url":"https://www.mlit.go.jp/maritime/maritime_tk1_000048.html","source":"国土交通省","requirements":["離島航路の運航実績","欠損額の算定","住民利用実態"],"documents":["航路運営収支報告書","利用実績資料","事業計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RITOU-KOURO', 1);

-- #494 内航海運暮らしの足確保対策事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NAIKOU-KAIUN', '内航海運暮らしの足確保対策事業', 'MLIT', '国土交通省', '00', '["subsidy","transport"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NAIKOU-KAIUN', 'manual', '内航海運暮らしの足確保対策事業（船舶代替建造等支援）', 200000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"内航海運の船舶老朽化対策として代替建造や省エネ船への転換を支援","target":"内航海運事業者","amount":"建造費の1/3以内","period":"令和8年度","application":"国土交通省海事局に申請","url":"https://www.mlit.go.jp/maritime/","source":"国土交通省","requirements":["老朽船の代替建造計画","省エネ性能の向上","安全運航計画"],"documents":["船舶建造計画書","省エネ効果試算書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NAIKOU-KAIUN', 1);

-- #495 海洋再生可能エネルギー発電設備整備促進区域支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YOUJOU-FURYOKU-KUIKI', '海洋再生可能エネルギー発電設備整備促進区域支援', 'METI', '経済産業省', '00', '["subsidy","energy","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YOUJOU-FURYOKU-KUIKI', 'manual', '海洋再生可能エネルギー発電設備整備促進区域支援事業', 1000000000, '定額', '全国（促進区域）', '2026-04-01', '2027-03-31',
'{"overview":"洋上風力発電の促進区域における基地港湾の整備や地域共生策を支援","target":"洋上風力発電事業者、地方自治体","amount":"基地港湾整備等への支援","period":"令和8年度","application":"経済産業省・国土交通省に申請","url":"https://www.meti.go.jp/policy/safety_security/industrial_safety/sangyo/offshore-wind/","source":"経済産業省","requirements":["促進区域における事業計画","地域共生策の実施","環境影響評価"],"documents":["事業計画書","地域共生計画","環境影響評価書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'YOUJOU-FURYOKU-KUIKI', 1);

-- #496 ブルーカーボン生態系保全事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BLUE-CARBON', 'ブルーカーボン生態系保全事業', 'MOE', '環境省', '00', '["subsidy","environment","ocean"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BLUE-CARBON', 'manual', 'ブルーカーボン生態系（藻場・干潟等）保全・再生事業', 50000000, '定額', '全国（沿岸域）', '2026-04-01', '2027-03-31',
'{"overview":"藻場・干潟・マングローブ等のブルーカーボン生態系の保全・再生を通じたCO2吸収源対策を支援","target":"地方自治体、NPO、漁業協同組合","amount":"定額（上限5,000万円）","period":"令和8年度","application":"環境省に申請","url":"https://www.env.go.jp/water/","source":"環境省","requirements":["ブルーカーボン生態系の保全・再生計画","CO2吸収量のモニタリング","地域関係者との連携"],"documents":["保全再生計画書","CO2吸収量試算書","地域連携計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BLUE-CARBON', 1);

-- #497 深海底鉱物資源開発推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHINKAI-KOUBUTSU', '深海底鉱物資源開発推進事業', 'JOGMEC', 'JOGMEC', '00', '["subsidy","resource","research"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHINKAI-KOUBUTSU', 'manual', '深海底鉱物資源開発推進事業（レアアース泥等）', 2000000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本のEEZ内の深海底に存在するレアアース泥等の鉱物資源の商業開発に向けた技術開発を支援","target":"資源開発企業、研究機関","amount":"数十億円規模","period":"令和8年度（複数年度事業）","application":"JOGMEC公募","url":"https://www.jogmec.go.jp/","source":"JOGMEC","requirements":["深海底資源の採掘技術開発","環境影響の低減技術","商業化に向けたロードマップ"],"documents":["技術開発計画書","環境配慮計画","コスト試算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHINKAI-KOUBUTSU', 1);

-- ====== 2. 鉄道・交通インフラ (5件) ======

-- #498 地域鉄道安全対策事業費補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-TETSUDOU', '地域鉄道安全対策事業費補助金', 'MLIT', '国土交通省', '00', '["subsidy","transport","safety"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-TETSUDOU', 'manual', '地域鉄道安全対策事業費補助金（踏切・設備改良）', 100000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域鉄道事業者の安全性向上に資する設備更新・踏切改良等を支援","target":"地域鉄道事業者","amount":"事業費の1/3以内","period":"令和8年度","application":"国土交通省鉄道局に申請","url":"https://www.mlit.go.jp/tetudo/","source":"国土交通省","requirements":["安全投資計画の策定","費用対効果の確認","地域公共交通計画との整合性"],"documents":["安全投資計画書","設備仕様書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-TETSUDOU', 1);

-- #499 バリアフリー環境整備促進事業（鉄道駅）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TETSUDOU-BARRIERFREE', 'バリアフリー環境整備促進事業（鉄道駅）', 'MLIT', '国土交通省', '00', '["subsidy","transport","welfare"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TETSUDOU-BARRIERFREE', 'manual', 'バリアフリー環境整備促進事業（鉄道駅エレベーター・ホームドア等）', 200000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"鉄道駅のバリアフリー化（エレベーター、ホームドア等）を支援","target":"鉄道事業者","amount":"事業費の1/3以内","period":"令和8年度","application":"国土交通省鉄道局に申請","url":"https://www.mlit.go.jp/tetudo/tetudo_fr1_000010.html","source":"国土交通省","requirements":["バリアフリー法に基づく整備計画","乗降客数基準の該当","地方自治体の協調補助"],"documents":["整備計画書","設計図書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TETSUDOU-BARRIERFREE', 1);

-- #500 MaaS推進事業補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MAAS-SUISHIN', 'MaaS推進事業補助金', 'MLIT', '国土交通省', '00', '["subsidy","transport","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MAAS-SUISHIN', 'manual', 'MaaS推進事業補助金（地域交通MaaS構築支援）', 50000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域公共交通のMaaS（Mobility as a Service）導入・構築を支援し、交通利便性の向上を図る","target":"地方自治体、交通事業者、IT事業者","amount":"上限5,000万円（補助率1/2）","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000121.html","source":"国土交通省","requirements":["MaaS導入計画の策定","複数交通モードの統合","利用者利便性の向上"],"documents":["MaaS導入計画書","システム仕様書","連携協定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MAAS-SUISHIN', 1);

-- #501 自動運転実証支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JIDOU-UNTEN-JISSHOU', '自動運転実証支援事業', 'MLIT', '国土交通省', '00', '["subsidy","transport","digital","research"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JIDOU-UNTEN-JISSHOU', 'manual', '自動運転実証支援事業（レベル4社会実装）', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"自動運転（レベル4）の社会実装に向けた地域での実証実験を支援","target":"自動運転サービス事業者、地方自治体","amount":"定額（上限1億円）","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/jidosha/jidosha_tk7_000053.html","source":"国土交通省","requirements":["レベル4自動運転の実証計画","安全管理体制","地域住民との合意形成"],"documents":["実証計画書","安全管理計画","リスク評価書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JIDOU-UNTEN-JISSHOU', 1);

-- #502 グリーンスローモビリティ導入支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GREEN-SLOW-MOBILITY', 'グリーンスローモビリティ導入支援', 'MLIT', '国土交通省', '00', '["subsidy","transport","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GREEN-SLOW-MOBILITY', 'manual', 'グリーンスローモビリティ導入支援（電動低速車両導入）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"高齢者の移動手段確保や観光地での移動支援として、グリーンスローモビリティ（時速20km未満の電動車両）の導入を支援","target":"地方自治体、交通事業者、観光事業者","amount":"車両購入費等の1/2","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/sogoseisaku/environment/","source":"国土交通省","requirements":["運行計画の策定","安全管理体制","利用者ニーズの把握"],"documents":["導入計画書","運行計画書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GREEN-SLOW-MOBILITY', 1);

-- ====== 3. 食品加工・フードテック (5件) ======

-- #503 フードテック官民協議会推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FOODTECH-SUISHIN', 'フードテック官民協議会推進事業', 'MAFF', '農林水産省', '00', '["subsidy","food","research"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FOODTECH-SUISHIN', 'manual', 'フードテック官民協議会推進事業（代替タンパク・培養肉等）', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"代替タンパク質（植物由来肉、培養肉等）やフードテックの社会実装に向けた研究開発を支援","target":"食品メーカー、研究機関、スタートアップ","amount":"定額","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/shokusan/sanki/foodtech.html","source":"農林水産省","requirements":["フードテック技術の実用化計画","食品安全性の担保","市場投入戦略"],"documents":["研究開発計画書","食品安全性評価書","事業化計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FOODTECH-SUISHIN', 1);

-- #504 食品ロス削減推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FOOD-LOSS-SAKUGEN', '食品ロス削減推進事業', 'CAA', '消費者庁', '00', '["subsidy","food","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FOOD-LOSS-SAKUGEN', 'manual', '食品ロス削減推進事業（サプライチェーン全体の食品ロス対策）', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"サプライチェーン全体における食品ロス削減の取り組みを支援（フードバンク、未利用食品活用等）","target":"食品事業者、フードバンク団体、地方自治体","amount":"定額（上限3,000万円）","period":"令和8年度","application":"消費者庁に申請","url":"https://www.caa.go.jp/policies/policy/consumer_policy/information/food_loss/","source":"消費者庁","requirements":["食品ロス削減計画","効果測定の仕組み","地域連携体制"],"documents":["事業計画書","食品ロス削減効果試算書","連携体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'FOOD-LOSS-SAKUGEN', 1);

-- #505 HACCP導入支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HACCP-DOUNYUU', 'HACCP導入支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","food","safety"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HACCP-DOUNYUU', 'manual', 'HACCP導入支援事業（食品衛生管理体制構築支援）', 5000000, '2/3', '全国', '2026-04-01', '2026-12-31',
'{"overview":"中小食品事業者のHACCP（衛生管理手法）導入を支援し、食品安全性の向上を図る","target":"中小食品製造業者、飲食店","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000130381.html","source":"厚生労働省","requirements":["HACCP導入計画の策定","衛生管理者の配置","従業員教育計画"],"documents":["HACCP導入計画書","衛生管理マニュアル","研修計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HACCP-DOUNYUU', 1);

-- #506 地理的表示（GI）保護制度活用支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GI-HOGO-SHIEN', '地理的表示（GI）保護制度活用支援', 'MAFF', '農林水産省', '00', '["subsidy","food","branding"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GI-HOGO-SHIEN', 'manual', '地理的表示（GI）保護制度活用支援事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域の伝統的な農林水産物・食品のGI（地理的表示）登録と品質管理体制の構築を支援","target":"生産者団体、農業協同組合","amount":"定額（上限1,000万円）","period":"令和8年度","application":"農林水産省に申請","url":"https://www.maff.go.jp/j/shokusan/gi_act/","source":"農林水産省","requirements":["GI登録申請の準備","品質基準の策定","管理団体の設立"],"documents":["GI登録申請書類","品質管理基準書","生産工程管理計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GI-HOGO-SHIEN', 1);

-- #507 農商工連携促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NOUSHOUKOU-RENKEI', '農商工連携促進事業', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","business"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NOUSHOUKOU-RENKEI', 'manual', '農商工連携促進事業（農林漁業者と商工業者の連携支援）', 30000000, '2/3', '全国', '2026-04-01', '2026-12-31',
'{"overview":"農林漁業者と商工業者が連携して新商品・新サービスを開発する取り組みを支援","target":"農林漁業者と中小企業者の連携体","amount":"上限3,000万円（補助率2/3）","period":"令和8年度","application":"農林水産省・経済産業省に申請","url":"https://www.maff.go.jp/j/shokusan/sanki/nosyoko.html","source":"農林水産省","requirements":["農商工連携事業計画の認定","新商品・新サービスの開発","3年以内の事業化目標"],"documents":["農商工連携事業計画書","連携協定書","販路開拓計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NOUSHOUKOU-RENKEI', 1);

-- ====== 4. 伝統工芸・文化財 (5件) ======

-- #508 伝統的工芸品産業振興補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DENTOU-KOUGEI-SHINKOU', '伝統的工芸品産業振興補助金', 'METI', '経済産業省', '00', '["subsidy","culture","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DENTOU-KOUGEI-SHINKOU', 'manual', '伝統的工芸品産業振興補助金（後継者育成・需要開拓）', 20000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"伝統的工芸品（経済産業大臣指定）の産業振興、後継者育成、需要開拓を支援","target":"伝統的工芸品産地組合、産地事業者","amount":"上限2,000万円（補助率2/3）","period":"令和8年度","application":"経済産業省に申請","url":"https://www.meti.go.jp/policy/mono_info_service/mono/nichiyo-densan/","source":"経済産業省","requirements":["経済産業大臣指定の伝統的工芸品","産地振興計画","後継者育成計画"],"documents":["産業振興計画書","後継者育成計画","販路開拓計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DENTOU-KOUGEI-SHINKOU', 1);

-- #509 文化財保存修理事業費補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUNKAZAI-HOZON', '文化財保存修理事業費補助金', 'BUNKACHO', '文化庁', '00', '["subsidy","culture","heritage"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUNKAZAI-HOZON', 'manual', '文化財保存修理事業費補助金（国宝・重要文化財等の修理）', 500000000, '50%〜85%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"国宝・重要文化財等の建造物・美術工芸品の保存修理を支援","target":"文化財所有者・管理者","amount":"修理費の50%〜85%","period":"令和8年度","application":"文化庁に申請（都道府県教育委員会経由）","url":"https://www.bunka.go.jp/seisaku/bunkazai/","source":"文化庁","requirements":["国・都道府県指定の文化財","保存修理計画の策定","専門技術者の確保"],"documents":["保存修理計画書","設計図書","見積書","写真記録"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUNKAZAI-HOZON', 1);

-- #510 日本遺産活性化事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NIHON-ISAN-KASSEI', '日本遺産活性化事業', 'BUNKACHO', '文化庁', '00', '["subsidy","culture","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NIHON-ISAN-KASSEI', 'manual', '日本遺産活性化事業（日本遺産認定地域の活用推進）', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本遺産認定地域のストーリーを活用した観光・地域活性化を支援","target":"日本遺産認定地域の自治体・協議会","amount":"定額（上限2,000万円）","period":"令和8年度","application":"文化庁に申請","url":"https://japan-heritage.bunka.go.jp/","source":"文化庁","requirements":["日本遺産認定地域","地域活性化計画","観光コンテンツの開発"],"documents":["活性化計画書","観光コンテンツ企画書","地域連携計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NIHON-ISAN-KASSEI', 1);

-- #511 無形文化遺産保護推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MUKEI-BUNKA-HOGO', '無形文化遺産保護推進事業', 'BUNKACHO', '文化庁', '00', '["subsidy","culture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MUKEI-BUNKA-HOGO', 'manual', '無形文化遺産保護推進事業（伝統芸能・祭り等の伝承支援）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"無形文化遺産（伝統芸能、祭り、工芸技術等）の保護・伝承を支援","target":"無形文化財の保持者・保存団体","amount":"定額（上限1,000万円）","period":"令和8年度","application":"文化庁に申請","url":"https://www.bunka.go.jp/seisaku/bunkazai/shokai/mukei/","source":"文化庁","requirements":["国指定または登録の無形文化財","伝承計画の策定","後継者育成の取り組み"],"documents":["伝承計画書","後継者育成計画","活動記録"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MUKEI-BUNKA-HOGO', 1);

-- #512 アイヌ文化振興等推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('AINU-BUNKA-SHINKOU', 'アイヌ文化振興等推進事業', 'MLIT', '国土交通省', '01', '["subsidy","culture","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('AINU-BUNKA-SHINKOU', 'manual', 'アイヌ文化振興等推進事業（アイヌの伝統文化・言語の振興）', 30000000, '定額', '北海道', '2026-04-01', '2027-03-31',
'{"overview":"アイヌの伝統文化・言語の振興および理解促進を図る事業を支援","target":"アイヌ関連団体、地方自治体","amount":"定額","period":"令和8年度","application":"国土交通省（アイヌ総合政策室）に申請","url":"https://www.mlit.go.jp/common/001370111.pdf","source":"国土交通省","requirements":["アイヌ文化の振興に資する事業","地域連携体制","持続可能な取り組み"],"documents":["事業計画書","予算書","実施体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'AINU-BUNKA-SHINKOU', 1);

-- ====== 5. 女性活躍・ダイバーシティ (5件) ======

-- #513 女性活躍推進法に基づく認定取得支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JOSEI-KATSUYAKU-NINTEI', '女性活躍推進法に基づく認定取得支援', 'MHLW', '厚生労働省', '00', '["subsidy","employment","diversity"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JOSEI-KATSUYAKU-NINTEI', 'manual', '女性活躍推進法に基づく認定（えるぼし・プラチナえるぼし）取得支援', 500000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"女性活躍推進法に基づく認定（えるぼし、プラチナえるぼし）の取得を目指す企業を支援","target":"中小企業","amount":"定額（上限50万円）","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000091025.html","source":"厚生労働省","requirements":["一般事業主行動計画の策定","女性採用・管理職比率の目標設定","ワークライフバランスの推進"],"documents":["行動計画書","女性活躍状況報告書","取組計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JOSEI-KATSUYAKU-NINTEI', 1);

-- #514 くるみん認定取得支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KURUMIN-SHIEN', 'くるみん認定取得支援補助金', 'MHLW', '厚生労働省', '00', '["subsidy","employment","childcare"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KURUMIN-SHIEN', 'manual', 'くるみん認定取得支援補助金（子育てサポート企業認定）', 500000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"くるみん・プラチナくるみん・トライくるみん認定の取得を目指す企業を支援","target":"中小企業","amount":"定額（上限50万円）","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/kurumin/","source":"厚生労働省","requirements":["次世代育成支援対策推進法に基づく行動計画","男性育休取得率の向上","所定外労働の削減"],"documents":["行動計画書","育休取得実績","取組報告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KURUMIN-SHIEN', 1);

-- #515 外国人材受入れ環境整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GAIKOKUJIN-KANKYOU', '外国人材受入れ環境整備事業', 'MOJ', '法務省', '00', '["subsidy","employment","international"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GAIKOKUJIN-KANKYOU', 'manual', '外国人材受入れ環境整備事業（多文化共生・生活支援）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"外国人材の受入れ環境整備（多言語対応、生活支援、日本語教育等）を支援","target":"地方自治体、国際交流協会","amount":"定額（上限5,000万円）","period":"令和8年度","application":"法務省出入国在留管理庁に申請","url":"https://www.moj.go.jp/isa/policies/coexistence/index.html","source":"法務省","requirements":["多文化共生推進計画の策定","ワンストップ相談窓口の設置","日本語教育体制の整備"],"documents":["多文化共生推進計画","相談窓口設置計画","日本語教育計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GAIKOKUJIN-KANKYOU', 1);

-- #516 ユースエール認定取得支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YOUTH-YELL-SHIEN', 'ユースエール認定取得支援', 'MHLW', '厚生労働省', '00', '["subsidy","employment","youth"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YOUTH-YELL-SHIEN', 'manual', 'ユースエール認定取得支援（若者雇用促進法に基づく認定）', 300000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"若者雇用促進法に基づくユースエール認定の取得を目指す中小企業を支援","target":"中小企業（常時雇用300人以下）","amount":"定額（上限30万円）","period":"令和8年度","application":"ハローワークに申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000100266.html","source":"厚生労働省","requirements":["離職率が20%以下","有給休暇取得率が平均70%以上","時間外労働が月平均20時間以下"],"documents":["認定申請書","雇用管理状況報告書","労働条件通知書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'YOUTH-YELL-SHIEN', 1);

-- #517 障害者テレワーク推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUGAI-TELEWORK', '障害者テレワーク推進事業', 'MHLW', '厚生労働省', '00', '["subsidy","employment","disability","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUGAI-TELEWORK', 'manual', '障害者テレワーク推進事業（在宅就労環境整備支援）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"障害者のテレワーク（在宅就労）環境の整備と企業の受入れ体制構築を支援","target":"障害者雇用を行う企業","amount":"定額（上限1,000万円）","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/shougaishakoyou/","source":"厚生労働省","requirements":["障害者のテレワーク導入計画","ICT環境の整備","支援体制の構築"],"documents":["テレワーク導入計画書","ICT環境整備計画","支援体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUGAI-TELEWORK', 1);

-- ====== 6. 消費者保護・再犯防止・動物愛護 (5件) ======

-- #518 消費者教育推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUHISHA-KYOUIKU', '消費者教育推進事業', 'CAA', '消費者庁', '00', '["subsidy","education","consumer"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUHISHA-KYOUIKU', 'manual', '消費者教育推進事業（高齢者・若年者の消費者被害防止）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"高齢者・若年者等の消費者被害防止のための消費者教育を推進する事業を支援","target":"地方自治体、消費者団体、NPO","amount":"定額（上限1,000万円）","period":"令和8年度","application":"消費者庁に申請","url":"https://www.caa.go.jp/policies/policy/consumer_education/","source":"消費者庁","requirements":["消費者教育推進計画との整合性","対象者へのリーチ","効果測定の仕組み"],"documents":["事業計画書","教材・カリキュラム","効果測定計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUHISHA-KYOUIKU', 1);

-- #519 再犯防止推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAIHAN-BOUSHI', '再犯防止推進事業', 'MOJ', '法務省', '00', '["subsidy","welfare","justice"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAIHAN-BOUSHI', 'manual', '再犯防止推進事業（就労支援・住居確保等）', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"刑事施設出所者等の社会復帰を促進し再犯を防止するための就労支援・住居確保等の事業を支援","target":"地方自治体、更生保護法人、NPO","amount":"定額（上限3,000万円）","period":"令和8年度","application":"法務省に申請","url":"https://www.moj.go.jp/hisho/seisakuhyouka/hisho04_00059.html","source":"法務省","requirements":["再犯防止推進計画との整合性","就労支援・住居確保の取り組み","地域関係機関との連携"],"documents":["事業計画書","連携体制図","実績報告様式"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAIHAN-BOUSHI', 1);

-- #520 動物愛護管理推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DOUBUTSU-AIGO', '動物愛護管理推進事業', 'MOE', '環境省', '00', '["subsidy","animal","welfare"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DOUBUTSU-AIGO', 'manual', '動物愛護管理推進事業（譲渡推進・収容施設整備）', 20000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"動物愛護管理の推進（殺処分削減、譲渡推進、収容施設の機能向上等）を支援","target":"地方自治体、動物愛護団体","amount":"事業費の1/2（上限2,000万円）","period":"令和8年度","application":"環境省に申請","url":"https://www.env.go.jp/nature/dobutsu/aigo/","source":"環境省","requirements":["動物愛護管理推進計画","譲渡率向上の取り組み","マイクロチップ装着の推進"],"documents":["事業計画書","収容・譲渡実績","施設整備計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DOUBUTSU-AIGO', 1);

-- #521 成年後見制度利用促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SEINEN-KOUKEN', '成年後見制度利用促進事業', 'MHLW', '厚生労働省', '00', '["subsidy","welfare","legal"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SEINEN-KOUKEN', 'manual', '成年後見制度利用促進事業（中核機関設置・市民後見人育成）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"成年後見制度の利用促進のため、中核機関の設置、市民後見人の育成等を支援","target":"地方自治体","amount":"定額（上限1,000万円）","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000202622.html","source":"厚生労働省","requirements":["成年後見制度利用促進基本計画の策定","中核機関の設置","市民後見人の育成研修"],"documents":["利用促進計画書","中核機関設置計画","研修カリキュラム"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SEINEN-KOUKEN', 1);

-- #522 生活困窮者自立支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SEIKATSU-KONKYUU-JIRITSU', '生活困窮者自立支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","welfare"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SEIKATSU-KONKYUU-JIRITSU', 'manual', '生活困窮者自立支援事業（相談・就労準備・家計改善等）', 50000000, '3/4', '全国', '2026-04-01', '2027-03-31',
'{"overview":"生活困窮者の自立促進のため、自立相談支援、就労準備支援、家計改善支援等を実施","target":"地方自治体（福祉事務所設置自治体）","amount":"事業費の3/4","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000059425.html","source":"厚生労働省","requirements":["自立相談支援事業の実施","就労準備支援事業","家計改善支援事業"],"documents":["事業計画書","支援実績報告","連携体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SEIKATSU-KONKYUU-JIRITSU', 1);

-- ====== 7. スマートシティ・デジタル田園 (5件) ======

-- #523 スマートシティ実装化支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SMARTCITY-JISSOUKA', 'スマートシティ実装化支援事業', 'MLIT', '国土交通省', '00', '["subsidy","digital","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SMARTCITY-JISSOUKA', 'manual', 'スマートシティ実装化支援事業（都市OS・データ連携基盤）', 100000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"スマートシティの実装化に向けた都市OS（データ連携基盤）の構築やサービス実装を支援","target":"地方自治体、スマートシティ推進協議会","amount":"上限1億円（補助率1/2）","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/toshi/tosiko/toshi_tosiko_tk_000040.html","source":"国土交通省","requirements":["スマートシティ推進計画の策定","都市OSの導入","官民連携体制"],"documents":["実装化計画書","システム仕様書","官民連携協定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SMARTCITY-JISSOUKA', 1);

-- #524 デジタル田園都市国家構想推進交付金（地方創生テレワーク型）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('DIGITAL-DENEN-TELEWORK', 'デジタル田園都市国家構想推進交付金（テレワーク型）', 'CAS', '内閣府', '00', '["subsidy","digital","regional","telework"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('DIGITAL-DENEN-TELEWORK', 'manual', 'デジタル田園都市国家構想推進交付金（地方創生テレワーク型）', 100000000, '1/2〜3/4', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方でのテレワーク環境整備（サテライトオフィス、コワーキングスペース等）を支援","target":"地方自治体","amount":"事業費の1/2〜3/4","period":"令和8年度","application":"内閣府に申請","url":"https://www.chisou.go.jp/sousei/about/digital-denen/index.html","source":"内閣府","requirements":["テレワーク拠点整備計画","企業誘致計画","移住促進策"],"documents":["交付金申請書","テレワーク拠点整備計画","KPI設定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'DIGITAL-DENEN-TELEWORK', 1);

-- #525 3D都市モデル（PLATEAU）活用促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('PLATEAU-3D', '3D都市モデル（PLATEAU）活用促進事業', 'MLIT', '国土交通省', '00', '["subsidy","digital","urban"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('PLATEAU-3D', 'manual', '3D都市モデル（PLATEAU）活用促進事業（デジタルツイン）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"3D都市モデル（PLATEAU）を活用したまちづくりDX・防災・都市計画のユースケース開発を支援","target":"地方自治体、民間事業者","amount":"定額（上限5,000万円）","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/plateau/","source":"国土交通省","requirements":["3D都市モデルの整備・活用計画","ユースケースの開発","オープンデータ化"],"documents":["活用計画書","ユースケース企画書","システム仕様書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'PLATEAU-3D', 1);

-- #526 地域IoT実装推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-IOT-JISSOU', '地域IoT実装推進事業', 'MIC', '総務省', '00', '["subsidy","digital","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-IOT-JISSOU', 'manual', '地域IoT実装推進事業（農業IoT・見守り・防災等）', 30000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域課題解決に向けたIoT（農業IoT、見守りサービス、防災センサー等）の導入・実装を支援","target":"地方自治体、地域協議会","amount":"上限3,000万円（補助率1/2）","period":"令和8年度","application":"総務省に申請","url":"https://www.soumu.go.jp/main_sosiki/joho_tsusin/top/local_support/ict/","source":"総務省","requirements":["地域IoT実装計画の策定","地域課題の明確化","持続可能な運営体制"],"documents":["実装計画書","IoTシステム仕様書","運営計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-IOT-JISSOU', 1);

-- #527 マイナンバーカード利活用推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MYNUMBER-RIKATSUYOU', 'マイナンバーカード利活用推進事業', 'DIGITAL', 'デジタル庁', '00', '["subsidy","digital","government"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MYNUMBER-RIKATSUYOU', 'manual', 'マイナンバーカード利活用推進事業（公的個人認証基盤）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"マイナンバーカードの利活用促進（オンライン本人確認、市民カード等）を支援","target":"地方自治体、民間事業者","amount":"定額（上限5,000万円）","period":"令和8年度","application":"デジタル庁に申請","url":"https://www.digital.go.jp/policies/mynumber","source":"デジタル庁","requirements":["マイナンバーカード利活用計画","セキュリティ対策","利用者保護"],"documents":["利活用計画書","セキュリティ対策書","システム仕様書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'MYNUMBER-RIKATSUYOU', 1);

-- ====== 8. 空き家・住宅・建築 (5件) ======

-- #528 空き家対策総合支援事業（解体・除却）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('AKIYA-KAITAI', '空き家対策総合支援事業（解体・除却）', 'MLIT', '国土交通省', '00', '["subsidy","housing","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('AKIYA-KAITAI', 'manual', '空き家対策総合支援事業（特定空き家の解体・除却等）', 50000000, '2/5', '全国', '2026-04-01', '2027-03-31',
'{"overview":"特定空き家等の解体・除却、空き家の利活用に向けた総合的な対策を支援","target":"地方自治体","amount":"事業費の2/5","period":"令和8年度","application":"国土交通省に申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000035.html","source":"国土交通省","requirements":["空家等対策計画の策定","特定空き家等への措置","利活用促進策"],"documents":["空き家対策計画書","実施計画書","費用算定書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'AKIYA-KAITAI', 1);

-- #529 住宅・建築物安全ストック形成事業（耐震化）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JUTAKU-TAISHIN-STOCK', '住宅・建築物安全ストック形成事業', 'MLIT', '国土交通省', '00', '["subsidy","housing","safety"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JUTAKU-TAISHIN-STOCK', 'manual', '住宅・建築物安全ストック形成事業（既存住宅の耐震化促進）', 100000000, '23%', '全国', '2026-04-01', '2027-03-31',
'{"overview":"既存住宅・建築物の耐震診断・耐震改修を支援し、地震に対する安全性の向上を図る","target":"地方自治体（住宅所有者への間接補助）","amount":"耐震改修費の23%等","period":"令和8年度","application":"地方自治体経由で国土交通省に申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr_000043.html","source":"国土交通省","requirements":["耐震改修促進計画の策定","耐震診断の実施","耐震基準適合の確認"],"documents":["耐震診断結果","改修設計図","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JUTAKU-TAISHIN-STOCK', 1);

-- #530 長期優良住宅化リフォーム推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHOUKI-YURYOU-REFORM', '長期優良住宅化リフォーム推進事業', 'MLIT', '国土交通省', '00', '["subsidy","housing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHOUKI-YURYOU-REFORM', 'manual', '長期優良住宅化リフォーム推進事業（性能向上リフォーム）', 3000000, '1/3', '全国', '2026-04-01', '2026-12-31',
'{"overview":"既存住宅の長寿命化・性能向上リフォーム（断熱、耐震、バリアフリー等）を支援","target":"住宅所有者（リフォーム事業者経由）","amount":"上限100〜300万円（補助率1/3）","period":"令和8年度","application":"国の補助事業者に申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk4_000153.html","source":"国土交通省","requirements":["インスペクションの実施","性能向上計画の策定","リフォーム履歴の保存"],"documents":["インスペクション結果","リフォーム計画書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHOUKI-YURYOU-REFORM', 1);

-- #531 サービス付き高齢者向け住宅整備事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAKOUJU-SEIBI', 'サービス付き高齢者向け住宅整備事業', 'MLIT', '国土交通省', '00', '["subsidy","housing","elderly"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAKOUJU-SEIBI', 'manual', 'サービス付き高齢者向け住宅整備事業（サ高住の建設・改修）', 1350000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"サービス付き高齢者向け住宅（サ高住）の新築・改修整備を支援し、高齢者の安心居住を確保","target":"サ高住事業者","amount":"新築135万円/戸、改修35万円/戸","period":"令和8年度","application":"サービス付き高齢者向け住宅情報提供システムで申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000005.html","source":"国土交通省","requirements":["サ高住登録基準の適合","バリアフリー構造","安否確認・生活相談サービス"],"documents":["登録申請書","設計図書","事業計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAKOUJU-SEIBI', 1);

-- #532 住宅セーフティネット制度活用支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JUTAKU-SAFETYNET', '住宅セーフティネット制度活用支援', 'MLIT', '国土交通省', '00', '["subsidy","housing","welfare"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JUTAKU-SAFETYNET', 'manual', '住宅セーフティネット制度活用支援（住宅確保要配慮者向け）', 500000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"低額所得者、高齢者、障害者等の住宅確保要配慮者向け賃貸住宅の登録・改修を支援","target":"賃貸住宅の大家、不動産事業者","amount":"改修費の1/3（上限50万円/戸）","period":"令和8年度","application":"国の補助事業者に申請","url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000055.html","source":"国土交通省","requirements":["セーフティネット住宅の登録","バリアフリー改修等","入居拒否しない住宅"],"documents":["登録申請書","改修計画書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JUTAKU-SAFETYNET', 1);

-- ====== 9. 国際協力・ODA・JICA (4件) ======

-- #533 JICA中小企業海外展開支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JICA-SME-KAIGAI', 'JICA中小企業海外展開支援事業', 'JICA', 'JICA', '00', '["subsidy","international","business"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JICA-SME-KAIGAI', 'manual', 'JICA中小企業海外展開支援事業（途上国ビジネス展開）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の製品・技術を途上国の開発課題解決に活用するビジネス展開を支援","target":"中小企業","amount":"調査費等定額（上限5,000万円）","period":"令和8年度","application":"JICA公募","url":"https://www.jica.go.jp/priv_partner/activities/sme/","source":"JICA","requirements":["途上国の開発課題への貢献","製品・技術の優位性","事業化計画"],"documents":["提案書","事業計画書","財務諸表"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JICA-SME-KAIGAI', 1);

-- #534 草の根技術協力事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KUSANONE-GIJUTSU', '草の根技術協力事業', 'JICA', 'JICA', '00', '["subsidy","international","ngo"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KUSANONE-GIJUTSU', 'manual', '草の根技術協力事業（NGO・地方自治体による国際協力）', 30000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"NGO、大学、地方自治体等が途上国で行う技術協力プロジェクトをJICAが支援","target":"NGO、大学、地方自治体、公益法人","amount":"定額（上限3,000万円程度）","period":"1〜5年","application":"JICA公募","url":"https://www.jica.go.jp/partner/kusanone/index.html","source":"JICA","requirements":["途上国の開発課題への貢献","技術移転計画","現地パートナーとの連携"],"documents":["企画書","実施計画書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KUSANONE-GIJUTSU', 1);

-- #535 ODA技術協力プロジェクト（民間連携）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ODA-MINKAN-RENKEI', 'ODA技術協力プロジェクト（民間連携）', 'MOFA', '外務省', '00', '["subsidy","international","business"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ODA-MINKAN-RENKEI', 'manual', 'ODA技術協力プロジェクト（民間連携・SDGs達成への貢献）', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"ODAによる技術協力と民間企業のビジネス展開を連携させ、途上国のSDGs達成に貢献","target":"民間企業","amount":"プロジェクト規模に応じた定額","period":"令和8年度","application":"外務省・JICA公募","url":"https://www.mofa.go.jp/mofaj/gaiko/oda/","source":"外務省","requirements":["途上国のSDGs達成への貢献","官民連携スキーム","持続可能な事業モデル"],"documents":["プロジェクト企画書","事業計画書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ODA-MINKAN-RENKEI', 1);

-- #536 日本NGO連携無償資金協力
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NGO-RENKEI-MUSHOU', '日本NGO連携無償資金協力', 'MOFA', '外務省', '00', '["subsidy","international","ngo"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NGO-RENKEI-MUSHOU', 'manual', '日本NGO連携無償資金協力（途上国の人道支援・開発協力）', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本のNGOが途上国で実施する人道・開発協力事業への資金協力","target":"日本のNGO（法人格を有する団体）","amount":"プロジェクト規模に応じた定額（上限1億円程度）","period":"令和8年度","application":"外務省に申請","url":"https://www.mofa.go.jp/mofaj/gaiko/oda/shimin/ngo/","source":"外務省","requirements":["途上国での実施実績","現地ニーズとの整合性","事業の持続可能性"],"documents":["事業申請書","事業計画書","予算計画書","団体概要"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NGO-RENKEI-MUSHOU', 1);

-- ====== 10. スポーツ・健康・レクリエーション (5件) ======

-- #537 スポーツ施設整備助成（toto助成）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOTO-SHISETSU-SEIBI', 'スポーツ施設整備助成（toto助成）', 'JSC', 'JSC', '00', '["subsidy","sports","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOTO-SHISETSU-SEIBI', 'manual', 'スポーツ施設整備助成（totoスポーツ振興くじ助成金）', 300000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域のスポーツ施設の整備・改修をスポーツ振興くじ（toto）の収益から助成","target":"地方自治体、スポーツ団体","amount":"施設整備費に応じた定額助成","period":"令和8年度","application":"日本スポーツ振興センター（JSC）に申請","url":"https://www.jpnsport.go.jp/sinko/","source":"JSC","requirements":["スポーツ施設整備計画","地域スポーツ振興計画との整合性","施設の一般開放"],"documents":["施設整備計画書","設計図書","事業費内訳書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOTO-SHISETSU-SEIBI', 1);

-- #538 健康増進事業（特定保健指導）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KENKOU-ZOUSHIN-TOKUTEI', '健康増進事業（特定保健指導）', 'MHLW', '厚生労働省', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KENKOU-ZOUSHIN-TOKUTEI', 'manual', '健康増進事業（特定健康診査・特定保健指導の充実）', 30000000, '1/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"特定健康診査・特定保健指導の実施率向上に向けた取り組みを支援","target":"市町村、保険者（国民健康保険等）","amount":"事業費の1/3","period":"令和8年度","application":"厚生労働省に申請","url":"https://www.mhlw.go.jp/bunya/shakaihosho/iryouseido01/info02a.html","source":"厚生労働省","requirements":["特定健診・保健指導実施計画","実施率向上策","データヘルス計画"],"documents":["実施計画書","データヘルス計画書","実績報告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KENKOU-ZOUSHIN-TOKUTEI', 1);

-- #539 地域スポーツコミッション活動支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SPORTS-COMMISSION', '地域スポーツコミッション活動支援', 'MEXT', 'スポーツ庁', '00', '["subsidy","sports","regional","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SPORTS-COMMISSION', 'manual', '地域スポーツコミッション活動支援（スポーツツーリズム推進）', 15000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域スポーツコミッションの活動（スポーツツーリズム、合宿誘致、大会開催等）を支援","target":"地域スポーツコミッション","amount":"定額（上限1,500万円）","period":"令和8年度","application":"スポーツ庁に申請","url":"https://www.mext.go.jp/sports/b_menu/sports/mcatetop09/list/1371916.htm","source":"スポーツ庁","requirements":["スポーツコミッションの設立","スポーツツーリズム推進計画","地域連携体制"],"documents":["活動計画書","スポーツツーリズム推進計画","連携体制図"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SPORTS-COMMISSION', 1);

-- #540 障害者スポーツ推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHOUGAI-SPORTS-SUISHIN', '障害者スポーツ推進事業', 'MEXT', 'スポーツ庁', '00', '["subsidy","sports","disability"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHOUGAI-SPORTS-SUISHIN', 'manual', '障害者スポーツ推進事業（パラスポーツの裾野拡大）', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"障害者スポーツ（パラスポーツ）の裾野拡大、指導者育成、大会支援等を推進","target":"地方自治体、障害者スポーツ団体","amount":"定額（上限2,000万円）","period":"令和8年度","application":"スポーツ庁に申請","url":"https://www.mext.go.jp/sports/b_menu/sports/mcatetop06/list/1371915.htm","source":"スポーツ庁","requirements":["パラスポーツの普及計画","指導者育成プログラム","施設のバリアフリー化"],"documents":["事業計画書","指導者育成計画","施設改修計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHOUGAI-SPORTS-SUISHIN', 1);

-- #541 運動・スポーツ習慣化促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('UNDOU-SHUUKANKA', '運動・スポーツ習慣化促進事業', 'MEXT', 'スポーツ庁', '00', '["subsidy","sports","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('UNDOU-SHUUKANKA', 'manual', '運動・スポーツ習慣化促進事業（Sport in Life推進）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"国民の運動・スポーツ習慣化を促進する取り組み（Sport in Lifeプロジェクト）を支援","target":"地方自治体、スポーツ関連団体、企業","amount":"定額（上限1,000万円）","period":"令和8年度","application":"スポーツ庁に申請","url":"https://sportinlife.go.jp/","source":"スポーツ庁","requirements":["運動・スポーツ習慣化プログラム","効果測定の仕組み","持続可能な取り組み"],"documents":["事業計画書","プログラム設計書","効果測定計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'UNDOU-SHUUKANKA', 1);

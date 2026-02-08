-- Phase 8 Part 2: Subsidies 51-100 (canonical + cache)
-- Categories: 農水省系、国交省系、環境省系、総務省系、文科省系、その他重要制度

-- ============================================================
-- 51. 農業次世代人材投資資金（経営開始型）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('NOGYOU-JISEDAI', '農業次世代人材投資資金（新規就農者育成総合対策）', 'MAFF', '農林水産省', 'agriculture', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('NOGYOU-JISEDAI', 'manual', '新規就農者育成総合対策（経営開始資金）', 'NOGYOU-JISEDAI', 90, 1500000, '定額', '農業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"新規就農者育成総合対策（経営開始資金）","category":"農業・新規就農","issuer":"農林水産省","summary":"新規就農者の経営確立を支援するため、経営開始直後の農業者に資金を交付","max_amount":"年間150万円×最長3年間","target":"独立・自営就農した認定新規就農者（50歳未満）","requirements":["認定新規就農者であること","独立・自営就農","前年の世帯所得が600万円以下"],"application_period":"市町村による","url":"https://www.maff.go.jp/j/new_farmer/","contact":"最寄りの市町村農政担当課"}'));

-- ============================================================
-- 52. 強い農業づくり総合支援交付金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TSUYOI-NOGYOU', '強い農業づくり総合支援交付金', 'MAFF', '農林水産省', 'agriculture', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TSUYOI-NOGYOU', 'manual', '強い農業づくり総合支援交付金', 'TSUYOI-NOGYOU', 90, 0, '1/2', '農業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"強い農業づくり総合支援交付金","category":"農業基盤強化","issuer":"農林水産省","summary":"産地の収益力強化や担い手への農地集積・集約化のための共同利用施設の整備等を支援","subsidy_rate":"1/2","target":"農業者団体、農協、市町村等","requirements":["産地計画の策定","成果目標の設定"],"application_period":"都道府県による","url":"https://www.maff.go.jp/j/seisan/suisin/tuyoi_nogyou/","contact":"農林水産省生産局"}'));

-- ============================================================
-- 53. 農業経営基盤強化資金（スーパーL資金）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SUPER-L-SHIKIN', '農業経営基盤強化資金（スーパーL資金）', 'MAFF', '農林水産省', 'agriculture,finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SUPER-L-SHIKIN', 'manual', '農業経営基盤強化資金（スーパーL資金）', 'SUPER-L-SHIKIN', 90, 300000000, '低金利融資', '農業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"農業経営基盤強化資金（スーパーL資金）","category":"農業融資","issuer":"日本政策金融公庫（農林水産省）","summary":"認定農業者が経営改善のために必要な資金を長期低利で融資","max_amount":"個人3億円、法人10億円","interest_rate":"0.16%～0.30%程度（令和7年度）","target":"認定農業者","requirements":["認定農業者であること","経営改善計画"],"application_period":"通年","url":"https://www.jfc.go.jp/n/finance/search/norin_m.html","contact":"日本政策金融公庫各支店"}'));

-- ============================================================
-- 54. 事業復活支援金（後継制度：中小企業活性化パッケージ）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KEIEI-KAIZEN-KEIKAKU', '経営改善計画策定支援（405事業）', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KEIEI-KAIZEN-KEIKAKU', 'manual', '経営改善計画策定支援（405事業）', 'KEIEI-KAIZEN-KEIKAKU', 90, 3000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"経営改善計画策定支援（405事業）","category":"経営改善","issuer":"中小企業庁","summary":"認定経営革新等支援機関の支援を受けて経営改善計画を策定する際の費用を補助","max_amount":"300万円（伴走支援含む場合は合計300万円）","subsidy_rate":"2/3","target":"借入金の返済負担等の財務上の問題を抱える中小企業","requirements":["認定支援機関による支援","金融機関への計画提出"],"application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/kakushin/kaizen/index.html","contact":"中小企業活性化協議会"}'));

-- ============================================================
-- 55. 経営革新計画（経営革新等支援法）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KEIEI-KAKUSHIN', '経営革新計画', 'METI', '中小企業庁', 'management,innovation', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KEIEI-KAKUSHIN', 'manual', '経営革新計画（中小企業等経営強化法）', 'KEIEI-KAKUSHIN', 90, 0, '各種優遇', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"経営革新計画","category":"経営革新","issuer":"中小企業庁（都道府県知事承認）","summary":"新事業活動に取り組む中小企業の経営革新計画を都道府県知事が承認。承認を受けると各種支援策が利用可能","benefits":"日本政策金融公庫の特別利率適用、信用保証の特例、投資育成会社の投資対象拡大、補助金審査での加点等","target":"新事業活動に取り組む中小企業","requirements":["新商品・新サービス・新生産方式等の計画","3～5年の経営革新計画策定","経営指標の目標設定"],"application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/kakushin/","contact":"都道府県の中小企業支援担当課"}'));

-- ============================================================
-- 56. 中小企業等事業再構築促進基金（グリーン成長枠）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SAIKOUCHIKU-GREEN', '事業再構築補助金（グリーン成長枠）', 'METI', '経済産業省', 'green,restructuring', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SAIKOUCHIKU-GREEN', 'manual', '事業再構築補助金（グリーン成長枠）', 'SAIKOUCHIKU-GREEN', 90, 150000000, '1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"事業再構築補助金（グリーン成長枠）","category":"グリーン成長","issuer":"経済産業省","summary":"グリーン成長戦略の14分野に資する事業再構築に取り組む中小企業を支援","max_amount":"中小1.5億円、中堅1億円","subsidy_rate":"中小1/2、中堅1/3","target":"グリーン成長戦略14分野の事業再構築に取り組む事業者","requirements":["グリーン成長戦略14分野に該当","事業再構築計画"],"url":"https://jigyou-saikouchiku.go.jp/","contact":"事業再構築補助金事務局","notes":"最終回の公募状況を要確認"}'));

-- ============================================================
-- 57. IT導入補助金 デジタル基盤導入型
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('DIGITAL-AI-KIBAN', 'デジタル化・AI導入補助金（デジタル基盤導入型）', 'METI', '経済産業省', 'digital,innovation', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('DIGITAL-AI-KIBAN', 'manual', 'デジタル化・AI導入補助金2026（デジタル基盤導入型）', 'DIGITAL-AI-KIBAN', 90, 5000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"デジタル化・AI導入補助金2026（デジタル基盤導入型）","category":"デジタル基盤","issuer":"経済産業省・中小企業庁","summary":"AI・ERPなど高機能ソフトウェアの導入を支援する新設枠","max_amount":"最大500万円","subsidy_rate":"2/3","target":"中小企業・小規模事業者等","requirements":["IT導入支援事業者の支援","対象ソフトウェアの導入"],"application_period":"2026年公募予定","url":"https://it-shien.smrj.go.jp/","contact":"デジタル化・AI導入補助金事務局"}'));

-- ============================================================
-- 58. SBIR（中小企業技術革新制度）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SBIR-JAPAN', 'SBIR（日本版中小企業技術革新制度）', 'METI', '経済産業省', 'innovation,rd', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SBIR-JAPAN', 'manual', 'SBIR（日本版中小企業技術革新制度）', 'SBIR-JAPAN', 90, 0, '各省庁による', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"SBIR（日本版中小企業技術革新制度）","category":"技術革新・研究開発","issuer":"内閣府（各省庁が実施）","summary":"研究開発型の中小企業・スタートアップに対し、政府の研究開発予算を活用した技術革新を支援するフェーズ型制度","phases":"Phase1: FS調査、Phase2: 研究開発、Phase3: 事業化","target":"中小企業・スタートアップ","requirements":["革新的な研究開発テーマ","事業化計画"],"application_period":"各省庁の公募による","url":"https://www8.cao.go.jp/cstp/compefund/sbir/","contact":"内閣府科学技術・イノベーション推進事務局","notes":"各省庁の特定補助金等がSBIR制度に指定される"}'));

-- ============================================================
-- 59. JAPANブランド育成支援等事業費補助金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JAPAN-BRAND', 'JAPANブランド育成支援等事業費補助金', 'METI', '経済産業省', 'export,branding', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JAPAN-BRAND', 'manual', 'JAPANブランド育成支援等事業費補助金', 'JAPAN-BRAND', 90, 5000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"JAPANブランド育成支援等事業費補助金","category":"海外展開","issuer":"経済産業省","summary":"中小企業等の海外展開やブランド確立を支援。海外展示会出展、プロモーション、EC販売等の費用を補助","max_amount":"500万円","subsidy_rate":"2/3","target":"海外展開を目指す中小企業・小規模事業者","requirements":["海外展開計画の策定","認定支援機関等の支援"],"application_period":"公募時期による","url":"https://www.meti.go.jp/policy/sme_chiiki/JAPANbrand/index.html","contact":"各経済産業局"}'));

-- ============================================================
-- 60. 海外ビジネス戦略推進支援事業（JETRO支援）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JETRO-KAIGAI', 'JETRO海外ビジネス戦略推進支援事業', 'JETRO', '日本貿易振興機構', 'export', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JETRO-KAIGAI', 'manual', 'JETRO海外ビジネス戦略推進支援事業', 'JETRO-KAIGAI', 90, 0, '無料～一部有料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"JETRO海外ビジネス戦略推進支援事業","category":"海外展開支援","issuer":"JETRO（日本貿易振興機構）","summary":"中小企業の海外展開を総合的に支援。海外市場調査、商談会、展示会出展、法務・税務相談等を提供","services":["新輸出大国コンソーシアム（専門家伴走支援）","海外ビジネスマッチング","JETRO展示会・商談会","海外ミニ調査サービス"],"target":"海外展開を目指す中小企業","requirements":["JETRO相談窓口への申込"],"application_period":"通年","url":"https://www.jetro.go.jp/services/","contact":"JETRO本部・各地域事務所"}'));

-- ============================================================
-- 61. ものづくり補助金（省力化枠）※第23次新設
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('MONODUKURI-SHOURYOKU', 'ものづくり補助金（省力化（オーダーメイド）枠）', 'METI', '経済産業省', 'manufacturing,automation', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('MONODUKURI-SHOURYOKU', 'manual', 'ものづくり補助金（省力化（オーダーメイド）枠）※第22次まで', 'MONODUKURI-SHOURYOKU', 90, 80000000, '1/2～2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"ものづくり補助金（省力化（オーダーメイド）枠）","category":"省力化投資","issuer":"経済産業省","summary":"人手不足解消に資するオーダーメイド型の省力化投資（ロボット、AI、IoT等）を支援","max_amount":"750万円～8,000万円（従業員規模による）","subsidy_rate":"中小1/2、小規模・再生2/3","target":"人手不足に直面する中小企業","requirements":["省力化計画の策定","3-5年の事業計画","付加価値額年率3%成長"],"application_period":"第22次まで実施。第23次は製品・サービス高付加価値化枠に統合","url":"https://portal.monodukuri-hojo.jp/","contact":"ものづくり補助金事務局"}'));

-- ============================================================
-- 62. 中小企業海外出願支援事業（知的財産）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHIZAI-KAIGAI', '中小企業等海外出願・侵害対策支援事業', 'METI', '特許庁・JETRO', 'intellectual_property', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHIZAI-KAIGAI', 'manual', '中小企業等海外出願・侵害対策支援事業', 'CHIZAI-KAIGAI', 90, 3000000, '1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業等海外出願・侵害対策支援事業","category":"知的財産・海外出願","issuer":"特許庁・JETRO","summary":"中小企業の外国への特許・意匠・商標等の出願費用および海外での知財侵害対策費用を補助","max_amount":"外国出願: 300万円、侵害対策: 500万円","subsidy_rate":"1/2","target":"海外出願を行う中小企業","requirements":["国内出願済みであること","JETRO等を通じた申請"],"application_period":"公募時期による","url":"https://www.jetro.go.jp/services/ip_service_overseas_appli.html","contact":"JETRO知的財産課"}'));

-- ============================================================
-- 63. エネルギー使用合理化等事業者支援事業（省エネ診断）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHOUENE-SHINDAN', '省エネルギー診断', 'METI', '経済産業省（ECCJ）', 'energy', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHOUENE-SHINDAN', 'manual', '省エネルギー診断', 'SHOUENE-SHINDAN', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"省エネルギー診断","category":"省エネ診断","issuer":"省エネルギーセンター（ECCJ）","summary":"工場・ビル・店舗等を専門家が訪問し、省エネルギーの改善提案を無料で実施","cost":"無料","target":"中小企業の工場・事業所","requirements":["申込書の提出","現地調査の受入れ"],"application_period":"通年","url":"https://www.shindan-net.jp/","contact":"省エネルギーセンター"}'));

-- ============================================================
-- 64. ZEB（ネット・ゼロ・エネルギー・ビル）実証事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('ZEB-JISSHOU', 'ZEB実証事業（ネット・ゼロ・エネルギー・ビル）', 'MOE', '環境省', 'green,building', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('ZEB-JISSHOU', 'manual', 'ZEB実証事業', 'ZEB-JISSHOU', 90, 500000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"ZEB実証事業","category":"ZEB・省エネ建築","issuer":"環境省","summary":"ZEB（ネット・ゼロ・エネルギー・ビル）の新築・改修に対する設備導入費の補助","max_amount":"5億円","subsidy_rate":"2/3（中小）、1/2（大企業）","target":"ZEBの新築・改修を行う事業者","requirements":["ZEB設計ガイドラインに基づく設計","エネルギー消費量の削減"],"application_period":"公募時期による","url":"https://www.env.go.jp/earth/ondanka/biz_local.html","contact":"環境省地球環境局"}'));

-- ============================================================
-- 65. 地域脱炭素移行・再エネ推進交付金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHIIKI-DATSUTANSO', '地域脱炭素移行・再エネ推進交付金', 'MOE', '環境省', 'green,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHIIKI-DATSUTANSO', 'manual', '地域脱炭素移行・再エネ推進交付金', 'CHIIKI-DATSUTANSO', 90, 0, '2/3～3/4', '全業種（地方公共団体経由）', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"地域脱炭素移行・再エネ推進交付金","category":"地域脱炭素","issuer":"環境省","summary":"脱炭素先行地域の選定を受けた地域等での再エネ設備導入、省エネ改修等を支援","subsidy_rate":"2/3～3/4","target":"地方公共団体（民間事業者は間接補助）","requirements":["脱炭素先行地域の選定又は重点対策加速化事業"],"application_period":"公募時期による","url":"https://policies.env.go.jp/policy/roadmap/grants/","contact":"環境省大臣官房地域政策課"}'));

-- ============================================================
-- 66. 自家消費型太陽光発電等導入支援事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TAIYOUKOU-JIKASOHI', '自家消費型太陽光発電設備等導入支援事業', 'MOE', '環境省', 'green,energy', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TAIYOUKOU-JIKASOHI', 'manual', '自家消費型太陽光発電設備等導入支援事業', 'TAIYOUKOU-JIKASOHI', 90, 0, '1/3～1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"自家消費型太陽光発電設備等導入支援事業","category":"太陽光発電","issuer":"環境省","summary":"自家消費型の太陽光発電設備や蓄電池の導入費用を補助","subsidy_rate":"太陽光: 定額（4～7万円/kW）、蓄電池: 1/3","target":"中小企業・地方公共団体等","requirements":["自家消費型（FIT/FIP非適用）","一定割合以上の自家消費"],"application_period":"公募時期による","url":"https://www.env.go.jp/earth/ondanka/biz_local.html","contact":"環境省地球環境局"}'));

-- ============================================================
-- 67. 産業・業務部門における高効率ヒートポンプ等導入促進事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('HEATPUMP-SANGYOU', '高効率ヒートポンプ等導入促進事業', 'MOE', '環境省', 'green,energy', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('HEATPUMP-SANGYOU', 'manual', '産業・業務部門における高効率ヒートポンプ等導入促進事業', 'HEATPUMP-SANGYOU', 90, 0, '1/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"産業・業務部門における高効率ヒートポンプ等導入促進事業","category":"省エネ・電化","issuer":"環境省","summary":"産業・業務部門での高効率ヒートポンプ（空調・給湯・工業プロセス用）の導入を支援","subsidy_rate":"1/3","target":"産業・業務用施設にヒートポンプを導入する事業者","requirements":["既存設備からの更新","CO2削減効果"],"application_period":"公募時期による","url":"https://www.env.go.jp/earth/ondanka/biz_local.html","contact":"環境省地球環境局"}'));

-- ============================================================
-- 68. 中小企業等に対する省エネルギー診断拡充事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHOUENE-CHUSHO', '中小企業等に対する省エネルギー診断拡充事業', 'METI', '経済産業省', 'energy', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHOUENE-CHUSHO', 'manual', '中小企業等に対する省エネルギー診断拡充事業', 'SHOUENE-CHUSHO', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業等に対する省エネルギー診断拡充事業","category":"省エネ診断","issuer":"経済産業省（資源エネルギー庁）","summary":"中小企業等に対する無料の省エネルギー診断サービス","cost":"無料","target":"中小企業・小規模事業者","services":["省エネ専門家による現地診断","改善提案レポートの提供","設備更新の投資回収計算"],"application_period":"通年","url":"https://www.enecho.meti.go.jp/category/saving_and_new/saving/enterprise/support/","contact":"省エネルギーセンター"}'));

-- ============================================================
-- 69. 建設キャリアアップシステム（CCUS）普及促進事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CCUS-FUKYUU', '建設キャリアアップシステム（CCUS）普及促進', 'MLIT', '国土交通省', 'construction', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CCUS-FUKYUU', 'manual', '建設キャリアアップシステム（CCUS）普及促進', 'CCUS-FUKYUU', 90, 0, '無料～定額支援', '建設業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"建設キャリアアップシステム（CCUS）普及促進","category":"建設業DX","issuer":"国土交通省","summary":"建設技能者の就業履歴・保有資格等を登録・蓄積するCCUSの普及を促進。導入費用の一部支援","target":"建設事業者","requirements":["CCUS事業者登録","技能者登録"],"application_period":"通年","url":"https://www.ccus.jp/","contact":"建設キャリアアップシステム運営協議会"}'));

-- ============================================================
-- 70. 長期優良住宅化リフォーム推進事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHOUKI-YURYOU-REFORM', '長期優良住宅化リフォーム推進事業', 'MLIT', '国土交通省', 'housing', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHOUKI-YURYOU-REFORM', 'manual', '長期優良住宅化リフォーム推進事業', 'CHOUKI-YURYOU-REFORM', 90, 2500000, '1/3', '住宅・建設業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"長期優良住宅化リフォーム推進事業","category":"住宅リフォーム","issuer":"国土交通省","summary":"既存住宅の長寿命化・省エネ化等の性能向上リフォームを支援","max_amount":"評価基準型100万円/戸、認定長期優良住宅型200万円/戸、高度省エネ型250万円/戸","subsidy_rate":"1/3","target":"住宅のリフォームを行う個人・事業者","requirements":["インスペクション（建物状況調査）の実施","性能向上リフォーム工事"],"application_period":"公募時期による","url":"https://www.kenken.go.jp/chouki_r/","contact":"国立研究開発法人建築研究所"}'));

-- ============================================================
-- 71. テレワーク促進助成金（東京都）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKYO-TELEWORK', 'テレワーク促進助成金（東京都）', 'TOKYO', '東京都', 'workstyle,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKYO-TELEWORK', 'manual', 'テレワーク促進助成金（東京都）', 'TOKYO-TELEWORK', 90, 2500000, '1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"テレワーク促進助成金（東京都）","category":"テレワーク","issuer":"東京都（公益財団法人東京しごと財団）","summary":"都内中小企業のテレワーク環境整備（通信機器、ソフトウェア等）の導入費用を助成","max_amount":"250万円","subsidy_rate":"1/2","target":"都内の常用雇用者2～999人の中小企業","target_area":"東京都","requirements":["東京都内の中小企業","テレワーク環境の整備"],"application_period":"年度内公募","url":"https://www.shigotozaidan.or.jp/koyo-kankyo/joseikin/telework.html","contact":"東京しごと財団"}'));

-- ============================================================
-- 72. 東京都中小企業振興公社 革新的事業展開設備投資支援事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKYO-KAKUSHIN-SETSUBI', '革新的事業展開設備投資支援事業（東京都）', 'TOKYO', '東京都中小企業振興公社', 'equipment,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKYO-KAKUSHIN-SETSUBI', 'manual', '革新的事業展開設備投資支援事業（東京都）', 'TOKYO-KAKUSHIN-SETSUBI', 90, 100000000, '1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"革新的事業展開設備投資支援事業","category":"設備投資","issuer":"東京都中小企業振興公社","summary":"都内中小企業の競争力強化のための先端設備導入（機械装置、器具備品、ソフトウェア等）を支援","max_amount":"1億円","subsidy_rate":"1/2（小規模事業者は2/3）","target":"都内の中小企業者","target_area":"東京都","requirements":["都内に本社・事業所","先端設備の導入計画"],"application_period":"年2-3回公募","url":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/kakushin.html","contact":"東京都中小企業振興公社"}'));

-- ============================================================
-- 73. 小規模事業者販路開拓支援事業（旧：販路開拓等支援）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('HANRO-KAITAKU', '小規模事業者販路開拓支援事業', 'METI', '中小企業庁', 'sales,marketing', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('HANRO-KAITAKU', 'manual', '小規模事業者販路開拓支援事業', 'HANRO-KAITAKU', 90, 0, '無料支援', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"小規模事業者販路開拓支援事業","category":"販路開拓","issuer":"中小企業庁（商工会議所・商工会）","summary":"商工会議所・商工会が小規模事業者の販路開拓を伴走型で支援","services":["経営指導員による販路開拓支援","展示会出展支援","ECサイト構築支援"],"target":"小規模事業者","requirements":["商工会議所・商工会の管轄地域内"],"application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/shokibo/","contact":"最寄りの商工会議所・商工会"}'));

-- ============================================================
-- 74. よろず支援拠点（経営相談）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('YOROZU-SOUDAN', 'よろず支援拠点', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('YOROZU-SOUDAN', 'manual', 'よろず支援拠点（無料経営相談所）', 'YOROZU-SOUDAN', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"よろず支援拠点","category":"経営相談","issuer":"中小企業庁（中小機構）","summary":"中小企業・小規模事業者の経営上のあらゆる悩みに対応する無料の経営相談所。全国47都道府県に設置","services":["売上拡大","経営改善","資金繰り","創業支援","IT活用","海外展開"],"cost":"無料（何度でも相談可能）","target":"中小企業・小規模事業者・創業予定者","application_period":"通年","url":"https://yorozu.smrj.go.jp/","contact":"各都道府県のよろず支援拠点"}'));

-- ============================================================
-- 75. ミラサポplus（中小企業向け補助金・総合支援サイト）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('MIRASAPO-PLUS', 'ミラサポplus', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('MIRASAPO-PLUS', 'manual', 'ミラサポplus（補助金・総合支援サイト）', 'MIRASAPO-PLUS', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"ミラサポplus","category":"総合支援","issuer":"中小企業庁","summary":"中小企業・小規模事業者向けの補助金・助成金の検索、経営ハンズオン支援、電子申請に対応した総合支援サイト","services":["補助金・助成金検索","事例紹介","専門家派遣","電子申請サポート"],"cost":"無料","target":"中小企業・小規模事業者","url":"https://mirasapo-plus.go.jp/","contact":"中小企業庁"}'));

-- ============================================================
-- 76. 認定経営革新等支援機関（専門家活用制度）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('NINTEI-SHIEN-KIKAN', '認定経営革新等支援機関による支援', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('NINTEI-SHIEN-KIKAN', 'manual', '認定経営革新等支援機関による支援', 'NINTEI-SHIEN-KIKAN', 90, 0, '無料～一部有料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"認定経営革新等支援機関による支援","category":"専門家支援","issuer":"中小企業庁","summary":"国が認定した税理士、公認会計士、中小企業診断士等の専門家が中小企業の経営課題を支援。補助金申請の支援確認書の発行も","services":["経営改善計画策定支援","補助金申請支援","事業計画策定支援","金融機関との調整"],"target":"中小企業・小規模事業者","application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/kakushin/nintei/","contact":"中小企業庁経営支援部"}'));

-- ============================================================
-- 77. 事業引継ぎ支援センター（事業承継・M&A総合支援）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JIGYOU-HIKITSUGI', '事業承継・引継ぎ支援センター', 'METI', '中小企業庁', 'succession', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JIGYOU-HIKITSUGI', 'manual', '事業承継・引継ぎ支援センター（無料相談）', 'JIGYOU-HIKITSUGI', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"事業承継・引継ぎ支援センター","category":"事業承継","issuer":"中小企業庁（中小機構）","summary":"後継者不在の中小企業の事業承継に関する相談対応、マッチング支援を無料で実施","services":["親族内承継支援","従業員承継支援","M&Aマッチング","事業承継計画策定支援"],"cost":"無料","target":"後継者問題を抱える中小企業","application_period":"通年","url":"https://shoukei.smrj.go.jp/","contact":"各都道府県の事業承継・引継ぎ支援センター"}'));

-- ============================================================
-- 78. 事業承継税制（法人版・個人版）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JIGYOU-SHOKEI-ZEISEI', '事業承継税制（特例措置）', 'METI', '経済産業省・国税庁', 'tax,succession', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JIGYOU-SHOKEI-ZEISEI', 'manual', '事業承継税制（法人版事業承継税制・個人版事業承継税制）', 'JIGYOU-SHOKEI-ZEISEI', 90, 0, '100%猶予', '全業種', '2025-04-01', '2027-03-31',
datetime('now', '+180 days'),
json('{"name":"事業承継税制","category":"税制優遇・事業承継","issuer":"経済産業省・国税庁","summary":"後継者が取得した非上場株式等に係る贈与税・相続税の納税を100%猶予する特例措置","benefits":"贈与税・相続税の100%納税猶予（特例措置の場合）","target":"非上場中小企業の後継者","requirements":["特例承継計画の策定・提出（2026年3月末まで）","都道府県知事の認定","経営継続"],"application_period":"特例承継計画は2026年3月末まで","url":"https://www.chusho.meti.go.jp/zaimu/shoukei/shoukei_zeisei.html","contact":"各経済産業局、税務署","notes":"特例措置の計画提出期限に注意（2026年3月末）"}'));

-- ============================================================
-- 79. 中小企業退職金共済制度（中退共）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHUTAIKYO', '中小企業退職金共済制度（中退共）', 'MHLW', '厚生労働省', 'employment,welfare', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHUTAIKYO', 'manual', '中小企業退職金共済制度（中退共）掛金助成', 'CHUTAIKYO', 90, 0, '掛金の1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業退職金共済制度（中退共）","category":"退職金・福利厚生","issuer":"独立行政法人勤労者退職金共済機構","summary":"中小企業が従業員の退職金を積み立てる制度。新規加入時に掛金の一部を国が助成","benefits":"新規加入: 掛金月額の1/2（上限5,000円）を加入後4か月目から1年間助成、月額変更: 増額分の1/3を増額月から1年間助成","target":"中小企業（常用従業員300人以下等）","requirements":["中退共への加入","掛金の納付"],"application_period":"通年","url":"https://chutaikyo.taisyokukin.go.jp/","contact":"中退共本部・各コーナー"}'));

-- ============================================================
-- 80. 小規模企業共済制度（経営者の退職金）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHOUKIBO-KYOSAI', '小規模企業共済', 'METI', '中小機構', 'finance,welfare', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHOUKIBO-KYOSAI', 'manual', '小規模企業共済（経営者のための退職金制度）', 'SHOUKIBO-KYOSAI', 90, 840000, '全額所得控除', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"小規模企業共済","category":"経営者退職金・節税","issuer":"独立行政法人中小企業基盤整備機構","summary":"小規模企業の経営者や個人事業主のための退職金制度。掛金は全額所得控除","benefits":"掛金月額1,000円～70,000円（年間最大84万円の全額所得控除）","target":"小規模企業の経営者・個人事業主","requirements":["常時使用する従業員が20人以下（商業・サービス業は5人以下）"],"application_period":"通年","url":"https://www.smrj.go.jp/kyosai/skyosai/","contact":"中小機構コールセンター 050-5541-7171"}'));

-- ============================================================
-- 81. 経営セーフティ共済（中小企業倒産防止共済制度）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KEIEI-SAFETY-KYOSAI', '経営セーフティ共済（中小企業倒産防止共済）', 'METI', '中小機構', 'finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KEIEI-SAFETY-KYOSAI', 'manual', '経営セーフティ共済（中小企業倒産防止共済制度）', 'KEIEI-SAFETY-KYOSAI', 90, 2400000, '全額損金算入', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"経営セーフティ共済（中小企業倒産防止共済制度）","category":"連鎖倒産防止","issuer":"独立行政法人中小企業基盤整備機構","summary":"取引先の倒産による連鎖倒産を防止するための共済制度。掛金は全額損金（必要経費）に算入可能","benefits":"掛金月額5,000円～200,000円（年間最大240万円の損金算入）、取引先倒産時に掛金総額の10倍（最大8,000万円）まで無担保・無保証・無利子で借入可能","target":"1年以上事業を行っている中小企業","requirements":["中小企業者であること","1年以上の事業継続"],"application_period":"通年","url":"https://www.smrj.go.jp/kyosai/tkyosai/","contact":"中小機構コールセンター 050-5541-7171"}'));

-- ============================================================
-- 82. 地方創生推進交付金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHIHOU-SOUSEI', '地方創生推進交付金', 'CAO', '内閣府', 'regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHIHOU-SOUSEI', 'manual', '地方創生推進交付金', 'CHIHOU-SOUSEI', 90, 0, '1/2', '全業種（地方公共団体経由）', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"地方創生推進交付金","category":"地方創生","issuer":"内閣府","summary":"地方公共団体による地方版総合戦略に基づく自主的・主体的な地方創生の取組を支援","subsidy_rate":"1/2","target":"地方公共団体（都道府県・市町村）","requirements":["地方版総合戦略の策定","KPIの設定"],"application_period":"年度による","url":"https://www.chisou.go.jp/sousei/about/kouhukin/","contact":"内閣府地方創生推進事務局"}'));

-- ============================================================
-- 83. デジタル田園都市国家構想交付金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('DIGITAL-DENEN', 'デジタル田園都市国家構想交付金', 'CAO', '内閣府', 'digital,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('DIGITAL-DENEN', 'manual', 'デジタル田園都市国家構想交付金', 'DIGITAL-DENEN', 90, 0, '1/2～定額', '全業種（地方公共団体経由）', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"デジタル田園都市国家構想交付金","category":"デジタル田園都市","issuer":"内閣府","summary":"デジタル技術を活用した地方の課題解決・魅力向上に取り組む地方公共団体を支援","types":["デジタル実装タイプ（TYPE1/2/3）","地方創生テレワークタイプ","地方創生推進タイプ"],"target":"地方公共団体","requirements":["デジタル実装計画の策定","KPIの設定"],"application_period":"年度による","url":"https://www.chisou.go.jp/sousei/about/mirai/","contact":"内閣府地方創生推進事務局"}'));

-- ============================================================
-- 84. IT活用促進資金（日本政策金融公庫）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('IT-KATSUYOU-YUSHI', 'IT活用促進資金', 'JFC', '日本政策金融公庫', 'finance,digital', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('IT-KATSUYOU-YUSHI', 'manual', 'IT活用促進資金', 'IT-KATSUYOU-YUSHI', 90, 72000000, '低金利融資', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"IT活用促進資金","category":"IT投資融資","issuer":"日本政策金融公庫","summary":"IT活用による生産性向上に取り組む中小企業向けの特別貸付","max_amount":"7,200万円（うち運転資金4,800万円）","interest_rate":"特別利率","target":"IT活用による生産性向上に取り組む中小企業","requirements":["IT活用計画","認定支援機関等の確認"],"application_period":"通年","url":"https://www.jfc.go.jp/n/finance/search/itsokushin_m.html","contact":"日本政策金融公庫各支店"}'));

-- ============================================================
-- 85. 中小企業組合向け助成金（中小企業組合等課題対応支援事業）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KUMIAI-SHIEN', '中小企業組合等課題対応支援事業', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KUMIAI-SHIEN', 'manual', '中小企業組合等課題対応支援事業', 'KUMIAI-SHIEN', 90, 5000000, '6/10', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業組合等課題対応支援事業","category":"組合支援","issuer":"全国中小企業団体中央会","summary":"中小企業組合等が行う人材育成、販路開拓、ITの利活用等の取組を支援","max_amount":"500万円","subsidy_rate":"6/10","target":"事業協同組合、商工組合等","requirements":["中小企業組合等であること","課題解決に向けた計画"],"application_period":"年度内公募","url":"https://www.chuokai.or.jp/","contact":"全国中小企業団体中央会"}'));

-- ============================================================
-- 86. 創業支援等事業費補助金（市区町村の創業支援）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SOUGYOU-SHIEN', '創業支援等事業費補助金', 'METI', '中小企業庁', 'startup', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SOUGYOU-SHIEN', 'manual', '創業支援等事業費補助金', 'SOUGYOU-SHIEN', 90, 10000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"創業支援等事業費補助金","category":"創業支援","issuer":"中小企業庁","summary":"市区町村による創業支援事業（セミナー、相談窓口、インキュベーション等）の実施費用を補助","max_amount":"1,000万円","subsidy_rate":"2/3","target":"産業競争力強化法に基づく認定を受けた市区町村","requirements":["創業支援等事業計画の認定","創業支援事業の実施"],"application_period":"年度内公募","url":"https://www.chusho.meti.go.jp/keiei/chiiki/index.html","contact":"中小企業庁創業・新事業促進課","notes":"間接的に創業者を支援する仕組み"}'));

-- ============================================================
-- 87. ふるさと起業・移住促進事業（移住起業支援金）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('IJUU-KIGYOU', '移住支援金・起業支援金', 'CAO', '内閣府', 'startup,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('IJUU-KIGYOU', 'manual', '移住支援金・起業支援金（地方創生起業支援事業）', 'IJUU-KIGYOU', 90, 3000000, '1/2', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"移住支援金・起業支援金","category":"移住・起業","issuer":"内閣府（地方公共団体が実施）","summary":"東京圏から地方への移住と地域の社会的事業の起業を支援。移住支援金と起業支援金の2本立て","max_amount":"起業支援金: 最大300万円（1/2補助）、移住支援金: 単身60万円、世帯100万円、子ども加算あり","target":"東京23区在住/通勤者で地方へ移住する方","requirements":["東京圏からの移住","社会的事業の起業（起業支援金の場合）"],"application_period":"各都道府県による","url":"https://www.chisou.go.jp/sousei/ijyu_shienkin.html","contact":"各都道府県の担当課"}'));

-- ============================================================
-- 88. J-Startup（スタートアップ支援プログラム）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('J-STARTUP', 'J-Startupプログラム', 'METI', '経済産業省', 'startup,innovation', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('J-STARTUP', 'manual', 'J-Startup（スタートアップ育成プログラム）', 'J-STARTUP', 90, 0, '各種支援', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"J-Startup","category":"スタートアップ育成","issuer":"経済産業省・JETRO・NEDO","summary":"日本発のスタートアップ企業を選定し、政府機関・民間が集中的に支援するプログラム","services":["海外展示会出展支援","政府調達の優先","大企業とのマッチング","メンタリング"],"target":"革新的な技術・ビジネスモデルのスタートアップ","requirements":["J-Startup選定委員会による選定"],"application_period":"選定は随時","url":"https://www.j-startup.go.jp/","contact":"JETRO・NEDO"}'));

-- ============================================================
-- 89. NEDO（新エネルギー・産業技術総合開発機構）研究開発助成
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('NEDO-RD', 'NEDO研究開発助成事業', 'NEDO', '新エネルギー・産業技術総合開発機構', 'rd,innovation', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('NEDO-RD', 'manual', 'NEDO研究開発助成（各種プログラム）', 'NEDO-RD', 90, 0, '2/3～定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"NEDO研究開発助成事業","category":"研究開発","issuer":"NEDO（新エネルギー・産業技術総合開発機構）","summary":"エネルギー・環境・産業技術分野の研究開発を助成。中小・ベンチャー向けの研究開発支援も充実","programs":["SBIR推進プログラム","中小企業イノベーション創出推進事業","ディープテック・スタートアップ支援","GX分野研究開発"],"subsidy_rate":"2/3～定額","target":"研究開発型の中小企業・スタートアップ","application_period":"各プログラムによる","url":"https://www.nedo.go.jp/","contact":"NEDO各部署"}'));

-- ============================================================
-- 90. 事業承継・引継ぎ補助金（専門家活用枠）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JIGYOSHOKEI-SENMONKA', '事業承継・M&A補助金（専門家活用枠）', 'METI', '経済産業省', 'succession', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JIGYOSHOKEI-SENMONKA', 'manual', '事業承継・M&A補助金（専門家活用枠）', 'JIGYOSHOKEI-SENMONKA', 90, 20000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"事業承継・M&A補助金（専門家活用枠）","category":"M&A専門家","issuer":"経済産業省・中小企業庁","summary":"M&Aを実施する際のFA・仲介手数料、DD費用等の専門家費用を補助","max_amount":"M&A支援: 最大2,000万円（M&A規模による）、PMI支援: 150万円","subsidy_rate":"2/3","target":"M&Aにより経営資源を引き継ぐ中小企業","requirements":["M&A実施計画","認定支援機関の確認"],"application_period":"公募時期による","url":"https://jsh.go.jp/","contact":"事業承継・M&A補助金事務局"}'));

-- ============================================================
-- 91. 事業承継・引継ぎ補助金（廃業・再チャレンジ枠）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JIGYOSHOKEI-HAIGYO', '事業承継・M&A補助金（廃業・再チャレンジ枠）', 'METI', '経済産業省', 'succession', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JIGYOSHOKEI-HAIGYO', 'manual', '事業承継・M&A補助金（廃業・再チャレンジ枠）', 'JIGYOSHOKEI-HAIGYO', 90, 1500000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"事業承継・M&A補助金（廃業・再チャレンジ枠）","category":"廃業支援","issuer":"経済産業省・中小企業庁","summary":"事業承継やM&Aに伴い不要となる事業の廃業費用、および新たな取組（再チャレンジ）の費用を補助","max_amount":"廃業費: 150万円、再チャレンジ: 150万円","subsidy_rate":"2/3","target":"廃業を伴うM&A、または再チャレンジする経営者","requirements":["廃業計画又は再チャレンジ計画"],"application_period":"公募時期による","url":"https://jsh.go.jp/","contact":"事業承継・M&A補助金事務局"}'));

-- ============================================================
-- 92. エイジフレンドリー補助金（高齢者安全衛生対策）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('AGE-FRIENDLY', 'エイジフレンドリー補助金', 'MHLW', '厚生労働省', 'workplace_safety', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('AGE-FRIENDLY', 'manual', 'エイジフレンドリー補助金', 'AGE-FRIENDLY', 90, 1000000, '1/2', '全業種', '2025-04-01', '2025-10-31',
datetime('now', '+180 days'),
json('{"name":"エイジフレンドリー補助金","category":"高齢者安全衛生","issuer":"厚生労働省","summary":"高齢者が安全に働ける職場環境の整備（転倒防止、腰痛予防、暑熱対策等）の費用を補助","max_amount":"100万円","subsidy_rate":"1/2","target":"60歳以上の高年齢労働者を雇用する中小企業","requirements":["高年齢労働者の安全衛生対策","労働安全衛生法の遵守"],"application_period":"2025年6月頃～10月頃（予定）","url":"https://www.mhlw.go.jp/stf/newpage_09940.html","contact":"厚生労働省労働基準局安全衛生部"}'));

-- ============================================================
-- 93. 団体経由産業保健活動推進助成金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SANGYOU-HOKEN-DANTAI', '団体経由産業保健活動推進助成金', 'MHLW', '厚生労働省', 'workplace_safety', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SANGYOU-HOKEN-DANTAI', 'manual', '団体経由産業保健活動推進助成金', 'SANGYOU-HOKEN-DANTAI', 90, 100000000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"団体経由産業保健活動推進助成金","category":"産業保健","issuer":"厚生労働省（労働者健康安全機構）","summary":"事業主団体等が構成事業場に対して産業保健サービス（ストレスチェック、健康相談等）を提供した場合に助成","max_amount":"1億円（団体規模による）","target":"事業主団体等","requirements":["産業保健活動計画の策定","構成事業場への産業保健サービスの提供"],"application_period":"通年","url":"https://www.johas.go.jp/sangyouhoken/tabid/1999/Default.aspx","contact":"労働者健康安全機構"}'));

-- ============================================================
-- 94. 中小企業活性化パッケージ（経営力再構築伴走支援）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('BANSOU-SHIEN', '経営力再構築伴走支援', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('BANSOU-SHIEN', 'manual', '経営力再構築伴走支援（中小企業活性化パッケージ）', 'BANSOU-SHIEN', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"経営力再構築伴走支援","category":"経営改善","issuer":"中小企業庁（中小企業活性化協議会）","summary":"収益力改善や事業再生に取り組む中小企業に対し、専門家が伴走して経営改善を支援","services":["経営改善計画の策定支援","金融機関との調整","事業再生支援","事業転換支援"],"cost":"無料","target":"経営課題を抱える中小企業","application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/saisei/","contact":"各都道府県の中小企業活性化協議会"}'));

-- ============================================================
-- 95. 下請かけこみ寺（下請取引適正化支援）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHITAUKE-KAKEKOMI', '下請かけこみ寺', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHITAUKE-KAKEKOMI', 'manual', '下請かけこみ寺（下請取引適正化支援事業）', 'SHITAUKE-KAKEKOMI', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"下請かけこみ寺","category":"取引適正化","issuer":"中小企業庁（全国中小企業振興機関協会）","summary":"下請取引に関する様々な問題（代金未払い、一方的な値下げ等）について無料で相談・ADR（裁判外紛争解決）を提供","services":["無料相談（電話・メール・面談）","弁護士による無料相談","ADR（裁判外紛争解決）"],"cost":"無料","target":"下請事業者","application_period":"通年","url":"https://www.zenkyo.or.jp/kakekomi/","contact":"全国中小企業振興機関協会 0120-418-618"}'));

-- ============================================================
-- 96. 中小企業119（旧・ミラサポ専門家派遣）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHUSHO-119', '中小企業119（専門家相談）', 'METI', '中小企業庁', 'management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHUSHO-119', 'manual', '中小企業119（旧ミラサポ専門家派遣）', 'CHUSHO-119', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業119","category":"専門家相談","issuer":"中小企業庁（中小機構）","summary":"中小企業・小規模事業者が抱える経営課題に対し、専門家をオンライン等で派遣して支援","services":["オンライン・電話相談","AI・チャットボット対応","専門家マッチング"],"cost":"無料","target":"中小企業・小規模事業者","application_period":"通年","url":"https://chusho119.go.jp/","contact":"中小企業119事務局"}'));

-- ============================================================
-- 97. 事業再生支援（中小企業活性化協議会）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JIGYOU-SAISEI', '中小企業活性化協議会による事業再生支援', 'METI', '中小企業庁', 'management,finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JIGYOU-SAISEI', 'manual', '中小企業活性化協議会による事業再生支援', 'JIGYOU-SAISEI', 90, 0, '無料', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業活性化協議会による事業再生支援","category":"事業再生","issuer":"中小企業庁（各都道府県に設置）","summary":"過剰債務等により経営困難な中小企業の事業再生を支援。公正中立な第三者として金融機関との調整も","services":["事業再生計画の策定支援","金融機関との債務調整","事業DDの実施"],"cost":"無料","target":"事業再生に取り組む中小企業","application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/saisei/index.html","contact":"各都道府県の中小企業活性化協議会"}'));

-- ============================================================
-- 98. 食品産業の輸出向けHACCP等対応施設整備事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('HACCP-SEIBI', '食品産業の輸出向けHACCP等対応施設整備事業', 'MAFF', '農林水産省', 'agriculture,export', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('HACCP-SEIBI', 'manual', '食品産業の輸出向けHACCP等対応施設整備事業', 'HACCP-SEIBI', 90, 0, '1/2', '食品製造業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"食品産業の輸出向けHACCP等対応施設整備事業","category":"食品輸出","issuer":"農林水産省","summary":"食品の輸出拡大に向けたHACCP対応等の施設整備・機器導入を支援","subsidy_rate":"1/2","target":"食品製造業者","requirements":["輸出事業計画","HACCP対応整備計画"],"application_period":"公募時期による","url":"https://www.maff.go.jp/j/shokusan/export/","contact":"農林水産省食料産業局"}'));

-- ============================================================
-- 99. 観光庁 宿泊施設バリアフリー化支援事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHUKUHAKU-BARRIERFREE', '宿泊施設バリアフリー化支援事業', 'MLIT', '観光庁', 'tourism', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHUKUHAKU-BARRIERFREE', 'manual', '宿泊施設バリアフリー化支援事業', 'SHUKUHAKU-BARRIERFREE', 90, 5000000, '1/2', '宿泊業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"宿泊施設バリアフリー化支援事業","category":"観光・バリアフリー","issuer":"観光庁","summary":"訪日外国人旅行者等の受入環境整備のため、宿泊施設のバリアフリー改修を支援","max_amount":"500万円","subsidy_rate":"1/2","target":"旅館・ホテル等の宿泊事業者","requirements":["バリアフリー改修計画","車いす対応客室の整備等"],"application_period":"公募時期による","url":"https://www.mlit.go.jp/kankocho/","contact":"観光庁"}'));

-- ============================================================
-- 100. インバウンド受入環境整備高度化事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('INBOUND-UKEIRE', 'インバウンド受入環境整備高度化事業', 'MLIT', '観光庁', 'tourism', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('INBOUND-UKEIRE', 'manual', 'インバウンド受入環境整備高度化事業', 'INBOUND-UKEIRE', 90, 0, '1/2～定額', '観光・宿泊・小売・飲食', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"インバウンド受入環境整備高度化事業","category":"インバウンド","issuer":"観光庁","summary":"訪日外国人旅行者の受入環境整備（多言語対応、Wi-Fi整備、キャッシュレス対応等）を支援","subsidy_rate":"1/2","target":"観光地・宿泊施設・商業施設等","requirements":["受入環境整備計画","インバウンド対応"],"application_period":"公募時期による","url":"https://www.mlit.go.jp/kankocho/","contact":"観光庁観光地域振興部"}'));

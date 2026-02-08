-- Phase 8 Part 1: 50 new important subsidies (canonical + cache)
-- Categories: 厚労省雇用系、経産省・中小企業庁系、環境省系、国交省系、総務省系、農水省系

-- ============================================================
-- 1. 雇用調整助成金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KOYOU-CHOUSEI', '雇用調整助成金', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KOYOU-CHOUSEI', 'manual', '雇用調整助成金', 'KOYOU-CHOUSEI', 90, 0, '2/3（中小）、1/2（大企業）', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"雇用調整助成金","category":"雇用維持","issuer":"厚生労働省","summary":"経済上の理由により事業活動の縮小を余儀なくされた事業主が、労働者に対して一時的に休業、教育訓練又は出向を行い雇用の維持を図った場合に助成","subsidy_rate":"中小企業2/3、大企業1/2","daily_max":"8,490円/人日（令和7年度）","target":"雇用保険適用事業所で直近3か月の売上等が前年同期比10%以上減少","requirements":["雇用保険適用事業所","売上等が前年同期比10%以上減少","休業等の実施","労使協定の締結"],"expenses":["休業手当","教育訓練費","出向元負担額"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html","contact":"都道府県労働局またはハローワーク","notes":"コロナ特例は終了、通常制度で運用中"}'));

-- ============================================================
-- 2. 産業雇用安定助成金（産業連携人材確保等支援コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SANGYOU-KOYOU-ANNTEI', '産業雇用安定助成金', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SANGYOU-KOYOU-ANNTEI', 'manual', '産業雇用安定助成金（産業連携人材確保等支援コース）', 'SANGYOU-KOYOU-ANNTEI', 90, 2500000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"産業雇用安定助成金（産業連携人材確保等支援コース）","category":"人材確保","issuer":"厚生労働省","summary":"景気の変動、産業構造の変化等に伴い事業活動の一時的な縮小を余儀なくされた事業主が、生産性向上に資する取組等を行うため新たに労働者を雇い入れた場合に助成","max_amount":"250万円/人","target":"事業活動の縮小を余儀なくされた事業主","requirements":["雇用保険適用事業所","新規雇用","生産性向上計画"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000082805_00002.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 3. 早期再就職支援等助成金（中途採用等支援コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SOUKI-SAISHUSHOKU', '早期再就職支援等助成金', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SOUKI-SAISHUSHOKU', 'manual', '早期再就職支援等助成金（中途採用等支援コース）', 'SOUKI-SAISHUSHOKU', 90, 700000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"早期再就職支援等助成金（中途採用等支援コース）","category":"中途採用","issuer":"厚生労働省","summary":"中途採用者の雇用管理制度を整備し、中途採用の拡大を図った場合に助成","max_amount":"70万円","target":"中途採用率を向上させた事業主","requirements":["中途採用計画の策定","中途採用率の向上","雇用管理制度の整備"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000160564_00001.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 4. 特定求職者雇用開発助成金（特定就職困難者コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKUTEI-KONNAN', '特定求職者雇用開発助成金（特定就職困難者コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKUTEI-KONNAN', 'manual', '特定求職者雇用開発助成金（特定就職困難者コース）', 'TOKUTEI-KONNAN', 90, 2400000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"特定求職者雇用開発助成金（特定就職困難者コース）","category":"障害者・高齢者雇用","issuer":"厚生労働省","summary":"高年齢者、障害者、母子家庭の母等の就職困難者をハローワーク等の紹介により継続して雇用する労働者として雇い入れた場合に助成","max_amount":"短時間以外: 60万円～240万円、短時間: 40万円～80万円","target":"就職困難者を雇い入れる事業主","details":"高齢者(60-64歳)60万円、母子家庭の母60万円、身体・知的障害者120万円、重度障害者等240万円","requirements":["ハローワーク等の紹介","継続雇用","雇用保険加入"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_konnan.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 5. 特定求職者雇用開発助成金（発達障害者・難治性疾患患者コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKUTEI-HATTATSU', '特定求職者雇用開発助成金（発達障害者・難治性疾患患者コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKUTEI-HATTATSU', 'manual', '特定求職者雇用開発助成金（発達障害者・難治性疾患患者コース）', 'TOKUTEI-HATTATSU', 90, 1200000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"特定求職者雇用開発助成金（発達障害者・難治性疾患患者コース）","category":"障害者雇用","issuer":"厚生労働省","summary":"発達障害者や難治性疾患患者をハローワーク等の紹介により雇い入れた場合に助成","max_amount":"120万円（中小企業）","requirements":["ハローワーク等の紹介","継続雇用"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/hattatsu_nanchi.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 6. 特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKUTEI-HYOUGAKI', '特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKUTEI-HYOUGAKI', 'manual', '特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）', 'TOKUTEI-HYOUGAKI', 90, 600000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）","category":"就職氷河期世代支援","issuer":"厚生労働省","summary":"就職氷河期世代（概ね1968-1988年生まれ）の不安定就労者・無業者を正規雇用で雇い入れた場合に助成","max_amount":"60万円（中小企業）","target":"就職氷河期世代を正規雇用する事業主","requirements":["ハローワーク等の紹介","正規雇用","対象者が就職氷河期世代"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000158169_00001.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 7. 特定求職者雇用開発助成金（生活保護受給者等雇用開発コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKUTEI-SEIKATSU', '特定求職者雇用開発助成金（生活保護受給者等雇用開発コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKUTEI-SEIKATSU', 'manual', '特定求職者雇用開発助成金（生活保護受給者等雇用開発コース）', 'TOKUTEI-SEIKATSU', 90, 600000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"特定求職者雇用開発助成金（生活保護受給者等雇用開発コース）","category":"就労支援","issuer":"厚生労働省","summary":"生活保護受給者等をハローワーク等の紹介により雇い入れた場合に助成","max_amount":"60万円（中小企業）","requirements":["ハローワーク等の紹介","継続雇用"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_seikatsu.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 8. 特定求職者雇用開発助成金（成長分野等人材確保・育成コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TOKUTEI-SEICHOU', '特定求職者雇用開発助成金（成長分野等人材確保・育成コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TOKUTEI-SEICHOU', 'manual', '特定求職者雇用開発助成金（成長分野等人材確保・育成コース）', 'TOKUTEI-SEICHOU', 90, 3600000, '定額', 'デジタル・グリーン等成長分野', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"特定求職者雇用開発助成金（成長分野等人材確保・育成コース）","category":"成長分野人材","issuer":"厚生労働省","summary":"就職困難者をデジタル・グリーン等の成長分野の業務に従事させ、人材育成を行う場合に通常コースより高額の助成","max_amount":"最大360万円","target":"成長分野で就職困難者を雇用・育成する事業主","requirements":["成長分野での雇用","OJT・Off-JT実施","ハローワーク等の紹介"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_seichou.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 9. トライアル雇用助成金（障害者トライアルコース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TRIAL-SHOUGAI', 'トライアル雇用助成金（障害者トライアルコース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TRIAL-SHOUGAI', 'manual', 'トライアル雇用助成金（障害者トライアルコース）', 'TRIAL-SHOUGAI', 90, 96000, '定額月額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"トライアル雇用助成金（障害者トライアルコース）","category":"障害者雇用","issuer":"厚生労働省","summary":"障害者を試行的に雇い入れ、適性や能力を見極めた上で継続雇用への移行を目指す場合に助成","max_amount":"月額最大8,000円×最長3か月（精神障害者は月額最大8,000円×最長6か月）","requirements":["ハローワーク等の紹介","トライアル雇用計画書の提出"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/trial_shougai.html","contact":"ハローワーク"}'));

-- ============================================================
-- 10. 地域雇用開発助成金（地域雇用開発コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHIIKI-KOYOU', '地域雇用開発助成金（地域雇用開発コース）', 'MHLW', '厚生労働省', 'employment,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHIIKI-KOYOU', 'manual', '地域雇用開発助成金（地域雇用開発コース）', 'CHIIKI-KOYOU', 90, 8000000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"地域雇用開発助成金（地域雇用開発コース）","category":"地域雇用","issuer":"厚生労働省","summary":"雇用機会が不足している地域等で事業所の設置・整備を行い、地域の求職者を雇い入れた場合に助成","max_amount":"48万円～800万円（設備投資額・雇用増加数による3回まで支給）","target":"同意雇用開発促進地域等の事業主","requirements":["対象地域での事業所設置・整備","地域求職者の雇入れ","計画書の提出"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/chiiki/index.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 11. 人材確保等支援助成金（雇用管理制度助成コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-KAKUHO-KANRI', '人材確保等支援助成金（雇用管理制度助成コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-KAKUHO-KANRI', 'manual', '人材確保等支援助成金（雇用管理制度助成コース）', 'JINZAI-KAKUHO-KANRI', 90, 570000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材確保等支援助成金（雇用管理制度助成コース）","category":"離職率低下","issuer":"厚生労働省","summary":"評価・処遇制度、研修制度、健康づくり制度、メンター制度、短時間正社員制度を導入し離職率を低下させた場合に助成","max_amount":"57万円","target":"離職率低下に取り組む事業主","requirements":["雇用管理制度の導入・実施","離職率の目標達成","計画書の提出"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199292.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 12. 人材確保等支援助成金（中小企業団体助成コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-KAKUHO-DANTAI', '人材確保等支援助成金（中小企業団体助成コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-KAKUHO-DANTAI', 'manual', '人材確保等支援助成金（中小企業団体助成コース）', 'JINZAI-KAKUHO-DANTAI', 90, 10000000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材確保等支援助成金（中小企業団体助成コース）","category":"団体人材確保","issuer":"厚生労働省","summary":"事業協同組合等の中小企業団体が、構成中小企業の人材確保・定着に係る事業を実施した場合に助成","max_amount":"大規模認定組合等1,000万円、中規模500万円、小規模400万円","subsidy_rate":"2/3","application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199292.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 13. 人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-KAKUHO-KENSETSU', '人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）', 'MHLW', '厚生労働省', 'construction,employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-KAKUHO-KENSETSU', 'manual', '人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）', 'JINZAI-KAKUHO-KENSETSU', 90, 0, '定額', '建設業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）","category":"建設業人材","issuer":"厚生労働省","summary":"建設事業主団体がCCUS等の普及促進活動を実施した場合に経費の一部を助成","target":"建設事業主団体","requirements":["建設キャリアアップシステムの普及促進活動","計画書提出"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199292.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 14. 人材確保等支援助成金（テレワークコース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-KAKUHO-TELEWORK', '人材確保等支援助成金（テレワークコース）', 'MHLW', '厚生労働省', 'workstyle,employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-KAKUHO-TELEWORK', 'manual', '人材確保等支援助成金（テレワークコース）', 'JINZAI-KAKUHO-TELEWORK', 90, 1000000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材確保等支援助成金（テレワークコース）","category":"テレワーク","issuer":"厚生労働省","summary":"良質なテレワークを制度として導入・実施することにより、労働者の人材確保・雇用管理改善等を図る中小企業事業主に助成","max_amount":"機器等導入助成: 1企業100万円（20万円×対象労働者数）、目標達成助成: 1企業100万円","subsidy_rate":"機器等導入助成30%、目標達成助成20%","requirements":["テレワーク実施計画の作成","テレワーク用通信機器等の導入","テレワーク勤務の実施"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/telework_zyosei_R3.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 15. 人材確保等支援助成金（外国人労働者就労環境整備助成コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-KAKUHO-GAIKOKU', '人材確保等支援助成金（外国人労働者就労環境整備助成コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-KAKUHO-GAIKOKU', 'manual', '人材確保等支援助成金（外国人労働者就労環境整備助成コース）', 'JINZAI-KAKUHO-GAIKOKU', 90, 720000, '1/2～2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材確保等支援助成金（外国人労働者就労環境整備助成コース）","category":"外国人雇用","issuer":"厚生労働省","summary":"外国人特有の事情に配慮した就労環境の整備（通訳費、翻訳機器導入、社労士委託等）を通じて外国人労働者の職場定着を図る事業主に助成","max_amount":"72万円（賃金要件を満たす場合）","subsidy_rate":"1/2（賃金要件満たす場合2/3）","requirements":["外国人労働者の雇用","就労環境整備計画の作成","離職率目標の達成"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/gaikokujin.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 16. 通年雇用助成金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('TSUUNEN-KOYOU', '通年雇用助成金', 'MHLW', '厚生労働省', 'employment,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('TSUUNEN-KOYOU', 'manual', '通年雇用助成金', 'TSUUNEN-KOYOU', 90, 710000, '定額', '季節的業務を行う事業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"通年雇用助成金","category":"通年雇用促進","issuer":"厚生労働省","summary":"北海道・東北等の積雪寒冷地において季節的業務に従事する労働者を通年雇用した場合に助成","max_amount":"71万円/人","target":"積雪寒冷地の季節的業務事業主","target_area":"北海道、青森、岩手、秋田、山形、新潟等","application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tsuunen.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 17. 65歳超雇用推進助成金（65歳超継続雇用促進コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KOUREISHA-KEIZOKU', '65歳超雇用推進助成金（65歳超継続雇用促進コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KOUREISHA-KEIZOKU', 'manual', '65歳超雇用推進助成金（65歳超継続雇用促進コース）', 'KOUREISHA-KEIZOKU', 90, 1600000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"65歳超雇用推進助成金（65歳超継続雇用促進コース）","category":"高齢者雇用","issuer":"厚生労働省","summary":"65歳以上への定年引上げ、定年の定めの廃止、66歳以上の継続雇用制度の導入のいずれかを実施した場合に助成","max_amount":"15万円～160万円（措置内容・引上げ年齢・60歳以上被保険者数による）","requirements":["就業規則の変更","労基署への届出","60歳以上の被保険者が1人以上"],"application_period":"制度導入後6か月以内","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000139692.html","contact":"独立行政法人高齢・障害・求職者雇用支援機構"}'));

-- ============================================================
-- 18. 65歳超雇用推進助成金（高年齢者評価制度等雇用管理改善コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KOUREISHA-HYOUKA', '65歳超雇用推進助成金（高年齢者評価制度等雇用管理改善コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KOUREISHA-HYOUKA', 'manual', '65歳超雇用推進助成金（高年齢者評価制度等雇用管理改善コース）', 'KOUREISHA-HYOUKA', 90, 500000, '60%', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"65歳超雇用推進助成金（高年齢者評価制度等雇用管理改善コース）","category":"高齢者雇用","issuer":"厚生労働省","summary":"高年齢者の雇用管理制度（評価制度・賃金制度・労働時間制度等）の整備を行った場合に助成","max_amount":"50万円","subsidy_rate":"中小企業60%、大企業45%","requirements":["雇用管理整備計画の作成","高年齢者の雇用管理制度の導入・改善"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000139692.html","contact":"独立行政法人高齢・障害・求職者雇用支援機構"}'));

-- ============================================================
-- 19. キャリアアップ助成金（賃金規定等改定コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CAREER-UP-CHINGIN', 'キャリアアップ助成金（賃金規定等改定コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CAREER-UP-CHINGIN', 'manual', 'キャリアアップ助成金（賃金規定等改定コース）', 'CAREER-UP-CHINGIN', 90, 65000, '定額/人', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"キャリアアップ助成金（賃金規定等改定コース）","category":"非正規処遇改善","issuer":"厚生労働省","summary":"有期雇用労働者等の基本給の賃金規定等を3%以上増額改定した場合に助成","max_amount":"1人あたり5万円（中小企業）、5%以上は6.5万円","target":"有期雇用労働者の賃金改定を行う事業主","requirements":["キャリアアップ計画の作成","賃金規定等の3%以上増額改定","6か月以上の適用"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 20. キャリアアップ助成金（賞与・退職金制度導入コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CAREER-UP-SHOUYO', 'キャリアアップ助成金（賞与・退職金制度導入コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CAREER-UP-SHOUYO', 'manual', 'キャリアアップ助成金（賞与・退職金制度導入コース）', 'CAREER-UP-SHOUYO', 90, 568000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"キャリアアップ助成金（賞与・退職金制度導入コース）","category":"非正規処遇改善","issuer":"厚生労働省","summary":"有期雇用労働者等に対し新たに賞与・退職金制度を導入し支給又は積立てを実施した場合に助成","max_amount":"1事業所あたり40万円（両方同時導入で56.8万円）","requirements":["キャリアアップ計画","賞与又は退職金制度の新規導入","6か月以上の運用"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 21. キャリアアップ助成金（社会保険適用時処遇改善コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CAREER-UP-SHAKAI', 'キャリアアップ助成金（社会保険適用時処遇改善コース）', 'MHLW', '厚生労働省', 'employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CAREER-UP-SHAKAI', 'manual', 'キャリアアップ助成金（社会保険適用時処遇改善コース）', 'CAREER-UP-SHAKAI', 90, 500000, '定額/人', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"キャリアアップ助成金（社会保険適用時処遇改善コース）","category":"社保適用","issuer":"厚生労働省","summary":"短時間労働者が新たに社会保険に加入する際に、手取り収入が減少しないよう処遇改善を行った事業主に助成","max_amount":"1人あたり最大50万円（3年間合計）","target":"社会保険適用に伴う処遇改善を行う事業主","requirements":["キャリアアップ計画","社会保険新規加入","処遇改善措置の実施"],"application_period":"通年（2026年3月末まで）","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","contact":"都道府県労働局・ハローワーク","notes":"年収の壁対策パッケージの一環"}'));

-- ============================================================
-- 22. 両立支援等助成金（介護離職防止支援コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('RYOURITSU-KAIGO', '両立支援等助成金（介護離職防止支援コース）', 'MHLW', '厚生労働省', 'worklife_balance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('RYOURITSU-KAIGO', 'manual', '両立支援等助成金（介護離職防止支援コース）', 'RYOURITSU-KAIGO', 90, 600000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"両立支援等助成金（介護離職防止支援コース）","category":"仕事と介護の両立","issuer":"厚生労働省","summary":"介護休業の取得・復帰支援プランの策定・実施、介護両立支援制度の導入を行った場合に助成","max_amount":"休業取得時40万円＋復帰時40万円、制度導入20万円","requirements":["介護支援プランの策定","対象従業員の介護休業取得・復帰","両立支援制度の導入"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 23. 両立支援等助成金（育児休業等支援コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('RYOURITSU-IKUKYU', '両立支援等助成金（育児休業等支援コース）', 'MHLW', '厚生労働省', 'worklife_balance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('RYOURITSU-IKUKYU', 'manual', '両立支援等助成金（育児休業等支援コース）', 'RYOURITSU-IKUKYU', 90, 600000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"両立支援等助成金（育児休業等支援コース）","category":"仕事と育児の両立","issuer":"厚生労働省","summary":"育休復帰支援プランを作成し、育児休業の円滑な取得・復帰を支援した場合に助成","max_amount":"休業取得時30万円＋復帰時30万円","requirements":["育休復帰支援プランの策定","対象従業員の育児休業取得・復帰"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 24. 両立支援等助成金（不妊治療両立支援コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('RYOURITSU-FUNIN', '両立支援等助成金（不妊治療両立支援コース）', 'MHLW', '厚生労働省', 'worklife_balance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('RYOURITSU-FUNIN', 'manual', '両立支援等助成金（不妊治療両立支援コース）', 'RYOURITSU-FUNIN', 90, 300000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"両立支援等助成金（不妊治療両立支援コース）","category":"不妊治療支援","issuer":"厚生労働省","summary":"不妊治療のための休暇制度・両立支援制度を導入し、利用者が出た場合に助成","max_amount":"環境整備・休暇取得等30万円","requirements":["不妊治療両立支援制度の導入","対象従業員の制度利用"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 25. 人材開発支援助成金（教育訓練休暇等付与コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-KYUUKA', '人材開発支援助成金（教育訓練休暇等付与コース）', 'MHLW', '厚生労働省', 'training', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-KYUUKA', 'manual', '人材開発支援助成金（教育訓練休暇等付与コース）', 'JINZAI-KYUUKA', 90, 360000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材開発支援助成金（教育訓練休暇等付与コース）","category":"教育訓練","issuer":"厚生労働省","summary":"有給の教育訓練休暇制度を導入し、労働者が当該休暇を取得して訓練を受けた場合に助成","max_amount":"36万円（長期教育訓練休暇制度は賃金助成6,000円/日も追加）","requirements":["教育訓練休暇制度の導入","就業規則への明記","制度の利用実績"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 26. 人材開発支援助成金（人への投資促進コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JINZAI-HITO-TOUSHI', '人材開発支援助成金（人への投資促進コース）', 'MHLW', '厚生労働省', 'training,digital', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JINZAI-HITO-TOUSHI', 'manual', '人材開発支援助成金（人への投資促進コース）', 'JINZAI-HITO-TOUSHI', 90, 15000000, '75%', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"人材開発支援助成金（人への投資促進コース）","category":"デジタル人材・高度人材育成","issuer":"厚生労働省","summary":"デジタル人材・高度人材の育成、労働者の自発的能力開発、定額制訓練（サブスク型）などに対する訓練経費・賃金の助成","max_amount":"経費助成: 1事業所年間1,500万円","subsidy_rate":"経費助成75%（中小企業）、賃金助成960円/時間","sub_courses":["高度デジタル人材訓練","成長分野等人材訓練","情報技術分野認定実習併用職業訓練","定額制訓練","自発的職業能力開発訓練"],"requirements":["事業内職業能力開発計画の策定","訓練実施計画届の提出"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","contact":"都道府県労働局・ハローワーク"}'));

-- ============================================================
-- 27. 働き方改革推進支援助成金（適用猶予業種等対応コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('HATARAKIKATA-TEKIYOU', '働き方改革推進支援助成金（適用猶予業種等対応コース）', 'MHLW', '厚生労働省', 'workstyle', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('HATARAKIKATA-TEKIYOU', 'manual', '働き方改革推進支援助成金（適用猶予業種等対応コース）', 'HATARAKIKATA-TEKIYOU', 90, 5000000, '3/4', '建設・運輸・医師等', '2025-04-01', '2025-11-30',
datetime('now', '+180 days'),
json('{"name":"働き方改革推進支援助成金（適用猶予業種等対応コース）","category":"働き方改革","issuer":"厚生労働省","summary":"2024年4月から時間外労働の上限規制が適用された建設業、運輸業、医師等の事業場が労働時間の縮減に取り組む場合に助成","max_amount":"最大500万円","subsidy_rate":"3/4","target":"建設業・運輸業（トラック/バス/タクシー）・病院等・砂糖製造業","requirements":["36協定の締結","時間外労働の縮減目標設定","成果目標の達成"],"application_period":"2025年4月～11月（予定）","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 28. 働き方改革推進支援助成金（団体推進コース）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('HATARAKIKATA-DANTAI', '働き方改革推進支援助成金（団体推進コース）', 'MHLW', '厚生労働省', 'workstyle', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('HATARAKIKATA-DANTAI', 'manual', '働き方改革推進支援助成金（団体推進コース）', 'HATARAKIKATA-DANTAI', 90, 5000000, '定額', '全業種（団体）', '2025-04-01', '2025-11-30',
datetime('now', '+180 days'),
json('{"name":"働き方改革推進支援助成金（団体推進コース）","category":"働き方改革","issuer":"厚生労働省","summary":"中小企業の事業主団体が、構成事業主の労働条件の改善のために取組を行った場合に助成","max_amount":"500万円","subsidy_rate":"定額","requirements":["事業主団体であること","構成事業主への支援事業の実施"],"application_period":"2025年4月～11月（予定）","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 29. 受動喫煙防止対策助成金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JUDOU-KITSUEN', '受動喫煙防止対策助成金', 'MHLW', '厚生労働省', 'workplace_safety', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JUDOU-KITSUEN', 'manual', '受動喫煙防止対策助成金', 'JUDOU-KITSUEN', 90, 1000000, '1/2', '飲食業・旅館業等', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"受動喫煙防止対策助成金","category":"職場環境改善","issuer":"厚生労働省","summary":"中小企業事業主が受動喫煙防止のための喫煙室の設置等を行った場合に助成","max_amount":"100万円","subsidy_rate":"1/2","requirements":["中小企業事業主","喫煙室の設置等"],"application_period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000049868.html","contact":"都道府県労働局"}'));

-- ============================================================
-- 30. 障害者雇用納付金制度に基づく各種助成金（障害者作業施設設置等助成金）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHOUGAI-SHISETSU', '障害者作業施設設置等助成金', 'MHLW', '厚生労働省（JEED）', 'employment,disability', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHOUGAI-SHISETSU', 'manual', '障害者作業施設設置等助成金', 'SHOUGAI-SHISETSU', 90, 4500000, '2/3', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"障害者作業施設設置等助成金","category":"障害者雇用","issuer":"独立行政法人高齢・障害・求職者雇用支援機構（JEED）","summary":"障害者の雇用に伴い必要な施設・設備の設置・整備を行った場合に助成","max_amount":"450万円/人（第1種）","subsidy_rate":"2/3","requirements":["障害者の雇用","作業施設等の設置・整備"],"application_period":"通年","url":"https://www.jeed.go.jp/disability/subsidy/index.html","contact":"JEED各都道府県支部"}'));

-- ============================================================
-- 31. 障害者介助等助成金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHOUGAI-KAIJO', '障害者介助等助成金', 'MHLW', '厚生労働省（JEED）', 'employment,disability', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHOUGAI-KAIJO', 'manual', '障害者介助等助成金', 'SHOUGAI-KAIJO', 90, 1500000, '3/4', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"障害者介助等助成金","category":"障害者雇用","issuer":"独立行政法人高齢・障害・求職者雇用支援機構（JEED）","summary":"障害者の雇用管理のために必要な介助者の配置等を行った場合に助成","max_amount":"月額15万円等","subsidy_rate":"3/4","requirements":["障害者の雇用","介助者等の配置"],"application_period":"通年","url":"https://www.jeed.go.jp/disability/subsidy/index.html","contact":"JEED各都道府県支部"}'));

-- ============================================================
-- 32. クリーンエネルギー自動車導入促進補助金（CEV補助金）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CEV-HOJO', 'クリーンエネルギー自動車導入促進補助金（CEV補助金）', 'METI', '経済産業省', 'green,equipment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CEV-HOJO', 'manual', 'クリーンエネルギー自動車導入促進補助金（CEV補助金）', 'CEV-HOJO', 90, 850000, '定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"クリーンエネルギー自動車導入促進補助金（CEV補助金）","category":"脱炭素・自動車","issuer":"経済産業省","summary":"電気自動車（EV）、プラグインハイブリッド車（PHEV）、燃料電池自動車（FCV）等の購入を支援","max_amount":"EV: 最大85万円、軽EV: 最大55万円、PHEV: 最大55万円、FCV: 最大255万円","target":"個人・法人問わず","requirements":["対象車両の新車購入","初度登録から1年以上の保有","自家用登録"],"application_period":"予算なくなり次第終了","url":"https://www.cev-pc.or.jp/","contact":"次世代自動車振興センター","notes":"令和6年度補正予算で継続"}'));

-- ============================================================
-- 33. 充電・充填インフラ等導入促進補助金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JUUDEN-INFRA', '充電・充填インフラ等導入促進補助金', 'METI', '経済産業省', 'green,equipment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JUUDEN-INFRA', 'manual', '充電・充填インフラ等導入促進補助金', 'JUUDEN-INFRA', 90, 0, '1/2～定額', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"充電・充填インフラ等導入促進補助金","category":"EV充電インフラ","issuer":"経済産業省","summary":"EV・PHEV用充電設備、水素ステーション等の設置を支援","subsidy_rate":"充電設備の購入費・工事費の1/2等","target":"充電設備を設置する事業者・マンション管理組合等","requirements":["充電設備の設置","一定期間の運用"],"application_period":"通年（予算なくなり次第終了）","url":"https://www.cev-pc.or.jp/","contact":"次世代自動車振興センター"}'));

-- ============================================================
-- 34. 先端半導体助成金（半導体関連設備投資助成）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('HANDOUTAI-SENTAN', '先端半導体関連設備投資助成', 'METI', '経済産業省', 'manufacturing,innovation', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('HANDOUTAI-SENTAN', 'manual', '先端半導体関連設備投資助成（ポスト5G基金等）', 'HANDOUTAI-SENTAN', 90, 0, '1/3～1/2', '半導体・電子部品製造業', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"先端半導体関連設備投資助成","category":"半導体・先端技術","issuer":"経済産業省","summary":"先端半導体の国内製造基盤確立のための大規模設備投資を支援（TSMC熊本、Rapidus北海道等）","subsidy_rate":"1/3～1/2","target":"半導体製造・関連部材メーカー","requirements":["先端半導体の製造に係る設備投資","国内での生産拠点確立"],"notes":"個別大型案件は数千億円規模、中小向けは関連サプライチェーン支援として別途枠あり","url":"https://www.meti.go.jp/policy/mono_info_service/joho/semiconductor.html","contact":"経済産業省商務情報政策局"}'));

-- ============================================================
-- 35. 蓄電池産業支援（蓄電池に係る供給確保計画）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHIKUDENCHI-KYOUKYU', '蓄電池産業支援（供給確保計画認定）', 'METI', '経済産業省', 'green,manufacturing', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHIKUDENCHI-KYOUKYU', 'manual', '蓄電池産業支援（供給確保計画認定）', 'CHIKUDENCHI-KYOUKYU', 90, 0, '1/3', '蓄電池製造・材料', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"蓄電池産業支援（供給確保計画認定）","category":"経済安全保障・蓄電池","issuer":"経済産業省","summary":"経済安全保障推進法に基づく蓄電池の供給確保計画の認定を受けた事業者への設備投資支援","subsidy_rate":"最大1/3","target":"蓄電池・部素材メーカー","requirements":["供給確保計画の認定","国内生産基盤の強化"],"url":"https://www.meti.go.jp/policy/mono_info_service/joho/battery.html","contact":"経済産業省"}'));

-- ============================================================
-- 36. 中小企業等経営強化法に基づく経営力向上計画（税制措置）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KEIEI-KYOUKA-ZEISEI', '経営力向上計画（税制優遇措置）', 'METI', '経済産業省・中小企業庁', 'tax,management', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KEIEI-KYOUKA-ZEISEI', 'manual', '経営力向上計画（税制優遇措置）', 'KEIEI-KYOUKA-ZEISEI', 90, 0, '即時償却or税額控除10%', '全業種', '2025-04-01', '2027-03-31',
datetime('now', '+180 days'),
json('{"name":"経営力向上計画（税制優遇措置）","category":"税制優遇","issuer":"経済産業省・中小企業庁","summary":"中小企業等経営強化法に基づく経営力向上計画の認定を受けることで、設備投資に対する即時償却又は税額控除（10%又は7%）の優遇措置","benefits":"即時償却 or 取得価額の10%税額控除（資本金3,000万円超1億円以下は7%）","target":"中小企業者等","requirements":["経営力向上計画の策定・認定","対象設備の取得"],"対象設備":"生産性向上設備（A類型）、収益力強化設備（B類型）、デジタル化設備（C類型）、経営資源集約化設備（D類型）","application_period":"通年","url":"https://www.chusho.meti.go.jp/keiei/kyoka/","contact":"各経済産業局、中小企業庁"}'));

-- ============================================================
-- 37. 中小企業投資促進税制
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHUSHO-TOUSHI-ZEISEI', '中小企業投資促進税制', 'METI', '経済産業省', 'tax', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHUSHO-TOUSHI-ZEISEI', 'manual', '中小企業投資促進税制', 'CHUSHO-TOUSHI-ZEISEI', 90, 0, '30%特別償却or7%税額控除', '全業種', '2025-04-01', '2027-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業投資促進税制","category":"税制優遇","issuer":"経済産業省","summary":"中小企業が機械装置等を取得した場合に30%の特別償却又は7%の税額控除を認める制度","benefits":"30%特別償却 or 7%税額控除","target":"資本金1億円以下の中小企業者等","対象設備":"機械装置（160万円以上）、測定工具・検査工具（120万円以上）、一定のソフトウェア（70万円以上）等","application_period":"2027年3月31日まで","url":"https://www.chusho.meti.go.jp/zaimu/zeisei/","contact":"税務署、中小企業庁"}'));

-- ============================================================
-- 38. 事業再構築補助金（サプライチェーン強靱化枠）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SAIKOUCHIKU-SUPPLY', '事業再構築補助金（サプライチェーン強靱化枠）', 'METI', '経済産業省', 'restructuring', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SAIKOUCHIKU-SUPPLY', 'manual', '事業再構築補助金（サプライチェーン強靱化枠）', 'SAIKOUCHIKU-SUPPLY', 90, 5000000000, '1/2', '製造業等', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"事業再構築補助金（サプライチェーン強靱化枠）","category":"サプライチェーン強化","issuer":"経済産業省","summary":"海外で製造する部品等の国内回帰や、国内サプライチェーンの強靱化に取り組む事業者を支援","max_amount":"最大50億円","subsidy_rate":"1/2","target":"サプライチェーン強靱化に取り組む中小企業等","requirements":["国内回帰・サプライチェーン強化計画","市場縮小等の外部環境変化"],"application_period":"公募時期による","url":"https://jigyou-saikouchiku.go.jp/","contact":"事業再構築補助金事務局"}'));

-- ============================================================
-- 39. 地域未来投資促進税制
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHIIKI-MIRAI-ZEISEI', '地域未来投資促進税制', 'METI', '経済産業省', 'tax,regional', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHIIKI-MIRAI-ZEISEI', 'manual', '地域未来投資促進税制', 'CHIIKI-MIRAI-ZEISEI', 90, 0, '特別償却or税額控除', '全業種', '2025-04-01', '2027-03-31',
datetime('now', '+180 days'),
json('{"name":"地域未来投資促進税制","category":"地域経済・税制優遇","issuer":"経済産業省","summary":"地域経済牽引事業計画の承認を受けた事業者が対象設備を取得した場合に特別償却又は税額控除の優遇","benefits":"特別償却40%（建物等20%） or 税額控除4%（建物等2%）","target":"地域経済牽引事業計画の承認を受けた事業者","requirements":["地域経済牽引事業計画の策定・承認","対象設備の取得"],"application_period":"2027年3月末まで","url":"https://www.meti.go.jp/policy/sme_chiiki/chiiki_mirai_toushi/index.html","contact":"各経済産業局"}'));

-- ============================================================
-- 40. 中小企業防災・減災投資促進税制（事業継続力強化計画）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('BOUSAI-ZEISEI', '中小企業防災・減災投資促進税制', 'METI', '経済産業省', 'tax,disaster', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('BOUSAI-ZEISEI', 'manual', '中小企業防災・減災投資促進税制（事業継続力強化計画）', 'BOUSAI-ZEISEI', 90, 0, '20%特別償却', '全業種', '2025-04-01', '2027-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業防災・減災投資促進税制","category":"BCP・防災","issuer":"経済産業省・中小企業庁","summary":"事業継続力強化計画の認定を受けた中小企業が防災・減災設備を取得した場合に20%の特別償却","benefits":"20%特別償却","target":"事業継続力強化計画の認定を受けた中小企業者","対象設備":"自家発電機、防火・防水シャッター、排水ポンプ、止水板、サーバー等","requirements":["事業継続力強化計画の認定"],"application_period":"2027年3月末まで","url":"https://www.chusho.meti.go.jp/keiei/antei/bousai/keizokuryoku.html","contact":"各経済産業局、中小企業庁"}'));

-- ============================================================
-- 41. 小規模事業者経営改善資金融資制度（マル経融資）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('MARUKEI-YUSHI', 'マル経融資（経営改善貸付）', 'METI', '日本政策金融公庫', 'finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('MARUKEI-YUSHI', 'manual', 'マル経融資（小規模事業者経営改善資金融資制度）', 'MARUKEI-YUSHI', 90, 20000000, '低金利融資', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"マル経融資（小規模事業者経営改善資金融資制度）","category":"融資","issuer":"日本政策金融公庫（商工会議所・商工会推薦）","summary":"商工会議所・商工会の経営指導を受けた小規模事業者が無担保・無保証人で利用できる低金利融資","max_amount":"2,000万円","interest_rate":"特別利率（約1.2%前後、変動あり）","target":"小規模事業者（従業員20人以下、商業・サービス業5人以下）","requirements":["商工会議所・商工会の経営指導を6か月以上受けている","同一地区で1年以上事業を行っている","税金を完納"],"application_period":"通年","url":"https://www.jfc.go.jp/n/finance/search/kaizen_m.html","contact":"日本政策金融公庫、最寄りの商工会議所・商工会"}'));

-- ============================================================
-- 42. 新創業融資制度（日本政策金融公庫）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SHINSOUGYOU-YUSHI', '新創業融資制度', 'JFC', '日本政策金融公庫', 'finance,startup', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SHINSOUGYOU-YUSHI', 'manual', '新創業融資制度（日本政策金融公庫）', 'SHINSOUGYOU-YUSHI', 90, 72000000, '低金利融資', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"新創業融資制度","category":"創業融資","issuer":"日本政策金融公庫","summary":"新たに事業を始める方や事業開始後税務申告を2期終えていない方を対象とした無担保・無保証人の融資制度","max_amount":"7,200万円（うち運転資金4,800万円）","target":"創業予定者・創業後2期以内","requirements":["創業計画書の作成","自己資金要件（原則1/10以上）"],"application_period":"通年","url":"https://www.jfc.go.jp/n/finance/search/04_shinsogyo_m.html","contact":"日本政策金融公庫各支店"}'));

-- ============================================================
-- 43. 中小企業経営力強化資金
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KEIEI-KYOUKA-YUSHI', '中小企業経営力強化資金', 'JFC', '日本政策金融公庫', 'finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KEIEI-KYOUKA-YUSHI', 'manual', '中小企業経営力強化資金', 'KEIEI-KYOUKA-YUSHI', 90, 72000000, '低金利融資', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"中小企業経営力強化資金","category":"融資","issuer":"日本政策金融公庫","summary":"認定経営革新等支援機関の支援を受けて事業計画を策定する中小企業向けの特別貸付","max_amount":"7,200万円（うち運転資金4,800万円）","interest_rate":"基準利率-0.9%程度","target":"認定支援機関の支援を受ける中小企業者","requirements":["認定支援機関の確認書","事業計画書"],"application_period":"通年","url":"https://www.jfc.go.jp/n/finance/search/64.html","contact":"日本政策金融公庫各支店"}'));

-- ============================================================
-- 44. 事業環境変化対応型資金（セーフティネット貸付）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SAFETYNET-KASHITSUKE', 'セーフティネット貸付（経営環境変化対応資金）', 'JFC', '日本政策金融公庫', 'finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SAFETYNET-KASHITSUKE', 'manual', 'セーフティネット貸付（経営環境変化対応資金）', 'SAFETYNET-KASHITSUKE', 90, 48000000, '低金利融資', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"セーフティネット貸付（経営環境変化対応資金）","category":"経営安定融資","issuer":"日本政策金融公庫","summary":"社会的・経済的環境の変化等により、一時的に業況が悪化している中小企業向けの融資制度","max_amount":"4,800万円","target":"売上減少等で一時的に業況悪化中の中小企業","requirements":["最近の決算で売上減少等","事業計画書"],"application_period":"通年","url":"https://www.jfc.go.jp/n/finance/search/07_keieianntei_m.html","contact":"日本政策金融公庫各支店"}'));

-- ============================================================
-- 45. セーフティネット保証（信用保証協会）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('SAFETYNET-HOSHOU', 'セーフティネット保証制度', 'METI', '中小企業庁（信用保証協会）', 'finance', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('SAFETYNET-HOSHOU', 'manual', 'セーフティネット保証制度', 'SAFETYNET-HOSHOU', 90, 280000000, '100%保証', '全業種', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"セーフティネット保証制度","category":"信用保証","issuer":"中小企業庁・各信用保証協会","summary":"取引先の倒産、自然災害、売上減少等により経営の安定に支障をきたしている中小企業の資金繰りを支援する特別保証制度","guarantee_limit":"一般保証枠とは別枠で最大2.8億円","types":"1号（連鎖倒産防止）、2号（取引先縮小）、4号（突発的災害）、5号（業況悪化業種）等","target":"経営の安定に支障をきたしている中小企業","requirements":["市区町村長の認定","信用保証協会の審査"],"application_period":"通年","url":"https://www.chusho.meti.go.jp/kinyu/sefu_net/index.html","contact":"最寄りの信用保証協会、市区町村"}'));

-- ============================================================
-- 46. 住宅省エネ2025キャンペーン（子育てグリーン住宅支援事業）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('JYUTAKU-SHOUENE-2025', '子育てグリーン住宅支援事業（住宅省エネ2025）', 'MLIT', '国土交通省', 'housing,green', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('JYUTAKU-SHOUENE-2025', 'manual', '子育てグリーン住宅支援事業（住宅省エネ2025キャンペーン）', 'JYUTAKU-SHOUENE-2025', 90, 1600000, '定額', '住宅・建設業', '2025-04-01', '2025-12-31',
datetime('now', '+180 days'),
json('{"name":"子育てグリーン住宅支援事業","category":"住宅省エネ","issuer":"国土交通省","summary":"子育て世帯・若者夫婦世帯による高い省エネ性能を有する新築住宅の取得や、住宅の省エネリフォームを支援","max_amount":"新築: 最大160万円（GX志向型）、リフォーム: 最大60万円","target":"子育て世帯・若者夫婦世帯（新築）、全世帯（リフォーム）","requirements":["省エネ基準適合住宅の新築又はリフォーム","登録事業者による施工"],"application_period":"2025年4月～（予算なくなり次第終了）","url":"https://kosodate-green.mlit.go.jp/","contact":"住宅省エネ2025キャンペーン補助金事務局"}'));

-- ============================================================
-- 47. 先進的窓リノベ2025事業
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('MADO-RINOBE-2025', '先進的窓リノベ2025事業', 'MOE', '環境省', 'housing,green', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('MADO-RINOBE-2025', 'manual', '先進的窓リノベ2025事業', 'MADO-RINOBE-2025', 90, 2000000, '定額', '全業種・個人', '2025-04-01', '2025-12-31',
datetime('now', '+180 days'),
json('{"name":"先進的窓リノベ2025事業","category":"窓断熱リノベ","issuer":"環境省","summary":"既存住宅の窓の断熱改修（内窓設置、外窓交換等）に対する補助","max_amount":"最大200万円/戸","target":"住宅の窓の断熱改修を行う個人・法人","requirements":["登録事業者による施工","対象製品の使用"],"application_period":"2025年4月～（予算なくなり次第終了）","url":"https://window-renovation2025.env.go.jp/","contact":"先進的窓リノベ事業事務局"}'));

-- ============================================================
-- 48. 給湯省エネ2025事業（高効率給湯器導入促進）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('KYUUTOU-SHOUENE-2025', '給湯省エネ2025事業', 'METI', '経済産業省', 'housing,green', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('KYUUTOU-SHOUENE-2025', 'manual', '給湯省エネ2025事業（高効率給湯器導入促進）', 'KYUUTOU-SHOUENE-2025', 90, 200000, '定額', '全業種・個人', '2025-04-01', '2025-12-31',
datetime('now', '+180 days'),
json('{"name":"給湯省エネ2025事業","category":"給湯器省エネ","issuer":"経済産業省","summary":"高効率給湯器（エコキュート、ハイブリッド給湯器、エネファーム等）の導入を支援","max_amount":"エコキュート: 8万円、ハイブリッド給湯器: 10万円、エネファーム: 20万円","target":"住宅に高効率給湯器を設置する個人・法人","requirements":["対象製品の導入","登録事業者による施工"],"application_period":"2025年4月～（予算なくなり次第終了）","url":"https://kyutou-shoene2025.meti.go.jp/","contact":"給湯省エネ事業事務局"}'));

-- ============================================================
-- 49. 賃上げ促進税制（所得拡大促進税制）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('CHINAGE-ZEISEI', '賃上げ促進税制', 'METI', '経済産業省・財務省', 'tax,employment', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('CHINAGE-ZEISEI', 'manual', '賃上げ促進税制（旧所得拡大促進税制）', 'CHINAGE-ZEISEI', 90, 0, '最大45%税額控除', '全業種', '2025-04-01', '2027-03-31',
datetime('now', '+180 days'),
json('{"name":"賃上げ促進税制","category":"税制優遇・賃上げ","issuer":"経済産業省・財務省","summary":"従業員の給与等支給額を前年度比で一定割合以上増加させた場合に、増加額の一定割合を法人税から控除","benefits":"中小企業: 増加額の15%～45%を税額控除（1.5%以上増加で15%、2.5%以上で30%、教育訓練費増加10%加算、子育て支援5%加算）","target":"青色申告の法人・個人事業主","requirements":["給与等支給額の増加","確定申告時に適用"],"application_period":"2024年4月1日～2027年3月31日開始事業年度","url":"https://www.meti.go.jp/policy/economy/jinzai/syotokukakudaisokushin/syotokukakudai.html","contact":"税務署、中小企業庁"}'));

-- ============================================================
-- 50. 環境省 脱炭素化事業（工場・事業場における先導的脱炭素化推進事業）
-- ============================================================
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, category_codes, is_active)
VALUES ('DATSUTANSO-SENDOU', '工場・事業場における先導的脱炭素化推進事業', 'MOE', '環境省', 'green,energy', 1);
INSERT OR REPLACE INTO subsidy_cache (id, source, title, canonical_id, detail_score, subsidy_max_limit, subsidy_rate, target_industry, acceptance_start_datetime, acceptance_end_datetime, expires_at, detail_json)
VALUES ('DATSUTANSO-SENDOU', 'manual', '工場・事業場における先導的脱炭素化推進事業（SHIFT事業）', 'DATSUTANSO-SENDOU', 90, 100000000, '1/3～1/2', '製造業等', '2025-04-01', '2026-03-31',
datetime('now', '+180 days'),
json('{"name":"工場・事業場における先導的脱炭素化推進事業（SHIFT事業）","category":"脱炭素","issuer":"環境省","summary":"工場・事業場のCO2排出量削減目標を設定し、省CO2型設備への更新を行う事業者を支援","max_amount":"1億円","subsidy_rate":"CO2削減計画策定: 定額、設備更新: 1/3（中小は1/2）","requirements":["CO2排出量削減目標の設定","省CO2型設備への更新計画"],"application_period":"公募時期による","url":"https://shift.env.go.jp/","contact":"環境省地球環境局"}'));

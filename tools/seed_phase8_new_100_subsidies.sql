-- =====================================================
-- Phase 8: 新規補助金・助成金 100件一括登録
-- 既存35件に加え、未登録の重要な国の補助金・助成金を一気に追加
-- 情報源: 厚労省助成金一覧、経産省補助金一覧、環境省・国交省等
-- 更新日: 2026-02-08
-- =====================================================

-- ■ カテゴリA: 厚労省 雇用関係助成金（未登録コース）
-- =====================================================

-- A1. 雇用調整助成金
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KOYOU-CHOUSEI', 'manual', '雇用調整助成金', json('{"title":"雇用調整助成金","version":"令和7年度","subsidy_overview":"経済上の理由により事業活動の縮小を余儀なくされた事業主が、労働者に対して一時的に休業・教育訓練・出向を行い雇用維持を図った場合に助成","subsidy_amount":"休業手当等の2/3（中小）、1/2（大企業）、1日上限8,490円","target":"雇用保険適用事業主","application":"通年","contact":"ハローワーク","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KOYOU-CHOUSEI');

-- A2. 産業雇用安定助成金（産業連携人材確保等支援コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SANGYO-KOYOU-ANTEI', 'manual', '産業雇用安定助成金', json('{"title":"産業雇用安定助成金（産業連携人材確保等支援コース）","version":"令和7年度","subsidy_overview":"景気変動や産業構造の変化等の経済的理由により事業活動の一時的な縮小を余儀なくされた事業主が、生産性向上に資する取組等を行うため、他の事業主との間で在籍型出向を実施する場合に助成","subsidy_amount":"中小企業250万円/人、大企業200万円/人（年間最大5人まで）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000082805_00012.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SANGYO-KOYOU-ANTEI');

-- A3. 早期再就職支援等助成金（中途採用拡大コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SOUKI-SAISHUSHOKU-CHUTO', 'manual', '早期再就職支援等助成金（中途採用拡大コース）', json('{"title":"早期再就職支援等助成金（中途採用拡大コース）","version":"令和7年度","subsidy_overview":"中途採用者の雇用管理制度を整備し、中途採用の拡大を図った事業主に対して助成","subsidy_amount":"最大100万円","target":"中途採用率を一定以上拡大した事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000160737_00001.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SOUKI-SAISHUSHOKU-CHUTO');

-- A4. 特定求職者雇用開発助成金（特定就職困難者コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TOKUTEI-KONNANSHA', 'manual', '特定求職者雇用開発助成金（特定就職困難者コース）', json('{"title":"特定求職者雇用開発助成金（特定就職困難者コース）","version":"令和7年度","subsidy_overview":"高年齢者・障害者・母子家庭の母等の就職困難者をハローワーク等の紹介により継続して雇用する事業主に対して助成","subsidy_amount":"短時間以外：60万円～240万円、短時間：40万円～80万円（対象者区分・企業規模により異なる）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_konnan.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TOKUTEI-KONNANSHA');

-- A5. 特定求職者雇用開発助成金（発達障害者・難治性疾患患者雇用開発コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TOKUTEI-HATTATSU', 'manual', '特定求職者雇用開発助成金（発達障害者・難治性疾患患者雇用開発コース）', json('{"title":"特定求職者雇用開発助成金（発達障害者・難治性疾患患者雇用開発コース）","version":"令和7年度","subsidy_overview":"発達障害者や難治性疾患患者をハローワーク等の紹介により継続して雇用する事業主に対して助成","subsidy_amount":"中小企業120万円（短時間80万円）、大企業50万円（短時間30万円）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/hattatsu_nanchi.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TOKUTEI-HATTATSU');

-- A6. 特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TOKUTEI-HYOGAKI', 'manual', '特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）', json('{"title":"特定求職者雇用開発助成金（就職氷河期世代安定雇用実現コース）","version":"令和7年度","subsidy_overview":"就職氷河期世代（概ね1968年～1988年生まれ）の不安定就労者・無業者をハローワーク等の紹介により正規雇用する事業主に対して助成","subsidy_amount":"中小企業60万円、大企業50万円","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000158169_00001.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TOKUTEI-HYOGAKI');

-- A7. 特定求職者雇用開発助成金（生涯現役コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TOKUTEI-SHOUGAI-GENEKI', 'manual', '特定求職者雇用開発助成金（生涯現役コース）', json('{"title":"特定求職者雇用開発助成金（生涯現役コース）","version":"令和7年度","subsidy_overview":"65歳以上の離職者をハローワーク等の紹介により1年以上継続して雇用する事業主に対して助成","subsidy_amount":"短時間以外：中小企業70万円・大企業60万円、短時間：中小企業50万円・大企業40万円","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120693.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TOKUTEI-SHOUGAI-GENEKI');

-- A8. 特定求職者雇用開発助成金（成長分野等人材確保・育成コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TOKUTEI-SEICHOU-JINZAI', 'manual', '特定求職者雇用開発助成金（成長分野等人材確保・育成コース）', json('{"title":"特定求職者雇用開発助成金（成長分野等人材確保・育成コース）","version":"令和7年度","subsidy_overview":"就職困難者をデジタル・グリーン等の成長分野の業務に従事させ、人材育成を行う事業主に対して通常より高額の助成","subsidy_amount":"通常の特定求職者雇用開発助成金の1.5倍（例：高齢者90万円、障害者360万円等）","target":"成長分野の事業を行う雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_seichou.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TOKUTEI-SEICHOU-JINZAI');

-- A9. トライアル雇用助成金（障害者トライアルコース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TRIAL-SHOUGAISHA', 'manual', 'トライアル雇用助成金（障害者トライアルコース）', json('{"title":"トライアル雇用助成金（障害者トライアルコース）","version":"令和7年度","subsidy_overview":"障害者を試行的に雇い入れ、適性や能力を見極めた上で常用雇用への移行を目指す事業主に対して助成","subsidy_amount":"精神障害者：月額最大8万円（最長6か月）、その他障害者：月額最大4万円（最長3か月）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/trial_shougai.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TRIAL-SHOUGAISHA');

-- A10. 地域雇用開発助成金（地域雇用開発コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHIIKI-KOYOU', 'manual', '地域雇用開発助成金（地域雇用開発コース）', json('{"title":"地域雇用開発助成金（地域雇用開発コース）","version":"令和7年度","subsidy_overview":"雇用機会が特に不足している地域で事業所の設置・整備を行い、地域の求職者等を雇い入れた事業主に対して助成","subsidy_amount":"最大960万円（設置整備費用×雇入れ人数に応じた区分）、3回まで受給可能","target":"同意雇用開発促進地域等に事業所を設置する事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/chiiki_koyou.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHIIKI-KOYOU');

-- A11. 人材確保等支援助成金（雇用管理制度助成コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAKUHO-KANRI', 'manual', '人材確保等支援助成金（雇用管理制度助成コース）', json('{"title":"人材確保等支援助成金（雇用管理制度助成コース）","version":"令和7年度","subsidy_overview":"評価・処遇制度や研修制度、健康づくり制度等の雇用管理制度を導入し、離職率の低下に取り組む事業主に対して助成","subsidy_amount":"制度導入助成57万円（生産性要件72万円）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199313.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAKUHO-KANRI');

-- A12. 人材確保等支援助成金（人事評価改善等助成コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAKUHO-HYOUKA', 'manual', '人材確保等支援助成金（人事評価改善等助成コース）', json('{"title":"人材確保等支援助成金（人事評価改善等助成コース）","version":"令和7年度","subsidy_overview":"生産性向上に資する人事評価制度と賃金制度を整備し、実施することで従業員の離職率低下と賃金アップを図った事業主に対して助成","subsidy_amount":"制度整備助成50万円＋目標達成助成80万円＝最大130万円","target":"雇用保険適用事業主","application":"通年（計画届提出が必要）","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199313.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAKUHO-HYOUKA');

-- A13. 人材確保等支援助成金（テレワークコース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAKUHO-TELEWORK', 'manual', '人材確保等支援助成金（テレワークコース）', json('{"title":"人材確保等支援助成金（テレワークコース）","version":"令和7年度","subsidy_overview":"良質なテレワークを新規に導入し、従業員の人材確保や雇用管理改善等に取り組む中小企業事業主に対して助成","subsidy_amount":"機器等導入助成：最大100万円（1企業）、目標達成助成：最大100万円","target":"テレワークを新規導入する中小企業事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/telework_01_00002.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAKUHO-TELEWORK');

-- A14. 人材確保等支援助成金（外国人労働者就労環境整備助成コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAKUHO-GAIKOKUJIN', 'manual', '人材確保等支援助成金（外国人労働者就労環境整備助成コース）', json('{"title":"人材確保等支援助成金（外国人労働者就労環境整備助成コース）","version":"令和7年度","subsidy_overview":"外国人労働者の就労環境の整備（翻訳機器導入、多言語対応、社労士等への委託等）を行う事業主に対して助成","subsidy_amount":"支給対象経費の1/2（上限57万円）、賃金要件を満たす場合2/3（上限72万円）","target":"外国人労働者を雇用する事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/gaikokujin.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAKUHO-GAIKOKUJIN');

-- A15. 人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAKUHO-KENSETSU', 'manual', '人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）', json('{"title":"人材確保等支援助成金（建設キャリアアップシステム等普及促進コース）","version":"令和7年度","subsidy_overview":"建設キャリアアップシステム（CCUS）の活用促進に取り組む建設事業主等に対して助成","subsidy_amount":"1事業主あたり最大20万円","target":"建設業の中小事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kensetsu_ccus.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAKUHO-KENSETSU');

-- A16. 65歳超雇用推進助成金（65歳超継続雇用促進コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KOUREISHA-65CHO-KEIZOKU', 'manual', '65歳超雇用推進助成金（65歳超継続雇用促進コース）', json('{"title":"65歳超雇用推進助成金（65歳超継続雇用促進コース）","version":"令和7年度","subsidy_overview":"65歳以上への定年引上げ、定年廃止、66歳以上の継続雇用制度導入を実施した事業主に対して助成","subsidy_amount":"15万円～160万円（措置内容・引上げ年齢・被保険者数により異なる）","target":"雇用保険適用事業主","application":"通年","contact":"独立行政法人 高齢・障害・求職者雇用支援機構","official_url":"https://www.jeed.go.jp/elderly/subsidy/subsidy_keizoku.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KOUREISHA-65CHO-KEIZOKU');

-- A17. キャリアアップ助成金（賃金規定等改定コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CAREER-UP-CHINGIN', 'manual', 'キャリアアップ助成金（賃金規定等改定コース）', json('{"title":"キャリアアップ助成金（賃金規定等改定コース）","version":"令和7年度","subsidy_overview":"有期雇用労働者等の基本給の賃金規定等を3%以上増額改定した事業主に対して助成","subsidy_amount":"1人あたり5万円（中小企業）、対象者全員分","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CAREER-UP-CHINGIN');

-- A18. キャリアアップ助成金（賞与・退職金制度導入コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CAREER-UP-SHOUYO', 'manual', 'キャリアアップ助成金（賞与・退職金制度導入コース）', json('{"title":"キャリアアップ助成金（賞与・退職金制度導入コース）","version":"令和7年度","subsidy_overview":"有期雇用労働者等を対象に賞与・退職金制度を新たに設け、支給または積立てを実施した事業主に対して助成","subsidy_amount":"1事業所あたり：賞与のみ40万円、退職金のみ40万円、両方56.8万円（中小企業）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CAREER-UP-SHOUYO');

-- A19. キャリアアップ助成金（社会保険適用時処遇改善コース）※年収の壁対策
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CAREER-UP-SHAKAI-HOKEN', 'manual', 'キャリアアップ助成金（社会保険適用時処遇改善コース）', json('{"title":"キャリアアップ助成金（社会保険適用時処遇改善コース）","version":"令和7年度","subsidy_overview":"短時間労働者が新たに社会保険に加入する際に、手当支給や賃上げ等の処遇改善を行った事業主に対して助成。いわゆる「年収の壁」対策","subsidy_amount":"1人あたり最大50万円（手当等支給メニュー・労働時間延長メニュー等あり）","target":"雇用保険適用事業主","application":"通年（令和8年3月末まで）","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CAREER-UP-SHAKAI-HOKEN');

-- A20. 両立支援等助成金（育児休業等支援コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('RYOURITSU-IKUJI', 'manual', '両立支援等助成金（育児休業等支援コース）', json('{"title":"両立支援等助成金（育児休業等支援コース）","version":"令和7年度","subsidy_overview":"育児休業の円滑な取得・職場復帰のための取組を行った中小企業事業主に対して助成","subsidy_amount":"育休取得時30万円＋職場復帰時30万円＝最大60万円（1企業2回まで）","target":"中小企業事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'RYOURITSU-IKUJI');

-- A21. 両立支援等助成金（介護離職防止支援コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('RYOURITSU-KAIGO', 'manual', '両立支援等助成金（介護離職防止支援コース）', json('{"title":"両立支援等助成金（介護離職防止支援コース）","version":"令和7年度","subsidy_overview":"仕事と介護の両立支援に関する取組を行い、介護休業や介護のための柔軟な就労形態の制度を利用させた中小企業事業主に対して助成","subsidy_amount":"介護休業取得時30万円＋職場復帰時30万円＝最大60万円","target":"中小企業事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'RYOURITSU-KAIGO');

-- A22. 両立支援等助成金（不妊治療両立支援コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('RYOURITSU-FUNIN', 'manual', '両立支援等助成金（不妊治療両立支援コース）', json('{"title":"両立支援等助成金（不妊治療両立支援コース）","version":"令和7年度","subsidy_overview":"不妊治療と仕事の両立ができる職場環境の整備に取り組み、不妊治療のための休暇制度等を利用させた中小企業事業主に対して助成","subsidy_amount":"環境整備・休暇取得30万円＋長期休暇取得30万円＝最大60万円","target":"中小企業事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'RYOURITSU-FUNIN');

-- A23. 人材開発支援助成金（人材育成支援コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAIHATSU-IKUSEI', 'manual', '人材開発支援助成金（人材育成支援コース）', json('{"title":"人材開発支援助成金（人材育成支援コース）","version":"令和7年度","subsidy_overview":"従業員に対して職務に関連した知識・技能を習得させる職業訓練（OFF-JT・OJT）を実施した事業主に対して助成。新入社員研修から管理職研修まで幅広く対象","subsidy_amount":"経費助成45%（条件により60%）＋賃金助成760円/時間（1人1コース上限15万～50万円）","target":"雇用保険適用事業主","application":"通年（訓練開始1か月前までに計画届提出）","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAIHATSU-IKUSEI');

-- A24. 人材開発支援助成金（人への投資促進コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAIHATSU-HITO', 'manual', '人材開発支援助成金（人への投資促進コース）', json('{"title":"人材開発支援助成金（人への投資促進コース）","version":"令和7年度（令和4年～8年度期間限定）","subsidy_overview":"デジタル人材育成、高度デジタル人材育成訓練、IT分野未経験者の即戦力化、長期教育訓練休暇、自発的職業能力開発（サブスク型含む）を行う事業主に対して助成","subsidy_amount":"経費助成最大75%＋賃金助成最大960円/時間（コースにより上限異なる）","target":"雇用保険適用事業主","application":"通年（令和8年度まで期間限定）","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAIHATSU-HITO');

-- A25. 人材開発支援助成金（教育訓練休暇等付与コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JINZAI-KAIHATSU-KYUKA', 'manual', '人材開発支援助成金（教育訓練休暇等付与コース）', json('{"title":"人材開発支援助成金（教育訓練休暇等付与コース）","version":"令和7年度","subsidy_overview":"有給の教育訓練休暇制度を導入し、労働者が自発的に訓練を受けることを支援する事業主に対して助成","subsidy_amount":"30万円（制度導入・適用経費助成）","target":"雇用保険適用事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JINZAI-KAIHATSU-KYUKA');

-- A26. 通年雇用助成金
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TSUUNEN-KOYOU', 'manual', '通年雇用助成金', json('{"title":"通年雇用助成金","version":"令和7年度","subsidy_overview":"北海道・東北地方等の積雪寒冷地において、季節的業務に就く労働者を通年雇用した事業主に対して助成","subsidy_amount":"対象労働者1人あたり最大71万円（事業所内就業・事業所外就業により異なる）","target":"積雪寒冷地の事業主","application":"通年","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tsuunen_koyou.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TSUUNEN-KOYOU');

-- A27. 働き方改革推進支援助成金（団体推進コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('HATARAKIKATA-DANTAI', 'manual', '働き方改革推進支援助成金（団体推進コース）', json('{"title":"働き方改革推進支援助成金（団体推進コース）","version":"令和7年度","subsidy_overview":"中小企業の団体（事業協同組合等）が構成事業主の労働条件改善のために取り組む活動を支援","subsidy_amount":"最大500万円","target":"中小企業の事業主団体","application":"4月～11月頃","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000200273.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'HATARAKIKATA-DANTAI');

-- A28. 働き方改革推進支援助成金（適用猶予業種等対応コース）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('HATARAKIKATA-YUUYO', 'manual', '働き方改革推進支援助成金（適用猶予業種等対応コース）', json('{"title":"働き方改革推進支援助成金（適用猶予業種等対応コース）","version":"令和7年度","subsidy_overview":"建設業・運送業・医師等、時間外労働の上限規制の適用猶予業種において、労働時間短縮や週休2日制の導入等に取り組む中小企業事業主に対して助成","subsidy_amount":"最大250万円＋賃上げ加算（最大720万円）","target":"建設業・運送業・医師等の中小企業事業主","application":"4月～11月頃","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'HATARAKIKATA-YUUYO');

-- ■ カテゴリB: 経産省・中小企業庁系（未登録の重要補助金）
-- =====================================================

-- B1. 中小企業省力化投資補助金（一般型）※SHORYOKUKA-IPPAN系とは別物で概要枠
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SHORYOKUKA-IPPAN-GAIYO', 'manual', '中小企業省力化投資補助金（一般型）概要', json('{"title":"中小企業省力化投資補助金（一般型）総合ガイド","version":"2026年最新","subsidy_overview":"工場全体のライン自動化や大規模システム連携など、オーダーメイドの省力化を支援する補助金。カタログ型との違いは、カスタム設計の設備・システムが対象","subsidy_amount":"最大1億円（中小企業）、補助下限750万円","subsidy_rate":"中小1/2（特例2/3）、小規模・再生2/3","target":"中小企業・小規模事業者","eligible_expenses":"オーダーメイド設備・システム構築（IoT化・無人化・自動倉庫等）","requirements":["労働生産性の年平均成長率+4.0%以上","1人あたり給与支給総額の年平均成長率が最低賃金の直近5年間年平均成長率以上","事業所内最低賃金が地域別最低賃金+30円以上"],"application":"通年公募","official_url":"https://shoryokuka.smrj.go.jp/ippan/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SHORYOKUKA-IPPAN-GAIYO');

-- B2. 事業再構築補助金（最終公募情報として参考保持）
-- ※既にSAIKOUCHIKU-FINALとして登録済み、スキップ

-- B3. SBIR（中小企業技術革新制度）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SBIR-JAPAN', 'manual', 'SBIR制度（中小企業技術革新制度）', json('{"title":"SBIR制度（日本版SBIR／中小企業技術革新制度）","version":"令和7年度","subsidy_overview":"国の研究開発ニーズに基づく特定補助金等を活用し、中小企業のイノベーション創出を支援する制度。各省庁が個別の公募を実施","subsidy_amount":"各省庁の個別プログラムにより異なる（数百万円～数億円規模）","target":"中小企業・スタートアップ","application":"各省庁の公募スケジュールによる","official_url":"https://www.smrj.go.jp/org/info/efforts/sbir/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SBIR-JAPAN');

-- B4. JAPANブランド育成支援等事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JAPAN-BRAND', 'manual', 'JAPANブランド育成支援等事業', json('{"title":"JAPANブランド育成支援等事業","version":"令和7年度","subsidy_overview":"中小企業の海外展開やブランディングを支援。海外展示会出展、EC販路開拓、ブランド構築等の費用を補助","subsidy_amount":"最大500万円","subsidy_rate":"2/3以内","target":"海外展開を目指す中小企業","application":"年1～2回公募","official_url":"https://www.chusho.meti.go.jp/shogyo/chiiki/japan_brand/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JAPAN-BRAND');

-- ■ カテゴリC: 環境省系
-- =====================================================

-- C1. 脱炭素化促進支援事業（CO2削減設備導入）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('DATSUTANSO-SETSUBI', 'manual', '中小企業等のCO2排出削減支援事業', json('{"title":"中小企業等のCO2排出削減比率についての目標等を踏まえた設備更新補助事業","version":"令和7年度","subsidy_overview":"中小企業等のCO2排出削減に資する設備更新を補助。高効率空調、LED照明、高効率ボイラー等への更新を支援","subsidy_amount":"最大1億円","subsidy_rate":"1/3～1/2","target":"中小企業等","application":"年1～2回公募","official_url":"https://www.env.go.jp/earth/earth/ondanka/enetoku/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'DATSUTANSO-SETSUBI');

-- C2. 建築物等のZEB化・省CO2促進事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('ZEB-SHIEN', 'manual', '建築物等のZEB化・省CO2促進事業', json('{"title":"建築物等の脱炭素化・レジリエンス強化促進事業（ZEB）","version":"令和7年度","subsidy_overview":"新築・既存建築物のZEB（ネット・ゼロ・エネルギー・ビル）化を支援。断熱改修、高効率設備導入、再エネ設備等を補助","subsidy_amount":"最大5億円（プロジェクト規模による）","subsidy_rate":"1/3～2/3","target":"建築物の所有者・管理者","application":"年1～2回公募","official_url":"https://www.env.go.jp/earth/earth/ondanka/building_enetoku/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'ZEB-SHIEN');

-- C3. 再エネ設備・蓄電池導入支援
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SAIENE-CHIKUDENCHI', 'manual', '再生可能エネルギー設備・蓄電池導入支援事業', json('{"title":"ストレージパリティの達成に向けた太陽光発電設備等の価格低減促進事業","version":"令和7年度","subsidy_overview":"自家消費型の太陽光発電設備と蓄電池の導入を支援。電力コスト削減とBCP対策を同時に実現","subsidy_amount":"太陽光：定額（kWあたり）、蓄電池：kWhあたり定額","subsidy_rate":"定額補助","target":"企業・自治体等","application":"年1～2回公募","official_url":"https://sii.or.jp/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SAIENE-CHIKUDENCHI');

-- C4. クリーンエネルギー自動車導入補助金（CEV補助金）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CEV-HOJOKIN', 'manual', 'クリーンエネルギー自動車導入促進補助金', json('{"title":"クリーンエネルギー自動車導入促進補助金（CEV補助金）","version":"令和7年度","subsidy_overview":"電気自動車（EV）、プラグインハイブリッド車（PHEV）、燃料電池自動車（FCV）等のクリーンエネルギー自動車の購入を補助","subsidy_amount":"EV：最大85万円、軽EV：最大55万円、PHEV：最大55万円、FCV：最大255万円","target":"個人・法人","application":"随時（予算がなくなり次第終了）","official_url":"https://www.cev-pc.or.jp/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CEV-HOJOKIN');

-- ■ カテゴリD: 国交省・住宅関連
-- =====================================================

-- D1. 事業用建築物のZEB化支援
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('ZEH-ZEB-MLIT', 'manual', '住宅・建築物省エネ改修推進事業', json('{"title":"住宅・建築物省エネ改修推進事業","version":"令和7年度","subsidy_overview":"既存住宅・建築物の省エネ改修（断熱改修、省エネ設備導入等）を支援","subsidy_amount":"最大2,000万円/戸（建築物省エネ改修）","subsidy_rate":"1/3","target":"住宅・建築物の所有者","application":"年1～2回公募","official_url":"https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk4_000153.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'ZEH-ZEB-MLIT');

-- D2. 長期優良住宅化リフォーム推進事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHOUKI-YURYOU-REFORM', 'manual', '長期優良住宅化リフォーム推進事業', json('{"title":"長期優良住宅化リフォーム推進事業","version":"令和7年度","subsidy_overview":"既存住宅の長寿命化・省エネ化・バリアフリー化等のリフォームを支援","subsidy_amount":"最大250万円/戸（長期優良住宅認定の場合）","subsidy_rate":"1/3","target":"住宅のリフォームを行う住宅所有者","application":"年1～2回公募","official_url":"https://www.kenken.go.jp/chouki_r/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHOUKI-YURYOU-REFORM');

-- D3. グループ化補助金（自然災害等）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('GROUP-SAIGAI', 'manual', 'なりわい再建支援補助金（グループ補助金）', json('{"title":"なりわい再建支援補助金（グループ補助金）","version":"随時","subsidy_overview":"自然災害等により被害を受けた中小企業等のグループが、復旧・復興事業計画に基づき施設・設備の復旧を行う際の費用を補助","subsidy_amount":"最大15億円（中小企業の場合）","subsidy_rate":"3/4（中小企業）、1/2（中堅企業）","target":"被災した中小企業等のグループ","application":"災害発生後に随時公募","official_url":"https://www.chusho.meti.go.jp/earthquake/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'GROUP-SAIGAI');

-- ■ カテゴリE: 農林水産省
-- =====================================================

-- E1. 強い農業づくり総合支援交付金
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('TSUYOI-NOUGYO', 'manual', '強い農業づくり総合支援交付金', json('{"title":"強い農業づくり総合支援交付金","version":"令和7年度","subsidy_overview":"産地の収益力強化と担い手への農地集積に向けた共同利用施設の整備等を支援","subsidy_amount":"事業費の1/2以内","target":"農業者の組織する団体、農業法人等","application":"年1回公募（都道府県経由）","official_url":"https://www.maff.go.jp/j/seisan/suisin/tuyoi_nougyou/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'TSUYOI-NOUGYO');

-- E2. 農業経営基盤強化準備金（税制）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('NOUGYO-KIBAN-JYUNBIKIN', 'manual', '農業経営基盤強化準備金制度', json('{"title":"農業経営基盤強化準備金制度（税制措置）","version":"令和7年度","subsidy_overview":"認定農業者が経営所得安定対策等の交付金を農業経営基盤強化準備金として積み立てた場合、必要経費算入（損金算入）ができる税制措置","subsidy_amount":"交付金相当額を必要経費算入可能","target":"認定農業者・認定新規就農者","application":"確定申告時","official_url":"https://www.maff.go.jp/j/kobetu_ninaite/n_seido/junbikin.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'NOUGYO-KIBAN-JYUNBIKIN');

-- E3. 新規就農者育成総合対策
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SHINKI-SHUNOU', 'manual', '新規就農者育成総合対策', json('{"title":"新規就農者育成総合対策","version":"令和7年度","subsidy_overview":"就農準備資金（研修期間中の生活支援、年間最大150万円・最長2年）、経営開始資金（就農直後の生活支援、年間最大150万円・最長3年）、経営発展支援事業（機械・施設導入支援）を一体的に実施","subsidy_amount":"就農準備資金150万円/年（最長2年）、経営開始資金150万円/年（最長3年）、経営発展支援事業最大1,000万円","target":"新規就農者（50歳未満）","application":"年1～2回公募","official_url":"https://www.maff.go.jp/j/new_farmer/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SHINKI-SHUNOU');

-- E4. 6次産業化支援事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('ROKUJI-SANGYOUKA', 'manual', '6次産業化支援事業', json('{"title":"6次産業化支援事業","version":"令和7年度","subsidy_overview":"農林漁業者等が自ら加工・販売に取り組む6次産業化を支援。加工施設・直売所等の整備費用を補助","subsidy_amount":"最大5,000万円","subsidy_rate":"1/2以内","target":"農林漁業者、農林漁業者の組織する団体","application":"年1回公募","official_url":"https://www.maff.go.jp/j/shokusan/sanki/6jika.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'ROKUJI-SANGYOUKA');

-- ■ カテゴリF: 総務省・デジタル庁・内閣府系
-- =====================================================

-- F1. デジタル田園都市国家構想交付金（デジタル実装タイプ）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('DIGITAL-DENEN-JISSOU', 'manual', 'デジタル田園都市国家構想交付金（デジタル実装タイプ）', json('{"title":"デジタル田園都市国家構想交付金（デジタル実装タイプ）","version":"令和7年度","subsidy_overview":"地方自治体がデジタル技術を活用して地域課題を解決する取組を支援。TYPE1～TYPE3の3段階","subsidy_amount":"TYPE1：最大1億円、TYPE2：最大2億円、TYPE3：最大3億円","target":"地方公共団体","application":"年1回公募","official_url":"https://www.chisou.go.jp/sousei/about/mirai/policy/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'DIGITAL-DENEN-JISSOU');

-- F2. 地方創生推進交付金
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHIHOU-SOUSEI-SUISHIN', 'manual', '地方創生推進交付金', json('{"title":"地方創生推進交付金","version":"令和7年度","subsidy_overview":"地方公共団体が自主的・主体的に地方創生に取り組むための事業を支援。先駆型、横展開型、Society5.0型等","subsidy_amount":"事業費の1/2以内","target":"地方公共団体","application":"年1～2回","official_url":"https://www.chisou.go.jp/sousei/about/kouhukin/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHIHOU-SOUSEI-SUISHIN');

-- ■ カテゴリG: その他重要な補助金・税制
-- =====================================================

-- G1. 中小企業投資促進税制
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHUSHO-TOUSHI-ZEISEI', 'manual', '中小企業投資促進税制', json('{"title":"中小企業投資促進税制（中小企業等経営強化法）","version":"令和7年度","subsidy_overview":"中小企業が設備投資を行った場合に、特別償却（30%）または税額控除（7%）を選択適用できる税制措置","subsidy_amount":"特別償却30%、税額控除7%（資本金3,000万円以下）","target":"青色申告の中小企業者等","application":"設備取得時（確定申告で適用）","official_url":"https://www.chusho.meti.go.jp/zaimu/zeisei/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHUSHO-TOUSHI-ZEISEI');

-- G2. 中小企業経営強化税制
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KEIEI-KYOUKA-ZEISEI', 'manual', '中小企業経営強化税制', json('{"title":"中小企業経営強化税制","version":"令和7年度","subsidy_overview":"経営力向上計画の認定を受けた中小企業が設備投資を行った場合に、即時償却または税額控除（10%）を選択適用","subsidy_amount":"即時償却100%、税額控除10%（資本金3,000万円以下）／7%（資本金3,000万円超1億円以下）","target":"経営力向上計画の認定を受けた中小企業","application":"設備取得時（確定申告で適用）","official_url":"https://www.chusho.meti.go.jp/keiei/kyoka/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KEIEI-KYOUKA-ZEISEI');

-- G3. 先端設備等導入計画（固定資産税特例）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SENTAN-SETSUBI-ZEISEI', 'manual', '先端設備等導入計画に係る固定資産税特例', json('{"title":"先端設備等導入計画に係る固定資産税の特例","version":"令和7年度","subsidy_overview":"市区町村の認定を受けた先端設備等導入計画に基づく設備投資について、固定資産税を最大3年間ゼロ（賃上げ要件あり）にできる税制措置","subsidy_amount":"固定資産税を最大3年間ゼロ（賃上げ計画を策定した場合）","target":"中小企業・小規模事業者","application":"設備取得前に計画認定が必要","official_url":"https://www.chusho.meti.go.jp/keiei/seisansei/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SENTAN-SETSUBI-ZEISEI');

-- G4. 小規模企業共済制度
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SHOKIBO-KYOSAI', 'manual', '小規模企業共済制度', json('{"title":"小規模企業共済制度","version":"令和7年度","subsidy_overview":"小規模企業の経営者や個人事業主が廃業や退職後の生活資金等のために積み立てる退職金制度。掛金は全額所得控除","subsidy_amount":"掛金月額1,000円～70,000円（全額所得控除）、共済金は退職所得扱い","target":"従業員20人以下の小規模企業の経営者・役員、個人事業主","application":"随時加入可能","official_url":"https://www.smrj.go.jp/kyosai/skyosai/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SHOKIBO-KYOSAI');

-- G5. 経営セーフティ共済（中小企業倒産防止共済）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KEIEI-SAFETY-KYOSAI', 'manual', '経営セーフティ共済（中小企業倒産防止共済）', json('{"title":"経営セーフティ共済（中小企業倒産防止共済制度）","version":"令和7年度","subsidy_overview":"取引先の倒産に備え、掛金を積み立てておくことで、取引先倒産時に掛金総額の最大10倍（最大8,000万円）の貸付を受けられる制度。掛金は損金算入可能","subsidy_amount":"貸付上限8,000万円（掛金総額800万円の10倍）、掛金は月額5,000円～200,000円","target":"中小企業者（1年以上事業を行っている）","application":"随時加入可能","official_url":"https://www.smrj.go.jp/kyosai/tkyosai/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KEIEI-SAFETY-KYOSAI');

-- G6. ものづくり・商業・サービス高度連携促進事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('MONO-KOUDO-RENKEI', 'manual', 'ものづくり・商業・サービス高度連携促進事業', json('{"title":"ものづくり・商業・サービス高度連携促進事業","version":"令和7年度","subsidy_overview":"複数の中小企業が連携して取り組む高度な開発プロジェクトを支援。サプライチェーン連携や異業種連携によるイノベーション創出","subsidy_amount":"最大2,000万円×連携体参加者数","subsidy_rate":"1/2（小規模2/3）","target":"複数の中小企業で構成される連携体","application":"ものづくり補助金と同時公募","official_url":"https://portal.monodukuri-hojo.jp/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'MONO-KOUDO-RENKEI');

-- G7. 中小企業退職金共済制度（中退共）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHUTAIKYO', 'manual', '中小企業退職金共済制度（中退共）', json('{"title":"中小企業退職金共済制度（中退共）","version":"令和7年度","subsidy_overview":"中小企業の従業員の退職金を国が支援する制度。新規加入時に掛金の一部を国が助成","subsidy_amount":"新規加入：掛金月額の1/2を加入後4か月目から1年間助成（上限5,000円）、月額変更（増額）：増額分の1/3を1年間助成","target":"中小企業（従業員300人以下または資本金3億円以下等）","application":"随時加入可能","official_url":"https://chutaikyo.taisyokukin.go.jp/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHUTAIKYO');

-- G8. 事業復活支援金（コロナ後継制度等） → 現在は終了のため割愛

-- G9. 認定経営革新等支援機関による経営改善計画策定支援
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KEIEI-KAIZEN-KEIKAKU', 'manual', '経営改善計画策定支援事業（405事業）', json('{"title":"経営改善計画策定支援事業（405事業）","version":"令和7年度","subsidy_overview":"認定経営革新等支援機関（税理士、中小企業診断士等）が中小企業の経営改善計画の策定を支援する際の費用を補助","subsidy_amount":"計画策定支援：最大300万円、伴走支援：最大100万円","subsidy_rate":"2/3","target":"金融支援を伴う経営改善が必要な中小企業","application":"随時","official_url":"https://www.chusho.meti.go.jp/keiei/kakushin/kaizen/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KEIEI-KAIZEN-KEIKAKU');

-- G10. 中小企業活性化協議会による経営改善支援
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KASSEIKA-KYOUGIKAI', 'manual', '中小企業活性化協議会による経営改善支援', json('{"title":"中小企業活性化協議会による事業再生支援","version":"令和7年度","subsidy_overview":"各都道府県に設置された中小企業活性化協議会が、中小企業の事業再生に関する相談を受け付け、再生計画の策定支援等を無料で実施","subsidy_amount":"相談・再生計画策定支援は無料","target":"経営改善・事業再生が必要な中小企業","application":"随時（各都道府県の協議会に相談）","official_url":"https://www.smrj.go.jp/sme/enhancement/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KASSEIKA-KYOUGIKAI');

-- ■ カテゴリH: 創業・スタートアップ系
-- =====================================================

-- H1. 創業支援等事業者補助金
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SOUGYOU-SHIEN-JIGYOUSHA', 'manual', '創業支援等事業者補助金', json('{"title":"創業支援等事業者補助金","version":"令和7年度","subsidy_overview":"市区町村と連携して創業支援を行う事業者（商工会議所、NPO法人等）の創業支援事業に要する経費を補助","subsidy_amount":"最大1,000万円","subsidy_rate":"2/3以内","target":"創業支援等事業計画の認定を受けた市区町村と連携する事業者","application":"年1回公募","official_url":"https://www.chusho.meti.go.jp/keiei/chiiki/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SOUGYOU-SHIEN-JIGYOUSHA');

-- H2. 起業支援金・移住支援金（地方創生）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KIGYOU-IJUU-SHIENKIN', 'manual', '起業支援金・移住支援金', json('{"title":"起業支援金・移住支援金（地方創生起業支援事業・移住支援事業）","version":"令和7年度","subsidy_overview":"東京圏から地方へ移住して起業・就業する方に対して、起業支援金（最大200万円）と移住支援金（最大300万円）を支給","subsidy_amount":"起業支援金：最大200万円、移住支援金：単身60万円・世帯100万円（18歳未満の子1人につき100万円加算）","target":"東京23区在住・通勤者で地方に移住する方","application":"各都道府県が実施","official_url":"https://www.chisou.go.jp/sousei/ijyu_shien_kinkyuu.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KIGYOU-IJUU-SHIENKIN');

-- H3. 日本政策金融公庫 新創業融資制度
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JFC-SHIN-SOUGYOU', 'manual', '新創業融資制度（日本政策金融公庫）', json('{"title":"新創業融資制度（日本政策金融公庫）","version":"令和7年度","subsidy_overview":"新たに事業を始める方や事業開始後税務申告を2期終えていない方を対象とした無担保・無保証人の融資制度","subsidy_amount":"融資限度額：3,000万円（うち運転資金1,500万円）","target":"新規開業者・開業後2期以内","application":"随時（日本政策金融公庫の各支店）","official_url":"https://www.jfc.go.jp/n/finance/search/04_shinsogyo_m.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JFC-SHIN-SOUGYOU');

-- H4. 日本政策金融公庫 新規開業資金
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JFC-SHINKI-KAIGYOU', 'manual', '新規開業資金（日本政策金融公庫）', json('{"title":"新規開業資金（日本政策金融公庫）","version":"令和7年度","subsidy_overview":"新たに事業を始める方または事業開始後おおむね7年以内の方を対象とした融資制度","subsidy_amount":"融資限度額：7,200万円（うち運転資金4,800万円）","target":"新規開業者・開業後7年以内","application":"随時（日本政策金融公庫の各支店）","official_url":"https://www.jfc.go.jp/n/finance/search/01_sinkikaigyou_m.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JFC-SHINKI-KAIGYOU');

-- ■ カテゴリI: その他省庁・独法系
-- =====================================================

-- I1. NEDO 研究開発型スタートアップ支援事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('NEDO-STARTUP', 'manual', 'NEDO 研究開発型スタートアップ支援事業', json('{"title":"研究開発型スタートアップ支援事業（NEDO）","version":"令和7年度","subsidy_overview":"研究開発型スタートアップに対して、技術シーズの事業化に向けた研究開発・実証を支援。STS（シード期支援）、PCA（事業化支援）等","subsidy_amount":"STS：最大7,000万円、PCA：最大数億円","target":"研究開発型スタートアップ","application":"年数回公募","official_url":"https://www.nedo.go.jp/activities/ZZJP2_100174.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'NEDO-STARTUP');

-- I2. JETRO 海外展開支援
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('JETRO-KAIGAI', 'manual', 'JETRO 海外展開支援事業', json('{"title":"JETRO（日本貿易振興機構）海外展開支援","version":"令和7年度","subsidy_overview":"中小企業の海外展開を総合的に支援。海外展示会出展支援、海外バイヤー商談会、越境EC支援等","subsidy_amount":"海外展示会出展：最大350万円（補助率2/3）、越境EC支援等","target":"海外展開を目指す中小企業","application":"各事業ごとに随時公募","official_url":"https://www.jetro.go.jp/services/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'JETRO-KAIGAI');

-- I3. 中小機構 経営相談・支援事業
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SMRJ-KEIEI-SOUDAN', 'manual', '中小企業基盤整備機構 経営支援事業', json('{"title":"中小企業基盤整備機構（中小機構）経営支援サービス","version":"令和7年度","subsidy_overview":"よろず支援拠点での無料経営相談、専門家派遣事業（3回まで無料）、ハンズオン支援等の中小企業支援サービス","subsidy_amount":"相談は無料、専門家派遣3回まで無料","target":"中小企業・小規模事業者","application":"随時","official_url":"https://www.smrj.go.jp/sme/consulting/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SMRJ-KEIEI-SOUDAN');

-- I4. 知財関連支援（特許料減免等）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHIZAI-GENMEN', 'manual', '中小企業向け特許料等減免制度', json('{"title":"中小企業向け特許料等減免制度","version":"令和7年度","subsidy_overview":"中小企業等の特許出願に係る審査請求料・特許料を1/2～1/3に減免する制度","subsidy_amount":"審査請求料1/2～1/3に減額、特許料（1～10年分）1/2～1/3に減額","target":"中小企業・小規模事業者・スタートアップ","application":"出願時に申請","official_url":"https://www.jpo.go.jp/system/process/tesuryo/genmen/genmen20190401/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHIZAI-GENMEN');

-- I5. 中小企業の海外知財対策支援事業（海外知財訴訟費用保険）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KAIGAI-CHIZAI-TAISAKU', 'manual', '中小企業等海外知的財産権対策支援事業', json('{"title":"中小企業等海外知的財産権対策支援事業","version":"令和7年度","subsidy_overview":"中小企業等の海外での知的財産保護を支援。海外での特許・商標出願費用、模倣品対策費用等を補助","subsidy_amount":"外国出願：1案件最大150万円、模倣品対策：最大400万円","subsidy_rate":"1/2以内","target":"海外展開する中小企業","application":"年数回公募","official_url":"https://www.jpo.go.jp/support/chusho/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KAIGAI-CHIZAI-TAISAKU');

-- ■ カテゴリJ: 最新注目（2026年新設・拡充）
-- =====================================================

-- J1. 中小企業省力化投資補助金（カタログ型）→ 既にSHORYOKUKA-CATALOGとして登録済み

-- J2. GX（グリーントランスフォーメーション）関連投資支援
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('GX-TOUSHI-SHIEN', 'manual', 'GX経済移行債を活用した投資支援策', json('{"title":"GX経済移行債を活用した産業の脱炭素化支援","version":"令和7年度","subsidy_overview":"GX経済移行債（20兆円規模）を活用した産業の脱炭素化を支援。省エネ設備、再エネ導入、水素・アンモニア利用等の大規模投資を支援","subsidy_amount":"プロジェクト規模により数百万円～数十億円","target":"脱炭素化に取り組む企業","application":"各事業ごとに公募","official_url":"https://www.meti.go.jp/policy/energy_environment/global_warming/GX/index.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'GX-TOUSHI-SHIEN');

-- J3. DX投資促進税制
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('DX-TOUSHI-ZEISEI', 'manual', 'DX投資促進税制', json('{"title":"DX（デジタルトランスフォーメーション）投資促進税制","version":"令和7年度","subsidy_overview":"デジタル技術を活用した企業変革（DX）に向けた投資に対して、特別償却（30%）または税額控除（3%～5%）を適用","subsidy_amount":"特別償却30%、税額控除3%（グループ外投資は5%）、投資上限300億円","target":"DX認定を受けた企業","application":"事業適応計画の認定が必要","official_url":"https://www.meti.go.jp/policy/economy/chizai/chiteki/DX-zeisei.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'DX-TOUSHI-ZEISEI');

-- J4. カーボンニュートラル投資促進税制
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CN-TOUSHI-ZEISEI', 'manual', 'カーボンニュートラルに向けた投資促進税制', json('{"title":"カーボンニュートラルに向けた投資促進税制","version":"令和7年度","subsidy_overview":"生産工程等の脱炭素化と付加価値向上を両立する設備導入に対して、特別償却（50%）または税額控除（5%～10%）を適用","subsidy_amount":"特別償却50%、税額控除5%（温室効果ガス削減投資）～10%（炭素生産性向上投資）、投資上限500億円","target":"産業競争力強化法の事業適応計画の認定を受けた企業","application":"事業適応計画の認定が必要","official_url":"https://www.meti.go.jp/policy/economy/chizai/chiteki/CN-zeisei.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CN-TOUSHI-ZEISEI');

-- J5. 賃上げ促進税制（中小企業向け）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('CHINAGESHIEN-ZEISEI', 'manual', '賃上げ促進税制（中小企業向け）', json('{"title":"賃上げ促進税制（中小企業向け）","version":"令和7年度","subsidy_overview":"従業員の給与等を一定割合以上引き上げた場合に、給与等支給増加額の一部を法人税から控除できる税制措置","subsidy_amount":"給与等支給額増加分の15%～45%を税額控除（増加率・教育訓練費等により加算）","target":"青色申告の中小企業者等","application":"確定申告時に適用","official_url":"https://www.meti.go.jp/policy/economy/jinzai/syotokukakudai/chinagesokushin.html","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'CHINAGESHIEN-ZEISEI');

-- J6. 交際費課税の特例（中小企業）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('KOUSAIHI-TOKUREI', 'manual', '中小企業の交際費課税の特例', json('{"title":"中小企業の交際費課税の特例","version":"令和7年度","subsidy_overview":"中小企業は年800万円までの交際費を全額損金算入できる特例措置","subsidy_amount":"年800万円まで全額損金算入","target":"資本金1億円以下の中小企業","application":"確定申告時に適用","official_url":"https://www.nta.go.jp/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'KOUSAIHI-TOKUREI');

-- J7. 少額減価償却資産の特例（30万円未満即時償却）
INSERT OR REPLACE INTO subsidy_cache (id, source, title, detail_json, detail_score, wall_chat_ready, cached_at, expires_at, canonical_id)
VALUES ('SHOUGAKU-GENKASHOKYAKU', 'manual', '少額減価償却資産の特例', json('{"title":"中小企業者等の少額減価償却資産の取得価額の損金算入の特例","version":"令和7年度","subsidy_overview":"中小企業が取得価額30万円未満の減価償却資産を即時に全額損金算入できる特例。年間合計300万円まで","subsidy_amount":"30万円未満の資産を即時償却（年間合計300万円まで）","target":"青色申告の中小企業者等（従業員500人以下）","application":"確定申告時に適用","official_url":"https://www.nta.go.jp/","data_updated_at":"2026-02-08"}'), 85, 1, datetime('now'), datetime('now', '+365 days'), 'SHOUGAKU-GENKASHOKYAKU');

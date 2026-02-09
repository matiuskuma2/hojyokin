-- Phase 10 Part 1: 新規50件（#237〜#286）
-- 自治体独自、科研費・学術、NPO、子育て、エネルギー、観光系

-- #237 横浜市中小企業設備投資助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YOKOHAMA-SETSUBI', '横浜市中小企業設備投資助成金', 'YOKOHAMA', '横浜市', '14', '["subsidy","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YOKOHAMA-SETSUBI', 'manual', '横浜市中小企業設備投資助成金', 5000000, '1/2', '神奈川県横浜市', '2026-04-01', '2027-02-28',
'{"overview":"横浜市内の中小企業が行う設備投資を助成","target":"横浜市内に事業所を有する中小企業者","amount":"上限500万円（補助率1/2）","period":"令和8年度","url":"https://www.city.yokohama.lg.jp/business/kigyoshien/","source":"横浜市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'YOKOHAMA-SETSUBI', 1);

-- #238 名古屋市スタートアップ支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NAGOYA-STARTUP', '名古屋市スタートアップ支援補助金', 'NAGOYA', '名古屋市', '23', '["subsidy","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NAGOYA-STARTUP', 'manual', '名古屋市スタートアップ支援補助金', 3000000, '2/3', '愛知県名古屋市', '2026-04-01', '2026-12-31',
'{"overview":"名古屋市内のスタートアップ企業の事業拡大・実証実験を支援","target":"設立5年以内のスタートアップ","amount":"上限300万円（補助率2/3）","period":"令和8年度","url":"https://www.city.nagoya.jp/keizai/","source":"名古屋市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'NAGOYA-STARTUP', 1);

-- #239 神戸市中小企業DX推進補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOBE-DX', '神戸市中小企業DX推進補助金', 'KOBE', '神戸市', '28', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOBE-DX', 'manual', '神戸市中小企業DX推進補助金', 2000000, '1/2', '兵庫県神戸市', '2026-05-01', '2026-11-30',
'{"overview":"神戸市内の中小企業によるDX推進を支援","target":"神戸市内に事業所を有する中小企業","amount":"上限200万円（補助率1/2）","period":"令和8年度","url":"https://www.city.kobe.lg.jp/a09222/business/","source":"神戸市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOBE-DX', 1);

-- #240 京都市伝統産業活性化補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KYOTO-DENTOU', '京都市伝統産業活性化補助金', 'KYOTO-CITY', '京都市', '26', '["subsidy","culture"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KYOTO-DENTOU', 'manual', '京都市伝統産業活性化補助金', 5000000, '2/3', '京都府京都市', '2026-04-01', '2026-12-31',
'{"overview":"京都の伝統産業事業者による新商品開発・販路開拓・後継者育成等を支援","target":"京都市内の伝統産業従事者・事業者","amount":"上限500万円（補助率2/3）","period":"令和8年度","url":"https://www.city.kyoto.lg.jp/sankan/","source":"京都市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KYOTO-DENTOU', 1);

-- #241 仙台市創業支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SENDAI-SOUGYOU', '仙台市創業支援補助金', 'SENDAI', '仙台市', '04', '["subsidy","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SENDAI-SOUGYOU', 'manual', '仙台市創業支援補助金', 1000000, '2/3', '宮城県仙台市', '2026-04-01', '2027-02-28',
'{"overview":"仙台市内で新たに創業する方の初期費用を支援","target":"仙台市内で創業予定又は創業後1年以内の個人・法人","amount":"上限100万円（補助率2/3）","period":"令和8年度","url":"https://www.city.sendai.jp/kikakushien/","source":"仙台市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SENDAI-SOUGYOU', 1);

-- #242 広島県ものづくり革新支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HIROSHIMA-MONO', '広島県ものづくり革新支援補助金', 'HIROSHIMA', '広島県', '34', '["subsidy","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HIROSHIMA-MONO', 'manual', '広島県ものづくり革新支援補助金', 10000000, '1/2', '広島県', '2026-05-01', '2026-12-31',
'{"overview":"広島県内の製造業者による新製品開発・生産性向上等を支援","target":"広島県内に事業所を有する中小製造業者","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","url":"https://www.pref.hiroshima.lg.jp/soshiki/","source":"広島県"}',
datetime('now'), datetime('now', '+90 days'), 90, 'HIROSHIMA-MONO', 1);

-- #243 千葉市テレワーク導入支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIBA-TELEWORK', '千葉市テレワーク導入支援補助金', 'CHIBA-CITY', '千葉市', '12', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIBA-TELEWORK', 'manual', '千葉市テレワーク導入支援補助金', 500000, '1/2', '千葉県千葉市', '2026-04-01', '2027-02-28',
'{"overview":"千葉市内の中小企業がテレワーク環境を整備する費用を補助","target":"千葉市内に事業所を有する中小企業","amount":"上限50万円（補助率1/2）","period":"令和8年度","url":"https://www.city.chiba.jp/keizainosei/","source":"千葉市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIBA-TELEWORK', 1);

-- #244 北九州市環境産業推進補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KITAKYUSHU-KANKYO', '北九州市環境産業推進補助金', 'KITAKYUSHU', '北九州市', '40', '["subsidy","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KITAKYUSHU-KANKYO', 'manual', '北九州市環境産業推進補助金', 5000000, '1/2', '福岡県北九州市', '2026-04-01', '2026-12-31',
'{"overview":"北九州市の環境・リサイクル関連産業の技術開発・事業化を支援","target":"北九州市内に事業所を有する中小企業","amount":"上限500万円（補助率1/2）","period":"令和8年度","url":"https://www.city.kitakyushu.lg.jp/kankyou/","source":"北九州市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KITAKYUSHU-KANKYO', 1);

-- #245 科研費（基盤研究C）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAKENHI-KIBAN-C', '科学研究費助成事業（基盤研究C）', 'MEXT', '文部科学省', '00', '["research","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAKENHI-KIBAN-C', 'manual', '科学研究費助成事業（基盤研究C）', 5000000, '定額', '全国', '2026-09-01', '2026-11-30',
'{"overview":"個人又は少人数の研究者が行う独創的・先駆的な研究を支援","target":"大学・研究機関の研究者","amount":"500万円以下（期間3年）","period":"毎年9月頃公募","url":"https://www.jsps.go.jp/j-grantsinaid/","source":"文部科学省・日本学術振興会"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAKENHI-KIBAN-C', 1);

-- #246 科研費（若手研究）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAKENHI-WAKATE', '科学研究費助成事業（若手研究）', 'MEXT', '文部科学省', '00', '["research","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAKENHI-WAKATE', 'manual', '科学研究費助成事業（若手研究）', 5000000, '定額', '全国', '2026-09-01', '2026-11-30',
'{"overview":"39歳以下の若手研究者が一人で行う研究計画を支援","target":"博士学位取得後8年未満又は39歳以下の研究者","amount":"500万円以下（期間2〜4年）","period":"毎年9月頃公募","url":"https://www.jsps.go.jp/j-grantsinaid/","source":"文部科学省・日本学術振興会"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAKENHI-WAKATE', 1);

-- #247 JST CREST
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JST-CREST', '戦略的創造研究推進事業（CREST）', 'JST', '科学技術振興機構', '00', '["research","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JST-CREST', 'manual', '戦略的創造研究推進事業（CREST）', 500000000, '定額', '全国', '2026-04-01', '2026-06-30',
'{"overview":"国が定めた戦略目標の達成に向けたチーム型研究を推進","target":"大学・研究機関の研究者チーム","amount":"1課題あたり1.5億〜5億円（5年半以内）","period":"毎年春頃公募","url":"https://www.jst.go.jp/kisoken/crest/","source":"JST"}',
datetime('now'), datetime('now', '+90 days'), 90, 'JST-CREST', 1);

-- #248 JST さきがけ
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JST-SAKIGAKE', '戦略的創造研究推進事業（さきがけ）', 'JST', '科学技術振興機構', '00', '["research","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JST-SAKIGAKE', 'manual', '戦略的創造研究推進事業（さきがけ）', 40000000, '定額', '全国', '2026-04-01', '2026-06-30',
'{"overview":"個人研究者による独立した個人型研究プログラム","target":"若手中心の個人研究者","amount":"3,000万〜4,000万円（3年半以内）","period":"毎年春頃公募","url":"https://www.jst.go.jp/kisoken/presto/","source":"JST"}',
datetime('now'), datetime('now', '+90 days'), 90, 'JST-SAKIGAKE', 1);

-- #249 ムーンショット型研究開発事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MOONSHOT-RD', 'ムーンショット型研究開発事業', 'CAO', '内閣府', '00', '["research","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MOONSHOT-RD', 'manual', 'ムーンショット型研究開発事業', 1000000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"2050年までの大胆な目標に向けた破壊的イノベーション創出","target":"大学・研究機関・企業の研究者","amount":"PM1人あたり年間数億〜数十億円","period":"随時公募","url":"https://www8.cao.go.jp/cstp/moonshot/","source":"内閣府（CSTI）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'MOONSHOT-RD', 1);

-- #250 SIP第3期
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SIP-PROGRAM', '戦略的イノベーション創造プログラム（SIP）第3期', 'CAO', '内閣府', '00', '["research","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SIP-PROGRAM', 'manual', '戦略的イノベーション創造プログラム（SIP）第3期', 500000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"府省連携のもと社会実装を目指す研究開発プログラム","target":"大学・研究機関・企業コンソーシアム","amount":"課題ごとに年間数億〜数十億円","period":"第3期進行中","url":"https://www8.cao.go.jp/cstp/gaiyo/sip/","source":"内閣府（CSTI）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SIP-PROGRAM', 1);

-- #251 NPO等活動基盤強化事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NPO-SHIEN', 'NPO等活動基盤強化事業', 'CAO', '内閣府', '00', '["subsidy","npo"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NPO-SHIEN', 'manual', 'NPO等活動基盤強化事業', 5000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"NPO法人等の組織基盤強化・活動促進を支援","target":"NPO法人、一般社団法人等","amount":"上限500万円","period":"令和8年度","url":"https://www.npo-homepage.go.jp/","source":"内閣府"}',
datetime('now'), datetime('now', '+90 days'), 90, 'NPO-SHIEN', 1);

-- #252 WAM助成
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('WAM-JOSEI', '社会福祉振興助成事業（WAM助成）', 'WAM', '福祉医療機構', '00', '["subsidy","health","npo"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('WAM-JOSEI', 'manual', '社会福祉振興助成事業（WAM助成）', 10000000, '定額', '全国', '2026-01-01', '2026-02-28',
'{"overview":"NPO・社会福祉法人等の先駆的事業を助成","target":"NPO法人、社会福祉法人等","amount":"通常50〜700万円、モデル事業上限1,000万円","period":"毎年1〜2月頃公募","url":"https://www.wam.go.jp/hp/cat/wamjosei/","source":"福祉医療機構"}',
datetime('now'), datetime('now', '+90 days'), 90, 'WAM-JOSEI', 1);

-- #253 休眠預金等活用事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KYUMIN-YOKIN', '休眠預金等活用事業', 'JANPIA', 'JANPIA', '00', '["subsidy","npo"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KYUMIN-YOKIN', 'manual', '休眠預金等活用事業', 50000000, '定額', '全国', '2026-04-01', '2026-08-31',
'{"overview":"10年以上取引のない休眠預金を活用し社会課題解決を支援","target":"NPO法人、一般社団法人等","amount":"数百万円〜数千万円","period":"年1〜2回公募","url":"https://www.janpia.or.jp/","source":"JANPIA"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KYUMIN-YOKIN', 1);

-- #254 中小企業組合等課題対応支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KUMIAI-KADAI', '中小企業組合等課題対応支援事業', 'SMRJ', '中小企業基盤整備機構', '00', '["subsidy","cooperative"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KUMIAI-KADAI', 'manual', '中小企業組合等課題対応支援事業', 5000000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"中小企業組合が抱える課題の解決を支援","target":"事業協同組合、商工組合等","amount":"上限500万円","period":"令和8年度","url":"https://www.chuokai.or.jp/","source":"中小企業基盤整備機構"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KUMIAI-KADAI', 1);

-- #255 ソーシャルビジネス支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SOCIAL-BIZ', 'ソーシャルビジネス支援事業', 'METI', '経済産業省', '00', '["subsidy","npo","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SOCIAL-BIZ', 'manual', 'ソーシャルビジネス支援事業', 3000000, '2/3', '全国', '2026-04-01', '2026-12-31',
'{"overview":"社会的課題をビジネスで解決するソーシャルビジネスを支援","target":"ソーシャルビジネスを行う中小企業・NPO等","amount":"上限300万円（補助率2/3）","period":"令和8年度","url":"https://www.meti.go.jp/policy/local_economy/sbcb/","source":"経済産業省"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SOCIAL-BIZ', 1);

-- #256 iDeCo（個人事業主向け）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('IDECO-KOJIN', '個人型確定拠出年金（iDeCo）', 'FSA', '金融庁', '00', '["finance","tax"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('IDECO-KOJIN', 'manual', '個人型確定拠出年金（iDeCo）', 816000, '全額所得控除', '全国', '2026-04-01', '2027-03-31',
'{"overview":"個人事業主が老後資金を積み立てながら税制優遇を受けられる制度","target":"20歳以上65歳未満の個人事業主","amount":"月額68,000円まで（年81.6万円）全額所得控除","period":"通年","url":"https://www.ideco-koushiki.jp/","source":"国民年金基金連合会"}',
datetime('now'), datetime('now', '+90 days'), 90, 'IDECO-KOJIN', 1);

-- #257 企業主導型保育事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KIGYOU-HOIKU', '企業主導型保育事業', 'CFA', 'こども家庭庁', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KIGYOU-HOIKU', 'manual', '企業主導型保育事業', 100000000, '3/4', '全国', '2026-04-01', '2027-03-31',
'{"overview":"企業が設置する事業所内保育所等の整備・運営費を助成","target":"法人格を有する事業主","amount":"整備費上限数千万〜1億円","period":"令和8年度","url":"https://www.kigyohoiku.jp/","source":"こども家庭庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KIGYOU-HOIKU', 1);

-- #258 病児保育事業補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BYOUJI-HOIKU', '病児保育事業補助金', 'CFA', 'こども家庭庁', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BYOUJI-HOIKU', 'manual', '病児保育事業補助金', 20000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"病気の子どもを預かる病児保育施設の運営・整備を支援","target":"市区町村、医療機関、NPO等","amount":"基本分年額約500万円＋加算","period":"令和8年度","url":"https://www.cfa.go.jp/policies/kosodateshien/","source":"こども家庭庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'BYOUJI-HOIKU', 1);

-- #259 子ども食堂等支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KODOMO-SHOKUDOU', '子ども食堂等子どもの居場所づくり支援事業', 'CFA', 'こども家庭庁', '00', '["subsidy","health","npo"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KODOMO-SHOKUDOU', 'manual', '子ども食堂等子どもの居場所づくり支援事業', 3000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"子ども食堂・学習支援等の子どもの居場所づくり活動を支援","target":"NPO法人、社会福祉法人、任意団体等","amount":"1箇所あたり年間100万〜300万円","period":"令和8年度","url":"https://www.cfa.go.jp/policies/kodomo-no-hinkon/","source":"こども家庭庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KODOMO-SHOKUDOU', 1);

-- #260 出産・子育て応援交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHUSSAN-OUEN', '出産・子育て応援交付金', 'CFA', 'こども家庭庁', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHUSSAN-OUEN', 'manual', '出産・子育て応援交付金', 100000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"妊娠届出時5万円、出生届出時5万円の計10万円相当を支給","target":"妊婦・0歳児の保護者","amount":"計10万円","period":"令和8年度（恒久化予定）","url":"https://www.cfa.go.jp/policies/shussan-kosodate/","source":"こども家庭庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHUSSAN-OUEN', 1);

-- #261 児童手当（拡充版）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JIDOU-TEATE', '児童手当（2024年10月拡充版）', 'CFA', 'こども家庭庁', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JIDOU-TEATE', 'manual', '児童手当（2024年10月拡充版）', 180000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"18歳まで延長・所得制限撤廃・第3子以降3万円に拡充","target":"18歳年度末までの児童を養育する保護者","amount":"0〜3歳未満月1.5万円、3歳〜高校生月1万円、第3子以降月3万円","period":"通年","url":"https://www.cfa.go.jp/policies/kosodateshien/jidouteate/","source":"こども家庭庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'JIDOU-TEATE', 1);

-- #262 蓄電池導入支援（家庭用）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIKUDENCHI-KATEI', '蓄電池導入支援事業（家庭用）', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","environment","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIKUDENCHI-KATEI', 'manual', '蓄電池導入支援事業（家庭用定置型）', 600000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"家庭用定置型蓄電池の導入費用を補助","target":"住宅に蓄電池を導入する個人・法人","amount":"1kWhあたり3.2〜3.7万円（上限60万円程度）","period":"令和8年度","url":"https://sii.or.jp/","source":"資源エネルギー庁（SII）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIKUDENCHI-KATEI', 1);

-- #263 水素ステーション整備支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SUISO-STATION', '水素ステーション整備支援事業', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","environment","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SUISO-STATION', 'manual', '水素ステーション整備支援事業', 350000000, '2/3', '全国', '2026-04-01', '2027-02-28',
'{"overview":"FCV向けの商用水素ステーション整備・運営を支援","target":"水素ステーション事業者","amount":"整備費上限3.5億円（補助率2/3）","period":"令和8年度","url":"https://www.cev-pc.or.jp/","source":"資源エネルギー庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SUISO-STATION', 1);

-- #264 カーボンリサイクル実証
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CARBON-RECYCLE', 'カーボンリサイクル実証研究事業', 'NEDO', 'NEDO', '00', '["subsidy","environment","research"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CARBON-RECYCLE', 'manual', 'カーボンリサイクル実証研究事業', 500000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"CO2を炭素資源として再利用する技術の実証研究を支援","target":"企業、大学、研究機関","amount":"1課題あたり数千万〜数億円","period":"令和8年度","url":"https://www.nedo.go.jp/","source":"NEDO"}',
datetime('now'), datetime('now', '+90 days'), 90, 'CARBON-RECYCLE', 1);

-- #265 洋上風力発電導入支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('YOUJOU-FURYOKU', '洋上風力発電人材育成・導入支援事業', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","environment","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('YOUJOU-FURYOKU', 'manual', '洋上風力発電人材育成・導入基盤整備事業', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"洋上風力発電の導入拡大に向けた人材育成、基盤技術開発を支援","target":"洋上風力発電関連事業者、研究機関","amount":"数千万〜数億円","period":"令和8年度","url":"https://www.enecho.meti.go.jp/category/saving_and_new/saiene/yojofuryoku/","source":"資源エネルギー庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'YOUJOU-FURYOKU', 1);

-- #266 地熱発電導入支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHINETSU-HATSUDEN', '地熱発電導入支援事業', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","environment","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHINETSU-HATSUDEN', 'manual', '地熱発電導入支援事業', 500000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地熱発電の資源調査・掘削・発電所建設等を支援","target":"地熱発電事業者、地方公共団体","amount":"調査・掘削・建設費補助率1/2","period":"令和8年度","url":"https://www.jogmec.go.jp/geothermal/","source":"資源エネルギー庁（JOGMEC）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHINETSU-HATSUDEN', 1);

-- #267 働き方改革（業種別課題対応）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HATARAKIKATA-GYOUSHU', '働き方改革推進支援助成金（業種別課題対応コース）', 'MHLW', '厚生労働省', '00', '["employment","subsidy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HATARAKIKATA-GYOUSHU', 'manual', '働き方改革推進支援助成金（業種別課題対応コース）', 1500000, '3/4', '全国', '2026-04-01', '2026-11-30',
'{"overview":"建設業・運送業・医師等の業種における労働時間短縮を支援","target":"2024年4月上限規制適用業種の中小企業","amount":"上限150万円（補助率3/4）","period":"令和8年度","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html","source":"厚生労働省"}',
datetime('now'), datetime('now', '+90 days'), 90, 'HATARAKIKATA-GYOUSHU', 1);

-- #268 副業・兼業支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FUKUGYOU-KENGYOU', '副業・兼業支援補助金', 'MHLW', '厚生労働省', '00', '["employment","subsidy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FUKUGYOU-KENGYOU', 'manual', '副業・兼業支援補助金', 1000000, '2/3', '全国', '2026-04-01', '2026-12-31',
'{"overview":"副業・兼業を認める企業の環境整備を支援","target":"副業・兼業を新たに認める中小企業","amount":"上限100万円（補助率2/3）","period":"令和8年度","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192188.html","source":"厚生労働省"}',
datetime('now'), datetime('now', '+90 days'), 90, 'FUKUGYOU-KENGYOU', 1);

-- #269 65歳超雇用推進助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOUREISHA-65CHO', '65歳超雇用推進助成金（継続雇用促進コース）', 'MHLW', '厚生労働省', '00', '["employment","subsidy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOUREISHA-65CHO', 'manual', '65歳超雇用推進助成金（65歳超継続雇用促進コース）', 1600000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"65歳以上への定年引上げ、定年廃止等を行う事業主を助成","target":"定年引上げ等を実施する事業主","amount":"25万〜160万円","period":"通年","url":"https://www.jeed.go.jp/elderly/subsidy/","source":"厚生労働省（JEED）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOUREISHA-65CHO', 1);

-- #270 観光地再生・高付加価値化事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KANKOU-SAISEI', '観光地再生・高付加価値化事業', 'MLIT', '国土交通省', '00', '["subsidy","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KANKOU-SAISEI', 'manual', '観光地再生・高付加価値化事業', 500000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"宿泊施設改修、観光コンテンツ造成等の観光地再生を支援","target":"DMO、宿泊事業者、地方公共団体","amount":"1地域上限5億円（補助率1/2）","period":"令和8年度","url":"https://www.mlit.go.jp/kankocho/","source":"国土交通省観光庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KANKOU-SAISEI', 1);

-- #271 インバウンド受入環境整備
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('INBOUND-KANKYOU', '訪日外国人旅行者受入環境整備補助金', 'MLIT', '国土交通省', '00', '["subsidy","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('INBOUND-KANKYOU', 'manual', '訪日外国人旅行者受入環境整備補助金', 20000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"多言語対応、Wi-Fi整備、キャッシュレス対応等を支援","target":"観光関連事業者、交通事業者","amount":"上限2,000万円（補助率1/2）","period":"令和8年度","url":"https://www.mlit.go.jp/kankocho/","source":"国土交通省観光庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'INBOUND-KANKYOU', 1);

-- #272 ワーケーション等促進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('WORKATION', 'ワーケーション等促進事業', 'MLIT', '国土交通省', '00', '["subsidy","tourism","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('WORKATION', 'manual', 'ワーケーション等促進事業', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"テレワーク×観光のワーケーション受入環境整備を支援","target":"地方公共団体、観光事業者、宿泊施設","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","url":"https://www.mlit.go.jp/kankocho/","source":"国土交通省観光庁"}',
datetime('now'), datetime('now', '+90 days'), 90, 'WORKATION', 1);

-- #273 MICE誘致支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('MICE-YUCHI', 'MICE誘致・開催支援事業', 'MLIT', '国土交通省', '00', '["subsidy","tourism"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('MICE-YUCHI', 'manual', 'MICE誘致・開催支援事業', 30000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"国際会議・展示会等のMICE誘致・開催を支援","target":"MICE主催者、コンベンションビューロー","amount":"上限3,000万円（補助率1/2）","period":"令和8年度","url":"https://mice.jnto.go.jp/","source":"国土交通省観光庁・JNTO"}',
datetime('now'), datetime('now', '+90 days'), 90, 'MICE-YUCHI', 1);

-- #274 産業保健活動総合支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SANGYOU-HOKEN-SOUGOU', '産業保健活動総合支援事業', 'MHLW', '厚生労働省', '00', '["employment","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SANGYOU-HOKEN-SOUGOU', 'manual', '産業保健活動総合支援事業（無料支援）', NULL, '無料', '全国', '2026-04-01', '2027-03-31',
'{"overview":"産業医・産業保健スタッフ等による企業の産業保健活動を無料で支援","target":"全事業場（特に小規模事業場）","amount":"相談・研修・訪問支援全て無料","period":"通年","url":"https://www.johas.go.jp/","source":"厚生労働省（労働者健康安全機構）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SANGYOU-HOKEN-SOUGOU', 1);

-- #275 地域づくり活動支援体制整備
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-KATSUDOU', '地域づくり活動支援体制整備事業', 'MIC', '総務省', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-KATSUDOU', 'manual', '地域づくり活動支援体制整備事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域おこし協力隊OB等による地域づくり活動の支援体制整備","target":"地方公共団体、NPO法人等","amount":"上限1,000万円","period":"令和8年度","url":"https://www.soumu.go.jp/main_sosiki/jichi_gyousei/","source":"総務省"}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-KATSUDOU', 1);

-- #276 フリーランス保護支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('FREELANCE-HOGO', 'フリーランス事業者取引適正化支援', 'KOUTORI', '公正取引委員会', '00', '["subsidy","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('FREELANCE-HOGO', 'manual', 'フリーランス事業者の取引適正化支援', NULL, NULL, '全国', '2026-04-01', '2027-03-31',
'{"overview":"フリーランス新法に基づく取引環境整備・相談支援","target":"フリーランス（個人事業主）","amount":"相談無料","period":"通年","url":"https://freelance110.jp/","source":"公正取引委員会・厚生労働省"}',
datetime('now'), datetime('now', '+90 days'), 90, 'FREELANCE-HOGO', 1);

-- #277 個人事業主持続化補助金（創業枠）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JIZOKUKA-SOUGYOU-KOJIN', '小規模事業者持続化補助金（創業枠・個人事業主向け）', 'SMRJ', '中小企業基盤整備機構', '00', '["subsidy","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JIZOKUKA-SOUGYOU-KOJIN', 'manual', '小規模事業者持続化補助金（創業枠・個人事業主向け）', 2000000, '2/3', '全国', '2026-04-01', '2026-12-31',
'{"overview":"創業3年以内の個人事業主の販路開拓を支援","target":"創業3年以内の個人事業主","amount":"上限200万円（補助率2/3）","period":"年4回程度公募","url":"https://r3.jizokukahojokin.info/","source":"中小企業基盤整備機構"}',
datetime('now'), datetime('now', '+90 days'), 90, 'JIZOKUKA-SOUGYOU-KOJIN', 1);

-- #278 事業復活支援金（緊急時）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JIGYOU-FUKKATSU', '事業復活支援金（緊急経済対策）', 'METI', '経済産業省', '00', '["subsidy","emergency"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JIGYOU-FUKKATSU', 'manual', '事業復活支援金・一時支援金（緊急経済対策時）', 500000, '定額', '全国', NULL, NULL,
'{"overview":"経済危機・自然災害時に売上減少を補填する支援金（平時は休止）","target":"個人事業主・中小企業","amount":"個人上限50万円、法人上限250万円","period":"緊急時に随時発動","url":"https://www.meti.go.jp/covid-19/","source":"経済産業省"}',
datetime('now'), datetime('now', '+90 days'), 90, 'JIGYOU-FUKKATSU', 1);

-- #279 充電インフラ整備
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JUDEN-INFRA-JISEDAI', '次世代自動車充電インフラ整備促進事業', 'METI', '経済産業省', '00', '["subsidy","environment","mobility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JUDEN-INFRA-JISEDAI', 'manual', '次世代自動車充電インフラ整備促進事業', 15000000, '1/2', '全国', '2026-04-01', '2027-02-28',
'{"overview":"EV・PHV用急速充電器・普通充電器の設置費用を補助","target":"充電設備を設置する法人・個人・地方公共団体","amount":"急速充電器上限1,500万円（補助率1/2）","period":"令和8年度","url":"https://www.cev-pc.or.jp/","source":"経済産業省（NeV）"}',
datetime('now'), datetime('now', '+90 days'), 90, 'JUDEN-INFRA-JISEDAI', 1);

-- #280 札幌市中小企業振興補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SAPPORO-SME', '札幌市中小企業振興補助金', 'SAPPORO', '札幌市', '01', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SAPPORO-SME', 'manual', '札幌市中小企業振興補助金', 3000000, '1/2', '北海道札幌市', '2026-04-01', '2027-02-28',
'{"overview":"札幌市内の中小企業の経営改善・新事業展開を支援","target":"札幌市内に事業所を有する中小企業","amount":"上限300万円（補助率1/2）","period":"令和8年度","url":"https://www.city.sapporo.jp/keizai/","source":"札幌市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SAPPORO-SME', 1);

-- #281 浜松市産業イノベーション補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HAMAMATSU-INNOV', '浜松市産業イノベーション補助金', 'HAMAMATSU', '浜松市', '22', '["subsidy","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HAMAMATSU-INNOV', 'manual', '浜松市産業イノベーション補助金', 5000000, '1/2', '静岡県浜松市', '2026-04-01', '2026-12-31',
'{"overview":"浜松市内の中小企業による新製品・新技術開発を支援","target":"浜松市内に事業所を有する中小企業","amount":"上限500万円（補助率1/2）","period":"令和8年度","url":"https://www.city.hamamatsu.shizuoka.jp/sangyo/","source":"浜松市"}',
datetime('now'), datetime('now', '+90 days'), 90, 'HAMAMATSU-INNOV', 1);

-- #282 新潟県事業承継支援補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NIIGATA-SHOKEI', '新潟県事業承継支援補助金', 'NIIGATA', '新潟県', '15', '["subsidy","succession"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NIIGATA-SHOKEI', 'manual', '新潟県事業承継支援補助金', 2000000, '2/3', '新潟県', '2026-04-01', '2027-02-28',
'{"overview":"新潟県内の中小企業の事業承継に係る費用を支援","target":"新潟県内の事業承継予定の中小企業","amount":"上限200万円（補助率2/3）","period":"令和8年度","url":"https://www.pref.niigata.lg.jp/sec/sangyoseisaku/","source":"新潟県"}',
datetime('now'), datetime('now', '+90 days'), 90, 'NIIGATA-SHOKEI', 1);

-- #283 長野県信州リゾートテレワーク実践支援金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NAGANO-TELEWORK', '長野県信州リゾートテレワーク実践支援金', 'NAGANO', '長野県', '20', '["subsidy","digital","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NAGANO-TELEWORK', 'manual', '長野県信州リゾートテレワーク実践支援金', 500000, '1/2', '長野県', '2026-04-01', '2027-02-28',
'{"overview":"長野県内でリゾートテレワークを実施する企業を支援","target":"長野県内でリゾートテレワークを実施する企業","amount":"上限50万円（補助率1/2）","period":"令和8年度","url":"https://www.pref.nagano.lg.jp/sansei/resort-telework/","source":"長野県"}',
datetime('now'), datetime('now', '+90 days'), 90, 'NAGANO-TELEWORK', 1);

-- #284 岡山県デジタル人材育成補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('OKAYAMA-DX-JINZAI', '岡山県デジタル人材育成補助金', 'OKAYAMA', '岡山県', '33', '["subsidy","digital","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('OKAYAMA-DX-JINZAI', 'manual', '岡山県デジタル人材育成補助金', 1000000, '2/3', '岡山県', '2026-04-01', '2026-12-31',
'{"overview":"岡山県内の中小企業のデジタル人材育成費用を支援","target":"岡山県内に事業所を有する中小企業","amount":"上限100万円（補助率2/3）","period":"令和8年度","url":"https://www.pref.okayama.jp/soshiki/list14.html","source":"岡山県"}',
datetime('now'), datetime('now', '+90 days'), 90, 'OKAYAMA-DX-JINZAI', 1);

-- #285 静岡県次世代産業創出支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SHIZUOKA-JISEDAI', '静岡県次世代産業創出支援事業', 'SHIZUOKA', '静岡県', '22', '["subsidy","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SHIZUOKA-JISEDAI', 'manual', '静岡県次世代産業創出支援事業', 10000000, '1/2', '静岡県', '2026-04-01', '2026-12-31',
'{"overview":"静岡県内の次世代産業（MaaS、医療機器、光技術等）の創出を支援","target":"静岡県内に事業所を有する中小企業","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","url":"https://www.pref.shizuoka.jp/sangyou/","source":"静岡県"}',
datetime('now'), datetime('now', '+90 days'), 90, 'SHIZUOKA-JISEDAI', 1);

-- #286 熊本県半導体関連産業集積支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KUMAMOTO-HANDOUTAI', '熊本県半導体関連産業集積支援補助金', 'KUMAMOTO', '熊本県', '43', '["subsidy","manufacturing","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KUMAMOTO-HANDOUTAI', 'manual', '熊本県半導体関連産業集積支援補助金', 50000000, '1/2', '熊本県', '2026-04-01', '2027-03-31',
'{"overview":"TSMC進出に伴う熊本県内の半導体関連産業の集積を支援","target":"半導体関連企業の設備投資、人材育成","amount":"上限5,000万円（補助率1/2）","period":"令和8年度","url":"https://www.pref.kumamoto.jp/soshiki/47/","source":"熊本県"}',
datetime('now'), datetime('now', '+90 days'), 90, 'KUMAMOTO-HANDOUTAI', 1);

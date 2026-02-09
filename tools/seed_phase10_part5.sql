-- Phase 10 Part 5: 新規55件（#437〜#491）- 残り104件のうち前半55件
-- カテゴリ: 電力・ガス、知財・国際標準化、物価対策、地方銀行連携、
--           学校・教育施設、介護・高齢者追加、年金・社会保障、規制改革

-- ====== 1. 電力・ガス・ユーティリティ (6件) ======

-- #437 電力需給ひっ迫対策事業（ネガワット取引等）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('NEGAWATT-TORIHIKI', '電力需給ひっ迫対策事業（ネガワット取引推進）', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('NEGAWATT-TORIHIKI', 'manual', '電力需給ひっ迫対策事業（ネガワット取引・DR推進）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"電力需給ひっ迫時のデマンドレスポンス（需要調整）やネガワット取引の仕組み構築を支援","target":"電力事業者、需要家、アグリゲーター","amount":"DR設備導入等に対する支援","period":"令和8年度","application":"資源エネルギー庁に申請","url":"https://www.enecho.meti.go.jp/","source":"資源エネルギー庁","requirements":["デマンドレスポンスへの参加","電力需給調整への貢献","スマートメーター等の活用"],"documents":["DR参加計画書","設備仕様書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'NEGAWATT-TORIHIKI', 1);

-- #438 再エネ電力利用拡大推進事業（RE100等）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('RE100-SUISHIN', '再エネ電力利用拡大推進事業', 'MOE', '環境省', '00', '["subsidy","environment","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('RE100-SUISHIN', 'manual', '再エネ電力利用拡大推進事業（RE100・再エネ100%電力調達）', 50000000, '1/2', '全国', '2026-04-01', '2027-03-31',
'{"overview":"企業の再エネ100%電力調達（RE100等）に向けた自家消費型太陽光・PPA等の導入を支援","target":"RE100宣言企業、脱炭素に取り組む企業","amount":"上限5,000万円（補助率1/2）","period":"令和8年度","application":"環境省に申請","url":"https://www.env.go.jp/earth/","source":"環境省","requirements":["再エネ電力比率の向上計画","自家消費型再エネの導入","CO2排出削減目標の設定"],"documents":["再エネ導入計画書","設備仕様書","CO2削減効果試算","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'RE100-SUISHIN', 1);

-- #439 ペロブスカイト太陽電池実証事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('PEROVSKITE-JISSHOU', 'ペロブスカイト太陽電池実証事業', 'NEDO', 'NEDO', '00', '["research","energy","environment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('PEROVSKITE-JISSHOU', 'manual', 'ペロブスカイト太陽電池実証事業（次世代太陽電池）', 500000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"軽量・フレキシブルなペロブスカイト太陽電池の社会実装に向けた実証を支援","target":"ペロブスカイト太陽電池メーカー、建材メーカー、研究機関","amount":"数億〜数十億円規模","period":"令和6年度〜（複数年度）","application":"NEDO公募","url":"https://www.nedo.go.jp/","source":"NEDO","requirements":["ペロブスカイト太陽電池の実証","建物壁面等への設置実証","耐久性・安全性の検証"],"documents":["研究開発計画書","実証計画書","設備仕様書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'PEROVSKITE-JISSHOU', 1);

-- #440 VPP（バーチャルパワープラント）構築事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('VPP-KOUCHIKU', 'VPP構築実証事業', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","energy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('VPP-KOUCHIKU', 'manual', 'VPP（バーチャルパワープラント）構築実証事業', 50000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"分散型エネルギーリソースを統合制御するVPPの構築・実証を支援","target":"VPPアグリゲーター、電力事業者、IT企業","amount":"上限5,000万円（補助率2/3）","period":"令和8年度","application":"資源エネルギー庁に申請","url":"https://www.enecho.meti.go.jp/","source":"資源エネルギー庁","requirements":["VPPの構築・実証","分散型リソースの統合制御","電力市場への参加計画"],"documents":["VPP構築計画書","技術仕様書","市場参加計画","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'VPP-KOUCHIKU', 1);

-- #441 電気自動車用V2H補助金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('V2H-HOJO', 'V2H充放電設備導入補助金', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","energy","mobility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('V2H-HOJO', 'manual', 'V2H充放電設備導入補助金', 750000, '定額', '全国', '2026-04-01', '2027-02-28',
'{"overview":"EV・PHVの蓄電池から住宅に放電するV2H設備の導入費用を補助","target":"V2H設備を導入する個人・法人","amount":"設備費：上限75万円（補助率1/2）＋工事費補助","period":"令和8年度","application":"次世代自動車振興センター（NeV）に申請","url":"https://www.cev-pc.or.jp/","source":"資源エネルギー庁（NeV）","requirements":["V2H対応EV/PHVの保有","V2H充放電設備の導入","住宅又は事業所への設置"],"documents":["交付申請書","V2H設備仕様書","見積書","車検証の写し"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'V2H-HOJO', 1);

-- #442 GX経済移行債活用事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('GX-IKOU-SAI', 'GX経済移行債活用事業', 'METI', '経済産業省', '00', '["subsidy","environment","energy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('GX-IKOU-SAI', 'manual', 'GX経済移行債活用事業（20兆円規模の官民GX投資）', 100000000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"GX（グリーントランスフォーメーション）経済移行債（10年間で20兆円規模）を原資としたGX関連投資支援","target":"GX関連の設備投資・研究開発を行う企業","amount":"プロジェクトごとに数億〜数千億円規模","period":"令和5年度〜令和14年度（10年間）","application":"経済産業省・NEDO等","url":"https://www.meti.go.jp/policy/energy_environment/global_warming/GX/","source":"経済産業省","requirements":["GXに資する設備投資又は研究開発","CO2排出削減への貢献","民間投資の誘発効果"],"documents":["事業計画書","CO2削減計画","投資計画書","効果試算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'GX-IKOU-SAI', 1);

-- ====== 2. 知財・標準化・ブランド (5件) ======

-- #443 知的財産活用支援事業（INPIT支援）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('INPIT-SHIEN', '知的財産活用支援事業（INPIT支援）', 'METI', '経済産業省', '00', '["subsidy","ip"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('INPIT-SHIEN', 'manual', '知的財産活用支援事業（知財総合支援窓口・INPIT）', NULL, '無料', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の知的財産に関する相談・支援を知財総合支援窓口で無料提供","target":"中小企業・個人事業主・スタートアップ","amount":"相談無料、弁理士派遣無料","period":"通年","application":"各都道府県の知財総合支援窓口","url":"https://chizai-portal.inpit.go.jp/","source":"経済産業省（INPIT）","requirements":["知的財産に関する課題","中小企業等であること"],"documents":["特に不要（窓口相談は予約制）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'INPIT-SHIEN', 1);

-- #444 国際標準化活動支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOKUSAI-HYOUJUNKA', '国際標準化活動支援事業', 'METI', '経済産業省', '00', '["subsidy","technology","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOKUSAI-HYOUJUNKA', 'manual', '国際標準化活動支援事業（ISO/IEC等）', 20000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"日本企業の技術を国際標準（ISO・IEC等）として提案・獲得する活動を支援","target":"国際標準化活動に参加する企業・研究機関","amount":"上限2,000万円","period":"令和8年度","application":"経済産業省・産総研に申請","url":"https://www.meti.go.jp/policy/economy/hyojun-kijun/","source":"経済産業省","requirements":["国際標準への提案計画","日本の技術優位性","産業界の合意"],"documents":["標準化戦略書","技術仕様書","活動計画書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOKUSAI-HYOUJUNKA', 1);

-- #445 地域団体商標活用支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIIKI-DANTAI-SHOUYHYOU', '地域団体商標活用支援事業', 'METI', '経済産業省', '00', '["subsidy","ip","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIIKI-DANTAI-SHOUYHYOU', 'manual', '地域団体商標活用支援事業（地域ブランド構築）', 3000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地域団体商標を活用した地域ブランドの構築・普及啓発活動を支援","target":"地域団体商標権者（組合等）、地方公共団体","amount":"上限300万円（補助率2/3）","period":"令和8年度","application":"特許庁・各経済産業局に申請","url":"https://www.jpo.go.jp/system/trademark/gaiyo/chidan/","source":"経済産業省（特許庁）","requirements":["地域団体商標の登録","ブランド活用計画の策定","地域一体となった取組"],"documents":["ブランド活用計画書","商標登録証","活動計画書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-DANTAI-SHOUYHYOU', 1);

-- #446 JAPANブランド育成支援等事業（海外展開）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('JAPAN-BRAND-IKUSEI', 'JAPANブランド育成支援等事業', 'METI', '経済産業省', '00', '["subsidy","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('JAPAN-BRAND-IKUSEI', 'manual', 'JAPANブランド育成支援等事業（海外展開・インバウンド需要獲得）', 5000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業の海外展開・インバウンド需要獲得に向けたブランディング・マーケティング活動を支援","target":"海外展開を目指す中小企業","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"中小企業庁指定の事務局に申請","url":"https://www.chusho.meti.go.jp/keiei/sapoin/","source":"経済産業省","requirements":["海外展開又はインバウンド対策","ブランディング計画の策定","海外市場調査の実施"],"documents":["事業計画書","海外展開計画","ブランド戦略書","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'JAPAN-BRAND-IKUSEI', 1);

-- #447 意匠・デザイン活用支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('ISHOU-DESIGN', '意匠・デザイン活用支援事業', 'METI', '経済産業省', '00', '["subsidy","ip","design"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('ISHOU-DESIGN', 'manual', '意匠・デザイン経営実践支援事業', 5000000, '2/3', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小企業のデザイン経営（意匠戦略・デザイン思考）の実践を支援","target":"デザイン経営に取り組む中小企業","amount":"上限500万円（補助率2/3）","period":"令和8年度","application":"特許庁に申請","url":"https://www.jpo.go.jp/","source":"経済産業省（特許庁）","requirements":["デザイン経営の実践計画","意匠権の活用","外部デザイナーとの連携"],"documents":["デザイン経営計画書","意匠出願計画","見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'ISHOU-DESIGN', 1);

-- ====== 3. 物価高騰対策・生活支援 (6件) ======

-- #448 電力・ガス・食料品等価格高騰重点支援地方交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('BUKKA-JUUTEN', '電力・ガス・食料品等価格高騰重点支援地方交付金', 'CAO', '内閣府', '00', '["subsidy","emergency","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('BUKKA-JUUTEN', 'manual', '電力・ガス・食料品等価格高騰重点支援地方交付金', NULL, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"物価高騰の影響を受ける生活者・事業者を支援するための地方交付金","target":"各自治体が対象を決定（住民・事業者）","amount":"各自治体の裁量により支援内容・金額を決定","period":"経済対策に応じて随時","application":"各自治体の窓口","url":"https://www.chisou.go.jp/tiiki/rinjikoufukin/","source":"内閣府","requirements":["物価高騰の影響を受ける住民・事業者","各自治体の実施計画に基づく"],"documents":["各自治体が定める申請書類"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'BUKKA-JUUTEN', 1);

-- #449 住民税非課税世帯等給付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('HIKAZEI-KYUFUKIN', '住民税非課税世帯等給付金', 'CAO', '内閣府', '00', '["subsidy","emergency"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('HIKAZEI-KYUFUKIN', 'manual', '住民税非課税世帯等給付金（物価高騰対策）', 100000, '定額', '全国', NULL, NULL,
'{"overview":"物価高騰の影響を受ける住民税非課税世帯等に対する臨時の給付金（経済対策時に随時実施）","target":"住民税非課税世帯、家計急変世帯","amount":"1世帯あたり3万円〜10万円（経済対策により変動）","period":"経済対策に応じて随時","application":"お住まいの市区町村に申請","url":"各自治体のホームページ","source":"内閣府","requirements":["住民税非課税世帯又は均等割のみ課税世帯","基準日に住民登録があること"],"documents":["申請書（プッシュ型の場合は確認書）","本人確認書類","振込先口座情報"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'HIKAZEI-KYUFUKIN', 1);

-- #450 定額減税
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TEIGAKU-GENZEI', '定額減税', 'MOF', '財務省', '00', '["tax"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TEIGAKU-GENZEI', 'manual', '定額減税（所得税・住民税の定額減税措置）', 40000, '定額', '全国', '2024-06-01', '2025-03-31',
'{"overview":"2024年6月から実施の所得税3万円・住民税1万円の定額減税措置","target":"合計所得金額1,805万円以下の納税者本人及び扶養親族","amount":"所得税3万円＋住民税1万円（1人あたり計4万円）","period":"令和6年6月〜","application":"自動適用（給与所得者は源泉徴収で対応）","url":"https://www.nta.go.jp/users/gensen/teigakugenzei/","source":"財務省・国税庁","requirements":["合計所得金額1,805万円以下","日本国内に住所を有すること"],"documents":["特に不要（給与所得者は年末調整で精算）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TEIGAKU-GENZEI', 1);

-- #451 学校給食費支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KYUUSHOKU-SHIEN', '学校給食費支援事業', 'MEXT', '文部科学省', '00', '["subsidy","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KYUUSHOKU-SHIEN', 'manual', '学校給食費支援事業（物価高騰対策・無償化推進）', NULL, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"物価高騰に伴う学校給食費の値上げ抑制、給食費無償化に向けた自治体支援","target":"市区町村（教育委員会）","amount":"各自治体の裁量（重点支援地方交付金等を活用）","period":"令和8年度","application":"各自治体が実施","url":"https://www.mext.go.jp/a_menu/sports/syokuiku/","source":"文部科学省","requirements":["学校給食の実施","給食費の値上げ抑制又は無償化の取組"],"documents":["実施計画書（自治体が策定）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KYUUSHOKU-SHIEN', 1);

-- #452 低所得世帯向け学び直し支援
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TEISHOTOKU-MANABI', '低所得世帯向け学び直し支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","education","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TEISHOTOKU-MANABI', 'manual', '求職者支援訓練（低所得者向けスキルアップ）', 100000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"雇用保険を受給できない方が無料の職業訓練を受けながら月10万円の給付金を受給","target":"雇用保険の受給資格がない求職者（非正規・離職者等）","amount":"職業訓練受講給付金：月10万円＋通所手当＋寄宿手当","period":"通年","application":"ハローワークに申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyushokusha_shien/","source":"厚生労働省","requirements":["ハローワークに求職申込","雇用保険の受給資格がないこと","収入・資産要件を満たすこと"],"documents":["受講申込書","本人確認書類","収入証明書・資産申告書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TEISHOTOKU-MANABI', 1);

-- #453 生活困窮者自立支援事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SEIKATSU-KONKYUU', '生活困窮者自立支援事業', 'MHLW', '厚生労働省', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SEIKATSU-KONKYUU', 'manual', '生活困窮者自立支援事業（住居確保給付金等）', 530000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"生活困窮者に対する包括的な支援（住居確保給付金・就労支援・家計改善支援等）","target":"生活に困窮する方（生活保護に至る前の段階）","amount":"住居確保給付金：家賃相当額（地域により上限：東京都特別区で単身53,700円等、3ヶ月＋延長最大9ヶ月）","period":"通年","application":"お住まいの市区町村の自立相談支援窓口","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000073432.html","source":"厚生労働省","requirements":["離職・廃業後2年以内又は収入が減少した方","求職活動を行うこと","収入・資産要件を満たすこと"],"documents":["申請書","離職票又は収入減少証明","住民票","収入証明書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SEIKATSU-KONKYUU', 1);

-- ====== 4. 残り追加分（重要制度の網羅） (38件) ======

-- #454 高年齢者雇用安定助成金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KOUNENREI-KOYOU', '高年齢者雇用安定助成金', 'MHLW', '厚生労働省', '00', '["subsidy","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KOUNENREI-KOYOU', 'manual', '高年齢者雇用安定助成金（高年齢者活躍環境整備支援コース）', 600000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"高年齢者が働きやすい環境の整備（作業設備の改善・健康管理制度の導入等）を支援","target":"60歳以上の高年齢者を雇用する事業主","amount":"上限60万円（中小企業：2/3、大企業：1/2）","period":"通年","application":"独立行政法人高齢・障害・求職者雇用支援機構（JEED）","url":"https://www.jeed.go.jp/elderly/subsidy/","source":"厚生労働省（JEED）","requirements":["60歳以上の雇用環境改善措置","就業規則等の整備","雇用管理整備計画の策定"],"documents":["支給申請書","雇用管理整備計画書","就業規則","設備等の見積書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KOUNENREI-KOYOU', 1);

-- #455 地方大学・地域産業創生交付金
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHIHOU-DAIGAKU', '地方大学・地域産業創生交付金', 'CAO', '内閣府', '00', '["subsidy","education","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHIHOU-DAIGAKU', 'manual', '地方大学・地域産業創生交付金', 100000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"地方大学を核とした地域産業の創生、若者の地域定着を促進する事業を支援","target":"都道府県（大学・産業界との連携）","amount":"1事業あたり年間数千万円〜1億円","period":"令和8年度","application":"内閣府に申請","url":"https://www.chisou.go.jp/sousei/about/daigaku/","source":"内閣府","requirements":["産官学連携体制の構築","地域産業の創生","若者の地域定着促進"],"documents":["事業計画書","産官学連携体制図","KPI設定書","予算書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHIHOU-DAIGAKU', 1);

-- #456〜#491 省略形式で残り36件を一括追加

-- #456 中小企業の特定ものづくり基盤技術高度化指針
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOKUTEI-MONO-SHISHIN', '特定ものづくり基盤技術高度化指針認定', 'METI', '経済産業省', '00', '["certification","manufacturing"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOKUTEI-MONO-SHISHIN', 'manual', '特定ものづくり基盤技術高度化指針（戦略的基盤技術）認定制度', NULL, '認定制度', '全国', '2026-04-01', '2027-03-31',
'{"overview":"中小ものづくり高度化法に基づく特定研究開発等計画の認定により各種支援措置を受けられる","target":"中小企業の特定ものづくり基盤技術に関する研究開発","amount":"認定により日本公庫低利融資、信用保証特例、税制優遇等","period":"通年","application":"各経済産業局に認定申請","url":"https://www.chusho.meti.go.jp/keiei/sapoin/","source":"経済産業省","requirements":["特定ものづくり基盤技術に関する研究開発","川下製造業者との連携","研究開発等計画の策定"],"documents":["特定研究開発等計画認定申請書","研究開発計画書","川下連携計画"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOKUTEI-MONO-SHISHIN', 1);

-- #457 海外展開・事業再編資金（日本公庫）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KAIGAI-TENKAI-YUSHI', '海外展開・事業再編資金', 'JFC', '日本政策金融公庫', '00', '["finance","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KAIGAI-TENKAI-YUSHI', 'manual', '海外展開・事業再編資金（日本政策金融公庫）', 720000000, '低利融資', '全国', '2026-04-01', '2027-03-31',
'{"overview":"海外への事業展開・事業再編を行う中小企業への低利融資","target":"海外展開又は事業再編を行う中小企業","amount":"中小企業事業：7億2,000万円、国民生活事業：7,200万円","period":"通年","application":"日本政策金融公庫の各支店","url":"https://www.jfc.go.jp/","source":"日本政策金融公庫","requirements":["海外展開計画又は事業再編計画","償還能力","事業の実現可能性"],"documents":["融資申込書","海外展開計画書","決算書","資金使途明細"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KAIGAI-TENKAI-YUSHI', 1);

-- #458 SBIR（Small Business Innovation Research）制度
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SBIR-SEIDO', 'SBIR制度（中小企業技術革新制度）', 'METI', '経済産業省', '00', '["subsidy","research","startup"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SBIR-SEIDO', 'manual', 'SBIR制度（日本版・中小企業技術革新制度）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"政府の研究開発課題に対して中小・スタートアップが提案する研究開発を支援するSBIR制度","target":"中小企業、スタートアップ","amount":"Phase1：〜数千万円、Phase2：〜5,000万円、Phase3：調達等","period":"各省庁が随時公募","application":"各省庁のSBIR指定課題に応募","url":"https://www8.cao.go.jp/cstp/stmain/sbir.html","source":"内閣府（各省庁）","requirements":["SBIR指定補助金等の公募に応募","革新的な技術提案","政府ニーズへの対応"],"documents":["研究開発提案書","事業計画書","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SBIR-SEIDO', 1);

-- #459 産学連携イノベーション推進事業
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('SANGAKU-INNOVATION', '産学連携イノベーション推進事業', 'MEXT', '文部科学省', '00', '["research","education","technology"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('SANGAKU-INNOVATION', 'manual', '産学連携イノベーション推進事業（オープンイノベーション機構等）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"大学と企業の本格的な産学連携によるイノベーション創出を支援","target":"大学・研究機関と企業の連携体","amount":"上限5,000万円","period":"令和8年度","application":"文部科学省に申請","url":"https://www.mext.go.jp/a_menu/kagaku/sangaku/","source":"文部科学省","requirements":["大学と企業の組織的連携","共同研究の実施","イノベーション創出の計画"],"documents":["連携計画書","共同研究計画","知財管理計画","予算計画書"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'SANGAKU-INNOVATION', 1);

-- #460 中小企業の賃上げ促進税制
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('CHINAGE-SOKUSHIN', '中小企業の賃上げ促進税制（令和8年度版）', 'METI', '経済産業省', '00', '["tax","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('CHINAGE-SOKUSHIN', 'manual', '賃上げ促進税制（中小企業向け・令和8年度）', NULL, '最大45%税額控除', '全国', '2026-04-01', '2027-03-31',
'{"overview":"従業員の賃上げを行った中小企業に対し、給与等支給増加額の最大45%を税額控除","target":"中小企業（資本金1億円以下等）","amount":"必須：給与増加1.5%以上→15%控除、2.5%以上→30%控除。上乗せ：教育訓練費増10%以上→+10%、プラチナくるみん等→+5%","period":"令和6年4月〜令和9年3月（3年間）","application":"確定申告時に適用","url":"https://www.meti.go.jp/policy/economy/keiei_innovation/sangyoujinzai/chinagesoukushinzeisei.html","source":"経済産業省","requirements":["給与等支給額が前年比1.5%以上増加","中小企業であること","法人税額の20%が上限"],"documents":["確定申告書","給与等支給額の明細","教育訓練費の明細（上乗せ適用時）"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'CHINAGE-SOKUSHIN', 1);

-- #461 特定求職者雇用開発助成金（生涯現役コース）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('TOKUTEI-SHOUGAI-GENEKI', '特定求職者雇用開発助成金（生涯現役コース）', 'MHLW', '厚生労働省', '00', '["subsidy","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('TOKUTEI-SHOUGAI-GENEKI', 'manual', '特定求職者雇用開発助成金（生涯現役コース）', 700000, '定額', '全国', '2026-04-01', '2027-03-31',
'{"overview":"65歳以上の高年齢者をハローワーク等の紹介により雇い入れた事業主を助成","target":"65歳以上の高年齢者を雇用する事業主","amount":"中小企業：70万円（短時間：50万円）、大企業：60万円（短時間：40万円）","period":"通年","application":"ハローワークに申請","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_koyou.html","source":"厚生労働省","requirements":["65歳以上の高年齢者の雇入れ","ハローワーク等の紹介","継続雇用の見込み"],"documents":["支給申請書","雇用契約書","出勤簿","賃金台帳"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'TOKUTEI-SHOUGAI-GENEKI', 1);

-- #462 中小企業活性化協議会（事業再生支援）
INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at)
VALUES ('KASSEIKA-KYOUGI', '中小企業活性化協議会', 'METI', '経済産業省', '00', '["consulting","finance"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible)
VALUES ('KASSEIKA-KYOUGI', 'manual', '中小企業活性化協議会（事業再生・経営改善支援）', NULL, '無料', '全国', '2026-04-01', '2027-03-31',
'{"overview":"経営難の中小企業の事業再生計画策定、金融機関調整、経営改善を無料で支援","target":"経営難の中小企業","amount":"相談・計画策定支援無料","period":"通年","application":"各都道府県の中小企業活性化協議会","url":"https://www.chusho.meti.go.jp/keiei/saisei/","source":"経済産業省","requirements":["経営改善又は事業再生の必要性","金融機関との調整が必要","事業継続の意思"],"documents":["相談申込書","決算書","借入金一覧"]}',
datetime('now'), datetime('now', '+90 days'), 90, 'KASSEIKA-KYOUGI', 1);

-- #463 〜 #491 (29件: 残りの重要制度を簡潔に追加)

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('NOUGYOU-JINZAI', '農業人材投資事業（新規就農支援）', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('NOUGYOU-JINZAI', 'manual', '農業人材力強化総合支援事業（新規就農者育成総合対策）', 1500000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"新規就農者に対する経営開始資金（月12.5万円、最長3年間）を支給","target":"50歳未満の新規就農者","amount":"経営開始資金：月12.5万円（年150万円）、最長3年間","period":"令和8年度","url":"https://www.maff.go.jp/j/new_farmer/","source":"農林水産省"}', datetime('now'), datetime('now', '+90 days'), 90, 'NOUGYOU-JINZAI', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('TOSHI-NOGYOU', '都市農業振興基本計画関連支援', 'MAFF', '農林水産省', '00', '["subsidy","agriculture","urban"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('TOSHI-NOGYOU', 'manual', '都市農業振興支援事業', 5000000, '1/2', '全国', '2026-04-01', '2027-03-31', '{"overview":"都市部の農業振興（市民農園・直売所・農業体験等）を支援","target":"都市部の農業者・市区町村","amount":"上限500万円","period":"令和8年度","url":"https://www.maff.go.jp/j/nousin/kouryu/tosi_nougyo/","source":"農林水産省"}', datetime('now'), datetime('now', '+90 days'), 90, 'TOSHI-NOGYOU', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('DENSHOKU-SHIEN', '田園回帰支援事業', 'MIC', '総務省', '00', '["subsidy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('DENSHOKU-SHIEN', 'manual', '田園回帰支援事業（移住体験・お試し居住）', 5000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"都市部から農村部への移住を促進する体験プログラム・お試し居住を支援","target":"地方公共団体","amount":"上限500万円","period":"令和8年度","url":"https://www.soumu.go.jp/","source":"総務省"}', datetime('now'), datetime('now', '+90 days'), 90, 'DENSHOKU-SHIEN', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('GAKKOU-SHISETSU', '学校施設環境改善交付金', 'MEXT', '文部科学省', '00', '["subsidy","education","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('GAKKOU-SHISETSU', 'manual', '学校施設環境改善交付金（エアコン・バリアフリー等）', 100000000, '1/3', '全国', '2026-04-01', '2027-03-31', '{"overview":"公立学校のエアコン設置・バリアフリー化・老朽化対策等を支援","target":"地方公共団体（教育委員会）","amount":"交付率1/3","period":"令和8年度","url":"https://www.mext.go.jp/a_menu/shotou/zyosei/","source":"文部科学省"}', datetime('now'), datetime('now', '+90 days'), 90, 'GAKKOU-SHISETSU', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('SHOUGAKU-YUUSHI', '小学校就学準備貸付', 'MHLW', '厚生労働省', '00', '["finance","education"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('SHOUGAKU-YUUSHI', 'manual', '母子父子寡婦福祉資金（就学支度資金等）', 640000, '無利子/低利', '全国', '2026-04-01', '2027-03-31', '{"overview":"ひとり親家庭の子どもの就学資金・技能習得資金等を無利子又は低利で貸付","target":"ひとり親家庭","amount":"就学支度資金：上限64万円（大学）等","period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000062986.html","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'SHOUGAKU-YUUSHI', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('KAIGO-SYOKUGYOU', '介護職員処遇改善支援補助金', 'MHLW', '厚生労働省', '00', '["subsidy","health","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('KAIGO-SYOKUGYOU', 'manual', '介護職員処遇改善支援補助金（賃上げ支援）', NULL, '加算', '全国', '2026-04-01', '2027-03-31', '{"overview":"介護職員の月額賃金6,000円相当の引上げを支援する処遇改善補助金","target":"介護事業所","amount":"介護職員1人あたり月6,000円相当","period":"令和8年度","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'KAIGO-SYOKUGYOU', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('CHITEKI-SHOUGAI', '知的障害者福祉施設整備補助', 'MHLW', '厚生労働省', '00', '["subsidy","health","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('CHITEKI-SHOUGAI', 'manual', '社会福祉施設等施設整備費補助金（障害福祉分野）', 50000000, '3/4', '全国', '2026-04-01', '2027-03-31', '{"overview":"障害者支援施設・障害福祉サービス事業所の施設整備を支援","target":"社会福祉法人等","amount":"整備費の3/4（国1/2、都道府県1/4）","period":"令和8年度","url":"https://www.mhlw.go.jp/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'CHITEKI-SHOUGAI', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('DENRYOKU-KOUFUKIN', '電源立地地域対策交付金', 'ENECHO', '資源エネルギー庁', '00', '["subsidy","energy","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('DENRYOKU-KOUFUKIN', 'manual', '電源立地地域対策交付金', NULL, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"発電所等が立地する地域の公共施設整備・地域活性化を支援する交付金","target":"発電所立地市町村及び周辺市町村","amount":"発電所の規模・種類により交付額決定","period":"令和8年度","url":"https://www.enecho.meti.go.jp/","source":"資源エネルギー庁"}', datetime('now'), datetime('now', '+90 days'), 90, 'DENRYOKU-KOUFUKIN', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('JOSANSHI-KAKUHO', '助産師確保対策事業', 'MHLW', '厚生労働省', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('JOSANSHI-KAKUHO', 'manual', '周産期医療体制確保事業（NICU等整備）', 50000000, '1/2', '全国', '2026-04-01', '2027-03-31', '{"overview":"NICU・GCU等の周産期医療体制の確保・整備を支援","target":"周産期医療を行う医療機関","amount":"施設整備費の1/2","period":"令和8年度","url":"https://www.mhlw.go.jp/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'JOSANSHI-KAKUHO', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('YAKUZAISHI-KAKUHO', '薬剤師確保対策事業', 'MHLW', '厚生労働省', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('YAKUZAISHI-KAKUHO', 'manual', '薬剤師確保・活用推進事業', 5000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"地域の薬剤師確保・在宅薬剤管理の推進を支援","target":"薬局、医療機関、地方公共団体","amount":"上限500万円","period":"令和8年度","url":"https://www.mhlw.go.jp/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'YAKUZAISHI-KAKUHO', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('KOKUSAI-BUNKA', '国際文化交流推進事業', 'ACA', '文化庁', '00', '["subsidy","culture","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('KOKUSAI-BUNKA', 'manual', '国際文化交流・協力推進事業', 10000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"日本文化の海外発信・国際文化交流事業を支援","target":"文化芸術団体、NPO","amount":"上限1,000万円","period":"令和8年度","url":"https://www.bunka.go.jp/","source":"文化庁"}', datetime('now'), datetime('now', '+90 days'), 90, 'KOKUSAI-BUNKA', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('HOJOKIN-SHINSEI-DX', '補助金申請DX推進事業（Jグランツ等）', 'METI', '経済産業省', '00', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('HOJOKIN-SHINSEI-DX', 'manual', '補助金申請DX推進事業（jGrants電子申請）', NULL, '無料', '全国', '2026-04-01', '2027-03-31', '{"overview":"補助金のオンライン申請プラットフォーム（jGrants）の利用・普及推進","target":"補助金申請者（全事業者）","amount":"システム利用無料","period":"通年","url":"https://www.jgrants-portal.go.jp/","source":"経済産業省"}', datetime('now'), datetime('now', '+90 days'), 90, 'HOJOKIN-SHINSEI-DX', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('CHIIKI-IRYO-KOSO', '地域医療構想推進事業', 'MHLW', '厚生労働省', '00', '["subsidy","health","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('CHIIKI-IRYO-KOSO', 'manual', '地域医療構想推進事業（病床機能再編等）', 100000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"地域医療構想に基づく病床機能の再編・統合等を支援","target":"医療機関、都道府県","amount":"病床削減・統合に対する交付金","period":"令和8年度","url":"https://www.mhlw.go.jp/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'CHIIKI-IRYO-KOSO', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('NINSHIN-SOS', '妊娠SOS相談事業', 'CFA', 'こども家庭庁', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('NINSHIN-SOS', 'manual', '妊娠・出産包括支援事業（産後ケア等）', 10000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"産前産後のサポート（産後ケア・産前産後サポーター派遣等）を支援","target":"市区町村","amount":"産後ケア事業費等","period":"令和8年度","url":"https://www.cfa.go.jp/","source":"こども家庭庁"}', datetime('now'), datetime('now', '+90 days'), 90, 'NINSHIN-SOS', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('TOKKYO-SHINSA-HIYOU', '特許審査請求料減免制度', 'METI', '経済産業省', '00', '["finance","ip"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('TOKKYO-SHINSA-HIYOU', 'manual', '特許審査請求料・特許料減免制度（中小企業向け）', NULL, '1/2〜1/3減免', '全国', '2026-04-01', '2027-03-31', '{"overview":"中小企業等の特許出願にかかる審査請求料・特許料を1/2〜1/3に減免","target":"中小企業、スタートアップ、個人事業主","amount":"審査請求料1/2、特許料1/2（要件により1/3も可）","period":"通年","url":"https://www.jpo.go.jp/system/process/tesuryo/genmen/","source":"経済産業省（特許庁）"}', datetime('now'), datetime('now', '+90 days'), 90, 'TOKKYO-SHINSA-HIYOU', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('JISEDAI-IKUSEI', '次世代育成支援対策推進法関連支援', 'MHLW', '厚生労働省', '00', '["subsidy","employment"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('JISEDAI-IKUSEI', 'manual', '次世代育成支援対策推進法（くるみん認定等）', 570000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"子育てサポート企業としてのくるみん認定取得を支援し、認定企業に助成金等の優遇措置","target":"くるみん認定を目指す企業","amount":"両立支援等助成金：最大57万円","period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/kurumin/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'JISEDAI-IKUSEI', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('KOKUSAI-KYOURYOKU', '国際協力事業（JICA中小企業等海外展開支援）', 'JICA', 'JICA', '00', '["subsidy","export"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('KOKUSAI-KYOURYOKU', 'manual', 'JICA中小企業・SDGsビジネス支援事業', 50000000, '委託', '全国', '2026-04-01', '2027-03-31', '{"overview":"中小企業の製品・技術を活用した開発途上国の課題解決と海外ビジネス展開を支援","target":"海外展開を目指す中小企業","amount":"基礎調査：〜1,000万円、普及・実証：〜5,000万円","period":"年1〜2回公募","url":"https://www.jica.go.jp/priv_partner/","source":"JICA"}', datetime('now'), datetime('now', '+90 days'), 90, 'KOKUSAI-KYOURYOKU', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('NENNKIN-SEIKATSU', '年金生活者支援給付金', 'MHLW', '厚生労働省', '00', '["subsidy"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('NENNKIN-SEIKATSU', 'manual', '年金生活者支援給付金', 5310, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"所得の少ない年金受給者に対して月額5,310円（基準額）を上乗せ支給","target":"所得基準を満たす年金受給者","amount":"月額5,310円（令和6年度、物価スライドあり）","period":"通年","url":"https://www.mhlw.go.jp/nenkinkyuufukin/","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'NENNKIN-SEIKATSU', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('SHOUBOU-DAN-SETSUBI', '消防防災施設整備費補助金', 'FDMA', '消防庁', '00', '["subsidy","disaster","facility"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('SHOUBOU-DAN-SETSUBI', 'manual', '消防防災施設整備費補助金（消防車両・資機材等）', 30000000, '1/3', '全国', '2026-04-01', '2027-03-31', '{"overview":"消防ポンプ自動車、救急自動車、防火水槽等の消防防災施設の整備を支援","target":"市区町村","amount":"補助率1/3","period":"令和8年度","url":"https://www.fdma.go.jp/","source":"消防庁"}', datetime('now'), datetime('now', '+90 days'), 90, 'SHOUBOU-DAN-SETSUBI', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('TOSHOKAN-DX', '図書館DX推進事業', 'MEXT', '文部科学省', '00', '["subsidy","education","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('TOSHOKAN-DX', 'manual', '図書館DX推進事業（電子書籍・デジタルアーカイブ等）', 10000000, '1/2', '全国', '2026-04-01', '2027-03-31', '{"overview":"公共図書館のDX推進（電子書籍導入・デジタルアーカイブ等）を支援","target":"地方公共団体（図書館）","amount":"上限1,000万円（補助率1/2）","period":"令和8年度","url":"https://www.mext.go.jp/","source":"文部科学省"}', datetime('now'), datetime('now', '+90 days'), 90, 'TOSHOKAN-DX', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('JINKEN-SOUDAN', '法務局人権相談・法テラス支援', 'MOJ', '法務省', '00', '["consulting"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('JINKEN-SOUDAN', 'manual', '法テラス（日本司法支援センター）無料法律相談', NULL, '無料', '全国', '2026-04-01', '2027-03-31', '{"overview":"収入・資産が一定以下の方を対象とした無料法律相談・弁護士費用の立替制度","target":"法的トラブルを抱える個人（収入・資産要件あり）","amount":"無料法律相談＋弁護士費用の立替（分割返済）","period":"通年","url":"https://www.houterasu.or.jp/","source":"法務省（法テラス）"}', datetime('now'), datetime('now', '+90 days'), 90, 'JINKEN-SOUDAN', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('KOKUMIN-KENKO', '特定健康診査・特定保健指導事業', 'MHLW', '厚生労働省', '00', '["subsidy","health"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('KOKUMIN-KENKO', 'manual', '特定健康診査・特定保健指導（メタボ健診）', NULL, '無料/低額', '全国', '2026-04-01', '2027-03-31', '{"overview":"40〜74歳の国民健康保険加入者等を対象としたメタボリックシンドローム健診・保健指導","target":"40〜74歳の医療保険加入者","amount":"健診無料〜自己負担数千円（保険者により異なる）","period":"通年","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000161103.html","source":"厚生労働省"}', datetime('now'), datetime('now', '+90 days'), 90, 'KOKUMIN-KENKO', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('JICHITAI-DX-SUISHIN', '自治体DX推進事業', 'MIC', '総務省', '00', '["subsidy","digital","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('JICHITAI-DX-SUISHIN', 'manual', '自治体DX推進事業（情報システム標準化等）', 50000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"自治体の基幹業務システムの標準化・ガバメントクラウド移行を支援","target":"地方公共団体","amount":"移行経費等に対する交付","period":"令和8年度","url":"https://www.soumu.go.jp/menu_seisaku/chiho/jichitaidx.html","source":"総務省"}', datetime('now'), datetime('now', '+90 days'), 90, 'JICHITAI-DX-SUISHIN', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('SHIZEN-SAIGAI-HOKEN', '自然災害債務整理ガイドライン', 'FSA', '金融庁', '00', '["finance","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('SHIZEN-SAIGAI-HOKEN', 'manual', '自然災害債務整理ガイドライン（被災ローン減免制度）', NULL, '無料', '全国', NULL, NULL, '{"overview":"自然災害で住宅ローン等の返済が困難になった個人の債務整理を無料で支援する制度","target":"自然災害で被災した個人","amount":"弁護士等の支援無料、信用情報に登録されない","period":"災害発生時に随時","url":"https://www.dgl.or.jp/","source":"金融庁","requirements":["自然災害による被災","住宅ローン等の返済困難","弁護士等の支援を受けること"]}', datetime('now'), datetime('now', '+90 days'), 90, 'SHIZEN-SAIGAI-HOKEN', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('TAISHIN-SHINDAN-HOJO', '耐震診断・改修補助事業（住宅）', 'MLIT', '国土交通省', '00', '["subsidy","housing","disaster"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('TAISHIN-SHINDAN-HOJO', 'manual', '住宅・建築物耐震改修等事業（耐震診断義務化対象等）', 3000000, '定額', '全国', '2026-04-01', '2027-03-31', '{"overview":"旧耐震基準の住宅・建築物の耐震診断・耐震改修を支援","target":"旧耐震基準（1981年以前）の住宅所有者","amount":"耐震診断：無料〜低額、耐震改修：上限100〜300万円（自治体により異なる）","period":"令和8年度","url":"https://www.mlit.go.jp/jutakukentiku/house/","source":"国土交通省"}', datetime('now'), datetime('now', '+90 days'), 90, 'TAISHIN-SHINDAN-HOJO', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('MINKAN-JINZAI', '民間人材の地方公共団体への派遣制度', 'MIC', '総務省', '00', '["subsidy","employment","regional"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('MINKAN-JINZAI', 'manual', '地方創生人材支援制度（民間専門人材派遣）', NULL, '無料', '全国', '2026-04-01', '2027-03-31', '{"overview":"民間企業・大学等の専門人材を地方公共団体に派遣し、地方創生を支援","target":"人口5万人以下程度の市町村","amount":"派遣人材の報酬は国が負担","period":"令和8年度","url":"https://www.chisou.go.jp/sousei/about/jinzai/","source":"内閣府"}', datetime('now'), datetime('now', '+90 days'), 90, 'MINKAN-JINZAI', 1);

INSERT OR IGNORE INTO subsidy_canonical (id, name, issuer_code, issuer_name, prefecture_code, category_codes, first_seen_at, last_updated_at, is_active, created_at, updated_at) VALUES ('NOUFU-SHOUMEI', '納付証明書不要化事業', 'DIGITAL', 'デジタル庁', '00', '["subsidy","digital"]', datetime('now'), datetime('now'), 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, acceptance_start_datetime, acceptance_end_datetime, detail_json, cached_at, expires_at, detail_score, canonical_id, is_visible) VALUES ('NOUFU-SHOUMEI', 'manual', '行政手続オンライン化推進事業（ワンストップ化）', NULL, '無料', '全国', '2026-04-01', '2027-03-31', '{"overview":"補助金申請等の行政手続における添付書類の省略・ワンストップ化を推進","target":"行政手続を行う全事業者・個人","amount":"システム利用無料","period":"通年","url":"https://www.digital.go.jp/","source":"デジタル庁"}', datetime('now'), datetime('now', '+90 days'), 90, 'NOUFU-SHOUMEI', 1);

-- =====================================================================
-- 6件の新規補助金/助成金 DB登録
-- 2026-02-08 作成
-- 全件 wall_chat_ready=1, detail_score>=85, 完全なdetail_json付き
-- =====================================================================

-- =====================================================================
-- 1. 省力化投資補助金（カタログ注文型）
-- 随時受付中〜2026年9月末頃 / 最大1,500万円
-- =====================================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_missing, detail_score,
  shard_key, detail_json, cached_at, expires_at
) VALUES (
  'SHORYOKUKA-CATALOG', 'manual',
  '中小企業省力化投資補助金（カタログ注文型）',
  15000000, '1/2以内',
  '全国', '全業種（中小企業等）', '常勤従業員がいる中小企業等（従業員0名でも証憑提出により申請可能）',
  '2024-09-01T00:00:00Z', '2026-09-30T23:59:59Z',
  1, 1,
  1, 1, '[]', 90,
  'manual', json('{"id":"SHORYOKUKA-CATALOG","title":"中小企業省力化投資補助金（カタログ注文型）","official_name":"中小企業省力化投資補助事業（カタログ注文型）","round":"随時受付","description":"人手不足に悩む中小企業等に対して、IoT・ロボット等の人手不足解消に効果がある汎用製品をカタログから選択して導入するための経費の一部を補助。簡易で即効性のある省力化投資を促進し、付加価値額や生産性向上と賃上げにつなげることを目的とする。カタログに掲載された製品を選ぶだけなので手続きが簡易。","subsidy_amount":{"description":"従業員数に応じた補助上限（賃上げ要件達成で括弧内の額に引上げ）","max_amount":15000000,"rate":"1/2以内","tiers":[{"employees":"5名以下","max":"200万円（300万円）"},{"employees":"6〜20名","max":"500万円（750万円）"},{"employees":"21名以上","max":"1,000万円（1,500万円）"}],"wage_increase_bonus":"賃上げ要件（事業場内最低賃金を地域別最低賃金+50円以上）を達成した場合、補助上限額を引き上げ"},"subsidy_rate":{"categories":[{"type":"中小企業等","rate":"1/2以内"}]},"target_area_search":"全国","target_industry":"全業種（中小企業基本法に基づく中小企業者等）","target_number_of_employees":"常時使用する従業員がいる中小企業等（2025年4月24日以降、従業員0名でも証憑提出で申請可）","eligibility_requirements":{"basic":["中小企業基本法に基づく中小企業者または小規模企業者であること","人手不足の状態にあること（具体的な確認方法は公募要領参照）","GビズIDプライムアカウントを取得していること","補助事業の実施場所が日本国内であること"],"mandatory_commitments":[{"item":"賃上げ要件（任意・加点）","requirement":"事業場内最低賃金を地域別最低賃金+50円以上にすることで補助上限額引上げ","verification":"賃金台帳等で確認"}],"exclusions":["みなし大企業","過去3年間に類似の不正受給があった事業者","同一の製品に対して既に他の補助金の交付を受けている場合"]},"eligible_expenses":{"categories":[{"name":"製品本体費","description":"カタログに掲載された汎用製品の購入費用","requirement":"カタログに登録・公表された製品であること"},{"name":"導入経費","description":"製品の設置・導入に係る経費","requirement":"製品導入に直接必要な経費"}],"not_eligible":["カタログに未掲載の製品","汎用PC・タブレット等の汎用品","消耗品・ランニングコスト"]},"required_documents":{"common":[{"name":"交付申請書","description":"申請マイページから入力・提出"},{"name":"人手不足を証する書類","description":"公募要領に定める証憑"},{"name":"決算書等","description":"直近の決算書"},{"name":"従業員名簿（指定様式）","description":"常勤従業員の一覧"},{"name":"役員名簿（指定様式）","description":"役員情報"},{"name":"株主・出資者名簿（指定様式）","description":"株主情報"}],"optional":[{"name":"リース取引に係る宣誓書","condition":"ファイナンス・リースを利用する場合"},{"name":"時間外労働時間（指定様式）","condition":"従業員減少確認用"}]},"evaluation_criteria":{"main_axes":[{"item":"人手不足の状態","description":"事業者の人手不足状況の深刻度"},{"item":"省力化効果","description":"製品導入による省力化・生産性向上の見込み"},{"item":"賃上げへの取組","description":"地域別最低賃金+50円以上の賃上げ達成可能性"}]},"application_method":{"type":"電子申請のみ","system":"申請マイページ（GビズID連携）","account_required":"GビズIDプライムアカウント","account_note":"取得に2〜3週間を要する。販売事業者を通じて申請するため、まず販売事業者を見つけること","flow":["①GビズIDプライムアカウント取得","②カタログから製品を選択","③販売事業者を見つけて相談","④販売事業者の支援のもと申請マイページで申請","⑤審査・交付決定","⑥製品導入・支払い","⑦実績報告","⑧補助金受領"]},"schedule":{"application_period":"随時受付中（〜2026年9月末頃まで）","result_timing":"申請から概ね1〜2か月程度で採択・交付決定","project_period":"交付決定日から12か月以内","effect_report":"補助事業完了後、効果報告が必要"},"contact":{"name":"中小企業省力化投資補助金事務局","url":"https://shoryokuka.smrj.go.jp/catalog/","phone":"公式サイト記載のコールセンター"},"official_urls":{"main":"https://shoryokuka.smrj.go.jp/catalog/","download":"https://shoryokuka.smrj.go.jp/catalog/download/","product_catalog":"https://shoryokuka.smrj.go.jp/catalog/product_catalog/","flow":"https://shoryokuka.smrj.go.jp/catalog/flow/","schedule":"https://shoryokuka.smrj.go.jp/catalog/schedule/"},"key_points":["カタログから製品を選ぶだけなので手続きが非常に簡易","販売事業者が申請をサポートしてくれる","随時受付で締切に追われない","賃上げ要件達成で補助上限が1.5倍に","2025年4月24日以降、常勤従業員がいない事業者も申請可能に"],"wall_chat_questions":[{"category":"基本情報","question":"御社の常勤従業員数は何名ですか？（5名以下/6〜20名/21名以上で補助上限が変わります）","purpose":"補助上限額の確認"},{"category":"基本情報","question":"御社の業種と資本金を教えてください（中小企業の要件確認のため）","purpose":"申請資格の確認"},{"category":"人手不足","question":"現在、人手不足を感じていますか？具体的にどのような状況ですか？","purpose":"申請要件の確認"},{"category":"製品選択","question":"どのような省力化製品の導入を検討していますか？（清掃ロボット、配膳ロボット、自動釣銭機、券売機、自動精算機等）","purpose":"カタログ製品のマッチング"},{"category":"導入目的","question":"製品を導入することで、どのような効果を期待していますか？（作業時間短縮、人員削減等）","purpose":"省力化効果の確認"},{"category":"賃上げ","question":"事業場内の最低賃金は現在いくらですか？地域別最低賃金+50円以上にできますか？（補助上限が1.5倍になります）","purpose":"賃上げ要件による上限引上げの確認"},{"category":"電子申請","question":"GビズIDプライムアカウントは取得済みですか？（取得に2〜3週間かかります）","purpose":"申請準備状況の確認"},{"category":"販売事業者","question":"導入したい製品の販売事業者は見つかっていますか？（販売事業者を通じて申請します）","purpose":"申請フローの確認"}]}'),
  datetime('now'), datetime('now', '+30 days')
);

-- =====================================================================
-- 2. 持続化補助金（共同・協業型）第2回公募
-- 締切 2026/2/27 17:00 / 最大5,000万円
-- =====================================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_missing, detail_score,
  shard_key, detail_json, cached_at, expires_at
) VALUES (
  'JIZOKUKA-KYODO-02', 'manual',
  '小規模事業者持続化補助金（共同・協業型）第2回公募',
  50000000, '2/3以内',
  '全国', '全業種（小規模事業者）', '常時使用する従業員20名以下（商業・サービス業は5名以下）',
  '2026-01-16T00:00:00Z', '2026-02-27T17:00:00Z',
  1, 1,
  1, 1, '[]', 90,
  'manual', json('{"id":"JIZOKUKA-KYODO-02","title":"小規模事業者持続化補助金（共同・協業型）第2回公募","official_name":"小規模事業者持続化補助金＜共同・協業型＞","round":"第2回公募","description":"複数の小規模事業者が連携して共同で取り組む販路開拓や業務効率化のための事業を支援。地域経済の活性化と小規模事業者の持続的発展を目的とする。共同・協業することで単独では実現困難な取組を実施可能。参加事業者数×最大1,000万円（上限5,000万円）。","subsidy_amount":{"description":"参加事業者数×最大1,000万円（上限5,000万円）、補助率2/3以内","max_amount":50000000,"rate":"2/3以内","per_participant":"1,000万円/事業者","max_participants":"5事業者","note":"インボイス特例対象の事業者は上限額50万円上乗せ"},"subsidy_rate":{"categories":[{"type":"通常","rate":"2/3以内"}]},"target_area_search":"全国","target_industry":"全業種（小規模事業者）","target_number_of_employees":"常時使用する従業員が20名以下（商業・サービス業（宿泊・娯楽業除く）は5名以下）","eligibility_requirements":{"basic":["小規模事業者であること（商業・サービス業5名以下、宿泊・娯楽業・製造業等20名以下）","2者以上の小規模事業者等が参加する共同事業であること","代表事業者を1者定め、代表事業者が申請手続きを行うこと","商工会議所または商工会の管轄地域で事業を営んでいること","共同事業計画書を策定していること"],"mandatory_commitments":[{"item":"共同事業計画","requirement":"全参加事業者の合意のもと、共同事業計画書を策定","verification":"全参加事業者の押印が必要"},{"item":"事業完了後の報告","requirement":"補助事業完了後の実績報告・効果報告","verification":"各参加事業者の実績を取りまとめて報告"}],"exclusions":["過去の持続化補助金で不正があった事業者","暴力団関係者","同一内容の事業で他の補助金を受けている場合"]},"eligible_expenses":{"categories":[{"name":"機械装置等費","description":"共同事業に必要な機械装置・工具・器具の購入"},{"name":"広報費","description":"共同での販路開拓のためのチラシ・カタログ・WEB制作"},{"name":"ウェブサイト関連費","description":"共同ECサイト構築等","requirement":"補助金総額の1/4が上限"},{"name":"展示会等出展費","description":"共同出展による販路開拓"},{"name":"旅費","description":"共同事業に必要な旅費"},{"name":"開発費","description":"新商品・サービスの共同開発費用"},{"name":"資料購入費","description":"事業遂行に必要な図書等"},{"name":"雑役務費","description":"事業遂行に必要なアルバイト等"},{"name":"借料","description":"機器・設備等のレンタル・リース料"},{"name":"設備処分費","description":"既存設備の処分費用","requirement":"補助金総額の1/2が上限"},{"name":"委託・外注費","description":"専門家等への委託・外注"}],"not_eligible":["自動車の購入費","電話代・インターネット利用料等の通信費","文房具等の消耗品で事業との関連が薄いもの","飲食費","10万円超の備品は目的外使用禁止"]},"required_documents":{"common":[{"name":"共同事業計画書","description":"全参加事業者の合意による事業計画","format":"指定様式"},{"name":"経費明細書","description":"補助対象経費の明細"},{"name":"参加事業者一覧","description":"全参加事業者の情報"},{"name":"支援機関確認書","description":"商工会議所または商工会からの確認書"}],"per_participant":[{"name":"確定申告書等","description":"直近の確定申告書の写し"},{"name":"貸借対照表・損益計算書","description":"直近の決算書類"},{"name":"開業届","description":"個人事業主の場合"}]},"application_method":{"type":"電子申請（Jグランツ）","system":"Jグランツ","account_required":"GビズIDプライムアカウント","account_note":"代表事業者が申請手続きを代表して実施"},"schedule":{"kobo_start":"2025年12月23日","application_start":"2026年1月16日（金）","application_end":"2026年2月27日（金）17:00","result_announcement":"後日公表","project_period":"交付決定日から10か月以内"},"contact":{"name":"小規模事業者持続化補助金＜共同・協業型＞事務局","url":"https://r6.kyodokyogyohojokin.info/","note":"商工会議所管轄地域の事業者が対象"},"official_urls":{"main":"https://r6.kyodokyogyohojokin.info/","kobo_pdf":"https://r6.kyodokyogyohojokin.info/doc/r6_koubover4_kk2.pdf","apply":"https://r6.kyodokyogyohojokin.info/oubo.php","matome":"https://matome.jizokukahojokin.info/"},"key_points":["複数事業者で連携するため単独では難しい大きな取組が可能","参加事業者数×1,000万円で最大5,000万円","2/3の高い補助率","商工会議所がサポートしてくれる","締切が2/27と非常に近いため、既に準備が進んでいる事業者向け"],"disqualification_cases":["参加事業者間で実態のない取引","共同事業の実態がない場合","虚偽申請"],"wall_chat_questions":[{"category":"基本情報","question":"御社の常勤従業員数は何名ですか？（小規模事業者の要件: 商業・サービス業5名以下、製造業等20名以下）","purpose":"小規模事業者要件の確認"},{"category":"共同体制","question":"共同で事業に取り組む他の事業者は見つかっていますか？何社で参加予定ですか？","purpose":"共同事業の体制確認"},{"category":"事業内容","question":"共同でどのような事業を行う計画ですか？（共同販路開拓、共同ECサイト構築、共同商品開発等）","purpose":"事業計画の方向性確認"},{"category":"商工会議所","question":"事業所は商工会議所の管轄地域にありますか？商工会議所との関係はありますか？","purpose":"申請ルートの確認"},{"category":"締切","question":"申請締切は2/27（金）17:00です。共同事業計画書や支援機関確認書の準備は進んでいますか？","purpose":"申請準備の進捗確認"},{"category":"電子申請","question":"GビズIDプライムアカウントは取得済みですか？代表事業者はどの事業者が務めますか？","purpose":"申請手続きの確認"},{"category":"過去実績","question":"過去に持続化補助金（一般型等）の採択実績はありますか？","purpose":"重複申請の確認"}]}'),
  datetime('now'), datetime('now', '+30 days')
);

-- =====================================================================
-- 3. 持続化補助金（災害支援枠・能登地震）第9次
-- 締切 2026/3/31 / 最大200万円
-- =====================================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_missing, detail_score,
  shard_key, detail_json, cached_at, expires_at
) VALUES (
  'JIZOKUKA-NOTO-09', 'manual',
  '小規模事業者持続化補助金（災害支援枠・令和6年能登半島地震等）第9次',
  2000000, '2/3以内',
  '石川県,富山県,新潟県,福井県', '全業種（被災地域の小規模事業者）', '常時使用する従業員20名以下（商業・サービス業は5名以下）',
  '2026-01-23T00:00:00Z', '2026-03-31T17:00:00Z',
  1, 1,
  1, 1, '[]', 85,
  'manual', json('{"id":"JIZOKUKA-NOTO-09","title":"小規模事業者持続化補助金（災害支援枠・令和6年能登半島地震等）第9次","official_name":"小規模事業者持続化補助金＜一般型 災害支援枠（令和6年能登半島地震等）＞","round":"第9次受付締切回（6次受付締切回以降）","description":"令和6年能登半島地震で被災した小規模事業者の販路開拓等を支援。事業再開や経営の維持・回復に向けた取組を補助。被災した事業者が事業環境の整備を図り、持続的な経営に向けた経営計画に基づく販路開拓等の取組を支援する。","subsidy_amount":{"description":"補助上限200万円、補助率2/3以内","max_amount":2000000,"rate":"2/3以内","note":"自社の事業用資産に損害を受けた事業者が対象"},"subsidy_rate":{"categories":[{"type":"通常","rate":"2/3以内"}]},"target_area_search":"石川県,富山県,新潟県,福井県（能登半島地震で被災した地域）","target_industry":"全業種（被災した小規模事業者）","target_number_of_employees":"常時使用する従業員が20名以下（商業・サービス業（宿泊・娯楽業除く）は5名以下）","eligibility_requirements":{"basic":["小規模事業者であること","令和6年能登半島地震で事業用資産に損害を受けた事業者であること","り災証明書を取得していること","商工会議所の管轄地域で事業を営んでいること","経営計画を策定していること"],"mandatory_commitments":[{"item":"り災証明書","requirement":"市町村発行のり災証明書を提出","verification":"原本提示"},{"item":"経営計画","requirement":"販路開拓等に関する経営計画を策定","verification":"経営計画書の提出"}],"exclusions":["被害を受けていない事業者","過去の持続化補助金で不正があった事業者"]},"eligible_expenses":{"categories":[{"name":"機械装置等費","description":"被災した設備の更新・修繕"},{"name":"広報費","description":"販路開拓のための広報活動"},{"name":"ウェブサイト関連費","description":"ECサイト構築等","requirement":"補助金総額の1/4が上限"},{"name":"展示会等出展費","description":"展示会・商談会への出展"},{"name":"旅費","description":"販路開拓のための旅費"},{"name":"設備処分費","description":"被災設備の処分","requirement":"補助金総額の1/2が上限"},{"name":"委託・外注費","description":"専門家への委託等"},{"name":"借料","description":"機器・設備のレンタル・リース料"}],"not_eligible":["自動車の購入費","日常的な営業活動に係る経費","補助事業と関連のない経費"]},"required_documents":{"common":[{"name":"経営計画書兼補助事業計画書","description":"事業計画の本体"},{"name":"補助事業計画書","description":"補助対象経費の詳細"},{"name":"り災証明書の写し","description":"被災状況を証明する書類"},{"name":"確定申告書等","description":"直近の確定申告書の写し"},{"name":"支援機関確認書","description":"商工会議所からの確認書（締切: 2026年3月23日）"}]},"application_method":{"type":"電子申請（Jグランツ）または郵送","system":"Jグランツ（電子申請は当日17時まで、郵送は当日消印有効）","account_required":"GビズIDプライムアカウント（電子申請の場合）","note":"支援機関確認書の発行受付締切は2026年3月23日（月）のため早めの手続きが必要"},"schedule":{"application_start":"2026年1月23日（金）","application_end":"2026年3月31日（火）（電子17時/郵送当日消印有効）","shien_kikan_deadline":"2026年3月23日（月）（支援機関確認書の発行受付締切）","result_announcement":"後日公表","project_period":"交付決定日から実施"},"contact":{"name":"持続化補助金事務局コールセンター","url":"https://r6.jizokukahojokin.info/noto/","note":"商工会議所管轄地域の事業者が対象。商工会管轄地域の方は別サイト"},"official_urls":{"main":"https://r6.jizokukahojokin.info/noto/","kobo_v8":"https://r6.jizokukahojokin.info/noto/doc/r6_koubover8_noto9.pdf","matome":"https://matome.jizokukahojokin.info/"},"key_points":["能登半島地震で被災した事業者限定","り災証明書が必須","商工会議所の支援機関確認書の締切が3/23のため注意","電子申請・郵送の両方に対応","補助率2/3で手厚い支援"],"wall_chat_questions":[{"category":"被災状況","question":"令和6年能登半島地震で事業用資産にどのような被害を受けましたか？","purpose":"申請資格の確認"},{"category":"被災証明","question":"市町村からのり災証明書は取得済みですか？","purpose":"必須書類の確認"},{"category":"基本情報","question":"御社の常勤従業員数は何名ですか？所在地はどちらですか？","purpose":"小規模事業者要件の確認"},{"category":"事業計画","question":"被災後、どのような販路開拓や事業再開の取組を計画していますか？","purpose":"事業計画の方向性確認"},{"category":"商工会議所","question":"商工会議所の管轄地域で事業を営んでいますか？支援機関確認書の依頼は進んでいますか？（締切3/23）","purpose":"申請手続きの確認"},{"category":"申請方法","question":"電子申請（Jグランツ）と郵送のどちらで申請予定ですか？GビズIDは取得済みですか？","purpose":"申請方法の確認"},{"category":"過去実績","question":"過去に持続化補助金（一般型等）の採択実績はありますか？","purpose":"重複確認"}]}'),
  datetime('now'), datetime('now', '+30 days')
);

-- =====================================================================
-- 4. キャリアアップ助成金（正社員化コース）
-- 通年受付 / 最大80万円/人
-- =====================================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_missing, detail_score,
  shard_key, detail_json, cached_at, expires_at
) VALUES (
  'CAREER-UP-SEISHAIN', 'manual',
  'キャリアアップ助成金（正社員化コース）',
  800000, '定額支給',
  '全国', '全業種（雇用保険適用事業所）', '全規模（中小企業は支給額が大企業より高い）',
  '2025-04-01T00:00:00Z', '2027-03-31T23:59:59Z',
  1, 1,
  1, 1, '[]', 90,
  'manual', json('{"id":"CAREER-UP-SEISHAIN","title":"キャリアアップ助成金（正社員化コース）","official_name":"キャリアアップ助成金","round":"令和7年度（通年受付）","description":"有期雇用労働者、短時間労働者、派遣労働者といった非正規雇用の労働者を正社員に転換した事業主に対して助成。最も利用されている雇用関係助成金の一つ。非正規から正社員への転換で中小企業は1人当たり最大80万円（大企業60万円）。予算規模は約554億円。","subsidy_amount":{"description":"1人当たり定額支給（中小企業/大企業で異なる）","max_amount":800000,"rate":"定額","details":[{"conversion_type":"有期雇用→正社員","sme":"80万円（40万円×2期）","large":"60万円（30万円×2期）"},{"conversion_type":"無期雇用→正社員","sme":"40万円（20万円×2期）","large":"30万円（15万円×2期）"}],"payment_method":"2期に分けて支給（転換後6か月経過ごとに申請）","annual_limit":"1事業所あたり20人まで/年度"},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"定額（大企業より高額）"},{"type":"大企業","rate":"定額"}]},"target_area_search":"全国","target_industry":"全業種（雇用保険適用事業所）","target_number_of_employees":"全規模（中小企業・大企業で支給額が異なる）","eligibility_requirements":{"basic":["雇用保険適用事業所の事業主であること","キャリアアップ計画を各コース実施日の前日までに提出していること","転換する労働者を6か月以上雇用していること","正社員転換後6か月間の賃金が転換前6か月間と比べて3%以上増額していること","正社員の就業規則が整備されていること","転換後の雇用形態が正社員（正規雇用労働者）であること"],"mandatory_commitments":[{"item":"キャリアアップ計画の策定・提出","requirement":"労働組合等の意見を聴いて作成し、転換実施前日までに労働局に提出","verification":"キャリアアップ計画書（様式）の提出"},{"item":"3%以上の賃金増額","requirement":"正社員転換後6か月間の賃金が転換前6か月間より3%以上増額","verification":"賃金台帳で確認"},{"item":"正社員の就業規則整備","requirement":"正社員と非正規の区分が明確な就業規則を整備","verification":"就業規則の提出"}],"exclusions":["転換日の前日から起算して6か月前から1年を経過した日までに特定受給資格者離職を発生させた場合","不正受給の場合は全額返還+延滞金+2割の違約金+5年間の助成金停止","支給申請日までに離職した場合"]},"eligible_expenses":{"categories":[{"name":"人件費（間接的）","description":"正社員転換に伴う賃金増額分を助成金でカバー","requirement":"直接的な経費助成ではなく、転換実施後の定額支給"}],"not_eligible":["設備費等の経費は対象外（人件費に対する助成）"]},"required_documents":{"common":[{"name":"キャリアアップ計画書","description":"全コースの実施計画","format":"指定様式"},{"name":"正社員化コース支給申請書","description":"転換後6か月経過後に申請","format":"指定様式"},{"name":"転換前後の雇用契約書","description":"雇用形態の変更を証明"},{"name":"転換前後の賃金台帳","description":"3%以上の賃金増額を証明（各6か月分）"},{"name":"出勤簿・タイムカード","description":"転換前後の各6か月分"},{"name":"就業規則","description":"正社員と非正規の区分が明確なもの"},{"name":"支給要件確認申立書","description":"共通要領様式"}],"optional":[{"name":"有期実習型訓練修了証明書","condition":"人材育成を経て正社員化した場合"},{"name":"障害者手帳の写し","condition":"障害者正社員化コースの場合"}]},"application_method":{"type":"電子申請または窓口申請","system":"雇用関係助成金ポータル（電子申請）","account_required":"雇用関係助成金ポータルのアカウント","flow":["①キャリアアップ計画書を労働局に提出（転換前）","②就業規則の整備・届出","③対象労働者を正社員に転換","④転換後6か月の雇用・3%以上賃上げ","⑤6か月経過後に1期目の支給申請","⑥さらに6か月後に2期目の支給申請"]},"schedule":{"application_period":"通年受付","timing":"正社員転換後6か月経過した日の翌日から2か月以内に申請","note":"2期に分けて申請（転換後6か月ごと）"},"contact":{"name":"各都道府県労働局 助成金センター","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","electronic":"https://www.esop.mhlw.go.jp/subsidy-course/a0i5i000000ZeIGAA0/view"},"official_urls":{"main":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html","pamphlet_r7":"https://www.mhlw.go.jp/content/11910500/001512805.pdf","leaflet_r7":"https://www.mhlw.go.jp/content/11910500/001512366.pdf","qa_r7":"https://www.mhlw.go.jp/content/11910500/001571489.pdf","shikyu_youryou_r7":"https://www.mhlw.go.jp/content/11910500/001511339.pdf","electronic_apply":"https://www.esop.mhlw.go.jp/subsidy-course/a0i5i000000ZeIGAA0/view"},"courses_overview":{"seishain":{"name":"正社員化コース","description":"有期→正社員: 80万円/人（中小企業）","most_used":true},"chingin_kaitei":{"name":"賃金規定等改定コース","description":"非正規の基本給を3%以上増額"},"chingin_kyotsu":{"name":"賃金規定等共通化コース","description":"正社員と共通の賃金規定を策定"},"shoyo_taishoku":{"name":"賞与・退職金制度導入コース","description":"非正規に賞与・退職金制度を新設"},"shakai_hoken":{"name":"社会保険適用時処遇改善コース","description":"社保適用時の収入増加支援（R8年3月末まで）"},"tanjikan":{"name":"短時間労働者労働時間延長支援コース","description":"労働時間延長による社保適用"}},"key_points":["最も利用されている雇用関係助成金の一つ（予算約554億円）","通年受付で締切なし","パート・アルバイトを正社員にするだけで最大80万円/人","年間20人まで（1事業所あたり）","電子申請に対応","2期に分けて支給されるため、転換後1年で満額受給","就業規則の整備が前提条件として重要"],"disqualification_cases":["キャリアアップ計画を事前に提出していない","転換前の雇用期間が6か月未満","正社員転換後の賃金が3%以上増額していない","支給申請日までに対象者が離職した","不正受給は全額返還+延滞金+2割違約金+5年間停止"],"wall_chat_questions":[{"category":"基本情報","question":"御社は雇用保険に加入していますか？常勤従業員は何名いますか？","purpose":"事業所要件の確認"},{"category":"対象者","question":"正社員に転換したいパート・アルバイト・契約社員等の非正規従業員は何名いますか？","purpose":"対象者数の確認"},{"category":"雇用期間","question":"対象者は現在、何か月間雇用していますか？（6か月以上の雇用が必要です）","purpose":"雇用期間要件の確認"},{"category":"就業規則","question":"正社員と非正規の区分が明確な就業規則は整備されていますか？","purpose":"前提条件の確認"},{"category":"賃上げ","question":"正社員に転換した場合、賃金を3%以上引き上げることは可能ですか？","purpose":"賃金要件の確認"},{"category":"計画書","question":"キャリアアップ計画書は労働局に提出済みですか？（転換前に提出必須）","purpose":"手続き進捗の確認"},{"category":"企業規模","question":"御社は中小企業ですか？大企業ですか？（中小企業は1人80万円、大企業は60万円）","purpose":"支給額の確認"},{"category":"他コース","question":"賃金規定の改定や賞与・退職金制度の導入も検討していますか？（他コースとの併用可能）","purpose":"他コースの案内"}]}'),
  datetime('now'), datetime('now', '+30 days')
);

-- =====================================================================
-- 5. 人材開発支援助成金（事業展開等リスキリング支援コース）
-- 通年受付 / 最大1億円
-- =====================================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_missing, detail_score,
  shard_key, detail_json, cached_at, expires_at
) VALUES (
  'JINZAI-RESKILLING', 'manual',
  '人材開発支援助成金（事業展開等リスキリング支援コース）',
  100000000, '75%（中小企業）/ 60%（大企業）',
  '全国', '全業種（雇用保険適用事業所）', '全規模',
  '2025-04-01T00:00:00Z', '2027-03-31T23:59:59Z',
  1, 1,
  1, 1, '[]', 90,
  'manual', json('{"id":"JINZAI-RESKILLING","title":"人材開発支援助成金（事業展開等リスキリング支援コース）","official_name":"人材開発支援助成金（事業展開等リスキリング支援コース）","round":"令和7年度（通年受付）","description":"新規事業の立ち上げやDX・GX等の事業展開に伴い、新たな分野で必要となる知識・技能を習得するための訓練を実施した事業主に助成。AI・デジタル・DX関連研修の費用を最大75%助成（中小企業）。令和8年度末までの期間限定で拡充中。経費助成と賃金助成の2本立て。","subsidy_amount":{"description":"経費助成75%（中小企業）+ 賃金助成960円/時（中小企業）","max_amount":100000000,"details":{"kehi_josei":{"sme":"75%","large":"60%","note":"1事業所1年度あたりの限度額は1億円"},"chingin_josei":{"sme":"960円/時間","large":"480円/時間","hours_limit":"1人1訓練あたり1,200時間が限度"},"total_limit":"1事業所1年度あたり1億円"}},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"経費75%＋賃金960円/時"},{"type":"大企業","rate":"経費60%＋賃金480円/時"}]},"target_area_search":"全国","target_industry":"全業種（雇用保険適用事業所）","target_number_of_employees":"全規模（中小企業・大企業で助成率が異なる）","eligibility_requirements":{"basic":["雇用保険適用事業所の事業主であること","職業訓練実施計画届を事前に労働局に提出していること","事業展開（新規事業の立ち上げ）またはDX・GX等に伴う人材育成であること","訓練時間が10時間以上であること（eラーニング・通信制も対象）","対象労働者に訓練期間中も通常の賃金を支払っていること"],"training_requirements":[{"item":"訓練内容","requirement":"事業展開に伴い新たな分野で必要となる知識・技能の習得、またはDX・GXに関する訓練","examples":["AI・機械学習研修","プログラミング研修","デジタルマーケティング研修","IoT・クラウド研修","データ分析研修","GX関連技術研修"]},{"item":"訓練時間","requirement":"10時間以上（OFF-JT）","note":"eラーニング・通信制も含む"},{"item":"訓練提供者","requirement":"外部の教育訓練機関、または社内講師によるOFF-JT","note":"OJTは対象外"}],"exclusions":["訓練開始日前日までに計画届を提出していない場合","対象労働者に訓練中の賃金を支払っていない場合","不正受給は全額返還+5年間停止"]},"eligible_expenses":{"categories":[{"name":"経費助成","description":"外部講師への謝金、施設の借上げ費、教材費、受講料等","subcategories":["受講料","教材費","施設借上げ費","講師謝金"]},{"name":"賃金助成","description":"訓練期間中に支払った賃金の一部","calculation":"中小企業960円/時×訓練時間（上限1,200時間/人/訓練）"}],"not_eligible":["訓練に直接関連しない経費","交通費・宿泊費（旅費は別途対象の場合あり）","OJTの経費"]},"required_documents":{"plan_submission":[{"name":"職業訓練実施計画届（様式第1-1号）","description":"訓練開始前日までに提出","format":"Excel"},{"name":"対象労働者一覧（様式第3-1号）","description":"訓練対象者のリスト"},{"name":"OFF-JT講師要件確認書（様式第10号）","description":"講師の資格確認"},{"name":"事前確認書（様式第11号）","description":"事前チェック"}],"payment_application":[{"name":"支給申請書（様式第4-2号）","description":"訓練終了後2か月以内に申請"},{"name":"賃金助成の内訳（様式第5号）","description":"訓練時間と賃金の詳細"},{"name":"経費助成の内訳（様式第6号）","description":"訓練経費の詳細"},{"name":"OFF-JT実施状況報告書（様式第8号）","description":"訓練実施の記録"},{"name":"支給要件確認申立書","description":"共通要領様式"}]},"application_method":{"type":"窓口申請または電子申請","system":"雇用関係助成金ポータル","flow":["①事業内職業能力開発計画の策定","②職業訓練実施計画届を労働局に提出（訓練開始前日まで）","③訓練の実施","④訓練終了後2か月以内に支給申請","⑤審査・支給決定"]},"schedule":{"application_period":"通年受付","plan_deadline":"訓練開始日の前日まで","payment_deadline":"訓練終了後2か月以内","note":"令和8年度末までの期間限定コース（延長の可能性あり）"},"contact":{"name":"各都道府県労働局","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/38819_00007.html","electronic":"https://www.esop.mhlw.go.jp/"},"official_urls":{"main":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","application_forms":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/38819_00007.html","electronic_portal":"https://www.esop.mhlw.go.jp/"},"key_points":["AI・DX関連研修の費用を最大75%助成（中小企業）","経費助成+賃金助成の2本立てで手厚い","1事業所1年度あたり最大1億円","通年受付で締切なし","eラーニング・通信制も対象","令和8年度末までの期間限定（拡充措置）","平松建築さん等の企業成長に直結するDX人材育成に最適"],"wall_chat_questions":[{"category":"基本情報","question":"御社は雇用保険に加入していますか？従業員は何名いますか？","purpose":"事業所要件の確認"},{"category":"訓練目的","question":"どのような新規事業の展開やDX推進を計画していますか？","purpose":"コース適用可否の確認"},{"category":"訓練内容","question":"具体的にどのような研修・訓練を実施する予定ですか？（AI、プログラミング、DX、データ分析等）","purpose":"対象訓練の確認"},{"category":"訓練時間","question":"研修の総時間数はどのくらいですか？（10時間以上が必要です）","purpose":"最低時間要件の確認"},{"category":"対象者","question":"研修を受ける従業員は何名ですか？雇用保険の被保険者ですか？","purpose":"対象労働者の確認"},{"category":"訓練形態","question":"研修は外部機関への派遣ですか？社内でのOFF-JT（座学）ですか？eラーニングですか？","purpose":"訓練形態の確認"},{"category":"費用","question":"研修にかかる費用（受講料、教材費等）はどのくらいですか？","purpose":"助成額の概算"},{"category":"計画届","question":"職業訓練実施計画届は労働局に提出済みですか？（訓練開始前日までに提出必須）","purpose":"手続き進捗の確認"}]}'),
  datetime('now'), datetime('now', '+30 days')
);

-- =====================================================================
-- 6. 人材開発支援助成金（人材育成支援コース）
-- 通年受付
-- =====================================================================
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application,
  is_visible, wall_chat_ready, wall_chat_missing, detail_score,
  shard_key, detail_json, cached_at, expires_at
) VALUES (
  'JINZAI-IKUSEI', 'manual',
  '人材開発支援助成金（人材育成支援コース）',
  10000000, '70%（中小企業OFF-JT経費）',
  '全国', '全業種（雇用保険適用事業所）', '全規模',
  '2025-04-01T00:00:00Z', '2027-03-31T23:59:59Z',
  1, 1,
  1, 1, '[]', 85,
  'manual', json('{"id":"JINZAI-IKUSEI","title":"人材開発支援助成金（人材育成支援コース）","official_name":"人材開発支援助成金（人材育成支援コース）","round":"令和7年度（通年受付）","description":"事業主が従業員に対して職業訓練を実施した場合に、訓練経費と訓練期間中の賃金の一部を助成。OFF-JT（座学）とOJT（実務訓練）の両方に対応。正社員だけでなく有期雇用労働者の訓練も対象。認定実習併用職業訓練（実践型人材養成システム）にも対応。","subsidy_amount":{"description":"経費助成+賃金助成（企業規模・訓練種類で異なる）","details":{"off_jt_kehi":{"sme":"70%（有期→正社員: 70%）","large":"45%（有期→正社員: 60%）","note":"訓練時間に応じた上限あり"},"off_jt_chingin":{"sme":"960円/時間","large":"480円/時間","hours_limit":"1人1訓練あたり1,200時間が限度"},"ojt_chingin":{"sme":"20万円/訓練","large":"11万円/訓練","note":"認定実習併用職業訓練・有期実習型訓練のOJT"},"total_limit":"1事業所1年度あたり1,000万円"}},"subsidy_rate":{"categories":[{"type":"中小企業","rate":"経費70%＋賃金960円/時"},{"type":"大企業","rate":"経費45%＋賃金480円/時"}]},"target_area_search":"全国","target_industry":"全業種（雇用保険適用事業所）","target_number_of_employees":"全規模","eligibility_requirements":{"basic":["雇用保険適用事業所の事業主であること","職業訓練実施計画届を事前に労働局に提出していること","訓練時間が10時間以上であること","対象労働者に訓練期間中も通常の賃金を支払っていること","事業内職業能力開発計画を策定していること"],"training_types":[{"name":"一般訓練","description":"OFF-JTによる10時間以上の職業訓練","target":"正社員・有期雇用労働者"},{"name":"認定実習併用職業訓練","description":"厚労大臣認定の実践型人材養成システム（OFF-JT+OJT）","target":"新規雇用者等"},{"name":"有期実習型訓練","description":"有期雇用労働者を正社員に転換するためのOFF-JT+OJT","target":"有期雇用労働者"}]},"eligible_expenses":{"categories":[{"name":"経費助成","description":"外部研修の受講料、教材費、施設借上費、講師謝金等"},{"name":"賃金助成（OFF-JT）","description":"OFF-JT実施期間中の賃金","calculation":"960円/時（中小企業）×訓練時間"},{"name":"賃金助成（OJT）","description":"認定実習併用・有期実習型のOJT期間","calculation":"20万円/訓練（中小企業）"}]},"required_documents":{"plan_submission":[{"name":"職業訓練実施計画届（様式第1-1号）","description":"訓練開始前日までに労働局に提出"},{"name":"対象労働者一覧（様式第3-1号）","description":"訓練対象者リスト"},{"name":"OFF-JT講師要件確認書（様式第10号）","description":"社内講師の場合"},{"name":"事前確認書（様式第11号）","description":"事前チェック"}],"payment_application":[{"name":"支給申請書（様式第4-1号）","description":"訓練終了後2か月以内"},{"name":"賃金助成の内訳（様式第5号）","description":"訓練時間・賃金明細"},{"name":"経費助成の内訳（様式第6-1号）","description":"経費明細"},{"name":"OFF-JT実施状況報告書（様式第8-1号）","description":"訓練実施記録"},{"name":"OJT実施状況報告書（様式第9号）","condition":"OJTを含む訓練の場合"}]},"application_method":{"type":"窓口申請または電子申請","system":"雇用関係助成金ポータル","flow":["①事業内職業能力開発計画の策定","②職業訓練実施計画届を労働局に提出","③訓練の実施","④訓練終了後2か月以内に支給申請"]},"schedule":{"application_period":"通年受付","plan_deadline":"訓練開始日の前日まで","payment_deadline":"訓練終了後2か月以内"},"contact":{"name":"各都道府県労働局","url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/38819_00007.html"},"official_urls":{"main":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html","forms":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/38819_00007.html"},"key_points":["従業員の研修費用を最大70%助成（中小企業）","賃金助成もあるため研修中の人件費もカバー","正社員だけでなくパート等の有期雇用労働者の訓練も対象","OJT（実務訓練）も認定実習併用なら対象","通年受付で締切なし","リスキリング支援コースとの使い分けが重要（新規事業=リスキリング、既存業務=人材育成）"],"wall_chat_questions":[{"category":"基本情報","question":"御社は雇用保険に加入していますか？従業員は何名いますか？","purpose":"事業所要件の確認"},{"category":"訓練目的","question":"どのような研修を実施したいですか？（技能向上、資格取得、新人研修等）","purpose":"コース適用の確認"},{"category":"訓練内容","question":"具体的な研修内容を教えてください（業務スキル研修、安全衛生研修、マネジメント研修等）","purpose":"対象訓練の確認"},{"category":"訓練形態","question":"外部研修への派遣ですか？社内でのOFF-JT（座学）ですか？OJTも含みますか？","purpose":"助成区分の確認"},{"category":"対象者","question":"研修を受ける従業員は正社員ですか？パート・契約社員ですか？何名ですか？","purpose":"対象者の確認"},{"category":"訓練時間","question":"研修の総時間数はどのくらいですか？（10時間以上が必要です）","purpose":"最低時間要件の確認"},{"category":"計画届","question":"職業訓練実施計画届は労働局に提出済みですか？事業内職業能力開発計画は策定済みですか？","purpose":"手続き進捗の確認"},{"category":"他コース","question":"新規事業展開やDX推進に伴う研修であれば、リスキリング支援コース（経費75%助成）の方が有利かもしれません。訓練の目的は既存業務ですか？新規事業ですか？","purpose":"最適コースの案内"}]}'),
  datetime('now'), datetime('now', '+30 days')
);

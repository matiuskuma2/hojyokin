-- 小規模事業者持続化補助金（一般型）第19回公募 - 詳細データ登録
-- 公募要領PDF: r6_koubover5_ip19.pdf より抽出

INSERT OR REPLACE INTO subsidy_cache (
  id,
  title,
  source,
  subsidy_max_limit,
  subsidy_rate,
  target_area_search,
  target_industry,
  target_number_of_employees,
  acceptance_start_datetime,
  acceptance_end_datetime,
  request_reception_display_flag,
  wall_chat_ready,
  wall_chat_mode,
  detail_json,
  cached_at,
  expires_at
) VALUES (
  'JIZOKUKA-IPPAN-19',
  '小規模事業者持続化補助金（一般型）第19回公募',
  'manual',
  500000,  -- 50万円（通常枠）※特例で最大250万円
  '2/3',
  '全国',
  '全業種（小規模事業者）',
  '小規模事業者（商業・サービス業は5人以下、その他は20人以下）',
  '2026-03-06T00:00:00Z',
  '2026-04-30T17:00:00Z',
  1,
  1,
  'full',
  '{
    "id": "JIZOKUKA-IPPAN-19",
    "title": "小規模事業者持続化補助金（一般型）第19回公募",
    "official_name": "小規模事業者持続化補助金＜一般型 通常枠＞",
    "round": "第19回公募",
    "description": "小規模事業者が自社の経営を見直し、自らが持続的な経営に向けた経営計画を作成した上で行う販路開拓や生産性向上の取組を支援します。地域の商工会・商工会議所のサポートを受けながら取り組む事業が対象です。",
    
    "subsidy_amount": {
      "base": {
        "limit": 500000,
        "description": "通常枠：50万円"
      },
      "special_additions": [
        {
          "name": "インボイス特例",
          "additional": 500000,
          "max_with_special": 1000000,
          "condition": "免税事業者から適格請求書発行事業者に転換した事業者"
        },
        {
          "name": "賃金引上げ特例",
          "additional": 1500000,
          "max_with_special": 2000000,
          "condition": "事業場内最低賃金を地域別最低賃金より+50円以上に設定"
        },
        {
          "name": "両特例適用",
          "additional": 2000000,
          "max_with_special": 2500000,
          "condition": "インボイス特例と賃金引上げ特例の両方に該当"
        }
      ],
      "description": "補助上限額50万円。インボイス特例で+50万円、賃金引上げ特例で+150万円、両方で最大250万円"
    },
    
    "subsidy_rate": {
      "normal": "2/3",
      "special": {
        "rate": "3/4",
        "condition": "賃金引上げ特例のうち赤字事業者（直近1期の課税所得金額がゼロ以下）"
      }
    },
    
    "target_area_search": "全国",
    "target_industry": "全業種（風俗営業等を除く）",
    "target_number_of_employees": "小規模事業者（商業・サービス業は従業員5人以下、その他は20人以下）",
    
    "eligibility_requirements": {
      "scale_requirements": [
        {"industry": "商業・サービス業（宿泊業・娯楽業除く）", "max_employees": 5},
        {"industry": "サービス業のうち宿泊業・娯楽業", "max_employees": 20},
        {"industry": "製造業その他", "max_employees": 20}
      ],
      "basic_requirements": [
        "日本国内に所在する会社（株式会社、合同会社等）または個人事業主であること",
        "資本金5億円以上の法人に100%保有されていないこと",
        "直近過去3年分の課税所得の年平均額が15億円を超えていないこと",
        "商工会・商工会議所の管轄地域内で事業を営んでいること",
        "GビズIDプライム（またはメンバー）のアカウントを取得していること"
      ],
      "exclusions": [
        "医師、歯科医師、系統出荷のみの個人農業者",
        "一般社団法人、公益社団法人、医療法人、宗教法人、学校法人、農事組合法人",
        "過去に小規模事業者持続化補助金で採択を受けた事業者（一定条件あり）",
        "風俗営業等の規制及び業務の適正化等に関する法律に規定する事業を行う者",
        "暴力団関係者"
      ]
    },
    
    "eligible_expenses": {
      "categories": [
        {
          "number": 1,
          "name": "機械装置等費",
          "description": "事業の遂行に必要な機械装置等の購入に要する経費",
          "examples": ["高齢者向け椅子", "ショーケース", "オーブン", "冷凍冷蔵庫", "特殊印刷プリンター"],
          "limit": null
        },
        {
          "number": 2,
          "name": "広報費",
          "description": "パンフレット・ポスター・チラシ等を作成・配布するための費用",
          "examples": ["新聞・雑誌広告", "看板作成・設置", "試供品", "郵送によるDM", "街頭ビジョン広告"],
          "limit": null
        },
        {
          "number": 3,
          "name": "ウェブサイト関連費",
          "description": "ウェブサイトやシステム等の開発、構築、更新、改修、運用に係る経費",
          "examples": ["商品販売ウェブサイト", "ECサイト", "インターネット広告", "SEO対策", "SNS広告"],
          "limit": "補助金交付申請額の1/4（最大50万円）",
          "limit_note": "ウェブサイト関連費のみでの申請は不可"
        },
        {
          "number": 4,
          "name": "展示会等出展費",
          "description": "展示会・商談会等への出展料、関連する経費",
          "examples": ["出展料", "運搬費", "通訳料", "翻訳料"],
          "limit": null
        },
        {
          "number": 5,
          "name": "旅費",
          "description": "販路開拓等を行うための旅費",
          "examples": ["展示会・商談会出張", "宿泊代", "バス・電車・新幹線・航空券代"],
          "limit": null
        },
        {
          "number": 6,
          "name": "新商品開発費",
          "description": "新商品の試作品や包装パッケージの試作開発に係る経費",
          "examples": ["試作開発用原材料", "パッケージデザイン費用"],
          "limit": null
        },
        {
          "number": 7,
          "name": "借料",
          "description": "機器・設備等のリース料・レンタル料として支払われる経費",
          "examples": ["機器・設備のリース料", "レンタル料", "イベント会場借上料"],
          "limit": null
        },
        {
          "number": 8,
          "name": "委託・外注費",
          "description": "自ら行うことが困難な業務を第三者に委託するための経費",
          "examples": ["店舗改装", "バリアフリー化工事", "インボイス制度対応の専門家相談費用"],
          "limit": null
        }
      ],
      "not_eligible": [
        "自動車本体の購入費",
        "パソコン・タブレット等の汎用性の高い機器（専用に使用する場合を除く）",
        "飲食費、交際費",
        "家賃・保証金・敷金",
        "人件費",
        "消耗品費（見本品、持ち帰り品を除く）",
        "通信費（ウェブサイト関連費を除く）",
        "買物弱者対策関連経費"
      ]
    },
    
    "required_documents": {
      "common": [
        {"name": "申請システムへの入力", "description": "様式1, 2, 3, 5, 6相当を電子申請システムで入力"},
        {"name": "事業支援計画書（様式4）", "description": "地域の商工会・商工会議所が発行", "deadline": "2026年4月16日まで"}
      ],
      "corporation": [
        {"name": "貸借対照表および損益計算書", "period": "直近1期分"},
        {"name": "確定申告書表紙と別表四", "period": "直近1期分（代替可）"},
        {"name": "現在事項全部証明書または履歴事項全部証明書", "requirement": "発行から3ヶ月以内、原本スキャン"}
      ],
      "individual": [
        {"name": "確定申告書（第一表、第二表）", "period": "直近1年分"},
        {"name": "収支内訳書または所得税青色申告決算書", "period": "直近1年分"}
      ],
      "special_optional": [
        {"name": "適格請求書発行事業者の登録通知書", "condition": "インボイス特例申請時"},
        {"name": "賃金台帳および雇用条件確認書類", "condition": "賃金引上げ特例申請時"},
        {"name": "経営力向上計画認定書", "condition": "政策加点申請時"},
        {"name": "事業承継診断票（様式10）", "condition": "事業承継加点申請時"}
      ]
    },
    
    "evaluation_criteria": {
      "basic_review": [
        "必要な提出資料がすべて提出されていること",
        "補助対象者・事業・経費の要件に合致すること",
        "他者の取組の単なる代行ではなく、自社の事業として取り組むこと"
      ],
      "planning_review": [
        {"item": "経営状況分析", "description": "自社の製品・サービスや顧客・市場の把握、経営状況の見える化"},
        {"item": "経営方針・目標", "description": "経営方針・目標と今後のプランの適切性"},
        {"item": "補助事業計画", "description": "具体的な内容、想定効果、実現可能性"},
        {"item": "積算", "description": "透明・適切な積算根拠"}
      ],
      "bonus_review": {
        "重点政策加点": {
          "options": [
            {"name": "赤字賃上げ加点", "description": "賃金引上げ特例対象かつ直近1期が赤字"},
            {"name": "事業環境変化加点", "description": "原油価格・物価高騰等の影響を受ける事業者"},
            {"name": "東日本大震災加点", "description": "福島第一原発事故による影響を受けた事業者"},
            {"name": "くるみん・えるぼし加点", "description": "認定を受けている事業者"}
          ],
          "max_selection": 1
        },
        "政策加点": {
          "options": [
            {"name": "賃金引上げ加点", "description": "事業場内最低賃金を+30円以上に設定"},
            {"name": "地方創生型（地域資源型）", "description": "地域資源を活用した新商品・サービス開発"},
            {"name": "地方創生型（地域コミュニティ型）", "description": "地域コミュニティへの貢献"},
            {"name": "経営力向上計画加点", "description": "認定を受けている事業者"},
            {"name": "事業承継加点", "description": "アトツギ甲子園ファイナリスト等"},
            {"name": "過疎地域加点", "description": "過疎地域で事業を営む事業者"},
            {"name": "一般事業主行動計画策定加点", "description": "計画を策定し届出済み"},
            {"name": "後継者支援加点", "description": "後継者候補が中心となって取り組む"},
            {"name": "小規模事業者卒業加点", "description": "3年以内に従業員数増により小規模を卒業予定"},
            {"name": "事業継続力強化計画策定加点", "description": "BCP認定を取得済み"},
            {"name": "令和6年能登半島地震等に伴う加点", "description": "被災地域で事業を営む事業者"}
          ],
          "max_selection": 1
        },
        "note": "重点政策加点から1つ、政策加点から1つ、合計2つまで選択可能"
      }
    },
    
    "invoice_special": {
      "description": "インボイス特例：免税事業者から適格請求書発行事業者に転換した事業者への支援",
      "additional_amount": 500000,
      "requirements": [
        "補助事業終了時点で適格請求書発行事業者の登録を受けていること",
        "2021年9月30日〜2023年9月30日の属する課税期間で一度でも免税事業者であったこと、または2023年10月1日以降に創業したこと"
      ],
      "exclusions": [
        "過去に持続化補助金で「インボイス枠」または「インボイス特例」を活用して採択された事業者"
      ],
      "documents": ["適格請求書発行事業者の登録通知書の写し", "e-Taxの受信通知画面の写し（申請中の場合）"]
    },
    
    "wage_increase_special": {
      "description": "賃金引上げ特例：最低賃金+50円以上を設定する事業者への支援",
      "additional_amount": 1500000,
      "requirements": [
        "補助事業の終了時点で事業場内最低賃金を地域別最低賃金より+50円以上に設定していること",
        "従業員を1名以上雇用していること"
      ],
      "bonus_rate": {
        "condition": "赤字事業者（直近1期の課税所得金額がゼロ以下）",
        "rate": "3/4（通常は2/3）"
      }
    },
    
    "application_method": {
      "type": "電子申請のみ",
      "system": "jGrants（補助金申請システム）経由の専用ポータル",
      "account_required": "GビズIDプライム（またはメンバー）",
      "account_note": "取得に2〜3週間要するため早めの準備が必要",
      "file_format": "PDF形式推奨"
    },
    
    "schedule": {
      "application_start": "2026年3月6日（金）",
      "support_plan_deadline": "2026年4月16日（木）（事業支援計画書の受付締切）",
      "application_end": "2026年4月30日（木）17:00",
      "result_announcement": "2026年6月下旬〜7月予定",
      "project_start": "交付決定日以降",
      "project_end": "2027年3月31日",
      "report_deadline": "事業終了後30日以内"
    },
    
    "contact": {
      "general": {
        "name": "小規模事業者持続化補助金事務局（商工会議所地区）",
        "phone": "03-6634-9307",
        "hours": "9:00〜12:00、13:00〜17:00",
        "url": "https://r6.jizokukahojokin.info/"
      },
      "local": "地元の商工会議所または商工会にご相談ください"
    },
    
    "official_urls": {
      "main": "https://r6.jizokukahojokin.info/",
      "guidelines": "https://r6.jizokukahojokin.info/doc/r6_koubover5_ip19.pdf",
      "portal": "https://www.jizokuka-portal.info/",
      "video": "https://youtu.be/DHrrePm4sj8"
    },
    
    "wall_chat_questions": [
      {"category": "基本情報", "question": "業種は何ですか？従業員は何名ですか？", "purpose": "小規模事業者要件の確認"},
      {"category": "基本情報", "question": "商工会議所・商工会の管轄地域で事業を営んでいますか？", "purpose": "申請資格の確認"},
      {"category": "事業計画", "question": "どのような販路開拓・販売促進を計画していますか？", "purpose": "補助事業の内容把握"},
      {"category": "経費", "question": "経費の内訳を教えてください（機械装置、広報、ウェブサイト等）", "purpose": "補助対象経費の確認"},
      {"category": "経費", "question": "ウェブサイト制作を予定していますか？その場合、他の経費もありますか？", "purpose": "ウェブサイト関連費の上限確認"},
      {"category": "インボイス特例", "question": "適格請求書発行事業者に登録済みですか？免税事業者からの転換ですか？", "purpose": "インボイス特例の確認"},
      {"category": "賃金引上げ特例", "question": "従業員を雇用していますか？事業場内最低賃金はいくらですか？", "purpose": "賃金引上げ特例の確認"},
      {"category": "赤字事業者", "question": "直近の決算で赤字でしたか？", "purpose": "補助率3/4適用の確認"},
      {"category": "加点項目", "question": "経営力向上計画や事業継続力強化計画の認定を受けていますか？", "purpose": "政策加点の確認"},
      {"category": "加点項目", "question": "事業承継やM&Aの実施予定・実績はありますか？", "purpose": "事業承継加点の確認"},
      {"category": "商工会", "question": "地元の商工会議所・商工会に相談済みですか？", "purpose": "事業支援計画書発行の準備確認"},
      {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況の確認"}
    ],
    
    "required_forms": [
      {
        "form_id": "様式2",
        "name": "経営計画兼補助事業計画①",
        "fields": ["企業概要", "顧客ニーズ・市場動向", "自社の強み", "経営方針・目標", "今後のプラン"],
        "notes": "経営計画と補助事業計画の基本情報を記載"
      },
      {
        "form_id": "様式3",
        "name": "補助事業計画②",
        "fields": ["補助事業名", "販路開拓等の取組内容", "業務効率化の取組内容", "補助事業の効果", "経費明細表"],
        "notes": "具体的な数値目標と実施スケジュールを記載"
      },
      {
        "form_id": "様式4",
        "name": "事業支援計画書",
        "fields": ["支援内容", "経営計画の評価", "補助事業計画の評価"],
        "notes": "商工会議所・商工会が発行。4月16日までに受付が必要"
      }
    ],
    
    "tips": [
      "事業支援計画書（様式4）は申請締切より2週間前が受付締切。早めに商工会議所に相談してください",
      "ウェブサイト関連費のみでの申請は不可。必ず他の経費と組み合わせてください",
      "インボイス特例と賃金引上げ特例は併用可能で、最大250万円まで補助上限が上がります",
      "GビズIDプライムの取得には2〜3週間かかるため、早めの準備が必要です",
      "加点は重点政策加点と政策加点からそれぞれ1つずつ、最大2つまで選択できます"
    ],
    
    "enriched_version": "v2_koubo_based",
    "koubo_source": "r6_koubover5_ip19.pdf",
    "last_updated": "2026-02-03"
  }',
  datetime('now'),
  datetime('now', '+1 year')
);

-- 古いREAL-003を非アクティブにする（第17回は終了）
UPDATE subsidy_cache 
SET request_reception_display_flag = 0,
    wall_chat_ready = 0,
    cached_at = datetime('now')
WHERE id = 'REAL-003';

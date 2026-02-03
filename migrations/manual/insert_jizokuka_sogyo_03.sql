-- 小規模事業者持続化補助金（創業型）第3回公募 - 詳細データ登録
-- 公募要領PDF: r6_koubover6_sogyo3.pdf より抽出

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
  'JIZOKUKA-SOGYO-03',
  '小規模事業者持続化補助金（創業型）第3回公募',
  'manual',
  2000000,  -- 200万円（インボイス特例で+50万円、最大250万円）
  '2/3',
  '全国',
  '全業種（小規模事業者）',
  '小規模事業者（商業・サービス業は5人以下、その他は20人以下）',
  '2026-01-06T00:00:00Z',
  '2026-04-30T17:00:00Z',
  1,
  1,
  'full',
  '{
    "id": "JIZOKUKA-SOGYO-03",
    "title": "小規模事業者持続化補助金（創業型）第3回公募",
    "official_name": "小規模事業者持続化補助金＜創業型＞",
    "round": "第3回公募",
    "description": "産業競争力強化法に基づく「特定創業支援等事業」の支援を受けた小規模事業者が、地域の商工会・商工会議所の支援を受けながら販路開拓等に取り組む費用を支援します。",
    
    "subsidy_amount": {
      "base_limit": 2000000,
      "invoice_special": {
        "additional": 500000,
        "max_with_special": 2500000,
        "condition": "免税事業者から適格請求書発行事業者に転換した事業者"
      },
      "description": "補助上限額200万円（インボイス特例で+50万円、最大250万円）"
    },
    
    "subsidy_rate": {
      "rate": "2/3",
      "description": "補助対象経費の2/3以内"
    },
    
    "target_area_search": "全国",
    "target_industry": "全業種（風俗営業等を除く）",
    "target_number_of_employees": "小規模事業者（商業・サービス業は従業員5人以下、その他は20人以下）",
    
    "eligibility_requirements": {
      "basic": [
        "小規模事業者であること（商業・サービス業は5人以下、その他は20人以下）",
        "資本金5億円以上の法人に100%保有されていないこと",
        "確定している（申告済の）直近の課税所得が15億円を超えていないこと"
      ],
      "creation_requirements": [
        {
          "item": "特定創業支援等事業の支援",
          "requirement": "産業競争力強化法に基づく「特定創業支援等事業」の支援を受けた証明書を発行されていること",
          "note": "証明書の発行日が公募締切から過去1年以内であること"
        },
        {
          "item": "開業届出書の提出",
          "requirement": "開業届出書（開業届）の「届出の区分」欄が「開業」であり、「開業・廃業等日」欄に記載の日付が公募締切時点から過去1年以内であること",
          "note": "開業から1年以内の創業者が対象"
        }
      ],
      "exclusions": [
        "過去に持続化補助金（一般型、創業型、共同・協業型）で採択を受けた事業者",
        "一般型の第17回・第18回・第19回公募に申請している事業者",
        "風俗営業等の規制及び業務の適正化等に関する法律に規定する事業を行う者",
        "暴力団関係者",
        "受付締切日において創業から1年を超える事業者"
      ]
    },
    
    "eligible_expenses": {
      "categories": [
        {
          "number": 1,
          "name": "機械装置等費",
          "description": "事業の遂行に必要な機械装置等の購入に要する経費",
          "examples": ["高機能券売機", "製造機械", "調理機器", "空調設備"],
          "limit": null
        },
        {
          "number": 2,
          "name": "広報費",
          "description": "パンフレット・ポスター・チラシ等を作成・配布するための費用",
          "examples": ["チラシ印刷", "パンフレット作成", "看板製作"],
          "limit": null
        },
        {
          "number": 3,
          "name": "ウェブサイト関連費",
          "description": "ウェブサイトやシステム等の開発、構築、更新、改修、運用に係る経費",
          "examples": ["ウェブサイト制作", "ECサイト構築", "予約システム", "SNS広告"],
          "limit": "補助金交付申請額の1/4（最大50万円）",
          "limit_note": "ウェブサイト関連費のみでの申請は不可"
        },
        {
          "number": 4,
          "name": "展示会等出展費",
          "description": "展示会・商談会等への出展料、関連する経費",
          "examples": ["出展料", "ブース装飾費", "通訳・翻訳費（展示会時）"],
          "limit": null
        },
        {
          "number": 5,
          "name": "旅費",
          "description": "販路開拓等を行うための旅費",
          "examples": ["営業出張", "展示会出張", "仕入れ出張"],
          "limit": null
        },
        {
          "number": 6,
          "name": "新商品開発費",
          "description": "新商品の試作品や包装パッケージの試作開発に係る経費",
          "examples": ["原材料費", "試作品製作費", "パッケージデザイン"],
          "limit": null
        },
        {
          "number": 7,
          "name": "借料",
          "description": "機器・設備等のリース料・レンタル料として支払われる経費",
          "examples": ["什器・備品レンタル", "会場借用費", "機械リース"],
          "limit": null
        },
        {
          "number": 8,
          "name": "委託・外注費",
          "description": "自ら行うことが困難な業務を第三者に委託するための経費",
          "examples": ["店舗改装", "設備工事", "システム開発外注"],
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
        "通信費（ウェブサイト関連費を除く）"
      ]
    },
    
    "required_documents": {
      "main_forms": [
        {"name": "様式1-1（申請書）", "description": "申請者の基本情報"},
        {"name": "様式2-1（経営計画書）", "description": "事業概要、経営方針、販路開拓の計画"},
        {"name": "様式3-1（補助事業計画書）", "description": "補助事業の内容、効果、経費明細"},
        {"name": "様式4（事業支援計画書）", "description": "商工会議所・商工会が発行", "deadline": "2026年4月16日まで"},
        {"name": "様式5（補助金交付申請書）", "description": "採択後に提出"},
        {"name": "様式6（電子媒体提出書）", "description": "採択後に提出"}
      ],
      "additional": [
        {"name": "開業届出書の写し", "requirement": "必須"},
        {"name": "特定創業支援等事業の証明書", "requirement": "必須"},
        {"name": "決算書（確定申告書）の写し", "requirement": "直近の決算を終えている場合"},
        {"name": "GビズIDプライムアカウント", "requirement": "電子申請に必須"}
      ]
    },
    
    "evaluation_criteria": {
      "basic_review": [
        "申請資格を満たしているか",
        "必要書類が提出されているか",
        "補助対象事業として適切か"
      ],
      "planning_review": [
        {"item": "経営計画", "points": ["自社の現状分析が的確か", "経営方針・目標が明確か", "将来の展望が具体的か"]},
        {"item": "補助事業計画", "points": ["事業の内容が具体的か", "実施スケジュールが適切か", "創意工夫があるか"]},
        {"item": "効果・実現可能性", "points": ["売上拡大効果が見込めるか", "実現可能性が高いか", "費用対効果が適切か"]}
      ],
      "bonus_review": {
        "重点政策加点": {
          "options": [
            "赤字賃上げ加点（賃上げを計画し、過去に赤字の事業者）",
            "事業承継加点（アトツギ甲子園ファイナリスト等）"
          ],
          "max_selection": 1
        },
        "政策加点": {
          "options": [
            "パワーアップ型（地域資源型・地域コミュニティ型）",
            "経営力向上計画加点（認定を受けている）",
            "事業継続力強化計画加点（認定を受けている）",
            "過疎地域加点（過疎地域で事業を営む）",
            "東日本大震災加点（被災地で事業を営む）"
          ],
          "max_selection": 1
        },
        "note": "重点政策加点から1つ、政策加点から1つ、合計2つまで選択可能"
      }
    },
    
    "application_method": {
      "type": "電子申請のみ",
      "system": "jGrants（補助金申請システム）",
      "account_required": "GビズIDプライムアカウント",
      "account_note": "取得に2〜3週間要するため早めの準備が必要",
      "file_format": "PDF形式推奨"
    },
    
    "schedule": {
      "application_start": "2026年1月6日",
      "support_plan_deadline": "2026年4月16日（事業支援計画書の受付締切）",
      "application_end": "2026年4月30日 17:00",
      "result_announcement": "2026年6月中旬予定",
      "project_start": "交付決定日以降",
      "project_end": "2027年3月31日",
      "report_deadline": "事業終了後30日以内"
    },
    
    "contact": {
      "general": {
        "name": "商工会議所地区：小規模事業者持続化補助金事務局",
        "url": "https://s23.jizokuka-portal.info/"
      },
      "local": "地元の商工会議所または商工会にご相談ください"
    },
    
    "official_urls": {
      "main": "https://r6.jizokukahojokin.info/sogyo/",
      "guidelines": "https://r6.jizokukahojokin.info/sogyo/files/sogyo_koubo.pdf",
      "forms": "https://r6.jizokukahojokin.info/sogyo/",
      "portal": "https://s23.jizokuka-portal.info/"
    },
    
    "wall_chat_questions": [
      {"category": "基本情報", "question": "開業届を提出した日はいつですか？", "purpose": "開業から1年以内の確認"},
      {"category": "基本情報", "question": "特定創業支援等事業の証明書を取得していますか？", "purpose": "申請資格の確認"},
      {"category": "基本情報", "question": "業種は何ですか？従業員は何名ですか？", "purpose": "小規模事業者要件の確認"},
      {"category": "事業計画", "question": "どのような販路開拓・販売促進を計画していますか？", "purpose": "補助事業の内容把握"},
      {"category": "経費", "question": "経費の内訳を教えてください（機械装置、広報、ウェブサイト等）", "purpose": "補助対象経費の確認"},
      {"category": "経費", "question": "ウェブサイト制作を予定していますか？その場合、他の経費もありますか？", "purpose": "ウェブサイト関連費の上限確認"},
      {"category": "インボイス", "question": "インボイス登録事業者ですか？免税事業者からの転換ですか？", "purpose": "インボイス特例の確認"},
      {"category": "加点", "question": "過去に赤字がありましたか？また、賃上げを計画していますか？", "purpose": "赤字賃上げ加点の確認"},
      {"category": "加点", "question": "経営力向上計画や事業継続力強化計画の認定を受けていますか？", "purpose": "政策加点の確認"},
      {"category": "商工会", "question": "地元の商工会議所・商工会に相談済みですか？", "purpose": "事業支援計画書発行の準備確認"},
      {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況の確認"}
    ],
    
    "required_forms": [
      {
        "form_id": "様式2-1",
        "name": "経営計画書",
        "fields": ["企業概要", "顧客ニーズと市場の動向", "自社や自社の提供する商品・サービスの強み", "経営方針・目標と今後のプラン"],
        "notes": "創業の動機や背景も記載"
      },
      {
        "form_id": "様式3-1",
        "name": "補助事業計画書",
        "fields": ["補助事業で行う事業名", "販路開拓等（生産性向上）の取組内容", "業務効率化（生産性向上）の取組内容", "補助事業の効果", "経費明細表"],
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
      "開業届と特定創業支援等事業の証明書の発行日が「公募締切から過去1年以内」であることを確認してください",
      "事業支援計画書（様式4）は申請締切より2週間前が受付締切なので、早めに商工会議所に相談してください",
      "ウェブサイト関連費のみでの申請は不可。必ず他の経費と組み合わせてください",
      "過去に持続化補助金（一般型含む）で採択されている場合は申請不可です"
    ],
    
    "enriched_version": "v2_koubo_based",
    "koubo_source": "r6_koubover6_sogyo3.pdf",
    "last_updated": "2026-02-03"
  }',
  datetime('now'),
  datetime('now', '+1 year')
);

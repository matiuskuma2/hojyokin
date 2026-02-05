-- =====================================================
-- IT導入補助金2026（中小企業デジタル化・AI導入支援事業費補助金）
-- 
-- 情報源:
-- - 公式サイト: https://it-shien.smrj.go.jp/
-- - ダウンロードページ: https://it-shien.smrj.go.jp/download/
-- - 交付規程 通常枠: it2026_kitei_tsujyo.pdf
-- - 交付規程 インボイス枠（インボイス対応類型）: it2026_kitei_invoice.pdf
-- - 交付規程 インボイス枠（電子取引類型）: it2026_kitei_denshi.pdf
-- - 交付規程 複数社連携デジタル化・AI導入枠: it2026_kitei_fukusu.pdf
-- 
-- 事務局: TOPPAN株式会社
-- 登録日: 2026-02-05
-- =====================================================

-- =====================================================
-- 1. 通常枠
-- =====================================================
INSERT OR REPLACE INTO subsidy_cache (
  id,
  source,
  title,
  subsidy_max_limit,
  subsidy_rate,
  target_area_search,
  target_industry,
  target_number_of_employees,
  acceptance_start_datetime,
  acceptance_end_datetime,
  request_reception_display_flag,
  detail_json,
  cached_at,
  expires_at,
  wall_chat_ready,
  wall_chat_missing,
  detail_score,
  is_electronic_application,
  is_visible
) VALUES (
  'IT-SUBSIDY-2026-TSUJYO',
  'manual',
  '中小企業デジタル化・AI導入支援事業費補助金（IT導入補助金2026）通常枠',
  4500000,
  '1/2（賃上げ特例は2/3）',
  '全国',
  '全業種',
  '中小企業・小規模事業者等',
  '2026-02-01T00:00:00Z',
  '2026-12-31T23:59:00Z',
  1,
  '{
    "subsidy_overview": "通常枠は、中小企業・小規模事業者等が生産性向上のためにITツール（ソフトウェア・AI・クラウドサービス等）を単独で導入する費用の一部を補助します。働き方改革、被用者保険の適用拡大、賃上げ、インボイス導入等の制度変更への対応を支援します。",
    "subsidy_purpose": "中小企業・小規模事業者等の生産性向上を図ること",
    "issuer": "中小企業庁",
    "issuer_department": "独立行政法人中小企業基盤整備機構",
    "secretariat": "中小企業デジタル化・AI導入支援事業事務局（TOPPAN株式会社）",
    
    "application_types": [
      {
        "name": "5万円〜150万円未満",
        "min_amount": 50000,
        "max_amount": 1499999,
        "process_requirement": "1プロセス以上",
        "subsidy_rate": "1/2以内",
        "subsidy_rate_special": "2/3以内（賃上げ特例）"
      },
      {
        "name": "150万円〜450万円以下",
        "min_amount": 1500000,
        "max_amount": 4500000,
        "process_requirement": "4プロセス以上",
        "subsidy_rate": "1/2以内",
        "subsidy_rate_special": "2/3以内（賃上げ特例）"
      }
    ],
    
    "subsidy_rates": [
      {
        "condition": "通常",
        "rate": "1/2以内"
      },
      {
        "condition": "賃上げ特例（令和6年10月〜令和7年9月に地域別最低賃金以上〜改定後最低賃金未満で従業員30%以上を3ヶ月以上雇用）",
        "rate": "2/3以内"
      }
    ],
    
    "process_categories": [
      "顧客対応・販売支援",
      "決済・債権債務・資金回収",
      "供給・在庫・物流",
      "会計・財務・経営",
      "総務・人事・給与・労務・教育訓練・法務・情シス・統合業務",
      "業種固有",
      "汎用・自動化・分析ツール"
    ],
    
    "eligibility_requirements": {
      "basic_requirements": [
        "中小企業・小規模事業者等であること",
        "生産性向上に資するITツールを導入すること",
        "日本国内で法人登記され事業を営んでいること（法人）または日本国内に事業の実施場所があること（個人）",
        "IT導入支援事業者が登録したITツールを導入すること",
        "暴力団等の反社会的勢力でないこと"
      ],
      "productivity_requirements": [
        "1年後に労働生産性を3%以上向上させる計画（過去交付決定者は4%以上）",
        "3年間で労働生産性を年平均3%以上向上（過去交付決定者は4%以上）"
      ],
      "wage_requirements_150over": [
        "補助額150万円以上の場合: 1人当たり給与支給総額の年平均成長率を物価目標+1%以上向上",
        "事業場内最低賃金を地域別最低賃金+30円以上にすること",
        "賃金引上げ計画を従業員に表明していること"
      ],
      "wage_requirements_past_recipients": [
        "IT導入補助金2022〜2025で交付決定を受けた場合: 1人当たり給与支給総額を物価目標+1.5%以上向上",
        "賃金引上げ計画を従業員に表明していること"
      ],
      "enterprise_definitions": [
        {"industry": "製造業・建設業・運輸業その他", "capital": "3億円以下", "employees": "300人以下"},
        {"industry": "卸売業", "capital": "1億円以下", "employees": "100人以下"},
        {"industry": "サービス業", "capital": "5千万円以下", "employees": "100人以下"},
        {"industry": "小売業", "capital": "5千万円以下", "employees": "50人以下"}
      ]
    },
    
    "eligible_expenses": {
      "categories": [
        {
          "name": "ソフトウェア購入費",
          "description": "生産性向上に資するITツール（AIを含む）"
        },
        {
          "name": "クラウド利用費",
          "description": "クラウド利用料（最大2年分）"
        },
        {
          "name": "導入関連費",
          "description": "ITツール導入に必要な費用"
        }
      ],
      "notes": [
        "ITツールはIT導入支援事業者が事務局に登録したものに限る",
        "1〜4プロセスの機能要件を満たすソフトウェアが対象"
      ]
    },
    
    "required_documents": {
      "common": [
        {"name": "gBizIDプライム", "description": "申請にはgBizIDプライムが必要", "required": true},
        {"name": "SECURITY ACTION宣言", "description": "★一つ星または★★二つ星の宣言", "required": true},
        {"name": "履歴事項全部証明書", "description": "法人の場合", "required": true},
        {"name": "法人税の納税証明書", "description": "直近分", "required": true}
      ],
      "individual": [
        {"name": "運転免許証・住民票", "description": "本人確認書類", "required": true},
        {"name": "所得税の納税証明書", "description": "確定申告書でも可", "required": true}
      ]
    },
    
    "application_flow": [
      {"step": 1, "title": "gBizIDプライム取得", "description": "デジタル庁のgBizIDプライムを取得"},
      {"step": 2, "title": "SECURITY ACTION宣言", "description": "IPAが実施するSECURITY ACTIONを宣言"},
      {"step": 3, "title": "IT導入支援事業者選定", "description": "事務局に登録されたIT導入支援事業者を選定"},
      {"step": 4, "title": "ITツール選定", "description": "導入するITツールを選定"},
      {"step": 5, "title": "交付申請", "description": "IT導入支援事業者のサポートを受けて電子申請"},
      {"step": 6, "title": "交付決定", "description": "事務局による審査後、交付決定通知"},
      {"step": 7, "title": "ITツール発注・契約・導入", "description": "交付決定後にITツールを発注・導入"},
      {"step": 8, "title": "事業実績報告", "description": "導入完了後、実績報告を提出"},
      {"step": 9, "title": "補助金交付", "description": "確定検査後、補助金交付"},
      {"step": 10, "title": "事業実施効果報告", "description": "導入後の生産性向上効果を報告"}
    ],
    
    "implementation_period": "交付決定日から事務局が定める期日まで",
    "effect_report_period": "交付後3年間（生産性向上の報告）",
    
    "contact_info": {
      "name": "中小企業デジタル化・AI導入支援事業事務局",
      "organization": "TOPPAN株式会社"
    },
    
    "official_urls": {
      "main": "https://it-shien.smrj.go.jp/",
      "download": "https://it-shien.smrj.go.jp/download/",
      "kitei_pdf": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_tsujyo.pdf"
    },
    
    "pdf_attachments": [
      {"name": "交付規程（通常枠）", "url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_tsujyo.pdf"}
    ],
    
    "is_electronic_application": true,
    "application_method": "電子申請（IT導入支援事業者のサポート必須）",
    
    "wall_chat_questions": [
      {"category": "基本情報", "question": "事業の業種は何ですか？", "purpose": "中小企業要件の判定"},
      {"category": "基本情報", "question": "資本金（出資総額）はいくらですか？", "purpose": "中小企業要件の判定"},
      {"category": "基本情報", "question": "従業員数は何名ですか？（常勤）", "purpose": "中小企業要件の判定"},
      {"category": "ITツール", "question": "どのような業務プロセスを改善したいですか？", "purpose": "対象プロセスの確認"},
      {"category": "ITツール", "question": "導入予定のITツール（ソフトウェア・AIツール等）は決まっていますか？", "purpose": "IT導入支援事業者の選定"},
      {"category": "ITツール", "question": "ITツールの導入費用（見積額）はいくらですか？", "purpose": "補助額区分の判定"},
      {"category": "ITツール", "question": "クラウドサービスの利用を予定していますか？", "purpose": "補助対象経費の確認"},
      {"category": "生産性向上", "question": "現在の労働生産性（粗利益÷労働投入量）はいくらですか？", "purpose": "計画策定の参考"},
      {"category": "過去申請", "question": "IT導入補助金2022〜2025で交付決定を受けたことがありますか？", "purpose": "要件の確認（過去交付者は要件が厳しい）"},
      {"category": "賃上げ", "question": "補助額150万円以上を申請予定ですか？", "purpose": "賃金引上げ要件の確認"},
      {"category": "賃上げ", "question": "事業場内最低賃金はいくらですか？", "purpose": "賃金引上げ要件の確認"},
      {"category": "準備状況", "question": "gBizIDプライムは取得済みですか？", "purpose": "申請準備状況の確認"},
      {"category": "準備状況", "question": "SECURITY ACTION宣言は完了していますか？", "purpose": "申請準備状況の確認"}
    ],
    
    "bonus_points": [],
    
    "notes": [
      "交付決定前に発注・契約・導入したITツールは補助対象外",
      "IT導入支援事業者のサポートが必須",
      "事業実施効果報告を3年間行う義務あり",
      "令和8年（2026年）1月16日施行"
    ],
    
    "last_updated": "2026-02-05",
    "koubo_source": "it2026_kitei_tsujyo.pdf",
    "enriched_version": "v2_koubo_based"
  }',
  datetime('now'),
  datetime('now', '+30 days'),
  1,
  '[]',
  75,
  1,
  1
);

-- =====================================================
-- 2. インボイス枠（インボイス対応類型）
-- =====================================================
INSERT OR REPLACE INTO subsidy_cache (
  id,
  source,
  title,
  subsidy_max_limit,
  subsidy_rate,
  target_area_search,
  target_industry,
  target_number_of_employees,
  acceptance_start_datetime,
  acceptance_end_datetime,
  request_reception_display_flag,
  detail_json,
  cached_at,
  expires_at,
  wall_chat_ready,
  wall_chat_missing,
  detail_score,
  is_electronic_application,
  is_visible
) VALUES (
  'IT-SUBSIDY-2026-INVOICE',
  'manual',
  '中小企業デジタル化・AI導入支援事業費補助金（IT導入補助金2026）インボイス枠（インボイス対応類型）',
  3500000,
  '3/4〜4/5（ITツール）、1/2（ハードウェア）',
  '全国',
  '全業種',
  '中小企業・小規模事業者等',
  '2026-02-01T00:00:00Z',
  '2026-12-31T23:59:00Z',
  1,
  '{
    "subsidy_overview": "インボイス枠（インボイス対応類型）は、生産性向上に取り組む中小企業・小規模事業者等を支援するとともに、インボイス制度への対応を強力に推進するため、通常枠より補助率を引き上げて優先的に支援します。会計・受発注・決済ソフトとハードウェア（PC・レジ等）が対象です。",
    "subsidy_purpose": "インボイス制度への対応推進と生産性向上",
    "issuer": "中小企業庁",
    "issuer_department": "独立行政法人中小企業基盤整備機構",
    "secretariat": "中小企業デジタル化・AI導入支援事業事務局（TOPPAN株式会社）",
    
    "application_types": [
      {
        "name": "ITツール（〜50万円部分）",
        "max_amount": 500000,
        "subsidy_rate": "3/4以内（小規模事業者は4/5以内）",
        "function_requirement": "会計・受発注・決済のうち1機能以上"
      },
      {
        "name": "ITツール（50万円超〜350万円部分）",
        "min_amount": 500001,
        "max_amount": 3500000,
        "subsidy_rate": "2/3以内",
        "function_requirement": "会計・受発注・決済のうち2機能以上"
      },
      {
        "name": "PC・タブレット等",
        "max_amount": 100000,
        "subsidy_rate": "1/2以内",
        "description": "PC、タブレット、プリンター、スキャナー、複合機"
      },
      {
        "name": "レジ・券売機",
        "max_amount": 200000,
        "subsidy_rate": "1/2以内",
        "description": "POSレジ、モバイルPOSレジ、券売機"
      }
    ],
    
    "eligible_it_functions": [
      "会計",
      "受発注",
      "決済"
    ],
    
    "eligible_hardware": {
      "pc_tablet": ["PC", "タブレット", "プリンター", "スキャナー", "複合機"],
      "pos_register": ["POSレジ", "モバイルPOSレジ", "券売機"]
    },
    
    "eligibility_requirements": {
      "basic_requirements": [
        "中小企業・小規模事業者等であること",
        "インボイス制度に対応したITツールを導入すること",
        "会計・受発注・決済のいずれかの機能を有するソフトウェアを導入すること",
        "日本国内で法人登記され事業を営んでいること（法人）",
        "IT導入支援事業者が登録したITツールを導入すること"
      ],
      "wage_requirements_past_recipients": [
        "IT導入補助金2022〜2025で交付決定を受けた場合: 1人当たり給与支給総額を物価目標+1.5%以上向上",
        "賃金引上げ計画を従業員に表明していること"
      ]
    },
    
    "eligible_expenses": {
      "categories": [
        {"name": "ソフトウェア購入費", "description": "会計・受発注・決済機能を有するもの"},
        {"name": "クラウド利用費", "description": "クラウド利用料（最大2年分）"},
        {"name": "ハードウェア関連費", "description": "PC・タブレット・レジ等"},
        {"name": "導入関連費", "description": "ITツール導入に必要な費用"}
      ]
    },
    
    "application_flow": [
      {"step": 1, "title": "gBizIDプライム取得", "description": "デジタル庁のgBizIDプライムを取得"},
      {"step": 2, "title": "SECURITY ACTION宣言", "description": "IPAのSECURITY ACTIONを宣言"},
      {"step": 3, "title": "IT導入支援事業者選定", "description": "インボイス対応ITツールを提供する事業者を選定"},
      {"step": 4, "title": "交付申請", "description": "IT導入支援事業者と共同で電子申請"},
      {"step": 5, "title": "交付決定", "description": "審査後、交付決定通知"},
      {"step": 6, "title": "ITツール導入", "description": "交付決定後に発注・導入"},
      {"step": 7, "title": "事業実績報告", "description": "導入完了後、実績報告"},
      {"step": 8, "title": "補助金交付", "description": "確定検査後、補助金交付"}
    ],
    
    "official_urls": {
      "main": "https://it-shien.smrj.go.jp/",
      "download": "https://it-shien.smrj.go.jp/download/",
      "kitei_pdf": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_invoice.pdf"
    },
    
    "pdf_attachments": [
      {"name": "交付規程（インボイス枠・インボイス対応類型）", "url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_invoice.pdf"}
    ],
    
    "is_electronic_application": true,
    
    "wall_chat_questions": [
      {"category": "基本情報", "question": "事業の業種と従業員数を教えてください", "purpose": "中小企業要件・小規模事業者要件の判定"},
      {"category": "インボイス", "question": "インボイス制度（適格請求書等保存方式）への対応は進んでいますか？", "purpose": "補助対象の確認"},
      {"category": "ITツール", "question": "導入予定のソフトウェアは会計・受発注・決済のどの機能がありますか？", "purpose": "機能要件の確認"},
      {"category": "ITツール", "question": "ITツールの導入費用（見積額）はいくらですか？", "purpose": "補助額・補助率の判定"},
      {"category": "ハードウェア", "question": "PC・タブレットやレジ・券売機の導入も予定していますか？", "purpose": "ハードウェア補助の確認"},
      {"category": "過去申請", "question": "IT導入補助金2022〜2025で交付決定を受けたことがありますか？", "purpose": "賃金要件の確認"}
    ],
    
    "notes": [
      "インボイス制度対応のための会計・受発注・決済ソフトが対象",
      "ハードウェア（PC・レジ等）も補助対象（別枠）",
      "小規模事業者は補助率が優遇（4/5）",
      "令和8年（2026年）1月16日施行"
    ],
    
    "last_updated": "2026-02-05",
    "koubo_source": "it2026_kitei_invoice.pdf",
    "enriched_version": "v2_koubo_based"
  }',
  datetime('now'),
  datetime('now', '+30 days'),
  1,
  '[]',
  75,
  1,
  1
);

-- =====================================================
-- 3. インボイス枠（電子取引類型）
-- =====================================================
INSERT OR REPLACE INTO subsidy_cache (
  id,
  source,
  title,
  subsidy_max_limit,
  subsidy_rate,
  target_area_search,
  target_industry,
  target_number_of_employees,
  acceptance_start_datetime,
  acceptance_end_datetime,
  request_reception_display_flag,
  detail_json,
  cached_at,
  expires_at,
  wall_chat_ready,
  wall_chat_missing,
  detail_score,
  is_electronic_application,
  is_visible
) VALUES (
  'IT-SUBSIDY-2026-DENSHI',
  'manual',
  '中小企業デジタル化・AI導入支援事業費補助金（IT導入補助金2026）インボイス枠（電子取引類型）',
  3500000,
  '2/3（中小企業）、1/2（その他）',
  '全国',
  '全業種',
  '中小企業・小規模事業者等（発注側）',
  '2026-02-01T00:00:00Z',
  '2026-12-31T23:59:00Z',
  1,
  '{
    "subsidy_overview": "インボイス枠（電子取引類型）は、取引関係における発注者がインボイス制度対応のITツール（受発注ソフト）を導入し、受注者である中小企業・小規模事業者等にアカウントを無償供与する場合に支援します。受発注のデジタル化とインボイス対応を同時に推進します。",
    "subsidy_purpose": "受発注のデジタル化とインボイス制度対応の推進",
    "issuer": "中小企業庁",
    "issuer_department": "独立行政法人中小企業基盤整備機構",
    "secretariat": "中小企業デジタル化・AI導入支援事業事務局（TOPPAN株式会社）",
    
    "subsidy_rates": [
      {"condition": "中小企業・小規模事業者等", "rate": "2/3以内"},
      {"condition": "その他の事業者等", "rate": "1/2以内"}
    ],
    
    "max_subsidy": 3500000,
    
    "function_requirements": [
      "インボイス制度に対応した受発注機能を有すること",
      "発注側が受注側にアカウントを無償で発行し利用させる機能を有すること",
      "クラウド型のソフトウェアであること"
    ],
    
    "eligibility_requirements": {
      "basic_requirements": [
        "取引関係における発注者であること",
        "自らの費用負担でITツールを導入すること",
        "受注者に1社以上の中小企業・小規模事業者等が含まれること",
        "日本国内で法人登記され事業を営んでいること"
      ],
      "wage_requirements_past_recipients": [
        "IT導入補助金2022〜2025で交付決定を受けた場合: 1人当たり給与支給総額を物価目標+1.5%以上向上（中小以外は+3%以上）"
      ]
    },
    
    "eligible_expenses": {
      "categories": [
        {"name": "クラウド利用費", "description": "クラウド利用料（最大2年分）"}
      ],
      "calculation_method": "契約する受注側アカウント総数のうち、中小企業・小規模事業者等に供与するアカウント数の割合を乗じた額が補助対象"
    },
    
    "official_urls": {
      "main": "https://it-shien.smrj.go.jp/",
      "download": "https://it-shien.smrj.go.jp/download/",
      "kitei_pdf": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_denshi.pdf"
    },
    
    "pdf_attachments": [
      {"name": "交付規程（インボイス枠・電子取引類型）", "url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_denshi.pdf"}
    ],
    
    "is_electronic_application": true,
    
    "wall_chat_questions": [
      {"category": "事業形態", "question": "取引先（受注者）に対して発注を行う立場ですか？", "purpose": "申請資格の確認"},
      {"category": "取引先", "question": "取引先（受注者）に中小企業・小規模事業者は含まれますか？", "purpose": "申請要件の確認"},
      {"category": "ITツール", "question": "受発注システムの導入を検討していますか？", "purpose": "対象ITツールの確認"},
      {"category": "ITツール", "question": "受注者にアカウントを無償で提供できるクラウドサービスを予定していますか？", "purpose": "機能要件の確認"},
      {"category": "費用", "question": "クラウドサービスの年間利用料はいくらですか？", "purpose": "補助額の算定"}
    ],
    
    "notes": [
      "発注者がITツールを導入し、受注者にアカウントを無償供与する形態",
      "クラウド型の受発注ソフトが対象",
      "中小企業・小規模事業者以外の事業者も申請可能（補助率は異なる）",
      "令和8年（2026年）1月16日施行"
    ],
    
    "last_updated": "2026-02-05",
    "koubo_source": "it2026_kitei_denshi.pdf",
    "enriched_version": "v2_koubo_based"
  }',
  datetime('now'),
  datetime('now', '+30 days'),
  1,
  '[]',
  70,
  1,
  1
);

-- =====================================================
-- 4. 複数社連携デジタル化・AI導入枠
-- =====================================================
INSERT OR REPLACE INTO subsidy_cache (
  id,
  source,
  title,
  subsidy_max_limit,
  subsidy_rate,
  target_area_search,
  target_industry,
  target_number_of_employees,
  acceptance_start_datetime,
  acceptance_end_datetime,
  request_reception_display_flag,
  detail_json,
  cached_at,
  expires_at,
  wall_chat_ready,
  wall_chat_missing,
  detail_score,
  is_electronic_application,
  is_visible
) VALUES (
  'IT-SUBSIDY-2026-FUKUSU',
  'manual',
  '中小企業デジタル化・AI導入支援事業費補助金（IT導入補助金2026）複数社連携デジタル化・AI導入枠',
  30000000,
  '2/3〜4/5',
  '全国',
  '全業種',
  '中小企業・小規模事業者等（グループ）',
  '2026-02-01T00:00:00Z',
  '2026-12-31T23:59:00Z',
  1,
  '{
    "subsidy_overview": "複数社連携デジタル化・AI導入枠は、商工団体・地域団体等が代表事業者となり、複数の中小企業・小規模事業者で補助事業グループを構成し、ITツールの共同導入や消費動向分析システム等を導入する場合に支援します。",
    "subsidy_purpose": "地域の複数事業者が連携したデジタル化・AI活用による生産性向上",
    "issuer": "中小企業庁",
    "issuer_department": "独立行政法人中小企業基盤整備機構",
    "secretariat": "中小企業デジタル化・AI導入支援事業事務局（TOPPAN株式会社）",
    
    "group_structure": {
      "representative": "代表事業者（商工団体等）",
      "participants": "参画事業者（中小企業・小規模事業者等）",
      "eligible_representatives": [
        "商店街振興組合・同連合会",
        "商工会",
        "商工会議所"
      ]
    },
    
    "expense_categories": [
      {
        "name": "インボイス対応類型経費",
        "max_amount": 3500000,
        "subsidy_rate_50under": "3/4以内（小規模は4/5以内）",
        "subsidy_rate_50over": "2/3以内",
        "description": "会計・受発注・決済ソフト、PC・レジ等"
      },
      {
        "name": "消費動向等分析経費",
        "calculation": "50万円×グループ構成員数",
        "subsidy_rate": "2/3以内",
        "examples": ["消費動向分析システム", "経営分析システム", "需要予測システム", "電子地域通貨システム", "キャッシュレスシステム", "生体認証決済システム", "AIカメラ", "ビーコン", "デジタルサイネージ"]
      },
      {
        "name": "事務費・専門家経費",
        "calculation": "インボイス対応類型経費と消費動向等分析経費の合計の10%",
        "max_amount": 2000000,
        "subsidy_rate": "2/3以内",
        "description": "代表事業者の取りまとめ事務費、外部専門家謝金・旅費"
      }
    ],
    
    "max_subsidy_total": 30000000,
    
    "eligibility_requirements": {
      "representative_requirements": [
        "商店街振興組合・商工会・商工会議所等であること",
        "日本国内で法人登記されていること",
        "gBizIDプライムを取得していること",
        "SECURITY ACTION宣言を行っていること",
        "参画事業者の取りまとめを行うこと"
      ],
      "participant_requirements": [
        "中小企業・小規模事業者等であること",
        "日本国内で法人登記または事業を営んでいること",
        "SECURITY ACTION宣言を行っていること",
        "代表事業者の管理のもとで補助事業を遂行すること"
      ]
    },
    
    "official_urls": {
      "main": "https://it-shien.smrj.go.jp/",
      "download": "https://it-shien.smrj.go.jp/download/",
      "kitei_pdf": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_fukusu.pdf"
    },
    
    "pdf_attachments": [
      {"name": "交付規程（複数社連携デジタル化・AI導入枠）", "url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_fukusu.pdf"}
    ],
    
    "is_electronic_application": true,
    
    "wall_chat_questions": [
      {"category": "グループ構成", "question": "商工会・商工会議所・商店街振興組合等が代表事業者となれますか？", "purpose": "代表事業者要件の確認"},
      {"category": "グループ構成", "question": "補助事業グループを構成する中小企業は何社ですか？", "purpose": "補助額の算定"},
      {"category": "導入予定", "question": "消費動向分析システムやキャッシュレスシステム等の導入を予定していますか？", "purpose": "消費動向等分析経費の確認"},
      {"category": "導入予定", "question": "参画事業者が会計・受発注・決済ソフトを導入しますか？", "purpose": "インボイス対応類型経費の確認"},
      {"category": "体制", "question": "外部専門家の支援を受ける予定はありますか？", "purpose": "事務費・専門家経費の確認"}
    ],
    
    "notes": [
      "商工団体等が代表事業者となり、複数の中小企業で構成するグループが対象",
      "消費動向分析システム・AIカメラ・デジタルサイネージ等も対象",
      "補助上限額は3,000万円（全経費区分の合計）",
      "代表事業者はgBizIDプライム・SECURITY ACTION必須",
      "令和8年（2026年）1月16日施行"
    ],
    
    "last_updated": "2026-02-05",
    "koubo_source": "it2026_kitei_fukusu.pdf",
    "enriched_version": "v2_koubo_based"
  }',
  datetime('now'),
  datetime('now', '+30 days'),
  1,
  '[]',
  70,
  1,
  1
);

-- =====================================================
-- SSOTテーブル（subsidy_canonical）への登録
-- =====================================================
INSERT OR REPLACE INTO subsidy_canonical (
  id,
  name,
  name_normalized,
  issuer_code,
  issuer_name,
  prefecture_code,
  category_codes,
  industry_codes,
  latest_snapshot_id,
  latest_cache_id,
  first_seen_at,
  last_updated_at,
  is_active,
  notes,
  created_at,
  updated_at
) VALUES (
  'IT-SUBSIDY-2026',
  '中小企業デジタル化・AI導入支援事業費補助金（IT導入補助金2026）',
  'IT導入補助金',
  'SMRJ',
  '中小企業基盤整備機構',
  NULL,
  '["it", "digitalization", "ai", "productivity"]',
  '["all"]',
  'IT-SUBSIDY-2026-SNAP-001',
  'IT-SUBSIDY-2026-TSUJYO',
  datetime('now'),
  datetime('now'),
  1,
  '令和8年度（2026年）IT導入補助金 - 通常枠・インボイス枠・複数社連携枠',
  datetime('now'),
  datetime('now')
);

-- =====================================================
-- SSOTスナップショット（subsidy_snapshot）への登録
-- =====================================================
INSERT OR REPLACE INTO subsidy_snapshot (
  id,
  canonical_id,
  source_link_id,
  round_key,
  fiscal_year,
  acceptance_start,
  acceptance_end,
  deadline_text,
  is_accepting,
  subsidy_max_limit,
  subsidy_min_limit,
  subsidy_rate,
  subsidy_rate_max,
  target_area_codes,
  target_area_text,
  target_industry_codes,
  target_employee_text,
  official_url,
  pdf_urls,
  attachments,
  detail_json,
  snapshot_at,
  content_hash,
  created_at
) VALUES (
  'IT-SUBSIDY-2026-SNAP-001',
  'IT-SUBSIDY-2026',
  NULL,
  '2026',
  '2026',
  '2026-02-01',
  '2026-12-31',
  '公募中（詳細は公募要領参照）',
  1,
  30000000,
  50000,
  '1/2〜4/5',
  0.8,
  '["00"]',
  '全国',
  '["all"]',
  '中小企業・小規模事業者等',
  'https://it-shien.smrj.go.jp/',
  '["https://it-shien.smrj.go.jp/pdf/it2026_kitei_tsujyo.pdf","https://it-shien.smrj.go.jp/pdf/it2026_kitei_invoice.pdf","https://it-shien.smrj.go.jp/pdf/it2026_kitei_denshi.pdf","https://it-shien.smrj.go.jp/pdf/it2026_kitei_fukusu.pdf"]',
  '[{"name":"交付規程（通常枠）","url":"https://it-shien.smrj.go.jp/pdf/it2026_kitei_tsujyo.pdf"},{"name":"交付規程（インボイス枠・インボイス対応類型）","url":"https://it-shien.smrj.go.jp/pdf/it2026_kitei_invoice.pdf"},{"name":"交付規程（インボイス枠・電子取引類型）","url":"https://it-shien.smrj.go.jp/pdf/it2026_kitei_denshi.pdf"},{"name":"交付規程（複数社連携枠）","url":"https://it-shien.smrj.go.jp/pdf/it2026_kitei_fukusu.pdf"}]',
  NULL,
  datetime('now'),
  'manual_2026-02-05',
  datetime('now')
);

-- =====================================================
-- IT導入補助金の監視設定を追加
-- =====================================================
INSERT OR IGNORE INTO data_source_monitors (
  id,
  subsidy_canonical_id,
  source_name,
  source_url,
  monitor_type,
  check_interval_hours,
  selectors,
  url_patterns,
  content_selectors,
  status,
  notes,
  created_at,
  updated_at
) VALUES (
  'MONITOR-IT-SUBSIDY-2026',
  'IT-SUBSIDY-2026',
  'IT導入補助金2026 ダウンロードページ',
  'https://it-shien.smrj.go.jp/download/',
  'webpage',
  168,
  '["a[href$=\".pdf\"]", "a[href$=\".docx\"]", "a[href$=\".xlsx\"]"]',
  '["https://it-shien.smrj.go.jp/pdf/it2026_.*\\.(pdf|docx|xlsx)"]',
  NULL,
  'active',
  'IT導入補助金2026の交付規程・公募要領・様式を週次監視',
  datetime('now'),
  datetime('now')
);

-- 監視対象ファイル
INSERT OR IGNORE INTO monitored_files (
  id,
  monitor_id,
  file_name,
  file_description,
  url_pattern,
  file_type,
  importance,
  status,
  created_at,
  updated_at
) VALUES
  ('MF-IT-001', 'MONITOR-IT-SUBSIDY-2026', '交付規程（通常枠）', 'it2026_kitei_tsujyo.pdf', 'it2026_kitei_tsujyo\\.pdf', 'pdf', 'critical', 'active', datetime('now'), datetime('now')),
  ('MF-IT-002', 'MONITOR-IT-SUBSIDY-2026', '交付規程（インボイス枠・インボイス対応類型）', 'it2026_kitei_invoice.pdf', 'it2026_kitei_invoice\\.pdf', 'pdf', 'critical', 'active', datetime('now'), datetime('now')),
  ('MF-IT-003', 'MONITOR-IT-SUBSIDY-2026', '交付規程（インボイス枠・電子取引類型）', 'it2026_kitei_denshi.pdf', 'it2026_kitei_denshi\\.pdf', 'pdf', 'critical', 'active', datetime('now'), datetime('now')),
  ('MF-IT-004', 'MONITOR-IT-SUBSIDY-2026', '交付規程（複数社連携枠）', 'it2026_kitei_fukusu.pdf', 'it2026_kitei_fukusu\\.pdf', 'pdf', 'critical', 'active', datetime('now'), datetime('now')),
  ('MF-IT-005', 'MONITOR-IT-SUBSIDY-2026', '公募要領（通常枠）', 'it2026_koubo_tsujyo.pdf', 'it2026_koubo_tsujyo\\.pdf', 'pdf', 'critical', 'active', datetime('now'), datetime('now')),
  ('MF-IT-006', 'MONITOR-IT-SUBSIDY-2026', '公募要領（インボイス枠）', 'it2026_koubo_invoice.pdf', 'it2026_koubo_invoice\\.pdf', 'pdf', 'critical', 'active', datetime('now'), datetime('now'));

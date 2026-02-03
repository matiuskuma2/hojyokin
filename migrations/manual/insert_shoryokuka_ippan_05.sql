-- 省力化投資補助金（一般型）第5回公募 - 詳細データ登録
-- 公募要領PDF: application_guidelines_ippan_05.pdf より抽出

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
  'SHORYOKUKA-IPPAN-05',
  '中小企業省力化投資補助金（一般型）第5回公募',
  'manual',
  80000000,  -- 8,000万円（101人以上の場合）
  '1/2〜2/3',
  '全国',
  '全業種',
  '中小企業・小規模事業者（従業員1名以上）',
  '2025-12-01T00:00:00Z',  -- 申請開始は未定、暫定
  '2026-06-30T17:00:00Z',  -- 申請締切は未定、暫定
  1,
  1,
  'full',
  '{
    "id": "SHORYOKUKA-IPPAN-05",
    "title": "中小企業省力化投資補助金（一般型）第5回公募",
    "official_name": "中小企業省力化投資補助事業（一般型）",
    "round": "第5回公募",
    "description": "人手不足解消のため、オーダーメイド設備の導入による業務効率化・省力化や、生産プロセスの自動化・無人化・省力化に取り組む事業者を支援します。IoT、ロボット等のデジタル技術を活用した設備投資を補助します。",
    
    "subsidy_amount": {
      "description": "従業員数により補助上限額が変動",
      "tiers": [
        {"employees": "5人以下", "normal": 7500000, "special": 10000000},
        {"employees": "6〜20人", "normal": 15000000, "special": 20000000},
        {"employees": "21〜50人", "normal": 30000000, "special": 40000000},
        {"employees": "51〜100人", "normal": 50000000, "special": 65000000},
        {"employees": "101人以上", "normal": 80000000, "special": 100000000}
      ],
      "special_condition": "大幅賃上げ特例（事業場内最低賃金を+50円以上引き上げ）適用時",
      "minimum_investment": 500000,
      "minimum_investment_note": "単価50万円（税抜）以上の機械装置・システム構築費が必須"
    },
    
    "subsidy_rate": {
      "categories": [
        {"type": "中小企業", "rate": "1/2", "special_rate": "2/3", "special_condition": "最低賃金引き上げ特例適用時"},
        {"type": "小規模企業者・小規模事業者", "rate": "2/3"},
        {"type": "再生事業者", "rate": "2/3"}
      ]
    },
    
    "target_area_search": "全国",
    "target_industry": "全業種（中小企業基本法第2条第1項に規定する中小企業者）",
    "target_number_of_employees": "従業員1名以上の中小企業・小規模事業者",
    
    "eligibility_requirements": {
      "basic": [
        "日本国内に法人登記があり、国内で事業を営む中小企業等",
        "日本国内に本社及び補助事業の実施場所を有すること",
        "従業員が1名以上いること（0名は申請不可）"
      ],
      "mandatory_commitments": [
        {
          "item": "労働生産性向上",
          "requirement": "事業計画期間（3〜5年）で年平均成長率+4.0%以上向上",
          "verification": "付加価値額（営業利益+人件費+減価償却費）÷労働投入量で計算"
        },
        {
          "item": "賃上げ",
          "requirement": "1人当たり給与支給総額を年平均成長率+3.5%以上増加",
          "verification": "給与支給総額÷従業員数で計算、従業員への表明が必要"
        },
        {
          "item": "最低賃金",
          "requirement": "事業場内最低賃金を都道府県別最低賃金+30円以上に設定",
          "verification": "毎年の水準維持が必要"
        }
      ],
      "exclusions": [
        "過去に本事業で2回以上補助金を受給した事業者",
        "過去に補助金の不正受給を行った事業者",
        "暴力団関係者",
        "風俗営業等の事業者"
      ]
    },
    
    "eligible_expenses": {
      "required": {
        "name": "機械装置・システム構築費",
        "description": "専ら補助事業に使用される機械・装置、専用ソフトウェア、情報システムの購入・構築・改良・据付け",
        "requirement": "単価50万円（税抜）以上の設備投資が1つ以上必要",
        "examples": ["産業用ロボット", "自動搬送装置", "IoTシステム", "生産管理システム", "自動検査装置"]
      },
      "optional": [
        {"name": "運搬費", "description": "運搬料、宅配・郵送料等", "limit": null},
        {"name": "技術導入費", "description": "知的財産権等の導入費用", "limit": "補助対象経費総額の1/3"},
        {"name": "知的財産権等関連経費", "description": "特許権等の取得に係る弁理士手続代行費用", "limit": "補助対象経費総額の1/3"},
        {"name": "外注費", "description": "専用設備の設計等の一部を外注する場合の経費", "limit": "補助対象経費総額の1/2"},
        {"name": "専門家経費", "description": "学識経験者や専門家へのコンサルティング費用・旅費", "limit": "1日上限5万円、補助対象経費総額の1/2"},
        {"name": "クラウドサービス利用費", "description": "サーバー領域の借入やサービス利用料、ルータ使用料・通信料等", "limit": null}
      ],
      "not_eligible": [
        "土地・建物の取得費",
        "車両購入費（特殊車両を除く）",
        "汎用性のある備品（パソコン、タブレット等）",
        "消耗品費",
        "光熱水費",
        "通信費（クラウド利用に付帯するもの以外）",
        "租税公課",
        "保険料"
      ]
    },
    
    "required_documents": {
      "common": [
        {"name": "損益計算書", "period": "直近2期分"},
        {"name": "貸借対照表", "period": "直近2期分"},
        {"name": "事業計画書（その1）", "description": "会社概要、事業内容"},
        {"name": "事業計画書（その2）", "description": "省力化計画、設備導入計画"},
        {"name": "事業計画書（その3）", "description": "経費明細、スケジュール"},
        {"name": "1人当たり給与支給総額の確認書", "description": "賃上げ計画の表明"}
      ],
      "corporation": [
        {"name": "履歴事項全部証明書", "requirement": "発行から3か月以内"},
        {"name": "納税証明書（その2）", "period": "直近3期分"},
        {"name": "法人事業概況説明書", "period": "直近1期分"},
        {"name": "役員名簿", "description": "役員全員の氏名・住所"},
        {"name": "株主・出資者名簿", "description": "出資比率を含む"}
      ],
      "individual": [
        {"name": "確定申告書の控え（第一表）", "period": "直近1年分"},
        {"name": "納税証明書（その2）", "period": "直近1年分"},
        {"name": "所得税青色申告決算書または収支内訳書", "period": "直近1年分"}
      ],
      "optional": [
        {"name": "事業実施場所リスト", "condition": "複数拠点の場合"},
        {"name": "金融機関確認書", "condition": "融資を受ける場合"},
        {"name": "再生事業者の確認書類", "condition": "再生事業者の場合"},
        {"name": "研修動画の修了証", "condition": "採択後に必要"}
      ]
    },
    
    "evaluation_criteria": {
      "technical": [
        {"item": "省力化指数", "description": "導入設備による省力化効果の妥当性"},
        {"item": "投資回収期間", "description": "投資回収期間の短さ"},
        {"item": "付加価値額", "description": "付加価値額の成長性"},
        {"item": "オーダーメイド設備", "description": "自社に最適化された設備導入計画"}
      ],
      "planning": [
        {"item": "実施体制", "description": "事業遂行能力、組織体制の適切さ"},
        {"item": "財務状況", "description": "財務の健全性、資金調達計画"},
        {"item": "サイバーセキュリティ対策", "description": "情報セキュリティへの取組"},
        {"item": "スケジュール", "description": "実施計画の妥当性"},
        {"item": "賃上げ目標", "description": "賃上げ計画の実現可能性"}
      ],
      "policy": [
        {"item": "地域経済への貢献", "description": "地域産業への波及効果"},
        {"item": "イノベーション牽引", "description": "新技術・新サービスの創出"},
        {"item": "関税影響への対策", "description": "輸出入への影響対策（該当者のみ）"}
      ]
    },
    
    "bonus_points": [
      {"name": "事業承継・M&A加点", "description": "過去3年以内に事業承継またはM&Aを実施"},
      {"name": "事業継続力強化計画加点", "description": "BCP認定を取得済み"},
      {"name": "成長加速マッチングサービス加点", "description": "会員登録・課題登録済み"},
      {"name": "地域別最低賃金引き上げ加点", "description": "対象従業員が30%以上"},
      {"name": "事業場内最低賃金引き上げ加点", "description": "全国目安（63円）以上引き上げ"},
      {"name": "えるぼし認定加点", "description": "女性活躍推進の認定取得"},
      {"name": "くるみん認定加点", "description": "子育てサポート企業の認定取得"}
    ],
    
    "application_method": {
      "type": "電子申請のみ",
      "system": "jGrants（補助金申請システム）",
      "account_required": "GビズIDプライムアカウント",
      "account_note": "取得には一定期間を要するため早めの準備が必要",
      "file_format": "PDF形式（パスワード設定不可）"
    },
    
    "schedule": {
      "application_start": "未定（HP公開予定）",
      "application_end": "未定（HP公開予定）",
      "result_announcement": "申請締切から約2か月後",
      "project_period": "交付決定日から12か月以内"
    },
    
    "contact": {
      "name": "中小企業省力化投資補助金事務局 コールセンター",
      "phone": "0570-099-660（ナビダイヤル）",
      "phone_ip": "03-4335-7595（IP電話）",
      "hours": "9:30〜17:30（土日祝除く）"
    },
    
    "official_urls": {
      "main": "https://shoryokuka.smrj.go.jp/ippan/",
      "download": "https://shoryokuka.smrj.go.jp/ippan/download/",
      "faq": "https://shoryokuka.smrj.go.jp/ippan/faq/"
    },
    
    "wall_chat_questions": [
      {"category": "基本情報", "question": "従業員数は何名ですか？", "purpose": "補助上限額の決定"},
      {"category": "基本情報", "question": "業種は何ですか？中小企業基本法の定義に該当しますか？", "purpose": "申請資格の確認"},
      {"category": "賃上げ要件", "question": "現在の従業員1人当たりの平均給与はいくらですか？", "purpose": "賃上げ+3.5%の計算"},
      {"category": "賃上げ要件", "question": "事業場内の最低賃金はいくらですか？都道府県の最低賃金+30円以上ですか？", "purpose": "最低賃金要件の確認"},
      {"category": "設備投資", "question": "導入予定の設備・システムは何ですか？", "purpose": "対象経費の確認"},
      {"category": "設備投資", "question": "設備投資の総額はいくらですか？単価50万円以上の設備がありますか？", "purpose": "補助下限の確認"},
      {"category": "省力化効果", "question": "設備導入により、どのような業務が省力化されますか？", "purpose": "省力化指数の算定"},
      {"category": "省力化効果", "question": "現在、その業務に何人・何時間かかっていますか？", "purpose": "省力化効果の定量化"},
      {"category": "財務状況", "question": "直近2期分の決算書はありますか？", "purpose": "必要書類の確認"},
      {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況の確認"},
      {"category": "加点項目", "question": "事業承継やM&Aの実施予定・実績はありますか？", "purpose": "加点項目の確認"},
      {"category": "加点項目", "question": "えるぼし認定やくるみん認定を取得していますか？", "purpose": "加点項目の確認"}
    ],
    
    "required_forms": [
      {
        "form_id": "事業計画書その1",
        "name": "事業計画書（その1）",
        "fields": ["会社概要", "事業内容", "組織体制", "財務状況"],
        "notes": "A4で5ページ以内推奨"
      },
      {
        "form_id": "事業計画書その2",
        "name": "事業計画書（その2）",
        "fields": ["省力化の目的", "導入設備の概要", "省力化効果", "労働生産性向上計画", "賃上げ計画"],
        "notes": "具体的な数値目標を記載"
      },
      {
        "form_id": "事業計画書その3",
        "name": "事業計画書（その3）",
        "fields": ["経費明細", "見積書の内訳", "実施スケジュール"],
        "notes": "見積書は2社以上から取得推奨"
      }
    ],
    
    "enriched_version": "v2_koubo_based",
    "koubo_source": "application_guidelines_ippan_05.pdf",
    "last_updated": "2026-02-03"
  }',
  datetime('now'),
  datetime('now', '+1 year')
);

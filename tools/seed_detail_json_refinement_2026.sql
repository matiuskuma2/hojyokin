-- =====================================================================
-- detail_json精緻化 v4.12.0
-- PDF公募要領 + 公式サイト最新情報に基づく完全版detail_json更新
-- 対象: 4大補助金（成長加速化・新事業進出・ものづくり23次・事業承継M&A14次）
-- 作成日: 2026-02-08
-- =====================================================================

-- =====================================================================
-- 1. 成長加速化補助金 2次公募 (SEICHOU-KASOKU-02)
-- ソース: 2nd_kobo_update.pdf, 2nd_gaiyo.pdf, yoshiki_20260130.pdf
--         https://growth-100-oku.smrj.go.jp/
-- =====================================================================
UPDATE subsidy_cache SET
  detail_json = json('{
  "id": "SEICHOU-KASOKU-02",
  "title": "中小企業成長加速化補助金（2次公募）",
  "official_name": "中小企業成長加速化補助金",
  "round": "2次公募",
  "description": "売上高100億円超を目指す中小企業の大胆な投資を支援。賃上げへの貢献、輸出による外需獲得、域内の仕入による地域経済への波及効果が大きい企業が対象。100億宣言を公表し、1億円以上の大規模投資を行う企業に最大5億円を補助。",
  "subsidy_amount": {
    "description": "補助上限額5億円、補助率1/2",
    "max_amount": 500000000,
    "rate": "1/2",
    "minimum_investment": 100000000,
    "minimum_investment_note": "投資額1億円以上（専門家経費・外注費を除く補助対象経費の合計）",
    "reference_note": "中堅等大規模成長投資補助金（100億宣言枠）は上限50億円・補助率1/3"
  },
  "subsidy_rate": {
    "categories": [
      {"type": "中小企業", "rate": "1/2"}
    ]
  },
  "target_area_search": "全国",
  "target_industry": "全業種（中小企業基本法に基づく中小企業者、一部業種を除く）",
  "target_number_of_employees": "常時使用する従業員数が2,000人以下の中小企業",
  "eligibility_requirements": {
    "basic": [
      "売上高100億円を目指す中小企業であること（売上高10億円以上100億円未満）",
      "100億宣言をポータルサイトで公表済みであること（公表手続きに通常2〜3週間要する）",
      "投資額が1億円以上であること（専門家経費・外注費を除く補助対象経費合計）",
      "日本国内に本社及び補助事業の実施場所を有すること",
      "常時使用する従業員が2,000人以下であること"
    ],
    "mandatory_commitments": [
      {"item": "賃上げ要件", "requirement": "従業員1人当たり給与支給総額の年平均上昇率4.5%以上（直近5年間の全国最低賃金年平均上昇率基準）", "verification": "交付決定までに従業員に表明必須。目標は「給与総額」or「1人当たり給与総額」を選択（変更不可）"},
      {"item": "100億宣言", "requirement": "5項目（企業概要、目標と課題、具体的措置、実施体制、経営者コミットメント）を含む宣言を公表", "verification": "申請時にポータルサイトに公表済みであること"},
      {"item": "大規模投資", "requirement": "1億円以上の設備投資計画", "verification": "建物費・機械装置費・ソフトウェア費の合計（各単価100万円以上）"}
    ],
    "exclusions": [
      "みなし大企業（株式の過半数を大企業が所有等）",
      "暴力団関係者",
      "直近3年間の不正実績がある事業者",
      "課税所得の年平均額が一定基準を超える事業者"
    ],
    "changes_from_1st": [
      "対象者要件: 交付決定日基準→公募申請日以降に変更",
      "審査基準: 波及効果に賃上げ計画の定性的指標を追加",
      "金融機関名の開示が結果公表項目に追加",
      "賃上げ要件: 最低賃金算定期間を2019-2023→2020-2024年度に更新",
      "プレゼン審査: 外部顧問等の同席禁止（発覚時は不採択・取消）"
    ]
  },
  "eligible_expenses": {
    "categories": [
      {"name": "建物費", "description": "事務所、生産施設、倉庫等の建設・改修", "requirement": "単価100万円（税抜）以上"},
      {"name": "機械装置費", "description": "機械装置、工具・器具の購入・借用・据付", "requirement": "単価100万円（税抜）以上"},
      {"name": "ソフトウェア費", "description": "専用ソフトウェア、情報システム、クラウドサービス利用料", "requirement": "単価100万円（税抜）以上"},
      {"name": "外注費", "description": "加工、設計、検査等の一部外注", "requirement": "上記3費用の合計未満"},
      {"name": "専門家経費", "description": "技術指導、助言、コンサルティング業務、旅費", "requirement": "上記3費用の合計未満"}
    ],
    "not_eligible": [
      "土地代・土地の造成費用",
      "老朽化設備の単なる入れ替え（省力化・能力向上を伴わないもの）",
      "公道走行車両",
      "汎用PC・タブレット",
      "販売用のソフトウェア",
      "消耗品、光熱水費、通信費、租税公課、保険料"
    ]
  },
  "required_documents": {
    "common": [
      {"name": "投資計画書（様式1）", "description": "事業計画書の本体。40ページ以内", "format": "Word/PDF"},
      {"name": "投資計画書別紙（様式2）", "description": "財務データ、投資内訳等", "format": "Excel(.xlsm)"},
      {"name": "ローカルベンチマーク（様式3）", "description": "財務状況の分析データ", "format": "Excel(.xlsm)"},
      {"name": "100億宣言の公表証明", "description": "ポータルサイトでの公表済みを証明"},
      {"name": "金融機関の確認書", "description": "メインバンク等の支援意向"},
      {"name": "賃上げ目標表明書", "description": "年平均4.5%以上の賃上げ計画"}
    ],
    "corporation": [
      {"name": "決算書", "period": "直近2期分"},
      {"name": "法人税確定申告書", "period": "直近2期分"},
      {"name": "登記簿謄本（履歴事項全部証明書）", "requirement": "発行から3か月以内"}
    ],
    "optional": [
      {"name": "リース取引に係る宣誓書（様式5）", "condition": "リースを利用する場合"},
      {"name": "コンソーシアム関連書類", "condition": "コンソーシアム申請の場合"}
    ]
  },
  "evaluation_criteria": {
    "main_axes": [
      {"item": "経営力", "description": "中長期ビジョン、売上高成長率、付加価値増加率、投資比率、賃上げ計画の妥当性、内外環境分析、差別化戦略、管理体制"},
      {"item": "波及効果", "description": "域内仕入拡大、サプライチェーンへの影響、イノベーション創出、地域資源活用（2次公募で賃上げ計画の定性的指標を追加）"},
      {"item": "実現可能性", "description": "経営体制、早期投資の実行性、財務状況（ローカルベンチマーク）、金融機関の支援姿勢"}
    ],
    "reference_factors": [
      "地域未来牽引企業",
      "健康経営優良法人",
      "パートナーシップ構築宣言",
      "事業継続力強化計画",
      "えるぼし・くるみん認定"
    ]
  },
  "bonus_points": [
    {"name": "地域未来牽引企業", "description": "経済産業省認定の地域未来牽引企業"},
    {"name": "健康経営優良法人", "description": "経済産業省認定の健康経営優良法人"},
    {"name": "パートナーシップ構築宣言", "description": "取引先との適切な関係構築の宣言"},
    {"name": "えるぼし・くるみん認定", "description": "女性活躍推進・子育てサポート企業の認定"}
  ],
  "application_method": {
    "type": "電子申請のみ",
    "system": "jGrants（補助金申請システム）",
    "account_required": "GビズIDプライムアカウント",
    "account_note": "取得には2〜3週間を要するため早めの準備が必要"
  },
  "schedule": {
    "kobo_start": "2025年12月26日",
    "application_start": "2026年2月24日（火）13:00",
    "application_end": "2026年3月26日（木）15:00（厳守）",
    "first_review": "2026年5月下旬（書面審査結果公表）",
    "presentation": "2026年6月22日（月）～7月10日（金）",
    "result_announcement": "2026年7月下旬以降",
    "project_period": "交付決定日から24か月",
    "reporting_obligation": "採択後5年間の報告義務"
  },
  "contact": {
    "name": "中小企業成長加速化補助金事務局",
    "url": "https://growth-100-oku.smrj.go.jp/"
  },
  "official_urls": {
    "main": "https://growth-100-oku.smrj.go.jp/",
    "kobo_pdf": "https://growth-100-oku.smrj.go.jp/documents/subsidy/2nd_kobo.pdf",
    "yoshiki": "https://growth-100-oku.smrj.go.jp/documents/subsidy/yoshiki_20260130.zip",
    "faq": "https://growth-100-oku.smrj.go.jp/documents/subsidy/2nd_faq.pdf",
    "briefing_video": "https://www.youtube.com/watch?v=-jzH_3DireU"
  },
  "disqualification_cases": [
    "100億宣言が申請時にポータルサイトで未公表",
    "投資額が1億円未満",
    "交付決定までに賃上げ目標を従業員に表明しなかった場合",
    "補助ありきの姿勢、現実性の乏しい経営シナリオ",
    "低投資比率の事業計画",
    "国内市場のみの成長見通し（外需獲得の見込みなし）",
    "解像度不足の事業計画",
    "プレゼン審査に代表権を持つ経営者が不参加",
    "プレゼン審査に外部顧問等が同席（発覚時は不採択・取消）",
    "虚偽申請、不正受給",
    "賃上げ目標未達の場合は返還義務（天災等による免除規定あり）"
  ],
  "wall_chat_questions": [
    {"category": "基本情報", "question": "御社の直近の売上高はいくらですか？（10億円以上100億円未満が対象です）", "purpose": "申請資格の確認"},
    {"category": "基本情報", "question": "常時使用する従業員数は何名ですか？", "purpose": "中小企業要件の確認"},
    {"category": "100億宣言", "question": "100億宣言は既にポータルサイトで公表済みですか？（手続きに2〜3週間かかります）", "purpose": "必須要件の確認"},
    {"category": "投資計画", "question": "どのような設備投資を計画していますか？（建物、機械装置、ソフトウェア等）", "purpose": "補助対象経費の確認"},
    {"category": "投資計画", "question": "投資総額はいくらですか？（1億円以上が必須。各経費は単価100万円以上）", "purpose": "最低投資要件の確認"},
    {"category": "賃上げ", "question": "現在の従業員1人当たり平均給与はいくらですか？年4.5%以上の引き上げは可能ですか？", "purpose": "賃上げ要件の確認"},
    {"category": "成長戦略", "question": "売上高100億円実現に向けた中長期ビジョン（5年程度）を教えてください", "purpose": "審査項目: 経営力"},
    {"category": "波及効果", "question": "この投資により、域内の仕入拡大や地域経済への波及効果はありますか？", "purpose": "審査項目: 波及効果"},
    {"category": "波及効果", "question": "輸出による外需獲得の見込みはありますか？", "purpose": "審査項目: 波及効果"},
    {"category": "財務", "question": "メインバンクからの支援（確認書の取得）は可能ですか？", "purpose": "実現可能性の確認"},
    {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況の確認"},
    {"category": "加点", "question": "地域未来牽引企業、健康経営優良法人、パートナーシップ構築宣言等の認定はありますか？", "purpose": "加点項目の確認"}
  ]
}'),
  wall_chat_ready = 1,
  wall_chat_mode = 'full',
  detail_score = 95,
  acceptance_end_datetime = '2026-03-26T15:00:00Z'
WHERE id = 'SEICHOU-KASOKU-02';


-- =====================================================================
-- 2. 新事業進出補助金 第3回 (SHINJIGYO-03)
-- ソース: shinjigyou_koubo_3.pdf
--         https://shinjigyou-shinshutsu.smrj.go.jp/
-- =====================================================================
UPDATE subsidy_cache SET
  detail_json = json('{
  "id": "SHINJIGYO-03",
  "title": "中小企業新事業進出補助金（第3回公募）",
  "official_name": "中小企業新事業進出促進補助金",
  "round": "第3回公募",
  "description": "中小企業者等が新たな事業への進出に向けた設備投資等を支援する補助金。新市場への進出や新製品・新サービスの開発を後押しし、事業の多角化・転換を図る事業者を支援します。",
  "subsidy_amount": {
    "description": "従業員数に応じた補助上限額。賃上げ特例適用で上限引き上げ",
    "tiers": [
      {"employees": "20人以下", "normal": 25000000, "special": 30000000},
      {"employees": "21〜50人", "normal": 40000000, "special": 50000000},
      {"employees": "51〜100人", "normal": 55000000, "special": 70000000},
      {"employees": "101人以上", "normal": 70000000, "special": 90000000}
    ],
    "special_condition": "賃上げ特例（給与総額年平均6.0%以上、事業場内最低賃金+50円以上）適用時",
    "minimum_investment": null,
    "minimum_investment_note": "補助対象経費の下限は各公募要領を参照"
  },
  "subsidy_rate": {
    "categories": [
      {"type": "全対象者", "rate": "1/2"},
      {"type": "賃上げ特例適用時の上乗せ分", "rate": "1/3"}
    ]
  },
  "target_area_search": "全国",
  "target_industry": "全業種（中小企業者、「中小企業等経営強化法」第2条第1項に該当）",
  "target_number_of_employees": "従業員1名以上の中小企業・小規模事業者",
  "eligibility_requirements": {
    "basic": [
      "日本国内に法人登記・本社及び補助事業実施場所を有すること",
      "中小企業者であること（資本金・従業員数基準）",
      "新たな事業への進出に取り組むこと（新製品・新サービス・新市場）",
      "事業計画書に基づく取組を実施すること",
      "従業員が1名以上いること（0名は申請不可）"
    ],
    "mandatory_commitments": [
      {"item": "付加価値額増加", "requirement": "事業計画期間で年平均成長率+3.0%以上"},
      {"item": "賃上げ", "requirement": "1人当たり給与支給総額を年平均+3.5%以上"},
      {"item": "最低賃金", "requirement": "事業場内最低賃金を都道府県別最低賃金+30円以上"}
    ],
    "exclusions": [
      "みなし大企業",
      "過去に本事業で不正受給を行った事業者",
      "暴力団関係者",
      "外注に大部分を依存する事業",
      "二重受給（同一経費で他補助金と重複）",
      "従業員0名の事業者"
    ]
  },
  "eligible_expenses": {
    "categories": [
      {"name": "機械装置・システム構築費", "description": "専ら補助事業に使用される設備の購入・構築・改良・据付", "requirement": "必須経費"},
      {"name": "建物費", "description": "事務所・生産施設の建設・改修", "requirement": "任意"},
      {"name": "運搬費", "description": "運搬料、宅配・郵送料等", "limit": null},
      {"name": "技術導入費", "description": "知的財産権等の導入費用", "limit": null},
      {"name": "知的財産権等関連経費", "description": "特許権等の取得に係る費用", "limit": null},
      {"name": "外注費", "description": "加工・設計・検査等の外注", "limit": "補助金額の10%"},
      {"name": "専門家経費", "description": "コンサルティング費用", "limit": "上限100万円"},
      {"name": "クラウドサービス利用費", "description": "サーバー・SaaS利用料", "limit": null},
      {"name": "広告宣伝・販売促進費", "description": "新事業の販路開拓", "limit": "事業計画期間の総売上見込み÷年数×5%"}
    ],
    "not_eligible": [
      "土地・建物の取得費",
      "車両購入費",
      "汎用性のある備品（PC、タブレット等）",
      "消耗品費",
      "光熱水費、通信費、租税公課、保険料"
    ]
  },
  "required_documents": {
    "common": [
      {"name": "事業計画書", "description": "10項目を具体・定量的に記載"},
      {"name": "決算書", "period": "直近2期分"},
      {"name": "従業員数を示す書類", "description": "社会保険加入者名簿等"},
      {"name": "確定申告書控え", "period": "直近1〜2期分"},
      {"name": "賃上げ計画表明書", "description": "年平均3.5%以上"}
    ],
    "optional": [
      {"name": "認定経営革新計画書", "condition": "加点を希望する場合"},
      {"name": "金融機関確認書", "condition": "融資を受ける場合"},
      {"name": "連携事業者との協定書", "condition": "連携型申請の場合"}
    ]
  },
  "evaluation_criteria": {
    "main": [
      {"item": "新事業の革新性", "description": "新製品・サービスの独自性、市場性"},
      {"item": "事業の実現可能性", "description": "実施体制、資金計画、スケジュール"},
      {"item": "収益性・成長性", "description": "付加価値額の増加見通し"},
      {"item": "地域経済への貢献", "description": "雇用創出、サプライチェーンへの波及"}
    ],
    "bonus_items": [
      "経営革新計画の承認",
      "事業継続力強化計画の認定",
      "賃上げ特例の適用",
      "くるみん・えるぼし認定",
      "パートナーシップ構築宣言"
    ]
  },
  "application_method": {
    "type": "電子申請のみ",
    "system": "jGrants",
    "account_required": "GビズIDプライムアカウント"
  },
  "schedule": {
    "kobo_start": "2025年12月23日（火）",
    "application_start": "2026年2月17日（火）",
    "application_end": "2026年3月26日（木）18:00まで",
    "result_announcement": "2026年5月頃（予定）",
    "project_period": "交付決定日から14か月（採択発表日から16か月）",
    "note": "第4回公募は3月末開始予定"
  },
  "contact": {
    "name": "中小企業新事業進出補助金事務局",
    "url": "https://shinjigyou-shinshutsu.smrj.go.jp/"
  },
  "official_urls": {
    "main": "https://shinjigyou-shinshutsu.smrj.go.jp/",
    "download": "https://shinjigyou-shinshutsu.smrj.go.jp/download",
    "results": "https://shinjigyou-shinshutsu.smrj.go.jp/results"
  },
  "disqualification_cases": [
    "外注に大部分を依存する事業",
    "二重受給（同一経費で他の補助金と重複）",
    "虚偽申請",
    "従業員0名の事業者",
    "事業の実施主体が申請者本人でない場合"
  ],
  "wall_chat_questions": [
    {"category": "基本情報", "question": "従業員数は何名ですか？（補助上限額が変わります）", "purpose": "補助上限額の確認"},
    {"category": "基本情報", "question": "御社の業種と資本金額を教えてください", "purpose": "中小企業要件の確認"},
    {"category": "新事業", "question": "どのような新事業への進出を計画していますか？（新製品・新サービス・新市場）", "purpose": "対象事業の確認"},
    {"category": "新事業", "question": "現在の主力事業と、新事業との違い・関連性を教えてください", "purpose": "新規性の確認"},
    {"category": "設備投資", "question": "導入予定の設備・システムは何ですか？投資総額はいくらですか？", "purpose": "補助対象経費の確認"},
    {"category": "賃上げ", "question": "現在の1人当たり平均給与はいくらですか？年3.5%以上の引き上げは可能ですか？", "purpose": "賃上げ要件の確認"},
    {"category": "賃上げ", "question": "賃上げ特例（年6.0%以上、最低賃金+50円以上）の適用を検討していますか？", "purpose": "上限引き上げの確認"},
    {"category": "事業計画", "question": "事業計画期間（3〜5年）の売上・利益見通しを教えてください", "purpose": "収益性の確認"},
    {"category": "財務", "question": "直近2期分の決算書はありますか？", "purpose": "必要書類の確認"},
    {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況の確認"},
    {"category": "加点", "question": "経営革新計画の承認や事業継続力強化計画の認定を受けていますか？", "purpose": "加点項目の確認"}
  ]
}'),
  wall_chat_ready = 1,
  wall_chat_mode = 'full',
  detail_score = 95,
  acceptance_end_datetime = '2026-03-26T18:00:00Z'
WHERE id = 'SHINJIGYO-03';


-- =====================================================================
-- 3. ものづくり補助金 第23次 (MONODUKURI-23)
-- ソース: 公募要領_23次締切_20260206.pdf (kobo_23ji_20260206.pdf)
--         https://portal.monodukuri-hojo.jp/about.html
-- =====================================================================
UPDATE subsidy_cache SET
  detail_json = json('{
  "id": "MONODUKURI-23",
  "title": "ものづくり・商業・サービス生産性向上促進補助金（第23次公募）",
  "official_name": "ものづくり・商業・サービス生産性向上促進補助金",
  "round": "第23次公募",
  "description": "中小企業・小規模事業者等が取り組む、革新的な製品・サービスの開発、生産プロセス等の省力化を行い、生産性向上を図るための設備投資等を支援します。製品・サービス高付加価値化枠とグローバル枠の2枠で募集。",
  "subsidy_amount": {
    "description": "従業員数に応じた補助上限額。大幅賃上げ特例で追加上乗せあり",
    "frames": [
      {
        "name": "製品・サービス高付加価値化枠",
        "tiers": [
          {"employees": "5人以下", "normal": 7500000, "wage_special": 8500000},
          {"employees": "6〜20人", "normal": 10000000, "wage_special": 12500000},
          {"employees": "21〜50人", "normal": 15000000, "wage_special": 25000000},
          {"employees": "51人以上", "normal": 25000000, "wage_special": 35000000}
        ]
      },
      {
        "name": "グローバル枠",
        "tiers": [
          {"employees": "全従業員規模", "normal": 30000000, "wage_special": 40000000}
        ]
      }
    ],
    "wage_special_note": "大幅賃上げ特例: 事業場内最低賃金+50円以上＆給与総額年平均6.0%以上",
    "minimum_wage_special": "最低賃金引上げ特例: 補助率を2/3に引き上げ"
  },
  "subsidy_rate": {
    "categories": [
      {"type": "中小企業者", "rate": "1/2"},
      {"type": "小規模企業者・小規模事業者", "rate": "2/3"},
      {"type": "再生事業者", "rate": "2/3"},
      {"type": "最低賃金引上げ特例適用", "rate": "2/3（中小企業も含む）"}
    ]
  },
  "target_area_search": "全国",
  "target_industry": "全業種（中小企業基本法第2条第1項に規定する中小企業者等）",
  "target_number_of_employees": "従業員1名以上の中小企業・小規模事業者",
  "eligibility_requirements": {
    "basic": [
      "日本国内に法人登記があり、国内で事業を営む中小企業者等",
      "日本国内に本社及び補助事業の実施場所を有すること",
      "従業員が1名以上いること",
      "付加価値額の年平均成長率+3.0%以上の事業計画を策定",
      "1人当たり給与支給総額を年平均+3.5%以上増加",
      "事業場内最低賃金を都道府県別最低賃金+30円以上に設定"
    ],
    "new_requirement_23rd": "従業員の仕事・子育て両立要件：一般事業主行動計画を策定し「両立支援のひろば」で公表（公表審査に2週間以上余裕を持つこと）",
    "exclusions": [
      "みなし大企業",
      "過去3年以内の補助金不正受給者",
      "暴力団関係者",
      "風俗営業等の事業者",
      "GビズIDの他者貸与",
      "口頭審査を欠席した者"
    ]
  },
  "eligible_expenses": {
    "required": {
      "name": "機械装置・システム構築費",
      "description": "専ら補助事業に使用される機械・装置、専用ソフトウェア・情報システムの購入・構築",
      "requirement": "単価50万円（税抜）以上の設備投資が1つ以上必須"
    },
    "optional": [
      {"name": "運搬費", "limit": null},
      {"name": "技術導入費", "limit": "補助対象経費総額の1/3"},
      {"name": "知的財産権等関連経費", "limit": "補助対象経費総額の1/3"},
      {"name": "外注費", "limit": "補助対象経費総額の1/2"},
      {"name": "専門家経費", "limit": "1日上限5万円、補助対象経費総額の1/2"},
      {"name": "クラウドサービス利用費", "limit": null},
      {"name": "原材料費", "limit": null},
      {"name": "広告宣伝・販売促進費", "limit": "グローバル枠のみ。総額の1/2"},
      {"name": "海外旅費", "limit": "グローバル枠のみ"}
    ],
    "not_eligible": [
      "土地・建物の取得費",
      "車両購入費（特殊車両を除く）",
      "汎用性のある備品（PC、タブレット等）",
      "消耗品費",
      "光熱水費、通信費、租税公課、保険料"
    ]
  },
  "required_documents": {
    "common": [
      {"name": "事業計画書（補足PDF）", "description": "A4で10ページ以内推奨"},
      {"name": "損益計算書・貸借対照表", "period": "直近2期分"},
      {"name": "従業員数確認資料", "description": "労働者名簿等"},
      {"name": "補助経費誓約書", "description": "電子申請システムで誓約"},
      {"name": "賃金引上げ計画誓約書", "description": "電子申請システムで誓約"},
      {"name": "一般事業主行動計画のURL", "description": "両立支援のひろば公表ページ"}
    ],
    "optional": [
      {"name": "大幅賃上げ計画書", "condition": "大幅賃上げ特例を希望する場合"},
      {"name": "最低賃金引上げ特例資料", "condition": "最低賃金特例を希望する場合"},
      {"name": "資金調達確認書", "condition": "金融機関から融資を受ける場合"},
      {"name": "再生事業者確認書", "condition": "再生事業者の場合"},
      {"name": "海外事業準備書類", "condition": "グローバル枠の場合"},
      {"name": "加点関係資料", "condition": "各種認定証の写し等"}
    ]
  },
  "evaluation_criteria": {
    "main": [
      {"item": "補助事業の適格性", "description": "公募要領の要件を満たしているか"},
      {"item": "経営力", "description": "経営理念、経営分析、市場分析の妥当性"},
      {"item": "事業性", "description": "革新的な製品・サービスの独自性、市場性"},
      {"item": "実現可能性", "description": "実施体制、資金計画、スケジュールの妥当性"},
      {"item": "政策適合", "description": "国の施策方針との整合性"},
      {"item": "大幅賃上げ計画の妥当性", "description": "大幅賃上げ特例を申請する場合"}
    ],
    "bonus_items": [
      "経営革新計画の承認",
      "DX認定取得",
      "事業継続力強化計画の認定",
      "最低賃金引上げ実績",
      "事業場内最低賃金引上げ実績",
      "えるぼし・くるみん認定",
      "パートナーシップ構築宣言"
    ]
  },
  "application_method": {
    "type": "電子申請のみ",
    "system": "jGrants",
    "account_required": "GビズIDプライムアカウント"
  },
  "schedule": {
    "kobo_start": "2026年2月6日（金）",
    "application_start": "2026年4月3日（金）17:00",
    "application_end": "2026年5月8日（金）17:00",
    "result_announcement": "2026年8月上旬頃",
    "project_period_kofuku": "交付決定日から10か月以内（製品・サービス高付加価値化枠）",
    "project_period_global": "交付決定日から12か月以内（グローバル枠）",
    "note_22nd": "22次締切の事業実施期間は短縮あり（実績報告2026/12/25まで）"
  },
  "contact": {
    "name": "ものづくり補助金事務局サポートセンター",
    "phone": "050-3821-7013",
    "hours": "10:00～17:00（土日祝除く）"
  },
  "official_urls": {
    "main": "https://portal.monodukuri-hojo.jp/",
    "about": "https://portal.monodukuri-hojo.jp/about.html",
    "kobo_pdf": "https://portal.monodukuri-hojo.jp/common/bunsho/ippan/23次締切_20260206.pdf"
  },
  "disqualification_cases": [
    "公序良俗違反・法令違反",
    "外注に過度に依存する事業",
    "実質的な労働を伴わない事業",
    "重複申請（同一内容で他の補助金と併願）",
    "虚偽記載",
    "GビズIDの他者への貸与",
    "口頭審査を欠席",
    "審査不備（書類不足）"
  ],
  "wall_chat_questions": [
    {"category": "基本情報", "question": "従業員数は何名ですか？（補助上限額が変わります）", "purpose": "補助上限額の決定"},
    {"category": "基本情報", "question": "御社は中小企業基本法の定義に該当しますか？（製造業なら資本金3億円以下or従業員300人以下等）", "purpose": "申請資格の確認"},
    {"category": "申請枠", "question": "製品・サービス高付加価値化枠とグローバル枠、どちらを検討していますか？", "purpose": "申請枠の確認"},
    {"category": "設備投資", "question": "導入予定の設備は何ですか？単価50万円（税抜）以上の設備がありますか？", "purpose": "必須経費の確認"},
    {"category": "設備投資", "question": "設備投資の総額はいくらですか？", "purpose": "補助金額の算定"},
    {"category": "革新性", "question": "導入する設備・サービスの革新的なポイントは何ですか？", "purpose": "審査項目: 事業性"},
    {"category": "賃上げ", "question": "現在の1人当たり給与支給総額はいくらですか？年3.5%以上の引き上げは可能ですか？", "purpose": "基本要件の確認"},
    {"category": "賃上げ", "question": "事業場内最低賃金はいくらですか？都道府県最低賃金+30円以上ですか？", "purpose": "最低賃金要件の確認"},
    {"category": "子育て要件", "question": "一般事業主行動計画を策定し「両立支援のひろば」で公表していますか？（23次から必須）", "purpose": "新要件の確認"},
    {"category": "財務", "question": "直近2期分の決算書（損益計算書・貸借対照表）はありますか？", "purpose": "必要書類の確認"},
    {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況"},
    {"category": "加点", "question": "DX認定、事業継続力強化計画、えるぼし・くるみん認定等はありますか？", "purpose": "加点項目の確認"}
  ]
}'),
  wall_chat_ready = 1,
  wall_chat_mode = 'full',
  detail_score = 95,
  acceptance_end_datetime = '2026-05-08T17:00:00Z'
WHERE id = 'MONODUKURI-23';


-- =====================================================================
-- 4. 事業承継・M&A補助金 14次公募 (JIGYOSHOKEI-MA-14)
-- ソース: requirements_succession_14.pdf, requirements_experts_14.pdf,
--         requirements_experts_10bn_14.pdf, requirements_challenge_14.pdf,
--         requirements_pmi_investment_14.pdf, requirements_pmi_experts_14.pdf
--         https://shoukei-mahojokin.go.jp/r7h/
-- =====================================================================
UPDATE subsidy_cache SET
  detail_json = json('{
  "id": "JIGYOSHOKEI-MA-14",
  "title": "事業承継・M&A補助金（14次公募）",
  "official_name": "中小企業生産性革命推進事業 事業承継・M&A補助金",
  "round": "14次公募",
  "description": "中小企業等が事業承継やM&Aに際して行う設備投資等や、経営資源の引継ぎ、経営統合（PMI）に係る経費の一部を補助。事業承継促進枠・専門家活用枠・廃業再チャレンジ枠・PMI推進枠の4枠で支援。",
  "subsidy_amount": {
    "description": "4つの申請枠により補助上限額・補助率が異なる",
    "frames": [
      {
        "name": "事業承継促進枠",
        "max_amount": 8000000,
        "max_amount_wage_special": 10000000,
        "min_amount": 1000000,
        "rate_small": "2/3以内",
        "rate_other": "1/2以内",
        "rate_wage_special_over": "1/2以内（上限800万円超～1,000万円部分）",
        "haigyo_add": 1500000,
        "note": "賃上げ特例適用で上限1,000万円。廃業費は最大+150万円"
      },
      {
        "name": "専門家活用枠（買い手支援Ⅰ型）",
        "max_amount": 6000000,
        "min_amount": 500000,
        "rate": "2/3以内",
        "dd_add": 2000000,
        "haigyo_add": 1500000,
        "note": "DD（デューデリジェンス）費用+200万円。廃業費+150万円"
      },
      {
        "name": "専門家活用枠（売り手支援Ⅱ型）",
        "max_amount": 6000000,
        "min_amount": 500000,
        "rate_normal": "1/2以内",
        "rate_special": "2/3以内（赤字または営業利益率低下の場合）",
        "haigyo_add": 1500000,
        "note": "業績状況により補助率が変動"
      },
      {
        "name": "専門家活用枠（100億チャレンジ型）",
        "max_amount": 6000000,
        "min_amount": 500000,
        "rate": "2/3以内",
        "dd_add": 2000000,
        "requirement": "100億宣言＋譲渡価額5億円以上＋従業員雇用3年間維持"
      },
      {
        "name": "廃業・再チャレンジ枠",
        "max_amount": 1500000,
        "note": "公募要領で別途定義"
      },
      {
        "name": "PMI推進枠（専門家活用類型）",
        "max_amount": 1500000,
        "min_amount": 500000,
        "rate": "1/2以内",
        "haigyo_add": 1500000,
        "note": "PMI専門家のコンサルティング費用"
      },
      {
        "name": "PMI推進枠（事業統合投資類型）",
        "max_amount": 8000000,
        "max_amount_wage_special": 10000000,
        "min_amount": 1000000,
        "rate_small": "2/3以内",
        "rate_other": "1/2以内",
        "haigyo_add": 1500000,
        "note": "M&A後の設備投資に対する補助"
      }
    ]
  },
  "target_area_search": "全国",
  "target_industry": "全業種（中小企業者・小規模事業者）",
  "target_number_of_employees": "中小企業基本法に基づく中小企業者",
  "eligibility_requirements": {
    "succession": [
      "事業承継（親族内承継・従業員承継・M&A）を実施済みまたは予定",
      "後継者の選定・承継期間が公募要件を満たすこと",
      "公募時点での在籍（該当者）"
    ],
    "experts": [
      "M&Aを実施予定であること",
      "M&A仲介・FA・DD等の専門家費用を支出予定",
      "100億チャレンジ型: 100億宣言の公表＋譲渡価額5億円以上＋従業員雇用3年間維持"
    ],
    "pmi": [
      "M&A後1年程度のPMI実施予定",
      "DDの実施実績",
      "専門家の資格要件（中小企業診断士等）",
      "地域経済の牽引性"
    ],
    "common_exclusions": [
      "みなし大企業",
      "暴力団関係者",
      "不正受給の実績がある事業者",
      "虚偽申請"
    ]
  },
  "required_documents": {
    "succession": [
      {"name": "事業承継計画書", "description": "承継計画の具体的内容"},
      {"name": "後継者の経歴書", "description": "後継者の資格・経験"},
      {"name": "決算書", "period": "直近2期分"},
      {"name": "登記簿謄本", "requirement": "発行から3か月以内"},
      {"name": "賃上げ計画書", "condition": "賃上げ特例希望時"}
    ],
    "experts": [
      {"name": "M&A計画書", "description": "M&Aの概要・目的・スキーム"},
      {"name": "専門家との契約書（写し）", "description": "仲介・FA・DD等"},
      {"name": "見積書", "description": "専門家費用の見積り"},
      {"name": "決算書", "period": "直近2期分"},
      {"name": "100億宣言の公表証明", "condition": "100億チャレンジ型のみ"}
    ],
    "pmi": [
      {"name": "PMI計画書", "description": "統合計画の具体的内容"},
      {"name": "M&A契約書（写し）", "description": "M&A完了の証明"},
      {"name": "DD報告書（写し）", "description": "DDの実施実績"},
      {"name": "専門家の資格証明", "description": "中小企業診断士等"},
      {"name": "決算書", "period": "直近2期分"}
    ]
  },
  "application_method": {
    "type": "電子申請のみ",
    "system": "jGrants",
    "account_required": "GビズIDプライムアカウント"
  },
  "schedule": {
    "application_start": "2026年2月27日（金）",
    "application_end": "2026年4月3日（金）17:00",
    "result_announcement": "2026年5月中旬（予定）",
    "grant_application": "2026年5月下旬～9月下旬（予定）",
    "grant_decision": "2026年6月上旬以降（予定）",
    "project_period": "交付決定日～2027年6月上旬（予定）",
    "actual_report": "2026年10月下旬～2027年6月中旬（予定）",
    "subsidy_payment": "2027年1月下旬以降（予定）"
  },
  "contact": {
    "succession": {"name": "事業承継促進枠", "phone": "050-3192-6274"},
    "experts": {"name": "専門家活用／廃業・再チャレンジ", "phone": "050-3145-3812"},
    "pmi": {"name": "PMI推進枠", "phone": "050-3192-6228"},
    "hours": "09:30～12:00、13:00～17:00（土日祝除く）"
  },
  "official_urls": {
    "main": "https://shoukei-mahojokin.go.jp/r7h/",
    "top": "https://shoukei-mahojokin.go.jp/",
    "meti": "https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260130001.html"
  },
  "disqualification_cases": [
    "虚偽の申請による不正受給",
    "補助金の目的外利用",
    "補助金受給額の不当な引き上げ・関係者への報酬配賦",
    "交付規程違反",
    "5年以下の懲役・100万円以下の罰金の可能性"
  ],
  "wall_chat_questions": [
    {"category": "基本情報", "question": "御社の業種・資本金・従業員数を教えてください", "purpose": "中小企業要件の確認"},
    {"category": "承継形態", "question": "事業承継・M&Aの形態を教えてください（親族内承継、従業員承継、第三者M&A、PMI）", "purpose": "申請枠の特定"},
    {"category": "承継形態", "question": "事業承継・M&Aの実施時期は？（実施済み or 予定、時期）", "purpose": "申請タイミングの確認"},
    {"category": "事業承継促進枠", "question": "後継者は決まっていますか？承継計画はありますか？", "purpose": "事業承継促進枠の該当確認"},
    {"category": "専門家活用枠", "question": "M&Aの仲介・FA・DD等の専門家費用はどのくらいですか？", "purpose": "専門家活用枠の補助額確認"},
    {"category": "専門家活用枠", "question": "100億宣言は公表済みですか？譲渡価額は5億円以上ですか？", "purpose": "100億チャレンジ型の確認"},
    {"category": "PMI推進枠", "question": "M&A完了後のPMI（経営統合）計画はありますか？", "purpose": "PMI推進枠の該当確認"},
    {"category": "PMI推進枠", "question": "DDは実施済みですか？PMI専門家は確保できていますか？", "purpose": "PMI要件の確認"},
    {"category": "設備投資", "question": "M&A後にどのような設備投資を計画していますか？", "purpose": "事業統合投資類型の確認"},
    {"category": "廃業", "question": "事業の一部廃業を伴う承継ですか？廃業費用はどのくらいですか？", "purpose": "廃業・再チャレンジ枠の確認"},
    {"category": "電子申請", "question": "GビズIDプライムアカウントは取得済みですか？", "purpose": "申請準備状況"},
    {"category": "賃上げ", "question": "賃上げ特例（事業承継促進枠・PMI事業統合投資類型）の適用を検討していますか？", "purpose": "上限引き上げの確認"}
  ]
}'),
  wall_chat_ready = 1,
  wall_chat_mode = 'full',
  detail_score = 95,
  acceptance_end_datetime = '2026-04-03T17:00:00Z'
WHERE id = 'JIGYOSHOKEI-MA-14';


-- =====================================================================
-- 5. スケジュール修正（公式サイト最新情報に基づく）
-- =====================================================================

-- 新事業進出: 公式サイトによると第3回応募締切は3/26 18:00
-- → 既に上で設定済み

-- 事業承継M&A 14次: 公式サイトによると2/27～4/3 17:00
-- → 既に上で設定済み

-- ものづくり 23次: 公式サイトによると電子申請4/3 17:00開始、締切5/8 17:00
-- → 既に上で設定済み

-- 成長加速化 2次: 公式サイトによると2/24 13:00～3/26 15:00
-- → 既に上で設定済み


-- =====================================================================
-- 6. 統合版（SHINJIGYO-MONO-2026）の更新
-- 最新の公式情報に基づき、統合後の補助金情報を更新
-- =====================================================================
UPDATE subsidy_cache SET
  detail_json = json('{
  "id": "SHINJIGYO-MONO-2026",
  "title": "新事業進出・ものづくり補助金（2026年度統合版）",
  "official_name": "新事業進出・ものづくり補助金",
  "round": "2026年度（統合後新制度）",
  "description": "2026年度以降、新事業進出補助金とものづくり補助金が統合されて「新事業進出・ものづくり補助金」として実施予定。第4回公募（新事業進出）終了後に新制度へ移行する見込み。統合後は革新的新製品・サービス枠、新事業進出枠、グローバル枠の3枠構成に。",
  "subsidy_amount": {
    "description": "統合後の3枠構成（予定）",
    "frames": [
      {
        "name": "革新的新製品・サービス枠",
        "tiers": [
          {"employees": "5人以下", "normal": 7500000},
          {"employees": "6〜20人", "normal": 10000000},
          {"employees": "21〜50人", "normal": 15000000},
          {"employees": "51人以上", "normal": 25000000}
        ],
        "rate": "1/2（賃金特例2/3）"
      },
      {
        "name": "新事業進出枠",
        "tiers": [
          {"employees": "20人以下", "normal": 25000000},
          {"employees": "21〜50人", "normal": 40000000},
          {"employees": "51〜100人", "normal": 55000000},
          {"employees": "101人以上", "normal": 70000000}
        ],
        "rate": "1/2（賃金特例2/3）"
      },
      {
        "name": "グローバル枠",
        "max_amount": 30000000,
        "rate": "2/3"
      }
    ]
  },
  "schedule": {
    "status": "公募開始時期は未公表",
    "note": "第4回公募（新事業進出）は3月末開始予定。統合は第4回終了後",
    "estimated_start": "2026年度後半"
  },
  "official_urls": {
    "meti_budget": "https://www.chusho.meti.go.jp/koukai/yosan/r8/shinjigy_mono.pdf",
    "monodukuri": "https://portal.monodukuri-hojo.jp/",
    "shinjigyo": "https://shinjigyou-shinshutsu.smrj.go.jp/"
  },
  "wall_chat_questions": [
    {"category": "統合版", "question": "統合後の「新事業進出・ものづくり補助金」は2026年度後半開始予定です。現在は個別の補助金（ものづくり第23次、新事業進出第3回）への申請をご検討ください", "purpose": "情報提供"}
  ]
}'),
  wall_chat_ready = 1,
  wall_chat_mode = 'ready',
  detail_score = 80
WHERE id = 'SHINJIGYO-MONO-2026';


-- =====================================================================
-- 7. 検証クエリ
-- =====================================================================
SELECT 
  id, 
  SUBSTR(title, 1, 30) as title_short,
  LENGTH(detail_json) as detail_len,
  wall_chat_ready as wcr,
  wall_chat_mode as mode,
  detail_score,
  acceptance_end_datetime as deadline
FROM subsidy_cache 
WHERE id IN ('SEICHOU-KASOKU-02', 'SHINJIGYO-03', 'MONODUKURI-23', 'JIGYOSHOKEI-MA-14', 'SHINJIGYO-MONO-2026')
ORDER BY detail_score DESC;

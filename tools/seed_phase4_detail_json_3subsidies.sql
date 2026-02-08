-- =====================================================
-- JIZOKUKA-IPPAN-19: 小規模事業者持続化補助金（一般型）第19回
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "小規模事業者持続化補助金＜一般型 通常枠＞ 第19回公募",
    "version": "第5版（2026年1月28日）",
    "subsidy_overview": {
      "max_amount": "50万円（インボイス特例+50万、賃金引上げ特例+150万、両方+200万で最大250万円）",
      "subsidy_rate": "2/3（賃金引上げ特例の赤字事業者は3/4）",
      "purpose": "小規模事業者が経営計画に基づいて行う販路開拓・業務効率化の取組を支援"
    },
    "target_requirements": {
      "business_size": {
        "commercial_service": "常時使用従業員5人以下",
        "accommodation_entertainment": "常時使用従業員20人以下",
        "manufacturing_other": "常時使用従業員20人以下"
      },
      "capital_restriction": "資本金5億円以上の法人に100%保有されていないこと",
      "income_restriction": "直近過去3年の課税所得年平均15億円以下",
      "location": "日本国内に所在"
    },
    "eligible_expenses": [
      "機械装置等費",
      "広報費",
      "ウェブサイト関連費（補助金交付申請額の1/4かつ50万円上限）",
      "展示会等出展費（オンライン含む）",
      "旅費",
      "新商品開発費",
      "借料",
      "委託・外注費"
    ],
    "schedule": {
      "announcement_date": "2026-01-28",
      "application_start": "2026-03-06",
      "application_deadline": "2026-04-30T17:00:00",
      "form4_deadline": "2026-04-16",
      "result_announcement": "2026年7月頃（予定）",
      "project_period_end": "2027-06-30",
      "report_deadline": "2027-07-10"
    },
    "application_method": {
      "type": "電子申請のみ（郵送不可）",
      "required_id": "GビズIDプライムまたはGビズIDメンバー",
      "note": "アカウント取得に数週間要するため事前準備必須"
    },
    "evaluation_criteria": {
      "basic_review": "提出資料完備・対象要件合致・遂行能力・主体的活動",
      "plan_review": [
        "自社の経営状況分析の妥当性",
        "経営方針・目標と今後のプランの適切性",
        "補助事業計画の有効性（実現可能性・デジタル技術活用等）",
        "積算の透明・適切性"
      ],
      "bonus_points": {
        "priority_policy": ["赤字賃上げ加点", "事業環境変化加点", "東日本大震災加点", "くるみん・えるぼし加点"],
        "policy": ["賃金引上げ加点", "地方創生型加点", "経営力向上計画加点", "事業承継加点", "過疎地域加点", "一般事業主行動計画策定加点", "後継者支援加点", "小規模事業者卒業加点", "事業継続力強化計画策定加点", "令和6年能登半島地震等加点"],
        "note": "重点政策加点と政策加点から各1種類、合計2種類まで選択可"
      }
    },
    "special_conditions": {
      "invoice_special": "インボイス特例対象者は50万円上乗せ",
      "wage_increase_special": "賃金引上げ特例で150万円上乗せ（赤字事業者は補助率3/4）"
    },
    "ineligible_expenses": [
      "通常の事業活動費（仕入・更新）",
      "車両（キッチンカー・フォークリフト含む）",
      "汎用品（PC・タブレット・プリンター・電話機等）",
      "消耗品（名刺・文房具・インク等）",
      "不動産取得・家賃・保証金",
      "人件費・役員報酬・謝金・アルバイト代",
      "振込手数料・保険料・消費税",
      "1取引10万円超の現金支払",
      "飲食費・接待費・会費"
    ],
    "required_documents": [
      "様式1: 申請書（システム入力）",
      "様式2: 経営計画兼補助事業計画①（システム入力）",
      "様式3: 補助事業計画②（システム入力）",
      "様式4: 事業支援計画書（商工会/商工会議所発行）",
      "様式5: 補助金交付申請書（システム入力）",
      "様式6: 宣誓・同意書（システム入力）",
      "貸借対照表・損益計算書（法人）/ 確定申告書（個人）",
      "登記簿謄本（法人のみ・3ヶ月以内）"
    ],
    "contact_info": {
      "commercial_district": "商工会地区：地域の商工会",
      "chamber_district": "商工会議所地区：03-6634-9307",
      "hours": "9:00-12:00、13:00-17:00（土日祝・年末年始除く）",
      "office": "小規模事業者持続化補助金事務局（商工会地区：ニューズベース／商工会議所地区：日本経営データ・センター）"
    },
    "important_notes": [
      "審査あり・不採択の可能性あり",
      "補助金は後払い（自己負担が先に必要）",
      "事業計画は事業者自身が策定必須",
      "100万円超の発注は2者以上の相見積必須",
      "50万円以上の資産は処分制限あり",
      "GビズIDのパスワードを第三者に開示禁止",
      "事業効果報告：終了から1年後に状況報告義務"
    ],
    "pdf_source_urls": [
      "https://r6.jizokukahojokin.info/doc/r6_koubover5_ip19.pdf"
    ],
    "official_website": "https://r6.jizokukahojokin.info/"
  }'),
  detail_score = 95,
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  cached_at = datetime('now')
WHERE canonical_id = 'JIZOKUKA-IPPAN-19';

-- =====================================================
-- JIZOKUKA-SOGYO-03: 小規模事業者持続化補助金（創業型）第3回
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "小規模事業者持続化補助金＜創業型＞ 第3回公募",
    "version": "第6版（2026年1月28日）",
    "subsidy_overview": {
      "max_amount": "200万円（インボイス特例対象者は+50万円で最大250万円）",
      "subsidy_rate": "2/3",
      "purpose": "創業1年以内の小規模事業者が行う販路開拓の取組を支援"
    },
    "target_requirements": {
      "business_size": {
        "commercial_service": "常時使用従業員5人以下",
        "accommodation_entertainment": "常時使用従業員20人以下",
        "manufacturing_other": "常時使用従業員20人以下"
      },
      "capital_restriction": "資本金5億円以上の法人に100%保有されていないこと",
      "creation_requirement": "産業競争力強化法に基づく特定創業支援等事業の支援を受けていること",
      "creation_period": "公募締切から過去1年以内に支援受けた日＋開業日の両方が含まれること（2025/4/30～2026/4/30）",
      "location": "日本国内に所在"
    },
    "eligible_expenses": [
      "機械装置等費",
      "広報費",
      "ウェブサイト関連費（補助金交付申請額の1/4、最大50万円上限）",
      "展示会等出展費（オンライン含む）",
      "旅費",
      "新商品開発費",
      "借料",
      "委託・外注費"
    ],
    "schedule": {
      "announcement_date": "2026-01-28",
      "application_start": "2026-03-06",
      "application_deadline": "2026-04-30T17:00:00",
      "form4_deadline": "2026-04-16",
      "project_period_end": "2027-06-30",
      "report_deadline": "2027-07-10"
    },
    "application_method": {
      "type": "電子申請のみ（Jグランツ）、郵送不可",
      "required_id": "GビズIDプライムまたはGビズIDメンバー",
      "note": "暫定アカウントは使用不可"
    },
    "evaluation_criteria": {
      "plan_review": [
        "自社分析の妥当性（強み・弱みの把握）",
        "経営方針・目標と今後のプランの適切性",
        "補助事業計画の有効性（実現可能性・デジタル技術活用）",
        "積算の透明・適切性"
      ],
      "bonus_points": {
        "priority_policy": ["事業環境変化加点", "東日本大震災加点", "くるみん・えるぼし加点", "地方創生型加点"],
        "policy": ["経営力向上計画加点", "事業承継加点", "過疎地域加点", "一般事業主行動計画策定加点", "後継者支援加点", "小規模事業者卒業加点", "事業継続力強化計画策定加点"],
        "note": "重点政策加点と政策加点から各1種類、合計2種類まで選択可"
      }
    },
    "special_conditions": {
      "invoice_special": "インボイス特例対象者は50万円上乗せ（最大250万円）",
      "note": "一般型との重複申請不可"
    },
    "ineligible_expenses": [
      "通常の事業活動費（仕入・更新）",
      "車両（キッチンカー・フォークリフト含む）",
      "汎用品（PC・タブレット・プリンター・電話機等）",
      "消耗品（名刺・文房具・インク等）",
      "不動産取得・家賃・保証金",
      "人件費・役員報酬・謝金・アルバイト代",
      "振込手数料・保険料・消費税",
      "1取引10万円超の現金支払",
      "飲食費・接待費"
    ],
    "required_documents": [
      "様式1: 申請書（システム入力）",
      "様式2: 経営計画書兼補助事業計画書①",
      "様式3: 補助事業計画書②",
      "様式4: 事業支援計画書（商工会/商工会議所発行）",
      "様式5: 補助金交付申請書",
      "様式6: 宣誓・同意書",
      "特定創業支援等事業による支援証明書の写し",
      "創業計画書等の写し",
      "登記簿謄本（法人・3ヶ月以内）/ 開業届（個人）",
      "貸借対照表・損益計算書（法人）/ 確定申告書（個人）"
    ],
    "contact_info": {
      "phone": "03-6739-3890",
      "hours": "9:00-12:00、13:00-17:00（土日祝・年末年始除く）",
      "office": "小規模事業者持続化補助金＜創業型＞事務局（運営：日本経営データ・センター）"
    },
    "important_notes": [
      "審査あり・不採択の可能性あり",
      "補助金は後払い（自己負担先行）",
      "事業計画は事業者自身が策定必須",
      "100万円超の発注は2者以上の相見積必須",
      "50万円以上の資産は処分制限あり",
      "ウェブサイト関連費のみの申請は不可",
      "GビズIDのパスワードを第三者に開示禁止"
    ],
    "pdf_source_urls": [
      "https://r6.jizokukahojokin.info/sogyo/doc/r6_koubover6_sogyo3.pdf"
    ],
    "official_website": "https://r6.jizokukahojokin.info/sogyo/"
  }'),
  detail_score = 95,
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  cached_at = datetime('now')
WHERE canonical_id = 'JIZOKUKA-SOGYO-03';

-- =====================================================
-- SHORYOKUKA-IPPAN-05: 中小企業省力化投資補助金（一般型）第5回
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "中小企業省力化投資補助事業（一般型）第5回公募",
    "version": "第5回公募要領（2025年12月）",
    "subsidy_overview": {
      "max_amount_by_employees": {
        "5人以下": "750万円（大幅賃上げ特例: 1,000万円）",
        "6-20人": "1,500万円（大幅賃上げ特例: 2,000万円）",
        "21-50人": "3,000万円（大幅賃上げ特例: 4,000万円）",
        "51-100人": "5,000万円（大幅賃上げ特例: 6,500万円）",
        "101人以上": "8,000万円（大幅賃上げ特例: 1億円）"
      },
      "subsidy_rate": {
        "sme": "1/2（最低賃金引き上げ特例等は2/3）",
        "small_business": "2/3",
        "restructuring": "2/3"
      },
      "purpose": "IoT・ロボット等の導入による省力化と生産性向上・賃上げを支援"
    },
    "target_requirements": {
      "business_type": {
        "manufacturing_construction_transport": "資本金3億円以下 or 従業員300人以下",
        "wholesale": "資本金1億円以下 or 従業員100人以下",
        "service": "資本金5,000万円以下 or 従業員100人以下",
        "retail": "資本金5,000万円以下 or 従業員50人以下"
      },
      "wage_increase_requirement": "給与支給総額を年平均3.5%以上増加 ＆ 事業場内最低賃金を地域最低賃金+30円以上",
      "location": "日本国内で事業を営む中小企業等"
    },
    "eligible_expenses": [
      "機械装置・システム構築費（必須）",
      "運搬費",
      "技術導入費",
      "知的財産権等関連経費",
      "外注費",
      "専門家経費",
      "クラウドサービス利用費"
    ],
    "schedule": {
      "announcement_date": "2025-12",
      "application_deadline": "公式サイトにて別途公開",
      "project_period": "交付決定日から18ヶ月以内（かつ採択発表日から20ヶ月以内）"
    },
    "application_method": {
      "type": "電子申請のみ（jGrants）",
      "required_id": "GビズIDプライムアカウント（取得に一定期間要）",
      "note": "郵送不可"
    },
    "evaluation_criteria": {
      "main_criteria": [
        "省力化指数",
        "投資回収期間",
        "付加価値額の成長率",
        "オーダーメイド設備の導入",
        "社内体制の整備",
        "地域経済への貢献"
      ],
      "bonus_points": [
        "事業承継加点",
        "事業継続力強化計画策定加点",
        "えるぼし・くるみん認定加点"
      ]
    },
    "ineligible_expenses": [
      "交付決定前の経費",
      "自社の人件費",
      "汎用パソコン",
      "中古品",
      "不動産取得費",
      "公租公課",
      "振込手数料",
      "飲食費"
    ],
    "required_documents": [
      "事業計画書",
      "直近2期分の決算書（損益計算書・貸借対照表）",
      "1人当たり給与支給総額の確認書",
      "履歴事項全部証明書",
      "納税証明書",
      "役員名簿"
    ],
    "contact_info": {
      "phone_navi": "0570-099-660",
      "phone_ip": "03-4335-7595",
      "hours": "9:30-17:30（月～金/土日祝除く）",
      "office": "中小企業省力化投資補助金事務局（独立行政法人中小企業基盤整備機構）"
    },
    "important_notes": [
      "審査あり・外部有識者による審査委員会で評価",
      "事業計画は申請者自身で作成",
      "補助資産の処分制限（売却・転用・破棄の制限）",
      "重複申請の禁止",
      "現地調査への協力義務",
      "過大な成功報酬を請求する支援業者に注意",
      "不備は差し戻し・訂正期限までに未解消なら不採択"
    ],
    "pdf_source_urls": [
      "https://shoryokuka.smrj.go.jp/ippan/download/"
    ],
    "official_website": "https://shoryokuka.smrj.go.jp/ippan/"
  }'),
  detail_score = 95,
  wall_chat_ready = 1,
  wall_chat_missing = '[]',
  cached_at = datetime('now')
WHERE canonical_id = 'SHORYOKUKA-IPPAN-05';

-- Also update the generic SHORYOKUKA-IPPAN with richer data
UPDATE subsidy_cache SET 
  detail_score = 80,
  wall_chat_ready = 1
WHERE canonical_id = 'SHORYOKUKA-IPPAN' AND detail_score < 80;

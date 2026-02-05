-- =====================================================
-- 業務改善助成金（令和7年度）
-- 正式名称: 中小企業最低賃金引上げ支援対策費補助金（業務改善助成金）
-- 
-- 情報源:
-- - 厚生労働省公式サイト: https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html
-- - 交付要綱 (001555743.pdf)
-- - 交付要領 (001555744.pdf)
-- - 申請マニュアル (001497074.pdf)
-- - 変更のお知らせ (001471312.pdf)
-- 
-- 登録日: 2026-02-05
-- =====================================================

-- 既存のREAL-005を更新（令和7年度版）
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
  'GYOMU-KAIZEN-R7',
  'manual',
  '中小企業最低賃金引上げ支援対策費補助金（業務改善助成金）令和7年度',
  6000000,
  '3/4〜9/10（事業場内最低賃金により変動）',
  '全国',
  '全業種',
  '中小企業・小規模事業者',
  '2025-04-14T00:00:00Z',
  '2026-03-31T23:59:00Z',
  1,
  '{
    "subsidy_overview": "業務改善助成金は、生産性向上に資する設備投資等（機械設備、コンサルティング導入や人材育成・教育訓練）を行うとともに、事業場内最低賃金を一定額以上引き上げた場合、その設備投資などにかかった費用の一部を助成するものです。",
    "subsidy_purpose": "中小企業・小規模事業者の生産性向上を支援し、事業場内最低賃金の引き上げを促進する",
    "issuer": "厚生労働省",
    "issuer_department": "労働基準局賃金課",
    
    "application_periods": [
      {
        "period_name": "第1期",
        "application_start": "2025-04-14",
        "application_end": "2025-06-13",
        "wage_increase_start": "2025-05-01",
        "wage_increase_end": "2025-06-30"
      },
      {
        "period_name": "第2期",
        "application_start": "2025-06-14",
        "application_end": "地域別最低賃金改定日の前日",
        "wage_increase_start": "2025-07-01",
        "wage_increase_end": "地域別最低賃金改定日の前日"
      },
      {
        "period_name": "令和7年9月拡充後",
        "application_start": "2025-09-05",
        "application_end": "地域別最低賃金発効日の前日",
        "wage_increase_start": "2025-09-05",
        "wage_increase_end": "地域別最低賃金発効日の前日",
        "notes": "最低賃金引き上げ支援策として拡充"
      }
    ],
    
    "application_courses": [
      {
        "course_name": "30円コース",
        "wage_increase_amount": 30,
        "max_limit_by_workers": {
          "1人": 300000,
          "2〜3人": 500000,
          "4〜6人": 700000,
          "7人以上": 1000000,
          "10人以上（特例）": 1200000
        }
      },
      {
        "course_name": "45円コース",
        "wage_increase_amount": 45,
        "max_limit_by_workers": {
          "1人": 450000,
          "2〜3人": 750000,
          "4〜6人": 1000000,
          "7人以上": 1500000,
          "10人以上（特例）": 1800000
        }
      },
      {
        "course_name": "60円コース",
        "wage_increase_amount": 60,
        "max_limit_by_workers": {
          "1人": 600000,
          "2〜3人": 1000000,
          "4〜6人": 1500000,
          "7人以上": 2300000,
          "10人以上（特例）": 2300000
        }
      },
      {
        "course_name": "90円コース",
        "wage_increase_amount": 90,
        "max_limit_by_workers": {
          "1人": 900000,
          "2〜3人": 1500000,
          "4〜6人": 2300000,
          "7人以上": 4500000,
          "10人以上（特例）": 6000000
        }
      }
    ],
    
    "subsidy_rates": [
      {
        "condition": "事業場内最低賃金1,000円未満",
        "rate": "9/10",
        "note": "30人以上事業場は4/5"
      },
      {
        "condition": "事業場内最低賃金1,000円以上1,050円未満",
        "rate": "4/5",
        "note": ""
      },
      {
        "condition": "事業場内最低賃金1,050円以上",
        "rate": "3/4",
        "note": ""
      }
    ],
    
    "eligibility_requirements": {
      "basic_requirements": [
        "中小企業・小規模事業者であること",
        "事業場内最低賃金と地域別最低賃金の差額が50円以内であること",
        "解雇、賃金引き下げなどの不交付事由がないこと",
        "雇入れ後6か月を経過した労働者が在籍していること"
      ],
      "enterprise_definitions": [
        {
          "industry": "製造業その他",
          "capital": "3億円以下",
          "employees": "300人以下"
        },
        {
          "industry": "卸売業",
          "capital": "1億円以下",
          "employees": "100人以下"
        },
        {
          "industry": "サービス業",
          "capital": "5千万円以下",
          "employees": "100人以下"
        },
        {
          "industry": "小売業",
          "capital": "5千万円以下",
          "employees": "50人以下"
        }
      ],
      "wage_increase_rules": [
        "全ての労働者の賃金を新しい事業場内最低賃金以上まで引き上げる必要がある",
        "賃金引き上げは申請日より後に行う必要がある",
        "引上げ後の事業場内最低賃金額と同額を就業規則等に定める必要がある",
        "複数回に分けての事業場内最低賃金の引上げは認められない"
      ]
    },
    
    "special_business_operators": {
      "wage_requirement": {
        "name": "賃金要件",
        "condition": "事業場内最低賃金が1,000円未満の事業場",
        "benefits": ["助成上限額の拡大（10人以上区分選択可能）"]
      },
      "price_increase_requirement": {
        "name": "物価高騰等要件",
        "condition": "原材料費の高騰など外的要因により、申請前3か月間のうち任意の1月の利益率が前年同期比3%ポイント以上低下",
        "benefits": [
          "助成上限額の拡大（10人以上区分選択可能）",
          "助成対象経費の拡大"
        ],
        "expanded_expenses": [
          "定員7人以上又は車両本体価格200万円以下の乗用自動車",
          "貨物自動車",
          "パソコン、スマートフォン、タブレット等の端末と周辺機器の新規導入"
        ]
      }
    },
    
    "eligible_expenses": {
      "categories": [
        {
          "name": "機械設備",
          "examples": ["POSレジシステム", "券売機", "洗浄機", "調理用機器", "包装用機器", "工作機械", "フォークリフト"]
        },
        {
          "name": "コンサルティング",
          "examples": ["経営コンサルタント", "業務改善コンサルティング", "人事制度構築支援"]
        },
        {
          "name": "人材育成・教育訓練",
          "examples": ["技能向上研修", "資格取得支援", "eラーニング導入"]
        },
        {
          "name": "設備投資",
          "examples": ["自動化設備", "省力化機器", "情報システム"]
        }
      ],
      "excluded_expenses": [
        "不動産の取得",
        "汎用性の高いPC・タブレット（特例事業者除く）",
        "乗用車（定員7人未満かつ200万円超、特例事業者除く）",
        "消耗品費",
        "光熱水費",
        "通信費",
        "租税公課",
        "振込手数料"
      ]
    },
    
    "required_documents": {
      "common": [
        {
          "name": "交付申請書（様式第1号）",
          "description": "申請金額、事業の目的及び内容、申請コース等を記載",
          "required": true
        },
        {
          "name": "国庫補助金所要額調書（別紙）",
          "description": "設備投資等の詳細と費用",
          "required": true
        },
        {
          "name": "業務改善計画・賃金引上計画（別紙2）",
          "description": "具体的な業務改善内容と賃金引上げ計画",
          "required": true
        },
        {
          "name": "事業場内最低賃金を確認できる書類",
          "description": "賃金台帳、出勤簿、労働条件通知書等",
          "required": true
        },
        {
          "name": "見積書",
          "description": "導入予定設備等の見積書（2社以上推奨）",
          "required": true
        },
        {
          "name": "カタログ・仕様書",
          "description": "導入予定設備の詳細がわかる資料",
          "required": true
        }
      ],
      "corporation": [
        {
          "name": "登記事項証明書",
          "description": "法人の場合に必要",
          "required": true
        },
        {
          "name": "直近の確定申告書・決算書",
          "description": "事業規模の確認のため",
          "required": true
        }
      ],
      "individual": [
        {
          "name": "開業届の写し",
          "description": "個人事業主の場合",
          "required": true
        },
        {
          "name": "確定申告書の写し",
          "description": "事業所得を確認",
          "required": true
        }
      ],
      "special_operator": [
        {
          "name": "事業活動の状況に関する申出書",
          "description": "物価高騰等要件に該当する場合",
          "required": true
        },
        {
          "name": "利益率の低下を証明する書類",
          "description": "損益計算書、売上高等の資料",
          "required": true
        }
      ]
    },
    
    "application_flow": [
      {
        "step": 1,
        "title": "計画策定",
        "description": "事業場内最低賃金引上げ計画と設備投資等の計画を策定"
      },
      {
        "step": 2,
        "title": "交付申請",
        "description": "管轄の労働局に交付申請書を提出"
      },
      {
        "step": 3,
        "title": "交付決定",
        "description": "労働局による審査後、交付決定通知"
      },
      {
        "step": 4,
        "title": "事業実施",
        "description": "設備投資等の実施、賃金引上げの実施"
      },
      {
        "step": 5,
        "title": "事業完了報告",
        "description": "事業完了後、事業実績報告書を提出"
      },
      {
        "step": 6,
        "title": "助成金支給",
        "description": "確定検査後、助成金の支給"
      }
    ],
    
    "business_completion_deadline": {
      "standard": "交付決定の属する年度の1月31日",
      "extension": "やむを得ない理由がある場合は3月31日まで延長可能",
      "extension_examples": [
        "導入機器等の納入日が半導体不足等により1月31日以降となる場合",
        "導入機器等の支払い日が2月1日以降となる場合"
      ]
    },
    
    "contact_info": {
      "general": "管轄の労働局雇用環境・均等部（室）",
      "url": "https://www.mhlw.go.jp/kouseiroudoushou/shozaiannai/roudoukyoku/index.html"
    },
    
    "official_urls": {
      "main": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html",
      "guideline_pdf": "https://www.mhlw.go.jp/content/11200000/001555743.pdf",
      "manual_pdf": "https://www.mhlw.go.jp/content/11200000/001497074.pdf",
      "faq": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html"
    },
    
    "pdf_attachments": [
      {
        "name": "交付要綱",
        "url": "https://www.mhlw.go.jp/content/11200000/001555743.pdf"
      },
      {
        "name": "交付要領",
        "url": "https://www.mhlw.go.jp/content/11200000/001555744.pdf"
      },
      {
        "name": "申請マニュアル",
        "url": "https://www.mhlw.go.jp/content/11200000/001497074.pdf"
      },
      {
        "name": "業務改善助成金拡充リーフレット",
        "url": "https://www.mhlw.go.jp/content/11200000/001565079.pdf"
      },
      {
        "name": "申請様式（様式第1号）",
        "url": "https://www.mhlw.go.jp/content/11200000/001555951.docx"
      }
    ],
    
    "is_electronic_application": false,
    "application_method": "郵送（管轄の労働局雇用環境・均等部室宛て）",
    
    "wall_chat_questions": [
      {
        "category": "基本情報",
        "question": "事業場の従業員数は何名ですか？（正社員・パート含む）",
        "purpose": "中小企業要件・助成上限額の判定"
      },
      {
        "category": "基本情報",
        "question": "事業場の業種は何ですか？",
        "purpose": "中小企業の定義（資本金・従業員数要件）の判定"
      },
      {
        "category": "基本情報",
        "question": "資本金または出資の総額はいくらですか？",
        "purpose": "中小企業要件の判定"
      },
      {
        "category": "賃金要件",
        "question": "現在の事業場内最低賃金（最も低い時給）はいくらですか？",
        "purpose": "申請資格・助成率の判定"
      },
      {
        "category": "賃金要件",
        "question": "お住まいの都道府県の地域別最低賃金はいくらですか？",
        "purpose": "事業場内最低賃金との差額確認（50円以内要件）"
      },
      {
        "category": "賃金要件",
        "question": "賃金を引き上げる予定の労働者は何名ですか？",
        "purpose": "助成上限額の判定"
      },
      {
        "category": "賃金要件",
        "question": "何円の賃金引き上げを予定していますか？（30円、45円、60円、90円のいずれか）",
        "purpose": "申請コースの決定"
      },
      {
        "category": "設備投資",
        "question": "どのような設備投資を予定していますか？",
        "purpose": "対象経費の確認"
      },
      {
        "category": "設備投資",
        "question": "設備投資の金額はいくらを予定していますか？",
        "purpose": "助成金額の試算"
      },
      {
        "category": "特例事業者",
        "question": "事業場内最低賃金は1,000円未満ですか？",
        "purpose": "賃金要件による特例判定"
      },
      {
        "category": "特例事業者",
        "question": "原材料費の高騰等により、利益率が前年同期比3%ポイント以上低下していますか？",
        "purpose": "物価高騰等要件の判定"
      },
      {
        "category": "不交付要件",
        "question": "過去1年以内に解雇を行いましたか？",
        "purpose": "不交付要件の確認"
      },
      {
        "category": "不交付要件",
        "question": "過去1年以内に賃金の引き下げを行いましたか？",
        "purpose": "不交付要件の確認"
      },
      {
        "category": "申請タイミング",
        "question": "賃金の引き上げはいつ行う予定ですか？",
        "purpose": "申請期間との整合性確認"
      }
    ],
    
    "bonus_points": [],
    
    "notes": [
      "審査に時間がかかっているため、余裕を持った事業計画を策定の上、申請すること",
      "令和7年9月5日に最低賃金引き上げ支援策として拡充",
      "設備投資等と賃金引上げの両方が完了しないと助成金は支給されない"
    ],
    
    "last_updated": "2026-02-05",
    "koubo_source": "001555743.pdf, 001555744.pdf, 001497074.pdf, 001471312.pdf",
    "enriched_version": "v2_koubo_based"
  }',
  datetime('now'),
  datetime('now', '+30 days'),
  1,
  '[]',
  80,
  0,
  1
);

-- SSOTテーブル（subsidy_canonical）への登録
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
  'GYOMU-KAIZEN',
  '中小企業最低賃金引上げ支援対策費補助金（業務改善助成金）',
  '業務改善助成金',
  'MHLW',
  '厚生労働省',
  NULL,
  '["employment", "wage_increase", "productivity"]',
  '["all"]',
  'GYOMU-KAIZEN-R7-SNAP-001',
  'GYOMU-KAIZEN-R7',
  datetime('now'),
  datetime('now'),
  1,
  '令和7年度版（2025年4月〜2026年3月）',
  datetime('now'),
  datetime('now')
);

-- SSOTスナップショット（subsidy_snapshot）への登録
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
  'GYOMU-KAIZEN-R7-SNAP-001',
  'GYOMU-KAIZEN',
  'a0WJ200000CDIvFMAX',
  'R7',
  '2025',
  '2025-04-14',
  '2026-03-31',
  '令和7年度末まで（期ごとに締切あり）',
  1,
  6000000,
  300000,
  '3/4〜9/10',
  0.9,
  '["00"]',
  '全国',
  '["all"]',
  '中小企業・小規模事業者',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html',
  '["https://www.mhlw.go.jp/content/11200000/001555743.pdf","https://www.mhlw.go.jp/content/11200000/001555744.pdf","https://www.mhlw.go.jp/content/11200000/001497074.pdf"]',
  '[{"name":"交付要綱","url":"https://www.mhlw.go.jp/content/11200000/001555743.pdf"},{"name":"交付要領","url":"https://www.mhlw.go.jp/content/11200000/001555744.pdf"},{"name":"申請マニュアル","url":"https://www.mhlw.go.jp/content/11200000/001497074.pdf"}]',
  NULL,
  datetime('now'),
  'manual_2026-02-05',
  datetime('now')
);

-- 旧レコード（REAL-005）を非表示に
UPDATE subsidy_cache
SET is_visible = 0
WHERE id = 'REAL-005';

-- =====================================================
-- Phase 5: 19件の補助金detail_json一括更新
-- 生成日: 2026-02-08
-- 対象: detail_score 0〜85の改善候補全件
-- =====================================================

-- =====================================================
-- 1. SHOUENE-ENECHO: 省エネルギー投資促進支援（エネ庁ポータル）
-- スコア: 0 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "先進的省エネルギー投資促進支援事業費補助金（省エネ設備への更新支援）",
    "version": "令和6年度補正予算・令和7年度予算",
    "subsidy_overview": {
      "summary": "事業者の省エネ設備への更新を促進するため、先進型設備、オーダーメイド型設備、電化・脱炭素燃転設備、設備単位型、エネルギー需要最適化型の5つの区分で支援。経済産業省資源エネルギー庁が所管し、SII（環境共創イニシアチブ）が執行。",
      "budget": "910億円（投促・需構転）＋250億円（投促支援）※令和5年度補正",
      "purpose": "2030年エネルギー需給見通しの達成、省エネルギーの加速"
    },
    "programs": [
      {
        "name": "（Ⅰ）工場・事業場型",
        "max_amount": "単年度15億円（非化石20億円）、複数年度最大30億円（非化石40億円）",
        "subsidy_rate": "先進枠: 中小2/3、大企業1/2 ／ 一般枠: 中小1/2、大企業1/3",
        "target": "機械設計を伴う設備・オーダーメイド設備・先進設備",
        "managing_body": "省エネルギー投資促進・需要構造転換支援事業費補助金"
      },
      {
        "name": "（Ⅱ）電化・脱炭素燃転型",
        "max_amount": "3億円（電化5億円）",
        "subsidy_rate": "中小1/2、大企業1/3",
        "target": "化石燃料から電気への転換、低炭素燃料への転換設備"
      },
      {
        "name": "（Ⅲ）設備単位型",
        "max_amount": "1億円（下限30万円）",
        "subsidy_rate": "1/3以内",
        "target": "SII登録済み指定設備（高効率空調・ボイラ・変圧器・冷凍冷蔵庫・産業用モータ等）",
        "managing_body": "省エネルギー投資促進支援事業費補助金"
      },
      {
        "name": "（Ⅳ）エネルギー需要最適化型",
        "max_amount": "1億円",
        "subsidy_rate": "中小1/2、大企業1/3",
        "target": "EMS（エネルギーマネジメントシステム）導入"
      }
    ],
    "target_requirements": {
      "basic": "国内で事業活動を営む法人・個人事業主（青色申告者）",
      "large_enterprise": "大企業は省エネ法クラス分けSまたはAクラス、またはベンチマーク目標達成見込み",
      "gx_commitment": "GX推進への取組意思表明（Scope1・2削減目標設定等）"
    },
    "eligible_expenses": {
      "koujou": "設計費、設備費、工事費",
      "denka": "設備費（中小は工事費も可）",
      "setsubi": "設備本体購入費のみ（据付工事費・撤去費は対象外）",
      "ems": "設計費、設備費、工事費"
    },
    "application": {
      "method": "SIIポータルでアカウント登録→Web入力→郵送（直接持込不可）",
      "note": "事業区分により公募期間が異なる。予算消化次第終了の場合あり",
      "system": "SII補助事業ポータル"
    },
    "schedule": {
      "note": "令和6年度補正予算事業は3次公募で終了。令和6年度補正（新予算）および令和7年度予算の詳細はSIIホームページで公表予定"
    },
    "contact": {
      "general": "0570-057-025",
      "koujou_senshin": "03-5565-3840",
      "koujou_ordermade": "03-5565-4463",
      "denka": "03-5565-3840",
      "setsubi": "03-5565-3840",
      "ems": "03-5565-4773",
      "hours": "平日10:00〜12:00、13:00〜17:00"
    },
    "official_sites": [
      "https://www.enecho.meti.go.jp/category/saving_and_new/saving/enterprise/support/",
      "https://sii.or.jp/koujou06r/",
      "https://sii.or.jp/setsubi06r/"
    ],
    "pdf_sources": [
      "https://sii.or.jp/koujou06r/uploads/r6h_kj_01_kouboyouryou_3.pdf",
      "https://sii.or.jp/setsubi06r/uploads/r6h_panflet_gaiyou_st_3.pdf"
    ],
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'SHOUENE-ENECHO';

-- =====================================================
-- 2. SHOUENE-KOUJOU-06: 省エネ投促・需構転支援事業（工場・事業場型）
-- スコア: 70 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "省エネルギー投資促進・需要構造転換支援事業費補助金（令和6年度補正予算）",
    "version": "3次公募用公募要領",
    "subsidy_overview": {
      "summary": "工場・事業場における先進設備やオーダーメイド設備の導入、電化・脱炭素燃転、エネルギー需要最適化を支援する大型省エネ補助金。令和6年度補正予算910億円。",
      "budget": "910億円（国庫債務負担行為2,025億円）",
      "purpose": "省エネルギー設備への更新促進、2030年エネルギー需給見通し達成"
    },
    "subsidy_amount": {
      "koujou_senshin": {
        "max": "単年度15億円（非化石20億円）、複数年度最大30億円（非化石40億円）",
        "rate": "中小企業2/3以内、大企業1/2以内",
        "min_energy_saving": "省エネ率30%以上"
      },
      "koujou_ippan": {
        "max": "同上",
        "rate": "中小企業1/2以内、大企業1/3以内",
        "min_energy_saving": "省エネ率10%以上"
      },
      "denka": {
        "max": "3億円（電化5億円）",
        "rate": "中小企業1/2以内、大企業1/3以内"
      },
      "ems": {
        "max": "1億円",
        "rate": "中小企業1/2以内、大企業1/3以内"
      }
    },
    "target_requirements": {
      "basic": "国内で事業活動を営む法人・個人事業主（青色申告者限定）",
      "financial": "経営基盤を有し事業の継続性が認められること（債務超過でないこと等）",
      "large_enterprise": "省エネ法SまたはAクラス、またはベンチマーク目標達成見込み",
      "gx": "GX推進への取組意思表明必須"
    },
    "eligible_expenses": ["設計費", "設備費", "工事費（電化・脱炭素燃転型は中小のみ工事費可）"],
    "schedule": {
      "third_round_single": "2025年8月13日〜2025年10月31日 17時",
      "third_round_multi": "2025年8月13日〜2026年1月13日 17時",
      "status": "3次公募終了。次年度予算の詳細はSIIで公表予定"
    },
    "application": {
      "method": "SII補助事業ポータルでWeb入力→郵送（簡易書留等）",
      "review": "随時審査、予算の範囲内で順次採択"
    },
    "business_period": "交付決定日〜原則2026年1月31日（複数年度は最大4カ年）",
    "contact": {
      "senshin_denka": "03-5565-3840",
      "ippan_tokushin": "03-5565-4463",
      "ems": "03-5565-4773",
      "hours": "平日10:00〜12:00、13:00〜17:00"
    },
    "official_site": "https://sii.or.jp/koujou06r/",
    "pdf_source": "https://sii.or.jp/koujou06r/uploads/r6h_kj_01_kouboyouryou_3.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'SHOUENE-KOUJOU-06';

-- =====================================================
-- 3. SHOUENE-SETSUBI-06: 省エネ投促支援事業（設備単位型）
-- スコア: 70 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "省エネルギー投資促進支援事業費補助金（設備単位型）（令和6年度補正予算）",
    "version": "3次公募概要",
    "subsidy_overview": {
      "summary": "SIIに登録された指定設備（高効率空調、業務用給湯器、高性能ボイラ、変圧器、冷凍冷蔵庫、産業用モータ等）の導入を補助。簡易な手続きで申請可能な設備単位型。",
      "budget": "250億円（国庫債務負担行為300億円）",
      "purpose": "汎用的な省エネ設備の更新促進"
    },
    "subsidy_amount": {
      "max": "1億円",
      "min": "30万円",
      "rate": "補助対象経費の1/3以内"
    },
    "target_requirements": {
      "basic": "国内で事業を営む法人および個人事業主",
      "large_enterprise": "省エネ法上の特定事業者（エネルギー使用量1,500kl/年以上）は定期報告書等提出が条件",
      "exclusion": "暴力団関係者でないこと等"
    },
    "eligible_expenses": {
      "covered": "SIIウェブサイトに登録済みの指定設備の本体購入費",
      "not_covered": ["据付工事費", "運搬費", "撤去費", "消費税"],
      "target_equipment": ["高効率空調", "業務用給湯器", "高性能ボイラ", "変圧器", "冷凍冷蔵庫", "産業用モータ", "LED照明器具"]
    },
    "schedule": {
      "status": "令和6年度補正予算事業は予算超過のため4次公募なし",
      "note": "令和6年度補正（新予算）の詳細はSIIで公表予定"
    },
    "application": {
      "method": "SII補助事業ポータルでWeb入力→郵送",
      "system": "SII補助事業ポータル"
    },
    "contact": {
      "phone": "03-5565-3840",
      "department": "一般社団法人環境共創イニシアチブ（SII）審査第一部",
      "hours": "平日10:00〜12:00、13:00〜17:00"
    },
    "official_site": "https://sii.or.jp/setsubi06r/",
    "pdf_source": "https://sii.or.jp/setsubi06r/uploads/r6h_panflet_gaiyou_st_3.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'SHOUENE-SETSUBI-06';

-- =====================================================
-- 4. GO-TECH-R8: Go-Tech事業（令和8年度）
-- スコア: 80 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "成長型中小企業等研究開発支援事業（Go-Tech事業）令和8年度",
    "version": "事前予告（2026年1月14日公表）",
    "subsidy_overview": {
      "summary": "中小企業が大学・公設試験研究機関等と連携して行う研究開発や試作品開発、販路開拓を最大3年間支援。ものづくり基盤技術およびサービスの高度化を通じた中小企業の成長を促進。",
      "purpose": "ものづくり基盤技術・サービスの高度化、中小企業の研究開発力強化"
    },
    "subsidy_amount": {
      "single_company": "最大9,750万円（3年合計、年度あたり3,250万円上限）",
      "joint_application": "最大1億円超（共同体の場合）",
      "rate": "2/3以内",
      "large_company_partner": "大企業等が参加する場合は大企業分1/2以内"
    },
    "target_requirements": {
      "applicant": "中小企業者（中小企業等経営強化法に基づく定義）",
      "collaboration": "大学・公設試・研究機関等との連携が必須",
      "technology_area": "ものづくり基盤技術高度化指針またはサービス高度化指針に基づくテーマ"
    },
    "eligible_expenses": ["研究員費", "機械装置費", "材料費", "外注加工費", "委託費", "技術導入費", "知的財産権関連経費", "旅費", "その他経費"],
    "schedule": {
      "pre_announcement": "2026年1月14日",
      "application_start": "2026年2月24日（火）",
      "application_deadline": "2026年3月26日（木）予定",
      "system": "電子申請（jGrants）"
    },
    "business_period": "最大3年間（複数年度事業）",
    "review_points": ["技術的新規性・革新性", "事業化の可能性", "研究開発体制の妥当性", "連携先の適切性", "費用対効果"],
    "contact": {
      "organization": "中小企業庁 技術・経営革新課",
      "regional": "各地方経済産業局",
      "portal": "https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260114001.html"
    },
    "official_site": "https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260114001.html",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'GO-TECH';

-- =====================================================
-- 5. DAIKIBO-SEICHOU-05: 大規模成長投資補助金（第5次）
-- スコア: 85 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "中堅・中小・スタートアップ企業の賃上げに向けた省力化等の大規模成長投資補助金（第5次公募）",
    "version": "第5次公募概要（2025年12月26日公表）",
    "subsidy_overview": {
      "summary": "中堅・中小企業等が工場等の拠点新設や大規模設備投資を通じて人手不足に対応し、持続的な賃上げを実現するための大規模投資を支援。投資額10億円以上の大型プロジェクトが対象。",
      "budget": "総額3,000億円（令和9年度までの国庫債務負担含む）",
      "purpose": "中堅・中小企業の省力化、賃上げ、成長投資の促進"
    },
    "subsidy_amount": {
      "max": "50億円",
      "rate": "1/3以下",
      "min_investment": "投資額10億円以上（専門家経費・外注費除く）"
    },
    "target_requirements": {
      "company_size": "常時使用従業員数2,000人以下（単体ベース）の中堅・中小企業",
      "consortium": "一定要件を満たす場合、共同申請（コンソーシアム：最大10社）も可",
      "wage_increase": "補助事業終了後3年間の従業員1人当たり給与支給総額の年平均上昇率4.5%以上",
      "exclusion": ["みなし大企業", "農作物生産等の1次産業を主業とする場合"]
    },
    "eligible_expenses": ["建物費", "機械装置費", "システム構築費", "外注費", "専門家経費", "その他経費"],
    "schedule": {
      "guideline_published": "2025年12月26日",
      "application_start": "2026年春公募開始予定",
      "review": "1次審査（書類）→2次審査（プレゼン）→採択発表"
    },
    "business_period": "交付決定日から最長令和9年12月末まで",
    "review_points": ["事業の革新性・成長性", "地域経済への波及効果", "賃上げの実現可能性", "大規模投資・費用対効果", "実現可能性"],
    "wage_penalty": "賃上げ目標未達の場合、未達成率に応じて補助金返還（天災等除く）",
    "contact": {
      "portal": "https://seichotoushi-hojo.jp/",
      "organization": "中堅等大規模成長投資補助金事務局"
    },
    "official_site": "https://seichotoushi-hojo.jp/",
    "pdf_source": "https://www.meti.go.jp/policy/economy/chuuken/daikibo_5koubo_20251226.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'DAIKIBO-SEICHOU-05';

-- =====================================================
-- 6. HATARAKIKATA-ROUDOU: 働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）
-- スコア: 85 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "働き方改革推進支援助成金（労働時間短縮・年休促進支援コース）",
    "version": "令和7年度（2025年度）",
    "subsidy_overview": {
      "summary": "生産性を向上させ、時間外労働の削減・年次有給休暇・特別休暇の促進に取り組む中小企業事業主を支援。36協定の時間外労働上限引下げや有給休暇の計画的付与制度導入が成果目標。",
      "purpose": "中小企業の労働時間短縮、年次有給休暇・特別休暇の促進"
    },
    "subsidy_amount": {
      "goal1_80to60": "150万円",
      "goal1_60under": "100万円",
      "goal1_80to80": "50万円",
      "goal2_paid_leave": "25万円",
      "goal3_hourly_leave": "25万円",
      "wage_increase_addon": "最大730万円（3〜7%引上げ、最大30人）",
      "rate": "3/4（従業員30人以下で取組6〜9実施は4/5）"
    },
    "target_requirements": {
      "basic": "中小企業事業主（労災保険適用）",
      "size_by_industry": {
        "retail": "資本金5,000万円以下 or 従業員50人以下",
        "service": "資本金5,000万円以下 or 従業員100人以下",
        "wholesale": "資本金1億円以下 or 従業員100人以下",
        "other": "資本金3億円以下 or 従業員300人以下"
      },
      "precondition": "年5日の年次有給休暇取得に向け就業規則等を整備済み"
    },
    "eligible_activities": [
      "労務管理担当者に対する研修",
      "労働者に対する研修・周知・啓発",
      "外部専門家によるコンサルティング",
      "就業規則・労使協定等の作成・変更",
      "人材確保に向けた取組",
      "労務管理用ソフトウェアの導入・更新",
      "労務管理用機器の導入・更新",
      "デジタコの導入・更新",
      "労働能率増進に資する設備・機器等の導入・更新"
    ],
    "schedule": {
      "application_period": "2025年4月1日〜2025年11月28日（必着）",
      "implementation": "交付決定日〜当該年度の1月30日まで",
      "note": "予算制約により11月28日以前に締切の場合あり"
    },
    "application": {
      "method": "都道府県労働局 雇用環境・均等部（室）へ持参、郵送、またはjGrants電子申請",
      "id_required": "GビズIDプライムまたはメンバーアカウント（jGrants利用時）"
    },
    "contact": {
      "window": "各都道府県労働局 雇用環境・均等部（室）",
      "portal": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html"
    },
    "official_site": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'HATARAKIKATA-ROUDOU';

-- =====================================================
-- 7. HATARAKIKATA-INTERVAL: 働き方改革推進支援助成金（勤務間インターバル導入コース）
-- スコア: 80 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "働き方改革推進支援助成金（勤務間インターバル導入コース）",
    "version": "令和7年度（2025年度）",
    "subsidy_overview": {
      "summary": "勤務終了後、次の勤務までに一定時間以上の「休息時間」を設ける勤務間インターバル制度を導入する中小企業を支援。新規導入のほか、適用範囲拡大や休息時間延長も対象。",
      "purpose": "勤務間インターバル制度の普及促進、労働者の健康確保と生産性向上"
    },
    "subsidy_amount": {
      "new_introduction": {
        "9h_to_11h": "80万円",
        "11h_or_more": "100万円"
      },
      "scope_expansion": {
        "9h_to_11h": "40万円",
        "11h_or_more": "50万円"
      },
      "time_extension": {
        "9h_to_11h": "40万円",
        "11h_or_more": "50万円"
      },
      "wage_increase_addon": "最大340万円（3〜7%引上げ、最大30人）",
      "rate": "3/4（従業員30人以下で取組6〜9実施は4/5）"
    },
    "target_requirements": {
      "basic": "中小企業事業主（労災保険適用）",
      "condition": "36協定を締結していること、勤務間インターバル制度を導入していないこと（新規の場合）",
      "industry_size": "小売5,000万/50人、サービス5,000万/100人、卸売1億/100人、その他3億/300人"
    },
    "eligible_activities": [
      "労務管理担当者研修",
      "労働者研修・周知・啓発",
      "外部専門家コンサルティング",
      "就業規則・労使協定の作成・変更",
      "人材確保に向けた取組",
      "労務管理用ソフトウェア・機器導入",
      "デジタコ導入",
      "労働能率増進設備・機器導入"
    ],
    "schedule": {
      "application_period": "2025年4月1日〜2025年11月28日（必着）",
      "implementation": "交付決定日〜当該年度の1月30日まで",
      "note": "予算制約により早期締切の場合あり"
    },
    "application": {
      "method": "都道府県労働局 雇用環境・均等部（室）へ持参、郵送、またはjGrants電子申請"
    },
    "contact": {
      "window": "各都道府県労働局 雇用環境・均等部（室）",
      "portal": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000150891.html"
    },
    "official_site": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000150891.html",
    "pdf_source": "https://www.mhlw.go.jp/content/001486554.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'HATARAKIKATA-INTERVAL';

-- =====================================================
-- 8. RYOURITSU-SHIEN: 両立支援等助成金（出生時両立支援コース）
-- スコア: 75 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "両立支援等助成金（出生時両立支援コース・子育てパパ支援助成金）",
    "version": "令和7年度（2025年度）",
    "subsidy_overview": {
      "summary": "男性労働者が育児休業を取得しやすい雇用環境を整備し、実際に育児休業を取得させた事業主に助成。第1種（個別取得支援）と第2種（取得率向上支援）の2段階構成。",
      "purpose": "男性の育児休業取得推進、仕事と育児の両立支援"
    },
    "subsidy_amount": {
      "type1": {
        "first_person": "20万円（雇用環境整備4措置以上実施で30万円）",
        "second_third": "各10万円",
        "note": "1〜3人目までのいずれか1回限り、育児休業5日以上（中小企業）"
      },
      "type2": {
        "within_1year": "60万円（大企業75万円）",
        "within_2years": "40万円（大企業65万円）",
        "within_3years": "20万円（大企業50万円）",
        "note": "男性育休取得率30ポイント以上上昇、1事業主1回限り"
      }
    },
    "target_requirements": {
      "basic": "中小企業事業主（雇用保険被保険者を雇用）",
      "type1_conditions": [
        "育児休業取得者が出た場合に男性労働者が利用できる育児休業制度について、育児・介護休業法を上回る措置を講じること",
        "子の出生後8週間以内に育児休業を開始し、連続5日以上取得"
      ],
      "type2_conditions": [
        "第1種の支給を受けていること",
        "男性労働者の育児休業取得率が30ポイント以上上昇"
      ]
    },
    "application": {
      "type1_deadline": "育児休業終了日翌日から2ヶ月以内",
      "type2_deadline": "支給要件を満たした事業年度の翌事業年度開始日から6ヶ月以内",
      "method": "都道府県労働局へ郵送またはjGrants電子申請（2023年6月26日〜対応）"
    },
    "schedule": {
      "application_period": "通年受付（要件を満たした時点で申請可能）",
      "fiscal_year": "2025年4月1日〜2026年3月31日"
    },
    "contact": {
      "window": "各都道府県労働局 雇用環境・均等部（室）",
      "portal": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html"
    },
    "official_site": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html",
    "pdf_source": "https://www.mhlw.go.jp/content/001472912.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'RYOURITSU-SHIEN';

-- =====================================================
-- 9. KOUREISHA-MUKI: 65歳超雇用推進助成金（高年齢者無期雇用転換コース）
-- スコア: 80 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "65歳超雇用推進助成金（高年齢者無期雇用転換コース）",
    "version": "令和7年度（2025年度）",
    "subsidy_overview": {
      "summary": "50歳以上かつ定年年齢未満の有期契約労働者を無期雇用に転換させた事業主に対して助成。高年齢者の雇用安定と就労機会の確保を目的とする。",
      "purpose": "高年齢者の無期雇用転換促進、生涯現役社会の構築"
    },
    "subsidy_amount": {
      "sme": "対象労働者1人あたり30万円",
      "large": "対象労働者1人あたり23万円",
      "limit": "1適用事業所あたり年度10人まで"
    },
    "target_requirements": {
      "employer": [
        "無期雇用転換計画を作成し、JEED（高齢・障害・求職者雇用支援機構）の認定を受けること",
        "有期契約労働者を無期雇用に転換する制度を労働協約または就業規則に規定すること",
        "計画期間内に50歳以上かつ定年年齢未満の有期契約労働者を無期雇用に転換すること"
      ],
      "worker": [
        "転換日において50歳以上かつ定年年齢未満であること",
        "申請事業主に6ヶ月以上継続雇用されている有期契約労働者であること",
        "転換日から支給申請日までの間に無期雇用が継続していること"
      ]
    },
    "procedure": {
      "step1": "無期雇用転換計画書をJEED各都道府県支部へ提出（計画開始6ヶ月前〜開始日前日）",
      "step2": "計画期間内に対象労働者を無期雇用に転換",
      "step3": "転換後6ヶ月分の賃金支払後、2ヶ月以内にJEEDへ支給申請"
    },
    "schedule": {
      "application_period": "通年受付（計画認定→転換→支給申請の流れ）",
      "fiscal_year": "2025年4月1日〜2026年3月31日"
    },
    "contact": {
      "window": "独立行政法人高齢・障害・求職者雇用支援機構（JEED）各都道府県支部",
      "portal": "https://www.jeed.go.jp/elderly/subsidy/subsidy_muki.html"
    },
    "official_site": "https://www.mhlw.go.jp/stf/newpage_55142.html",
    "pdf_source": "https://www.mhlw.go.jp/content/11700000/001469525.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'KOUREISHA-MUKI';

-- =====================================================
-- 10. TRIAL-KOYOU-IPPAN: トライアル雇用助成金（一般トライアルコース）
-- スコア: 80 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "トライアル雇用助成金（一般トライアルコース）",
    "version": "令和7年度（2025年度）",
    "subsidy_overview": {
      "summary": "職業経験の不足などにより就職が困難な求職者を、原則3ヶ月間の試行雇用（トライアル雇用）を通じて常用雇用への移行を目指す。ミスマッチを防ぎながら採用リスクを軽減。",
      "purpose": "就職困難者の常用雇用への移行促進、企業の採用リスク軽減"
    },
    "subsidy_amount": {
      "general": "月額4万円×最長3ヶ月（合計最大12万円）",
      "single_parent": "月額5万円×最長3ヶ月（母子家庭の母・父子家庭の父の場合）",
      "type": "定額支給"
    },
    "target_requirements": {
      "worker_conditions": [
        "紹介日前2年以内に2回以上離職・転職を繰り返している",
        "紹介日前に離職している期間が1年を超えている",
        "妊娠・出産・育児を理由に離職し、紹介日前に安定した職業に就いていない期間が1年を超えている",
        "紹介日時点でニートやフリーター等で45歳未満",
        "就職支援に当たって特別な配慮を要する（生活保護受給者、母子家庭の母等、父子家庭の父、日雇労働者、住居喪失不安定就労者、生活困窮者）"
      ],
      "employer_conditions": [
        "ハローワーク・紹介事業者等の紹介によりトライアル雇用を開始すること",
        "原則3ヶ月のトライアル雇用期間を設定すること",
        "トライアル雇用期間中に常用雇用への移行を検討すること"
      ]
    },
    "procedure": {
      "step1": "ハローワークにトライアル雇用求人を提出",
      "step2": "ハローワークの紹介で対象者をトライアル雇用（原則3ヶ月）",
      "step3": "トライアル雇用開始から2週間以内に実施計画書を提出",
      "step4": "トライアル雇用終了後2ヶ月以内に結果報告書兼支給申請書を提出"
    },
    "schedule": {
      "application_period": "通年受付（トライアル雇用終了後2ヶ月以内に申請）",
      "fiscal_year": "2025年4月1日〜2026年3月31日"
    },
    "contact": {
      "window": "最寄りのハローワーク（公共職業安定所）",
      "portal": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/newpage_16286.html"
    },
    "official_site": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/newpage_16286.html",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'TRIAL-KOYOU-IPPAN';

-- =====================================================
-- 11. JIZOKUKA-NOTO-09: 持続化補助金・災害支援枠（能登）第9次
-- スコア: 85 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "小規模事業者持続化補助金＜一般型 災害支援枠（令和6年能登半島地震等）＞ 第9次公募",
    "version": "第8版（2025年10月28日公開）",
    "subsidy_overview": {
      "summary": "令和6年能登半島地震および能登豪雨で被災した石川県能登3市3町の小規模事業者が事業再建に取り組む経費を支援。機械装置の導入、店舗修繕、車両購入（被災車両の場合）等が対象。",
      "purpose": "能登半島地震等で被災した小規模事業者の事業再建支援"
    },
    "subsidy_amount": {
      "max": "200万円（自社の事業用資産に直接被害があった場合）",
      "rate": "2/3以内（一定要件で定額）",
      "web_limit": "交付申請額の1/4かつ50万円上限（ウェブサイト関連費）",
      "disposal_limit": "補助対象経費総額の1/2（設備処分費）"
    },
    "target_requirements": {
      "location": "石川県能登3市3町（珠洲市、輪島市、能登町、穴水町、七尾市、志賀町）",
      "damage": "令和6年能登半島地震または令和6年9月能登豪雨により直接被害を受けた小規模事業者",
      "certification": "罹災証明書等の公的書類で被害を証明できること",
      "size": "商業・サービス業5人以下、宿泊・娯楽20人以下、製造業等20人以下"
    },
    "eligible_expenses": [
      "機械装置等費",
      "広報費",
      "ウェブサイト関連費",
      "展示会等出展費",
      "旅費",
      "新商品開発費",
      "借料",
      "設備処分費",
      "修繕費",
      "委託・外注費",
      "車両購入費（被災車両がある場合のみ）"
    ],
    "schedule": {
      "guideline_published": "2025年10月28日",
      "application_start": "2026年1月23日（金）",
      "application_deadline": "2026年3月31日（火）17時（電子申請）／当日消印有効（郵送）",
      "support_form_deadline": "2026年3月23日（月）（支援機関確認書発行受付）"
    },
    "application": {
      "method": "郵送申請またはJグランツ電子申請",
      "id_required": "GビズIDプライムアカウント（電子申請時）"
    },
    "business_period": "交付決定日〜2027年5月21日（木）",
    "review_points": ["事業再建への適切性", "被害の程度", "自社分析の妥当性", "計画の有効性", "積算の透明・適切性"],
    "contact": {
      "commercial_chamber": "03-6634-5798",
      "commerce_association": "各地域の商工会",
      "hours": "9:00〜12:00、13:00〜17:00（土日祝除く）"
    },
    "official_site": "https://r6.jizokukahojokin.info/noto/",
    "pdf_source": "https://r6.jizokukahojokin.info/noto/doc/r6_koubover8_noto9.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'JIZOKUKA-NOTO-09';

-- =====================================================
-- 12. JINZAI-IKUSEI: 人材開発支援助成金（人材育成支援コース）
-- スコア: 85 → 95 (既にある程度充実しているため微調整)
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "人材開発支援助成金（人材育成支援コース）",
    "version": "令和7年度（2025年度）通年受付",
    "subsidy_overview": {
      "summary": "事業主が従業員に対して職業訓練（OFF-JT・OJT）を実施した場合に、訓練経費や訓練期間中の賃金の一部を助成。人への投資を促進し、企業の人材力強化と労働者のキャリア形成を支援。",
      "purpose": "労働者の職業能力開発、企業の人材育成促進"
    },
    "subsidy_amount": {
      "off_jt_expense": {
        "sme": "経費助成率45%（賃金要件達成で60%）",
        "large": "経費助成率30%（賃金要件達成で45%）",
        "limit_per_person": "10時間〜100時間未満:15万円、100〜200時間:30万円、200時間〜:50万円"
      },
      "off_jt_wage": {
        "sme": "1人1時間あたり760円（賃金要件達成で960円）",
        "large": "1人1時間あたり380円（賃金要件達成で480円）",
        "limit": "1人あたり1,200時間まで"
      },
      "ojt_wage": {
        "sme": "1人1時間あたり20円",
        "large": "1人1時間あたり11円"
      }
    },
    "target_requirements": {
      "employer": [
        "雇用保険の適用事業所であること",
        "訓練計画を作成し、都道府県労働局に提出していること",
        "計画に沿って職業訓練を実施すること"
      ],
      "training": [
        "訓練時間が10時間以上であること（OFF-JT）",
        "事業主が訓練経費を負担し、訓練期間中の賃金を支払うこと",
        "実訓練時間の8割以上を受講すること"
      ]
    },
    "training_types": [
      "人材育成訓練（OFF-JTのみ）：10時間以上の訓練",
      "認定実習併用職業訓練（OFF-JT+OJT）：厚労大臣の認定を受けた訓練",
      "有期実習型訓練（OFF-JT+OJT）：正社員経験が少ない有期契約労働者向け"
    ],
    "procedure": {
      "step1": "訓練計画を作成し、訓練開始1ヶ月前までに都道府県労働局へ提出",
      "step2": "計画に沿って訓練を実施",
      "step3": "訓練終了後2ヶ月以内に支給申請"
    },
    "schedule": {
      "application_period": "通年受付",
      "submission_deadline": "訓練開始日の1ヶ月前まで（計画届）、訓練終了後2ヶ月以内（支給申請）"
    },
    "contact": {
      "window": "各都道府県労働局またはハローワーク",
      "portal": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html"
    },
    "official_site": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'JINZAI-IKUSEI';

-- =====================================================
-- 13〜17: IT補助金2026系5件（交付規程・公募要領ベース）
-- =====================================================

-- 13. IT-SUBSIDY-2026 (通常枠)
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "デジタル化・AI導入補助金2026（通常枠）",
    "version": "令和8年度（2026年度）",
    "subsidy_overview": {
      "summary": "中小企業・小規模事業者等が生産性向上のためにITツール（ソフトウェア・AI・クラウドサービス等）を単独で導入する費用の一部を補助。働き方改革、賃上げ、インボイス対応等を支援。",
      "purpose": "中小企業のデジタル化・AI導入による生産性向上"
    },
    "subsidy_amount": {
      "process_1_or_more": "5万円以上150万円未満",
      "process_4_or_more": "150万円以上450万円以下",
      "rate": "1/2以内",
      "special_rate": "2/3以内（地域別最低賃金未満の従業員が30%以上の場合）"
    },
    "target_requirements": {
      "basic": "中小企業・小規模事業者等",
      "it_tool": "IT導入支援事業者が登録したITツール（ソフトウェア+関連サービス）",
      "process": "1種類以上の業務プロセスを保有するソフトウェア（汎用プロセスのみは不可）"
    },
    "eligible_expenses": {
      "software": "ソフトウェア購入費・クラウド利用料（最大2年分）",
      "option": "機能拡張・データ連携ツール・セキュリティ",
      "service": "導入コンサル・導入設定・マニュアル作成・研修・保守サポート"
    },
    "schedule": {
      "guideline_status": "交付規程公開済み、公募要領準備中",
      "kit_url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_tsujyo.pdf",
      "koubo_url": "https://it-shien.smrj.go.jp/pdf/it2026_koubo_tsujyo.pdf（準備中）",
      "simulator": "https://it-shien.smrj.go.jp/applicant/subsidy/digitalbase/simulator/?tab=tab1"
    },
    "application": {
      "method": "IT導入支援事業者と連携して電子申請",
      "id_required": "GビズIDプライムアカウント"
    },
    "process_types": ["顧客対応・販売支援", "決済・債権債務・資金回収", "供給・在庫・物流", "会計・財務・経営", "総務・人事・給与・教育訓練・法務・情シス", "統合業務", "業種特化型", "共通プロセス"],
    "contact": {
      "portal": "https://it-shien.smrj.go.jp/",
      "helpdesk": "IT補助金サービスセンター"
    },
    "official_site": "https://it-shien.smrj.go.jp/applicant/subsidy/normal/",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'IT-SUBSIDY-2026';

-- 14. IT-SUBSIDY-2026-INVOICE (インボイス枠・インボイス対応類型)
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "デジタル化・AI導入補助金2026（インボイス枠・インボイス対応類型）",
    "version": "令和8年度（2026年度）",
    "subsidy_overview": {
      "summary": "インボイス制度に対応した会計・受発注・決済等のITツール導入を支援。小規模事業者向けに手厚い補助率を設定。",
      "purpose": "インボイス制度への対応促進、デジタル化による業務効率化"
    },
    "subsidy_amount": {
      "software_under_50": "50万円以下の部分: 3/4以内（小規模）、2/3（その他）",
      "software_50_to_350": "50万円超〜350万円: 2/3以内",
      "hardware_pc": "PC・タブレット等: 最大10万円",
      "hardware_register": "レジ・券売機等: 最大20万円"
    },
    "target_requirements": {
      "basic": "中小企業・小規模事業者等（インボイス発行事業者または予定者）",
      "it_tool": "インボイス対応の会計・受発注・決済ソフト"
    },
    "eligible_expenses": ["インボイス対応ソフトウェア", "クラウド利用料（最大2年分）", "ハードウェア（PC・タブレット・レジ・券売機等）", "導入関連サービス"],
    "schedule": {
      "kit_url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_invoice.pdf",
      "koubo_url": "https://it-shien.smrj.go.jp/pdf/it2026_koubo_invoice.pdf（準備中）"
    },
    "contact": {
      "portal": "https://it-shien.smrj.go.jp/applicant/subsidy/digitalbased_invoice/"
    },
    "official_site": "https://it-shien.smrj.go.jp/applicant/subsidy/digitalbased_invoice/",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'IT-SUBSIDY-2026-INVOICE';

-- 15. IT-SUBSIDY-2026-DENSHI (インボイス枠・電子取引類型)
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "デジタル化・AI導入補助金2026（インボイス枠・電子取引類型）",
    "version": "令和8年度（2026年度）",
    "subsidy_overview": {
      "summary": "インボイス制度に対応した電子取引（EDI・電子受発注等）のITツール導入を支援。取引のデジタル化を推進し、バックオフィス業務の効率化を図る。",
      "purpose": "電子取引の普及促進、インボイス対応のデジタル化"
    },
    "subsidy_amount": {
      "max": "350万円",
      "rate": "2/3以内",
      "note": "大企業は1/2以内"
    },
    "target_requirements": {
      "basic": "中小企業・小規模事業者等",
      "it_tool": "電子取引対応のITツール（EDI・電子受発注システム等）"
    },
    "eligible_expenses": ["電子取引対応ソフトウェア", "クラウド利用料（最大2年分）", "導入関連サービス"],
    "schedule": {
      "kit_url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_denshi.pdf",
      "koubo_url": "https://it-shien.smrj.go.jp/pdf/it2026_koubo_denshi.pdf（準備中）"
    },
    "contact": {
      "portal": "https://it-shien.smrj.go.jp/"
    },
    "official_site": "https://it-shien.smrj.go.jp/",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'IT-SUBSIDY-2026-DENSHI';

-- 16. IT-SUBSIDY-2026-SECURITY (セキュリティ対策推進枠)
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "デジタル化・AI導入補助金2026（セキュリティ対策推進枠）",
    "version": "令和8年度（2026年度）",
    "subsidy_overview": {
      "summary": "IPA公表の「サイバーセキュリティお助け隊サービスリスト」に掲載されているITツールの導入を支援。中小企業のサイバーセキュリティ対策を推進。",
      "purpose": "中小企業のサイバーセキュリティ対策強化"
    },
    "subsidy_amount": {
      "max": "150万円",
      "rate": "1/2以内",
      "service_fee": "サービス利用料（最大2年分）"
    },
    "target_requirements": {
      "basic": "中小企業・小規模事業者等",
      "it_tool": "IPAの「サイバーセキュリティお助け隊サービスリスト」掲載サービス",
      "assessment": "SECURITY ACTION二つ星宣言を実施していること"
    },
    "eligible_expenses": ["セキュリティサービス利用料（最大2年分）"],
    "schedule": {
      "kit_url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_security.pdf",
      "koubo_url": "https://it-shien.smrj.go.jp/pdf/it2026_koubo_security.pdf（準備中）"
    },
    "contact": {
      "portal": "https://it-shien.smrj.go.jp/"
    },
    "official_site": "https://it-shien.smrj.go.jp/",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'IT-SUBSIDY-2026-SECURITY';

-- 17. IT-SUBSIDY-2026-FUKUSU (複数者連携デジタル化・AI導入枠)
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "デジタル化・AI導入補助金2026（複数者連携デジタル化・AI導入枠）",
    "version": "令和8年度（2026年度）",
    "subsidy_overview": {
      "summary": "複数の中小企業・小規模事業者が連携してITツールおよびハードウェアを導入し、デジタル化やAI導入による地域DX・生産性向上を実現する取組を支援。",
      "purpose": "複数事業者連携によるデジタル化・AI導入の推進"
    },
    "subsidy_amount": {
      "software": "補助額5万円〜3,000万円",
      "hardware": "PC等最大10万円、レジ等最大20万円",
      "external_expenses": "最大200万円",
      "rate": "2/3以内（ソフトウェア）、1/2以内（ハードウェア・外部経費）",
      "participants": "商工団体等が幹事者となり10者以上が参加"
    },
    "target_requirements": {
      "basic": "商工団体等を幹事者とし、中小企業10者以上が連携",
      "it_tool": "参加者が共通で使用するITツール",
      "collaboration": "効果的な連携体制の構築"
    },
    "eligible_expenses": ["ソフトウェア・クラウドサービス", "ハードウェア（PC・タブレット・レジ等）", "外注費・コンサル費", "導入関連サービス"],
    "schedule": {
      "kit_url": "https://it-shien.smrj.go.jp/pdf/it2026_kitei_fukusu.pdf",
      "koubo_url": "https://it-shien.smrj.go.jp/pdf/it2026_koubo_fukusu.pdf（準備中）"
    },
    "contact": {
      "portal": "https://it-shien.smrj.go.jp/applicant/subsidy/digitalbased_multiple_companies/"
    },
    "official_site": "https://it-shien.smrj.go.jp/applicant/subsidy/digitalbased_multiple_companies/",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'IT-SUBSIDY-2026-FUKUSU';

-- =====================================================
-- 18. SHORYOKUKA-IPPAN: 中小企業省力化投資補助金（一般型）- 第6回予定の汎用エントリ更新
-- スコア: 80 → 95
-- =====================================================
UPDATE subsidy_cache SET 
  detail_json = json('{
    "title": "中小企業省力化投資補助金（一般型）",
    "version": "第5回公募要領ベース（第6回予定情報含む）",
    "subsidy_overview": {
      "summary": "中小企業等の人手不足解消に向けた省力化投資を支援。IoT・ロボット等の汎用製品だけでなく、個別カスタム設備も対象とする一般型。オーダーメイド設備含む大型省力化投資を支援。",
      "purpose": "中小企業の生産性向上、人手不足対応、賃上げ促進"
    },
    "subsidy_amount": {
      "by_employee_count": {
        "5_or_less": "750万円（大幅賃上げ特例1,000万円）",
        "6_to_20": "1,500万円（大幅賃上げ特例2,000万円）",
        "21_to_50": "3,000万円（大幅賃上げ特例4,000万円）",
        "51_to_100": "5,000万円（大幅賃上げ特例6,500万円）",
        "101_or_more": "8,000万円（大幅賃上げ特例1億円）"
      },
      "rate": {
        "sme": "1/2（大幅賃上げ特例2/3）",
        "micro": "2/3（小規模企業者・再生事業者）"
      }
    },
    "wage_requirements": {
      "basic": "事業計画期間中に1人当たり給与総額を年平均3.5%以上増加",
      "minimum_wage": "事業場内最低賃金が地域最低賃金+30円以上"
    },
    "target_requirements": {
      "basic": "日本国内の中小企業等（業種別の資本金・従業員要件あり）",
      "manufacturing": "資本金3億円以下 or 従業員300人以下",
      "wholesale": "資本金1億円以下 or 従業員100人以下",
      "service": "資本金5,000万円以下 or 従業員100人以下",
      "retail": "資本金5,000万円以下 or 従業員50人以下"
    },
    "eligible_expenses": ["機械装置・システム構築費（必須）", "運搬費", "技術導入費", "知的財産権関連経費", "外注費", "専門家経費", "クラウド利用費"],
    "application": {
      "method": "電子申請（jGrants）のみ",
      "id_required": "GビズIDプライムアカウント必須"
    },
    "schedule": {
      "fifth_round": "公募中",
      "sixth_round": "第6回公募予定あり",
      "business_period": "交付決定日から18ヶ月（採択発表日から20ヶ月）"
    },
    "review_points": ["省力化指数", "投資回収期間", "付加価値成長率", "オーダーメイド設備", "社内体制", "地域経済貢献"],
    "contact": {
      "phone": "0570-099-660",
      "ip_phone": "03-4335-7595",
      "organization": "中小企業省力化投資補助金事務局コールセンター"
    },
    "official_site": "https://shoryokuka.smrj.go.jp/ippan/",
    "pdf_source": "https://shoryokuka.smrj.go.jp/assets/pdf/oubo_manual_ippan_05.pdf",
    "data_updated_at": "2026-02-08"
  }'),
  detail_score = 95,
  wall_chat_ready = 1
WHERE canonical_id = 'SHORYOKUKA-IPPAN';

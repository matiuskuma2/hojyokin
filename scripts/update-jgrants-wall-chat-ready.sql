-- P3-1B: JGrants主要5制度のWALL_CHAT_READY化
-- 対象: 小規模事業者持続化補助金、事業再構築補助金、省力化補助金
-- 目的: 検索上位に出てくるJGrants制度で壁打ちを可能にする

-- 1. 小規模事業者持続化補助金＜一般型 災害支援枠（令和６年能登半島地震等）＞
UPDATE subsidy_cache SET detail_json = json_patch(
  COALESCE(detail_json, '{}'),
  json('{
    "overview": "令和6年能登半島地震による災害の影響を受けた小規模事業者が、地域における持続的な事業活動の拠点の再建や新たな販路開拓等の取組に必要な経費の一部を補助します。",
    "description": "令和6年能登半島地震等の災害の影響を受け、自社の事業用資産に損害を受けた（災害救助法適用地域に所在地がある）小規模事業者に対して、販路開拓等の取組経費を支援します。補助上限200万円、補助率2/3。",
    "application_requirements": ["商工会議所の管轄地域内で事業を営む小規模事業者","令和6年能登半島地震等で被災した事業者","災害救助法適用地域に所在地があること","経営計画を策定していること"],
    "eligible_expenses": ["機械装置等費","広報費","ウェブサイト関連費","展示会等出展費","旅費","開発費","資料購入費","雑役務費","借料","設備処分費","委託・外注費"],
    "required_documents": ["経営計画書","補助事業計画書","事業支援計画書（様式4）","宣誓・同意書","その他確認書類（罹災証明書等）"],
    "required_forms": [
      {"name": "経営計画書兼補助事業計画書", "form_id": "様式2-1", "fields": ["企業概要","経営計画","補助事業計画","経費明細"]},
      {"name": "事業支援計画書", "form_id": "様式4", "fields": ["支援機関名","支援計画内容","経営計画の評価"]}
    ],
    "deadline": "2026年2月28日",
    "issuer_name": "日本商工会議所",
    "category_major": "販路開拓・経営改善",
    "category_minor": "災害復興支援",
    "official_links": {"top": "https://r3.jizokukahojokin.info/"}
  }')
) WHERE id = 'a0WJ200000CDW4SMAX';

-- 2. 小規模事業者持続化補助金＜共同・協業型＞
UPDATE subsidy_cache SET detail_json = json_patch(
  COALESCE(detail_json, '{}'),
  json('{
    "overview": "小規模事業者等が共同で取り組む販路開拓等の取組や、地域の複数の事業者による協業を通じた事業再編等の取組を支援します。",
    "description": "複数の小規模事業者等が連携して販路開拓や業務効率化に取り組む経費を支援。1事業者あたり補助上限50万円（最大500万円）、補助率2/3。地域の事業者が協業することで生まれる相乗効果を期待。",
    "application_requirements": ["小規模事業者等であること","2者以上の共同申請であること","商工会・商工会議所の支援を受けること","共同事業計画を策定していること"],
    "eligible_expenses": ["機械装置等費","広報費","ウェブサイト関連費","展示会等出展費","旅費","開発費","資料購入費","雑役務費","借料","委託・外注費"],
    "required_documents": ["共同事業計画書","各社の経営計画書","事業支援計画書","代表事業者届出書","連携協定書"],
    "required_forms": [
      {"name": "共同事業計画書", "form_id": "様式共-1", "fields": ["参加事業者一覧","共同事業の目的","役割分担","経費配分"]},
      {"name": "連携協定書", "form_id": "様式共-2", "fields": ["連携の目的","各社の役割","費用負担","成果配分"]}
    ],
    "deadline": "2026年3月末予定",
    "issuer_name": "日本商工会議所・全国商工会連合会",
    "category_major": "販路開拓・経営改善",
    "category_minor": "共同・協業",
    "official_links": {"top": "https://r3.jizokukahojokin.info/"}
  }')
) WHERE id = 'a0WJ200000CDWRiMAP';

-- 3. 事業再構築補助金（共同申請_リース会社）
UPDATE subsidy_cache SET detail_json = json_patch(
  COALESCE(detail_json, '{}'),
  json('{
    "overview": "ポストコロナ・ウィズコロナ時代の経済社会の変化に対応するため、新分野展開、業態転換、事業・業種転換、事業再編等の事業再構築を行う中小企業等を支援します。",
    "description": "新型コロナウイルス感染症の影響を受け、事業の抜本的な見直しが必要な中小企業等が、新分野展開、業態転換等に取り組む費用を支援。リース会社との共同申請により、機械装置のリース料も補助対象に。補助上限は類型により異なり最大1.5億円。",
    "application_requirements": ["事業再構築指針に沿った事業計画を策定していること","認定経営革新等支援機関と事業計画を策定していること","付加価値額を年率平均3%以上増加させる計画であること","リース会社との共同申請であること"],
    "eligible_expenses": ["建物費","機械装置・システム構築費（リース含む）","技術導入費","専門家経費","運搬費","クラウドサービス利用費","外注費","知的財産権等関連経費","広告宣伝・販売促進費","研修費"],
    "required_documents": ["事業計画書","認定経営革新等支援機関確認書","決算書","確定申告書","売上高減少を示す書類","リース契約書（案）"],
    "required_forms": [
      {"name": "事業計画書", "form_id": "別紙1", "fields": ["現状認識","事業再構築の必要性","事業再構築の具体的内容","収益計画","付加価値額の算定"]},
      {"name": "認定支援機関確認書", "form_id": "別紙2", "fields": ["支援機関名","確認内容","支援計画"]},
      {"name": "リース契約関係書類", "form_id": "別紙3", "fields": ["リース会社情報","リース対象設備","リース料計算書"]}
    ],
    "deadline": "公募中（詳細は公式サイトを確認）",
    "issuer_name": "中小企業庁",
    "category_major": "事業再構築・転換",
    "category_minor": "新分野展開",
    "official_links": {"top": "https://jigyou-saikouchiku.go.jp/"}
  }')
) WHERE id = 'a0W5h00000UaiqSEAR';

-- 4. 中堅・中小・スタートアップ企業の賃上げに向けた省力化等の大規模成長投資補助金（令和７年度補正）
UPDATE subsidy_cache SET detail_json = json_patch(
  COALESCE(detail_json, '{}'),
  json('{
    "overview": "賃上げを実現するため、大規模な省力化・自動化投資を行う中堅・中小・スタートアップ企業を支援します。",
    "description": "賃上げの原資となる付加価値を創出するため、工場等の拠点新設・増設、大規模な設備投資（50億円超の投資を想定）を行う企業を支援。補助率1/3、補助上限50億円。大企業並みの投資を行う意欲ある中堅企業等を後押し。",
    "application_requirements": ["中堅企業・中小企業・スタートアップであること","大規模な省力化・自動化投資を計画していること","賃上げ計画を策定していること（継続的な賃上げ3%以上/年）","投資額が50億円以上であること"],
    "eligible_expenses": ["建物・構築物の建設費","機械装置・工具器具の購入費","システム構築費（ソフトウェア含む）","外注費","専門家経費","その他経費（消耗品等）"],
    "required_documents": ["事業計画書","賃上げ計画書","財務諸表","投資計画書","資金調達計画書"],
    "required_forms": [
      {"name": "事業計画書", "form_id": "様式1", "fields": ["事業概要","投資計画","生産性向上計画","賃上げ計画","収益計画"]},
      {"name": "賃上げ計画書", "form_id": "様式2", "fields": ["現状の賃金水準","賃上げ目標","実施スケジュール","原資の確保方法"]}
    ],
    "deadline": "2026年度公募予定",
    "issuer_name": "経済産業省",
    "category_major": "設備投資・生産性向上",
    "category_minor": "省力化・自動化",
    "official_links": {"top": "https://seisansei.smrj.go.jp/"}
  }')
) WHERE id = 'a0WJ200000CDWerMAH';

-- 5. 小規模事業者持続化補助金＜創業型＞
UPDATE subsidy_cache SET detail_json = json_patch(
  COALESCE(detail_json, '{}'),
  json('{
    "overview": "創業後間もない小規模事業者等が取り組む販路開拓等の取組を支援し、持続的な事業活動の促進を図ります。",
    "description": "創業後5年以内の小規模事業者を対象に、販路開拓や業務効率化の取組を支援。補助上限200万円、補助率2/3。創業間もない事業者の成長を後押しし、地域経済の活性化に寄与。",
    "application_requirements": ["産業競争力強化法の認定を受けた市区町村の創業支援等事業計画に記載の特定創業支援等事業による支援を受けた事業者","創業後5年以内であること","小規模事業者であること","経営計画を策定していること"],
    "eligible_expenses": ["機械装置等費","広報費","ウェブサイト関連費","展示会等出展費","旅費","開発費","資料購入費","雑役務費","借料","設備処分費","委託・外注費"],
    "required_documents": ["経営計画書","補助事業計画書","事業支援計画書","特定創業支援等事業による支援を受けたことの証明書","開業届"],
    "required_forms": [
      {"name": "経営計画書兼補助事業計画書", "form_id": "様式2-1", "fields": ["企業概要","経営計画","補助事業計画","経費明細"]},
      {"name": "特定創業支援等事業支援証明書", "form_id": "様式5", "fields": ["支援を受けた市区町村名","支援内容","支援期間"]}
    ],
    "deadline": "2026年3月予定",
    "issuer_name": "日本商工会議所",
    "category_major": "創業・起業支援",
    "category_minor": "販路開拓",
    "official_links": {"top": "https://r3.jizokukahojokin.info/"}
  }')
) WHERE id = 'a0WJ200000CDVOnMAP';

-- 確認用クエリ
SELECT id, title, 
  CASE WHEN detail_json IS NOT NULL AND LENGTH(detail_json) > 500 THEN 'READY' ELSE 'NOT_READY' END as wall_chat_status
FROM subsidy_cache 
WHERE id IN (
  'a0WJ200000CDW4SMAX',
  'a0WJ200000CDWRiMAP', 
  'a0W5h00000UaiqSEAR',
  'a0WJ200000CDWerMAH',
  'a0WJ200000CDVOnMAP'
);

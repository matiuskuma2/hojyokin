-- =====================================================
-- ものづくり・商業・サービス生産性向上促進補助金
-- 
-- 情報源:
-- - 公式サイト: https://portal.monodukuri-hojo.jp/
-- - 公募要領ページ: https://portal.monodukuri-hojo.jp/about.html
-- - jGrants API
-- 
-- 事務局: 全国中小企業団体中央会
-- 登録日: 2026-02-05
-- =====================================================

-- =====================================================
-- 1. 製品・サービス高付加価値化枠（通常類型）
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
  'MONODUKURI-KOUFU-TSUJO',
  'manual',
  'ものづくり・商業・サービス生産性向上促進補助金（製品・サービス高付加価値化枠・通常類型）',
  12500000,
  '1/2（小規模事業者・再生事業者は2/3）',
  '全国',
  '全業種',
  '中小企業・小規模事業者等',
  '2025-12-26T17:00:00Z',
  '2026-01-30T17:00:00Z',
  1,
  '{
    "subsidy_overview": "ものづくり・商業・サービス生産性向上促進補助金は、中小企業・小規模事業者等が取り組む革新的サービス開発・試作品開発・生産プロセスの改善を行うための設備投資等を支援する補助金です。製品・サービス高付加価値化枠（通常類型）は、革新的な製品・サービス開発又は生産プロセス・サービス提供方法の改善に必要な設備・システム投資等を支援します。",
    "subsidy_purpose": "中小企業・小規模事業者等の革新的な製品・サービス開発又は生産プロセスの改善による生産性向上",
    "issuer": "経済産業省 中小企業庁",
    "secretariat": "全国中小企業団体中央会",
    "support_center": "ものづくり補助金事務局サポートセンター（050-3821-7013）",
    
    "current_round": {
      "round_number": "22次締切",
      "application_start": "2025-12-26（金）17:00",
      "application_end": "2026-01-30（金）17:00",
      "note": "令和6年度補正予算。補助事業実施期間が短縮（実績報告期限: 2026-12-25）"
    },
    
    "subsidy_amounts": [
      {
        "employee_count": "5人以下",
        "max_amount": 7500000,
        "max_amount_with_raise": 10000000
      },
      {
        "employee_count": "6〜20人",
        "max_amount": 10000000,
        "max_amount_with_raise": 17500000
      },
      {
        "employee_count": "21人以上",
        "max_amount": 12500000,
        "max_amount_with_raise": 25000000
      }
    ],
    
    "subsidy_rates": [
      {
        "condition": "中小企業者",
        "rate": "1/2以内"
      },
      {
        "condition": "小規模事業者・再生事業者",
        "rate": "2/3以内"
      }
    ],
    
    "eligible_expenses": [
      "機械装置・システム構築費",
      "技術導入費",
      "専門家経費",
      "運搬費",
      "クラウドサービス利用費",
      "原材料費",
      "外注費",
      "知的財産権等関連経費"
    ],
    
    "basic_requirements": [
      "事業計画期間において、給与支給総額を年率平均1.5%以上増加",
      "事業計画期間において、事業場内最低賃金を地域別最低賃金+30円以上の水準にする",
      "事業計画期間において、付加価値額を年率平均3%以上増加",
      "従業員の仕事・子育て両立要件（一般事業主行動計画の策定・公表）"
    ],
    
    "application_method": "電子申請（jGrants）",
    "gbizid_required": true,
    
    "official_urls": {
      "main": "https://portal.monodukuri-hojo.jp/",
      "guidelines": "https://portal.monodukuri-hojo.jp/about.html",
      "faq": "https://portal.monodukuri-hojo.jp/faq.html"
    },
    
    "notes": [
      "22次締切は補助事業実施期間が短縮されている（実績報告期限: 2026-12-25）",
      "申請締切日前10か月以内に同一事業の交付決定を受けた事業者は申請不可",
      "GビズIDプライムアカウントの事前取得が必要"
    ]
  }',
  datetime('now'),
  datetime('now', '+90 days'),
  1,
  NULL,
  90,
  1,
  1
);

-- =====================================================
-- 2. 製品・サービス高付加価値化枠（成長分野進出類型・DX・GX）
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
  'MONODUKURI-KOUFU-SEICHOU',
  'manual',
  'ものづくり・商業・サービス生産性向上促進補助金（製品・サービス高付加価値化枠・成長分野進出類型）',
  25000000,
  '2/3',
  '全国',
  '全業種',
  '中小企業・小規模事業者等',
  '2025-12-26T17:00:00Z',
  '2026-01-30T17:00:00Z',
  1,
  '{
    "subsidy_overview": "成長分野進出類型（DX・GX）は、今後成長が見込まれるDX（デジタルトランスフォーメーション）やGX（グリーントランスフォーメーション）に資する革新的な製品・サービス開発又は生産プロセスの改善に必要な設備・システム投資等を支援します。",
    "subsidy_purpose": "DX・GX分野への進出による中小企業の成長支援",
    "issuer": "経済産業省 中小企業庁",
    "secretariat": "全国中小企業団体中央会",
    
    "current_round": {
      "round_number": "22次締切",
      "application_start": "2025-12-26（金）17:00",
      "application_end": "2026-01-30（金）17:00"
    },
    
    "subsidy_amounts": [
      {
        "employee_count": "5人以下",
        "max_amount": 10000000,
        "max_amount_with_raise": 15000000
      },
      {
        "employee_count": "6〜20人",
        "max_amount": 15000000,
        "max_amount_with_raise": 25000000
      },
      {
        "employee_count": "21人以上",
        "max_amount": 25000000,
        "max_amount_with_raise": 40000000
      }
    ],
    
    "subsidy_rates": [
      {
        "condition": "全ての事業者",
        "rate": "2/3以内"
      }
    ],
    
    "type_requirements": {
      "DX": "DXに資する革新的な製品・サービスの開発であること（AI、IoT、ロボット等のデジタル技術活用）",
      "GX": "GXに資する革新的な製品・サービスの開発であること（温室効果ガス排出削減、省エネ、再エネ等）"
    },
    
    "official_urls": {
      "main": "https://portal.monodukuri-hojo.jp/",
      "guidelines": "https://portal.monodukuri-hojo.jp/about.html"
    }
  }',
  datetime('now'),
  datetime('now', '+90 days'),
  1,
  NULL,
  90,
  1,
  1
);

-- =====================================================
-- 3. グローバル枠
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
  'MONODUKURI-GLOBAL',
  'manual',
  'ものづくり・商業・サービス生産性向上促進補助金（グローバル枠）',
  40000000,
  '1/2（小規模事業者・再生事業者は2/3）',
  '全国',
  '全業種',
  '中小企業・小規模事業者等',
  '2025-12-26T17:00:00Z',
  '2026-01-30T17:00:00Z',
  1,
  '{
    "subsidy_overview": "グローバル枠は、海外事業の拡大・強化等を目的とした設備投資等を支援します。海外への直接投資に関する事業、海外市場開拓（JAPANブランド）に関する事業、インバウンド市場開拓に関する事業、海外事業者との共同事業に関する事業が対象です。",
    "subsidy_purpose": "海外展開やインバウンド需要の取り込みによる中小企業の成長支援",
    "issuer": "経済産業省 中小企業庁",
    "secretariat": "全国中小企業団体中央会",
    
    "current_round": {
      "round_number": "22次締切",
      "application_start": "2025-12-26（金）17:00",
      "application_end": "2026-01-30（金）17:00"
    },
    
    "subsidy_amounts": [
      {
        "type": "グローバル枠",
        "max_amount": 40000000,
        "max_amount_with_raise": 50000000
      }
    ],
    
    "subsidy_rates": [
      {
        "condition": "中小企業者",
        "rate": "1/2以内"
      },
      {
        "condition": "小規模事業者・再生事業者",
        "rate": "2/3以内"
      }
    ],
    
    "types": [
      {
        "name": "①海外直接投資",
        "description": "国内に所在する本社を補助事業者として、国内で製造等した製品の海外工場を設けて生産を行う事業"
      },
      {
        "name": "②海外市場開拓（JAPANブランド）",
        "description": "国内に所在する本社を補助事業者として、国内で製造等した製品等の海外展開を行うための事業"
      },
      {
        "name": "③インバウンド市場開拓",
        "description": "国内に所在する本社を補助事業者として、インバウンド需要を取り込むための設備投資等を行う事業"
      },
      {
        "name": "④海外事業者との共同事業",
        "description": "海外の事業者と共同で、製品開発、生産性向上、新市場開拓等を行う事業"
      }
    ],
    
    "additional_expenses": [
      "海外旅費",
      "通訳・翻訳費",
      "広告宣伝・販売促進費（②海外市場開拓のみ）"
    ],
    
    "official_urls": {
      "main": "https://portal.monodukuri-hojo.jp/",
      "guidelines": "https://portal.monodukuri-hojo.jp/about.html"
    }
  }',
  datetime('now'),
  datetime('now', '+90 days'),
  1,
  NULL,
  90,
  1,
  1
);

-- =====================================================
-- subsidy_feed_items にも登録（フィード表示用）
-- =====================================================
INSERT OR REPLACE INTO subsidy_feed_items (
  id,
  dedupe_key,
  content_hash,
  source_id,
  source_type,
  title,
  summary,
  url,
  detail_url,
  issuer_name,
  prefecture_code,
  target_area_codes,
  subsidy_amount_max,
  subsidy_rate_text,
  status,
  event_type,
  priority,
  published_at,
  first_seen_at,
  last_seen_at,
  expires_at,
  created_at,
  updated_at,
  is_new
) VALUES 
-- 通常類型
(
  'MONODUKURI-KOUFU-TSUJO',
  'monodukuri-koufu-tsujo-2026',
  'manual-monodukuri-tsujo-v1',
  'manual',
  'platform',
  'ものづくり・商業・サービス生産性向上促進補助金（製品・サービス高付加価値化枠・通常類型）',
  '革新的な製品・サービス開発又は生産プロセス・サービス提供方法の改善に必要な設備・システム投資等を支援。補助上限750万〜1,250万円（従業員規模別）、補助率1/2（小規模・再生事業者は2/3）。22次締切の申請期間は2025/12/26〜2026/1/30。',
  'https://portal.monodukuri-hojo.jp/',
  'https://portal.monodukuri-hojo.jp/about.html',
  '経済産業省 中小企業庁',
  NULL,
  '["00"]',
  12500000,
  '1/2（小規模・再生事業者は2/3）',
  'open',
  'info',
  90,
  datetime('now'),
  datetime('now'),
  datetime('now'),
  '2026-01-30T17:00:00Z',
  datetime('now'),
  datetime('now'),
  1
),
-- 成長分野進出類型
(
  'MONODUKURI-KOUFU-SEICHOU',
  'monodukuri-koufu-seichou-2026',
  'manual-monodukuri-seichou-v1',
  'manual',
  'platform',
  'ものづくり・商業・サービス生産性向上促進補助金（製品・サービス高付加価値化枠・成長分野進出類型）',
  'DX・GXに資する革新的な製品・サービス開発を支援。補助上限1,000万〜2,500万円（従業員規模別）、補助率2/3。AI、IoT、ロボット等のデジタル技術活用や温室効果ガス排出削減等の取組が対象。22次締切の申請期間は2025/12/26〜2026/1/30。',
  'https://portal.monodukuri-hojo.jp/',
  'https://portal.monodukuri-hojo.jp/about.html',
  '経済産業省 中小企業庁',
  NULL,
  '["00"]',
  25000000,
  '2/3',
  'open',
  'info',
  90,
  datetime('now'),
  datetime('now'),
  datetime('now'),
  '2026-01-30T17:00:00Z',
  datetime('now'),
  datetime('now'),
  1
),
-- グローバル枠
(
  'MONODUKURI-GLOBAL',
  'monodukuri-global-2026',
  'manual-monodukuri-global-v1',
  'manual',
  'platform',
  'ものづくり・商業・サービス生産性向上促進補助金（グローバル枠）',
  '海外事業の拡大・強化を目的とした設備投資等を支援。補助上限4,000万円、補助率1/2（小規模・再生事業者は2/3）。海外直接投資、海外市場開拓（JAPANブランド）、インバウンド市場開拓、海外事業者との共同事業が対象。22次締切の申請期間は2025/12/26〜2026/1/30。',
  'https://portal.monodukuri-hojo.jp/',
  'https://portal.monodukuri-hojo.jp/about.html',
  '経済産業省 中小企業庁',
  NULL,
  '["00"]',
  40000000,
  '1/2（小規模・再生事業者は2/3）',
  'open',
  'info',
  90,
  datetime('now'),
  datetime('now'),
  datetime('now'),
  '2026-01-30T17:00:00Z',
  datetime('now'),
  datetime('now'),
  1
);

-- =====================================================
-- 監視設定（公式サイト・公募要領ページ）
-- =====================================================
INSERT OR REPLACE INTO data_source_monitors (
  id,
  subsidy_canonical_id,
  subsidy_cache_id,
  source_name,
  source_url,
  monitor_type,
  check_interval_hours,
  last_checked_at,
  last_content_hash,
  status,
  notes,
  created_at,
  updated_at
) VALUES (
  'MONITOR-MONODUKURI',
  'MONODUKURI-KOUFU-TSUJO',
  'MONODUKURI-KOUFU-TSUJO',
  'ものづくり補助金総合サイト 公募要領ページ',
  'https://portal.monodukuri-hojo.jp/about.html',
  'webpage',
  168,
  NULL,
  NULL,
  'active',
  '関連補助金: MONODUKURI-KOUFU-TSUJO, MONODUKURI-KOUFU-SEICHOU, MONODUKURI-GLOBAL。監視キーワード: 公募, 締切, 申請, 公募要領',
  datetime('now'),
  datetime('now')
);

-- =====================================================
-- subsidy_canonical にも登録（正規化データ）
-- =====================================================
INSERT OR REPLACE INTO subsidy_canonical (
  id,
  name,
  issuer_name,
  prefecture_code,
  is_active,
  notes,
  created_at,
  updated_at
) VALUES 
(
  'MONODUKURI-KOUFU-TSUJO',
  'ものづくり・商業・サービス生産性向上促進補助金（製品・サービス高付加価値化枠・通常類型）',
  '経済産業省 中小企業庁',
  '00',
  1,
  '補助上限750万〜1,250万円、補助率1/2（小規模・再生事業者は2/3）、22次締切、wall_chat_ready',
  datetime('now'),
  datetime('now')
),
(
  'MONODUKURI-KOUFU-SEICHOU',
  'ものづくり・商業・サービス生産性向上促進補助金（製品・サービス高付加価値化枠・成長分野進出類型）',
  '経済産業省 中小企業庁',
  '00',
  1,
  '補助上限1,000万〜2,500万円、補助率2/3、22次締切、DX/GX対象、wall_chat_ready',
  datetime('now'),
  datetime('now')
),
(
  'MONODUKURI-GLOBAL',
  'ものづくり・商業・サービス生産性向上促進補助金（グローバル枠）',
  '経済産業省 中小企業庁',
  '00',
  1,
  '補助上限4,000万円、補助率1/2（小規模・再生事業者は2/3）、22次締切、海外展開対象、wall_chat_ready',
  datetime('now'),
  datetime('now')
);

-- =====================================================
-- Phase K2: Lifecycle + Required Docs system
-- 目的：開始/終了/予算枯渇/更新頻度の管理 ＋ 必要書類の体系化
-- =====================================================

-- 1) 補助金ライフサイクル（状態・次回チェック）
CREATE TABLE IF NOT EXISTS subsidy_lifecycle (
  subsidy_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN (
      'scheduled',         -- 予告
      'open',              -- 受付中
      'closing_soon',      -- 期限間近
      'closed_by_deadline',-- 期限終了
      'closed_by_budget',  -- 予算枯渇/早期終了
      'suspended',         -- 中断
      'unknown'            -- 不明（要レビュー）
    )),
  open_at TEXT NULL,       -- ISO8601 or yyyy-mm-dd
  close_at TEXT NULL,      -- ISO8601 or yyyy-mm-dd
  close_reason TEXT NULL   -- deadline / budget / suspended / unknown
    CHECK (close_reason IS NULL OR close_reason IN ('deadline','budget','suspended','unknown')),
  budget_close_evidence_url TEXT NULL,     -- 予算枯渇の根拠URL
  budget_close_evidence_quote TEXT NULL,   -- 短い引用（10〜50字推奨）
  last_checked_at TEXT NULL,               -- 最後に状態判定した時刻
  next_check_at TEXT NULL,                 -- 次回チェック予定（Cron/Queueの起点）
  check_frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (check_frequency IN ('hourly','daily','weekly','monthly')),
  priority INTEGER NOT NULL DEFAULT 3       -- 1（最重要）〜5（低）
    CHECK (priority >= 1 AND priority <= 5),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subsidy_lifecycle_next_check ON subsidy_lifecycle(next_check_at);
CREATE INDEX IF NOT EXISTS idx_subsidy_lifecycle_status ON subsidy_lifecycle(status);
CREATE INDEX IF NOT EXISTS idx_subsidy_lifecycle_priority ON subsidy_lifecycle(priority);

-- 2) 必要書類マスター（制度横断の共通カテゴリ）
CREATE TABLE IF NOT EXISTS required_documents_master (
  doc_code TEXT PRIMARY KEY,            -- 例: gbizid_prime / financials_2y / estimate / plan / wage_ledger ...
  name TEXT NOT NULL,                   -- 表示名
  phase TEXT NOT NULL                   -- account / company / financial / plan / cost / compliance / other
    CHECK (phase IN ('account','company','financial','plan','cost','compliance','other')),
  default_required_level TEXT NOT NULL DEFAULT 'conditional'
    CHECK (default_required_level IN ('mandatory','conditional','optional')),
  description TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 最低限のマスター初期データ（抜け漏れ防止の核）
INSERT OR IGNORE INTO required_documents_master (doc_code, name, phase, default_required_level, description, sort_order) VALUES
-- account phase
('gbizid_prime', 'GビズIDプライム', 'account', 'mandatory', '電子申請（JGrants等）で必須になることが多い', 10),
('jgrants_account', 'JGrantsアカウント/申請者情報', 'account', 'conditional', '制度によって必要', 11),

-- company phase
('corp_registry', '履歴事項全部証明書', 'company', 'conditional', '法人の場合（発行から3ヶ月以内等）', 20),
('business_start_notice', '開業届', 'company', 'conditional', '個人事業主の場合', 21),
('articles_of_incorporation', '定款', 'company', 'optional', '法人の場合、目的確認用', 22),

-- financial phase
('financials_2y', '決算書（直近2期）', 'financial', 'conditional', '多くの補助金で必要（貸借対照表・損益計算書）', 30),
('financials_1y', '決算書（直近1期）', 'financial', 'conditional', '創業間もない場合', 31),
('wage_ledger', '賃金台帳', 'financial', 'conditional', '賃上げ要件が絡む場合', 32),
('employment_contracts', '雇用契約書/雇用条件通知書', 'financial', 'conditional', '賃上げ要件が絡む場合', 33),
('min_wage_evidence', '最低賃金関連証明', 'financial', 'conditional', '助成金系で要求されることあり', 34),

-- plan phase
('business_plan', '事業計画書', 'plan', 'mandatory', '審査の核となる書類', 40),
('revenue_plan', '収支計画/付加価値計画', 'plan', 'conditional', '制度により要求（3〜5年計画）', 41),
('implementation_structure', '実施体制図', 'plan', 'optional', '責任者、外注先などの体制', 42),

-- cost phase
('quotes', '見積書（内訳/相見積）', 'cost', 'conditional', '交付申請で厳格化傾向、50万円以上で相見積必須等', 50),
('spec_sheet', '仕様書/型番/導入計画', 'cost', 'conditional', '設備・IT導入で必要', 51),
('contract_draft', '契約書ドラフト', 'cost', 'optional', '必要に応じて', 52),
('catalog', 'カタログ/パンフレット', 'cost', 'optional', '導入設備・ツールの説明資料', 53),

-- compliance phase
('tax_certificate', '納税証明/税の滞納なし証明', 'compliance', 'conditional', '制度により要求', 60),
('anti_social_check', '反社排除の誓約等', 'compliance', 'conditional', '制度により要求', 61),
('security_action', 'SECURITY ACTION', 'compliance', 'optional', 'IT導入などで要件/加点（二つ星）', 62),
('mira_digi_check', 'みらデジ経営チェック', 'compliance', 'optional', 'IT導入などで要件/加点', 63),
('partner_declaration', 'パートナーシップ構築宣言', 'compliance', 'optional', '加点になり得る', 64),
('health_management', '健康経営優良法人認定', 'compliance', 'optional', '加点になり得る', 65),
('sdgs_declaration', 'SDGs宣言', 'compliance', 'optional', '加点になり得る', 66),

-- other phase
('support_institution_letter', '認定支援機関の確認書', 'other', 'conditional', '制度により必須（ものづくり等）', 70),
('bank_account', '振込先口座情報/通帳コピー', 'other', 'conditional', '交付決定後に必要', 71),
('power_of_attorney', '委任状', 'other', 'optional', '代理申請の場合', 72),
('joint_application_docs', '共同申請関連書類', 'other', 'optional', 'リース等の共同申請時', 73);

-- 3) 制度ごとの必要書類（上書き）
CREATE TABLE IF NOT EXISTS required_documents_by_subsidy (
  id TEXT PRIMARY KEY,                  -- uuid
  subsidy_id TEXT NOT NULL,
  doc_code TEXT NOT NULL,
  required_level TEXT NOT NULL
    CHECK (required_level IN ('mandatory','conditional','optional')),
  notes TEXT NULL,                      -- 制度固有の注意事項
  source_url TEXT NULL,                 -- 根拠リンク（監修用）
  source_quote TEXT NULL,               -- 根拠の短い引用
  confidence REAL NOT NULL DEFAULT 0.5, -- 抽出の確信度
  needs_review INTEGER NOT NULL DEFAULT 0, -- 要レビュー
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subsidy_id, doc_code),
  FOREIGN KEY (doc_code) REFERENCES required_documents_master(doc_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_req_docs_by_subsidy_subsidy ON required_documents_by_subsidy(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_req_docs_by_subsidy_review ON required_documents_by_subsidy(needs_review);

-- 4) 状態更新履歴（事故防止・差分追跡）
CREATE TABLE IF NOT EXISTS subsidy_status_history (
  id TEXT PRIMARY KEY,                  -- uuid
  subsidy_id TEXT NOT NULL,
  prev_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NULL,                     -- deadline/budget/suspended/unknown
  evidence_url TEXT NULL,
  evidence_quote TEXT NULL,
  changed_by TEXT NULL,                 -- system / manual / cron
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_status_history_subsidy ON subsidy_status_history(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON subsidy_status_history(changed_at);

-- 5) クロール対象台帳（source_registry）
-- どの制度/地域/ドメインを、どの戦略・頻度でクロールするか
CREATE TABLE IF NOT EXISTS source_registry (
  registry_id TEXT PRIMARY KEY,         -- uuid
  scope TEXT NOT NULL                   -- national / secretariat / prefecture / city
    CHECK (scope IN ('national','secretariat','prefecture','city')),
  geo_id TEXT NULL,                     -- geo_region.geo_id への参照（都道府県/市）
  program_key TEXT NULL,                -- 例: it-hojo / monodukuri / jgrants / mhlw-joseikin
  root_url TEXT NOT NULL,               -- 起点URL
  domain_key TEXT NULL,                 -- domain_policy.domain_key
  crawl_strategy TEXT NOT NULL DEFAULT 'scrape'
    CHECK (crawl_strategy IN ('scrape','crawl','map')),
  max_depth INTEGER NOT NULL DEFAULT 1
    CHECK (max_depth >= 0 AND max_depth <= 3),
  target_types TEXT NULL,               -- JSON配列: ["pdf","faq","example","guideline","case_study"]
  keyword_filter TEXT NULL,             -- JSON配列: ["公募要領","FAQ","記入例"]
  update_freq TEXT NOT NULL DEFAULT 'weekly'
    CHECK (update_freq IN ('daily','weekly','monthly')),
  enabled INTEGER NOT NULL DEFAULT 1,
  robots_required INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 3
    CHECK (priority >= 1 AND priority <= 5),
  notes TEXT NULL,
  last_crawled_at TEXT NULL,
  next_crawl_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (geo_id) REFERENCES geo_region(geo_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_registry_scope ON source_registry(scope);
CREATE INDEX IF NOT EXISTS idx_source_registry_geo ON source_registry(geo_id);
CREATE INDEX IF NOT EXISTS idx_source_registry_next ON source_registry(next_crawl_at);
CREATE INDEX IF NOT EXISTS idx_source_registry_enabled ON source_registry(enabled);

-- 6) 初期台帳データ（主要事務局・省庁）
INSERT OR IGNORE INTO source_registry (registry_id, scope, program_key, root_url, domain_key, crawl_strategy, max_depth, target_types, update_freq, priority, notes) VALUES
-- 国・省庁（go.jp）
('reg-meti-chusho', 'national', 'chusho', 'https://www.chusho.meti.go.jp/keiei/sapoin/', 'chusho.meti.go.jp', 'crawl', 2, '["guideline","faq","pdf"]', 'weekly', 2, '中小企業庁 補助金ポータル'),
('reg-mhlw-joseikin', 'national', 'mhlw-joseikin', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/', 'mhlw.go.jp', 'crawl', 2, '["guideline","faq","pdf"]', 'weekly', 2, '厚労省 雇用関係助成金'),
('reg-maff-hojo', 'national', 'maff', 'https://www.maff.go.jp/j/supply/hozyo/', 'maff.go.jp', 'crawl', 1, '["guideline","pdf"]', 'monthly', 3, '農水省 補助金'),

-- 主要事務局サイト（大型制度）
('reg-it-hojo', 'secretariat', 'it-hojo', 'https://www.it-hojo.jp/', 'it-hojo.jp', 'crawl', 2, '["guideline","faq","example","pdf"]', 'daily', 1, 'IT導入補助金 事務局'),
('reg-mono-hojo', 'secretariat', 'monodukuri', 'https://portal.monodukuri-hojo.jp/', 'portal.monodukuri-hojo.jp', 'crawl', 2, '["guideline","faq","example","pdf"]', 'daily', 1, 'ものづくり補助金 事務局'),
('reg-jizoku-hojo', 'secretariat', 'jizokuka', 'https://s23.jizokuka-hojo.jp/', 's23.jizokuka-hojo.jp', 'crawl', 2, '["guideline","faq","example","pdf"]', 'daily', 1, '持続化補助金 事務局'),
('reg-saikouchiku', 'secretariat', 'saikouchiku', 'https://jigyou-saikouchiku.go.jp/', 'jigyou-saikouchiku.go.jp', 'crawl', 2, '["guideline","faq","example","pdf"]', 'daily', 1, '事業再構築補助金 事務局'),
('reg-shoukibo', 'secretariat', 'shoukibo', 'https://seido-navi.mirasapo-plus.go.jp/', 'seido-navi.mirasapo-plus.go.jp', 'crawl', 1, '["guideline","faq"]', 'weekly', 2, 'ミラサポplus（制度ナビ）'),

-- JGrants本体
('reg-jgrants', 'national', 'jgrants', 'https://www.jgrants-portal.go.jp/', 'jgrants-portal.go.jp', 'scrape', 0, '["portal"]', 'daily', 1, 'JGrants ポータル');

-- 7) Budget close signals パターン（検知用マスター）
CREATE TABLE IF NOT EXISTS budget_close_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL            -- regex / keyword / phrase
    CHECK (pattern_type IN ('regex','keyword','phrase')),
  pattern_value TEXT NOT NULL,
  signal_type TEXT NOT NULL             -- budget_cap_reached / quota_reached / first_come_end / early_close
    CHECK (signal_type IN ('budget_cap_reached','quota_reached','first_come_end','early_close')),
  confidence REAL NOT NULL DEFAULT 0.8,
  notes TEXT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO budget_close_patterns (pattern_id, pattern_type, pattern_value, signal_type, confidence, notes) VALUES
('bcp-01', 'phrase', '予算上限に達し次第終了', 'budget_cap_reached', 0.9, '明確な予算枯渇予告'),
('bcp-02', 'phrase', '予算がなくなり次第終了', 'budget_cap_reached', 0.9, '予算枯渇予告'),
('bcp-03', 'phrase', '予定件数に達し次第終了', 'quota_reached', 0.9, '件数上限予告'),
('bcp-04', 'phrase', '先着順', 'first_come_end', 0.7, '先着制（終了リスク高）'),
('bcp-05', 'phrase', '予算上限に達したため受付終了', 'budget_cap_reached', 1.0, '予算枯渇確定'),
('bcp-06', 'phrase', '予定件数に達したため受付終了', 'quota_reached', 1.0, '件数上限確定'),
('bcp-07', 'phrase', '募集を停止します', 'early_close', 0.85, '早期終了'),
('bcp-08', 'phrase', '受付を終了しました', 'early_close', 0.8, '終了（理由は別途確認）'),
('bcp-09', 'keyword', '予算消化', 'budget_cap_reached', 0.7, '予算消化の言及'),
('bcp-10', 'keyword', '採択上限', 'quota_reached', 0.7, '採択上限の言及');

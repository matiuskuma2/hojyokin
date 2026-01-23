-- =====================================================
-- Migration: 0028_crawler_mapping.sql
-- Purpose: クローラーマッピング設計 - 自治体サイト構造定義
-- Date: 2026-01-23
-- =====================================================
--
-- 設計背景:
-- - 各自治体サイトは構造が異なる
-- - セレクタベースのマッピング定義で柔軟に対応
-- - 差分検知用のハッシュ管理
--
-- =====================================================

-- =====================================================
-- 1. source_mappings: サイト構造マッピング
-- =====================================================
-- source_registry と1:1で紐付く詳細設定
CREATE TABLE IF NOT EXISTS source_mappings (
  id TEXT PRIMARY KEY,
  source_registry_id TEXT NOT NULL UNIQUE,  -- source_registry.registry_id
  
  -- 一覧ページ設定
  list_url TEXT NOT NULL,                   -- 一覧ページURL（テンプレート可）
  list_selector TEXT NOT NULL,              -- 補助金リンクのCSSセレクタ
  list_title_selector TEXT,                 -- 一覧でのタイトルセレクタ
  list_date_selector TEXT,                  -- 一覧での日付セレクタ
  
  -- ページネーション
  pagination_type TEXT DEFAULT 'none'       -- none / page / scroll / api / next_link
    CHECK (pagination_type IN ('none', 'page', 'scroll', 'api', 'next_link')),
  pagination_selector TEXT,                 -- ページネーションセレクタ
  pagination_param TEXT,                    -- APIの場合のページパラメータ名
  max_pages INTEGER DEFAULT 10,             -- 最大ページ数
  
  -- 詳細ページ設定
  detail_url_pattern TEXT,                  -- 詳細ページURLパターン（glob形式）
  title_selector TEXT,                      -- タイトル抽出セレクタ
  deadline_selector TEXT,                   -- 締切日抽出セレクタ
  deadline_format TEXT,                     -- 日付フォーマット（例: YYYY年M月D日）
  amount_selector TEXT,                     -- 補助金額セレクタ
  rate_selector TEXT,                       -- 補助率セレクタ
  description_selector TEXT,                -- 説明文セレクタ
  requirements_selector TEXT,               -- 対象要件セレクタ
  
  -- PDF/添付ファイル
  pdf_link_selector TEXT,                   -- PDFリンクセレクタ
  pdf_keywords TEXT,                        -- 優先取得キーワード（カンマ区切り）
  attachment_selector TEXT,                 -- その他添付ファイルセレクタ
  
  -- 変更検知
  hash_target TEXT DEFAULT 'main'           -- body / main / custom
    CHECK (hash_target IN ('body', 'main', 'custom')),
  hash_selector TEXT,                       -- カスタムハッシュ対象セレクタ
  
  -- 特殊対応
  requires_js INTEGER DEFAULT 0,            -- JavaScript実行が必要
  wait_selector TEXT,                       -- JSレンダリング待機セレクタ
  wait_timeout INTEGER DEFAULT 5000,        -- 待機タイムアウト（ms）
  custom_headers TEXT,                      -- カスタムヘッダー（JSON）
  
  -- メタデータ
  verified_at TEXT,                         -- 最終検証日時
  verified_by TEXT,                         -- 検証者（user_id or 'system'）
  notes TEXT,                               -- メモ
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(registry_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_mappings_registry ON source_mappings(source_registry_id);

-- =====================================================
-- 2. crawl_results: クロール結果（差分検知用）
-- =====================================================
CREATE TABLE IF NOT EXISTS crawl_results (
  id TEXT PRIMARY KEY,
  source_registry_id TEXT NOT NULL,
  url TEXT NOT NULL,
  
  -- ページ情報
  page_type TEXT NOT NULL                   -- list / detail / pdf
    CHECK (page_type IN ('list', 'detail', 'pdf')),
  
  -- 取得結果
  status_code INTEGER,
  content_hash TEXT,                        -- ページ内容のハッシュ
  content_length INTEGER,
  
  -- 抽出データ（JSONで保存）
  extracted_data TEXT,                      -- 抽出した構造化データ
  extracted_links TEXT,                     -- 抽出したリンク一覧（JSON配列）
  extracted_pdfs TEXT,                      -- 抽出したPDF一覧（JSON配列）
  
  -- 差分情報
  is_changed INTEGER DEFAULT 0,             -- 前回から変更あり
  change_summary TEXT,                      -- 変更の要約
  
  -- 処理状態
  crawled_at TEXT NOT NULL DEFAULT (datetime('now')),
  processing_time_ms INTEGER,
  error_message TEXT,
  
  FOREIGN KEY (source_registry_id) REFERENCES source_registry(registry_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawl_results_source ON crawl_results(source_registry_id);
CREATE INDEX IF NOT EXISTS idx_crawl_results_url ON crawl_results(url);
CREATE INDEX IF NOT EXISTS idx_crawl_results_crawled ON crawl_results(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_results_changed ON crawl_results(is_changed);

-- URL+source でユニーク（最新1件のみ保持の場合）
-- ただし履歴を残す場合はコメントアウト
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_results_unique ON crawl_results(source_registry_id, url);

-- =====================================================
-- 3. 検索フィルター用マスタ
-- =====================================================

-- 3.1 発行機関マスタ
CREATE TABLE IF NOT EXISTS issuer_master (
  id TEXT PRIMARY KEY,                      -- ministry-mhlw, pref-13, org-nedo
  issuer_type TEXT NOT NULL                 -- ministry / prefecture / municipal / organization
    CHECK (issuer_type IN ('ministry', 'prefecture', 'municipal', 'organization')),
  
  name TEXT NOT NULL,                       -- 表示名
  name_short TEXT,                          -- 略称
  name_kana TEXT,                           -- 読み仮名
  
  -- 地域情報（都道府県・市区町村の場合）
  region_code TEXT,                         -- 都道府県コード（01-47）
  city_code TEXT,                           -- 市区町村コード
  
  -- 親子関係
  parent_id TEXT,                           -- 親発行機関（例: 省庁→庁）
  
  -- 統計
  subsidy_count INTEGER DEFAULT 0,          -- 紐付く補助金数
  
  sort_order INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (parent_id) REFERENCES issuer_master(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_issuer_master_type ON issuer_master(issuer_type);
CREATE INDEX IF NOT EXISTS idx_issuer_master_region ON issuer_master(region_code);
CREATE INDEX IF NOT EXISTS idx_issuer_master_parent ON issuer_master(parent_id);

-- 3.2 カテゴリマスタ（大分類・小分類）
CREATE TABLE IF NOT EXISTS category_master (
  id TEXT PRIMARY KEY,                      -- cat-employment, cat-employment-recruitment
  
  category_type TEXT NOT NULL               -- major / minor
    CHECK (category_type IN ('major', 'minor')),
  
  name TEXT NOT NULL,                       -- 表示名
  name_en TEXT,                             -- 英語名
  
  parent_id TEXT,                           -- 親カテゴリ（minor の場合）
  
  -- 検索用キーワード
  keywords TEXT,                            -- 関連キーワード（カンマ区切り）
  
  -- 統計
  subsidy_count INTEGER DEFAULT 0,
  
  sort_order INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (parent_id) REFERENCES category_master(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_category_master_type ON category_master(category_type);
CREATE INDEX IF NOT EXISTS idx_category_master_parent ON category_master(parent_id);

-- 3.3 業種マスタ（総務省分類準拠）
CREATE TABLE IF NOT EXISTS industry_master (
  id TEXT PRIMARY KEY,                      -- ind-info-comm, ind-manufacturing
  code TEXT UNIQUE,                         -- 総務省業種コード
  
  name TEXT NOT NULL,
  name_short TEXT,
  
  parent_id TEXT,                           -- 大分類→中分類
  
  sort_order INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (parent_id) REFERENCES industry_master(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_industry_master_code ON industry_master(code);
CREATE INDEX IF NOT EXISTS idx_industry_master_parent ON industry_master(parent_id);

-- =====================================================
-- 4. 補助金と各マスタの紐付け
-- =====================================================

-- 4.1 補助金×発行機関
CREATE TABLE IF NOT EXISTS subsidy_issuers (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  
  is_primary INTEGER DEFAULT 0,             -- 主たる発行機関
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  UNIQUE(subsidy_id, issuer_id),
  FOREIGN KEY (issuer_id) REFERENCES issuer_master(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subsidy_issuers_subsidy ON subsidy_issuers(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_issuers_issuer ON subsidy_issuers(issuer_id);

-- 4.2 補助金×カテゴリ
CREATE TABLE IF NOT EXISTS subsidy_categories (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  
  confidence REAL DEFAULT 1.0,              -- 分類確信度
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  UNIQUE(subsidy_id, category_id),
  FOREIGN KEY (category_id) REFERENCES category_master(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subsidy_categories_subsidy ON subsidy_categories(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_categories_category ON subsidy_categories(category_id);

-- 4.3 補助金×対象地域
CREATE TABLE IF NOT EXISTS subsidy_regions (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  
  scope TEXT NOT NULL                       -- national / prefecture / municipal
    CHECK (scope IN ('national', 'prefecture', 'municipal')),
  
  prefecture_code TEXT,                     -- 都道府県コード（01-47）
  city_code TEXT,                           -- 市区町村コード
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  UNIQUE(subsidy_id, scope, prefecture_code, city_code)
);

CREATE INDEX IF NOT EXISTS idx_subsidy_regions_subsidy ON subsidy_regions(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_regions_pref ON subsidy_regions(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_subsidy_regions_city ON subsidy_regions(city_code);

-- 4.4 補助金×対象業種
CREATE TABLE IF NOT EXISTS subsidy_industries (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  industry_id TEXT NOT NULL,
  
  is_required INTEGER DEFAULT 0,            -- 必須条件
  is_excluded INTEGER DEFAULT 0,            -- 除外条件
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  UNIQUE(subsidy_id, industry_id),
  FOREIGN KEY (industry_id) REFERENCES industry_master(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subsidy_industries_subsidy ON subsidy_industries(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_industries_industry ON subsidy_industries(industry_id);

-- =====================================================
-- 5. 初期データ: 省庁マスタ
-- =====================================================
INSERT OR IGNORE INTO issuer_master (id, issuer_type, name, name_short, sort_order) VALUES
-- 主要省庁
('ministry-chusho', 'ministry', '中小企業庁', '中企庁', 10),
('ministry-meti', 'ministry', '経済産業省', '経産省', 11),
('ministry-mhlw', 'ministry', '厚生労働省', '厚労省', 12),
('ministry-maff', 'ministry', '農林水産省', '農水省', 13),
('ministry-mlit', 'ministry', '国土交通省', '国交省', 14),
('ministry-env', 'ministry', '環境省', '環境省', 15),
('ministry-soumu', 'ministry', '総務省', '総務省', 16),
('ministry-mext', 'ministry', '文部科学省', '文科省', 17),
('ministry-cao', 'ministry', '内閣府', '内閣府', 18),
('ministry-kodomo', 'ministry', 'こども家庭庁', 'こども庁', 19),
('ministry-jta', 'ministry', '観光庁', '観光庁', 20),
('ministry-sports', 'ministry', 'スポーツ庁', 'スポーツ庁', 21),
('ministry-bunka', 'ministry', '文化庁', '文化庁', 22),
('ministry-anre', 'ministry', '資源エネルギー庁', 'エネ庁', 23),
('ministry-rinya', 'ministry', '林野庁', '林野庁', 24),
('ministry-suisan', 'ministry', '水産庁', '水産庁', 25),
('ministry-jfc', 'ministry', '日本政策金融公庫', '公庫', 26),
-- 独立行政法人等
('org-nedo', 'organization', 'NEDO（新エネルギー・産業技術総合開発機構）', 'NEDO', 30),
('org-jetro', 'organization', 'JETRO（日本貿易振興機構）', 'JETRO', 31),
('org-sii', 'organization', '環境共創イニシアチブ', 'SII', 32),
('org-smrj', 'organization', '中小企業基盤整備機構', '中小機構', 33);

-- =====================================================
-- 6. 初期データ: カテゴリマスタ（情報の泉準拠）
-- =====================================================
-- 大分類
INSERT OR IGNORE INTO category_master (id, category_type, name, name_en, sort_order) VALUES
('cat-employment', 'major', '雇用・人材', 'employment', 10),
('cat-sales', 'major', '販路開拓支援', 'sales', 20),
('cat-equipment', 'major', '設備導入・研究開発', 'equipment', 30),
('cat-startup', 'major', '創業・起業・新規事業', 'startup', 40),
('cat-management', 'major', '経営改善・融資', 'management', 50),
('cat-ip', 'major', '特許・知的財産・認証取得', 'ip', 60),
('cat-covid', 'major', 'コロナ関連', 'covid', 70);

-- 小分類（雇用・人材）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-employment-recruitment', 'minor', '採用活動支援', 'cat-employment', '採用,求人,人材確保', 11),
('cat-employment-training', 'minor', '人材育成・研修', 'cat-employment', '研修,教育,スキルアップ', 12),
('cat-employment-subsidy', 'minor', '雇用関係助成金', 'cat-employment', '雇用,助成,奨励金', 13);

-- 小分類（販路開拓支援）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-sales-regional', 'minor', '地域活性化', 'cat-sales', '地域,活性化,振興', 21),
('cat-sales-expansion', 'minor', '販路開拓支援', 'cat-sales', '販路,マーケティング,展示会', 22),
('cat-sales-overseas', 'minor', '海外展開支援', 'cat-sales', '海外,輸出,グローバル', 23);

-- 小分類（設備導入・研究開発）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-equipment-manufacturing', 'minor', 'ものづくり支援', 'cat-equipment', 'ものづくり,製造,生産', 31),
('cat-equipment-product', 'minor', '商品・サービス開発', 'cat-equipment', '商品開発,サービス,新製品', 32),
('cat-equipment-rd', 'minor', '設備導入・研究開発', 'cat-equipment', '設備,研究,開発,投資', 33),
('cat-equipment-energy', 'minor', 'エネルギー設備導入', 'cat-equipment', '省エネ,再エネ,太陽光,蓄電池', 34),
('cat-equipment-it', 'minor', 'IT・IoT導入', 'cat-equipment', 'IT,IoT,DX,デジタル', 35);

-- 小分類（創業・起業・新規事業）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-startup-founding', 'minor', '創業・起業', 'cat-startup', '創業,起業,開業,スタートアップ', 41),
('cat-startup-new', 'minor', '新規事業', 'cat-startup', '新規事業,新分野,第二創業', 42);

-- 小分類（経営改善・融資）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-management-improvement', 'minor', '経営改善', 'cat-management', '経営改善,生産性,効率化', 51),
('cat-management-tax', 'minor', '税制優遇・保証制度', 'cat-management', '税制,優遇,保証,信用', 52),
('cat-management-loan', 'minor', '融資', 'cat-management', '融資,借入,資金調達', 53),
('cat-management-succession', 'minor', '事業承継', 'cat-management', '事業承継,M&A,後継者', 54);

-- 小分類（特許・知的財産）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-ip-patent', 'minor', '特許・知的財産・認証取得', 'cat-ip', '特許,知財,認証,ISO', 61);

-- 小分類（コロナ関連）
INSERT OR IGNORE INTO category_master (id, category_type, name, parent_id, keywords, sort_order) VALUES
('cat-covid-emergency', 'minor', '緊急対策支援制度', 'cat-covid', 'コロナ,緊急,支援,給付', 71);

-- =====================================================
-- 7. 初期データ: 業種マスタ（情報の泉準拠）
-- =====================================================
INSERT OR IGNORE INTO industry_master (id, code, name, sort_order) VALUES
('ind-info-comm', 'G', '情報通信業', 10),
('ind-electric', 'D', '電気・ガス・熱供給・水道業', 20),
('ind-manufacturing', 'E', '製造業', 30),
('ind-construction', 'D', '建設業', 40),
('ind-mining', 'C', '鉱業・採石業・砂利採取業', 50),
('ind-fishing', 'B', '漁業', 60),
('ind-wholesale', 'I', '卸売業', 70),
('ind-retail', 'I', '小売業', 80),
('ind-finance', 'J', '金融業・保険業', 90),
('ind-realestate', 'K', '不動産業・物品賃貸業', 100),
('ind-medical', 'P', '医療・福祉', 110),
('ind-food', 'M', '飲食サービス業', 120),
('ind-hotel', 'M', '宿泊業', 130),
('ind-education', 'O', '教育・学習支援業', 140),
('ind-lifestyle', 'N', '生活関連サービス・娯楽業', 150),
('ind-research', 'L', '学術研究・専門・技術サービス業', 160),
('ind-public', 'R', '公務', 170),
('ind-transport', 'H', '運輸業・郵便業', 180),
('ind-agriculture', 'A', '農業・林業', 190),
('ind-complex', 'Q', '複合サービス業', 200),
('ind-service', 'R', 'サービス業', 210),
('ind-other', 'T', '分類不能の産業', 220),
('ind-organization', 'S', 'その他の団体', 230);

-- =====================================================
-- 8. source_registry に東京都サブソース追加
-- =====================================================
INSERT OR IGNORE INTO source_registry (registry_id, scope, geo_id, program_key, root_url, crawl_strategy, max_depth, target_types, update_freq, priority, notes) VALUES
-- 東京都
('reg-tokyo-hataraku', 'prefecture', '13', 'tokyo-hataraku', 'https://www.hataraku.metro.tokyo.lg.jp/', 'crawl', 2, '["guideline","faq","pdf","news"]', 'daily', 1, 'TOKYOはたらくネット'),
('reg-tokyo-kosha', 'prefecture', '13', 'tokyo-kosha', 'https://www.tokyo-kosha.or.jp/', 'crawl', 2, '["guideline","faq","pdf"]', 'daily', 1, '東京都中小企業振興公社'),
('reg-tokyo-shigoto', 'prefecture', '13', 'tokyo-shigoto', 'https://www.shigotozaidan.or.jp/', 'crawl', 2, '["guideline","faq","pdf"]', 'daily', 1, '東京しごと財団'),
('reg-tokyo-sanro', 'prefecture', '13', 'tokyo-sanro', 'https://www.sangyo-rodo.metro.tokyo.lg.jp/', 'crawl', 2, '["guideline","faq","pdf"]', 'daily', 2, '東京都産業労働局'),
('reg-tokyo-coolnet', 'prefecture', '13', 'tokyo-coolnet', 'https://www.tokyo-co2down.jp/', 'crawl', 2, '["guideline","faq","pdf"]', 'weekly', 2, 'クールネット東京');

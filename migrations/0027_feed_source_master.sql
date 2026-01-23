-- =====================================================================
-- Migration: 0027_feed_source_master.sql
-- Date: 2026-01-23
-- Purpose: NEWSフィード ソースマスター追加
-- 参考: 情報の泉のデータ構造に基づく設計
-- =====================================================================

-- =====================================================================
-- 1. feed_sources - NEWSソースマスター
-- =====================================================================
-- 「情報の泉」で利用可能な全ソースを管理
-- これにより:
--   - どのソースからデータを取得可能か一覧化
--   - ソースごとの有効/無効切り替え
--   - 取得優先度・頻度の管理
--   - ソースURLやスクレイピング設定の保持
-- =====================================================================
CREATE TABLE IF NOT EXISTS feed_sources (
    id TEXT PRIMARY KEY,  -- 例: pref-13-main, ministry-meti, org-canpan
    
    -- 分類
    category TEXT NOT NULL CHECK (category IN (
        'platform',      -- プラットフォーム内部
        'support_info',  -- 新着支援情報
        'prefecture',    -- 都道府県
        'municipal',     -- 市区町村
        'ministry',      -- 省庁
        'other_public'   -- その他公的機関・財団
    )),
    
    -- 地域（都道府県・市区町村用）
    region_code TEXT,        -- 都道府県コード（01-47）、市区町村は別途
    region_name TEXT,        -- 「東京都」「神奈川県」等
    city_code TEXT,          -- 市区町村コード（総務省コード）
    city_name TEXT,          -- 「港区」「横浜市」等
    
    -- ソース情報
    source_name TEXT NOT NULL,      -- 表示名: 「TOKYOはたらくネット」
    source_name_short TEXT,         -- 略称: 「はたらくネット」
    source_org TEXT,                -- 運営組織: 「東京都産業労働局」
    source_url TEXT,                -- トップページURL
    feed_url TEXT,                  -- RSSフィードURL（あれば）
    api_url TEXT,                   -- API URL（あれば）
    
    -- サブカテゴリ（同一ソース内の分類）
    sub_category TEXT,              -- 「人材確保の支援」「テレワーク活用」等
    parent_source_id TEXT,          -- 親ソースID（階層構造用）
    
    -- スクレイピング設定
    scrape_config_json TEXT,        -- {"selector": ".news-list", "date_format": "YYYY年MM月DD日"}
    scrape_frequency TEXT DEFAULT 'daily',  -- hourly, daily, weekly
    last_scraped_at TEXT,
    
    -- 情報の泉連携
    izumi_category TEXT,            -- 情報の泉でのカテゴリ名
    izumi_source_key TEXT,          -- 情報の泉でのソースキー
    
    -- 管理
    is_active INTEGER DEFAULT 1,    -- 0=無効, 1=有効
    priority INTEGER DEFAULT 50,    -- 取得優先度（高いほど優先）
    news_count INTEGER DEFAULT 0,   -- 累計取得件数
    
    -- 統計
    avg_news_per_week REAL DEFAULT 0,  -- 週平均更新件数
    reliability_score REAL DEFAULT 1.0, -- 信頼性スコア（0-1）
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (parent_source_id) REFERENCES feed_sources(id) ON DELETE SET NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_feed_sources_category ON feed_sources(category);
CREATE INDEX IF NOT EXISTS idx_feed_sources_region ON feed_sources(region_code);
CREATE INDEX IF NOT EXISTS idx_feed_sources_city ON feed_sources(city_code);
CREATE INDEX IF NOT EXISTS idx_feed_sources_active ON feed_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_feed_sources_priority ON feed_sources(priority DESC);
CREATE INDEX IF NOT EXISTS idx_feed_sources_parent ON feed_sources(parent_source_id);

-- =====================================================================
-- 2. subsidy_feed_items に source_id 追加
-- =====================================================================
-- 既存テーブルにソースマスター参照を追加
ALTER TABLE subsidy_feed_items ADD COLUMN source_id TEXT REFERENCES feed_sources(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_feed_items_source_id ON subsidy_feed_items(source_id);

-- =====================================================================
-- 3. feed_source_stats - ソース別統計（日次集計）
-- =====================================================================
CREATE TABLE IF NOT EXISTS feed_source_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    stat_date TEXT NOT NULL,  -- YYYY-MM-DD
    
    -- 統計
    new_items_count INTEGER DEFAULT 0,
    updated_items_count INTEGER DEFAULT 0,
    total_items_count INTEGER DEFAULT 0,
    
    -- スクレイピング結果
    scrape_success INTEGER DEFAULT 1,  -- 0=失敗, 1=成功
    scrape_duration_ms INTEGER,
    error_message TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (source_id) REFERENCES feed_sources(id) ON DELETE CASCADE,
    UNIQUE(source_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_source_stats_date ON feed_source_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_source_stats_source ON feed_source_stats(source_id);

-- =====================================================================
-- 4. 初期データ: 省庁マスター
-- =====================================================================
INSERT OR IGNORE INTO feed_sources (id, category, source_name, source_org, izumi_category) VALUES
-- 省庁
('ministry-sme', 'ministry', '中小企業庁', '経済産業省', '省庁NEWS'),
('ministry-meti', 'ministry', '経済産業省', '経済産業省', '省庁NEWS'),
('ministry-mhlw', 'ministry', '厚生労働省', '厚生労働省', '省庁NEWS'),
('ministry-maff', 'ministry', '農林水産省', '農林水産省', '省庁NEWS'),
('ministry-mlit', 'ministry', '国土交通省', '国土交通省', '省庁NEWS'),
('ministry-env', 'ministry', '環境省', '環境省', '省庁NEWS'),
('ministry-soumu', 'ministry', '総務省', '総務省', '省庁NEWS'),
('ministry-jta', 'ministry', '観光庁', '国土交通省', '省庁NEWS'),
('ministry-mext', 'ministry', '文部科学省', '文部科学省', '省庁NEWS'),
('ministry-sports', 'ministry', 'スポーツ庁', '文部科学省', '省庁NEWS'),
('ministry-anre', 'ministry', '資源エネルギー庁', '経済産業省', '省庁NEWS'),
('ministry-bunka', 'ministry', '文化庁', '文部科学省', '省庁NEWS'),
('ministry-kodomo', 'ministry', 'こども家庭庁', 'こども家庭庁', '省庁NEWS'),
('ministry-cao', 'ministry', '内閣府', '内閣府', '省庁NEWS'),
-- 独立行政法人等
('ministry-nedo', 'ministry', 'NEDO', '新エネルギー・産業技術総合開発機構', '省庁NEWS'),
('ministry-jetro', 'ministry', 'JETRO', '日本貿易振興機構', '省庁NEWS'),
('ministry-sii', 'ministry', '環境共創イニシアチブ', '環境共創イニシアチブ', '省庁NEWS');

-- =====================================================================
-- 5. 初期データ: 都道府県マスター（メインのみ）
-- =====================================================================
INSERT OR IGNORE INTO feed_sources (id, category, region_code, region_name, source_name, izumi_category) VALUES
('pref-01-main', 'prefecture', '01', '北海道', '北海道（メイン）', '都道府県NEWS'),
('pref-02-main', 'prefecture', '02', '青森県', '青森県（メイン）', '都道府県NEWS'),
('pref-03-main', 'prefecture', '03', '岩手県', '岩手県（メイン）', '都道府県NEWS'),
('pref-04-main', 'prefecture', '04', '宮城県', '宮城県（メイン）', '都道府県NEWS'),
('pref-05-main', 'prefecture', '05', '秋田県', '秋田県（メイン）', '都道府県NEWS'),
('pref-06-main', 'prefecture', '06', '山形県', '山形県（メイン）', '都道府県NEWS'),
('pref-07-main', 'prefecture', '07', '福島県', '福島県（メイン）', '都道府県NEWS'),
('pref-08-main', 'prefecture', '08', '茨城県', '茨城県（メイン）', '都道府県NEWS'),
('pref-09-main', 'prefecture', '09', '栃木県', '栃木県（メイン）', '都道府県NEWS'),
('pref-10-main', 'prefecture', '10', '群馬県', '群馬県（メイン）', '都道府県NEWS'),
('pref-11-main', 'prefecture', '11', '埼玉県', '埼玉県（メイン）', '都道府県NEWS'),
('pref-12-main', 'prefecture', '12', '千葉県', '千葉県（メイン）', '都道府県NEWS'),
('pref-13-main', 'prefecture', '13', '東京都', '東京都（メイン）', '都道府県NEWS'),
('pref-14-main', 'prefecture', '14', '神奈川県', '神奈川県（メイン）', '都道府県NEWS'),
('pref-15-main', 'prefecture', '15', '新潟県', '新潟県（メイン）', '都道府県NEWS'),
('pref-16-main', 'prefecture', '16', '富山県', '富山県（メイン）', '都道府県NEWS'),
('pref-17-main', 'prefecture', '17', '石川県', '石川県（メイン）', '都道府県NEWS'),
('pref-18-main', 'prefecture', '18', '福井県', '福井県（メイン）', '都道府県NEWS'),
('pref-19-main', 'prefecture', '19', '山梨県', '山梨県（メイン）', '都道府県NEWS'),
('pref-20-main', 'prefecture', '20', '長野県', '長野県（メイン）', '都道府県NEWS'),
('pref-21-main', 'prefecture', '21', '岐阜県', '岐阜県（メイン）', '都道府県NEWS'),
('pref-22-main', 'prefecture', '22', '静岡県', '静岡県（メイン）', '都道府県NEWS'),
('pref-23-main', 'prefecture', '23', '愛知県', '愛知県（メイン）', '都道府県NEWS'),
('pref-24-main', 'prefecture', '24', '三重県', '三重県（メイン）', '都道府県NEWS'),
('pref-25-main', 'prefecture', '25', '滋賀県', '滋賀県（メイン）', '都道府県NEWS'),
('pref-26-main', 'prefecture', '26', '京都府', '京都府（メイン）', '都道府県NEWS'),
('pref-27-main', 'prefecture', '27', '大阪府', '大阪府（メイン）', '都道府県NEWS'),
('pref-28-main', 'prefecture', '28', '兵庫県', '兵庫県（メイン）', '都道府県NEWS'),
('pref-29-main', 'prefecture', '29', '奈良県', '奈良県（メイン）', '都道府県NEWS'),
('pref-30-main', 'prefecture', '30', '和歌山県', '和歌山県（メイン）', '都道府県NEWS'),
('pref-31-main', 'prefecture', '31', '鳥取県', '鳥取県（メイン）', '都道府県NEWS'),
('pref-32-main', 'prefecture', '32', '島根県', '島根県（メイン）', '都道府県NEWS'),
('pref-33-main', 'prefecture', '33', '岡山県', '岡山県（メイン）', '都道府県NEWS'),
('pref-34-main', 'prefecture', '34', '広島県', '広島県（メイン）', '都道府県NEWS'),
('pref-35-main', 'prefecture', '35', '山口県', '山口県（メイン）', '都道府県NEWS'),
('pref-36-main', 'prefecture', '36', '徳島県', '徳島県（メイン）', '都道府県NEWS'),
('pref-37-main', 'prefecture', '37', '香川県', '香川県（メイン）', '都道府県NEWS'),
('pref-38-main', 'prefecture', '38', '愛媛県', '愛媛県（メイン）', '都道府県NEWS'),
('pref-39-main', 'prefecture', '39', '高知県', '高知県（メイン）', '都道府県NEWS'),
('pref-40-main', 'prefecture', '40', '福岡県', '福岡県（メイン）', '都道府県NEWS'),
('pref-41-main', 'prefecture', '41', '佐賀県', '佐賀県（メイン）', '都道府県NEWS'),
('pref-42-main', 'prefecture', '42', '長崎県', '長崎県（メイン）', '都道府県NEWS'),
('pref-43-main', 'prefecture', '43', '熊本県', '熊本県（メイン）', '都道府県NEWS'),
('pref-44-main', 'prefecture', '44', '大分県', '大分県（メイン）', '都道府県NEWS'),
('pref-45-main', 'prefecture', '45', '宮崎県', '宮崎県（メイン）', '都道府県NEWS'),
('pref-46-main', 'prefecture', '46', '鹿児島県', '鹿児島県（メイン）', '都道府県NEWS'),
('pref-47-main', 'prefecture', '47', '沖縄県', '沖縄県（メイン）', '都道府県NEWS');

-- =====================================================================
-- 6. 初期データ: 東京都サブソース（例）
-- =====================================================================
INSERT OR IGNORE INTO feed_sources (id, category, region_code, region_name, source_name, sub_category, parent_source_id, izumi_category) VALUES
-- TOKYOはたらくネット系
('pref-13-hataraku', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', NULL, 'pref-13-main', '都道府県NEWS'),
('pref-13-hataraku-jinzai', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', '人材確保の支援', 'pref-13-hataraku', '都道府県NEWS'),
('pref-13-hataraku-telework', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', 'テレワーク活用に向けた支援', 'pref-13-hataraku', '都道府県NEWS'),
('pref-13-hataraku-josei', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', '働く女性の活躍支援', 'pref-13-hataraku', '都道府県NEWS'),
('pref-13-hataraku-joseikin', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', '企業向け奨励金・助成金', 'pref-13-hataraku', '都道府県NEWS'),
('pref-13-hataraku-seiki', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', '正規雇用化支援', 'pref-13-hataraku', '都道府県NEWS'),
('pref-13-hataraku-ikusei', 'prefecture', '13', '東京都', 'TOKYOはたらくネット', '人材育成の支援', 'pref-13-hataraku', '都道府県NEWS'),
-- 中小企業振興公社
('pref-13-kosha', 'prefecture', '13', '東京都', '東京都中小企業振興公社', NULL, 'pref-13-main', '都道府県NEWS'),
-- しごと財団
('pref-13-shigoto', 'prefecture', '13', '東京都', '東京しごと財団', NULL, 'pref-13-main', '都道府県NEWS'),
('pref-13-shigoto-josei', 'prefecture', '13', '東京都', '東京しごと財団', '助成金を活用したい', 'pref-13-shigoto', '都道府県NEWS'),
-- 産業労働局
('pref-13-sanro', 'prefecture', '13', '東京都', '産業労働局', NULL, 'pref-13-main', '都道府県NEWS'),
('pref-13-sanro-shoko', 'prefecture', '13', '東京都', '産業労働局', '中小企業支援 商工助成', 'pref-13-sanro', '都道府県NEWS'),
('pref-13-sanro-yushi', 'prefecture', '13', '東京都', '産業労働局', '中小企業支援 金融 融資', 'pref-13-sanro', '都道府県NEWS'),
('pref-13-sanro-sogyo', 'prefecture', '13', '東京都', '産業労働局', '創業支援', 'pref-13-sanro', '都道府県NEWS'),
-- その他
('pref-13-coolnet', 'prefecture', '13', '東京都', 'クールネット東京', NULL, 'pref-13-main', '都道府県NEWS'),
('pref-13-fukushi', 'prefecture', '13', '東京都', '東京都福祉局', '報道発表', 'pref-13-main', '都道府県NEWS'),
('pref-13-hoken', 'prefecture', '13', '東京都', '保健医療局', '報道発表', 'pref-13-main', '都道府県NEWS');

-- =====================================================================
-- 7. 初期データ: その他公的機関（主要財団・団体）
-- =====================================================================
INSERT OR IGNORE INTO feed_sources (id, category, source_name, source_org, izumi_category) VALUES
-- 主要機関
('org-canpan', 'other_public', 'CANPAN FIELDS', '日本財団', 'その他NEWS'),
('org-jgrants', 'other_public', 'Jグランツ', 'デジタル庁', 'その他NEWS'),
('org-jka', 'other_public', 'JKA（競輪・オートレース）', 'JKA', 'その他NEWS'),
('org-nippon-foundation', 'other_public', '日本財団', '日本財団', 'その他NEWS'),
('org-toyota-foundation', 'other_public', 'トヨタ財団', 'トヨタ財団', 'その他NEWS'),
('org-jsps', 'other_public', '日本学術振興会', '日本学術振興会', 'その他NEWS'),
('org-amed', 'other_public', '日本医療研究開発機構', 'AMED', 'その他NEWS'),
('org-sompo-welfare', 'other_public', 'SOMPO福祉財団', 'SOMPOホールディングス', 'その他NEWS'),
('org-takeda', 'other_public', '武田科学振興財団', '武田薬品工業', 'その他NEWS'),
('org-mitsubishi', 'other_public', '三菱財団', '三菱グループ', 'その他NEWS'),
('org-canon', 'other_public', 'キヤノン財団', 'キヤノン', 'その他NEWS'),
('org-inamori', 'other_public', '稲盛財団', '稲盛財団', 'その他NEWS'),
-- 産業支援機関
('org-smrj', 'other_public', '中小企業基盤整備機構', '中小企業基盤整備機構', 'その他NEWS'),
('org-shokokai', 'other_public', '全国中小企業団体中央会', '全国中小企業団体中央会', 'その他NEWS'),
('org-trucking', 'other_public', '全日本トラック協会', '全日本トラック協会', 'その他NEWS');

-- =====================================================================
-- 8. プラットフォーム内部ソース
-- =====================================================================
INSERT OR IGNORE INTO feed_sources (id, category, source_name, source_org, izumi_category, priority) VALUES
('platform-news', 'platform', 'ホジョラク お知らせ', 'ホジョラク', 'プラットフォーム', 100),
('platform-support', 'support_info', '新着支援情報', 'ホジョラク', '新着支援情報', 90);

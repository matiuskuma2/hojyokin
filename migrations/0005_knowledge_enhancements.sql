-- =====================================================
-- Phase K1.5: ナレッジパイプライン強化
-- 運用事故防止 + 地理マスタ + ドメインポリシー + R2対応
-- =====================================================

-- =====================================================
-- 1. 地理マスタ（都道府県・市区町村）
-- JIS X 0401 (都道府県), JIS X 0402 (市区町村)
-- =====================================================
CREATE TABLE IF NOT EXISTS geo_region (
  geo_id TEXT PRIMARY KEY,                      -- UUID
  level TEXT NOT NULL CHECK (level IN ('nation', 'prefecture', 'city', 'ward', 'town', 'village')),
  prefecture_code TEXT,                         -- JIS X 0401 (01-47)
  city_code TEXT,                               -- JIS X 0402 (6桁)
  name_ja TEXT NOT NULL,                        -- 日本語名
  name_en TEXT,                                 -- 英語名（オプション）
  parent_geo_id TEXT,                           -- 親地域ID（都→市→区の親子関係）
  population INTEGER,                           -- 人口（統計用、オプション）
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (parent_geo_id) REFERENCES geo_region(geo_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_geo_region_level ON geo_region(level);
CREATE INDEX IF NOT EXISTS idx_geo_region_prefecture ON geo_region(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_geo_region_city ON geo_region(city_code);
CREATE INDEX IF NOT EXISTS idx_geo_region_parent ON geo_region(parent_geo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_region_codes ON geo_region(prefecture_code, city_code);

-- =====================================================
-- 2. 補助金⇔地域紐付け
-- scope_type: eligible=対象地域, operated_by=執行団体, applies_to=申請窓口
-- =====================================================
CREATE TABLE IF NOT EXISTS subsidy_geo_map (
  id TEXT PRIMARY KEY,                          -- UUID
  subsidy_id TEXT NOT NULL,                     -- 補助金ID
  geo_id TEXT NOT NULL,                         -- 地域ID
  scope_type TEXT NOT NULL DEFAULT 'eligible' CHECK (scope_type IN ('eligible', 'operated_by', 'applies_to')),
  notes TEXT,                                   -- 備考
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_metadata(subsidy_id) ON DELETE CASCADE,
  FOREIGN KEY (geo_id) REFERENCES geo_region(geo_id) ON DELETE CASCADE,
  UNIQUE(subsidy_id, geo_id, scope_type)
);

CREATE INDEX IF NOT EXISTS idx_subsidy_geo_map_subsidy ON subsidy_geo_map(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_geo_map_geo ON subsidy_geo_map(geo_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_geo_map_scope ON subsidy_geo_map(scope_type);

-- =====================================================
-- 3. ドメインポリシー（クロール制御・事故防止）
-- =====================================================
CREATE TABLE IF NOT EXISTS domain_policy (
  domain_key TEXT PRIMARY KEY,                  -- 例: ipa.go.jp, chusho.meti.go.jp
  enabled INTEGER NOT NULL DEFAULT 1,           -- 0=無効（クロール停止）, 1=有効
  
  -- レート制限
  rate_limit_rps REAL DEFAULT 1.0,             -- 秒間リクエスト数上限
  max_pages_per_run INTEGER DEFAULT 10,         -- 1回のクロールあたりの最大ページ数
  request_interval_ms INTEGER DEFAULT 1000,     -- リクエスト間隔（ミリ秒）
  
  -- クロール戦略デフォルト
  default_strategy TEXT DEFAULT 'scrape' CHECK (default_strategy IN ('scrape', 'crawl')),
  default_max_depth INTEGER DEFAULT 1,          -- crawl時のデフォルト深度
  
  -- robots.txt / 利用規約対応
  robots_txt_url TEXT,                          -- robots.txt URL
  robots_respected INTEGER DEFAULT 1,           -- robots.txt遵守フラグ
  terms_of_service_url TEXT,                    -- 利用規約URL
  terms_notes TEXT,                             -- 規約に関するメモ
  
  -- 自動停止条件
  consecutive_failures_threshold INTEGER DEFAULT 3,  -- 連続失敗でblocked化
  blocked_until TEXT,                           -- ブロック解除予定日時
  
  -- 統計
  total_requests INTEGER DEFAULT 0,             -- 累計リクエスト数
  success_count INTEGER DEFAULT 0,              -- 成功数
  failure_count INTEGER DEFAULT 0,              -- 失敗数
  last_success_at TEXT,                         -- 最終成功日時
  last_failure_at TEXT,                         -- 最終失敗日時
  last_error_code TEXT,                         -- 最終エラーコード（502, 403など）
  
  -- 管理用
  notes TEXT,                                   -- 運用メモ（ブロック理由など）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domain_policy_enabled ON domain_policy(enabled);
CREATE INDEX IF NOT EXISTS idx_domain_policy_failures ON domain_policy(failure_count);

-- =====================================================
-- 4. source_url 拡張カラム追加
-- 収集戦略の単位として機能強化
-- =====================================================

-- 収集戦略
ALTER TABLE source_url ADD COLUMN crawl_strategy TEXT DEFAULT 'scrape' CHECK (crawl_strategy IN ('scrape', 'crawl'));
ALTER TABLE source_url ADD COLUMN max_depth INTEGER DEFAULT 1;
ALTER TABLE source_url ADD COLUMN allowed_paths TEXT;              -- JSON array: 許可パス
ALTER TABLE source_url ADD COLUMN deny_paths TEXT;                 -- JSON array: 除外パス

-- robots.txt対応
ALTER TABLE source_url ADD COLUMN robots_respected INTEGER DEFAULT 1;

-- ドメイン管理
ALTER TABLE source_url ADD COLUMN domain_key TEXT;                 -- ipa.go.jp など（集計・制御単位）

-- 更新頻度制御
ALTER TABLE source_url ADD COLUMN update_frequency TEXT DEFAULT 'weekly' CHECK (update_frequency IN ('daily', 'weekly', 'monthly', 'manual'));
ALTER TABLE source_url ADD COLUMN next_crawl_at TEXT;              -- 次回クロール予定日時

-- コスト追跡
ALTER TABLE source_url ADD COLUMN crawl_count INTEGER DEFAULT 0;   -- クロール回数累計
ALTER TABLE source_url ADD COLUMN total_bytes INTEGER DEFAULT 0;   -- 累計取得バイト数

CREATE INDEX IF NOT EXISTS idx_source_url_domain ON source_url(domain_key);
CREATE INDEX IF NOT EXISTS idx_source_url_next_crawl ON source_url(next_crawl_at);
CREATE INDEX IF NOT EXISTS idx_source_url_frequency ON source_url(update_frequency);

-- =====================================================
-- 5. doc_object R2対応カラム追加
-- storage_backend: d1_inline（D1に短期保存）/ r2（R2に保存）
-- =====================================================

ALTER TABLE doc_object ADD COLUMN storage_backend TEXT DEFAULT 'r2' CHECK (storage_backend IN ('d1_inline', 'r2'));

-- D1一時保存用（R2未設定時のフォールバック）
ALTER TABLE doc_object ADD COLUMN raw_markdown TEXT;               -- Markdown原文（D1保存時のみ）
ALTER TABLE doc_object ADD COLUMN structured_json TEXT;            -- 構造化JSON（D1保存時のみ）

-- R2メタデータ
ALTER TABLE doc_object ADD COLUMN r2_raw_size INTEGER;             -- raw Markdownのバイト数
ALTER TABLE doc_object ADD COLUMN r2_structured_size INTEGER;      -- structured JSONのバイト数
ALTER TABLE doc_object ADD COLUMN r2_uploaded_at TEXT;             -- R2アップロード日時

-- コンテンツハッシュ（SHA-256）
ALTER TABLE doc_object ADD COLUMN content_hash_sha256 TEXT;        -- SHA-256ハッシュ（差分検知用）

CREATE INDEX IF NOT EXISTS idx_doc_object_storage ON doc_object(storage_backend);
CREATE INDEX IF NOT EXISTS idx_doc_object_hash ON doc_object(content_hash_sha256);

-- =====================================================
-- 6. クロール統計テーブル（KPI監視用）
-- =====================================================
CREATE TABLE IF NOT EXISTS crawl_stats (
  id TEXT PRIMARY KEY,                          -- UUID
  stat_date TEXT NOT NULL,                      -- 日付 (YYYY-MM-DD)
  stat_hour INTEGER,                            -- 時間 (0-23, NULLなら日次集計)
  
  -- Firecrawl統計
  total_requests INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  
  -- エラーコード別
  error_502_count INTEGER DEFAULT 0,
  error_403_count INTEGER DEFAULT 0,
  error_timeout_count INTEGER DEFAULT 0,
  error_other_count INTEGER DEFAULT 0,
  
  -- 処理量
  total_pages INTEGER DEFAULT 0,
  total_bytes INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  
  -- Extract統計
  extract_count INTEGER DEFAULT 0,
  extract_success_count INTEGER DEFAULT 0,
  missing_required_fields_count INTEGER DEFAULT 0,
  needs_review_count INTEGER DEFAULT 0,
  
  -- コスト（概算）
  estimated_firecrawl_credits REAL DEFAULT 0,
  estimated_llm_tokens INTEGER DEFAULT 0,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_stats_date_hour ON crawl_stats(stat_date, stat_hour);
CREATE INDEX IF NOT EXISTS idx_crawl_stats_date ON crawl_stats(stat_date);

-- =====================================================
-- 7. アラート履歴テーブル（運用監視用）
-- =====================================================
CREATE TABLE IF NOT EXISTS alert_log (
  id TEXT PRIMARY KEY,                          -- UUID
  alert_type TEXT NOT NULL,                     -- 'domain_blocked' | 'high_failure_rate' | 'field_changed' | 'needs_review_spike'
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- 対象
  domain_key TEXT,
  subsidy_id TEXT,
  url_id TEXT,
  
  -- 内容
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,                                 -- JSON
  
  -- 状態
  acknowledged INTEGER DEFAULT 0,               -- 確認済みフラグ
  acknowledged_by TEXT,                         -- 確認者
  acknowledged_at TEXT,                         -- 確認日時
  resolved INTEGER DEFAULT 0,                   -- 解決済みフラグ
  resolved_at TEXT,                             -- 解決日時
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_log_type ON alert_log(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_log_severity ON alert_log(severity);
CREATE INDEX IF NOT EXISTS idx_alert_log_acknowledged ON alert_log(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alert_log_created ON alert_log(created_at);

-- =====================================================
-- 8. 初期ドメインポリシー投入（既知の問題ドメイン）
-- =====================================================

-- 正常に動作するドメイン
INSERT OR IGNORE INTO domain_policy (domain_key, enabled, default_strategy, notes) 
VALUES ('ipa.go.jp', 1, 'scrape', 'IPA: 正常動作確認済み');

INSERT OR IGNORE INTO domain_policy (domain_key, enabled, default_strategy, notes) 
VALUES ('jgrants-portal.go.jp', 1, 'scrape', 'Jグランツポータル: 正常動作確認済み');

-- 問題があるドメイン（502エラー）
INSERT OR IGNORE INTO domain_policy (domain_key, enabled, default_strategy, notes) 
VALUES ('chusho.meti.go.jp', 0, 'scrape', '中小企業庁: 502 Bad Gateway - Firecrawlブロック');

-- その他政府系（要確認）
INSERT OR IGNORE INTO domain_policy (domain_key, enabled, default_strategy, notes) 
VALUES ('meti.go.jp', 1, 'scrape', '経産省: 要動作確認');

INSERT OR IGNORE INTO domain_policy (domain_key, enabled, default_strategy, notes) 
VALUES ('maff.go.jp', 1, 'scrape', '農水省: 要動作確認');

-- IT導入補助金関連（モックデータ用）
INSERT OR IGNORE INTO domain_policy (domain_key, enabled, default_strategy, notes) 
VALUES ('it-hojo.jp', 1, 'scrape', 'IT導入補助金: モックURL');

-- =====================================================
-- 9. 初期地理マスタ（都道府県のみ - 市区町村は別途投入）
-- =====================================================

-- 日本
INSERT OR IGNORE INTO geo_region (geo_id, level, name_ja, name_en)
VALUES ('JP', 'nation', '日本', 'Japan');

-- 47都道府県（JIS X 0401コード順）
INSERT OR IGNORE INTO geo_region (geo_id, level, prefecture_code, name_ja, parent_geo_id)
VALUES 
  ('01', 'prefecture', '01', '北海道', 'JP'),
  ('02', 'prefecture', '02', '青森県', 'JP'),
  ('03', 'prefecture', '03', '岩手県', 'JP'),
  ('04', 'prefecture', '04', '宮城県', 'JP'),
  ('05', 'prefecture', '05', '秋田県', 'JP'),
  ('06', 'prefecture', '06', '山形県', 'JP'),
  ('07', 'prefecture', '07', '福島県', 'JP'),
  ('08', 'prefecture', '08', '茨城県', 'JP'),
  ('09', 'prefecture', '09', '栃木県', 'JP'),
  ('10', 'prefecture', '10', '群馬県', 'JP'),
  ('11', 'prefecture', '11', '埼玉県', 'JP'),
  ('12', 'prefecture', '12', '千葉県', 'JP'),
  ('13', 'prefecture', '13', '東京都', 'JP'),
  ('14', 'prefecture', '14', '神奈川県', 'JP'),
  ('15', 'prefecture', '15', '新潟県', 'JP'),
  ('16', 'prefecture', '16', '富山県', 'JP'),
  ('17', 'prefecture', '17', '石川県', 'JP'),
  ('18', 'prefecture', '18', '福井県', 'JP'),
  ('19', 'prefecture', '19', '山梨県', 'JP'),
  ('20', 'prefecture', '20', '長野県', 'JP'),
  ('21', 'prefecture', '21', '岐阜県', 'JP'),
  ('22', 'prefecture', '22', '静岡県', 'JP'),
  ('23', 'prefecture', '23', '愛知県', 'JP'),
  ('24', 'prefecture', '24', '三重県', 'JP'),
  ('25', 'prefecture', '25', '滋賀県', 'JP'),
  ('26', 'prefecture', '26', '京都府', 'JP'),
  ('27', 'prefecture', '27', '大阪府', 'JP'),
  ('28', 'prefecture', '28', '兵庫県', 'JP'),
  ('29', 'prefecture', '29', '奈良県', 'JP'),
  ('30', 'prefecture', '30', '和歌山県', 'JP'),
  ('31', 'prefecture', '31', '鳥取県', 'JP'),
  ('32', 'prefecture', '32', '島根県', 'JP'),
  ('33', 'prefecture', '33', '岡山県', 'JP'),
  ('34', 'prefecture', '34', '広島県', 'JP'),
  ('35', 'prefecture', '35', '山口県', 'JP'),
  ('36', 'prefecture', '36', '徳島県', 'JP'),
  ('37', 'prefecture', '37', '香川県', 'JP'),
  ('38', 'prefecture', '38', '愛媛県', 'JP'),
  ('39', 'prefecture', '39', '高知県', 'JP'),
  ('40', 'prefecture', '40', '福岡県', 'JP'),
  ('41', 'prefecture', '41', '佐賀県', 'JP'),
  ('42', 'prefecture', '42', '長崎県', 'JP'),
  ('43', 'prefecture', '43', '熊本県', 'JP'),
  ('44', 'prefecture', '44', '大分県', 'JP'),
  ('45', 'prefecture', '45', '宮崎県', 'JP'),
  ('46', 'prefecture', '46', '鹿児島県', 'JP'),
  ('47', 'prefecture', '47', '沖縄県', 'JP');

-- =====================================================
-- P4: 自動更新パイプライン用テーブル
-- P5: データソース監視用テーブル
-- 
-- 目的: 公募要領の変更を検知し、補助金データを自動更新
-- =====================================================

-- =====================================================
-- P4: 更新検出・管理テーブル
-- =====================================================

-- 更新検出ログ
CREATE TABLE IF NOT EXISTS update_detection_log (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_url TEXT,
  source_type TEXT DEFAULT 'pdf',  -- pdf, webpage, api
  old_content_hash TEXT,
  new_content_hash TEXT,
  changes_detected TEXT,  -- JSON: ['deadline', 'rate', 'limit', ...]
  change_summary TEXT,  -- 人間可読な変更概要
  status TEXT DEFAULT 'pending',  -- pending, auto_applied, manual_review, applied, rejected, error
  auto_applicable INTEGER DEFAULT 0,  -- 自動適用可能かどうか
  applied_at TEXT,
  applied_by TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_update_detection_subsidy ON update_detection_log(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_update_detection_status ON update_detection_log(status);
CREATE INDEX IF NOT EXISTS idx_update_detection_date ON update_detection_log(detected_at);

-- 保留中の更新（フィールド単位）
CREATE TABLE IF NOT EXISTS pending_updates (
  id TEXT PRIMARY KEY,
  detection_log_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  field_path TEXT NOT NULL,  -- 更新対象のフィールドパス（例: detail_json.eligible_expenses）
  field_name TEXT NOT NULL,  -- 表示用フィールド名
  old_value TEXT,
  new_value TEXT,
  change_type TEXT DEFAULT 'modify',  -- add, modify, delete
  confidence REAL DEFAULT 1.0,  -- AI抽出時の信頼度
  source_text TEXT,  -- 変更元のテキスト
  source_page INTEGER,  -- PDFのページ番号
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected, auto_applied
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (detection_log_id) REFERENCES update_detection_log(id)
);

CREATE INDEX IF NOT EXISTS idx_pending_updates_subsidy ON pending_updates(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_status ON pending_updates(status);
CREATE INDEX IF NOT EXISTS idx_pending_updates_detection ON pending_updates(detection_log_id);

-- 更新通知
CREATE TABLE IF NOT EXISTS update_notifications (
  id TEXT PRIMARY KEY,
  detection_log_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,  -- slack, email, in_app
  recipient TEXT NOT NULL,  -- Slack channel, email address, user_id
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',  -- low, normal, high, urgent
  sent_at TEXT,
  status TEXT DEFAULT 'pending',  -- pending, sent, failed, skipped
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (detection_log_id) REFERENCES update_detection_log(id)
);

CREATE INDEX IF NOT EXISTS idx_update_notifications_status ON update_notifications(status);

-- =====================================================
-- P5: データソース監視テーブル
-- =====================================================

-- 監視対象データソース
CREATE TABLE IF NOT EXISTS data_source_monitors (
  id TEXT PRIMARY KEY,
  subsidy_canonical_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  monitor_type TEXT DEFAULT 'webpage',  -- webpage, pdf, api, rss
  check_interval_hours INTEGER DEFAULT 24,
  
  -- セレクタ・パターン設定（JSON）
  selectors TEXT,  -- CSS/XPathセレクタ
  url_patterns TEXT,  -- 対象ファイルのURLパターン（正規表現）
  content_selectors TEXT,  -- ページ内の監視対象コンテンツのセレクタ
  
  -- ステータス
  last_checked_at TEXT,
  last_changed_at TEXT,
  last_content_hash TEXT,
  last_page_hash TEXT,  -- ページ全体のハッシュ
  
  status TEXT DEFAULT 'active',  -- active, paused, error, disabled
  error_count INTEGER DEFAULT 0,
  consecutive_errors INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TEXT,
  
  -- メタデータ
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subsidy_canonical_id) REFERENCES subsidy_canonical(id)
);

CREATE INDEX IF NOT EXISTS idx_data_source_monitors_status ON data_source_monitors(status);
CREATE INDEX IF NOT EXISTS idx_data_source_monitors_subsidy ON data_source_monitors(subsidy_canonical_id);

-- 監視対象ファイル
CREATE TABLE IF NOT EXISTS monitored_files (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_description TEXT,
  file_url TEXT,  -- 現在のURL
  url_pattern TEXT,  -- URLマッチングパターン
  selector TEXT,  -- ファイルリンクを見つけるためのセレクタ
  file_type TEXT,  -- pdf, docx, xlsx, html
  
  -- 最後に確認した状態
  last_url TEXT,
  last_content_hash TEXT,
  last_modified TEXT,  -- HTTPヘッダのLast-Modified
  last_size INTEGER,  -- ファイルサイズ
  last_etag TEXT,  -- HTTPヘッダのETag
  last_checked_at TEXT,
  
  -- ステータス
  status TEXT DEFAULT 'active',  -- active, missing, changed, error
  importance TEXT DEFAULT 'high',  -- critical, high, medium, low
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (monitor_id) REFERENCES data_source_monitors(id)
);

CREATE INDEX IF NOT EXISTS idx_monitored_files_monitor ON monitored_files(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitored_files_status ON monitored_files(status);

-- ファイル変更履歴
CREATE TABLE IF NOT EXISTS file_change_history (
  id TEXT PRIMARY KEY,
  monitored_file_id TEXT NOT NULL,
  monitor_id TEXT,
  subsidy_id TEXT,
  
  -- 変更内容
  old_url TEXT,
  new_url TEXT,
  old_content_hash TEXT,
  new_content_hash TEXT,
  old_size INTEGER,
  new_size INTEGER,
  
  change_type TEXT NOT NULL,  -- url_change, content_change, new_file, deleted, recovered
  change_details TEXT,  -- JSON: 詳細な変更情報
  
  -- 処理状態
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  process_status TEXT DEFAULT 'pending',  -- pending, processing, processed, ignored, error
  process_result TEXT,  -- JSON: 処理結果
  
  -- 関連する更新ログ
  update_detection_log_id TEXT,
  
  notes TEXT,
  FOREIGN KEY (monitored_file_id) REFERENCES monitored_files(id),
  FOREIGN KEY (update_detection_log_id) REFERENCES update_detection_log(id)
);

CREATE INDEX IF NOT EXISTS idx_file_change_history_file ON file_change_history(monitored_file_id);
CREATE INDEX IF NOT EXISTS idx_file_change_history_status ON file_change_history(process_status);
CREATE INDEX IF NOT EXISTS idx_file_change_history_date ON file_change_history(detected_at);

-- =====================================================
-- 自動更新ルール設定
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_update_rules (
  id TEXT PRIMARY KEY,
  rule_name TEXT NOT NULL,
  description TEXT,
  
  -- マッチング条件
  field_pattern TEXT NOT NULL,  -- 対象フィールドのパターン（正規表現）
  change_type TEXT,  -- add, modify, delete, any
  
  -- アクション
  action TEXT NOT NULL,  -- auto_apply, require_review, notify_only, ignore
  notification_level TEXT DEFAULT 'normal',  -- none, low, normal, high, urgent
  
  -- 有効/無効
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,  -- 小さいほど優先
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- デフォルトルールの挿入
INSERT OR IGNORE INTO auto_update_rules (id, rule_name, description, field_pattern, change_type, action, notification_level, priority) VALUES
-- 自動適用可能な変更
('RULE-001', '締切日変更（延長）', '締切日が後ろにずれた場合は自動適用', 'acceptance_end|deadline', 'modify', 'auto_apply', 'normal', 10),
('RULE-002', '公式URL変更', '公式URLの変更は自動適用', 'official_url|pdf_url', 'modify', 'auto_apply', 'low', 20),
('RULE-003', '添付ファイル追加', '新しい添付ファイルの追加は自動適用', 'attachments|pdf_attachments', 'add', 'auto_apply', 'low', 30),

-- 要確認の変更
('RULE-010', '補助率変更', '補助率の変更は手動確認必須', 'subsidy_rate|rate', 'any', 'require_review', 'high', 100),
('RULE-011', '補助上限額変更', '補助上限額の変更は手動確認必須', 'subsidy_max_limit|max_limit|max_amount', 'any', 'require_review', 'high', 100),
('RULE-012', '申請要件変更', '申請要件の変更は手動確認必須', 'eligibility|requirements', 'any', 'require_review', 'high', 100),
('RULE-013', '対象経費変更', '対象経費の変更は手動確認必須', 'eligible_expenses|expenses', 'any', 'require_review', 'high', 100),
('RULE-014', '加点項目変更', '加点項目の変更は手動確認必須', 'bonus_points|bonus', 'any', 'require_review', 'normal', 100),

-- 締切日短縮は緊急
('RULE-020', '締切日変更（短縮）', '締切日が前倒しされた場合は緊急通知', 'acceptance_end|deadline', 'modify', 'require_review', 'urgent', 5);

-- =====================================================
-- 監視設定の初期データ
-- =====================================================

-- 業務改善助成金の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-GYOMU-KAIZEN',
  'GYOMU-KAIZEN',
  '厚生労働省 業務改善助成金ページ',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html',
  'webpage',
  24,
  '["a[href$=\".pdf\"]", "a[href$=\".docx\"]", "a[href$=\".xlsx\"]"]',
  '["https://www.mhlw.go.jp/content/11200000/\\\\d+\\\\.(pdf|docx?|xlsx?)"]',
  'active'
);

-- 業務改善助成金の監視対象ファイル
INSERT OR IGNORE INTO monitored_files (id, monitor_id, file_name, file_description, url_pattern, file_type, importance) VALUES
('MF-GK-001', 'MONITOR-GYOMU-KAIZEN', '交付要綱', '補助金の交付要綱（正式な規定）', '001555743\\.pdf', 'pdf', 'critical'),
('MF-GK-002', 'MONITOR-GYOMU-KAIZEN', '交付要領', '交付要綱の詳細な運用ルール', '001555744\\.pdf', 'pdf', 'critical'),
('MF-GK-003', 'MONITOR-GYOMU-KAIZEN', '申請マニュアル', '申請手続きの詳細ガイド', '001497074\\.pdf', 'pdf', 'high'),
('MF-GK-004', 'MONITOR-GYOMU-KAIZEN', 'リーフレット', '制度概要のリーフレット', 'リーフレット.*\\.pdf', 'pdf', 'medium'),
('MF-GK-005', 'MONITOR-GYOMU-KAIZEN', '申請様式', '申請書の様式（Word）', '001555951\\.docx', 'docx', 'high');

-- 省力化投資補助金の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-SHORYOKUKA',
  'SHORYOKUKA-IPPAN',
  '中小機構 省力化投資補助金ページ',
  'https://shoryokuka.smrj.go.jp/ippan/download/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://shoryokuka.smrj.go.jp/.*\\.pdf"]',
  'active'
);

-- 持続化補助金（一般型）の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-JIZOKUKA-IPPAN',
  'JIZOKUKA-IPPAN',
  '日本商工会議所 持続化補助金ページ',
  'https://r6.jizokukahojokin.info/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://r6.jizokukahojokin.info/doc/.*\\.pdf"]',
  'active'
);

-- 持続化補助金（創業型）の監視設定
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-JIZOKUKA-SOGYO',
  'JIZOKUKA-SOGYO',
  '日本商工会議所 持続化補助金（創業型）ページ',
  'https://r6.jizokukahojokin.info/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://r6.jizokukahojokin.info/doc/.*sogyo.*\\.pdf"]',
  'active'
);

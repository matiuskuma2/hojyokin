-- ============================================================
-- Migration 0124: 公募要領PDF定点観測システム
-- 
-- 目的: 
--   1. 補助金ごとの公募要領クローリングスケジュール管理
--   2. 公募時期の判定と直前クローリングの自動化
--   3. URL変更検知と再探索ロジック
--   4. 補助金中止の記録と再クローリング停止
--   5. 新規補助金の自動発見・登録
-- ============================================================

-- =====================
-- 1. 公募要領監視テーブル (koubo_monitors)
-- 各補助金ごとの公募要領PDFクローリングルールを管理
-- =====================
CREATE TABLE IF NOT EXISTS koubo_monitors (
  subsidy_id TEXT PRIMARY KEY,                -- subsidy_cache.id に対応
  
  -- 公募要領PDF情報
  koubo_pdf_url TEXT,                         -- 現在の公募要領PDF URL
  koubo_pdf_backup_urls TEXT,                 -- JSON配列: 過去のPDF URL履歴
  koubo_page_url TEXT,                        -- PDFが掲載されているHTMLページURL
  pdf_source_method TEXT DEFAULT 'unknown',   -- direct_pdf | sub_page | deep_crawl | google_search | manual
  
  -- 公募時期情報
  koubo_period_type TEXT DEFAULT 'unknown'
    CHECK (koubo_period_type IN (
      'annual_fixed',      -- 毎年固定時期 (例: 毎年4月)
      'annual_variable',   -- 毎年だが時期変動
      'biannual',          -- 年2回
      'quarterly',         -- 四半期ごと
      'irregular',         -- 不定期
      'one_time',          -- 1回限り
      'always_open',       -- 常時公募
      'unknown'            -- 未判定
    )),
  koubo_month_start INTEGER,                  -- 公募開始月 (1-12, NULLなら不明)
  koubo_month_end INTEGER,                    -- 公募終了月 (1-12, NULLなら不明)
  koubo_typical_open_date TEXT,               -- 典型的な公募開始日 (MM-DD形式)
  koubo_next_expected_at TEXT,                -- 次回公募予定日 (YYYY-MM-DD)
  
  -- クローリングスケジュール
  crawl_schedule TEXT DEFAULT 'monthly'
    CHECK (crawl_schedule IN (
      'pre_koubo',   -- 公募直前 (koubo_next_expected_at の2週間前から)
      'weekly',      -- 毎週
      'biweekly',    -- 隔週
      'monthly',     -- 毎月
      'quarterly',   -- 四半期
      'on_demand',   -- 手動のみ
      'stopped'      -- クローリング停止
    )),
  next_crawl_at TEXT,                         -- 次回クロール予定日
  last_crawl_at TEXT,                         -- 最終クロール実行日
  last_crawl_result TEXT DEFAULT 'pending'
    CHECK (last_crawl_result IN (
      'success',     -- PDF取得成功
      'url_changed', -- URL変更検知
      'not_found',   -- ページ消失
      'error',       -- クロールエラー
      'pending'      -- 未実行
    )),
  
  -- 状態管理
  status TEXT DEFAULT 'active'
    CHECK (status IN (
      'active',           -- アクティブに監視中
      'url_lost',         -- URL消失（再探索必要 → superadmin表示）
      'discontinued',     -- 補助金廃止
      'suspended',        -- 一時停止
      'needs_manual'      -- 手動対応必要 → superadmin表示
    )),
  discontinued_reason TEXT,                    -- 廃止理由
  discontinued_at TEXT,                        -- 廃止確認日
  
  -- URL変更追跡
  url_change_count INTEGER DEFAULT 0,          -- URL変更回数
  last_url_change_at TEXT,                     -- 最終URL変更日
  fallback_search_query TEXT,                  -- 再探索時のGoogle検索クエリ
  
  -- メタ情報
  notes TEXT,                                  -- 運用メモ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_koubo_monitors_schedule 
  ON koubo_monitors(crawl_schedule, next_crawl_at);
CREATE INDEX IF NOT EXISTS idx_koubo_monitors_status 
  ON koubo_monitors(status);
CREATE INDEX IF NOT EXISTS idx_koubo_monitors_result 
  ON koubo_monitors(last_crawl_result);

-- =====================
-- 2. クロール実行履歴 (koubo_crawl_log)
-- 実際のクロール実行結果を記録
-- =====================
CREATE TABLE IF NOT EXISTS koubo_crawl_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_id TEXT NOT NULL,
  
  -- 実行情報
  crawl_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (crawl_type IN ('scheduled', 'manual', 're_explore', 'new_discovery')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  
  -- 結果
  result TEXT NOT NULL DEFAULT 'running'
    CHECK (result IN (
      'running',
      'success',           -- PDF取得成功
      'url_changed',       -- URL変更を検知
      'new_url_found',     -- 再探索で新URL発見
      'page_not_found',    -- ページ消失
      'pdf_not_found',     -- ページはあるがPDFなし
      'subsidy_discontinued', -- 補助金廃止を検知
      'new_subsidy_found', -- 新規補助金を発見
      'error'              -- エラー
    )),
  
  -- URL情報
  checked_url TEXT,                            -- チェックしたURL
  found_pdf_url TEXT,                          -- 見つかったPDF URL
  previous_pdf_url TEXT,                       -- 変更前のPDF URL
  
  -- 新規発見情報
  discovered_title TEXT,                       -- 新規発見した補助金名
  discovered_url TEXT,                         -- 新規発見した補助金URL
  
  -- 詳細
  http_status INTEGER,
  error_message TEXT,
  content_hash TEXT,                           -- ページコンテンツのハッシュ値
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (subsidy_id) REFERENCES subsidy_cache(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_koubo_crawl_log_subsidy 
  ON koubo_crawl_log(subsidy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_koubo_crawl_log_result 
  ON koubo_crawl_log(result, created_at DESC);

-- =====================
-- 3. 新規補助金発見キュー (koubo_discovery_queue)
-- サイト探索時に発見した未登録補助金を記録
-- =====================
CREATE TABLE IF NOT EXISTS koubo_discovery_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 発見元情報
  discovered_from_subsidy_id TEXT,             -- どの補助金の探索中に発見したか
  discovered_from_url TEXT NOT NULL,           -- 発見元のURL
  discovered_from_domain TEXT,                 -- ドメイン
  
  -- 発見した補助金情報
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  pdf_url TEXT,
  issuer_name TEXT,                            -- 発行元
  
  -- 状態
  status TEXT DEFAULT 'pending'
    CHECK (status IN (
      'pending',           -- 確認待ち
      'approved',          -- 承認（DB登録済み）
      'rejected',          -- 却下（重複or対象外）
      'duplicate'          -- 既存と重複
    )),
  approved_subsidy_id TEXT,                    -- 承認後のsubsidy_cache.id
  rejected_reason TEXT,
  
  -- 重複チェック
  dedupe_key TEXT UNIQUE,                      -- 重複排除キー
  similarity_score REAL,                       -- 既存案件との類似度
  similar_to_id TEXT,                          -- 類似した既存案件ID
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_koubo_discovery_status 
  ON koubo_discovery_queue(status);

-- =====================
-- 4. subsidy_lifecycle テーブルへの拡張列追加
-- (既存テーブルに定点観測用の情報を追加)
-- =====================

-- 補助金の廃止フラグを追加
-- subsidy_lifecycle は既にstatus='suspended'をサポート
-- close_reason に 'discontinued' を追加する CHECK 制約は変更不可なので notes に記録

-- =====================
-- 5. 初期ビュー: superadmin向けダッシュボード用
-- =====================
CREATE VIEW IF NOT EXISTS v_koubo_monitor_dashboard AS
SELECT 
  km.subsidy_id,
  sc.title,
  sc.source,
  km.status,
  km.koubo_pdf_url,
  km.koubo_page_url,
  km.koubo_period_type,
  km.crawl_schedule,
  km.next_crawl_at,
  km.last_crawl_at,
  km.last_crawl_result,
  km.url_change_count,
  CASE 
    WHEN km.status = 'url_lost' THEN 'URL消失 - 再探索必要'
    WHEN km.status = 'needs_manual' THEN '手動対応必要'
    WHEN km.status = 'discontinued' THEN '補助金廃止'
    WHEN km.last_crawl_result = 'url_changed' THEN 'URL変更検知'
    WHEN km.next_crawl_at < datetime('now') THEN 'クロール期限超過'
    ELSE 'OK'
  END as alert_status,
  km.updated_at
FROM koubo_monitors km
JOIN subsidy_cache sc ON sc.id = km.subsidy_id
ORDER BY 
  CASE km.status
    WHEN 'url_lost' THEN 1
    WHEN 'needs_manual' THEN 2
    WHEN 'active' THEN 3
    WHEN 'suspended' THEN 4
    WHEN 'discontinued' THEN 5
  END,
  km.next_crawl_at ASC;

-- superadmin: 新規発見一覧
CREATE VIEW IF NOT EXISTS v_koubo_discoveries_pending AS
SELECT 
  kdq.*,
  sc.title as parent_subsidy_title
FROM koubo_discovery_queue kdq
LEFT JOIN subsidy_cache sc ON sc.id = kdq.discovered_from_subsidy_id
WHERE kdq.status = 'pending'
ORDER BY kdq.created_at DESC;

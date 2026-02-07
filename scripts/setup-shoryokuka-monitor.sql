-- 省力化補助金（一般型）第5回公募 の自動更新監視設定
-- 実行日: 2026-02-07

-- Step 1: data_source_monitors に登録（ダウンロードページを監視）
INSERT OR REPLACE INTO data_source_monitors (
  id,
  subsidy_canonical_id,
  subsidy_cache_id,
  source_name,
  source_url,
  monitor_type,
  check_interval_hours,
  url_patterns,
  content_selectors,
  status,
  notes,
  created_at,
  updated_at
) VALUES (
  'monitor-shoryokuka-ippan-05',
  'SHORYOKUKA-IPPAN-05',
  'SHORYOKUKA-IPPAN-05',
  '省力化補助金（一般型）第5回 ダウンロードページ',
  'https://shoryokuka.smrj.go.jp/ippan/download/',
  'page_files',
  168,  -- 週1回（168時間）
  '{"pdf": ".pdf$", "xlsx": ".xlsx$", "docx": ".docx$"}',
  '{"files": "a[href*=assets]"}',
  'active',
  '月1回程度の確認で十分。締切近づいたら頻度上げる。',
  datetime('now'),
  datetime('now')
);

-- Step 2: メインページも監視（お知らせ等）
INSERT OR REPLACE INTO data_source_monitors (
  id,
  subsidy_canonical_id,
  subsidy_cache_id,
  source_name,
  source_url,
  monitor_type,
  check_interval_hours,
  content_selectors,
  status,
  notes,
  created_at,
  updated_at
) VALUES (
  'monitor-shoryokuka-ippan-05-main',
  'SHORYOKUKA-IPPAN-05',
  'SHORYOKUKA-IPPAN-05',
  '省力化補助金（一般型）メインページ',
  'https://shoryokuka.smrj.go.jp/ippan/',
  'page_content',
  168,  -- 週1回
  '{"schedule": ".schedule", "notice": ".notice"}',
  'active',
  '受付期間等の変更を検知',
  datetime('now'),
  datetime('now')
);

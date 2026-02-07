-- 省力化補助金（一般型）第5回公募をSSOT（subsidy_canonical + subsidy_snapshot）に登録
-- 実行日: 2026-02-07

-- Step 1: subsidy_canonical に登録
INSERT OR REPLACE INTO subsidy_canonical (
  id,
  name,
  name_normalized,
  issuer_name,
  prefecture_code,
  is_active,
  latest_cache_id,
  created_at,
  updated_at
) VALUES (
  'SHORYOKUKA-IPPAN-05',
  '中小企業省力化投資補助金（一般型）第5回公募',
  '中小企業省力化投資補助金一般型第5回公募',
  '独立行政法人中小企業基盤整備機構',
  NULL,  -- 全国対象なのでNULL
  1,
  'SHORYOKUKA-IPPAN-05',
  datetime('now'),
  datetime('now')
);

-- Step 2: subsidy_snapshot に登録
INSERT INTO subsidy_snapshot (
  id,
  canonical_id,
  is_accepting,
  acceptance_start,
  acceptance_end,
  subsidy_max_limit,
  subsidy_min_limit,
  subsidy_rate,
  target_area_text,
  target_industry_codes,
  target_employee_text,
  official_url,
  detail_json,
  snapshot_at,
  content_hash
) VALUES (
  'snapshot-SHORYOKUKA-IPPAN-05-' || strftime('%Y%m%d', 'now'),
  'SHORYOKUKA-IPPAN-05',
  1,  -- 受付中
  '2025-12-01',
  '2026-06-30',
  100000000,  -- 最大1億円（特例適用時、101人以上）
  500000,     -- 最小50万円
  '1/2～2/3',
  '全国',
  NULL,
  '従業員1名以上の中小企業・小規模事業者',
  'https://shoryokuka.smrj.go.jp/ippan/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'SHORYOKUKA-IPPAN-05'),
  datetime('now'),
  'manual-' || strftime('%Y%m%d%H%M%S', 'now')
);

-- Step 3: subsidy_canonical に latest_snapshot_id を設定
UPDATE subsidy_canonical
SET latest_snapshot_id = (
  SELECT id FROM subsidy_snapshot 
  WHERE canonical_id = 'SHORYOKUKA-IPPAN-05'
  ORDER BY snapshot_at DESC LIMIT 1
)
WHERE id = 'SHORYOKUKA-IPPAN-05';

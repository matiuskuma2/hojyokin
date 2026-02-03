-- 手動登録補助金をSSOT（subsidy_canonical + subsidy_snapshot）に追加
-- これにより、SSOT検索で手動登録した補助金も検索結果に表示される

-- 1. 省力化投資補助金（一般型）第5回
INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name, prefecture_code,
  latest_snapshot_id, latest_cache_id, is_active,
  notes, created_at, updated_at
) VALUES (
  'SHORYOKUKA-IPPAN-05',
  '中小企業省力化投資補助金（一般型）第5回公募',
  '中小企業省力化投資補助金一般型第5回公募',
  '中小企業庁',
  '00',  -- 全国
  'SHORYOKUKA-IPPAN-05-SNAP-001',
  'SHORYOKUKA-IPPAN-05',
  1,
  '手動登録: 公募要領PDFから抽出',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, round_key, fiscal_year,
  acceptance_start, acceptance_end, is_accepting,
  subsidy_max_limit, subsidy_rate, subsidy_rate_max,
  target_area_text, target_employee_text,
  official_url, detail_json, snapshot_at, created_at
) VALUES (
  'SHORYOKUKA-IPPAN-05-SNAP-001',
  'SHORYOKUKA-IPPAN-05',
  '第5回公募',
  '2025',
  '2025-12-01T00:00:00Z',
  '2026-06-30T17:00:00Z',
  1,  -- 現在募集中
  80000000,  -- 8,000万円（101人以上）
  '1/2〜2/3',
  0.67,
  '全国',
  '中小企業・小規模事業者（従業員1名以上）',
  'https://shoryokuka.smrj.go.jp/ippan/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'SHORYOKUKA-IPPAN-05'),
  datetime('now'),
  datetime('now')
);

-- 2. 持続化補助金（創業型）第3回
INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name, prefecture_code,
  latest_snapshot_id, latest_cache_id, is_active,
  notes, created_at, updated_at
) VALUES (
  'JIZOKUKA-SOGYO-03',
  '小規模事業者持続化補助金（創業型）第3回公募',
  '小規模事業者持続化補助金創業型第3回公募',
  '全国商工会連合会',
  '00',  -- 全国
  'JIZOKUKA-SOGYO-03-SNAP-001',
  'JIZOKUKA-SOGYO-03',
  1,
  '手動登録: 公募要領PDFから抽出',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, round_key, fiscal_year,
  acceptance_start, acceptance_end, is_accepting,
  subsidy_max_limit, subsidy_rate, subsidy_rate_max,
  target_area_text, target_employee_text,
  official_url, detail_json, snapshot_at, created_at
) VALUES (
  'JIZOKUKA-SOGYO-03-SNAP-001',
  'JIZOKUKA-SOGYO-03',
  '第3回公募',
  '2026',
  '2026-01-06T00:00:00Z',
  '2026-04-30T17:00:00Z',
  1,  -- 現在募集中
  2000000,  -- 200万円（インボイス特例で最大250万円）
  '2/3',
  0.67,
  '全国',
  '小規模事業者（商業・サービス業は5人以下、その他は20人以下）',
  'https://r6.jizokukahojokin.info/sogyo/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JIZOKUKA-SOGYO-03'),
  datetime('now'),
  datetime('now')
);

-- 3. 持続化補助金（一般型）第19回
INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name, prefecture_code,
  latest_snapshot_id, latest_cache_id, is_active,
  notes, created_at, updated_at
) VALUES (
  'JIZOKUKA-IPPAN-19',
  '小規模事業者持続化補助金（一般型）第19回公募',
  '小規模事業者持続化補助金一般型第19回公募',
  '全国商工会議所連合会',
  '00',  -- 全国
  'JIZOKUKA-IPPAN-19-SNAP-001',
  'JIZOKUKA-IPPAN-19',
  1,
  '手動登録: 公募要領PDFから抽出',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO subsidy_snapshot (
  id, canonical_id, round_key, fiscal_year,
  acceptance_start, acceptance_end, is_accepting,
  subsidy_max_limit, subsidy_rate, subsidy_rate_max,
  target_area_text, target_employee_text,
  official_url, detail_json, snapshot_at, created_at
) VALUES (
  'JIZOKUKA-IPPAN-19-SNAP-001',
  'JIZOKUKA-IPPAN-19',
  '第19回公募',
  '2026',
  '2026-03-06T00:00:00Z',
  '2026-04-30T17:00:00Z',
  1,  -- 現在募集中
  500000,  -- 50万円（通常枠。特例で最大250万円）
  '2/3',
  0.67,
  '全国',
  '小規模事業者（商業・サービス業は5人以下、その他は20人以下）',
  'https://r6.jizokukahojokin.info/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JIZOKUKA-IPPAN-19'),
  datetime('now'),
  datetime('now')
);

-- 4. 旧REAL-003 (第17回) を非アクティブにする
UPDATE subsidy_canonical 
SET is_active = 0,
    notes = '終了: 第17回は2025年6月30日締切で終了済み。第19回に移行',
    updated_at = datetime('now')
WHERE id = 'REAL-003';

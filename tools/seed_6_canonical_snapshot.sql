-- =====================================================
-- 6件の新規補助金: subsidy_canonical + subsidy_snapshot 作成
-- FK制約: snapshot.canonical_id → canonical.id なので canonical を先に挿入
-- =====================================================

-- =====================================================
-- Step 1: subsidy_canonical を先に6件挿入
-- =====================================================

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name,
  latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'SHORYOKUKA-CATALOG',
  '中小企業省力化投資補助金（カタログ注文型）',
  '中小企業省力化投資補助金カタログ注文型',
  '中小企業基盤整備機構',
  'SHORYOKUKA-CATALOG',
  'snapshot-SHORYOKUKA-CATALOG-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name,
  latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'JIZOKUKA-KYODO-02',
  '小規模事業者持続化補助金（共同・協業型）第2回公募',
  '小規模事業者持続化補助金共同協業型第2回公募',
  '全国商工会連合会',
  'JIZOKUKA-KYODO-02',
  'snapshot-JIZOKUKA-KYODO-02-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name,
  latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'JIZOKUKA-NOTO-09',
  '小規模事業者持続化補助金（災害支援枠・令和6年能登半島地震等）第9次',
  '小規模事業者持続化補助金災害支援枠令和6年能登半島地震等第9次',
  '全国商工会連合会／日本商工会議所',
  'JIZOKUKA-NOTO-09',
  'snapshot-JIZOKUKA-NOTO-09-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name,
  latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'CAREER-UP-SEISHAIN',
  'キャリアアップ助成金（正社員化コース）',
  'キャリアアップ助成金正社員化コース',
  '厚生労働省',
  'CAREER-UP-SEISHAIN',
  'snapshot-CAREER-UP-SEISHAIN-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name,
  latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'JINZAI-RESKILLING',
  '人材開発支援助成金（事業展開等リスキリング支援コース）',
  '人材開発支援助成金事業展開等リスキリング支援コース',
  '厚生労働省',
  'JINZAI-RESKILLING',
  'snapshot-JINZAI-RESKILLING-20260208',
  1, datetime('now'), datetime('now')
);

INSERT OR REPLACE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name,
  latest_cache_id, latest_snapshot_id,
  is_active, created_at, updated_at
) VALUES (
  'JINZAI-IKUSEI',
  '人材開発支援助成金（人材育成支援コース）',
  '人材開発支援助成金人材育成支援コース',
  '厚生労働省',
  'JINZAI-IKUSEI',
  'snapshot-JINZAI-IKUSEI-20260208',
  1, datetime('now'), datetime('now')
);

-- =====================================================
-- Step 2: subsidy_snapshot を6件挿入（canonical 挿入後）
-- detail_json は subsidy_cache から参照コピー
-- =====================================================

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES (
  'snapshot-SHORYOKUKA-CATALOG-20260208',
  'SHORYOKUKA-CATALOG',
  1, 15000000, '1/2以内',
  '2024-09-01', '2026-09-30', '全国',
  'https://shoryokuka.smrj.go.jp/catalog/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'SHORYOKUKA-CATALOG'),
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES (
  'snapshot-JIZOKUKA-KYODO-02-20260208',
  'JIZOKUKA-KYODO-02',
  1, 50000000, '2/3以内',
  '2026-01-16', '2026-02-27', '全国',
  'https://r6.kyodokyogyohojokin.info/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JIZOKUKA-KYODO-02'),
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES (
  'snapshot-JIZOKUKA-NOTO-09-20260208',
  'JIZOKUKA-NOTO-09',
  1, 2000000, '2/3以内',
  '2026-01-23', '2026-03-31', '石川県,富山県,新潟県,福井県',
  'https://r6.jizokukahojokin.info/noto/',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JIZOKUKA-NOTO-09'),
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES (
  'snapshot-CAREER-UP-SEISHAIN-20260208',
  'CAREER-UP-SEISHAIN',
  1, 800000, '定額支給',
  '2025-04-01', '2027-03-31', '全国',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'CAREER-UP-SEISHAIN'),
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES (
  'snapshot-JINZAI-RESKILLING-20260208',
  'JINZAI-RESKILLING',
  1, 100000000, '75%（中小企業）/ 60%（大企業）',
  '2025-04-01', '2027-03-31', '全国',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/jigyounaikaihatukeikaku.html',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JINZAI-RESKILLING'),
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO subsidy_snapshot (
  id, canonical_id, is_accepting, subsidy_max_limit, subsidy_rate,
  acceptance_start, acceptance_end, target_area_text, official_url,
  detail_json, snapshot_at, created_at
) VALUES (
  'snapshot-JINZAI-IKUSEI-20260208',
  'JINZAI-IKUSEI',
  1, 10000000, '70%（中小企業OFF-JT経費）',
  '2025-04-01', '2027-03-31', '全国',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/jigyounaikaihatukeikaku.html',
  (SELECT detail_json FROM subsidy_cache WHERE id = 'JINZAI-IKUSEI'),
  datetime('now'), datetime('now')
);

-- =====================================================
-- Step 3: wall_chat_mode を 'cache' に更新
-- =====================================================
UPDATE subsidy_cache SET wall_chat_mode = 'cache' 
WHERE id IN ('SHORYOKUKA-CATALOG','JIZOKUKA-KYODO-02','JIZOKUKA-NOTO-09','CAREER-UP-SEISHAIN','JINZAI-RESKILLING','JINZAI-IKUSEI');

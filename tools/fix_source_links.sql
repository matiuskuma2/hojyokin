-- subsidy_source_link に cache_id → canonical_id のリンクを追加
-- これにより cache_id で直接APIアクセスが可能になる

-- IT-SUBSIDY-2026系（5枠すべて）
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES 
  ('link-IT-2026-TSUJYO', 'IT-SUBSIDY-2026', 'manual', 'IT-SUBSIDY-2026-TSUJYO', 'system', 1, datetime('now'), datetime('now')),
  ('link-IT-2026-INVOICE', 'IT-SUBSIDY-2026', 'manual', 'IT-SUBSIDY-2026-INVOICE', 'system', 1, datetime('now'), datetime('now')),
  ('link-IT-2026-DENSHI', 'IT-SUBSIDY-2026', 'manual', 'IT-SUBSIDY-2026-DENSHI', 'system', 1, datetime('now'), datetime('now')),
  ('link-IT-2026-SECURITY', 'IT-SUBSIDY-2026', 'manual', 'IT-SUBSIDY-2026-SECURITY', 'system', 1, datetime('now'), datetime('now')),
  ('link-IT-2026-FUKUSU', 'IT-SUBSIDY-2026', 'manual', 'IT-SUBSIDY-2026-FUKUSU', 'system', 1, datetime('now'), datetime('now'));

-- 省エネ系
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES 
  ('link-SHOUENE-KOUJOU-06', 'SHOUENE-ENECHO', 'manual', 'SHOUENE-KOUJOU-06', 'system', 1, datetime('now'), datetime('now')),
  ('link-SHOUENE-SETSUBI-06', 'SHOUENE-ENECHO', 'manual', 'SHOUENE-SETSUBI-06', 'system', 1, datetime('now'), datetime('now'));

-- 業務改善助成金
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES ('link-GYOMU-KAIZEN-R7', 'GYOMU-KAIZEN', 'manual', 'GYOMU-KAIZEN-R7', 'system', 1, datetime('now'), datetime('now'));

-- Go-Tech
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES ('link-GO-TECH-R8', 'GO-TECH', 'manual', 'GO-TECH-R8', 'system', 1, datetime('now'), datetime('now'));

-- 事業再構築
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES ('link-SAIKOUCHIKU-FINAL', 'SAIKOUCHIKU', 'manual', 'SAIKOUCHIKU-FINAL', 'system', 1, datetime('now'), datetime('now'));

-- 省力化一般型
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES 
  ('link-SHORYOKUKA-IPPAN-05', 'SHORYOKUKA-IPPAN', 'manual', 'SHORYOKUKA-IPPAN-05', 'system', 1, datetime('now'), datetime('now')),
  ('link-SHORYOKUKA-IPPAN-06', 'SHORYOKUKA-IPPAN', 'manual', 'SHORYOKUKA-IPPAN-06', 'system', 1, datetime('now'), datetime('now'));

-- 両立支援
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES ('link-RYOURITSU-SHUSSEI', 'RYOURITSU-SHIEN', 'manual', 'RYOURITSU-SHUSSEI', 'system', 1, datetime('now'), datetime('now'));

-- その他 cache_id → canonical_id のリンク補完
INSERT OR IGNORE INTO subsidy_source_link (id, canonical_id, source_type, source_id, match_type, verified, created_at, updated_at)
VALUES 
  ('link-MONODUKURI-23', 'MONODUKURI-23', 'manual', 'MONODUKURI-23', 'system', 1, datetime('now'), datetime('now')),
  ('link-SEICHOU-KASOKU-02', 'SEICHOU-KASOKU-02', 'manual', 'SEICHOU-KASOKU-02', 'system', 1, datetime('now'), datetime('now')),
  ('link-SHINJIGYO-03', 'SHINJIGYO-03', 'manual', 'SHINJIGYO-03', 'system', 1, datetime('now'), datetime('now')),
  ('link-JIGYOSHOKEI-MA-14', 'JIGYOSHOKEI-MA-14', 'manual', 'JIGYOSHOKEI-MA-14', 'system', 1, datetime('now'), datetime('now')),
  ('link-JIZOKUKA-IPPAN-19', 'JIZOKUKA-IPPAN-19', 'manual', 'JIZOKUKA-IPPAN-19', 'system', 1, datetime('now'), datetime('now')),
  ('link-JIZOKUKA-SOGYO-03', 'JIZOKUKA-SOGYO-03', 'manual', 'JIZOKUKA-SOGYO-03', 'system', 1, datetime('now'), datetime('now')),
  ('link-JIZOKUKA-KYODO-02', 'JIZOKUKA-KYODO-02', 'manual', 'JIZOKUKA-KYODO-02', 'system', 1, datetime('now'), datetime('now')),
  ('link-JIZOKUKA-NOTO-09', 'JIZOKUKA-NOTO-09', 'manual', 'JIZOKUKA-NOTO-09', 'system', 1, datetime('now'), datetime('now')),
  ('link-SHORYOKUKA-CATALOG', 'SHORYOKUKA-CATALOG', 'manual', 'SHORYOKUKA-CATALOG', 'system', 1, datetime('now'), datetime('now')),
  ('link-CAREER-UP-SEISHAIN', 'CAREER-UP-SEISHAIN', 'manual', 'CAREER-UP-SEISHAIN', 'system', 1, datetime('now'), datetime('now')),
  ('link-JINZAI-RESKILLING', 'JINZAI-RESKILLING', 'manual', 'JINZAI-RESKILLING', 'system', 1, datetime('now'), datetime('now')),
  ('link-JINZAI-IKUSEI', 'JINZAI-IKUSEI', 'manual', 'JINZAI-IKUSEI', 'system', 1, datetime('now'), datetime('now'));

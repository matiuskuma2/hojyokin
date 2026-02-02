-- =============================================================================
-- 0115_izumi_canonical_link.sql
-- 泉 → canonical 紐付け（段階的マッチング）
-- =============================================================================
-- 
-- match_type:
-- - strong (0.9+): タイトル完全一致 OR (タイトル部分一致 AND 金額一致)
-- - medium (0.7-0.9): タイトル部分一致 AND 地域一致
-- - weak (0.5-0.7): タイトル部分一致のみ（保持のみ、検索表示には使わない）
--
-- 紐付け先: subsidy_source_link + izumi_subsidies.canonical_id
-- =============================================================================

-- =============================================================================
-- Step 1: タイトル完全一致（strong）
-- =============================================================================
INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, match_score, match_fields, match_reason, created_at
)
SELECT 
  'izumi-link-' || i.policy_id,
  c.id,
  'izumi',
  'izumi-' || i.policy_id,
  'auto',
  0.95,
  '["title_exact"]',
  'タイトル完全一致',
  datetime('now')
FROM izumi_subsidies i
INNER JOIN subsidy_canonical c ON i.title = c.name
WHERE i.is_active = 1 
  AND c.is_active = 1
  AND i.canonical_id IS NULL;

-- izumi_subsidies.canonical_id も更新
UPDATE izumi_subsidies
SET canonical_id = (
  SELECT c.id 
  FROM subsidy_canonical c 
  WHERE izumi_subsidies.title = c.name 
    AND c.is_active = 1
  LIMIT 1
),
match_method = 'exact_title',
match_score = 0.95,
updated_at = datetime('now')
WHERE is_active = 1
  AND canonical_id IS NULL
  AND EXISTS (
    SELECT 1 FROM subsidy_canonical c 
    WHERE izumi_subsidies.title = c.name AND c.is_active = 1
  );

-- =============================================================================
-- Step 2: タイトル部分一致 + 金額レンジ一致（strong）
-- 泉のmax_amount_value と jGrants の subsidy_max_limit が±50%以内
-- =============================================================================
INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, match_score, match_fields, match_reason, created_at
)
SELECT 
  'izumi-link-' || i.policy_id,
  c.id,
  'izumi',
  'izumi-' || i.policy_id,
  'auto',
  0.85,
  '["title_partial", "amount_range"]',
  'タイトル部分一致 + 金額レンジ一致',
  datetime('now')
FROM izumi_subsidies i
INNER JOIN subsidy_canonical c ON (
  -- タイトル部分一致（先頭15文字）
  i.title LIKE '%' || SUBSTR(REPLACE(REPLACE(c.name, '令和', ''), '年度', ''), 1, 15) || '%'
  OR c.name LIKE '%' || SUBSTR(REPLACE(REPLACE(i.title, '令和', ''), '年度', ''), 1, 15) || '%'
)
INNER JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
WHERE i.is_active = 1 
  AND c.is_active = 1
  AND i.canonical_id IS NULL
  -- 金額レンジ一致（±50%）
  AND i.max_amount_value IS NOT NULL
  AND s.subsidy_max_limit IS NOT NULL
  AND i.max_amount_value BETWEEN s.subsidy_max_limit * 0.5 AND s.subsidy_max_limit * 1.5
  -- 既に紐付け済みでない
  AND NOT EXISTS (
    SELECT 1 FROM subsidy_source_link l 
    WHERE l.source_type = 'izumi' AND l.source_id = 'izumi-' || i.policy_id
  );

-- izumi_subsidies.canonical_id 更新（金額マッチ分）
UPDATE izumi_subsidies
SET canonical_id = (
  SELECT c.id 
  FROM subsidy_canonical c 
  INNER JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
  WHERE c.is_active = 1
    AND (
      izumi_subsidies.title LIKE '%' || SUBSTR(REPLACE(REPLACE(c.name, '令和', ''), '年度', ''), 1, 15) || '%'
      OR c.name LIKE '%' || SUBSTR(REPLACE(REPLACE(izumi_subsidies.title, '令和', ''), '年度', ''), 1, 15) || '%'
    )
    AND izumi_subsidies.max_amount_value IS NOT NULL
    AND s.subsidy_max_limit IS NOT NULL
    AND izumi_subsidies.max_amount_value BETWEEN s.subsidy_max_limit * 0.5 AND s.subsidy_max_limit * 1.5
  LIMIT 1
),
match_method = 'title_amount',
match_score = 0.85,
updated_at = datetime('now')
WHERE is_active = 1
  AND canonical_id IS NULL
  AND max_amount_value IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM subsidy_canonical c 
    INNER JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
    WHERE c.is_active = 1
      AND (
        izumi_subsidies.title LIKE '%' || SUBSTR(REPLACE(REPLACE(c.name, '令和', ''), '年度', ''), 1, 15) || '%'
        OR c.name LIKE '%' || SUBSTR(REPLACE(REPLACE(izumi_subsidies.title, '令和', ''), '年度', ''), 1, 15) || '%'
      )
      AND s.subsidy_max_limit IS NOT NULL
      AND izumi_subsidies.max_amount_value BETWEEN s.subsidy_max_limit * 0.5 AND s.subsidy_max_limit * 1.5
  );

-- =============================================================================
-- Step 3: タイトル部分一致 + 都道府県一致（medium）
-- =============================================================================
INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, match_score, match_fields, match_reason, created_at
)
SELECT 
  'izumi-link-' || i.policy_id,
  c.id,
  'izumi',
  'izumi-' || i.policy_id,
  'auto',
  0.75,
  '["title_partial", "prefecture"]',
  'タイトル部分一致 + 都道府県一致',
  datetime('now')
FROM izumi_subsidies i
INNER JOIN subsidy_canonical c ON (
  i.title LIKE '%' || SUBSTR(REPLACE(REPLACE(c.name, '令和', ''), '年度', ''), 1, 12) || '%'
  OR c.name LIKE '%' || SUBSTR(REPLACE(REPLACE(i.title, '令和', ''), '年度', ''), 1, 12) || '%'
)
WHERE i.is_active = 1 
  AND c.is_active = 1
  AND i.canonical_id IS NULL
  -- 都道府県一致
  AND i.prefecture_code IS NOT NULL
  AND c.prefecture_code IS NOT NULL
  AND i.prefecture_code = c.prefecture_code
  -- 既に紐付け済みでない
  AND NOT EXISTS (
    SELECT 1 FROM subsidy_source_link l 
    WHERE l.source_type = 'izumi' AND l.source_id = 'izumi-' || i.policy_id
  );

-- izumi_subsidies.canonical_id 更新（都道府県マッチ分）
UPDATE izumi_subsidies
SET canonical_id = (
  SELECT c.id 
  FROM subsidy_canonical c 
  WHERE c.is_active = 1
    AND (
      izumi_subsidies.title LIKE '%' || SUBSTR(REPLACE(REPLACE(c.name, '令和', ''), '年度', ''), 1, 12) || '%'
      OR c.name LIKE '%' || SUBSTR(REPLACE(REPLACE(izumi_subsidies.title, '令和', ''), '年度', ''), 1, 12) || '%'
    )
    AND izumi_subsidies.prefecture_code IS NOT NULL
    AND c.prefecture_code IS NOT NULL
    AND izumi_subsidies.prefecture_code = c.prefecture_code
  LIMIT 1
),
match_method = 'title_prefecture',
match_score = 0.75,
updated_at = datetime('now')
WHERE is_active = 1
  AND canonical_id IS NULL
  AND prefecture_code IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM subsidy_canonical c 
    WHERE c.is_active = 1
      AND (
        izumi_subsidies.title LIKE '%' || SUBSTR(REPLACE(REPLACE(c.name, '令和', ''), '年度', ''), 1, 12) || '%'
        OR c.name LIKE '%' || SUBSTR(REPLACE(REPLACE(izumi_subsidies.title, '令和', ''), '年度', ''), 1, 12) || '%'
      )
      AND c.prefecture_code IS NOT NULL
      AND izumi_subsidies.prefecture_code = c.prefecture_code
  );

-- =============================================================================
-- 検証クエリ
-- =============================================================================
-- SELECT 
--   match_method,
--   COUNT(*) as count,
--   ROUND(AVG(match_score), 2) as avg_score
-- FROM izumi_subsidies
-- WHERE canonical_id IS NOT NULL
-- GROUP BY match_method
-- ORDER BY count DESC;

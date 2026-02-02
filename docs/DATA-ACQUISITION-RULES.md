# データ取得・更新ルール（SSOT前提）

## 0. 運用前提（固定）

### 受付中判定（検索デフォルト）
- **正**: `subsidy_snapshot.is_accepting = 1`
- **条件**: `acceptance_start <= now() <= acceptance_end`
- **注意**: 募集開始前（`acceptance_start > now()`）は受付中にしない

### 表示の優先順位
1. **subsidy_canonical / latest_snapshot** → 検索・一覧の正（SSOT）
2. **subsidy_cache** → 詳細の補助・表示キャッシュ・壁打ち素材
3. **izumi_subsidies** → 検索補助のみ（Active判定には使わない）
4. **orphan_pdf** → 受付中判定には使わず、補助表示のみ

---

## 1. データソース別 取得ルール

### 1-A. jGrants（主ソース）

| 項目 | 取得元 | 格納先 | 優先度 |
|------|--------|--------|--------|
| 補助金ID | API `id` | `subsidy_canonical.id` (prefix: `jg-`) | P0 |
| 補助金名 | API `name` | `subsidy_canonical.name` | P0 |
| 募集開始日 | API `workflows[0].acceptance_start` | `subsidy_snapshot.acceptance_start` | P0 |
| 募集終了日 | API `workflows[0].acceptance_end` | `subsidy_snapshot.acceptance_end` | P0 |
| 補助上限 | API `support_amount.max_amount_limit` | `subsidy_snapshot.subsidy_max_limit` | P0 |
| 補助率 | API `support_amount.subsidy_rate` | `subsidy_snapshot.subsidy_rate` | P1 |
| 対象地域 | API `workflows[0].target_area` | `subsidy_snapshot.target_area_text` | P0 |
| 対象業種 | API `target_industry` | `subsidy_snapshot.target_industry_codes` | P0 |
| 対象従業員規模 | API `target_employees` | `subsidy_snapshot.target_employee_text` | P0 |
| 公式URL | API `related_url` / `official_url` | `subsidy_snapshot.official_url` | P1 |
| PDF添付 | API `attachments` | `subsidy_snapshot.pdf_urls` | P1 |
| 詳細JSON | API response全体 | `subsidy_snapshot.detail_json` | P1 |

**取得タイミング**:
- **daily**: 全件差分同期（`content_hash` で変更検知）
- **即時**: 新規補助金の追加

### 1-B. 泉（izumi）

| 項目 | 取得元 | 格納先 | 用途 |
|------|--------|--------|------|
| policy_id | j-izumi API | `izumi_subsidies.policy_id` | 一意識別子 |
| 補助金名 | j-izumi API | `izumi_subsidies.title` | 紐付け用 |
| 上限金額 | j-izumi API | `izumi_subsidies.max_amount_value` | 紐付け補強 |
| 難易度 | j-izumi API | `izumi_subsidies.difficulty` | 検索補助表示 |
| 公式URL | j-izumi API | `izumi_subsidies.support_url` | 詳細リンク |

**取得タイミング**:
- **weekly**: 差分同期（`row_hash` で変更検知）
- **weekly**: URL生存チェック

**紐付けルール**:
- `match_type = 'strong'` (0.9+): タイトル完全一致 OR 金額一致+部分一致
- `match_type = 'medium'` (0.7-0.9): タイトル部分一致
- `match_type = 'weak'` (0.5-0.7): 推定のみ（バックエンド保持、UI非表示）

### 1-C. orphan_pdf（補助ソース）

| 項目 | 取得元 | 格納先 | 用途 |
|------|--------|--------|------|
| PDF URL | 発見元サイト | `orphan_pdf.source_url` | 参照 |
| 抽出テキスト | AI解析 | `orphan_pdf.extracted_text` | 補助表示 |

**取得タイミング**:
- **monthly**: URL生存チェック + 新規発見
- **受付中判定には使わない**

---

## 2. 更新ルール（差分検知）

### 2-A. jGrants 差分検知

```sql
-- content_hash で変更検知
SELECT id, name, content_hash 
FROM subsidy_snapshot 
WHERE canonical_id = ? 
ORDER BY snapshot_at DESC 
LIMIT 1;

-- 新旧比較
IF new_content_hash != old_content_hash THEN
  INSERT INTO subsidy_snapshot (...);
  UPDATE subsidy_canonical SET latest_snapshot_id = new_snapshot_id;
END IF;
```

### 2-B. 泉 差分検知

```sql
-- row_hash で変更検知
SELECT id, row_hash, last_seen_at 
FROM izumi_subsidies 
WHERE policy_id = ?;

-- 更新判定
IF new_row_hash != old_row_hash THEN
  UPDATE izumi_subsidies SET ..., updated_at = NOW();
END IF;

-- 消失検知
IF last_seen_at < NOW() - INTERVAL 7 DAYS THEN
  UPDATE izumi_subsidies SET is_active = 0;
END IF;
```

---

## 3. 更新スケジュール（固定）

| 頻度 | 対象 | 処理内容 |
|------|------|----------|
| **Daily** (03:00 JST) | jGrants | 全件差分同期、snapshot生成、is_accepting更新 |
| **Daily** (05:00 JST) | Ready Boost | wall_chat_ready率向上 |
| **Daily** (06:00 JST) | J-Net21 + jGrants | Feed同期、enrich処理 |
| **Weekly** (日曜 03:00 JST) | 泉 | 差分同期、URL生存チェック、紐付け再評価 |
| **Monthly** (1日 03:00 JST) | orphan_pdf | URL生存チェック、新規発見処理 |

---

## 4. 整合性チェック（定期実行）

```sql
-- canonical → snapshot 整合性
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN latest_snapshot_id IS NOT NULL THEN 1 ELSE 0 END) as has_snapshot,
  SUM(CASE WHEN latest_cache_id IS NOT NULL THEN 1 ELSE 0 END) as has_cache
FROM subsidy_canonical 
WHERE is_active = 1;
-- 期待: has_snapshot = total, has_cache = total

-- 受付中の母集団チェック
SELECT 
  COUNT(*) as accepting_count
FROM subsidy_canonical c
INNER JOIN subsidy_snapshot s ON c.latest_snapshot_id = s.id
WHERE c.is_active = 1 AND s.is_accepting = 1;
-- 期待: 173前後（変動あり）

-- 泉紐付け率
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN canonical_id IS NOT NULL THEN 1 ELSE 0 END) as linked,
  ROUND(100.0 * SUM(CASE WHEN canonical_id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as link_rate
FROM izumi_subsidies 
WHERE is_active = 1;
```

---

## 5. エラーハンドリング

### 5-A. jGrants API エラー

| エラー種別 | 対応 |
|------------|------|
| タイムアウト | 3回リトライ後、skip & ログ |
| 404 | is_active = 0 に更新 |
| 5xx | 次回バッチで再試行 |

### 5-B. 整合性エラー

| エラー種別 | 対応 |
|------------|------|
| latest_snapshot_id = NULL | 即座にsnapshot再生成 |
| is_accepting 不整合 | daily batch で自動修正 |
| 泉紐付け誤り | match_score < 0.7 は非表示 |

---

## 6. API エンドポイント

| エンドポイント | 用途 | 権限 |
|----------------|------|------|
| `POST /api/admin-ops/izumi-link` | 泉紐付け実行 | super_admin |
| `GET /api/admin-ops/izumi-link-status` | 泉紐付け状況 | super_admin |
| `GET /api/admin-ops/ssot-diagnosis` | SSOT診断 | super_admin |
| `POST /api/cron/enrich-jgrants` | jGrants同期 | cron |
| `POST /api/cron/sync-izumi` | 泉同期 | cron |

---

## 7. 監視項目

| 項目 | 閾値 | アラート |
|------|------|----------|
| 受付中補助金数 | < 100 | 警告 |
| snapshot整合率 | < 99% | 緊急 |
| 泉紐付け率 | < 10% | 情報 |
| daily batch 実行 | 未実行 > 36h | 警告 |

---

*最終更新: 2026-02-02*

# SSOT登録フロー設計確定ドキュメント v1.0

**最終更新**: 2026-02-05  
**ステータス**: ✅ 確定・運用中

---

## 1. 現状サマリー（確定）

| 指標 | 値 | 備考 |
|------|-----|------|
| subsidy_canonical | 2,902 | 正規化マスタ |
| latest_snapshot あり | 2,899 | SSOT検索対象 |
| is_accepting = 1 | 178 | 受付中（デフォルト検索） |
| 検索ヒット件数 | 178 | 仕様どおり |

### ソース別内訳（受付中）
- **jgrants**: 173件
- **manual**: 5件（IT導入補助金2026、省力化、持続化、業務改善）

---

## 2. 「登録済み」の凍結ルール

### ✅ 登録済み（SSOT検索でヒット）の条件
1. `subsidy_canonical` にレコードが存在
2. `latest_snapshot_id` が存在（NOT NULL）
3. `is_active = 1`
4. SSOT検索でヒット可能

### ❌ 登録済みではない状態
- `subsidy_cache` のみ → **候補登録**（検索対象外）
- `subsidy_feed_items` のみ → **候補登録**（検索対象外）
- `source_link` がない → **登録済み**（2026-02-05修正でLEFT JOINに変更済み）

### デフォルト検索条件
- **受付中のみ**（`is_accepting = 1`）
- `includeUnready = true` で受付終了も表示可能（super_admin debug用）

---

## 3. 重大な不具合と修正履歴

### 修正済み: source_link INNER JOIN問題
- **問題**: SSOT検索が `INNER JOIN subsidy_source_link` だったため、source_linkがないcanonicalが検索に出なかった
- **影響**: 手動登録補助金5件（IT導入補助金2026等）が検索に出なかった
- **修正**: 
  - (A) データ修正: 手動登録補助金に source_link を追加
  - (B) コード修正: `INNER JOIN` → `LEFT JOIN` に変更
- **コミット**: `3f8d02e` (2026-02-05)

---

## 4. SSOT検索SQL（Freeze版）

```sql
-- SSOT検索クエリ（Freeze版 v1.0）
SELECT 
  c.id AS canonical_id,
  c.name AS title,
  c.name_normalized,
  c.issuer_name,
  c.prefecture_code,
  c.latest_snapshot_id,
  c.latest_cache_id,
  s.is_accepting,
  s.acceptance_start,
  s.acceptance_end,
  s.subsidy_max_limit,
  s.subsidy_min_limit,
  s.subsidy_rate,
  s.target_area_text,
  l.source_type,
  l.source_id,
  sc.detail_json AS cache_detail_json,
  sc.wall_chat_ready
FROM subsidy_canonical c
JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
-- ⚠️ LEFT JOIN: source_linkは出典トラッキング用であり検索必須条件にしない
LEFT JOIN (
  SELECT canonical_id, source_type, source_id
  FROM subsidy_source_link
  WHERE id IN (
    SELECT MIN(id) FROM subsidy_source_link GROUP BY canonical_id
  )
) l ON l.canonical_id = c.id
LEFT JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
WHERE c.is_active = 1
  AND c.latest_snapshot_id IS NOT NULL
  AND s.is_accepting = 1  -- デフォルト: 受付中のみ
ORDER BY 
  CASE WHEN s.acceptance_end IS NULL THEN 1 ELSE 0 END,
  s.acceptance_end ASC,
  c.id ASC  -- tie-breaker
LIMIT ? OFFSET ?
```

### 検索条件のポイント
- **母集団**: `canonical + latest_snapshot`（必須）
- **source_link**: LEFT JOIN（存在しなくても検索に出る）
- **ソート**: 締切が近い順、NULL は最後、tie-breaker で順序安定化

---

## 5. 登録フロー（確定手順）

### Step 0: 事前チェック
- jGrants APIで対象制度候補が取得可能か確認
- `subsidy_cache` に既存データがあるか確認
- なければ `sync-jgrants` / `enrich-jgrants` を実行

### Step 1: canonical 作成
```sql
INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_name, prefecture_code, is_active, created_at, updated_at
) VALUES (
  'CANON-MONODUKURI',
  'ものづくり・商業・サービス生産性向上促進補助金',
  'ものづくり商業サービス生産性向上促進補助金',
  '中小企業庁',
  '00',
  1,
  datetime('now'),
  datetime('now')
);
```

### Step 2: snapshot 作成（回次ごと）
```sql
INSERT INTO subsidy_snapshot (
  id, canonical_id, version, is_accepting, acceptance_start, acceptance_end,
  subsidy_max_limit, subsidy_rate, target_area_text, content_hash, created_at
) VALUES (
  'SNAP-MONODUKURI-22',
  'CANON-MONODUKURI',
  22,
  1,
  '2025-04-01T00:00:00Z',
  '2026-01-30T17:00:00+09:00',
  12500000,
  '1/2',
  '全国',
  'sha256:...',
  datetime('now')
);
```

### Step 3: source_link 作成（必須）
```sql
INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, created_at
) VALUES (
  'link-monodukuri-jgrants',
  'CANON-MONODUKURI',
  'jgrants',
  'a0WJ200000CDTzMMAX',  -- jGrants ID
  'api',
  datetime('now')
);
```

### Step 4: latest_snapshot_id 更新
```sql
UPDATE subsidy_canonical 
SET latest_snapshot_id = 'SNAP-MONODUKURI-22',
    latest_cache_id = 'jg-a0WJ200000CDTzMMAX',
    updated_at = datetime('now')
WHERE id = 'CANON-MONODUKURI';
```

### Step 5: Gate検証（必須）
```sql
-- Gate-1: SSOT構造確認
SELECT c.id, c.latest_snapshot_id, s.is_accepting
FROM subsidy_canonical c
JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
WHERE c.id = 'CANON-MONODUKURI';

-- Gate-2: 検索ヒット確認
SELECT c.id, c.name
FROM subsidy_canonical c
JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
LEFT JOIN subsidy_source_link l ON l.canonical_id = c.id
WHERE c.is_active = 1 AND s.is_accepting = 1 AND c.id = 'CANON-MONODUKURI';
```

---

## 6. 新・登録ルール（超重要）

### ✅ 正しい手動登録方法
- **生成スクリプト方式**: `register_program_from_jgrants.mjs` を使用
- 1アクションで以下を全て生成:
  - `subsidy_canonical`
  - `subsidy_snapshot`
  - `subsidy_cache`
  - `subsidy_source_link`
  - `data_source_monitors`（監視設定）

### ❌ 禁止事項
- SQLを1テーブルずつ手書き
- `subsidy_feed_items` だけ追加
- `subsidy_cache` だけ追加
- `source_link` なしで canonical を作成

---

## 7. ものづくり補助金のSSOT登録（確定版）

### 対象
- **制度名**: ものづくり・商業・サービス生産性向上促進補助金
- **canonical_id**: `CANON-MONODUKURI`（または jGrants連携の場合は `jg-{source_id}`）
- **issuer_name**: 中小企業庁

### 現在の登録状況（2026-02-05時点）
| 回次 | canonical_id | is_accepting | 締切 |
|------|-------------|--------------|------|
| 19次 | jg-a0WJ200000CDTzMMAX | 1 | 2026-09-28 |
| 20次 | jg-a0WJ200000CDVkeMAH | 1 | 2026-12-28 |
| 21次 | jg-a0WJ200000CDX4vMAH | 1 | 2027-03-23 |

### 手動登録枠（MONODUKURI-KOUFU-*）
- `MONODUKURI-KOUFU-TSUJO`: 通常類型（上限1,250万円）
- `MONODUKURI-KOUFU-SEICHOU`: 成長分野進出類型（上限2,500万円）
- `MONODUKURI-GLOBAL`: グローバル枠（上限4,000万円）

---

## 8. latest_snapshot 選定規則

### 優先度（高→低）
1. **受付中優先**: `is_accepting = 1`
2. **締切が近い順**: `acceptance_end ASC`
3. **tie-breaker**: `canonical_id ASC`

### 複数スナップショット対応
- 同一制度で複数回次がある場合、受付中かつ締切が最も近いものを `latest_snapshot_id` に設定
- 過去回次は `superseded_by` で履歴管理

---

## 9. 監視設定（P5連携）

### 監視URL
- ものづくり補助金: `https://portal.monodukuri-hojo.jp/about.html`
- IT導入補助金: `https://it-shien.smrj.go.jp/download/`

### 監視頻度（締切ベース自動調整）
| 締切までの日数 | 監視頻度 |
|---------------|---------|
| 30日以内 | 24時間 |
| 14日以内 | 6時間 |
| 7日以内 | 3時間 |
| それ以外 | 168時間（週1） |

---

## 10. ロールバック手順

### 検索事故時
```bash
# SEARCH_BACKEND を cache に切替
wrangler secret put SEARCH_BACKEND --value="cache"
```

### SSOT登録の巻き戻し
```sql
-- canonical を非アクティブ化（削除ではない）
UPDATE subsidy_canonical SET is_active = 0 WHERE id = 'CANON-MONODUKURI';

-- snapshot は削除せず superseded_by で無効化
UPDATE subsidy_snapshot SET superseded_by = 'rollback' WHERE canonical_id = 'CANON-MONODUKURI';
```

---

## 11. Gate チェックリスト

| Gate | 確認内容 | SQL/コマンド |
|------|---------|-------------|
| Gate-1 | canonical + snapshot 存在 | `SELECT COUNT(*) FROM subsidy_canonical c JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id WHERE c.id = ?` |
| Gate-2 | SSOT検索ヒット | `SELECT * FROM ... WHERE s.is_accepting = 1 AND c.id = ?` |
| Gate-3 | 受付中判定整合 | `is_accepting=1 → acceptance_end > now` |
| Gate-4 | 監視設定存在 | `SELECT * FROM data_source_monitors WHERE canonical_id = ?` |
| Gate-5 | コスト発生なし（変更検知のみ） | 変更検知はHTMLハッシュ、AIコストゼロ |

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-02-05 | v1.0 | 初版作成、source_link LEFT JOIN修正 |

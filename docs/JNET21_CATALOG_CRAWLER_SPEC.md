# J-Net21 一覧クロール仕様書

**バージョン**: 1.0  
**作成日**: 2026-01-26  
**ステータス**: 設計中

---

## 1. 概要

J-Net21補助金情報の取得を「RSS（日次24件）」から「一覧ページクロール（全3,794件+）」へ拡張し、検索可能な補助金件数を最短で増やす。

### 1.1 現状と目標

| 項目 | 現状 | 目標 |
|------|------|------|
| 取得方法 | RSS (support.xml) | 一覧ページクロール |
| 日次取得件数 | 約24件 | 制限なし（全件） |
| 母集団規模 | 数百件 | 3,000件+ |
| 取得情報 | タイトル/概要/都道府県/URL | +詳細URL/カテゴリ/期限/issuer |

### 1.2 J-Net21 URL構造

```
一覧ページ:
https://j-net21.smrj.go.jp/snavi/support
https://j-net21.smrj.go.jp/snavi/articles?category[]=2  (カテゴリ: 補助金・助成金・融資)

詳細ページ:
https://j-net21.smrj.go.jp/snavi/articles/{id}
例: https://j-net21.smrj.go.jp/snavi/articles/168820
```

---

## 2. アーキテクチャ

### 2.1 パイプライン設計（Freeze-4準拠）

```
sync-jnet21-catalog (新規)
       ↓
  Firecrawl で一覧ページ取得
       ↓
  正規表現で記事URL抽出
       ↓
  discovery_items (stage=raw)
       ↓
promote-jnet21 (既存)
       ↓
  quality_score 計算
       ↓
  Tier1(>=50) → validated
  Tier2(>=70) → promoted → subsidy_cache
```

### 2.2 Cronエンドポイント

| エンドポイント | 頻度 | 用途 |
|----------------|------|------|
| `POST /api/cron/sync-jnet21` | 日次 | RSS同期（補助、継続運用） |
| `POST /api/cron/sync-jnet21-catalog` | 日次 | 一覧クロール（メイン） |
| `POST /api/cron/promote-jnet21` | 日次 | discovery_items → subsidy_cache |

### 2.3 実行順序（推奨）

```
05:00 UTC  sync-jnet21-catalog (一覧クロール)
05:30 UTC  sync-jnet21 (RSS補助)
06:00 UTC  promote-jnet21 (昇格処理)
```

---

## 3. 実装詳細

### 3.1 sync-jnet21-catalog 仕様

#### パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|------------|-----|-----------|------|
| `max_pages` | number | 100 | クロールする最大ページ数 |
| `per_page` | number | 50 | 1ページあたりの件数 |
| `start_page` | number | 1 | 開始ページ |

#### 処理フロー

```typescript
// 1. 一覧ページURL組み立て
const listUrl = `https://j-net21.smrj.go.jp/snavi/articles?category[]=2&page=${page}&num=${perPage}`;

// 2. Firecrawl で取得（コスト記録: Freeze-COST-2）
const result = await firecrawlScrape(listUrl, {
  db: env.DB,
  apiKey: env.FIRECRAWL_API_KEY,
  sourceId: 'src-jnet21-catalog',
});

// 3. 記事URL抽出
const articleUrls = extractArticleUrls(result.text);
// パターン: /snavi/articles/\d+

// 4. discovery_items へ UPSERT (stage=raw)
for (const url of articleUrls) {
  const dedupeKey = `src-jnet21:${urlHash(url)}`;
  await db.prepare(`
    INSERT INTO discovery_items (id, dedupe_key, source_id, source_type, ...)
    VALUES (?, ?, 'src-jnet21-catalog', 'catalog', ...)
    ON CONFLICT(dedupe_key) DO UPDATE SET last_seen_at = datetime('now')
  `).bind(...).run();
}

// 5. 次ページ判定（ページネーション）
// "次へ" リンクまたは件数から判定
```

#### 出力

```json
{
  "success": true,
  "data": {
    "message": "J-Net21 catalog sync completed",
    "pages_crawled": 76,
    "articles_found": 3794,
    "new_items": 3200,
    "updated_items": 500,
    "skipped_items": 94,
    "errors": 0,
    "run_id": "uuid"
  }
}
```

### 3.2 コスト計算

| 項目 | 計算式 | 備考 |
|------|--------|------|
| Firecrawl credits | 1 credit/page | 100ページ = 100 credits |
| 月間コスト | 100 credits × 30日 × $0.001 | $3/月 |

**コスト最適化**:
- ページネーション効率化: `num=50` で1ページあたりの記事数を最大化
- 差分検知: `content_hash` で変更のみ処理
- 冪等性: `dedupe_key` で重複防止

### 3.3 promote-jnet21 拡張

#### 現状の制限

```typescript
// 現状: LIMIT 500（raw→validated）/ LIMIT 100（validated→promoted）
LIMIT 500  // raw items
LIMIT 100  // promoted to cache
```

#### 拡張後

```typescript
// 拡張後: LIMIT 廃止 または大幅増
LIMIT 5000  // raw items (1日あたり最大)
LIMIT 500   // promoted to cache (1日あたり)
```

#### Tier階層（quality_score）

| Tier | 条件 | 用途 |
|------|------|------|
| Tier1 | score >= 50 | 検索に出る（validated） |
| Tier2 | score >= 70 | 壁打ち対象（promoted） |
| Rejected | score < 50 | stage=rejected |

### 3.4 quality_score 計算ルール（凍結）

```typescript
let qualityScore = 0;

// 必須項目
if (title && title.length > 10) qualityScore += 30;        // タイトル充実
if (summary && summary.length > 0) qualityScore += 30;     // 概要あり
if (url) qualityScore += 20;                               // URLあり

// 加点項目
if (prefecture_code) qualityScore += 20;                   // 都道府県あり
if (deadline || acceptance_end) qualityScore += 10;        // 期限あり
if (issuer_name) qualityScore += 10;                       // 発行機関あり
if (subsidy_rate || max_amount) qualityScore += 10;        // 金額/率あり

// 最大: 130点
```

---

## 4. discovery_items スキーマ

```sql
-- 既存カラム（変更なし）
id TEXT PRIMARY KEY,
dedupe_key TEXT NOT NULL UNIQUE,
source_id TEXT NOT NULL,                -- 'src-jnet21' / 'src-jnet21-catalog'
source_type TEXT NOT NULL,              -- 'rss' / 'catalog'
title TEXT NOT NULL,
summary TEXT,
url TEXT NOT NULL,
prefecture_code TEXT,
stage TEXT DEFAULT 'raw',               -- raw → validated → promoted / rejected
quality_score INTEGER DEFAULT 0,
content_hash TEXT,
raw_json TEXT,
first_seen_at TEXT,
last_seen_at TEXT,
promoted_at TEXT,
promoted_to_id TEXT,                    -- subsidy_cache.id
validation_notes TEXT,
created_at TEXT,
updated_at TEXT
```

---

## 5. 安全ゲート（Freeze-4準拠）

### 5.1 Firecrawlコスト記録

```typescript
// Freeze-COST-2: wrapper経由必須
const result = await firecrawlScrape(url, {
  db: env.DB,  // 必須（CostGuard）
  apiKey: env.FIRECRAWL_API_KEY,
  sourceId: 'src-jnet21-catalog',
});

// DB なしは CostGuard でブロック
if (!env.DB) {
  metrics.firecrawlBlockedByCostGuard++;
  await recordCostGuardFailure(env.DB, ...);
}
```

### 5.2 失敗記録

```typescript
// feed_failures への記録
await recordFailure(
  db,
  itemId,                    // 補助金ID
  'src-jnet21-catalog',      // source_id
  url,                       // URL
  'discover',                // stage
  'FIRECRAWL_FAILED',        // reason
  errorMessage               // details
);
```

### 5.3 冪等性保証

```sql
-- ON CONFLICT で重複防止
INSERT INTO discovery_items (...)
VALUES (...)
ON CONFLICT(dedupe_key) DO UPDATE SET
  last_seen_at = datetime('now'),
  updated_at = datetime('now')
```

---

## 6. super_admin KPI 追加

### 6.1 discovery_items 統計

```sql
-- source_type 別 stage 分布
SELECT 
  source_type,
  stage,
  COUNT(*) as count
FROM discovery_items
WHERE source_id LIKE 'src-jnet21%'
GROUP BY source_type, stage
```

### 6.2 不足フィールド分析

```sql
-- 各フィールドの充足率
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN title IS NOT NULL AND LENGTH(title) > 10 THEN 1 ELSE 0 END) as has_title,
  SUM(CASE WHEN summary IS NOT NULL AND LENGTH(summary) > 0 THEN 1 ELSE 0 END) as has_summary,
  SUM(CASE WHEN prefecture_code IS NOT NULL THEN 1 ELSE 0 END) as has_prefecture,
  SUM(CASE WHEN url IS NOT NULL THEN 1 ELSE 0 END) as has_url
FROM discovery_items
WHERE source_id LIKE 'src-jnet21%'
```

---

## 7. 実装チェックリスト

### Phase 1: 基盤実装

- [ ] `sync-jnet21-catalog` エンドポイント作成
- [ ] Firecrawl による一覧ページ取得
- [ ] 記事URL抽出ロジック
- [ ] discovery_items UPSERT
- [ ] cron_runs 記録

### Phase 2: 昇格処理拡張

- [ ] promote-jnet21 の LIMIT 拡大 (500→5000/500)
- [ ] Tier階層の明確化
- [ ] quality_score 計算ルール更新

### Phase 3: 可視化

- [ ] discovery_items 統計API
- [ ] 不足フィールド分析API
- [ ] super_admin ダッシュボード連携

---

## 8. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-01-26 | v1.0 | 初版作成 |

---

**作成者**: AI Developer Agent  
**レビュー**: 保留中

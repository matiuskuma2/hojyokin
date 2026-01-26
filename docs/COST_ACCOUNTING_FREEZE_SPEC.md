# コスト会計凍結仕様 (Freeze-COST-0 〜 Freeze-COST-4)

**作成日**: 2026-01-25  
**最終更新**: 2026-01-25 v2  
**ステータス**: 凍結

---

## 概要

本ドキュメントは、外部APIコスト（Firecrawl / Vision OCR / OpenAI 等）の記録・集計・表示に関する凍結仕様を定義する。

### 背景

- `cost_usage_log` (0021) は定義済みだが本番0件・未運用
- `extraction_logs` (0106) は抽出ログとして運用中
- 推定値ベースの表示はUX混乱を招くため、実数ベースに統一する必要あり

### 方針決定

**採用案**: B) 新規 `api_cost_logs` テーブルを作成
- 理由: 実数のみを真実としたい + 補助金パイプライン向けに `cost_usage_log` の構造が合わない
- 既存テーブルとの関係:
  - `cost_usage_log`: 残置（移行コスト0件のため削除不要）
  - `extraction_logs`: 抽出ログとして継続利用
  - `api_cost_logs`: **コスト集計の唯一の真実**

---

## 凍結ルール

### Freeze-COST-0: 真実の一元化

```
api_cost_logs テーブルが唯一の真実
super_admin のコスト表示は api_cost_logs のみから集計
```

**禁止事項**:
- `cost_usage_log` を super_admin 表示に使用すること
- `extraction_logs.ocr_estimated_cost` を集計に含めること
- 複数テーブルからのコスト合算

### Freeze-COST-1: 推定値禁止

```
推定値は UI に表示してはならない
実数（actual）のみを集計・表示
```

**禁止事項**:
- `estimated_cost_usd` の UI 表示
- 「推定」「概算」等のラベルでのコスト表示
- API応答に `estimated` フラグのあるコスト値の表示

**許可事項**:
- 実数コストの合計表示
- サービス別・日別・補助金別の実数集計

### Freeze-COST-2: Wrapper 経由必須 + DB 必須化

```
外部API呼び出しは必ず wrapper 経由
直接 fetch は禁止
env.DB なしでの呼び出しは拒否（エラー）
```

**Wrapper ファイル**:
- `src/lib/cost/firecrawl.ts` → `firecrawlScrape()`
- `src/lib/cost/vision.ts` → `visionOcr()`
- (将来) `src/lib/cost/openai.ts` → `openaiChat()` 等

**呼び出しパターン**:
```typescript
// ❌ 禁止: 直接 fetch
const response = await fetch('https://api.firecrawl.dev/v1/scrape', ...);

// ❌ 禁止: DB なしでの wrapper 呼び出し（pdf-extract-router.ts で拒否）
// env.DB が undefined の場合、Firecrawl/Vision は実行されない

// ✅ 必須: wrapper 経由 + DB 必須
import { firecrawlScrape } from '../cost';
const result = await firecrawlScrape(url, { db: env.DB, apiKey, subsidyId });
```

**DB 必須化の実装箇所**:
- `src/lib/pdf/pdf-extract-router.ts` の Step 2, 3, 6.5
- `env.DB` が undefined の場合は `console.error` でログを残し、呼び出しをスキップ
- メトリクスに `firecrawlBlockedByCostGuard` / `visionBlockedByCostGuard` を設定

**CostGuard → feed_failures 記録**:
- **CostGuard** = `env.DB` 欠如による外部API呼び出しブロック（cooldown とは別）
- CostGuard 発生時は **cron側** で `feed_failures` に記録（`error_type = 'db'`）
- 実装ファイル: `src/lib/failures/feed-failure-writer.ts` → `recordCostGuardFailure()`
- 呼び出し箇所: `src/routes/cron.ts` の `extractAndUpdateSubsidy()` 直後

### Freeze-COST-3: 失敗時もコスト記録

```
API呼び出しが失敗しても、消費したコストは記録する
```

**理由**:
- Firecrawl: 失敗しても1 credit 消費
- Vision OCR: 失敗してもページ数分消費の可能性あり
- 実際の請求額と一致させるため

**記録内容**:
- `success = 0`
- `error_code`, `error_message` を設定
- `cost_usd` は消費見込み額

**Firecrawl usage 取得ルール**:
- API レスポンスに `usage.credits` または `usage.creditsUsed` がある場合はそれを使用
- 取得できない場合は `error_code = 'USAGE_MISSING'` として記録し、デフォルト 1 credit を使用
- 成功時でも usage 不明は記録される

**Vision pages 取得ルール**:
- API レスポンスの `fullTextAnnotation.pages.length` から取得
- 取得できない場合は `error_code = 'PAGES_UNKNOWN'` として記録し、1 ページ固定
- これは「推定」ではなく「不明時の凍結ルール」として明示的に 1 を使用

### Freeze-COST-4: モデル・単価は metadata_json に保持

```
使用モデル名、適用単価は metadata_json カラムに記録
```

**metadata_json 例**:
```json
{
  "model": "gpt-4o",
  "rate": 0.005,
  "inputTokens": 1500,
  "outputTokens": 800
}
```

**単価定義ファイル**: `src/lib/cost/rates.ts`

---

## テーブル定義

### api_cost_logs (0110_api_cost_logs.sql)

```sql
CREATE TABLE api_cost_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- サービス情報
  service TEXT NOT NULL,              -- 'firecrawl' | 'vision_ocr' | 'openai' | 'anthropic'
  action TEXT NOT NULL,               -- 'scrape' | 'ocr' | 'chat_completion' | 'embedding'
  
  -- 関連エンティティ
  source_id TEXT,                     -- feed_sources.id
  subsidy_id TEXT,                    -- subsidy_cache.id
  discovery_item_id TEXT,             -- discovery_items.id
  
  -- リクエスト情報
  url TEXT,
  
  -- 消費量（実数）
  units REAL NOT NULL DEFAULT 0,      -- credit / page / token
  unit_type TEXT NOT NULL,            -- 'credit' | 'page' | 'input_token' 等
  cost_usd REAL NOT NULL DEFAULT 0,   -- 実数コスト（USD）
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- 実行結果
  success INTEGER NOT NULL DEFAULT 1,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  
  -- 詳細
  raw_usage_json TEXT,                -- API応答の生usage
  metadata_json TEXT,                 -- モデル名/単価
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 単価定義（凍結）

### Firecrawl (2024-01月時点)

| 項目 | 値 |
|------|-----|
| USD_PER_CREDIT | $0.001 |
| CREDITS_PER_SCRAPE | 1 |

### Vision OCR (2024-01月時点)

| 項目 | 値 |
|------|-----|
| USD_PER_PAGE (Tier1) | $0.0015 |
| FREE_TIER_UNITS | 1000 units/month |

### OpenAI (2024-01月時点)

| モデル | Input/1K | Output/1K |
|--------|----------|-----------|
| gpt-4o | $0.005 | $0.015 |
| gpt-4o-mini | $0.00015 | $0.0006 |
| gpt-4-turbo | $0.01 | $0.03 |
| gpt-3.5-turbo | $0.0005 | $0.0015 |

---

## Super Admin API

### GET /api/admin-ops/cost/summary

コスト集計サマリー取得（super_admin 専用）

**Query params**:
- `days`: 集計日数（デフォルト: 7、範囲: 1〜90 に固定）

**SQLite日時処理**:
- ISO文字列比較ではなく `datetime('now', '-N days')` を使用
- これにより SQLite の日時形式との不整合を回避

**Response**:
```json
{
  "success": true,
  "data": {
    "period": { "days": 7, "since": "2026-01-18T00:00:00Z" },
    "summary": {
      "total_cost_usd": 1.234,
      "total_units": 1234,
      "total_calls": 500,
      "success_count": 480,
      "failure_count": 20
    },
    "allTime": {
      "total_cost_usd": 12.34,
      "total_calls": 5000
    },
    "byService": [...],
    "byDate": [...],
    "topSubsidies": [...],
    "recentErrors": [...]
  }
}
```

### GET /api/admin-ops/cost/logs

コストログ一覧取得（super_admin 専用）

**Query params**:
- `limit`: 取得件数（デフォルト: 50, 最大: 200）
- `offset`: オフセット
- `service`: サービスでフィルタ
- `success`: 成功/失敗でフィルタ（0 or 1）

---

## 実装ファイル一覧

| ファイル | 役割 |
|----------|------|
| `migrations/0110_api_cost_logs.sql` | テーブル定義 |
| `src/lib/cost/cost-logger.ts` | コスト記録ロガー |
| `src/lib/cost/rates.ts` | 単価定義 |
| `src/lib/cost/firecrawl.ts` | Firecrawl wrapper |
| `src/lib/cost/vision.ts` | Vision OCR wrapper |
| `src/lib/cost/index.ts` | モジュールエクスポート |
| `src/lib/pdf/pdf-extract-router.ts` | wrapper 差し込み済み |
| `src/routes/admin-dashboard.ts` | 集計API |

---

## 移行・運用

### 本番適用手順

1. マイグレーション適用:
```bash
npx wrangler d1 execute subsidy-matching-production --remote \
  --file=./migrations/0110_api_cost_logs.sql
```

2. デプロイ:
```bash
npm run build && npx wrangler pages deploy dist --project-name hojyokin
```

3. 確認:
```bash
curl -H "Authorization: Bearer <token>" \
  "https://hojyokin.pages.dev/api/admin-ops/cost/summary?days=1"
```

### 運用ルール

- 単価変更時は `rates.ts` を更新し、変更履歴をドキュメントに追記
- 新サービス追加時は wrapper を作成し、本ドキュメントに追記
- 月次で `api_cost_logs` の累計を確認し、予算超過をアラート

---

## 関連ドキュメント

- [QUALITY_FREEZE_CHECKLIST.md](./QUALITY_FREEZE_CHECKLIST.md) - 品質凍結チェックリスト
- [FEED_PIPELINE_SPEC.md](./FEED_PIPELINE_SPEC.md) - フィードパイプライン仕様
- [FREEZE_CHECKLIST_NEXT_PHASE.md](./FREEZE_CHECKLIST_NEXT_PHASE.md) - 次フェーズ凍結チェック

---

## 関連ドキュメント（インデックス）

**凍結ルールの入口**: [FROZEN_RULES_INDEX.md](./FROZEN_RULES_INDEX.md)

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-01-25 | v1 | 初版作成 |
| 2026-01-25 | v2 | P0修正: DB必須化、usage/pages取得ルール追加、days範囲固定 |

# AI駆動開発用 コード品質チェックガイドライン

> **最終更新**: 2026-02-08
> **適用範囲**: 本プロジェクト（hojyokin）の全コード変更
> **目的**: AI（Claude/GPT等）によるコード生成・修正時に、品質を担保するためのチェックリスト

---

## 1. 必須チェック項目（1-8）

全てのコード変更で遵守すること。違反がある場合はマージ不可。

### チェック 1: 型安全性
- TypeScript の型定義が正確であること
- `any` の多用を避ける（やむを得ない場合は `// TODO: 要確認 - 型定義が必要` を付記）
- Hono の `Bindings` 型に D1/KV/R2 等のバインディングを正しく定義

```typescript
// ✅ 正しい
type Bindings = { DB: D1Database; KV: KVNamespace }
const app = new Hono<{ Bindings: Bindings }>()

// ❌ 間違い
const app = new Hono<any>()
```

### チェック 2: エラーハンドリング
- API エンドポイントは try-catch で保護
- ユーザーにわかりやすいエラーメッセージを返す
- 内部エラーの詳細はログに出力し、ユーザーには汎用メッセージを返す

```typescript
// ✅ 正しい
try {
  const result = await env.DB.prepare('SELECT ...').run()
  return c.json({ success: true, data: result })
} catch (error) {
  console.error('[subsidies] Search error:', error)
  return c.json({ success: false, error: { code: 'SEARCH_ERROR', message: '検索中にエラーが発生しました' } }, 500)
}
```

### チェック 3: SQLインジェクション防止
- **バインドパラメータ（?）を必ず使用**
- 文字列結合による SQL 構築は禁止
- 動的な列名・テーブル名はホワイトリストで検証

```typescript
// ✅ 正しい
const result = await env.DB.prepare('SELECT * FROM subsidy_cache WHERE id = ?').bind(subsidyId).first()

// ❌ 禁止
const result = await env.DB.prepare(`SELECT * FROM subsidy_cache WHERE id = '${subsidyId}'`).first()
```

### チェック 4: コスト記録
- 外部API呼び出しには必ずコストログを記録
- 成功・失敗の両方を記録する
- コスト記録の失敗でメイン処理を止めない

```typescript
// ✅ 正しい
try {
  const result = await simpleScrape(url)
  try {
    await logSimpleScrapeCost(db, { url, success: result.success, subsidyId })
  } catch (costErr) {
    console.error('[cost] Failed to log:', costErr)
  }
  return result
} catch (err) { ... }
```

対応するコスト記録関数:
| サービス | 関数 | ファイル |
|---|---|---|
| Firecrawl | `logFirecrawlCost()` | `src/lib/cost/cost-logger.ts` |
| OpenAI | `logOpenAICost()` | `src/lib/cost/cost-logger.ts` |
| Vision OCR | `logVisionCost()` | `src/lib/cost/cost-logger.ts` |
| simpleScrape | `logSimpleScrapeCost()` | `src/lib/cost/cost-logger.ts` |

### チェック 5: 冪等性
- Cron/バッチ処理は複数回実行しても安全であること
- INSERT は `INSERT OR REPLACE` / `INSERT OR IGNORE` を使用
- 処理済みチェック（crawled_at, processed_at 等）を必ず確認

```typescript
// ✅ 正しい - 処理済みスキップ
const targets = await db.prepare(
  'SELECT id FROM subsidy_cache WHERE overview_source = ? AND crawled_at IS NULL LIMIT ?'
).bind('title_fallback_v1', batchSize).all()
```

### チェック 6: ページネーション
- 大量データ取得時は SQL の LIMIT/OFFSET を使用
- JavaScript の配列スライスでページネーションしない
- total_count は別クエリで取得（COUNT(*)）

```typescript
// ✅ 正しい - SQLでページネーション
const countResult = await db.prepare(countSql).bind(...params).first()
const totalCount = countResult?.total || 0
const rows = await db.prepare(dataSql + ' LIMIT ? OFFSET ?').bind(...params, limit, offset).all()

// ❌ 間違い - JSでスライス（全件メモリに載せる）
const allRows = await db.prepare(dataSql).all()
const pageRows = allRows.results.slice(offset, offset + limit)
```

### チェック 7: 環境変数管理
- シークレットは `wrangler secret put` / `.dev.vars` で管理
- コードに API キーやパスワードを埋め込まない
- `.dev.vars` は `.gitignore` に含める

```bash
# 本番設定
echo "your-value" | npx wrangler pages secret put SECRET_NAME --project-name hojyokin

# ローカル開発
echo 'SECRET_NAME=your-value' >> .dev.vars
```

### チェック 8: Workers ランタイム制約
- `fs`, `path`, `child_process`, `crypto`（Node.js版）等を使わない
- Web API を使用（Fetch API, Web Crypto API, TextEncoder/Decoder）
- `serveStatic` は `hono/cloudflare-workers` からインポート

```typescript
// ✅ 正しい
import { serveStatic } from 'hono/cloudflare-workers'

// ❌ 間違い - Node.js 環境用
import { serveStatic } from '@hono/node-server/serve-static'
```

---

## 2. 推奨チェック項目（9-10）

遵守が望ましいが、緊急時は例外を許容。

### チェック 9: データ整合性
- `detail_json` 内のフィールドとテーブルカラムを同期する
- 例: `detail_json.acceptance_end_datetime` → `subsidy_cache.acceptance_end_datetime`

```typescript
// ✅ detail_json更新時にテーブルカラムも同期
const updateSql = `
  UPDATE subsidy_cache 
  SET detail_json = ?,
      acceptance_end_datetime = ?,
      overview_source = ?
  WHERE id = ?
`
await db.prepare(updateSql).bind(
  JSON.stringify(detail),
  detail.acceptance_end_datetime || null,
  'crawl_v2',
  targetId
).run()
```

### チェック 10: ログ出力
- デバッグ用ログは `console.log` + `[モジュール名]` プレフィックス
- 本番環境で過剰なログを出さない（ループ内ログは避ける）

```typescript
// ✅ 正しい
console.log(`[izumi-crawl] Processed ${crawled} items, ${failed} failed, ${remaining} remaining`)

// ❌ 間違い - ループ内で毎回ログ
for (const item of items) {
  console.log(`Processing item ${item.id}...`)  // 18,000回出力される
}
```

---

## 3. 出力ルール

### 懸念点の表記
コード内に懸念点がある場合、以下の形式でコメントを付記:

```typescript
// ⚠️ 懸念点: acceptance_end_datetimeがNULLの場合、常時受付として表示される
// TODO: 要確認 - Izumi 18,651件のacceptance_end_datetimeはクロールで取得中

// WORKAROUND: searchFromCacheのfetchLimitが小さいため、SQLで直接ページネーション
// → v4.8.0で修正済み（旧: JS slice → 新: SQL LIMIT/OFFSET）
```

### プレフィックス一覧
| プレフィックス | 意味 | 使用場面 |
|---|---|---|
| `// TODO: 要確認` | 未確定のビジネスロジックや仕様 | 新機能実装時 |
| `// WORKAROUND:` | 既知の制約に対する一時対応 | 技術的制約がある場合 |
| `// FREEZE:` | 変更禁止の凍結仕様 | 仕様が確定した部分 |
| `// P[番号]:` | フェーズ番号に紐づく変更 | 大規模リファクタ時 |

---

## 4. 新規データソース追加時の追加チェック

DATA-PIPELINE.md の 2.1 セクションも参照。

| # | チェック項目 | 確認事項 |
|---|---|---|
| D1 | subsidy_cache 投入 | INSERT/UPDATE クエリが正しいか |
| D2 | wall_chat_ready 判定 | isSearchable / isWallChatReady の条件を満たすか |
| D3 | acceptance_end_datetime | テーブルカラムとdetail_json の両方に設定しているか |
| D4 | expires_at | キャッシュ期限を適切に設定しているか（最低1年推奨） |
| D5 | コスト記録 | 外部API呼び出しにlogXxxCost()を呼んでいるか |
| D6 | 管理画面反映 | ダッシュボードのソース別集計に含まれるか |
| D7 | canonical 昇格 | Phase D で対応予定。現時点ではcacheのみでOK |

---

## 5. レビュー時のフロー

```
コード変更
  ↓
必須チェック 1-8 を確認
  ↓
推奨チェック 9-10 を確認
  ↓
新規データソースの場合: D1-D7 を追加確認
  ↓
懸念点があれば TODO/WORKAROUND コメントを付記
  ↓
ビルド成功を確認 (npm run build)
  ↓
テスト (curl / ローカル確認)
  ↓
コミット + プッシュ
```

---

## 変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-02-08 | 初版作成。必須8項目 + 推奨2項目 + データソース追加チェック |

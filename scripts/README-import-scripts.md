# SSOT統合スクリプト設計仕様 v2

## 概要

本ドキュメントは、補助金データのSSOT（Single Source of Truth）統合に必要な4つのスクリプトの設計仕様を定義する。

**方針**:
- izumiの `policy_id` は**現時点情報で古くなる**（SSOTではない）
- PDFは検索に反映するが、**Active判定には使わない**
- `orphan_pdf`（PDFしかないもの）は機械的に管理し、将来の探索母集団にする

### スクリプト一覧

| スクリプト | 目的 | 入力 | 出力先テーブル |
|-----------|------|------|---------------|
| `import-izumi.mjs` | izumi詳細CSV取り込み（raw保全） | data/izumi/details/*.csv | izumi_subsidies |
| `import-izumi-urls.mjs` | izumi URL展開（orphan_pdf検出） | data/izumi/izumi_support_urls_*.csv | izumi_urls |
| `backfill-jgrants-canonical.mjs` | jGrants→canonical移行 | subsidy_cache | subsidy_canonical, subsidy_source_link |
| `snapshot-jgrants.mjs` | snapshot生成（diff検知） | subsidy_cache | subsidy_snapshot |

### 依存関係（実行順序）

```
1. import-izumi.mjs (izumi_subsidies投入)
   ↓
2. import-izumi-urls.mjs (izumi_urls展開)
   ↓
3. backfill-jgrants-canonical.mjs (canonical/link生成)
   ↓
4. snapshot-jgrants.mjs (snapshot生成)
```

---

## 0. 共通設計（4スクリプト共通）

### 0-1. 共通モジュール

**ファイル**: `scripts/lib/script-runner.mjs`

```javascript
import { ScriptRunner, sha256, md5, escapeSQL, sqlValue, normalizeWhitespace, normalizeUrl } from './lib/script-runner.mjs';

const runner = new ScriptRunner('script-name', process.argv.slice(2));
await runner.run(async (ctx) => {
  const { args, logger, db, stats, saveCheckpoint, handleError } = ctx;
  // 処理
});
```

### 0-2. CLI引数

| 引数 | 説明 | デフォルト |
|------|------|-----------|
| `--local` | ローカルD1実行 | - |
| `--remote` | リモートD1実行 | - |
| `--production` | 本番D1実行 | - |
| `--dry-run` | DB更新せず、件数と差分のみ出力 | false |
| `--fail-fast` | エラー発生時に即終了 | false（スキップして継続） |
| `--limit N` | テスト用件数制限 | 無制限 |
| `--batch-size N` | バッチサイズ | 200 |
| `--resume` | 前回の続きから再開 | false |
| `--verbose` / `-v` | 詳細ログ出力 | false |

### 0-3. ログと再開性

- すべてのスクリプトで `run_id` を発行（JSONL形式）
- 処理対象は「IDで昇順」＋「最後に処理したID」をログに残し、再開可能
- ログファイル: `logs/{script_name}_{timestamp}_{run_id}.jsonl`
- エラーログ: `logs/{script_name}_{timestamp}_{run_id}_errors.jsonl`
- 再開ポイント: `logs/resume/{script_name}_resume.json`

### 0-4. インシデント防止の禁止事項

- 本番（remote/prod）で **DELETEはしない**
- UPDATEは必ず `WHERE id = ?` の単行更新（OR条件の広域更新禁止）
- 既存値の上書きは原則禁止（raw保全 / 派生は別フィールド）

---

## 1. import-izumi.mjs

### 1-1. 目的

`data/izumi/details/izumi_detail_*.csv`（約18,7xx行）を **raw保全しつつ** `izumi_subsidies`へUPSERT。

### 1-2. 入力

- ディレクトリ: `data/izumi/details/`
- ファイル形式: `policy_id,detail_url,title,issuer,area,publish_date,period,max_amount,difficulty,start_fee,success_fee,support_url,...`
- 90ファイル×200行想定（合計 ~18,7xx）

### 1-3. 出力（DB更新）

**テーブル: izumi_subsidies**

| カラム | 型 | 説明 |
|--------|-----|------|
| policy_id | INTEGER PK | izumiのpolicy_id |
| detail_url | TEXT | izumi詳細ページURL |
| title | TEXT | タイトル（raw） |
| issuer | TEXT | 実施機関（raw） |
| area | TEXT | 対象地域（raw） |
| max_amount_text | TEXT | 金額テキスト（raw） |
| max_amount_value | INTEGER | 金額数値（パース成功時） |
| raw_json | TEXT | **CSV行全体をJSON保存（原本保全）** |
| row_hash | TEXT | **正規化SHA256ハッシュ（変更検知用）** |
| first_seen_at | TEXT | **初回発見日時（初回のみ設定）** |
| last_seen_at | TEXT | **最終確認日時（毎回更新）** |
| is_visible | INTEGER | 検索に表示するか（デフォルト1） |

### 1-4. 金額パース（max_amount_value）

**対応例:**
- `上限200万円` → 2,000,000
- `10億円` → 1,000,000,000
- `7.5万円` → 75,000

**整数化不可（NULL）:**
- `3万円/1人` → 単位混在
- `5000円/回` → 期間混在
- `要相談`、`なし`、`N/A`

**事故防止**: 推測で整数化しない（単位/期間/人数が混ざる場合はNULL）

### 1-5. UPSERTルール

1. **初回**: INSERT（`first_seen_at` = now）
2. **2回目以降**:
   - `row_hash` が変わったら → `raw_json`, `row_hash`, `last_seen_at` を更新
   - 変わらないなら → `last_seen_at` だけ更新
3. `first_seen_at` は**初回のみ**

### 1-6. 成果物（出力レポート）

```json
{
  "processed": 18655,
  "inserted": 18000,
  "updated": 600,
  "skipped": 55,
  "parse_amount_success": 13000,
  "parse_amount_failed": 5655,
  "updated_changed_hash": 500,
  "updated_last_seen_only": 100
}
```

### 1-7. コマンド例

```bash
node scripts/import-izumi.mjs --local
node scripts/import-izumi.mjs --local --dry-run
node scripts/import-izumi.mjs --local --limit=100
node scripts/import-izumi.mjs --local --resume
node scripts/import-izumi.mjs --local --fail-fast
node scripts/import-izumi.mjs --local --file=data/izumi/details/izumi_detail_200.csv
```

---

## 2. import-izumi-urls.mjs

### 2-1. 目的

`data/izumi/izumi_support_urls_*.csv` を展開して URL台帳 `izumi_urls` に投入。
**PDFしか無いもの（更新元不明）を `orphan_pdf` として管理**。

### 2-2. 入力

- `data/izumi/izumi_support_urls_*.csv`
- カラム: `policy_id,primary_url,all_urls`

### 2-3. 出力（DB更新）

**テーブル: izumi_urls**

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | `izurl-{url_hash[:12]}` |
| policy_id | INTEGER | izumiのpolicy_id |
| url | TEXT | 正規化URL |
| url_hash | TEXT | URLのMD5ハッシュ |
| url_type | TEXT | `html` / `pdf` |
| url_kind | TEXT | **`issuer_page` / `pdf` / `orphan_pdf` / `detail`** |
| is_primary | INTEGER | primary_urlか |
| domain | TEXT | URLのドメイン |
| source_of_truth_url | TEXT | **更新元URL（PDFならissuer_page）** |
| discovered_from_url | TEXT | **どこから発見されたか** |
| crawl_status | TEXT | `new` / `ok` / `failed` / `dead` |

### 2-4. URL分類ルール（url_kind）

| 条件 | url_kind |
|------|----------|
| izumi詳細ページ | `detail` |
| `.pdf` で終わる | `pdf` |
| primary_url が PDF かつ issuer_page が存在しない | **`orphan_pdf`** |
| その他HTML | `issuer_page` |

**「PDFしかないもの取る」ケースがここで検出される**

### 2-5. 成果物

```json
{
  "policies_processed": 17032,
  "urls_total": 45000,
  "pdf_urls": 15000,
  "issuer_pages": 28000,
  "orphan_pdfs": 1500,
  "detail_urls": 500,
  "duplicates_removed": 500
}
```

### 2-6. コマンド例

```bash
node scripts/import-izumi-urls.mjs --local
node scripts/import-izumi-urls.mjs --local --dry-run
node scripts/import-izumi-urls.mjs --local --limit=100
```

---

## 3. backfill-jgrants-canonical.mjs

### 3-1. 目的

`subsidy_cache` の jGrantsレコード（source='jgrants'）を canonical SSOT に紐付け。

### 3-2. 出力（DB更新）

**テーブル: subsidy_canonical**

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | canonical_id（例: `jg-12345`） |
| name | TEXT | 制度名称 |
| name_normalized | TEXT | 正規化名称（検索用） |
| issuer_code | TEXT | 機関コード |
| issuer_name | TEXT | 機関名称 |
| prefecture_code | TEXT | 都道府県コード |
| latest_cache_id | TEXT | 最新のsubsidy_cache.id |
| latest_snapshot_id | TEXT | 最新のsubsidy_snapshot.id |

**テーブル: subsidy_source_link**

| カラム | 型 | 説明 |
|--------|-----|------|
| canonical_id | TEXT | FK to subsidy_canonical |
| source_type | TEXT | `jgrants` / `izumi` / etc. |
| source_id | TEXT | 各ソースのID |
| match_type | TEXT | `system` / `auto` / `manual` |
| match_score | REAL | マッチ信頼度 (0-1) |
| verified | INTEGER | 1=人間確認済み |

### 3-3. canonical_id生成ルール

- jGrantsの場合: `jg-{jgrants_id}`
- その他: `{issuer_code}-{title_hash[:8]}`

### 3-4. 成果物

```json
{
  "jgrants_rows_read": 15000,
  "canonical_created": 14500,
  "canonical_existing": 500,
  "links_created": 15000,
  "cache_updated_with_canonical_id": 15000
}
```

### 3-5. コマンド例

```bash
node scripts/backfill-jgrants-canonical.mjs --local
node scripts/backfill-jgrants-canonical.mjs --local --dry-run
node scripts/backfill-jgrants-canonical.mjs --production --confirm
```

---

## 4. snapshot-jgrants.mjs

### 4-1. 目的

`subsidy_cache` から `subsidy_snapshot` を生成し、**差分検知**して通知のトリガーにする。

### 4-2. 出力（DB更新）

**テーブル: subsidy_snapshot**

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT PK | snapshot_id |
| canonical_id | TEXT | FK to subsidy_canonical |
| content_hash | TEXT | スナップショットのSHA256ハッシュ |
| diff_against_snapshot_id | TEXT | **直前との差分元** |
| diff_json | TEXT | **変更点のキー一覧＋before/after** |
| snapshot_at | TEXT | スナップショット取得日時 |
| superseded_by | TEXT | 新しいスナップショットID |

### 4-3. content_hash（SSOT）

- snapshot_json（正規化済み）をSHA256
- 正規化対象:
  - 空白・改行の正規化
  - JSON keyのソート（アルファベット順）

### 4-4. diff_json形式

```json
[
  { "key": "acceptance_end", "before": "2026-01-31", "after": "2026-02-28" },
  { "key": "max_limit", "before": 1000000, "after": 2000000 }
]
```

### 4-5. モード

| オプション | 動作 |
|-----------|------|
| `--diff-only` | content_hash が変わったものだけsnapshot作成 |
| `--force` | 全件snapshot作成（ハッシュ一致でも作成） |

### 4-6. 成果物

```json
{
  "rows_scanned": 15000,
  "snapshots_created": 14000,
  "snapshots_skipped_no_change": 1000,
  "canonical_missing": 0
}
```

### 4-7. コマンド例

```bash
node scripts/snapshot-jgrants.mjs --local
node scripts/snapshot-jgrants.mjs --local --diff-only
node scripts/snapshot-jgrants.mjs --local --force
node scripts/snapshot-jgrants.mjs --local --canonical-id=jg-12345
```

---

## 5. 電子申請系は壁打ち無しの固定方法

この判定は**スクリプトではなくSSOTデータとして管理**。

- `detail_json.is_electronic_application` が true なら:
  - `wall_chat_ready = 0` 固定（壁打ち不可）
  - `wall_chat_mode = 'disabled_electronic'`
  - 検索はOK（`search_result_badges += ['電子申請']`）

- izumi側は初期では推定困難なので:
  - `izumi_subsidies.wall_chat_mode = 'unknown'`
  - 後で `issuer_page` から判定できたら更新する

---

## 6. 実行順序（初回 / 定期）

### 初回セットアップ

```bash
# 1. マイグレーション適用
npx wrangler d1 execute subsidy-matching-production --local \
  --file=migrations/0111_canonical_snapshot_izumi.sql
npx wrangler d1 execute subsidy-matching-production --local \
  --file=migrations/0112_ssot_enhancements.sql

# 2. izumiデータ投入
node scripts/import-izumi.mjs --local
node scripts/import-izumi-urls.mjs --local

# 3. jGrantsバックフィル
node scripts/backfill-jgrants-canonical.mjs --local

# 4. snapshot生成
node scripts/snapshot-jgrants.mjs --local --force
```

### 定期更新

| 頻度 | スクリプト | オプション |
|------|-----------|-----------|
| 週次 | `import-izumi.mjs` | `--local` |
| 週次 | `import-izumi-urls.mjs` | `--local` |
| 日次 | `snapshot-jgrants.mjs` | `--local --diff-only` |

---

## 7. テーブル関連図

```
┌─────────────────┐
│ subsidy_cache   │ ← 既存（互換層）
│ (jGrants)       │
└────────┬────────┘
         │ backfill
         ▼
┌─────────────────┐      ┌─────────────────┐
│subsidy_canonical│──────│subsidy_source_  │
│ (恒久ID)        │      │link             │
└────────┬────────┘      │(jgrants/izumi)  │
         │               └─────────────────┘
         │ snapshot
         ▼
┌─────────────────┐
│subsidy_snapshot │ ← 時点データ + diff_json
│ (期間/金額/URL) │
└─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│ izumi_subsidies │──────│ izumi_urls      │
│ (policy_id)     │      │ (orphan_pdf)    │
│ + raw_json      │      │ + url_kind      │
│ + row_hash      │      │ + source_of_    │
│ + first/last_   │      │   truth_url     │
│   seen_at       │      └─────────────────┘
└─────────────────┘
```

---

## 8. ログ・再開ファイル

```
logs/
├── import-izumi_2026-02-01T10-00-00_abc123.jsonl
├── import-izumi_2026-02-01T10-00-00_abc123_errors.jsonl
├── import-izumi-urls_2026-02-01T10-05-00_def456.jsonl
├── backfill-jgrants-canonical_2026-02-01T10-10-00_ghi789.jsonl
├── snapshot-jgrants_2026-02-01T10-20-00_jkl012.jsonl
└── resume/
    ├── import-izumi_resume.json
    ├── import-izumi-urls_resume.json
    ├── backfill-jgrants-canonical_resume.json
    └── snapshot-jgrants_resume.json
```

---

## 9. 関連マイグレーション

- `migrations/0111_canonical_snapshot_izumi.sql` - Canonical Key設計 + Snapshot管理 + izumi統合
- `migrations/0112_ssot_enhancements.sql` - raw保全用カラム追加（row_hash, first/last_seen_at, url_kind, diff_json）

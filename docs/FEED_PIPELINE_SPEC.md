# フィードデータパイプライン 凍結仕様書

**バージョン**: 1.1  
**凍結日**: 2026-01-23  
**ステータス**: ✅ 凍結完了（本番反映済み）

---

## 🎉 凍結完了報告（2026-01-23）

### 本番反映済み項目

| 項目 | ステータス | 検証結果 |
|------|-----------|---------|
| 0101マイグレーション適用 | ✅ | テーブル入れ替え方式で適用完了 |
| subsidy_feed_items スキーマ | ✅ | dedupe_key UNIQUE, content_hash NOT NULL, source_type CHECK |
| feed_sources シード | ✅ | src-tokyo-shigoto/kosha/hataraku 投入済み |
| public-news API | ✅ | prefecture=13で5件取得OK |
| Cron冪等性 | ✅ | items_skipped=4, items_new=0 |
| DB件数 | ✅ | total=16件 (prefecture=15, platform=1) |

### source_type 許容値（CHECK制約）

```sql
source_type IN ('platform','support_info','prefecture','municipal','ministry','other_public')
```

**注意**: `government` は廃止。`prefecture` に統一。

---

## 1. 概要

外部APIを使用せず、以下の2段階でデータを取得・正規化・表示する。

1. **Import**: 原本をそのまま保持（監査・再現性のため）
2. **Normalize**: ダッシュボード用の"整理済み"DBへupsert

**ダッシュボードは `subsidy_feed_items` のみを参照**（原本が汚くても表示は整形される）

---

## 2. テーブル設計

### 2.1 feed_source_master（データソースマスタ）

```sql
CREATE TABLE IF NOT EXISTS feed_source_master (
  id TEXT PRIMARY KEY,                    -- 例: src-tokyo-kosha
  source_type TEXT NOT NULL,              -- 'government' | 'jgrants' | 'api' | 'manual'
  source_key TEXT NOT NULL UNIQUE,        -- 例: tokyo-kosha（dedupe用）
  name TEXT NOT NULL,                     -- 正式名称
  name_short TEXT,                        -- 略称
  base_url TEXT,                          -- ルートURL
  list_url TEXT,                          -- 一覧ページURL
  api_endpoint TEXT,                      -- APIエンドポイント（API型の場合）
  geo_scope TEXT DEFAULT 'national',      -- 'national' | 'prefecture' | 'city'
  prefecture_code TEXT,                   -- 都道府県コード（2桁）
  city_code TEXT,                         -- 市区町村コード
  data_format TEXT DEFAULT 'html',        -- 'html' | 'json' | 'csv' | 'pdf'
  update_frequency TEXT DEFAULT 'daily',  -- 'hourly' | 'daily' | 'weekly'
  priority INTEGER DEFAULT 50,            -- 優先度（1=最高, 100=最低）
  enabled INTEGER DEFAULT 1,              -- 有効フラグ
  requires_auth INTEGER DEFAULT 0,        -- 認証必要フラグ
  auth_config_json TEXT,                  -- 認証設定（JSON）
  selector_config_json TEXT,              -- CSSセレクタ設定（JSON）
  mapping_config_json TEXT,               -- フィールドマッピング（JSON）
  last_sync_at TEXT,                      -- 最終同期日時
  last_success_at TEXT,                   -- 最終成功日時
  last_error TEXT,                        -- 最終エラー
  error_count INTEGER DEFAULT 0,          -- エラー回数
  metadata_json TEXT,                     -- その他メタデータ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**初期登録データ（東京都3ソース）**:
| id | source_key | name | priority |
|----|------------|------|----------|
| src-tokyo-hataraku | tokyo-hataraku | TOKYOはたらくネット | 10 |
| src-tokyo-kosha | tokyo-kosha | 東京都中小企業振興公社 | 10 |
| src-tokyo-shigoto | tokyo-shigoto | 東京しごと財団 | 10 |

---

### 2.2 subsidy_feed_items（正規化済みフィードアイテム）

```sql
CREATE TABLE IF NOT EXISTS subsidy_feed_items (
  id TEXT PRIMARY KEY,                    -- UUID
  dedupe_key TEXT NOT NULL UNIQUE,        -- 重複排除キー（source_key:url_hash）
  
  -- ソース情報
  source_id TEXT NOT NULL,                -- feed_source_master.id への参照
  source_type TEXT NOT NULL,              -- 'government' | 'jgrants' | 'api'
  
  -- 基本情報（必須）
  title TEXT NOT NULL,                    -- タイトル（正規化後）
  title_normalized TEXT,                  -- 正規化タイトル（検索用）
  summary TEXT,                           -- 概要（原本）
  summary_sanitized TEXT,                 -- 概要（XSS対策済み）
  url TEXT NOT NULL,                      -- 元URL
  detail_url TEXT,                        -- 詳細ページURL
  pdf_urls TEXT,                          -- PDFリンク（JSON配列）
  
  -- 発行機関
  issuer_name TEXT,                       -- 発行機関名
  issuer_code TEXT,                       -- 発行機関コード
  
  -- 地域情報（2桁コード統一）
  prefecture_code TEXT,                   -- 都道府県コード（01-47）
  city_code TEXT,                         -- 市区町村コード
  target_area_codes TEXT,                 -- 対象地域コード（JSON配列）
  
  -- カテゴリ・業種
  category_codes TEXT,                    -- カテゴリコード（JSON配列）
  industry_codes TEXT,                    -- 業種コード（JSON配列）
  
  -- 金額情報
  subsidy_amount_min INTEGER,             -- 最小補助額（円）
  subsidy_amount_max INTEGER,             -- 最大補助額（円）
  subsidy_rate_min REAL,                  -- 最小補助率（0.0-1.0）
  subsidy_rate_max REAL,                  -- 最大補助率（0.0-1.0）
  subsidy_rate_text TEXT,                 -- 補助率テキスト（例: "2/3以内"）
  
  -- 期間情報
  deadline TEXT,                          -- 締切日（ISO8601）
  deadline_text TEXT,                     -- 締切テキスト（例: "随時"）
  start_date TEXT,                        -- 開始日
  end_date TEXT,                          -- 終了日
  
  -- ステータス
  status TEXT DEFAULT 'active',           -- 'active' | 'closed' | 'upcoming' | 'unknown'
  tags_json TEXT,                         -- タグ（JSON配列）
  eligibility_json TEXT,                  -- 対象要件（JSON）
  
  -- 原本保存
  raw_json TEXT,                          -- 取得時の生データ
  content_hash TEXT,                      -- コンテンツハッシュ（変更検知用）
  
  -- 新着フラグ
  is_new INTEGER DEFAULT 1,               -- 新着フラグ
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),  -- 初回検出日時
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),   -- 最終検出日時
  published_at TEXT,                      -- 公開日時
  
  -- 監査
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**インデックス（凍結）**:
```sql
CREATE INDEX idx_feed_items_dedupe ON subsidy_feed_items(dedupe_key);
CREATE INDEX idx_feed_items_source ON subsidy_feed_items(source_id);
CREATE INDEX idx_feed_items_prefecture ON subsidy_feed_items(prefecture_code);
CREATE INDEX idx_feed_items_status ON subsidy_feed_items(status);
CREATE INDEX idx_feed_items_new ON subsidy_feed_items(is_new);
CREATE INDEX idx_feed_items_first_seen ON subsidy_feed_items(first_seen_at);
```

---

### 2.3 feed_import_batches / feed_import_rows（原本保存）

```sql
-- インポートバッチ
CREATE TABLE IF NOT EXISTS feed_import_batches (
  id TEXT PRIMARY KEY,
  uploaded_by TEXT NOT NULL,              -- super_admin のユーザーID
  filename TEXT,                          -- アップロードファイル名
  format TEXT NOT NULL DEFAULT 'csv',     -- 'csv' | 'json'
  row_count INTEGER DEFAULT 0,            -- 総行数
  success_count INTEGER DEFAULT 0,        -- 成功行数
  fail_count INTEGER DEFAULT 0,           -- 失敗行数
  status TEXT DEFAULT 'processing',       -- 'processing' | 'completed' | 'failed'
  error_message TEXT,                     -- エラーメッセージ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- インポート行（原本保存）
CREATE TABLE IF NOT EXISTS feed_import_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,                 -- feed_import_batches.id
  row_no INTEGER NOT NULL,                -- 行番号
  raw_json TEXT NOT NULL,                 -- 原本JSON（パース前）
  normalized_json TEXT,                   -- 正規化後JSON
  status TEXT DEFAULT 'pending',          -- 'pending' | 'success' | 'error' | 'skipped'
  error_message TEXT,                     -- エラーメッセージ
  result_item_id TEXT,                    -- 成功時のfeed_item_id
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### 2.4 feed_daily_snapshots（日次差分追跡）

```sql
CREATE TABLE IF NOT EXISTS feed_daily_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,            -- 日付（YYYY-MM-DD）
  source_id TEXT,                         -- ソースID（NULLは全体）
  total_items INTEGER DEFAULT 0,          -- 総件数
  new_items INTEGER DEFAULT 0,            -- 新規件数
  updated_items INTEGER DEFAULT 0,        -- 更新件数
  removed_items INTEGER DEFAULT 0,        -- 削除件数
  active_items INTEGER DEFAULT 0,         -- アクティブ件数
  metadata_json TEXT,                     -- 追加メタデータ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. 正規化ルール（凍結）

### 3.1 都道府県コード統一

| 入力パターン | 正規化後 |
|-------------|---------|
| "東京都" | "13" |
| "東京" | "13" |
| "13" | "13" |
| "tokyo" | "13" |
| "全国" | NULL（target_area_codesに全都道府県） |

### 3.2 カテゴリ統一

`source_type` + `tags_json` の組み合わせで管理:
- source_type: 'platform' | 'support_info' | 'prefecture' | 'municipal' | 'ministry' | 'other_public'
- tags_json: ["設備投資", "人材育成", "DX"] 等

**注意**: 旧 `government` は `prefecture` に統一済み

### 3.3 URL正規化

- `http://` → `https://` に統一
- 末尾スラッシュ統一
- クエリパラメータは保持

### 3.4 XSS対策

`summary_sanitized` フィールドに以下を適用:
```typescript
function sanitize(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
```

---

## 4. dedupe_key 設計（凍結）

```
dedupe_key = {source_key}:{url_hash}
```

例:
- `tokyo-kosha:a1b2c3d4e5f6`
- `jgrants:abc123def456`

**url_hash の計算**:
```typescript
async function urlHash(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

---

## 5. Cron設計

### 5.1 エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/cron/scrape-tokyo-kosha | 東京都中小企業振興公社 |
| POST | /api/cron/scrape-tokyo-hataraku | TOKYOはたらくネット |
| POST | /api/cron/scrape-tokyo-shigoto | 東京しごと財団 |
| POST | /api/cron/sync-jgrants | Jグランツ同期 |
| GET | /api/cron/health | ヘルスチェック |

### 5.2 認証

```
X-Cron-Secret: {CRON_SECRET}
```

### 5.3 実行スケジュール（推奨）

| ソース | 頻度 | 推奨時刻 |
|--------|------|---------|
| tokyo-kosha | 日次 | 06:00 JST |
| tokyo-hataraku | 日次 | 06:30 JST |
| tokyo-shigoto | 日次 | 07:00 JST |
| jgrants | 日次 | 08:00 JST |

---

## 6. 差分検知フロー

```
1. Cron実行
   ↓
2. ソースからデータ取得
   ↓
3. 各アイテムのcontent_hashを計算
   ↓
4. DBの既存レコードと比較
   ↓
5-a. hash一致 → last_seen_atのみ更新
5-b. hash不一致 → 全フィールド更新, is_new=1
5-c. 新規 → INSERT, is_new=1
   ↓
6. feed_daily_snapshotsに記録
```

---

## 7. 本番反映チェックリスト

### A. スキーマ（再現性100%）

- [x] dev_schema.sql 作成
- [x] feed_source_master テーブル定義
- [x] subsidy_feed_items テーブル定義
- [x] feed_import_batches/rows テーブル定義
- [x] feed_daily_snapshots テーブル定義
- [x] 東京都3ソース初期登録

### B. インポート入口（失敗ゼロ設計）

- [ ] POST /api/admin/feed/import 実装
- [ ] CSV/JSONバリデーション
- [ ] 不備行隔離ロジック
- [ ] 部分成功レスポンス

### C. 正規化ルール

- [x] 都道府県2桁コード統一
- [x] カテゴリ統一（source_type + tags_json）
- [x] URL https統一
- [x] XSS対策（sanitize関数）

### D. 本番反映（運用事故防止）

- [ ] super_admin限定インポート
- [ ] audit_log記録
- [ ] feed_daily_snapshots日次生成
- [ ] ダッシュボードDB空でも0件表示OK

---

## 8. 企業プロファイル必須フィールド（凍結）

データ補完の最小セット:

| フィールド | テーブル | 必須 |
|-----------|---------|------|
| prefecture | companies | ✅ |
| industry_major | companies | ✅ |
| employee_count | companies | ✅ |

---

## 9. P2 実装ステータス（2026-01-23 更新）

### P2-0: 安全ゲート ✅ 完了

| 項目 | ステータス | 実装内容 |
|------|-----------|---------|
| CRON_SECRET必須化 | ✅ | 未設定/不一致は403返却 |
| 冪等性保証 | ✅ | dedupe_key + content_hash で重複防止 |
| 監査ログ | ✅ | cron_runs テーブルに実行履歴記録 |
| トランザクション | ✅ | 個別INSERT（D1制約対応） |

**検証結果**:
- 1回目実行: New=13, Skipped=0
- 2回目実行: New=0, Skipped=13（完全冪等）

### P2-1: ダッシュボード連携 ✅ 完了

| 項目 | ステータス | 実装内容 |
|------|-----------|---------|
| NEWSクエリ修正 | ✅ | source_type IN ('prefecture', 'government') |
| カラム名統一 | ✅ | prefecture_code を使用 |
| 公開API | ✅ | GET /api/agency/public-news |

### P2-2: Cron定期化 ✅ 完了

| 項目 | ステータス | 実装内容 |
|------|-----------|---------|
| 差分検知 | ✅ | items_new/items_updated/items_skipped |
| content_hash | ✅ | 変更検知用ハッシュ |
| 実行ログ | ✅ | cron_runs に記録 |

**推奨Cronスケジュール**: 毎日 06:00 JST

### P2-3: JSON import API ✅ 完了

| 項目 | ステータス | 実装内容 |
|------|-----------|---------|
| エンドポイント | ✅ | POST /api/admin/feed/import |
| 権限 | ✅ | super_admin限定 |
| dry_run | ✅ | 検証のみモード対応 |
| 上限 | ✅ | 1回最大200件 |
| 監査ログ | ✅ | audit_log に記録 |

---

## 10. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-01-23 | 1.0 | 初版凍結 |
| 2026-01-23 | 1.1 | P2-0/P2-1/P2-2/P2-3 実装完了 |

---

**凍結承認**: モギモギ（関屋紘之）  
**作成者**: AI Developer Agent

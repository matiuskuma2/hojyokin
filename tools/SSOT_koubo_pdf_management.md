# 公募要領PDF管理 SSOT (Single Source of Truth)
# 最終更新: 2026-02-09
# 管理者: モギモギ（関屋紘之）

## 1. データソース別状況サマリ

### 総計 (2026-02-09時点)
| 指標 | 件数 | 割合 |
|------|------|------|
| 総案件数 | 22,168 | 100% |
| subsidy_canonical | 3,470 | - |
| subsidy_cache | 22,258 | - |
| 公募要領PDF特定済み (izumi verified) | 248 | 1.1% |
| 公募要領PDF特定済み (manual koubo) | 17 | 0.1% |
| 関連PDFリンク記録済み (manual) | 196 | 0.9% |
| PDF取得可能性あり (izumi pdf + jgrants has_data) | 6,276 | 28.3% |
| PDF未特定 | 14,969 | 67.5% |

### 情報の泉 (izumi) - 18,651件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| 公募要領PDF URL特定 + verified | 248 | ✅ DB記録済み (izumi_urls.crawl_status='verified', url_kind='koubo') |
| 公募要領PDF URL特定 + dead_link | 321 | ❌ リンク切れ (izumi_urls.crawl_status='dead_link') |
| その他PDF（概要・申請書等） | 5,061 policy | ⏳ 内容判定未実施 |
| HTMLのみ（PDFリンクなし） | 13,250 | ⏳ 下層ページ探索未実施 |

### jGrants API - 2,934件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| application_guidelines has_data=true | 1,215 | ⚠️ PDF URL取得不可（公開API制限） |
| application_guidelines なし | 1,719 | ❌ PDF情報なし |

### 手動登録 (Phase8-10) - 583件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| 公募要領PDF特定 (detail_json記録済み) | 17 | ✅ 公募要領PDF_URL / 公募要領PDF_source をdetail_jsonに記録 |
| 関連PDFあり (公募要領キーワードなし) | 196 | ⚠️ 関連PDF_URL / PDF_source_page をdetail_jsonに記録 |
| ページ正常(200)だがPDFなし | 100 URL | ❌ 下層ページ探索が必要 |
| 404/リンク切れ | 71 URL | ❌ URL変更の可能性 |
| 接続エラー/タイムアウト | 101 URL | ❌ 再試行 or 別ルートが必要 |
| URL未登録 | 43 | ❌ 手動でURL探索が必要 |

---

## 2. DB記録ルール (SSOT)

### 2a. izumi_urls テーブル
```
公募要領PDFが特定された場合:
  crawl_status = 'verified'
  url_kind = 'koubo'
  source_of_truth_url = (実際のPDF URL)

リンク切れの場合:
  crawl_status = 'dead_link'
  last_error = 'HTTP 404 Not Found'

未チェック:
  crawl_status = 'pending' (初期値)
```

### 2b. subsidy_cache.detail_json フィールド
```json
// 公募要領PDF取得可能な場合
{
  "公募要領PDF_URL": "https://example.go.jp/koubo.pdf",
  "公募要領PDF_source": "https://example.go.jp/subsidy-page",
  "公募要領PDF_verified_at": "2026-02-09T04:44:00"
}

// 関連PDFのみの場合
{
  "関連PDF_URL": "https://example.go.jp/document.pdf",
  "PDF_source_page": "https://example.go.jp/subsidy-page",
  "PDF_total_count": 5,
  "PDF_scan_date": "2026-02-09T04:44:00"
}
```

### 2c. 新規手動登録時の必須フィールド
1. `url`: 出典ページURL（必須）
2. 公募要領PDFが見つかった場合: `公募要領PDF_URL` + `公募要領PDF_source` をdetail_jsonに含める
3. PDFが見つからなかった場合: `PDF_scan_date` + `PDF_scan_result: 'not_found'` を記録

---

## 3. 次回更新時の探索手順

### Step 1: 情報の泉 (izumi)
1. `izumi_urls WHERE crawl_status='verified' AND url_kind='koubo'` → HTTP HEAD で生存確認
2. dead_link → `izumi_subsidies.detail_url` 経由で自治体公式ページの最新URLを取得
3. pending の pdf URLs (5,770件) → 公募要領キーワード拡張マッチで再分類

### Step 2: jGrants API
1. jGrants検索APIで最新の受付中補助金をfetch
2. `has_data=true` 案件 → Playwrightでポータルページのダウンロードリンクを取得
3. 添付ファイルURLを `subsidy_cache.detail_json.公募要領PDF_URL` に記録

### Step 3: 手動登録
1. `detail_json` に `公募要領PDF_URL` がある案件 → HTTP到達性再確認
2. `PDF_source_page` がある案件 → そのページを再スクレイピングして新規PDFを探索
3. `関連PDF_URL` のみの案件 → ファイル名・内容から公募要領か判定
4. PDF無し案件 → Google検索「{補助金名} 公募要領 filetype:pdf」で探索

### Step 4: 新規追加
1. 新規補助金は必ず `subsidy_canonical` + `subsidy_cache` の両方に登録
2. INSERT OR IGNORE で重複防止
3. 登録直後にPDF探索を実行し、結果を即座にdetail_jsonに記録

---

## 4. 重複排除ルール

### canonical_id による一意性
- `subsidy_canonical.id` が全ての補助金の一意キー
- 情報の泉: `izumi_subsidies.canonical_id` でリンク
- jGrants: `subsidy_cache.canonical_id` でリンク
- 手動: `subsidy_cache.id` = `subsidy_canonical.id`

### 重複チェック手順
1. 新規追加前に `SELECT id FROM subsidy_canonical WHERE id = ?` で存在確認
2. 類似名称チェック: `SELECT id, name FROM subsidy_canonical WHERE name LIKE '%{キーワード}%'`
3. 同一発行元+同一カテゴリの案件リストを確認

### ID命名規則
- jGrants系: `jg-{jgrants_id}` (自動)
- 情報の泉系: `izumi-{policy_id}` (自動)
- 手動登録: `{UPPERCASE-HYPHEN-SEPARATED}` (例: MONODUKURI-HOJO, IT-HOJO)

---

## 5. PDFキーワード判定ルール

### 公募要領と判定するキーワード (URL内)
```
koubo, youryou, youkou, boshu, guideline, kobo
公募, 要領, 要綱, 募集
```

### 概要・パンフレットと判定するキーワード
```
gaiyou, chirashi, leaflet, overview, pamphlet
概要, チラシ, パンフレット
```

### 申請書と判定するキーワード
```
shinsei, application, moushikomi
申請, 申込
```

---

## 6. 定期更新サイクル

| 頻度 | 対象 | アクション |
|------|------|-----------|
| 週次 | jGrants API | 新規受付中案件の取得・DB登録 |
| 月次 | izumi verified URLs | HTTP到達性再確認 |
| 月次 | 手動登録 PDF_source_page | 再スクレイピング |
| 四半期 | izumi dead_links | 代替URL探索 |
| 四半期 | 新規補助金追加 | Phase N+1 のSQL作成・投入 |

---

## 7. ファイル一覧 (tools/)

| ファイル | 用途 |
|---------|------|
| seed_phase9_part1.sql | Phase9 新規50件追加SQL |
| seed_phase10_part1.sql ~ part6.sql | Phase10 新規303件追加SQL |
| update_izumi_koubo_status.sql | izumi_urls 公募要領PDF到達性更新 |
| update_manual_koubo_urls.sql | 手動登録 公募要領PDF URL記録 |
| update_manual_pdf_links.sql | 手動登録 関連PDFリンク記録 |
| koubo_pdf_unavailable_report.md | PDF取得不能案件一覧 |
| SSOT_koubo_pdf_management.md | このドキュメント (SSOT) |

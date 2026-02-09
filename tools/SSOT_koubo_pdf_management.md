# 公募要領PDF管理 SSOT (Single Source of Truth)
# 最終更新: 2026-02-09 (Phase 11 完了)
# 管理者: モギモギ（関屋紘之）

## 1. データソース別状況サマリ

### 総計 (2026-02-09 最終更新)
| 指標 | 件数 | 割合 |
|------|------|------|
| 総案件数 (subsidy_cache) | 22,258 | 100% |
| subsidy_canonical | 3,470 | - |

### PDF特定状況 (情報源横断)
| カテゴリ | 件数 | DB記録先 |
|---------|------|---------|
| 公募要領PDF特定 (izumi koubo verified) | 249 | izumi_urls.url_kind='koubo', crawl_status='verified' |
| 公募要領PDF特定 (manual detail_json) | 48 | subsidy_cache.detail_json.公募要領PDF_URL |
| 関連PDF記録 (manual detail_json) | 214 | subsidy_cache.detail_json.関連PDF_URL |
| izumi verified PDFs (全種) | 3,533 | izumi_urls.crawl_status='verified' |
| izumi dead_link | 2,545 | izumi_urls.crawl_status='dead_link' |
| izumi pending (残り) | 261 | izumi_urls.crawl_status='pending' |
| jGrants PDF URL未取得 (has_data=true) | 1,213 | subsidy_cache (API/ポータル制限で取得不可) |
| jGrants PDF情報なし | 1,721 | subsidy_cache |
| 手動登録 PDF未特定 | 295 | subsidy_cache |

---

### 情報の泉 (izumi) - 18,651件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| 公募要領PDF verified | 249 | ✅ izumi_urls (url_kind='koubo') |
| guide/案内 verified | 62 | ✅ izumi_urls (url_kind='guide') |
| subsidy_doc verified | 159 | ✅ izumi_urls (url_kind='subsidy_doc') |
| document verified | 2,583 | ✅ izumi_urls (url_kind='document') |
| leaflet verified | 284 | ✅ izumi_urls (url_kind='leaflet') |
| overview verified | 140 | ✅ izumi_urls (url_kind='overview') |
| manual/form/app verified | 56 | ✅ izumi_urls (各種kind) |
| dead_link (pdf) | 2,514 | ❌ リンク切れ |
| dead_link (orphan) | 31 | ❌ orphan PDF |
| pending (pdf) | 260 | ⏳ 未処理 |
| pending (orphan) | 1 | ⏳ 未処理 |
| HTML issuer_page (pending) | 18,421 | ⏳ HTML下層ページ (未クロール) |

### jGrants API - 2,934件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| guidelines has_data=true | 1,213 | ⚠️ PDF URL取得不可 (下記理由) |
| guidelines has_data=false | 156 | ❌ PDF添付なし |
| guidelines フィールドなし | 1,565 | ❌ PDF情報なし |

**jGrants PDF取得不可の理由（確認済み）:**
1. 公開API (`/exp/v1/public/subsidies`): `application_guidelines` は `has_data: true` のメタ情報のみ。PDF URL/ダウンロードURLは返却されない
2. ポータルサイト (`jgrants-portal.go.jp`): `robots.txt` で外部クローラー禁止。SPA (Nuxt.js) のため静的HTML取得不可
3. Playwright: sandbox未インストール。導入してもrobots.txt尊重が必要
4. **対処方針**: Phase 12以降でPlaywright導入検討、または手動でポータルからPDF URLリストをエクスポートする運用フローを構築

### 手動登録 (Phase8-10) - 583件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| 公募要領PDF特定 (detail_json記録) | 48 | ✅ 公募要領PDF_URL をdetail_jsonに記録 |
| 関連PDFあり (公募要領キーワードなし) | 214 | ⚠️ 関連PDF_URLをdetail_jsonに記録 |
| PDF未特定 | 295 | ❌ 手動探索またはGoogle検索が必要 |
| URL未登録 | 43 | ❌ 補助金名からURL探索が必要 |

---

## 2. DB記録ルール (SSOT)

### 2a. izumi_urls テーブル
```
公募要領PDFが特定された場合:
  crawl_status = 'verified'
  url_kind = 'koubo'

その他PDFがアクセス可能:
  crawl_status = 'verified'
  url_kind = 'document' | 'guide' | 'subsidy_doc' | 'leaflet' | 'overview' | 'manual' | 'form_template' | 'application_form'

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
  "PDF_source": "https://example.go.jp/subsidy-page",
  "PDF_verified_at": "2026-02-09",
  "PDF_method": "direct_pdf | sub_page | deep_crawl",
  "all_koubo_pdfs": ["url1.pdf", "url2.pdf"]
}

// 関連PDFのみの場合
{
  "関連PDF_URL": ["https://example.go.jp/doc1.pdf", "https://example.go.jp/doc2.pdf"],
  "PDF_source": "https://example.go.jp/subsidy-page",
  "PDF_verified_at": "2026-02-09",
  "PDF_method": "related_only | related_deep_crawl"
}
```

### 2c. 新規手動登録時の必須フィールド
1. `url`: 出典ページURL（必須）
2. 公募要領PDFが見つかった場合: `公募要領PDF_URL` + `PDF_source` をdetail_jsonに含める
3. PDFが見つからなかった場合: `PDF_verified_at` + `PDF_method: 'not_found'` を記録
4. **PDF出典URLを必ず併記**: 手動登録時はPDF_sourceを必ず記録し、次回更新時にそのURL周辺を再探索する

---

## 3. 次回更新時の探索手順

### Step 1: 情報の泉 (izumi)
1. `izumi_urls WHERE crawl_status='verified'` → HTTP HEAD で生存確認（月次）
2. dead_link 2,545件 → `izumi_subsidies.detail_url` 経由で自治体公式ページの最新URLを取得
3. pending 261件 → バッチHTTPチェックで到達性判定
4. HTML issuer_page 18,421件 → 将来的にクロール対象（コスト/優先度で段階的に）

### Step 2: jGrants API
1. jGrants検索APIで最新の受付中補助金をfetch（週次cron）
2. **Phase 12**: Playwright導入 → ポータルページのダウンロードリンク取得（1,213件 has_data=true対象）
3. **代替策**: jGrants ポータルの手動PDF URLリストをエクスポートし、バッチ登録
4. 新規追加分は `enriched_version: v2` として detail_json に格納

### Step 3: 手動登録
1. `detail_json.公募要領PDF_URL` がある案件（48件）→ HTTP到達性再確認
2. `detail_json.PDF_source` がある案件 → そのページを再スクレイピングして新規PDFを探索
3. `detail_json.関連PDF_URL` のみの案件（214件）→ ファイル名・内容から公募要領か判定
4. PDF無し案件（295件）→ Google検索「{補助金名} 公募要領 filetype:pdf」で探索

### Step 4: 新規追加
1. 新規補助金は必ず `subsidy_canonical` + `subsidy_cache` の両方に登録
2. INSERT OR IGNORE で重複防止
3. 登録直後にPDF探索を実行し、結果を即座にdetail_jsonに記録
4. **PDF出典URL必須**: 登録時にPDF_sourceを記録し、次回更新時の再探索ポイントとする

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
公募, 要領, 要綱, 要項, 公示, 募集
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
| 月次 | 手動登録 PDF_source | 再スクレイピング |
| 四半期 | izumi dead_links | 代替URL探索 |
| 四半期 | 新規補助金追加 | Phase N+1 のSQL作成・投入 |

---

## 7. ファイル一覧 (tools/)

| ファイル | 用途 | 更新日 |
|---------|------|--------|
| SSOT_koubo_pdf_management.md | このドキュメント (SSOT) | 2026-02-09 |
| koubo_pdf_unavailable_report.md | PDF取得不能案件一覧 | 2026-02-09 |
| update_izumi_koubo_status.sql | izumi_urls 公募要領PDF到達性更新 (248 verified + 321 dead) | 2026-02-09 |
| update_izumi_highprob_status.sql | izumi_urls 高確率PDF到達性更新 (222 verified + 188 dead) | 2026-02-09 |
| update_izumi_unclass_verified.sql | izumi_urls 未分類PDF verified (2,434件) | 2026-02-09 |
| update_izumi_unclass_dead.sql | izumi_urls 未分類PDF dead_link (1,558件) | 2026-02-09 |
| update_izumi_remaining_pdfs.sql | izumi_urls 残りPDF到達性更新 (571+434件) | 2026-02-09 |
| update_izumi_final_pdfs.sql | izumi_urls 最終バッチ (58 verified + 48 dead) | 2026-02-09 |
| update_manual_koubo_urls.sql | 手動登録 公募要領PDF URL記録 (17件) | 2026-02-09 |
| update_manual_pdf_links.sql | 手動登録 関連PDFリンク記録 (196件) | 2026-02-09 |
| update_manual_deep_crawl.sql | 手動登録 下層ページ探索結果 (31 koubo + 18 related) | 2026-02-09 |
| seed_phase8_*.sql ~ seed_phase10_*.sql | Phase 8-10 新規補助金追加SQL | 2026-02-08~09 |

---

## 8. 信頼できる情報源の特定・ルール化

### Tier 1: 高信頼（公式・一次情報源）
| 情報源 | URL | 特徴 | 更新頻度 |
|--------|-----|------|---------|
| jGrants ポータル | https://www.jgrants-portal.go.jp/ | デジタル庁運営、国の補助金中心 | 随時 |
| 情報の泉 | https://j-izumi.com/ | 地方自治体補助金を広範にカバー | 随時 |
| 各省庁公式サイト | *.go.jp | 公募要領PDFの一次情報源 | 公募時 |

### Tier 2: 中信頼（二次情報源・集約サイト）
| 情報源 | URL | 特徴 |
|--------|-----|------|
| jNet21 | https://j-net21.smrj.go.jp/ | 中小企業基盤整備機構 |
| 東京しごと財団 | https://www.shigotozaidan.or.jp/ | 東京都の補助金 |
| TOKYO創業ステーション | https://startup-station.jp/ | 東京の創業支援 |

### 情報源活用ルール
1. **一次情報源優先**: PDF URLは省庁公式 (*.go.jp, *.lg.jp) から取得
2. **情報の泉をインデックスとして活用**: detail_url → 自治体公式ページ → PDF特定
3. **jGrants APIはメタデータとして活用**: タイトル・概要・受付期間の取得に使用
4. **PDF出典URL必須記録**: 手動登録時は必ずPDF_sourceを記録し、再探索ポイントとする
5. **リンク切れ監視**: verified URLの月次HEAD check、dead_linkの四半期代替URL探索

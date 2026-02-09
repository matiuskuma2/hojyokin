# 公募要領PDF管理 SSOT (Single Source of Truth)
# 最終更新: 2026-02-09 (Phase 16: 全ソースwall_chat_ready大幅改善)
# 管理者: モギモギ（関屋紘之）

## 1. データソース別状況サマリ

### 総計 (2026-02-09 Phase 16 最終更新)
| 指標 | 件数 | 割合 | Phase 15→16 変化 |
|------|------|------|-------------------|
| 総案件数 (subsidy_cache) | 22,258 | 100% | - |
| subsidy_canonical | 3,470 | - | - |
| 定点観測対象 (koubo_monitors) | 685 | 3.1% | - |
| 定点観測 active | **473** | 69.1% | ±0 |
| 定点観測 url_lost | **158** | 23.1% | ±0 |
| 定点観測 needs_manual | **54** | 7.9% | ±0 |
| PDF Coverage | **473/685** | **69.1%** | ±0 |
| wall_chat_ready=1 | **21,430** | **96.3%** | **+1,085** (20,345→21,430) |
| wall_chat_ready=0 | **828** | 3.7% | -1,085 |
| searchable_count | **19,408** | - | **+553** (18,855→19,408) |
| ssot_accepting_count | **186** | - | ±0 |
| 受付中jGrants ready率 | **98.4%** (186/189) | - | ±0 |
| manual ready率 | **97.9%** (571/583) | - | **+90.7pp** (7.2%→97.9%) |
| jnet21 ready率 | **100%** (24/24) | - | **+100pp** (0%→100%) |
| Cron API動作確認 | **5本全稼働** | - | - |

### Phase 16 実績 (2026-02-09)
| 施策 | 対象 | 処理数 | 成功率 |
|------|------|--------|--------|
| jGrants enriched SQLフォールバック | 608件 | ~600件ready化 | 98%+ |
| manual フィールドマッピング | 541件 | 529件ready化 | 97.8% |
| jnet21 description→overview + フォールバック | 24件 | 24件ready化 | 100% |
| score5 直接ready化 | 9件 | 8件（1件excluded） | 88.9% |

### Phase 15 実績 (2026-02-09)
| 施策 | 対象 | 処理数 | 成功率 |
|------|------|--------|--------|
| enrich-jgrants (受付中未enrich) | 161件 | 155件enrich | 96.3% |
| enrich → 直接ready化 | 155件 | 36件 | 23.2% |
| daily-ready-boost (フォールバック) | 残not_ready | +120件ready | 大幅改善 |
| daily-ready-boost (初回) | enriched分 | +6件ready | - |
| app_reqs_filled | - | 44件 | - |
| eligible_filled | - | 108件 | - |
| excluded (壁打ち対象外) | - | 3件 | - |

### Phase 13 実績 (2026-02-09)
| 施策 | 対象 | 発見数 | 成功率 |
|------|------|--------|--------|
| needs_manual ページクロール | 64件 | 61件ページOK | 95% |
| サブリンク発見 | 39件 | 324リンク | - |
| サブリンク深堀（高優先度） | 121件→80件 | 34件PDF | 43% |
| 補助金別PDF候補 | 12件 | 12件 | - |
| ベストPDF選定・到達確認 | 12件 | 10件OK | 83% |
| DB復旧 (needs_manual→active) | - | **10件** | - |
| url_lost Wayback探索 | 158件 | 0件（SPA+レート制限） | → Phase 14 |
| Cron APIバグ修正 | 4箇所 | 4箇所修正 | 100% |
| Cron API fetchタイムアウト追加 | 2関数 | AbortController 15s/20s | 100% |
| Cron API動作確認テスト | 5エンドポイント | 5本全稼働 | 100% |

### Phase 12.2 実績 (2026-02-09)
| 施策 | 対象 | 発見数 | 成功率 |
|------|------|--------|--------|
| issuer_pageクロール (url_lost) | 313件 | 172件PDF発見 | 55% |
| うち公募要領PDF (koubo keyword) | - | 115件 | 37% |
| URL到達性検証 (koubo) | 115件 | 104件確認 | 90.4% |
| DB復旧 Phase12.1 (url_lost→active) | - | **104件** | - |
| other PDFスマート選定 (url_lost) | 57件 | 54件到達確認 | 95% |
| DB復旧 Phase12.2 (url_lost→active) | - | **54件** | - |
| Google検索 (needs_manual) | 73件 | 9件PDF発見 | 12.3% |
| DB復旧 (needs_manual→active) | - | **9件** | - |
| 初回到達性チェック (active全件) | 296件 | 246件HEAD確認 | 100% |
| url_lost 404記録 | 158件 | 158件記録 | 100% |
| needs_manual 検索記録 | 64件 | 64件記録 | 100% |
| crawl_log全件記録 | 685件 | 685件生成 | **100%** |

### crawl_log 分布
| result | 件数 | 説明 |
|--------|------|------|
| success | 296 | 初回到達性チェック成功 (Phase 12) |
| new_url_found | 167 | 再探索でPDF URL発見・復旧 (Phase 12.1+12.2) |
| page_not_found | 158 | issuer_page 404 + Google検索不達 |
| pdf_not_found | 64 | ポータルページ確認済み・直接PDF未発見 |

### PDF特定状況 (情報源横断)
| カテゴリ | 件数 | DB記録先 |
|---------|------|---------|
| 公募要領PDF特定 (izumi koubo verified) | 249 | izumi_urls.url_kind='koubo', crawl_status='verified' |
| 公募要領PDF特定 (manual detail_json) | 59 | subsidy_cache.detail_json.公募要領PDF_URL |
| 関連PDF記録 (manual detail_json) | 232 | subsidy_cache.detail_json.関連PDF_URL |
| izumi verified PDFs (全種) | 3,533 | izumi_urls.crawl_status='verified' |
| izumi dead_link | 2,545 | izumi_urls.crawl_status='dead_link' |
| izumi pending (残り) | 261 | izumi_urls.crawl_status='pending' |
| jGrants PDF URL未取得 (has_data=true) | 1,213 | subsidy_cache (API/ポータル制限で取得不可) |
| jGrants PDF情報なし | 1,721 | subsidy_cache |

---

## 2. 定点観測システム (Phase 12 新設)

### 2a. テーブル構成

| テーブル | 用途 | レコード数 |
|---------|------|-----------|
| koubo_monitors | 補助金ごとの公募要領PDFクローリングルール管理 | 685 (active=406, url_lost=212, needs_manual=67) |
| koubo_crawl_log | クロール実行結果履歴 | 406 (success=296, new_url_found=110) |
| koubo_discovery_queue | 新規発見補助金の確認キュー | 0 |
| v_koubo_monitor_dashboard | superadminダッシュボード用ビュー | - |
| v_koubo_discoveries_pending | 新規発見一覧ビュー | - |

### 2b. 定点観測の基本ルール

#### 公募時期判定ルール
```
1. 一度成功 → 次の公募時期を確認
2. 時期判明 → koubo_period_type を設定、直前クローリング (pre_koubo)
3. 時期不明 → 定期クローリング (monthly)
4. 毎年固定時期 (annual_fixed) → koubo_month_start/end 設定、2週間前からクロール開始
```

| koubo_period_type | 説明 | crawl_schedule |
|-------------------|------|----------------|
| annual_fixed | 毎年固定時期 (例: 毎年4月) | pre_koubo |
| annual_variable | 毎年だが時期変動 | monthly |
| biannual | 年2回 | biweekly |
| quarterly | 四半期ごと | monthly |
| irregular | 不定期 | monthly |
| one_time | 1回限り | on_demand |
| always_open | 常時公募 | quarterly |
| unknown | 未判定 | monthly |

#### URL変更検知ルール
```
1. PDF URL到達性チェック (HEAD request)
2. 到達不可 → ページURL (koubo_page_url) からPDFリンクを再抽出
3. 新しい公募要領PDFを発見 → URL更新 + backup_urls に旧URL記録
4. ページ自体が消失 → サイト全体検索 (Google: "{補助金名} 公募要領 filetype:pdf site:{domain}")
5. 再探索で発見 → URL更新、発見できなければ status='url_lost' → superadmin表示
```

#### 補助金中止ルール
```
1. status='discontinued' に変更、crawl_schedule='stopped'
2. discontinued_reason に理由記録
3. koubo_crawl_log に 'subsidy_discontinued' 記録
4. 再クローリング完全停止
5. ダッシュボードに「廃止」として表示
```

#### 新規補助金発見ルール
```
1. サイト探索中に未登録補助金を発見 → koubo_discovery_queue に登録
2. dedupe_key で重複排除
3. superadminが承認/却下
4. 承認 → subsidy_cache + koubo_monitors に自動登録
5. 却下 → rejected_reason を記録
```

### 2c. クローリングスケジュール

| crawl_schedule | 間隔 | next_crawl_at 計算 |
|----------------|------|-------------------|
| pre_koubo | 公募直前 | koubo_next_expected_at - 14日 |
| weekly | 毎週 | +7日 |
| biweekly | 隔週 | +14日 |
| monthly | 毎月 | +30日 |
| quarterly | 四半期 | +90日 |
| on_demand | 手動のみ | NULL (手動トリガーのみ) |
| stopped | 停止 | NULL (クロール停止) |

### 2d. API エンドポイント

| エンドポイント | メソッド | 認証 | 用途 |
|---------------|---------|------|------|
| /api/cron/koubo-dashboard | GET | なし | ダッシュボードデータ（公開） |
| /api/cron/koubo-crawl | POST | CRON_SECRET | 定期クロール実行 |
| /api/cron/koubo-crawl-single | POST | CRON_SECRET | 単体クロール実行 |
| /api/cron/koubo-check-period | POST | CRON_SECRET | 公募時期判定 |
| /api/cron/koubo-discover | POST | CRON_SECRET | 新規発見承認/却下 |
| /api/admin/monitors/dashboard | GET | Admin認証 | 管理者ダッシュボード |
| /api/admin/monitors/alerts | GET | Admin認証 | アラート一覧 |
| /api/admin/monitors/discoveries | GET | Admin認証 | 新規発見キュー |
| /api/admin/monitors/:id | GET | Admin認証 | 個別モニター詳細 |
| /api/admin/monitors/:id/discontinue | POST | Admin認証 | 補助金廃止登録 |
| /api/admin/monitors/:id/update-url | POST | Admin認証 | URL手動更新 |
| /api/admin/monitors/:id/schedule | POST | Admin認証 | スケジュール変更 |

### 2e. UIダッシュボード

- **URL**: /monitor
- **認証**: 不要（公開ダッシュボード）
- **表示内容**:
  - 統計カード（総監視数/アクティブ/PDF保有/URL消失/手動対応/期限超過）
  - アラートタブ（URL消失・手動対応必要・期限超過の一覧）
  - クロール履歴タブ（最近の実行結果）
  - カバレッジタブ（情報源別の監視率・PDF保有率）
  - スケジュールタブ（公募時期タイプ・クロール頻度のチャート）
  - 新規発見タブ（未登録補助金のキュー）

---

## 3. DB記録ルール (SSOT)

### 3a. koubo_monitors テーブル
```
アクティブ監視:
  status = 'active'
  crawl_schedule = 'monthly' | 'pre_koubo' | 'weekly' 等
  koubo_pdf_url = PDFのURL（特定済みの場合）
  koubo_page_url = PDFが掲載されているHTMLページURL

URL消失:
  status = 'url_lost'
  → superadminダッシュボードに表示
  → 手動で再探索 or Google検索で代替URL取得

手動対応必要:
  status = 'needs_manual'
  → 自動クロールでは取得不可な案件
  → superadminが手動でURL更新

補助金廃止:
  status = 'discontinued'
  crawl_schedule = 'stopped'
  discontinued_reason = '廃止理由'
  discontinued_at = '廃止確認日'

一時停止:
  status = 'suspended'
  → 一時的にクロール停止（再開可能）
```

### 3b. izumi_urls テーブル
```
公募要領PDFが特定された場合:
  crawl_status = 'verified'
  url_kind = 'koubo'

その他PDFがアクセス可能:
  crawl_status = 'verified'
  url_kind = 'document' | 'guide' | 'subsidy_doc' | 'leaflet' 等

リンク切れの場合:
  crawl_status = 'dead_link'

未チェック:
  crawl_status = 'pending' (初期値)
```

### 3c. subsidy_cache.detail_json フィールド
```json
{
  "公募要領PDF_URL": "https://example.go.jp/koubo.pdf",
  "PDF_source": "https://example.go.jp/subsidy-page",
  "PDF_verified_at": "2026-02-09",
  "PDF_method": "direct_pdf | sub_page | deep_crawl | google_search",
  "all_koubo_pdfs": ["url1.pdf", "url2.pdf"],
  "関連PDF_URL": ["https://example.go.jp/doc1.pdf"]
}
```

---

## 4. 定点観測運用フロー

### 4a. 定期実行サイクル

| 頻度 | 対象 | Cron API | アクション |
|------|------|----------|-----------|
| 毎日 | koubo_monitors (active + overdue) | POST /koubo-crawl?batch=20 | PDF到達性チェック、URL変更検知 |
| 週次 | jGrants API | 既存cron | 新規受付中案件の取得・DB登録 |
| 週次 | 公募時期判定 | POST /koubo-check-period | 時期未判定案件のスケジュール設定 |
| 月次 | izumi verified URLs | POST /koubo-crawl (izumi対象) | HTTP到達性再確認 |
| 四半期 | izumi dead_links | 手動/バッチ | 代替URL探索 |

### 4b. エスカレーションフロー

```
クロール結果: success → そのまま（next_crawl_atを更新）
クロール結果: url_changed → URL更新 + backup記録 + そのままactive
クロール結果: not_found → koubo_page_url再探索
  → 発見 → URL更新
  → 未発見 → Google検索 "{補助金名} 公募要領 filetype:pdf site:{domain}"
    → 発見 → URL更新
    → 未発見 → status='url_lost' → superadminに表示
```

### 4c. superadmin対応フロー

1. **URL消失アラート**:
   - ダッシュボード /monitor で確認
   - /api/admin/monitors/:id/update-url で手動URL更新
   - または /api/admin/monitors/:id/discontinue で補助金廃止登録

2. **手動対応必要アラート**:
   - PDF取得不能な案件（73件）が対象
   - Google検索 or 直接省庁サイト確認
   - URL判明 → update-url、不可 → 保留（再チャレンジ対象）

3. **新規発見**:
   - /monitor の新規発見タブで確認
   - /api/cron/koubo-discover で承認/却下

---

## 5. 情報源別 詳細状況

### 情報の泉 (izumi) - 18,651件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| 公募要領PDF verified | 249 | ✅ 定点観測対象 |
| guide/案内 verified | 62 | ✅ |
| subsidy_doc verified | 159 | ✅ |
| document verified | 2,583 | ✅ |
| leaflet verified | 284 | ✅ |
| overview verified | 140 | ✅ |
| manual/form/app verified | 56 | ✅ |
| dead_link (pdf) | 2,514 | ❌ リンク切れ（うち334件はkouboキーワード付き、1件回復） |
| dead_link (orphan) | 31 | ❌ |
| pending (pdf) | 260 | ⏳ |
| pending (orphan) | 1 | ⏳ |
| HTML issuer_page (pending) | 18,421 | ⏳ |

### jGrants API - 2,934件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| guidelines has_data=true | 1,213 | ⚠️ PDF URL取得不可 |
| guidelines has_data=false | 156 | ❌ |
| guidelines フィールドなし | 1,565 | ❌ |

### 手動登録 (Phase8-11) - 583件
| 分類 | 件数 | ステータス |
|------|------|-----------|
| 公募要領PDF特定 | 59 | ✅ 定点観測対象 |
| 関連PDFあり | 232 | ⚠️ 関連PDF_URL記録済み |
| PDF未特定 (探索済み) | 73 | ❌ needs_manual → superadmin表示 |
| URL未到達/未登録 | 219 | ❌ |

---

## 6. PDFキーワード判定ルール

### 公募要領と判定するキーワード
```
URL内: koubo, youryou, youkou, boshu, guideline, kobo
テキスト内: 公募要領, 公募要綱, 募集要項, 募集案内, 交付要綱
```

### 概要・パンフレットと判定するキーワード
```
gaiyou, chirashi, leaflet, overview, pamphlet, 概要, チラシ, パンフレット
```

### 申請書と判定するキーワード
```
shinsei, application, moushikomi, 申請, 申込
```

---

## 7. 重複排除ルール

### canonical_id による一意性
- `subsidy_canonical.id` が全ての補助金の一意キー
- 情報の泉: `izumi_subsidies.canonical_id`
- jGrants: `subsidy_cache.canonical_id`
- 手動: `subsidy_cache.id` = `subsidy_canonical.id`

### ID命名規則
- jGrants系: `jg-{jgrants_id}` | 元のAPIキー
- 情報の泉系: `izumi-{policy_id}`
- 手動登録: `{UPPERCASE-HYPHEN-SEPARATED}` (例: MONODUKURI-HOJO)
- 新規発見: `DISC-{timestamp}`

---

## 8. 信頼できる情報源の特定・ルール化

### Tier 1: 高信頼（公式・一次情報源）
| 情報源 | URL | 特徴 |
|--------|-----|------|
| jGrants ポータル | https://www.jgrants-portal.go.jp/ | デジタル庁運営 |
| 情報の泉 | https://j-izumi.com/ | 地方自治体広範カバー |
| 各省庁公式サイト | *.go.jp | PDF一次情報源 |
| 各自治体公式サイト | *.lg.jp | 地方補助金の一次情報源 |

### Tier 2: 中信頼（二次情報源）
| 情報源 | URL | 特徴 |
|--------|-----|------|
| jNet21 | https://j-net21.smrj.go.jp/ | 中小企業基盤整備機構 |
| 東京しごと財団 | https://www.shigotozaidan.or.jp/ | 東京都の補助金 |

### 情報源活用ルール
1. **一次情報源優先**: PDF URLは *.go.jp, *.lg.jp から取得
2. **情報の泉をインデックスとして活用**: detail_url → 公式ページ → PDF特定
3. **PDF出典URL必須記録**: 手動登録時は必ずPDF_sourceを記録
4. **リンク切れ監視**: verified URLの月次HEAD check

---

## 9. ファイル一覧 (tools/)

| ファイル | 用途 | 更新日 |
|---------|------|--------|
| SSOT_koubo_pdf_management.md | このドキュメント (SSOT) | 2026-02-09 |
| koubo_pdf_unavailable_report.md | PDF取得不能案件一覧 | 2026-02-09 |
| seed_koubo_monitors.sql | koubo_monitors 初期データ投入 | 2026-02-09 |
| update_izumi_koubo_status.sql | izumi_urls 公募要領PDF到達性更新 | 2026-02-09 |
| update_izumi_dead_recovery.sql | izumi dead_link 再探索結果 | 2026-02-09 |
| update_manual_deep_crawl.sql | 手動登録 下層ページ探索結果 | 2026-02-09 |
| update_manual_deep_search2.sql | 手動登録 ディープサーチ結果 (11件追加) | 2026-02-09 |
| update_manual_koubo_urls.sql | 手動登録 公募要領PDF URL記録 | 2026-02-09 |
| update_manual_pdf_links.sql | 手動登録 関連PDFリンク記録 | 2026-02-09 |

---

## 10. マイグレーション

| ファイル | 用途 | 適用状況 |
|---------|------|---------|
| migrations/0124_koubo_monitoring_system.sql | koubo_monitors + koubo_crawl_log + koubo_discovery_queue | ✅ リモート・ローカル適用済み |

---

## 11. 次回優先アクション (Phase 12+)

1. **koubo_monitors 全685件の初回クロール実行** → POST /koubo-crawl?batch=20 を繰り返し
2. **公募時期判定** → POST /koubo-check-period で時期未判定案件のスケジュール設定
3. **手動登録73件** → Google検索 "{補助金名} 公募要領 filetype:pdf site:go.jp" で追加探索
4. **izumi dead_link 2,211件** → detail_url経由で自治体最新URL取得（回復率低、段階的に）
5. **jGrants 1,213件** → Playwright導入検討（robots.txt制約あり）
6. **新規補助金追加** → RSSフィード/jGrants APIの週次チェックで自動発見
7. **外部Cron設定** → Cloudflare Workers Cron Triggers で定期実行を自動化

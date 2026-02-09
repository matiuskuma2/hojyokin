# クロール運用ルール (CRAWL_RULES)

> **目的**: 公募要領PDFの定点観測クロールの運用ルール、壁打ち結果、復旧パターンを記録
> **最終更新**: 2026-02-09 (Phase 12.2)
> **参照**: [SSOT_koubo_pdf_management.md](../tools/SSOT_koubo_pdf_management.md)

---

## 1. クロール対象と優先度

### 1a. 定点観測テーブル: `koubo_monitors`

| フィールド | 用途 |
|-----------|------|
| `subsidy_id` | 補助金ID (FK → subsidy_cache.id) |
| `status` | active / url_lost / needs_manual / discontinued |
| `koubo_pdf_url` | 公募要領PDF直接URL |
| `koubo_page_url` | 公募要領が掲載されているページURL |
| `pdf_source_method` | PDF URL の取得方法（下記参照） |
| `crawl_schedule` | monthly / pre_koubo / on_demand |
| `koubo_period_type` | annual_fixed / annual_variable / irregular / unknown |
| `next_crawl_at` | 次回クロール予定日 |
| `fallback_search_query` | URL消失時のGoogle検索クエリ |

### 1b. pdf_source_method の値

| 値 | 意味 | Phase |
|----|------|-------|
| `jgrants_api` | jGrants APIのattachmentsから取得 | Phase 11 |
| `izumi_verified` | izumi_urls経由で検証済み | Phase 11 |
| `manual_koubo_url` | 手動登録（公式サイトから直接） | Phase 11 |
| `manual_deep_crawl` | 手動深層クロール（公式サイトのサブページ探索） | Phase 11 |
| `manual_google_search` | Google検索で発見 | Phase 11 |
| `issuer_page_crawl` | issuer_pageクロールで発見（kouboキーワード一致） | Phase 12.1 |
| `deep_crawl_keyword` | スマート選定（ファイル名にyoko/bosyu等のキーワード） | Phase 12.2 |
| `deep_crawl_related` | スマート選定（ファイル名に関連キーワード） | Phase 12.2 |
| `deep_crawl_generic` | スマート選定（キーワードなし、最善候補） | Phase 12.2 |

---

## 2. クロールエンジン（APIエンドポイント）

| エンドポイント | メソッド | 用途 |
|--------------|---------|------|
| `/api/cron/koubo-crawl` | POST | バッチクロール（`?batch=20`で20件ずつ） |
| `/api/cron/koubo-crawl-single` | POST | 単一補助金クロール（`?id=subsidy-id`） |
| `/api/cron/koubo-check-period` | POST | 公募時期判定（未設定のものに時期を設定） |
| `/api/cron/koubo-dashboard` | GET | ダッシュボードデータ取得 |
| `/api/cron/koubo-discover` | POST | 新規補助金発見（RSSフィード等） |
| `/api/admin/monitors/:id/discontinue` | POST | 補助金中止処理 |
| `/api/admin/monitors/:id/update-url` | POST | URL手動更新 |

### 2a. 日次運用（予定）

```bash
# 外部CronまたはCloudflare Cron Triggersで以下を日次実行
POST https://hojyokin.pages.dev/api/cron/koubo-crawl?batch=20
# → next_crawl_at <= now() の20件を自動チェック
# → 結果を koubo_crawl_log に記録
# → URL変更検知時はアラート生成
```

---

## 3. 公募時期判定ルール

| `koubo_period_type` | 説明 | `crawl_schedule` |
|---------------------|------|-----------------|
| `annual_fixed` | 毎年同じ月に公募開始 | `pre_koubo`（開始2週間前からクロール） |
| `annual_variable` | 毎年公募あるが時期変動 | `monthly`（毎月チェック） |
| `irregular` | 不定期（随時公募） | `monthly` |
| `unknown` | 時期不明 | `monthly` |

### 3a. pre_koubo スケジュール設定

```
koubo_month_start = 4  # 4月開始
koubo_month_end = 6    # 6月終了
→ next_crawl_at = 3月15日 (開始2週前) に設定
→ 以降2週間ごとに再チェック
```

---

## 4. URL消失時の復旧フロー

### 4a. 復旧優先度

```
1. issuer_page クロール（元のページのリダイレクト先を確認）
2. koubo_page_url クロール（掲載ページのPDFリンクを再取得）
3. Google検索（fallback_search_query を使用）
4. Wayback Machine（アーカイブから取得）
5. needs_manual → superadmin エスカレーション
```

### 4b. 壁打ち結果: URL復旧パターン（Phase 12.1-12.2で確認済み）

#### パターン1: issuer_page経由復旧（成功率 55%）
- **対象**: url_lost 313件
- **方法**: izumi_subsidies.issuer_page URLをHEADチェック → 200ならページをクロール → PDFリンク抽出
- **結果**: 172件PDF発見、うちkouboキーワード一致115件、到達確認104件
- **教訓**: 自治体ページはURL変更が多いが、issuer_pageは比較的安定

#### パターン2: ファイル名スコアリング（成功率 95%）
- **対象**: kouboキーワードなしの57件のPDF
- **方法**: ファイル名にスコア付与（yoko=10, bosyu=9, gaiyou=7, annai=6, hojo=5...）
- **結果**: 54件到達確認、最高スコアのPDFを選定して登録
- **教訓**: 「公募要領」をファイル名に含めない自治体が多い。yoko/bosyu/gaiyou が高信頼

#### パターン3: Google検索（成功率 12%）
- **対象**: needs_manual 73件（中央省庁・大型補助金）
- **方法**: `{補助金名} 公募要領 filetype:pdf` でGoogle検索
- **結果**: 9件PDF発見、64件は直接PDFなし
- **教訓**: 中央省庁系は公募要領が「応募要領」「募集要項」等の別名で掲載されることが多い。filetype:pdfの検索精度は国の制度ほど低い（複数省庁に分散）

#### パターン4: 残りurl_lost 158件の傾向
- **404/410**: 134件 — ページ自体が消失（自治体サイトリニューアル等）
- **その他**: 24件 — リダイレクト先不明
- **次の手**: Wayback Machine + 新年度公募再開時の自動検知

---

## 5. crawl_log の result 値

| result | 意味 | 次のアクション |
|--------|------|--------------|
| `running` | クロール実行中 | 待機 |
| `success` | PDF到達確認OK、変更なし | next_crawl_at を更新 |
| `url_changed` | PDFのURLが変更された | 新URLを記録、content_hashを更新 |
| `new_url_found` | 消失していたURLが新しく見つかった | statusをactiveに変更 |
| `page_not_found` | ページ自体が404 | url_lostステータスを維持 |
| `pdf_not_found` | ページはあるがPDFが見つからない | needs_manualステータスに変更 |
| `subsidy_discontinued` | 補助金自体が廃止 | discontinuedステータスに変更 |
| `new_subsidy_found` | 新規補助金を発見 | discovery_queueに追加 |
| `error` | クロールエラー | error_messageを記録、リトライ |

---

## 6. crawl_type の値

| crawl_type | 意味 |
|-----------|------|
| `scheduled` | 定期クロール（Cronジョブ） |
| `manual` | 手動実行 |
| `re_explore` | URL消失後の再探索 |
| `new_discovery` | 新規補助金発見時 |

---

## 7. ファイル名スコアリングルール（Phase 12.2で確立）

PDF URLのファイル名から公募要領らしさを判定するスコアリング：

| スコア | キーワード | 例 |
|--------|-----------|-----|
| 10 | `yoko`, `youko` | `R50401_yoko_tyuusyoukigyoukumiai.pdf` |
| 9 | `bosyu`, `boshu`, `募集` | `r7_bosyuyoko.pdf` |
| 7 | `gaiyou`, `概要`, `outline` | `shisanmokuzai_yoko_gaiyou.pdf` |
| 6 | `annai`, `案内`, `guide` | `0annai.pdf` |
| 5 | `hojo`, `josei`, `補助`, `助成` | `kokusaihojokin.pdf` |
| 4 | `shinsei`, `申請`, `application` | `shinsei_youkou.pdf` |
| 3 | `制度`, `seido`, `事業` | `jigyou_seido.pdf` |
| 2 | `pdf`, `document` | ファイルがPDFであること自体 |
| 1 | その他 | スコアなし |

**使用方法**: 複数PDFが見つかった場合、最高スコアのPDFを `koubo_pdf_url` に登録。

---

## 8. 次のPhaseで検証すべき仮説

### 8a. Wayback Machine 復旧（Phase 13候補）
- **仮説**: url_lost 158件のうち、Waybackにアーカイブが残っているものがある
- **検証方法**: `https://web.archive.org/web/*/URL` でチェック
- **期待成功率**: 30-40%（公的機関のサイトはアーカイブされやすい）

### 8b. jGrants Playwright PDF抽出（Phase 13候補）
- **仮説**: jGrants API の attachments フィールドが空でも、ポータルUIにはPDFリンクがある
- **対象**: 1,213件（has_data=trueだがPDF URLなし）
- **検証方法**: Playwright でブラウザ操作 → PDF URL 抽出

### 8c. 新年度公募開始時の自動検知（Phase 14候補）
- **仮説**: 4-6月に大量の公募が再開されるため、url_lost→activeに自動復旧できる
- **検証方法**: 日次クロールで page_not_found → success に変化した件数を追跡

---

## 9. 壁打ち結果記録テンプレート

新しい壁打ちを行った場合、以下のテンプレートで記録：

```markdown
### 壁打ち: [タイトル] (YYYY-MM-DD)

**目的**: [何を検証するか]
**対象**: [何件、どのデータ]
**方法**: [具体的な手順]
**結果**:
- 成功: N件 (XX%)
- 失敗: N件 (XX%)
- 発見パターン: [...]
- 失敗パターン: [...]
**結論**: [ルール化できる知見]
**次のアクション**: [...]
**SQL保存先**: tools/[filename].sql
```

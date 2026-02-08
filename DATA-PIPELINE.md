# DATA-PIPELINE.md - 補助金データパイプライン設計書

> **最終更新**: 2026-02-08
> **ステータス**: 運用中（Phase A完了、Phase D/E未着手）

---

## 1. パイプライン全体図

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: データ収集（ソース別）                                    │
│                                                                  │
│  [Izumi API]  ──→ izumi_subsidies (18,651件)                     │
│                      │                                           │
│                      ↓ POST /api/cron/promote-izumi-to-cache     │
│                                                                  │
│  [JGrants API] ──→ POST /api/cron/sync-jgrants                   │
│  [Tokyo系]     ──→ POST /api/cron/scrape-tokyo-*                 │
│  [JNet21]      ──→ POST /api/cron/promote-jnet21                 │
│  [Manual]      ──→ 管理画面から手動登録                             │
│                                                                  │
│                      ↓                                           │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: キャッシュ（subsidy_cache）                               │
│                                                                  │
│  subsidy_cache: 21,692件                                         │
│   ├─ izumi:         18,651件 (ready: 18,580)                     │
│   ├─ jgrants:        2,932件 (ready: 1,597)                      │
│   ├─ tokyo-shigoto:     28件 (ready: 22)                         │
│   ├─ jnet21:            24件 (ready: 0)                          │
│   ├─ tokyo-kosha:       23件 (ready: 23)                         │
│   ├─ manual:            19件 (ready: 13)                         │
│   └─ tokyo-hataraku:    15件 (ready: 15)                         │
│                                                                  │
│  品質ゲート:                                                      │
│   ├─ wall_chat_ready = 1   → 検索・壁打ち対象                     │
│   ├─ wall_chat_excluded = 1 → 除外（交付申請系等）                 │
│   └─ wall_chat_ready = 0, excluded = 0 → 未整備                  │
│                                                                  │
│  ↓ POST /api/cron/crawl-izumi-details（品質向上クロール）          │
│  ↓ POST /api/cron/recalc-wall-chat-ready（再判定）                │
│  ↓ POST /api/cron/daily-ready-boost（フォールバック自動化）        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: 正規化（SSOT）← 現在JGrantsのみ、将来全ソース対応       │
│                                                                  │
│  subsidy_canonical: 2,903件 ← JGrants + manual のみ              │
│  subsidy_snapshot:  2,900件                                      │
│  subsidy_source_link: jgrants: 2,894 + manual: 4                 │
│                                                                  │
│  ⚠️ Izumi/Tokyo等はまだこのレイヤーに未到達                       │
│  → Phase D で対応予定                                            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: 検索・表示                                               │
│                                                                  │
│  SEARCH_BACKEND = "cache"（2026-02-08〜）                        │
│   → subsidy_cache から直接検索                                    │
│   → 条件: wall_chat_ready=1, excluded=0, expires_at>now          │
│   → 期限: acceptance_end_datetime IS NULL or >= today             │
│   → 結果: ~18,767件が検索可能                                     │
│                                                                  │
│  （旧: SEARCH_BACKEND = "ssot"）                                  │
│   → subsidy_canonical + subsidy_snapshot で検索                   │
│   → JGrantsの178件しか出なかった問題があった                       │
│   → Phase D完了後にssotに戻す予定                                 │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Layer 5: ユーザー機能                                             │
│                                                                  │
│  GET /api/subsidies/search → スクリーニング → 表示                │
│  GET /api/subsidies/:id    → 詳細 + 壁打ちチャット判定            │
│  POST /api/chat            → AI壁打ちチャット                     │
│  POST /api/drafts          → 申請書ドラフト生成                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 必須ルール（新規データソース追加時）

### 2.1 チェックリスト

新しいデータソースを追加する際は、以下を**全て**実装すること。

| # | 項目 | 説明 | 該当コード |
|---|---|---|---|
| 1 | subsidy_cache 投入 | ソースデータ → subsidy_cache へ INSERT/UPDATE | cron/*.ts |
| 2 | wall_chat_ready 判定 | detail_json の品質ゲート設定 | lib/wall-chat-ready.ts |
| 3 | acceptance_end_datetime 設定 | 受付期限をテーブルカラムに反映 | cron/izumi-promote.ts 等 |
| 4 | expires_at 設定 | レコードの有効期限 | INSERT時に設定 |
| 5 | コスト記録 | API呼び出し・スクレイプの記録 | lib/cost/cost-logger.ts |
| 6 | 管理画面反映 | ダッシュボードにソースが表示される | admin-dashboard/*.ts |
| 7 | canonical 昇格（将来） | subsidy_canonical への正規化 | Phase D で対応 |

### 2.2 acceptance_end_datetime の扱い

```
acceptance_end_datetime の値と検索表示の関係:

NULL             → 「期限不明」として検索に表示（常時受付の可能性あり）
2026-03-31       → 2026-03-31まで検索に表示、以降は自動非表示
< today          → 検索から自動除外（期限切れ）
```

**重要**: detail_json内の`acceptance_end_datetime`と、subsidy_cacheテーブルの`acceptance_end_datetime`カラムの**両方を同期**すること。検索はテーブルカラムを使う。

### 2.3 wall_chat_ready の条件

```typescript
// 5項目中2つ以上で isSearchable = true（検索に表示）
// 5項目中3つ以上で isWallChatReady = true（壁打ち対象）
//
// 1. overview（概要説明）
// 2. application_requirements（申請要件）
// 3. eligible_expenses（対象経費）
// 4. required_documents（必要書類）
// 5. deadline（申請締切）
```

### 2.4 除外パターン

```typescript
// KOFU_SHINSEI: タイトルに「交付決定後」「採択後の手続き」等 → titleOnly
// SENGEN_NINTEI: 宣言・認定系（補助金ではない）
// GUIDELINE_ONLY: ガイドライン・手引きのみ → titleOnly
// RENSHU_TEST: 練習・テスト用データ → titleOnly
//
// ⚠️ overviewに「交付申請は○月まで」等が含まれても除外しない
// ⚠️ titleOnlyフラグがtrueの場合、タイトルのみで判定する
```

---

## 3. コスト計測ルール

### 3.1 記録が必要なAPI呼び出し

| サービス | 記録対象 | コスト | 関数 |
|---|---|---|---|
| Firecrawl | スクレイピング API 呼び出し | $0.001/credit | `logFirecrawlCost()` |
| OpenAI | GPT-4o-mini 等の推論 | トークン従量 | `logOpenAICost()` |
| Vision OCR | PDF → テキスト変換 | ページ従量 | `logVisionCost()` |
| simple_scrape | 直接fetchスクレイプ | $0（無料） | `logSimpleScrapeCost()` |

### 3.2 コスト計測の原則

1. **全ての外部API呼び出しを記録する**（コストが$0でも）
2. **成功/失敗の両方を記録**する（失敗率の把握）
3. **URL、subsidyId、sourceIdを必ず記録**する（デバッグ用）
4. **コスト記録の失敗でメイン処理を止めない**（try-catchで保護）

### 3.3 管理画面での表示

- `GET /api/admin-ops/costs` でサービス別のコスト・呼び出し数を表示
- simple_scrape は今日/今月の呼び出し数・成功率を表示
- 日別コスト推移チャートに全サービスを含める

---

## 4. 期限管理ライフサイクル（Phase E で実装予定）

```
新規投入    → acceptance_end_datetime を設定
  ↓
受付中      → 検索に表示
  ↓
期限切れ    → 自動非表示（SQLの WHERE 条件で除外）
  ↓
次期公募    → クロールで新しい期限を検出 → acceptance_end_datetime を更新
  ↓
再表示      → 自動的に検索に復帰
```

### 4.1 自動取り下げ

- 検索クエリに `acceptance_end_datetime IS NULL OR acceptance_end_datetime >= today` 条件あり
- 期限切れは自動的に検索から消える（DBからは削除しない）
- `expires_at` はレコード自体の有効期限（通常はキャッシュ期間）

### 4.2 次期復活（未実装 → Phase E）

- 定期クロールで公式サイトをチェック
- 新しい募集期間が検出された場合、`acceptance_end_datetime` を更新
- `wall_chat_ready` の再判定を実行
- 監視対象URL: `data_source_monitors` テーブルに登録

### 4.3 設計方針

| 状態 | acceptance_end_datetime | wall_chat_ready | 検索に出るか |
|---|---|---|---|
| 受付中 | 2026-12-31 | 1 | ✅ |
| 期限不明（常時受付） | NULL | 1 | ✅ |
| 期限切れ | 2025-12-31 | 1 | ❌ |
| 未整備 | NULL | 0 | ❌ |
| 除外 | - | excluded=1 | ❌ |

---

## 5. SEARCH_BACKEND の切替判断

| 値 | 説明 | 利点 | 制限 |
|---|---|---|---|
| `cache` | subsidy_cache 全件検索 | 全ソース対応、高速 | 正規化されていない |
| `ssot` | canonical + snapshot 検索 | 正規化された構造データ | JGrantsのみ（Izumi未対応） |
| `dual` | ssot結果を返しつつcache差分ログ | 移行検証用 | コスト2倍 |

**現在**: `cache`（2026-02-08〜）
**将来**: Phase D完了後に `ssot` に戻す予定

### 切替手順
```bash
# 本番環境
echo "cache" | npx wrangler pages secret put SEARCH_BACKEND --project-name hojyokin

# 戻す場合
echo "ssot" | npx wrangler pages secret put SEARCH_BACKEND --project-name hojyokin
```

---

## 6. Cron Worker スケジュール

### hojyokin-cron Worker
- URL: https://hojyokin-cron.sekiyadubai.workers.dev
- スケジュール:
  - `0 21 * * *` (06:00 JST): sync-jgrants + enrich-jgrants
  - `0 */1 * * *` (毎時): crawl-izumi-details（10件/回）

### 手動バッチ実行
```bash
# Izumiクロール（残約14,000件、10件/回）
curl -X POST "https://hojyokin.pages.dev/api/cron/crawl-izumi-details?mode=upgrade" \
  -H "X-Cron-Secret: ..."

# wall_chat_ready再判定
curl -X POST "https://hojyokin.pages.dev/api/cron/recalc-wall-chat-ready?source=izumi&batch=200" \
  -H "X-Cron-Secret: ..."
```

---

## 7. テーブル関係図

```
izumi_subsidies ──promote──→ subsidy_cache ←──sync──── JGrants API
                                   │
                                   ├── detail_json (品質データ)
                                   ├── wall_chat_ready (品質フラグ)
                                   ├── wall_chat_excluded (除外フラグ)
                                   ├── acceptance_end_datetime (受付期限)
                                   └── expires_at (キャッシュ有効期限)
                                   
                                   ↑ 検索(cache mode)
                                   
subsidy_canonical ──snapshot──→ subsidy_snapshot
       ↑                              ↑
  subsidy_source_link            検索(ssot mode)
  (JGrants/manual のみ)
  
api_cost_logs ← 全API呼び出しのコスト記録
  ├── service: openai / firecrawl / simple_scrape / vision_ocr
  ├── cost_usd: コスト（simple_scrapeは$0）
  ├── success: 成功/失敗
  └── url / subsidy_id: トレーサビリティ
```

---

## 8. 未解決の課題

### 高優先度
- [ ] **Phase D**: Izumi → canonical 昇格パイプライン（SSOT検索に統合）
- [ ] **Phase E**: 期限切れ自動管理 + 次期公募復活ロジック
- [ ] **管理画面**: KPIダッシュボードをsubsidy_cacheベースに更新

### 中優先度
- [ ] Izumiの`acceptance_end_datetime`がNULL 18,651件 → クロールで取得中（14,000件残）
- [ ] JGrants expired 2,745件の次期復活チェック
- [ ] JNet21 24件のready化（コンテンツ不足）

### 低優先度
- [ ] 重複統合（go.jp系 516件の重複可能性）
- [ ] canonical に is_accepting フラグの自動更新ロジック
- [ ] SEARCH_BACKEND=ssot への段階的移行

---

## 変更履歴

| 日付 | 変更内容 | 影響 |
|---|---|---|
| 2026-02-08 | SEARCH_BACKEND=cache 切替 | 検索結果 178件 → 18,767件 |
| 2026-02-08 | searchFromCache ページネーション修正 | total_count が正確に |
| 2026-02-08 | KOFU_SHINSEI/GUIDELINE_ONLY 除外修正 | +457件 ready化 |
| 2026-02-08 | simpleScrape コスト記録追加 | 管理画面にスクレイプ数表示 |
| 2026-02-08 | acceptance_end_datetime カラム同期 | クロール結果が検索に反映 |
| 2026-02-07 | hojyokin-cron Worker デプロイ | 自動クロール開始 |
| 2026-02-07 | Izumi 18,651件 promote完了 | subsidy_cache総件数 21,692 |

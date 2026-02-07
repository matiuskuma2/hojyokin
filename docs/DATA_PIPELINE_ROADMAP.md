# データ収集パイプライン ロードマップ v2

**作成日**: 2026-02-07
**最終更新**: 2026-02-07
**ステータス**: 確定版

---

## 1. 現状棚卸し（2026-02-07 時点）

### 1.1 本番DB データ全量

| テーブル | 件数 | 用途 | 状態 |
|----------|------|------|------|
| **subsidy_cache** | 3,003 | 検索・壁打ちキャッシュ | ✅ 稼働中 |
| **subsidy_canonical** | 2,903 | SSOT（正規化制度） | ✅ 稼働中 |
| **subsidy_source_link** | 2,898 | ソース紐付け | ✅ 稼働中 |
| **subsidy_snapshot** | 2,900 | スナップショット | ✅ 稼働中 |
| **izumi_subsidies** | 18,651 | 情報の泉データ | ⚠️ 未連携（crawl_done=0） |
| **izumi_urls** | 24,760 | 情報の泉URL | ⚠️ 未クロール（pending=24,760） |
| **discovery_items** | 24 | 外部データステージング | ⚠️ 少数 |
| **crawl_queue** | 114 | クロールキュー | ⚠️ 少数 |
| **source_registry** | 66 | クロール対象台帳 | ✅ |
| **subsidy_feed_items** | 49 | フィード（ニュース） | ⚠️ 少数 |
| **feed_sources** | 102 | ソース定義 | ✅ |
| **extraction_queue** | 519 | 抽出キュー | ⚠️ 滞留 |
| **extraction_results** | 0 | 抽出結果 | ❌ 未稼働 |
| **api_cost_logs** | 192 | APIコスト記録 | ✅ |
| **cron_runs** | 761 | Cron実行ログ | ✅ |
| **users** | 44 | ユーザー | ✅ |
| **companies** | 25 | 会社 | ✅ |
| **user_companies** | 35 | ユーザー-会社紐付け | ✅ |
| **chat_sessions** | 16 | チャットセッション | ✅ |
| **chat_messages** | 75 | チャットメッセージ | ✅ |

**総テーブル数**: 100

### 1.2 ソース別データ状況

| ソース | subsidy_cache件数 | detail_json有 | wall_chat_ready | 壁打ち可能率 |
|--------|-------------------|---------------|-----------------|-------------|
| **jGrants** | 2,894 | 2,894 (100%) | 1,512 (52%) | **52%** |
| **tokyo-shigoto** | 28 | 28 (100%) | 22 (79%) | 79% |
| **jnet21** | 24 | 24 (100%) | 0 (0%) | 0% |
| **tokyo-kosha** | 23 | 23 (100%) | 23 (100%) | 100% |
| **manual** | 19 | 14 (74%) | 13 (68%) | 68% |
| **tokyo-hataraku** | 15 | 15 (100%) | 15 (100%) | 100% |
| **合計** | **3,003** | 2,998 (99.8%) | **1,585 (52.8%)** | **52.8%** |

### 1.3 壁打ち（wall_chat）品質内訳

| 状態 | 件数 | has_expenses | has_docs | has_forms |
|------|------|-------------|----------|-----------|
| ready (pending mode) | 1,582 | 1,564 | ✅ | — |
| not_ready (pending) | 1,418 | 237 | 431有/715無 | — |
| ready (full mode) | 3 | 3 | 3 | 3 |

**ボトルネック分析**:
- 1,418件が「not_ready」 → 主因は `eligible_expenses` の欠落（1,181件に該当）
- `eligible_expenses` が取得できれば → 約1,000件が追加でready化の見込み
- full mode（完全壁打ち）は3件のみ → PDF解析が必要

### 1.4 jGrants API 現状

| 項目 | 値 |
|------|-----|
| API版 | exp/v1 (検索) + exp/v2 (詳細) |
| 受付中件数(例: "補助金") | 142 |
| 最終同期 | 2026-01-28 03:33 |
| 最終詳細取得 | 2026-01-28 03:35 |
| 累計処理数 | enrich: 4,924件 / detail-scrape: 99件 |
| DB内jGrants件数 | 2,894 (canonical) |

### 1.5 情報の泉（izumi）データ

| 項目 | 値 |
|------|-----|
| 取得済み件数 | 18,651 (DB) / 18,743 (CSV) |
| policy_id範囲 | 28 〜 116,453 |
| URL件数 | 24,760 (primary: 17,066) |
| canonical紐付け済み | 4件 (0.02%) |
| jGrants紐付け済み | 0件 |
| クロール済み | 0件 |
| 金額データ有り | 13,488件 (72%) |
| 都道府県データ有り | 4,526件 (24%) |

### 1.6 マイグレーション状態

- **適用済み**: 28マイグレーション（d1_migrations追跡）
- **未追跡だが適用済み**: 21マイグレーション（手動/直接適用でテーブルは存在）
  - 0101〜0122 のマイグレーションファイルはすべて実テーブルとして存在
  - **feed_source_master テーブルは存在しない**（コードに参照はあるが、テーブル未作成）
- **DB整合性**: 概ね良好（canonical/snapshot/cache の連携OK）

---

## 2. 問題定義と優先順位

### 問題A: 壁打ちデータ不足（最重要）
- **現状**: wall_chat_ready = 1,585件 / 3,003件（52.8%）
- **目標**: 2,500件以上（80%+）
- **手段**: jGrants detail_json のエンリッチ強化（eligible_expenses抽出）

### 問題B: 情報の泉18,651件が活用できていない
- **現状**: izumiは取得済みだがsubsidy_cacheに未連携（壁打ちにも検索にも使えない）
- **目標**: izumi → canonical紐付け → subsidy_cacheへの統合
- **課題**: jGrantsとの重複排除、品質確保

### 問題C: jGrants同期が1/28以降停止
- **現状**: 最終実行が2026-01-28。10日間同期なし
- **原因**: cron自動実行が設定されていない（手動トリガーのみ）
- **目標**: 自動cron設定でdaily同期を復活

### 問題D: PDFデータ取得・解析が未稼働
- **現状**: extraction_results = 0件、extraction_queue = 519件滞留
- **目標**: PDF抽出パイプライン稼働
- **手段**: Firecrawl/Vision OCR連携

---

## 3. 実装ロードマップ

### Phase 0: 基盤復旧 【即時・1-2日】

**目標**: 止まっているパイプラインの復旧

1. **Cron自動実行の復活**
   - Cloudflare Workers Cron Triggersの設定確認/再設定
   - sync-jgrants / enrich-jgrants の daily実行
   - recalc-wall-chat-ready の daily実行
   
2. **jGrants同期の即時実行**
   - `POST /api/cron/sync-jgrants` 手動トリガー
   - `POST /api/cron/enrich-jgrants` 手動トリガー
   - 10日間の差分を回収

3. **マイグレーション追跡の正規化**
   - 21件の未追跡マイグレーションをd1_migrationsに記録
   - feed_source_masterテーブルの作成（必要な場合）

### Phase 1: 壁打ちready率向上 【1週間】

**目標**: wall_chat_ready を 52% → 80% に引き上げ

1. **eligible_expenses 抽出強化**
   - enrich-jgrants の抽出ロジック改善
   - `extractFieldsFromOverview` の正規表現パターン拡張
   - 受付中補助金を優先的に再処理

2. **apply-field-fallbacks 再実行**
   - 欠落フィールドのフォールバック生成
   - jGrants v2 API detail_json からの追加フィールド抽出

3. **recalc-wall-chat-ready 実行**
   - フィールド補完後に再計算
   - ready率の推移モニタリング

### Phase 2: izumi → canonical 紐付け 【2週間】

**目標**: izumi 18,651件のうちjGrantsと紐付け可能な分を統合

1. **紐付けアルゴリズム実装**
   - タイトル類似度マッチング（Levenshtein / Jaccard）
   - 金額 + 地域 + タイトル複合スコア
   - match_scoreによるランク分け: strong (0.9+) / medium (0.7-0.9) / weak (0.5-0.7)

2. **izumi_jgrants_mapping テーブル活用**
   - 0111/0115マイグレーションで定義済み
   - 紐付け結果をizumi_subsidies.canonical_idに格納

3. **izumi独自分（紐付け不可）の扱い**
   - jGrantsに存在しない地方独自補助金 → subsidy_canonical に新規追加候補
   - 品質フィルタ: タイトル有 + 金額有 + URL有 のものを優先

### Phase 3: izumi → subsidy_cache統合 【2-3週間】

**目標**: izumiデータを壁打ち・検索で利用可能にする

1. **izumi URLs クロール開始**
   - 24,760 URLs の優先順位付け（primary URLs優先）
   - Firecrawl による段階的クロール（日次100-200件）
   - HTML → detail_json 変換ロジック

2. **subsidy_cache への投入**
   - izumiデータから subsidy_cache フォーマットへ変換
   - source = 'izumi' として追加
   - wall_chat_ready の判定実行

3. **検索APIの拡張**
   - 検索結果にizumiソースを含める
   - ソースフィルタリング（jgrants / izumi / all）

### Phase 4: PDF解析パイプライン稼働 【3-4週間】

**目標**: PDF抽出で壁打ちのfull mode対応を拡大

1. **extraction_queue の消化**
   - 519件の滞留キューを処理
   - Firecrawl / Vision OCR連携
   - コスト管理（Freeze-COST-0〜4準拠）

2. **PDF → required_forms / eligible_expenses 抽出**
   - OpenAI Vision APIによるPDF解析
   - 構造化JSON出力
   - full mode への昇格判定

3. **新規PDFの自動検出**
   - jGrants detail からPDF URL抽出 → extraction_queueへ投入
   - izumi URLs からPDF URL検出

### Phase 5: 自動更新パイプライン 【4-6週間】

**目標**: 全データの自動更新・鮮度管理

1. **izumi 差分同期（週次）**
   - j-izumi.com からの差分取得
   - 新規policy_idの検出と取得
   - 消失/終了の検出

2. **jGrants daily同期の安定化**
   - Cron Triggers設定
   - エラーハンドリング強化
   - 監視アラート設定

3. **コンテンツ更新検知**
   - content_hash による変更検知
   - 更新時のsnapshot生成
   - 期限切れ補助金の自動更新

---

## 4. 数値目標サマリー

| 指標 | 現状 | Phase 1後 | Phase 3後 | Phase 5後 |
|------|------|-----------|-----------|-----------|
| subsidy_cache 件数 | 3,003 | 3,200+ | 10,000+ | 17,000+ |
| wall_chat_ready 件数 | 1,585 | 2,500+ | 5,000+ | 10,000+ |
| wall_chat_ready 率 | 52.8% | 80%+ | 50%+ | 60%+ |
| canonical紐付けizumi | 4 | 500+ | 3,000+ | 10,000+ |
| 受付中の補助金数 | 178 | 200+ | 500+ | 1,000+ |
| full mode壁打ち | 3 | 10+ | 50+ | 200+ |
| 自動cron稼働 | ❌停止中 | ✅ daily | ✅ daily | ✅ daily+weekly |

---

## 5. データソース優先順位（確定）

| 順位 | ソース | 方法 | 用途 |
|------|--------|------|------|
| 1 | **jGrants API** | REST API (v1/v2) | 制度収集・SSOT・壁打ち |
| 2 | **情報の泉** | Playwright + CSV | 地方独自補助金の補完 |
| 3 | **東京都系** | Firecrawl | 東京都の補助金（既存3ソース） |
| 4 | **PDF（自動取得）** | Firecrawl + Vision | 壁打ちfull mode拡充 |
| 5 | **PDF（手動取得）** | 手動アップロード | 重要補助金のfull mode確保 |

**PDF手動取得方針**: APIで取得できないPDFは手作業で取得・アップロードしてでもデータを増やす。特に受付中の主要補助金（ものづくり、IT導入、持続化等）を優先。

---

## 6. コスト試算（月次）

| 項目 | Phase 1 | Phase 3 | Phase 5 |
|------|---------|---------|---------|
| Firecrawl | $0 (API不使用) | $83 (Standard) | $83 (Standard) |
| OpenAI Vision | $10 | $50 | $100 |
| Cloudflare D1 | $5 | $5 | $5 |
| R2 Storage | $0 | $1.5 | $5 |
| **月額合計** | **$15** | **$139.5** | **$193** |

---

## 7. 技術的依存関係

```
Phase 0 (基盤復旧)
    ↓
Phase 1 (壁打ち率向上) ← jGrants enrich強化
    ↓
Phase 2 (izumi紐付け) ← マッチングアルゴリズム実装
    ↓
Phase 3 (izumi統合) ← URL クロール + detail_json生成
    ↓
Phase 4 (PDF解析) ← Firecrawl/Vision連携 (Phase 1,2,3と並行可)
    ↓
Phase 5 (自動更新) ← Cron Triggers + 監視
```

**並行実行可能**:
- Phase 4 は Phase 2/3 と並行可
- Phase 1 は即時着手可能
- Phase 0 は最優先・即時

---

## 8. 次のアクション（今日やること）

1. ✅ 本番DB完全棚卸し
2. ✅ データ収集パイプラインロードマップ策定（本ドキュメント）
3. [ ] Phase 0: jGrants手動同期実行（sync + enrich）
4. [ ] Phase 0: Cron Triggers設定確認
5. [ ] Phase 1: eligible_expenses抽出ロジック分析・改善案策定

---

*最終更新: 2026-02-07*

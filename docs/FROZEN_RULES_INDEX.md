# 凍結ルール インデックス（唯一の入口）

**作成日**: 2026-01-25  
**最終更新**: 2026-01-26 v4  
**ステータス**: 凍結

---

## 概要

本ドキュメントは、ホジョラク（補助金マッチングシステム）の全凍結ルールを一覧化し、各詳細仕様へのリンクを提供する。

**原則**: このファイルを見れば、どの凍結ルールがどこに書かれているかが分かる。

---

## ドキュメント構成（3カテゴリ）

> **この3分類の意味**
> - **Frozen Specs**: システム動作の「真実」を規定する仕様。変更禁止。
> - **Frozen Checklists**: 運用で守るべきチェックリスト。リリース判定に使う。
> - **Review Reports**: 過去のレビュー・監査結果の参考記録。

### 1. Frozen Specs（凍結仕様）
システム動作を規定する凍結済み仕様

| ファイル | 概要 |
|----------|------|
| [COST_ACCOUNTING_FREEZE_SPEC.md](./COST_ACCOUNTING_FREEZE_SPEC.md) | APIコスト記録・集計・表示の凍結ルール（Freeze-COST-0〜4） |
| [FEED_PIPELINE_SPEC.md](./FEED_PIPELINE_SPEC.md) | RSS/クローラーパイプラインの凍結仕様（jGrants/自治体ページ） |
| [AGENCY_DASHBOARD_FREEZE.md](./AGENCY_DASHBOARD_FREEZE.md) | Agency管理画面の凍結仕様 |

### 2. Frozen Checklists（凍結チェックリスト）
品質管理とリリース判定のためのチェックリスト

| ファイル | 概要 |
|----------|------|
| [QUALITY_FREEZE_CHECKLIST.md](./QUALITY_FREEZE_CHECKLIST.md) | P0-P1タスクと品質ゲートの凍結チェックリスト |
| [FREEZE_CHECKLIST_NEXT_PHASE.md](./FREEZE_CHECKLIST_NEXT_PHASE.md) | 次フェーズ向け凍結条件と合格基準 |

### 3. Review Reports（レビューレポート）
過去のレビュー・監査結果の記録

| ファイル | 概要 |
|----------|------|
| *(今後追加予定)* | 凍結ルール適合性レビュー結果 |

---

## コスト会計凍結（Freeze-COST-0〜4）

**詳細**: [COST_ACCOUNTING_FREEZE_SPEC.md](./COST_ACCOUNTING_FREEZE_SPEC.md)

| ルール | 内容 |
|--------|------|
| **Freeze-COST-0** | `api_cost_logs` テーブルが唯一の真実、super_admin はこれのみ表示 |
| **Freeze-COST-1** | 推定値禁止、実数のみ集計・表示 |
| **Freeze-COST-2** | 外部API呼び出しは wrapper 経由必須（DB必須化 = CostGuard） |
| **Freeze-COST-3** | 失敗時もコスト記録（credits消費は発生） |
| **Freeze-COST-4** | モデル名/単価/billing は metadata_json に保持 |

**実装ファイル**:
- `src/lib/cost/cost-logger.ts` - コスト記録ロガー
- `src/lib/cost/rates.ts` - 凍結単価定義
- `src/lib/cost/firecrawl.ts` - Firecrawl wrapper
- `src/lib/cost/vision.ts` - Vision OCR wrapper
- `src/routes/admin-dashboard.ts` - 集計API

**P0修正（2026-01-25）**:

| 修正 | 内容 |
|------|------|
| **CostGuard** | `env.DB` なしでの Firecrawl/Vision 呼び出しは `firecrawlBlockedByCostGuard` / `visionBlockedByCostGuard` で記録（cooldown とは別） |
| **billing=unknown** | Firecrawl usage 取得不可時は `cost_usd=0` + `billing=unknown` で記録（USAGE_MISSING） |
| **billing=known** | Vision は pages unknown でも 1ページルール適用、`billing=known` 固定 |
| **unknown_billing_count** | super_admin API で `unknown_billing_count` を集計・表示 |

**運用ルール**:
- `USAGE_MISSING` が出た日の unknown billing は未確定扱い（推定禁止）
- 月次で `unknown_billing_count` を確認し、Firecrawl API の usage 仕様変更を検知

---

## データ収集凍結（Freeze-4）

**詳細**: [FEED_PIPELINE_SPEC.md](./FEED_PIPELINE_SPEC.md)

### 収集ソース方針（2026-01-26 確定）

| ソース | 分類 | 状況 | 用途 |
|--------|------|------|------|
| **jGrants (API)** | 公式 | ✅ 採用 | 制度収集・検索母集団 |
| **自治体公式ページ** | 公式 | ✅ 採用 | 制度収集・検索母集団 |
| **J-Net21** | 二次ソース | ❌ 撤廃 | 士業ニュース専用に降格 |

**J-Net21 撤廃理由**:
- 二次ソース（公式API/ページからの集約）であり、情報鮮度・精度が不十分
- discovery_items / subsidy_cache には入れず、制度検索の母集団にしない
- 士業ダッシュボードのニュース枚としてのみ利用

### Cron エンドポイント（稼働中）

| ルール | 内容 |
|--------|------|
| **Freeze-4-JGRANTS** | sync-jgrants → subsidy_cache |
| **Freeze-4-KOSHA** | scrape-tokyo-kosha → subsidy_feed_items |
| **Freeze-4-SHIGOTO** | scrape-tokyo-shigoto → subsidy_feed_items |
| **Freeze-4-CLEANUP** | cleanup-queue → done 7日ローテーション |

**関連テーブル**:
- `subsidy_cache` - 補助金キャッシュ（検索・壁打ち対象）
- `subsidy_feed_items` - フィードアイテム（ニュース表示用）
- `feed_sources` - ソース定義

---

## 品質凍結（P0-P1）

**詳細**: [QUALITY_FREEZE_CHECKLIST.md](./QUALITY_FREEZE_CHECKLIST.md)

### P0（最優先・本番影響大）
- P0-1: Agency検索UIをUser版に寄せる
- P0-2: 会社登録"失敗ゼロ"ルール
- P0-3: Agencyリンク管理

### P1（優先度中・UX向上）
- P1-1: Feedカテゴリ枠組み固定
- P1-2: 顧客所在地連動NEWS優先
- P1-3: おすすめサジェスト

---

## Agency機能凍結

**詳細**: [AGENCY_DASHBOARD_FREEZE.md](./AGENCY_DASHBOARD_FREEZE.md)

- 顧客管理（CRUD）
- リンク発行・管理
- 受付管理
- 補助金検索導線

---

## DB スキーマ凍結

### 主要テーブル（変更禁止）

| テーブル | 用途 |
|----------|------|
| `users` | ユーザー |
| `companies` | 会社基本情報 |
| `company_profile` | 会社詳細 |
| `user_companies` | ユーザー-会社紐付け |
| `agencies` | 代理店 |
| `agency_members` | 代理店メンバー |
| `agency_clients` | 代理店顧客 |
| `subsidy_cache` | 補助金キャッシュ |
| `discovery_items` | 外部データステージング |
| `api_cost_logs` | APIコスト記録（唯一の真実） |
| `extraction_logs` | 抽出ログ |
| `extraction_queue` | 抽出ジョブキュー |

### 非推奨・削除予定

| テーブル | 理由 |
|----------|------|
| `company_memberships` | user_companies に統一 |
| `cost_usage_log` | api_cost_logs に統一（残置） |

---

## API 契約凍結

### super_admin 専用エンドポイント

| エンドポイント | 用途 |
|----------------|------|
| `GET /api/admin-ops/cost/summary` | コスト集計サマリー（`unknown_billing_count` 含む） |
| `GET /api/admin-ops/cost/logs` | コストログ一覧 |
| `GET /api/admin-ops/extraction-queue/summary` | 抽出キュー状況 |
| `POST /api/admin-ops/extraction-queue/consume` | キュー消化（手動） |
| `GET /api/admin-ops/discovery/stats` | discovery_items 統計（ステージ分布、フィールド充足率） |
| `GET /api/admin-ops/discovery/missing-fields` | 欠落フィールド詳細分析 |

### Cron エンドポイント

| エンドポイント | 用途 |
|----------------|------|
| `POST /api/cron/sync-jgrants` | jGrants API 同期 |
| `POST /api/cron/scrape-tokyo-kosha` | 東京都中小企業振興公社 |
| `POST /api/cron/scrape-tokyo-shigoto` | 東京しごと財団 |
| `POST /api/cron/cleanup-queue` | done 7日ローテーション |
| `POST /api/cron/enqueue-extractions` | 抽出キュー投入 |
| `POST /api/cron/consume-extractions` | 抽出キュー消化 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-01-25 | v1 | 初版作成（コスト会計凍結、P0修正追加） |
| 2026-01-25 | v2 | 3カテゴリ構成（Frozen Specs / Checklists / Reports）、CostGuard・billing 詳細追加 |
| 2026-01-26 | v3 | J-Net21一覧クロール (sync-jnet21-catalog)、promote LIMIT拡大、discovery stats API 追加 |
| 2026-01-26 | v4 | J-Net21を制度収集から撤廃（士業ニュース専用に降格）、関連API/ドキュメント削除 |

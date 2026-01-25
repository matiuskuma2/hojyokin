# 凍結ルール インデックス（唯一の入口）

**作成日**: 2026-01-25  
**最終更新**: 2026-01-25 v1  
**ステータス**: 凍結

---

## 概要

本ドキュメントは、ホジョラク（補助金マッチングシステム）の全凍結ルールを一覧化し、各詳細仕様へのリンクを提供する。

**原則**: このファイルを見れば、どの凍結ルールがどこに書かれているかが分かる。

---

## 凍結仕様一覧

| カテゴリ | ファイル | 概要 |
|----------|----------|------|
| **コスト会計** | [COST_ACCOUNTING_FREEZE_SPEC.md](./COST_ACCOUNTING_FREEZE_SPEC.md) | APIコスト記録・集計・表示の凍結ルール |
| **データ収集** | [FEED_PIPELINE_SPEC.md](./FEED_PIPELINE_SPEC.md) | RSS/クローラーパイプラインの凍結仕様 |
| **品質管理** | [QUALITY_FREEZE_CHECKLIST.md](./QUALITY_FREEZE_CHECKLIST.md) | P0-P1タスクと品質ゲートの凍結チェックリスト |
| **次フェーズ** | [FREEZE_CHECKLIST_NEXT_PHASE.md](./FREEZE_CHECKLIST_NEXT_PHASE.md) | 次フェーズ向け凍結条件と合格基準 |
| **Agency機能** | [AGENCY_DASHBOARD_FREEZE.md](./AGENCY_DASHBOARD_FREEZE.md) | Agency管理画面の凍結仕様 |

---

## コスト会計凍結（Freeze-COST-0〜4）

**詳細**: [COST_ACCOUNTING_FREEZE_SPEC.md](./COST_ACCOUNTING_FREEZE_SPEC.md)

| ルール | 内容 |
|--------|------|
| **Freeze-COST-0** | `api_cost_logs` テーブルが唯一の真実、super_admin はこれのみ表示 |
| **Freeze-COST-1** | 推定値禁止、実数のみ集計・表示 |
| **Freeze-COST-2** | 外部API呼び出しは wrapper 経由必須（DB必須化） |
| **Freeze-COST-3** | 失敗時もコスト記録（credits消費は発生） |
| **Freeze-COST-4** | モデル名/単価は metadata_json に保持 |

**実装ファイル**:
- `src/lib/cost/cost-logger.ts` - コスト記録ロガー
- `src/lib/cost/rates.ts` - 凍結単価定義
- `src/lib/cost/firecrawl.ts` - Firecrawl wrapper
- `src/lib/cost/vision.ts` - Vision OCR wrapper
- `src/routes/admin-dashboard.ts` - 集計API

**追加ルール（P0修正）**:
- `env.DB` なしでの Firecrawl/Vision 呼び出しは禁止（エラーで拒否）
- Firecrawl: usage 取得不可時は `USAGE_MISSING` として記録
- Vision: pages 取得不可時は 1 ページ固定（凍結ルール）

---

## データ収集凍結（Freeze-4）

**詳細**: [FEED_PIPELINE_SPEC.md](./FEED_PIPELINE_SPEC.md)

| ルール | 内容 |
|--------|------|
| **Freeze-4-RSS** | sync-jnet21 → discovery_items (stage=raw) |
| **Freeze-4-PROMOTE** | promote-jnet21 → subsidy_cache へ昇格 |
| **Freeze-4-CRON** | hojyokin-cron-feed Worker で自動実行 |

**関連テーブル**:
- `discovery_items` - 外部データのステージング
- `discovery_promote_log` - 昇格ログ
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
| `GET /api/admin-ops/cost/summary` | コスト集計サマリー |
| `GET /api/admin-ops/cost/logs` | コストログ一覧 |
| `GET /api/admin-ops/extraction-queue/summary` | 抽出キュー状況 |
| `POST /api/admin-ops/extraction-queue/consume` | キュー消化（手動） |

### Cron エンドポイント

| エンドポイント | 用途 |
|----------------|------|
| `POST /api/cron/sync-jnet21` | J-Net21 RSS同期 |
| `POST /api/cron/promote-jnet21` | discovery_items 昇格 |
| `POST /api/cron/enqueue-extractions` | 抽出キュー投入 |
| `POST /api/cron/consume-extractions` | 抽出キュー消化 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-01-25 | v1 | 初版作成（コスト会計凍結、P0修正追加） |

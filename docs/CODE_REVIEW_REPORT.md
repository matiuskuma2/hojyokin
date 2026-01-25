# Superadmin 画面コードレビュー報告書

**日付**: 2026-01-25  
**レビュー対象**: admin.tsx, admin-dashboard.ts, admin.ts  
**レビュー担当**: AI Assistant  

---

## 1. エグゼクティブサマリー

### 発見した重大な問題

| 優先度 | 問題 | 状態 | 影響 |
|--------|------|------|------|
| 🔴 Critical | フロントエンド→バックエンドAPIパス不一致 | ✅ 修正済み | 管理画面の全機能が動作しない |
| 🟡 Medium | 一部エンドポイントでの認証ガード漏れの可能性 | 要確認 | 潜在的セキュリティリスク |
| 🟢 Low | コードの重複・リファクタリング推奨 | 将来課題 | メンテナンス性 |

---

## 2. 修正済み問題

### 2.1 APIパス不一致（Critical - 修正済み）

**問題**:  
`admin.tsx`（フロントエンド）が `/api/admin/...` パスでAPIを呼び出していたが、対応するエンドポイントは `admin-dashboard.ts` の `/api/admin-ops/...` にマウントされていた。

**影響を受けていたエンドポイント**:
```
/api/admin/dashboard       → /api/admin-ops/dashboard
/api/admin/costs          → /api/admin-ops/costs
/api/admin/coverage       → /api/admin-ops/coverage
/api/admin/updates        → /api/admin-ops/updates
/api/admin/data-freshness → /api/admin-ops/data-freshness
/api/admin/ops/*          → /api/admin-ops/*
```

**正しく動作していたエンドポイント** (admin.ts):
```
/api/admin/users  - ユーザー管理
/api/admin/audit  - 監査ログ
```

**修正内容**:  
`src/pages/admin.tsx` の11箇所のAPI呼び出しパスを修正。

**コミット**: `ade2f5d` - fix(admin-ui): Fix API path mismatch in admin pages

---

## 3. 依存関係マップ

### 3.1 バックエンドAPIルーティング構造

```
src/index.tsx
├── /api/auth        → authRoutes (auth.ts)
├── /api/companies   → companiesRoutes (companies.ts)
├── /api/subsidies   → subsidiesRoutes (subsidies.ts)
├── /api/jobs        → jobsRoutes (jobs.ts)
├── /internal        → internalRoutes (internal.ts)
├── /api/knowledge   → knowledgeRoutes (knowledge.ts)
├── /api/consumer    → consumerRoutes (consumer.ts)
├── /api/kpi         → kpiRoutes (kpi.ts)
├── /api/admin       → adminRoutes (admin.ts)           ⭐ ユーザー管理、監査ログ
├── /api/admin-ops   → adminDashboardRoutes (admin-dashboard.ts) ⭐ KPI、コスト、運用監視
├── /api/profile     → profileRoutes (profile.ts)
├── /api/chat        → chatRoutes (chat.ts)
├── /api/draft       → draftRoutes (draft.ts)
├── /api/agency      → agencyRoutes (agency.ts)
├── /api/portal      → portalRoutes (portal.ts)
├── /api/cron        → cronRoutes (cron.ts)
└── /api/masters     → mastersRoutes (masters.ts)
```

### 3.2 管理画面フロントエンド構造

```
src/pages/admin.tsx (154KB)
├── /admin           - ダッシュボード (KPI + キュー + コスト)
├── /admin/users     - ユーザー管理
├── /admin/costs     - コスト詳細 (super_admin限定)
├── /admin/updates   - 更新状況一覧
├── /admin/audit     - 監査ログ
└── /admin/ops       - 運用チェック (super_admin限定)
```

### 3.3 admin-dashboard.ts エンドポイント一覧

| エンドポイント | 権限 | 機能 |
|--------------|------|------|
| GET /dashboard | admin+ | KPI + キュー状況 |
| GET /costs | super_admin | コスト集計 |
| GET /updates | admin+ | 更新状況一覧 |
| GET /agency-kpi | super_admin | Agency KPI |
| GET /data-freshness | super_admin | データ鮮度監視 |
| GET /alerts | super_admin | アラート管理 |
| POST /generate-daily-snapshot | super_admin | 日次KPIスナップショット |
| GET /coverage | super_admin | L1/L2/L3 網羅性 |
| GET /kpi-history | super_admin | KPI履歴 |
| GET /debug/company-check | super_admin | 会社紐づけ診断 |
| GET /ops/data-health | admin+ | データ健全性 |
| POST /ops/trigger-sync | super_admin | 手動JGrants同期 |
| GET /ops/daily-report | admin+ | デイリーレポート |
| GET /cron-status | super_admin | Cron実行状況 |
| GET /feed-failures | super_admin | Feed失敗一覧 |
| GET /wall-chat-status | super_admin | WALL_CHAT_READY状況 |
| POST /extract-forms | super_admin | PDF抽出テスト |
| POST /jgrants/enrich-detail | super_admin | JGrants詳細取得 |

### 3.4 admin.ts エンドポイント一覧

| エンドポイント | 権限 | 機能 |
|--------------|------|------|
| GET /users | admin+ | ユーザー一覧 |
| GET /users/:id | admin+ | ユーザー詳細 |
| POST /users/:id/disable | admin+ | ユーザー凍結 |
| POST /users/:id/enable | admin+ | ユーザー復活 |
| POST /users/:id/reset-password | admin+ | パスワードリセット |
| GET /audit | admin+ | 監査ログ一覧 |
| GET /stats | admin+ | 管理者ダッシュボード統計 |
| GET /audit/stats | admin+ | 監査ログ統計 |
| POST /sync-jgrants | super_admin | JGrants同期 |
| POST /sync-jgrants/bulk | super_admin | JGrantsバルク同期 |
| GET /subsidy-cache/stats | admin+ | キャッシュ統計 |

---

## 4. 潜在的な懸念点

### 4.1 認証・認可ガードの一貫性

**観察**:
- `admin-dashboard.ts` では全ルートに `requireAuth` と `requireAdmin` を適用
- 多くのエンドポイントで追加の `super_admin` チェックを実行

**推奨**:
- 各エンドポイントの権限レベルを文書化
- ミドルウェアレベルでのロールベース分岐を検討

```typescript
// TODO: 要確認 - super_admin専用エンドポイントをグループ化して
// ミドルウェアで一括制御する方が安全
adminDashboard.use('/super/*', requireSuperAdmin);
```

### 4.2 エラーハンドリングの標準化

**観察**:
- 各エンドポイントで `try-catch` でエラー処理
- エラーコードは統一されている (`DASHBOARD_ERROR`, `COSTS_ERROR` 等)

**推奨**:
- 共通エラーハンドラの導入を検討
- SQLエラー時の詳細ログ記録の強化

### 4.3 クエリパフォーマンス

**観察**:
- 多くのエンドポイントで複数の `db.prepare()` を連続実行
- 日付範囲計算が各エンドポイントで重複

**推奨**:
```typescript
// 共通ユーティリティ化の例
const getDateRanges = () => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  return { today, weekAgo, monthAgo };
};
```

---

## 5. 依存データベーステーブル

### 5.1 管理画面で使用されるテーブル

| テーブル | 用途 | マイグレーション |
|---------|------|------------------|
| users | ユーザー管理 | 0001_initial_schema.sql |
| companies | 会社情報 | 0001_initial_schema.sql |
| user_companies | ユーザー-会社紐づけ | 0001_initial_schema.sql |
| audit_log | 監査ログ | 0014_audit_log.sql |
| usage_events | 使用状況イベント | 0018_usage_events.sql |
| subsidy_cache | 補助金キャッシュ | 0006_lifecycle_and_docs.sql |
| source_registry | ソース台帳 | 0024_data_pipeline_foundation.sql |
| crawl_queue | クロールキュー | 0008_crawl_queue.sql |
| domain_policy | ドメインポリシー | 0024_data_pipeline_foundation.sql |
| cron_runs | Cron実行履歴 | 0024_data_pipeline_foundation.sql |
| feed_failures | フィード失敗 | 0104_feed_failures.sql |
| extraction_queue | 抽出キュー | 0107_extraction_queue.sql |
| extraction_logs | 抽出ログ | 0106_extraction_logs.sql |
| kpi_daily_snapshots | 日次KPI | 0021_superadmin_kpi_cost.sql |
| alert_rules / alert_history | アラート | 0021_superadmin_kpi_cost.sql |
| agencies / agency_clients | 士業管理 | 0019_agency_tables.sql |
| access_links | アクセスリンク | 0019_agency_tables.sql |
| intake_submissions | Intake提出 | 0020_agency_intake_extension.sql |

---

## 6. 今後のアクションアイテム

### 高優先度

1. [x] APIパス不一致の修正（完了）
2. [ ] 本番環境へのデプロイ確認
3. [ ] 管理画面の各機能のE2Eテスト

### 中優先度

4. [ ] 認証ガードの一貫性レビュー
5. [ ] エラーハンドリングの標準化
6. [ ] 日付計算ロジックの共通化

### 低優先度

7. [ ] admin.ts と admin-dashboard.ts の責務明確化ドキュメント
8. [ ] クエリパフォーマンス最適化（N+1問題の確認）
9. [ ] TypeScript型定義の強化

---

## 7. 参照ファイル

| ファイル | サイズ | 説明 |
|----------|--------|------|
| src/pages/admin.tsx | 154KB | 管理画面フロントエンド |
| src/routes/admin-dashboard.ts | 154KB | 運用監視API |
| src/routes/admin.ts | 45KB | ユーザー管理API |
| src/routes/cron.ts | 128KB | Cronジョブ |
| src/index.tsx | 8KB | アプリケーションエントリ |
| migrations/0107_extraction_queue.sql | 2KB | 最新マイグレーション |

---

## 8. 結論

**主要な問題（APIパス不一致）は修正済み**です。

管理画面は以下の構成で正常に動作するはずです：
- `/api/admin/*` - ユーザー管理、監査ログ（admin.ts）
- `/api/admin-ops/*` - KPI、コスト、運用監視（admin-dashboard.ts）

本番デプロイ後、実際の動作確認を行ってください。

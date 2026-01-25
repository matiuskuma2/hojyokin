# Superadmin 画面コードレビュー報告書

**日付**: 2026-01-25  
**レビュー対象**: admin.tsx, admin-dashboard.ts, admin.ts  
**レビュー担当**: AI Assistant  
**バージョン**: v2.0

---

## 1. エグゼクティブサマリー

### 発見した問題サマリー

| 優先度 | カテゴリ | 問題 | 状態 | 影響 |
|--------|----------|------|------|------|
| 🔴 Critical | 整合性 | フロントエンド→バックエンドAPIパス不一致 | ✅ 修正済み | 管理画面の全機能が動作しない |
| 🟠 High | 入力検証 | クエリパラメータのサニタイズ不足 | ⚠️ 要修正 | SQLインジェクションリスク（低） |
| 🟠 High | セキュリティ | super_admin チェックの一貫性 | ⚠️ 要確認 | 権限昇格リスク |
| 🟡 Medium | エラー処理 | SQLエラー時の詳細漏洩 | ⚠️ 要改善 | 情報漏洩リスク |
| 🟡 Medium | ロジック | 日付範囲計算の重複 | 📝 改善推奨 | メンテナンス性低下 |
| 🟢 Low | コード品質 | コメント言語の混在（日英） | 📝 改善推奨 | 可読性低下 |

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

## 3. コード品質評価リスト

### 3.1 入力安全性

| ファイル | 箇所 | 問題 | 優先度 | 推奨修正 |
|----------|------|------|--------|----------|
| admin.ts:98-102 | ユーザー検索 | `search` パラメータの直接LIKE使用 | 🟠 High | パラメータ化クエリ確認済み、エスケープ追加推奨 |
| admin.ts:528 | 監査ログ検索 | `days` パラメータの整数変換 | ✅ OK | `parseInt` + `Math.min/max` で制限済み |
| admin-dashboard.ts:1273 | KPI履歴 | `days` パラメータ | ✅ OK | 同様に制限済み |
| admin-dashboard.ts:1321 | 会社診断 | `email` クエリパラメータ | 🟡 Medium | メール形式バリデーション追加推奨 |
| admin-dashboard.ts:2422 | フィード失敗 | `status`/`limit` パラメータ | ✅ OK | ホワイトリスト/制限済み |

**改善推奨コード（admin.ts:98-102）**:
```typescript
// 現在
if (search) {
  whereClause += ' AND (email LIKE ? OR name LIKE ?)';
  params.push(`%${search}%`, `%${search}%`);
}

// 推奨: SQLite特殊文字のエスケープ
const escapeLike = (str: string) => str.replace(/[%_\\]/g, '\\$&');
if (search) {
  whereClause += ' AND (email LIKE ? ESCAPE "\\\\" OR name LIKE ? ESCAPE "\\\\")';
  params.push(`%${escapeLike(search)}%`, `%${escapeLike(search)}%`);
}
```

### 3.2 ロジックの正確性

| ファイル | 箇所 | 問題 | 優先度 | 推奨修正 |
|----------|------|------|--------|----------|
| admin-dashboard.ts:34-37 | 日付計算 | タイムゾーン未考慮 | 🟡 Medium | UTCまたはJST明示 |
| admin-dashboard.ts:297-299 | コスト比率 | ゼロ除算対策 | ✅ OK | `|| 0` でガード済み |
| admin-dashboard.ts:1219-1222 | スコア計算 | `Math.max` で下限0保証 | ✅ OK | 正しく実装 |
| admin.ts:298-307 | ユーザー凍結 | 自己凍結防止 | ✅ OK | チェック済み |
| admin.ts:451-454 | パスワード生成 | 仮パスワード長さ | ✅ OK | 12文字（セキュア） |

**改善推奨コード（日付計算の統一）**:
```typescript
// src/lib/date-utils.ts に共通関数を作成
export const getDateRanges = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';
  return { today, yesterday, weekAgo, monthAgo, monthStart };
};
```

### 3.3 エラーハンドリング

| ファイル | 箇所 | 問題 | 優先度 | 推奨修正 |
|----------|------|------|--------|----------|
| admin-dashboard.ts:172-181 | ダッシュボード | エラー詳細露出 | 🟡 Medium | 本番では汎用メッセージに |
| admin-dashboard.ts:315-324 | コスト | 同上 | 🟡 Medium | 同上 |
| admin.ts:156-164 | ユーザー一覧 | `INTERNAL_ERROR` 返却 | ✅ OK | 汎用メッセージ |
| admin.ts:83-86 | 監査ログ書き込み | 失敗時 console.error のみ | 🟡 Medium | フォールバック or リトライ検討 |

**改善推奨コード（エラーハンドリング標準化）**:
```typescript
// src/lib/error-handler.ts
export const handleApiError = (error: unknown, code: string, c: any) => {
  const isDev = c.env.ENVIRONMENT === 'development';
  console.error(`[${code}]`, error);
  
  return c.json<ApiResponse<null>>({
    success: false,
    error: {
      code,
      message: isDev && error instanceof Error ? error.message : 'An error occurred',
    },
  }, 500);
};
```

### 3.4 セキュリティ

| ファイル | 箇所 | 問題 | 優先度 | 推奨修正 |
|----------|------|------|--------|----------|
| admin-dashboard.ts:21-23 | 全ルート認証 | ✅ 正しく実装 | - | - |
| admin-dashboard.ts:192-201 | コスト権限 | super_admin チェック | ✅ OK | 正しく実装 |
| admin.ts:22-34 | adminチェック | 独自ミドルウェア | 🟡 Medium | requireAdmin 共通化推奨 |
| admin.ts:494-499 | パスワード返却 | temp_password 平文返却 | 🟡 Medium | ログに残さない確認必要 |

**注意点**:
- `admin.ts` と `admin-dashboard.ts` の両方で `requireAdmin` を定義している
- `admin-dashboard.ts` は `middleware/auth.ts` からインポート
- `admin.ts` はローカル定義

### 3.5 設定・インフラ

| 項目 | 状態 | 備考 |
|------|------|------|
| 環境変数 | ✅ OK | `c.env.DB`, `c.env.ENVIRONMENT` 使用 |
| Cron シークレット | ⚠️ 要確認 | `X-Cron-Secret` ヘッダーの管理方法 |
| CORS設定 | ✅ OK | localhost のみ許可（src/index.tsx） |
| レート制限 | ❌ なし | 管理APIにもレート制限推奨 |

---

## 4. 懸念点一覧と修正案（優先度付き）

### 4.1 🟠 高優先度

#### 4.1.1 認証ミドルウェアの重複定義

**問題**: `admin.ts` と `middleware/auth.ts` で `requireAdmin` が別々に定義されている

**ファイル**: 
- `src/routes/admin.ts:22-34` (ローカル定義)
- `src/middleware/auth.ts` (共通定義)

**修正案**:
```typescript
// admin.ts から削除し、共通をインポート
import { requireAuth, requireAdmin, getCurrentUser } from '../middleware/auth';
```

**PR見出し**: `refactor(admin): Use shared requireAdmin middleware`

#### 4.1.2 LIKE検索のワイルドカードエスケープ

**問題**: 検索文字列に `%` や `_` が含まれるとSQL文が破壊される可能性

**ファイル**: `src/routes/admin.ts:107-109`

**修正案**: 上記3.1参照

**PR見出し**: `fix(admin): Escape SQL wildcards in search parameters`

### 4.2 🟡 中優先度

#### 4.2.1 タイムゾーン処理の標準化

**問題**: JST/UTC の明示がなく、日付境界が不安定

**修正案**:
- 全てのDB格納はUTC
- 表示時にJST変換
- `src/lib/date-utils.ts` の作成

**PR見出し**: `feat(utils): Add timezone-aware date utilities`

#### 4.2.2 エラーメッセージの本番/開発切り替え

**問題**: 開発環境フラグの一貫性

**修正案**:
```typescript
// 全エラーハンドラで統一
const isDev = c.env.ENVIRONMENT === 'development' || !c.env.ENVIRONMENT;
```

**PR見出し**: `refactor(error): Standardize error message handling`

### 4.3 🟢 低優先度

#### 4.3.1 コメント言語の統一

**現状**: 日本語と英語のコメントが混在

**推奨**: 
- API仕様コメント → 英語
- 業務ロジック説明 → 日本語 (日本向けサービスのため)

#### 4.3.2 TypeScript厳格化

**推奨**:
- `any` 型の排除
- 戻り値型の明示
- `strict: true` の有効化

---

## 5. TODO コメント追加指示

以下のTODOコメントをコードに追加することを推奨します：

### admin.ts

```typescript
// Line 22-34 付近
// TODO: [SEC-001] requireAdmin を middleware/auth.ts に統一する
// 現在はローカル定義だが、admin-dashboard.ts との一貫性のため共通化推奨

// Line 107 付近
// TODO: [SEC-002] LIKE検索のワイルドカード文字をエスケープする
// 現在は %_\ が検索文字列に含まれると予期しない動作の可能性

// Line 494 付近
// TODO: [SEC-003] 仮パスワードをログに出力しないよう確認
// audit_logには記録されるが、temp_password自体は記録しない
```

### admin-dashboard.ts

```typescript
// Line 34-37 付近
// TODO: [PERF-001] 日付計算を共通ユーティリティ関数に抽出
// getDateRanges() を src/lib/date-utils.ts に作成して再利用

// Line 172-181 付近
// TODO: [ERR-001] 本番環境ではエラー詳細を隠蔽する
// isDev フラグで切り替え、詳細はサーバーログのみに記録

// Line 21-23 付近
// TODO: [DOC-001] エンドポイント別の権限要件をJSDocで文書化
// super_admin専用: /costs, /coverage, /data-freshness, /alerts, ...
```

---

## 6. 依存関係マップ

### 6.1 全体アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        src/index.tsx                            │
│                    (アプリケーションエントリ)                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐     ┌───────────────────┐     ┌───────────────┐
│  /api/admin   │     │  /api/admin-ops   │     │ UI Pages (/)  │
│   admin.ts    │     │admin-dashboard.ts │     │  admin.tsx    │
│  (45KB/1480行) │     │  (154KB/3500行)   │     │ (154KB/3400行) │
└───────────────┘     └───────────────────┘     └───────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────────────────────────────────────────────────────┐
│                     D1 Database (SQLite)                       │
│  ┌─────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │  users  │ │ audit_log   │ │subsidy_cache│ │ crawl_queue  │ │
│  └─────────┘ └─────────────┘ └─────────────┘ └──────────────┘ │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────┐              │
│  │usage_events │ │source_reg. │ │ domain_policy│              │
│  └─────────────┘ └────────────┘ └──────────────┘              │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 admin.ts 依存関係

```
admin.ts
├── 外部パッケージ
│   ├── hono
│   └── uuid (v4)
├── 内部モジュール
│   ├── ../types (Env, Variables, ApiResponse)
│   ├── ../middleware/auth (requireAuth, getCurrentUser)
│   └── ../lib/password (hashPassword)
├── DB テーブル
│   ├── users (CRUD)
│   ├── audit_log (INSERT)
│   ├── user_companies (SELECT)
│   ├── companies (SELECT)
│   ├── subsidy_cache (SELECT/INSERT/UPDATE)
│   ├── subsidy_feed_items (INSERT/UPDATE)
│   └── password_reset_tokens (INSERT)
└── 外部API
    └── JGrants API (https://api.jgrants-portal.go.jp)
```

### 6.3 admin-dashboard.ts 依存関係

```
admin-dashboard.ts
├── 外部パッケージ
│   └── hono
├── 内部モジュール
│   ├── ../types (Env, Variables, ApiResponse)
│   ├── ../middleware/auth (requireAuth, requireAdmin, getCurrentUser)
│   └── ../lib/wall-chat-ready (checkWallChatReadyFromJson) - 動的import
├── DB テーブル (読み取り中心)
│   ├── users, companies, user_companies
│   ├── usage_events
│   ├── chat_sessions, chat_messages
│   ├── application_drafts
│   ├── crawl_queue
│   ├── source_registry
│   ├── domain_policy
│   ├── subsidy_cache
│   ├── subsidy_lifecycle
│   ├── alert_rules, alert_history
│   ├── kpi_daily_snapshots
│   ├── agencies, agency_clients
│   ├── access_links
│   ├── intake_submissions
│   ├── cron_runs
│   ├── feed_failures
│   ├── subsidy_documents (optional)
│   ├── ocr_queue (optional)
│   └── extraction_results (optional)
└── 外部API
    ├── JGrants API (詳細取得)
    └── tokyo-shigoto HTML (スクレイピング)
```

### 6.4 admin.tsx (フロントエンド) 依存関係

```
admin.tsx
├── 外部CDN
│   ├── Tailwind CSS
│   ├── FontAwesome Icons
│   └── Chart.js
├── API呼び出し (全て window.api() 経由)
│   ├── /api/admin/users (admin.ts)
│   ├── /api/admin/audit (admin.ts)
│   ├── /api/admin-ops/dashboard (admin-dashboard.ts)
│   ├── /api/admin-ops/costs (admin-dashboard.ts)
│   ├── /api/admin-ops/coverage (admin-dashboard.ts)
│   ├── /api/admin-ops/updates (admin-dashboard.ts)
│   ├── /api/admin-ops/data-freshness (admin-dashboard.ts)
│   ├── /api/admin-ops/daily-report (admin-dashboard.ts)
│   ├── /api/admin-ops/data-health (admin-dashboard.ts)
│   ├── /api/admin-ops/cron-status (admin-dashboard.ts)
│   └── /api/admin-ops/trigger-sync (admin-dashboard.ts)
├── localStorage
│   ├── token (JWT認証)
│   └── user (ユーザー情報JSON)
└── Service Worker
    └── /sw.js (PWA対応)
```

---

## 7. テストケース提案

### 7.1 単体テスト (admin.ts)

```typescript
// __tests__/routes/admin.test.ts
describe('Admin Routes', () => {
  describe('GET /api/admin/users', () => {
    it('should require authentication', async () => {
      const res = await app.request('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await app.request('/api/admin/users', {
        headers: { Authorization: `Bearer ${userToken}` }, // regular user
      });
      expect(res.status).toBe(403);
    });

    it('should return paginated users for admin', async () => {
      const res = await app.request('/api/admin/users?page=1&limit=10', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.pagination).toBeDefined();
    });

    it('should handle LIKE wildcard characters in search', async () => {
      const res = await app.request('/api/admin/users?search=%admin%', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/users/:id/disable', () => {
    it('should prevent self-disable', async () => {
      const res = await app.request(`/api/admin/users/${adminUserId}/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ reason: 'test' }),
      });
      expect(res.status).toBe(403);
    });
  });
});
```

### 7.2 単体テスト (admin-dashboard.ts)

```typescript
// __tests__/routes/admin-dashboard.test.ts
describe('Admin Dashboard Routes', () => {
  describe('GET /api/admin-ops/dashboard', () => {
    it('should return KPI data for admin', async () => {
      const res = await app.request('/api/admin-ops/dashboard', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.kpi).toBeDefined();
      expect(body.data.queue).toBeDefined();
    });
  });

  describe('GET /api/admin-ops/costs', () => {
    it('should require super_admin', async () => {
      const res = await app.request('/api/admin-ops/costs', {
        headers: { Authorization: `Bearer ${adminToken}` }, // admin, not super_admin
      });
      expect(res.status).toBe(403);
    });

    it('should return costs for super_admin', async () => {
      const res = await app.request('/api/admin-ops/costs', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin-ops/coverage', () => {
    it('should calculate L1/L2/L3 scores', async () => {
      const res = await app.request('/api/admin-ops/coverage', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.score.l1_score).toBeGreaterThanOrEqual(0);
      expect(body.data.score.l2_score).toBeGreaterThanOrEqual(0);
      expect(body.data.score.l3_score).toBeGreaterThanOrEqual(0);
    });
  });
});
```

### 7.3 E2E テスト (admin.tsx)

```typescript
// e2e/admin-dashboard.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super_admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'super@example.com');
    await page.fill('input[name="password"]', 'superpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display KPI cards', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('#kpi-users-total')).not.toHaveText('-');
    await expect(page.locator('#kpi-searches-total')).not.toHaveText('-');
  });

  test('should show costs section for super_admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('#cost-section')).toBeVisible();
  });

  test('should navigate to users page', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('#users-table')).toBeVisible();
    await expect(page.locator('#total-users')).not.toHaveText('-');
  });
});
```

---

## 8. 本番移行チェックリスト

### 8.1 環境変数・秘密鍵

| 変数名 | 用途 | 設定先 | 状態 |
|--------|------|--------|------|
| `JWT_SECRET` | JWT署名 | Cloudflare Secrets | ⚠️ 要確認 |
| `CRON_SECRET` | Cronジョブ認証 | Cloudflare Secrets | ⚠️ 要確認 |
| `JGRANTS_API_KEY` | JGrants API (将来) | Cloudflare Secrets | 現在不要（公開API） |
| `ENVIRONMENT` | 開発/本番切替 | wrangler.toml | ⚠️ 要設定 |

### 8.2 Cron/スケジュールジョブ

| ジョブ | 頻度 | トリガー方式 | 状態 |
|--------|------|--------------|------|
| JGrants同期 | 毎日 | 外部Cron → /api/cron/sync-jgrants | ⚠️ 要設定 |
| tokyo-shigoto | 毎日 | 外部Cron → /api/cron/scrape-tokyo-shigoto | ⚠️ 要設定 |
| KPIスナップショット | 毎日 | 手動 or Cron | 📝 検討中 |

### 8.3 デプロイ前確認

- [ ] `npm run build` 成功
- [ ] `wrangler pages deploy` 成功
- [ ] 本番D1データベースの接続確認
- [ ] マイグレーション適用済み確認
- [ ] super_admin アカウントの作成
- [ ] 管理画面へのアクセス確認
- [ ] Cron シークレットの設定

---

## 9. 参照ファイル

| ファイル | サイズ | 行数 | 説明 |
|----------|--------|------|------|
| src/pages/admin.tsx | 154KB | 3,400+ | 管理画面フロントエンド |
| src/routes/admin-dashboard.ts | 154KB | 3,500+ | 運用監視API |
| src/routes/admin.ts | 45KB | 1,480 | ユーザー管理API |
| src/routes/cron.ts | 128KB | 3,000+ | Cronジョブ |
| src/index.tsx | 8KB | 353 | アプリケーションエントリ |
| src/middleware/auth.ts | - | - | 認証ミドルウェア |
| migrations/0107_extraction_queue.sql | 2KB | - | 最新マイグレーション |

---

## 10. 結論

### 修正済み

- **APIパス不一致**（Critical）: ✅ 修正完了、デプロイ済み

### 要対応（高優先度）

1. **requireAdmin の統一**: admin.ts のローカル定義を削除し、共通ミドルウェアを使用
2. **LIKE検索のエスケープ**: 特殊文字によるSQL破壊防止

### 改善推奨（中優先度）

3. **日付計算の共通化**: `src/lib/date-utils.ts` の作成
4. **エラーハンドリング標準化**: 本番/開発の切り替え統一

### 将来課題（低優先度）

5. **TypeScript厳格化**: `any` 型の排除
6. **コメント言語統一**: 仕様は英語、業務説明は日本語
7. **レート制限追加**: 管理APIへの過剰リクエスト防止

---

**次のアクション**:
1. 本番デプロイ後の動作確認（super_admin でログインして全タブ確認）
2. 高優先度の修正PR作成
3. Cron設定の完了

---

*レポート生成日時: 2026-01-25*

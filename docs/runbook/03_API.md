# API リファレンス

## 認証要件

| 種別 | 説明 | ヘッダー |
|------|------|----------|
| Public | 認証不要 | - |
| Auth | ユーザー認証必須 | `Authorization: Bearer <JWT>` |
| Admin | 管理者権限必須 | `Authorization: Bearer <JWT>` (is_admin=true) |
| Internal | 内部通信用 | `X-Internal-Token: <INTERNAL_JWT>` |

---

## 認証 API (`/api/auth`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/auth/register` | POST | Public | ユーザー登録 |
| `/api/auth/login` | POST | Public | ログイン |
| `/api/auth/refresh` | POST | Public | トークンリフレッシュ |
| `/api/auth/me` | GET | Auth | 現在のユーザー情報 |
| `/api/auth/forgot-password` | POST | Public | パスワードリセット申請 |
| `/api/auth/reset-password` | POST | Public | パスワードリセット実行 |

### リクエスト例

```bash
# 登録
curl -X POST https://hojyokin.pages.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Test1234!","name":"テスト"}'

# ログイン
curl -X POST https://hojyokin.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Test1234!"}'
```

---

## 会社 API (`/api/companies`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/companies` | GET | Auth | 会社一覧 |
| `/api/companies` | POST | Auth | 会社作成 |
| `/api/companies/:id` | GET | Auth | 会社詳細 |
| `/api/companies/:id` | PUT | Auth | 会社更新 |
| `/api/companies/:id` | DELETE | Auth | 会社削除 |

---

## プロフィール API (`/api/profile`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/profile` | GET | Auth | プロフィール統合取得 |
| `/api/profile` | PUT | Auth | プロフィール更新 |
| `/api/profile/completeness` | GET | Auth | 完成度取得 |
| `/api/profile/documents` | GET | Auth | 書類一覧 |
| `/api/profile/documents` | POST | Auth | 書類アップロード |
| `/api/profile/documents/:id` | DELETE | Auth | 書類削除 |

---

## 補助金 API (`/api/subsidies`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/subsidies` | GET | Auth | 補助金検索 |
| `/api/subsidies/:id` | GET | Auth | 補助金詳細 |

### クエリパラメータ

| パラメータ | 説明 |
|-----------|------|
| `company_id` | 会社ID（フィルタ用） |
| `keyword` | キーワード検索 |
| `acceptance` | 受付状況（accepting/scheduled/closed） |
| `prefecture` | 都道府県 |

---

## S3: チャット API (`/api/chat`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/chat/precheck` | POST | Auth | 事前判定 |
| `/api/chat/sessions` | POST | Auth | セッション作成 |
| `/api/chat/sessions` | GET | Auth | セッション一覧 |
| `/api/chat/sessions/:id` | GET | Auth | セッション詳細 |
| `/api/chat/sessions/:id/message` | POST | Auth | メッセージ送信 |

### Precheck レスポンス

```json
{
  "status": "OK_WITH_MISSING",  // NG | OK | OK_WITH_MISSING
  "eligible": true,
  "blocked_reasons": [],
  "missing_items": [
    {
      "key": "past_subsidy_same_type",
      "label": "同種の補助金を過去に受給しましたか？",
      "input_type": "yes_no",
      "source": "precheck",
      "priority": 1
    }
  ],
  "subsidy_info": { ... },
  "company_info": { ... }
}
```

---

## S4: ドラフト API (`/api/draft`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/draft/generate` | POST | Auth | ドラフト生成 |
| `/api/draft/:id` | GET | Auth | ドラフト取得 |
| `/api/draft/:id` | PUT | Auth | ドラフト更新 |
| `/api/draft/:id/check-ng` | POST | Auth | NGチェック再実行 |
| `/api/draft/:id/finalize` | POST | Auth | ドラフト確定 |

### ドラフト生成リクエスト

```json
{
  "session_id": "xxx-xxx-xxx",
  "mode": "template"  // template | llm
}
```

### ドラフト構造

```json
{
  "sections": {
    "background": "背景・課題...",
    "purpose": "事業目的...",
    "plan": "実施内容・方法...",
    "team": "実施体制...",
    "budget_overview": "資金計画..."
  },
  "ng_result": {
    "score": 100,
    "hits": []
  }
}
```

---

## ナレッジ API (`/api/knowledge`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/knowledge/crawl/:urlId` | POST | Auth | URL単体クロール |
| `/api/knowledge/extract/:urlId` | POST | Auth | Extract抽出 |
| `/api/knowledge/registry` | GET | Auth | source_registry一覧 |
| `/api/knowledge/stats` | GET | Auth | ナレッジ統計 |

---

## Consumer API (`/api/consumer`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/consumer/run` | POST | Auth | キュージョブ処理 |
| `/api/consumer/status` | GET | Auth | キュー状態 |
| `/api/consumer/requeue/:id` | POST | Auth | 再キュー |
| `/api/consumer/cleanup` | DELETE | Auth | 古いジョブ削除 |

---

## KPI API (`/api/kpi`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/kpi/summary` | GET | Auth | KPIサマリ |
| `/api/kpi/crawl` | GET | Auth | クロール統計 |
| `/api/kpi/pipeline` | GET | Auth | パイプライン統計 |

---

## 管理者 API (`/api/admin`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/admin/users` | GET | Admin | ユーザー一覧 |
| `/api/admin/users/:id` | PUT | Admin | ユーザー更新 |
| `/api/admin/audit` | GET | Admin | 監査ログ |
| `/api/admin/domain-policy` | GET | Admin | ドメインポリシー一覧 |
| `/api/admin/domain-policy/:domain` | PUT | Admin | ポリシー更新 |

---

## 内部 API (`/api/internal`)

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/internal/crawl-complete` | POST | Internal | クロール完了通知 |
| `/api/internal/extract-complete` | POST | Internal | 抽出完了通知 |

---

## エラーレスポンス形式

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { ... }
  }
}
```

### エラーコード一覧

| コード | HTTP Status | 説明 |
|--------|-------------|------|
| `VALIDATION_ERROR` | 400 | 入力値不正 |
| `UNAUTHORIZED` | 401 | 認証必要 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソース不存在 |
| `CONFLICT` | 409 | 重複エラー |
| `INTERNAL_ERROR` | 500 | サーバーエラー |

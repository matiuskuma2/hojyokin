# 補助金・助成金 自動マッチング＆申請書作成支援システム

## プロジェクト概要

- **Name**: subsidy-matching
- **Version**: 1.0.0 (Phase 1-A)
- **Goal**: 企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング

### 設計思想

> **「補助金を"通す"ツール」ではなく「補助金で人生を壊させないツール」**

- 採択より完走
- 金額より安全
- 自動化より判断補助

## URLs

- **Sandbox (開発)**: https://3000-i8mpy9er0x59p3mbr6pt0-cc2fbc16.sandbox.novita.ai
- **本番**: デプロイ後に設定

## 実装済み機能 (Phase 1-A)

### 認証 (Auth)
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン (JWT発行)
- `POST /api/auth/password-reset/request` - パスワードリセット要求
- `POST /api/auth/password-reset/confirm` - パスワードリセット確認
- `GET /api/auth/me` - 現在のユーザー情報取得

### 企業管理 (Companies)
- `GET /api/companies` - 企業一覧取得
- `POST /api/companies` - 企業作成
- `GET /api/companies/:id` - 企業詳細取得
- `PUT /api/companies/:id` - 企業更新
- `DELETE /api/companies/:id` - 企業削除

### 補助金 (Subsidies)
- `GET /api/subsidies/search` - 補助金検索 (Jグランツ + スクリーニング)
- `GET /api/subsidies/:id` - 補助金詳細取得
- `GET /api/subsidies/evaluations/:company_id` - 評価結果一覧

## 技術スタック

### Cloudflare (Phase 1-A)
- **Runtime**: Cloudflare Workers / Pages
- **Framework**: Hono 4.x
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: JWT (HS256) + PBKDF2 (SHA-256)

### 外部API
- **Jグランツ公開API**: 補助金データ取得

### 将来拡張 (Phase 2)
- **AWS Lambda / SQS**: PDF変換・要件抽出・壁打ち・ドラフト生成
- **LLM**: ChatGPT / Gemini (要件抽出、壁打ち)
- **SendGrid**: メール送信

## データモデル

### 主要テーブル
- `users` - ユーザー
- `companies` - 企業
- `company_memberships` - 企業所属
- `subsidy_cache` - 補助金キャッシュ
- `evaluation_runs` - 評価結果
- `search_cache` - 検索キャッシュ
- `api_usage` - API使用量

## 開発環境セットアップ

```bash
# 依存関係インストール
npm install

# D1マイグレーション (ローカル)
npm run db:migrate:local

# 開発サーバー起動
npm run build && pm2 start ecosystem.config.cjs

# API テスト
curl http://localhost:3000/api/health
```

## 環境変数

### 必須 (.dev.vars)
```
JWT_SECRET=your-secret-key-32-chars-minimum
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users
```

### オプション
```
SENDGRID_API_KEY=SG.xxx
JGRANTS_API_BASE_URL=https://api.jgrants-portal.go.jp
ENVIRONMENT=development
```

## スクリプト

```bash
npm run dev           # Vite開発サーバー
npm run build         # ビルド
npm run dev:sandbox   # Sandbox開発（PM2用）
npm run deploy        # Cloudflare Pagesデプロイ

npm run db:migrate:local  # ローカルD1マイグレーション
npm run db:migrate:prod   # 本番D1マイグレーション
npm run db:reset          # ローカルD1リセット
```

## API使用例

### ユーザー登録
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Test1234","name":"テスト"}'
```

### 企業作成
```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "株式会社テスト",
    "prefecture": "13",
    "industry_major": "I",
    "employee_count": 25
  }'
```

### 補助金検索
```bash
curl "http://localhost:3000/api/subsidies/search?company_id=<uuid>&acceptance=1" \
  -H "Authorization: Bearer <token>"
```

## 判定ステータス

| ステータス | 表示名 | 意味 |
|-----------|--------|------|
| `PROCEED` | 推奨 | 要件を概ね満たし、リスクも低い |
| `CAUTION` | 注意 | 使える可能性はあるが、確認事項・リスクあり |
| `DO_NOT_PROCEED` | 非推奨 | 要件未達または高リスク |

## リスクタイプ

| タイプ | 説明 |
|--------|------|
| `FINANCING` | 資金スキームリスク |
| `ORGANIZATION` | 組織・人事リスク |
| `EXPENSE` | 経費・交付申請リスク |
| `BUSINESS_MODEL` | 事業内容リスク |
| `COMPLIANCE` | コンプラ・事故リスク |

## ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [docs/requirements-v0.9.md](docs/requirements-v0.9.md) | 要件定義書 |
| [docs/screen-wireframes.md](docs/screen-wireframes.md) | 画面ワイヤー詳細 |
| [docs/data-dictionary.md](docs/data-dictionary.md) | データ辞書 |
| [docs/prompts-and-schemas.md](docs/prompts-and-schemas.md) | LLMプロンプト＆スキーマ |
| [docs/job-specifications.md](docs/job-specifications.md) | ジョブ詳細仕様 |

## 次のステップ (Phase 1-B / Phase 2)

### Phase 1-B
- [ ] Jグランツ API エラーハンドリング強化
- [ ] KV キャッシュ導入
- [ ] レート制限実装
- [ ] メール送信 (SendGrid)

### Phase 2 (AWS)
- [ ] PDF変換 (Lambda)
- [ ] 要件抽出 (LLM)
- [ ] 壁打ちBot実装
- [ ] ドラフト生成
- [ ] 自治体サイトスクレイピング

## ライセンス

Private

## 作成日

2026-01-21

# 補助金・助成金 自動マッチング＆申請書作成支援システム

## プロジェクト概要

- **Name**: subsidy-matching
- **Version**: 1.1.0 (Phase 1-A + Phase 2 設計完了)
- **Goal**: 企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング

### 設計思想

> **「補助金を"通す"ツール」ではなく「補助金で人生を壊させないツール」**

- 採択より完走
- 金額より安全
- 自動化より判断補助

## URLs

- **Sandbox (開発)**: https://3000-i8mpy9er0x59p3mbr6pt0-cc2fbc16.sandbox.novita.ai
- **本番**: デプロイ後に設定
- **AWS API**: デプロイ後に設定

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare (Phase 1-A)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Workers/Pages                                             │  │
│  │ - 認証 (JWT + PBKDF2)                                     │  │
│  │ - 企業CRUD                                                │  │
│  │ - 補助金検索 (Adapter: live/mock/cached-only)             │  │
│  │ - 一次スクリーニング (PROCEED/CAUTION/DO_NOT_PROCEED)     │  │
│  │ - D1キャッシュ                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ JWT Bearer Token                 │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS (Phase 2)                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐        │
│  │ API Gateway │───▶│ Lambda       │───▶│ SQS         │        │
│  │ (HTTP API)  │    │ (job-submit) │    │ (jobs)      │        │
│  └─────────────┘    └──────────────┘    └──────┬──────┘        │
│                              │                  │               │
│                              ▼                  ▼               │
│                     ┌──────────────┐    ┌──────────────┐        │
│                     │ S3           │◀───│ Lambda       │───▶ LLM│
│                     │ (attachments)│    │ (worker)     │        │
│                     └──────────────┘    └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 実装済み機能 (Phase 1-A) ✅

### 認証 (Auth)
| Endpoint | Method | 説明 |
|----------|--------|------|
| `/api/auth/register` | POST | ユーザー登録 |
| `/api/auth/login` | POST | ログイン (JWT発行) |
| `/api/auth/password-reset/request` | POST | パスワードリセット要求 |
| `/api/auth/password-reset/confirm` | POST | パスワードリセット確認 |
| `/api/auth/me` | GET | 現在のユーザー情報取得 |

### 企業管理 (Companies)
| Endpoint | Method | 説明 |
|----------|--------|------|
| `/api/companies` | GET | 企業一覧取得 |
| `/api/companies` | POST | 企業作成 |
| `/api/companies/:id` | GET | 企業詳細取得 |
| `/api/companies/:id` | PUT | 企業更新 |
| `/api/companies/:id` | DELETE | 企業削除 |

### 補助金 (Subsidies)
| Endpoint | Method | 説明 |
|----------|--------|------|
| `/api/subsidies/search` | GET | 補助金検索 (Adapter経由 + スクリーニング) |
| `/api/subsidies/:id` | GET | 補助金詳細取得 |
| `/api/subsidies/evaluations/:company_id` | GET | 評価結果一覧 |

### JGrants Adapter (3モード対応)
- **live**: Jグランツ実API呼び出し（本番用）
- **mock**: モックデータ返却（開発用、10件のリアルなデータ）
- **cached-only**: D1キャッシュのみ（オフライン用）

---

## Phase 2 AWS構成 (設計完了) 📋

### ディレクトリ構造

```
aws/
├── terraform/
│   ├── main.tf                 # Terraform設定一式
│   └── terraform.tfvars.example
└── lambda/
    ├── job-submit/             # HTTPトリガーLambda
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/index.ts
    └── worker/                 # SQSトリガーLambda
        ├── package.json
        ├── tsconfig.json
        └── src/index.ts
```

### AWSリソース

| リソース | 説明 |
|----------|------|
| S3 | 添付ファイル・変換結果保存 |
| SQS | ジョブキュー (DLQ付き) |
| API Gateway | HTTP API (Cloudflare入口) |
| Lambda (job-submit) | ジョブ投入 (30秒タイムアウト) |
| Lambda (worker) | 変換・抽出処理 (10分タイムアウト) |
| CloudWatch | ログ・メトリクス |

### AWS API Endpoints

| Endpoint | Method | 説明 |
|----------|--------|------|
| `/jobs/ingest` | POST | 添付取得→S3保存→ジョブ投入 |
| `/jobs/{job_id}/status` | GET | ジョブステータス取得 |
| `/health` | GET | ヘルスチェック |

### ジョブタイプ

| JobType | 説明 |
|---------|------|
| `ATTACHMENT_CONVERT` | PDF/Word → テキスト変換 |
| `ELIGIBILITY_EXTRACT` | LLMで要件JSON抽出 |
| `DRAFT_GENERATE` | 申請書ドラフト生成 (Phase 2後半) |

---

## 技術スタック

### Cloudflare (Phase 1)
- **Runtime**: Cloudflare Workers / Pages
- **Framework**: Hono 4.x
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: JWT (HS256) + PBKDF2 (SHA-256)

### AWS (Phase 2)
- **Compute**: Lambda (Node.js 20)
- **Queue**: SQS (DLQ付き)
- **Storage**: S3
- **API**: API Gateway (HTTP API)
- **IaC**: Terraform

### 外部API
- **Jグランツ公開API**: 補助金データ取得
- **OpenAI API**: 要件抽出 (gpt-4o-mini)
- **Cloudflare D1 REST API**: AWS→D1書き込み

---

## データモデル

### 主要テーブル (D1)

| テーブル | 説明 |
|----------|------|
| `users` | ユーザー |
| `companies` | 企業 |
| `company_memberships` | 企業所属 |
| `subsidy_cache` | 補助金キャッシュ |
| `evaluation_runs` | 評価結果 |
| `search_cache` | 検索キャッシュ |
| `eligibility_rules` | 要件ルール (Phase 2) |
| `api_usage` | API使用量 |

### EligibilityRule (Phase 2)

```typescript
interface EligibilityRule {
  id: string;
  subsidy_id: string;
  category: "対象者" | "地域" | "業種" | "規模" | "財務" | "事業内容" | "その他";
  rule_text: string;
  check_type: "AUTO" | "MANUAL" | "LLM";
  parameters?: { min?: number; max?: number; allowed_values?: string[] };
  source_text?: string;
  page_number?: number;
}
```

---

## 開発環境セットアップ

### Cloudflare (Phase 1)

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

### AWS (Phase 2)

```bash
# Terraform初期化
cd aws/terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集
terraform init
terraform plan
terraform apply

# Lambdaコードデプロイ
cd ../lambda/job-submit
npm install && npm run package
aws lambda update-function-code \
  --function-name subsidy-app-dev-job-submit \
  --zip-file fileb://dist/function.zip

cd ../worker
npm install && npm run package
aws lambda update-function-code \
  --function-name subsidy-app-dev-worker \
  --zip-file fileb://dist/function.zip
```

---

## 環境変数

### Cloudflare (.dev.vars)
```
JWT_SECRET=your-secret-key-32-chars-minimum
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users
JGRANTS_MODE=mock
AWS_API_ENDPOINT=https://xxx.execute-api.ap-northeast-1.amazonaws.com
```

### AWS (terraform.tfvars)
```hcl
jwt_secret = "same-as-cloudflare"
openai_api_key = "sk-xxx"
cloudflare_d1_api_token = "xxx"
cloudflare_account_id = "xxx"
cloudflare_d1_database_id = "xxx"
```

---

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

---

## ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [docs/requirements-v0.9.md](docs/requirements-v0.9.md) | 要件定義書 |
| [docs/screen-wireframes.md](docs/screen-wireframes.md) | 画面ワイヤー詳細 |
| [docs/data-dictionary.md](docs/data-dictionary.md) | データ辞書 |
| [docs/prompts-and-schemas.md](docs/prompts-and-schemas.md) | LLMプロンプト＆スキーマ |
| [docs/job-specifications.md](docs/job-specifications.md) | ジョブ詳細仕様 |
| [docs/phase2-aws-integration.md](docs/phase2-aws-integration.md) | **Phase 2 AWS統合仕様** |

---

## 進捗状況

### ✅ Phase 1-A (Cloudflare) - 完了
- [x] 認証 (JWT + PBKDF2)
- [x] 企業CRUD
- [x] JGrants Adapter (live/mock/cached-only)
- [x] 一次スクリーニング
- [x] D1キャッシュ
- [x] モックデータ (10件)

### 📋 Phase 2 AWS - 設計完了
- [x] Terraform一式 (S3/SQS/API Gateway/Lambda)
- [x] Lambda job-submit コード
- [x] Lambda worker コード
- [x] Cloudflare→AWS接続仕様
- [x] ジョブメッセージJSON仕様
- [ ] Terraformデプロイ
- [ ] Lambdaデプロイ

### ⏳ Phase 1-B (Cloudflare) - 未着手
- [ ] KVキャッシュ
- [ ] レート制限
- [ ] メール送信 (SendGrid)
- [ ] UI実装

### ⏳ Phase 2後半 - 未着手
- [ ] 壁打ちBot実装
- [ ] ドラフト生成
- [ ] 自治体サイトスクレイピング

---

## ライセンス

Private

## 作成日

2026-01-21

## 更新履歴

- **2026-01-21**: Phase 1-A 完了、Phase 2 AWS設計完了

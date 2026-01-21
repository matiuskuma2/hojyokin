# Phase 2: AWS Integration Specification

## 概要

Phase 2では、Cloudflare Workers（軽量処理）とAWS（重処理）を連携させ、以下の機能を実現します：

1. **添付ファイル取得・保存** - JグランツAPIから添付を取得しS3へ
2. **PDF/Word変換** - テキスト抽出
3. **要件抽出（LLM）** - 公募要領から申請要件をJSON化
4. **申請書ドラフト生成** - 壁打ちBotと連携（Phase 2後半）

---

## アーキテクチャ（方式A: 内部API経由）

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare                              │
├─────────────────────────────────────────────────────────────────┤
│  Workers/Pages                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/jobs/ingest                                         │   │
│  │   → AWS API Gateway にプロキシ（内部JWT認証）              │   │
│  │                                                          │   │
│  │ /api/subsidies/:id/eligibility                           │   │
│  │   → D1 の eligibility_rules から返却                      │   │
│  │                                                          │   │
│  │ /internal/eligibility/upsert  ← AWS workerから呼び出し    │   │
│  │   → D1に要件ルールを書き込み（内部JWT認証）                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑↓                                 │
│                     Internal JWT (INTERNAL_JWT_SECRET)          │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                            AWS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐        │
│  │ API Gateway │───▶│ Lambda       │───▶│ SQS         │        │
│  │ (HTTP API)  │    │ (job-submit) │    │ (jobs)      │        │
│  └─────────────┘    └──────────────┘    └──────┬──────┘        │
│                              │                  │               │
│                              ▼                  ▼               │
│                     ┌──────────────┐    ┌──────────────┐        │
│                     │ S3           │◀───│ Lambda       │───────┼──┐
│                     │ (attachments)│    │ (worker)     │       │  │
│                     └──────────────┘    └──────────────┘       │  │
│                                                │               │  │
│                                                │ LLM API       │  │
│                                                ▼               │  │
│                                        ┌──────────────┐        │  │
│                                        │ OpenAI/      │        │  │
│                                        │ Anthropic    │        │  │
│                                        └──────────────┘        │  │
└────────────────────────────────────────────────────────────────┘  │
                                                                    │
                    ┌───────────────────────────────────────────────┘
                    │ POST /internal/eligibility/upsert
                    │ (Internal JWT認証)
                    ▼
            ┌──────────────┐
            │ Cloudflare   │
            │ D1 Database  │
            └──────────────┘
```

---

## 方式A: Cloudflare内部API経由でD1書き込み

### なぜ方式Aを採用するか

1. **CloudflareがDBの唯一の書き込み口** - 整理しやすく、権限管理が明確
2. **D1 REST API不要** - Cloudflare API Tokenの管理が不要
3. **認証の一元化** - 内部JWTで統一（INTERNAL_JWT_SECRET）
4. **監査ログ** - Cloudflare側でログが取れる

### 内部JWT仕様

```typescript
// 発行側（Cloudflare/AWS両方）
const payload = {
  sub: 'cloudflare-api' | 'aws-worker',  // サービス識別子
  action: 'job:submit' | 'eligibility:upsert' | 'job:status',
  job_id?: string,
  subsidy_id?: string,
  company_id?: string,
  iss: 'subsidy-app-internal',
  aud: 'subsidy-app-internal',
  iat: number,
  exp: number  // 5分後
};

// 共有シークレット（CloudflareとAWSで同じ値）
INTERNAL_JWT_SECRET=your-internal-secret-32-chars-minimum
```

---

## API仕様

### 1. Cloudflare → AWS: ジョブ投入

**Endpoint**: `POST /api/jobs/ingest`

**Headers**:
```http
Authorization: Bearer {user_jwt}
Content-Type: application/json
```

**Request Body**:
```json
{
  "subsidy_id": "string (required)",
  "company_id": "string (optional)",
  "attachments": [
    {
      "id": "attachment_id",
      "filename": "公募要領.pdf",
      "content_type": "application/pdf",
      "base64_content": "base64_encoded_data",
      "url": "https://example.com/file.pdf"
    }
  ]
}
```

**内部処理**:
1. ユーザー認証（アプリJWT）
2. 内部JWT発行（INTERNAL_JWT_SECRET）
3. AWS API Gatewayにプロキシ

**Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "PENDING",
    "subsidy_id": "string",
    "attachments_saved": 2,
    "message": "Job submitted successfully"
  }
}
```

### 2. AWS → Cloudflare: 要件ルール書き込み

**Endpoint**: `POST /internal/eligibility/upsert`

**Headers**:
```http
Authorization: Bearer {internal_jwt}
Content-Type: application/json
```

**Request Body**:
```json
{
  "subsidy_id": "JGRANTS-12345",
  "rules": [
    {
      "id": "uuid (optional)",
      "category": "対象者",
      "rule_text": "従業員数が300人以下の中小企業であること",
      "check_type": "AUTO",
      "parameters": { "max": 300 },
      "source_text": "中小企業基本法に定める中小企業者",
      "page_number": 5
    }
  ],
  "warnings": ["注意事項があれば"],
  "summary": "要件の要約",
  "job_id": "uuid"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "subsidy_id": "JGRANTS-12345",
    "rules_count": 10,
    "warnings": [],
    "summary": "...",
    "updated_at": "2026-01-21T05:00:00Z"
  }
}
```

### 3. ジョブステータス確認

**Endpoint**: `GET /api/jobs/{job_id}/status`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "PROCESSING",
    "progress": 50,
    "result": {
      "converted_attachments": 2
    },
    "updated_at": "2026-01-21T03:00:00Z"
  }
}
```

### 4. 内部APIヘルスチェック

**Endpoint**: `GET /internal/health`

**Note**: 認証不要

---

## 環境変数

### Cloudflare側 (.dev.vars / wrangler secret)

```bash
# アプリ用JWT（ユーザー認証）
JWT_SECRET=app-jwt-secret-32-chars
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users

# 内部API用JWT（AWS↔Cloudflare認証）
INTERNAL_JWT_SECRET=internal-secret-32-chars  # AWSと同じ値
INTERNAL_JWT_ISSUER=subsidy-app-internal
INTERNAL_JWT_AUDIENCE=subsidy-app-internal

# AWS連携
AWS_JOB_API_BASE_URL=https://xxx.execute-api.ap-northeast-1.amazonaws.com

# このアプリの公開URL（AWS→Cloudflare用）
CLOUDFLARE_API_BASE_URL=https://subsidy-matching.pages.dev
```

### AWS側 (terraform.tfvars)

```hcl
# 内部JWT（Cloudflareと同じ値）
internal_jwt_secret = "internal-secret-32-chars"

# Cloudflare連携
cloudflare_api_base_url = "https://subsidy-matching.pages.dev"

# LLM
openai_api_key = "sk-xxx"
anthropic_api_key = ""  # オプション
```

---

## デプロイ手順

### 1. Terraform初期化・実行

```bash
cd aws/terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集

terraform init
terraform plan
terraform apply
```

### 2. Lambdaコードデプロイ

```bash
# job-submit
cd aws/lambda/job-submit
npm install
npm run package
aws lambda update-function-code \
  --function-name subsidy-app-dev-job-submit \
  --zip-file fileb://dist/function.zip

# worker
cd ../worker
npm install
npm run package
aws lambda update-function-code \
  --function-name subsidy-app-dev-worker \
  --zip-file fileb://dist/function.zip
```

### 3. Cloudflare環境変数設定

```bash
# 本番用シークレット設定
wrangler secret put INTERNAL_JWT_SECRET
wrangler secret put AWS_JOB_API_BASE_URL
wrangler secret put CLOUDFLARE_API_BASE_URL
```

### 4. Cloudflareデプロイ

```bash
npm run build
npx wrangler pages deploy dist --project-name subsidy-matching
```

---

## 処理フロー

```
1. ユーザーが「要件を読み込む」を押す
   ↓
2. Cloudflare POST /api/jobs/ingest
   - ユーザー認証（アプリJWT）
   - 内部JWT発行
   ↓
3. AWS API Gateway POST /jobs/ingest
   - 内部JWT検証
   - S3に添付保存
   - SQSにATTACHMENT_CONVERTジョブ投入
   ↓
4. Lambda(worker) SQSトリガー
   - PDF/Word → テキスト変換
   - S3に保存
   - SQSにELIGIBILITY_EXTRACTジョブ投入
   ↓
5. Lambda(worker) SQSトリガー
   - LLM(gpt-4o-mini)で要件JSON抽出
   - 内部JWT発行
   ↓
6. Cloudflare POST /internal/eligibility/upsert
   - 内部JWT検証
   - D1にeligibility_rules書き込み
   ↓
7. ユーザーがGET /api/subsidies/:id/eligibility
   - D1から要件ルール返却
```

---

## Cloudflare側のルート一覧

### 外部API（ユーザー向け）

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/api/jobs/ingest` | POST | アプリJWT | ジョブ投入（AWSにプロキシ） |
| `/api/jobs/:job_id/status` | GET | アプリJWT | ジョブステータス確認 |
| `/api/jobs/subsidies/:subsidy_id/ingest` | POST | アプリJWT | 補助金ID指定でジョブ投入 |

### 内部API（AWS向け）

| Endpoint | Method | 認証 | 説明 |
|----------|--------|------|------|
| `/internal/eligibility/upsert` | POST | 内部JWT | 要件ルール書き込み |
| `/internal/eligibility/:subsidy_id` | GET | 内部JWT | 要件ルール取得（デバッグ用） |
| `/internal/job/status` | POST | 内部JWT | ジョブステータス通知 |
| `/internal/health` | GET | なし | ヘルスチェック |

---

## 次のステップ

1. **Phase 2-A**（現在）: 添付取得→要件抽出の基盤完成
2. **Phase 2-B**: 壁打ちBot実装（会話ベースでの追加情報収集）
3. **Phase 2-C**: 申請書ドラフト生成（セクション別生成、NGフィルター）
4. **Phase 1-B**（並行）: KVキャッシュ、レート制限、UI実装

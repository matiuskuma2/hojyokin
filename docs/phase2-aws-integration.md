# Phase 2: AWS Integration Specification

## 概要

Phase 2では、Cloudflare Workers（軽量処理）とAWS（重処理）を連携させ、以下の機能を実現します：

1. **添付ファイル取得・保存** - JグランツAPIから添付を取得しS3へ
2. **PDF/Word変換** - テキスト抽出
3. **要件抽出（LLM）** - 公募要領から申請要件をJSON化
4. **申請書ドラフト生成** - 壁打ちBotと連携（Phase 2後半）

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare                              │
├─────────────────────────────────────────────────────────────────┤
│  Workers/Pages                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/subsidies/:id/attachments/ingest                    │   │
│  │   → AWS API Gateway にプロキシ                            │   │
│  │                                                          │   │
│  │ /api/subsidies/:id/eligibility                           │   │
│  │   → D1 の eligibility_rules から返却                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ JWT Bearer Token                 │
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
│                     │ S3           │◀───│ Lambda       │        │
│                     │ (attachments)│    │ (worker)     │        │
│                     └──────────────┘    └──────────────┘        │
│                                                │                │
│                                                │ LLM API        │
│                                                ▼                │
│                                        ┌──────────────┐         │
│                                        │ OpenAI/      │         │
│                                        │ Anthropic    │         │
│                                        └──────────────┘         │
│                                                │                │
│                                                │ D1 REST API    │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 ▼
                                        ┌──────────────┐
                                        │ Cloudflare   │
                                        │ D1 Database  │
                                        └──────────────┘
```

---

## API仕様

### 1. Cloudflare → AWS: ジョブ投入

**Endpoint**: `POST {AWS_API_ENDPOINT}/jobs/ingest`

**Headers**:
```http
Authorization: Bearer {jwt_token}
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

### 2. ジョブステータス確認

**Endpoint**: `GET {AWS_API_ENDPOINT}/jobs/{job_id}/status`

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

**Status Values**:
- `PENDING`: キューに投入済み、未処理
- `PROCESSING`: 処理中
- `COMPLETED`: 完了
- `FAILED`: 失敗

### 3. ヘルスチェック

**Endpoint**: `GET {AWS_API_ENDPOINT}/health`

**Response (200 OK)**:
```json
{
  "success": true,
  "status": "ok",
  "service": "job-submit",
  "timestamp": "2026-01-21T03:00:00Z"
}
```

---

## ジョブメッセージ仕様（SQS）

### 共通フォーマット

```typescript
interface JobMessage {
  job_id: string;          // UUID
  job_type: JobType;       // ジョブ種別
  subsidy_id: string;      // 対象補助金ID
  company_id?: string;     // 関連企業ID（任意）
  payload: object;         // ジョブ固有のデータ
  created_at: string;      // ISO8601
  retry_count: number;     // リトライ回数
}

type JobType = 
  | 'ATTACHMENT_SAVE'      // Phase 1: 添付保存
  | 'ATTACHMENT_CONVERT'   // Phase 2: PDF/Word変換
  | 'ELIGIBILITY_EXTRACT'  // Phase 2: 要件抽出
  | 'DRAFT_GENERATE';      // Phase 2後半: ドラフト生成
```

### ATTACHMENT_CONVERT

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "ATTACHMENT_CONVERT",
  "subsidy_id": "JGRANTS-12345",
  "company_id": "company-uuid",
  "payload": {
    "attachments": [
      {
        "id": "att-001",
        "s3_key": "attachments/JGRANTS-12345/att-001/公募要領.pdf"
      }
    ],
    "user_id": "user-uuid"
  },
  "created_at": "2026-01-21T03:00:00Z",
  "retry_count": 0
}
```

### ELIGIBILITY_EXTRACT

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "ELIGIBILITY_EXTRACT",
  "subsidy_id": "JGRANTS-12345",
  "company_id": "company-uuid",
  "payload": {
    "converted_attachments": [
      {
        "id": "att-001",
        "s3_key": "attachments/JGRANTS-12345/att-001/公募要領.txt",
        "text_content": "...",
        "page_count": 15
      }
    ],
    "user_id": "user-uuid"
  },
  "created_at": "2026-01-21T03:00:00Z",
  "retry_count": 0
}
```

### DRAFT_GENERATE

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_type": "DRAFT_GENERATE",
  "subsidy_id": "JGRANTS-12345",
  "company_id": "company-uuid",
  "payload": {
    "eligibility_rules_key": "eligibility/JGRANTS-12345/rules.json",
    "conversation_id": "conv-uuid",
    "sections": ["事業概要", "実施体制", "経費内訳"],
    "user_id": "user-uuid"
  },
  "created_at": "2026-01-21T03:00:00Z",
  "retry_count": 0
}
```

---

## 認証方式

### JWT認証（Cloudflare → AWS）

CloudflareとAWSで同じJWT_SECRETを共有し、Bearerトークンで認証します。

```typescript
// JWT検証（AWS Lambda側）
import * as jose from 'jose';

async function verifyJWT(token: string): Promise<boolean> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const { payload } = await jose.jwtVerify(token, secret, {
    issuer: 'subsidy-app',
    audience: 'subsidy-app-users',
  });
  return true;
}
```

### 環境変数

**AWS Lambda（共通）**:
- `JWT_SECRET`: JWT署名シークレット（Cloudflareと同一）
- `S3_BUCKET`: 添付保存用バケット名
- `SQS_QUEUE_URL`: ジョブキューURL
- `ENVIRONMENT`: dev / staging / prod

**Worker Lambda（追加）**:
- `OPENAI_API_KEY`: OpenAI APIキー
- `ANTHROPIC_API_KEY`: Anthropic APIキー（任意）
- `CLOUDFLARE_D1_API_TOKEN`: D1 REST API用トークン
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflareアカウント
- `CLOUDFLARE_D1_DATABASE_ID`: D1データベースID

---

## Cloudflare側の実装例

### AWSプロキシルート

```typescript
// src/routes/subsidies.ts に追加

// POST /api/subsidies/:id/attachments/ingest
app.post('/api/subsidies/:subsidy_id/attachments/ingest', authMiddleware, async (c) => {
  const subsidyId = c.req.param('subsidy_id');
  const body = await c.req.json();
  const token = c.req.header('Authorization');

  // AWS API Gatewayにプロキシ
  const awsEndpoint = c.env.AWS_API_ENDPOINT;
  const response = await fetch(`${awsEndpoint}/jobs/ingest`, {
    method: 'POST',
    headers: {
      'Authorization': token!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subsidy_id: subsidyId,
      company_id: body.company_id,
      attachments: body.attachments,
    }),
  });

  const result = await response.json();
  return c.json(result, response.status);
});

// GET /api/subsidies/:id/eligibility
app.get('/api/subsidies/:subsidy_id/eligibility', authMiddleware, async (c) => {
  const subsidyId = c.req.param('subsidy_id');
  const { env } = c;

  // D1から要件ルールを取得
  const rules = await env.DB.prepare(`
    SELECT * FROM eligibility_rules 
    WHERE subsidy_id = ? 
    ORDER BY category, created_at
  `).bind(subsidyId).all();

  return c.json({
    success: true,
    data: {
      subsidy_id: subsidyId,
      rules: rules.results,
      count: rules.results?.length || 0,
    },
  });
});
```

---

## デプロイ手順

### 1. Terraform初期化

```bash
cd aws/terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvarsを編集してシークレットを設定

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

### 3. Cloudflare環境変数追加

```bash
# wrangler.jsonc に AWS_API_ENDPOINT を追加
wrangler secret put AWS_API_ENDPOINT
# 入力: https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com
```

---

## エラーハンドリング

### リトライポリシー

- SQSの `maxReceiveCount: 3` でリトライ
- 3回失敗後はDLQ（Dead Letter Queue）へ
- DLQは14日間保持

### エラーレスポンス

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

**Error Codes**:
- `UNAUTHORIZED`: 認証失敗
- `INVALID_TOKEN`: JWTトークン無効
- `INVALID_JSON`: リクエストボディ不正
- `MISSING_FIELD`: 必須フィールド欠落
- `JOB_NOT_FOUND`: ジョブが存在しない
- `INTERNAL_ERROR`: 内部エラー

---

## 抽出される要件ルールの形式

### EligibilityRule

```typescript
interface EligibilityRule {
  id: string;                // UUID
  subsidy_id: string;        // 補助金ID
  category: string;          // 対象者 | 地域 | 業種 | 規模 | 財務 | 事業内容 | その他
  rule_text: string;         // 要件の説明文
  check_type: 'AUTO' | 'MANUAL' | 'LLM';
  parameters?: {             // AUTO判定用パラメータ
    min?: number;
    max?: number;
    allowed_values?: string[];
  };
  source_text?: string;      // 公募要領からの引用
  page_number?: number;      // ページ番号
  created_at: string;
  updated_at: string;
}
```

### LLM抽出結果例

```json
{
  "eligibility_rules": [
    {
      "category": "規模",
      "rule_text": "従業員数が300人以下の中小企業であること",
      "check_type": "AUTO",
      "parameters": { "max": 300 },
      "source_text": "中小企業基本法に定める中小企業者（従業員300人以下）"
    },
    {
      "category": "地域",
      "rule_text": "東京都内に本社または主たる事業所を有すること",
      "check_type": "AUTO",
      "parameters": { "allowed_values": ["東京都"] },
      "source_text": "都内に本社又は主たる事業所を有する者"
    },
    {
      "category": "事業内容",
      "rule_text": "DX推進に関する具体的な計画を有すること",
      "check_type": "LLM",
      "source_text": "デジタル技術を活用した業務効率化又は新規事業開発に取り組む計画を策定していること"
    }
  ],
  "warnings": [
    "過去に同様の補助金を受給している場合は対象外となる可能性があります"
  ],
  "summary": "東京都内の中小企業（従業員300人以下）を対象とし、DX推進計画の策定が必須要件です。"
}
```

---

## 次のステップ

1. **Phase 2-A**（現在）: 添付取得→要件抽出の基盤完成
2. **Phase 2-B**: 壁打ちBot実装（会話ベースでの追加情報収集）
3. **Phase 2-C**: 申請書ドラフト生成（セクション別生成、NGフィルター）
4. **Phase 1-B**（並行）: KVキャッシュ、レート制限、UI実装

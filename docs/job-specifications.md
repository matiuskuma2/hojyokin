# ジョブ詳細仕様書

## 概要

本ドキュメントは、補助金マッチングシステムのバックグラウンドジョブの詳細仕様を定義します。
AWS SQS + Lambda を前提とした設計です。

---

## 1. ジョブアーキテクチャ

### 1-1. 全体構成

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API Server │────►│    SQS      │────►│   Lambda    │
│ (Cloudflare)│     │   Queue     │     │  (Worker)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │                                       ▼
       │                                ┌─────────────┐
       │                                │  Postgres   │
       │                                │     DB      │
       └───────────────────────────────►└─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │     S3      │
                                        │  (Storage)  │
                                        └─────────────┘
```

### 1-2. キュー構成

| キュー名 | 用途 | 可視性タイムアウト | メッセージ保持期間 |
|----------|------|-------------------|-------------------|
| `subsidy-sync-queue` | Jグランツ差分取込 | 5分 | 4日 |
| `attachment-ingest-queue` | 添付取込・保存 | 10分 | 4日 |
| `attachment-convert-queue` | 添付変換（PDF等） | 15分 | 4日 |
| `eligibility-extract-queue` | 要件JSON抽出 | 15分 | 4日 |
| `evaluation-queue` | 判定・再評価 | 5分 | 4日 |
| `notification-queue` | 通知送信 | 2分 | 4日 |
| `dlq-*` | 各キューのDLQ | - | 14日 |

### 1-3. デッドレターキュー（DLQ）設定

| 設定項目 | 値 |
|----------|-----|
| maxReceiveCount | 3 |
| DLQ保持期間 | 14日 |

---

## 2. Job A: Jグランツ差分取込

### 2-1. 概要

| 項目 | 内容 |
|------|------|
| キュー | `subsidy-sync-queue` |
| トリガー | EventBridge（定期実行：1日4回） |
| タイムアウト | 5分 |
| 同時実行数 | 1（直列実行） |
| 冪等性 | subsidy_idでupsert |

### 2-2. スケジュール

```
cron(0 0,6,12,18 * * ? *)  # UTC 0:00, 6:00, 12:00, 18:00
```

### 2-3. メッセージフォーマット

**入力**
```json
{
  "job_type": "SUBSIDY_SYNC",
  "job_id": "uuid",
  "triggered_at": "ISO8601",
  "params": {
    "acceptance_only": true,
    "sort": "acceptance_start_datetime",
    "order": "DESC",
    "limit": 100
  }
}
```

**出力（DB保存）**
```json
{
  "job_id": "uuid",
  "status": "DONE | FAILED",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "result": {
    "total_fetched": 100,
    "new_count": 5,
    "updated_count": 3,
    "unchanged_count": 92,
    "error_count": 0
  },
  "errors": []
}
```

### 2-4. 処理フロー

```
1. Jグランツ一覧API呼び出し
   └─ acceptance=1, sort=acceptance_start_datetime, limit=100
   
2. 取得した補助金をループ
   └─ subsidy_id で DB 検索
      ├─ 存在しない → INSERT (new_count++)
      ├─ 存在 & 更新あり → UPDATE (updated_count++)
      └─ 存在 & 更新なし → SKIP (unchanged_count++)

3. 新規・更新があった補助金
   └─ attachment-ingest-queue にメッセージ投入

4. ジョブ結果をDBに保存
```

### 2-5. エラーハンドリング

| エラー | 対応 |
|--------|------|
| API タイムアウト | リトライ（最大3回） |
| API レート制限 | 待機後リトライ |
| DB接続エラー | DLQへ |
| パースエラー | スキップして続行、error記録 |

---

## 3. Job B: 添付取込・保存

### 3-1. 概要

| 項目 | 内容 |
|------|------|
| キュー | `attachment-ingest-queue` |
| トリガー | SQSメッセージ（Job A完了 or ユーザー操作） |
| タイムアウト | 10分 |
| 同時実行数 | 5 |
| 冪等性 | attachment_id + hashでスキップ |

### 3-2. メッセージフォーマット

**入力**
```json
{
  "job_type": "ATTACHMENT_INGEST",
  "job_id": "uuid",
  "subsidy_id": "string",
  "triggered_by": "SYNC | USER",
  "user_id": "uuid | null",
  "force": false
}
```

**出力（DB保存）**
```json
{
  "job_id": "uuid",
  "status": "DONE | FAILED",
  "result": {
    "attachments_found": 5,
    "attachments_saved": 3,
    "attachments_skipped": 2,
    "convert_jobs_queued": 3
  }
}
```

### 3-3. 処理フロー

```
1. Jグランツ詳細API呼び出し
   └─ subsidy_id で詳細取得

2. 添付ファイルをループ
   └─ 各添付ファイルに対して:
      ├─ BASE64デコード
      ├─ ハッシュ計算（SHA256）
      ├─ 既存と比較
      │   ├─ 新規 or 更新 → S3保存
      │   └─ 同一 & !force → スキップ
      └─ DBにメタデータ保存

3. 保存した添付ファイル
   └─ attachment-convert-queue にメッセージ投入

4. ジョブ結果をDBに保存
```

### 3-4. S3パス規則

```
s3://bucket-name/attachments/{subsidy_id}/{attachment_id}/{filename}
```

### 3-5. サイズ制限

| 項目 | 制限 |
|------|------|
| 単一ファイル | 50MB |
| ZIP展開後合計 | 100MB |
| ZIP内ファイル数 | 50 |

---

## 4. Job C: 添付変換

### 4-1. 概要

| 項目 | 内容 |
|------|------|
| キュー | `attachment-convert-queue` |
| トリガー | SQSメッセージ（Job B完了） |
| タイムアウト | 15分 |
| 同時実行数 | 10 |
| 冪等性 | attachment_id + versionでスキップ |

### 4-2. メッセージフォーマット

**入力**
```json
{
  "job_type": "ATTACHMENT_CONVERT",
  "job_id": "uuid",
  "attachment_id": "uuid",
  "subsidy_id": "string",
  "file_type": "PDF | DOCX | XLSX | ZIP",
  "s3_path": "string",
  "retry_count": 0
}
```

**出力（DB保存）**
```json
{
  "job_id": "uuid",
  "status": "DONE | FAILED",
  "result": {
    "extracted_text_length": 12345,
    "page_count": 15,
    "extraction_method": "NATIVE | OCR | PARTIAL"
  }
}
```

### 4-3. 処理フロー（ファイルタイプ別）

#### PDF
```
1. S3からダウンロード
2. テキスト抽出試行（pdf-parse等）
   ├─ 成功 → Markdown化
   └─ 失敗（画像PDF） → OCR（将来対応、現在はPARTIAL）
3. 見出し・表の構造化
4. extracted_text をDBに保存
5. eligibility-extract-queue にメッセージ投入
```

#### DOCX
```
1. S3からダウンロード
2. mammoth等でテキスト抽出
3. Markdown化
4. extracted_text をDBに保存
5. eligibility-extract-queue にメッセージ投入
```

#### XLSX
```
1. S3からダウンロード
2. xlsx等でテキスト抽出
3. 表形式を保持してMarkdown化
4. extracted_text をDBに保存
5. eligibility-extract-queue にメッセージ投入（様式の場合は不要）
```

#### ZIP
```
1. S3からダウンロード
2. 展開（サイズ・ファイル数チェック）
3. 各ファイルを個別にS3保存
4. 各ファイルに対してattachment-convert-queueにメッセージ投入
```

### 4-4. エラーハンドリング

| エラー | 対応 |
|--------|------|
| パスワード保護 | FAILED、ユーザーに通知 |
| 文字化け | 文字コード推定して再試行 |
| メモリ不足 | 分割処理、またはFAILED |
| タイムアウト | リトライ（最大3回） |

### 4-5. 変換ステータス

| ステータス | 意味 |
|-----------|------|
| `pending` | 未処理 |
| `processing` | 処理中 |
| `ready` | 正常完了 |
| `partial` | 部分的に抽出 |
| `failed` | 失敗 |

---

## 5. Job D: 要件JSON抽出

### 5-1. 概要

| 項目 | 内容 |
|------|------|
| キュー | `eligibility-extract-queue` |
| トリガー | SQSメッセージ（Job C完了） |
| タイムアウト | 15分 |
| 同時実行数 | 5 |
| 冪等性 | subsidy_id + attachment_versionでスキップ |

### 5-2. メッセージフォーマット

**入力**
```json
{
  "job_type": "ELIGIBILITY_EXTRACT",
  "job_id": "uuid",
  "subsidy_id": "string",
  "attachment_ids": ["uuid"],
  "retry_count": 0
}
```

**出力（DB保存）**
```json
{
  "job_id": "uuid",
  "status": "DONE | PARTIAL | FAILED",
  "result": {
    "eligibility_rule_id": "uuid",
    "must_count": 5,
    "need_check_count": 3,
    "must_not_count": 2,
    "risk_flags_count": 1,
    "missing_keys_count": 2
  },
  "llm_usage": {
    "model": "gpt-4",
    "prompt_tokens": 5000,
    "completion_tokens": 2000,
    "cost_usd": 0.15
  }
}
```

### 5-3. 処理フロー

```
1. 対象添付のextracted_textをDBから取得
2. 添付テキストを結合（公募要領を優先）
3. LLMゲートウェイ経由でプロンプト送信
   └─ prompts-and-schemas.md の抽出プロンプトを使用
4. レスポンスをパース・バリデーション
   ├─ 成功 → EligibilityRule として保存
   └─ パース失敗 → フォールバック処理
5. evaluation-queue にメッセージ投入（影響企業の再評価）
6. ジョブ結果をDBに保存
```

### 5-4. フォールバック処理

```
Level 1: リトライ（モデル変更: GPT-4 → Gemini）
Level 2: 見出しベース抽出（構造だけ、詳細はneed_check）
Level 3: 最小限のJSON出力（missing_keysとneed_checkのみ）
```

### 5-5. キャッシュ

| キャッシュキー | TTL |
|--------------|-----|
| `eligibility:{subsidy_id}:{attachment_hash}` | 7日 |

---

## 6. Job E: 判定・再評価

### 6-1. 概要

| 項目 | 内容 |
|------|------|
| キュー | `evaluation-queue` |
| トリガー | SQSメッセージ（Job D完了, 企業情報更新, 新規募集） |
| タイムアウト | 5分 |
| 同時実行数 | 10 |
| 冪等性 | company_id + subsidy_id + versionでスキップ |

### 6-2. メッセージフォーマット

**入力**
```json
{
  "job_type": "EVALUATION",
  "job_id": "uuid",
  "trigger": "ELIGIBILITY_UPDATE | COMPANY_UPDATE | NEW_SUBSIDY",
  "company_ids": ["uuid"],
  "subsidy_ids": ["string"],
  "force": false
}
```

**出力（DB保存）**
```json
{
  "job_id": "uuid",
  "status": "DONE | FAILED",
  "result": {
    "evaluations_created": 50,
    "evaluations_updated": 10,
    "notifications_queued": 5
  }
}
```

### 6-3. 処理フロー

```
1. 対象の組み合わせを特定
   ├─ ELIGIBILITY_UPDATE: 該当補助金 × 全企業
   ├─ COMPANY_UPDATE: 該当企業 × 全受付中補助金
   └─ NEW_SUBSIDY: 該当補助金 × 全企業

2. 各組み合わせでスコア計算
   └─ match_score計算（requirements-v0.9.md参照）

3. EvaluationRun を保存

4. ステータス変更があった場合
   └─ notification-queue にメッセージ投入

5. ジョブ結果をDBに保存
```

### 6-4. バッチ処理

大量の組み合わせがある場合はバッチ分割：

| 条件 | バッチサイズ |
|------|-------------|
| 企業数 × 補助金数 > 1000 | 100件ずつ分割 |

---

## 7. Job F: 通知送信

### 7-1. 概要

| 項目 | 内容 |
|------|------|
| キュー | `notification-queue` |
| トリガー | SQSメッセージ |
| タイムアウト | 2分 |
| 同時実行数 | 5 |
| 冪等性 | notification_idでスキップ |

### 7-2. メッセージフォーマット

**入力**
```json
{
  "job_type": "NOTIFICATION",
  "job_id": "uuid",
  "notification_type": "NEW_MATCH | DEADLINE_REMINDER | STATUS_CHANGE",
  "user_id": "uuid",
  "company_id": "uuid",
  "subsidy_id": "string | null",
  "data": {
    "title": "string",
    "message": "string",
    "action_url": "string | null"
  }
}
```

### 7-3. 通知タイプ

| タイプ | 説明 | チャネル |
|--------|------|----------|
| `NEW_MATCH` | 新しい推奨補助金 | Email, In-App |
| `DEADLINE_REMINDER` | 締切間近 | Email, In-App |
| `STATUS_CHANGE` | ステータス変更 | In-App |
| `SYSTEM` | システム通知 | In-App |

### 7-4. 処理フロー

```
1. ユーザーの通知設定を確認
2. チャネル別に送信
   ├─ Email → SendGrid API
   └─ In-App → DB保存
3. EmailLog / NotificationLog に記録
```

---

## 8. 共通仕様

### 8-1. メッセージ共通フィールド

```json
{
  "job_type": "string",
  "job_id": "uuid",
  "triggered_at": "ISO8601",
  "triggered_by": "SYSTEM | USER",
  "user_id": "uuid | null",
  "correlation_id": "uuid",
  "retry_count": 0
}
```

### 8-2. ジョブステータス

| ステータス | 意味 |
|-----------|------|
| `QUEUED` | キューに投入済み |
| `RUNNING` | 処理中 |
| `DONE` | 正常完了 |
| `PARTIAL` | 部分的に完了 |
| `FAILED` | 失敗 |
| `RETRYING` | リトライ中 |
| `DEAD` | DLQ行き |

### 8-3. リトライ戦略

| 設定 | 値 |
|------|-----|
| 最大リトライ回数 | 3 |
| バックオフ | Exponential (1s, 2s, 4s) |
| DLQ移行条件 | 3回失敗 |

### 8-4. 監視メトリクス

| メトリクス | 説明 |
|-----------|------|
| `job_duration_seconds` | ジョブ実行時間 |
| `job_success_total` | 成功数 |
| `job_failure_total` | 失敗数 |
| `job_dlq_total` | DLQ数 |
| `queue_depth` | キュー深度 |
| `llm_tokens_total` | LLMトークン消費 |
| `llm_cost_usd_total` | LLMコスト |

### 8-5. ログ形式

```json
{
  "timestamp": "ISO8601",
  "level": "INFO | WARN | ERROR",
  "job_type": "string",
  "job_id": "uuid",
  "correlation_id": "uuid",
  "message": "string",
  "data": {},
  "error": {
    "code": "string",
    "message": "string",
    "stack": "string"
  }
}
```

---

## 9. Lambda設定

### 9-1. 共通設定

| 設定 | 値 |
|------|-----|
| Runtime | Node.js 20.x |
| Memory | 1024MB（変換系は2048MB） |
| Timeout | ジョブ別に設定 |
| VPC | 必要に応じて |
| Layers | 共通ライブラリ |

### 9-2. 環境変数

```
DATABASE_URL=postgres://...
S3_BUCKET=...
LLM_GATEWAY_URL=...
SENDGRID_API_KEY=...
SENTRY_DSN=...
LOG_LEVEL=INFO
```

### 9-3. IAMポリシー

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:SendMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:subsidy-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::subsidy-attachments/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:subsidy-*"
    }
  ]
}
```

---

## 10. エラーコード

| コード | 意味 | 対応 |
|--------|------|------|
| `E001` | API接続エラー | リトライ |
| `E002` | APIレート制限 | 待機後リトライ |
| `E003` | ファイルサイズ超過 | スキップ、ログ |
| `E004` | ファイル形式不正 | スキップ、ログ |
| `E005` | パスワード保護 | スキップ、ユーザー通知 |
| `E006` | テキスト抽出失敗 | フォールバック |
| `E007` | LLMエラー | リトライ、モデル変更 |
| `E008` | JSONパースエラー | フォールバック |
| `E009` | DB接続エラー | リトライ、アラート |
| `E010` | S3エラー | リトライ |
| `E011` | タイムアウト | リトライ |
| `E012` | メモリ不足 | 分割処理、アラート |

---

## 11. 運用手順

### 11-1. DLQ監視

1. CloudWatch Alarmで `ApproximateNumberOfMessagesVisible > 0` を監視
2. DLQにメッセージがあれば調査
3. 原因特定後、修正してredriveまたは削除

### 11-2. 手動実行

```bash
# 差分取込の手動実行
aws lambda invoke \
  --function-name subsidy-sync-lambda \
  --payload '{"job_type":"SUBSIDY_SYNC","job_id":"manual-001","params":{}}' \
  response.json

# 特定補助金の再取込
aws sqs send-message \
  --queue-url https://sqs.../attachment-ingest-queue \
  --message-body '{"job_type":"ATTACHMENT_INGEST","subsidy_id":"xxx","force":true}'
```

### 11-3. スケーリング

| 条件 | アクション |
|------|-----------|
| キュー深度 > 1000 | 同時実行数を増加 |
| 処理時間 > 閾値の80% | タイムアウトを延長 |
| エラー率 > 10% | アラート、調査 |

---

*ドキュメント終了*

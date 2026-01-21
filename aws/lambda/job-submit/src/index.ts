/**
 * Job Submit Lambda
 * =================
 * Cloudflare → AWS の入口となるLambda
 * 
 * エンドポイント:
 * - POST /jobs/ingest   : 添付取得→S3保存→ジョブ投入
 * - GET  /jobs/{id}/status : ジョブステータス取得
 * - GET  /health        : ヘルスチェック
 * 
 * 認証: 内部JWT（INTERNAL_JWT_SECRET）
 * CloudflareからのリクエストはすべてINTERNAL_JWT_SECRETで署名されたJWTで認証
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface JobMessage {
  job_id: string;
  job_type: 'ATTACHMENT_SAVE' | 'ATTACHMENT_CONVERT' | 'ELIGIBILITY_EXTRACT' | 'DRAFT_GENERATE';
  subsidy_id: string;
  company_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
  retry_count: number;
}

interface IngestRequest {
  subsidy_id: string;
  company_id?: string;
  user_id?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
    base64_content?: string;
    url?: string;
  }>;
}

interface JobStatus {
  job_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
  updated_at: string;
}

interface InternalJWTPayload extends jose.JWTPayload {
  action?: string;
  job_id?: string;
  subsidy_id?: string;
  company_id?: string;
}

// -----------------------------------------------------------------------------
// Clients
// -----------------------------------------------------------------------------
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// -----------------------------------------------------------------------------
// Internal JWT Verification (方式A: AWS↔Cloudflare共通認証)
// -----------------------------------------------------------------------------
const INTERNAL_JWT_ISSUER = 'subsidy-app-internal';
const INTERNAL_JWT_AUDIENCE = 'subsidy-app-internal';

async function verifyInternalJWT(token: string): Promise<{ valid: boolean; payload?: InternalJWTPayload }> {
  try {
    const secret = new TextEncoder().encode(process.env.INTERNAL_JWT_SECRET || '');
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: INTERNAL_JWT_ISSUER,
      audience: INTERNAL_JWT_AUDIENCE,
    });
    return { valid: true, payload: payload as InternalJWTPayload };
  } catch (error) {
    console.error('Internal JWT verification failed:', error);
    return { valid: false };
  }
}

// -----------------------------------------------------------------------------
// Response Helpers
// -----------------------------------------------------------------------------
function jsonResponse(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

/**
 * POST /jobs/ingest
 * 添付ファイルを取得してS3に保存し、変換ジョブを投入
 */
async function handleIngest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // 内部JWT認証
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { success: false, error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
  }

  const token = authHeader.slice(7);
  const { valid, payload } = await verifyInternalJWT(token);
  if (!valid) {
    return jsonResponse(401, { success: false, error: 'INVALID_TOKEN', message: 'Token verification failed' });
  }

  // アクション検証（オプション）
  if (payload?.action && payload.action !== 'job:submit') {
    return jsonResponse(403, { success: false, error: 'FORBIDDEN', message: `Action '${payload.action}' not allowed for this endpoint` });
  }

  // リクエストボディ解析
  let body: IngestRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { success: false, error: 'INVALID_JSON', message: 'Invalid request body' });
  }

  if (!body.subsidy_id) {
    return jsonResponse(400, { success: false, error: 'MISSING_FIELD', message: 'subsidy_id is required' });
  }

  const jobId = uuidv4();
  const s3Bucket = process.env.S3_BUCKET!;
  const sqsQueueUrl = process.env.SQS_QUEUE_URL!;
  const timestamp = new Date().toISOString();

  // ジョブステータスを初期化（S3に保存）
  const jobStatus: JobStatus = {
    job_id: jobId,
    status: 'PENDING',
    progress: 0,
    updated_at: timestamp,
  };

  await s3.send(new PutObjectCommand({
    Bucket: s3Bucket,
    Key: `jobs/${jobId}/status.json`,
    Body: JSON.stringify(jobStatus),
    ContentType: 'application/json',
  }));

  // 添付ファイルがある場合はS3に保存
  const savedAttachments: Array<{ id: string; s3_key: string }> = [];

  if (body.attachments && body.attachments.length > 0) {
    for (const attachment of body.attachments) {
      let content: Buffer;

      if (attachment.base64_content) {
        // Base64デコード
        content = Buffer.from(attachment.base64_content, 'base64');
      } else if (attachment.url) {
        // URLからダウンロード
        try {
          const response = await fetch(attachment.url);
          if (!response.ok) {
            console.error(`Failed to download attachment: ${attachment.url}`);
            continue;
          }
          content = Buffer.from(await response.arrayBuffer());
        } catch (error) {
          console.error(`Error downloading attachment:`, error);
          continue;
        }
      } else {
        continue;
      }

      const s3Key = `attachments/${body.subsidy_id}/${attachment.id}/${attachment.filename}`;

      await s3.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: content,
        ContentType: attachment.content_type || 'application/octet-stream',
        Metadata: {
          'original-filename': attachment.filename,
          'subsidy-id': body.subsidy_id,
          'job-id': jobId,
        },
      }));

      savedAttachments.push({ id: attachment.id, s3_key: s3Key });
    }
  }

  // ATTACHMENT_CONVERTジョブをSQSに投入
  const jobMessage: JobMessage = {
    job_id: jobId,
    job_type: 'ATTACHMENT_CONVERT',
    subsidy_id: body.subsidy_id,
    company_id: body.company_id,
    payload: {
      attachments: savedAttachments,
      user_id: body.user_id || payload?.sub,
    },
    created_at: timestamp,
    retry_count: 0,
  };

  await sqs.send(new SendMessageCommand({
    QueueUrl: sqsQueueUrl,
    MessageBody: JSON.stringify(jobMessage),
    MessageAttributes: {
      JobType: {
        DataType: 'String',
        StringValue: 'ATTACHMENT_CONVERT',
      },
      SubsidyId: {
        DataType: 'String',
        StringValue: body.subsidy_id,
      },
    },
  }));

  console.log(`Job ${jobId} created for subsidy ${body.subsidy_id} (attachments: ${savedAttachments.length})`);

  return jsonResponse(202, {
    success: true,
    data: {
      job_id: jobId,
      status: 'PENDING',
      subsidy_id: body.subsidy_id,
      company_id: body.company_id,
      attachments_saved: savedAttachments.length,
      message: 'Job submitted successfully. Use GET /jobs/{job_id}/status to check progress.',
    },
  });
}

/**
 * GET /jobs/{job_id}/status
 * ジョブステータス取得
 */
async function handleStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // 内部JWT認証（オプション - ステータス確認は緩めでもOK）
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { valid } = await verifyInternalJWT(token);
    if (!valid) {
      return jsonResponse(401, { success: false, error: 'INVALID_TOKEN', message: 'Token verification failed' });
    }
  }

  const jobId = event.pathParameters?.job_id;
  if (!jobId) {
    return jsonResponse(400, { success: false, error: 'MISSING_JOB_ID', message: 'job_id is required' });
  }

  const s3Bucket = process.env.S3_BUCKET!;

  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: s3Bucket,
      Key: `jobs/${jobId}/status.json`,
    }));

    const body = await response.Body?.transformToString();
    if (!body) {
      return jsonResponse(404, { success: false, error: 'JOB_NOT_FOUND', message: 'Job not found' });
    }

    const status: JobStatus = JSON.parse(body);
    return jsonResponse(200, { success: true, data: status });
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === 'NoSuchKey') {
      return jsonResponse(404, { success: false, error: 'JOB_NOT_FOUND', message: 'Job not found' });
    }
    throw error;
  }
}

/**
 * GET /health
 * ヘルスチェック
 */
async function handleHealth(): Promise<APIGatewayProxyResultV2> {
  return jsonResponse(200, {
    success: true,
    status: 'ok',
    service: 'job-submit',
    timestamp: new Date().toISOString(),
  });
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    // ルーティング
    if (method === 'POST' && path === '/jobs/ingest') {
      return await handleIngest(event);
    }

    if (method === 'GET' && path.startsWith('/jobs/') && path.endsWith('/status')) {
      return await handleStatus(event);
    }

    if (method === 'GET' && path === '/health') {
      return await handleHealth();
    }

    return jsonResponse(404, { success: false, error: 'NOT_FOUND', message: 'Route not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return jsonResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

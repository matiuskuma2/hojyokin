/**
 * Worker Lambda
 * =============
 * SQSからジョブを受け取り、以下の処理を実行:
 * 
 * 1. ATTACHMENT_CONVERT: PDF/Word → テキスト変換
 * 2. ELIGIBILITY_EXTRACT: LLMで要件JSON抽出
 * 3. DRAFT_GENERATE: 申請書ドラフト生成（Phase 2後半）
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface JobMessage {
  job_id: string;
  job_type: 'ATTACHMENT_CONVERT' | 'ELIGIBILITY_EXTRACT' | 'DRAFT_GENERATE';
  subsidy_id: string;
  company_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
  retry_count: number;
}

interface JobStatus {
  job_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
  updated_at: string;
}

interface EligibilityRule {
  id: string;
  subsidy_id: string;
  category: string;
  rule_text: string;
  check_type: 'AUTO' | 'MANUAL' | 'LLM';
  parameters?: Record<string, unknown>;
  source_text?: string;
  page_number?: number;
}

interface ConvertedAttachment {
  id: string;
  s3_key: string;
  text_content: string;
  page_count?: number;
}

// -----------------------------------------------------------------------------
// Clients
// -----------------------------------------------------------------------------
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// OpenAI client (lazy initialization)
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------
async function updateJobStatus(jobId: string, status: Partial<JobStatus>): Promise<void> {
  const s3Bucket = process.env.S3_BUCKET!;
  
  // 既存のステータスを取得
  let currentStatus: JobStatus;
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: s3Bucket,
      Key: `jobs/${jobId}/status.json`,
    }));
    const body = await response.Body?.transformToString();
    currentStatus = body ? JSON.parse(body) : { job_id: jobId };
  } catch {
    currentStatus = { job_id: jobId, status: 'PENDING', updated_at: new Date().toISOString() };
  }

  // ステータスを更新
  const updatedStatus: JobStatus = {
    ...currentStatus,
    ...status,
    updated_at: new Date().toISOString(),
  };

  await s3.send(new PutObjectCommand({
    Bucket: s3Bucket,
    Key: `jobs/${jobId}/status.json`,
    Body: JSON.stringify(updatedStatus),
    ContentType: 'application/json',
  }));
}

async function enqueueNextJob(message: JobMessage, nextJobType: JobMessage['job_type'], additionalPayload: Record<string, unknown> = {}): Promise<void> {
  const sqsQueueUrl = process.env.SQS_QUEUE_URL!;

  const nextMessage: JobMessage = {
    ...message,
    job_type: nextJobType,
    payload: { ...message.payload, ...additionalPayload },
    retry_count: 0,
  };

  await sqs.send(new SendMessageCommand({
    QueueUrl: sqsQueueUrl,
    MessageBody: JSON.stringify(nextMessage),
    MessageAttributes: {
      JobType: {
        DataType: 'String',
        StringValue: nextJobType,
      },
      SubsidyId: {
        DataType: 'String',
        StringValue: message.subsidy_id,
      },
    },
  }));

  console.log(`Enqueued next job: ${nextJobType} for ${message.subsidy_id}`);
}

// -----------------------------------------------------------------------------
// Job Handlers
// -----------------------------------------------------------------------------

/**
 * ATTACHMENT_CONVERT: PDF/Word → テキスト変換
 */
async function handleAttachmentConvert(message: JobMessage): Promise<void> {
  const s3Bucket = process.env.S3_BUCKET!;
  const attachments = message.payload.attachments as Array<{ id: string; s3_key: string }> || [];

  await updateJobStatus(message.job_id, { status: 'PROCESSING', progress: 10 });

  const convertedAttachments: ConvertedAttachment[] = [];

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];
    console.log(`Converting attachment: ${attachment.s3_key}`);

    try {
      // S3からファイルを取得
      const response = await s3.send(new GetObjectCommand({
        Bucket: s3Bucket,
        Key: attachment.s3_key,
      }));

      const buffer = Buffer.from(await response.Body!.transformToByteArray());
      const contentType = response.ContentType || 'application/octet-stream';
      let textContent = '';
      let pageCount: number | undefined;

      // ファイル形式に応じた変換
      if (contentType === 'application/pdf' || attachment.s3_key.endsWith('.pdf')) {
        // PDF変換（pdf-parseを使用）
        // Note: Lambda環境ではpdf-parseの依存関係に注意が必要
        // 本番環境ではPDFiumやPoppler等のネイティブライブラリを検討
        try {
          // 動的インポート（Lambda環境での互換性のため）
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(buffer);
          textContent = pdfData.text;
          pageCount = pdfData.numpages;
        } catch (pdfError) {
          console.error('PDF parse error:', pdfError);
          // フォールバック: Base64として保存し、LLMで処理を試みる
          textContent = `[PDF content - ${buffer.length} bytes - requires manual extraction]`;
        }
      } else if (
        contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        attachment.s3_key.endsWith('.docx')
      ) {
        // Word文書（簡易処理、本格的にはmammoth等を使用）
        textContent = `[Word document - ${buffer.length} bytes - requires conversion]`;
      } else if (contentType.startsWith('text/')) {
        // テキストファイル
        textContent = buffer.toString('utf-8');
      } else {
        textContent = `[Unknown format: ${contentType} - ${buffer.length} bytes]`;
      }

      // 変換結果をS3に保存
      const textKey = attachment.s3_key.replace(/\.[^.]+$/, '.txt');
      await s3.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: textKey,
        Body: textContent,
        ContentType: 'text/plain; charset=utf-8',
        Metadata: {
          'original-key': attachment.s3_key,
          'page-count': pageCount?.toString() || '0',
        },
      }));

      convertedAttachments.push({
        id: attachment.id,
        s3_key: textKey,
        text_content: textContent,
        page_count: pageCount,
      });

    } catch (error) {
      console.error(`Error converting attachment ${attachment.s3_key}:`, error);
    }

    // 進捗更新
    const progress = 10 + Math.round((i + 1) / attachments.length * 40);
    await updateJobStatus(message.job_id, { progress });
  }

  // 変換結果をジョブステータスに保存
  await updateJobStatus(message.job_id, {
    progress: 50,
    result: { converted_attachments: convertedAttachments.length },
  });

  // 次のジョブ（ELIGIBILITY_EXTRACT）を投入
  await enqueueNextJob(message, 'ELIGIBILITY_EXTRACT', {
    converted_attachments: convertedAttachments,
  });
}

/**
 * ELIGIBILITY_EXTRACT: LLMで要件JSON抽出
 */
async function handleEligibilityExtract(message: JobMessage): Promise<void> {
  const s3Bucket = process.env.S3_BUCKET!;
  const convertedAttachments = message.payload.converted_attachments as ConvertedAttachment[] || [];

  await updateJobStatus(message.job_id, { status: 'PROCESSING', progress: 55 });

  // 全テキストを結合
  let fullText = '';
  for (const attachment of convertedAttachments) {
    if (attachment.text_content) {
      fullText += `\n\n--- ${attachment.id} ---\n${attachment.text_content}`;
    }
  }

  if (!fullText.trim()) {
    console.log('No text content to extract eligibility from');
    await updateJobStatus(message.job_id, {
      status: 'COMPLETED',
      progress: 100,
      result: { eligibility_rules: [], message: 'No text content found' },
    });
    return;
  }

  // LLMで要件抽出
  const openai = getOpenAI();
  
  const systemPrompt = `あなたは補助金の公募要領から申請要件を抽出する専門家です。
以下のテキストから、申請者が満たすべき要件を構造化してJSON形式で出力してください。

出力形式:
{
  "eligibility_rules": [
    {
      "category": "対象者" | "地域" | "業種" | "規模" | "財務" | "事業内容" | "その他",
      "rule_text": "要件の説明文",
      "check_type": "AUTO" | "MANUAL" | "LLM",
      "parameters": { "min": 数値, "max": 数値, "allowed_values": [...] } // 該当する場合のみ,
      "source_text": "原文からの引用",
      "page_number": ページ番号 // わかる場合のみ
    }
  ],
  "warnings": ["注意すべき点があれば記載"],
  "summary": "要件の要約（200文字以内）"
}

check_typeの判断基準:
- AUTO: 数値比較や選択肢のマッチングで自動判定可能（従業員数、資本金、業種コードなど）
- MANUAL: 書類確認や人的判断が必要（過去の実績、計画の妥当性など）
- LLM: AIによる文章解析が必要（事業内容の適合性など）`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // コスト最適化のためminiを使用
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `以下の公募要領から申請要件を抽出してください:\n\n${fullText.slice(0, 30000)}` },  // トークン制限対応
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty LLM response');
    }

    const extractedData = JSON.parse(content);
    const eligibilityRules: EligibilityRule[] = (extractedData.eligibility_rules || []).map((rule: Partial<EligibilityRule>, index: number) => ({
      id: uuidv4(),
      subsidy_id: message.subsidy_id,
      ...rule,
    }));

    // 抽出結果をS3に保存
    await s3.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: `eligibility/${message.subsidy_id}/rules.json`,
      Body: JSON.stringify({
        subsidy_id: message.subsidy_id,
        rules: eligibilityRules,
        warnings: extractedData.warnings || [],
        summary: extractedData.summary || '',
        extracted_at: new Date().toISOString(),
        source_job_id: message.job_id,
      }),
      ContentType: 'application/json',
    }));

    // Cloudflare D1への書き込み（オプション）
    if (process.env.CLOUDFLARE_D1_API_TOKEN && process.env.CLOUDFLARE_D1_DATABASE_ID) {
      await writeToCloudflareD1(message.subsidy_id, eligibilityRules);
    }

    await updateJobStatus(message.job_id, {
      status: 'COMPLETED',
      progress: 100,
      result: {
        eligibility_rules_count: eligibilityRules.length,
        warnings: extractedData.warnings,
        summary: extractedData.summary,
      },
    });

    console.log(`Extracted ${eligibilityRules.length} eligibility rules for ${message.subsidy_id}`);

  } catch (error) {
    console.error('LLM extraction error:', error);
    await updateJobStatus(message.job_id, {
      status: 'FAILED',
      progress: 60,
      error: error instanceof Error ? error.message : 'LLM extraction failed',
    });
  }
}

/**
 * Cloudflare D1に要件ルールを書き込み
 */
async function writeToCloudflareD1(subsidyId: string, rules: EligibilityRule[]): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    console.log('Cloudflare D1 credentials not configured, skipping D1 write');
    return;
  }

  try {
    // D1 REST APIを使用して書き込み
    const statements = rules.map(rule => ({
      sql: `INSERT OR REPLACE INTO eligibility_rules 
            (id, subsidy_id, category, rule_text, check_type, parameters, source_text, page_number, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      params: [
        rule.id,
        rule.subsidy_id,
        rule.category,
        rule.rule_text,
        rule.check_type,
        JSON.stringify(rule.parameters || {}),
        rule.source_text || null,
        rule.page_number || null,
      ],
    }));

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statements }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D1 write error:', errorText);
    } else {
      console.log(`Written ${rules.length} rules to Cloudflare D1`);
    }
  } catch (error) {
    console.error('D1 write error:', error);
  }
}

/**
 * DRAFT_GENERATE: 申請書ドラフト生成（Phase 2後半で実装）
 */
async function handleDraftGenerate(message: JobMessage): Promise<void> {
  // Phase 2後半で実装予定
  await updateJobStatus(message.job_id, {
    status: 'COMPLETED',
    progress: 100,
    result: { message: 'Draft generation not yet implemented' },
  });
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------
export async function handler(event: SQSEvent): Promise<void> {
  console.log('Received SQS event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let message: JobMessage;

  try {
    message = JSON.parse(record.body);
  } catch (error) {
    console.error('Failed to parse message:', error);
    return;
  }

  console.log(`Processing job: ${message.job_id} (type: ${message.job_type})`);

  try {
    switch (message.job_type) {
      case 'ATTACHMENT_CONVERT':
        await handleAttachmentConvert(message);
        break;

      case 'ELIGIBILITY_EXTRACT':
        await handleEligibilityExtract(message);
        break;

      case 'DRAFT_GENERATE':
        await handleDraftGenerate(message);
        break;

      default:
        console.error(`Unknown job type: ${message.job_type}`);
        await updateJobStatus(message.job_id, {
          status: 'FAILED',
          error: `Unknown job type: ${message.job_type}`,
        });
    }
  } catch (error) {
    console.error(`Job ${message.job_id} failed:`, error);

    // リトライ回数チェック
    if (message.retry_count < 3) {
      console.log(`Job ${message.job_id} will be retried (attempt ${message.retry_count + 1}/3)`);
    } else {
      await updateJobStatus(message.job_id, {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Job processing failed',
      });
    }

    throw error; // SQSのリトライメカニズムに委ねる
  }
}

/**
 * 内部API ルート
 * 
 * AWS→Cloudflare間の通信専用エンドポイント
 * 外部からはアクセス不可（内部JWT認証必須）
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables } from '../types/env';
import { internalAuthMiddleware } from '../lib/internal-jwt';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ========================================
// 全ルートに内部JWT認証を適用
// ========================================
app.use('/*', internalAuthMiddleware());

// ========================================
// POST /internal/eligibility/upsert
// AWS workerからの要件ルール書き込み
// ========================================
app.post('/eligibility/upsert', internalAuthMiddleware(['eligibility:upsert']), async (c) => {
  const { env } = c;
  const internalAuth = c.get('internalAuth');

  // リクエストボディ
  interface EligibilityRule {
    id?: string;
    subsidy_id: string;
    category: string;
    rule_text: string;
    check_type: 'AUTO' | 'MANUAL' | 'LLM';
    parameters?: Record<string, unknown>;
    source_text?: string;
    page_number?: number;
  }

  interface UpsertRequest {
    subsidy_id: string;
    rules: EligibilityRule[];
    warnings?: string[];
    summary?: string;
    job_id?: string;
  }

  let body: UpsertRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.subsidy_id || !Array.isArray(body.rules)) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'subsidy_id and rules are required' } }, 400);
  }

  const subsidyId = body.subsidy_id;
  const rules = body.rules;
  const now = new Date().toISOString();

  try {
    // トランザクションで既存ルールを削除して新規追加
    const statements: D1PreparedStatement[] = [];

    // 1. 既存ルールを削除
    statements.push(
      env.DB.prepare(`DELETE FROM eligibility_rules WHERE subsidy_id = ?`).bind(subsidyId)
    );

    // 2. 新規ルールを追加
    for (const rule of rules) {
      const id = rule.id || uuidv4();
      statements.push(
        env.DB.prepare(`
          INSERT INTO eligibility_rules (
            id, subsidy_id, category, rule_text, check_type, 
            parameters, source_text, page_number, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          subsidyId,
          rule.category,
          rule.rule_text,
          rule.check_type,
          rule.parameters ? JSON.stringify(rule.parameters) : null,
          rule.source_text || null,
          rule.page_number || null,
          now,
          now
        )
      );
    }

    // 3. サマリーをeligibility_extractionsに保存/更新
    if (body.summary || body.warnings || body.job_id) {
      const extractionId = uuidv4();
      statements.push(
        env.DB.prepare(`
          INSERT INTO eligibility_extractions (id, subsidy_id, job_id, rules_count, warnings, summary, extracted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(subsidy_id) DO UPDATE SET
            job_id = excluded.job_id,
            rules_count = excluded.rules_count,
            warnings = excluded.warnings,
            summary = excluded.summary,
            updated_at = excluded.updated_at
        `).bind(
          extractionId,
          subsidyId,
          body.job_id || null,
          rules.length,
          body.warnings ? JSON.stringify(body.warnings) : null,
          body.summary || null,
          now,
          now
        )
      );
    }

    // バッチ実行
    await env.DB.batch(statements);

    console.log(`[Internal] Upserted ${rules.length} eligibility rules for subsidy ${subsidyId} (job: ${body.job_id || 'unknown'})`);

    return c.json({
      success: true,
      data: {
        subsidy_id: subsidyId,
        rules_count: rules.length,
        warnings: body.warnings || [],
        summary: body.summary || null,
        updated_at: now,
      },
    });

  } catch (error) {
    console.error('[Internal] Eligibility upsert error:', error);
    return c.json({
      success: false,
      error: {
        code: 'DB_ERROR',
        message: error instanceof Error ? error.message : 'Database error',
      },
    }, 500);
  }
});

// ========================================
// GET /internal/eligibility/:subsidy_id
// 要件ルール取得（デバッグ/確認用）
// ========================================
app.get('/eligibility/:subsidy_id', async (c) => {
  const { env } = c;
  const subsidyId = c.req.param('subsidy_id');

  try {
    const result = await env.DB.prepare(`
      SELECT * FROM eligibility_rules 
      WHERE subsidy_id = ? 
      ORDER BY category, created_at
    `).bind(subsidyId).all();

    return c.json({
      success: true,
      data: {
        subsidy_id: subsidyId,
        rules: result.results || [],
        count: result.results?.length || 0,
      },
    });
  } catch (error) {
    console.error('[Internal] Eligibility fetch error:', error);
    return c.json({
      success: false,
      error: {
        code: 'DB_ERROR',
        message: error instanceof Error ? error.message : 'Database error',
      },
    }, 500);
  }
});

// ========================================
// POST /internal/job/status
// ジョブステータス通知（AWS→Cloudflare）
// ========================================
app.post('/job/status', internalAuthMiddleware(['job:status']), async (c) => {
  const { env } = c;

  interface StatusRequest {
    job_id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress?: number;
    result?: Record<string, unknown>;
    error?: string;
  }

  let body: StatusRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.job_id || !body.status) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'job_id and status are required' } }, 400);
  }

  // ここでジョブステータスをD1に保存することも可能
  // 今回は最小実装としてログのみ
  console.log(`[Internal] Job status update: ${body.job_id} -> ${body.status} (progress: ${body.progress || 0}%)`);

  return c.json({
    success: true,
    data: {
      job_id: body.job_id,
      status: body.status,
      received_at: new Date().toISOString(),
    },
  });
});

// ========================================
// POST /internal/document-extraction-callback
// AWS→Cloudflare: 書類抽出結果の受信
// ========================================
app.post('/document-extraction-callback', internalAuthMiddleware(['document:extract']), async (c) => {
  const { env } = c;

  interface ExtractionResult {
    job_id: string;
    document_id: string;
    company_id: string;
    status: 'success' | 'failed';
    doc_type: 'corp_registry' | 'financials';
    extracted_json?: Record<string, unknown>;
    confidence?: number;
    error?: string;
    processing_time_ms?: number;
  }

  let body: ExtractionResult;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.document_id || !body.status) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'document_id and status are required' } }, 400);
  }

  const now = new Date().toISOString();

  try {
    // ドキュメントの存在確認
    const doc = await env.DB.prepare(`
      SELECT id, company_id, doc_type, status 
      FROM company_documents 
      WHERE id = ?
    `).bind(body.document_id).first();

    if (!doc) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
    }

    // company_id の整合性チェック
    if (body.company_id && doc.company_id !== body.company_id) {
      console.warn(`[Internal] Company ID mismatch: expected ${doc.company_id}, got ${body.company_id}`);
    }

    if (body.status === 'success' && body.extracted_json) {
      // 成功: 抽出結果を保存
      await env.DB.prepare(`
        UPDATE company_documents 
        SET status = 'extracted', 
            extracted_json = ?, 
            confidence = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        JSON.stringify(body.extracted_json),
        body.confidence || 0,
        now,
        body.document_id
      ).run();

      console.log(`[Internal] Extraction success: document ${body.document_id}, confidence ${body.confidence}`);
    } else {
      // 失敗: ステータスを failed に更新
      await env.DB.prepare(`
        UPDATE company_documents 
        SET status = 'failed',
            extracted_json = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        JSON.stringify({ error: body.error || 'Unknown extraction error' }),
        now,
        body.document_id
      ).run();

      console.error(`[Internal] Extraction failed: document ${body.document_id}, error: ${body.error}`);
    }

    // 監査ログ
    await env.DB.prepare(`
      INSERT INTO audit_log (id, actor_user_id, target_company_id, target_resource_type, target_resource_id, action, action_category, severity, details_json, created_at)
      VALUES (?, 'system:aws-worker', ?, 'document', ?, 'DOCUMENT_EXTRACTION_COMPLETED', 'document', 'info', ?, ?)
    `).bind(
      crypto.randomUUID(),
      body.company_id || null,
      body.document_id,
      JSON.stringify({
        job_id: body.job_id,
        status: body.status,
        confidence: body.confidence,
        processing_time_ms: body.processing_time_ms,
        error: body.error
      }),
      now
    ).run();

    return c.json({
      success: true,
      data: {
        document_id: body.document_id,
        status: body.status === 'success' ? 'extracted' : 'failed',
        received_at: now
      }
    });
  } catch (error) {
    console.error('[Internal] Extraction callback error:', error);
    return c.json({
      success: false,
      error: {
        code: 'DB_ERROR',
        message: error instanceof Error ? error.message : 'Database error'
      }
    }, 500);
  }
});

// ========================================
// POST /internal/document-extraction-callback
// AWS側から書類抽出結果を受信
// ========================================
app.post('/document-extraction-callback', internalAuthMiddleware(['document:extract']), async (c) => {
  const { env } = c;

  interface ExtractionCallback {
    job_id: string;
    document_id: string;
    company_id: string;
    status: 'completed' | 'failed';
    doc_type: 'corp_registry' | 'financials';
    extracted_json?: Record<string, unknown>;
    confidence?: number;
    error?: string;
  }

  let body: ExtractionCallback;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.job_id || !body.document_id || !body.status) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'job_id, document_id, and status are required' } }, 400);
  }

  const now = new Date().toISOString();

  try {
    // ドキュメントの存在確認
    const doc = await env.DB.prepare(`
      SELECT id, company_id, status FROM company_documents WHERE id = ?
    `).bind(body.document_id).first() as { id: string; company_id: string; status: string } | null;

    if (!doc) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
    }

    // company_id の一致確認（セキュリティ）
    if (doc.company_id !== body.company_id) {
      return c.json({ success: false, error: { code: 'COMPANY_MISMATCH', message: 'Company ID does not match' } }, 400);
    }

    if (body.status === 'completed' && body.extracted_json) {
      // 抽出成功
      await env.DB.prepare(`
        UPDATE company_documents 
        SET status = 'extracted',
            extracted_json = ?,
            confidence = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        JSON.stringify(body.extracted_json),
        body.confidence || 0,
        now,
        body.document_id
      ).run();

      console.log(`[Internal] Document extraction completed: ${body.document_id} (job: ${body.job_id})`);

      return c.json({
        success: true,
        data: {
          document_id: body.document_id,
          status: 'extracted',
          received_at: now,
        },
      });
    } else {
      // 抽出失敗
      await env.DB.prepare(`
        UPDATE company_documents 
        SET status = 'failed',
            extracted_json = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        JSON.stringify({ error: body.error || 'Unknown error', job_id: body.job_id }),
        now,
        body.document_id
      ).run();

      console.error(`[Internal] Document extraction failed: ${body.document_id} (job: ${body.job_id}, error: ${body.error})`);

      return c.json({
        success: true,
        data: {
          document_id: body.document_id,
          status: 'failed',
          error: body.error,
          received_at: now,
        },
      });
    }
  } catch (error) {
    console.error('[Internal] Document extraction callback error:', error);
    return c.json({
      success: false,
      error: {
        code: 'DB_ERROR',
        message: error instanceof Error ? error.message : 'Database error',
      },
    }, 500);
  }
});

// ========================================
// POST /internal/document-extraction-mock
// 開発用：手動で抽出結果を登録（AWS連携未設定時）
// ========================================
app.post('/document-extraction-mock', internalAuthMiddleware(['document:extract']), async (c) => {
  const { env } = c;

  interface MockExtractionRequest {
    document_id: string;
    extracted_json: Record<string, unknown>;
    confidence?: number;
  }

  let body: MockExtractionRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.document_id || !body.extracted_json) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'document_id and extracted_json are required' } }, 400);
  }

  const now = new Date().toISOString();

  try {
    await env.DB.prepare(`
      UPDATE company_documents 
      SET status = 'extracted',
          extracted_json = ?,
          confidence = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      JSON.stringify(body.extracted_json),
      body.confidence || 80,
      now,
      body.document_id
    ).run();

    console.log(`[Internal] Mock extraction applied: ${body.document_id}`);

    return c.json({
      success: true,
      data: {
        document_id: body.document_id,
        status: 'extracted',
        mock: true,
        received_at: now,
      },
    });
  } catch (error) {
    console.error('[Internal] Mock extraction error:', error);
    return c.json({
      success: false,
      error: {
        code: 'DB_ERROR',
        message: error instanceof Error ? error.message : 'Database error',
      },
    }, 500);
  }
});

// ========================================
// GET /internal/health
// 内部APIヘルスチェック
// ========================================
app.get('/health', async (c) => {
  return c.json({
    success: true,
    status: 'ok',
    service: 'cloudflare-internal-api',
    timestamp: new Date().toISOString(),
  });
});

export default app;

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

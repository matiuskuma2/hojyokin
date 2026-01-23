/**
 * ジョブ管理ルート
 * 
 * Cloudflare → AWS へのプロキシエンドポイント
 * 添付取得・要件抽出ジョブの投入とステータス確認
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { signInternalJWT } from '../lib/internal-jwt';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ========================================
// POST /api/jobs/ingest
// 添付取得→変換→要件抽出ジョブを投入
// ========================================
app.post('/ingest', requireAuth, async (c) => {
  const { env } = c;
  const user = c.get('user');

  // AWS API Gatewayエンドポイントの確認
  const awsApiBase = env.AWS_JOB_API_BASE_URL;
  if (!awsApiBase) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'AWS API endpoint not configured' },
    }, 503);
  }

  // リクエストボディ
  interface IngestRequest {
    subsidy_id: string;
    company_id?: string;
    attachments?: Array<{
      id: string;
      filename: string;
      content_type: string;
      base64_content?: string;
      url?: string;
    }>;
  }

  let body: IngestRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.subsidy_id) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'subsidy_id is required' } }, 400);
  }

  // company_idがある場合、所属確認
  if (body.company_id && user) {
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const membership = await env.DB.prepare(`
      SELECT 1 FROM user_companies 
      WHERE user_id = ? AND company_id = ?
    `).bind(user.id, body.company_id).first();

    if (!membership) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this company' },
      }, 403);
    }
  }

  try {
    // 内部JWT発行（Cloudflare→AWS）
    const internalToken = await signInternalJWT({
      service: 'cloudflare-api',
      action: 'job:submit',
      subsidy_id: body.subsidy_id,
      company_id: body.company_id,
    }, env);

    // AWS API Gatewayにプロキシ
    const awsResponse = await fetch(`${awsApiBase}/jobs/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subsidy_id: body.subsidy_id,
        company_id: body.company_id,
        attachments: body.attachments || [],
        user_id: user?.id,
      }),
    });

    const awsData = await awsResponse.json().catch(() => ({})) as { success?: boolean; data?: Record<string, unknown>; error?: unknown };

    if (!awsResponse.ok) {
      console.error('[Jobs] AWS API error:', awsResponse.status, awsData);
      return c.json({
        success: false,
        error: { code: 'AWS_ERROR', message: 'Failed to submit job to AWS', details: awsData },
      }, awsResponse.status as 400 | 401 | 403 | 404 | 500);
    }

    return c.json({
      success: true,
      data: awsData.data,
    }, 202);

  } catch (error) {
    console.error('[Jobs] Ingest error:', error);
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal error' },
    }, 500);
  }
});

// ========================================
// GET /api/jobs/:job_id/status
// ジョブステータス確認
// ========================================
app.get('/:job_id/status', requireAuth, async (c) => {
  const { env } = c;
  const jobId = c.req.param('job_id');

  const awsApiBase = env.AWS_JOB_API_BASE_URL;
  if (!awsApiBase) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'AWS API endpoint not configured' },
    }, 503);
  }

  try {
    // 内部JWT発行
    const internalToken = await signInternalJWT({
      service: 'cloudflare-api',
      action: 'job:status',
      job_id: jobId,
    }, env);

    // AWS API Gatewayにプロキシ
    const awsResponse = await fetch(`${awsApiBase}/jobs/${jobId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
      },
    });

    const awsData = await awsResponse.json().catch(() => ({})) as { success?: boolean; data?: Record<string, unknown>; error?: unknown };

    if (!awsResponse.ok) {
      return c.json({
        success: false,
        error: { code: 'AWS_ERROR', message: 'Failed to get job status', details: awsData },
      }, awsResponse.status as 400 | 401 | 403 | 404 | 500);
    }

    return c.json({
      success: true,
      data: awsData.data,
    });

  } catch (error) {
    console.error('[Jobs] Status error:', error);
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal error' },
    }, 500);
  }
});

// ========================================
// POST /api/jobs/subsidies/:subsidy_id/ingest
// 補助金ID指定でのジョブ投入（ショートカット）
// ========================================
app.post('/subsidies/:subsidy_id/ingest', requireAuth, async (c) => {
  const { env } = c;
  const user = c.get('user');
  const subsidyId = c.req.param('subsidy_id');

  const awsApiBase = env.AWS_JOB_API_BASE_URL;
  if (!awsApiBase) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'AWS API endpoint not configured' },
    }, 503);
  }

  // リクエストボディ（company_idのみ）
  interface ShortIngestRequest {
    company_id: string;
  }

  let body: ShortIngestRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, 400);
  }

  if (!body.company_id) {
    return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'company_id is required' } }, 400);
  }

  // 所属確認
  if (user) {
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const membership = await env.DB.prepare(`
      SELECT 1 FROM user_companies 
      WHERE user_id = ? AND company_id = ?
    `).bind(user.id, body.company_id).first();

    if (!membership) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this company' },
      }, 403);
    }
  }

  try {
    // 補助金の添付ファイル情報を取得（キャッシュから）
    // detail_json カラムを使用（raw_jsonが存在しない場合に対応）
    const subsidyCache = await env.DB.prepare(`
      SELECT detail_json FROM subsidy_cache WHERE id = ?
    `).bind(subsidyId).first<{ detail_json: string | null }>();

    let attachments: Array<{ id: string; filename: string; content_type: string; url: string }> = [];

    if (subsidyCache?.detail_json) {
      try {
        const subsidyData = JSON.parse(subsidyCache.detail_json);
        // Jグランツの添付ファイル情報を抽出
        if (subsidyData.attachments && Array.isArray(subsidyData.attachments)) {
          attachments = subsidyData.attachments.map((att: any, index: number) => ({
            id: att.id || `att-${index}`,
            filename: att.filename || att.name || `attachment-${index}`,
            content_type: att.content_type || att.mime_type || 'application/octet-stream',
            url: att.url || att.download_url || '',
          })).filter((att: any) => att.url);
        }
      } catch {
        console.warn('[Jobs] Failed to parse subsidy cache JSON');
      }
    }

    // 内部JWT発行
    const internalToken = await signInternalJWT({
      service: 'cloudflare-api',
      action: 'job:submit',
      subsidy_id: subsidyId,
      company_id: body.company_id,
    }, env);

    // AWS API Gatewayにプロキシ
    const awsResponse = await fetch(`${awsApiBase}/jobs/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subsidy_id: subsidyId,
        company_id: body.company_id,
        attachments: attachments,
        user_id: user?.id,
      }),
    });

    const awsData = await awsResponse.json().catch(() => ({})) as { success?: boolean; data?: Record<string, unknown>; error?: unknown };

    if (!awsResponse.ok) {
      console.error('[Jobs] AWS API error:', awsResponse.status, awsData);
      return c.json({
        success: false,
        error: { code: 'AWS_ERROR', message: 'Failed to submit job to AWS', details: awsData },
      }, awsResponse.status as 400 | 401 | 403 | 404 | 500);
    }

    return c.json({
      success: true,
      data: {
        ...awsData.data,
        attachments_found: attachments.length,
      },
    }, 202);

  } catch (error) {
    console.error('[Jobs] Subsidy ingest error:', error);
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal error' },
    }, 500);
  }
});

export default app;

/**
 * Admin Dashboard: フィード障害管理
 * 
 * GET /feed-failures                - 障害一覧
 * POST /feed-failures/:id/resolve   - 障害解決
 * POST /feed-failures/:id/ignore    - 障害無視
 * GET /active-failures-csv          - アクティブ障害CSV
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../../middleware/auth';

const feedFailures = new Hono<{ Bindings: Env; Variables: Variables }>();

feedFailures.get('/feed-failures', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const status = c.req.query('status') || 'open';
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);

    // 集計
    const summary = await db.prepare(`
      SELECT 
        source_id,
        stage,
        error_type,
        COUNT(*) as count
      FROM feed_failures
      WHERE status = ?
      GROUP BY source_id, stage, error_type
      ORDER BY count DESC
    `).bind(status).all<{
      source_id: string;
      stage: string;
      error_type: string;
      count: number;
    }>();

    // 個別の失敗（最新順）
    const failures = await db.prepare(`
      SELECT 
        id,
        source_id,
        url,
        stage,
        error_type,
        error_message,
        http_status,
        dedupe_key,
        subsidy_id,
        cron_run_id,
        occurred_at,
        retry_count,
        status
      FROM feed_failures
      WHERE status = ?
      ORDER BY occurred_at DESC
      LIMIT ?
    `).bind(status, limit).all<{
      id: string;
      source_id: string;
      url: string;
      stage: string;
      error_type: string;
      error_message: string;
      http_status: number | null;
      dedupe_key: string | null;
      subsidy_id: string | null;
      cron_run_id: string | null;
      occurred_at: string;
      retry_count: number;
      status: string;
    }>();

    // 全体の未解決件数
    const totalOpen = await db.prepare(`
      SELECT COUNT(*) as count FROM feed_failures WHERE status = 'open'
    `).first<{ count: number }>();

    return c.json<ApiResponse<{
      total_open: number;
      summary: Array<{
        source_id: string;
        stage: string;
        error_type: string;
        count: number;
      }>;
      failures: Array<{
        id: string;
        source_id: string;
        url: string;
        stage: string;
        error_type: string;
        error_message: string;
        http_status: number | null;
        dedupe_key: string | null;
        subsidy_id: string | null;
        cron_run_id: string | null;
        occurred_at: string;
        retry_count: number;
        status: string;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        total_open: totalOpen?.count || 0,
        summary: summary.results || [],
        failures: failures.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Feed failures error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FEED_FAILURES_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/feed-failures/:id/resolve
 * 
 * 失敗を解決済みにマーク
 */
feedFailures.post('/feed-failures/:id/resolve', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json<{ notes?: string }>().catch(() => ({}));

  try {
    await db.prepare(`
      UPDATE feed_failures SET
        status = 'resolved',
        resolution_notes = ?,
        resolved_at = datetime('now'),
        resolved_by = ?
      WHERE id = ?
    `).bind(body.notes || null, user.email, id).run();

    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: 'Failure marked as resolved' },
    });
  } catch (error) {
    console.error('Resolve failure error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'RESOLVE_FAILURE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/feed-failures/:id/ignore
 * 
 * 失敗を無視（対応不要）にマーク
 */
feedFailures.post('/feed-failures/:id/ignore', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json<{ notes?: string }>().catch(() => ({}));

  try {
    await db.prepare(`
      UPDATE feed_failures SET
        status = 'ignored',
        resolution_notes = ?,
        resolved_at = datetime('now'),
        resolved_by = ?
      WHERE id = ?
    `).bind(body.notes || null, user.email, id).run();

    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: { message: 'Failure marked as ignored' },
    });
  } catch (error) {
    console.error('Ignore failure error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'IGNORE_FAILURE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/active-failures-csv
 * 
 * Active（受付中）案件の収集失敗CSV出力
 * 
 * 仕様（2026-01-27確定）:
 * - Active only（acceptance_end_datetime IS NOT NULL AND > now）
 * - stage（enrich / base64_save / pdf_extract / openai_extract）
 * - missing（pdf_urls_empty / base64_missing / extracted_text_empty / eligible_expenses_missing）
 * - hypothesis（SPA / 添付なし / ロゴPDF / 交付申請 / 画像PDF / OCR必要）
 */
feedFailures.get('/active-failures-csv', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }
  
  try {
    // Active + Not Ready の案件を取得（失敗候補）
    const results = await db.prepare(`
      SELECT 
        sc.id as subsidy_id,
        sc.title,
        sc.source,
        sc.acceptance_end_datetime as active_deadline,
        sc.wall_chat_ready,
        sc.detail_json,
        eq.job_type as last_job_type,
        eq.status as queue_status,
        eq.attempts,
        eq.last_error,
        eq.updated_at as last_attempt_at
      FROM subsidy_cache sc
      LEFT JOIN extraction_queue eq ON sc.id = eq.subsidy_id
      WHERE sc.source = 'jgrants'
        AND sc.acceptance_end_datetime IS NOT NULL
        AND sc.acceptance_end_datetime > datetime('now')
        AND sc.wall_chat_ready = 0
      ORDER BY sc.acceptance_end_datetime ASC
      LIMIT 1000
    `).all<{
      subsidy_id: string;
      title: string;
      source: string;
      active_deadline: string;
      wall_chat_ready: number;
      detail_json: string | null;
      last_job_type: string | null;
      queue_status: string | null;
      attempts: number | null;
      last_error: string | null;
      last_attempt_at: string | null;
    }>();
    
    // CSVデータ生成
    const csvRows: string[] = [];
    csvRows.push([
      'subsidy_id',
      'title',
      'source',
      'active_deadline',
      'stage',
      'missing',
      'target_url',
      'error_code',
      'error_message',
      'hypothesis',
      'attempts',
      'last_attempt_at',
    ].join(','));
    
    for (const row of results.results || []) {
      let detailJson: any = {};
      try {
        detailJson = row.detail_json ? JSON.parse(row.detail_json) : {};
      } catch {
        // ignore
      }
      
      // Stage判定
      let stage = 'enrich';
      if (detailJson.enriched_version === 'v2') {
        if (detailJson.base64_processed) {
          stage = 'pdf_extract';
        } else if (detailJson.pdf_urls && detailJson.pdf_urls.length > 0) {
          stage = 'pdf_extract';
        } else {
          stage = 'base64_save';
        }
      }
      if (row.queue_status === 'done' && !detailJson.eligible_expenses) {
        stage = 'openai_extract';
      }
      
      // Missing判定
      const missing: string[] = [];
      if (!detailJson.pdf_urls || detailJson.pdf_urls.length === 0) missing.push('pdf_urls_empty');
      if (detailJson.base64_no_data) missing.push('base64_missing');
      if (!detailJson.extracted_pdf_text) missing.push('extracted_text_empty');
      if (!detailJson.eligible_expenses) missing.push('eligible_expenses_missing');
      if (!detailJson.application_requirements || detailJson.application_requirements.length === 0) missing.push('application_requirements_missing');
      
      // Hypothesis判定
      const hypothesis: string[] = [];
      if (detailJson.base64_no_data && !detailJson.pdf_urls?.length) hypothesis.push('添付なし');
      if (detailJson.related_url?.includes('jgrants-portal.go.jp')) hypothesis.push('SPA');
      if (detailJson.wall_chat_excluded) hypothesis.push(detailJson.wall_chat_excluded_reason || '除外対象');
      if (row.last_error?.includes('timeout')) hypothesis.push('タイムアウト');
      if (row.last_error?.includes('OCR')) hypothesis.push('OCR必要');
      
      // Target URL
      const targetUrl = detailJson.related_url || detailJson.reference_urls?.[0] || '';
      
      // エスケープ処理
      const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      
      csvRows.push([
        escape(row.subsidy_id),
        escape(row.title),
        escape(row.source),
        escape(row.active_deadline),
        escape(stage),
        escape(missing.join(';')),
        escape(targetUrl),
        escape(row.last_error?.split(':')[0] || ''),
        escape((row.last_error || '').substring(0, 200)),
        escape(hypothesis.join(';')),
        String(row.attempts || 0),
        escape(row.last_attempt_at || ''),
      ].join(','));
    }
    
    const csv = csvRows.join('\n');
    
    // CSVダウンロードとして返す
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="active-failures-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    
  } catch (error) {
    console.error('Active failures CSV error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ACTIVE_FAILURES_CSV_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/wall-chat-status
 * 
 * WALL_CHAT_READY の状況サマリー
 */

export default feedFailures;

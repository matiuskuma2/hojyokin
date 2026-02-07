/**
 * Knowledge Pipeline - ライフサイクル管理 + 必要書類
 * 
 * GET  /lifecycle/:subsidy_id   - ライフサイクル取得
 * POST /lifecycle/:subsidy_id   - ライフサイクル更新
 * GET  /lifecycle/due           - 期限切れ一覧
 * GET  /documents-master        - 書類マスター
 * GET  /documents/:subsidy_id   - 補助金別書類
 * POST /documents/:subsidy_id   - 書類登録
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth } from '../../middleware/auth';

const lifecycle = new Hono<{ Bindings: Env; Variables: Variables }>();

lifecycle.get('/lifecycle/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    const lifecycle = await DB.prepare(`
      SELECT * FROM subsidy_lifecycle WHERE subsidy_id = ?
    `).bind(subsidy_id).first();

    if (!lifecycle) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lifecycle not found for this subsidy' }
      }, 404);
    }

    // 履歴も取得
    const history = await DB.prepare(`
      SELECT * FROM subsidy_status_history 
      WHERE subsidy_id = ? 
      ORDER BY changed_at DESC 
      LIMIT 10
    `).bind(subsidy_id).all();

    return c.json<ApiResponse<{ lifecycle: unknown; history: unknown[] }>>({
      success: true,
      data: {
        lifecycle,
        history: history.results || []
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/lifecycle/:subsidy_id
 * ライフサイクルを更新または作成
 */
lifecycle.post('/lifecycle/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    const body = await c.req.json<{
      status?: LifecycleStatus;
      open_at?: string;
      close_at?: string;
      priority?: number;
      check_frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
      close_reason?: string;
      evidence_url?: string;
      evidence_quote?: string;
    }>();

    // 現在の状態を取得
    const current = await DB.prepare(`
      SELECT status FROM subsidy_lifecycle WHERE subsidy_id = ?
    `).bind(subsidy_id).first<{ status: string }>();

    const prevStatus = current?.status || null;
    const newStatus = body.status || 'unknown';

    // next_check_atを計算
    const nextCheckAt = computeNextCheckAt(newStatus, body.priority || 3);

    // UPSERTでライフサイクルを更新
    await DB.prepare(`
      INSERT INTO subsidy_lifecycle (
        subsidy_id, status, open_at, close_at, close_reason,
        budget_close_evidence_url, budget_close_evidence_quote,
        last_checked_at, next_check_at, check_frequency, priority,
        updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(subsidy_id) DO UPDATE SET
        status = excluded.status,
        open_at = COALESCE(excluded.open_at, open_at),
        close_at = COALESCE(excluded.close_at, close_at),
        close_reason = excluded.close_reason,
        budget_close_evidence_url = excluded.budget_close_evidence_url,
        budget_close_evidence_quote = excluded.budget_close_evidence_quote,
        last_checked_at = datetime('now'),
        next_check_at = excluded.next_check_at,
        check_frequency = excluded.check_frequency,
        priority = excluded.priority,
        updated_at = datetime('now')
    `).bind(
      subsidy_id,
      newStatus,
      body.open_at || null,
      body.close_at || null,
      body.close_reason || null,
      body.evidence_url || null,
      body.evidence_quote || null,
      nextCheckAt,
      body.check_frequency || 'weekly',
      body.priority || 3
    ).run();

    // 状態変化があれば履歴に記録
    if (prevStatus !== newStatus) {
      const historyId = crypto.randomUUID();
      await DB.prepare(`
        INSERT INTO subsidy_status_history (
          id, subsidy_id, prev_status, new_status, reason,
          evidence_url, evidence_quote, changed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'api')
      `).bind(
        historyId,
        subsidy_id,
        prevStatus,
        newStatus,
        body.close_reason || null,
        body.evidence_url || null,
        body.evidence_quote || null
      ).run();
    }

    return c.json<ApiResponse<{ subsidy_id: string; status: string; next_check_at: string }>>({
      success: true,
      data: {
        subsidy_id,
        status: newStatus,
        next_check_at: nextCheckAt
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * next_check_at を計算（status × priority）
 */
function computeNextCheckAt(status: string, priority: number): string {
  const now = new Date();
  let hoursToAdd: number;

  switch (status) {
    case 'closing_soon':
      hoursToAdd = 1; // 1時間後
      break;
    case 'open':
      hoursToAdd = priority <= 2 ? 24 : 168; // 優先度高=daily, 低=weekly
      break;
    case 'unknown':
      hoursToAdd = priority <= 2 ? 24 : 168;
      break;
    case 'scheduled':
      hoursToAdd = priority <= 2 ? 168 : 720; // weekly or monthly
      break;
    case 'closed_by_deadline':
    case 'closed_by_budget':
    case 'suspended':
      hoursToAdd = 720; // monthly（次回予告拾い用）
      break;
    default:
      hoursToAdd = 168; // weekly
  }

  now.setHours(now.getHours() + hoursToAdd);
  return now.toISOString();
}

/**
 * GET /knowledge/lifecycle/due
 * チェック期限が来たsubsidyを取得（Cron用）
 */
lifecycle.get('/lifecycle/due', requireAuth, async (c) => {
  const { DB } = c.env;
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const due = await DB.prepare(`
      SELECT sl.*, sm.title 
      FROM subsidy_lifecycle sl
      LEFT JOIN subsidy_metadata sm ON sl.subsidy_id = sm.subsidy_id
      WHERE sl.next_check_at IS NULL OR sl.next_check_at <= datetime('now')
      ORDER BY sl.priority ASC, sl.next_check_at ASC
      LIMIT ?
    `).bind(limit).all();

    return c.json<ApiResponse<{ subsidies: unknown[]; count: number }>>({
      success: true,
      data: {
        subsidies: due.results || [],
        count: due.results?.length || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

// =============================================================================
// K2: Required Documents APIs
// =============================================================================

/**
 * GET /knowledge/documents-master
 * 必要書類マスター一覧を取得
 */
lifecycle.get('/documents-master', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const docs = await DB.prepare(`
      SELECT * FROM required_documents_master ORDER BY sort_order, doc_code
    `).all();

    return c.json<ApiResponse<{ documents: unknown[]; count: number }>>({
      success: true,
      data: {
        documents: docs.results || [],
        count: docs.results?.length || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/documents/:subsidy_id
 * 制度固有の必要書類一覧を取得
 */
lifecycle.get('/documents/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    // マスターと制度固有をJOINして取得
    const docs = await DB.prepare(`
      SELECT 
        m.doc_code,
        m.name,
        m.phase,
        m.description,
        COALESCE(s.required_level, m.default_required_level) as required_level,
        s.notes,
        s.source_url,
        s.source_quote,
        s.confidence,
        s.needs_review
      FROM required_documents_master m
      LEFT JOIN required_documents_by_subsidy s 
        ON m.doc_code = s.doc_code AND s.subsidy_id = ?
      ORDER BY m.sort_order, m.doc_code
    `).bind(subsidy_id).all();

    return c.json<ApiResponse<{ subsidy_id: string; documents: unknown[] }>>({
      success: true,
      data: {
        subsidy_id,
        documents: docs.results || []
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/documents/:subsidy_id
 * 制度の必要書類を更新
 */
lifecycle.post('/documents/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    const body = await c.req.json<{
      documents: Array<{
        doc_code: string;
        required_level: 'mandatory' | 'conditional' | 'optional';
        notes?: string;
        source_url?: string;
        source_quote?: string;
        confidence?: number;
      }>;
    }>();

    const results: string[] = [];
    
    for (const doc of body.documents) {
      const id = crypto.randomUUID();
      await DB.prepare(`
        INSERT INTO required_documents_by_subsidy (
          id, subsidy_id, doc_code, required_level, notes,
          source_url, source_quote, confidence, needs_review
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subsidy_id, doc_code) DO UPDATE SET
          required_level = excluded.required_level,
          notes = excluded.notes,
          source_url = excluded.source_url,
          source_quote = excluded.source_quote,
          confidence = excluded.confidence,
          needs_review = excluded.needs_review,
          updated_at = datetime('now')
      `).bind(
        id,
        subsidy_id,
        doc.doc_code,
        doc.required_level,
        doc.notes || null,
        doc.source_url || null,
        doc.source_quote || null,
        doc.confidence || 0.5,
        (doc.confidence || 0.5) < 0.7 ? 1 : 0  // 確信度低いとneeds_review
      ).run();
      
      results.push(doc.doc_code);
    }

    return c.json<ApiResponse<{ subsidy_id: string; updated: string[] }>>({
      success: true,
      data: {
        subsidy_id,
        updated: results
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});



export default lifecycle;

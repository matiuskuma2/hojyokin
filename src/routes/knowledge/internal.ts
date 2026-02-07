/**
 * Knowledge Pipeline - Internal API (Cron Jobs)
 * 
 * POST /internal/sync-jgrants       - JGrants同期（内部）
 * GET  /raw/:subsidy_id/:url_hash   - 原文取得
 * GET  /structured/:subsidy_id/:url_hash - 構造化データ取得
 * GET  /domains                     - ドメイン一覧
 * POST /domains/:domain_key/toggle  - ドメイン切り替え
 * POST /internal/process-queue      - キュー処理（内部）
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { internalAuthMiddleware } from '../../lib/internal-jwt';
import { getRawFromR2, getStructuredFromR2 } from './_helpers';

const internal = new Hono<{ Bindings: Env; Variables: Variables }>();

internal.post('/internal/sync-jgrants', internalAuthMiddleware(['knowledge:sync']), async (c) => {
  const { DB } = c.env;
  
  // TODO: JGrants APIから最新データを取得して差分検知
  // Phase K2で実装予定
  
  return c.json<ApiResponse<{ message: string }>>({
    success: true,
    data: {
      message: 'JGrants sync not yet implemented - Phase K2'
    }
  });
});

/**
 * GET /knowledge/raw/:subsidy_id/:url_hash
 * R2からMarkdown原文を取得（壁打ちBot用）
 */
internal.get('/raw/:subsidy_id/:url_hash', requireAuth, async (c) => {
  const { subsidy_id, url_hash } = c.req.param();
  const { R2_KNOWLEDGE, DB } = c.env;

  if (!R2_KNOWLEDGE) {
    // R2が無い場合はD1から取得を試みる
    try {
      const doc = await DB.prepare(`
        SELECT raw_markdown FROM doc_object 
        WHERE subsidy_id = ? AND storage_backend = 'd1_inline'
        LIMIT 1
      `).bind(subsidy_id).first<{ raw_markdown?: string }>();
      
      if (doc?.raw_markdown) {
        return c.text(doc.raw_markdown, 200, {
          'Content-Type': 'text/markdown; charset=utf-8'
        });
      }
    } catch {
      // テーブル/カラムが無い場合は無視
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_NOT_CONFIGURED', message: 'R2 storage is not configured' }
    }, 500);
  }

  try {
    const markdown = await getRawFromR2(R2_KNOWLEDGE, subsidy_id, url_hash);
    
    if (!markdown) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Raw markdown not found' }
      }, 404);
    }

    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/structured/:subsidy_id/:url_hash
 * R2から構造化JSONを取得（壁打ちBot用）
 */
internal.get('/structured/:subsidy_id/:url_hash', requireAuth, async (c) => {
  const { subsidy_id, url_hash } = c.req.param();
  const { R2_KNOWLEDGE, DB } = c.env;

  if (!R2_KNOWLEDGE) {
    // R2が無い場合はD1から取得を試みる
    try {
      const doc = await DB.prepare(`
        SELECT structured_json FROM doc_object 
        WHERE subsidy_id = ? AND storage_backend = 'd1_inline'
        LIMIT 1
      `).bind(subsidy_id).first<{ structured_json?: string }>();
      
      if (doc?.structured_json) {
        return c.json(JSON.parse(doc.structured_json));
      }
    } catch {
      // テーブル/カラムが無い場合は無視
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_NOT_CONFIGURED', message: 'R2 storage is not configured' }
    }, 500);
  }

  try {
    const structured = await getStructuredFromR2(R2_KNOWLEDGE, subsidy_id, url_hash);
    
    if (!structured) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Structured JSON not found' }
      }, 404);
    }

    return c.json({
      success: true,
      data: structured
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/domains
 * ドメインポリシー一覧を取得（運用監視用）
 */
internal.get('/domains', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const domains = await DB.prepare(`
      SELECT 
        domain_key,
        enabled,
        success_count,
        failure_count,
        last_success_at,
        last_failure_at,
        last_error_code,
        notes
      FROM domain_policy
      ORDER BY failure_count DESC, domain_key ASC
    `).all();

    return c.json<ApiResponse<{ domains: unknown[]; count: number }>>({
      success: true,
      data: {
        domains: domains.results || [],
        count: domains.results?.length || 0
      }
    });
  } catch {
    // テーブルが無い場合は空を返す
    return c.json<ApiResponse<{ domains: unknown[]; count: number }>>({
      success: true,
      data: {
        domains: [],
        count: 0
      }
    });
  }
});

/**
 * POST /knowledge/domains/:domain_key/toggle
 * ドメインの有効/無効を切り替え
 */
internal.post('/domains/:domain_key/toggle', requireAuth, async (c) => {
  const { domain_key } = c.req.param();
  const { DB } = c.env;

  try {
    const result = await DB.prepare(`
      UPDATE domain_policy 
      SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END,
          updated_at = datetime('now')
      WHERE domain_key = ?
      RETURNING domain_key, enabled
    `).bind(domain_key).first<{ domain_key: string; enabled: number }>();

    if (!result) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Domain policy not found' }
      }, 404);
    }

    return c.json<ApiResponse<{ domain_key: string; enabled: boolean }>>({
      success: true,
      data: {
        domain_key: result.domain_key,
        enabled: result.enabled === 1
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
 * POST /knowledge/internal/process-queue
 * クロールキューを処理（Cron Trigger用）
 */
internal.post('/internal/process-queue', internalAuthMiddleware(['knowledge:process']), async (c) => {
  const { DB } = c.env;
  const batchSize = 10;
  
  try {
    // pending状態のURLを取得
    const pendingUrls = await DB.prepare(`
      SELECT * FROM source_url 
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).bind(batchSize).all<SourceUrl>();

    if (!pendingUrls.results || pendingUrls.results.length === 0) {
      return c.json<ApiResponse<{ processed: number; message: string }>>({
        success: true,
        data: {
          processed: 0,
          message: 'No pending URLs in queue'
        }
      });
    }

    // TODO: Firecrawlでバッチ処理
    // 現時点ではカウントのみ返す
    
    return c.json<ApiResponse<{ pending_count: number; message: string }>>({
      success: true,
      data: {
        pending_count: pendingUrls.results.length,
        message: 'Queue processing not yet implemented - use /knowledge/crawl/:url_id for manual crawl'
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'QUEUE_ERROR', message: String(error) }
    }, 500);
  }
});



export default internal;

/**
 * Knowledge Pipeline - Source Registry
 * 
 * GET /registry     - レジストリ一覧
 * GET /registry/due - 期限切れレジストリ
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth } from '../../middleware/auth';

const registry = new Hono<{ Bindings: Env; Variables: Variables }>();

registry.get('/registry', requireAuth, async (c) => {
  const { DB } = c.env;
  const scope = c.req.query('scope');
  const enabled = c.req.query('enabled');

  try {
    let query = `SELECT * FROM source_registry WHERE 1=1`;
    const params: (string | number)[] = [];

    if (scope) {
      query += ` AND scope = ?`;
      params.push(scope);
    }
    if (enabled !== undefined) {
      query += ` AND enabled = ?`;
      params.push(enabled === 'true' ? 1 : 0);
    }

    query += ` ORDER BY priority ASC, scope, program_key`;

    const stmt = DB.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const registry = await bound.all();

    return c.json<ApiResponse<{ entries: unknown[]; count: number }>>({
      success: true,
      data: {
        entries: registry.results || [],
        count: registry.results?.length || 0
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
 * GET /knowledge/registry/due
 * クロール期限が来た台帳エントリを取得
 */
registry.get('/registry/due', requireAuth, async (c) => {
  const { DB } = c.env;
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const due = await DB.prepare(`
      SELECT sr.*, dp.enabled as domain_enabled
      FROM source_registry sr
      LEFT JOIN domain_policy dp ON sr.domain_key = dp.domain_key
      WHERE sr.enabled = 1
        AND (dp.enabled IS NULL OR dp.enabled = 1)
        AND (sr.next_crawl_at IS NULL OR sr.next_crawl_at <= datetime('now'))
      ORDER BY sr.priority ASC, sr.next_crawl_at ASC
      LIMIT ?
    `).bind(limit).all();

    return c.json<ApiResponse<{ entries: unknown[]; count: number }>>({
      success: true,
      data: {
        entries: due.results || [],
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

export default registry;

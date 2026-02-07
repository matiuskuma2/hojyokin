/**
 * Admin Dashboard: 抽出ログ・サマリー
 * 
 * GET /extraction-logs    - 抽出ログ一覧
 * GET /extraction-summary - 抽出サマリー
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';

const logsSummary = new Hono<{ Bindings: Env; Variables: Variables }>();

logsSummary.get('/extraction-logs', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin access required' },
    }, 403);
  }

  const db = c.env.DB;
  
  // クエリパラメータ
  const method = c.req.query('method');       // 'html' | 'firecrawl' | 'vision_ocr' | null (all)
  const source = c.req.query('source');       // 'tokyo-shigoto' | 'jgrants' | etc.
  const success = c.req.query('success');     // '1' | '0' | null (all)
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // --- 1. ログ一覧取得 ---
    let query = `
      SELECT 
        id, subsidy_id, source, title, url, url_type, extraction_method,
        success, text_length, forms_count, fields_count,
        ocr_pages_processed, ocr_estimated_cost,
        failure_reason, failure_message, content_hash,
        cron_run_id, processing_time_ms, created_at
      FROM extraction_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (method) {
      query += ` AND extraction_method = ?`;
      params.push(method);
    }
    if (source) {
      query += ` AND source = ?`;
      params.push(source);
    }
    if (success !== null && success !== undefined) {
      query += ` AND success = ?`;
      params.push(parseInt(success));
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const logs = await db.prepare(query).bind(...params).all<{
      id: number;
      subsidy_id: string;
      source: string;
      title: string;
      url: string;
      url_type: string;
      extraction_method: string;
      success: number;
      text_length: number;
      forms_count: number;
      fields_count: number;
      ocr_pages_processed: number;
      ocr_estimated_cost: number;
      failure_reason: string | null;
      failure_message: string | null;
      content_hash: string | null;
      cron_run_id: string | null;
      processing_time_ms: number;
      created_at: string;
    }>();

    // --- 2. 集計データ取得 ---
    const summaryResult = await db.prepare(`
      SELECT 
        extraction_method,
        COUNT(*) as total,
        SUM(success) as success_count,
        SUM(ocr_pages_processed) as total_pages,
        SUM(ocr_estimated_cost) as total_cost,
        AVG(processing_time_ms) as avg_time_ms
      FROM extraction_logs
      GROUP BY extraction_method
    `).all<{
      extraction_method: string;
      total: number;
      success_count: number;
      total_pages: number;
      total_cost: number;
      avg_time_ms: number;
    }>();

    // --- 3. 日別OCRコスト ---
    const dailyOcrResult = await db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as ocr_calls,
        SUM(ocr_pages_processed) as total_pages,
        SUM(ocr_estimated_cost) as total_cost
      FROM extraction_logs 
      WHERE extraction_method = 'vision_ocr'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all<{
      date: string;
      ocr_calls: number;
      total_pages: number;
      total_cost: number;
    }>();

    // --- 4. 失敗理由の分布 ---
    const failureDistResult = await db.prepare(`
      SELECT 
        failure_reason,
        COUNT(*) as count
      FROM extraction_logs 
      WHERE success = 0 AND failure_reason IS NOT NULL
      GROUP BY failure_reason
      ORDER BY count DESC
    `).all<{
      failure_reason: string;
      count: number;
    }>();

    return c.json<ApiResponse<{
      logs: typeof logs.results;
      summary: {
        by_method: typeof summaryResult.results;
        daily_ocr: typeof dailyOcrResult.results;
        failure_distribution: typeof failureDistResult.results;
      };
      pagination: {
        limit: number;
        offset: number;
        has_more: boolean;
      };
    }>>({
      success: true,
      data: {
        logs: logs.results || [],
        summary: {
          by_method: summaryResult.results || [],
          daily_ocr: dailyOcrResult.results || [],
          failure_distribution: failureDistResult.results || [],
        },
        pagination: {
          limit,
          offset,
          has_more: (logs.results?.length || 0) === limit,
        },
      },
    });

  } catch (error) {
    console.error('Extraction logs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// =====================================================
// GET /api/admin-ops/extraction-summary
// 抽出サマリー（ダッシュボード用）
// super_admin専用
// =====================================================

logsSummary.get('/extraction-summary', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin access required' },
    }, 403);
  }

  const db = c.env.DB;

  try {
    // 今日の抽出統計
    const today = new Date().toISOString().slice(0, 10);
    
    const todayStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(success) as successful,
        SUM(CASE WHEN extraction_method = 'html' THEN 1 ELSE 0 END) as html_count,
        SUM(CASE WHEN extraction_method = 'firecrawl' THEN 1 ELSE 0 END) as firecrawl_count,
        SUM(CASE WHEN extraction_method = 'vision_ocr' THEN 1 ELSE 0 END) as ocr_count,
        SUM(ocr_pages_processed) as ocr_pages,
        SUM(ocr_estimated_cost) as ocr_cost,
        AVG(processing_time_ms) as avg_time
      FROM extraction_logs
      WHERE DATE(created_at) = ?
    `).bind(today).first<{
      total_extractions: number;
      successful: number;
      html_count: number;
      firecrawl_count: number;
      ocr_count: number;
      ocr_pages: number;
      ocr_cost: number;
      avg_time: number;
    }>();

    // 累計統計
    const totalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(success) as successful,
        SUM(ocr_pages_processed) as ocr_pages,
        SUM(ocr_estimated_cost) as ocr_cost
      FROM extraction_logs
    `).first<{
      total_extractions: number;
      successful: number;
      ocr_pages: number;
      ocr_cost: number;
    }>();

    return c.json<ApiResponse<{
      today: typeof todayStats;
      total: typeof totalStats;
    }>>({
      success: true,
      data: {
        today: todayStats,
        total: totalStats,
      },
    });

  } catch (error) {
    console.error('Extraction summary error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});



export default logsSummary;

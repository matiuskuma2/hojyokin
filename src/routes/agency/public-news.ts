/**
 * Agency: 公開APIエンドポイント（認証不要）
 * 
 * GET /public-news - 公開ニュースフィード
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';

const publicNews = new Hono<{ Bindings: Env; Variables: Variables }>();

publicNews.get('/public-news', async (c) => {
  const db = c.env.DB;
  
  const prefectureCode = c.req.query('prefecture') || null;
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
  
  try {
    let newsQuery;
    
    if (prefectureCode) {
      newsQuery = await db.prepare(`
        SELECT id, title, url, summary, 
               COALESCE(published_at, first_seen_at) as published_at, 
               first_seen_at as detected_at, 
               CASE 
                 WHEN first_seen_at >= datetime('now', '-7 days') THEN 'new'
                 WHEN status = 'closed' THEN 'closing'
                 ELSE 'info'
               END as event_type, 
               prefecture_code as region_prefecture, 
               issuer_name,
               subsidy_amount_max,
               subsidy_rate_text,
               status,
               source_type
        FROM subsidy_feed_items
        WHERE source_type IN ('prefecture', 'municipal', 'ministry')
        AND (prefecture_code = ? OR prefecture_code IS NULL)
        ORDER BY 
          CASE WHEN prefecture_code = ? THEN 0 ELSE 1 END,
          first_seen_at DESC
        LIMIT ?
      `).bind(prefectureCode, prefectureCode, limit).all();
    } else {
      newsQuery = await db.prepare(`
        SELECT id, title, url, summary, 
               COALESCE(published_at, first_seen_at) as published_at, 
               first_seen_at as detected_at, 
               CASE 
                 WHEN first_seen_at >= datetime('now', '-7 days') THEN 'new'
                 WHEN status = 'closed' THEN 'closing'
                 ELSE 'info'
               END as event_type, 
               prefecture_code as region_prefecture, 
               issuer_name,
               subsidy_amount_max,
               subsidy_rate_text,
               status,
               source_type
        FROM subsidy_feed_items
        WHERE source_type IN ('prefecture', 'municipal', 'ministry')
        ORDER BY first_seen_at DESC
        LIMIT ?
      `).bind(limit).all();
    }
    
    const items = (newsQuery.results || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      summary: n.summary,
      published_at: n.published_at,
      detected_at: n.detected_at,
      event_type: n.event_type,
      region_prefecture: n.region_prefecture,
      issuer_name: n.issuer_name,
      subsidy_amount_max: n.subsidy_amount_max,
      subsidy_rate_text: n.subsidy_rate_text,
      status: n.status,
      source_type: n.source_type,
    }));
    
    return c.json<ApiResponse<{
      items: typeof items;
      total: number;
      prefecture_filter: string | null;
      generated_at: string;
    }>>({
      success: true,
      data: {
        items,
        total: items.length,
        prefecture_filter: prefectureCode,
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('[public-news] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch news',
      },
    }, 500);
  }
});

// 全ルートで認証必須（public-news以外）

export default publicNews;

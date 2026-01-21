/**
 * 補助金ルート
 * 
 * GET /api/subsidies/search - 補助金検索（Jグランツ + スクリーニング）
 * GET /api/subsidies/:subsidy_id - 補助金詳細取得
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, Company, Subsidy, ApiResponse, MatchResult, SubsidySearchParams } from '../types';
import { requireAuth, requireCompanyAccess, getCurrentUser } from '../middleware/auth';
import { JGrantsClient, JGrantsError } from '../lib/jgrants';
import { performBatchScreening, sortByStatus, sortByScore } from '../lib/screening';

const subsidies = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
subsidies.use('/*', requireAuth);

// キャッシュ有効期限（秒）
const SEARCH_CACHE_TTL = 300;     // 5分
const DETAIL_CACHE_TTL = 3600;    // 1時間

/**
 * 検索条件からキャッシュキーを生成
 */
function generateCacheKey(params: Record<string, any>): string {
  const sorted = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return sorted;
}

/**
 * キャッシュキーのハッシュ化
 */
async function hashCacheKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

/**
 * 補助金検索（企業情報とマッチング）
 * 
 * Query Parameters:
 * - company_id: 企業ID（必須）
 * - keyword: キーワード
 * - acceptance: 受付中のみ (1) / すべて (0)
 * - sort: ソートキー (acceptance_end_datetime, subsidy_max_limit)
 * - order: ソート順 (ASC, DESC)
 * - limit: 取得件数（デフォルト: 20、最大: 100）
 * - offset: オフセット
 */
subsidies.get('/search', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  
  try {
    // クエリパラメータ取得
    const companyId = c.req.query('company_id');
    const keyword = c.req.query('keyword');
    const acceptance = c.req.query('acceptance') === '1' ? 1 : 0;
    const sort = c.req.query('sort') as SubsidySearchParams['sort'] || 'acceptance_end_datetime';
    const order = c.req.query('order') as 'ASC' | 'DESC' || 'ASC';
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    
    if (!companyId) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'company_id is required',
        },
      }, 400);
    }
    
    // 企業情報取得
    const company = await db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .bind(companyId)
      .first<Company>();
    
    if (!company) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Company not found',
        },
      }, 404);
    }
    
    // キャッシュキー生成
    const searchParams = {
      keyword,
      acceptance,
      target_area_search: company.prefecture,
      limit,
      offset,
      sort,
      order,
    };
    const cacheKey = generateCacheKey(searchParams);
    const cacheHash = await hashCacheKey(cacheKey);
    
    // キャッシュ確認
    const cached = await db
      .prepare(`
        SELECT result_json, total_count 
        FROM search_cache 
        WHERE query_hash = ? AND expires_at > datetime('now')
      `)
      .bind(cacheHash)
      .first<{ result_json: string; total_count: number }>();
    
    let jgrantsResults;
    let totalCount;
    
    if (cached) {
      // キャッシュヒット
      jgrantsResults = JSON.parse(cached.result_json);
      totalCount = cached.total_count;
    } else {
      // Jグランツ API 呼び出し
      const client = new JGrantsClient({
        baseUrl: c.env.JGRANTS_API_BASE_URL,
      });
      
      try {
        const response = await client.search({
          keyword,
          acceptance,
          target_area_search: company.prefecture,
          limit,
          offset,
          sort,
          order,
        });
        
        jgrantsResults = response.subsidies;
        totalCount = response.total_count;
        
        // キャッシュ保存
        const expiresAt = new Date(Date.now() + SEARCH_CACHE_TTL * 1000).toISOString();
        await db
          .prepare(`
            INSERT OR REPLACE INTO search_cache (id, query_hash, result_json, total_count, cached_at, expires_at)
            VALUES (?, ?, ?, ?, datetime('now'), ?)
          `)
          .bind(uuidv4(), cacheHash, JSON.stringify(jgrantsResults), totalCount, expiresAt)
          .run();
      } catch (error) {
        if (error instanceof JGrantsError) {
          console.error('JGrants API error:', error);
          return c.json<ApiResponse<null>>({
            success: false,
            error: {
              code: 'JGRANTS_ERROR',
              message: error.message,
            },
          }, error.statusCode >= 500 ? 502 : 400);
        }
        throw error;
      }
    }
    
    // スクリーニング実行
    const matchResults = performBatchScreening(company, jgrantsResults);
    
    // ステータスでソート（推奨 > 注意 > 非推奨）
    const sortedResults = sortByStatus(matchResults);
    
    // 評価結果をD1に保存（バッチ）
    const evaluationStatements = sortedResults.map(result => {
      const evalId = uuidv4();
      return db.prepare(`
        INSERT OR REPLACE INTO evaluation_runs 
        (id, company_id, subsidy_id, status, match_score, match_reasons, risk_flags, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        evalId,
        companyId,
        result.subsidy.id,
        result.evaluation.status,
        result.evaluation.score,
        JSON.stringify(result.evaluation.match_reasons),
        JSON.stringify(result.evaluation.risk_flags),
        result.evaluation.explanation
      );
    });
    
    // バッチ実行（並列で評価結果を保存）
    if (evaluationStatements.length > 0) {
      await db.batch(evaluationStatements);
    }
    
    return c.json<ApiResponse<MatchResult[]>>({
      success: true,
      data: sortedResults,
      meta: {
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        limit,
        has_more: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Search subsidies error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search subsidies',
      },
    }, 500);
  }
});

/**
 * 補助金詳細取得
 * 
 * Query Parameters:
 * - company_id: 企業ID（任意、指定時は評価結果も返す）
 */
subsidies.get('/:subsidy_id', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  const companyId = c.req.query('company_id');
  
  try {
    // キャッシュ確認
    const cached = await db
      .prepare(`
        SELECT * FROM subsidy_cache 
        WHERE id = ? AND expires_at > datetime('now')
      `)
      .bind(subsidyId)
      .first<Subsidy>();
    
    let subsidyDetail;
    
    if (cached && cached.detail_json) {
      // キャッシュヒット（詳細あり）
      subsidyDetail = JSON.parse(cached.detail_json);
    } else {
      // Jグランツ API 呼び出し
      const client = new JGrantsClient({
        baseUrl: c.env.JGRANTS_API_BASE_URL,
      });
      
      try {
        subsidyDetail = await client.getDetail(subsidyId);
        
        // キャッシュ保存
        const expiresAt = new Date(Date.now() + DETAIL_CACHE_TTL * 1000).toISOString();
        await db
          .prepare(`
            INSERT OR REPLACE INTO subsidy_cache 
            (id, source, title, subsidy_max_limit, subsidy_rate, 
             target_area_search, target_industry, target_number_of_employees,
             acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
             detail_json, cached_at, expires_at)
            VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
          `)
          .bind(
            subsidyId,
            subsidyDetail.title || '',
            subsidyDetail.subsidy_max_limit || null,
            subsidyDetail.subsidy_rate || null,
            subsidyDetail.target_area_search || null,
            subsidyDetail.target_industry || null,
            subsidyDetail.target_number_of_employees || null,
            subsidyDetail.acceptance_start_datetime || null,
            subsidyDetail.acceptance_end_datetime || null,
            subsidyDetail.request_reception_display_flag || 0,
            JSON.stringify(subsidyDetail),
            expiresAt
          )
          .run();
      } catch (error) {
        if (error instanceof JGrantsError) {
          if (error.statusCode === 404) {
            return c.json<ApiResponse<null>>({
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Subsidy not found',
              },
            }, 404);
          }
          console.error('JGrants API error:', error);
          return c.json<ApiResponse<null>>({
            success: false,
            error: {
              code: 'JGRANTS_ERROR',
              message: error.message,
            },
          }, error.statusCode >= 500 ? 502 : 400);
        }
        throw error;
      }
    }
    
    // 評価結果取得（company_id が指定されている場合）
    let evaluation = null;
    if (companyId) {
      const evalResult = await db
        .prepare(`
          SELECT status, match_score, match_reasons, risk_flags, explanation, created_at
          FROM evaluation_runs
          WHERE company_id = ? AND subsidy_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(companyId, subsidyId)
        .first();
      
      if (evalResult) {
        evaluation = {
          status: evalResult.status,
          score: evalResult.match_score,
          match_reasons: JSON.parse(evalResult.match_reasons as string || '[]'),
          risk_flags: JSON.parse(evalResult.risk_flags as string || '[]'),
          explanation: evalResult.explanation,
          evaluated_at: evalResult.created_at,
        };
      }
    }
    
    // 添付ファイルはメタ情報のみ返す（URLは返すがダウンロードは別ジョブ）
    const attachments = (subsidyDetail.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      file_type: a.file_type,
      file_size: a.file_size,
      // ダウンロード・変換・テキスト化はAWS側のジョブで行う
      status: 'not_processed',
    }));
    
    return c.json<ApiResponse<{
      subsidy: typeof subsidyDetail;
      attachments: typeof attachments;
      evaluation: typeof evaluation;
    }>>({
      success: true,
      data: {
        subsidy: subsidyDetail,
        attachments,
        evaluation,
      },
    });
  } catch (error) {
    console.error('Get subsidy detail error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get subsidy detail',
      },
    }, 500);
  }
});

/**
 * 評価結果一覧取得（特定企業の全評価）
 */
subsidies.get('/evaluations/:company_id', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('company_id');
  const status = c.req.query('status');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  
  try {
    let query = `
      SELECT 
        er.*,
        sc.title as subsidy_title,
        sc.subsidy_max_limit,
        sc.acceptance_end_datetime
      FROM evaluation_runs er
      LEFT JOIN subsidy_cache sc ON er.subsidy_id = sc.id
      WHERE er.company_id = ?
    `;
    const params: any[] = [companyId];
    
    if (status) {
      query += ' AND er.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY er.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await db
      .prepare(query)
      .bind(...params)
      .all();
    
    // カウント取得
    let countQuery = 'SELECT COUNT(*) as count FROM evaluation_runs WHERE company_id = ?';
    const countParams: any[] = [companyId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const countResult = await db
      .prepare(countQuery)
      .bind(...countParams)
      .first<{ count: number }>();
    
    const evaluations = (result.results || []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id,
      subsidy_id: row.subsidy_id,
      subsidy_title: row.subsidy_title,
      subsidy_max_limit: row.subsidy_max_limit,
      acceptance_end_datetime: row.acceptance_end_datetime,
      status: row.status,
      score: row.match_score,
      match_reasons: JSON.parse(row.match_reasons || '[]'),
      risk_flags: JSON.parse(row.risk_flags || '[]'),
      explanation: row.explanation,
      created_at: row.created_at,
    }));
    
    return c.json<ApiResponse<typeof evaluations>>({
      success: true,
      data: evaluations,
      meta: {
        total: countResult?.count || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        has_more: offset + limit < (countResult?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get evaluations error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get evaluations',
      },
    }, 500);
  }
});

export default subsidies;

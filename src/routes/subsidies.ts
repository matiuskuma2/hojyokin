/**
 * 補助金ルート（Adapter経由版）
 * 
 * GET /api/subsidies/search - 補助金検索（Jグランツ Adapter + スクリーニング）
 * GET /api/subsidies/:subsidy_id - 補助金詳細取得
 * GET /api/subsidies/evaluations/:company_id - 評価結果一覧
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, Company, Subsidy, ApiResponse, MatchResult, SubsidySearchParams } from '../types';
import { requireAuth, requireCompanyAccess, getCurrentUser } from '../middleware/auth';
import { createJGrantsAdapter, getJGrantsMode } from '../lib/jgrants-adapter';
import { JGrantsError } from '../lib/jgrants';
import { performBatchScreening, sortByStatus, sortByScore } from '../lib/screening';

const subsidies = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
subsidies.use('/*', requireAuth);

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
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 500);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    
    // P0-2-1: debug パラメータ（super_adminのみ有効）
    const debug = c.req.query('debug') === '1';
    const user = getCurrentUser(c);
    const allowUnready = (user?.role === 'super_admin') && debug;
    
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
    
    // Adapter経由で補助金検索
    const adapter = createJGrantsAdapter(c.env);
    const mode = getJGrantsMode(c.env);
    
    console.log(`JGrants Adapter mode: ${mode}, allowUnready: ${allowUnready}`);
    
    const searchResponse = await adapter.search({
      keyword,
      acceptance,
      target_area_search: company.prefecture,
      limit,
      offset,
      sort,
      order,
      includeUnready: allowUnready, // P0-2-1: super_admin debug時のみ未整備も含める
    });
    
    const jgrantsResults = searchResponse.subsidies;
    const totalCount = searchResponse.total_count;
    const source = searchResponse.source;
    
    // スクリーニング実行
    const matchResults = performBatchScreening(company, jgrantsResults);
    
    // ステータスでソート（推奨 > 注意 > 非推奨）
    const sortedResults = sortByStatus(matchResults);
    
    // === usage_events に検索イベントを必ず記録 ===
    // user は上で既に取得済み（P0-2-1 debug用）
    const eventId = uuidv4();
    try {
      await db.prepare(`
        INSERT INTO usage_events (
          id, user_id, company_id, event_type, provider, 
          tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
        ) VALUES (?, ?, ?, 'SUBSIDY_SEARCH', 'jgrants', 0, 0, 0, ?, datetime('now'))
      `).bind(
        eventId,
        user.id,
        companyId,
        JSON.stringify({
          keyword: keyword || null,
          acceptance,
          results_count: sortedResults.length,
          total_count: totalCount,
          source,
          proceed_count: sortedResults.filter(r => r.evaluation.status === 'PROCEED').length,
          caution_count: sortedResults.filter(r => r.evaluation.status === 'CAUTION').length,
          no_count: sortedResults.filter(r => r.evaluation.status === 'NO').length,
        })
      ).run();
    } catch (eventError) {
      // イベント記録失敗はログに出すが、検索自体は続行
      console.error('Failed to record search event:', eventError);
    }
    
    // 評価結果をD1に保存（バッチ）
    if (sortedResults.length > 0) {
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
        source, // データソース（live / mock / cache）
        gate: searchResponse.gate || 'searchable-only', // P0-2-1: 品質ゲート
      },
    });
  } catch (error) {
    console.error('Search subsidies error:', error);
    
    if (error instanceof JGrantsError) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'JGRANTS_ERROR',
          message: error.message,
        },
      }, error.statusCode >= 500 ? 502 : 400);
    }
    
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
    // Adapter経由で詳細取得
    const adapter = createJGrantsAdapter(c.env);
    
    const detailResponse = await adapter.getDetail(subsidyId);
    const subsidyDetail = detailResponse;
    const source = detailResponse.source;
    
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
      source: string;
      detail_ready: boolean;
      wall_chat_ready: boolean;
      wall_chat_missing: string[];
      detail_json?: Record<string, any> | null;
      required_forms?: typeof detailResponse.required_forms;
    }>>({
      success: true,
      data: {
        subsidy: subsidyDetail,
        attachments,
        evaluation,
        source,
        detail_ready: detailResponse.detail_ready, // P0-2-1: SEARCHABLE条件判定
        wall_chat_ready: detailResponse.wall_chat_ready ?? false, // WALL_CHAT_READY判定
        wall_chat_missing: detailResponse.wall_chat_missing || [], // 不足要素リスト
        detail_json: detailResponse.detail_json, // P3-2C: 様式情報含む詳細JSON
        required_forms: detailResponse.required_forms, // P3-2C: 必要様式
      },
    });
  } catch (error) {
    console.error('Get subsidy detail error:', error);
    
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
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'JGRANTS_ERROR',
          message: error.message,
        },
      }, error.statusCode >= 500 ? 502 : 400);
    }
    
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

/**
 * 補助金の申請要件取得
 */
subsidies.get('/:subsidy_id/eligibility', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  
  try {
    const rules = await db
      .prepare(`
        SELECT 
          id, subsidy_id, category, rule_text, check_type, 
          parameters, source_text, page_number, created_at
        FROM eligibility_rules
        WHERE subsidy_id = ?
        ORDER BY category, created_at
      `)
      .bind(subsidyId)
      .all();
    
    return c.json<ApiResponse<unknown[]>>({
      success: true,
      data: rules.results.map((rule: any) => ({
        ...rule,
        parameters: rule.parameters ? JSON.parse(rule.parameters) : null,
      })),
    });
  } catch (error) {
    console.error('Get eligibility rules error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get eligibility rules',
      },
    }, 500);
  }
});

/**
 * 補助金の必要書類取得
 */
subsidies.get('/:subsidy_id/documents', async (c) => {
  const db = c.env.DB;
  const subsidyId = c.req.param('subsidy_id');
  
  try {
    const docs = await db
      .prepare(`
        SELECT 
          rds.id, rds.subsidy_id, rds.doc_code, rds.required_level,
          rds.notes, rds.confidence, rds.needs_review,
          rdm.name, rdm.phase, rdm.description, rdm.sort_order
        FROM required_documents_by_subsidy rds
        LEFT JOIN required_documents_master rdm ON rds.doc_code = rdm.doc_code
        WHERE rds.subsidy_id = ?
        ORDER BY rdm.sort_order, rds.doc_code
      `)
      .bind(subsidyId)
      .all();
    
    return c.json<ApiResponse<unknown[]>>({
      success: true,
      data: docs.results,
    });
  } catch (error) {
    console.error('Get required documents error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get required documents',
      },
    }, 500);
  }
});

export default subsidies;

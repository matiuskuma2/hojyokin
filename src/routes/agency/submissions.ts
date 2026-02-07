/**
 * Agency: 入力受付（サブミッション）管理
 * 
 * GET  /submissions             - 入力受付一覧
 * POST /submissions/:id/approve - 入力承認
 * POST /submissions/:id/reject  - 入力却下
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, safeParseJsonBody, calculateEmployeeBand } from './_helpers';

const submissions = new Hono<{ Bindings: Env; Variables: Variables }>();

submissions.get('/submissions', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const { status } = c.req.query();
  
  let query = `
    SELECT is2.*, ac.client_name, c.name as company_name
    FROM intake_submissions is2
    JOIN agency_clients ac ON is2.company_id = ac.company_id AND is2.agency_id = ac.agency_id
    JOIN companies c ON is2.company_id = c.id
    WHERE is2.agency_id = ?
  `;
  const params: any[] = [agencyInfo.agency.id];
  
  if (status) {
    query += ' AND is2.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY is2.created_at DESC LIMIT 100';
  
  const submissions = await db.prepare(query).bind(...params).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { submissions: submissions?.results || [] },
  });
});

/**
 * POST /api/agency/submissions/:id/approve - 入力承認（会社情報に反映）
 */
submissions.post('/submissions/:id/approve', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const submissionId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const submission = await db.prepare(`
    SELECT * FROM intake_submissions WHERE id = ? AND agency_id = ?
  `).bind(submissionId, agencyInfo.agency.id).first<any>();
  
  if (!submission) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Submission not found' },
    }, 404);
  }
  
  if (submission.status !== 'submitted') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Submission already processed' },
    }, 400);
  }
  
  const now = new Date().toISOString();
  
  // payload_json のパース（DBからの値だが念のため try-catch）
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(submission.payload_json || '{}');
  } catch (e) {
    console.error('Failed to parse payload_json:', e);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'PARSE_ERROR', message: 'Failed to parse submission data' },
    }, 500);
  }
  
  // ========================================
  // 凍結仕様v1: intake承認時のバリデーション
  // 必須4項目は必ず有効値である必要がある
  // ========================================
  
  // payloadから必要な値を取得（キー名揺れに対応）
  const nameValue = payload.name || payload.companyName;
  const prefectureValue = payload.prefecture;
  const industryValue = payload.industry || payload.industry_major;
  const employeeValue = payload.employee_count || payload.employeeCount;
  
  // 必須項目バリデーション（フィールド別エラー）
  const fieldErrors: Record<string, string> = {};
  
  // 会社名チェック
  if (nameValue !== undefined && (typeof nameValue !== 'string' || !nameValue.trim())) {
    fieldErrors.name = '会社名は空にできません';
  }
  
  // 都道府県チェック
  if (prefectureValue !== undefined && (typeof prefectureValue !== 'string' || !prefectureValue.trim())) {
    fieldErrors.prefecture = '都道府県は空にできません';
  }
  
  // 業種チェック
  if (industryValue !== undefined && (typeof industryValue !== 'string' || !industryValue.trim())) {
    fieldErrors.industry_major = '業種は空にできません';
  }
  
  // 従業員数チェック（凍結仕様: 数値 > 0 必須）
  if (employeeValue !== undefined) {
    const count = typeof employeeValue === 'string' 
      ? parseInt(employeeValue, 10) 
      : employeeValue;
    
    if (typeof count !== 'number' || isNaN(count) || count <= 0) {
      fieldErrors.employee_count = '従業員数は1以上の数値で入力してください';
    } else {
      // 正規化された値をpayloadに設定
      payload.employee_count = count;
      payload.employeeCount = count;
    }
  }
  
  // 資本金チェック（任意だが設定時は0以上）
  const capitalValue = payload.capital;
  if (capitalValue !== undefined && capitalValue !== null) {
    const capital = typeof capitalValue === 'string'
      ? parseInt(capitalValue, 10)
      : capitalValue;
    
    if (typeof capital !== 'number' || isNaN(capital) || capital < 0) {
      fieldErrors.capital = '資本金は0以上の数値で入力してください';
    } else {
      payload.capital = capital;
    }
  }
  
  // 年商チェック（任意だが設定時は0以上）
  const revenueValue = payload.annual_revenue || payload.annualRevenue;
  if (revenueValue !== undefined && revenueValue !== null) {
    const revenue = typeof revenueValue === 'string'
      ? parseInt(revenueValue, 10)
      : revenueValue;
    
    if (typeof revenue !== 'number' || isNaN(revenue) || revenue < 0) {
      fieldErrors.annual_revenue = '年商は0以上の数値で入力してください';
    } else {
      payload.annual_revenue = revenue;
      payload.annualRevenue = revenue;
    }
  }
  
  // バリデーションエラーがあれば承認を拒否
  if (Object.keys(fieldErrors).length > 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力データに問題があります。修正してから再度承認してください',
        fields: fieldErrors,
      },
    }, 400);
  }
  
  // 会社情報を更新（companiesテーブル）
  if (Object.keys(payload).length > 0) {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    // companiesテーブルの許可フィールド（カラム名マッピング）
    const fieldMapping: Record<string, string> = {
      'name': 'name',
      'companyName': 'name',
      'prefecture': 'prefecture',
      'city': 'city',
      'industry': 'industry_major',
      'industry_major': 'industry_major',
      'industry_minor': 'industry_minor',
      'employee_count': 'employee_count',
      'employeeCount': 'employee_count',
      'capital': 'capital',
      'founded_date': 'established_date',
      'establishedDate': 'established_date',
      'annual_revenue': 'annual_revenue',
      'annualRevenue': 'annual_revenue',
    };
    
    const processedFields = new Set<string>();
    for (const [payloadKey, dbField] of Object.entries(fieldMapping)) {
      if (payload[payloadKey] !== undefined && !processedFields.has(dbField)) {
        updateFields.push(`${dbField} = ?`);
        updateValues.push(payload[payloadKey]);
        processedFields.add(dbField);
      }
    }
    
    // P1-2: employee_count が更新される場合は employee_band も自動計算
    if (processedFields.has('employee_count')) {
      const empCount = payload.employee_count || payload.employeeCount || 0;
      updateFields.push('employee_band = ?');
      updateValues.push(calculateEmployeeBand(empCount));
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(now);
      updateValues.push(submission.company_id);
      
      await db.prepare(`
        UPDATE companies SET ${updateFields.join(', ')} WHERE id = ?
      `).bind(...updateValues).run();
    }
    
    // company_profileテーブルも更新（存在する場合）
    const profileFieldMapping: Record<string, string> = {
      'representative_name': 'representative_name',
      'representativeName': 'representative_name',
      'representative_title': 'representative_title',
      'representativeTitle': 'representative_title',
      'website_url': 'website_url',
      'websiteUrl': 'website_url',
      'contact_email': 'contact_email',
      'contactEmail': 'contact_email',
      'contact_phone': 'contact_phone',
      'contactPhone': 'contact_phone',
      'business_summary': 'business_summary',
      'businessSummary': 'business_summary',
      'main_products': 'main_products',
      'mainProducts': 'main_products',
      'main_customers': 'main_customers',
      'mainCustomers': 'main_customers',
      'competitive_advantage': 'competitive_advantage',
      'competitiveAdvantage': 'competitive_advantage',
    };
    
    const profileUpdateFields: string[] = [];
    const profileUpdateValues: any[] = [];
    const processedProfileFields = new Set<string>();
    
    for (const [payloadKey, dbField] of Object.entries(profileFieldMapping)) {
      if (payload[payloadKey] !== undefined && !processedProfileFields.has(dbField)) {
        profileUpdateFields.push(`${dbField} = ?`);
        profileUpdateValues.push(payload[payloadKey]);
        processedProfileFields.add(dbField);
      }
    }
    
    if (profileUpdateFields.length > 0) {
      profileUpdateFields.push('updated_at = ?');
      profileUpdateValues.push(now);
      profileUpdateValues.push(submission.company_id);
      
      await db.prepare(`
        UPDATE company_profile SET ${profileUpdateFields.join(', ')} WHERE company_id = ?
      `).bind(...profileUpdateValues).run();
    }
  }
  
  // ステータス更新
  await db.prepare(`
    UPDATE intake_submissions SET status = 'approved', reviewed_at = ?, reviewed_by_user_id = ?
    WHERE id = ?
  `).bind(now, user.id, submissionId).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Approved and merged' },
  });
});

/**
 * POST /api/agency/submissions/:id/reject - 入力却下
 */
submissions.post('/submissions/:id/reject', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const submissionId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ reason?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { reason } = parseResult.data;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE intake_submissions SET status = 'rejected', reviewed_at = ?, reviewed_by_user_id = ?, review_notes = ?
    WHERE id = ? AND agency_id = ? AND status = 'submitted'
  `).bind(now, user.id, reason || null, submissionId, agencyInfo.agency.id).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Submission not found or already processed' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Rejected' },
  });
});


export default submissions;

/**
 * 企業ルート
 * 
 * GET    /api/companies - 企業一覧取得（自分が所属する企業）
 * POST   /api/companies - 企業作成
 * GET    /api/companies/:company_id - 企業詳細取得
 * PUT    /api/companies/:company_id - 企業更新
 * DELETE /api/companies/:company_id - 企業削除
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, Company, CompanyCreateInput, CompanyMembership, ApiResponse } from '../types';
import { requireAuth, requireCompanyAccess, getCurrentUser } from '../middleware/auth';

const companies = new Hono<{ Bindings: Env; Variables: Variables }>();

// 全ルートで認証必須
companies.use('/*', requireAuth);

/**
 * 従業員数から従業員帯を算出
 */
function calculateEmployeeBand(count: number): string {
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  if (count <= 100) return '51-100';
  if (count <= 300) return '101-300';
  return '301+';
}

/**
 * 企業一覧取得（自分が所属する企業）
 */
companies.get('/', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  try {
    // 所属企業を取得
    const result = await db
      .prepare(`
        SELECT 
          c.*,
          'owner' as membership_role
        FROM companies c
        INNER JOIN user_companies uc ON c.id = uc.company_id
        WHERE uc.user_id = ?
        ORDER BY c.created_at DESC
      `)
      .bind(user.id)
      .all<Company & { membership_role: string }>();
    
    return c.json<ApiResponse<Array<Company & { membership_role: string }>>>({
      success: true,
      data: result.results || [],
      meta: {
        total: result.results?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get companies error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get companies',
      },
    }, 500);
  }
});

/**
 * 企業作成
 */
companies.post('/', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  try {
    const body = await c.req.json<CompanyCreateInput>();
    
    // ========================================
    // 凍結仕様v1: 必須4項目のバリデーション
    // 1. 会社名 (name) - 空文字NG
    // 2. 都道府県 (prefecture) - 空文字NG
    // 3. 業種 (industry_major) - 空文字NG
    // 4. 従業員数 (employee_count) - 数値 > 0
    // ========================================
    const validationErrors: string[] = [];
    
    // 会社名チェック
    if (!body.name || (typeof body.name === 'string' && !body.name.trim())) {
      validationErrors.push('会社名は必須です');
    }
    
    // 都道府県チェック
    if (!body.prefecture || (typeof body.prefecture === 'string' && !body.prefecture.trim())) {
      validationErrors.push('都道府県は必須です');
    }
    
    // 業種チェック
    if (!body.industry_major || (typeof body.industry_major === 'string' && !body.industry_major.trim())) {
      validationErrors.push('業種は必須です');
    }
    
    // 従業員数チェック（凍結仕様: 数値 > 0 が必須）
    if (body.employee_count === undefined || body.employee_count === null) {
      validationErrors.push('従業員数は必須です');
    } else if (typeof body.employee_count !== 'number' || body.employee_count <= 0) {
      validationErrors.push('従業員数は1以上の数値を入力してください');
    }
    
    if (validationErrors.length > 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationErrors.join('、'),
          details: validationErrors,
        },
      }, 400);
    }
    
    const companyId = uuidv4();
    const now = new Date().toISOString();
    const employeeBand = calculateEmployeeBand(body.employee_count);
    
    // トランザクション的に企業とメンバーシップを作成
    // D1はトランザクションをサポートしていないので、batch を使用
    const statements = [
      db.prepare(`
        INSERT INTO companies (
          id, name, postal_code, prefecture, city, 
          industry_major, industry_minor, employee_count, employee_band,
          capital, established_date, annual_revenue, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        companyId,
        body.name,
        body.postal_code || null,
        body.prefecture,
        body.city || null,
        body.industry_major,
        body.industry_minor || null,
        body.employee_count,
        employeeBand,
        body.capital || null,
        body.established_date || null,
        body.annual_revenue || null,
        now,
        now
      ),
      // user_companies: 複合主キー(user_id, company_id)、role は必須、is_primary はデフォルト0
      db.prepare(`
        INSERT INTO user_companies (user_id, company_id, role, is_primary, joined_at)
        VALUES (?, ?, 'owner', 1, ?)
      `).bind(user.id, companyId, now),
    ];
    
    await db.batch(statements);
    
    // 作成した企業を取得
    const company = await db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .bind(companyId)
      .first<Company>();
    
    return c.json<ApiResponse<Company>>({
      success: true,
      data: company!,
    }, 201);
  } catch (error) {
    console.error('Create company error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create company',
      },
    }, 500);
  }
});

/**
 * 企業詳細取得
 */
companies.get('/:company_id', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('company_id');
  
  try {
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
    
    return c.json<ApiResponse<Company>>({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Get company error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get company',
      },
    }, 500);
  }
});

// =====================================================
// 会社情報完全性チェックAPI（凍結仕様v1）
// =====================================================

/**
 * 必須項目の定義（凍結）
 * - 会社名（name）
 * - 都道府県（prefecture）
 * - 業種（industry_major）
 * - 従業員数（employee_count）> 0
 */
interface CompletenessResult {
  status: 'OK' | 'NEEDS_RECOMMENDED' | 'BLOCKED';
  required: {
    name: boolean;
    prefecture: boolean;
    industry_major: boolean;
    employee_count: boolean;
  };
  recommended: {
    city: boolean;
    capital: boolean;
    established_date: boolean;
    annual_revenue: boolean;
    representative_name: boolean;
    website_url: boolean;
  };
  missing_required: string[];
  missing_recommended: string[];
  required_count: number;
  required_filled: number;
  recommended_count: number;
  recommended_filled: number;
  benefits: string[];
}

/**
 * 会社情報完全性チェック
 * GET /api/companies/:company_id/completeness
 * 
 * 凍結仕様:
 * - 必須4項目: name, prefecture, industry_major, employee_count
 * - 推奨6項目: city, capital, established_date, annual_revenue, representative_name, website_url
 * - status: OK(必須充足+推奨充足), NEEDS_RECOMMENDED(必須充足+推奨不足), BLOCKED(必須不足)
 */
companies.get('/:company_id/completeness', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('company_id');
  
  try {
    // companies と company_profile を取得
    const company = await db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .bind(companyId)
      .first<Company>();
    
    if (!company) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Company not found' },
      }, 404);
    }
    
    const profile = await db
      .prepare('SELECT * FROM company_profile WHERE company_id = ?')
      .bind(companyId)
      .first<{
        representative_name: string | null;
        website_url: string | null;
        [key: string]: unknown;
      }>();
    
    // 必須項目チェック
    const required = {
      name: !!(company.name && company.name.trim()),
      prefecture: !!(company.prefecture && company.prefecture.trim()),
      industry_major: !!(company.industry_major && company.industry_major.trim()),
      employee_count: !!(company.employee_count && company.employee_count > 0),
    };
    
    // 推奨項目チェック
    const recommended = {
      city: !!(company.city && company.city.trim()),
      capital: !!(company.capital && company.capital > 0),
      established_date: !!(company.established_date && company.established_date.trim()),
      annual_revenue: !!(company.annual_revenue && company.annual_revenue > 0),
      representative_name: !!(profile?.representative_name && profile.representative_name.trim()),
      website_url: !!(profile?.website_url && profile.website_url.trim()),
    };
    
    // 不足項目リスト
    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];
    
    const requiredLabels: Record<string, string> = {
      name: '会社名',
      prefecture: '都道府県',
      industry_major: '業種',
      employee_count: '従業員数',
    };
    
    const recommendedLabels: Record<string, string> = {
      city: '市区町村',
      capital: '資本金',
      established_date: '設立日',
      annual_revenue: '年商',
      representative_name: '代表者名',
      website_url: 'Webサイト',
    };
    
    for (const [key, value] of Object.entries(required)) {
      if (!value) missingRequired.push(requiredLabels[key] || key);
    }
    
    for (const [key, value] of Object.entries(recommended)) {
      if (!value) missingRecommended.push(recommendedLabels[key] || key);
    }
    
    // ステータス判定
    const requiredCount = Object.keys(required).length;
    const requiredFilled = Object.values(required).filter(Boolean).length;
    const recommendedCount = Object.keys(recommended).length;
    const recommendedFilled = Object.values(recommended).filter(Boolean).length;
    
    let status: CompletenessResult['status'];
    if (requiredFilled < requiredCount) {
      status = 'BLOCKED';
    } else if (recommendedFilled < recommendedCount) {
      status = 'NEEDS_RECOMMENDED';
    } else {
      status = 'OK';
    }
    
    // 推奨入力のメリット
    const benefits: string[] = [];
    if (!recommended.city) {
      benefits.push('市区町村を入力すると、地域限定の補助金がより正確にマッチします');
    }
    if (!recommended.capital) {
      benefits.push('資本金を入力すると、中小企業向け補助金の適格判定が正確になります');
    }
    if (!recommended.established_date) {
      benefits.push('設立日を入力すると、創業〇年以内の補助金がマッチします');
    }
    if (!recommended.annual_revenue) {
      benefits.push('年商を入力すると、売上規模に応じた補助金の適格判定ができます');
    }
    if (!recommended.representative_name) {
      benefits.push('代表者名を入力すると、申請書ドラフトの自動生成が可能になります');
    }
    if (!recommended.website_url) {
      benefits.push('Webサイトを入力すると、事業内容の自動抽出が可能になります');
    }
    
    const result: CompletenessResult = {
      status,
      required,
      recommended,
      missing_required: missingRequired,
      missing_recommended: missingRecommended,
      required_count: requiredCount,
      required_filled: requiredFilled,
      recommended_count: recommendedCount,
      recommended_filled: recommendedFilled,
      benefits,
    };
    
    return c.json<ApiResponse<CompletenessResult>>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Completeness check error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check completeness' },
    }, 500);
  }
});

/**
 * 企業更新
 */
companies.put('/:company_id', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('company_id');
  const user = getCurrentUser(c);
  
  try {
    // 権限チェック（owner または admin のみ更新可能）
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const membership = await db
      .prepare('SELECT role FROM user_companies WHERE user_id = ? AND company_id = ?')
      .bind(user.id, companyId)
      .first<{ role: string }>();
    
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && user.role !== 'super_admin')) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only owners and admins can update company',
        },
      }, 403);
    }
    
    const body = await c.req.json<Partial<CompanyCreateInput>>();
    
    // 更新するフィールドを構築
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.postal_code !== undefined) {
      updates.push('postal_code = ?');
      values.push(body.postal_code);
    }
    if (body.prefecture !== undefined) {
      updates.push('prefecture = ?');
      values.push(body.prefecture);
    }
    if (body.city !== undefined) {
      updates.push('city = ?');
      values.push(body.city);
    }
    if (body.industry_major !== undefined) {
      updates.push('industry_major = ?');
      values.push(body.industry_major);
    }
    if (body.industry_minor !== undefined) {
      updates.push('industry_minor = ?');
      values.push(body.industry_minor);
    }
    if (body.employee_count !== undefined) {
      updates.push('employee_count = ?');
      values.push(body.employee_count);
      updates.push('employee_band = ?');
      values.push(calculateEmployeeBand(body.employee_count));
    }
    if (body.capital !== undefined) {
      updates.push('capital = ?');
      values.push(body.capital);
    }
    if (body.established_date !== undefined) {
      updates.push('established_date = ?');
      values.push(body.established_date);
    }
    if (body.annual_revenue !== undefined) {
      updates.push('annual_revenue = ?');
      values.push(body.annual_revenue);
    }
    
    if (updates.length === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
        },
      }, 400);
    }
    
    // updated_at を追加
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(companyId);
    
    await db
      .prepare(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    // 更新後の企業を取得
    const company = await db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .bind(companyId)
      .first<Company>();
    
    return c.json<ApiResponse<Company>>({
      success: true,
      data: company!,
    });
  } catch (error) {
    console.error('Update company error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update company',
      },
    }, 500);
  }
});

/**
 * 企業削除
 */
companies.delete('/:company_id', requireCompanyAccess(), async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('company_id');
  const user = getCurrentUser(c);
  
  try {
    // 権限チェック（owner のみ削除可能）
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const membership = await db
      .prepare('SELECT role FROM user_companies WHERE user_id = ? AND company_id = ?')
      .bind(user.id, companyId)
      .first<{ role: string }>();
    
    if (!membership || (membership.role !== 'owner' && user.role !== 'super_admin')) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only owners can delete company',
        },
      }, 403);
    }
    
    // 企業削除（CASCADE で関連データも削除される）
    await db
      .prepare('DELETE FROM companies WHERE id = ?')
      .bind(companyId)
      .run();
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'Company deleted successfully',
      },
    });
  } catch (error) {
    console.error('Delete company error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete company',
      },
    }, 500);
  }
});

export default companies;

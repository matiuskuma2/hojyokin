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
    
    // バリデーション
    const requiredFields = ['name', 'prefecture', 'industry_major', 'employee_count'];
    const missingFields = requiredFields.filter(f => !(f in body) || body[f as keyof CompanyCreateInput] === undefined);
    
    if (missingFields.length > 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missingFields.join(', ')}`,
        },
      }, 400);
    }
    
    // 従業員数のバリデーション
    if (typeof body.employee_count !== 'number' || body.employee_count < 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'employee_count must be a non-negative number',
        },
      }, 400);
    }
    
    const companyId = uuidv4();
    const membershipId = uuidv4();
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
      db.prepare(`
        INSERT INTO user_companies (id, user_id, company_id, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(membershipId, user.id, companyId, now),
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

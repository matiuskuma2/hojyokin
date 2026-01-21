/**
 * 会社プロフィール API
 * GET /api/profile         - プロフィール取得（companies + company_profile 統合）
 * PUT /api/profile         - プロフィール更新
 * GET /api/profile/completeness - 完成度チェック
 * POST /api/profile/documents   - 書類アップロード
 * GET /api/profile/documents    - 書類一覧
 * DELETE /api/profile/documents/:id - 書類削除
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth, requireCompanyAccess } from '../middleware/auth';

const profile = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
profile.use('*', requireAuth);
profile.use('*', requireCompanyAccess);

// =====================================================
// 完成度チェック基準
// =====================================================

interface CompletenessField {
  field: string;
  label: string;
  source: 'company' | 'profile';
  weight: number;
  category: 'required' | 'recommended' | 'optional';
}

const COMPLETENESS_FIELDS: CompletenessField[] = [
  // 必須項目 (companies テーブル)
  { field: 'name', label: '会社名', source: 'company', weight: 10, category: 'required' },
  { field: 'prefecture', label: '都道府県', source: 'company', weight: 10, category: 'required' },
  { field: 'industry_major', label: '業種', source: 'company', weight: 10, category: 'required' },
  { field: 'employee_count', label: '従業員数', source: 'company', weight: 10, category: 'required' },
  
  // 推奨項目 (companies テーブル)
  { field: 'city', label: '市区町村', source: 'company', weight: 5, category: 'recommended' },
  { field: 'capital', label: '資本金', source: 'company', weight: 5, category: 'recommended' },
  { field: 'annual_revenue', label: '年商', source: 'company', weight: 5, category: 'recommended' },
  { field: 'established_date', label: '設立年月', source: 'company', weight: 5, category: 'recommended' },
  
  // 詳細プロフィール項目 (company_profile テーブル)
  { field: 'corp_type', label: '法人種別', source: 'profile', weight: 5, category: 'recommended' },
  { field: 'representative_name', label: '代表者名', source: 'profile', weight: 5, category: 'recommended' },
  { field: 'business_summary', label: '事業概要', source: 'profile', weight: 8, category: 'recommended' },
  { field: 'is_profitable', label: '直近収益性', source: 'profile', weight: 5, category: 'recommended' },
  
  // 加点対象項目
  { field: 'past_subsidies_json', label: '過去の補助金実績', source: 'profile', weight: 5, category: 'optional' },
  { field: 'certifications_json', label: '保有認証', source: 'profile', weight: 3, category: 'optional' },
  { field: 'has_young_employees', label: '若年従業員', source: 'profile', weight: 2, category: 'optional' },
  { field: 'has_female_executives', label: '女性役員', source: 'profile', weight: 2, category: 'optional' },
  { field: 'has_senior_employees', label: 'シニア従業員', source: 'profile', weight: 2, category: 'optional' },
  { field: 'plans_to_hire', label: '採用予定', source: 'profile', weight: 2, category: 'optional' },
];

// =====================================================
// GET /api/profile - プロフィール統合取得
// =====================================================

profile.get('/', async (c) => {
  const companyId = c.get('company')?.id;
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    // companies テーブルから基本情報
    const company = await c.env.DB.prepare(`
      SELECT * FROM companies WHERE id = ?
    `).bind(companyId).first();
    
    // company_profile テーブルから詳細情報
    const profile = await c.env.DB.prepare(`
      SELECT * FROM company_profile WHERE company_id = ?
    `).bind(companyId).first();
    
    // 書類一覧
    const documents = await c.env.DB.prepare(`
      SELECT id, doc_type, original_filename, content_type, size_bytes, status, confidence, uploaded_at
      FROM company_documents
      WHERE company_id = ?
      ORDER BY uploaded_at DESC
    `).bind(companyId).all();
    
    // 統合レスポンス
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        company,
        profile: profile || {},
        documents: documents.results || []
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get profile' }
    }, 500);
  }
});

// =====================================================
// PUT /api/profile - プロフィール更新
// =====================================================

profile.put('/', async (c) => {
  const companyId = c.get('company')?.id;
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const body = await c.req.json();
    const now = new Date().toISOString();
    
    // companies テーブルの更新項目
    const companyFields = ['name', 'postal_code', 'prefecture', 'city', 'industry_major', 'industry_minor', 'employee_count', 'employee_band', 'capital', 'annual_revenue', 'established_date'];
    const companyUpdates: string[] = [];
    const companyValues: any[] = [];
    
    for (const field of companyFields) {
      if (body[field] !== undefined) {
        companyUpdates.push(`${field} = ?`);
        companyValues.push(body[field]);
      }
    }
    
    if (companyUpdates.length > 0) {
      companyUpdates.push('updated_at = ?');
      companyValues.push(now, companyId);
      
      await c.env.DB.prepare(`
        UPDATE companies SET ${companyUpdates.join(', ')} WHERE id = ?
      `).bind(...companyValues).run();
    }
    
    // company_profile テーブルの更新項目
    const profileFields = [
      'corp_number', 'corp_type', 'representative_name', 'representative_title',
      'founding_year', 'founding_month', 'website_url', 'contact_email', 'contact_phone',
      'business_summary', 'main_products', 'main_customers', 'competitive_advantage',
      'fiscal_year_end', 'is_profitable', 'has_debt',
      'past_subsidies_json', 'desired_investments_json', 'current_challenges_json',
      'has_young_employees', 'has_female_executives', 'has_senior_employees', 'plans_to_hire',
      'certifications_json', 'constraints_json', 'notes'
    ];
    
    const profileUpdates: string[] = [];
    const profileValues: any[] = [];
    let hasProfileData = false;
    
    for (const field of profileFields) {
      if (body[field] !== undefined) {
        profileUpdates.push(`${field} = ?`);
        profileValues.push(body[field]);
        hasProfileData = true;
      }
    }
    
    if (hasProfileData) {
      // company_profile が存在するかチェック
      const existing = await c.env.DB.prepare(`
        SELECT company_id FROM company_profile WHERE company_id = ?
      `).bind(companyId).first();
      
      if (existing) {
        profileUpdates.push('updated_at = ?');
        profileValues.push(now, companyId);
        
        await c.env.DB.prepare(`
          UPDATE company_profile SET ${profileUpdates.join(', ')} WHERE company_id = ?
        `).bind(...profileValues).run();
      } else {
        // INSERT
        const insertFields = ['company_id', ...profileFields.filter(f => body[f] !== undefined), 'updated_at', 'created_at'];
        const insertPlaceholders = insertFields.map(() => '?').join(', ');
        const insertValues = [companyId, ...profileFields.filter(f => body[f] !== undefined).map(f => body[f]), now, now];
        
        await c.env.DB.prepare(`
          INSERT INTO company_profile (${insertFields.join(', ')}) VALUES (${insertPlaceholders})
        `).bind(...insertValues).run();
      }
    }
    
    return c.json<ApiResponse<{ updated: boolean }>>({
      success: true,
      data: { updated: true }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' }
    }, 500);
  }
});

// =====================================================
// GET /api/profile/completeness - 完成度チェック
// =====================================================

profile.get('/completeness', async (c) => {
  const companyId = c.get('company')?.id;
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const company = await c.env.DB.prepare(`
      SELECT * FROM companies WHERE id = ?
    `).bind(companyId).first() as Record<string, any> | null;
    
    const profileData = await c.env.DB.prepare(`
      SELECT * FROM company_profile WHERE company_id = ?
    `).bind(companyId).first() as Record<string, any> | null;
    
    // 書類数
    const docCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM company_documents WHERE company_id = ? AND status = 'processed'
    `).bind(companyId).first() as { count: number };
    
    // 完成度計算
    let totalWeight = 0;
    let filledWeight = 0;
    const missingFields: { field: string; label: string; category: string }[] = [];
    const filledFields: { field: string; label: string; category: string }[] = [];
    
    for (const field of COMPLETENESS_FIELDS) {
      totalWeight += field.weight;
      
      const source = field.source === 'company' ? company : profileData;
      const value = source?.[field.field];
      
      // 値が存在するかチェック（0は有効、null/undefined/空文字は無効）
      const isFilled = value !== null && value !== undefined && value !== '';
      
      if (isFilled) {
        filledWeight += field.weight;
        filledFields.push({ field: field.field, label: field.label, category: field.category });
      } else {
        missingFields.push({ field: field.field, label: field.label, category: field.category });
      }
    }
    
    // 書類による加点（最大10ポイント）
    const docBonus = Math.min((docCount?.count || 0) * 2, 10);
    filledWeight += docBonus;
    totalWeight += 10; // 書類分の最大ウェイト
    
    const percentage = Math.round((filledWeight / totalWeight) * 100);
    
    // カテゴリ別集計
    const byCategory = {
      required: {
        total: COMPLETENESS_FIELDS.filter(f => f.category === 'required').length,
        filled: filledFields.filter(f => f.category === 'required').length
      },
      recommended: {
        total: COMPLETENESS_FIELDS.filter(f => f.category === 'recommended').length,
        filled: filledFields.filter(f => f.category === 'recommended').length
      },
      optional: {
        total: COMPLETENESS_FIELDS.filter(f => f.category === 'optional').length,
        filled: filledFields.filter(f => f.category === 'optional').length
      }
    };
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        percentage,
        totalWeight,
        filledWeight,
        missingFields: missingFields.filter(f => f.category === 'required' || f.category === 'recommended'),
        filledFields,
        byCategory,
        documentCount: docCount?.count || 0,
        documentBonus: docBonus,
        // 検索準備状態
        readyForSearch: byCategory.required.filled === byCategory.required.total,
        // 推奨アクション
        nextActions: getNextActions(missingFields, docCount?.count || 0)
      }
    });
  } catch (error) {
    console.error('Get completeness error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get completeness' }
    }, 500);
  }
});

function getNextActions(missingFields: { field: string; label: string; category: string }[], docCount: number): string[] {
  const actions: string[] = [];
  
  // 必須項目が欠けている場合
  const missingRequired = missingFields.filter(f => f.category === 'required');
  if (missingRequired.length > 0) {
    actions.push(`必須情報を入力してください: ${missingRequired.map(f => f.label).join('、')}`);
  }
  
  // 書類がない場合
  if (docCount === 0) {
    actions.push('決算書や登記簿をアップロードすると、より正確なマッチングが可能になります');
  }
  
  // 推奨項目
  const missingRecommended = missingFields.filter(f => f.category === 'recommended');
  if (missingRecommended.length > 3) {
    actions.push('詳細情報を追加すると、補助金の適合度判定が改善されます');
  }
  
  return actions;
}

// =====================================================
// POST /api/profile/documents - 書類アップロード
// =====================================================

profile.post('/documents', async (c) => {
  const companyId = c.get('company')?.id;
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const docType = formData.get('doc_type') as string || 'other';
    
    if (!file) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'File is required' }
      }, 400);
    }
    
    // ファイルサイズチェック（10MB上限）
    if (file.size > 10 * 1024 * 1024) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'File size must be less than 10MB' }
      }, 400);
    }
    
    // 許可されるファイルタイプ
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Only PDF and images (JPEG, PNG, WebP) are allowed' }
      }, 400);
    }
    
    const documentId = crypto.randomUUID();
    const r2Key = `company-documents/${companyId}/${documentId}/${file.name}`;
    
    // R2 にアップロード
    if (c.env.R2) {
      const arrayBuffer = await file.arrayBuffer();
      await c.env.R2.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type
        }
      });
    }
    
    // DB に記録
    await c.env.DB.prepare(`
      INSERT INTO company_documents (id, company_id, doc_type, original_filename, content_type, size_bytes, r2_key, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')
    `).bind(documentId, companyId, docType, file.name, file.type, file.size, r2Key).run();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        id: documentId,
        doc_type: docType,
        original_filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
        status: 'uploaded'
      }
    });
  } catch (error) {
    console.error('Upload document error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload document' }
    }, 500);
  }
});

// =====================================================
// GET /api/profile/documents - 書類一覧
// =====================================================

profile.get('/documents', async (c) => {
  const companyId = c.get('company')?.id;
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const documents = await c.env.DB.prepare(`
      SELECT id, doc_type, original_filename, content_type, size_bytes, status, confidence, uploaded_at, updated_at
      FROM company_documents
      WHERE company_id = ?
      ORDER BY uploaded_at DESC
    `).bind(companyId).all();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: documents.results || []
    });
  } catch (error) {
    console.error('Get documents error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get documents' }
    }, 500);
  }
});

// =====================================================
// DELETE /api/profile/documents/:id - 書類削除
// =====================================================

profile.delete('/documents/:id', async (c) => {
  const companyId = c.get('company')?.id;
  const documentId = c.req.param('id');
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    // 所有権確認
    const doc = await c.env.DB.prepare(`
      SELECT r2_key FROM company_documents WHERE id = ? AND company_id = ?
    `).bind(documentId, companyId).first() as { r2_key: string } | null;
    
    if (!doc) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      }, 404);
    }
    
    // R2 から削除
    if (c.env.R2 && doc.r2_key) {
      await c.env.R2.delete(doc.r2_key);
    }
    
    // DB から削除
    await c.env.DB.prepare(`
      DELETE FROM company_documents WHERE id = ? AND company_id = ?
    `).bind(documentId, companyId).run();
    
    return c.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete document' }
    }, 500);
  }
});

export default profile;

/**
 * 会社プロフィール API
 * GET /api/profile         - プロフィール取得（companies + company_profile 統合）
 * PUT /api/profile         - プロフィール更新
 * GET /api/profile/completeness - 完成度チェック
 * POST /api/profile/documents   - 書類アップロード
 * GET /api/profile/documents    - 書類一覧
 * DELETE /api/profile/documents/:id - 書類削除
 * POST /api/profile/documents/:id/extract - 書類抽出開始（AWS連携）
 * POST /api/profile/documents/:id/apply - 抽出結果を company_profile へ反映
 * GET /api/profile/documents/:id/extracted - 抽出結果取得
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';

const profile = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
profile.use('*', requireAuth);

// ユーザーの会社を自動取得するミドルウェア
profile.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    }, 401);
  }
  
  // ユーザーがメンバーとなっている会社を取得
  const membership = await c.env.DB.prepare(`
    SELECT c.* FROM companies c
    INNER JOIN company_memberships cm ON c.id = cm.company_id
    WHERE cm.user_id = ?
    ORDER BY cm.created_at ASC
    LIMIT 1
  `).bind(user.id).first();
  
  if (membership) {
    c.set('company', membership);
  }
  
  await next();
});

// =====================================================
// 書類抽出JSONスキーマ（Phase 1）
// =====================================================

/**
 * 登記簿（履歴事項全部証明書）抽出スキーマ
 */
export interface CorpRegistryExtracted {
  company_name?: string;           // 商号
  address?: string;                 // 本店所在地
  representative_name?: string;     // 代表者名
  representative_title?: string;    // 代表者役職
  established_date?: string;        // 設立年月日
  capital?: number;                 // 資本金（円）
  business_purpose?: string[];      // 目的（事業内容）
  corp_number?: string;             // 法人番号（記載があれば）
  source: 'corp_registry';
  confidence: number;               // 0-100
}

/**
 * 決算書抽出スキーマ
 */
export interface FinancialsExtracted {
  fiscal_year?: string;             // 決算期（例: "2023年度"）
  fiscal_year_end?: string;         // 決算月（例: "3月"）
  sales?: number;                   // 売上高（円）
  operating_profit?: number;        // 営業利益（円）
  net_profit?: number;              // 当期純利益（円）
  total_assets?: number;            // 総資産（円）
  net_assets?: number;              // 純資産（円）
  employee_count?: number;          // 従業員数
  is_profitable?: boolean;          // 黒字かどうか
  notes?: string;                   // 備考
  source: 'financials';
  confidence: number;               // 0-100
}

export type DocumentExtracted = CorpRegistryExtracted | FinancialsExtracted;

// 書類ステータス
export type DocumentStatus = 'uploaded' | 'extracting' | 'extracted' | 'applied' | 'failed';

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

// =====================================================
// POST /api/profile/documents/:id/text - PDFテキスト保存（クライアントでPDF.js抽出後）
// =====================================================

profile.post('/documents/:id/text', async (c) => {
  const companyId = c.get('company')?.id;
  const documentId = c.req.param('id');
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const body = await c.req.json();
    const text: string = body.text || '';
    
    if (!text || text.trim().length < 10) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Text is too short or empty' }
      }, 400);
    }
    
    // 所有権確認
    const doc = await c.env.DB.prepare(`
      SELECT id FROM company_documents WHERE id = ? AND company_id = ?
    `).bind(documentId, companyId).first();
    
    if (!doc) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      }, 404);
    }
    
    const now = new Date().toISOString();
    
    // DBにテキストを保存
    await c.env.DB.prepare(`
      UPDATE company_documents 
      SET raw_text = ?, updated_at = ?
      WHERE id = ? AND company_id = ?
    `).bind(text.substring(0, 100000), now, documentId, companyId).run();
    
    return c.json<ApiResponse<{ saved: boolean }>>({
      success: true,
      data: { saved: true }
    });
  } catch (error) {
    console.error('Save document text error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save text' }
    }, 500);
  }
});

// =====================================================
// 正規表現ベースのテキスト解析（Phase 1 ローカル抽出）
// =====================================================

/**
 * 登記簿テキストから情報を抽出
 */
function extractCorpRegistryFromText(text: string): Partial<CorpRegistryExtracted> {
  const result: Partial<CorpRegistryExtracted> = {
    source: 'corp_registry',
    confidence: 0
  };
  
  let matchCount = 0;
  const totalFields = 7;
  
  // 商号（会社名）
  const companyNameMatch = text.match(/商\s*号[：:\s]*([\s\S]*?)(?=\n|本店|$)/);
  if (companyNameMatch) {
    result.company_name = companyNameMatch[1].trim().replace(/\s+/g, '');
    matchCount++;
  }
  
  // 本店所在地
  const addressMatch = text.match(/本\s*店[：:\s]*([\s\S]*?)(?=\n(?:会社成立|公告|目的|資本金|役員)|$)/);
  if (addressMatch) {
    result.address = addressMatch[1].trim().replace(/\s+/g, '');
    matchCount++;
  }
  
  // 設立年月日（会社成立の年月日）
  const establishedMatch = text.match(/(?:会社成立の年月日|設立)[：:\s]*(?:令和|平成|昭和)?(\d+)年(\d+)月(\d+)日/);
  if (establishedMatch) {
    // 和暦→西暦変換
    const yearText = text.match(/(?:会社成立の年月日|設立)[：:\s]*(令和|平成|昭和)(\d+)年/);
    let year = parseInt(establishedMatch[1]);
    if (yearText) {
      const era = yearText[1];
      const eraYear = parseInt(yearText[2]);
      if (era === '令和') year = 2018 + eraYear;
      else if (era === '平成') year = 1988 + eraYear;
      else if (era === '昭和') year = 1925 + eraYear;
    }
    result.established_date = `${year}-${establishedMatch[2].padStart(2, '0')}-${establishedMatch[3].padStart(2, '0')}`;
    matchCount++;
  }
  
  // 資本金
  const capitalMatch = text.match(/資本金[：:\s]*(?:金)?([0-9,，]+)(?:万)?円/);
  if (capitalMatch) {
    let capital = parseInt(capitalMatch[1].replace(/[,，]/g, ''));
    if (text.includes('万円') && capital < 100000) {
      capital *= 10000;
    }
    result.capital = capital;
    matchCount++;
  }
  
  // 代表者
  const representativeMatch = text.match(/(?:代表取締役|取締役|代表社員)[：:\s]*([^\n\d]+?)(?:\s|$)/);
  if (representativeMatch) {
    result.representative_name = representativeMatch[1].trim();
    result.representative_title = representativeMatch[0].includes('代表取締役') ? '代表取締役' : 
                                   representativeMatch[0].includes('代表社員') ? '代表社員' : '取締役';
    matchCount++;
  }
  
  // 目的（事業内容）
  const purposeMatch = text.match(/目\s*的[：:\s]*([\s\S]*?)(?=\n(?:発行可能株式|資本金|役員|$))/);
  if (purposeMatch) {
    const purposes = purposeMatch[1]
      .split(/[。\n]/)
      .map(p => p.trim().replace(/^[\d１２３４５６７８９０]+[\s\.、．]?/, ''))
      .filter(p => p.length > 3 && p.length < 100);
    if (purposes.length > 0) {
      result.business_purpose = purposes.slice(0, 5);
      matchCount++;
    }
  }
  
  // 法人番号
  const corpNumberMatch = text.match(/法人番号[：:\s]*(\d{13})/);
  if (corpNumberMatch) {
    result.corp_number = corpNumberMatch[1];
    matchCount++;
  }
  
  result.confidence = Math.round((matchCount / totalFields) * 100);
  
  return result;
}

/**
 * 決算書テキストから情報を抽出
 */
function extractFinancialsFromText(text: string): Partial<FinancialsExtracted> {
  const result: Partial<FinancialsExtracted> = {
    source: 'financials',
    confidence: 0
  };
  
  let matchCount = 0;
  const totalFields = 7;
  
  // 決算期
  const fiscalYearMatch = text.match(/(?:第\d+期|令和\d+年度?|平成\d+年度?|20\d{2}年度?)[^\n]*(?:決算|事業報告)?/);
  if (fiscalYearMatch) {
    result.fiscal_year = fiscalYearMatch[0].trim();
    matchCount++;
  }
  
  // 決算月
  const fiscalMonthMatch = text.match(/(?:事業年度|決算期)[：:\s]*[^\n]*(\d{1,2})月/);
  if (fiscalMonthMatch) {
    result.fiscal_year_end = `${fiscalMonthMatch[1]}月`;
    matchCount++;
  }
  
  // 売上高
  const salesMatch = text.match(/(?:売上高|売上|営業収益)[：:\s]*(?:金)?([0-9,，]+)(?:千円|百万円|円)?/);
  if (salesMatch) {
    let sales = parseInt(salesMatch[1].replace(/[,，]/g, ''));
    if (text.includes('千円')) sales *= 1000;
    else if (text.includes('百万円')) sales *= 1000000;
    result.sales = sales;
    matchCount++;
  }
  
  // 営業利益
  const opProfitMatch = text.match(/営業利益[：:\s]*(?:金)?([△▲\-])?([0-9,，]+)(?:千円|百万円|円)?/);
  if (opProfitMatch) {
    let profit = parseInt(opProfitMatch[2].replace(/[,，]/g, ''));
    if (opProfitMatch[1]) profit = -profit;
    if (text.includes('千円')) profit *= 1000;
    else if (text.includes('百万円')) profit *= 1000000;
    result.operating_profit = profit;
    matchCount++;
  }
  
  // 当期純利益
  const netProfitMatch = text.match(/(?:当期純利益|純利益|税引後利益)[：:\s]*(?:金)?([△▲\-])?([0-9,，]+)(?:千円|百万円|円)?/);
  if (netProfitMatch) {
    let profit = parseInt(netProfitMatch[2].replace(/[,，]/g, ''));
    if (netProfitMatch[1]) profit = -profit;
    if (text.includes('千円')) profit *= 1000;
    else if (text.includes('百万円')) profit *= 1000000;
    result.net_profit = profit;
    result.is_profitable = profit > 0;
    matchCount++;
  }
  
  // 従業員数
  const employeeMatch = text.match(/(?:従業員数|従業員)[：:\s]*([0-9,，]+)\s*(?:名|人)/);
  if (employeeMatch) {
    result.employee_count = parseInt(employeeMatch[1].replace(/[,，]/g, ''));
    matchCount++;
  }
  
  // 総資産
  const assetsMatch = text.match(/(?:総資産|資産合計|資産の部合計)[：:\s]*(?:金)?([0-9,，]+)(?:千円|百万円|円)?/);
  if (assetsMatch) {
    let assets = parseInt(assetsMatch[1].replace(/[,，]/g, ''));
    if (text.includes('千円')) assets *= 1000;
    else if (text.includes('百万円')) assets *= 1000000;
    result.total_assets = assets;
    matchCount++;
  }
  
  result.confidence = Math.round((matchCount / totalFields) * 100);
  
  return result;
}

// =====================================================
// POST /api/profile/documents/:id/extract - 抽出開始
// （ローカルテキスト解析版）
// =====================================================

profile.post('/documents/:id/extract', async (c) => {
  const companyId = c.get('company')?.id;
  const documentId = c.req.param('id');
  const user = c.get('user');
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    // リクエストボディからテキストを取得（クライアント側でPDF.jsで抽出したテキスト）
    const body = await c.req.json().catch(() => ({}));
    let extractedText: string = body.text || '';
    
    // 所有権確認とドキュメント取得（raw_textも取得）
    const doc = await c.env.DB.prepare(`
      SELECT id, doc_type, original_filename, content_type, size_bytes, r2_key, status, raw_text
      FROM company_documents 
      WHERE id = ? AND company_id = ?
    `).bind(documentId, companyId).first() as {
      id: string;
      doc_type: string;
      original_filename: string;
      content_type: string;
      size_bytes: number;
      r2_key: string;
      status: DocumentStatus;
      raw_text: string | null;
    } | null;
    
    if (!doc) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      }, 404);
    }
    
    // doc_type が Phase 1 対象でない場合
    if (!['corp_registry', 'financials'].includes(doc.doc_type)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'UNSUPPORTED_DOC_TYPE', message: `Document type '${doc.doc_type}' is not supported for extraction in Phase 1` }
      }, 400);
    }
    
    const now = new Date().toISOString();
    
    // リクエストにテキストがない場合、DBに保存されたraw_textを使用
    if (!extractedText || extractedText.trim().length < 10) {
      if (doc.raw_text && doc.raw_text.trim().length >= 10) {
        extractedText = doc.raw_text;
      } else {
        return c.json<ApiResponse<null>>({
          success: false,
          error: { code: 'NO_TEXT', message: 'テキストが提供されていません。PDFからテキストを抽出してから再試行してください。' }
        }, 400);
      }
    } else {
      // 新しいテキストが提供された場合、DBに保存
      await c.env.DB.prepare(`
        UPDATE company_documents SET raw_text = ?, updated_at = ? WHERE id = ?
      `).bind(extractedText.substring(0, 100000), now, documentId).run();
    }
    
    // ローカルテキスト解析を実行
    let extracted: DocumentExtracted;
    
    if (doc.doc_type === 'corp_registry') {
      extracted = extractCorpRegistryFromText(extractedText) as CorpRegistryExtracted;
    } else if (doc.doc_type === 'financials') {
      extracted = extractFinancialsFromText(extractedText) as FinancialsExtracted;
    } else {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'UNSUPPORTED_DOC_TYPE', message: 'Unsupported document type' }
      }, 400);
    }
    
    // 信頼度が低すぎる場合は警告
    const confidence = extracted.confidence || 0;
    
    // DB更新 - 抽出結果を保存
    await c.env.DB.prepare(`
      UPDATE company_documents 
      SET status = 'extracted', 
          extracted_json = ?, 
          confidence = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      JSON.stringify(extracted),
      confidence,
      now,
      documentId
    ).run();
    
    // 監査ログ
    await c.env.DB.prepare(`
      INSERT INTO audit_log (id, actor_user_id, target_company_id, target_resource_type, target_resource_id, action, action_category, severity, details_json, created_at)
      VALUES (?, ?, ?, 'document', ?, 'DOCUMENT_EXTRACTED', 'document', 'info', ?, ?)
    `).bind(
      crypto.randomUUID(),
      user?.id || null,
      companyId,
      documentId,
      JSON.stringify({ doc_type: doc.doc_type, confidence, extracted_fields: Object.keys(extracted).filter(k => k !== 'source' && k !== 'confidence') }),
      now
    ).run();
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        document_id: documentId,
        status: 'extracted',
        extracted: extracted,
        confidence: confidence,
        message: confidence >= 50 
          ? '情報を抽出しました。確認後、プロフィールに反映できます。' 
          : '抽出できましたが、信頼度が低いため確認が必要です。手入力での補完をお勧めします。'
      }
    });
  } catch (error) {
    console.error('Extract document error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to extract data' }
    }, 500);
  }
});

// =====================================================
// GET /api/profile/documents/:id/extracted - 抽出結果取得
// =====================================================

profile.get('/documents/:id/extracted', async (c) => {
  const companyId = c.get('company')?.id;
  const documentId = c.req.param('id');
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const doc = await c.env.DB.prepare(`
      SELECT id, doc_type, original_filename, status, extracted_json, confidence, updated_at
      FROM company_documents 
      WHERE id = ? AND company_id = ?
    `).bind(documentId, companyId).first() as {
      id: string;
      doc_type: string;
      original_filename: string;
      status: DocumentStatus;
      extracted_json: string | null;
      confidence: number | null;
      updated_at: string;
    } | null;
    
    if (!doc) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      }, 404);
    }
    
    let extracted: DocumentExtracted | null = null;
    if (doc.extracted_json) {
      try {
        extracted = JSON.parse(doc.extracted_json);
      } catch (e) {
        console.error('Failed to parse extracted_json:', e);
      }
    }
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        document_id: doc.id,
        doc_type: doc.doc_type,
        original_filename: doc.original_filename,
        status: doc.status,
        extracted: extracted,
        confidence: doc.confidence,
        updated_at: doc.updated_at,
        // 反映可能な項目のマッピング情報
        apply_mapping: getApplyMapping(doc.doc_type, extracted)
      }
    });
  } catch (error) {
    console.error('Get extracted error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get extraction result' }
    }, 500);
  }
});

/**
 * 抽出データ→company_profile/companies へのマッピング情報
 */
function getApplyMapping(docType: string, extracted: any): Record<string, { target: string; label: string }> | null {
  if (!extracted) return null;
  
  if (docType === 'corp_registry') {
    return {
      company_name: { target: 'companies.name', label: '会社名' },
      address: { target: 'companies.prefecture,companies.city', label: '所在地' },
      representative_name: { target: 'company_profile.representative_name', label: '代表者名' },
      representative_title: { target: 'company_profile.representative_title', label: '代表者役職' },
      established_date: { target: 'companies.established_date', label: '設立年月日' },
      capital: { target: 'companies.capital', label: '資本金' },
      business_purpose: { target: 'company_profile.business_summary', label: '事業概要' },
      corp_number: { target: 'company_profile.corp_number', label: '法人番号' }
    };
  }
  
  if (docType === 'financials') {
    return {
      fiscal_year_end: { target: 'company_profile.fiscal_year_end', label: '決算月' },
      sales: { target: 'companies.annual_revenue', label: '売上高' },
      employee_count: { target: 'companies.employee_count', label: '従業員数' },
      is_profitable: { target: 'company_profile.is_profitable', label: '収益性' }
    };
  }
  
  return null;
}

// =====================================================
// POST /api/profile/documents/:id/apply - 抽出結果を反映
// =====================================================

profile.post('/documents/:id/apply', async (c) => {
  const companyId = c.get('company')?.id;
  const documentId = c.req.param('id');
  const user = c.get('user');
  
  if (!companyId) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_COMPANY', message: 'Company not found' }
    }, 404);
  }
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const applyMode: 'fill_empty' | 'overwrite' = body.apply_mode || 'fill_empty';
    const fieldsOverrides: Record<string, any> = body.fields_overrides || {};
    
    // ドキュメント取得
    const doc = await c.env.DB.prepare(`
      SELECT id, doc_type, extracted_json, confidence, status
      FROM company_documents 
      WHERE id = ? AND company_id = ?
    `).bind(documentId, companyId).first() as {
      id: string;
      doc_type: string;
      extracted_json: string | null;
      confidence: number | null;
      status: DocumentStatus;
    } | null;
    
    if (!doc) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      }, 404);
    }
    
    if (!doc.extracted_json) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NO_EXTRACTION', message: 'No extraction data available' }
      }, 400);
    }
    
    let extracted: DocumentExtracted;
    try {
      extracted = JSON.parse(doc.extracted_json);
    } catch (e) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_DATA', message: 'Invalid extraction data' }
      }, 500);
    }
    
    // 現在のデータ取得
    const company = await c.env.DB.prepare(`
      SELECT * FROM companies WHERE id = ?
    `).bind(companyId).first() as Record<string, any>;
    
    const profileData = await c.env.DB.prepare(`
      SELECT * FROM company_profile WHERE company_id = ?
    `).bind(companyId).first() as Record<string, any> | null;
    
    const now = new Date().toISOString();
    const appliedFields: string[] = [];
    const skippedFields: string[] = [];
    
    // companies テーブル更新
    const companyUpdates: string[] = [];
    const companyValues: any[] = [];
    
    // company_profile テーブル更新
    const profileUpdates: string[] = [];
    const profileValues: any[] = [];
    
    // 登記簿からの反映
    if (doc.doc_type === 'corp_registry') {
      const ext = extracted as CorpRegistryExtracted;
      
      // 会社名
      if (ext.company_name && (applyMode === 'overwrite' || !company?.name)) {
        const value = fieldsOverrides.company_name ?? ext.company_name;
        companyUpdates.push('name = ?');
        companyValues.push(value);
        appliedFields.push('company_name');
      } else if (ext.company_name) {
        skippedFields.push('company_name');
      }
      
      // 住所→都道府県/市区町村
      if (ext.address) {
        // 都道府県を抽出（簡易パース）
        const prefectureMatch = ext.address.match(/^(.+?[都道府県])/);
        const prefecture = prefectureMatch ? prefectureMatch[1] : null;
        const city = prefecture ? ext.address.replace(prefecture, '').trim() : ext.address;
        
        if (prefecture && (applyMode === 'overwrite' || !company?.prefecture)) {
          companyUpdates.push('prefecture = ?');
          companyValues.push(prefecture);
          appliedFields.push('prefecture');
        }
        if (city && (applyMode === 'overwrite' || !company?.city)) {
          companyUpdates.push('city = ?');
          companyValues.push(city);
          appliedFields.push('city');
        }
      }
      
      // 設立日
      if (ext.established_date && (applyMode === 'overwrite' || !company?.established_date)) {
        companyUpdates.push('established_date = ?');
        companyValues.push(ext.established_date);
        appliedFields.push('established_date');
      }
      
      // 資本金
      if (ext.capital && (applyMode === 'overwrite' || !company?.capital)) {
        companyUpdates.push('capital = ?');
        companyValues.push(ext.capital);
        appliedFields.push('capital');
      }
      
      // 代表者名
      if (ext.representative_name && (applyMode === 'overwrite' || !profileData?.representative_name)) {
        profileUpdates.push('representative_name = ?');
        profileValues.push(ext.representative_name);
        appliedFields.push('representative_name');
      }
      
      // 代表者役職
      if (ext.representative_title && (applyMode === 'overwrite' || !profileData?.representative_title)) {
        profileUpdates.push('representative_title = ?');
        profileValues.push(ext.representative_title);
        appliedFields.push('representative_title');
      }
      
      // 事業概要
      if (ext.business_purpose && ext.business_purpose.length > 0 && (applyMode === 'overwrite' || !profileData?.business_summary)) {
        profileUpdates.push('business_summary = ?');
        profileValues.push(ext.business_purpose.join('、'));
        appliedFields.push('business_summary');
      }
      
      // 法人番号
      if (ext.corp_number && (applyMode === 'overwrite' || !profileData?.corp_number)) {
        profileUpdates.push('corp_number = ?');
        profileValues.push(ext.corp_number);
        appliedFields.push('corp_number');
      }
    }
    
    // 決算書からの反映
    if (doc.doc_type === 'financials') {
      const ext = extracted as FinancialsExtracted;
      
      // 決算月
      if (ext.fiscal_year_end && (applyMode === 'overwrite' || !profileData?.fiscal_year_end)) {
        profileUpdates.push('fiscal_year_end = ?');
        profileValues.push(ext.fiscal_year_end);
        appliedFields.push('fiscal_year_end');
      }
      
      // 売上高→年商
      if (ext.sales && (applyMode === 'overwrite' || !company?.annual_revenue)) {
        companyUpdates.push('annual_revenue = ?');
        companyValues.push(ext.sales);
        appliedFields.push('annual_revenue');
      }
      
      // 従業員数
      if (ext.employee_count && (applyMode === 'overwrite' || !company?.employee_count)) {
        companyUpdates.push('employee_count = ?');
        companyValues.push(ext.employee_count);
        appliedFields.push('employee_count');
      }
      
      // 収益性
      if (ext.is_profitable !== undefined && (applyMode === 'overwrite' || profileData?.is_profitable === undefined)) {
        profileUpdates.push('is_profitable = ?');
        profileValues.push(ext.is_profitable ? 1 : 0);
        appliedFields.push('is_profitable');
      }
    }
    
    // DB更新実行
    const statements: D1PreparedStatement[] = [];
    
    if (companyUpdates.length > 0) {
      companyUpdates.push('updated_at = ?');
      companyValues.push(now, companyId);
      statements.push(
        c.env.DB.prepare(`UPDATE companies SET ${companyUpdates.join(', ')} WHERE id = ?`).bind(...companyValues)
      );
    }
    
    if (profileUpdates.length > 0) {
      if (profileData) {
        profileUpdates.push('updated_at = ?');
        profileValues.push(now, companyId);
        statements.push(
          c.env.DB.prepare(`UPDATE company_profile SET ${profileUpdates.join(', ')} WHERE company_id = ?`).bind(...profileValues)
        );
      } else {
        // company_profile がない場合は INSERT
        const insertFields = ['company_id', 'created_at', 'updated_at'];
        const insertValues: any[] = [companyId, now, now];
        
        // 各フィールドを追加
        if (profileUpdates.includes('representative_name = ?')) {
          insertFields.push('representative_name');
          insertValues.push(profileValues[profileUpdates.indexOf('representative_name = ?')]);
        }
        if (profileUpdates.includes('representative_title = ?')) {
          insertFields.push('representative_title');
          insertValues.push(profileValues[profileUpdates.indexOf('representative_title = ?')]);
        }
        if (profileUpdates.includes('business_summary = ?')) {
          insertFields.push('business_summary');
          insertValues.push(profileValues[profileUpdates.indexOf('business_summary = ?')]);
        }
        if (profileUpdates.includes('corp_number = ?')) {
          insertFields.push('corp_number');
          insertValues.push(profileValues[profileUpdates.indexOf('corp_number = ?')]);
        }
        if (profileUpdates.includes('fiscal_year_end = ?')) {
          insertFields.push('fiscal_year_end');
          insertValues.push(profileValues[profileUpdates.indexOf('fiscal_year_end = ?')]);
        }
        if (profileUpdates.includes('is_profitable = ?')) {
          insertFields.push('is_profitable');
          insertValues.push(profileValues[profileUpdates.indexOf('is_profitable = ?')]);
        }
        
        statements.push(
          c.env.DB.prepare(`INSERT INTO company_profile (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`).bind(...insertValues)
        );
      }
    }
    
    // ドキュメントステータスを applied に更新
    statements.push(
      c.env.DB.prepare(`UPDATE company_documents SET status = 'applied', updated_at = ? WHERE id = ?`).bind(now, documentId)
    );
    
    // 監査ログ
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO audit_log (id, actor_user_id, target_company_id, target_resource_type, target_resource_id, action, action_category, severity, details_json, created_at)
        VALUES (?, ?, ?, 'document', ?, 'DOCUMENT_EXTRACTION_APPLIED', 'document', 'info', ?, ?)
      `).bind(
        crypto.randomUUID(),
        user?.id || null,
        companyId,
        documentId,
        JSON.stringify({ applied_fields: appliedFields, skipped_fields: skippedFields, apply_mode: applyMode }),
        now
      )
    );
    
    await c.env.DB.batch(statements);
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        document_id: documentId,
        applied_fields: appliedFields,
        skipped_fields: skippedFields,
        apply_mode: applyMode,
        message: appliedFields.length > 0 
          ? `${appliedFields.length}件の項目を反映しました` 
          : '反映する項目がありませんでした（既に値が入力済みか、抽出データがありません）'
      }
    });
  } catch (error) {
    console.error('Apply extraction error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to apply extraction' }
    }, 500);
  }
});

export default profile;

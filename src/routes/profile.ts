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
// POST /api/profile/documents/:id/extract - 抽出開始
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
    // 所有権確認とドキュメント取得
    const doc = await c.env.DB.prepare(`
      SELECT id, doc_type, original_filename, content_type, size_bytes, r2_key, status
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
    } | null;
    
    if (!doc) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      }, 404);
    }
    
    // 既に抽出中または抽出済みの場合
    if (doc.status === 'extracting') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'ALREADY_PROCESSING', message: 'Document is already being processed' }
      }, 400);
    }
    
    // doc_type が Phase 1 対象でない場合
    if (!['corp_registry', 'financials'].includes(doc.doc_type)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'UNSUPPORTED_DOC_TYPE', message: `Document type '${doc.doc_type}' is not supported for extraction in Phase 1` }
      }, 400);
    }
    
    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();
    
    // ステータスを extracting に更新
    await c.env.DB.prepare(`
      UPDATE company_documents 
      SET status = 'extracting', updated_at = ?
      WHERE id = ?
    `).bind(now, documentId).run();
    
    // 監査ログ
    await c.env.DB.prepare(`
      INSERT INTO audit_log (id, actor_user_id, target_company_id, target_resource_type, target_resource_id, action, action_category, severity, details_json, created_at)
      VALUES (?, ?, ?, 'document', ?, 'DOCUMENT_EXTRACT_REQUESTED', 'document', 'info', ?, ?)
    `).bind(
      crypto.randomUUID(),
      user?.id || null,
      companyId,
      documentId,
      JSON.stringify({ doc_type: doc.doc_type, job_id: jobId }),
      now
    ).run();
    
    // AWS ジョブ投入（環境変数が設定されている場合のみ）
    const awsJobUrl = c.env.AWS_JOB_SUBMIT_URL;
    const internalSecret = c.env.INTERNAL_JWT_SECRET;
    
    let jobSubmitted = false;
    let jobError: string | null = null;
    
    if (awsJobUrl && internalSecret) {
      try {
        // R2からの署名付きURLを生成するか、直接R2キーを渡す
        const jobPayload = {
          job_id: jobId,
          job_type: 'document_extraction',
          document_id: documentId,
          company_id: companyId,
          doc_type: doc.doc_type,
          r2_key: doc.r2_key,
          content_type: doc.content_type,
          callback_url: `${c.req.url.split('/api/')[0]}/internal/document-extraction-callback`
        };
        
        // 内部JWT生成（簡易版）
        const tokenPayload = {
          iss: 'cloudflare-worker',
          sub: 'job-submit',
          scope: ['document:extract'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300 // 5分有効
        };
        const tokenHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const tokenPayloadB64 = btoa(JSON.stringify(tokenPayload));
        // 簡易的なHMAC署名（本番では適切な署名ライブラリを使用）
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(internalSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(`${tokenHeader}.${tokenPayloadB64}`)
        );
        const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
        const internalToken = `${tokenHeader}.${tokenPayloadB64}.${signatureB64}`;
        
        const response = await fetch(awsJobUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${internalToken}`
          },
          body: JSON.stringify(jobPayload)
        });
        
        if (response.ok) {
          jobSubmitted = true;
        } else {
          jobError = `AWS job submission failed: ${response.status}`;
          console.error('[Extract] AWS job submission failed:', response.status, await response.text());
        }
      } catch (e) {
        jobError = `AWS job submission error: ${e instanceof Error ? e.message : String(e)}`;
        console.error('[Extract] AWS job submission error:', e);
      }
    } else {
      // AWS連携が設定されていない場合はモック（開発用）
      console.log('[Extract] AWS_JOB_SUBMIT_URL not configured, using mock mode');
      jobSubmitted = false;
      jobError = 'AWS integration not configured (dev mode)';
    }
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        document_id: documentId,
        job_id: jobId,
        status: 'extracting',
        job_submitted: jobSubmitted,
        job_error: jobError,
        message: jobSubmitted 
          ? '抽出処理を開始しました。完了までしばらくお待ちください。' 
          : '抽出リクエストを受け付けました（AWS連携未設定のため、手動で結果を登録してください）'
      }
    });
  } catch (error) {
    console.error('Extract document error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to start extraction' }
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

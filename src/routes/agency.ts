/**
 * Agency (士業) API Routes
 * 
 * /api/agency - 士業向けAPI
 * - GET    /api/agency/dashboard    - ダッシュボード統計
 * - GET    /api/agency/clients      - 顧客一覧
 * - POST   /api/agency/clients      - 顧客追加
 * - GET    /api/agency/clients/:id  - 顧客詳細
 * - PUT    /api/agency/clients/:id  - 顧客更新
 * - DELETE /api/agency/clients/:id  - 顧客削除
 * - POST   /api/agency/links        - リンク発行
 * - GET    /api/agency/links        - リンク一覧
 * - DELETE /api/agency/links/:id    - リンク無効化
 * - GET    /api/agency/submissions  - 入力受付一覧
 * - POST   /api/agency/submissions/:id/approve - 入力承認
 * - POST   /api/agency/submissions/:id/reject  - 入力却下
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { sendStaffInviteEmail, sendClientInviteEmail } from '../services/email';

const agencyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// 全ルートで認証必須
agencyRoutes.use('/*', requireAuth);

// ヘルパー: ユーザーのagency取得
async function getUserAgency(db: D1Database, userId: string) {
  // まず自分がオーナーのagencyを探す
  const ownAgency = await db
    .prepare('SELECT * FROM agencies WHERE owner_user_id = ?')
    .bind(userId)
    .first();
  
  if (ownAgency) return { agency: ownAgency, role: 'owner' };
  
  // メンバーとして参加しているagencyを探す
  const membership = await db
    .prepare(`
      SELECT a.*, am.role_in_agency 
      FROM agency_members am
      JOIN agencies a ON am.agency_id = a.id
      WHERE am.user_id = ? AND am.accepted_at IS NOT NULL
    `)
    .bind(userId)
    .first();
  
  if (membership) {
    return { agency: membership, role: membership.role_in_agency };
  }
  
  return null;
}

// ヘルパー: UUID生成
function generateId(): string {
  return crypto.randomUUID();
}

// ヘルパー: トークン生成
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ヘルパー: トークンハッシュ化
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ヘルパー: 短縮コード生成
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GET /api/agency/me - 自分のagency情報取得（なければ作成）
 */
agencyRoutes.get('/me', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  let agencyInfo = await getUserAgency(db, user.id);
  
  // agencyがない場合、ユーザーがagencyロールなら自動作成
  if (!agencyInfo && user.role === 'agency') {
    const agencyId = generateId();
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO agencies (id, name, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(agencyId, `${user.email}の事務所`, user.id, now, now).run();
    
    agencyInfo = await getUserAgency(db, user.id);
  }
  
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: agencyInfo,
  });
});

/**
 * PUT /api/agency/me - agency情報更新
 */
agencyRoutes.put('/me', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const body = await c.req.json();
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo || agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only agency owner can update' },
    }, 403);
  }
  
  const { name, settings } = body;
  const now = new Date().toISOString();
  
  await db.prepare(`
    UPDATE agencies SET name = ?, settings_json = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    name || agencyInfo.agency.name,
    settings ? JSON.stringify(settings) : agencyInfo.agency.settings_json,
    now,
    agencyInfo.agency.id
  ).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Updated' },
  });
});

/**
 * GET /api/agency/dashboard - ダッシュボード統計
 */
agencyRoutes.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const today = new Date().toISOString().split('T')[0];
  
  // 統計取得
  const [
    totalClients,
    activeClients,
    pendingSubmissions,
    todaySearches,
    totalDrafts,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM agency_clients WHERE agency_id = ?')
      .bind(agencyId).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM agency_clients WHERE agency_id = ? AND status = ?')
      .bind(agencyId, 'active').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM intake_submissions WHERE agency_id = ? AND status = ?')
      .bind(agencyId, 'submitted').first<{ count: number }>(),
    db.prepare(`
      SELECT COUNT(*) as count FROM usage_events 
      WHERE event_type = 'SUBSIDY_SEARCH' 
      AND user_id IN (SELECT user_id FROM agency_members WHERE agency_id = ?)
      AND created_at >= ?
    `).bind(agencyId, today).first<{ count: number }>(),
    db.prepare(`
      SELECT COUNT(*) as count FROM application_drafts ad
      JOIN agency_clients ac ON ad.company_id = ac.company_id
      WHERE ac.agency_id = ?
    `).bind(agencyId).first<{ count: number }>(),
  ]);
  
  // 期限が近い補助金
  const upcomingDeadlines = await db.prepare(`
    SELECT DISTINCT sl.subsidy_id, sl.status, sl.deadline_at, ac.client_name, c.name as company_name
    FROM subsidy_lifecycle sl
    JOIN agency_clients ac ON 1=1
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
    AND sl.deadline_at IS NOT NULL
    AND sl.deadline_at > datetime('now')
    AND sl.deadline_at < datetime('now', '+14 days')
    ORDER BY sl.deadline_at ASC
    LIMIT 10
  `).bind(agencyId).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      stats: {
        totalClients: totalClients?.count || 0,
        activeClients: activeClients?.count || 0,
        pendingSubmissions: pendingSubmissions?.count || 0,
        todaySearches: todaySearches?.count || 0,
        totalDrafts: totalDrafts?.count || 0,
      },
      upcomingDeadlines: upcomingDeadlines?.results || [],
    },
  });
});

/**
 * GET /api/agency/clients - 顧客一覧
 */
agencyRoutes.get('/clients', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const { status, search, limit = '50', offset = '0' } = c.req.query();
  
  let query = `
    SELECT 
      ac.*,
      c.name as company_name,
      c.prefecture,
      c.industry_major as industry,
      c.employee_count,
      (SELECT COUNT(*) FROM application_drafts ad WHERE ad.company_id = ac.company_id) as draft_count,
      (SELECT MAX(created_at) FROM chat_sessions cs WHERE cs.company_id = ac.company_id) as last_chat_at
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
  `;
  const params: any[] = [agencyId];
  
  if (status) {
    query += ' AND ac.status = ?';
    params.push(status);
  }
  
  if (search) {
    query += ' AND (ac.client_name LIKE ? OR c.name LIKE ? OR ac.client_email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY ac.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const clients = await db.prepare(query).bind(...params).all();
  
  // 総数
  let countQuery = 'SELECT COUNT(*) as count FROM agency_clients ac WHERE ac.agency_id = ?';
  const countParams: any[] = [agencyId];
  if (status) {
    countQuery += ' AND ac.status = ?';
    countParams.push(status);
  }
  const total = await db.prepare(countQuery).bind(...countParams).first<{ count: number }>();
  
  // 凍結仕様: id を必ず返す + agency_client_id エイリアス追加（互換用）
  // id 欠損があればログ出力（データ健全性監視）
  const safeClients = (clients?.results || []).map((client: any) => {
    if (!client.id) {
      console.warn('[Agency API] client.id is missing:', JSON.stringify(client));
    }
    return {
      ...client,
      // 互換用エイリアス（UIが揺れても壊れない）
      agency_client_id: client.id,
      client_id: client.id,
    };
  });
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      clients: safeClients,
      total: total?.count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
});

/**
 * POST /api/agency/clients - 顧客追加
 */
agencyRoutes.post('/clients', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const body = await c.req.json();
  const { clientName, clientEmail, clientPhone, companyName, prefecture, industry, notes, tags } = body;
  
  if (!clientName || !companyName) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'clientName and companyName are required' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  // 会社を作成
  const companyId = generateId();
  // ⚠️ companiesテーブルには user_id カラムはない
  // 必須カラム: name, prefecture, industry_major, employee_count, employee_band
  await db.prepare(`
    INSERT INTO companies (id, name, prefecture, industry_major, employee_count, employee_band, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    companyId, 
    companyName, 
    prefecture || '13', // デフォルト: 東京都
    industry || '情報通信業', 
    0, // デフォルト従業員数
    '1-5', // デフォルト従業員帯
    now, 
    now
  ).run();
  
  // company_profileも作成（company_id がPK）
  await db.prepare(`
    INSERT INTO company_profile (company_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).bind(companyId, now, now).run();
  
  // agency_clientとして登録
  const clientId = generateId();
  await db.prepare(`
    INSERT INTO agency_clients (id, agency_id, company_id, client_name, client_email, client_phone, notes, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    clientId, agencyId, companyId, clientName,
    clientEmail || null, clientPhone || null, notes || null,
    tags ? JSON.stringify(tags) : null, now, now
  ).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { id: clientId, companyId },
  }, 201);
});

/**
 * GET /api/agency/clients/:id - 顧客詳細
 */
agencyRoutes.get('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const client = await db.prepare(`
    SELECT 
      ac.*,
      c.*,
      cp.*
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    LEFT JOIN company_profile cp ON c.id = cp.company_id
    WHERE ac.id = ? AND ac.agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  // 関連データ取得
  const [links, submissions, drafts, sessions] = await Promise.all([
    db.prepare('SELECT * FROM access_links WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM intake_submissions WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM application_drafts WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM chat_sessions WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
  ]);
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      client,
      links: links?.results || [],
      submissions: submissions?.results || [],
      drafts: drafts?.results || [],
      sessions: sessions?.results || [],
    },
  });
});

/**
 * PUT /api/agency/clients/:id - 顧客更新
 */
agencyRoutes.put('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const body = await c.req.json();
  const { clientName, clientEmail, clientPhone, status, notes, tags } = body;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE agency_clients SET
      client_name = COALESCE(?, client_name),
      client_email = COALESCE(?, client_email),
      client_phone = COALESCE(?, client_phone),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      tags_json = COALESCE(?, tags_json),
      updated_at = ?
    WHERE id = ? AND agency_id = ?
  `).bind(
    clientName || null, clientEmail || null, clientPhone || null,
    status || null, notes || null, tags ? JSON.stringify(tags) : null,
    now, clientId, agencyInfo.agency.id
  ).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Updated' },
  });
});

/**
 * PUT /api/agency/clients/:id/company - 顧客企業情報更新
 * 
 * agency_clientsではなく、紐付いたcompaniesテーブルを更新
 */
agencyRoutes.put('/clients/:id/company', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // 顧客の所有確認とcompany_id取得
  const client = await db.prepare(`
    SELECT company_id FROM agency_clients WHERE id = ? AND agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first<{ company_id: string }>();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  const body = await c.req.json();
  const { 
    companyName, prefecture, city, industry_major, industry_minor,
    employee_count, capital, established_date, annual_revenue,
    representative_name, website_url, contact_email, contact_phone,
    business_summary
  } = body;
  
  const now = new Date().toISOString();
  
  // companiesテーブルを更新
  const companyUpdateFields: string[] = [];
  const companyUpdateValues: any[] = [];
  
  if (companyName !== undefined) {
    companyUpdateFields.push('name = ?');
    companyUpdateValues.push(companyName);
  }
  if (prefecture !== undefined) {
    companyUpdateFields.push('prefecture = ?');
    companyUpdateValues.push(prefecture);
  }
  if (city !== undefined) {
    companyUpdateFields.push('city = ?');
    companyUpdateValues.push(city);
  }
  if (industry_major !== undefined) {
    companyUpdateFields.push('industry_major = ?');
    companyUpdateValues.push(industry_major);
  }
  if (industry_minor !== undefined) {
    companyUpdateFields.push('industry_minor = ?');
    companyUpdateValues.push(industry_minor);
  }
  if (employee_count !== undefined) {
    companyUpdateFields.push('employee_count = ?');
    companyUpdateValues.push(employee_count);
    // employee_bandも更新
    const band = employee_count <= 5 ? '1-5' : 
                 employee_count <= 20 ? '6-20' :
                 employee_count <= 50 ? '21-50' :
                 employee_count <= 100 ? '51-100' :
                 employee_count <= 300 ? '101-300' : '301+';
    companyUpdateFields.push('employee_band = ?');
    companyUpdateValues.push(band);
  }
  if (capital !== undefined) {
    companyUpdateFields.push('capital = ?');
    companyUpdateValues.push(capital);
  }
  if (established_date !== undefined) {
    companyUpdateFields.push('established_date = ?');
    companyUpdateValues.push(established_date);
  }
  if (annual_revenue !== undefined) {
    companyUpdateFields.push('annual_revenue = ?');
    companyUpdateValues.push(annual_revenue);
  }
  
  if (companyUpdateFields.length > 0) {
    companyUpdateFields.push('updated_at = ?');
    companyUpdateValues.push(now);
    companyUpdateValues.push(client.company_id);
    
    await db.prepare(`
      UPDATE companies SET ${companyUpdateFields.join(', ')} WHERE id = ?
    `).bind(...companyUpdateValues).run();
  }
  
  // company_profileテーブルを更新
  const profileUpdateFields: string[] = [];
  const profileUpdateValues: any[] = [];
  
  if (representative_name !== undefined) {
    profileUpdateFields.push('representative_name = ?');
    profileUpdateValues.push(representative_name);
  }
  if (website_url !== undefined) {
    profileUpdateFields.push('website_url = ?');
    profileUpdateValues.push(website_url);
  }
  if (contact_email !== undefined) {
    profileUpdateFields.push('contact_email = ?');
    profileUpdateValues.push(contact_email);
  }
  if (contact_phone !== undefined) {
    profileUpdateFields.push('contact_phone = ?');
    profileUpdateValues.push(contact_phone);
  }
  if (business_summary !== undefined) {
    profileUpdateFields.push('business_summary = ?');
    profileUpdateValues.push(business_summary);
  }
  
  if (profileUpdateFields.length > 0) {
    profileUpdateFields.push('updated_at = ?');
    profileUpdateValues.push(now);
    profileUpdateValues.push(client.company_id);
    
    await db.prepare(`
      UPDATE company_profile SET ${profileUpdateFields.join(', ')} WHERE company_id = ?
    `).bind(...profileUpdateValues).run();
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Company information updated' },
  });
});

/**
 * POST /api/agency/links - リンク発行
 */
agencyRoutes.post('/links', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const body = await c.req.json();
  const { companyId, sessionId, type, expiresInDays = 7, maxUses = 1, label, message, sendEmail = false, recipientEmail } = body;
  
  if (!companyId || !type) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'companyId and type are required' },
    }, 400);
  }
  
  if (!['intake', 'chat', 'upload'].includes(type)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid type. Must be intake, chat, or upload' },
    }, 400);
  }
  
  // 顧客の所有確認
  const client = await db.prepare(`
    SELECT * FROM agency_clients WHERE company_id = ? AND agency_id = ?
  `).bind(companyId, agencyInfo.agency.id).first();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  const linkId = generateId();
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const shortCode = generateShortCode();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO access_links (
      id, agency_id, company_id, session_id, type, token_hash, short_code,
      expires_at, max_uses, issued_by_user_id, label, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    linkId, agencyInfo.agency.id, companyId, sessionId || null, type,
    tokenHash, shortCode, expiresAt, maxUses, user.id, label || null, message || null, now
  ).run();
  
  // 生成されたURLを返す（tokenは一度だけ）
  const baseUrl = new URL(c.req.url).origin;
  const linkUrl = `${baseUrl}/${type}?code=${shortCode}`;
  
  // メール送信（オプション）
  let emailSent = false;
  const clientRecord = client as any;
  const emailRecipient = recipientEmail || clientRecord.client_email;
  
  if (sendEmail && emailRecipient) {
    const inviterUser = await db.prepare('SELECT name FROM users WHERE id = ?')
      .bind(user.id).first<{ name: string }>();
    
    const emailResult = await sendClientInviteEmail(c.env, {
      to: emailRecipient,
      inviterName: inviterUser?.name || '担当者',
      agencyName: agencyInfo.agency.name,
      clientName: clientRecord.client_name || '顧客',
      inviteUrl: linkUrl,
      expiresAt,
      message: message || undefined,
    });
    emailSent = emailResult.success;
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      id: linkId,
      shortCode,
      url: linkUrl,
      token, // ⚠️ これは一度だけ表示される
      expiresAt,
      type,
      email_sent: emailSent,
    },
  }, 201);
});

/**
 * GET /api/agency/links - リンク一覧
 */
agencyRoutes.get('/links', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const { companyId, type, active } = c.req.query();
  
  let query = `
    SELECT al.*, ac.client_name, c.name as company_name
    FROM access_links al
    JOIN agency_clients ac ON al.company_id = ac.company_id AND al.agency_id = ac.agency_id
    JOIN companies c ON al.company_id = c.id
    WHERE al.agency_id = ?
  `;
  const params: any[] = [agencyInfo.agency.id];
  
  if (companyId) {
    query += ' AND al.company_id = ?';
    params.push(companyId);
  }
  
  if (type) {
    query += ' AND al.type = ?';
    params.push(type);
  }
  
  if (active === 'true') {
    query += ' AND al.revoked_at IS NULL AND al.expires_at > datetime("now") AND (al.max_uses IS NULL OR al.used_count < al.max_uses)';
  }
  
  query += ' ORDER BY al.created_at DESC LIMIT 100';
  
  const links = await db.prepare(query).bind(...params).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { links: links?.results || [] },
  });
});

/**
 * DELETE /api/agency/links/:id - リンク無効化
 */
agencyRoutes.delete('/links/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const linkId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE access_links SET revoked_at = ? WHERE id = ? AND agency_id = ?
  `).bind(now, linkId, agencyInfo.agency.id).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Link not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Link revoked' },
  });
});

/**
 * GET /api/agency/submissions - 入力受付一覧
 */
agencyRoutes.get('/submissions', async (c) => {
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
agencyRoutes.post('/submissions/:id/approve', async (c) => {
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
agencyRoutes.post('/submissions/:id/reject', async (c) => {
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
  
  const body = await c.req.json();
  const { reason } = body;
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

// =====================================================
// スタッフ管理 API
// =====================================================

/**
 * GET /api/agency/members - スタッフ一覧
 */
agencyRoutes.get('/members', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  // オーナー情報を取得
  const owner = await db.prepare(`
    SELECT u.id, u.email, u.name, 'owner' as role_in_agency, a.created_at as joined_at
    FROM agencies a
    JOIN users u ON a.owner_user_id = u.id
    WHERE a.id = ?
  `).bind(agencyId).first();
  
  // メンバー一覧取得
  const members = await db.prepare(`
    SELECT 
      am.id as membership_id,
      am.role_in_agency,
      am.accepted_at as joined_at,
      u.id as user_id,
      u.email,
      u.name
    FROM agency_members am
    JOIN users u ON am.user_id = u.id
    WHERE am.agency_id = ? AND am.accepted_at IS NOT NULL
    ORDER BY am.accepted_at DESC
  `).bind(agencyId).all();
  
  // 保留中の招待一覧
  const pendingInvites = await db.prepare(`
    SELECT 
      id,
      email,
      role_in_agency,
      invite_code,
      expires_at,
      created_at
    FROM agency_member_invites
    WHERE agency_id = ? 
      AND accepted_at IS NULL 
      AND revoked_at IS NULL
      AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).bind(agencyId).all();
  
  // オーナーを含めた全メンバーリスト
  const allMembers = [];
  if (owner) {
    allMembers.push({
      user_id: owner.id,
      email: owner.email,
      name: owner.name,
      role: 'owner',
      joined_at: owner.joined_at,
      is_owner: true,
    });
  }
  
  for (const m of (members.results || []) as any[]) {
    allMembers.push({
      membership_id: m.membership_id,
      user_id: m.user_id,
      email: m.email,
      name: m.name,
      role: m.role_in_agency,
      joined_at: m.joined_at,
      is_owner: false,
    });
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      members: allMembers,
      pending_invites: pendingInvites.results || [],
      current_user_role: agencyInfo.role,
    },
  });
});

/**
 * POST /api/agency/members/invite - スタッフ招待
 */
agencyRoutes.post('/members/invite', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーまたは管理者のみ招待可能
  if (agencyInfo.role !== 'owner' && agencyInfo.role !== 'admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner or admin can invite members' },
    }, 403);
  }
  
  const body = await c.req.json();
  const { email, role = 'staff', sendEmail = false } = body;
  
  if (!email) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'email is required' },
    }, 400);
  }
  
  // 有効な役割のみ
  if (!['admin', 'staff'].includes(role)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid role. Must be admin or staff' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  // 既にメンバーか確認
  const existingMember = await db.prepare(`
    SELECT am.id FROM agency_members am
    JOIN users u ON am.user_id = u.id
    WHERE am.agency_id = ? AND u.email = ? AND am.accepted_at IS NOT NULL
  `).bind(agencyId, email).first();
  
  if (existingMember) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_MEMBER', message: 'This email is already a member' },
    }, 400);
  }
  
  // 既に保留中の招待があるか確認
  const existingInvite = await db.prepare(`
    SELECT id FROM agency_member_invites
    WHERE agency_id = ? AND email = ? 
      AND accepted_at IS NULL 
      AND revoked_at IS NULL
      AND expires_at > datetime('now')
  `).bind(agencyId, email).first();
  
  if (existingInvite) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_INVITED', message: 'A pending invite already exists for this email' },
    }, 400);
  }
  
  // 招待トークン生成
  const inviteToken = generateToken();
  const inviteTokenHash = await hashToken(inviteToken);
  const inviteCode = generateShortCode();
  const inviteId = generateId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7日後
  
  await db.prepare(`
    INSERT INTO agency_member_invites (
      id, agency_id, email, role_in_agency, invite_token_hash, invite_code,
      invited_by_user_id, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inviteId, agencyId, email, role, inviteTokenHash, inviteCode,
    user.id, expiresAt, now
  ).run();
  
  // 招待URLを生成（実際の本番URLを使用）
  const baseUrl = c.req.header('origin') || 'https://hojyokin.pages.dev';
  const inviteUrl = `${baseUrl}/agency/join?code=${inviteCode}&token=${inviteToken}`;
  
  // メール送信（オプション）
  let emailSent = false;
  let emailError: string | undefined;
  console.log('[Invite] sendEmail flag:', sendEmail, 'type:', typeof sendEmail);
  
  if (sendEmail) {
    console.log('[Invite] Attempting to send invite email to:', email);
    const inviterUser = await db.prepare('SELECT name FROM users WHERE id = ?')
      .bind(user.id).first<{ name: string }>();
    
    const emailResult = await sendStaffInviteEmail(c.env, {
      to: email,
      inviterName: inviterUser?.name || user.email || '管理者',
      agencyName: agencyInfo.agency.name,
      inviteUrl,
      role,
      expiresAt,
    });
    emailSent = emailResult.success;
    emailError = emailResult.error;
    console.log('[Invite] Email result:', { sent: emailSent, error: emailError });
  } else {
    console.log('[Invite] Email sending skipped - sendEmail is false or falsy');
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      invite_id: inviteId,
      email,
      role,
      invite_code: inviteCode,
      invite_url: inviteUrl,
      expires_at: expiresAt,
      email_sent: emailSent,
      message: sendEmail && emailSent 
        ? 'Invite created and email sent.'
        : 'Invite created. Share the invite URL with the user.',
    },
  }, 201);
});

/**
 * DELETE /api/agency/members/invite/:id - 招待取り消し
 */
agencyRoutes.delete('/members/invite/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const inviteId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーまたは管理者のみ取り消し可能
  if (agencyInfo.role !== 'owner' && agencyInfo.role !== 'admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner or admin can revoke invites' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE agency_member_invites 
    SET revoked_at = ?, revoked_by_user_id = ?
    WHERE id = ? AND agency_id = ? AND accepted_at IS NULL AND revoked_at IS NULL
  `).bind(now, user.id, inviteId, agencyId).run();
  
  if (result.meta.changes === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Invite not found or already processed' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Invite revoked' },
  });
});

/**
 * POST /api/agency/members/join - 招待受諾
 * 
 * Body: { code: string, token: string }
 */
agencyRoutes.post('/members/join', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const body = await c.req.json();
  const { code, token } = body;
  
  if (!code || !token) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'code and token are required' },
    }, 400);
  }
  
  // 招待を検索
  const tokenHash = await hashToken(token);
  const invite = await db.prepare(`
    SELECT * FROM agency_member_invites
    WHERE invite_code = ? AND invite_token_hash = ?
      AND accepted_at IS NULL 
      AND revoked_at IS NULL
      AND expires_at > datetime('now')
  `).bind(code, tokenHash).first<any>();
  
  if (!invite) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_INVITE', message: 'Invalid or expired invite' },
    }, 400);
  }
  
  // メールアドレスが一致するか確認（セキュリティ強化）
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { 
        code: 'EMAIL_MISMATCH', 
        message: `この招待は ${invite.email} 宛てに送信されました。招待を受諾するには、そのメールアドレスでログインしてください。` 
      },
    }, 403);
  }
  
  // 既にメンバーでないか確認
  const existingMember = await db.prepare(`
    SELECT id FROM agency_members
    WHERE agency_id = ? AND user_id = ?
  `).bind(invite.agency_id, user.id).first();
  
  if (existingMember) {
    // 既に存在する場合は accepted_at を更新
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE agency_members 
      SET accepted_at = ?, role_in_agency = ?
      WHERE agency_id = ? AND user_id = ?
    `).bind(now, invite.role_in_agency, invite.agency_id, user.id).run();
  } else {
    // 新規メンバー追加
    const memberId = generateId();
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO agency_members (
        id, agency_id, user_id, role_in_agency, invited_at, accepted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      memberId, invite.agency_id, user.id, invite.role_in_agency,
      invite.created_at, now, now
    ).run();
  }
  
  // 招待を受諾済みに更新
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE agency_member_invites
    SET accepted_at = ?, accepted_by_user_id = ?
    WHERE id = ?
  `).bind(now, user.id, invite.id).run();
  
  // ユーザーのロールをagencyに変更（まだagencyロールでない場合）
  if (user.role !== 'agency') {
    await db.prepare(`
      UPDATE users SET role = 'agency', updated_at = ?
      WHERE id = ? AND role = 'user'
    `).bind(now, user.id).run();
  }
  
  // agency情報を取得
  const agency = await db.prepare('SELECT * FROM agencies WHERE id = ?')
    .bind(invite.agency_id).first();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      message: 'Successfully joined the agency',
      agency: {
        id: agency?.id,
        name: agency?.name,
      },
      role: invite.role_in_agency,
    },
  });
});

/**
 * DELETE /api/agency/members/:id - メンバー削除（オーナーのみ）
 */
agencyRoutes.delete('/members/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const memberId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーのみ削除可能
  if (agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner can remove members' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  // 自分自身は削除不可
  const member = await db.prepare(`
    SELECT user_id FROM agency_members WHERE id = ? AND agency_id = ?
  `).bind(memberId, agencyId).first<any>();
  
  if (!member) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Member not found' },
    }, 404);
  }
  
  if (member.user_id === user.id) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CANNOT_REMOVE_SELF', message: 'Cannot remove yourself' },
    }, 400);
  }
  
  await db.prepare(`
    DELETE FROM agency_members WHERE id = ? AND agency_id = ?
  `).bind(memberId, agencyId).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Member removed' },
  });
});

/**
 * PUT /api/agency/members/:id/role - メンバー役割変更（オーナーのみ）
 */
agencyRoutes.put('/members/:id/role', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const memberId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーのみ役割変更可能
  if (agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner can change member roles' },
    }, 403);
  }
  
  const body = await c.req.json();
  const { role } = body;
  
  if (!['admin', 'staff'].includes(role)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid role' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  const result = await db.prepare(`
    UPDATE agency_members 
    SET role_in_agency = ?
    WHERE id = ? AND agency_id = ?
  `).bind(role, memberId, agencyId).run();
  
  if (result.meta.changes === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Member not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Role updated', role },
  });
});

/**
 * PUT /api/agency/settings - 事務所設定更新（オーナーのみ）
 */
agencyRoutes.put('/settings', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーのみ設定変更可能
  if (agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner can update agency settings' },
    }, 403);
  }
  
  const body = await c.req.json();
  const { name } = body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required' },
    }, 400);
  }
  
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE agencies SET name = ?, updated_at = ? WHERE id = ?
  `).bind(name.trim(), now, agencyInfo.agency.id).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Agency settings updated', name: name.trim() },
  });
});

export { agencyRoutes };

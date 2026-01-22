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
      c.industry,
      c.employee_count,
      cp.completeness_score,
      (SELECT COUNT(*) FROM application_drafts ad WHERE ad.company_id = ac.company_id) as draft_count,
      (SELECT MAX(created_at) FROM chat_sessions cs WHERE cs.company_id = ac.company_id) as last_chat_at
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    LEFT JOIN company_profile cp ON c.id = cp.company_id
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
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      clients: clients?.results || [],
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
  await db.prepare(`
    INSERT INTO companies (id, user_id, name, prefecture, industry, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(companyId, user.id, companyName, prefecture || null, industry || null, now, now).run();
  
  // company_profileも作成
  await db.prepare(`
    INSERT INTO company_profile (id, company_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(generateId(), companyId, now, now).run();
  
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
  const { companyId, sessionId, type, expiresInDays = 7, maxUses = 1, label, message } = body;
  
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
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      id: linkId,
      shortCode,
      url: linkUrl,
      token, // ⚠️ これは一度だけ表示される
      expiresAt,
      type,
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
  const payload = JSON.parse(submission.payload_json || '{}');
  
  // 会社情報を更新
  if (Object.keys(payload).length > 0) {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    const allowedFields = ['name', 'prefecture', 'city', 'industry', 'employee_count', 'capital', 'founded_date'];
    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(payload[field]);
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

export { agencyRoutes };

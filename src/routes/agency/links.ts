/**
 * Agency: アクセスリンク管理
 * 
 * POST   /links     - リンク発行
 * GET    /links     - リンク一覧
 * DELETE /links/:id - リンク無効化
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, generateId, generateToken, hashToken, generateShortCode, parseIntWithLimits, safeParseJsonBody, LIMITS } from './_helpers';
import { sendClientInviteEmail } from '../../services/email';

const links = new Hono<{ Bindings: Env; Variables: Variables }>();

links.post('/links', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    companyId?: string;
    sessionId?: string;
    type?: string;
    expiresInDays?: number;
    maxUses?: number;
    label?: string;
    message?: string;
    sendEmail?: boolean;
    recipientEmail?: string;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { companyId, sessionId, type, label, message, sendEmail = false, recipientEmail } = parseResult.data;
  
  // P0-3: 境界値チェック
  const safeExpiresInDays = parseIntWithLimits(
    String(parseResult.data.expiresInDays ?? LIMITS.DEFAULT_EXPIRES_DAYS),
    LIMITS.DEFAULT_EXPIRES_DAYS,
    LIMITS.MIN_EXPIRES_DAYS,
    LIMITS.MAX_EXPIRES_DAYS
  );
  const safeMaxUses = parseIntWithLimits(
    String(parseResult.data.maxUses ?? LIMITS.DEFAULT_MAX_USES),
    LIMITS.DEFAULT_MAX_USES,
    LIMITS.MIN_MAX_USES,
    LIMITS.MAX_MAX_USES
  );
  
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
  const expiresAt = new Date(Date.now() + safeExpiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO access_links (
      id, agency_id, company_id, session_id, type, token_hash, short_code,
      expires_at, max_uses, issued_by_user_id, label, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    linkId, agencyInfo.agency.id, companyId, sessionId || null, type,
    tokenHash, shortCode, expiresAt, safeMaxUses, user.id, label || null, message || null, now
  ).run();
  
  // 生成されたURLを返す（tokenは一度だけ）
  // 注意: c.req.url は信頼できないため、本番URLを固定
  const baseUrl = (c.env as any).APP_URL || 'https://hojyokin.pages.dev';
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
  
  // P0-2: トークン露出リスク対策 - キャッシュ禁止ヘッダー追加
  // トークンは一度だけ表示されるため、ログやキャッシュに残らないようにする
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  c.header('Pragma', 'no-cache');
  
  return c.json<ApiResponse<{
    id: string;
    shortCode: string;
    url: string;
    token: string;  // WARNING: ワンタイムトークン - ログに記録しないこと
    expiresAt: string;
    type: string;
    email_sent: boolean;
  }>>({
    success: true,
    data: {
      id: linkId,
      shortCode,
      url: linkUrl,
      token, // WARNING: ワンタイムトークン - この値はログに記録しないこと
      expiresAt,
      type,
      email_sent: emailSent,
    },
  }, 201);
});

/**
 * GET /api/agency/links - リンク一覧
 */
links.get('/links', async (c) => {
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
links.delete('/links/:id', async (c) => {
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

export default links;

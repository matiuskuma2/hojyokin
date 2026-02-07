/**
 * Agency: スタッフ管理（credential方式）
 * 
 * POST   /staff/verify-invite  - 招待トークン検証
 * POST   /staff/setup-password - パスワード設定
 * GET    /staff                - スタッフ一覧
 * DELETE /staff/:id            - スタッフ削除
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, hashToken, safeParseJsonBody } from './_helpers';
import { hashPassword, validatePasswordStrength } from '../../lib/password';
import { signJWT } from '../../lib/jwt';

const staff = new Hono<{ Bindings: Env; Variables: Variables }>();

staff.post('/staff/verify-invite', async (c) => {
  const db = c.env.DB;
  
  const parseResult = await safeParseJsonBody<{
    code?: string;
    token?: string;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { code, token } = parseResult.data;
  
  if (!code || !token) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'code and token are required' },
    }, 400);
  }
  
  const tokenHash = await hashToken(token);
  
  // 招待を検証
  const staff = await db.prepare(`
    SELECT 
      sc.id, sc.agency_id, sc.staff_email, sc.staff_name, sc.role,
      sc.staff_password_hash, sc.invite_expires_at,
      a.name as agency_name
    FROM agency_staff_credentials sc
    JOIN agencies a ON a.id = sc.agency_id
    WHERE sc.invite_code = ? AND sc.invite_token_hash = ?
      AND sc.is_active = 1
  `).bind(code, tokenHash).first<any>();
  
  if (!staff) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_INVITE', message: '招待が見つかりません。リンクが無効か期限切れです。' },
    }, 400);
  }
  
  // 期限チェック
  if (staff.invite_expires_at && new Date(staff.invite_expires_at) < new Date()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVITE_EXPIRED', message: '招待の有効期限が切れています。管理者に再招待を依頼してください。' },
    }, 400);
  }
  
  // パスワード設定済みかチェック
  if (staff.staff_password_hash) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        status: 'already_setup',
        message: 'パスワードは既に設定済みです。ログインしてください。',
        staff_email: staff.staff_email,
        agency_name: staff.agency_name,
      },
    });
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      status: 'pending_setup',
      staff_id: staff.id,
      staff_email: staff.staff_email,
      staff_name: staff.staff_name,
      role: staff.role,
      agency_name: staff.agency_name,
    },
  });
});

/**
 * POST /api/agency/staff/setup-password - スタッフパスワード設定
 * 認証不要 - 招待からパスワードを設定
 */
staff.post('/staff/setup-password', async (c) => {
  const db = c.env.DB;
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  
  const parseResult = await safeParseJsonBody<{
    code?: string;
    token?: string;
    password?: string;
    name?: string;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { code, token, password, name } = parseResult.data;
  
  if (!code || !token || !password) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'code, token, and password are required' },
    }, 400);
  }
  
  // パスワード強度チェック
  const passwordErrors = validatePasswordStrength(password);
  if (passwordErrors.length > 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'WEAK_PASSWORD',
        message: passwordErrors.join(', '),
        details: passwordErrors,
      },
    }, 400);
  }
  
  const tokenHash = await hashToken(token);
  
  // 招待を検証
  const staff = await db.prepare(`
    SELECT 
      sc.id, sc.agency_id, sc.staff_email, sc.staff_name, sc.role,
      sc.staff_password_hash, sc.invite_expires_at,
      a.name as agency_name, a.owner_user_id
    FROM agency_staff_credentials sc
    JOIN agencies a ON a.id = sc.agency_id
    WHERE sc.invite_code = ? AND sc.invite_token_hash = ?
      AND sc.is_active = 1
  `).bind(code, tokenHash).first<any>();
  
  if (!staff) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_INVITE', message: '招待が見つかりません。リンクが無効か期限切れです。' },
    }, 400);
  }
  
  // 期限チェック
  if (staff.invite_expires_at && new Date(staff.invite_expires_at) < new Date()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVITE_EXPIRED', message: '招待の有効期限が切れています。' },
    }, 400);
  }
  
  // パスワード設定済みチェック
  if (staff.staff_password_hash) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_SETUP', message: 'パスワードは既に設定済みです。ログインしてください。' },
    }, 400);
  }
  
  // パスワードをハッシュ化して保存
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  
  await db.prepare(`
    UPDATE agency_staff_credentials SET
      staff_password_hash = ?,
      staff_name = COALESCE(?, staff_name),
      password_set_at = ?,
      invite_token_hash = NULL,
      invite_code = NULL,
      invite_expires_at = NULL,
      updated_at = ?
    WHERE id = ?
  `).bind(passwordHash, name, now, now, staff.id).run();
  
  // エージェンシーオーナーの情報を取得してJWT発行
  const ownerUser = await db.prepare('SELECT * FROM users WHERE id = ?')
    .bind(staff.owner_user_id).first<any>();
  
  if (!ownerUser) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Agency owner not found' },
    }, 500);
  }
  
  // 最終ログイン更新
  await db.prepare(`
    UPDATE agency_staff_credentials 
    SET last_login_at = ?, last_login_ip = ?
    WHERE id = ?
  `).bind(now, requestIp, staff.id).run();
  
  // JWT発行（オーナーのuser_idで発行）
  const jwtToken = await signJWT(
    { id: ownerUser.id, email: ownerUser.email, role: ownerUser.role },
    c.env
  );
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      message: 'パスワード設定が完了しました。ログインしました。',
      token: jwtToken,
      user: {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
        role: ownerUser.role,
      },
      staff: {
        staff_id: staff.id,
        staff_email: staff.staff_email,
        staff_name: name || staff.staff_name,
        staff_role: staff.role,
        agency_id: staff.agency_id,
        agency_name: staff.agency_name,
      },
    },
  });
});

/**
 * GET /api/agency/staff - スタッフ一覧取得
 */
staff.get('/staff', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const staffList = await db.prepare(`
    SELECT 
      id, staff_email, staff_name, role,
      CASE WHEN staff_password_hash IS NOT NULL THEN 1 ELSE 0 END as is_setup,
      invited_at, password_set_at, last_login_at, is_active
    FROM agency_staff_credentials
    WHERE agency_id = ?
    ORDER BY created_at DESC
  `).bind(agencyInfo.agency.id).all<any>();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      staff: staffList.results || [],
    },
  });
});

/**
 * DELETE /api/agency/staff/:id - スタッフ削除
 */
staff.delete('/staff/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const staffId = c.req.param('id');
  
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
      error: { code: 'FORBIDDEN', message: 'Only owner can delete staff' },
    }, 403);
  }
  
  const result = await db.prepare(`
    UPDATE agency_staff_credentials 
    SET is_active = 0, updated_at = ?
    WHERE id = ? AND agency_id = ?
  `).bind(new Date().toISOString(), staffId, agencyInfo.agency.id).run();
  
  if (!result.meta?.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Staff not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'スタッフを削除しました' },
  });
});

export default staff;

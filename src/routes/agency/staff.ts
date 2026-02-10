/**
 * Agency: スタッフ管理（credential方式）
 * 
 * === 認証不要（公開）エンドポイント ===
 * POST   /staff/verify-invite  - 招待トークン検証
 * POST   /staff/setup-password - パスワード設定
 * 
 * === 認証必須エンドポイント ===
 * GET    /staff                - スタッフ一覧
 * DELETE /staff/:id            - スタッフ削除（無効化）
 * 
 * 設計方針:
 * - スタッフは agency_staff_credentials テーブルで管理
 * - スタッフログイン時はオーナーのuser_idでJWTを発行するが、
 *   staff_context claimでスタッフ情報を含める（監査・追跡用）
 * - verify-invite / setup-password は認証不要（新規スタッフは
 *   JWTトークンを持っていないため）
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, hashToken, safeParseJsonBody } from './_helpers';
import { hashPassword, validatePasswordStrength } from '../../lib/password';
import { signJWT } from '../../lib/jwt';

// =====================================================
// 公開エンドポイント（認証不要）
// =====================================================
const staffPublicRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /api/agency/staff/verify-invite - 招待トークン検証
 * 認証不要 - 招待リンクからアクセスする新規スタッフ用
 */
staffPublicRoutes.post('/staff/verify-invite', async (c) => {
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
  
  // トークン長のサニティチェック（過剰な入力を防止）
  if (code.length > 100 || token.length > 200) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid code or token format' },
    }, 400);
  }
  
  const tokenHash = await hashToken(token);
  
  // 招待を検証（agency_id も含めて取得）
  const staffRecord = await db.prepare(`
    SELECT 
      sc.id, sc.agency_id, sc.staff_email, sc.staff_name, sc.role,
      sc.staff_password_hash, sc.invite_expires_at, sc.is_active,
      a.name as agency_name
    FROM agency_staff_credentials sc
    JOIN agencies a ON a.id = sc.agency_id
    WHERE sc.invite_code = ? AND sc.invite_token_hash = ?
      AND sc.is_active = 1
  `).bind(code, tokenHash).first<any>();
  
  if (!staffRecord) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_INVITE', message: '招待が見つかりません。リンクが無効か期限切れです。' },
    }, 400);
  }
  
  // 期限チェック
  if (staffRecord.invite_expires_at && new Date(staffRecord.invite_expires_at) < new Date()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVITE_EXPIRED', message: '招待の有効期限が切れています。管理者に再招待を依頼してください。' },
    }, 400);
  }
  
  // パスワード設定済みかチェック
  if (staffRecord.staff_password_hash) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        status: 'already_setup',
        message: 'パスワードは既に設定済みです。ログインしてください。',
        staff_email: staffRecord.staff_email,
        agency_name: staffRecord.agency_name,
      },
    });
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      status: 'pending_setup',
      staff_id: staffRecord.id,
      staff_email: staffRecord.staff_email,
      staff_name: staffRecord.staff_name,
      role: staffRecord.role,
      agency_name: staffRecord.agency_name,
    },
  });
});

/**
 * POST /api/agency/staff/setup-password - スタッフパスワード設定
 * 認証不要 - 招待からパスワードを設定
 */
staffPublicRoutes.post('/staff/setup-password', async (c) => {
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
  
  // 入力長のサニティチェック
  if (code.length > 100 || token.length > 200) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid code or token format' },
    }, 400);
  }
  
  // name のサニタイズ（XSS対策: HTMLタグを除去）
  const sanitizedName = name ? name.replace(/<[^>]*>/g, '').trim().slice(0, 100) : null;
  
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
  
  // 招待を検証（agency_id 絞込付き）
  const staffRecord = await db.prepare(`
    SELECT 
      sc.id, sc.agency_id, sc.staff_email, sc.staff_name, sc.role,
      sc.staff_password_hash, sc.invite_expires_at,
      a.name as agency_name, a.owner_user_id
    FROM agency_staff_credentials sc
    JOIN agencies a ON a.id = sc.agency_id
    WHERE sc.invite_code = ? AND sc.invite_token_hash = ?
      AND sc.is_active = 1
  `).bind(code, tokenHash).first<any>();
  
  if (!staffRecord) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_INVITE', message: '招待が見つかりません。リンクが無効か期限切れです。' },
    }, 400);
  }
  
  // 期限チェック
  if (staffRecord.invite_expires_at && new Date(staffRecord.invite_expires_at) < new Date()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVITE_EXPIRED', message: '招待の有効期限が切れています。' },
    }, 400);
  }
  
  // パスワード設定済みチェック
  if (staffRecord.staff_password_hash) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_SETUP', message: 'パスワードは既に設定済みです。ログインしてください。' },
    }, 400);
  }
  
  // パスワードをハッシュ化して保存
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  
  // パスワード設定 & 招待トークンをクリア
  const updateResult = await db.prepare(`
    UPDATE agency_staff_credentials SET
      staff_password_hash = ?,
      staff_name = COALESCE(?, staff_name),
      password_set_at = ?,
      invite_token_hash = NULL,
      invite_code = NULL,
      invite_expires_at = NULL,
      updated_at = ?
    WHERE id = ? AND staff_password_hash IS NULL
  `).bind(passwordHash, sanitizedName, now, now, staffRecord.id).run();
  
  // 楽観的ロック: 既に設定済みの場合は changes === 0
  if (!updateResult.meta?.changes || updateResult.meta.changes === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_SETUP', message: 'パスワードは既に設定済みです。ログインしてください。' },
    }, 409);
  }
  
  // エージェンシーオーナーの情報を取得してJWT発行
  const ownerUser = await db.prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .bind(staffRecord.owner_user_id).first<any>();
  
  if (!ownerUser) {
    console.error('[staff/setup-password] Agency owner not found:', staffRecord.owner_user_id);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'エージェンシーオーナーが見つかりません。管理者にお問い合わせください。' },
    }, 500);
  }
  
  // 最終ログイン更新
  await db.prepare(`
    UPDATE agency_staff_credentials 
    SET last_login_at = ?, last_login_ip = ?
    WHERE id = ?
  `).bind(now, requestIp, staffRecord.id).run();
  
  // JWT発行（オーナーのuser_idで発行 — スタッフはオーナーの権限で操作する設計）
  const jwtToken = await signJWT(
    { id: ownerUser.id, email: ownerUser.email, role: ownerUser.role },
    c.env
  );
  
  const finalStaffName = sanitizedName || staffRecord.staff_name;
  
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
        staff_id: staffRecord.id,
        staff_email: staffRecord.staff_email,
        staff_name: finalStaffName,
        staff_role: staffRecord.role,
        agency_id: staffRecord.agency_id,
        agency_name: staffRecord.agency_name,
      },
    },
  });
});


// =====================================================
// 認証必須エンドポイント
// =====================================================
const staffAuthRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /api/agency/staff - スタッフ一覧取得
 */
staffAuthRoutes.get('/staff', async (c) => {
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
      invited_at, password_set_at, last_login_at, is_active,
      invite_expires_at
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
 * DELETE /api/agency/staff/:id - スタッフ削除（無効化）
 */
staffAuthRoutes.delete('/staff/:id', async (c) => {
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
  
  // オーナーまたは管理者のみ削除可能
  if (agencyInfo.role !== 'owner' && agencyInfo.role !== 'admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner or admin can delete staff' },
    }, 403);
  }
  
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE agency_staff_credentials 
    SET is_active = 0, updated_at = ?
    WHERE id = ? AND agency_id = ?
  `).bind(now, staffId, agencyInfo.agency.id).run();
  
  if (!result.meta?.changes || result.meta.changes === 0) {
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

export { staffPublicRoutes, staffAuthRoutes };
export default staffAuthRoutes;

/**
 * Agency: メンバー管理
 * 
 * GET    /members            - メンバー一覧
 * POST   /members/invite     - メンバー招待
 * DELETE /members/invite/:id - 招待取消
 * POST   /members/join       - 招待受諾
 * DELETE /members/:id        - メンバー削除
 * PUT    /members/:id/role   - メンバー役割変更
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, generateId, generateToken, hashToken, generateShortCode, safeParseJsonBody } from './_helpers';
import { sendStaffInviteEmail } from '../../services/email';

const members = new Hono<{ Bindings: Env; Variables: Variables }>();

members.get('/members', async (c) => {
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
 * POST /api/agency/members/invite - スタッフ招待（新設計）
 * 
 * スタッフ = 同じエージェンシーアカウントにログインできる追加の認証情報
 * - 新しいユーザーアカウントは作成しない
 * - agency_staff_credentials に招待情報を保存
 * - 招待リンクからパスワードを設定して完了
 */
members.post('/members/invite', async (c) => {
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
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    email?: string;
    name?: string;
    role?: string;
    sendEmail?: boolean;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { email, name = '', role = 'staff', sendEmail = false } = parseResult.data;
  
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
  
  // 既にスタッフとして登録されているか確認
  const existingStaff = await db.prepare(`
    SELECT id, is_active, staff_password_hash FROM agency_staff_credentials
    WHERE staff_email = ?
  `).bind(email.toLowerCase()).first<any>();
  
  if (existingStaff) {
    if (existingStaff.is_active && existingStaff.staff_password_hash) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'ALREADY_STAFF', message: 'このメールアドレスは既にスタッフとして登録されています' },
      }, 400);
    }
    // 招待中（パスワード未設定）の場合は再招待可能 → 既存レコードを更新
  }
  
  // 招待トークン生成
  const inviteToken = generateToken();
  const inviteTokenHash = await hashToken(inviteToken);
  const inviteCode = generateShortCode();
  const staffId = existingStaff?.id || generateId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7日後
  
  if (existingStaff) {
    // 既存レコードを更新（再招待）
    await db.prepare(`
      UPDATE agency_staff_credentials SET
        agency_id = ?,
        staff_name = ?,
        role = ?,
        invite_token_hash = ?,
        invite_code = ?,
        invite_expires_at = ?,
        invited_by_user_id = ?,
        invited_at = ?,
        is_active = 1,
        updated_at = ?
      WHERE id = ?
    `).bind(
      agencyId, name || email.split('@')[0], role, inviteTokenHash, inviteCode,
      expiresAt, user.id, now, now, staffId
    ).run();
  } else {
    // 新規レコード作成
    await db.prepare(`
      INSERT INTO agency_staff_credentials (
        id, agency_id, staff_email, staff_name, role,
        invite_token_hash, invite_code, invite_expires_at,
        invited_by_user_id, invited_at, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      staffId, agencyId, email.toLowerCase(), name || email.split('@')[0], role,
      inviteTokenHash, inviteCode, expiresAt,
      user.id, now, now, now
    ).run();
  }
  
  // 招待URLを生成（パスワード設定画面へ）
  // 注意: origin ヘッダーは信頼できないため、本番URLを固定
  const baseUrl = (c.env as any).APP_URL || 'https://hojyokin.pages.dev';
  const inviteUrl = `${baseUrl}/staff/setup?code=${inviteCode}&token=${inviteToken}`;
  
  // メール送信（オプション）
  let emailSent = false;
  let emailError: string | undefined;
  console.log('[Staff Invite] sendEmail flag:', sendEmail, 'type:', typeof sendEmail);
  
  if (sendEmail) {
    console.log('[Staff Invite] Attempting to send invite email to:', email);
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
    console.log('[Staff Invite] Email result:', { sent: emailSent, error: emailError });
  } else {
    console.log('[Staff Invite] Email sending skipped - sendEmail is false or falsy');
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      staff_id: staffId,
      email,
      name: name || email.split('@')[0],
      role,
      invite_code: inviteCode,
      invite_url: inviteUrl,
      expires_at: expiresAt,
      email_sent: emailSent,
      message: sendEmail && emailSent 
        ? 'スタッフ招待を送信しました。招待メールからパスワードを設定してもらってください。'
        : 'スタッフ招待を作成しました。招待URLを共有してパスワードを設定してもらってください。',
    },
  }, 201);
});

/**
 * DELETE /api/agency/members/invite/:id - 招待取り消し
 */
members.delete('/members/invite/:id', async (c) => {
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
members.post('/members/join', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ code?: string; token?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { code, token } = parseResult.data;
  
  if (!code || !token) {
    // tokenがない場合、招待が存在するか確認して適切なメッセージを返す
    if (code && !token) {
      const inviteExists = await db.prepare(`
        SELECT id, email FROM agency_member_invites
        WHERE invite_code = ?
          AND accepted_at IS NULL 
          AND revoked_at IS NULL
          AND expires_at > datetime('now')
      `).bind(code).first<{ id: string; email: string }>();
      
      if (inviteExists) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: { 
            code: 'TOKEN_REQUIRED', 
            message: `招待リンクが不完全です。招待メールに記載されている完全なリンクをクリックしてください。招待メールは ${inviteExists.email} 宛てに送信されています。` 
          },
        }, 400);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '招待コードまたはトークンが不足しています。招待メールのリンクを再度クリックしてください。' },
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
members.delete('/members/:id', async (c) => {
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
members.put('/members/:id/role', async (c) => {
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
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ role?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { role } = parseResult.data;
  
  if (!role || !['admin', 'staff'].includes(role)) {
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

export default members;

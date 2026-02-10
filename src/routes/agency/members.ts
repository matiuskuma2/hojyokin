/**
 * Agency: メンバー管理
 * 
 * GET    /members            - メンバー一覧（オーナー + agency_staff_credentials スタッフ）
 * POST   /members/invite     - メンバー招待（agency_staff_credentials へ書き込み）
 * DELETE /members/invite/:id - 招待取消（agency_staff_credentials を無効化）
 * DELETE /members/:id        - メンバー削除（agency_staff_credentials を無効化）
 * PUT    /members/:id/role   - メンバー役割変更
 * 
 * 設計方針:
 * - 招待データは agency_staff_credentials テーブルに一本化
 * - GET /members は agency_staff_credentials から保留中招待と設定済みスタッフを取得
 * - agency_member_invites は旧方式として互換性のため参照のみ（新規書き込みしない）
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, generateId, generateToken, hashToken, generateShortCode, safeParseJsonBody } from './_helpers';
import { sendStaffInviteEmail } from '../../services/email';

const members = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /api/agency/members - メンバー一覧
 * 
 * テーブル不整合修正: 以前は agency_members + agency_member_invites を読んでいたが、
 * 招待は agency_staff_credentials に書き込まれるため、ここも同テーブルを参照する。
 */
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
  
  // agency_members テーブルのメンバー一覧取得（旧方式の互換性）
  const legacyMembers = await db.prepare(`
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
  
  // agency_staff_credentials テーブルからスタッフ一覧を取得
  // (パスワード設定済み = アクティブスタッフ)
  const staffMembers = await db.prepare(`
    SELECT 
      id as staff_id,
      staff_email as email,
      staff_name as name,
      role as role_in_agency,
      password_set_at as joined_at,
      last_login_at,
      is_active
    FROM agency_staff_credentials
    WHERE agency_id = ? AND staff_password_hash IS NOT NULL AND is_active = 1
    ORDER BY password_set_at DESC
  `).bind(agencyId).all();
  
  // agency_staff_credentials テーブルから保留中の招待一覧を取得
  const pendingInvites = await db.prepare(`
    SELECT 
      id,
      staff_email as email,
      role as role_in_agency,
      invite_code,
      invite_expires_at as expires_at,
      invited_at as created_at
    FROM agency_staff_credentials
    WHERE agency_id = ? 
      AND staff_password_hash IS NULL
      AND is_active = 1
      AND invite_expires_at > datetime('now')
      AND invite_code IS NOT NULL
    ORDER BY invited_at DESC
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
  
  // 旧方式のメンバー（agency_members テーブル）
  for (const m of (legacyMembers.results || []) as any[]) {
    allMembers.push({
      membership_id: m.membership_id,
      user_id: m.user_id,
      email: m.email,
      name: m.name,
      role: m.role_in_agency,
      joined_at: m.joined_at,
      is_owner: false,
      source: 'legacy', // フロントエンドでの識別用
    });
  }
  
  // credential方式のスタッフ（agency_staff_credentials テーブル）
  for (const s of (staffMembers.results || []) as any[]) {
    // オーナーとメールアドレスが被っていないか確認
    const isDuplicate = allMembers.some(m => m.email === s.email);
    if (!isDuplicate) {
      allMembers.push({
        membership_id: s.staff_id, // staff_id を membership_id として使用
        email: s.email,
        name: s.name,
        role: s.role_in_agency,
        joined_at: s.joined_at,
        is_owner: false,
        source: 'staff_credential',
        last_login_at: s.last_login_at,
      });
    }
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
  
  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
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
  
  // name のサニタイズ（XSS対策）
  const sanitizedName = name ? name.replace(/<[^>]*>/g, '').trim().slice(0, 100) : '';
  
  // 既にスタッフとして登録されているか確認（agency_id で絞込）
  const existingStaff = await db.prepare(`
    SELECT id, is_active, staff_password_hash FROM agency_staff_credentials
    WHERE staff_email = ? AND agency_id = ?
  `).bind(email.toLowerCase(), agencyId).first<any>();
  
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
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7日後
  
  // ShortCode 衝突リスク対策: 最大3回リトライ
  let inviteCode = '';
  let retries = 0;
  const MAX_RETRIES = 3;
  while (retries < MAX_RETRIES) {
    inviteCode = generateShortCode();
    const codeExists = await db.prepare(
      'SELECT id FROM agency_staff_credentials WHERE invite_code = ? AND agency_id = ?'
    ).bind(inviteCode, agencyId).first();
    if (!codeExists) break;
    retries++;
    if (retries >= MAX_RETRIES) {
      console.error('[members/invite] Failed to generate unique invite code after', MAX_RETRIES, 'retries');
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '招待コードの生成に失敗しました。再度お試しください。' },
      }, 500);
    }
  }
  
  const staffId = existingStaff?.id || generateId();
  const displayName = sanitizedName || email.split('@')[0];
  
  try {
    if (existingStaff) {
      // 既存レコードを更新（再招待）
      await db.prepare(`
        UPDATE agency_staff_credentials SET
          staff_name = ?,
          role = ?,
          invite_token_hash = ?,
          invite_code = ?,
          invite_expires_at = ?,
          invited_by_user_id = ?,
          invited_at = ?,
          is_active = 1,
          staff_password_hash = NULL,
          password_set_at = NULL,
          updated_at = ?
        WHERE id = ?
      `).bind(
        displayName, role, inviteTokenHash, inviteCode,
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
        staffId, agencyId, email.toLowerCase(), displayName, role,
        inviteTokenHash, inviteCode, expiresAt,
        user.id, now, now, now
      ).run();
    }
  } catch (dbError: any) {
    // UNIQUE制約違反のハンドリング
    if (dbError.message?.includes('UNIQUE constraint failed')) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'ALREADY_STAFF', message: 'このメールアドレスは既に登録されています' },
      }, 409);
    }
    console.error('[members/invite] DB error:', dbError);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '招待の作成に失敗しました' },
    }, 500);
  }
  
  // 招待URLを生成（パスワード設定画面へ）
  const baseUrl = (c.env as any).APP_URL || 'https://hojyokin.pages.dev';
  const inviteUrl = `${baseUrl}/staff/setup?code=${inviteCode}&token=${inviteToken}`;
  
  // メール送信（オプション）
  let emailSent = false;
  let emailError: string | undefined;
  
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
    if (!emailSent) {
      console.warn('[Staff Invite] Email send failed:', emailError);
    }
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      staff_id: staffId,
      email,
      name: displayName,
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
 * 
 * 修正: agency_member_invites ではなく agency_staff_credentials を更新
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
  
  // agency_staff_credentials の招待を無効化
  // 条件: パスワード未設定（まだ受諾されていない）、同じエージェンシー
  const result = await db.prepare(`
    UPDATE agency_staff_credentials 
    SET is_active = 0, invite_code = NULL, invite_token_hash = NULL, updated_at = ?
    WHERE id = ? AND agency_id = ? AND staff_password_hash IS NULL
  `).bind(now, inviteId, agencyId).run();
  
  if (!result.meta?.changes || result.meta.changes === 0) {
    // フォールバック: 旧方式の agency_member_invites もチェック
    const legacyResult = await db.prepare(`
      UPDATE agency_member_invites 
      SET revoked_at = ?, revoked_by_user_id = ?
      WHERE id = ? AND agency_id = ? AND accepted_at IS NULL AND revoked_at IS NULL
    `).bind(now, user.id, inviteId, agencyId).run();
    
    if (!legacyResult.meta?.changes || legacyResult.meta.changes === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invite not found or already processed' },
      }, 404);
    }
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: '招待を取り消しました' },
  });
});

/**
 * POST /api/agency/members/join - 招待受諾（旧方式 — 互換性のため残す）
 * 
 * Body: { code: string, token: string }
 */
members.post('/members/join', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
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
  
  const now = new Date().toISOString();
  
  if (existingMember) {
    // 既に存在する場合は accepted_at を更新
    await db.prepare(`
      UPDATE agency_members 
      SET accepted_at = ?, role_in_agency = ?
      WHERE agency_id = ? AND user_id = ?
    `).bind(now, invite.role_in_agency, invite.agency_id, user.id).run();
  } else {
    // 新規メンバー追加
    const memberId = generateId();
    
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
  const agency = await db.prepare('SELECT id, name FROM agencies WHERE id = ?')
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
 * 
 * agency_staff_credentials と agency_members の両方に対応
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
  const now = new Date().toISOString();
  
  // 1. まず agency_staff_credentials で検索
  const staffResult = await db.prepare(`
    UPDATE agency_staff_credentials 
    SET is_active = 0, updated_at = ?
    WHERE id = ? AND agency_id = ?
  `).bind(now, memberId, agencyId).run();
  
  if (staffResult.meta?.changes && staffResult.meta.changes > 0) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: { message: 'メンバーを削除しました' },
    });
  }
  
  // 2. フォールバック: agency_members で検索
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
    data: { message: 'メンバーを削除しました' },
  });
});

/**
 * PUT /api/agency/members/:id/role - メンバー役割変更（オーナーのみ）
 * 
 * agency_staff_credentials と agency_members の両方に対応
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
  const now = new Date().toISOString();
  
  // 1. まず agency_staff_credentials で更新を試みる
  const staffResult = await db.prepare(`
    UPDATE agency_staff_credentials 
    SET role = ?, updated_at = ?
    WHERE id = ? AND agency_id = ? AND is_active = 1
  `).bind(role, now, memberId, agencyId).run();
  
  if (staffResult.meta?.changes && staffResult.meta.changes > 0) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: { message: 'Role updated', role },
    });
  }
  
  // 2. フォールバック: agency_members で更新
  const memberResult = await db.prepare(`
    UPDATE agency_members 
    SET role_in_agency = ?
    WHERE id = ? AND agency_id = ?
  `).bind(role, memberId, agencyId).run();
  
  if (!memberResult.meta?.changes || memberResult.meta.changes === 0) {
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

export default members;

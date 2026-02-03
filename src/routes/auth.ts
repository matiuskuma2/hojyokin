/**
 * 認証ルート
 * 
 * POST /api/auth/register - ユーザー登録
 * POST /api/auth/login - ログイン
 * POST /api/auth/password-reset/request - パスワードリセット要求
 * POST /api/auth/password-reset/confirm - パスワードリセット確認
 * GET  /api/auth/me - 現在のユーザー情報取得
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, User, UserPublic, ApiResponse } from '../types';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../lib/password';
import { signJWT } from '../lib/jwt';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';

/**
 * SHA-256ハッシュ生成（トークン保存用）
 */
async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 監査ログを記録
 */
async function writeAuditLog(
  db: D1Database,
  params: {
    actorUserId?: string | null;
    targetUserId?: string | null;
    action: string;
    actionCategory: 'auth' | 'admin' | 'data' | 'system';
    severity?: 'info' | 'warning' | 'critical';
    detailsJson?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  }
): Promise<void> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO audit_log (
      id, actor_user_id, target_user_id, action, action_category, severity,
      details_json, ip, user_agent, request_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    params.actorUserId || null,
    params.targetUserId || null,
    params.action,
    params.actionCategory,
    params.severity || 'info',
    params.detailsJson ? JSON.stringify(params.detailsJson) : null,
    params.ip || null,
    params.userAgent || null,
    params.requestId || null,
    now
  ).run();
}

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * ユーザー登録
 */
auth.post('/register', async (c) => {
  const db = c.env.DB;
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    const body = await c.req.json();
    const { email, password, name, accountType } = body;
    
    // ロール決定（user または agency）
    const role = accountType === 'agency' ? 'agency' : 'user';
    
    // バリデーション
    if (!email || !password) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'email and password are required',
        },
      }, 400);
    }
    
    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        },
      }, 400);
    }
    
    // パスワード強度チェック
    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordErrors.join(', '),
          details: passwordErrors,
        },
      }, 400);
    }
    
    // 既存ユーザーチェック
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first();
    
    if (existing) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      }, 409);
    }
    
    // パスワードハッシュ化
    const passwordHash = await hashPassword(password);
    
    // ユーザー作成
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    await db
      .prepare(`
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, created_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(userId, email.toLowerCase(), passwordHash, name || null, role, now, now, requestIp)
      .run();
    
    // agencyの場合、自動的にagencyを作成
    if (role === 'agency') {
      const agencyId = uuidv4();
      await db.prepare(`
        INSERT INTO agencies (id, name, owner_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(agencyId, `${name || email}の事務所`, userId, now, now).run();
    }
    
    // 監査ログ記録
    await writeAuditLog(db, {
      targetUserId: userId,
      action: 'REGISTER',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: { email: email.toLowerCase(), role },
      ip: requestIp,
      userAgent,
      requestId,
    });
    
    // JWT発行
    const token = await signJWT(
      { id: userId, email: email.toLowerCase(), role },
      c.env
    );
    
    // レスポンス
    const user: UserPublic = {
      id: userId,
      email: email.toLowerCase(),
      name: name || null,
      role,
      email_verified_at: null,
      created_at: now,
    };
    
    return c.json<ApiResponse<{ user: UserPublic; token: string }>>({
      success: true,
      data: { user, token },
    }, 201);
  } catch (error) {
    console.error('Register error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Registration failed: ${errorMessage}`,
      },
    }, 500);
  }
});

/**
 * ログイン
 * - 通常ユーザー: usersテーブルで認証
 * - スタッフ: agency_staff_credentialsで認証 → エージェンシーオーナーのアカウントでログイン
 */
auth.post('/login', async (c) => {
  const db = c.env.DB;
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    const body = await c.req.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'email and password are required',
        },
      }, 400);
    }
    
    // ==========================================
    // 1. スタッフ認証を先にチェック
    // ==========================================
    const staffCred = await db.prepare(`
      SELECT 
        sc.*,
        a.owner_user_id,
        a.name as agency_name
      FROM agency_staff_credentials sc
      JOIN agencies a ON a.id = sc.agency_id
      WHERE sc.staff_email = ? 
        AND sc.is_active = 1
        AND sc.staff_password_hash IS NOT NULL
    `).bind(email.toLowerCase()).first<any>();
    
    if (staffCred) {
      // スタッフとしてログイン試行
      const isValidStaff = await verifyPassword(password, staffCred.staff_password_hash);
      
      if (isValidStaff) {
        // スタッフ認証成功 → エージェンシーオーナーのアカウント情報を取得
        const ownerUser = await db
          .prepare('SELECT * FROM users WHERE id = ?')
          .bind(staffCred.owner_user_id)
          .first<User>();
        
        if (!ownerUser) {
          return c.json<ApiResponse<null>>({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Agency owner not found' },
          }, 500);
        }
        
        // スタッフの最終ログイン更新
        const now = new Date().toISOString();
        await db.prepare(`
          UPDATE agency_staff_credentials 
          SET last_login_at = ?, last_login_ip = ?, updated_at = ?
          WHERE id = ?
        `).bind(now, requestIp, now, staffCred.id).run();
        
        // 監査ログ
        await writeAuditLog(db, {
          targetUserId: ownerUser.id,
          action: 'STAFF_LOGIN_SUCCESS',
          actionCategory: 'auth',
          severity: 'info',
          detailsJson: { 
            staff_email: staffCred.staff_email, 
            staff_name: staffCred.staff_name,
            staff_role: staffCred.role,
            agency_id: staffCred.agency_id,
            agency_name: staffCred.agency_name,
          },
          ip: requestIp,
          userAgent,
          requestId,
        });
        
        // JWT発行（オーナーのuser_idで発行）
        const token = await signJWT(
          { id: ownerUser.id, email: ownerUser.email, role: ownerUser.role },
          c.env
        );
        
        // レスポンス（スタッフ情報も含める）
        const userPublic: UserPublic = {
          id: ownerUser.id,
          email: ownerUser.email,
          name: ownerUser.name,
          role: ownerUser.role,
          email_verified_at: ownerUser.email_verified_at,
          created_at: ownerUser.created_at,
        };
        
        return c.json<ApiResponse<{ user: UserPublic; token: string; staff?: any }>>({
          success: true,
          data: { 
            user: userPublic, 
            token,
            staff: {
              staff_id: staffCred.id,
              staff_email: staffCred.staff_email,
              staff_name: staffCred.staff_name,
              staff_role: staffCred.role,
              agency_id: staffCred.agency_id,
              agency_name: staffCred.agency_name,
            },
          },
        });
      }
      // スタッフのパスワードが不正 → 通常ユーザー認証へフォールスルー（同じメールの通常ユーザーがいるかも）
    }
    
    // ==========================================
    // 2. 通常ユーザー認証
    // ==========================================
    const user = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<User & { is_disabled?: number; lockout_until?: string; failed_login_attempts?: number }>();
    
    if (!user) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }, 401);
    }
    
    // 凍結チェック
    if (user.is_disabled) {
      await writeAuditLog(db, {
        targetUserId: user.id,
        action: 'LOGIN_FAILED',
        actionCategory: 'auth',
        severity: 'warning',
        detailsJson: { email: user.email, reason: 'account_disabled' },
        ip: requestIp,
        userAgent,
        requestId,
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'This account has been disabled',
        },
      }, 403);
    }
    
    // ロックアウトチェック
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      await writeAuditLog(db, {
        targetUserId: user.id,
        action: 'LOGIN_FAILED',
        actionCategory: 'auth',
        severity: 'warning',
        detailsJson: { email: user.email, reason: 'lockout', lockout_until: user.lockout_until },
        ip: requestIp,
        userAgent,
        requestId,
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed attempts',
        },
      }, 403);
    }
    
    // パスワード検証
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      // 失敗回数をカウント
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const now = new Date().toISOString();
      
      // 5回失敗でロックアウト（15分）
      const lockoutUntil = failedAttempts >= 5 
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString() 
        : null;
      
      await db
        .prepare(`
          UPDATE users SET failed_login_attempts = ?, lockout_until = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(failedAttempts, lockoutUntil, now, user.id)
        .run();
      
      await writeAuditLog(db, {
        targetUserId: user.id,
        action: 'LOGIN_FAILED',
        actionCategory: 'auth',
        severity: failedAttempts >= 5 ? 'warning' : 'info',
        detailsJson: { email: user.email, reason: 'invalid_password', failedAttempts, locked: !!lockoutUntil },
        ip: requestIp,
        userAgent,
        requestId,
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }, 401);
    }
    
    // ログイン成功時: 失敗回数リセット、最終ログイン更新
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users SET 
          failed_login_attempts = 0, 
          lockout_until = NULL, 
          last_login_at = ?, 
          last_login_ip = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(now, requestIp, now, user.id)
      .run();
    
    // 監査ログ記録
    await writeAuditLog(db, {
      targetUserId: user.id,
      action: 'LOGIN_SUCCESS',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: { email: user.email },
      ip: requestIp,
      userAgent,
      requestId,
    });
    
    // JWT発行
    const token = await signJWT(
      { id: user.id, email: user.email, role: user.role },
      c.env
    );
    
    // レスポンス
    const userPublic: UserPublic = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      email_verified_at: user.email_verified_at,
      created_at: user.created_at,
    };
    
    return c.json<ApiResponse<{ user: UserPublic; token: string }>>({
      success: true,
      data: { user: userPublic, token },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
      },
    }, 500);
  }
});

/**
 * パスワードリセット要求
 * - password_reset_tokensテーブルへハッシュ化トークンを保存
 * - レート制限: 1時間に3回まで
 * - audit_logへ記録
 */
auth.post('/password-reset/request', async (c) => {
  const db = c.env.DB;
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    const body = await c.req.json();
    const { email } = body;
    
    if (!email) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'email is required',
        },
      }, 400);
    }
    
    // ユーザー検索
    const user = await db
      .prepare('SELECT id, email FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<User>();
    
    // ユーザーが存在しなくても同じレスポンスを返す（セキュリティ）
    if (!user) {
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: {
          message: 'If the email exists, a reset link will be sent',
        },
      });
    }
    
    // レート制限チェック: 過去1時間で3回以上発行済みの場合は拒否
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const recentTokens = await db
      .prepare(`
        SELECT COUNT(*) as count FROM password_reset_tokens
        WHERE user_id = ? AND created_at > ?
      `)
      .bind(user.id, oneHourAgo)
      .first<{ count: number }>();
    
    if (recentTokens && recentTokens.count >= 3) {
      // 監査ログ: レート制限
      await writeAuditLog(db, {
        targetUserId: user.id,
        action: 'PASSWORD_RESET_RATE_LIMITED',
        actionCategory: 'auth',
        severity: 'warning',
        detailsJson: { email: user.email, recentCount: recentTokens.count },
        ip: requestIp,
        userAgent,
        requestId,
      });
      
      // セキュリティ上同じレスポンス
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: {
          message: 'If the email exists, a reset link will be sent',
        },
      });
    }
    
    // リセットトークン生成
    const rawToken = uuidv4();
    const tokenHash = await sha256Hash(rawToken);
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1時間後
    const tokenId = uuidv4();
    const now = new Date().toISOString();
    
    // password_reset_tokensテーブルに保存
    await db
      .prepare(`
        INSERT INTO password_reset_tokens (
          id, user_id, token_hash, expires_at, issued_by,
          request_ip, request_user_agent, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
      `)
      .bind(tokenId, user.id, tokenHash, expiresAt, requestIp, userAgent, now)
      .run();
    
    // 後方互換性のためusersテーブルも更新（フェーズアウト後削除可）
    await db
      .prepare(`
        UPDATE users 
        SET password_reset_token = ?, password_reset_expires = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(rawToken, expiresAt, now, user.id)
      .run();
    
    // 監査ログ記録
    await writeAuditLog(db, {
      targetUserId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: { email: user.email, tokenId },
      ip: requestIp,
      userAgent,
      requestId,
    });
    
    // SendGrid でメール送信
    // 注意: origin ヘッダーは信頼できないため、本番URLを固定
    // サンドボックスやプロキシ経由でアクセスした場合に不正なURLになる問題を防止
    const baseUrl = (c.env as any).APP_URL || 'https://hojyokin.pages.dev';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    
    // ユーザー名を取得
    const userInfo = await db.prepare('SELECT name FROM users WHERE id = ?')
      .bind(user.id).first<{ name: string }>();
    
    const emailResult = await sendPasswordResetEmail(c.env, {
      to: user.email,
      userName: userInfo?.name || user.email,
      resetUrl,
      expiresAt,
    });
    
    if (!emailResult.success) {
      console.warn(`Password reset email failed for ${email}:`, emailResult.error);
    }
    
    // 開発環境ではトークンをレスポンスに含める（本番では削除）
    console.log(`Password reset token for ${email}: ${rawToken}`);
    
    return c.json<ApiResponse<{ message: string; debug_token?: string }>>({
      success: true,
      data: {
        message: 'If the email exists, a reset link will be sent',
        // 開発用: 本番では削除（ENVIRONMENTが未設定またはproduction以外でのみ表示）
        debug_token: c.env.ENVIRONMENT !== 'production' ? rawToken : undefined,
      },
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Password reset request failed',
      },
    }, 500);
  }
});

/**
 * パスワードリセット確認
 * - password_reset_tokensテーブルを使用
 * - 使用済みトークンはused_atを更新
 * - audit_logへ記録
 */
auth.post('/password-reset/confirm', async (c) => {
  const db = c.env.DB;
  const usedIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    const body = await c.req.json();
    const { token, new_password } = body;
    
    if (!token || !new_password) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'token and new_password are required',
        },
      }, 400);
    }
    
    // パスワード強度チェック
    const passwordErrors = validatePasswordStrength(new_password);
    if (passwordErrors.length > 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordErrors.join(', '),
          details: passwordErrors,
        },
      }, 400);
    }
    
    // トークンをハッシュ化して検索
    const tokenHash = await sha256Hash(token);
    
    // password_reset_tokensテーブルで検索
    const tokenRecord = await db
      .prepare(`
        SELECT prt.id as token_id, prt.user_id, prt.expires_at, prt.used_at,
               u.id, u.email
        FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token_hash = ?
      `)
      .bind(tokenHash)
      .first<{ token_id: string; user_id: string; expires_at: string; used_at: string | null; id: string; email: string }>();
    
    // フォールバック: 旧方式（usersテーブル直接）も確認
    let userId: string | null = null;
    let userEmail: string | null = null;
    let tokenId: string | null = null;
    let isLegacyToken = false;
    
    if (tokenRecord) {
      // 新方式で発見
      if (tokenRecord.used_at) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'TOKEN_USED',
            message: 'Reset token has already been used',
          },
        }, 400);
      }
      
      if (new Date(tokenRecord.expires_at) < new Date()) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Reset token has expired',
          },
        }, 400);
      }
      
      userId = tokenRecord.user_id;
      userEmail = tokenRecord.email;
      tokenId = tokenRecord.token_id;
    } else {
      // 旧方式フォールバック
      const user = await db
        .prepare(`
          SELECT id, email, password_reset_expires 
          FROM users 
          WHERE password_reset_token = ?
        `)
        .bind(token)
        .first<User & { password_reset_expires: string }>();
      
      if (!user) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          },
        }, 400);
      }
      
      if (new Date(user.password_reset_expires) < new Date()) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Reset token has expired',
          },
        }, 400);
      }
      
      userId = user.id;
      userEmail = user.email;
      isLegacyToken = true;
    }
    
    // パスワード更新
    const passwordHash = await hashPassword(new_password);
    const now = new Date().toISOString();
    
    await db
      .prepare(`
        UPDATE users 
        SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = ?
        WHERE id = ?
      `)
      .bind(passwordHash, now, userId)
      .run();
    
    // 新方式の場合、トークンを使用済みにする
    if (tokenId) {
      await db
        .prepare(`
          UPDATE password_reset_tokens
          SET used_at = ?, used_ip = ?, used_user_agent = ?
          WHERE id = ?
        `)
        .bind(now, usedIp, userAgent, tokenId)
        .run();
    }
    
    // 監査ログ記録
    await writeAuditLog(db, {
      targetUserId: userId,
      action: 'PASSWORD_RESET_COMPLETED',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: {
        email: userEmail,
        tokenId: tokenId || 'legacy',
        isLegacyToken,
      },
      ip: usedIp,
      userAgent,
      requestId,
    });
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'Password has been reset successfully',
      },
    });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Password reset failed',
      },
    }, 500);
  }
});

/**
 * 現在のユーザー情報取得
 */
auth.get('/me', requireAuth, async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  
  try {
    const user = await db
      .prepare('SELECT id, email, name, role, email_verified_at, created_at FROM users WHERE id = ?')
      .bind(currentUser.id)
      .first<UserPublic>();
    
    if (!user) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    return c.json<ApiResponse<UserPublic>>({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user info',
      },
    }, 500);
  }
});

/**
 * PUT /api/auth/me - ユーザー情報更新（名前など）
 */
auth.put('/me', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  try {
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
      UPDATE users SET name = ?, updated_at = ? WHERE id = ?
    `).bind(name.trim(), now, user.id).run();
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: user.id,
      targetUserId: user.id,
      action: 'profile_updated',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: { field: 'name' },
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
    });
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: { message: 'Profile updated', name: name.trim() },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' },
    }, 500);
  }
});

/**
 * POST /api/auth/change-password - パスワード変更（ログイン中）
 */
auth.post('/change-password', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  try {
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;
    
    if (!currentPassword || !newPassword) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' },
      }, 400);
    }
    
    // 現在のパスワードを確認
    const userRecord = await db.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(user.id).first<{ password_hash: string }>();
    
    if (!userRecord) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      }, 404);
    }
    
    const isValidPassword = await verifyPassword(currentPassword, userRecord.password_hash);
    if (!isValidPassword) {
      await writeAuditLog(db, {
        actorUserId: user.id,
        action: 'password_change_failed',
        actionCategory: 'auth',
        severity: 'warning',
        detailsJson: { reason: 'invalid_current_password' },
        ip: c.req.header('CF-Connecting-IP'),
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: '現在のパスワードが正しくありません' },
      }, 400);
    }
    
    // 新しいパスワードの強度を確認
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.message },
      }, 400);
    }
    
    // パスワード更新
    const newPasswordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    
    await db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
    `).bind(newPasswordHash, now, user.id).run();
    
    await writeAuditLog(db, {
      actorUserId: user.id,
      targetUserId: user.id,
      action: 'password_changed',
      actionCategory: 'auth',
      severity: 'info',
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
    });
    
    return c.json<ApiResponse<any>>({
      success: true,
      data: { message: 'パスワードが変更されました' },
    });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to change password' },
    }, 500);
  }
});

/**
 * 招待経由の新規登録
 * - 新規ユーザー登録 + 招待受諾を1つのリクエストで実行
 * - スタッフ招待時、アカウントがない人のためのエンドポイント
 */
auth.post('/register-with-invite', async (c) => {
  const db = c.env.DB;
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    const body = await c.req.json();
    const { email, password, name, inviteCode, inviteToken } = body;
    
    // バリデーション
    if (!email || !password || !inviteCode || !inviteToken) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'email, password, inviteCode, inviteToken are required',
        },
      }, 400);
    }
    
    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        },
      }, 400);
    }
    
    // パスワード強度チェック
    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordErrors.join(', '),
          details: passwordErrors,
        },
      }, 400);
    }
    
    // 招待を検索
    const tokenHash = await sha256Hash(inviteToken);
    const invite = await db.prepare(`
      SELECT * FROM agency_member_invites
      WHERE invite_code = ? AND invite_token_hash = ?
        AND accepted_at IS NULL 
        AND revoked_at IS NULL
        AND expires_at > datetime('now')
    `).bind(inviteCode, tokenHash).first<any>();
    
    if (!invite) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVALID_INVITE', message: 'Invalid or expired invite' },
      }, 400);
    }
    
    // メールアドレスが招待先と一致するか確認
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { 
          code: 'EMAIL_MISMATCH', 
          message: `この招待は ${invite.email} 宛てに送信されました。招待メールアドレスで登録してください。` 
        },
      }, 403);
    }
    
    // 既存ユーザーチェック
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first();
    
    if (existingUser) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'このメールアドレスは既に登録されています。ログインして招待を受諾してください。',
        },
      }, 409);
    }
    
    // レースコンディション対策: 招待を先にマーク（楽観的ロック）
    // accepted_at が NULL の場合のみ更新し、影響行数で判定
    const lockResult = await db.prepare(`
      UPDATE agency_member_invites
      SET accepted_at = ?
      WHERE id = ? AND accepted_at IS NULL
    `).bind(new Date().toISOString(), invite.id).run();
    
    if (!lockResult.meta?.changes || lockResult.meta.changes === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'INVITE_ALREADY_USED', message: 'この招待は既に使用されています' },
      }, 409);
    }
    
    // パスワードハッシュ化
    const passwordHash = await hashPassword(password);
    
    // ユーザー作成（roleは'agency'）
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    await db
      .prepare(`
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, created_ip)
        VALUES (?, ?, ?, ?, 'agency', ?, ?, ?)
      `)
      .bind(userId, email.toLowerCase(), passwordHash, name || null, now, now, requestIp)
      .run();
    
    // 既にメンバーでないか確認
    const existingMember = await db.prepare(`
      SELECT id FROM agency_members
      WHERE agency_id = ? AND user_id = ?
    `).bind(invite.agency_id, userId).first();
    
    if (!existingMember) {
      // 新規メンバー追加
      const memberId = uuidv4();
      
      await db.prepare(`
        INSERT INTO agency_members (
          id, agency_id, user_id, role_in_agency, invited_at, accepted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        memberId, invite.agency_id, userId, invite.role_in_agency,
        invite.created_at, now, now
      ).run();
    }
    
    // 招待にユーザー情報を紐付け（accepted_atは楽観的ロック時に設定済み）
    await db.prepare(`
      UPDATE agency_member_invites
      SET accepted_by_user_id = ?
      WHERE id = ?
    `).bind(userId, invite.id).run();
    
    // 事務所情報を取得
    const agency = await db.prepare('SELECT * FROM agencies WHERE id = ?')
      .bind(invite.agency_id).first<any>();
    
    // 監査ログ記録
    await writeAuditLog(db, {
      targetUserId: userId,
      action: 'REGISTER_WITH_INVITE',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: { 
        email: email.toLowerCase(), 
        agency_id: invite.agency_id,
        role_in_agency: invite.role_in_agency 
      },
      ip: requestIp,
      userAgent,
      requestId,
    });
    
    // JWT発行
    const token = await signJWT(
      { id: userId, email: email.toLowerCase(), role: 'agency' },
      c.env
    );
    
    // レスポンス
    const user: UserPublic = {
      id: userId,
      email: email.toLowerCase(),
      name: name || null,
      role: 'agency',
      email_verified_at: null,
      created_at: now,
    };
    
    return c.json<ApiResponse<{
      user: UserPublic;
      token: string;
      agency: { id: string; name: string };
      role_in_agency: string;
    }>>({
      success: true,
      data: { 
        user, 
        token, 
        agency: { id: agency?.id, name: agency?.name },
        role_in_agency: invite.role_in_agency,
      },
    }, 201);
  } catch (error) {
    // エラー詳細はログに記録（本番環境ではユーザーに詳細を見せない）
    console.error('Register with invite error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '登録処理中にエラーが発生しました。しばらくしてから再度お試しください。',
      },
    }, 500);
  }
});

export default auth;

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
    const { email, password, name } = body;
    
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
        VALUES (?, ?, ?, ?, 'user', ?, ?, ?)
      `)
      .bind(userId, email.toLowerCase(), passwordHash, name || null, now, now, requestIp)
      .run();
    
    // 監査ログ記録
    await writeAuditLog(db, {
      targetUserId: userId,
      action: 'REGISTER',
      actionCategory: 'auth',
      severity: 'info',
      detailsJson: { email: email.toLowerCase() },
      ip: requestIp,
      userAgent,
      requestId,
    });
    
    // JWT発行
    const token = await signJWT(
      { id: userId, email: email.toLowerCase(), role: 'user' },
      c.env
    );
    
    // レスポンス
    const user: UserPublic = {
      id: userId,
      email: email.toLowerCase(),
      name: name || null,
      role: 'user',
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
    
    // ユーザー検索
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
    
    // TODO: SendGrid でメール送信
    // 開発環境ではトークンをレスポンスに含める（本番では削除）
    console.log(`Password reset token for ${email}: ${rawToken}`);
    
    return c.json<ApiResponse<{ message: string; debug_token?: string }>>({
      success: true,
      data: {
        message: 'If the email exists, a reset link will be sent',
        // 開発用: 本番では削除
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

export default auth;

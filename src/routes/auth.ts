/**
 * 認証ルート
 * 
 * POST /api/auth/register - ユーザー登録
 * POST /api/auth/login - ログイン
 * POST /api/auth/password-reset/request - パスワードリセット要求
 * POST /api/auth/password-reset/confirm - パスワードリセット確認
 * GET  /api/auth/me - 現在のユーザー情報取得
 * PUT  /api/auth/profile - プロフィール更新
 * PUT  /api/auth/password - パスワード変更
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, User, UserPublic, ApiResponse } from '../types';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../lib/password';
import { signJWT } from '../lib/jwt';
import { requireAuth, getCurrentUser } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// ========================================
// ヘルパー関数
// ========================================

/**
 * SHA-256ハッシュ生成（トークン用）
 */
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 監査ログ記録
 */
async function writeAuditLog(
  db: D1Database,
  params: {
    actorUserId?: string | null;
    targetUserId?: string | null;
    targetCompanyId?: string | null;
    targetResourceType?: string;
    targetResourceId?: string;
    action: string;
    actionCategory: 'auth' | 'admin' | 'data' | 'system';
    severity?: 'info' | 'warning' | 'critical';
    details?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  }
): Promise<void> {
  try {
    await db
      .prepare(`
        INSERT INTO audit_log (
          id, actor_user_id, target_user_id, target_company_id,
          target_resource_type, target_resource_id,
          action, action_category, severity, details_json,
          ip, user_agent, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        uuidv4(),
        params.actorUserId || null,
        params.targetUserId || null,
        params.targetCompanyId || null,
        params.targetResourceType || null,
        params.targetResourceId || null,
        params.action,
        params.actionCategory,
        params.severity || 'info',
        params.details ? JSON.stringify(params.details) : null,
        params.ip || null,
        params.userAgent || null,
        params.requestId || null,
        new Date().toISOString()
      )
      .run();
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // 監査ログの失敗はメイン処理を止めない
  }
}

/**
 * リクエストからIP/UserAgentを取得
 */
function getRequestMeta(c: { req: { header: (name: string) => string | undefined } }): { ip: string | null; userAgent: string | null } {
  return {
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null,
    userAgent: c.req.header('user-agent') || null,
  };
}

// ========================================
// ブルートフォース対策の定数
// ========================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15分

// ========================================
// パスワードリセットのレート制限
// ========================================
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1時間
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000; // 1分（同一ユーザーへの連続リクエスト制限）

// ========================================
// ルート定義
// ========================================

/**
 * ユーザー登録
 */
auth.post('/register', async (c) => {
  const db = c.env.DB;
  const { ip, userAgent } = getRequestMeta(c);
  
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
        INSERT INTO users (id, email, password_hash, name, role, created_ip, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', ?, ?, ?)
      `)
      .bind(userId, email.toLowerCase(), passwordHash, name || null, ip, now, now)
      .run();
    
    // JWT発行
    const token = await signJWT(
      { id: userId, email: email.toLowerCase(), role: 'user' },
      c.env
    );
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: userId,
      targetUserId: userId,
      action: 'REGISTER',
      actionCategory: 'auth',
      details: { email: email.toLowerCase() },
      ip,
      userAgent,
    });
    
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
  const { ip, userAgent } = getRequestMeta(c);
  
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
      .prepare(`
        SELECT id, email, password_hash, name, role, email_verified_at, created_at,
               is_disabled, disabled_reason, failed_login_attempts, lockout_until
        FROM users WHERE email = ?
      `)
      .bind(email.toLowerCase())
      .first<User & { 
        is_disabled: number | null; 
        disabled_reason: string | null;
        failed_login_attempts: number | null;
        lockout_until: string | null;
      }>();
    
    if (!user) {
      // ユーザーが存在しない場合も同じエラーメッセージ
      await writeAuditLog(db, {
        action: 'LOGIN_FAILED',
        actionCategory: 'auth',
        severity: 'warning',
        details: { email: email.toLowerCase(), reason: 'user_not_found' },
        ip,
        userAgent,
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }, 401);
    }
    
    // アカウント無効チェック
    if (user.is_disabled) {
      await writeAuditLog(db, {
        targetUserId: user.id,
        action: 'LOGIN_FAILED',
        actionCategory: 'auth',
        severity: 'warning',
        details: { reason: 'account_disabled', disabled_reason: user.disabled_reason },
        ip,
        userAgent,
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
    if (user.lockout_until) {
      const lockoutEnd = new Date(user.lockout_until);
      if (lockoutEnd > new Date()) {
        const remainingMinutes = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
        
        await writeAuditLog(db, {
          targetUserId: user.id,
          action: 'LOGIN_FAILED',
          actionCategory: 'auth',
          severity: 'warning',
          details: { reason: 'account_locked', lockout_until: user.lockout_until },
          ip,
          userAgent,
        });
        
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is temporarily locked. Try again in ${remainingMinutes} minutes.`,
          },
        }, 429);
      }
    }
    
    // パスワード検証
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      // 失敗回数をインクリメント
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockoutUntil: string | null = null;
      
      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      }
      
      await db
        .prepare(`
          UPDATE users 
          SET failed_login_attempts = ?, lockout_until = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(newFailedAttempts, lockoutUntil, new Date().toISOString(), user.id)
        .run();
      
      await writeAuditLog(db, {
        targetUserId: user.id,
        action: 'LOGIN_FAILED',
        actionCategory: 'auth',
        severity: newFailedAttempts >= MAX_FAILED_ATTEMPTS ? 'critical' : 'warning',
        details: { 
          reason: 'invalid_password', 
          failed_attempts: newFailedAttempts,
          locked: !!lockoutUntil,
        },
        ip,
        userAgent,
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }, 401);
    }
    
    // ログイン成功 - 失敗カウントをリセット、最終ログイン記録
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users 
        SET failed_login_attempts = 0, lockout_until = NULL, 
            last_login_at = ?, last_login_ip = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, ip, now, user.id)
      .run();
    
    // JWT発行
    const token = await signJWT(
      { id: user.id, email: user.email, role: user.role },
      c.env
    );
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: user.id,
      targetUserId: user.id,
      action: 'LOGIN_SUCCESS',
      actionCategory: 'auth',
      ip,
      userAgent,
    });
    
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
 */
auth.post('/password-reset/request', async (c) => {
  const db = c.env.DB;
  const { ip, userAgent } = getRequestMeta(c);
  
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
      .first<{ id: string; email: string }>();
    
    // ユーザーが存在しなくても同じレスポンスを返す（セキュリティ）
    if (!user) {
      await writeAuditLog(db, {
        action: 'PASSWORD_RESET_REQUESTED',
        actionCategory: 'auth',
        details: { email: email.toLowerCase(), user_found: false },
        ip,
        userAgent,
      });
      
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: {
          message: 'If the email exists, a reset link will be sent',
        },
      });
    }
    
    // レート制限: 最後のリクエストから1分以内かチェック
    const recentToken = await db
      .prepare(`
        SELECT created_at FROM password_reset_tokens 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `)
      .bind(user.id)
      .first<{ created_at: string }>();
    
    if (recentToken) {
      const lastRequestTime = new Date(recentToken.created_at).getTime();
      const now = Date.now();
      if (now - lastRequestTime < RESET_REQUEST_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESET_REQUEST_COOLDOWN_MS - (now - lastRequestTime)) / 1000);
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Please wait ${waitSeconds} seconds before requesting another reset`,
          },
        }, 429);
      }
    }
    
    // リセットトークン生成
    const rawToken = uuidv4();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString();
    const tokenId = uuidv4();
    
    // password_reset_tokens テーブルに保存
    await db
      .prepare(`
        INSERT INTO password_reset_tokens (
          id, user_id, token_hash, expires_at, issued_by, 
          request_ip, request_user_agent, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
      `)
      .bind(
        tokenId,
        user.id,
        tokenHash,
        expiresAt,
        ip,
        userAgent,
        new Date().toISOString()
      )
      .run();
    
    // 旧フィールドも互換性のため更新（既存UIとの互換）
    await db
      .prepare(`
        UPDATE users 
        SET password_reset_token = ?, password_reset_expires = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(rawToken, expiresAt, new Date().toISOString(), user.id)
      .run();
    
    // 監査ログ
    await writeAuditLog(db, {
      targetUserId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      actionCategory: 'auth',
      details: { token_id: tokenId },
      ip,
      userAgent,
    });
    
    // TODO: SendGrid でメール送信
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
 */
auth.post('/password-reset/confirm', async (c) => {
  const db = c.env.DB;
  const { ip, userAgent } = getRequestMeta(c);
  
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
    
    // トークンハッシュ化して検索
    const tokenHash = await sha256(token);
    
    // password_reset_tokens テーブルから検索
    const resetRecord = await db
      .prepare(`
        SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
        FROM password_reset_tokens prt
        WHERE prt.token_hash = ?
      `)
      .bind(tokenHash)
      .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();
    
    // トークンが見つからない場合、旧フィールドも確認（互換性）
    let userId: string | null = null;
    let tokenRecordId: string | null = null;
    let useLegacy = false;
    
    if (resetRecord) {
      // 使用済みチェック
      if (resetRecord.used_at) {
        await writeAuditLog(db, {
          action: 'PASSWORD_RESET_FAILED',
          actionCategory: 'auth',
          severity: 'warning',
          details: { reason: 'token_already_used', token_id: resetRecord.id },
          ip,
          userAgent,
        });
        
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'TOKEN_USED',
            message: 'This reset token has already been used',
          },
        }, 400);
      }
      
      // 有効期限チェック
      if (new Date(resetRecord.expires_at) < new Date()) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Reset token has expired',
          },
        }, 400);
      }
      
      userId = resetRecord.user_id;
      tokenRecordId = resetRecord.id;
    } else {
      // 旧フィールドで検索（互換性）
      const legacyUser = await db
        .prepare(`
          SELECT id, password_reset_expires 
          FROM users 
          WHERE password_reset_token = ?
        `)
        .bind(token)
        .first<{ id: string; password_reset_expires: string }>();
      
      if (!legacyUser) {
        await writeAuditLog(db, {
          action: 'PASSWORD_RESET_FAILED',
          actionCategory: 'auth',
          severity: 'warning',
          details: { reason: 'invalid_token' },
          ip,
          userAgent,
        });
        
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          },
        }, 400);
      }
      
      // 有効期限チェック
      if (new Date(legacyUser.password_reset_expires) < new Date()) {
        return c.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Reset token has expired',
          },
        }, 400);
      }
      
      userId = legacyUser.id;
      useLegacy = true;
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
    
    // password_reset_tokens を使用済みに更新
    if (tokenRecordId) {
      await db
        .prepare(`
          UPDATE password_reset_tokens 
          SET used_at = ?, used_ip = ?, used_user_agent = ?
          WHERE id = ?
        `)
        .bind(now, ip, userAgent, tokenRecordId)
        .run();
    }
    
    // 監査ログ
    await writeAuditLog(db, {
      targetUserId: userId,
      action: 'PASSWORD_RESET_COMPLETED',
      actionCategory: 'auth',
      details: { 
        token_id: tokenRecordId,
        legacy_mode: useLegacy,
      },
      ip,
      userAgent,
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
      .prepare(`
        SELECT id, email, name, role, email_verified_at, created_at, 
               last_login_at, is_disabled
        FROM users WHERE id = ?
      `)
      .bind(currentUser.id)
      .first<UserPublic & { last_login_at: string | null; is_disabled: number | null }>();
    
    if (!user) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    return c.json<ApiResponse<UserPublic & { last_login_at: string | null }>>({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        email_verified_at: user.email_verified_at,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
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
 * プロフィール更新
 */
auth.put('/profile', requireAuth, async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const { ip, userAgent } = getRequestMeta(c);
  
  try {
    const body = await c.req.json();
    const { name } = body;
    
    if (name !== undefined && typeof name !== 'string') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name must be a string',
        },
      }, 400);
    }
    
    const now = new Date().toISOString();
    
    await db
      .prepare(`
        UPDATE users SET name = ?, updated_at = ? WHERE id = ?
      `)
      .bind(name || null, now, currentUser.id)
      .run();
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      targetUserId: currentUser.id,
      action: 'PROFILE_UPDATED',
      actionCategory: 'data',
      details: { name },
      ip,
      userAgent,
    });
    
    // 更新後のユーザー情報を返す
    const user = await db
      .prepare(`
        SELECT id, email, name, role, email_verified_at, created_at
        FROM users WHERE id = ?
      `)
      .bind(currentUser.id)
      .first<UserPublic>();
    
    return c.json<ApiResponse<UserPublic>>({
      success: true,
      data: user!,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile',
      },
    }, 500);
  }
});

/**
 * パスワード変更（ログイン中のユーザー）
 */
auth.put('/password', requireAuth, async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const { ip, userAgent } = getRequestMeta(c);
  
  try {
    const body = await c.req.json();
    const { current_password, new_password } = body;
    
    if (!current_password || !new_password) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'current_password and new_password are required',
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
    
    // 現在のパスワードを確認
    const user = await db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(currentUser.id)
      .first<{ password_hash: string }>();
    
    if (!user) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    const isValid = await verifyPassword(current_password, user.password_hash);
    
    if (!isValid) {
      await writeAuditLog(db, {
        actorUserId: currentUser.id,
        targetUserId: currentUser.id,
        action: 'PASSWORD_CHANGE_FAILED',
        actionCategory: 'auth',
        severity: 'warning',
        details: { reason: 'invalid_current_password' },
        ip,
        userAgent,
      });
      
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
        },
      }, 401);
    }
    
    // パスワード更新
    const passwordHash = await hashPassword(new_password);
    const now = new Date().toISOString();
    
    await db
      .prepare(`
        UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
      `)
      .bind(passwordHash, now, currentUser.id)
      .run();
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      targetUserId: currentUser.id,
      action: 'PASSWORD_CHANGED',
      actionCategory: 'auth',
      ip,
      userAgent,
    });
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'Password has been changed successfully',
      },
    });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to change password',
      },
    }, 500);
  }
});

export default auth;

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

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * ユーザー登録
 */
auth.post('/register', async (c) => {
  const db = c.env.DB;
  
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
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', ?, ?)
      `)
      .bind(userId, email.toLowerCase(), passwordHash, name || null, now, now)
      .run();
    
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
      .first<User>();
    
    if (!user) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }, 401);
    }
    
    // パスワード検証
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }, 401);
    }
    
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
 */
auth.post('/password-reset/request', async (c) => {
  const db = c.env.DB;
  
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
    
    // リセットトークン生成
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1時間後
    
    // トークン保存
    await db
      .prepare(`
        UPDATE users 
        SET password_reset_token = ?, password_reset_expires = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(resetToken, expiresAt, new Date().toISOString(), user.id)
      .run();
    
    // TODO: SendGrid でメール送信
    // 開発環境ではトークンをレスポンスに含める（本番では削除）
    console.log(`Password reset token for ${email}: ${resetToken}`);
    
    return c.json<ApiResponse<{ message: string; debug_token?: string }>>({
      success: true,
      data: {
        message: 'If the email exists, a reset link will be sent',
        // 開発用: 本番では削除
        debug_token: c.env.ENVIRONMENT !== 'production' ? resetToken : undefined,
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
    
    // トークンでユーザー検索
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
    
    // 有効期限チェック
    if (new Date(user.password_reset_expires) < new Date()) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Reset token has expired',
        },
      }, 400);
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
      .bind(passwordHash, now, user.id)
      .run();
    
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

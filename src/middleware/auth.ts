/**
 * 認証ミドルウェア
 */

import { Context, Next, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyJWT, payloadToUser } from '../lib/jwt';
import type { Env, Variables, AuthUser } from '../types';

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

/**
 * Authorizationヘッダーからトークンを抽出
 */
function extractToken(c: AppContext): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return null;
  }
  
  const [scheme, token] = authHeader.split(' ');
  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  
  return token;
}

/**
 * JWT認証ミドルウェア（必須）
 * 
 * 認証が必要なルートで使用
 */
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const token = extractToken(c);
  
  if (!token) {
    throw new HTTPException(401, {
      message: 'Authorization header required',
    });
  }
  
  const payload = await verifyJWT(token, c.env);
  
  if (!payload) {
    throw new HTTPException(401, {
      message: 'Invalid or expired token',
    });
  }
  
  // コンテキストにユーザー情報を設定
  c.set('user', payloadToUser(payload));
  
  await next();
};

/**
 * JWT認証ミドルウェア（オプショナル）
 * 
 * 認証は必須ではないが、認証済みの場合はユーザー情報を取得
 */
export const optionalAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const token = extractToken(c);
  
  if (token) {
    const payload = await verifyJWT(token, c.env);
    if (payload) {
      c.set('user', payloadToUser(payload));
    }
  }
  
  await next();
};

/**
 * ロールベースのアクセス制御ミドルウェア
 * 
 * @param allowedRoles - 許可するロールの配列
 */
export function requireRole(
  ...allowedRoles: Array<'user' | 'admin' | 'super_admin'>
): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }
    
    // ロール階層: super_admin > admin > user
    const roleHierarchy: Record<string, number> = {
      'user': 1,
      'admin': 2,
      'super_admin': 3,
    };
    
    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = Math.min(...allowedRoles.map(r => roleHierarchy[r]));
    
    if (userRoleLevel < requiredLevel) {
      throw new HTTPException(403, {
        message: 'Insufficient permissions',
      });
    }
    
    await next();
  };
}

/**
 * 企業アクセス権チェックミドルウェア
 * 
 * リクエストパラメータの company_id に対するアクセス権を確認
 */
export function requireCompanyAccess(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }
    
    // super_admin は全企業にアクセス可能
    if (user.role === 'super_admin') {
      await next();
      return;
    }
    
    // company_id を取得（パスパラメータまたはクエリパラメータ）
    const companyId = c.req.param('company_id') || c.req.query('company_id');
    
    if (!companyId) {
      throw new HTTPException(400, {
        message: 'company_id is required',
      });
    }
    
    // D1でメンバーシップを確認
    const db = c.env.DB;
    const membership = await db
      .prepare('SELECT id, role FROM company_memberships WHERE user_id = ? AND company_id = ?')
      .bind(user.id, companyId)
      .first();
    
    if (!membership) {
      throw new HTTPException(403, {
        message: 'No access to this company',
      });
    }
    
    await next();
  };
}

/**
 * 現在のユーザーを取得（型付き）
 */
export function getCurrentUser(c: AppContext): AuthUser {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, {
      message: 'Not authenticated',
    });
  }
  return user;
}

/**
 * 現在のユーザーを取得（null許容）
 */
export function getCurrentUserOrNull(c: AppContext): AuthUser | null {
  return c.get('user') || null;
}

/**
 * 内部API用JWT（AWS↔Cloudflare間の認証）
 * 
 * アプリ用JWTとは別のシークレットを使用し、
 * service-to-service認証として機能します。
 */

import * as jose from 'jose';
import type { Env, InternalJWTPayload, InternalAuthContext } from '../types/env';

// デフォルト値
const DEFAULT_ISSUER = 'subsidy-app-internal';
const DEFAULT_AUDIENCE = 'subsidy-app-internal';
const DEFAULT_EXPIRES_IN = '5m';  // 内部APIは短めに

/**
 * 内部API用JWTを発行
 */
export async function signInternalJWT(
  payload: {
    service: string;        // 'cloudflare-api' | 'aws-worker' など
    action: string;         // 'job:submit' | 'eligibility:upsert' など
    job_id?: string;
    subsidy_id?: string;
    company_id?: string;
  },
  env: Env
): Promise<string> {
  const secret = new TextEncoder().encode(env.INTERNAL_JWT_SECRET);
  const issuer = env.INTERNAL_JWT_ISSUER || DEFAULT_ISSUER;
  const audience = env.INTERNAL_JWT_AUDIENCE || DEFAULT_AUDIENCE;

  const jwt = await new jose.SignJWT({
    sub: payload.service,
    action: payload.action,
    job_id: payload.job_id,
    subsidy_id: payload.subsidy_id,
    company_id: payload.company_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(DEFAULT_EXPIRES_IN)
    .sign(secret);

  return jwt;
}

/**
 * 内部API用JWTを検証
 */
export async function verifyInternalJWT(
  token: string,
  env: Env
): Promise<{ valid: true; payload: InternalJWTPayload } | { valid: false; error: string }> {
  try {
    const secret = new TextEncoder().encode(env.INTERNAL_JWT_SECRET);
    const issuer = env.INTERNAL_JWT_ISSUER || DEFAULT_ISSUER;
    const audience = env.INTERNAL_JWT_AUDIENCE || DEFAULT_AUDIENCE;

    const { payload } = await jose.jwtVerify(token, secret, {
      issuer,
      audience,
    });

    return {
      valid: true,
      payload: payload as unknown as InternalJWTPayload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JWT verification failed';
    console.error('Internal JWT verification failed:', message);
    return { valid: false, error: message };
  }
}

/**
 * 内部API認証ミドルウェア
 * 
 * Authorization: Bearer <internal_jwt> を検証し、
 * c.set('internalAuth', ...) に認証情報を設定します。
 */
export function internalAuthMiddleware(allowedActions?: string[]) {
  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing internal token' } },
        401
      );
    }

    const token = authHeader.slice(7);
    const result = await verifyInternalJWT(token, c.env);

    if (!result.valid) {
      return c.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: result.error } },
        401
      );
    }

    // アクション制限チェック
    if (allowedActions && allowedActions.length > 0) {
      if (!allowedActions.includes(result.payload.action)) {
        return c.json(
          { success: false, error: { code: 'FORBIDDEN', message: `Action '${result.payload.action}' not allowed` } },
          403
        );
      }
    }

    // 認証情報をコンテキストに設定
    const authContext: InternalAuthContext = {
      service: result.payload.sub,
      action: result.payload.action,
      job_id: result.payload.job_id,
      subsidy_id: result.payload.subsidy_id,
      company_id: result.payload.company_id,
    };

    c.set('internalAuth', authContext);
    await next();
  };
}

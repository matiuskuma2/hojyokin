/**
 * JWT 発行・検証 (jose ライブラリ使用)
 * 
 * 署名アルゴリズム: HS256
 * Cloudflare Workers 対応
 */

import { SignJWT, jwtVerify, JWTPayload as JoseJWTPayload } from 'jose';
import type { JWTPayload, AuthUser, Env } from '../types';

const ALGORITHM = 'HS256';
const DEFAULT_EXPIRES_IN = '15m';  // 15分

/**
 * シークレットキーをCryptoKeyに変換
 */
async function getSecretKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * 有効期限文字列をミリ秒に変換
 * @param duration - '15m', '1h', '7d' などの形式
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers: Record<string, number> = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
  };
  
  return value * multipliers[unit];
}

/**
 * JWT トークンを発行
 */
export async function signJWT(
  user: AuthUser,
  env: Env
): Promise<string> {
  const secret = env.JWT_SECRET;
  const issuer = env.JWT_ISSUER || 'subsidy-app';
  const audience = env.JWT_AUDIENCE || 'subsidy-app-users';
  const expiresIn = env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;
  
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  
  const secretKey = await getSecretKey(secret);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(parseDuration(expiresIn) / 1000);
  
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secretKey);
  
  return token;
}

/**
 * JWT トークンを検証
 * 
 * @returns 検証成功時はペイロード、失敗時は null
 */
export async function verifyJWT(
  token: string,
  env: Env
): Promise<JWTPayload | null> {
  try {
    const secret = env.JWT_SECRET;
    const issuer = env.JWT_ISSUER || 'subsidy-app';
    const audience = env.JWT_AUDIENCE || 'subsidy-app-users';
    
    if (!secret) {
      return null;
    }
    
    const secretKey = await getSecretKey(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      issuer,
      audience,
      algorithms: [ALGORITHM],
    });
    
    // 必須フィールドの検証
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    
    return {
      sub: payload.sub,
      email: payload.email as string,
      role: payload.role as 'user' | 'admin' | 'super_admin',
      iss: payload.iss as string,
      aud: payload.aud as string,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    // 署名不正、期限切れなど
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * JWTペイロードからAuthUserを生成
 */
export function payloadToUser(payload: JWTPayload): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

/**
 * トークンの残り有効期限（秒）を取得
 */
export function getTokenTTL(payload: JWTPayload): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

/**
 * トークンが期限切れかどうか
 */
export function isTokenExpired(payload: JWTPayload): boolean {
  return getTokenTTL(payload) === 0;
}

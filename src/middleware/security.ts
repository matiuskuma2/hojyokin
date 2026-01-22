/**
 * セキュリティミドルウェア
 * 
 * - レートリミッター（認証エンドポイント用）
 * - セキュリティヘッダー
 * - CSRFトークン検証（必要に応じて）
 */

import { Context, Next, MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

/**
 * セキュリティヘッダーミドルウェア
 * 
 * 主要なセキュリティヘッダーを設定
 */
export const securityHeaders: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  await next();
  
  // XSS対策
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (必要に応じてカスタマイズ)
  c.res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  
  // HSTS (Cloudflareが処理するが念のため)
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Permissions Policy
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
};

/**
 * レートリミッター（メモリベース - 簡易版）
 * 
 * 注意: Cloudflare Workersはステートレスなので、
 * 本格的なレートリミットはCloudflare Rate Limiting か KV/D1 を使用
 * 
 * この実装は同一リクエスト内でのバースト防止用
 */
interface RateLimitConfig {
  windowMs: number;    // 時間窓（ミリ秒）
  maxRequests: number; // 最大リクエスト数
  keyGenerator?: (c: AppContext) => string;
}

// D1ベースのレートリミッター
export function rateLimiter(config: RateLimitConfig): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  const { windowMs, maxRequests, keyGenerator } = config;
  
  return async (c, next) => {
    const db = c.env.DB;
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const key = keyGenerator ? keyGenerator(c) : `ratelimit:${ip}:${c.req.path}`;
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
      // 現在のウィンドウ内のリクエスト数をカウント
      // レートリミットテーブルがない場合はスキップ
      const result = await db.prepare(`
        SELECT COUNT(*) as count FROM rate_limit_log 
        WHERE key = ? AND timestamp > ?
      `).bind(key, windowStart).first<{ count: number }>();
      
      const currentCount = result?.count || 0;
      
      if (currentCount >= maxRequests) {
        // レートリミット超過
        c.res.headers.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
        c.res.headers.set('X-RateLimit-Remaining', '0');
        c.res.headers.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
        
        return c.json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        }, 429);
      }
      
      // リクエストを記録
      await db.prepare(`
        INSERT INTO rate_limit_log (key, timestamp) VALUES (?, ?)
      `).bind(key, now).run();
      
      // レートリミットヘッダーを設定
      c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
      c.res.headers.set('X-RateLimit-Remaining', String(maxRequests - currentCount - 1));
      c.res.headers.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      
    } catch (error) {
      // レートリミットテーブルがない場合はそのまま通す
      console.warn('Rate limit check failed:', error);
    }
    
    await next();
  };
}

/**
 * 認証エンドポイント用レートリミッター
 * 
 * - 5分間で最大10回のログイン試行
 * - 1時間で最大50回のパスワードリセット
 */
export const authRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5分
  maxRequests: 10,
});

export const passwordResetRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1時間
  maxRequests: 5,
});

/**
 * IP ベースの簡易ブロックチェック
 */
export const ipBlockCheck: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  
  // 環境変数からブロックIPリストを取得（カンマ区切り）
  const blockedIps = (c.env.BLOCKED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
  
  if (blockedIps.includes(ip)) {
    return c.json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'Access denied',
      },
    }, 403);
  }
  
  await next();
};

/**
 * リクエストIDミドルウェア
 * 
 * リクエストごとにユニークなIDを付与（ログ追跡用）
 */
export const requestId: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const id = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId' as any, id);
  c.res.headers.set('X-Request-Id', id);
  await next();
};

/**
 * セキュアCookie設定ヘルパー
 */
export function setSecureCookie(c: AppContext, name: string, value: string, options: {
  maxAge?: number;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
} = {}) {
  const { maxAge = 86400, httpOnly = true, sameSite = 'Strict' } = options;
  
  const cookieValue = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    httpOnly ? 'HttpOnly' : '',
    'Secure',
    `SameSite=${sameSite}`,
  ].filter(Boolean).join('; ');
  
  c.res.headers.append('Set-Cookie', cookieValue);
}

/**
 * ログインアテンプト記録（監査ログ用）
 */
export async function logLoginAttempt(
  db: D1Database,
  params: {
    email: string;
    ip: string;
    userAgent: string;
    success: boolean;
    reason?: string;
  }
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO login_attempts (email, ip, user_agent, success, failure_reason, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      params.email,
      params.ip,
      params.userAgent,
      params.success ? 1 : 0,
      params.reason || null
    ).run();
  } catch (error) {
    // テーブルがない場合は無視
    console.warn('Failed to log login attempt:', error);
  }
}

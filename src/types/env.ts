/**
 * Cloudflare Workers 環境変数・バインディング型定義
 */

export interface Env {
  // D1 Database
  DB: D1Database;
  
  // KV Namespace (キャッシュ用)
  KV?: KVNamespace;
  
  // 環境変数
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_EXPIRES_IN?: string;         // デフォルト: '15m'
  
  // SendGrid (パスワードリセット用)
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  
  // Jグランツ API (必要に応じて)
  JGRANTS_API_BASE_URL?: string;
  
  // 環境識別
  ENVIRONMENT?: 'development' | 'staging' | 'production';
}

// Hono用のBindings型
export type Bindings = Env;

// JWTペイロード型
export interface JWTPayload {
  sub: string;        // user_id
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

// 認証済みユーザー情報
export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
}

// Hono Variables (Context内で使用)
export interface Variables {
  user?: AuthUser;
  requestId?: string;
}

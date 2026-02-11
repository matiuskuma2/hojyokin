/**
 * Cloudflare Workers 環境変数・バインディング型定義
 */

export interface Env {
  // D1 Database
  DB: D1Database;
  
  // KV Namespace (キャッシュ用)
  KV?: KVNamespace;
  
  // ========================================
  // アプリ用JWT（ユーザー認証）
  // ========================================
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_EXPIRES_IN?: string;         // デフォルト: '15m'
  
  // ========================================
  // AWS連携用JWT（内部API認証）
  // ========================================
  INTERNAL_JWT_SECRET: string;     // AWS↔Cloudflare間の共有シークレット
  INTERNAL_JWT_ISSUER?: string;    // デフォルト: 'subsidy-app-internal'
  INTERNAL_JWT_AUDIENCE?: string;  // デフォルト: 'subsidy-app-internal'
  
  // AWS API Gateway エンドポイント
  AWS_JOB_API_BASE_URL?: string;   // 例: https://xxx.execute-api.ap-northeast-1.amazonaws.com
  
  // Cloudflare API エンドポイント（AWS→CF用）
  CLOUDFLARE_API_BASE_URL?: string; // 例: https://subsidy-app.pages.dev
  
  // ========================================
  // SendGrid (パスワードリセット用)
  // ========================================
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  
  // ========================================
  // Jグランツ API
  // ========================================
  JGRANTS_API_BASE_URL?: string;
  JGRANTS_MODE?: 'live' | 'mock' | 'cached-only';  // デフォルト: 'mock'
  
  // ========================================
  // Firecrawl API (Phase K1: ナレッジパイプライン)
  // ========================================
  FIRECRAWL_API_KEY?: string;
  
  // ========================================
  // Google Cloud Vision API (画像PDF用OCR)
  // ========================================
  GOOGLE_CLOUD_API_KEY?: string;
  
  // ========================================
  // OpenAI API (P4-3: 差分抽出 + Phase 19: AIコンシェルジュ)
  // ========================================
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;  // カスタムベースURL（デフォルト: https://api.openai.com/v1）
  OPENAI_MODEL?: string;     // モデル名（デフォルト: gpt-4o-mini）
  
  // ========================================
  // Cron Secret (外部Cronサービス認証)
  // ========================================
  CRON_SECRET?: string;
  
  // ========================================
  // R2 PDF Signing Secret (署名付きURL認証)
  // Firecrawl に渡す R2 PDF URL を署名で保護
  // ========================================
  R2_PDF_SIGNING_SECRET?: string;
  
  // ========================================
  // R2 Storage (Phase K1: ナレッジ保存)
  // ========================================
  // キー設計:
  //   raw/{subsidy_id}/{url_hash}.md       - Firecrawl取得のMarkdown原文
  //   structured/{subsidy_id}/{url_hash}.json - Extract Schema v1のJSON
  //   meta/{subsidy_id}/jgrants_detail.json   - JGrants APIレスポンス
  R2_KNOWLEDGE: R2Bucket;
  
  // 環境識別
  ENVIRONMENT?: 'development' | 'staging' | 'production';
}

// Hono用のBindings型
export type Bindings = Env;

// ========================================
// アプリ用JWTペイロード（ユーザー認証）
// ========================================
export interface JWTPayload {
  sub: string;        // user_id
  email: string;
  role: 'user' | 'admin' | 'super_admin' | 'agency';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

// ========================================
// 内部API用JWTペイロード（AWS↔Cloudflare）
// ========================================
export interface InternalJWTPayload {
  sub: string;        // service identifier (e.g., 'aws-worker', 'cloudflare-api')
  action: string;     // 実行アクション (e.g., 'eligibility:upsert', 'job:submit')
  job_id?: string;    // ジョブID（オプション）
  subsidy_id?: string;
  company_id?: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

// 認証済みユーザー情報
export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin' | 'agency';
}

// 内部API認証情報
export interface InternalAuthContext {
  service: string;
  action: string;
  job_id?: string;
  subsidy_id?: string;
  company_id?: string;
}

// Hono Variables (Context内で使用)
export interface Variables {
  user?: AuthUser;
  company?: {
    id: string;
    name: string;
    prefecture: string;
    city?: string;
    industry_major: string;
    employee_count: number;
    employee_band: string;
    capital?: number;
    annual_revenue?: number;
    established_date?: string;
    [key: string]: any;
  };
  internalAuth?: InternalAuthContext;
  requestId?: string;
}

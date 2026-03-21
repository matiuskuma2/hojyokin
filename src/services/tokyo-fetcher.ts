/**
 * Tokyo Fetcher クライアント
 * ==========================
 * AWS Tokyo Lambda (ap-northeast-1) 経由でHTMLを取得するクライアント
 * 
 * 用途:
 * - 海外IPからアクセスできない日本の公的ドメイン (meti.go.jp, etc.)
 * - geo-blockされたサイトのHTML取得とPDFリンク抽出
 * 
 * 認証: 内部JWT（INTERNAL_JWT_SECRET）
 * 
 * Phase B1: 2026-03-21
 */

import * as jose from 'jose';

// =============================================================================
// Types
// =============================================================================

export interface TokyoFetchRequest {
  url: string;
  timeout?: number;
  user_agent?: string;
  extract_pdfs?: boolean;
  follow_redirects?: boolean;
  max_html_bytes?: number;
  meta?: Record<string, unknown>;
}

export interface TokyoFetchSuccessResult {
  success: true;
  url: string;
  final_url: string;
  status: number;
  content_type: string;
  html_length: number;
  html?: string;
  title: string | null;
  pdf_urls: string[];
  fetched_at: string;
  elapsed_ms: number;
  meta?: Record<string, unknown>;
}

export interface TokyoFetchErrorResult {
  success: false;
  url: string;
  error_type: 'timeout' | 'dns' | 'tls' | 'blocked' | 'http_error' | 'network' | 'invalid_url';
  error_message: string;
  status?: number;
  elapsed_ms: number;
  meta?: Record<string, unknown>;
}

export type TokyoFetchResult = TokyoFetchSuccessResult | TokyoFetchErrorResult;

export interface TokyoBatchResult {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: TokyoFetchResult[];
}

// =============================================================================
// 日本IP必須ドメインリスト
// Phase B1 テスト結果 (2026-03-21):
//   - meti.go.jp, chusho.meti.go.jp, jgrants-portal.go.jp → Tokyo Lambda で解決
//   - toyama-sien.jp 等5件 → DNS不存在（サイト閉鎖）→ consumer のblockを解除せず維持
// =============================================================================

export const GEO_BLOCKED_DOMAINS = [
  'meti.go.jp',
  'chusho.meti.go.jp',
  'jgrants-portal.go.jp',
] as const;

/**
 * 閉鎖確認済みドメイン（DNS不存在）
 * blocked_domains から削除不要（自然にブロック維持）
 */
export const DEFUNCT_DOMAINS = [
  'kumamoto-isshin.jp',
  'torisankou.jp',
  'fukushima-iri.jp',
  'toyama-sien.jp',
  'ibarakig.jp',
] as const;

/**
 * URLが geo-block されたドメインに属するか判定
 */
export function isGeoBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return GEO_BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// =============================================================================
// Client
// =============================================================================

export class TokyoFetcherClient {
  private baseUrl: string;
  private jwtSecret: string;
  private jwtIssuer: string;
  private jwtAudience: string;

  constructor(config: {
    baseUrl: string;
    jwtSecret: string;
    jwtIssuer?: string;
    jwtAudience?: string;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.jwtSecret = config.jwtSecret;
    this.jwtIssuer = config.jwtIssuer || 'subsidy-app-internal';
    this.jwtAudience = config.jwtAudience || 'subsidy-app-internal';
  }

  /**
   * 環境変数からインスタンスを作成
   */
  static fromEnv(env: {
    AWS_JOB_API_BASE_URL?: string;
    INTERNAL_JWT_SECRET?: string;
    INTERNAL_JWT_ISSUER?: string;
    INTERNAL_JWT_AUDIENCE?: string;
  }): TokyoFetcherClient | null {
    if (!env.AWS_JOB_API_BASE_URL || !env.INTERNAL_JWT_SECRET) {
      return null;
    }
    return new TokyoFetcherClient({
      baseUrl: env.AWS_JOB_API_BASE_URL,
      jwtSecret: env.INTERNAL_JWT_SECRET,
      jwtIssuer: env.INTERNAL_JWT_ISSUER,
      jwtAudience: env.INTERNAL_JWT_AUDIENCE,
    });
  }

  /**
   * 内部JWT生成
   */
  private async generateToken(): Promise<string> {
    const secret = new TextEncoder().encode(this.jwtSecret);
    return await new jose.SignJWT({ action: 'fetch' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(this.jwtIssuer)
      .setAudience(this.jwtAudience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret);
  }

  /**
   * 単一URLフェッチ
   */
  async fetch(request: TokyoFetchRequest): Promise<TokyoFetchResult> {
    try {
      const token = await this.generateToken();
      const response = await fetch(`${this.baseUrl}/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          url: request.url,
          error_type: 'network',
          error_message: `Tokyo fetcher returned HTTP ${response.status}: ${text.substring(0, 200)}`,
          status: response.status,
          elapsed_ms: 0,
          meta: request.meta,
        };
      }

      return await response.json() as TokyoFetchResult;
    } catch (error) {
      return {
        success: false,
        url: request.url,
        error_type: 'network',
        error_message: `Tokyo fetcher client error: ${error instanceof Error ? error.message : String(error)}`,
        elapsed_ms: 0,
        meta: request.meta,
      };
    }
  }

  /**
   * 単一URLフェッチ（HTML含む）
   */
  async fetchWithHtml(request: TokyoFetchRequest): Promise<TokyoFetchResult> {
    try {
      const token = await this.generateToken();
      const response = await fetch(`${this.baseUrl}/fetch?include_html=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          url: request.url,
          error_type: 'network',
          error_message: `Tokyo fetcher returned HTTP ${response.status}: ${text.substring(0, 200)}`,
          status: response.status,
          elapsed_ms: 0,
          meta: request.meta,
        };
      }

      return await response.json() as TokyoFetchResult;
    } catch (error) {
      return {
        success: false,
        url: request.url,
        error_type: 'network',
        error_message: `Tokyo fetcher client error: ${error instanceof Error ? error.message : String(error)}`,
        elapsed_ms: 0,
        meta: request.meta,
      };
    }
  }

  /**
   * 複数URLバッチフェッチ
   */
  async fetchBatch(urls: TokyoFetchRequest[], concurrency?: number): Promise<TokyoBatchResult> {
    try {
      const token = await this.generateToken();
      const response = await fetch(`${this.baseUrl}/fetch/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ urls, concurrency }),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          total: urls.length,
          succeeded: 0,
          failed: urls.length,
          results: urls.map(u => ({
            success: false as const,
            url: u.url,
            error_type: 'network' as const,
            error_message: `Batch request failed: HTTP ${response.status}`,
            elapsed_ms: 0,
            meta: u.meta,
          })),
        };
      }

      return await response.json() as TokyoBatchResult;
    } catch (error) {
      return {
        success: false,
        total: urls.length,
        succeeded: 0,
        failed: urls.length,
        results: urls.map(u => ({
          success: false as const,
          url: u.url,
          error_type: 'network' as const,
          error_message: `Batch client error: ${error instanceof Error ? error.message : String(error)}`,
          elapsed_ms: 0,
          meta: u.meta,
        })),
      };
    }
  }

  /**
   * ヘルスチェック
   */
  async health(): Promise<{ ok: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/fetch/health`);
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// =============================================================================
// Smart Fetch: 直接fetch → Tokyo fetcher の自動フォールバック
// =============================================================================

/**
 * スマートフェッチ: geo-blockドメインはTokyo fetcherを使い、それ以外は直接fetchする
 * 
 * @param url 取得対象URL
 * @param env Cloudflare Worker環境変数
 * @param options オプション
 * @returns フェッチ結果
 */
export async function smartFetch(
  url: string,
  env: {
    AWS_JOB_API_BASE_URL?: string;
    INTERNAL_JWT_SECRET?: string;
    INTERNAL_JWT_ISSUER?: string;
    INTERNAL_JWT_AUDIENCE?: string;
  },
  options?: {
    /** 強制的にTokyo fetcherを使用 */
    forceProxy?: boolean;
    /** 直接fetchが失敗した場合にTokyo fetcherにフォールバック */
    fallbackToProxy?: boolean;
    timeout?: number;
    extract_pdfs?: boolean;
  }
): Promise<TokyoFetchResult & { via: 'direct' | 'tokyo-proxy' }> {
  const shouldUseProxy = options?.forceProxy || isGeoBlockedDomain(url);
  const fallback = options?.fallbackToProxy !== false; // デフォルトtrue

  // Tokyo proxy を使う場合
  if (shouldUseProxy) {
    const client = TokyoFetcherClient.fromEnv(env);
    if (!client) {
      return {
        success: false,
        url,
        error_type: 'network',
        error_message: 'Tokyo fetcher not configured (AWS_JOB_API_BASE_URL or INTERNAL_JWT_SECRET missing)',
        elapsed_ms: 0,
        via: 'tokyo-proxy',
      };
    }

    const result = await client.fetch({
      url,
      timeout: options?.timeout,
      extract_pdfs: options?.extract_pdfs,
    });
    return { ...result, via: 'tokyo-proxy' };
  }

  // 直接fetch
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutMs = options?.timeout || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 403/Connection reset -> fallback to Tokyo proxy
      if (fallback && (response.status === 403 || response.status === 503)) {
        const client = TokyoFetcherClient.fromEnv(env);
        if (client) {
          const result = await client.fetch({
            url,
            timeout: options?.timeout,
            extract_pdfs: options?.extract_pdfs,
          });
          return { ...result, via: 'tokyo-proxy' };
        }
      }

      return {
        success: false,
        url,
        error_type: response.status === 403 ? 'blocked' : 'http_error',
        error_message: `HTTP ${response.status}`,
        status: response.status,
        elapsed_ms: Date.now() - startTime,
        via: 'direct',
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // PDF link extraction (simplified for direct fetch)
    let pdfUrls: string[] = [];
    if (options?.extract_pdfs !== false) {
      const hrefRegex = /href\s*=\s*["']([^"']*\.pdf(?:\?[^"']*)?)/gi;
      let match: RegExpExecArray | null;
      const base = new URL(url);
      while ((match = hrefRegex.exec(html)) !== null) {
        try {
          pdfUrls.push(new URL(match[1], base).href);
        } catch { /* skip */ }
      }
      pdfUrls = [...new Set(pdfUrls)];
    }

    return {
      success: true,
      url,
      final_url: response.url || url,
      status: response.status,
      content_type: contentType,
      html_length: html.length,
      title,
      pdf_urls: pdfUrls,
      fetched_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startTime,
      via: 'direct',
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    // Connection reset / timeout -> fallback to Tokyo proxy
    if (fallback && (errMsg.includes('reset') || errMsg.includes('abort') || errMsg.includes('ECONNREFUSED'))) {
      const client = TokyoFetcherClient.fromEnv(env);
      if (client) {
        const result = await client.fetch({
          url,
          timeout: options?.timeout,
          extract_pdfs: options?.extract_pdfs,
        });
        return { ...result, via: 'tokyo-proxy' };
      }
    }

    let errorType: 'timeout' | 'dns' | 'tls' | 'blocked' | 'http_error' | 'network' | 'invalid_url' = 'network';
    if (errMsg.includes('abort') || errMsg.includes('timeout')) errorType = 'timeout';
    else if (errMsg.includes('ENOTFOUND')) errorType = 'dns';
    else if (errMsg.includes('reset') || errMsg.includes('ECONNREFUSED')) errorType = 'blocked';
    else if (errMsg.includes('certificate') || errMsg.includes('SSL')) errorType = 'tls';

    return {
      success: false,
      url,
      error_type: errorType,
      error_message: errMsg,
      elapsed_ms: elapsed,
      via: 'direct',
    };
  }
}

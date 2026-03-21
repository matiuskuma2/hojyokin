/**
 * Tokyo Fetcher Lambda
 * ====================
 * AWS Tokyo (ap-northeast-1) リージョンから日本のウェブサイトをfetchする
 * 日本国内IPからのアクセスが必要なドメイン（meti.go.jp等）向け
 * 
 * エンドポイント:
 * - POST /fetch         : URL受取 → HTML取得 → PDFリンク抽出 → 結果返却
 * - POST /fetch/batch   : 複数URLを一括取得
 * - GET  /fetch/health  : ヘルスチェック
 * 
 * 認証: 内部JWT（INTERNAL_JWT_SECRET）
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import * as jose from 'jose';

// =============================================================================
// Types
// =============================================================================

interface FetchRequest {
  url: string;
  /** タイムアウト (ms)。デフォルト 15000 */
  timeout?: number;
  /** User-Agent カスタマイズ */
  user_agent?: string;
  /** PDF リンク抽出を行うか。デフォルト true */
  extract_pdfs?: boolean;
  /** リダイレクトを追跡するか。デフォルト true */
  follow_redirects?: boolean;
  /** HTMLの最大返却バイト数。デフォルト 500000 (500KB) */
  max_html_bytes?: number;
  /** メタデータ (caller が自由に渡せる) */
  meta?: Record<string, unknown>;
}

interface FetchSuccessResponse {
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

interface FetchErrorResponse {
  success: false;
  url: string;
  error_type: 'timeout' | 'dns' | 'tls' | 'blocked' | 'http_error' | 'network' | 'invalid_url';
  error_message: string;
  status?: number;
  elapsed_ms: number;
  meta?: Record<string, unknown>;
}

type FetchResponse = FetchSuccessResponse | FetchErrorResponse;

interface BatchFetchRequest {
  urls: FetchRequest[];
  /** 並列数上限。デフォルト 5 */
  concurrency?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 30000;
const DEFAULT_MAX_HTML_BYTES = 500_000; // 500KB
const MAX_HTML_BYTES = 2_000_000; // 2MB
const MAX_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 5;

// 内部JWT設定
const INTERNAL_JWT_ISSUER = 'subsidy-app-internal';
const INTERNAL_JWT_AUDIENCE = 'subsidy-app-internal';

// =============================================================================
// JWT Auth
// =============================================================================

async function verifyInternalJWT(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(process.env.INTERNAL_JWT_SECRET || '');
    await jose.jwtVerify(token, secret, {
      issuer: INTERNAL_JWT_ISSUER,
      audience: INTERNAL_JWT_AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// HTML Helpers
// =============================================================================

/**
 * HTMLからタイトルを抽出
 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * HTMLからPDFリンクを抽出
 * - href属性から .pdf ファイルを検出
 * - テキスト中のURLパターンからも検出
 * - 相対URLを絶対URLに変換
 */
function extractPdfUrls(html: string, baseUrl: string): string[] {
  const pdfUrls = new Set<string>();
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  // 1. href属性からPDFリンクを検出
  const hrefRegex = /href\s*=\s*["']([^"']*\.pdf(?:\?[^"']*)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], base).href;
      pdfUrls.add(resolved);
    } catch {
      // invalid URL, skip
    }
  }

  // 2. src属性からPDFリンクを検出 (iframe/embed)
  const srcRegex = /src\s*=\s*["']([^"']*\.pdf(?:\?[^"']*)?)/gi;
  while ((match = srcRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], base).href;
      pdfUrls.add(resolved);
    } catch {
      // skip
    }
  }

  // 3. テキスト中のURL (https?://...pdf) を検出
  const textUrlRegex = /https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi;
  while ((match = textUrlRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[0]).href;
      pdfUrls.add(url);
    } catch {
      // skip
    }
  }

  return Array.from(pdfUrls);
}

// =============================================================================
// Core Fetch Logic
// =============================================================================

async function fetchUrl(req: FetchRequest): Promise<FetchResponse> {
  const startTime = Date.now();
  const url = req.url;
  const timeout = Math.min(req.timeout || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const userAgent = req.user_agent || DEFAULT_USER_AGENT;
  const extractPdfs = req.extract_pdfs !== false;
  const maxHtmlBytes = Math.min(req.max_html_bytes || DEFAULT_MAX_HTML_BYTES, MAX_HTML_BYTES);

  // URL validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        success: false,
        url,
        error_type: 'invalid_url',
        error_message: `Invalid protocol: ${parsedUrl.protocol}`,
        elapsed_ms: Date.now() - startTime,
        meta: req.meta,
      };
    }
  } catch {
    return {
      success: false,
      url,
      error_type: 'invalid_url',
      error_message: 'Invalid URL format',
      elapsed_ms: Date.now() - startTime,
      meta: req.meta,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      },
      redirect: req.follow_redirects !== false ? 'follow' : 'manual',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url || url;

    // Non-2xx レスポンス
    if (!response.ok) {
      const errorType = response.status === 403 ? 'blocked' : 'http_error';
      return {
        success: false,
        url,
        error_type: errorType,
        error_message: `HTTP ${response.status} ${response.statusText}`,
        status: response.status,
        elapsed_ms: Date.now() - startTime,
        meta: req.meta,
      };
    }

    // HTML以外のコンテンツはメタ情報だけ返す
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
    
    let html = '';
    let htmlLength = 0;
    let title: string | null = null;
    let pdfUrls: string[] = [];

    if (isHtml) {
      // HTMLを取得（サイズ制限あり）
      const arrayBuffer = await response.arrayBuffer();
      htmlLength = arrayBuffer.byteLength;
      
      // テキストデコード（Shift_JIS対応）
      let encoding = 'utf-8';
      const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
      if (charsetMatch) {
        encoding = charsetMatch[1].toLowerCase();
      }
      
      try {
        const decoder = new TextDecoder(encoding === 'shift_jis' || encoding === 'shift-jis' ? 'shift_jis' : encoding);
        html = decoder.decode(arrayBuffer);
      } catch {
        // フォールバック: UTF-8
        html = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
      }

      // meta charset 再チェック (レスポンスヘッダーにcharset無かった場合)
      if (!charsetMatch) {
        const metaCharset = html.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s;>]+)/i);
        if (metaCharset) {
          const detectedEncoding = metaCharset[1].toLowerCase();
          if (detectedEncoding === 'shift_jis' || detectedEncoding === 'shift-jis' || detectedEncoding === 'euc-jp') {
            try {
              const decoder = new TextDecoder(detectedEncoding);
              html = decoder.decode(arrayBuffer);
            } catch {
              // keep utf-8 decoded version
            }
          }
        }
      }

      title = extractTitle(html);

      if (extractPdfs) {
        pdfUrls = extractPdfUrls(html, finalUrl);
      }

      // HTMLを切り詰め
      if (html.length > maxHtmlBytes) {
        html = html.substring(0, maxHtmlBytes) + '\n<!-- TRUNCATED -->';
      }
    } else {
      // 非HTML (PDF直接リンク等)
      htmlLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentType.includes('application/pdf')) {
        pdfUrls = [finalUrl];
      }
    }

    return {
      success: true,
      url,
      final_url: finalUrl,
      status: response.status,
      content_type: contentType,
      html_length: htmlLength,
      html: isHtml ? html : undefined,
      title,
      pdf_urls: pdfUrls,
      fetched_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startTime,
      meta: req.meta,
    };

  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    let errorType: FetchErrorResponse['error_type'] = 'network';
    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
      errorType = 'timeout';
    } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
      errorType = 'dns';
    } else if (errMsg.includes('ECONNREFUSED') || errMsg.includes('ECONNRESET') || errMsg.includes('reset')) {
      errorType = 'blocked';
    } else if (errMsg.includes('certificate') || errMsg.includes('SSL') || errMsg.includes('TLS')) {
      errorType = 'tls';
    }

    return {
      success: false,
      url,
      error_type: errorType,
      error_message: errMsg,
      elapsed_ms: elapsed,
      meta: req.meta,
    };
  }
}

// =============================================================================
// Batch Fetch (with concurrency control)
// =============================================================================

async function fetchBatch(requests: FetchRequest[], concurrency: number): Promise<FetchResponse[]> {
  const results: FetchResponse[] = new Array(requests.length);
  let index = 0;

  async function worker() {
    while (index < requests.length) {
      const currentIndex = index++;
      results[currentIndex] = await fetchUrl(requests[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, requests.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

// =============================================================================
// Response Helper
// =============================================================================

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * POST /fetch
 * 単一URLフェッチ
 */
async function handleFetch(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let body: FetchRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { success: false, error: 'INVALID_JSON', message: 'Invalid request body' });
  }

  if (!body.url) {
    return jsonResponse(400, { success: false, error: 'MISSING_URL', message: 'url is required' });
  }

  console.log(`[FETCH] ${body.url}`);
  const result = await fetchUrl(body);
  console.log(`[FETCH] ${body.url} -> success=${result.success}, elapsed=${result.elapsed_ms}ms`);

  // HTMLはレスポンスが大きすぎるので、html_with_body パラメータがない限り除外
  const includeHtml = event.queryStringParameters?.include_html === 'true';
  if (!includeHtml && result.success && result.html) {
    const { html, ...rest } = result;
    return jsonResponse(200, rest);
  }

  return jsonResponse(result.success ? 200 : 502, result);
}

/**
 * POST /fetch/batch
 * 複数URLバッチフェッチ
 */
async function handleBatchFetch(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let body: BatchFetchRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { success: false, error: 'INVALID_JSON', message: 'Invalid request body' });
  }

  if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    return jsonResponse(400, { success: false, error: 'MISSING_URLS', message: 'urls array is required' });
  }

  if (body.urls.length > MAX_BATCH_SIZE) {
    return jsonResponse(400, {
      success: false,
      error: 'TOO_MANY_URLS',
      message: `Max ${MAX_BATCH_SIZE} URLs per batch`,
    });
  }

  const concurrency = Math.min(body.concurrency || DEFAULT_CONCURRENCY, 10);
  console.log(`[BATCH] ${body.urls.length} URLs, concurrency=${concurrency}`);

  const results = await fetchBatch(body.urls, concurrency);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  console.log(`[BATCH] Done: ${successCount} success, ${failCount} failed`);

  // Batch レスポンスではHTMLを含めない（サイズ削減）
  const cleanResults = results.map(r => {
    if (r.success && 'html' in r) {
      const { html, ...rest } = r;
      return rest;
    }
    return r;
  });

  return jsonResponse(200, {
    success: true,
    total: results.length,
    succeeded: successCount,
    failed: failCount,
    results: cleanResults,
  });
}

/**
 * GET /fetch/health
 * ヘルスチェック
 */
async function handleHealth(): Promise<APIGatewayProxyResultV2> {
  return jsonResponse(200, {
    success: true,
    service: 'tokyo-fetcher',
    region: process.env.AWS_REGION || 'ap-northeast-1',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    capabilities: ['html_fetch', 'pdf_extraction', 'shift_jis', 'batch'],
  });
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    };
  }

  // Health は認証不要
  if (method === 'GET' && path === '/fetch/health') {
    return await handleHealth();
  }

  // JWT認証 (fetch系は認証必須)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { success: false, error: 'UNAUTHORIZED', message: 'Authorization header required' });
  }

  const token = authHeader.slice(7);
  const valid = await verifyInternalJWT(token);
  if (!valid) {
    return jsonResponse(401, { success: false, error: 'INVALID_TOKEN', message: 'Token verification failed' });
  }

  try {
    if (method === 'POST' && path === '/fetch') {
      return await handleFetch(event);
    }
    if (method === 'POST' && path === '/fetch/batch') {
      return await handleBatchFetch(event);
    }

    return jsonResponse(404, { success: false, error: 'NOT_FOUND', message: `Route not found: ${method} ${path}` });
  } catch (error) {
    console.error('Handler error:', error);
    return jsonResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

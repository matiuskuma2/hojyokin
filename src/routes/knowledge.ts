/**
 * Knowledge Pipeline Routes
 * 
 * Phase K1: JGrants → 外部URL抽出 → Firecrawl → D1/R2保存
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';
import { internalAuthMiddleware } from '../lib/internal-jwt';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// =============================================================================
// Utility: Cryptographic Hash Generation (SHA-256)
// =============================================================================

/**
 * SHA-256ハッシュを生成（WebCrypto API使用）
 * @param input - ハッシュ化する文字列
 * @returns 64文字のhex文字列
 */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SHA-256ハッシュの短縮版（32文字）
 */
async function sha256Short(input: string): Promise<string> {
  const full = await sha256Hex(input);
  return full.substring(0, 32);
}

/**
 * UTF-8文字列から安全なハッシュを生成（同期版、btoa代替）
 * 非同期が使えない場面で使用
 */
function safeHashSync(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  
  let hash = '';
  for (let i = 0; i < Math.min(data.length, 48); i++) {
    hash += data[i].toString(16).padStart(2, '0');
  }
  
  while (hash.length < 64) {
    hash += '0';
  }
  
  return hash.substring(0, 64);
}

// =============================================================================
// Utility: R2 Storage Operations
// =============================================================================

/**
 * R2キー設計:
 *   raw/{subsidy_id}/{url_hash}.md        - Firecrawl取得のMarkdown原文
 *   structured/{subsidy_id}/{url_hash}.json - Extract Schema v1のJSON
 *   meta/{subsidy_id}/jgrants_detail.json   - JGrants APIレスポンス
 */

interface R2SaveResult {
  key: string;
  size: number;
  uploaded_at: string;
}

/**
 * R2にMarkdown原文を保存
 */
async function saveRawToR2(
  r2: R2Bucket,
  subsidyId: string,
  urlHash: string,
  markdown: string
): Promise<R2SaveResult> {
  const key = `raw/${subsidyId}/${urlHash}.md`;
  const encoder = new TextEncoder();
  const data = encoder.encode(markdown);
  
  await r2.put(key, data, {
    httpMetadata: {
      contentType: 'text/markdown; charset=utf-8'
    },
    customMetadata: {
      subsidy_id: subsidyId,
      url_hash: urlHash,
      content_type: 'raw_markdown'
    }
  });
  
  return {
    key,
    size: data.byteLength,
    uploaded_at: new Date().toISOString()
  };
}

/**
 * R2から原文Markdownを取得
 */
async function getRawFromR2(
  r2: R2Bucket,
  subsidyId: string,
  urlHash: string
): Promise<string | null> {
  const key = `raw/${subsidyId}/${urlHash}.md`;
  const obj = await r2.get(key);
  if (!obj) return null;
  return await obj.text();
}

/**
 * R2に構造化JSONを保存
 */
async function saveStructuredToR2(
  r2: R2Bucket,
  subsidyId: string,
  urlHash: string,
  structured: object
): Promise<R2SaveResult> {
  const key = `structured/${subsidyId}/${urlHash}.json`;
  const json = JSON.stringify(structured, null, 2);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  
  await r2.put(key, data, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8'
    },
    customMetadata: {
      subsidy_id: subsidyId,
      url_hash: urlHash,
      content_type: 'structured_json',
      schema_version: 'v1'
    }
  });
  
  return {
    key,
    size: data.byteLength,
    uploaded_at: new Date().toISOString()
  };
}

/**
 * R2から構造化JSONを取得
 */
async function getStructuredFromR2(
  r2: R2Bucket,
  subsidyId: string,
  urlHash: string
): Promise<object | null> {
  const key = `structured/${subsidyId}/${urlHash}.json`;
  const obj = await r2.get(key);
  if (!obj) return null;
  return await obj.json();
}

/**
 * ドメインキーを抽出（ホスト名からサブドメインを除く）
 */
function extractDomainKey(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // go.jp, lg.jp などの2階層TLDを考慮
    const parts = hostname.split('.');
    if (parts.length >= 3 && (parts[parts.length - 2] === 'go' || parts[parts.length - 2] === 'lg')) {
      // xxx.go.jp → xxx.go.jp (3パーツ維持)
      return parts.slice(-3).join('.');
    }
    // 通常のドメイン
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return 'unknown';
  }
}

// =============================================================================
// Types
// =============================================================================

interface SourceUrl {
  url_id: string;
  subsidy_id: string;
  url: string;
  url_hash: string;
  source_type: 'jgrants_detail' | 'secretariat' | 'prefecture' | 'city' | 'ministry' | 'portal' | 'other';
  doc_type?: string;
  status: 'pending' | 'ok' | 'error' | 'blocked' | 'needs_review';
  priority: number;
  crawl_depth: number;
}

interface ExtractSchemaV1 {
  schema_version: 'v1';
  source: {
    url: string;
    retrieved_at: string;
    source_type: string;
    title_guess?: string;
    language?: string;
  };
  summary: {
    title: string;
    one_liner: string;
    what_it_supports: string;
    target_audience?: string;
  };
  eligibility: {
    who_can_apply: string[];
    area: {
      scope: string;
      detail?: string[];
    };
    industry: {
      allowed: string[];
      not_allowed?: string[];
    };
    company_size: {
      employee_limit: string;
      capital_limit?: string;
      other_conditions?: string[];
    };
    disqualifiers?: string[];
  };
  funding: {
    subsidy_rate: string;
    limit_amount: {
      max: string;
      min?: string;
    };
    eligible_costs: string[];
    ineligible_costs?: string[];
    payment_flow?: string;
  };
  deadlines: {
    application_window: {
      start?: string;
      end?: string;
    };
    project_period?: {
      start?: string;
      end?: string;
    };
    notes?: string[];
  };
  required_documents: Array<{
    name: string;
    required_level: 'mandatory' | 'conditional' | 'optional';
    format?: string;
    how_to_get?: string;
    link?: string;
    notes?: string;
  }>;
  how_to_write?: {
    evaluation_points?: string[];
    common_mistakes?: string[];
    recommended_structure?: string[];
  };
  examples?: Array<{
    industry?: string;
    company_profile?: string;
    what_they_did?: string;
    cost_breakdown?: string;
    outcome?: string;
    source_quote?: string;
  }>;
  evidence?: Array<{
    field: string;
    quote: string;
    location_hint?: string;
  }>;
  quality: {
    confidence: number;
    warnings: string[];
    needs_human_review: boolean;
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * URLを正規化
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // フラグメント削除
    urlObj.hash = '';
    
    // UTMパラメータ削除
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    utmParams.forEach(param => urlObj.searchParams.delete(param));
    
    // 末尾スラッシュ統一（パスがルートでない場合は削除）
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // HTTP→HTTPS変換（可能な場合）
    if (urlObj.protocol === 'http:') {
      urlObj.protocol = 'https:';
    }
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * URLを正規化してSHA-256ハッシュを生成（非同期版）
 */
async function normalizeAndHashUrlAsync(url: string): Promise<{ normalized: string; hash: string; domainKey: string }> {
  const normalized = normalizeUrl(url);
  const hash = await sha256Short(normalized);
  const domainKey = extractDomainKey(url);
  return { normalized, hash, domainKey };
}

/**
 * URLを正規化してハッシュを生成（同期版、互換性用）
 */
function normalizeAndHashUrl(url: string): { normalized: string; hash: string } {
  const normalized = normalizeUrl(url);
  const hash = safeHashSync(normalized).substring(0, 32);
  return { normalized, hash };
}

/**
 * ドメインからsource_typeを判定
 */
function detectSourceType(url: string): SourceUrl['source_type'] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // 都道府県・市区町村 (lg.jp)
    if (hostname.endsWith('.lg.jp')) {
      // 都道府県は通常 pref.xxx.lg.jp のパターン
      if (hostname.includes('pref.') || hostname.match(/^[a-z]+\.lg\.jp$/)) {
        return 'prefecture';
      }
      return 'city';
    }
    
    // 省庁・政府機関 (go.jp)
    if (hostname.endsWith('.go.jp')) {
      // 事務局系（中小機構など）
      if (hostname.includes('smrj') || hostname.includes('mirasapo') || hostname.includes('jizokukahojokin')) {
        return 'secretariat';
      }
      return 'ministry';
    }
    
    // ポータル系
    if (hostname.includes('jgrants') || hostname.includes('support-navi')) {
      return 'portal';
    }
    
    // 事務局・支援機関
    if (hostname.includes('ipa.go.jp') || hostname.includes('jetro')) {
      return 'secretariat';
    }
    
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * JSONからURL文字列を抽出
 */
function extractUrlsFromJson(obj: unknown, urls: Set<string> = new Set()): Set<string> {
  if (typeof obj === 'string') {
    // URL形式かチェック
    const urlPattern = /https?:\/\/[^\s"'<>]+/g;
    const matches = obj.match(urlPattern);
    if (matches) {
      matches.forEach(url => urls.add(url));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => extractUrlsFromJson(item, urls));
  } else if (typeof obj === 'object' && obj !== null) {
    Object.values(obj).forEach(value => extractUrlsFromJson(value, urls));
  }
  return urls;
}

// =============================================================================
// API Routes
// =============================================================================

/**
 * POST /knowledge/subsidies/:subsidy_id/extract-urls
 * JGrants詳細から外部URLを抽出してsource_urlに登録
 */
app.post('/subsidies/:subsidy_id/extract-urls', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    // subsidy_cacheから詳細JSONを取得
    const subsidyCache = await DB.prepare(`
      SELECT id, title, detail_json FROM subsidy_cache WHERE id = ?
    `).bind(subsidy_id).first<{ id: string; title: string; detail_json: string }>();

    if (!subsidyCache) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subsidy not found in cache' }
      }, 404);
    }

    let detailJson: Record<string, unknown> = {};
    try {
      detailJson = JSON.parse(subsidyCache.detail_json || '{}');
    } catch {
      // パース失敗
    }

    // URLを抽出
    const extractedUrls = extractUrlsFromJson(detailJson);
    
    // inquiry_urlを優先的に追加
    const inquiryUrl = (detailJson as Record<string, unknown>).inquiry_url as string | undefined;
    if (inquiryUrl && typeof inquiryUrl === 'string') {
      extractedUrls.add(inquiryUrl);
    }

    // subsidy_metadataにupsert
    const contentHash = safeHash(JSON.stringify(detailJson));
    await DB.prepare(`
      INSERT INTO subsidy_metadata (
        subsidy_id, title, inquiry_url, external_links, jgrants_raw_json, content_hash, last_seen_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(subsidy_id) DO UPDATE SET
        title = excluded.title,
        inquiry_url = excluded.inquiry_url,
        external_links = excluded.external_links,
        jgrants_raw_json = excluded.jgrants_raw_json,
        content_hash = excluded.content_hash,
        has_changes = CASE WHEN subsidy_metadata.content_hash != excluded.content_hash THEN 1 ELSE 0 END,
        last_seen_at = datetime('now'),
        updated_at = datetime('now')
    `).bind(
      subsidy_id,
      subsidyCache.title,
      inquiryUrl || null,
      JSON.stringify([...extractedUrls]),
      subsidyCache.detail_json,
      contentHash
    ).run();

    // source_urlに登録
    const insertedUrls: SourceUrl[] = [];
    for (const url of extractedUrls) {
      const { normalized, hash } = normalizeAndHashUrl(url);
      const sourceType = detectSourceType(url);
      const urlId = crypto.randomUUID();

      try {
        await DB.prepare(`
          INSERT INTO source_url (
            url_id, subsidy_id, url, url_hash, source_type, status, priority, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
          ON CONFLICT(url_hash) DO UPDATE SET
            subsidy_id = excluded.subsidy_id,
            updated_at = datetime('now')
        `).bind(
          urlId,
          subsidy_id,
          normalized,
          hash,
          sourceType,
          sourceType === 'jgrants_detail' ? 1 : (sourceType === 'secretariat' ? 2 : 5)
        ).run();

        insertedUrls.push({
          url_id: urlId,
          subsidy_id,
          url: normalized,
          url_hash: hash,
          source_type: sourceType,
          status: 'pending',
          priority: 5,
          crawl_depth: 0
        });
      } catch {
        // 重複無視
      }
    }

    return c.json<ApiResponse<{ extracted_count: number; urls: SourceUrl[] }>>({
      success: true,
      data: {
        extracted_count: insertedUrls.length,
        urls: insertedUrls
      }
    });
  } catch (error) {
    console.error('URL extraction error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'EXTRACTION_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/source-urls
 * クロール対象URLの一覧取得
 */
app.get('/source-urls', requireAuth, async (c) => {
  const { DB } = c.env;
  const status = c.req.query('status') || 'pending';
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  try {
    const urls = await DB.prepare(`
      SELECT * FROM source_url 
      WHERE status = ?
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).bind(status, limit).all<SourceUrl>();

    return c.json<ApiResponse<{ urls: SourceUrl[]; count: number }>>({
      success: true,
      data: {
        urls: urls.results || [],
        count: urls.results?.length || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/crawl/:url_id
 * 指定URLをFirecrawlでスクレイプしてR2/D1に保存
 * 
 * 処理フロー:
 * 1. ドメインポリシー確認（blocked/rate limit）
 * 2. Firecrawl API呼び出し
 * 3. R2にraw Markdownを保存
 * 4. D1にメタデータを保存
 * 5. 連続失敗時は自動blocked化
 */
app.post('/crawl/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB, R2_KNOWLEDGE } = c.env;
  const firecrawlApiKey = c.env.FIRECRAWL_API_KEY;

  if (!firecrawlApiKey) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'FIRECRAWL_API_KEY not configured' }
    }, 500);
  }

  try {
    // URLを取得
    const sourceUrl = await DB.prepare(`
      SELECT * FROM source_url WHERE url_id = ?
    `).bind(url_id).first<SourceUrl & { domain_key?: string }>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    // ドメインキーを取得/設定
    const domainKey = sourceUrl.domain_key || extractDomainKey(sourceUrl.url);
    
    // ドメインポリシーを確認（テーブルが存在する場合のみ）
    let policy: { enabled: number; notes?: string } | null = null;
    try {
      policy = await DB.prepare(`
        SELECT enabled, notes FROM domain_policy WHERE domain_key = ?
      `).bind(domainKey).first();
    } catch {
      // domain_policyテーブルがまだ無い場合は無視
    }

    // ドメインがブロックされている場合
    if (policy && policy.enabled === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { 
          code: 'DOMAIN_BLOCKED', 
          message: `Domain ${domainKey} is blocked: ${policy.notes || 'No reason specified'}` 
        }
      }, 403);
    }

    // crawl_jobを作成
    const jobId = crypto.randomUUID();
    await DB.prepare(`
      INSERT INTO crawl_job (job_id, url_id, subsidy_id, job_type, status, created_at, updated_at)
      VALUES (?, ?, ?, 'scrape', 'processing', datetime('now'), datetime('now'))
    `).bind(jobId, url_id, sourceUrl.subsidy_id).run();

    // Firecrawl APIを呼び出し
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlApiKey}`
      },
      body: JSON.stringify({
        url: sourceUrl.url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 2000
      })
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      const errorCode = firecrawlResponse.status.toString();
      
      // ドメインポリシーの失敗統計を更新（テーブルが存在する場合）
      try {
        await DB.prepare(`
          INSERT INTO domain_policy (domain_key, enabled, failure_count, last_failure_at, last_error_code, notes)
          VALUES (?, 1, 1, datetime('now'), ?, 'Auto-created on first failure')
          ON CONFLICT(domain_key) DO UPDATE SET
            failure_count = failure_count + 1,
            last_failure_at = datetime('now'),
            last_error_code = ?
        `).bind(domainKey, errorCode, errorCode).run();
      } catch {
        // テーブルが無い場合は無視
      }
      
      throw new Error(`Firecrawl API error: ${firecrawlResponse.status} - ${errorText}`);
    }

    const crawlResult = await firecrawlResponse.json() as {
      success: boolean;
      data?: {
        markdown?: string;
        html?: string;
        metadata?: {
          title?: string;
          language?: string;
        };
      };
    };

    if (!crawlResult.success || !crawlResult.data) {
      throw new Error('Firecrawl returned no data');
    }

    const markdown = crawlResult.data.markdown || '';
    const wordCount = markdown.length;
    const language = crawlResult.data.metadata?.language || 'ja';
    
    // SHA-256ハッシュを計算
    const contentHash = await sha256Hex(markdown);
    const urlHashResult = await normalizeAndHashUrlAsync(sourceUrl.url);
    
    // R2に保存（R2が設定されている場合）
    let r2Result: R2SaveResult | null = null;
    let storageBackend: 'd1_inline' | 'r2' = 'd1_inline';
    
    if (R2_KNOWLEDGE) {
      try {
        r2Result = await saveRawToR2(
          R2_KNOWLEDGE,
          sourceUrl.subsidy_id,
          urlHashResult.hash,
          markdown
        );
        storageBackend = 'r2';
      } catch (r2Error) {
        console.error('R2 save error (falling back to D1):', r2Error);
        // R2保存失敗時はD1にインライン保存
      }
    }

    // source_urlを更新（ドメインキーも設定）
    await DB.prepare(`
      UPDATE source_url SET
        status = 'ok',
        content_hash = ?,
        last_crawled_at = datetime('now'),
        error_count = 0,
        updated_at = datetime('now')
      WHERE url_id = ?
    `).bind(contentHash, url_id).run();

    // doc_objectを作成/更新
    const docId = crypto.randomUUID();
    
    if (storageBackend === 'r2' && r2Result) {
      // R2保存成功 - 新しいカラムを使用
      try {
        await DB.prepare(`
          INSERT INTO doc_object (
            id, url_id, subsidy_id, extract_version, extracted_at, 
            word_count, language, storage_backend,
            r2_key_raw, r2_raw_size, r2_uploaded_at, content_hash_sha256,
            created_at, updated_at
          ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, 'r2', ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(url_id) DO UPDATE SET
            word_count = excluded.word_count,
            language = excluded.language,
            storage_backend = 'r2',
            r2_key_raw = excluded.r2_key_raw,
            r2_raw_size = excluded.r2_raw_size,
            r2_uploaded_at = excluded.r2_uploaded_at,
            content_hash_sha256 = excluded.content_hash_sha256,
            updated_at = datetime('now')
        `).bind(
          docId,
          url_id,
          sourceUrl.subsidy_id,
          wordCount,
          language,
          r2Result.key,
          r2Result.size,
          r2Result.uploaded_at,
          contentHash
        ).run();
      } catch {
        // 新しいカラムが無い場合はフォールバック
        await DB.prepare(`
          INSERT INTO doc_object (
            id, url_id, subsidy_id, extract_version, extracted_at, 
            word_count, language, created_at, updated_at
          ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(url_id) DO UPDATE SET
            word_count = excluded.word_count,
            language = excluded.language,
            updated_at = datetime('now')
        `).bind(docId, url_id, sourceUrl.subsidy_id, wordCount, language).run();
      }
    } else {
      // D1インライン保存（R2未設定またはエラー時）- 従来のスキーマ互換
      await DB.prepare(`
        INSERT INTO doc_object (
          id, url_id, subsidy_id, extract_version, extracted_at, 
          word_count, language, created_at, updated_at
        ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(url_id) DO UPDATE SET
          word_count = excluded.word_count,
          language = excluded.language,
          updated_at = datetime('now')
      `).bind(docId, url_id, sourceUrl.subsidy_id, wordCount, language).run();
    }

    // ドメインポリシーの成功統計を更新（テーブルが存在する場合）
    try {
      await DB.prepare(`
        INSERT INTO domain_policy (domain_key, enabled, success_count, last_success_at, total_requests, notes)
        VALUES (?, 1, 1, datetime('now'), 1, 'Auto-created on first success')
        ON CONFLICT(domain_key) DO UPDATE SET
          success_count = success_count + 1,
          total_requests = total_requests + 1,
          last_success_at = datetime('now')
      `).bind(domainKey).run();
    } catch {
      // テーブルが無い場合は無視
    }

    // crawl_jobを完了
    await DB.prepare(`
      UPDATE crawl_job SET
        status = 'completed',
        completed_at = datetime('now'),
        result = ?,
        updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(JSON.stringify({
      markdown_length: wordCount,
      title: crawlResult.data.metadata?.title,
      storage_backend: storageBackend,
      r2_key: r2Result?.key
    }), jobId).run();

    return c.json<ApiResponse<{
      job_id: string;
      url_id: string;
      status: string;
      markdown_length: number;
      title?: string;
      storage_backend: string;
      r2_key?: string;
    }>>({
      success: true,
      data: {
        job_id: jobId,
        url_id,
        status: 'completed',
        markdown_length: wordCount,
        title: crawlResult.data.metadata?.title,
        storage_backend: storageBackend,
        r2_key: r2Result?.key
      }
    });
  } catch (error) {
    console.error('Crawl error:', error);
    
    // エラー記録
    await DB.prepare(`
      UPDATE source_url SET
        status = 'error',
        last_error = ?,
        error_count = error_count + 1,
        updated_at = datetime('now')
      WHERE url_id = ?
    `).bind(String(error), url_id).run();

    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CRAWL_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/extract/:url_id
 * クロール済みコンテンツからSchema v1で構造化抽出
 */
app.post('/extract/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB } = c.env;
  
  // OpenAI APIキーはAWS Lambda経由で使用するため、
  // ここでは簡易的なルール抽出のみ実装
  // 本格的なLLM抽出はAWS側で実行

  try {
    const sourceUrl = await DB.prepare(`
      SELECT su.*, do.word_count
      FROM source_url su
      LEFT JOIN doc_object do ON su.url_id = do.url_id
      WHERE su.url_id = ?
    `).bind(url_id).first<SourceUrl & { word_count?: number }>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    if (sourceUrl.status !== 'ok') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_CRAWLED', message: 'URL has not been successfully crawled yet' }
      }, 400);
    }

    // 抽出ジョブをAWSに送信（既存のjobs APIを使用）
    return c.json<ApiResponse<{ message: string; url_id: string }>>({
      success: true,
      data: {
        message: 'Use /api/jobs/subsidies/{subsidy_id}/ingest to trigger LLM extraction via AWS',
        url_id
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'EXTRACT_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/summary/:subsidy_id
 * 補助金のナレッジサマリーを取得（壁打ちBot用）
 */
app.get('/summary/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    // knowledge_summaryから取得
    const summary = await DB.prepare(`
      SELECT * FROM knowledge_summary WHERE subsidy_id = ?
    `).bind(subsidy_id).first();

    if (!summary) {
      // サマリーがない場合、eligibility_rulesから簡易生成
      const rules = await DB.prepare(`
        SELECT * FROM eligibility_rules WHERE subsidy_id = ? ORDER BY category
      `).bind(subsidy_id).all();

      const extraction = await DB.prepare(`
        SELECT * FROM eligibility_extractions WHERE subsidy_id = ?
      `).bind(subsidy_id).first();

      return c.json<ApiResponse<{
        subsidy_id: string;
        has_summary: boolean;
        rules_count: number;
        rules: unknown[];
        extraction?: unknown;
      }>>({
        success: true,
        data: {
          subsidy_id,
          has_summary: false,
          rules_count: rules.results?.length || 0,
          rules: rules.results || [],
          extraction: extraction || undefined
        }
      });
    }

    return c.json<ApiResponse<unknown>>({
      success: true,
      data: summary
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/stats
 * ナレッジパイプラインの統計情報
 */
app.get('/stats', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const stats = await DB.batch([
      DB.prepare(`SELECT COUNT(*) as count FROM subsidy_metadata`),
      DB.prepare(`SELECT COUNT(*) as count FROM source_url`),
      DB.prepare(`SELECT status, COUNT(*) as count FROM source_url GROUP BY status`),
      DB.prepare(`SELECT COUNT(*) as count FROM doc_object`),
      DB.prepare(`SELECT COUNT(*) as count FROM knowledge_summary`),
      DB.prepare(`SELECT COUNT(*) as count FROM crawl_job WHERE status = 'pending'`)
    ]);

    return c.json<ApiResponse<{
      subsidies: number;
      source_urls: number;
      url_status: Record<string, number>;
      documents: number;
      summaries: number;
      pending_jobs: number;
    }>>({
      success: true,
      data: {
        subsidies: (stats[0].results?.[0] as { count: number })?.count || 0,
        source_urls: (stats[1].results?.[0] as { count: number })?.count || 0,
        url_status: Object.fromEntries(
          (stats[2].results as Array<{ status: string; count: number }> || [])
            .map(r => [r.status, r.count])
        ),
        documents: (stats[3].results?.[0] as { count: number })?.count || 0,
        summaries: (stats[4].results?.[0] as { count: number })?.count || 0,
        pending_jobs: (stats[5].results?.[0] as { count: number })?.count || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

// =============================================================================
// Internal API (for Cron Jobs)
// =============================================================================

/**
 * POST /knowledge/internal/sync-jgrants
 * JGrantsから差分同期（Cron Trigger用）
 */
app.post('/internal/sync-jgrants', internalAuthMiddleware(['knowledge:sync']), async (c) => {
  const { DB } = c.env;
  
  // TODO: JGrants APIから最新データを取得して差分検知
  // Phase K2で実装予定
  
  return c.json<ApiResponse<{ message: string }>>({
    success: true,
    data: {
      message: 'JGrants sync not yet implemented - Phase K2'
    }
  });
});

/**
 * GET /knowledge/raw/:subsidy_id/:url_hash
 * R2からMarkdown原文を取得（壁打ちBot用）
 */
app.get('/raw/:subsidy_id/:url_hash', requireAuth, async (c) => {
  const { subsidy_id, url_hash } = c.req.param();
  const { R2_KNOWLEDGE, DB } = c.env;

  if (!R2_KNOWLEDGE) {
    // R2が無い場合はD1から取得を試みる
    try {
      const doc = await DB.prepare(`
        SELECT raw_markdown FROM doc_object 
        WHERE subsidy_id = ? AND storage_backend = 'd1_inline'
        LIMIT 1
      `).bind(subsidy_id).first<{ raw_markdown?: string }>();
      
      if (doc?.raw_markdown) {
        return c.text(doc.raw_markdown, 200, {
          'Content-Type': 'text/markdown; charset=utf-8'
        });
      }
    } catch {
      // テーブル/カラムが無い場合は無視
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_NOT_CONFIGURED', message: 'R2 storage is not configured' }
    }, 500);
  }

  try {
    const markdown = await getRawFromR2(R2_KNOWLEDGE, subsidy_id, url_hash);
    
    if (!markdown) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Raw markdown not found' }
      }, 404);
    }

    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8'
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/structured/:subsidy_id/:url_hash
 * R2から構造化JSONを取得（壁打ちBot用）
 */
app.get('/structured/:subsidy_id/:url_hash', requireAuth, async (c) => {
  const { subsidy_id, url_hash } = c.req.param();
  const { R2_KNOWLEDGE, DB } = c.env;

  if (!R2_KNOWLEDGE) {
    // R2が無い場合はD1から取得を試みる
    try {
      const doc = await DB.prepare(`
        SELECT structured_json FROM doc_object 
        WHERE subsidy_id = ? AND storage_backend = 'd1_inline'
        LIMIT 1
      `).bind(subsidy_id).first<{ structured_json?: string }>();
      
      if (doc?.structured_json) {
        return c.json(JSON.parse(doc.structured_json));
      }
    } catch {
      // テーブル/カラムが無い場合は無視
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_NOT_CONFIGURED', message: 'R2 storage is not configured' }
    }, 500);
  }

  try {
    const structured = await getStructuredFromR2(R2_KNOWLEDGE, subsidy_id, url_hash);
    
    if (!structured) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Structured JSON not found' }
      }, 404);
    }

    return c.json({
      success: true,
      data: structured
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'R2_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/domains
 * ドメインポリシー一覧を取得（運用監視用）
 */
app.get('/domains', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const domains = await DB.prepare(`
      SELECT 
        domain_key,
        enabled,
        success_count,
        failure_count,
        last_success_at,
        last_failure_at,
        last_error_code,
        notes
      FROM domain_policy
      ORDER BY failure_count DESC, domain_key ASC
    `).all();

    return c.json<ApiResponse<{ domains: unknown[]; count: number }>>({
      success: true,
      data: {
        domains: domains.results || [],
        count: domains.results?.length || 0
      }
    });
  } catch {
    // テーブルが無い場合は空を返す
    return c.json<ApiResponse<{ domains: unknown[]; count: number }>>({
      success: true,
      data: {
        domains: [],
        count: 0
      }
    });
  }
});

/**
 * POST /knowledge/domains/:domain_key/toggle
 * ドメインの有効/無効を切り替え
 */
app.post('/domains/:domain_key/toggle', requireAuth, async (c) => {
  const { domain_key } = c.req.param();
  const { DB } = c.env;

  try {
    const result = await DB.prepare(`
      UPDATE domain_policy 
      SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END,
          updated_at = datetime('now')
      WHERE domain_key = ?
      RETURNING domain_key, enabled
    `).bind(domain_key).first<{ domain_key: string; enabled: number }>();

    if (!result) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Domain policy not found' }
      }, 404);
    }

    return c.json<ApiResponse<{ domain_key: string; enabled: boolean }>>({
      success: true,
      data: {
        domain_key: result.domain_key,
        enabled: result.enabled === 1
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/internal/process-queue
 * クロールキューを処理（Cron Trigger用）
 */
app.post('/internal/process-queue', internalAuthMiddleware(['knowledge:process']), async (c) => {
  const { DB } = c.env;
  const batchSize = 10;
  
  try {
    // pending状態のURLを取得
    const pendingUrls = await DB.prepare(`
      SELECT * FROM source_url 
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).bind(batchSize).all<SourceUrl>();

    if (!pendingUrls.results || pendingUrls.results.length === 0) {
      return c.json<ApiResponse<{ processed: number; message: string }>>({
        success: true,
        data: {
          processed: 0,
          message: 'No pending URLs in queue'
        }
      });
    }

    // TODO: Firecrawlでバッチ処理
    // 現時点ではカウントのみ返す
    
    return c.json<ApiResponse<{ pending_count: number; message: string }>>({
      success: true,
      data: {
        pending_count: pendingUrls.results.length,
        message: 'Queue processing not yet implemented - use /knowledge/crawl/:url_id for manual crawl'
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'QUEUE_ERROR', message: String(error) }
    }, 500);
  }
});

export default app;

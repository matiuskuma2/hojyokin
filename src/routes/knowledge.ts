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
  // K2拡張: 必要書類にdoc_code_guessを追加
  required_documents: Array<{
    name: string;
    required_level: 'mandatory' | 'conditional' | 'optional';
    doc_code_guess?: string;  // マスターへのマッピング用
    format?: string;
    how_to_get?: string;
    link?: string;
    notes?: string;
    source_quote?: string;    // 根拠の引用
  }>;
  // K2拡張: 予算枯渇/早期終了シグナル
  budget_close_signals?: Array<{
    signal: 'budget_cap_reached' | 'quota_reached' | 'first_come_end' | 'early_close';
    quote: string;
    location_hint?: string;
  }>;
  // K2拡張: ステータスヒント
  status_hint?: 'open' | 'closing_soon' | 'closed' | 'unknown';
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

// K2: Lifecycle Status
type LifecycleStatus = 'scheduled' | 'open' | 'closing_soon' | 'closed_by_deadline' | 'closed_by_budget' | 'suspended' | 'unknown';

// K2: Extract プロンプト（Firecrawl/LLM共通）
const EXTRACT_PROMPT = `あなたは補助金・助成金の募集要項ページ/FAQ/記入例から、申請支援システム用の構造化データを抽出します。
以下のルールを厳守して JSON を出力してください。

# 出力形式
- 1つのJSONオブジェクトのみを返す（説明文禁止）
- schema_version は必ず "v1"
- required フィールドが埋まらない場合、quality.needs_human_review=true とし、quality.warnings に理由を書く
- 推測は禁止。根拠が無い項目は空/不明として扱う

# 必須抽出
1) summary: title, one_liner(30-60字), what_it_supports
2) eligibility: who_can_apply, area(scope/detail), industry, company_size, disqualifiers
3) funding: subsidy_rate, limit_amount(max/min), eligible_costs, ineligible_costs
4) deadlines: application_window(start/end), notes（予算上限終了等の注意）
5) required_documents: 
   - name, required_level(mandatory/conditional/optional)
   - doc_code_guess: 以下から選択（gbizid_prime, corp_registry, business_start_notice, financials_2y, wage_ledger, business_plan, revenue_plan, quotes, spec_sheet, tax_certificate, support_institution_letter, security_action, mira_digi_check, partner_declaration）
   - source_quote（根拠の短い引用）
6) budget_close_signals: 予算枯渇/早期終了の検知
   - signal: budget_cap_reached/quota_reached/first_come_end/early_close
   - quote: 短い引用
7) status_hint: open/closing_soon/closed/unknown
8) evidence: 重要項目の引用（funding, deadlines, budget_close等）
9) quality: confidence(0-1), warnings[], needs_human_review`;

// K2: doc_code マッピング（fuzzy match用）
const DOC_CODE_KEYWORDS: Record<string, string[]> = {
  'gbizid_prime': ['gビズid', 'gbizid', 'ジービズ', 'プライム'],
  'jgrants_account': ['jgrants', 'ジェイグランツ', '電子申請'],
  'corp_registry': ['履歴事項', '登記簿', '登記事項証明書', '全部事項'],
  'business_start_notice': ['開業届', '個人事業の開業'],
  'financials_2y': ['決算書', '財務諸表', '貸借対照表', '損益計算書', '直近2期', '直近２期'],
  'financials_1y': ['直近1期', '直近１期', '直近の決算'],
  'wage_ledger': ['賃金台帳', '給与台帳'],
  'employment_contracts': ['雇用契約', '雇用条件', '労働条件通知'],
  'business_plan': ['事業計画', '経営革新計画', '事業計画書'],
  'revenue_plan': ['収支計画', '付加価値', '売上計画', '資金計画'],
  'quotes': ['見積書', '見積り', '相見積'],
  'spec_sheet': ['仕様書', '型番', 'カタログ', '製品仕様'],
  'tax_certificate': ['納税証明', '滞納', '税の滞納がない'],
  'anti_social_check': ['反社', '暴力団', '誓約書'],
  'support_institution_letter': ['認定支援機関', '確認書'],
  'security_action': ['セキュリティアクション', 'security action'],
  'mira_digi_check': ['みらデジ', '経営チェック'],
  'partner_declaration': ['パートナーシップ', '構築宣言']
};

/**
 * 書類名からdoc_codeを推定
 */
function guessDocCode(docName: string): string | null {
  const lowerName = docName.toLowerCase();
  for (const [code, keywords] of Object.entries(DOC_CODE_KEYWORDS)) {
    if (keywords.some(kw => lowerName.includes(kw.toLowerCase()))) {
      return code;
    }
  }
  return null;
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

// K2: 旧 /extract/:url_id はK2実装（下部）に統合済み
// AWS委譲は必要な場合に /api/jobs/subsidies/{subsidy_id}/ingest を使用

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

// =============================================================================
// K2: Lifecycle Management APIs
// =============================================================================

/**
 * GET /knowledge/lifecycle/:subsidy_id
 * 補助金のライフサイクル情報を取得
 */
app.get('/lifecycle/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    const lifecycle = await DB.prepare(`
      SELECT * FROM subsidy_lifecycle WHERE subsidy_id = ?
    `).bind(subsidy_id).first();

    if (!lifecycle) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lifecycle not found for this subsidy' }
      }, 404);
    }

    // 履歴も取得
    const history = await DB.prepare(`
      SELECT * FROM subsidy_status_history 
      WHERE subsidy_id = ? 
      ORDER BY changed_at DESC 
      LIMIT 10
    `).bind(subsidy_id).all();

    return c.json<ApiResponse<{ lifecycle: unknown; history: unknown[] }>>({
      success: true,
      data: {
        lifecycle,
        history: history.results || []
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
 * POST /knowledge/lifecycle/:subsidy_id
 * ライフサイクルを更新または作成
 */
app.post('/lifecycle/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    const body = await c.req.json<{
      status?: LifecycleStatus;
      open_at?: string;
      close_at?: string;
      priority?: number;
      check_frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
      close_reason?: string;
      evidence_url?: string;
      evidence_quote?: string;
    }>();

    // 現在の状態を取得
    const current = await DB.prepare(`
      SELECT status FROM subsidy_lifecycle WHERE subsidy_id = ?
    `).bind(subsidy_id).first<{ status: string }>();

    const prevStatus = current?.status || null;
    const newStatus = body.status || 'unknown';

    // next_check_atを計算
    const nextCheckAt = computeNextCheckAt(newStatus, body.priority || 3);

    // UPSERTでライフサイクルを更新
    await DB.prepare(`
      INSERT INTO subsidy_lifecycle (
        subsidy_id, status, open_at, close_at, close_reason,
        budget_close_evidence_url, budget_close_evidence_quote,
        last_checked_at, next_check_at, check_frequency, priority,
        updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(subsidy_id) DO UPDATE SET
        status = excluded.status,
        open_at = COALESCE(excluded.open_at, open_at),
        close_at = COALESCE(excluded.close_at, close_at),
        close_reason = excluded.close_reason,
        budget_close_evidence_url = excluded.budget_close_evidence_url,
        budget_close_evidence_quote = excluded.budget_close_evidence_quote,
        last_checked_at = datetime('now'),
        next_check_at = excluded.next_check_at,
        check_frequency = excluded.check_frequency,
        priority = excluded.priority,
        updated_at = datetime('now')
    `).bind(
      subsidy_id,
      newStatus,
      body.open_at || null,
      body.close_at || null,
      body.close_reason || null,
      body.evidence_url || null,
      body.evidence_quote || null,
      nextCheckAt,
      body.check_frequency || 'weekly',
      body.priority || 3
    ).run();

    // 状態変化があれば履歴に記録
    if (prevStatus !== newStatus) {
      const historyId = crypto.randomUUID();
      await DB.prepare(`
        INSERT INTO subsidy_status_history (
          id, subsidy_id, prev_status, new_status, reason,
          evidence_url, evidence_quote, changed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'api')
      `).bind(
        historyId,
        subsidy_id,
        prevStatus,
        newStatus,
        body.close_reason || null,
        body.evidence_url || null,
        body.evidence_quote || null
      ).run();
    }

    return c.json<ApiResponse<{ subsidy_id: string; status: string; next_check_at: string }>>({
      success: true,
      data: {
        subsidy_id,
        status: newStatus,
        next_check_at: nextCheckAt
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
 * next_check_at を計算（status × priority）
 */
function computeNextCheckAt(status: string, priority: number): string {
  const now = new Date();
  let hoursToAdd: number;

  switch (status) {
    case 'closing_soon':
      hoursToAdd = 1; // 1時間後
      break;
    case 'open':
      hoursToAdd = priority <= 2 ? 24 : 168; // 優先度高=daily, 低=weekly
      break;
    case 'unknown':
      hoursToAdd = priority <= 2 ? 24 : 168;
      break;
    case 'scheduled':
      hoursToAdd = priority <= 2 ? 168 : 720; // weekly or monthly
      break;
    case 'closed_by_deadline':
    case 'closed_by_budget':
    case 'suspended':
      hoursToAdd = 720; // monthly（次回予告拾い用）
      break;
    default:
      hoursToAdd = 168; // weekly
  }

  now.setHours(now.getHours() + hoursToAdd);
  return now.toISOString();
}

/**
 * GET /knowledge/lifecycle/due
 * チェック期限が来たsubsidyを取得（Cron用）
 */
app.get('/lifecycle/due', requireAuth, async (c) => {
  const { DB } = c.env;
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const due = await DB.prepare(`
      SELECT sl.*, sm.title 
      FROM subsidy_lifecycle sl
      LEFT JOIN subsidy_metadata sm ON sl.subsidy_id = sm.subsidy_id
      WHERE sl.next_check_at IS NULL OR sl.next_check_at <= datetime('now')
      ORDER BY sl.priority ASC, sl.next_check_at ASC
      LIMIT ?
    `).bind(limit).all();

    return c.json<ApiResponse<{ subsidies: unknown[]; count: number }>>({
      success: true,
      data: {
        subsidies: due.results || [],
        count: due.results?.length || 0
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
// K2: Required Documents APIs
// =============================================================================

/**
 * GET /knowledge/documents-master
 * 必要書類マスター一覧を取得
 */
app.get('/documents-master', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const docs = await DB.prepare(`
      SELECT * FROM required_documents_master ORDER BY sort_order, doc_code
    `).all();

    return c.json<ApiResponse<{ documents: unknown[]; count: number }>>({
      success: true,
      data: {
        documents: docs.results || [],
        count: docs.results?.length || 0
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
 * GET /knowledge/documents/:subsidy_id
 * 制度固有の必要書類一覧を取得
 */
app.get('/documents/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    // マスターと制度固有をJOINして取得
    const docs = await DB.prepare(`
      SELECT 
        m.doc_code,
        m.name,
        m.phase,
        m.description,
        COALESCE(s.required_level, m.default_required_level) as required_level,
        s.notes,
        s.source_url,
        s.source_quote,
        s.confidence,
        s.needs_review
      FROM required_documents_master m
      LEFT JOIN required_documents_by_subsidy s 
        ON m.doc_code = s.doc_code AND s.subsidy_id = ?
      ORDER BY m.sort_order, m.doc_code
    `).bind(subsidy_id).all();

    return c.json<ApiResponse<{ subsidy_id: string; documents: unknown[] }>>({
      success: true,
      data: {
        subsidy_id,
        documents: docs.results || []
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
 * POST /knowledge/documents/:subsidy_id
 * 制度の必要書類を更新
 */
app.post('/documents/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    const body = await c.req.json<{
      documents: Array<{
        doc_code: string;
        required_level: 'mandatory' | 'conditional' | 'optional';
        notes?: string;
        source_url?: string;
        source_quote?: string;
        confidence?: number;
      }>;
    }>();

    const results: string[] = [];
    
    for (const doc of body.documents) {
      const id = crypto.randomUUID();
      await DB.prepare(`
        INSERT INTO required_documents_by_subsidy (
          id, subsidy_id, doc_code, required_level, notes,
          source_url, source_quote, confidence, needs_review
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subsidy_id, doc_code) DO UPDATE SET
          required_level = excluded.required_level,
          notes = excluded.notes,
          source_url = excluded.source_url,
          source_quote = excluded.source_quote,
          confidence = excluded.confidence,
          needs_review = excluded.needs_review,
          updated_at = datetime('now')
      `).bind(
        id,
        subsidy_id,
        doc.doc_code,
        doc.required_level,
        doc.notes || null,
        doc.source_url || null,
        doc.source_quote || null,
        doc.confidence || 0.5,
        (doc.confidence || 0.5) < 0.7 ? 1 : 0  // 確信度低いとneeds_review
      ).run();
      
      results.push(doc.doc_code);
    }

    return c.json<ApiResponse<{ subsidy_id: string; updated: string[] }>>({
      success: true,
      data: {
        subsidy_id,
        updated: results
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
// K2: Extract API (Firecrawl Extract → Structured JSON)
// =============================================================================

/**
 * POST /knowledge/extract/:url_id
 * クロール済みのMarkdownから構造化JSONを抽出
 */
app.post('/extract/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB, R2_KNOWLEDGE, FIRECRAWL_API_KEY } = c.env;

  if (!FIRECRAWL_API_KEY) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'FIRECRAWL_API_KEY not configured' }
    }, 500);
  }

  try {
    // source_url情報取得
    const sourceUrl = await DB.prepare(`
      SELECT su.*, do.r2_key_raw, do.word_count
      FROM source_url su
      LEFT JOIN doc_object do ON su.url_id = do.url_id
      WHERE su.url_id = ?
    `).bind(url_id).first<SourceUrl & { r2_key_raw?: string; word_count?: number }>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    if (sourceUrl.status !== 'ok') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_CRAWLED', message: 'URL has not been crawled yet. Use /crawl/:url_id first.' }
      }, 400);
    }

    // R2からMarkdownを取得
    let markdown: string | null = null;
    if (R2_KNOWLEDGE && sourceUrl.r2_key_raw) {
      const obj = await R2_KNOWLEDGE.get(sourceUrl.r2_key_raw);
      if (obj) {
        markdown = await obj.text();
      }
    }

    if (!markdown || markdown.length < 100) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NO_CONTENT', message: 'No markdown content available or content too short' }
      }, 400);
    }

    // Firecrawl Extractを使用（または直接LLM呼び出し）
    // Note: Firecrawl Extractが使えない場合はOpenAI APIを直接呼ぶ
    const extractResult = await callFirecrawlExtract(
      sourceUrl.url,
      markdown,
      FIRECRAWL_API_KEY
    );

    if (!extractResult.success) {
      // Extract失敗時
      await DB.prepare(`
        UPDATE source_url SET status = 'needs_review', updated_at = datetime('now')
        WHERE url_id = ?
      `).bind(url_id).run();

      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'EXTRACT_ERROR', message: extractResult.error || 'Extraction failed' }
      }, 500);
    }

    const structured = extractResult.data as ExtractSchemaV1;

    // 必須フィールドチェック
    const warnings: string[] = [];
    let needsReview = false;

    if (!structured.summary?.title) {
      warnings.push('タイトルが抽出できませんでした');
      needsReview = true;
    }
    if (!structured.funding?.subsidy_rate) {
      warnings.push('補助率が抽出できませんでした');
    }
    if (!structured.required_documents || structured.required_documents.length < 3) {
      warnings.push('必要書類が十分に抽出できませんでした');
      needsReview = true;
    }

    structured.quality = structured.quality || { confidence: 0.5, warnings: [], needs_human_review: false };
    structured.quality.warnings = [...(structured.quality.warnings || []), ...warnings];
    structured.quality.needs_human_review = structured.quality.needs_human_review || needsReview;

    // R2に保存
    const urlHash = await sha256Short(sourceUrl.url);
    let r2StructuredResult: R2SaveResult | null = null;

    if (R2_KNOWLEDGE) {
      try {
        r2StructuredResult = await saveStructuredToR2(
          R2_KNOWLEDGE,
          sourceUrl.subsidy_id,
          urlHash,
          structured
        );
      } catch (r2Error) {
        console.error('R2 save error for structured:', r2Error);
      }
    }

    // doc_objectを更新
    await DB.prepare(`
      UPDATE doc_object SET
        r2_key_structured = ?,
        r2_structured_size = ?,
        needs_review = ?,
        confidence = ?,
        updated_at = datetime('now')
      WHERE url_id = ?
    `).bind(
      r2StructuredResult?.key || null,
      r2StructuredResult?.size || null,
      needsReview ? 1 : 0,
      structured.quality?.confidence || 0.5,
      url_id
    ).run();

    // 必要書類をrequired_documents_by_subsidyに反映
    if (structured.required_documents && structured.required_documents.length > 0) {
      for (const doc of structured.required_documents) {
        const docCode = doc.doc_code_guess || guessDocCode(doc.name);
        if (docCode) {
          const docId = crypto.randomUUID();
          await DB.prepare(`
            INSERT INTO required_documents_by_subsidy (
              id, subsidy_id, doc_code, required_level, notes,
              source_url, source_quote, confidence, needs_review
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(subsidy_id, doc_code) DO UPDATE SET
              required_level = excluded.required_level,
              notes = COALESCE(excluded.notes, notes),
              source_quote = COALESCE(excluded.source_quote, source_quote),
              confidence = CASE WHEN excluded.confidence > confidence THEN excluded.confidence ELSE confidence END,
              updated_at = datetime('now')
          `).bind(
            docId,
            sourceUrl.subsidy_id,
            docCode,
            doc.required_level || 'conditional',
            doc.notes || null,
            sourceUrl.url,
            doc.source_quote || null,
            0.6,  // 自動抽出の基本確信度
            1     // 要レビュー
          ).run();
        }
      }
    }

    // budget_close_signalsがあればlifecycleを更新
    if (structured.budget_close_signals && structured.budget_close_signals.length > 0) {
      const signal = structured.budget_close_signals[0];
      const newStatus = signal.signal === 'budget_cap_reached' || signal.signal === 'quota_reached' 
        ? 'closed_by_budget' 
        : (signal.signal === 'early_close' ? 'closed_by_budget' : 'closing_soon');

      await DB.prepare(`
        INSERT INTO subsidy_lifecycle (
          subsidy_id, status, close_reason, budget_close_evidence_url,
          budget_close_evidence_quote, last_checked_at, next_check_at,
          check_frequency, priority, updated_at, created_at
        ) VALUES (?, ?, 'budget', ?, ?, datetime('now'), ?, 'daily', 2, datetime('now'), datetime('now'))
        ON CONFLICT(subsidy_id) DO UPDATE SET
          status = CASE WHEN excluded.status IN ('closed_by_budget', 'closing_soon') THEN excluded.status ELSE status END,
          close_reason = CASE WHEN excluded.status IN ('closed_by_budget') THEN 'budget' ELSE close_reason END,
          budget_close_evidence_url = excluded.budget_close_evidence_url,
          budget_close_evidence_quote = excluded.budget_close_evidence_quote,
          last_checked_at = datetime('now'),
          updated_at = datetime('now')
      `).bind(
        sourceUrl.subsidy_id,
        newStatus,
        sourceUrl.url,
        signal.quote,
        computeNextCheckAt(newStatus, 2)
      ).run();
    }

    return c.json<ApiResponse<{
      url_id: string;
      subsidy_id: string;
      structured_key: string | null;
      quality: { confidence: number; warnings: string[]; needs_review: boolean };
      documents_extracted: number;
      budget_signals: number;
    }>>({
      success: true,
      data: {
        url_id,
        subsidy_id: sourceUrl.subsidy_id,
        structured_key: r2StructuredResult?.key || null,
        quality: {
          confidence: structured.quality?.confidence || 0.5,
          warnings: structured.quality?.warnings || [],
          needs_review: needsReview
        },
        documents_extracted: structured.required_documents?.length || 0,
        budget_signals: structured.budget_close_signals?.length || 0
      }
    });
  } catch (error) {
    console.error('Extract error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'EXTRACT_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * Firecrawl Extract API呼び出し（または代替LLM呼び出し）
 */
async function callFirecrawlExtract(
  url: string,
  markdown: string,
  apiKey: string
): Promise<{ success: boolean; data?: ExtractSchemaV1; error?: string }> {
  try {
    // Firecrawl Extract API v2を呼び出し
    // v2では url → urls (配列) に変更、エンドポイントも /v2/extract
    
    const response = await fetch('https://api.firecrawl.dev/v2/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        urls: [url], // v2は配列で指定
        prompt: EXTRACT_PROMPT,
        schema: {
          type: 'object',
          properties: {
            schema_version: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '補助金/制度のタイトル' },
                one_liner: { type: 'string', description: '30-60字の概要説明' },
                what_it_supports: { type: 'string', description: '何を支援するのか' }
              },
              required: ['title']
            },
            eligibility: {
              type: 'object',
              properties: {
                who_can_apply: { type: 'array', items: { type: 'string' }, description: '申請可能な対象者' },
                area: { type: 'object', properties: { scope: { type: 'string' }, detail: { type: 'string' } } },
                industry: { type: 'object', properties: { allowed: { type: 'array', items: { type: 'string' } } } },
                company_size: { type: 'object', properties: { employee_limit: { type: 'string' } } },
                disqualifiers: { type: 'array', items: { type: 'string' }, description: '不適格条件' }
              }
            },
            funding: {
              type: 'object',
              properties: {
                subsidy_rate: { type: 'string', description: '補助率（例: 1/2, 2/3）' },
                limit_amount: { type: 'object', properties: { max: { type: 'string' }, min: { type: 'string' } } },
                eligible_costs: { type: 'array', items: { type: 'string' }, description: '対象経費' },
                ineligible_costs: { type: 'array', items: { type: 'string' }, description: '対象外経費' }
              }
            },
            deadlines: {
              type: 'object',
              properties: {
                application_window: {
                  type: 'object',
                  properties: { start: { type: 'string' }, end: { type: 'string' } }
                },
                notes: { type: 'string', description: '締切に関する注意事項' }
              }
            },
            required_documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  required_level: { type: 'string', enum: ['mandatory', 'conditional', 'optional'] },
                  doc_code_guess: { type: 'string' },
                  source_quote: { type: 'string' }
                },
                required: ['name']
              },
              description: '必要書類リスト'
            },
            budget_close_signals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  signal: { type: 'string', enum: ['budget_cap_reached', 'quota_reached', 'first_come_end', 'early_close'] },
                  quote: { type: 'string' }
                }
              },
              description: '予算枯渇/早期終了シグナル'
            },
            status_hint: { type: 'string', enum: ['open', 'closing_soon', 'closed', 'unknown'] },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  quote: { type: 'string' },
                  source_section: { type: 'string' }
                }
              },
              description: '抽出根拠の引用'
            },
            quality: {
              type: 'object',
              properties: {
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                warnings: { type: 'array', items: { type: 'string' } },
                needs_human_review: { type: 'boolean' }
              }
            }
          },
          required: ['summary']
        },
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 30000
        },
        showSources: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl Extract API v2 error:', response.status, errorText);
      
      // Firecrawl Extractが失敗した場合、簡易パースにフォールバック
      return createFallbackExtract(url, markdown);
    }

    const result = await response.json() as { 
      success: boolean; 
      data?: ExtractSchemaV1 | Record<string, unknown>; 
      error?: string;
      sources?: string[];
    };
    
    console.log('Firecrawl Extract v2 initial response:', JSON.stringify(result).substring(0, 500));
    
    // v2 Extract は非同期 - id が返ってきたらポーリングで結果取得
    if (result.success && result.id) {
      // ポーリングで結果取得（最大60秒）
      const extractedData = await pollFirecrawlExtract(result.id, apiKey);
      if (extractedData) {
        return normalizeExtractedData(url, extractedData);
      }
      // ポーリング失敗時はフォールバック
      return createFallbackExtract(url, markdown);
    }
    
    // 直接データが返ってきた場合（同期レスポンス）
    if (result.success && result.data) {
      return normalizeExtractedData(url, result.data);
    }

    // 失敗時はフォールバック
    return createFallbackExtract(url, markdown);
  } catch (error) {
    console.error('Firecrawl Extract v2 call error:', error);
    return createFallbackExtract(url, markdown);
  }
}

/**
 * Firecrawl Extract v2 ポーリング（非同期ジョブ結果取得）
 */
async function pollFirecrawlExtract(
  jobId: string,
  apiKey: string,
  maxWaitMs: number = 60000,
  intervalMs: number = 3000
): Promise<ExtractSchemaV1 | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`https://api.firecrawl.dev/v2/extract/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        console.error('Firecrawl poll error:', response.status);
        return null;
      }
      
      const result = await response.json() as {
        success: boolean;
        status?: string;
        data?: ExtractSchemaV1 | Record<string, unknown>;
        error?: string;
      };
      
      console.log('Firecrawl poll status:', result.status, 'elapsed:', Date.now() - startTime, 'ms');
      
      if (result.status === 'completed' && result.data) {
        return result.data as ExtractSchemaV1;
      }
      
      if (result.status === 'failed' || result.status === 'cancelled') {
        console.error('Firecrawl job failed:', result.error);
        return null;
      }
      
      // processing中は待機
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error('Firecrawl poll exception:', error);
      return null;
    }
  }
  
  console.warn('Firecrawl poll timeout after', maxWaitMs, 'ms');
  return null;
}

/**
 * 抽出データの正規化
 */
function normalizeExtractedData(
  url: string,
  rawData: ExtractSchemaV1 | Record<string, unknown>
): { success: boolean; data: ExtractSchemaV1 } {
  const extracted = rawData as ExtractSchemaV1;
  extracted.schema_version = 'v1';
  extracted.source = extracted.source || {
    url,
    retrieved_at: new Date().toISOString(),
    source_type: 'other'
  };
  
  // quality フィールドの確保
  if (!extracted.quality) {
    extracted.quality = {
      confidence: 0.7,
      warnings: [],
      needs_human_review: false
    };
  }
  
  // 重要項目の検証
  const warnings: string[] = extracted.quality.warnings || [];
  
  if (!extracted.funding?.subsidy_rate) {
    warnings.push('補助率が抽出できませんでした');
  }
  if (!extracted.required_documents || extracted.required_documents.length === 0) {
    warnings.push('必要書類が抽出できませんでした');
  }
  if (!extracted.deadlines?.application_window?.end) {
    warnings.push('申請締切が抽出できませんでした');
  }
  
  extracted.quality.warnings = warnings;
  extracted.quality.needs_human_review = warnings.length > 0 || (extracted.quality.confidence || 0) < 0.6;
  
  return { success: true, data: extracted };
}

/**
 * フォールバック: 簡易パースで最低限の構造を作成
 * markdownから可能な限りの情報を抽出
 */
function createFallbackExtract(url: string, markdown: string): { success: boolean; data: ExtractSchemaV1 } {
  const warnings: string[] = ['フォールバックパースを使用'];
  
  // タイトル抽出（最初のH1またはH2）
  const titleMatch = markdown.match(/^#+ (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'タイトル不明';

  // 補助率抽出
  let subsidyRate = '';
  const ratePatterns = [
    /補助率[：:\s]*([0-9\/]+)/,
    /([0-9]+\/[0-9]+)[以内\s]*補助/,
    /([0-9]+)%[以内\s]*補助/,
    /補助[率割].*?([0-9]+\/[0-9]+|[0-9]+%)/
  ];
  for (const pattern of ratePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      subsidyRate = match[1];
      break;
    }
  }
  if (!subsidyRate) warnings.push('補助率が抽出できませんでした');

  // 補助上限額抽出
  let maxAmount = '';
  const amountPatterns = [
    /上限[：:\s]*([0-9,，]+)万?円/,
    /最大[：:\s]*([0-9,，]+)万?円/,
    /([0-9,，]+)万?円[以内\s]*を上限/,
    /補助金額.*?([0-9,，]+)万?円/
  ];
  for (const pattern of amountPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      maxAmount = match[1].replace(/[,，]/g, '') + '円';
      break;
    }
  }

  // 申請期限抽出
  let deadline = '';
  const deadlinePatterns = [
    /申請[締期]限[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/,
    /([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)[まで\s]*[締申]/,
    /締切.*?([0-9]{4}[年\/\-][0-9]{1,2}[月\/\-][0-9]{1,2}日?)/,
    /([0-9]{1,2}月[0-9]{1,2}日)[まで\s]*に申請/
  ];
  for (const pattern of deadlinePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      deadline = match[1];
      break;
    }
  }
  if (!deadline) warnings.push('申請締切が抽出できませんでした');

  // 必要書類抽出
  const requiredDocs: ExtractSchemaV1['required_documents'] = [];
  const docPatterns = [
    { regex: /申請書|様式[0-9０-９]+/g, name: '申請書' },
    { regex: /事業計画書/g, name: '事業計画書' },
    { regex: /見積書/g, name: '見積書' },
    { regex: /登記簿[謄抄]本|履歴事項全部証明書/g, name: '登記事項証明書' },
    { regex: /決算書|財務諸表/g, name: '決算書' },
    { regex: /納税証明書/g, name: '納税証明書' },
    { regex: /確定申告書/g, name: '確定申告書' },
    { regex: /gビズ|GビズID|gbizid/gi, name: 'GビズIDアカウント' }
  ];
  
  const foundDocs = new Set<string>();
  for (const { regex, name } of docPatterns) {
    if (regex.test(markdown) && !foundDocs.has(name)) {
      foundDocs.add(name);
      requiredDocs.push({
        name,
        required_level: 'mandatory' as const,
        doc_code_guess: guessDocCode(name) || undefined,
        source_quote: ''
      });
    }
  }
  if (requiredDocs.length === 0) warnings.push('必要書類が抽出できませんでした');

  // 予算枯渇シグナル検知
  const budgetSignals: ExtractSchemaV1['budget_close_signals'] = [];
  const budgetPatterns = [
    { pattern: /予算上限に達し次第.{0,20}終了/g, signal: 'budget_cap_reached' as const },
    { pattern: /予算がなくなり次第.{0,20}終了/g, signal: 'budget_cap_reached' as const },
    { pattern: /予算の範囲内.{0,20}先着順/g, signal: 'first_come_end' as const },
    { pattern: /先着順/g, signal: 'first_come_end' as const },
    { pattern: /予定件数に達し/g, signal: 'quota_reached' as const },
    { pattern: /早期終了/g, signal: 'early_close' as const }
  ];

  for (const { pattern, signal } of budgetPatterns) {
    const matches = markdown.match(pattern);
    if (matches) {
      budgetSignals.push({
        signal,
        quote: matches[0].substring(0, 80)
      });
    }
  }

  // 対象者抽出
  const whoCanApply: string[] = [];
  const eligibilityPatterns = [
    /対象[者事業]?[：:\s]*(中小企業|小規模事業者|個人事業主|法人)/g,
    /(中小企業|小規模事業者|個人事業主)[等がの]/g
  ];
  for (const pattern of eligibilityPatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !whoCanApply.includes(match[1])) {
        whoCanApply.push(match[1]);
      }
    }
  }

  const confidence = 0.3 + 
    (subsidyRate ? 0.15 : 0) + 
    (deadline ? 0.15 : 0) + 
    (requiredDocs.length > 0 ? 0.1 : 0) +
    (whoCanApply.length > 0 ? 0.1 : 0);

  return {
    success: true,
    data: {
      schema_version: 'v1',
      source: {
        url,
        retrieved_at: new Date().toISOString(),
        source_type: 'other'
      },
      summary: {
        title,
        one_liner: '',
        what_it_supports: ''
      },
      eligibility: {
        who_can_apply: whoCanApply,
        area: { scope: '' },
        industry: { allowed: [] },
        company_size: { employee_limit: '' }
      },
      funding: {
        subsidy_rate: subsidyRate,
        limit_amount: { max: maxAmount },
        eligible_costs: []
      },
      deadlines: {
        application_window: deadline ? { end: deadline } : {}
      },
      required_documents: requiredDocs,
      budget_close_signals: budgetSignals,
      status_hint: 'unknown',
      quality: {
        confidence: Math.min(confidence, 0.7),
        warnings,
        needs_human_review: true
      }
    }
  };
}

// =============================================================================
// K2: Source Registry APIs
// =============================================================================

/**
 * GET /knowledge/registry
 * クロール対象台帳を取得
 */
app.get('/registry', requireAuth, async (c) => {
  const { DB } = c.env;
  const scope = c.req.query('scope');
  const enabled = c.req.query('enabled');

  try {
    let query = `SELECT * FROM source_registry WHERE 1=1`;
    const params: (string | number)[] = [];

    if (scope) {
      query += ` AND scope = ?`;
      params.push(scope);
    }
    if (enabled !== undefined) {
      query += ` AND enabled = ?`;
      params.push(enabled === 'true' ? 1 : 0);
    }

    query += ` ORDER BY priority ASC, scope, program_key`;

    const stmt = DB.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const registry = await bound.all();

    return c.json<ApiResponse<{ entries: unknown[]; count: number }>>({
      success: true,
      data: {
        entries: registry.results || [],
        count: registry.results?.length || 0
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
 * GET /knowledge/registry/due
 * クロール期限が来た台帳エントリを取得
 */
app.get('/registry/due', requireAuth, async (c) => {
  const { DB } = c.env;
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const due = await DB.prepare(`
      SELECT sr.*, dp.enabled as domain_enabled
      FROM source_registry sr
      LEFT JOIN domain_policy dp ON sr.domain_key = dp.domain_key
      WHERE sr.enabled = 1
        AND (dp.enabled IS NULL OR dp.enabled = 1)
        AND (sr.next_crawl_at IS NULL OR sr.next_crawl_at <= datetime('now'))
      ORDER BY sr.priority ASC, sr.next_crawl_at ASC
      LIMIT ?
    `).bind(limit).all();

    return c.json<ApiResponse<{ entries: unknown[]; count: number }>>({
      success: true,
      data: {
        entries: due.results || [],
        count: due.results?.length || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

export default app;

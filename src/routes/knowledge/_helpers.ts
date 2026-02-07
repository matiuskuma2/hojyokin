/**
 * Knowledge Pipeline - 共通ヘルパー
 * 
 * ハッシュ生成、R2操作、型定義
 */

import type { Env, Variables, ApiResponse } from '../../types';

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


// Re-export types for sub-modules
export {
  sha256Hex,
  sha256Short,
  safeHashSync,
  saveRawToR2,
  getRawFromR2,
  saveStructuredToR2,
  getStructuredFromR2,
  extractDomainKey,
};
export type { R2SaveResult, ExtractSchemaV1 };

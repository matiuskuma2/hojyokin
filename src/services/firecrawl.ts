/**
 * Firecrawl API クライアント
 * 
 * 機能:
 * - Webページのスクレイピング（scrape）
 * - サイト全体のクロール（crawl）
 * - PDF/添付ファイルの取得
 * - 差分検知用のハッシュ計算
 */

// Note: Cloudflare WorkersではNode.js cryptoが使えないため、Web Crypto APIを使用

// =============================================================================
// 型定義
// =============================================================================

export interface FirecrawlConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

export interface CrawlOptions {
  limit?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  ignoreSitemap?: boolean;
  scrapeOptions?: ScrapeOptions;
}

export interface CrawlResult {
  success: boolean;
  id?: string;
  status?: 'scraping' | 'completed' | 'failed';
  total?: number;
  completed?: number;
  data?: ScrapeResult['data'][];
  error?: string;
}

export interface ExtractedSubsidy {
  id: string;
  title: string;
  sourceUrl: string;
  detailUrl?: string;
  status: 'open' | 'closed' | 'upcoming' | 'unknown';
  maxAmount?: number;
  subsidyRate?: string;
  deadline?: string;
  description?: string;
  eligibility?: string;
  targetAreas?: string[];
  categories?: string[];
  issuerName?: string;
  pdfUrls?: string[];
  rawHtml?: string;
  contentHash?: string;
  extractedAt: string;
}

// =============================================================================
// Firecrawl クライアント
// =============================================================================

export class FirecrawlClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: FirecrawlConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.firecrawl.dev/v1';
  }

  /**
   * 単一ページをスクレイプ
   */
  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: options.formats || ['markdown', 'html', 'links'],
          onlyMainContent: options.onlyMainContent ?? true,
          includeTags: options.includeTags,
          excludeTags: options.excludeTags,
          waitFor: options.waitFor,
          timeout: options.timeout || 30000,
          headers: options.headers,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * サイトをクロール（非同期ジョブ）
   */
  async startCrawl(url: string, options: CrawlOptions = {}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          limit: options.limit || 100,
          maxDepth: options.maxDepth || 2,
          includePaths: options.includePaths,
          excludePaths: options.excludePaths,
          allowBackwardLinks: options.allowBackwardLinks ?? false,
          allowExternalLinks: options.allowExternalLinks ?? false,
          ignoreSitemap: options.ignoreSitemap ?? true,
          scrapeOptions: options.scrapeOptions || {
            formats: ['markdown', 'html', 'links'],
            onlyMainContent: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      return { success: true, id: result.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * クロールジョブのステータス確認
   */
  async getCrawlStatus(crawlId: string): Promise<CrawlResult> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl/${crawlId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      return {
        success: true,
        id: crawlId,
        status: result.status,
        total: result.total,
        completed: result.completed,
        data: result.data,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// =============================================================================
// 東京都中小企業振興公社 専用パーサー
// =============================================================================

/**
 * 東京都中小企業振興公社の助成金一覧をパース
 */
export function parseTokyoKoshaList(html: string, baseUrl: string = 'https://www.tokyo-kosha.or.jp'): ExtractedSubsidy[] {
  const subsidies: ExtractedSubsidy[] = [];
  
  // 各助成金カード（aタグ）を抽出
  // パターン: <a href="/support/josei/jigyo/xxx.html" ...>
  const cardPattern = /<a[^>]*href="(\/support\/josei\/[^"]+)"[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const detailPath = match[1];
    const cardContent = match[2];
    
    // タイトル抽出
    const titleMatch = cardContent.match(/(?:令和[0-9０-９]+年度[^<]*)?([^<]+助成[^<]*事業|[^<]+支援事業)/i);
    const title = titleMatch ? titleMatch[0].trim() : '';
    
    if (!title) continue;
    
    // ステータス抽出
    let status: ExtractedSubsidy['status'] = 'unknown';
    if (cardContent.includes('募集中')) status = 'open';
    else if (cardContent.includes('受付終了')) status = 'closed';
    else if (cardContent.includes('募集準備中') || cardContent.includes('近日公開')) status = 'upcoming';
    
    // 助成限度額抽出
    const amountMatch = cardContent.match(/助成限度額[（(]?([^）)]+)[）)]?([0-9,，]+)万円/);
    const maxAmount = amountMatch ? parseInt(amountMatch[2].replace(/[,，]/g, '')) * 10000 : undefined;
    
    // 助成率抽出
    const rateMatch = cardContent.match(/助成率[（(]?([^）)]+)[）)]?([0-9/／]+)以内/);
    const subsidyRate = rateMatch ? rateMatch[2].replace('／', '/') : undefined;
    
    // 対象者抽出
    const targetMatch = cardContent.match(/中小企業者|個人事業主|創業予定者|中小企業団体等|中小企業グループ|NPO/g);
    const categories = targetMatch ? [...new Set(targetMatch)] : [];
    
    const id = `tokyo-kosha-${detailPath.split('/').pop()?.replace('.html', '')}`;
    
    subsidies.push({
      id,
      title: title.replace(/\s+/g, ' ').trim(),
      sourceUrl: `${baseUrl}/support/josei/index.html`,
      detailUrl: `${baseUrl}${detailPath}`,
      status,
      maxAmount,
      subsidyRate,
      categories,
      issuerName: '東京都中小企業振興公社',
      targetAreas: ['東京都'],
      extractedAt: new Date().toISOString(),
    });
  }
  
  return subsidies;
}

/**
 * コンテンツハッシュを計算（差分検知用）
 * Web Crypto API を使用（Cloudflare Workers対応）
 */
export async function calculateContentHash(content: string): Promise<string> {
  // HTMLタグを除去し、空白を正規化してからハッシュ化
  const normalized = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  // Web Crypto API を使用してSHA-256ハッシュを計算
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 先頭16文字を返す
  return hashHex.substring(0, 16);
}

/**
 * 2つのSubsidy間の差分を検出
 */
export function detectChanges(
  oldSubsidy: ExtractedSubsidy | null,
  newSubsidy: ExtractedSubsidy
): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];
  
  if (!oldSubsidy) {
    return { hasChanges: true, changes: ['新規追加'] };
  }
  
  if (oldSubsidy.status !== newSubsidy.status) {
    changes.push(`ステータス: ${oldSubsidy.status} → ${newSubsidy.status}`);
  }
  if (oldSubsidy.maxAmount !== newSubsidy.maxAmount) {
    changes.push(`助成限度額: ${oldSubsidy.maxAmount || '未設定'} → ${newSubsidy.maxAmount || '未設定'}`);
  }
  if (oldSubsidy.subsidyRate !== newSubsidy.subsidyRate) {
    changes.push(`助成率: ${oldSubsidy.subsidyRate || '未設定'} → ${newSubsidy.subsidyRate || '未設定'}`);
  }
  if (oldSubsidy.deadline !== newSubsidy.deadline) {
    changes.push(`締切: ${oldSubsidy.deadline || '未設定'} → ${newSubsidy.deadline || '未設定'}`);
  }
  if (oldSubsidy.contentHash !== newSubsidy.contentHash) {
    changes.push('ページ内容が更新されました');
  }
  
  return { hasChanges: changes.length > 0, changes };
}

// =============================================================================
// フォールバック: fetch ベースのシンプルなスクレイパー
// =============================================================================

/**
 * Firecrawl APIを使わないシンプルなスクレイピング
 * （開発・テスト用、またはFirecrawl APIキーがない場合のフォールバック）
 */
export async function simpleScrape(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * PDFリンクを抽出
 */
export function extractPdfLinks(html: string, baseUrl: string): string[] {
  const pdfPattern = /<a[^>]*href="([^"]*\.pdf)"[^>]*>/gi;
  const links: string[] = [];
  
  let match;
  while ((match = pdfPattern.exec(html)) !== null) {
    let pdfUrl = match[1];
    
    // 相対URLを絶対URLに変換
    if (pdfUrl.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      pdfUrl = `${urlObj.protocol}//${urlObj.host}${pdfUrl}`;
    } else if (!pdfUrl.startsWith('http')) {
      pdfUrl = new URL(pdfUrl, baseUrl).toString();
    }
    
    if (!links.includes(pdfUrl)) {
      links.push(pdfUrl);
    }
  }
  
  return links;
}

// =============================================================================
// P3-1B: PDF から required_forms（様式名 + 記載項目）を抽出
// =============================================================================

export interface RequiredForm {
  name: string;           // 様式名 例: "様式第1号", "別紙1"
  form_id?: string;       // 様式ID（あれば）
  fields: string[];       // 記載項目 例: ["企業概要", "事業計画", "経費明細"]
  source_page?: number;   // 抽出元ページ番号
  notes?: string;         // 注記
}

/**
 * テキストから required_forms（様式名 + 記載項目）を抽出
 * 
 * P3-1B 仕様:
 * - 様式名パターン: 様式第○号, 様式○, 別紙○, 第○号様式 等
 * - 記載項目パターン: ○○欄, ○○を記入, ○○について記載 等
 * - 抽出できない場合は空配列を返す
 */
export function extractRequiredForms(text: string): RequiredForm[] {
  const forms: RequiredForm[] = [];
  
  if (!text || text.length < 50) {
    return forms;
  }
  
  // 様式名パターン
  const formPatterns = [
    /(?:様式[第]?[\s]*([0-9０-９一二三四五六七八九十]+)[号]?(?:[-－]([0-9０-９]+))?)/gi,
    /(?:別紙[\s]*([0-9０-９一二三四五六七八九十]+))/gi,
    /(?:第[\s]*([0-9０-９一二三四五六七八九十]+)[号]?[\s]*様式)/gi,
    /(?:申請書[\s]*(?:様式)?)/gi,
    /(?:計画書[\s]*(?:様式)?)/gi,
    /(?:報告書[\s]*(?:様式)?)/gi,
  ];
  
  const seenFormNames = new Set<string>();
  
  for (const pattern of formPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let formName = match[0].trim();
      
      // 正規化
      formName = formName
        .replace(/[\s　]+/g, '')
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30)); // 全角→半角
      
      if (seenFormNames.has(formName)) continue;
      seenFormNames.add(formName);
      
      // 周辺テキストから記載項目を抽出
      const contextStart = Math.max(0, match.index - 500);
      const contextEnd = Math.min(text.length, match.index + 500);
      const context = text.substring(contextStart, contextEnd);
      
      const fields = extractFieldsFromContext(context);
      
      forms.push({
        name: formName,
        form_id: formName,
        fields,
        notes: fields.length > 0 ? undefined : '記載項目の自動抽出に失敗。公式様式を確認してください。',
      });
    }
  }
  
  return forms;
}

/**
 * コンテキストから記載項目を抽出
 */
function extractFieldsFromContext(context: string): string[] {
  const fields: string[] = [];
  
  // 記載項目パターン
  const fieldPatterns = [
    /(?:([^\s\n]{2,20})[\s]*(?:欄|を記入|について記載|の概要|の内容|の計画))/gi,
    /(?:【([^\s【】]{2,20})】)/gi,
    /(?:^[\s]*[0-9０-９一二三四五六七八九十]+[\.．)）][\s]*([^\n]{2,30}))/gim,
    /(?:・[\s]*([^\n]{2,30}))/gi,
  ];
  
  const seenFields = new Set<string>();
  
  for (const pattern of fieldPatterns) {
    let match;
    while ((match = pattern.exec(context)) !== null) {
      const field = (match[1] || match[0]).trim();
      
      // フィルタリング
      if (field.length < 2 || field.length > 30) continue;
      if (/[0-9０-９]{4,}/.test(field)) continue; // 電話番号等を除外
      if (/^(http|www|\.pdf|\.docx?)/.test(field)) continue; // URL等を除外
      if (seenFields.has(field)) continue;
      
      seenFields.add(field);
      fields.push(field);
      
      // 最大10項目
      if (fields.length >= 10) break;
    }
    if (fields.length >= 10) break;
  }
  
  return fields;
}

/**
 * detail_json に required_forms をマージ
 * 既存の required_forms がある場合は上書きしない（手動データ優先）
 */
export function mergeRequiredForms(
  existingJson: Record<string, any>,
  extractedForms: RequiredForm[]
): Record<string, any> {
  const result = { ...existingJson };
  
  // 既存の required_forms があれば手動データ優先でスキップ
  if (result.required_forms && Array.isArray(result.required_forms) && result.required_forms.length > 0) {
    // 既存データが "手動" フラグを持つか、fields が充実していれば上書きしない
    const hasManualData = result.required_forms.some((f: any) => 
      f.fields && f.fields.length > 2 || f.manual === true
    );
    if (hasManualData) {
      return result;
    }
  }
  
  if (extractedForms.length > 0) {
    result.required_forms = extractedForms;
    result.required_forms_extracted_at = new Date().toISOString();
    result.required_forms_source = 'auto';
  }
  
  return result;
}

/**
 * WALL_CHAT_READY 判定 v2（凍結仕様）
 * 
 * 必須5項目すべてが揃えば true:
 * 1. overview または description（20文字以上）
 * 2. application_requirements（非空）
 * 3. eligible_expenses（非空）
 * 4. required_documents（非空）
 * 5. deadline または acceptance_end_datetime
 */
export function isWallChatReady(detailJson: Record<string, any>): {
  ready: boolean;
  missing: string[];
  score: number;
  maxScore: number;
} {
  const missing: string[] = [];
  let score = 0;
  const maxScore = 5;
  
  // 1. overview or description
  const hasOverview = detailJson.overview && detailJson.overview.length >= 20;
  const hasDescription = detailJson.description && detailJson.description.length >= 20;
  if (hasOverview || hasDescription) {
    score++;
  } else {
    missing.push('overview/description');
  }
  
  // 2. application_requirements
  const hasAppReq = Array.isArray(detailJson.application_requirements)
    ? detailJson.application_requirements.length > 0
    : detailJson.application_requirements && String(detailJson.application_requirements).length > 0;
  if (hasAppReq) {
    score++;
  } else {
    missing.push('application_requirements');
  }
  
  // 3. eligible_expenses
  const hasExpenses = Array.isArray(detailJson.eligible_expenses)
    ? detailJson.eligible_expenses.length > 0
    : detailJson.eligible_expenses && String(detailJson.eligible_expenses).length > 0;
  if (hasExpenses) {
    score++;
  } else {
    missing.push('eligible_expenses');
  }
  
  // 4. required_documents
  const hasDocs = Array.isArray(detailJson.required_documents)
    ? detailJson.required_documents.length > 0
    : detailJson.required_documents && String(detailJson.required_documents).length > 0;
  if (hasDocs) {
    score++;
  } else {
    missing.push('required_documents');
  }
  
  // 5. deadline
  const hasDeadline = detailJson.deadline || detailJson.acceptance_end_datetime;
  if (hasDeadline) {
    score++;
  } else {
    missing.push('deadline');
  }
  
  return {
    ready: score === maxScore,
    missing,
    score,
    maxScore,
  };
}

export default FirecrawlClient;

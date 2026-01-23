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

export default FirecrawlClient;

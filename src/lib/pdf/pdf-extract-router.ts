/**
 * PDF抽出ルータ（A-0: 入り口を1関数に凍結）
 * 
 * 全てのPDF/HTML→テキスト→required_forms→保存→失敗記録は
 * この関数経由で行う。Cron/手動/APIどこから呼んでもここを通る。
 * 
 * フロー:
 * 1. detailUrl からHTML本文を取得（優先・最安）
 * 2. HTMLで不足の場合、Firecrawl でPDFテキスト抽出（非AI）
 * 3. Firecrawlで不足の場合、Google Vision OCR（画像PDF用）
 * 4. 抽出結果を detail_json にマージ
 * 5. wall_chat_ready を再計算
 * 6. 失敗/不足は feed_failures に記録
 * 
 * ハイブリッド構成:
 * - Firecrawl: テキスト埋め込みPDF用（高速・安価）
 * - Google Vision: 画像PDF（スキャン）用（高精度OCR）
 */

import { extractDetailFromPdfText, mergeDetailJson } from '../pdf-extractor';
import { checkWallChatReadyFromJson, isWallChatReady } from '../wall-chat-ready';
import type { DetailJSON } from '../wall-chat-ready';
import { 
  extractRequiredFormsFromText, 
  validateFormsResult, 
  type FormsValidationResult 
} from './required-forms-extractor';
import { recordPdfFailure, type PdfFailureReason, type PdfFailureStage } from './pdf-failures';

// --- 定数（凍結仕様）---
export const MIN_TEXT_LEN_FOR_NON_OCR = 800;    // 非AIで有効とみなす最低文字数
export const MIN_FORMS = 2;                      // required_forms の最低数
export const MIN_FIELDS_PER_FORM = 3;            // 各フォームの最低フィールド数
export const MAX_PDF_FETCH_SIZE = 5 * 1024 * 1024; // 5MB 上限
export const FIRECRAWL_TIMEOUT_MS = 30000;       // Firecrawl タイムアウト
export const VISION_MAX_PAGES = 5;               // Vision OCR 最大ページ数

// --- 型定義 ---
export type ExtractSource = {
  subsidyId: string;
  source: string;         // 'tokyo-shigoto' | 'jgrants' | etc.
  title: string;
  detailUrl?: string | null;
  pdfUrls?: string[];
  existingDetailJson?: string | null;
};

export type ExtractResult = {
  subsidyId: string;
  success: boolean;
  extractedFrom: 'html' | 'firecrawl' | 'vision_ocr' | 'pdf_native' | 'none';
  formsCount: number;
  fieldsTotal: number;
  newDetailJson: string;
  wallChatReady: boolean;
  wallChatMissing: string[];
  failureReason?: PdfFailureReason;
  failureMessage?: string;
  contentHash?: string;
  // メトリクス（計測用）
  metrics: ExtractMetrics;
};

export type ExtractMetrics = {
  htmlAttempted: boolean;
  htmlSuccess: boolean;
  firecrawlAttempted: boolean;
  firecrawlSuccess: boolean;
  visionAttempted: boolean;
  visionSuccess: boolean;
  visionPagesProcessed: number;
  textLengthExtracted: number;
  processingTimeMs: number;
};

export type ExtractEnv = {
  FIRECRAWL_API_KEY?: string;
  GOOGLE_CLOUD_API_KEY?: string;
};

// --- メイン関数（A-0: 唯一の入り口）---
/**
 * extractAndUpdateSubsidy
 * 
 * 1つの補助金に対してPDF/HTML抽出を実行し、結果を返す。
 * DB更新は呼び出し元が行う（この関数はDB依存しない純粋関数）。
 * 
 * @param input - 抽出対象の情報
 * @param env - 環境変数（FIRECRAWL_API_KEY, GOOGLE_CLOUD_API_KEY）
 */
export async function extractAndUpdateSubsidy(
  input: ExtractSource,
  env?: ExtractEnv
): Promise<ExtractResult> {
  const startTime = Date.now();
  const { subsidyId, source, title, detailUrl, pdfUrls, existingDetailJson } = input;
  
  // メトリクス初期化
  const metrics: ExtractMetrics = {
    htmlAttempted: false,
    htmlSuccess: false,
    firecrawlAttempted: false,
    firecrawlSuccess: false,
    visionAttempted: false,
    visionSuccess: false,
    visionPagesProcessed: 0,
    textLengthExtracted: 0,
    processingTimeMs: 0,
  };
  
  // 既存の detail_json をパース
  let existingDetail: DetailJSON = {};
  try {
    existingDetail = existingDetailJson ? JSON.parse(existingDetailJson) : {};
  } catch {
    existingDetail = {};
  }
  
  let extractedText = '';
  let extractedFrom: ExtractResult['extractedFrom'] = 'none';
  let failureReason: PdfFailureReason | undefined;
  let failureMessage: string | undefined;
  let contentHash: string | undefined;

  // ========================================
  // Step 1: detailUrl からHTML取得（最優先・最安）
  // ========================================
  let rawHtml = ''; // PDFリンク抽出用に生HTMLも保存
  let discoveredPdfUrls: string[] = []; // HTMLから発見したPDFリンク
  
  if (detailUrl) {
    metrics.htmlAttempted = true;
    try {
      // 生HTMLを取得
      const response = await fetch(detailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      
      if (response.ok) {
        rawHtml = await response.text();
        const htmlText = stripHtmlToText(rawHtml);
        
        // HTMLからPDFリンクを抽出（pdfUrlsが空の場合に使用）
        discoveredPdfUrls = extractPdfLinksFromHtml(rawHtml, detailUrl);
        if (discoveredPdfUrls.length > 0) {
          console.log(`[extractAndUpdateSubsidy] Discovered ${discoveredPdfUrls.length} PDF links from HTML for ${subsidyId}`);
        }
        
        if (htmlText.length >= MIN_TEXT_LEN_FOR_NON_OCR) {
          extractedText = htmlText;
          extractedFrom = 'html';
          contentHash = simpleHash(htmlText);
          metrics.htmlSuccess = true;
          console.log(`[extractAndUpdateSubsidy] HTML success for ${subsidyId}: ${htmlText.length} chars`);
        } else {
          console.log(`[extractAndUpdateSubsidy] HTML insufficient for ${subsidyId}: ${htmlText.length} chars`);
        }
      } else {
        console.warn(`[extractAndUpdateSubsidy] HTML fetch failed for ${subsidyId}: ${response.status} ${response.statusText}`);
      }
    } catch (e: any) {
      console.warn(`[extractAndUpdateSubsidy] HTML fetch failed for ${subsidyId}: ${e.message}`);
    }
  }
  
  // pdfUrlsが空の場合、HTMLから発見したPDFリンクを使用
  const effectivePdfUrls = (pdfUrls && pdfUrls.length > 0) ? pdfUrls : discoveredPdfUrls;

  // ========================================
  // Step 2: HTMLで不足の場合、Firecrawl でPDF抽出（非AI）
  // ========================================
  if (extractedText.length < MIN_TEXT_LEN_FOR_NON_OCR && effectivePdfUrls.length > 0 && env?.FIRECRAWL_API_KEY) {
    for (const pdfUrl of effectivePdfUrls.slice(0, 3)) { // 最大3件
      metrics.firecrawlAttempted = true;
      try {
        const firecrawlResult = await extractWithFirecrawl(pdfUrl, env.FIRECRAWL_API_KEY);
        if (firecrawlResult.text.length >= MIN_TEXT_LEN_FOR_NON_OCR) {
          extractedText = firecrawlResult.text;
          extractedFrom = 'firecrawl';
          contentHash = firecrawlResult.hash;
          metrics.firecrawlSuccess = true;
          console.log(`[extractAndUpdateSubsidy] Firecrawl success for ${subsidyId}: ${firecrawlResult.text.length} chars`);
          break;
        } else {
          console.log(`[extractAndUpdateSubsidy] Firecrawl insufficient for ${subsidyId}: ${firecrawlResult.text.length} chars`);
        }
      } catch (e: any) {
        console.warn(`[extractAndUpdateSubsidy] Firecrawl failed for ${pdfUrl}: ${e.message}`);
      }
    }
  }

  // ========================================
  // Step 3: Firecrawlで不足の場合、Google Vision OCR（画像PDF用）
  // ========================================
  if (extractedText.length < MIN_TEXT_LEN_FOR_NON_OCR && effectivePdfUrls.length > 0 && env?.GOOGLE_CLOUD_API_KEY) {
    for (const pdfUrl of effectivePdfUrls.slice(0, 2)) { // OCRは高コストなので最大2件
      metrics.visionAttempted = true;
      try {
        const visionResult = await extractWithGoogleVision(pdfUrl, env.GOOGLE_CLOUD_API_KEY);
        metrics.visionPagesProcessed += visionResult.pagesProcessed;
        
        if (visionResult.text.length >= MIN_TEXT_LEN_FOR_NON_OCR) {
          extractedText = visionResult.text;
          extractedFrom = 'vision_ocr';
          contentHash = visionResult.hash;
          metrics.visionSuccess = true;
          console.log(`[extractAndUpdateSubsidy] Vision OCR success for ${subsidyId}: ${visionResult.text.length} chars, ${visionResult.pagesProcessed} pages`);
          break;
        } else {
          console.log(`[extractAndUpdateSubsidy] Vision OCR insufficient for ${subsidyId}: ${visionResult.text.length} chars`);
        }
      } catch (e: any) {
        console.warn(`[extractAndUpdateSubsidy] Vision OCR failed for ${pdfUrl}: ${e.message}`);
      }
    }
  }

  // ========================================
  // Step 4: テキスト不足の場合 → 失敗記録
  // ========================================
  metrics.textLengthExtracted = extractedText.length;
  
  if (extractedText.length < MIN_TEXT_LEN_FOR_NON_OCR) {
    failureReason = 'FETCH_FAILED';
    failureMessage = `Insufficient text extracted (${extractedText.length} chars, min ${MIN_TEXT_LEN_FOR_NON_OCR}). ` +
      `Attempted: HTML=${metrics.htmlAttempted}, Firecrawl=${metrics.firecrawlAttempted}, Vision=${metrics.visionAttempted}`;
    
    // 既存データでwall_chat_ready判定
    const readyResult = checkWallChatReadyFromJson(existingDetailJson || '{}');
    metrics.processingTimeMs = Date.now() - startTime;
    
    return {
      subsidyId,
      success: false,
      extractedFrom: 'none',
      formsCount: 0,
      fieldsTotal: 0,
      newDetailJson: existingDetailJson || '{}',
      wallChatReady: readyResult.ready,
      wallChatMissing: readyResult.missing,
      failureReason,
      failureMessage,
      metrics,
    };
  }

  // ========================================
  // Step 5: テキストから detail データ抽出
  // ========================================
  const extractedDetail = extractDetailFromPdfText(extractedText);
  
  // ========================================
  // Step 6: required_forms 抽出 + 品質ゲート
  // ========================================
  let formsResult = extractRequiredFormsFromText(extractedText);
  let formsValidation = validateFormsResult(formsResult, MIN_FORMS, MIN_FIELDS_PER_FORM);
  
  // ========================================
  // Step 6.5: HTMLで様式が見つからない場合、PDFからも抽出を試みる
  // （HTMLには概要、PDFには申請様式という構成が多いため）
  // ========================================
  if (!formsValidation.valid && extractedFrom === 'html' && effectivePdfUrls.length > 0) {
    console.log(`[extractAndUpdateSubsidy] HTML forms insufficient for ${subsidyId}, trying PDF extraction from ${effectivePdfUrls.length} PDFs...`);
    
    // Firecrawl でPDF抽出を試みる
    if (env?.FIRECRAWL_API_KEY) {
      for (const pdfUrl of effectivePdfUrls.slice(0, 3)) {
        metrics.firecrawlAttempted = true;
        try {
          const firecrawlResult = await extractWithFirecrawl(pdfUrl, env.FIRECRAWL_API_KEY);
          if (firecrawlResult.text.length >= 200) { // 様式検出用は200文字でOK
            const pdfFormsResult = extractRequiredFormsFromText(firecrawlResult.text);
            const pdfFormsValidation = validateFormsResult(pdfFormsResult, MIN_FORMS, MIN_FIELDS_PER_FORM);
            
            if (pdfFormsValidation.valid) {
              // PDFから様式を見つけた場合、結果をマージ
              formsResult = pdfFormsResult;
              formsValidation = pdfFormsValidation;
              metrics.firecrawlSuccess = true;
              console.log(`[extractAndUpdateSubsidy] Firecrawl forms success for ${subsidyId}: ${pdfFormsResult.length} forms from PDF`);
              break;
            }
          }
        } catch (e: any) {
          console.warn(`[extractAndUpdateSubsidy] Firecrawl PDF forms extraction failed for ${pdfUrl}: ${e.message}`);
        }
      }
    }
    
    // Vision OCR でPDF抽出を試みる（Firecrawlで見つからない場合）
    if (!formsValidation.valid && env?.GOOGLE_CLOUD_API_KEY) {
      for (const pdfUrl of effectivePdfUrls.slice(0, 2)) {
        metrics.visionAttempted = true;
        try {
          const visionResult = await extractWithGoogleVision(pdfUrl, env.GOOGLE_CLOUD_API_KEY);
          metrics.visionPagesProcessed += visionResult.pagesProcessed;
          
          if (visionResult.text.length >= 200) {
            const pdfFormsResult = extractRequiredFormsFromText(visionResult.text);
            const pdfFormsValidation = validateFormsResult(pdfFormsResult, MIN_FORMS, MIN_FIELDS_PER_FORM);
            
            if (pdfFormsValidation.valid) {
              formsResult = pdfFormsResult;
              formsValidation = pdfFormsValidation;
              metrics.visionSuccess = true;
              console.log(`[extractAndUpdateSubsidy] Vision OCR forms success for ${subsidyId}: ${pdfFormsResult.length} forms from PDF`);
              break;
            }
          }
        } catch (e: any) {
          console.warn(`[extractAndUpdateSubsidy] Vision OCR PDF forms extraction failed for ${pdfUrl}: ${e.message}`);
        }
      }
    }
  }
  
  // フォーム抽出に失敗した場合の記録
  if (!formsValidation.valid) {
    failureReason = formsValidation.reason;
    failureMessage = formsValidation.message;
  }

  // ========================================
  // Step 7: detail_json にマージ
  // ========================================
  let mergedDetail = mergeDetailJson(existingDetail, extractedDetail);
  
  // required_forms を追加（品質ゲート通過時のみ上書き）
  if (formsValidation.valid && formsResult.length > 0) {
    mergedDetail = {
      ...mergedDetail,
      required_forms: formsResult,
      required_forms_extracted_at: new Date().toISOString(),
      pdf_text_source: extractedFrom,
    };
  }
  
  // contentHash を記録
  if (contentHash) {
    mergedDetail.content_hashes = [
      ...(mergedDetail.content_hashes || []),
      { hash: contentHash, source: extractedFrom, at: new Date().toISOString() }
    ].slice(-5); // 最新5件のみ保持
  }

  const newDetailJson = JSON.stringify(mergedDetail);

  // ========================================
  // Step 8: wall_chat_ready 再計算
  // ========================================
  const readyResult = isWallChatReady(mergedDetail);

  // フォーム数カウント
  const forms = Array.isArray(mergedDetail.required_forms) ? mergedDetail.required_forms : [];
  const formsCount = forms.length;
  const fieldsTotal = forms.reduce((sum, f) => sum + (f?.fields?.length || 0), 0);

  metrics.processingTimeMs = Date.now() - startTime;

  return {
    subsidyId,
    success: formsValidation.valid || formsCount > 0,
    extractedFrom,
    formsCount,
    fieldsTotal,
    newDetailJson,
    wallChatReady: readyResult.ready,
    wallChatMissing: readyResult.missing,
    failureReason,
    failureMessage,
    contentHash,
    metrics,
  };
}

// ========================================
// Firecrawl API（テキスト埋め込みPDF用）
// ========================================
type FirecrawlResult = {
  text: string;
  hash: string;
};

async function extractWithFirecrawl(pdfUrl: string, apiKey: string): Promise<FirecrawlResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: pdfUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }
    
    const result = await response.json() as {
      success: boolean;
      data?: {
        markdown?: string;
        html?: string;
      };
    };
    
    if (!result.success || !result.data?.markdown) {
      throw new Error('Firecrawl returned no data');
    }
    
    const text = result.data.markdown;
    const hash = simpleHash(text);
    
    return { text, hash };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ========================================
// Google Vision API（画像PDF用OCR）
// ========================================
type VisionResult = {
  text: string;
  hash: string;
  pagesProcessed: number;
};

async function extractWithGoogleVision(pdfUrl: string, apiKey: string): Promise<VisionResult> {
  // Step 1: PDFをダウンロード
  const pdfResponse = await fetch(pdfUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  
  if (!pdfResponse.ok) {
    throw new Error(`PDF fetch failed: ${pdfResponse.status}`);
  }
  
  const contentLength = pdfResponse.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_PDF_FETCH_SIZE) {
    throw new Error(`PDF too large: ${contentLength} bytes`);
  }
  
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);
  
  // Step 2: Google Vision API でOCR
  // Note: Vision API は PDF を直接サポートしている
  const visionResponse = await fetch(
    `https://vision.googleapis.com/v1/files:asyncBatchAnnotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          inputConfig: {
            content: pdfBase64,
            mimeType: 'application/pdf',
          },
          features: [{
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1,
          }],
          outputConfig: {
            gcsDestination: {
              uri: '', // 非同期の場合はGCSが必要、ここでは同期APIを使う
            },
          },
        }],
      }),
    }
  );
  
  // 同期APIを使う（小さいPDF向け）
  const syncVisionResponse = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: pdfBase64,
          },
          features: [{
            type: 'DOCUMENT_TEXT_DETECTION',
          }],
        }],
      }),
    }
  );
  
  if (!syncVisionResponse.ok) {
    const errorText = await syncVisionResponse.text();
    throw new Error(`Vision API error: ${syncVisionResponse.status} - ${errorText.slice(0, 200)}`);
  }
  
  const visionResult = await syncVisionResponse.json() as {
    responses?: Array<{
      fullTextAnnotation?: {
        text?: string;
        pages?: Array<any>;
      };
      error?: {
        message?: string;
      };
    }>;
  };
  
  if (visionResult.responses?.[0]?.error) {
    throw new Error(`Vision API error: ${visionResult.responses[0].error.message}`);
  }
  
  const fullText = visionResult.responses?.[0]?.fullTextAnnotation?.text || '';
  const pagesCount = visionResult.responses?.[0]?.fullTextAnnotation?.pages?.length || 1;
  const hash = simpleHash(fullText);
  
  return {
    text: fullText,
    hash,
    pagesProcessed: pagesCount,
  };
}

// ========================================
// HTML抽出（最優先・最安）
// ========================================
async function fetchHtmlAsText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTML fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return stripHtmlToText(html);
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * HTMLからPDFリンクを抽出
 * 申請様式/様式/募集要項などに関連するPDFを優先
 */
function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const pdfLinks: Array<{ url: string; priority: number }> = [];
  
  // PDFリンクのパターン
  const linkPatterns = [
    // href="xxx.pdf"
    /href=["']([^"']+\.pdf)["']/gi,
    // href="xxx.PDF"
    /href=["']([^"']+\.PDF)["']/gi,
  ];
  
  for (const pattern of linkPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1];
      
      // 相対URLを絶対URLに変換
      if (!url.startsWith('http')) {
        try {
          const base = new URL(baseUrl);
          if (url.startsWith('/')) {
            url = `${base.protocol}//${base.host}${url}`;
          } else {
            // 相対パス（同一ディレクトリ）
            const pathParts = base.pathname.split('/');
            pathParts.pop(); // ファイル名を削除
            url = `${base.protocol}//${base.host}${pathParts.join('/')}/${url}`;
          }
        } catch {
          continue;
        }
      }
      
      // 優先度を計算（申請様式に関連するものを優先）
      let priority = 0;
      const lowerUrl = url.toLowerCase();
      const htmlContext = html.slice(Math.max(0, match.index - 200), match.index + 200);
      
      // ファイル名に申請/様式などが含まれる
      if (/shinsei|youshiki|boshu|application|form/i.test(lowerUrl)) {
        priority += 10;
      }
      
      // 周囲のテキストに申請様式などが含まれる
      if (/申請様式|様式|募集要項|提出書類|申請書|記入例|記載例/.test(htmlContext)) {
        priority += 5;
      }
      
      // チラシ/概要は後回し
      if (/chirashi|gaiyou|leaflet|pamphlet/i.test(lowerUrl)) {
        priority -= 5;
      }
      
      pdfLinks.push({ url, priority });
    }
  }
  
  // 重複除去＆優先度でソート
  const seen = new Set<string>();
  const uniqueLinks = pdfLinks
    .filter(p => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    })
    .sort((a, b) => b.priority - a.priority)
    .map(p => p.url);
  
  return uniqueLinks.slice(0, 10); // 最大10件
}

// ========================================
// ユーティリティ
// ========================================
function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ========================================
// バッチ処理用
// ========================================
export type BatchExtractOptions = {
  env: ExtractEnv & { DB: D1Database };
  sources: ExtractSource[];
  maxConcurrency?: number;
  onProgress?: (processed: number, total: number) => void;
};

export type BatchExtractResult = {
  processed: number;
  succeeded: number;
  failed: number;
  wallChatReadyCount: number;
  results: ExtractResult[];
  failures: Array<{
    subsidyId: string;
    reason: PdfFailureReason;
    message: string;
  }>;
  // 集計メトリクス
  totalMetrics: {
    htmlAttempted: number;
    htmlSuccess: number;
    firecrawlAttempted: number;
    firecrawlSuccess: number;
    visionAttempted: number;
    visionSuccess: number;
    visionPagesTotal: number;
    totalProcessingTimeMs: number;
  };
};

/**
 * バッチでPDF抽出を実行
 */
export async function batchExtractPdfForms(
  options: BatchExtractOptions
): Promise<BatchExtractResult> {
  const { env, sources, maxConcurrency = 5, onProgress } = options;
  
  const results: ExtractResult[] = [];
  const failures: BatchExtractResult['failures'] = [];
  let wallChatReadyCount = 0;
  
  const totalMetrics = {
    htmlAttempted: 0,
    htmlSuccess: 0,
    firecrawlAttempted: 0,
    firecrawlSuccess: 0,
    visionAttempted: 0,
    visionSuccess: 0,
    visionPagesTotal: 0,
    totalProcessingTimeMs: 0,
  };
  
  // 並列処理（concurrency制限）
  const batches: ExtractSource[][] = [];
  for (let i = 0; i < sources.length; i += maxConcurrency) {
    batches.push(sources.slice(i, i + maxConcurrency));
  }
  
  let processed = 0;
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (source) => {
        try {
          const result = await extractAndUpdateSubsidy(source, env);
          return result;
        } catch (e: any) {
          return {
            subsidyId: source.subsidyId,
            success: false,
            extractedFrom: 'none' as const,
            formsCount: 0,
            fieldsTotal: 0,
            newDetailJson: source.existingDetailJson || '{}',
            wallChatReady: false,
            wallChatMissing: [],
            failureReason: 'FETCH_FAILED' as PdfFailureReason,
            failureMessage: e.message,
            metrics: {
              htmlAttempted: false,
              htmlSuccess: false,
              firecrawlAttempted: false,
              firecrawlSuccess: false,
              visionAttempted: false,
              visionSuccess: false,
              visionPagesProcessed: 0,
              textLengthExtracted: 0,
              processingTimeMs: 0,
            },
          };
        }
      })
    );
    
    results.push(...batchResults);
    
    for (const result of batchResults) {
      if (result.wallChatReady) wallChatReadyCount++;
      if (result.failureReason) {
        failures.push({
          subsidyId: result.subsidyId,
          reason: result.failureReason,
          message: result.failureMessage || 'Unknown error',
        });
      }
      
      // メトリクス集計
      if (result.metrics.htmlAttempted) totalMetrics.htmlAttempted++;
      if (result.metrics.htmlSuccess) totalMetrics.htmlSuccess++;
      if (result.metrics.firecrawlAttempted) totalMetrics.firecrawlAttempted++;
      if (result.metrics.firecrawlSuccess) totalMetrics.firecrawlSuccess++;
      if (result.metrics.visionAttempted) totalMetrics.visionAttempted++;
      if (result.metrics.visionSuccess) totalMetrics.visionSuccess++;
      totalMetrics.visionPagesTotal += result.metrics.visionPagesProcessed;
      totalMetrics.totalProcessingTimeMs += result.metrics.processingTimeMs;
    }
    
    processed += batch.length;
    onProgress?.(processed, sources.length);
  }
  
  return {
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    wallChatReadyCount,
    results,
    failures,
    totalMetrics,
  };
}

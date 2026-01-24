/**
 * PDF抽出ルータ（A-0: 入り口を1関数に凍結）
 * 
 * 全てのPDF/HTML→テキスト→required_forms→保存→失敗記録は
 * この関数経由で行う。Cron/手動/APIどこから呼んでもここを通る。
 * 
 * フロー:
 * 1. detailUrl からHTML本文を取得（優先）
 * 2. HTMLで不足の場合、pdfUrls からテキスト抽出
 * 3. 抽出結果を detail_json にマージ
 * 4. wall_chat_ready を再計算
 * 5. 失敗/不足は feed_failures に記録
 */

import { extractDetailFromPdfText, mergeDetailJson } from '../pdf-extractor';
import { checkWallChatReadyFromJson, isWallChatReady } from '../wall-chat-ready';
import type { DetailJSON } from '../wall-chat-ready';
import { 
  extractRequiredFormsFromText, 
  validateFormsResult, 
  type FormsValidationResult 
} from './required-forms-extractor';
import { recordPdfFailure, type PdfFailureReason } from './pdf-failures';

// --- 定数（凍結仕様）---
export const MIN_TEXT_LEN_FOR_NON_OCR = 800;    // 非AIで有効とみなす最低文字数
export const MIN_FORMS = 2;                      // required_forms の最低数
export const MIN_FIELDS_PER_FORM = 3;            // 各フォームの最低フィールド数
export const MAX_PDF_FETCH_SIZE = 5 * 1024 * 1024; // 5MB 上限

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
  extractedFrom: 'html' | 'pdf_native' | 'pdf_ocr' | 'none';
  formsCount: number;
  fieldsTotal: number;
  newDetailJson: string;
  wallChatReady: boolean;
  wallChatMissing: string[];
  failureReason?: PdfFailureReason;
  failureMessage?: string;
  pdfHash?: string;
};

// --- メイン関数（A-0: 唯一の入り口）---
/**
 * extractAndUpdateSubsidy
 * 
 * 1つの補助金に対してPDF/HTML抽出を実行し、結果を返す。
 * DB更新は呼び出し元が行う（この関数はDB依存しない純粋関数）。
 */
export async function extractAndUpdateSubsidy(
  input: ExtractSource
): Promise<ExtractResult> {
  const { subsidyId, source, title, detailUrl, pdfUrls, existingDetailJson } = input;
  
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
  let pdfHash: string | undefined;

  // --- Step 1: detailUrl からHTML取得 ---
  if (detailUrl) {
    try {
      const htmlText = await fetchHtmlAsText(detailUrl);
      if (htmlText.length >= MIN_TEXT_LEN_FOR_NON_OCR) {
        extractedText = htmlText;
        extractedFrom = 'html';
      }
    } catch (e: any) {
      // HTMLフェッチ失敗は記録するが、PDF fallback を試す
      console.warn(`[extractAndUpdateSubsidy] HTML fetch failed for ${subsidyId}: ${e.message}`);
    }
  }

  // --- Step 2: HTMLで不足の場合、PDF抽出 ---
  if (extractedText.length < MIN_TEXT_LEN_FOR_NON_OCR && pdfUrls && pdfUrls.length > 0) {
    for (const pdfUrl of pdfUrls.slice(0, 5)) { // 最大5件
      try {
        const pdfResult = await extractPdfTextSmart(pdfUrl);
        if (pdfResult.text.length >= MIN_TEXT_LEN_FOR_NON_OCR) {
          extractedText = pdfResult.text;
          extractedFrom = pdfResult.usedOcr ? 'pdf_ocr' : 'pdf_native';
          pdfHash = pdfResult.hash;
          break;
        }
      } catch (e: any) {
        console.warn(`[extractAndUpdateSubsidy] PDF extract failed for ${pdfUrl}: ${e.message}`);
      }
    }
  }

  // --- Step 3: テキスト不足の場合 → 失敗記録 ---
  if (extractedText.length < MIN_TEXT_LEN_FOR_NON_OCR) {
    failureReason = 'FETCH_FAILED';
    failureMessage = `Insufficient text extracted (${extractedText.length} chars, min ${MIN_TEXT_LEN_FOR_NON_OCR})`;
    
    // 既存データでwall_chat_ready判定
    const readyResult = checkWallChatReadyFromJson(existingDetailJson || '{}');
    
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
    };
  }

  // --- Step 4: テキストから detail データ抽出 ---
  const extractedDetail = extractDetailFromPdfText(extractedText);
  
  // --- Step 5: required_forms 抽出 + 品質ゲート ---
  const formsResult = extractRequiredFormsFromText(extractedText);
  const formsValidation = validateFormsResult(formsResult, MIN_FORMS, MIN_FIELDS_PER_FORM);
  
  // フォーム抽出に失敗した場合の記録
  if (!formsValidation.valid) {
    failureReason = formsValidation.reason;
    failureMessage = formsValidation.message;
  }

  // --- Step 6: detail_json にマージ ---
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
  
  // pdfHash を記録
  if (pdfHash) {
    mergedDetail.pdf_hashes = [
      ...(mergedDetail.pdf_hashes || []),
      pdfHash
    ].slice(-10); // 最新10件のみ保持
  }

  const newDetailJson = JSON.stringify(mergedDetail);

  // --- Step 7: wall_chat_ready 再計算 ---
  const readyResult = isWallChatReady(mergedDetail);

  // フォーム数カウント
  const forms = Array.isArray(mergedDetail.required_forms) ? mergedDetail.required_forms : [];
  const formsCount = forms.length;
  const fieldsTotal = forms.reduce((sum, f) => sum + (f?.fields?.length || 0), 0);

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
    pdfHash,
  };
}

// --- A-1: extractPdfTextSmart (非AI → OCR 逐次判定) ---
type PdfExtractResult = {
  text: string;
  usedOcr: boolean;
  hash: string;
};

/**
 * PDFからテキストを抽出（非AI優先、必要時のみOCR）
 * 
 * 判定基準:
 * 1. まずネイティブテキスト抽出を試行
 * 2. MIN_TEXT_LEN_FOR_NON_OCR 未満ならOCRフォールバック
 * 3. 両方失敗なら例外をthrow
 */
async function extractPdfTextSmart(pdfUrl: string): Promise<PdfExtractResult> {
  // Step 1: PDFをfetch
  const response = await fetch(pdfUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/pdf,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`PDF fetch failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_PDF_FETCH_SIZE) {
    throw new Error(`PDF too large: ${contentLength} bytes (max ${MAX_PDF_FETCH_SIZE})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const hash = simpleHash(new Uint8Array(arrayBuffer).slice(0, 1024).toString());

  // Step 2: ネイティブテキスト抽出（PDF.js は使えないので、簡易パース）
  const nativeText = extractTextFromPdfBuffer(arrayBuffer);
  
  if (nativeText.length >= MIN_TEXT_LEN_FOR_NON_OCR) {
    return {
      text: nativeText,
      usedOcr: false,
      hash,
    };
  }

  // Step 3: OCRフォールバック（Cloudflare Workersでは外部APIが必要）
  // 現在はOCR非対応として、ネイティブテキストを返す
  // TODO: OCR API (Google Vision, AWS Textract, etc.) を統合
  console.warn(`[extractPdfTextSmart] Native text insufficient (${nativeText.length} chars), OCR not implemented`);
  
  return {
    text: nativeText,
    usedOcr: false,
    hash,
  };
}

/**
 * PDFバッファからテキストを抽出（簡易版）
 * 
 * Cloudflare Workersでは完全なPDF.js は使えないため、
 * ストリームテキストを直接抽出する簡易実装。
 */
function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const rawText = decoder.decode(bytes);
  
  // PDF内のテキストストリームを抽出（BT...ET ブロック）
  const textParts: string[] = [];
  
  // 方法1: stream/endstream 内のテキストを抽出
  const streamMatches = rawText.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  for (const match of streamMatches) {
    const content = match[1];
    // テキストっぽい部分を抽出
    const tjMatches = content.matchAll(/\[(.*?)\]\s*TJ|\((.*?)\)\s*Tj/g);
    for (const tj of tjMatches) {
      const text = (tj[1] || tj[2] || '')
        .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      if (text.trim()) textParts.push(text);
    }
  }
  
  // 方法2: 可読文字の連続を抽出（フォールバック）
  if (textParts.length === 0) {
    const japaneseAndAscii = rawText.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEFa-zA-Z0-9\s,.、。・！？「」『』（）()【】\-ー]+/g);
    if (japaneseAndAscii) {
      textParts.push(...japaneseAndAscii.filter(s => s.length >= 4));
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

// --- HTML抽出 ---
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

/**
 * HTMLからテキストを抽出
 */
function stripHtmlToText(html: string): string {
  return html
    // script, style, nav, footer, header などを除去
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    // タグを除去
    .replace(/<[^>]+>/g, ' ')
    // HTML entities をデコード
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    // 空白を正規化
    .replace(/\s+/g, ' ')
    .trim();
}

// --- ユーティリティ ---
function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// --- バッチ処理用 ---
export type BatchExtractOptions = {
  env: { DB: D1Database };
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
};

/**
 * バッチでPDF抽出を実行
 * 
 * Cron ジョブから呼び出される想定。
 */
export async function batchExtractPdfForms(
  options: BatchExtractOptions
): Promise<BatchExtractResult> {
  const { env, sources, maxConcurrency = 5, onProgress } = options;
  
  const results: ExtractResult[] = [];
  const failures: BatchExtractResult['failures'] = [];
  let wallChatReadyCount = 0;
  
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
          const result = await extractAndUpdateSubsidy(source);
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
  };
}

/**
 * vision.ts - Google Vision OCR ラッパー（Freeze-COST-2準拠）
 * 
 * 直接 fetch 禁止。この wrapper 経由で必ずコストを記録する。
 * 
 * 凍結ルール:
 *   - Freeze-COST-2: 外部API呼び出しは wrapper 経由必須
 *   - Freeze-COST-3: 失敗時もコスト記録（ページ数分消費）
 */

import { logVisionCost } from './cost-logger';
import { calculateVisionCost } from './rates';

// =====================================================
// 定数
// =====================================================
export const MAX_PDF_FETCH_SIZE = 5 * 1024 * 1024; // 5MB
export const VISION_MAX_PAGES = 5;
const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

// =====================================================
// 型定義
// =====================================================
export interface VisionOcrResult {
  success: boolean;
  text: string;
  hash: string;
  pagesProcessed: number;
  costUsd: number;
  error?: string;
  httpStatus?: number;
}

export interface VisionContext {
  db: D1Database;
  apiKey: string;
  // コスト記録用のコンテキスト（nullable）
  subsidyId?: string;
  sourceId?: string;
  discoveryItemId?: string;
}

// =====================================================
// メイン関数
// =====================================================

/**
 * Google Vision OCR でPDFからテキスト抽出
 * 
 * @param pdfUrl - PDF の URL
 * @param ctx - コンテキスト（db, apiKey, 関連エンティティ）
 * @returns OCR結果
 */
export async function visionOcr(
  pdfUrl: string,
  ctx: VisionContext
): Promise<VisionOcrResult> {
  const { db, apiKey, subsidyId, sourceId, discoveryItemId } = ctx;
  
  let httpStatus: number | undefined;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let success = false;
  let text = '';
  let hash = '';
  let pagesProcessed = 0;
  
  try {
    // Step 1: PDFをダウンロード
    const pdfResponse = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!pdfResponse.ok) {
      httpStatus = pdfResponse.status;
      errorCode = 'PDF_FETCH_FAILED';
      errorMessage = `PDF fetch failed: ${pdfResponse.status}`;
      throw new Error(errorMessage);
    }
    
    const contentLength = pdfResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PDF_FETCH_SIZE) {
      errorCode = 'PDF_TOO_LARGE';
      errorMessage = `PDF too large: ${contentLength} bytes`;
      throw new Error(errorMessage);
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);
    
    // Step 2: Google Vision API でOCR
    const visionResponse = await fetch(
      `${VISION_API_URL}?key=${apiKey}`,
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
    
    httpStatus = visionResponse.status;
    
    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      errorCode = visionResponse.status === 429 ? 'RATE_LIMITED' : 'VISION_API_ERROR';
      errorMessage = `Vision API error: ${visionResponse.status} - ${errorText.slice(0, 200)}`;
      throw new Error(errorMessage);
    }
    
    const visionResult = await visionResponse.json() as {
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
      errorCode = 'VISION_RESPONSE_ERROR';
      errorMessage = `Vision API error: ${visionResult.responses[0].error.message}`;
      throw new Error(errorMessage);
    }
    
    text = visionResult.responses?.[0]?.fullTextAnnotation?.text || '';
    hash = simpleHash(text);
    
    // P0-2: pages 取得ルール明示
    // Vision API の pages 配列から実ページ数を取得
    const pagesFromApi = visionResult.responses?.[0]?.fullTextAnnotation?.pages?.length;
    if (pagesFromApi !== undefined && pagesFromApi > 0) {
      pagesProcessed = pagesFromApi;
    } else {
      // ページ数が取得できない場合は 1 ページ固定（凍結ルール）
      // Note: これは推定ではなく「不明時のルール」として明示的に 1 を使用
      pagesProcessed = 1;
      // 成功時でも pages 不明を記録（コスト追跡のため）
      if (!errorCode) {
        errorCode = 'PAGES_UNKNOWN';
        errorMessage = 'Vision API did not return page count; using default 1 page (frozen rule)';
      }
    }
    success = true;
    
  } catch (e: any) {
    if (!errorCode) {
      errorCode = 'UNKNOWN_ERROR';
      errorMessage = e.message;
    }
    // エラー時も 1 ページとしてカウント（課金は発生しうる）
    if (pagesProcessed === 0) {
      pagesProcessed = 1;
    }
  }
  
  const costUsd = calculateVisionCost(pagesProcessed);
  
  // Freeze-COST-3: 失敗時もコスト記録
  await logVisionCost(db, {
    pages: pagesProcessed,
    costUsd,
    url: pdfUrl,
    success,
    httpStatus,
    errorCode,
    errorMessage,
    subsidyId,
    sourceId,
    discoveryItemId,
  });
  
  return {
    success,
    text,
    hash,
    pagesProcessed,
    costUsd,
    error: errorMessage,
    httpStatus,
  };
}

// =====================================================
// ユーティリティ
// =====================================================

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

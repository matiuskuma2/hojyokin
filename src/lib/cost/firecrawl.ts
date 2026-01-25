/**
 * firecrawl.ts - Firecrawl API ラッパー（Freeze-COST-2準拠）
 * 
 * 直接 fetch 禁止。この wrapper 経由で必ずコストを記録する。
 * 
 * 凍結ルール:
 *   - Freeze-COST-2: 外部API呼び出しは wrapper 経由必須
 *   - Freeze-COST-3: 失敗時もコスト記録（1 credit 消費）
 */

import { logFirecrawlCost } from './cost-logger';
import { calculateFirecrawlCost, FIRECRAWL_RATES } from './rates';

// =====================================================
// 定数
// =====================================================
export const FIRECRAWL_TIMEOUT_MS = 30000;
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

// =====================================================
// 型定義
// =====================================================
export interface FirecrawlScrapeResult {
  success: boolean;
  text: string;
  hash: string;
  credits: number;
  costUsd: number;
  error?: string;
  httpStatus?: number;
}

export interface FirecrawlContext {
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
 * Firecrawl でURLをスクレイプ
 * 
 * @param url - スクレイプ対象URL
 * @param ctx - コンテキスト（db, apiKey, 関連エンティティ）
 * @returns スクレイプ結果
 */
export async function firecrawlScrape(
  url: string,
  ctx: FirecrawlContext
): Promise<FirecrawlScrapeResult> {
  const { db, apiKey, subsidyId, sourceId, discoveryItemId } = ctx;
  const credits = FIRECRAWL_RATES.CREDITS_PER_SCRAPE; // 1 credit per scrape
  const costUsd = calculateFirecrawlCost(credits);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  
  let httpStatus: number | undefined;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let success = false;
  let text = '';
  let hash = '';
  
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
      signal: controller.signal,
    });
    
    httpStatus = response.status;
    
    if (!response.ok) {
      const errorText = await response.text();
      errorCode = response.status === 429 ? 'RATE_LIMITED' : 'API_ERROR';
      errorMessage = `Firecrawl API error: ${response.status} - ${errorText.slice(0, 200)}`;
    } else {
      const result = await response.json() as {
        success: boolean;
        data?: {
          markdown?: string;
          html?: string;
        };
      };
      
      if (!result.success || !result.data?.markdown) {
        errorCode = 'NO_DATA';
        errorMessage = 'Firecrawl returned no data';
      } else {
        text = result.data.markdown;
        hash = simpleHash(text);
        success = true;
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      errorCode = 'TIMEOUT';
      errorMessage = `Firecrawl timeout after ${FIRECRAWL_TIMEOUT_MS}ms`;
    } else {
      errorCode = 'NETWORK_ERROR';
      errorMessage = e.message;
    }
  } finally {
    clearTimeout(timeoutId);
  }
  
  // Freeze-COST-3: 失敗時もコスト記録（1 credit 消費は発生）
  await logFirecrawlCost(db, {
    credits,
    costUsd,
    url,
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
    credits,
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

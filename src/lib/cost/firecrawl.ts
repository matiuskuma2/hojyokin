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
  // P0-2: billing ステータス
  billing: 'known' | 'unknown';
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
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);
  
  let httpStatus: number | undefined;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let success = false;
  let text = '';
  let hash = '';
  // P0-2: usage を API レスポンスから取得、取得できない場合は USAGE_MISSING (cost=0 + billing=unknown)
  let credits = 0;
  let usageFromApi = false;
  let rawUsage: Record<string, unknown> | undefined;
  let billing: 'known' | 'unknown' = 'unknown'; // P0-2: デフォルトはunknown
  
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
      // 失敗時も 1 credit 消費と仮定（Firecrawl の課金仕様）
      credits = FIRECRAWL_RATES.CREDITS_PER_SCRAPE;
    } else {
      const result = await response.json() as {
        success: boolean;
        data?: {
          markdown?: string;
          html?: string;
        };
        // Firecrawl API v1 の usage フィールド（存在する場合）
        usage?: {
          credits?: number;
          creditsUsed?: number;
        };
      };
      
      // usage 情報を取得
      rawUsage = result.usage as Record<string, unknown> | undefined;
      if (result.usage?.credits !== undefined) {
        credits = result.usage.credits;
        usageFromApi = true;
        billing = 'known'; // P0-2: APIから取得できたらknown
      } else if (result.usage?.creditsUsed !== undefined) {
        credits = result.usage.creditsUsed;
        usageFromApi = true;
        billing = 'known'; // P0-2: APIから取得できたらknown
      }
      
      if (!result.success || !result.data?.markdown) {
        errorCode = 'NO_DATA';
        errorMessage = 'Firecrawl returned no data';
        // P0-2: データなしでも usage が取得できていればknown、そうでなければunknown
        if (!usageFromApi) {
          credits = 0; // P0-2: USAGE_MISSING 時は cost=0
          billing = 'unknown';
        }
      } else {
        text = result.data.markdown;
        hash = simpleHash(text);
        success = true;
        // P0-2: 成功時に usage が取得できなかった場合は USAGE_MISSING (cost=0 + billing=unknown)
        if (!usageFromApi) {
          credits = 0; // P0-2: USAGE_MISSING 時は cost=0（実数不明）
          billing = 'unknown';
          errorCode = 'USAGE_MISSING';
          errorMessage = 'Firecrawl API did not return usage information; cost recorded as 0 (unknown billing)';
          // Note: success は true のままだが、billing=unknown で記録
        }
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
    // P0-2: エラー時はusage不明なので cost=0 + billing=unknown
    credits = 0;
    billing = 'unknown';
  } finally {
    clearTimeout(timeoutId);
  }
  
  // P0-2: billing=unknown の場合は cost_usd=0、known の場合のみ実費用計算
  const costUsd = billing === 'known' ? calculateFirecrawlCost(credits) : 0;
  
  // Freeze-COST-3: 失敗時もコスト記録（P0-2: billing=unknown は cost=0 で記録）
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
    billing, // P0-2: billing ステータス
    rawUsage,
  });
  
  return {
    success,
    text,
    hash,
    credits,
    costUsd,
    error: errorMessage,
    httpStatus,
    billing, // P0-2: billing ステータスを返却
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

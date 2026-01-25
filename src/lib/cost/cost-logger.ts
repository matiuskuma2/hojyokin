/**
 * cost-logger.ts - APIコスト記録の共通ロガー（Freeze-COST-0〜4）
 * 
 * 凍結ルール:
 *   - Freeze-COST-0: api_cost_logs が唯一の真実
 *   - Freeze-COST-1: 推定値禁止、実数のみ
 *   - Freeze-COST-2: wrapper 経由必須
 *   - Freeze-COST-3: 失敗時もコスト記録
 *   - Freeze-COST-4: モデル/単価は metadata_json に保持
 */

// =====================================================
// 型定義
// =====================================================

export type CostService = 'firecrawl' | 'vision_ocr' | 'openai' | 'anthropic';
export type CostUnitType = 'credit' | 'page' | 'input_token' | 'output_token' | 'total_token';

export interface CostLogInput {
  service: CostService;
  action: string;            // 'scrape' | 'ocr' | 'chat_completion' | 'embedding' など
  
  // 関連エンティティ（nullable）
  sourceId?: string;         // feed_sources.id
  subsidyId?: string;        // subsidy_cache.id
  discoveryItemId?: string;  // discovery_items.id
  
  // リクエスト情報
  url?: string;
  
  // 消費量（実数）
  units: number;
  unitType: CostUnitType;
  costUsd: number;
  
  // 実行結果
  success: boolean;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  
  // 詳細（Freeze-COST-4）
  rawUsage?: Record<string, unknown>;  // API応答の生usage
  metadata?: {                         // モデル名/単価
    model?: string;
    rate?: number;
    [key: string]: unknown;
  };
}

export interface CostLogResult {
  id: number;
  success: boolean;
  error?: string;
}

// =====================================================
// メイン関数
// =====================================================

/**
 * APIコストを api_cost_logs に記録
 * 
 * @param db - D1Database インスタンス
 * @param input - コスト記録情報
 * @returns 記録結果
 */
export async function logApiCost(
  db: D1Database,
  input: CostLogInput
): Promise<CostLogResult> {
  try {
    const result = await db.prepare(`
      INSERT INTO api_cost_logs (
        service, action, source_id, subsidy_id, discovery_item_id,
        url, units, unit_type, cost_usd, currency,
        success, http_status, error_code, error_message,
        raw_usage_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      input.service,
      input.action,
      input.sourceId || null,
      input.subsidyId || null,
      input.discoveryItemId || null,
      input.url || null,
      input.units,
      input.unitType,
      input.costUsd,
      'USD',
      input.success ? 1 : 0,
      input.httpStatus || null,
      input.errorCode || null,
      input.errorMessage || null,
      input.rawUsage ? JSON.stringify(input.rawUsage) : null,
      input.metadata ? JSON.stringify(input.metadata) : null
    ).run();
    
    return {
      id: result.meta.last_row_id as number,
      success: true,
    };
  } catch (e: any) {
    console.error('[logApiCost] Failed to log cost:', e.message);
    return {
      id: 0,
      success: false,
      error: e.message,
    };
  }
}

// =====================================================
// 便利関数（サービス別）
// =====================================================

/**
 * Firecrawl コストを記録
 */
export async function logFirecrawlCost(
  db: D1Database,
  params: {
    credits: number;
    costUsd: number;
    url: string;
    success: boolean;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
    subsidyId?: string;
    sourceId?: string;
    discoveryItemId?: string;
  }
): Promise<CostLogResult> {
  return logApiCost(db, {
    service: 'firecrawl',
    action: 'scrape',
    units: params.credits,
    unitType: 'credit',
    costUsd: params.costUsd,
    url: params.url,
    success: params.success,
    httpStatus: params.httpStatus,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    subsidyId: params.subsidyId,
    sourceId: params.sourceId,
    discoveryItemId: params.discoveryItemId,
    metadata: {
      rate: 0.001, // $0.001 per credit
    },
  });
}

/**
 * Vision OCR コストを記録
 */
export async function logVisionCost(
  db: D1Database,
  params: {
    pages: number;
    costUsd: number;
    url: string;
    success: boolean;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
    subsidyId?: string;
    sourceId?: string;
    discoveryItemId?: string;
  }
): Promise<CostLogResult> {
  return logApiCost(db, {
    service: 'vision_ocr',
    action: 'ocr',
    units: params.pages,
    unitType: 'page',
    costUsd: params.costUsd,
    url: params.url,
    success: params.success,
    httpStatus: params.httpStatus,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    subsidyId: params.subsidyId,
    sourceId: params.sourceId,
    discoveryItemId: params.discoveryItemId,
    metadata: {
      rate: 0.0015, // $0.0015 per page (tier1)
    },
  });
}

/**
 * OpenAI コストを記録
 */
export async function logOpenAICost(
  db: D1Database,
  params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    action: string; // 'chat_completion' | 'embedding'
    success: boolean;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
    rawUsage?: Record<string, unknown>;
    subsidyId?: string;
    sourceId?: string;
  }
): Promise<CostLogResult> {
  return logApiCost(db, {
    service: 'openai',
    action: params.action,
    units: params.inputTokens + params.outputTokens,
    unitType: 'total_token',
    costUsd: params.costUsd,
    success: params.success,
    httpStatus: params.httpStatus,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    rawUsage: params.rawUsage,
    subsidyId: params.subsidyId,
    sourceId: params.sourceId,
    metadata: {
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    },
  });
}

/**
 * rates.ts - 凍結単価定義（Freeze-COST-4）
 * 
 * 全ての外部APIコスト単価をここで一元管理。
 * super_admin 表示時は api_cost_logs の実数を使用し、
 * この単価は記録時の metadata_json に保持される。
 */

// =====================================================
// Firecrawl 単価（2024-01月時点）
// =====================================================
export const FIRECRAWL_RATES = {
  /** 1 credit = $0.001 (Starter プラン) */
  USD_PER_CREDIT: 0.001,
  /** scrape 1回 = 1 credit */
  CREDITS_PER_SCRAPE: 1,
} as const;

// =====================================================
// Google Vision OCR 単価（2024-01月時点）
// =====================================================
export const VISION_OCR_RATES = {
  /** DOCUMENT_TEXT_DETECTION: 1-5 pages = $1.50 per 1000 pages */
  USD_PER_PAGE_TIER1: 0.0015,
  /** DOCUMENT_TEXT_DETECTION: 5M+ pages = $0.60 per 1000 pages */
  USD_PER_PAGE_TIER2: 0.0006,
  /** 月間無料枠: 1000 units */
  FREE_TIER_UNITS: 1000,
} as const;

// =====================================================
// OpenAI 単価（2024-01月時点）
// =====================================================
export const OPENAI_RATES = {
  'gpt-4o': {
    inputPer1K: 0.005,
    outputPer1K: 0.015,
  },
  'gpt-4o-mini': {
    inputPer1K: 0.00015,
    outputPer1K: 0.0006,
  },
  'gpt-4-turbo': {
    inputPer1K: 0.01,
    outputPer1K: 0.03,
  },
  'gpt-4': {
    inputPer1K: 0.03,
    outputPer1K: 0.06,
  },
  'gpt-3.5-turbo': {
    inputPer1K: 0.0005,
    outputPer1K: 0.0015,
  },
  'text-embedding-3-small': {
    inputPer1K: 0.00002,
    outputPer1K: 0,
  },
  'text-embedding-3-large': {
    inputPer1K: 0.00013,
    outputPer1K: 0,
  },
} as const;

export type OpenAIModel = keyof typeof OPENAI_RATES;

// =====================================================
// Anthropic 単価（2024-01月時点）
// =====================================================
export const ANTHROPIC_RATES = {
  'claude-3-5-sonnet-20241022': {
    inputPer1K: 0.003,
    outputPer1K: 0.015,
  },
  'claude-3-opus-20240229': {
    inputPer1K: 0.015,
    outputPer1K: 0.075,
  },
  'claude-3-haiku-20240307': {
    inputPer1K: 0.00025,
    outputPer1K: 0.00125,
  },
} as const;

export type AnthropicModel = keyof typeof ANTHROPIC_RATES;

// =====================================================
// コスト計算ユーティリティ
// =====================================================

/**
 * Firecrawl コスト計算
 */
export function calculateFirecrawlCost(credits: number): number {
  return credits * FIRECRAWL_RATES.USD_PER_CREDIT;
}

/**
 * Vision OCR コスト計算
 */
export function calculateVisionCost(pages: number): number {
  return pages * VISION_OCR_RATES.USD_PER_PAGE_TIER1;
}

/**
 * OpenAI コスト計算
 */
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = OPENAI_RATES[model as OpenAIModel];
  if (!rates) {
    // 未知のモデルは gpt-4o-mini で計算（安全側）
    const fallback = OPENAI_RATES['gpt-4o-mini'];
    return (inputTokens / 1000) * fallback.inputPer1K + (outputTokens / 1000) * fallback.outputPer1K;
  }
  return (inputTokens / 1000) * rates.inputPer1K + (outputTokens / 1000) * rates.outputPer1K;
}

/**
 * Anthropic コスト計算
 */
export function calculateAnthropicCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = ANTHROPIC_RATES[model as AnthropicModel];
  if (!rates) {
    // 未知のモデルは claude-3-haiku で計算（安全側）
    const fallback = ANTHROPIC_RATES['claude-3-haiku-20240307'];
    return (inputTokens / 1000) * fallback.inputPer1K + (outputTokens / 1000) * fallback.outputPer1K;
  }
  return (inputTokens / 1000) * rates.inputPer1K + (outputTokens / 1000) * rates.outputPer1K;
}

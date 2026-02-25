/**
 * src/lib/cost/index.ts - コスト管理モジュールのエクスポート
 * 
 * 凍結ルール（Freeze-COST-0〜4）の実装:
 *   - api_cost_logs テーブルに実数を記録
 *   - 外部API呼び出しは wrapper 経由
 *   - 推定値は super_admin に表示しない
 */

// コスト記録
export {
  logApiCost,
  logFirecrawlCost,
  logVisionCost,
  logOpenAICost,
  logSimpleScrapeCost,
  logSendGridCost,
  type CostLogInput,
  type CostLogResult,
  type CostService,
  type CostUnitType,
} from './cost-logger';

// 単価定義
export {
  FIRECRAWL_RATES,
  VISION_OCR_RATES,
  OPENAI_RATES,
  ANTHROPIC_RATES,
  calculateFirecrawlCost,
  getFirecrawlMonthlyCost,
  calculateFirecrawlUsageRate,
  calculateVisionCost,
  calculateOpenAICost,
  calculateAnthropicCost,
  type OpenAIModel,
  type AnthropicModel,
} from './rates';

// Firecrawl wrapper
export {
  firecrawlScrape,
  FIRECRAWL_TIMEOUT_MS,
  type FirecrawlScrapeResult,
  type FirecrawlContext,
} from './firecrawl';

// Vision OCR wrapper
export {
  visionOcr,
  MAX_PDF_FETCH_SIZE,
  VISION_MAX_PAGES,
  type VisionOcrResult,
  type VisionContext,
} from './vision';

/**
 * 統合イベントトラッカー
 * 
 * KPI / コスト / 更新状況を全て usage_events に記録
 */

import { v4 as uuidv4 } from 'uuid';

// OpenAI 価格表（USD per 1K tokens）- 2024年価格
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
};

// Firecrawl 価格（実質: Hobby $190/年÷12÷3000 = $0.00528/credit）
const FIRECRAWL_PRICE_PER_PAGE = 0.00528;

export type EventType =
  | 'REGISTER'
  | 'LOGIN'
  | 'SUBSIDY_SEARCH'
  | 'CHAT_SESSION_START'
  | 'CHAT_MESSAGE'
  | 'DRAFT_GENERATE'
  | 'DRAFT_FINALIZE'
  | 'OPENAI_CALL'
  | 'FIRECRAWL_SCRAPE'
  | 'CRON_RUN'
  | 'CONSUMER_RUN'
  | 'CRAWL_SUCCESS'
  | 'CRAWL_FAILURE';

export type Provider = 'openai' | 'firecrawl' | 'aws' | 'internal' | 'jgrants';

export type Feature = 'chat' | 'draft' | 'extraction' | 'knowledge' | 'search' | 'auth' | 'cron';

export interface UsageEvent {
  userId?: string;
  companyId?: string;
  eventType: EventType;
  provider?: Provider;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  domain?: string;
  url?: string;
  pagesCount?: number;
  wordCount?: number;
  estimatedCostUsd?: number;
  feature?: Feature;
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * OpenAI コストを計算
 */
export function calculateOpenAICost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING['gpt-4o-mini'];
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Firecrawl コストを計算
 */
export function calculateFirecrawlCost(pagesCount: number): number {
  return pagesCount * FIRECRAWL_PRICE_PER_PAGE;
}

/**
 * イベントを記録
 */
export async function trackEvent(
  db: D1Database,
  event: UsageEvent
): Promise<void> {
  const id = uuidv4();
  const now = new Date().toISOString();

  // コスト自動計算
  let estimatedCost = event.estimatedCostUsd;
  if (!estimatedCost && event.provider === 'openai' && event.model) {
    estimatedCost = calculateOpenAICost(
      event.model,
      event.promptTokens || 0,
      event.completionTokens || 0
    );
  }
  if (!estimatedCost && event.provider === 'firecrawl' && event.pagesCount) {
    estimatedCost = calculateFirecrawlCost(event.pagesCount);
  }

  try {
    await db.prepare(`
      INSERT INTO usage_events (
        id, user_id, company_id, event_type, provider,
        model, prompt_tokens, completion_tokens, total_tokens,
        domain, url, pages_count, word_count,
        estimated_cost_usd, feature, success, error_code, error_message,
        duration_ms, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      event.userId || null,
      event.companyId || null,
      event.eventType,
      event.provider || null,
      event.model || null,
      event.promptTokens || null,
      event.completionTokens || null,
      event.totalTokens || (event.promptTokens || 0) + (event.completionTokens || 0) || null,
      event.domain || null,
      event.url || null,
      event.pagesCount || null,
      event.wordCount || null,
      estimatedCost || null,
      event.feature || null,
      event.success !== false ? 1 : 0,
      event.errorCode || null,
      event.errorMessage || null,
      event.durationMs || null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      now
    ).run();
  } catch (error) {
    // ログ記録失敗はアプリを止めない
    console.error('Failed to track event:', error);
  }
}

/**
 * ユーザーアクション系のショートカット
 */
export const trackUserEvent = {
  register: (db: D1Database, userId: string) =>
    trackEvent(db, { eventType: 'REGISTER', userId, feature: 'auth' }),

  login: (db: D1Database, userId: string) =>
    trackEvent(db, { eventType: 'LOGIN', userId, feature: 'auth' }),

  search: (db: D1Database, userId: string, companyId?: string, metadata?: Record<string, unknown>) =>
    trackEvent(db, { eventType: 'SUBSIDY_SEARCH', userId, companyId, feature: 'search', metadata }),

  chatStart: (db: D1Database, userId: string, companyId: string, metadata?: Record<string, unknown>) =>
    trackEvent(db, { eventType: 'CHAT_SESSION_START', userId, companyId, feature: 'chat', metadata }),

  chatMessage: (db: D1Database, userId: string, companyId: string) =>
    trackEvent(db, { eventType: 'CHAT_MESSAGE', userId, companyId, feature: 'chat' }),

  draftGenerate: (db: D1Database, userId: string, companyId: string, metadata?: Record<string, unknown>) =>
    trackEvent(db, { eventType: 'DRAFT_GENERATE', userId, companyId, feature: 'draft', metadata }),

  draftFinalize: (db: D1Database, userId: string, companyId: string) =>
    trackEvent(db, { eventType: 'DRAFT_FINALIZE', userId, companyId, feature: 'draft' }),
};

/**
 * OpenAI呼び出し記録
 */
export async function trackOpenAICall(
  db: D1Database,
  params: {
    userId?: string;
    companyId?: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    feature: Feature;
    success?: boolean;
    errorCode?: string;
    errorMessage?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await trackEvent(db, {
    eventType: 'OPENAI_CALL',
    provider: 'openai',
    ...params,
  });
}

/**
 * Firecrawl呼び出し記録
 */
export async function trackFirecrawlCall(
  db: D1Database,
  params: {
    url: string;
    domain?: string;
    pagesCount?: number;
    wordCount?: number;
    feature?: Feature;
    success?: boolean;
    errorCode?: string;
    errorMessage?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const domain = params.domain || new URL(params.url).hostname;
  await trackEvent(db, {
    eventType: 'FIRECRAWL_SCRAPE',
    provider: 'firecrawl',
    domain,
    feature: params.feature || 'knowledge',
    ...params,
  });
}

/**
 * Cron/Consumer実行記録
 */
export async function trackCronRun(
  db: D1Database,
  params: {
    success: boolean;
    durationMs: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await trackEvent(db, {
    eventType: 'CRON_RUN',
    provider: 'internal',
    feature: 'cron',
    ...params,
  });
}

export async function trackConsumerRun(
  db: D1Database,
  params: {
    success: boolean;
    durationMs: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await trackEvent(db, {
    eventType: 'CONSUMER_RUN',
    provider: 'internal',
    feature: 'cron',
    ...params,
  });
}

/**
 * Knowledge Pipeline Routes
 * 
 * Phase K1: JGrants → 外部URL抽出 → Firecrawl → D1/R2保存
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';
import { internalAuthMiddleware } from '../lib/internal-jwt';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// =============================================================================
// Types
// =============================================================================

interface SourceUrl {
  url_id: string;
  subsidy_id: string;
  url: string;
  url_hash: string;
  source_type: 'jgrants_detail' | 'secretariat' | 'prefecture' | 'city' | 'ministry' | 'portal' | 'other';
  doc_type?: string;
  status: 'pending' | 'ok' | 'error' | 'blocked' | 'needs_review';
  priority: number;
  crawl_depth: number;
}

interface ExtractSchemaV1 {
  schema_version: 'v1';
  source: {
    url: string;
    retrieved_at: string;
    source_type: string;
    title_guess?: string;
    language?: string;
  };
  summary: {
    title: string;
    one_liner: string;
    what_it_supports: string;
    target_audience?: string;
  };
  eligibility: {
    who_can_apply: string[];
    area: {
      scope: string;
      detail?: string[];
    };
    industry: {
      allowed: string[];
      not_allowed?: string[];
    };
    company_size: {
      employee_limit: string;
      capital_limit?: string;
      other_conditions?: string[];
    };
    disqualifiers?: string[];
  };
  funding: {
    subsidy_rate: string;
    limit_amount: {
      max: string;
      min?: string;
    };
    eligible_costs: string[];
    ineligible_costs?: string[];
    payment_flow?: string;
  };
  deadlines: {
    application_window: {
      start?: string;
      end?: string;
    };
    project_period?: {
      start?: string;
      end?: string;
    };
    notes?: string[];
  };
  required_documents: Array<{
    name: string;
    required_level: 'mandatory' | 'conditional' | 'optional';
    format?: string;
    how_to_get?: string;
    link?: string;
    notes?: string;
  }>;
  how_to_write?: {
    evaluation_points?: string[];
    common_mistakes?: string[];
    recommended_structure?: string[];
  };
  examples?: Array<{
    industry?: string;
    company_profile?: string;
    what_they_did?: string;
    cost_breakdown?: string;
    outcome?: string;
    source_quote?: string;
  }>;
  evidence?: Array<{
    field: string;
    quote: string;
    location_hint?: string;
  }>;
  quality: {
    confidence: number;
    warnings: string[];
    needs_human_review: boolean;
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * URLを正規化してハッシュを生成
 */
function normalizeAndHashUrl(url: string): { normalized: string; hash: string } {
  try {
    const urlObj = new URL(url);
    
    // フラグメント削除
    urlObj.hash = '';
    
    // UTMパラメータ削除
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    utmParams.forEach(param => urlObj.searchParams.delete(param));
    
    // 末尾スラッシュ統一（パスがルートでない場合は削除）
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // HTTP→HTTPS変換（可能な場合）
    if (urlObj.protocol === 'http:') {
      urlObj.protocol = 'https:';
    }
    
    const normalized = urlObj.toString();
    
    // SHA256ハッシュ生成
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    
    // Web Crypto APIでハッシュ
    // 同期的に生成できないため、一時的にbase64エンコードで代用
    const hash = btoa(normalized).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    
    return { normalized, hash };
  } catch {
    // 無効なURLの場合
    return { normalized: url, hash: btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32) };
  }
}

/**
 * ドメインからsource_typeを判定
 */
function detectSourceType(url: string): SourceUrl['source_type'] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // 都道府県・市区町村 (lg.jp)
    if (hostname.endsWith('.lg.jp')) {
      // 都道府県は通常 pref.xxx.lg.jp のパターン
      if (hostname.includes('pref.') || hostname.match(/^[a-z]+\.lg\.jp$/)) {
        return 'prefecture';
      }
      return 'city';
    }
    
    // 省庁・政府機関 (go.jp)
    if (hostname.endsWith('.go.jp')) {
      // 事務局系（中小機構など）
      if (hostname.includes('smrj') || hostname.includes('mirasapo') || hostname.includes('jizokukahojokin')) {
        return 'secretariat';
      }
      return 'ministry';
    }
    
    // ポータル系
    if (hostname.includes('jgrants') || hostname.includes('support-navi')) {
      return 'portal';
    }
    
    // 事務局・支援機関
    if (hostname.includes('ipa.go.jp') || hostname.includes('jetro')) {
      return 'secretariat';
    }
    
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * JSONからURL文字列を抽出
 */
function extractUrlsFromJson(obj: unknown, urls: Set<string> = new Set()): Set<string> {
  if (typeof obj === 'string') {
    // URL形式かチェック
    const urlPattern = /https?:\/\/[^\s"'<>]+/g;
    const matches = obj.match(urlPattern);
    if (matches) {
      matches.forEach(url => urls.add(url));
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => extractUrlsFromJson(item, urls));
  } else if (typeof obj === 'object' && obj !== null) {
    Object.values(obj).forEach(value => extractUrlsFromJson(value, urls));
  }
  return urls;
}

// =============================================================================
// API Routes
// =============================================================================

/**
 * POST /knowledge/subsidies/:subsidy_id/extract-urls
 * JGrants詳細から外部URLを抽出してsource_urlに登録
 */
app.post('/subsidies/:subsidy_id/extract-urls', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    // subsidy_cacheから詳細JSONを取得
    const subsidyCache = await DB.prepare(`
      SELECT id, title, detail_json FROM subsidy_cache WHERE id = ?
    `).bind(subsidy_id).first<{ id: string; title: string; detail_json: string }>();

    if (!subsidyCache) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Subsidy not found in cache' }
      }, 404);
    }

    let detailJson: Record<string, unknown> = {};
    try {
      detailJson = JSON.parse(subsidyCache.detail_json || '{}');
    } catch {
      // パース失敗
    }

    // URLを抽出
    const extractedUrls = extractUrlsFromJson(detailJson);
    
    // inquiry_urlを優先的に追加
    const inquiryUrl = (detailJson as Record<string, unknown>).inquiry_url as string | undefined;
    if (inquiryUrl && typeof inquiryUrl === 'string') {
      extractedUrls.add(inquiryUrl);
    }

    // subsidy_metadataにupsert
    const contentHash = btoa(JSON.stringify(detailJson)).substring(0, 64);
    await DB.prepare(`
      INSERT INTO subsidy_metadata (
        subsidy_id, title, inquiry_url, external_links, jgrants_raw_json, content_hash, last_seen_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(subsidy_id) DO UPDATE SET
        title = excluded.title,
        inquiry_url = excluded.inquiry_url,
        external_links = excluded.external_links,
        jgrants_raw_json = excluded.jgrants_raw_json,
        content_hash = excluded.content_hash,
        has_changes = CASE WHEN subsidy_metadata.content_hash != excluded.content_hash THEN 1 ELSE 0 END,
        last_seen_at = datetime('now'),
        updated_at = datetime('now')
    `).bind(
      subsidy_id,
      subsidyCache.title,
      inquiryUrl || null,
      JSON.stringify([...extractedUrls]),
      subsidyCache.detail_json,
      contentHash
    ).run();

    // source_urlに登録
    const insertedUrls: SourceUrl[] = [];
    for (const url of extractedUrls) {
      const { normalized, hash } = normalizeAndHashUrl(url);
      const sourceType = detectSourceType(url);
      const urlId = crypto.randomUUID();

      try {
        await DB.prepare(`
          INSERT INTO source_url (
            url_id, subsidy_id, url, url_hash, source_type, status, priority, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
          ON CONFLICT(url_hash) DO UPDATE SET
            subsidy_id = excluded.subsidy_id,
            updated_at = datetime('now')
        `).bind(
          urlId,
          subsidy_id,
          normalized,
          hash,
          sourceType,
          sourceType === 'jgrants_detail' ? 1 : (sourceType === 'secretariat' ? 2 : 5)
        ).run();

        insertedUrls.push({
          url_id: urlId,
          subsidy_id,
          url: normalized,
          url_hash: hash,
          source_type: sourceType,
          status: 'pending',
          priority: 5,
          crawl_depth: 0
        });
      } catch {
        // 重複無視
      }
    }

    return c.json<ApiResponse<{ extracted_count: number; urls: SourceUrl[] }>>({
      success: true,
      data: {
        extracted_count: insertedUrls.length,
        urls: insertedUrls
      }
    });
  } catch (error) {
    console.error('URL extraction error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'EXTRACTION_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/source-urls
 * クロール対象URLの一覧取得
 */
app.get('/source-urls', requireAuth, async (c) => {
  const { DB } = c.env;
  const status = c.req.query('status') || 'pending';
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  try {
    const urls = await DB.prepare(`
      SELECT * FROM source_url 
      WHERE status = ?
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).bind(status, limit).all<SourceUrl>();

    return c.json<ApiResponse<{ urls: SourceUrl[]; count: number }>>({
      success: true,
      data: {
        urls: urls.results || [],
        count: urls.results?.length || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/crawl/:url_id
 * 特定URLをFirecrawlでクロール（手動トリガー）
 */
app.post('/crawl/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB } = c.env;
  const firecrawlApiKey = c.env.FIRECRAWL_API_KEY;

  if (!firecrawlApiKey) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'FIRECRAWL_API_KEY not configured' }
    }, 500);
  }

  try {
    // URLを取得
    const sourceUrl = await DB.prepare(`
      SELECT * FROM source_url WHERE url_id = ?
    `).bind(url_id).first<SourceUrl>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    // crawl_jobを作成
    const jobId = crypto.randomUUID();
    await DB.prepare(`
      INSERT INTO crawl_job (job_id, url_id, subsidy_id, job_type, status, created_at, updated_at)
      VALUES (?, ?, ?, 'scrape', 'processing', datetime('now'), datetime('now'))
    `).bind(jobId, url_id, sourceUrl.subsidy_id).run();

    // Firecrawl APIを呼び出し
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlApiKey}`
      },
      body: JSON.stringify({
        url: sourceUrl.url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 2000
      })
    });

    if (!firecrawlResponse.ok) {
      const errorText = await firecrawlResponse.text();
      throw new Error(`Firecrawl API error: ${firecrawlResponse.status} - ${errorText}`);
    }

    const crawlResult = await firecrawlResponse.json() as {
      success: boolean;
      data?: {
        markdown?: string;
        html?: string;
        metadata?: {
          title?: string;
          language?: string;
        };
      };
    };

    if (!crawlResult.success || !crawlResult.data) {
      throw new Error('Firecrawl returned no data');
    }

    // コンテンツハッシュを計算
    const contentHash = btoa(crawlResult.data.markdown || '').substring(0, 64);

    // source_urlを更新
    await DB.prepare(`
      UPDATE source_url SET
        status = 'ok',
        content_hash = ?,
        last_crawled_at = datetime('now'),
        error_count = 0,
        updated_at = datetime('now')
      WHERE url_id = ?
    `).bind(contentHash, url_id).run();

    // doc_objectを作成/更新
    const docId = crypto.randomUUID();
    const wordCount = (crawlResult.data.markdown || '').length;
    
    await DB.prepare(`
      INSERT INTO doc_object (
        id, url_id, subsidy_id, extract_version, extracted_at, 
        word_count, language, created_at, updated_at
      ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(url_id) DO UPDATE SET
        word_count = excluded.word_count,
        language = excluded.language,
        updated_at = datetime('now')
    `).bind(
      docId,
      url_id,
      sourceUrl.subsidy_id,
      wordCount,
      crawlResult.data.metadata?.language || 'ja'
    ).run();

    // crawl_jobを完了
    await DB.prepare(`
      UPDATE crawl_job SET
        status = 'completed',
        completed_at = datetime('now'),
        result = ?,
        updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(JSON.stringify({
      markdown_length: crawlResult.data.markdown?.length || 0,
      title: crawlResult.data.metadata?.title
    }), jobId).run();

    return c.json<ApiResponse<{
      job_id: string;
      url_id: string;
      status: string;
      markdown_length: number;
      title?: string;
    }>>({
      success: true,
      data: {
        job_id: jobId,
        url_id,
        status: 'completed',
        markdown_length: crawlResult.data.markdown?.length || 0,
        title: crawlResult.data.metadata?.title
      }
    });
  } catch (error) {
    console.error('Crawl error:', error);

    // エラー記録
    await DB.prepare(`
      UPDATE source_url SET
        status = 'error',
        last_error = ?,
        error_count = error_count + 1,
        updated_at = datetime('now')
      WHERE url_id = ?
    `).bind(String(error), url_id).run();

    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CRAWL_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * POST /knowledge/extract/:url_id
 * クロール済みコンテンツからSchema v1で構造化抽出
 */
app.post('/extract/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB } = c.env;
  
  // OpenAI APIキーはAWS Lambda経由で使用するため、
  // ここでは簡易的なルール抽出のみ実装
  // 本格的なLLM抽出はAWS側で実行

  try {
    const sourceUrl = await DB.prepare(`
      SELECT su.*, do.word_count
      FROM source_url su
      LEFT JOIN doc_object do ON su.url_id = do.url_id
      WHERE su.url_id = ?
    `).bind(url_id).first<SourceUrl & { word_count?: number }>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    if (sourceUrl.status !== 'ok') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_CRAWLED', message: 'URL has not been successfully crawled yet' }
      }, 400);
    }

    // 抽出ジョブをAWSに送信（既存のjobs APIを使用）
    return c.json<ApiResponse<{ message: string; url_id: string }>>({
      success: true,
      data: {
        message: 'Use /api/jobs/subsidies/{subsidy_id}/ingest to trigger LLM extraction via AWS',
        url_id
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'EXTRACT_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/summary/:subsidy_id
 * 補助金のナレッジサマリーを取得（壁打ちBot用）
 */
app.get('/summary/:subsidy_id', requireAuth, async (c) => {
  const { subsidy_id } = c.req.param();
  const { DB } = c.env;

  try {
    // knowledge_summaryから取得
    const summary = await DB.prepare(`
      SELECT * FROM knowledge_summary WHERE subsidy_id = ?
    `).bind(subsidy_id).first();

    if (!summary) {
      // サマリーがない場合、eligibility_rulesから簡易生成
      const rules = await DB.prepare(`
        SELECT * FROM eligibility_rules WHERE subsidy_id = ? ORDER BY category
      `).bind(subsidy_id).all();

      const extraction = await DB.prepare(`
        SELECT * FROM eligibility_extractions WHERE subsidy_id = ?
      `).bind(subsidy_id).first();

      return c.json<ApiResponse<{
        subsidy_id: string;
        has_summary: boolean;
        rules_count: number;
        rules: unknown[];
        extraction?: unknown;
      }>>({
        success: true,
        data: {
          subsidy_id,
          has_summary: false,
          rules_count: rules.results?.length || 0,
          rules: rules.results || [],
          extraction: extraction || undefined
        }
      });
    }

    return c.json<ApiResponse<unknown>>({
      success: true,
      data: summary
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * GET /knowledge/stats
 * ナレッジパイプラインの統計情報
 */
app.get('/stats', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const stats = await DB.batch([
      DB.prepare(`SELECT COUNT(*) as count FROM subsidy_metadata`),
      DB.prepare(`SELECT COUNT(*) as count FROM source_url`),
      DB.prepare(`SELECT status, COUNT(*) as count FROM source_url GROUP BY status`),
      DB.prepare(`SELECT COUNT(*) as count FROM doc_object`),
      DB.prepare(`SELECT COUNT(*) as count FROM knowledge_summary`),
      DB.prepare(`SELECT COUNT(*) as count FROM crawl_job WHERE status = 'pending'`)
    ]);

    return c.json<ApiResponse<{
      subsidies: number;
      source_urls: number;
      url_status: Record<string, number>;
      documents: number;
      summaries: number;
      pending_jobs: number;
    }>>({
      success: true,
      data: {
        subsidies: (stats[0].results?.[0] as { count: number })?.count || 0,
        source_urls: (stats[1].results?.[0] as { count: number })?.count || 0,
        url_status: Object.fromEntries(
          (stats[2].results as Array<{ status: string; count: number }> || [])
            .map(r => [r.status, r.count])
        ),
        documents: (stats[3].results?.[0] as { count: number })?.count || 0,
        summaries: (stats[4].results?.[0] as { count: number })?.count || 0,
        pending_jobs: (stats[5].results?.[0] as { count: number })?.count || 0
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'DB_ERROR', message: String(error) }
    }, 500);
  }
});

// =============================================================================
// Internal API (for Cron Jobs)
// =============================================================================

/**
 * POST /knowledge/internal/sync-jgrants
 * JGrantsから差分同期（Cron Trigger用）
 */
app.post('/internal/sync-jgrants', internalAuthMiddleware(['knowledge:sync']), async (c) => {
  const { DB } = c.env;
  
  // TODO: JGrants APIから最新データを取得して差分検知
  // Phase K2で実装予定
  
  return c.json<ApiResponse<{ message: string }>>({
    success: true,
    data: {
      message: 'JGrants sync not yet implemented - Phase K2'
    }
  });
});

/**
 * POST /knowledge/internal/process-queue
 * クロールキューを処理（Cron Trigger用）
 */
app.post('/internal/process-queue', internalAuthMiddleware(['knowledge:process']), async (c) => {
  const { DB } = c.env;
  const batchSize = 10;
  
  try {
    // pending状態のURLを取得
    const pendingUrls = await DB.prepare(`
      SELECT * FROM source_url 
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).bind(batchSize).all<SourceUrl>();

    if (!pendingUrls.results || pendingUrls.results.length === 0) {
      return c.json<ApiResponse<{ processed: number; message: string }>>({
        success: true,
        data: {
          processed: 0,
          message: 'No pending URLs in queue'
        }
      });
    }

    // TODO: Firecrawlでバッチ処理
    // 現時点ではカウントのみ返す
    
    return c.json<ApiResponse<{ pending_count: number; message: string }>>({
      success: true,
      data: {
        pending_count: pendingUrls.results.length,
        message: 'Queue processing not yet implemented - use /knowledge/crawl/:url_id for manual crawl'
      }
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'QUEUE_ERROR', message: String(error) }
    }, 500);
  }
});

export default app;

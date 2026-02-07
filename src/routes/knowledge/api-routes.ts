/**
 * Knowledge Pipeline - API Routes
 * 
 * POST /subsidies/:subsidy_id/extract-urls - URL抽出
 * GET  /source-urls                        - ソースURL一覧
 * POST /crawl/:url_id                      - クロール実行
 * GET  /summary/:subsidy_id                - サマリー取得
 * GET  /stats                              - 統計
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { sha256Hex, saveRawToR2, extractDomainKey } from './_helpers';
import type { R2SaveResult } from './_helpers';

const apiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

apiRoutes.post('/subsidies/:subsidy_id/extract-urls', requireAuth, async (c) => {
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
    const contentHash = safeHash(JSON.stringify(detailJson));
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
apiRoutes.get('/source-urls', requireAuth, async (c) => {
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
 * 指定URLをFirecrawlでスクレイプしてR2/D1に保存
 * 
 * 処理フロー:
 * 1. ドメインポリシー確認（blocked/rate limit）
 * 2. Firecrawl API呼び出し
 * 3. R2にraw Markdownを保存
 * 4. D1にメタデータを保存
 * 5. 連続失敗時は自動blocked化
 */
apiRoutes.post('/crawl/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB, R2_KNOWLEDGE } = c.env;
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
    `).bind(url_id).first<SourceUrl & { domain_key?: string }>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    // ドメインキーを取得/設定
    const domainKey = sourceUrl.domain_key || extractDomainKey(sourceUrl.url);
    
    // ドメインポリシーを確認（テーブルが存在する場合のみ）
    let policy: { enabled: number; notes?: string } | null = null;
    try {
      policy = await DB.prepare(`
        SELECT enabled, notes FROM domain_policy WHERE domain_key = ?
      `).bind(domainKey).first();
    } catch {
      // domain_policyテーブルがまだ無い場合は無視
    }

    // ドメインがブロックされている場合
    if (policy && policy.enabled === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { 
          code: 'DOMAIN_BLOCKED', 
          message: `Domain ${domainKey} is blocked: ${policy.notes || 'No reason specified'}` 
        }
      }, 403);
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
      const errorCode = firecrawlResponse.status.toString();
      
      // ドメインポリシーの失敗統計を更新（テーブルが存在する場合）
      try {
        await DB.prepare(`
          INSERT INTO domain_policy (domain_key, enabled, failure_count, last_failure_at, last_error_code, notes)
          VALUES (?, 1, 1, datetime('now'), ?, 'Auto-created on first failure')
          ON CONFLICT(domain_key) DO UPDATE SET
            failure_count = failure_count + 1,
            last_failure_at = datetime('now'),
            last_error_code = ?
        `).bind(domainKey, errorCode, errorCode).run();
      } catch {
        // テーブルが無い場合は無視
      }
      
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

    const markdown = crawlResult.data.markdown || '';
    const wordCount = markdown.length;
    const language = crawlResult.data.metadata?.language || 'ja';
    
    // SHA-256ハッシュを計算
    const contentHash = await sha256Hex(markdown);
    const urlHashResult = await normalizeAndHashUrlAsync(sourceUrl.url);
    
    // R2に保存（R2が設定されている場合）
    let r2Result: R2SaveResult | null = null;
    let storageBackend: 'd1_inline' | 'r2' = 'd1_inline';
    
    if (R2_KNOWLEDGE) {
      try {
        r2Result = await saveRawToR2(
          R2_KNOWLEDGE,
          sourceUrl.subsidy_id,
          urlHashResult.hash,
          markdown
        );
        storageBackend = 'r2';
      } catch (r2Error) {
        console.error('R2 save error (falling back to D1):', r2Error);
        // R2保存失敗時はD1にインライン保存
      }
    }

    // source_urlを更新（ドメインキーも設定）
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
    
    if (storageBackend === 'r2' && r2Result) {
      // R2保存成功 - 新しいカラムを使用
      try {
        await DB.prepare(`
          INSERT INTO doc_object (
            id, url_id, subsidy_id, extract_version, extracted_at, 
            word_count, language, storage_backend,
            r2_key_raw, r2_raw_size, r2_uploaded_at, content_hash_sha256,
            created_at, updated_at
          ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, 'r2', ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(url_id) DO UPDATE SET
            word_count = excluded.word_count,
            language = excluded.language,
            storage_backend = 'r2',
            r2_key_raw = excluded.r2_key_raw,
            r2_raw_size = excluded.r2_raw_size,
            r2_uploaded_at = excluded.r2_uploaded_at,
            content_hash_sha256 = excluded.content_hash_sha256,
            updated_at = datetime('now')
        `).bind(
          docId,
          url_id,
          sourceUrl.subsidy_id,
          wordCount,
          language,
          r2Result.key,
          r2Result.size,
          r2Result.uploaded_at,
          contentHash
        ).run();
      } catch {
        // 新しいカラムが無い場合はフォールバック
        await DB.prepare(`
          INSERT INTO doc_object (
            id, url_id, subsidy_id, extract_version, extracted_at, 
            word_count, language, created_at, updated_at
          ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(url_id) DO UPDATE SET
            word_count = excluded.word_count,
            language = excluded.language,
            updated_at = datetime('now')
        `).bind(docId, url_id, sourceUrl.subsidy_id, wordCount, language).run();
      }
    } else {
      // D1インライン保存（R2未設定またはエラー時）- 従来のスキーマ互換
      await DB.prepare(`
        INSERT INTO doc_object (
          id, url_id, subsidy_id, extract_version, extracted_at, 
          word_count, language, created_at, updated_at
        ) VALUES (?, ?, ?, 'v1', datetime('now'), ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(url_id) DO UPDATE SET
          word_count = excluded.word_count,
          language = excluded.language,
          updated_at = datetime('now')
      `).bind(docId, url_id, sourceUrl.subsidy_id, wordCount, language).run();
    }

    // ドメインポリシーの成功統計を更新（テーブルが存在する場合）
    try {
      await DB.prepare(`
        INSERT INTO domain_policy (domain_key, enabled, success_count, last_success_at, total_requests, notes)
        VALUES (?, 1, 1, datetime('now'), 1, 'Auto-created on first success')
        ON CONFLICT(domain_key) DO UPDATE SET
          success_count = success_count + 1,
          total_requests = total_requests + 1,
          last_success_at = datetime('now')
      `).bind(domainKey).run();
    } catch {
      // テーブルが無い場合は無視
    }

    // crawl_jobを完了
    await DB.prepare(`
      UPDATE crawl_job SET
        status = 'completed',
        completed_at = datetime('now'),
        result = ?,
        updated_at = datetime('now')
      WHERE job_id = ?
    `).bind(JSON.stringify({
      markdown_length: wordCount,
      title: crawlResult.data.metadata?.title,
      storage_backend: storageBackend,
      r2_key: r2Result?.key
    }), jobId).run();

    return c.json<ApiResponse<{
      job_id: string;
      url_id: string;
      status: string;
      markdown_length: number;
      title?: string;
      storage_backend: string;
      r2_key?: string;
    }>>({
      success: true,
      data: {
        job_id: jobId,
        url_id,
        status: 'completed',
        markdown_length: wordCount,
        title: crawlResult.data.metadata?.title,
        storage_backend: storageBackend,
        r2_key: r2Result?.key
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

// K2: 旧 /extract/:url_id はK2実装（下部）に統合済み
// AWS委譲は必要な場合に /api/jobs/subsidies/{subsidy_id}/ingest を使用

/**
 * GET /knowledge/summary/:subsidy_id
 * 補助金のナレッジサマリーを取得（壁打ちBot用）
 */
apiRoutes.get('/summary/:subsidy_id', requireAuth, async (c) => {
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
apiRoutes.get('/stats', requireAuth, async (c) => {
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



export default apiRoutes;

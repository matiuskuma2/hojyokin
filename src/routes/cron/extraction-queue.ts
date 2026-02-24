/**
 * Cron: 抽出キュー管理
 * 
 * POST /enqueue-extractions - 抽出キューへ投入
 * POST /consume-extractions - 抽出キュー消化
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { verifyCronSecret, startCronRun, finishCronRun } from './_helpers';
import { shardKey16, currentShardByHour } from '../../lib/shard';
import { checkWallChatReadyFromJson, selectBestPdfs, scorePdfUrl } from '../../lib/wall-chat-ready';
import { logFirecrawlCost, logOpenAICost } from '../../lib/cost/cost-logger';
import { extractAndUpdateSubsidy, type ExtractSource } from '../../lib/pdf/pdf-extract-router';
import { checkCooldown, DEFAULT_COOLDOWN_POLICY } from '../../lib/pdf/extraction-cooldown';
import { recordCostGuardFailure } from '../../lib/failures/feed-failure-writer';

const extractionQueue = new Hono<{ Bindings: Env; Variables: Variables }>();

extractionQueue.post('/enqueue-extractions', async (c) => {
  const db = c.env.DB;

  const auth = verifyCronSecret(c);
  if (!auth.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: auth.error!,
    }, auth.error!.status);
  }

  // 1回で入れすぎない
  const MAX_ENQUEUE_PER_TYPE = 500;

  const now = new Date().toISOString();

  // 1) shard_key未付与の行に shard_key を付ける（増分でOK）
  const candidates = await db.prepare(`
    SELECT id FROM subsidy_cache
    WHERE shard_key IS NULL
    LIMIT 1000
  `).all<{ id: string }>();

  let shardUpdated = 0;
  for (const row of candidates.results || []) {
    const sk = shardKey16(row.id);
    await db.prepare(`UPDATE subsidy_cache SET shard_key = ? WHERE id = ?`)
      .bind(sk, row.id).run();
    shardUpdated++;
  }

  // 2) job_typeごとにキュー投入（INSERT OR IGNORE）

  // A) extract_forms: wall_chat_ready=0 かつ detailUrl/pdfUrlsあり
  const exForms = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
    SELECT 
      lower(hex(randomblob(16))),
      sc.id,
      sc.shard_key,
      'extract_forms',
      ?,
      'queued',
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND sc.detail_json IS NOT NULL AND sc.detail_json != '{}'
      AND (
        json_extract(sc.detail_json, '$.detailUrl') IS NOT NULL
        OR (json_extract(sc.detail_json, '$.pdfUrls') IS NOT NULL AND json_array_length(json_extract(sc.detail_json, '$.pdfUrls')) > 0)
      )
    ORDER BY sc.cached_at DESC
    LIMIT ?
  `).bind(JOB_PRIORITY.extract_forms, now, now, MAX_ENQUEUE_PER_TYPE).run();

  // B) enrich_shigoto: tokyo-shigoto で未READY & detailUrlあり
  const exShigoto = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
    SELECT 
      lower(hex(randomblob(16))),
      sc.id,
      sc.shard_key,
      'enrich_shigoto',
      ?,
      'queued',
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.source = 'tokyo-shigoto'
      AND sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND json_extract(sc.detail_json, '$.detailUrl') IS NOT NULL
    ORDER BY sc.cached_at DESC
    LIMIT ?
  `).bind(JOB_PRIORITY.enrich_shigoto, now, now, MAX_ENQUEUE_PER_TYPE).run();

  // C) enrich_jgrants: jgrants でdetail_jsonが薄い & Active only
  // 2026-01-27 確定方針: acceptance_end_datetime IS NOT NULL AND > now のみ
  const exJgrants = await db.prepare(`
    INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
    SELECT 
      lower(hex(randomblob(16))),
      sc.id,
      sc.shard_key,
      'enrich_jgrants',
      ?,
      'queued',
      ?,
      ?
    FROM subsidy_cache sc
    WHERE sc.source = 'jgrants'
      AND sc.wall_chat_ready = 0
      AND sc.shard_key IS NOT NULL
      AND (sc.detail_json IS NULL OR sc.detail_json = '{}' OR LENGTH(sc.detail_json) < 100)
      AND sc.acceptance_end_datetime IS NOT NULL 
      AND sc.acceptance_end_datetime > datetime('now')
    ORDER BY sc.acceptance_end_datetime ASC
    LIMIT ?
  `).bind(JOB_PRIORITY.enrich_jgrants, now, now, MAX_ENQUEUE_PER_TYPE).run();

  return c.json<ApiResponse<{
    message: string;
    updated_shard_key_rows: number;
    enqueued: { extract_forms: number; enrich_shigoto: number; enrich_jgrants: number };
  }>>({
    success: true,
    data: {
      message: 'enqueue ok',
      updated_shard_key_rows: shardUpdated,
      enqueued: {
        extract_forms: exForms.meta?.changes || 0,
        enrich_shigoto: exShigoto.meta?.changes || 0,
        enrich_jgrants: exJgrants.meta?.changes || 0,
      },
    },
  });
});

type ConsumeJob = {
  id: string;
  subsidy_id: string;
  shard_key: number;
  job_type: EnqueueJobType;
  attempts: number;
  max_attempts: number;
};

// 1回の消化上限
// ★ v5.0: extract_pdf のFirecrawl+OpenAI呼び出しが各10-20秒かかるため
// Pages Functions 120秒制限内に収めるため1件に限定（毎時実行で24件/日）
const CONSUME_BATCH = 1;
const LEASE_MINUTES = 8;          // リース期限
const LEASE_OWNER = 'pages-cron'; // ざっくり識別

/**
 * POST /api/cron/consume-extractions
 * 
 * extraction_queue から shard 単位でジョブを取り出して処理
 * ?shard=N で指定可能（省略時は時刻から自動決定）
 */
extractionQueue.post('/consume-extractions', async (c) => {
  const db = c.env.DB;
  const env = c.env;

  const auth = verifyCronSecret(c);
  if (!auth.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: auth.error!,
    }, auth.error!.status);
  }

  // ★ v4.0: cron_runs ログ記録
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'consume-extractions', 'cron');
  } catch (logErr) {
    console.warn('[consume-extractions] Failed to start cron_run log:', logErr);
  }

  // shard指定がなければ全shardから取得（★ v4.0: shard制限を撤廃）
  const q = c.req.query();
  const specificShard = q.shard !== undefined 
    ? Math.max(0, Math.min(63, parseInt(q.shard, 10) || 0))
    : null; // null = 全shardから取得

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60 * 1000).toISOString();

  // 0) 期限切れleasedを回収（ISO形式で比較）
  const nowIso = now.toISOString();
  await db.prepare(`
    UPDATE extraction_queue
    SET status='queued', lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
    WHERE status='leased' AND lease_until IS NOT NULL AND lease_until < ?
  `).bind(nowIso).run();

  // 1) ★ v4.0: shard指定時はshard絞り、未指定時は全shardからqueuedを取得
  let queued;
  if (specificShard !== null) {
    queued = await db.prepare(`
      SELECT id, subsidy_id, shard_key, job_type, attempts, max_attempts
      FROM extraction_queue
      WHERE shard_key = ?
        AND status = 'queued'
      ORDER BY priority ASC, updated_at ASC
      LIMIT ?
    `).bind(specificShard, CONSUME_BATCH).all<ConsumeJob>();
  } else {
    queued = await db.prepare(`
      SELECT id, subsidy_id, shard_key, job_type, attempts, max_attempts
      FROM extraction_queue
      WHERE status = 'queued'
      ORDER BY priority ASC, updated_at ASC
      LIMIT ?
    `).bind(CONSUME_BATCH).all<ConsumeJob>();
  }

  const jobs = queued.results || [];
  if (jobs.length === 0) {
    if (runId) {
      try {
        await finishCronRun(db, runId, 'success', {
          items_processed: 0,
          metadata: { shard: specificShard ?? 'all', message: 'no jobs' },
        });
      } catch (e) { console.warn('[consume-extractions] finishCronRun error:', e); }
    }
    return c.json<ApiResponse<{ shard: number | string; processed: number; message: string }>>({
      success: true,
      data: { shard: specificShard ?? 'all', processed: 0, message: 'no jobs' },
    });
  }

  // 2) リース獲得（原子的に leased へ）
  const leasedIds: string[] = [];
  for (const job of jobs) {
    const res = await db.prepare(`
      UPDATE extraction_queue
      SET status='leased', lease_owner=?, lease_until=?, updated_at=datetime('now')
      WHERE id=? AND status='queued'
    `).bind(LEASE_OWNER, leaseUntil, job.id).run();

    if ((res.meta?.changes || 0) === 1) leasedIds.push(job.id);
  }

  if (leasedIds.length === 0) {
    return c.json<ApiResponse<{ shard: number | string; processed: number; message: string }>>({
      success: true,
      data: { shard: specificShard ?? 'all', processed: 0, message: 'lease race lost' },
    });
  }

  // 3) 実処理（job_typeごとに処理）
  let done = 0;
  let failed = 0;

  for (const queueId of leasedIds) {
    const job = jobs.find(j => j.id === queueId);
    if (!job) continue;

    try {
      // job_typeに応じた処理
      if (job.job_type === 'extract_forms') {
        // 既存の extractAndUpdateSubsidy を呼ぶ
        const subsidy = await db.prepare(`
          SELECT id, source, title, detail_json
          FROM subsidy_cache WHERE id = ?
        `).bind(job.subsidy_id).first<{
          id: string;
          source: string;
          title: string;
          detail_json: string | null;
        }>();

        if (subsidy) {
          let detail: any = {};
          try {
            detail = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          } catch { detail = {}; }

          const detailUrl = detail.detailUrl || null;
          const pdfUrls = detail.pdfUrls || detail.pdf_urls || [];

          if (detailUrl || (Array.isArray(pdfUrls) && pdfUrls.length > 0)) {
            // cooldown チェック
            const cooldown = await checkCooldown(db, subsidy.id, DEFAULT_COOLDOWN_POLICY);

            const extractSource: ExtractSource = {
              subsidyId: subsidy.id,
              source: subsidy.source,
              title: subsidy.title,
              detailUrl,
              pdfUrls: Array.isArray(pdfUrls) ? pdfUrls : [],
              existingDetailJson: subsidy.detail_json,
            };

            const extractResult = await extractAndUpdateSubsidy(extractSource, {
              FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY,
              GOOGLE_CLOUD_API_KEY: env.GOOGLE_CLOUD_API_KEY,
              allowFirecrawl: cooldown.allowFirecrawl,
              allowVision: cooldown.allowVision,
              DB: db, // P0: DB を必ず渡す（Freeze-COST-2）
              sourceId: subsidy.source,
            });

            // P0: CostGuard 発生時は feed_failures に落とす（Freeze-3）
            try {
              const m = extractResult.metrics;
              const anyUrl = detailUrl || (pdfUrls?.[0] as string) || '';
              
              if (m.firecrawlBlockedByCostGuard) {
                await recordCostGuardFailure(db, {
                  subsidy_id: subsidy.id,
                  source_id: subsidy.source,
                  url: anyUrl,
                  stage: 'pdf',
                  message: 'COST_GUARD_DB_MISSING: Firecrawl blocked because env.DB was missing (Freeze-COST-2)',
                });
              }
              if (m.visionBlockedByCostGuard) {
                await recordCostGuardFailure(db, {
                  subsidy_id: subsidy.id,
                  source_id: subsidy.source,
                  url: anyUrl,
                  stage: 'pdf',
                  message: 'COST_GUARD_DB_MISSING: Vision OCR blocked because env.DB was missing (Freeze-COST-2)',
                });
              }
            } catch (e) {
              console.warn('[cron/consume-extractions] failed to record CostGuard feed_failures:', e);
            }

            // 成功/電子申請検出時はDB更新
            if (extractResult.success || extractResult.isElectronicApplication) {
              await db.prepare(`
                UPDATE subsidy_cache 
                SET detail_json = ?, wall_chat_ready = ?, wall_chat_missing = ?
                WHERE id = ?
              `).bind(
                extractResult.newDetailJson,
                extractResult.wallChatReady ? 1 : 0,
                JSON.stringify(extractResult.wallChatMissing),
                subsidy.id
              ).run();
            }
          }
        }
      }
      // enrich_jgrants: JGrants API から詳細取得
      if (job.job_type === 'enrich_jgrants') {
        const subsidy = await db.prepare(`
          SELECT id, title, detail_json
          FROM subsidy_cache WHERE id = ? AND source = 'jgrants'
        `).bind(job.subsidy_id).first<{
          id: string;
          title: string;
          detail_json: string | null;
        }>();

        if (subsidy) {
          const JGRANTS_DETAIL_API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id';
          const response = await fetch(`${JGRANTS_DETAIL_API}/${subsidy.id}`, {
            headers: { 'Accept': 'application/json' },
          });

          if (response.ok) {
            const data = await response.json() as any;
            const subsidyData = data.result?.[0] || data.result || data;

            if (subsidyData && subsidyData.detail) {
              const detailJson: Record<string, any> = {};

              // 概要
              if (subsidyData.detail && subsidyData.detail.length > 20) {
                detailJson.overview = subsidyData.detail
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 2000);
              }

              // 申請要件（文字列でない場合は JSON.stringify で変換）
              const rawReq = subsidyData.target_detail || subsidyData.outline_of_grant;
              if (rawReq) {
                const reqStr = typeof rawReq === 'string' ? rawReq : JSON.stringify(rawReq);
                const reqText = reqStr
                  .replace(/<[^>]+>/g, '\n')
                  .replace(/&nbsp;/g, ' ')
                  .trim();
                detailJson.application_requirements = reqText.split('\n')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length >= 5 && s.length <= 300)
                  .slice(0, 20);
              }

              // 対象経費（文字列でない場合は JSON.stringify で変換）
              if (subsidyData.usage_detail) {
                const usageStr = typeof subsidyData.usage_detail === 'string' 
                  ? subsidyData.usage_detail 
                  : JSON.stringify(subsidyData.usage_detail);
                const expText = usageStr
                  .replace(/<[^>]+>/g, '\n')
                  .replace(/&nbsp;/g, ' ')
                  .trim();
                detailJson.eligible_expenses = expText.split('\n')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length >= 5)
                  .slice(0, 20);
              }

              // 必要書類・PDF URL
              if (subsidyData.application_form && Array.isArray(subsidyData.application_form)) {
                detailJson.required_documents = subsidyData.application_form
                  .map((f: any) => f.name || f.title || f)
                  .filter((s: any) => typeof s === 'string' && s.length >= 2)
                  .slice(0, 20);
                detailJson.pdf_urls = subsidyData.application_form
                  .filter((f: any) => f.url && f.url.endsWith('.pdf'))
                  .map((f: any) => f.url);
              }

              // 締切・補助金情報
              if (subsidyData.acceptance_end_datetime) {
                detailJson.acceptance_end_datetime = subsidyData.acceptance_end_datetime;
              }
              if (subsidyData.subsidy_max_limit) {
                detailJson.subsidy_max_limit = subsidyData.subsidy_max_limit;
              }
              if (subsidyData.subsidy_rate) {
                detailJson.subsidy_rate = subsidyData.subsidy_rate;
              }
              if (subsidyData.front_subsidy_detail_page_url) {
                detailJson.related_url = subsidyData.front_subsidy_detail_page_url;
              }

              // マージして保存
              const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
              const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
              `).bind(JSON.stringify(merged), subsidy.id).run();

              // WALL_CHAT_READY 判定
              const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
              const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
              if (readyResult.ready) {
                await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                  .bind(subsidy.id).run();
              }
            }
          }
        }
      }

      // extract_pdf: PDFからFirecrawl+OpenAIで構造化データ抽出
      // 参照URLがある場合はそこからPDFを収集することも試みる
      if (job.job_type === 'extract_pdf') {
        const subsidy = await db.prepare(`
          SELECT id, title, detail_json
          FROM subsidy_cache WHERE id = ?
        `).bind(job.subsidy_id).first<{
          id: string;
          title: string;
          detail_json: string | null;
        }>();

        if (subsidy) {
          let detail: any = {};
          try {
            detail = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          } catch { detail = {}; }

          let pdfUrls = detail.pdf_urls || [];
          
          // 参照URLからPDFを収集（pdf_urlsが空または少ない場合）
          if ((!Array.isArray(pdfUrls) || pdfUrls.length < 3) && Array.isArray(detail.reference_urls)) {
            const firecrawlKey = env.FIRECRAWL_API_KEY;
            
            for (const refUrl of detail.reference_urls.slice(0, 2)) { // 最大2つの参照URLを処理
              try {
                console.log(`[extract_pdf] Scraping reference URL: ${refUrl}`);
                
                // HTMLを取得（Firecrawlまたは直接fetch）
                let pageHtml = '';
                
                if (firecrawlKey) {
                  const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${firecrawlKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: refUrl, formats: ['html'] }),
                  });
                  
                  if (fcResponse.ok) {
                    const fcData = await fcResponse.json() as any;
                    pageHtml = fcData.data?.html || '';
                  }
                } else {
                  // Firecrawlがない場合は直接fetch
                  const response = await fetch(refUrl, {
                    headers: {
                      'Accept': 'text/html',
                      'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
                    },
                  });
                  if (response.ok) {
                    pageHtml = await response.text();
                  }
                }
                
                // HTMLからPDFリンクを抽出
                if (pageHtml) {
                  const pdfPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
                  let match;
                  const baseUrl = new URL(refUrl);
                  
                  while ((match = pdfPattern.exec(pageHtml)) !== null) {
                    let pdfLink = match[1];
                    // 相対URLを絶対URLに変換
                    if (pdfLink.startsWith('./')) {
                      pdfLink = `${baseUrl.origin}${baseUrl.pathname.replace(/\/[^/]*$/, '')}/${pdfLink.substring(2)}`;
                    } else if (pdfLink.startsWith('/')) {
                      pdfLink = `${baseUrl.origin}${pdfLink}`;
                    } else if (!pdfLink.startsWith('http')) {
                      pdfLink = `${baseUrl.origin}${baseUrl.pathname.replace(/\/[^/]*$/, '')}/${pdfLink}`;
                    }
                    
                    if (!pdfUrls.includes(pdfLink)) {
                      pdfUrls.push(pdfLink);
                      console.log(`[extract_pdf] Found PDF: ${pdfLink}`);
                    }
                  }
                }
              } catch (e) {
                console.warn(`[extract_pdf] Failed to scrape reference URL ${refUrl}:`, e);
              }
            }
            
            // 新しいPDFが見つかったらdetail_jsonを更新
            if (pdfUrls.length > (detail.pdf_urls?.length || 0)) {
              detail.pdf_urls = [...new Set(pdfUrls)];
              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                WHERE id = ?
              `).bind(JSON.stringify(detail), subsidy.id).run();
              console.log(`[extract_pdf] Updated pdf_urls for ${subsidy.id}: ${pdfUrls.length} PDFs`);
            }
          }
          
          if (Array.isArray(pdfUrls) && pdfUrls.length > 0) {
            const firecrawlKey = env.FIRECRAWL_API_KEY;
            const openaiKey = env.OPENAI_API_KEY;
            
            // v4: PDF選別スコアリングで公募要領を優先
            // attachments情報があれば使う（ファイル名でスコアリング精度向上）
            const attachments = detail.attachments as Array<{ name: string; type: string; url?: string }> | undefined;
            const prioritizedPdfs = selectBestPdfs(pdfUrls, 3, attachments);
            
            console.log(`[extract_pdf] ${subsidy.id}: ${pdfUrls.length} PDFs, prioritized ${prioritizedPdfs.length}`);
            if (prioritizedPdfs.length > 0) {
              const topScore = scorePdfUrl(prioritizedPdfs[0]);
              console.log(`[extract_pdf] Top PDF: ${prioritizedPdfs[0].substring(0, 80)}... (score: ${topScore.score}, ${topScore.reason})`);
            }
            
            let pdfText = '';
            let successfulPdfUrl = '';
            
            // R2 URL を署名付き HTTP URL に変換するヘルパー
            // r2://subsidy-knowledge/pdf/xxx.pdf → https://hojyokin.pages.dev/api/r2-pdf?key=...&exp=...&sig=...
            const convertR2UrlToHttp = async (url: string): Promise<{ isR2: boolean; httpUrl: string; r2Key: string | null }> => {
              const r2Prefix = 'r2://subsidy-knowledge/';
              if (url.startsWith(r2Prefix)) {
                const r2Key = url.substring(r2Prefix.length); // pdf/xxx.pdf
                const baseUrl = env.CLOUDFLARE_API_BASE_URL || 'https://hojyokin.pages.dev';
                const signingSecret = env.R2_PDF_SIGNING_SECRET;
                
                if (signingSecret) {
                  // 署名付きURL生成（有効期限10分）
                  const { buildSignedR2PdfUrl } = await import('../../lib/r2-sign');
                  const httpUrl = await buildSignedR2PdfUrl(baseUrl, r2Key, signingSecret, 600);
                  return { isR2: true, httpUrl, r2Key };
                } else {
                  // 署名シークレット未設定（開発環境用）
                  console.warn('[extract_pdf] R2_PDF_SIGNING_SECRET not set - using unsigned URL');
                  const httpUrl = `${baseUrl}/api/r2-pdf?key=${encodeURIComponent(r2Key)}`;
                  return { isR2: true, httpUrl, r2Key };
                }
              }
              return { isR2: false, httpUrl: url, r2Key: null };
            };
            
            // フォールバック付きでPDFを順番に試行
            for (const pdfUrl of prioritizedPdfs) {
              if (pdfText && pdfText.length > 100) break; // 成功したら終了
              
              const pdfScore = scorePdfUrl(pdfUrl);
              if (pdfScore.score < 0) {
                console.log(`[extract_pdf] Skipping low-score PDF: ${pdfUrl.substring(0, 60)}... (score: ${pdfScore.score})`);
                continue;
              }
              
              // R2 URL の変換（署名付き）
              const { isR2, httpUrl, r2Key } = await convertR2UrlToHttp(pdfUrl);
              
              // ===== R2 PDF: 直接 R2 から取得してテキスト化 =====
              if (isR2 && r2Key && env.R2_KNOWLEDGE) {
                try {
                  console.log(`[extract_pdf] Fetching R2 PDF: ${r2Key}`);
                  const r2Object = await env.R2_KNOWLEDGE.get(r2Key);
                  
                  if (r2Object) {
                    // R2 の PDF を取得成功 → Firecrawl 経由で変換
                    // Firecrawl は HTTP URL が必要なので内部ブリッジを使う
                    if (firecrawlKey) {
                      console.log(`[extract_pdf] Converting R2 PDF via internal bridge: ${httpUrl}`);
                      const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${firecrawlKey}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ url: httpUrl, formats: ['markdown'] }),
                      });
                      
                      const fcSuccess = fcResponse.ok;
                      let fcText = '';
                      
                      if (fcSuccess) {
                        const fcData = await fcResponse.json() as any;
                        fcText = fcData.data?.markdown || '';
                        if (fcText.length > 100) {
                          pdfText = fcText;
                          successfulPdfUrl = pdfUrl; // 元の r2:// URL を記録
                          console.log(`[extract_pdf] R2 PDF Success: ${pdfUrl.substring(0, 60)}... (${fcText.length} chars)`);
                        }
                      } else {
                        console.warn(`[extract_pdf] Firecrawl failed for R2 PDF: ${fcResponse.status}`);
                      }
                      
                      // Firecrawl コスト記録 (1 credit per scrape)
                      await logFirecrawlCost(db, {
                        credits: 1,
                        costUsd: 0.001,
                        url: httpUrl,
                        success: fcSuccess,
                        httpStatus: fcResponse.status,
                        subsidyId: subsidy.id,
                        billing: 'known',
                        rawUsage: { markdown_length: fcText.length },
                      });
                    }
                  } else {
                    console.warn(`[extract_pdf] R2 object not found: ${r2Key}`);
                  }
                } catch (e) {
                  console.warn(`[extract_pdf] R2 PDF processing failed for ${pdfUrl}:`, e);
                }
                continue; // R2 PDF は処理完了、次へ
              }
              
              // ===== 通常の HTTP(S) URL: 従来通り Firecrawl に渡す =====
              if (firecrawlKey) {
                try {
                  const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${firecrawlKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url: pdfUrl, formats: ['markdown'] }),
                  });
                  
                  const fcSuccess = fcResponse.ok;
                  let fcText = '';
                  
                  if (fcSuccess) {
                    const fcData = await fcResponse.json() as any;
                    fcText = fcData.data?.markdown || '';
                    if (fcText.length > 100) {
                      pdfText = fcText;
                      successfulPdfUrl = pdfUrl;
                      console.log(`[extract_pdf] Success: ${pdfUrl.substring(0, 60)}... (${fcText.length} chars)`);
                    }
                  }
                  
                  // Firecrawl コスト記録 (1 credit per scrape)
                  await logFirecrawlCost(db, {
                    credits: 1,
                    costUsd: 0.001,
                    url: pdfUrl,
                    success: fcSuccess,
                    httpStatus: fcResponse.status,
                    subsidyId: subsidy.id,
                    billing: 'known',
                    rawUsage: { markdown_length: fcText.length },
                  });
                } catch (e) {
                  console.warn(`[extract_pdf] Firecrawl failed for ${pdfUrl}:`, e);
                  // 失敗時もコスト記録 (Freeze-COST-3)
                  await logFirecrawlCost(db, {
                    credits: 1,
                    costUsd: 0.001,
                    url: pdfUrl,
                    success: false,
                    subsidyId: subsidy.id,
                    errorMessage: e instanceof Error ? e.message : 'Unknown error',
                    billing: 'known',
                  });
                }
              }
            }
            
            // OpenAI で構造化データ抽出
            if (pdfText && pdfText.length > 100 && openaiKey) {
              try {
                const { extractSubsidyDataFromPdf, mergeExtractedData, ExtractedResult } = await import('../../services/openai-extractor');
                const extractResult = await extractSubsidyDataFromPdf(pdfText, openaiKey, 'gpt-4o-mini', true) as import('../../services/openai-extractor').ExtractedResult;
                
                // OpenAI コスト記録
                const inputTokens = extractResult.usage?.prompt_tokens || 0;
                const outputTokens = extractResult.usage?.completion_tokens || 0;
                // gpt-4o-mini: $0.15/1M input, $0.60/1M output
                const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
                
                await logOpenAICost(db, {
                  model: extractResult.model,
                  inputTokens,
                  outputTokens,
                  costUsd,
                  action: 'extract_pdf',
                  success: extractResult.success,
                  subsidyId: subsidy.id,
                  rawUsage: extractResult.usage,
                });
                
                if (extractResult.data) {
                  // 既存データとマージ (mergeExtractedData を使用)
                  const merged = mergeExtractedData(detail, extractResult.data);
                  merged.extracted_pdf_text = pdfText.substring(0, 5000);
                  merged.extracted_at = new Date().toISOString();
                  merged.extracted_from_pdf = successfulPdfUrl; // どのPDFから抽出したか記録
                  
                  await db.prepare(`
                    UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                    WHERE id = ?
                  `).bind(JSON.stringify(merged), subsidy.id).run();
                  
                  // WALL_CHAT_READY 判定（v4: タイトルも渡す）
                  const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged), subsidy.title);
                  if (readyResult.ready) {
                    await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                      .bind(subsidy.id).run();
                  }
                }
              } catch (e) {
                console.warn(`[extract_pdf] OpenAI extraction failed for ${subsidy.id}:`, e);
                // 失敗時もコスト記録 (推定値)
                await logOpenAICost(db, {
                  model: 'gpt-4o-mini',
                  inputTokens: 0,
                  outputTokens: 0,
                  costUsd: 0,
                  action: 'extract_pdf',
                  success: false,
                  subsidyId: subsidy.id,
                  errorMessage: e instanceof Error ? e.message : 'Unknown error',
                });
                // OpenAIが失敗してもFirecrawlの結果は保存
                if (pdfText.length > 100) {
                  const merged = {
                    ...detail,
                    extracted_pdf_text: pdfText.substring(0, 5000),
                    extracted_at: new Date().toISOString(),
                    extracted_from_pdf: successfulPdfUrl,
                  };
                  await db.prepare(`
                    UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                    WHERE id = ?
                  `).bind(JSON.stringify(merged), subsidy.id).run();
                }
              }
            } else if (pdfText && pdfText.length > 100) {
              // OpenAI キーがない場合は生テキストだけ保存
              const merged = {
                ...detail,
                extracted_pdf_text: pdfText.substring(0, 5000),
                extracted_at: new Date().toISOString(),
                extracted_from_pdf: successfulPdfUrl,
              };
              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now')
                WHERE id = ?
              `).bind(JSON.stringify(merged), subsidy.id).run();
            }
          }
        }
      }

      // enrich_shigoto: tokyo-shigoto の HTML から詳細取得
      if (job.job_type === 'enrich_shigoto') {
        const subsidy = await db.prepare(`
          SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
          FROM subsidy_cache WHERE id = ? AND source = 'tokyo-shigoto'
        `).bind(job.subsidy_id).first<{
          id: string;
          title: string;
          detail_json: string | null;
          detail_url: string | null;
        }>();

        if (subsidy && subsidy.detail_url) {
          const response = await fetch(subsidy.detail_url, {
            headers: {
              'Accept': 'text/html',
              'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
            },
          });

          if (response.ok) {
            const html = await response.text();
            const detailJson: Record<string, any> = {};

            // ページ全体のテキスト抽出
            const bodyText = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, '\n')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 5000);

            // 表から概要抽出
            const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
            if (tableMatch) {
              const tableText = tableMatch[1]
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (tableText.length > 50) {
                detailJson.overview = tableText.substring(0, 1500);
              }
            }
            if (!detailJson.overview && bodyText.length > 100) {
              detailJson.overview = bodyText.substring(0, 1500);
            }

            // application_requirements 抽出
            const reqPatterns = [
              /(?:対象者|対象事業者|助成対象|申請資格|応募資格|交付対象)[：:\s]*([^\n]{20,500})/,
              /(?:中小企業|都内).{5,200}(?:事業者|企業|団体|法人)/,
            ];
            for (const pat of reqPatterns) {
              if (!detailJson.application_requirements) {
                const m = bodyText.match(pat);
                if (m) {
                  detailJson.application_requirements = [(m[1] || m[0]).trim().substring(0, 500)];
                }
              }
            }

            // eligible_expenses 抽出
            const expPatterns = [
              /(?:対象経費|助成対象経費|補助対象|助成内容|支援内容|助成事業)[：:\s]*([^\n]{20,500})/,
              /(?:助成金額|助成率|補助率|助成限度額)[：:\s]*([^\n]{10,300})/,
            ];
            for (const pat of expPatterns) {
              if (!detailJson.eligible_expenses) {
                const m = bodyText.match(pat);
                if (m) {
                  detailJson.eligible_expenses = [(m[1] || m[0]).trim().substring(0, 500)];
                }
              }
            }

            // 年度末をデフォルト締切
            const now = new Date();
            const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            detailJson.acceptance_end_datetime = `${fiscalYear + 1}-03-31T23:59:59Z`;

            // マージして保存
            const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
            if (!existing.required_documents || existing.required_documents.length === 0) {
              detailJson.required_documents = ['募集要項', '申請書', '事業計画書'];
            }
            const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

            await db.prepare(`
              UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
            `).bind(JSON.stringify(merged), subsidy.id).run();

            // WALL_CHAT_READY 判定
            const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
            if (readyResult.ready) {
              await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
                .bind(subsidy.id).run();
            }
          }
        }
      }

      // ジョブ完了
      await db.prepare(`
        UPDATE extraction_queue
        SET status='done', lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
        WHERE id=?
      `).bind(queueId).run();

      done++;
    } catch (e: any) {
      const attempts = (job.attempts || 0) + 1;
      const nextStatus = attempts >= (job.max_attempts || 5) ? 'failed' : 'queued';

      await db.prepare(`
        UPDATE extraction_queue
        SET status=?, attempts=?, last_error=?, lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
        WHERE id=?
      `).bind(nextStatus, attempts, String(e?.message || e).slice(0, 500), queueId).run();

      failed++;
    }
  }

  // ★ v4.0: cron_runs ログ完了
  if (runId) {
    try {
      await finishCronRun(db, runId, failed > 0 && done === 0 ? 'failed' : failed > 0 ? 'partial' : 'success', {
        items_processed: leasedIds.length,
        items_inserted: done,
        error_count: failed,
        metadata: { shard: specificShard ?? 'all', leased: leasedIds.length, done, failed },
      });
    } catch (e) { console.warn('[consume-extractions] finishCronRun error:', e); }
  }

  return c.json<ApiResponse<{
    shard: number | string;
    leased: number;
    done: number;
    failed: number;
  }>>({
    success: true,
    data: {
      shard: specificShard ?? 'all',
      leased: leasedIds.length,
      done,
      failed,
    },
  });
});



export default extractionQueue;

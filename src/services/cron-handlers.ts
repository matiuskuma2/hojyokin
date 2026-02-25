/**
 * Cron Handler Functions
 * 
 * Workers Scheduled Events から直接呼び出される処理関数
 * HTTP エンドポイント経由ではなく、直接実行
 */

import type { Env } from '../types';
import { logFirecrawlCost, logOpenAICost } from '../lib/cost/cost-logger';

// =====================================================
// Helper Functions
// =====================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function startCronRun(
  db: D1Database,
  jobType: string,
  triggeredBy: 'scheduled' | 'manual' = 'scheduled'
): Promise<string> {
  const runId = generateUUID();
  await db.prepare(`
    INSERT INTO cron_runs (run_id, job_type, status, triggered_by)
    VALUES (?, ?, 'running', ?)
  `).bind(runId, jobType, triggeredBy).run();
  return runId;
}

async function finishCronRun(
  db: D1Database,
  runId: string,
  status: 'success' | 'failed' | 'partial',
  stats: Record<string, any>
): Promise<void> {
  await db.prepare(`
    UPDATE cron_runs SET
      status = ?,
      finished_at = datetime('now'),
      items_processed = ?,
      items_inserted = ?,
      error_count = ?,
      errors_json = ?,
      metadata_json = ?
    WHERE run_id = ?
  `).bind(
    status,
    stats.items_processed ?? 0,
    stats.items_inserted ?? 0,
    stats.error_count ?? 0,
    stats.errors ? JSON.stringify(stats.errors.slice(0, 50)) : null,
    stats.metadata ? JSON.stringify(stats.metadata) : null,
    runId
  ).run();
}

// =====================================================
// Sync JGrants (06:00 JST)
// =====================================================
// JGrants 公開 API から補助金一覧を取得して subsidy_cache に保存

export async function executeSyncJgrants(env: Env): Promise<void> {
  const db = env.DB;
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'sync-jgrants', 'scheduled');
    console.log(`[Sync-JGrants] Started: runId=${runId}`);
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const KEYWORDS = ['補助金', '助成金', 'DX', 'IT導入', '省エネ', '雇用', '設備投資', 'ものづくり', '持続化', '再構築'];
    
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>();
    const errors: string[] = [];
    
    for (const keyword of KEYWORDS) {
      for (const acceptance of ['1', '0']) { // 受付中 & 受付終了
        try {
          const url = `${JGRANTS_API_URL}?keyword=${encodeURIComponent(keyword)}&acceptance=${acceptance}&limit=200&sort=acceptance_end_datetime&order=DESC`;
          const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
          
          if (!response.ok) {
            errors.push(`API error for ${keyword}: ${response.status}`);
            continue;
          }
          
          const data = await response.json() as any;
          const subsidies = data.result || data.subsidies || data.data || [];
          
          for (const s of subsidies) {
            if (!s.id || seenIds.has(s.id)) continue;
            seenIds.add(s.id);
            totalFetched++;
            
            // INSERT OR REPLACE で冪等性保証
            await db.prepare(`
              INSERT OR REPLACE INTO subsidy_cache (
                id, source, title, subsidy_max_limit, subsidy_rate, 
                target_area_search, acceptance_start_datetime, acceptance_end_datetime,
                cached_at, expires_at
              ) VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+7 days'))
            `).bind(
              s.id,
              s.title || '',
              s.subsidy_max_limit || null,
              s.subsidy_rate || null,
              s.target_area_search || null,
              s.acceptance_start_datetime || null,
              s.acceptance_end_datetime || null
            ).run();
            
            totalInserted++;
          }
          
          // Rate limiting
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          errors.push(`Fetch error for ${keyword}/${acceptance}: ${e}`);
        }
      }
    }
    
    await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
      items_processed: totalFetched,
      items_inserted: totalInserted,
      error_count: errors.length,
      errors,
      metadata: { keywords_count: KEYWORDS.length },
    });
    
    console.log(`[Sync-JGrants] Completed: fetched=${totalFetched}, inserted=${totalInserted}, errors=${errors.length}`);
  } catch (error) {
    console.error('[Sync-JGrants] Fatal error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [String(error)],
      });
    }
  }
}

// =====================================================
// Enrich JGrants (07:00 JST)
// =====================================================
// V2 API で詳細情報を取得、detail HTML から PDF リンクを抽出

export async function executeEnrichJgrants(env: Env): Promise<void> {
  const db = env.DB;
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'enrich-jgrants', 'scheduled');
    console.log(`[Enrich-JGrants] Started: runId=${runId}`);
    
    const JGRANTS_DETAIL_API = 'https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id';
    const MAX_ITEMS = 50; // 1回の実行で処理する最大件数
    
    // 優先キーワード（主要補助金を先に処理）
    const PRIORITY_KEYWORDS = ['ものづくり', '持続化', '再構築', '省力化', 'IT導入'];
    const priorityCase = PRIORITY_KEYWORDS.map((kw, i) => `WHEN title LIKE '%${kw}%' THEN ${i + 1}`).join(' ');
    
    // 未エンリッチの制度を取得（主要補助金優先）
    const targets = await db.prepare(`
      SELECT id, title, detail_json FROM subsidy_cache 
      WHERE source = 'jgrants'
        AND (json_extract(detail_json, '$.enriched_version') IS NULL OR json_extract(detail_json, '$.enriched_version') != 'v2')
        AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > datetime('now'))
      ORDER BY 
        CASE ${priorityCase} ELSE 999 END,
        acceptance_end_datetime ASC
      LIMIT ?
    `).bind(MAX_ITEMS).all();
    
    if (!targets.results || targets.results.length === 0) {
      console.log('[Enrich-JGrants] No targets found');
      await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return;
    }
    
    let itemsEnriched = 0;
    const errors: string[] = [];
    
    for (const target of targets.results) {
      const id = target.id as string;
      
      try {
        const response = await fetch(`${JGRANTS_DETAIL_API}/${id}`, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          errors.push(`API error for ${id}: ${response.status}`);
          continue;
        }
        
        const data = await response.json() as any;
        const subsidy = data.result?.[0] || data;
        
        if (!subsidy || !subsidy.detail) {
          errors.push(`No detail for ${id}`);
          continue;
        }
        
        // detail HTML から PDF リンクを抽出
        const pdfUrls: string[] = [];
        const pdfMatches = subsidy.detail.match(/https?:\/\/[^\s"'<>]+\.pdf/gi) || [];
        for (const url of pdfMatches) {
          if (!pdfUrls.includes(url)) pdfUrls.push(url);
        }
        
        // detail_json を構築
        const detailJson = {
          enriched_at: new Date().toISOString(),
          enriched_version: 'v2',
          api_version: 'v2',
          overview: subsidy.detail?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000),
          catch_phrase: subsidy.subsidy_catch_phrase || null,
          use_purpose: subsidy.use_purpose || null,
          target_industry: Array.isArray(subsidy.industry) ? subsidy.industry.join(' / ') : subsidy.industry,
          target_employees: subsidy.target_number_of_employees || null,
          subsidy_rate: subsidy.subsidy_rate || null,
          subsidy_max_limit: subsidy.subsidy_max_limit || null,
          grant_type: subsidy.granttype || null,
          related_url: `https://www.jgrants-portal.go.jp/subsidy/${id}`,
          workflows: Array.isArray(subsidy.workflow) ? subsidy.workflow.map((w: any) => ({
            id: w.id,
            target_area: w.target_area,
            acceptance_start: w.acceptance_start_datetime,
            acceptance_end: w.acceptance_end_datetime,
            project_end: w.project_end_deadline,
          })) : [],
          ...(pdfUrls.length > 0 && { pdf_urls: pdfUrls }),
        };
        
        await db.prepare(`
          UPDATE subsidy_cache 
          SET detail_json = ?, cached_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(detailJson), id).run();
        
        // PDF URLがある場合は extraction_queue に登録
        if (pdfUrls.length > 0) {
          for (const pdfUrl of pdfUrls.slice(0, 3)) { // 最大3つ
            const queueId = generateUUID();
            const shardKey = Math.floor(Math.random() * 16);
            await db.prepare(`
              INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status)
              VALUES (?, ?, ?, 'extract_pdf', 100, 'queued')
            `).bind(queueId, id, shardKey).run().catch(() => {});
          }
        }
        
        itemsEnriched++;
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors.push(`Error processing ${id}: ${e}`);
      }
    }
    
    await finishCronRun(db, runId, errors.length > itemsEnriched ? 'partial' : 'success', {
      items_processed: targets.results.length,
      items_inserted: itemsEnriched,
      error_count: errors.length,
      errors,
      metadata: { max_items: MAX_ITEMS },
    });
    
    console.log(`[Enrich-JGrants] Completed: processed=${targets.results.length}, enriched=${itemsEnriched}, errors=${errors.length}`);
  } catch (error) {
    console.error('[Enrich-JGrants] Fatal error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [String(error)],
      });
    }
  }
}

// =====================================================
// Consume Extractions (毎時15分)
// =====================================================
// extraction_queue から PDF を取得、Firecrawl でテキスト化、
// OpenAI で構造化データに変換して wall_chat_ready を判定

import { extractSubsidyDataFromPdf, mergeExtractedData, type ExtractedResult } from './openai-extractor';
import { checkWallChatReadyFromJson } from '../lib/wall-chat-ready';

export async function executeConsumeExtractions(env: Env): Promise<void> {
  const db = env.DB;
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'consume-extractions', 'scheduled');
    console.log(`[Consume-Extractions] Started: runId=${runId}`);
    
    const MAX_ITEMS = 5; // OpenAI コスト考慮で少なめに
    
    // queued 状態のアイテムを取得（主要補助金優先）
    const items = await db.prepare(`
      SELECT eq.id, eq.subsidy_id, eq.job_type, sc.detail_json, sc.title
      FROM extraction_queue eq
      JOIN subsidy_cache sc ON eq.subsidy_id = sc.id
      WHERE eq.status = 'queued'
      ORDER BY 
        CASE 
          WHEN sc.title LIKE '%ものづくり%' THEN 1
          WHEN sc.title LIKE '%持続化%' THEN 2
          WHEN sc.title LIKE '%再構築%' THEN 3
          ELSE 10
        END,
        eq.priority DESC, 
        eq.created_at ASC
      LIMIT ?
    `).bind(MAX_ITEMS).all();
    
    if (!items.results || items.results.length === 0) {
      console.log('[Consume-Extractions] No queued items');
      await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return;
    }
    
    let itemsProcessed = 0;
    let itemsReadyCount = 0;
    const errors: string[] = [];
    
    // API キーを取得
    const firecrawlKey = (env as any).FIRECRAWL_API_KEY;
    const openaiKey = (env as any).OPENAI_API_KEY;
    
    for (const item of items.results) {
      const queueId = item.id as string;
      const subsidyId = item.subsidy_id as string;
      const title = item.title as string;
      
      try {
        console.log(`[Consume-Extractions] Processing: ${subsidyId} - ${title?.substring(0, 40)}...`);
        
        // リース状態に更新
        await db.prepare(`
          UPDATE extraction_queue 
          SET status = 'leased', lease_until = datetime('now', '+10 minutes')
          WHERE id = ?
        `).bind(queueId).run();
        
        // detail_json から PDF URL を取得
        let detailJson = JSON.parse((item.detail_json as string) || '{}');
        const pdfUrls = detailJson.pdf_urls || detailJson.pdfUrls || [];
        
        if (pdfUrls.length === 0) {
          await db.prepare(`UPDATE extraction_queue SET status = 'done' WHERE id = ?`).bind(queueId).run();
          continue;
        }
        
        // Firecrawl で PDF をスクレイピング（公募要領を優先）
        let pdfText = '';
        const koboUrl = pdfUrls.find((u: string) => u.includes('kobo') || u.includes('youryou') || u.includes('要領'));
        const pdfUrl = koboUrl || pdfUrls[0];
        
        if (firecrawlKey) {
          console.log(`[Consume-Extractions] Scraping PDF: ${pdfUrl}`);
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: pdfUrl,
              formats: ['markdown'],
            }),
          });
          
          const fcSuccess = scrapeResponse.ok;
          if (fcSuccess) {
            const scrapeData = await scrapeResponse.json() as any;
            pdfText = scrapeData.data?.markdown || '';
            console.log(`[Consume-Extractions] PDF text length: ${pdfText.length}`);
          } else {
            errors.push(`Firecrawl error for ${subsidyId}: ${scrapeResponse.status}`);
          }
          
          // Freeze-COST-2: コスト記録
          await logFirecrawlCost(db, {
            credits: 1,
            costUsd: 0.001,
            url: pdfUrl,
            success: fcSuccess,
            httpStatus: scrapeResponse.status,
            subsidyId,
            billing: 'known',
            rawUsage: { action: 'consume_extractions_pdf', markdownLength: pdfText.length },
          }).catch((e: any) => console.warn('[Consume-Extractions] Cost log failed:', e.message));
        }
        
        // OpenAI で構造化データを抽出
        if (pdfText.length > 200 && openaiKey) {
          console.log(`[Consume-Extractions] Extracting with OpenAI...`);
          
          const result = await extractSubsidyDataFromPdf(pdfText, openaiKey, 'gpt-4o-mini', true) as ExtractedResult;
          
          if (result.data) {
            // 抽出結果をマージ
            detailJson = mergeExtractedData(detailJson, result.data);
            console.log(`[Consume-Extractions] Extracted: requirements=${result.data.application_requirements?.length || 0}, expenses=${result.data.eligible_expenses?.length || 0}, docs=${result.data.required_documents?.length || 0}`);
          }
          
          // Freeze-COST-2: OpenAI コスト記録
          const inputTokens = result.usage?.prompt_tokens || 0;
          const outputTokens = result.usage?.completion_tokens || 0;
          const costUsd = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
          await logOpenAICost(db, {
            model: result.model || 'gpt-4o-mini',
            inputTokens,
            outputTokens,
            costUsd,
            action: 'consume_extractions_pdf',
            success: result.success,
            subsidyId,
            rawUsage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
          }).catch((e: any) => console.warn('[Consume-Extractions] OpenAI cost log failed:', e.message));
        } else if (pdfText.length > 100) {
          // OpenAI がない場合は生テキストを保存
          detailJson.extracted_pdf_text = pdfText.substring(0, 10000);
          detailJson.extracted_at = new Date().toISOString();
        }
        
        // wall_chat_ready を判定
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(detailJson));
        const wallChatReady = readyResult.ready ? 1 : 0;
        
        if (wallChatReady) {
          itemsReadyCount++;
          console.log(`[Consume-Extractions] ✅ wall_chat_ready: ${subsidyId}`);
        } else {
          console.log(`[Consume-Extractions] ❌ Not ready (missing: ${readyResult.missing.join(', ')})`);
        }
        
        // DB 更新
        await db.prepare(`
          UPDATE subsidy_cache 
          SET detail_json = ?, wall_chat_ready = ?, wall_chat_missing = ?, cached_at = datetime('now')
          WHERE id = ?
        `).bind(
          JSON.stringify(detailJson), 
          wallChatReady,
          readyResult.missing.join(','),
          subsidyId
        ).run();
        
        // 完了
        await db.prepare(`UPDATE extraction_queue SET status = 'done' WHERE id = ?`).bind(queueId).run();
        itemsProcessed++;
        
        // Rate limiting (OpenAI + Firecrawl)
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        errors.push(`Error processing ${queueId}: ${e}`);
        await db.prepare(`
          UPDATE extraction_queue 
          SET status = 'queued', attempts = attempts + 1, last_error = ?
          WHERE id = ?
        `).bind(String(e), queueId).run();
      }
    }
    
    await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
      items_processed: itemsProcessed,
      error_count: errors.length,
      errors,
    });
    
    console.log(`[Consume-Extractions] Completed: processed=${itemsProcessed}, errors=${errors.length}`);
  } catch (error) {
    console.error('[Consume-Extractions] Fatal error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [String(error)],
      });
    }
  }
}

/**
 * Cron: JGrants同期・エンリッチメント・詳細取得
 * 
 * POST /sync-jgrants       - JGrantsデータ同期（discovery_items → subsidy_cache）
 * POST /enrich-jgrants      - JGrants 詳細取得・エンリッチ
 * POST /scrape-jgrants-detail - JGrants 詳細ページスクレイピング
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../../services/firecrawl';
import { shardKey16, currentShardByHour } from '../../lib/shard';
import { checkExclusion, checkWallChatReadyFromJson, selectBestPdfs, scorePdfUrl, type ExclusionReasonCode } from '../../lib/wall-chat-ready';
import { logFirecrawlCost, logOpenAICost } from '../../lib/cost/cost-logger';

const syncJgrants = new Hono<{ Bindings: Env; Variables: Variables }>();

syncJgrants.post('/sync-jgrants', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'sync-jgrants', 'cron');
  } catch (logErr) {
    console.warn('[Cron] Failed to start cron_run log:', logErr);
    // ログ失敗は処理を止めない
  }
  
  try {
    // =====================================================================
    // 最適化キーワードセット（v2.0 - Workers タイムアウト対策）
    // 
    // 変更履歴:
    // v1.3 -> v2.0: 51キーワード×2acceptance(102API呼び出し)がWorkersタイムアウト
    //   → 受付中のみ + キーワード15個に厳選（15API呼び出し、~8秒で完了）
    //   → 受付終了分は既にDBに保存済み（新規取り込み不要）
    //   → 重複はseenIdsで排除されるので広いキーワードでカバー
    // =====================================================================
    const KEYWORDS = [
      // Tier1: 広範カバー（これだけでjGrants受付中のほとんどをカバー）
      '補助金',
      '助成金', 
      '事業',
      '支援',
      '公募',
      // Tier2: テーマ別（Tier1で漏れるものをカバー）
      '設備',
      '省エネ',
      '雇用',
      'DX',
      '中小企業',
      // Tier3: ニッチ分野
      '研究開発',
      '農業',
      '観光',
      '建設',
      '環境',
    ];
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>();
    const errors: string[] = [];
    
    // v2.0: 受付中のみ取得（受付終了分は既にDBに蓄積済み）
    const acceptanceFlags = ['1']; // 1=受付中のみ
    
    for (const acceptance of acceptanceFlags) {
      for (const keyword of KEYWORDS) {
        try {
          const params = new URLSearchParams({
            keyword,
            sort: 'acceptance_end_datetime',
            order: 'DESC',
            acceptance,
            limit: '200',
          });
          
          console.log(`Cron sync: keyword=${keyword}, acceptance=${acceptance}`);
          
          const response = await fetch(`${JGRANTS_API_URL}?${params.toString()}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          
          if (!response.ok) {
            errors.push(`${keyword}(acc=${acceptance}): API ${response.status}`);
            continue;
          }
          
          const data = await response.json() as any;
          const subsidies = data.result || data.subsidies || data.data || [];
          
          // 重複排除
          const uniqueSubsidies = subsidies.filter((s: any) => {
            if (seenIds.has(s.id)) return false;
            seenIds.add(s.id);
            return true;
          });
          
          if (uniqueSubsidies.length > 0) {
            const statements = uniqueSubsidies.map((s: any) => {
              // detail_json に元データを保存（Phase1-2でOCR/抽出時に使用）
              // ★ v4.0: sync初期データにcrawled_atは付けない（enrichment前に判定されるのを防止）
              const detailJson = JSON.stringify({
                subsidy_application_url: s.subsidy_application_url || null,
                subsidy_application_address: s.subsidy_application_address || null,
                target_detail: s.target_detail || null,
                usage_detail: s.usage_detail || null,
                subsidy_rate_detail: s.subsidy_rate_detail || null,
                subsidy_max_limit_detail: s.subsidy_max_limit_detail || null,
                acceptance_number_detail: s.acceptance_number_detail || null,
                contact: s.contact || null,
              });
              
              // ★ v4.0: INSERT OR REPLACE → INSERT ... ON CONFLICT DO UPDATE
              // enrich済みのdetail_json, wall_chat_ready, wall_chat_excluded を保護
              return db.prepare(`
                INSERT INTO subsidy_cache 
                (id, source, title, subsidy_max_limit, subsidy_rate,
                 target_area_search, target_industry, target_number_of_employees,
                 acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
                 detail_json, cached_at, expires_at)
                VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
                ON CONFLICT(id) DO UPDATE SET
                  title = excluded.title,
                  subsidy_max_limit = excluded.subsidy_max_limit,
                  subsidy_rate = excluded.subsidy_rate,
                  target_area_search = excluded.target_area_search,
                  target_industry = excluded.target_industry,
                  target_number_of_employees = excluded.target_number_of_employees,
                  acceptance_start_datetime = excluded.acceptance_start_datetime,
                  acceptance_end_datetime = excluded.acceptance_end_datetime,
                  request_reception_display_flag = excluded.request_reception_display_flag,
                  cached_at = datetime('now'),
                  expires_at = excluded.expires_at
              `).bind(
                s.id,
                s.title || s.name || '',
                s.subsidy_max_limit || null,
                s.subsidy_rate || null,
                s.target_area_search || null,
                s.target_industry || null,
                s.target_number_of_employees || null,
                s.acceptance_start_datetime || null,
                s.acceptance_end_datetime || null,
                s.request_reception_display_flag ?? (acceptance === '1' ? 1 : 0),
                detailJson,
                expiresAt
              );
            });
            
            // D1バッチ実行（100件ごと）
            for (let i = 0; i < statements.length; i += 100) {
              const batch = statements.slice(i, i + 100);
              await db.batch(batch);
            }
          }
          
          totalFetched += subsidies.length;
          totalInserted += uniqueSubsidies.length;
          
          // レート制限対策: 100ms待機（v2.0: 300ms→100msに短縮）
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          errors.push(`${keyword}(acc=${acceptance}): ${String(err)}`);
        }
      }
    }
    
    // 同期結果をログ
    console.log(`Cron JGrants sync completed: fetched=${totalFetched}, inserted=${totalInserted}, unique=${seenIds.size}, errors=${errors.length}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
          items_processed: seenIds.size,
          items_inserted: totalInserted,
          error_count: errors.length,
          errors: errors,
          metadata: { total_fetched: totalFetched },
        });
      } catch (logErr) {
        console.warn('[Cron] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      total_fetched: number;
      total_inserted: number;
      unique_count: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Cron JGrants sync completed',
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        errors,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
  } catch (error) {
    console.error('Cron JGrants sync error:', error);
    
    // P2-0: 失敗ログ
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Cron] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Failed to sync: ${error}`,
      },
    }, 500);
  }
});

/**
 * 東京都中小企業振興公社 助成金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-kosha
 * 
 * Phase1: 東京都の補助金データ収集パイロット
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（INSERT OR REPLACE）
 */

syncJgrants.post('/enrich-jgrants', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // P2-0: 実行ログ開始
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'enrich-jgrants', 'cron');
  } catch (logErr) {
    console.warn('[Enrich-JGrants] Failed to start cron_run log:', logErr);
  }
  
  // forceモード: v2エンリッチ済みでもeligible_expensesがないものを再処理（Active内のみ）
  const forceMode = c.req.query('force') === 'true';
  // include_expired: 期限切れも含めてエンリッチ対象にする
  const includeExpired = c.req.query('include_expired') === 'true';
  
  // 設定 (Cloudflare Worker 30秒制限考慮 → Pages は30s制限なし)
  // ★ v5.0: 3→10に増量。Pages functionは30s制限がないため。
  // API呼び出し1件あたり ~2秒 + 300ms wait = ~2.3秒 × 10件 = ~23秒
  const MAX_ITEMS_PER_RUN = 10;
  const JGRANTS_DETAIL_API_V2 = 'https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id';
  
  let itemsEnriched = 0;
  let itemsSkipped = 0;
  let itemsReady = 0;
  let pdfLinksQueued = 0;
  const errors: string[] = [];
  
  // =====================================================
  // ヘルパー関数
  // =====================================================
  
  /**
   * HTMLからPDFリンクを抽出
   */
  function extractPdfLinksFromHtml(html: string): string[] {
    const pdfUrls: string[] = [];
    // href="...pdf" パターン
    const hrefPattern = /href=["']([^"']*\.pdf)["']/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      pdfUrls.push(match[1]);
    }
    // http(s)://...pdf パターン（テキスト内）
    const urlPattern = /https?:\/\/[^\s"'<>]+\.pdf/gi;
    while ((match = urlPattern.exec(html)) !== null) {
      if (!pdfUrls.includes(match[0])) {
        pdfUrls.push(match[0]);
      }
    }
    return pdfUrls;
  }
  
  /**
   * HTMLから参照URL（外部サイト）を抽出
   * jGrants以外のドメインへのリンクを取得
   */
  function extractReferenceUrls(html: string): string[] {
    const refUrls: string[] = [];
    // href属性からURL抽出
    const hrefPattern = /href=["'](https?:\/\/[^"']+)["']/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      const url = match[1];
      // jGrants以外のドメインを対象とする
      if (!url.includes('jgrants-portal.go.jp') && 
          !url.includes('javascript:') &&
          !url.includes('#')) {
        // 末尾のエスケープ文字を除去
        const cleanUrl = url.replace(/\\+$/, '').replace(/\\/g, '');
        if (!refUrls.includes(cleanUrl)) {
          refUrls.push(cleanUrl);
        }
      }
    }
    return refUrls;
  }
  
  /**
   * 概要テキストから申請要件・対象経費・対象者を簡易抽出
   * v6: 各項目を独立して抽出（else if チェーンを解消）
   */
  function extractFieldsFromOverview(overviewText: string): {
    application_requirements?: string[];
    eligible_expenses?: string[];
    target_businesses?: string[];
  } {
    const result: {
      application_requirements?: string[];
      eligible_expenses?: string[];
      target_businesses?: string[];
    } = {};
    
    // === 1. 正規表現で直接抽出（最優先） ===
    
    // 対象経費の直接抽出パターン（v6.1: さらに強化）
    // 「助成対象経費」などのキーワードの後ろから、次のセクションマーカーまでを抽出
    const expenseDirectPatterns = [
      // パターン1: 「助成対象経費／助成限度額」のような見出しの後の番号付きリスト
      /(?:助成対象経費|補助対象経費|対象経費)[／\/・、：:\s]+(?:助成限度額|補助限度額|上限額)?[：:\s]*((?:①|[①-⑩]|[1-9][\.\)）]).{10,800})/,
      // パターン2: 経費キーワードの後ろの説明文
      /(?:助成対象経費|補助対象経費|対象経費|対象となる経費|経費の範囲)[：:\s]+([^■◆●▼【]{20,500})/,
      // パターン3: 支援内容/助成内容セクション
      /(?:支援内容|助成内容|補助内容)[：:\s]+([^■◆●▼【]{20,500})/,
      // パターン4: 番号付きリスト（①②③形式）で経費・費用が含まれるもの
      /(?:①[^■◆●▼【①-⑩]{10,200}(?:経費|費用)[^■◆●▼【①-⑩]*)+/,
    ];
    for (const pattern of expenseDirectPatterns) {
      if (!result.eligible_expenses) {
        const match = overviewText.match(pattern);
        if (match) {
          const extracted = (match[1] || match[0]).trim().substring(0, 600);
          if (extracted.length > 20) {
            result.eligible_expenses = [extracted];
          }
        }
      }
    }
    
    // 申請要件の直接抽出パターン（v6: 強化）
    const reqDirectPatterns = [
      /(?:応募資格|申請資格|交付対象者|補助対象者|助成対象者)[：:\s]*(.{20,500}?)(?=(?:■|◆|●|問[合い]?せ|\n\n|$))/s,
      /(?:対象(?:となる)?事業者)[：:\s]*(.{20,400}?)(?=[。\n])/,
      /(?:中小企業|小規模事業者)(?:者)?.*(?:であること|に該当|を満たす).{10,300}/,
      /(?:次の|以下の)(?:いずれ|すべて|全て).*(?:に該当|を満たす).{10,300}/,
    ];
    for (const pattern of reqDirectPatterns) {
      if (!result.application_requirements) {
        const match = overviewText.match(pattern);
        if (match) {
          const extracted = (match[1] || match[0]).trim().substring(0, 500);
          if (extracted.length > 15) {
            result.application_requirements = [extracted];
          }
        }
      }
    }
    
    // 対象者の直接抽出パターン
    const targetDirectPatterns = [
      /(?:対象者|対象事業者)[：:\s]*(.{20,400}?)(?=[。\n■◆●])/,
    ];
    for (const pattern of targetDirectPatterns) {
      if (!result.target_businesses) {
        const match = overviewText.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim().substring(0, 500);
          if (extracted.length > 15) {
            result.target_businesses = [extracted];
          }
        }
      }
    }
    
    // === 2. セクション分割による抽出（フォールバック） ===
    const sections = overviewText.split(/[■◆●▼【】]/);
    
    for (const section of sections) {
      const sectionText = section.trim();
      if (sectionText.length < 10) continue;
      
      // ヘッダー（最初の40文字）
      const header = sectionText.substring(0, 40);
      // 内容（ヘッダー後のテキスト）
      const contentStart = sectionText.search(/[：:\s\n]/);
      const content = contentStart > 0 
        ? sectionText.substring(contentStart).replace(/^[：:\s\n]+/, '').trim().substring(0, 600)
        : sectionText.substring(0, 600);
      
      // 対象経費（独立チェック）
      if (!result.eligible_expenses && (
          header.includes('対象経費') || header.includes('補助対象経費') || 
          header.includes('助成対象経費') || header.includes('経費の範囲') ||
          header.includes('対象費用') || header.includes('対象となる経費'))) {
        if (content.length > 15) {
          result.eligible_expenses = [content];
        }
      }
      
      // 支援内容・助成額（対象経費の代替、独立チェック）
      if (!result.eligible_expenses && (
          header.includes('支援内容') || header.includes('補助内容') || 
          header.includes('助成内容') || header.includes('助成金の額') ||
          header.includes('補助金額') || header.includes('助成額') ||
          header.includes('補助事業') || header.includes('助成事業'))) {
        if (content.length > 15) {
          result.eligible_expenses = [content];
        }
      }
      
      // 申請要件（独立チェック）
      if (!result.application_requirements && (
          header.includes('要件') || header.includes('条件') ||
          header.includes('申請資格') || header.includes('応募資格') ||
          header.includes('対象となる') || header.includes('補助対象者') ||
          header.includes('助成対象者') || header.includes('交付の対象') ||
          header.includes('対象とする') || header.includes('申請できる'))) {
        if (content.length > 15) {
          result.application_requirements = [content];
        }
      }
      
      // 対象者（独立チェック）
      if (!result.target_businesses && (
          header.includes('対象者') || header.includes('対象事業者') || 
          header.includes('申請対象') || header.includes('交付対象者'))) {
        if (content.length > 15) {
          result.target_businesses = [content];
        }
      }
    }
    
    return result;
  }
  
  /**
   * HTMLからテキストを抽出（タグ除去、正規化）
   */
  function htmlToText(html: string, maxLength: number = 3000): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxLength);
  }
  
  /**
   * extraction_queueにPDF抽出ジョブを登録
   */
  async function queuePdfExtraction(
    subsidyId: string,
    pdfUrls: string[],
    priority: number = 100
  ): Promise<number> {
    let queued = 0;
    for (const pdfUrl of pdfUrls.slice(0, 5)) { // 最大5件/制度
      try {
        const queueId = generateUUID();
        const shard = shardKey16(subsidyId);
        await db.prepare(`
          INSERT OR IGNORE INTO extraction_queue 
            (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
          VALUES (?, ?, ?, 'extract_pdf', ?, 'queued', datetime('now'), datetime('now'))
        `).bind(queueId, subsidyId, shard, priority).run();
        
        // pdf_urlをmetadataとして別途管理（detail_jsonに保存済み）
        queued++;
      } catch (err) {
        // 重複は無視
      }
    }
    return queued;
  }
  
  try {
    console.log(`[Enrich-JGrants-v2] Starting batch enrichment (max ${MAX_ITEMS_PER_RUN})`);
    
    // =====================================================
    // 優先度3段階: Tier1(主要) > Tier2(準主要) > 通常
    // =====================================================
    const tier1Keywords = ['ものづくり', '持続化', '事業再構築', '再構築'];
    const tier2Keywords = ['省力化', 'IT導入', 'DX', '創業', 'デジタル'];
    
    // Tier1: 主要補助金（最優先、priority=10）
    const tier1Condition = tier1Keywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    // Tier2: 準主要補助金（priority=50）
    const tier2Condition = tier2Keywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    // 全キーワード
    const allKeywords = [...tier1Keywords, ...tier2Keywords, '補助金', '助成'];
    const allCondition = allKeywords.map(k => `title LIKE '%${k}%'`).join(' OR ');
    
    // 対象制度を取得（優先度順）
    // v2未エンリッチ + 受付中 + キーワードマッチ
    // forceモード: v2済みでもeligible_expensesがないものを対象
    const enrichmentCondition = forceMode
      ? `(detail_json IS NULL OR detail_json NOT LIKE '%"enriched_version":"v2"%' OR (json_extract(detail_json, '$.eligible_expenses') IS NULL AND detail_json LIKE '%"enriched_version":"v2"%'))`
      : `(detail_json IS NULL OR detail_json NOT LIKE '%"enriched_version":"v2"%')`;
    
    // Active only（デフォルト）: 受付中のみを対象
    // include_expired=true の場合: 期限切れも含めてエンリッチ（軽量条件）
    const dateCondition = includeExpired
      ? `acceptance_end_datetime IS NOT NULL`  // 期限あり全件（1=1より軽量）
      : `acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now')`;
    
    // include_expired時はキーワード条件を省略（軽量化）
    const keywordFilter = includeExpired ? '1=1' : `(${allCondition})`;
    
    const targets = await db.prepare(`
      SELECT 
        id, title, detail_json, acceptance_end_datetime,
        CASE 
          WHEN (${tier1Condition}) THEN 1
          WHEN (${tier2Condition}) THEN 2
          ELSE 3
        END as priority_tier
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND wall_chat_ready = 0
        AND ${enrichmentCondition}
        AND ${dateCondition}
        AND ${keywordFilter}
      ORDER BY 
        priority_tier ASC,
        CASE WHEN acceptance_end_datetime IS NOT NULL THEN 0 ELSE 1 END,
        acceptance_end_datetime ASC
      LIMIT ?
    `).bind(MAX_ITEMS_PER_RUN).all<{
      id: string;
      title: string;
      detail_json: string | null;
      acceptance_end_datetime: string | null;
      priority_tier: number;
    }>();
    
    const tier1Count = targets.results?.filter(t => t.priority_tier === 1).length ?? 0;
    const tier2Count = targets.results?.filter(t => t.priority_tier === 2).length ?? 0;
    console.log(`[Enrich-JGrants-v2] Found ${targets.results?.length ?? 0} targets (Tier1: ${tier1Count}, Tier2: ${tier2Count})`);
    
    if (!targets.results || targets.results.length === 0) {
      // 優先キーワードなしの全件から取得を試みる
      const fallbackTargets = await db.prepare(`
        SELECT id, title, detail_json, acceptance_end_datetime, 3 as priority_tier
        FROM subsidy_cache
        WHERE source = 'jgrants'
          AND wall_chat_ready = 0
          AND ${enrichmentCondition}
          AND ${dateCondition}
        ORDER BY acceptance_end_datetime ASC
        LIMIT ?
      `).bind(MAX_ITEMS_PER_RUN).all<{
        id: string;
        title: string;
        detail_json: string | null;
        acceptance_end_datetime: string | null;
        priority_tier: number;
      }>();
      
      if (!fallbackTargets.results || fallbackTargets.results.length === 0) {
        if (runId) {
          await finishCronRun(db, runId, 'success', {
            items_processed: 0,
            metadata: { message: 'No targets found' },
          });
        }
        return c.json<ApiResponse<{ message: string }>>({
          success: true,
          data: { message: 'No targets found for enrichment' },
        });
      }
      targets.results = fallbackTargets.results;
    }
    
    // 各制度の詳細を取得
    for (const target of targets.results) {
      try {
        console.log(`[Enrich-JGrants-v2] Fetching (Tier${target.priority_tier}): ${target.id} - ${target.title.substring(0, 50)}`);
        
        // V2 API から詳細取得（タイムアウト10秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒タイムアウト（CF Workers 30s制限対策）
        
        let response: Response;
        try {
          response = await fetch(`${JGRANTS_DETAIL_API_V2}/${target.id}`, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        
        if (!response.ok) {
          errors.push(`${target.id}: HTTP ${response.status}`);
          itemsSkipped++;
          continue;
        }
        
        const data = await response.json() as any;
        const subsidy = data.result?.[0] || data.result || data;
        
        if (!subsidy) {
          errors.push(`${target.id}: No result in response`);
          itemsSkipped++;
          continue;
        }
        
        // =====================================================
        // detail_json構築（v2拡張版）
        // =====================================================
        const detailJson: Record<string, any> = {};
        
        // 1. 概要（overview）- detailから抽出
        if (subsidy.detail && subsidy.detail.length > 20) {
          detailJson.overview = htmlToText(subsidy.detail, 3000);
          detailJson.overview_html_length = subsidy.detail.length;
          
          // 1.5. 概要テキストから申請要件・対象経費・対象者を簡易抽出
          const extractedFields = extractFieldsFromOverview(detailJson.overview);
          if (extractedFields.application_requirements) {
            detailJson.application_requirements = extractedFields.application_requirements;
          }
          if (extractedFields.eligible_expenses) {
            detailJson.eligible_expenses = extractedFields.eligible_expenses;
          }
          if (extractedFields.target_businesses) {
            detailJson.target_businesses = extractedFields.target_businesses;
          }
        }
        
        // 2. キャッチフレーズ
        if (subsidy.subsidy_catch_phrase) {
          detailJson.catch_phrase = subsidy.subsidy_catch_phrase;
        }
        
        // 3. 用途
        if (subsidy.use_purpose) {
          detailJson.use_purpose = subsidy.use_purpose;
        }
        
        // 4. 対象業種
        if (subsidy.industry) {
          detailJson.target_industry = subsidy.industry;
        }
        
        // 5. 対象従業員数
        if (subsidy.target_number_of_employees) {
          detailJson.target_employees = subsidy.target_number_of_employees;
        }
        
        // 6. 補助率
        if (subsidy.subsidy_rate) {
          detailJson.subsidy_rate = subsidy.subsidy_rate;
        }
        
        // 7. 補助上限
        if (subsidy.subsidy_max_limit) {
          detailJson.subsidy_max_limit = subsidy.subsidy_max_limit;
        }
        
        // 8. 複数申請可否
        if (subsidy.is_enable_multiple_request !== undefined) {
          detailJson.is_enable_multiple_request = subsidy.is_enable_multiple_request;
        }
        
        // 9. 申請受付有無
        if (subsidy.request_reception_presence) {
          detailJson.request_reception_presence = subsidy.request_reception_presence;
        }
        
        // 10. 型（一般型、特別枠など）
        if (subsidy.granttype) {
          detailJson.grant_type = subsidy.granttype;
        }
        
        // 11. 公募詳細ページURL
        if (subsidy.front_subsidy_detail_page_url) {
          detailJson.related_url = subsidy.front_subsidy_detail_page_url;
        }
        
        // 12. workflow（V2専用: 公募回ごとの期間情報）- SSOT化強化 v4
        if (subsidy.workflow && Array.isArray(subsidy.workflow) && subsidy.workflow.length > 0) {
          // workflow情報を保存（対象地域、募集期間など）
          detailJson.workflows = subsidy.workflow.map((w: any) => ({
            id: w.id,
            target_area: w.target_area_search,
            target_area_detail: w.target_area_detail,
            fiscal_year_round: w.fiscal_year_round,
            acceptance_start: w.acceptance_start_datetime,
            acceptance_end: w.acceptance_end_datetime,
            project_end: w.project_end_deadline,
          }));
          
          // deadline SSOT: max(acceptance_end_datetime) を採用
          const allEnds = subsidy.workflow
            .map((w: any) => w.acceptance_end_datetime)
            .filter((d: any) => d && typeof d === 'string');
          
          if (allEnds.length > 0) {
            // 日付としてソートして最大値を取得
            const sortedEnds = allEnds.sort((a: string, b: string) => 
              new Date(b).getTime() - new Date(a).getTime()
            );
            const latestEnd = sortedEnds[0];
            detailJson.acceptance_end_datetime = latestEnd;
            // deadline フィールドにも設定（WALL_CHAT_READY判定用）
            detailJson.deadline = latestEnd;
          }
          
          // 対象地域を統合（workflows から unique な地域を抽出）
          const targetAreas = subsidy.workflow
            .map((w: any) => w.target_area_search)
            .filter((a: any) => a && typeof a === 'string' && a !== '全国');
          if (targetAreas.length > 0) {
            const uniqueAreas = [...new Set(targetAreas)] as string[];
            if (uniqueAreas.length > 0 && !detailJson.target_region) {
              detailJson.target_region = uniqueAreas;
            }
          }
        }
        
        // 13. PDFリンク抽出（detail HTMLから）
        const pdfUrls: string[] = [];
        if (subsidy.detail) {
          const extractedPdfs = extractPdfLinksFromHtml(subsidy.detail);
          pdfUrls.push(...extractedPdfs);
        }
        
        // 13.5. 参照URL抽出（外部サイトへのリンク）
        if (subsidy.detail) {
          const refUrls = extractReferenceUrls(subsidy.detail);
          if (refUrls.length > 0) {
            detailJson.reference_urls = refUrls;
            console.log(`[Enrich-JGrants-v2] Found ${refUrls.length} reference URLs for ${target.id}`);
          }
        }
        
        // 14. API添付ファイル（application_guidelines, outline_of_grant, application_form）
        const attachments: Array<{ name: string; type: string; has_data: boolean }> = [];
        
        if (subsidy.application_guidelines && Array.isArray(subsidy.application_guidelines)) {
          for (const ag of subsidy.application_guidelines) {
            attachments.push({
              name: ag.name || '公募要領',
              type: 'application_guidelines',
              has_data: !!(ag.data && ag.data.length > 0),
            });
          }
        }
        if (subsidy.outline_of_grant && Array.isArray(subsidy.outline_of_grant)) {
          for (const og of subsidy.outline_of_grant) {
            attachments.push({
              name: og.name || '交付要綱',
              type: 'outline_of_grant',
              has_data: !!(og.data && og.data.length > 0),
            });
          }
        }
        if (subsidy.application_form && Array.isArray(subsidy.application_form)) {
          for (const af of subsidy.application_form) {
            attachments.push({
              name: af.name || '申請様式',
              type: 'application_form',
              has_data: !!(af.data && af.data.length > 0),
            });
          }
        }
        
        if (attachments.length > 0) {
          detailJson.attachments = attachments;
        }
        
        // 15. PDF URLs統合
        if (pdfUrls.length > 0) {
          detailJson.pdf_urls = [...new Set(pdfUrls)]; // 重複除去
        }
        
        // 16. 必要書類リスト（v4強化: attachments/application_form/outline_of_grant全体から抽出）
        const allDocNames: string[] = [];
        
        // application_form から書類名を抽出
        if (subsidy.application_form && Array.isArray(subsidy.application_form)) {
          for (const af of subsidy.application_form) {
            const name = af.name || af.title;
            if (typeof name === 'string' && name.length >= 2) {
              allDocNames.push(name);
            }
          }
        }
        
        // outline_of_grant から書類名を抽出（交付要綱等）
        if (subsidy.outline_of_grant && Array.isArray(subsidy.outline_of_grant)) {
          for (const og of subsidy.outline_of_grant) {
            const name = og.name || og.title;
            if (typeof name === 'string' && name.length >= 2) {
              allDocNames.push(name);
            }
          }
        }
        
        // application_guidelines から書類名を抽出（公募要領等）
        if (subsidy.application_guidelines && Array.isArray(subsidy.application_guidelines)) {
          for (const ag of subsidy.application_guidelines) {
            const name = ag.name || ag.title;
            if (typeof name === 'string' && name.length >= 2) {
              allDocNames.push(name);
            }
          }
        }
        
        // 重複除去して保存（空文字・短すぎるものは除外）
        const uniqueDocNames = [...new Set(allDocNames)]
          .filter(n => n.trim().length >= 2)
          .map(n => n.trim());
        
        if (uniqueDocNames.length > 0) {
          detailJson.required_documents = uniqueDocNames;
        }
        
        // 17. エンリッチメタ情報
        detailJson.enriched_at = new Date().toISOString();
        detailJson.enriched_version = 'v2';
        detailJson.api_version = 'v2';
        
        // 既存detail_jsonとマージ（v5: 空上書き禁止）
        const existing = target.detail_json ? JSON.parse(target.detail_json) : {};
        
        // v5: 空上書き禁止 - 既存値があり、新しい値が空の場合は上書きしない
        const safeFields = [
          'application_requirements', 'eligible_expenses', 'target_businesses',
          'required_documents', 'overview', 'deadline', 'acceptance_end_datetime'
        ];
        for (const field of safeFields) {
          const existingValue = existing[field];
          const newValue = detailJson[field];
          
          // 既存が有効な値を持っている場合
          const existingHasValue = existingValue && 
            (Array.isArray(existingValue) ? existingValue.length > 0 : String(existingValue).length > 0);
          
          // 新しい値が空または未定義の場合
          const newIsEmpty = !newValue || 
            (Array.isArray(newValue) && newValue.length === 0) ||
            (typeof newValue === 'string' && newValue.trim().length === 0);
          
          // 既存が有効で新しい値が空なら、detailJsonから削除（既存を維持）
          if (existingHasValue && newIsEmpty) {
            delete detailJson[field];
          }
        }
        
        const merged = { ...existing, ...detailJson };
        
        // v5: required_documents デフォルト補完
        // 条件: required_documents が null/[] で、かつ除外対象でない場合
        const hasReqDocs = merged.required_documents && 
          Array.isArray(merged.required_documents) && 
          merged.required_documents.length > 0;
        
        if (!hasReqDocs) {
          // 安全なデフォルト書類セット
          merged.required_documents = [
            '公募要領',
            '申請書',
            '事業計画書',
            '見積書',
            '会社概要'
          ];
          merged.required_documents_source = 'default_fallback_v1';
          merged.required_documents_generated_at = new Date().toISOString();
        }
        
        // v4: 壁打ち対象外判定（DB更新前に実行）
        const exclusionResult = checkExclusion(target.title, merged.overview);
        if (exclusionResult.excluded) {
          // detail_jsonに除外理由を記録
          merged.wall_chat_excluded = true;
          merged.wall_chat_excluded_reason = exclusionResult.reason_code;
          merged.wall_chat_excluded_reason_ja = exclusionResult.reason_ja;
          merged.wall_chat_excluded_at = new Date().toISOString();
          
          // DB更新（detail_jsonのみ、wall_chat_readyは0のまま）
          await db.prepare(`
            UPDATE subsidy_cache SET
              detail_json = ?,
              cached_at = datetime('now')
            WHERE id = ?
          `).bind(JSON.stringify(merged), target.id).run();
          
          console.log(`[Enrich-JGrants-v2] EXCLUDED: ${target.id} - ${exclusionResult.reason_ja}`);
          itemsSkipped++;
          continue;
        }
        
        // DB更新（通常のエンリッチ処理）
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            cached_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(merged), target.id).run();
        
        // PDFをextraction_queueに登録（Tier1は高優先度）
        if (pdfUrls.length > 0) {
          const queuePriority = target.priority_tier === 1 ? 10 : (target.priority_tier === 2 ? 50 : 100);
          const queued = await queuePdfExtraction(target.id, pdfUrls, queuePriority);
          pdfLinksQueued += queued;
        }
        
        // WALL_CHAT_READY判定（v4: タイトルも渡す）
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged), target.title);
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
          itemsReady++;
        }
        
        itemsEnriched++;
        
        // レート制限: 300ms待機（v2: やや短縮）
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        itemsSkipped++;
      }
    }
    
    console.log(`[Enrich-JGrants-v2] Completed: enriched=${itemsEnriched}, ready=${itemsReady}, pdfs_queued=${pdfLinksQueued}, skipped=${itemsSkipped}, errors=${errors.length}`);
    
    // P2-0: 実行ログ完了
    if (runId) {
      try {
        await finishCronRun(db, runId, errors.length > itemsEnriched ? 'partial' : 'success', {
          items_processed: targets.results.length,
          items_inserted: itemsEnriched,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors.slice(0, 50),
          metadata: {
            items_ready: itemsReady,
            pdf_links_queued: pdfLinksQueued,
            tier1_count: tier1Count,
            tier2_count: tier2Count,
            max_items_per_run: MAX_ITEMS_PER_RUN,
            api_version: 'v2',
          },
        });
      } catch (logErr) {
        console.warn('[Enrich-JGrants-v2] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_enriched: number;
      items_ready: number;
      items_skipped: number;
      pdf_links_queued: number;
      tier1_count: number;
      tier2_count: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'JGrants enrichment completed (v2)',
        items_enriched: itemsEnriched,
        items_ready: itemsReady,
        items_skipped: itemsSkipped,
        pdf_links_queued: pdfLinksQueued,
        tier1_count: tier1Count,
        tier2_count: tier2Count,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Enrich-JGrants-v2] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Enrich-JGrants-v2] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * Tokyo-Shigoto detail_json エンリッチジョブ
 * 
 * POST /api/cron/enrich-tokyo-shigoto
 * 
 * P3-2F: tokyo-shigoto WALL_CHAT_READY拡大
 * - 対象: wall_chat_ready=0 かつ detailUrl がある制度
 * - HTMLページから詳細を取得してdetail_jsonを充実化
 */

syncJgrants.post('/scrape-jgrants-detail', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: authResult.error!.code,
        message: authResult.error!.message,
      },
    }, authResult.error!.status);
  }
  
  // 設定 (Cloudflare Worker 30秒制限のため3件に制限)
  const MAX_ITEMS_PER_RUN = 3;
  const FIRECRAWL_API_KEY = (c.env as any).FIRECRAWL_API_KEY;
  
  let runId: string | null = null;
  let itemsProcessed = 0;
  let pdfLinksFound = 0;
  let itemsQueued = 0;
  const errors: string[] = [];
  
  try {
    runId = await startCronRun(db, 'scrape-jgrants-detail', 'cron');
    
    // pdf_urlsが空 かつ front_subsidy_detail_page_url がある制度を取得
    // Active only: 受付中のみを対象（2026-01-27 確定方針）
    const targets = await db.prepare(`
      SELECT 
        id, title, detail_json,
        json_extract(detail_json, '$.related_url') as related_url,
        json_extract(detail_json, '$.reference_urls') as reference_urls
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND wall_chat_ready = 0
        AND detail_json IS NOT NULL
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime > datetime('now')
        AND (
          json_extract(detail_json, '$.pdf_urls') IS NULL 
          OR json_extract(detail_json, '$.pdf_urls') = '[]'
          OR json_array_length(json_extract(detail_json, '$.pdf_urls')) = 0
        )
        AND json_extract(detail_json, '$.related_url') IS NOT NULL
        AND json_extract(detail_json, '$.wall_chat_excluded') IS NULL
      ORDER BY acceptance_end_datetime ASC
      LIMIT ?
    `).bind(MAX_ITEMS_PER_RUN).all<{
      id: string;
      title: string;
      detail_json: string;
      related_url: string | null;
      reference_urls: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) {
        await finishCronRun(db, runId, 'success', {
          items_processed: 0,
          metadata: { message: 'No targets found' },
        });
      }
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found for scraping' },
      });
    }
    
    console.log(`[Scrape-JGrants-Detail] Found ${targets.results.length} targets`);
    
    for (const target of targets.results) {
      try {
        const detailJson = JSON.parse(target.detail_json);
        const urlsToScrape: string[] = [];
        
        // 1. related_url (front_subsidy_detail_page_url)
        if (target.related_url) {
          urlsToScrape.push(target.related_url);
        }
        
        // 2. reference_urls から最大2件
        if (target.reference_urls) {
          try {
            const refUrls = JSON.parse(target.reference_urls);
            if (Array.isArray(refUrls)) {
              urlsToScrape.push(...refUrls.slice(0, 2));
            }
          } catch (e) {
            // JSON parse error, skip
          }
        }
        
        const pdfUrls: string[] = [];
        
        for (const url of urlsToScrape.slice(0, 3)) {
          try {
            let html = '';
            
            // Firecrawl APIで取得（SPAレンダリング対応）（Freeze-COST-2: コスト記録付き）
            if (FIRECRAWL_API_KEY) {
              const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url,
                  formats: ['html'],
                  waitFor: 3000,
                  timeout: 15000,
                }),
              });
              
              const fcSuccess = fcResponse.ok;
              if (fcSuccess) {
                const fcData = await fcResponse.json() as any;
                html = fcData.data?.html || '';
              }
              
              // Freeze-COST-2: コスト記録（PDF URL発見用スクレイプ）
              await logFirecrawlCost(db, {
                credits: 1,
                costUsd: 0.00528, // 実質単価: $190/年÷12÷3000
                url,
                success: fcSuccess,
                httpStatus: fcResponse.status,
                subsidyId: target.id,
                billing: 'known',
                rawUsage: { action: 'enrich_jgrants_pdf_discovery', htmlLength: html.length },
              }).catch((e: any) => console.warn('[Enrich-JGrants] Cost log failed:', e.message));
            }
            
            // Firecrawl失敗時は直接fetch
            if (!html) {
              const directResponse = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SubsidyBot/1.0)' },
              });
              if (directResponse.ok) {
                html = await directResponse.text();
              }
            }
            
            if (html) {
              // PDFリンク抽出
              const hrefPattern = /href=["']([^"']*\.pdf)["']/gi;
              let match;
              while ((match = hrefPattern.exec(html)) !== null) {
                let pdfUrl = match[1];
                // 相対URLを絶対URLに変換
                if (pdfUrl.startsWith('/')) {
                  const urlObj = new URL(url);
                  pdfUrl = `${urlObj.origin}${pdfUrl}`;
                } else if (!pdfUrl.startsWith('http')) {
                  const urlObj = new URL(url);
                  const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
                  pdfUrl = `${urlObj.origin}${basePath}${pdfUrl}`;
                }
                if (!pdfUrls.includes(pdfUrl)) {
                  pdfUrls.push(pdfUrl);
                }
              }
              
              // テキスト内のPDF URL
              const urlPattern = /https?:\/\/[^\s"'<>]+\.pdf/gi;
              while ((match = urlPattern.exec(html)) !== null) {
                if (!pdfUrls.includes(match[0])) {
                  pdfUrls.push(match[0]);
                }
              }
            }
            
            // レート制限
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (urlErr) {
            console.warn(`[Scrape-JGrants-Detail] Failed to fetch ${url}:`, urlErr);
          }
        }
        
        if (pdfUrls.length > 0) {
          pdfLinksFound += pdfUrls.length;
          
          // detail_json更新
          detailJson.pdf_urls = pdfUrls;
          detailJson.pdf_urls_scraped_at = new Date().toISOString();
          
          await db.prepare(`
            UPDATE subsidy_cache SET
              detail_json = ?,
              cached_at = datetime('now')
            WHERE id = ?
          `).bind(JSON.stringify(detailJson), target.id).run();
          
          // extraction_queueに登録
          for (const pdfUrl of pdfUrls.slice(0, 5)) {
            try {
              const queueId = generateUUID();
              const shard = shardKey16(target.id);
              await db.prepare(`
                INSERT OR IGNORE INTO extraction_queue 
                  (id, subsidy_id, shard_key, job_type, priority, status, created_at, updated_at)
                VALUES (?, ?, ?, 'extract_pdf', 80, 'queued', datetime('now'), datetime('now'))
              `).bind(queueId, target.id, shard).run();
              itemsQueued++;
            } catch (queueErr) {
              // 重複は無視
            }
          }
          
          console.log(`[Scrape-JGrants-Detail] ${target.id}: Found ${pdfUrls.length} PDFs`);
        } else {
          console.log(`[Scrape-JGrants-Detail] ${target.id}: No PDFs found`);
        }
        
        itemsProcessed++;
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Scrape-JGrants-Detail] Completed: processed=${itemsProcessed}, pdfs=${pdfLinksFound}, queued=${itemsQueued}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: itemsProcessed,
        items_inserted: itemsQueued,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: {
          pdf_links_found: pdfLinksFound,
        },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_processed: number;
      pdf_links_found: number;
      items_queued: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'JGrants detail scraping completed',
        items_processed: itemsProcessed,
        pdf_links_found: pdfLinksFound,
        items_queued: itemsQueued,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Scrape-JGrants-Detail] Error:', error);
    
    if (runId) {
      try {
        await finishCronRun(db, runId, 'failed', {
          error_count: 1,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (logErr) {
        console.warn('[Scrape-JGrants-Detail] Failed to finish cron_run log:', logErr);
      }
    }
    
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Scraping failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

// =====================================================
// Phase 2: Base64 PDF → R2 保存（application_guidelinesのみ）
// POST /api/cron/save-base64-pdfs
// 
// 対象: Active + pdf_urls が空 + v2 API で application_guidelines に data がある制度
// 目的: Base64 PDF を R2 に保存し、pdf_urls に追加 → extract_pdf を enqueue
// 
// 仕様:
// - Active only（acceptance_end_datetime IS NOT NULL AND > now）
// - PDFスコアリング適用（score < 0 は保存しない）
// - 公募要領（application_guidelines）のみ先に処理
// - R2キー: pdf/{subsidy_id}/{file_hash}.pdf
// =====================================================

export default syncJgrants;

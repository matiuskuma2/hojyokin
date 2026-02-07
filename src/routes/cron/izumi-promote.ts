/**
 * Cron: izumi → subsidy_cache 投入（プロモーション）
 * 
 * POST /promote-izumi-to-cache    - izumiデータをsubsidy_cacheに投入
 * POST /crawl-izumi-details       - izumiのsupport_urlをクロールしてdetail充実
 * GET  /izumi-promote-status      - 投入状況確認
 * 
 * 戦略:
 * A案（即効）: izumiの基本情報をsubsidy_cacheにINSERT（検索表示用）
 * B案（並行）: support_urlクロール → detail_json充実 → wall_chat_ready化
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret } from './_helpers';
import { checkExclusion, checkWallChatReadyFromJson } from '../../lib/wall-chat-ready';
import { simpleScrape } from '../../services/firecrawl';

const izumiPromote = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// Phase 2-A: izumi → subsidy_cache 直接投入
// POST /api/cron/promote-izumi-to-cache
// 
// izumi_subsidiesの基本情報をsubsidy_cacheに投入
// source='izumi', wall_chat_mode='pending'
// 重複排除: idがizumi-XXXXXの形式
// =====================================================

izumiPromote.post('/promote-izumi-to-cache', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 200; // 1回あたりの投入件数（Workers CPU制限対応）
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'promote-izumi-to-cache', authResult.triggeredBy);
    
    const url = new URL(c.req.url);
    const batchSize = Math.min(parseInt(url.searchParams.get('batch') || String(MAX_ITEMS)), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // izumiの未投入データを取得（subsidy_cacheに存在しないもの）
    const targets = await db.prepare(`
      SELECT 
        iz.id,
        iz.policy_id,
        iz.title,
        iz.issuer,
        iz.max_amount_text,
        iz.max_amount_value,
        iz.difficulty,
        iz.difficulty_level,
        iz.support_url,
        iz.support_urls_all,
        iz.period,
        iz.prefecture_code
      FROM izumi_subsidies iz
      WHERE iz.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM subsidy_cache sc WHERE sc.id = iz.id
        )
      ORDER BY iz.policy_id ASC
      LIMIT ?
      OFFSET ?
    `).bind(batchSize, offset).all<{
      id: string;
      policy_id: number;
      title: string;
      issuer: string | null;
      max_amount_text: string | null;
      max_amount_value: number | null;
      difficulty: string | null;
      difficulty_level: number | null;
      support_url: string | null;
      support_urls_all: string | null;
      period: string | null;
      prefecture_code: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { 
        items_processed: 0, 
        metadata: { message: 'No more izumi items to promote' } 
      });
      return c.json<ApiResponse<{ message: string; promoted: number }>>({
        success: true,
        data: { message: 'No more izumi items to promote', promoted: 0 },
      });
    }
    
    let promoted = 0;
    let skipped = 0;
    let excluded = 0;
    const errors: string[] = [];
    
    // バッチINSERT用のステートメント
    for (const iz of targets.results) {
      try {
        // 除外判定（タイトルベース）
        const exclusionResult = checkExclusion(iz.title, '');
        
        // detail_json構築
        const detailJson: Record<string, any> = {
          source: 'izumi',
          izumi_policy_id: iz.policy_id,
          izumi_detail_url: `https://j-izumi.com/policy/${iz.policy_id}/detail`,
        };
        
        // 金額情報
        if (iz.max_amount_text) {
          detailJson.max_amount_text = iz.max_amount_text;
        }
        if (iz.max_amount_value) {
          detailJson.subsidy_max_limit = iz.max_amount_value;
        }
        
        // 難易度
        if (iz.difficulty) {
          detailJson.difficulty = iz.difficulty;
          detailJson.difficulty_level = iz.difficulty_level;
        }
        
        // 発行者
        if (iz.issuer && iz.issuer.length > 0) {
          detailJson.issuer = iz.issuer;
        }
        
        // 期間情報
        if (iz.period && iz.period.length > 0) {
          detailJson.period = iz.period;
        }
        
        // support URL
        if (iz.support_url) {
          detailJson.official_url = iz.support_url;
          detailJson.related_url = iz.support_url;
        }
        
        // 全support URLs（PDF含む）
        if (iz.support_urls_all) {
          const allUrls = iz.support_urls_all.split(' | ').filter(u => u.length > 0);
          if (allUrls.length > 1) {
            detailJson.reference_urls = allUrls;
          }
          // PDFリンクを抽出
          const pdfUrls = allUrls.filter(u => u.toLowerCase().endsWith('.pdf') || u.includes('.pdf?'));
          if (pdfUrls.length > 0) {
            detailJson.pdf_urls = pdfUrls;
          }
        }
        
        // 都道府県コード → 対象地域テキスト
        const prefName = iz.prefecture_code ? prefectureCodeToName(iz.prefecture_code) : null;
        
        if (exclusionResult.excluded) {
          detailJson.wall_chat_excluded = true;
          detailJson.wall_chat_excluded_reason = exclusionResult.reason_code;
          detailJson.wall_chat_excluded_reason_ja = exclusionResult.reason_ja;
        }
        
        // subsidy_cacheにINSERT
        await db.prepare(`
          INSERT OR IGNORE INTO subsidy_cache (
            id, source, title, subsidy_max_limit, subsidy_rate,
            target_area_search, target_industry, target_number_of_employees,
            acceptance_start_datetime, acceptance_end_datetime,
            request_reception_display_flag, detail_json,
            cached_at, expires_at,
            wall_chat_ready, wall_chat_excluded, wall_chat_mode,
            is_visible
          ) VALUES (
            ?, 'izumi', ?, ?, NULL,
            ?, NULL, NULL,
            NULL, NULL,
            1, ?,
            datetime('now'), datetime('now', '+90 days'),
            0, ?, 'pending',
            1
          )
        `).bind(
          iz.id,
          iz.title,
          iz.max_amount_value || null,
          prefName || '全国',
          JSON.stringify(detailJson),
          exclusionResult.excluded ? 1 : 0,
        ).run();
        
        if (exclusionResult.excluded) {
          excluded++;
        } else {
          promoted++;
        }
        
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // UNIQUE constraint violationは重複なのでスキップ
        if (errMsg.includes('UNIQUE') || errMsg.includes('constraint')) {
          skipped++;
        } else {
          errors.push(`${iz.id}: ${errMsg}`);
        }
      }
    }
    
    // 残件数を確認
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM izumi_subsidies iz
      WHERE iz.is_active = 1 
        AND NOT EXISTS (SELECT 1 FROM subsidy_cache sc WHERE sc.id = iz.id)
    `).first<{ cnt: number }>();
    
    console.log(`[Promote-Izumi] Completed: promoted=${promoted}, excluded=${excluded}, skipped=${skipped}, remaining=${remaining?.cnt || 0}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: targets.results.length,
        items_inserted: promoted,
        items_skipped: skipped + excluded,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: {
          promoted,
          excluded,
          skipped,
          remaining: remaining?.cnt || 0,
          batch_size: batchSize,
          offset,
        },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      promoted: number;
      excluded: number;
      skipped: number;
      remaining: number;
      errors_count: number;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Izumi promotion completed: ${promoted} promoted, ${excluded} excluded`,
        promoted,
        excluded,
        skipped,
        remaining: remaining?.cnt || 0,
        errors_count: errors.length,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Promote-Izumi] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Promotion failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// Phase 2-B: izumi support_url クロール → detail_json充実
// POST /api/cron/crawl-izumi-details
//
// subsidy_cache (source=izumi) の support_url をクロール
// HTML からテキスト抽出 → overview, eligible_expenses 等を補完
// wall_chat_ready判定を実行
// =====================================================

izumiPromote.post('/crawl-izumi-details', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 5; // Workers subrequest制限対応
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'crawl-izumi-details', authResult.triggeredBy);
    
    // クロール未完了のizumiアイテムを取得
    // detail_jsonにcrawled_atがないもの = 未クロール
    const targets = await db.prepare(`
      SELECT 
        sc.id, sc.title, sc.detail_json
      FROM subsidy_cache sc
      WHERE sc.source = 'izumi'
        AND sc.wall_chat_ready = 0
        AND sc.wall_chat_excluded = 0
        AND (
          sc.detail_json IS NULL 
          OR json_extract(sc.detail_json, '$.crawled_at') IS NULL
        )
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(MAX_ITEMS).all<{
      id: string;
      title: string;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No izumi items to crawl' },
      });
    }
    
    let crawled = 0;
    let readyAfter = 0;
    let crawlFailed = 0;
    const errors: string[] = [];
    
    for (const target of targets.results) {
      try {
        const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        const supportUrl = detail.official_url || detail.related_url;
        
        if (!supportUrl) {
          detail.crawled_at = new Date().toISOString();
          detail.crawl_error = 'no_support_url';
          await db.prepare(`UPDATE subsidy_cache SET detail_json = ? WHERE id = ?`)
            .bind(JSON.stringify(detail), target.id).run();
          crawlFailed++;
          continue;
        }
        
        // HTML取得（simpleScrape: 直接fetch、タイムアウト8秒）
        const scrapeResult = await simpleScrape(supportUrl);
        
        if (!scrapeResult.success || !scrapeResult.html) {
          detail.crawled_at = new Date().toISOString();
          detail.crawl_error = scrapeResult.error || 'scrape_failed';
          await db.prepare(`UPDATE subsidy_cache SET detail_json = ? WHERE id = ?`)
            .bind(JSON.stringify(detail), target.id).run();
          crawlFailed++;
          continue;
        }
        
        // HTML → テキスト変換 & フィールド抽出
        const extractedText = htmlToPlainText(scrapeResult.html, 5000);
        const extractedFields = extractFieldsFromText(extractedText, target.title);
        
        // detail_jsonに追加
        if (extractedText.length > 50) {
          detail.overview = extractedText.substring(0, 2000);
        }
        if (extractedFields.eligible_expenses && extractedFields.eligible_expenses.length > 0) {
          detail.eligible_expenses = extractedFields.eligible_expenses;
          detail.eligible_expenses_source = 'crawl_extraction_v1';
        }
        if (extractedFields.application_requirements && extractedFields.application_requirements.length > 0) {
          detail.application_requirements = extractedFields.application_requirements;
          detail.application_requirements_source = 'crawl_extraction_v1';
        }
        if (extractedFields.required_documents && extractedFields.required_documents.length > 0) {
          detail.required_documents = extractedFields.required_documents;
          detail.required_documents_source = 'crawl_extraction_v1';
        }
        if (extractedFields.deadline) {
          detail.deadline = extractedFields.deadline;
          detail.acceptance_end_datetime = extractedFields.deadline;
        }
        
        // PDFリンク抽出
        const pdfLinks = extractPdfLinksFromHtml(scrapeResult.html, supportUrl);
        if (pdfLinks.length > 0) {
          detail.pdf_urls = [...new Set([...(detail.pdf_urls || []), ...pdfLinks])];
        }
        
        detail.crawled_at = new Date().toISOString();
        detail.crawl_source_url = supportUrl;
        detail.crawl_html_length = scrapeResult.html.length;
        detail.enriched_version = 'izumi_crawl_v1';
        
        // wall_chat_ready判定
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache 
            SET detail_json = ?, wall_chat_ready = 1, wall_chat_excluded = 0, wall_chat_mode = 'pending'
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          readyAfter++;
        } else if (readyResult.excluded) {
          detail.wall_chat_excluded_reason = readyResult.exclusion_reason;
          detail.wall_chat_excluded_reason_ja = readyResult.exclusion_reason_ja;
          await db.prepare(`
            UPDATE subsidy_cache 
            SET detail_json = ?, wall_chat_ready = 0, wall_chat_excluded = 1
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
        } else {
          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
        }
        
        // izumi_subsidiesのcrawl_statusも更新
        await db.prepare(`
          UPDATE izumi_subsidies 
          SET crawl_status = 'done', last_crawled_at = datetime('now')
          WHERE id = ?
        `).bind(target.id).run();
        
        crawled++;
        
        // レート制限: 500ms待機
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // 残件確認
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM subsidy_cache
      WHERE source = 'izumi' AND wall_chat_ready = 0 AND wall_chat_excluded = 0
        AND (detail_json IS NULL OR json_extract(detail_json, '$.crawled_at') IS NULL)
    `).first<{ cnt: number }>();
    
    console.log(`[Crawl-Izumi] Completed: crawled=${crawled}, ready=${readyAfter}, failed=${crawlFailed}, remaining=${remaining?.cnt || 0}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: targets.results.length,
        items_inserted: readyAfter,
        items_updated: crawled,
        items_skipped: crawlFailed,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: { crawled, ready_after: readyAfter, crawl_failed: crawlFailed, remaining: remaining?.cnt || 0 },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      crawled: number;
      ready_after: number;
      crawl_failed: number;
      remaining: number;
      errors_count: number;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: `Izumi crawl completed: ${crawled} crawled, ${readyAfter} ready`,
        crawled,
        ready_after: readyAfter,
        crawl_failed: crawlFailed,
        remaining: remaining?.cnt || 0,
        errors_count: errors.length,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Crawl-Izumi] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Crawl failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// GET /api/cron/izumi-promote-status
// 投入状況サマリ
// =====================================================

izumiPromote.get('/izumi-promote-status', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  try {
    // izumi_subsidies 総数
    const izumiTotal = await db.prepare(`
      SELECT COUNT(*) as total FROM izumi_subsidies WHERE is_active = 1
    `).first<{ total: number }>();
    
    // subsidy_cache(source=izumi)の状態
    const cacheStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN wall_chat_excluded = 1 THEN 1 ELSE 0 END) as excluded,
        SUM(CASE WHEN wall_chat_ready = 0 AND wall_chat_excluded = 0 THEN 1 ELSE 0 END) as not_ready,
        SUM(CASE WHEN json_extract(detail_json, '$.crawled_at') IS NOT NULL THEN 1 ELSE 0 END) as crawled
      FROM subsidy_cache
      WHERE source = 'izumi'
    `).first<{
      total: number;
      ready: number;
      excluded: number;
      not_ready: number;
      crawled: number;
    }>();
    
    // 未投入件数
    const remaining = await db.prepare(`
      SELECT COUNT(*) as cnt FROM izumi_subsidies iz
      WHERE iz.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM subsidy_cache sc WHERE sc.id = iz.id)
    `).first<{ cnt: number }>();
    
    // 全体のcache統計
    const overallStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        source, COUNT(*) as cnt
      FROM subsidy_cache
      GROUP BY source
      ORDER BY cnt DESC
    `).all();
    
    return c.json<ApiResponse<{
      izumi_total: number;
      promoted_to_cache: number;
      remaining_to_promote: number;
      cache_izumi: {
        total: number;
        ready: number;
        excluded: number;
        not_ready: number;
        crawled: number;
      };
      by_source: any[];
    }>>({
      success: true,
      data: {
        izumi_total: izumiTotal?.total || 0,
        promoted_to_cache: cacheStats?.total || 0,
        remaining_to_promote: remaining?.cnt || 0,
        cache_izumi: {
          total: cacheStats?.total || 0,
          ready: cacheStats?.ready || 0,
          excluded: cacheStats?.excluded || 0,
          not_ready: cacheStats?.not_ready || 0,
          crawled: cacheStats?.crawled || 0,
        },
        by_source: overallStats.results || [],
      },
    });
    
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) },
    }, 500);
  }
});

// =====================================================
// ヘルパー関数
// =====================================================

/**
 * 都道府県コード → 名前変換
 */
function prefectureCodeToName(code: string): string | null {
  const map: Record<string, string> = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県',
  };
  return map[code] || null;
}

/**
 * HTML → プレーンテキスト変換（軽量版）
 */
function htmlToPlainText(html: string, maxLength: number = 5000): string {
  let text = html
    // scriptとstyleタグ除去
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // HTMLタグ除去
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // HTMLエンティティ変換
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    // 空白正規化
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  return text.substring(0, maxLength);
}

/**
 * テキストからフィールド抽出
 */
function extractFieldsFromText(text: string, title: string): {
  eligible_expenses: string[];
  application_requirements: string[];
  required_documents: string[];
  deadline: string | null;
} {
  const result: {
    eligible_expenses: string[];
    application_requirements: string[];
    required_documents: string[];
    deadline: string | null;
  } = {
    eligible_expenses: [],
    application_requirements: [],
    required_documents: [],
    deadline: null,
  };
  
  // 対象経費の抽出パターン
  const expensePatterns = [
    /対象経費[：:]\s*(.+?)(?:\n|$)/gi,
    /補助対象[：:]\s*(.+?)(?:\n|$)/gi,
    /助成対象[：:]\s*(.+?)(?:\n|$)/gi,
    /経費[：:]\s*(.+?)(?:\n|$)/gi,
  ];
  
  for (const pattern of expensePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const items = match[1].split(/[、，,・]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 50);
      result.eligible_expenses.push(...items);
    }
  }
  
  // タイトルからもカテゴリ推定
  if (result.eligible_expenses.length === 0) {
    const t = title.toLowerCase();
    if (t.includes('設備') || t.includes('機械') || t.includes('導入')) {
      result.eligible_expenses = ['機械装置・システム構築費', '設備購入費'];
    } else if (t.includes('it') || t.includes('デジタル') || t.includes('dx')) {
      result.eligible_expenses = ['ソフトウェア購入費', 'クラウド利用費'];
    } else if (t.includes('研修') || t.includes('人材') || t.includes('育成')) {
      result.eligible_expenses = ['研修費', '外部専門家経費'];
    } else if (t.includes('販路') || t.includes('海外') || t.includes('展示会')) {
      result.eligible_expenses = ['広報費', '展示会出展費'];
    } else if (t.includes('創業') || t.includes('起業')) {
      result.eligible_expenses = ['設備費', '広報費', '開業費'];
    } else {
      result.eligible_expenses = ['設備費', '外注費', '委託費'];
    }
  }
  
  // 申請要件の抽出
  const reqPatterns = [
    /対象者[：:]\s*(.+?)(?:\n|$)/gi,
    /申請要件[：:]\s*(.+?)(?:\n|$)/gi,
    /対象[：:]\s*(.+?)(?:\n|$)/gi,
  ];
  
  for (const pattern of reqPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const items = match[1].split(/[、，,]/).map(s => s.trim()).filter(s => s.length >= 3 && s.length <= 100);
      result.application_requirements.push(...items);
    }
  }
  
  if (result.application_requirements.length === 0) {
    result.application_requirements = [
      '日本国内に事業所を有すること',
      '税務申告を適正に行っていること',
    ];
  }
  
  // 必要書類の抽出
  const docPatterns = [
    /必要書類[：:]\s*(.+?)(?:\n|$)/gi,
    /提出書類[：:]\s*(.+?)(?:\n|$)/gi,
    /申請書類[：:]\s*(.+?)(?:\n|$)/gi,
  ];
  
  for (const pattern of docPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const items = match[1].split(/[、，,・]/).map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 50);
      result.required_documents.push(...items);
    }
  }
  
  if (result.required_documents.length === 0) {
    result.required_documents = ['申請書', '事業計画書', '見積書'];
  }
  
  // 締切日の抽出
  const deadlinePatterns = [
    /(?:締切|期限|期日|〆切|しめきり)[：:日は]\s*(令和\d+年\d+月\d+日|20\d{2}[年\/\-]\d{1,2}[月\/\-]\d{1,2}日?)/gi,
    /(?:受付期間|募集期間|申請期間)[：:は]\s*[\s\S]*?(?:～|~|から)\s*(令和\d+年\d+月\d+日|20\d{2}[年\/\-]\d{1,2}[月\/\-]\d{1,2}日?)/gi,
  ];
  
  for (const pattern of deadlinePatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.deadline = match[1];
      break;
    }
  }
  
  return result;
}

/**
 * HTMLからPDFリンクを抽出
 */
function extractPdfLinksFromHtml(html: string, baseUrl: string): string[] {
  const pdfUrls: string[] = [];
  const hrefPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  let match;
  
  while ((match = hrefPattern.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        url = `${base.protocol}//${base.host}${url}`;
      } catch { continue; }
    } else if (!url.startsWith('http')) {
      continue;
    }
    pdfUrls.push(url);
  }
  
  return [...new Set(pdfUrls)];
}

export default izumiPromote;

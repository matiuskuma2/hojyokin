/**
 * Cron: 公募要領PDF定点観測クロールエンジン
 * 
 * POST /koubo-crawl           - 定期クロール実行（次回クロール日到来分を処理）
 * POST /koubo-crawl-single    - 特定の補助金を即座にクロール
 * POST /koubo-check-period    - 公募時期判定（公募開始・終了を検知）
 * GET  /koubo-dashboard       - 定点観測ダッシュボード用データ（認証不要）
 * POST /koubo-discover        - 新規補助金発見の承認/却下
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret } from './_helpers';

const kouboCrawl = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================
// Helper: URLの到達性チェック + PDFリンク抽出
// =====================================================
async function checkUrlReachability(url: string): Promise<{
  reachable: boolean;
  httpStatus: number;
  contentType: string;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'HojyorakuBot/1.0 (+https://hojyokin.pages.dev)' },
      redirect: 'follow',
    });
    return {
      reachable: response.ok,
      httpStatus: response.status,
      contentType: response.headers.get('content-type') || '',
    };
  } catch (e: any) {
    return { reachable: false, httpStatus: 0, contentType: '', error: e.message };
  }
}

async function fetchPageAndExtractPdfs(url: string): Promise<{
  ok: boolean;
  httpStatus: number;
  pdfUrls: Array<{ url: string; text: string; isKoubo: boolean }>;
  contentHash: string;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'HojyorakuBot/1.0 (+https://hojyokin.pages.dev)' },
      redirect: 'follow',
    });
    if (!response.ok) {
      return { ok: false, httpStatus: response.status, pdfUrls: [], contentHash: '' };
    }
    const html = await response.text();
    
    // Content hash for change detection
    const encoder = new TextEncoder();
    const data = encoder.encode(html);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    
    // Extract PDF URLs
    const pdfUrls: Array<{ url: string; text: string; isKoubo: boolean }> = [];
    const hrefRegex = /<a\s+[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      let pdfUrl = match[1];
      const linkText = match[2].replace(/<[^>]+>/g, '').trim();
      
      // Resolve relative URL
      if (pdfUrl.startsWith('/')) {
        const base = new URL(url);
        pdfUrl = base.origin + pdfUrl;
      } else if (!pdfUrl.startsWith('http')) {
        const base = url.substring(0, url.lastIndexOf('/') + 1);
        pdfUrl = base + pdfUrl;
      }
      
      // Koubo keyword detection
      const kouboKeywords = /公募要領|公募要綱|募集要項|boshu|koubo|youryou|youkou|guideline|募集案内|交付要綱/i;
      const isKoubo = kouboKeywords.test(linkText) || kouboKeywords.test(pdfUrl);
      
      pdfUrls.push({ url: pdfUrl, text: linkText, isKoubo });
    }
    
    return { ok: true, httpStatus: response.status, pdfUrls, contentHash };
  } catch (e: any) {
    return { ok: false, httpStatus: 0, pdfUrls: [], contentHash: '', error: e.message };
  }
}

// =====================================================
// POST /koubo-crawl - 定期クロール実行
// =====================================================
kouboCrawl.post('/koubo-crawl', async (c) => {
  const db = c.env.DB;
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json({ success: false, error: authResult.error!.message }, authResult.error!.status as any);
  }
  
  const batchSize = parseInt(c.req.query('batch') || '10');
  const runId = await startCronRun(db, 'koubo_crawl');
  
  try {
    // 次回クロール日を過ぎたactive件を取得
    const targets = await db.prepare(`
      SELECT km.subsidy_id, km.koubo_pdf_url, km.koubo_page_url, km.crawl_schedule,
             km.last_crawl_result, km.koubo_period_type, sc.title
      FROM koubo_monitors km
      LEFT JOIN subsidy_cache sc ON sc.id = km.subsidy_id
      WHERE km.status = 'active'
        AND km.crawl_schedule != 'stopped'
        AND km.crawl_schedule != 'on_demand'
        AND (km.next_crawl_at IS NULL OR km.next_crawl_at <= datetime('now'))
      ORDER BY 
        CASE km.crawl_schedule
          WHEN 'pre_koubo' THEN 1
          WHEN 'weekly' THEN 2
          WHEN 'biweekly' THEN 3
          WHEN 'monthly' THEN 4
          WHEN 'quarterly' THEN 5
        END,
        km.next_crawl_at ASC
      LIMIT ?
    `).bind(batchSize).all();
    
    let processed = 0, success = 0, urlChanged = 0, urlLost = 0, errors = 0;
    
    for (const target of targets.results) {
      processed++;
      const subsidyId = target.subsidy_id as string;
      
      try {
        // PDF URLを直接チェック
        if (target.koubo_pdf_url) {
          const pdfCheck = await checkUrlReachability(target.koubo_pdf_url as string);
          
          if (pdfCheck.reachable) {
            // PDF到達OK - next_crawlを更新
            const nextCrawl = getNextCrawlDate(target.crawl_schedule as string);
            await db.prepare(`
              UPDATE koubo_monitors SET 
                last_crawl_at = datetime('now'),
                last_crawl_result = 'success',
                next_crawl_at = ?,
                updated_at = datetime('now')
              WHERE subsidy_id = ?
            `).bind(nextCrawl, subsidyId).run();
            
            await db.prepare(`
              INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, checked_url, http_status, finished_at)
              VALUES (?, 'scheduled', 'success', ?, ?, datetime('now'))
            `).bind(subsidyId, target.koubo_pdf_url, pdfCheck.httpStatus).run();
            
            success++;
            continue;
          }
          
          // PDF到達不可 → ページURLから再探索
          if (target.koubo_page_url) {
            const pageResult = await fetchPageAndExtractPdfs(target.koubo_page_url as string);
            if (pageResult.ok && pageResult.pdfUrls.length > 0) {
              const kouboUrl = pageResult.pdfUrls.find(p => p.isKoubo);
              if (kouboUrl) {
                // 新しい公募要領URLを発見
                await db.prepare(`
                  UPDATE koubo_monitors SET
                    koubo_pdf_url = ?,
                    koubo_pdf_backup_urls = json_insert(COALESCE(koubo_pdf_backup_urls, '[]'), '$[#]', ?),
                    last_crawl_at = datetime('now'),
                    last_crawl_result = 'url_changed',
                    next_crawl_at = ?,
                    url_change_count = url_change_count + 1,
                    last_url_change_at = datetime('now'),
                    updated_at = datetime('now')
                  WHERE subsidy_id = ?
                `).bind(
                  kouboUrl.url,
                  target.koubo_pdf_url,
                  getNextCrawlDate(target.crawl_schedule as string),
                  subsidyId
                ).run();
                
                await db.prepare(`
                  INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, checked_url, found_pdf_url, previous_pdf_url, content_hash, finished_at)
                  VALUES (?, 'scheduled', 'url_changed', ?, ?, ?, ?, datetime('now'))
                `).bind(subsidyId, target.koubo_page_url, kouboUrl.url, target.koubo_pdf_url, pageResult.contentHash).run();
                
                urlChanged++;
                continue;
              }
            }
          }
          
          // URL消失 → url_lostに変更
          await db.prepare(`
            UPDATE koubo_monitors SET
              status = 'url_lost',
              last_crawl_at = datetime('now'),
              last_crawl_result = 'not_found',
              updated_at = datetime('now')
            WHERE subsidy_id = ?
          `).bind(subsidyId).run();
          
          await db.prepare(`
            INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, checked_url, finished_at)
            VALUES (?, 'scheduled', 'page_not_found', ?, datetime('now'))
          `).bind(subsidyId, target.koubo_pdf_url).run();
          
          urlLost++;
        } else {
          // PDF URLなし → ページURLからの探索
          if (target.koubo_page_url) {
            const pageResult = await fetchPageAndExtractPdfs(target.koubo_page_url as string);
            if (pageResult.ok) {
              const kouboUrl = pageResult.pdfUrls.find(p => p.isKoubo);
              if (kouboUrl) {
                await db.prepare(`
                  UPDATE koubo_monitors SET
                    koubo_pdf_url = ?,
                    last_crawl_at = datetime('now'),
                    last_crawl_result = 'success',
                    next_crawl_at = ?,
                    updated_at = datetime('now')
                  WHERE subsidy_id = ?
                `).bind(kouboUrl.url, getNextCrawlDate(target.crawl_schedule as string), subsidyId).run();
                
                await db.prepare(`
                  INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, checked_url, found_pdf_url, content_hash, finished_at)
                  VALUES (?, 'scheduled', 'new_url_found', ?, ?, ?, datetime('now'))
                `).bind(subsidyId, target.koubo_page_url, kouboUrl.url, pageResult.contentHash).run();
                
                success++;
                continue;
              }
            }
          }
          
          // 探索失敗
          const nextCrawl = getNextCrawlDate(target.crawl_schedule as string);
          await db.prepare(`
            UPDATE koubo_monitors SET
              last_crawl_at = datetime('now'),
              last_crawl_result = 'not_found',
              next_crawl_at = ?,
              updated_at = datetime('now')
            WHERE subsidy_id = ?
          `).bind(nextCrawl, subsidyId).run();
          
          errors++;
        }
      } catch (e: any) {
        errors++;
        await db.prepare(`
          INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, error_message, finished_at)
          VALUES (?, 'scheduled', 'error', ?, datetime('now'))
        `).bind(subsidyId, e.message).run();
      }
    }
    
    await finishCronRun(db, runId, errors > 0 ? 'partial' : 'success', {
      items_processed: processed,
      items_updated: success + urlChanged,
      error_count: errors,
      metadata: { success, url_changed: urlChanged, url_lost: urlLost, errors }
    });
    
    return c.json({
      success: true,
      data: { run_id: runId, processed, success, url_changed: urlChanged, url_lost: urlLost, errors }
    });
  } catch (e: any) {
    await finishCronRun(db, runId, 'failed', { error_count: 1, errors: [e.message] });
    return c.json({ success: false, error: e.message }, 500);
  }
});

// =====================================================
// POST /koubo-crawl-single - 特定補助金の即座クロール
// =====================================================
kouboCrawl.post('/koubo-crawl-single', async (c) => {
  const db = c.env.DB;
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json({ success: false, error: authResult.error!.message }, authResult.error!.status as any);
  }
  
  const { subsidy_id } = await c.req.json<{ subsidy_id: string }>();
  
  const monitor = await db.prepare(`
    SELECT km.*, sc.title
    FROM koubo_monitors km
    LEFT JOIN subsidy_cache sc ON sc.id = km.subsidy_id
    WHERE km.subsidy_id = ?
  `).bind(subsidy_id).first();
  
  if (!monitor) {
    return c.json({ success: false, error: 'Monitor not found' }, 404);
  }
  
  // PDF URL チェック
  let result: any = { subsidy_id, title: monitor.title };
  
  if (monitor.koubo_pdf_url) {
    const pdfCheck = await checkUrlReachability(monitor.koubo_pdf_url as string);
    result.pdf_reachable = pdfCheck.reachable;
    result.http_status = pdfCheck.httpStatus;
    
    if (pdfCheck.reachable) {
      await db.prepare(`
        UPDATE koubo_monitors SET last_crawl_at = datetime('now'), last_crawl_result = 'success', updated_at = datetime('now')
        WHERE subsidy_id = ?
      `).bind(subsidy_id).run();
      result.action = 'pdf_verified';
    }
  }
  
  // ページURL チェック
  if (monitor.koubo_page_url) {
    const pageResult = await fetchPageAndExtractPdfs(monitor.koubo_page_url as string);
    result.page_reachable = pageResult.ok;
    result.pdf_links_found = pageResult.pdfUrls.length;
    result.koubo_links = pageResult.pdfUrls.filter(p => p.isKoubo);
    result.content_hash = pageResult.contentHash;
  }
  
  await db.prepare(`
    INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, result, checked_url, finished_at)
    VALUES (?, 'manual', ?, ?, datetime('now'))
  `).bind(subsidy_id, result.pdf_reachable ? 'success' : 'pdf_not_found', monitor.koubo_pdf_url || monitor.koubo_page_url).run();
  
  return c.json({ success: true, data: result });
});

// =====================================================
// POST /koubo-check-period - 公募時期判定
// 公募開始/終了の検知、時期判明時にpre_kouboスケジュール設定
// =====================================================
kouboCrawl.post('/koubo-check-period', async (c) => {
  const db = c.env.DB;
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json({ success: false, error: authResult.error!.message }, authResult.error!.status as any);
  }
  
  // subsidy_cacheから公募日程情報を取得して、koubo_monitorsの時期情報を更新
  const subsidiesWithDates = await db.prepare(`
    SELECT sc.id, sc.acceptance_start_datetime, sc.acceptance_end_datetime,
           km.koubo_period_type, km.koubo_month_start, km.crawl_schedule
    FROM subsidy_cache sc
    JOIN koubo_monitors km ON km.subsidy_id = sc.id
    WHERE km.status = 'active'
      AND sc.acceptance_start_datetime IS NOT NULL
      AND km.koubo_period_type = 'unknown'
    LIMIT 100
  `).all();
  
  let updated = 0;
  for (const sub of subsidiesWithDates.results) {
    const startDate = sub.acceptance_start_datetime as string;
    if (!startDate) continue;
    
    const month = parseInt(startDate.substring(5, 7));
    if (isNaN(month)) continue;
    
    // 公募開始月を設定し、次回はその2週間前にクロールする
    const nextYear = new Date().getFullYear() + 1;
    const nextExpected = `${nextYear}-${String(month).padStart(2, '0')}-01`;
    const preCrawl = new Date(nextExpected);
    preCrawl.setDate(preCrawl.getDate() - 14);
    
    await db.prepare(`
      UPDATE koubo_monitors SET
        koubo_period_type = 'annual_fixed',
        koubo_month_start = ?,
        crawl_schedule = 'pre_koubo',
        koubo_next_expected_at = ?,
        next_crawl_at = ?,
        updated_at = datetime('now')
      WHERE subsidy_id = ?
    `).bind(month, nextExpected, preCrawl.toISOString().split('T')[0], sub.id).run();
    
    updated++;
  }
  
  return c.json({
    success: true,
    data: { checked: subsidiesWithDates.results.length, updated }
  });
});

// =====================================================
// GET /koubo-dashboard - 定点観測ダッシュボードデータ
// 認証不要（公開ダッシュボード）
// =====================================================
kouboCrawl.get('/koubo-dashboard', async (c) => {
  const db = c.env.DB;
  
  // 1. 全体統計
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'url_lost' THEN 1 ELSE 0 END) as url_lost,
      SUM(CASE WHEN status = 'needs_manual' THEN 1 ELSE 0 END) as needs_manual,
      SUM(CASE WHEN status = 'discontinued' THEN 1 ELSE 0 END) as discontinued,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      SUM(CASE WHEN koubo_pdf_url IS NOT NULL THEN 1 ELSE 0 END) as with_pdf,
      SUM(CASE WHEN last_crawl_result = 'success' THEN 1 ELSE 0 END) as last_success,
      SUM(CASE WHEN crawl_schedule = 'pre_koubo' THEN 1 ELSE 0 END) as pre_koubo,
      SUM(CASE WHEN crawl_schedule = 'monthly' THEN 1 ELSE 0 END) as monthly,
      SUM(CASE WHEN next_crawl_at < datetime('now') AND status = 'active' THEN 1 ELSE 0 END) as overdue
    FROM koubo_monitors
  `).first();

  // 2. ステータス別アラート件数
  const alerts = await db.prepare(`
    SELECT 
      km.subsidy_id, sc.title, sc.source, km.status, km.last_crawl_result,
      km.koubo_pdf_url, km.last_crawl_at, km.updated_at,
      CASE 
        WHEN km.status = 'url_lost' THEN 'URL消失'
        WHEN km.status = 'needs_manual' THEN '手動対応必要'
        WHEN km.status = 'discontinued' THEN '補助金廃止'
        WHEN km.next_crawl_at < datetime('now') AND km.status = 'active' THEN 'クロール期限超過'
        ELSE 'OK'
      END as alert_type
    FROM koubo_monitors km
    LEFT JOIN subsidy_cache sc ON sc.id = km.subsidy_id
    WHERE km.status IN ('url_lost', 'needs_manual')
       OR (km.next_crawl_at < datetime('now') AND km.status = 'active')
    ORDER BY 
      CASE km.status WHEN 'url_lost' THEN 1 WHEN 'needs_manual' THEN 2 ELSE 3 END,
      km.updated_at DESC
    LIMIT 50
  `).all();

  // 3. 公募時期分布
  const periodDist = await db.prepare(`
    SELECT koubo_period_type, COUNT(*) as cnt
    FROM koubo_monitors
    GROUP BY koubo_period_type
    ORDER BY cnt DESC
  `).all();

  // 4. スケジュール分布
  const scheduleDist = await db.prepare(`
    SELECT crawl_schedule, COUNT(*) as cnt
    FROM koubo_monitors
    GROUP BY crawl_schedule
    ORDER BY cnt DESC
  `).all();

  // 5. 最近のクロール履歴
  const recentCrawls = await db.prepare(`
    SELECT cl.subsidy_id, sc.title, cl.crawl_type, cl.result, cl.found_pdf_url, cl.error_message, cl.finished_at
    FROM koubo_crawl_log cl
    LEFT JOIN subsidy_cache sc ON sc.id = cl.subsidy_id
    ORDER BY cl.created_at DESC
    LIMIT 30
  `).all();

  // 6. 新規発見キュー
  const discoveries = await db.prepare(`
    SELECT COUNT(*) as cnt FROM koubo_discovery_queue WHERE status = 'pending'
  `).first();

  // 7. 情報源別カバレッジ
  const coverage = await db.prepare(`
    SELECT 
      sc.source,
      COUNT(DISTINCT sc.id) as total_subsidies,
      COUNT(DISTINCT km.subsidy_id) as monitored,
      SUM(CASE WHEN km.koubo_pdf_url IS NOT NULL THEN 1 ELSE 0 END) as with_pdf
    FROM subsidy_cache sc
    LEFT JOIN koubo_monitors km ON km.subsidy_id = sc.id
    GROUP BY sc.source
    ORDER BY total_subsidies DESC
  `).all();

  return c.json({
    success: true,
    data: {
      stats,
      alerts: alerts.results,
      period_distribution: periodDist.results,
      schedule_distribution: scheduleDist.results,
      recent_crawls: recentCrawls.results,
      pending_discoveries: discoveries?.cnt || 0,
      coverage: coverage.results,
      generated_at: new Date().toISOString()
    }
  });
});

// =====================================================
// POST /koubo-discover - 新規発見の承認/却下
// =====================================================
kouboCrawl.post('/koubo-discover', async (c) => {
  const db = c.env.DB;
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json({ success: false, error: authResult.error!.message }, authResult.error!.status as any);
  }
  
  const { discovery_id, action, reject_reason } = await c.req.json<{
    discovery_id: number;
    action: 'approve' | 'reject';
    reject_reason?: string;
  }>();
  
  if (action === 'approve') {
    const item = await db.prepare(`
      SELECT * FROM koubo_discovery_queue WHERE id = ?
    `).bind(discovery_id).first();
    
    if (!item) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    
    // subsidy_cacheに新規追加
    const newId = `DISC-${Date.now()}`;
    await db.prepare(`
      INSERT OR IGNORE INTO subsidy_cache (id, source, title, detail_json, cached_at, expires_at)
      VALUES (?, 'discovery', ?, '{}', datetime('now'), datetime('now', '+365 days'))
    `).bind(newId, item.title).run();
    
    // koubo_monitorsに追加
    await db.prepare(`
      INSERT OR IGNORE INTO koubo_monitors (subsidy_id, koubo_pdf_url, koubo_page_url, status, crawl_schedule)
      VALUES (?, ?, ?, 'active', 'monthly')
    `).bind(newId, item.pdf_url, item.url).run();
    
    // discovery_queueを更新
    await db.prepare(`
      UPDATE koubo_discovery_queue SET status = 'approved', approved_subsidy_id = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).bind(newId, discovery_id).run();
    
    return c.json({ success: true, data: { new_subsidy_id: newId } });
  } else {
    await db.prepare(`
      UPDATE koubo_discovery_queue SET status = 'rejected', rejected_reason = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).bind(reject_reason || '対象外', discovery_id).run();
    
    return c.json({ success: true, message: 'Rejected' });
  }
});

// =====================================================
// Helper: 次回クロール日の計算
// =====================================================
function getNextCrawlDate(schedule: string): string {
  const now = new Date();
  switch (schedule) {
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'biweekly':
      now.setDate(now.getDate() + 14);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    case 'quarterly':
      now.setMonth(now.getMonth() + 3);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString().split('T')[0];
}

export default kouboCrawl;

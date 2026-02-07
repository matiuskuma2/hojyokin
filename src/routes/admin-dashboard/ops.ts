/**
 * Admin Dashboard: 運用操作
 * 
 * GET /ops/data-health     - データヘルスチェック
 * POST /ops/trigger-sync   - 同期トリガー
 * GET /ops/daily-report    - 日次レポート
 * GET /ops/source-summary  - ソースサマリー
 * GET /cron-status         - Cronステータス
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../../middleware/auth';

const ops = new Hono<{ Bindings: Env; Variables: Variables }>();

ops.get('/ops/data-health', async (c) => {
  const db = c.env.DB;
  
  try {
    // A. 総数・有効・主要欠損（最重要）
    const mainStats = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN request_reception_display_flag = 1 THEN 1 ELSE 0 END) AS accepting_flag_1,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL THEN 1 ELSE 0 END) AS has_deadline,
        SUM(CASE WHEN target_area_search IS NOT NULL AND target_area_search != '' THEN 1 ELSE 0 END) AS has_area,
        SUM(CASE WHEN subsidy_max_limit IS NOT NULL AND subsidy_max_limit > 0 THEN 1 ELSE 0 END) AS has_amount,
        SUM(CASE WHEN target_industry IS NOT NULL AND target_industry != '' THEN 1 ELSE 0 END) AS has_industry
      FROM subsidy_cache
    `).first<{
      total: number;
      valid: number;
      accepting_flag_1: number;
      has_deadline: number;
      has_area: number;
      has_amount: number;
      has_industry: number;
    }>();
    
    // B. 期限切れ（混入監視）
    const expiredCount = await db.prepare(`
      SELECT COUNT(*) AS expired
      FROM subsidy_cache
      WHERE acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime < datetime('now')
    `).first<{ expired: number }>();
    
    // C. 直近24時間の更新（cronが回った証拠）
    const recentUpdate = await db.prepare(`
      SELECT COUNT(*) AS updated_last_24h
      FROM subsidy_cache
      WHERE cached_at >= datetime('now', '-24 hours')
    `).first<{ updated_last_24h: number }>();
    
    // D. ソース別（JGrants / manual / crawl の比率）
    const bySource = await db.prepare(`
      SELECT source, COUNT(*) AS cnt
      FROM subsidy_cache
      GROUP BY source
      ORDER BY cnt DESC
    `).all();
    
    // E. キャッシュ期限の範囲
    const cacheRange = await db.prepare(`
      SELECT 
        MIN(cached_at) AS oldest_cache,
        MAX(cached_at) AS newest_cache,
        MIN(expires_at) AS earliest_expiry,
        MAX(expires_at) AS latest_expiry
      FROM subsidy_cache
    `).first<{
      oldest_cache: string;
      newest_cache: string;
      earliest_expiry: string;
      latest_expiry: string;
    }>();
    
    // F. 壊れURLの検出（example.com混入チェック）
    const brokenLinks = await db.prepare(`
      SELECT COUNT(*) AS broken_count
      FROM subsidy_cache
      WHERE detail_json LIKE '%example.com%'
    `).first<{ broken_count: number }>();
    
    // G. 最終同期からの経過時間
    const lastSync = await db.prepare(`
      SELECT MAX(cached_at) AS last_sync
      FROM subsidy_cache
    `).first<{ last_sync: string }>();
    
    // 凍結基準に基づく健全性判定
    const total = mainStats?.total || 0;
    const valid = mainStats?.valid || 0;
    const hasDeadline = mainStats?.has_deadline || 0;
    const hasArea = mainStats?.has_area || 0;
    const hasAmount = mainStats?.has_amount || 0;
    const hasIndustry = mainStats?.has_industry || 0;
    const updated24h = recentUpdate?.updated_last_24h || 0;
    
    const health = {
      // 凍結目標値
      targets: {
        total_target: 500,
        deadline_target_pct: 95,
        area_target_pct: 95,
        amount_target_pct: 80,
        industry_note: '業種条件はJGrants元データの問題。空=全業種扱いで対応済み',
      },
      
      // 現在値
      current: {
        total,
        valid,
        accepting: mainStats?.accepting_flag_1 || 0,
        has_deadline: hasDeadline,
        has_area: hasArea,
        has_amount: hasAmount,
        has_industry: hasIndustry,
        expired_subsidies: expiredCount?.expired || 0,
        updated_last_24h: updated24h,
        broken_links: brokenLinks?.broken_count || 0,
        last_sync: lastSync?.last_sync || null,
      },
      
      // 充足率（%）
      percentages: {
        valid_pct: total > 0 ? Math.round((valid / total) * 100) : 0,
        deadline_pct: total > 0 ? Math.round((hasDeadline / total) * 100) : 0,
        area_pct: total > 0 ? Math.round((hasArea / total) * 100) : 0,
        amount_pct: total > 0 ? Math.round((hasAmount / total) * 100) : 0,
        industry_pct: total > 0 ? Math.round((hasIndustry / total) * 100) : 0,
        total_progress_pct: Math.round((total / 500) * 100),
      },
      
      // ステータス判定
      status: {
        total_ok: total >= 500,
        deadline_ok: total > 0 && (hasDeadline / total) >= 0.95,
        area_ok: total > 0 && (hasArea / total) >= 0.95,
        amount_ok: total > 0 && (hasAmount / total) >= 0.80,
        cron_ok: updated24h > 0,
        broken_links_ok: (brokenLinks?.broken_count || 0) === 0,
        overall: total >= 500 && updated24h > 0 && (brokenLinks?.broken_count || 0) === 0 
          ? 'HEALTHY' 
          : total >= 100 
            ? 'BUILDING' 
            : 'CRITICAL',
      },
      
      // ソース別
      by_source: bySource.results || [],
      
      // キャッシュ範囲
      cache_range: cacheRange,
      
      // 生成時刻
      generated_at: new Date().toISOString(),
    };
    
    return c.json<ApiResponse<typeof health>>({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Data health check error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DATA_HEALTH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin/ops/trigger-sync
 * 
 * 手動でJGrants同期をトリガー（super_admin専用）
 * ops画面から「今すぐ同期」ボタンで使う
 */
ops.post('/ops/trigger-sync', async (c) => {
  const user = getCurrentUser(c);
  
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }
  
  // 内部的に cron エンドポイントと同じ処理を実行（v1.3: 受付終了含む）
  const db = c.env.DB;
  
  try {
    // 凍結キーワードセット（v1.3）- cron.ts と同一
    const KEYWORDS = [
      '補助金', '助成金', '事業', '支援', '申請', '公募',
      'DX', 'IT導入', '省エネ', '雇用', '設備投資',
      '製造業', 'デジタル化', '創業', '販路開拓', '人材育成', '研究開発', '生産性向上',
      '中小企業', '小規模事業者', '新事業', '海外展開', '輸出', '観光', '農業',
      '介護', '福祉', '環境', 'カーボンニュートラル', '脱炭素', 'ものづくり', 'サービス',
      'ECサイト', 'テレワーク', 'AI', 'IoT', 'クラウド', '情報化',
      '感染症対策', '賃上げ', '最低賃金', '事業承継', '再構築', '経営革新', '働き方改革',
      '地域活性化', '商店街', '中心市街地', '地方創生', '産業振興',
      '省力化', '自動化', '機械化', '建設', '建築',
    ];
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>();
    const errors: string[] = [];
    
    // v1.3改善: 受付中と受付終了の両方を取得
    const acceptanceFlags = ['1', '0']; // 1=受付中, 0=受付終了
    
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
          
          const uniqueSubsidies = subsidies.filter((s: any) => {
            if (seenIds.has(s.id)) return false;
            seenIds.add(s.id);
            return true;
          });
          
          if (uniqueSubsidies.length > 0) {
            const statements = uniqueSubsidies.map((s: any) => {
              // detail_json に元データを保存
              const detailJson = JSON.stringify({
                subsidy_application_url: s.subsidy_application_url || null,
                subsidy_application_address: s.subsidy_application_address || null,
                target_detail: s.target_detail || null,
                usage_detail: s.usage_detail || null,
                subsidy_rate_detail: s.subsidy_rate_detail || null,
                subsidy_max_limit_detail: s.subsidy_max_limit_detail || null,
                acceptance_number_detail: s.acceptance_number_detail || null,
                contact: s.contact || null,
                crawled_at: new Date().toISOString(),
              });
              
              return db.prepare(`
                INSERT OR REPLACE INTO subsidy_cache 
                (id, source, title, subsidy_max_limit, subsidy_rate,
                 target_area_search, target_industry, target_number_of_employees,
                 acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
                 detail_json, cached_at, expires_at)
                VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
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
            
            for (let i = 0; i < statements.length; i += 100) {
              const batch = statements.slice(i, i + 100);
              await db.batch(batch);
            }
          }
          
          totalFetched += subsidies.length;
          totalInserted += uniqueSubsidies.length;
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          errors.push(`${keyword}(acc=${acceptance}): ${String(err)}`);
        }
      }
    }
    
    return c.json<ApiResponse<{
      message: string;
      total_fetched: number;
      total_inserted: number;
      unique_count: number;
      errors: string[];
      triggered_by: string;
      timestamp: string;
    }>>({
      success: true,
      data: {
        message: 'Manual sync completed',
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        errors,
        triggered_by: user.email,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Daily Data Report（運用観測用）
// ============================================================

/**
 * 例外分類定数（凍結）
 * timeout: リクエストタイムアウト
 * blocked: ブロック/WAF/403
 * login_required: ログイン必須
 * scan_pdf: スキャンPDFでOCR失敗
 * schema_mismatch: 抽出スキーマ不一致
 * encrypted_pdf: 暗号化PDF
 * pdf_too_large: PDFサイズ超過
 * url_404: URL変更/リンク切れ
 */
const EXCEPTION_TYPES = {
  TIMEOUT: 'timeout',
  BLOCKED: 'blocked',
  LOGIN_REQUIRED: 'login_required',
  SCAN_PDF: 'scan_pdf',
  SCHEMA_MISMATCH: 'schema_mismatch',
  ENCRYPTED_PDF: 'encrypted_pdf',
  PDF_TOO_LARGE: 'pdf_too_large',
  URL_404: 'url_404',
} as const;

/**
 * GET /api/admin/ops/daily-report
 * 
 * Daily Data Report 生成（コピペ用テキスト付き）
 * 毎日の収集結果を定型レポートで提出
 */
ops.get('/ops/daily-report', async (c) => {
  const db = c.env.DB;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  try {
    // 1) KPI サマリー
    const subsidyKpi = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL THEN 1 ELSE 0 END) AS has_deadline,
        SUM(CASE WHEN target_area_search IS NOT NULL AND target_area_search != '' THEN 1 ELSE 0 END) AS has_area,
        SUM(CASE WHEN subsidy_max_limit IS NOT NULL AND subsidy_max_limit > 0 THEN 1 ELSE 0 END) AS has_amount,
        SUM(CASE WHEN detail_json LIKE '%example.com%' THEN 1 ELSE 0 END) AS broken_links,
        MAX(cached_at) AS last_sync
      FROM subsidy_cache
    `).first<{
      total: number;
      valid: number;
      has_deadline: number;
      has_area: number;
      has_amount: number;
      broken_links: number;
      last_sync: string;
    }>();
    
    // ドキュメント統計（テーブルが存在する場合）
    let docsKpi = { total: 0 };
    try {
      const docsResult = await db.prepare(`SELECT COUNT(*) AS total FROM subsidy_documents`).first<{ total: number }>();
      docsKpi = docsResult || { total: 0 };
    } catch (e) {
      // テーブル未作成の場合は0
    }
    
    // OCRキュー統計
    let ocrKpi = { queued: 0, processing: 0, done: 0, failed: 0 };
    try {
      const ocrResult = await db.prepare(`
        SELECT status, COUNT(*) AS cnt FROM ocr_queue GROUP BY status
      `).all<{ status: string; cnt: number }>();
      for (const row of ocrResult.results || []) {
        if (row.status === 'pending') ocrKpi.queued = row.cnt;
        else if (row.status === 'processing') ocrKpi.processing = row.cnt;
        else if (row.status === 'completed') ocrKpi.done = row.cnt;
        else if (row.status === 'failed') ocrKpi.failed = row.cnt;
      }
    } catch (e) {
      // テーブル未作成
    }
    
    // 抽出結果統計
    let extractionKpi = { ok: 0, failed: 0, top_errors: [] as string[] };
    try {
      const extractionResult = await db.prepare(`
        SELECT 
          SUM(CASE WHEN extraction_status = 'completed' THEN 1 ELSE 0 END) AS ok,
          SUM(CASE WHEN extraction_status = 'failed' THEN 1 ELSE 0 END) AS failed
        FROM extraction_results
      `).first<{ ok: number; failed: number }>();
      extractionKpi.ok = extractionResult?.ok || 0;
      extractionKpi.failed = extractionResult?.failed || 0;
    } catch (e) {
      // テーブル未作成
    }
    
    // ソース統計
    const sourcesKpi = await db.prepare(`
      SELECT 
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled
      FROM source_registry
    `).first<{ active: number; disabled: number }>() || { active: 0, disabled: 0 };
    
    // 2) 今日の増分（差分）
    const todayDiff = await db.prepare(`
      SELECT
        SUM(CASE WHEN DATE(cached_at) = ? THEN 1 ELSE 0 END) AS new_today,
        SUM(CASE WHEN DATE(cached_at) = ? AND id IN (SELECT id FROM subsidy_cache WHERE DATE(cached_at) < ?) THEN 1 ELSE 0 END) AS updated_today
      FROM subsidy_cache
    `).bind(today, today, today).first<{ new_today: number; updated_today: number }>();
    
    // 終了した補助金
    const expiredToday = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM subsidy_cache 
      WHERE DATE(acceptance_end_datetime) = ?
    `).bind(today).first<{ cnt: number }>();
    
    // 3) 例外（要対応）- crawl_queue から
    let exceptions = {
      url_404: 0,
      timeout: 0,
      blocked: 0,
      login_required: 0,
      scan_pdf: 0,
      schema_mismatch: 0,
      encrypted_pdf: 0,
      pdf_too_large: 0,
      top_failures: [] as Array<{ source_id: string; url: string; error: string }>,
    };
    
    try {
      const failedJobs = await db.prepare(`
        SELECT 
          source_registry_id, url, last_error
        FROM crawl_queue 
        WHERE status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 10
      `).all<{ source_registry_id: string; url: string; last_error: string }>();
      
      exceptions.top_failures = (failedJobs.results || []).map(r => ({
        source_id: r.source_registry_id || 'unknown',
        url: r.url,
        error: r.last_error || 'unknown',
      }));
      
      // エラータイプ別カウント
      const errorCounts = await db.prepare(`
        SELECT 
          CASE 
            WHEN last_error LIKE '%timeout%' THEN 'timeout'
            WHEN last_error LIKE '%403%' OR last_error LIKE '%blocked%' THEN 'blocked'
            WHEN last_error LIKE '%login%' OR last_error LIKE '%401%' THEN 'login_required'
            WHEN last_error LIKE '%404%' THEN 'url_404'
            ELSE 'other'
          END AS error_type,
          COUNT(*) AS cnt
        FROM crawl_queue
        WHERE status = 'failed'
        GROUP BY error_type
      `).all<{ error_type: string; cnt: number }>();
      
      for (const row of errorCounts.results || []) {
        if (row.error_type === 'timeout') exceptions.timeout = row.cnt;
        else if (row.error_type === 'blocked') exceptions.blocked = row.cnt;
        else if (row.error_type === 'login_required') exceptions.login_required = row.cnt;
        else if (row.error_type === 'url_404') exceptions.url_404 = row.cnt;
      }
    } catch (e) {
      // テーブル未作成
    }
    
    // ソース別件数
    const bySource = await db.prepare(`
      SELECT source, COUNT(*) AS cnt FROM subsidy_cache GROUP BY source ORDER BY cnt DESC
    `).all<{ source: string; cnt: number }>();
    
    // 直近24h新規（ソース別）
    const newBySource24h = await db.prepare(`
      SELECT source, COUNT(*) AS cnt 
      FROM subsidy_cache 
      WHERE cached_at >= datetime('now', '-24 hours')
      GROUP BY source ORDER BY cnt DESC
    `).all<{ source: string; cnt: number }>();
    
    // 率の計算
    const total = subsidyKpi?.total || 0;
    const validRate = total > 0 ? Math.round(((subsidyKpi?.valid || 0) / total) * 100) : 0;
    const deadlineRate = total > 0 ? Math.round(((subsidyKpi?.has_deadline || 0) / total) * 100) : 0;
    const areaRate = total > 0 ? Math.round(((subsidyKpi?.has_area || 0) / total) * 100) : 0;
    const amountRate = total > 0 ? Math.round(((subsidyKpi?.has_amount || 0) / total) * 100) : 0;
    
    // テキストレポート生成（コピペ用）
    const textReport = `【Daily Data Report】${today}

1) KPI
- subsidy_cache.total: ${total}（目標: 500→1000）
- subsidy_cache.valid_rate(expires_at>now): ${validRate}%
- has_deadline: ${deadlineRate}%
- has_area: ${areaRate}%
- has_amount: ${amountRate}%（目標: 80%）
- broken_links: ${subsidyKpi?.broken_links || 0}件
- last_sync: ${subsidyKpi?.last_sync || 'N/A'}
- docs.total(PDF等): ${docsKpi.total}
- ocr_queue: queued ${ocrKpi.queued} / processing ${ocrKpi.processing} / done ${ocrKpi.done} / failed ${ocrKpi.failed}
- extraction_results: ok ${extractionKpi.ok} / failed ${extractionKpi.failed}
- sources.active: ${sourcesKpi.active} / sources.disabled: ${sourcesKpi.disabled}

2) 今日の増分（差分）
- 新規補助金: ${todayDiff?.new_today || 0}
- 更新（再取得）: ${todayDiff?.updated_today || 0}
- 終了/受付終了: ${expiredToday?.cnt || 0}
- URL変更/404: ${exceptions.url_404}

3) 例外（要対応）
- 404/リンク切れ: ${exceptions.url_404}件
- 取得失敗: ${exceptions.timeout + exceptions.blocked + exceptions.login_required}件
  - timeout: ${exceptions.timeout}
  - blocked: ${exceptions.blocked}
  - login_required: ${exceptions.login_required}

4) ソース別件数
${(bySource.results || []).map(r => `- ${r.source}: ${r.cnt}件`).join('\n')}

5) 直近24h新規（ソース別）
${(newBySource24h.results || []).map(r => `- ${r.source}: ${r.cnt}件`).join('\n') || '- なし'}

---
Generated: ${new Date().toISOString()}`;
    
    return c.json<ApiResponse<{
      date: string;
      kpi: {
        subsidy_cache: {
          total: number;
          valid: number;
          valid_rate_pct: number;
          has_deadline_pct: number;
          has_area_pct: number;
          has_amount_pct: number;
          broken_links: number;
          last_sync: string | null;
        };
        documents: { total: number };
        ocr_queue: typeof ocrKpi;
        extraction: typeof extractionKpi;
        sources: typeof sourcesKpi;
      };
      diff: {
        new_today: number;
        updated_today: number;
        expired_today: number;
        url_404: number;
      };
      exceptions: typeof exceptions;
      by_source: Array<{ source: string; cnt: number }>;
      new_by_source_24h: Array<{ source: string; cnt: number }>;
      text_report: string;
      generated_at: string;
    }>>({
      success: true,
      data: {
        date: today,
        kpi: {
          subsidy_cache: {
            total,
            valid: subsidyKpi?.valid || 0,
            valid_rate_pct: validRate,
            has_deadline_pct: deadlineRate,
            has_area_pct: areaRate,
            has_amount_pct: amountRate,
            broken_links: subsidyKpi?.broken_links || 0,
            last_sync: subsidyKpi?.last_sync || null,
          },
          documents: docsKpi,
          ocr_queue: ocrKpi,
          extraction: extractionKpi,
          sources: sourcesKpi,
        },
        diff: {
          new_today: todayDiff?.new_today || 0,
          updated_today: todayDiff?.updated_today || 0,
          expired_today: expiredToday?.cnt || 0,
          url_404: exceptions.url_404,
        },
        exceptions,
        by_source: bySource.results || [],
        new_by_source_24h: newBySource24h.results || [],
        text_report: textReport,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Daily report error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DAILY_REPORT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin/ops/source-summary
 * 
 * source_registry の網羅性サマリー
 */
ops.get('/ops/source-summary', async (c) => {
  const db = c.env.DB;
  
  try {
    // スコープ別統計
    const byScope = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) AS total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled
      FROM source_registry
      GROUP BY scope
      ORDER BY total DESC
    `).all<{ scope: string; total: number; enabled: number; disabled: number }>();
    
    // 都道府県カバー率
    const prefectures = await db.prepare(`
      SELECT DISTINCT geo_id FROM source_registry WHERE scope = 'prefecture' AND geo_id IS NOT NULL
    `).all<{ geo_id: string }>();
    const coveredPrefectures = (prefectures.results || []).map(r => r.geo_id);
    const allPrefectures = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, '0'));
    const missingPrefectures = allPrefectures.filter(p => !coveredPrefectures.includes(p));
    
    // ソース別 subsidy_cache 件数
    const subsidyBySource = await db.prepare(`
      SELECT 
        sr.registry_id,
        sr.scope,
        sr.geo_id,
        sr.notes,
        sr.enabled,
        COUNT(sc.id) AS subsidy_count
      FROM source_registry sr
      LEFT JOIN subsidy_cache sc ON sc.source = sr.registry_id
      GROUP BY sr.registry_id
      ORDER BY subsidy_count DESC
    `).all<{
      registry_id: string;
      scope: string;
      geo_id: string;
      notes: string;
      enabled: number;
      subsidy_count: number;
    }>();
    
    return c.json<ApiResponse<{
      by_scope: Array<{ scope: string; total: number; enabled: number; disabled: number }>;
      prefecture_coverage: {
        covered: number;
        total: number;
        coverage_pct: number;
        missing: string[];
      };
      sources_with_subsidies: Array<{
        registry_id: string;
        scope: string;
        geo_id: string;
        notes: string;
        enabled: number;
        subsidy_count: number;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        by_scope: byScope.results || [],
        prefecture_coverage: {
          covered: coveredPrefectures.length,
          total: 47,
          coverage_pct: Math.round((coveredPrefectures.length / 47) * 100),
          missing: missingPrefectures,
        },
        sources_with_subsidies: subsidyBySource.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Source summary error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'SOURCE_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// P3-2A: Cron運用監視API（cron_runs + feed_failures）
// ============================================================

/**
 * GET /api/admin-ops/cron-status
 * 
 * Cron実行状況のサマリー（東京3ソース）
 * - 直近7日間のジョブ別成功/失敗
 * - 24時間以内に成功があるか（健全性チェック）
 * - 最新の実行結果
 */
ops.get('/cron-status', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // 健全性チェック（24h以内に成功があるか）
    const healthCheck = await db.prepare(`
      SELECT 
        job_type,
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        MAX(started_at) as last_run,
        MAX(CASE WHEN status = 'success' THEN started_at END) as last_success,
        MAX(CASE WHEN status = 'failed' THEN started_at END) as last_failure,
        CASE 
          WHEN MAX(CASE WHEN status = 'success' THEN started_at END) >= datetime('now', '-24 hours') 
          THEN 1 
          ELSE 0 
        END as healthy_24h
      FROM cron_runs
      WHERE started_at >= datetime('now', '-7 days')
        AND job_type IN ('scrape-tokyo-shigoto', 'scrape-tokyo-kosha', 'scrape-tokyo-hataraku')
      GROUP BY job_type
      ORDER BY job_type
    `).all<{
      job_type: string;
      total_runs: number;
      success_count: number;
      failed_count: number;
      partial_count: number;
      last_run: string | null;
      last_success: string | null;
      last_failure: string | null;
      healthy_24h: number;
    }>();

    // 直近10件の実行履歴
    const recentRuns = await db.prepare(`
      SELECT 
        run_id,
        job_type,
        status,
        triggered_by,
        started_at,
        finished_at,
        items_processed,
        items_inserted,
        items_updated,
        items_skipped,
        error_count,
        errors_json,
        metadata_json
      FROM cron_runs
      WHERE job_type IN ('scrape-tokyo-shigoto', 'scrape-tokyo-kosha', 'scrape-tokyo-hataraku')
      ORDER BY started_at DESC
      LIMIT 20
    `).all<{
      run_id: string;
      job_type: string;
      status: string;
      triggered_by: string;
      started_at: string;
      finished_at: string | null;
      items_processed: number;
      items_inserted: number;
      items_updated: number;
      items_skipped: number;
      error_count: number;
      errors_json: string | null;
      metadata_json: string | null;
    }>();

    // 全体の健全性判定
    const allHealthy = (healthCheck.results || []).every(h => h.healthy_24h === 1);
    const anyUnhealthy = (healthCheck.results || []).some(h => h.healthy_24h === 0);
    const stoppedJobs = (healthCheck.results || []).filter(h => h.healthy_24h === 0).map(h => h.job_type);

    return c.json<ApiResponse<{
      overall_healthy: boolean;
      stopped_jobs: string[];
      health_by_job: Array<{
        job_type: string;
        total_runs: number;
        success_count: number;
        failed_count: number;
        partial_count: number;
        last_run: string | null;
        last_success: string | null;
        last_failure: string | null;
        healthy_24h: boolean;
      }>;
      recent_runs: Array<{
        run_id: string;
        job_type: string;
        status: string;
        triggered_by: string;
        started_at: string;
        finished_at: string | null;
        items_processed: number;
        items_inserted: number;
        items_updated: number;
        items_skipped: number;
        error_count: number;
        errors: string[];
        metadata: Record<string, unknown> | null;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        overall_healthy: allHealthy,
        stopped_jobs: stoppedJobs,
        health_by_job: (healthCheck.results || []).map(h => ({
          ...h,
          healthy_24h: h.healthy_24h === 1,
        })),
        recent_runs: (recentRuns.results || []).map(r => ({
          ...r,
          errors: r.errors_json ? JSON.parse(r.errors_json) : [],
          metadata: r.metadata_json ? JSON.parse(r.metadata_json) : null,
        })),
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Cron status error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'CRON_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/feed-failures
 * 
 * Feed失敗一覧（未解決のみ）
 * - ソース別・ステージ別の集計
 * - 個別の失敗詳細
 */

export default ops;

/**
 * Cron: ヘルスチェック・データ品質検証
 * 
 * GET /verify-data-quality - データ品質検証
 * GET /health              - ヘルスチェック
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';

const misc = new Hono<{ Bindings: Env; Variables: Variables }>();

misc.get('/verify-data-quality', async (c) => {
  const db = c.env.DB;
  
  try {
    // 東京都公社のデータを取得
    const result = await db.prepare(`
      SELECT 
        id, title, source, subsidy_max_limit, subsidy_rate,
        acceptance_end_datetime, detail_json
      FROM subsidy_cache
      WHERE source = 'tokyo-kosha'
      ORDER BY cached_at DESC
      LIMIT 50
    `).all();
    
    const subsidies = result.results || [];
    
    // 品質指標を計算
    const qualityMetrics = {
      total: subsidies.length,
      hasTitle: 0,
      hasMaxAmount: 0,
      hasSubsidyRate: 0,
      hasDeadline: 0,
      hasDescription: 0,
      hasEligibility: 0,
      hasPdfUrls: 0,
      fullyComplete: 0,  // 壁打ちに必要な全項目あり
    };
    
    const detailedResults: any[] = [];
    
    for (const s of subsidies as any[]) {
      const detail = s.detail_json ? JSON.parse(s.detail_json) : {};
      
      const hasTitle = !!s.title && s.title.length > 0;
      const hasMaxAmount = s.subsidy_max_limit !== null && s.subsidy_max_limit > 0;
      const hasSubsidyRate = !!s.subsidy_rate;
      const hasDeadline = !!s.acceptance_end_datetime || !!detail.deadline;
      const hasDescription = !!detail.description && detail.description.length > 20;
      const hasEligibility = !!detail.eligibility;
      const hasPdfUrls = detail.pdfUrls && detail.pdfUrls.length > 0;
      
      if (hasTitle) qualityMetrics.hasTitle++;
      if (hasMaxAmount) qualityMetrics.hasMaxAmount++;
      if (hasSubsidyRate) qualityMetrics.hasSubsidyRate++;
      if (hasDeadline) qualityMetrics.hasDeadline++;
      if (hasDescription) qualityMetrics.hasDescription++;
      if (hasEligibility) qualityMetrics.hasEligibility++;
      if (hasPdfUrls) qualityMetrics.hasPdfUrls++;
      
      // 壁打ちに必要な最低限: タイトル + (金額 or 率) + (説明 or 対象者)
      const isComplete = hasTitle && (hasMaxAmount || hasSubsidyRate) && (hasDescription || hasEligibility);
      if (isComplete) qualityMetrics.fullyComplete++;
      
      detailedResults.push({
        id: s.id,
        title: s.title,
        checks: {
          hasTitle,
          hasMaxAmount,
          hasSubsidyRate,
          hasDeadline,
          hasDescription,
          hasEligibility,
          hasPdfUrls,
          isComplete,
        },
        maxAmount: s.subsidy_max_limit,
        subsidyRate: s.subsidy_rate,
        pdfCount: detail.pdfUrls?.length || 0,
      });
    }
    
    // 品質スコア計算
    const completenessScore = qualityMetrics.total > 0
      ? Math.round((qualityMetrics.fullyComplete / qualityMetrics.total) * 100)
      : 0;
    
    return c.json<ApiResponse<{
      metrics: typeof qualityMetrics;
      completenessScore: number;
      recommendation: string;
      details: typeof detailedResults;
    }>>({
      success: true,
      data: {
        metrics: qualityMetrics,
        completenessScore,
        recommendation: completenessScore >= 60
          ? '品質OK: 壁打ち機能で検証可能'
          : completenessScore >= 30
          ? '要改善: PDFからの詳細抽出が必要'
          : '要大幅改善: スクレイピングロジックの見直しが必要',
        details: detailedResults,
      },
    });
    
  } catch (error) {
    console.error('[Verify] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

/**
 * 東京しごと財団 助成金・奨励金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-shigoto
 * 
 * Phase1: 東京都の補助金データ収集（推奨1番目ソース）
 * URL: https://www.koyokankyo.shigotozaidan.or.jp/
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（dedupe_key + ON CONFLICT）
 * - 差分検知（新規/更新/スキップを区別）
 * 
 * P2-2 定期実行設計:
 * - Cron schedule推奨: 毎日 06:00 JST (cron-job.org等で設定)
 * - dedupe_keyベースで重複防止
 * - content_hashで変更検知
 */

misc.get('/health', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret');
  const expectedSecret = (c.env as any).CRON_SECRET;
  
  return c.json<ApiResponse<{
    status: string;
    cron_configured: boolean;
    secret_valid: boolean;
    timestamp: string;
  }>>({
    success: true,
    data: {
      status: 'ok',
      cron_configured: !!expectedSecret,
      secret_valid: cronSecret === expectedSecret,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * P1-3-1: Suggestion生成ジョブ
 * 
 * POST /api/cron/generate-suggestions
 * 
 * 凍結仕様 v1:
 * - 入力: agency_clients × subsidy_cache
 * - 出力: agency_suggestions_cache に上位3件/顧客をキャッシュ
 * - スコアリング:
 *   - 地域一致 +40、全国 +20
 *   - 業種一致 +25、全業種 +10
 *   - 従業員条件マッチ +25、不一致 -30
 *   - 締切14日以内 -10、7日以内 -20
 *   - 受付中フラグが外なら score = 0
 * - ステータス判定: 80以上 PROCEED, 50〜79 CAUTION, 0〜49 NO
 * - BLOCKED顧客は除外（事故防止）
 */

// =====================================================
// POST /api/cron/expire-check
// 
// 期限切れ補助金の自動検知・フラグ管理
// - acceptance_end_datetime < now のレコードを壁打ち非表示に
// - 期限切れ間近（7日以内）の補助金をアラート
// - データ鮮度サマリを生成
// =====================================================

misc.post('/expire-check', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  let runId: string | null = null;
  try {
    runId = await startCronRun(db, 'expire-check', 'cron');
  } catch (e) {
    console.warn('[ExpireCheck] Failed to start cron_run:', e);
  }
  
  try {
    // Phase 1: 期限切れ補助金を検出（acceptance_end_datetime < now AND wall_chat_ready=1）
    const expired = await db.prepare(`
      SELECT id, title, source, acceptance_end_datetime
      FROM subsidy_cache
      WHERE wall_chat_ready = 1
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime < datetime('now')
        AND acceptance_end_datetime != ''
      LIMIT 500
    `).all();
    
    let expiredCount = 0;
    if (expired.results && expired.results.length > 0) {
      // バッチでwall_chat_readyを0に更新
      for (const row of expired.results as any[]) {
        await db.prepare(`
          UPDATE subsidy_cache 
          SET wall_chat_ready = 0, 
              wall_chat_missing = '["expired"]'
          WHERE id = ?
        `).bind(row.id).run();
        expiredCount++;
      }
      console.log(`[ExpireCheck] Phase1: ${expiredCount}件の期限切れを非表示化`);
    }
    
    // Phase 2: 7日以内に期限切れの補助金を集計（アラート用）
    const expiring = await db.prepare(`
      SELECT source, COUNT(*) as cnt
      FROM subsidy_cache
      WHERE wall_chat_ready = 1
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime BETWEEN datetime('now') AND datetime('now', '+7 days')
      GROUP BY source
    `).all();
    
    const expiringBySource: Record<string, number> = {};
    for (const row of (expiring.results || []) as any[]) {
      expiringBySource[row.source] = row.cnt;
    }
    
    // Phase 3: ソース別の現状サマリ
    const summary = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL THEN 1 ELSE 0 END) as accepting,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN wall_chat_ready = 1 AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL) THEN 1 ELSE 0 END) as accepting_ready
      FROM subsidy_cache
      GROUP BY source
    `).all();
    
    const sourceStats: Record<string, any> = {};
    for (const row of (summary.results || []) as any[]) {
      sourceStats[row.source] = {
        total: row.total,
        accepting: row.accepting,
        ready: row.ready,
        accepting_ready: row.accepting_ready,
        ready_pct: row.accepting > 0 ? Math.round(row.accepting_ready / row.accepting * 1000) / 10 : 0,
      };
    }
    
    if (runId) {
      await finishCronRun(db, runId, 'success', {
        items_processed: expiredCount,
        items_inserted: 0,
        error_count: 0,
        metadata: {
          expired_hidden: expiredCount,
          expiring_7days: expiringBySource,
          source_stats: sourceStats,
        },
      });
    }
    
    console.log(`[ExpireCheck] Done: expired=${expiredCount}, expiring_7d=${JSON.stringify(expiringBySource)}`);
    
    return c.json<ApiResponse<{
      expired_hidden: number;
      expiring_7days: Record<string, number>;
      source_stats: Record<string, any>;
      timestamp: string;
    }>>({
      success: true,
      data: {
        expired_hidden: expiredCount,
        expiring_7days: expiringBySource,
        source_stats: sourceStats,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('[ExpireCheck] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: String(error) },
    }, 500);
  }
});

// =====================================================
// GET /api/cron/data-freshness
// 
// データ鮮度ダッシュボード（認証不要、読み取り専用）
// =====================================================
misc.get('/data-freshness', async (c) => {
  const db = c.env.DB;
  
  try {
    const stats = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL THEN 1 ELSE 0 END) as accepting,
        SUM(CASE WHEN wall_chat_ready = 1 AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL) THEN 1 ELSE 0 END) as accepting_ready,
        SUM(CASE WHEN json_extract(detail_json, '$.enriched_version') LIKE '%crawl%' THEN 1 ELSE 0 END) as crawled,
        MAX(cached_at) as last_updated
      FROM subsidy_cache
      GROUP BY source
      ORDER BY total DESC
    `).all();
    
    // 直近のCron実行履歴
    const recentRuns = await db.prepare(`
      SELECT job_type, status, items_processed, items_inserted, started_at, finished_at
      FROM cron_runs
      ORDER BY started_at DESC
      LIMIT 20
    `).all();
    
    return c.json<ApiResponse<{
      sources: any[];
      recent_cron_runs: any[];
      timestamp: string;
    }>>({
      success: true,
      data: {
        sources: stats.results || [],
        recent_cron_runs: recentRuns.results || [],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: String(error) },
    }, 500);
  }
});

// =====================================================
// POST /api/cron/cleanup-stuck-runs
// 
// ★ v4.0: 24時間以上runningのcron_runsを自動クリーンアップ
// Workers CPU制限超過等で finishCronRun が呼ばれずに残った
// ゾンビレコードを定期的にfailedに更新
// =====================================================
misc.post('/cleanup-stuck-runs', async (c) => {
  const db = c.env.DB;
  
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  try {
    const result = await db.prepare(`
      UPDATE cron_runs 
      SET status = 'failed', 
          finished_at = datetime('now'),
          error_count = 1,
          errors_json = '["timeout: stuck in running state, auto-cleaned by maintenance"]'
      WHERE status = 'running' 
        AND started_at < datetime('now', '-2 hours')
    `).run();
    
    const cleaned = result.meta?.changes || 0;
    console.log(`[cleanup-stuck-runs] Cleaned ${cleaned} stuck cron_runs`);
    
    return c.json<ApiResponse<{ cleaned: number; timestamp: string }>>({
      success: true,
      data: {
        cleaned,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: String(error) },
    }, 500);
  }
});

export default misc;

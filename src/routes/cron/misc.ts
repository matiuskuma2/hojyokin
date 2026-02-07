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

export default misc;

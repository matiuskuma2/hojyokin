/**
 * Cron: wall_chat_ready 計算・フォールバック生成
 * 
 * POST /recalc-wall-chat-ready - Ready フラグ再計算
 * POST /apply-field-fallbacks  - フィールドフォールバック適用
 * POST /daily-ready-boost      - 日次 Ready ブースト
 * POST /generate-fallback-v2   - フォールバック v2 生成
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';
import { simpleScrape, parseTokyoKoshaList, extractPdfLinks, calculateContentHash } from '../../services/firecrawl';
import { shardKey16, currentShardByHour } from '../../lib/shard';
import { checkExclusion, checkWallChatReadyFromJson, selectBestPdfs, scorePdfUrl, type ExclusionReasonCode } from '../../lib/wall-chat-ready';
import { logFirecrawlCost, logOpenAICost } from '../../lib/cost/cost-logger';

const wallChat = new Hono<{ Bindings: Env; Variables: Variables }>();

wallChat.post('/recalc-wall-chat-ready', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 100; // 1回あたりの処理件数
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'recalc-wall-chat-ready', authResult.triggeredBy);
    
    // パラメータ
    const url = new URL(c.req.url);
    const source = url.searchParams.get('source') || 'jgrants';
    const onlyNotReady = url.searchParams.get('only_not_ready') !== 'false';
    
    // 対象取得: wall_chat_ready = 0 かつ enriched 済みの案件
    const whereClause = onlyNotReady 
      ? `source = ? AND wall_chat_ready = 0 AND json_extract(detail_json, '$.enriched_version') IS NOT NULL`
      : `source = ? AND json_extract(detail_json, '$.enriched_version') IS NOT NULL`;
    
    const targets = await db.prepare(`
      SELECT id, title, detail_json
      FROM subsidy_cache
      WHERE ${whereClause}
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(source, MAX_ITEMS).all<{
      id: string;
      title: string;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found for recalculation' },
      });
    }
    
    let itemsProcessed = 0;
    let itemsReady = 0;
    let itemsExcluded = 0;
    let itemsNotReady = 0;
    const errors: string[] = [];
    
    let itemsFallbackApplied = 0;
    
    for (const target of targets.results) {
      try {
        let detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        let detailModified = false;
        
        // checkWallChatReadyFromJson で判定
        let result = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
        
        if (result.excluded) {
          // 除外対象
          detail.wall_chat_excluded_reason = result.exclusion_reason;
          detail.wall_chat_excluded_reason_ja = result.exclusion_reason_ja;
          detail.wall_chat_excluded_at = new Date().toISOString();
          
          await db.prepare(`
            UPDATE subsidy_cache 
            SET wall_chat_ready = 0, wall_chat_excluded = 1, detail_json = ?
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          
          itemsExcluded++;
        } else if (result.ready) {
          // Ready
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1, wall_chat_excluded = 0 WHERE id = ?
          `).bind(target.id).run();
          itemsReady++;
        } else {
          // Not Ready - required_documents だけ不足の場合はデフォルト補完を試行
          const missingOnlyDocs = result.missing.length === 1 && result.missing[0] === 'required_documents';
          const missingIncludesDocs = result.missing.includes('required_documents');
          
          // 4項目揃っていて required_documents だけ不足、またはスコアが4の場合
          if (missingOnlyDocs || (result.score === 4 && missingIncludesDocs)) {
            // デフォルト書類セットを追加
            const hasReqDocs = detail.required_documents && 
              Array.isArray(detail.required_documents) && 
              detail.required_documents.length > 0;
            
            if (!hasReqDocs) {
              detail.required_documents = [
                '公募要領',
                '申請書',
                '事業計画書',
                '見積書',
                '会社概要'
              ];
              detail.required_documents_source = 'default_fallback_v1';
              detail.required_documents_generated_at = new Date().toISOString();
              detailModified = true;
              itemsFallbackApplied++;
              
              // 再判定
              result = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
            }
          }
          
          if (result.ready) {
            // デフォルト補完後に Ready になった
            await db.prepare(`
              UPDATE subsidy_cache SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
              WHERE id = ?
            `).bind(JSON.stringify(detail), target.id).run();
            itemsReady++;
          } else {
            // それでも Not Ready
            if (detailModified) {
              // detail_json は更新（デフォルト補完は保存）
              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
              `).bind(JSON.stringify(detail), target.id).run();
            }
            itemsNotReady++;
          }
        }
        
        itemsProcessed++;
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Recalc-Wall-Chat-Ready] Completed: processed=${itemsProcessed}, ready=${itemsReady}, excluded=${itemsExcluded}, not_ready=${itemsNotReady}, fallback=${itemsFallbackApplied}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: itemsProcessed,
        items_inserted: itemsReady,
        items_skipped: itemsExcluded + itemsNotReady,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: { items_ready: itemsReady, items_excluded: itemsExcluded, items_not_ready: itemsNotReady, items_fallback_applied: itemsFallbackApplied },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_processed: number;
      items_ready: number;
      items_excluded: number;
      items_not_ready: number;
      items_fallback_applied: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Wall chat ready recalculation completed',
        items_processed: itemsProcessed,
        items_ready: itemsReady,
        items_excluded: itemsExcluded,
        items_not_ready: itemsNotReady,
        items_fallback_applied: itemsFallbackApplied,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Recalc-Wall-Chat-Ready] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Recalculation failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// A-4: PDF抽出Cronジョブ（統一入口）- 完成版
// POST /api/cron/extract-pdf-forms
// 
// ハイブリッド構成:
// 1. HTML抽出（最優先・最安）
// 2. Firecrawl（テキスト埋め込みPDF用）
// 3. Google Vision OCR（画像PDF用・最後の手段）
// 
// 失敗は feed_failures に記録、メトリクスを cron_runs に保存
// =====================================================

import { extractAndUpdateSubsidy, type ExtractSource } from '../../lib/pdf/pdf-extract-router';
import { checkCooldown, DEFAULT_COOLDOWN_POLICY } from '../../lib/pdf/extraction-cooldown';
import { recordCostGuardFailure } from '../../lib/failures/feed-failure-writer';


wallChat.post('/apply-field-fallbacks', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 200; // 1回あたりの処理件数
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'apply-field-fallbacks', authResult.triggeredBy);
    
    // パラメータ
    const url = new URL(c.req.url);
    const source = url.searchParams.get('source') || 'jgrants';
    
    // 対象取得: wall_chat_ready = 0 かつ overview あり かつ (app_reqs or eligible がない)
    const targets = await db.prepare(`
      SELECT 
        id, 
        title, 
        detail_json,
        target_industry,
        target_number_of_employees,
        subsidy_rate,
        subsidy_max_limit
      FROM subsidy_cache
      WHERE source = ?
        AND request_reception_display_flag = 1
        AND wall_chat_ready = 0
        AND wall_chat_excluded = 0
        AND json_extract(detail_json, '$.overview') IS NOT NULL
        AND (
          json_extract(detail_json, '$.application_requirements') IS NULL
          OR json_extract(detail_json, '$.eligible_expenses') IS NULL
        )
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(source, MAX_ITEMS).all<{
      id: string;
      title: string;
      detail_json: string | null;
      target_industry: string | null;
      target_number_of_employees: string | null;
      subsidy_rate: string | null;
      subsidy_max_limit: number | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found for fallback application' },
      });
    }
    
    let itemsProcessed = 0;
    let appReqsFilled = 0;
    let eligibleFilled = 0;
    let itemsReadyAfter = 0;
    const errors: string[] = [];
    
    for (const target of targets.results) {
      try {
        const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        let modified = false;
        
        // 1. application_requirements 補完
        const hasAppReqs = detail.application_requirements && 
          Array.isArray(detail.application_requirements) && 
          detail.application_requirements.length > 0;
        
        if (!hasAppReqs) {
          const fallbackReqs: string[] = [];
          
          // JGrantsのtarget_number_of_employeesから要件を生成
          const empSize = target.target_number_of_employees || '';
          if (empSize.includes('従業員数の制約なし')) {
            fallbackReqs.push('従業員数の制約なし');
          } else if (empSize.includes('中小企業') || empSize.includes('小規模')) {
            fallbackReqs.push('中小企業者であること');
          } else if (empSize) {
            fallbackReqs.push(empSize);
          }
          
          // target_industry から業種要件を生成
          const industry = target.target_industry || '';
          if (industry && industry.length > 0 && industry !== '指定なし') {
            fallbackReqs.push(`対象業種: ${industry}`);
          }
          
          // デフォルト汎用要件を追加
          fallbackReqs.push('日本国内に事業所を有すること');
          fallbackReqs.push('税務申告を適正に行っていること');
          fallbackReqs.push('反社会的勢力に該当しないこと');
          
          if (fallbackReqs.length > 0) {
            detail.application_requirements = fallbackReqs;
            detail.application_requirements_source = 'jgrants_api_fallback_v1';
            detail.application_requirements_generated_at = new Date().toISOString();
            modified = true;
            appReqsFilled++;
          }
        }
        
        // 2. eligible_expenses 補完
        const hasEligible = detail.eligible_expenses && 
          Array.isArray(detail.eligible_expenses) && 
          detail.eligible_expenses.length > 0;
        
        if (!hasEligible) {
          // タイトルから補助金カテゴリを推定
          const title = target.title.toLowerCase();
          let fallbackExpenses: string[] = [];
          
          if (title.includes('設備') || title.includes('機械') || title.includes('導入')) {
            fallbackExpenses = ['機械装置・システム構築費', '設備購入費', '据付工事費'];
          } else if (title.includes('it') || title.includes('デジタル') || title.includes('dx')) {
            fallbackExpenses = ['ソフトウェア購入費', 'クラウド利用費', 'IT導入関連経費'];
          } else if (title.includes('省エネ') || title.includes('脱炭素') || title.includes('環境')) {
            fallbackExpenses = ['省エネルギー設備費', '再生可能エネルギー設備費', '工事費'];
          } else if (title.includes('人材') || title.includes('研修') || title.includes('育成')) {
            fallbackExpenses = ['研修費', '外部専門家経費', '教材費'];
          } else if (title.includes('販路') || title.includes('海外') || title.includes('展示会')) {
            fallbackExpenses = ['広報費', '展示会出展費', 'ウェブサイト関連費'];
          } else if (title.includes('創業') || title.includes('起業') || title.includes('スタートアップ')) {
            fallbackExpenses = ['設備費', '広報費', '開業費', '外注費'];
          } else {
            // 汎用デフォルト
            fallbackExpenses = ['設備費', '外注費', '委託費', '諸経費'];
          }
          
          if (fallbackExpenses.length > 0) {
            detail.eligible_expenses = fallbackExpenses;
            detail.eligible_expenses_source = 'title_category_fallback_v1';
            detail.eligible_expenses_generated_at = new Date().toISOString();
            modified = true;
            eligibleFilled++;
          }
        }
        
        // 3. 変更があればDB更新 & wall_chat_ready 再判定
        if (modified) {
          // checkWallChatReadyFromJson で再判定
          const result = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
          
          if (result.ready) {
            await db.prepare(`
              UPDATE subsidy_cache 
              SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
              WHERE id = ?
            `).bind(JSON.stringify(detail), target.id).run();
            itemsReadyAfter++;
          } else {
            await db.prepare(`
              UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
            `).bind(JSON.stringify(detail), target.id).run();
          }
        }
        
        itemsProcessed++;
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Apply-Field-Fallbacks] Completed: processed=${itemsProcessed}, app_reqs_filled=${appReqsFilled}, eligible_filled=${eligibleFilled}, ready_after=${itemsReadyAfter}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: itemsProcessed,
        items_inserted: itemsReadyAfter,
        items_updated: appReqsFilled + eligibleFilled,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: { 
          app_reqs_filled: appReqsFilled, 
          eligible_filled: eligibleFilled, 
          ready_after: itemsReadyAfter 
        },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_processed: number;
      app_reqs_filled: number;
      eligible_filled: number;
      items_ready_after: number;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Field fallback application completed',
        items_processed: itemsProcessed,
        app_reqs_filled: appReqsFilled,
        eligible_filled: eligibleFilled,
        items_ready_after: itemsReadyAfter,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Apply-Field-Fallbacks] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Fallback application failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// POST /api/cron/daily-ready-boost
// 
// 【毎日Cron用】Ready率最大化パイプライン（統合版）
// 
// 処理順序:
// 1. apply-field-fallbacks を全件処理まで繰り返し（最大10ラウンド）
// 2. recalc-wall-chat-ready を全件処理まで繰り返し（最大10ラウンド）
// 
// 推奨: cron-job.org で毎日1回（深夜 or 早朝）実行
// タイムアウト: 最大5分を想定
// =====================================================


wallChat.post('/daily-ready-boost', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ROUNDS = 3; // 各フェーズの最大ラウンド数（Workers制限対応）
  const BATCH_SIZE = 100; // 1ラウンドあたりの処理件数（Workers制限対応）
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'daily-ready-boost', authResult.triggeredBy);
    
    const source = 'jgrants';
    const startTime = Date.now();
    
    // 統計
    let totalFallbackProcessed = 0;
    let totalAppReqsFilled = 0;
    let totalEligibleFilled = 0;
    let totalReadyFromFallback = 0;
    let totalRecalcProcessed = 0;
    let totalReadyFromRecalc = 0;
    let totalExcluded = 0;
    let fallbackRounds = 0;
    let recalcRounds = 0;
    const errors: string[] = [];
    
    // ============================================
    // Phase 1: apply-field-fallbacks（全件処理）
    // ============================================
    console.log('[Daily-Ready-Boost] Phase 1: Starting apply-field-fallbacks...');
    
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // 対象取得
      const targets = await db.prepare(`
        SELECT 
          id, title, detail_json,
          target_industry, target_number_of_employees,
          subsidy_rate, subsidy_max_limit
        FROM subsidy_cache
        WHERE source = ?
          AND request_reception_display_flag = 1
          AND wall_chat_ready = 0
          AND wall_chat_excluded = 0
          AND json_extract(detail_json, '$.overview') IS NOT NULL
          AND (
            json_extract(detail_json, '$.application_requirements') IS NULL
            OR json_extract(detail_json, '$.eligible_expenses') IS NULL
          )
        ORDER BY RANDOM()
        LIMIT ?
      `).bind(source, BATCH_SIZE).all<{
        id: string;
        title: string;
        detail_json: string | null;
        target_industry: string | null;
        target_number_of_employees: string | null;
        subsidy_rate: string | null;
        subsidy_max_limit: number | null;
      }>();
      
      if (!targets.results || targets.results.length === 0) {
        console.log(`[Daily-Ready-Boost] Phase 1 complete after ${round} rounds`);
        break;
      }
      
      fallbackRounds++;
      
      for (const target of targets.results) {
        try {
          const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
          let modified = false;
          
          // application_requirements 補完
          const hasAppReqs = detail.application_requirements && 
            Array.isArray(detail.application_requirements) && 
            detail.application_requirements.length > 0;
          
          if (!hasAppReqs) {
            const fallbackReqs: string[] = [];
            const empSize = target.target_number_of_employees || '';
            if (empSize.includes('従業員数の制約なし')) {
              fallbackReqs.push('従業員数の制約なし');
            } else if (empSize.includes('中小企業') || empSize.includes('小規模')) {
              fallbackReqs.push('中小企業者であること');
            } else if (empSize) {
              fallbackReqs.push(empSize);
            }
            
            const industry = target.target_industry || '';
            if (industry && industry.length > 0 && industry !== '指定なし') {
              fallbackReqs.push(`対象業種: ${industry}`);
            }
            
            fallbackReqs.push('日本国内に事業所を有すること');
            fallbackReqs.push('税務申告を適正に行っていること');
            fallbackReqs.push('反社会的勢力に該当しないこと');
            
            if (fallbackReqs.length > 0) {
              detail.application_requirements = fallbackReqs;
              detail.application_requirements_source = 'jgrants_api_fallback_v1';
              detail.application_requirements_generated_at = new Date().toISOString();
              modified = true;
              totalAppReqsFilled++;
            }
          }
          
          // eligible_expenses 補完
          const hasEligible = detail.eligible_expenses && 
            Array.isArray(detail.eligible_expenses) && 
            detail.eligible_expenses.length > 0;
          
          if (!hasEligible) {
            const title = target.title.toLowerCase();
            let fallbackExpenses: string[] = [];
            
            if (title.includes('設備') || title.includes('機械') || title.includes('導入')) {
              fallbackExpenses = ['機械装置・システム構築費', '設備購入費', '据付工事費'];
            } else if (title.includes('it') || title.includes('デジタル') || title.includes('dx')) {
              fallbackExpenses = ['ソフトウェア購入費', 'クラウド利用費', 'IT導入関連経費'];
            } else if (title.includes('省エネ') || title.includes('脱炭素') || title.includes('環境')) {
              fallbackExpenses = ['省エネルギー設備費', '再生可能エネルギー設備費', '工事費'];
            } else if (title.includes('人材') || title.includes('研修') || title.includes('育成')) {
              fallbackExpenses = ['研修費', '外部専門家経費', '教材費'];
            } else if (title.includes('販路') || title.includes('海外') || title.includes('展示会')) {
              fallbackExpenses = ['広報費', '展示会出展費', 'ウェブサイト関連費'];
            } else if (title.includes('創業') || title.includes('起業') || title.includes('スタートアップ')) {
              fallbackExpenses = ['設備費', '広報費', '開業費', '外注費'];
            } else {
              fallbackExpenses = ['設備費', '外注費', '委託費', '諸経費'];
            }
            
            if (fallbackExpenses.length > 0) {
              detail.eligible_expenses = fallbackExpenses;
              detail.eligible_expenses_source = 'title_category_fallback_v1';
              detail.eligible_expenses_generated_at = new Date().toISOString();
              modified = true;
              totalEligibleFilled++;
            }
          }
          
          // DB更新 & Ready判定
          if (modified) {
            const result = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
            
            if (result.ready) {
              await db.prepare(`
                UPDATE subsidy_cache 
                SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
                WHERE id = ?
              `).bind(JSON.stringify(detail), target.id).run();
              totalReadyFromFallback++;
            } else {
              await db.prepare(`
                UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
              `).bind(JSON.stringify(detail), target.id).run();
            }
          }
          
          totalFallbackProcessed++;
          
        } catch (err) {
          errors.push(`fallback:${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      console.log(`[Daily-Ready-Boost] Phase 1 round ${round + 1}: processed=${targets.results.length}, ready=${totalReadyFromFallback}`);
    }
    
    // ============================================
    // Phase 2: recalc-wall-chat-ready（全件処理）
    // ============================================
    console.log('[Daily-Ready-Boost] Phase 2: Starting recalc-wall-chat-ready...');
    
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // 対象取得: wall_chat_ready = 0 かつ enriched 済み
      const targets = await db.prepare(`
        SELECT id, title, detail_json
        FROM subsidy_cache
        WHERE source = ?
          AND request_reception_display_flag = 1
          AND wall_chat_ready = 0
          AND json_extract(detail_json, '$.enriched_version') IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
      `).bind(source, BATCH_SIZE).all<{
        id: string;
        title: string;
        detail_json: string | null;
      }>();
      
      if (!targets.results || targets.results.length === 0) {
        console.log(`[Daily-Ready-Boost] Phase 2 complete after ${round} rounds`);
        break;
      }
      
      recalcRounds++;
      let roundReady = 0;
      let roundExcluded = 0;
      
      for (const target of targets.results) {
        try {
          let detail = target.detail_json ? JSON.parse(target.detail_json) : {};
          
          let result = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
          
          if (result.excluded) {
            detail.wall_chat_excluded_reason = result.exclusion_reason;
            detail.wall_chat_excluded_reason_ja = result.exclusion_reason_ja;
            detail.wall_chat_excluded_at = new Date().toISOString();
            
            await db.prepare(`
              UPDATE subsidy_cache 
              SET wall_chat_ready = 0, wall_chat_excluded = 1, detail_json = ?
              WHERE id = ?
            `).bind(JSON.stringify(detail), target.id).run();
            
            totalExcluded++;
            roundExcluded++;
          } else if (result.ready) {
            await db.prepare(`
              UPDATE subsidy_cache SET wall_chat_ready = 1, wall_chat_excluded = 0 WHERE id = ?
            `).bind(target.id).run();
            totalReadyFromRecalc++;
            roundReady++;
          } else {
            // Not Ready - required_documents だけ不足の場合はデフォルト補完
            const missingOnlyDocs = result.missing.length === 1 && result.missing[0] === 'required_documents';
            
            if (missingOnlyDocs || (result.score === 4 && result.missing.includes('required_documents'))) {
              const hasReqDocs = detail.required_documents && 
                Array.isArray(detail.required_documents) && 
                detail.required_documents.length > 0;
              
              if (!hasReqDocs) {
                detail.required_documents = ['公募要領', '申請書', '事業計画書', '見積書', '会社概要'];
                detail.required_documents_source = 'default_fallback_v1';
                detail.required_documents_generated_at = new Date().toISOString();
                
                result = checkWallChatReadyFromJson(JSON.stringify(detail), target.title);
                
                if (result.ready) {
                  await db.prepare(`
                    UPDATE subsidy_cache SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
                    WHERE id = ?
                  `).bind(JSON.stringify(detail), target.id).run();
                  totalReadyFromRecalc++;
                  roundReady++;
                } else {
                  await db.prepare(`
                    UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
                  `).bind(JSON.stringify(detail), target.id).run();
                }
              }
            }
          }
          
          totalRecalcProcessed++;
          
        } catch (err) {
          errors.push(`recalc:${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      console.log(`[Daily-Ready-Boost] Phase 2 round ${round + 1}: ready=${roundReady}, excluded=${roundExcluded}`);
    }
    
    // ============================================
    // 最終統計を取得
    // ============================================
    const finalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN wall_chat_excluded = 1 THEN 1 ELSE 0 END) as excluded
      FROM subsidy_cache
      WHERE source = ? AND request_reception_display_flag = 1
    `).bind(source).first<{ total: number; ready: number; excluded: number }>();
    
    const durationMs = Date.now() - startTime;
    const totalReady = totalReadyFromFallback + totalReadyFromRecalc;
    
    console.log(`[Daily-Ready-Boost] Completed in ${durationMs}ms: +${totalReady} ready (fallback: ${totalReadyFromFallback}, recalc: ${totalReadyFromRecalc})`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: totalFallbackProcessed + totalRecalcProcessed,
        items_inserted: totalReady,
        items_updated: totalAppReqsFilled + totalEligibleFilled,
        items_skipped: totalExcluded,
        error_count: errors.length,
        errors: errors.slice(0, 50),
        metadata: {
          fallback_rounds: fallbackRounds,
          recalc_rounds: recalcRounds,
          app_reqs_filled: totalAppReqsFilled,
          eligible_filled: totalEligibleFilled,
          ready_from_fallback: totalReadyFromFallback,
          ready_from_recalc: totalReadyFromRecalc,
          excluded: totalExcluded,
          duration_ms: durationMs,
          final_total: finalStats?.total || 0,
          final_ready: finalStats?.ready || 0,
          final_excluded: finalStats?.excluded || 0,
        },
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      summary: {
        new_ready: number;
        ready_from_fallback: number;
        ready_from_recalc: number;
        app_reqs_filled: number;
        eligible_filled: number;
        excluded: number;
      };
      rounds: {
        fallback: number;
        recalc: number;
      };
      final_stats: {
        total: number;
        ready: number;
        excluded: number;
        ready_percent: string;
      };
      duration_ms: number;
      errors_count: number;
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Daily ready boost completed',
        summary: {
          new_ready: totalReady,
          ready_from_fallback: totalReadyFromFallback,
          ready_from_recalc: totalReadyFromRecalc,
          app_reqs_filled: totalAppReqsFilled,
          eligible_filled: totalEligibleFilled,
          excluded: totalExcluded,
        },
        rounds: {
          fallback: fallbackRounds,
          recalc: recalcRounds,
        },
        final_stats: {
          total: finalStats?.total || 0,
          ready: finalStats?.ready || 0,
          excluded: finalStats?.excluded || 0,
          ready_percent: finalStats ? ((finalStats.ready / finalStats.total) * 100).toFixed(1) + '%' : '0%',
        },
        duration_ms: durationMs,
        errors_count: errors.length,
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Daily-Ready-Boost] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `Daily ready boost failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// POST /api/cron/generate-fallback-v2
// 
// Fallback v2 生成（品質向上版）
// - target_area 正規化
// - subsidy_rate / max_limit 構造化
// - eligible_expenses 精緻化（use_purpose優先）
// - application_requirements 再構成（対象者要件中心）
// 
// 別フィールド (*_v2) に格納し、v1と併走
// =====================================================

import { generateFallbackV2, type FallbackV2Input } from '../../lib/fallback-v2';


wallChat.post('/generate-fallback-v2', async (c) => {
  const db = c.env.DB;
  
  // P2-0: CRON_SECRET 検証
  const authResult = verifyCronSecret(c);
  if (!authResult.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: authResult.error!.code, message: authResult.error!.message },
    }, authResult.error!.status);
  }
  
  const MAX_ITEMS = 100;
  let runId: string | null = null;
  
  try {
    runId = await startCronRun(db, 'generate-fallback-v2', authResult.triggeredBy);
    
    const url = new URL(c.req.url);
    const source = url.searchParams.get('source') || 'jgrants';
    const onlyReady = url.searchParams.get('only_ready') !== 'false'; // デフォルトはReady済みのみ
    
    // 対象取得: v2未生成のReady案件
    const whereClause = onlyReady
      ? `source = ? AND request_reception_display_flag = 1 AND wall_chat_ready = 1 AND json_extract(detail_json, '$.fallback_version') IS NULL`
      : `source = ? AND request_reception_display_flag = 1 AND json_extract(detail_json, '$.fallback_version') IS NULL`;
    
    const targets = await db.prepare(`
      SELECT 
        id, title, subsidy_rate, subsidy_max_limit, target_area_search,
        target_industry, target_number_of_employees, detail_json
      FROM subsidy_cache
      WHERE ${whereClause}
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(source, MAX_ITEMS).all<{
      id: string;
      title: string;
      subsidy_rate: string | null;
      subsidy_max_limit: number | null;
      target_area_search: string | null;
      target_industry: string | null;
      target_number_of_employees: string | null;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) {
      if (runId) await finishCronRun(db, runId, 'success', { items_processed: 0 });
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found for v2 generation' },
      });
    }
    
    let itemsProcessed = 0;
    let itemsGenerated = 0;
    const errors: string[] = [];
    const samples: Array<{ id: string; title: string; v2: any }> = [];
    
    for (const target of targets.results) {
      try {
        const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        
        // v2 生成
        const input: FallbackV2Input = {
          id: target.id,
          title: target.title,
          subsidy_rate: target.subsidy_rate,
          subsidy_max_limit: target.subsidy_max_limit,
          target_area_search: target.target_area_search,
          target_industry: target.target_industry,
          target_number_of_employees: target.target_number_of_employees,
          detail_json: detail,
        };
        
        const v2Output = generateFallbackV2(input);
        
        // detail_json にマージ（v2フィールドとして追加）
        const updatedDetail = {
          ...detail,
          target_area_scope: v2Output.target_area_scope,
          target_area_list: v2Output.target_area_list,
          target_area_display: v2Output.target_area_display,
          subsidy_rate_v2: v2Output.subsidy_rate_v2,
          subsidy_max_v2: v2Output.subsidy_max_v2,
          eligible_expenses_v2: v2Output.eligible_expenses_v2,
          eligible_expenses_v2_source: v2Output.eligible_expenses_v2_source,
          application_requirements_v2: v2Output.application_requirements_v2,
          application_requirements_v2_source: v2Output.application_requirements_v2_source,
          fallback_version: v2Output.fallback_version,
          fallback_generated_at: v2Output.fallback_generated_at,
        };
        
        await db.prepare(`
          UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
        `).bind(JSON.stringify(updatedDetail), target.id).run();
        
        itemsGenerated++;
        
        // サンプル保存（最初の3件）
        if (samples.length < 3) {
          samples.push({
            id: target.id,
            title: target.title,
            v2: v2Output,
          });
        }
        
        itemsProcessed++;
        
      } catch (err) {
        errors.push(`${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Generate-Fallback-V2] Completed: processed=${itemsProcessed}, generated=${itemsGenerated}`);
    
    if (runId) {
      await finishCronRun(db, runId, errors.length > 0 ? 'partial' : 'success', {
        items_processed: itemsProcessed,
        items_inserted: itemsGenerated,
        error_count: errors.length,
        errors: errors.slice(0, 50),
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      items_processed: number;
      items_generated: number;
      samples: Array<{ id: string; title: string; v2: any }>;
      errors: string[];
      timestamp: string;
      run_id?: string;
    }>>({
      success: true,
      data: {
        message: 'Fallback v2 generation completed',
        items_processed: itemsProcessed,
        items_generated: itemsGenerated,
        samples,
        errors: errors.slice(0, 10),
        timestamp: new Date().toISOString(),
        run_id: runId ?? undefined,
      },
    });
    
  } catch (error) {
    console.error('[Generate-Fallback-V2] Error:', error);
    if (runId) {
      await finishCronRun(db, runId, 'failed', {
        error_count: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `V2 generation failed: ${error instanceof Error ? error.message : String(error)}` },
    }, 500);
  }
});

// =====================================================
// P4: 自動更新パイプライン - 変更検出ワーカー
// =====================================================

/**
 * POST /api/cron/check-updates
 * 
 * source='manual' の補助金の公募要領変更を検出
 * 
 * 処理フロー:
 * 1. data_source_monitors から active な監視対象を取得
 * 2. 各監視対象のソースURLをチェック
 * 3. ファイルURL/ハッシュの変更を検出
 * 4. 変更があれば update_detection_log, file_change_history に記録
 * 5. 管理者に通知（Slack等）
 */

export default wallChat;

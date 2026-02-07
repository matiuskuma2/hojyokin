/**
 * Cron: サジェスション生成
 * 
 * POST /generate-suggestions - 企業向け補助金サジェスション自動生成
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';
import { shardKey16, currentShardByHour } from '../../lib/shard';

const suggestions = new Hono<{ Bindings: Env; Variables: Variables }>();

suggestions.post('/generate-suggestions', async (c) => {
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
    runId = await startCronRun(db, 'generate-suggestions', 'cron');
  } catch (logErr) {
    console.warn('[Suggestions] Failed to start cron_run log:', logErr);
  }
  
  // 凍結: 統計カウンター（finally で必ず cron_runs を閉じるため外に出す）
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  let clientsProcessed = 0;
  let subsidiesCount = 0;
  const errors: string[] = [];
  let finalStatus: 'success' | 'failed' | 'partial' = 'success';
  
  try {
    // 1. 全Agencyの顧客を取得（BLOCKEDを除外）
    // employee_countはcompaniesテーブルに直接存在
    const clientsResult = await db.prepare(`
      SELECT 
        ac.id as client_id,
        ac.agency_id,
        ac.company_id,
        ac.status,
        c.name as company_name,
        c.prefecture,
        c.industry_major,
        c.employee_count,
        c.employee_band
      FROM agency_clients ac
      JOIN companies c ON ac.company_id = c.id
      WHERE ac.status != 'blocked'
        AND c.employee_count > 0
    `).all();
    
    const clients = (clientsResult.results || []) as any[];
    clientsProcessed = clients.length;
    console.log(`[Suggestions] Processing ${clients.length} eligible clients`);
    
    // 凍結: 0件でも success、後続処理をスキップして finally へ
    if (clients.length > 0) {
    // 2. 補助金データを取得（スコアリング用）
    const subsidiesResult = await db.prepare(`
      SELECT 
        id,
        title,
        target_area_search,
        target_industry,
        target_number_of_employees,
        acceptance_end_datetime,
        request_reception_display_flag,
        subsidy_max_limit,
        subsidy_rate
      FROM subsidy_cache
      ORDER BY cached_at DESC
      LIMIT 500
    `).all();
    
    const subsidies = (subsidiesResult.results || []) as any[];
    subsidiesCount = subsidies.length;
    console.log(`[Suggestions] Found ${subsidies.length} subsidies to score`);
    
    // 3. 各顧客に対してスコアリング
    const today = new Date();
    
    for (const client of clients) {
      try {
        // 凍結推奨: 旧キャッシュを消し込み（過去の補助金が表示され続ける事故を防止）
        // 新しい上位3件を生成する前に、この顧客の古いsuggestionを全て削除
        await db.prepare(`
          DELETE FROM agency_suggestions_cache 
          WHERE agency_id = ? AND company_id = ?
        `).bind(client.agency_id, client.company_id).run();
        
        const scored: any[] = [];
        
        for (const subsidy of subsidies) {
          let score = 0;
          const matchReasons: string[] = [];
          const riskFlags: string[] = [];
          
          // 受付中フラグ確認
          const isAccepting = subsidy.request_reception_display_flag === 1;
          if (!isAccepting) {
            // 受付終了でもスコア計算は行うが、上位になりにくくする
            score = 0;
            riskFlags.push('現在受付停止中');
          } else {
            // 地域マッチング
            const targetArea = (subsidy.target_area_search || '').toLowerCase();
            const clientPref = normalizePrefecture(client.prefecture || '');
            
            if (targetArea.includes('全国') || targetArea === '' || targetArea === 'null') {
              score += 20;
              matchReasons.push('全国対象の補助金');
            } else if (clientPref && targetArea.includes(clientPref)) {
              score += 40;
              matchReasons.push(`${clientPref}対象の補助金`);
            } else {
              riskFlags.push('対象地域外の可能性');
            }
            
            // 業種マッチング
            const targetIndustry = (subsidy.target_industry || '').toLowerCase();
            const clientIndustry = (client.industry_major || '').toLowerCase();
            
            if (targetIndustry === '' || targetIndustry === 'null' || targetIndustry.includes('全業種')) {
              score += 10;
              matchReasons.push('業種制限なし');
            } else if (clientIndustry && targetIndustry.includes(clientIndustry)) {
              score += 25;
              matchReasons.push(`${client.industry_major}向け補助金`);
            } else if (clientIndustry) {
              riskFlags.push('業種条件の確認が必要');
            }
            
            // 従業員数マッチング
            const employeeCount = parseEmployeeCount(client.employee_count);
            const targetEmployees = subsidy.target_number_of_employees || '';
            
            if (targetEmployees === '' || targetEmployees === 'null') {
              score += 15;
              matchReasons.push('従業員数制限なし');
            } else if (employeeCount > 0 && checkEmployeeMatch(employeeCount, targetEmployees)) {
              score += 25;
              matchReasons.push('従業員数条件に適合');
            } else if (employeeCount > 0) {
              score -= 30;
              riskFlags.push('従業員数条件を確認してください');
            }
            
            // 締切チェック
            if (subsidy.acceptance_end_datetime && subsidy.acceptance_end_datetime !== 'null') {
              try {
                const deadline = new Date(subsidy.acceptance_end_datetime);
                const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysUntil <= 0) {
                  score = 0;
                  riskFlags.push('申請期限終了');
                } else if (daysUntil <= 7) {
                  score -= 20;
                  riskFlags.push(`申請期限まで${daysUntil}日`);
                } else if (daysUntil <= 14) {
                  score -= 10;
                  riskFlags.push(`申請期限まで${daysUntil}日`);
                }
              } catch (e) {
                // 日付パースエラーは無視
              }
            }
          }
          
          // スコアを0〜100に正規化
          score = Math.max(0, Math.min(100, score));
          
          // ステータス判定
          let status: 'PROCEED' | 'CAUTION' | 'NO';
          if (score >= 80) {
            status = 'PROCEED';
          } else if (score >= 50) {
            status = 'CAUTION';
          } else {
            status = 'NO';
          }
          
          scored.push({
            subsidyId: subsidy.id,
            title: subsidy.title,
            score,
            status,
            matchReasons,
            riskFlags,
            subsidyMaxLimit: subsidy.subsidy_max_limit,
            subsidyRate: subsidy.subsidy_rate,
            deadline: subsidy.acceptance_end_datetime,
            isAccepting,
          });
        }
        
        // 凍結: 上位3件を選択（決定的ソート＝同じ入力なら同じ結果）
        // ORDER BY: score DESC, isAccepting DESC, deadline ASC (早い順), subsidyId ASC
        scored.sort((a, b) => {
          // 1. スコア降順
          if (b.score !== a.score) return b.score - a.score;
          // 2. 受付中優先
          if (b.isAccepting !== a.isAccepting) return b.isAccepting ? 1 : -1;
          // 3. 締切が早い順（NULLは後ろ）
          const aDeadline = a.deadline && a.deadline !== 'null' ? a.deadline : 'z';
          const bDeadline = b.deadline && b.deadline !== 'null' ? b.deadline : 'z';
          if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
          // 4. subsidy_id 昇順（最終タイブレーク）
          return a.subsidyId.localeCompare(b.subsidyId);
        });
        
        const top3 = scored.slice(0, 3);
        
        // 4. agency_suggestions_cache にUPSERT
        for (let rank = 0; rank < top3.length; rank++) {
          const item = top3[rank];
          const suggestionId = generateUUID();
          const dedupeKey = `${client.agency_id}:${client.company_id}:${item.subsidyId}`;
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          
          // 既存確認
          const existing = await db.prepare(`
            SELECT id FROM agency_suggestions_cache WHERE dedupe_key = ?
          `).bind(dedupeKey).first<{ id: string }>();
          
          // 凍結: match_reasons/risk_flags は必ず string[] として保存
          // 配列以外や object 配列は許可しない
          const safeMatchReasons = ensureStringArray(item.matchReasons);
          const safeRiskFlags = ensureStringArray(item.riskFlags);
          const matchReasonsJson = JSON.stringify(safeMatchReasons);
          const riskFlagsJson = JSON.stringify(safeRiskFlags);
          
          if (existing) {
            // 更新
            await db.prepare(`
              UPDATE agency_suggestions_cache SET
                rank = ?,
                score = ?,
                status = ?,
                match_reasons_json = ?,
                risk_flags_json = ?,
                subsidy_title = ?,
                subsidy_max_amount = ?,
                subsidy_rate = ?,
                deadline = ?,
                expires_at = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(
              rank + 1,
              item.score,
              item.status,
              matchReasonsJson,
              riskFlagsJson,
              item.title,
              item.subsidyMaxLimit,
              item.subsidyRate,
              item.deadline !== 'null' ? item.deadline : null,
              expiresAt,
              existing.id
            ).run();
            itemsUpdated++;
          } else {
            // 新規挿入
            await db.prepare(`
              INSERT INTO agency_suggestions_cache (
                id, agency_id, company_id, subsidy_id, dedupe_key,
                rank, score, status, match_reasons_json, risk_flags_json,
                subsidy_title, subsidy_max_amount, subsidy_rate, deadline,
                expires_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).bind(
              suggestionId,
              client.agency_id,
              client.company_id,
              item.subsidyId,
              dedupeKey,
              rank + 1,
              item.score,
              item.status,
              matchReasonsJson,
              riskFlagsJson,
              item.title,
              item.subsidyMaxLimit,
              item.subsidyRate,
              item.deadline !== 'null' ? item.deadline : null,
              expiresAt
            ).run();
            itemsNew++;
          }
        }
        
      } catch (clientErr) {
        errors.push(`Client ${client.company_id}: ${clientErr instanceof Error ? clientErr.message : String(clientErr)}`);
      }
    }
    
    console.log(`[Suggestions] Completed: new=${itemsNew}, updated=${itemsUpdated}, skipped=${itemsSkipped}, errors=${errors.length}`);
    } // end if (clients.length > 0)
    
    // 凍結: エラーがあれば partial、なければ success
    finalStatus = errors.length > 0 ? 'partial' : 'success';
    
  } catch (error) {
    console.error('[Suggestions] Generation error:', error);
    finalStatus = 'failed';
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    // 凍結: 必ず cron_runs を閉じる（running のまま残さない）
    if (runId) {
      try {
        await finishCronRun(db, runId, finalStatus, {
          items_processed: clientsProcessed,
          items_inserted: itemsNew,
          items_updated: itemsUpdated,
          items_skipped: itemsSkipped,
          error_count: errors.length,
          errors: errors.slice(0, 100), // 最大100件
          metadata: {
            subsidies_count: subsidiesCount,
            final_status: finalStatus,
          },
        });
      } catch (logErr) {
        console.error('[Suggestions] CRITICAL: Failed to finish cron_run log:', logErr);
      }
    }
  }
  
  // 凍結: レスポンスは finally の後で返す
  if (finalStatus === 'failed') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Generation failed: ${errors[0] || 'Unknown error'}`,
      },
    }, 500);
  }
  
  return c.json<ApiResponse<{
    message: string;
    clients_processed: number;
    items_new: number;
    items_updated: number;
    items_skipped: number;
    errors: string[];
    timestamp: string;
    run_id?: string;
  }>>({
    success: true,
    data: {
      message: clientsProcessed === 0 
        ? 'No eligible clients to process' 
        : 'Suggestions generated successfully',
      clients_processed: clientsProcessed,
      items_new: itemsNew,
      items_updated: itemsUpdated,
      items_skipped: itemsSkipped,
      errors,
      timestamp: new Date().toISOString(),
      run_id: runId ?? undefined,
    },
  });
});

/**
 * 凍結: 配列を string[] に正規化
 * - 配列以外 → []
 * - object要素 → reason/text/message/description を優先、なければ stringify
 * - 100文字で切る（UX上の可読性）
 * - null/undefined → []
 */
function ensureStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  const MAX_LENGTH = 100;
  return arr.map((item: any) => {
    if (typeof item === 'string') {
      return item.length > MAX_LENGTH ? item.slice(0, MAX_LENGTH) + '…' : item;
    }
    if (item === null || item === undefined) return '';
    // objectは可読性の高いフィールドを優先
    if (typeof item === 'object') {
      const readable = item.reason || item.text || item.message || item.description || item.name;
      if (readable && typeof readable === 'string') {
        return readable.length > MAX_LENGTH ? readable.slice(0, MAX_LENGTH) + '…' : readable;
      }
      // フォールバック: stringify（ただし長さ制限）
      try {
        const json = JSON.stringify(item);
        return json.length > MAX_LENGTH ? json.slice(0, MAX_LENGTH) + '…' : json;
      } catch {
        return '[変換エラー]';
      }
    }
    const str = String(item);
    return str.length > MAX_LENGTH ? str.slice(0, MAX_LENGTH) + '…' : str;
  }).filter((s: string) => s.length > 0);
}

/**
 * 都道府県名を正規化（コード/漢字名どちらでも対応）
 */
function normalizePrefecture(input: string): string {
  const prefMap: Record<string, string> = {
    '13': '東京', '東京都': '東京', '東京': '東京',
    '14': '神奈川', '神奈川県': '神奈川', '神奈川': '神奈川',
    '11': '埼玉', '埼玉県': '埼玉', '埼玉': '埼玉',
    '12': '千葉', '千葉県': '千葉', '千葉': '千葉',
    '27': '大阪', '大阪府': '大阪', '大阪': '大阪',
    '23': '愛知', '愛知県': '愛知', '愛知': '愛知',
    '40': '福岡', '福岡県': '福岡', '福岡': '福岡',
    '01': '北海道', '北海道': '北海道',
  };
  return prefMap[input] || input.replace(/[都道府県]$/, '');
}

/**
 * 従業員数を数値にパース
 */
function parseEmployeeCount(input: string | number | null): number {
  if (typeof input === 'number') return input;
  if (!input || input === 'null' || input === '') return 0;
  
  // "1-5", "6-20" のような範囲表記の場合、中間値を返す
  const rangeMatch = input.match(/(\d+)\s*[-〜~]\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = parseInt(rangeMatch[2]);
    return Math.floor((min + max) / 2);
  }
  
  // "300人以上" のような表記
  const overMatch = input.match(/(\d+)[人名]?以上/);
  if (overMatch) {
    return parseInt(overMatch[1]);
  }
  
  // 単純な数値
  const num = parseInt(input.replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * 従業員数条件にマッチするか判定
 */
function checkEmployeeMatch(count: number, condition: string): boolean {
  if (!condition || condition === 'null') return true;
  
  // "中小企業" などの曖昧な条件は true
  if (condition.includes('中小') || condition.includes('小規模')) {
    return count <= 300;
  }
  
  // "300人以下" のような条件
  const underMatch = condition.match(/(\d+)[人名]?以下/);
  if (underMatch) {
    return count <= parseInt(underMatch[1]);
  }
  
  // "50人以上" のような条件
  const overMatch = condition.match(/(\d+)[人名]?以上/);
  if (overMatch) {
    return count >= parseInt(overMatch[1]);
  }
  
  return true; // 判定できない場合はマッチとみなす
}

/**
 * TOKYOはたらくネット 助成金スクレイピング
 * 
 * POST /api/cron/scrape-tokyo-hataraku
 * 
 * P3-1B: 東京3ソース目（discover フェーズ）
 * URL: https://www.hataraku.metro.tokyo.lg.jp/
 * 
 * P2-0 安全ゲート適用:
 * - CRON_SECRET必須（403）
 * - cron_runs テーブルに実行履歴を記録
 * - 冪等性保証（dedupe_key + ON CONFLICT）
 * - 差分検知（新規/更新/スキップを区別）
 * - 失敗はerrors_jsonに記録（握りつぶしNG）
 */

export default suggestions;

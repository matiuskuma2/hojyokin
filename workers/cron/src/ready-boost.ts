/**
 * Daily Ready Boost - Ready率最大化パイプライン
 * 
 * Workers Cron Triggers から直接実行される内部処理
 * 
 * 処理順序:
 * 1. apply-field-fallbacks（application_requirements, eligible_expenses補完）
 * 2. recalc-wall-chat-ready（required_documents補完 + Ready判定）
 * 3. generate-fallback-v2（品質向上用v2フィールド生成）
 * 
 * Workers APIリクエスト制限対応:
 * - 1ラウンド50件 × 最大5ラウンド = 最大250件/フェーズ
 */

export type ReadyBoostResult = {
  phase1_fallback: {
    rounds: number;
    processed: number;
    app_reqs_filled: number;
    eligible_filled: number;
    ready: number;
  };
  phase2_recalc: {
    rounds: number;
    processed: number;
    ready: number;
    excluded: number;
  };
  phase3_v2: {
    rounds: number;
    processed: number;
    generated: number;
  };
  final_stats: {
    total: number;
    ready: number;
    excluded: number;
    v2_count: number;
    ready_percent: string;
  };
  duration_ms: number;
  errors: string[];
};

// =====================================================
// V2 Fallback Generation (Workers用の軽量版)
// =====================================================

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const USE_PURPOSE_EXPENSE_MAP: Record<string, string[]> = {
  '設備整備・IT導入をしたい': ['機械装置費', 'システム構築費', 'ソフトウェア購入費', '設備購入費'],
  '販路拡大・海外展開をしたい': ['広報費', '展示会出展費', 'ウェブサイト関連費', '旅費'],
  '人材育成を行いたい': ['研修費', '外部専門家謝金', '教材費'],
  '研究開発・実証事業を行いたい': ['試作品製作費', '研究開発費', '原材料費', '外注費'],
  '新たな事業を行いたい': ['設備費', '広報費', '外注費', '委託費'],
  '事業を引き継ぎたい': ['専門家謝金', 'コンサルティング費', '登記関連費用'],
  '災害（自然災害、感染症等）支援がほしい': ['復旧費', '設備購入費', '感染症対策費'],
  '安全・防災対策支援がほしい': ['防災設備費', '安全対策設備費', '工事費'],
  'エコ・SDGs活動支援がほしい': ['省エネ設備費', '再生可能エネルギー設備費', '環境対策費'],
};

interface V2FallbackInput {
  id: string;
  title: string;
  subsidy_rate: string | null;
  subsidy_max_limit: number | null;
  target_area_search: string | null;
  target_industry: string | null;
  target_number_of_employees: string | null;
  workflows: any[] | null;
  usePurpose: string | null;
}

function generateFallbackV2(input: V2FallbackInput): Record<string, any> {
  // 1. Target Area 正規化
  let areas: string[] = [];
  if (input.workflows && Array.isArray(input.workflows)) {
    for (const wf of input.workflows) {
      if (wf.target_area) {
        areas.push(...wf.target_area.split(/[\/,]/).map((a: string) => a.trim()).filter(Boolean));
      }
    }
  }
  if (areas.length === 0 && input.target_area_search) {
    areas = input.target_area_search.split(/[\/,]/).map(a => a.trim()).filter(Boolean);
  }
  areas = [...new Set(areas)];
  
  const hasNational = areas.some(a => a === '全国' || a.includes('全国'));
  const prefectureList = areas.filter(a => PREFECTURES.includes(a));
  
  let targetAreaScope: string = 'unknown';
  let targetAreaDisplay: string = '要確認';
  
  if (hasNational || prefectureList.length >= 40) {
    targetAreaScope = 'national';
    targetAreaDisplay = '全国';
  } else if (prefectureList.length === 1) {
    targetAreaScope = 'prefecture';
    targetAreaDisplay = prefectureList[0];
  } else if (prefectureList.length > 1 && prefectureList.length <= 5) {
    targetAreaScope = 'prefecture';
    targetAreaDisplay = prefectureList.join('、');
  } else if (prefectureList.length > 5) {
    targetAreaScope = 'mixed';
    targetAreaDisplay = `${prefectureList.length}都道府県`;
  }
  
  // 2. Subsidy Rate
  let subsidyRateV2: Record<string, any> = { type: 'unknown', display: '公募要領で確認', is_confirmed: false };
  if (input.subsidy_rate) {
    const cleaned = input.subsidy_rate.replace(/\s+/g, '');
    const fractionMatch = cleaned.match(/(\d)\/(\d)/);
    if (fractionMatch) {
      const percent = Math.round((parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])) * 100);
      subsidyRateV2 = { type: 'fixed', min_percent: percent, max_percent: percent, display: `${percent}%`, is_confirmed: true };
    } else {
      const percentMatch = cleaned.match(/(\d+)%/);
      if (percentMatch) {
        subsidyRateV2 = { type: 'fixed', min_percent: parseInt(percentMatch[1]), max_percent: parseInt(percentMatch[1]), display: `${percentMatch[1]}%`, is_confirmed: true };
      }
    }
  }
  
  // 3. Subsidy Max
  let subsidyMaxV2: Record<string, any> = { amount: null, display: '上限額は公募要領で確認', is_confirmed: false };
  if (input.subsidy_max_limit && input.subsidy_max_limit > 0) {
    let display: string;
    if (input.subsidy_max_limit >= 100000000) {
      display = `${(input.subsidy_max_limit / 100000000).toFixed(1).replace(/\.0$/, '')}億円`;
    } else if (input.subsidy_max_limit >= 10000) {
      display = `${(input.subsidy_max_limit / 10000).toFixed(0)}万円`;
    } else {
      display = `${input.subsidy_max_limit.toLocaleString()}円`;
    }
    subsidyMaxV2 = { amount: input.subsidy_max_limit, display, is_confirmed: true };
  }
  
  // 4. Eligible Expenses v2
  let eligibleExpensesV2: string[] = [];
  let eligibleExpensesV2Source = 'default_v2';
  
  if (input.usePurpose) {
    const purposes = input.usePurpose.split('/').map(p => p.trim());
    for (const purpose of purposes) {
      const mapped = USE_PURPOSE_EXPENSE_MAP[purpose];
      if (mapped) eligibleExpensesV2.push(...mapped);
    }
    if (eligibleExpensesV2.length > 0) eligibleExpensesV2Source = 'use_purpose_v2';
  }
  
  if (eligibleExpensesV2.length === 0) {
    const lowerTitle = input.title.toLowerCase();
    if (lowerTitle.includes('設備') || lowerTitle.includes('機械') || lowerTitle.includes('導入')) {
      eligibleExpensesV2 = ['機械装置費', '設備購入費', '据付工事費'];
      eligibleExpensesV2Source = 'title_category_v2';
    } else if (lowerTitle.includes('it') || lowerTitle.includes('デジタル') || lowerTitle.includes('dx')) {
      eligibleExpensesV2 = ['ソフトウェア購入費', 'クラウド利用費', 'IT導入関連経費'];
      eligibleExpensesV2Source = 'title_category_v2';
    } else if (lowerTitle.includes('省エネ') || lowerTitle.includes('脱炭素') || lowerTitle.includes('環境')) {
      eligibleExpensesV2 = ['省エネルギー設備費', '再生可能エネルギー設備費', '工事費'];
      eligibleExpensesV2Source = 'title_category_v2';
    } else {
      eligibleExpensesV2 = ['設備費', '外注費', '委託費', '諸経費'];
    }
  }
  eligibleExpensesV2 = [...new Set(eligibleExpensesV2)].slice(0, 8);
  
  // 5. Application Requirements v2
  const appReqsV2: string[] = [];
  
  const empSize = input.target_number_of_employees || '';
  if (empSize.includes('小規模') || empSize.includes('20名以下') || empSize.includes('5名以下')) {
    appReqsV2.push('対象事業者: 小規模事業者');
  } else if (empSize.includes('中小企業') || empSize.includes('300名以下')) {
    appReqsV2.push('対象事業者: 中小企業者');
  } else if (empSize.includes('従業員数の制約なし')) {
    appReqsV2.push('対象事業者: 制限なし（大企業も可）');
  } else if (empSize) {
    appReqsV2.push(`従業員規模: ${empSize}`);
  }
  
  if (input.target_industry && input.target_industry !== '指定なし') {
    appReqsV2.push(`対象業種: ${input.target_industry}`);
  }
  
  if (targetAreaDisplay !== '全国' && targetAreaDisplay !== '要確認') {
    appReqsV2.push(`対象地域: ${targetAreaDisplay}`);
  }
  
  appReqsV2.push('日本国内に事業所を有すること');
  appReqsV2.push('税務申告を適正に行っていること');
  
  return {
    target_area_scope: targetAreaScope,
    target_area_list: prefectureList.length > 0 ? prefectureList : areas.slice(0, 10),
    target_area_display: targetAreaDisplay,
    subsidy_rate_v2: subsidyRateV2,
    subsidy_max_v2: subsidyMaxV2,
    eligible_expenses_v2: eligibleExpensesV2,
    eligible_expenses_v2_source: eligibleExpensesV2Source,
    application_requirements_v2: appReqsV2,
    application_requirements_v2_source: 'structured_v2',
    fallback_version: 'v2',
    fallback_generated_at: new Date().toISOString(),
  };
}

// checkWallChatReadyFromJson のシンプル実装（Workers用）
function checkWallChatReady(detail: Record<string, any>, title: string): { 
  ready: boolean; 
  excluded: boolean; 
  exclusion_reason?: string;
  exclusion_reason_ja?: string;
  missing: string[];
  score: number;
} {
  // 除外チェック
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('受付終了') || lowerTitle.includes('終了しました')) {
    return { ready: false, excluded: true, exclusion_reason: 'CLOSED', exclusion_reason_ja: '受付終了', missing: [], score: 0 };
  }
  if (lowerTitle.includes('令和2年') || lowerTitle.includes('令和元年') || lowerTitle.includes('平成')) {
    return { ready: false, excluded: true, exclusion_reason: 'OLD_FISCAL_YEAR', exclusion_reason_ja: '古い年度', missing: [], score: 0 };
  }
  
  // 5項目チェック
  const missing: string[] = [];
  let score = 0;
  
  // 1. overview
  const hasOverview = detail.overview && typeof detail.overview === 'string' && detail.overview.length > 20;
  if (hasOverview) score++;
  else missing.push('overview');
  
  // 2. application_requirements
  const hasAppReqs = detail.application_requirements && Array.isArray(detail.application_requirements) && detail.application_requirements.length > 0;
  if (hasAppReqs) score++;
  else missing.push('application_requirements');
  
  // 3. eligible_expenses
  const hasEligible = detail.eligible_expenses && Array.isArray(detail.eligible_expenses) && detail.eligible_expenses.length > 0;
  if (hasEligible) score++;
  else missing.push('eligible_expenses');
  
  // 4. required_documents
  const hasDocs = detail.required_documents && Array.isArray(detail.required_documents) && detail.required_documents.length > 0;
  if (hasDocs) score++;
  else missing.push('required_documents');
  
  // 5. deadline
  const hasDeadline = detail.deadline || detail.acceptance_end_datetime;
  if (hasDeadline) score++;
  else missing.push('deadline');
  
  return {
    ready: score === 5,
    excluded: false,
    missing,
    score,
  };
}

export async function runDailyReadyBoost(db: D1Database): Promise<ReadyBoostResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const source = 'jgrants';
  
  const MAX_ROUNDS = 5;
  const BATCH_SIZE = 50;
  
  // Phase 1 stats
  let p1Rounds = 0;
  let p1Processed = 0;
  let p1AppReqsFilled = 0;
  let p1EligibleFilled = 0;
  let p1Ready = 0;
  
  // Phase 2 stats
  let p2Rounds = 0;
  let p2Processed = 0;
  let p2Ready = 0;
  let p2Excluded = 0;
  
  // ============================================
  // Phase 1: apply-field-fallbacks
  // ============================================
  console.log('[ReadyBoost] Phase 1: Starting fallback...');
  
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const targets = await db.prepare(`
      SELECT 
        id, title, detail_json,
        target_industry, target_number_of_employees
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
    }>();
    
    if (!targets.results || targets.results.length === 0) break;
    p1Rounds++;
    
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
          
          detail.application_requirements = fallbackReqs;
          detail.application_requirements_source = 'jgrants_api_fallback_v1';
          detail.application_requirements_generated_at = new Date().toISOString();
          modified = true;
          p1AppReqsFilled++;
        }
        
        // eligible_expenses 補完
        const hasEligible = detail.eligible_expenses && 
          Array.isArray(detail.eligible_expenses) && 
          detail.eligible_expenses.length > 0;
        
        if (!hasEligible) {
          const title = target.title.toLowerCase();
          let fallbackExpenses: string[];
          
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
          
          detail.eligible_expenses = fallbackExpenses;
          detail.eligible_expenses_source = 'title_category_fallback_v1';
          detail.eligible_expenses_generated_at = new Date().toISOString();
          modified = true;
          p1EligibleFilled++;
        }
        
        if (modified) {
          const result = checkWallChatReady(detail, target.title);
          
          if (result.ready) {
            await db.prepare(`
              UPDATE subsidy_cache 
              SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
              WHERE id = ?
            `).bind(JSON.stringify(detail), target.id).run();
            p1Ready++;
          } else {
            await db.prepare(`
              UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
            `).bind(JSON.stringify(detail), target.id).run();
          }
        }
        
        p1Processed++;
        
      } catch (err) {
        errors.push(`p1:${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  
  console.log(`[ReadyBoost] Phase 1 done: rounds=${p1Rounds}, processed=${p1Processed}, ready=${p1Ready}`);
  
  // ============================================
  // Phase 2: recalc-wall-chat-ready
  // ============================================
  console.log('[ReadyBoost] Phase 2: Starting recalc...');
  
  for (let round = 0; round < MAX_ROUNDS; round++) {
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
    
    if (!targets.results || targets.results.length === 0) break;
    p2Rounds++;
    
    for (const target of targets.results) {
      try {
        let detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        let result = checkWallChatReady(detail, target.title);
        
        if (result.excluded) {
          detail.wall_chat_excluded_reason = result.exclusion_reason;
          detail.wall_chat_excluded_reason_ja = result.exclusion_reason_ja;
          detail.wall_chat_excluded_at = new Date().toISOString();
          
          await db.prepare(`
            UPDATE subsidy_cache 
            SET wall_chat_ready = 0, wall_chat_excluded = 1, detail_json = ?
            WHERE id = ?
          `).bind(JSON.stringify(detail), target.id).run();
          
          p2Excluded++;
        } else if (result.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1, wall_chat_excluded = 0 WHERE id = ?
          `).bind(target.id).run();
          p2Ready++;
        } else {
          // required_documents だけ不足の場合はデフォルト補完
          const missingOnlyDocs = result.missing.length === 1 && result.missing[0] === 'required_documents';
          
          if (missingOnlyDocs || (result.score === 4 && result.missing.includes('required_documents'))) {
            const hasReqDocs = detail.required_documents && 
              Array.isArray(detail.required_documents) && 
              detail.required_documents.length > 0;
            
            if (!hasReqDocs) {
              detail.required_documents = ['公募要領', '申請書', '事業計画書', '見積書', '会社概要'];
              detail.required_documents_source = 'default_fallback_v1';
              detail.required_documents_generated_at = new Date().toISOString();
              
              result = checkWallChatReady(detail, target.title);
              
              if (result.ready) {
                await db.prepare(`
                  UPDATE subsidy_cache SET wall_chat_ready = 1, wall_chat_excluded = 0, detail_json = ?
                  WHERE id = ?
                `).bind(JSON.stringify(detail), target.id).run();
                p2Ready++;
              } else {
                await db.prepare(`
                  UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
                `).bind(JSON.stringify(detail), target.id).run();
              }
            }
          }
        }
        
        p2Processed++;
        
      } catch (err) {
        errors.push(`p2:${target.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  
  console.log(`[ReadyBoost] Phase 2 done: rounds=${p2Rounds}, processed=${p2Processed}, ready=${p2Ready}`);
  
  // ============================================
  // Phase 3: generate-fallback-v2
  // ============================================
  console.log('[ReadyBoost] Phase 3: Starting v2 fallback generation...');
  
  let p3Rounds = 0;
  let p3Processed = 0;
  let p3Generated = 0;
  
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const targets = await db.prepare(`
      SELECT 
        id, title, subsidy_rate, subsidy_max_limit, 
        target_area_search, target_industry, target_number_of_employees,
        detail_json
      FROM subsidy_cache
      WHERE source = ?
        AND request_reception_display_flag = 1
        AND wall_chat_ready = 1
        AND (json_extract(detail_json, '$.fallback_version') IS NULL 
             OR json_extract(detail_json, '$.fallback_version') != 'v2')
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(source, BATCH_SIZE).all<{
      id: string;
      title: string;
      subsidy_rate: string | null;
      subsidy_max_limit: number | null;
      target_area_search: string | null;
      target_industry: string | null;
      target_number_of_employees: string | null;
      detail_json: string | null;
    }>();
    
    if (!targets.results || targets.results.length === 0) break;
    p3Rounds++;
    
    for (const target of targets.results) {
      try {
        const detail = target.detail_json ? JSON.parse(target.detail_json) : {};
        const workflows = detail.workflows || null;
        const usePurpose = detail.use_purpose || null;
        
        // Generate v2 fields
        const v2Output = generateFallbackV2({
          id: target.id,
          title: target.title,
          subsidy_rate: target.subsidy_rate,
          subsidy_max_limit: target.subsidy_max_limit,
          target_area_search: target.target_area_search,
          target_industry: target.target_industry,
          target_number_of_employees: target.target_number_of_employees,
          workflows,
          usePurpose,
        });
        
        // Merge v2 fields into detail
        Object.assign(detail, v2Output);
        
        await db.prepare(`
          UPDATE subsidy_cache SET detail_json = ? WHERE id = ?
        `).bind(JSON.stringify(detail), target.id).run();
        
        p3Generated++;
        p3Processed++;
        
      } catch (err) {
        errors.push(`p3:${target.id}: ${err instanceof Error ? err.message : String(err)}`);
        p3Processed++;
      }
    }
  }
  
  console.log(`[ReadyBoost] Phase 3 done: rounds=${p3Rounds}, processed=${p3Processed}, generated=${p3Generated}`);
  
  // ============================================
  // 最終統計
  // ============================================
  const finalStats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN wall_chat_excluded = 1 THEN 1 ELSE 0 END) as excluded,
      SUM(CASE WHEN json_extract(detail_json, '$.fallback_version') = 'v2' THEN 1 ELSE 0 END) as v2_count
    FROM subsidy_cache
    WHERE source = ? AND request_reception_display_flag = 1
  `).bind(source).first<{ total: number; ready: number; excluded: number; v2_count: number }>();
  
  const durationMs = Date.now() - startTime;
  
  return {
    phase1_fallback: {
      rounds: p1Rounds,
      processed: p1Processed,
      app_reqs_filled: p1AppReqsFilled,
      eligible_filled: p1EligibleFilled,
      ready: p1Ready,
    },
    phase2_recalc: {
      rounds: p2Rounds,
      processed: p2Processed,
      ready: p2Ready,
      excluded: p2Excluded,
    },
    phase3_v2: {
      rounds: p3Rounds,
      processed: p3Processed,
      generated: p3Generated,
    },
    final_stats: {
      total: finalStats?.total || 0,
      ready: finalStats?.ready || 0,
      excluded: finalStats?.excluded || 0,
      v2_count: finalStats?.v2_count || 0,
      ready_percent: finalStats ? ((finalStats.ready / finalStats.total) * 100).toFixed(1) + '%' : '0%',
    },
    duration_ms: durationMs,
    errors: errors.slice(0, 20),
  };
}

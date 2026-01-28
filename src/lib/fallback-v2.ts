/**
 * Fallback v2 - Ready品質向上のための高精度フォールバック生成
 * 
 * v1との違い:
 * - target_area を workflows SSOT で正規化
 * - subsidy_rate / max_limit を構造化
 * - eligible_expenses を use_purpose 優先で精緻化
 * - application_requirements を対象者要件中心に再構成
 * 
 * 出力は別フィールド (*_v2) に格納し、v1と併走
 */

// =====================================================
// Types
// =====================================================

export interface FallbackV2Input {
  id: string;
  title: string;
  subsidy_rate: string | null;
  subsidy_max_limit: number | null;
  target_area_search: string | null;
  target_industry: string | null;
  target_number_of_employees: string | null;
  detail_json: Record<string, any>;
}

export interface FallbackV2Output {
  // 地域
  target_area_scope: 'national' | 'prefecture' | 'municipality' | 'mixed' | 'unknown';
  target_area_list: string[];
  target_area_display: string;
  
  // 金額
  subsidy_rate_v2: {
    type: 'fixed' | 'range' | 'variable' | 'unknown';
    min_percent?: number;
    max_percent?: number;
    display: string;
    is_confirmed: boolean;
  };
  subsidy_max_v2: {
    amount: number | null;
    display: string;
    is_confirmed: boolean;
  };
  
  // 対象経費 v2
  eligible_expenses_v2: string[];
  eligible_expenses_v2_source: string;
  
  // 申請要件 v2（対象者要件中心）
  application_requirements_v2: string[];
  application_requirements_v2_source: string;
  
  // メタ
  fallback_version: 'v2';
  fallback_generated_at: string;
}

// =====================================================
// 1. Target Area 正規化
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

function normalizeTargetArea(
  targetAreaSearch: string | null,
  workflows: any[] | null
): { scope: FallbackV2Output['target_area_scope']; list: string[]; display: string } {
  // workflows から target_area を抽出
  let areas: string[] = [];
  
  if (workflows && Array.isArray(workflows) && workflows.length > 0) {
    for (const wf of workflows) {
      if (wf.target_area) {
        const wfAreas = wf.target_area.split(/[\/,]/).map((a: string) => a.trim()).filter(Boolean);
        areas.push(...wfAreas);
      }
    }
  }
  
  // workflows がなければ target_area_search を使用
  if (areas.length === 0 && targetAreaSearch) {
    areas = targetAreaSearch.split(/[\/,]/).map(a => a.trim()).filter(Boolean);
  }
  
  // 重複除去
  areas = [...new Set(areas)];
  
  // 「全国」判定
  const hasNational = areas.some(a => a === '全国' || a.includes('全国'));
  
  // 都道府県のみ抽出
  const prefectureList = areas.filter(a => PREFECTURES.includes(a));
  
  // 市区町村判定（都道府県以外で「市」「区」「町」「村」を含む）
  const hasMunicipality = areas.some(a => 
    !PREFECTURES.includes(a) && 
    !a.includes('地方') && 
    a !== '全国' &&
    (a.includes('市') || a.includes('区') || a.includes('町') || a.includes('村'))
  );
  
  // Scope 判定
  let scope: FallbackV2Output['target_area_scope'] = 'unknown';
  let display = '';
  
  if (hasNational && prefectureList.length >= 40) {
    scope = 'national';
    display = '全国';
  } else if (hasNational) {
    scope = 'national';
    display = '全国';
  } else if (hasMunicipality && prefectureList.length > 0) {
    scope = 'mixed';
    display = prefectureList.length <= 3 
      ? prefectureList.join('、') + ' の一部地域'
      : `${prefectureList.length}都道府県の一部地域`;
  } else if (prefectureList.length === 1) {
    scope = 'prefecture';
    display = prefectureList[0];
  } else if (prefectureList.length > 1 && prefectureList.length <= 5) {
    scope = 'prefecture';
    display = prefectureList.join('、');
  } else if (prefectureList.length > 5) {
    scope = 'mixed';
    display = `${prefectureList.length}都道府県`;
  } else if (hasMunicipality) {
    scope = 'municipality';
    const municipalities = areas.filter(a => 
      a.includes('市') || a.includes('区') || a.includes('町') || a.includes('村')
    );
    display = municipalities.slice(0, 3).join('、') + (municipalities.length > 3 ? ' 他' : '');
  } else {
    scope = 'unknown';
    display = '要確認';
  }
  
  return {
    scope,
    list: prefectureList.length > 0 ? prefectureList : areas.slice(0, 10),
    display,
  };
}

// =====================================================
// 2. Subsidy Rate / Max Limit 整形
// =====================================================

function parseSubsidyRate(rate: string | null): FallbackV2Output['subsidy_rate_v2'] {
  if (!rate || rate.trim() === '' || rate === '公募要領参照' || rate === '要確認') {
    return {
      type: 'unknown',
      display: '公募要領で確認',
      is_confirmed: false,
    };
  }
  
  const cleaned = rate.replace(/\s+/g, '');
  
  // パターン: 1/2, 2/3 など
  const fractionMatch = cleaned.match(/(\d)\/(\d)/);
  if (fractionMatch) {
    const percent = Math.round((parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])) * 100);
    return {
      type: 'fixed',
      min_percent: percent,
      max_percent: percent,
      display: `${percent}%（${fractionMatch[1]}/${fractionMatch[2]}）`,
      is_confirmed: true,
    };
  }
  
  // パターン: 50% など
  const percentMatch = cleaned.match(/(\d+)%/);
  if (percentMatch) {
    const percent = parseInt(percentMatch[1]);
    return {
      type: 'fixed',
      min_percent: percent,
      max_percent: percent,
      display: `${percent}%`,
      is_confirmed: true,
    };
  }
  
  // パターン: 1/2〜2/3 など
  const rangeMatch = cleaned.match(/(\d)\/(\d)[〜~\-](\d)\/(\d)/);
  if (rangeMatch) {
    const min = Math.round((parseInt(rangeMatch[1]) / parseInt(rangeMatch[2])) * 100);
    const max = Math.round((parseInt(rangeMatch[3]) / parseInt(rangeMatch[4])) * 100);
    return {
      type: 'range',
      min_percent: min,
      max_percent: max,
      display: `${min}%〜${max}%`,
      is_confirmed: true,
    };
  }
  
  // その他のテキスト
  if (rate.length > 0 && rate.length < 50) {
    return {
      type: 'variable',
      display: rate,
      is_confirmed: false,
    };
  }
  
  return {
    type: 'unknown',
    display: '公募要領で確認',
    is_confirmed: false,
  };
}

function parseSubsidyMax(maxLimit: number | null): FallbackV2Output['subsidy_max_v2'] {
  if (!maxLimit || maxLimit <= 0) {
    return {
      amount: null,
      display: '上限額は公募要領で確認',
      is_confirmed: false,
    };
  }
  
  // 金額フォーマット
  let display: string;
  if (maxLimit >= 100000000) {
    display = `${(maxLimit / 100000000).toFixed(1).replace(/\.0$/, '')}億円`;
  } else if (maxLimit >= 10000) {
    display = `${(maxLimit / 10000).toFixed(0)}万円`;
  } else {
    display = `${maxLimit.toLocaleString()}円`;
  }
  
  return {
    amount: maxLimit,
    display,
    is_confirmed: true,
  };
}

// =====================================================
// 3. Eligible Expenses 精緻化（use_purpose優先）
// =====================================================

// use_purpose → 対象経費のマッピング
const USE_PURPOSE_EXPENSE_MAP: Record<string, string[]> = {
  '設備整備・IT導入をしたい': ['機械装置費', 'システム構築費', 'ソフトウェア購入費', '設備購入費', '据付工事費'],
  '販路拡大・海外展開をしたい': ['広報費', '展示会出展費', 'ウェブサイト関連費', '旅費', '通訳・翻訳費'],
  '人材育成を行いたい': ['研修費', '外部専門家謝金', '教材費', '会場費'],
  '研究開発・実証事業を行いたい': ['試作品製作費', '研究開発費', '原材料費', '外注費', '知的財産関連経費'],
  '新たな事業を行いたい': ['設備費', '広報費', '外注費', '委託費', '原材料費'],
  '事業を引き継ぎたい': ['専門家謝金', 'コンサルティング費', '登記関連費用', 'システム移行費'],
  '雇用・職場環境を改善したい': ['設備改修費', '外部専門家謝金', '研修費'],
  '災害（自然災害、感染症等）支援がほしい': ['復旧費', '設備購入費', '感染症対策費', '消毒費'],
  '安全・防災対策支援がほしい': ['防災設備費', '安全対策設備費', '工事費'],
  'エコ・SDGs活動支援がほしい': ['省エネ設備費', '再生可能エネルギー設備費', '環境対策費'],
  '資金繰りを改善したい': [], // 融資系なので経費補助ではない
  'まちづくり・地域振興支援がほしい': ['イベント開催費', '広報費', '施設整備費'],
  'イベント・事業運営支援がほしい': ['イベント開催費', '会場費', '広報費', '人件費補助'],
  '教育・子育て・少子化支援がほしい': ['設備購入費', '施設整備費', '研修費'],
};

// タイトルキーワード → 経費（v1のフォールバック）
const TITLE_EXPENSE_MAP: Record<string, string[]> = {
  '設備': ['機械装置費', '設備購入費', '据付工事費'],
  '機械': ['機械装置費', '設備購入費', '据付工事費'],
  '導入': ['機械装置費', 'システム構築費', '設備購入費'],
  'it': ['ソフトウェア購入費', 'クラウド利用費', 'IT導入関連経費'],
  'デジタル': ['ソフトウェア購入費', 'クラウド利用費', 'IT導入関連経費'],
  'dx': ['ソフトウェア購入費', 'クラウド利用費', 'システム構築費'],
  '省エネ': ['省エネルギー設備費', '再生可能エネルギー設備費', '工事費'],
  '脱炭素': ['省エネルギー設備費', '再生可能エネルギー設備費', '工事費'],
  '環境': ['環境対策設備費', '工事費', '処理設備費'],
  '人材': ['研修費', '外部専門家経費', '教材費'],
  '研修': ['研修費', '外部専門家経費', '教材費'],
  '育成': ['研修費', '外部専門家経費', '教材費'],
  '販路': ['広報費', '展示会出展費', 'ウェブサイト関連費'],
  '海外': ['広報費', '展示会出展費', '旅費', '通訳費'],
  '展示会': ['展示会出展費', '広報費', '旅費'],
  '創業': ['設備費', '広報費', '開業費', '外注費'],
  '起業': ['設備費', '広報費', '開業費', '外注費'],
  'スタートアップ': ['設備費', '広報費', '外注費', '知的財産関連経費'],
};

function generateEligibleExpensesV2(
  usePurpose: string | null,
  title: string
): { expenses: string[]; source: string } {
  const expenses: string[] = [];
  let source = '';
  
  // 1. use_purpose から抽出（優先）
  if (usePurpose) {
    const purposes = usePurpose.split('/').map(p => p.trim());
    for (const purpose of purposes) {
      const mapped = USE_PURPOSE_EXPENSE_MAP[purpose];
      if (mapped && mapped.length > 0) {
        expenses.push(...mapped);
      }
    }
    if (expenses.length > 0) {
      source = 'use_purpose_v2';
    }
  }
  
  // 2. タイトルから抽出（use_purposeで取れなかった場合）
  if (expenses.length === 0) {
    const lowerTitle = title.toLowerCase();
    for (const [keyword, expList] of Object.entries(TITLE_EXPENSE_MAP)) {
      if (lowerTitle.includes(keyword)) {
        expenses.push(...expList);
        source = 'title_category_v2';
        break;
      }
    }
  }
  
  // 3. デフォルト（それでも取れない場合）
  if (expenses.length === 0) {
    expenses.push('設備費', '外注費', '委託費', '諸経費');
    source = 'default_v2';
  }
  
  // 重複除去 & 人件費は除外（多くの制度で制限が強い）
  const uniqueExpenses = [...new Set(expenses)]
    .filter(e => !e.includes('人件費') || e.includes('人件費補助'));
  
  return {
    expenses: uniqueExpenses.slice(0, 8), // 最大8項目
    source,
  };
}

// =====================================================
// 4. Application Requirements 再構成（対象者要件中心）
// =====================================================

// 事業者区分の正規化
function normalizeBusinessType(employees: string | null): string[] {
  if (!employees) return [];
  
  const types: string[] = [];
  
  if (employees.includes('小規模') || employees.includes('20名以下') || employees.includes('5名以下')) {
    types.push('小規模事業者');
  }
  if (employees.includes('中小企業') || employees.includes('300名以下') || employees.includes('従業員数の制約なし')) {
    if (!types.includes('小規模事業者')) {
      types.push('中小企業者');
    }
  }
  if (employees.includes('大企業') || employees.includes('制約なし')) {
    types.push('大企業も可');
  }
  
  if (types.length === 0 && employees.length > 0) {
    // 数字が含まれる場合
    const numMatch = employees.match(/(\d+)名?以下/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num <= 20) types.push('小規模事業者');
      else if (num <= 300) types.push('中小企業者');
      else types.push('従業員数の制約あり');
    }
  }
  
  return types;
}

function generateApplicationRequirementsV2(
  input: FallbackV2Input,
  targetAreaDisplay: string
): { requirements: string[]; source: string } {
  const requirements: string[] = [];
  
  // 1. 事業者区分（最重要）
  const businessTypes = normalizeBusinessType(input.target_number_of_employees);
  if (businessTypes.length > 0) {
    requirements.push(`対象事業者: ${businessTypes.join('、')}`);
  } else if (input.target_number_of_employees && input.target_number_of_employees !== '従業員数の制約なし') {
    requirements.push(`従業員規模: ${input.target_number_of_employees}`);
  } else {
    requirements.push('事業者区分: 要確認');
  }
  
  // 2. 業種
  if (input.target_industry && input.target_industry.length > 0 && input.target_industry !== '指定なし') {
    requirements.push(`対象業種: ${input.target_industry}`);
  }
  
  // 3. 地域
  if (targetAreaDisplay !== '全国' && targetAreaDisplay !== '要確認') {
    requirements.push(`対象地域: ${targetAreaDisplay}`);
  }
  
  // 4. 法人格（タイトルから推定）
  const lowerTitle = input.title.toLowerCase();
  if (lowerTitle.includes('個人事業') || lowerTitle.includes('フリーランス')) {
    requirements.push('個人事業主も対象');
  }
  if (lowerTitle.includes('npo') || lowerTitle.includes('社会福祉')) {
    requirements.push('NPO法人・社会福祉法人も対象');
  }
  
  // 5. 基本要件（最後に追加）
  requirements.push('日本国内に事業所を有すること');
  requirements.push('税務申告を適正に行っていること');
  
  return {
    requirements,
    source: 'structured_v2',
  };
}

// =====================================================
// メイン: v2 生成関数
// =====================================================

export function generateFallbackV2(input: FallbackV2Input): FallbackV2Output {
  const detail = input.detail_json || {};
  
  // workflows の取得
  const workflows = detail.workflows || null;
  const usePurpose = detail.use_purpose || null;
  
  // 1. Target Area
  const targetArea = normalizeTargetArea(input.target_area_search, workflows);
  
  // 2. Subsidy Rate / Max
  const subsidyRate = parseSubsidyRate(input.subsidy_rate);
  const subsidyMax = parseSubsidyMax(input.subsidy_max_limit);
  
  // 3. Eligible Expenses
  const { expenses, source: expSource } = generateEligibleExpensesV2(usePurpose, input.title);
  
  // 4. Application Requirements
  const { requirements, source: reqSource } = generateApplicationRequirementsV2(input, targetArea.display);
  
  return {
    target_area_scope: targetArea.scope,
    target_area_list: targetArea.list,
    target_area_display: targetArea.display,
    
    subsidy_rate_v2: subsidyRate,
    subsidy_max_v2: subsidyMax,
    
    eligible_expenses_v2: expenses,
    eligible_expenses_v2_source: expSource,
    
    application_requirements_v2: requirements,
    application_requirements_v2_source: reqSource,
    
    fallback_version: 'v2',
    fallback_generated_at: new Date().toISOString(),
  };
}

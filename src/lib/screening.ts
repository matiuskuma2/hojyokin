/**
 * 一次スクリーニング（高速マッチング）ロジック
 * 
 * 企業情報と補助金データを比較し、マッチ度・リスク・判定を算出
 */

import type {
  Company,
  JGrantsSearchResult,
  EvaluationStatus,
  RiskFlag,
  MatchReason,
  MatchResult,
} from '../types';

// 従業員帯の数値範囲マッピング
const EMPLOYEE_BAND_RANGES: Record<string, [number, number]> = {
  '1-5': [1, 5],
  '6-20': [6, 20],
  '21-50': [21, 50],
  '51-100': [51, 100],
  '101-300': [101, 300],
  '301+': [301, Infinity],
};

// 都道府県コードと名称のマッピング（一部）
const PREFECTURE_CODES: Record<string, string> = {
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

/**
 * 一次スクリーニングの実行
 */
export function performScreening(
  company: Company,
  subsidy: JGrantsSearchResult
): MatchResult {
  const matchReasons: MatchReason[] = [];
  const riskFlags: RiskFlag[] = [];
  let score = 50; // 基準スコア
  
  // 1. 地域マッチング
  const areaResult = checkAreaMatch(company, subsidy);
  matchReasons.push(areaResult.reason);
  score += areaResult.scoreAdjustment;
  
  // 2. 業種マッチング
  const industryResult = checkIndustryMatch(company, subsidy);
  matchReasons.push(industryResult.reason);
  score += industryResult.scoreAdjustment;
  
  // 3. 従業員規模マッチング
  const employeeResult = checkEmployeeMatch(company, subsidy);
  matchReasons.push(employeeResult.reason);
  score += employeeResult.scoreAdjustment;
  
  // 4. 受付状況チェック
  const acceptanceResult = checkAcceptanceStatus(subsidy);
  matchReasons.push(acceptanceResult.reason);
  score += acceptanceResult.scoreAdjustment;
  if (acceptanceResult.risk) {
    riskFlags.push(acceptanceResult.risk);
  }
  
  // 5. 締切間近チェック
  const deadlineResult = checkDeadline(subsidy);
  if (deadlineResult.reason) {
    matchReasons.push(deadlineResult.reason);
    score += deadlineResult.scoreAdjustment;
  }
  if (deadlineResult.risk) {
    riskFlags.push(deadlineResult.risk);
  }
  
  // 6. 補助額チェック
  const amountResult = checkSubsidyAmount(subsidy);
  if (amountResult.reason) {
    matchReasons.push(amountResult.reason);
  }
  
  // スコアを0-100に正規化
  score = Math.max(0, Math.min(100, score));
  
  // ステータス決定
  const status = determineStatus(score, riskFlags);
  
  // 説明文生成
  const explanation = generateExplanation(status, score, matchReasons, riskFlags);
  
  return {
    subsidy: {
      id: subsidy.id,
      source: 'jgrants',
      title: subsidy.title,
      subsidy_max_limit: subsidy.subsidy_max_limit ?? null,
      subsidy_rate: subsidy.subsidy_rate ?? null,
      target_area_search: subsidy.target_area_search ?? null,
      target_industry: subsidy.target_industry ?? null,
      target_number_of_employees: subsidy.target_number_of_employees ?? null,
      acceptance_start_datetime: subsidy.acceptance_start_datetime ?? null,
      acceptance_end_datetime: subsidy.acceptance_end_datetime ?? null,
      request_reception_display_flag: subsidy.request_reception_display_flag ?? 0,
      detail_json: null,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1時間後
    },
    evaluation: {
      status,
      score,
      match_reasons: matchReasons,
      risk_flags: riskFlags,
      explanation,
    },
  };
}

/**
 * 地域マッチング
 * 
 * P0-2: company.prefecture が null/undefined の場合の対応追加
 */
function checkAreaMatch(company: Company, subsidy: JGrantsSearchResult): {
  reason: MatchReason;
  scoreAdjustment: number;
} {
  const targetArea = subsidy.target_area_search;
  
  // 全国対象または地域指定なし
  if (!targetArea || targetArea === '全国' || targetArea.includes('全国')) {
    return {
      reason: {
        field: 'target_area',
        matched: true,
        reason: '全国対象の補助金です',
      },
      scoreAdjustment: 10,
    };
  }
  
  // P0-2: 企業の都道府県が未設定の場合
  if (!company.prefecture) {
    return {
      reason: {
        field: 'target_area',
        matched: false,
        reason: '企業の所在地が未設定のため、地域マッチングができません',
      },
      scoreAdjustment: -10, // 未設定の場合は軽度のペナルティ（-30ほど厳しくない）
    };
  }
  
  // 都道府県名で検索
  const prefectureName = PREFECTURE_CODES[company.prefecture] || company.prefecture;
  const isMatch = targetArea.includes(prefectureName) || targetArea.includes(company.prefecture);
  
  return {
    reason: {
      field: 'target_area',
      matched: isMatch,
      reason: isMatch
        ? `対象地域（${targetArea}）に${prefectureName}が含まれています`
        : `対象地域（${targetArea}）に${prefectureName}が含まれていません`,
    },
    scoreAdjustment: isMatch ? 15 : -30,
  };
}

/**
 * 業種マッチング
 * 
 * P0-2: company.industry_major が null/undefined の場合の対応追加
 */
function checkIndustryMatch(company: Company, subsidy: JGrantsSearchResult): {
  reason: MatchReason;
  scoreAdjustment: number;
} {
  const targetIndustry = subsidy.target_industry;
  
  // 業種指定なし
  if (!targetIndustry || targetIndustry === '全業種' || targetIndustry.includes('全業種')) {
    return {
      reason: {
        field: 'target_industry',
        matched: true,
        reason: '全業種対象の補助金です',
      },
      scoreAdjustment: 5,
    };
  }
  
  // P0-2: 企業の業種が未設定の場合
  if (!company.industry_major) {
    return {
      reason: {
        field: 'target_industry',
        matched: false,
        reason: '企業の業種が未設定のため、業種マッチングができません',
      },
      scoreAdjustment: -10, // 未設定の場合は軽度のペナルティ
    };
  }
  
  // 業種コードまたは名称でマッチング
  const isMatch = targetIndustry.includes(company.industry_major) ||
                  (company.industry_minor && targetIndustry.includes(company.industry_minor));
  
  return {
    reason: {
      field: 'target_industry',
      matched: isMatch,
      reason: isMatch
        ? `対象業種に該当します`
        : `対象業種（${targetIndustry}）に該当しない可能性があります`,
    },
    scoreAdjustment: isMatch ? 10 : -20,
  };
}

/**
 * 従業員規模マッチング
 * 
 * P0-1: company.employee_count が 0/null/undefined の場合の対応追加
 */
function checkEmployeeMatch(company: Company, subsidy: JGrantsSearchResult): {
  reason: MatchReason;
  scoreAdjustment: number;
} {
  const targetEmployees = subsidy.target_number_of_employees;
  
  // 規模指定なし
  if (!targetEmployees) {
    return {
      reason: {
        field: 'target_number_of_employees',
        matched: true,
        reason: '従業員規模の制限はありません',
      },
      scoreAdjustment: 5,
    };
  }
  
  // P0-1: 従業員数を数値として正規化（文字列/undefined/null対応）
  const employeeCount = typeof company.employee_count === 'number' 
    ? company.employee_count 
    : Number(company.employee_count) || 0;
  
  // P0-1: 企業の従業員数が未設定（0以下）の場合
  if (employeeCount <= 0) {
    return {
      reason: {
        field: 'target_number_of_employees',
        matched: false,
        reason: '企業の従業員数が未設定のため、従業員規模マッチングができません',
      },
      scoreAdjustment: -10, // 未設定の場合は軽度のペナルティ
    };
  }
  
  // 「小規模」「中小企業」などのキーワードマッチング
  let isMatch = false;
  
  if (targetEmployees.includes('小規模') && employeeCount <= 20) {
    isMatch = true;
  } else if (targetEmployees.includes('中小') && employeeCount <= 300) {
    isMatch = true;
  } else if (targetEmployees.includes('中堅') && employeeCount <= 2000) {
    isMatch = true;
  }
  
  // 数値範囲の検出（例: "20人以下", "300人未満"）
  const rangeMatch = targetEmployees.match(/(\d+)人(以下|未満|まで)/);
  if (rangeMatch) {
    const limit = parseInt(rangeMatch[1], 10);
    isMatch = employeeCount <= limit;
  }
  
  return {
    reason: {
      field: 'target_number_of_employees',
      matched: isMatch,
      reason: isMatch
        ? `従業員規模（${employeeCount}名）が対象範囲内です`
        : `従業員規模（${employeeCount}名）が対象外の可能性があります（対象: ${targetEmployees}）`,
    },
    scoreAdjustment: isMatch ? 10 : -25,
  };
}

/**
 * 受付状況チェック
 */
function checkAcceptanceStatus(subsidy: JGrantsSearchResult): {
  reason: MatchReason;
  scoreAdjustment: number;
  risk?: RiskFlag;
} {
  const isAccepting = subsidy.request_reception_display_flag === 1;
  
  return {
    reason: {
      field: 'acceptance_status',
      matched: isAccepting,
      reason: isAccepting ? '現在受付中です' : '受付終了または受付前です',
    },
    scoreAdjustment: isAccepting ? 10 : -40,
    risk: isAccepting ? undefined : {
      type: 'COMPLIANCE',
      level: 'HIGH',
      message: '受付期間外のため申請できません',
    },
  };
}

/**
 * 締切間近チェック
 */
function checkDeadline(subsidy: JGrantsSearchResult): {
  reason?: MatchReason;
  scoreAdjustment: number;
  risk?: RiskFlag;
} {
  const endDateStr = subsidy.acceptance_end_datetime;
  if (!endDateStr) {
    return { scoreAdjustment: 0 };
  }
  
  const endDate = new Date(endDateStr);
  const now = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining < 0) {
    return {
      reason: {
        field: 'deadline',
        matched: false,
        reason: '締切が過ぎています',
      },
      scoreAdjustment: -50,
      risk: {
        type: 'COMPLIANCE',
        level: 'HIGH',
        message: '申請期限が過ぎています',
      },
    };
  }
  
  if (daysRemaining <= 7) {
    return {
      reason: {
        field: 'deadline',
        matched: true,
        reason: `締切まで${daysRemaining}日です`,
      },
      scoreAdjustment: -5,
      risk: {
        type: 'COMPLIANCE',
        level: 'MEDIUM',
        message: `締切間近（残り${daysRemaining}日）。準備期間が不足する可能性があります`,
      },
    };
  }
  
  if (daysRemaining <= 30) {
    return {
      reason: {
        field: 'deadline',
        matched: true,
        reason: `締切まで${daysRemaining}日です`,
      },
      scoreAdjustment: 0,
    };
  }
  
  return {
    reason: {
      field: 'deadline',
      matched: true,
      reason: `締切まで${daysRemaining}日あります`,
    },
    scoreAdjustment: 5,
  };
}

/**
 * 補助額チェック
 */
function checkSubsidyAmount(subsidy: JGrantsSearchResult): {
  reason?: MatchReason;
} {
  const maxLimit = subsidy.subsidy_max_limit;
  const rate = subsidy.subsidy_rate;
  
  if (maxLimit) {
    const formattedAmount = formatAmount(maxLimit);
    return {
      reason: {
        field: 'subsidy_amount',
        matched: true,
        reason: `補助上限: ${formattedAmount}${rate ? `、補助率: ${rate}` : ''}`,
      },
    };
  }
  
  return {};
}

/**
 * 金額フォーマット
 */
function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}億円`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}万円`;
  }
  return `${amount}円`;
}

/**
 * ステータス決定
 */
function determineStatus(score: number, riskFlags: RiskFlag[]): EvaluationStatus {
  // 高リスクがあれば非推奨
  const hasHighRisk = riskFlags.some(r => r.level === 'HIGH');
  if (hasHighRisk) {
    return 'DO_NOT_PROCEED';
  }
  
  // スコアベースの判定
  if (score >= 70) {
    return 'PROCEED';
  }
  if (score >= 40) {
    return 'CAUTION';
  }
  return 'DO_NOT_PROCEED';
}

/**
 * 説明文生成
 */
function generateExplanation(
  status: EvaluationStatus,
  score: number,
  matchReasons: MatchReason[],
  riskFlags: RiskFlag[]
): string {
  const statusLabels: Record<EvaluationStatus, string> = {
    'PROCEED': '推奨',
    'CAUTION': '注意',
    'DO_NOT_PROCEED': '非推奨',
  };
  
  let explanation = `【${statusLabels[status]}】マッチ度 ${score}点\n\n`;
  
  // マッチした項目
  const matched = matchReasons.filter(r => r.matched);
  if (matched.length > 0) {
    explanation += '✓ マッチした項目:\n';
    matched.forEach(r => {
      explanation += `  - ${r.reason}\n`;
    });
    explanation += '\n';
  }
  
  // マッチしなかった項目
  const notMatched = matchReasons.filter(r => !r.matched);
  if (notMatched.length > 0) {
    explanation += '✗ 確認が必要な項目:\n';
    notMatched.forEach(r => {
      explanation += `  - ${r.reason}\n`;
    });
    explanation += '\n';
  }
  
  // リスク
  if (riskFlags.length > 0) {
    explanation += '⚠ リスク:\n';
    riskFlags.forEach(r => {
      const levelLabel = r.level === 'HIGH' ? '高' : r.level === 'MEDIUM' ? '中' : '低';
      explanation += `  - [${levelLabel}] ${r.message}\n`;
    });
  }
  
  return explanation.trim();
}

/**
 * 複数の補助金を一括スクリーニング
 */
export function performBatchScreening(
  company: Company,
  subsidies: JGrantsSearchResult[]
): MatchResult[] {
  return subsidies.map(subsidy => performScreening(company, subsidy));
}

/**
 * スクリーニング結果をソート
 * 
 * P3-SCORE1 凍結ソート順:
 * 1. wall_chat_ready DESC (壁打ち可能が上位)
 * 2. evaluation.status (PROCEED > CAUTION > DO_NOT_PROCEED)
 * 3. score DESC
 * 4. acceptance_end_datetime ASC (締切が近い順)
 * 5. subsidy.id ASC (タイブレーク固定)
 */
export function sortByStatus(results: MatchResult[]): MatchResult[] {
  const statusOrder: Record<EvaluationStatus, number> = {
    'PROCEED': 0,
    'CAUTION': 1,
    'DO_NOT_PROCEED': 2,
  };
  
  return [...results].sort((a, b) => {
    // 1. wall_chat_ready DESC (true=0, false/undefined=1)
    const aWallChat = (a.subsidy as any).wall_chat_ready === true ? 0 : 1;
    const bWallChat = (b.subsidy as any).wall_chat_ready === true ? 0 : 1;
    if (aWallChat !== bWallChat) return aWallChat - bWallChat;
    
    // 2. status
    const statusDiff = statusOrder[a.evaluation.status] - statusOrder[b.evaluation.status];
    if (statusDiff !== 0) return statusDiff;
    
    // 3. score DESC
    const scoreDiff = b.evaluation.score - a.evaluation.score;
    if (scoreDiff !== 0) return scoreDiff;
    
    // 4. deadline ASC (近い方が上)
    const aDeadline = a.subsidy.acceptance_end_datetime || '9999-12-31';
    const bDeadline = b.subsidy.acceptance_end_datetime || '9999-12-31';
    if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
    
    // 5. id ASC (タイブレーク固定)
    return a.subsidy.id.localeCompare(b.subsidy.id);
  });
}

/**
 * スクリーニング結果をスコアでソート
 */
export function sortByScore(results: MatchResult[], order: 'ASC' | 'DESC' = 'DESC'): MatchResult[] {
  return [...results].sort((a, b) => {
    const diff = a.evaluation.score - b.evaluation.score;
    return order === 'DESC' ? -diff : diff;
  });
}

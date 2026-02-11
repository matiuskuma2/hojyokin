/**
 * 一次スクリーニング v2（SSOT統一版）
 * 
 * Freeze-MATCH-0: 入力を (CompanySSOT, NormalizedSubsidyDetail) に統一
 * Freeze-MATCH-2: missing_fields を出力に追加
 * Phase 24 MATCH-1/2/3: 中小企業基本法準拠の業種別SME判定テーブル実装
 * 
 * 企業情報と補助金データを比較し、マッチ度・リスク・判定を算出
 */

import type {
  EvaluationStatus,
  RiskFlag,
  MatchReason,
} from '../types';
import type {
  NormalizedSubsidyDetail,
  EligibilityRule,
} from './ssot';
import type {
  CompanySSOT,
  MissingField,
} from './ssot/getCompanySSOT';

// ============================================================
// 型定義
// ============================================================

/**
 * スクリーニング結果（v2）
 * 
 * Freeze-MATCH-2: missing_fields を追加
 */
export interface ScreeningResultV2 {
  subsidy_canonical_id: string;
  subsidy_title: string;
  evaluation: {
    status: EvaluationStatus;
    score: number;
    match_reasons: MatchReason[];
    risk_flags: RiskFlag[];
    explanation: string;
  };
  // Freeze-MATCH-2: 情報不足フィールド
  missing_fields: MissingFieldResult[];
  // 元の補助金情報（表示用）
  subsidy_summary: {
    subsidy_max_limit: number | null;
    subsidy_rate_text: string | null;
    target_area_text: string | null;
    acceptance_end: string | null;
    is_accepting: boolean;
    wall_chat_ready: boolean;
  };
}

/**
 * 不足フィールド結果
 */
export interface MissingFieldResult {
  field: string;
  source: 'company' | 'subsidy' | 'fact';
  severity: 'blocker' | 'important' | 'optional';
  label: string;
  reason: string;
}

// 都道府県コードと名称のマッピング
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

// ============================================================
// 中小企業基本法 業種別判定テーブル (Phase 24 MATCH-1/2/3)
// ============================================================

/**
 * SME業種カテゴリ
 * 中小企業基本法 第2条に基づく4カテゴリ
 */
export type SmeIndustryCategory = 'manufacturing' | 'wholesale' | 'service' | 'retail';

/**
 * 業種別の中小企業定義テーブル
 * 出典: 中小企業基本法 第2条第1項
 * https://www.chusho.meti.go.jp/soshiki/teigi.html
 */
export interface SmeThresholds {
  /** 業種カテゴリ日本語名 */
  label: string;
  /** 資本金上限（円） */
  capitalLimit: number;
  /** 従業員上限（常時使用する従業員数） */
  employeeLimit: number;
  /** 小規模事業者の従業員上限 */
  smallScaleEmployeeLimit: number;
}

/**
 * 中小企業基本法に基づく業種別判定テーブル
 * 
 * | 業種 | 資本金上限 | 従業員上限 | 小規模上限 |
 * |------|-----------|-----------|----------|
 * | 製造業・建設業・運輸業等 | 3億円 | 300人 | 20人 |
 * | 卸売業 | 1億円 | 100人 | 5人 |
 * | サービス業 | 5千万円 | 100人 | 5人 |
 * | 小売業 | 5千万円 | 50人 | 5人 |
 */
export const SME_THRESHOLDS: Record<SmeIndustryCategory, SmeThresholds> = {
  manufacturing: {
    label: '製造業・建設業・運輸業等',
    capitalLimit:  300_000_000,   // 3億円
    employeeLimit: 300,
    smallScaleEmployeeLimit: 20,
  },
  wholesale: {
    label: '卸売業',
    capitalLimit:  100_000_000,   // 1億円
    employeeLimit: 100,
    smallScaleEmployeeLimit: 5,
  },
  service: {
    label: 'サービス業',
    capitalLimit:   50_000_000,   // 5千万円
    employeeLimit: 100,
    smallScaleEmployeeLimit: 5,
  },
  retail: {
    label: '小売業',
    capitalLimit:   50_000_000,   // 5千万円
    employeeLimit:  50,
    smallScaleEmployeeLimit: 5,
  },
};

/**
 * industry_major 文字列 → SmeIndustryCategory への変換マップ
 * dashboard/agency の <select> オプション値と一致させる
 */
const INDUSTRY_CATEGORY_MAP: Record<string, SmeIndustryCategory> = {
  // manufacturing カテゴリ
  '製造業':     'manufacturing',
  '建設業':     'manufacturing',
  '運輸業':     'manufacturing',
  '情報通信業': 'manufacturing',  // 製造業等に分類（中小企業庁ガイダンス）
  '鉱業':       'manufacturing',
  '電気・ガス': 'manufacturing',
  // wholesale
  '卸売業':     'wholesale',
  // service
  'サービス業': 'service',
  '宿泊業':     'service',
  '飲食業':     'service',       // 飲食サービス業
  '医療福祉':   'service',
  '教育':       'service',
  '不動産業':   'service',
  '娯楽業':     'service',
  // retail
  '小売業':     'retail',
};

/**
 * industry_major 文字列から SmeIndustryCategory を判定
 * マップに存在しない場合は最も緩い基準（manufacturing）を適用（安全側）
 */
export function resolveIndustryCategory(industryMajor: string | null): SmeIndustryCategory {
  if (!industryMajor) return 'manufacturing'; // デフォルト: 最も緩い基準
  const trimmed = industryMajor.trim();
  // 完全一致
  if (INDUSTRY_CATEGORY_MAP[trimmed]) {
    return INDUSTRY_CATEGORY_MAP[trimmed];
  }
  // 部分一致（「○○業」→ マップキーに含むか）
  for (const [key, cat] of Object.entries(INDUSTRY_CATEGORY_MAP)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return cat;
    }
  }
  // フォールバック: 安全側として最も緩い基準
  return 'manufacturing';
}

/**
 * 企業が中小企業かどうかを判定（資本金 OR 従業員数のいずれかで判定）
 * 中小企業基本法: 資本金上限以下 OR 従業員数上限以下 → 中小企業
 */
export function isSmeByLaw(
  capital: number | null,
  employeeCount: number,
  category: SmeIndustryCategory
): { isSme: boolean; isSmallScale: boolean; thresholds: SmeThresholds; reason: string } {
  const t = SME_THRESHOLDS[category];
  
  const capitalOk = capital !== null ? capital <= t.capitalLimit : true; // 不明時は通過
  const employeeOk = employeeCount <= t.employeeLimit;
  const isSme = capitalOk || employeeOk; // OR条件（いずれか満たせばOK）
  const isSmallScale = employeeCount <= t.smallScaleEmployeeLimit;

  let reason: string;
  if (isSme && isSmallScale) {
    reason = `小規模事業者に該当（${t.label}: 従業員${employeeCount}名 ≤ ${t.smallScaleEmployeeLimit}人）`;
  } else if (isSme) {
    reason = `中小企業に該当（${t.label}: `;
    const parts: string[] = [];
    if (capital !== null) parts.push(`資本金${formatCurrency(capital)} ≤ ${formatCurrency(t.capitalLimit)}`);
    if (employeeOk) parts.push(`従業員${employeeCount}名 ≤ ${t.employeeLimit}人`);
    reason += parts.join(' / ') + '）';
  } else {
    reason = `中小企業の要件を超過（${t.label}: `;
    const parts: string[] = [];
    if (capital !== null && !capitalOk) parts.push(`資本金${formatCurrency(capital)} > ${formatCurrency(t.capitalLimit)}`);
    if (!employeeOk) parts.push(`従業員${employeeCount}名 > ${t.employeeLimit}人`);
    reason += parts.join(' / ') + '）';
  }

  return { isSme, isSmallScale, thresholds: t, reason };
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 一次スクリーニング v2（SSOT統一版）
 * 
 * Freeze-MATCH-0: 入力は (CompanySSOT, NormalizedSubsidyDetail) のみ
 */
export function performScreeningV2(
  company: CompanySSOT,
  subsidy: NormalizedSubsidyDetail
): ScreeningResultV2 {
  const matchReasons: MatchReason[] = [];
  const riskFlags: RiskFlag[] = [];
  const missingFields: MissingFieldResult[] = [];
  let score = 50; // 基準スコア

  // === 会社側の不足情報を転記 ===
  for (const mf of company.missing_fields) {
    missingFields.push({
      field: mf.field,
      source: mf.source === 'fact' ? 'fact' : 'company',
      severity: mf.severity === 'critical' ? 'blocker' : mf.severity === 'important' ? 'important' : 'optional',
      label: mf.label,
      reason: `${mf.label}が未設定です`,
    });
  }

  // 1. 地域マッチング
  const areaResult = checkAreaMatchV2(company, subsidy);
  matchReasons.push(areaResult.reason);
  score += areaResult.scoreAdjustment;
  if (areaResult.missing) {
    missingFields.push(areaResult.missing);
  }

  // 2. 業種マッチング
  const industryResult = checkIndustryMatchV2(company, subsidy);
  matchReasons.push(industryResult.reason);
  score += industryResult.scoreAdjustment;
  if (industryResult.missing) {
    missingFields.push(industryResult.missing);
  }

  // 3. 従業員規模マッチング
  const employeeResult = checkEmployeeMatchV2(company, subsidy);
  matchReasons.push(employeeResult.reason);
  score += employeeResult.scoreAdjustment;
  if (employeeResult.missing) {
    missingFields.push(employeeResult.missing);
  }

  // 4. 受付状況チェック
  const acceptanceResult = checkAcceptanceStatusV2(subsidy);
  matchReasons.push(acceptanceResult.reason);
  score += acceptanceResult.scoreAdjustment;
  if (acceptanceResult.risk) {
    riskFlags.push(acceptanceResult.risk);
  }

  // 5. 締切間近チェック
  const deadlineResult = checkDeadlineV2(subsidy);
  if (deadlineResult.reason) {
    matchReasons.push(deadlineResult.reason);
    score += deadlineResult.scoreAdjustment;
  }
  if (deadlineResult.risk) {
    riskFlags.push(deadlineResult.risk);
  }

  // 6. 資本金チェック（中小企業判定）
  const capitalResult = checkCapitalV2(company, subsidy);
  if (capitalResult.reason) {
    matchReasons.push(capitalResult.reason);
    score += capitalResult.scoreAdjustment;
  }
  if (capitalResult.missing) {
    missingFields.push(capitalResult.missing);
  }
  if (capitalResult.risk) {
    riskFlags.push(capitalResult.risk);
  }

  // 7. GビズID チェック（電子申請の場合）
  const gbizResult = checkGbizIdV2(company, subsidy);
  if (gbizResult.reason) {
    matchReasons.push(gbizResult.reason);
    score += gbizResult.scoreAdjustment;
  }
  if (gbizResult.missing) {
    missingFields.push(gbizResult.missing);
  }

  // 8. 補助金の eligibility_rules をチェック
  const rulesResult = checkEligibilityRulesV2(company, subsidy.content.eligibility_rules);
  for (const r of rulesResult.reasons) {
    matchReasons.push(r);
  }
  score += rulesResult.scoreAdjustment;
  for (const rf of rulesResult.risks) {
    riskFlags.push(rf);
  }
  for (const mf of rulesResult.missing) {
    missingFields.push(mf);
  }

  // スコアを0-100に正規化
  score = Math.max(0, Math.min(100, score));

  // ステータス決定（missing_fields を考慮）
  const status = determineStatusV2(score, riskFlags, missingFields);

  // 説明文生成
  const explanation = generateExplanationV2(status, score, matchReasons, riskFlags, missingFields);

  return {
    subsidy_canonical_id: subsidy.ids.canonical_id,
    subsidy_title: subsidy.display.title,
    evaluation: {
      status,
      score,
      match_reasons: matchReasons,
      risk_flags: riskFlags,
      explanation,
    },
    missing_fields: missingFields,
    subsidy_summary: {
      subsidy_max_limit: subsidy.display.subsidy_max_limit,
      subsidy_rate_text: subsidy.display.subsidy_rate_text,
      target_area_text: subsidy.display.target_area_text,
      acceptance_end: subsidy.acceptance.acceptance_end,
      is_accepting: subsidy.acceptance.is_accepting,
      wall_chat_ready: subsidy.wall_chat.ready,
    },
  };
}

// ============================================================
// 個別チェック関数
// ============================================================

/**
 * 地域マッチング v2
 */
function checkAreaMatchV2(company: CompanySSOT, subsidy: NormalizedSubsidyDetail): {
  reason: MatchReason;
  scoreAdjustment: number;
  missing?: MissingFieldResult;
} {
  const targetArea = subsidy.display.target_area_text;

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

  // 企業の都道府県が未設定の場合
  if (!company.prefecture) {
    return {
      reason: {
        field: 'target_area',
        matched: false,
        reason: '企業の所在地が未設定のため、地域マッチングができません',
      },
      scoreAdjustment: 0, // 未設定の場合はペナルティなし（Missingに落とす）
      missing: {
        field: 'prefecture',
        source: 'company',
        severity: 'blocker',
        label: '都道府県',
        reason: '地域マッチングに必要です',
      },
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
 * 業種マッチング v2
 */
function checkIndustryMatchV2(company: CompanySSOT, subsidy: NormalizedSubsidyDetail): {
  reason: MatchReason;
  scoreAdjustment: number;
  missing?: MissingFieldResult;
} {
  // normalized には target_industry がないので overview.target_business を参照
  const targetIndustry = subsidy.overview.target_business;

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

  // 企業の業種が未設定の場合
  if (!company.industry_major) {
    return {
      reason: {
        field: 'target_industry',
        matched: false,
        reason: '企業の業種が未設定のため、業種マッチングができません',
      },
      scoreAdjustment: 0, // 未設定の場合はペナルティなし（Missingに落とす）
      missing: {
        field: 'industry_major',
        source: 'company',
        severity: 'blocker',
        label: '業種',
        reason: '業種マッチングに必要です',
      },
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
 * 従業員規模マッチング v2
 */
function checkEmployeeMatchV2(company: CompanySSOT, subsidy: NormalizedSubsidyDetail): {
  reason: MatchReason;
  scoreAdjustment: number;
  missing?: MissingFieldResult;
} {
  // eligibility_rules から従業員数関連のルールを探す
  const employeeRules = subsidy.content.eligibility_rules.filter(
    r => r.category?.includes('employee') || r.rule_text?.includes('従業員')
  );

  // 従業員規模指定なし
  if (employeeRules.length === 0) {
    return {
      reason: {
        field: 'target_number_of_employees',
        matched: true,
        reason: '従業員規模の制限はありません',
      },
      scoreAdjustment: 5,
    };
  }

  const employeeCount = company.employee_count || 0;

  // 企業の従業員数が未設定（0以下）の場合
  if (employeeCount <= 0) {
    return {
      reason: {
        field: 'target_number_of_employees',
        matched: false,
        reason: '企業の従業員数が未設定のため、従業員規模マッチングができません',
      },
      scoreAdjustment: 0,
      missing: {
        field: 'employee_count',
        source: 'company',
        severity: 'blocker',
        label: '従業員数',
        reason: '従業員規模マッチングに必要です',
      },
    };
  }

  // 業種別SME判定テーブルを使用した判定 (Phase 24 MATCH-1/2/3)
  const industryCategory = resolveIndustryCategory(company.industry_major);
  const smeResult = isSmeByLaw(company.capital, employeeCount, industryCategory);

  // ルールテキストから判定
  let isMatch = true;
  for (const rule of employeeRules) {
    const ruleText = rule.rule_text || '';
    
    // 「小規模」キーワード → 業種別の小規模事業者上限で判定
    if (ruleText.includes('小規模') && !smeResult.isSmallScale) {
      isMatch = false;
    // 「中小」キーワード → 業種別の中小企業上限で判定
    } else if (ruleText.includes('中小') && !smeResult.isSme) {
      isMatch = false;
    // 「中堅」キーワード → 2000人以下（中堅企業は業種による差異なし）
    } else if (ruleText.includes('中堅') && employeeCount > 2000) {
      isMatch = false;
    }

    // 数値範囲の検出（例: "20人以下", "300人未満"）
    const rangeMatch = ruleText.match(/(\d+)人(以下|未満|まで)/);
    if (rangeMatch) {
      const limit = parseInt(rangeMatch[1], 10);
      if (employeeCount > limit) {
        isMatch = false;
      }
    }
  }

  return {
    reason: {
      field: 'target_number_of_employees',
      matched: isMatch,
      reason: isMatch
        ? `従業員規模（${employeeCount}名）が対象範囲内です — ${smeResult.reason}`
        : `従業員規模（${employeeCount}名）が対象外の可能性があります — ${smeResult.reason}`,
    },
    scoreAdjustment: isMatch ? 10 : -25,
  };
}

/**
 * 受付状況チェック v2
 */
function checkAcceptanceStatusV2(subsidy: NormalizedSubsidyDetail): {
  reason: MatchReason;
  scoreAdjustment: number;
  risk?: RiskFlag;
} {
  const isAccepting = subsidy.acceptance.is_accepting;

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
 * 締切間近チェック v2
 */
function checkDeadlineV2(subsidy: NormalizedSubsidyDetail): {
  reason?: MatchReason;
  scoreAdjustment: number;
  risk?: RiskFlag;
} {
  const endDateStr = subsidy.acceptance.acceptance_end;
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
 * 資本金チェック v2（中小企業判定）
 */
function checkCapitalV2(company: CompanySSOT, subsidy: NormalizedSubsidyDetail): {
  reason?: MatchReason;
  scoreAdjustment: number;
  missing?: MissingFieldResult;
  risk?: RiskFlag;
} {
  // eligibility_rules から資本金関連のルールを探す
  const capitalRules = subsidy.content.eligibility_rules.filter(
    r => r.category?.includes('capital') || r.rule_text?.includes('資本金')
  );

  if (capitalRules.length === 0) {
    return { scoreAdjustment: 0 };
  }

  // 資本金が未設定の場合
  if (company.capital === null || company.capital === undefined) {
    return {
      scoreAdjustment: 0,
      missing: {
        field: 'capital',
        source: 'company',
        severity: 'important',
        label: '資本金',
        reason: '中小企業判定に必要です',
      },
    };
  }

  // 業種別中小企業判定 (Phase 24 MATCH-1/2/3)
  const industryCategory = resolveIndustryCategory(company.industry_major);
  const smeResult = isSmeByLaw(company.capital, company.employee_count, industryCategory);
  const thresholds = smeResult.thresholds;

  // 資本金のみで判定（資本金上限以下か）
  const capitalOk = company.capital <= thresholds.capitalLimit;

  return {
    reason: {
      field: 'capital',
      matched: capitalOk,
      reason: capitalOk
        ? `資本金（${formatCurrency(company.capital)}）は${thresholds.label}の中小企業上限（${formatCurrency(thresholds.capitalLimit)}）以下です`
        : `資本金（${formatCurrency(company.capital)}）が${thresholds.label}の中小企業上限（${formatCurrency(thresholds.capitalLimit)}）を超えています`,
    },
    scoreAdjustment: capitalOk ? 5 : -20,
    risk: capitalOk ? undefined : {
      type: 'COMPLIANCE',
      level: 'MEDIUM',
      message: `資本金が${thresholds.label}の中小企業上限（${formatCurrency(thresholds.capitalLimit)}）を超えている可能性があります`,
    },
  };
}

/**
 * GビズID チェック v2
 */
function checkGbizIdV2(company: CompanySSOT, subsidy: NormalizedSubsidyDetail): {
  reason?: MatchReason;
  scoreAdjustment: number;
  missing?: MissingFieldResult;
} {
  // 電子申請の場合のみチェック
  if (!subsidy.electronic_application.is_electronic_application) {
    return { scoreAdjustment: 0 };
  }

  const hasGbizId = company.facts.has_gbiz_id;

  if (hasGbizId === null) {
    return {
      scoreAdjustment: 0,
      missing: {
        field: 'has_gbiz_id',
        source: 'fact',
        severity: 'important',
        label: 'GビズID',
        reason: '電子申請にはGビズIDが必要です',
      },
    };
  }

  return {
    reason: {
      field: 'gbiz_id',
      matched: hasGbizId,
      reason: hasGbizId
        ? 'GビズIDを取得済みです'
        : 'GビズIDが必要です（電子申請）',
    },
    scoreAdjustment: hasGbizId ? 5 : -10,
  };
}

/**
 * eligibility_rules からの自動チェック v2
 */
function checkEligibilityRulesV2(company: CompanySSOT, rules: EligibilityRule[]): {
  reasons: MatchReason[];
  scoreAdjustment: number;
  risks: RiskFlag[];
  missing: MissingFieldResult[];
} {
  const reasons: MatchReason[] = [];
  const risks: RiskFlag[] = [];
  const missing: MissingFieldResult[] = [];
  const missingFieldSet = new Set<string>(); // 重複排除用
  let scoreAdjustment = 0;

  const addMissing = (item: MissingFieldResult) => {
    if (!missingFieldSet.has(item.field)) {
      missingFieldSet.add(item.field);
      missing.push(item);
    }
  };

  for (const rule of rules) {
    if (rule.check_type !== 'AUTO') continue;

    const category = rule.category || '';
    const ruleText = rule.rule_text || '';

    // 税金滞納チェック
    if (category.includes('tax') || ruleText.includes('税金') || ruleText.includes('滞納')) {
      if (company.facts.tax_arrears === null) {
        addMissing({
          field: 'tax_arrears',
          source: 'fact',
          severity: 'important',
          label: '税金滞納状況',
          reason: '補助金申請要件の確認に必要です',
        });
      } else if (company.facts.tax_arrears === true) {
        reasons.push({
          field: 'tax_arrears',
          matched: false,
          reason: '税金の滞納があると申請できません',
        });
        scoreAdjustment -= 50;
        risks.push({
          type: 'COMPLIANCE',
          level: 'HIGH',
          message: '税金の滞納があるため申請資格がありません',
        });
      }
    }

    // 過去補助金受給チェック
    if (category.includes('past_subsidy') || ruleText.includes('過去') || ruleText.includes('受給')) {
      if (company.facts.past_subsidy_same_type === null) {
        addMissing({
          field: 'past_subsidy_same_type',
          source: 'fact',
          severity: 'optional',
          label: '過去の補助金受給歴',
          reason: '重複申請の確認に必要です',
        });
      } else if (company.facts.past_subsidy_same_type === true) {
        reasons.push({
          field: 'past_subsidy',
          matched: false,
          reason: '同種の補助金を過去に受給している場合、申請できない可能性があります',
        });
        scoreAdjustment -= 20;
        risks.push({
          type: 'COMPLIANCE',
          level: 'MEDIUM',
          message: '過去に同種の補助金を受給している可能性があります',
        });
      }
    }

    // 賃上げ関連チェック
    if (category.includes('wage') || ruleText.includes('賃上げ') || ruleText.includes('給与')) {
      if (company.facts.plans_wage_raise === null) {
        addMissing({
          field: 'plans_wage_raise',
          source: 'fact',
          severity: 'optional',
          label: '賃上げ予定',
          reason: '賃上げ要件の確認に必要です',
        });
      } else if (company.facts.plans_wage_raise === true) {
        reasons.push({
          field: 'wage_raise',
          matched: true,
          reason: '賃上げ要件を満たす可能性があります（加点対象）',
        });
        scoreAdjustment += 10;
      }
    }
  }

  return { reasons, scoreAdjustment, risks, missing };
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * ステータス決定 v2
 * 
 * Freeze-MATCH-2: missing_fields を考慮
 */
function determineStatusV2(
  score: number,
  riskFlags: RiskFlag[],
  missingFields: MissingFieldResult[]
): EvaluationStatus {
  // 高リスクがあれば非推奨
  const hasHighRisk = riskFlags.some(r => r.level === 'HIGH');
  if (hasHighRisk) {
    return 'DO_NOT_PROCEED';
  }

  // blocker レベルの missing があれば CAUTION
  const hasBlocker = missingFields.some(m => m.severity === 'blocker');
  if (hasBlocker) {
    return 'CAUTION';
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
 * 説明文生成 v2
 */
function generateExplanationV2(
  status: EvaluationStatus,
  score: number,
  matchReasons: MatchReason[],
  riskFlags: RiskFlag[],
  missingFields: MissingFieldResult[]
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

  // 不足情報
  if (missingFields.length > 0) {
    explanation += '❓ 情報不足:\n';
    missingFields.forEach(mf => {
      const severityLabel = mf.severity === 'blocker' ? '[必須]' : mf.severity === 'important' ? '[重要]' : '[任意]';
      explanation += `  - ${severityLabel} ${mf.label}: ${mf.reason}\n`;
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
 * 金額フォーマット
 */
function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}億円`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}万円`;
  }
  return `${value}円`;
}

// ============================================================
// バッチ処理 & ソート
// ============================================================

/**
 * 複数の補助金を一括スクリーニング v2
 */
export function performBatchScreeningV2(
  company: CompanySSOT,
  subsidies: NormalizedSubsidyDetail[]
): ScreeningResultV2[] {
  return subsidies.map(subsidy => performScreeningV2(company, subsidy));
}

/**
 * スクリーニング結果をソート v2
 * 
 * P3-SCORE1 凍結ソート順:
 * 1. wall_chat_ready DESC (壁打ち可能が上位)
 * 2. evaluation.status (PROCEED > CAUTION > DO_NOT_PROCEED)
 * 3. score DESC
 * 4. acceptance_end ASC (締切が近い順)
 * 5. subsidy_canonical_id ASC (タイブレーク固定)
 */
export function sortByStatusV2(results: ScreeningResultV2[]): ScreeningResultV2[] {
  const statusOrder: Record<EvaluationStatus, number> = {
    'PROCEED': 0,
    'CAUTION': 1,
    'DO_NOT_PROCEED': 2,
  };

  return [...results].sort((a, b) => {
    // 1. wall_chat_ready DESC (true=0, false=1)
    const aWallChat = a.subsidy_summary.wall_chat_ready ? 0 : 1;
    const bWallChat = b.subsidy_summary.wall_chat_ready ? 0 : 1;
    if (aWallChat !== bWallChat) return aWallChat - bWallChat;

    // 2. status
    const statusDiff = statusOrder[a.evaluation.status] - statusOrder[b.evaluation.status];
    if (statusDiff !== 0) return statusDiff;

    // 3. score DESC
    const scoreDiff = b.evaluation.score - a.evaluation.score;
    if (scoreDiff !== 0) return scoreDiff;

    // 4. deadline ASC (近い方が上)
    const aDeadline = a.subsidy_summary.acceptance_end || '9999-12-31';
    const bDeadline = b.subsidy_summary.acceptance_end || '9999-12-31';
    if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);

    // 5. id ASC (タイブレーク固定)
    return a.subsidy_canonical_id.localeCompare(b.subsidy_canonical_id);
  });
}

/**
 * スクリーニング結果をスコアでソート v2
 */
export function sortByScoreV2(results: ScreeningResultV2[], order: 'ASC' | 'DESC' = 'DESC'): ScreeningResultV2[] {
  return [...results].sort((a, b) => {
    const diff = a.evaluation.score - b.evaluation.score;
    return order === 'DESC' ? -diff : diff;
  });
}

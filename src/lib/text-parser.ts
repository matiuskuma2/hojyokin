/**
 * text-parser.ts
 * 
 * P0-1: detail_json のフラットテキストを構造化するテキスト解析エンジン
 * 
 * Freeze v3.1 §23 / P0計画 Phase 1 に準拠
 * 
 * 方式: ハイブリッドC方式
 * - Phase 1 (P0): 正規表現のみで高速分割・分類（コスト0、レイテンシ<1ms）
 * - Phase 2 (P1): 品質チェック後、不足時のみ LLM フォールバック（将来）
 * 
 * @module
 */

// =====================================================
// 型定義
// =====================================================

/** 適格性ルールのカテゴリ */
export type EligibilityCategory = 
  | 'plan'          // 計画・目標系
  | 'financial'     // 資本金・売上・賃金系
  | 'employee'      // 従業員数・雇用系
  | 'compliance'    // 法令遵守・税金滞納系
  | 'exclusion'     // 除外条件
  | 'application'   // 申請手続き系
  | 'region'        // 地域系
  | 'industry'      // 業種系
  | 'other';        // その他

/** 解析された適格性ルール */
export interface ParsedEligibilityRule {
  text: string;
  category: EligibilityCategory;
  check_type: 'auto' | 'manual';
  /** 自動チェック可能なフィールド名 */
  auto_field?: string;
  /** 信頼度 (0-1) */
  confidence: number;
}

/** 解析された経費カテゴリ */
export interface ParsedExpenseCategory {
  text: string;
  /** 経費の分類 */
  expense_type?: string;
  confidence: number;
}

/** 解析された必要書類 */
export interface ParsedDocument {
  text: string;
  is_required: boolean;
  /** 書類カテゴリ */
  doc_type?: string;
  confidence: number;
}

/** テキスト解析結果（DetailJsonParseResult） */
export interface DetailJsonParseResult {
  eligibility: {
    rules: ParsedEligibilityRule[];
    raw_text: string;
  };
  expenses: {
    categories: ParsedExpenseCategory[];
    excluded: string[];
    raw_text: string;
  };
  documents: {
    documents: ParsedDocument[];
    raw_text: string;
  };
  /** 総合品質スコア (0-100) */
  overall_quality_score: number;
  /** 解析メタデータ */
  meta: {
    method: 'regex';  // P0 は regex のみ
    parse_time_ms: number;
    input_fields_found: string[];
  };
}

// =====================================================
// セパレータ定義（Freeze v3.1 §23.1）
// =====================================================

/** テキスト分割用の区切りパターン */
const TEXT_SEPARATORS = /[、。・\n\r;；]+|(?:[\s]+(?:及び|又は|並びに|かつ|および|または)[\s]*)/;

/** 番号付きリスト（①②③ 等 or 1. 2. 3. or (1)(2)(3)） */
const NUMBERED_LIST = /(?:^|\n)\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]|[（\(]\d+[）\)]|\d+[\.\)）])\s*/;

// =====================================================
// カテゴリ判定パターン
// =====================================================

const ELIGIBILITY_CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  category: EligibilityCategory;
  auto_field?: string;
}> = [
  // 従業員系
  { pattern: /従業員|常勤|正社員|パート|アルバイト|人以下|人未満|名以下/, category: 'employee', auto_field: 'employee_count' },
  // 資本金・財務系
  { pattern: /資本金|売上|年商|付加価値|利益|賃金|給与|ベースアップ|賃上げ/, category: 'financial', auto_field: 'capital' },
  // 計画系
  { pattern: /事業計画|計画を策定|年間の計画|経営革新|事業再構築|新事業/, category: 'plan' },
  // 法令遵守系
  { pattern: /滞納|反社|暴力団|法令|違反|処分|不正|税金/, category: 'compliance' },
  // 除外系
  { pattern: /対象外|除外|該当しない|受給できない|不可|できません/, category: 'exclusion' },
  // 申請手続き
  { pattern: /GビズID|電子申請|jGrants|認定支援機関/, category: 'application' },
  // 地域系
  { pattern: /都道府県|市区町村|地域|地方|所在地/, category: 'region', auto_field: 'prefecture' },
  // 業種系
  { pattern: /業種|中小企業|小規模事業者|個人事業|法人|製造業|サービス業/, category: 'industry', auto_field: 'industry_major' },
];

/** 経費除外キーワード */
const EXPENSE_EXCLUSION_PATTERNS = /対象外|除外|含まない|認められない|不可/;

/** 書類の必須/任意判定 */
const REQUIRED_DOC_PATTERNS = /必須|必ず|要提出|提出必須|提出すること|義務/;
const OPTIONAL_DOC_PATTERNS = /任意|該当する場合|必要に応じて|ある場合/;

// =====================================================
// メイン解析関数
// =====================================================

/**
 * detail_json のフラットテキストを構造化する
 * 
 * @param detail - detail_json をパースしたオブジェクト
 * @returns DetailJsonParseResult 構造化データ
 */
export function parseDetailJson(detail: Record<string, any> | null): DetailJsonParseResult {
  const start = Date.now();
  const inputFieldsFound: string[] = [];
  
  if (!detail) {
    return emptyResult(Date.now() - start, inputFieldsFound);
  }

  // ===== 1. 適格性ルール解析 =====
  const eligibilityRawText = extractTextField(detail, [
    'application_requirements',
    'target_applicants', 
    'target_businesses',
  ]);
  if (eligibilityRawText) inputFieldsFound.push('eligibility');
  const eligibilityRules = parseEligibilityFromText(eligibilityRawText);

  // ===== 2. 経費解析 =====
  const expenseRawText = extractTextField(detail, [
    'eligible_expenses',
    'target_expenses',
  ]);
  if (expenseRawText) inputFieldsFound.push('expenses');
  const expenseResult = parseExpensesFromText(expenseRawText);

  // ===== 3. 書類解析 =====
  const docsRawText = extractTextField(detail, [
    'required_documents',
    'submission_documents',
  ]);
  if (docsRawText) inputFieldsFound.push('documents');
  const docsResult = parseRequiredDocsFromText(docsRawText);

  // ===== 4. 品質スコア計算 =====
  const qualityScore = computeQualityScore(
    eligibilityRules, 
    expenseResult.categories, 
    docsResult.documents,
    inputFieldsFound
  );

  return {
    eligibility: {
      rules: eligibilityRules,
      raw_text: eligibilityRawText,
    },
    expenses: {
      categories: expenseResult.categories,
      excluded: expenseResult.excluded,
      raw_text: expenseRawText,
    },
    documents: {
      documents: docsResult.documents,
      raw_text: docsRawText,
    },
    overall_quality_score: qualityScore,
    meta: {
      method: 'regex',
      parse_time_ms: Date.now() - start,
      input_fields_found: inputFieldsFound,
    },
  };
}

// =====================================================
// 個別解析関数
// =====================================================

/**
 * 適格性ルールの解析
 * 
 * application_requirements 等のテキストを分割し、カテゴリ分類する
 */
export function parseEligibilityFromText(text: string): ParsedEligibilityRule[] {
  if (!text || text.trim().length < 5) return [];

  const fragments = splitText(text);
  const rules: ParsedEligibilityRule[] = [];

  for (const fragment of fragments) {
    const trimmed = fragment.trim();
    if (trimmed.length < 5) continue; // 短すぎるフラグメントはスキップ

    const categorization = categorizeEligibility(trimmed);
    
    rules.push({
      text: trimmed,
      category: categorization.category,
      check_type: categorization.auto_field ? 'auto' : 'manual',
      auto_field: categorization.auto_field,
      confidence: categorization.confidence,
    });
  }

  return rules;
}

/**
 * 対象経費の解析
 * 
 * eligible_expenses テキストを分割し、除外経費も抽出する
 */
export function parseExpensesFromText(text: string): {
  categories: ParsedExpenseCategory[];
  excluded: string[];
} {
  if (!text || text.trim().length < 5) {
    return { categories: [], excluded: [] };
  }

  const fragments = splitText(text);
  const categories: ParsedExpenseCategory[] = [];
  const excluded: string[] = [];

  for (const fragment of fragments) {
    const trimmed = fragment.trim();
    if (trimmed.length < 3) continue;

    // 除外経費かチェック
    if (EXPENSE_EXCLUSION_PATTERNS.test(trimmed)) {
      excluded.push(trimmed);
      continue;
    }

    categories.push({
      text: trimmed,
      expense_type: classifyExpenseType(trimmed),
      confidence: 0.7,
    });
  }

  return { categories, excluded };
}

/**
 * 必要書類の解析
 * 
 * required_documents テキストを分割し、必須/任意を判定する
 */
export function parseRequiredDocsFromText(text: string): {
  documents: ParsedDocument[];
} {
  if (!text || text.trim().length < 5) {
    return { documents: [] };
  }

  const fragments = splitText(text);
  const documents: ParsedDocument[] = [];

  for (const fragment of fragments) {
    const trimmed = fragment.trim();
    if (trimmed.length < 3) continue;

    const isRequired = REQUIRED_DOC_PATTERNS.test(trimmed) || !OPTIONAL_DOC_PATTERNS.test(trimmed);

    documents.push({
      text: trimmed,
      is_required: isRequired,
      doc_type: classifyDocType(trimmed),
      confidence: 0.7,
    });
  }

  return { documents };
}

// =====================================================
// ヘルパー関数
// =====================================================

/**
 * detail_json から複数キーでテキストを抽出・結合
 */
function extractTextField(detail: Record<string, any>, keys: string[]): string {
  const parts: string[] = [];
  
  for (const key of keys) {
    const value = detail[key];
    if (!value) continue;
    
    if (typeof value === 'string') {
      parts.push(value);
    } else if (Array.isArray(value)) {
      parts.push(value.filter(v => typeof v === 'string').join('\n'));
    }
  }
  
  return parts.join('\n').trim();
}

/**
 * テキストを意味のあるフラグメントに分割
 * 
 * 分割戦略:
 * 1. 番号付きリスト（①②③, 1.2.3.）で分割
 * 2. 改行で分割
 * 3. 句読点・区切り文字で分割
 * 4. 短いフラグメント（<5文字）は前のフラグメントに結合
 */
function splitText(text: string): string[] {
  // まず番号付きリストで分割を試行
  const numberedParts = text.split(NUMBERED_LIST).filter(p => p.trim().length > 0);
  if (numberedParts.length >= 2) {
    return mergeShortFragments(numberedParts);
  }
  
  // 改行で分割
  const lineParts = text.split(/\n+/).filter(p => p.trim().length > 0);
  if (lineParts.length >= 2) {
    return mergeShortFragments(lineParts);
  }
  
  // セパレータで分割
  const sepParts = text.split(TEXT_SEPARATORS).filter(p => p.trim().length > 0);
  if (sepParts.length >= 2) {
    return mergeShortFragments(sepParts);
  }
  
  // 分割できない場合は全体を1つのフラグメントとして返す
  return text.trim().length > 0 ? [text.trim()] : [];
}

/**
 * 短いフラグメント（<5文字）を前のフラグメントに結合
 */
function mergeShortFragments(fragments: string[], minLen = 5): string[] {
  const result: string[] = [];
  
  for (const frag of fragments) {
    const trimmed = frag.trim();
    if (!trimmed) continue;
    
    if (trimmed.length < minLen && result.length > 0) {
      result[result.length - 1] += '、' + trimmed;
    } else {
      result.push(trimmed);
    }
  }
  
  return result;
}

/**
 * 適格性ルールをカテゴリ分類
 */
function categorizeEligibility(text: string): {
  category: EligibilityCategory;
  auto_field?: string;
  confidence: number;
} {
  for (const { pattern, category, auto_field } of ELIGIBILITY_CATEGORY_PATTERNS) {
    if (pattern.test(text)) {
      return { category, auto_field, confidence: 0.8 };
    }
  }
  return { category: 'other', confidence: 0.5 };
}

/**
 * 経費タイプを分類
 */
function classifyExpenseType(text: string): string {
  if (/機械|設備|装置|工具/.test(text)) return 'equipment';
  if (/外注|委託|専門家/.test(text)) return 'outsourcing';
  if (/広告|販促|プロモーション/.test(text)) return 'advertising';
  if (/旅費|交通費|出張/.test(text)) return 'travel';
  if (/研修|人材|教育/.test(text)) return 'training';
  if (/クラウド|IT|ソフト|システム/.test(text)) return 'it';
  if (/原材料|材料費/.test(text)) return 'materials';
  if (/知的財産|特許|商標/.test(text)) return 'ip';
  if (/建物|内装|工事/.test(text)) return 'construction';
  return 'other';
}

/**
 * 書類タイプを分類
 */
function classifyDocType(text: string): string {
  if (/事業計画|計画書/.test(text)) return 'business_plan';
  if (/決算|財務|貸借|損益/.test(text)) return 'financial';
  if (/登記|履歴事項/.test(text)) return 'registration';
  if (/確定申告|納税/.test(text)) return 'tax';
  if (/見積|見積書/.test(text)) return 'estimate';
  if (/賃金台帳|給与/.test(text)) return 'payroll';
  if (/就業規則|雇用/.test(text)) return 'employment';
  if (/認定|証明/.test(text)) return 'certification';
  return 'other';
}

/**
 * 品質スコアの計算
 * 
 * 0-100:
 * - 各カテゴリに抽出結果があるか（各30点）
 * - 入力フィールドの数（10点）
 */
function computeQualityScore(
  rules: ParsedEligibilityRule[],
  expenses: ParsedExpenseCategory[],
  docs: ParsedDocument[],
  inputFields: string[],
): number {
  let score = 0;
  
  // 適格性ルール（0-30）
  score += Math.min(rules.length * 6, 30);
  
  // 経費カテゴリ（0-30）
  score += Math.min(expenses.length * 6, 30);
  
  // 書類（0-30）
  score += Math.min(docs.length * 6, 30);
  
  // 入力フィールド数（0-10）
  score += Math.min(inputFields.length * 3, 10);
  
  return Math.min(score, 100);
}

/**
 * 空の解析結果を返す
 */
function emptyResult(parseTimeMs: number, inputFieldsFound: string[]): DetailJsonParseResult {
  return {
    eligibility: { rules: [], raw_text: '' },
    expenses: { categories: [], excluded: [], raw_text: '' },
    documents: { documents: [], raw_text: '' },
    overall_quality_score: 0,
    meta: {
      method: 'regex',
      parse_time_ms: parseTimeMs,
      input_fields_found: inputFieldsFound,
    },
  };
}

/**
 * text-parser.ts
 * 
 * P0-1: detail_json のフラットテキストを構造化データに変換
 * 
 * Freeze v3.0/v3.1 準拠:
 * - ハイブリッドC方式: P0 は正規表現のみ（LLM は P1 で導入）
 * - detail_json の application_requirements, eligible_expenses, required_documents を解析
 * - 分割 → 分類 → 構造化のパイプライン
 * 
 * @module
 */

// =====================================================
// 型定義
// =====================================================

/** 申請要件のパース結果 */
export interface ParsedEligibilityRule {
  text: string;
  category: 'eligibility' | 'compliance' | 'exclusion' | 'size' | 'plan' | 'other';
  check_type: 'auto' | 'manual';
  /** auto の場合の判定フィールド（employee_count, capital, etc.） */
  auto_field?: string;
}

/** 経費カテゴリのパース結果 */
export interface ParsedExpenseCategory {
  text: string;
  category: 'equipment' | 'outsourcing' | 'labor' | 'travel' | 'material' | 'consulting' | 'other';
}

/** 必要書類のパース結果 */
export interface ParsedDocument {
  text: string;
  is_required: boolean;
  doc_type: 'financial' | 'plan' | 'certificate' | 'application' | 'other';
}

/** テキスト解析の全体結果 */
export interface DetailJsonParseResult {
  eligibility: {
    rules: ParsedEligibilityRule[];
    raw_text: string | null;
  };
  expenses: {
    categories: ParsedExpenseCategory[];
    excluded: string[];
    raw_text: string | null;
  };
  documents: {
    documents: ParsedDocument[];
    raw_text: string | null;
  };
  /** 解析品質スコア (0-100) */
  overall_quality_score: number;
  /** 解析メタ情報 */
  meta: {
    method: 'regex';
    parsed_at: string;
    fields_found: number;
    fields_total: number;
  };
}

// =====================================================
// メイン関数
// =====================================================

/**
 * detail_json を解析して構造化データを返す
 * 
 * @param detail - detail_json をパースした Record<string, any>
 * @returns DetailJsonParseResult
 */
export function parseDetailJson(detail: Record<string, any> | null): DetailJsonParseResult {
  if (!detail) {
    return emptyResult();
  }

  const eligibilityResult = parseEligibilityFromText(
    normalizeTextInput(detail.application_requirements)
  );
  
  const expensesResult = parseExpensesFromText(
    normalizeTextInput(detail.eligible_expenses)
  );
  
  const documentsResult = parseRequiredDocsFromText(
    normalizeTextInput(detail.required_documents)
  );

  // 品質スコア計算
  let fieldsFound = 0;
  const fieldsTotal = 3;
  if (eligibilityResult.rules.length > 0) fieldsFound++;
  if (expensesResult.categories.length > 0) fieldsFound++;
  if (documentsResult.documents.length > 0) fieldsFound++;

  const qualityScore = Math.round((fieldsFound / fieldsTotal) * 100);

  return {
    eligibility: eligibilityResult,
    expenses: expensesResult,
    documents: documentsResult,
    overall_quality_score: qualityScore,
    meta: {
      method: 'regex',
      parsed_at: new Date().toISOString(),
      fields_found: fieldsFound,
      fields_total: fieldsTotal,
    },
  };
}

// =====================================================
// 申請要件パーサ (P0-1a)
// =====================================================

/**
 * application_requirements テキストから申請要件を抽出
 * 
 * 分割戦略:
 * 1. 改行、句点、中黒、セミコロンで分割
 * 2. 5文字未満のフラグメントは前のフラグメントにマージ
 * 3. カテゴリキーワードで分類
 */
export function parseEligibilityFromText(text: string | null): {
  rules: ParsedEligibilityRule[];
  raw_text: string | null;
} {
  if (!text || text.trim().length < 5) {
    return { rules: [], raw_text: text || null };
  }

  const fragments = splitText(text);
  const rules: ParsedEligibilityRule[] = [];

  for (const frag of fragments) {
    const trimmed = frag.trim();
    if (trimmed.length < 5) continue; // 短すぎるフラグメントはスキップ

    const category = classifyEligibilityCategory(trimmed);
    const autoField = detectAutoField(trimmed);

    rules.push({
      text: trimmed,
      category,
      check_type: autoField ? 'auto' : 'manual',
      auto_field: autoField || undefined,
    });
  }

  return { rules, raw_text: text };
}

// =====================================================
// 対象経費パーサ (P0-1c)
// =====================================================

/**
 * eligible_expenses テキストから対象経費カテゴリを抽出
 */
export function parseExpensesFromText(text: string | null): {
  categories: ParsedExpenseCategory[];
  excluded: string[];
  raw_text: string | null;
} {
  if (!text || text.trim().length < 5) {
    return { categories: [], excluded: [], raw_text: text || null };
  }

  const fragments = splitText(text);
  const categories: ParsedExpenseCategory[] = [];
  const excluded: string[] = [];

  for (const frag of fragments) {
    const trimmed = frag.trim();
    if (trimmed.length < 3) continue;

    // 除外パターンの検出
    if (isExcludedExpense(trimmed)) {
      excluded.push(trimmed);
      continue;
    }

    const category = classifyExpenseCategory(trimmed);
    categories.push({ text: trimmed, category });
  }

  return { categories, excluded, raw_text: text };
}

// =====================================================
// 必要書類パーサ (P0-1b)
// =====================================================

/**
 * required_documents テキストから必要書類を抽出
 */
export function parseRequiredDocsFromText(text: string | null): {
  documents: ParsedDocument[];
  raw_text: string | null;
} {
  if (!text || text.trim().length < 5) {
    return { documents: [], raw_text: text || null };
  }

  const fragments = splitText(text);
  const documents: ParsedDocument[] = [];

  for (const frag of fragments) {
    const trimmed = frag.trim();
    if (trimmed.length < 3) continue;

    const docType = classifyDocType(trimmed);
    const isRequired = !isOptionalDoc(trimmed);

    documents.push({ text: trimmed, is_required: isRequired, doc_type: docType });
  }

  return { documents, raw_text: text };
}

// =====================================================
// テキスト分割ユーティリティ
// =====================================================

/**
 * テキストを分割する
 * 
 * 分割基準: 改行、句点(。)、中黒(・)、セミコロン(；;)、番号リスト
 * 短いフラグメント（5文字未満）は前のフラグメントにマージ
 */
function splitText(text: string): string[] {
  // まず改行で分割
  let fragments = text.split(/\r?\n/).filter(s => s.trim());

  // 改行分割で十分な粒度がなければ、追加セパレータで分割
  if (fragments.length <= 1 && text.length > 50) {
    // 番号リスト（①②③, (1)(2)(3), 1.2.3.）で分割
    fragments = text.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|(?=\([0-9]+\))|(?=(?:^|\s)[0-9]+[\.\)．）])/);
    
    if (fragments.length <= 1) {
      // 句点・中黒・セミコロンで分割
      fragments = text.split(/(?<=。)|(?<=；)|(?<=;)|(?<=\n)|・|●|■|▪|▸/);
    }
  }

  // 短いフラグメントをマージ
  const merged: string[] = [];
  for (const frag of fragments) {
    const trimmed = frag.trim();
    if (!trimmed) continue;

    if (trimmed.length < 5 && merged.length > 0) {
      merged[merged.length - 1] += trimmed;
    } else {
      merged.push(trimmed);
    }
  }

  return merged;
}

/**
 * 入力を正規化（string | string[] | undefined → string | null）
 */
function normalizeTextInput(input: any): string | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean).join('\n');
  }
  if (typeof input === 'string') {
    return input.trim() || null;
  }
  return null;
}

// =====================================================
// 分類ロジック
// =====================================================

/** 申請要件のカテゴリ分類 */
function classifyEligibilityCategory(text: string): ParsedEligibilityRule['category'] {
  const lower = text.toLowerCase();
  
  // 従業員数・資本金・売上等の数値条件 → size
  if (/従業員|常勤|資本金|出資|中小企業|小規模事業者|売上高|年商/.test(text)) {
    return 'size';
  }
  // 事業計画・付加価値・生産性 → plan
  if (/事業計画|計画書|付加価値|生産性|賃上げ|給与|最低賃金|経営革新/.test(text)) {
    return 'plan';
  }
  // コンプライアンス・法令 → compliance
  if (/法令|反社|暴力団|滞納|税金|不正|処分|破産|民事再生/.test(text)) {
    return 'compliance';
  }
  // 除外条件 → exclusion
  if (/対象外|除外|該当しない|受給できない|申請できない|不可/.test(text)) {
    return 'exclusion';
  }
  // 申請資格 → eligibility
  if (/申請|応募|対象|要件|資格|条件/.test(text)) {
    return 'eligibility';
  }
  
  return 'other';
}

/** 自動判定可能なフィールドを検出 */
function detectAutoField(text: string): string | null {
  if (/従業員.{0,10}(\d+).{0,5}(人|名)以[下上]/.test(text)) return 'employee_count';
  if (/資本金.{0,10}(\d+).{0,5}(万|億|円)以[下上]/.test(text)) return 'capital';
  if (/売上高|年商/.test(text) && /\d+/.test(text)) return 'annual_revenue';
  return null;
}

/** 経費カテゴリ分類 */
function classifyExpenseCategory(text: string): ParsedExpenseCategory['category'] {
  if (/機械|装置|設備|工具|器具|什器|システム|ソフトウェア|ハードウェア|サーバ/.test(text)) return 'equipment';
  if (/外注|委託|業務委託|製造委託|加工/.test(text)) return 'outsourcing';
  if (/人件費|労務|給与|賃金|手当|雇用/.test(text)) return 'labor';
  if (/旅費|交通費|出張|宿泊/.test(text)) return 'travel';
  if (/原材料|資材|副資材|部品|消耗品/.test(text)) return 'material';
  if (/専門家|コンサルタント|謝金|講師|研修|セミナー|広告|宣伝|販促|展示/.test(text)) return 'consulting';
  return 'other';
}

/** 除外経費の判定 */
function isExcludedExpense(text: string): boolean {
  return /対象外|補助対象外|認められない|含まない|除く|不可|汎用性|汎用的/.test(text);
}

/** 書類タイプの分類 */
function classifyDocType(text: string): ParsedDocument['doc_type'] {
  if (/決算|財務|貸借対照表|損益計算|確定申告|納税|税務/.test(text)) return 'financial';
  if (/事業計画|計画書|企画書|プロジェクト|ビジネスプラン/.test(text)) return 'plan';
  if (/証明|登記|謄本|定款|履歴事項|印鑑|認定|許可|免許/.test(text)) return 'certificate';
  if (/申請書|様式|フォーム|記入|提出/.test(text)) return 'application';
  return 'other';
}

/** 任意書類の判定 */
function isOptionalDoc(text: string): boolean {
  return /任意|できれば|あれば|可能であれば|推奨|参考/.test(text);
}

// =====================================================
// ユーティリティ
// =====================================================

function emptyResult(): DetailJsonParseResult {
  return {
    eligibility: { rules: [], raw_text: null },
    expenses: { categories: [], excluded: [], raw_text: null },
    documents: { documents: [], raw_text: null },
    overall_quality_score: 0,
    meta: {
      method: 'regex',
      parsed_at: new Date().toISOString(),
      fields_found: 0,
      fields_total: 3,
    },
  };
}

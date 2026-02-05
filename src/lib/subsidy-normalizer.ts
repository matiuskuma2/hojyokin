/**
 * 補助金データ正規化モジュール
 * 
 * 目的:
 * 1. detail_json の構造差を吸収
 * 2. API/フロント間の型整合性を保証
 * 3. canonical_id/cache_id の解決を共通化
 */

// ========== 型定義 ==========

export interface ResolvedSubsidyRef {
  canonical_id: string;
  cache_id: string;
  snapshot_id: string | null;
  source_type: 'jgrants' | 'manual';
}

export interface ApplicationType {
  name: string;
  min_amount: number | null;
  max_amount: number | null;
  subsidy_rate: string | null;
  process_requirement: string | null;
}

export interface EnterpriseDefinition {
  industry: string;
  capital: string | null;
  employees: string | null;
}

export interface EligibilityRule {
  id: string;
  category: string;
  rule_text: string;
  check_type: 'AUTO' | 'MANUAL';
  source_text: string | null;
}

export interface ExpenseCategory {
  name: string;
  description: string | null;
}

export interface EligibleExpenses {
  categories: ExpenseCategory[];
  notes: string[];
  not_eligible: string[];
}

export interface RequiredDocument {
  id: string;
  name: string;
  description: string | null;
  required_level: 'required' | 'conditional' | 'optional';
  phase: string;
  sort_order: number;
}

export interface BonusPoint {
  category: string;
  name: string;
  description: string | null;
  points: string | null;
  reference_url: string | null;
}

export interface WallChatQuestion {
  category: string;
  question: string;
  purpose: string | null;
  input_type: 'text' | 'number' | 'boolean' | 'select';
  options: string[] | null;
}

export interface ApplicationStep {
  step: number;
  title: string;
  description: string | null;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  file_type: string | null;
  file_size: number | null;
}

export interface ContactInfo {
  name: string | null;
  organization: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface NormalizedSubsidyDetail {
  // 識別子
  id: string;
  cache_id: string;
  snapshot_id: string | null;
  source_type: 'jgrants' | 'manual';
  
  // 基本情報
  title: string;
  overview: string;
  purpose: string | null;
  issuer: string | null;
  issuer_department: string | null;
  secretariat: string | null;
  
  // 金額・補助率
  max_amount: number | null;
  min_amount: number | null;
  subsidy_rate: string | null;
  application_types: ApplicationType[] | null;
  
  // 期間
  acceptance_start: string | null;
  acceptance_end: string | null;
  is_accepting: boolean;
  days_remaining: number | null;
  
  // 対象
  target_area: string;
  target_industry: string | null;
  enterprise_definitions: EnterpriseDefinition[] | null;
  
  // 要件（正規化済み）
  eligibility_rules: EligibilityRule[];
  
  // 経費（正規化済み）
  eligible_expenses: EligibleExpenses;
  
  // 書類（正規化済み）
  required_documents: RequiredDocument[];
  
  // 加点要素
  bonus_points: BonusPoint[];
  
  // 壁打ち用
  wall_chat_questions: WallChatQuestion[];
  wall_chat_ready: boolean;
  wall_chat_missing: string[];
  
  // 申請情報
  is_electronic_application: boolean;
  application_method: string | null;
  application_flow: ApplicationStep[] | null;
  
  // URL・添付
  official_url: string | null;
  attachments: Attachment[];
  
  // 連絡先
  contact: ContactInfo | null;
  
  // メタ情報
  last_updated: string | null;
  koubo_source: string | null;
  data_version: string | null;
}

// ========== 共通関数 ==========

/**
 * 補助金参照を解決
 * canonical_id でも cache_id でも渡せる
 */
export async function resolveSubsidyRef(
  db: D1Database,
  inputId: string
): Promise<ResolvedSubsidyRef | null> {
  try {
    // Step 1: canonical として検索
    const canonical = await db
      .prepare(`
        SELECT 
          c.id as canonical_id,
          c.latest_cache_id as cache_id,
          c.latest_snapshot_id as snapshot_id,
          l.source_type
        FROM subsidy_canonical c
        LEFT JOIN subsidy_source_link l ON l.canonical_id = c.id
        WHERE c.id = ?
      `)
      .bind(inputId)
      .first<{
        canonical_id: string;
        cache_id: string;
        snapshot_id: string | null;
        source_type: string | null;
      }>();
    
    if (canonical) {
      return {
        canonical_id: canonical.canonical_id,
        cache_id: canonical.cache_id,
        snapshot_id: canonical.snapshot_id,
        source_type: (canonical.source_type as 'jgrants' | 'manual') || 'manual',
      };
    }
    
    // Step 2: cache_id として検索（逆引き）
    const fromCache = await db
      .prepare(`
        SELECT 
          c.id as canonical_id,
          c.latest_cache_id as cache_id,
          c.latest_snapshot_id as snapshot_id,
          l.source_type
        FROM subsidy_canonical c
        LEFT JOIN subsidy_source_link l ON l.canonical_id = c.id
        WHERE c.latest_cache_id = ?
      `)
      .bind(inputId)
      .first<{
        canonical_id: string;
        cache_id: string;
        snapshot_id: string | null;
        source_type: string | null;
      }>();
    
    if (fromCache) {
      return {
        canonical_id: fromCache.canonical_id,
        cache_id: fromCache.cache_id,
        snapshot_id: fromCache.snapshot_id,
        source_type: (fromCache.source_type as 'jgrants' | 'manual') || 'manual',
      };
    }
    
    // Step 3: 直接 subsidy_cache を検索（レガシー互換）
    const cacheOnly = await db
      .prepare(`SELECT id, title FROM subsidy_cache WHERE id = ?`)
      .bind(inputId)
      .first<{ id: string; title: string }>();
    
    if (cacheOnly) {
      return {
        canonical_id: inputId, // 仮のcanonical_id
        cache_id: inputId,
        snapshot_id: null,
        source_type: 'manual',
      };
    }
    
    return null;
  } catch (error) {
    console.error('[resolveSubsidyRef] Error:', error);
    return null;
  }
}

/**
 * 質問の入力タイプを推測
 */
function inferInputType(question: string): 'text' | 'number' | 'boolean' | 'select' {
  const q = question.toLowerCase();
  
  // 疑問詞チェック（自由回答）
  const questionWords = ['何', '誰', 'どこ', 'いつ', 'どのよう', 'どんな', 'なぜ', 'どれ'];
  if (questionWords.some(w => q.includes(w)) && !q.includes('ありますか') && !q.includes('いますか')) {
    return 'text';
  }
  
  // 数値チェック
  if (q.includes('何名') || q.includes('何人') || q.includes('いくら') || 
      q.includes('何円') || q.includes('何時間') || q.includes('何歳') ||
      q.includes('何%') || q.includes('何年')) {
    return 'number';
  }
  
  // boolean チェック
  if (q.endsWith('ますか？') || q.endsWith('ですか？') || 
      q.endsWith('いますか？') || q.endsWith('ありますか？') ||
      q.endsWith('ましたか？') || q.endsWith('でしたか？')) {
    // ただし疑問詞が含まれている場合は text
    if (!questionWords.some(w => q.includes(w))) {
      return 'boolean';
    }
  }
  
  return 'text';
}

/**
 * eligibility_requirements を正規化
 */
export function normalizeEligibilityRules(
  subsidyId: string,
  eligibility: any
): EligibilityRule[] {
  if (!eligibility) return [];
  
  const rules: EligibilityRule[] = [];
  
  // === 新構造（IT導入補助金2026等）===
  
  // basic_requirements
  if (eligibility.basic_requirements && Array.isArray(eligibility.basic_requirements)) {
    eligibility.basic_requirements.forEach((req: string, idx: number) => {
      rules.push({
        id: `${subsidyId}-basic-${idx}`,
        category: '基本要件',
        rule_text: req,
        check_type: 'MANUAL',
        source_text: '公募要領より',
      });
    });
  }
  
  // productivity_requirements
  if (eligibility.productivity_requirements && Array.isArray(eligibility.productivity_requirements)) {
    eligibility.productivity_requirements.forEach((req: string, idx: number) => {
      rules.push({
        id: `${subsidyId}-productivity-${idx}`,
        category: '生産性向上要件',
        rule_text: req,
        check_type: 'AUTO',
        source_text: '公募要領より',
      });
    });
  }
  
  // wage_requirements_150over
  if (eligibility.wage_requirements_150over && Array.isArray(eligibility.wage_requirements_150over)) {
    eligibility.wage_requirements_150over.forEach((req: string, idx: number) => {
      rules.push({
        id: `${subsidyId}-wage150-${idx}`,
        category: '賃金引上げ要件（150万円以上）',
        rule_text: req,
        check_type: 'AUTO',
        source_text: '公募要領より',
      });
    });
  }
  
  // wage_requirements_past_recipients
  if (eligibility.wage_requirements_past_recipients && Array.isArray(eligibility.wage_requirements_past_recipients)) {
    eligibility.wage_requirements_past_recipients.forEach((req: string, idx: number) => {
      rules.push({
        id: `${subsidyId}-wagepast-${idx}`,
        category: '賃金引上げ要件（過去交付決定者）',
        rule_text: req,
        check_type: 'AUTO',
        source_text: '公募要領より',
      });
    });
  }
  
  // === 旧構造（ものづくり補助金等）===
  
  // basic
  if (eligibility.basic && Array.isArray(eligibility.basic)) {
    eligibility.basic.forEach((req: string, idx: number) => {
      rules.push({
        id: `${subsidyId}-basic-${idx}`,
        category: '基本要件',
        rule_text: req,
        check_type: 'MANUAL',
        source_text: '公募要領より',
      });
    });
  }
  
  // mandatory_commitments
  if (eligibility.mandatory_commitments && Array.isArray(eligibility.mandatory_commitments)) {
    eligibility.mandatory_commitments.forEach((commit: any, idx: number) => {
      rules.push({
        id: `${subsidyId}-mandatory-${idx}`,
        category: '必須要件',
        rule_text: `${commit.item}: ${commit.requirement}${commit.verification ? ` (確認方法: ${commit.verification})` : ''}`,
        check_type: 'AUTO',
        source_text: '公募要領より',
      });
    });
  }
  
  // creation_requirements
  if (eligibility.creation_requirements && Array.isArray(eligibility.creation_requirements)) {
    eligibility.creation_requirements.forEach((req: any, idx: number) => {
      rules.push({
        id: `${subsidyId}-creation-${idx}`,
        category: '創業要件',
        rule_text: `${req.item}: ${req.requirement}${req.note ? ` (${req.note})` : ''}`,
        check_type: 'MANUAL',
        source_text: '公募要領より',
      });
    });
  }
  
  // exclusions
  if (eligibility.exclusions && Array.isArray(eligibility.exclusions)) {
    eligibility.exclusions.forEach((excl: string, idx: number) => {
      rules.push({
        id: `${subsidyId}-excl-${idx}`,
        category: '対象外',
        rule_text: excl,
        check_type: 'MANUAL',
        source_text: '公募要領より',
      });
    });
  }
  
  return rules;
}

/**
 * enterprise_definitions を正規化
 */
export function normalizeEnterpriseDefinitions(
  eligibility: any
): EnterpriseDefinition[] | null {
  // 新構造
  if (eligibility?.enterprise_definitions && Array.isArray(eligibility.enterprise_definitions)) {
    return eligibility.enterprise_definitions.map((def: any) => ({
      industry: def.industry || '全業種',
      capital: def.capital || null,
      employees: def.employees || null,
    }));
  }
  
  // 旧構造
  if (eligibility?.scale_requirements && Array.isArray(eligibility.scale_requirements)) {
    return eligibility.scale_requirements.map((scale: any) => ({
      industry: scale.industry || '全業種',
      capital: null,
      employees: scale.max_employees ? `${scale.max_employees}人以下` : null,
    }));
  }
  
  return null;
}

/**
 * eligible_expenses を正規化
 */
export function normalizeEligibleExpenses(expenses: any): EligibleExpenses {
  if (!expenses) {
    return { categories: [], notes: [], not_eligible: [] };
  }
  
  return {
    categories: (expenses.categories || expenses.optional || []).map((cat: any) => ({
      name: typeof cat === 'string' ? cat : cat.name || '',
      description: typeof cat === 'object' ? cat.description || null : null,
    })),
    notes: expenses.notes || [],
    not_eligible: expenses.not_eligible || [],
  };
}

/**
 * required_documents を正規化
 */
export function normalizeRequiredDocuments(
  subsidyId: string,
  reqDocs: any
): RequiredDocument[] {
  if (!reqDocs) return [];
  
  const docs: RequiredDocument[] = [];
  let sortOrder = 0;
  
  // common
  if (reqDocs.common && Array.isArray(reqDocs.common)) {
    reqDocs.common.forEach((doc: any, idx: number) => {
      docs.push({
        id: `${subsidyId}-common-${idx}`,
        name: doc.name || '',
        description: doc.description || null,
        required_level: 'required',
        phase: '共通',
        sort_order: sortOrder++,
      });
    });
  }
  
  // corporation
  if (reqDocs.corporation && Array.isArray(reqDocs.corporation)) {
    reqDocs.corporation.forEach((doc: any, idx: number) => {
      docs.push({
        id: `${subsidyId}-corp-${idx}`,
        name: doc.name || '',
        description: doc.description || null,
        required_level: 'conditional',
        phase: '法人向け',
        sort_order: sortOrder++,
      });
    });
  }
  
  // individual
  if (reqDocs.individual && Array.isArray(reqDocs.individual)) {
    reqDocs.individual.forEach((doc: any, idx: number) => {
      docs.push({
        id: `${subsidyId}-ind-${idx}`,
        name: doc.name || '',
        description: doc.description || null,
        required_level: 'conditional',
        phase: '個人向け',
        sort_order: sortOrder++,
      });
    });
  }
  
  // optional
  if (reqDocs.optional && Array.isArray(reqDocs.optional)) {
    reqDocs.optional.forEach((doc: any, idx: number) => {
      docs.push({
        id: `${subsidyId}-opt-${idx}`,
        name: doc.name || '',
        description: doc.description || null,
        required_level: 'optional',
        phase: '任意',
        sort_order: sortOrder++,
      });
    });
  }
  
  // main_forms
  if (reqDocs.main_forms && Array.isArray(reqDocs.main_forms)) {
    reqDocs.main_forms.forEach((doc: any, idx: number) => {
      docs.push({
        id: `${subsidyId}-form-${idx}`,
        name: doc.name || '',
        description: doc.description || null,
        required_level: 'required',
        phase: '申請様式',
        sort_order: sortOrder++,
      });
    });
  }
  
  return docs;
}

/**
 * bonus_points を正規化
 */
export function normalizeBonusPoints(
  subsidyId: string,
  bonusPoints: any,
  evaluationCriteria: any
): BonusPoint[] {
  const points: BonusPoint[] = [];
  
  // 直接 bonus_points がある場合
  if (bonusPoints && Array.isArray(bonusPoints)) {
    bonusPoints.forEach((bp: any, idx: number) => {
      points.push({
        category: bp.category || '加点項目',
        name: bp.name || '',
        description: bp.description || null,
        points: bp.points || null,
        reference_url: bp.reference_url || null,
      });
    });
  }
  
  // evaluation_criteria.bonus_review から生成
  if (evaluationCriteria?.bonus_review) {
    const br = evaluationCriteria.bonus_review;
    
    // 重点政策加点
    if (br['重点政策加点']?.options) {
      br['重点政策加点'].options.forEach((opt: any, idx: number) => {
        const name = typeof opt === 'string' ? opt : opt.name || '';
        const desc = typeof opt === 'object' ? opt.description || null : null;
        points.push({
          category: '重点政策加点',
          name,
          description: desc,
          points: null,
          reference_url: null,
        });
      });
    }
    
    // 政策加点
    if (br['政策加点']?.options) {
      br['政策加点'].options.forEach((opt: any, idx: number) => {
        const name = typeof opt === 'string' ? opt : opt.name || '';
        const desc = typeof opt === 'object' ? opt.description || null : null;
        points.push({
          category: '政策加点',
          name,
          description: desc,
          points: null,
          reference_url: null,
        });
      });
    }
  }
  
  return points;
}

/**
 * wall_chat_questions を正規化
 */
export function normalizeWallChatQuestions(questions: any): WallChatQuestion[] {
  if (!questions || !Array.isArray(questions)) return [];
  
  return questions.map((q: any) => ({
    category: q.category || '一般',
    question: q.question || '',
    purpose: q.purpose || null,
    input_type: inferInputType(q.question || ''),
    options: q.options || null,
  }));
}

/**
 * 補助金詳細を正規化
 */
export function normalizeSubsidyDetail(
  row: any,
  detailJson: any,
  ref: ResolvedSubsidyRef
): NormalizedSubsidyDetail {
  // 申請終了日からの計算
  const acceptanceEnd = detailJson?.acceptance_end_datetime || row?.acceptance_end_datetime || null;
  let daysRemaining: number | null = null;
  let isAccepting = false;
  
  if (acceptanceEnd) {
    const endDate = new Date(acceptanceEnd);
    const now = new Date();
    daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    isAccepting = daysRemaining > 0;
  }
  
  // 壁打ち可能判定
  const wallChatQuestions = normalizeWallChatQuestions(detailJson?.wall_chat_questions);
  const eligibilityRules = normalizeEligibilityRules(ref.cache_id, detailJson?.eligibility_requirements);
  const wallChatMissing: string[] = [];
  
  if (!detailJson?.subsidy_overview && !row?.description) wallChatMissing.push('概要');
  if (eligibilityRules.length === 0) wallChatMissing.push('申請要件');
  if (wallChatQuestions.length === 0) wallChatMissing.push('壁打ち質問');
  
  const wallChatReady = wallChatMissing.length === 0;
  
  return {
    // 識別子
    id: ref.canonical_id,
    cache_id: ref.cache_id,
    snapshot_id: ref.snapshot_id,
    source_type: ref.source_type,
    
    // 基本情報
    title: row?.title || detailJson?.title || '補助金名未設定',
    overview: detailJson?.subsidy_overview || detailJson?.overview || row?.description || '',
    purpose: detailJson?.subsidy_purpose || detailJson?.description || null,
    issuer: detailJson?.issuer || null,
    issuer_department: detailJson?.issuer_department || null,
    secretariat: detailJson?.secretariat || 
      (detailJson?.issuer ? `${detailJson.issuer}${detailJson.issuer_department ? ` ${detailJson.issuer_department}` : ''}` : null),
    
    // 金額・補助率
    max_amount: row?.subsidy_max_limit || null,
    min_amount: detailJson?.application_types?.[0]?.min_amount || null,
    subsidy_rate: row?.subsidy_rate || detailJson?.subsidy_rates?.[0]?.rate || null,
    application_types: detailJson?.application_types || null,
    
    // 期間
    acceptance_start: row?.acceptance_start_datetime || null,
    acceptance_end: acceptanceEnd,
    is_accepting: isAccepting,
    days_remaining: daysRemaining,
    
    // 対象
    target_area: row?.target_area_search || detailJson?.target_area || '全国',
    target_industry: row?.target_industry || null,
    enterprise_definitions: normalizeEnterpriseDefinitions(detailJson?.eligibility_requirements),
    
    // 要件
    eligibility_rules: eligibilityRules,
    
    // 経費
    eligible_expenses: normalizeEligibleExpenses(detailJson?.eligible_expenses),
    
    // 書類
    required_documents: normalizeRequiredDocuments(ref.cache_id, detailJson?.required_documents),
    
    // 加点要素
    bonus_points: normalizeBonusPoints(
      ref.cache_id,
      detailJson?.bonus_points,
      detailJson?.evaluation_criteria
    ),
    
    // 壁打ち用
    wall_chat_questions: wallChatQuestions,
    wall_chat_ready: wallChatReady,
    wall_chat_missing: wallChatMissing,
    
    // 申請情報
    is_electronic_application: detailJson?.is_electronic_application || false,
    application_method: detailJson?.application_method || null,
    application_flow: detailJson?.application_flow || null,
    
    // URL・添付
    official_url: detailJson?.official_urls?.main || detailJson?.official_url || null,
    attachments: (detailJson?.pdf_attachments || detailJson?.attachments || []).map((a: any, idx: number) => ({
      id: a.id || `attachment-${idx}`,
      name: a.name || '添付ファイル',
      url: a.url || '',
      file_type: a.file_type || null,
      file_size: a.file_size || null,
    })),
    
    // 連絡先
    contact: detailJson?.contact_info ? {
      name: detailJson.contact_info.name || null,
      organization: detailJson.contact_info.organization || null,
      department: detailJson.contact_info.department || null,
      phone: detailJson.contact_info.phone || null,
      email: detailJson.contact_info.email || null,
      address: detailJson.contact_info.address || null,
    } : null,
    
    // メタ情報
    last_updated: detailJson?.last_updated || null,
    koubo_source: detailJson?.koubo_source || null,
    data_version: detailJson?.enriched_version || null,
  };
}

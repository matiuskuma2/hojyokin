/**
 * normalizeSubsidyDetail.ts
 * 
 * detail_json の構造差を吸収し、NormalizedSubsidyDetail v1.0 を生成（Freeze-NORM-0）
 * 
 * 目的:
 * - DB detail_json（生） / API型 / フロント参照名 のズレを根絶
 * - 5制度のマッピングを一元化
 * - 推測禁止: wall_chat.questions の input_type 推測は禁止（未定義は text 固定）
 */

import type { ResolveSubsidyRefResult, SourceLink, SourceType } from './resolveSubsidyRef';

// ========================================
// 型定義（NormalizedSubsidyDetail v1.0）
// ========================================

export interface NormalizedIds {
  input_id: string;
  canonical_id: string;
  cache_id: string | null;
  snapshot_id: string | null;
}

export interface NormalizedSource {
  primary_source_type: SourceType;
  primary_source_id: string | null;
  links: SourceLink[];
}

export interface NormalizedAcceptance {
  is_accepting: boolean;
  acceptance_start: string | null;
  acceptance_end: string | null;
  acceptance_end_reason: string | null;
}

export interface NormalizedDisplay {
  title: string;
  issuer_name: string | null;
  target_area_text: string | null;
  subsidy_max_limit: number | null;
  subsidy_rate_text: string | null;
}

export interface NormalizedOverview {
  summary: string | null;
  purpose: string | null;
  target_business: string | null;
}

export interface NormalizedElectronicApplication {
  is_electronic_application: boolean | null;
  portal_name: string | null;
  portal_url: string | null;
  notes: string | null;
}

export interface WallChatQuestion {
  key: string;
  category: string;
  question: string;
  input_type: 'boolean' | 'number' | 'text' | 'select';
  options?: string[];
  priority: number;
}

export interface NormalizedWallChat {
  mode: 'enabled' | 'disabled' | 'electronic_only' | 'unknown';
  ready: boolean;
  missing: string[];
  questions: WallChatQuestion[];
}

export interface EligibilityRule {
  category: string;
  rule_text: string;
  check_type: 'AUTO' | 'MANUAL';
  source: string | null;
}

export interface ExpenseRequired {
  name: string;
  description: string | null;
  min_amount: number | null;
}

export interface ExpenseCategory {
  name: string;
  description: string | null;
  items: string[];
  rate_text: string | null;
  max_amount: number | null;
}

export interface EligibleExpenses {
  required: ExpenseRequired[];
  categories: ExpenseCategory[];
  excluded: string[];
  notes: string | null;
}

export interface RequiredDocument {
  name: string;
  required_level: 'required' | 'conditional' | 'optional';
  phase: string | null;
  description: string | null;
  notes: string | null;
  sort_order: number;
}

export interface BonusPoint {
  category: string | null;
  name: string;
  description: string | null;
  requirements: string | null;
  points: number | null;
  max_points: number | null;
}

export interface RequiredForm {
  name: string;
  fields: string[];
  notes: string | null;
}

export interface Attachment {
  name: string;
  url: string;
  file_type: string | null;
  file_size: number | null;
}

export interface NormalizedContent {
  eligibility_rules: EligibilityRule[];
  eligible_expenses: EligibleExpenses;
  required_documents: RequiredDocument[];
  bonus_points: BonusPoint[];
  required_forms: RequiredForm[];
  attachments: Attachment[];
}

export interface PdfHash {
  url: string;
  sha256_16: string;
  last_seen_at: string;
}

export interface NormalizedProvenance {
  koubo_source_urls: string[];
  pdf_urls: string[];
  pdf_hashes: PdfHash[];
  last_normalized_at: string;
}

export interface NormalizedSubsidyDetail {
  schema_version: '1.0';
  ids: NormalizedIds;
  source: NormalizedSource;
  acceptance: NormalizedAcceptance;
  display: NormalizedDisplay;
  overview: NormalizedOverview;
  electronic_application: NormalizedElectronicApplication;
  wall_chat: NormalizedWallChat;
  content: NormalizedContent;
  provenance: NormalizedProvenance;
}

// ========================================
// 入力型
// ========================================

export interface NormalizeInput {
  ref: ResolveSubsidyRefResult;
  canonicalRow: any | null;
  snapshotRow: any | null;
  cacheRow: any | null;
  detailJson: any;
}

// ========================================
// メイン関数
// ========================================

/**
 * detail_json を NormalizedSubsidyDetail v1.0 に変換
 */
export function normalizeSubsidyDetail(input: NormalizeInput): NormalizedSubsidyDetail {
  const { ref, canonicalRow, snapshotRow, cacheRow, detailJson } = input;
  const dj = detailJson || {};

  // IDs
  const ids: NormalizedIds = {
    input_id: ref.input_id,
    canonical_id: ref.canonical_id,
    cache_id: ref.cache_id,
    snapshot_id: ref.snapshot_id,
  };

  // Source
  const source: NormalizedSource = {
    primary_source_type: ref.primary_source_type,
    primary_source_id: ref.primary_source_id,
    links: ref.links,
  };

  // Acceptance（snapshot優先）
  const acceptance = normalizeAcceptance(snapshotRow, cacheRow);

  // Display
  const display = normalizeDisplay(snapshotRow, cacheRow, dj);

  // Overview
  const overview = normalizeOverview(dj);

  // Electronic Application
  const electronicApplication = normalizeElectronicApplication(dj);

  // Wall Chat
  const wallChat = normalizeWallChat(dj, overview);

  // Content（制度別マッピング）
  const content = normalizeContent(ref.canonical_id, dj);

  // Provenance
  const provenance = normalizeProvenance(dj);

  return {
    schema_version: '1.0',
    ids,
    source,
    acceptance,
    display,
    overview,
    electronic_application: electronicApplication,
    wall_chat: wallChat,
    content,
    provenance,
  };
}

// ========================================
// 個別正規化関数
// ========================================

function normalizeAcceptance(snapshotRow: any, cacheRow: any): NormalizedAcceptance {
  const snapshot = snapshotRow || {};
  const cache = cacheRow || {};

  // is_accepting: snapshot優先、無ければ締切日から計算
  let isAccepting = false;
  const acceptanceEnd = snapshot.acceptance_end || cache.acceptance_end_datetime || null;
  
  if (snapshot.is_accepting !== undefined && snapshot.is_accepting !== null) {
    isAccepting = snapshot.is_accepting === 1 || snapshot.is_accepting === true;
  } else if (acceptanceEnd) {
    const endDate = new Date(acceptanceEnd);
    isAccepting = endDate > new Date();
  }

  return {
    is_accepting: isAccepting,
    acceptance_start: snapshot.acceptance_start || cache.acceptance_start_datetime || null,
    acceptance_end: acceptanceEnd,
    acceptance_end_reason: snapshot.acceptance_end_reason || null,
  };
}

function normalizeDisplay(snapshotRow: any, cacheRow: any, dj: any): NormalizedDisplay {
  const snapshot = snapshotRow || {};
  const cache = cacheRow || {};

  return {
    title: cache.title || dj.title || '補助金名未設定',
    issuer_name: dj.issuer || dj.issuer_department || dj.secretariat || snapshot.issuer_name || null,
    target_area_text: snapshot.target_area_text || dj.target_area_display || dj.target_area || cache.target_area_search || '全国',
    subsidy_max_limit: snapshot.subsidy_max_limit ?? cache.subsidy_max_limit ?? null,
    subsidy_rate_text: snapshot.subsidy_rate || dj.subsidy_rate_text || dj.subsidy_rate || cache.subsidy_rate || null,
  };
}

function normalizeOverview(dj: any): NormalizedOverview {
  return {
    summary: dj.subsidy_overview || dj.overview || null,
    purpose: dj.subsidy_purpose || dj.purpose || null,
    target_business: dj.target_businesses || dj.target_business || dj.eligible_businesses || null,
  };
}

function normalizeElectronicApplication(dj: any): NormalizedElectronicApplication {
  const ea = dj.electronic_application || {};
  return {
    is_electronic_application: dj.is_electronic_application ?? ea.is_electronic ?? null,
    portal_name: ea.portal_name || dj.application_portal || null,
    portal_url: ea.portal_url || dj.application_url || null,
    notes: ea.notes || null,
  };
}

function normalizeWallChat(dj: any, overview: NormalizedOverview): NormalizedWallChat {
  const questions = normalizeWallChatQuestions(dj.wall_chat_questions);
  
  // missing 判定
  const missing: string[] = [];
  if (!overview.summary) missing.push('概要');
  if (questions.length === 0) missing.push('壁打ち質問');
  
  // ready 判定
  const ready = missing.length === 0;
  
  // mode 判定
  let mode: 'enabled' | 'disabled' | 'electronic_only' | 'unknown' = 'unknown';
  if (dj.wall_chat_mode) {
    mode = dj.wall_chat_mode;
  } else if (ready) {
    mode = 'enabled';
  }

  return {
    mode,
    ready,
    missing,
    questions,
  };
}

/**
 * 壁打ち質問の正規化
 * ⚠️ 推測禁止: input_type が定義に無ければ text 固定
 */
function normalizeWallChatQuestions(questions: any): WallChatQuestion[] {
  if (!questions || !Array.isArray(questions)) return [];

  return questions.map((q: any, idx: number) => ({
    key: q.key || `q_${idx}`,
    category: q.category || '一般',
    question: q.question || '',
    // ⚠️ Freeze: 推測禁止。定義に無ければ text 固定
    input_type: validateInputType(q.input_type) ? q.input_type : 'text',
    options: Array.isArray(q.options) ? q.options : undefined,
    priority: typeof q.priority === 'number' ? q.priority : 5,
  }));
}

function validateInputType(type: any): type is 'boolean' | 'number' | 'text' | 'select' {
  return ['boolean', 'number', 'text', 'select'].includes(type);
}

function normalizeContent(canonicalId: string, dj: any): NormalizedContent {
  // 制度判定
  const subsidyType = detectSubsidyType(canonicalId);

  return {
    eligibility_rules: normalizeEligibilityRules(canonicalId, dj, subsidyType),
    eligible_expenses: normalizeEligibleExpenses(dj, subsidyType),
    required_documents: normalizeRequiredDocuments(canonicalId, dj, subsidyType),
    bonus_points: normalizeBonusPoints(dj, subsidyType),
    required_forms: normalizeRequiredForms(dj),
    attachments: normalizeAttachments(dj),
  };
}

// ========================================
// 制度判定
// ========================================

type SubsidyType = 'it_subsidy' | 'shoryokuka' | 'jizokuka' | 'gyomu_kaizen' | 'monodukuri' | 'other';

function detectSubsidyType(canonicalId: string): SubsidyType {
  const id = canonicalId.toUpperCase();
  
  if (id.includes('IT-SUBSIDY') || id.includes('IT導入')) return 'it_subsidy';
  if (id.includes('SHORYOKUKA') || id.includes('省力化')) return 'shoryokuka';
  if (id.includes('JIZOKUKA') || id.includes('持続化')) return 'jizokuka';
  if (id.includes('GYOMU-KAIZEN') || id.includes('業務改善')) return 'gyomu_kaizen';
  if (id.includes('MONODUKURI') || id.includes('ものづくり')) return 'monodukuri';
  
  return 'other';
}

// ========================================
// eligibility_rules 正規化（5制度対応）
// ========================================

function normalizeEligibilityRules(canonicalId: string, dj: any, type: SubsidyType): EligibilityRule[] {
  const rules: EligibilityRule[] = [];
  const elig = dj.eligibility_requirements || {};

  switch (type) {
    case 'it_subsidy':
      // IT導入補助金
      addArrayRules(rules, elig.basic_requirements, '基本要件', 'MANUAL');
      addArrayRules(rules, elig.productivity_requirements, '生産性要件', 'AUTO');
      addArrayRules(rules, elig.wage_requirements_150over, '賃上げ要件(150万円以上)', 'AUTO');
      addArrayRules(rules, elig.wage_requirements_past_recipients, '賃上げ要件(過去採択者)', 'AUTO');
      addEnterpriseDefinitions(rules, elig.enterprise_definitions);
      break;

    case 'shoryokuka':
      // 省力化投資補助金
      addArrayRules(rules, elig.basic, '基本要件', 'MANUAL');
      addMandatoryCommitments(rules, elig.mandatory_commitments);
      break;

    case 'jizokuka':
      // 持続化補助金
      addArrayRules(rules, elig.basic, '基本要件', 'MANUAL');
      addCreationRequirements(rules, elig.creation_requirements);
      break;

    case 'gyomu_kaizen':
      // 業務改善助成金
      addArrayRules(rules, elig.basic_requirements, '基本要件', 'MANUAL');
      addArrayRules(rules, elig.wage_rules, '賃金要件', 'AUTO');
      addArrayRules(rules, elig.exclusions, '対象外', 'MANUAL');
      break;

    case 'monodukuri':
      // ものづくり補助金
      addArrayRules(rules, elig.basic, '基本要件', 'MANUAL');
      addScaleRequirements(rules, elig.scale_requirements);
      break;

    default:
      // その他（汎用）
      addArrayRules(rules, elig.basic, '基本要件', 'MANUAL');
      addArrayRules(rules, elig.basic_requirements, '基本要件', 'MANUAL');
      addMandatoryCommitments(rules, elig.mandatory_commitments);
      addScaleRequirements(rules, elig.scale_requirements);
      addEnterpriseDefinitions(rules, elig.enterprise_definitions);
      addArrayRules(rules, elig.exclusions, '対象外', 'MANUAL');
  }

  return rules;
}

function addArrayRules(rules: EligibilityRule[], arr: any, category: string, checkType: 'AUTO' | 'MANUAL') {
  if (!Array.isArray(arr)) return;
  arr.forEach((item: any) => {
    const text = typeof item === 'string' ? item : item.text || item.rule || item.requirement || '';
    if (text) {
      rules.push({ category, rule_text: text, check_type: checkType, source: '公募要領より' });
    }
  });
}

function addMandatoryCommitments(rules: EligibilityRule[], commits: any) {
  if (!Array.isArray(commits)) return;
  commits.forEach((c: any) => {
    const text = `${c.item || ''}: ${c.requirement || ''}${c.verification ? ` (確認方法: ${c.verification})` : ''}`.trim();
    if (text && text !== ':') {
      rules.push({ category: '必須要件', rule_text: text, check_type: 'AUTO', source: '公募要領より' });
    }
  });
}

function addCreationRequirements(rules: EligibilityRule[], reqs: any) {
  if (!Array.isArray(reqs)) return;
  reqs.forEach((r: any) => {
    const text = `${r.item || ''}: ${r.requirement || ''}${r.note ? ` (${r.note})` : ''}`.trim();
    if (text && text !== ':') {
      rules.push({ category: '創業要件', rule_text: text, check_type: 'MANUAL', source: '公募要領より' });
    }
  });
}

function addScaleRequirements(rules: EligibilityRule[], scales: any) {
  if (!Array.isArray(scales)) return;
  scales.forEach((s: any) => {
    const text = `${s.industry || '全業種'}: 従業員${s.max_employees || '?'}人以下`;
    rules.push({ category: '規模要件', rule_text: text, check_type: 'AUTO', source: '公募要領より' });
  });
}

function addEnterpriseDefinitions(rules: EligibilityRule[], defs: any) {
  if (!Array.isArray(defs)) return;
  defs.forEach((d: any) => {
    const parts: string[] = [];
    if (d.industry) parts.push(d.industry);
    if (d.capital) parts.push(`資本金${d.capital}`);
    if (d.employees) parts.push(`従業員${d.employees}`);
    const text = parts.join(' / ');
    if (text) {
      rules.push({ category: '対象事業者', rule_text: text, check_type: 'AUTO', source: '公募要領より' });
    }
  });
}

// ========================================
// eligible_expenses 正規化
// ========================================

function normalizeEligibleExpenses(dj: any, type: SubsidyType): EligibleExpenses {
  const exp = dj.eligible_expenses || {};

  const required: ExpenseRequired[] = [];
  if (Array.isArray(exp.required)) {
    exp.required.forEach((r: any) => {
      required.push({
        name: r.name || '',
        description: r.description || null,
        min_amount: r.min_amount ?? null,
      });
    });
  }

  const categories: ExpenseCategory[] = [];
  const catSource = exp.categories || exp.optional || [];
  if (Array.isArray(catSource)) {
    catSource.forEach((c: any) => {
      if (typeof c === 'string') {
        categories.push({ name: c, description: null, items: [], rate_text: null, max_amount: null });
      } else {
        categories.push({
          name: c.name || '',
          description: c.description || null,
          items: Array.isArray(c.items) ? c.items : [],
          rate_text: c.rate_text || c.rate || null,
          max_amount: c.max_amount ?? null,
        });
      }
    });
  }

  const excluded = Array.isArray(exp.excluded) ? exp.excluded :
                   Array.isArray(exp.not_eligible) ? exp.not_eligible : [];

  return {
    required,
    categories,
    excluded,
    notes: typeof exp.notes === 'string' ? exp.notes :
           Array.isArray(exp.notes) ? exp.notes.join('\n') : null,
  };
}

// ========================================
// required_documents 正規化
// ========================================

function normalizeRequiredDocuments(canonicalId: string, dj: any, type: SubsidyType): RequiredDocument[] {
  const docs: RequiredDocument[] = [];
  const rd = dj.required_documents || {};
  let sortOrder = 0;

  // common
  addDocuments(docs, rd.common, 'required', '共通', sortOrder);
  sortOrder += (rd.common?.length || 0);

  // corporation
  addDocuments(docs, rd.corporation, 'conditional', '法人向け', sortOrder);
  sortOrder += (rd.corporation?.length || 0);

  // individual
  addDocuments(docs, rd.individual, 'conditional', '個人向け', sortOrder);
  sortOrder += (rd.individual?.length || 0);

  // optional
  addDocuments(docs, rd.optional, 'optional', '任意', sortOrder);
  sortOrder += (rd.optional?.length || 0);

  // main_forms（持続化補助金など）
  addDocuments(docs, rd.main_forms, 'required', '申請様式', sortOrder);
  sortOrder += (rd.main_forms?.length || 0);

  // special_optional（持続化補助金特例）
  addDocuments(docs, rd.special_optional, 'conditional', '特例', sortOrder);
  sortOrder += (rd.special_optional?.length || 0);

  // additional（ものづくり補助金）
  addDocuments(docs, rd.additional, 'conditional', '追加', sortOrder);

  return docs;
}

function addDocuments(
  docs: RequiredDocument[],
  arr: any,
  level: 'required' | 'conditional' | 'optional',
  phase: string,
  startOrder: number
) {
  if (!Array.isArray(arr)) return;
  arr.forEach((d: any, idx: number) => {
    docs.push({
      name: d.name || '',
      required_level: level,
      phase,
      description: d.description || d.period || null,
      notes: d.requirement || d.deadline || d.notes || null,
      sort_order: startOrder + idx,
    });
  });
}

// ========================================
// bonus_points 正規化
// ========================================

function normalizeBonusPoints(dj: any, type: SubsidyType): BonusPoint[] {
  const points: BonusPoint[] = [];

  // 直接 bonus_points がある場合
  if (Array.isArray(dj.bonus_points)) {
    dj.bonus_points.forEach((bp: any) => {
      points.push({
        category: bp.category || null,
        name: bp.name || '',
        description: bp.description || null,
        requirements: bp.requirements || null,
        points: bp.points ?? null,
        max_points: bp.max_points ?? null,
      });
    });
  }

  // evaluation_criteria.bonus_review（持続化補助金など）
  const br = dj.evaluation_criteria?.bonus_review;
  if (br) {
    Object.entries(br).forEach(([category, data]: [string, any]) => {
      if (Array.isArray(data?.options)) {
        data.options.forEach((opt: any) => {
          const name = typeof opt === 'string' ? opt : opt.name || '';
          const desc = typeof opt === 'object' ? opt.description || null : null;
          if (name) {
            points.push({
              category,
              name,
              description: desc,
              requirements: null,
              points: null,
              max_points: null,
            });
          }
        });
      }
    });
  }

  return points;
}

// ========================================
// required_forms 正規化
// ========================================

function normalizeRequiredForms(dj: any): RequiredForm[] {
  const forms: RequiredForm[] = [];

  if (Array.isArray(dj.required_forms)) {
    dj.required_forms.forEach((f: any) => {
      forms.push({
        name: f.name || '',
        fields: Array.isArray(f.fields) ? f.fields : [],
        notes: f.notes || null,
      });
    });
  }

  return forms;
}

// ========================================
// attachments 正規化
// ========================================

function normalizeAttachments(dj: any): Attachment[] {
  const attachments: Attachment[] = [];
  const source = dj.pdf_attachments || dj.attachments || [];

  if (Array.isArray(source)) {
    source.forEach((a: any) => {
      if (a.url && a.url.match(/^https?:\/\//)) {
        attachments.push({
          name: a.name || '添付ファイル',
          url: a.url,
          file_type: a.file_type || null,
          file_size: a.file_size ?? null,
        });
      }
    });
  }

  return attachments;
}

// ========================================
// provenance 正規化
// ========================================

function normalizeProvenance(dj: any): NormalizedProvenance {
  const kouboUrls: string[] = [];
  const pdfUrls: string[] = [];
  const pdfHashes: PdfHash[] = [];

  // koubo_source
  if (dj.koubo_source) {
    if (typeof dj.koubo_source === 'string') {
      kouboUrls.push(dj.koubo_source);
    } else if (Array.isArray(dj.koubo_source.urls)) {
      kouboUrls.push(...dj.koubo_source.urls);
    }
  }

  // official_urls
  if (dj.official_urls) {
    if (dj.official_urls.main) kouboUrls.push(dj.official_urls.main);
    if (dj.official_urls.download) kouboUrls.push(dj.official_urls.download);
    if (dj.official_urls.kitei_pdf) pdfUrls.push(dj.official_urls.kitei_pdf);
  }

  // pdf_urls
  if (Array.isArray(dj.pdf_urls)) {
    pdfUrls.push(...dj.pdf_urls);
  }

  // pdf_hashes
  if (Array.isArray(dj.pdf_hashes)) {
    dj.pdf_hashes.forEach((h: any) => {
      if (h.url && h.sha256_16) {
        pdfHashes.push({
          url: h.url,
          sha256_16: h.sha256_16,
          last_seen_at: h.last_seen_at || new Date().toISOString(),
        });
      }
    });
  }

  return {
    koubo_source_urls: [...new Set(kouboUrls.filter(u => u))],
    pdf_urls: [...new Set(pdfUrls.filter(u => u))],
    pdf_hashes: pdfHashes,
    last_normalized_at: new Date().toISOString(),
  };
}

// ========================================
// ユーティリティ
// ========================================

/**
 * JSONを安全にパース
 */
export function safeJsonParse(json: string | null | undefined): any {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    console.warn('[safeJsonParse] Failed to parse JSON');
    return {};
  }
}

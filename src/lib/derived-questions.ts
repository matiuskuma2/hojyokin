/**
 * derived-questions.ts
 * 
 * P0-2/3: テキスト解析ベースの質問生成エンジン
 * 
 * Freeze v3.0 §19: 質問優先度に準拠
 * 
 * 優先順位:
 * 1. 経費・投資実現性（expense）     → 最高優先
 * 2. 適格性 NG 判定（eligibility）    → 高
 * 3. 電子申請前提条件（application）  → 高
 * 4. ドラフト必須事業骨格（draft）    → 中高
 * 5. 補助金固有数値要件（specific）   → 中
 * 6. 書類準備状況（document）         → 中低
 * 7. 任意加点項目（bonus）            → 低
 * 8. 汎用推奨（generic）             → 最低
 * 
 * @module
 */

import type { DetailJsonParseResult, ParsedEligibilityRule, ParsedExpenseCategory, ParsedDocument } from './text-parser';

// =====================================================
// 型定義
// =====================================================

export interface DerivedQuestion {
  key: string;
  label: string;
  input_type: 'boolean' | 'number' | 'text' | 'select';
  options?: string[];
  source: 'eligibility' | 'document' | 'profile' | 'expense';
  priority: number;
  /** 質問の由来（トレース用） */
  derived_from?: string;
}

// =====================================================
// 固定キー質問マップ（Freeze v3.0 §19.3）
// =====================================================

interface FixedQuestion {
  key: string;
  label: string;
  input_type: 'boolean' | 'number' | 'text' | 'select';
  options?: string[];
  source: 'eligibility' | 'document' | 'profile' | 'expense';
  priority: number;
  /** この質問が出る条件（trueを返す場合のみ出す） */
  trigger: (parsed: DetailJsonParseResult, facts: Map<string, string>, company: Record<string, any>) => boolean;
}

const FIXED_KEY_QUESTIONS: FixedQuestion[] = [
  // ===== Priority 1: 経費・投資実現性 =====
  {
    key: 'investment_amount',
    label: '予定している投資額（設備費・開発費など）はおおよそいくらですか？（万円単位）',
    input_type: 'number',
    source: 'expense',
    priority: 1,
    trigger: (parsed, facts) => 
      !facts.has('investment_amount') && parsed.expenses.categories.length > 0,
  },
  {
    key: 'expense_breakdown',
    label: '主な経費の内訳を教えてください。（例：機械装置費500万円、外注費200万円）',
    input_type: 'text',
    source: 'expense',
    priority: 2,
    trigger: (parsed, facts) => 
      !facts.has('expense_breakdown') && parsed.expenses.categories.length >= 2,
  },

  // ===== Priority 2-3: 適格性・電子申請 =====
  {
    key: 'has_gbiz_id',
    label: 'GビズIDプライムアカウントを取得済みですか？（電子申請に必要です）',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 3,
    trigger: (parsed, facts) => {
      if (facts.has('has_gbiz_id')) return false;
      return parsed.eligibility.rules.some(r => r.category === 'application');
    },
  },
  {
    key: 'tax_arrears',
    label: '税金の滞納はありませんか？（法人税、消費税、社会保険料など）',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 4,
    trigger: (parsed, facts, company) => {
      if (facts.has('tax_arrears')) return false;
      return parsed.eligibility.rules.some(r => r.category === 'compliance') || company.tax_arrears === null;
    },
  },

  // ===== Priority 4: ドラフト必須の事業骨格 =====
  {
    key: 'project_summary',
    label: '今回の補助金で実施したい事業内容を教えてください。（新製品開発、設備導入、IT化推進など具体的に）',
    input_type: 'text',
    source: 'profile',
    priority: 5,
    trigger: (_, facts) => !facts.has('project_summary') && !facts.has('business_purpose'),
  },
  {
    key: 'current_challenge',
    label: '現在の経営課題は何ですか？（人手不足、生産性低下、売上減少、後継者問題など）',
    input_type: 'text',
    source: 'profile',
    priority: 6,
    trigger: (_, facts) => !facts.has('current_challenge'),
  },
  {
    key: 'expected_effect',
    label: '補助金を活用することで期待する効果を具体的に教えてください。（例：売上20%増加、作業時間50%削減など）',
    input_type: 'text',
    source: 'profile',
    priority: 7,
    trigger: (_, facts) => !facts.has('expected_effect'),
  },
  {
    key: 'schedule_timeline',
    label: '事業の実施時期はいつ頃を予定していますか？（例：2026年4月〜9月）',
    input_type: 'text',
    source: 'profile',
    priority: 8,
    trigger: (_, facts) => !facts.has('schedule_timeline') && !facts.has('desired_timeline'),
  },

  // ===== Priority 5: 補助金固有数値要件 =====
  {
    key: 'kpi_targets',
    label: '事業の数値目標（KPI）はありますか？（例：付加価値額3%向上、売上1.5倍等）',
    input_type: 'text',
    source: 'profile',
    priority: 9,
    trigger: (parsed, facts) => {
      if (facts.has('kpi_targets')) return false;
      return parsed.eligibility.rules.some(r => r.category === 'plan');
    },
  },

  // ===== Priority 6: 書類準備 =====
  {
    key: 'has_business_plan',
    label: '事業計画書を作成していますか？（または作成予定がありますか？）',
    input_type: 'boolean',
    source: 'document',
    priority: 10,
    trigger: (parsed, facts) => {
      if (facts.has('has_business_plan')) return false;
      return parsed.documents.documents.some(d => d.doc_type === 'business_plan');
    },
  },
  {
    key: 'has_financial_statements',
    label: '直近2期分の決算書はありますか？',
    input_type: 'boolean',
    source: 'document',
    priority: 11,
    trigger: (parsed, facts) => {
      if (facts.has('has_financial_statements')) return false;
      return parsed.documents.documents.some(d => d.doc_type === 'financial');
    },
  },

  // ===== Priority 7: 加点項目 =====
  {
    key: 'is_wage_raise_planned',
    label: '今後1年以内に賃上げ（給与のベースアップ）を予定していますか？（加点項目になる可能性があります）',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 12,
    trigger: (parsed, facts) => {
      if (facts.has('is_wage_raise_planned')) return false;
      return parsed.eligibility.rules.some(r => /賃上げ|ベースアップ|給与|賃金/.test(r.text));
    },
  },
  {
    key: 'past_subsidy_same_type',
    label: '過去3年以内に同種の補助金を受給していますか？',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 13,
    trigger: (_, facts, company) => {
      if (facts.has('past_subsidy_same_type')) return false;
      return !company.past_subsidies_json;
    },
  },
];

// =====================================================
// メイン関数
// =====================================================

/**
 * テキスト解析結果から質問を生成
 * 
 * Freeze v3.0 §19: 優先度順にソートし、最大10件に制限
 * 
 * @param parsed - テキスト解析結果
 * @param existingFacts - 既に回答済みの facts
 * @param company - 会社情報
 * @param detailJson - detail_json の生データ
 * @returns DerivedQuestion[] 質問リスト（優先度順、最大10件）
 */
export function generateDerivedQuestions(
  parsed: DetailJsonParseResult,
  existingFacts: Map<string, string>,
  company: Record<string, any>,
  detailJson: Record<string, any> | null,
): DerivedQuestion[] {
  const questions: DerivedQuestion[] = [];

  // ===== 1. 固定キー質問（トリガー条件に合致するもの） =====
  for (const fq of FIXED_KEY_QUESTIONS) {
    if (fq.trigger(parsed, existingFacts, company)) {
      questions.push({
        key: fq.key,
        label: fq.label,
        input_type: fq.input_type,
        options: fq.options,
        source: fq.source,
        priority: fq.priority,
        derived_from: 'fixed_key',
      });
    }
  }

  // ===== 2. 動的質問: 適格性ルールから =====
  for (const rule of parsed.eligibility.rules) {
    // manual チェックのルールのみ質問化
    if (rule.check_type !== 'manual') continue;
    
    const factKey = `elig_${sanitizeKey(rule.text)}`;
    if (existingFacts.has(factKey)) continue;
    
    // 既に固定質問で同じカテゴリがカバーされていればスキップ
    const alreadyCovered = questions.some(q => {
      if (rule.category === 'compliance' && q.key === 'tax_arrears') return true;
      if (rule.category === 'plan' && (q.key === 'has_business_plan' || q.key === 'kpi_targets')) return true;
      if (rule.category === 'application' && q.key === 'has_gbiz_id') return true;
      return false;
    });
    if (alreadyCovered) continue;

    questions.push({
      key: factKey,
      label: `次の要件に該当しますか？「${truncate(rule.text, 100)}」`,
      input_type: 'boolean',
      source: 'eligibility',
      priority: 14 + (rule.category === 'exclusion' ? 0 : 1),
      derived_from: `eligibility_rule:${rule.category}`,
    });
  }

  // ===== 3. 動的質問: 必要書類から =====
  for (const doc of parsed.documents.documents) {
    if (!doc.is_required) continue;
    
    const factKey = `doc_${sanitizeKey(doc.text)}`;
    if (existingFacts.has(factKey)) continue;

    // 既に固定質問でカバーされていればスキップ
    if (doc.doc_type === 'business_plan' && questions.some(q => q.key === 'has_business_plan')) continue;
    if (doc.doc_type === 'financial' && questions.some(q => q.key === 'has_financial_statements')) continue;

    questions.push({
      key: factKey,
      label: `「${truncate(doc.text, 80)}」を準備できますか？`,
      input_type: 'boolean',
      source: 'document',
      priority: 16,
      derived_from: `required_doc:${doc.doc_type || 'other'}`,
    });
  }

  // ===== 4. 基本プロフィール補完（テキスト解析とは独立） =====
  if (!existingFacts.has('employee_count') && !company.employee_count) {
    questions.push({
      key: 'employee_count',
      label: '現在の従業員数は何名ですか？（役員を除くパート・アルバイト含む）',
      input_type: 'number',
      source: 'profile',
      priority: 15,
      derived_from: 'profile_complement',
    });
  }
  if (!existingFacts.has('annual_revenue') && !company.annual_revenue) {
    questions.push({
      key: 'annual_revenue',
      label: '直近1年間の年商（売上高）はいくらですか？（万円単位）',
      input_type: 'number',
      source: 'profile',
      priority: 15,
      derived_from: 'profile_complement',
    });
  }

  // ===== 5. ソート＆制限 =====
  questions.sort((a, b) => a.priority - b.priority);
  
  // 最大10件に制限（Freeze v3.0 §19）
  return questions.slice(0, 10);
}

// =====================================================
// ヘルパー
// =====================================================

/**
 * テキストをfactキーに使える形式にサニタイズ
 */
function sanitizeKey(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\u3000-\u9fff]/g, '_')
    .substring(0, 40)
    .replace(/_+$/, '');
}

/**
 * テキストを指定長に切り詰め
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

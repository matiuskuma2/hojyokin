/**
 * derived-questions.ts
 * 
 * P0-2/3: テキスト解析結果からの質問生成エンジン
 * 
 * Freeze v3.0 §19 準拠:
 * 質問優先度:
 *   1. 経費・投資の実現可能性
 *   2. 適格性NGチェック
 *   3. 電子申請前提条件
 *   4. ドラフト必須の事業情報
 *   5. 補助金固有の数値要件
 *   6. 書類チェック
 *   7. 加点項目（任意）
 *   8. 推奨事項（任意）
 * 
 * @module
 */

import type { DetailJsonParseResult } from './text-parser';

// =====================================================
// 型定義
// =====================================================

export interface DerivedQuestion {
  key: string;
  label: string;
  input_type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  source: 'eligibility' | 'document' | 'profile' | 'expense';
  priority: number;
}

// =====================================================
// 固定キー質問マップ（Freeze v3.0 §19.2）
// =====================================================

interface FixedKeyDef {
  key: string;
  label: string;
  input_type: DerivedQuestion['input_type'];
  options?: string[];
  source: DerivedQuestion['source'];
  priority: number;
  /** この質問をトリガーするキーワード（detail_json 内に存在する場合のみ出す） */
  triggers?: RegExp;
  /** 企業情報に既にあればスキップ */
  skip_if_company_field?: string;
}

const FIXED_KEY_QUESTIONS: FixedKeyDef[] = [
  // === Priority 1: 経費・投資 ===
  {
    key: 'investment_amount',
    label: '今回の補助金事業で予定している投資総額（設備費・開発費等の合計）はいくらですか？（万円単位）',
    input_type: 'number',
    source: 'expense',
    priority: 1,
  },
  {
    key: 'expense_breakdown',
    label: '主な経費の内訳を教えてください。（例：機械装置費 500万円、外注費 200万円、クラウド利用費 50万円）',
    input_type: 'text',
    source: 'expense',
    priority: 1,
  },
  // === Priority 2: 適格性 ===
  {
    key: 'tax_arrears',
    label: '税金の滞納はありませんか？（法人税、消費税、社会保険料など）',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 2,
  },
  {
    key: 'past_subsidy_same_type',
    label: '過去3年以内に同種の補助金を受給していますか？',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 2,
  },
  // === Priority 3: 電子申請 ===
  {
    key: 'has_gbiz_id',
    label: 'GビズIDプライムアカウントを取得済みですか？（電子申請に必要です）',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 3,
    triggers: /電子申請|jGrants|G[Bb]iz|gBizID/,
  },
  // === Priority 4: ドラフト必須 ===
  {
    key: 'project_summary',
    label: '今回の補助金で実施したい事業内容を教えてください。（例：新製品開発、設備導入、IT化推進）',
    input_type: 'text',
    source: 'profile',
    priority: 4,
  },
  {
    key: 'current_challenge',
    label: '現在の経営課題は何ですか？（例：人手不足、生産性低下、売上減少、後継者問題）',
    input_type: 'text',
    source: 'profile',
    priority: 4,
  },
  {
    key: 'expected_effect',
    label: '補助金活用で期待する効果を具体的に教えてください。（例：売上20%増、作業時間50%削減）',
    input_type: 'text',
    source: 'profile',
    priority: 4,
  },
  {
    key: 'schedule_timeline',
    label: '事業の実施時期はいつ頃を予定していますか？（例：2026年4月〜9月）',
    input_type: 'text',
    source: 'profile',
    priority: 4,
  },
  {
    key: 'kpi_targets',
    label: '事業の数値目標（KPI）はありますか？（例：付加価値額年率3%増、売上50%増等）',
    input_type: 'text',
    source: 'profile',
    priority: 5,
    triggers: /付加価値|KPI|数値目標|生産性|売上高|経常利益/,
  },
  // === Priority 6: 書類 ===
  {
    key: 'has_business_plan',
    label: '事業計画書を作成していますか？（または作成予定がありますか？）',
    input_type: 'boolean',
    source: 'document',
    priority: 6,
  },
  // === Priority 7: 加点（任意） ===
  {
    key: 'is_wage_raise_planned',
    label: '今後1年以内に賃上げ（給与のベースアップ）を予定していますか？（加点項目になる可能性があります）',
    input_type: 'boolean',
    source: 'eligibility',
    priority: 7,
    triggers: /賃上げ|給与|最低賃金|賃金引上/,
  },
  {
    key: 'application_category',
    label: 'この補助金で申請する枠・類型はお決まりですか？（例：通常枠、デジタル枠、グリーン枠等）',
    input_type: 'text',
    source: 'eligibility',
    priority: 7,
    triggers: /枠|類型|コース|タイプ/,
  },
];

// =====================================================
// メイン関数
// =====================================================

/**
 * テキスト解析結果と固定キーから、不足質問を生成
 * 
 * @param parsed - parseDetailJson の結果
 * @param existingFacts - 既に回答済みの facts
 * @param company - 企業情報
 * @param detailJson - detail_json の生データ（トリガーキーワード判定用）
 * @returns 優先度順にソートされた質問リスト（最大10件）
 */
export function generateDerivedQuestions(
  parsed: DetailJsonParseResult,
  existingFacts: Map<string, string>,
  company: Record<string, any>,
  detailJson: Record<string, any> | null,
): DerivedQuestion[] {
  const questions: DerivedQuestion[] = [];
  const detailText = detailJson ? JSON.stringify(detailJson) : '';

  // ===== 1. 固定キー質問（回答済み・企業情報にあるものはスキップ） =====
  for (const def of FIXED_KEY_QUESTIONS) {
    // 既に回答済み
    if (existingFacts.has(def.key)) continue;
    // 旧キー互換: business_purpose → project_summary
    if (def.key === 'project_summary' && existingFacts.has('business_purpose')) continue;

    // 企業情報に既にある場合スキップ
    if (def.skip_if_company_field && company[def.skip_if_company_field]) continue;

    // トリガーキーワード: detail_json に該当キーワードが無ければスキップ
    if (def.triggers && !def.triggers.test(detailText)) continue;

    questions.push({
      key: def.key,
      label: def.label,
      input_type: def.input_type,
      options: def.options,
      source: def.source,
      priority: def.priority,
    });
  }

  // ===== 2. 解析結果から動的に質問生成 =====
  
  // 2a. 経費カテゴリ → 経費詳細質問
  if (parsed.expenses.categories.length > 0 && !existingFacts.has('expense_breakdown')) {
    // 具体的な経費カテゴリ名を質問に含める
    const catNames = parsed.expenses.categories
      .slice(0, 5)
      .map(c => c.text.substring(0, 20))
      .join('、');
    
    // expense_breakdown が既に追加されていたら上書き
    const existingIdx = questions.findIndex(q => q.key === 'expense_breakdown');
    if (existingIdx >= 0) {
      questions[existingIdx].label = 
        `この補助金の対象経費には「${catNames}」等があります。それぞれの概算金額を教えてください。`;
    }
  }

  // 2b. 適格性ルール → 未回答の確認質問
  for (const rule of parsed.eligibility.rules) {
    // manual check_type のみ質問化
    if (rule.check_type !== 'manual') continue;
    
    const ruleKey = `elig_${hashString(rule.text)}`;
    if (existingFacts.has(ruleKey)) continue;

    // 「〜こと」「〜であること」系のルール → 「〜ですか？」に変換
    let questionText = rule.text;
    if (/こと[。．]?$/.test(questionText)) {
      questionText = questionText.replace(/こと[。．]?$/, '') + 'ですか？';
    } else if (!/[？?]$/.test(questionText)) {
      questionText = `「${questionText}」を満たしていますか？`;
    }

    questions.push({
      key: ruleKey,
      label: questionText,
      input_type: 'boolean',
      source: 'eligibility',
      priority: rule.category === 'compliance' || rule.category === 'exclusion' ? 2 : 5,
    });
  }

  // 2c. 必要書類 → 準備状況確認
  const importantDocs = parsed.documents.documents
    .filter(d => d.is_required)
    .slice(0, 3); // 最大3件

  for (const doc of importantDocs) {
    const docKey = `doc_${hashString(doc.text)}`;
    if (existingFacts.has(docKey)) continue;

    questions.push({
      key: docKey,
      label: `「${doc.text.substring(0, 30)}」を準備できますか？`,
      input_type: 'boolean',
      source: 'document',
      priority: 6,
    });
  }

  // ===== 3. 優先度でソートし、最大10件に制限 =====
  questions.sort((a, b) => a.priority - b.priority);
  return questions.slice(0, 10);
}

// =====================================================
// ユーティリティ
// =====================================================

/**
 * 文字列の簡易ハッシュ（キー生成用）
 * 衝突を完全に防ぐ必要はない（fact_key の一意性用途）
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32bit整数に変換
  }
  return Math.abs(hash).toString(36);
}

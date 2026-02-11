/**
 * S4: 申請書ドラフト生成 API
 * 
 * POST /api/draft/generate - ドラフト生成（テンプレート or LLM）
 * GET  /api/draft/:id - ドラフト取得
 * PUT  /api/draft/:id - ドラフト更新
 * POST /api/draft/:id/check-ng - NGチェック再実行
 * GET  /api/draft/by-session/:session_id - セッションからドラフト取得
 * POST /api/draft/:id/finalize - ドラフト確定
 * 
 * Phase 21: ドラフト生成の抜本改修
 * - facts を実テキストに反映
 * - NormalizedSubsidyDetail から動的にセクション構成を決定
 * - 電子申請案内を含む
 * - 補助金の更新・追加に自動追従する設計
 * 
 * // TODO: 要確認 - 動的セクション生成の完成 → Phase 24 DRAFT-1で受給要件/スケジュールセクション追加完了
 *   基本5セクション + 動的7セクション（経費/加点/書類/様式/受給要件/スケジュール/収集情報）
 *   IT導入補助金/事業再構築/ものづくりの3補助金で動的セクション生成が動作するよう実装済み
 * // TODO: 要確認 - NGチェックの網羅性 → Phase 24で6→21ルールに拡張済み
 *   断定/誇張/不正/審査要注意/あいまい/差別/他社批判/依存/法令違反の9カテゴリ
 *   受け入れ基準: 各ルール1件のテストケースはSEARCH-1で追加予定
 * // TODO: 要確認 - 電子申請案内の自動生成（is_electronic_application連動）
 *   受け入れ基準: 電子申請対象の補助金→GビズID取得案内セクションが自動追加
 * // TODO: 要確認 - LLM統合ドラフト生成（現在はテンプレートのみ、OpenAI API連携）
 *   受け入れ基準: テンプレート生成→LLMリライト→NGチェックの3ステップフロー
 * // TODO: 要確認 - ドラフト更新のバリデーション強化（XSS/SQLi対策、最大文字数制限）
 *   受け入れ基準: sections_jsonの各値にサニタイズ処理、1セクション最大10000文字制限
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  getNormalizedSubsidyDetail,
  type NormalizedSubsidyDetail,
} from '../lib/ssot';

// =====================================================
// 型定義
// =====================================================

/**
 * セクションは動的キー: 補助金ごとに異なるセクション構成を許容
 * 基本5セクション + 補助金固有セクション（eligible_expenses, bonus_points, etc.）
 */
interface DraftSections {
  [key: string]: string;
}

interface NgHit {
  pattern: string;
  reason: string;
  section: string;
  excerpt: string;
}

interface NgResult {
  score: number;
  hits: NgHit[];
}

interface DraftData {
  id: string;
  session_id: string;
  user_id: string;
  company_id: string;
  subsidy_id: string;
  status: 'draft' | 'final';
  version: number;
  sections_json: string;
  ng_result_json: string | null;
  trace_json: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ドラフト生成に使う全コンテキスト
 * facts, company, profile, normalized を統合
 */
interface DraftGenerationContext {
  companyName: string;
  businessSummary: string;
  subsidyTitle: string;
  prefecture: string;
  city: string;
  employeeCount: number;
  industry: string;
  capital: number | null;
  annualRevenue: number | null;
  establishedDate: string;
  // company_profile の詳細
  mainProducts: string;
  mainCustomers: string;
  competitiveAdvantage: string;
  corpType: string;
  foundingYear: number | null;
  // chat_facts（壁打ちで収集した情報）
  facts: Record<string, string>;
  // SSOT 正規化情報
  normalized: NormalizedSubsidyDetail | null;
  // アップロード済み書類
  uploadedDocTypes: string[];
}

const draft = new Hono<{ Bindings: Env; Variables: Variables }>();

// 認証必須
draft.use('*', requireAuth);

// =====================================================
// ヘルパー関数
// =====================================================

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 通貨フォーマット（万円・億円表記）
 */
function formatJPY(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '（金額未入力）';
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億円`;
  if (value >= 10000) return `${Math.floor(value / 10000)}万円`;
  return `${value.toLocaleString()}円`;
}

// =====================================================
// NGルール（禁止表現チェック）
// =====================================================

const NG_RULES: Array<{ pattern: RegExp; reason: string }> = [
  // === 断定・誇張表現 ===
  { pattern: /(必ず採択|絶対に通る|100%|確実に採択)/g, reason: '断定表現（採択保証と誤解される）' },
  { pattern: /(間違いなく|疑いなく|絶対的に)/g, reason: '断定表現（過度な保証）' },
  { pattern: /(日本一|世界初|業界初|唯一無二)(?!.*を目指)/g, reason: '誇張表現（根拠が必要）' },
  // === 不正・コンプライアンス ===
  { pattern: /(裏技|抜け道|抜け穴)/g, reason: '不適切表現（不正を想起）' },
  { pattern: /(架空|偽造|水増し|虚偽)/g, reason: '不正を示唆する表現' },
  { pattern: /(脱税|粉飾|横領|着服)/g, reason: '不適切表現（コンプライアンス）' },
  { pattern: /(転売目的|投機目的|投機的)/g, reason: '補助金の目的外使用を想起' },
  { pattern: /(儲けるだけ|利益だけ|金儲け)/g, reason: '公益性の欠如を想起' },
  // === 補助金審査上の要注意表現 ===
  { pattern: /(既に完了|すでに実施済み|導入済み)/g, reason: '事後申請と判断される恐れ（補助金は原則事前申請）' },
  { pattern: /(見積.*未取得|見積もり.*まだ)/g, reason: '実現可能性の疑義（見積書は必須）' },
  { pattern: /(他社でも同じ|どこでもできる)/g, reason: '自社の優位性・独自性の否定' },
  { pattern: /(予算.*余った|使い切[るれ])/g, reason: '補助金の無駄遣いを想起' },
  // === あいまい・具体性不足 ===
  { pattern: /(いろいろ|さまざまな|各種|etc\.?|等々)/g, reason: 'あいまい表現（具体的に記載すべき）' },
  { pattern: /(たぶん|おそらく|多分|かもしれ(?:ない|ません))/g, reason: '不確実表現（計画の実現性に疑問）' },
  { pattern: /(なんとなく|とりあえず|一応)/g, reason: '計画性の欠如を想起' },
  // === 差別・不適切表現 ===
  { pattern: /(老害|障害者.*邪魔|外国人.*排除)/g, reason: '差別表現' },
  // === 他社批判 ===
  { pattern: /(競合.*劣っ|ライバル.*ダメ|他社.*品質が悪い)/g, reason: '他社批判（審査上マイナス評価）' },
  // === 依存表現 ===
  { pattern: /(補助金.*なければ.*できない|補助金.*頼り)/g, reason: '補助金依存体質と判断される恐れ' },
  { pattern: /(赤字.*補填|損失.*穴埋め)/g, reason: '補助金の目的外使用（赤字補填は対象外）' },
  // === 法令違反 ===
  { pattern: /(労基法.*違反|最低賃金.*下回)/g, reason: '法令違反を示唆する表現' },
];

/**
 * NGチェック: 動的セクション対応
 */
function checkNg(sections: DraftSections): NgResult {
  const hits: NgHit[] = [];
  
  for (const [section, text] of Object.entries(sections)) {
    if (!text) continue;
    
    for (const rule of NG_RULES) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const idx = match.index;
        const excerpt = text.slice(Math.max(0, idx - 20), Math.min(text.length, idx + 40));
        hits.push({
          pattern: match[0],
          reason: rule.reason,
          section,
          excerpt: `...${excerpt}...`
        });
      }
    }
  }

  const score = Math.max(0, 100 - hits.length * 10);
  return { score, hits };
}

// =====================================================
// ドラフト生成エンジン（Phase 21: 全面改修）
// =====================================================

/**
 * ドラフト生成: NormalizedSubsidyDetail + facts + company を統合
 * 
 * 設計方針:
 * 1. 基本5セクション（背景・目的・計画・体制・資金）は必ず生成
 * 2. NormalizedSubsidyDetail の content から追加セクション動的生成
 *    - eligible_expenses → 対象経費セクション
 *    - bonus_points → 加点項目戦略セクション
 *    - required_documents → 必要書類チェックリストセクション
 *    - required_forms → 申請様式情報セクション
 * 3. facts は該当箇所に実テキストとして埋め込み
 * 4. 電子申請の場合は冒頭案内を追加
 * 5. 将来の補助金追加・SSOT更新に自動追従
 */
function generateDraft(ctx: DraftGenerationContext): DraftSections {
  const sections: DraftSections = {};
  const n = ctx.normalized;
  const f = ctx.facts;
  
  // ===========================================
  // セクション順序カウンター
  // ===========================================
  let sectionIndex = 0;
  const sectionKey = (base: string) => `${String(++sectionIndex).padStart(2, '0')}_${base}`;
  
  // ===========================================
  // 0. 電子申請の案内（該当する場合のみ）
  // ===========================================
  if (n?.electronic_application?.is_electronic_application) {
    const portal = n.electronic_application.portal_name || '電子申請システム';
    const url = n.electronic_application.portal_url || '';
    sections[sectionKey('notice')] = `【ご利用にあたって】

この補助金は「${portal}」での電子申請が必要です。
本ドラフトは、電子申請システムへ入力する内容の下書き（たたき台）です。

■ 使い方
1. 各セクションの内容を確認・編集してください
2. 編集後、電子申請システムの該当フィールドにコピー＆ペーストしてください
3. 電子申請システム固有の入力欄（申請者情報等）は直接入力してください
${url ? `\n■ 申請先URL\n${url}` : ''}
${n.electronic_application.notes ? `\n■ 注意事項\n${n.electronic_application.notes}` : ''}

※このセクションは申請書には含まれません。準備用のメモです。`;
  }
  
  // ===========================================
  // 1. 背景・課題
  // ===========================================
  const currentChallenge = f['current_challenge'] && f['current_challenge'] !== 'unknown'
    ? f['current_challenge']
    : null;
  const businessPurpose = f['business_purpose'] && f['business_purpose'] !== 'unknown'
    ? f['business_purpose']
    : null;
  const bizSummary = ctx.businessSummary || businessPurpose || '';
  
  // 企業紹介文（確定情報から構築）
  const companyIntro: string[] = [];
  companyIntro.push(`${ctx.companyName}は、${ctx.prefecture}${ctx.city}において`);
  if (bizSummary) {
    companyIntro.push(`「${bizSummary}」を営む`);
  }
  companyIntro.push(`${ctx.corpType || ''}企業です。`);
  if (ctx.employeeCount) companyIntro.push(`従業員数は${ctx.employeeCount}名`);
  if (ctx.foundingYear) companyIntro.push(`、${ctx.foundingYear}年創業`);
  if (ctx.capital) companyIntro.push(`、資本金${formatJPY(ctx.capital)}`);
  companyIntro.push('です。');
  if (ctx.mainProducts) companyIntro.push(`\n主な事業内容: ${ctx.mainProducts}`);
  if (ctx.mainCustomers) companyIntro.push(`\n主な顧客層: ${ctx.mainCustomers}`);
  
  // 課題記述
  let challengeText: string;
  if (currentChallenge) {
    challengeText = `現在、以下のような課題を抱えています：\n\n${currentChallenge}`;
  } else {
    challengeText = `現在、以下のような課題を抱えています：
・（課題1：生産性/品質/人手不足/販路など、具体的な課題を記載してください）
・（課題2：業界動向や外部環境の変化による影響など）
・（課題3：現状の体制・設備では対応が困難な点など）

※壁打ちチャットで「現在の経営課題」を回答すると、ここに自動反映されます`;
  }
  
  sections[sectionKey('background')] = `【背景・課題】

${companyIntro.join('')}

${challengeText}

今回「${ctx.subsidyTitle}」を活用することで、これらの課題を解決し、事業の安定・成長を目指します。

※充実させるポイント：
- 課題は具体的な数値（○○が△△%減少、□□に××時間かかっている等）で示すと説得力が増します
- 業界全体の課題と自社固有の課題を分けて記載すると整理されます`;

  // ===========================================
  // 2. 事業目的
  // ===========================================
  const expectedEffect = f['expected_effect'] && f['expected_effect'] !== 'unknown'
    ? f['expected_effect']
    : null;
  const subsidyPurpose = n?.overview?.purpose || '';
  
  let purposeDetail: string;
  if (businessPurpose && expectedEffect) {
    purposeDetail = `本事業の目的は、以下の取り組みにより、経営課題の解決と持続的な成長を実現することです。

■ 取り組みの概要
${businessPurpose}

■ 期待する効果・成果目標
${expectedEffect}`;
  } else if (businessPurpose) {
    purposeDetail = `本事業の目的は、以下の取り組みにより、経営課題の解決と持続的な成長を実現することです。

■ 取り組みの概要
${businessPurpose}

■ 期待する効果・成果目標
（具体的な数値目標を記載してください。例：売上○○%増、生産性○○%向上、コスト○○%削減）

※壁打ちチャットで「期待する効果」を回答すると、ここに自動反映されます`;
  } else {
    purposeDetail = `本事業の目的は、${ctx.companyName}の業務プロセスを改善し、以下の成果を実現することです：

1. 生産性の向上
   - 目標：（処理時間○○%短縮、生産量○○%増加など）

2. 品質・サービスの向上
   - 目標：（不良率○○%削減、顧客満足度○○%向上など）

3. 収益性の改善
   - 目標：（売上○○%増、粗利率○○%改善など）

※壁打ちチャットで「事業内容」「期待する効果」を回答すると、ここに自動反映されます`;
  }
  
  sections[sectionKey('purpose')] = `【事業目的】

${purposeDetail}
${subsidyPurpose ? `\n■ 補助金の趣旨との整合\n本事業は、「${ctx.subsidyTitle}」の目的である「${subsidyPurpose.substring(0, 150)}${subsidyPurpose.length > 150 ? '...' : ''}」に合致するものです。` : ''}

補助事業終了後も継続的に運用できる体制を構築し、中長期的な企業価値向上を図ります。

※充実させるポイント：
- 「なぜこの補助金を使うのか」が明確になるよう記載してください
- 定量的な目標を設定することで、事業の実効性をアピールできます`;

  // ===========================================
  // 3. 実施内容・方法
  // ===========================================
  const timeline = f['desired_timeline'] && f['desired_timeline'] !== 'unknown'
    ? f['desired_timeline']
    : '（実施時期を記載してください）';
  
  sections[sectionKey('plan')] = `【実施内容・方法】

本事業は以下のステップで実施します：
${businessPurpose ? `\n■ 事業概要\n${businessPurpose}\n` : ''}
■ Phase 1：現状分析・計画策定
・対象業務の棚卸しと課題の定量化
・導入する設備/システムの選定・見積取得
・実施スケジュールの詳細化

■ Phase 2：導入・実装
・（導入物1：具体的なツール名/設備名を記載）
・（導入物2：外注する場合はその内容も）
・従業員への教育・研修

■ Phase 3：運用定着・効果測定
・マニュアル整備と運用ルールの策定
・効果測定と改善

■ 実施スケジュール
${timeline}

※充実させるポイント：
- 「いつ・誰が・何を」が明確になるスケジュールを記載してください
- 導入物は見積書と一致させてください`;

  // ===========================================
  // 4. 実施体制
  // ===========================================
  sections[sectionKey('team')] = `【実施体制】

本事業の実施体制は以下の通りです：

■ 社内体制
・事業責任者：（役職・氏名）
  - 全体統括、意思決定、対外折衝

・実務担当者：（役職・氏名）
  - 日常的な進捗管理、導入作業の実施

・経理担当：（役職・氏名）
  - 補助金関連の経理処理、証憑管理

■ 外部支援体制（該当する場合）
・認定支援機関：（機関名）
・外注先：（会社名・担当業務）

■ 意思決定・報告フロー
1. 週次：実務担当者→事業責任者への進捗報告
2. 月次：経営会議での報告・承認
3. 随時：重要事項の即時エスカレーション

※充実させるポイント：
- 小規模企業でも役割分担を明確にすることで実現可能性をアピールできます
- 外部支援を活用する場合は、その役割も明記してください`;

  // ===========================================
  // 5. 資金計画
  // ===========================================
  const investmentAmount = f['investment_amount'] && f['investment_amount'] !== 'unknown'
    ? parseFloat(f['investment_amount'])
    : null;
  const maxLimit = n?.display?.subsidy_max_limit || null;
  const rateText = n?.display?.subsidy_rate_text || '（補助率を確認してください）';
  
  let budgetDetail: string;
  if (investmentAmount && !isNaN(investmentAmount)) {
    // 投資額から概算計算
    const investJPY = formatJPY(investmentAmount);
    budgetDetail = `■ 事業費総額：${investJPY}（壁打ちチャットでの回答に基づく概算）

■ 主な費目（内訳を記載してください）
1. 設備費：○○○万円
   - （具体的な設備名と金額）

2. システム導入費：○○○万円
   - （具体的なシステム名と金額）

3. 外注費：○○○万円（該当する場合）
   - （外注内容と金額）

4. その他経費：○○○万円
   - （内訳）

■ 補助金申請額
・補助率：${rateText}
${maxLimit ? `・補助上限：${formatJPY(maxLimit)}` : '・補助上限：（公募要領を確認してください）'}
・申請額：（補助率を事業費に掛けた額。上限を超えない範囲で記載）`;
  } else {
    budgetDetail = `■ 事業費総額：○○○万円

■ 主な費目
1. 設備費：○○○万円
   - （具体的な設備名と金額）

2. システム導入費：○○○万円
   - （具体的なシステム名と金額）

3. 外注費：○○○万円（該当する場合）
   - （外注内容と金額）

4. その他経費：○○○万円
   - （内訳）

■ 補助金申請額
・補助率：${rateText}
${maxLimit ? `・補助上限：${formatJPY(maxLimit)}` : '・補助上限：（公募要領を確認してください）'}
・申請額：○○○万円

※壁打ちチャットで「投資予定額」を回答すると、事業費総額に自動反映されます`;
  }
  
  sections[sectionKey('budget')] = `【資金計画（概要）】

${budgetDetail}

■ 自己負担分の資金手当て
・自己資金：○○○万円
・金融機関融資（予定）：○○○万円

※充実させるポイント：
- 見積書の金額と一致させてください
- 自己負担分の資金手当ての目処を示すことで実現可能性をアピールできます`;

  // ===========================================
  // 6. 受給要件の確認（NormalizedSubsidyDetail.eligibility_rules から動的生成）
  //    Phase 24 DRAFT-1: 補助金固有の要件を自動セクション化
  // ===========================================
  if (n?.content?.eligibility_rules && n.content.eligibility_rules.length > 0) {
    const rules = n.content.eligibility_rules;
    const parts: string[] = [];

    // カテゴリ別にグループ化
    const grouped = new Map<string, typeof rules>();
    for (const r of rules) {
      const cat = r.category || 'general';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(r);
    }

    const CATEGORY_LABELS: Record<string, string> = {
      'general': '一般要件',
      'industry': '業種要件',
      'employee': '従業員要件',
      'capital': '資本金要件',
      'location': '地域要件',
      'size': '企業規模要件',
      'certification': '認証・計画要件',
      'financial': '財務要件',
      'purpose': '目的・用途要件',
      'other': 'その他要件',
    };

    for (const [cat, catRules] of grouped) {
      const label = CATEGORY_LABELS[cat] || cat;
      parts.push(`■ ${label}`);
      for (const rule of catRules) {
        // 自社の合致状況を推定
        let selfCheck = '□';
        if (rule.category === 'industry' && ctx.industry) selfCheck = '☑';
        if (rule.category === 'employee' && ctx.employeeCount > 0) selfCheck = '☑';
        if (rule.category === 'capital' && ctx.capital) selfCheck = '☑';
        if (rule.category === 'location' && ctx.prefecture) selfCheck = '☑';

        parts.push(`${selfCheck} ${rule.rule_text}`);
        if (rule.notes) parts.push(`  ※${rule.notes}`);
      }
      parts.push('');
    }

    sections[sectionKey('eligibility')] = `【受給要件の確認】

この補助金の受給要件です。☑ は企業情報から自動判定された項目です。
すべての要件を満たしているか確認してください。

${parts.join('\n')}
※上記要件は補助金のSSOT（正規化データ）から自動生成されています。
詳細は公募要領の原文をご確認ください。`;
  }

  // ===========================================
  // 7. 対象経費の詳細（NormalizedSubsidyDetail から動的生成）
  // ===========================================
  if (n?.content?.eligible_expenses) {
    const exp = n.content.eligible_expenses;
    const parts: string[] = [];
    
    if (exp.categories.length > 0) {
      parts.push('■ 対象となる経費区分');
      for (const cat of exp.categories) {
        let line = `・${cat.name}`;
        if (cat.description) line += `：${cat.description}`;
        if (cat.rate_text) line += `（補助率: ${cat.rate_text}）`;
        if (cat.max_amount) line += `（上限: ${formatJPY(cat.max_amount)}）`;
        parts.push(line);
        if (cat.items.length > 0) {
          for (const item of cat.items.slice(0, 5)) {
            parts.push(`  - ${item}`);
          }
        }
      }
    }
    
    if (exp.required.length > 0) {
      parts.push('\n■ 経費に関する要件');
      for (const req of exp.required) {
        let line = `・${req.name}`;
        if (req.description) line += `：${req.description}`;
        if (req.min_amount) line += `（最低額: ${formatJPY(req.min_amount)}）`;
        parts.push(line);
      }
    }
    
    if (exp.excluded.length > 0) {
      parts.push('\n■ 対象外の経費（注意）');
      for (const ex of exp.excluded.slice(0, 10)) {
        parts.push(`・${ex}`);
      }
    }
    
    if (exp.notes) {
      parts.push(`\n■ 備考\n${exp.notes}`);
    }
    
    if (parts.length > 0) {
      sections[sectionKey('expenses')] = `【対象経費について】

この補助金で認められる経費区分です。資金計画の費目と照らし合わせて、対象経費に該当するか確認してください。

${parts.join('\n')}

※自社の投資内容が対象経費に該当するか不明な場合は、壁打ちチャットで「この経費は対象になるか？」と相談できます`;
    }
  }

  // ===========================================
  // 7. 加点項目の戦略（NormalizedSubsidyDetail から動的生成）
  // ===========================================
  if (n?.content?.bonus_points && n.content.bonus_points.length > 0) {
    const bonus = n.content.bonus_points;
    const parts: string[] = [];
    
    // facts から加点関連情報を取得
    const wageRaise = f['is_wage_raise_planned'];
    const keieikakushin = f['has_keiei_kakushin'];
    const jigyoukeizoku = f['has_jigyou_keizoku'];
    
    parts.push('■ 加点項目一覧と自社の対応状況\n');
    
    for (const bp of bonus) {
      let status = '□ 未確認';
      // facts と照合して状態を推定
      if (bp.name.includes('賃上げ') && wageRaise === 'true') status = '☑ 対応予定';
      if (bp.name.includes('経営革新') && keieikakushin === 'true') status = '☑ 取得済み';
      if (bp.name.includes('事業継続') && jigyoukeizoku === 'true') status = '☑ 取得済み';
      
      let line = `${status} ${bp.name}`;
      if (bp.points) line += `（${bp.points}点）`;
      parts.push(line);
      if (bp.description) parts.push(`  概要: ${bp.description}`);
      if (bp.requirements) parts.push(`  要件: ${bp.requirements}`);
      parts.push('');
    }
    
    sections[sectionKey('bonus')] = `【加点項目の取得戦略】

採択率を高めるため、以下の加点項目への対応を検討してください。☑ がついている項目は、壁打ちチャットでの回答から対応可能と判断されたものです。

${parts.join('\n')}
※充実させるポイント：
- 加点項目は1つでも多く取得することで採択率が大幅に向上します
- 今からでも間に合う加点項目がないか確認してください`;
  }

  // ===========================================
  // 8. 必要書類チェックリスト（NormalizedSubsidyDetail から動的生成）
  // ===========================================
  if (n?.content?.required_documents && n.content.required_documents.length > 0) {
    const docs = n.content.required_documents;
    const parts: string[] = [];
    
    // 必須書類
    const required = docs.filter(d => d.required_level === 'required');
    const conditional = docs.filter(d => d.required_level === 'conditional');
    const optional = docs.filter(d => d.required_level === 'optional');
    
    if (required.length > 0) {
      parts.push('■ 必須書類');
      for (const doc of required) {
        const uploaded = ctx.uploadedDocTypes.some(t => 
          doc.name.includes(t) || t.includes(doc.name.substring(0, 4))
        );
        const check = uploaded ? '☑ アップロード済み' : '□ 未準備';
        let line = `${check} ${doc.name}`;
        if (doc.description) line += `\n  ${doc.description}`;
        if (doc.notes) line += `\n  ※${doc.notes}`;
        parts.push(line);
      }
    }
    
    if (conditional.length > 0) {
      parts.push('\n■ 条件付き書類（該当する場合のみ）');
      for (const doc of conditional) {
        parts.push(`□ ${doc.name}${doc.notes ? ` ※${doc.notes}` : ''}`);
      }
    }
    
    if (optional.length > 0) {
      parts.push('\n■ 任意書類（提出推奨）');
      for (const doc of optional.slice(0, 10)) {
        parts.push(`□ ${doc.name}`);
      }
    }
    
    sections[sectionKey('documents')] = `【必要書類チェックリスト】

申請に必要な書類の一覧です。壁打ちチャットでアップロードした書類は「☑ アップロード済み」と表示されます。

${parts.join('\n')}

※このリストは補助金の公募要領に基づいて自動生成されています。
最新の情報は公式の公募要領をご確認ください。`;
  }

  // ===========================================
  // 9. 申請様式情報（required_forms があれば）
  // ===========================================
  if (n?.content?.required_forms && n.content.required_forms.length > 0) {
    const forms = n.content.required_forms;
    const parts: string[] = [];
    
    for (const form of forms) {
      parts.push(`■ ${form.name}`);
      if (form.fields.length > 0) {
        parts.push('  入力項目:');
        for (const field of form.fields) {
          parts.push(`  ・${field}`);
        }
      }
      if (form.notes) parts.push(`  ※${form.notes}`);
      parts.push('');
    }
    
    sections[sectionKey('forms')] = `【申請様式について】

この補助金の申請に必要な様式（フォーム）情報です。

${parts.join('\n')}
※上記の各セクションの内容を、対応する様式にコピー＆ペーストしてお使いください。`;
  }

  // ===========================================
  // 11. 申請スケジュール（acceptance 情報から動的生成）
  //     Phase 24 DRAFT-1: 期限警告つきスケジュールセクション
  // ===========================================
  if (n?.acceptance) {
    const acc = n.acceptance;
    const parts: string[] = [];

    if (acc.acceptance_start) {
      parts.push(`■ 受付開始日: ${acc.acceptance_start}`);
    }
    if (acc.acceptance_end) {
      parts.push(`■ 受付締切日: ${acc.acceptance_end}`);
      // 締切までの残り日数を計算
      const endDate = new Date(acc.acceptance_end);
      const now = new Date();
      const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        parts.push(`  ⚠️ 受付は終了しています`);
      } else if (diffDays <= 14) {
        parts.push(`  ⚠️ 締切まであと${diffDays}日です。早めに準備を完了してください。`);
      } else if (diffDays <= 30) {
        parts.push(`  📅 締切まであと${diffDays}日です。`);
      } else {
        parts.push(`  📅 締切まであと約${Math.floor(diffDays / 7)}週間です。`);
      }
    }

    if (parts.length > 0) {
      const timeline = f['desired_timeline'] && f['desired_timeline'] !== 'unknown'
        ? f['desired_timeline']
        : null;

      sections[sectionKey('schedule')] = `【申請スケジュール】

${parts.join('\n')}

■ 推奨準備スケジュール
1. 書類準備・事業計画の精査
2. 認定支援機関への相談（必要に応じて）
3. 電子申請システムへの入力・確認
4. 最終チェック・提出
${timeline ? `\n■ 事業実施予定\n${timeline}` : ''}

※締切日は変更される場合があります。最新情報は公式サイトをご確認ください。`;
    }
  }

  // ===========================================
  // 12. 収集済み情報サマリー（参照用、申請書には含めない）
  // ===========================================
  const factEntries = Object.entries(f).filter(([_, v]) => v && v !== 'unknown');
  if (factEntries.length > 0) {
    const FACT_LABELS: Record<string, string> = {
      'business_purpose': '事業目的',
      'investment_amount': '投資予定額',
      'current_challenge': '現在の経営課題',
      'expected_effect': '期待する効果',
      'tax_arrears': '税金滞納',
      'has_gbiz_id': 'GビズIDプライム',
      'has_business_plan': '事業計画書',
      'desired_timeline': '実施スケジュール',
      'is_wage_raise_planned': '賃上げ予定',
      'past_subsidy_same_type': '同種補助金受給歴',
      'employee_count': '従業員数',
      'annual_revenue': '年商',
    };
    
    const summaryLines = factEntries.map(([key, value]) => {
      const label = FACT_LABELS[key] || key.replace(/^wc_[^_]+_/, '').replace(/_/g, ' ');
      const displayValue = value === 'true' ? 'はい' : value === 'false' ? 'いいえ' : value;
      return `・${label}: ${displayValue}`;
    });
    
    sections[sectionKey('collected_info')] = `【壁打ちで収集した情報（参照用）】

以下は壁打ちチャットで収集した情報の一覧です。各セクションの編集時に参照してください。
※このセクションは申請書には含まれません。

${summaryLines.join('\n')}`;
  }

  return sections;
}

// =====================================================
// GET /api/draft - ドラフト一覧取得
// Phase 22: ダッシュボードからの呼び出し用
// =====================================================

draft.get('/', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  try {
    const result = await db.prepare(`
      SELECT ad.id, ad.session_id, ad.company_id, ad.subsidy_id,
             ad.status, ad.version, ad.created_at, ad.updated_at,
             cs.subsidy_title,
             sc.title as subsidy_cache_title,
             c.name as company_name
      FROM application_drafts ad
      LEFT JOIN chat_sessions cs ON ad.session_id = cs.id
      LEFT JOIN subsidy_cache sc ON ad.subsidy_id = sc.id
      LEFT JOIN companies c ON ad.company_id = c.id
      WHERE ad.user_id = ?
      ORDER BY ad.updated_at DESC
      LIMIT 50
    `).bind(user.id).all();

    const drafts = (result.results || []).map((d: any) => ({
      id: d.id,
      session_id: d.session_id,
      company_id: d.company_id,
      subsidy_id: d.subsidy_id,
      status: d.status,
      version: d.version,
      created_at: d.created_at,
      updated_at: d.updated_at,
      subsidy_title: d.subsidy_title || d.subsidy_cache_title || '（補助金名不明）',
      company_name: d.company_name || '（会社名不明）',
    }));

    return c.json<ApiResponse<any>>({
      success: true,
      data: drafts
    });

  } catch (error) {
    console.error('List drafts error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list drafts' }
    }, 500);
  }
});

// =====================================================
// POST /api/draft/generate - ドラフト生成
// =====================================================

draft.post('/generate', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;

  try {
    const body = await c.req.json<{ session_id: string; mode?: 'template' | 'llm' }>();

    if (!body?.session_id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'session_id is required' }
      }, 400);
    }

    // セッション取得
    const session = await db.prepare(`
      SELECT cs.*, sc.title as subsidy_title
      FROM chat_sessions cs
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE cs.id = ? AND cs.user_id = ?
    `).bind(body.session_id, user.id).first<any>();

    if (!session) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat session not found' }
      }, 404);
    }

    // 既存のドラフトがあれば返す
    const existingDraft = await db.prepare(`
      SELECT * FROM application_drafts
      WHERE session_id = ? AND user_id = ? AND status = 'draft'
      ORDER BY version DESC
      LIMIT 1
    `).bind(session.id, user.id).first<DraftData>();

    if (existingDraft) {
      const sections = JSON.parse(existingDraft.sections_json) as DraftSections;
      const ng = existingDraft.ng_result_json ? JSON.parse(existingDraft.ng_result_json) as NgResult : { score: 100, hits: [] };
      
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          draft_id: existingDraft.id,
          sections,
          ng,
          is_new: false
        }
      });
    }

    // === データ収集（並列取得） ===
    
    // 会社情報 + プロフィール
    const companyRow = await db.prepare(`
      SELECT c.*, cp.corp_type, cp.founding_year, cp.business_summary,
             cp.main_products, cp.main_customers, cp.competitive_advantage,
             cp.is_profitable, cp.past_subsidies_json, cp.certifications_json,
             cp.notes as profile_notes,
             cp.capital as profile_capital, cp.annual_revenue as profile_revenue,
             cp.established_date as profile_established_date
      FROM companies c
      LEFT JOIN company_profile cp ON c.id = cp.company_id
      WHERE c.id = ?
    `).bind(session.company_id).first<any>();

    // chat_facts取得
    const factsResult = await db.prepare(`
      SELECT fact_key, fact_value FROM chat_facts
      WHERE company_id = ? AND (subsidy_id IS NULL OR subsidy_id = ?)
      AND fact_value IS NOT NULL AND fact_value != '' AND fact_value != 'unknown'
    `).bind(session.company_id, session.subsidy_id).all();

    const facts: Record<string, string> = {};
    for (const row of (factsResult.results || []) as any[]) {
      facts[row.fact_key] = row.fact_value;
    }

    // SSOT から NormalizedSubsidyDetail 取得
    const ssotResult = await getNormalizedSubsidyDetail(c.env.DB, session.subsidy_id);
    const normalized = ssotResult?.normalized || null;
    
    // アップロード済み書類の種別一覧
    const docsResult = await db.prepare(`
      SELECT doc_type, original_filename FROM company_documents
      WHERE company_id = ? AND status = 'uploaded'
    `).bind(session.company_id).all();
    
    const uploadedDocTypes = (docsResult.results || []).map((d: any) => d.doc_type || d.original_filename || '');

    // === コンテキスト構築 ===
    const ctx: DraftGenerationContext = {
      companyName: companyRow?.name || '（会社名未登録）',
      businessSummary: companyRow?.business_summary || '',
      subsidyTitle: normalized?.display?.title || session.subsidy_title || '（補助金名未取得）',
      prefecture: companyRow?.prefecture || '',
      city: companyRow?.city || '',
      employeeCount: companyRow?.employee_count || 0,
      industry: companyRow?.industry_major || '',
      capital: companyRow?.capital || companyRow?.profile_capital || null,
      annualRevenue: companyRow?.annual_revenue || companyRow?.profile_revenue || null,
      establishedDate: companyRow?.established_date || companyRow?.profile_established_date || '',
      mainProducts: companyRow?.main_products || '',
      mainCustomers: companyRow?.main_customers || '',
      competitiveAdvantage: companyRow?.competitive_advantage || '',
      corpType: companyRow?.corp_type || '',
      foundingYear: companyRow?.founding_year || null,
      facts,
      normalized,
      uploadedDocTypes,
    };

    // === ドラフト生成 ===
    const sections = generateDraft(ctx);

    // NGチェック
    const ng = checkNg(sections);

    // DB保存
    const draftId = crypto.randomUUID();
    const now = nowIso();

    await db.prepare(`
      INSERT INTO application_drafts (
        id, session_id, user_id, company_id, subsidy_id,
        status, version, sections_json, ng_result_json, trace_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?)
    `).bind(
      draftId,
      session.id,
      user.id,
      session.company_id,
      session.subsidy_id,
      JSON.stringify(sections),
      JSON.stringify(ng),
      JSON.stringify({
        generated_at: now,
        mode: body.mode || 'template',
        schema_version: '2.0',
        normalized_available: !!normalized,
        normalized_schema_version: normalized?.schema_version || null,
        used_facts: Object.keys(facts),
        facts_count: Object.keys(facts).length,
        sections_generated: Object.keys(sections).length,
        uploaded_docs_count: uploadedDocTypes.length,
        company_id: session.company_id,
        subsidy_id: session.subsidy_id,
        subsidy_canonical_id: normalized?.ids?.canonical_id || null,
      }),
      now,
      now
    ).run();

    // === usage_events にドラフト生成イベントを記録 ===
    const eventId = crypto.randomUUID();
    try {
      await db.prepare(`
        INSERT INTO usage_events (
          id, user_id, company_id, event_type, provider, 
          tokens_in, tokens_out, estimated_cost_usd, metadata, created_at
        ) VALUES (?, ?, ?, 'DRAFT_GENERATED', 'internal', 0, 0, 0, ?, datetime('now'))
      `).bind(
        eventId,
        user.id,
        session.company_id,
        JSON.stringify({
          draft_id: draftId,
          session_id: session.id,
          subsidy_id: session.subsidy_id,
          mode: body.mode || 'template',
          ng_score: ng.score,
          ng_hit_count: ng.hits.length,
          sections_count: Object.keys(sections).length,
          facts_count: Object.keys(facts).length,
        })
      ).run();
    } catch (eventError) {
      console.error('Failed to record draft generation event:', eventError);
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        draft_id: draftId,
        sections,
        ng,
        is_new: true
      }
    });

  } catch (error) {
    console.error('Generate draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate draft' }
    }, 500);
  }
});

// =====================================================
// GET /api/draft/:id - ドラフト取得
// =====================================================

draft.get('/:draft_id', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const row = await db.prepare(`
      SELECT ad.*, cs.subsidy_id, sc.title as subsidy_title
      FROM application_drafts ad
      LEFT JOIN chat_sessions cs ON ad.session_id = cs.id
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE ad.id = ? AND ad.user_id = ?
    `).bind(draftId, user.id).first<any>();

    if (!row) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        ...row,
        sections: JSON.parse(row.sections_json),
        ng: row.ng_result_json ? JSON.parse(row.ng_result_json) : null,
        trace: row.trace_json ? JSON.parse(row.trace_json) : null
      }
    });

  } catch (error) {
    console.error('Get draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get draft' }
    }, 500);
  }
});

// =====================================================
// GET /api/draft/by-session/:session_id - セッションからドラフト取得
// =====================================================

draft.get('/by-session/:session_id', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const sessionId = c.req.param('session_id');

  try {
    const row = await db.prepare(`
      SELECT ad.*, sc.title as subsidy_title
      FROM application_drafts ad
      LEFT JOIN chat_sessions cs ON ad.session_id = cs.id
      LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
      WHERE ad.session_id = ? AND ad.user_id = ?
      ORDER BY ad.version DESC
      LIMIT 1
    `).bind(sessionId, user.id).first<any>();

    if (!row) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found for this session' }
      }, 404);
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        ...row,
        sections: JSON.parse(row.sections_json),
        ng: row.ng_result_json ? JSON.parse(row.ng_result_json) : null,
        trace: row.trace_json ? JSON.parse(row.trace_json) : null
      }
    });

  } catch (error) {
    console.error('Get draft by session error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get draft' }
    }, 500);
  }
});

// =====================================================
// PUT /api/draft/:id - ドラフト更新
// =====================================================

draft.put('/:draft_id', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const body = await c.req.json<{ sections: DraftSections; meta?: any }>();

    if (!body?.sections || typeof body.sections !== 'object') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'sections is required' }
      }, 400);
    }

    // 既存ドラフト確認
    const existing = await db.prepare(`
      SELECT * FROM application_drafts WHERE id = ? AND user_id = ?
    `).bind(draftId, user.id).first<DraftData>();

    if (!existing) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    // NGチェック
    const ng = checkNg(body.sections);

    // 更新
    await db.prepare(`
      UPDATE application_drafts
      SET sections_json = ?, ng_result_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      JSON.stringify(body.sections),
      JSON.stringify(ng),
      draftId
    ).run();

    return c.json<ApiResponse<{ draft_id: string; ng: NgResult }>>({
      success: true,
      data: { draft_id: draftId, ng }
    });

  } catch (error) {
    console.error('Update draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update draft' }
    }, 500);
  }
});

// =====================================================
// POST /api/draft/:id/check-ng - NGチェック再実行
// =====================================================

draft.post('/:draft_id/check-ng', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const row = await db.prepare(`
      SELECT sections_json FROM application_drafts WHERE id = ? AND user_id = ?
    `).bind(draftId, user.id).first<{ sections_json: string }>();

    if (!row) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    const sections = JSON.parse(row.sections_json) as DraftSections;
    const ng = checkNg(sections);

    // 結果保存
    await db.prepare(`
      UPDATE application_drafts SET ng_result_json = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(JSON.stringify(ng), draftId).run();

    return c.json<ApiResponse<NgResult>>({
      success: true,
      data: ng
    });

  } catch (error) {
    console.error('Check NG error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check NG' }
    }, 500);
  }
});

// =====================================================
// POST /api/draft/:id/finalize - ドラフト確定
// =====================================================

draft.post('/:draft_id/finalize', async (c) => {
  const user = c.get('user')!;
  const db = c.env.DB;
  const draftId = c.req.param('draft_id');

  try {
    const existing = await db.prepare(`
      SELECT * FROM application_drafts WHERE id = ? AND user_id = ?
    `).bind(draftId, user.id).first<DraftData>();

    if (!existing) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Draft not found' }
      }, 404);
    }

    // ステータスを final に更新
    await db.prepare(`
      UPDATE application_drafts SET status = 'final', updated_at = datetime('now') WHERE id = ?
    `).bind(draftId).run();

    return c.json<ApiResponse<{ draft_id: string; status: string }>>({
      success: true,
      data: { draft_id: draftId, status: 'final' }
    });

  } catch (error) {
    console.error('Finalize draft error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to finalize draft' }
    }, 500);
  }
});

export default draft;

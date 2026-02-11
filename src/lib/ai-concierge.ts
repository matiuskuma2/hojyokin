/**
 * AI コンシェルジュ - 補助金申請アドバイザー
 * 
 * Phase 19: 壁打ちチャットをAIコンシェルジュ化
 * Phase 19-QA: 品質改善 - システムプロンプト強化・企業情報活用・電子申請分岐
 * 
 * 機能:
 * - 企業情報(company_profile含む) + 補助金情報を踏まえた文脈的な回答生成
 * - 会話履歴を保持したマルチターン対話
 * - 構造化質問（Phase 1）+ 自由会話（Phase 2）のハイブリッド
 * - 電子申請/紙申請に応じたアドバイス切り替え
 * - フォールバック応答の高品質化
 */

import type { Env } from '../types';
import type { NormalizedSubsidyDetail } from './ssot';

// =====================================================
// 型定義
// =====================================================

export interface ConversationContext {
  /** 会話モード: structured（構造化質問）, free（自由会話） */
  mode: 'structured' | 'free';
  /** 補助金の正規化情報 */
  subsidy: NormalizedSubsidyDetail | null;
  /** 企業情報 */
  company: CompanyContext;
  /** これまでに収集したfacts */
  facts: Record<string, string>;
  /** 会話履歴（最新N件） */
  history: ChatMessage[];
  /** 未回答の構造化質問 */
  remainingQuestions: StructuredQuestion[];
  /** セッションの状態 */
  sessionStatus: 'collecting' | 'consulting' | 'completed';
}

export interface CompanyContext {
  id: string;
  name: string;
  prefecture: string;
  city?: string;
  industry_major: string;
  employee_count: number;
  capital?: number;
  annual_revenue?: number;
  established_date?: string;
  /** company_profile の追加情報 */
  profile?: {
    corp_type?: string;        // 法人格
    founding_year?: number;    // 創業年
    business_summary?: string; // 事業概要
    main_products?: string;    // 主要製品・サービス
    main_customers?: string;   // 主要顧客層
    competitive_advantage?: string; // 強み
    is_profitable?: boolean;   // 黒字か
    past_subsidies?: string[];  // 過去の補助金歴
    certifications?: string[]; // 認証
    [key: string]: any;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StructuredQuestion {
  key: string;
  label: string;
  input_type: 'boolean' | 'number' | 'text' | 'select';
  options?: string[];
  source: string;
  priority: number;
}

export interface AIConciergeResponse {
  content: string;
  /** 回答で使った参照情報 */
  references?: string[];
  /** ユーザーに提案するフォローアップ質問 */
  suggested_questions?: string[];
  /** AI使用トークン数 */
  tokens_used?: { prompt: number; completion: number };
  /** mode切り替え指示 */
  mode_change?: 'free' | null;
}

// =====================================================
// システムプロンプト生成
// =====================================================

function buildSystemPrompt(ctx: ConversationContext): string {
  const subsidyInfo = ctx.subsidy ? formatSubsidyInfo(ctx.subsidy) : '補助金情報なし';
  const companyInfo = formatCompanyInfo(ctx.company);
  const factsInfo = formatFacts(ctx.facts);
  
  if (ctx.mode === 'structured') {
    return `あなたは補助金申請の専門AIコンシェルジュ「ホジョラク」です。

## あなたの役割
企業の補助金申請を支援する専門アドバイザーとして、親身で分かりやすい対話を行います。
決まった質問を淡々と聞くのではなく、相談相手として自然な会話で情報を引き出してください。

## 現在のフェーズ: 情報収集
以下の質問への回答を自然な会話の中で収集してください。ただし:
- 一度に1つの質問を聞く（複数質問の羅列禁止）
- 前の回答に対する短いリアクション（共感・補足情報）を入れてから次を聞く
- 企業や補助金の状況に合わせて質問の聞き方をカスタマイズ
- ユーザーが関連する質問や相談をしたら、柔軟に対応してから本題に戻る

## 回答の適切性チェック（重要）
ユーザーの回答が質問の形式に合っているか必ずチェックしてください:
- 数値を聞いている質問に「はい」「いいえ」と答えた場合 → 「具体的な数字で教えてもらえますか？例えば〇〇のように」と優しく聞き直す
- 具体的な内容を聞いている質問に「はい」とだけ答えた場合 → 「もう少し具体的に教えていただけますか？」と促す
- ユーザーを責めない。常に丁寧に、回答例を示しながら聞き直す

## 応答スタイル（禁止パターン）
以下の機械的な応答パターンは絶対に使わないでください:
× 「ありがとうございます。次の質問です。」
× 「承知しました。次にお聞きします。」
× 回答内容に一切触れず次の質問に移る

代わりに:
○ ユーザーの回答の具体的な内容に触れる（「IT化推進をお考えなんですね」）
○ 補足情報やアドバイスを一言添える（「その投資額なら○○枠が適用できそうですね」）
○ 自然な接続語で次の質問に移る

## 対象企業
${companyInfo}

## 対象補助金
${subsidyInfo}

## これまでに収集した情報
${factsInfo || 'まだ収集した情報はありません'}

## 回答ルール
1. 日本語で回答
2. 専門用語は噛み砕いて説明
3. 企業の状況（業種・規模・地域）に合わせたアドバイスを含める
4. 500文字以内で簡潔に
5. **重要**: 回答の最後に必ず、次に聞くべき質問を1つ含める
6. マークダウン書式は使わない（プレーンテキスト）
7. 嘘やでっち上げは絶対にしない。分からないことは「確認が必要です」と伝える`;
  }
  
  // 電子申請の注意事項
  const electronicNote = ctx.subsidy?.electronic_application?.is_electronic_application
    ? `\n\n## 電子申請について\nこの補助金は「${ctx.subsidy.electronic_application.portal_name || '電子申請システム'}」での申請が必要です。\n- 申請書類はシステム上で作成・提出します\n- 壁打ちでは申請前の準備（要件確認・情報整理）をサポート\n${ctx.subsidy.electronic_application.portal_url ? '- 申請先: ' + ctx.subsidy.electronic_application.portal_url : ''}`
    : '';

  // Free mode (コンシェルジュ相談モード)
  return `あなたは補助金申請の専門AIコンシェルジュ「ホジョラク」です。

## あなたの役割
企業の補助金申請に関するあらゆる相談に応じる専門アドバイザーです。
- 補助金の要件・手続きについて分かりやすく解説
- 企業の状況に合わせた申請戦略のアドバイス
- 申請書類の書き方のヒント
- スケジュール管理のサポート
- 不安や疑問への丁寧な回答
- 加点項目の取得戦略

## 対象企業
${companyInfo}

## 対象補助金
${subsidyInfo}${electronicNote}

## これまでの収集情報
${factsInfo || 'まだ収集した情報はありません'}

## 回答ルール
1. 日本語で回答
2. 専門用語は噛み砕いて説明し、必要に応じて具体例を添える
3. 企業の状況（${ctx.company.industry_major}、従業員${ctx.company.employee_count}名、${ctx.company.prefecture}）に合わせた具体的なアドバイス
4. 800文字以内で丁寧だが簡潔に
5. 回答の最後に、関連する相談ポイントや次のアクションを1-2つ提案
6. マークダウン書式は使わない（プレーンテキスト）
7. 嘘やでっち上げは絶対にしない。分からないことは「公式サイトで最新情報をご確認ください」と案内
8. ユーザーに寄り添い、「一緒に進めましょう」という姿勢を忘れない
9. 企業の事業概要・強み・課題がある場合は、それを踏まえた具体的なアドバイスを行う
10. 申請書のストーリーライン（現状→課題→取組→効果）を意識した助言を行う`;
}

function formatSubsidyInfo(s: NormalizedSubsidyDetail): string {
  const parts: string[] = [];
  
  parts.push(`名称: ${s.display.title}`);
  
  if (s.display.subsidy_max_limit) {
    const v = s.display.subsidy_max_limit;
    parts.push(`補助上限: ${v >= 100000000 ? (v / 100000000).toFixed(1) + '億円' : v >= 10000 ? Math.floor(v / 10000) + '万円' : v + '円'}`);
  }
  
  if (s.display.subsidy_rate_text) {
    parts.push(`補助率: ${s.display.subsidy_rate_text}`);
  }
  
  if (s.acceptance.acceptance_end) {
    parts.push(`申請締切: ${s.acceptance.acceptance_end}`);
  }
  
  if (s.overview.summary) {
    parts.push(`概要: ${s.overview.summary.substring(0, 300)}`);
  }
  
  if (s.overview.purpose) {
    parts.push(`目的: ${s.overview.purpose}`);
  }
  
  // 申請要件
  if (s.content.eligibility_rules.length > 0) {
    const rules = s.content.eligibility_rules
      .slice(0, 5)
      .map(r => `- ${r.rule_text}`)
      .join('\n');
    parts.push(`主な申請要件:\n${rules}`);
  }
  
  // 対象経費
  if (s.content.eligible_expenses.categories.length > 0) {
    const cats = s.content.eligible_expenses.categories
      .slice(0, 5)
      .map(c => `- ${c.name}${c.description ? ': ' + c.description : ''}`)
      .join('\n');
    parts.push(`対象経費:\n${cats}`);
  }
  
  // 必要書類
  if (s.content.required_documents.length > 0) {
    const docs = s.content.required_documents
      .filter(d => d.required_level === 'required')
      .slice(0, 5)
      .map(d => `- ${d.name}`)
      .join('\n');
    if (docs) parts.push(`主な必要書類:\n${docs}`);
  }
  
  // 電子申請
  if (s.electronic_application.is_electronic_application) {
    parts.push(`電子申請: ${s.electronic_application.portal_name || '電子申請システム'} (${s.electronic_application.portal_url || 'URL不明'})`);
  }
  
  // 加点項目
  if (s.content.bonus_points.length > 0) {
    const bonus = s.content.bonus_points
      .slice(0, 3)
      .map(b => `- ${b.name}${b.description ? ': ' + b.description : ''}`)
      .join('\n');
    parts.push(`加点項目:\n${bonus}`);
  }
  
  return parts.join('\n');
}

function formatCompanyInfo(c: CompanyContext): string {
  const parts = [
    `会社名: ${c.name}`,
    `所在地: ${c.prefecture}${c.city || ''}`,
    `業種: ${c.industry_major}`,
    `従業員数: ${c.employee_count}名`,
  ];
  
  if (c.capital) {
    parts.push(`資本金: ${c.capital >= 10000 ? Math.floor(c.capital / 10000) + '万円' : c.capital + '円'}`);
  }
  if (c.annual_revenue) {
    parts.push(`年商: ${c.annual_revenue >= 100000000 ? (c.annual_revenue / 100000000).toFixed(1) + '億円' : c.annual_revenue >= 10000 ? Math.floor(c.annual_revenue / 10000) + '万円' : c.annual_revenue + '円'}`);
  }
  if (c.established_date) {
    parts.push(`設立: ${c.established_date}`);
  }
  
  // Phase 19-QA: company_profile の詳細情報をAIに提供
  if (c.profile) {
    if (c.profile.corp_type) parts.push(`法人格: ${c.profile.corp_type}`);
    if (c.profile.founding_year) parts.push(`創業年: ${c.profile.founding_year}年`);
    if (c.profile.business_summary) parts.push(`事業概要: ${c.profile.business_summary}`);
    if (c.profile.main_products) parts.push(`主要製品・サービス: ${c.profile.main_products}`);
    if (c.profile.main_customers) parts.push(`主要顧客: ${c.profile.main_customers}`);
    if (c.profile.competitive_advantage) parts.push(`強み: ${c.profile.competitive_advantage}`);
    if (c.profile.is_profitable != null) parts.push(`黒字: ${c.profile.is_profitable ? 'はい' : 'いいえ'}`);
    if (c.profile.past_subsidies && c.profile.past_subsidies.length > 0) {
      parts.push(`過去の補助金: ${c.profile.past_subsidies.join(', ')}`);
    }
    if (c.profile.certifications && c.profile.certifications.length > 0) {
      parts.push(`取得認証: ${c.profile.certifications.join(', ')}`);
    }
  }
  
  return parts.join('\n');
}

function formatFacts(facts: Record<string, string>): string {
  const entries = Object.entries(facts);
  if (entries.length === 0) return '';
  
  return entries.map(([key, value]) => {
    // キーを分かりやすい日本語に変換
    const label = FACT_KEY_LABELS[key] || key;
    const displayValue = value === 'true' ? 'はい' : value === 'false' ? 'いいえ' : value;
    return `- ${label}: ${displayValue}`;
  }).join('\n');
}

const FACT_KEY_LABELS: Record<string, string> = {
  'past_subsidy_same_type': '同種補助金の受給歴（過去3年）',
  'tax_arrears': '税金滞納の有無',
  'employee_count': '従業員数',
  'annual_revenue': '年商',
  'business_purpose': '補助金で実施したい事業',
  'expected_effect': '期待する効果',
  'has_business_plan': '事業計画書の有無',
  'has_gbiz_id': 'GビズIDプライムの取得状況',
  'is_wage_raise_planned': '賃上げ予定',
  'is_invoice_registered': 'インボイス登録状況',
  'capital': '資本金',
  'founding_year': '創業年',
  'corp_type': '法人格',
  'has_keiei_kakushin': '経営革新計画の承認状況',
  'has_jigyou_keizoku': '事業継続力強化計画の認定状況',
  'investment_purpose': '投資の目的',
  'investment_amount': '投資予定額',
  'current_challenge': '現在の経営課題',
  'desired_timeline': '申請希望時期',
};

// =====================================================
// AI回答生成（OpenAI互換API呼び出し）
// =====================================================

export async function generateAIResponse(
  env: Env,
  ctx: ConversationContext,
  userMessage: string,
): Promise<AIConciergeResponse> {
  const apiKey = env.OPENAI_API_KEY;
  const baseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  if (!apiKey) {
    // APIキーがない場合はフォールバック応答
    return generateFallbackResponse(ctx, userMessage);
  }
  
  const systemPrompt = buildSystemPrompt(ctx);
  
  // 会話履歴を構築（最新10件に制限）
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...ctx.history.slice(-10),
    { role: 'user', content: userMessage },
  ];
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Concierge] OpenAI API error: ${response.status}`, errorText);
      return generateFallbackResponse(ctx, userMessage);
    }
    
    const data = await response.json() as any;
    const assistantContent = data.choices?.[0]?.message?.content || '';
    const usage = data.usage;
    
    // suggested_questions を回答文から抽出
    const suggestedQuestions = extractSuggestedQuestions(assistantContent);
    
    return {
      content: assistantContent,
      tokens_used: usage ? {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
      } : undefined,
      suggested_questions: suggestedQuestions,
    };
    
  } catch (error) {
    console.error('[AI Concierge] API call failed:', error);
    return generateFallbackResponse(ctx, userMessage);
  }
}

/**
 * ストリーミング対応のAI回答生成
 */
export async function generateAIResponseStream(
  env: Env,
  ctx: ConversationContext,
  userMessage: string,
): Promise<ReadableStream | null> {
  const apiKey = env.OPENAI_API_KEY;
  const baseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  if (!apiKey) return null;
  
  const systemPrompt = buildSystemPrompt(ctx);
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...ctx.history.slice(-10),
    { role: 'user', content: userMessage },
  ];
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      }),
    });
    
    if (!response.ok || !response.body) {
      console.error(`[AI Concierge] Stream error: ${response.status}`);
      return null;
    }
    
    return response.body;
    
  } catch (error) {
    console.error('[AI Concierge] Stream call failed:', error);
    return null;
  }
}

// =====================================================
// フォールバック応答（APIキーなし時）
// =====================================================

function generateFallbackResponse(
  ctx: ConversationContext,
  userMessage: string,
): AIConciergeResponse {
  const lowerMsg = userMessage.toLowerCase();
  const subsidyTitle = ctx.subsidy?.display.title || '選択された補助金';
  const companyName = ctx.company.name;
  
  // 挨拶系
  if (lowerMsg.match(/^(こんにちは|はじめまして|よろしく|お世話|hello)/)) {
    return {
      content: `${companyName}様、こんにちは！「${subsidyTitle}」の申請に向けて、一緒に準備を進めていきましょう。\n\nまずは申請要件の確認から始めましょうか？何かご不明な点があれば、いつでもお気軽にご質問ください。`,
      suggested_questions: [
        'この補助金に申請できる条件を教えてください',
        '申請に必要な書類は何ですか？',
        '申請のスケジュールを知りたいです',
      ],
    };
  }
  
  // 要件・条件について
  if (lowerMsg.match(/(要件|条件|対象|申請できる|資格)/)) {
    const rules = ctx.subsidy?.content.eligibility_rules || [];
    if (rules.length > 0) {
      const ruleTexts = rules.slice(0, 3).map(r => `・${r.rule_text}`).join('\n');
      return {
        content: `「${subsidyTitle}」の主な申請要件をお伝えします。\n\n${ruleTexts}\n\n${companyName}様は${ctx.company.industry_major}で従業員${ctx.company.employee_count}名とのことですので、基本的な要件は満たしている可能性が高いです。\n\n具体的に気になる要件はありますか？`,
        suggested_questions: ['補助率はどのくらいですか？', '必要な書類について教えてください'],
      };
    }
    return {
      content: `「${subsidyTitle}」の申請要件について、詳細情報の取得中です。公式サイトで最新の要件をご確認いただくのが確実です。\n\n他にご質問があればお気軽にどうぞ。`,
    };
  }
  
  // 書類について
  if (lowerMsg.match(/(書類|必要|準備|用意|提出)/)) {
    const docs = ctx.subsidy?.content.required_documents || [];
    if (docs.length > 0) {
      const requiredDocs = docs
        .filter(d => d.required_level === 'required')
        .slice(0, 5)
        .map(d => `・${d.name}`)
        .join('\n');
      return {
        content: `申請に必要な主な書類です。\n\n${requiredDocs}\n\n書類の準備は早めに始めることをおすすめします。特に事業計画書は時間がかかることが多いです。\n\n準備状況はいかがですか？`,
      };
    }
    return {
      content: '必要書類の詳細は公式の公募要領をご確認ください。一般的に補助金申請では事業計画書、決算書類、見積書などが必要になります。\n\n具体的な書類名が分かったら、準備のアドバイスもできますよ。',
    };
  }
  
  // 金額・補助率について
  if (lowerMsg.match(/(金額|補助率|いくら|上限|下限|率)/)) {
    const maxLimit = ctx.subsidy?.display.subsidy_max_limit;
    const rate = ctx.subsidy?.display.subsidy_rate_text;
    let content = `「${subsidyTitle}」の金額情報です。\n\n`;
    if (maxLimit) {
      content += `補助上限: ${maxLimit >= 100000000 ? (maxLimit / 100000000).toFixed(1) + '億円' : maxLimit >= 10000 ? Math.floor(maxLimit / 10000) + '万円' : maxLimit + '円'}\n`;
    }
    if (rate) {
      content += `補助率: ${rate}\n`;
    }
    content += `\n活用をお考えの投資額はどのくらいですか？`;
    return { content };
  }
  
  // 締切・スケジュール
  if (lowerMsg.match(/(締切|いつまで|スケジュール|期限|期日)/)) {
    const deadline = ctx.subsidy?.acceptance.acceptance_end;
    if (deadline) {
      return {
        content: `申請締切は ${deadline} です。\n\n申請準備には通常2-4週間ほどかかりますので、逆算してスケジュールを組みましょう。\n\n現在の準備状況はいかがですか？`,
      };
    }
    return {
      content: '締切日の詳細は公式サイトでご確認ください。補助金の申請準備には通常2-4週間ほどかかりますので、余裕を持って準備を始めることをおすすめします。',
    };
  }
  
  // 電子申請について
  if (lowerMsg.match(/(電子申請|gbiz|gビズ|jgrants|ポータル|オンライン申請)/)) {
    const ea = ctx.subsidy?.electronic_application;
    if (ea?.is_electronic_application) {
      return {
        content: `この補助金は「${ea.portal_name || '電子申請システム'}」での申請が必要です。\n\n申請の流れ：\n1. GビズIDプライムアカウントを取得（未取得の場合、2〜3週間かかります）\n2. ${ea.portal_name || '電子申請システム'}にログイン\n3. 申請書類をシステム上で作成・入力\n4. 添付書類をアップロードして提出\n\n${ea.portal_url ? '申請先URL: ' + ea.portal_url + '\n\n' : ''}GビズIDの取得がまだの方は、早めの手続きをおすすめします。`,
        suggested_questions: [
          'GビズIDの取得方法を教えてください',
          '添付書類はどうすればいいですか？',
        ],
      };
    }
    return {
      content: 'この補助金の申請方法の詳細は公式サイトでご確認ください。多くの補助金では電子申請（GビズIDプライムが必要）が求められます。\n\nGビズIDの取得には2〜3週間かかるため、早めに準備を始めることをおすすめします。',
    };
  }
  
  // 加点項目について
  if (lowerMsg.match(/(加点|ポイント|採択率|有利|審査|配点)/)) {
    const bonus = ctx.subsidy?.content.bonus_points || [];
    if (bonus.length > 0) {
      const bonusTexts = bonus.slice(0, 5).map(b => `・${b.name}${b.description ? ': ' + b.description : ''}`).join('\n');
      return {
        content: `「${subsidyTitle}」の主な加点項目です。\n\n${bonusTexts}\n\n${companyName}様の状況に合わせて、取得可能な加点項目を確認しましょう。加点を多く取ることで採択率が大幅に向上します。`,
        suggested_questions: ['加点項目の具体的な取得方法を教えてください'],
      };
    }
    return {
      content: '加点項目の詳細は公募要領をご確認ください。一般的に、賃上げ計画、経営革新計画の承認、DX推進などが加点対象になることが多いです。\n\n具体的な加点項目がわかれば、取得のアドバイスもできます。',
    };
  }

  // 事業計画について
  if (lowerMsg.match(/(事業計画|計画書|ストーリー|採択される|書き方|コツ)/)) {
    const purpose = ctx.subsidy?.overview.purpose || '';
    return {
      content: `事業計画書は補助金申請の核心です。採択されるためのポイントをお伝えします。\n\n基本構成（ストーリーライン）：\n1. 現状分析: ${companyName}様の${ctx.company.industry_major}での現在の課題\n2. 課題の特定: なぜこの投資が必要なのか\n3. 取り組み内容: 補助金で何をするのか具体的に\n4. 期待効果: 数値目標（売上○%増、生産性○%向上など）\n${purpose ? '\nこの補助金の目的: ' + purpose.substring(0, 100) : ''}\n\n審査員に「この企業を支援すれば効果がある」と思わせることが重要です。具体的にどんな事業をお考えですか？`,
      suggested_questions: [
        '数値目標の立て方を教えてください',
        '審査員はどこを見ていますか？',
      ],
    };
  }

  // デフォルト応答
  return {
    content: `ご質問ありがとうございます。「${subsidyTitle}」への申請に関して、以下のようなことをサポートできます。\n\n・申請要件の確認と自社適合チェック\n・必要書類の整理と準備のコツ\n・申請スケジュールの管理\n・事業計画書の方向性と書き方\n・加点項目の取得戦略\n・電子申請の手続き\n\n何についてお聞きになりたいですか？`,
    suggested_questions: [
      'この補助金の申請要件を教えてください',
      '必要な書類は何ですか？',
      '採択率を上げるコツを教えてください',
      '事業計画書の書き方を教えてください',
    ],
  };
}

// =====================================================
// ヘルパー
// =====================================================

function extractSuggestedQuestions(content: string): string[] {
  // AIの回答から提案質問を抽出（簡易的な方法）
  const questions: string[] = [];
  
  // 「〜ですか？」「〜でしょうか？」形式を抽出
  const matches = content.match(/[^\n。！]*(?:ですか|でしょうか|ましょうか|いかがですか)[？?]/g);
  if (matches) {
    questions.push(...matches.slice(-2));  // 最後の2つ
  }
  
  return questions;
}

/**
 * 構造化質問への回答をAIが自然に促すプロンプトを生成
 */
export function buildStructuredQuestionPrompt(
  question: StructuredQuestion,
  ctx: ConversationContext,
): string {
  const q = question;
  
  // 質問を自然な会話形式に変換するためのコンテキスト
  return `次はこの質問の回答を自然な会話の中で引き出してください: 「${q.label}」
回答タイプ: ${q.input_type}${q.options ? ` (選択肢: ${q.options.join(', ')})` : ''}
この質問に対するユーザーの回答を確認したら、簡単な反応（共感や補足情報）を入れてから、もし未回答の質問が残っていれば次に進んでください。`;
}

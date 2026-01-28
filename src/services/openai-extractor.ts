/**
 * OpenAI PDF Content Extractor
 * 
 * PDF テキストから補助金申請に必要な構造化データを抽出
 */

export interface ExtractedSubsidyData {
  application_requirements?: string[];  // 申請要件
  eligible_expenses?: string[];          // 対象経費
  required_documents?: string[];         // 必要書類
  deadline?: string;                     // 締切
  target_businesses?: string[];          // 対象事業者
  subsidy_rate_detail?: string;          // 補助率詳細
  subsidy_max_detail?: string;           // 上限額詳細
  application_flow?: string[];           // 申請の流れ
  notes?: string[];                      // 注意事項
}

const EXTRACTION_PROMPT = `あなたは補助金・助成金の公募要領を解析する専門家です。
以下のPDFテキストから、補助金申請に必要な情報を抽出してJSON形式で出力してください。

【最重要】application_requirements（申請要件）の抽出を最優先してください。
以下のような情報を申請要件として抽出してください：
- 中小企業者であること、小規模事業者であること
- 従業員数の制限（例：常時使用する従業員が300人以下）
- 資本金の制限（例：資本金が3億円以下）
- 業種の制限（例：製造業、小売業等）
- 所在地の制限（例：東京都内に事業所を有すること）
- 経営状況（例：青色申告を行っていること、税務申告を行っていること）
- その他の資格要件

出力形式:
{
  "application_requirements": ["申請要件1", "申請要件2", ...],
  "eligible_expenses": ["対象経費1", "対象経費2", ...],
  "required_documents": ["必要書類1", "必要書類2", ...],
  "deadline": "申請締切（例: 2026年3月31日）",
  "target_businesses": ["対象事業者1", "対象事業者2", ...],
  "subsidy_rate_detail": "補助率の詳細説明",
  "subsidy_max_detail": "補助上限額の詳細説明",
  "application_flow": ["申請の流れ1", "申請の流れ2", ...],
  "notes": ["注意事項1", "注意事項2", ...]
}

注意:
- application_requirementsは必ず抽出を試みてください（最重要項目）
- 「対象者」「申請資格」「補助対象者」「交付の対象」などの記載も申請要件として扱ってください
- 情報が見つからない項目はnullまたは空配列で返してください
- 配列の各要素は簡潔に（1要素80文字以内推奨）
- 申請要件は「〜であること」「〜を満たすこと」「〜に該当すること」の形式で
- 対象経費は具体的な費目名で
- 必要書類は書類名のみ（説明不要）

PDFテキスト:
`;

/**
 * OpenAI 抽出結果 + 使用量情報
 */
export interface ExtractedResult {
  data: ExtractedSubsidyData | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  success: boolean;
  error?: string;
}

/**
 * OpenAI API を使って PDF テキストから構造化データを抽出
 * v2: usage情報を含むオブジェクトを返す
 */
export async function extractSubsidyDataFromPdf(
  pdfText: string,
  openaiApiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<ExtractedSubsidyData | null>;
export async function extractSubsidyDataFromPdf(
  pdfText: string,
  openaiApiKey: string,
  model: string,
  returnUsage: true
): Promise<ExtractedResult>;
export async function extractSubsidyDataFromPdf(
  pdfText: string,
  openaiApiKey: string,
  model: string = 'gpt-4o-mini',
  returnUsage: boolean = false
): Promise<ExtractedSubsidyData | null | ExtractedResult> {
  if (!openaiApiKey) {
    console.warn('[OpenAI] API key not configured');
    return returnUsage ? { data: null, model, success: false, error: 'API key not configured' } : null;
  }

  if (!pdfText || pdfText.length < 100) {
    console.warn('[OpenAI] PDF text too short');
    return returnUsage ? { data: null, model, success: false, error: 'PDF text too short' } : null;
  }

  // テキストを最大8000文字に制限（トークン節約）
  const truncatedText = pdfText.substring(0, 8000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'あなたは補助金・助成金の専門家です。正確で簡潔な情報抽出を行います。'
          },
          {
            role: 'user',
            content: EXTRACTION_PROMPT + truncatedText
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error(`[OpenAI] API error: ${response.status}`);
      return returnUsage ? { data: null, model, success: false, error: `API error: ${response.status}` } : null;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('[OpenAI] Empty response');
      return returnUsage ? { data: null, model, success: false, error: 'Empty response' } : null;
    }

    const extracted = JSON.parse(content) as ExtractedSubsidyData;
    
    // 使用量をログ
    const usage = data.usage;
    if (usage) {
      console.log(`[OpenAI] Tokens used: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`);
    }

    if (returnUsage) {
      return {
        data: extracted,
        usage: usage ? {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        } : undefined,
        model,
        success: true,
      };
    }

    return extracted;
  } catch (error) {
    console.error('[OpenAI] Extraction error:', error);
    return returnUsage ? { data: null, model, success: false, error: error instanceof Error ? error.message : 'Unknown error' } : null;
  }
}

/**
 * 抽出結果を detail_json にマージ
 * v2: 空上書き禁止 - 既存値がある場合は新しい値が空なら上書きしない
 */
export function mergeExtractedData(
  existingDetailJson: Record<string, any>,
  extracted: ExtractedSubsidyData
): Record<string, any> {
  const merged = { ...existingDetailJson };

  // ヘルパー: 既存値が有効かチェック
  const hasValidValue = (val: any): boolean => {
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
  };

  // 配列フィールド（v2: 空上書き禁止）
  if (extracted.application_requirements?.length) {
    merged.application_requirements = extracted.application_requirements;
  }
  // 既存値がなく、抽出も空の場合は何もしない（既存値を維持）

  if (extracted.eligible_expenses?.length) {
    merged.eligible_expenses = extracted.eligible_expenses;
  }

  if (extracted.required_documents?.length) {
    merged.required_documents = extracted.required_documents;
  }

  if (extracted.target_businesses?.length) {
    // v2: 既存値がある場合はスキップ（target_businessesは上書きしない）
    if (!hasValidValue(merged.target_businesses)) {
      merged.target_businesses = extracted.target_businesses;
    }
  }

  if (extracted.application_flow?.length) {
    merged.application_flow = extracted.application_flow;
  }

  if (extracted.notes?.length) {
    merged.notes = extracted.notes;
  }

  // 文字列フィールド（v2: 空上書き禁止）
  if (extracted.deadline) {
    // deadlineは既存値がなければ設定
    if (!hasValidValue(merged.deadline) && !hasValidValue(merged.acceptance_end_datetime)) {
      merged.deadline = extracted.deadline;
    }
  }

  if (extracted.subsidy_rate_detail) {
    merged.subsidy_rate_detail = extracted.subsidy_rate_detail;
  }

  if (extracted.subsidy_max_detail) {
    merged.subsidy_max_detail = extracted.subsidy_max_detail;
  }

  // メタ情報
  merged.pdf_extracted_at = new Date().toISOString();
  merged.pdf_extraction_version = 'v2';

  return merged;
}

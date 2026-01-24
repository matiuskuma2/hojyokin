/**
 * required_forms 抽出 + 品質ゲート（A-2）
 * 
 * 凍結仕様:
 * - forms >= 2 かつ 各form.fields >= 3 を満たすまで"合格扱い"にしない
 * - 不合格は FORMS_NOT_FOUND または FIELDS_INSUFFICIENT として feed_failures へ
 */

import type { RequiredForm } from '../wall-chat-ready';
import type { PdfFailureReason } from './pdf-failures';

// --- 定数（凍結仕様）---
export const DEFAULT_MIN_FORMS = 2;
export const DEFAULT_MIN_FIELDS_PER_FORM = 3;
export const MAX_FORMS = 20;
export const MAX_FIELDS_PER_FORM = 30;

// --- 型定義 ---
export type FormsValidationResult = {
  valid: boolean;
  reason?: PdfFailureReason;
  message?: string;
  formsCount: number;
  fieldsTotal: number;
  formsWithInsufficientFields: number;
};

// --- パターン定義 ---
const FORM_NAME_PATTERNS = [
  // 様式第X号
  /様式\s*第?\s*(\d+)\s*号?/,
  // 様式X-Y
  /様式\s*(\d+(?:-\d+)?)/,
  // 別紙X
  /別紙\s*(\d+)/,
  // 別表X
  /別表\s*(\d+)/,
  // 第X号様式
  /第?\s*(\d+)\s*号?\s*様式/,
];

const FORM_CONTEXT_KEYWORDS = [
  '申請書', '計画書', '実績報告書', '交付申請書', '事業計画書',
  '収支予算書', '経費明細書', '添付書類', '提出書類', '様式',
  '別紙', '別表', '記載', '記入', '報告書', '届出書'
];

const FIELD_PATTERNS = [
  // 箇条書き（・●◯ など）
  /^[・●◯○▪▫]\s*(.+)$/,
  // 数字箇条書き
  /^[0-9]{1,2}[.)、]\s*(.+)$/,
  // 丸数字
  /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*(.+)$/,
  // 括弧数字
  /^[(（][0-9]{1,2}[)）]\s*(.+)$/,
  // アルファベット箇条書き
  /^[a-z][.)]\s*(.+)$/i,
];

const FIELD_KEYWORDS = [
  '事業者名', '代表者', '所在地', '住所', '電話番号', '連絡先', 'メール',
  '資本金', '従業員数', '設立', '業種', '事業内容', '売上',
  '申請金額', '補助金額', '助成金額', '経費', '費用', '金額',
  '事業名', '事業期間', '実施期間', '開始日', '終了日', '期間',
  '目的', '目標', '効果', '成果', '計画', '概要',
  '口座', '振込先', '金融機関', '口座番号',
  '添付', '書類', '提出', '必要書類',
];

// --- メイン抽出関数 ---
/**
 * テキストから required_forms を抽出
 */
export function extractRequiredFormsFromText(text: string): RequiredForm[] {
  const lines = normalizeLines(text);
  const forms: RequiredForm[] = [];
  const seenFormIds = new Set<string>();

  // Step 1: 様式っぽい行を探す
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 様式名パターンにマッチするか
    const formId = extractFormIdFromLine(line);
    const isFormLine = formId || isFormContextLine(line);
    
    if (!isFormLine) continue;
    
    // 重複チェック
    const dedupeKey = formId || normalizeFormName(line);
    if (seenFormIds.has(dedupeKey)) continue;
    
    // 以降の行からフィールドを抽出
    const windowLines = lines.slice(i + 1, i + 40);
    const fields = extractFieldsFromWindow(windowLines);
    
    if (fields.length >= 1) { // 最低1フィールドあれば候補に入れる
      seenFormIds.add(dedupeKey);
      forms.push({
        name: line.slice(0, 100),
        form_id: formId || undefined,
        fields: fields.slice(0, MAX_FIELDS_PER_FORM),
      });
    }
    
    if (forms.length >= MAX_FORMS) break;
  }

  // Step 2: フォールバック - 様式が見つからない場合
  if (forms.length === 0) {
    const fallbackForms = extractFormsFromFallback(lines);
    forms.push(...fallbackForms);
  }

  return forms;
}

/**
 * 品質ゲート: forms と fields の数をチェック
 */
export function validateFormsResult(
  forms: RequiredForm[],
  minForms: number = DEFAULT_MIN_FORMS,
  minFieldsPerForm: number = DEFAULT_MIN_FIELDS_PER_FORM
): FormsValidationResult {
  const formsCount = forms.length;
  const fieldsTotal = forms.reduce((sum, f) => sum + (f.fields?.length || 0), 0);
  const formsWithInsufficientFields = forms.filter(
    f => (f.fields?.length || 0) < minFieldsPerForm
  ).length;
  
  // ケース1: フォームが足りない
  if (formsCount < minForms) {
    return {
      valid: false,
      reason: 'FORMS_NOT_FOUND',
      message: `Insufficient forms: ${formsCount} found, minimum ${minForms} required`,
      formsCount,
      fieldsTotal,
      formsWithInsufficientFields,
    };
  }
  
  // ケース2: フィールドが足りないフォームが多い
  const validForms = forms.filter(f => (f.fields?.length || 0) >= minFieldsPerForm);
  if (validForms.length < minForms) {
    return {
      valid: false,
      reason: 'FIELDS_INSUFFICIENT',
      message: `Insufficient fields: only ${validForms.length} forms have >= ${minFieldsPerForm} fields`,
      formsCount,
      fieldsTotal,
      formsWithInsufficientFields,
    };
  }
  
  // 合格
  return {
    valid: true,
    formsCount,
    fieldsTotal,
    formsWithInsufficientFields,
  };
}

// --- ヘルパー関数 ---

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractFormIdFromLine(line: string): string | null {
  for (const pattern of FORM_NAME_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // 正規化: "様式第1号" → "様式第1号"
      const raw = match[0].replace(/\s+/g, '');
      return raw;
    }
  }
  return null;
}

function isFormContextLine(line: string): boolean {
  // 短すぎる行は除外
  if (line.length < 4 || line.length > 100) return false;
  
  // 様式関連キーワードを含むか
  const hasKeyword = FORM_CONTEXT_KEYWORDS.some(kw => line.includes(kw));
  if (!hasKeyword) return false;
  
  // 「様式」「別紙」「申請書」などで始まるか、含むか
  const strongPatterns = [
    /^様式/, /^別紙/, /^別表/,
    /申請書/, /計画書/, /報告書/, /届出書/, /明細書/,
  ];
  
  return strongPatterns.some(p => p.test(line));
}

function normalizeFormName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .slice(0, 50);
}

function extractFieldsFromWindow(windowLines: string[]): string[] {
  const fields: string[] = [];
  
  // 「記載事項」「記入項目」などの見出しを探す
  let startIdx = 0;
  const headerIdx = windowLines.findIndex(l =>
    /(記載事項|記入事項|記載内容|記入内容|記載項目|入力項目|記入欄|入力欄|必要事項)/.test(l)
  );
  if (headerIdx >= 0) {
    startIdx = headerIdx + 1;
  }
  
  const targetLines = windowLines.slice(startIdx, startIdx + 25);
  
  for (const line of targetLines) {
    // 次のフォームが始まったら終了
    if (extractFormIdFromLine(line) || /^[【《\[]/.test(line)) {
      break;
    }
    
    // 箇条書きパターンにマッチ
    for (const pattern of FIELD_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const field = match[1].trim();
        if (isValidField(field)) {
          fields.push(field);
          break;
        }
      }
    }
    
    // パターンにマッチしなくても、フィールドキーワードを含む短い行は採用
    if (!fields.includes(line) && isFieldKeywordLine(line)) {
      fields.push(line);
    }
  }
  
  // 重複除去
  return Array.from(new Set(fields));
}

function isValidField(field: string): boolean {
  // 長さチェック
  if (field.length < 2 || field.length > 80) return false;
  
  // 明らかに項目名でないもの除外
  const excludePatterns = [
    /^https?:/, /^www\./, /^第\d+章/, /^参考/, /^注[)）]/,
    /^※/, /^\d{4}年/, /^\d{1,2}月\d{1,2}日/,
  ];
  
  return !excludePatterns.some(p => p.test(field));
}

function isFieldKeywordLine(line: string): boolean {
  // 短すぎる・長すぎる行は除外
  if (line.length < 3 || line.length > 60) return false;
  
  // フィールドキーワードを含むか
  return FIELD_KEYWORDS.some(kw => line.includes(kw));
}

function extractFormsFromFallback(lines: string[]): RequiredForm[] {
  const forms: RequiredForm[] = [];
  
  // 「申請書」「計画書」などを含む行を探す
  const docKeywords = ['申請書', '計画書', '報告書', '明細書', '予算書', '届出書'];
  
  for (const keyword of docKeywords) {
    const matchingLines = lines.filter(l => 
      l.includes(keyword) && l.length >= 5 && l.length <= 80
    );
    
    for (const line of matchingLines.slice(0, 3)) {
      const lineIdx = lines.indexOf(line);
      const windowLines = lines.slice(lineIdx + 1, lineIdx + 20);
      const fields = extractFieldsFromWindow(windowLines);
      
      if (fields.length >= 1) {
        forms.push({
          name: line,
          fields: fields.slice(0, MAX_FIELDS_PER_FORM),
        });
      }
      
      if (forms.length >= 5) break;
    }
    
    if (forms.length >= 5) break;
  }
  
  return forms;
}

/**
 * テスト用: サンプルテキストからフォームを抽出
 */
export function debugExtractForms(text: string): {
  forms: RequiredForm[];
  validation: FormsValidationResult;
  lines: string[];
} {
  const lines = normalizeLines(text);
  const forms = extractRequiredFormsFromText(text);
  const validation = validateFormsResult(forms);
  
  return { forms, validation, lines };
}

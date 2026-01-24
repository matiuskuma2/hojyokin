/**
 * PDFテキストから detail_json 用データを抽出
 * 
 * 提出書類の「様式名」と「記載項目」を抽出し、
 * 壁打ちチャットで「何を書けばいい？」に答えられるようにする。
 */

import type { RequiredForm, DetailJSON } from './wall-chat-ready';

/**
 * 抽出結果
 */
export type ExtractedDetail = {
  description?: string;
  application_requirements?: string[];
  eligible_expenses?: string[];
  required_documents?: string[];
  required_forms?: RequiredForm[];
};

/**
 * テキストを行に分割して正規化
 */
function linesOf(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * 特定の見出しから次の見出しまでのセクションを抽出
 */
function pickSection(
  lines: string[], 
  headerRe: RegExp, 
  stopRe?: RegExp, 
  maxLines = 250
): string[] {
  const idx = lines.findIndex(l => headerRe.test(l));
  if (idx < 0) return [];
  
  const out: string[] = [];
  for (let i = idx + 1; i < lines.length && out.length < maxLines; i++) {
    const l = lines[i];
    if (stopRe && stopRe.test(l)) break;
    // 次の大見出しっぽいもの
    if (/^第?\d+章|^【.+】$|^（?参考）?$/.test(l)) break;
    out.push(l);
  }
  return out;
}

/**
 * セクション内の箇条書きを抽出
 */
function bulletize(sectionLines: string[]): string[] {
  const bullets: string[] = [];
  
  for (const l of sectionLines) {
    // ・●①などの箇条書き
    const m = l.match(/^(?:[・●◯○]|[0-9]{1,2}[.)]|[①-⑳])\s*(.+)$/);
    if (m) bullets.push(m[1].trim());
  }
  
  // 箇条書きが取れない場合：短文を拾うフォールバック
  if (bullets.length === 0) {
    sectionLines
      .filter(l => l.length >= 4 && l.length <= 80)
      .slice(0, 12)
      .forEach(l => bullets.push(l));
  }
  
  return Array.from(new Set(bullets)).slice(0, 30);
}

/**
 * 様式名（例: 様式第1号、別紙1、様式1-2）を抽出
 */
function extractFormId(s: string): string | undefined {
  const m = s.match(/(様式\s*第?\s*\d+\s*号?|様式\s*\d+(?:-\d+)?|別紙\s*\d+|別表\s*\d+)/);
  return m ? m[1].replace(/\s+/g, '') : undefined;
}

/**
 * 「必要書類」セクションから書類名を抽出
 */
function extractRequiredDocuments(sectionLines: string[]): string[] {
  const docs: string[] = [];
  const docPatterns = [
    '申請書', '計画書', '報告書', '見積書', '契約書', '領収書',
    '登記事項', '決算書', '納税', '誓約書', '同意書', '台帳',
    '就業規則', 'カタログ', '許可証', '届出書', '証明書', '確認書',
    '明細書', '一覧表', '収支', '予算書', '概算書', '仕様書'
  ];
  
  for (const l of sectionLines) {
    if (docPatterns.some(p => l.includes(p))) {
      docs.push(l);
    }
  }
  
  return Array.from(new Set(docs)).slice(0, 40);
}

/**
 * 様式セクションから required_forms を構築
 * 
 * ルール: 「様式第X号」や「別紙X」を起点に、
 * 直後の「記載事項」っぽい行を fields として拾う
 */
function extractRequiredForms(lines: string[]): RequiredForm[] {
  const forms: RequiredForm[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // フォーム名っぽい行を検出
    const isFormLine = 
      (/(様式|別紙|別表)/.test(l) && /(申請|計画|実績|報告|添付|提出|交付)/.test(l)) ||
      /様式\s*第?\s*\d+/.test(l) ||
      /別紙\s*\d+/.test(l);
    
    if (!isFormLine) continue;
    
    const name = l;
    const formId = extractFormId(l);

    // 以降の数行で「記載項目」を探す
    const windowLines = lines.slice(i + 1, i + 30);

    // 記載項目の見出しが出たら、その後の箇条書きを拾う
    const fieldsSection = (() => {
      const idx = windowLines.findIndex(x => 
        /(記載事項|記入事項|記載内容|記入内容|記載項目|入力項目|記入欄|入力欄)/.test(x)
      );
      if (idx >= 0) return windowLines.slice(idx + 1, idx + 15);
      // 見出しが無い場合：直後の箇条書きを拾う
      return windowLines.slice(0, 10);
    })();

    const fields = bulletize(fieldsSection)
      .map(s => s.replace(/^\-+/, '').trim())
      .filter(s => s.length >= 2 && s.length <= 100);

    // 最低3項目以上取れたらフォームとして採用（凍結仕様）
    if (fields.length >= 3) {
      forms.push({
        name,
        form_id: formId,
        fields: fields.slice(0, 20),
      });
    }
  }

  // 重複除去（name + form_id）
  const seen = new Set<string>();
  return forms.filter(f => {
    const k = `${f.form_id || ''}:${f.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 20);
}

/**
 * フォールバック: 様式関連の行から最低限の情報を抽出
 */
function extractFormsFromFallback(lines: string[]): RequiredForm[] {
  const forms: RequiredForm[] = [];
  const formLines = lines.filter(l => 
    /(様式|別紙|別表)/.test(l) && l.length >= 5 && l.length <= 100
  );
  
  for (const line of formLines.slice(0, 10)) {
    const formId = extractFormId(line);
    // 直後の行から項目っぽいものを探す
    const lineIdx = lines.indexOf(line);
    const nextLines = lines.slice(lineIdx + 1, lineIdx + 15);
    
    const fields: string[] = [];
    for (const nl of nextLines) {
      // 項目っぽい短い行
      if (nl.length >= 3 && nl.length <= 50 && !/(様式|別紙|別表|第\d+章)/.test(nl)) {
        fields.push(nl);
      }
      if (fields.length >= 5) break;
    }
    
    if (fields.length >= 3) {
      forms.push({
        name: line,
        form_id: formId,
        fields: fields.slice(0, 10),
      });
    }
  }
  
  return forms.slice(0, 10);
}

/**
 * PDFテキストから detail_json 用の断片を抽出
 * 
 * @param pdfText - PDFから抽出したテキスト
 * @returns 抽出されたデータ
 */
export function extractDetailFromPdfText(pdfText: string): ExtractedDetail {
  const lines = linesOf(pdfText);

  // 概要（description）
  const descLines = pickSection(
    lines,
    /(事業概要|制度概要|目的|概要|趣旨)/,
    /(申請要件|対象者|補助対象|提出書類|必要書類|様式)/
  );
  const description = descLines.slice(0, 12).join(' ').slice(0, 800);

  // 申請要件
  const reqSection = pickSection(
    lines,
    /(申請要件|対象者|補助対象者|要件|対象事業者|申請資格)/,
    /(補助対象経費|対象経費|提出書類|必要書類|様式)/
  );
  const application_requirements = bulletize(reqSection);

  // 対象経費
  const expSection = pickSection(
    lines,
    /(補助対象経費|対象経費|助成対象経費|補助対象費用)/,
    /(提出書類|必要書類|様式|申請方法|手続)/
  );
  const eligible_expenses = bulletize(expSection);

  // 必要書類（リスト）
  const docsSection = pickSection(
    lines,
    /(提出書類|必要書類|添付書類|申請書類|提出資料)/,
    /(申請方法|手続|問い合わせ|FAQ|様式|記載)/
  );
  const required_documents = extractRequiredDocuments(docsSection);

  // 様式×記載項目
  let required_forms = extractRequiredForms(lines);
  
  // フォールバック: 正規表現で取れない場合
  if (required_forms.length === 0) {
    required_forms = extractFormsFromFallback(lines);
  }

  return {
    description: description && description.length >= 40 ? description : undefined,
    application_requirements: application_requirements.length > 0 ? application_requirements : undefined,
    eligible_expenses: eligible_expenses.length > 0 ? eligible_expenses : undefined,
    required_documents: required_documents.length > 0 ? required_documents : undefined,
    required_forms: required_forms.length > 0 ? required_forms : undefined,
  };
}

/**
 * 既存のdetail_jsonに抽出結果をマージ
 * 
 * 既存データを壊さない（"埋まってない所だけ"埋める）
 */
export function mergeDetailJson(existing: any, patch: ExtractedDetail): any {
  const out = { ...(existing || {}) };

  if (!out.description && patch.description) {
    out.description = patch.description;
  }
  if (!out.application_requirements?.length && patch.application_requirements) {
    out.application_requirements = patch.application_requirements;
  }
  if (!out.eligible_expenses?.length && patch.eligible_expenses) {
    out.eligible_expenses = patch.eligible_expenses;
  }
  if (!out.required_documents?.length && patch.required_documents) {
    out.required_documents = patch.required_documents;
  }
  // required_forms は強いので、既存が無いときだけ入れる（凍結仕様）
  if (!out.required_forms?.length && patch.required_forms) {
    out.required_forms = patch.required_forms;
  }

  return out;
}

/**
 * dedupe_key を生成
 * 
 * ルール（優先順）:
 * 1. 公式の制度IDがあれば source:<id>
 * 2. 無ければ source:<normalized_detail_url_hash>
 * 3. URLが不安定なら source:<title_norm>:<issuer_norm>:<prefecture_code>:<deadline_iso> をsha256
 */
export function buildDedupeKey(input: {
  sourceId: string;                 // 例: src-tokyo-kosha
  officialId?: string | null;
  detailUrl?: string | null;
  title: string;
  issuerName?: string | null;
  prefectureCode?: string | null;   // '13'
  deadlineISO?: string | null;      // '2026-03-31...'
}): string {
  // 簡易ハッシュ（Cloudflare Workers互換）
  const simpleHash = (s: string): string => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).slice(0, 16);
  };
  
  const norm = (s?: string): string => {
    return (s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[（(].*?[）)]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  };

  if (input.officialId) {
    return `${input.sourceId}:${input.officialId}`;
  }
  
  if (input.detailUrl) {
    return `${input.sourceId}:url:${simpleHash(input.detailUrl)}`;
  }

  const compound = [
    norm(input.title),
    norm(input.issuerName || ''),
    input.prefectureCode || '',
    (input.deadlineISO || '').slice(0, 10)
  ].join(':');

  return `${input.sourceId}:cmp:${simpleHash(compound)}`;
}

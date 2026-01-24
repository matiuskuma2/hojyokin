/**
 * WALL_CHAT_READY 判定関数
 * 
 * 壁打ちチャットが成立するために必要なデータが揃っているかを判定する。
 * 
 * 凍結仕様:
 * - SEARCHABLE: 検索結果に出してよい（2/5以上）
 * - WALL_CHAT_READY: 壁打ちが成立する（全必須項目あり）
 */

export type RequiredForm = {
  name: string;
  form_id?: string;
  fields: string[];
  source_page?: number;
  notes?: string;
};

export type DetailJSON = {
  id?: string;
  title?: string;
  overview?: string;
  description?: string;
  application_requirements?: string | string[];
  eligible_expenses?: string | string[];
  required_documents?: string | string[];
  required_forms?: RequiredForm[];
  acceptance_start_datetime?: string;
  acceptance_end_datetime?: string;
  deadline?: string;
  pdf_urls?: string[];
  pdfUrls?: string[];
  detailUrl?: string;
  related_url?: string;
  official_links?: { top?: string };
  attachments?: Array<{ name: string; url: string }>;
  // その他のフィールド
  [key: string]: any;
};

/**
 * 文字列または配列を正規化して配列に変換
 */
export function normStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map(x => String(x)).map(s => s.trim()).filter(Boolean);
  }
  if (typeof v === 'string') {
    return v.split(/\r?\n|・|•|●|-/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 文字列が最低限の長さを持つかチェック
 */
export function hasText(s?: any, minLen = 20): boolean {
  return typeof s === 'string' && s.trim().length >= minLen;
}

/**
 * SEARCHABLE判定（検索ゲート）
 * 
 * 凍結仕様: 以下5項目のうち2つ以上でSEARCHABLE
 * 1. overview または description
 * 2. eligible_expenses
 * 3. application_requirements
 * 4. pdf_urls / pdfUrls / attachments
 * 5. detailUrl / related_url / official_links.top
 */
export function isSearchable(detail: DetailJSON | null): boolean {
  if (!detail) return false;
  
  let score = 0;
  
  // 1. 概要
  if (hasText(detail.overview) || hasText(detail.description)) score++;
  
  // 2. 対象経費
  if (normStringArray(detail.eligible_expenses).length > 0) score++;
  
  // 3. 申請要件
  if (normStringArray(detail.application_requirements).length > 0) score++;
  
  // 4. PDF/添付ファイル
  const pdfUrls = detail.pdf_urls || detail.pdfUrls || [];
  const attachments = detail.attachments || [];
  if (pdfUrls.length > 0 || attachments.length > 0) score++;
  
  // 5. 公式URL
  const hasUrl = 
    !!detail.detailUrl || 
    !!detail.related_url || 
    (detail.official_links && !!detail.official_links.top);
  if (hasUrl) score++;
  
  return score >= 2;
}

/**
 * WALL_CHAT_READY判定結果
 */
export type WallChatReadyResult = {
  ready: boolean;
  missing: string[];
  score: number;      // 満たしている項目数
  maxScore: number;   // 最大項目数
};

/**
 * WALL_CHAT_READY判定（壁打ちゲート）
 * 
 * 凍結仕様 v2:
 * - 必須（5項目中5つ必要）: overview, application_requirements, eligible_expenses, required_documents, deadline
 * - 推奨（加点項目）: required_forms, attachments/pdfUrls
 * 
 * required_forms は段階的に追加していくため、v1では推奨扱い。
 */
export function isWallChatReady(detail: DetailJSON | null): WallChatReadyResult {
  if (!detail) {
    return { 
      ready: false, 
      missing: ['overview', 'application_requirements', 'eligible_expenses', 'required_documents', 'deadline'],
      score: 0,
      maxScore: 5
    };
  }
  
  const missing: string[] = [];
  let score = 0;
  const maxScore = 5; // 必須項目は5つ

  // 1. 概要（必須）
  if (hasText(detail.overview) || hasText(detail.description)) {
    score++;
  } else {
    missing.push('overview');
  }
  
  // 2. 申請要件（必須）
  if (normStringArray(detail.application_requirements).length > 0) {
    score++;
  } else {
    missing.push('application_requirements');
  }
  
  // 3. 対象経費（必須）
  if (normStringArray(detail.eligible_expenses).length > 0) {
    score++;
  } else {
    missing.push('eligible_expenses');
  }
  
  // 4. 必要書類リスト（必須）
  if (normStringArray(detail.required_documents).length > 0) {
    score++;
  } else {
    missing.push('required_documents');
  }
  
  // 5. 締切（必須）
  if (detail.acceptance_end_datetime || detail.deadline) {
    score++;
  } else {
    missing.push('deadline');
  }

  // Note: required_forms は現在は推奨扱い（必須から除外）
  // PDF抽出パイプラインが整備されたら必須化する
  // const forms = Array.isArray(detail.required_forms) ? detail.required_forms : [];
  // const hasForms = forms.length > 0 && forms.some(f => f?.name && Array.isArray(f.fields) && f.fields.length >= 3);

  return { 
    ready: missing.length === 0, 
    missing,
    score,
    maxScore
  };
}

/**
 * detail_json文字列からWALL_CHAT_READY判定
 */
export function checkWallChatReadyFromJson(detailJsonStr: string | null): WallChatReadyResult {
  if (!detailJsonStr || detailJsonStr === '{}' || detailJsonStr.length <= 2) {
    return isWallChatReady(null);
  }
  
  try {
    const detail = JSON.parse(detailJsonStr) as DetailJSON;
    return isWallChatReady(detail);
  } catch (e) {
    return isWallChatReady(null);
  }
}

/**
 * detail_json文字列からSEARCHABLE判定
 */
export function checkSearchableFromJson(detailJsonStr: string | null): boolean {
  if (!detailJsonStr || detailJsonStr === '{}' || detailJsonStr.length <= 2) {
    return false;
  }
  
  try {
    const detail = JSON.parse(detailJsonStr) as DetailJSON;
    return isSearchable(detail);
  } catch (e) {
    return false;
  }
}

/**
 * 不足項目を日本語で表示
 */
export function missingToJapanese(missing: string[]): string[] {
  const labels: Record<string, string> = {
    'overview': '概要・説明',
    'application_requirements': '申請要件',
    'eligible_expenses': '対象経費',
    'required_documents': '必要書類一覧',
    'deadline': '申請締切',
    'required_forms': '様式と記載項目（推奨）',
  };
  
  return missing.map(key => labels[key] || key);
}

/**
 * WALL_CHAT_READY の結果をデバッグ用に文字列化
 */
export function wallChatReadyToString(result: WallChatReadyResult): string {
  const status = result.ready ? '✅ READY' : '❌ NOT READY';
  const scoreStr = `${result.score}/${result.maxScore}`;
  const missingStr = result.missing.length > 0 
    ? `Missing: ${missingToJapanese(result.missing).join(', ')}`
    : 'All required fields present';
  return `${status} (${scoreStr}) - ${missingStr}`;
}

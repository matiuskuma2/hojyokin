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
  
  // === 金額・補助率情報 ===
  subsidy_max_limit?: number;         // 上限金額（円）
  subsidy_min_limit?: number;         // 下限金額（円）
  subsidy_rate?: string;              // 補助率（例: "2/3", "1/2"）
  subsidy_rate_detail?: string;       // 補助率詳細（例: "小規模事業者3/4"）
  
  // === 申請要件・対象 ===
  application_requirements?: string | string[];  // 申請要件
  eligible_expenses?: string | string[];         // 対象経費
  target_businesses?: string | string[];         // 対象事業
  target_applicants?: string | string[];         // 対象者（法人・個人・その他）
  target_region?: string | string[];             // 対象地域
  target_industry?: string | string[];           // 対象業種
  target_employee_count?: string;                // 対象従業員数
  
  // === 書類・様式 ===
  required_documents?: string | string[];        // 必要書類
  required_forms?: RequiredForm[];               // 様式一覧
  
  // === スケジュール ===
  acceptance_start_datetime?: string;            // 募集開始日時
  acceptance_end_datetime?: string;              // 募集終了日時
  deadline?: string;                             // 締切（テキスト）
  application_period?: string;                   // 申請期間（テキスト）
  
  // === URL・添付ファイル ===
  pdf_urls?: string[];
  pdfUrls?: string[];
  detailUrl?: string;
  related_url?: string;
  official_links?: { top?: string };
  attachments?: Array<{ name: string; url: string }>;
  
  // === 電子申請 ===
  is_electronic_application?: boolean;           // 電子申請フラグ
  electronic_application_url?: string;           // 電子申請システムURL
  electronic_application_system?: string;        // 電子申請システム名
  
  // === お問い合わせ先 ===
  contact?: {
    organization?: string;   // 組織名
    department?: string;     // 部署名
    phone?: string;          // 電話番号
    fax?: string;            // FAX番号
    email?: string;          // メールアドレス
    address?: string;        // 住所
    hours?: string;          // 受付時間
    url?: string;            // お問い合わせページURL
  };
  
  // === メタ情報 ===
  fiscal_year?: string;                          // 年度（例: "令和5年度"）
  implementing_agency?: string;                  // 実施機関
  funding_source?: string;                       // 財源（国・都道府県・市区町村）
  
  // === 拡張用 ===
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
  isElectronicApplication?: boolean;  // 電子申請フラグ (v3)
};

/**
 * WALL_CHAT_READY判定（壁打ちゲート）
 * 
 * 凍結仕様 v3:
 * - 必須（5項目中5つ必要）: overview, application_requirements, eligible_expenses, required_documents, deadline
 * - 推奨（加点項目）: required_forms, attachments/pdfUrls
 * 
 * 電子申請対応 (v3 新規):
 * - is_electronic_application = true の場合、必須スコア 3/5 以上で ready = true
 *   (電子申請システム側で書式を作成するため、required_forms 不要)
 */
export function isWallChatReady(detail: DetailJSON | null): WallChatReadyResult {
  if (!detail) {
    return { 
      ready: false, 
      missing: ['overview', 'application_requirements', 'eligible_expenses', 'required_documents', 'deadline'],
      score: 0,
      maxScore: 5,
      isElectronicApplication: false,
    };
  }
  
  const missing: string[] = [];
  let score = 0;
  const maxScore = 5; // 必須項目は5つ
  const isElectronicApplication = !!detail.is_electronic_application;

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

  // 電子申請システム対応 (v3):
  // 電子申請の場合、書式は電子申請システム側で作成するため、
  // required_forms がなくても、基本情報（3/5以上）が揃っていれば壁打ち可能
  let ready: boolean;
  if (isElectronicApplication) {
    // 電子申請の場合: 3/5以上でOK（概要、要件、経費があれば壁打ちできる）
    ready = score >= 3;
  } else {
    // 通常の場合: 5/5必須
    ready = missing.length === 0;
  }

  return { 
    ready, 
    missing,
    score,
    maxScore,
    isElectronicApplication,
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

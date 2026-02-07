/**
 * WALL_CHAT_READY 判定関数
 * 
 * 壁打ちチャットが成立するために必要なデータが揃っているかを判定する。
 * 
 * 凍結仕様:
 * - SEARCHABLE: 検索結果に出してよい（2/5以上）
 * - WALL_CHAT_READY: 壁打ちが成立する（全必須項目あり）
 * - EXCLUDED: 壁打ち対象外（構造的に壁打ち不可能）
 *
 * 除外ルール（v4）:
 * - 交付申請系: 採択後の手続き用（公募ではない）
 * - 宣言/認定系: 認定プログラム（補助金ではない、eligible_expensesが存在しない）
 * - ガイドライン系: ロゴ使用規約などの付随文書
 * - 練習用: テスト・練習用の申請
 */

// =====================================================
// 壁打ち対象外（EXCLUDED）判定
// =====================================================

/**
 * 壁打ち対象外の除外理由コード
 */
export type ExclusionReasonCode =
  | 'KOFU_SHINSEI'           // 交付申請系（採択後の手続き）
  | 'SENGEN_NINTEI'          // 宣言/認定系（補助金ではない）
  | 'GUIDELINE_ONLY'         // ガイドライン/ロゴ使用規約のみ
  | 'RENSHU_TEST'            // 練習・テスト用
  | 'NO_ELIGIBLE_EXPENSES';  // 構造的に対象経費が存在しない

/**
 * 除外判定結果
 */
export type ExclusionResult = {
  excluded: boolean;
  reason_code?: ExclusionReasonCode;
  reason_ja?: string;
  matched_pattern?: string;
};

/**
 * 除外パターン定義
 */
const EXCLUSION_PATTERNS: Array<{
  pattern: RegExp;
  code: ExclusionReasonCode;
  reason_ja: string;
  titleOnly?: boolean;  // trueの場合、タイトルのみでチェック（overviewは除外判定に使わない）
}> = [
  // 交付申請系（採択後の手続き）— タイトルのみで判定
  // ※ overviewには「交付申請は○月○日まで」等の正当な案内文が含まれるため
  {
    pattern: /交付決定後|採択後の手続|実績報告(?:書)?(?:の提出|について)|精算払い(?:について|の手続)|概算払い(?:について|の手続)/,
    code: 'KOFU_SHINSEI',
    reason_ja: '交付申請等（採択後の手続き）のため壁打ち対象外',
    titleOnly: true,
  },
  // 宣言/認定系（補助金ではない）
  {
    pattern: /(?:^|[\s（【])(?:成長)?宣言(?:[\s）】]|$)|(?:^|[\s（【])認定(?:制度|プログラム|企業)(?:[\s）】]|$)|(?:^|[\s（【])ロゴ(?:マーク)?(?:使用|利用)|ブランディング支援宣言/,
    code: 'SENGEN_NINTEI',
    reason_ja: '宣言/認定プログラムのため壁打ち対象外（補助金ではない）',
  },
  // ガイドライン系 — タイトルのみで判定
  // ※ overviewに「手引き」「ガイドライン」が含まれるのは正常な補助金説明
  {
    pattern: /ガイドライン(?:のみ)?|使用規約|利用規約|手引き(?:書)?(?:のみ)?/,
    code: 'GUIDELINE_ONLY',
    reason_ja: 'ガイドライン/手引き等のため壁打ち対象外',
    titleOnly: true,
  },
  // 練習・テスト用 — タイトルのみで判定
  {
    pattern: /練習用|テスト用|ダミー|サンプル(?:申請)?/,
    code: 'RENSHU_TEST',
    reason_ja: '練習/テスト用のため壁打ち対象外',
    titleOnly: true,
  },
];

/**
 * 壁打ち対象外かどうかを判定
 * 
 * @param title - 補助金タイトル
 * @param overview - 概要テキスト（オプション）
 * @returns 除外判定結果
 */
export function checkExclusion(title: string, overview?: string): ExclusionResult {
  for (const { pattern, code, reason_ja, titleOnly } of EXCLUSION_PATTERNS) {
    // titleOnly フラグがある場合はタイトルのみでチェック
    const textToCheck = titleOnly ? title : `${title} ${overview || ''}`;
    const match = textToCheck.match(pattern);
    if (match) {
      return {
        excluded: true,
        reason_code: code,
        reason_ja,
        matched_pattern: match[0],
      };
    }
  }
  
  return { excluded: false };
}

/**
 * detail_json から除外判定を行う
 */
export function checkExclusionFromDetail(detail: DetailJSON | null, title?: string): ExclusionResult {
  if (!detail && !title) {
    return { excluded: false };
  }
  
  const titleText = title || detail?.title || '';
  const overview = detail?.overview || detail?.description || '';
  
  return checkExclusion(titleText, overview);
}

// =====================================================
// 型定義
// =====================================================

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
  excluded?: boolean;                 // 壁打ち対象外フラグ (v4)
  exclusion_reason?: ExclusionReasonCode;  // 除外理由コード (v4)
  exclusion_reason_ja?: string;       // 除外理由（日本語）(v4)
};

/**
 * WALL_CHAT_READY判定（壁打ちゲート）
 * 
 * 凍結仕様 v4:
 * - 必須（5項目中5つ必要）: overview, application_requirements, eligible_expenses, required_documents, deadline
 * - 推奨（加点項目）: required_forms, attachments/pdfUrls
 * - 除外ルール: 交付申請/宣言/認定/ガイドライン等は壁打ち対象外
 * 
 * 電子申請対応 (v3):
 * - is_electronic_application = true の場合、必須スコア 3/5 以上で ready = true
 *   (電子申請システム側で書式を作成するため、required_forms 不要)
 */
export function isWallChatReady(detail: DetailJSON | null, title?: string): WallChatReadyResult {
  if (!detail) {
    return { 
      ready: false, 
      missing: ['overview', 'application_requirements', 'eligible_expenses', 'required_documents', 'deadline'],
      score: 0,
      maxScore: 5,
      isElectronicApplication: false,
    };
  }
  
  // v4: 除外判定を先に行う
  const exclusionResult = checkExclusionFromDetail(detail, title);
  if (exclusionResult.excluded) {
    return {
      ready: false,
      missing: [],
      score: 0,
      maxScore: 5,
      isElectronicApplication: false,
      excluded: true,
      exclusion_reason: exclusionResult.reason_code,
      exclusion_reason_ja: exclusionResult.reason_ja,
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
 * @param detailJsonStr - detail_json文字列
 * @param title - タイトル（除外判定用、オプション）
 */
export function checkWallChatReadyFromJson(detailJsonStr: string | null, title?: string): WallChatReadyResult {
  if (!detailJsonStr || detailJsonStr === '{}' || detailJsonStr.length <= 2) {
    // タイトルのみで除外判定
    if (title) {
      const exclusionResult = checkExclusion(title);
      if (exclusionResult.excluded) {
        return {
          ready: false,
          missing: ['overview', 'application_requirements', 'eligible_expenses', 'required_documents', 'deadline'],
          score: 0,
          maxScore: 5,
          isElectronicApplication: false,
          excluded: true,
          exclusion_reason: exclusionResult.reason_code,
          exclusion_reason_ja: exclusionResult.reason_ja,
        };
      }
    }
    return isWallChatReady(null);
  }
  
  try {
    const detail = JSON.parse(detailJsonStr) as DetailJSON;
    return isWallChatReady(detail, title);
  } catch (e) {
    return isWallChatReady(null, title);
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
  // v4: 除外の場合は専用メッセージ
  if (result.excluded) {
    return `🚫 EXCLUDED - ${result.exclusion_reason_ja || '壁打ち対象外'}`;
  }
  
  const status = result.ready ? '✅ READY' : '❌ NOT READY';
  const scoreStr = `${result.score}/${result.maxScore}`;
  const missingStr = result.missing.length > 0 
    ? `Missing: ${missingToJapanese(result.missing).join(', ')}`
    : 'All required fields present';
  return `${status} (${scoreStr}) - ${missingStr}`;
}

// =====================================================
// PDF選別スコアリング（公募要領優先）
// =====================================================

/**
 * PDFファイル名/URLのスコアリング結果
 */
export type PdfScoreResult = {
  url: string;
  score: number;
  reason: string;
  category: 'KOUBO_YORYO' | 'KOFU_YOKO' | 'APPLICATION_FORM' | 'MANUAL' | 'OTHER';
};

/**
 * PDFスコアリング基準
 * 数値が高いほど優先度が高い（公募要領 > 交付要綱 > 申請様式 > マニュアル > その他）
 */
const PDF_SCORING_PATTERNS: Array<{
  pattern: RegExp;
  score: number;
  category: PdfScoreResult['category'];
  reason: string;
}> = [
  // 公募要領（最高優先度）
  { pattern: /公募要領|募集要項|公募案内|応募要項/i, score: 100, category: 'KOUBO_YORYO', reason: '公募要領' },
  { pattern: /koubo|boshu|youryou|youryo/i, score: 95, category: 'KOUBO_YORYO', reason: '公募要領（ローマ字）' },
  
  // 交付要綱・交付規程
  { pattern: /交付要綱|交付規程|補助金交付|助成金交付/i, score: 80, category: 'KOFU_YOKO', reason: '交付要綱' },
  { pattern: /kofu|youkou|kitei/i, score: 75, category: 'KOFU_YOKO', reason: '交付要綱（ローマ字）' },
  
  // 申請様式・申請書
  { pattern: /申請様式|申請書|様式|記入例|記載例/i, score: 60, category: 'APPLICATION_FORM', reason: '申請様式' },
  { pattern: /shinsei|youshiki/i, score: 55, category: 'APPLICATION_FORM', reason: '申請様式（ローマ字）' },
  
  // マニュアル・手引き（優先度低め）
  { pattern: /マニュアル|手引き|ガイド|利用案内|操作説明/i, score: 30, category: 'MANUAL', reason: 'マニュアル' },
  { pattern: /manual|guide|tebiki/i, score: 25, category: 'MANUAL', reason: 'マニュアル（ローマ字）' },
  
  // 除外すべきパターン（ロゴ、規約など）
  { pattern: /ロゴ|logo|規約|利用規約|プライバシー|privacy/i, score: -50, category: 'OTHER', reason: '対象外（ロゴ/規約）' },
  { pattern: /チラシ|flyer|ポスター|poster/i, score: -30, category: 'OTHER', reason: '対象外（広報物）' },
];

/**
 * PDF URLまたはファイル名からスコアを計算
 * 
 * @param pdfUrl - PDFのURL
 * @param fileName - ファイル名（attachments.nameから取得、オプション）
 * @returns スコアリング結果
 */
export function scorePdfUrl(pdfUrl: string, fileName?: string): PdfScoreResult {
  const textToCheck = `${pdfUrl} ${fileName || ''}`;
  
  let bestMatch: {
    score: number;
    category: PdfScoreResult['category'];
    reason: string;
  } = { score: 0, category: 'OTHER', reason: 'その他' };
  
  for (const { pattern, score, category, reason } of PDF_SCORING_PATTERNS) {
    if (pattern.test(textToCheck)) {
      if (score > bestMatch.score || (score < 0 && bestMatch.score >= 0)) {
        bestMatch = { score, category, reason };
      }
    }
  }
  
  return {
    url: pdfUrl,
    score: bestMatch.score,
    reason: bestMatch.reason,
    category: bestMatch.category,
  };
}

/**
 * PDF URLリストを優先度順にソート
 * 
 * @param pdfUrls - PDFのURLリスト
 * @param attachments - JGrants APIからの添付ファイル情報（オプション）
 * @returns 優先度順にソートされたPDFスコアリング結果
 */
export function prioritizePdfUrls(
  pdfUrls: string[],
  attachments?: Array<{ name: string; type: string; url?: string }>
): PdfScoreResult[] {
  // URLとファイル名のマッピングを作成
  const fileNameMap = new Map<string, string>();
  if (attachments) {
    for (const att of attachments) {
      if (att.url) {
        fileNameMap.set(att.url, att.name);
      }
      // ファイル名からURL末尾を推測
      for (const pdfUrl of pdfUrls) {
        if (pdfUrl.includes(att.name) || att.name.includes(pdfUrl.split('/').pop() || '')) {
          fileNameMap.set(pdfUrl, att.name);
        }
      }
    }
  }
  
  // スコアリング
  const scored = pdfUrls.map(url => scorePdfUrl(url, fileNameMap.get(url)));
  
  // スコア降順でソート（負のスコアは除外候補なので最後に）
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * 最も優先度の高いPDFを選択（最大N件）
 * 
 * @param pdfUrls - PDFのURLリスト
 * @param maxCount - 最大取得件数（デフォルト3）
 * @param attachments - JGrants APIからの添付ファイル情報（オプション）
 * @returns 優先度の高いPDF URL（負のスコアは除外）
 */
export function selectBestPdfs(
  pdfUrls: string[],
  maxCount: number = 3,
  attachments?: Array<{ name: string; type: string; url?: string }>
): string[] {
  const prioritized = prioritizePdfUrls(pdfUrls, attachments);
  
  // 負のスコアを除外し、上位N件を返す
  return prioritized
    .filter(p => p.score >= 0)
    .slice(0, maxCount)
    .map(p => p.url);
}

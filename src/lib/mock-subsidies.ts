/**
 * モック補助金データ
 * 
 * 実際のJグランツデータを参考にした現実的なモックデータ
 * スクリーニング・壁打ち・UI開発に使用
 */

import type { JGrantsSearchResult, JGrantsDetailResult } from '../types';

/**
 * モック補助金一覧（検索用）
 */
export const MOCK_SUBSIDIES: JGrantsSearchResult[] = [
  // ====== 推奨になりやすい補助金 ======
  {
    id: 'MOCK-001',
    title: '中小企業デジタル化応援隊事業',
    name: '中小企業デジタル化応援隊事業',
    subsidy_max_limit: 5000000,
    subsidy_rate: '2/3以内',
    target_area_search: '全国',
    target_industry: '全業種',
    target_number_of_employees: '中小企業（300人以下）',
    acceptance_start_datetime: '2026-01-01T00:00:00Z',
    acceptance_end_datetime: '2026-06-30T23:59:59Z',
    request_reception_display_flag: 1,
  },
  {
    id: 'MOCK-002',
    title: 'IT導入補助金2026（通常枠）',
    name: 'IT導入補助金2026（通常枠）',
    subsidy_max_limit: 4500000,
    subsidy_rate: '1/2以内',
    target_area_search: '全国',
    target_industry: '全業種',
    target_number_of_employees: '中小企業・小規模事業者',
    acceptance_start_datetime: '2026-01-15T00:00:00Z',
    acceptance_end_datetime: '2026-09-30T23:59:59Z',
    request_reception_display_flag: 1,
  },
  {
    id: 'MOCK-003',
    title: '小規模事業者持続化補助金（一般型）',
    name: '小規模事業者持続化補助金（一般型）',
    subsidy_max_limit: 500000,
    subsidy_rate: '2/3以内',
    target_area_search: '全国',
    target_industry: '全業種',
    target_number_of_employees: '小規模事業者（20人以下、商業・サービス業は5人以下）',
    acceptance_start_datetime: '2026-01-01T00:00:00Z',
    acceptance_end_datetime: '2026-05-31T23:59:59Z',
    request_reception_display_flag: 1,
  },
  {
    id: 'MOCK-004',
    title: 'ものづくり・商業・サービス生産性向上促進補助金',
    name: 'ものづくり・商業・サービス生産性向上促進補助金',
    subsidy_max_limit: 12500000,
    subsidy_rate: '1/2〜2/3',
    target_area_search: '全国',
    target_industry: '製造業、商業、サービス業',
    target_number_of_employees: '中小企業',
    acceptance_start_datetime: '2026-02-01T00:00:00Z',
    acceptance_end_datetime: '2026-08-31T23:59:59Z',
    request_reception_display_flag: 1,
  },
  
  // ====== 地域限定（注意になりやすい） ======
  {
    id: 'MOCK-005',
    title: '東京都中小企業設備投資支援事業',
    name: '東京都中小企業設備投資支援事業',
    subsidy_max_limit: 10000000,
    subsidy_rate: '1/2以内',
    target_area_search: '東京都',
    target_industry: '製造業、情報通信業',
    target_number_of_employees: '中小企業',
    acceptance_start_datetime: '2026-01-10T00:00:00Z',
    acceptance_end_datetime: '2026-03-31T23:59:59Z',
    request_reception_display_flag: 1,
  },
  {
    id: 'MOCK-006',
    title: '大阪府DX推進補助金',
    name: '大阪府DX推進補助金',
    subsidy_max_limit: 3000000,
    subsidy_rate: '2/3以内',
    target_area_search: '大阪府',
    target_industry: '全業種',
    target_number_of_employees: '中小企業（50人以下優先）',
    acceptance_start_datetime: '2026-01-20T00:00:00Z',
    acceptance_end_datetime: '2026-04-30T23:59:59Z',
    request_reception_display_flag: 1,
  },
  
  // ====== 業種限定 ======
  {
    id: 'MOCK-007',
    title: '飲食店経営改善支援事業',
    name: '飲食店経営改善支援事業',
    subsidy_max_limit: 2000000,
    subsidy_rate: '3/4以内',
    target_area_search: '全国',
    target_industry: '飲食サービス業',
    target_number_of_employees: '小規模事業者',
    acceptance_start_datetime: '2026-01-01T00:00:00Z',
    acceptance_end_datetime: '2026-07-31T23:59:59Z',
    request_reception_display_flag: 1,
  },
  
  // ====== 締切間近（リスクフラグ付き） ======
  {
    id: 'MOCK-008',
    title: '省エネルギー投資促進支援事業費補助金',
    name: '省エネルギー投資促進支援事業費補助金',
    subsidy_max_limit: 150000000,
    subsidy_rate: '1/3以内',
    target_area_search: '全国',
    target_industry: '製造業、物流業',
    target_number_of_employees: '中小企業〜中堅企業',
    acceptance_start_datetime: '2025-10-01T00:00:00Z',
    acceptance_end_datetime: '2026-01-31T23:59:59Z', // 締切間近
    request_reception_display_flag: 1,
  },
  
  // ====== 受付終了（非推奨になる） ======
  {
    id: 'MOCK-009',
    title: '事業再構築補助金（第12回）',
    name: '事業再構築補助金（第12回）',
    subsidy_max_limit: 60000000,
    subsidy_rate: '1/2〜3/4',
    target_area_search: '全国',
    target_industry: '全業種',
    target_number_of_employees: '中小企業',
    acceptance_start_datetime: '2025-06-01T00:00:00Z',
    acceptance_end_datetime: '2025-12-31T23:59:59Z', // 受付終了
    request_reception_display_flag: 0,
  },
  
  // ====== 賃上げ要件あり（リスク検出用） ======
  {
    id: 'MOCK-010',
    title: '業務改善助成金',
    name: '業務改善助成金',
    subsidy_max_limit: 6000000,
    subsidy_rate: '3/4〜9/10',
    target_area_search: '全国',
    target_industry: '全業種',
    target_number_of_employees: '中小企業・小規模事業者',
    acceptance_start_datetime: '2026-01-01T00:00:00Z',
    acceptance_end_datetime: '2026-12-31T23:59:59Z',
    request_reception_display_flag: 1,
  },
];

/**
 * モック補助金詳細データ
 */
const MOCK_SUBSIDY_DETAILS: Record<string, JGrantsDetailResult> = {
  'MOCK-001': {
    ...MOCK_SUBSIDIES[0],
    description: '中小企業・小規模事業者のデジタル化を支援する事業です。ITツールの導入やデジタル人材の育成などに活用できます。',
    target_area_detail: '日本全国の中小企業・小規模事業者',
    application_requirements: `
【対象者】
・中小企業基本法に定める中小企業者
・資本金5,000万円以下または従業員300人以下

【要件】
・デジタル化計画を策定していること
・IT導入支援事業者と連携していること
・申請時点で事業を営んでいること
    `.trim(),
    eligible_expenses: `
【補助対象経費】
・ソフトウェア購入費
・クラウドサービス利用料（最大2年分）
・導入関連費（設定、研修等）
・専門家謝金

【対象外経費】
・ハードウェア購入費（単体）
・汎用的なオフィスソフト
・広告宣伝費
    `.trim(),
    required_documents: `
・事業計画書
・直近2期分の決算書
・IT導入計画書
・見積書
・履歴事項全部証明書
    `.trim(),
    application_procedure: '電子申請（GビズID必須）',
    contact_info: '中小企業庁 デジタル化推進課',
    related_url: 'https://www.chusho.meti.go.jp/',
    attachments: [
      { id: 'att-001', name: '公募要領.pdf', url: 'https://example.com/guideline.pdf', file_type: 'application/pdf' },
      { id: 'att-002', name: '申請様式.xlsx', url: 'https://example.com/form.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ],
  },
  'MOCK-002': {
    ...MOCK_SUBSIDIES[1],
    description: 'ITツール（ソフトウェア、サービス等）を導入する経費の一部を補助することにより、中小企業・小規模事業者の生産性向上を図る事業です。',
    target_area_detail: '日本全国',
    application_requirements: `
【対象者】
・中小企業・小規模事業者（飲食、宿泊、卸・小売、運輸、医療・介護・保育等のサービス業、製造業その他）

【要件】
・gBizIDプライムを取得していること
・SECURITY ACTION の「★一つ星」または「★★二つ星」の宣言を行っていること
    `.trim(),
    eligible_expenses: `
【補助対象経費】
・ITツール導入費用
・オプション（機能拡張、データ連携等）
・役務（導入コンサル、保守サポート等）
・ハードウェア（PC、タブレット等 ※上限あり）
    `.trim(),
    required_documents: `
・申請書
・決算書（直近1期分）
・導入するITツールの見積書・カタログ
    `.trim(),
    application_procedure: 'IT導入支援事業者経由での電子申請',
    contact_info: 'IT導入補助金事務局',
    related_url: 'https://www.it-hojo.jp/',
    attachments: [],
  },
  'MOCK-003': {
    ...MOCK_SUBSIDIES[2],
    description: '小規模事業者が経営計画を作成し、販路開拓等に取り組む際の経費の一部を補助する制度です。',
    target_area_detail: '日本全国',
    application_requirements: `
【対象者】
・商業・サービス業：常時使用する従業員の数が5人以下
・製造業その他：常時使用する従業員の数が20人以下

【要件】
・商工会議所の管轄地域内で事業を営んでいること
・経営計画を策定していること
    `.trim(),
    eligible_expenses: `
【補助対象経費】
・機械装置等費
・広報費
・ウェブサイト関連費
・展示会等出展費
・旅費
・開発費
・資料購入費
・借料
・設備処分費
・委託・外注費
    `.trim(),
    required_documents: `
・経営計画書
・補助事業計画書
・商工会議所の確認書
・決算書
    `.trim(),
    application_procedure: '商工会議所経由での申請',
    contact_info: '日本商工会議所 小規模事業者持続化補助金事務局',
    related_url: 'https://r3.jizokukahojokin.info/',
    attachments: [],
  },
  'MOCK-010': {
    ...MOCK_SUBSIDIES[9],
    description: '事業場内最低賃金を一定額以上引き上げた中小企業・小規模事業者に対し、設備投資等にかかる費用の一部を助成する制度です。',
    target_area_detail: '日本全国',
    application_requirements: `
【対象者】
・中小企業・小規模事業者
・事業場内最低賃金と地域別最低賃金の差額が50円以内の事業場

【要件】
・事業場内最低賃金を30円以上引き上げること
・引上げ後の賃金を支払うこと
・生産性向上に資する設備投資等を行うこと

【注意】
⚠️ 賃上げ要件を満たさない場合は返還義務が発生する可能性があります
    `.trim(),
    eligible_expenses: `
【補助対象経費】
・機械設備
・POSレジ
・コピー機
・PC、タブレット
・店舗改装
・自動精算機
・券売機
    `.trim(),
    required_documents: `
・交付申請書
・事業実施計画書
・賃金台帳（引上げ前後）
・見積書
・就業規則
    `.trim(),
    application_procedure: '労働局への申請',
    contact_info: '厚生労働省 雇用環境・均等局',
    related_url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html',
    attachments: [],
  },
};

/**
 * IDで詳細を取得
 */
export function getMockSubsidyDetail(id: string): JGrantsDetailResult | null {
  // 詳細データがあればそれを返す
  if (MOCK_SUBSIDY_DETAILS[id]) {
    return MOCK_SUBSIDY_DETAILS[id];
  }
  
  // なければ一覧データから生成
  const basic = MOCK_SUBSIDIES.find(s => s.id === id);
  if (basic) {
    return {
      ...basic,
      description: `${basic.title}の詳細情報です。`,
      attachments: [],
    };
  }
  
  return null;
}

/**
 * 全モックデータを取得
 */
export function getAllMockSubsidies(): JGrantsSearchResult[] {
  return MOCK_SUBSIDIES;
}

/**
 * 条件に合うモックデータを取得
 */
export function filterMockSubsidies(
  filter: {
    area?: string;
    industry?: string;
    acceptingOnly?: boolean;
  }
): JGrantsSearchResult[] {
  let results = [...MOCK_SUBSIDIES];
  
  if (filter.acceptingOnly) {
    results = results.filter(s => s.request_reception_display_flag === 1);
  }
  
  if (filter.area) {
    results = results.filter(s => 
      !s.target_area_search || 
      s.target_area_search === '全国' ||
      s.target_area_search.includes(filter.area!)
    );
  }
  
  return results;
}

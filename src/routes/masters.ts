/**
 * マスタデータAPI
 * 
 * GET /api/masters/issuers - 発行機関一覧
 * GET /api/masters/categories - カテゴリ一覧
 * GET /api/masters/industries - 業種一覧
 * GET /api/masters/regions - 地域一覧（都道府県）
 * GET /api/masters/all - 全マスタ一括取得
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';

const masters = new Hono<{ Bindings: Env; Variables: Variables }>();

// =============================================================================
// 型定義
// =============================================================================

interface Issuer {
  id: string;
  issuer_type: 'ministry' | 'prefecture' | 'municipal' | 'organization';
  name: string;
  name_short: string | null;
  region_code: string | null;
  parent_id: string | null;
  subsidy_count: number;
  sort_order: number;
}

interface Category {
  id: string;
  category_type: 'major' | 'minor';
  name: string;
  name_en: string | null;
  parent_id: string | null;
  keywords: string | null;
  subsidy_count: number;
  sort_order: number;
}

interface Industry {
  id: string;
  code: string | null;
  name: string;
  name_short: string | null;
  parent_id: string | null;
  sort_order: number;
}

interface Region {
  code: string;
  name: string;
  name_kana: string;
  region_group: string;
  subsidy_count: number;
}

// =============================================================================
// 都道府県マスタ（ハードコード - DBに依存しない）
// =============================================================================

const PREFECTURES: Region[] = [
  // 北海道・東北
  { code: '01', name: '北海道', name_kana: 'ほっかいどう', region_group: '北海道・東北', subsidy_count: 1052 },
  { code: '02', name: '青森県', name_kana: 'あおもりけん', region_group: '北海道・東北', subsidy_count: 296 },
  { code: '03', name: '岩手県', name_kana: 'いわてけん', region_group: '北海道・東北', subsidy_count: 372 },
  { code: '04', name: '宮城県', name_kana: 'みやぎけん', region_group: '北海道・東北', subsidy_count: 321 },
  { code: '05', name: '秋田県', name_kana: 'あきたけん', region_group: '北海道・東北', subsidy_count: 305 },
  { code: '06', name: '山形県', name_kana: 'やまがたけん', region_group: '北海道・東北', subsidy_count: 335 },
  { code: '07', name: '福島県', name_kana: 'ふくしまけん', region_group: '北海道・東北', subsidy_count: 521 },
  // 関東
  { code: '08', name: '茨城県', name_kana: 'いばらきけん', region_group: '関東', subsidy_count: 381 },
  { code: '09', name: '栃木県', name_kana: 'とちぎけん', region_group: '関東', subsidy_count: 420 },
  { code: '10', name: '群馬県', name_kana: 'ぐんまけん', region_group: '関東', subsidy_count: 429 },
  { code: '11', name: '埼玉県', name_kana: 'さいたまけん', region_group: '関東', subsidy_count: 547 },
  { code: '12', name: '千葉県', name_kana: 'ちばけん', region_group: '関東', subsidy_count: 568 },
  { code: '13', name: '東京都', name_kana: 'とうきょうと', region_group: '関東', subsidy_count: 1549 },
  { code: '14', name: '神奈川県', name_kana: 'かながわけん', region_group: '関東', subsidy_count: 733 },
  // 中部
  { code: '15', name: '新潟県', name_kana: 'にいがたけん', region_group: '中部', subsidy_count: 711 },
  { code: '16', name: '富山県', name_kana: 'とやまけん', region_group: '中部', subsidy_count: 454 },
  { code: '17', name: '石川県', name_kana: 'いしかわけん', region_group: '中部', subsidy_count: 370 },
  { code: '18', name: '福井県', name_kana: 'ふくいけん', region_group: '中部', subsidy_count: 347 },
  { code: '19', name: '山梨県', name_kana: 'やまなしけん', region_group: '中部', subsidy_count: 227 },
  { code: '20', name: '長野県', name_kana: 'ながのけん', region_group: '中部', subsidy_count: 1116 },
  { code: '21', name: '岐阜県', name_kana: 'ぎふけん', region_group: '中部', subsidy_count: 474 },
  { code: '22', name: '静岡県', name_kana: 'しずおかけん', region_group: '中部', subsidy_count: 631 },
  { code: '23', name: '愛知県', name_kana: 'あいちけん', region_group: '中部', subsidy_count: 978 },
  // 近畿
  { code: '24', name: '三重県', name_kana: 'みえけん', region_group: '近畿', subsidy_count: 315 },
  { code: '25', name: '滋賀県', name_kana: 'しがけん', region_group: '近畿', subsidy_count: 262 },
  { code: '26', name: '京都府', name_kana: 'きょうとふ', region_group: '近畿', subsidy_count: 269 },
  { code: '27', name: '大阪府', name_kana: 'おおさかふ', region_group: '近畿', subsidy_count: 546 },
  { code: '28', name: '兵庫県', name_kana: 'ひょうごけん', region_group: '近畿', subsidy_count: 739 },
  { code: '29', name: '奈良県', name_kana: 'ならけん', region_group: '近畿', subsidy_count: 188 },
  { code: '30', name: '和歌山県', name_kana: 'わかやまけん', region_group: '近畿', subsidy_count: 133 },
  // 中国
  { code: '31', name: '鳥取県', name_kana: 'とっとりけん', region_group: '中国', subsidy_count: 268 },
  { code: '32', name: '島根県', name_kana: 'しまねけん', region_group: '中国', subsidy_count: 242 },
  { code: '33', name: '岡山県', name_kana: 'おかやまけん', region_group: '中国', subsidy_count: 439 },
  { code: '34', name: '広島県', name_kana: 'ひろしまけん', region_group: '中国', subsidy_count: 244 },
  { code: '35', name: '山口県', name_kana: 'やまぐちけん', region_group: '中国', subsidy_count: 325 },
  // 四国
  { code: '36', name: '徳島県', name_kana: 'とくしまけん', region_group: '四国', subsidy_count: 170 },
  { code: '37', name: '香川県', name_kana: 'かがわけん', region_group: '四国', subsidy_count: 227 },
  { code: '38', name: '愛媛県', name_kana: 'えひめけん', region_group: '四国', subsidy_count: 359 },
  { code: '39', name: '高知県', name_kana: 'こうちけん', region_group: '四国', subsidy_count: 246 },
  // 九州・沖縄
  { code: '40', name: '福岡県', name_kana: 'ふくおかけん', region_group: '九州・沖縄', subsidy_count: 539 },
  { code: '41', name: '佐賀県', name_kana: 'さがけん', region_group: '九州・沖縄', subsidy_count: 203 },
  { code: '42', name: '長崎県', name_kana: 'ながさきけん', region_group: '九州・沖縄', subsidy_count: 251 },
  { code: '43', name: '熊本県', name_kana: 'くまもとけん', region_group: '九州・沖縄', subsidy_count: 410 },
  { code: '44', name: '大分県', name_kana: 'おおいたけん', region_group: '九州・沖縄', subsidy_count: 287 },
  { code: '45', name: '宮崎県', name_kana: 'みやざきけん', region_group: '九州・沖縄', subsidy_count: 289 },
  { code: '46', name: '鹿児島県', name_kana: 'かごしまけん', region_group: '九州・沖縄', subsidy_count: 379 },
  { code: '47', name: '沖縄県', name_kana: 'おきなわけん', region_group: '九州・沖縄', subsidy_count: 148 },
];

// 地域グループ集計
const REGION_GROUPS = [
  { name: '北海道・東北', prefectures: ['01', '02', '03', '04', '05', '06', '07'] },
  { name: '関東', prefectures: ['08', '09', '10', '11', '12', '13', '14'] },
  { name: '中部', prefectures: ['15', '16', '17', '18', '19', '20', '21', '22', '23'] },
  { name: '近畿', prefectures: ['24', '25', '26', '27', '28', '29', '30'] },
  { name: '中国', prefectures: ['31', '32', '33', '34', '35'] },
  { name: '四国', prefectures: ['36', '37', '38', '39'] },
  { name: '九州・沖縄', prefectures: ['40', '41', '42', '43', '44', '45', '46', '47'] },
];

// =============================================================================
// デフォルトマスタデータ（DBにデータがない場合のフォールバック）
// =============================================================================

const DEFAULT_ISSUERS: Issuer[] = [
  // 主要省庁
  { id: 'ministry-chusho', issuer_type: 'ministry', name: '中小企業庁', name_short: '中企庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 10 },
  { id: 'ministry-meti', issuer_type: 'ministry', name: '経済産業省', name_short: '経産省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 11 },
  { id: 'ministry-mhlw', issuer_type: 'ministry', name: '厚生労働省', name_short: '厚労省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 12 },
  { id: 'ministry-maff', issuer_type: 'ministry', name: '農林水産省', name_short: '農水省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 13 },
  { id: 'ministry-mlit', issuer_type: 'ministry', name: '国土交通省', name_short: '国交省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 14 },
  { id: 'ministry-env', issuer_type: 'ministry', name: '環境省', name_short: '環境省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 15 },
  { id: 'ministry-soumu', issuer_type: 'ministry', name: '総務省', name_short: '総務省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 16 },
  { id: 'ministry-mext', issuer_type: 'ministry', name: '文部科学省', name_short: '文科省', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 17 },
  { id: 'ministry-cao', issuer_type: 'ministry', name: '内閣府', name_short: '内閣府', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 18 },
  { id: 'ministry-kodomo', issuer_type: 'ministry', name: 'こども家庭庁', name_short: 'こども庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 19 },
  { id: 'ministry-jta', issuer_type: 'ministry', name: '観光庁', name_short: '観光庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 20 },
  { id: 'ministry-sports', issuer_type: 'ministry', name: 'スポーツ庁', name_short: 'スポーツ庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 21 },
  { id: 'ministry-bunka', issuer_type: 'ministry', name: '文化庁', name_short: '文化庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 22 },
  { id: 'ministry-anre', issuer_type: 'ministry', name: '資源エネルギー庁', name_short: 'エネ庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 23 },
  { id: 'ministry-rinya', issuer_type: 'ministry', name: '林野庁', name_short: '林野庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 24 },
  { id: 'ministry-suisan', issuer_type: 'ministry', name: '水産庁', name_short: '水産庁', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 25 },
  { id: 'ministry-jfc', issuer_type: 'ministry', name: '日本政策金融公庫', name_short: '公庫', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 26 },
  // 独立行政法人等
  { id: 'org-nedo', issuer_type: 'organization', name: 'NEDO（新エネルギー・産業技術総合開発機構）', name_short: 'NEDO', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 30 },
  { id: 'org-jetro', issuer_type: 'organization', name: 'JETRO（日本貿易振興機構）', name_short: 'JETRO', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 31 },
  { id: 'org-sii', issuer_type: 'organization', name: '環境共創イニシアチブ', name_short: 'SII', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 32 },
  { id: 'org-smrj', issuer_type: 'organization', name: '中小企業基盤整備機構', name_short: '中小機構', region_code: null, parent_id: null, subsidy_count: 0, sort_order: 33 },
];

const DEFAULT_CATEGORIES: Category[] = [
  // 大分類
  { id: 'cat-employment', category_type: 'major', name: '雇用・人材', name_en: 'employment', parent_id: null, keywords: null, subsidy_count: 3774, sort_order: 10 },
  { id: 'cat-sales', category_type: 'major', name: '販路開拓支援', name_en: 'sales', parent_id: null, keywords: null, subsidy_count: 6908, sort_order: 20 },
  { id: 'cat-equipment', category_type: 'major', name: '設備導入・研究開発', name_en: 'equipment', parent_id: null, keywords: null, subsidy_count: 6284, sort_order: 30 },
  { id: 'cat-startup', category_type: 'major', name: '創業・起業・新規事業', name_en: 'startup', parent_id: null, keywords: null, subsidy_count: 2218, sort_order: 40 },
  { id: 'cat-management', category_type: 'major', name: '経営改善・融資', name_en: 'management', parent_id: null, keywords: null, subsidy_count: 8501, sort_order: 50 },
  { id: 'cat-ip', category_type: 'major', name: '特許・知的財産・認証取得', name_en: 'ip', parent_id: null, keywords: null, subsidy_count: 285, sort_order: 60 },
  { id: 'cat-covid', category_type: 'major', name: 'コロナ関連', name_en: 'covid', parent_id: null, keywords: null, subsidy_count: 151, sort_order: 70 },
  // 小分類（雇用・人材）
  { id: 'cat-employment-recruitment', category_type: 'minor', name: '採用活動支援', name_en: null, parent_id: 'cat-employment', keywords: '採用,求人,人材確保', subsidy_count: 842, sort_order: 11 },
  { id: 'cat-employment-training', category_type: 'minor', name: '人材育成・研修', name_en: null, parent_id: 'cat-employment', keywords: '研修,教育,スキルアップ', subsidy_count: 1820, sort_order: 12 },
  { id: 'cat-employment-subsidy', category_type: 'minor', name: '雇用関係助成金', name_en: null, parent_id: 'cat-employment', keywords: '雇用,助成,奨励金', subsidy_count: 1112, sort_order: 13 },
  // 小分類（販路開拓支援）
  { id: 'cat-sales-regional', category_type: 'minor', name: '地域活性化', name_en: null, parent_id: 'cat-sales', keywords: '地域,活性化,振興', subsidy_count: 5134, sort_order: 21 },
  { id: 'cat-sales-expansion', category_type: 'minor', name: '販路開拓支援', name_en: null, parent_id: 'cat-sales', keywords: '販路,マーケティング,展示会', subsidy_count: 1468, sort_order: 22 },
  { id: 'cat-sales-overseas', category_type: 'minor', name: '海外展開支援', name_en: null, parent_id: 'cat-sales', keywords: '海外,輸出,グローバル', subsidy_count: 306, sort_order: 23 },
  // 小分類（設備導入・研究開発）
  { id: 'cat-equipment-manufacturing', category_type: 'minor', name: 'ものづくり支援', name_en: null, parent_id: 'cat-equipment', keywords: 'ものづくり,製造,生産', subsidy_count: 106, sort_order: 31 },
  { id: 'cat-equipment-product', category_type: 'minor', name: '商品・サービス開発', name_en: null, parent_id: 'cat-equipment', keywords: '商品開発,サービス,新製品', subsidy_count: 742, sort_order: 32 },
  { id: 'cat-equipment-rd', category_type: 'minor', name: '設備導入・研究開発', name_en: null, parent_id: 'cat-equipment', keywords: '設備,研究,開発,投資', subsidy_count: 4342, sort_order: 33 },
  { id: 'cat-equipment-energy', category_type: 'minor', name: 'エネルギー設備導入', name_en: null, parent_id: 'cat-equipment', keywords: '省エネ,再エネ,太陽光,蓄電池', subsidy_count: 505, sort_order: 34 },
  { id: 'cat-equipment-it', category_type: 'minor', name: 'IT・IoT導入', name_en: null, parent_id: 'cat-equipment', keywords: 'IT,IoT,DX,デジタル', subsidy_count: 589, sort_order: 35 },
  // 小分類（創業・起業・新規事業）
  { id: 'cat-startup-founding', category_type: 'minor', name: '創業・起業', name_en: null, parent_id: 'cat-startup', keywords: '創業,起業,開業,スタートアップ', subsidy_count: 1430, sort_order: 41 },
  { id: 'cat-startup-new', category_type: 'minor', name: '新規事業', name_en: null, parent_id: 'cat-startup', keywords: '新規事業,新分野,第二創業', subsidy_count: 788, sort_order: 42 },
  // 小分類（経営改善・融資）
  { id: 'cat-management-improvement', category_type: 'minor', name: '経営改善', name_en: null, parent_id: 'cat-management', keywords: '経営改善,生産性,効率化', subsidy_count: 7683, sort_order: 51 },
  { id: 'cat-management-tax', category_type: 'minor', name: '税制優遇・保証制度', name_en: null, parent_id: 'cat-management', keywords: '税制,優遇,保証,信用', subsidy_count: 466, sort_order: 52 },
  { id: 'cat-management-succession', category_type: 'minor', name: '事業承継', name_en: null, parent_id: 'cat-management', keywords: '事業承継,M&A,後継者', subsidy_count: 352, sort_order: 54 },
  // 小分類（特許・知的財産）
  { id: 'cat-ip-patent', category_type: 'minor', name: '特許・知的財産・認証取得', name_en: null, parent_id: 'cat-ip', keywords: '特許,知財,認証,ISO', subsidy_count: 285, sort_order: 61 },
  // 小分類（コロナ関連）
  { id: 'cat-covid-emergency', category_type: 'minor', name: '緊急対策支援制度', name_en: null, parent_id: 'cat-covid', keywords: 'コロナ,緊急,支援,給付', subsidy_count: 151, sort_order: 71 },
];

const DEFAULT_INDUSTRIES: Industry[] = [
  { id: 'ind-info-comm', code: 'G', name: '情報通信業', name_short: 'IT', parent_id: null, sort_order: 10 },
  { id: 'ind-manufacturing', code: 'E', name: '製造業', name_short: '製造', parent_id: null, sort_order: 20 },
  { id: 'ind-construction', code: 'D', name: '建設業', name_short: '建設', parent_id: null, sort_order: 30 },
  { id: 'ind-wholesale', code: 'I', name: '卸売業', name_short: '卸売', parent_id: null, sort_order: 40 },
  { id: 'ind-retail', code: 'I', name: '小売業', name_short: '小売', parent_id: null, sort_order: 50 },
  { id: 'ind-food', code: 'M', name: '飲食サービス業', name_short: '飲食', parent_id: null, sort_order: 60 },
  { id: 'ind-hotel', code: 'M', name: '宿泊業', name_short: '宿泊', parent_id: null, sort_order: 70 },
  { id: 'ind-medical', code: 'P', name: '医療・福祉', name_short: '医療福祉', parent_id: null, sort_order: 80 },
  { id: 'ind-education', code: 'O', name: '教育・学習支援業', name_short: '教育', parent_id: null, sort_order: 90 },
  { id: 'ind-finance', code: 'J', name: '金融業・保険業', name_short: '金融', parent_id: null, sort_order: 100 },
  { id: 'ind-realestate', code: 'K', name: '不動産業・物品賃貸業', name_short: '不動産', parent_id: null, sort_order: 110 },
  { id: 'ind-transport', code: 'H', name: '運輸業・郵便業', name_short: '運輸', parent_id: null, sort_order: 120 },
  { id: 'ind-electric', code: 'D', name: '電気・ガス・熱供給・水道業', name_short: '電力ガス', parent_id: null, sort_order: 130 },
  { id: 'ind-agriculture', code: 'A', name: '農業・林業', name_short: '農林', parent_id: null, sort_order: 140 },
  { id: 'ind-fishing', code: 'B', name: '漁業', name_short: '漁業', parent_id: null, sort_order: 150 },
  { id: 'ind-mining', code: 'C', name: '鉱業・採石業・砂利採取業', name_short: '鉱業', parent_id: null, sort_order: 160 },
  { id: 'ind-lifestyle', code: 'N', name: '生活関連サービス・娯楽業', name_short: '生活娯楽', parent_id: null, sort_order: 170 },
  { id: 'ind-research', code: 'L', name: '学術研究・専門・技術サービス業', name_short: '専門技術', parent_id: null, sort_order: 180 },
  { id: 'ind-complex', code: 'Q', name: '複合サービス業', name_short: '複合', parent_id: null, sort_order: 190 },
  { id: 'ind-service', code: 'R', name: 'サービス業', name_short: 'サービス', parent_id: null, sort_order: 200 },
  { id: 'ind-public', code: 'R', name: '公務', name_short: '公務', parent_id: null, sort_order: 210 },
  { id: 'ind-organization', code: 'S', name: 'その他の団体', name_short: '団体', parent_id: null, sort_order: 220 },
  { id: 'ind-other', code: 'T', name: '分類不能の産業', name_short: 'その他', parent_id: null, sort_order: 230 },
];

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * DBから取得した行をIssuer型に安全に変換
 * @param row DBから取得した行データ
 * @returns 変換されたIssuer、または変換失敗時はnull
 */
function toIssuer(row: unknown): Issuer | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  
  // 必須フィールドのチェック
  if (typeof r.id !== 'string' || typeof r.name !== 'string') {
    console.warn('Invalid issuer row: missing required fields', { id: r.id, name: r.name });
    return null;
  }
  
  // issuer_typeの検証
  const validTypes = ['ministry', 'prefecture', 'municipal', 'organization'];
  const issuerType = typeof r.issuer_type === 'string' && validTypes.includes(r.issuer_type)
    ? r.issuer_type as Issuer['issuer_type']
    : 'organization'; // デフォルト値
  
  return {
    id: r.id,
    issuer_type: issuerType,
    name: r.name,
    name_short: typeof r.name_short === 'string' ? r.name_short : null,
    region_code: typeof r.region_code === 'string' ? r.region_code : null,
    parent_id: typeof r.parent_id === 'string' ? r.parent_id : null,
    subsidy_count: typeof r.subsidy_count === 'number' ? r.subsidy_count : 0,
    sort_order: typeof r.sort_order === 'number' ? r.sort_order : 999,
  };
}

/**
 * DBから取得した行をCategory型に安全に変換
 */
function toCategory(row: unknown): Category | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  
  if (typeof r.id !== 'string' || typeof r.name !== 'string') {
    console.warn('Invalid category row: missing required fields');
    return null;
  }
  
  const validTypes = ['major', 'minor'];
  const categoryType = typeof r.category_type === 'string' && validTypes.includes(r.category_type)
    ? r.category_type as Category['category_type']
    : 'major';
  
  return {
    id: r.id,
    category_type: categoryType,
    name: r.name,
    name_en: typeof r.name_en === 'string' ? r.name_en : null,
    parent_id: typeof r.parent_id === 'string' ? r.parent_id : null,
    keywords: typeof r.keywords === 'string' ? r.keywords : null,
    subsidy_count: typeof r.subsidy_count === 'number' ? r.subsidy_count : 0,
    sort_order: typeof r.sort_order === 'number' ? r.sort_order : 999,
  };
}

/**
 * DBから取得した行をIndustry型に安全に変換
 */
function toIndustry(row: unknown): Industry | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  
  if (typeof r.id !== 'string' || typeof r.name !== 'string') {
    console.warn('Invalid industry row: missing required fields');
    return null;
  }
  
  return {
    id: r.id,
    code: typeof r.code === 'string' ? r.code : null,
    name: r.name,
    name_short: typeof r.name_short === 'string' ? r.name_short : null,
    parent_id: typeof r.parent_id === 'string' ? r.parent_id : null,
    sort_order: typeof r.sort_order === 'number' ? r.sort_order : 999,
  };
}

// =============================================================================
// API エンドポイント
// =============================================================================

/**
 * 発行機関一覧
 */
masters.get('/issuers', async (c) => {
  const db = c.env.DB;
  
  try {
    // DBからissuer_masterを取得（テーブルが存在する場合）
    let issuers: Issuer[] = [];
    
    try {
      const result = await db
        .prepare(`
          SELECT id, issuer_type, name, name_short, region_code, parent_id, subsidy_count, sort_order
          FROM issuer_master
          WHERE is_active = 1
          ORDER BY sort_order, name
        `)
        .all();
      
      if (result.results && result.results.length > 0) {
        // 型安全な変換（不正なデータは除外）
        issuers = result.results
          .map(toIssuer)
          .filter((i): i is Issuer => i !== null);
      }
    } catch (dbError) {
      // テーブルが存在しない場合はデフォルト値を使用
      console.log('issuer_master not found, using defaults');
    }
    
    // DBにデータがない場合はデフォルト値
    if (issuers.length === 0) {
      issuers = DEFAULT_ISSUERS;
    }
    
    // タイプ別にグループ化
    const grouped = {
      ministry: issuers.filter(i => i.issuer_type === 'ministry'),
      organization: issuers.filter(i => i.issuer_type === 'organization'),
      prefecture: issuers.filter(i => i.issuer_type === 'prefecture'),
      municipal: issuers.filter(i => i.issuer_type === 'municipal'),
    };
    
    return c.json<ApiResponse<{ issuers: Issuer[]; grouped: typeof grouped }>>({
      success: true,
      data: { issuers, grouped },
    });
  } catch (error) {
    console.error('Get issuers error:', error instanceof Error ? error.message : String(error));
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get issuers' },
    }, 500);
  }
});

/**
 * カテゴリ一覧
 */
masters.get('/categories', async (c) => {
  const db = c.env.DB;
  
  try {
    let categories: Category[] = [];
    
    try {
      const result = await db
        .prepare(`
          SELECT id, category_type, name, name_en, parent_id, keywords, subsidy_count, sort_order
          FROM category_master
          WHERE is_active = 1
          ORDER BY sort_order, name
        `)
        .all();
      
      if (result.results && result.results.length > 0) {
        categories = result.results
          .map(toCategory)
          .filter((c): c is Category => c !== null);
      }
    } catch (dbError) {
      console.log('category_master not found, using defaults');
    }
    
    if (categories.length === 0) {
      categories = DEFAULT_CATEGORIES;
    }
    
    // 階層構造に変換
    const major = categories.filter(c => c.category_type === 'major');
    const tree = major.map(m => ({
      ...m,
      children: categories.filter(c => c.parent_id === m.id),
    }));
    
    return c.json<ApiResponse<{ categories: Category[]; tree: typeof tree }>>({
      success: true,
      data: { categories, tree },
    });
  } catch (error) {
    console.error('Get categories error:', error instanceof Error ? error.message : String(error));
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get categories' },
    }, 500);
  }
});

/**
 * 業種一覧
 */
masters.get('/industries', async (c) => {
  const db = c.env.DB;
  
  try {
    let industries: Industry[] = [];
    
    try {
      const result = await db
        .prepare(`
          SELECT id, code, name, name_short, parent_id, sort_order
          FROM industry_master
          WHERE is_active = 1
          ORDER BY sort_order, name
        `)
        .all();
      
      if (result.results && result.results.length > 0) {
        industries = result.results
          .map(toIndustry)
          .filter((i): i is Industry => i !== null);
      }
    } catch (dbError) {
      console.log('industry_master not found, using defaults');
    }
    
    if (industries.length === 0) {
      industries = DEFAULT_INDUSTRIES;
    }
    
    return c.json<ApiResponse<{ industries: Industry[] }>>({
      success: true,
      data: { industries },
    });
  } catch (error) {
    console.error('Get industries error:', error instanceof Error ? error.message : String(error));
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get industries' },
    }, 500);
  }
});

/**
 * 地域一覧（都道府県）
 */
masters.get('/regions', async (c) => {
  try {
    // 地域グループ付きで返す
    const groupedRegions = REGION_GROUPS.map(group => ({
      name: group.name,
      prefectures: PREFECTURES.filter(p => group.prefectures.includes(p.code)),
      total_count: PREFECTURES
        .filter(p => group.prefectures.includes(p.code))
        .reduce((sum, p) => sum + p.subsidy_count, 0),
    }));
    
    return c.json<ApiResponse<{ 
      prefectures: Region[]; 
      groups: typeof groupedRegions;
      total_count: number;
    }>>({
      success: true,
      data: {
        prefectures: PREFECTURES,
        groups: groupedRegions,
        total_count: PREFECTURES.reduce((sum, p) => sum + p.subsidy_count, 0),
      },
    });
  } catch (error) {
    console.error('Get regions error:', error instanceof Error ? error.message : String(error));
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get regions' },
    }, 500);
  }
});

/**
 * 全マスタ一括取得（初回ロード用）
 */
masters.get('/all', async (c) => {
  const db = c.env.DB;
  
  try {
    // 並列で全マスタ取得
    let issuers: Issuer[] = DEFAULT_ISSUERS;
    let categories: Category[] = DEFAULT_CATEGORIES;
    let industries: Industry[] = DEFAULT_INDUSTRIES;
    
    try {
      const [issuersResult, categoriesResult, industriesResult] = await Promise.all([
        db.prepare(`SELECT * FROM issuer_master WHERE is_active = 1 ORDER BY sort_order, name`).all(),
        db.prepare(`SELECT * FROM category_master WHERE is_active = 1 ORDER BY sort_order, name`).all(),
        db.prepare(`SELECT * FROM industry_master WHERE is_active = 1 ORDER BY sort_order, name`).all(),
      ]);
      
      if (issuersResult.results?.length) {
        issuers = issuersResult.results.map(toIssuer).filter((i): i is Issuer => i !== null);
      }
      if (categoriesResult.results?.length) {
        categories = categoriesResult.results.map(toCategory).filter((c): c is Category => c !== null);
      }
      if (industriesResult.results?.length) {
        industries = industriesResult.results.map(toIndustry).filter((i): i is Industry => i !== null);
      }
    } catch (dbError) {
      console.log('Master tables not found, using defaults');
    }
    
    // カテゴリツリー
    const major = categories.filter(c => c.category_type === 'major');
    const categoryTree = major.map(m => ({
      ...m,
      children: categories.filter(c => c.parent_id === m.id),
    }));
    
    // 地域グループ
    const regionGroups = REGION_GROUPS.map(group => ({
      name: group.name,
      prefectures: PREFECTURES.filter(p => group.prefectures.includes(p.code)),
      total_count: PREFECTURES
        .filter(p => group.prefectures.includes(p.code))
        .reduce((sum, p) => sum + p.subsidy_count, 0),
    }));
    
    return c.json<ApiResponse<{
      issuers: { list: Issuer[]; grouped: Record<string, Issuer[]> };
      categories: { list: Category[]; tree: typeof categoryTree };
      industries: Industry[];
      regions: { prefectures: Region[]; groups: typeof regionGroups };
    }>>({
      success: true,
      data: {
        issuers: {
          list: issuers,
          grouped: {
            ministry: issuers.filter(i => i.issuer_type === 'ministry'),
            organization: issuers.filter(i => i.issuer_type === 'organization'),
          },
        },
        categories: { list: categories, tree: categoryTree },
        industries,
        regions: { prefectures: PREFECTURES, groups: regionGroups },
      },
    });
  } catch (error) {
    console.error('Get all masters error:', error instanceof Error ? error.message : String(error));
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get masters' },
    }, 500);
  }
});

export default masters;

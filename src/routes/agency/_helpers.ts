/**
 * Agency共通: 型定義・定数・ヘルパー関数
 */

import type { Env, Variables, ApiResponse } from '../../types';

// =====================================================
// 型定義（P2-10: any型排除）
// =====================================================

/** NEWSアイテム共通型 */
export interface NewsItem {
  id: string;
  title: string;
  url: string | null;
  summary: string | null;
  published_at: string | null;
  detected_at: string;
  event_type: 'new' | 'updated' | 'closing' | 'info' | 'alert' | null;
  priority?: number;
  tags?: string[];
  source_key?: string;
}

/** 都道府県NEWSアイテム型 */
export interface PrefectureNewsItem extends NewsItem {
  region_prefecture: string | null;
  is_client_area: boolean;
}

/** おすすめ補助金型 */
export interface Suggestion {
  agency_client_id: string;
  company_id: string;
  client_name: string | null;
  company_name: string | null;
  prefecture: string | null;
  subsidy_id: string;
  status: 'PROCEED' | 'CAUTION' | 'NO';
  score: number;
  match_reasons: string[];
  risk_flags: string[];
  subsidy_title: string | null;
  subsidy_deadline: string | null;
  subsidy_max_limit: number | null;
  deadline_days: number | null;
  rank: number;
}

/** ダッシュボードv2レスポンス型 */
export interface DashboardV2Response {
  news: {
    platform: NewsItem[];
    support_info: NewsItem[];
    prefecture: PrefectureNewsItem[];
    ministry: NewsItem[];
    other_public: NewsItem[];
  };
  suggestions: Suggestion[];
  tasks: {
    pending_intakes: Array<{
      id: string;
      submitted_at: string;
      client_name: string | null;
      company_name: string | null;
      link_code: string | null;
    }>;
    expiring_links: Array<{
      id: string;
      short_code: string | null;
      link_type: string;
      expires_at: string;
      label: string | null;
      client_name: string | null;
      company_name: string | null;
    }>;
    drafts_in_progress: Array<{
      id: string;
      subsidy_id: string | null;
      status: string;
      updated_at: string;
      company_name: string | null;
      client_name: string | null;
    }>;
  };
  kpi: {
    today_search_count: number;
    today_chat_count: number;
    today_draft_count: number;
  };
  stats: {
    totalClients: number;
    activeClients: number;
    clientPrefectures: string[];
  };
  meta: {
    generated_at: string;
    version: string;
    partial_errors?: string[];
  };
}

// =====================================================
// 定数定義（P0-3: 境界値）
// =====================================================
export const LIMITS = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
  DEFAULT_EXPIRES_DAYS: 7,
  MAX_EXPIRES_DAYS: 90,
  MIN_EXPIRES_DAYS: 1,
  DEFAULT_MAX_USES: 1,
  MAX_MAX_USES: 100,
  MIN_MAX_USES: 1,
} as const;

// =====================================================
// ヘルパー関数
// =====================================================

/** 境界値制限付き数値パース（P0-3） */
export function parseIntWithLimits(value: string | undefined, defaultVal: number, min: number, max: number): number {
  const parsed = parseInt(value || '', 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(Math.max(parsed, min), max);
}

/** 安全なJSONパース（P1-9） */
export async function safeParseJsonBody<T>(c: { req: { json: () => Promise<T> } }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await c.req.json() as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Invalid JSON in request body' };
  }
}

/** employee_band計算（P0-4: 境界条件修正） */
export function calculateEmployeeBand(employeeCount: unknown): string {
  const count = Math.max(Number(employeeCount) || 0, 0);
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  if (count <= 100) return '51-100';
  if (count <= 300) return '101-300';
  return '301+';
}

/** ユーザーのagency取得 */
export async function getUserAgency(db: D1Database, userId: string) {
  const ownAgency = await db
    .prepare('SELECT * FROM agencies WHERE owner_user_id = ?')
    .bind(userId)
    .first();
  
  if (ownAgency) return { agency: ownAgency, role: 'owner' };
  
  const membership = await db
    .prepare(`
      SELECT a.*, am.role_in_agency 
      FROM agency_members am
      JOIN agencies a ON am.agency_id = a.id
      WHERE am.user_id = ? AND am.accepted_at IS NOT NULL
    `)
    .bind(userId)
    .first();
  
  if (membership) {
    return { agency: membership, role: membership.role_in_agency };
  }
  
  return null;
}

/** UUID生成 */
export function generateId(): string {
  return crypto.randomUUID();
}

/** トークン生成 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** トークンハッシュ化 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 短縮コード生成（暗号学的に安全な乱数を使用） */
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

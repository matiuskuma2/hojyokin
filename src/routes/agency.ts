/**
 * Agency (士業) API Routes
 * 
 * /api/agency - 士業向けAPI
 * - GET    /api/agency/dashboard    - ダッシュボード統計
 * - GET    /api/agency/clients      - 顧客一覧
 * - POST   /api/agency/clients      - 顧客追加
 * - GET    /api/agency/clients/:id  - 顧客詳細
 * - PUT    /api/agency/clients/:id  - 顧客更新
 * - DELETE /api/agency/clients/:id  - 顧客削除
 * - POST   /api/agency/links        - リンク発行
 * - GET    /api/agency/links        - リンク一覧
 * - DELETE /api/agency/links/:id    - リンク無効化
 * - GET    /api/agency/submissions  - 入力受付一覧
 * - POST   /api/agency/submissions/:id/approve - 入力承認
 * - POST   /api/agency/submissions/:id/reject  - 入力却下
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { sendStaffInviteEmail, sendClientInviteEmail } from '../services/email';

// =====================================================
// 型定義（P2-10: any型排除）
// =====================================================

/** NEWSアイテム共通型 */
interface NewsItem {
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
interface PrefectureNewsItem extends NewsItem {
  region_prefecture: string | null;
  is_client_area: boolean;
}

/** おすすめ補助金型 */
interface Suggestion {
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
interface DashboardV2Response {
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
    partial_errors?: string[];  // P1-5: 部分エラー通知
  };
}

// =====================================================
// 定数定義（P0-3: 境界値）
// =====================================================
const LIMITS = {
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

/**
 * 境界値制限付き数値パース（P0-3）
 */
function parseIntWithLimits(value: string | undefined, defaultVal: number, min: number, max: number): number {
  const parsed = parseInt(value || '', 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * 安全なJSONパース（P1-9）
 */
async function safeParseJsonBody<T>(c: { req: { json: () => Promise<T> } }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await c.req.json() as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Invalid JSON in request body' };
  }
}

/**
 * employee_band計算（P0-4: 境界条件修正）
 */
function calculateEmployeeBand(employeeCount: unknown): string {
  const count = Math.max(Number(employeeCount) || 0, 0);
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  if (count <= 100) return '51-100';
  if (count <= 300) return '101-300';
  return '301+';
}

const agencyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// =====================================================================
// 公開APIエンドポイント（認証不要）
// 認証ミドルウェアの前に配置
// =====================================================================

/**
 * GET /api/agency/public-news - 公開NEWSフィード（認証不要）
 * 
 * クエリパラメータ:
 * - prefecture: 都道府県コード（例: 13）
 * - limit: 取得件数（デフォルト: 20、最大: 50）
 * 
 * P2-1: 士業ダッシュボード連携のテスト用
 */
agencyRoutes.get('/public-news', async (c) => {
  const db = c.env.DB;
  
  const prefectureCode = c.req.query('prefecture') || null;
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
  
  try {
    let newsQuery;
    
    if (prefectureCode) {
      newsQuery = await db.prepare(`
        SELECT id, title, url, summary, 
               COALESCE(published_at, first_seen_at) as published_at, 
               first_seen_at as detected_at, 
               CASE 
                 WHEN first_seen_at >= datetime('now', '-7 days') THEN 'new'
                 WHEN status = 'closed' THEN 'closing'
                 ELSE 'info'
               END as event_type, 
               prefecture_code as region_prefecture, 
               issuer_name,
               subsidy_amount_max,
               subsidy_rate_text,
               status,
               source_type
        FROM subsidy_feed_items
        WHERE source_type IN ('prefecture', 'municipal', 'ministry')
        AND (prefecture_code = ? OR prefecture_code IS NULL)
        ORDER BY 
          CASE WHEN prefecture_code = ? THEN 0 ELSE 1 END,
          first_seen_at DESC
        LIMIT ?
      `).bind(prefectureCode, prefectureCode, limit).all();
    } else {
      newsQuery = await db.prepare(`
        SELECT id, title, url, summary, 
               COALESCE(published_at, first_seen_at) as published_at, 
               first_seen_at as detected_at, 
               CASE 
                 WHEN first_seen_at >= datetime('now', '-7 days') THEN 'new'
                 WHEN status = 'closed' THEN 'closing'
                 ELSE 'info'
               END as event_type, 
               prefecture_code as region_prefecture, 
               issuer_name,
               subsidy_amount_max,
               subsidy_rate_text,
               status,
               source_type
        FROM subsidy_feed_items
        WHERE source_type IN ('prefecture', 'municipal', 'ministry')
        ORDER BY first_seen_at DESC
        LIMIT ?
      `).bind(limit).all();
    }
    
    const items = (newsQuery.results || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      summary: n.summary,
      published_at: n.published_at,
      detected_at: n.detected_at,
      event_type: n.event_type,
      region_prefecture: n.region_prefecture,
      issuer_name: n.issuer_name,
      subsidy_amount_max: n.subsidy_amount_max,
      subsidy_rate_text: n.subsidy_rate_text,
      status: n.status,
      source_type: n.source_type,
    }));
    
    return c.json<ApiResponse<{
      items: typeof items;
      total: number;
      prefecture_filter: string | null;
      generated_at: string;
    }>>({
      success: true,
      data: {
        items,
        total: items.length,
        prefecture_filter: prefectureCode,
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('[public-news] Error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch news',
      },
    }, 500);
  }
});

// 全ルートで認証必須（public-news以外）
agencyRoutes.use('/*', requireAuth);

// ヘルパー: ユーザーのagency取得
async function getUserAgency(db: D1Database, userId: string) {
  // まず自分がオーナーのagencyを探す
  const ownAgency = await db
    .prepare('SELECT * FROM agencies WHERE owner_user_id = ?')
    .bind(userId)
    .first();
  
  if (ownAgency) return { agency: ownAgency, role: 'owner' };
  
  // メンバーとして参加しているagencyを探す
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

// ヘルパー: UUID生成
function generateId(): string {
  return crypto.randomUUID();
}

// ヘルパー: トークン生成
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ヘルパー: トークンハッシュ化
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ヘルパー: 短縮コード生成
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GET /api/agency/me - 自分のagency情報取得（なければ作成）
 */
agencyRoutes.get('/me', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  let agencyInfo = await getUserAgency(db, user.id);
  
  // agencyがない場合、ユーザーがagencyロールなら自動作成
  if (!agencyInfo && user.role === 'agency') {
    const agencyId = generateId();
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO agencies (id, name, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(agencyId, `${user.email}の事務所`, user.id, now, now).run();
    
    agencyInfo = await getUserAgency(db, user.id);
  }
  
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: agencyInfo,
  });
});

/**
 * PUT /api/agency/me - agency情報更新
 */
agencyRoutes.put('/me', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const body = await c.req.json();
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo || agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only agency owner can update' },
    }, 403);
  }
  
  const { name, settings } = body;
  const now = new Date().toISOString();
  
  await db.prepare(`
    UPDATE agencies SET name = ?, settings_json = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    name || agencyInfo.agency.name,
    settings ? JSON.stringify(settings) : agencyInfo.agency.settings_json,
    now,
    agencyInfo.agency.id
  ).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Updated' },
  });
});

/**
 * GET /api/agency/dashboard - ダッシュボード統計
 */
agencyRoutes.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const today = new Date().toISOString().split('T')[0];
  
  // 統計取得
  const [
    totalClients,
    activeClients,
    pendingSubmissions,
    todaySearches,
    totalDrafts,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM agency_clients WHERE agency_id = ?')
      .bind(agencyId).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM agency_clients WHERE agency_id = ? AND status = ?')
      .bind(agencyId, 'active').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM intake_submissions WHERE agency_id = ? AND status = ?')
      .bind(agencyId, 'submitted').first<{ count: number }>(),
    db.prepare(`
      SELECT COUNT(*) as count FROM usage_events 
      WHERE event_type = 'SUBSIDY_SEARCH' 
      AND user_id IN (SELECT user_id FROM agency_members WHERE agency_id = ?)
      AND created_at >= ?
    `).bind(agencyId, today).first<{ count: number }>(),
    db.prepare(`
      SELECT COUNT(*) as count FROM application_drafts ad
      JOIN agency_clients ac ON ad.company_id = ac.company_id
      WHERE ac.agency_id = ?
    `).bind(agencyId).first<{ count: number }>(),
  ]);
  
  // 期限が近い補助金
  const upcomingDeadlines = await db.prepare(`
    SELECT DISTINCT sl.subsidy_id, sl.status, sl.deadline_at, ac.client_name, c.name as company_name
    FROM subsidy_lifecycle sl
    JOIN agency_clients ac ON 1=1
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
    AND sl.deadline_at IS NOT NULL
    AND sl.deadline_at > datetime('now')
    AND sl.deadline_at < datetime('now', '+14 days')
    ORDER BY sl.deadline_at ASC
    LIMIT 10
  `).bind(agencyId).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      stats: {
        totalClients: totalClients?.count || 0,
        activeClients: activeClients?.count || 0,
        pendingSubmissions: pendingSubmissions?.count || 0,
        todaySearches: todaySearches?.count || 0,
        totalDrafts: totalDrafts?.count || 0,
      },
      upcomingDeadlines: upcomingDeadlines?.results || [],
    },
  });
});

/**
 * GET /api/agency/clients - 顧客一覧
 */
agencyRoutes.get('/clients', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const { status, search, limit: limitStr, offset: offsetStr } = c.req.query();
  
  // P0-3: 境界値チェック
  const parsedLimit = parseIntWithLimits(limitStr, LIMITS.DEFAULT_PAGE_SIZE, LIMITS.MIN_PAGE_SIZE, LIMITS.MAX_PAGE_SIZE);
  const parsedOffset = parseIntWithLimits(offsetStr, 0, 0, Number.MAX_SAFE_INTEGER);
  
  let query = `
    SELECT 
      ac.*,
      c.name as company_name,
      c.prefecture,
      c.industry_major as industry,
      c.employee_count,
      (SELECT COUNT(*) FROM application_drafts ad WHERE ad.company_id = ac.company_id) as draft_count,
      (SELECT MAX(created_at) FROM chat_sessions cs WHERE cs.company_id = ac.company_id) as last_chat_at
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
  `;
  const params: (string | number)[] = [agencyId];
  
  if (status) {
    query += ' AND ac.status = ?';
    params.push(status);
  }
  
  if (search) {
    query += ' AND (ac.client_name LIKE ? OR c.name LIKE ? OR ac.client_email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY ac.created_at DESC LIMIT ? OFFSET ?';
  params.push(parsedLimit, parsedOffset);
  
  const clients = await db.prepare(query).bind(...params).all();
  
  // 総数
  let countQuery = 'SELECT COUNT(*) as count FROM agency_clients ac WHERE ac.agency_id = ?';
  const countParams: (string | number)[] = [agencyId];
  if (status) {
    countQuery += ' AND ac.status = ?';
    countParams.push(status);
  }
  const total = await db.prepare(countQuery).bind(...countParams).first<{ count: number }>();
  
  // 凍結仕様: id を必ず返す + agency_client_id エイリアス追加（互換用）
  // + completeness_status を計算して返す（検索画面用）
  // id 欠損があればログ出力（データ健全性監視）
  const safeClients = (clients?.results || []).map((client: Record<string, unknown>) => {
    if (!client.id) {
      console.warn('[Agency API] client.id is missing:', JSON.stringify(client));
    }
    
    // completeness_status を計算
    // 必須4項目: company_name, prefecture, industry, employee_count
    const hasName = !!(client.company_name && String(client.company_name).trim());
    const hasPrefecture = !!(client.prefecture && String(client.prefecture).trim());
    const hasIndustry = !!(client.industry && String(client.industry).trim());
    // employee_count は文字列（'1-5'等）または数値に対応
    const empVal = client.employee_count;
    const hasEmployeeCount = (() => {
      if (!empVal) return false;
      if (typeof empVal === 'string') {
        const trimmed = empVal.trim();
        return trimmed !== '' && trimmed !== '0';
      }
      return (empVal as number) > 0;
    })();
    
    const isComplete = hasName && hasPrefecture && hasIndustry && hasEmployeeCount;
    
    // 不足フィールドのリスト
    const missingFields: string[] = [];
    if (!hasName) missingFields.push('会社名');
    if (!hasPrefecture) missingFields.push('都道府県');
    if (!hasIndustry) missingFields.push('業種');
    if (!hasEmployeeCount) missingFields.push('従業員数');
    
    return {
      ...client,
      // 互換用エイリアス（UIが揺れても壊れない）
      agency_client_id: client.id,
      client_id: client.id,
      // completeness情報（検索画面用）
      completeness_status: isComplete ? 'OK' : 'BLOCKED',
      missing_fields: missingFields,
    };
  });
  
  // 集計: OK顧客数 / BLOCKED顧客数
  const okCount = safeClients.filter(c => c.completeness_status === 'OK').length;
  const blockedCount = safeClients.filter(c => c.completeness_status === 'BLOCKED').length;
  
  return c.json<ApiResponse<{
    clients: typeof safeClients;
    total: number;
    limit: number;
    offset: number;
    ok_count: number;
    blocked_count: number;
  }>>({
    success: true,
    data: {
      clients: safeClients,
      total: total?.count || 0,
      limit: parsedLimit,
      offset: parsedOffset,
      ok_count: okCount,
      blocked_count: blockedCount,
    },
  });
});

/**
 * POST /api/agency/clients - 顧客追加
 */
agencyRoutes.post('/clients', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    companyName?: string;
    prefecture?: string;
    industry?: string;
    employeeCount?: number | string;
    notes?: string;
    tags?: string[];
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { clientName, clientEmail, clientPhone, companyName, prefecture, industry, employeeCount, notes, tags } = parseResult.data;
  
  if (!clientName || !companyName) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'clientName and companyName are required' },
    }, 400);
  }
  
  // P0-1: employee_count の正規化（文字列→数値変換）
  // 入力がない場合は null（completeness チェックで BLOCKED になる）
  const normalizedEmployeeCount = employeeCount !== undefined && employeeCount !== null && employeeCount !== ''
    ? Math.max(0, Number(employeeCount) || 0)
    : 0;
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  // 会社を作成
  const companyId = generateId();
  // 必須カラム: name, prefecture, industry_major, employee_count, employee_band
  // P0-2: prefecture デフォルトを null に変更（東京都を勝手に設定しない）
  // P0-4: calculateEmployeeBand使用
  await db.prepare(`
    INSERT INTO companies (id, name, prefecture, industry_major, employee_count, employee_band, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    companyId, 
    companyName, 
    prefecture || null, // P0-2: デフォルトを null に変更（completeness で BLOCKED になる）
    industry || null, // P0-2: デフォルトを null に変更
    normalizedEmployeeCount, // P0-1: 正規化された従業員数
    calculateEmployeeBand(normalizedEmployeeCount),
    now, 
    now
  ).run();
  
  // company_profileも作成（company_id がPK）
  await db.prepare(`
    INSERT INTO company_profile (company_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).bind(companyId, now, now).run();
  
  // agency_clientとして登録
  const clientId = generateId();
  await db.prepare(`
    INSERT INTO agency_clients (id, agency_id, company_id, client_name, client_email, client_phone, notes, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    clientId, agencyId, companyId, clientName,
    clientEmail || null, clientPhone || null, notes || null,
    tags ? JSON.stringify(tags) : null, now, now
  ).run();
  
  return c.json<ApiResponse<{ id: string; companyId: string }>>({
    success: true,
    data: { id: clientId, companyId },
  }, 201);
});

/**
 * POST /api/agency/clients/import-csv - 顧客CSVインポート
 * CSVの列順序: 顧客名, 会社名, メール, 電話, 都道府県, 業種, 従業員数, 備考
 */
agencyRoutes.post('/clients/import-csv', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    csvData?: string;
    skipHeader?: boolean;
    updateExisting?: boolean; // 既存顧客の更新を許可するか
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { csvData, skipHeader = true, updateExisting = false } = parseResult.data;
  
  if (!csvData) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'csvData is required' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  // CSV解析
  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  const dataLines = skipHeader && lines.length > 0 ? lines.slice(1) : lines;
  
  if (dataLines.length === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No data rows in CSV' },
    }, 400);
  }
  
  // 制限: 一度に最大100件
  if (dataLines.length > 100) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 rows per import. Please split your CSV file.' },
    }, 400);
  }
  
  // CSVカラム解析ヘルパー
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  }
  
  // 都道府県名→コード変換（逆引き）
  const PREFECTURE_NAME_TO_CODE: Record<string, string> = {};
  for (const [code, name] of Object.entries(PREFECTURE_CODES)) {
    PREFECTURE_NAME_TO_CODE[name] = code;
    // 「都」「府」「県」を省略した形式も対応
    const shortName = name.replace(/(都|府|県)$/, '');
    PREFECTURE_NAME_TO_CODE[shortName] = code;
  }
  
  // 業種マッピング（略称・表記揺れを標準形式に正規化）
  // 注意: 補助金マッチングは日本語でtarget_industryと比較するため、日本語のまま保持
  const INDUSTRY_MAP: Record<string, string> = {
    '製造': '製造業',
    '建設': '建設業',
    'IT': '情報通信業', 'IT業': '情報通信業', '情報サービス': '情報通信業', 'ソフトウェア': '情報通信業',
    '卸売': '卸売業、小売業', '卸売業': '卸売業、小売業',
    '小売': '卸売業、小売業', '小売業': '卸売業、小売業',
    '飲食': '宿泊業、飲食サービス業', '飲食業': '宿泊業、飲食サービス業', '飲食店': '宿泊業、飲食サービス業',
    'サービス': 'サービス業（他に分類されないもの）', 'サービス業': 'サービス業（他に分類されないもの）',
    '医療': '医療、福祉', '医療業': '医療、福祉', 'ヘルスケア': '医療、福祉',
    '福祉': '医療、福祉', '介護': '医療、福祉',
    '教育': '教育、学習支援業', '教育業': '教育、学習支援業',
    '不動産': '不動産業、物品賃貸業', '不動産業': '不動産業、物品賃貸業',
    '金融': '金融業、保険業', '金融業': '金融業、保険業', '保険': '金融業、保険業',
    '運輸': '運輸業、郵便業', '運輸業': '運輸業、郵便業', '物流': '運輸業、郵便業',
    '農業': '農業、林業', '農林水産': '農業、林業',
  };
  
  const results: {
    success: number;
    failed: number;
    updated: number;
    errors: Array<{ row: number; message: string }>;
    created: Array<{ row: number; clientName: string; companyName: string; clientId: string }>;
  } = {
    success: 0,
    failed: 0,
    updated: 0,
    errors: [],
    created: [],
  };
  
  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = skipHeader ? i + 2 : i + 1; // ヘッダー行を考慮した行番号
    const line = dataLines[i];
    
    try {
      const cols = parseCSVLine(line);
      
      // 最低2カラム必要（顧客名、会社名）
      if (cols.length < 2) {
        results.errors.push({ row: rowNum, message: '顧客名と会社名は必須です' });
        results.failed++;
        continue;
      }
      
      const clientName = cols[0]?.trim();
      const companyName = cols[1]?.trim();
      const clientEmail = cols[2]?.trim() || null;
      const clientPhone = cols[3]?.trim() || null;
      const prefectureInput = cols[4]?.trim() || null;
      const industryInput = cols[5]?.trim() || null;
      const employeeCountInput = cols[6]?.trim() || null;
      const notes = cols[7]?.trim() || null;
      
      if (!clientName) {
        results.errors.push({ row: rowNum, message: '顧客名が空です' });
        results.failed++;
        continue;
      }
      
      if (!companyName) {
        results.errors.push({ row: rowNum, message: '会社名が空です' });
        results.failed++;
        continue;
      }
      
      // 都道府県変換
      let prefecture: string | null = null;
      if (prefectureInput) {
        prefecture = PREFECTURE_NAME_TO_CODE[prefectureInput] || prefectureInput;
        // 2桁コードかチェック
        if (prefecture && !/^\d{1,2}$/.test(prefecture)) {
          results.errors.push({ row: rowNum, message: `不正な都道府県: ${prefectureInput}` });
          results.failed++;
          continue;
        }
      }
      
      // 業種変換
      let industry: string | null = null;
      if (industryInput) {
        industry = INDUSTRY_MAP[industryInput] || industryInput;
      }
      
      // 従業員数変換
      const normalizedEmployeeCount = employeeCountInput 
        ? Math.max(0, parseInt(employeeCountInput.replace(/[,人名]/g, ''), 10) || 0)
        : 0;
      
      // updateExistingがtrueの場合、同じ会社名の既存顧客を探す
      if (updateExisting) {
        const existingClient = await db.prepare(`
          SELECT ac.id, ac.company_id FROM agency_clients ac
          JOIN companies c ON ac.company_id = c.id
          WHERE ac.agency_id = ? AND c.name = ?
        `).bind(agencyId, companyName).first<{ id: string; company_id: string }>();
        
        if (existingClient) {
          // 既存顧客を更新
          await db.prepare(`
            UPDATE agency_clients SET
              client_name = ?,
              client_email = COALESCE(?, client_email),
              client_phone = COALESCE(?, client_phone),
              notes = COALESCE(?, notes),
              updated_at = ?
            WHERE id = ?
          `).bind(
            clientName,
            clientEmail,
            clientPhone,
            notes,
            now,
            existingClient.id
          ).run();
          
          // 会社情報も更新
          await db.prepare(`
            UPDATE companies SET
              prefecture = COALESCE(?, prefecture),
              industry_major = COALESCE(?, industry_major),
              employee_count = CASE WHEN ? > 0 THEN ? ELSE employee_count END,
              employee_band = CASE WHEN ? > 0 THEN ? ELSE employee_band END,
              updated_at = ?
            WHERE id = ?
          `).bind(
            prefecture,
            industry,
            normalizedEmployeeCount,
            normalizedEmployeeCount,
            normalizedEmployeeCount,
            calculateEmployeeBand(normalizedEmployeeCount),
            now,
            existingClient.company_id
          ).run();
          
          results.updated++;
          continue;
        }
      }
      
      // 新規作成
      const companyId = generateId();
      const clientId = generateId();
      
      await db.prepare(`
        INSERT INTO companies (id, name, prefecture, industry_major, employee_count, employee_band, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        companyId,
        companyName,
        prefecture,
        industry,
        normalizedEmployeeCount,
        calculateEmployeeBand(normalizedEmployeeCount),
        now,
        now
      ).run();
      
      await db.prepare(`
        INSERT INTO company_profile (company_id, created_at, updated_at)
        VALUES (?, ?, ?)
      `).bind(companyId, now, now).run();
      
      await db.prepare(`
        INSERT INTO agency_clients (id, agency_id, company_id, client_name, client_email, client_phone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        clientId,
        agencyId,
        companyId,
        clientName,
        clientEmail,
        clientPhone,
        notes,
        now,
        now
      ).run();
      
      results.success++;
      results.created.push({ row: rowNum, clientName, companyName, clientId });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({ row: rowNum, message: `処理エラー: ${errorMessage}` });
      results.failed++;
    }
  }
  
  return c.json<ApiResponse<typeof results>>({
    success: true,
    data: results,
  }, results.failed > 0 && results.success === 0 ? 400 : 201);
});

/**
 * GET /api/agency/clients/import-template - CSVテンプレートダウンロード
 */
agencyRoutes.get('/clients/import-template', async (c) => {
  const csvContent = `顧客名,会社名,メールアドレス,電話番号,都道府県,業種,従業員数,備考
山田太郎,株式会社サンプル,yamada@example.com,03-1234-5678,東京都,製造業,50,重要顧客
鈴木花子,有限会社テスト,suzuki@test.co.jp,06-9876-5432,大阪府,IT業,20,`;

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clients_import_template.csv"',
    },
  });
});

/**
 * GET /api/agency/clients/:id - 顧客詳細
 */
agencyRoutes.get('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const client = await db.prepare(`
    SELECT 
      ac.*,
      c.*,
      cp.*
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    LEFT JOIN company_profile cp ON c.id = cp.company_id
    WHERE ac.id = ? AND ac.agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  // 関連データ取得
  const [links, submissions, drafts, sessions] = await Promise.all([
    db.prepare('SELECT * FROM access_links WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM intake_submissions WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM application_drafts WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM chat_sessions WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
  ]);
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      client,
      links: links?.results || [],
      submissions: submissions?.results || [],
      drafts: drafts?.results || [],
      sessions: sessions?.results || [],
    },
  });
});

/**
 * PUT /api/agency/clients/:id - 顧客更新
 */
agencyRoutes.put('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    status?: string;
    notes?: string;
    tags?: string[];
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { clientName, clientEmail, clientPhone, status, notes, tags } = parseResult.data;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE agency_clients SET
      client_name = COALESCE(?, client_name),
      client_email = COALESCE(?, client_email),
      client_phone = COALESCE(?, client_phone),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      tags_json = COALESCE(?, tags_json),
      updated_at = ?
    WHERE id = ? AND agency_id = ?
  `).bind(
    clientName || null, clientEmail || null, clientPhone || null,
    status || null, notes || null, tags ? JSON.stringify(tags) : null,
    now, clientId, agencyInfo.agency.id
  ).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<{ message: string }>>({
    success: true,
    data: { message: 'Updated' },
  });
});

/**
 * PUT /api/agency/clients/:id/company - 顧客企業情報更新
 * 
 * agency_clientsではなく、紐付いたcompaniesテーブルを更新
 */
agencyRoutes.put('/clients/:id/company', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // 顧客の所有確認とcompany_id取得
  const client = await db.prepare(`
    SELECT company_id FROM agency_clients WHERE id = ? AND agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first<{ company_id: string }>();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    companyName?: string;
    prefecture?: string;
    city?: string;
    industry_major?: string;
    industry_minor?: string;
    employee_count?: number;
    capital?: number;
    established_date?: string;
    annual_revenue?: number;
    representative_name?: string;
    website_url?: string;
    contact_email?: string;
    contact_phone?: string;
    business_summary?: string;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { 
    companyName, prefecture, city, industry_major, industry_minor,
    employee_count, capital, established_date, annual_revenue,
    representative_name, website_url, contact_email, contact_phone,
    business_summary
  } = parseResult.data;
  
  const now = new Date().toISOString();
  
  // companiesテーブルを更新
  const companyUpdateFields: string[] = [];
  const companyUpdateValues: (string | number | null)[] = [];
  
  if (companyName !== undefined) {
    companyUpdateFields.push('name = ?');
    companyUpdateValues.push(companyName);
  }
  if (prefecture !== undefined) {
    companyUpdateFields.push('prefecture = ?');
    companyUpdateValues.push(prefecture);
  }
  if (city !== undefined) {
    companyUpdateFields.push('city = ?');
    companyUpdateValues.push(city);
  }
  if (industry_major !== undefined) {
    companyUpdateFields.push('industry_major = ?');
    companyUpdateValues.push(industry_major);
  }
  if (industry_minor !== undefined) {
    companyUpdateFields.push('industry_minor = ?');
    companyUpdateValues.push(industry_minor);
  }
  if (employee_count !== undefined) {
    companyUpdateFields.push('employee_count = ?');
    companyUpdateValues.push(employee_count);
    // P0-4: calculateEmployeeBand使用
    companyUpdateFields.push('employee_band = ?');
    companyUpdateValues.push(calculateEmployeeBand(employee_count));
  }
  if (capital !== undefined) {
    companyUpdateFields.push('capital = ?');
    companyUpdateValues.push(capital);
  }
  if (established_date !== undefined) {
    companyUpdateFields.push('established_date = ?');
    companyUpdateValues.push(established_date);
  }
  if (annual_revenue !== undefined) {
    companyUpdateFields.push('annual_revenue = ?');
    companyUpdateValues.push(annual_revenue);
  }
  
  if (companyUpdateFields.length > 0) {
    companyUpdateFields.push('updated_at = ?');
    companyUpdateValues.push(now);
    companyUpdateValues.push(client.company_id);
    
    await db.prepare(`
      UPDATE companies SET ${companyUpdateFields.join(', ')} WHERE id = ?
    `).bind(...companyUpdateValues).run();
  }
  
  // company_profileテーブルを更新
  const profileUpdateFields: string[] = [];
  const profileUpdateValues: (string | number | null)[] = [];
  
  if (representative_name !== undefined) {
    profileUpdateFields.push('representative_name = ?');
    profileUpdateValues.push(representative_name);
  }
  if (website_url !== undefined) {
    profileUpdateFields.push('website_url = ?');
    profileUpdateValues.push(website_url);
  }
  if (contact_email !== undefined) {
    profileUpdateFields.push('contact_email = ?');
    profileUpdateValues.push(contact_email);
  }
  if (contact_phone !== undefined) {
    profileUpdateFields.push('contact_phone = ?');
    profileUpdateValues.push(contact_phone);
  }
  if (business_summary !== undefined) {
    profileUpdateFields.push('business_summary = ?');
    profileUpdateValues.push(business_summary);
  }
  
  if (profileUpdateFields.length > 0) {
    profileUpdateFields.push('updated_at = ?');
    profileUpdateValues.push(now);
    profileUpdateValues.push(client.company_id);
    
    await db.prepare(`
      UPDATE company_profile SET ${profileUpdateFields.join(', ')} WHERE company_id = ?
    `).bind(...profileUpdateValues).run();
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Company information updated' },
  });
});

/**
 * POST /api/agency/links - リンク発行
 */
agencyRoutes.post('/links', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    companyId?: string;
    sessionId?: string;
    type?: string;
    expiresInDays?: number;
    maxUses?: number;
    label?: string;
    message?: string;
    sendEmail?: boolean;
    recipientEmail?: string;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { companyId, sessionId, type, label, message, sendEmail = false, recipientEmail } = parseResult.data;
  
  // P0-3: 境界値チェック
  const safeExpiresInDays = parseIntWithLimits(
    String(parseResult.data.expiresInDays ?? LIMITS.DEFAULT_EXPIRES_DAYS),
    LIMITS.DEFAULT_EXPIRES_DAYS,
    LIMITS.MIN_EXPIRES_DAYS,
    LIMITS.MAX_EXPIRES_DAYS
  );
  const safeMaxUses = parseIntWithLimits(
    String(parseResult.data.maxUses ?? LIMITS.DEFAULT_MAX_USES),
    LIMITS.DEFAULT_MAX_USES,
    LIMITS.MIN_MAX_USES,
    LIMITS.MAX_MAX_USES
  );
  
  if (!companyId || !type) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'companyId and type are required' },
    }, 400);
  }
  
  if (!['intake', 'chat', 'upload'].includes(type)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid type. Must be intake, chat, or upload' },
    }, 400);
  }
  
  // 顧客の所有確認
  const client = await db.prepare(`
    SELECT * FROM agency_clients WHERE company_id = ? AND agency_id = ?
  `).bind(companyId, agencyInfo.agency.id).first();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  const linkId = generateId();
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const shortCode = generateShortCode();
  const expiresAt = new Date(Date.now() + safeExpiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO access_links (
      id, agency_id, company_id, session_id, type, token_hash, short_code,
      expires_at, max_uses, issued_by_user_id, label, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    linkId, agencyInfo.agency.id, companyId, sessionId || null, type,
    tokenHash, shortCode, expiresAt, safeMaxUses, user.id, label || null, message || null, now
  ).run();
  
  // 生成されたURLを返す（tokenは一度だけ）
  const baseUrl = new URL(c.req.url).origin;
  const linkUrl = `${baseUrl}/${type}?code=${shortCode}`;
  
  // メール送信（オプション）
  let emailSent = false;
  const clientRecord = client as any;
  const emailRecipient = recipientEmail || clientRecord.client_email;
  
  if (sendEmail && emailRecipient) {
    const inviterUser = await db.prepare('SELECT name FROM users WHERE id = ?')
      .bind(user.id).first<{ name: string }>();
    
    const emailResult = await sendClientInviteEmail(c.env, {
      to: emailRecipient,
      inviterName: inviterUser?.name || '担当者',
      agencyName: agencyInfo.agency.name,
      clientName: clientRecord.client_name || '顧客',
      inviteUrl: linkUrl,
      expiresAt,
      message: message || undefined,
    });
    emailSent = emailResult.success;
  }
  
  // P0-2: トークン露出リスク対策 - キャッシュ禁止ヘッダー追加
  // トークンは一度だけ表示されるため、ログやキャッシュに残らないようにする
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  c.header('Pragma', 'no-cache');
  
  return c.json<ApiResponse<{
    id: string;
    shortCode: string;
    url: string;
    token: string;  // WARNING: ワンタイムトークン - ログに記録しないこと
    expiresAt: string;
    type: string;
    email_sent: boolean;
  }>>({
    success: true,
    data: {
      id: linkId,
      shortCode,
      url: linkUrl,
      token, // WARNING: ワンタイムトークン - この値はログに記録しないこと
      expiresAt,
      type,
      email_sent: emailSent,
    },
  }, 201);
});

/**
 * GET /api/agency/links - リンク一覧
 */
agencyRoutes.get('/links', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const { companyId, type, active } = c.req.query();
  
  let query = `
    SELECT al.*, ac.client_name, c.name as company_name
    FROM access_links al
    JOIN agency_clients ac ON al.company_id = ac.company_id AND al.agency_id = ac.agency_id
    JOIN companies c ON al.company_id = c.id
    WHERE al.agency_id = ?
  `;
  const params: any[] = [agencyInfo.agency.id];
  
  if (companyId) {
    query += ' AND al.company_id = ?';
    params.push(companyId);
  }
  
  if (type) {
    query += ' AND al.type = ?';
    params.push(type);
  }
  
  if (active === 'true') {
    query += ' AND al.revoked_at IS NULL AND al.expires_at > datetime("now") AND (al.max_uses IS NULL OR al.used_count < al.max_uses)';
  }
  
  query += ' ORDER BY al.created_at DESC LIMIT 100';
  
  const links = await db.prepare(query).bind(...params).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { links: links?.results || [] },
  });
});

/**
 * DELETE /api/agency/links/:id - リンク無効化
 */
agencyRoutes.delete('/links/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const linkId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE access_links SET revoked_at = ? WHERE id = ? AND agency_id = ?
  `).bind(now, linkId, agencyInfo.agency.id).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Link not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Link revoked' },
  });
});

/**
 * GET /api/agency/submissions - 入力受付一覧
 */
agencyRoutes.get('/submissions', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const { status } = c.req.query();
  
  let query = `
    SELECT is2.*, ac.client_name, c.name as company_name
    FROM intake_submissions is2
    JOIN agency_clients ac ON is2.company_id = ac.company_id AND is2.agency_id = ac.agency_id
    JOIN companies c ON is2.company_id = c.id
    WHERE is2.agency_id = ?
  `;
  const params: any[] = [agencyInfo.agency.id];
  
  if (status) {
    query += ' AND is2.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY is2.created_at DESC LIMIT 100';
  
  const submissions = await db.prepare(query).bind(...params).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { submissions: submissions?.results || [] },
  });
});

/**
 * POST /api/agency/submissions/:id/approve - 入力承認（会社情報に反映）
 */
agencyRoutes.post('/submissions/:id/approve', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const submissionId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const submission = await db.prepare(`
    SELECT * FROM intake_submissions WHERE id = ? AND agency_id = ?
  `).bind(submissionId, agencyInfo.agency.id).first<any>();
  
  if (!submission) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Submission not found' },
    }, 404);
  }
  
  if (submission.status !== 'submitted') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Submission already processed' },
    }, 400);
  }
  
  const now = new Date().toISOString();
  
  // payload_json のパース（DBからの値だが念のため try-catch）
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(submission.payload_json || '{}');
  } catch (e) {
    console.error('Failed to parse payload_json:', e);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'PARSE_ERROR', message: 'Failed to parse submission data' },
    }, 500);
  }
  
  // ========================================
  // 凍結仕様v1: intake承認時のバリデーション
  // 必須4項目は必ず有効値である必要がある
  // ========================================
  
  // payloadから必要な値を取得（キー名揺れに対応）
  const nameValue = payload.name || payload.companyName;
  const prefectureValue = payload.prefecture;
  const industryValue = payload.industry || payload.industry_major;
  const employeeValue = payload.employee_count || payload.employeeCount;
  
  // 必須項目バリデーション（フィールド別エラー）
  const fieldErrors: Record<string, string> = {};
  
  // 会社名チェック
  if (nameValue !== undefined && (typeof nameValue !== 'string' || !nameValue.trim())) {
    fieldErrors.name = '会社名は空にできません';
  }
  
  // 都道府県チェック
  if (prefectureValue !== undefined && (typeof prefectureValue !== 'string' || !prefectureValue.trim())) {
    fieldErrors.prefecture = '都道府県は空にできません';
  }
  
  // 業種チェック
  if (industryValue !== undefined && (typeof industryValue !== 'string' || !industryValue.trim())) {
    fieldErrors.industry_major = '業種は空にできません';
  }
  
  // 従業員数チェック（凍結仕様: 数値 > 0 必須）
  if (employeeValue !== undefined) {
    const count = typeof employeeValue === 'string' 
      ? parseInt(employeeValue, 10) 
      : employeeValue;
    
    if (typeof count !== 'number' || isNaN(count) || count <= 0) {
      fieldErrors.employee_count = '従業員数は1以上の数値で入力してください';
    } else {
      // 正規化された値をpayloadに設定
      payload.employee_count = count;
      payload.employeeCount = count;
    }
  }
  
  // 資本金チェック（任意だが設定時は0以上）
  const capitalValue = payload.capital;
  if (capitalValue !== undefined && capitalValue !== null) {
    const capital = typeof capitalValue === 'string'
      ? parseInt(capitalValue, 10)
      : capitalValue;
    
    if (typeof capital !== 'number' || isNaN(capital) || capital < 0) {
      fieldErrors.capital = '資本金は0以上の数値で入力してください';
    } else {
      payload.capital = capital;
    }
  }
  
  // 年商チェック（任意だが設定時は0以上）
  const revenueValue = payload.annual_revenue || payload.annualRevenue;
  if (revenueValue !== undefined && revenueValue !== null) {
    const revenue = typeof revenueValue === 'string'
      ? parseInt(revenueValue, 10)
      : revenueValue;
    
    if (typeof revenue !== 'number' || isNaN(revenue) || revenue < 0) {
      fieldErrors.annual_revenue = '年商は0以上の数値で入力してください';
    } else {
      payload.annual_revenue = revenue;
      payload.annualRevenue = revenue;
    }
  }
  
  // バリデーションエラーがあれば承認を拒否
  if (Object.keys(fieldErrors).length > 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力データに問題があります。修正してから再度承認してください',
        fields: fieldErrors,
      },
    }, 400);
  }
  
  // 会社情報を更新（companiesテーブル）
  if (Object.keys(payload).length > 0) {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    // companiesテーブルの許可フィールド（カラム名マッピング）
    const fieldMapping: Record<string, string> = {
      'name': 'name',
      'companyName': 'name',
      'prefecture': 'prefecture',
      'city': 'city',
      'industry': 'industry_major',
      'industry_major': 'industry_major',
      'industry_minor': 'industry_minor',
      'employee_count': 'employee_count',
      'employeeCount': 'employee_count',
      'capital': 'capital',
      'founded_date': 'established_date',
      'establishedDate': 'established_date',
      'annual_revenue': 'annual_revenue',
      'annualRevenue': 'annual_revenue',
    };
    
    const processedFields = new Set<string>();
    for (const [payloadKey, dbField] of Object.entries(fieldMapping)) {
      if (payload[payloadKey] !== undefined && !processedFields.has(dbField)) {
        updateFields.push(`${dbField} = ?`);
        updateValues.push(payload[payloadKey]);
        processedFields.add(dbField);
      }
    }
    
    // P1-2: employee_count が更新される場合は employee_band も自動計算
    if (processedFields.has('employee_count')) {
      const empCount = payload.employee_count || payload.employeeCount || 0;
      updateFields.push('employee_band = ?');
      updateValues.push(calculateEmployeeBand(empCount));
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(now);
      updateValues.push(submission.company_id);
      
      await db.prepare(`
        UPDATE companies SET ${updateFields.join(', ')} WHERE id = ?
      `).bind(...updateValues).run();
    }
    
    // company_profileテーブルも更新（存在する場合）
    const profileFieldMapping: Record<string, string> = {
      'representative_name': 'representative_name',
      'representativeName': 'representative_name',
      'representative_title': 'representative_title',
      'representativeTitle': 'representative_title',
      'website_url': 'website_url',
      'websiteUrl': 'website_url',
      'contact_email': 'contact_email',
      'contactEmail': 'contact_email',
      'contact_phone': 'contact_phone',
      'contactPhone': 'contact_phone',
      'business_summary': 'business_summary',
      'businessSummary': 'business_summary',
      'main_products': 'main_products',
      'mainProducts': 'main_products',
      'main_customers': 'main_customers',
      'mainCustomers': 'main_customers',
      'competitive_advantage': 'competitive_advantage',
      'competitiveAdvantage': 'competitive_advantage',
    };
    
    const profileUpdateFields: string[] = [];
    const profileUpdateValues: any[] = [];
    const processedProfileFields = new Set<string>();
    
    for (const [payloadKey, dbField] of Object.entries(profileFieldMapping)) {
      if (payload[payloadKey] !== undefined && !processedProfileFields.has(dbField)) {
        profileUpdateFields.push(`${dbField} = ?`);
        profileUpdateValues.push(payload[payloadKey]);
        processedProfileFields.add(dbField);
      }
    }
    
    if (profileUpdateFields.length > 0) {
      profileUpdateFields.push('updated_at = ?');
      profileUpdateValues.push(now);
      profileUpdateValues.push(submission.company_id);
      
      await db.prepare(`
        UPDATE company_profile SET ${profileUpdateFields.join(', ')} WHERE company_id = ?
      `).bind(...profileUpdateValues).run();
    }
  }
  
  // ステータス更新
  await db.prepare(`
    UPDATE intake_submissions SET status = 'approved', reviewed_at = ?, reviewed_by_user_id = ?
    WHERE id = ?
  `).bind(now, user.id, submissionId).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Approved and merged' },
  });
});

/**
 * POST /api/agency/submissions/:id/reject - 入力却下
 */
agencyRoutes.post('/submissions/:id/reject', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const submissionId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ reason?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { reason } = parseResult.data;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE intake_submissions SET status = 'rejected', reviewed_at = ?, reviewed_by_user_id = ?, review_notes = ?
    WHERE id = ? AND agency_id = ? AND status = 'submitted'
  `).bind(now, user.id, reason || null, submissionId, agencyInfo.agency.id).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Submission not found or already processed' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Rejected' },
  });
});

// =====================================================
// スタッフ管理 API
// =====================================================

/**
 * GET /api/agency/members - スタッフ一覧
 */
agencyRoutes.get('/members', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  // オーナー情報を取得
  const owner = await db.prepare(`
    SELECT u.id, u.email, u.name, 'owner' as role_in_agency, a.created_at as joined_at
    FROM agencies a
    JOIN users u ON a.owner_user_id = u.id
    WHERE a.id = ?
  `).bind(agencyId).first();
  
  // メンバー一覧取得
  const members = await db.prepare(`
    SELECT 
      am.id as membership_id,
      am.role_in_agency,
      am.accepted_at as joined_at,
      u.id as user_id,
      u.email,
      u.name
    FROM agency_members am
    JOIN users u ON am.user_id = u.id
    WHERE am.agency_id = ? AND am.accepted_at IS NOT NULL
    ORDER BY am.accepted_at DESC
  `).bind(agencyId).all();
  
  // 保留中の招待一覧
  const pendingInvites = await db.prepare(`
    SELECT 
      id,
      email,
      role_in_agency,
      invite_code,
      expires_at,
      created_at
    FROM agency_member_invites
    WHERE agency_id = ? 
      AND accepted_at IS NULL 
      AND revoked_at IS NULL
      AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).bind(agencyId).all();
  
  // オーナーを含めた全メンバーリスト
  const allMembers = [];
  if (owner) {
    allMembers.push({
      user_id: owner.id,
      email: owner.email,
      name: owner.name,
      role: 'owner',
      joined_at: owner.joined_at,
      is_owner: true,
    });
  }
  
  for (const m of (members.results || []) as any[]) {
    allMembers.push({
      membership_id: m.membership_id,
      user_id: m.user_id,
      email: m.email,
      name: m.name,
      role: m.role_in_agency,
      joined_at: m.joined_at,
      is_owner: false,
    });
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      members: allMembers,
      pending_invites: pendingInvites.results || [],
      current_user_role: agencyInfo.role,
    },
  });
});

/**
 * POST /api/agency/members/invite - スタッフ招待
 */
agencyRoutes.post('/members/invite', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーまたは管理者のみ招待可能
  if (agencyInfo.role !== 'owner' && agencyInfo.role !== 'admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner or admin can invite members' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    email?: string;
    role?: string;
    sendEmail?: boolean;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { email, role = 'staff', sendEmail = false } = parseResult.data;
  
  if (!email) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'email is required' },
    }, 400);
  }
  
  // 有効な役割のみ
  if (!['admin', 'staff'].includes(role)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid role. Must be admin or staff' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  // 既にメンバーか確認
  const existingMember = await db.prepare(`
    SELECT am.id FROM agency_members am
    JOIN users u ON am.user_id = u.id
    WHERE am.agency_id = ? AND u.email = ? AND am.accepted_at IS NOT NULL
  `).bind(agencyId, email).first();
  
  if (existingMember) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_MEMBER', message: 'This email is already a member' },
    }, 400);
  }
  
  // 既に保留中の招待があるか確認
  const existingInvite = await db.prepare(`
    SELECT id FROM agency_member_invites
    WHERE agency_id = ? AND email = ? 
      AND accepted_at IS NULL 
      AND revoked_at IS NULL
      AND expires_at > datetime('now')
  `).bind(agencyId, email).first();
  
  if (existingInvite) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'ALREADY_INVITED', message: 'A pending invite already exists for this email' },
    }, 400);
  }
  
  // 招待トークン生成
  const inviteToken = generateToken();
  const inviteTokenHash = await hashToken(inviteToken);
  const inviteCode = generateShortCode();
  const inviteId = generateId();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7日後
  
  await db.prepare(`
    INSERT INTO agency_member_invites (
      id, agency_id, email, role_in_agency, invite_token_hash, invite_code,
      invited_by_user_id, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inviteId, agencyId, email, role, inviteTokenHash, inviteCode,
    user.id, expiresAt, now
  ).run();
  
  // 招待URLを生成（実際の本番URLを使用）
  const baseUrl = c.req.header('origin') || 'https://hojyokin.pages.dev';
  const inviteUrl = `${baseUrl}/agency/join?code=${inviteCode}&token=${inviteToken}`;
  
  // メール送信（オプション）
  let emailSent = false;
  let emailError: string | undefined;
  console.log('[Invite] sendEmail flag:', sendEmail, 'type:', typeof sendEmail);
  
  if (sendEmail) {
    console.log('[Invite] Attempting to send invite email to:', email);
    const inviterUser = await db.prepare('SELECT name FROM users WHERE id = ?')
      .bind(user.id).first<{ name: string }>();
    
    const emailResult = await sendStaffInviteEmail(c.env, {
      to: email,
      inviterName: inviterUser?.name || user.email || '管理者',
      agencyName: agencyInfo.agency.name,
      inviteUrl,
      role,
      expiresAt,
    });
    emailSent = emailResult.success;
    emailError = emailResult.error;
    console.log('[Invite] Email result:', { sent: emailSent, error: emailError });
  } else {
    console.log('[Invite] Email sending skipped - sendEmail is false or falsy');
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      invite_id: inviteId,
      email,
      role,
      invite_code: inviteCode,
      invite_url: inviteUrl,
      expires_at: expiresAt,
      email_sent: emailSent,
      message: sendEmail && emailSent 
        ? 'Invite created and email sent.'
        : 'Invite created. Share the invite URL with the user.',
    },
  }, 201);
});

/**
 * DELETE /api/agency/members/invite/:id - 招待取り消し
 */
agencyRoutes.delete('/members/invite/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const inviteId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーまたは管理者のみ取り消し可能
  if (agencyInfo.role !== 'owner' && agencyInfo.role !== 'admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner or admin can revoke invites' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE agency_member_invites 
    SET revoked_at = ?, revoked_by_user_id = ?
    WHERE id = ? AND agency_id = ? AND accepted_at IS NULL AND revoked_at IS NULL
  `).bind(now, user.id, inviteId, agencyId).run();
  
  if (result.meta.changes === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Invite not found or already processed' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Invite revoked' },
  });
});

/**
 * POST /api/agency/members/join - 招待受諾
 * 
 * Body: { code: string, token: string }
 */
agencyRoutes.post('/members/join', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ code?: string; token?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { code, token } = parseResult.data;
  
  if (!code || !token) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'code and token are required' },
    }, 400);
  }
  
  // 招待を検索
  const tokenHash = await hashToken(token);
  const invite = await db.prepare(`
    SELECT * FROM agency_member_invites
    WHERE invite_code = ? AND invite_token_hash = ?
      AND accepted_at IS NULL 
      AND revoked_at IS NULL
      AND expires_at > datetime('now')
  `).bind(code, tokenHash).first<any>();
  
  if (!invite) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_INVITE', message: 'Invalid or expired invite' },
    }, 400);
  }
  
  // メールアドレスが一致するか確認（セキュリティ強化）
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { 
        code: 'EMAIL_MISMATCH', 
        message: `この招待は ${invite.email} 宛てに送信されました。招待を受諾するには、そのメールアドレスでログインしてください。` 
      },
    }, 403);
  }
  
  // 既にメンバーでないか確認
  const existingMember = await db.prepare(`
    SELECT id FROM agency_members
    WHERE agency_id = ? AND user_id = ?
  `).bind(invite.agency_id, user.id).first();
  
  if (existingMember) {
    // 既に存在する場合は accepted_at を更新
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE agency_members 
      SET accepted_at = ?, role_in_agency = ?
      WHERE agency_id = ? AND user_id = ?
    `).bind(now, invite.role_in_agency, invite.agency_id, user.id).run();
  } else {
    // 新規メンバー追加
    const memberId = generateId();
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO agency_members (
        id, agency_id, user_id, role_in_agency, invited_at, accepted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      memberId, invite.agency_id, user.id, invite.role_in_agency,
      invite.created_at, now, now
    ).run();
  }
  
  // 招待を受諾済みに更新
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE agency_member_invites
    SET accepted_at = ?, accepted_by_user_id = ?
    WHERE id = ?
  `).bind(now, user.id, invite.id).run();
  
  // ユーザーのロールをagencyに変更（まだagencyロールでない場合）
  if (user.role !== 'agency') {
    await db.prepare(`
      UPDATE users SET role = 'agency', updated_at = ?
      WHERE id = ? AND role = 'user'
    `).bind(now, user.id).run();
  }
  
  // agency情報を取得
  const agency = await db.prepare('SELECT * FROM agencies WHERE id = ?')
    .bind(invite.agency_id).first();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      message: 'Successfully joined the agency',
      agency: {
        id: agency?.id,
        name: agency?.name,
      },
      role: invite.role_in_agency,
    },
  });
});

/**
 * DELETE /api/agency/members/:id - メンバー削除（オーナーのみ）
 */
agencyRoutes.delete('/members/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const memberId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーのみ削除可能
  if (agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner can remove members' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  // 自分自身は削除不可
  const member = await db.prepare(`
    SELECT user_id FROM agency_members WHERE id = ? AND agency_id = ?
  `).bind(memberId, agencyId).first<any>();
  
  if (!member) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Member not found' },
    }, 404);
  }
  
  if (member.user_id === user.id) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CANNOT_REMOVE_SELF', message: 'Cannot remove yourself' },
    }, 400);
  }
  
  await db.prepare(`
    DELETE FROM agency_members WHERE id = ? AND agency_id = ?
  `).bind(memberId, agencyId).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Member removed' },
  });
});

/**
 * PUT /api/agency/members/:id/role - メンバー役割変更（オーナーのみ）
 */
agencyRoutes.put('/members/:id/role', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const memberId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーのみ役割変更可能
  if (agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner can change member roles' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ role?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { role } = parseResult.data;
  
  if (!role || !['admin', 'staff'].includes(role)) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid role' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  
  const result = await db.prepare(`
    UPDATE agency_members 
    SET role_in_agency = ?
    WHERE id = ? AND agency_id = ?
  `).bind(role, memberId, agencyId).run();
  
  if (result.meta.changes === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Member not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Role updated', role },
  });
});

/**
 * PUT /api/agency/settings - 事務所設定更新（オーナーのみ）
 */
agencyRoutes.put('/settings', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // オーナーのみ設定変更可能
  if (agencyInfo.role !== 'owner') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owner can update agency settings' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{ name?: string }>(c);
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { name } = parseResult.data;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required' },
    }, 400);
  }
  
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE agencies SET name = ?, updated_at = ? WHERE id = ?
  `).bind(name.trim(), now, agencyInfo.agency.id).run();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Agency settings updated', name: name.trim() },
  });
});

// =====================================================================
// 士業ダッシュボード v2 - NEWSフィード版（情報の泉型）
// =====================================================================

/**
 * GET /api/agency/dashboard-v2 - NEWSフィード付きダッシュボード
 * 
 * レスポンス（凍結仕様）:
 * - news: カテゴリ別NEWSフィード
 *   - platform: プラットフォームお知らせ
 *   - support_info: 新着支援情報サマリー
 *   - prefecture: 都道府県NEWS（顧客所在地優先）
 *   - ministry: 省庁NEWS
 *   - other_public: その他公的機関NEWS
 * - suggestions: 顧客×おすすめ補助金（上位3件/顧客）
 * - tasks: 未処理タスク
 * - kpi: 今日のアクティビティ
 */
agencyRoutes.get('/dashboard-v2', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const today = new Date().toISOString().split('T')[0];
  
  // P1-5: 部分エラー追跡
  const partialErrors: string[] = [];
  
  // ===== 1. 顧客の都道府県を取得（NEWS優先表示用） =====
  let prefCodes: string[] = [];
  try {
    const clientPrefectures = await db.prepare(`
      SELECT DISTINCT c.prefecture
      FROM agency_clients ac
      JOIN companies c ON ac.company_id = c.id
      WHERE ac.agency_id = ? AND c.prefecture IS NOT NULL
    `).bind(agencyId).all();
    
    prefCodes = (clientPrefectures.results || [])
      .map((r: any) => r.prefecture)
      .filter((p: string) => p && p.length === 2);
  } catch (e) {
    console.error('[dashboard-v2] clientPrefectures error:', e);
    partialErrors.push('clientPrefectures');
  }
  
  // ===== 2. NEWSフィード取得（カテゴリ別、堅牢化） =====
  const newsLimit = 10;
  
  // 2-1. プラットフォームお知らせ
  let platformNews: any = { results: [] };
  try {
    platformNews = await db.prepare(`
      SELECT id, title, url, summary, published_at, detected_at, event_type, priority
      FROM subsidy_feed_items
      WHERE source_type = 'platform'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY priority DESC, detected_at DESC
      LIMIT ?
    `).bind(newsLimit).all();
  } catch (e) {
    console.error('[dashboard-v2] platformNews error:', e);
    partialErrors.push('platformNews');
  }
  
  // 2-2. 新着支援情報サマリー
  let supportInfoNews: any = { results: [] };
  try {
    supportInfoNews = await db.prepare(`
      SELECT id, title, url, summary, published_at, detected_at, event_type, tags_json
      FROM subsidy_feed_items
      WHERE source_type = 'support_info'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY detected_at DESC
      LIMIT ?
    `).bind(newsLimit).all();
  } catch (e) {
    console.error('[dashboard-v2] supportInfoNews error:', e);
    partialErrors.push('supportInfoNews');
  }
  
  // 2-3. 都道府県NEWS（顧客所在地優先）
  // source_type: 'prefecture' または 'government' を含む
  // カラム: prefecture_code（2桁コード）
  let prefectureNews: any = { results: [] };
  try {
    if (prefCodes.length > 0) {
      // 顧客所在地の都道府県を優先
      const placeholders = prefCodes.map(() => '?').join(',');
      prefectureNews = await db.prepare(`
        SELECT id, title, url, summary, 
               COALESCE(published_at, first_seen_at) as published_at, 
               first_seen_at as detected_at, 
               CASE 
                 WHEN first_seen_at > datetime('now', '-7 days') THEN 'new'
                 WHEN status = 'closed' THEN 'closing'
                 ELSE 'info'
               END as event_type, 
               prefecture_code as region_prefecture, 
               tags_json,
               issuer_name,
               subsidy_amount_max,
               subsidy_rate_text,
               status,
               CASE WHEN prefecture_code IN (${placeholders}) THEN 1 ELSE 0 END as is_client_area
        FROM subsidy_feed_items
        WHERE source_type IN ('prefecture')
        AND (prefecture_code IN (${placeholders}) OR prefecture_code IS NULL)
        ORDER BY 
          CASE WHEN prefecture_code IN (${placeholders}) THEN 0 ELSE 1 END,
          first_seen_at DESC
        LIMIT ?
      `).bind(...prefCodes, ...prefCodes, newsLimit * 2).all();
    } else {
      // 顧客なしの場合は全国分を表示
      prefectureNews = await db.prepare(`
        SELECT id, title, url, summary, 
               COALESCE(published_at, first_seen_at) as published_at, 
               first_seen_at as detected_at, 
               CASE 
                 WHEN first_seen_at > datetime('now', '-7 days') THEN 'new'
                 WHEN status = 'closed' THEN 'closing'
                 ELSE 'info'
               END as event_type,
               prefecture_code as region_prefecture, 
               tags_json,
               issuer_name,
               subsidy_amount_max,
               subsidy_rate_text,
               status,
               0 as is_client_area
        FROM subsidy_feed_items
        WHERE source_type IN ('prefecture')
        ORDER BY first_seen_at DESC
        LIMIT ?
      `).bind(newsLimit * 2).all();
    }
  } catch (e) {
    console.error('[dashboard-v2] prefectureNews error:', e);
    partialErrors.push('prefectureNews');
  }
  
  // 2-4. 省庁NEWS
  let ministryNews: any = { results: [] };
  try {
    ministryNews = await db.prepare(`
      SELECT id, title, url, summary, published_at, detected_at, event_type, source_key
      FROM subsidy_feed_items
      WHERE source_type = 'ministry'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY detected_at DESC
      LIMIT ?
    `).bind(newsLimit).all();
  } catch (e) {
    console.error('[dashboard-v2] ministryNews error:', e);
    partialErrors.push('ministryNews');
  }
  
  // 2-5. その他公的機関NEWS
  let otherPublicNews: any = { results: [] };
  try {
    otherPublicNews = await db.prepare(`
      SELECT id, title, url, summary, published_at, detected_at, event_type, source_key
      FROM subsidy_feed_items
      WHERE source_type = 'other_public'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY detected_at DESC
      LIMIT ?
    `).bind(newsLimit).all();
  } catch (e) {
    console.error('[dashboard-v2] otherPublicNews error:', e);
    partialErrors.push('otherPublicNews');
  }
  
  // ===== 3. 顧客おすすめ（suggestions） =====
  // 凍結仕様v1: agency_suggestions_cache から取得
  // P1-3-1: 新テーブルスキーマに合わせて修正
  let suggestions: any = { results: [] };
  try {
    suggestions = await db.prepare(`
      SELECT 
        asc.id,
        asc.agency_id,
        asc.company_id,
        asc.subsidy_id,
        asc.status,
        asc.score,
        asc.rank,
        asc.match_reasons_json as match_reasons,
        asc.risk_flags_json as risk_flags,
        asc.subsidy_title,
        asc.subsidy_max_amount as subsidy_max_limit,
        asc.subsidy_rate,
        asc.deadline as acceptance_end_datetime,
        c.name as company_name,
        c.prefecture as company_prefecture,
        c.industry_major as company_industry,
        ac.id as agency_client_id,
        ac.client_name,
        CASE 
          WHEN asc.deadline IS NOT NULL AND asc.deadline != 'null'
          THEN julianday(asc.deadline) - julianday('now')
          ELSE NULL 
        END as deadline_days
      FROM agency_suggestions_cache asc
      JOIN agency_clients ac ON asc.company_id = ac.company_id AND ac.agency_id = asc.agency_id
      JOIN companies c ON asc.company_id = c.id
      WHERE asc.agency_id = ?
      AND asc.rank <= 3
      AND (asc.expires_at IS NULL OR asc.expires_at > datetime('now'))
      ORDER BY ac.client_name, asc.rank
      LIMIT 30
    `).bind(agencyId).all();
  } catch (e) {
    console.error('[dashboard-v2] suggestions error:', e);
    partialErrors.push('suggestions');
  }
  
  // ===== 4. 未処理タスク（堅牢化: 各クエリを個別にtry-catch） =====
  let pendingIntakes: any = { results: [] };
  let expiringLinks: any = { results: [] };
  let draftsInProgress: any = { results: [] };
  
  // 4-1. 承認待ち入力
  try {
    pendingIntakes = await db.prepare(`
      SELECT 
        is_.id, 
        is_.created_at as submitted_at,
        ac.client_name,
        c.name as company_name,
        al.short_code as link_code
      FROM intake_submissions is_
      JOIN access_links al ON is_.access_link_id = al.id
      LEFT JOIN agency_clients ac ON is_.company_id = ac.company_id AND is_.agency_id = ac.agency_id
      LEFT JOIN companies c ON is_.company_id = c.id
      WHERE is_.agency_id = ? AND is_.status = 'submitted'
      ORDER BY is_.created_at DESC
      LIMIT 10
    `).bind(agencyId).all();
  } catch (e) {
    console.error('[dashboard-v2] pendingIntakes error:', e);
    partialErrors.push('pendingIntakes');
  }
  
  // 4-2. 期限切れ間近リンク（7日以内）
  try {
    expiringLinks = await db.prepare(`
      SELECT 
        al.id, 
        al.short_code,
        al.type as link_type,
        al.expires_at,
        al.label,
        ac.client_name,
        c.name as company_name
      FROM access_links al
      LEFT JOIN agency_clients ac ON al.company_id = ac.company_id AND al.agency_id = ac.agency_id
      LEFT JOIN companies c ON al.company_id = c.id
      WHERE al.agency_id = ?
        AND al.expires_at > datetime('now')
        AND al.expires_at < datetime('now', '+7 days')
        AND al.revoked_at IS NULL
        AND (al.max_uses IS NULL OR al.used_count < al.max_uses)
      ORDER BY al.expires_at ASC
      LIMIT 10
    `).bind(agencyId).all();
  } catch (e) {
    console.error('[dashboard-v2] expiringLinks error:', e);
    partialErrors.push('expiringLinks');
  }
  
  // 4-3. 進行中ドラフト
  try {
    draftsInProgress = await db.prepare(`
      SELECT 
        ad.id, 
        ad.subsidy_id, 
        ad.status, 
        ad.updated_at, 
        c.name as company_name, 
        ac.client_name
      FROM application_drafts ad
      JOIN companies c ON ad.company_id = c.id
      LEFT JOIN agency_clients ac ON ad.company_id = ac.company_id
      WHERE ac.agency_id = ? AND ad.status IN ('draft', 'in_progress')
      ORDER BY ad.updated_at DESC
      LIMIT 10
    `).bind(agencyId).all();
  } catch (e) {
    console.error('[dashboard-v2] draftsInProgress error:', e);
    partialErrors.push('draftsInProgress');
  }
  
  // ===== 5. KPI（今日のアクティビティ、堅牢化） =====
  let todaySearches: { count: number } | null = { count: 0 };
  let todayChats: { count: number } | null = { count: 0 };
  let todayDrafts: { count: number } | null = { count: 0 };
  
  try {
    const kpiResults = await Promise.all([
      db.prepare(`
        SELECT COUNT(*) as count FROM usage_events 
        WHERE event_type = 'SUBSIDY_SEARCH' 
        AND user_id IN (SELECT user_id FROM agency_members WHERE agency_id = ? UNION SELECT owner_user_id FROM agencies WHERE id = ?)
        AND created_at >= ?
      `).bind(agencyId, agencyId, today).first<{ count: number }>(),
      
      db.prepare(`
        SELECT COUNT(*) as count FROM usage_events 
        WHERE event_type = 'CHAT_SESSION_STARTED' 
        AND user_id IN (SELECT user_id FROM agency_members WHERE agency_id = ? UNION SELECT owner_user_id FROM agencies WHERE id = ?)
        AND created_at >= ?
      `).bind(agencyId, agencyId, today).first<{ count: number }>(),
      
      db.prepare(`
        SELECT COUNT(*) as count FROM usage_events 
        WHERE event_type = 'DRAFT_GENERATED' 
        AND user_id IN (SELECT user_id FROM agency_members WHERE agency_id = ? UNION SELECT owner_user_id FROM agencies WHERE id = ?)
        AND created_at >= ?
      `).bind(agencyId, agencyId, today).first<{ count: number }>(),
    ]);
    [todaySearches, todayChats, todayDrafts] = kpiResults;
  } catch (e) {
    console.error('[dashboard-v2] KPI error:', e);
    partialErrors.push('kpi');
  }
  
  // ===== 6. 統計（既存dashboard互換、堅牢化） =====
  let totalClients: { count: number } | null = { count: 0 };
  let activeClients: { count: number } | null = { count: 0 };
  
  try {
    const statsResults = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM agency_clients WHERE agency_id = ?')
        .bind(agencyId).first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM agency_clients WHERE agency_id = ? AND status = ?')
        .bind(agencyId, 'active').first<{ count: number }>(),
    ]);
    [totalClients, activeClients] = statsResults;
  } catch (e) {
    console.error('[dashboard-v2] stats error:', e);
    partialErrors.push('stats');
  }
  
  // ===== レスポンス組み立て（凍結仕様） =====
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      // NEWSフィード
      news: {
        platform: (platformNews.results || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          url: n.url,
          summary: n.summary,
          published_at: n.published_at,
          detected_at: n.detected_at,
          event_type: n.event_type,
          priority: n.priority,
        })),
        support_info: (supportInfoNews.results || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          url: n.url,
          summary: n.summary,
          published_at: n.published_at,
          detected_at: n.detected_at,
          event_type: n.event_type,
          tags: safeParseJSON(n.tags_json, []),
        })),
        prefecture: (prefectureNews.results || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          url: n.url,
          summary: n.summary,
          published_at: n.published_at,
          detected_at: n.detected_at,
          event_type: n.event_type,
          region_prefecture: n.region_prefecture,
          tags: safeParseJSON(n.tags_json, []),
          is_client_area: prefCodes.includes(n.region_prefecture),
          // 追加情報（P2-1: 士業ダッシュボード連携）
          issuer_name: n.issuer_name,
          subsidy_amount_max: n.subsidy_amount_max,
          subsidy_rate_text: n.subsidy_rate_text,
          status: n.status,
        })),
        ministry: (ministryNews.results || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          url: n.url,
          summary: n.summary,
          published_at: n.published_at,
          detected_at: n.detected_at,
          event_type: n.event_type,
          source_key: n.source_key,
        })),
        other_public: (otherPublicNews.results || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          url: n.url,
          summary: n.summary,
          published_at: n.published_at,
          detected_at: n.detected_at,
          event_type: n.event_type,
          source_key: n.source_key,
        })),
      },
      
      // 顧客おすすめ（凍結仕様v1: reasons/risksはstring[]）
      suggestions: (suggestions.results || []).map((s: any) => ({
        agency_client_id: s.agency_client_id,
        company_id: s.company_id,
        client_name: s.client_name || s.company_name,
        company_name: s.company_name,
        prefecture: s.company_prefecture,
        subsidy_id: s.subsidy_id,
        status: s.status,
        score: s.score,
        match_reasons: safeParseJSON(s.match_reasons, []),
        risk_flags: safeParseJSON(s.risk_flags, []),
        subsidy_title: s.subsidy_title,
        subsidy_deadline: s.acceptance_end_datetime,
        subsidy_max_limit: s.subsidy_max_limit,
        deadline_days: s.deadline_days ? Math.floor(s.deadline_days) : null,
        rank: s.rank,
      })),
      
      // 未処理タスク
      tasks: {
        pending_intakes: pendingIntakes.results || [],
        expiring_links: expiringLinks.results || [],
        drafts_in_progress: draftsInProgress.results || [],
      },
      
      // KPI
      kpi: {
        today_search_count: todaySearches?.count || 0,
        today_chat_count: todayChats?.count || 0,
        today_draft_count: todayDrafts?.count || 0,
      },
      
      // 統計（互換）
      stats: {
        totalClients: totalClients?.count || 0,
        activeClients: activeClients?.count || 0,
        clientPrefectures: prefCodes,
      },
      
      // メタ情報（P1-5: 部分エラー通知）
      meta: {
        generated_at: new Date().toISOString(),
        version: 'v2',
        ...(partialErrors.length > 0 ? { partial_errors: partialErrors } : {}),
      },
    },
  });
});

// ヘルパー: JSON安全パース（凍結: object禁止）
function safeParseJSON(str: string | null | undefined, fallback: any[] = []): any[] {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    // 配列でなければfallback
    if (!Array.isArray(parsed)) return fallback;
    // 配列内のobjectをstring化（[object Object]事故防止）
    return parsed.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.reason || item.text || item.message || item.description || item.name || JSON.stringify(item);
      }
      return String(item);
    });
  } catch {
    return fallback;
  }
}

// =====================================================
// P1-3: おすすめサジェスト生成API（凍結仕様v1）
// =====================================================

/**
 * POST /api/agency/suggestions/generate - サジェスト生成
 * 凍結仕様v1: ルールベーススコアリングで顧客ごとに上位3件を生成
 * 
 * スコアリングルール:
 * - 地域一致: +40（都道府県一致）/ +20（全国）
 * - 業種一致: +25（明確一致）/ +10（全業種系）
 * - 従業員条件: +25（条件合致）/ -30（不一致）
 * - 締切: 14日以内 -10, 7日以内 -20
 * - 受付外: NO（スコア0）
 * 
 * ステータス判定:
 * - 80以上: PROCEED
 * - 50〜79: CAUTION
 * - 0〜49: NO
 */
agencyRoutes.post('/suggestions/generate', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  // 1. 顧客一覧を取得（BLOCKED以外 = completeness必須項目が揃っている）
  const clientsResult = await db.prepare(`
    SELECT 
      ac.id as client_id,
      ac.company_id,
      c.name as company_name,
      c.prefecture,
      c.industry_major,
      c.employee_count
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
    AND c.name IS NOT NULL AND c.name != ''
    AND c.prefecture IS NOT NULL AND c.prefecture != ''
    AND c.industry_major IS NOT NULL AND c.industry_major != ''
    AND c.employee_count IS NOT NULL AND c.employee_count != '' AND c.employee_count != '0' AND c.employee_count != 0
  `).bind(agencyId).all();
  
  const clients = clientsResult.results || [];
  
  if (clients.length === 0) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        message: 'No eligible clients found (all clients have incomplete required fields)',
        clients_processed: 0,
        suggestions_generated: 0,
      },
    });
  }
  
  // 2. 受付中の補助金を取得
  const subsidiesResult = await db.prepare(`
    SELECT 
      id,
      title,
      subsidy_max_limit,
      subsidy_rate,
      target_area_search,
      target_industry,
      target_number_of_employees,
      acceptance_end_datetime
    FROM subsidy_cache
    WHERE request_reception_display_flag = 1
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY acceptance_end_datetime ASC
    LIMIT 500
  `).all();
  
  const subsidies = subsidiesResult.results || [];
  
  if (subsidies.length === 0) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        message: 'No accepting subsidies found',
        clients_processed: clients.length,
        suggestions_generated: 0,
      },
    });
  }
  
  // 3. 各顧客に対してスコアリング
  const allSuggestions: any[] = [];
  
  // コード→名前のマッピング（DBにはコードで保存されている）
  const prefectureCodeToName: Record<string, string> = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県',
  };
  
  for (const client of clients as any[]) {
    const clientPrefCode = client.prefecture || ''; // DBには '13' のようなコードで保存
    const clientPrefectureName = prefectureCodeToName[clientPrefCode] || clientPrefCode; // '13' → '東京都'
    const clientIndustry = (client.industry_major || '').toLowerCase();
    
    // 従業員数の正規化（文字列 "1-5" → 数値 3）
    let clientEmployeeCount = 0;
    const empStr = String(client.employee_count || '0');
    if (/^\d+$/.test(empStr)) {
      clientEmployeeCount = parseInt(empStr, 10);
    } else if (empStr.includes('-')) {
      const parts = empStr.split('-');
      clientEmployeeCount = Math.floor((parseInt(parts[0], 10) + parseInt(parts[1], 10)) / 2);
    } else if (empStr.includes('+') || empStr.includes('以上')) {
      clientEmployeeCount = 500; // 大企業扱い
    }
    
    const scoredSubsidies: any[] = [];
    
    for (const subsidy of subsidies as any[]) {
      let score = 0;
      const matchReasons: string[] = [];
      const riskFlags: string[] = [];
      const scoreBreakdown: Record<string, number> = {};
      
      // 地域スコア
      const targetArea = subsidy.target_area_search || '';
      const targetAreaLower = targetArea.toLowerCase();
      if (targetAreaLower.includes('全国') || targetArea === '') {
        score += 20;
        scoreBreakdown.area = 20;
        matchReasons.push('全国対象');
      } else if (targetArea.includes(clientPrefectureName) || targetArea.includes(clientPrefCode)) {
        // 都道府県名（東京都）またはコード（13）でマッチング
        score += 40;
        scoreBreakdown.area = 40;
        matchReasons.push(`${clientPrefectureName}が対象地域`);
      } else {
        scoreBreakdown.area = 0;
        riskFlags.push('対象地域外の可能性');
      }
      
      // 業種スコア
      const targetIndustry = (subsidy.target_industry || '').toLowerCase();
      if (targetIndustry.includes('全業種') || targetIndustry.includes('全て') || targetIndustry === '') {
        score += 10;
        scoreBreakdown.industry = 10;
        matchReasons.push('全業種対象');
      } else if (targetIndustry.includes(clientIndustry) || clientIndustry.includes(targetIndustry.slice(0, 3))) {
        score += 25;
        scoreBreakdown.industry = 25;
        matchReasons.push(`${client.industry_major}が対象業種`);
      } else {
        scoreBreakdown.industry = 0;
        riskFlags.push('対象業種の確認が必要');
      }
      
      // 従業員数スコア
      const targetEmployee = (subsidy.target_number_of_employees || '').toLowerCase();
      if (targetEmployee === '' || targetEmployee.includes('制限なし') || targetEmployee.includes('全規模')) {
        score += 25;
        scoreBreakdown.employee = 25;
        matchReasons.push('従業員数制限なし');
      } else if (clientEmployeeCount > 0) {
        // 簡易判定：中小企業（300人以下）向けかどうか
        const isSmallTarget = targetEmployee.includes('中小') || targetEmployee.includes('小規模') || 
                              targetEmployee.includes('300人以下') || targetEmployee.includes('50人以下');
        const isClientSmall = clientEmployeeCount <= 300;
        
        if (isSmallTarget && isClientSmall) {
          score += 25;
          scoreBreakdown.employee = 25;
          matchReasons.push('中小企業向け');
        } else if (!isSmallTarget) {
          score += 15;
          scoreBreakdown.employee = 15;
        } else {
          score -= 30;
          scoreBreakdown.employee = -30;
          riskFlags.push('従業員数条件を満たさない可能性');
        }
      } else {
        scoreBreakdown.employee = 0;
      }
      
      // 締切スコア
      if (subsidy.acceptance_end_datetime) {
        const deadline = new Date(subsidy.acceptance_end_datetime);
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 7) {
          score -= 20;
          scoreBreakdown.deadline = -20;
          riskFlags.push(`締切まであと${daysLeft}日`);
        } else if (daysLeft <= 14) {
          score -= 10;
          scoreBreakdown.deadline = -10;
          riskFlags.push(`締切まであと${daysLeft}日`);
        } else {
          scoreBreakdown.deadline = 0;
        }
      }
      
      // スコアを0〜100に正規化
      score = Math.max(0, Math.min(100, score));
      
      // ステータス判定
      let status: 'PROCEED' | 'CAUTION' | 'NO' = 'NO';
      if (score >= 80) {
        status = 'PROCEED';
      } else if (score >= 50) {
        status = 'CAUTION';
      }
      
      scoredSubsidies.push({
        subsidy_id: subsidy.id,
        score,
        status,
        match_reasons: matchReasons,
        risk_flags: riskFlags,
        score_breakdown: scoreBreakdown,
        subsidy_title: subsidy.title,
        subsidy_max_limit: subsidy.subsidy_max_limit,
        subsidy_rate: subsidy.subsidy_rate,
        acceptance_end_datetime: subsidy.acceptance_end_datetime,
      });
    }
    
    // スコア順でソートし、上位3件を取得
    scoredSubsidies.sort((a, b) => b.score - a.score);
    const top3 = scoredSubsidies.slice(0, 3);
    
    // ランク付けしてallSuggestionsに追加
    top3.forEach((suggestion, index) => {
      allSuggestions.push({
        agency_id: agencyId,
        company_id: client.company_id,
        company_name: client.company_name,
        company_prefecture: clientPrefectureName, // 都道府県名で保存（表示用）
        company_industry: client.industry_major,
        company_employee_count: clientEmployeeCount,
        rank: index + 1,
        ...suggestion,
      });
    });
  }
  
  // 4. キャッシュテーブルをUPSERT
  // まず既存データを削除
  await db.prepare('DELETE FROM agency_suggestions_cache WHERE agency_id = ?').bind(agencyId).run();
  
  // 新しいデータを挿入
  let insertCount = 0;
  for (const suggestion of allSuggestions) {
    const id = crypto.randomUUID();
    const dedupeKey = `${agencyId}:${suggestion.company_id}:${suggestion.subsidy_id}`;
    
    try {
      await db.prepare(`
        INSERT INTO agency_suggestions_cache (
          id, agency_id, company_id, subsidy_id, dedupe_key,
          score, status, rank,
          match_reasons, risk_flags,
          subsidy_title, subsidy_max_limit, subsidy_rate, acceptance_end_datetime,
          company_name, company_prefecture, company_industry, company_employee_count,
          score_breakdown, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        agencyId,
        suggestion.company_id,
        suggestion.subsidy_id,
        dedupeKey,
        suggestion.score,
        suggestion.status,
        suggestion.rank,
        JSON.stringify(suggestion.match_reasons),
        JSON.stringify(suggestion.risk_flags),
        suggestion.subsidy_title,
        suggestion.subsidy_max_limit,
        suggestion.subsidy_rate,
        suggestion.acceptance_end_datetime,
        suggestion.company_name,
        suggestion.company_prefecture,
        suggestion.company_industry,
        suggestion.company_employee_count,
        JSON.stringify(suggestion.score_breakdown),
        now
      ).run();
      insertCount++;
    } catch (e) {
      console.error('[suggestions/generate] Insert error:', e);
    }
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      message: 'Suggestions generated successfully',
      clients_processed: clients.length,
      subsidies_evaluated: subsidies.length,
      suggestions_generated: insertCount,
      generated_at: now,
    },
  });
});

export { agencyRoutes };

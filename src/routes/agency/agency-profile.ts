/**
 * Agency: プロフィール・ダッシュボード(v1)
 * 
 * GET /me           - 自分のAgency情報
 * PUT /me           - Agency名称更新
 * GET /dashboard    - ダッシュボード統計(v1)
 * PUT /settings     - 設定更新
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, generateId, safeParseJsonBody } from './_helpers';

const agencyProfile = new Hono<{ Bindings: Env; Variables: Variables }>();

agencyProfile.get('/me', async (c) => {
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
agencyProfile.put('/me', async (c) => {
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
agencyProfile.get('/dashboard', async (c) => {
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

agencyProfile.put('/settings', async (c) => {
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


export default agencyProfile;

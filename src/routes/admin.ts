/**
 * 管理者API
 * 
 * GET  /api/admin/users - ユーザー一覧
 * GET  /api/admin/users/:id - ユーザー詳細
 * POST /api/admin/users/:id/disable - ユーザー凍結
 * POST /api/admin/users/:id/enable - ユーザー復活
 * POST /api/admin/users/:id/reset-password - 管理者によるパスワードリセット
 * GET  /api/admin/audit - 監査ログ一覧
 * POST /api/cron/sync-jgrants - Cron用JGrants同期（シークレット認証）
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { hashPassword } from '../lib/password';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

// 管理者権限チェックミドルウェア（admin or super_admin）
const requireAdmin = async (c: any, next: () => Promise<void>) => {
  const user = getCurrentUser(c);
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    }, 403);
  }
  await next();
};

// SHA-256ハッシュ関数
async function sha256Hash(input: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 監査ログ記録ヘルパー
async function writeAuditLog(
  db: D1Database,
  params: {
    actorUserId?: string | null;
    targetUserId?: string | null;
    targetCompanyId?: string | null;
    targetResourceType?: string | null;
    targetResourceId?: string | null;
    action: string;
    actionCategory: 'auth' | 'admin' | 'data' | 'system';
    severity?: 'info' | 'warning' | 'critical';
    detailsJson?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  }
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO audit_log (
        id, actor_user_id, target_user_id, target_company_id, target_resource_type, target_resource_id,
        action, action_category, severity, details_json, ip, user_agent, request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      uuidv4(),
      params.actorUserId || null,
      params.targetUserId || null,
      params.targetCompanyId || null,
      params.targetResourceType || null,
      params.targetResourceId || null,
      params.action,
      params.actionCategory,
      params.severity || 'info',
      params.detailsJson ? JSON.stringify(params.detailsJson) : null,
      params.ip || null,
      params.userAgent || null,
      params.requestId || null
    ).run();
  } catch (e) {
    console.error('Audit log write failed:', e);
  }
}

// 全エンドポイントに認証と管理者権限を適用
admin.use('*', requireAuth, requireAdmin);

/**
 * ユーザー一覧
 */
admin.get('/users', async (c) => {
  const db = c.env.DB;
  
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    const search = c.req.query('search') || '';
    const status = c.req.query('status'); // all, active, disabled
    
    let whereClause = '1=1';
    const params: unknown[] = [];
    
    if (search) {
      whereClause += ' AND (email LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status === 'active') {
      whereClause += ' AND (is_disabled = 0 OR is_disabled IS NULL)';
    } else if (status === 'disabled') {
      whereClause += ' AND is_disabled = 1';
    }
    
    // 総数取得
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    
    // ユーザー一覧取得
    const users = await db
      .prepare(`
        SELECT 
          id, email, name, role, 
          is_disabled, disabled_reason, disabled_at, disabled_by,
          last_login_at, failed_login_attempts, lockout_until,
          created_at, updated_at
        FROM users 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();
    
    return c.json<ApiResponse<{
      users: unknown[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>>({
      success: true,
      data: {
        users: users.results,
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          pages: Math.ceil((countResult?.total || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get users',
      },
    }, 500);
  }
});

/**
 * ユーザー詳細
 */
admin.get('/users/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  
  try {
    const user = await db
      .prepare(`
        SELECT 
          id, email, name, role, 
          is_disabled, disabled_reason, disabled_at, disabled_by,
          last_login_at, last_login_ip, created_ip,
          failed_login_attempts, lockout_until,
          email_verified_at, created_at, updated_at
        FROM users 
        WHERE id = ?
      `)
      .bind(userId)
      .first();
    
    if (!user) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    // 最近の監査ログ
    const recentAudit = await db
      .prepare(`
        SELECT id, action, action_category, severity, details_json, ip, created_at
        FROM audit_log 
        WHERE target_user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .bind(userId)
      .all();
    
    // 関連会社
    const companies = await db
      .prepare(`
        SELECT c.id, c.name, uc.role as company_role, uc.is_primary
        FROM user_companies uc
        JOIN companies c ON c.id = uc.company_id
        WHERE uc.user_id = ?
      `)
      .bind(userId)
      .all();
    
    return c.json<ApiResponse<{
      user: unknown;
      recentAudit: unknown[];
      companies: unknown[];
    }>>({
      success: true,
      data: {
        user,
        recentAudit: recentAudit.results,
        companies: companies.results,
      },
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user detail',
      },
    }, 500);
  }
});

/**
 * ユーザー凍結
 */
admin.post('/users/:id/disable', async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const userId = c.req.param('id');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    const body = await c.req.json();
    const { reason } = body;
    
    if (!reason) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'reason is required',
        },
      }, 400);
    }
    
    // 対象ユーザー確認
    const targetUser = await db
      .prepare('SELECT id, email, role FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; role: string }>();
    
    if (!targetUser) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    // 自分自身は凍結不可
    if (targetUser.id === currentUser.id) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot disable yourself',
        },
      }, 403);
    }
    
    // 凍結実行
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users 
        SET is_disabled = 1, disabled_reason = ?, disabled_at = ?, disabled_by = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(reason, now, currentUser.id, now, userId)
      .run();
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      targetUserId: userId,
      action: 'USER_DISABLED',
      actionCategory: 'admin',
      severity: 'warning',
      detailsJson: { email: targetUser.email, reason },
      ip,
      userAgent,
      requestId,
    });
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'User has been disabled',
      },
    });
  } catch (error) {
    console.error('Disable user error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to disable user',
      },
    }, 500);
  }
});

/**
 * ユーザー復活
 */
admin.post('/users/:id/enable', async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const userId = c.req.param('id');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    // 対象ユーザー確認
    const targetUser = await db
      .prepare('SELECT id, email, is_disabled, disabled_reason FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; is_disabled: number; disabled_reason: string }>();
    
    if (!targetUser) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    if (!targetUser.is_disabled) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'User is not disabled',
        },
      }, 400);
    }
    
    // 復活実行
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users 
        SET is_disabled = 0, disabled_reason = NULL, disabled_at = NULL, disabled_by = NULL, 
            failed_login_attempts = 0, lockout_until = NULL, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, userId)
      .run();
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      targetUserId: userId,
      action: 'USER_ENABLED',
      actionCategory: 'admin',
      severity: 'info',
      detailsJson: { email: targetUser.email, previous_reason: targetUser.disabled_reason },
      ip,
      userAgent,
      requestId,
    });
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'User has been enabled',
      },
    });
  } catch (error) {
    console.error('Enable user error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to enable user',
      },
    }, 500);
  }
});

/**
 * 管理者によるパスワードリセット
 */
admin.post('/users/:id/reset-password', async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const userId = c.req.param('id');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  try {
    // 対象ユーザー確認
    const targetUser = await db
      .prepare('SELECT id, email FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string }>();
    
    if (!targetUser) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      }, 404);
    }
    
    // 自分自身のリセットは許可
    // 仮パスワード生成（12文字のランダム文字列）
    const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[b % 56])
      .join('');
    
    // パスワードハッシュ化
    const passwordHash = await hashPassword(tempPassword);
    
    // 更新
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users 
        SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = ?
        WHERE id = ?
      `)
      .bind(passwordHash, now, userId)
      .run();
    
    // password_reset_tokensにも記録（管理者発行として）
    const tokenId = uuidv4();
    const tokenHash = await sha256Hash(tempPassword);
    await db
      .prepare(`
        INSERT INTO password_reset_tokens (
          id, user_id, token_hash, expires_at, issued_by, used_at, request_ip, request_user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'))
      `)
      .bind(tokenId, userId, tokenHash, now, currentUser.id, ip, userAgent)
      .run();
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      targetUserId: userId,
      action: 'PASSWORD_RESET_ISSUED_BY_ADMIN',
      actionCategory: 'admin',
      severity: 'warning',
      detailsJson: { email: targetUser.email, token_id: tokenId },
      ip,
      userAgent,
      requestId,
    });
    
    return c.json<ApiResponse<{ message: string; temp_password: string }>>({
      success: true,
      data: {
        message: 'Password has been reset',
        temp_password: tempPassword, // 管理者に表示、メール送信などで通知
      },
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset password',
      },
    }, 500);
  }
});

/**
 * 監査ログ一覧
 */
admin.get('/audit', async (c) => {
  const db = c.env.DB;
  
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    
    const category = c.req.query('category'); // auth, admin, data, system
    const severity = c.req.query('severity'); // info, warning, critical
    const action = c.req.query('action');
    const userId = c.req.query('user_id');
    const days = Math.min(Math.max(parseInt(c.req.query('days') || '7'), 1), 90);
    
    // 日付計算用
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    let whereClause = `created_at > ?`;
    const params: unknown[] = [sinceDate];
    
    if (category) {
      whereClause += ' AND action_category = ?';
      params.push(category);
    }
    
    if (severity) {
      whereClause += ' AND severity = ?';
      params.push(severity);
    }
    
    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }
    
    if (userId) {
      whereClause += ' AND (actor_user_id = ? OR target_user_id = ?)';
      params.push(userId, userId);
    }
    
    // 総数取得
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM audit_log WHERE ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    
    // 監査ログ取得（JOINクエリ用にal.プレフィックスを追加）
    const joinWhereClause = whereClause.replace(/\b(created_at|action_category|severity|action|actor_user_id|target_user_id)\b/g, 'al.$1');
    const logs = await db
      .prepare(`
        SELECT 
          al.id, al.actor_user_id, al.target_user_id, al.action, al.action_category, al.severity,
          al.details_json, al.ip, al.user_agent, al.created_at,
          actor.email as actor_email, actor.name as actor_name,
          target.email as target_email, target.name as target_name
        FROM audit_log al
        LEFT JOIN users actor ON actor.id = al.actor_user_id
        LEFT JOIN users target ON target.id = al.target_user_id
        WHERE ${joinWhereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();
    
    // サマリー
    const summary = await db
      .prepare(`
        SELECT 
          action_category,
          severity,
          COUNT(*) as count
        FROM audit_log 
        WHERE ${whereClause}
        GROUP BY action_category, severity
      `)
      .bind(...params)
      .all();
    
    return c.json<ApiResponse<{
      logs: unknown[];
      summary: unknown[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>>({
      success: true,
      data: {
        logs: logs.results,
        summary: summary.results,
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          pages: Math.ceil((countResult?.total || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get audit logs',
      },
    }, 500);
  }
});

/**
 * 管理者ダッシュボード統計
 */
admin.get('/stats', async (c) => {
  const db = c.env.DB;
  
  try {
    // ユーザー統計
    const userStats = await db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_disabled = 1 THEN 1 ELSE 0 END) as disabled,
          SUM(CASE WHEN lockout_until > datetime('now') THEN 1 ELSE 0 END) as locked,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as new_week,
          SUM(CASE WHEN last_login_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as active_week
        FROM users
      `)
      .first();
    
    // 会社統計
    const companyStats = await db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as new_week
        FROM companies
      `)
      .first();
    
    // 監査ログサマリー（直近7日）
    const auditSummary = await db
      .prepare(`
        SELECT 
          action_category,
          severity,
          COUNT(*) as count
        FROM audit_log
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY action_category, severity
      `)
      .all();
    
    // 最近の重要イベント
    const criticalEvents = await db
      .prepare(`
        SELECT 
          al.action, al.action_category, al.created_at,
          actor.email as actor_email,
          target.email as target_email
        FROM audit_log al
        LEFT JOIN users actor ON al.actor_user_id = actor.id
        LEFT JOIN users target ON al.target_user_id = target.id
        WHERE al.severity = 'critical' AND al.created_at > datetime('now', '-7 days')
        ORDER BY al.created_at DESC
        LIMIT 10
      `)
      .all();
    
    return c.json<ApiResponse<{
      users: unknown;
      companies: unknown;
      audit_summary: unknown[];
      critical_events: unknown[];
    }>>({
      success: true,
      data: {
        users: userStats,
        companies: companyStats,
        audit_summary: auditSummary.results || [],
        critical_events: criticalEvents.results || [],
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get statistics',
      },
    }, 500);
  }
});

/**
 * 監査ログ統計
 */
admin.get('/audit/stats', async (c) => {
  const db = c.env.DB;
  
  try {
    const days = Math.min(Math.max(parseInt(c.req.query('days') || '7'), 1), 90);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // 日別アクション数
    const dailyStats = await db
      .prepare(`
        SELECT 
          date(created_at) as date,
          action_category,
          COUNT(*) as count
        FROM audit_log 
        WHERE created_at > ?
        GROUP BY date(created_at), action_category
        ORDER BY date DESC
      `)
      .bind(sinceDate)
      .all();
    
    // 重要度別カウント
    const severityStats = await db
      .prepare(`
        SELECT 
          severity,
          COUNT(*) as count
        FROM audit_log 
        WHERE created_at > ?
        GROUP BY severity
      `)
      .bind(sinceDate)
      .all();
    
    // 最近のcriticalログ
    const criticalLogs = await db
      .prepare(`
        SELECT 
          al.id, al.action, al.details_json, al.created_at,
          actor.email as actor_email,
          target.email as target_email
        FROM audit_log al
        LEFT JOIN users actor ON actor.id = al.actor_user_id
        LEFT JOIN users target ON target.id = al.target_user_id
        WHERE al.severity = 'critical' AND al.created_at > ?
        ORDER BY al.created_at DESC
        LIMIT 10
      `)
      .bind(sinceDate)
      .all();
    
    return c.json<ApiResponse<{
      days: number;
      dailyStats: unknown[];
      severityStats: unknown[];
      criticalLogs: unknown[];
    }>>({
      success: true,
      data: {
        days,
        dailyStats: dailyStats.results,
        severityStats: severityStats.results,
        criticalLogs: criticalLogs.results,
      },
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get audit stats',
      },
    }, 500);
  }
});

/**
 * JGrants データ同期（super_admin専用）
 * 
 * POST /api/admin/sync-jgrants
 * 
 * JGrants公開APIから補助金データを取得し、subsidy_cache に upsert
 */
admin.post('/sync-jgrants', async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  // super_admin のみ実行可能
  if (currentUser.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const keyword = body.keyword || '事業'; // デフォルトは「事業」
    const limit = Math.min(body.limit || 100, 500); // 最大500件
    const acceptance = body.acceptance ?? 1; // デフォルトは受付中のみ
    
    // JGrants API 呼び出し
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const params = new URLSearchParams({
      keyword,
      sort: 'acceptance_end_datetime',
      order: 'DESC',
      acceptance: acceptance.toString(),
      limit: limit.toString(),
    });
    
    console.log(`JGrants API call: ${JGRANTS_API_URL}?${params.toString()}`);
    
    const response = await fetch(`${JGRANTS_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('JGrants API error:', response.status, errorText);
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'JGRANTS_API_ERROR',
          message: `JGrants API returned ${response.status}`,
        },
      }, 502);
    }
    
    const data = await response.json() as any;
    const subsidies = data.result || data.subsidies || data.data || [];
    
    if (subsidies.length === 0) {
      return c.json<ApiResponse<{ message: string; count: number }>>({
        success: true,
        data: {
          message: 'No subsidies found from JGrants API',
          count: 0,
        },
      });
    }
    
    // キャッシュ有効期限（7日後）- 同期失敗時も既存キャッシュで検索が動くよう長めに設定
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // バッチでsubsidy_cacheにupsert
    const statements = subsidies.map((s: any) => 
      db.prepare(`
        INSERT OR REPLACE INTO subsidy_cache 
        (id, source, title, subsidy_max_limit, subsidy_rate,
         target_area_search, target_industry, target_number_of_employees,
         acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
         cached_at, expires_at)
        VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).bind(
        s.id,
        s.title || s.name || '',
        s.subsidy_max_limit || null,
        s.subsidy_rate || null,
        s.target_area_search || null,
        s.target_industry || null,
        s.target_number_of_employees || null,
        s.acceptance_start_datetime || null,
        s.acceptance_end_datetime || null,
        s.request_reception_display_flag ?? 1,
        expiresAt
      )
    );
    
    // D1バッチ実行（100件ごとに分割）
    let totalInserted = 0;
    for (let i = 0; i < statements.length; i += 100) {
      const batch = statements.slice(i, i + 100);
      await db.batch(batch);
      totalInserted += batch.length;
    }
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      action: 'JGRANTS_SYNC',
      actionCategory: 'system',
      severity: 'info',
      detailsJson: { 
        keyword, 
        limit, 
        acceptance,
        fetched_count: subsidies.length,
        inserted_count: totalInserted,
      },
      ip,
      userAgent,
      requestId,
    });
    
    return c.json<ApiResponse<{ 
      message: string; 
      fetched: number; 
      inserted: number;
      sample: { id: string; title: string }[];
    }>>({
      success: true,
      data: {
        message: `JGrants data synced successfully`,
        fetched: subsidies.length,
        inserted: totalInserted,
        sample: subsidies.slice(0, 5).map((s: any) => ({
          id: s.id,
          title: s.title || s.name || 'No title',
        })),
      },
    });
  } catch (error) {
    console.error('JGrants sync error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Failed to sync JGrants data: ${error}`,
      },
    }, 500);
  }
});

/**
 * JGrants バルク同期（複数キーワード一括）
 * 
 * POST /api/admin/sync-jgrants/bulk
 * 
 * 凍結されたキーワードセットで一括同期（Cron用）
 * super_admin のみ実行可能
 */
admin.post('/sync-jgrants/bulk', async (c) => {
  const db = c.env.DB;
  const currentUser = getCurrentUser(c);
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  const requestId = c.req.header('x-request-id') || null;
  
  // super_admin のみ実行可能
  if (currentUser.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }
  
  try {
    // 凍結キーワードセット（データ収集パイプライン v1.1）
    const KEYWORDS = [
      '補助金', '助成金', '事業', 'DX', 'IT導入', '省エネ', '雇用', '設備投資',
      '製造業', 'デジタル化', '創業', '販路開拓', '人材育成', '研究開発', '生産性向上',
      '中小企業', '小規模事業者', '新事業', '海外展開', '輸出', '観光', '農業',
      '介護', '福祉', '環境', 'カーボンニュートラル', '脱炭素', 'ものづくり', 'サービス',
      'ECサイト', 'テレワーク', '感染症対策', '賃上げ', '最低賃金', '事業承継', '再構築',
    ];
    
    const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const results: { keyword: string; fetched: number; inserted: number; error?: string }[] = [];
    let totalFetched = 0;
    let totalInserted = 0;
    const seenIds = new Set<string>(); // 重複排除用
    
    for (const keyword of KEYWORDS) {
      try {
        const params = new URLSearchParams({
          keyword,
          sort: 'acceptance_end_datetime',
          order: 'DESC',
          acceptance: '1', // 受付中のみ
          limit: '200', // 各キーワードで最大200件
        });
        
        console.log(`JGrants bulk sync: ${keyword}`);
        
        const response = await fetch(`${JGRANTS_API_URL}?${params.toString()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          results.push({ keyword, fetched: 0, inserted: 0, error: `API ${response.status}` });
          continue;
        }
        
        const data = await response.json() as any;
        const subsidies = data.result || data.subsidies || data.data || [];
        
        // 重複排除してupsert
        const uniqueSubsidies = subsidies.filter((s: any) => {
          if (seenIds.has(s.id)) return false;
          seenIds.add(s.id);
          return true;
        });
        
        if (uniqueSubsidies.length > 0) {
          const statements = uniqueSubsidies.map((s: any) => 
            db.prepare(`
              INSERT OR REPLACE INTO subsidy_cache 
              (id, source, title, subsidy_max_limit, subsidy_rate,
               target_area_search, target_industry, target_number_of_employees,
               acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
               cached_at, expires_at)
              VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            `).bind(
              s.id,
              s.title || s.name || '',
              s.subsidy_max_limit || null,
              s.subsidy_rate || null,
              s.target_area_search || null,
              s.target_industry || null,
              s.target_number_of_employees || null,
              s.acceptance_start_datetime || null,
              s.acceptance_end_datetime || null,
              s.request_reception_display_flag ?? 1,
              expiresAt
            )
          );
          
          // D1バッチ実行（100件ごと）
          for (let i = 0; i < statements.length; i += 100) {
            const batch = statements.slice(i, i + 100);
            await db.batch(batch);
          }
        }
        
        results.push({ 
          keyword, 
          fetched: subsidies.length, 
          inserted: uniqueSubsidies.length 
        });
        totalFetched += subsidies.length;
        totalInserted += uniqueSubsidies.length;
        
        // レート制限対策: 500ms待機
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        results.push({ keyword, fetched: 0, inserted: 0, error: String(err) });
      }
    }
    
    // 監査ログ
    await writeAuditLog(db, {
      actorUserId: currentUser.id,
      action: 'JGRANTS_BULK_SYNC',
      actionCategory: 'system',
      severity: 'info',
      detailsJson: { 
        keywords: KEYWORDS,
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        results,
      },
      ip,
      userAgent,
      requestId,
    });
    
    return c.json<ApiResponse<{
      message: string;
      total_fetched: number;
      total_inserted: number;
      unique_count: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        message: `JGrants bulk sync completed`,
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        unique_count: seenIds.size,
        results,
      },
    });
  } catch (error) {
    console.error('JGrants bulk sync error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Failed to bulk sync JGrants data: ${error}`,
      },
    }, 500);
  }
});

/**
 * subsidy_cache 統計取得
 * 
 * GET /api/admin/subsidy-cache/stats
 */
admin.get('/subsidy-cache/stats', async (c) => {
  const db = c.env.DB;
  
  try {
    // 総数と有効データ数
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) as valid,
        SUM(CASE WHEN source = 'jgrants' THEN 1 ELSE 0 END) as jgrants_count,
        SUM(CASE WHEN source = 'crawl' THEN 1 ELSE 0 END) as crawl_count,
        SUM(CASE WHEN request_reception_display_flag = 1 THEN 1 ELSE 0 END) as accepting,
        MIN(cached_at) as oldest_cache,
        MAX(cached_at) as newest_cache
      FROM subsidy_cache
    `).first();
    
    // ソース別統計
    const bySource = await db.prepare(`
      SELECT 
        source, 
        COUNT(*) as count
      FROM subsidy_cache
      WHERE expires_at > datetime('now')
      GROUP BY source
    `).all();
    
    // 地域別統計（上位10）
    const byArea = await db.prepare(`
      SELECT 
        target_area_search, 
        COUNT(*) as count
      FROM subsidy_cache
      WHERE expires_at > datetime('now')
        AND target_area_search IS NOT NULL
      GROUP BY target_area_search
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    return c.json<ApiResponse<{
      stats: typeof stats;
      by_source: unknown[];
      by_area: unknown[];
    }>>({
      success: true,
      data: {
        stats,
        by_source: bySource.results || [],
        by_area: byArea.results || [],
      },
    });
  } catch (error) {
    console.error('Get cache stats error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get cache stats',
      },
    }, 500);
  }
});

// =====================================================
// P2-3: フィードアイテム JSON インポートAPI
// =====================================================

/**
 * フィードアイテム入力型（インポート用）
 */
interface FeedItemInput {
  title: string;
  summary?: string | null;
  url: string;
  detail_url?: string | null;
  issuer_name?: string | null;
  prefecture_code?: string | null;
  target_area_codes?: string[] | null;
  subsidy_amount_max?: number | null;
  subsidy_rate_text?: string | null;
  deadline?: string | null;
  status?: 'open' | 'closed' | 'upcoming' | 'unknown' | null;
  source_type?: 'platform' | 'support_info' | 'prefecture' | 'ministry' | 'other_public' | 'government' | null;
  pdf_urls?: string[] | null;
  tags?: string[] | null;
}

/**
 * dedupe_key 生成（凍結仕様に準拠）
 * パターン: {source_id}:{urlハッシュ12桁}
 */
async function generateDedupeKey(sourceId: string, url: string): Promise<string> {
  const urlHash = await sha256Hash(url);
  return `${sourceId}:${urlHash.slice(0, 12)}`;
}

/**
 * content_hash 生成（差分検知用）
 */
async function generateContentHash(item: FeedItemInput): Promise<string> {
  const content = JSON.stringify({
    title: item.title,
    summary: item.summary,
    subsidy_amount_max: item.subsidy_amount_max,
    subsidy_rate_text: item.subsidy_rate_text,
    deadline: item.deadline,
    status: item.status,
  });
  const hash = await sha256Hash(content);
  return hash.slice(0, 16);
}

/**
 * POST /api/admin/feed/import
 * 
 * JSONからフィードアイテムを一括インポート
 * 
 * Body:
 * {
 *   source_id: string;           // 必須: ソースID（例: 'manual-import', 'api-partner-xxx'）
 *   items: FeedItemInput[];      // 必須: インポートするアイテム配列
 *   dry_run?: boolean;           // オプション: true の場合は検証のみ（DB保存しない）
 * }
 * 
 * 権限: super_admin のみ
 * 上限: 1回最大200件
 */
admin.post('/feed/import', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin のみ許可
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required for feed import',
      },
    }, 403);
  }
  
  try {
    const body = await c.req.json<{
      source_id: string;
      items: FeedItemInput[];
      dry_run?: boolean;
    }>();
    
    // バリデーション
    if (!body.source_id || typeof body.source_id !== 'string') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'source_id is required',
        },
      }, 400);
    }
    
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array is required and must not be empty',
        },
      }, 400);
    }
    
    // 上限チェック（200件）
    const MAX_ITEMS = 200;
    if (body.items.length > MAX_ITEMS) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Maximum ${MAX_ITEMS} items allowed per import`,
        },
      }, 400);
    }
    
    const isDryRun = body.dry_run === true;
    const sourceId = body.source_id;
    
    // 処理結果カウンター
    let itemsNew = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let itemsError = 0;
    const errors: { index: number; url: string; message: string }[] = [];
    const processedItems: { url: string; action: 'new' | 'updated' | 'skipped' | 'error'; dedupe_key: string }[] = [];
    
    // 各アイテムを処理
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      
      // 必須フィールドチェック
      if (!item.title || !item.url) {
        errors.push({ index: i, url: item.url || 'N/A', message: 'title and url are required' });
        itemsError++;
        continue;
      }
      
      try {
        // dedupe_key と content_hash を生成
        const dedupeKey = await generateDedupeKey(sourceId, item.url);
        const contentHash = await generateContentHash(item);
        const itemId = `${sourceId}-${Date.now()}-${i}`;
        
        // 既存レコードを確認
        const existing = await db.prepare(`
          SELECT content_hash FROM subsidy_feed_items WHERE dedupe_key = ?
        `).bind(dedupeKey).first<{ content_hash: string }>();
        
        if (existing) {
          if (existing.content_hash === contentHash) {
            // 変更なし: スキップ
            itemsSkipped++;
            processedItems.push({ url: item.url, action: 'skipped', dedupe_key: dedupeKey });
            continue;
          } else {
            // 変更あり: 更新
            if (!isDryRun) {
              await db.prepare(`
                UPDATE subsidy_feed_items SET
                  title = ?,
                  summary = ?,
                  subsidy_amount_max = ?,
                  subsidy_rate_text = ?,
                  deadline = ?,
                  status = ?,
                  content_hash = ?,
                  is_new = 0,
                  last_seen_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE dedupe_key = ?
              `).bind(
                item.title,
                item.summary || null,
                item.subsidy_amount_max || null,
                item.subsidy_rate_text || null,
                item.deadline || null,
                item.status || 'unknown',
                contentHash,
                dedupeKey
              ).run();
            }
            itemsUpdated++;
            processedItems.push({ url: item.url, action: 'updated', dedupe_key: dedupeKey });
          }
        } else {
          // 新規: 挿入
          if (!isDryRun) {
            await db.prepare(`
              INSERT INTO subsidy_feed_items 
              (id, dedupe_key, source_id, source_type, title, summary, url, detail_url,
               pdf_urls, issuer_name, prefecture_code, target_area_codes,
               subsidy_amount_max, subsidy_rate_text, deadline, status, 
               tags_json, content_hash, is_new, first_seen_at, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `).bind(
              itemId,
              dedupeKey,
              sourceId,
              item.source_type || 'other_public',
              item.title,
              item.summary || null,
              item.url,
              item.detail_url || item.url,
              item.pdf_urls ? JSON.stringify(item.pdf_urls) : null,
              item.issuer_name || null,
              item.prefecture_code || null,
              item.target_area_codes ? JSON.stringify(item.target_area_codes) : null,
              item.subsidy_amount_max || null,
              item.subsidy_rate_text || null,
              item.deadline || null,
              item.status || 'unknown',
              item.tags ? JSON.stringify(item.tags) : null,
              contentHash
            ).run();
          }
          itemsNew++;
          processedItems.push({ url: item.url, action: 'new', dedupe_key: dedupeKey });
        }
        
      } catch (itemErr) {
        errors.push({ 
          index: i, 
          url: item.url, 
          message: itemErr instanceof Error ? itemErr.message : String(itemErr) 
        });
        itemsError++;
        processedItems.push({ url: item.url, action: 'error', dedupe_key: 'N/A' });
      }
    }
    
    // 監査ログ
    if (!isDryRun) {
      await writeAuditLog(db, {
        actorUserId: user.id,
        action: 'FEED_IMPORT',
        actionCategory: 'admin',
        severity: errors.length > 0 ? 'warning' : 'info',
        detailsJson: {
          source_id: sourceId,
          total: body.items.length,
          new: itemsNew,
          updated: itemsUpdated,
          skipped: itemsSkipped,
          errors: itemsError,
        },
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      });
    }
    
    return c.json<ApiResponse<{
      message: string;
      dry_run: boolean;
      source_id: string;
      total_submitted: number;
      items_new: number;
      items_updated: number;
      items_skipped: number;
      items_error: number;
      errors: { index: number; url: string; message: string }[];
      processed: { url: string; action: string; dedupe_key: string }[];
      timestamp: string;
    }>>({
      success: true,
      data: {
        message: isDryRun ? 'Dry run completed (no changes made)' : 'Feed import completed',
        dry_run: isDryRun,
        source_id: sourceId,
        total_submitted: body.items.length,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        items_skipped: itemsSkipped,
        items_error: itemsError,
        errors,
        processed: processedItems,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Feed import error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    }, 500);
  }
});

export default admin;

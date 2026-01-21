/**
 * 管理者API
 * 
 * GET  /api/admin/users - ユーザー一覧
 * GET  /api/admin/users/:id - ユーザー詳細
 * POST /api/admin/users/:id/disable - ユーザー凍結
 * POST /api/admin/users/:id/enable - ユーザー復活
 * POST /api/admin/users/:id/reset-password - 管理者によるパスワードリセット
 * GET  /api/admin/audit - 監査ログ一覧
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { Env, Variables, ApiResponse } from '../types';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { hashPassword } from '../lib/password';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

// 管理者権限チェックミドルウェア
const requireAdmin = async (c: any, next: () => Promise<void>) => {
  const user = getCurrentUser(c);
  if (user.role !== 'admin') {
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
    
    let whereClause = `al.created_at > ?`;
    const params: unknown[] = [sinceDate];
    
    if (category) {
      whereClause += ' AND al.action_category = ?';
      params.push(category);
    }
    
    if (severity) {
      whereClause += ' AND al.severity = ?';
      params.push(severity);
    }
    
    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }
    
    if (userId) {
      whereClause += ' AND (al.actor_user_id = ? OR al.target_user_id = ?)';
      params.push(userId, userId);
    }
    
    // 総数取得（al.プレフィックスを削除した簡易版WHERE使用）
    const simpleWhereClause = whereClause.replace(/al\./g, '');
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM audit_log WHERE ${simpleWhereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    
    // 監査ログ取得
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
        WHERE ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();
    
    // サマリー（al.プレフィックスを削除）
    const summary = await db
      .prepare(`
        SELECT 
          action_category,
          severity,
          COUNT(*) as count
        FROM audit_log 
        WHERE ${simpleWhereClause}
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

export default admin;

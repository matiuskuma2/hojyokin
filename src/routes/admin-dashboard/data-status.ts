/**
 * Admin Dashboard: データ状態・アラート
 * 
 * GET /updates              - 更新状況一覧
 * GET /data-freshness       - データ鮮度
 * GET /alerts               - アラート
 * GET /wall-chat-status     - 壁打ちチャット状態
 * GET /debug/company-check  - デバッグ: 会社チェック
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../../middleware/auth';

const dataStatus = new Hono<{ Bindings: Env; Variables: Variables }>();

dataStatus.get('/updates', async (c) => {
  const db = c.env.DB;
  
  try {
    // source_registry の更新状況（本番スキーマ対応）
    const registryStats = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN last_crawl_status = 'error' OR last_crawl_status = 'blocked' THEN 1 ELSE 0 END) as error,
        MAX(last_crawled_at) as last_crawl,
        MIN(next_crawl_at) as next_crawl
      FROM source_registry
      GROUP BY scope
    `).all<{
      scope: string; total: number; active: number; paused: number; error: number;
      last_crawl: string; next_crawl: string;
    }>();

    // crawl_queue 状況
    const queueStats = await db.prepare(`
      SELECT 
        kind,
        status,
        COUNT(*) as count,
        MAX(created_at) as latest
      FROM crawl_queue
      GROUP BY kind, status
    `).all<{ kind: string; status: string; count: number; latest: string }>();

    // domain_policy 状況（本番スキーマ対応）
    const domainStats = await db.prepare(`
      SELECT 
        CASE WHEN blocked_until IS NOT NULL AND blocked_until > datetime('now') THEN 1 ELSE 0 END as blocked,
        COUNT(*) as count,
        SUM(success_count) as total_success,
        SUM(failure_count) as total_failures
      FROM domain_policy
      GROUP BY blocked
    `).all<{ blocked: number; count: number; total_success: number; total_failures: number }>();

    // 最近の更新（成功/失敗）
    const recentUpdates = await db.prepare(`
      SELECT 
        event_type,
        domain,
        url,
        success,
        error_code,
        created_at
      FROM usage_events
      WHERE event_type IN ('CRAWL_SUCCESS', 'CRAWL_FAILURE', 'FIRECRAWL_SCRAPE')
      ORDER BY created_at DESC
      LIMIT 50
    `).all<{
      event_type: string; domain: string; url: string;
      success: number; error_code: string; created_at: string;
    }>();

    // subsidy_lifecycle 状況
    const lifecycleStats = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM subsidy_lifecycle
      GROUP BY status
    `).all<{ status: string; count: number }>();

    // Cron/Consumer 実行履歴
    const cronHistory = await db.prepare(`
      SELECT 
        event_type,
        success,
        duration_ms,
        created_at,
        metadata_json
      FROM usage_events
      WHERE event_type IN ('CRON_RUN', 'CONSUMER_RUN')
      ORDER BY created_at DESC
      LIMIT 20
    `).all<{
      event_type: string; success: number; duration_ms: number;
      created_at: string; metadata_json: string;
    }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        registry: registryStats.results || [],
        queue: queueStats.results || [],
        domains: domainStats.results || [],
        lifecycle: lifecycleStats.results || [],
        recent: recentUpdates.results || [],
        cronHistory: cronHistory.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Updates error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'UPDATES_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Agency KPI（superadmin向け）
// ============================================================


dataStatus.get('/data-freshness', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // ソース別の最終更新状況（本番スキーマ対応）
    const sourceStatus = await db.prepare(`
      SELECT 
        scope,
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN last_crawl_status = 'error' OR last_crawl_status = 'blocked' THEN 1 ELSE 0 END) as error,
        MAX(last_crawled_at) as last_update,
        MIN(CASE WHEN enabled = 1 AND next_crawl_at < datetime('now') THEN next_crawl_at END) as overdue_since
      FROM source_registry
      GROUP BY scope
    `).all<{
      scope: string;
      total: number;
      active: number;
      error: number;
      last_update: string | null;
      overdue_since: string | null;
    }>();

    // 24時間以上更新がないソース（本番スキーマ対応）
    const staleSources = await db.prepare(`
      SELECT 
        registry_id as id,
        program_key as name,
        scope,
        CASE WHEN enabled = 1 THEN 'active' ELSE 'paused' END as status,
        last_crawled_at as last_crawl_at,
        next_crawl_at,
        last_crawl_status as last_error
      FROM source_registry
      WHERE enabled = 1
        AND (last_crawled_at IS NULL OR last_crawled_at < datetime('now', '-24 hours'))
      ORDER BY last_crawled_at ASC
      LIMIT 20
    `).all<{
      id: string;
      name: string;
      scope: string;
      status: string;
      last_crawl_at: string | null;
      next_crawl_at: string | null;
      last_error: string | null;
    }>();

    // 補助金データの鮮度
    const subsidyFreshness = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN date(cached_at) = date('now') THEN 1 ELSE 0 END) as updated_today,
        SUM(CASE WHEN date(cached_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week,
        MIN(cached_at) as oldest_update
      FROM subsidy_cache
      GROUP BY source
    `).all<{
      source: string;
      total: number;
      updated_today: number;
      updated_week: number;
      oldest_update: string | null;
    }>();

    // 最近のクロールエラー
    const recentErrors = await db.prepare(`
      SELECT 
        domain_key,
        url,
        status,
        last_error,
        attempts,
        finished_at
      FROM crawl_queue
      WHERE status = 'failed'
      ORDER BY finished_at DESC
      LIMIT 20
    `).all<{
      domain_key: string;
      url: string;
      status: string;
      last_error: string | null;
      attempts: number;
      finished_at: string | null;
    }>();

    // ドメイン別エラー率（本番スキーマ対応）
    const domainHealth = await db.prepare(`
      SELECT 
        domain_key,
        enabled,
        CASE WHEN blocked_until IS NOT NULL AND blocked_until > datetime('now') THEN 1 ELSE 0 END as blocked,
        blocked_until,
        blocked_reason,
        success_count,
        failure_count,
        CASE 
          WHEN (success_count + failure_count) > 0 
          THEN ROUND(CAST(failure_count AS REAL) / (success_count + failure_count) * 100, 2)
          ELSE 0 
        END as failure_rate
      FROM domain_policy
      WHERE failure_count > 0 OR (blocked_until IS NOT NULL AND blocked_until > datetime('now'))
      ORDER BY failure_rate DESC, failure_count DESC
      LIMIT 20
    `).all<{
      domain_key: string;
      enabled: number;
      blocked: number;
      blocked_until: string | null;
      blocked_reason: string | null;
      success_count: number;
      failure_count: number;
      failure_rate: number;
    }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        sources: sourceStatus.results || [],
        staleSources: staleSources.results || [],
        subsidyFreshness: subsidyFreshness.results || [],
        recentErrors: recentErrors.results || [],
        domainHealth: domainHealth.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Data freshness error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'DATA_FRESHNESS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// アラート管理（superadmin向け）
// ============================================================

dataStatus.get('/alerts', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // アラートルール一覧
    const rules = await db.prepare(`
      SELECT * FROM alert_rules ORDER BY enabled DESC, metric ASC
    `).all();

    // 最近のアラート履歴
    const recentAlerts = await db.prepare(`
      SELECT ah.*, ar.name as rule_name, ar.metric
      FROM alert_history ah
      JOIN alert_rules ar ON ah.rule_id = ar.id
      ORDER BY ah.created_at DESC
      LIMIT 50
    `).all();

    // 未解決のアラート数
    const unresolvedCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM alert_history
      WHERE status IN ('fired', 'acknowledged')
    `).first<{ count: number }>();

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        rules: rules.results || [],
        recentAlerts: recentAlerts.results || [],
        unresolvedCount: unresolvedCount?.count || 0,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Alerts error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ALERTS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// 日次KPIスナップショット生成（内部用/Cron用）
// ============================================================


dataStatus.get('/debug/company-check', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  const email = c.req.query('email');
  if (!email) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'email query parameter required',
      },
    }, 400);
  }

  try {
    // 1. ユーザー存在確認
    const targetUser = await db.prepare(`
      SELECT id, email, name, role, created_at, last_login_at
      FROM users 
      WHERE email = ?
    `).bind(email).first<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      created_at: string;
      last_login_at: string | null;
    }>();

    if (!targetUser) {
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          diagnosis: 'USER_NOT_FOUND',
          message: 'ユーザーが存在しません',
          email,
          user: null,
          memberships: [],
          companies: [],
          api_simulation: null,
        },
      });
    }

    // 2. メンバーシップ確認
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const memberships = await db.prepare(`
      SELECT 
        uc.user_id || '-' || uc.company_id as membership_id,
        uc.company_id,
        uc.role as membership_role,
        uc.joined_at as membership_created
      FROM user_companies uc
      WHERE uc.user_id = ?
      ORDER BY uc.joined_at DESC
    `).bind(targetUser.id).all<{
      membership_id: string;
      company_id: string;
      membership_role: string;
      membership_created: string;
    }>();

    // 3. 紐づいている会社の詳細
    // 正テーブル: user_companies（company_membershipsは非推奨）
    const companies = await db.prepare(`
      SELECT 
        c.*,
        uc.role as membership_role
      FROM companies c
      INNER JOIN user_companies uc ON c.id = uc.company_id
      WHERE uc.user_id = ?
      ORDER BY c.created_at DESC
    `).bind(targetUser.id).all<{
      id: string;
      name: string;
      postal_code: string | null;
      prefecture: string;
      city: string | null;
      industry_major: string;
      industry_minor: string | null;
      employee_count: number;
      employee_band: string;
      capital: number | null;
      established_date: string | null;
      annual_revenue: number | null;
      created_at: string;
      updated_at: string;
      membership_role: string;
    }>();

    // 4. UI判定シミュレーション（同じロジックで検査）
    const apiSimulation = {
      would_return_companies: (companies.results?.length || 0) > 0,
      companies_count: companies.results?.length || 0,
      searchable_companies: [] as any[],
      non_searchable_companies: [] as any[],
    };

    for (const company of companies.results || []) {
      const hasName = !!(company.name && company.name.trim());
      const hasPref = !!(company.prefecture && company.prefecture.trim());
      const hasIndustry = !!((company.industry_major && company.industry_major.trim()));
      const hasEmployees = company.employee_count !== null && 
                          company.employee_count !== undefined && 
                          Number(company.employee_count) > 0;
      const isSearchable = hasName && hasPref && hasIndustry && hasEmployees;

      const companyCheck = {
        id: company.id,
        name: company.name,
        prefecture: company.prefecture,
        industry_major: company.industry_major,
        employee_count: company.employee_count,
        employee_count_type: typeof company.employee_count,
        checks: {
          hasName,
          hasPref,
          hasIndustry,
          hasEmployees,
        },
        isSearchable,
      };

      if (isSearchable) {
        apiSimulation.searchable_companies.push(companyCheck);
      } else {
        const missing: string[] = [];
        if (!hasName) missing.push('会社名');
        if (!hasPref) missing.push('都道府県');
        if (!hasIndustry) missing.push('業種');
        if (!hasEmployees) missing.push('従業員数');
        apiSimulation.non_searchable_companies.push({
          ...companyCheck,
          missing_fields: missing,
        });
      }
    }

    // 5. 診断結果
    let diagnosis: string;
    let message: string;

    if (!memberships.results || memberships.results.length === 0) {
      diagnosis = 'NO_MEMBERSHIP';
      message = 'ユーザーに会社メンバーシップがありません。/api/companies は空を返します。';
    } else if (apiSimulation.searchable_companies.length === 0) {
      diagnosis = 'COMPANIES_INCOMPLETE';
      message = '会社はありますが、必須4項目（会社名/都道府県/業種/従業員数）が不完全です。';
    } else {
      diagnosis = 'OK';
      message = `検索可能な会社が ${apiSimulation.searchable_companies.length} 件あります。UIの問題（localStorage/キャッシュ）の可能性があります。`;
    }

    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        diagnosis,
        message,
        email,
        user: targetUser,
        memberships: memberships.results || [],
        companies: companies.results || [],
        api_simulation: apiSimulation,
        recommendation: diagnosis === 'OK' 
          ? 'ユーザーにブラウザの localStorage クリア（Ctrl+Shift+Delete → "すべての期間"）を依頼してください' 
          : diagnosis === 'NO_MEMBERSHIP'
          ? '会社を作成するか、既存の会社に招待してください'
          : '会社情報ページで不足項目を入力してください',
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Company check error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'COMPANY_CHECK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// データ健全性チェック（subsidy_cache）
// ============================================================

/**
 * GET /api/admin/ops/data-health
 * 
 * 補助金データの健全性メトリクスを返す
 * 凍結チェックリスト v1.0 に基づく指標
 */

dataStatus.get('/wall-chat-status', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    // 2026-01-27: Active（受付中）を中心にKPIを表示
    // - Active: acceptance_end_datetime IS NOT NULL AND > now
    // - Expired は参考として別枠に
    
    // ソース別 WALL_CHAT_READY 状況（Active中心）
    const bySource = await db.prepare(`
      SELECT 
        source,
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready_all,
        SUM(CASE WHEN wall_chat_ready = 1 AND acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as ready_active,
        SUM(CASE WHEN wall_chat_ready = 0 OR wall_chat_ready IS NULL THEN 1 ELSE 0 END) as not_ready,
        SUM(CASE WHEN acceptance_end_datetime < datetime('now') THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN json_extract(detail_json, '$.base64_processed') = 1 THEN 1 ELSE 0 END) as base64_processed,
        SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM json_each(json_extract(detail_json, '$.pdf_urls'))
            WHERE value LIKE 'r2://%'
          ) THEN 1 ELSE 0 END
        ) as has_r2_pdf
      FROM subsidy_cache
      GROUP BY source
      ORDER BY ready_active DESC
    `).all<{
      source: string;
      total: number;
      active: number;
      ready_all: number;
      ready_active: number;
      not_ready: number;
      expired: number;
      base64_processed: number;
      has_r2_pdf: number;
    }>();

    // 全体の合計（Active中心）
    const totals = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready_all,
        SUM(CASE WHEN wall_chat_ready = 1 AND acceptance_end_datetime IS NOT NULL AND acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as ready_active,
        SUM(CASE WHEN json_extract(detail_json, '$.base64_processed') = 1 THEN 1 ELSE 0 END) as base64_processed,
        SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM json_each(json_extract(detail_json, '$.pdf_urls'))
            WHERE value LIKE 'r2://%'
          ) THEN 1 ELSE 0 END
        ) as has_r2_pdf
      FROM subsidy_cache
    `).first<{ total: number; active: number; ready_all: number; ready_active: number; base64_processed: number; has_r2_pdf: number }>();

    // 最近 WALL_CHAT_READY になったもの（Active のみ）
    const recentReady = await db.prepare(`
      SELECT id, title, source, cached_at, acceptance_end_datetime
      FROM subsidy_cache
      WHERE wall_chat_ready = 1
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime > datetime('now')
      ORDER BY cached_at DESC
      LIMIT 10
    `).all<{
      id: string;
      title: string;
      source: string;
      cached_at: string;
      acceptance_end_datetime: string;
    }>();

    return c.json<ApiResponse<{
      totals: { 
        total: number; 
        active: number;
        ready_all: number;
        ready_active: number; 
        ready_active_pct: number;
        base64_processed: number;
        has_r2_pdf: number;
        // 後方互換性のため ready, ready_pct も残す
        ready: number;
        ready_pct: number;
      };
      by_source: Array<{
        source: string;
        total: number;
        active: number;
        ready_all: number;
        ready_active: number;
        not_ready: number;
        expired: number;
        ready_active_pct: number;
        base64_processed: number;
        has_r2_pdf: number;
        // 後方互換性
        ready: number;
        ready_pct: number;
      }>;
      recent_ready: Array<{
        id: string;
        title: string;
        source: string;
        cached_at: string;
        acceptance_end_datetime: string;
      }>;
      generated_at: string;
    }>>({
      success: true,
      data: {
        totals: {
          total: totals?.total || 0,
          active: totals?.active || 0,
          ready_all: totals?.ready_all || 0,
          ready_active: totals?.ready_active || 0,
          ready_active_pct: totals?.active ? Math.round((totals.ready_active / totals.active) * 100) : 0,
          base64_processed: totals?.base64_processed || 0,
          has_r2_pdf: totals?.has_r2_pdf || 0,
          // 後方互換性: ready = ready_active (Active中心)
          ready: totals?.ready_active || 0,
          ready_pct: totals?.active ? Math.round((totals.ready_active / totals.active) * 100) : 0,
        },
        by_source: (bySource.results || []).map(s => ({
          ...s,
          ready_active_pct: s.active > 0 ? Math.round((s.ready_active / s.active) * 100) : 0,
          // 後方互換性: ready = ready_active
          ready: s.ready_active,
          ready_pct: s.active > 0 ? Math.round((s.ready_active / s.active) * 100) : 0,
        })),
        recent_ready: recentReady.results || [],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Wall chat status error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'WALL_CHAT_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/extract-forms
 * 
 * P3-2C: PDF抽出テスト用API（1件ずつ手動実行）
 * super_admin限定
 */

export default dataStatus;

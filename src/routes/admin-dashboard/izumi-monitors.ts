/**
 * Admin Dashboard: 泉リンク・監視・更新管理
 * 
 * POST /izumi-link                    - 泉リンク設定
 * GET /izumi-link-status              - 泉リンクステータス
 * GET /monitors                       - 監視対象一覧
 * GET /monitors/:id/files             - 監視対象ファイル
 * GET /change-history                 - 変更履歴
 * GET /pending-updates                - 保留中更新
 * POST /pending-updates/:id/approve   - 更新承認
 * POST /pending-updates/:id/reject    - 更新却下
 * GET /update-detection-logs          - 更新検出ログ
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../../middleware/auth';

const izumiMonitors = new Hono<{ Bindings: Env; Variables: Variables }>();

izumiMonitors.post('/izumi-link', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const { mode = 'dry_run', limit = 100 } = await c.req.json().catch(() => ({}));
    
    // 1. 受付中のjGrants補助金を取得（検索対象）
    const acceptingSubsidies = await db.prepare(`
      SELECT 
        c.id as canonical_id,
        c.name as jgrants_title,
        s.subsidy_max_limit
      FROM subsidy_canonical c
      INNER JOIN subsidy_snapshot s ON c.latest_snapshot_id = s.id
      WHERE c.is_active = 1 AND s.is_accepting = 1
    `).all<{
      canonical_id: string;
      jgrants_title: string;
      subsidy_max_limit: number | null;
    }>();
    
    // 2. 未紐付けの泉データを取得
    const unlinkedIzumi = await db.prepare(`
      SELECT 
        id,
        policy_id,
        title,
        max_amount_value,
        prefecture_code
      FROM izumi_subsidies
      WHERE is_active = 1 AND canonical_id IS NULL
      LIMIT ?
    `).bind(Math.min(limit, 1000)).all<{
      id: string;
      policy_id: number;
      title: string;
      max_amount_value: number | null;
      prefecture_code: string | null;
    }>();
    
    const matches: Array<{
      izumi_id: string;
      policy_id: number;
      izumi_title: string;
      canonical_id: string;
      jgrants_title: string;
      match_type: 'strong' | 'medium' | 'weak';
      match_score: number;
      match_reason: string;
    }> = [];
    
    // 3. マッチング処理（アプリケーション側で実行）
    for (const izumi of unlinkedIzumi.results || []) {
      let bestMatch: typeof matches[0] | null = null;
      
      for (const jgrants of acceptingSubsidies.results || []) {
        // 完全一致（既にDBで処理済みだが念のため）
        if (izumi.title === jgrants.jgrants_title) {
          bestMatch = {
            izumi_id: izumi.id,
            policy_id: izumi.policy_id,
            izumi_title: izumi.title,
            canonical_id: jgrants.canonical_id,
            jgrants_title: jgrants.jgrants_title,
            match_type: 'strong',
            match_score: 0.95,
            match_reason: 'title_exact',
          };
          break;
        }
        
        // jGrantsタイトルが泉タイトルを含む（例: 東京都XXX → XXX）
        if (jgrants.jgrants_title.includes(izumi.title) && izumi.title.length >= 5) {
          const score = 0.80 + (izumi.title.length / jgrants.jgrants_title.length) * 0.1;
          if (!bestMatch || score > bestMatch.match_score) {
            bestMatch = {
              izumi_id: izumi.id,
              policy_id: izumi.policy_id,
              izumi_title: izumi.title,
              canonical_id: jgrants.canonical_id,
              jgrants_title: jgrants.jgrants_title,
              match_type: score >= 0.85 ? 'strong' : 'medium',
              match_score: Math.min(score, 0.90),
              match_reason: 'title_contains',
            };
          }
        }
        
        // 泉タイトルがjGrantsタイトルを含む
        if (izumi.title.includes(jgrants.jgrants_title) && jgrants.jgrants_title.length >= 5) {
          const score = 0.75 + (jgrants.jgrants_title.length / izumi.title.length) * 0.1;
          if (!bestMatch || score > bestMatch.match_score) {
            bestMatch = {
              izumi_id: izumi.id,
              policy_id: izumi.policy_id,
              izumi_title: izumi.title,
              canonical_id: jgrants.canonical_id,
              jgrants_title: jgrants.jgrants_title,
              match_type: 'medium',
              match_score: Math.min(score, 0.85),
              match_reason: 'title_reverse_contains',
            };
          }
        }
        
        // 金額一致 + 部分一致（強化）
        if (izumi.max_amount_value && jgrants.subsidy_max_limit && 
            izumi.max_amount_value === jgrants.subsidy_max_limit) {
          // タイトルの一部が一致するか確認（5文字以上の共通部分）
          const izumiWords = izumi.title.split(/[（）()・\s]/);
          const jgrantsWords = jgrants.jgrants_title.split(/[（）()・\s]/);
          const commonWord = izumiWords.find(w => 
            w.length >= 5 && jgrantsWords.some(jw => jw.includes(w) || w.includes(jw))
          );
          
          if (commonWord) {
            const score = 0.85;
            if (!bestMatch || score > bestMatch.match_score) {
              bestMatch = {
                izumi_id: izumi.id,
                policy_id: izumi.policy_id,
                izumi_title: izumi.title,
                canonical_id: jgrants.canonical_id,
                jgrants_title: jgrants.jgrants_title,
                match_type: 'strong',
                match_score: score,
                match_reason: `amount_match+partial_title(${commonWord})`,
              };
            }
          }
        }
      }
      
      if (bestMatch) {
        matches.push(bestMatch);
      }
    }
    
    // 4. 実際の更新（mode=execute の場合のみ）
    let updated = 0;
    if (mode === 'execute' && matches.length > 0) {
      for (const match of matches) {
        await db.prepare(`
          UPDATE izumi_subsidies 
          SET 
            canonical_id = ?,
            match_method = ?,
            match_score = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          match.canonical_id,
          match.match_reason,
          match.match_score,
          match.izumi_id
        ).run();
        updated++;
      }
    }
    
    return c.json<ApiResponse<{
      mode: string;
      jgrants_accepting_count: number;
      izumi_unlinked_checked: number;
      matches_found: number;
      matches_by_type: { strong: number; medium: number; weak: number };
      updated: number;
      matches_preview: typeof matches;
    }>>({
      success: true,
      data: {
        mode,
        jgrants_accepting_count: acceptingSubsidies.results?.length || 0,
        izumi_unlinked_checked: unlinkedIzumi.results?.length || 0,
        matches_found: matches.length,
        matches_by_type: {
          strong: matches.filter(m => m.match_type === 'strong').length,
          medium: matches.filter(m => m.match_type === 'medium').length,
          weak: matches.filter(m => m.match_type === 'weak').length,
        },
        updated,
        matches_preview: matches.slice(0, 20), // プレビュー用に20件まで
      },
    });
    
  } catch (error) {
    console.error('Izumi link error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * 泉紐付け状況確認
 */
izumiMonitors.get('/izumi-link-status', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    // 紐付け状況
    const linkStatus = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN canonical_id IS NOT NULL THEN 1 ELSE 0 END) as linked,
        SUM(CASE WHEN canonical_id IS NULL THEN 1 ELSE 0 END) as not_linked
      FROM izumi_subsidies 
      WHERE is_active = 1
    `).first<{ total: number; linked: number; not_linked: number }>();
    
    // マッチタイプ別
    const byMatchMethod = await db.prepare(`
      SELECT 
        match_method,
        COUNT(*) as count,
        AVG(match_score) as avg_score
      FROM izumi_subsidies 
      WHERE is_active = 1 AND canonical_id IS NOT NULL
      GROUP BY match_method
    `).all<{ match_method: string; count: number; avg_score: number }>();
    
    // 紐付け済みの上位10件
    const linkedSamples = await db.prepare(`
      SELECT 
        i.title as izumi_title,
        c.name as jgrants_title,
        i.match_method,
        i.match_score,
        i.max_amount_value as izumi_amount,
        s.subsidy_max_limit as jgrants_amount
      FROM izumi_subsidies i
      INNER JOIN subsidy_canonical c ON i.canonical_id = c.id
      LEFT JOIN subsidy_snapshot s ON c.latest_snapshot_id = s.id
      WHERE i.is_active = 1 AND i.canonical_id IS NOT NULL
      ORDER BY i.match_score DESC
      LIMIT 10
    `).all<{
      izumi_title: string;
      jgrants_title: string;
      match_method: string;
      match_score: number;
      izumi_amount: number | null;
      jgrants_amount: number | null;
    }>();
    
    return c.json<ApiResponse<{
      summary: { total: number; linked: number; not_linked: number; link_rate: string };
      by_match_method: typeof byMatchMethod.results;
      linked_samples: typeof linkedSamples.results;
    }>>({
      success: true,
      data: {
        summary: {
          total: linkStatus?.total || 0,
          linked: linkStatus?.linked || 0,
          not_linked: linkStatus?.not_linked || 0,
          link_rate: linkStatus?.total 
            ? ((linkStatus.linked / linkStatus.total) * 100).toFixed(2) + '%'
            : '0%',
        },
        by_match_method: byMatchMethod.results || [],
        linked_samples: linkedSamples.results || [],
      },
    });
    
  } catch (error) {
    console.error('Izumi link status error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// =====================================================
// P4/P5: データソース監視・自動更新管理
// =====================================================

/**
 * GET /api/admin-ops/monitors
 * 
 * 監視対象一覧
 */
izumiMonitors.get('/monitors', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const monitors = await db.prepare(`
      SELECT 
        m.id,
        m.subsidy_cache_id,
        m.source_name,
        m.source_url,
        m.monitor_type,
        m.status,
        m.last_checked_at,
        m.last_changed_at,
        m.error_count,
        m.consecutive_errors,
        m.last_error,
        sc.title as subsidy_title,
        (SELECT COUNT(*) FROM monitored_files mf WHERE mf.monitor_id = m.id) as file_count,
        (SELECT COUNT(*) FROM file_change_history fch WHERE fch.monitor_id = m.id AND fch.process_status = 'pending') as pending_changes
      FROM data_source_monitors m
      LEFT JOIN subsidy_cache sc ON sc.id = m.subsidy_cache_id
      ORDER BY m.status, m.source_name
    `).all();
    
    return c.json<ApiResponse<{ monitors: any[] }>>({
      success: true,
      data: {
        monitors: monitors.results || [],
      },
    });
    
  } catch (error) {
    console.error('Monitors list error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/monitors/:id/files
 * 
 * 監視対象のファイル一覧
 */
izumiMonitors.get('/monitors/:id/files', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const monitorId = c.req.param('id');
  
  try {
    const files = await db.prepare(`
      SELECT 
        mf.*,
        (SELECT COUNT(*) FROM file_change_history fch WHERE fch.monitored_file_id = mf.id) as change_count
      FROM monitored_files mf
      WHERE mf.monitor_id = ?
      ORDER BY mf.importance DESC, mf.file_name
    `).bind(monitorId).all();
    
    return c.json<ApiResponse<{ files: any[] }>>({
      success: true,
      data: {
        files: files.results || [],
      },
    });
    
  } catch (error) {
    console.error('Monitor files list error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/change-history
 * 
 * ファイル変更履歴
 */
izumiMonitors.get('/change-history', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const status = c.req.query('status');
  
  try {
    let query = `
      SELECT 
        fch.*,
        mf.file_name,
        mf.file_type,
        dsm.source_name,
        sc.title as subsidy_title
      FROM file_change_history fch
      JOIN monitored_files mf ON mf.id = fch.monitored_file_id
      JOIN data_source_monitors dsm ON dsm.id = fch.monitor_id
      LEFT JOIN subsidy_cache sc ON sc.id = fch.subsidy_id
    `;
    
    const params: any[] = [];
    if (status) {
      query += ' WHERE fch.process_status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY fch.detected_at DESC LIMIT ?';
    params.push(limit);
    
    const history = await db.prepare(query).bind(...params).all();
    
    return c.json<ApiResponse<{ history: any[] }>>({
      success: true,
      data: {
        history: history.results || [],
      },
    });
    
  } catch (error) {
    console.error('Change history error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/pending-updates
 * 
 * 保留中の更新一覧
 */
izumiMonitors.get('/pending-updates', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const updates = await db.prepare(`
      SELECT 
        pu.*,
        udl.source_url,
        udl.change_summary,
        sc.title as subsidy_title
      FROM pending_updates pu
      JOIN update_detection_log udl ON udl.id = pu.detection_log_id
      LEFT JOIN subsidy_cache sc ON sc.id = pu.subsidy_id
      WHERE pu.status = 'pending'
      ORDER BY pu.created_at DESC
    `).all();
    
    return c.json<ApiResponse<{ updates: any[] }>>({
      success: true,
      data: {
        updates: updates.results || [],
      },
    });
    
  } catch (error) {
    console.error('Pending updates error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/pending-updates/:id/approve
 * 
 * 更新を承認
 */
izumiMonitors.post('/pending-updates/:id/approve', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const updateId = c.req.param('id');
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const { notes } = body as { notes?: string };
    
    // 更新を取得
    const update = await db.prepare(`
      SELECT * FROM pending_updates WHERE id = ?
    `).bind(updateId).first();
    
    if (!update) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Update not found' },
      }, 404);
    }
    
    // subsidy_cache を更新（field_path に基づく）
    const subsidy = await db.prepare(`
      SELECT detail_json FROM subsidy_cache WHERE id = ?
    `).bind((update as any).subsidy_id).first<{ detail_json: string }>();
    
    if (subsidy && subsidy.detail_json) {
      try {
        const detail = JSON.parse(subsidy.detail_json);
        const fieldPath = (update as any).field_path.replace('detail_json.', '').split('.');
        let current = detail;
        
        // ネストされたフィールドを辿る
        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (!current[fieldPath[i]]) current[fieldPath[i]] = {};
          current = current[fieldPath[i]];
        }
        
        // 値を更新
        const newValue = JSON.parse((update as any).new_value);
        current[fieldPath[fieldPath.length - 1]] = newValue;
        
        await db.prepare(`
          UPDATE subsidy_cache SET detail_json = ?, updated_at = datetime('now') WHERE id = ?
        `).bind(JSON.stringify(detail), (update as any).subsidy_id).run();
        
      } catch (e) {
        console.error('Failed to apply update:', e);
        return c.json<ApiResponse<null>>({
          success: false,
          error: { code: 'APPLY_ERROR', message: `Failed to apply update: ${e}` },
        }, 500);
      }
    }
    
    // ステータス更新
    await db.prepare(`
      UPDATE pending_updates 
      SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = ?, review_notes = ?
      WHERE id = ?
    `).bind(user.id, notes || null, updateId).run();
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'Update approved and applied',
      },
    });
    
  } catch (error) {
    console.error('Approve update error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/pending-updates/:id/reject
 * 
 * 更新を却下
 */
izumiMonitors.post('/pending-updates/:id/reject', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const updateId = c.req.param('id');
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const { notes } = body as { notes?: string };
    
    await db.prepare(`
      UPDATE pending_updates 
      SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = ?, review_notes = ?
      WHERE id = ?
    `).bind(user.id, notes || null, updateId).run();
    
    return c.json<ApiResponse<{ message: string }>>({
      success: true,
      data: {
        message: 'Update rejected',
      },
    });
    
  } catch (error) {
    console.error('Reject update error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * GET /api/admin-ops/update-detection-logs
 * 
 * 更新検出ログ一覧
 */
izumiMonitors.get('/update-detection-logs', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'super_admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  
  try {
    const logs = await db.prepare(`
      SELECT 
        udl.*,
        sc.title as subsidy_title,
        (SELECT COUNT(*) FROM pending_updates pu WHERE pu.detection_log_id = udl.id) as pending_count
      FROM update_detection_log udl
      LEFT JOIN subsidy_cache sc ON sc.id = udl.subsidy_id
      ORDER BY udl.detected_at DESC
      LIMIT ?
    `).bind(limit).all();
    
    return c.json<ApiResponse<{ logs: any[] }>>({
      success: true,
      data: {
        logs: logs.results || [],
      },
    });
    
  } catch (error) {
    console.error('Update detection logs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Missing Requirements Queue (Freeze Gate v1)
// - 運用操作系を admin-ops.ts から統合
// - パス: /api/admin-ops/missing-queue/*, /api/admin-ops/missing-queue/recompute, etc.
// ============================================================
import adminOps from './admin-ops';

export default izumiMonitors;

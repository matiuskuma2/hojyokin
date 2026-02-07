/**
 * Agency: ダッシュボード v2（情報の泉型）
 * 
 * GET /dashboard-v2 - 統合ダッシュボードv2
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency } from './_helpers';

const dashboardV2 = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboardV2.get('/dashboard-v2', async (c) => {
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


export default dashboardV2;

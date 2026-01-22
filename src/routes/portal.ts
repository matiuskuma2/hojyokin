/**
 * 顧客ポータル API Routes（ログイン不要）
 * 
 * /api/portal - 顧客向けAPI（リンク認証）
 * - GET  /api/portal/verify        - リンク検証
 * - GET  /api/portal/company       - 会社情報取得
 * - POST /api/portal/intake        - 企業情報入力
 * - POST /api/portal/answer        - 壁打ち質問回答
 * - POST /api/portal/upload        - ファイルアップロード
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../types';

const portalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ヘルパー: トークンハッシュ化
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ヘルパー: UUID生成
function generateId(): string {
  return crypto.randomUUID();
}

// ヘルパー: リンク検証
async function verifyAccessLink(db: D1Database, code: string) {
  const link = await db.prepare(`
    SELECT * FROM access_links WHERE short_code = ?
  `).bind(code).first<any>();
  
  if (!link) {
    return { valid: false, error: 'LINK_NOT_FOUND' };
  }
  
  if (link.revoked_at) {
    return { valid: false, error: 'LINK_REVOKED' };
  }
  
  if (new Date(link.expires_at) < new Date()) {
    return { valid: false, error: 'LINK_EXPIRED' };
  }
  
  if (link.max_uses && link.used_count >= link.max_uses) {
    return { valid: false, error: 'LINK_MAX_USES_REACHED' };
  }
  
  return { valid: true, link };
}

/**
 * GET /api/portal/verify - リンク検証
 */
portalRoutes.get('/verify', async (c) => {
  const db = c.env.DB;
  const code = c.req.query('code');
  
  if (!code) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Access code is required' },
    }, 400);
  }
  
  const result = await verifyAccessLink(db, code);
  
  if (!result.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: result.error || 'INVALID_LINK', message: 'Invalid or expired link' },
    }, 400);
  }
  
  const link = result.link;
  
  // 会社情報と事務所情報を取得
  const [company, agency] = await Promise.all([
    db.prepare('SELECT name, prefecture, city FROM companies WHERE id = ?')
      .bind(link.company_id).first(),
    db.prepare('SELECT name FROM agencies WHERE id = ?')
      .bind(link.agency_id).first(),
  ]);
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      type: link.type,
      companyId: link.company_id,
      sessionId: link.session_id,
      message: link.message,
      agency: agency?.name || '事務所',
      company: company?.name || '未登録',
      expiresAt: link.expires_at,
    },
  });
});

/**
 * GET /api/portal/company - 会社情報取得（入力済みのもの）
 */
portalRoutes.get('/company', async (c) => {
  const db = c.env.DB;
  const code = c.req.query('code');
  
  if (!code) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Access code is required' },
    }, 400);
  }
  
  const result = await verifyAccessLink(db, code);
  
  if (!result.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: result.error || 'INVALID_LINK', message: 'Invalid or expired link' },
    }, 400);
  }
  
  const link = result.link;
  
  // 会社情報を取得
  const company = await db.prepare(`
    SELECT c.*, cp.*
    FROM companies c
    LEFT JOIN company_profile cp ON c.id = cp.company_id
    WHERE c.id = ?
  `).bind(link.company_id).first();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { company },
  });
});

/**
 * POST /api/portal/intake - 企業情報入力
 */
portalRoutes.post('/intake', async (c) => {
  const db = c.env.DB;
  const code = c.req.query('code');
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  
  if (!code) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Access code is required' },
    }, 400);
  }
  
  const result = await verifyAccessLink(db, code);
  
  if (!result.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: result.error || 'INVALID_LINK', message: 'Invalid or expired link' },
    }, 400);
  }
  
  const link = result.link;
  
  if (link.type !== 'intake') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'WRONG_LINK_TYPE', message: 'This link is not for intake' },
    }, 400);
  }
  
  const body = await c.req.json();
  const now = new Date().toISOString();
  
  // 入力を保存
  const submissionId = generateId();
  await db.prepare(`
    INSERT INTO intake_submissions (
      id, access_link_id, agency_id, company_id, payload_json,
      status, submitted_ip, submitted_ua, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)
  `).bind(
    submissionId, link.id, link.agency_id, link.company_id,
    JSON.stringify(body), requestIp, userAgent, now, now
  ).run();
  
  // リンク使用回数を更新
  await db.prepare(`
    UPDATE access_links SET used_count = used_count + 1, last_used_at = ?, last_used_ip = ?, last_used_ua = ?
    WHERE id = ?
  `).bind(now, requestIp, userAgent, link.id).run();
  
  // 通知作成（agency ownerへ）
  const agency = await db.prepare('SELECT owner_user_id FROM agencies WHERE id = ?')
    .bind(link.agency_id).first<any>();
  
  if (agency) {
    await db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data_json, created_at)
      VALUES (?, ?, 'intake_submitted', ?, ?, ?, ?)
    `).bind(
      generateId(), agency.owner_user_id,
      '新しい企業情報が入力されました',
      `顧客からの入力を確認してください`,
      JSON.stringify({ submissionId, companyId: link.company_id }),
      now
    ).run();
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { 
      submissionId,
      message: 'ご入力ありがとうございます。担当者が確認いたします。',
    },
  }, 201);
});

/**
 * GET /api/portal/questions - 壁打ち質問取得
 */
portalRoutes.get('/questions', async (c) => {
  const db = c.env.DB;
  const code = c.req.query('code');
  
  if (!code) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Access code is required' },
    }, 400);
  }
  
  const result = await verifyAccessLink(db, code);
  
  if (!result.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: result.error || 'INVALID_LINK', message: 'Invalid or expired link' },
    }, 400);
  }
  
  const link = result.link;
  
  if (link.type !== 'chat') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'WRONG_LINK_TYPE', message: 'This link is not for chat' },
    }, 400);
  }
  
  if (!link.session_id) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NO_SESSION', message: 'No chat session linked' },
    }, 400);
  }
  
  // セッション情報と未回答の質問を取得
  const session = await db.prepare(`
    SELECT cs.*, s.title as subsidy_title
    FROM chat_sessions cs
    LEFT JOIN subsidies s ON cs.subsidy_id = s.id
    WHERE cs.id = ?
  `).bind(link.session_id).first();
  
  // 未回答のfactsを質問として取得
  const pendingFacts = await db.prepare(`
    SELECT * FROM chat_facts
    WHERE session_id = ? AND value IS NULL AND source = 'pending_question'
    ORDER BY created_at ASC
  `).bind(link.session_id).all();
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      session: {
        id: session?.id,
        subsidyTitle: session?.subsidy_title || '補助金',
      },
      questions: pendingFacts?.results || [],
    },
  });
});

/**
 * POST /api/portal/answer - 壁打ち質問回答
 */
portalRoutes.post('/answer', async (c) => {
  const db = c.env.DB;
  const code = c.req.query('code');
  const requestIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;
  
  if (!code) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Access code is required' },
    }, 400);
  }
  
  const result = await verifyAccessLink(db, code);
  
  if (!result.valid) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: result.error || 'INVALID_LINK', message: 'Invalid or expired link' },
    }, 400);
  }
  
  const link = result.link;
  
  if (link.type !== 'chat') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'WRONG_LINK_TYPE', message: 'This link is not for chat' },
    }, 400);
  }
  
  const body = await c.req.json();
  const { answers } = body; // { factKey: value, ... }
  const now = new Date().toISOString();
  
  if (!answers || typeof answers !== 'object') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'answers object is required' },
    }, 400);
  }
  
  // 回答を保存
  const answerId = generateId();
  await db.prepare(`
    INSERT INTO chat_answers (
      id, access_link_id, session_id, company_id, answers_json,
      status, submitted_ip, submitted_ua, created_at
    ) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
  `).bind(
    answerId, link.id, link.session_id, link.company_id,
    JSON.stringify(answers), requestIp, userAgent, now
  ).run();
  
  // chat_factsを更新
  for (const [key, value] of Object.entries(answers)) {
    await db.prepare(`
      UPDATE chat_facts SET value = ?, source = 'customer_answer', updated_at = ?
      WHERE session_id = ? AND key = ?
    `).bind(value, now, link.session_id, key).run();
  }
  
  // リンク使用回数を更新
  await db.prepare(`
    UPDATE access_links SET used_count = used_count + 1, last_used_at = ?, last_used_ip = ?, last_used_ua = ?
    WHERE id = ?
  `).bind(now, requestIp, userAgent, link.id).run();
  
  // 通知作成
  const agency = await db.prepare('SELECT owner_user_id FROM agencies WHERE id = ?')
    .bind(link.agency_id).first<any>();
  
  if (agency) {
    await db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data_json, created_at)
      VALUES (?, ?, 'chat_answered', ?, ?, ?, ?)
    `).bind(
      generateId(), agency.owner_user_id,
      '質問への回答がありました',
      `顧客からの回答を確認してください`,
      JSON.stringify({ answerId, sessionId: link.session_id, companyId: link.company_id }),
      now
    ).run();
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { 
      answerId,
      message: 'ご回答ありがとうございます。',
    },
  }, 201);
});

export { portalRoutes };

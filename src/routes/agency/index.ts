/**
 * Agency Routes - 集約ルーター
 * 
 * 元の agency.ts (3,612行) を機能別に分割:
 *   - public-news.ts    : 公開NEWS (認証不要)
 *   - agency-profile.ts : プロフィール・ダッシュボードv1
 *   - clients.ts        : クライアント管理
 *   - links.ts          : リンク管理
 *   - submissions.ts    : サブミッション管理
 *   - members.ts        : メンバー管理
 *   - dashboard-v2.ts   : ダッシュボードv2
 *   - suggestions.ts    : サジェスション生成
 *   - staff.ts          : スタッフ管理
 * 
 * 認証ルール:
 *   - /public-news のみ認証不要
 *   - その他は全て requireAuth 必須
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { requireAuth } from '../../middleware/auth';

import publicNews from './public-news';
import agencyProfile from './agency-profile';
import clients from './clients';
import links from './links';
import submissions from './submissions';
import members from './members';
import dashboardV2 from './dashboard-v2';
import suggestions from './suggestions';
import staff from './staff';

const agencyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── 公開エンドポイント（認証不要） ──
agencyRoutes.route('/', publicNews);

// ── 認証ミドルウェア（以降の全ルートに適用） ──
agencyRoutes.use('/*', requireAuth);

// ── 認証必須エンドポイント ──
agencyRoutes.route('/', agencyProfile);
agencyRoutes.route('/', clients);
agencyRoutes.route('/', links);
agencyRoutes.route('/', submissions);
agencyRoutes.route('/', members);
agencyRoutes.route('/', dashboardV2);
agencyRoutes.route('/', suggestions);
agencyRoutes.route('/', staff);

export { agencyRoutes };
export default agencyRoutes;

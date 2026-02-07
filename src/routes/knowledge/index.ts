/**
 * Knowledge Pipeline Routes - 集約ルーター
 * 
 * 元の knowledge.ts (2,367行) を機能別に分割:
 *   - _helpers.ts    : ハッシュ生成、R2操作、型定義
 *   - api-routes.ts  : URL抽出、クロール、サマリー、統計
 *   - internal.ts    : 内部API (Cron/キュー処理)
 *   - lifecycle.ts   : ライフサイクル管理 + 必要書類
 *   - extract.ts     : Firecrawl Extract API
 *   - registry.ts    : Source Registry
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';

import apiRoutes from './api-routes';
import internal from './internal';
import lifecycle from './lifecycle';
import extract from './extract';
import registry from './registry';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 全サブルーターをマウント
app.route('/', apiRoutes);
app.route('/', internal);
app.route('/', lifecycle);
app.route('/', extract);
app.route('/', registry);

export default app;

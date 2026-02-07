/**
 * Admin Dashboard Routes - 集約ルーター
 * 
 * 旧 admin-dashboard.ts (6,866行) を機能グループ別に分割。
 * 各サブモジュールのルーターをこのファイルで集約してexport。
 * 
 * 分割構成:
 *   dashboard-kpi.ts      - KPI・ダッシュボード・カバレッジ (966行)
 *   data-status.ts        - データ状態・アラート (727行)
 *   ops.ts                - 運用操作（data-health, trigger-sync等）(912行)
 *   feed-failures.ts      - フィード障害管理 (406行)
 *   enrichment.ts         - 抽出・エンリッチメント実行 (959行)
 *   logs-summary.ts       - 抽出ログ・サマリー (261行)
 *   queue-management.ts   - 抽出キュー管理 (737行)
 *   cost-discovery.ts     - コスト・ディスカバリー・進捗 (1,275行)
 *   izumi-monitors.ts     - 泉リンク・監視・更新管理 (730行)
 * 
 * エンドポイント一覧 (47):
 *   [KPI]        GET /dashboard, /costs, /agency-kpi, /coverage, /kpi-history
 *                POST /generate-daily-snapshot
 *   [Status]     GET /updates, /data-freshness, /alerts, /wall-chat-status, /debug/company-check
 *   [Ops]        GET /ops/data-health, /ops/daily-report, /ops/source-summary, /cron-status
 *                POST /ops/trigger-sync
 *   [Feed]       GET /feed-failures, /active-failures-csv
 *                POST /feed-failures/:id/resolve, /feed-failures/:id/ignore
 *   [Extract]    POST /extract-forms, /jgrants/enrich-detail, /tokyo-shigoto/enrich-detail
 *                GET /extraction-logs, /extraction-summary, /extraction-queue/summary
 *                POST /extraction-queue/enqueue, /extraction-queue/consume, /extraction-queue/retry-failed
 *                DELETE /extraction-queue/clear-done
 *   [Cost]       GET /cost/summary, /cost/logs
 *   [Discovery]  GET /discovery/stats, /discovery/missing-fields
 *   [JGrants]    GET /jgrants/pdf-coverage, /jgrants/pdf-missing-types
 *   [Progress]   GET /progress/wall-chat-ready, /ssot-diagnosis
 *   [Izumi]      POST /izumi-link
 *                GET /izumi-link-status, /monitors, /monitors/:id/files
 *                GET /change-history, /pending-updates, /update-detection-logs
 *                POST /pending-updates/:id/approve, /pending-updates/:id/reject
 *   [Imported]   route('/', adminOps) - from admin-ops.ts
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';
import { requireAuth, requireAdmin } from '../../middleware/auth';

// サブルーター import
import dashboardKpi from './dashboard-kpi';
import dataStatus from './data-status';
import ops from './ops';
import feedFailures from './feed-failures';
import enrichment from './enrichment';
import logsSummary from './logs-summary';
import queueManagement from './queue-management';
import costDiscovery from './cost-discovery';
import izumiMonitors from './izumi-monitors';
import adminOps from '../admin-ops';

const adminDashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

// 全ルートに認証 + 管理者権限を要求
adminDashboard.use('*', requireAuth);
adminDashboard.use('*', requireAdmin);

// 各サブルーターをマウント（パスプレフィックスなし = 全てトップレベル）
adminDashboard.route('/', dashboardKpi);
adminDashboard.route('/', dataStatus);
adminDashboard.route('/', ops);
adminDashboard.route('/', feedFailures);
adminDashboard.route('/', enrichment);
adminDashboard.route('/', logsSummary);
adminDashboard.route('/', queueManagement);
adminDashboard.route('/', costDiscovery);
adminDashboard.route('/', izumiMonitors);

// Missing Requirements Queue (Freeze Gate v1)
adminDashboard.route('/', adminOps);

export default adminDashboard;

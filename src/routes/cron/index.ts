/**
 * Cron Routes - 集約ルーター
 * 
 * 旧 cron.ts (7,643行) を機能グループ別に分割。
 * 各サブモジュールのルーターをこのファイルで集約してexport。
 * 
 * 分割構成:
 *   _helpers.ts        - 共通ヘルパー（UUID、cronRun、secret検証）
 *   sync-jgrants.ts    - JGrants同期・enrichment・詳細取得 (1,387行)
 *   scrape-tokyo.ts    - 東京都スクレイピング（公社/しごと財団/はたらくネット）(1,401行)
 *   extraction.ts      - PDF抽出・OCR・キュー管理 (1,732行)
 *   wall-chat.ts       - wall_chat_ready計算・fallback生成 (1,048行)
 *   suggestions.ts     - 提案生成 (500行)
 *   monitoring.ts      - データソース監視（P4/P5）(625行)
 *   jnet21.ts          - J-Net21同期（撤退済み、ニュース用のみ）+ cleanup-queue (767行)
 *   misc.ts            - health, verify-data-quality (182行)
 * 
 * エンドポイント一覧 (27):
 *   [Sync]        POST /sync-jgrants, POST /enrich-jgrants, POST /scrape-jgrants-detail
 *   [Tokyo]       POST /scrape-tokyo-kosha, /scrape-tokyo-shigoto, /scrape-tokyo-hataraku, /scrape-tokyo-all
 *   [Enrich]      POST /enrich-tokyo-shigoto
 *   [Extract]     POST /extract-pdf-forms, /enqueue-extractions, /consume-extractions, /save-base64-pdfs
 *   [WallChat]    POST /recalc-wall-chat-ready, /apply-field-fallbacks, /daily-ready-boost, /generate-fallback-v2
 *   [Suggest]     POST /generate-suggestions
 *   [Monitor]     POST /check-updates, /monitor-status, /approve-update, /add-monitor
 *   [JNet21]      POST /promote-jnet21, /sync-jnet21-catalog, /cleanup-queue
 *   [Misc]        GET /health, /verify-data-quality
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../../types';

// サブルーター import
import syncJgrants from './sync-jgrants';
import scrapeTokyo from './scrape-tokyo';
import suggestions from './suggestions';
import extraction from './extraction';
import wallChat from './wall-chat';
import jnet21 from './jnet21';
import monitoring from './monitoring';
import misc from './misc';

const cron = new Hono<{ Bindings: Env; Variables: Variables }>();

// 各サブルーターをマウント（パスプレフィックスなし = 全てトップレベル）
cron.route('/', syncJgrants);
cron.route('/', scrapeTokyo);
cron.route('/', suggestions);
cron.route('/', extraction);
cron.route('/', wallChat);
cron.route('/', jnet21);
cron.route('/', monitoring);
cron.route('/', misc);

export default cron;

// ヘルパーの再export（他ファイルからの参照互換）
export { generateUUID, startCronRun, finishCronRun, verifyCronSecret, calculateSimpleHash, extractUrlsFromHtml } from './_helpers';

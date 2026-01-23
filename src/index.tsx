/**
 * ホジョラク - Hono アプリケーション
 * 
 * Phase 1-A: Cloudflare Workers + D1 + Jグランツ API
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { jsxRenderer } from 'hono/jsx-renderer';

import type { Env, Variables, ApiResponse } from './types';
import { authRoutes, companiesRoutes, subsidiesRoutes, jobsRoutes, internalRoutes, knowledgeRoutes, consumerRoutes, kpiRoutes, adminRoutes, profileRoutes, chatRoutes, draftRoutes, adminDashboardRoutes, agencyRoutes, portalRoutes, cronRoutes } from './routes';
import { securityHeaders, requestId } from './middleware/security';
import authPages from './pages/auth';
import dashboardPages from './pages/dashboard';
import adminPages from './pages/admin';
import subsidyPages from './pages/subsidies';
import chatPages from './pages/chat';
import draftPages from './pages/draft';
import agencyPages from './pages/agency';
import portalPages from './pages/portal';

// アプリケーション初期化
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================
// グローバルミドルウェア
// ============================================================

// CORSミドルウェア
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true,
}));

// ロガーミドルウェア
app.use('/api/*', logger());

// リクエストIDミドルウェア
app.use('/api/*', requestId);

// セキュリティヘッダー
app.use('*', securityHeaders);

// ============================================================
// API ルート
// ============================================================

// ヘルスチェック
app.get('/api/health', (c) => {
  return c.json<ApiResponse<{ status: string; timestamp: string }>>({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// API バージョン情報
app.get('/api', (c) => {
  return c.json<ApiResponse<{ version: string; name: string; description: string }>>({
    success: true,
    data: {
      version: '1.0.0',
      name: 'Subsidy Matching API',
      description: '補助金・助成金 自動マッチング＆申請書作成支援システム API',
    },
  });
});

// 認証ルート
app.route('/api/auth', authRoutes);

// 企業ルート
app.route('/api/companies', companiesRoutes);

// 補助金ルート
app.route('/api/subsidies', subsidiesRoutes);

// ジョブルート（AWS連携）
app.route('/api/jobs', jobsRoutes);

// 内部APIルート（AWS→Cloudflare）
app.route('/internal', internalRoutes);

// ナレッジパイプラインルート（Phase K1）
app.route('/api/knowledge', knowledgeRoutes);

// Consumerルート（crawl_queue処理）
app.route('/api/consumer', consumerRoutes);

// KPIルート（監視・統計）
app.route('/api/kpi', kpiRoutes);

// 管理者ルート（U2）
app.route('/api/admin', adminRoutes);

// プロフィールルート（会社プロフィール拡張）
app.route('/api/profile', profileRoutes);

// チャットルート（S3: 壁打ちチャット）
app.route('/api/chat', chatRoutes);

// ドラフトルート（S4: 申請書ドラフト生成）
app.route('/api/draft', draftRoutes);

// 管理ダッシュボードAPI（KPI / コスト / 更新状況）
app.route('/api/admin', adminDashboardRoutes);

// Agency（士業）ルート
app.route('/api/agency', agencyRoutes);

// Portal（顧客ポータル - ログイン不要）ルート
app.route('/api/portal', portalRoutes);

// Cron（外部Cronサービス用 - シークレット認証）ルート
app.route('/api/cron', cronRoutes);

// ============================================================
// UI ページルート（U1）
// ============================================================

// 認証ページ（/login, /register, /forgot, /reset）
app.route('/', authPages);

// ダッシュボード・プロフィールページ（/dashboard, /profile, /company）
app.route('/', dashboardPages);

// 補助金ページ（/subsidies, /subsidies/:id）
app.route('/', subsidyPages);

// 管理画面ページ（/admin, /admin/users, /admin/kpi, /admin/audit）
app.route('/', adminPages);

// 壁打ちチャットページ（/chat）
app.route('/', chatPages);

// 申請書ドラフトページ（/draft）
app.route('/', draftPages);

// Agency（士業）ページ（/agency, /agency/clients, /agency/links）
app.route('/', agencyPages);

// 顧客ポータルページ（/intake, /answer - ログイン不要）
app.route('/', portalPages);

// ============================================================
// エラーハンドリング
// ============================================================

// 404 Not Found
app.notFound((c) => {
  return c.json<ApiResponse<null>>({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${c.req.method} ${c.req.path}`,
    },
  }, 404);
});

// グローバルエラーハンドラ
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  console.error('Error stack:', err.stack);
  
  if (err instanceof HTTPException) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'HTTP_ERROR',
        message: err.message,
      },
    }, err.status);
  }
  
  // 開発環境では詳細なエラーを返す
  const isDev = c.env.ENVIRONMENT === 'development' || !c.env.ENVIRONMENT;
  return c.json<ApiResponse<null>>({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? `${err.name}: ${err.message}` : 'An unexpected error occurred',
    },
  }, 500);
});

// ============================================================
// フロントエンド（開発用）
// ============================================================

// JSXレンダラー
const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ホジョラク</title>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body class="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
});

app.use('/', renderer);
app.use('/*', renderer);

// ホームページ
app.get('/', (c) => {
  return c.render(
    <div class="container mx-auto px-4 py-8">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <img src="/static/images/icon.png" alt="ホジョラク" class="h-10" />
          <span class="text-blue-700">ホジョラク</span>
        </h1>
        <p class="text-gray-600 mt-2">
          企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング
        </p>
      </header>

      <main>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* API Status Card */}
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <i class="fas fa-server text-green-500"></i>
              API Status
            </h2>
            <div id="api-status" class="text-gray-600">
              Loading...
            </div>
          </div>

          {/* Quick Links Card */}
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <i class="fas fa-link text-blue-500"></i>
              API Endpoints
            </h2>
            <ul class="space-y-2 text-sm">
              <li>
                <code class="bg-gray-100 px-2 py-1 rounded">POST /api/auth/register</code>
              </li>
              <li>
                <code class="bg-gray-100 px-2 py-1 rounded">POST /api/auth/login</code>
              </li>
              <li>
                <code class="bg-gray-100 px-2 py-1 rounded">GET /api/companies</code>
              </li>
              <li>
                <code class="bg-gray-100 px-2 py-1 rounded">GET /api/subsidies/search</code>
              </li>
            </ul>
          </div>

          {/* Design Philosophy Card */}
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <i class="fas fa-shield-alt text-purple-500"></i>
              設計思想
            </h2>
            <blockquote class="text-gray-600 italic border-l-4 border-purple-500 pl-4">
              「補助金を"通す"ツール」ではなく<br />
              「補助金で人生を壊させないツール」
            </blockquote>
          </div>
        </div>

        {/* Features Section */}
        <section class="mt-12">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">主な機能</h2>
          <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-building text-indigo-500"></i>
                企業情報管理
              </h3>
              <p class="text-gray-600">
                所在地、業種、従業員数、資本金などを登録して、最適な補助金を自動検索
              </p>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-search text-indigo-500"></i>
                一次スクリーニング
              </h3>
              <p class="text-gray-600">
                Jグランツ公開APIから補助金を取得し、企業情報と自動マッチング
              </p>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-exclamation-triangle text-yellow-500"></i>
                リスク警告
              </h3>
              <p class="text-gray-600">
                危険度メーターで事故リスクを可視化。非推奨の判定も出します
              </p>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-check-circle text-green-500"></i>
                3段階評価
              </h3>
              <p class="text-gray-600">
                推奨・注意・非推奨の3段階で判定し、根拠も提示します
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer class="mt-12 text-center text-gray-500 text-sm">
        <p>&copy; 2026 Subsidy Matching System. Phase 1-A (Cloudflare)</p>
      </footer>

      {/* Status Check Script */}
      <script dangerouslySetInnerHTML={{
        __html: `
          fetch('/api/health')
            .then(res => res.json())
            .then(data => {
              document.getElementById('api-status').innerHTML = 
                '<span class="text-green-600 font-semibold">✓ API is running</span><br>' +
                '<small class="text-gray-500">' + data.data.timestamp + '</small>';
            })
            .catch(err => {
              document.getElementById('api-status').innerHTML = 
                '<span class="text-red-600">✗ API Error</span>';
            });
        `
      }} />
    </div>
  );
});

export default app;

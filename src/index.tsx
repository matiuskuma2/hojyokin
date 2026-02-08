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
import { authRoutes, companiesRoutes, subsidiesRoutes, jobsRoutes, internalRoutes, knowledgeRoutes, consumerRoutes, kpiRoutes, adminRoutes, profileRoutes, chatRoutes, draftRoutes, adminDashboardRoutes, agencyRoutes, portalRoutes, cronRoutes, mastersRoutes } from './routes';
import { securityHeaders, requestId } from './middleware/security';
import { getNormalizedSubsidyDetail } from './lib/ssot/getNormalizedSubsidyDetail';
import authPages from './pages/auth';
import dashboardPages from './pages/dashboard';
import adminPages from './pages/admin';
import subsidyPages from './pages/subsidies';
import chatPages from './pages/chat';
import draftPages from './pages/draft';
import agencyPages from './pages/agency';
import portalPages from './pages/portal';
import monitorPages from './pages/monitor';

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

// ヘルスチェック（SEARCH_BACKEND 状態 + SSOT受付中件数）
app.get('/api/health', async (c) => {
  const searchBackend = (c.env as any).SEARCH_BACKEND || 'ssot';
  const jgrantsMode = (c.env as any).JGRANTS_MODE || 'cached-only';
  const testSubsidyId = c.req.query('test_subsidy_id');
  
  // SSOT受付中件数を取得（母数確認用）
  let ssotAcceptingCount: number | null = null;
  let cacheAcceptingCount: number | null = null;
  let searchableCount: number | null = null;
  let totalSubsidies: number | null = null;
  let testSubsidyDetail: any = null;
  
  try {
    const ssotResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM subsidy_canonical c
      JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
      WHERE c.is_active = 1 AND s.is_accepting = 1
    `).first<{ count: number }>();
    ssotAcceptingCount = ssotResult?.count || 0;
    
    // cache受付中: SSOTと同じ「今この瞬間の受付中」定義に揃える
    // - source='jgrants' に限定（izumi等を混ぜない）
    // - request_reception_display_flag = 1
    // - acceptance_end_datetime が今より未来（NULL や過去は除外）
    const cacheResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM subsidy_cache
      WHERE source = 'jgrants'
        AND request_reception_display_flag = 1
        AND acceptance_end_datetime IS NOT NULL
        AND acceptance_end_datetime > datetime('now')
    `).first<{ count: number }>();
    cacheAcceptingCount = cacheResult?.count || 0;
    
    // 検索可能件数（ダッシュボード表示用）
    try {
      const searchableResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM subsidy_cache
        WHERE wall_chat_ready = 1
          AND wall_chat_excluded = 0
          AND expires_at > datetime('now')
      `).first<{ count: number }>();
      searchableCount = searchableResult?.count || 0;
      
      const totalResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM subsidy_cache
      `).first<{ count: number }>();
      totalSubsidies = totalResult?.count || 0;
    } catch (e) {
      // non-fatal
    }
    
    // テスト用: 補助金詳細の確認
    if (testSubsidyId) {
      // canonical から snapshot_id と cache_id を取得
      const canonicalRow = await c.env.DB.prepare(`
        SELECT id, latest_snapshot_id, latest_cache_id
        FROM subsidy_canonical
        WHERE id = ?
      `).bind(testSubsidyId).first<{ id: string; latest_snapshot_id: string | null; latest_cache_id: string | null }>();
      
      if (!canonicalRow) {
        testSubsidyDetail = { error: 'Canonical not found' };
      } else {
        const snapshotRow = canonicalRow.latest_snapshot_id
          ? await c.env.DB.prepare(`
              SELECT id, detail_json, LENGTH(detail_json) as detail_length
              FROM subsidy_snapshot
              WHERE id = ?
            `).bind(canonicalRow.latest_snapshot_id).first<{ id: string; detail_json: string; detail_length: number }>()
          : null;
          
        const cacheRow = canonicalRow.latest_cache_id
          ? await c.env.DB.prepare(`
              SELECT id, detail_json, LENGTH(detail_json) as detail_length
              FROM subsidy_cache
              WHERE id = ?
            `).bind(canonicalRow.latest_cache_id).first<{ id: string; detail_json: string; detail_length: number }>()
          : null;
        
        const detailJson = cacheRow?.detail_json || snapshotRow?.detail_json;
        
        if (detailJson) {
          try {
            const dj = JSON.parse(detailJson);
            testSubsidyDetail = {
              canonical_id: canonicalRow.id,
              latest_snapshot_id: canonicalRow.latest_snapshot_id,
              latest_cache_id: canonicalRow.latest_cache_id,
              has_snapshot_row: !!snapshotRow,
              has_cache_row: !!cacheRow,
              snapshot_detail_length: snapshotRow?.detail_length || 0,
              cache_detail_length: cacheRow?.detail_length || 0,
              detail_source: cacheRow?.detail_json ? 'cache' : 'snapshot',
              has_description: !!dj.description,
              has_eligibility: !!dj.eligibility_requirements,
              has_expenses: !!dj.eligible_expenses,
              has_criteria: !!dj.evaluation_criteria,
              has_documents: !!dj.required_documents,
              has_forms: !!dj.required_forms,
              has_wall_chat: !!dj.wall_chat_questions,
              forms_count: Array.isArray(dj.required_forms) ? dj.required_forms.length : 0,
              wall_chat_count: Array.isArray(dj.wall_chat_questions) ? dj.wall_chat_questions.length : 0,
            };
            
            // normalized summary（getNormalizedSubsidyDetail のテスト）
            try {
              const result = await getNormalizedSubsidyDetail(c.env.DB, testSubsidyId, { debug: false });
              if (result) {
                testSubsidyDetail.normalized_summary = {
                  title: result.normalized.display.title,
                  eligibility_rules_count: result.normalized.content.eligibility_rules.length,
                  eligible_expenses_categories_count: result.normalized.content.eligible_expenses.categories.length,
                  required_documents_count: result.normalized.content.required_documents.length,
                  bonus_points_count: result.normalized.content.bonus_points.length,
                  required_forms_count: result.normalized.content.required_forms.length,
                  wall_chat_ready: result.normalized.wall_chat.ready,
                  wall_chat_questions_count: result.normalized.wall_chat.questions.length,
                };
              }
            } catch (normalizeError: any) {
              testSubsidyDetail.normalize_error = normalizeError.message;
            }
          } catch (e) {
            testSubsidyDetail = { error: 'JSON parse failed', canonical_id: canonicalRow.id };
          }
        } else {
          testSubsidyDetail = { 
            error: 'No detail_json found',
            canonical_id: canonicalRow.id,
            latest_snapshot_id: canonicalRow.latest_snapshot_id,
            latest_cache_id: canonicalRow.latest_cache_id,
            has_snapshot_row: !!snapshotRow,
            has_cache_row: !!cacheRow,
          };
        }
      }
    }
  } catch (e) {
    // DB接続エラーは無視（healthは常に返す）
  }
  
  return c.json<ApiResponse<{ 
    status: string; 
    timestamp: string;
    search_backend: string;
    jgrants_mode: string;
    ssot_accepting_count: number | null;
    cache_accepting_count: number | null;
    searchable_count: number | null;
    total_subsidies: number | null;
    test_subsidy_detail?: any;
  }>>({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      search_backend: searchBackend,
      jgrants_mode: jgrantsMode,
      ssot_accepting_count: ssotAcceptingCount,
      cache_accepting_count: cacheAcceptingCount,
      searchable_count: searchableCount,
      total_subsidies: totalSubsidies,
      test_subsidy_detail: testSubsidyDetail,
    },
  });
});

// ========================================
// GET /api/r2-pdf
// R2に保存されたPDFをHTTP経由で配信（署名付きURL必須）
// Firecrawl がアクセスするため公開だが、署名と期限で保護
// 
// 使用方法:
//   r2://subsidy-knowledge/pdf/a0WJ.../xxx.pdf
//   → GET /api/r2-pdf?key=pdf/a0WJ.../xxx.pdf&exp=UNIX秒&sig=HMAC署名
// 
// 署名生成: HMAC-SHA256(R2_PDF_SIGNING_SECRET, "${key}.${exp}")
// ========================================
app.get('/api/r2-pdf', async (c) => {
  const { env } = c;
  const key = c.req.query('key');
  const expStr = c.req.query('exp');
  const sig = c.req.query('sig');

  // 必須パラメータチェック
  if (!key) {
    return c.json({ 
      success: false, 
      error: { code: 'MISSING_KEY', message: 'key query parameter is required' } 
    }, 400);
  }

  // キーのバリデーション（pdf/で始まること）
  if (!key.startsWith('pdf/')) {
    return c.json({ 
      success: false, 
      error: { code: 'INVALID_KEY', message: 'key must start with pdf/' } 
    }, 400);
  }

  // パストラバーサル攻撃防止
  if (key.includes('..') || key.includes('//')) {
    return c.json({ 
      success: false, 
      error: { code: 'INVALID_KEY', message: 'Invalid key path' } 
    }, 400);
  }

  // 署名検証（R2_PDF_SIGNING_SECRET が設定されている場合のみ）
  const signingSecret = env.R2_PDF_SIGNING_SECRET;
  if (signingSecret) {
    if (!expStr || !sig) {
      return c.json({ 
        success: false, 
        error: { code: 'MISSING_SIGNATURE', message: 'exp and sig query parameters are required' } 
      }, 400);
    }

    const exp = parseInt(expStr, 10);
    if (isNaN(exp)) {
      return c.json({ 
        success: false, 
        error: { code: 'INVALID_EXP', message: 'exp must be a valid UNIX timestamp' } 
      }, 400);
    }

    // 期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (exp < now) {
      console.warn(`[R2-PDF] URL expired: key=${key}, exp=${exp}, now=${now}`);
      return c.json({ 
        success: false, 
        error: { code: 'URL_EXPIRED', message: 'Signed URL has expired' } 
      }, 403);
    }

    // 署名検証
    const { verifySignature } = await import('./lib/r2-sign');
    const verification = await verifySignature(signingSecret, key, exp, sig);
    if (!verification.valid) {
      console.warn(`[R2-PDF] Invalid signature: key=${key}, reason=${verification.reason}`);
      return c.json({ 
        success: false, 
        error: { code: 'INVALID_SIGNATURE', message: verification.reason || 'Invalid signature' } 
      }, 403);
    }
  } else {
    // R2_PDF_SIGNING_SECRET が未設定の場合は警告ログ（開発環境用）
    console.warn('[R2-PDF] R2_PDF_SIGNING_SECRET not set - serving without signature verification');
  }

  try {
    // R2からPDFを取得
    const object = await env.R2_KNOWLEDGE.get(key);

    if (!object) {
      console.warn(`[R2-PDF] Not found: ${key}`);
      return c.json({ 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'PDF not found in R2' } 
      }, 404);
    }

    // PDFとして配信
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Length', object.size.toString());
    
    // キャッシュ設定（署名付きURLは一時的なのでキャッシュは控えめに）
    headers.set('Cache-Control', 'private, max-age=300'); // 5分
    
    // 元のファイル名を取得（あれば）
    const fileName = key.split('/').pop() || 'document.pdf';
    headers.set('Content-Disposition', `inline; filename="${fileName}"`);

    console.log(`[R2-PDF] Serving: ${key} (${object.size} bytes)`);

    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[R2-PDF] Error fetching from R2:', error);
    return c.json({
      success: false,
      error: {
        code: 'R2_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch from R2',
      },
    }, 500);
  }
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

// 管理者ルート（U2: ユーザー管理、監査ログ、JGrants同期）
app.route('/api/admin', adminRoutes);

// 管理ダッシュボードAPI（KPI / コスト / 更新状況 / 運用系）
// 注: /api/admin-ops に分離して競合を回避
app.route('/api/admin-ops', adminDashboardRoutes);

// プロフィールルート（会社プロフィール拡張）
app.route('/api/profile', profileRoutes);

// チャットルート（S3: 壁打ちチャット）
app.route('/api/chat', chatRoutes);

// ドラフトルート（S4: 申請書ドラフト生成）
app.route('/api/draft', draftRoutes);

// Agency（士業）ルート
app.route('/api/agency', agencyRoutes);

// Portal（顧客ポータル - ログイン不要）ルート
app.route('/api/portal', portalRoutes);

// Cron（外部Cronサービス用 - シークレット認証）ルート
app.route('/api/cron', cronRoutes);

// マスタデータルート（発行機関、カテゴリ、業種、地域）
app.route('/api/masters', mastersRoutes);

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

// PDF監視ダッシュボード（/monitor - 認証不要）
app.route('/', monitorPages);

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

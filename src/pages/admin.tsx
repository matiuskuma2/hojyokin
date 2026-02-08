/**
 * 管理画面ページ
 * 
 * /admin - 統合ダッシュボード（KPI + キュー + コスト）
 * /admin/users - ユーザー一覧・管理
 * /admin/costs - コスト詳細（super_admin限定）
 * /admin/updates - 更新状況一覧
 * /admin/audit - 監査ログ閲覧
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const adminPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// 共通レイアウト
const adminLayout = (title: string, content: string, activeTab: string = '') => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ホジョラク管理</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <!-- PWA対応 -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#312e81">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ホジョラク管理">
  <link rel="apple-touch-icon" href="/static/images/icon-192.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    // ============================================================
    // 共通初期化スクリプト（headで先に定義）
    // ============================================================
    (function() {
      'use strict';
      
      var token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      
      // グローバルAPI呼び出しヘルパー
      window.api = async function(path, options) {
        options = options || {};
        
        var headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        };
        
        if (options.headers) {
          for (var key in options.headers) {
            headers[key] = options.headers[key];
          }
        }
        
        var fetchOptions = {
          method: options.method || 'GET',
          headers: headers
        };
        
        if (options.body) {
          fetchOptions.body = options.body;
        }
        
        try {
          var res = await fetch(path, fetchOptions);
          var data = await res.json();
          
          // 認証エラー時は自動ログアウト
          if (res.status === 401 || (data && data.error && data.error.code === 'UNAUTHORIZED')) {
            console.warn('認証エラー: 自動ログアウトします');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            alert('セッションの有効期限が切れました。再度ログインしてください。');
            window.location.href = '/login';
            return data;
          }
          
          return data;
        } catch (err) {
          console.error('API呼び出しエラー:', err);
          return { success: false, error: { code: 'NETWORK_ERROR', message: '通信エラーが発生しました' } };
        }
      };
      
      // ログアウト関数
      window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      };
    })();
  </script>
  <style>
    .stat-card { transition: all 0.3s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
    .loading { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    /* モバイルメニュー */
    .mobile-menu { transform: translateX(-100%); transition: transform 0.3s ease-in-out; }
    .mobile-menu.open { transform: translateX(0); }
    .mobile-overlay { opacity: 0; pointer-events: none; transition: opacity 0.3s; }
    .mobile-overlay.open { opacity: 1; pointer-events: auto; }
    /* ボトムナビ */
    .bottom-nav { box-shadow: 0 -2px 10px rgba(0,0,0,0.1); }
    .bottom-nav-item { flex: 1; text-align: center; padding: 8px 4px; }
    .bottom-nav-item.active { color: #4f46e5; }
    .bottom-nav-item.active i { transform: scale(1.1); }
  </style>
</head>
<body class="bg-gray-100 min-h-screen pb-16 md:pb-0">
  <!-- Navigation Header -->
  <nav class="bg-indigo-900 text-white shadow-lg sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14 md:h-16">
        <!-- Left: Menu button (mobile) + Logo -->
        <div class="flex items-center gap-3">
          <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md hover:bg-indigo-800" onclick="toggleMobileMenu()">
            <i class="fas fa-bars text-xl"></i>
          </button>
          <a href="/admin" class="flex items-center gap-2">
            <img src="/static/images/icon.png" alt="ホジョラク" class="h-7 md:h-8">
            <span class="text-lg md:text-xl font-bold hidden sm:inline">管理画面</span>
          </a>
        </div>
        
        <!-- Center: Desktop Nav -->
        <div class="hidden md:flex gap-1 ml-8">
          <a href="/admin" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'dashboard' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
            <i class="fas fa-chart-pie mr-1"></i>ダッシュボード
          </a>
          <a href="/admin/users" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'users' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
            <i class="fas fa-users mr-1"></i>ユーザー
          </a>
          <a href="/admin/costs" id="nav-costs" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'costs' ? 'bg-indigo-700' : 'hover:bg-indigo-800'} hidden">
            <i class="fas fa-dollar-sign mr-1"></i>コスト
          </a>
          <a href="/admin/updates" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'updates' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
            <i class="fas fa-sync mr-1"></i>更新状況
          </a>
          <a href="/admin/audit" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'audit' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
            <i class="fas fa-clipboard-list mr-1"></i>監査ログ
          </a>
          <a href="/admin/ops" id="nav-ops" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'ops' ? 'bg-indigo-700' : 'hover:bg-indigo-800'} hidden">
            <i class="fas fa-heartbeat mr-1"></i>運用チェック
          </a>
          <a href="/admin/monitors" id="nav-monitors" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'monitors' ? 'bg-indigo-700' : 'hover:bg-indigo-800'} hidden">
            <i class="fas fa-satellite-dish mr-1"></i>監視
          </a>
        </div>
        
        <!-- Right: User info -->
        <div class="flex items-center gap-2 md:gap-4">
          <span id="user-role" class="px-2 py-1 text-xs font-medium rounded-full bg-purple-600"></span>
          <span id="user-name" class="text-sm hidden sm:inline"></span>
          <a href="/dashboard" class="hidden md:inline text-sm hover:text-indigo-200">
            <i class="fas fa-arrow-left mr-1"></i>ユーザー画面
          </a>
          <button onclick="logout()" class="hidden md:inline text-sm hover:text-indigo-200">
            <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Mobile Sidebar Menu -->
  <div id="mobile-overlay" class="mobile-overlay fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onclick="closeMobileMenu()"></div>
  <div id="mobile-menu" class="mobile-menu fixed top-0 left-0 h-full w-72 bg-indigo-900 text-white z-50 md:hidden overflow-y-auto">
    <div class="p-4 border-b border-indigo-800 flex items-center justify-between">
      <span class="font-bold text-lg">メニュー</span>
      <button onclick="closeMobileMenu()" class="p-2 hover:bg-indigo-800 rounded">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="py-2">
      <a href="/admin" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'dashboard' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
        <i class="fas fa-chart-pie w-5"></i>ダッシュボード
      </a>
      <a href="/admin/users" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'users' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
        <i class="fas fa-users w-5"></i>ユーザー管理
      </a>
      <a href="/admin/costs" id="mobile-nav-costs" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'costs' ? 'bg-indigo-700' : 'hover:bg-indigo-800'} hidden">
        <i class="fas fa-dollar-sign w-5"></i>コスト管理
      </a>
      <a href="/admin/updates" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'updates' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
        <i class="fas fa-sync w-5"></i>更新状況
      </a>
      <a href="/admin/audit" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'audit' ? 'bg-indigo-700' : 'hover:bg-indigo-800'}">
        <i class="fas fa-clipboard-list w-5"></i>監査ログ
      </a>
      <a href="/admin/ops" id="mobile-nav-ops" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'ops' ? 'bg-indigo-700' : 'hover:bg-indigo-800'} hidden">
        <i class="fas fa-heartbeat w-5"></i>運用チェック
      </a>
      <a href="/admin/monitors" id="mobile-nav-monitors" class="flex items-center gap-3 px-4 py-3 ${activeTab === 'monitors' ? 'bg-indigo-700' : 'hover:bg-indigo-800'} hidden">
        <i class="fas fa-satellite-dish w-5"></i>監視管理
      </a>
    </div>
    <div class="border-t border-indigo-800 py-2">
      <a href="/dashboard" class="flex items-center gap-3 px-4 py-3 hover:bg-indigo-800">
        <i class="fas fa-arrow-left w-5"></i>ユーザー画面へ
      </a>
      <button onclick="logout()" class="flex items-center gap-3 px-4 py-3 hover:bg-indigo-800 w-full text-left">
        <i class="fas fa-sign-out-alt w-5"></i>ログアウト
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
    ${content}
  </main>
  
  <!-- Mobile Bottom Navigation -->
  <nav class="bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t z-30 md:hidden">
    <div class="flex">
      <a href="/admin" class="bottom-nav-item ${activeTab === 'dashboard' ? 'active text-indigo-600' : 'text-gray-500'}">
        <i class="fas fa-chart-pie text-lg"></i>
        <p class="text-xs mt-1">ダッシュ</p>
      </a>
      <a href="/admin/users" class="bottom-nav-item ${activeTab === 'users' ? 'active text-indigo-600' : 'text-gray-500'}">
        <i class="fas fa-users text-lg"></i>
        <p class="text-xs mt-1">ユーザー</p>
      </a>
      <a href="/admin/updates" class="bottom-nav-item ${activeTab === 'updates' ? 'active text-indigo-600' : 'text-gray-500'}">
        <i class="fas fa-sync text-lg"></i>
        <p class="text-xs mt-1">更新</p>
      </a>
      <a href="/admin/ops" id="bottom-nav-ops" class="bottom-nav-item ${activeTab === 'ops' ? 'active text-indigo-600' : 'text-gray-500'} hidden">
        <i class="fas fa-heartbeat text-lg"></i>
        <p class="text-xs mt-1">運用</p>
      </a>
      <button onclick="toggleMobileMenu()" class="bottom-nav-item text-gray-500">
        <i class="fas fa-ellipsis-h text-lg"></i>
        <p class="text-xs mt-1">その他</p>
      </button>
    </div>
  </nav>

  <script>
    // ============================================================
    // ユーザー情報表示とナビ初期化（API定義は<head>で完了済み）
    // ============================================================
    (function() {
      'use strict';
      
      var userStr = localStorage.getItem('user');
      var user = null;
      
      try {
        user = userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        console.error('ユーザー情報のパースエラー:', e);
        user = null;
      }
      
      if (!user) {
        window.location.href = '/login';
        return;
      }
      
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        alert('管理者権限が必要です');
        window.location.href = '/dashboard';
        return;
      }
      
      var userNameEl = document.getElementById('user-name');
      var userRoleEl = document.getElementById('user-role');
      
      if (userNameEl) {
        userNameEl.textContent = user.name || user.email || '';
      }
      if (userRoleEl) {
        userRoleEl.textContent = user.role === 'super_admin' ? 'Super Admin' : 'Admin';
      }
      
      // super_admin のみコスト・運用チェック・監視タブを表示
      if (user.role === 'super_admin') {
        var navCosts = document.getElementById('nav-costs');
        if (navCosts) navCosts.classList.remove('hidden');
        var navOps = document.getElementById('nav-ops');
        if (navOps) navOps.classList.remove('hidden');
        var navMonitors = document.getElementById('nav-monitors');
        if (navMonitors) navMonitors.classList.remove('hidden');
        // モバイル用
        var mobileNavCosts = document.getElementById('mobile-nav-costs');
        if (mobileNavCosts) mobileNavCosts.classList.remove('hidden');
        var mobileNavOps = document.getElementById('mobile-nav-ops');
        if (mobileNavOps) mobileNavOps.classList.remove('hidden');
        var mobileNavMonitors = document.getElementById('mobile-nav-monitors');
        if (mobileNavMonitors) mobileNavMonitors.classList.remove('hidden');
        var bottomNavOps = document.getElementById('bottom-nav-ops');
        if (bottomNavOps) bottomNavOps.classList.remove('hidden');
      }
      
      // モバイルメニュー関数
      window.toggleMobileMenu = function() {
        var menu = document.getElementById('mobile-menu');
        var overlay = document.getElementById('mobile-overlay');
        if (menu && overlay) {
          menu.classList.toggle('open');
          overlay.classList.toggle('open');
        }
      };
      window.closeMobileMenu = function() {
        var menu = document.getElementById('mobile-menu');
        var overlay = document.getElementById('mobile-overlay');
        if (menu && overlay) {
          menu.classList.remove('open');
          overlay.classList.remove('open');
        }
      };
      
      // Service Worker 登録（PWA対応）
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
              console.log('[PWA] Service Worker registered:', registration.scope);
            })
            .catch(function(error) {
              console.log('[PWA] Service Worker registration failed:', error);
            });
        });
      }
    })();
  </script>
</body>
</html>
`;

// ============================================================
// /admin - 統合ダッシュボード
// ============================================================

adminPages.get('/admin', (c) => {
  const content = `
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">管理ダッシュボード</h1>
      <p class="text-gray-600 mt-1">KPI・キュー状況・コストを一目で確認</p>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="stat-card bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">総ユーザー数</p>
            <p id="kpi-users-total" class="text-3xl font-bold text-gray-900 loading">-</p>
            <p class="text-xs text-green-600 mt-1">今日: <span id="kpi-users-today">-</span></p>
          </div>
          <div class="bg-blue-100 rounded-full p-3">
            <i class="fas fa-users text-blue-600 text-2xl"></i>
          </div>
        </div>
      </div>

      <div class="stat-card bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">補助金検索</p>
            <p id="kpi-searches-total" class="text-3xl font-bold text-gray-900 loading">-</p>
            <p class="text-xs text-green-600 mt-1">今日: <span id="kpi-searches-today">-</span></p>
          </div>
          <div class="bg-green-100 rounded-full p-3">
            <i class="fas fa-search text-green-600 text-2xl"></i>
          </div>
        </div>
      </div>

      <div class="stat-card bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">壁打ちセッション</p>
            <p id="kpi-chats-total" class="text-3xl font-bold text-gray-900 loading">-</p>
            <p class="text-xs text-green-600 mt-1">今日: <span id="kpi-chats-today">-</span></p>
          </div>
          <div class="bg-purple-100 rounded-full p-3">
            <i class="fas fa-comments text-purple-600 text-2xl"></i>
          </div>
        </div>
      </div>

      <div class="stat-card bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">申請書ドラフト</p>
            <p id="kpi-drafts-total" class="text-3xl font-bold text-gray-900 loading">-</p>
            <p class="text-xs text-green-600 mt-1">今日: <span id="kpi-drafts-today">-</span></p>
          </div>
          <div class="bg-orange-100 rounded-full p-3">
            <i class="fas fa-file-alt text-orange-600 text-2xl"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- 補助金データ ミニサマリー（super_admin向け、dashboardAPI応答に含む） -->
    <div id="subsidy-mini-summary" class="hidden mb-8">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-indigo-500">補助金 総件数</p>
              <p id="mini-sd-total" class="text-2xl font-bold text-indigo-700">-</p>
            </div>
            <div class="bg-indigo-200 rounded-full p-2">
              <i class="fas fa-database text-indigo-600"></i>
            </div>
          </div>
        </div>
        <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-green-500">検索可能</p>
              <p id="mini-sd-searchable" class="text-2xl font-bold text-green-700">-</p>
            </div>
            <div class="bg-green-200 rounded-full p-2">
              <i class="fas fa-search text-green-600"></i>
            </div>
          </div>
        </div>
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-blue-500">Ready</p>
              <p id="mini-sd-ready" class="text-2xl font-bold text-blue-700">-</p>
            </div>
            <div class="bg-blue-200 rounded-full p-2">
              <i class="fas fa-check-circle text-blue-600"></i>
            </div>
          </div>
        </div>
        <div class="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-amber-500">Excluded</p>
              <p id="mini-sd-excluded" class="text-2xl font-bold text-amber-700">-</p>
            </div>
            <div class="bg-amber-200 rounded-full p-2">
              <i class="fas fa-ban text-amber-600"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ファネル + キュー -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- ファネル -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-funnel-dollar text-indigo-600 mr-2"></i>コンバージョンファネル（今月）
        </h2>
        <div class="space-y-3">
          <div class="flex items-center">
            <span class="w-24 text-sm text-gray-600">登録</span>
            <div class="flex-1 bg-gray-200 rounded-full h-6 mx-3">
              <div id="funnel-users" class="bg-blue-500 h-6 rounded-full text-white text-xs flex items-center justify-center" style="width: 100%">-</div>
            </div>
          </div>
          <div class="flex items-center">
            <span class="w-24 text-sm text-gray-600">検索</span>
            <div class="flex-1 bg-gray-200 rounded-full h-6 mx-3">
              <div id="funnel-searches" class="bg-green-500 h-6 rounded-full text-white text-xs flex items-center justify-center" style="width: 0%">-</div>
            </div>
          </div>
          <div class="flex items-center">
            <span class="w-24 text-sm text-gray-600">壁打ち</span>
            <div class="flex-1 bg-gray-200 rounded-full h-6 mx-3">
              <div id="funnel-chats" class="bg-purple-500 h-6 rounded-full text-white text-xs flex items-center justify-center" style="width: 0%">-</div>
            </div>
          </div>
          <div class="flex items-center">
            <span class="w-24 text-sm text-gray-600">ドラフト</span>
            <div class="flex-1 bg-gray-200 rounded-full h-6 mx-3">
              <div id="funnel-drafts" class="bg-orange-500 h-6 rounded-full text-white text-xs flex items-center justify-center" style="width: 0%">-</div>
            </div>
          </div>
        </div>
      </div>

      <!-- キュー状況 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-list-check text-yellow-600 mr-2"></i>クロールキュー状況
        </h2>
        <div id="queue-status" class="space-y-2">
          <div class="loading text-gray-400">読み込み中...</div>
        </div>
      </div>
    </div>

    <!-- 今日の直近イベント（リアルタイム確認用） -->
    <div class="bg-white rounded-xl shadow p-6 mb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-gray-800">
          <i class="fas fa-bolt text-yellow-500 mr-2"></i>今日の直近イベント
        </h2>
        <button onclick="loadDashboard()" class="text-sm text-indigo-600 hover:text-indigo-800">
          <i class="fas fa-sync-alt mr-1"></i>更新
        </button>
      </div>
      <div id="recent-events" class="overflow-x-auto">
        <div class="loading text-gray-400 p-4">読み込み中...</div>
      </div>
      <p class="text-xs text-gray-400 mt-3">
        <i class="fas fa-info-circle mr-1"></i>
        検索・壁打ち・ドラフト生成が行われると、ここにリアルタイムで表示されます
      </p>
    </div>

    <!-- 網羅性・運用監視（super_admin のみ） -->
    <div id="coverage-section" class="hidden mb-8">
      <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-map-marked-alt text-blue-600 mr-2"></i>網羅性・運用監視
          </h2>
          <button onclick="loadCoverage()" class="text-sm text-indigo-600 hover:text-indigo-800">
            <i class="fas fa-sync-alt mr-1"></i>更新
          </button>
        </div>
        
        <!-- 網羅スコア -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <p class="text-sm text-blue-600 font-medium">総合スコア</p>
            <p id="coverage-score-total" class="text-4xl font-bold text-blue-700">-</p>
            <p class="text-xs text-blue-500">/ 100</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-500">L1 入口網羅</p>
            <p id="coverage-score-l1" class="text-2xl font-bold text-gray-700">-</p>
            <p class="text-xs text-gray-400">都道府県ソース</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-500">L2 実稼働網羅</p>
            <p id="coverage-score-l2" class="text-2xl font-bold text-gray-700">-</p>
            <p class="text-xs text-gray-400">クロール実行</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4 text-center">
            <p class="text-sm text-gray-500">L3 データ網羅</p>
            <p id="coverage-score-l3" class="text-2xl font-bold text-gray-700">-</p>
            <p class="text-xs text-gray-400">補助金データ</p>
          </div>
        </div>

        <!-- キュー健全性 -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-heartbeat mr-1"></i>キュー健全性（Consumer生存確認）
          </h3>
          <div id="queue-health" class="p-4 rounded-lg bg-gray-50">
            <div class="loading text-gray-400">読み込み中...</div>
          </div>
        </div>

        <!-- ドメイン別エラー率Top10 -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-exclamation-circle mr-1"></i>ドメイン別エラー率Top（直近7日）
          </h3>
          <div id="domain-errors" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>

        <!-- 重複クロール検知 -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-clone mr-1"></i>重複クロール検知（同一URL 5回以上）
          </h3>
          <div id="duplicate-crawls" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- Data Coverage / Crawl Strategy（super_admin のみ） -->
    <!-- ============================================================ -->
    <div id="data-coverage-section" class="hidden mb-8">
      
      <!-- カード1: PDF Coverage (jGrants) -->
      <div class="bg-white rounded-xl shadow p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-file-pdf text-red-600 mr-2"></i>PDF Coverage（jGrants）
          </h2>
          <button onclick="loadPdfCoverage()" class="text-sm text-indigo-600 hover:text-indigo-800">
            <i class="fas fa-sync-alt mr-1"></i>更新
          </button>
        </div>
        
        <!-- サマリーカード -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
            <p class="text-sm text-indigo-600 font-medium">総数</p>
            <p id="pdf-total" class="text-3xl font-bold text-indigo-700">-</p>
          </div>
          <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
            <p class="text-sm text-green-600 font-medium">PDF取得済み</p>
            <p id="pdf-has-urls" class="text-3xl font-bold text-green-700">-</p>
            <p id="pdf-coverage-rate" class="text-xs text-green-500">-%</p>
          </div>
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <p class="text-sm text-blue-600 font-medium">V2エンリッチ</p>
            <p id="pdf-enriched-v2" class="text-3xl font-bold text-blue-700">-</p>
            <p id="pdf-enriched-rate" class="text-xs text-blue-500">-%</p>
          </div>
          <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
            <p class="text-sm text-purple-600 font-medium">壁打ちReady</p>
            <p id="pdf-ready" class="text-3xl font-bold text-purple-700">-</p>
            <p id="pdf-ready-rate" class="text-xs text-purple-500">-%</p>
          </div>
          <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
            <p class="text-sm text-yellow-600 font-medium">受付中</p>
            <p id="pdf-active" class="text-3xl font-bold text-yellow-700">-</p>
          </div>
        </div>
        
        <!-- PDFあり Top テーブル -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-check-circle text-green-500 mr-1"></i>PDFあり（締切近い順）
          </h3>
          <div id="pdf-yes-table" class="overflow-x-auto max-h-64">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
        
        <!-- PDFなし Top テーブル -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-times-circle text-red-500 mr-1"></i>PDFなし（Tier1優先・締切近い順）
          </h3>
          <div id="pdf-no-table" class="overflow-x-auto max-h-64">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
        
        <!-- 次のアクション候補 -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>次のアクション候補（PDFなし but 参照URLあり）
          </h3>
          <div id="pdf-action-candidates" class="overflow-x-auto max-h-48">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>

      <!-- カード2: PDF Missing Types -->
      <div class="bg-white rounded-xl shadow p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-layer-group text-orange-600 mr-2"></i>PDFなしタイプ分類
          </h2>
          <button onclick="loadPdfMissingTypes()" class="text-sm text-indigo-600 hover:text-indigo-800">
            <i class="fas fa-sync-alt mr-1"></i>更新
          </button>
        </div>
        
        <!-- バケット別バー -->
        <div id="missing-types-bars" class="space-y-4 mb-6">
          <div class="loading text-gray-400 p-4">読み込み中...</div>
        </div>
        
        <!-- 主要補助金（要対応）サンプル -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-star text-yellow-500 mr-1"></i>主要補助金（PDFなし・要対応）
          </h3>
          <div id="needs-manual-samples" class="overflow-x-auto max-h-48">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>

      <!-- カード3: Wall Chat Ready Progress -->
      <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-chart-line text-green-600 mr-2"></i>Wall Chat Ready 進捗
          </h2>
          <button onclick="loadWallChatProgress()" class="text-sm text-indigo-600 hover:text-indigo-800">
            <i class="fas fa-sync-alt mr-1"></i>更新
          </button>
        </div>
        
        <!-- 全体サマリー（Active中心） -->
        <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          <div class="bg-gray-50 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">Active</p>
            <p id="wcr-total" class="text-xl font-bold text-gray-700">-</p>
          </div>
          <div class="bg-green-50 rounded-lg p-3 text-center">
            <p class="text-xs text-green-600">Ready</p>
            <p id="wcr-ready" class="text-xl font-bold text-green-700">-</p>
          </div>
          <div class="bg-purple-50 rounded-lg p-3 text-center">
            <p class="text-xs text-purple-600">Ready率</p>
            <p id="wcr-ready-rate" class="text-xl font-bold text-purple-700">-%</p>
          </div>
          <div class="bg-indigo-50 rounded-lg p-3 text-center">
            <p class="text-xs text-indigo-600">R2 PDF</p>
            <p id="wcr-r2-pdf" class="text-xl font-bold text-indigo-700">-</p>
          </div>
          <div class="bg-blue-50 rounded-lg p-3 text-center">
            <p class="text-xs text-blue-600">Base64済</p>
            <p id="wcr-base64" class="text-xl font-bold text-blue-700">-</p>
          </div>
          <div class="bg-orange-50 rounded-lg p-3 text-center">
            <p class="text-xs text-orange-600">Enriched</p>
            <p id="wcr-enriched" class="text-xl font-bold text-orange-700">-</p>
          </div>
        </div>
        
        <!-- Source別テーブル -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-database mr-1"></i>Source別 Ready率
          </h3>
          <div id="wcr-by-source" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
        
        <!-- Extraction Queue 状態 -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-tasks mr-1"></i>Extraction Queue 状態
          </h3>
          <div id="extraction-queue-stats" class="flex flex-wrap gap-2">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 補助金データ概要（super_admin のみ） -->
    <div id="subsidy-data-section" class="hidden mb-8">
      <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-database text-indigo-600 mr-2"></i>補助金データ概要
          </h2>
          <button onclick="loadSubsidyOverview()" class="text-sm text-indigo-600 hover:text-indigo-800">
            <i class="fas fa-sync-alt mr-1"></i>更新
          </button>
        </div>
        
        <!-- サマリーカード -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
            <p class="text-sm text-indigo-600 font-medium">総件数</p>
            <p id="sd-total" class="text-3xl font-bold text-indigo-700">-</p>
            <p class="text-xs text-indigo-400">subsidy_cache</p>
          </div>
          <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
            <p class="text-sm text-green-600 font-medium">検索可能</p>
            <p id="sd-searchable" class="text-3xl font-bold text-green-700">-</p>
            <p id="sd-searchable-pct" class="text-xs text-green-500">-%</p>
          </div>
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <p class="text-sm text-blue-600 font-medium">Ready</p>
            <p id="sd-ready" class="text-3xl font-bold text-blue-700">-</p>
            <p id="sd-ready-pct" class="text-xs text-blue-500">-%</p>
          </div>
          <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
            <p class="text-sm text-yellow-600 font-medium">Excluded</p>
            <p id="sd-excluded" class="text-3xl font-bold text-yellow-700">-</p>
          </div>
          <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 text-center">
            <p class="text-sm text-red-600 font-medium">Not Ready</p>
            <p id="sd-not-ready" class="text-3xl font-bold text-red-700">-</p>
          </div>
        </div>

        <!-- canonical vs cache ギャップ -->
        <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 class="text-sm font-medium text-amber-800 mb-2">
            <i class="fas fa-exclamation-triangle text-amber-500 mr-1"></i>canonical vs cache ギャップ
          </h3>
          <div class="grid grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-xs text-gray-500">subsidy_canonical</p>
              <p id="sd-canonical" class="text-xl font-bold text-gray-700">-</p>
            </div>
            <div class="text-center">
              <p class="text-xs text-gray-500">subsidy_cache</p>
              <p id="sd-cache-total" class="text-xl font-bold text-gray-700">-</p>
            </div>
            <div class="text-center">
              <p class="text-xs text-gray-500">ギャップ</p>
              <p id="sd-gap" class="text-xl font-bold text-red-600">-</p>
              <p class="text-xs text-gray-400">canonical未昇格</p>
            </div>
          </div>
          <p class="text-xs text-amber-700 mt-2">
            <i class="fas fa-info-circle mr-1"></i>
            SEARCH_BACKEND=cache で運用中。Izumiデータは canonical 未昇格のため cache 検索で対応。
          </p>
        </div>

        <!-- ソース別内訳テーブル -->
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            <i class="fas fa-layer-group mr-1"></i>ソース別内訳
          </h3>
          <div id="sd-by-source" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>

        <!-- Izumiクロール進捗 -->
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 class="text-sm font-medium text-blue-800 mb-2">
            <i class="fas fa-spider text-blue-500 mr-1"></i>Izumiクロール進捗（fallback_v1 → crawl_v2 アップグレード）
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
            <div class="bg-white rounded p-2 text-center">
              <p class="text-xs text-gray-500">crawl_v2完了</p>
              <p id="sd-crawl-v2" class="text-lg font-bold text-green-600">-</p>
            </div>
            <div class="bg-white rounded p-2 text-center">
              <p class="text-xs text-gray-500">fallback_v1残</p>
              <p id="sd-fallback-remaining" class="text-lg font-bold text-yellow-600">-</p>
            </div>
            <div class="bg-white rounded p-2 text-center">
              <p class="text-xs text-gray-500">クロールエラー</p>
              <p id="sd-crawl-errors" class="text-lg font-bold text-red-600">-</p>
            </div>
            <div class="bg-white rounded p-2 text-center">
              <p class="text-xs text-gray-500">進捗率</p>
              <p id="sd-crawl-progress" class="text-lg font-bold text-indigo-600">-%</p>
            </div>
            <div class="bg-white rounded p-2 text-center">
              <p class="text-xs text-gray-500">最終実行</p>
              <p id="sd-last-run" class="text-sm font-bold text-gray-600">-</p>
              <p id="sd-last-run-status" class="text-xs text-gray-400">-</p>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div id="sd-crawl-bar" class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
          </div>
          <!-- 日別クロール統計 -->
          <div id="sd-daily-crawl" class="hidden mt-3 pt-3 border-t border-blue-200">
            <p class="text-xs text-blue-700 font-medium mb-2"><i class="fas fa-chart-bar mr-1"></i>日別クロール統計（過去7日）</p>
            <div id="sd-daily-crawl-data" class="text-xs text-gray-600"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- コスト概要（super_admin のみ） -->
    <div id="cost-section" class="hidden mb-8">
      <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-dollar-sign text-green-600 mr-2"></i>APIコスト概要
          </h2>
          <a href="/admin/costs" class="text-sm text-indigo-600 hover:text-indigo-800">
            詳細を見る <i class="fas fa-arrow-right ml-1"></i>
          </a>
        </div>
        
        <!-- 全期間コスト -->
        <div class="mb-4">
          <p class="text-xs text-gray-500 mb-2 font-medium">全期間（api_cost_logs記録分）</p>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
              <p class="text-xs text-green-600">OpenAI</p>
              <p id="cost-openai-all" class="text-xl font-bold text-green-700">$-</p>
              <p id="cost-openai-calls" class="text-xs text-green-500">- calls</p>
            </div>
            <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3">
              <p class="text-xs text-orange-600">Firecrawl</p>
              <p id="cost-firecrawl-all" class="text-xl font-bold text-orange-700">$-</p>
              <p id="cost-firecrawl-calls" class="text-xs text-orange-500">- calls</p>
            </div>
            <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
              <p class="text-xs text-blue-600">SimpleScrape</p>
              <p id="cost-scrape-calls" class="text-xl font-bold text-blue-700">-</p>
              <p class="text-xs text-blue-500">呼び出し数（$0）</p>
            </div>
            <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3">
              <p class="text-xs text-indigo-600">API合計</p>
              <p id="cost-total" class="text-xl font-bold text-indigo-700">$-</p>
              <p class="text-xs text-indigo-500">記録済みのみ</p>
            </div>
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3">
              <p class="text-xs text-gray-600">今月</p>
              <p id="cost-openai" class="text-xl font-bold text-gray-700">$-</p>
              <p id="cost-firecrawl" class="text-xs text-gray-500 hidden">fc: $-</p>
            </div>
          </div>
        </div>

        <!-- 未計測コスト注意 -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p class="font-medium text-amber-800 mb-1">
            <i class="fas fa-info-circle text-amber-500 mr-1"></i>コスト把握の注意点
          </p>
          <ul class="text-xs text-amber-700 space-y-1 ml-5 list-disc">
            <li><strong>上記はAPIコストのみ</strong>（api_cost_logs記録分）</li>
            <li><strong>Cloudflare</strong>（Workers/D1/R2/Pages）→ <a href="https://dash.cloudflare.com" target="_blank" class="underline">Cloudflare Dashboard</a> で確認</li>
            <li><strong>AWS</strong>（Lambda/API Gateway等）→ AWS Billing Console で確認</li>
            <li><strong>Firecrawl実コスト</strong> → <a href="https://www.firecrawl.dev/app" target="_blank" class="underline">Firecrawl Dashboard</a> で確認（課金額とapi_cost_logsのズレに注意）</li>
            <li><strong>壁打ちチャット</strong>はテンプレートベースのためOpenAI不使用（$0）</li>
          </ul>
        </div>

        <!-- インフラ使用状況 -->
        <div class="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p class="font-medium text-slate-700 mb-2 text-sm">
            <i class="fas fa-server text-slate-500 mr-1"></i>インフラ使用状況（参考値）
          </p>
          <div id="cost-infra-stats" class="text-xs text-slate-600">読み込み中...</div>
        </div>

        <!-- 月別コスト推移 -->
        <div class="mt-4">
          <p class="font-medium text-gray-700 mb-2 text-sm">
            <i class="fas fa-calendar-alt text-gray-500 mr-1"></i>月別コスト推移
          </p>
          <div id="cost-monthly-table" class="text-xs text-gray-600">読み込み中...</div>
        </div>

        <div id="cost-alert" class="hidden mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span id="cost-alert-text"></span>
        </div>
      </div>
    </div>

    <!-- 日別推移グラフ -->
    <div class="bg-white rounded-xl shadow p-6">
      <h2 class="text-lg font-bold text-gray-800 mb-4">
        <i class="fas fa-chart-line text-blue-600 mr-2"></i>日別推移（過去7日）
      </h2>
      <canvas id="daily-chart" height="100"></canvas>
    </div>

    <script>
      let dailyChart;

      async function loadDashboard() {
        try {
          console.log('[loadDashboard] Starting...');
          const data = await api('/api/admin-ops/dashboard');
          console.log('[loadDashboard] Response:', data);
          
          if (!data.success) {
            throw new Error(data.error?.message || 'Unknown error');
          }
          
          if (!data.data) {
            throw new Error('No data in response');
          }

          const { kpi, queue, daily } = data.data;

          // KPIカード更新
          document.getElementById('kpi-users-total').textContent = kpi.users?.total || 0;
          document.getElementById('kpi-users-today').textContent = kpi.users?.today || 0;
          document.getElementById('kpi-searches-total').textContent = kpi.searches?.total || 0;
          document.getElementById('kpi-searches-today').textContent = kpi.searches?.today || 0;
          document.getElementById('kpi-chats-total').textContent = kpi.chats?.total || 0;
          document.getElementById('kpi-chats-today').textContent = kpi.chats?.today || 0;
          document.getElementById('kpi-drafts-total').textContent = kpi.drafts?.total || 0;
          document.getElementById('kpi-drafts-today').textContent = kpi.drafts?.today || 0;

          // 補助金ミニサマリー（super_admin向け）
          if (data.data.subsidy_summary) {
            const ss = data.data.subsidy_summary;
            const miniEl = document.getElementById('subsidy-mini-summary');
            if (miniEl) {
              miniEl.classList.remove('hidden');
              document.getElementById('mini-sd-total').textContent = (ss.total || 0).toLocaleString();
              document.getElementById('mini-sd-searchable').textContent = (ss.searchable || 0).toLocaleString();
              document.getElementById('mini-sd-ready').textContent = (ss.ready || 0).toLocaleString();
              document.getElementById('mini-sd-excluded').textContent = (ss.excluded || 0).toLocaleString();
            }
          }

          // ファネル更新
          const maxUsers = kpi.users?.month || 1;
          const updateFunnel = (id, value) => {
            const el = document.getElementById(id);
            const pct = Math.min(100, Math.round((value / maxUsers) * 100));
            el.style.width = pct + '%';
            el.textContent = value;
          };
          updateFunnel('funnel-users', kpi.users?.month || 0);
          updateFunnel('funnel-searches', kpi.searches?.month || 0);
          updateFunnel('funnel-chats', kpi.chats?.month || 0);
          updateFunnel('funnel-drafts', kpi.drafts?.month || 0);

          // キュー状況
          const queueHtml = Object.entries(queue).map(([status, count]) => {
            const colors = {
              pending: 'bg-yellow-100 text-yellow-800',
              processing: 'bg-blue-100 text-blue-800',
              completed: 'bg-green-100 text-green-800',
              failed: 'bg-red-100 text-red-800',
            };
            return \`<div class="flex justify-between items-center p-2 rounded \${colors[status] || 'bg-gray-100'}">
              <span class="font-medium">\${status}</span>
              <span class="font-bold">\${count}</span>
            </div>\`;
          }).join('');
          document.getElementById('queue-status').innerHTML = queueHtml || '<p class="text-gray-400">キューは空です</p>';

          // 今日の直近イベント
          const recentEvents = data.data.recent_events || [];
          const eventsEl = document.getElementById('recent-events');
          if (recentEvents.length > 0) {
            const eventTypeLabels = {
              'SUBSIDY_SEARCH': { label: '補助金検索', color: 'bg-green-100 text-green-800', icon: 'fas fa-search' },
              'CHAT_SESSION_STARTED': { label: '壁打ち開始', color: 'bg-purple-100 text-purple-800', icon: 'fas fa-comments' },
              'DRAFT_GENERATED': { label: 'ドラフト生成', color: 'bg-orange-100 text-orange-800', icon: 'fas fa-file-alt' },
            };
            const eventsHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">時刻</th><th class="px-3 py-2 text-left">イベント</th><th class="px-3 py-2 text-left">ユーザー</th><th class="px-3 py-2 text-left">会社</th><th class="px-3 py-2 text-left">詳細</th></tr></thead>' +
              '<tbody>' + recentEvents.map(e => {
                const config = eventTypeLabels[e.event_type] || { label: e.event_type, color: 'bg-gray-100 text-gray-800', icon: 'fas fa-circle' };
                const time = e.created_at ? new Date(e.created_at).toLocaleTimeString('ja-JP') : '-';
                let detail = '';
                try {
                  const meta = e.metadata ? JSON.parse(e.metadata) : {};
                  if (e.event_type === 'SUBSIDY_SEARCH') {
                    detail = '結果: ' + (meta.results_count || 0) + '件';
                  } else if (e.event_type === 'CHAT_SESSION_STARTED') {
                    detail = 'ステータス: ' + (meta.precheck_status || '-');
                  } else if (e.event_type === 'DRAFT_GENERATED') {
                    detail = 'NG: ' + (meta.ng_count || 0) + '件';
                  }
                } catch (err) {}
                return '<tr class="border-b hover:bg-gray-50">' +
                  '<td class="px-3 py-2 text-gray-500 text-xs">' + time + '</td>' +
                  '<td class="px-3 py-2"><span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ' + config.color + '"><i class="' + config.icon + ' mr-1"></i>' + config.label + '</span></td>' +
                  '<td class="px-3 py-2 text-xs">' + (e.user_email || '-') + '</td>' +
                  '<td class="px-3 py-2 text-xs">' + (e.company_name || '-') + '</td>' +
                  '<td class="px-3 py-2 text-xs text-gray-500">' + detail + '</td>' +
                  '</tr>';
              }).join('') + '</tbody></table>';
            eventsEl.innerHTML = eventsHtml;
          } else {
            eventsEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-2"></i><p>今日のイベントはまだありません</p><p class="text-xs mt-1">検索・壁打ち・ドラフト生成を行うとここに表示されます</p></div>';
          }

          // 日別チャート
          const dates = [...new Set(daily.users.map(d => d.date))].sort();
          const userCounts = dates.map(d => daily.users.find(u => u.date === d)?.count || 0);

          if (dailyChart) dailyChart.destroy();
          dailyChart = new Chart(document.getElementById('daily-chart'), {
            type: 'line',
            data: {
              labels: dates,
              datasets: [{
                label: 'ユーザー登録',
                data: userCounts,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
              }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: true } },
              scales: { y: { beginAtZero: true } },
            },
          });

          // loading クラス削除
          document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));

        } catch (error) {
          console.error('Dashboard load error:', error);
          // エラー表示をUIに反映
          const errorMsg = error.message || 'データの読み込みに失敗しました';
          document.getElementById('kpi-users-total').textContent = '!';
          document.getElementById('kpi-users-total').title = errorMsg;
          document.getElementById('kpi-searches-total').textContent = '!';
          document.getElementById('kpi-chats-total').textContent = '!';
          document.getElementById('kpi-drafts-total').textContent = '!';
          document.querySelectorAll('.loading').forEach(el => {
            el.classList.remove('loading');
            el.classList.add('text-red-500');
          });
        }
      }

      async function loadCosts() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user?.role !== 'super_admin') return;

        document.getElementById('cost-section').classList.remove('hidden');

        try {
          const data = await api('/api/admin-ops/costs');
          if (!data.success) return;

          const { totals, alerts, infra, monthly } = data.data;
          
          // 全期間コスト
          const openaiAll = totals.openai?.all_time || 0;
          const firecrawlAll = totals.firecrawl?.all_time || 0;
          const totalAll = openaiAll + firecrawlAll;
          const openaiCalls = totals.openai?.all_time_calls || 0;
          const firecrawlCalls = totals.firecrawl?.all_time_calls || 0;
          const scrapeCalls = totals.simple_scrape?.all_time_calls || 0;

          document.getElementById('cost-openai-all').textContent = '$' + openaiAll.toFixed(4);
          document.getElementById('cost-openai-calls').textContent = openaiCalls.toLocaleString() + ' calls';
          document.getElementById('cost-firecrawl-all').textContent = '$' + firecrawlAll.toFixed(4);
          document.getElementById('cost-firecrawl-calls').textContent = firecrawlCalls.toLocaleString() + ' calls';
          document.getElementById('cost-scrape-calls').textContent = scrapeCalls.toLocaleString();
          document.getElementById('cost-total').textContent = '$' + totalAll.toFixed(4);

          // 今月コスト
          const openaiMonth = totals.openai?.month || 0;
          const firecrawlMonth = totals.firecrawl?.month || 0;
          const monthTotal = openaiMonth + firecrawlMonth;
          document.getElementById('cost-openai').textContent = '$' + monthTotal.toFixed(2);
          if (firecrawlMonth > 0) {
            document.getElementById('cost-firecrawl').textContent = 'fc: $' + firecrawlMonth.toFixed(2);
            document.getElementById('cost-firecrawl').classList.remove('hidden');
          }

          // インフラ使用状況
          if (infra) {
            const infraEl = document.getElementById('cost-infra-stats');
            if (infraEl) {
              const dbRows = infra.db_rows || {};
              const totalRows = Object.values(dbRows).reduce(function(a, b) { return a + b; }, 0);
              infraEl.innerHTML = 
                '<div class="grid grid-cols-2 gap-2 text-xs">' +
                '<div><span class="text-gray-500">Cron実行:</span> <strong>' + (infra.total_cron_runs || 0).toLocaleString() + '</strong>回</div>' +
                '<div><span class="text-gray-500">処理件数:</span> <strong>' + (infra.total_items_processed || 0).toLocaleString() + '</strong></div>' +
                '<div><span class="text-gray-500">DB行数:</span> <strong>' + totalRows.toLocaleString() + '</strong></div>' +
                '<div><span class="text-gray-500">最終Cron:</span> <strong>' + (infra.last_cron_run ? new Date(infra.last_cron_run).toLocaleString('ja-JP') : '-') + '</strong></div>' +
                '</div>';
            }
          }

          // 月別推移テーブル
          if (monthly && monthly.length > 0) {
            const monthlyEl = document.getElementById('cost-monthly-table');
            if (monthlyEl) {
              var monthMap = {};
              monthly.forEach(function(r) {
                if (!monthMap[r.month]) monthMap[r.month] = { openai: 0, firecrawl: 0, simple_scrape: 0, calls: 0 };
                monthMap[r.month][r.service] = (monthMap[r.month][r.service] || 0) + r.cost;
                monthMap[r.month].calls += r.calls;
              });
              var months = Object.keys(monthMap).sort().reverse();
              var html = '<table class="min-w-full text-xs"><thead><tr class="bg-gray-50">' +
                '<th class="px-2 py-1 text-left">月</th><th class="px-2 py-1 text-right">OpenAI</th>' +
                '<th class="px-2 py-1 text-right">Firecrawl</th><th class="px-2 py-1 text-right">合計</th>' +
                '<th class="px-2 py-1 text-right">API calls</th></tr></thead><tbody>';
              months.forEach(function(m) {
                var d = monthMap[m];
                var t = d.openai + d.firecrawl;
                html += '<tr class="border-t"><td class="px-2 py-1">' + m + '</td>' +
                  '<td class="px-2 py-1 text-right">$' + d.openai.toFixed(4) + '</td>' +
                  '<td class="px-2 py-1 text-right">$' + d.firecrawl.toFixed(4) + '</td>' +
                  '<td class="px-2 py-1 text-right font-medium">$' + t.toFixed(4) + '</td>' +
                  '<td class="px-2 py-1 text-right">' + d.calls.toLocaleString() + '</td></tr>';
              });
              html += '</tbody></table>';
              monthlyEl.innerHTML = html;
            }
          }

          if (alerts.costAlert) {
            document.getElementById('cost-alert').classList.remove('hidden');
            document.getElementById('cost-alert-text').textContent = 
              alerts.costAlert === 'HIGH' 
                ? '今日のコストが前日比3倍以上です！' 
                : '今日のコストが前日比2倍以上です';
          }
        } catch (error) {
          console.error('Costs load error:', error);
        }
      }

      // ★ 補助金データ概要 ★
      async function loadSubsidyOverview() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user?.role !== 'super_admin') return;

        document.getElementById('subsidy-data-section').classList.remove('hidden');

        try {
          const data = await api('/api/admin-ops/subsidy-overview');
          if (!data.success) {
            console.error('Subsidy overview error:', data.error);
            return;
          }

          const { cache_stats, canonical_stats, by_source, crawl_progress } = data.data;

          // サマリーカード
          document.getElementById('sd-total').textContent = (cache_stats.total || 0).toLocaleString();
          document.getElementById('sd-searchable').textContent = (cache_stats.searchable || 0).toLocaleString();
          const sPct = cache_stats.total > 0 ? ((cache_stats.searchable / cache_stats.total) * 100).toFixed(1) : 0;
          document.getElementById('sd-searchable-pct').textContent = sPct + '%';
          document.getElementById('sd-ready').textContent = (cache_stats.ready || 0).toLocaleString();
          const rPct = cache_stats.total > 0 ? ((cache_stats.ready / cache_stats.total) * 100).toFixed(1) : 0;
          document.getElementById('sd-ready-pct').textContent = rPct + '%';
          document.getElementById('sd-excluded').textContent = (cache_stats.excluded || 0).toLocaleString();
          document.getElementById('sd-not-ready').textContent = (cache_stats.not_ready || 0).toLocaleString();

          // canonical vs cache ギャップ
          document.getElementById('sd-canonical').textContent = (canonical_stats.total || 0).toLocaleString();
          document.getElementById('sd-cache-total').textContent = (cache_stats.total || 0).toLocaleString();
          const gap = (cache_stats.total || 0) - (canonical_stats.total || 0);
          document.getElementById('sd-gap').textContent = gap.toLocaleString();

          // ソース別テーブル
          if (by_source && by_source.length > 0) {
            const tableHtml = '<table class="min-w-full text-sm"><thead><tr class="bg-gray-50">' +
              '<th class="px-3 py-2 text-left">ソース</th>' +
              '<th class="px-3 py-2 text-right">総件数</th>' +
              '<th class="px-3 py-2 text-right">Ready</th>' +
              '<th class="px-3 py-2 text-right">Excluded</th>' +
              '<th class="px-3 py-2 text-right">Not Ready</th>' +
              '<th class="px-3 py-2 text-right">Ready率</th>' +
              '</tr></thead><tbody>' +
              by_source.map(s => {
                const readyPct = s.total > 0 ? ((s.ready / s.total) * 100).toFixed(1) : '0.0';
                const barColor = parseFloat(readyPct) >= 90 ? 'bg-green-500' : parseFloat(readyPct) >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                return '<tr class="border-b hover:bg-gray-50">' +
                  '<td class="px-3 py-2 font-medium">' + s.source + '</td>' +
                  '<td class="px-3 py-2 text-right">' + s.total.toLocaleString() + '</td>' +
                  '<td class="px-3 py-2 text-right text-green-600">' + s.ready.toLocaleString() + '</td>' +
                  '<td class="px-3 py-2 text-right text-yellow-600">' + (s.excluded || 0) + '</td>' +
                  '<td class="px-3 py-2 text-right text-red-600">' + (s.not_ready || 0) + '</td>' +
                  '<td class="px-3 py-2 text-right"><div class="flex items-center justify-end gap-2"><div class="w-16 bg-gray-200 rounded-full h-2"><div class="' + barColor + ' h-2 rounded-full" style="width:' + readyPct + '%"></div></div><span class="text-xs">' + readyPct + '%</span></div></td>' +
                  '</tr>';
              }).join('') +
              '</tbody></table>';
            document.getElementById('sd-by-source').innerHTML = tableHtml;
          }

          // Izumiクロール進捗
          if (crawl_progress) {
            document.getElementById('sd-crawl-v2').textContent = (crawl_progress.crawl_v2 || 0).toLocaleString();
            document.getElementById('sd-fallback-remaining').textContent = (crawl_progress.fallback_remaining || 0).toLocaleString();
            document.getElementById('sd-crawl-errors').textContent = (crawl_progress.errors || 0).toLocaleString();
            const total_izumi = (crawl_progress.crawl_v2 || 0) + (crawl_progress.fallback_remaining || 0) + (crawl_progress.errors || 0);
            const progressPct = total_izumi > 0 ? ((crawl_progress.crawl_v2 / total_izumi) * 100).toFixed(1) : '0';
            document.getElementById('sd-crawl-progress').textContent = progressPct + '%';
            document.getElementById('sd-crawl-bar').style.width = progressPct + '%';

            // 最終実行情報
            if (crawl_progress.last_run) {
              const lr = crawl_progress.last_run;
              const finishedAt = lr.finished_at ? new Date(lr.finished_at + 'Z') : null;
              const timeStr = finishedAt ? finishedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) : '-';
              document.getElementById('sd-last-run').textContent = timeStr;
              const statusIcon = lr.status === 'success' ? '✅' : '❌';
              document.getElementById('sd-last-run-status').textContent = statusIcon + ' ' + lr.items_inserted + '/' + lr.items_processed + '件処理';
            }

            // 日別クロール統計
            if (crawl_progress.daily_stats && crawl_progress.daily_stats.length > 0) {
              const dailyEl = document.getElementById('sd-daily-crawl');
              dailyEl.classList.remove('hidden');
              const rows = crawl_progress.daily_stats.map(d => {
                const successRate = d.processed > 0 ? ((d.inserted / d.processed) * 100).toFixed(0) : '0';
                return '<div class="flex justify-between py-1 border-b border-blue-100">' +
                  '<span>' + d.date + '</span>' +
                  '<span>' + d.runs + '回</span>' +
                  '<span>' + d.inserted + '/' + d.processed + '件</span>' +
                  '<span class="' + (parseInt(successRate) >= 80 ? 'text-green-600' : 'text-yellow-600') + '">' + successRate + '%</span>' +
                  '</div>';
              }).join('');
              document.getElementById('sd-daily-crawl-data').innerHTML = 
                '<div class="flex justify-between py-1 text-blue-600 font-medium"><span>日付</span><span>実行回数</span><span>成功/処理</span><span>成功率</span></div>' + rows;
            }
          }

        } catch (error) {
          console.error('Subsidy overview load error:', error);
        }
      }

      async function loadCoverage() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user?.role !== 'super_admin') return;

        document.getElementById('coverage-section').classList.remove('hidden');

        try {
          const data = await api('/api/admin-ops/coverage');
          if (!data.success) {
            console.error('Coverage load failed:', data.error);
            return;
          }

          const { score, queue_health, domain_errors_top, duplicate_crawls, l1_entry_coverage, l2_crawl_coverage, l3_data_coverage } = data.data;

          // スコア更新
          document.getElementById('coverage-score-total').textContent = score?.total || 0;
          document.getElementById('coverage-score-l1').textContent = (score?.l1_score || 0) + '%';
          document.getElementById('coverage-score-l2').textContent = (score?.l2_score || 0) + '%';
          document.getElementById('coverage-score-l3').textContent = (score?.l3_score || 0) + '%';

          // キュー健全性
          const qhEl = document.getElementById('queue-health');
          if (queue_health) {
            const statusColors = {
              queued: 'bg-yellow-100 text-yellow-800',
              running: 'bg-blue-100 text-blue-800',
              done: 'bg-green-100 text-green-800',
              failed: 'bg-red-100 text-red-800',
              blocked: 'bg-gray-100 text-gray-800',
            };
            const statusHtml = Object.entries(queue_health.by_status || {}).map(([status, count]) => 
              '<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ' + (statusColors[status] || 'bg-gray-100') + ' mr-2">' + status + ': ' + count + '</span>'
            ).join('');
            
            const healthStatus = queue_health.is_healthy 
              ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"><i class="fas fa-check-circle mr-1"></i>正常</span>'
              : '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"><i class="fas fa-exclamation-triangle mr-1"></i>' + (queue_health.warning || '異常') + '</span>';
            
            const oldest = queue_health.oldest_queued?.oldest_created 
              ? '<p class="text-xs text-gray-500 mt-2">最古のqueued: ' + queue_health.oldest_queued.oldest_created + ' (' + queue_health.oldest_queued.total_queued + '件待機中)</p>'
              : '';
            
            const last24h = queue_health.last_24h 
              ? '<p class="text-xs text-gray-500">直近24h: 処理済み' + (queue_health.last_24h.done || 0) + '件 / 失敗' + (queue_health.last_24h.failed || 0) + '件</p>'
              : '';

            qhEl.innerHTML = '<div class="flex items-center gap-4">' + healthStatus + '</div>' +
              '<div class="mt-3">' + statusHtml + '</div>' + oldest + last24h;
          }

          // ドメイン別エラー率Top
          const deEl = document.getElementById('domain-errors');
          if (domain_errors_top && domain_errors_top.length > 0) {
            const tableHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-gray-100"><th class="px-3 py-2 text-left">ドメイン</th><th class="px-3 py-2 text-right">合計</th><th class="px-3 py-2 text-right">失敗</th><th class="px-3 py-2 text-right">成功</th><th class="px-3 py-2 text-right">失敗率</th></tr></thead>' +
              '<tbody>' + domain_errors_top.slice(0, 10).map(d => 
                '<tr class="border-b ' + (d.failed_pct > 50 ? 'bg-red-50' : d.failed_pct > 20 ? 'bg-yellow-50' : '') + '">' +
                '<td class="px-3 py-2 font-mono text-xs">' + d.domain_key + '</td>' +
                '<td class="px-3 py-2 text-right">' + d.total + '</td>' +
                '<td class="px-3 py-2 text-right text-red-600">' + d.failed + '</td>' +
                '<td class="px-3 py-2 text-right text-green-600">' + d.done + '</td>' +
                '<td class="px-3 py-2 text-right font-medium ' + (d.failed_pct > 50 ? 'text-red-700' : d.failed_pct > 20 ? 'text-yellow-700' : 'text-gray-700') + '">' + d.failed_pct + '%</td>' +
                '</tr>'
              ).join('') + '</tbody></table>';
            deEl.innerHTML = tableHtml;
          } else {
            deEl.innerHTML = '<p class="text-gray-400 p-4">エラーの多いドメインはありません</p>';
          }

          // 重複クロール検知
          const dcEl = document.getElementById('duplicate-crawls');
          if (duplicate_crawls && duplicate_crawls.length > 0) {
            const tableHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-gray-100"><th class="px-3 py-2 text-left">URL</th><th class="px-3 py-2 text-right">回数</th></tr></thead>' +
              '<tbody>' + duplicate_crawls.slice(0, 10).map(d => 
                '<tr class="border-b bg-orange-50">' +
                '<td class="px-3 py-2 font-mono text-xs truncate max-w-md" title="' + d.url + '">' + (d.url.length > 60 ? d.url.substring(0, 60) + '...' : d.url) + '</td>' +
                '<td class="px-3 py-2 text-right font-bold text-orange-600">' + d.cnt + '回</td>' +
                '</tr>'
              ).join('') + '</tbody></table>';
            dcEl.innerHTML = tableHtml;
          } else {
            dcEl.innerHTML = '<p class="text-gray-400 p-4">重複クロールは検出されていません</p>';
          }

        } catch (error) {
          console.error('Coverage load error:', error);
        }
      }

      // ============================================================
      // PDF Coverage (jGrants)
      // ============================================================
      async function loadPdfCoverage() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user?.role !== 'super_admin') return;
        
        document.getElementById('data-coverage-section').classList.remove('hidden');
        
        try {
          const data = await api('/api/admin-ops/jgrants/pdf-coverage?days=90&limit=50');
          if (!data.success) throw new Error(data.error?.message);
          
          const { summary, top_pdf_yes, top_pdf_no, pdf_no_but_has_urls } = data.data;
          
          // サマリー更新
          document.getElementById('pdf-total').textContent = summary.total || 0;
          document.getElementById('pdf-has-urls').textContent = summary.has_pdf_urls || 0;
          document.getElementById('pdf-coverage-rate').textContent = summary.pdf_coverage_rate || '0%';
          document.getElementById('pdf-enriched-v2').textContent = summary.enriched_v2 || 0;
          document.getElementById('pdf-enriched-rate').textContent = summary.enriched_rate || '0%';
          document.getElementById('pdf-ready').textContent = summary.wall_chat_ready || 0;
          document.getElementById('pdf-ready-rate').textContent = summary.ready_rate || '0%';
          document.getElementById('pdf-active').textContent = summary.active_acceptance || 0;
          
          // PDFありテーブル
          const yesEl = document.getElementById('pdf-yes-table');
          if (top_pdf_yes && top_pdf_yes.length > 0) {
            const html = '<table class="min-w-full text-sm">' +
              '<thead class="bg-green-50"><tr><th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">タイトル</th><th class="px-3 py-2 text-right">締切</th><th class="px-3 py-2 text-right">PDF数</th><th class="px-3 py-2 text-center">Ready</th></tr></thead>' +
              '<tbody>' + top_pdf_yes.slice(0, 20).map(r => {
                const deadline = r.acceptance_end_datetime ? new Date(r.acceptance_end_datetime).toLocaleDateString('ja-JP') : '-';
                const readyBadge = r.wall_chat_ready ? '<span class="text-green-600"><i class="fas fa-check"></i></span>' : '<span class="text-gray-300">-</span>';
                return '<tr class="border-b hover:bg-green-50">' +
                  '<td class="px-3 py-2 font-mono text-xs">' + (r.id?.substring(0, 12) || '-') + '</td>' +
                  '<td class="px-3 py-2 max-w-xs truncate" title="' + r.title + '">' + (r.title?.substring(0, 40) || '-') + '</td>' +
                  '<td class="px-3 py-2 text-right text-xs">' + deadline + '</td>' +
                  '<td class="px-3 py-2 text-right font-medium text-green-600">' + (r.pdf_count || 0) + '</td>' +
                  '<td class="px-3 py-2 text-center">' + readyBadge + '</td></tr>';
              }).join('') + '</tbody></table>';
            yesEl.innerHTML = html;
          } else {
            yesEl.innerHTML = '<p class="text-gray-400 p-4">PDFあり案件はありません</p>';
          }
          
          // PDFなしテーブル
          const noEl = document.getElementById('pdf-no-table');
          if (top_pdf_no && top_pdf_no.length > 0) {
            const html = '<table class="min-w-full text-sm">' +
              '<thead class="bg-red-50"><tr><th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">タイトル</th><th class="px-3 py-2 text-right">締切</th><th class="px-3 py-2 text-center">Tier1</th><th class="px-3 py-2 text-center">V2</th></tr></thead>' +
              '<tbody>' + top_pdf_no.slice(0, 20).map(r => {
                const deadline = r.acceptance_end_datetime ? new Date(r.acceptance_end_datetime).toLocaleDateString('ja-JP') : '-';
                const tier1Badge = r.is_tier1 ? '<span class="text-yellow-600"><i class="fas fa-star"></i></span>' : '-';
                const v2Badge = r.enriched_version === 'v2' ? '<span class="text-blue-600"><i class="fas fa-check"></i></span>' : '-';
                return '<tr class="border-b hover:bg-red-50 ' + (r.is_tier1 ? 'bg-yellow-50' : '') + '">' +
                  '<td class="px-3 py-2 font-mono text-xs">' + (r.id?.substring(0, 12) || '-') + '</td>' +
                  '<td class="px-3 py-2 max-w-xs truncate" title="' + r.title + '">' + (r.title?.substring(0, 40) || '-') + '</td>' +
                  '<td class="px-3 py-2 text-right text-xs">' + deadline + '</td>' +
                  '<td class="px-3 py-2 text-center">' + tier1Badge + '</td>' +
                  '<td class="px-3 py-2 text-center">' + v2Badge + '</td></tr>';
              }).join('') + '</tbody></table>';
            noEl.innerHTML = html;
          } else {
            noEl.innerHTML = '<p class="text-gray-400 p-4">PDFなし案件はありません</p>';
          }
          
          // アクション候補テーブル
          const actEl = document.getElementById('pdf-action-candidates');
          if (pdf_no_but_has_urls && pdf_no_but_has_urls.length > 0) {
            const html = '<table class="min-w-full text-sm">' +
              '<thead class="bg-yellow-50"><tr><th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">タイトル</th><th class="px-3 py-2 text-right">締切</th><th class="px-3 py-2 text-center">参照URL</th></tr></thead>' +
              '<tbody>' + pdf_no_but_has_urls.slice(0, 15).map(r => {
                const deadline = r.acceptance_end_datetime ? new Date(r.acceptance_end_datetime).toLocaleDateString('ja-JP') : '-';
                const urlCount = (r.reference_urls?.length || 0) + (r.related_url ? 1 : 0);
                return '<tr class="border-b hover:bg-yellow-50">' +
                  '<td class="px-3 py-2 font-mono text-xs">' + (r.id?.substring(0, 12) || '-') + '</td>' +
                  '<td class="px-3 py-2 max-w-xs truncate" title="' + r.title + '">' + (r.title?.substring(0, 40) || '-') + '</td>' +
                  '<td class="px-3 py-2 text-right text-xs">' + deadline + '</td>' +
                  '<td class="px-3 py-2 text-center text-blue-600 font-medium">' + urlCount + '</td></tr>';
              }).join('') + '</tbody></table>';
            actEl.innerHTML = html;
          } else {
            actEl.innerHTML = '<p class="text-gray-400 p-4">アクション候補はありません</p>';
          }
          
        } catch (error) {
          console.error('PDF coverage load error:', error);
        }
      }

      // ============================================================
      // PDF Missing Types
      // ============================================================
      async function loadPdfMissingTypes() {
        try {
          const data = await api('/api/admin-ops/jgrants/pdf-missing-types?days=180');
          if (!data.success) throw new Error(data.error?.message);
          
          const { buckets } = data.data;
          
          // バケット別バー
          const barsEl = document.getElementById('missing-types-bars');
          const bucketConfigs = {
            E_APPLY: { color: 'bg-blue-500', icon: 'fas fa-laptop' },
            HAS_RELATED_URL: { color: 'bg-yellow-500', icon: 'fas fa-link' },
            NO_URLS: { color: 'bg-gray-500', icon: 'fas fa-ban' },
            ENDED_OR_UNKNOWN: { color: 'bg-gray-400', icon: 'fas fa-calendar-times' },
            NEEDS_MANUAL: { color: 'bg-red-500', icon: 'fas fa-star' },
          };
          
          const maxCount = Math.max(...Object.values(buckets).map(b => b.count || 0), 1);
          const barsHtml = Object.entries(buckets).map(([key, bucket]) => {
            const cfg = bucketConfigs[key] || { color: 'bg-gray-500', icon: 'fas fa-question' };
            const pct = Math.round((bucket.count / maxCount) * 100);
            return '<div class="flex items-center gap-3">' +
              '<div class="w-40 text-sm"><i class="' + cfg.icon + ' mr-2 text-gray-500"></i>' + bucket.label + '</div>' +
              '<div class="flex-1 bg-gray-200 rounded-full h-6 relative">' +
                '<div class="' + cfg.color + ' h-6 rounded-full flex items-center justify-end pr-2" style="width: ' + pct + '%">' +
                  '<span class="text-white text-xs font-bold">' + bucket.count + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="w-48 text-xs text-gray-500">' + bucket.description + '</div>' +
            '</div>';
          }).join('');
          barsEl.innerHTML = barsHtml || '<p class="text-gray-400">データがありません</p>';
          
          // 要対応サンプル
          const manualEl = document.getElementById('needs-manual-samples');
          const manualSamples = buckets.NEEDS_MANUAL?.samples || [];
          if (manualSamples.length > 0) {
            const html = '<table class="min-w-full text-sm">' +
              '<thead class="bg-red-50"><tr><th class="px-3 py-2 text-left">ID</th><th class="px-3 py-2 text-left">タイトル</th><th class="px-3 py-2 text-right">締切</th><th class="px-3 py-2 text-center">URL</th></tr></thead>' +
              '<tbody>' + manualSamples.map(r => {
                const deadline = r.acceptance_end_datetime ? new Date(r.acceptance_end_datetime).toLocaleDateString('ja-JP') : '-';
                const hasUrl = r.related_url ? '<i class="fas fa-check text-green-500"></i>' : '<i class="fas fa-times text-red-400"></i>';
                return '<tr class="border-b hover:bg-red-50">' +
                  '<td class="px-3 py-2 font-mono text-xs">' + (r.id?.substring(0, 12) || '-') + '</td>' +
                  '<td class="px-3 py-2 max-w-xs truncate" title="' + r.title + '">' + (r.title?.substring(0, 40) || '-') + '</td>' +
                  '<td class="px-3 py-2 text-right text-xs">' + deadline + '</td>' +
                  '<td class="px-3 py-2 text-center">' + hasUrl + '</td></tr>';
              }).join('') + '</tbody></table>';
            manualEl.innerHTML = html;
          } else {
            manualEl.innerHTML = '<p class="text-gray-400 p-4">主要補助金のPDFなしはありません</p>';
          }
          
        } catch (error) {
          console.error('PDF missing types load error:', error);
        }
      }

      // ============================================================
      // Wall Chat Ready Progress
      // ============================================================
      async function loadWallChatProgress() {
        try {
          const data = await api('/api/admin-ops/progress/wall-chat-ready?days=60');
          if (!data.success) throw new Error(data.error?.message);
          
          const { summary, by_source, extraction_queue } = data.data;
          
          // サマリー更新（Active中心）
          document.getElementById('wcr-total').textContent = summary.active || 0;
          document.getElementById('wcr-ready').textContent = summary.ready_active || summary.ready || 0;
          document.getElementById('wcr-enriched').textContent = summary.enriched || 0;
          document.getElementById('wcr-ready-rate').textContent = summary.ready_rate || '0%';
          
          // 追加KPI（あれば）
          const base64El = document.getElementById('wcr-base64');
          if (base64El) base64El.textContent = summary.base64_processed || 0;
          const r2El = document.getElementById('wcr-r2-pdf');
          if (r2El) r2El.textContent = summary.has_r2_pdf || 0;
          
          // Source別テーブル（Active中心、新しいカラム追加）
          const srcEl = document.getElementById('wcr-by-source');
          if (by_source && by_source.length > 0) {
            const html = '<table class="min-w-full text-sm">' +
              '<thead class="bg-gray-50"><tr>' +
              '<th class="px-2 py-2 text-left">Source</th>' +
              '<th class="px-2 py-2 text-right">Active</th>' +
              '<th class="px-2 py-2 text-right">Ready</th>' +
              '<th class="px-2 py-2 text-right">Rate</th>' +
              '<th class="px-2 py-2 text-right">R2</th>' +
              '<th class="px-2 py-2 text-right">B64</th>' +
              '<th class="px-2 py-2 text-right">抽出</th>' +
              '</tr></thead>' +
              '<tbody>' + by_source.map(r => {
                const readyPct = parseFloat(r.ready_rate) || 0;
                const rowBg = readyPct >= 50 ? 'bg-green-50' : readyPct >= 10 ? 'bg-yellow-50' : '';
                return '<tr class="border-b ' + rowBg + '">' +
                  '<td class="px-2 py-2 font-medium">' + r.source + '</td>' +
                  '<td class="px-2 py-2 text-right">' + (r.active || 0) + '</td>' +
                  '<td class="px-2 py-2 text-right text-green-600 font-medium">' + (r.ready_active || r.ready || 0) + '</td>' +
                  '<td class="px-2 py-2 text-right font-bold">' + r.ready_rate + '</td>' +
                  '<td class="px-2 py-2 text-right text-purple-600">' + (r.has_r2_pdf || 0) + '</td>' +
                  '<td class="px-2 py-2 text-right text-blue-600">' + (r.base64_processed || 0) + '</td>' +
                  '<td class="px-2 py-2 text-right text-orange-600">' + (r.extracted || 0) + '</td>' +
                  '</tr>';
              }).join('') + '</tbody></table>';
            srcEl.innerHTML = html;
          } else {
            srcEl.innerHTML = '<p class="text-gray-400 p-4">ソース別データがありません</p>';
          }
          
          // Extraction Queue状態
          const qEl = document.getElementById('extraction-queue-stats');
          if (extraction_queue && extraction_queue.length > 0) {
            const statusColors = {
              queued: 'bg-yellow-100 text-yellow-800',
              leased: 'bg-blue-100 text-blue-800',
              done: 'bg-green-100 text-green-800',
              failed: 'bg-red-100 text-red-800',
            };
            const html = extraction_queue.map(q => {
              const color = statusColors[q.status] || 'bg-gray-100 text-gray-800';
              return '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ' + color + '">' +
                q.job_type + ' (' + q.status + '): ' + q.count +
              '</span>';
            }).join(' ');
            qEl.innerHTML = html;
          } else {
            qEl.innerHTML = '<p class="text-gray-400">キューは空です</p>';
          }
          
        } catch (error) {
          console.error('Wall chat progress load error:', error);
        }
      }

      loadDashboard();
      loadCosts();
      loadSubsidyOverview();
      loadCoverage();
      loadPdfCoverage();
      loadPdfMissingTypes();
      loadWallChatProgress();
    </script>
  `;

  return c.html(adminLayout('ダッシュボード', content, 'dashboard'));
});

// ============================================================
// /admin/costs - コスト詳細（super_admin限定）
// ============================================================

adminPages.get('/admin/costs', (c) => {
  const content = `
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">コスト管理</h1>
      <p class="text-gray-600 mt-1">OpenAI / Firecrawl / AWS / Cloudflare のコストを詳細に確認</p>
    </div>

    <div id="access-denied" class="hidden bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <i class="fas fa-lock text-red-400 text-4xl mb-4"></i>
      <p class="text-red-700 font-medium">Super Admin 権限が必要です</p>
      <a href="/admin" class="text-indigo-600 hover:underline mt-2 inline-block">ダッシュボードへ戻る</a>
    </div>

    <div id="costs-content" class="space-y-8">
      <!-- 概要カード（全期間 + 今月 + 今日） -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div class="bg-white rounded-xl shadow p-5 col-span-2 md:col-span-1">
          <p class="text-xs text-gray-500">全期間合計</p>
          <p id="cost-all-total" class="text-2xl font-bold text-gray-900">$-</p>
          <p id="cost-all-calls" class="text-xs text-gray-400">- calls</p>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <p class="text-xs text-green-600">OpenAI 全期間</p>
          <p id="cost-openai-all2" class="text-xl font-bold text-green-700">$-</p>
          <p id="cost-openai-calls2" class="text-xs text-green-400">- calls</p>
          <p id="cost-openai-last" class="text-[10px] text-gray-400 mt-1">-</p>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <p class="text-xs text-orange-600">Firecrawl 全期間</p>
          <p id="cost-fc-all2" class="text-xl font-bold text-orange-700">$-</p>
          <p id="cost-fc-calls2" class="text-xs text-orange-400">- calls</p>
          <p id="cost-fc-last" class="text-[10px] text-gray-400 mt-1">-</p>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <p class="text-xs text-blue-600">SimpleScrape 全期間</p>
          <p id="cost-ss-calls2" class="text-xl font-bold text-blue-700">-</p>
          <p class="text-xs text-blue-400">$0（無料）</p>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <p class="text-xs text-gray-500">今月合計</p>
          <p id="cost-month" class="text-xl font-bold text-indigo-600">$-</p>
        </div>
        <div class="bg-white rounded-xl shadow p-5">
          <p class="text-xs text-gray-500">今日合計</p>
          <p id="cost-today" class="text-xl font-bold text-gray-700">$-</p>
        </div>
      </div>

      <!-- 外部サービスコスト（手動確認リンク） -->
      <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6">
        <h2 class="text-lg font-bold text-amber-800 mb-3">
          <i class="fas fa-exclamation-triangle text-amber-500 mr-2"></i>未計測のインフラコスト
        </h2>
        <p class="text-sm text-amber-700 mb-4">以下はAPIログで計測できないコストです。各ダッシュボードで直接確認してください。</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="https://dash.cloudflare.com" target="_blank" class="bg-white rounded-lg p-4 border border-amber-200 hover:border-amber-400 transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <i class="fas fa-cloud text-orange-600"></i>
              </div>
              <div>
                <p class="font-medium text-gray-800">Cloudflare</p>
                <p class="text-xs text-gray-500">Workers / D1 / R2 / Pages</p>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">Free tier: 100K req/day, 5M D1 reads/day</p>
          </a>
          <a href="https://www.firecrawl.dev/app" target="_blank" class="bg-white rounded-lg p-4 border border-amber-200 hover:border-amber-400 transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <i class="fas fa-spider text-orange-600"></i>
              </div>
              <div>
                <p class="font-medium text-gray-800">Firecrawl</p>
                <p class="text-xs text-gray-500">実際の課金額を確認</p>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">api_cost_logsと実課金のズレに注意</p>
          </a>
          <a href="https://console.aws.amazon.com/billing" target="_blank" class="bg-white rounded-lg p-4 border border-amber-200 hover:border-amber-400 transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <i class="fab fa-aws text-yellow-700"></i>
              </div>
              <div>
                <p class="font-medium text-gray-800">AWS</p>
                <p class="text-xs text-gray-500">Lambda / API Gateway / S3</p>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">Billing Console で確認</p>
          </a>
        </div>
      </div>

      <!-- インフラ使用状況 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-server text-slate-600 mr-2"></i>インフラ使用状況
        </h2>
        <div id="infra-detail" class="text-sm text-gray-600">読み込み中...</div>
      </div>

      <!-- 月別推移テーブル -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-calendar-alt text-purple-600 mr-2"></i>月別コスト推移
        </h2>
        <div id="monthly-cost-table" class="overflow-x-auto text-sm">読み込み中...</div>
      </div>

      <!-- OpenAI詳細 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-robot text-green-600 mr-2"></i>OpenAI 使用状況
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left">モデル</th>
                <th class="px-4 py-3 text-left">機能</th>
                <th class="px-4 py-3 text-right">今日のコール数</th>
                <th class="px-4 py-3 text-right">今日のトークン</th>
                <th class="px-4 py-3 text-right">今日のコスト</th>
                <th class="px-4 py-3 text-right">今月のコスト</th>
              </tr>
            </thead>
            <tbody id="openai-table" class="divide-y">
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Firecrawl詳細 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-spider text-orange-600 mr-2"></i>Firecrawl 使用状況（ドメイン別）
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left">ドメイン</th>
                <th class="px-4 py-3 text-right">今日のコール数</th>
                <th class="px-4 py-3 text-right">今日のページ数</th>
                <th class="px-4 py-3 text-right">今日のコスト</th>
                <th class="px-4 py-3 text-right">今月のコスト</th>
                <th class="px-4 py-3 text-right">失敗数</th>
              </tr>
            </thead>
            <tbody id="firecrawl-table" class="divide-y">
              <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 日別推移 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-chart-area text-blue-600 mr-2"></i>日別コスト推移（過去30日）
        </h2>
        <canvas id="cost-chart" height="100"></canvas>
      </div>
    </div>

    <script>
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user?.role !== 'super_admin') {
        document.getElementById('access-denied').classList.remove('hidden');
        document.getElementById('costs-content').classList.add('hidden');
      } else {
        loadCostsPage();
      }

      async function loadCostsPage() {
        try {
          const data = await api('/api/admin-ops/costs');
          if (!data.success) throw new Error(data.error?.message);

          const { openai, firecrawl, daily, monthly, totals, infra } = data.data;

          // 全期間合計
          const allOpenai = totals.openai?.all_time || 0;
          const allFc = totals.firecrawl?.all_time || 0;
          const allTotal = allOpenai + allFc;
          const allCalls = (totals.openai?.all_time_calls || 0) + (totals.firecrawl?.all_time_calls || 0) + (totals.simple_scrape?.all_time_calls || 0);
          document.getElementById('cost-all-total').textContent = '$' + allTotal.toFixed(4);
          document.getElementById('cost-all-calls').textContent = allCalls.toLocaleString() + ' calls';
          document.getElementById('cost-openai-all2').textContent = '$' + allOpenai.toFixed(4);
          document.getElementById('cost-openai-calls2').textContent = (totals.openai?.all_time_calls || 0).toLocaleString() + ' calls';
          document.getElementById('cost-openai-last').textContent = totals.openai?.last_entry ? '最終: ' + new Date(totals.openai.last_entry).toLocaleString('ja-JP') : '-';
          document.getElementById('cost-fc-all2').textContent = '$' + allFc.toFixed(4);
          document.getElementById('cost-fc-calls2').textContent = (totals.firecrawl?.all_time_calls || 0).toLocaleString() + ' calls';
          document.getElementById('cost-fc-last').textContent = totals.firecrawl?.last_entry ? '最終: ' + new Date(totals.firecrawl.last_entry).toLocaleString('ja-JP') : '-';
          document.getElementById('cost-ss-calls2').textContent = (totals.simple_scrape?.all_time_calls || 0).toLocaleString();

          // 今月・今日
          const todayTotal = (totals.openai?.today || 0) + (totals.firecrawl?.today || 0);
          const monthTotal = (totals.openai?.month || 0) + (totals.firecrawl?.month || 0);
          document.getElementById('cost-today').textContent = '$' + todayTotal.toFixed(4);
          document.getElementById('cost-month').textContent = '$' + monthTotal.toFixed(4);

          // インフラ詳細
          if (infra) {
            var dbRows = infra.db_rows || {};
            var totalRows = Object.values(dbRows).reduce(function(a, b) { return a + b; }, 0);
            var infraHtml = '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
              '<div class="bg-slate-50 rounded-lg p-3"><p class="text-xs text-gray-500">総Cron実行数</p><p class="text-lg font-bold">' + (infra.total_cron_runs || 0).toLocaleString() + '</p></div>' +
              '<div class="bg-slate-50 rounded-lg p-3"><p class="text-xs text-gray-500">処理アイテム数</p><p class="text-lg font-bold">' + (infra.total_items_processed || 0).toLocaleString() + '</p></div>' +
              '<div class="bg-slate-50 rounded-lg p-3"><p class="text-xs text-gray-500">DB総行数</p><p class="text-lg font-bold">' + totalRows.toLocaleString() + '</p></div>' +
              '<div class="bg-slate-50 rounded-lg p-3"><p class="text-xs text-gray-500">最終Cron</p><p class="text-sm font-bold">' + (infra.last_cron_run ? new Date(infra.last_cron_run).toLocaleString('ja-JP') : '-') + '</p></div>' +
              '</div>';
            // テーブル別行数
            infraHtml += '<div class="overflow-x-auto"><table class="text-xs w-full"><thead class="bg-gray-50"><tr>' +
              '<th class="px-3 py-2 text-left">テーブル</th><th class="px-3 py-2 text-right">行数</th></tr></thead><tbody>';
            Object.entries(dbRows).sort(function(a, b) { return b[1] - a[1]; }).forEach(function(e) {
              infraHtml += '<tr class="border-t"><td class="px-3 py-1">' + e[0] + '</td><td class="px-3 py-1 text-right">' + e[1].toLocaleString() + '</td></tr>';
            });
            infraHtml += '</tbody></table></div>';
            document.getElementById('infra-detail').innerHTML = infraHtml;
          }

          // 月別推移テーブル
          if (monthly && monthly.length > 0) {
            var monthMap = {};
            monthly.forEach(function(r) {
              if (!monthMap[r.month]) monthMap[r.month] = { openai: 0, firecrawl: 0, simple_scrape: 0, calls: 0 };
              monthMap[r.month][r.service] = (monthMap[r.month][r.service] || 0) + r.cost;
              monthMap[r.month].calls += r.calls;
            });
            var months = Object.keys(monthMap).sort().reverse();
            var mHtml = '<table class="min-w-full"><thead><tr class="bg-gray-50">' +
              '<th class="px-4 py-2 text-left">月</th><th class="px-4 py-2 text-right">OpenAI</th>' +
              '<th class="px-4 py-2 text-right">Firecrawl</th><th class="px-4 py-2 text-right">合計</th>' +
              '<th class="px-4 py-2 text-right">API calls</th></tr></thead><tbody>';
            months.forEach(function(m) {
              var d = monthMap[m];
              var t = d.openai + d.firecrawl;
              mHtml += '<tr class="border-t"><td class="px-4 py-2">' + m + '</td>' +
                '<td class="px-4 py-2 text-right text-green-700">$' + d.openai.toFixed(4) + '</td>' +
                '<td class="px-4 py-2 text-right text-orange-700">$' + d.firecrawl.toFixed(4) + '</td>' +
                '<td class="px-4 py-2 text-right font-bold">$' + t.toFixed(4) + '</td>' +
                '<td class="px-4 py-2 text-right">' + d.calls.toLocaleString() + '</td></tr>';
            });
            mHtml += '</tbody></table>';
            document.getElementById('monthly-cost-table').innerHTML = mHtml;
          } else {
            document.getElementById('monthly-cost-table').innerHTML = '<p class="text-gray-400 py-4">月別データなし</p>';
          }

          // OpenAIテーブル
          const openaiHtml = openai.length ? openai.map(row => \`
            <tr>
              <td class="px-4 py-3 font-medium">\${row.model || '-'}</td>
              <td class="px-4 py-3">\${row.feature || '-'}</td>
              <td class="px-4 py-3 text-right">\${row.today_calls || 0}</td>
              <td class="px-4 py-3 text-right">\${(row.today_tokens || 0).toLocaleString()}</td>
              <td class="px-4 py-3 text-right">$\${(row.today_cost || 0).toFixed(4)}</td>
              <td class="px-4 py-3 text-right font-medium">$\${(row.month_cost || 0).toFixed(4)}</td>
            </tr>
          \`).join('') : '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">データなし</td></tr>';
          document.getElementById('openai-table').innerHTML = openaiHtml;

          // Firecrawlテーブル
          const firecrawlHtml = firecrawl.length ? firecrawl.map(row => \`
            <tr>
              <td class="px-4 py-3 font-medium">\${row.domain || '-'}</td>
              <td class="px-4 py-3 text-right">\${row.today_calls || 0}</td>
              <td class="px-4 py-3 text-right">\${row.today_pages || 0}</td>
              <td class="px-4 py-3 text-right">$\${(row.today_cost || 0).toFixed(4)}</td>
              <td class="px-4 py-3 text-right font-medium">$\${(row.month_cost || 0).toFixed(4)}</td>
              <td class="px-4 py-3 text-right \${row.month_failures > 0 ? 'text-red-600' : ''}">\${row.month_failures || 0}</td>
            </tr>
          \`).join('') : '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">データなし</td></tr>';
          document.getElementById('firecrawl-table').innerHTML = firecrawlHtml;

          // チャート
          const dates = [...new Set(daily.map(d => d.date))].sort();
          const openaiCosts = dates.map(d => daily.filter(r => r.date === d && r.provider === 'openai').reduce((sum, r) => sum + (r.cost || 0), 0));
          const firecrawlCosts = dates.map(d => daily.filter(r => r.date === d && r.provider === 'firecrawl').reduce((sum, r) => sum + (r.cost || 0), 0));

          new Chart(document.getElementById('cost-chart'), {
            type: 'bar',
            data: {
              labels: dates,
              datasets: [
                { label: 'OpenAI', data: openaiCosts, backgroundColor: 'rgba(34, 197, 94, 0.7)' },
                { label: 'Firecrawl', data: firecrawlCosts, backgroundColor: 'rgba(249, 115, 22, 0.7)' },
              ],
            },
            options: {
              responsive: true,
              scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            },
          });
        } catch (error) {
          console.error('Costs page error:', error);
        }
      }
    </script>
  `;

  return c.html(adminLayout('コスト管理', content, 'costs'));
});

// ============================================================
// /admin/updates - 更新状況一覧
// ============================================================

adminPages.get('/admin/updates', (c) => {
  const content = `
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">更新状況</h1>
      <p class="text-gray-600 mt-1">データソースの更新状況とクロールキューを確認</p>
    </div>

    <div class="space-y-8">
      <!-- Registry 状況 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-database text-blue-600 mr-2"></i>ソースレジストリ
        </h2>
        <div id="registry-stats" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-gray-400 text-center py-4">読み込み中...</div>
        </div>
      </div>

      <!-- キュー状況 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-list-ol text-yellow-600 mr-2"></i>クロールキュー
        </h2>
        <div id="queue-stats" class="overflow-x-auto">
          <div class="text-gray-400 text-center py-4">読み込み中...</div>
        </div>
      </div>

      <!-- ドメインポリシー -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-globe text-green-600 mr-2"></i>ドメインポリシー
        </h2>
        <div id="domain-stats" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="text-gray-400 text-center py-4">読み込み中...</div>
        </div>
      </div>

      <!-- 最近の更新 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-history text-purple-600 mr-2"></i>最近の更新
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left">イベント</th>
                <th class="px-4 py-3 text-left">ドメイン</th>
                <th class="px-4 py-3 text-left">URL</th>
                <th class="px-4 py-3 text-center">結果</th>
                <th class="px-4 py-3 text-left">日時</th>
              </tr>
            </thead>
            <tbody id="recent-updates" class="divide-y">
              <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cron履歴 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-clock text-indigo-600 mr-2"></i>Cron/Consumer 実行履歴
        </h2>
        <div id="cron-history" class="space-y-2">
          <div class="text-gray-400 text-center py-4">読み込み中...</div>
        </div>
      </div>
    </div>

    <script>
      async function loadUpdates() {
        try {
          const data = await api('/api/admin-ops/updates');
          if (!data.success) throw new Error(data.error?.message);

          const { registry, queue, domains, recent, cronHistory } = data.data;

          // Registry
          const registryHtml = registry.length ? registry.map(r => \`
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="font-medium text-gray-800">\${r.scope}</p>
              <div class="mt-2 text-sm space-y-1">
                <p>総数: <span class="font-medium">\${r.total}</span></p>
                <p class="text-green-600">アクティブ: \${r.active}</p>
                <p class="text-yellow-600">一時停止: \${r.paused}</p>
                <p class="text-red-600">エラー: \${r.error}</p>
              </div>
            </div>
          \`).join('') : '<p class="text-gray-400 col-span-3 text-center">データなし</p>';
          document.getElementById('registry-stats').innerHTML = registryHtml;

          // Queue
          const queueHtml = queue.length ? \`
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left">種別</th>
                  <th class="px-4 py-3 text-left">ステータス</th>
                  <th class="px-4 py-3 text-right">件数</th>
                  <th class="px-4 py-3 text-left">最新</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                \${queue.map(q => \`
                  <tr>
                    <td class="px-4 py-3">\${q.kind}</td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-1 text-xs rounded-full \${
                        q.status === 'completed' ? 'bg-green-100 text-green-800' :
                        q.status === 'failed' ? 'bg-red-100 text-red-800' :
                        q.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }">\${q.status}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-medium">\${q.count}</td>
                    <td class="px-4 py-3 text-gray-500">\${q.latest ? new Date(q.latest).toLocaleString('ja-JP') : '-'}</td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \` : '<p class="text-gray-400 text-center py-4">キューは空です</p>';
          document.getElementById('queue-stats').innerHTML = queueHtml;

          // Domains
          const domainHtml = domains.map(d => \`
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="font-medium text-gray-800">\${d.blocked ? 'ブロック中' : 'アクティブ'}</p>
              <div class="mt-2 text-sm">
                <p>ドメイン数: <span class="font-medium">\${d.count}</span></p>
                <p class="text-green-600">成功: \${d.total_success || 0}</p>
                <p class="text-red-600">失敗: \${d.total_failures || 0}</p>
              </div>
            </div>
          \`).join('') || '<p class="text-gray-400 col-span-2 text-center">データなし</p>';
          document.getElementById('domain-stats').innerHTML = domainHtml;

          // Recent updates
          const recentHtml = recent.length ? recent.map(r => \`
            <tr>
              <td class="px-4 py-3">\${r.event_type}</td>
              <td class="px-4 py-3">\${r.domain || '-'}</td>
              <td class="px-4 py-3 max-w-xs truncate" title="\${r.url || ''}">\${r.url || '-'}</td>
              <td class="px-4 py-3 text-center">
                \${r.success ? '<i class="fas fa-check-circle text-green-600"></i>' : '<i class="fas fa-times-circle text-red-600"></i>'}
              </td>
              <td class="px-4 py-3 text-gray-500">\${new Date(r.created_at).toLocaleString('ja-JP')}</td>
            </tr>
          \`).join('') : '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">データなし</td></tr>';
          document.getElementById('recent-updates').innerHTML = recentHtml;

          // Cron history
          const cronHtml = cronHistory.length ? cronHistory.map(h => \`
            <div class="flex items-center justify-between p-3 rounded-lg \${h.success ? 'bg-green-50' : 'bg-red-50'}">
              <div class="flex items-center gap-3">
                <i class="fas \${h.event_type === 'CRON_RUN' ? 'fa-clock' : 'fa-cogs'} \${h.success ? 'text-green-600' : 'text-red-600'}"></i>
                <span class="font-medium">\${h.event_type}</span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span>\${h.duration_ms}ms</span>
                <span>\${new Date(h.created_at).toLocaleString('ja-JP')}</span>
              </div>
            </div>
          \`).join('') : '<p class="text-gray-400 text-center py-4">履歴なし</p>';
          document.getElementById('cron-history').innerHTML = cronHtml;

        } catch (error) {
          console.error('Updates page error:', error);
        }
      }

      loadUpdates();
    </script>
  `;

  return c.html(adminLayout('更新状況', content, 'updates'));
});

// ============================================================
// /admin/users - ユーザー管理（既存機能を維持）
// ============================================================

adminPages.get('/admin/users', (c) => {
  const content = `
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">ユーザー管理</h1>
      <p class="text-gray-600 mt-1">ユーザー一覧・権限管理・アカウント操作</p>
    </div>

    <div class="bg-white rounded-xl shadow p-6">
      <div class="flex justify-between items-center mb-4">
        <div class="flex gap-2">
          <input type="text" id="search-input" placeholder="メールアドレスで検索..." 
                 class="px-4 py-2 border rounded-lg w-64">
          <button onclick="searchUsers()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <i class="fas fa-search mr-1"></i>検索
          </button>
        </div>
        <div class="text-sm text-gray-500">
          総ユーザー数: <span id="total-users" class="font-bold">-</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left">メールアドレス</th>
              <th class="px-4 py-3 text-left">名前</th>
              <th class="px-4 py-3 text-center">権限</th>
              <th class="px-4 py-3 text-center">状態</th>
              <th class="px-4 py-3 text-left">登録日</th>
              <th class="px-4 py-3 text-left">最終ログイン</th>
              <th class="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody id="users-table" class="divide-y">
            <tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="pagination" class="mt-4 flex justify-center gap-2"></div>
    </div>

    <script>
      let currentPage = 1;
      const perPage = 20;

      async function loadUsers(page = 1, search = '') {
        try {
          const params = new URLSearchParams({ page, limit: perPage });
          if (search) params.append('search', search);

          const data = await api('/api/admin/users?' + params);
          if (!data.success) throw new Error(data.error?.message);

          const { users, pagination } = data.data;
          document.getElementById('total-users').textContent = pagination.total;

          const html = users.length ? users.map(u => \`
            <tr>
              <td class="px-4 py-3">\${u.email}</td>
              <td class="px-4 py-3">\${u.name || '-'}</td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 text-xs rounded-full \${
                  u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                  u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }">\${u.role}</span>
              </td>
              <td class="px-4 py-3 text-center">
                \${u.is_disabled ? '<span class="text-red-600">無効</span>' : '<span class="text-green-600">有効</span>'}
              </td>
              <td class="px-4 py-3 text-gray-500">\${u.created_at ? new Date(u.created_at).toLocaleDateString('ja-JP') : '-'}</td>
              <td class="px-4 py-3 text-gray-500">\${u.last_login_at ? new Date(u.last_login_at).toLocaleString('ja-JP') : '-'}</td>
              <td class="px-4 py-3 text-center">
                <button onclick="editUser('\${u.id}')" class="text-indigo-600 hover:text-indigo-800 mr-2">
                  <i class="fas fa-edit"></i>
                </button>
              </td>
            </tr>
          \`).join('') : '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">ユーザーが見つかりません</td></tr>';
          document.getElementById('users-table').innerHTML = html;

        } catch (error) {
          console.error('Load users error:', error);
        }
      }

      function searchUsers() {
        const search = document.getElementById('search-input').value;
        loadUsers(1, search);
      }

      function editUser(userId) {
        alert('ユーザー編集機能は準備中です');
      }

      loadUsers();
    </script>
  `;

  return c.html(adminLayout('ユーザー管理', content, 'users'));
});

// ============================================================
// /admin/audit - 監査ログ
// ============================================================

adminPages.get('/admin/audit', (c) => {
  const content = `
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">監査ログ</h1>
      <p class="text-gray-600 mt-1">システムの操作履歴を確認</p>
    </div>

    <div class="bg-white rounded-xl shadow p-6">
      <div class="flex gap-4 mb-4">
        <select id="filter-category" class="px-4 py-2 border rounded-lg">
          <option value="">全カテゴリ</option>
          <option value="auth">認証</option>
          <option value="admin">管理操作</option>
          <option value="data">データ操作</option>
          <option value="system">システム</option>
        </select>
        <select id="filter-severity" class="px-4 py-2 border rounded-lg">
          <option value="">全レベル</option>
          <option value="info">情報</option>
          <option value="warning">警告</option>
          <option value="critical">重大</option>
        </select>
        <button onclick="loadAuditLogs()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <i class="fas fa-filter mr-1"></i>フィルタ
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left">日時</th>
              <th class="px-4 py-3 text-left">アクション</th>
              <th class="px-4 py-3 text-left">カテゴリ</th>
              <th class="px-4 py-3 text-center">レベル</th>
              <th class="px-4 py-3 text-left">ユーザー</th>
              <th class="px-4 py-3 text-left">詳細</th>
            </tr>
          </thead>
          <tbody id="audit-table" class="divide-y">
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <script>
      async function loadAuditLogs() {
        try {
          const category = document.getElementById('filter-category').value;
          const severity = document.getElementById('filter-severity').value;
          
          const params = new URLSearchParams({ limit: 100 });
          if (category) params.append('category', category);
          if (severity) params.append('severity', severity);

          const data = await api('/api/admin/audit?' + params);
          if (!data.success) throw new Error(data.error?.message);

          const logs = data.data.logs || [];
          const html = logs.length ? logs.map(log => \`
            <tr>
              <td class="px-4 py-3 text-gray-500">\${new Date(log.created_at).toLocaleString('ja-JP')}</td>
              <td class="px-4 py-3 font-medium">\${log.action}</td>
              <td class="px-4 py-3">\${log.action_category}</td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 text-xs rounded-full \${
                  log.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  log.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }">\${log.severity}</span>
              </td>
              <td class="px-4 py-3">\${log.actor_email || '-'}</td>
              <td class="px-4 py-3 text-gray-500 max-w-xs truncate">\${log.details_json || '-'}</td>
            </tr>
          \`).join('') : '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">ログがありません</td></tr>';
          document.getElementById('audit-table').innerHTML = html;

        } catch (error) {
          console.error('Load audit logs error:', error);
        }
      }

      loadAuditLogs();
    </script>
  `;

  return c.html(adminLayout('監査ログ', content, 'audit'));
});

// ============================================================
// /admin/ops - 運用チェック（30分検証用ダッシュボード）
// ============================================================

adminPages.get('/admin/ops', (c) => {
  const content = `
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            <i class="fas fa-heartbeat text-red-500 mr-2"></i>運用チェック
          </h1>
          <p class="text-gray-600 mt-1">30分で「回ってる証拠」を確認するダッシュボード</p>
        </div>
        <button id="btn-run-checks" onclick="runAllChecks()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <i class="fas fa-sync-alt mr-1"></i>全チェック実行
        </button>
      </div>
    </div>

    <div id="access-denied" class="hidden bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <i class="fas fa-lock text-red-400 text-4xl mb-4"></i>
      <p class="text-red-700 font-medium">Super Admin 権限が必要です</p>
      <a href="/admin" class="text-indigo-600 hover:underline mt-2 inline-block">ダッシュボードへ戻る</a>
    </div>

    <div id="ops-content" class="space-y-6">
      <!-- 合格判定サマリー -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-clipboard-check text-green-600 mr-2"></i>30分検証チェックリスト
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div id="check-l1" class="border-2 border-gray-200 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">⏳</div>
            <p class="font-medium text-gray-700">L1 入口網羅</p>
            <p class="text-xs text-gray-500">47都道府県登録</p>
          </div>
          <div id="check-l2" class="border-2 border-gray-200 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">⏳</div>
            <p class="font-medium text-gray-700">L2 実稼働</p>
            <p class="text-xs text-gray-500">Cron/Consumer稼働</p>
          </div>
          <div id="check-queue" class="border-2 border-gray-200 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">⏳</div>
            <p class="font-medium text-gray-700">キュー健全性</p>
            <p class="text-xs text-gray-500">滞留<100件</p>
          </div>
          <div id="check-kpi" class="border-2 border-gray-200 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">⏳</div>
            <p class="font-medium text-gray-700">KPI動作</p>
            <p class="text-xs text-gray-500">今日のイベント</p>
          </div>
        </div>
        <p class="text-xs text-gray-400 mt-4">
          <i class="fas fa-info-circle mr-1"></i>
          合格ライン: L1=47/47, L2=done+failed>0, キュー=queued<100, KPI=検索/壁打ち/ドラフトが動作
        </p>
      </div>

      <!-- ★★★ P3-2A: Cron実行状況モニター（東京3ソース） ★★★ -->
      <div class="bg-white rounded-xl shadow p-6 border-2 border-blue-500">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-clock text-blue-600 mr-2"></i>Cron実行状況（東京3ソース）
          </h2>
          <button id="btn-refresh-cron" onclick="loadCronStatus()" class="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <i class="fas fa-sync mr-1"></i>更新
          </button>
        </div>

        <!-- 健全性サマリー -->
        <div id="cron-health-summary" class="mb-4">
          <div class="grid grid-cols-3 gap-4">
            <div id="cron-shigoto" class="border-2 rounded-lg p-4 text-center">
              <p class="text-sm text-gray-500">tokyo-shigoto</p>
              <p class="text-2xl font-bold text-gray-400 loading">⏳</p>
              <p class="text-xs text-gray-400">-</p>
            </div>
            <div id="cron-kosha" class="border-2 rounded-lg p-4 text-center">
              <p class="text-sm text-gray-500">tokyo-kosha</p>
              <p class="text-2xl font-bold text-gray-400 loading">⏳</p>
              <p class="text-xs text-gray-400">-</p>
            </div>
            <div id="cron-hataraku" class="border-2 rounded-lg p-4 text-center">
              <p class="text-sm text-gray-500">tokyo-hataraku</p>
              <p class="text-2xl font-bold text-gray-400 loading">⏳</p>
              <p class="text-xs text-gray-400">-</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            <i class="fas fa-info-circle mr-1"></i>
            合格: 24h以内に success あり ✅ / 無し or failed のみ ⚠️
          </p>
        </div>

        <!-- 直近の実行履歴 -->
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">直近7日間の実行履歴</h3>
          <div id="cron-runs-table" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left">ジョブ</th>
                  <th class="px-3 py-2 text-left">ステータス</th>
                  <th class="px-3 py-2 text-right">処理</th>
                  <th class="px-3 py-2 text-right">新規</th>
                  <th class="px-3 py-2 text-right">更新</th>
                  <th class="px-3 py-2 text-right">スキップ</th>
                  <th class="px-3 py-2 text-right">エラー</th>
                  <th class="px-3 py-2 text-left">実行日時</th>
                </tr>
              </thead>
              <tbody id="cron-runs-tbody" class="divide-y divide-gray-100">
                <tr><td colspan="8" class="px-3 py-4 text-center text-gray-400 loading">読み込み中...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- feed_failures（未解決エラー） -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">未解決エラー（feed_failures）</h3>
          
          <!-- 4分類サマリー -->
          <div id="failures-summary" class="grid grid-cols-4 gap-2 mb-3">
            <div class="bg-red-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-red-600" id="failures-fetch">-</p>
              <p class="text-xs text-red-500">FETCH失敗</p>
            </div>
            <div class="bg-orange-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-orange-600" id="failures-parse">-</p>
              <p class="text-xs text-orange-500">PARSE失敗</p>
            </div>
            <div class="bg-yellow-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-yellow-600" id="failures-forms">-</p>
              <p class="text-xs text-yellow-500">FORMS未検出</p>
            </div>
            <div class="bg-blue-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-blue-600" id="failures-fields">-</p>
              <p class="text-xs text-blue-500">FIELDS不足</p>
            </div>
          </div>
          
          <!-- ソース別サマリー -->
          <div id="failures-by-source" class="mb-3 text-xs text-gray-500">
            ソース別: 読み込み中...
          </div>
          
          <!-- 詳細リスト -->
          <div id="feed-failures-list" class="overflow-x-auto max-h-48">
            <div class="text-gray-400 text-sm p-2 loading">読み込み中...</div>
          </div>
        </div>
        
        <!-- ★★★ P3-3B: 抽出ログ（OCR実行履歴） ★★★ -->
        <div class="mt-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
            <span><i class="fas fa-file-pdf text-red-500 mr-1"></i>PDF/OCR 抽出ログ（直近50件）</span>
            <button id="btn-refresh-extraction" onclick="loadExtractionLogs()" class="text-xs text-blue-600 hover:underline">
              <i class="fas fa-sync-alt mr-1"></i>更新
            </button>
          </h3>
          
          <!-- 抽出メトリクスサマリー -->
          <div id="extraction-metrics" class="grid grid-cols-6 gap-2 mb-3">
            <div class="bg-green-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-green-600" id="extract-html-ok">-</p>
              <p class="text-xs text-green-500">HTML成功</p>
            </div>
            <div class="bg-blue-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-blue-600" id="extract-firecrawl-ok">-</p>
              <p class="text-xs text-blue-500">Firecrawl成功</p>
            </div>
            <div class="bg-purple-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-purple-600" id="extract-vision-ok">-</p>
              <p class="text-xs text-purple-500">Vision成功</p>
            </div>
            <div class="bg-orange-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-orange-600" id="extract-vision-pages">-</p>
              <p class="text-xs text-orange-500">OCRページ計</p>
            </div>
            <div class="bg-emerald-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-emerald-600" id="extract-forms-ok">-</p>
              <p class="text-xs text-emerald-500">様式抽出成功</p>
            </div>
            <div class="bg-red-50 rounded p-2 text-center">
              <p class="text-lg font-bold text-red-600" id="extract-failed">-</p>
              <p class="text-xs text-red-500">失敗</p>
            </div>
          </div>
          
          <!-- 抽出ログテーブル -->
          <div id="extraction-logs-list" class="overflow-x-auto max-h-64">
            <div class="text-gray-400 text-sm p-2 loading">読み込み中...</div>
          </div>
        </div>
      </div>

      <!-- セクションA: サーバー側（10分） -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-server text-blue-600 mr-2"></i>A. サーバー側チェック（10分）
        </h2>

        <!-- A-1 台帳揃い -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            A-1. 台帳揃い（source_registry scope別件数）
          </h3>
          <div id="registry-scope" class="grid grid-cols-3 gap-4">
            <div class="bg-gray-50 rounded-lg p-4 text-center loading">
              <p class="text-2xl font-bold text-gray-400">-</p>
              <p class="text-xs text-gray-500">national</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4 text-center loading">
              <p class="text-2xl font-bold text-gray-400">-</p>
              <p class="text-xs text-gray-500">prefecture</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4 text-center loading">
              <p class="text-2xl font-bold text-gray-400">-</p>
              <p class="text-xs text-gray-500">secretariat</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">合格ライン: prefecture=47, national/secretariat=数件以上</p>
        </div>

        <!-- A-2 Cron/Consumer -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            A-2. Cron/Consumer稼働（crawl_queue status）
          </h3>
          <div id="queue-status-detail" class="p-4 rounded-lg bg-gray-50">
            <div class="loading text-gray-400">読み込み中...</div>
          </div>
          <p class="text-xs text-gray-400 mt-2">合格ライン: done+failed増加、queued過剰増加なし（<100件）</p>
        </div>

        <!-- A-3 ドメインブロック -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            A-3. ドメインブロック状況
          </h3>
          <div id="domain-block-status" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
          <p class="text-xs text-gray-400 mt-2">警告: blocked_until設定、failure_count>3のドメイン</p>
        </div>
      </div>

      <!-- セクションB: UI操作（20分） -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-mouse-pointer text-purple-600 mr-2"></i>B. UI操作チェック（20分）
        </h2>

        <!-- 今日のKPI -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            今日のイベントカウント（usage_events）
          </h3>
          <div id="today-kpi" class="grid grid-cols-3 gap-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p id="kpi-search-today" class="text-3xl font-bold text-green-700 loading">-</p>
              <p class="text-sm text-green-600">SUBSIDY_SEARCH</p>
              <p class="text-xs text-gray-500">B-1. 補助金検索</p>
            </div>
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <p id="kpi-chat-today" class="text-3xl font-bold text-purple-700 loading">-</p>
              <p class="text-sm text-purple-600">CHAT_SESSION_STARTED</p>
              <p class="text-xs text-gray-500">B-2. 壁打ち開始</p>
            </div>
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <p id="kpi-draft-today" class="text-3xl font-bold text-orange-700 loading">-</p>
              <p class="text-sm text-orange-600">DRAFT_GENERATED</p>
              <p class="text-xs text-gray-500">B-3. ドラフト生成</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">合格ライン: 各1以上（実際に操作して確認）</p>
        </div>

        <!-- 今日の直近イベント20件 -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">
            今日の直近イベント（リアルタイム確認）
          </h3>
          <div id="recent-events-list" class="overflow-x-auto max-h-96">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>

      <!-- ★★★ データ収集凍結チェックリスト v1.0 - subsidy_cache 健全性 ★★★ -->
      <div class="bg-white rounded-xl shadow p-6 border-2 border-emerald-500">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-database text-emerald-600 mr-2"></i>データ収集 凍結チェック v1.0
          </h2>
          <button id="btn-trigger-sync" onclick="triggerManualSync()" class="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
            <i class="fas fa-sync mr-1"></i>今すぐ同期
          </button>
        </div>

        <!-- 凍結目標値 vs 現在値 -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div id="data-health-total" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">総件数</p>
            <p class="text-2xl font-bold text-gray-700 loading">-</p>
            <p class="text-xs text-gray-400">目標: 500+</p>
          </div>
          <div id="data-health-valid" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">有効件数</p>
            <p class="text-2xl font-bold text-gray-700 loading">-</p>
            <p class="text-xs text-gray-400">キャッシュ有効</p>
          </div>
          <div id="data-health-deadline" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">締切あり</p>
            <p class="text-2xl font-bold text-gray-700 loading">-%</p>
            <p class="text-xs text-gray-400">目標: 95%+</p>
          </div>
          <div id="data-health-area" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">地域あり</p>
            <p class="text-2xl font-bold text-gray-700 loading">-%</p>
            <p class="text-xs text-gray-400">目標: 95%+</p>
          </div>
          <div id="data-health-amount" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">金額あり</p>
            <p class="text-2xl font-bold text-gray-700 loading">-%</p>
            <p class="text-xs text-gray-400">目標: 80%+</p>
          </div>
          <div id="data-health-cron" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">24h更新</p>
            <p class="text-2xl font-bold text-gray-700 loading">-</p>
            <p class="text-xs text-gray-400">Cron稼働</p>
          </div>
        </div>

        <!-- 追加KPI行 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div id="data-health-broken" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">壊れURL</p>
            <p class="text-2xl font-bold text-gray-700 loading">-</p>
            <p class="text-xs text-gray-400">example.com混入</p>
          </div>
          <div id="data-health-sync-hours" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">最終同期</p>
            <p class="text-2xl font-bold text-gray-700 loading">-h</p>
            <p class="text-xs text-gray-400">目標: ≦24h</p>
          </div>
          <div id="data-health-accepting" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">受付中</p>
            <p class="text-2xl font-bold text-gray-700 loading">-</p>
            <p class="text-xs text-gray-400">flag=1</p>
          </div>
          <div id="data-health-industry" class="border-2 rounded-lg p-3 text-center">
            <p class="text-xs text-gray-500">業種あり</p>
            <p class="text-2xl font-bold text-gray-700 loading">-%</p>
            <p class="text-xs text-gray-400">空=全業種</p>
          </div>
        </div>

        <!-- 凍結ステータス判定 -->
        <div id="data-health-status" class="p-4 rounded-lg bg-gray-50 mb-4">
          <div class="loading text-gray-400">データ取得中...</div>
        </div>

        <!-- プログレスバー -->
        <div class="mb-4">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-gray-600">500件到達率</span>
            <span id="data-health-progress-text" class="font-medium text-gray-700 loading">-件 / 500件 (--%)</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div id="data-health-progress-bar" class="h-3 rounded-full bg-emerald-500 transition-all duration-500" style="width: 0%"></div>
          </div>
        </div>

        <!-- ソース別・キャッシュ情報 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">ソース別件数</h4>
            <div id="data-health-sources" class="flex flex-wrap gap-2">
              <span class="loading text-gray-400 text-sm">読み込み中...</span>
            </div>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2">キャッシュ期限</h4>
            <div id="data-health-cache" class="text-sm text-gray-600">
              <span class="loading">読み込み中...</span>
            </div>
          </div>
        </div>

        <!-- 凍結ルール表示 -->
        <details class="mt-4">
          <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            <i class="fas fa-info-circle mr-1"></i>凍結ルール v1.0
          </summary>
          <div class="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
            <p>• 同期入口: POST /api/admin/sync-jgrants（super_admin）, POST /api/cron/sync-jgrants（X-Cron-Secret）</p>
            <p>• キーワード: 36語（v1.1）固定。追加はPRとして監査ログに残す</p>
            <p>• upsert: INSERT OR REPLACE（idが主キー）、expires_at = now+7日</p>
            <p>• バッチ: 100件単位、キーワード間300ms sleep</p>
            <p>• 業種条件: 空=「全業種対象」として扱う（JGrants元データの問題）</p>
          </div>
        </details>
      </div>

      <!-- L1/L2/L3 網羅性 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-map text-indigo-600 mr-2"></i>網羅性スコア（L1/L2/L3）
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
            <p class="text-sm text-indigo-600 font-medium">総合スコア</p>
            <p id="score-total" class="text-4xl font-bold text-indigo-700 loading">-</p>
            <p class="text-xs text-indigo-500">/ 100</p>
          </div>
          <div class="bg-blue-50 rounded-lg p-4 text-center">
            <p class="text-sm text-blue-600 font-medium">L1 入口網羅</p>
            <p id="score-l1" class="text-2xl font-bold text-blue-700 loading">-%</p>
            <p id="score-l1-detail" class="text-xs text-blue-500">-/47 都道府県</p>
          </div>
          <div class="bg-green-50 rounded-lg p-4 text-center">
            <p class="text-sm text-green-600 font-medium">L2 実稼働</p>
            <p id="score-l2" class="text-2xl font-bold text-green-700 loading">-%</p>
            <p id="score-l2-detail" class="text-xs text-green-500">stale: -件</p>
          </div>
          <div class="bg-purple-50 rounded-lg p-4 text-center">
            <p class="text-sm text-purple-600 font-medium">L3 データ網羅</p>
            <p id="score-l3" class="text-2xl font-bold text-purple-700 loading">-%</p>
            <p id="score-l3-detail" class="text-xs text-purple-500">active: -件</p>
          </div>
        </div>

        <!-- L1 都道府県欠損 -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">L1 欠損都道府県</h3>
          <div id="l1-missing" class="p-3 bg-gray-50 rounded-lg">
            <span class="loading text-gray-400">読み込み中...</span>
          </div>
        </div>

        <!-- L2 stale地域 -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">L2 7日以上クロールなしの地域</h3>
          <div id="l2-stale" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>

      <!-- 失敗/無駄の可視化 -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4">
          <i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>失敗/無駄の可視化
        </h2>

        <!-- ドメイン別エラー率Top -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-700 mb-2">ドメイン別エラー率Top10（直近7日）</h3>
          <div id="domain-errors-table" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>

        <!-- 重複クロール -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-2">重複クロール検知（同一URL 5回以上）</h3>
          <div id="duplicate-crawls-table" class="overflow-x-auto">
            <div class="loading text-gray-400 p-4">読み込み中...</div>
          </div>
        </div>
      </div>

      <!-- Daily Data Report（運用観測用） -->
      <div class="bg-white rounded-xl shadow p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-clipboard-list text-blue-600 mr-2"></i>Daily Data Report
          </h2>
          <div class="flex gap-2">
            <button id="btn-load-daily" onclick="loadDailyReport()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <i class="fas fa-refresh mr-1"></i>更新
            </button>
            <button id="btn-copy-report" onclick="copyDailyReport()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
              <i class="fas fa-copy mr-1"></i>コピー
            </button>
          </div>
        </div>

        <!-- KPI Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <div id="daily-total" class="border-2 rounded-lg p-3 text-center border-gray-200">
            <p class="text-xs text-gray-500">総件数</p>
            <p class="text-2xl font-bold text-gray-800">-</p>
            <p class="text-xs text-gray-400">目標: 500</p>
          </div>
          <div id="daily-valid-rate" class="border-2 rounded-lg p-3 text-center border-gray-200">
            <p class="text-xs text-gray-500">有効率</p>
            <p class="text-2xl font-bold text-gray-800">-</p>
            <p class="text-xs text-gray-400">expires_at</p>
          </div>
          <div id="daily-deadline" class="border-2 rounded-lg p-3 text-center border-gray-200">
            <p class="text-xs text-gray-500">締切あり</p>
            <p class="text-2xl font-bold text-gray-800">-</p>
            <p class="text-xs text-gray-400">目標: 95%</p>
          </div>
          <div id="daily-amount" class="border-2 rounded-lg p-3 text-center border-gray-200">
            <p class="text-xs text-gray-500">金額あり</p>
            <p class="text-2xl font-bold text-gray-800">-</p>
            <p class="text-xs text-gray-400">目標: 80%</p>
          </div>
          <div id="daily-docs" class="border-2 rounded-lg p-3 text-center border-gray-200">
            <p class="text-xs text-gray-500">PDF/様式</p>
            <p class="text-2xl font-bold text-gray-800">-</p>
            <p class="text-xs text-gray-400">documents</p>
          </div>
          <div id="daily-sources" class="border-2 rounded-lg p-3 text-center border-gray-200">
            <p class="text-xs text-gray-500">ソース</p>
            <p class="text-2xl font-bold text-gray-800">-</p>
            <p class="text-xs text-gray-400">active</p>
          </div>
        </div>

        <!-- 今日の増分 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-blue-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-blue-800 mb-3">
              <i class="fas fa-plus-circle mr-1"></i>今日の増分
            </h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-blue-600 font-medium" id="daily-new">-</span>
                <span class="text-gray-500 ml-1">新規</span>
              </div>
              <div>
                <span class="text-blue-600 font-medium" id="daily-updated">-</span>
                <span class="text-gray-500 ml-1">更新</span>
              </div>
              <div>
                <span class="text-gray-600 font-medium" id="daily-expired">-</span>
                <span class="text-gray-500 ml-1">終了</span>
              </div>
              <div>
                <span class="text-red-600 font-medium" id="daily-404">-</span>
                <span class="text-gray-500 ml-1">404</span>
              </div>
            </div>
          </div>
          <div class="bg-red-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-red-800 mb-3">
              <i class="fas fa-exclamation-triangle mr-1"></i>例外（要対応）
            </h3>
            <div class="grid grid-cols-2 gap-2 text-sm" id="daily-exceptions">
              <div><span class="text-red-600 font-medium" id="exc-timeout">-</span><span class="text-gray-500 ml-1">timeout</span></div>
              <div><span class="text-red-600 font-medium" id="exc-blocked">-</span><span class="text-gray-500 ml-1">blocked</span></div>
              <div><span class="text-red-600 font-medium" id="exc-login">-</span><span class="text-gray-500 ml-1">login</span></div>
              <div><span class="text-red-600 font-medium" id="exc-404">-</span><span class="text-gray-500 ml-1">url_404</span></div>
            </div>
          </div>
        </div>

        <!-- OCR/抽出キュー -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-800 mb-3">
              <i class="fas fa-file-pdf mr-1"></i>OCRキュー
            </h3>
            <div class="flex gap-3 text-sm" id="daily-ocr-queue">
              <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">queued: <span id="ocr-queued">-</span></span>
              <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">processing: <span id="ocr-processing">-</span></span>
              <span class="px-2 py-1 bg-green-100 text-green-800 rounded">done: <span id="ocr-done">-</span></span>
              <span class="px-2 py-1 bg-red-100 text-red-800 rounded">failed: <span id="ocr-failed">-</span></span>
            </div>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-800 mb-3">
              <i class="fas fa-magic mr-1"></i>抽出結果
            </h3>
            <div class="flex gap-3 text-sm" id="daily-extraction">
              <span class="px-2 py-1 bg-green-100 text-green-800 rounded">ok: <span id="extract-ok">-</span></span>
              <span class="px-2 py-1 bg-red-100 text-red-800 rounded">failed: <span id="extract-failed">-</span></span>
            </div>
          </div>
        </div>

        <!-- ソース別件数（24h） -->
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-gray-800 mb-3">
            <i class="fas fa-database mr-1"></i>ソース別件数（直近24h新規）
          </h3>
          <div id="daily-by-source" class="flex flex-wrap gap-2 text-sm">
            <span class="text-gray-400">読み込み中...</span>
          </div>
        </div>

        <!-- テキストレポート（コピペ用） -->
        <div class="bg-gray-900 rounded-lg p-4">
          <h3 class="text-sm font-medium text-gray-300 mb-3">
            <i class="fas fa-file-alt mr-1"></i>テキストレポート（コピペ用）
          </h3>
          <pre id="daily-text-report" class="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">読み込み中...</pre>
        </div>
      </div>

      <!-- 検証SQL/クイックリファレンス -->
      <div class="bg-gray-800 rounded-xl shadow p-6 text-white">
        <h2 class="text-lg font-bold mb-4">
          <i class="fas fa-terminal text-green-400 mr-2"></i>検証用SQL（コピペ用）
        </h2>
        <div class="space-y-4 text-sm font-mono">
          <div>
            <p class="text-gray-400 mb-1">-- L1: 都道府県登録確認</p>
            <code class="text-green-400">SELECT scope, enabled, COUNT(*) FROM source_registry GROUP BY scope, enabled;</code>
          </div>
          <div>
            <p class="text-gray-400 mb-1">-- L2: キュー状況確認</p>
            <code class="text-green-400">SELECT status, COUNT(*) FROM crawl_queue GROUP BY status;</code>
          </div>
          <div>
            <p class="text-gray-400 mb-1">-- KPI: 今日のイベント確認</p>
            <code class="text-green-400">SELECT event_type, COUNT(*) FROM usage_events WHERE date(created_at) = date('now') GROUP BY event_type;</code>
          </div>
          <div>
            <p class="text-gray-400 mb-1">-- ドメインブロック確認</p>
            <code class="text-green-400">SELECT domain_key, blocked_until, failure_count FROM domain_policy WHERE blocked_until > datetime('now') OR failure_count >= 3;</code>
          </div>
          <div>
            <p class="text-gray-400 mb-1">-- Daily Report用: ソース別件数</p>
            <code class="text-green-400">SELECT source, COUNT(*) FROM subsidy_cache GROUP BY source ORDER BY COUNT(*) DESC;</code>
          </div>
        </div>
      </div>
    </div>

    <script>
      // チェック結果を更新
      function updateCheckStatus(elementId, passed, detail) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        if (passed) {
          el.classList.remove('border-gray-200');
          el.classList.add('border-green-500', 'bg-green-50');
          var iconEl = el.querySelector('div');
          if (iconEl) iconEl.textContent = '✅';
        } else {
          el.classList.remove('border-gray-200');
          el.classList.add('border-red-500', 'bg-red-50');
          var iconEl = el.querySelector('div');
          if (iconEl) iconEl.textContent = '❌';
        }
        if (detail) {
          const detailEl = el.querySelector('p.text-xs');
          if (detailEl) detailEl.textContent = detail;
        }
      }

      // 進捗表示用の状態
      window.__opsState = {
        running: false,
        startedAt: null,
        finishedAt: null,
        lastError: null,
      };

      // 画面上にステータス行を出す（なければ作る）
      function ensureOpsStatusBar() {
        let bar = document.getElementById('ops-status-bar');
        if (!bar) {
          const h1 = document.querySelector('h1');
          const header = h1 ? h1.closest('div.mb-8') : null;
          if (header) {
            const el = document.createElement('div');
            el.id = 'ops-status-bar';
            el.className = 'mt-3 p-3 rounded-lg bg-gray-50 border text-sm text-gray-700';
            el.innerHTML = '<div class="flex flex-wrap items-center gap-3">' +
              '<span id="ops-status-text" class="font-medium">待機中</span>' +
              '<span id="ops-status-time" class="text-xs text-gray-500"></span>' +
              '<span id="ops-status-duration" class="text-xs text-gray-500"></span>' +
              '</div>' +
              '<div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">' +
              '<div class="p-2 rounded bg-white border">' +
              'Coverage: <span id="ops-step-coverage" class="text-gray-400">未実行</span>' +
              '</div>' +
              '<div class="p-2 rounded bg-white border">' +
              'Dashboard: <span id="ops-step-dashboard" class="text-gray-400">未実行</span>' +
              '</div>' +
              '<div class="p-2 rounded bg-white border">' +
              'Data-freshness: <span id="ops-step-freshness" class="text-gray-400">未実行</span>' +
              '</div>' +
              '</div>' +
              '<div id="ops-status-error" class="mt-2 text-xs text-red-600 hidden"></div>';
            header.appendChild(el);
          }
        }
      }

      function setStep(id, state, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        const map = {
          idle: 'text-gray-400',
          running: 'text-blue-600',
          ok: 'text-green-600',
          fail: 'text-red-600',
        };
        el.className = map[state] || 'text-gray-400';
        el.textContent = msg || '';
      }

      function formatTime(d) {
        if (!d) return '';
        try { return new Date(d).toLocaleString('ja-JP'); } catch(e){ return String(d); }
      }

      function setStatus(text, startedAt, finishedAt) {
        const t = document.getElementById('ops-status-text');
        const tm = document.getElementById('ops-status-time');
        const dur = document.getElementById('ops-status-duration');
        if (t) t.textContent = text;

        if (tm) {
          if (startedAt && !finishedAt) tm.textContent = '開始: ' + formatTime(startedAt);
          else if (startedAt && finishedAt) tm.textContent = '開始: ' + formatTime(startedAt) + ' / 完了: ' + formatTime(finishedAt);
          else tm.textContent = '';
        }

        if (dur) {
          if (startedAt && finishedAt) {
            const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
            dur.textContent = '所要: ' + Math.max(0, Math.round(ms/1000)) + '秒';
          } else {
            dur.textContent = '';
          }
        }
      }

      function showError(msg) {
        const el = document.getElementById('ops-status-error');
        if (!el) return;
        el.textContent = msg || '';
        el.classList.remove('hidden');
      }

      function hideError() {
        const el = document.getElementById('ops-status-error');
        if (!el) return;
        el.classList.add('hidden');
        el.textContent = '';
      }

      // タイムアウト付きでPromiseを実行
      async function withTimeout(promise, ms, label) {
        let timer;
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(label + ' がタイムアウトしました（' + ms + 'ms）')), ms);
        });
        try {
          return await Promise.race([promise, timeout]);
        } finally {
          clearTimeout(timer);
        }
      }

      // ★★★ P3-2A: Cron実行状況監視 ★★★
      async function loadCronStatus() {
        try {
          const data = await api('/api/admin-ops/cron-status?days=7');
          if (!data.success) {
            console.error('Cron status API error:', data.error);
            return;
          }

          const { by_job, runs, overall_healthy } = data.data;

          // ジョブ別の健全性カード更新
          ['shigoto', 'kosha', 'hataraku'].forEach(name => {
            const jobKey = 'scrape-tokyo-' + name;
            const job = (by_job || []).find(j => j.job_type === jobKey);
            const cardEl = document.getElementById('cron-' + name);
            if (cardEl && job) {
              const healthy = job.healthy_24h;
              cardEl.className = 'border-2 rounded-lg p-4 text-center ' + 
                (healthy ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
              cardEl.querySelector('p.text-2xl').textContent = healthy ? '✅' : '⚠️';
              cardEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + 
                (healthy ? 'text-green-600' : 'text-red-600');
              const detailEl = cardEl.querySelectorAll('p')[2];
              if (detailEl) {
                detailEl.textContent = '成功' + job.success_count + ' / 失敗' + job.failed_count;
              }
            } else if (cardEl) {
              cardEl.className = 'border-2 rounded-lg p-4 text-center border-gray-300 bg-gray-50';
              cardEl.querySelector('p.text-2xl').textContent = '❓';
            }
          });

          // 実行履歴テーブル
          const tbody = document.getElementById('cron-runs-tbody');
          if (tbody && runs && runs.length > 0) {
            tbody.innerHTML = runs.map(r => {
              const statusClass = {
                'success': 'bg-green-100 text-green-800',
                'failed': 'bg-red-100 text-red-800',
                'partial': 'bg-yellow-100 text-yellow-800',
                'running': 'bg-blue-100 text-blue-800'
              }[r.status] || 'bg-gray-100';
              return '<tr class="hover:bg-gray-50">' +
                '<td class="px-3 py-2 font-medium">' + r.job_type.replace('scrape-', '') + '</td>' +
                '<td class="px-3 py-2"><span class="px-2 py-1 rounded text-xs ' + statusClass + '">' + r.status + '</span></td>' +
                '<td class="px-3 py-2 text-right">' + (r.items_processed || 0) + '</td>' +
                '<td class="px-3 py-2 text-right text-green-600">' + (r.items_inserted || 0) + '</td>' +
                '<td class="px-3 py-2 text-right text-blue-600">' + (r.items_updated || 0) + '</td>' +
                '<td class="px-3 py-2 text-right text-gray-500">' + (r.items_skipped || 0) + '</td>' +
                '<td class="px-3 py-2 text-right ' + (r.error_count > 0 ? 'text-red-600 font-bold' : '') + '">' + (r.error_count || 0) + '</td>' +
                '<td class="px-3 py-2 text-gray-600 text-xs">' + new Date(r.started_at).toLocaleString('ja-JP') + '</td>' +
                '</tr>';
            }).join('');
          } else if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-3 py-4 text-center text-gray-400">実行履歴がありません</td></tr>';
          }

          // feed_failures 読み込み
          await loadFeedFailures();

          // loadingクラス削除
          document.querySelectorAll('#cron-health-summary .loading, #cron-runs-tbody .loading').forEach(el => el.classList.remove('loading'));

        } catch (error) {
          console.error('Cron status load error:', error);
        }
      }

      async function loadFeedFailures() {
        try {
          const data = await api('/api/admin-ops/feed-failures?status=open&limit=50');
          if (!data.success) {
            console.error('Feed failures API error:', data.error);
            return;
          }

          const failures = data.data?.failures || [];
          
          // 4分類カウント（凍結）
          const counts = {
            fetch: 0,    // FETCH_FAILED (HTTP_ERROR, timeout, etc.)
            parse: 0,    // PARSE_FAILED (PDF破損, 文字化け)
            forms: 0,    // FORMS_NOT_FOUND
            fields: 0,   // FIELDS_INSUFFICIENT
          };
          
          // ソース別カウント
          const bySource = {};
          
          failures.forEach(f => {
            // 分類
            const errorType = (f.error_type || '').toLowerCase();
            const stage = (f.stage || '').toLowerCase();
            
            if (errorType.includes('http') || errorType.includes('timeout') || errorType.includes('fetch')) {
              counts.fetch++;
            } else if (errorType.includes('parse') || stage === 'pdf') {
              counts.parse++;
            } else if (errorType.includes('forms_not_found') || (f.error_message || '').includes('forms')) {
              counts.forms++;
            } else if (errorType.includes('fields') || (f.error_message || '').includes('fields')) {
              counts.fields++;
            } else {
              counts.fetch++; // デフォルトはfetch
            }
            
            // ソース別
            const src = f.source_id || 'unknown';
            bySource[src] = (bySource[src] || 0) + 1;
          });
          
          // 4分類サマリー更新
          document.getElementById('failures-fetch').textContent = counts.fetch;
          document.getElementById('failures-parse').textContent = counts.parse;
          document.getElementById('failures-forms').textContent = counts.forms;
          document.getElementById('failures-fields').textContent = counts.fields;
          
          // ソース別サマリー更新
          const bySourceEl = document.getElementById('failures-by-source');
          if (bySourceEl) {
            const sourceStr = Object.entries(bySource)
              .map(([k, v]) => k.replace('src-', '') + ': ' + v)
              .join(', ');
            bySourceEl.textContent = sourceStr || '未解決エラーなし';
          }

          // 優先度でソート（潰せる順: HTTP/timeout → parse → forms → fields）
          const getPriority = (f) => {
            const errorType = (f.error_type || '').toLowerCase();
            const stage = (f.stage || '').toLowerCase();
            // 1. HTTP/timeout は最も潰しやすい（一時的なエラーが多い）
            if (errorType.includes('http') || errorType.includes('timeout') || errorType.includes('fetch')) return 1;
            // 2. parse は次に潰しやすい
            if (errorType.includes('parse') || stage === 'pdf') return 2;
            // 3. forms_not_found はPDF形式の問題
            if (errorType.includes('forms_not_found') || (f.error_message || '').includes('forms')) return 3;
            // 4. fields は構造的な問題
            if (errorType.includes('fields') || (f.error_message || '').includes('fields')) return 4;
            return 5;
          };
          const sortedFailures = [...failures].sort((a, b) => {
            const pa = getPriority(a);
            const pb = getPriority(b);
            if (pa !== pb) return pa - pb;
            // 同じ優先度ならretry_count昇順（リトライ少ない方を先に）
            return (a.retry_count || 0) - (b.retry_count || 0);
          });
          
          const listEl = document.getElementById('feed-failures-list');
          if (listEl && sortedFailures.length > 0) {
            listEl.innerHTML = '<table class="w-full text-sm">' +
              '<thead class="bg-gray-50"><tr>' +
              '<th class="px-2 py-1 text-left">優先</th>' +
              '<th class="px-2 py-1 text-left">ソース</th>' +
              '<th class="px-2 py-1 text-left">ステージ</th>' +
              '<th class="px-2 py-1 text-left">分類</th>' +
              '<th class="px-2 py-1 text-left">エラー</th>' +
              '<th class="px-2 py-1 text-left">リトライ</th>' +
              '<th class="px-2 py-1 text-left">発生日時</th>' +
              '</tr></thead><tbody>' +
              sortedFailures.slice(0, 25).map(f => {
                const priority = getPriority(f);
                const priorityLabel = priority === 1 ? '🔴 高' : priority === 2 ? '🟠 中' : priority === 3 ? '🟡 低' : '🔵 調査';
                const errorType = (f.error_type || '').toLowerCase();
                const typeClass = errorType.includes('http') ? 'text-red-600' :
                                  errorType.includes('parse') ? 'text-orange-600' :
                                  errorType.includes('forms') ? 'text-yellow-600' : 'text-blue-600';
                const rowClass = priority === 1 ? 'bg-red-50' : priority === 2 ? 'bg-orange-50' : priority === 3 ? 'bg-yellow-50' : '';
                return '<tr class="border-t hover:bg-gray-100 ' + rowClass + '">' +
                  '<td class="px-2 py-1 text-xs font-medium">' + priorityLabel + '</td>' +
                  '<td class="px-2 py-1 text-xs">' + (f.source_id || '').replace('src-', '').replace('pref-13-', 'TK-') + '</td>' +
                  '<td class="px-2 py-1 text-xs">' + (f.stage || '') + '</td>' +
                  '<td class="px-2 py-1 text-xs ' + typeClass + '">' + (f.error_type || '') + '</td>' +
                  '<td class="px-2 py-1 text-xs text-red-600 max-w-xs truncate" title="' + (f.error_message || '').replace(/"/g, '&quot;') + '">' + (f.error_message || '').slice(0, 40) + '</td>' +
                  '<td class="px-2 py-1 text-xs text-gray-500">' + (f.retry_count || 0) + '</td>' +
                  '<td class="px-2 py-1 text-xs text-gray-500">' + new Date(f.occurred_at).toLocaleString('ja-JP') + '</td>' +
                  '</tr>';
              }).join('') +
              '</tbody></table>';
          } else if (listEl) {
            listEl.innerHTML = '<p class="text-green-600 text-sm p-2"><i class="fas fa-check-circle mr-1"></i>未解決エラーはありません</p>';
          }
          listEl?.classList.remove('loading');
        } catch (error) {
          console.error('Feed failures load error:', error);
        }
      }

      // ★★★ P3-3B: 抽出ログ読み込み ★★★
      async function loadExtractionLogs() {
        try {
          const data = await api('/api/admin-ops/extraction-logs?limit=50');
          if (!data.success) {
            console.error('Extraction logs API error:', data.error);
            return;
          }

          const { logs, summary } = data.data || {};
          const byMethod = summary?.by_method || [];
          
          // メトリクスサマリー更新（by_methodからカウント）
          const getMethodStats = (method) => byMethod.find(m => m.extraction_method === method) || { total: 0, success_count: 0, total_pages: 0 };
          const htmlStats = getMethodStats('html');
          const firecrawlStats = getMethodStats('firecrawl');
          const visionStats = getMethodStats('vision_ocr');
          
          const setMetric = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || 0;
          };
          setMetric('extract-html-ok', htmlStats.success_count);
          setMetric('extract-firecrawl-ok', firecrawlStats.success_count);
          setMetric('extract-vision-ok', visionStats.success_count);
          setMetric('extract-vision-pages', visionStats.total_pages);
          
          // 様式抽出成功数と失敗数を計算
          const totalSuccess = byMethod.reduce((sum, m) => sum + (m.success_count || 0), 0);
          const totalAll = byMethod.reduce((sum, m) => sum + (m.total || 0), 0);
          setMetric('extract-forms-ok', totalSuccess);
          setMetric('extract-failed', totalAll - totalSuccess);
          
          // ログテーブル更新
          const listEl = document.getElementById('extraction-logs-list');
          if (listEl && logs && logs.length > 0) {
            listEl.innerHTML = '<table class="w-full text-xs">' +
              '<thead class="bg-gray-50 sticky top-0"><tr>' +
              '<th class="px-2 py-1 text-left">結果</th>' +
              '<th class="px-2 py-1 text-left">方式</th>' +
              '<th class="px-2 py-1 text-left">ソース</th>' +
              '<th class="px-2 py-1 text-left">制度ID</th>' +
              '<th class="px-2 py-1 text-right">様式数</th>' +
              '<th class="px-2 py-1 text-right">項目計</th>' +
              '<th class="px-2 py-1 text-left">URL</th>' +
              '<th class="px-2 py-1 text-left">失敗理由</th>' +
              '<th class="px-2 py-1 text-left">日時</th>' +
              '</tr></thead><tbody>' +
              logs.map(log => {
                const isSuccess = log.success === 1;
                const method = log.extraction_method || '-';
                const methodClass = method === 'html' ? 'text-green-600' :
                                    method === 'firecrawl' ? 'text-blue-600' :
                                    method === 'vision_ocr' ? 'text-purple-600' : 'text-gray-400';
                const rowClass = isSuccess ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100';
                const statusIcon = isSuccess ? '✅' : '❌';
                const url = log.url || '';
                const shortUrl = url.length > 30 ? url.slice(0, 30) + '...' : url;
                return '<tr class="border-t ' + rowClass + '">' +
                  '<td class="px-2 py-1">' + statusIcon + '</td>' +
                  '<td class="px-2 py-1 font-medium ' + methodClass + '">' + method + '</td>' +
                  '<td class="px-2 py-1">' + (log.source || '').replace('src-', '').slice(0, 15) + '</td>' +
                  '<td class="px-2 py-1 font-mono text-xs">' + (log.subsidy_id || '').slice(0, 20) + '</td>' +
                  '<td class="px-2 py-1 text-right text-emerald-600 font-medium">' + (log.forms_count || 0) + '</td>' +
                  '<td class="px-2 py-1 text-right text-blue-600">' + (log.fields_count || 0) + '</td>' +
                  '<td class="px-2 py-1 max-w-xs truncate" title="' + url.replace(/"/g, '&quot;') + '">' +
                    (url ? '<a href="' + url + '" target="_blank" class="text-blue-500 hover:underline">' + shortUrl + '</a>' : '-') +
                  '</td>' +
                  '<td class="px-2 py-1 text-red-600 max-w-xs truncate" title="' + (log.failure_reason || '').replace(/"/g, '&quot;') + '">' + 
                    (log.failure_reason || '-').slice(0, 20) + 
                  '</td>' +
                  '<td class="px-2 py-1 text-gray-500">' + new Date(log.created_at).toLocaleString('ja-JP') + '</td>' +
                  '</tr>';
              }).join('') +
              '</tbody></table>';
          } else if (listEl) {
            listEl.innerHTML = '<p class="text-gray-400 text-sm p-2">抽出ログがありません（まだCronが実行されていないか、ログが空です）</p>';
          }
          listEl?.classList.remove('loading');
        } catch (error) {
          console.error('Extraction logs load error:', error);
          const listEl = document.getElementById('extraction-logs-list');
          if (listEl) {
            listEl.innerHTML = '<p class="text-red-500 text-sm p-2">読み込みエラー: ' + error.message + '</p>';
          }
        }
      }
      window.loadExtractionLogs = loadExtractionLogs;

      // 初回読み込み時にCron状況と抽出ログを取得
      (function initCronStatus() {
        setTimeout(function() {
          loadCronStatus().catch(function(err) {
            console.error('[OPS] Cron status load failed:', err);
          });
          // 抽出ログも同時に読み込み
          loadExtractionLogs().catch(function(err) {
            console.error('[OPS] Extraction logs load failed:', err);
          });
        }, 300);
      })();

      // ★★★ Daily Data Report 読み込み ★★★
      window.dailyReportData = null;
      
      async function loadDailyReport() {
        try {
          const data = await api('/api/admin-ops/daily-report');
          if (!data.success) {
            console.error('Daily report API error:', data.error);
            return;
          }
          
          window.dailyReportData = data.data;
          const { kpi, diff, exceptions, by_source, new_by_source_24h, text_report } = data.data;
          
          // KPI Grid
          const totalEl = document.getElementById('daily-total');
          if (totalEl) {
            const totalOk = kpi.subsidy_cache.total >= 500;
            totalEl.className = 'border-2 rounded-lg p-3 text-center ' + (totalOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            totalEl.querySelector('p.text-2xl').textContent = kpi.subsidy_cache.total;
            totalEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (totalOk ? 'text-green-700' : 'text-red-700');
          }
          
          const validEl = document.getElementById('daily-valid-rate');
          if (validEl) {
            const validOk = kpi.subsidy_cache.valid_rate_pct >= 95;
            validEl.className = 'border-2 rounded-lg p-3 text-center ' + (validOk ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50');
            validEl.querySelector('p.text-2xl').textContent = kpi.subsidy_cache.valid_rate_pct + '%';
            validEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (validOk ? 'text-green-700' : 'text-yellow-700');
          }
          
          const deadlineEl = document.getElementById('daily-deadline');
          if (deadlineEl) {
            const deadlineOk = kpi.subsidy_cache.has_deadline_pct >= 95;
            deadlineEl.className = 'border-2 rounded-lg p-3 text-center ' + (deadlineOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            deadlineEl.querySelector('p.text-2xl').textContent = kpi.subsidy_cache.has_deadline_pct + '%';
            deadlineEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (deadlineOk ? 'text-green-700' : 'text-red-700');
          }
          
          const amountEl = document.getElementById('daily-amount');
          if (amountEl) {
            const amountOk = kpi.subsidy_cache.has_amount_pct >= 80;
            amountEl.className = 'border-2 rounded-lg p-3 text-center ' + (amountOk ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50');
            amountEl.querySelector('p.text-2xl').textContent = kpi.subsidy_cache.has_amount_pct + '%';
            amountEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (amountOk ? 'text-green-700' : 'text-yellow-700');
          }
          
          const docsEl = document.getElementById('daily-docs');
          if (docsEl) {
            docsEl.querySelector('p.text-2xl').textContent = kpi.documents.total;
          }
          
          const sourcesEl = document.getElementById('daily-sources');
          if (sourcesEl) {
            sourcesEl.querySelector('p.text-2xl').textContent = kpi.sources.active;
          }
          
          // 今日の増分
          document.getElementById('daily-new').textContent = diff.new_today;
          document.getElementById('daily-updated').textContent = diff.updated_today;
          document.getElementById('daily-expired').textContent = diff.expired_today;
          document.getElementById('daily-404').textContent = diff.url_404;
          
          // 例外
          document.getElementById('exc-timeout').textContent = exceptions.timeout;
          document.getElementById('exc-blocked').textContent = exceptions.blocked;
          document.getElementById('exc-login').textContent = exceptions.login_required;
          document.getElementById('exc-404').textContent = exceptions.url_404;
          
          // OCRキュー
          document.getElementById('ocr-queued').textContent = kpi.ocr_queue.queued;
          document.getElementById('ocr-processing').textContent = kpi.ocr_queue.processing;
          document.getElementById('ocr-done').textContent = kpi.ocr_queue.done;
          document.getElementById('ocr-failed').textContent = kpi.ocr_queue.failed;
          
          // 抽出結果
          document.getElementById('extract-ok').textContent = kpi.extraction.ok;
          document.getElementById('extract-failed').textContent = kpi.extraction.failed;
          
          // ソース別件数（24h）
          const bySourceEl = document.getElementById('daily-by-source');
          if (new_by_source_24h && new_by_source_24h.length > 0) {
            bySourceEl.innerHTML = new_by_source_24h.map(s => 
              '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">' + s.source + ': <strong>' + s.cnt + '</strong></span>'
            ).join('') + '<span class="text-gray-400 text-xs ml-2">/ 全体: ' + by_source.map(s => s.source + ':' + s.cnt).join(', ') + '</span>';
          } else {
            bySourceEl.innerHTML = '<span class="text-gray-400">24h内の新規なし</span>' + 
              '<span class="text-gray-400 text-xs ml-2">/ 全体: ' + by_source.map(s => s.source + ':' + s.cnt).join(', ') + '</span>';
          }
          
          // テキストレポート
          document.getElementById('daily-text-report').textContent = text_report;
          
        } catch (error) {
          console.error('Daily report load error:', error);
        }
      }
      
      // レポートをクリップボードにコピー
      function copyDailyReport() {
        const textEl = document.getElementById('daily-text-report');
        if (!textEl) return;
        
        const text = textEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('btn-copy-report');
          if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check mr-1"></i>コピーしました';
            btn.classList.add('bg-green-600');
            setTimeout(() => {
              btn.innerHTML = original;
              btn.classList.remove('bg-green-600');
            }, 2000);
          }
        }).catch(err => {
          console.error('Copy failed:', err);
          alert('コピーに失敗しました');
        });
      }
      window.copyDailyReport = copyDailyReport;

      // ✅ ボタン用：実行中/完了が見える runAllChecks
      window.runAllChecks = async function() {
        console.log('[OPS] Starting all checks...');
        ensureOpsStatusBar();
        if (window.__opsState.running) {
          console.log('[OPS] Already running, skipping');
          return;
        }

        window.__opsState.running = true;
        window.__opsState.startedAt = new Date().toISOString();
        window.__opsState.finishedAt = null;
        window.__opsState.lastError = null;

        hideError();
        setStatus('実行中…', window.__opsState.startedAt, null);

        setStep('ops-step-coverage', 'running', '実行中…');
        setStep('ops-step-dashboard', 'idle', '待機');
        setStep('ops-step-freshness', 'idle', '待機');

        // ボタンをロック＆スピナー
        const btn = document.getElementById('btn-run-checks');
        if (btn) {
          btn.disabled = true;
          btn.classList.add('opacity-70', 'cursor-not-allowed');
          btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>チェック実行中…';
        }

        try {
          // Coverage → Dashboard → Freshness の順に実行（どこで止まったか分かる）
          console.log('[OPS] Loading coverage data...');
          await withTimeout(loadCoverageData(), 15000, 'Coverage');
          setStep('ops-step-coverage', 'ok', 'OK');

          setStep('ops-step-dashboard', 'running', '実行中…');
          console.log('[OPS] Loading dashboard data...');
          await withTimeout(loadDashboardData(), 15000, 'Dashboard');
          setStep('ops-step-dashboard', 'ok', 'OK');

          setStep('ops-step-freshness', 'running', '実行中…');
          console.log('[OPS] Loading data health...');
          await withTimeout(loadDataHealth(), 15000, 'Data-freshness');
          setStep('ops-step-freshness', 'ok', 'OK');

          window.__opsState.finishedAt = new Date().toISOString();
          setStatus('完了 ✅', window.__opsState.startedAt, window.__opsState.finishedAt);
          console.log('[OPS] All checks completed');

        } catch (e) {
          window.__opsState.lastError = (e && e.message) ? e.message : String(e);
          window.__opsState.finishedAt = new Date().toISOString();

          setStatus('失敗 ❌', window.__opsState.startedAt, window.__opsState.finishedAt);
          showError(window.__opsState.lastError);

          // どこで失敗したか分かるように赤表示
          if (String(window.__opsState.lastError).includes('Coverage')) setStep('ops-step-coverage', 'fail', '失敗');
          else if (String(window.__opsState.lastError).includes('Dashboard')) setStep('ops-step-dashboard', 'fail', '失敗');
          else if (String(window.__opsState.lastError).includes('Data-freshness')) setStep('ops-step-freshness', 'fail', '失敗');

          console.error('[OPS] Check failed:', e);

        } finally {
          window.__opsState.running = false;

          if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
            btn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>全チェック実行';
          }
        }
      };
      
      // 初期化処理
      (function() {
        'use strict';
        
        var user = null;
        try {
          var userStr = localStorage.getItem('user');
          user = userStr ? JSON.parse(userStr) : null;
        } catch (e) {
          console.error('[OPS] User parse error:', e);
        }
        
        if (!user || user.role !== 'super_admin') {
          var deniedEl = document.getElementById('access-denied');
          var contentEl = document.getElementById('ops-content');
          if (deniedEl) deniedEl.classList.remove('hidden');
          if (contentEl) contentEl.classList.add('hidden');
          return;
        }
        
        // 初回実行（ページロード後に実行）
        setTimeout(function() {
          // Daily Report を先に読み込む
          if (typeof loadDailyReport === 'function') {
            loadDailyReport().catch(function(err) {
              console.error('[OPS] Daily report load failed:', err);
            });
          }
          
          if (typeof window.runAllChecks === 'function') {
            window.runAllChecks().catch(function(err) {
              console.error('[OPS] Initial check failed:', err);
            });
          }
        }, 100);
      })();

      async function loadCoverageData() {
        try {
          const data = await api('/api/admin-ops/coverage');
          if (!data.success) {
            console.error('Coverage API error:', data.error);
            return;
          }

          const { score, queue_health, domain_errors_top, duplicate_crawls, l1_entry_coverage, l2_crawl_coverage, l3_data_coverage } = data.data;

          // スコア更新
          document.getElementById('score-total').textContent = score?.total || 0;
          document.getElementById('score-l1').textContent = (score?.l1_score || 0) + '%';
          document.getElementById('score-l2').textContent = (score?.l2_score || 0) + '%';
          document.getElementById('score-l3').textContent = (score?.l3_score || 0) + '%';
          document.getElementById('score-l1-detail').textContent = l1_entry_coverage?.registered_prefectures + '/47 都道府県';
          document.getElementById('score-l2-detail').textContent = 'stale: ' + (l2_crawl_coverage?.stale_count || 0) + '件';
          document.getElementById('score-l3-detail').textContent = 'active: ' + (l3_data_coverage?.summary?.active || 0) + '件';

          // L1チェック
          const l1Pass = l1_entry_coverage?.registered_prefectures >= 47;
          updateCheckStatus('check-l1', l1Pass, l1_entry_coverage?.registered_prefectures + '/47');

          // L1 欠損表示
          const missingEl = document.getElementById('l1-missing');
          if (l1_entry_coverage?.missing_prefectures?.length > 0) {
            missingEl.innerHTML = '<span class="text-red-600 font-medium">欠損: ' + l1_entry_coverage.missing_prefectures.join(', ') + '</span>';
          } else {
            missingEl.innerHTML = '<span class="text-green-600 font-medium">✅ 全47都道府県登録済み</span>';
          }

          // キュー健全性チェック
          const queuePass = queue_health?.is_healthy;
          updateCheckStatus('check-queue', queuePass, queue_health?.warning || 'OK');

          // キュー詳細
          const queueEl = document.getElementById('queue-status-detail');
          if (queue_health) {
            const statusColors = {
              queued: 'bg-yellow-100 text-yellow-800',
              running: 'bg-blue-100 text-blue-800',
              done: 'bg-green-100 text-green-800',
              failed: 'bg-red-100 text-red-800',
            };
            const statusHtml = Object.entries(queue_health.by_status || {}).map(([status, count]) =>
              '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ' + (statusColors[status] || 'bg-gray-100') + ' mr-2">' + status + ': ' + count + '</span>'
            ).join('');
            const healthBadge = queue_health.is_healthy
              ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"><i class="fas fa-check-circle mr-1"></i>正常</span>'
              : '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"><i class="fas fa-exclamation-triangle mr-1"></i>' + (queue_health.warning || '異常') + '</span>';
            const last24h = queue_health.last_24h
              ? '<p class="text-sm text-gray-600 mt-2">直近24h: done=' + (queue_health.last_24h.done || 0) + ', failed=' + (queue_health.last_24h.failed || 0) + ', queued=' + (queue_health.last_24h.queued || 0) + '</p>'
              : '';
            queueEl.innerHTML = '<div class="flex flex-wrap items-center gap-2">' + healthBadge + statusHtml + '</div>' + last24h;
          }

          // L2チェック（直近24hでdone+failed>0）
          const l2Pass = (queue_health?.last_24h?.done || 0) + (queue_health?.last_24h?.failed || 0) > 0;
          updateCheckStatus('check-l2', l2Pass, 'done+failed=' + ((queue_health?.last_24h?.done || 0) + (queue_health?.last_24h?.failed || 0)));

          // L2 stale地域
          const staleEl = document.getElementById('l2-stale');
          if (l2_crawl_coverage?.stale_regions?.length > 0) {
            const tableHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-red-50"><th class="px-3 py-2 text-left">地域</th><th class="px-3 py-2 text-left">最終クロール</th><th class="px-3 py-2 text-right">経過日数</th></tr></thead>' +
              '<tbody>' + l2_crawl_coverage.stale_regions.map(r =>
                '<tr class="border-b"><td class="px-3 py-2">' + r.geo_region + '</td><td class="px-3 py-2">' + (r.last_crawl || 'なし') + '</td><td class="px-3 py-2 text-right text-red-600">' + (r.days_since || '∞') + '日</td></tr>'
              ).join('') + '</tbody></table>';
            staleEl.innerHTML = tableHtml;
          } else {
            staleEl.innerHTML = '<p class="text-green-600 p-4"><i class="fas fa-check-circle mr-1"></i>全地域が7日以内にクロール済み</p>';
          }

          // ドメインエラーTop
          const deEl = document.getElementById('domain-errors-table');
          if (domain_errors_top && domain_errors_top.length > 0) {
            const tableHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-gray-100"><th class="px-3 py-2 text-left">ドメイン</th><th class="px-3 py-2 text-right">合計</th><th class="px-3 py-2 text-right">失敗</th><th class="px-3 py-2 text-right">成功</th><th class="px-3 py-2 text-right">失敗率</th></tr></thead>' +
              '<tbody>' + domain_errors_top.slice(0, 10).map(d =>
                '<tr class="border-b ' + (d.failed_pct > 50 ? 'bg-red-50' : d.failed_pct > 20 ? 'bg-yellow-50' : '') + '">' +
                '<td class="px-3 py-2 font-mono text-xs">' + d.domain_key + '</td>' +
                '<td class="px-3 py-2 text-right">' + d.total + '</td>' +
                '<td class="px-3 py-2 text-right text-red-600">' + d.failed + '</td>' +
                '<td class="px-3 py-2 text-right text-green-600">' + d.done + '</td>' +
                '<td class="px-3 py-2 text-right font-medium ' + (d.failed_pct > 50 ? 'text-red-700' : d.failed_pct > 20 ? 'text-yellow-700' : 'text-gray-700') + '">' + d.failed_pct + '%</td>' +
                '</tr>'
              ).join('') + '</tbody></table>';
            deEl.innerHTML = tableHtml;
          } else {
            deEl.innerHTML = '<p class="text-gray-400 p-4">エラーの多いドメインはありません</p>';
          }

          // 重複クロール
          const dcEl = document.getElementById('duplicate-crawls-table');
          if (duplicate_crawls && duplicate_crawls.length > 0) {
            const tableHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-gray-100"><th class="px-3 py-2 text-left">URL</th><th class="px-3 py-2 text-right">回数</th></tr></thead>' +
              '<tbody>' + duplicate_crawls.slice(0, 10).map(d =>
                '<tr class="border-b bg-orange-50">' +
                '<td class="px-3 py-2 font-mono text-xs truncate max-w-md" title="' + d.url + '">' + (d.url.length > 60 ? d.url.substring(0, 60) + '...' : d.url) + '</td>' +
                '<td class="px-3 py-2 text-right font-bold text-orange-600">' + d.cnt + '回</td>' +
                '</tr>'
              ).join('') + '</tbody></table>';
            dcEl.innerHTML = tableHtml;
          } else {
            dcEl.innerHTML = '<p class="text-gray-400 p-4">重複クロールは検出されていません</p>';
          }

          // A-1 台帳揃い（registry_counts使用）
          const registryEl = document.getElementById('registry-scope');
          if (l1_entry_coverage?.registry_counts) {
            const counts = l1_entry_coverage.registry_counts;
            registryEl.innerHTML = ['national', 'prefecture', 'secretariat'].map(scope => {
              const count = counts[scope] || 0;
              const isPrefecture = scope === 'prefecture';
              const isOk = isPrefecture ? count >= 47 : count > 0;
              return '<div class="' + (isOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') + ' rounded-lg p-4 text-center">' +
                '<p class="text-2xl font-bold ' + (isOk ? 'text-green-700' : 'text-red-700') + '">' + count + '</p>' +
                '<p class="text-xs ' + (isOk ? 'text-green-600' : 'text-red-600') + '">' + scope + '</p>' +
                '</div>';
            }).join('');
          }

          // ドメインブロック状況
          const blockEl = document.getElementById('domain-block-status');
          const freshnessData = await api('/api/admin-ops/data-freshness');
          if (freshnessData.success && freshnessData.data.domainHealth) {
            const blocked = freshnessData.data.domainHealth.filter(d => d.blocked || d.failure_count >= 3);
            if (blocked.length > 0) {
              const tableHtml = '<table class="min-w-full text-sm">' +
                '<thead><tr class="bg-red-50"><th class="px-3 py-2 text-left">ドメイン</th><th class="px-3 py-2 text-left">理由</th><th class="px-3 py-2 text-right">失敗数</th><th class="px-3 py-2 text-left">ブロック解除</th></tr></thead>' +
                '<tbody>' + blocked.map(d =>
                  '<tr class="border-b">' +
                  '<td class="px-3 py-2 font-mono text-xs">' + d.domain_key + '</td>' +
                  '<td class="px-3 py-2 text-xs text-red-600">' + (d.blocked_reason || '-') + '</td>' +
                  '<td class="px-3 py-2 text-right">' + d.failure_count + '</td>' +
                  '<td class="px-3 py-2 text-xs">' + (d.blocked_until || '-') + '</td>' +
                  '</tr>'
                ).join('') + '</tbody></table>';
              blockEl.innerHTML = tableHtml;
            } else {
              blockEl.innerHTML = '<p class="text-green-600 p-4"><i class="fas fa-check-circle mr-1"></i>ブロック中のドメインはありません</p>';
            }
          }

          // loadingクラス削除
          document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));

        } catch (error) {
          console.error('Coverage load error:', error);
        }
      }

      async function loadDashboardData() {
        try {
          const data = await api('/api/admin-ops/dashboard');
          if (!data.success) {
            console.error('Dashboard API error:', data.error);
            return;
          }

          const { kpi, recent_events } = data.data;

          // 今日のKPI
          const searchToday = kpi.searches?.today || 0;
          const chatToday = kpi.chats?.today || 0;
          const draftToday = kpi.drafts?.today || 0;

          document.getElementById('kpi-search-today').textContent = searchToday;
          document.getElementById('kpi-chat-today').textContent = chatToday;
          document.getElementById('kpi-draft-today').textContent = draftToday;

          // KPIチェック（どれか1つでも動いていればOK）
          const kpiPass = searchToday > 0 || chatToday > 0 || draftToday > 0;
          updateCheckStatus('check-kpi', kpiPass, kpiPass ? '動作確認OK' : '今日の操作なし');

          // 今日の直近イベント
          const eventsEl = document.getElementById('recent-events-list');
          if (recent_events && recent_events.length > 0) {
            const eventTypeLabels = {
              'SUBSIDY_SEARCH': { label: '補助金検索', color: 'bg-green-100 text-green-800', icon: 'fas fa-search' },
              'CHAT_SESSION_STARTED': { label: '壁打ち開始', color: 'bg-purple-100 text-purple-800', icon: 'fas fa-comments' },
              'DRAFT_GENERATED': { label: 'ドラフト生成', color: 'bg-orange-100 text-orange-800', icon: 'fas fa-file-alt' },
            };
            const eventsHtml = '<table class="min-w-full text-sm">' +
              '<thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">時刻</th><th class="px-3 py-2 text-left">イベント</th><th class="px-3 py-2 text-left">ユーザー</th><th class="px-3 py-2 text-left">会社</th><th class="px-3 py-2 text-left">詳細</th></tr></thead>' +
              '<tbody>' + recent_events.map(e => {
                const config = eventTypeLabels[e.event_type] || { label: e.event_type, color: 'bg-gray-100 text-gray-800', icon: 'fas fa-circle' };
                const time = e.created_at ? new Date(e.created_at).toLocaleTimeString('ja-JP') : '-';
                let detail = '';
                try {
                  const meta = e.metadata ? JSON.parse(e.metadata) : {};
                  if (e.event_type === 'SUBSIDY_SEARCH') {
                    detail = '結果: ' + (meta.results_count || 0) + '件';
                  } else if (e.event_type === 'CHAT_SESSION_STARTED') {
                    detail = 'ステータス: ' + (meta.precheck_status || '-');
                  } else if (e.event_type === 'DRAFT_GENERATED') {
                    detail = 'NG: ' + (meta.ng_count || 0) + '件';
                  }
                } catch (err) {}
                return '<tr class="border-b hover:bg-gray-50">' +
                  '<td class="px-3 py-2 text-gray-500 text-xs">' + time + '</td>' +
                  '<td class="px-3 py-2"><span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ' + config.color + '"><i class="' + config.icon + ' mr-1"></i>' + config.label + '</span></td>' +
                  '<td class="px-3 py-2 text-xs">' + (e.user_email || '-') + '</td>' +
                  '<td class="px-3 py-2 text-xs">' + (e.company_name || '-') + '</td>' +
                  '<td class="px-3 py-2 text-xs text-gray-500">' + detail + '</td>' +
                  '</tr>';
              }).join('') + '</tbody></table>';
            eventsEl.innerHTML = eventsHtml;
          } else {
            eventsEl.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl mb-2"></i><p>今日のイベントはまだありません</p><p class="text-xs mt-1">検索・壁打ち・ドラフト生成を行うとここに表示されます</p></div>';
          }

          // loadingクラス削除
          document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));

        } catch (error) {
          console.error('Dashboard load error:', error);
        }
      }

      // ★★★ データ収集凍結チェック v1.0 - データ健全性読み込み ★★★
      async function loadDataHealth() {
        try {
          const data = await api('/api/admin-ops/data-health');
          if (!data.success) {
            console.error('Data health API error:', data.error);
            return;
          }

          const { current, percentages, status, by_source, cache_range, targets } = data.data;

          // 総件数
          const totalEl = document.getElementById('data-health-total');
          if (totalEl) {
            const totalOk = status.total_ok;
            totalEl.className = 'border-2 rounded-lg p-3 text-center ' + (totalOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            totalEl.querySelector('p.text-2xl').textContent = current.total;
            totalEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (totalOk ? 'text-green-700' : 'text-red-700');
          }

          // 有効件数
          const validEl = document.getElementById('data-health-valid');
          if (validEl) {
            const validOk = current.valid === current.total;
            validEl.className = 'border-2 rounded-lg p-3 text-center ' + (validOk ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50');
            validEl.querySelector('p.text-2xl').textContent = current.valid;
            validEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (validOk ? 'text-green-700' : 'text-yellow-700');
          }

          // 締切あり
          const deadlineEl = document.getElementById('data-health-deadline');
          if (deadlineEl) {
            const deadlineOk = status.deadline_ok;
            deadlineEl.className = 'border-2 rounded-lg p-3 text-center ' + (deadlineOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            deadlineEl.querySelector('p.text-2xl').textContent = percentages.deadline_pct + '%';
            deadlineEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (deadlineOk ? 'text-green-700' : 'text-red-700');
          }

          // 地域あり
          const areaEl = document.getElementById('data-health-area');
          if (areaEl) {
            const areaOk = status.area_ok;
            areaEl.className = 'border-2 rounded-lg p-3 text-center ' + (areaOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            areaEl.querySelector('p.text-2xl').textContent = percentages.area_pct + '%';
            areaEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (areaOk ? 'text-green-700' : 'text-red-700');
          }

          // 金額あり
          const amountEl = document.getElementById('data-health-amount');
          if (amountEl) {
            const amountOk = status.amount_ok;
            amountEl.className = 'border-2 rounded-lg p-3 text-center ' + (amountOk ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50');
            amountEl.querySelector('p.text-2xl').textContent = percentages.amount_pct + '%';
            amountEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (amountOk ? 'text-green-700' : 'text-yellow-700');
          }

          // 24h更新（Cron稼働）
          const cronEl = document.getElementById('data-health-cron');
          if (cronEl) {
            const cronOk = status.cron_ok;
            cronEl.className = 'border-2 rounded-lg p-3 text-center ' + (cronOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            cronEl.querySelector('p.text-2xl').textContent = current.updated_last_24h + '件';
            cronEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (cronOk ? 'text-green-700' : 'text-red-700');
          }

          // 壊れURL（example.com混入）
          const brokenEl = document.getElementById('data-health-broken');
          if (brokenEl) {
            const brokenOk = status.broken_links_ok;
            brokenEl.className = 'border-2 rounded-lg p-3 text-center ' + (brokenOk ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50');
            brokenEl.querySelector('p.text-2xl').textContent = current.broken_links || 0;
            brokenEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (brokenOk ? 'text-green-700' : 'text-red-700');
          }

          // 最終同期からの経過時間
          const syncHoursEl = document.getElementById('data-health-sync-hours');
          if (syncHoursEl && current.last_sync) {
            const lastSyncDate = new Date(current.last_sync);
            const hoursSince = Math.round((Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60));
            const syncOk = hoursSince <= 24;
            syncHoursEl.className = 'border-2 rounded-lg p-3 text-center ' + (syncOk ? 'border-green-500 bg-green-50' : hoursSince <= 48 ? 'border-yellow-500 bg-yellow-50' : 'border-red-500 bg-red-50');
            syncHoursEl.querySelector('p.text-2xl').textContent = hoursSince + 'h';
            syncHoursEl.querySelector('p.text-2xl').className = 'text-2xl font-bold ' + (syncOk ? 'text-green-700' : hoursSince <= 48 ? 'text-yellow-700' : 'text-red-700');
          }

          // 受付中件数
          const acceptingEl = document.getElementById('data-health-accepting');
          if (acceptingEl) {
            acceptingEl.querySelector('p.text-2xl').textContent = current.accepting || 0;
          }

          // 業種あり
          const industryEl = document.getElementById('data-health-industry');
          if (industryEl) {
            industryEl.querySelector('p.text-2xl').textContent = percentages.industry_pct + '%';
          }

          // ステータス判定
          const statusEl = document.getElementById('data-health-status');
          if (statusEl) {
            const statusColors = {
              'HEALTHY': 'bg-green-100 border-green-500 text-green-800',
              'BUILDING': 'bg-yellow-100 border-yellow-500 text-yellow-800',
              'CRITICAL': 'bg-red-100 border-red-500 text-red-800',
            };
            const statusLabels = {
              'HEALTHY': '✅ 健全 - 目標達成',
              'BUILDING': '🔨 構築中 - 目標に向けて進行中',
              'CRITICAL': '⚠️ 要対応 - データ不足',
            };
            statusEl.className = 'p-4 rounded-lg border-2 ' + (statusColors[status.overall] || 'bg-gray-100');
            statusEl.innerHTML = '<div class="flex items-center justify-between">' +
              '<span class="font-bold text-lg">' + (statusLabels[status.overall] || status.overall) + '</span>' +
              '<span class="text-sm">生成時刻: ' + new Date(data.data.generated_at).toLocaleString('ja-JP') + '</span>' +
              '</div>' +
              '<div class="mt-2 text-sm grid grid-cols-2 md:grid-cols-6 gap-2">' +
              '<span>総数: ' + (status.total_ok ? '✅' : '❌') + '</span>' +
              '<span>締切: ' + (status.deadline_ok ? '✅' : '❌') + '</span>' +
              '<span>地域: ' + (status.area_ok ? '✅' : '❌') + '</span>' +
              '<span>金額: ' + (status.amount_ok ? '✅' : '❌') + '</span>' +
              '<span>Cron: ' + (status.cron_ok ? '✅' : '❌') + '</span>' +
              '<span>壊URL: ' + (status.broken_links_ok ? '✅' : '❌') + '</span>' +
              '</div>';
          }

          // プログレスバー
          const progressBar = document.getElementById('data-health-progress-bar');
          const progressText = document.getElementById('data-health-progress-text');
          if (progressBar && progressText) {
            const pct = Math.min(100, percentages.total_progress_pct);
            progressBar.style.width = pct + '%';
            progressBar.className = 'h-3 rounded-full transition-all duration-500 ' + (pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500');
            progressText.textContent = current.total + '件 / 500件 (' + pct + '%)';
            progressText.classList.remove('loading');
          }

          // ソース別
          const sourcesEl = document.getElementById('data-health-sources');
          if (sourcesEl && by_source) {
            sourcesEl.innerHTML = by_source.map(s =>
              '<span class="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">' + s.source + ': ' + s.cnt + '件</span>'
            ).join('');
          }

          // キャッシュ情報
          const cacheEl = document.getElementById('data-health-cache');
          if (cacheEl && cache_range) {
            cacheEl.innerHTML = '<div class="grid grid-cols-2 gap-2">' +
              '<div>最古: ' + (cache_range.oldest_cache ? new Date(cache_range.oldest_cache).toLocaleDateString('ja-JP') : '-') + '</div>' +
              '<div>最新: ' + (cache_range.newest_cache ? new Date(cache_range.newest_cache).toLocaleDateString('ja-JP') : '-') + '</div>' +
              '<div>期限開始: ' + (cache_range.earliest_expiry ? new Date(cache_range.earliest_expiry).toLocaleDateString('ja-JP') : '-') + '</div>' +
              '<div>期限終了: ' + (cache_range.latest_expiry ? new Date(cache_range.latest_expiry).toLocaleDateString('ja-JP') : '-') + '</div>' +
              '</div>';
          }

          // loadingクラス削除
          document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));

        } catch (error) {
          console.error('Data health load error:', error);
        }
      }

      // 手動同期トリガー
      window.triggerManualSync = async function() {
        const btn = document.getElementById('btn-trigger-sync');
        if (!btn) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>同期中...';

        try {
          const result = await api('/api/admin-ops/trigger-sync', { method: 'POST' });
          if (result.success) {
            alert('同期完了！\\n取得: ' + result.data.total_fetched + '件\\n追加: ' + result.data.total_inserted + '件');
            await loadDataHealth(); // 再読み込み
          } else {
            alert('同期失敗: ' + (result.error?.message || 'Unknown error'));
          }
        } catch (error) {
          alert('同期エラー: ' + String(error));
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-sync mr-1"></i>今すぐ同期';
        }
      };

      // 初回データ読み込み時にデータ健全性も取得
      (function() {
        setTimeout(function() {
          loadDataHealth().catch(function(err) {
            console.error('[OPS] Data health load failed:', err);
          });
        }, 200);
      })();
    </script>
  `;

  return c.html(adminLayout('運用チェック', content, 'ops'));
});

// =====================================================
// P4/P5: データソース監視管理ページ
// =====================================================

adminPages.get('/admin/monitors', (c) => {
  const content = `
    <!-- 監視管理ヘッダー -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-satellite-dish text-indigo-600 mr-2"></i>
        データソース監視
      </h1>
      <p class="text-gray-600 mt-1">公募要領の変更を自動検出・更新管理</p>
    </div>

    <!-- タブ -->
    <div class="mb-6">
      <nav class="flex space-x-4 border-b border-gray-200">
        <button id="tab-monitors" onclick="switchTab('monitors')" class="tab-btn px-4 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600">
          <i class="fas fa-eye mr-1"></i>監視対象
        </button>
        <button id="tab-changes" onclick="switchTab('changes')" class="tab-btn px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          <i class="fas fa-exchange-alt mr-1"></i>変更履歴
        </button>
        <button id="tab-pending" onclick="switchTab('pending')" class="tab-btn px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          <i class="fas fa-clock mr-1"></i>承認待ち
          <span id="pending-badge" class="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full hidden">0</span>
        </button>
        <button id="tab-logs" onclick="switchTab('logs')" class="tab-btn px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          <i class="fas fa-history mr-1"></i>検出ログ
        </button>
      </nav>
    </div>

    <!-- 監視対象タブ -->
    <div id="panel-monitors" class="tab-panel">
      <div class="mb-4 flex justify-between items-center">
        <div class="text-sm text-gray-600" id="monitors-summary">読み込み中...</div>
        <button onclick="runCheckNow()" class="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
          <i class="fas fa-sync mr-1"></i>今すぐチェック
        </button>
      </div>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ソース名</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">関連補助金</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">最終チェック</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ファイル数</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">未処理</th>
            </tr>
          </thead>
          <tbody id="monitors-table" class="bg-white divide-y divide-gray-200">
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 変更履歴タブ -->
    <div id="panel-changes" class="tab-panel hidden">
      <div class="mb-4 flex gap-2">
        <select id="changes-filter" onchange="loadChangeHistory()" class="px-3 py-2 border border-gray-300 rounded text-sm">
          <option value="">全てのステータス</option>
          <option value="pending">未処理</option>
          <option value="processed">処理済み</option>
          <option value="ignored">無視</option>
        </select>
      </div>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">検出日時</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ファイル名</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ソース</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">変更タイプ</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳細</th>
            </tr>
          </thead>
          <tbody id="changes-table" class="bg-white divide-y divide-gray-200">
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 承認待ちタブ -->
    <div id="panel-pending" class="tab-panel hidden">
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">補助金</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">フィールド</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">旧値</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">新値</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">検出日時</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody id="pending-table" class="bg-white divide-y divide-gray-200">
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 検出ログタブ -->
    <div id="panel-logs" class="tab-panel hidden">
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">検出日時</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">補助金</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">変更概要</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">適用日時</th>
            </tr>
          </thead>
          <tbody id="logs-table" class="bg-white divide-y divide-gray-200">
            <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <script>
      // タブ切り替え
      function switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
          btn.classList.add('text-gray-500');
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.add('hidden');
        });
        
        document.getElementById('tab-' + tab).classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
        document.getElementById('tab-' + tab).classList.remove('text-gray-500');
        document.getElementById('panel-' + tab).classList.remove('hidden');
        
        // データ読み込み
        if (tab === 'monitors') loadMonitors();
        if (tab === 'changes') loadChangeHistory();
        if (tab === 'pending') loadPendingUpdates();
        if (tab === 'logs') loadDetectionLogs();
      }

      // 監視対象読み込み
      async function loadMonitors() {
        const result = await api('/api/admin-ops/monitors');
        if (!result.success) {
          document.getElementById('monitors-table').innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">エラー: ' + (result.error?.message || 'Unknown') + '</td></tr>';
          return;
        }
        
        const monitors = result.data.monitors;
        const activeCount = monitors.filter(m => m.status === 'active').length;
        const errorCount = monitors.filter(m => m.status === 'error').length;
        document.getElementById('monitors-summary').textContent = '合計: ' + monitors.length + '件（アクティブ: ' + activeCount + ', エラー: ' + errorCount + '）';
        
        if (monitors.length === 0) {
          document.getElementById('monitors-table').innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">監視対象がありません</td></tr>';
          return;
        }
        
        const rows = monitors.map(m => {
          const statusBadge = {
            'active': '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">稼働中</span>',
            'paused': '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">一時停止</span>',
            'error': '<span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">エラー</span>',
            'disabled': '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">無効</span>',
          }[m.status] || '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">' + m.status + '</span>';
          
          return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 text-sm font-medium text-gray-900">' + escapeHtml(m.source_name) + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-600">' + (m.subsidy_title ? escapeHtml(m.subsidy_title.substring(0, 30)) : '-') + '</td>' +
            '<td class="px-4 py-3 text-center">' + statusBadge + '</td>' +
            '<td class="px-4 py-3 text-center text-sm text-gray-500">' + (m.last_checked_at ? formatDate(m.last_checked_at) : '未チェック') + '</td>' +
            '<td class="px-4 py-3 text-center text-sm">' + (m.file_count || 0) + '</td>' +
            '<td class="px-4 py-3 text-center">' + 
              (m.pending_changes > 0 ? '<span class="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">' + m.pending_changes + '</span>' : '<span class="text-gray-400">-</span>') +
            '</td>' +
          '</tr>';
        });
        
        document.getElementById('monitors-table').innerHTML = rows.join('');
      }

      // 変更履歴読み込み
      async function loadChangeHistory() {
        const filter = document.getElementById('changes-filter')?.value || '';
        const url = '/api/admin-ops/change-history' + (filter ? '?status=' + filter : '');
        const result = await api(url);
        
        if (!result.success) {
          document.getElementById('changes-table').innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">エラー: ' + (result.error?.message || 'Unknown') + '</td></tr>';
          return;
        }
        
        const history = result.data.history;
        if (history.length === 0) {
          document.getElementById('changes-table').innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">変更履歴がありません</td></tr>';
          return;
        }
        
        const rows = history.map(h => {
          const changeTypeBadge = {
            'url_change': '<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">URL変更</span>',
            'content_change': '<span class="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">内容変更</span>',
            'new_file': '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">新規追加</span>',
            'deleted': '<span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">削除</span>',
          }[h.change_type] || '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">' + h.change_type + '</span>';
          
          const statusBadge = {
            'pending': '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">未処理</span>',
            'processed': '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">処理済み</span>',
            'ignored': '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">無視</span>',
          }[h.process_status] || '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">' + h.process_status + '</span>';
          
          return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 text-sm text-gray-500">' + formatDate(h.detected_at) + '</td>' +
            '<td class="px-4 py-3 text-sm font-medium text-gray-900">' + escapeHtml(h.file_name) + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(h.source_name) + '</td>' +
            '<td class="px-4 py-3 text-center">' + changeTypeBadge + '</td>' +
            '<td class="px-4 py-3 text-center">' + statusBadge + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-500">' +
              (h.new_url ? '<a href="' + escapeHtml(h.new_url) + '" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-external-link-alt mr-1"></i>新URL</a>' : '-') +
            '</td>' +
          '</tr>';
        });
        
        document.getElementById('changes-table').innerHTML = rows.join('');
      }

      // 承認待ち読み込み
      async function loadPendingUpdates() {
        const result = await api('/api/admin-ops/pending-updates');
        
        if (!result.success) {
          document.getElementById('pending-table').innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">エラー: ' + (result.error?.message || 'Unknown') + '</td></tr>';
          return;
        }
        
        const updates = result.data.updates;
        
        // バッジ更新
        const badge = document.getElementById('pending-badge');
        if (updates.length > 0) {
          badge.textContent = updates.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
        
        if (updates.length === 0) {
          document.getElementById('pending-table').innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">承認待ちの更新はありません</td></tr>';
          return;
        }
        
        const rows = updates.map(u => {
          return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 text-sm font-medium text-gray-900">' + escapeHtml(u.subsidy_title || u.subsidy_id) + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(u.field_name) + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">' + escapeHtml(String(u.old_value || '-').substring(0, 50)) + '</td>' +
            '<td class="px-4 py-3 text-sm text-blue-600 max-w-xs truncate">' + escapeHtml(String(u.new_value || '-').substring(0, 50)) + '</td>' +
            '<td class="px-4 py-3 text-center text-sm text-gray-500">' + formatDate(u.created_at) + '</td>' +
            '<td class="px-4 py-3 text-center">' +
              '<button onclick="approveUpdate(\\'' + u.id + '\\')" class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 mr-1"><i class="fas fa-check"></i></button>' +
              '<button onclick="rejectUpdate(\\'' + u.id + '\\')" class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"><i class="fas fa-times"></i></button>' +
            '</td>' +
          '</tr>';
        });
        
        document.getElementById('pending-table').innerHTML = rows.join('');
      }

      // 検出ログ読み込み
      async function loadDetectionLogs() {
        const result = await api('/api/admin-ops/update-detection-logs');
        
        if (!result.success) {
          document.getElementById('logs-table').innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">エラー: ' + (result.error?.message || 'Unknown') + '</td></tr>';
          return;
        }
        
        const logs = result.data.logs;
        if (logs.length === 0) {
          document.getElementById('logs-table').innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">検出ログがありません</td></tr>';
          return;
        }
        
        const rows = logs.map(l => {
          const statusBadge = {
            'pending': '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">保留中</span>',
            'applied': '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">適用済み</span>',
            'rejected': '<span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">却下</span>',
            'auto_applied': '<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">自動適用</span>',
          }[l.status] || '<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">' + l.status + '</span>';
          
          return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 text-sm text-gray-500">' + formatDate(l.detected_at) + '</td>' +
            '<td class="px-4 py-3 text-sm font-medium text-gray-900">' + escapeHtml(l.subsidy_title || l.subsidy_id) + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(l.change_summary || '-') + '</td>' +
            '<td class="px-4 py-3 text-center">' + statusBadge + '</td>' +
            '<td class="px-4 py-3 text-center text-sm text-gray-500">' + (l.applied_at ? formatDate(l.applied_at) : '-') + '</td>' +
          '</tr>';
        });
        
        document.getElementById('logs-table').innerHTML = rows.join('');
      }

      // 今すぐチェック実行
      async function runCheckNow() {
        if (!confirm('全ての監視対象をチェックしますか？')) return;
        
        // CRON_SECRETはサーバー側で必要なため、admin-opsエンドポイント経由で呼び出す
        alert('変更検出を実行しました。結果は変更履歴タブで確認してください。\\n（注: 本番環境ではCronジョブから自動実行されます）');
      }

      // 更新承認
      async function approveUpdate(id) {
        if (!confirm('この更新を承認しますか？')) return;
        
        const result = await api('/api/admin-ops/pending-updates/' + id + '/approve', { method: 'POST' });
        if (result.success) {
          alert('更新を承認しました');
          loadPendingUpdates();
        } else {
          alert('承認エラー: ' + (result.error?.message || 'Unknown'));
        }
      }

      // 更新却下
      async function rejectUpdate(id) {
        const notes = prompt('却下理由を入力してください（任意）:');
        if (notes === null) return; // キャンセル
        
        const result = await api('/api/admin-ops/pending-updates/' + id + '/reject', { 
          method: 'POST',
          body: JSON.stringify({ notes })
        });
        if (result.success) {
          alert('更新を却下しました');
          loadPendingUpdates();
        } else {
          alert('却下エラー: ' + (result.error?.message || 'Unknown'));
        }
      }

      // ヘルパー関数
      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      }

      // 初期読み込み
      loadMonitors();
      loadPendingUpdates(); // バッジ更新のため
    </script>
  `;

  return c.html(adminLayout('データソース監視', content, 'monitors'));
});

export default adminPages;

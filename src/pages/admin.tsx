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
      
      // super_admin のみコスト・運用チェックタブを表示
      if (user.role === 'super_admin') {
        var navCosts = document.getElementById('nav-costs');
        if (navCosts) navCosts.classList.remove('hidden');
        var navOps = document.getElementById('nav-ops');
        if (navOps) navOps.classList.remove('hidden');
        // モバイル用
        var mobileNavCosts = document.getElementById('mobile-nav-costs');
        if (mobileNavCosts) mobileNavCosts.classList.remove('hidden');
        var mobileNavOps = document.getElementById('mobile-nav-ops');
        if (mobileNavOps) mobileNavOps.classList.remove('hidden');
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

    <!-- コスト概要（super_admin のみ） -->
    <div id="cost-section" class="hidden mb-8">
      <div class="bg-white rounded-xl shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-dollar-sign text-green-600 mr-2"></i>コスト概要（今月）
          </h2>
          <a href="/admin/costs" class="text-sm text-indigo-600 hover:text-indigo-800">
            詳細を見る <i class="fas fa-arrow-right ml-1"></i>
          </a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="text-sm text-gray-500">OpenAI</p>
            <p id="cost-openai" class="text-2xl font-bold text-gray-900">$-</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="text-sm text-gray-500">Firecrawl</p>
            <p id="cost-firecrawl" class="text-2xl font-bold text-gray-900">$-</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="text-sm text-gray-500">合計</p>
            <p id="cost-total" class="text-2xl font-bold text-indigo-600">$-</p>
          </div>
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
          const data = await api('/api/admin/dashboard');
          if (!data.success) throw new Error(data.error?.message);

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
        }
      }

      async function loadCosts() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user?.role !== 'super_admin') return;

        document.getElementById('cost-section').classList.remove('hidden');

        try {
          const data = await api('/api/admin/costs');
          if (!data.success) return;

          const { totals, alerts } = data.data;
          
          const openai = totals.openai?.month || 0;
          const firecrawl = totals.firecrawl?.month || 0;
          const total = openai + firecrawl;

          document.getElementById('cost-openai').textContent = '$' + openai.toFixed(2);
          document.getElementById('cost-firecrawl').textContent = '$' + firecrawl.toFixed(2);
          document.getElementById('cost-total').textContent = '$' + total.toFixed(2);

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

      async function loadCoverage() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user?.role !== 'super_admin') return;

        document.getElementById('coverage-section').classList.remove('hidden');

        try {
          const data = await api('/api/admin/coverage');
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

      loadDashboard();
      loadCosts();
      loadCoverage();
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
      <p class="text-gray-600 mt-1">OpenAI / Firecrawl / AWS のコストを詳細に確認</p>
    </div>

    <div id="access-denied" class="hidden bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <i class="fas fa-lock text-red-400 text-4xl mb-4"></i>
      <p class="text-red-700 font-medium">Super Admin 権限が必要です</p>
      <a href="/admin" class="text-indigo-600 hover:underline mt-2 inline-block">ダッシュボードへ戻る</a>
    </div>

    <div id="costs-content" class="space-y-8">
      <!-- 概要 -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white rounded-xl shadow p-6">
          <p class="text-sm text-gray-500">今日の合計</p>
          <p id="cost-today" class="text-3xl font-bold text-gray-900">$-</p>
        </div>
        <div class="bg-white rounded-xl shadow p-6">
          <p class="text-sm text-gray-500">今月の合計</p>
          <p id="cost-month" class="text-3xl font-bold text-indigo-600">$-</p>
        </div>
        <div class="bg-white rounded-xl shadow p-6">
          <p class="text-sm text-gray-500">OpenAI（今月）</p>
          <p id="cost-openai-month" class="text-3xl font-bold text-green-600">$-</p>
        </div>
        <div class="bg-white rounded-xl shadow p-6">
          <p class="text-sm text-gray-500">Firecrawl（今月）</p>
          <p id="cost-firecrawl-month" class="text-3xl font-bold text-orange-600">$-</p>
        </div>
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
          const data = await api('/api/admin/costs');
          if (!data.success) throw new Error(data.error?.message);

          const { openai, firecrawl, daily, totals } = data.data;

          // 概要
          const todayTotal = (totals.openai?.today || 0) + (totals.firecrawl?.today || 0);
          const monthTotal = (totals.openai?.month || 0) + (totals.firecrawl?.month || 0);
          document.getElementById('cost-today').textContent = '$' + todayTotal.toFixed(2);
          document.getElementById('cost-month').textContent = '$' + monthTotal.toFixed(2);
          document.getElementById('cost-openai-month').textContent = '$' + (totals.openai?.month || 0).toFixed(2);
          document.getElementById('cost-firecrawl-month').textContent = '$' + (totals.firecrawl?.month || 0).toFixed(2);

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
          const data = await api('/api/admin/updates');
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

          setStep('ops-step-freshness', 'ok', '（Coverage内）');

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
          if (typeof window.runAllChecks === 'function') {
            window.runAllChecks().catch(function(err) {
              console.error('[OPS] Initial check failed:', err);
            });
          }
        }, 100);
      })();

      async function loadCoverageData() {
        try {
          const data = await api('/api/admin/coverage');
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
          const freshnessData = await api('/api/admin/data-freshness');
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
          const data = await api('/api/admin/dashboard');
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
    </script>
  `;

  return c.html(adminLayout('運用チェック', content, 'ops'));
});

export default adminPages;

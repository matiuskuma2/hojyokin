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
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .stat-card { transition: all 0.3s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
    .loading { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <!-- Navigation -->
  <nav class="bg-indigo-900 text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-4">
          <a href="/admin" class="flex items-center gap-2">
            <img src="/static/images/icon.png" alt="ホジョラク" class="h-8">
            <span class="text-xl font-bold">管理画面</span>
          </a>
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
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span id="user-role" class="px-2 py-1 text-xs font-medium rounded-full bg-purple-600"></span>
          <span id="user-name" class="text-sm"></span>
          <a href="/dashboard" class="text-sm hover:text-indigo-200">
            <i class="fas fa-arrow-left mr-1"></i>ユーザー画面
          </a>
          <button onclick="logout()" class="text-sm hover:text-indigo-200">
            <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    ${content}
  </main>

  <script>
    // ============================================================
    // 共通初期化スクリプト
    // ============================================================
    (function() {
      'use strict';
      
      var token = localStorage.getItem('token');
      var userStr = localStorage.getItem('user');
      var user = null;
      
      try {
        user = userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        console.error('ユーザー情報のパースエラー:', e);
        user = null;
      }
      
      if (!token || !user) {
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
      
      // super_admin のみコストタブを表示
      if (user.role === 'super_admin') {
        var navCosts = document.getElementById('nav-costs');
        if (navCosts) {
          navCosts.classList.remove('hidden');
        }
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

export default adminPages;

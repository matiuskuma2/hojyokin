/**
 * Agency（士業）ページ
 * 
 * /agency - ダッシュボード
 * /agency/clients - 顧客一覧
 * /agency/clients/:id - 顧客詳細
 * /agency/links - リンク管理
 * /agency/submissions - 入力受付一覧
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const agencyPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// 共通レイアウト
const agencyLayout = (title: string, content: string, activeTab: string = '') => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ホジョラク 士業向け</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .stat-card { transition: all 0.3s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
    .client-card { transition: all 0.2s; }
    .client-card:hover { background-color: #f9fafb; }
    .loading { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
  <script>
    // ============================================================
    // 【重要】window.apiCall を head で最初に定義
    // content 内のスクリプトより先に実行される
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
      
      // 認証チェック（遅延実行）
      if (!token || !user) {
        window.location.href = '/login';
        return;
      }
      
      if (user.role !== 'agency') {
        alert('士業アカウントが必要です');
        window.location.href = '/dashboard';
        return;
      }
      
      // グローバルAPI呼び出しヘルパー（head で定義）
      // 凍結仕様v1: window.api と window.apiCall を両方定義（User版との統一）
      window.apiCall = async function(endpoint, options) {
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
          var res = await fetch(endpoint, fetchOptions);
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
      
      // ユーザー情報をグローバルに保存
      window.currentUser = user;
      window.currentToken = token;
      
      // 凍結仕様v1: User版との統一のため window.api も定義（alias）
      window.api = window.apiCall;
    })();
  </script>
</head>
<body class="bg-gray-100 min-h-screen">
  <!-- Navigation -->
  <nav class="bg-emerald-800 text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-4">
          <a href="/agency" class="flex items-center gap-2">
            <img src="/static/images/icon.png" alt="ホジョラク" class="h-8">
            <span class="text-xl font-bold">ホジョラク</span>
            <span class="text-sm bg-emerald-600 px-2 py-0.5 rounded">士業向け</span>
          </a>
          <div class="hidden md:flex gap-1 ml-8">
            <a href="/agency" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'dashboard' ? 'bg-emerald-700' : 'hover:bg-emerald-700'}">
              <i class="fas fa-chart-pie mr-1"></i>ダッシュボード
            </a>
            <a href="/agency/clients" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'clients' ? 'bg-emerald-700' : 'hover:bg-emerald-700'}">
              <i class="fas fa-building mr-1"></i>顧客企業
            </a>
            <a href="/agency/links" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'links' ? 'bg-emerald-700' : 'hover:bg-emerald-700'}">
              <i class="fas fa-link mr-1"></i>リンク管理
            </a>
            <a href="/agency/submissions" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'submissions' ? 'bg-emerald-700' : 'hover:bg-emerald-700'}">
              <i class="fas fa-inbox mr-1"></i>受付
              <span id="pending-badge" class="hidden ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">0</span>
            </a>
            <a href="/agency/members" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'members' ? 'bg-emerald-700' : 'hover:bg-emerald-700'}">
              <i class="fas fa-users mr-1"></i>スタッフ
            </a>
            <a href="/agency/search" class="px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'search' ? 'bg-emerald-700' : 'hover:bg-emerald-700'}">
              <i class="fas fa-search mr-1"></i>補助金検索
            </a>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <a href="/agency/settings" id="agency-name" class="text-sm hover:text-emerald-200 cursor-pointer" title="事務所設定"></a>
          <a href="/agency/settings" id="user-name" class="text-sm text-emerald-200 hover:text-white cursor-pointer" title="アカウント設定"></a>
          <button onclick="logout()" class="text-sm hover:text-emerald-200">
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
    // DOM読み込み後の初期化（apiCallはheadで定義済み）
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
      // ユーザー名表示
      var user = window.currentUser;
      if (user) {
        var userNameEl = document.getElementById('user-name');
        if (userNameEl) {
          userNameEl.textContent = user.name || user.email || '';
        }
      }
      
      // Agency情報取得
      if (window.apiCall) {
        window.apiCall('/api/agency/me').then(function(data) {
          if (data && data.success && data.data && data.data.agency) {
            var agencyNameEl = document.getElementById('agency-name');
            if (agencyNameEl) {
              agencyNameEl.textContent = data.data.agency.name || '';
            }
          }
        });
        
        // 未処理件数取得
        window.apiCall('/api/agency/submissions?status=submitted').then(function(data) {
          if (data && data.success && data.data && data.data.submissions && data.data.submissions.length > 0) {
            var badge = document.getElementById('pending-badge');
            if (badge) {
              badge.textContent = data.data.submissions.length;
              badge.classList.remove('hidden');
            }
          }
        });
      }
    });
  </script>
</body>
</html>
`;

/**
 * GET /agency - ダッシュボード v2（情報の泉型）
 * 
 * 構成:
 * - 上段: KPI（今日のアクティビティ）
 * - 中段上: NEWSフィード（カテゴリ別タブ）
 * - 中段下: 顧客おすすめ（サジェスト）
 * - 下段: 未処理タスク + クイックアクション
 */
agencyPages.get('/agency', (c) => {
  const content = `
    <style>
      .news-tab { transition: all 0.2s; }
      .news-tab.active { background-color: #059669; color: white; }
      .news-tab:not(.active):hover { background-color: #d1fae5; }
      .news-card { transition: all 0.2s; }
      .news-card:hover { background-color: #f9fafb; }
      .suggestion-card { transition: all 0.3s; }
      .suggestion-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
      .task-badge { animation: pulse 2s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      .tap-target { min-height: 44px; }
      .event-badge-new { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
      .event-badge-updated { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
      .event-badge-closing { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
      .event-badge-alert { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
      .event-badge-info { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
      /* Mobile compact styles */
      @media (max-width: 640px) {
        .news-scroll { max-height: 300px; overflow-y: auto; }
        .suggestion-scroll { max-height: 400px; overflow-y: auto; }
      }
    </style>
    
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">
          <i class="fas fa-tachometer-alt mr-2 text-emerald-600"></i>ダッシュボード
        </h1>
        <div class="text-sm text-gray-500">
          <i class="fas fa-sync-alt mr-1"></i>
          <span id="last-updated">-</span>
        </div>
      </div>
      
      <!-- ===== KPI Section ===== -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500">顧客企業</p>
              <p id="kpi-clients" class="text-xl font-bold text-gray-900 loading">-</p>
            </div>
            <i class="fas fa-building text-emerald-500 text-lg"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500">今日の検索</p>
              <p id="kpi-searches" class="text-xl font-bold text-blue-600 loading">-</p>
            </div>
            <i class="fas fa-search text-blue-500 text-lg"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500">今日の壁打ち</p>
              <p id="kpi-chats" class="text-xl font-bold text-purple-600 loading">-</p>
            </div>
            <i class="fas fa-comments text-purple-500 text-lg"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500">今日のドラフト</p>
              <p id="kpi-drafts" class="text-xl font-bold text-orange-600 loading">-</p>
            </div>
            <i class="fas fa-file-alt text-orange-500 text-lg"></i>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500">未処理タスク</p>
              <p id="kpi-tasks" class="text-xl font-bold text-red-600 loading">-</p>
            </div>
            <i class="fas fa-tasks text-red-500 text-lg"></i>
          </div>
        </div>
      </div>
      
      <!-- ===== NEWS Feed Section ===== -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            <i class="fas fa-newspaper mr-2 text-blue-500"></i>NEWSフィード
          </h2>
          <span class="text-xs text-gray-500">顧客所在地の情報を優先表示</span>
        </div>
        
        <!-- News Category Tabs -->
        <div class="flex flex-wrap border-b px-2 pt-2 gap-1">
          <button onclick="showNewsTab('platform')" id="news-tab-platform" class="news-tab px-3 py-2 text-sm font-medium rounded-t-lg active tap-target">
            <i class="fas fa-bullhorn mr-1"></i><span class="hidden sm:inline">プラットフォーム</span><span class="sm:hidden">PF</span>
            <span id="news-count-platform" class="ml-1 text-xs bg-white/20 px-1.5 rounded">0</span>
          </button>
          <button onclick="showNewsTab('support_info')" id="news-tab-support_info" class="news-tab px-3 py-2 text-sm font-medium rounded-t-lg tap-target">
            <i class="fas fa-plus-circle mr-1"></i><span class="hidden sm:inline">新着支援</span><span class="sm:hidden">新着</span>
            <span id="news-count-support_info" class="ml-1 text-xs bg-gray-200 px-1.5 rounded">0</span>
          </button>
          <button onclick="showNewsTab('prefecture')" id="news-tab-prefecture" class="news-tab px-3 py-2 text-sm font-medium rounded-t-lg tap-target">
            <i class="fas fa-map-marker-alt mr-1"></i><span class="hidden sm:inline">都道府県</span><span class="sm:hidden">県</span>
            <span id="news-count-prefecture" class="ml-1 text-xs bg-gray-200 px-1.5 rounded">0</span>
          </button>
          <button onclick="showNewsTab('ministry')" id="news-tab-ministry" class="news-tab px-3 py-2 text-sm font-medium rounded-t-lg tap-target">
            <i class="fas fa-landmark mr-1"></i><span class="hidden sm:inline">省庁</span><span class="sm:hidden">省</span>
            <span id="news-count-ministry" class="ml-1 text-xs bg-gray-200 px-1.5 rounded">0</span>
          </button>
          <button onclick="showNewsTab('other_public')" id="news-tab-other_public" class="news-tab px-3 py-2 text-sm font-medium rounded-t-lg tap-target">
            <i class="fas fa-university mr-1"></i><span class="hidden sm:inline">その他機関</span><span class="sm:hidden">他</span>
            <span id="news-count-other_public" class="ml-1 text-xs bg-gray-200 px-1.5 rounded">0</span>
          </button>
        </div>
        
        <!-- News Content -->
        <div id="news-content" class="p-4 news-scroll">
          <div class="text-center py-8 text-gray-500">
            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
            <p>読み込み中...</p>
          </div>
        </div>
      </div>
      
      <!-- ===== Suggestions Section ===== -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            <i class="fas fa-lightbulb mr-2 text-yellow-500"></i>顧客おすすめ補助金
          </h2>
          <a href="/agency/search" class="text-sm text-emerald-600 hover:text-emerald-700">
            <i class="fas fa-search mr-1"></i>補助金検索へ
          </a>
        </div>
        <div id="suggestions-content" class="p-4 suggestion-scroll">
          <div class="text-center py-8 text-gray-500">
            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
            <p>読み込み中...</p>
          </div>
        </div>
      </div>
      
      <!-- ===== Tasks & Quick Actions Section ===== -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Pending Tasks -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-4 border-b flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">
              <i class="fas fa-tasks mr-2 text-red-500"></i>未処理タスク
            </h2>
            <span id="tasks-total" class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium task-badge">0件</span>
          </div>
          <div id="tasks-content" class="p-4">
            <div class="space-y-4">
              <!-- 承認待ち -->
              <div>
                <h3 class="text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-inbox text-orange-500 mr-1"></i>承認待ち入力
                </h3>
                <div id="tasks-intakes" class="space-y-2">
                  <p class="text-sm text-gray-500">なし</p>
                </div>
              </div>
              <!-- 期限間近リンク -->
              <div>
                <h3 class="text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-clock text-yellow-500 mr-1"></i>期限間近リンク
                </h3>
                <div id="tasks-links" class="space-y-2">
                  <p class="text-sm text-gray-500">なし</p>
                </div>
              </div>
              <!-- 進行中ドラフト -->
              <div>
                <h3 class="text-sm font-medium text-gray-700 mb-2">
                  <i class="fas fa-edit text-blue-500 mr-1"></i>進行中ドラフト
                </h3>
                <div id="tasks-drafts" class="space-y-2">
                  <p class="text-sm text-gray-500">なし</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-4 border-b">
            <h2 class="text-lg font-semibold text-gray-900">
              <i class="fas fa-bolt mr-2 text-yellow-500"></i>クイックアクション
            </h2>
          </div>
          <div class="p-4 space-y-3">
            <a href="/agency/clients?action=add" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-emerald-50 transition tap-target">
              <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <i class="fas fa-plus text-emerald-600"></i>
              </div>
              <div>
                <p class="font-medium text-gray-900">顧客を追加</p>
                <p class="text-sm text-gray-500">新しい顧客企業を登録</p>
              </div>
            </a>
            
            <a href="/agency/search" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-blue-50 transition tap-target">
              <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <i class="fas fa-search text-blue-600"></i>
              </div>
              <div>
                <p class="font-medium text-gray-900">補助金を検索</p>
                <p class="text-sm text-gray-500">顧客に合う補助金を探す</p>
              </div>
            </a>
            
            <a href="/agency/links" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-purple-50 transition tap-target">
              <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <i class="fas fa-link text-purple-600"></i>
              </div>
              <div>
                <p class="font-medium text-gray-900">リンクを発行</p>
                <p class="text-sm text-gray-500">顧客に入力リンクを送る</p>
              </div>
            </a>
            
            <a href="/agency/submissions" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-orange-50 transition tap-target">
              <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <i class="fas fa-inbox text-orange-600"></i>
              </div>
              <div>
                <p class="font-medium text-gray-900">受付を確認</p>
                <p class="text-sm text-gray-500">顧客からの入力を処理</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      // ============================================================
      // Dashboard v2 - 情報の泉型
      // ============================================================
      
      let dashboardData = null;
      let currentNewsTab = 'platform';
      const prefectureNames = {
        '01': '北海道', '02': '青森', '03': '岩手', '04': '宮城', '05': '秋田',
        '06': '山形', '07': '福島', '08': '茨城', '09': '栃木', '10': '群馬',
        '11': '埼玉', '12': '千葉', '13': '東京', '14': '神奈川', '15': '新潟',
        '16': '富山', '17': '石川', '18': '福井', '19': '山梨', '20': '長野',
        '21': '岐阜', '22': '静岡', '23': '愛知', '24': '三重', '25': '滋賀',
        '26': '京都', '27': '大阪', '28': '兵庫', '29': '奈良', '30': '和歌山',
        '31': '鳥取', '32': '島根', '33': '岡山', '34': '広島', '35': '山口',
        '36': '徳島', '37': '香川', '38': '愛媛', '39': '高知', '40': '福岡',
        '41': '佐賀', '42': '長崎', '43': '熊本', '44': '大分', '45': '宮崎',
        '46': '鹿児島', '47': '沖縄', '00': '全国'
      };
      
      // HTMLエスケープ
      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }
      
      // 日付フォーマット
      function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      }
      
      function formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      
      // イベントタイプバッジ
      function getEventBadge(eventType) {
        const config = {
          'new': { icon: 'fa-star', label: '新規', class: 'event-badge-new' },
          'updated': { icon: 'fa-sync-alt', label: '更新', class: 'event-badge-updated' },
          'closing': { icon: 'fa-clock', label: '締切間近', class: 'event-badge-closing' },
          'alert': { icon: 'fa-exclamation-triangle', label: '重要', class: 'event-badge-alert' },
          'info': { icon: 'fa-info-circle', label: 'お知らせ', class: 'event-badge-info' }
        };
        const c = config[eventType] || config['info'];
        return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs text-white ' + c.class + '"><i class="fas ' + c.icon + ' mr-1"></i>' + c.label + '</span>';
      }
      
      // ステータスバッジ（サジェスト用）
      function getStatusBadge(status, score) {
        const config = {
          'PROCEED': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: 'fa-check-circle', label: '推奨' },
          'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: 'fa-exclamation-triangle', label: '注意' },
          'NO': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'fa-times-circle', label: '非推奨' }
        };
        const c = config[status] || config['CAUTION'];
        return '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' + c.bg + ' ' + c.text + '"><i class="fas ' + c.icon + ' mr-1"></i>' + c.label + (score ? ' ' + score + '%' : '') + '</span>';
      }
      
      // ダッシュボードデータ取得
      async function loadDashboard() {
        try {
          const data = await apiCall('/api/agency/dashboard-v2');
          
          if (!data.success) {
            console.error('Dashboard API error:', data.error);
            showError('ダッシュボードの読み込みに失敗しました');
            return;
          }
          
          dashboardData = data.data;
          
          // KPI更新
          updateKPI();
          
          // NEWSフィード更新
          updateNewsTabCounts();
          showNewsTab(currentNewsTab);
          
          // サジェスト更新
          updateSuggestions();
          
          // タスク更新
          updateTasks();
          
          // 最終更新時刻
          document.getElementById('last-updated').textContent = 
            new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) + ' 更新';
          
        } catch (e) {
          console.error('loadDashboard error:', e);
          showError('ダッシュボードの読み込み中にエラーが発生しました');
        }
      }
      
      function showError(message) {
        document.getElementById('news-content').innerHTML = 
          '<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle text-2xl mb-2"></i><p>' + escapeHtml(message) + '</p></div>';
      }
      
      // KPI更新
      function updateKPI() {
        if (!dashboardData) return;
        
        const kpi = dashboardData.kpi || {};
        const stats = dashboardData.stats || {};
        const tasks = dashboardData.tasks || {};
        
        const totalTasks = (tasks.pending_intakes?.length || 0) + 
                          (tasks.expiring_links?.length || 0) + 
                          (tasks.drafts_in_progress?.length || 0);
        
        document.getElementById('kpi-clients').textContent = stats.totalClients || 0;
        document.getElementById('kpi-clients').classList.remove('loading');
        
        document.getElementById('kpi-searches').textContent = kpi.today_search_count || 0;
        document.getElementById('kpi-searches').classList.remove('loading');
        
        document.getElementById('kpi-chats').textContent = kpi.today_chat_count || 0;
        document.getElementById('kpi-chats').classList.remove('loading');
        
        document.getElementById('kpi-drafts').textContent = kpi.today_draft_count || 0;
        document.getElementById('kpi-drafts').classList.remove('loading');
        
        document.getElementById('kpi-tasks').textContent = totalTasks;
        document.getElementById('kpi-tasks').classList.remove('loading');
      }
      
      // NEWSタブカウント更新
      function updateNewsTabCounts() {
        if (!dashboardData || !dashboardData.news) return;
        
        const news = dashboardData.news;
        document.getElementById('news-count-platform').textContent = (news.platform || []).length;
        document.getElementById('news-count-support_info').textContent = (news.support_info || []).length;
        document.getElementById('news-count-prefecture').textContent = (news.prefecture || []).length;
        document.getElementById('news-count-ministry').textContent = (news.ministry || []).length;
        document.getElementById('news-count-other_public').textContent = (news.other_public || []).length;
      }
      
      // NEWSタブ切替
      window.showNewsTab = function(tabName) {
        currentNewsTab = tabName;
        
        // タブ状態更新
        document.querySelectorAll('.news-tab').forEach(tab => {
          tab.classList.remove('active');
          const countSpan = tab.querySelector('span[id^="news-count-"]');
          if (countSpan) {
            countSpan.classList.remove('bg-white/20');
            countSpan.classList.add('bg-gray-200');
          }
        });
        
        const activeTab = document.getElementById('news-tab-' + tabName);
        if (activeTab) {
          activeTab.classList.add('active');
          const countSpan = activeTab.querySelector('span[id^="news-count-"]');
          if (countSpan) {
            countSpan.classList.remove('bg-gray-200');
            countSpan.classList.add('bg-white/20');
          }
        }
        
        // コンテンツ更新
        renderNewsContent(tabName);
      };
      
      // NEWSコンテンツ描画
      function renderNewsContent(tabName) {
        const container = document.getElementById('news-content');
        if (!dashboardData || !dashboardData.news) {
          container.innerHTML = '<p class="text-center text-gray-500 py-4">データがありません</p>';
          return;
        }
        
        const items = dashboardData.news[tabName] || [];
        
        if (items.length === 0) {
          container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-3xl mb-2"></i><p>新着情報はありません</p></div>';
          return;
        }
        
        const html = items.map(item => {
          const eventBadge = item.event_type ? getEventBadge(item.event_type) : '';
          const isClientArea = item.is_client_area ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700"><i class="fas fa-star mr-1"></i>顧客エリア</span>' : '';
          const prefBadge = item.region_prefecture ? '<span class="text-xs text-gray-500">' + (prefectureNames[item.region_prefecture] || item.region_prefecture) + '</span>' : '';
          
          return '<div class="news-card p-3 border-b last:border-b-0 tap-target">' +
            '<div class="flex items-start justify-between gap-2">' +
              '<div class="flex-1 min-w-0">' +
                '<div class="flex flex-wrap items-center gap-2 mb-1">' +
                  eventBadge + isClientArea + prefBadge +
                '</div>' +
                '<a href="' + (item.url || '#') + '" target="_blank" class="font-medium text-gray-900 hover:text-emerald-600 line-clamp-2 block">' +
                  escapeHtml(item.title) +
                '</a>' +
                (item.summary ? '<p class="text-sm text-gray-600 mt-1 line-clamp-2">' + escapeHtml(item.summary) + '</p>' : '') +
              '</div>' +
              '<div class="text-xs text-gray-400 whitespace-nowrap">' +
                formatDate(item.published_at || item.detected_at) +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
        
        container.innerHTML = html;
      }
      
      // サジェスト更新
      function updateSuggestions() {
        const container = document.getElementById('suggestions-content');
        if (!dashboardData) return;
        
        const suggestions = dashboardData.suggestions || [];
        
        if (suggestions.length === 0) {
          container.innerHTML = 
            '<div class="text-center py-8">' +
              '<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">' +
                '<i class="fas fa-lightbulb text-gray-400 text-2xl"></i>' +
              '</div>' +
              '<p class="text-gray-600 font-medium">おすすめ補助金はまだありません</p>' +
              '<p class="text-sm text-gray-500 mt-1">顧客情報を登録すると、AIが最適な補助金を提案します</p>' +
              '<a href="/agency/clients" class="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">' +
                '<i class="fas fa-plus mr-1"></i>顧客を登録' +
              '</a>' +
            '</div>';
          return;
        }
        
        // 顧客ごとにグルーピング
        const byClient = {};
        suggestions.forEach(s => {
          const key = s.agency_client_id;
          if (!byClient[key]) {
            byClient[key] = {
              client_name: s.client_name,
              company_name: s.company_name,
              prefecture: s.prefecture,
              company_id: s.company_id,
              items: []
            };
          }
          byClient[key].items.push(s);
        });
        
        const html = Object.entries(byClient).map(([clientId, client]) => {
          const prefName = prefectureNames[client.prefecture] || client.prefecture || '-';
          
          const itemsHtml = client.items.slice(0, 3).map((s, idx) => {
            const statusBadge = getStatusBadge(s.status, s.score);
            const deadline = s.subsidy_deadline ? new Date(s.subsidy_deadline) : null;
            const daysLeft = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const deadlineClass = daysLeft !== null && daysLeft <= 7 ? 'text-red-600 font-bold' : 'text-gray-600';
            
            const reasons = (s.match_reasons || []).slice(0, 2).map(r => 
              '<span class="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs"><i class="fas fa-check text-xs mr-1"></i>' + escapeHtml(r) + '</span>'
            ).join(' ');
            
            return '<a href="/subsidies/' + (s.subsidy_id || '') + '?company_id=' + (client.company_id || '') + '&from=agency&back=/agency" ' +
              'class="block p-3 border rounded-lg hover:border-emerald-300 hover:bg-emerald-50/30 transition tap-target">' +
              '<div class="flex items-start justify-between gap-2">' +
                '<div class="flex-1 min-w-0">' +
                  '<div class="flex items-center gap-2 mb-1">' +
                    '<span class="text-xs text-gray-400">#' + (idx + 1) + '</span>' +
                    statusBadge +
                  '</div>' +
                  '<p class="font-medium text-gray-900 line-clamp-1">' + escapeHtml(s.subsidy_title || '補助金') + '</p>' +
                  '<div class="flex flex-wrap gap-1 mt-1">' + reasons + '</div>' +
                '</div>' +
                '<div class="text-right text-sm">' +
                  '<p class="' + deadlineClass + '">' + 
                    (deadline ? formatDate(s.subsidy_deadline) : '-') +
                    (daysLeft !== null && daysLeft <= 14 ? '<br><span class="text-xs">あと' + daysLeft + '日</span>' : '') +
                  '</p>' +
                  (s.subsidy_max_limit ? '<p class="text-xs text-emerald-600 mt-1">〜' + (s.subsidy_max_limit / 10000).toLocaleString() + '万円</p>' : '') +
                '</div>' +
              '</div>' +
            '</a>';
          }).join('');
          
          return '<div class="suggestion-card bg-gray-50 rounded-lg p-4 mb-4">' +
            '<div class="flex items-center justify-between mb-3">' +
              '<div class="flex items-center gap-2">' +
                '<div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">' +
                  '<i class="fas fa-building text-emerald-600 text-sm"></i>' +
                '</div>' +
                '<div>' +
                  '<p class="font-medium text-gray-900">' + escapeHtml(client.client_name || client.company_name) + '</p>' +
                  '<p class="text-xs text-gray-500">' + prefName + '</p>' +
                '</div>' +
              '</div>' +
              '<a href="/agency/search?company_id=' + (client.company_id || '') + '" class="text-xs text-emerald-600 hover:text-emerald-700">' +
                '<i class="fas fa-search mr-1"></i>もっと探す' +
              '</a>' +
            '</div>' +
            '<div class="space-y-2">' + itemsHtml + '</div>' +
          '</div>';
        }).join('');
        
        container.innerHTML = html;
      }
      
      // タスク更新
      function updateTasks() {
        if (!dashboardData || !dashboardData.tasks) return;
        
        const tasks = dashboardData.tasks;
        const totalTasks = (tasks.pending_intakes?.length || 0) + 
                          (tasks.expiring_links?.length || 0) + 
                          (tasks.drafts_in_progress?.length || 0);
        
        document.getElementById('tasks-total').textContent = totalTasks + '件';
        if (totalTasks === 0) {
          document.getElementById('tasks-total').classList.remove('task-badge', 'bg-red-100', 'text-red-700');
          document.getElementById('tasks-total').classList.add('bg-gray-100', 'text-gray-700');
        }
        
        // 承認待ち入力
        const intakesContainer = document.getElementById('tasks-intakes');
        if (tasks.pending_intakes && tasks.pending_intakes.length > 0) {
          intakesContainer.innerHTML = tasks.pending_intakes.map(t => 
            '<a href="/agency/submissions" class="flex items-center justify-between p-2 border rounded hover:bg-orange-50 tap-target">' +
              '<span class="text-sm font-medium truncate">' + escapeHtml(t.client_name || '顧客') + '</span>' +
              '<span class="text-xs text-gray-500">' + formatDate(t.submitted_at) + '</span>' +
            '</a>'
          ).join('');
        } else {
          intakesContainer.innerHTML = '<p class="text-sm text-gray-500">なし</p>';
        }
        
        // 期限間近リンク
        const linksContainer = document.getElementById('tasks-links');
        if (tasks.expiring_links && tasks.expiring_links.length > 0) {
          linksContainer.innerHTML = tasks.expiring_links.map(t => {
            const expires = new Date(t.expires_at);
            const daysLeft = Math.ceil((expires - new Date()) / (1000 * 60 * 60 * 24));
            return '<a href="/agency/links" class="flex items-center justify-between p-2 border rounded hover:bg-yellow-50 tap-target">' +
              '<span class="text-sm font-medium truncate">' + escapeHtml(t.client_name || t.purpose || 'リンク') + '</span>' +
              '<span class="text-xs ' + (daysLeft <= 3 ? 'text-red-600 font-bold' : 'text-yellow-600') + '">あと' + daysLeft + '日</span>' +
            '</a>';
          }).join('');
        } else {
          linksContainer.innerHTML = '<p class="text-sm text-gray-500">なし</p>';
        }
        
        // 進行中ドラフト
        const draftsContainer = document.getElementById('tasks-drafts');
        if (tasks.drafts_in_progress && tasks.drafts_in_progress.length > 0) {
          draftsContainer.innerHTML = tasks.drafts_in_progress.map(t => 
            '<div class="flex items-center justify-between p-2 border rounded tap-target">' +
              '<span class="text-sm font-medium truncate">' + escapeHtml(t.client_name || t.company_name || 'ドラフト') + '</span>' +
              '<span class="text-xs text-gray-500">' + formatDate(t.updated_at) + '</span>' +
            '</div>'
          ).join('');
        } else {
          draftsContainer.innerHTML = '<p class="text-sm text-gray-500">なし</p>';
        }
      }
      
      // 初期化
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDashboard);
      } else {
        if (typeof window.apiCall === 'function') {
          loadDashboard();
        } else {
          setTimeout(loadDashboard, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('ダッシュボード', content, 'dashboard'));
});

/**
 * GET /agency/clients - 顧客一覧
 */
agencyPages.get('/agency/clients', (c) => {
  const content = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">
          <i class="fas fa-building mr-2"></i>顧客企業
        </h1>
        <div class="flex gap-2">
          <button onclick="showCsvImportModal()" class="border border-emerald-600 text-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50 transition">
            <i class="fas fa-file-csv mr-2"></i>CSVインポート
          </button>
          <button onclick="showAddClientModal()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            <i class="fas fa-plus mr-2"></i>顧客を追加
          </button>
        </div>
      </div>
      
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="text" id="search-input" placeholder="検索（会社名・担当者名）" 
            class="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
          <select id="status-filter" class="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500">
            <option value="">すべてのステータス</option>
            <option value="active">アクティブ</option>
            <option value="paused">一時停止</option>
            <option value="archived">アーカイブ</option>
          </select>
          <button onclick="loadClients()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
      
      <!-- Client List -->
      <div id="client-list" class="space-y-4">
        <p class="text-gray-500 loading">読み込み中...</p>
      </div>
    </div>
    
    <!-- Add Client Modal -->
    <div id="add-client-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div class="p-6">
          <h2 class="text-xl font-bold mb-4">新規顧客追加</h2>
          <form id="add-client-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">顧客名/担当者名 *</label>
              <input type="text" name="clientName" required class="w-full border rounded-lg px-3 py-2">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">会社名 *</label>
              <input type="text" name="companyName" required class="w-full border rounded-lg px-3 py-2">
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input type="email" name="clientEmail" class="w-full border rounded-lg px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                <input type="tel" name="clientPhone" class="w-full border rounded-lg px-3 py-2">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">都道府県 <span class="text-red-500">*</span></label>
                <select name="prefecture" id="add-client-prefecture" required class="w-full border rounded-lg px-3 py-2">
                  <option value="">選択してください</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">業種 <span class="text-red-500">*</span></label>
                <select name="industry" id="add-client-industry" required class="w-full border rounded-lg px-3 py-2">
                  <option value="">選択してください</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">従業員数 <span class="text-red-500">*</span></label>
              <input type="number" name="employeeCount" id="add-client-employees" required min="1" class="w-full border rounded-lg px-3 py-2" placeholder="例: 10">
              <p class="text-xs text-gray-500 mt-1">補助金マッチングの精度向上のため必須です</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea name="notes" rows="2" class="w-full border rounded-lg px-3 py-2"></textarea>
            </div>
            <div class="flex gap-2 pt-4">
              <button type="button" onclick="hideAddClientModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button type="submit" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                追加
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- CSV Import Modal -->
    <div id="csv-import-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">CSVインポート</h2>
            <button onclick="hideCsvImportModal()" class="text-gray-500 hover:text-gray-700">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          
          <!-- テンプレート説明 -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 class="font-semibold text-blue-800 mb-2">
              <i class="fas fa-info-circle mr-1"></i>CSVフォーマット
            </h3>
            <p class="text-sm text-blue-700 mb-2">以下の列順序でCSVファイルを作成してください：</p>
            <div class="bg-white rounded p-2 font-mono text-xs overflow-x-auto">
              顧客名, 会社名, メール, 電話, 都道府県, 業種, 従業員数, 備考
            </div>
            <p class="text-xs text-blue-600 mt-2">
              ※「顧客名」と「会社名」は必須です。その他は任意です。
            </p>
            <a href="/api/agency/clients/import-template" download class="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline">
              <i class="fas fa-download mr-1"></i>テンプレートをダウンロード
            </a>
          </div>
          
          <form id="csv-import-form" class="space-y-4">
            <!-- ファイル選択 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">CSVファイルを選択</label>
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-500 transition cursor-pointer"
                   onclick="document.getElementById('csv-file-input').click()">
                <input type="file" id="csv-file-input" accept=".csv,text/csv" class="hidden" onchange="handleCsvFileSelect(event)">
                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                <p id="csv-file-name" class="text-gray-600">クリックしてファイルを選択</p>
                <p class="text-xs text-gray-500 mt-1">または、CSVファイルをドラッグ&ドロップ</p>
              </div>
            </div>
            
            <!-- テキストエリア（直接入力） -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">または、CSVデータを直接入力</label>
              <textarea id="csv-data-input" rows="6" 
                class="w-full border rounded-lg px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="顧客名,会社名,メール,電話,都道府県,業種,従業員数,備考&#10;山田太郎,株式会社サンプル,yamada@example.com,03-1234-5678,東京都,製造業,50,重要顧客"></textarea>
            </div>
            
            <!-- オプション -->
            <div class="space-y-2">
              <label class="flex items-center gap-2">
                <input type="checkbox" id="csv-skip-header" checked class="rounded text-emerald-600 focus:ring-emerald-500">
                <span class="text-sm text-gray-700">1行目をヘッダーとして無視する</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" id="csv-update-existing" class="rounded text-emerald-600 focus:ring-emerald-500">
                <span class="text-sm text-gray-700">同じ会社名の既存顧客を更新する</span>
              </label>
            </div>
            
            <!-- プレビュー -->
            <div id="csv-preview" class="hidden">
              <label class="block text-sm font-medium text-gray-700 mb-1">プレビュー（最初の5件）</label>
              <div class="border rounded-lg overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left">顧客名</th>
                      <th class="px-3 py-2 text-left">会社名</th>
                      <th class="px-3 py-2 text-left">メール</th>
                      <th class="px-3 py-2 text-left">都道府県</th>
                      <th class="px-3 py-2 text-left">業種</th>
                      <th class="px-3 py-2 text-left">従業員数</th>
                    </tr>
                  </thead>
                  <tbody id="csv-preview-body" class="divide-y divide-gray-200">
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- 結果表示 -->
            <div id="csv-import-result" class="hidden">
              <div id="csv-result-success" class="hidden p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <h4 class="font-semibold text-emerald-800 mb-2">
                  <i class="fas fa-check-circle mr-1"></i>インポート完了
                </h4>
                <p id="csv-result-message" class="text-sm text-emerald-700"></p>
              </div>
              <div id="csv-result-errors" class="hidden mt-2 p-4 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                <h4 class="font-semibold text-red-800 mb-2">
                  <i class="fas fa-exclamation-circle mr-1"></i>エラー
                </h4>
                <ul id="csv-error-list" class="text-sm text-red-700 space-y-1"></ul>
              </div>
            </div>
            
            <div class="flex gap-2 pt-4">
              <button type="button" onclick="hideCsvImportModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                閉じる
              </button>
              <button type="submit" id="csv-import-btn" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                <i class="fas fa-upload mr-2"></i>インポート
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <script>
      let clients = [];
      let csvData = '';
      
      // CSV関連関数
      function showCsvImportModal() {
        document.getElementById('csv-import-modal').classList.remove('hidden');
        // リセット
        document.getElementById('csv-data-input').value = '';
        document.getElementById('csv-file-name').textContent = 'クリックしてファイルを選択';
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('csv-import-result').classList.add('hidden');
        csvData = '';
      }
      
      function hideCsvImportModal() {
        document.getElementById('csv-import-modal').classList.add('hidden');
      }
      
      function handleCsvFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        document.getElementById('csv-file-name').textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
          csvData = e.target.result;
          document.getElementById('csv-data-input').value = csvData;
          updateCsvPreview();
        };
        reader.readAsText(file, 'UTF-8');
      }
      
      function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          if (inQuotes) {
            if (char === '"') {
              if (nextChar === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = false;
              }
            } else {
              current += char;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
            } else if (char === ',') {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
        }
        result.push(current.trim());
        return result;
      }
      
      function updateCsvPreview() {
        const input = document.getElementById('csv-data-input').value.trim();
        const skipHeader = document.getElementById('csv-skip-header').checked;
        
        if (!input) {
          document.getElementById('csv-preview').classList.add('hidden');
          return;
        }
        
        const lines = input.split(/\\r?\\n/).filter(l => l.trim());
        const dataLines = skipHeader ? lines.slice(1) : lines;
        const previewLines = dataLines.slice(0, 5);
        
        const tbody = document.getElementById('csv-preview-body');
        tbody.innerHTML = previewLines.map(line => {
          const cols = parseCSVLine(line);
          return '<tr>' +
            '<td class="px-3 py-2">' + (cols[0] || '-') + '</td>' +
            '<td class="px-3 py-2">' + (cols[1] || '-') + '</td>' +
            '<td class="px-3 py-2">' + (cols[2] || '-') + '</td>' +
            '<td class="px-3 py-2">' + (cols[4] || '-') + '</td>' +
            '<td class="px-3 py-2">' + (cols[5] || '-') + '</td>' +
            '<td class="px-3 py-2">' + (cols[6] || '-') + '</td>' +
          '</tr>';
        }).join('');
        
        document.getElementById('csv-preview').classList.remove('hidden');
      }
      
      document.getElementById('csv-data-input').addEventListener('input', updateCsvPreview);
      document.getElementById('csv-skip-header').addEventListener('change', updateCsvPreview);
      
      document.getElementById('csv-import-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const csvInput = document.getElementById('csv-data-input').value.trim();
        if (!csvInput) {
          alert('CSVデータを入力してください');
          return;
        }
        
        const skipHeader = document.getElementById('csv-skip-header').checked;
        const updateExisting = document.getElementById('csv-update-existing').checked;
        
        const btn = document.getElementById('csv-import-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>処理中...';
        
        try {
          const data = await apiCall('/api/agency/clients/import-csv', {
            method: 'POST',
            body: JSON.stringify({
              csvData: csvInput,
              skipHeader: skipHeader,
              updateExisting: updateExisting,
            }),
          });
          
          const resultDiv = document.getElementById('csv-import-result');
          const successDiv = document.getElementById('csv-result-success');
          const errorsDiv = document.getElementById('csv-result-errors');
          
          resultDiv.classList.remove('hidden');
          
          if (data.success) {
            const result = data.data;
            successDiv.classList.remove('hidden');
            
            let message = '';
            if (result.success > 0) message += result.success + '件を新規登録しました。';
            if (result.updated > 0) message += result.updated + '件を更新しました。';
            if (result.failed > 0) message += result.failed + '件が失敗しました。';
            if (!message) message = '処理が完了しました。';
            
            document.getElementById('csv-result-message').textContent = message;
            
            if (result.errors && result.errors.length > 0) {
              errorsDiv.classList.remove('hidden');
              document.getElementById('csv-error-list').innerHTML = result.errors.map(err => 
                '<li>行' + err.row + ': ' + err.message + '</li>'
              ).join('');
            } else {
              errorsDiv.classList.add('hidden');
            }
            
            // 顧客リストを更新
            if (result.success > 0 || result.updated > 0) {
              loadClients();
            }
          } else {
            successDiv.classList.add('hidden');
            errorsDiv.classList.remove('hidden');
            document.getElementById('csv-error-list').innerHTML = 
              '<li>' + (data.error?.message || '不明なエラー') + '</li>';
          }
        } catch (err) {
          alert('通信エラーが発生しました');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-upload mr-2"></i>インポート';
        }
      });
      
      async function loadClients() {
        const search = document.getElementById('search-input').value;
        const status = document.getElementById('status-filter').value;
        
        let url = '/api/agency/clients?limit=50';
        if (search) url += '&search=' + encodeURIComponent(search);
        if (status) url += '&status=' + status;
        
        const data = await apiCall(url);
        if (data.success) {
          clients = data.data.clients;
          renderClients();
        }
      }
      
      function renderClients() {
        const container = document.getElementById('client-list');
        
        if (clients.length === 0) {
          container.innerHTML = '<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">顧客がまだ登録されていません</div>';
          return;
        }
        
        container.innerHTML = clients.map(client => \`
          <div class="client-card bg-white rounded-lg shadow p-4 cursor-pointer" onclick="openClient('\${client.id}')">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-900">\${client.client_name}</h3>
                  <span class="px-2 py-0.5 text-xs rounded-full \${
                    client.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    client.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }">\${client.status}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">\${client.company_name}</p>
                <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span><i class="fas fa-map-marker-alt mr-1"></i>\${client.prefecture || '未設定'}</span>
                  <span><i class="fas fa-industry mr-1"></i>\${client.industry || '未設定'}</span>
                  <span><i class="fas fa-file-alt mr-1"></i>ドラフト: \${client.draft_count || 0}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="event.stopPropagation(); issueLink('\${client.company_id}', 'intake')" 
                  class="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="入力リンク発行">
                  <i class="fas fa-link"></i>
                </button>
                <button onclick="event.stopPropagation(); searchForClient('\${client.company_id}')" 
                  class="p-2 text-blue-600 hover:bg-blue-50 rounded" title="補助金検索">
                  <i class="fas fa-search"></i>
                </button>
              </div>
            </div>
          </div>
        \`).join('');
      }
      
      function openClient(clientId) {
        window.location.href = '/agency/clients/' + clientId;
      }
      
      function searchForClient(companyId) {
        // 凍結仕様v1: Agency内で完結（/subsidiesに飛ばない）
        localStorage.setItem('selectedCompanyId', companyId);
        window.location.href = '/agency/search?company_id=' + encodeURIComponent(companyId);
      }
      
      async function issueLink(companyId, type) {
        if (!confirm('入力リンクを発行しますか？')) return;
        
        const data = await apiCall('/api/agency/links', {
          method: 'POST',
          body: JSON.stringify({ companyId, type, expiresInDays: 7 }),
        });
        
        if (data.success) {
          const url = data.data.url;
          await navigator.clipboard.writeText(url);
          alert('リンクをクリップボードにコピーしました:\\n' + url);
        } else {
          alert('エラー: ' + (data.error?.message || '不明なエラー'));
        }
      }
      
      // P0-3: 都道府県・業種リスト（顧客追加用）
      const addClientPrefectures = [
        {code: '01', name: '北海道'}, {code: '02', name: '青森県'}, {code: '03', name: '岩手県'},
        {code: '04', name: '宮城県'}, {code: '05', name: '秋田県'}, {code: '06', name: '山形県'},
        {code: '07', name: '福島県'}, {code: '08', name: '茨城県'}, {code: '09', name: '栃木県'},
        {code: '10', name: '群馬県'}, {code: '11', name: '埼玉県'}, {code: '12', name: '千葉県'},
        {code: '13', name: '東京都'}, {code: '14', name: '神奈川県'}, {code: '15', name: '新潟県'},
        {code: '16', name: '富山県'}, {code: '17', name: '石川県'}, {code: '18', name: '福井県'},
        {code: '19', name: '山梨県'}, {code: '20', name: '長野県'}, {code: '21', name: '岐阜県'},
        {code: '22', name: '静岡県'}, {code: '23', name: '愛知県'}, {code: '24', name: '三重県'},
        {code: '25', name: '滋賀県'}, {code: '26', name: '京都府'}, {code: '27', name: '大阪府'},
        {code: '28', name: '兵庫県'}, {code: '29', name: '奈良県'}, {code: '30', name: '和歌山県'},
        {code: '31', name: '鳥取県'}, {code: '32', name: '島根県'}, {code: '33', name: '岡山県'},
        {code: '34', name: '広島県'}, {code: '35', name: '山口県'}, {code: '36', name: '徳島県'},
        {code: '37', name: '香川県'}, {code: '38', name: '愛媛県'}, {code: '39', name: '高知県'},
        {code: '40', name: '福岡県'}, {code: '41', name: '佐賀県'}, {code: '42', name: '長崎県'},
        {code: '43', name: '熊本県'}, {code: '44', name: '大分県'}, {code: '45', name: '宮崎県'},
        {code: '46', name: '鹿児島県'}, {code: '47', name: '沖縄県'}
      ];
      
      const addClientIndustries = [
        '農業、林業', '漁業', '鉱業、採石業、砂利採取業', '建設業', '製造業',
        '電気・ガス・熱供給・水道業', '情報通信業', '運輸業、郵便業', '卸売業、小売業',
        '金融業、保険業', '不動産業、物品賃貸業', '学術研究、専門・技術サービス業',
        '宿泊業、飲食サービス業', '生活関連サービス業、娯楽業', '教育、学習支援業',
        '医療、福祉', '複合サービス事業', 'サービス業（他に分類されないもの）', 'その他'
      ];
      
      function initAddClientSelects() {
        const prefSelect = document.getElementById('add-client-prefecture');
        const indSelect = document.getElementById('add-client-industry');
        
        // 既存のオプションをクリア（最初の「選択してください」以外）
        while (prefSelect.options.length > 1) prefSelect.remove(1);
        while (indSelect.options.length > 1) indSelect.remove(1);
        
        addClientPrefectures.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.code;
          opt.textContent = p.name;
          prefSelect.appendChild(opt);
        });
        
        addClientIndustries.forEach(ind => {
          const opt = document.createElement('option');
          opt.value = ind;
          opt.textContent = ind;
          indSelect.appendChild(opt);
        });
      }
      
      function showAddClientModal() {
        initAddClientSelects(); // P0-3: セレクトボックス初期化
        document.getElementById('add-client-modal').classList.remove('hidden');
      }
      
      function hideAddClientModal() {
        document.getElementById('add-client-modal').classList.add('hidden');
      }
      
      document.getElementById('add-client-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        // P0-3: 必須項目チェック
        const employeeCount = parseInt(formData.get('employeeCount') || '0', 10);
        if (!employeeCount || employeeCount < 1) {
          alert('従業員数は1以上の数値を入力してください');
          return;
        }
        
        const data = await apiCall('/api/agency/clients', {
          method: 'POST',
          body: JSON.stringify({
            clientName: formData.get('clientName'),
            companyName: formData.get('companyName'),
            clientEmail: formData.get('clientEmail'),
            clientPhone: formData.get('clientPhone'),
            prefecture: formData.get('prefecture'),
            industry: formData.get('industry'),
            employeeCount: employeeCount, // P0-1: 従業員数追加
            notes: formData.get('notes'),
          }),
        });
        
        if (data.success) {
          hideAddClientModal();
          form.reset();
          loadClients();
        } else {
          // P1-1: フィールド別エラー表示対応
          if (data.error?.fields) {
            const msgs = Object.entries(data.error.fields).map(([k, v]) => k + ': ' + v).join('\\n');
            alert('入力エラー:\\n' + msgs);
          } else {
            alert('エラー: ' + (data.error?.message || '不明なエラー'));
          }
        }
      });
      
      // URL パラメータで自動モーダル表示
      if (new URLSearchParams(window.location.search).get('action') === 'add') {
        showAddClientModal();
      }
      
      // DOMContentLoaded で apiCall が定義されてから実行
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadClients);
      } else {
        // 既にDOMが読み込まれている場合は即座に実行
        if (typeof window.apiCall === 'function') {
          loadClients();
        } else {
          // apiCallがまだ定義されていない場合は少し待つ
          setTimeout(loadClients, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('顧客企業', content, 'clients'));
});

/**
 * GET /agency/clients/:id - 顧客詳細
 */
agencyPages.get('/agency/clients/:id', (c) => {
  const clientId = c.req.param('id');
  
  const content = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <a href="/agency/clients" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-arrow-left text-xl"></i>
          </a>
          <div>
            <h1 id="client-name" class="text-2xl font-bold text-gray-900 loading">読み込み中...</h1>
            <p id="company-name" class="text-gray-600"></p>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="issueIntakeLink()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
            <i class="fas fa-link mr-2"></i>入力リンク発行
          </button>
          <button onclick="showEditModal()" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            <i class="fas fa-edit mr-2"></i>編集
          </button>
        </div>
      </div>
      
      <!-- Status Badge and Info -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-2">ステータス</h3>
            <span id="client-status" class="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">-</span>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-2">担当者</h3>
            <p id="contact-info" class="text-gray-900">-</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-2">登録日</h3>
            <p id="created-at" class="text-gray-900">-</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-2">メールアドレス</h3>
            <p id="client-email" class="text-gray-900">-</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-2">電話番号</h3>
            <p id="client-phone" class="text-gray-900">-</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 mb-2">地域・業種</h3>
            <p id="area-industry" class="text-gray-900">-</p>
          </div>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="border-b">
        <nav class="flex gap-4">
          <button onclick="showTab('profile')" class="tab-btn px-4 py-2 border-b-2 border-emerald-500 text-emerald-600 font-medium" data-tab="profile">
            <i class="fas fa-user mr-2"></i>企業情報
          </button>
          <button onclick="showTab('submissions')" class="tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="submissions">
            <i class="fas fa-inbox mr-2"></i>入力履歴
          </button>
          <button onclick="showTab('drafts')" class="tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="drafts">
            <i class="fas fa-file-alt mr-2"></i>申請書ドラフト
          </button>
          <button onclick="showTab('links')" class="tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="links">
            <i class="fas fa-link mr-2"></i>発行リンク
          </button>
        </nav>
      </div>
      
      <!-- Tab Contents -->
      <div id="tab-profile" class="tab-content">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">企業プロフィール</h3>
            <button onclick="showCompanyEditModal()" class="text-sm bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700">
              <i class="fas fa-edit mr-1"></i>企業情報を編集
            </button>
          </div>
          <div id="profile-content" class="text-gray-500">読み込み中...</div>
        </div>
      </div>
      
      <div id="tab-submissions" class="tab-content hidden">
        <div class="bg-white rounded-lg shadow">
          <div class="p-4 border-b">
            <h3 class="text-lg font-semibold">入力履歴</h3>
          </div>
          <div id="submissions-list" class="divide-y">
            <p class="p-4 text-gray-500">読み込み中...</p>
          </div>
        </div>
      </div>
      
      <div id="tab-drafts" class="tab-content hidden">
        <div class="bg-white rounded-lg shadow">
          <div class="p-4 border-b">
            <h3 class="text-lg font-semibold">申請書ドラフト</h3>
          </div>
          <div id="drafts-list" class="divide-y">
            <p class="p-4 text-gray-500">読み込み中...</p>
          </div>
        </div>
      </div>
      
      <div id="tab-links" class="tab-content hidden">
        <div class="bg-white rounded-lg shadow">
          <div class="p-4 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold">発行リンク</h3>
            <button onclick="issueIntakeLink()" class="text-sm bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700">
              <i class="fas fa-plus mr-1"></i>新規発行
            </button>
          </div>
          <div id="links-list" class="divide-y">
            <p class="p-4 text-gray-500">読み込み中...</p>
          </div>
        </div>
      </div>
      
      <!-- Notes Section -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">メモ</h3>
        <textarea id="notes-input" rows="3" class="w-full border rounded-lg px-3 py-2" placeholder="顧客に関するメモを入力..."></textarea>
        <div class="mt-2 flex justify-end">
          <button onclick="saveNotes()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
            <i class="fas fa-save mr-2"></i>保存
          </button>
        </div>
      </div>
    </div>
    
    <!-- Edit Modal (担当者情報) -->
    <div id="edit-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div class="p-6">
          <h2 class="text-xl font-bold mb-4">担当者情報を編集</h2>
          <form id="edit-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">担当者名</label>
              <input type="text" name="clientName" id="edit-client-name" class="w-full border rounded-lg px-3 py-2">
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input type="email" name="clientEmail" id="edit-client-email" class="w-full border rounded-lg px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                <input type="tel" name="clientPhone" id="edit-client-phone" class="w-full border rounded-lg px-3 py-2">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
              <select name="status" id="edit-status" class="w-full border rounded-lg px-3 py-2">
                <option value="active">アクティブ</option>
                <option value="paused">一時停止</option>
                <option value="archived">アーカイブ</option>
              </select>
            </div>
            <div class="flex gap-2 pt-4">
              <button type="button" onclick="hideEditModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button type="submit" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- Company Edit Modal (企業情報) -->
    <div id="company-edit-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <h2 class="text-xl font-bold mb-4"><i class="fas fa-building mr-2"></i>企業情報を編集</h2>
          <form id="company-edit-form" class="space-y-6">
            <!-- 基本情報 -->
            <div class="border-b pb-4">
              <h3 class="text-sm font-semibold text-gray-600 mb-3"><i class="fas fa-info-circle mr-1"></i>基本情報（必須）</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">会社名 <span class="text-red-500">*</span></label>
                  <input type="text" name="companyName" id="edit-company-name" required class="w-full border rounded-lg px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">都道府県 <span class="text-red-500">*</span></label>
                  <select name="prefecture" id="edit-company-prefecture" required class="w-full border rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">市区町村</label>
                  <input type="text" name="city" id="edit-company-city" class="w-full border rounded-lg px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">業種 <span class="text-red-500">*</span></label>
                  <select name="industry_major" id="edit-company-industry" required class="w-full border rounded-lg px-3 py-2">
                    <option value="">選択してください</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">従業員数 <span class="text-red-500">*</span></label>
                  <input type="number" name="employee_count" id="edit-company-employees" required min="1" class="w-full border rounded-lg px-3 py-2" placeholder="例: 10">
                </div>
              </div>
            </div>
            
            <!-- 追加情報 -->
            <div class="border-b pb-4">
              <h3 class="text-sm font-semibold text-gray-600 mb-3"><i class="fas fa-chart-line mr-1"></i>追加情報（推奨）</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">資本金（万円）</label>
                  <input type="number" name="capital" id="edit-company-capital" class="w-full border rounded-lg px-3 py-2" placeholder="例: 1000">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">設立年月</label>
                  <input type="month" name="established_date" id="edit-company-established" class="w-full border rounded-lg px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">直近売上高（万円）</label>
                  <input type="number" name="annual_revenue" id="edit-company-revenue" class="w-full border rounded-lg px-3 py-2" placeholder="例: 50000">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">代表者名</label>
                  <input type="text" name="representative_name" id="edit-company-rep" class="w-full border rounded-lg px-3 py-2">
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Webサイト</label>
                  <input type="url" name="website_url" id="edit-company-website" class="w-full border rounded-lg px-3 py-2" placeholder="https://example.com">
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">事業概要</label>
                  <textarea name="business_summary" id="edit-company-summary" rows="3" class="w-full border rounded-lg px-3 py-2" placeholder="事業の内容を簡潔に記載"></textarea>
                </div>
              </div>
            </div>
            
            <div class="flex gap-2 pt-2">
              <button type="button" onclick="hideCompanyEditModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button type="submit" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                <i class="fas fa-save mr-1"></i>保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <script>
      const clientId = '${clientId}';
      let clientData = null;
      
      async function loadClientDetail() {
        const data = await apiCall('/api/agency/clients/' + clientId);
        
        if (!data.success) {
          alert('顧客情報の取得に失敗しました: ' + (data.error?.message || '不明なエラー'));
          window.location.href = '/agency/clients';
          return;
        }
        
        clientData = data.data;
        renderClientDetail();
      }
      
      function renderClientDetail() {
        const client = clientData.client;
        
        // Header
        document.getElementById('client-name').textContent = client.client_name || client.name || '名前未設定';
        document.getElementById('client-name').classList.remove('loading');
        document.getElementById('company-name').textContent = client.name || '';
        
        // Status
        const statusEl = document.getElementById('client-status');
        const statusMap = { active: ['アクティブ', 'bg-emerald-100 text-emerald-700'], paused: ['一時停止', 'bg-yellow-100 text-yellow-700'], archived: ['アーカイブ', 'bg-gray-100 text-gray-700'] };
        const [statusText, statusClass] = statusMap[client.status] || ['不明', 'bg-gray-100 text-gray-700'];
        statusEl.textContent = statusText;
        statusEl.className = 'px-3 py-1 rounded-full text-sm font-medium ' + statusClass;
        
        // Info
        document.getElementById('contact-info').textContent = client.client_name || '-';
        document.getElementById('created-at').textContent = client.created_at ? new Date(client.created_at).toLocaleDateString('ja-JP') : '-';
        document.getElementById('client-email').textContent = client.client_email || '-';
        document.getElementById('client-phone').textContent = client.client_phone || '-';
        document.getElementById('area-industry').textContent = [client.prefecture, client.industry_major || client.industry].filter(Boolean).join(' / ') || '-';
        
        // Notes
        document.getElementById('notes-input').value = client.notes || '';
        
        // Profile tab
        renderProfile();
        
        // Submissions tab
        renderSubmissions();
        
        // Drafts tab
        renderDrafts();
        
        // Links tab
        renderLinks();
      }
      
      function renderProfile() {
        const client = clientData.client;
        
        // 都道府県コードを名前に変換
        const prefMap = {
          '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
          '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
          '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
          '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
          '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
          '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
          '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
          '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
          '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
          '46': '鹿児島県', '47': '沖縄県'
        };
        const prefName = prefMap[client.prefecture] || client.prefecture;
        
        // 金額フォーマット
        const formatMoney = (val) => {
          if (!val) return null;
          return Number(val).toLocaleString() + '万円';
        };
        
        // 必須情報（companies テーブルから）
        const requiredFields = [
          { label: '会社名', value: client.name, required: true },
          { label: '所在地', value: [prefName, client.city].filter(Boolean).join(' '), required: true },
          { label: '業種', value: client.industry_major || client.industry, required: true },
          { label: '従業員数', value: client.employee_count ? client.employee_count + '名' : null, required: true },
        ];
        
        // 追加情報
        const additionalFields = [
          { label: '資本金', value: formatMoney(client.capital) },
          { label: '設立年月', value: client.established_date },
          { label: '直近売上高', value: formatMoney(client.annual_revenue) },
          { label: '代表者名', value: client.representative_name },
          { label: 'Webサイト', value: client.website_url, isLink: true },
          { label: '事業概要', value: client.business_summary, fullWidth: true },
        ];
        
        // 詳細情報（company_profile から）
        const detailFields = [
          { label: '法人番号', value: client.corp_number },
          { label: '法人形態', value: client.corp_type },
          { label: '代表者肩書', value: client.representative_title },
          { label: '連絡先メール', value: client.contact_email },
          { label: '連絡先電話', value: client.contact_phone },
          { label: '主要製品/サービス', value: client.main_products },
          { label: '主要顧客', value: client.main_customers },
          { label: '競合優位性', value: client.competitive_advantage },
        ];
        
        // 必須情報の充足チェック
        const missingRequired = requiredFields.filter(f => !f.value);
        
        let html = '';
        
        // 必須情報不足の警告
        if (missingRequired.length > 0) {
          html += '<div class="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">' +
            '<p class="text-yellow-800 font-semibold mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>必須情報が不足しています</p>' +
            '<p class="text-yellow-700 text-sm">補助金検索の精度向上のため、以下の情報を入力してください:</p>' +
            '<ul class="list-disc list-inside text-yellow-700 text-sm mt-2">' +
            missingRequired.map(f => '<li>' + f.label + '</li>').join('') +
            '</ul></div>';
        }
        
        // 必須情報セクション
        html += '<div class="mb-6"><h4 class="text-sm font-semibold text-gray-600 mb-3 border-b pb-2"><i class="fas fa-asterisk mr-1 text-red-500"></i>基本情報</h4>' +
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
          requiredFields.map(f => 
            '<div><span class="text-sm text-gray-500">' + f.label + (f.required ? ' <span class="text-red-500">*</span>' : '') + '</span>' +
            '<p class="text-gray-900">' + (f.value || '<span class="text-red-400">未入力</span>') + '</p></div>'
          ).join('') + '</div></div>';
        
        // 追加情報セクション
        const filledAdditional = additionalFields.filter(f => f.value);
        if (filledAdditional.length > 0) {
          html += '<div class="mb-6"><h4 class="text-sm font-semibold text-gray-600 mb-3 border-b pb-2"><i class="fas fa-chart-line mr-1"></i>追加情報</h4>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
            filledAdditional.map(f => {
              let val = f.value;
              if (f.isLink && val) {
                val = '<a href="' + val + '" target="_blank" class="text-blue-600 hover:underline">' + val + '</a>';
              }
              return '<div class="' + (f.fullWidth ? 'col-span-2' : '') + '"><span class="text-sm text-gray-500">' + f.label + '</span>' +
                '<p class="text-gray-900">' + val + '</p></div>';
            }).join('') + '</div></div>';
        }
        
        // 詳細情報セクション
        const filledDetail = detailFields.filter(f => f.value);
        if (filledDetail.length > 0) {
          html += '<div><h4 class="text-sm font-semibold text-gray-600 mb-3 border-b pb-2"><i class="fas fa-info-circle mr-1"></i>詳細情報</h4>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
            filledDetail.map(f => 
              '<div><span class="text-sm text-gray-500">' + f.label + '</span><p class="text-gray-900">' + f.value + '</p></div>'
            ).join('') + '</div></div>';
        }
        
        document.getElementById('profile-content').innerHTML = html || '<p class="text-gray-500">企業情報を入力してください。</p>';
      }
      
      function renderSubmissions() {
        const submissions = clientData.submissions || [];
        const container = document.getElementById('submissions-list');
        
        if (submissions.length === 0) {
          container.innerHTML = '<p class="p-4 text-gray-500">入力履歴がありません</p>';
          return;
        }
        
        container.innerHTML = submissions.map(s => \`
          <div class="p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <div>
                <p class="font-medium">\${s.form_type || '一般入力'}</p>
                <p class="text-sm text-gray-500">\${new Date(s.created_at).toLocaleString('ja-JP')}</p>
              </div>
              <span class="px-2 py-1 text-xs rounded-full \${
                s.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                s.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }">\${s.status === 'approved' ? '承認済' : s.status === 'pending' ? '確認待ち' : s.status}</span>
            </div>
          </div>
        \`).join('');
      }
      
      function renderDrafts() {
        const drafts = clientData.drafts || [];
        const container = document.getElementById('drafts-list');
        
        if (drafts.length === 0) {
          container.innerHTML = '<p class="p-4 text-gray-500">申請書ドラフトがありません</p>';
          return;
        }
        
        container.innerHTML = drafts.map(d => \`
          <div class="p-4 hover:bg-gray-50 cursor-pointer">
            <div class="flex justify-between items-start">
              <div>
                <p class="font-medium">\${d.title || '無題のドラフト'}</p>
                <p class="text-sm text-gray-500">更新: \${new Date(d.updated_at).toLocaleString('ja-JP')}</p>
              </div>
              <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">\${d.status || '作成中'}</span>
            </div>
          </div>
        \`).join('');
      }
      
      function renderLinks() {
        const links = clientData.links || [];
        const container = document.getElementById('links-list');
        
        if (links.length === 0) {
          container.innerHTML = '<p class="p-4 text-gray-500">発行リンクがありません</p>';
          return;
        }
        
        const now = new Date();
        container.innerHTML = links.map(l => {
          const expiresAt = new Date(l.expires_at);
          const isExpired = expiresAt < now;
          const isRevoked = l.revoked_at;
          const status = isRevoked ? '無効化済' : isExpired ? '期限切れ' : '有効';
          const statusClass = isRevoked || isExpired ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-700';
          
          return \`
            <div class="p-4 hover:bg-gray-50">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-medium">\${l.type === 'intake' ? '入力リンク' : l.type}</p>
                  <p class="text-sm text-gray-500">発行: \${new Date(l.created_at).toLocaleString('ja-JP')}</p>
                  <p class="text-sm text-gray-500">期限: \${expiresAt.toLocaleString('ja-JP')}</p>
                  <p class="text-sm text-gray-400">使用回数: \${l.used_count || 0} / \${l.max_uses || '無制限'}</p>
                </div>
                <span class="px-2 py-1 text-xs rounded-full \${statusClass}">\${status}</span>
              </div>
            </div>
          \`;
        }).join('');
      }
      
      function showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => {
          el.classList.remove('border-emerald-500', 'text-emerald-600');
          el.classList.add('border-transparent', 'text-gray-500');
        });
        
        // Show selected tab
        document.getElementById('tab-' + tabName).classList.remove('hidden');
        document.querySelector('[data-tab="' + tabName + '"]').classList.add('border-emerald-500', 'text-emerald-600');
        document.querySelector('[data-tab="' + tabName + '"]').classList.remove('border-transparent', 'text-gray-500');
      }
      
      async function issueIntakeLink() {
        if (!clientData) return;
        
        const companyId = clientData.client.company_id;
        const data = await apiCall('/api/agency/links', {
          method: 'POST',
          body: JSON.stringify({ companyId, type: 'intake', expiresInDays: 7 }),
        });
        
        if (data.success) {
          const url = data.data.url;
          await navigator.clipboard.writeText(url);
          alert('入力リンクをクリップボードにコピーしました:\\n' + url);
          loadClientDetail(); // Reload to show new link
        } else {
          alert('エラー: ' + (data.error?.message || '不明なエラー'));
        }
      }
      
      async function saveNotes() {
        const notes = document.getElementById('notes-input').value;
        
        const data = await apiCall('/api/agency/clients/' + clientId, {
          method: 'PUT',
          body: JSON.stringify({ notes }),
        });
        
        if (data.success) {
          alert('メモを保存しました');
        } else {
          alert('エラー: ' + (data.error?.message || '保存に失敗しました'));
        }
      }
      
      function showEditModal() {
        if (!clientData) return;
        const client = clientData.client;
        
        document.getElementById('edit-client-name').value = client.client_name || '';
        document.getElementById('edit-client-email').value = client.client_email || '';
        document.getElementById('edit-client-phone').value = client.client_phone || '';
        document.getElementById('edit-status').value = client.status || 'active';
        
        document.getElementById('edit-modal').classList.remove('hidden');
      }
      
      function hideEditModal() {
        document.getElementById('edit-modal').classList.add('hidden');
      }
      
      document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        
        const data = await apiCall('/api/agency/clients/' + clientId, {
          method: 'PUT',
          body: JSON.stringify({
            clientName: form.clientName.value,
            clientEmail: form.clientEmail.value,
            clientPhone: form.clientPhone.value,
            status: form.status.value,
          }),
        });
        
        if (data.success) {
          hideEditModal();
          loadClientDetail();
        } else {
          alert('エラー: ' + (data.error?.message || '更新に失敗しました'));
        }
      });
      
      // ========================================
      // 企業情報編集機能
      // ========================================
      
      // 都道府県リスト
      const prefectures = [
        {code: '01', name: '北海道'}, {code: '02', name: '青森県'}, {code: '03', name: '岩手県'},
        {code: '04', name: '宮城県'}, {code: '05', name: '秋田県'}, {code: '06', name: '山形県'},
        {code: '07', name: '福島県'}, {code: '08', name: '茨城県'}, {code: '09', name: '栃木県'},
        {code: '10', name: '群馬県'}, {code: '11', name: '埼玉県'}, {code: '12', name: '千葉県'},
        {code: '13', name: '東京都'}, {code: '14', name: '神奈川県'}, {code: '15', name: '新潟県'},
        {code: '16', name: '富山県'}, {code: '17', name: '石川県'}, {code: '18', name: '福井県'},
        {code: '19', name: '山梨県'}, {code: '20', name: '長野県'}, {code: '21', name: '岐阜県'},
        {code: '22', name: '静岡県'}, {code: '23', name: '愛知県'}, {code: '24', name: '三重県'},
        {code: '25', name: '滋賀県'}, {code: '26', name: '京都府'}, {code: '27', name: '大阪府'},
        {code: '28', name: '兵庫県'}, {code: '29', name: '奈良県'}, {code: '30', name: '和歌山県'},
        {code: '31', name: '鳥取県'}, {code: '32', name: '島根県'}, {code: '33', name: '岡山県'},
        {code: '34', name: '広島県'}, {code: '35', name: '山口県'}, {code: '36', name: '徳島県'},
        {code: '37', name: '香川県'}, {code: '38', name: '愛媛県'}, {code: '39', name: '高知県'},
        {code: '40', name: '福岡県'}, {code: '41', name: '佐賀県'}, {code: '42', name: '長崎県'},
        {code: '43', name: '熊本県'}, {code: '44', name: '大分県'}, {code: '45', name: '宮崎県'},
        {code: '46', name: '鹿児島県'}, {code: '47', name: '沖縄県'}
      ];
      
      // 業種リスト
      const industries = [
        '農業、林業', '漁業', '鉱業、採石業、砂利採取業', '建設業', '製造業',
        '電気・ガス・熱供給・水道業', '情報通信業', '運輸業、郵便業', '卸売業、小売業',
        '金融業、保険業', '不動産業、物品賃貸業', '学術研究、専門・技術サービス業',
        '宿泊業、飲食サービス業', '生活関連サービス業、娯楽業', '教育、学習支援業',
        '医療、福祉', '複合サービス事業', 'サービス業（他に分類されないもの）', 'その他'
      ];
      
      // 都道府県・業種セレクトを初期化
      function initCompanyEditSelects() {
        const prefSelect = document.getElementById('edit-company-prefecture');
        const indSelect = document.getElementById('edit-company-industry');
        
        // 既存のオプションをクリア（最初の「選択してください」以外）
        while (prefSelect.options.length > 1) prefSelect.remove(1);
        while (indSelect.options.length > 1) indSelect.remove(1);
        
        prefectures.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.code;
          opt.textContent = p.name;
          prefSelect.appendChild(opt);
        });
        
        industries.forEach(ind => {
          const opt = document.createElement('option');
          opt.value = ind;
          opt.textContent = ind;
          indSelect.appendChild(opt);
        });
      }
      
      function showCompanyEditModal() {
        if (!clientData) return;
        const client = clientData.client;
        
        // セレクト初期化
        initCompanyEditSelects();
        
        // 値をセット
        document.getElementById('edit-company-name').value = client.name || '';
        document.getElementById('edit-company-prefecture').value = client.prefecture || '';
        document.getElementById('edit-company-city').value = client.city || '';
        document.getElementById('edit-company-industry').value = client.industry_major || client.industry || '';
        document.getElementById('edit-company-employees').value = client.employee_count || '';
        document.getElementById('edit-company-capital').value = client.capital || '';
        document.getElementById('edit-company-established').value = client.established_date || '';
        document.getElementById('edit-company-revenue').value = client.annual_revenue || '';
        document.getElementById('edit-company-rep').value = client.representative_name || '';
        document.getElementById('edit-company-website').value = client.website_url || '';
        document.getElementById('edit-company-summary').value = client.business_summary || '';
        
        document.getElementById('company-edit-modal').classList.remove('hidden');
      }
      
      function hideCompanyEditModal() {
        document.getElementById('company-edit-modal').classList.add('hidden');
      }
      
      document.getElementById('company-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        
        // 必須チェック
        const employeeCount = parseInt(form.employee_count.value);
        if (!employeeCount || employeeCount < 1) {
          alert('従業員数は1以上の数値を入力してください');
          return;
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>保存中...';
        
        const data = await apiCall('/api/agency/clients/' + clientId + '/company', {
          method: 'PUT',
          body: JSON.stringify({
            companyName: form.companyName.value,
            prefecture: form.prefecture.value,
            city: form.city.value,
            industry_major: form.industry_major.value,
            employee_count: employeeCount,
            capital: form.capital.value ? parseInt(form.capital.value) : null,
            established_date: form.established_date.value || null,
            annual_revenue: form.annual_revenue.value ? parseInt(form.annual_revenue.value) : null,
            representative_name: form.representative_name.value || null,
            website_url: form.website_url.value || null,
            business_summary: form.business_summary.value || null,
          }),
        });
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save mr-1"></i>保存';
        
        if (data.success) {
          hideCompanyEditModal();
          loadClientDetail();
          alert('企業情報を更新しました');
        } else {
          alert('エラー: ' + (data.error?.message || '更新に失敗しました'));
        }
      });
      
      // Initialize
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadClientDetail);
      } else {
        if (typeof window.apiCall === 'function') {
          loadClientDetail();
        } else {
          setTimeout(loadClientDetail, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('顧客詳細', content, 'clients'));
});

/**
 * GET /agency/links - リンク管理
 */
agencyPages.get('/agency/links', (c) => {
  const content = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">
          <i class="fas fa-link mr-2"></i>リンク管理
        </h1>
        <button onclick="showIssueLinkModal()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
          <i class="fas fa-plus mr-2"></i>リンクを発行
        </button>
      </div>
      
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex gap-4 items-center">
          <select id="type-filter" class="border rounded-lg px-3 py-2">
            <option value="">すべてのタイプ</option>
            <option value="intake">企業情報入力</option>
            <option value="chat">壁打ち回答</option>
            <option value="upload">書類アップロード</option>
          </select>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="active-only" checked class="rounded">
            <span class="text-sm">有効なリンクのみ</span>
          </label>
          <button onclick="loadLinks()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
      
      <!-- Link List -->
      <div id="link-list" class="space-y-4">
        <p class="text-gray-500 loading">読み込み中...</p>
      </div>
    </div>
    
    <!-- リンク発行モーダル -->
    <div id="issue-link-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div class="p-6">
          <h2 class="text-xl font-bold mb-4">リンクを発行</h2>
          <form id="issue-link-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">顧客企業 *</label>
              <select name="companyId" id="company-select" required class="w-full border rounded-lg px-3 py-2">
                <option value="">選択してください</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">リンクタイプ *</label>
              <select name="type" class="w-full border rounded-lg px-3 py-2">
                <option value="intake">企業情報入力</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">有効期限（日数）</label>
              <select name="expiresInDays" class="w-full border rounded-lg px-3 py-2">
                <option value="7">7日間</option>
                <option value="14">14日間</option>
                <option value="30">30日間</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" name="sendEmail" id="send-link-email" class="rounded border-gray-300 text-emerald-600">
              <label for="send-link-email" class="text-sm text-gray-700">顧客にメールで送信する</label>
            </div>
            <div class="flex gap-2 pt-4">
              <button type="button" onclick="hideIssueLinkModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button type="submit" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                発行
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- 発行完了モーダル -->
    <div id="link-result-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div class="p-6">
          <div class="text-center mb-4">
            <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-check text-emerald-600 text-2xl"></i>
            </div>
            <h3 class="text-xl font-bold">リンクを発行しました</h3>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">発行リンク</label>
            <div class="flex gap-2">
              <input type="text" id="issued-link-url" readonly class="flex-1 border rounded-lg px-3 py-2 bg-gray-50">
              <button onclick="copyIssuedLink()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
          <p id="email-sent-message" class="text-sm text-emerald-600 mb-4 hidden">
            <i class="fas fa-check-circle mr-1"></i>顧客にメールを送信しました
          </p>
          <button onclick="hideLinkResultModal()" class="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            閉じる
          </button>
        </div>
      </div>
    </div>
    
    <script>
      async function loadLinks() {
        const type = document.getElementById('type-filter').value;
        const activeOnly = document.getElementById('active-only').checked;
        
        let url = '/api/agency/links?';
        if (type) url += 'type=' + type + '&';
        if (activeOnly) url += 'active=true';
        
        const data = await apiCall(url);
        if (data.success) {
          renderLinks(data.data.links);
        }
      }
      
      function renderLinks(links) {
        const container = document.getElementById('link-list');
        
        if (links.length === 0) {
          container.innerHTML = '<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">発行済みリンクはありません</div>';
          return;
        }
        
        container.innerHTML = links.map(link => {
          const isExpired = new Date(link.expires_at) < new Date();
          const isRevoked = !!link.revoked_at;
          const isMaxUsed = link.max_uses && link.used_count >= link.max_uses;
          const isActive = !isExpired && !isRevoked && !isMaxUsed;
          
          return \`
            <div class="bg-white rounded-lg shadow p-4">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 text-xs font-medium rounded-full \${
                      link.type === 'intake' ? 'bg-blue-100 text-blue-700' :
                      link.type === 'chat' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }">\${link.type}</span>
                    <span class="font-medium">\${link.client_name || link.company_name}</span>
                    <span class="px-2 py-0.5 text-xs rounded-full \${
                      isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }">\${isActive ? '有効' : isRevoked ? '無効化' : isExpired ? '期限切れ' : '使用上限'}</span>
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    <span class="mr-4"><i class="fas fa-clock mr-1"></i>期限: \${new Date(link.expires_at).toLocaleString('ja-JP')}</span>
                    <span class="mr-4"><i class="fas fa-mouse-pointer mr-1"></i>使用: \${link.used_count}/\${link.max_uses || '∞'}</span>
                    <span><i class="fas fa-key mr-1"></i>\${link.short_code}</span>
                  </div>
                </div>
                <div class="flex gap-2">
                  \${isActive ? \`
                    <button onclick="copyLink('\${link.short_code}')" class="p-2 text-gray-600 hover:bg-gray-100 rounded" title="コピー">
                      <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="revokeLink('\${link.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded" title="無効化">
                      <i class="fas fa-ban"></i>
                    </button>
                  \` : ''}
                </div>
              </div>
            </div>
          \`;
        }).join('');
      }
      
      function copyLink(shortCode) {
        const url = window.location.origin + '/intake?code=' + shortCode;
        navigator.clipboard.writeText(url);
        alert('リンクをコピーしました');
      }
      
      async function revokeLink(linkId) {
        if (!confirm('このリンクを無効化しますか？')) return;
        
        const data = await apiCall('/api/agency/links/' + linkId, { method: 'DELETE' });
        if (data.success) {
          loadLinks();
        } else {
          alert('エラー: ' + (data.error?.message || '不明なエラー'));
        }
      }
      
      // リンク発行モーダル
      let clients = [];
      
      async function showIssueLinkModal() {
        // 顧客一覧を取得
        if (clients.length === 0) {
          const data = await apiCall('/api/agency/clients?limit=100');
          if (data.success) {
            clients = data.data.clients;
            const select = document.getElementById('company-select');
            select.innerHTML = '<option value="">選択してください</option>' +
              clients.map(c => '<option value="' + c.company_id + '">' + (c.client_name || c.company_name) + '</option>').join('');
          }
        }
        document.getElementById('issue-link-modal').classList.remove('hidden');
      }
      
      function hideIssueLinkModal() {
        document.getElementById('issue-link-modal').classList.add('hidden');
        document.getElementById('issue-link-form').reset();
      }
      
      function hideLinkResultModal() {
        document.getElementById('link-result-modal').classList.add('hidden');
      }
      
      function copyIssuedLink() {
        const input = document.getElementById('issued-link-url');
        input.select();
        document.execCommand('copy');
        alert('リンクをコピーしました');
      }
      
      document.getElementById('issue-link-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const data = await apiCall('/api/agency/links', {
          method: 'POST',
          body: JSON.stringify({
            companyId: formData.get('companyId'),
            type: formData.get('type'),
            expiresInDays: parseInt(formData.get('expiresInDays')),
            sendEmail: formData.get('sendEmail') === 'on',
          }),
        });
        
        if (data.success) {
          hideIssueLinkModal();
          document.getElementById('issued-link-url').value = data.data.url;
          if (data.data.email_sent) {
            document.getElementById('email-sent-message').classList.remove('hidden');
          } else {
            document.getElementById('email-sent-message').classList.add('hidden');
          }
          document.getElementById('link-result-modal').classList.remove('hidden');
          loadLinks();
        } else {
          alert('エラー: ' + (data.error?.message || 'リンクの発行に失敗しました'));
        }
      });
      
      // DOMContentLoaded で apiCall が定義されてから実行
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadLinks);
      } else {
        if (typeof window.apiCall === 'function') {
          loadLinks();
        } else {
          setTimeout(loadLinks, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('リンク管理', content, 'links'));
});

/**
 * GET /agency/submissions - 入力受付一覧
 */
agencyPages.get('/agency/submissions', (c) => {
  const content = `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">
        <i class="fas fa-inbox mr-2"></i>入力受付
      </h1>
      
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex gap-4 items-center">
          <select id="status-filter" class="border rounded-lg px-3 py-2">
            <option value="submitted">未処理</option>
            <option value="">すべて</option>
            <option value="approved">承認済み</option>
            <option value="rejected">却下</option>
          </select>
          <button onclick="loadSubmissions()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
      
      <!-- Submission List -->
      <div id="submission-list" class="space-y-4">
        <p class="text-gray-500 loading">読み込み中...</p>
      </div>
    </div>
    
    <!-- Detail Modal -->
    <div id="detail-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div class="p-6" id="detail-content">
          <!-- 動的に挿入 -->
        </div>
      </div>
    </div>
    
    <script>
      let currentSubmissions = []; // グローバル変数として定義
      
      async function loadSubmissions() {
        const status = document.getElementById('status-filter').value;
        let url = '/api/agency/submissions';
        if (status) url += '?status=' + status;
        
        const data = await apiCall(url);
        if (data.success) {
          currentSubmissions = data.data.submissions; // データを保存
          renderSubmissions(currentSubmissions);
        }
      }
      
      function renderSubmissions(submissions) {
        const container = document.getElementById('submission-list');
        
        if (submissions.length === 0) {
          container.innerHTML = '<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">入力受付はありません</div>';
          return;
        }
        
        container.innerHTML = submissions.map(sub => \`
          <div class="bg-white rounded-lg shadow p-4">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">\${sub.client_name || sub.company_name}</span>
                  <span class="px-2 py-0.5 text-xs rounded-full \${
                    sub.status === 'submitted' ? 'bg-orange-100 text-orange-700' :
                    sub.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-red-100 text-red-700'
                  }">\${sub.status === 'submitted' ? '未処理' : sub.status === 'approved' ? '承認済み' : '却下'}</span>
                </div>
                <div class="text-sm text-gray-500 mt-1">
                  <span><i class="fas fa-clock mr-1"></i>\${new Date(sub.created_at).toLocaleString('ja-JP')}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="showDetail('\${sub.id}')" class="p-2 text-gray-600 hover:bg-gray-100 rounded" title="詳細">
                  <i class="fas fa-eye"></i>
                </button>
                \${sub.status === 'submitted' ? \`
                  <button onclick="approveSubmission('\${sub.id}')" class="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="承認">
                    <i class="fas fa-check"></i>
                  </button>
                  <button onclick="rejectSubmission('\${sub.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded" title="却下">
                    <i class="fas fa-times"></i>
                  </button>
                \` : ''}
              </div>
            </div>
          </div>
        \`).join('');
      }
      
      function showDetail(id) {
        const sub = currentSubmissions.find(s => s.id === id);
        if (!sub) return;
        
        const payload = JSON.parse(sub.payload_json || '{}');
        
        document.getElementById('detail-content').innerHTML = \`
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">\${sub.client_name || sub.company_name}</h2>
            <button onclick="document.getElementById('detail-modal').classList.add('hidden')" class="text-gray-500 hover:text-gray-700">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="space-y-4">
            <div class="border rounded-lg p-4">
              <h3 class="font-semibold mb-2">入力内容</h3>
              <pre class="text-sm bg-gray-50 p-3 rounded overflow-x-auto">\${JSON.stringify(payload, null, 2)}</pre>
            </div>
            <div class="text-sm text-gray-500">
              <p><i class="fas fa-clock mr-1"></i>受信日時: \${new Date(sub.created_at).toLocaleString('ja-JP')}</p>
              <p><i class="fas fa-globe mr-1"></i>IP: \${sub.submitted_ip || '不明'}</p>
            </div>
            \${sub.status === 'submitted' ? \`
              <div class="flex gap-2 pt-4">
                <button onclick="approveSubmission('\${sub.id}'); document.getElementById('detail-modal').classList.add('hidden');" 
                  class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                  <i class="fas fa-check mr-2"></i>承認（会社情報に反映）
                </button>
                <button onclick="rejectSubmission('\${sub.id}'); document.getElementById('detail-modal').classList.add('hidden');" 
                  class="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                  <i class="fas fa-times mr-2"></i>却下
                </button>
              </div>
            \` : ''}
          </div>
        \`;
        
        document.getElementById('detail-modal').classList.remove('hidden');
      }
      
      async function approveSubmission(id) {
        if (!confirm('この入力を承認して会社情報に反映しますか？')) return;
        
        const data = await apiCall('/api/agency/submissions/' + id + '/approve', { method: 'POST' });
        if (data.success) {
          loadSubmissions();
        } else {
          alert('エラー: ' + (data.error?.message || '不明なエラー'));
        }
      }
      
      async function rejectSubmission(id) {
        const reason = prompt('却下理由（任意）:');
        
        const data = await apiCall('/api/agency/submissions/' + id + '/reject', { 
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        if (data.success) {
          loadSubmissions();
        } else {
          alert('エラー: ' + (data.error?.message || '不明なエラー'));
        }
      }
      
      // DOMContentLoaded で apiCall が定義されてから実行
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSubmissions);
      } else {
        if (typeof window.apiCall === 'function') {
          loadSubmissions();
        } else {
          setTimeout(loadSubmissions, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('入力受付', content, 'submissions'));
});

/**
 * GET /agency/members - スタッフ管理
 */
agencyPages.get('/agency/members', (c) => {
  const content = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900">
          <i class="fas fa-users mr-2"></i>スタッフ管理
        </h1>
        <button onclick="showInviteModal()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
          <i class="fas fa-user-plus mr-2"></i>スタッフを招待
        </button>
      </div>
      
      <!-- メンバー一覧 -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">メンバー</h2>
        </div>
        <div id="members-list" class="divide-y divide-gray-200">
          <div class="p-6 text-center text-gray-500">読み込み中...</div>
        </div>
      </div>
      
      <!-- 保留中の招待 -->
      <div id="pending-invites-section" class="bg-white rounded-lg shadow hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">保留中の招待</h2>
        </div>
        <div id="pending-invites-list" class="divide-y divide-gray-200">
        </div>
      </div>
      
      <!-- 招待モーダル -->
      <div id="invite-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">スタッフを招待</h3>
          </div>
          <form id="invite-form" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span class="text-red-500">*</span></label>
              <input type="email" name="email" required 
                class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="staff@example.com">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">役割</label>
              <select name="role" class="w-full border rounded-lg px-3 py-2">
                <option value="staff">スタッフ（顧客情報の閲覧・編集）</option>
                <option value="admin">管理者（スタッフ招待も可能）</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" name="sendEmail" id="send-email-checkbox" class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500">
              <label for="send-email-checkbox" class="text-sm text-gray-700">招待メールを送信する</label>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
              <i class="fas fa-info-circle mr-1"></i>
              招待リンクが生成されます。メール送信を選択すると、自動で招待メールが送信されます。
            </div>
            <div class="flex gap-2 pt-4">
              <button type="button" onclick="hideInviteModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button type="submit" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                招待リンクを発行
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 招待URL表示モーダル -->
      <div id="invite-url-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">
              <i class="fas fa-check-circle text-emerald-600 mr-2"></i>招待リンクが発行されました
            </h3>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-sm text-gray-600">以下のリンクをスタッフに共有してください：</p>
            <div class="bg-gray-50 p-3 rounded-lg">
              <input type="text" id="invite-url-input" readonly 
                class="w-full bg-transparent text-sm text-gray-800 outline-none"
                value="">
            </div>
            <div class="flex gap-2">
              <button onclick="copyInviteUrl()" class="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                <i class="fas fa-copy mr-2"></i>コピー
              </button>
              <button onclick="hideInviteUrlModal()" class="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                閉じる
              </button>
            </div>
            <p class="text-xs text-gray-500">
              <i class="fas fa-clock mr-1"></i>このリンクは7日間有効です
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      var currentUserRole = 'staff';
      var members = [];
      var pendingInvites = [];
      
      async function loadMembers() {
        var data = await window.apiCall('/api/agency/members');
        if (data.success) {
          members = data.data.members || [];
          pendingInvites = data.data.pending_invites || [];
          currentUserRole = data.data.current_user_role || 'staff';
          renderMembers();
          renderPendingInvites();
        } else {
          document.getElementById('members-list').innerHTML = 
            '<div class="p-6 text-center text-red-500">読み込みに失敗しました</div>';
        }
      }
      
      function renderMembers() {
        var container = document.getElementById('members-list');
        
        if (members.length === 0) {
          container.innerHTML = '<div class="p-6 text-center text-gray-500">メンバーがいません</div>';
          return;
        }
        
        var html = members.map(function(member) {
          var roleLabel = member.role === 'owner' ? 'オーナー' : 
                         member.role === 'admin' ? '管理者' : 'スタッフ';
          var roleColor = member.role === 'owner' ? 'bg-purple-100 text-purple-700' : 
                         member.role === 'admin' ? 'bg-blue-100 text-blue-700' : 
                         'bg-gray-100 text-gray-700';
          
          var actions = '';
          if (!member.is_owner && currentUserRole === 'owner') {
            actions = '<div class="flex gap-2">' +
              '<button onclick="changeRole(\\'' + member.membership_id + '\\', \\'' + member.role + '\\')" class="text-sm text-blue-600 hover:text-blue-800">' +
                '<i class="fas fa-exchange-alt mr-1"></i>役割変更' +
              '</button>' +
              '<button onclick="removeMember(\\'' + member.membership_id + '\\', \\'' + (member.name || member.email) + '\\')" class="text-sm text-red-600 hover:text-red-800">' +
                '<i class="fas fa-user-minus mr-1"></i>削除' +
              '</button>' +
            '</div>';
          }
          
          return '<div class="px-6 py-4 flex items-center justify-between">' +
            '<div class="flex items-center gap-4">' +
              '<div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">' +
                '<i class="fas fa-user text-emerald-600"></i>' +
              '</div>' +
              '<div>' +
                '<div class="font-medium text-gray-900">' + (member.name || '名前未設定') + '</div>' +
                '<div class="text-sm text-gray-500">' + member.email + '</div>' +
              '</div>' +
              '<span class="px-2 py-1 text-xs rounded-full ' + roleColor + '">' + roleLabel + '</span>' +
            '</div>' +
            actions +
          '</div>';
        }).join('');
        
        container.innerHTML = html;
      }
      
      function renderPendingInvites() {
        var section = document.getElementById('pending-invites-section');
        var container = document.getElementById('pending-invites-list');
        
        if (pendingInvites.length === 0) {
          section.classList.add('hidden');
          return;
        }
        
        section.classList.remove('hidden');
        
        var html = pendingInvites.map(function(invite) {
          var roleLabel = invite.role_in_agency === 'admin' ? '管理者' : 'スタッフ';
          var expiresAt = new Date(invite.expires_at).toLocaleDateString('ja-JP');
          
          return '<div class="px-6 py-4 flex items-center justify-between">' +
            '<div class="flex items-center gap-4">' +
              '<div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">' +
                '<i class="fas fa-envelope text-yellow-600"></i>' +
              '</div>' +
              '<div>' +
                '<div class="font-medium text-gray-900">' + invite.email + '</div>' +
                '<div class="text-sm text-gray-500">' + roleLabel + ' • 有効期限: ' + expiresAt + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="flex gap-2">' +
              '<button onclick="copyInviteCode(\\'' + invite.invite_code + '\\')" class="text-sm text-emerald-600 hover:text-emerald-800">' +
                '<i class="fas fa-copy mr-1"></i>コードをコピー' +
              '</button>' +
              '<button onclick="revokeInvite(\\'' + invite.id + '\\')" class="text-sm text-red-600 hover:text-red-800">' +
                '<i class="fas fa-times mr-1"></i>取り消し' +
              '</button>' +
            '</div>' +
          '</div>';
        }).join('');
        
        container.innerHTML = html;
      }
      
      function showInviteModal() {
        document.getElementById('invite-modal').classList.remove('hidden');
      }
      
      function hideInviteModal() {
        document.getElementById('invite-modal').classList.add('hidden');
        document.getElementById('invite-form').reset();
      }
      
      function hideInviteUrlModal() {
        document.getElementById('invite-url-modal').classList.add('hidden');
      }
      
      function copyInviteUrl() {
        var input = document.getElementById('invite-url-input');
        input.select();
        document.execCommand('copy');
        alert('招待リンクをコピーしました');
      }
      
      function copyInviteCode(code) {
        var url = window.location.origin + '/agency/join?code=' + code;
        navigator.clipboard.writeText(url).then(function() {
          alert('招待リンクをコピーしました');
        });
      }
      
      document.getElementById('invite-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var form = e.target;
        var formData = new FormData(form);
        
        var data = await window.apiCall('/api/agency/members/invite', {
          method: 'POST',
          body: JSON.stringify({
            email: formData.get('email'),
            role: formData.get('role'),
            sendEmail: formData.get('sendEmail') === 'on',
          }),
        });
        
        if (data.success) {
          hideInviteModal();
          document.getElementById('invite-url-input').value = data.data.invite_url;
          document.getElementById('invite-url-modal').classList.remove('hidden');
          
          // メール送信結果を表示
          if (data.data.email_sent) {
            var urlModalTitle = document.querySelector('#invite-url-modal h3');
            if (urlModalTitle) {
              urlModalTitle.innerHTML = '<i class="fas fa-check-circle text-emerald-600 mr-2"></i>招待メールを送信しました';
            }
          }
          
          loadMembers();
        } else {
          alert('エラー: ' + (data.error?.message || '招待の発行に失敗しました'));
        }
      });
      
      async function revokeInvite(inviteId) {
        if (!confirm('この招待を取り消しますか？')) return;
        
        var data = await window.apiCall('/api/agency/members/invite/' + inviteId, {
          method: 'DELETE',
        });
        
        if (data.success) {
          loadMembers();
        } else {
          alert('エラー: ' + (data.error?.message || '取り消しに失敗しました'));
        }
      }
      
      async function removeMember(membershipId, name) {
        if (!confirm(name + ' さんを事務所から削除しますか？')) return;
        
        var data = await window.apiCall('/api/agency/members/' + membershipId, {
          method: 'DELETE',
        });
        
        if (data.success) {
          loadMembers();
        } else {
          alert('エラー: ' + (data.error?.message || '削除に失敗しました'));
        }
      }
      
      async function changeRole(membershipId, currentRole) {
        var newRole = currentRole === 'admin' ? 'staff' : 'admin';
        var newRoleLabel = newRole === 'admin' ? '管理者' : 'スタッフ';
        
        if (!confirm('役割を「' + newRoleLabel + '」に変更しますか？')) return;
        
        var data = await window.apiCall('/api/agency/members/' + membershipId + '/role', {
          method: 'PUT',
          body: JSON.stringify({ role: newRole }),
        });
        
        if (data.success) {
          loadMembers();
        } else {
          alert('エラー: ' + (data.error?.message || '変更に失敗しました'));
        }
      }
      
      // DOMContentLoaded で apiCall が定義されてから実行
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMembers);
      } else {
        if (typeof window.apiCall === 'function') {
          loadMembers();
        } else {
          setTimeout(loadMembers, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('スタッフ管理', content, 'members'));
});

/**
 * GET /staff/setup - スタッフパスワード設定ページ
 * 認証不要 - 招待リンクからパスワードを設定
 */
agencyPages.get('/staff/setup', (c) => {
  const code = c.req.query('code') || '';
  const token = c.req.query('token') || '';
  
  const content = `
    <div class="max-w-md mx-auto">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-user-shield text-emerald-600 text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">スタッフアカウント設定</h1>
          <p class="text-gray-600 mt-2">パスワードを設定してログインできるようにします</p>
        </div>
        
        <div id="setup-status" class="hidden mb-6 p-4 rounded-lg"></div>
        
        <!-- ローディング -->
        <div id="loading-section" class="text-center py-8">
          <i class="fas fa-spinner fa-spin text-3xl text-emerald-600 mb-4"></i>
          <p class="text-gray-600">招待を確認中...</p>
        </div>
        
        <!-- 招待情報表示 -->
        <div id="invite-info" class="hidden mb-6 p-4 bg-gray-50 rounded-lg border">
          <p class="text-sm text-gray-600 mb-2">
            <i class="fas fa-building mr-2"></i>事務所: <strong id="agency-name-display" class="text-gray-900"></strong>
          </p>
          <p class="text-sm text-gray-600 mb-2">
            <i class="fas fa-envelope mr-2"></i>メール: <strong id="staff-email-display" class="text-gray-900"></strong>
          </p>
          <p class="text-sm text-gray-600">
            <i class="fas fa-user-tag mr-2"></i>役割: <strong id="staff-role-display" class="text-gray-900"></strong>
          </p>
        </div>
        
        <!-- パスワード設定フォーム -->
        <div id="setup-form-section" class="hidden">
          <form id="setup-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">お名前</label>
              <input type="text" name="name" id="staff-name-input"
                class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="山田 太郎">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input type="password" name="password" required minlength="8"
                class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="8文字以上">
              <p class="text-xs text-gray-500 mt-1">8文字以上、大文字・小文字・数字を含めてください</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">パスワード確認</label>
              <input type="password" name="password_confirm" required minlength="8"
                class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="パスワードを再入力">
            </div>
            <input type="hidden" name="code" value="${code}">
            <input type="hidden" name="token" value="${token}">
            <button type="submit" class="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 font-medium">
              <i class="fas fa-check mr-2"></i>設定を完了してログイン
            </button>
          </form>
        </div>
        
        <!-- 設定済み表示 -->
        <div id="already-setup-section" class="hidden text-center">
          <p class="text-gray-600 mb-4">パスワードは既に設定されています。</p>
          <a href="/login" class="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 font-medium">
            <i class="fas fa-sign-in-alt mr-2"></i>ログインへ
          </a>
        </div>
        
        <!-- エラー表示 -->
        <div id="error-section" class="hidden text-center">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
          </div>
          <p id="error-message" class="text-red-600 mb-4"></p>
          <a href="/login" class="text-emerald-600 hover:text-emerald-800">
            ログインページへ
          </a>
        </div>
        
        <!-- 成功表示 -->
        <div id="success-section" class="hidden text-center">
          <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check text-emerald-600 text-2xl"></i>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">設定完了！</h2>
          <p class="text-gray-600 mb-6">スタッフアカウントの設定が完了しました。</p>
          <a href="/agency" class="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 font-medium">
            <i class="fas fa-arrow-right mr-2"></i>事務所ダッシュボードへ
          </a>
        </div>
      </div>
    </div>
    
    <script>
      (function() {
        var code = '${code}';
        var token = '${token}';
        
        function showStatus(message, isError) {
          var statusDiv = document.getElementById('setup-status');
          statusDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-blue-100', 'text-blue-700');
          if (isError) {
            statusDiv.classList.add('bg-red-100', 'text-red-700');
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>' + message;
          } else {
            statusDiv.classList.add('bg-blue-100', 'text-blue-700');
            statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + message;
          }
        }
        
        function hideStatus() {
          document.getElementById('setup-status').classList.add('hidden');
        }
        
        // 招待を検証
        async function verifyInvite() {
          if (!code || !token) {
            document.getElementById('loading-section').classList.add('hidden');
            document.getElementById('error-section').classList.remove('hidden');
            document.getElementById('error-message').textContent = '招待リンクが無効です。';
            return;
          }
          
          try {
            var response = await fetch('/api/agency/staff/verify-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: code, token: token }),
            });
            
            var data = await response.json();
            document.getElementById('loading-section').classList.add('hidden');
            
            if (data.success) {
              if (data.data.status === 'already_setup') {
                document.getElementById('already-setup-section').classList.remove('hidden');
              } else {
                document.getElementById('invite-info').classList.remove('hidden');
                document.getElementById('setup-form-section').classList.remove('hidden');
                document.getElementById('agency-name-display').textContent = data.data.agency_name;
                document.getElementById('staff-email-display').textContent = data.data.staff_email;
                document.getElementById('staff-role-display').textContent = data.data.role === 'admin' ? '管理者' : 'スタッフ';
                document.getElementById('staff-name-input').value = data.data.staff_name || '';
              }
            } else {
              document.getElementById('error-section').classList.remove('hidden');
              document.getElementById('error-message').textContent = data.error?.message || '招待の検証に失敗しました';
            }
          } catch (err) {
            document.getElementById('loading-section').classList.add('hidden');
            document.getElementById('error-section').classList.remove('hidden');
            document.getElementById('error-message').textContent = '通信エラーが発生しました';
          }
        }
        
        // フォーム送信
        document.getElementById('setup-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          var form = e.target;
          var formData = new FormData(form);
          var password = formData.get('password');
          var passwordConfirm = formData.get('password_confirm');
          
          if (password !== passwordConfirm) {
            showStatus('パスワードが一致しません', true);
            return;
          }
          
          showStatus('設定中...', false);
          
          try {
            var response = await fetch('/api/agency/staff/setup-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: formData.get('code'),
                token: formData.get('token'),
                password: password,
                name: formData.get('name'),
              }),
            });
            
            var data = await response.json();
            
            if (data.success) {
              // トークンとユーザー情報を保存
              localStorage.setItem('token', data.data.token);
              localStorage.setItem('user', JSON.stringify(data.data.user));
              if (data.data.staff) {
                localStorage.setItem('staff', JSON.stringify(data.data.staff));
              }
              
              hideStatus();
              document.getElementById('invite-info').classList.add('hidden');
              document.getElementById('setup-form-section').classList.add('hidden');
              document.getElementById('success-section').classList.remove('hidden');
            } else {
              showStatus(data.error?.message || '設定に失敗しました', true);
            }
          } catch (err) {
            showStatus('通信エラーが発生しました', true);
          }
        });
        
        // 初期化
        verifyInvite();
      })();
    </script>
  `;
  
  return c.html(agencyLayout('スタッフアカウント設定', content, ''));
});

/**
 * GET /agency/join - 招待受諾ページ（旧方式 - 互換性のため残す）
 * 未ログインでも表示可能（登録フォームを表示）
 */
agencyPages.get('/agency/join', (c) => {
  const code = c.req.query('code') || '';
  const token = c.req.query('token') || '';
  
  const content = `
    <div class="max-w-md mx-auto">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-user-plus text-emerald-600 text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">事務所への招待</h1>
          <p class="text-gray-600 mt-2">招待を受諾して事務所に参加しましょう</p>
        </div>
        
        <div id="join-status" class="hidden mb-6 p-4 rounded-lg"></div>
        
        <!-- ==============================
             ログイン済みユーザー向け表示
             ============================== -->
        <div id="logged-in-section" class="hidden">
          <!-- 現在ログイン中のユーザー情報 -->
          <div id="current-user-info" class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p class="text-sm text-gray-600">
              <i class="fas fa-user mr-2"></i>現在ログイン中:
              <strong id="current-user-email" class="text-gray-800"></strong>
            </p>
          </div>
          
          <!-- メールアドレス不一致時の案内 -->
          <div id="email-mismatch-guide" class="hidden mb-6">
            <div class="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
              <p class="text-yellow-800 font-semibold mb-2">
                <i class="fas fa-exclamation-triangle mr-2"></i>アカウントを切り替えてください
              </p>
              <p class="text-yellow-700 text-sm mb-3" id="mismatch-message"></p>
              <div class="space-y-2">
                <button onclick="switchAccount()" class="w-full bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-medium text-sm">
                  <i class="fas fa-sign-out-alt mr-2"></i>ログアウトして別アカウントでログイン
                </button>
                <p class="text-xs text-yellow-600 text-center">
                  ※ログアウト後、このページに自動で戻ります
                </p>
              </div>
            </div>
          </div>
          
          <div id="join-form-container">
            <form id="join-form" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">招待コード</label>
                <input type="text" name="code" value="${code}" required 
                  class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="招待コードを入力">
              </div>
              <input type="hidden" name="token" value="${token}">
              <button type="submit" class="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 font-medium">
                <i class="fas fa-check mr-2"></i>招待を受諾する
              </button>
            </form>
            
            <div class="mt-4 pt-4 border-t border-gray-200 text-center">
              <button onclick="switchAccount()" class="text-sm text-gray-500 hover:text-gray-700">
                <i class="fas fa-exchange-alt mr-1"></i>別のアカウントで参加
              </button>
            </div>
          </div>
        </div>
        
        <!-- ==============================
             未ログインユーザー向け表示
             ============================== -->
        <div id="not-logged-in-section" class="hidden">
          <!-- タブ切り替え -->
          <div class="flex border-b border-gray-200 mb-6">
            <button id="tab-register" onclick="switchTab('register')" class="flex-1 py-3 text-center font-medium border-b-2 border-emerald-500 text-emerald-600">
              <i class="fas fa-user-plus mr-1"></i>新規登録
            </button>
            <button id="tab-login" onclick="switchTab('login')" class="flex-1 py-3 text-center font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-sign-in-alt mr-1"></i>ログイン
            </button>
          </div>
          
          <!-- 新規登録フォーム -->
          <div id="register-section">
            <p class="text-sm text-gray-600 mb-4">
              アカウントを作成して、招待を受諾します。
            </p>
            <form id="register-invite-form" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">お名前</label>
                <input type="text" name="name" required 
                  class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="山田 太郎">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input type="email" name="email" required 
                  class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="招待されたメールアドレス">
                <p class="text-xs text-gray-500 mt-1">招待されたメールアドレスを入力してください</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                <input type="password" name="password" required minlength="8"
                  class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="8文字以上">
                <p class="text-xs text-gray-500 mt-1">8文字以上、大文字・小文字・数字を含めてください</p>
              </div>
              <input type="hidden" name="inviteCode" value="${code}">
              <input type="hidden" name="inviteToken" value="${token}">
              <button type="submit" class="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 font-medium">
                <i class="fas fa-user-plus mr-2"></i>登録して参加
              </button>
            </form>
          </div>
          
          <!-- ログインフォーム -->
          <div id="login-section" class="hidden">
            <p class="text-sm text-gray-600 mb-4">
              既存のアカウントでログインして、招待を受諾します。
            </p>
            <form id="login-invite-form" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input type="email" name="email" required 
                  class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="example@company.com">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                <input type="password" name="password" required
                  class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="パスワード">
              </div>
              <input type="hidden" name="inviteCode" value="${code}">
              <input type="hidden" name="inviteToken" value="${token}">
              <button type="submit" class="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 font-medium">
                <i class="fas fa-sign-in-alt mr-2"></i>ログインして参加
              </button>
            </form>
            <div class="mt-4 text-center">
              <a href="/forgot" class="text-sm text-gray-500 hover:text-gray-700">
                パスワードを忘れた方
              </a>
            </div>
          </div>
        </div>
        
        <!-- ==============================
             成功画面（共通）
             ============================== -->
        <div id="join-success" class="hidden text-center">
          <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check text-emerald-600 text-2xl"></i>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">参加完了！</h2>
          <p id="success-message" class="text-gray-600 mb-6"></p>
          <a href="/agency" class="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 font-medium">
            <i class="fas fa-arrow-right mr-2"></i>事務所ダッシュボードへ
          </a>
        </div>
      </div>
    </div>
    
    <script>
      (function() {
        var authToken = localStorage.getItem('token');
        var userStr = localStorage.getItem('user');
        var user = null;
        var currentUserEmail = '';
        
        try {
          user = userStr ? JSON.parse(userStr) : null;
        } catch (e) {
          user = null;
        }
        
        // タブ切り替え関数
        window.switchTab = function(tab) {
          var tabRegister = document.getElementById('tab-register');
          var tabLogin = document.getElementById('tab-login');
          var registerSection = document.getElementById('register-section');
          var loginSection = document.getElementById('login-section');
          
          if (tab === 'register') {
            tabRegister.classList.add('border-emerald-500', 'text-emerald-600');
            tabRegister.classList.remove('border-transparent', 'text-gray-500');
            tabLogin.classList.remove('border-emerald-500', 'text-emerald-600');
            tabLogin.classList.add('border-transparent', 'text-gray-500');
            registerSection.classList.remove('hidden');
            loginSection.classList.add('hidden');
          } else {
            tabLogin.classList.add('border-emerald-500', 'text-emerald-600');
            tabLogin.classList.remove('border-transparent', 'text-gray-500');
            tabRegister.classList.remove('border-emerald-500', 'text-emerald-600');
            tabRegister.classList.add('border-transparent', 'text-gray-500');
            loginSection.classList.remove('hidden');
            registerSection.classList.add('hidden');
          }
        };
        
        // アカウント切替関数
        window.switchAccount = function() {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.reload();
        };
        
        // 成功表示関数
        function showSuccess(agencyName, role) {
          document.getElementById('logged-in-section').classList.add('hidden');
          document.getElementById('not-logged-in-section').classList.add('hidden');
          document.getElementById('join-success').classList.remove('hidden');
          document.getElementById('success-message').textContent = 
            '「' + (agencyName || '事務所') + '」に' + 
            (role === 'admin' ? '管理者' : 'スタッフ') + 'として参加しました。';
        }
        
        // ステータス表示関数
        function showStatus(message, isError) {
          var statusDiv = document.getElementById('join-status');
          statusDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-blue-100', 'text-blue-700', 'bg-emerald-100', 'text-emerald-700');
          if (isError) {
            statusDiv.classList.add('bg-red-100', 'text-red-700');
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>' + message;
          } else {
            statusDiv.classList.add('bg-blue-100', 'text-blue-700');
            statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + message;
          }
        }
        
        function hideStatus() {
          document.getElementById('join-status').classList.add('hidden');
        }
        
        // ログイン済みかどうかで表示を切り替え
        if (authToken && user) {
          // ログイン済み
          document.getElementById('logged-in-section').classList.remove('hidden');
          currentUserEmail = user.email || '(メールアドレス不明)';
          document.getElementById('current-user-email').textContent = currentUserEmail;
          
          // 既存ユーザー用フォーム送信
          document.getElementById('join-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            var form = e.target;
            var formData = new FormData(form);
            var mismatchGuide = document.getElementById('email-mismatch-guide');
            
            showStatus('処理中...', false);
            mismatchGuide.classList.add('hidden');
            
            try {
              var response = await fetch('/api/agency/members/join', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + authToken,
                },
                body: JSON.stringify({
                  code: formData.get('code'),
                  token: formData.get('token'),
                }),
              });
              
              var data = await response.json();
              
              if (data.success) {
                // ユーザー情報を更新
                user.role = 'agency';
                localStorage.setItem('user', JSON.stringify(user));
                showSuccess(data.data.agency?.name, data.data.role);
              } else {
                hideStatus();
                if (data.error?.code === 'EMAIL_MISMATCH') {
                  mismatchGuide.classList.remove('hidden');
                  var inviteEmail = data.error.message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)/);
                  inviteEmail = inviteEmail ? inviteEmail[0] : '招待先メールアドレス';
                  document.getElementById('mismatch-message').innerHTML = 
                    'この招待は <strong>' + inviteEmail + '</strong> 宛てです。<br>' +
                    '現在は <strong>' + currentUserEmail + '</strong> でログインしています。<br>' +
                    '招待を受諾するには、招待先のメールアドレスでログインしてください。';
                } else {
                  showStatus(data.error?.message || '招待の受諾に失敗しました', true);
                }
              }
            } catch (err) {
              showStatus('通信エラーが発生しました', true);
            }
          });
        } else {
          // 未ログイン - 新規登録/ログインフォームを表示
          document.getElementById('not-logged-in-section').classList.remove('hidden');
          
          // 新規登録＋招待受諾フォーム
          document.getElementById('register-invite-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            var form = e.target;
            var formData = new FormData(form);
            
            showStatus('アカウントを作成中...', false);
            
            try {
              var response = await fetch('/api/auth/register-with-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: formData.get('name'),
                  email: formData.get('email'),
                  password: formData.get('password'),
                  inviteCode: formData.get('inviteCode'),
                  inviteToken: formData.get('inviteToken'),
                }),
              });
              
              var data = await response.json();
              
              if (data.success) {
                // トークンとユーザー情報を保存
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('user', JSON.stringify(data.data.user));
                showSuccess(data.data.agency?.name, data.data.role_in_agency);
              } else {
                showStatus(data.error?.message || '登録に失敗しました', true);
              }
            } catch (err) {
              showStatus('通信エラーが発生しました', true);
            }
          });
          
          // ログイン＋招待受諾フォーム
          document.getElementById('login-invite-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            var form = e.target;
            var formData = new FormData(form);
            
            showStatus('ログイン中...', false);
            
            try {
              // まずログイン
              var loginResponse = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: formData.get('email'),
                  password: formData.get('password'),
                }),
              });
              
              var loginData = await loginResponse.json();
              
              if (!loginData.success) {
                showStatus(loginData.error?.message || 'ログインに失敗しました', true);
                return;
              }
              
              // ログイン成功 - トークンを保存
              var newToken = loginData.data.token;
              var newUser = loginData.data.user;
              localStorage.setItem('token', newToken);
              localStorage.setItem('user', JSON.stringify(newUser));
              
              showStatus('招待を受諾中...', false);
              
              // 招待受諾
              var joinResponse = await fetch('/api/agency/members/join', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + newToken,
                },
                body: JSON.stringify({
                  code: formData.get('inviteCode'),
                  token: formData.get('inviteToken'),
                }),
              });
              
              var joinData = await joinResponse.json();
              
              if (joinData.success) {
                newUser.role = 'agency';
                localStorage.setItem('user', JSON.stringify(newUser));
                showSuccess(joinData.data.agency?.name, joinData.data.role);
              } else {
                if (joinData.error?.code === 'EMAIL_MISMATCH') {
                  showStatus('この招待は別のメールアドレス宛てです。招待されたメールアドレスでログインしてください。', true);
                } else {
                  showStatus(joinData.error?.message || '招待の受諾に失敗しました', true);
                }
              }
            } catch (err) {
              showStatus('通信エラーが発生しました', true);
            }
          });
        }
      })();
    </script>
  `;
  
  return c.html(agencyLayout('招待を受諾', content, ''));
});

/**
 * /agency/settings - 設定画面
 */
agencyPages.get('/agency/settings', (c) => {
  const content = `
    <div class="max-w-2xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">
        <i class="fas fa-cog mr-2"></i>設定
      </h1>
      
      <!-- アカウント設定 -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            <i class="fas fa-user mr-2"></i>アカウント設定
          </h2>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input type="email" id="user-email" readonly
              class="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500">
            <p class="text-xs text-gray-500 mt-1">メールアドレスは変更できません</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">名前</label>
            <input type="text" id="user-name-input"
              class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
          </div>
          <button onclick="updateName()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            名前を更新
          </button>
        </div>
      </div>
      
      <!-- パスワード変更 -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            <i class="fas fa-lock mr-2"></i>パスワード変更
          </h2>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
            <input type="password" id="current-password"
              class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input type="password" id="new-password"
              class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <p class="text-xs text-gray-500 mt-1">8文字以上、大文字・小文字・数字を含む</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
            <input type="password" id="confirm-password"
              class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
          </div>
          <button onclick="changePassword()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            パスワードを変更
          </button>
        </div>
      </div>
      
      <!-- 事務所設定（オーナーのみ） -->
      <div id="agency-settings-section" class="bg-white rounded-lg shadow hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            <i class="fas fa-building mr-2"></i>事務所設定
          </h2>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">事務所名</label>
            <input type="text" id="agency-name-input"
              class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
          </div>
          <button onclick="updateAgencyName()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
            事務所名を更新
          </button>
        </div>
      </div>
    </div>
    
    <script>
      var agencyInfo = null;
      var isOwner = false;
      
      async function loadSettings() {
        // ユーザー情報
        var user = window.currentUser;
        if (user) {
          document.getElementById('user-email').value = user.email || '';
          document.getElementById('user-name-input').value = user.name || '';
        }
        
        // Agency情報
        var data = await window.apiCall('/api/agency/me');
        if (data.success && data.data) {
          agencyInfo = data.data.agency;
          isOwner = data.data.role === 'owner';
          
          if (isOwner && agencyInfo) {
            document.getElementById('agency-settings-section').classList.remove('hidden');
            document.getElementById('agency-name-input').value = agencyInfo.name || '';
          }
        }
      }
      
      async function updateName() {
        var name = document.getElementById('user-name-input').value.trim();
        if (!name) {
          alert('名前を入力してください');
          return;
        }
        
        var data = await window.apiCall('/api/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
        
        if (data.success) {
          alert('名前が更新されました');
          // localStorageも更新
          var userStr = localStorage.getItem('user');
          if (userStr) {
            var user = JSON.parse(userStr);
            user.name = name;
            localStorage.setItem('user', JSON.stringify(user));
          }
        } else {
          alert('エラー: ' + (data.error?.message || '更新に失敗しました'));
        }
      }
      
      async function changePassword() {
        var currentPassword = document.getElementById('current-password').value;
        var newPassword = document.getElementById('new-password').value;
        var confirmPassword = document.getElementById('confirm-password').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
          alert('すべてのフィールドを入力してください');
          return;
        }
        
        if (newPassword !== confirmPassword) {
          alert('新しいパスワードが一致しません');
          return;
        }
        
        if (newPassword.length < 8) {
          alert('パスワードは8文字以上必要です');
          return;
        }
        
        var data = await window.apiCall('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        
        if (data.success) {
          alert('パスワードが変更されました');
          document.getElementById('current-password').value = '';
          document.getElementById('new-password').value = '';
          document.getElementById('confirm-password').value = '';
        } else {
          alert('エラー: ' + (data.error?.message || 'パスワード変更に失敗しました'));
        }
      }
      
      async function updateAgencyName() {
        var name = document.getElementById('agency-name-input').value.trim();
        if (!name) {
          alert('事務所名を入力してください');
          return;
        }
        
        var data = await window.apiCall('/api/agency/settings', {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
        
        if (data.success) {
          alert('事務所名が更新されました');
        } else {
          alert('エラー: ' + (data.error?.message || '更新に失敗しました'));
        }
      }
      
      // 初期化
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSettings);
      } else {
        loadSettings();
      }
    </script>
  `;
  
  return c.html(agencyLayout('設定', content, 'settings'));
});

/**
 * GET /agency/search - 士業向け補助金検索
 * 凍結仕様v1: User版 /subsidies と同一のUI/UXに統一
 */
agencyPages.get('/agency/search', (c) => {
  const content = `
    <style>
      .condition-badge { transition: all 0.2s; }
      .condition-badge:hover { transform: scale(1.05); }
      .card-hover { transition: all 0.3s; }
      .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
      .mode-toggle { transition: all 0.2s; }
      .mode-toggle.active { background-color: #059669; color: white; }
    </style>
    
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-search text-emerald-600 mr-2"></i>補助金を探す（顧客向け）
      </h1>
      <p class="text-gray-600 mt-1">顧客企業に合った補助金を検索・マッチングします</p>
    </div>
    
    <!-- 顧客企業ステータス表示 -->
    <div id="client-status" class="hidden mb-6"></div>
    
    <!-- 検索・フィルターパネル -->
    <div id="search-panel" class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- 顧客企業選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">顧客企業</label>
          <select id="client-select" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500">
            <option value="">顧客を選択...</option>
          </select>
        </div>
        
        <!-- キーワード -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">キーワード</label>
          <input type="text" id="keyword" placeholder="例: IT導入、省エネ、人材育成" 
                 class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500">
        </div>
        
        <!-- 受付状況 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">受付状況</label>
          <select id="acceptance" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500">
            <option value="1">受付中のみ</option>
            <option value="0">すべて表示</option>
          </select>
        </div>
        
        <!-- 検索ボタン -->
        <div class="flex items-end">
          <button onclick="searchSubsidies()" 
                  class="w-full bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center justify-center">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
      
      <!-- 検索モード切替 -->
      <div class="mt-4 pt-4 border-t">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-sm font-medium text-gray-700">表示モード:</span>
            <div class="flex rounded-md overflow-hidden border">
              <button onclick="setSearchMode('match')" id="mode-match" 
                      class="mode-toggle px-4 py-2 text-sm font-medium active">
                <i class="fas fa-check-circle mr-1"></i>当てはまるもの優先
              </button>
              <button onclick="setSearchMode('all')" id="mode-all"
                      class="mode-toggle px-4 py-2 text-sm font-medium border-l">
                <i class="fas fa-list mr-1"></i>全件表示
              </button>
            </div>
          </div>
          <div id="mode-description" class="text-xs text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>条件に合う補助金を優先表示し、合わないものは下部に表示します
          </div>
        </div>
      </div>
      
      <!-- フィルター（折りたたみ） -->
      <details class="mt-4">
        <summary class="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
          <i class="fas fa-filter mr-1"></i>詳細フィルター
        </summary>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select id="status-filter" class="w-full px-3 py-2 border rounded-md text-sm">
              <option value="">すべて</option>
              <option value="PROCEED">推奨（PROCEED）</option>
              <option value="CAUTION">注意（CAUTION）</option>
              <option value="NO">非推奨（NO）</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ソート</label>
            <select id="sort" class="w-full px-3 py-2 border rounded-md text-sm">
              <option value="score">マッチ度順</option>
              <option value="acceptance_end_datetime">締切日順</option>
              <option value="subsidy_max_limit">補助上限順</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">表示件数</label>
            <select id="limit" class="w-full px-3 py-2 border rounded-md text-sm">
              <option value="20">20件</option>
              <option value="50">50件</option>
              <option value="100">100件</option>
              <option value="200">200件</option>
              <option value="500">500件</option>
              <option value="all">全件（最大500件）</option>
            </select>
          </div>
        </div>
      </details>
    </div>
    
    <!-- 検索結果サマリー -->
    <div id="result-summary" class="hidden mb-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-600">
          <span id="result-count">0</span>件の補助金が見つかりました
          <span id="data-source" class="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs"></span>
        </div>
        <div class="flex space-x-2">
          <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs cursor-help" title="条件に合致。申請の検討をおすすめします">
            <i class="fas fa-check-circle mr-1"></i>推奨: <span id="count-proceed">0</span>
          </span>
          <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs cursor-help" title="一部条件の確認が必要。詳細を確認してください">
            <i class="fas fa-exclamation-triangle mr-1"></i>注意: <span id="count-caution">0</span>
          </span>
          <span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs cursor-help" title="現在の条件では申請が難しい可能性があります">
            <i class="fas fa-times-circle mr-1"></i>非推奨: <span id="count-no">0</span>
          </span>
        </div>
      </div>
      
      <!-- ステータス説明 -->
      <div class="mt-3 p-3 bg-white rounded-lg border text-xs">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="flex items-start gap-2">
            <span class="px-2 py-1 bg-green-100 text-green-800 rounded font-medium whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i>推奨</span>
            <span class="text-gray-600">会社の条件に合致しており、申請を検討することをおすすめします</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded font-medium whitespace-nowrap"><i class="fas fa-exclamation-triangle mr-1"></i>注意</span>
            <span class="text-gray-600">一部条件の確認が必要です。詳細ページで要件を確認してください</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="px-2 py-1 bg-red-100 text-red-800 rounded font-medium whitespace-nowrap"><i class="fas fa-times-circle mr-1"></i>非推奨</span>
            <span class="text-gray-600">現在の会社情報では申請要件を満たしていない可能性があります</span>
          </div>
        </div>
      </div>
      
      <!-- 条件凡例 -->
      <div class="mt-2 flex items-center space-x-4 text-xs text-gray-500">
        <span><span class="inline-block w-3 h-3 bg-green-100 border border-green-400 rounded mr-1"></span>達成条件</span>
        <span><span class="inline-block w-3 h-3 bg-red-100 border border-red-400 rounded mr-1"></span>未達条件</span>
        <span><span class="inline-block w-3 h-3 bg-gray-100 border border-gray-400 rounded mr-1"></span>確認が必要</span>
      </div>
    </div>
    
    <!-- 補助金一覧 -->
    <div id="subsidies-list" class="space-y-4">
      <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        <i class="fas fa-info-circle text-4xl mb-4"></i>
        <p>顧客企業を選択して検索を実行してください</p>
      </div>
    </div>
    
    <!-- ページネーション -->
    <div id="pagination" class="hidden mt-6 flex justify-center space-x-2">
    </div>
    
    <!-- ローディング -->
    <div id="loading" class="hidden fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 shadow-xl">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
        <p class="mt-4 text-gray-600">補助金を検索中...</p>
      </div>
    </div>
    
    <script>
      let currentResults = [];
      let currentPage = 1;
      let searchMode = 'match';
      let clients = [];
      
      // XSS対策: HTMLエスケープ関数
      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      // 顧客編集リンクを安全に生成
      // 凍結仕様: client.id ?? client.agency_client_id ?? client.client_id で冗長に受け取る
      function getClientEditLink(client, linkText, btnClass) {
        const defaultBtnClass = 'inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm';
        const fallbackBtnClass = btnClass ? btnClass.replace('bg-red-600', 'bg-gray-600').replace('hover:bg-red-700', 'hover:bg-gray-700') : 'inline-flex items-center gap-1 text-gray-500 text-sm';
        
        // 凍結仕様: 複数の候補から id を取得（APIが揺れても壊れない）
        const clientId = client?.id || client?.agency_client_id || client?.client_id;
        
        if (!client || !clientId) {
          // client.id が無い場合は顧客一覧へのリンクを返す
          console.warn('[Agency検索] client.id is missing:', client);
          return '<a href="/agency/clients" class="' + fallbackBtnClass + '"><i class="fas fa-list text-xs"></i> 顧客一覧へ</a>';
        }
        // UUID形式の検証（短いIDも許容：テストデータ用）
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const shortIdRegex = /^[a-zA-Z0-9_-]+$/;
        if (!uuidRegex.test(clientId) && !shortIdRegex.test(clientId)) {
          console.warn('[Agency検索] Invalid client.id format:', clientId);
          return '<a href="/agency/clients" class="' + fallbackBtnClass + '"><i class="fas fa-list text-xs"></i> 顧客一覧へ</a>';
        }
        return '<a href="/agency/clients/' + encodeURIComponent(clientId) + '" class="' + (btnClass || defaultBtnClass) + '"><i class="fas fa-edit"></i> ' + escapeHtml(linkText || '顧客情報を編集') + '</a>';
      }
      
      // 検索モード切替
      window.setSearchMode = function(mode) {
        searchMode = mode;
        document.getElementById('mode-match').classList.toggle('active', mode === 'match');
        document.getElementById('mode-all').classList.toggle('active', mode === 'all');
        
        const desc = document.getElementById('mode-description');
        if (mode === 'match') {
          desc.innerHTML = '<i class="fas fa-info-circle mr-1"></i>条件に合う補助金を優先表示し、合わないものは下部に表示します';
        } else {
          desc.innerHTML = '<i class="fas fa-info-circle mr-1"></i>条件に関係なく全件を表示します（学習・比較用）';
        }
        
        if (currentResults.length > 0) {
          renderResults(currentResults, null);
        }
      }
      
      // 顧客一覧取得（3パターン対応: 0社 / 全社NG / 1社以上OK）
      async function loadClients() {
        try {
          const res = await apiCall('/api/agency/clients?limit=100');
          console.log('[Agency検索] Clients API response:', JSON.stringify(res, null, 2));
          
          if (!res || !res.success) {
            console.error('[Agency検索] API error:', res?.error);
            showNoClientAlert();
            return;
          }
          
          const data = res.data;
          const allClients = data?.clients || [];
          const okCount = data?.ok_count || 0;
          const blockedCount = data?.blocked_count || 0;
          const total = allClients.length;
          
          // パターン1: 顧客0社
          if (total === 0) {
            showNoClientAlert();
            return;
          }
          
          // パターン2: 全社が必須情報不足
          if (okCount === 0) {
            showAllClientsBlockedAlert(total, allClients);
            return;
          }
          
          // パターン3: 1社以上OK → 検索可能
          clients = allClients;
          const okClients = allClients.filter(c => c.completeness_status === 'OK');
          const blockedClients = allClients.filter(c => c.completeness_status === 'BLOCKED');
          
          const select = document.getElementById('client-select');
          if (!select) return;
          
          // OK顧客のみドロップダウンに追加
          okClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.company_id;
            option.textContent = client.client_name || client.company_name || '(顧客名未設定)';
            select.appendChild(option);
          });
          
          // BLOCKED顧客がいる場合は案内を表示
          if (blockedCount > 0) {
            showPartialBlockedNotice(okCount, blockedCount, blockedClients);
          }
          
          // 顧客選択変更時
          select.addEventListener('change', function() {
            var selectedCompanyId = this.value;
            if (selectedCompanyId) {
              const client = clients.find(c => c.company_id === selectedCompanyId);
              if (client) {
                showClientReadySimple(client);
              }
            }
          });
          
          // 自動選択: URLパラメータ or localStorage or 最初のOK顧客
          const urlParams = new URLSearchParams(window.location.search);
          const urlCompanyId = urlParams.get('company_id');
          const storedCompanyId = localStorage.getItem('selectedCompanyId');
          if (storedCompanyId) localStorage.removeItem('selectedCompanyId');
          
          // 指定されたIDがOK顧客にあるか確認
          const targetCompanyId = urlCompanyId || storedCompanyId;
          const targetOkClient = targetCompanyId ? okClients.find(c => c.company_id === targetCompanyId) : null;
          const selectedClient = targetOkClient || okClients[0];
          
          select.value = selectedClient.company_id;
          showClientReadySimple(selectedClient);
          enableSearchPanel();
          
        } catch (e) {
          console.error('loadClients error:', e);
          showNoClientAlert();
        }
      }
      
      // 全顧客が必須情報不足の場合
      function showAllClientsBlockedAlert(total, allClients) {
        const statusEl = document.getElementById('client-status');
        if (!statusEl) return;
        
        // 不足情報の例を収集
        const missingExamples = allClients.slice(0, 3).map(c => {
          const name = escapeHtml(c.client_name || c.company_name || '(名前未設定)');
          const missing = (c.missing_fields || []).map(m => escapeHtml(m)).join('、');
          return '<li class="text-sm text-red-700">' + name + ': <span class="text-red-500">' + (missing || '不明') + '</span>が未登録</li>';
        }).join('');
        
        statusEl.className = 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-300 rounded-xl p-5 mb-6';
        statusEl.innerHTML = 
          '<div class="flex items-start gap-4">' +
            '<div class="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-users-slash text-red-600 text-xl"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-red-800 font-semibold text-lg"><i class="fas fa-exclamation-triangle mr-2"></i>' + total + '社登録済み - 全社とも必須情報が不足しています</p>' +
              '<p class="text-red-700 text-sm mt-1 mb-3">' +
                '補助金検索を行うには、顧客企業の<strong>必須4項目（会社名・都道府県・業種・従業員数）</strong>を登録してください。' +
              '</p>' +
              '<ul class="mb-3 pl-2 space-y-1">' + missingExamples + '</ul>' +
              '<div class="bg-white/70 rounded-lg p-3 mb-3 text-sm text-red-800">' +
                '<i class="fas fa-lightbulb mr-2 text-yellow-500"></i>' +
                '<strong>メリット:</strong> 必須情報を登録すると、' +
                '<span class="font-semibold">47都道府県＋国の補助金から最適なものを自動マッチング</span>できます。' +
              '</div>' +
              '<a href="/agency/clients" class="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition shadow">' +
                '<i class="fas fa-list"></i> 顧客一覧で情報を編集する' +
              '</a>' +
            '</div>' +
          '</div>';
        statusEl.classList.remove('hidden');
        
        // ドロップダウンを非表示
        const selectWrapper = document.getElementById('client-select')?.closest('.flex');
        if (selectWrapper) selectWrapper.style.display = 'none';
        
        disableSearchPanel();
      }
      
      // 一部顧客がBLOCKEDの場合の通知（検索パネル上部に表示）
      function showPartialBlockedNotice(okCount, blockedCount, blockedClients) {
        const statusEl = document.getElementById('client-status');
        if (!statusEl) return;
        
        const blockedNames = blockedClients.slice(0, 3).map(c => {
          return escapeHtml(c.client_name || c.company_name || '(名前未設定)');
        }).join('、');
        const moreText = blockedCount > 3 ? '他' + (blockedCount - 3) + '社' : '';
        
        statusEl.className = 'bg-gradient-to-r from-green-50 to-yellow-50 border border-green-300 rounded-xl p-4 mb-6';
        statusEl.innerHTML = 
          '<div class="flex items-start gap-3">' +
            '<div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-check-circle text-green-600 text-lg"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-green-800 font-semibold">✓ ' + okCount + '社で検索可能</p>' +
              '<p class="text-yellow-700 text-sm mt-1">' +
                '<i class="fas fa-info-circle mr-1"></i>' +
                '<strong>' + blockedCount + '社</strong>は必須情報が不足のため検索できません' +
                (blockedNames ? '（' + blockedNames + (moreText ? '、' + moreText : '') + '）' : '') +
                ' <a href="/agency/clients" class="text-blue-600 hover:underline ml-1"><i class="fas fa-edit text-xs"></i>編集する</a>' +
              '</p>' +
            '</div>' +
          '</div>';
        statusEl.classList.remove('hidden');
      }
      
      // OK顧客選択時のシンプル表示
      function showClientReadySimple(client) {
        // partialBlockedNoticeが表示されている場合は維持
        // 検索パネルは有効のまま
        enableSearchPanel();
      }
      
      // 個別completeness API呼び出し（詳細表示用、必要な場合のみ）
      async function checkClientCompleteness(companyId) {
        try {
          const res = await apiCall('/api/companies/' + companyId + '/completeness');
          console.log('[Agency検索] Completeness API response:', JSON.stringify(res, null, 2));
          
          if (!res || !res.success) {
            console.error('[Agency検索] Completeness API error:', res?.error);
            return null;
          }
          
          return res.data;
        } catch (e) {
          console.error('[Agency検索] checkClientCompleteness error:', e);
          return null;
        }
      }
      
      // OK: 顧客情報完了
      function showClientReady(completeness, client) {
        const statusEl = document.getElementById('client-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl p-4 mb-6';
        statusEl.innerHTML = 
          '<div class="flex items-start gap-3">' +
            '<div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-check-circle text-green-600 text-lg"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-green-800 font-semibold">✓ 顧客情報完了 - 最適なマッチングが可能です</p>' +
              '<p class="text-green-700 text-sm mt-1">' +
                '<strong>' + escapeHtml(client?.client_name || client?.company_name || '') + '</strong> で検索できます。' +
                '必須情報・推奨情報がすべて登録されているため、最も精度の高いマッチングが可能です。' +
              '</p>' +
              '<div class="flex items-center gap-2 mt-2 text-sm text-green-600">' +
                '<span class="px-2 py-1 bg-green-100 rounded-full"><i class="fas fa-check mr-1"></i>必須 ' + completeness.required_filled + '/' + completeness.required_count + '</span>' +
                '<span class="px-2 py-1 bg-green-100 rounded-full"><i class="fas fa-check mr-1"></i>推奨 ' + completeness.recommended_filled + '/' + completeness.recommended_count + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
        statusEl.classList.remove('hidden');
        enableSearchPanel();
      }
      
      // NEEDS_RECOMMENDED: 必須OK、推奨不足
      function showNeedsRecommendedAlert(completeness, client) {
        const statusEl = document.getElementById('client-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-300 rounded-xl p-4 mb-6';
        statusEl.classList.remove('hidden');
        
        var missingBadges = (completeness.missing_recommended || []).map(function(m) {
          return '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"><i class="fas fa-plus-circle mr-1"></i>' + escapeHtml(m) + '</span>';
        }).join(' ');
        
        var benefitsHtml = (completeness.benefits || []).slice(0, 3).map(function(b) {
          return '<li class="text-sm text-blue-700">• ' + escapeHtml(b) + '</li>';
        }).join('');
        
        // 編集リンク: client.id (agency_client_id) が存在する場合のみ表示
        var editLink = getClientEditLink(client, '顧客情報を編集');
        
        statusEl.innerHTML = 
          '<div class="flex items-start gap-3">' +
            '<div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-check-circle text-green-600 text-lg"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-green-800 font-semibold">✓ 検索可能 - <strong>' + escapeHtml(client?.client_name || client?.company_name || '') + '</strong></p>' +
              '<div class="flex items-center gap-2 mt-1 text-sm">' +
                '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full"><i class="fas fa-check mr-1"></i>必須 ' + completeness.required_filled + '/' + completeness.required_count + '</span>' +
                '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full"><i class="fas fa-info-circle mr-1"></i>推奨 ' + completeness.recommended_filled + '/' + completeness.recommended_count + '</span>' +
              '</div>' +
              '<details class="mt-3">' +
                '<summary class="text-sm text-blue-700 cursor-pointer hover:text-blue-800"><i class="fas fa-lightbulb mr-1"></i>さらに精度を上げるには（推奨項目）</summary>' +
                '<div class="mt-2 p-3 bg-white/70 rounded-lg">' +
                  '<div class="flex flex-wrap gap-1 mb-2">' + missingBadges + '</div>' +
                  '<ul class="space-y-1 mb-2">' + benefitsHtml + '</ul>' +
                  editLink +
                '</div>' +
              '</details>' +
            '</div>' +
          '</div>';
        
        enableSearchPanel();
      }
      
      // BLOCKED: 必須項目不足
      function showBlockedClientAlert(completeness, client) {
        const statusEl = document.getElementById('client-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-300 rounded-xl p-5 mb-6';
        statusEl.classList.remove('hidden');
        
        var requiredChecklist = '';
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required?.name ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required?.name ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>会社名</span></div>';
        
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required?.prefecture ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required?.prefecture ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>都道府県</span></div>';
        
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required?.industry_major ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required?.industry_major ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>業種</span></div>';
        
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required?.employee_count ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required?.employee_count ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>従業員数</span></div>';
        
        statusEl.innerHTML = 
          '<div class="flex items-start gap-4">' +
            '<div class="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-exclamation-triangle text-red-600 text-xl"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-red-800 font-semibold text-lg"><i class="fas fa-lock mr-1"></i>顧客情報が不足しています</p>' +
              '<p class="text-red-700 text-sm mt-1 mb-3">' +
                '<strong>' + escapeHtml(client?.client_name || client?.company_name || 'この顧客') + '</strong> の補助金検索を行うには、以下の<strong>必須4項目</strong>をすべて入力してください:' +
              '</p>' +
              '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-white/50 rounded-lg">' + requiredChecklist + '</div>' +
              '<div class="bg-white/70 rounded-lg p-3 mb-3 text-sm text-red-800">' +
                '<i class="fas fa-lightbulb mr-2 text-yellow-500"></i>' +
                '<strong>メリット:</strong> 必須情報を登録すると、' +
                '<span class="font-semibold">47都道府県＋国の補助金から最適なものを自動マッチング</span>できます。' +
              '</div>' +
              getClientEditLink(client, '顧客情報を編集する', 'inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition shadow') +
            '</div>' +
          '</div>';
        
        disableSearchPanel();
      }
      
      // 顧客が存在しない場合（0社）
      function showNoClientAlert() {
        const statusEl = document.getElementById('client-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-xl p-5 mb-6';
        statusEl.innerHTML = 
          '<div class="flex items-start gap-4">' +
            '<div class="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-building text-blue-600 text-xl"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-blue-800 font-semibold text-lg"><i class="fas fa-user-plus mr-2"></i>顧客企業を登録してください</p>' +
              '<p class="text-blue-700 text-sm mt-1 mb-3">' +
                '補助金検索を始めるには、まず<strong>顧客企業の基本情報（会社名・都道府県・業種・従業員数）</strong>を登録してください。' +
              '</p>' +
              '<a href="/agency/clients" class="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition shadow-md">' +
                '<i class="fas fa-plus-circle"></i> 顧客企業を追加する' +
              '</a>' +
            '</div>' +
          '</div>';
        statusEl.classList.remove('hidden');
        
        // 顧客選択ドロップダウンを非表示
        const selectWrapper = document.getElementById('client-select')?.closest('.flex');
        if (selectWrapper) selectWrapper.style.display = 'none';
        
        disableSearchPanel();
      }
      
      function enableSearchPanel() {
        const panel = document.getElementById('search-panel');
        if (panel) {
          panel.classList.remove('opacity-50', 'pointer-events-none');
        }
      }
      
      function disableSearchPanel() {
        const panel = document.getElementById('search-panel');
        if (panel) {
          panel.classList.add('opacity-50', 'pointer-events-none');
        }
        
        document.getElementById('subsidies-list').innerHTML = 
          '<div class="bg-white rounded-lg shadow p-8 text-center">' +
            '<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">' +
              '<i class="fas fa-lock text-gray-400 text-2xl"></i>' +
            '</div>' +
            '<p class="text-gray-600">必須4項目を入力すると検索できます</p>' +
          '</div>';
      }
      
      // 補助金検索
      window.searchSubsidies = async function(page = 1) {
        var clientSelect = document.getElementById('client-select');
        var companyId = clientSelect ? clientSelect.value : '';
        if (!companyId) {
          alert('顧客企業を選択してください');
          return;
        }
        
        currentPage = page;
        var limitEl = document.getElementById('limit');
        var limitValue = limitEl ? limitEl.value : '50';
        // 'all' または無効な値の場合は500（バックエンド最大値）を使用
        var limit = (limitValue === 'all' || isNaN(parseInt(limitValue))) ? 500 : Math.min(parseInt(limitValue), 500);
        if (limit <= 0) limit = 50;
        var offset = (page - 1) * limit;
        
        var keywordEl = document.getElementById('keyword');
        var acceptanceEl = document.getElementById('acceptance');
        var sortEl = document.getElementById('sort');
        
        var params = new URLSearchParams({
          company_id: companyId,
          keyword: keywordEl ? keywordEl.value || '' : '',
          acceptance: acceptanceEl ? acceptanceEl.value || '1' : '1',
          sort: sortEl ? sortEl.value || 'score' : 'score',
          order: sortEl && sortEl.value === 'score' ? 'DESC' : 'ASC',
          limit: limit.toString(),
          offset: offset.toString()
        });
        
        document.getElementById('loading').classList.remove('hidden');
        
        try {
          const res = await apiCall('/api/subsidies/search?' + params);
          
          if (res.success) {
            currentResults = res.data;
            renderResults(res.data, res.meta);
          } else {
            document.getElementById('subsidies-list').innerHTML = 
              '<div class="bg-red-50 rounded-lg p-4 text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>' + 
              (res.error?.message || '検索に失敗しました') + '</div>';
          }
        } catch (e) {
          console.error('Search error:', e);
          document.getElementById('subsidies-list').innerHTML = 
            '<div class="bg-red-50 rounded-lg p-4 text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>検索中にエラーが発生しました</div>';
        } finally {
          document.getElementById('loading').classList.add('hidden');
        }
      }
      
      // 結果描画（User版と同一）
      function renderResults(results, meta) {
        const statusFilter = document.getElementById('status-filter').value;
        let filtered = results;
        
        if (statusFilter) {
          filtered = results.filter(r => r.evaluation.status === statusFilter);
        }
        
        if (searchMode === 'match') {
          const statusOrder = { 'PROCEED': 0, 'CAUTION': 1, 'DO_NOT_PROCEED': 2, 'NO': 2 };
          filtered.sort((a, b) => {
            const orderDiff = statusOrder[a.evaluation.status] - statusOrder[b.evaluation.status];
            if (orderDiff !== 0) return orderDiff;
            return (b.evaluation.score || 0) - (a.evaluation.score || 0);
          });
        }
        
        document.getElementById('result-summary').classList.remove('hidden');
        document.getElementById('result-count').textContent = meta?.total || filtered.length;
        document.getElementById('data-source').textContent = 'データソース: ' + (meta?.source || 'API');
        
        const countProceed = results.filter(r => r.evaluation.status === 'PROCEED').length;
        const countCaution = results.filter(r => r.evaluation.status === 'CAUTION').length;
        const countNo = results.filter(r => r.evaluation.status === 'NO' || r.evaluation.status === 'DO_NOT_PROCEED').length;
        document.getElementById('count-proceed').textContent = countProceed;
        document.getElementById('count-caution').textContent = countCaution;
        document.getElementById('count-no').textContent = countNo;
        
        if (filtered.length === 0) {
          document.getElementById('subsidies-list').innerHTML = 
            '<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">' +
            '<i class="fas fa-search text-4xl mb-4"></i>' +
            '<p>条件に一致する補助金が見つかりませんでした</p>' +
            '<p class="text-sm mt-2">キーワードを変更するか、フィルターを調整してください</p></div>';
          return;
        }
        
        const html = filtered.map(item => {
          const s = item.subsidy;
          const e = item.evaluation;
          
          const statusConfig = {
            'PROCEED': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: 'fa-check-circle', label: '推奨' },
            'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: 'fa-exclamation-triangle', label: '注意' },
            'NO': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'fa-times-circle', label: '非推奨' },
            'DO_NOT_PROCEED': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'fa-times-circle', label: '非推奨' }
          };
          const sc = statusConfig[e.status] || statusConfig['CAUTION'];
          
          var endDate = s.acceptance_end_datetime ? new Date(s.acceptance_end_datetime) : null;
          if (endDate && isNaN(endDate.getTime())) endDate = null;
          var daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
          var urgencyClass = daysLeft !== null && daysLeft <= 14 ? 'text-red-600 font-bold' : 'text-gray-600';
          
          const conditionBadges = generateConditionBadges(e);
          const whyMatched = generateWhyMatched(e);
          
          return \`
            <div class="card-hover bg-white rounded-lg shadow border-l-4 \${sc.border}">
              <div class="p-5">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2">
                      <span class="px-2 py-1 \${sc.bg} \${sc.text} rounded text-xs font-medium">
                        <i class="fas \${sc.icon} mr-1"></i>\${sc.label}
                      </span>
                      <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        スコア: \${e.score}%
                      </span>
                      \${e.risk_flags.length > 0 ? \`
                        <span class="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                          <i class="fas fa-flag mr-1"></i>リスク: \${e.risk_flags.length}件
                        </span>
                      \` : ''}
                    </div>
                    
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">
                      <a href="/subsidies/\${s.id}?company_id=\${document.getElementById('client-select').value}&from=agency&back=/agency/search" 
                         class="hover:text-emerald-600 hover:underline">
                        \${s.title || s.name || '補助金名未設定'}
                      </a>
                    </h3>
                    
                    \${whyMatched ? \`
                      <div class="mb-3 px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
                        <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>\${whyMatched}
                      </div>
                    \` : ''}
                    
                    <div class="flex flex-wrap gap-4 text-sm mb-3">
                      <div class="flex items-center text-gray-600">
                        <i class="fas fa-building mr-1"></i>
                        \${s.subsidy_executing_organization || '事務局情報なし'}
                      </div>
                      <div class="flex items-center \${urgencyClass}">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        \${endDate ? \`締切: \${endDate.toLocaleDateString('ja-JP')}\` : '締切情報なし'}
                        \${daysLeft !== null ? \` (あと\${daysLeft}日)\` : ''}
                      </div>
                      <div class="flex items-center text-gray-600">
                        <i class="fas fa-yen-sign mr-1"></i>
                        上限: \${s.subsidy_max_limit ? Number(s.subsidy_max_limit).toLocaleString() + '円' : '情報なし'}
                      </div>
                    </div>
                    
                    \${conditionBadges}
                  </div>
                  
                  <div class="ml-4 flex flex-col space-y-2">
                    <a href="/subsidies/\${s.id}?company_id=\${document.getElementById('client-select').value}&from=agency&back=/agency/search" 
                       class="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 text-sm text-center">
                      <i class="fas fa-arrow-right mr-1"></i>詳細を見る
                    </a>
                    \${(e.status !== 'NO' && e.status !== 'DO_NOT_PROCEED' && s.wall_chat_ready !== false) ? \`
                      <a href="/chat?subsidy_id=\${s.id}&company_id=\${document.getElementById('client-select').value}&from=agency&back=/agency/search" 
                         class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm text-center">
                        <i class="fas fa-comments mr-1"></i>壁打ち
                      </a>
                    \` : (s.wall_chat_ready === false ? \`
                      <span class="text-xs text-gray-400 text-center px-2" title="\${(s.wall_chat_missing || []).join(', ')}">
                        <i class="fas fa-clock mr-1"></i>壁打ち準備中
                      </span>
                    \` : '')}
                  </div>
                </div>
              </div>
            </div>
          \`;
        }).join('');
        
        document.getElementById('subsidies-list').innerHTML = html;
        
        // ページネーション
        if (meta && meta.total > parseInt(document.getElementById('limit').value)) {
          const totalPages = Math.ceil(meta.total / parseInt(document.getElementById('limit').value));
          let pagHtml = '';
          
          if (currentPage > 1) {
            pagHtml += \`<button onclick="searchSubsidies(\${currentPage - 1})" class="px-3 py-1 border rounded hover:bg-gray-50">前へ</button>\`;
          }
          
          for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            pagHtml += \`<button onclick="searchSubsidies(\${i})" class="px-3 py-1 border rounded \${i === currentPage ? 'bg-emerald-600 text-white' : 'hover:bg-gray-50'}">\${i}</button>\`;
          }
          
          if (currentPage < totalPages) {
            pagHtml += \`<button onclick="searchSubsidies(\${currentPage + 1})" class="px-3 py-1 border rounded hover:bg-gray-50">次へ</button>\`;
          }
          
          document.getElementById('pagination').innerHTML = pagHtml;
          document.getElementById('pagination').classList.remove('hidden');
        } else {
          document.getElementById('pagination').classList.add('hidden');
        }
      }
      
      // 条件バッジ生成（User版と同一）
      function generateConditionBadges(evaluation) {
        const badges = [];
        
        function toDisplayString(item) {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return item.reason || item.text || item.message || item.description || item.name || JSON.stringify(item);
          }
          return String(item);
        }
        
        if (evaluation.match_reasons && evaluation.match_reasons.length > 0) {
          evaluation.match_reasons.slice(0, 3).forEach(reason => {
            var displayText = toDisplayString(reason);
            badges.push(\`
              <span class="condition-badge px-2 py-1 bg-green-100 border border-green-300 text-green-800 rounded text-xs">
                <i class="fas fa-check text-green-500 mr-1"></i>\${displayText}
              </span>
            \`);
          });
        }
        
        if (evaluation.risk_flags && evaluation.risk_flags.length > 0) {
          evaluation.risk_flags.slice(0, 2).forEach(flag => {
            var displayText = toDisplayString(flag);
            badges.push(\`
              <span class="condition-badge px-2 py-1 bg-red-100 border border-red-300 text-red-800 rounded text-xs">
                <i class="fas fa-times text-red-500 mr-1"></i>\${displayText}
              </span>
            \`);
          });
        }
        
        const totalItems = (evaluation.match_reasons?.length || 0) + (evaluation.risk_flags?.length || 0);
        const shownItems = Math.min(3, evaluation.match_reasons?.length || 0) + Math.min(2, evaluation.risk_flags?.length || 0);
        if (totalItems > shownItems) {
          badges.push(\`<span class="text-xs text-gray-500">+\${totalItems - shownItems}件</span>\`);
        }
        
        if (badges.length === 0) return '';
        
        return \`
          <div class="flex flex-wrap gap-2 pt-2 border-t">
            \${badges.join('')}
          </div>
        \`;
      }
      
      // なぜ出てきたかの説明（User版と同一）
      function generateWhyMatched(evaluation) {
        function toDisplayString(item) {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return item.reason || item.text || item.message || item.description || item.name || '';
          }
          return String(item);
        }
        
        if (evaluation.status === 'PROCEED') {
          if (evaluation.match_reasons && evaluation.match_reasons.length > 0) {
            var reason = toDisplayString(evaluation.match_reasons[0]);
            if (reason) return \`顧客企業は「\${reason}」に該当するため、この補助金が推奨されています。\`;
          }
          return '顧客企業の条件に合致しています。';
        } else if (evaluation.status === 'CAUTION') {
          if (evaluation.risk_flags && evaluation.risk_flags.length > 0) {
            var flag = toDisplayString(evaluation.risk_flags[0]);
            if (flag) return \`「\${flag}」の確認が必要です。条件を満たせば申請可能な可能性があります。\`;
          }
          return '一部の条件について確認が必要です。';
        } else if (evaluation.status === 'NO' || evaluation.status === 'DO_NOT_PROCEED') {
          if (evaluation.risk_flags && evaluation.risk_flags.length > 0) {
            var flag = toDisplayString(evaluation.risk_flags[0]);
            if (flag) return \`「\${flag}」のため、現在の条件では申請が難しい可能性があります。\`;
          }
          return '現在の条件では申請要件を満たしていません。';
        }
        return '';
      }
      
      // フィルター変更時に再描画
      document.getElementById('status-filter').addEventListener('change', () => {
        renderResults(currentResults, null);
      });
      
      // 初期化
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadClients);
      } else {
        if (typeof window.apiCall === 'function') {
          loadClients();
        } else {
          setTimeout(loadClients, 100);
        }
      }
    </script>
  `;
  
  return c.html(agencyLayout('補助金検索', content, 'search'));
});

export default agencyPages;

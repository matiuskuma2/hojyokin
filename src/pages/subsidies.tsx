/**
 * 補助金検索・一覧・詳細UI
 * 
 * /subsidies - 補助金一覧（検索・フィルタ）
 * /subsidies/:id - 補助金詳細（要件・必要書類・壁打ちボタン）
 * 
 * Sprint 2 改善:
 * - 検索モード切替（当てはまる優先/全件表示）
 * - 一覧カードの条件可視化（最低条件、未達条件、なぜ出てきたか）
 * 
 * Sprint 3 改善:
 * - 加点要素の表示（詳細ページ）
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const subsidyPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// 共通レイアウト
const subsidyLayout = (title: string, content: string, currentPath: string = '/subsidies') => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ホジョラク</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .condition-badge { transition: all 0.2s; }
    .condition-badge:hover { transform: scale(1.05); }
    .card-hover { transition: all 0.3s; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
    .mode-toggle { transition: all 0.2s; }
    .mode-toggle.active { background-color: #059669; color: white; }
    
    /* ===== パフォーマンス・モバイル最適化 ===== */
    /* モバイル用コンパクトカード */
    @media (max-width: 640px) {
      .subsidy-card-mobile { padding: 12px; }
      .subsidy-card-mobile .card-title { font-size: 14px; line-height: 1.4; }
      .subsidy-card-mobile .card-meta { font-size: 12px; }
      .subsidy-card-mobile .card-badges { flex-wrap: wrap; gap: 4px; }
      .subsidy-card-mobile .card-actions { flex-direction: column; gap: 8px; }
      .subsidy-card-mobile .card-actions a { width: 100%; text-align: center; }
      /* フィルターボタンのモバイル対応 */
      .filter-buttons-mobile { display: flex; flex-wrap: wrap; gap: 4px; }
      .filter-buttons-mobile span { flex: 1; min-width: 80px; text-align: center; padding: 8px 4px; }
      /* モード切替ボタン */
      .mode-toggle { padding: 8px 12px; font-size: 12px; }
    }
    /* タップ領域確保 */
    .tap-target { min-height: 44px; min-width: 44px; }
    
    /* タブコンテンツ表示保証 */
    .tab-content:not(.hidden) {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      min-height: 50px;
      overflow: visible !important;
    }
    /* ページネーションのモバイル対応 */
    @media (max-width: 640px) {
      .pagination-mobile { display: flex; justify-content: center; gap: 4px; flex-wrap: wrap; }
      .pagination-mobile button { min-width: 40px; padding: 8px; }
    }
  </style>
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
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <a href="/dashboard" class="flex items-center">
            <img src="/static/images/icon.png" alt="ホジョラク" class="h-8 mr-2">
            <span class="font-bold text-xl text-blue-700">ホジョラク</span>
          </a>
          <div class="hidden md:flex space-x-4">
            <a href="/dashboard" class="${currentPath === '/dashboard' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium">
              <i class="fas fa-home mr-1"></i>ダッシュボード
            </a>
            <a href="/subsidies" class="${currentPath === '/subsidies' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium">
              <i class="fas fa-search mr-1"></i>補助金を探す
            </a>
            <a href="/company" class="${currentPath === '/company' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium">
              <i class="fas fa-building mr-1"></i>会社情報
            </a>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <span id="user-role" class="hidden px-2 py-1 text-xs font-medium rounded-full"></span>
          <span id="user-email" class="text-sm text-gray-500"></span>
          <a id="admin-link" href="/admin" class="hidden text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            <i class="fas fa-shield-halved mr-1"></i>管理画面
          </a>
          <a href="/settings" class="text-gray-500 hover:text-gray-700 transition" title="設定">
            <i class="fas fa-cog"></i>
          </a>
          <button onclick="logout()" class="text-gray-500 hover:text-red-600 transition" title="ログアウト">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    ${content}
  </main>
  
  <script>
    // ユーザー情報取得＆権限表示（DOM読み込み後に実行）
    document.addEventListener('DOMContentLoaded', function() {
      async function loadUser() {
        try {
          var data = await window.api('/api/auth/me');
          if (data && data.success) {
            var user = data.data;
            var emailEl = document.getElementById('user-email');
            if (emailEl) {
              emailEl.textContent = user.email || '';
            }
            
            // 権限バッジ表示
            var roleEl = document.getElementById('user-role');
            var adminLink = document.getElementById('admin-link');
            
            if (user.role === 'super_admin') {
              if (roleEl) {
                roleEl.textContent = 'Super Admin';
                roleEl.className = 'px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800';
              }
              if (adminLink) adminLink.classList.remove('hidden');
            } else if (user.role === 'admin') {
              if (roleEl) {
                roleEl.textContent = 'Admin';
                roleEl.className = 'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800';
              }
              if (adminLink) adminLink.classList.remove('hidden');
            } else if (user.role === 'agency') {
              if (roleEl) {
                roleEl.textContent = '士業';
                roleEl.className = 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800';
              }
            } else if (user.role === 'user') {
              if (roleEl) {
                roleEl.textContent = 'ユーザー';
                roleEl.className = 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800';
              }
            }
            
            // ユーザー情報をグローバルに保存
            window.currentUser = user;
          }
        } catch (e) {
          console.error('Failed to load user:', e);
        }
      }
      loadUser();
    });
  </script>
</body>
</html>
`;

/**
 * 補助金一覧ページ（S1）
 * Sprint 2: 検索モード切替＋条件可視化
 */
subsidyPages.get('/subsidies', (c) => {
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-search text-green-600 mr-2"></i>補助金を探す
      </h1>
      <p class="text-gray-600 mt-1">あなたの会社に合った補助金を検索・マッチングします</p>
    </div>
    
    <!-- 会社情報ステータス表示 -->
    <div id="company-status" class="hidden mb-6"></div>
    
    <!-- 検索・フィルターパネル -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <!-- 会社選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">対象会社</label>
          <select id="company-select" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
            <option value="">会社を選択...</option>
          </select>
        </div>
        
        <!-- キーワード -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">キーワード</label>
          <input type="text" id="keyword" placeholder="例: IT導入 省エネ（複数語AND）" 
                 class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
          <p class="text-xs text-gray-400 mt-0.5">スペース区切りで絞り込み</p>
        </div>
        
        <!-- 都道府県フィルター（復活・強化） -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">対象地域</label>
          <select id="prefecture-filter" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
            <option value="">会社所在地（自動）</option>
            <option value="全国">全国（国の補助金）</option>
            <option value="北海道">北海道</option>
            <option value="青森県">青森県</option>
            <option value="岩手県">岩手県</option>
            <option value="宮城県">宮城県</option>
            <option value="秋田県">秋田県</option>
            <option value="山形県">山形県</option>
            <option value="福島県">福島県</option>
            <option value="茨城県">茨城県</option>
            <option value="栃木県">栃木県</option>
            <option value="群馬県">群馬県</option>
            <option value="埼玉県">埼玉県</option>
            <option value="千葉県">千葉県</option>
            <option value="東京都">東京都</option>
            <option value="神奈川県">神奈川県</option>
            <option value="新潟県">新潟県</option>
            <option value="富山県">富山県</option>
            <option value="石川県">石川県</option>
            <option value="福井県">福井県</option>
            <option value="山梨県">山梨県</option>
            <option value="長野県">長野県</option>
            <option value="岐阜県">岐阜県</option>
            <option value="静岡県">静岡県</option>
            <option value="愛知県">愛知県</option>
            <option value="三重県">三重県</option>
            <option value="滋賀県">滋賀県</option>
            <option value="京都府">京都府</option>
            <option value="大阪府">大阪府</option>
            <option value="兵庫県">兵庫県</option>
            <option value="奈良県">奈良県</option>
            <option value="和歌山県">和歌山県</option>
            <option value="鳥取県">鳥取県</option>
            <option value="島根県">島根県</option>
            <option value="岡山県">岡山県</option>
            <option value="広島県">広島県</option>
            <option value="山口県">山口県</option>
            <option value="徳島県">徳島県</option>
            <option value="香川県">香川県</option>
            <option value="愛媛県">愛媛県</option>
            <option value="高知県">高知県</option>
            <option value="福岡県">福岡県</option>
            <option value="佐賀県">佐賀県</option>
            <option value="長崎県">長崎県</option>
            <option value="熊本県">熊本県</option>
            <option value="大分県">大分県</option>
            <option value="宮崎県">宮崎県</option>
            <option value="鹿児島県">鹿児島県</option>
            <option value="沖縄県">沖縄県</option>
          </select>
        </div>
        
        <!-- 受付状況 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">受付状況</label>
          <select id="acceptance" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
            <option value="1">受付中のみ</option>
            <option value="0">すべて表示</option>
          </select>
        </div>
        
        <!-- 検索ボタン -->
        <div class="flex items-end">
          <button onclick="searchSubsidies()" 
                  class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
      
      <!-- 検索モード切替（Sprint 2） -->
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
      
      <!-- 詳細フィルター（タブ形式） -->
      <div class="mt-4 pt-4 border-t">
        <div class="flex items-center justify-between mb-3">
          <button onclick="toggleAdvancedFilter()" id="btn-advanced-filter" 
                  class="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
            <i class="fas fa-filter"></i>
            <span>詳細フィルター</span>
            <i id="filter-toggle-icon" class="fas fa-chevron-down ml-1 text-xs transition-transform"></i>
          </button>
          <div id="active-filters" class="flex flex-wrap gap-1 text-xs">
            <!-- 選択中のフィルターがチップで表示される -->
          </div>
        </div>
        
        <!-- 詳細フィルターパネル（初期非表示） -->
        <div id="advanced-filter-panel" class="hidden">
          <!-- フィルタータブ -->
          <div class="border-b mb-3">
            <nav class="flex -mb-px text-sm">
              <button onclick="switchFilterTab('basic')" data-filter-tab="basic" 
                      class="filter-tab-btn px-4 py-2 border-b-2 border-green-600 text-green-600 font-medium">
                <i class="fas fa-sliders-h mr-1"></i>基本
              </button>
              <button onclick="switchFilterTab('issuer')" data-filter-tab="issuer"
                      class="filter-tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                <i class="fas fa-building-columns mr-1"></i>発行機関
                <span id="issuer-count-badge" class="hidden ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs"></span>
              </button>
              <button onclick="switchFilterTab('region')" data-filter-tab="region"
                      class="filter-tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                <i class="fas fa-map-location-dot mr-1"></i>対象地域
                <span id="region-count-badge" class="hidden ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs"></span>
              </button>
              <button onclick="switchFilterTab('category')" data-filter-tab="category"
                      class="filter-tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                <i class="fas fa-tags mr-1"></i>カテゴリ
                <span id="category-count-badge" class="hidden ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs"></span>
              </button>
              <button onclick="switchFilterTab('industry')" data-filter-tab="industry"
                      class="filter-tab-btn px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                <i class="fas fa-industry mr-1"></i>業種
                <span id="industry-count-badge" class="hidden ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs"></span>
              </button>
            </nav>
          </div>
          
          <!-- 基本フィルター -->
          <div id="filter-tab-basic" class="filter-tab-content">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <select id="status-filter" class="w-full px-3 py-2 border rounded-md text-sm">
                  <option value="">すべて</option>
                  <option value="PROCEED">推奨（PROCEED）</option>
                  <option value="CAUTION">注意（CAUTION）</option>
                  <option value="DO_NOT_PROCEED">非推奨</option>
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
                <label class="block text-sm font-medium text-gray-700 mb-1">取得件数</label>
                <select id="limit" class="w-full px-3 py-2 border rounded-md text-sm">
                  <option value="50">50件</option>
                  <option value="100">100件</option>
                  <option value="200">200件</option>
                  <option value="500" selected>500件</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- 発行機関フィルター -->
          <div id="filter-tab-issuer" class="filter-tab-content hidden">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- 省庁 -->
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <i class="fas fa-landmark text-blue-500"></i>省庁
                </h4>
                <div id="issuer-ministry-list" class="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- その他機関 -->
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <i class="fas fa-building text-purple-500"></i>独立行政法人・その他
                </h4>
                <div id="issuer-org-list" class="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 対象地域フィルター -->
          <div id="filter-tab-region" class="filter-tab-content hidden">
            <div class="mb-3">
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="region-national" class="rounded text-green-600" />
                <span class="font-medium">全国（国の補助金）</span>
              </label>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <!-- 北海道・東北 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">北海道・東北</h4>
                <div id="region-group-hokkaido" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- 関東 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">関東</h4>
                <div id="region-group-kanto" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- 中部 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">中部</h4>
                <div id="region-group-chubu" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- 近畿 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">近畿</h4>
                <div id="region-group-kinki" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- 中国 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">中国</h4>
                <div id="region-group-chugoku" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- 四国 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">四国</h4>
                <div id="region-group-shikoku" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
              <!-- 九州・沖縄 -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 mb-1">九州・沖縄</h4>
                <div id="region-group-kyushu" class="space-y-0.5 text-sm">
                  <p class="text-xs text-gray-400">読み込み中...</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- カテゴリフィルター -->
          <div id="filter-tab-category" class="filter-tab-content hidden">
            <div id="category-tree" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <p class="text-xs text-gray-400">読み込み中...</p>
            </div>
          </div>
          
          <!-- 業種フィルター -->
          <div id="filter-tab-industry" class="filter-tab-content hidden">
            <div id="industry-list" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <p class="text-xs text-gray-400">読み込み中...</p>
            </div>
          </div>
          
          <!-- フィルター適用ボタン -->
          <div class="mt-4 pt-3 border-t flex items-center justify-between">
            <button onclick="clearAllFilters()" class="text-sm text-gray-500 hover:text-gray-700">
              <i class="fas fa-times mr-1"></i>フィルターをクリア
            </button>
            <button onclick="applyFilters()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
              <i class="fas fa-check mr-1"></i>フィルターを適用
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 検索結果サマリー -->
    <div id="result-summary" class="hidden mb-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-600">
          <span id="result-count-display"></span>
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
      
      <!-- 条件凡例（Sprint 2） -->
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
        <p>会社を選択して検索を実行してください</p>
      </div>
    </div>
    
    <!-- もっと読み込む -->
    <div id="load-more-container" class="hidden mt-6 text-center">
      <div id="load-more-info" class="text-sm text-gray-500 mb-2"></div>
      <button id="load-more-btn" onclick="loadMoreResults()" 
              class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md">
        <i class="fas fa-plus-circle mr-2"></i>もっと読み込む
      </button>
      <div id="load-more-loading" class="hidden">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        <p class="mt-2 text-sm text-gray-500">追加読み込み中...</p>
      </div>
    </div>
    
    <!-- ページネーション -->
    <div id="pagination" class="hidden mt-6 flex justify-center space-x-2">
    </div>
    
    <!-- ローディング -->
    <div id="loading" class="hidden fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 shadow-xl">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p class="mt-4 text-gray-600">補助金を検索中...</p>
      </div>
    </div>
    
    <script>
      let currentResults = [];
      let currentPage = 1;
      let searchMode = 'match'; // 'match' または 'all'
      
      // ===== パフォーマンス最適化用変数 =====
      const PAGE_SIZE = 20; // クライアント側ページネーション
      let displayPage = 1;  // 表示中のページ
      let filteredResults = []; // フィルタ済み結果キャッシュ
      let statusCounts = { PROCEED: 0, CAUTION: 0, NO: 0 }; // ステータスカウントキャッシュ
      const isMobile = window.innerWidth < 640; // モバイル判定
      
      // ===== サーバー側ページネーション =====
      let currentMeta = null;   // 最新のmetaデータ
      let allLoadedResults = []; // サーバーから読み込んだ全結果（累積）
      let isLoadingMore = false; // 追加読み込み中フラグ
      
      // 検索モード切替
      // ⚠️ 重要: 「全件表示」モードはソート順を変更するだけでなく、表示件数も500件に自動設定
      window.setSearchMode = function(mode) {
        searchMode = mode;
        
        // ボタンの見た目を更新
        document.getElementById('mode-match').classList.toggle('active', mode === 'match');
        document.getElementById('mode-all').classList.toggle('active', mode === 'all');
        
        // 説明テキストを更新
        const desc = document.getElementById('mode-description');
        const limitEl = document.getElementById('limit');
        
        if (mode === 'match') {
          desc.innerHTML = '<i class="fas fa-info-circle mr-1"></i>条件に合う補助金を優先表示し、合わないものは下部に表示します';
        } else {
          desc.innerHTML = '<i class="fas fa-info-circle mr-1"></i>条件に関係なく全件を表示します（最大500件）';
          // 「全件表示」モード時は表示件数を自動的に最大（500件）に設定
          if (limitEl && limitEl.value !== 'all' && parseInt(limitEl.value) < 500) {
            limitEl.value = 'all';
          }
        }
        
        // 結果があれば再検索（件数が変わった可能性があるため）
        if (currentResults.length > 0) {
          searchSubsidies(1);
        }
      }
      
      // 会社一覧取得
      async function loadCompanies() {
        try {
          const res = await api('/api/companies');
          console.log('[補助金検索] Companies API response:', JSON.stringify(res, null, 2));
          
          // APIエラーの場合
          if (!res || !res.success) {
            console.error('[補助金検索] API error:', res?.error);
            showNoCompanyAlert();
            return;
          }
          
          if (res.data && res.data.length > 0) {
            const select = document.getElementById('company-select');
            if (!select) {
              console.error('[補助金検索] company-select element not found');
              return;
            }
            
            // 会社リストをグローバルに保存
            window.companiesList = res.data;
            
            // まず全会社をセレクトに追加（後でcompleteness APIで状態を確認）
            res.data.forEach(company => {
              const option = document.createElement('option');
              option.value = company.id;
              option.textContent = company.name || '(会社名未設定)';
              select.appendChild(option);
            });
            
            // 会社選択変更時のイベントリスナー（Completeness APIを使用）
            select.addEventListener('change', async function() {
              var selectedId = this.value;
              if (selectedId) {
                await checkCompanyCompleteness(selectedId);
              }
            });
            
            // 最初の会社を自動選択してcompleteness確認
            select.value = res.data[0].id;
            await checkCompanyCompleteness(res.data[0].id);
            
          } else {
            // 会社情報未登録
            showNoCompanyAlert();
          }
        } catch (e) {
          console.error('loadCompanies error:', e);
          showNoCompanyAlert();
        }
      }
      
      // ========================================
      // Completeness API による会社情報チェック（凍結仕様v1）
      // ========================================
      async function checkCompanyCompleteness(companyId) {
        try {
          const res = await api('/api/companies/' + companyId + '/completeness');
          console.log('[補助金検索] Completeness API response:', JSON.stringify(res, null, 2));
          
          if (!res || !res.success) {
            console.error('[補助金検索] Completeness API error:', res?.error);
            showIncompleteCompanyAlert(res?.data || {});
            return;
          }
          
          const completeness = res.data;
          const company = window.companiesList.find(c => c.id === companyId);
          
          if (completeness.status === 'BLOCKED') {
            // 必須項目不足 → 検索不可
            showBlockedCompanyAlert(completeness, company);
          } else if (completeness.status === 'NEEDS_RECOMMENDED') {
            // 必須OK、推奨不足 → 検索可能、精度向上を推奨
            showNeedsRecommendedAlert(completeness, company);
          } else {
            // OK → 完全に検索可能
            showCompanyReady(completeness, company);
          }
        } catch (e) {
          console.error('[補助金検索] checkCompanyCompleteness error:', e);
          showNoCompanyAlert();
        }
      }
      
      // ========================================
      // StatusBanner/Checklist - Completeness API 統一版（凍結仕様v1）
      // ========================================
      
      // OK: 会社情報準備完了（必須+推奨充足）
      function showCompanyReady(completeness, company) {
        const statusEl = document.getElementById('company-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl p-4 mb-6';
        statusEl.innerHTML = 
          '<div class="flex items-start gap-3">' +
            '<div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-check-circle text-green-600 text-lg"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-green-800 font-semibold">✓ 会社情報完了 - 最適なマッチングが可能です</p>' +
              '<p class="text-green-700 text-sm mt-1">' +
                '<strong>' + (company?.name || '') + '</strong> で検索できます。' +
                '必須情報・推奨情報がすべて登録されているため、最も精度の高いマッチングが可能です。' +
              '</p>' +
              '<div class="flex items-center gap-2 mt-2 text-sm text-green-600">' +
                '<span class="px-2 py-1 bg-green-100 rounded-full"><i class="fas fa-check mr-1"></i>必須 ' + completeness.required_filled + '/' + completeness.required_count + '</span>' +
                '<span class="px-2 py-1 bg-green-100 rounded-full"><i class="fas fa-check mr-1"></i>推奨 ' + completeness.recommended_filled + '/' + completeness.recommended_count + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
        statusEl.classList.remove('hidden');
        
        // 検索パネルを有効化
        enableSearchPanel();
      }
      
      // NEEDS_RECOMMENDED: 必須OK、推奨不足（検索可能だが精度向上を推奨）
      function showNeedsRecommendedAlert(completeness, company) {
        const statusEl = document.getElementById('company-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-300 rounded-xl p-4 mb-6';
        statusEl.classList.remove('hidden');
        
        // 推奨不足項目
        var missingBadges = completeness.missing_recommended.map(function(m) {
          return '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"><i class="fas fa-plus-circle mr-1"></i>' + m + '</span>';
        }).join(' ');
        
        // メリット表示（最大3つ）
        var benefitsHtml = completeness.benefits.slice(0, 3).map(function(b) {
          return '<li class="text-sm text-blue-700">• ' + b + '</li>';
        }).join('');
        
        statusEl.innerHTML = 
          '<div class="flex items-start gap-3">' +
            '<div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-check-circle text-green-600 text-lg"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-green-800 font-semibold">✓ 検索可能 - <strong>' + (company?.name || '') + '</strong></p>' +
              '<div class="flex items-center gap-2 mt-1 text-sm">' +
                '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full"><i class="fas fa-check mr-1"></i>必須 ' + completeness.required_filled + '/' + completeness.required_count + '</span>' +
                '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full"><i class="fas fa-info-circle mr-1"></i>推奨 ' + completeness.recommended_filled + '/' + completeness.recommended_count + '</span>' +
              '</div>' +
              '<details class="mt-3">' +
                '<summary class="text-sm text-blue-700 cursor-pointer hover:text-blue-800"><i class="fas fa-lightbulb mr-1"></i>さらに精度を上げるには（推奨項目）</summary>' +
                '<div class="mt-2 p-3 bg-white/70 rounded-lg">' +
                  '<div class="flex flex-wrap gap-1 mb-2">' + missingBadges + '</div>' +
                  '<ul class="space-y-1 mb-2">' + benefitsHtml + '</ul>' +
                  '<a href="/company" class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm">' +
                    '<i class="fas fa-edit text-xs"></i> 会社情報を編集' +
                  '</a>' +
                '</div>' +
              '</details>' +
            '</div>' +
          '</div>';
        
        // 検索パネルを有効化（検索可能）
        enableSearchPanel();
      }
      
      // BLOCKED: 必須項目不足（検索不可）
      function showBlockedCompanyAlert(completeness, company) {
        const statusEl = document.getElementById('company-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-300 rounded-xl p-5 mb-6';
        statusEl.classList.remove('hidden');
        
        // 必須不足項目（赤いチェックリスト）
        var requiredChecklist = '';
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required.name ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required.name ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>会社名</span></div>';
        
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required.prefecture ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required.prefecture ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>都道府県</span></div>';
        
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required.industry_major ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required.industry_major ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>業種</span></div>';
        
        requiredChecklist += '<div class="flex items-center gap-2 ' + (completeness.required.employee_count ? 'text-green-600' : 'text-red-600') + '">';
        requiredChecklist += '<i class="fas fa-' + (completeness.required.employee_count ? 'check-circle' : 'times-circle') + '"></i>';
        requiredChecklist += '<span>従業員数</span></div>';
        
        statusEl.innerHTML = 
          '<div class="flex items-start gap-4">' +
            '<div class="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-exclamation-triangle text-red-600 text-xl"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-red-800 font-semibold text-lg"><i class="fas fa-lock mr-1"></i>検索には必須情報が必要です</p>' +
              '<p class="text-red-700 text-sm mt-1 mb-3">' +
                '補助金検索を行うには、以下の<strong>必須4項目</strong>をすべて入力してください:' +
              '</p>' +
              '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-white/50 rounded-lg">' + requiredChecklist + '</div>' +
              '<div class="bg-white/70 rounded-lg p-3 mb-3 text-sm text-red-800">' +
                '<i class="fas fa-lightbulb mr-2 text-yellow-500"></i>' +
                '<strong>メリット:</strong> 必須情報を登録すると、' +
                '<span class="font-semibold">47都道府県＋国の補助金から最適なものを自動マッチング</span>できます。' +
              '</div>' +
              '<a href="/company" class="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition shadow">' +
                '<i class="fas fa-edit"></i> 会社情報を編集する（必須項目を入力）' +
              '</a>' +
            '</div>' +
          '</div>';
        
        document.getElementById('subsidies-list').innerHTML = 
          '<div class="bg-white rounded-lg shadow p-8 text-center">' +
            '<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">' +
              '<i class="fas fa-lock text-gray-400 text-2xl"></i>' +
            '</div>' +
            '<p class="text-gray-600 font-medium">必須4項目を入力すると検索できます</p>' +
            '<p class="text-gray-500 text-sm mt-1">会社名・都道府県・業種・従業員数</p>' +
          '</div>';
        
        // 検索パネルを無効化（BLOCKEDは検索不可）
        disableSearchPanel();
      }
      
      // 旧：会社情報が不完全な場合のアラート（後方互換）
      function showIncompleteCompanyAlert(data) {
        // Completeness APIの形式でなければ旧ロジックで表示
        if (data && data.status && (data.status === 'BLOCKED' || data.status === 'NEEDS_RECOMMENDED')) {
          if (data.status === 'BLOCKED') {
            showBlockedCompanyAlert(data, null);
          } else {
            showNeedsRecommendedAlert(data, null);
          }
          return;
        }
        // フォールバック: 情報なし扱い
        showNoCompanyAlert();
      }
      
      // 会社情報がない場合のアラート
      function showNoCompanyAlert() {
        const statusEl = document.getElementById('company-status');
        if (!statusEl) return;
        
        statusEl.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-xl p-5 mb-6';
        statusEl.innerHTML = 
          '<div class="flex items-start gap-4">' +
            '<div class="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">' +
              '<i class="fas fa-building text-blue-600 text-xl"></i>' +
            '</div>' +
            '<div class="flex-1">' +
              '<p class="text-blue-800 font-semibold text-lg">会社情報を登録して、補助金を探しましょう</p>' +
              '<p class="text-blue-700 text-sm mt-1 mb-3">' +
                '補助金検索を始めるには、まず<strong>会社の基本情報</strong>を登録してください。' +
              '</p>' +
              '<div class="bg-white/70 rounded-lg p-4 mb-3">' +
                '<p class="text-sm text-blue-800 mb-2"><i class="fas fa-check-circle text-green-500 mr-2"></i><strong>登録後のメリット:</strong></p>' +
                '<ul class="text-sm text-blue-700 space-y-1 ml-6">' +
                  '<li>• あなたの会社に<strong>最適な補助金を自動マッチング</strong></li>' +
                  '<li>• <strong>47都道府県＋国の補助金</strong>から一括検索</li>' +
                  '<li>• 申請に必要な情報を<strong>AI が自動整理</strong></li>' +
                  '<li>• 締切・要件を自動チェックして<strong>見逃しを防止</strong></li>' +
                '</ul>' +
              '</div>' +
              '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">' +
                '<div class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-blue-200">' +
                  '<i class="fas fa-times-circle text-red-400 text-xs"></i>' +
                  '<span class="text-sm text-gray-700">会社名</span>' +
                '</div>' +
                '<div class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-blue-200">' +
                  '<i class="fas fa-times-circle text-red-400 text-xs"></i>' +
                  '<span class="text-sm text-gray-700">都道府県</span>' +
                '</div>' +
                '<div class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-blue-200">' +
                  '<i class="fas fa-times-circle text-red-400 text-xs"></i>' +
                  '<span class="text-sm text-gray-700">業種</span>' +
                '</div>' +
                '<div class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-blue-200">' +
                  '<i class="fas fa-times-circle text-red-400 text-xs"></i>' +
                  '<span class="text-sm text-gray-700">従業員数</span>' +
                '</div>' +
              '</div>' +
              '<a href="/company" class="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition shadow-md">' +
                '<i class="fas fa-plus-circle"></i> 会社情報を登録する（2分で完了）' +
              '</a>' +
            '</div>' +
          '</div>';
        statusEl.classList.remove('hidden');
        
        // 検索パネルを無効化
        disableSearchPanel();
        
        document.getElementById('subsidies-list').innerHTML = 
          '<div class="bg-white rounded-lg shadow p-8 text-center">' +
            '<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">' +
              '<i class="fas fa-info-circle text-gray-400 text-2xl"></i>' +
            '</div>' +
            '<p class="text-gray-600">まずは会社情報を登録してください</p>' +
          '</div>';
      }
      
      // ========================================
      // 検索パネル有効/無効化ヘルパー
      // ========================================
      function enableSearchPanel() {
        const searchPanel = document.querySelector('.bg-white.rounded-lg.shadow.p-6.mb-6');
        if (searchPanel) {
          searchPanel.classList.remove('opacity-50', 'pointer-events-none');
        }
      }
      
      function disableSearchPanel() {
        const searchPanel = document.querySelector('.bg-white.rounded-lg.shadow.p-6.mb-6');
        if (searchPanel) {
          searchPanel.classList.add('opacity-50', 'pointer-events-none');
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
      // ⚠️ limit: バックエンドの最大値は500。'all'を選択した場合は500を使用
      window.searchSubsidies = async function(page = 1) {
        var companySelect = document.getElementById('company-select');
        var companyId = companySelect ? companySelect.value : '';
        if (!companyId) {
          alert('会社を選択してください');
          return;
        }
        
        currentPage = page;
        displayPage = 1; // 新しい検索時はクライアント表示ページをリセット
        allLoadedResults = []; // 累積結果をリセット
        currentMeta = null;
        
        var limitEl = document.getElementById('limit');
        var limitValue = limitEl ? limitEl.value : '50';
        // 'all' または無効な値の場合は500（バックエンド最大値）を使用
        var limit = (limitValue === 'all' || isNaN(parseInt(limitValue))) ? 500 : Math.min(parseInt(limitValue), 500);
        // limit が 0 以下の場合は 50 をデフォルトとして使用
        if (limit <= 0) limit = 50;
        var offset = 0; // 新規検索は常にoffset=0
        
        var keywordEl = document.getElementById('keyword');
        var acceptanceEl = document.getElementById('acceptance');
        var sortEl = document.getElementById('sort');
        var prefectureEl = document.getElementById('prefecture-filter');
        
        var params = new URLSearchParams({
          company_id: companyId,
          keyword: keywordEl ? keywordEl.value || '' : '',
          acceptance: acceptanceEl ? acceptanceEl.value || '1' : '1',
          sort: sortEl ? sortEl.value || 'score' : 'score',
          order: sortEl && sortEl.value === 'score' ? 'DESC' : 'ASC',
          limit: limit.toString(),
          offset: offset.toString()
        });
        
        // 都道府県フィルター（空=会社所在地自動、指定=明示的フィルター）
        var prefectureValue = prefectureEl ? prefectureEl.value : '';
        if (prefectureValue) {
          params.set('prefecture', prefectureValue);
        }
        
        document.getElementById('loading').classList.remove('hidden');
        
        try {
          const res = await api('/api/subsidies/search?' + params);
          
          if (res.success) {
            allLoadedResults = res.data; // 初回結果を保存
            currentResults = res.data;
            currentMeta = res.meta;
            renderResults(res.data, res.meta);
            updateLoadMoreButton(res.meta);
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
      
      // もっと読み込む機能
      window.loadMoreResults = async function() {
        if (isLoadingMore || !currentMeta || !currentMeta.has_more) return;
        
        isLoadingMore = true;
        var btn = document.getElementById('load-more-btn');
        var loading = document.getElementById('load-more-loading');
        btn.classList.add('hidden');
        loading.classList.remove('hidden');
        
        try {
          var companyId = document.getElementById('company-select').value;
          var limitEl = document.getElementById('limit');
          var limitValue = limitEl ? limitEl.value : '50';
          var limit = (limitValue === 'all' || isNaN(parseInt(limitValue))) ? 500 : Math.min(parseInt(limitValue), 500);
          if (limit <= 0) limit = 50;
          
          // 次のページのoffsetを計算
          var nextOffset = (currentMeta.offset || 0) + (currentMeta.limit || limit);
          
          var keywordEl = document.getElementById('keyword');
          var acceptanceEl = document.getElementById('acceptance');
          var sortEl = document.getElementById('sort');
          var prefectureEl = document.getElementById('prefecture-filter');
          
          var params = new URLSearchParams({
            company_id: companyId,
            keyword: keywordEl ? keywordEl.value || '' : '',
            acceptance: acceptanceEl ? acceptanceEl.value || '1' : '1',
            sort: sortEl ? sortEl.value || 'score' : 'score',
            order: sortEl && sortEl.value === 'score' ? 'DESC' : 'ASC',
            limit: limit.toString(),
            offset: nextOffset.toString()
          });
          
          var prefectureValue = prefectureEl ? prefectureEl.value : '';
          if (prefectureValue) {
            params.set('prefecture', prefectureValue);
          }
          
          const res = await api('/api/subsidies/search?' + params);
          
          if (res.success && res.data.length > 0) {
            // 累積結果に追加
            allLoadedResults = allLoadedResults.concat(res.data);
            currentResults = allLoadedResults;
            currentMeta = res.meta;
            
            // 再描画（累積結果で）
            renderResults(allLoadedResults, {
              ...res.meta,
              // meta.total は全体件数のまま
              total: res.meta.total,
            });
            updateLoadMoreButton(res.meta);
          } else {
            // 追加データなし
            updateLoadMoreButton({ ...currentMeta, has_more: false });
          }
        } catch (e) {
          console.error('Load more error:', e);
          btn.classList.remove('hidden');
        } finally {
          isLoadingMore = false;
          loading.classList.add('hidden');
        }
      }
      
      // 「もっと読み込む」ボタンの表示更新
      // 地雷3対策: 件数表示を3カウント分離（混ぜない）
      function updateLoadMoreButton(meta) {
        var container = document.getElementById('load-more-container');
        var btn = document.getElementById('load-more-btn');
        var info = document.getElementById('load-more-info');
        
        if (meta && meta.has_more) {
          container.classList.remove('hidden');
          btn.classList.remove('hidden');
          var loadedCount = allLoadedResults.length;
          var totalCount = meta.total || 0;
          // 地雷3対策: サーバー取得の残りを正しく計算
          var serverFetched = (meta.offset || 0) + (meta.limit || 500);
          var remaining = Math.max(0, totalCount - serverFetched);
          info.innerHTML = 
            '<span class="font-medium">' + loadedCount + '</span>件読み込み済み' +
            ' / 該当 <span class="font-medium">' + totalCount.toLocaleString() + '</span>件' +
            '<span class="text-gray-400 ml-1">（残り約' + remaining.toLocaleString() + '件）</span>';
        } else {
          if (allLoadedResults.length > 0 && meta) {
            // 全件読み込み完了
            container.classList.remove('hidden');
            btn.classList.add('hidden');
            info.innerHTML = '<i class="fas fa-check-circle text-green-500 mr-1"></i>全 ' + allLoadedResults.length + '件を読み込み済み';
          } else {
            container.classList.add('hidden');
          }
        }
      }
      
      // HTMLエスケープ関数（XSS対策）
      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      // 結果描画（Sprint 2 改善 + パフォーマンス最適化）
      // ⚠️ セキュリティ: ユーザー入力・API応答はescapeHtml()でエスケープすること
      function renderResults(results, meta) {
        const renderStart = performance.now();
        
        // null/undefined チェック
        if (!Array.isArray(results)) {
          console.error('[補助金検索] renderResults: results is not an array', results);
          document.getElementById('subsidies-list').innerHTML = 
            '<div class="bg-red-50 rounded-lg p-4 text-red-600">データ形式が不正です。再度検索してください。</div>';
          return;
        }
        
        // ===== パフォーマンス最適化: ステータスカウントを1回の走査で計算 =====
        // P0-1: DO_NOT_PROCEED を正式ステータスとして使用（'NO' はレガシー互換）
        statusCounts = { PROCEED: 0, CAUTION: 0, NO: 0 };
        results.forEach(r => {
          if (r && r.evaluation) {
            const status = r.evaluation.status;
            if (status === 'PROCEED') statusCounts.PROCEED++;
            else if (status === 'CAUTION') statusCounts.CAUTION++;
            else statusCounts.NO++; // DO_NOT_PROCEED, NO, その他すべて
          }
        });
        
        const statusFilter = document.getElementById('status-filter').value;
        
        // ===== パフォーマンス最適化: フィルタ結果をキャッシュ =====
        // P0-1: DO_NOT_PROCEED フィルターは NO もマッチ（レガシー互換）
        if (statusFilter) {
          if (statusFilter === 'DO_NOT_PROCEED') {
            filteredResults = results.filter(r => r && r.evaluation && (r.evaluation.status === 'DO_NOT_PROCEED' || r.evaluation.status === 'NO'));
          } else {
            filteredResults = results.filter(r => r && r.evaluation && r.evaluation.status === statusFilter);
          }
        } else {
          filteredResults = results;
        }
        
        // 検索モードによる並び替え
        if (searchMode === 'match') {
          // PROCEED > CAUTION > DO_NOT_PROCEED/NO の順にソート、同じならスコア順
          const statusOrder = { 'PROCEED': 0, 'CAUTION': 1, 'DO_NOT_PROCEED': 2, 'NO': 2 };
          filteredResults.sort((a, b) => {
            const orderDiff = statusOrder[a.evaluation.status] - statusOrder[b.evaluation.status];
            if (orderDiff !== 0) return orderDiff;
            return (b.evaluation.score || 0) - (a.evaluation.score || 0);
          });
        }
        
        // サマリー更新（キャッシュされたカウントを使用）
        document.getElementById('result-summary').classList.remove('hidden');
        
        // 地雷3対策: 3カウント表記を明確に分離
        // ① 該当総数（DB条件一致）= meta.total
        // ② 読み込み済み（サーバー取得累計）= allLoadedResults.length
        // ③ 表示中（クライアントフィルタ後）= filteredResults.length
        var displayedCount = filteredResults.length;
        var apiTotal = meta?.total || filteredResults.length;
        var totalLoaded = allLoadedResults.length;
        var countDisplay = document.getElementById('result-count-display');
        
        // P0+地雷2対策: スクリーニングモードに応じたバッジ表示
        var screeningMode = meta?.screening_mode || 'precise';
        var preciseCount = meta?.precise_count || 0;
        var screeningBadge = '';
        if (screeningMode === 'fast') {
          screeningBadge = ' <span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs" title="要件データなしの簡易判定です。詳細ページで精密な判定が可能です"><i class="fas fa-bolt mr-0.5"></i>簡易判定</span>';
        } else if (screeningMode === 'fast+precise') {
          screeningBadge = ' <span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs" title="上位' + preciseCount + '件は要件データに基づく精密判定済み。それ以外は簡易判定です"><i class="fas fa-check-double mr-0.5"></i>上位' + preciseCount + '件 精密判定</span>';
        }
        // screeningMode === 'precise' の場合はバッジなし（デフォルトで高精度）
        
        if (apiTotal > totalLoaded) {
          // まだ全件読み込んでいない
          countDisplay.innerHTML = '表示 <strong>' + displayedCount + '</strong>件' +
            ' / 読み込み <strong>' + totalLoaded + '</strong>件' +
            ' / 該当 <strong>' + apiTotal.toLocaleString() + '</strong>件' + screeningBadge;
        } else {
          countDisplay.innerHTML = '<strong>' + displayedCount + '</strong>件の補助金が見つかりました' + screeningBadge;
        }
        document.getElementById('data-source').textContent = 'データソース: ' + (meta?.source || 'API');
        
        document.getElementById('count-proceed').textContent = statusCounts.PROCEED;
        document.getElementById('count-caution').textContent = statusCounts.CAUTION;
        document.getElementById('count-no').textContent = statusCounts.NO;
        
        if (filteredResults.length === 0) {
          document.getElementById('subsidies-list').innerHTML = 
            '<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">' +
            '<i class="fas fa-search text-4xl mb-4"></i>' +
            '<p>条件に一致する補助金が見つかりませんでした</p>' +
            '<p class="text-sm mt-2">キーワードを変更するか、フィルターを調整してください</p></div>';
          document.getElementById('pagination').classList.add('hidden');
          return;
        }
        
        // ===== パフォーマンス最適化: クライアント側ページネーション =====
        const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE);
        if (displayPage > totalPages) displayPage = 1;
        
        const startIdx = (displayPage - 1) * PAGE_SIZE;
        const pageItems = filteredResults.slice(startIdx, startIdx + PAGE_SIZE);
        
        const html = pageItems.map(item => {
          // ⚠️ null/undefined安全: item/subsidy/evaluationがnullの場合は空を返す
          if (!item || !item.subsidy || !item.evaluation) {
            console.warn('[補助金検索] Invalid item in results:', item);
            return '';
          }
          
          const s = item.subsidy;
          const e = item.evaluation;
          
          const statusConfig = {
            'PROCEED': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: 'fa-check-circle', label: '推奨' },
            'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: 'fa-exclamation-triangle', label: '注意' },
            'NO': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'fa-times-circle', label: '非推奨' },
            'DO_NOT_PROCEED': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'fa-times-circle', label: '非推奨' }
          };
          const sc = statusConfig[e.status] || statusConfig['CAUTION'];
          
          // ⚠️ risk_flagsがnull/undefinedの場合は空配列として扱う
          const riskFlagsCount = Array.isArray(e.risk_flags) ? e.risk_flags.length : 0;
          
          // 締切までの日数
          var endDate = s.acceptance_end_datetime ? new Date(s.acceptance_end_datetime) : null;
          // 無効な日付のチェック
          if (endDate && isNaN(endDate.getTime())) {
            endDate = null;
          }
          var daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
          var urgencyClass = daysLeft !== null && daysLeft <= 14 ? 'text-red-600 font-bold' : 'text-gray-600';
          
          // Sprint 2: 条件バッジを生成
          const conditionBadges = generateConditionBadges(e);
          
          // Sprint 2: なぜ出てきたかの説明
          const whyMatched = generateWhyMatched(e);
          
          // ⚠️ XSS対策: ユーザー入力・API応答をエスケープ
          const safeTitle = escapeHtml(s.title || s.name || '補助金名未設定');
          const safeOrg = escapeHtml(s.subsidy_executing_organization || '事務局情報なし');
          const safeWhyMatched = escapeHtml(whyMatched);
          
          // P0+地雷2対策: screening_mode に応じた判定精度バッジ
          const isFastScreening = s.screening_mode === 'fast';
          const isPreciseScreening = s.screening_mode === 'precise';
          
          // ===== モバイル用コンパクトカード vs デスクトップ用フルカード =====
          const companyId = encodeURIComponent(document.getElementById('company-select').value);
          const subsidyId = encodeURIComponent(s.id);
          
          if (isMobile) {
            // モバイル用: コンパクト表示
            return \`
              <a href="/subsidies/\${subsidyId}?company_id=\${companyId}" 
                 class="block bg-white border-l-4 \${sc.border} p-3 tap-target subsidy-card-mobile">
                <div class="flex items-center gap-2 mb-1 card-badges">
                  <span class="px-2 py-0.5 \${sc.bg} \${sc.text} rounded text-xs font-medium">
                    <i class="fas \${sc.icon}"></i> \${sc.label}
                  </span>
                  <span class="text-xs text-blue-600">\${e.score || 0}%</span>
                  \${isPreciseScreening ? '<span class="text-xs text-emerald-600" title="精密判定済み"><i class="fas fa-check-double"></i></span>' : ''}
                  \${isFastScreening ? '<span class="text-xs text-blue-500" title="簡易判定"><i class="fas fa-bolt"></i></span>' : ''}
                  \${riskFlagsCount > 0 ? \`<span class="text-xs text-orange-600"><i class="fas fa-flag"></i>\${riskFlagsCount}</span>\` : ''}
                </div>
                <div class="font-medium text-sm text-gray-800 line-clamp-2 card-title">\${safeTitle}</div>
                <div class="flex justify-between items-center mt-2 text-xs card-meta">
                  <span class="\${urgencyClass}">
                    <i class="fas fa-calendar-alt mr-1"></i>
                    \${endDate ? endDate.toLocaleDateString('ja-JP') : '期限なし'}
                    \${daysLeft !== null && daysLeft <= 14 ? \`(\${daysLeft}日)\` : ''}
                  </span>
                  <span class="text-emerald-600 font-medium">
                    \${s.subsidy_max_limit ? (s.subsidy_max_limit >= 10000000 ? Math.floor(s.subsidy_max_limit/10000).toLocaleString() + '万円' : Number(s.subsidy_max_limit).toLocaleString() + '円') : '-'}
                  </span>
                </div>
              </a>
            \`;
          }
          
          // デスクトップ用: フル表示
          return \`
            <div class="card-hover bg-white rounded-lg shadow border-l-4 \${sc.border}">
              <div class="p-5">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2 flex-wrap gap-1">
                      <span class="px-2 py-1 \${sc.bg} \${sc.text} rounded text-xs font-medium">
                        <i class="fas \${sc.icon} mr-1"></i>\${sc.label}
                      </span>
                      <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        スコア: \${e.score || 0}%
                      </span>
                      \${isPreciseScreening ? \`
                        <span class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs" title="要件データに基づく精密判定済みです">
                          <i class="fas fa-check-double mr-1"></i>精密判定
                        </span>
                      \` : ''}
                      \${isFastScreening ? \`
                        <span class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs" title="要件データなしの簡易判定です。詳細ページで精密な判定が可能です">
                          <i class="fas fa-bolt mr-1"></i>簡易判定
                        </span>
                      \` : ''}
                      \${riskFlagsCount > 0 ? \`
                        <span class="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                          <i class="fas fa-flag mr-1"></i>リスク: \${riskFlagsCount}件
                        </span>
                      \` : ''}
                    </div>
                    
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">
                      <a href="/subsidies/\${subsidyId}?company_id=\${companyId}" 
                         class="hover:text-green-600 hover:underline">
                        \${safeTitle}
                      </a>
                    </h3>
                    
                    <!-- Sprint 2: なぜ出てきたかの説明 -->
                    \${safeWhyMatched ? \`
                      <div class="mb-3 px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-700">
                        <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>\${safeWhyMatched}
                      </div>
                    \` : ''}
                    
                    <div class="flex flex-wrap gap-4 text-sm mb-3">
                      <div class="flex items-center text-gray-600">
                        <i class="fas fa-building mr-1"></i>
                        \${safeOrg}
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
                    
                    <!-- Sprint 2: 条件バッジ -->
                    \${conditionBadges}
                  </div>
                  
                  <div class="ml-4 flex flex-col space-y-2 card-actions">
                    <a href="/subsidies/\${subsidyId}?company_id=\${companyId}" 
                       class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm text-center tap-target">
                      <i class="fas fa-arrow-right mr-1"></i>詳細を見る
                    </a>
                    \${(e.status !== 'NO' && e.status !== 'DO_NOT_PROCEED' && s.wall_chat_ready !== false) ? \`
                      <a href="/chat?subsidy_id=\${subsidyId}&company_id=\${companyId}" 
                         class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm text-center tap-target">
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
        
        // ===== パフォーマンス最適化: クライアント側ページネーション =====
        // （サーバーから取得した全結果をクライアント側で20件ずつ表示）
        if (filteredResults.length > PAGE_SIZE) {
          let pagHtml = \`<div class="flex items-center justify-center gap-2 flex-wrap pagination-mobile">\`;
          
          // ページ情報表示
          pagHtml += \`<span class="text-sm text-gray-600 w-full text-center mb-2 sm:w-auto sm:mb-0">\${filteredResults.length}件中 \${startIdx + 1}-\${Math.min(startIdx + PAGE_SIZE, filteredResults.length)}件を表示</span>\`;
          
          // 前へボタン
          if (displayPage > 1) {
            pagHtml += \`<button onclick="goToPage(\${displayPage - 1})" class="px-3 py-2 border rounded hover:bg-gray-50 tap-target">
              <i class="fas fa-chevron-left"></i><span class="hidden sm:inline ml-1">前へ</span>
            </button>\`;
          }
          
          // ページ番号（モバイルでは現在ページ周辺のみ）
          const maxButtons = isMobile ? 3 : 5;
          const halfMax = Math.floor(maxButtons / 2);
          let startPage = Math.max(1, displayPage - halfMax);
          let endPage = Math.min(totalPages, startPage + maxButtons - 1);
          if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
          }
          
          for (let i = startPage; i <= endPage; i++) {
            pagHtml += \`<button onclick="goToPage(\${i})" class="px-3 py-2 border rounded tap-target \${i === displayPage ? 'bg-green-600 text-white' : 'hover:bg-gray-50'}">\${i}</button>\`;
          }
          
          // 次へボタン
          if (displayPage < totalPages) {
            pagHtml += \`<button onclick="goToPage(\${displayPage + 1})" class="px-3 py-2 border rounded hover:bg-gray-50 tap-target">
              <span class="hidden sm:inline mr-1">次へ</span><i class="fas fa-chevron-right"></i>
            </button>\`;
          }
          
          pagHtml += \`</div>\`;
          
          document.getElementById('pagination').innerHTML = pagHtml;
          document.getElementById('pagination').classList.remove('hidden');
        } else {
          document.getElementById('pagination').classList.add('hidden');
        }
        
        // パフォーマンス計測
        const renderTime = performance.now() - renderStart;
        if (renderTime > 500) {
          console.warn('[Perf] Slow render:', renderTime.toFixed(2) + 'ms');
        }
      }
      
      // ===== ページ切替関数（クライアント側ページネーション用） =====
      window.goToPage = function(page) {
        displayPage = page;
        // 地雷3対策: meta情報を保持（currentMeta を使う）
        renderResults(currentResults, currentMeta || { total: currentResults.length, source: 'cache' });
        // スクロールをトップに
        document.getElementById('subsidies-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      
      // Sprint 2: 条件バッジを生成
      function generateConditionBadges(evaluation) {
        const badges = [];
        
        // 文字列化ヘルパー（オブジェクトの場合は適切に変換）
        function toDisplayString(item) {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            // オブジェクトの場合、reason/text/message/descriptionなどのプロパティを探す
            return item.reason || item.text || item.message || item.description || item.name || JSON.stringify(item);
          }
          return String(item);
        }
        
        // マッチ理由（達成条件）
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
        
        // リスクフラグ（未達条件・注意事項）
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
        
        // 残りの項目数
        const totalItems = (evaluation.match_reasons?.length || 0) + (evaluation.risk_flags?.length || 0);
        const shownItems = Math.min(3, evaluation.match_reasons?.length || 0) + Math.min(2, evaluation.risk_flags?.length || 0);
        if (totalItems > shownItems) {
          badges.push(\`<span class="text-xs text-gray-500">+\${totalItems - shownItems}件</span>\`);
        }
        
        if (badges.length === 0) {
          return '';
        }
        
        return \`
          <div class="flex flex-wrap gap-2 pt-2 border-t">
            \${badges.join('')}
          </div>
        \`;
      }
      
      // Sprint 2: なぜ出てきたかの説明
      function generateWhyMatched(evaluation) {
        // 文字列化ヘルパー（オブジェクトの場合は適切に変換）
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
            if (reason) {
              return \`あなたの会社は「\${reason}」に該当するため、この補助金が推奨されています。\`;
            }
          }
          return 'あなたの会社の条件に合致しています。';
        } else if (evaluation.status === 'CAUTION') {
          if (evaluation.risk_flags && evaluation.risk_flags.length > 0) {
            var flag = toDisplayString(evaluation.risk_flags[0]);
            if (flag) {
              return \`「\${flag}」の確認が必要です。条件を満たせば申請可能な可能性があります。\`;
            }
          }
          return '一部の条件について確認が必要です。';
        } else if (evaluation.status === 'NO' || evaluation.status === 'DO_NOT_PROCEED') {
          if (evaluation.risk_flags && evaluation.risk_flags.length > 0) {
            var flag = toDisplayString(evaluation.risk_flags[0]);
            if (flag) {
              return \`「\${flag}」のため、現在の条件では申請が難しい可能性があります。\`;
            }
          }
          return '現在の条件では申請要件を満たしていません。';
        }
        return '';
      }
      
      // ===== パフォーマンス最適化: フィルター変更時にページリセット =====
      const statusFilterEl = document.getElementById('status-filter');
      if (statusFilterEl) {
        statusFilterEl.addEventListener('change', () => {
          displayPage = 1; // ページをリセット
          // 地雷3対策: meta情報を保持
          renderResults(currentResults, currentMeta || null);
        });
      }
      
      // ===== デバウンス: キーワード入力時の遅延検索 =====
      let searchTimeout;
      const keywordInput = document.getElementById('keyword');
      if (keywordInput) {
        keywordInput.addEventListener('input', () => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            if (currentResults.length > 0) {
              // 既存の結果があればクライアント側フィルタのみ
              // 新規検索はEnterキーまたはボタンクリック時
            }
          }, 300);
        });
      }
      
      // =============================================================================
      // 詳細フィルター関連
      // =============================================================================
      
      // マスタデータキャッシュ
      let masterData = null;
      
      // 選択中のフィルター
      let selectedFilters = {
        issuers: [],
        regions: [],
        categories: [],
        industries: [],
      };
      
      // 詳細フィルターパネルの開閉
      window.toggleAdvancedFilter = function() {
        const panel = document.getElementById('advanced-filter-panel');
        const icon = document.getElementById('filter-toggle-icon');
        
        if (panel.classList.contains('hidden')) {
          panel.classList.remove('hidden');
          icon.classList.add('rotate-180');
          // 初回オープン時にマスタデータを読み込む
          if (!masterData) {
            loadMasterData();
          }
        } else {
          panel.classList.add('hidden');
          icon.classList.remove('rotate-180');
        }
      };
      
      // フィルタータブ切替
      window.switchFilterTab = function(tabName) {
        document.querySelectorAll('.filter-tab-btn').forEach(btn => {
          if (btn.dataset.filterTab === tabName) {
            btn.classList.add('border-green-600', 'text-green-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
          } else {
            btn.classList.remove('border-green-600', 'text-green-600');
            btn.classList.add('border-transparent', 'text-gray-500');
          }
        });
        
        document.querySelectorAll('.filter-tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        document.getElementById('filter-tab-' + tabName).classList.remove('hidden');
      };
      
      // XSS対策: HTMLエスケープ関数
      function escapeHtml(str) {
        if (str == null) return '';
        if (typeof str !== 'string') str = String(str);
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      // 安全な属性値エスケープ（id/value用）
      function escapeAttr(str) {
        if (str == null) return '';
        if (typeof str !== 'string') str = String(str);
        // 英数字とハイフン、アンダースコアのみ許可
        return str.replace(/[^a-zA-Z0-9_-]/g, '');
      }
      
      // マスタデータ読み込み
      async function loadMasterData() {
        try {
          const res = await api('/api/masters/all');
          if (res && res.success && res.data) {
            masterData = res.data;
            renderMasterFilters();
          } else {
            console.error('Failed to load masters:', res?.error || 'Unknown error');
            // エラー時はUIに通知
            showMasterLoadError();
          }
        } catch (e) {
          console.error('Load masters error:', e);
          showMasterLoadError();
        }
      }
      
      // マスタ読み込みエラー表示
      function showMasterLoadError() {
        const containers = [
          'issuer-ministry-list', 'issuer-org-list', 'category-tree', 'industry-list',
          'region-group-hokkaido', 'region-group-kanto', 'region-group-chubu',
          'region-group-kinki', 'region-group-chugoku', 'region-group-shikoku', 'region-group-kyushu'
        ];
        containers.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = '<p class="text-xs text-red-500">読み込みに失敗しました</p>';
        });
      }
      
      // マスタフィルターのレンダリング
      function renderMasterFilters() {
        if (!masterData) return;
        
        // 安全なデータアクセス用ヘルパー
        const safeGet = (obj, path, defaultVal) => {
          try {
            const keys = path.split('.');
            let result = obj;
            for (const key of keys) {
              if (result == null) return defaultVal;
              result = result[key];
            }
            return result ?? defaultVal;
          } catch {
            return defaultVal;
          }
        };
        
        // 発行機関（省庁）
        const ministryList = document.getElementById('issuer-ministry-list');
        const ministryData = safeGet(masterData, 'issuers.grouped.ministry', []);
        if (ministryList && Array.isArray(ministryData)) {
          ministryList.innerHTML = ministryData.map(issuer => {
            if (!issuer || !issuer.id) return '';
            const safeId = escapeAttr(issuer.id);
            const safeName = escapeHtml(issuer.name_short || issuer.name || '');
            const safeCount = Number(issuer.subsidy_count) || 0;
            return \`
            <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
              <input type="checkbox" value="\${safeId}" class="issuer-checkbox rounded text-green-600" 
                     onchange="updateFilterSelection('issuers', '\${safeId}', this.checked)" />
              <span>\${safeName}</span>
              <span class="text-xs text-gray-400 ml-auto">\${safeCount}</span>
            </label>
          \`;
          }).join('');
        }
        
        // 発行機関（その他）
        const orgList = document.getElementById('issuer-org-list');
        const orgData = safeGet(masterData, 'issuers.grouped.organization', []);
        if (orgList && Array.isArray(orgData)) {
          orgList.innerHTML = orgData.map(issuer => {
            if (!issuer || !issuer.id) return '';
            const safeId = escapeAttr(issuer.id);
            const safeName = escapeHtml(issuer.name_short || issuer.name || '');
            const safeCount = Number(issuer.subsidy_count) || 0;
            return \`
            <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
              <input type="checkbox" value="\${safeId}" class="issuer-checkbox rounded text-green-600"
                     onchange="updateFilterSelection('issuers', '\${safeId}', this.checked)" />
              <span>\${safeName}</span>
              <span class="text-xs text-gray-400 ml-auto">\${safeCount}</span>
            </label>
          \`;
          }).join('');
        }
        
        // 地域（グループ別）
        const regionGroupMap = {
          '北海道・東北': 'hokkaido',
          '関東': 'kanto',
          '中部': 'chubu',
          '近畿': 'kinki',
          '中国': 'chugoku',
          '四国': 'shikoku',
          '九州・沖縄': 'kyushu',
        };
        
        const regionGroups = safeGet(masterData, 'regions.groups', []);
        if (Array.isArray(regionGroups)) {
          regionGroups.forEach(group => {
            if (!group || !group.name) return;
            const containerId = 'region-group-' + (regionGroupMap[group.name] || '');
            const container = document.getElementById(containerId);
            if (container && Array.isArray(group.prefectures)) {
              container.innerHTML = group.prefectures.map(pref => {
                if (!pref || !pref.code) return '';
                const safeCode = escapeAttr(pref.code);
                const safeName = escapeHtml((pref.name || '').replace(/県|府|都|道$/, ''));
                const safeCount = Number(pref.subsidy_count) || 0;
                return \`
                <label class="flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
                  <input type="checkbox" value="\${safeCode}" class="region-checkbox rounded text-green-600 w-3 h-3"
                         onchange="updateFilterSelection('regions', '\${safeCode}', this.checked)" />
                  <span>\${safeName}</span>
                  <span class="text-gray-400 ml-auto">\${safeCount}</span>
                </label>
              \`;
              }).join('');
            }
          });
        }
        
        // カテゴリ（ツリー形式）
        const categoryTree = document.getElementById('category-tree');
        const categoryTreeData = safeGet(masterData, 'categories.tree', []);
        if (categoryTree && Array.isArray(categoryTreeData)) {
          categoryTree.innerHTML = categoryTreeData.map(major => {
            if (!major || !major.id) return '';
            const safeId = escapeAttr(major.id);
            const safeName = escapeHtml(major.name || '');
            const safeCount = Number(major.subsidy_count) || 0;
            const children = Array.isArray(major.children) ? major.children : [];
            
            return \`
            <div class="border rounded-lg p-3">
              <label class="flex items-center gap-2 font-medium text-sm cursor-pointer">
                <input type="checkbox" value="\${safeId}" class="category-checkbox rounded text-green-600"
                       onchange="updateFilterSelection('categories', '\${safeId}', this.checked)" />
                <span>\${safeName}</span>
                <span class="text-xs text-gray-400 ml-auto">\${safeCount}</span>
              </label>
              \${children.length > 0 ? \`
                <div class="ml-5 mt-2 space-y-1">
                  \${children.map(minor => {
                    if (!minor || !minor.id) return '';
                    const minorId = escapeAttr(minor.id);
                    const minorName = escapeHtml(minor.name || '');
                    const minorCount = Number(minor.subsidy_count) || 0;
                    return \`
                    <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input type="checkbox" value="\${minorId}" class="category-checkbox rounded text-green-600"
                             onchange="updateFilterSelection('categories', '\${minorId}', this.checked)" />
                      <span class="text-gray-700">\${minorName}</span>
                      <span class="text-xs text-gray-400 ml-auto">\${minorCount}</span>
                    </label>
                  \`;
                  }).join('')}
                </div>
              \` : ''}
            </div>
          \`;
          }).join('');
        }
        
        // 業種
        const industryList = document.getElementById('industry-list');
        const industriesData = safeGet(masterData, 'industries', []);
        if (industryList && Array.isArray(industriesData)) {
          industryList.innerHTML = industriesData.map(ind => {
            if (!ind || !ind.id) return '';
            const safeId = escapeAttr(ind.id);
            const safeName = escapeHtml(ind.name_short || ind.name || '');
            return \`
            <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded border">
              <input type="checkbox" value="\${safeId}" class="industry-checkbox rounded text-green-600"
                     onchange="updateFilterSelection('industries', '\${safeId}', this.checked)" />
              <span>\${safeName}</span>
            </label>
          \`;
          }).join('');
        }
      }
      
      // フィルター選択更新
      window.updateFilterSelection = function(type, value, checked) {
        if (checked) {
          if (!selectedFilters[type].includes(value)) {
            selectedFilters[type].push(value);
          }
        } else {
          selectedFilters[type] = selectedFilters[type].filter(v => v !== value);
        }
        updateFilterBadges();
        updateActiveFiltersChips();
      };
      
      // フィルターバッジ更新
      function updateFilterBadges() {
        const badges = {
          'issuer-count-badge': selectedFilters.issuers.length,
          'region-count-badge': selectedFilters.regions.length,
          'category-count-badge': selectedFilters.categories.length,
          'industry-count-badge': selectedFilters.industries.length,
        };
        
        Object.keys(badges).forEach(id => {
          const badge = document.getElementById(id);
          if (badge) {
            if (badges[id] > 0) {
              badge.textContent = badges[id];
              badge.classList.remove('hidden');
            } else {
              badge.classList.add('hidden');
            }
          }
        });
      }
      
      // アクティブフィルターチップ表示
      function updateActiveFiltersChips() {
        const container = document.getElementById('active-filters');
        if (!container) return;
        
        const chips = [];
        
        // 各フィルタータイプごとにチップを生成
        if (selectedFilters.issuers.length > 0) {
          chips.push(\`<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">発行機関: \${selectedFilters.issuers.length}件</span>\`);
        }
        if (selectedFilters.regions.length > 0) {
          chips.push(\`<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full">地域: \${selectedFilters.regions.length}件</span>\`);
        }
        if (selectedFilters.categories.length > 0) {
          chips.push(\`<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">カテゴリ: \${selectedFilters.categories.length}件</span>\`);
        }
        if (selectedFilters.industries.length > 0) {
          chips.push(\`<span class="px-2 py-1 bg-orange-100 text-orange-800 rounded-full">業種: \${selectedFilters.industries.length}件</span>\`);
        }
        
        container.innerHTML = chips.join('');
      }
      
      // フィルターをクリア
      window.clearAllFilters = function() {
        selectedFilters = { issuers: [], regions: [], categories: [], industries: [] };
        
        // チェックボックスをすべて解除
        document.querySelectorAll('.issuer-checkbox, .region-checkbox, .category-checkbox, .industry-checkbox')
          .forEach(cb => cb.checked = false);
        
        updateFilterBadges();
        updateActiveFiltersChips();
      };
      
      // フィルター適用
      window.applyFilters = function() {
        // 現在は選択されたフィルターをログに出力（実際のフィルタリングは検索APIパラメータで行う）
        console.log('Applied filters:', selectedFilters);
        
        // TODO: 要確認 - 検索APIにフィルターパラメータを渡す
        // 現在のJグランツAPIは詳細フィルター（発行機関・業種カテゴリ等）をサポートしていない。
        // 方式案: (1) サーバー側でフィルタ後にページング, (2) 全件取得→クライアント側フィルタ
        // 受け入れ基準: 基本フィルター(issuer/region/category)が検索結果に反映されること
        // テストケース: 発行機関＝東京都 → 東京都の補助金のみ表示
        
        // フィルターパネルを閉じる
        const panel = document.getElementById('advanced-filter-panel');
        const icon = document.getElementById('filter-toggle-icon');
        panel.classList.add('hidden');
        icon.classList.remove('rotate-180');
        
        // 検索を再実行（フィルターパラメータ付き）
        if (currentResults.length > 0) {
          displayPage = 1;
          // クライアント側でフィルタリング（暫定実装）
          // 将来的にはサーバー側でフィルタリング
          renderResults(currentResults, { total: currentResults.length, source: 'cache (filtered)' });
        } else {
          searchSubsidies(1);
        }
      };
      
      // 初期化（window.apiが定義されるのを待つ）
      if (typeof window.api === 'function') {
        loadCompanies();
      } else {
        // window.apiが未定義の場合は少し待ってから実行
        setTimeout(() => {
          if (typeof window.api === 'function') {
            loadCompanies();
          } else {
            console.error('[補助金検索] window.api is not defined after timeout');
            showNoCompanyAlert();
          }
        }, 100);
      }
    </script>
  `;
  
  return c.html(subsidyLayout('補助金を探す', content, '/subsidies'));
});

/**
 * 補助金詳細ページ（S2）
 * Sprint 3: 加点要素の表示
 */
subsidyPages.get('/subsidies/:id', (c) => {
  const subsidyId = c.req.param('id');
  
  const content = `
    <div id="loading-detail" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
    
    <div id="subsidy-detail" class="hidden">
      <!-- パンくずリスト -->
      <nav class="mb-4 text-sm">
        <ol class="flex items-center space-x-2 text-gray-500">
          <li><a href="/subsidies" class="hover:text-green-600">補助金一覧</a></li>
          <li><i class="fas fa-chevron-right text-xs"></i></li>
          <li id="breadcrumb-title" class="text-gray-800 truncate max-w-md">詳細</li>
        </ol>
      </nav>
      
      <!-- ヘッダーセクション -->
      <div class="bg-white rounded-lg shadow mb-6">
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div id="status-badges" class="flex items-center space-x-2 mb-3">
                <!-- ステータスバッジはJSで挿入 -->
              </div>
              <h1 id="subsidy-title" class="text-2xl font-bold text-gray-800 mb-2"></h1>
              <p id="subsidy-org" class="text-gray-600"></p>
            </div>
            <div id="action-buttons" class="ml-6 flex flex-col space-y-2">
              <!-- アクションボタンはJSで挿入 -->
            </div>
          </div>
        </div>
        
        <!-- 基本情報カード（Phase 19-A 拡張） -->
        <div class="border-t px-6 py-4 bg-gray-50">
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div class="text-xs text-gray-500 mb-1"><i class="fas fa-clock text-orange-400 mr-1"></i>申請締切</div>
              <div id="info-deadline" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1"><i class="fas fa-coins text-yellow-500 mr-1"></i>補助上限額</div>
              <div id="info-max-limit" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1"><i class="fas fa-percentage text-blue-500 mr-1"></i>補助率</div>
              <div id="info-rate" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1"><i class="fas fa-map-marker-alt text-red-400 mr-1"></i>対象地域</div>
              <div id="info-area" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1"><i class="fas fa-signal text-green-500 mr-1"></i>壁打ち対応</div>
              <div id="info-wallchat" class="font-semibold text-gray-800">-</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- タブナビゲーション -->
      <div class="bg-white rounded-lg shadow">
        <div class="border-b">
          <nav class="flex -mb-px">
            <button onclick="switchTab('overview')" data-tab="overview" 
                    class="tab-btn px-6 py-3 border-b-2 border-green-600 text-green-600 font-medium">
              <i class="fas fa-info-circle mr-1"></i>概要
            </button>
            <button onclick="switchTab('eligibility')" data-tab="eligibility"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-clipboard-check mr-1"></i>申請要件
            </button>
            <button onclick="switchTab('expenses')" data-tab="expenses"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-yen-sign mr-1"></i>対象経費
            </button>
            <button onclick="switchTab('bonus')" data-tab="bonus"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-star mr-1"></i>加点要素
            </button>
            <button onclick="switchTab('documents')" data-tab="documents"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-file-alt mr-1"></i>必要書類
            </button>
            <button onclick="switchTab('forms')" data-tab="forms"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-file-signature mr-1"></i>様式
            </button>
            <button onclick="switchTab('evaluation')" data-tab="evaluation"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-chart-bar mr-1"></i>マッチング結果
            </button>
          </nav>
        </div>
        
        <!-- タブコンテンツ -->
        <div class="p-6">
          <!-- 概要タブ（Phase 19-A: リッチ化） -->
          <div id="tab-overview" class="tab-content" style="display:block">
            <div class="prose max-w-none">
              <!-- 概要セクション -->
              <div class="mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-info-circle text-green-600 mr-2"></i>補助金の概要
                </h3>
                <div id="overview-content" class="text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border-l-4 border-green-500"></div>
              </div>
              
              <!-- 目的セクション -->
              <div id="purpose-section" class="hidden mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-bullseye text-blue-600 mr-2"></i>補助金の目的
                </h3>
                <div id="purpose-content" class="text-gray-700 whitespace-pre-wrap bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400"></div>
              </div>
              
              <!-- 対象事業セクション -->
              <div id="target-section" class="mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-building text-purple-600 mr-2"></i>補助対象事業
                </h3>
                <div id="target-content" class="text-gray-700 whitespace-pre-wrap bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400"></div>
              </div>
              
              <!-- 申請期間タイムライン -->
              <div id="timeline-section" class="hidden mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-calendar-alt text-orange-600 mr-2"></i>申請期間
                </h3>
                <div id="timeline-content" class="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
                  <div class="flex items-center justify-between">
                    <div class="text-center">
                      <div class="text-xs text-gray-500">受付開始</div>
                      <div id="timeline-start" class="font-semibold text-gray-800">-</div>
                    </div>
                    <div class="flex-1 mx-4">
                      <div class="relative h-2 bg-gray-200 rounded-full">
                        <div id="timeline-progress" class="absolute h-2 bg-orange-500 rounded-full" style="width:0%"></div>
                      </div>
                      <div id="timeline-remaining" class="text-center text-xs text-orange-600 mt-1"></div>
                    </div>
                    <div class="text-center">
                      <div class="text-xs text-gray-500">受付終了</div>
                      <div id="timeline-end" class="font-semibold text-gray-800">-</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 電子申請情報 -->
              <div id="electronic-section" class="hidden mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-laptop text-indigo-600 mr-2"></i>電子申請情報
                </h3>
                <div id="electronic-content" class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div class="flex items-start">
                    <div class="bg-indigo-100 rounded-full p-2 mr-3">
                      <i class="fas fa-globe text-indigo-600"></i>
                    </div>
                    <div class="flex-1">
                      <p id="electronic-system" class="font-medium text-indigo-800"></p>
                      <p id="electronic-notes" class="text-sm text-indigo-700 mt-1"></p>
                      <a id="electronic-url" href="#" target="_blank" class="hidden mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                        <i class="fas fa-external-link-alt mr-1"></i>申請システムを開く
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 公式リンク・公募要領 -->
              <div id="links-section" class="hidden mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-link text-teal-600 mr-2"></i>公式リンク
                </h3>
                <div id="links-list" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
              </div>
              
              <!-- 添付ファイル -->
              <div class="mb-6">
                <h3 class="text-lg font-semibold mb-3 flex items-center">
                  <i class="fas fa-paperclip text-gray-600 mr-2"></i>添付ファイル
                </h3>
                <div id="attachments-list" class="space-y-2"></div>
              </div>
              
              <!-- データソース情報 -->
              <div id="source-section" class="hidden">
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <span id="source-info"><i class="fas fa-database mr-1"></i>データソース: -</span>
                    <span id="source-schema"><i class="fas fa-code-branch mr-1"></i>スキーマ: -</span>
                    <span id="source-wallchat"><i class="fas fa-comments mr-1"></i>壁打ち: -</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 申請要件タブ -->
          <div id="tab-eligibility" class="tab-content hidden" style="display:none">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">申請要件</h3>
              <p class="text-sm text-gray-600">この補助金に申請するための要件です。AUTO: 自動判定可能、MANUAL: 確認が必要</p>
            </div>
            
            <div id="eligibility-list" class="space-y-3">
              <p class="text-gray-500">要件情報を読み込み中...</p>
            </div>
            
            <!-- 要件読み込みセクション: AWSジョブ設定済みかつdetail_jsonに要件がない場合のみ表示 -->
            <div id="ingest-section" class="mt-6 p-4 bg-blue-50 rounded-lg hidden">
              <h4 class="font-medium text-blue-800 mb-2">
                <i class="fas fa-lightbulb mr-1"></i>要件の読み込み
              </h4>
              <p class="text-sm text-blue-700 mb-3">
                公募要領から詳細な要件を抽出して表示できます。まだ読み込まれていない場合は下のボタンで取り込みを開始してください。
              </p>
              <button onclick="ingestEligibility()" id="btn-ingest" 
                      class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                <i class="fas fa-download mr-1"></i>要件を読み込む
              </button>
            </div>
          </div>
          
          <!-- 対象経費タブ -->
          <div id="tab-expenses" class="tab-content hidden" style="display:none">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">
                <i class="fas fa-yen-sign text-green-600 mr-1"></i>対象経費
              </h3>
              <p class="text-sm text-gray-600">
                この補助金で補助対象となる経費の一覧です。
              </p>
            </div>
            
            <div id="expenses-list">
              <p class="text-gray-500">対象経費情報を読み込み中...</p>
            </div>
          </div>
          
          <!-- 加点要素タブ（公募要領ベース + 一般的な例） -->
          <div id="tab-bonus" class="tab-content hidden" style="display:none">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">
                <i class="fas fa-star text-yellow-500 mr-1"></i>加点要素
              </h3>
              <p class="text-sm text-gray-600">
                これらの要素を満たすと審査で有利になる可能性があります。
              </p>
            </div>
            
            <!-- 公募要領からの加点項目（動的に表示） -->
            <div id="bonus-from-koubo" class="mb-6 hidden">
              <h4 class="font-medium text-gray-800 mb-3">
                <i class="fas fa-file-alt text-blue-500 mr-1"></i>この補助金の加点項目
              </h4>
              <div id="bonus-list" class="space-y-3"></div>
            </div>
            
            <!-- 一般的な加点要素（参考） -->
            <div id="bonus-general" class="mt-6">
              <h4 class="font-medium text-gray-500 mb-3">
                <i class="fas fa-info-circle mr-1"></i>一般的な加点要素（参考）
              </h4>
            
            <!-- 一般的な加点要素 -->
            <div class="space-y-4">
              <div class="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-800 flex items-center">
                      <i class="fas fa-chart-line text-green-500 mr-2"></i>
                      賃上げの実施（または計画）
                    </h4>
                    <p class="text-sm text-gray-600 mt-1">従業員の給与を一定以上引き上げる取り組み</p>
                  </div>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+5〜15点</span>
                </div>
                <div class="mt-3 pt-3 border-t">
                  <a href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html" 
                     target="_blank" class="text-sm text-blue-600 hover:underline">
                    <i class="fas fa-external-link-alt mr-1"></i>厚労省 賃上げ支援情報
                  </a>
                </div>
              </div>
              
              <div class="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-800 flex items-center">
                      <i class="fas fa-award text-blue-500 mr-2"></i>
                      経営革新計画の承認
                    </h4>
                    <p class="text-sm text-gray-600 mt-1">都道府県知事から経営革新計画の承認を受けている</p>
                  </div>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+5〜10点</span>
                </div>
                <div class="mt-3 pt-3 border-t">
                  <a href="https://www.chusho.meti.go.jp/keiei/kakushin/index.html" 
                     target="_blank" class="text-sm text-blue-600 hover:underline">
                    <i class="fas fa-external-link-alt mr-1"></i>中小企業庁 経営革新計画
                  </a>
                </div>
              </div>
              
              <div class="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-800 flex items-center">
                      <i class="fas fa-users text-purple-500 mr-2"></i>
                      事業継続力強化計画（BCP）
                    </h4>
                    <p class="text-sm text-gray-600 mt-1">災害等への対策計画を策定・認定を受けている</p>
                  </div>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+5点</span>
                </div>
                <div class="mt-3 pt-3 border-t">
                  <a href="https://www.chusho.meti.go.jp/keiei/antei/bousai/keizokuryoku.htm" 
                     target="_blank" class="text-sm text-blue-600 hover:underline">
                    <i class="fas fa-external-link-alt mr-1"></i>中小企業庁 事業継続力強化計画
                  </a>
                </div>
              </div>
              
              <div class="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-800 flex items-center">
                      <i class="fas fa-leaf text-green-600 mr-2"></i>
                      グリーン・デジタル投資
                    </h4>
                    <p class="text-sm text-gray-600 mt-1">CO2削減やDX推進に資する投資を計画している</p>
                  </div>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+5〜10点</span>
                </div>
                <div class="mt-3 pt-3 border-t">
                  <a href="https://www.env.go.jp/earth/ondanka/index.html" 
                     target="_blank" class="text-sm text-blue-600 hover:underline">
                    <i class="fas fa-external-link-alt mr-1"></i>環境省 脱炭素化支援
                  </a>
                </div>
              </div>
              
              <div class="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-800 flex items-center">
                      <i class="fas fa-handshake text-orange-500 mr-2"></i>
                      パートナーシップ構築宣言
                    </h4>
                    <p class="text-sm text-gray-600 mt-1">取引先との適正な取引関係を宣言している</p>
                  </div>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+2〜5点</span>
                </div>
                <div class="mt-3 pt-3 border-t">
                  <a href="https://www.biz-partnership.jp/" 
                     target="_blank" class="text-sm text-blue-600 hover:underline">
                    <i class="fas fa-external-link-alt mr-1"></i>パートナーシップ構築宣言ポータル
                  </a>
                </div>
              </div>
              
              <div class="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-medium text-gray-800 flex items-center">
                      <i class="fas fa-map-marker-alt text-red-500 mr-2"></i>
                      地域経済への貢献
                    </h4>
                    <p class="text-sm text-gray-600 mt-1">地域雇用の創出、地域資源の活用など</p>
                  </div>
                  <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+3〜10点</span>
                </div>
              </div>
            </div>
            
            <div class="mt-6 p-4 bg-yellow-50 rounded-lg">
              <h4 class="font-medium text-yellow-800 mb-2">
                <i class="fas fa-info-circle mr-1"></i>加点要素について
              </h4>
              <p class="text-sm text-yellow-700">
                上記は一般的な加点要素の例です。実際の加点項目・配点は補助金ごとに異なります。
                詳細は公募要領をご確認ください。壁打ちチャットで該当する加点要素があるかも確認できます。
              </p>
            </div>
          </div>
          </div>
          
          <!-- 必要書類タブ -->
          <div id="tab-documents" class="tab-content hidden" style="display:none">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">必要書類一覧</h3>
              <p class="text-sm text-gray-600">申請に必要な書類です。<span class="text-green-600">●</span>準備済み <span class="text-yellow-600">●</span>要準備 <span class="text-gray-400">●</span>任意</p>
            </div>
            
            <div id="documents-list" class="space-y-2">
              <p class="text-gray-500">必要書類情報を読み込み中...</p>
            </div>
          </div>
          
          <!-- 様式タブ（P3-SCORE1: required_forms表示） -->
          <div id="tab-forms" class="tab-content hidden" style="display:none">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">申請様式と記載項目</h3>
              <p class="text-sm text-gray-600">各様式で必要な記載項目の一覧です。壁打ちチャットで詳細を確認できます。</p>
            </div>
            
            <div id="forms-list" class="space-y-4">
              <p class="text-gray-500">様式情報を読み込み中...</p>
            </div>
          </div>
          
          <!-- マッチング結果タブ -->
          <div id="tab-evaluation" class="tab-content hidden" style="display:none">
            <div id="evaluation-content">
              <p class="text-gray-500">会社を選択して検索を実行すると、マッチング結果が表示されます。</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 補助金情報不足の警告 -->
      <div id="data-warning" class="hidden mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="flex items-start">
          <i class="fas fa-exclamation-triangle text-yellow-500 text-xl mr-3 mt-0.5"></i>
          <div class="flex-1">
            <h3 class="font-semibold text-yellow-800 mb-1">補助金の詳細情報が不足しています</h3>
            <p class="text-sm text-yellow-700 mb-2">
              この補助金の申請要件・必要書類の情報がまだ登録されていないため、申請書の作成に必要な情報が不十分です。
            </p>
            <ul id="missing-data-list" class="text-sm text-yellow-600 list-disc list-inside mb-3"></ul>
            <p class="text-xs text-yellow-600">
              <i class="fas fa-info-circle mr-1"></i>
              壁打ちを開始すると、AIが公募要領から情報を収集します。より正確なドラフトを作成するには、まず「申請要件」タブから要件の読み込みを行うことをお勧めします。
            </p>
          </div>
        </div>
      </div>
      
      <!-- 壁打ち開始CTA -->
      <div id="cta-section" class="hidden mt-6 bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold mb-2">この補助金で申請を進めますか？</h3>
            <p class="text-green-100">壁打ち機能で不足情報を確認し、申請書のドラフトを作成できます。</p>
          </div>
          <button onclick="startChat()" class="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 flex items-center">
            <i class="fas fa-comments mr-2"></i>壁打ちを開始
          </button>
        </div>
      </div>
    </div>
    
    <script>
      const subsidyId = '${subsidyId}';
      const urlParams = new URLSearchParams(window.location.search);
      const companyId = urlParams.get('company_id');
      const fromContext = urlParams.get('from');
      const backUrl = urlParams.get('back');
      let subsidyData = null;
      
      // HTMLエスケープ関数（XSS対策）- 詳細ページ用
      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      // P0-1凍結: fromパラメータに応じてパンくずリストを動的に変更
      (function updateBreadcrumb() {
        const breadcrumbNav = document.querySelector('nav.mb-4.text-sm ol');
        if (breadcrumbNav && fromContext === 'agency' && backUrl) {
          const firstLi = breadcrumbNav.querySelector('li:first-child a');
          if (firstLi) {
            firstLi.href = backUrl;
            firstLi.textContent = '士業ダッシュボードへ戻る';
            firstLi.classList.remove('hover:text-green-600');
            firstLi.classList.add('hover:text-emerald-600');
          }
        }
      })();
      
      // タブ切り替え
      function switchTab(tabName) {
        console.log('[switchTab] Switching to:', tabName);
        
        // ボタンのスタイル切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
          if (btn.dataset.tab === tabName) {
            btn.classList.add('border-green-600', 'text-green-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
          } else {
            btn.classList.remove('border-green-600', 'text-green-600');
            btn.classList.add('border-transparent', 'text-gray-500');
          }
        });
        
        // すべてのタブコンテンツを非表示
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.add('hidden');
          content.style.display = 'none';
        });
        
        // 選択されたタブを表示
        const targetTab = document.getElementById('tab-' + tabName);
        if (targetTab) {
          targetTab.classList.remove('hidden');
          targetTab.style.display = 'block';
          targetTab.style.visibility = 'visible';
          targetTab.style.opacity = '1';
          targetTab.style.height = 'auto';
          targetTab.style.overflow = 'visible';
          
          // 親要素も確実に表示
          const parent = targetTab.parentElement;
          if (parent) {
            parent.style.display = 'block';
            parent.style.height = 'auto';
            parent.style.overflow = 'visible';
          }
          
          console.log('[switchTab] Displayed tab:', tabName, 'innerHTML length:', targetTab.innerHTML.length);
        } else {
          console.error('[switchTab] Tab not found:', 'tab-' + tabName);
        }
      }
      
      // 詳細データ読み込み
      async function loadDetail() {
        try {
          console.log('[LoadDetail] Starting for subsidyId:', subsidyId);
          const params = companyId ? '?company_id=' + companyId : '';
          const res = await api('/api/subsidies/' + subsidyId + params);
          console.log('[LoadDetail] API response received:', JSON.stringify({
            success: res.success,
            error: res.error,
            has_normalized: !!res.data?.normalized,
            has_subsidy: !!res.data?.subsidy,
            has_required_forms: !!res.data?.required_forms,
            required_forms_count: res.data?.required_forms?.length || 0
          }));
          
          if (!res.success) {
            throw new Error(res.error?.message || '詳細の取得に失敗しました');
          }
          
          subsidyData = res.data;
          renderDetail(res.data);
          
          // 要件・必要書類・対象経費・加点項目・様式も取得（並列実行）
          // 全ての読み込みが完了してから警告チェックを実行
          await Promise.all([
            loadEligibility(),
            loadDocuments(),
            loadExpenses(),
            loadBonusPoints(),
          ]);
          // P3-2C: res.data全体を渡す（required_formsはres.data直下にある）
          loadForms(res.data);
          
          // 全データ読み込み完了後に警告を再チェック（非表示にする）
          checkAndShowDataWarning();
          
        } catch (e) {
          console.error('Load detail error:', e);
          document.getElementById('loading-detail').innerHTML = 
            '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>' + e.message + '</div>';
        }
      }
      
      // 詳細描画
      // ⚠️ v1.0 Freeze: normalized を優先参照（legacy は互換用）
      function renderDetail(data) {
        // ⚠️ null/undefined チェック
        if (!data) {
          console.error('[補助金詳細] Invalid data:', data);
          document.getElementById('loading-detail').innerHTML = 
            '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>データ形式が不正です。</div>';
          return;
        }
        
        // v1.0 Freeze: normalized を優先、無ければ legacy fallback
        const n = data.normalized;
        const s = data.subsidy; // legacy fallback
        const e = data.evaluation;
        
        // デバッグログ: normalized と legacy の両方を確認
        // Safe string helper for debug logging
        function safeStr(v, maxLen) {
          if (v == null) return null;
          if (typeof v === 'string') return v.substring(0, maxLen || 50);
          if (typeof v === 'object') {
            if (typeof v.summary === 'string') return v.summary.substring(0, maxLen || 50);
            return '[object]';
          }
          return String(v).substring(0, maxLen || 50);
        }
        console.log('[renderDetail] normalized:', n ? {
          title: n.display?.title,
          summary: safeStr(n.overview?.summary, 50),
          issuer_name: n.display?.issuer_name,
          wall_chat_ready: n.wall_chat?.ready,
        } : 'null');
        console.log('[renderDetail] legacy subsidy:', s ? {
          title: s.title,
          subsidy_summary: safeStr(s.subsidy_summary, 50),
        } : 'null');
        
        // normalized が無い場合は legacy fallback（互換期間）
        if (!n && !s) {
          console.error('[補助金詳細] Both normalized and subsidy are null');
          document.getElementById('loading-detail').innerHTML = 
            '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>データ形式が不正です。</div>';
          return;
        }
        
        document.getElementById('loading-detail').classList.add('hidden');
        document.getElementById('subsidy-detail').classList.remove('hidden');
        
        // ========================================
        // v1.0 Freeze: normalized 優先参照
        // ========================================
        
        // タイトル
        const title = n?.display?.title || s?.title || s?.name || '補助金詳細';
        document.getElementById('breadcrumb-title').textContent = title;
        document.getElementById('subsidy-title').textContent = title || '補助金名未設定';
        
        // 実施機関
        const issuerName = n?.display?.issuer_name || s?.subsidy_executing_organization || '事務局情報なし';
        document.getElementById('subsidy-org').innerHTML = '<i class="fas fa-building mr-1"></i>' + escapeHtml(issuerName);
        
        // ステータスバッジ
        console.log('[renderDetail] evaluation data:', e ? JSON.stringify({
          status: e.status,
          score: e.score,
          match_reasons_count: e.match_reasons?.length || 0,
          risk_flags_count: e.risk_flags?.length || 0,
        }) : 'null');
        console.log('[renderDetail] evaluation-content element exists:', !!document.getElementById('evaluation-content'));
        if (e) {
          const statusConfig = {
            'PROCEED': { bg: 'bg-green-100', text: 'text-green-800', icon: 'fa-check-circle', label: '推奨' },
            'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'fa-exclamation-triangle', label: '注意' },
            'NO': { bg: 'bg-red-100', text: 'text-red-800', icon: 'fa-times-circle', label: '非推奨' }
          };
          const sc = statusConfig[e.status] || statusConfig['CAUTION'];
          
          // ⚠️ risk_flags の null/undefined チェック
          const riskFlagsCount = Array.isArray(e.risk_flags) ? e.risk_flags.length : 0;
          
          document.getElementById('status-badges').innerHTML = \`
            <span class="px-3 py-1 \${sc.bg} \${sc.text} rounded-full text-sm font-medium">
              <i class="fas \${sc.icon} mr-1"></i>\${sc.label}
            </span>
            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              スコア: \${e.score || 0}%
            </span>
            \${riskFlagsCount > 0 ? \`
              <span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                <i class="fas fa-flag mr-1"></i>リスク: \${riskFlagsCount}件
              </span>
            \` : ''}
          \`;
          
          // CTAセクション表示（推奨/注意の場合）
          if (e.status !== 'NO' && e.status !== 'DO_NOT_PROCEED' && companyId) {
            document.getElementById('cta-section').classList.remove('hidden');
          }
          
          // オブジェクトを文字列に変換するヘルパー関数（XSS対策付き）
          function toDisplayText(item) {
            let text = '';
            if (typeof item === 'string') {
              text = item;
            } else if (item && typeof item === 'object') {
              // オブジェクトの場合、適切なプロパティを探す
              text = item.reason || item.text || item.message || item.description || item.name || item.label || 
                     (item.field ? \`\${item.field}: \${item.value || item.condition || ''}\` : '') ||
                     (typeof item.toString === 'function' && item.toString() !== '[object Object]' ? item.toString() : '');
            } else {
              text = String(item || '');
            }
            // ⚠️ XSS対策: エスケープして返す
            return escapeHtml(text);
          }
          
          // マッチ理由をフィルタリングして有効なものだけ表示（XSS対策済み）
          const validMatchReasons = (e.match_reasons || [])
            .map(r => toDisplayText(r))
            .filter(r => r && r.trim() && r !== '[object Object]');
          
          // リスクフラグをフィルタリングして有効なものだけ表示（XSS対策済み）
          const validRiskFlags = (e.risk_flags || [])
            .map(r => toDisplayText(r))
            .filter(r => r && r.trim() && r !== '[object Object]');
          
          // ⚠️ XSS対策: explanation をエスケープ
          const safeExplanation = escapeHtml(e.explanation || '説明なし');
          
          // マッチング結果タブの内容
          document.getElementById('evaluation-content').innerHTML = \`
            <div class="space-y-4">
              <div class="p-4 \${sc.bg} rounded-lg">
                <div class="font-semibold \${sc.text} mb-2">
                  <i class="fas \${sc.icon} mr-1"></i>判定: \${sc.label} (スコア: \${e.score || 0}%)
                </div>
                <p class="text-gray-700">\${safeExplanation}</p>
              </div>
              
              \${validMatchReasons.length > 0 ? \`
                <div>
                  <h4 class="font-medium text-gray-800 mb-2"><i class="fas fa-check text-green-500 mr-1"></i>マッチ理由</h4>
                  <ul class="space-y-1">
                    \${validMatchReasons.map(r => \`<li class="text-sm text-gray-700">・\${r}</li>\`).join('')}
                  </ul>
                </div>
              \` : \`
                <div class="p-3 bg-gray-50 rounded-lg">
                  <p class="text-sm text-gray-500">マッチ理由の詳細情報は取得されていません。</p>
                </div>
              \`}
              
              \${validRiskFlags.length > 0 ? \`
                <div>
                  <h4 class="font-medium text-gray-800 mb-2"><i class="fas fa-flag text-orange-500 mr-1"></i>リスクフラグ</h4>
                  <ul class="space-y-1">
                    \${validRiskFlags.map(r => \`<li class="text-sm text-orange-700">・\${r}</li>\`).join('')}
                  </ul>
                </div>
              \` : ''}
            </div>
          \`;
        }
        
        // ========================================
        // v1.0 Freeze: 基本情報も normalized 優先
        // ========================================
        
        // 締切日（normalized.acceptance 優先）
        const acceptanceEnd = n?.acceptance?.acceptance_end || s?.acceptance_end_datetime;
        const endDate = acceptanceEnd ? new Date(acceptanceEnd) : null;
        const daysLeft = endDate && !isNaN(endDate.getTime()) ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        document.getElementById('info-deadline').innerHTML = (endDate && !isNaN(endDate.getTime()))
          ? endDate.toLocaleDateString('ja-JP') + (daysLeft !== null ? \` <span class="\${daysLeft <= 14 ? 'text-red-600' : 'text-gray-500'}">(あと\${daysLeft}日)</span>\` : '')
          : '情報なし';
        
        // 補助上限（normalized.display 優先）
        const maxLimit = n?.display?.subsidy_max_limit ?? s?.subsidy_max_limit;
        document.getElementById('info-max-limit').textContent = maxLimit 
          ? Number(maxLimit).toLocaleString() + '円' : '情報なし';
        
        // 補助率（normalized.display 優先）
        const subsidyRate = n?.display?.subsidy_rate_text || s?.subsidy_rate;
        document.getElementById('info-rate').textContent = subsidyRate || '情報なし';
        
        // 対象地域（normalized.display 優先）
        const targetArea = n?.display?.target_area_text || s?.target_area;
        document.getElementById('info-area').textContent = targetArea || '全国';
        
        // 壁打ち対応状況
        const wallChatReady = n?.wall_chat?.ready ?? data.wall_chat_ready ?? false;
        const infoWallchat = document.getElementById('info-wallchat');
        if (wallChatReady) {
          infoWallchat.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>対応済</span>';
        } else {
          const missing = n?.wall_chat?.missing || data.wall_chat_missing || [];
          infoWallchat.innerHTML = '<span class="text-yellow-600"><i class="fas fa-clock mr-1"></i>準備中</span>' +
            (missing.length > 0 ? '<span class="text-xs text-gray-400 ml-1">(' + missing.join(',') + ')</span>' : '');
        }
        
        // ========================================
        // 概要・対象事業も normalized 優先（Phase 19-A リッチ化）
        // ========================================
        // Safe extraction of overview summary (may be string or object)
        let overviewText = n?.overview?.summary;
        if (overviewText && typeof overviewText === 'object') {
          overviewText = overviewText.summary || overviewText.text || overviewText.description || JSON.stringify(overviewText);
        }
        if (!overviewText || typeof overviewText !== 'string') {
          overviewText = s?.subsidy_summary || s?.outline || '概要情報なし';
          if (typeof overviewText === 'object') {
            overviewText = overviewText?.summary || JSON.stringify(overviewText);
          }
        }
        document.getElementById('overview-content').textContent = String(overviewText);
        
        // 目的（purpose）
        const purposeText = n?.overview?.purpose;
        if (purposeText && typeof purposeText === 'string' && purposeText.length > 5) {
          document.getElementById('purpose-section').classList.remove('hidden');
          document.getElementById('purpose-content').textContent = purposeText;
        }
        
        // 対象事業
        const targetText = n?.overview?.target_business || s?.target || s?.target_businesses || '';
        if (targetText && targetText.length > 3) {
          document.getElementById('target-content').textContent = targetText;
        } else {
          document.getElementById('target-section').classList.add('hidden');
        }
        
        // 申請期間タイムライン
        const startDate = n?.acceptance?.acceptance_start;
        const endDateStr = n?.acceptance?.acceptance_end || s?.acceptance_end_datetime;
        if (endDateStr) {
          const section = document.getElementById('timeline-section');
          section.classList.remove('hidden');
          
          const start = startDate ? new Date(startDate) : null;
          const end = new Date(endDateStr);
          const now = new Date();
          
          document.getElementById('timeline-start').textContent = start && !isNaN(start.getTime()) 
            ? start.toLocaleDateString('ja-JP') : '未定';
          document.getElementById('timeline-end').textContent = !isNaN(end.getTime()) 
            ? end.toLocaleDateString('ja-JP') : '未定';
          
          if (start && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const totalDays = Math.max(1, (end - start) / (1000*60*60*24));
            const elapsedDays = Math.max(0, (now - start) / (1000*60*60*24));
            const pct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
            document.getElementById('timeline-progress').style.width = pct + '%';
            
            const remainDays = Math.ceil((end - now) / (1000*60*60*24));
            if (remainDays > 0) {
              document.getElementById('timeline-remaining').textContent = 'あと' + remainDays + '日';
              document.getElementById('timeline-remaining').className = 
                'text-center text-xs mt-1 ' + (remainDays <= 14 ? 'text-red-600 font-bold' : 'text-orange-600');
            } else {
              document.getElementById('timeline-remaining').textContent = '受付終了';
              document.getElementById('timeline-remaining').className = 'text-center text-xs mt-1 text-red-600 font-bold';
              document.getElementById('timeline-progress').style.width = '100%';
              document.getElementById('timeline-progress').className = 'absolute h-2 bg-red-400 rounded-full';
            }
          }
        }
        
        // 電子申請情報
        const ea = n?.electronic_application;
        if (ea && ea.is_electronic_application) {
          document.getElementById('electronic-section').classList.remove('hidden');
          document.getElementById('electronic-system').textContent = ea.portal_name || '電子申請が必要です';
          document.getElementById('electronic-notes').textContent = ea.notes || 'この補助金はオンラインでの電子申請が必要です。';
          if (ea.portal_url) {
            const urlEl = document.getElementById('electronic-url');
            urlEl.href = ea.portal_url;
            urlEl.classList.remove('hidden');
          }
        }
        
        // 公式リンク
        const provenance = n?.provenance;
        const kouboUrls = provenance?.koubo_source_urls || [];
        const pdfUrls = provenance?.pdf_urls || [];
        const allLinks = [];
        
        kouboUrls.forEach(function(u, i) {
          if (u && u.match(/^https?:\\/\\//)) {
            allLinks.push({ 
              url: u, 
              label: i === 0 ? '公式ページ' : '関連ページ ' + (i+1), 
              icon: 'fa-globe', 
              color: 'teal' 
            });
          }
        });
        pdfUrls.forEach(function(u, i) {
          if (u && u.match(/^https?:\\/\\//)) {
            const name = decodeURIComponent(u.split('/').pop() || '').replace(/\\?.*$/, '');
            allLinks.push({ 
              url: u, 
              label: name.length > 30 ? name.substring(0,30) + '...' : (name || '公募要領PDF ' + (i+1)), 
              icon: 'fa-file-pdf', 
              color: 'red' 
            });
          }
        });
        
        if (allLinks.length > 0) {
          document.getElementById('links-section').classList.remove('hidden');
          document.getElementById('links-list').innerHTML = allLinks.map(function(link) {
            return '<a href="' + encodeURI(link.url) + '" target="_blank" rel="noopener noreferrer" ' +
              'class="flex items-center p-3 bg-white border rounded-lg hover:shadow-md transition-shadow group">' +
              '<i class="fas ' + link.icon + ' text-' + link.color + '-500 mr-3 text-lg"></i>' +
              '<div class="flex-1 min-w-0">' +
              '<span class="text-sm font-medium text-gray-800 group-hover:text-' + link.color + '-600 truncate block">' + escapeHtml(link.label) + '</span>' +
              '<span class="text-xs text-gray-400 truncate block">' + escapeHtml(link.url.replace(/^https?:\\/\\//, '').substring(0, 50)) + '</span>' +
              '</div>' +
              '<i class="fas fa-external-link-alt text-gray-400 group-hover:text-' + link.color + '-500 ml-2"></i>' +
              '</a>';
          }).join('');
        }
        
        // データソース情報
        const meta = data.meta;
        if (meta) {
          document.getElementById('source-section').classList.remove('hidden');
          document.getElementById('source-info').innerHTML = 
            '<i class="fas fa-database mr-1"></i>ソース: ' + escapeHtml(n?.source?.primary_source_type || data.source || '-');
          document.getElementById('source-schema').innerHTML = 
            '<i class="fas fa-code-branch mr-1"></i>スキーマ: v' + escapeHtml(meta.schema_version || '-');
          const wcReady = data.wall_chat_ready;
          document.getElementById('source-wallchat').innerHTML = 
            '<i class="fas fa-comments mr-1"></i>壁打ち: ' + 
            (wcReady ? '<span class="text-green-600">準備完了</span>' : '<span class="text-yellow-600">準備中</span>');
        }
        
        // 添付ファイル
        // v1.0 Freeze: normalized.content.attachments 優先
        // ⚠️ XSS対策: ファイル名とURLをエスケープ
        const attachments = n?.content?.attachments || data.attachments || [];
        if (attachments.length > 0) {
          document.getElementById('attachments-list').innerHTML = attachments.map(a => {
            const safeName = escapeHtml(a.name || '不明なファイル');
            // URLは特殊文字のみエスケープ（javascript: スキームを防ぐ）
            const safeUrl = a.url && a.url.match(/^https?:\\/\\//i) 
              ? encodeURI(a.url) 
              : '#';
            
            return \`
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div class="flex items-center">
                  <i class="fas fa-file-pdf text-red-500 mr-2"></i>
                  <span class="text-sm">\${safeName}</span>
                </div>
                <a href="\${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline text-sm">
                  <i class="fas fa-external-link-alt mr-1"></i>開く
                </a>
              </div>
            \`;
          }).join('');
        } else {
          document.getElementById('attachments-list').innerHTML = '<p class="text-gray-500 text-sm">添付ファイルなし</p>';
        }
        
        // アクションボタン
        const actionsHtml = \`
          <a href="/subsidies" class="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 text-sm text-center">
            <i class="fas fa-arrow-left mr-1"></i>一覧に戻る
          </a>
          \${companyId && e && e.status !== 'NO' && e.status !== 'DO_NOT_PROCEED' ? \`
            <button onclick="startChat()" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
              <i class="fas fa-comments mr-1"></i>壁打ちを開始
            </button>
          \` : ''}
        \`;
        document.getElementById('action-buttons').innerHTML = actionsHtml;
      }
      
      // データ不足チェック用のフラグ
      let hasEligibilityData = false;
      let hasDocumentsData = false;
      
      // データ不足警告を表示
      // v1.0 Freeze: normalized 優先参照
      function checkAndShowDataWarning() {
        const missingItems = [];
        
        // v1.0 Freeze: normalized 優先で補助金基本情報のチェック
        const n = subsidyData?.normalized;
        const s = subsidyData?.subsidy;
        
        // 補助率チェック
        const hasRate = n?.display?.subsidy_rate_text || s?.subsidy_rate;
        if (!hasRate) missingItems.push('補助率');
        
        // 概要チェック
        const rawSummary = n?.overview?.summary;
        const hasSummary = (typeof rawSummary === 'string' ? rawSummary : (rawSummary && typeof rawSummary === 'object' ? rawSummary.summary : null)) || s?.subsidy_summary || s?.outline;
        if (!hasSummary) missingItems.push('補助金の概要');
        
        if (!hasEligibilityData) missingItems.push('申請要件');
        if (!hasDocumentsData) missingItems.push('必要書類');
        
        const warningEl = document.getElementById('data-warning');
        const listEl = document.getElementById('missing-data-list');
        
        if (missingItems.length > 0) {
          listEl.innerHTML = missingItems.map(item => \`<li>\${item}</li>\`).join('');
          warningEl.classList.remove('hidden');
        } else {
          // データが揃っている場合は警告を非表示
          warningEl.classList.add('hidden');
        }
      }
      
      // 要件読み込み
      async function loadEligibility() {
        try {
          console.log('[Eligibility] Loading for subsidyId:', subsidyId);
          const res = await api('/api/subsidies/' + subsidyId + '/eligibility');
          console.log('[Eligibility] API response:', JSON.stringify({ success: res.success, error: res.error, dataLength: res.data?.length, meta: res.meta }));
          if (res.success && res.data && res.data.length > 0) {
            hasEligibilityData = true;
            console.log('[Eligibility] First rule:', JSON.stringify(res.data[0]));
            const html = res.data.map(rule => {
              const typeLabel = rule.check_type === 'AUTO' ? 
                '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">AUTO</span>' :
                '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">MANUAL</span>';
              
              return \`
                <div class="p-3 bg-gray-50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-800">\${escapeHtml(rule.category || '一般')}</span>
                    \${typeLabel}
                  </div>
                  <p class="text-sm text-gray-700">\${escapeHtml(rule.rule_text || '')}</p>
                  \${rule.source_text || rule.source ? \`<p class="text-xs text-gray-500 mt-1">出典: \${escapeHtml(rule.source_text || rule.source || '')}</p>\` : ''}
                </div>
              \`;
            }).join('');
            document.getElementById('eligibility-list').innerHTML = html;
            // 要件データがある場合はingestセクションを非表示のまま
            document.getElementById('ingest-section')?.classList.add('hidden');
          } else {
            hasEligibilityData = false;
            document.getElementById('eligibility-list').innerHTML = 
              '<p class="text-gray-500">要件情報がまだ登録されていません。</p>';
            // 要件データがない場合はingestセクションを表示（ただしAWS未設定時のエラーに注意）
            // 現状AWSジョブAPIが未設定のため、一旦非表示のまま
            // TODO: AWSジョブAPI設定後に有効化
            // document.getElementById('ingest-section')?.classList.remove('hidden');
          }
        } catch (e) {
          console.error('Load eligibility error:', e);
          hasEligibilityData = false;
          // グレースフルデグレード: エラーメッセージを表示
          document.getElementById('eligibility-list').innerHTML = 
            '<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">' +
            '<p class="text-yellow-700"><i class="fas fa-exclamation-triangle mr-1"></i>要件情報の読み込みに失敗しました。</p>' +
            '<p class="text-sm text-yellow-600 mt-1">ネットワーク接続を確認するか、しばらく待ってから再度お試しください。</p>' +
            '</div>';
        }
        // 注: checkAndShowDataWarning() は loadDetail() で全データ読み込み完了後に呼び出される
      }
      
      // 必要書類読み込み
      async function loadDocuments() {
        console.log('[Documents] loadDocuments called, subsidyId:', subsidyId);
        console.log('[Documents] documents-list element exists:', !!document.getElementById('documents-list'));
        try {
          console.log('[Documents] Loading for subsidyId:', subsidyId);
          const res = await api('/api/subsidies/' + subsidyId + '/documents');
          console.log('[Documents] API response:', JSON.stringify({ success: res.success, error: res.error, dataLength: res.data?.length, meta: res.meta }));
          if (res.success && res.data && res.data.length > 0) {
            hasDocumentsData = true;
            console.log('[Documents] First doc:', JSON.stringify(res.data[0]));
            const html = res.data.map(doc => {
              const levelIcon = doc.required_level === 'required' ? 
                '<span class="text-red-500">●</span>' :
                doc.required_level === 'conditional' ? 
                '<span class="text-yellow-500">●</span>' :
                '<span class="text-gray-400">●</span>';
              
              return \`
                <div class="flex items-center justify-between p-3 border rounded-lg">
                  <div class="flex items-center">
                    \${levelIcon}
                    <span class="ml-2 font-medium">\${escapeHtml(doc.name || doc.doc_code || '')}</span>
                  </div>
                  <span class="text-xs text-gray-500">\${escapeHtml(doc.required_level || '')}</span>
                </div>
              \`;
            }).join('');
            document.getElementById('documents-list').innerHTML = html;
          } else {
            hasDocumentsData = false;
            document.getElementById('documents-list').innerHTML = 
              '<p class="text-gray-500">必要書類情報がまだ登録されていません。</p>';
          }
        } catch (e) {
          console.error('Load documents error:', e);
          hasDocumentsData = false;
          // グレースフルデグレード: エラーメッセージを表示
          document.getElementById('documents-list').innerHTML = 
            '<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">' +
            '<p class="text-yellow-700"><i class="fas fa-exclamation-triangle mr-1"></i>必要書類情報の読み込みに失敗しました。</p>' +
            '</div>';
        }
        // 注: checkAndShowDataWarning() は loadDetail() で全データ読み込み完了後に呼び出される
      }
      
      // 様式情報表示（P3-SCORE1: required_forms）
      // v1.0 Freeze: normalized.content.required_forms を優先参照
      function loadForms(responseData) {
        console.log('[Forms] loadForms called with:', JSON.stringify({
          has_responseData: !!responseData,
          has_normalized: !!responseData?.normalized,
          has_content: !!responseData?.normalized?.content,
          has_required_forms_in_content: !!responseData?.normalized?.content?.required_forms,
          required_forms_count_in_content: responseData?.normalized?.content?.required_forms?.length || 0,
          has_required_forms_direct: !!responseData?.required_forms,
          required_forms_count_direct: responseData?.required_forms?.length || 0,
        }));
        try {
          // v1.0 Freeze: required_formsを優先順位で取得
          // 1. normalized.content.required_forms (SSOT - 最優先)
          // 2. res.data.required_forms (APIレスポンス直下 - 互換性)
          // 3. res.data.detail_json.required_forms (detail_json内 - レガシー)
          // 4. res.data.subsidy.required_forms (補助金オブジェクト内 - レガシー)
          let forms = [];
          
          // 1. normalized.content.required_forms (SSOT - 最優先)
          if (responseData.normalized?.content?.required_forms && 
              Array.isArray(responseData.normalized.content.required_forms) &&
              responseData.normalized.content.required_forms.length > 0) {
            forms = responseData.normalized.content.required_forms;
            console.log('[v1.0] Found required_forms in normalized.content:', forms.length);
          }
          // 2. APIレスポンス直下のrequired_forms（互換性）
          else if (responseData.required_forms && Array.isArray(responseData.required_forms)) {
            forms = responseData.required_forms;
            console.log('[P3-2C] Found required_forms in responseData:', forms.length);
          }
          // 3. detail_json内のrequired_forms（レガシー）
          else if (responseData.detail_json) {
            try {
              const detail = typeof responseData.detail_json === 'string' 
                ? JSON.parse(responseData.detail_json) 
                : responseData.detail_json;
              if (detail.required_forms && Array.isArray(detail.required_forms)) {
                forms = detail.required_forms;
                console.log('[P3-2C] Found required_forms in detail_json:', forms.length);
              }
            } catch (e) {
              console.warn('Failed to parse detail_json for forms:', e);
            }
          }
          // 4. subsidyオブジェクト内（レガシーフォールバック）
          else if (responseData.subsidy?.required_forms) {
            forms = responseData.subsidy.required_forms;
            console.log('[P3-2C] Found required_forms in subsidy:', forms.length);
          }
          
          if (forms.length > 0) {
            const html = forms.map((form, idx) => \`
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="flex items-start justify-between mb-2">
                  <h4 class="font-semibold text-gray-800">
                    <i class="fas fa-file-alt text-green-600 mr-2"></i>
                    \${escapeHtml(form.name || '様式' + (idx + 1))}
                  </h4>
                  \${form.form_id ? \`<span class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">\${escapeHtml(form.form_id)}</span>\` : ''}
                </div>
                
                \${form.notes ? \`
                  <p class="text-sm text-gray-600 mb-3">
                    <i class="fas fa-info-circle text-blue-500 mr-1"></i>
                    \${escapeHtml(form.notes)}
                  </p>
                \` : ''}
                
                <div class="mt-2">
                  <p class="text-xs text-gray-500 mb-2">記載項目:</p>
                  <ul class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    \${(form.fields || []).map(field => {
                      // P3-2C: fields は { name, description?, required? } または文字列の配列
                      const fieldName = typeof field === 'string' ? field : (field.name || '');
                      const isRequired = typeof field === 'object' ? (field.required !== false) : true;
                      const desc = typeof field === 'object' ? (field.description || '') : '';
                      return \`
                        <li class="flex items-start text-sm text-gray-700" title="\${escapeHtml(desc)}">
                          <i class="fas \${isRequired ? 'fa-asterisk text-red-400' : 'fa-circle text-gray-300'} mr-2 text-xs mt-1"></i>
                          <span>\${escapeHtml(fieldName)}\${!isRequired ? ' <span class="text-gray-400">(任意)</span>' : ''}</span>
                        </li>
                      \`;
                    }).join('')}
                  </ul>
                </div>
              </div>
            \`).join('');
            
            document.getElementById('forms-list').innerHTML = html;
          } else {
            document.getElementById('forms-list').innerHTML = \`
              <div class="text-center py-8 text-gray-500">
                <i class="fas fa-file-signature text-4xl mb-3 text-gray-300"></i>
                <p>様式情報がまだ登録されていません。</p>
                <p class="text-sm mt-2">壁打ちチャットで申請書類の詳細を確認できます。</p>
              </div>
            \`;
          }
        } catch (e) {
          console.error('Load forms error:', e);
          document.getElementById('forms-list').innerHTML = 
            '<p class="text-red-500">様式情報の読み込みに失敗しました。</p>';
        }
      }
      
      // 対象経費読み込み
      async function loadExpenses() {
        try {
          const res = await api('/api/subsidies/' + subsidyId + '/expenses');
          if (res.success && res.data && (
            (res.data.required_expenses && res.data.required_expenses.length > 0) ||
            (res.data.categories && res.data.categories.length > 0) ||
            (res.data.excluded_expenses && res.data.excluded_expenses.length > 0)
          )) {
            let html = '';
            
            // 必須経費
            if (res.data.required_expenses && res.data.required_expenses.length > 0) {
              html += '<div class="mb-6">' +
                '<h4 class="font-medium text-gray-800 mb-3"><i class="fas fa-check-circle text-green-500 mr-1"></i>必須経費</h4>' +
                '<div class="space-y-2">' +
                res.data.required_expenses.map(function(exp) {
                  var expName = escapeHtml(typeof exp === 'string' ? exp : (exp.name || ''));
                  var expDesc = exp.description ? '<p class="text-sm text-green-700 mt-1">' + escapeHtml(exp.description) + '</p>' : '';
                  var expMin = exp.min_amount ? '<p class="text-sm text-green-600 mt-1">最低単価: ' + Number(exp.min_amount).toLocaleString() + '円以上</p>' : '';
                  return '<div class="p-3 border-l-4 border-green-500 bg-green-50 rounded-r-lg">' +
                    '<div class="font-medium text-green-800">' + expName + '</div>' +
                    expDesc + expMin + '</div>';
                }).join('') +
                '</div></div>';
            }
            
            // カテゴリ別経費
            if (res.data.categories && res.data.categories.length > 0) {
              html += '<div class="mb-6">' +
                '<h4 class="font-medium text-gray-800 mb-3"><i class="fas fa-folder text-blue-500 mr-1"></i>経費カテゴリ</h4>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                res.data.categories.map(function(cat) {
                  var catName = escapeHtml(typeof cat === 'string' ? cat : (cat.name || ''));
                  var catDesc = cat.description ? '<p class="text-sm text-gray-600">' + escapeHtml(cat.description) + '</p>' : '';
                  var itemsHtml = '';
                  if (cat.items && cat.items.length > 0) {
                    itemsHtml = '<ul class="mt-2 space-y-1">' +
                      cat.items.slice(0, 5).map(function(item) {
                        var itemName = escapeHtml(typeof item === 'string' ? item : (item.name || ''));
                        return '<li class="text-sm text-gray-700">・' + itemName + '</li>';
                      }).join('') +
                      (cat.items.length > 5 ? '<li class="text-xs text-gray-500">他 ' + (cat.items.length - 5) + '件</li>' : '') +
                      '</ul>';
                  }
                  var rateHtml = cat.rate ? '<p class="text-sm text-blue-600 mt-2">補助率: ' + escapeHtml(cat.rate) + '</p>' : '';
                  var maxHtml = cat.max_amount ? '<p class="text-sm text-blue-600">上限: ' + Number(cat.max_amount).toLocaleString() + '円</p>' : '';
                  return '<div class="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow">' +
                    '<div class="font-medium text-gray-800 mb-2">' + catName + '</div>' +
                    catDesc + itemsHtml + rateHtml + maxHtml + '</div>';
                }).join('') +
                '</div></div>';
            }
            
            // 対象外経費
            if (res.data.excluded_expenses && res.data.excluded_expenses.length > 0) {
              html += '<div class="mb-6">' +
                '<h4 class="font-medium text-gray-800 mb-3"><i class="fas fa-ban text-red-500 mr-1"></i>対象外経費</h4>' +
                '<div class="p-4 bg-red-50 border border-red-200 rounded-lg"><ul class="space-y-1">' +
                res.data.excluded_expenses.map(function(exp) {
                  var expName = escapeHtml(typeof exp === 'string' ? exp : (exp.name || ''));
                  return '<li class="text-sm text-red-700"><i class="fas fa-times text-red-500 mr-1"></i>' + expName + '</li>';
                }).join('') +
                '</ul></div></div>';
            }
            
            // 注意事項
            if (res.data.notes) {
              html += '<div class="p-4 bg-yellow-50 rounded-lg">' +
                '<h4 class="font-medium text-yellow-800 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i>注意事項</h4>' +
                '<p class="text-sm text-yellow-700">' + escapeHtml(res.data.notes) + '</p></div>';
            }
            
            document.getElementById('expenses-list').innerHTML = html;
          } else {
            document.getElementById('expenses-list').innerHTML = 
              '<div class="text-center py-8 text-gray-500">' +
              '<i class="fas fa-yen-sign text-4xl mb-3 text-gray-300"></i>' +
              '<p>対象経費情報がまだ登録されていません。</p>' +
              '<p class="text-sm mt-2">公募要領に記載されている対象経費については、壁打ちチャットでも確認できます。</p></div>';
          }
        } catch (e) {
          console.error('Load expenses error:', e);
          document.getElementById('expenses-list').innerHTML = 
            '<p class="text-red-500">対象経費情報の読み込みに失敗しました。</p>';
        }
      }
      
      // 加点項目読み込み
      async function loadBonusPoints() {
        try {
          const res = await api('/api/subsidies/' + subsidyId + '/bonus-points');
          if (res.success && res.data && res.data.length > 0) {
            // 公募要領からの加点項目を表示
            var kouboSection = document.getElementById('bonus-from-koubo');
            var bonusList = document.getElementById('bonus-list');
            var generalSection = document.getElementById('bonus-general');
            
            // 公募要領セクションを表示
            kouboSection.classList.remove('hidden');
            
            // 一般的な加点要素の説明を変更
            var generalTitle = generalSection.querySelector('h4');
            if (generalTitle) {
              generalTitle.innerHTML = '<i class="fas fa-info-circle mr-1"></i>その他の一般的な加点要素（参考）';
            }
            
            var html = res.data.map(function(item, idx) {
              // ポイント表示
              var pointDisplay = '';
              if (item.max_points) {
                pointDisplay = '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+' + item.max_points + '点</span>';
              } else if (item.points) {
                pointDisplay = '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">+' + item.points + '点</span>';
              }
              
              // カテゴリアイコン
              var iconClass = 'fa-plus-circle text-blue-500';
              var category = item.category || '';
              if (category.includes('賃上げ')) iconClass = 'fa-chart-line text-green-500';
              else if (category.includes('政策')) iconClass = 'fa-landmark text-blue-500';
              else if (category.includes('重点')) iconClass = 'fa-star text-purple-500';
              else if (category.includes('災害')) iconClass = 'fa-exclamation-triangle text-orange-500';
              else if (category.includes('DX')) iconClass = 'fa-microchip text-indigo-500';
              else if (category.includes('GX')) iconClass = 'fa-leaf text-green-600';
              
              var catHtml = item.category ? '<span class="text-xs text-gray-500 ml-6">' + escapeHtml(item.category) + '</span>' : '';
              var descHtml = item.description ? '<p class="text-sm text-gray-600 mt-2">' + escapeHtml(item.description) + '</p>' : '';
              var reqHtml = item.requirements ? '<div class="mt-2 p-2 bg-gray-50 rounded text-sm"><span class="text-gray-600 font-medium">要件:</span> <span class="text-gray-700">' + escapeHtml(item.requirements) + '</span></div>' : '';
              
              return '<div class="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white">' +
                '<div class="flex items-start justify-between">' +
                '<div class="flex-1">' +
                '<h4 class="font-medium text-gray-800 flex items-center"><i class="fas ' + iconClass + ' mr-2"></i>' +
                escapeHtml(item.name || item.title || '加点項目' + (idx + 1)) + '</h4>' +
                catHtml + descHtml + reqHtml +
                '</div>' + pointDisplay + '</div></div>';
            }).join('');
            
            bonusList.innerHTML = html;
          } else {
            // 加点項目がない場合は公募要領セクションを非表示のまま
            document.getElementById('bonus-from-koubo').classList.add('hidden');
          }
        } catch (e) {
          console.error('Load bonus points error:', e);
          // エラー時は公募要領セクションを非表示のまま
          document.getElementById('bonus-from-koubo').classList.add('hidden');
        }
      }
      
      // 要件取り込みジョブ開始
      async function ingestEligibility() {
        const btn = document.getElementById('btn-ingest');
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取り込み中...';
        
        try {
          const res = await api('/api/jobs/subsidies/' + subsidyId + '/ingest', { method: 'POST' });
          if (res.success) {
            alert('要件の取り込みジョブを開始しました。数分後に再読み込みしてください。');
          } else {
            // AWS APIが未設定の場合の専用メッセージ
            if (res.error?.code === 'NOT_CONFIGURED') {
              alert('現在この機能は準備中です。手動登録の補助金については既に要件情報が設定されています。');
            } else {
              alert('取り込みに失敗しました: ' + (res.error?.message || '不明なエラー'));
            }
          }
        } catch (e) {
          alert('取り込みに失敗しました。しばらく経ってから再度お試しください。');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-download mr-1"></i>要件を読み込む';
        }
      }
      
      // 壁打ち開始
      // ⚠️ URLパラメータをエンコード
      function startChat() {
        if (!companyId) {
          alert('会社を選択してください');
          return;
        }
        window.location.href = '/chat?subsidy_id=' + encodeURIComponent(subsidyId) + '&company_id=' + encodeURIComponent(companyId);
      }
      
      // 初期化
      loadDetail();
    </script>
  `;
  
  return c.html(subsidyLayout('補助金詳細', content, '/subsidies'));
});

export default subsidyPages;

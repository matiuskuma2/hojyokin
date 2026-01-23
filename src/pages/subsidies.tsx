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
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <input type="text" id="keyword" placeholder="例: IT導入、省エネ、人材育成" 
                 class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
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
              <option value="50" selected>50件</option>
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
        requiredChecklist += '<span>従業員数（数値 &gt; 0）</span></div>';
        
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
        var limitEl = document.getElementById('limit');
        var limitValue = limitEl ? limitEl.value : '50';
        // 'all' または無効な値の場合は500（バックエンド最大値）を使用
        var limit = (limitValue === 'all' || isNaN(parseInt(limitValue))) ? 500 : Math.min(parseInt(limitValue), 500);
        // limit が 0 以下の場合は 50 をデフォルトとして使用
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
          const res = await api('/api/subsidies/search?' + params);
          
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
        statusCounts = { PROCEED: 0, CAUTION: 0, NO: 0 };
        results.forEach(r => {
          if (r && r.evaluation) {
            const status = r.evaluation.status;
            if (status === 'PROCEED') statusCounts.PROCEED++;
            else if (status === 'CAUTION') statusCounts.CAUTION++;
            else statusCounts.NO++;
          }
        });
        
        const statusFilter = document.getElementById('status-filter').value;
        
        // ===== パフォーマンス最適化: フィルタ結果をキャッシュ =====
        if (statusFilter) {
          filteredResults = results.filter(r => r && r.evaluation && r.evaluation.status === statusFilter);
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
        document.getElementById('result-count').textContent = meta?.total || filteredResults.length;
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
                    \${e.status !== 'NO' && e.status !== 'DO_NOT_PROCEED' ? \`
                      <a href="/chat?subsidy_id=\${subsidyId}&company_id=\${companyId}" 
                         class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm text-center tap-target">
                        <i class="fas fa-comments mr-1"></i>壁打ち
                      </a>
                    \` : ''}
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
          pagHtml += \`<span class="text-sm text-gray-600 w-full text-center mb-2 sm:w-auto sm:mb-0">\${filteredResults.length}件中 \${startIdx + 1}-\${Math.min(startIdx + PAGE_SIZE, filteredResults.length)}件</span>\`;
          
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
        renderResults(currentResults, { total: currentResults.length, source: 'cache' });
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
      document.getElementById('status-filter').addEventListener('change', () => {
        displayPage = 1; // ページをリセット
        renderResults(currentResults, null);
      });
      
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
        
        <!-- 基本情報カード -->
        <div class="border-t px-6 py-4 bg-gray-50">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div class="text-xs text-gray-500 mb-1">申請締切</div>
              <div id="info-deadline" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">補助上限額</div>
              <div id="info-max-limit" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">補助率</div>
              <div id="info-rate" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">対象地域</div>
              <div id="info-area" class="font-semibold text-gray-800">-</div>
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
            <button onclick="switchTab('bonus')" data-tab="bonus"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-star mr-1"></i>加点要素
            </button>
            <button onclick="switchTab('documents')" data-tab="documents"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-file-alt mr-1"></i>必要書類
            </button>
            <button onclick="switchTab('evaluation')" data-tab="evaluation"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-chart-bar mr-1"></i>マッチング結果
            </button>
          </nav>
        </div>
        
        <!-- タブコンテンツ -->
        <div class="p-6">
          <!-- 概要タブ -->
          <div id="tab-overview" class="tab-content">
            <div class="prose max-w-none">
              <h3 class="text-lg font-semibold mb-3">補助金の概要</h3>
              <div id="overview-content" class="text-gray-700 whitespace-pre-wrap"></div>
              
              <h3 class="text-lg font-semibold mt-6 mb-3">補助対象事業</h3>
              <div id="target-content" class="text-gray-700 whitespace-pre-wrap"></div>
              
              <h3 class="text-lg font-semibold mt-6 mb-3">添付ファイル</h3>
              <div id="attachments-list" class="space-y-2"></div>
            </div>
          </div>
          
          <!-- 申請要件タブ -->
          <div id="tab-eligibility" class="tab-content hidden">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">申請要件</h3>
              <p class="text-sm text-gray-600">この補助金に申請するための要件です。AUTO: 自動判定可能、MANUAL: 確認が必要</p>
            </div>
            
            <div id="eligibility-list" class="space-y-3">
              <p class="text-gray-500">要件情報を読み込み中...</p>
            </div>
            
            <div class="mt-6 p-4 bg-blue-50 rounded-lg">
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
          
          <!-- Sprint 3: 加点要素タブ -->
          <div id="tab-bonus" class="tab-content hidden">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">
                <i class="fas fa-star text-yellow-500 mr-1"></i>加点要素（参考）
              </h3>
              <p class="text-sm text-gray-600">
                これらの要素を満たすと審査で有利になる可能性があります。補助金によって加点項目は異なります。
              </p>
            </div>
            
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
          
          <!-- 必要書類タブ -->
          <div id="tab-documents" class="tab-content hidden">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">必要書類一覧</h3>
              <p class="text-sm text-gray-600">申請に必要な書類です。<span class="text-green-600">●</span>準備済み <span class="text-yellow-600">●</span>要準備 <span class="text-gray-400">●</span>任意</p>
            </div>
            
            <div id="documents-list" class="space-y-2">
              <p class="text-gray-500">必要書類情報を読み込み中...</p>
            </div>
          </div>
          
          <!-- マッチング結果タブ -->
          <div id="tab-evaluation" class="tab-content hidden">
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
      const companyId = new URLSearchParams(window.location.search).get('company_id');
      let subsidyData = null;
      
      // タブ切り替え
      function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
          if (btn.dataset.tab === tabName) {
            btn.classList.add('border-green-600', 'text-green-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
          } else {
            btn.classList.remove('border-green-600', 'text-green-600');
            btn.classList.add('border-transparent', 'text-gray-500');
          }
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        document.getElementById('tab-' + tabName).classList.remove('hidden');
      }
      
      // 詳細データ読み込み
      async function loadDetail() {
        try {
          const params = companyId ? '?company_id=' + companyId : '';
          const res = await api('/api/subsidies/' + subsidyId + params);
          
          if (!res.success) {
            throw new Error(res.error?.message || '詳細の取得に失敗しました');
          }
          
          subsidyData = res.data;
          renderDetail(res.data);
          
          // 要件・必要書類も取得
          loadEligibility();
          loadDocuments();
          
        } catch (e) {
          console.error('Load detail error:', e);
          document.getElementById('loading-detail').innerHTML = 
            '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>' + e.message + '</div>';
        }
      }
      
      // 詳細描画
      // ⚠️ XSS対策: API応答は必ずescapeHtml()でエスケープすること
      function renderDetail(data) {
        // ⚠️ null/undefined チェック
        if (!data || !data.subsidy) {
          console.error('[補助金詳細] Invalid data:', data);
          document.getElementById('loading-detail').innerHTML = 
            '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>データ形式が不正です。</div>';
          return;
        }
        
        const s = data.subsidy;
        const e = data.evaluation;
        
        document.getElementById('loading-detail').classList.add('hidden');
        document.getElementById('subsidy-detail').classList.remove('hidden');
        
        // タイトル（textContentを使用するためエスケープ不要）
        document.getElementById('breadcrumb-title').textContent = s.title || s.name || '補助金詳細';
        document.getElementById('subsidy-title').textContent = s.title || s.name || '補助金名未設定';
        // ⚠️ XSS対策: innerHTMLを使用する場合はエスケープ
        document.getElementById('subsidy-org').innerHTML = '<i class="fas fa-building mr-1"></i>' + escapeHtml(s.subsidy_executing_organization || '事務局情報なし');
        
        // ステータスバッジ
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
        
        // 基本情報
        const endDate = s.acceptance_end_datetime ? new Date(s.acceptance_end_datetime) : null;
        const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        document.getElementById('info-deadline').innerHTML = endDate 
          ? endDate.toLocaleDateString('ja-JP') + (daysLeft !== null ? \` <span class="\${daysLeft <= 14 ? 'text-red-600' : 'text-gray-500'}">(あと\${daysLeft}日)</span>\` : '')
          : '情報なし';
        document.getElementById('info-max-limit').textContent = s.subsidy_max_limit 
          ? Number(s.subsidy_max_limit).toLocaleString() + '円' : '情報なし';
        document.getElementById('info-rate').textContent = s.subsidy_rate || '情報なし';
        document.getElementById('info-area').textContent = s.target_area || '全国';
        
        // 概要
        document.getElementById('overview-content').textContent = s.subsidy_summary || s.outline || '概要情報なし';
        document.getElementById('target-content').textContent = s.target || '対象事業情報なし';
        
        // 添付ファイル
        // ⚠️ XSS対策: ファイル名とURLをエスケープ
        const attachments = data.attachments || [];
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
      function checkAndShowDataWarning() {
        const missingItems = [];
        
        // 補助金基本情報のチェック
        if (subsidyData && subsidyData.subsidy) {
          const s = subsidyData.subsidy;
          if (!s.subsidy_rate) missingItems.push('補助率');
          if (!s.subsidy_summary && !s.outline) missingItems.push('補助金の概要');
        }
        
        if (!hasEligibilityData) missingItems.push('申請要件');
        if (!hasDocumentsData) missingItems.push('必要書類');
        
        if (missingItems.length > 0) {
          const warningEl = document.getElementById('data-warning');
          const listEl = document.getElementById('missing-data-list');
          
          listEl.innerHTML = missingItems.map(item => \`<li>\${item}</li>\`).join('');
          warningEl.classList.remove('hidden');
        }
      }
      
      // 要件読み込み
      async function loadEligibility() {
        try {
          const res = await api('/api/subsidies/' + subsidyId + '/eligibility');
          if (res.success && res.data.length > 0) {
            hasEligibilityData = true;
            const html = res.data.map(rule => {
              const typeLabel = rule.check_type === 'AUTO' ? 
                '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">AUTO</span>' :
                '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">MANUAL</span>';
              
              return \`
                <div class="p-3 bg-gray-50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-800">\${rule.category || '一般'}</span>
                    \${typeLabel}
                  </div>
                  <p class="text-sm text-gray-700">\${rule.rule_text}</p>
                  \${rule.source_text ? \`<p class="text-xs text-gray-500 mt-1">出典: \${rule.source_text}</p>\` : ''}
                </div>
              \`;
            }).join('');
            document.getElementById('eligibility-list').innerHTML = html;
          } else {
            hasEligibilityData = false;
            document.getElementById('eligibility-list').innerHTML = 
              '<p class="text-gray-500">要件情報がまだ登録されていません。下の「要件を読み込む」ボタンで取り込みを開始できます。</p>';
          }
        } catch (e) {
          console.error('Load eligibility error:', e);
          hasEligibilityData = false;
        }
        // 両方のデータ読み込みが完了したら警告をチェック
        checkAndShowDataWarning();
      }
      
      // 必要書類読み込み
      async function loadDocuments() {
        try {
          const res = await api('/api/subsidies/' + subsidyId + '/documents');
          if (res.success && res.data.length > 0) {
            hasDocumentsData = true;
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
                    <span class="ml-2 font-medium">\${doc.name || doc.doc_code}</span>
                  </div>
                  <span class="text-xs text-gray-500">\${doc.required_level}</span>
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
        }
        // 両方のデータ読み込みが完了したら警告をチェック
        checkAndShowDataWarning();
      }
      
      // 要件取り込みジョブ開始
      async function ingestEligibility() {
        const btn = document.getElementById('btn-ingest');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取り込み中...';
        
        try {
          const res = await api('/api/jobs/subsidies/' + subsidyId + '/ingest', { method: 'POST' });
          if (res.success) {
            alert('要件の取り込みジョブを開始しました。数分後に再読み込みしてください。');
          } else {
            alert('取り込みに失敗しました: ' + (res.error?.message || '不明なエラー'));
          }
        } catch (e) {
          alert('取り込みに失敗しました');
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

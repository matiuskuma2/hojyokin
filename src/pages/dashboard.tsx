/**
 * ダッシュボード・設定画面
 * /dashboard /settings /company
 * 
 * ⚠️ コード品質チェック済み:
 * - 共通スクリプトは<head>内で先に定義（apiCall, navigateToSubsidies）
 * - ページ固有スクリプトは</body>直前で実行
 * - null/undefined の安全なハンドリング
 * - エラーメッセージは日本語で表示
 * 
 * UI/UX改善（2026-01-22）:
 * - 検索に必要な条件を明確に表示
 * - 必須項目と任意項目の違いを説明
 * - プログレスステップを詳細化
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const pages = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================
// 共通スクリプト（全ページで使用）- headに配置して先に読み込む
// ============================================================
const commonScripts = `
  // グローバル変数の初期化
  window.hasCompanyInfo = false;
  window.searchReady = false;
  
  // API呼び出しヘルパー
  window.apiCall = async function(url, options) {
    options = options || {};
    var token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      throw new Error('認証が必要です');
    }
    
    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };
    
    // オプションのヘッダーをマージ
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
      var res = await fetch(url, fetchOptions);
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
  
  // 補助金検索ナビゲーション（会社情報チェックは/subsidiesページで行う）
  window.navigateToSubsidies = function(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    // 常に /subsidies に遷移し、ページ側で会社情報をチェックさせる
    window.location.href = '/subsidies';
  };
  
  // タブ切り替え（会社情報ページ用）
  window.switchTab = function(tab) {
    var buttons = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('text-blue-600', 'border-blue-600');
      buttons[i].classList.add('text-gray-500', 'border-transparent');
    }
    var activeBtn = document.getElementById('tab-' + tab);
    if (activeBtn) {
      activeBtn.classList.remove('text-gray-500', 'border-transparent');
      activeBtn.classList.add('text-blue-600', 'border-blue-600');
    }
    
    var contents = document.querySelectorAll('[id^="content-"]');
    for (var j = 0; j < contents.length; j++) {
      contents[j].classList.add('hidden');
    }
    var activeContent = document.getElementById('content-' + tab);
    if (activeContent) {
      activeContent.classList.remove('hidden');
    }
  };
`;

// ============================================================
// 共通レイアウト（ログイン後）
// ============================================================

const AppLayout = ({ children, title, activeNav }: { children: any; title: string; activeNav?: string }) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - ホジョラク</title>
      <link rel="icon" type="image/png" href="/favicon.png" />
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      {/* 共通スクリプトを最初に定義 */}
      <script dangerouslySetInnerHTML={{ __html: commonScripts }} />
    </head>
    <body class="bg-gray-50 min-h-screen">
      {/* ナビゲーション */}
      <nav class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <a href="/dashboard" class="flex items-center">
                <img src="/static/images/icon.png" alt="ホジョラク" class="h-8 mr-2" />
                <span class="text-xl font-bold text-blue-700">ホジョラク</span>
              </a>
              <div class="hidden md:flex ml-10 space-x-4">
                <a href="/dashboard" class={`px-3 py-2 rounded-md text-sm font-medium ${activeNav === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <i class="fas fa-home mr-1"></i> ダッシュボード
                </a>
                <a href="/subsidies" class={`px-3 py-2 rounded-md text-sm font-medium ${activeNav === 'subsidies' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <i class="fas fa-search mr-1"></i> 補助金を探す
                </a>
                <a href="/company" class={`px-3 py-2 rounded-md text-sm font-medium ${activeNav === 'company' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <i class="fas fa-building mr-1"></i> 会社情報
                </a>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <span id="user-role" class="hidden px-2 py-1 text-xs font-medium rounded-full"></span>
              <span id="user-name" class="text-sm text-gray-600"></span>
              <a id="admin-link" href="/admin" class="hidden text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                <i class="fas fa-shield-halved mr-1"></i>管理画面
              </a>
              <a href="/settings" class="text-gray-500 hover:text-gray-700 transition" title="設定">
                <i class="fas fa-cog"></i>
              </a>
              <button id="logout-btn" class="text-gray-500 hover:text-red-600 transition" title="ログアウト">
                <i class="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* メインコンテンツ */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      {/* 認証チェックとヘッダー初期化 */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          // 認証チェック
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
          
          // ユーザー名表示
          var userNameEl = document.getElementById('user-name');
          if (userNameEl) {
            userNameEl.textContent = user.name || user.email || '';
          }
          
          // ロール表示
          var roleEl = document.getElementById('user-role');
          var adminLink = document.getElementById('admin-link');
          
          if (user.role === 'super_admin') {
            if (roleEl) {
              roleEl.textContent = 'Super Admin';
              roleEl.className = 'px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800';
            }
            if (adminLink) {
              adminLink.classList.remove('hidden');
            }
          } else if (user.role === 'admin') {
            if (roleEl) {
              roleEl.textContent = 'Admin';
              roleEl.className = 'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800';
            }
            if (adminLink) {
              adminLink.classList.remove('hidden');
            }
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
          
          // ログアウトボタン
          var logoutBtn = document.getElementById('logout-btn');
          if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            });
          }
        })();
      `}} />
    </body>
  </html>
);

// ============================================================
// ダッシュボード（ステップガイド形式）- UI/UX改善版
// ============================================================

pages.get('/dashboard', (c) => {
  return c.html(
    <AppLayout title="ダッシュボード" activeNav="dashboard">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <p class="text-gray-600 mt-1">補助金申請までのステップを確認できます</p>
      </div>
      
      {/* 会社情報登録状況カード - 4項目完了時にチェックボックス化 */}
      <div id="info-box" class="mb-6 rounded-xl p-5 hidden transition-all">
        <div class="flex items-start gap-4">
          <div id="info-box-icon" class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <i class="fas fa-building text-blue-600 text-xl"></i>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h3 id="info-box-title" class="font-semibold text-blue-800">補助金検索に必要な情報</h3>
              <span id="info-box-badge" class="hidden px-2 py-0.5 text-xs rounded-full"></span>
            </div>
            <p id="info-box-desc" class="text-sm text-blue-700 mb-3">
              補助金を検索するには、以下の<strong>4つの情報</strong>が必要です。
            </p>
            {/* 4項目チェックボックス */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div id="req-name" class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 transition-all cursor-pointer hover:shadow-sm" onclick="window.location.href='/company'">
                <div class="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center">
                  <i class="fas fa-check text-white text-xs hidden"></i>
                </div>
                <span class="text-sm text-gray-700">会社名</span>
              </div>
              <div id="req-pref" class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 transition-all cursor-pointer hover:shadow-sm" onclick="window.location.href='/company'">
                <div class="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center">
                  <i class="fas fa-check text-white text-xs hidden"></i>
                </div>
                <span class="text-sm text-gray-700">都道府県</span>
              </div>
              <div id="req-industry" class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 transition-all cursor-pointer hover:shadow-sm" onclick="window.location.href='/company'">
                <div class="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center">
                  <i class="fas fa-check text-white text-xs hidden"></i>
                </div>
                <span class="text-sm text-gray-700">業種</span>
              </div>
              <div id="req-employees" class="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 transition-all cursor-pointer hover:shadow-sm" onclick="window.location.href='/company'">
                <div class="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center">
                  <i class="fas fa-check text-white text-xs hidden"></i>
                </div>
                <span class="text-sm text-gray-700">従業員数</span>
              </div>
            </div>
            <p id="info-box-hint" class="text-xs text-blue-600 mt-3">
              <i class="fas fa-lightbulb mr-1"></i>
              追加で資本金や設立年月を入力すると、より精度の高いマッチングが可能になります
            </p>
          </div>
        </div>
      </div>
      
      {/* ステップガイド */}
      <div id="step-guide" class="mb-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* ステップ1: 会社情報登録 */}
          <div id="step1" class="p-6 border-b border-gray-200">
            <div class="flex items-start gap-4">
              <div id="step1-icon" class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span class="text-gray-500 font-bold">1</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-semibold text-gray-800">会社情報を登録する</h3>
                  <span id="step1-badge" class="hidden px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">完了</span>
                  <span id="step1-badge-partial" class="hidden px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">入力中</span>
                </div>
                <p id="step1-desc" class="text-sm text-gray-500 mt-1">
                  補助金の検索に必要な会社情報を入力してください
                </p>
                
                {/* 必須項目の状態表示 */}
                <div id="step1-required" class="mt-3 hidden">
                  <p class="text-xs text-gray-500 mb-2">必須項目（検索に必要）:</p>
                  <div class="flex flex-wrap gap-2" id="required-fields">
                    {/* JSで動的に生成 */}
                  </div>
                </div>
                
                <div id="step1-progress" class="mt-3 hidden">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-sm text-gray-600">入力完成度:</span>
                    <span id="step1-percent" class="text-sm font-medium text-blue-600">0%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="step1-bar" class="bg-blue-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                  </div>
                </div>
                <a id="step1-action" href="/company" class="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                  <i class="fas fa-edit"></i>
                  会社情報を入力する
                </a>
              </div>
            </div>
          </div>
          
          {/* ステップ2: 補助金を検索 */}
          <div id="step2" class="p-6 border-b border-gray-200 opacity-50">
            <div class="flex items-start gap-4">
              <div id="step2-icon" class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span class="text-gray-500 font-bold">2</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-800">補助金を検索する</h3>
                  <span id="step2-badge" class="hidden px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">完了</span>
                </div>
                <p class="text-sm text-gray-500 mt-1">
                  会社情報をもとに、あなたに合った補助金を探します
                </p>
                <p id="step2-hint" class="text-xs text-orange-600 mt-2 hidden">
                  <i class="fas fa-exclamation-circle mr-1"></i>
                  必須4項目を入力すると検索できるようになります
                </p>
                <a id="step2-action" href="#" onclick="window.navigateToSubsidies(event); return false;" class="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm">
                  <i class="fas fa-search"></i>
                  補助金を探す
                </a>
              </div>
            </div>
          </div>
          
          {/* ステップ3: 壁打ちチャット */}
          <div id="step3" class="p-6 border-b border-gray-200 opacity-50">
            <div class="flex items-start gap-4">
              <div id="step3-icon" class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span class="text-gray-500 font-bold">3</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-800">壁打ちチャットで準備</h3>
                </div>
                <p class="text-sm text-gray-500 mt-1">
                  申請に必要な情報をチャット形式で整理します
                </p>
              </div>
            </div>
          </div>
          
          {/* ステップ4: 申請書ドラフト */}
          <div id="step4" class="p-6 opacity-50">
            <div class="flex items-start gap-4">
              <div id="step4-icon" class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span class="text-gray-500 font-bold">4</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-800">申請書ドラフトを作成</h3>
                </div>
                <p class="text-sm text-gray-500 mt-1">
                  壁打ちの内容をもとに申請書のドラフトを生成します
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 進捗状況サマリー */}
      <div class="grid md:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">マッチング候補</p>
              <p class="text-3xl font-bold text-gray-800 mt-1" id="match-count">-</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i class="fas fa-search text-blue-600 text-xl"></i>
            </div>
          </div>
          <a id="match-link" href="#" onclick="window.navigateToSubsidies(event); return false;" class="text-sm text-blue-600 hover:underline mt-2 inline-block hidden">
            候補を見る →
          </a>
        </div>
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">壁打ち進行中</p>
              <p class="text-3xl font-bold text-gray-800 mt-1" id="chat-count">-</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <i class="fas fa-comments text-purple-600 text-xl"></i>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">作成済みドラフト</p>
              <p class="text-3xl font-bold text-gray-800 mt-1" id="draft-count">-</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i class="fas fa-file-alt text-green-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        // ダッシュボードデータ読み込み
        (function() {
          async function loadDashboard() {
            try {
              // 会社情報チェック
              var companies = await window.apiCall('/api/companies');
              console.log('[Dashboard] Companies API response:', companies);
              var hasCompany = companies && companies.success && companies.data && companies.data.length > 0;
              
              // グローバルフラグを設定
              window.hasCompanyInfo = hasCompany;
              
              // 情報ボックスを表示
              var infoBox = document.getElementById('info-box');
              if (infoBox) infoBox.classList.remove('hidden');
              
              if (hasCompany) {
                var company = companies.data[0];
                console.log('[Dashboard] Company data:', company);
                
                // 必須項目の状態をチェック（nullとundefinedを厳密にチェック）
                var reqName = !!(company.name && company.name.trim());
                var reqPref = !!(company.prefecture && company.prefecture.trim());
                var reqIndustry = !!((company.industry_major && company.industry_major.trim()) || (company.industry && company.industry.trim()));
                var reqEmployees = company.employee_count !== null && company.employee_count !== undefined && Number(company.employee_count) > 0;
                
                console.log('[Dashboard] Required fields check:', { reqName, reqPref, reqIndustry, reqEmployees, employee_count: company.employee_count, industry_major: company.industry_major });
                
                // 検索準備完了かどうか
                window.searchReady = reqName && reqPref && reqIndustry && reqEmployees;
                
                // 必須項目の表示を更新（チェックボックス化）
                updateRequiredField('req-name', reqName);
                updateRequiredField('req-pref', reqPref);
                updateRequiredField('req-industry', reqIndustry);
                updateRequiredField('req-employees', reqEmployees);
                
                // 入力済みの数をカウント
                var filledCount = [reqName, reqPref, reqIndustry, reqEmployees].filter(Boolean).length;
                updateInfoBox(window.searchReady, filledCount);
                
                // インラインステータスも更新
                updateInlineStatus('inline-name', reqName);
                updateInlineStatus('inline-pref', reqPref);
                updateInlineStatus('inline-industry', reqIndustry);
                updateInlineStatus('inline-employees', reqEmployees);
                
                // インラインステータスを表示
                var inlineContainer = document.getElementById('required-items-inline');
                if (inlineContainer) inlineContainer.classList.remove('hidden');
                
                // 必須ステータスバッジを更新
                var statusBadge = document.getElementById('required-status-badge');
                if (statusBadge) {
                  if (window.searchReady) {
                    statusBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700';
                    statusBadge.textContent = '検索可能';
                    statusBadge.classList.remove('hidden');
                  } else {
                    statusBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700';
                    statusBadge.textContent = 'あと' + (4 - filledCount) + '項目';
                    statusBadge.classList.remove('hidden');
                  }
                }
                
                // 完成度カードの色も変更
                var completenessCard = document.getElementById('completeness-card');
                if (completenessCard && window.searchReady) {
                  completenessCard.className = 'bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-6 mb-6 transition-all';
                }
                
                // ステップ1の状態更新
                var step1Required = document.getElementById('step1-required');
                if (step1Required) step1Required.classList.remove('hidden');
                
                if (window.searchReady) {
                  // 必須項目すべて入力済み
                  var step1Icon = document.getElementById('step1-icon');
                  if (step1Icon) {
                    step1Icon.className = 'w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0';
                    step1Icon.innerHTML = '<i class="fas fa-check text-white"></i>';
                  }
                  
                  var step1Badge = document.getElementById('step1-badge');
                  if (step1Badge) step1Badge.classList.remove('hidden');
                  
                  var step1Action = document.getElementById('step1-action');
                  if (step1Action) {
                    step1Action.innerHTML = '<i class="fas fa-edit"></i> 会社情報を編集する';
                    step1Action.className = 'inline-flex items-center gap-2 mt-3 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm';
                  }
                  
                  // ステップ2を有効化
                  var step2 = document.getElementById('step2');
                  if (step2) step2.classList.remove('opacity-50');
                  
                  var step2Action = document.getElementById('step2-action');
                  if (step2Action) {
                    step2Action.href = '/subsidies';
                    step2Action.onclick = null;
                    step2Action.className = 'inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm';
                  }
                  
                  // マッチングリンク表示
                  var matchCount = document.getElementById('match-count');
                  var matchLink = document.getElementById('match-link');
                  if (matchCount) {
                    matchCount.textContent = '検索してください';
                    matchCount.className = 'text-sm text-gray-500 mt-1';
                  }
                  if (matchLink) {
                    matchLink.classList.remove('hidden');
                    matchLink.href = '/subsidies';
                    matchLink.onclick = null;
                  }
                } else {
                  // 一部入力済み
                  var step1Icon = document.getElementById('step1-icon');
                  if (step1Icon) {
                    step1Icon.className = 'w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0';
                    step1Icon.innerHTML = '<i class="fas fa-edit text-white"></i>';
                  }
                  
                  var step1BadgePartial = document.getElementById('step1-badge-partial');
                  if (step1BadgePartial) step1BadgePartial.classList.remove('hidden');
                  
                  var step1Desc = document.getElementById('step1-desc');
                  if (step1Desc) {
                    var missing = [];
                    if (!reqName) missing.push('会社名');
                    if (!reqPref) missing.push('都道府県');
                    if (!reqIndustry) missing.push('業種');
                    if (!reqEmployees) missing.push('従業員数');
                    step1Desc.innerHTML = '<span class="text-yellow-600"><i class="fas fa-exclamation-circle mr-1"></i>あと ' + missing.length + ' 項目: ' + missing.join('、') + '</span>';
                  }
                  
                  // ステップ2にヒント表示
                  var step2Hint = document.getElementById('step2-hint');
                  if (step2Hint) step2Hint.classList.remove('hidden');
                }
                
                // 完成度チェック
                try {
                  var completeness = await window.apiCall('/api/profile/completeness');
                  if (completeness && completeness.success && completeness.data) {
                    var d = completeness.data;
                    var step1Progress = document.getElementById('step1-progress');
                    var step1Percent = document.getElementById('step1-percent');
                    var step1Bar = document.getElementById('step1-bar');
                    
                    if (step1Progress) step1Progress.classList.remove('hidden');
                    if (step1Percent) step1Percent.textContent = d.percentage + '%';
                    if (step1Bar) {
                      step1Bar.style.width = d.percentage + '%';
                      if (d.percentage >= 80) {
                        step1Bar.classList.remove('bg-blue-600');
                        step1Bar.classList.add('bg-green-500');
                      } else if (d.percentage >= 40) {
                        step1Bar.classList.remove('bg-blue-600');
                        step1Bar.classList.add('bg-yellow-500');
                      }
                    }
                  }
                } catch (e) {
                  console.error('Completeness error:', e);
                }
              } else {
                // 会社情報未登録
                var matchCountEl = document.getElementById('match-count');
                if (matchCountEl) {
                  matchCountEl.textContent = '-';
                }
                
                // ステップ2にヒント表示
                var step2Hint = document.getElementById('step2-hint');
                if (step2Hint) {
                  step2Hint.textContent = '会社情報を登録してください';
                  step2Hint.classList.remove('hidden');
                }
              }
              
              // チャット・ドラフト数
              var chatCount = document.getElementById('chat-count');
              var draftCount = document.getElementById('draft-count');
              if (chatCount) chatCount.textContent = '0';
              if (draftCount) draftCount.textContent = '0';
              
            } catch (err) {
              console.error('Dashboard load error:', err);
            }
          }
          
          function updateRequiredField(id, filled) {
            var el = document.getElementById(id);
            if (!el) return;
            
            var checkbox = el.querySelector('div');
            var checkIcon = el.querySelector('i');
            
            if (checkbox && checkIcon) {
              if (filled) {
                // チェック済み状態 - 緑色のチェックボックス
                checkbox.className = 'w-5 h-5 bg-green-500 border-2 border-green-500 rounded flex items-center justify-center';
                checkIcon.classList.remove('hidden');
                el.className = 'flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-300 transition-all cursor-pointer hover:shadow-sm';
              } else {
                // 未チェック状態 - 空のチェックボックス
                checkbox.className = 'w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center';
                checkIcon.classList.add('hidden');
                el.className = 'flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 transition-all cursor-pointer hover:shadow-sm';
              }
            }
          }
          
          function updateInlineStatus(id, filled) {
            var el = document.getElementById(id);
            if (!el) return;
            var icon = el.querySelector('i');
            if (filled) {
              el.className = 'flex items-center gap-1 text-green-600';
              if (icon) icon.className = 'fas fa-check-circle';
            } else {
              el.className = 'flex items-center gap-1 text-gray-400';
              if (icon) icon.className = 'fas fa-circle';
            }
          }
          
          function updateInfoBox(allFilled, filledCount) {
            var infoBox = document.getElementById('info-box');
            var infoBoxIcon = document.getElementById('info-box-icon');
            var infoBoxTitle = document.getElementById('info-box-title');
            var infoBoxBadge = document.getElementById('info-box-badge');
            var infoBoxDesc = document.getElementById('info-box-desc');
            var infoBoxHint = document.getElementById('info-box-hint');
            
            if (!infoBox) return;
            
            if (allFilled) {
              // 4項目全て完了 - 緑色の成功スタイル
              infoBox.className = 'mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl p-5 transition-all';
              if (infoBoxIcon) {
                infoBoxIcon.className = 'w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0';
                infoBoxIcon.innerHTML = '<i class="fas fa-check text-white text-xl"></i>';
              }
              if (infoBoxTitle) {
                infoBoxTitle.className = 'font-semibold text-green-800';
                infoBoxTitle.textContent = '補助金検索の準備完了！';
              }
              if (infoBoxBadge) {
                infoBoxBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700';
                infoBoxBadge.textContent = '4/4 完了';
                infoBoxBadge.classList.remove('hidden');
              }
              if (infoBoxDesc) {
                infoBoxDesc.className = 'text-sm text-green-700 mb-3';
                infoBoxDesc.innerHTML = '必要な情報がすべて入力されています。<strong>「補助金を探す」</strong>から検索を始められます。';
              }
              if (infoBoxHint) {
                infoBoxHint.className = 'text-xs text-green-600 mt-3';
                infoBoxHint.innerHTML = '<i class="fas fa-arrow-right mr-1"></i><a href="/subsidies" class="underline hover:no-underline">補助金を探す →</a>';
              }
            } else {
              // 未完了 - 青色の情報スタイル
              infoBox.className = 'mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 transition-all';
              if (infoBoxIcon) {
                infoBoxIcon.className = 'w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0';
                infoBoxIcon.innerHTML = '<i class="fas fa-building text-blue-600 text-xl"></i>';
              }
              if (infoBoxTitle) {
                infoBoxTitle.className = 'font-semibold text-blue-800';
                infoBoxTitle.textContent = '補助金検索に必要な情報';
              }
              if (infoBoxBadge) {
                infoBoxBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700';
                infoBoxBadge.textContent = filledCount + '/4 入力済';
                infoBoxBadge.classList.remove('hidden');
              }
              if (infoBoxDesc) {
                infoBoxDesc.className = 'text-sm text-blue-700 mb-3';
                infoBoxDesc.innerHTML = '補助金を検索するには、以下の<strong>4つの情報</strong>が必要です。';
              }
              if (infoBoxHint) {
                infoBoxHint.className = 'text-xs text-blue-600 mt-3';
                infoBoxHint.innerHTML = '<i class="fas fa-lightbulb mr-1"></i>追加で資本金や設立年月を入力すると、より精度の高いマッチングが可能になります';
              }
            }
          }
          
          // DOM読み込み完了後に実行
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadDashboard);
          } else {
            loadDashboard();
          }
        })();
      `}} />
    </AppLayout>
  );
});

// ============================================================
// 設定画面（旧プロフィール）
// ============================================================

pages.get('/settings', (c) => {
  return c.html(
    <AppLayout title="設定" activeNav="settings">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">設定</h1>
        <p class="text-gray-600 mt-1">アカウント設定を管理できます</p>
      </div>
      
      <div class="max-w-2xl">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">アカウント情報</h2>
          
          <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
          <div id="success-message" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
          
          <form id="profile-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                id="email"
                disabled
                class="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
              <p class="text-xs text-gray-500 mt-1">メールアドレスは変更できません</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">お名前</label>
              <input
                type="text"
                name="name"
                id="name"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <i class="fas fa-save mr-1"></i> 保存
            </button>
          </form>
        </div>
        
        {/* パスワード変更 */}
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">パスワード変更</h2>
          
          <div id="pw-error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
          <div id="pw-success-message" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
          
          <form id="password-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
              <input
                type="password"
                name="current_password"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
              <input
                type="password"
                name="new_password"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p class="text-xs text-gray-500 mt-1">8文字以上、大文字・小文字・数字を含めてください</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                name="confirm_password"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            
            <button
              type="submit"
              class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <i class="fas fa-key mr-1"></i> パスワードを変更
            </button>
          </form>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          function initSettings() {
            // プロフィール読み込み
            var userStr = localStorage.getItem('user');
            var user = {};
            try {
              user = userStr ? JSON.parse(userStr) : {};
            } catch (e) {
              user = {};
            }
            
            var emailEl = document.getElementById('email');
            var nameEl = document.getElementById('name');
            if (emailEl) emailEl.value = user.email || '';
            if (nameEl) nameEl.value = user.name || '';
            
            // プロフィール更新
            var profileForm = document.getElementById('profile-form');
            if (profileForm) {
              profileForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                var form = e.target;
                var errorEl = document.getElementById('error-message');
                var successEl = document.getElementById('success-message');
                if (errorEl) errorEl.classList.add('hidden');
                if (successEl) successEl.classList.add('hidden');
                
                try {
                  var res = await window.apiCall('/api/auth/me', {
                    method: 'PUT',
                    body: JSON.stringify({ name: form.name.value })
                  });
                  
                  if (res && res.success) {
                    // localStorageも更新
                    var userStr = localStorage.getItem('user');
                    var currentUser = {};
                    try {
                      currentUser = userStr ? JSON.parse(userStr) : {};
                    } catch (e) {
                      currentUser = {};
                    }
                    currentUser.name = form.name.value;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    
                    var userNameDisplay = document.getElementById('user-name');
                    if (userNameDisplay) userNameDisplay.textContent = currentUser.name;
                    
                    if (successEl) {
                      successEl.textContent = '保存しました';
                      successEl.classList.remove('hidden');
                    }
                  } else {
                    if (errorEl) {
                      errorEl.textContent = (res && res.error && res.error.message) || 'エラーが発生しました';
                      errorEl.classList.remove('hidden');
                    }
                  }
                } catch (err) {
                  if (errorEl) {
                    errorEl.textContent = '通信エラーが発生しました';
                    errorEl.classList.remove('hidden');
                  }
                }
              });
            }
            
            // パスワード変更
            var passwordForm = document.getElementById('password-form');
            if (passwordForm) {
              passwordForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                var form = e.target;
                var errorEl = document.getElementById('pw-error-message');
                var successEl = document.getElementById('pw-success-message');
                if (errorEl) errorEl.classList.add('hidden');
                if (successEl) successEl.classList.add('hidden');
                
                var newPw = form.new_password.value;
                var confirmPw = form.confirm_password.value;
                
                if (newPw !== confirmPw) {
                  if (errorEl) {
                    errorEl.textContent = '新しいパスワードが一致しません';
                    errorEl.classList.remove('hidden');
                  }
                  return;
                }
                
                try {
                  var res = await window.apiCall('/api/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                      currentPassword: form.current_password.value,
                      newPassword: newPw
                    })
                  });
                  
                  if (res && res.success) {
                    if (successEl) {
                      successEl.textContent = 'パスワードを変更しました';
                      successEl.classList.remove('hidden');
                    }
                    form.reset();
                  } else {
                    if (errorEl) {
                      errorEl.textContent = (res && res.error && res.error.message) || 'エラーが発生しました';
                      errorEl.classList.remove('hidden');
                    }
                  }
                } catch (err) {
                  if (errorEl) {
                    errorEl.textContent = '通信エラーが発生しました';
                    errorEl.classList.remove('hidden');
                  }
                }
              });
            }
          }
          
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initSettings);
          } else {
            initSettings();
          }
        })();
      `}} />
    </AppLayout>
  );
});

// 旧URLからリダイレクト
pages.get('/profile', (c) => {
  return c.redirect('/settings');
});

// ============================================================
// 会社情報画面 - UI/UX改善版
// ============================================================

pages.get('/company', (c) => {
  return c.html(
    <AppLayout title="会社情報" activeNav="company">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">会社情報</h1>
        <p class="text-gray-600 mt-1">補助金検索に使用する会社情報を登録・編集できます</p>
      </div>
      
      {/* 検索条件の説明ボックス */}
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <i class="fas fa-lightbulb text-white"></i>
          </div>
          <div>
            <h3 class="font-semibold text-blue-800 mb-2">入力のポイント</h3>
            <div class="text-sm text-blue-700 space-y-2">
              <p>
                <span class="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs mr-2">
                  <i class="fas fa-asterisk text-red-500 mr-1"></i>必須
                </span>
                の4項目を入力すると、補助金検索が利用できます。
              </p>
              <p>
                <span class="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                  <i class="fas fa-star text-blue-500 mr-1"></i>推奨
                </span>
                の項目も入力すると、より精度の高いマッチングが可能です。
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* プロフィール完成度 + 4項目ステータス */}
      <div id="completeness-card" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 transition-all">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div id="completeness-icon" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-gray-400"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-500">プロフィール完成度</span>
                <span id="required-status-badge" class="hidden px-2 py-0.5 text-xs rounded-full"></span>
              </div>
              <div id="next-action" class="text-sm text-gray-600 mt-1"></div>
            </div>
          </div>
          <div class="text-right">
            <span id="completeness-percent" class="text-2xl font-bold text-gray-400">--%</span>
            <div id="search-status" class="text-xs mt-1"></div>
          </div>
        </div>
        <div class="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div id="completeness-bar" class="bg-blue-600 h-2 rounded-full transition-all" style="width: 0%"></div>
        </div>
        {/* 必須4項目のインラインステータス */}
        <div id="required-items-inline" class="mt-4 pt-4 border-t border-gray-100 hidden">
          <div class="flex flex-wrap gap-3 text-xs">
            <span id="inline-name" class="flex items-center gap-1 text-gray-400">
              <i class="fas fa-circle"></i>会社名
            </span>
            <span id="inline-pref" class="flex items-center gap-1 text-gray-400">
              <i class="fas fa-circle"></i>都道府県
            </span>
            <span id="inline-industry" class="flex items-center gap-1 text-gray-400">
              <i class="fas fa-circle"></i>業種
            </span>
            <span id="inline-employees" class="flex items-center gap-1 text-gray-400">
              <i class="fas fa-circle"></i>従業員数
            </span>
          </div>
        </div>
      </div>
      
      {/* タブ切り替え */}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="border-b border-gray-200">
          <nav class="flex -mb-px">
            <button onclick="window.switchTab('basic')" id="tab-basic" class="tab-btn px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
              <i class="fas fa-building mr-1"></i> 基本情報
            </button>
            <button onclick="window.switchTab('detail')" id="tab-detail" class="tab-btn px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
              <i class="fas fa-info-circle mr-1"></i> 詳細プロフィール
            </button>
            <button onclick="window.switchTab('documents')" id="tab-documents" class="tab-btn px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
              <i class="fas fa-file-upload mr-1"></i> 書類アップロード
            </button>
          </nav>
        </div>
        
        {/* 基本情報タブ */}
        <div id="content-basic" class="p-6">
          <div id="basic-error" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
          <div id="basic-success" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
          
          {/* 必須項目セクション */}
          <div class="mb-8">
            <h3 class="text-sm font-semibold text-gray-700 mb-4 flex items-center">
              <span class="inline-flex items-center px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs mr-2">
                <i class="fas fa-asterisk text-red-500 mr-1"></i>必須
              </span>
              検索に必要な情報
            </h3>
            
            <form id="basic-form" class="space-y-6">
              <div class="grid md:grid-cols-2 gap-6">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    会社名 <span class="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" required
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="株式会社○○" />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    都道府県 <span class="text-red-500">*</span>
                  </label>
                  <select name="prefecture" required
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">選択してください</option>
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
                  <p class="text-xs text-gray-500 mt-1">地方補助金の検索に使用します</p>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    業種（大分類） <span class="text-red-500">*</span>
                  </label>
                  <select name="industry" required
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">選択してください</option>
                    <option value="製造業">製造業</option>
                    <option value="建設業">建設業</option>
                    <option value="情報通信業">情報通信業</option>
                    <option value="運輸業">運輸業</option>
                    <option value="卸売業">卸売業</option>
                    <option value="小売業">小売業</option>
                    <option value="飲食業">飲食業</option>
                    <option value="宿泊業">宿泊業</option>
                    <option value="医療福祉">医療・福祉</option>
                    <option value="教育">教育・学習支援</option>
                    <option value="サービス業">サービス業</option>
                    <option value="その他">その他</option>
                  </select>
                  <p class="text-xs text-gray-500 mt-1">業種別の補助金検索に使用します</p>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    従業員数 <span class="text-red-500">*</span>
                  </label>
                  <input type="number" name="employee_count" required min="1"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="10" />
                  <p class="text-xs text-gray-500 mt-1">中小企業向け補助金の判定に使用します</p>
                </div>
              </div>
              
              {/* 推奨項目セクション */}
              <div class="mt-8 pt-6 border-t border-gray-200">
                <h3 class="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                  <span class="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                    <i class="fas fa-star text-blue-500 mr-1"></i>推奨
                  </span>
                  マッチング精度を上げる情報（任意）
                </h3>
                
                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                    <input type="text" name="postal_code"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123-4567" />
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">市区町村・番地</label>
                    <input type="text" name="city"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="○○市△△区□□町1-2-3" />
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">資本金（円）</label>
                    <input type="number" name="capital" min="0"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="10000000" />
                    <p class="text-xs text-gray-500 mt-1">中小企業の定義判定に使用</p>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">年商（円）</label>
                    <input type="number" name="annual_revenue" min="0"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="100000000" />
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">設立年月</label>
                    <input type="month" name="founded_date"
                      class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <p class="text-xs text-gray-500 mt-1">創業○年以内等の条件判定に使用</p>
                  </div>
                </div>
              </div>
              
              <button type="submit" id="basic-submit-btn"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition">
                <i class="fas fa-save mr-2"></i>保存する
              </button>
            </form>
          </div>
        </div>
        
        {/* 詳細プロフィールタブ */}
        <div id="content-detail" class="p-6 hidden">
          <p class="text-gray-500 text-center py-8">
            詳細プロフィールは基本情報を入力後に設定できます
          </p>
        </div>
        
        {/* 書類アップロードタブ */}
        <div id="content-documents" class="p-6 hidden">
          <div id="upload-area" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-600 mb-2">書類をドラッグ＆ドロップ</p>
            <p class="text-sm text-gray-500 mb-4">または</p>
            <input type="file" id="file-input" class="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple />
            <button type="button" id="file-select-btn" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              ファイルを選択
            </button>
            <p class="text-xs text-gray-500 mt-4">対応形式: PDF, JPG, PNG（最大10MB）</p>
          </div>
          
          <div id="upload-progress" class="hidden mt-4 p-4 bg-blue-50 rounded-lg">
            <div class="flex items-center">
              <i class="fas fa-spinner fa-spin text-blue-600 mr-2"></i>
              <span class="text-blue-700">アップロード中...</span>
            </div>
          </div>
          
          <div id="uploaded-docs" class="mt-6 space-y-3">
            {/* アップロード済み書類リスト */}
          </div>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var currentCompanyId = null;
          
          async function loadCompleteness() {
            try {
              var res = await window.apiCall('/api/profile/completeness');
              if (res && res.success && res.data) {
                var d = res.data;
                var percentEl = document.getElementById('completeness-percent');
                var barEl = document.getElementById('completeness-bar');
                var iconEl = document.getElementById('completeness-icon');
                var nextActionEl = document.getElementById('next-action');
                var searchStatusEl = document.getElementById('search-status');
                
                if (percentEl) {
                  percentEl.textContent = d.percentage + '%';
                  if (d.percentage >= 80) {
                    percentEl.className = 'text-2xl font-bold text-green-600';
                  } else if (d.percentage >= 50) {
                    percentEl.className = 'text-2xl font-bold text-blue-600';
                  } else {
                    percentEl.className = 'text-2xl font-bold text-yellow-600';
                  }
                }
                
                if (barEl) {
                  barEl.style.width = d.percentage + '%';
                  if (d.percentage >= 80) {
                    barEl.className = 'bg-green-500 h-2 rounded-full transition-all';
                  } else if (d.percentage >= 40) {
                    barEl.className = 'bg-yellow-500 h-2 rounded-full transition-all';
                  }
                }
                
                if (iconEl) {
                  if (d.readyForSearch) {
                    iconEl.innerHTML = '<i class="fas fa-check-circle text-green-600"></i>';
                    iconEl.className = 'w-10 h-10 bg-green-100 rounded-full flex items-center justify-center';
                  } else {
                    iconEl.innerHTML = '<i class="fas fa-chart-pie text-blue-600"></i>';
                    iconEl.className = 'w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center';
                  }
                }
                
                if (searchStatusEl) {
                  if (d.readyForSearch) {
                    searchStatusEl.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>検索可能</span>';
                    window.searchReady = true;
                  } else {
                    searchStatusEl.innerHTML = '<span class="text-orange-600"><i class="fas fa-exclamation-circle mr-1"></i>必須項目を入力してください</span>';
                    window.searchReady = false;
                  }
                }
                
                if (nextActionEl) {
                  if (d.nextActions && d.nextActions.length > 0) {
                    nextActionEl.innerHTML = '<span class="text-yellow-600"><i class="fas fa-lightbulb mr-1"></i>' + d.nextActions[0] + '</span>';
                  } else if (d.readyForSearch) {
                    nextActionEl.innerHTML = '<span class="text-green-600"><i class="fas fa-check mr-1"></i>補助金検索の準備完了！</span>';
                  }
                }
              }
            } catch (err) {
              console.error('Completeness error:', err);
            }
          }
          
          async function loadCompanyData() {
            try {
              var res = await window.apiCall('/api/companies');
              if (res && res.success && res.data && res.data.length > 0) {
                var company = res.data[0];
                currentCompanyId = company.id;
                window.hasCompanyInfo = true;
                
                // フォームにデータを設定
                var form = document.getElementById('basic-form');
                if (form) {
                  if (form.name) form.name.value = company.name || '';
                  if (form.postal_code) form.postal_code.value = company.postal_code || '';
                  if (form.prefecture) form.prefecture.value = company.prefecture || '';
                  if (form.city) form.city.value = company.city || '';
                  // DB は industry_major カラムに保存
                  if (form.industry) form.industry.value = company.industry_major || company.industry || '';
                  if (form.employee_count) form.employee_count.value = company.employee_count || '';
                  if (form.capital) form.capital.value = company.capital || '';
                  if (form.annual_revenue) form.annual_revenue.value = company.annual_revenue || '';
                  // DB は established_date カラムに保存
                  if (form.founded_date) form.founded_date.value = company.established_date || company.founded_date || '';
                }
              }
              
              loadCompleteness();
            } catch (err) {
              console.error('Load error:', err);
            }
          }
          
          function initCompanyPage() {
            // データ読み込み
            loadCompanyData();
            
            // フォーム送信
            var basicForm = document.getElementById('basic-form');
            if (basicForm) {
              basicForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                var form = e.target;
                var errorEl = document.getElementById('basic-error');
                var successEl = document.getElementById('basic-success');
                var submitBtn = document.getElementById('basic-submit-btn');
                
                if (errorEl) errorEl.classList.add('hidden');
                if (successEl) successEl.classList.add('hidden');
                
                // ボタンを無効化
                if (submitBtn) {
                  submitBtn.disabled = true;
                  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>保存中...';
                }
                
                var data = {
                  name: form.name.value,
                  postal_code: form.postal_code.value || null,
                  prefecture: form.prefecture.value,
                  city: form.city.value || null,
                  industry_major: form.industry.value,  // API は industry_major を期待
                  employee_count: parseInt(form.employee_count.value) || null,
                  capital: parseInt(form.capital.value) || null,
                  annual_revenue: parseInt(form.annual_revenue.value) || null,
                  established_date: form.founded_date.value || null  // API は established_date を期待
                };
                
                try {
                  var res;
                  if (currentCompanyId) {
                    res = await window.apiCall('/api/companies/' + currentCompanyId, {
                      method: 'PUT',
                      body: JSON.stringify(data)
                    });
                  } else {
                    res = await window.apiCall('/api/companies', {
                      method: 'POST',
                      body: JSON.stringify(data)
                    });
                    if (res && res.success && res.data) {
                      currentCompanyId = res.data.id;
                      window.hasCompanyInfo = true;
                    }
                  }
                  
                  if (res && res.success) {
                    if (successEl) {
                      successEl.textContent = '保存しました！補助金検索の準備ができています。';
                      successEl.classList.remove('hidden');
                    }
                    window.hasCompanyInfo = true;
                    loadCompleteness();
                  } else {
                    if (errorEl) {
                      errorEl.textContent = (res && res.error && res.error.message) || 'エラーが発生しました';
                      errorEl.classList.remove('hidden');
                    }
                  }
                } catch (err) {
                  if (errorEl) {
                    errorEl.textContent = '通信エラーが発生しました';
                    errorEl.classList.remove('hidden');
                  }
                } finally {
                  // ボタンを復元
                  if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>保存する';
                  }
                }
              });
            }
            
            // ファイル選択ボタン
            var fileSelectBtn = document.getElementById('file-select-btn');
            var fileInput = document.getElementById('file-input');
            if (fileSelectBtn && fileInput) {
              fileSelectBtn.addEventListener('click', function() {
                fileInput.click();
              });
              
              fileInput.addEventListener('change', function(e) {
                handleFileUpload(e.target.files);
              });
            }
            
            // ドラッグ＆ドロップ
            var uploadArea = document.getElementById('upload-area');
            if (uploadArea) {
              uploadArea.addEventListener('dragover', function(e) {
                e.preventDefault();
                uploadArea.classList.add('border-blue-500', 'bg-blue-50');
              });
              
              uploadArea.addEventListener('dragleave', function(e) {
                e.preventDefault();
                uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
              });
              
              uploadArea.addEventListener('drop', function(e) {
                e.preventDefault();
                uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
                handleFileUpload(e.dataTransfer.files);
              });
            }
          }
          
          function handleFileUpload(files) {
            if (!files || files.length === 0) return;
            
            // 現在は会社情報がないとアップロードできない
            if (!currentCompanyId) {
              alert('先に基本情報を保存してください');
              return;
            }
            
            var progressEl = document.getElementById('upload-progress');
            if (progressEl) progressEl.classList.remove('hidden');
            
            // TODO: 実際のファイルアップロードAPI実装
            // 現在はモック
            setTimeout(function() {
              if (progressEl) progressEl.classList.add('hidden');
              alert('ファイルアップロード機能は準備中です。\\n基本情報の入力から始めてください。');
            }, 1000);
          }
          
          // DOM読み込み完了後に実行
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCompanyPage);
          } else {
            initCompanyPage();
          }
        })();
      `}} />
    </AppLayout>
  );
});

export default pages;

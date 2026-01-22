/**
 * ダッシュボード・設定画面
 * /dashboard /settings /company
 * 
 * ⚠️ コード品質チェック済み:
 * - 共通スクリプトは<head>内で先に定義（apiCall, navigateToSubsidies）
 * - ページ固有スクリプトは</body>直前で実行
 * - null/undefined の安全なハンドリング
 * - エラーメッセージは日本語で表示
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
  
  // 補助金検索ナビゲーション（会社情報必須）
  window.navigateToSubsidies = function(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (window.hasCompanyInfo) {
      window.location.href = '/subsidies';
    } else {
      alert('補助金検索には会社情報の登録が必要です。\\n先に会社情報を入力してください。');
      window.location.href = '/company';
    }
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
                <a href="/company" class={`px-3 py-2 rounded-md text-sm font-medium ${activeNav === 'company' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <i class="fas fa-building mr-1"></i> 会社情報
                </a>
                <a href="#" id="nav-subsidies" onclick="window.navigateToSubsidies(event); return false;" class={`px-3 py-2 rounded-md text-sm font-medium ${activeNav === 'subsidies' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <i class="fas fa-search mr-1"></i> 補助金を探す
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
// ダッシュボード（ステップガイド形式）
// ============================================================

pages.get('/dashboard', (c) => {
  return c.html(
    <AppLayout title="ダッシュボード" activeNav="dashboard">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <p class="text-gray-600 mt-1">補助金申請までのステップを確認できます</p>
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
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-800">会社情報を登録する</h3>
                  <span id="step1-badge" class="hidden px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">完了</span>
                </div>
                <p id="step1-desc" class="text-sm text-gray-500 mt-1">
                  補助金の検索に必要な会社情報を入力してください
                </p>
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
              var hasCompany = companies && companies.success && companies.data && companies.data.length > 0;
              
              // グローバルフラグを設定
              window.hasCompanyInfo = hasCompany;
              
              if (hasCompany) {
                // ステップ1を完了状態に
                var step1Icon = document.getElementById('step1-icon');
                if (step1Icon) {
                  step1Icon.className = 'w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0';
                  step1Icon.innerHTML = '<i class="fas fa-check text-white"></i>';
                }
                
                var step1Badge = document.getElementById('step1-badge');
                if (step1Badge) {
                  step1Badge.classList.remove('hidden');
                }
                
                var step1Action = document.getElementById('step1-action');
                if (step1Action) {
                  step1Action.innerHTML = '<i class="fas fa-edit"></i> 会社情報を編集する';
                  step1Action.className = 'inline-flex items-center gap-2 mt-3 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm';
                }
                
                // ステップ2を有効化
                var step2 = document.getElementById('step2');
                if (step2) {
                  step2.classList.remove('opacity-50');
                }
                
                var step2Action = document.getElementById('step2-action');
                if (step2Action) {
                  step2Action.href = '/subsidies';
                  step2Action.onclick = null;
                  step2Action.className = 'inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm';
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
                      }
                    }
                  }
                } catch (e) {
                  console.error('Completeness error:', e);
                }
                
                // 統計
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
                // 会社情報未登録
                var matchCountEl = document.getElementById('match-count');
                if (matchCountEl) {
                  matchCountEl.textContent = '-';
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
// 会社情報画面
// ============================================================

pages.get('/company', (c) => {
  return c.html(
    <AppLayout title="会社情報" activeNav="company">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">会社情報</h1>
        <p class="text-gray-600 mt-1">補助金検索に使用する会社情報を登録・編集できます</p>
      </div>
      
      {/* プロフィール完成度 */}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div id="completeness-icon" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-gray-400"></i>
            </div>
            <div>
              <span class="text-sm text-gray-500">プロフィール完成度</span>
              <div id="next-action" class="text-sm text-gray-600 mt-1"></div>
            </div>
          </div>
          <div class="text-right">
            <span id="completeness-percent" class="text-2xl font-bold text-gray-400">--%</span>
          </div>
        </div>
        <div class="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div id="completeness-bar" class="bg-blue-600 h-2 rounded-full transition-all" style="width: 0%"></div>
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
                <label class="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                <input type="text" name="postal_code"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123-4567" />
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
              </div>
              
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">市区町村・番地</label>
                <input type="text" name="city"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="○○市△△区□□町1-2-3" />
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
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  従業員数 <span class="text-red-500">*</span>
                </label>
                <input type="number" name="employee_count" required min="1"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="10" />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">資本金（円）</label>
                <input type="number" name="capital" min="0"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="10000000" />
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
              </div>
            </div>
            
            <button type="submit" id="basic-submit-btn"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition">
              <i class="fas fa-save mr-2"></i>保存する
            </button>
          </form>
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
                }
                
                if (iconEl) {
                  if (d.percentage >= 80) {
                    iconEl.innerHTML = '<i class="fas fa-check-circle text-green-600"></i>';
                    iconEl.className = 'w-10 h-10 bg-green-100 rounded-full flex items-center justify-center';
                  } else {
                    iconEl.innerHTML = '<i class="fas fa-chart-pie text-blue-600"></i>';
                    iconEl.className = 'w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center';
                  }
                }
                
                if (nextActionEl) {
                  if (d.nextActions && d.nextActions.length > 0) {
                    nextActionEl.innerHTML = '<span class="text-yellow-600"><i class="fas fa-lightbulb mr-1"></i>' + d.nextActions[0] + '</span>';
                  } else if (d.percentage >= 80) {
                    nextActionEl.innerHTML = '<span class="text-green-600"><i class="fas fa-check mr-1"></i>補助金検索の準備完了</span>';
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
                      successEl.textContent = '保存しました';
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

/**
 * ダッシュボード・プロフィール画面
 * /dashboard /profile /company
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const pages = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================
// 共通レイアウト（ログイン後）
// ============================================================

const AppLayout = ({ children, title, activeNav }: { children: any; title: string; activeNav?: string }) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - 補助金マッチング</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
      {/* PDF.js for client-side PDF text extraction */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    </head>
    <body class="bg-gray-50 min-h-screen">
      {/* ナビゲーション */}
      <nav class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <a href="/dashboard" class="flex items-center gap-2 text-xl font-bold text-gray-800">
                <i class="fas fa-coins text-yellow-500"></i>
                補助金マッチング
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
                <a href="/profile" class={`px-3 py-2 rounded-md text-sm font-medium ${activeNav === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <i class="fas fa-user mr-1"></i> プロフィール
                </a>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <span id="user-name" class="text-sm text-gray-600"></span>
              <button id="logout-btn" class="text-gray-500 hover:text-red-600 transition">
                <i class="fas fa-sign-out-alt"></i> ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* メインコンテンツ */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      {/* 共通スクリプト */}
      <script dangerouslySetInnerHTML={{ __html: `
        // 認証チェック
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!token || !user) {
          window.location.href = '/login';
        } else {
          document.getElementById('user-name').textContent = user.name || user.email;
        }
        
        // ログアウト
        document.getElementById('logout-btn').addEventListener('click', function() {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        });
        
        // API呼び出しヘルパー
        window.apiCall = async function(url, options = {}) {
          const token = localStorage.getItem('token');
          const res = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              ...(options.headers || {})
            }
          });
          return res.json();
        };
      `}} />
    </body>
  </html>
);

// ============================================================
// ダッシュボード
// ============================================================

pages.get('/dashboard', (c) => {
  return c.html(
    <AppLayout title="ダッシュボード" activeNav="dashboard">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <p class="text-gray-600 mt-1">補助金マッチングの状況を確認できます</p>
      </div>
      
      {/* アラート：会社情報未登録 */}
      <div id="company-alert" class="hidden mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
        <div class="flex items-start">
          <i class="fas fa-exclamation-triangle text-yellow-400 mt-0.5 mr-3"></i>
          <div>
            <h3 class="text-yellow-800 font-medium">会社情報が未登録です</h3>
            <p class="text-yellow-700 text-sm mt-1">
              補助金マッチングを利用するには、まず会社情報を登録してください。
            </p>
            <a href="/company" class="inline-block mt-2 text-yellow-800 font-medium hover:underline">
              会社情報を登録する →
            </a>
          </div>
        </div>
      </div>
      
      {/* プロフィール完成度カード */}
      <div id="completeness-card" class="hidden mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div id="completeness-icon" class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i class="fas fa-chart-pie text-blue-600 text-xl"></i>
            </div>
            <div>
              <h3 class="font-semibold text-gray-800">プロフィール完成度</h3>
              <p id="completeness-status" class="text-sm text-gray-500">補助金検索の準備中...</p>
            </div>
          </div>
          <div class="text-right">
            <p id="completeness-percent" class="text-3xl font-bold text-blue-600">--%</p>
            <a href="/company" class="text-xs text-blue-500 hover:underline">編集する →</a>
          </div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3 mb-3">
          <div id="completeness-bar" class="bg-blue-600 h-3 rounded-full transition-all duration-500" style="width: 0%"></div>
        </div>
        <div id="completeness-actions" class="text-sm text-gray-600"></div>
      </div>
      
      {/* 統計カード */}
      <div class="grid md:grid-cols-3 gap-6 mb-8">
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
        </div>
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">保存済み補助金</p>
              <p class="text-3xl font-bold text-gray-800 mt-1" id="saved-count">-</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i class="fas fa-bookmark text-green-600 text-xl"></i>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">申請中</p>
              <p class="text-3xl font-bold text-gray-800 mt-1" id="applying-count">-</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <i class="fas fa-file-alt text-purple-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>
      
      {/* クイックアクション */}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">クイックアクション</h2>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="/company" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition">
            <i class="fas fa-building text-blue-500 text-xl"></i>
            <span class="font-medium text-gray-700">会社情報を編集</span>
          </a>
          <a href="/subsidies" id="search-link" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition">
            <i class="fas fa-search text-green-500 text-xl"></i>
            <span class="font-medium text-gray-700">補助金を検索</span>
          </a>
          <a href="/profile" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition">
            <i class="fas fa-user-cog text-purple-500 text-xl"></i>
            <span class="font-medium text-gray-700">プロフィール設定</span>
          </a>
          <a href="#" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-yellow-300 hover:bg-yellow-50 transition">
            <i class="fas fa-question-circle text-yellow-500 text-xl"></i>
            <span class="font-medium text-gray-700">ヘルプ・FAQ</span>
          </a>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        // ダッシュボードデータ読み込み
        (async function() {
          try {
            // 会社情報チェック
            const companies = await apiCall('/api/companies');
            const hasCompany = companies.success && companies.data && companies.data.length > 0;
            
            if (!hasCompany) {
              document.getElementById('company-alert').classList.remove('hidden');
              document.getElementById('search-link').classList.add('opacity-50', 'pointer-events-none');
            } else {
              // 完成度を表示
              document.getElementById('completeness-card').classList.remove('hidden');
              
              try {
                const completeness = await apiCall('/api/profile/completeness');
                if (completeness.success && completeness.data) {
                  const d = completeness.data;
                  document.getElementById('completeness-percent').textContent = d.percentage + '%';
                  document.getElementById('completeness-bar').style.width = d.percentage + '%';
                  
                  // 色分け
                  const bar = document.getElementById('completeness-bar');
                  const icon = document.getElementById('completeness-icon');
                  bar.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-blue-600', 'bg-green-500');
                  icon.classList.remove('bg-red-100', 'bg-yellow-100', 'bg-blue-100', 'bg-green-100');
                  
                  if (d.percentage < 40) {
                    bar.classList.add('bg-red-500');
                    icon.classList.add('bg-red-100');
                    icon.querySelector('i').className = 'fas fa-exclamation-circle text-red-600 text-xl';
                  } else if (d.percentage < 60) {
                    bar.classList.add('bg-yellow-500');
                    icon.classList.add('bg-yellow-100');
                    icon.querySelector('i').className = 'fas fa-chart-pie text-yellow-600 text-xl';
                  } else if (d.percentage < 80) {
                    bar.classList.add('bg-blue-600');
                    icon.classList.add('bg-blue-100');
                    icon.querySelector('i').className = 'fas fa-chart-pie text-blue-600 text-xl';
                  } else {
                    bar.classList.add('bg-green-500');
                    icon.classList.add('bg-green-100');
                    icon.querySelector('i').className = 'fas fa-check-circle text-green-600 text-xl';
                  }
                  
                  // ステータステキスト
                  const statusEl = document.getElementById('completeness-status');
                  if (d.readyForSearch) {
                    statusEl.textContent = '補助金検索の準備完了';
                    statusEl.className = 'text-sm text-green-600 font-medium';
                  } else {
                    statusEl.textContent = '必須情報を入力してください';
                    statusEl.className = 'text-sm text-yellow-600';
                  }
                  
                  // 次のアクション
                  if (d.nextActions && d.nextActions.length > 0) {
                    document.getElementById('completeness-actions').innerHTML = 
                      '<div class="flex items-start gap-2 text-gray-600">' +
                        '<i class="fas fa-lightbulb text-yellow-500 mt-0.5"></i>' +
                        '<span>' + d.nextActions[0] + '</span>' +
                      '</div>';
                  }
                  
                  // 検索リンクの有効/無効
                  if (!d.readyForSearch) {
                    document.getElementById('search-link').classList.add('opacity-50');
                    document.getElementById('search-link').title = '先に必須情報を入力してください';
                  }
                }
              } catch (e) {
                console.error('Completeness load error:', e);
              }
            }
            
            // 統計（仮）
            document.getElementById('match-count').textContent = hasCompany ? '12' : '-';
            document.getElementById('saved-count').textContent = '0';
            document.getElementById('applying-count').textContent = '0';
          } catch (err) {
            console.error('Dashboard load error:', err);
          }
        })();
      `}} />
    </AppLayout>
  );
});

// ============================================================
// プロフィール画面
// ============================================================

pages.get('/profile', (c) => {
  return c.html(
    <AppLayout title="プロフィール" activeNav="profile">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">プロフィール設定</h1>
        <p class="text-gray-600 mt-1">アカウント情報を管理できます</p>
      </div>
      
      <div class="max-w-2xl">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">基本情報</h2>
          
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
        // 初期データ読み込み
        (async function() {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          document.getElementById('email').value = user.email || '';
          document.getElementById('name').value = user.name || '';
        })();
        
        // プロフィール更新（TODO: API実装後に有効化）
        document.getElementById('profile-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const successDiv = document.getElementById('success-message');
          successDiv.textContent = 'プロフィールを更新しました（API実装予定）';
          successDiv.classList.remove('hidden');
        });
        
        // パスワード変更（TODO: API実装後に有効化）
        document.getElementById('password-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const errorDiv = document.getElementById('pw-error-message');
          const successDiv = document.getElementById('pw-success-message');
          
          if (form.new_password.value !== form.confirm_password.value) {
            errorDiv.textContent = 'パスワードが一致しません';
            errorDiv.classList.remove('hidden');
            return;
          }
          
          successDiv.textContent = 'パスワードを変更しました（API実装予定）';
          successDiv.classList.remove('hidden');
          errorDiv.classList.add('hidden');
          form.reset();
        });
      `}} />
    </AppLayout>
  );
});

// ============================================================
// 会社情報画面（検索前提フォーム＋書類アップロード＋詳細プロフィール）
// ============================================================

pages.get('/company', (c) => {
  return c.html(
    <AppLayout title="会社情報" activeNav="company">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-800">会社情報</h1>
        <p class="text-gray-600 mt-1">補助金マッチングに使用する会社情報を登録・編集できます</p>
      </div>
      
      {/* 完成度バー */}
      <div id="completeness-section" class="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">プロフィール完成度</span>
          <span id="completeness-percent" class="text-lg font-bold text-blue-600">--%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div id="completeness-bar" class="bg-blue-600 h-3 rounded-full transition-all duration-500" style="width: 0%"></div>
        </div>
        <div id="next-actions" class="text-xs text-gray-500"></div>
      </div>
      
      {/* タブナビゲーション */}
      <div class="mb-6 border-b border-gray-200">
        <nav class="flex space-x-4" aria-label="Tabs">
          <button data-tab="basic" class="tab-btn active px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
            <i class="fas fa-building mr-1"></i> 基本情報
          </button>
          <button data-tab="detail" class="tab-btn px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
            <i class="fas fa-info-circle mr-1"></i> 詳細プロフィール
          </button>
          <button data-tab="documents" class="tab-btn px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent">
            <i class="fas fa-file-upload mr-1"></i> 書類アップロード
          </button>
        </nav>
      </div>
      
      <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
      <div id="success-message" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
      
      {/* 基本情報タブ */}
      <div id="tab-basic" class="tab-content">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form id="basic-form" class="space-y-6">
            <input type="hidden" name="company_id" id="company-id" />
            
            <div class="grid md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">会社名 <span class="text-red-500">*</span></label>
                <input type="text" name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="株式会社○○" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                <input type="text" name="postal_code" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="123-4567" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">都道府県 <span class="text-red-500">*</span></label>
                <select name="prefecture" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                  <option value="">選択してください</option>
                  <option value="01">北海道</option><option value="02">青森県</option><option value="03">岩手県</option>
                  <option value="04">宮城県</option><option value="05">秋田県</option><option value="06">山形県</option>
                  <option value="07">福島県</option><option value="08">茨城県</option><option value="09">栃木県</option>
                  <option value="10">群馬県</option><option value="11">埼玉県</option><option value="12">千葉県</option>
                  <option value="13">東京都</option><option value="14">神奈川県</option><option value="15">新潟県</option>
                  <option value="16">富山県</option><option value="17">石川県</option><option value="18">福井県</option>
                  <option value="19">山梨県</option><option value="20">長野県</option><option value="21">岐阜県</option>
                  <option value="22">静岡県</option><option value="23">愛知県</option><option value="24">三重県</option>
                  <option value="25">滋賀県</option><option value="26">京都府</option><option value="27">大阪府</option>
                  <option value="28">兵庫県</option><option value="29">奈良県</option><option value="30">和歌山県</option>
                  <option value="31">鳥取県</option><option value="32">島根県</option><option value="33">岡山県</option>
                  <option value="34">広島県</option><option value="35">山口県</option><option value="36">徳島県</option>
                  <option value="37">香川県</option><option value="38">愛媛県</option><option value="39">高知県</option>
                  <option value="40">福岡県</option><option value="41">佐賀県</option><option value="42">長崎県</option>
                  <option value="43">熊本県</option><option value="44">大分県</option><option value="45">宮崎県</option>
                  <option value="46">鹿児島県</option><option value="47">沖縄県</option>
                </select>
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">市区町村・番地</label>
                <input type="text" name="city" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="○○市△△区□□町1-2-3" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">業種（大分類） <span class="text-red-500">*</span></label>
                <select name="industry_major" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                  <option value="">選択してください</option>
                  <option value="A">農業、林業</option>
                  <option value="B">漁業</option>
                  <option value="C">鉱業、採石業、砂利採取業</option>
                  <option value="D">建設業</option>
                  <option value="E">製造業</option>
                  <option value="F">電気・ガス・熱供給・水道業</option>
                  <option value="G">情報通信業</option>
                  <option value="H">運輸業、郵便業</option>
                  <option value="I">卸売業、小売業</option>
                  <option value="J">金融業、保険業</option>
                  <option value="K">不動産業、物品賃貸業</option>
                  <option value="L">学術研究、専門・技術サービス業</option>
                  <option value="M">宿泊業、飲食サービス業</option>
                  <option value="N">生活関連サービス業、娯楽業</option>
                  <option value="O">教育、学習支援業</option>
                  <option value="P">医療、福祉</option>
                  <option value="Q">複合サービス事業</option>
                  <option value="R">サービス業（他に分類されないもの）</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">従業員数 <span class="text-red-500">*</span></label>
                <input type="number" name="employee_count" required min="1" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="10" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">資本金（円）</label>
                <input type="number" name="capital" min="0" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="10000000" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">年商（円）</label>
                <input type="number" name="annual_revenue" min="0" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="100000000" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">設立年月</label>
                <input type="month" name="established_date" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              </div>
            </div>
            
            <div class="flex gap-4 pt-4">
              <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
                <i class="fas fa-save"></i> 保存する
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* 詳細プロフィールタブ */}
      <div id="tab-detail" class="tab-content hidden">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form id="detail-form" class="space-y-6">
            {/* 法人情報 */}
            <div>
              <h3 class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                <i class="fas fa-landmark text-blue-500"></i> 法人情報
              </h3>
              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">法人番号</label>
                  <input type="text" name="corp_number" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="1234567890123" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">法人種別</label>
                  <select name="corp_type" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                    <option value="">選択してください</option>
                    <option value="株式会社">株式会社</option>
                    <option value="合同会社">合同会社</option>
                    <option value="有限会社">有限会社</option>
                    <option value="合資会社">合資会社</option>
                    <option value="合名会社">合名会社</option>
                    <option value="個人事業主">個人事業主</option>
                    <option value="NPO法人">NPO法人</option>
                    <option value="一般社団法人">一般社団法人</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">代表者名</label>
                  <input type="text" name="representative_name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="山田 太郎" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">代表者肩書</label>
                  <input type="text" name="representative_title" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="代表取締役" />
                </div>
              </div>
            </div>
            
            {/* 事業内容 */}
            <div>
              <h3 class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                <i class="fas fa-briefcase text-green-500"></i> 事業内容
              </h3>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">事業概要</label>
                  <textarea name="business_summary" rows={3} class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="どのような事業を行っているか簡潔に記載"></textarea>
                </div>
                <div class="grid md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">主要製品・サービス</label>
                    <input type="text" name="main_products" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="例: ソフトウェア開発、コンサルティング" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">主要顧客層</label>
                    <input type="text" name="main_customers" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="例: 中小企業、一般消費者" />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">強み・競合優位性</label>
                  <textarea name="competitive_advantage" rows={2} class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="他社との差別化ポイント"></textarea>
                </div>
              </div>
            </div>
            
            {/* 財務状況 */}
            <div>
              <h3 class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                <i class="fas fa-chart-line text-purple-500"></i> 財務状況
              </h3>
              <div class="grid md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">決算月</label>
                  <select name="fiscal_year_end" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                    <option value="">選択してください</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">直近決算は黒字ですか？</label>
                  <select name="is_profitable" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                    <option value="">選択してください</option>
                    <option value="1">はい（黒字）</option>
                    <option value="0">いいえ（赤字）</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">借入金がありますか？</label>
                  <select name="has_debt" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                    <option value="">選択してください</option>
                    <option value="1">はい</option>
                    <option value="0">いいえ</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* 従業員構成（加点対象） */}
            <div>
              <h3 class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                <i class="fas fa-users text-orange-500"></i> 従業員構成 <span class="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">加点対象</span>
              </h3>
              <div class="grid md:grid-cols-2 gap-4">
                <div class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input type="checkbox" name="has_young_employees" id="has_young_employees" class="w-5 h-5 text-blue-600 rounded" />
                  <label for="has_young_employees" class="text-sm text-gray-700">35歳以下の若年従業員がいる</label>
                </div>
                <div class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input type="checkbox" name="has_female_executives" id="has_female_executives" class="w-5 h-5 text-blue-600 rounded" />
                  <label for="has_female_executives" class="text-sm text-gray-700">女性役員・管理職がいる</label>
                </div>
                <div class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input type="checkbox" name="has_senior_employees" id="has_senior_employees" class="w-5 h-5 text-blue-600 rounded" />
                  <label for="has_senior_employees" class="text-sm text-gray-700">60歳以上のシニア従業員がいる</label>
                </div>
                <div class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input type="checkbox" name="plans_to_hire" id="plans_to_hire" class="w-5 h-5 text-blue-600 rounded" />
                  <label for="plans_to_hire" class="text-sm text-gray-700">今後1年以内に採用予定がある</label>
                </div>
              </div>
            </div>
            
            {/* 備考 */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">その他メモ</label>
              <textarea name="notes" rows={2} class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="その他、補助金申請に関連する情報"></textarea>
            </div>
            
            <div class="flex gap-4 pt-4">
              <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
                <i class="fas fa-save"></i> 詳細情報を保存
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* 書類アップロードタブ */}
      <div id="tab-documents" class="tab-content hidden">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-800 mb-2 flex items-center gap-2">
              <i class="fas fa-cloud-upload-alt text-blue-500"></i> 書類をアップロード
            </h3>
            <p class="text-sm text-gray-600">決算書や登記簿謄本などをアップロードすると、プロフィール情報を自動で抽出し、より正確なマッチングが可能になります。</p>
          </div>
          
          <form id="upload-form" class="mb-8">
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer" id="drop-zone">
              <i class="fas fa-file-pdf text-gray-400 text-4xl mb-3"></i>
              <p class="text-gray-600 mb-2">ファイルをドラッグ＆ドロップ、またはクリックして選択</p>
              <p class="text-xs text-gray-400">PDF、JPEG、PNG（最大10MB）</p>
              <input type="file" id="file-input" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" />
            </div>
            
            <div class="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">書類の種類</label>
                <select id="doc-type" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                  <option value="corp_registry">登記簿謄本（履歴事項全部証明書）</option>
                  <option value="financials">決算書・財務諸表</option>
                  <option value="tax">納税証明書</option>
                  <option value="business_plan">事業計画書</option>
                  <option value="license">許認可証</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div class="flex items-end">
                <button type="submit" id="upload-btn" disabled class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
                  <i class="fas fa-upload"></i> アップロード
                </button>
              </div>
            </div>
            <p class="mt-2 text-xs text-blue-600">
              <i class="fas fa-info-circle mr-1"></i>
              登記簿・決算書をアップロード後、「情報を抽出」ボタンで自動的に会社情報を抽出できます
            </p>
          </form>
          
          {/* アップロード済み書類一覧 */}
          <div>
            <h4 class="text-md font-medium text-gray-800 mb-4 flex items-center gap-2">
              <i class="fas fa-folder-open text-yellow-500"></i> アップロード済み書類
            </h4>
            <div id="documents-list" class="space-y-3">
              <p class="text-gray-400 text-sm">書類がまだありません</p>
            </div>
          </div>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        // タブ切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => {
              b.classList.remove('active', 'text-blue-600', 'border-blue-600');
              b.classList.add('text-gray-500', 'border-transparent');
            });
            this.classList.add('active', 'text-blue-600', 'border-blue-600');
            this.classList.remove('text-gray-500', 'border-transparent');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('tab-' + tabId).classList.remove('hidden');
          });
        });
        
        // 既存データ読み込み
        let companyId = null;
        (async function() {
          try {
            const res = await apiCall('/api/companies');
            if (res.success && res.data && res.data.length > 0) {
              const company = res.data[0];
              companyId = company.id;
              document.getElementById('company-id').value = company.id || '';
              
              // 基本情報
              const basicForm = document.getElementById('basic-form');
              basicForm.name.value = company.name || '';
              basicForm.postal_code.value = company.postal_code || '';
              basicForm.prefecture.value = company.prefecture || '';
              basicForm.city.value = company.city || '';
              basicForm.industry_major.value = company.industry_major || '';
              basicForm.employee_count.value = company.employee_count || '';
              basicForm.capital.value = company.capital || '';
              basicForm.annual_revenue.value = company.annual_revenue || '';
              basicForm.established_date.value = company.established_date || '';
              
              // 詳細プロフィール取得
              loadProfile();
              loadCompleteness();
              loadDocuments();
            }
          } catch (err) {
            console.error('Load company error:', err);
          }
        })();
        
        async function loadProfile() {
          if (!companyId) return;
          try {
            const res = await apiCall('/api/profile');
            if (res.success && res.data && res.data.profile) {
              const p = res.data.profile;
              const f = document.getElementById('detail-form');
              
              f.corp_number.value = p.corp_number || '';
              f.corp_type.value = p.corp_type || '';
              f.representative_name.value = p.representative_name || '';
              f.representative_title.value = p.representative_title || '';
              f.business_summary.value = p.business_summary || '';
              f.main_products.value = p.main_products || '';
              f.main_customers.value = p.main_customers || '';
              f.competitive_advantage.value = p.competitive_advantage || '';
              f.fiscal_year_end.value = p.fiscal_year_end || '';
              f.is_profitable.value = p.is_profitable !== null ? String(p.is_profitable) : '';
              f.has_debt.value = p.has_debt !== null ? String(p.has_debt) : '';
              f.has_young_employees.checked = !!p.has_young_employees;
              f.has_female_executives.checked = !!p.has_female_executives;
              f.has_senior_employees.checked = !!p.has_senior_employees;
              f.plans_to_hire.checked = !!p.plans_to_hire;
              f.notes.value = p.notes || '';
            }
          } catch (err) {
            console.error('Load profile error:', err);
          }
        }
        
        async function loadCompleteness() {
          try {
            const res = await apiCall('/api/profile/completeness');
            if (res.success && res.data) {
              const d = res.data;
              document.getElementById('completeness-percent').textContent = d.percentage + '%';
              document.getElementById('completeness-bar').style.width = d.percentage + '%';
              
              // 色分け
              const bar = document.getElementById('completeness-bar');
              bar.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-blue-600', 'bg-green-500');
              if (d.percentage < 40) bar.classList.add('bg-red-500');
              else if (d.percentage < 60) bar.classList.add('bg-yellow-500');
              else if (d.percentage < 80) bar.classList.add('bg-blue-600');
              else bar.classList.add('bg-green-500');
              
              // 次のアクション
              if (d.nextActions && d.nextActions.length > 0) {
                document.getElementById('next-actions').innerHTML = d.nextActions.map(a => 
                  '<span class="inline-block mr-2">💡 ' + a + '</span>'
                ).join('');
              }
            }
          } catch (err) {
            console.error('Load completeness error:', err);
          }
        }
        
        async function loadDocuments() {
          try {
            const res = await apiCall('/api/profile/documents');
            if (res.success && res.data) {
              const docs = res.data;
              const list = document.getElementById('documents-list');
              
              if (docs.length === 0) {
                list.innerHTML = '<p class="text-gray-400 text-sm">書類がまだありません</p>';
                return;
              }
              
              list.innerHTML = docs.map(doc => {
                const typeLabels = {
                  corp_registry: '登記簿',
                  financials: '決算書',
                  financial: '決算書',
                  registration: '登記簿',
                  tax: '納税証明',
                  business_plan: '事業計画',
                  license: '許認可',
                  other: 'その他'
                };
                const statusLabels = {
                  uploaded: 'アップロード済',
                  extracting: '抽出中...',
                  extracted: '抽出完了',
                  applied: '反映済み',
                  failed: 'エラー'
                };
                const statusColors = {
                  uploaded: 'bg-yellow-100 text-yellow-800',
                  extracting: 'bg-blue-100 text-blue-800',
                  extracted: 'bg-green-100 text-green-800',
                  applied: 'bg-purple-100 text-purple-800',
                  failed: 'bg-red-100 text-red-800'
                };
                
                // Phase 1 対象書類かどうか
                const isExtractable = ['corp_registry', 'financials'].includes(doc.doc_type);
                
                // アクションボタン生成
                let actionButtons = '';
                if (isExtractable) {
                  if (doc.status === 'uploaded') {
                    actionButtons = '<button onclick="extractDocument(\\'' + doc.id + '\\')" class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">' +
                      '<i class="fas fa-magic mr-1"></i>情報を抽出' +
                    '</button>';
                  } else if (doc.status === 'extracting') {
                    actionButtons = '<span class="text-xs text-blue-600"><i class="fas fa-spinner fa-spin mr-1"></i>処理中...</span>';
                  } else if (doc.status === 'extracted') {
                    actionButtons = '<button onclick="showExtractedData(\\'' + doc.id + '\\')" class="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">' +
                      '<i class="fas fa-check mr-1"></i>結果を確認・反映' +
                    '</button>';
                  } else if (doc.status === 'applied') {
                    actionButtons = '<button onclick="showExtractedData(\\'' + doc.id + '\\')" class="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">' +
                      '<i class="fas fa-eye mr-1"></i>抽出内容を見る' +
                    '</button>';
                  } else if (doc.status === 'failed') {
                    actionButtons = '<button onclick="extractDocument(\\'' + doc.id + '\\')" class="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600">' +
                      '<i class="fas fa-redo mr-1"></i>再抽出' +
                    '</button>';
                  }
                }
                
                // 信頼度表示
                let confidenceHtml = '';
                if (doc.confidence !== null && doc.confidence !== undefined && doc.status !== 'uploaded') {
                  const confColor = doc.confidence >= 80 ? 'text-green-600' : doc.confidence >= 50 ? 'text-yellow-600' : 'text-red-600';
                  confidenceHtml = '<span class="text-xs ' + confColor + ' ml-2">信頼度: ' + doc.confidence + '%</span>';
                }
                
                return '<div class="p-4 bg-gray-50 rounded-lg border border-gray-200">' +
                  '<div class="flex items-center justify-between mb-2">' +
                    '<div class="flex items-center gap-3">' +
                      '<i class="fas fa-file-alt text-gray-400 text-lg"></i>' +
                      '<div>' +
                        '<p class="text-sm font-medium text-gray-700">' + doc.original_filename + '</p>' +
                        '<p class="text-xs text-gray-500">' + (typeLabels[doc.doc_type] || doc.doc_type) + ' • ' + formatBytes(doc.size_bytes) + '</p>' +
                      '</div>' +
                    '</div>' +
                    '<div class="flex items-center gap-2">' +
                      '<span class="text-xs px-2 py-1 rounded ' + (statusColors[doc.status] || 'bg-gray-100') + '">' + (statusLabels[doc.status] || doc.status) + '</span>' +
                      confidenceHtml +
                    '</div>' +
                  '</div>' +
                  '<div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">' +
                    '<div class="flex gap-2">' + actionButtons + '</div>' +
                    '<button onclick="deleteDocument(\\'' + doc.id + '\\')" class="text-red-500 hover:text-red-700 text-sm">' +
                      '<i class="fas fa-trash mr-1"></i>削除' +
                    '</button>' +
                  '</div>' +
                '</div>';
              }).join('');
            }
          } catch (err) {
            console.error('Load documents error:', err);
          }
        }
        
        // PDFからテキストを抽出する関数
        async function extractTextFromPDF(file) {
          return new Promise(async (resolve, reject) => {
            try {
              // PDF.js workerを設定
              pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              
              const arrayBuffer = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              
              let fullText = '';
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map(item => item.str)
                  .join(' ');
                fullText += pageText + '\\n';
              }
              
              resolve(fullText);
            } catch (error) {
              reject(error);
            }
          });
        }
        
        // 書類から情報を抽出（サーバー側解析）
        async function extractDocument(docId) {
          const errorDiv = document.getElementById('error-message');
          const successDiv = document.getElementById('success-message');
          errorDiv.classList.add('hidden');
          successDiv.classList.add('hidden');
          
          // ローディング表示
          const btn = event?.target;
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>解析中...';
          }
          
          try {
            successDiv.textContent = '情報を解析中...';
            successDiv.classList.remove('hidden');
            
            // まずテキストなしで抽出を試みる（サーバーに保存済みのraw_textを使用）
            const res = await apiCall('/api/profile/documents/' + docId + '/extract', {
              method: 'POST',
              body: JSON.stringify({})
            });
            
            if (res.success) {
              successDiv.textContent = res.data.message || '情報を抽出しました';
              loadDocuments();
              
              // 抽出結果を即座に表示
              if (res.data.extracted) {
                setTimeout(() => showExtractedData(docId), 500);
              }
            } else if (res.error?.code === 'NO_TEXT') {
              // サーバーにテキストがない場合、PDFを再選択させる
              successDiv.classList.add('hidden');
              
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.accept = '.pdf';
              fileInput.style.display = 'none';
              document.body.appendChild(fileInput);
              
              fileInput.onchange = async function() {
                const file = fileInput.files[0];
                if (!file) {
                  if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-magic mr-1"></i>情報を抽出';
                  }
                  document.body.removeChild(fileInput);
                  return;
                }
                
                try {
                  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>PDF読取中...';
                  successDiv.textContent = 'PDFからテキストを読み取り中...';
                  successDiv.classList.remove('hidden');
                  
                  const extractedText = await extractTextFromPDF(file);
                  
                  if (!extractedText || extractedText.trim().length < 50) {
                    errorDiv.textContent = 'PDFからテキストを抽出できませんでした。スキャンPDFの場合は、テキスト認識可能なPDFをご用意ください。';
                    errorDiv.classList.remove('hidden');
                    successDiv.classList.add('hidden');
                    return;
                  }
                  
                  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>解析中...';
                  successDiv.textContent = '情報を解析中...';
                  
                  // サーバーに抽出テキストを送信
                  const retryRes = await apiCall('/api/profile/documents/' + docId + '/extract', {
                    method: 'POST',
                    body: JSON.stringify({ text: extractedText })
                  });
                  
                  if (retryRes.success) {
                    successDiv.textContent = retryRes.data.message || '情報を抽出しました';
                    loadDocuments();
                    if (retryRes.data.extracted) {
                      setTimeout(() => showExtractedData(docId), 500);
                    }
                  } else {
                    errorDiv.textContent = retryRes.error?.message || '抽出に失敗しました';
                    errorDiv.classList.remove('hidden');
                    successDiv.classList.add('hidden');
                  }
                } catch (err) {
                  console.error('PDF extraction error:', err);
                  errorDiv.textContent = 'PDFの解析中にエラーが発生しました';
                  errorDiv.classList.remove('hidden');
                  successDiv.classList.add('hidden');
                } finally {
                  if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-magic mr-1"></i>情報を抽出';
                  }
                  document.body.removeChild(fileInput);
                }
              };
              
              alert('PDFファイルを選択してください。\\n（アップロード時にテキスト読取ができなかった場合、再度ファイルを選択する必要があります）');
              fileInput.click();
              return;
            } else {
              errorDiv.textContent = res.error?.message || '抽出に失敗しました';
              errorDiv.classList.remove('hidden');
              successDiv.classList.add('hidden');
            }
          } catch (err) {
            console.error('Extract error:', err);
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
            successDiv.classList.add('hidden');
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<i class="fas fa-magic mr-1"></i>情報を抽出';
            }
          }
        }
        window.extractDocument = extractDocument;
        
        // 抽出結果を表示・反映
        async function showExtractedData(docId) {
          try {
            const res = await apiCall('/api/profile/documents/' + docId + '/extracted');
            if (res.success && res.data) {
              const data = res.data;
              const extracted = data.extracted || {};
              const mapping = data.apply_mapping || {};
              
              // モーダル表示用のHTML生成
              let fieldsHtml = '';
              Object.keys(extracted).forEach(key => {
                if (key === 'source' || key === 'confidence') return;
                const value = extracted[key];
                const map = mapping[key];
                const label = map ? map.label : key;
                const displayValue = Array.isArray(value) ? value.join('、') : String(value);
                
                fieldsHtml += '<div class="flex justify-between py-2 border-b border-gray-100">' +
                  '<span class="text-sm text-gray-600">' + label + '</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (displayValue || '-') + '</span>' +
                '</div>';
              });
              
              const canApply = data.status === 'extracted';
              const applyBtnHtml = canApply 
                ? '<button onclick="applyExtraction(\\'' + docId + '\\')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg mt-4">' +
                    '<i class="fas fa-check-circle mr-2"></i>この情報をプロフィールに反映する' +
                  '</button>' +
                  '<p class="text-xs text-gray-500 mt-2 text-center">※既に入力済みの項目は上書きされません（空欄のみ反映）</p>'
                : '<p class="text-sm text-purple-600 mt-4 text-center"><i class="fas fa-check-circle mr-1"></i>この書類の情報は既に反映済みです</p>';
              
              // モーダル表示
              const modalHtml = '<div id="extraction-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">' +
                '<div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">' +
                  '<div class="p-6">' +
                    '<div class="flex justify-between items-center mb-4">' +
                      '<h3 class="text-lg font-bold text-gray-800"><i class="fas fa-file-alt text-blue-500 mr-2"></i>抽出された情報</h3>' +
                      '<button onclick="closeExtractionModal()" class="text-gray-400 hover:text-gray-600">' +
                        '<i class="fas fa-times text-xl"></i>' +
                      '</button>' +
                    '</div>' +
                    '<div class="mb-4">' +
                      '<p class="text-sm text-gray-600 mb-2">' +
                        '<i class="fas fa-file mr-1"></i>' + data.original_filename +
                        '<span class="ml-2 text-green-600">信頼度: ' + (data.confidence || 0) + '%</span>' +
                      '</p>' +
                    '</div>' +
                    '<div class="bg-gray-50 rounded-lg p-4">' +
                      fieldsHtml +
                    '</div>' +
                    applyBtnHtml +
                  '</div>' +
                '</div>' +
              '</div>';
              
              document.body.insertAdjacentHTML('beforeend', modalHtml);
            } else {
              alert('抽出データの取得に失敗しました');
            }
          } catch (err) {
            alert('通信エラーが発生しました');
          }
        }
        window.showExtractedData = showExtractedData;
        
        function closeExtractionModal() {
          const modal = document.getElementById('extraction-modal');
          if (modal) modal.remove();
        }
        window.closeExtractionModal = closeExtractionModal;
        
        // 抽出結果をプロフィールに反映
        async function applyExtraction(docId) {
          try {
            const res = await apiCall('/api/profile/documents/' + docId + '/apply', {
              method: 'POST',
              body: JSON.stringify({ apply_mode: 'fill_empty' })
            });
            
            if (res.success) {
              closeExtractionModal();
              document.getElementById('success-message').textContent = res.data.message || '情報を反映しました';
              document.getElementById('success-message').classList.remove('hidden');
              
              // リロード
              loadDocuments();
              loadCompleteness();
              loadProfile();
              
              // 基本情報もリロード
              const companyRes = await apiCall('/api/companies');
              if (companyRes.success && companyRes.data && companyRes.data.length > 0) {
                const company = companyRes.data[0];
                const basicForm = document.getElementById('basic-form');
                basicForm.name.value = company.name || '';
                basicForm.postal_code.value = company.postal_code || '';
                basicForm.prefecture.value = company.prefecture || '';
                basicForm.city.value = company.city || '';
                basicForm.industry_major.value = company.industry_major || '';
                basicForm.employee_count.value = company.employee_count || '';
                basicForm.capital.value = company.capital || '';
                basicForm.annual_revenue.value = company.annual_revenue || '';
                basicForm.established_date.value = company.established_date || '';
              }
            } else {
              alert(res.error?.message || '反映に失敗しました');
            }
          } catch (err) {
            alert('通信エラーが発生しました');
          }
        }
        window.applyExtraction = applyExtraction;
        
        function formatBytes(bytes) {
          if (!bytes) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        
        // 従業員帯を計算
        function getEmployeeBand(count) {
          if (count <= 5) return '1-5';
          if (count <= 20) return '6-20';
          if (count <= 50) return '21-50';
          if (count <= 100) return '51-100';
          if (count <= 300) return '101-300';
          return '301+';
        }
        
        // 基本情報フォーム送信
        document.getElementById('basic-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const btn = form.querySelector('button[type="submit"]');
          const errorDiv = document.getElementById('error-message');
          const successDiv = document.getElementById('success-message');
          
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
          errorDiv.classList.add('hidden');
          successDiv.classList.add('hidden');
          
          const employeeCount = parseInt(form.employee_count.value) || 0;
          const data = {
            name: form.name.value,
            postal_code: form.postal_code.value || null,
            prefecture: form.prefecture.value,
            city: form.city.value || null,
            industry_major: form.industry_major.value,
            employee_count: employeeCount,
            employee_band: getEmployeeBand(employeeCount),
            capital: form.capital.value ? parseInt(form.capital.value) : null,
            annual_revenue: form.annual_revenue.value ? parseInt(form.annual_revenue.value) : null,
            established_date: form.established_date.value || null
          };
          
          try {
            const existingId = form.company_id.value;
            let res;
            if (existingId) {
              res = await apiCall('/api/companies/' + existingId, {
                method: 'PUT',
                body: JSON.stringify(data)
              });
            } else {
              res = await apiCall('/api/companies', {
                method: 'POST',
                body: JSON.stringify(data)
              });
            }
            
            if (res.success) {
              successDiv.textContent = '基本情報を保存しました';
              successDiv.classList.remove('hidden');
              if (res.data && res.data.id) {
                form.company_id.value = res.data.id;
                companyId = res.data.id;
              }
              loadCompleteness();
            } else {
              errorDiv.textContent = res.error?.message || '保存に失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> 保存する';
          }
        });
        
        // 詳細プロフィールフォーム送信
        document.getElementById('detail-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const btn = form.querySelector('button[type="submit"]');
          const errorDiv = document.getElementById('error-message');
          const successDiv = document.getElementById('success-message');
          
          if (!companyId) {
            errorDiv.textContent = '先に基本情報を保存してください';
            errorDiv.classList.remove('hidden');
            return;
          }
          
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
          errorDiv.classList.add('hidden');
          successDiv.classList.add('hidden');
          
          const data = {
            corp_number: form.corp_number.value || null,
            corp_type: form.corp_type.value || null,
            representative_name: form.representative_name.value || null,
            representative_title: form.representative_title.value || null,
            business_summary: form.business_summary.value || null,
            main_products: form.main_products.value || null,
            main_customers: form.main_customers.value || null,
            competitive_advantage: form.competitive_advantage.value || null,
            fiscal_year_end: form.fiscal_year_end.value ? parseInt(form.fiscal_year_end.value) : null,
            is_profitable: form.is_profitable.value !== '' ? parseInt(form.is_profitable.value) : null,
            has_debt: form.has_debt.value !== '' ? parseInt(form.has_debt.value) : null,
            has_young_employees: form.has_young_employees.checked ? 1 : 0,
            has_female_executives: form.has_female_executives.checked ? 1 : 0,
            has_senior_employees: form.has_senior_employees.checked ? 1 : 0,
            plans_to_hire: form.plans_to_hire.checked ? 1 : 0,
            notes: form.notes.value || null
          };
          
          try {
            const res = await apiCall('/api/profile', {
              method: 'PUT',
              body: JSON.stringify(data)
            });
            
            if (res.success) {
              successDiv.textContent = '詳細プロフィールを保存しました';
              successDiv.classList.remove('hidden');
              loadCompleteness();
            } else {
              errorDiv.textContent = res.error?.message || '保存に失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> 詳細情報を保存';
          }
        });
        
        // ファイルアップロード
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const uploadBtn = document.getElementById('upload-btn');
        let selectedFile = null;
        
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('border-blue-400', 'bg-blue-50');
        });
        dropZone.addEventListener('dragleave', () => {
          dropZone.classList.remove('border-blue-400', 'bg-blue-50');
        });
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('border-blue-400', 'bg-blue-50');
          if (e.dataTransfer.files.length > 0) {
            selectFile(e.dataTransfer.files[0]);
          }
        });
        
        fileInput.addEventListener('change', () => {
          if (fileInput.files.length > 0) {
            selectFile(fileInput.files[0]);
          }
        });
        
        function selectFile(file) {
          selectedFile = file;
          dropZone.innerHTML = '<i class="fas fa-file text-blue-500 text-4xl mb-3"></i>' +
            '<p class="text-gray-700 font-medium">' + file.name + '</p>' +
            '<p class="text-xs text-gray-400">' + formatBytes(file.size) + '</p>';
          uploadBtn.disabled = false;
        }
        
        document.getElementById('upload-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          if (!selectedFile || !companyId) {
            alert('ファイルを選択してください');
            return;
          }
          
          const errorDiv = document.getElementById('error-message');
          const successDiv = document.getElementById('success-message');
          errorDiv.classList.add('hidden');
          successDiv.classList.add('hidden');
          
          uploadBtn.disabled = true;
          uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> アップロード中...';
          
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('doc_type', document.getElementById('doc-type').value);
          
          // PDFの場合、テキストを事前抽出
          let pdfText = '';
          const docType = document.getElementById('doc-type').value;
          const isPdfExtractable = selectedFile.type === 'application/pdf' && 
                                   ['corp_registry', 'financials'].includes(docType);
          
          if (isPdfExtractable && typeof pdfjsLib !== 'undefined') {
            try {
              uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PDF読取中...';
              pdfText = await extractTextFromPDF(selectedFile);
              console.log('PDF text extracted, length:', pdfText.length);
            } catch (pdfErr) {
              console.warn('PDF text extraction failed:', pdfErr);
              // PDFテキスト抽出に失敗しても、アップロードは続行
            }
          }
          
          try {
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> アップロード中...';
            const token = localStorage.getItem('token');
            const res = await fetch('/api/profile/documents', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token
              },
              body: formData
            });
            const data = await res.json();
            
            if (data.success) {
              const docId = data.data.id;
              
              // PDFテキストが抽出できた場合、サーバーに保存
              if (pdfText && pdfText.length > 50) {
                try {
                  await apiCall('/api/profile/documents/' + docId + '/text', {
                    method: 'POST',
                    body: JSON.stringify({ text: pdfText })
                  });
                  console.log('PDF text saved to server');
                } catch (textErr) {
                  console.warn('Failed to save PDF text:', textErr);
                }
              }
              
              successDiv.textContent = 'ファイルをアップロードしました' + 
                (pdfText.length > 50 ? '（テキスト読取済み）' : '');
              successDiv.classList.remove('hidden');
              
              // リセット
              selectedFile = null;
              fileInput.value = '';
              dropZone.innerHTML = '<i class="fas fa-file-pdf text-gray-400 text-4xl mb-3"></i>' +
                '<p class="text-gray-600 mb-2">ファイルをドラッグ＆ドロップ、またはクリックして選択</p>' +
                '<p class="text-xs text-gray-400">PDF、JPEG、PNG（最大10MB）</p>';
              
              loadDocuments();
              loadCompleteness();
            } else {
              errorDiv.textContent = data.error?.message || 'アップロードに失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> アップロード';
          }
        });
        
        async function deleteDocument(docId) {
          if (!confirm('この書類を削除しますか？')) return;
          
          try {
            const res = await apiCall('/api/profile/documents/' + docId, { method: 'DELETE' });
            if (res.success) {
              loadDocuments();
              loadCompleteness();
            } else {
              alert(res.error?.message || '削除に失敗しました');
            }
          } catch (err) {
            alert('通信エラーが発生しました');
          }
        }
        window.deleteDocument = deleteDocument;
      `}} />
    </AppLayout>
  );
});

export default pages;

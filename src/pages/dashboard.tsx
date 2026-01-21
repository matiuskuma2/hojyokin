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
          <a href="#" class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition">
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
            if (!companies.success || !companies.data || companies.data.length === 0) {
              document.getElementById('company-alert').classList.remove('hidden');
            }
            
            // 統計（仮）
            document.getElementById('match-count').textContent = '12';
            document.getElementById('saved-count').textContent = '3';
            document.getElementById('applying-count').textContent = '1';
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
// 会社情報画面
// ============================================================

pages.get('/company', (c) => {
  return c.html(
    <AppLayout title="会社情報" activeNav="company">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">会社情報</h1>
        <p class="text-gray-600 mt-1">補助金マッチングに使用する会社情報を登録・編集できます</p>
      </div>
      
      <div class="max-w-3xl">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
          <div id="success-message" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
          
          <form id="company-form" class="space-y-6">
            <input type="hidden" name="id" id="company-id" />
            
            {/* 基本情報 */}
            <div>
              <h3 class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">基本情報</h3>
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
              </div>
            </div>
            
            {/* 業種・規模 */}
            <div>
              <h3 class="text-lg font-medium text-gray-800 mb-4 pb-2 border-b">業種・規模</h3>
              <div class="grid md:grid-cols-2 gap-4">
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
            </div>
            
            <div class="flex gap-4 pt-4">
              <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">
                <i class="fas fa-save"></i> 保存する
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        // 既存データ読み込み
        (async function() {
          try {
            const res = await apiCall('/api/companies');
            if (res.success && res.data && res.data.length > 0) {
              const company = res.data[0];
              document.getElementById('company-id').value = company.id || '';
              document.querySelector('input[name="name"]').value = company.name || '';
              document.querySelector('input[name="postal_code"]').value = company.postal_code || '';
              document.querySelector('select[name="prefecture"]').value = company.prefecture || '';
              document.querySelector('input[name="city"]').value = company.city || '';
              document.querySelector('select[name="industry_major"]').value = company.industry_major || '';
              document.querySelector('input[name="employee_count"]').value = company.employee_count || '';
              document.querySelector('input[name="capital"]').value = company.capital || '';
              document.querySelector('input[name="annual_revenue"]').value = company.annual_revenue || '';
              document.querySelector('input[name="established_date"]').value = company.established_date || '';
            }
          } catch (err) {
            console.error('Load company error:', err);
          }
        })();
        
        // 従業員帯を計算
        function getEmployeeBand(count) {
          if (count <= 5) return '1-5';
          if (count <= 20) return '6-20';
          if (count <= 50) return '21-50';
          if (count <= 100) return '51-100';
          if (count <= 300) return '101-300';
          return '301+';
        }
        
        // フォーム送信
        document.getElementById('company-form').addEventListener('submit', async function(e) {
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
            const companyId = form.id.value;
            let res;
            if (companyId) {
              res = await apiCall('/api/companies/' + companyId, {
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
              successDiv.textContent = '会社情報を保存しました';
              successDiv.classList.remove('hidden');
              if (res.data && res.data.id) {
                form.id.value = res.data.id;
              }
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
      `}} />
    </AppLayout>
  );
});

export default pages;

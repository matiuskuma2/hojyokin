/**
 * 補助金マッチングシステム - フロントエンドアプリケーション
 * 
 * SPA風ルーティング + API連携
 */

// ============================================================
// グローバル状態管理
// ============================================================

const state = {
  user: null,
  token: localStorage.getItem('token'),
  company: null,
  companies: [],
  subsidies: [],
  currentSubsidy: null,
  eligibilityRules: [],
  currentView: 'home',
  loading: false,
  error: null,
};

// API Base URL
const API_BASE = '';

// ============================================================
// ユーティリティ関数
// ============================================================

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'API Error');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

function showLoading() {
  state.loading = true;
  render();
}

function hideLoading() {
  state.loading = false;
  render();
}

function showError(message) {
  state.error = message;
  setTimeout(() => {
    state.error = null;
    render();
  }, 5000);
  render();
}

function formatCurrency(amount) {
  if (!amount) return '-';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

// ============================================================
// 認証関連
// ============================================================

async function login(email, password) {
  showLoading();
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    state.token = result.data.token;
    state.user = result.data.user;
    localStorage.setItem('token', state.token);
    
    await loadCompanies();
    navigate('dashboard');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}

async function register(email, password, name) {
  showLoading();
  try {
    const result = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    state.token = result.data.token;
    state.user = result.data.user;
    localStorage.setItem('token', state.token);
    
    navigate('company-setup');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.company = null;
  state.companies = [];
  localStorage.removeItem('token');
  navigate('home');
}

async function checkAuth() {
  if (!state.token) return false;
  
  try {
    const result = await api('/api/auth/me');
    state.user = result.data;
    return true;
  } catch (error) {
    state.token = null;
    localStorage.removeItem('token');
    return false;
  }
}

// ============================================================
// 企業関連
// ============================================================

async function loadCompanies() {
  try {
    const result = await api('/api/companies');
    state.companies = result.data || [];
    if (state.companies.length > 0 && !state.company) {
      state.company = state.companies[0];
    }
  } catch (error) {
    console.error('Failed to load companies:', error);
  }
}

async function createCompany(companyData) {
  showLoading();
  try {
    const result = await api('/api/companies', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });
    
    state.company = result.data;
    state.companies.push(result.data);
    navigate('dashboard');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}

// ============================================================
// 補助金関連
// ============================================================

async function searchSubsidies(keyword = '') {
  if (!state.company) {
    showError('企業を選択してください');
    return;
  }
  
  showLoading();
  try {
    const params = new URLSearchParams({
      company_id: state.company.id,
      ...(keyword ? { keyword } : {}),
    });
    
    const result = await api(`/api/subsidies/search?${params}`);
    state.subsidies = result.data || [];
    render();
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}

async function loadSubsidyDetail(subsidyId) {
  showLoading();
  try {
    const result = await api(`/api/subsidies/${subsidyId}`);
    state.currentSubsidy = result.data;
    
    // 要件ルールも取得
    try {
      const rulesResult = await api(`/api/subsidies/${subsidyId}/eligibility`);
      state.eligibilityRules = rulesResult.data?.rules || [];
    } catch (e) {
      state.eligibilityRules = [];
    }
    
    navigate('subsidy-detail');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}

async function ingestSubsidy(subsidyId) {
  if (!state.company) {
    showError('企業を選択してください');
    return;
  }
  
  showLoading();
  try {
    const result = await api(`/api/jobs/subsidies/${subsidyId}/ingest`, {
      method: 'POST',
      body: JSON.stringify({ company_id: state.company.id }),
    });
    
    alert(`ジョブを投入しました！\nJob ID: ${result.data.job_id}\n\n要件の抽出が完了するまでお待ちください。`);
    
    // ステータスをポーリング
    pollJobStatus(result.data.job_id, subsidyId);
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}

async function pollJobStatus(jobId, subsidyId) {
  let attempts = 0;
  const maxAttempts = 30;
  
  const poll = async () => {
    attempts++;
    try {
      const result = await api(`/api/jobs/${jobId}/status`);
      
      if (result.data.status === 'COMPLETED') {
        // 完了したら要件を再取得
        const rulesResult = await api(`/api/subsidies/${subsidyId}/eligibility`);
        state.eligibilityRules = rulesResult.data?.rules || [];
        render();
        alert('要件の抽出が完了しました！');
        return;
      } else if (result.data.status === 'FAILED') {
        showError('要件抽出に失敗しました');
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(poll, 3000);
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  };
  
  poll();
}

// ============================================================
// ルーティング
// ============================================================

function navigate(view) {
  state.currentView = view;
  window.history.pushState({ view }, '', `#${view}`);
  render();
}

window.addEventListener('popstate', (e) => {
  state.currentView = e.state?.view || 'home';
  render();
});

// ============================================================
// レンダリング関数
// ============================================================

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  
  let content = '';
  
  // ローディング
  if (state.loading) {
    content = renderLoading();
  } else {
    // ビューに応じたコンテンツ
    switch (state.currentView) {
      case 'home':
        content = renderHome();
        break;
      case 'login':
        content = renderLogin();
        break;
      case 'register':
        content = renderRegister();
        break;
      case 'company-setup':
        content = renderCompanySetup();
        break;
      case 'dashboard':
        content = renderDashboard();
        break;
      case 'subsidies':
        content = renderSubsidies();
        break;
      case 'subsidy-detail':
        content = renderSubsidyDetail();
        break;
      default:
        content = renderHome();
    }
  }
  
  // エラーメッセージ
  const errorHtml = state.error ? `
    <div class="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
      <i class="fas fa-exclamation-circle mr-2"></i>
      ${state.error}
    </div>
  ` : '';
  
  app.innerHTML = errorHtml + content;
  
  // イベントリスナーを再設定
  setupEventListeners();
}

function renderLoading() {
  return `
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-4xl text-indigo-600 mb-4"></i>
        <p class="text-gray-600">読み込み中...</p>
      </div>
    </div>
  `;
}

function renderHome() {
  return `
    <div class="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <!-- Header -->
      <nav class="bg-white/10 backdrop-blur-sm">
        <div class="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold text-white flex items-center gap-2">
            <i class="fas fa-coins text-yellow-300"></i>
            補助金マッチング
          </h1>
          <div class="space-x-4">
            ${state.token ? `
              <button onclick="navigate('dashboard')" class="text-white hover:text-yellow-300">
                ダッシュボード
              </button>
              <button onclick="logout()" class="text-white hover:text-yellow-300">
                ログアウト
              </button>
            ` : `
              <button onclick="navigate('login')" class="text-white hover:text-yellow-300">
                ログイン
              </button>
              <button onclick="navigate('register')" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-300">
                無料登録
              </button>
            `}
          </div>
        </div>
      </nav>
      
      <!-- Hero -->
      <div class="container mx-auto px-4 py-20 text-center text-white">
        <h2 class="text-5xl font-bold mb-6">
          補助金を<span class="text-yellow-300">賢く</span>活用
        </h2>
        <p class="text-xl mb-8 opacity-90">
          企業情報を登録するだけで、最適な補助金・助成金を自動マッチング
        </p>
        <div class="space-x-4">
          <button onclick="navigate('register')" class="bg-yellow-400 text-gray-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition">
            <i class="fas fa-rocket mr-2"></i>
            今すぐ始める
          </button>
        </div>
      </div>
      
      <!-- Features -->
      <div class="bg-white py-20">
        <div class="container mx-auto px-4">
          <h3 class="text-3xl font-bold text-center text-gray-800 mb-12">主な機能</h3>
          <div class="grid md:grid-cols-3 gap-8">
            <div class="text-center p-6">
              <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-search text-2xl text-indigo-600"></i>
              </div>
              <h4 class="text-xl font-semibold mb-2">自動マッチング</h4>
              <p class="text-gray-600">Jグランツから補助金を取得し、企業に最適な補助金を自動で見つけます</p>
            </div>
            <div class="text-center p-6">
              <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-robot text-2xl text-green-600"></i>
              </div>
              <h4 class="text-xl font-semibold mb-2">AI要件抽出</h4>
              <p class="text-gray-600">公募要領からAIが申請要件を自動抽出。必須・任意を一目で確認</p>
            </div>
            <div class="text-center p-6">
              <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-comments text-2xl text-yellow-600"></i>
              </div>
              <h4 class="text-xl font-semibold mb-2">壁打ちBot</h4>
              <p class="text-gray-600">AIと対話しながら申請内容を整理。申請書の下書きまでサポート</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <footer class="bg-gray-900 text-white py-8">
        <div class="container mx-auto px-4 text-center">
          <p class="opacity-60">&copy; 2026 補助金マッチングシステム. All rights reserved.</p>
        </div>
      </footer>
    </div>
  `;
}

function renderLogin() {
  return `
    <div class="min-h-screen bg-gray-100 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
          <i class="fas fa-sign-in-alt text-indigo-600 mr-2"></i>
          ログイン
        </h2>
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-gray-700 mb-2">メールアドレス</label>
            <input type="email" id="login-email" required
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="example@email.com">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">パスワード</label>
            <input type="password" id="login-password" required
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••">
          </div>
          <button type="submit"
            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
            ログイン
          </button>
        </form>
        <p class="mt-4 text-center text-gray-600">
          アカウントをお持ちでない方は
          <a href="#" onclick="navigate('register')" class="text-indigo-600 hover:underline">新規登録</a>
        </p>
        <p class="mt-2 text-center">
          <a href="#" onclick="navigate('home')" class="text-gray-500 hover:underline">← ホームに戻る</a>
        </p>
      </div>
    </div>
  `;
}

function renderRegister() {
  return `
    <div class="min-h-screen bg-gray-100 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
          <i class="fas fa-user-plus text-indigo-600 mr-2"></i>
          新規登録
        </h2>
        <form id="register-form" class="space-y-4">
          <div>
            <label class="block text-gray-700 mb-2">お名前</label>
            <input type="text" id="register-name" required
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="山田太郎">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">メールアドレス</label>
            <input type="email" id="register-email" required
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="example@email.com">
          </div>
          <div>
            <label class="block text-gray-700 mb-2">パスワード</label>
            <input type="password" id="register-password" required
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="8文字以上（大小英字+数字）">
            <p class="text-xs text-gray-500 mt-1">8文字以上、大文字・小文字・数字を含む</p>
          </div>
          <button type="submit"
            class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
            登録する
          </button>
        </form>
        <p class="mt-4 text-center text-gray-600">
          すでにアカウントをお持ちの方は
          <a href="#" onclick="navigate('login')" class="text-indigo-600 hover:underline">ログイン</a>
        </p>
        <p class="mt-2 text-center">
          <a href="#" onclick="navigate('home')" class="text-gray-500 hover:underline">← ホームに戻る</a>
        </p>
      </div>
    </div>
  `;
}

function renderCompanySetup() {
  return `
    <div class="min-h-screen bg-gray-100 py-8">
      <div class="container mx-auto px-4 max-w-2xl">
        <div class="bg-white p-8 rounded-lg shadow-lg">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-building text-indigo-600 mr-2"></i>
            企業情報を登録
          </h2>
          <p class="text-gray-600 mb-6">補助金のマッチングに必要な企業情報を入力してください。</p>
          
          <form id="company-form" class="space-y-6">
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 mb-2">会社名 <span class="text-red-500">*</span></label>
                <input type="text" id="company-name" required
                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="株式会社○○">
              </div>
              <div>
                <label class="block text-gray-700 mb-2">業種（大分類） <span class="text-red-500">*</span></label>
                <select id="company-industry" required
                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  <option value="情報通信業">情報通信業</option>
                  <option value="製造業">製造業</option>
                  <option value="建設業">建設業</option>
                  <option value="卸売業・小売業">卸売業・小売業</option>
                  <option value="サービス業">サービス業</option>
                  <option value="飲食サービス業">飲食サービス業</option>
                  <option value="不動産業">不動産業</option>
                  <option value="運輸業">運輸業</option>
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 mb-2">都道府県 <span class="text-red-500">*</span></label>
                <select id="company-prefecture" required
                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  <option value="東京都">東京都</option>
                  <option value="大阪府">大阪府</option>
                  <option value="愛知県">愛知県</option>
                  <option value="神奈川県">神奈川県</option>
                  <option value="福岡県">福岡県</option>
                  <!-- 他の都道府県は省略 -->
                </select>
              </div>
              <div>
                <label class="block text-gray-700 mb-2">従業員数 <span class="text-red-500">*</span></label>
                <input type="number" id="company-employees" required min="1"
                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="10">
              </div>
            </div>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 mb-2">資本金（円）</label>
                <input type="number" id="company-capital" min="0"
                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="10000000">
              </div>
              <div>
                <label class="block text-gray-700 mb-2">年商（円）</label>
                <input type="number" id="company-revenue" min="0"
                  class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="100000000">
              </div>
            </div>
            
            <button type="submit"
              class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
              <i class="fas fa-check mr-2"></i>
              登録して補助金を探す
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function renderDashboard() {
  return `
    <div class="min-h-screen bg-gray-100">
      <!-- Header -->
      <nav class="bg-white shadow-sm">
        <div class="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-coins text-yellow-500"></i>
            補助金マッチング
          </h1>
          <div class="flex items-center gap-4">
            <span class="text-gray-600">
              <i class="fas fa-user mr-1"></i>
              ${state.user?.name || state.user?.email || 'ユーザー'}
            </span>
            <button onclick="logout()" class="text-gray-500 hover:text-red-500">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </nav>
      
      <div class="container mx-auto px-4 py-8">
        <!-- Company Selector -->
        ${state.companies.length > 0 ? `
          <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-800">
                  <i class="fas fa-building text-indigo-600 mr-2"></i>
                  ${state.company?.name || '企業未選択'}
                </h2>
                <p class="text-sm text-gray-500">
                  ${state.company?.industry_major || ''} | 従業員 ${state.company?.employee_count || 0}名
                </p>
              </div>
              <button onclick="navigate('subsidies')" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
                <i class="fas fa-search mr-2"></i>
                補助金を探す
              </button>
            </div>
          </div>
        ` : `
          <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p class="text-yellow-800">
              <i class="fas fa-exclamation-triangle mr-2"></i>
              企業情報が登録されていません。
              <a href="#" onclick="navigate('company-setup')" class="underline font-semibold">登録する</a>
            </p>
          </div>
        `}
        
        <!-- Quick Stats -->
        <div class="grid md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-500 text-sm">検索した補助金</p>
                <p class="text-3xl font-bold text-gray-800">${state.subsidies.length}</p>
              </div>
              <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <i class="fas fa-file-invoice-dollar text-indigo-600"></i>
              </div>
            </div>
          </div>
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-500 text-sm">マッチ度高</p>
                <p class="text-3xl font-bold text-green-600">
                  ${state.subsidies.filter(s => s.evaluation?.status === 'PROCEED').length}
                </p>
              </div>
              <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <i class="fas fa-check-circle text-green-600"></i>
              </div>
            </div>
          </div>
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-500 text-sm">要注意</p>
                <p class="text-3xl font-bold text-yellow-600">
                  ${state.subsidies.filter(s => s.evaluation?.status === 'CAUTION').length}
                </p>
              </div>
              <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <i class="fas fa-exclamation-triangle text-yellow-600"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Recent Subsidies -->
        ${state.subsidies.length > 0 ? `
          <div class="bg-white rounded-lg shadow-sm">
            <div class="p-4 border-b">
              <h3 class="text-lg font-semibold text-gray-800">最近の検索結果</h3>
            </div>
            <div class="divide-y">
              ${state.subsidies.slice(0, 5).map(item => renderSubsidyCard(item)).join('')}
            </div>
            <div class="p-4 text-center">
              <button onclick="navigate('subsidies')" class="text-indigo-600 hover:underline">
                すべて見る →
              </button>
            </div>
          </div>
        ` : `
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
            <p class="text-gray-500 mb-4">まだ補助金を検索していません</p>
            <button onclick="navigate('subsidies')" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
              補助金を探す
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderSubsidies() {
  return `
    <div class="min-h-screen bg-gray-100">
      <!-- Header -->
      <nav class="bg-white shadow-sm">
        <div class="container mx-auto px-4 py-4 flex justify-between items-center">
          <div class="flex items-center gap-4">
            <button onclick="navigate('dashboard')" class="text-gray-500 hover:text-indigo-600">
              <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="text-xl font-bold text-gray-800">補助金検索</h1>
          </div>
        </div>
      </nav>
      
      <div class="container mx-auto px-4 py-8">
        <!-- Search Bar -->
        <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
          <form id="search-form" class="flex gap-4">
            <input type="text" id="search-keyword" 
              class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="キーワードで検索（例：IT導入、設備投資）">
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
              <i class="fas fa-search mr-2"></i>
              検索
            </button>
          </form>
        </div>
        
        <!-- Results -->
        ${state.subsidies.length > 0 ? `
          <div class="space-y-4">
            ${state.subsidies.map(item => renderSubsidyCard(item)).join('')}
          </div>
        ` : `
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <i class="fas fa-info-circle text-4xl text-gray-300 mb-4"></i>
            <p class="text-gray-500">検索ボタンを押して補助金を探しましょう</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderSubsidyCard(item) {
  const subsidy = item.subsidy;
  const evaluation = item.evaluation;
  
  const statusColors = {
    'PROCEED': 'bg-green-100 text-green-800 border-green-500',
    'CAUTION': 'bg-yellow-100 text-yellow-800 border-yellow-500',
    'DO_NOT_PROCEED': 'bg-red-100 text-red-800 border-red-500',
  };
  
  const statusLabels = {
    'PROCEED': '推奨',
    'CAUTION': '注意',
    'DO_NOT_PROCEED': '非推奨',
  };
  
  return `
    <div class="bg-white rounded-lg shadow-sm p-4 border-l-4 ${statusColors[evaluation?.status] || 'border-gray-300'} hover:shadow-md transition cursor-pointer"
         onclick="loadSubsidyDetail('${subsidy.id}')">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-1 text-xs font-semibold rounded ${statusColors[evaluation?.status] || 'bg-gray-100'}">
              ${statusLabels[evaluation?.status] || '未評価'}
            </span>
            <span class="text-sm text-gray-500">
              スコア: ${evaluation?.score || 0}点
            </span>
          </div>
          <h3 class="text-lg font-semibold text-gray-800 mb-1">${subsidy.title}</h3>
          <p class="text-sm text-gray-600">
            上限: ${formatCurrency(subsidy.subsidy_max_limit)} | 
            補助率: ${subsidy.subsidy_rate || '-'}
          </p>
          <p class="text-xs text-gray-500 mt-2">
            <i class="fas fa-calendar mr-1"></i>
            締切: ${formatDate(subsidy.acceptance_end_datetime)}
          </p>
        </div>
        <div class="text-right">
          <i class="fas fa-chevron-right text-gray-400"></i>
        </div>
      </div>
    </div>
  `;
}

function renderSubsidyDetail() {
  const subsidy = state.currentSubsidy?.subsidy || state.currentSubsidy;
  const evaluation = state.currentSubsidy?.evaluation;
  
  if (!subsidy) {
    return `
      <div class="min-h-screen bg-gray-100 flex items-center justify-center">
        <p class="text-gray-500">補助金情報が見つかりません</p>
      </div>
    `;
  }
  
  return `
    <div class="min-h-screen bg-gray-100">
      <!-- Header -->
      <nav class="bg-white shadow-sm">
        <div class="container mx-auto px-4 py-4 flex justify-between items-center">
          <div class="flex items-center gap-4">
            <button onclick="navigate('subsidies')" class="text-gray-500 hover:text-indigo-600">
              <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="text-xl font-bold text-gray-800">補助金詳細</h1>
          </div>
        </div>
      </nav>
      
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        <!-- Main Info -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-2xl font-bold text-gray-800 mb-4">${subsidy.title}</h2>
          
          <div class="grid md:grid-cols-2 gap-4 mb-6">
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-500">補助上限額</p>
              <p class="text-2xl font-bold text-indigo-600">${formatCurrency(subsidy.subsidy_max_limit)}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-500">補助率</p>
              <p class="text-2xl font-bold text-indigo-600">${subsidy.subsidy_rate || '-'}</p>
            </div>
          </div>
          
          <div class="space-y-2 text-sm text-gray-600">
            <p><i class="fas fa-map-marker-alt w-5 text-gray-400"></i> 対象地域: ${subsidy.target_area_search || '全国'}</p>
            <p><i class="fas fa-industry w-5 text-gray-400"></i> 対象業種: ${subsidy.target_industry || '全業種'}</p>
            <p><i class="fas fa-users w-5 text-gray-400"></i> 対象規模: ${subsidy.target_number_of_employees || '-'}</p>
            <p><i class="fas fa-calendar w-5 text-gray-400"></i> 締切: ${formatDate(subsidy.acceptance_end_datetime)}</p>
          </div>
        </div>
        
        <!-- Evaluation -->
        ${evaluation ? `
          <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">
              <i class="fas fa-chart-pie text-indigo-600 mr-2"></i>
              マッチング評価
            </h3>
            <div class="flex items-center gap-4 mb-4">
              <div class="text-4xl font-bold ${evaluation.status === 'PROCEED' ? 'text-green-600' : evaluation.status === 'CAUTION' ? 'text-yellow-600' : 'text-red-600'}">
                ${evaluation.score}点
              </div>
              <div class="flex-1">
                <div class="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full ${evaluation.status === 'PROCEED' ? 'bg-green-500' : evaluation.status === 'CAUTION' ? 'bg-yellow-500' : 'bg-red-500'}" 
                       style="width: ${evaluation.score}%"></div>
                </div>
              </div>
            </div>
            <div class="text-sm text-gray-600 whitespace-pre-line">
              ${evaluation.explanation || ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Eligibility Rules -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-800">
              <i class="fas fa-clipboard-list text-indigo-600 mr-2"></i>
              申請要件
            </h3>
            <button onclick="ingestSubsidy('${subsidy.id}')" 
              class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
              <i class="fas fa-sync-alt mr-2"></i>
              要件を読み込む
            </button>
          </div>
          
          ${state.eligibilityRules.length > 0 ? `
            <div class="space-y-3">
              ${state.eligibilityRules.map(rule => `
                <div class="border rounded-lg p-3 ${rule.check_type === 'AUTO' ? 'border-green-200 bg-green-50' : rule.check_type === 'MANUAL' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}">
                  <div class="flex items-start gap-2">
                    <span class="px-2 py-0.5 text-xs rounded ${rule.check_type === 'AUTO' ? 'bg-green-200 text-green-800' : rule.check_type === 'MANUAL' ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800'}">
                      ${rule.check_type === 'AUTO' ? '自動判定' : rule.check_type === 'MANUAL' ? '要確認' : 'AI判定'}
                    </span>
                    <span class="text-xs text-gray-500">${rule.category}</span>
                  </div>
                  <p class="mt-2 text-gray-800">${rule.rule_text}</p>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="text-center py-8 text-gray-500">
              <i class="fas fa-file-alt text-4xl text-gray-300 mb-4"></i>
              <p>要件がまだ読み込まれていません</p>
              <p class="text-sm">「要件を読み込む」ボタンを押してください</p>
            </div>
          `}
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-4">
          <button onclick="navigate('subsidies')" class="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300">
            <i class="fas fa-arrow-left mr-2"></i>
            一覧に戻る
          </button>
          <button onclick="alert('壁打ちBot機能は準備中です')" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700">
            <i class="fas fa-comments mr-2"></i>
            壁打ちを始める
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// イベントリスナー設定
// ============================================================

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      login(email, password);
    });
  }
  
  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      register(email, password, name);
    });
  }
  
  // Company form
  const companyForm = document.getElementById('company-form');
  if (companyForm) {
    companyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      createCompany({
        name: document.getElementById('company-name').value,
        industry_major: document.getElementById('company-industry').value,
        prefecture: document.getElementById('company-prefecture').value,
        employee_count: parseInt(document.getElementById('company-employees').value) || 1,
        capital: parseInt(document.getElementById('company-capital').value) || null,
        annual_revenue: parseInt(document.getElementById('company-revenue').value) || null,
      });
    });
  }
  
  // Search form
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const keyword = document.getElementById('search-keyword').value;
      searchSubsidies(keyword);
    });
  }
}

// ============================================================
// 初期化
// ============================================================

async function init() {
  // URLハッシュからビューを復元
  const hash = window.location.hash.slice(1);
  if (hash) {
    state.currentView = hash;
  }
  
  // 認証チェック
  if (state.token) {
    const isAuth = await checkAuth();
    if (isAuth) {
      await loadCompanies();
      if (state.currentView === 'home') {
        state.currentView = 'dashboard';
      }
    }
  }
  
  render();
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);

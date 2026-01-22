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
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span id="agency-name" class="text-sm"></span>
          <span id="user-name" class="text-sm text-emerald-200"></span>
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
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
      window.location.href = '/login';
    } else if (user.role !== 'agency') {
      alert('士業アカウントが必要です');
      window.location.href = '/dashboard';
    } else {
      document.getElementById('user-name').textContent = user.name || user.email;
      
      // Agency情報取得
      fetch('/api/agency/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          document.getElementById('agency-name').textContent = data.data.agency.name;
        }
      });
      
      // 未処理件数取得
      fetch('/api/agency/submissions?status=submitted', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.submissions.length > 0) {
          const badge = document.getElementById('pending-badge');
          badge.textContent = data.data.submissions.length;
          badge.classList.remove('hidden');
        }
      });
    }
    
    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // 共通API呼び出し
    async function apiCall(endpoint, options = {}) {
      const res = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          ...options.headers,
        },
      });
      return res.json();
    }
  </script>
</body>
</html>
`;

/**
 * GET /agency - ダッシュボード
 */
agencyPages.get('/agency', (c) => {
  const content = `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">
        <i class="fas fa-chart-pie mr-2"></i>ダッシュボード
      </h1>
      
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="stat-card bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">顧客企業数</p>
              <p id="stat-total-clients" class="text-2xl font-bold text-gray-900 loading">-</p>
            </div>
            <div class="bg-emerald-100 p-3 rounded-full">
              <i class="fas fa-building text-emerald-600"></i>
            </div>
          </div>
        </div>
        
        <div class="stat-card bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">アクティブ</p>
              <p id="stat-active-clients" class="text-2xl font-bold text-emerald-600 loading">-</p>
            </div>
            <div class="bg-emerald-100 p-3 rounded-full">
              <i class="fas fa-check-circle text-emerald-600"></i>
            </div>
          </div>
        </div>
        
        <div class="stat-card bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">未処理受付</p>
              <p id="stat-pending" class="text-2xl font-bold text-orange-600 loading">-</p>
            </div>
            <div class="bg-orange-100 p-3 rounded-full">
              <i class="fas fa-inbox text-orange-600"></i>
            </div>
          </div>
        </div>
        
        <div class="stat-card bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">今日の検索</p>
              <p id="stat-searches" class="text-2xl font-bold text-blue-600 loading">-</p>
            </div>
            <div class="bg-blue-100 p-3 rounded-full">
              <i class="fas fa-search text-blue-600"></i>
            </div>
          </div>
        </div>
        
        <div class="stat-card bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">作成ドラフト</p>
              <p id="stat-drafts" class="text-2xl font-bold text-purple-600 loading">-</p>
            </div>
            <div class="bg-purple-100 p-3 rounded-full">
              <i class="fas fa-file-alt text-purple-600"></i>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Quick Actions -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-4">クイックアクション</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/agency/clients?action=add" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition">
            <div class="bg-emerald-100 p-3 rounded-full">
              <i class="fas fa-plus text-emerald-600"></i>
            </div>
            <div>
              <p class="font-medium">顧客を追加</p>
              <p class="text-sm text-gray-500">新しい顧客企業を登録</p>
            </div>
          </a>
          
          <a href="/subsidies" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition">
            <div class="bg-blue-100 p-3 rounded-full">
              <i class="fas fa-search text-blue-600"></i>
            </div>
            <div>
              <p class="font-medium">補助金を検索</p>
              <p class="text-sm text-gray-500">顧客に合う補助金を探す</p>
            </div>
          </a>
          
          <a href="/agency/links" class="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition">
            <div class="bg-purple-100 p-3 rounded-full">
              <i class="fas fa-link text-purple-600"></i>
            </div>
            <div>
              <p class="font-medium">リンクを発行</p>
              <p class="text-sm text-gray-500">顧客に入力リンクを送る</p>
            </div>
          </a>
        </div>
      </div>
      
      <!-- Upcoming Deadlines -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-4">
          <i class="fas fa-clock mr-2 text-orange-500"></i>期限が近い補助金
        </h2>
        <div id="upcoming-deadlines" class="space-y-2">
          <p class="text-gray-500 loading">読み込み中...</p>
        </div>
      </div>
    </div>
    
    <script>
      // ダッシュボードデータ取得
      async function loadDashboard() {
        const data = await apiCall('/api/agency/dashboard');
        if (data.success) {
          const stats = data.data.stats;
          document.getElementById('stat-total-clients').textContent = stats.totalClients;
          document.getElementById('stat-total-clients').classList.remove('loading');
          document.getElementById('stat-active-clients').textContent = stats.activeClients;
          document.getElementById('stat-active-clients').classList.remove('loading');
          document.getElementById('stat-pending').textContent = stats.pendingSubmissions;
          document.getElementById('stat-pending').classList.remove('loading');
          document.getElementById('stat-searches').textContent = stats.todaySearches;
          document.getElementById('stat-searches').classList.remove('loading');
          document.getElementById('stat-drafts').textContent = stats.totalDrafts;
          document.getElementById('stat-drafts').classList.remove('loading');
          
          // 期限が近い補助金
          const container = document.getElementById('upcoming-deadlines');
          if (data.data.upcomingDeadlines.length === 0) {
            container.innerHTML = '<p class="text-gray-500">期限が近い補助金はありません</p>';
          } else {
            container.innerHTML = data.data.upcomingDeadlines.map(d => \`
              <div class="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p class="font-medium">\${d.subsidy_id}</p>
                  <p class="text-sm text-gray-500">\${d.client_name || d.company_name}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-orange-600 font-medium">\${new Date(d.deadline_at).toLocaleDateString('ja-JP')}</p>
                </div>
              </div>
            \`).join('');
          }
        }
      }
      
      loadDashboard();
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
        <button onclick="showAddClientModal()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
          <i class="fas fa-plus mr-2"></i>顧客を追加
        </button>
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
                <label class="block text-sm font-medium text-gray-700 mb-1">都道府県</label>
                <select name="prefecture" class="w-full border rounded-lg px-3 py-2">
                  <option value="">選択してください</option>
                  <option value="東京都">東京都</option>
                  <option value="大阪府">大阪府</option>
                  <option value="愛知県">愛知県</option>
                  <!-- 他の都道府県も追加 -->
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">業種</label>
                <input type="text" name="industry" class="w-full border rounded-lg px-3 py-2">
              </div>
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
    
    <script>
      let clients = [];
      
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
        // 補助金検索画面へ（company_idをセット）
        localStorage.setItem('selectedCompanyId', companyId);
        window.location.href = '/subsidies';
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
      
      function showAddClientModal() {
        document.getElementById('add-client-modal').classList.remove('hidden');
      }
      
      function hideAddClientModal() {
        document.getElementById('add-client-modal').classList.add('hidden');
      }
      
      document.getElementById('add-client-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const data = await apiCall('/api/agency/clients', {
          method: 'POST',
          body: JSON.stringify({
            clientName: formData.get('clientName'),
            companyName: formData.get('companyName'),
            clientEmail: formData.get('clientEmail'),
            clientPhone: formData.get('clientPhone'),
            prefecture: formData.get('prefecture'),
            industry: formData.get('industry'),
            notes: formData.get('notes'),
          }),
        });
        
        if (data.success) {
          hideAddClientModal();
          form.reset();
          loadClients();
        } else {
          alert('エラー: ' + (data.error?.message || '不明なエラー'));
        }
      });
      
      // URL パラメータで自動モーダル表示
      if (new URLSearchParams(window.location.search).get('action') === 'add') {
        showAddClientModal();
      }
      
      loadClients();
    </script>
  `;
  
  return c.html(agencyLayout('顧客企業', content, 'clients'));
});

/**
 * GET /agency/links - リンク管理
 */
agencyPages.get('/agency/links', (c) => {
  const content = `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">
        <i class="fas fa-link mr-2"></i>リンク管理
      </h1>
      
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
      
      loadLinks();
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
      async function loadSubmissions() {
        const status = document.getElementById('status-filter').value;
        let url = '/api/agency/submissions';
        if (status) url += '?status=' + status;
        
        const data = await apiCall(url);
        if (data.success) {
          renderSubmissions(data.data.submissions);
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
      
      let currentSubmissions = [];
      
      async function loadSubmissions() {
        const status = document.getElementById('status-filter').value;
        let url = '/api/agency/submissions';
        if (status) url += '?status=' + status;
        
        const data = await apiCall(url);
        if (data.success) {
          currentSubmissions = data.data.submissions;
          renderSubmissions(currentSubmissions);
        }
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
      
      loadSubmissions();
    </script>
  `;
  
  return c.html(agencyLayout('入力受付', content, 'submissions'));
});

export default agencyPages;

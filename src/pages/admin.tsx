/**
 * 管理画面ページ
 * 
 * /admin - 管理者ダッシュボード（統計・概要）
 * /admin/users - ユーザー一覧
 * /admin/audit - 監査ログ
 * /admin/kpi - KPIダッシュボード
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const adminPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// ========================================
// 共通レイアウト
// ========================================

const AdminLayout = ({ title, children }: { title: string; children: any }) => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 補助金マッチング 管理画面</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .sidebar { transition: transform 0.3s ease; }
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); }
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <!-- サイドバー -->
  <aside class="sidebar fixed left-0 top-0 h-full w-64 bg-gray-900 text-white z-40">
    <div class="p-4 border-b border-gray-700">
      <h1 class="text-xl font-bold">
        <i class="fas fa-cog mr-2"></i>管理画面
      </h1>
      <p class="text-sm text-gray-400 mt-1">補助金マッチングシステム</p>
    </div>
    <nav class="p-4">
      <ul class="space-y-2">
        <li>
          <a href="/admin" class="flex items-center px-4 py-2 rounded hover:bg-gray-700 transition-colors" data-nav="dashboard">
            <i class="fas fa-chart-line w-5"></i>
            <span class="ml-3">ダッシュボード</span>
          </a>
        </li>
        <li>
          <a href="/admin/users" class="flex items-center px-4 py-2 rounded hover:bg-gray-700 transition-colors" data-nav="users">
            <i class="fas fa-users w-5"></i>
            <span class="ml-3">ユーザー管理</span>
          </a>
        </li>
        <li>
          <a href="/admin/kpi" class="flex items-center px-4 py-2 rounded hover:bg-gray-700 transition-colors" data-nav="kpi">
            <i class="fas fa-tachometer-alt w-5"></i>
            <span class="ml-3">KPIモニター</span>
          </a>
        </li>
        <li>
          <a href="/admin/audit" class="flex items-center px-4 py-2 rounded hover:bg-gray-700 transition-colors" data-nav="audit">
            <i class="fas fa-history w-5"></i>
            <span class="ml-3">監査ログ</span>
          </a>
        </li>
      </ul>
      <hr class="my-4 border-gray-700">
      <ul class="space-y-2">
        <li>
          <a href="/dashboard" class="flex items-center px-4 py-2 rounded hover:bg-gray-700 transition-colors text-gray-400">
            <i class="fas fa-arrow-left w-5"></i>
            <span class="ml-3">ユーザー画面へ</span>
          </a>
        </li>
        <li>
          <button onclick="logout()" class="flex items-center w-full px-4 py-2 rounded hover:bg-gray-700 transition-colors text-red-400">
            <i class="fas fa-sign-out-alt w-5"></i>
            <span class="ml-3">ログアウト</span>
          </button>
        </li>
      </ul>
    </nav>
  </aside>

  <!-- メインコンテンツ -->
  <main class="ml-64 p-6">
    <div class="max-w-7xl mx-auto">
      ${children}
    </div>
  </main>

  <!-- モバイルメニューボタン -->
  <button id="mobileMenuBtn" class="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-full shadow-lg md:hidden z-50">
    <i class="fas fa-bars"></i>
  </button>

  <script>
    // ========================================
    // 共通関数
    // ========================================
    const API_BASE = '/api';
    
    function getToken() {
      return localStorage.getItem('token');
    }
    
    async function apiCall(endpoint, options = {}) {
      const token = getToken();
      if (!token) {
        window.location.href = '/login';
        return null;
      }
      
      const response = await fetch(API_BASE + endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          ...options.headers,
        },
      });
      
      const data = await response.json();
      
      if (!data.success && data.error?.code === 'UNAUTHORIZED') {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return null;
      }
      
      if (!data.success && data.error?.code === 'FORBIDDEN') {
        alert('管理者権限が必要です');
        window.location.href = '/dashboard';
        return null;
      }
      
      return data;
    }
    
    function logout() {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleString('ja-JP');
    }
    
    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // モバイルメニュー
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
    });
    
    // アクティブなナビゲーションをハイライト
    const currentPath = window.location.pathname;
    document.querySelectorAll('[data-nav]').forEach(el => {
      const href = el.getAttribute('href');
      if (currentPath === href || (href !== '/admin' && currentPath.startsWith(href))) {
        el.classList.add('bg-gray-700');
      }
    });
  </script>
</body>
</html>
`;

// ========================================
// 管理者ダッシュボード
// ========================================
adminPages.get('/admin', (c) => {
  const content = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-chart-line mr-2"></i>管理者ダッシュボード
      </h2>
      <p class="text-gray-600 mt-1">システム全体の概要と重要な統計</p>
    </div>
    
    <!-- 統計カード -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" id="statsCards">
      <div class="bg-white rounded-lg shadow p-6 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-8 bg-gray-200 rounded"></div>
      </div>
      <div class="bg-white rounded-lg shadow p-6 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-8 bg-gray-200 rounded"></div>
      </div>
      <div class="bg-white rounded-lg shadow p-6 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-8 bg-gray-200 rounded"></div>
      </div>
      <div class="bg-white rounded-lg shadow p-6 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-8 bg-gray-200 rounded"></div>
      </div>
    </div>
    
    <!-- 重要イベント -->
    <div class="bg-white rounded-lg shadow mb-8">
      <div class="p-4 border-b">
        <h3 class="text-lg font-semibold">
          <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>重要イベント（直近7日）
        </h3>
      </div>
      <div class="p-4" id="criticalEvents">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded"></div>
          <div class="h-4 bg-gray-200 rounded"></div>
          <div class="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
    
    <!-- 監査サマリー -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-4 border-b">
        <h3 class="text-lg font-semibold">
          <i class="fas fa-chart-bar text-blue-500 mr-2"></i>監査ログサマリー（直近7日）
        </h3>
      </div>
      <div class="p-4" id="auditSummary">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded"></div>
          <div class="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
    
    <script>
      async function loadDashboard() {
        const data = await apiCall('/admin/stats');
        if (!data?.success) return;
        
        const { users, companies, audit_summary, critical_events } = data.data;
        
        // 統計カード
        document.getElementById('statsCards').innerHTML = \`
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">総ユーザー数</p>
            <p class="text-3xl font-bold text-blue-600">\${users.total || 0}</p>
            <p class="text-sm text-gray-400 mt-2">
              <span class="text-green-500">+\${users.new_week || 0}</span> 今週
            </p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">アクティブユーザー</p>
            <p class="text-3xl font-bold text-green-600">\${users.active_week || 0}</p>
            <p class="text-sm text-gray-400 mt-2">直近7日ログイン</p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">凍結中</p>
            <p class="text-3xl font-bold text-red-600">\${users.disabled || 0}</p>
            <p class="text-sm text-gray-400 mt-2">
              ロック中: \${users.locked || 0}
            </p>
          </div>
          <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">登録会社数</p>
            <p class="text-3xl font-bold text-purple-600">\${companies?.total || 0}</p>
            <p class="text-sm text-gray-400 mt-2">
              <span class="text-green-500">+\${companies?.new_week || 0}</span> 今週
            </p>
          </div>
        \`;
        
        // 重要イベント
        if (critical_events && critical_events.length > 0) {
          document.getElementById('criticalEvents').innerHTML = critical_events.map(e => \`
            <div class="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">\${e.action}</span>
                <span class="ml-2 text-gray-600">\${e.actor_email || 'システム'} → \${e.target_email || '-'}</span>
              </div>
              <span class="text-sm text-gray-400">\${formatDate(e.created_at)}</span>
            </div>
          \`).join('');
        } else {
          document.getElementById('criticalEvents').innerHTML = '<p class="text-gray-500">重要イベントはありません</p>';
        }
        
        // 監査サマリー
        if (audit_summary && audit_summary.length > 0) {
          const grouped = {};
          audit_summary.forEach(s => {
            if (!grouped[s.action_category]) grouped[s.action_category] = {};
            grouped[s.action_category][s.severity] = s.count;
          });
          
          document.getElementById('auditSummary').innerHTML = \`
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              \${Object.entries(grouped).map(([cat, severities]) => \`
                <div class="p-4 bg-gray-50 rounded">
                  <p class="font-medium text-gray-700 capitalize">\${cat}</p>
                  <div class="mt-2 space-y-1">
                    <p class="text-sm"><span class="text-blue-500">info:</span> \${severities.info || 0}</p>
                    <p class="text-sm"><span class="text-yellow-500">warning:</span> \${severities.warning || 0}</p>
                    <p class="text-sm"><span class="text-red-500">critical:</span> \${severities.critical || 0}</p>
                  </div>
                </div>
              \`).join('')}
            </div>
          \`;
        } else {
          document.getElementById('auditSummary').innerHTML = '<p class="text-gray-500">データがありません</p>';
        }
      }
      
      loadDashboard();
    </script>
  `;
  
  return c.html(AdminLayout({ title: 'ダッシュボード', children: content }));
});

// ========================================
// ユーザー管理
// ========================================
adminPages.get('/admin/users', (c) => {
  const content = `
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">
          <i class="fas fa-users mr-2"></i>ユーザー管理
        </h2>
        <p class="text-gray-600 mt-1">登録ユーザーの一覧と管理</p>
      </div>
    </div>
    
    <!-- フィルター -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">検索</label>
          <input type="text" id="searchInput" placeholder="メール or 名前" 
                 class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ロール</label>
          <select id="roleFilter" class="w-full border rounded px-3 py-2">
            <option value="">すべて</option>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
          <select id="statusFilter" class="w-full border rounded px-3 py-2">
            <option value="">すべて</option>
            <option value="active">アクティブ</option>
            <option value="disabled">凍結中</option>
            <option value="locked">ロック中</option>
          </select>
        </div>
        <div class="flex items-end">
          <button onclick="loadUsers()" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
    </div>
    
    <!-- ユーザーテーブル -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ロール</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最終ログイン</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody id="usersTable" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- ページネーション -->
      <div class="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
        <div class="text-sm text-gray-500" id="paginationInfo">-</div>
        <div class="flex gap-2" id="paginationButtons"></div>
      </div>
    </div>
    
    <!-- ユーザー詳細モーダル -->
    <div id="userModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">ユーザー詳細</h3>
          <button onclick="closeUserModal()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="userModalContent" class="p-4">
          <!-- 動的に挿入 -->
        </div>
      </div>
    </div>
    
    <script>
      let currentPage = 0;
      const pageSize = 20;
      let totalUsers = 0;
      
      async function loadUsers() {
        const search = document.getElementById('searchInput').value;
        const role = document.getElementById('roleFilter').value;
        const status = document.getElementById('statusFilter').value;
        
        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: (currentPage * pageSize).toString(),
        });
        if (search) params.append('search', search);
        if (role) params.append('role', role);
        if (status) params.append('status', status);
        
        const data = await apiCall('/admin/users?' + params.toString());
        if (!data?.success) return;
        
        const { users, pagination } = data.data;
        totalUsers = pagination.total;
        
        if (users.length === 0) {
          document.getElementById('usersTable').innerHTML = \`
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                ユーザーが見つかりません
              </td>
            </tr>
          \`;
        } else {
          document.getElementById('usersTable').innerHTML = users.map(u => \`
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-gray-500 text-sm"></i>
                  </div>
                  <div class="ml-3">
                    <p class="font-medium text-gray-900">\${escapeHtml(u.name) || '(未設定)'}</p>
                    <p class="text-sm text-gray-500">\${escapeHtml(u.email)}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded text-xs font-medium \${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
                  \${u.role}
                </span>
              </td>
              <td class="px-4 py-3">
                \${getStatusBadge(u)}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                \${formatDate(u.last_login_at)}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                \${formatDate(u.created_at)}
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <button onclick="showUserDetail('\${u.id}')" class="text-blue-600 hover:text-blue-800" title="詳細">
                    <i class="fas fa-eye"></i>
                  </button>
                  \${u.is_disabled ? \`
                    <button onclick="enableUser('\${u.id}')" class="text-green-600 hover:text-green-800" title="復活">
                      <i class="fas fa-user-check"></i>
                    </button>
                  \` : \`
                    <button onclick="disableUser('\${u.id}')" class="text-red-600 hover:text-red-800" title="凍結">
                      <i class="fas fa-user-slash"></i>
                    </button>
                  \`}
                  <button onclick="resetUserPassword('\${u.id}')" class="text-yellow-600 hover:text-yellow-800" title="パスワード再発行">
                    <i class="fas fa-key"></i>
                  </button>
                </div>
              </td>
            </tr>
          \`).join('');
        }
        
        // ページネーション
        document.getElementById('paginationInfo').textContent = 
          \`\${pagination.offset + 1} - \${Math.min(pagination.offset + pageSize, pagination.total)} / \${pagination.total}件\`;
        
        const totalPages = Math.ceil(pagination.total / pageSize);
        let paginationHtml = '';
        if (currentPage > 0) {
          paginationHtml += '<button onclick="goToPage(' + (currentPage - 1) + ')" class="px-3 py-1 border rounded hover:bg-gray-100">前へ</button>';
        }
        if (currentPage < totalPages - 1) {
          paginationHtml += '<button onclick="goToPage(' + (currentPage + 1) + ')" class="px-3 py-1 border rounded hover:bg-gray-100">次へ</button>';
        }
        document.getElementById('paginationButtons').innerHTML = paginationHtml;
      }
      
      function getStatusBadge(user) {
        if (user.is_disabled) {
          return '<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">凍結中</span>';
        }
        if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
          return '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">ロック中</span>';
        }
        return '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">アクティブ</span>';
      }
      
      function goToPage(page) {
        currentPage = page;
        loadUsers();
      }
      
      async function showUserDetail(userId) {
        const data = await apiCall('/admin/users/' + userId);
        if (!data?.success) return;
        
        const { user, companies, recent_audit } = data.data;
        
        document.getElementById('userModalContent').innerHTML = \`
          <div class="space-y-6">
            <!-- 基本情報 -->
            <div>
              <h4 class="font-medium text-gray-700 mb-2">基本情報</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-gray-500">メールアドレス</p>
                  <p class="font-medium">\${escapeHtml(user.email)}</p>
                </div>
                <div>
                  <p class="text-gray-500">名前</p>
                  <p class="font-medium">\${escapeHtml(user.name) || '(未設定)'}</p>
                </div>
                <div>
                  <p class="text-gray-500">ロール</p>
                  <p class="font-medium">\${user.role}</p>
                </div>
                <div>
                  <p class="text-gray-500">ステータス</p>
                  \${getStatusBadge(user)}
                </div>
                <div>
                  <p class="text-gray-500">登録日</p>
                  <p class="font-medium">\${formatDate(user.created_at)}</p>
                </div>
                <div>
                  <p class="text-gray-500">最終ログイン</p>
                  <p class="font-medium">\${formatDate(user.last_login_at)}</p>
                </div>
              </div>
            </div>
            
            \${user.is_disabled ? \`
              <div class="p-4 bg-red-50 rounded border border-red-200">
                <p class="text-red-800 font-medium">凍結中</p>
                <p class="text-sm text-red-600">理由: \${escapeHtml(user.disabled_reason) || '(未記載)'}</p>
                <p class="text-sm text-red-600">凍結日時: \${formatDate(user.disabled_at)}</p>
              </div>
            \` : ''}
            
            <!-- 所属会社 -->
            <div>
              <h4 class="font-medium text-gray-700 mb-2">所属会社</h4>
              \${companies.length > 0 ? \`
                <ul class="space-y-2">
                  \${companies.map(c => \`
                    <li class="p-3 bg-gray-50 rounded">
                      <p class="font-medium">\${escapeHtml(c.name)}</p>
                      <p class="text-sm text-gray-500">\${c.prefecture} / \${c.industry_major} / \${c.employee_count}名</p>
                    </li>
                  \`).join('')}
                </ul>
              \` : '<p class="text-gray-500">所属会社なし</p>'}
            </div>
            
            <!-- 最近の監査ログ -->
            <div>
              <h4 class="font-medium text-gray-700 mb-2">最近のアクティビティ</h4>
              \${recent_audit.length > 0 ? \`
                <ul class="space-y-2 text-sm">
                  \${recent_audit.map(a => \`
                    <li class="flex justify-between items-center py-1 border-b last:border-0">
                      <span class="px-2 py-1 rounded text-xs \${getSeverityClass(a.severity)}">\${a.action}</span>
                      <span class="text-gray-400">\${formatDate(a.created_at)}</span>
                    </li>
                  \`).join('')}
                </ul>
              \` : '<p class="text-gray-500">アクティビティなし</p>'}
            </div>
          </div>
        \`;
        
        document.getElementById('userModal').classList.remove('hidden');
      }
      
      function getSeverityClass(severity) {
        switch (severity) {
          case 'critical': return 'bg-red-100 text-red-800';
          case 'warning': return 'bg-yellow-100 text-yellow-800';
          default: return 'bg-blue-100 text-blue-800';
        }
      }
      
      function closeUserModal() {
        document.getElementById('userModal').classList.add('hidden');
      }
      
      async function disableUser(userId) {
        const reason = prompt('凍結理由を入力してください:');
        if (!reason) return;
        
        const data = await apiCall('/admin/users/' + userId + '/disable', {
          method: 'PUT',
          body: JSON.stringify({ reason }),
        });
        
        if (data?.success) {
          alert('ユーザーを凍結しました');
          loadUsers();
        } else {
          alert('エラー: ' + (data?.error?.message || '不明なエラー'));
        }
      }
      
      async function enableUser(userId) {
        if (!confirm('このユーザーを復活させますか？')) return;
        
        const data = await apiCall('/admin/users/' + userId + '/enable', {
          method: 'PUT',
        });
        
        if (data?.success) {
          alert('ユーザーを復活しました');
          loadUsers();
        } else {
          alert('エラー: ' + (data?.error?.message || '不明なエラー'));
        }
      }
      
      async function resetUserPassword(userId) {
        if (!confirm('このユーザーのパスワードを再発行しますか？')) return;
        
        const data = await apiCall('/admin/users/' + userId + '/reset-password', {
          method: 'POST',
        });
        
        if (data?.success) {
          const { reset_url, expires_at } = data.data;
          alert('パスワードリセットリンクを生成しました:\\n\\n' + reset_url + '\\n\\n有効期限: ' + formatDate(expires_at));
        } else {
          alert('エラー: ' + (data?.error?.message || '不明なエラー'));
        }
      }
      
      // 初期読み込み
      loadUsers();
    </script>
  `;
  
  return c.html(AdminLayout({ title: 'ユーザー管理', children: content }));
});

// ========================================
// KPIモニター
// ========================================
adminPages.get('/admin/kpi', (c) => {
  const content = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-tachometer-alt mr-2"></i>KPIモニター
      </h2>
      <p class="text-gray-600 mt-1">クロールパイプラインの稼働状況</p>
    </div>
    
    <!-- キュー状況 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h3 class="text-lg font-semibold mb-4">
        <i class="fas fa-tasks text-blue-500 mr-2"></i>キュー状況
      </h3>
      <div id="queueStats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="animate-pulse h-20 bg-gray-200 rounded"></div>
        <div class="animate-pulse h-20 bg-gray-200 rounded"></div>
        <div class="animate-pulse h-20 bg-gray-200 rounded"></div>
        <div class="animate-pulse h-20 bg-gray-200 rounded"></div>
      </div>
    </div>
    
    <!-- 日次集計 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">
          <i class="fas fa-chart-line text-green-500 mr-2"></i>日次集計
        </h3>
        <select id="dailyDays" onchange="loadDaily()" class="border rounded px-3 py-1">
          <option value="7">7日間</option>
          <option value="14" selected>14日間</option>
          <option value="30">30日間</option>
        </select>
      </div>
      <div id="dailyStats">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 rounded"></div>
          <div class="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
    
    <!-- ドメイン別状況 -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="p-4 border-b flex justify-between items-center">
        <h3 class="text-lg font-semibold">
          <i class="fas fa-globe text-purple-500 mr-2"></i>ドメイン別状況
        </h3>
        <button onclick="loadDomains()" class="text-blue-600 hover:text-blue-800">
          <i class="fas fa-sync-alt"></i> 更新
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ドメイン</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">キュー</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成功/失敗</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">失敗率</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最終成功</th>
            </tr>
          </thead>
          <tbody id="domainsTable" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <script>
      async function loadQueue() {
        const data = await apiCall('/kpi/queue');
        if (!data?.success) return;
        
        const q = data.data;
        const counts = q.counts_by_status || {};
        
        document.getElementById('queueStats').innerHTML = \`
          <div class="p-4 bg-yellow-50 rounded">
            <p class="text-sm text-yellow-600">待機中</p>
            <p class="text-2xl font-bold text-yellow-700">\${counts.queued || 0}</p>
            \${q.avg_wait_sec_queued ? \`<p class="text-xs text-yellow-500">平均 \${Math.round(q.avg_wait_sec_queued)}秒</p>\` : ''}
          </div>
          <div class="p-4 bg-blue-50 rounded">
            <p class="text-sm text-blue-600">処理中</p>
            <p class="text-2xl font-bold text-blue-700">\${counts.started || 0}</p>
          </div>
          <div class="p-4 bg-green-50 rounded">
            <p class="text-sm text-green-600">完了</p>
            <p class="text-2xl font-bold text-green-700">\${counts.done || 0}</p>
            \${q.avg_duration_sec_done ? \`<p class="text-xs text-green-500">平均 \${Math.round(q.avg_duration_sec_done)}秒</p>\` : ''}
          </div>
          <div class="p-4 bg-red-50 rounded">
            <p class="text-sm text-red-600">エラー</p>
            <p class="text-2xl font-bold text-red-700">\${counts.error || 0}</p>
          </div>
        \`;
      }
      
      async function loadDaily() {
        const days = document.getElementById('dailyDays').value;
        const data = await apiCall('/kpi/daily?days=' + days);
        if (!data?.success) return;
        
        const d = data.data;
        document.getElementById('dailyStats').innerHTML = \`
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="text-center p-3 bg-gray-50 rounded">
              <p class="text-2xl font-bold text-gray-800">\${d.total_picked || 0}</p>
              <p class="text-sm text-gray-500">取得</p>
            </div>
            <div class="text-center p-3 bg-green-50 rounded">
              <p class="text-2xl font-bold text-green-700">\${d.total_succeeded || 0}</p>
              <p class="text-sm text-gray-500">成功</p>
            </div>
            <div class="text-center p-3 bg-red-50 rounded">
              <p class="text-2xl font-bold text-red-700">\${d.total_failed || 0}</p>
              <p class="text-sm text-gray-500">失敗</p>
            </div>
            <div class="text-center p-3 bg-yellow-50 rounded">
              <p class="text-2xl font-bold text-yellow-700">\${d.total_retried || 0}</p>
              <p class="text-sm text-gray-500">リトライ</p>
            </div>
            <div class="text-center p-3 bg-purple-50 rounded">
              <p class="text-2xl font-bold text-purple-700">\${d.domains_blocked || 0}</p>
              <p class="text-sm text-gray-500">ブロック</p>
            </div>
          </div>
          
          \${d.rows && d.rows.length > 0 ? \`
            <div class="mt-4 overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="py-2 text-left">日付</th>
                    <th class="py-2 text-right">取得</th>
                    <th class="py-2 text-right">成功</th>
                    <th class="py-2 text-right">失敗</th>
                    <th class="py-2 text-right">リトライ</th>
                  </tr>
                </thead>
                <tbody>
                  \${d.rows.map(r => \`
                    <tr class="border-b hover:bg-gray-50">
                      <td class="py-2">\${r.date}</td>
                      <td class="py-2 text-right">\${r.picked}</td>
                      <td class="py-2 text-right text-green-600">\${r.succeeded}</td>
                      <td class="py-2 text-right text-red-600">\${r.failed}</td>
                      <td class="py-2 text-right text-yellow-600">\${r.retried}</td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          \` : ''}
        \`;
      }
      
      async function loadDomains() {
        const data = await apiCall('/kpi/domains?days=14&limit=50');
        if (!data?.success) return;
        
        const domains = data.data.domains || [];
        
        if (domains.length === 0) {
          document.getElementById('domainsTable').innerHTML = \`
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">ドメインデータがありません</td></tr>
          \`;
          return;
        }
        
        document.getElementById('domainsTable').innerHTML = domains.map(d => \`
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <p class="font-medium">\${escapeHtml(d.domain_key)}</p>
            </td>
            <td class="px-4 py-3">
              \${d.enabled ? 
                '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">有効</span>' :
                '<span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">ブロック</span>'
              }
            </td>
            <td class="px-4 py-3 text-sm">
              <span class="text-yellow-600">\${d.queued || 0}</span> /
              <span class="text-blue-600">\${d.running || 0}</span>
            </td>
            <td class="px-4 py-3 text-sm">
              <span class="text-green-600">\${d.succeeded || 0}</span> /
              <span class="text-red-600">\${d.failed || 0}</span>
            </td>
            <td class="px-4 py-3">
              \${d.failure_rate_pct !== null ? \`
                <span class="\${d.failure_rate_pct > 50 ? 'text-red-600' : d.failure_rate_pct > 20 ? 'text-yellow-600' : 'text-green-600'} font-medium">
                  \${d.failure_rate_pct.toFixed(1)}%
                </span>
              \` : '-'}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              \${formatDate(d.last_success_at)}
            </td>
          </tr>
        \`).join('');
      }
      
      // 初期読み込み
      loadQueue();
      loadDaily();
      loadDomains();
      
      // 30秒ごとに更新
      setInterval(() => {
        loadQueue();
      }, 30000);
    </script>
  `;
  
  return c.html(AdminLayout({ title: 'KPIモニター', children: content }));
});

// ========================================
// 監査ログ
// ========================================
adminPages.get('/admin/audit', (c) => {
  const content = `
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-history mr-2"></i>監査ログ
      </h2>
      <p class="text-gray-600 mt-1">システム操作の履歴と監査証跡</p>
    </div>
    
    <!-- フィルター -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
          <select id="categoryFilter" class="w-full border rounded px-3 py-2">
            <option value="">すべて</option>
            <option value="auth">auth</option>
            <option value="admin">admin</option>
            <option value="data">data</option>
            <option value="system">system</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">重要度</label>
          <select id="severityFilter" class="w-full border rounded px-3 py-2">
            <option value="">すべて</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">アクション</label>
          <input type="text" id="actionFilter" placeholder="例: LOGIN" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">期間</label>
          <select id="daysFilter" class="w-full border rounded px-3 py-2">
            <option value="7">7日間</option>
            <option value="14">14日間</option>
            <option value="30" selected>30日間</option>
            <option value="90">90日間</option>
          </select>
        </div>
        <div class="flex items-end">
          <button onclick="loadAuditLogs()" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
    </div>
    
    <!-- ログテーブル -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日時</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">アクション</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">重要度</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">実行者</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">対象</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳細</th>
            </tr>
          </thead>
          <tbody id="auditTable" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- ページネーション -->
      <div class="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
        <div class="text-sm text-gray-500" id="auditPaginationInfo">-</div>
        <div class="flex gap-2" id="auditPaginationButtons"></div>
      </div>
    </div>
    
    <script>
      let auditPage = 0;
      const auditPageSize = 50;
      
      async function loadAuditLogs() {
        const category = document.getElementById('categoryFilter').value;
        const severity = document.getElementById('severityFilter').value;
        const action = document.getElementById('actionFilter').value;
        const days = document.getElementById('daysFilter').value;
        
        const params = new URLSearchParams({
          limit: auditPageSize.toString(),
          offset: (auditPage * auditPageSize).toString(),
          days: days,
        });
        if (category) params.append('category', category);
        if (severity) params.append('severity', severity);
        if (action) params.append('action', action);
        
        const data = await apiCall('/admin/audit?' + params.toString());
        if (!data?.success) return;
        
        const { logs, pagination } = data.data;
        
        if (logs.length === 0) {
          document.getElementById('auditTable').innerHTML = \`
            <tr>
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                ログが見つかりません
              </td>
            </tr>
          \`;
        } else {
          document.getElementById('auditTable').innerHTML = logs.map(log => \`
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                \${formatDate(log.created_at)}
              </td>
              <td class="px-4 py-3">
                <span class="font-mono text-sm">\${escapeHtml(log.action)}</span>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">\${log.action_category}</span>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded text-xs \${getSeverityClass(log.severity)}">\${log.severity}</span>
              </td>
              <td class="px-4 py-3 text-sm">
                \${escapeHtml(log.actor_email) || '<span class="text-gray-400">システム</span>'}
              </td>
              <td class="px-4 py-3 text-sm">
                \${escapeHtml(log.target_email) || '<span class="text-gray-400">-</span>'}
              </td>
              <td class="px-4 py-3">
                \${log.details_json ? \`
                  <button onclick="showDetails('\${escapeHtml(log.details_json).replace(/'/g, "\\\\'")}')\" 
                          class="text-blue-600 hover:text-blue-800 text-sm">
                    <i class="fas fa-info-circle"></i>
                  </button>
                \` : '-'}
              </td>
            </tr>
          \`).join('');
        }
        
        // ページネーション
        document.getElementById('auditPaginationInfo').textContent = 
          \`\${pagination.offset + 1} - \${Math.min(pagination.offset + auditPageSize, pagination.total)} / \${pagination.total}件\`;
        
        const totalPages = Math.ceil(pagination.total / auditPageSize);
        let paginationHtml = '';
        if (auditPage > 0) {
          paginationHtml += '<button onclick="goToAuditPage(' + (auditPage - 1) + ')" class="px-3 py-1 border rounded hover:bg-gray-100">前へ</button>';
        }
        if (auditPage < totalPages - 1) {
          paginationHtml += '<button onclick="goToAuditPage(' + (auditPage + 1) + ')" class="px-3 py-1 border rounded hover:bg-gray-100">次へ</button>';
        }
        document.getElementById('auditPaginationButtons').innerHTML = paginationHtml;
      }
      
      function getSeverityClass(severity) {
        switch (severity) {
          case 'critical': return 'bg-red-100 text-red-800';
          case 'warning': return 'bg-yellow-100 text-yellow-800';
          default: return 'bg-blue-100 text-blue-800';
        }
      }
      
      function goToAuditPage(page) {
        auditPage = page;
        loadAuditLogs();
      }
      
      function showDetails(jsonStr) {
        try {
          const obj = JSON.parse(jsonStr);
          alert(JSON.stringify(obj, null, 2));
        } catch {
          alert(jsonStr);
        }
      }
      
      // 初期読み込み
      loadAuditLogs();
    </script>
  `;
  
  return c.html(AdminLayout({ title: '監査ログ', children: content }));
});

export default adminPages;

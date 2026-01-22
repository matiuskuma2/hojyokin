/**
 * 管理画面ページ (U2)
 * 
 * /admin - 管理ダッシュボード
 * /admin/users - ユーザー一覧・管理
 * /admin/kpi - KPI ダッシュボード
 * /admin/audit - 監査ログ閲覧
 */

import { Hono } from 'hono';
import { jsxRenderer } from 'hono/jsx-renderer';
import type { Env, Variables } from '../types';

const adminPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// JSXレンダラー
const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>管理画面 | ホジョラク</title>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body class="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
});

adminPages.use('*', renderer);

// 管理ダッシュボード
adminPages.get('/admin', (c) => {
  return c.render(
    <div class="min-h-screen">
      {/* Navigation */}
      <nav class="bg-indigo-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center gap-4">
              <a href="/admin" class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-shield-halved"></i>
                管理画面
              </a>
              <div class="hidden md:flex gap-4 ml-8">
                <a href="/admin/users" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-users mr-1"></i>ユーザー
                </a>
                <a href="/admin/kpi" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-chart-line mr-1"></i>KPI
                </a>
                <a href="/admin/audit" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-clipboard-list mr-1"></i>監査ログ
                </a>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <a href="/dashboard" class="text-sm hover:text-indigo-200">
                <i class="fas fa-arrow-left mr-1"></i>ユーザー画面へ
              </a>
              <button onclick="logout()" class="px-3 py-2 rounded-md hover:bg-indigo-700 text-sm">
                <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-8">管理ダッシュボード</h1>
        
        {/* Quick Stats */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div id="stat-users" class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-blue-500 rounded-lg p-3">
                <i class="fas fa-users text-white text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">総ユーザー数</p>
                <p class="text-2xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </div>
          
          <div id="stat-queue" class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-yellow-500 rounded-lg p-3">
                <i class="fas fa-clock text-white text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">キュー待機中</p>
                <p class="text-2xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </div>
          
          <div id="stat-success" class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-green-500 rounded-lg p-3">
                <i class="fas fa-check text-white text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">成功（24h）</p>
                <p class="text-2xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </div>
          
          <div id="stat-failed" class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-red-500 rounded-lg p-3">
                <i class="fas fa-exclamation text-white text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">失敗（24h）</p>
                <p class="text-2xl font-bold text-gray-900">-</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Links */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a href="/admin/users" class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <h2 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <i class="fas fa-users text-blue-500"></i>
              ユーザー管理
            </h2>
            <p class="text-gray-600 text-sm">ユーザーの一覧表示、凍結・復活、パスワードリセット</p>
          </a>
          
          <a href="/admin/kpi" class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <h2 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <i class="fas fa-chart-line text-green-500"></i>
              KPI ダッシュボード
            </h2>
            <p class="text-gray-600 text-sm">クロールの日次集計、ドメイン別状況、キュー滞留</p>
          </a>
          
          <a href="/admin/audit" class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <h2 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <i class="fas fa-clipboard-list text-purple-500"></i>
              監査ログ
            </h2>
            <p class="text-gray-600 text-sm">認証・管理操作・データ変更の履歴確認</p>
          </a>
        </div>
      </main>

      <script dangerouslySetInnerHTML={{
        __html: `
          const token = localStorage.getItem('token');
          if (!token) {
            window.location.href = '/login';
          }
          
          function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          
          // Check admin role
          async function checkAdmin() {
            try {
              const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const data = await res.json();
              if (!data.success || (data.data.role !== 'admin' && data.data.role !== 'super_admin')) {
                alert('管理者権限が必要です');
                window.location.href = '/dashboard';
              }
            } catch (err) {
              window.location.href = '/login';
            }
          }
          
          // Load stats
          async function loadStats() {
            try {
              // Users count
              const usersRes = await fetch('/api/admin/users?limit=1', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const usersData = await usersRes.json();
              if (usersData.success) {
                document.querySelector('#stat-users p.text-2xl').textContent = usersData.data.pagination.total;
              }
              
              // KPI queue
              const queueRes = await fetch('/api/kpi/queue', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const queueData = await queueRes.json();
              if (queueData.success) {
                const queued = queueData.data.counts_by_status?.queued || 0;
                document.querySelector('#stat-queue p.text-2xl').textContent = queued;
              }
              
              // KPI daily
              const dailyRes = await fetch('/api/kpi/daily?days=1', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const dailyData = await dailyRes.json();
              if (dailyData.success && dailyData.data.rows && dailyData.data.rows.length > 0) {
                const today = dailyData.data.rows[0];
                document.querySelector('#stat-success p.text-2xl').textContent = today.succeeded || 0;
                document.querySelector('#stat-failed p.text-2xl').textContent = today.failed || 0;
              }
            } catch (err) {
              console.error('Failed to load stats:', err);
            }
          }
          
          checkAdmin();
          loadStats();
        `
      }} />
    </div>
  );
});

// ユーザー管理ページ
adminPages.get('/admin/users', (c) => {
  return c.render(
    <div class="min-h-screen">
      {/* Navigation */}
      <nav class="bg-indigo-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center gap-4">
              <a href="/admin" class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-shield-halved"></i>
                管理画面
              </a>
              <div class="hidden md:flex gap-4 ml-8">
                <a href="/admin/users" class="px-3 py-2 rounded-md bg-indigo-900">
                  <i class="fas fa-users mr-1"></i>ユーザー
                </a>
                <a href="/admin/kpi" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-chart-line mr-1"></i>KPI
                </a>
                <a href="/admin/audit" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-clipboard-list mr-1"></i>監査ログ
                </a>
              </div>
            </div>
            <button onclick="logout()" class="px-3 py-2 rounded-md hover:bg-indigo-700 text-sm">
              <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold text-gray-800">ユーザー管理</h1>
        </div>
        
        {/* Filters */}
        <div class="bg-white rounded-lg shadow p-4 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">検索</label>
              <input type="text" id="search" placeholder="メールまたは名前" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">ロール</label>
              <select id="role" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">すべて</option>
                <option value="user">ユーザー</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">状態</label>
              <select id="status" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">すべて</option>
                <option value="active">有効</option>
                <option value="disabled">凍結</option>
              </select>
            </div>
            <div class="flex items-end">
              <button onclick="loadUsers(1)" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                <i class="fas fa-search mr-1"></i>検索
              </button>
            </div>
          </div>
        </div>
        
        {/* User List */}
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ロール</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状態</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最終ログイン</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">登録日</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody id="users-table" class="bg-white divide-y divide-gray-200">
              <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">読み込み中...</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div id="pagination" class="mt-4 flex justify-between items-center"></div>
      </main>

      {/* User Detail Modal */}
      <div id="user-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <h2 class="text-xl font-bold text-gray-800">ユーザー詳細</h2>
              <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>
            <div id="modal-content"></div>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          const token = localStorage.getItem('token');
          if (!token) window.location.href = '/login';
          
          let currentPage = 1;
          
          function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          
          async function loadUsers(page = 1) {
            currentPage = page;
            const search = document.getElementById('search').value;
            const role = document.getElementById('role').value;
            const status = document.getElementById('status').value;
            
            const params = new URLSearchParams({ page, limit: 20 });
            if (search) params.append('search', search);
            if (role) params.append('role', role);
            if (status) params.append('status', status);
            
            try {
              const res = await fetch('/api/admin/users?' + params, {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const data = await res.json();
              
              if (!data.success) {
                if (res.status === 403) {
                  alert('管理者権限が必要です');
                  window.location.href = '/dashboard';
                  return;
                }
                throw new Error(data.error?.message || 'Failed to load users');
              }
              
              renderUsers(data.data.users);
              renderPagination(data.data.pagination);
            } catch (err) {
              console.error(err);
              document.getElementById('users-table').innerHTML = 
                '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">エラー: ' + err.message + '</td></tr>';
            }
          }
          
          function renderUsers(users) {
            const tbody = document.getElementById('users-table');
            if (users.length === 0) {
              tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">ユーザーがいません</td></tr>';
              return;
            }
            
            tbody.innerHTML = users.map(user => {
              const statusBadge = user.is_disabled 
                ? '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">凍結</span>'
                : '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">有効</span>';
              const roleBadge = user.role === 'admin' 
                ? '<span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">管理者</span>'
                : '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">ユーザー</span>';
              
              return '<tr class="hover:bg-gray-50">' +
                '<td class="px-6 py-4">' +
                  '<div class="text-sm font-medium text-gray-900">' + (user.name || '-') + '</div>' +
                  '<div class="text-sm text-gray-500">' + user.email + '</div>' +
                '</td>' +
                '<td class="px-6 py-4">' + roleBadge + '</td>' +
                '<td class="px-6 py-4">' + statusBadge + '</td>' +
                '<td class="px-6 py-4 text-sm text-gray-500">' + 
                  (user.last_login_at ? new Date(user.last_login_at).toLocaleString('ja-JP') : '-') + 
                '</td>' +
                '<td class="px-6 py-4 text-sm text-gray-500">' + 
                  new Date(user.created_at).toLocaleDateString('ja-JP') + 
                '</td>' +
                '<td class="px-6 py-4">' +
                  '<button onclick="showUserDetail(\\'' + user.id + '\\')" class="text-indigo-600 hover:text-indigo-900 mr-3">' +
                    '<i class="fas fa-eye"></i>' +
                  '</button>' +
                  (user.is_disabled 
                    ? '<button onclick="enableUser(\\'' + user.id + '\\')" class="text-green-600 hover:text-green-900 mr-3" title="復活"><i class="fas fa-user-check"></i></button>'
                    : '<button onclick="disableUser(\\'' + user.id + '\\')" class="text-red-600 hover:text-red-900 mr-3" title="凍結"><i class="fas fa-user-slash"></i></button>'
                  ) +
                  '<button onclick="resetPassword(\\'' + user.id + '\\')" class="text-yellow-600 hover:text-yellow-900" title="パスワードリセット"><i class="fas fa-key"></i></button>' +
                '</td>' +
              '</tr>';
            }).join('');
          }
          
          function renderPagination(pagination) {
            const div = document.getElementById('pagination');
            div.innerHTML = 
              '<div class="text-sm text-gray-700">' +
                '全 ' + pagination.total + ' 件中 ' + 
                ((pagination.page - 1) * pagination.limit + 1) + '-' + 
                Math.min(pagination.page * pagination.limit, pagination.total) + ' 件表示' +
              '</div>' +
              '<div class="flex gap-2">' +
                (pagination.page > 1 
                  ? '<button onclick="loadUsers(' + (pagination.page - 1) + ')" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">前へ</button>'
                  : ''
                ) +
                '<span class="px-3 py-1 bg-indigo-600 text-white rounded">' + pagination.page + '</span>' +
                (pagination.page < pagination.totalPages 
                  ? '<button onclick="loadUsers(' + (pagination.page + 1) + ')" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">次へ</button>'
                  : ''
                ) +
              '</div>';
          }
          
          async function showUserDetail(userId) {
            try {
              const res = await fetch('/api/admin/users/' + userId, {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error?.message);
              
              const user = data.data.user;
              const logs = data.data.recentAuditLogs || [];
              
              document.getElementById('modal-content').innerHTML = 
                '<div class="space-y-4">' +
                  '<div class="grid grid-cols-2 gap-4">' +
                    '<div><span class="text-gray-500">ID:</span> <span class="font-mono text-sm">' + user.id + '</span></div>' +
                    '<div><span class="text-gray-500">メール:</span> ' + user.email + '</div>' +
                    '<div><span class="text-gray-500">名前:</span> ' + (user.name || '-') + '</div>' +
                    '<div><span class="text-gray-500">ロール:</span> ' + user.role + '</div>' +
                    '<div><span class="text-gray-500">状態:</span> ' + (user.is_disabled ? '凍結' : '有効') + '</div>' +
                    '<div><span class="text-gray-500">最終ログイン:</span> ' + (user.last_login_at ? new Date(user.last_login_at).toLocaleString('ja-JP') : '-') + '</div>' +
                    '<div><span class="text-gray-500">登録日:</span> ' + new Date(user.created_at).toLocaleString('ja-JP') + '</div>' +
                    '<div><span class="text-gray-500">ログイン失敗:</span> ' + (user.failed_login_attempts || 0) + '回</div>' +
                  '</div>' +
                  (user.disabled_reason ? '<div class="bg-red-50 p-3 rounded"><span class="text-red-700">凍結理由:</span> ' + user.disabled_reason + '</div>' : '') +
                  '<hr class="my-4" />' +
                  '<h3 class="font-semibold">直近の監査ログ</h3>' +
                  '<div class="space-y-2 max-h-48 overflow-y-auto">' +
                    (logs.length > 0 
                      ? logs.map(log => 
                          '<div class="text-sm p-2 bg-gray-50 rounded">' +
                            '<span class="' + (log.severity === 'warning' ? 'text-yellow-600' : log.severity === 'critical' ? 'text-red-600' : 'text-gray-600') + '">' +
                              log.action + 
                            '</span>' +
                            ' - ' + new Date(log.created_at).toLocaleString('ja-JP') +
                          '</div>'
                        ).join('')
                      : '<div class="text-gray-500">ログなし</div>'
                    ) +
                  '</div>' +
                '</div>';
              
              document.getElementById('user-modal').classList.remove('hidden');
              document.getElementById('user-modal').classList.add('flex');
            } catch (err) {
              alert('ユーザー詳細の取得に失敗しました: ' + err.message);
            }
          }
          
          function closeModal() {
            document.getElementById('user-modal').classList.add('hidden');
            document.getElementById('user-modal').classList.remove('flex');
          }
          
          async function disableUser(userId) {
            const reason = prompt('凍結理由を入力してください:');
            if (reason === null) return;
            
            try {
              const res = await fetch('/api/admin/users/' + userId + '/disable', {
                method: 'POST',
                headers: { 
                  'Authorization': 'Bearer ' + token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error?.message);
              
              alert('ユーザーを凍結しました');
              loadUsers(currentPage);
            } catch (err) {
              alert('凍結に失敗しました: ' + err.message);
            }
          }
          
          async function enableUser(userId) {
            if (!confirm('このユーザーを復活させますか？')) return;
            
            try {
              const res = await fetch('/api/admin/users/' + userId + '/enable', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error?.message);
              
              alert('ユーザーを復活させました');
              loadUsers(currentPage);
            } catch (err) {
              alert('復活に失敗しました: ' + err.message);
            }
          }
          
          async function resetPassword(userId) {
            if (!confirm('このユーザーのパスワードリセットトークンを発行しますか？')) return;
            
            try {
              const res = await fetch('/api/admin/users/' + userId + '/reset-password', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error?.message);
              
              const resetUrl = window.location.origin + '/reset?token=' + data.data.resetToken;
              alert('パスワードリセットURL:\\n' + resetUrl + '\\n\\n有効期限: ' + new Date(data.data.expiresAt).toLocaleString('ja-JP'));
            } catch (err) {
              alert('リセットトークンの発行に失敗しました: ' + err.message);
            }
          }
          
          // Initial load
          loadUsers();
        `
      }} />
    </div>
  );
});

// KPI ダッシュボードページ
adminPages.get('/admin/kpi', (c) => {
  return c.render(
    <div class="min-h-screen">
      {/* Navigation */}
      <nav class="bg-indigo-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center gap-4">
              <a href="/admin" class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-shield-halved"></i>
                管理画面
              </a>
              <div class="hidden md:flex gap-4 ml-8">
                <a href="/admin/users" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-users mr-1"></i>ユーザー
                </a>
                <a href="/admin/kpi" class="px-3 py-2 rounded-md bg-indigo-900">
                  <i class="fas fa-chart-line mr-1"></i>KPI
                </a>
                <a href="/admin/audit" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-clipboard-list mr-1"></i>監査ログ
                </a>
              </div>
            </div>
            <button onclick="logout()" class="px-3 py-2 rounded-md hover:bg-indigo-700 text-sm">
              <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold text-gray-800">KPI ダッシュボード</h1>
          <div class="flex gap-2">
            <select id="days" class="px-3 py-2 border border-gray-300 rounded-md" onchange="loadKPI()">
              <option value="7">7日間</option>
              <option value="14" selected>14日間</option>
              <option value="30">30日間</option>
            </select>
            <button onclick="loadKPI()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              <i class="fas fa-sync-alt mr-1"></i>更新
            </button>
          </div>
        </div>
        
        {/* Queue Status */}
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-tasks text-blue-500"></i>
            キュー状況
          </h2>
          <div id="queue-stats" class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="text-center p-4 bg-gray-50 rounded">
              <div class="text-2xl font-bold text-yellow-600">-</div>
              <div class="text-sm text-gray-600">待機中</div>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded">
              <div class="text-2xl font-bold text-blue-600">-</div>
              <div class="text-sm text-gray-600">処理中</div>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded">
              <div class="text-2xl font-bold text-green-600">-</div>
              <div class="text-sm text-gray-600">完了</div>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded">
              <div class="text-2xl font-bold text-red-600">-</div>
              <div class="text-sm text-gray-600">失敗</div>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded">
              <div class="text-2xl font-bold text-gray-600">-</div>
              <div class="text-sm text-gray-600">平均待機(秒)</div>
            </div>
          </div>
          <div id="oldest-queued" class="mt-4 text-sm text-gray-600"></div>
        </div>
        
        {/* Daily Chart */}
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-chart-bar text-green-500"></i>
            日次集計
          </h2>
          <div id="daily-table" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">日付</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">Picked</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">成功</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">失敗</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">リトライ</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">ブロック</th>
                </tr>
              </thead>
              <tbody id="daily-tbody" class="divide-y divide-gray-200">
                <tr><td colspan="6" class="px-4 py-4 text-center text-gray-500">読み込み中...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Domain Status */}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-globe text-purple-500"></i>
            ドメイン別状況
          </h2>
          <div id="domains-table" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">ドメイン</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-gray-500">状態</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">成功</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">失敗</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">待機中</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">失敗率</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">平均時間</th>
                </tr>
              </thead>
              <tbody id="domains-tbody" class="divide-y divide-gray-200">
                <tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">読み込み中...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <script dangerouslySetInnerHTML={{
        __html: `
          const token = localStorage.getItem('token');
          if (!token) window.location.href = '/login';
          
          function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          
          async function loadKPI() {
            const days = document.getElementById('days').value;
            
            try {
              // Queue
              const queueRes = await fetch('/api/kpi/queue', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const queueData = await queueRes.json();
              if (queueData.success) {
                const counts = queueData.data.counts_by_status || {};
                const stats = document.querySelectorAll('#queue-stats > div');
                stats[0].querySelector('.text-2xl').textContent = counts.queued || 0;
                stats[1].querySelector('.text-2xl').textContent = counts.started || 0;
                stats[2].querySelector('.text-2xl').textContent = counts.done || 0;
                stats[3].querySelector('.text-2xl').textContent = counts.failed || 0;
                stats[4].querySelector('.text-2xl').textContent = 
                  queueData.data.avg_wait_sec_queued ? queueData.data.avg_wait_sec_queued.toFixed(1) : '-';
                
                if (queueData.data.oldest_queued) {
                  document.getElementById('oldest-queued').innerHTML = 
                    '<i class="fas fa-clock mr-1"></i>最古の待機: ' + queueData.data.oldest_queued.url + 
                    ' (' + new Date(queueData.data.oldest_queued.created_at).toLocaleString('ja-JP') + ')';
                }
              }
              
              // Daily
              const dailyRes = await fetch('/api/kpi/daily?days=' + days, {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const dailyData = await dailyRes.json();
              if (dailyData.success) {
                const tbody = document.getElementById('daily-tbody');
                const rows = dailyData.data.rows || [];
                if (rows.length === 0) {
                  tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-4 text-center text-gray-500">データなし</td></tr>';
                } else {
                  tbody.innerHTML = rows.map(row => 
                    '<tr class="hover:bg-gray-50">' +
                      '<td class="px-4 py-2 text-sm">' + row.date + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right">' + (row.picked || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right text-green-600">' + (row.succeeded || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right text-red-600">' + (row.failed || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right text-yellow-600">' + (row.retried || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right">' + (row.domains_blocked || 0) + '</td>' +
                    '</tr>'
                  ).join('');
                }
              }
              
              // Domains
              const domainsRes = await fetch('/api/kpi/domains?days=' + days + '&limit=50', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const domainsData = await domainsRes.json();
              if (domainsData.success) {
                const tbody = document.getElementById('domains-tbody');
                const domains = domainsData.data.domains || [];
                if (domains.length === 0) {
                  tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">データなし</td></tr>';
                } else {
                  tbody.innerHTML = domains.map(d => {
                    const statusBadge = d.enabled 
                      ? '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">有効</span>'
                      : '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">無効</span>';
                    return '<tr class="hover:bg-gray-50">' +
                      '<td class="px-4 py-2 text-sm font-mono">' + d.domain + '</td>' +
                      '<td class="px-4 py-2 text-center">' + statusBadge + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right text-green-600">' + (d.succeeded || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right text-red-600">' + (d.failed || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right text-yellow-600">' + (d.queued || 0) + '</td>' +
                      '<td class="px-4 py-2 text-sm text-right">' + 
                        (d.failure_rate_pct !== null ? d.failure_rate_pct.toFixed(1) + '%' : '-') + 
                      '</td>' +
                      '<td class="px-4 py-2 text-sm text-right">' + 
                        (d.avg_duration_sec !== null ? d.avg_duration_sec.toFixed(1) + 's' : '-') + 
                      '</td>' +
                    '</tr>';
                  }).join('');
                }
              }
            } catch (err) {
              console.error('Failed to load KPI:', err);
            }
          }
          
          loadKPI();
        `
      }} />
    </div>
  );
});

// 監査ログページ
adminPages.get('/admin/audit', (c) => {
  return c.render(
    <div class="min-h-screen">
      {/* Navigation */}
      <nav class="bg-indigo-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center gap-4">
              <a href="/admin" class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-shield-halved"></i>
                管理画面
              </a>
              <div class="hidden md:flex gap-4 ml-8">
                <a href="/admin/users" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-users mr-1"></i>ユーザー
                </a>
                <a href="/admin/kpi" class="px-3 py-2 rounded-md hover:bg-indigo-700">
                  <i class="fas fa-chart-line mr-1"></i>KPI
                </a>
                <a href="/admin/audit" class="px-3 py-2 rounded-md bg-indigo-900">
                  <i class="fas fa-clipboard-list mr-1"></i>監査ログ
                </a>
              </div>
            </div>
            <button onclick="logout()" class="px-3 py-2 rounded-md hover:bg-indigo-700 text-sm">
              <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-6">監査ログ</h1>
        
        {/* Stats */}
        <div id="audit-stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Stats will be rendered here */}
        </div>
        
        {/* Filters */}
        <div class="bg-white rounded-lg shadow p-4 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
              <select id="category" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="">すべて</option>
                <option value="auth">認証</option>
                <option value="admin">管理</option>
                <option value="data">データ</option>
                <option value="system">システム</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">重要度</label>
              <select id="severity" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="">すべて</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">アクション</label>
              <input type="text" id="action" placeholder="例: LOGIN_SUCCESS" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">期間</label>
              <select id="period" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="1">1日</option>
                <option value="7" selected>7日</option>
                <option value="30">30日</option>
              </select>
            </div>
            <div class="flex items-end">
              <button onclick="loadAuditLogs(1)" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                <i class="fas fa-search mr-1"></i>検索
              </button>
            </div>
          </div>
        </div>
        
        {/* Log List */}
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">日時</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">アクション</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">カテゴリ</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">重要度</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">実行者</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">対象</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">IP</th>
              </tr>
            </thead>
            <tbody id="audit-tbody" class="bg-white divide-y divide-gray-200">
              <tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div id="pagination" class="mt-4 flex justify-between items-center"></div>
      </main>

      {/* Detail Modal */}
      <div id="detail-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <h2 class="text-lg font-bold text-gray-800">ログ詳細</h2>
              <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>
            <pre id="modal-content" class="bg-gray-100 p-4 rounded text-sm overflow-x-auto"></pre>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          const token = localStorage.getItem('token');
          if (!token) window.location.href = '/login';
          
          let currentPage = 1;
          
          function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          
          async function loadAuditLogs(page = 1) {
            currentPage = page;
            const category = document.getElementById('category').value;
            const severity = document.getElementById('severity').value;
            const action = document.getElementById('action').value;
            const period = document.getElementById('period').value;
            
            const from = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
            
            const params = new URLSearchParams({ page, limit: 50, from });
            if (category) params.append('category', category);
            if (severity) params.append('severity', severity);
            if (action) params.append('action', action);
            
            try {
              const res = await fetch('/api/admin/audit?' + params, {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              const data = await res.json();
              
              if (!data.success) {
                if (res.status === 403) {
                  alert('管理者権限が必要です');
                  window.location.href = '/dashboard';
                  return;
                }
                throw new Error(data.error?.message);
              }
              
              renderStats(data.data.stats);
              renderLogs(data.data.logs);
              renderPagination(data.data.pagination);
            } catch (err) {
              console.error(err);
              document.getElementById('audit-tbody').innerHTML = 
                '<tr><td colspan="7" class="px-4 py-4 text-center text-red-500">エラー: ' + err.message + '</td></tr>';
            }
          }
          
          function renderStats(stats) {
            const container = document.getElementById('audit-stats');
            const grouped = {};
            (stats || []).forEach(s => {
              if (!grouped[s.action_category]) grouped[s.action_category] = { info: 0, warning: 0, critical: 0 };
              grouped[s.action_category][s.severity] = s.count;
            });
            
            const categories = { auth: '認証', admin: '管理', data: 'データ', system: 'システム' };
            container.innerHTML = Object.entries(categories).map(([key, label]) => {
              const data = grouped[key] || { info: 0, warning: 0, critical: 0 };
              return '<div class="bg-white rounded-lg shadow p-4">' +
                '<div class="text-sm font-medium text-gray-500">' + label + '</div>' +
                '<div class="flex gap-2 mt-2">' +
                  '<span class="px-2 py-1 text-xs bg-gray-100 rounded">' + data.info + ' info</span>' +
                  '<span class="px-2 py-1 text-xs bg-yellow-100 rounded">' + data.warning + ' warn</span>' +
                  '<span class="px-2 py-1 text-xs bg-red-100 rounded">' + data.critical + ' crit</span>' +
                '</div>' +
              '</div>';
            }).join('');
          }
          
          function renderLogs(logs) {
            const tbody = document.getElementById('audit-tbody');
            if (logs.length === 0) {
              tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">ログなし</td></tr>';
              return;
            }
            
            tbody.innerHTML = logs.map(log => {
              const severityClass = log.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' 
                : log.severity === 'critical' ? 'bg-red-100 text-red-800' 
                : 'bg-gray-100 text-gray-800';
              const categoryClass = log.action_category === 'admin' ? 'bg-purple-100 text-purple-800'
                : log.action_category === 'auth' ? 'bg-blue-100 text-blue-800'
                : log.action_category === 'data' ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800';
              
              return '<tr class="hover:bg-gray-50 cursor-pointer" onclick="showDetail(' + JSON.stringify(log).replace(/"/g, '&quot;') + ')">' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + new Date(log.created_at).toLocaleString('ja-JP') + '</td>' +
                '<td class="px-4 py-3 text-sm font-mono">' + log.action + '</td>' +
                '<td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded ' + categoryClass + '">' + log.action_category + '</span></td>' +
                '<td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded ' + severityClass + '">' + log.severity + '</span></td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + (log.actor_email || '-') + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + (log.target_email || '-') + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-500 font-mono">' + (log.ip || '-') + '</td>' +
              '</tr>';
            }).join('');
          }
          
          function renderPagination(pagination) {
            const div = document.getElementById('pagination');
            div.innerHTML = 
              '<div class="text-sm text-gray-700">全 ' + pagination.total + ' 件</div>' +
              '<div class="flex gap-2">' +
                (pagination.page > 1 
                  ? '<button onclick="loadAuditLogs(' + (pagination.page - 1) + ')" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">前へ</button>'
                  : ''
                ) +
                '<span class="px-3 py-1 bg-indigo-600 text-white rounded">' + pagination.page + '</span>' +
                (pagination.page < pagination.totalPages 
                  ? '<button onclick="loadAuditLogs(' + (pagination.page + 1) + ')" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">次へ</button>'
                  : ''
                ) +
              '</div>';
          }
          
          function showDetail(log) {
            document.getElementById('modal-content').textContent = JSON.stringify(log, null, 2);
            document.getElementById('detail-modal').classList.remove('hidden');
            document.getElementById('detail-modal').classList.add('flex');
          }
          
          function closeModal() {
            document.getElementById('detail-modal').classList.add('hidden');
            document.getElementById('detail-modal').classList.remove('flex');
          }
          
          loadAuditLogs();
        `
      }} />
    </div>
  );
});

export default adminPages;

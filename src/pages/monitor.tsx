/**
 * 監視ダッシュボードページ (/monitor)
 * 
 * PDF自動監視パイプラインの状況を可視化
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const monitorPages = new Hono<{ Bindings: Env; Variables: Variables }>();

monitorPages.get('/monitor', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF監視ダッシュボード - ホジョラク</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    .status-active { color: #10b981; }
    .status-error { color: #ef4444; }
    .status-paused { color: #f59e0b; }
    .status-changed { color: #3b82f6; }
    .bg-gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .card { transition: all 0.3s ease; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-gradient text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <i class="fas fa-satellite-dish text-2xl"></i>
        <div>
          <h1 class="text-xl font-bold">PDF監視ダッシュボード</h1>
          <p class="text-purple-200 text-sm">公募要領の自動監視・PDF検出パイプライン</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span id="last-updated" class="text-sm text-purple-200"></span>
        <button onclick="loadDashboard()" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition">
          <i class="fas fa-sync-alt mr-1"></i> 更新
        </button>
        <a href="/dashboard" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition">
          <i class="fas fa-arrow-left mr-1"></i> メイン
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6">
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      <div class="card bg-white rounded-xl shadow-sm p-4 text-center">
        <div class="text-3xl font-bold text-blue-600" id="stat-active">-</div>
        <div class="text-xs text-gray-500 mt-1">稼働中</div>
      </div>
      <div class="card bg-white rounded-xl shadow-sm p-4 text-center">
        <div class="text-3xl font-bold text-red-500" id="stat-error">-</div>
        <div class="text-xs text-gray-500 mt-1">エラー</div>
      </div>
      <div class="card bg-white rounded-xl shadow-sm p-4 text-center">
        <div class="text-3xl font-bold text-green-600" id="stat-files">-</div>
        <div class="text-xs text-gray-500 mt-1">監視ファイル</div>
      </div>
      <div class="card bg-white rounded-xl shadow-sm p-4 text-center">
        <div class="text-3xl font-bold text-amber-500" id="stat-changed">-</div>
        <div class="text-xs text-gray-500 mt-1">変更検出</div>
      </div>
      <div class="card bg-white rounded-xl shadow-sm p-4 text-center">
        <div class="text-3xl font-bold text-purple-600" id="stat-pending">-</div>
        <div class="text-xs text-gray-500 mt-1">処理待ち</div>
      </div>
      <div class="card bg-white rounded-xl shadow-sm p-4 text-center">
        <div class="text-3xl font-bold text-cyan-600" id="stat-24h">-</div>
        <div class="text-xs text-gray-500 mt-1">24h変更</div>
      </div>
    </div>

    <!-- Monitors Table -->
    <div class="bg-white rounded-xl shadow-sm mb-6">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">
          <i class="fas fa-radar mr-2 text-blue-500"></i>監視対象一覧
        </h2>
        <div class="flex gap-2">
          <select id="filter-status" onchange="filterMonitors()" class="text-sm border rounded-lg px-3 py-1.5">
            <option value="">全ステータス</option>
            <option value="active">稼働中</option>
            <option value="error">エラー</option>
            <option value="paused">一時停止</option>
          </select>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-600">
            <tr>
              <th class="px-4 py-3 text-left">ステータス</th>
              <th class="px-4 py-3 text-left">監視対象</th>
              <th class="px-4 py-3 text-left">関連補助金</th>
              <th class="px-4 py-3 text-center">ファイル数</th>
              <th class="px-4 py-3 text-center">変更</th>
              <th class="px-4 py-3 text-center">間隔</th>
              <th class="px-4 py-3 text-left">最終チェック</th>
              <th class="px-4 py-3 text-left">締切</th>
            </tr>
          </thead>
          <tbody id="monitors-body" class="divide-y divide-gray-50">
            <tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Changes -->
    <div class="bg-white rounded-xl shadow-sm">
      <div class="px-6 py-4 border-b border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800">
          <i class="fas fa-history mr-2 text-green-500"></i>最近の変更検出
        </h2>
      </div>
      <div id="changes-list" class="divide-y divide-gray-50">
        <div class="px-6 py-8 text-center text-gray-400">読み込み中...</div>
      </div>
    </div>
  </main>

  <script>
    let dashboardData = null;
    
    async function loadDashboard() {
      try {
        const res = await fetch('/api/cron/monitor-dashboard');
        const json = await res.json();
        if (json.success) {
          dashboardData = json.data;
          renderStats(json.data.stats);
          renderMonitors(json.data.monitors);
          renderChanges(json.data.recent_changes);
          document.getElementById('last-updated').textContent = 
            '更新: ' + new Date().toLocaleTimeString('ja-JP');
        }
      } catch (e) {
        console.error('Dashboard load failed:', e);
      }
    }
    
    function renderStats(s) {
      if (!s) return;
      document.getElementById('stat-active').textContent = s.active_monitors || 0;
      document.getElementById('stat-error').textContent = s.error_monitors || 0;
      document.getElementById('stat-files').textContent = s.active_files || 0;
      document.getElementById('stat-changed').textContent = s.changed_files || 0;
      document.getElementById('stat-pending').textContent = s.pending_processing || 0;
      document.getElementById('stat-24h').textContent = s.changes_24h || 0;
    }
    
    function renderMonitors(monitors) {
      const tbody = document.getElementById('monitors-body');
      if (!monitors || monitors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">監視対象なし</td></tr>';
        return;
      }
      
      tbody.innerHTML = monitors.map(m => {
        const statusIcon = m.status === 'active' 
          ? '<i class="fas fa-circle text-green-500 text-xs"></i>' 
          : m.status === 'error' 
            ? '<i class="fas fa-exclamation-triangle text-red-500"></i>'
            : '<i class="fas fa-pause-circle text-amber-500"></i>';
        
        const lastCheck = m.last_checked_at 
          ? timeAgo(m.last_checked_at) 
          : '<span class="text-gray-400">未チェック</span>';
        
        const deadline = m.deadline 
          ? formatDeadline(m.deadline)
          : '<span class="text-gray-400">-</span>';
        
        const subsidyLink = m.subsidy_cache_id 
          ? '<a href="/subsidies/' + m.subsidy_cache_id + '" class="text-blue-600 hover:underline text-xs">' + (m.subsidy_title || m.subsidy_cache_id).substring(0, 30) + '</a>'
          : '<span class="text-gray-400 text-xs">未リンク</span>';
        
        return '<tr class="hover:bg-gray-50 monitor-row" data-status="' + m.status + '">' +
          '<td class="px-4 py-3">' + statusIcon + ' <span class="text-xs ml-1">' + m.status + '</span></td>' +
          '<td class="px-4 py-3"><div class="font-medium text-gray-800 text-xs">' + m.source_name + '</div>' +
          '<div class="text-xs text-gray-400 truncate max-w-xs"><a href="' + m.source_url + '" target="_blank" class="hover:text-blue-500">' + m.source_url.substring(0, 60) + '...</a></div></td>' +
          '<td class="px-4 py-3">' + subsidyLink + '</td>' +
          '<td class="px-4 py-3 text-center"><span class="bg-gray-100 px-2 py-1 rounded text-xs">' + (m.file_count || 0) + '</span></td>' +
          '<td class="px-4 py-3 text-center">' + (m.changed_count > 0 ? '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">' + m.changed_count + '</span>' : '<span class="text-gray-400 text-xs">0</span>') + '</td>' +
          '<td class="px-4 py-3 text-center"><span class="text-xs text-gray-600">' + m.check_interval_hours + 'h</span></td>' +
          '<td class="px-4 py-3 text-xs text-gray-600">' + lastCheck + '</td>' +
          '<td class="px-4 py-3 text-xs">' + deadline + '</td>' +
          '</tr>';
      }).join('');
    }
    
    function renderChanges(changes) {
      const list = document.getElementById('changes-list');
      if (!changes || changes.length === 0) {
        list.innerHTML = '<div class="px-6 py-8 text-center text-gray-400">変更検出なし</div>';
        return;
      }
      
      list.innerHTML = changes.map(ch => {
        const typeIcon = ch.change_type === 'new_file' 
          ? '<i class="fas fa-plus-circle text-green-500"></i>' 
          : ch.change_type === 'url_change' 
            ? '<i class="fas fa-exchange-alt text-blue-500"></i>'
            : '<i class="fas fa-edit text-amber-500"></i>';
        
        const statusBadge = ch.process_status === 'processed' 
          ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">処理済</span>'
          : ch.process_status === 'pending'
            ? '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">待機中</span>'
            : ch.process_status === 'error'
              ? '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">エラー</span>'
              : '<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">' + ch.process_status + '</span>';
        
        const size = ch.new_size ? '(' + (ch.new_size / 1024).toFixed(1) + 'KB)' : '';
        
        return '<div class="px-6 py-3 hover:bg-gray-50">' +
          '<div class="flex items-center gap-3">' +
          '<div class="text-lg">' + typeIcon + '</div>' +
          '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2">' +
          '<span class="font-medium text-sm text-gray-800">' + ch.file_name + '</span>' +
          statusBadge +
          '<span class="text-xs text-gray-400">' + size + '</span>' +
          '</div>' +
          '<div class="text-xs text-gray-500 mt-0.5">' + ch.source_name + '</div>' +
          (ch.new_url ? '<div class="text-xs text-blue-500 truncate mt-0.5"><a href="' + ch.new_url + '" target="_blank">' + ch.new_url.substring(0, 80) + '</a></div>' : '') +
          '</div>' +
          '<div class="text-xs text-gray-400 whitespace-nowrap">' + timeAgo(ch.detected_at) + '</div>' +
          '</div>' +
          '</div>';
      }).join('');
    }
    
    function timeAgo(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return Math.floor(diff) + '秒前';
      if (diff < 3600) return Math.floor(diff / 60) + '分前';
      if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
      return Math.floor(diff / 86400) + '日前';
    }
    
    function formatDeadline(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      const dateFormatted = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      if (diff < 0) return '<span class="text-gray-400 line-through">' + dateFormatted + '</span>';
      if (diff <= 7) return '<span class="text-red-600 font-bold">' + dateFormatted + ' (' + Math.ceil(diff) + '日)</span>';
      if (diff <= 30) return '<span class="text-amber-600 font-medium">' + dateFormatted + ' (' + Math.ceil(diff) + '日)</span>';
      return '<span class="text-gray-600">' + dateFormatted + '</span>';
    }
    
    function filterMonitors() {
      const status = document.getElementById('filter-status').value;
      document.querySelectorAll('.monitor-row').forEach(row => {
        if (!status || row.dataset.status === status) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }
    
    // 初回ロード
    loadDashboard();
    // 60秒ごとに自動更新
    setInterval(loadDashboard, 60000);
  </script>
</body>
</html>
  `);
});

export default monitorPages;

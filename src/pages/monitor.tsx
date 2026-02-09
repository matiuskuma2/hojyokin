/**
 * 公募要領PDF定点観測ダッシュボードページ (/monitor)
 * 
 * koubo_monitors APIからデータを取得して表示
 * - 全体統計（アクティブ/URL消失/手動対応/廃止/PDF保有率）
 * - アラート一覧（URL消失・手動対応必要・期限超過）
 * - 公募時期分布・スケジュール分布
 * - 最近のクロール履歴
 * - 情報源別カバレッジ
 * - 新規発見キュー
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
  <title>公募要領PDF定点観測 - ホジョラク</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    .pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    .bg-gradient { background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2b6cb0 100%); }
    .card { transition: all 0.3s ease; border-radius: 1rem; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .tab-active { border-bottom: 3px solid #3b82f6; color: #1e40af; font-weight: 600; }
    .badge { font-size: 0.65rem; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 600; }
    ::-webkit-scrollbar { width: 6px; } 
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-gradient text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <i class="fas fa-satellite-dish text-2xl"></i>
        <div>
          <h1 class="text-xl font-bold tracking-tight">公募要領PDF 定点観測</h1>
          <p class="text-blue-200 text-xs mt-0.5">Koubo PDF Monitoring Dashboard - SSOT管理</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span id="last-updated" class="text-xs text-blue-200"></span>
        <button onclick="loadDashboard()" class="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-medium transition">
          <i class="fas fa-sync-alt mr-1"></i>更新
        </button>
        <a href="/admin" class="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-medium transition">
          <i class="fas fa-cog mr-1"></i>管理
        </a>
        <a href="/dashboard" class="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-medium transition">
          <i class="fas fa-home mr-1"></i>メイン
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-5">
    <!-- Stats Row -->
    <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5" id="stats-row">
      <div class="card bg-white shadow-sm p-3 text-center">
        <div class="text-2xl font-bold text-blue-600" id="s-total">-</div>
        <div class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">総監視数</div>
      </div>
      <div class="card bg-white shadow-sm p-3 text-center">
        <div class="text-2xl font-bold text-green-600" id="s-active">-</div>
        <div class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">アクティブ</div>
      </div>
      <div class="card bg-white shadow-sm p-3 text-center">
        <div class="text-2xl font-bold text-emerald-600" id="s-pdf">-</div>
        <div class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">PDF保有</div>
      </div>
      <div class="card bg-white shadow-sm p-3 text-center cursor-pointer" onclick="showTab('alerts')">
        <div class="text-2xl font-bold text-red-500" id="s-lost">-</div>
        <div class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">URL消失</div>
      </div>
      <div class="card bg-white shadow-sm p-3 text-center cursor-pointer" onclick="showTab('alerts')">
        <div class="text-2xl font-bold text-amber-500" id="s-manual">-</div>
        <div class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">手動対応</div>
      </div>
      <div class="card bg-white shadow-sm p-3 text-center">
        <div class="text-2xl font-bold text-orange-500" id="s-overdue">-</div>
        <div class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">期限超過</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-gray-200 mb-4">
      <button onclick="showTab('alerts')" id="tab-alerts" class="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition tab-active">
        <i class="fas fa-exclamation-triangle mr-1"></i>アラート
      </button>
      <button onclick="showTab('crawls')" id="tab-crawls" class="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition">
        <i class="fas fa-spider mr-1"></i>クロール履歴
      </button>
      <button onclick="showTab('coverage')" id="tab-coverage" class="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition">
        <i class="fas fa-chart-pie mr-1"></i>カバレッジ
      </button>
      <button onclick="showTab('schedule')" id="tab-schedule" class="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition">
        <i class="fas fa-clock mr-1"></i>スケジュール
      </button>
      <button onclick="showTab('discoveries')" id="tab-discoveries" class="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition">
        <i class="fas fa-lightbulb mr-1"></i>新規発見 <span id="discovery-badge" class="badge bg-amber-100 text-amber-700 ml-1 hidden">0</span>
      </button>
    </div>

    <!-- Tab Content: Alerts -->
    <div id="panel-alerts" class="tab-panel">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">
            <i class="fas fa-bell text-red-400 mr-1"></i>要対応アラート
          </h2>
          <div class="flex gap-2">
            <select id="alert-filter" onchange="filterAlerts()" class="text-xs border rounded px-2 py-1">
              <option value="all">すべて</option>
              <option value="url_lost">URL消失</option>
              <option value="needs_manual">手動対応</option>
              <option value="overdue">期限超過</option>
            </select>
          </div>
        </div>
        <div class="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table class="w-full text-xs">
            <thead class="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left">状態</th>
                <th class="px-3 py-2 text-left">補助金</th>
                <th class="px-3 py-2 text-left">情報源</th>
                <th class="px-3 py-2 text-left">PDF URL</th>
                <th class="px-3 py-2 text-left">最終クロール</th>
                <th class="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody id="alerts-body" class="divide-y divide-gray-50">
              <tr><td colspan="6" class="px-3 py-6 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab Content: Crawl History -->
    <div id="panel-crawls" class="tab-panel hidden">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700">
            <i class="fas fa-history text-blue-400 mr-1"></i>最近のクロール実行結果
          </h2>
        </div>
        <div class="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table class="w-full text-xs">
            <thead class="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left">結果</th>
                <th class="px-3 py-2 text-left">補助金</th>
                <th class="px-3 py-2 text-left">タイプ</th>
                <th class="px-3 py-2 text-left">発見URL</th>
                <th class="px-3 py-2 text-left">エラー</th>
                <th class="px-3 py-2 text-left">実行日時</th>
              </tr>
            </thead>
            <tbody id="crawls-body" class="divide-y divide-gray-50">
              <tr><td colspan="6" class="px-3 py-6 text-center text-gray-400">読み込み中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab Content: Coverage -->
    <div id="panel-coverage" class="tab-panel hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">
            <i class="fas fa-database text-indigo-400 mr-1"></i>情報源別カバレッジ
          </h3>
          <div id="coverage-table"></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">
            <i class="fas fa-chart-doughnut text-purple-400 mr-1"></i>ステータス分布
          </h3>
          <canvas id="chart-status" height="200"></canvas>
        </div>
      </div>
    </div>

    <!-- Tab Content: Schedule -->
    <div id="panel-schedule" class="tab-panel hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">
            <i class="fas fa-calendar-alt text-green-400 mr-1"></i>公募時期タイプ分布
          </h3>
          <canvas id="chart-period" height="200"></canvas>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">
            <i class="fas fa-clock text-amber-400 mr-1"></i>クロールスケジュール分布
          </h3>
          <canvas id="chart-schedule" height="200"></canvas>
        </div>
      </div>
    </div>

    <!-- Tab Content: Discoveries -->
    <div id="panel-discoveries" class="tab-panel hidden">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700">
            <i class="fas fa-lightbulb text-amber-400 mr-1"></i>新規発見された補助金（未登録）
          </h2>
        </div>
        <div id="discoveries-body" class="divide-y divide-gray-50">
          <div class="px-5 py-6 text-center text-gray-400 text-sm">読み込み中...</div>
        </div>
      </div>
    </div>
  </main>

  <script>
    let dashData = null;
    let statusChart = null, periodChart = null, scheduleChart = null;

    async function loadDashboard() {
      try {
        const res = await fetch('/api/cron/koubo-dashboard');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'API Error');
        dashData = json.data;
        renderStats(dashData.stats);
        renderAlerts(dashData.alerts);
        renderCrawls(dashData.recent_crawls);
        renderCoverage(dashData.coverage);
        renderCharts(dashData);
        renderDiscoveries(dashData.pending_discoveries);
        document.getElementById('last-updated').textContent = 
          '更新: ' + new Date().toLocaleTimeString('ja-JP');
      } catch (e) {
        console.error('Dashboard load failed:', e);
        document.getElementById('stats-row').innerHTML = 
          '<div class="col-span-6 bg-red-50 text-red-600 rounded-xl p-4 text-sm"><i class="fas fa-exclamation-circle mr-1"></i>データ取得に失敗しました: ' + e.message + '</div>';
      }
    }

    function renderStats(s) {
      if (!s) return;
      document.getElementById('s-total').textContent = (s.total || 0).toLocaleString();
      document.getElementById('s-active').textContent = (s.active || 0).toLocaleString();
      document.getElementById('s-pdf').textContent = (s.with_pdf || 0).toLocaleString();
      document.getElementById('s-lost').textContent = (s.url_lost || 0).toLocaleString();
      document.getElementById('s-manual').textContent = (s.needs_manual || 0).toLocaleString();
      document.getElementById('s-overdue').textContent = (s.overdue || 0).toLocaleString();
    }

    function renderAlerts(alerts) {
      const tbody = document.getElementById('alerts-body');
      if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-6 text-center text-green-500"><i class="fas fa-check-circle mr-1"></i>アラートなし</td></tr>';
        return;
      }
      tbody.innerHTML = alerts.map(a => {
        const statusBadge = {
          'URL消失': '<span class="badge bg-red-100 text-red-700">URL消失</span>',
          '手動対応必要': '<span class="badge bg-amber-100 text-amber-700">手動対応</span>',
          'クロール期限超過': '<span class="badge bg-orange-100 text-orange-700">期限超過</span>',
          '補助金廃止': '<span class="badge bg-gray-100 text-gray-500">廃止</span>'
        }[a.alert_type] || '<span class="badge bg-gray-100 text-gray-500">' + a.alert_type + '</span>';
        
        const title = (a.title || a.subsidy_id || '-').substring(0, 40);
        const pdfUrl = a.koubo_pdf_url ? '<a href="' + a.koubo_pdf_url + '" target="_blank" class="text-blue-500 hover:underline truncate block max-w-[200px]">' + a.koubo_pdf_url.split('/').pop() + '</a>' : '<span class="text-gray-300">なし</span>';
        const lastCrawl = a.last_crawl_at ? timeAgo(a.last_crawl_at) : '-';
        
        return '<tr class="hover:bg-gray-50 alert-row" data-type="' + a.alert_type + '" data-status="' + a.status + '">' +
          '<td class="px-3 py-2">' + statusBadge + '</td>' +
          '<td class="px-3 py-2"><div class="font-medium text-gray-800">' + title + '</div><div class="text-[10px] text-gray-400">' + (a.source || '') + ' | ' + a.subsidy_id + '</div></td>' +
          '<td class="px-3 py-2 text-gray-500">' + (a.source || '-') + '</td>' +
          '<td class="px-3 py-2">' + pdfUrl + '</td>' +
          '<td class="px-3 py-2 text-gray-500">' + lastCrawl + '</td>' +
          '<td class="px-3 py-2"><a href="/subsidies/' + a.subsidy_id + '" class="text-blue-500 hover:underline text-[10px]">詳細</a></td>' +
          '</tr>';
      }).join('');
    }

    function filterAlerts() {
      const f = document.getElementById('alert-filter').value;
      document.querySelectorAll('.alert-row').forEach(r => {
        if (f === 'all') { r.style.display = ''; return; }
        if (f === 'url_lost') r.style.display = r.dataset.status === 'url_lost' ? '' : 'none';
        else if (f === 'needs_manual') r.style.display = r.dataset.status === 'needs_manual' ? '' : 'none';
        else if (f === 'overdue') r.style.display = r.dataset.type === 'クロール期限超過' ? '' : 'none';
        else r.style.display = '';
      });
    }

    function renderCrawls(crawls) {
      const tbody = document.getElementById('crawls-body');
      if (!crawls || crawls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-6 text-center text-gray-400">クロール履歴なし</td></tr>';
        return;
      }
      const resultColors = {
        success: 'bg-green-100 text-green-700',
        url_changed: 'bg-blue-100 text-blue-700',
        new_url_found: 'bg-emerald-100 text-emerald-700',
        page_not_found: 'bg-red-100 text-red-700',
        pdf_not_found: 'bg-amber-100 text-amber-700',
        subsidy_discontinued: 'bg-gray-100 text-gray-600',
        error: 'bg-red-100 text-red-700',
        running: 'bg-blue-100 text-blue-500'
      };
      const resultLabels = {
        success: '成功', url_changed: 'URL変更', new_url_found: '新URL発見',
        page_not_found: 'ページ消失', pdf_not_found: 'PDFなし',
        subsidy_discontinued: '補助金廃止', error: 'エラー', running: '実行中'
      };
      tbody.innerHTML = crawls.map(cl => {
        const color = resultColors[cl.result] || 'bg-gray-100 text-gray-600';
        const label = resultLabels[cl.result] || cl.result;
        return '<tr class="hover:bg-gray-50">' +
          '<td class="px-3 py-2"><span class="badge ' + color + '">' + label + '</span></td>' +
          '<td class="px-3 py-2 font-medium text-gray-800">' + ((cl.title || cl.subsidy_id || '-').substring(0, 35)) + '</td>' +
          '<td class="px-3 py-2 text-gray-500">' + (cl.crawl_type || '-') + '</td>' +
          '<td class="px-3 py-2">' + (cl.found_pdf_url ? '<a href="' + cl.found_pdf_url + '" target="_blank" class="text-blue-500 hover:underline truncate block max-w-[180px]">' + cl.found_pdf_url.split('/').pop() + '</a>' : '-') + '</td>' +
          '<td class="px-3 py-2 text-red-400 max-w-[150px] truncate">' + (cl.error_message || '-') + '</td>' +
          '<td class="px-3 py-2 text-gray-400">' + (cl.finished_at ? timeAgo(cl.finished_at) : '-') + '</td>' +
          '</tr>';
      }).join('');
    }

    function renderCoverage(coverage) {
      const el = document.getElementById('coverage-table');
      if (!coverage || coverage.length === 0) {
        el.innerHTML = '<div class="text-gray-400 text-sm">データなし</div>';
        return;
      }
      el.innerHTML = '<table class="w-full text-xs"><thead class="text-gray-400"><tr><th class="text-left pb-2">情報源</th><th class="text-right pb-2">総数</th><th class="text-right pb-2">監視中</th><th class="text-right pb-2">PDF有</th><th class="text-right pb-2">率</th></tr></thead><tbody>' +
        coverage.map(cv => {
          const rate = cv.total_subsidies > 0 ? ((cv.monitored || 0) / cv.total_subsidies * 100).toFixed(1) : '0.0';
          const barWidth = Math.min(parseFloat(rate), 100);
          return '<tr class="border-t border-gray-50"><td class="py-1.5 font-medium text-gray-700">' + (cv.source || 'unknown') + '</td>' +
            '<td class="py-1.5 text-right text-gray-500">' + (cv.total_subsidies || 0).toLocaleString() + '</td>' +
            '<td class="py-1.5 text-right text-blue-600">' + (cv.monitored || 0).toLocaleString() + '</td>' +
            '<td class="py-1.5 text-right text-green-600">' + (cv.with_pdf || 0).toLocaleString() + '</td>' +
            '<td class="py-1.5 text-right"><div class="flex items-center justify-end gap-1"><div class="w-16 bg-gray-100 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full" style="width:' + barWidth + '%"></div></div><span class="text-gray-500">' + rate + '%</span></div></td></tr>';
        }).join('') + '</tbody></table>';
    }

    function renderCharts(data) {
      // Status distribution doughnut
      if (statusChart) statusChart.destroy();
      const s = data.stats || {};
      statusChart = new Chart(document.getElementById('chart-status'), {
        type: 'doughnut',
        data: {
          labels: ['アクティブ', 'URL消失', '手動対応', '廃止', '一時停止'],
          datasets: [{
            data: [s.active||0, s.url_lost||0, s.needs_manual||0, s.discontinued||0, s.suspended||0],
            backgroundColor: ['#10b981','#ef4444','#f59e0b','#6b7280','#8b5cf6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }
        }
      });

      // Period type bar chart
      if (periodChart) periodChart.destroy();
      const periodLabels = {
        unknown: '未判定', annual_fixed: '毎年固定', annual_variable: '毎年変動',
        biannual: '年2回', quarterly: '四半期', irregular: '不定期',
        one_time: '1回限り', always_open: '常時公募'
      };
      const pd = data.period_distribution || [];
      periodChart = new Chart(document.getElementById('chart-period'), {
        type: 'bar',
        data: {
          labels: pd.map(p => periodLabels[p.koubo_period_type] || p.koubo_period_type),
          datasets: [{
            label: '件数',
            data: pd.map(p => p.cnt),
            backgroundColor: '#6366f1',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });

      // Schedule bar chart
      if (scheduleChart) scheduleChart.destroy();
      const scheduleLabels = {
        pre_koubo: '公募直前', weekly: '毎週', biweekly: '隔週',
        monthly: '毎月', quarterly: '四半期', on_demand: '手動', stopped: '停止'
      };
      const sd = data.schedule_distribution || [];
      scheduleChart = new Chart(document.getElementById('chart-schedule'), {
        type: 'bar',
        data: {
          labels: sd.map(s => scheduleLabels[s.crawl_schedule] || s.crawl_schedule),
          datasets: [{
            label: '件数',
            data: sd.map(s => s.cnt),
            backgroundColor: '#f59e0b',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });
    }

    function renderDiscoveries(count) {
      const badge = document.getElementById('discovery-badge');
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
      const body = document.getElementById('discoveries-body');
      if (count === 0) {
        body.innerHTML = '<div class="px-5 py-6 text-center text-gray-400 text-sm"><i class="fas fa-check-circle text-green-400 mr-1"></i>新規発見なし（キューは空です）</div>';
      } else {
        body.innerHTML = '<div class="px-5 py-4 text-sm text-amber-600"><i class="fas fa-exclamation-triangle mr-1"></i>' + count + '件の新規補助金が発見待ちです。管理者APIで確認してください。</div>';
      }
    }

    // Tab Management
    function showTab(tabName) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.remove('tab-active'));
      document.getElementById('panel-' + tabName).classList.remove('hidden');
      document.getElementById('tab-' + tabName).classList.add('tab-active');
    }

    function timeAgo(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 0) return '未来';
      if (diff < 60) return Math.floor(diff) + '秒前';
      if (diff < 3600) return Math.floor(diff / 60) + '分前';
      if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
      if (diff < 604800) return Math.floor(diff / 86400) + '日前';
      return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }

    // Auto-refresh
    loadDashboard();
    setInterval(loadDashboard, 120000);
  </script>
</body>
</html>
  `);
});

export default monitorPages;

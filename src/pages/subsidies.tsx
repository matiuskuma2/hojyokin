/**
 * 補助金検索・一覧・詳細UI
 * 
 * /subsidies - 補助金一覧（検索・フィルタ）
 * /subsidies/:id - 補助金詳細（要件・必要書類・壁打ちボタン）
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const subsidyPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// 共通レイアウト
const subsidyLayout = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 補助金マッチング</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <a href="/dashboard" class="font-bold text-xl text-green-600">
            <i class="fas fa-leaf mr-2"></i>補助金マッチング
          </a>
          <div class="hidden md:flex space-x-4">
            <a href="/dashboard" class="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
              <i class="fas fa-home mr-1"></i>ダッシュボード
            </a>
            <a href="/subsidies" class="text-green-600 border-b-2 border-green-600 px-3 py-2 text-sm font-medium">
              <i class="fas fa-search mr-1"></i>補助金を探す
            </a>
            <a href="/company" class="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
              <i class="fas fa-building mr-1"></i>会社情報
            </a>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <span id="user-email" class="text-sm text-gray-500"></span>
          <button onclick="logout()" class="text-sm text-gray-600 hover:text-gray-900">
            <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
          </button>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    ${content}
  </main>
  
  <script>
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
    }
    
    // ユーザー情報取得
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('user-email').textContent = data.data.email;
        }
      } catch (e) {
        console.error('Failed to load user:', e);
      }
    }
    loadUser();
    
    function logout() {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // API呼び出しヘルパー
    async function api(path, options = {}) {
      const res = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          ...(options.headers || {})
        }
      });
      return res.json();
    }
  </script>
</body>
</html>
`;

/**
 * 補助金一覧ページ（S1）
 */
subsidyPages.get('/subsidies', (c) => {
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">
        <i class="fas fa-search text-green-600 mr-2"></i>補助金を探す
      </h1>
      <p class="text-gray-600 mt-1">あなたの会社に合った補助金を検索・マッチングします</p>
    </div>
    
    <!-- 会社未選択警告 -->
    <div id="company-alert" class="hidden bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div class="flex items-center">
        <i class="fas fa-exclamation-triangle text-yellow-400 mr-3"></i>
        <div>
          <p class="text-yellow-700 font-medium">会社情報が登録されていません</p>
          <p class="text-yellow-600 text-sm">補助金のマッチングには会社情報の登録が必要です。</p>
        </div>
        <a href="/company" class="ml-auto bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600">
          会社情報を登録
        </a>
      </div>
    </div>
    
    <!-- 検索・フィルターパネル -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- 会社選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">対象会社</label>
          <select id="company-select" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
            <option value="">会社を選択...</option>
          </select>
        </div>
        
        <!-- キーワード -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">キーワード</label>
          <input type="text" id="keyword" placeholder="例: IT導入、省エネ、人材育成" 
                 class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
        </div>
        
        <!-- 受付状況 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">受付状況</label>
          <select id="acceptance" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500">
            <option value="1">受付中のみ</option>
            <option value="0">すべて表示</option>
          </select>
        </div>
        
        <!-- 検索ボタン -->
        <div class="flex items-end">
          <button onclick="searchSubsidies()" 
                  class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center">
            <i class="fas fa-search mr-2"></i>検索
          </button>
        </div>
      </div>
      
      <!-- フィルター（折りたたみ） -->
      <details class="mt-4">
        <summary class="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
          <i class="fas fa-filter mr-1"></i>詳細フィルター
        </summary>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select id="status-filter" class="w-full px-3 py-2 border rounded-md text-sm">
              <option value="">すべて</option>
              <option value="PROCEED">推奨（PROCEED）</option>
              <option value="CAUTION">注意（CAUTION）</option>
              <option value="NO">非推奨（NO）</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ソート</label>
            <select id="sort" class="w-full px-3 py-2 border rounded-md text-sm">
              <option value="acceptance_end_datetime">締切日順</option>
              <option value="subsidy_max_limit">補助上限順</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">表示件数</label>
            <select id="limit" class="w-full px-3 py-2 border rounded-md text-sm">
              <option value="20">20件</option>
              <option value="50">50件</option>
              <option value="100">100件</option>
            </select>
          </div>
        </div>
      </details>
    </div>
    
    <!-- 検索結果サマリー -->
    <div id="result-summary" class="hidden mb-4 flex items-center justify-between">
      <div class="text-sm text-gray-600">
        <span id="result-count">0</span>件の補助金が見つかりました
        <span id="data-source" class="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs"></span>
      </div>
      <div class="flex space-x-2">
        <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
          <i class="fas fa-check-circle mr-1"></i>推奨: <span id="count-proceed">0</span>
        </span>
        <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
          <i class="fas fa-exclamation-triangle mr-1"></i>注意: <span id="count-caution">0</span>
        </span>
        <span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
          <i class="fas fa-times-circle mr-1"></i>非推奨: <span id="count-no">0</span>
        </span>
      </div>
    </div>
    
    <!-- 補助金一覧 -->
    <div id="subsidies-list" class="space-y-4">
      <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        <i class="fas fa-info-circle text-4xl mb-4"></i>
        <p>会社を選択して検索を実行してください</p>
      </div>
    </div>
    
    <!-- ページネーション -->
    <div id="pagination" class="hidden mt-6 flex justify-center space-x-2">
    </div>
    
    <!-- ローディング -->
    <div id="loading" class="hidden fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 shadow-xl">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p class="mt-4 text-gray-600">補助金を検索中...</p>
      </div>
    </div>
    
    <script>
      let currentResults = [];
      let currentPage = 1;
      
      // 会社一覧取得
      async function loadCompanies() {
        const res = await api('/api/companies');
        if (res.success && res.data.length > 0) {
          const select = document.getElementById('company-select');
          res.data.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name + ' (' + company.prefecture + ')';
            select.appendChild(option);
          });
          // 最初の会社を自動選択
          select.value = res.data[0].id;
          document.getElementById('company-alert').classList.add('hidden');
        } else {
          document.getElementById('company-alert').classList.remove('hidden');
        }
      }
      
      // 補助金検索
      async function searchSubsidies(page = 1) {
        const companyId = document.getElementById('company-select').value;
        if (!companyId) {
          alert('会社を選択してください');
          return;
        }
        
        currentPage = page;
        const limit = parseInt(document.getElementById('limit').value);
        const offset = (page - 1) * limit;
        
        const params = new URLSearchParams({
          company_id: companyId,
          keyword: document.getElementById('keyword').value,
          acceptance: document.getElementById('acceptance').value,
          sort: document.getElementById('sort').value,
          order: 'ASC',
          limit: limit.toString(),
          offset: offset.toString()
        });
        
        document.getElementById('loading').classList.remove('hidden');
        
        try {
          const res = await api('/api/subsidies/search?' + params);
          
          if (res.success) {
            currentResults = res.data;
            renderResults(res.data, res.meta);
          } else {
            document.getElementById('subsidies-list').innerHTML = 
              '<div class="bg-red-50 rounded-lg p-4 text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>' + 
              (res.error?.message || '検索に失敗しました') + '</div>';
          }
        } catch (e) {
          console.error('Search error:', e);
          document.getElementById('subsidies-list').innerHTML = 
            '<div class="bg-red-50 rounded-lg p-4 text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>検索中にエラーが発生しました</div>';
        } finally {
          document.getElementById('loading').classList.add('hidden');
        }
      }
      
      // 結果描画
      function renderResults(results, meta) {
        const statusFilter = document.getElementById('status-filter').value;
        let filtered = results;
        
        if (statusFilter) {
          filtered = results.filter(r => r.evaluation.status === statusFilter);
        }
        
        // サマリー更新
        document.getElementById('result-summary').classList.remove('hidden');
        document.getElementById('result-count').textContent = meta?.total || filtered.length;
        document.getElementById('data-source').textContent = 'データソース: ' + (meta?.source || 'API');
        
        const countProceed = results.filter(r => r.evaluation.status === 'PROCEED').length;
        const countCaution = results.filter(r => r.evaluation.status === 'CAUTION').length;
        const countNo = results.filter(r => r.evaluation.status === 'NO').length;
        document.getElementById('count-proceed').textContent = countProceed;
        document.getElementById('count-caution').textContent = countCaution;
        document.getElementById('count-no').textContent = countNo;
        
        if (filtered.length === 0) {
          document.getElementById('subsidies-list').innerHTML = 
            '<div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">' +
            '<i class="fas fa-search text-4xl mb-4"></i>' +
            '<p>条件に一致する補助金が見つかりませんでした</p>' +
            '<p class="text-sm mt-2">キーワードを変更するか、フィルターを調整してください</p></div>';
          return;
        }
        
        const html = filtered.map(item => {
          const s = item.subsidy;
          const e = item.evaluation;
          
          const statusConfig = {
            'PROCEED': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: 'fa-check-circle', label: '推奨' },
            'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: 'fa-exclamation-triangle', label: '注意' },
            'NO': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'fa-times-circle', label: '非推奨' }
          };
          const sc = statusConfig[e.status] || statusConfig['CAUTION'];
          
          // 締切までの日数
          const endDate = s.acceptance_end_datetime ? new Date(s.acceptance_end_datetime) : null;
          const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
          const urgencyClass = daysLeft !== null && daysLeft <= 14 ? 'text-red-600 font-bold' : 'text-gray-600';
          
          return \`
            <div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border-l-4 \${sc.border}">
              <div class="p-5">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2">
                      <span class="px-2 py-1 \${sc.bg} \${sc.text} rounded text-xs font-medium">
                        <i class="fas \${sc.icon} mr-1"></i>\${sc.label}
                      </span>
                      <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        スコア: \${e.score}%
                      </span>
                      \${e.risk_flags.length > 0 ? \`
                        <span class="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                          <i class="fas fa-flag mr-1"></i>リスク: \${e.risk_flags.length}件
                        </span>
                      \` : ''}
                    </div>
                    
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">
                      <a href="/subsidies/\${s.id}?company_id=\${document.getElementById('company-select').value}" 
                         class="hover:text-green-600 hover:underline">
                        \${s.title || s.name || '補助金名未設定'}
                      </a>
                    </h3>
                    
                    <p class="text-sm text-gray-600 mb-3 line-clamp-2">\${e.explanation || ''}</p>
                    
                    <div class="flex flex-wrap gap-4 text-sm">
                      <div class="flex items-center text-gray-600">
                        <i class="fas fa-building mr-1"></i>
                        \${s.subsidy_executing_organization || '事務局情報なし'}
                      </div>
                      <div class="flex items-center \${urgencyClass}">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        \${endDate ? \`締切: \${endDate.toLocaleDateString('ja-JP')}\` : '締切情報なし'}
                        \${daysLeft !== null ? \` (あと\${daysLeft}日)\` : ''}
                      </div>
                      <div class="flex items-center text-gray-600">
                        <i class="fas fa-yen-sign mr-1"></i>
                        上限: \${s.subsidy_max_limit ? Number(s.subsidy_max_limit).toLocaleString() + '円' : '情報なし'}
                      </div>
                    </div>
                  </div>
                  
                  <div class="ml-4 flex flex-col space-y-2">
                    <a href="/subsidies/\${s.id}?company_id=\${document.getElementById('company-select').value}" 
                       class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm text-center">
                      <i class="fas fa-arrow-right mr-1"></i>詳細を見る
                    </a>
                  </div>
                </div>
                
                \${e.match_reasons.length > 0 ? \`
                  <div class="mt-3 pt-3 border-t">
                    <div class="flex flex-wrap gap-2">
                      \${e.match_reasons.slice(0, 3).map(r => \`
                        <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          <i class="fas fa-check text-green-500 mr-1"></i>\${r}
                        </span>
                      \`).join('')}
                      \${e.match_reasons.length > 3 ? \`<span class="text-xs text-gray-500">+\${e.match_reasons.length - 3}件</span>\` : ''}
                    </div>
                  </div>
                \` : ''}
              </div>
            </div>
          \`;
        }).join('');
        
        document.getElementById('subsidies-list').innerHTML = html;
        
        // ページネーション
        if (meta && meta.total > parseInt(document.getElementById('limit').value)) {
          const totalPages = Math.ceil(meta.total / parseInt(document.getElementById('limit').value));
          let pagHtml = '';
          
          if (currentPage > 1) {
            pagHtml += \`<button onclick="searchSubsidies(\${currentPage - 1})" class="px-3 py-1 border rounded hover:bg-gray-50">前へ</button>\`;
          }
          
          for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            pagHtml += \`<button onclick="searchSubsidies(\${i})" class="px-3 py-1 border rounded \${i === currentPage ? 'bg-green-600 text-white' : 'hover:bg-gray-50'}">\${i}</button>\`;
          }
          
          if (currentPage < totalPages) {
            pagHtml += \`<button onclick="searchSubsidies(\${currentPage + 1})" class="px-3 py-1 border rounded hover:bg-gray-50">次へ</button>\`;
          }
          
          document.getElementById('pagination').innerHTML = pagHtml;
          document.getElementById('pagination').classList.remove('hidden');
        } else {
          document.getElementById('pagination').classList.add('hidden');
        }
      }
      
      // フィルター変更時に再描画
      document.getElementById('status-filter').addEventListener('change', () => {
        renderResults(currentResults, null);
      });
      
      // 初期化
      loadCompanies();
    </script>
  `;
  
  return c.html(subsidyLayout('補助金を探す', content));
});

/**
 * 補助金詳細ページ（S2）
 */
subsidyPages.get('/subsidies/:id', (c) => {
  const subsidyId = c.req.param('id');
  
  const content = `
    <div id="loading-detail" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
    
    <div id="subsidy-detail" class="hidden">
      <!-- パンくずリスト -->
      <nav class="mb-4 text-sm">
        <ol class="flex items-center space-x-2 text-gray-500">
          <li><a href="/subsidies" class="hover:text-green-600">補助金一覧</a></li>
          <li><i class="fas fa-chevron-right text-xs"></i></li>
          <li id="breadcrumb-title" class="text-gray-800 truncate max-w-md">詳細</li>
        </ol>
      </nav>
      
      <!-- ヘッダーセクション -->
      <div class="bg-white rounded-lg shadow mb-6">
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div id="status-badges" class="flex items-center space-x-2 mb-3">
                <!-- ステータスバッジはJSで挿入 -->
              </div>
              <h1 id="subsidy-title" class="text-2xl font-bold text-gray-800 mb-2"></h1>
              <p id="subsidy-org" class="text-gray-600"></p>
            </div>
            <div id="action-buttons" class="ml-6 flex flex-col space-y-2">
              <!-- アクションボタンはJSで挿入 -->
            </div>
          </div>
        </div>
        
        <!-- 基本情報カード -->
        <div class="border-t px-6 py-4 bg-gray-50">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div class="text-xs text-gray-500 mb-1">申請締切</div>
              <div id="info-deadline" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">補助上限額</div>
              <div id="info-max-limit" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">補助率</div>
              <div id="info-rate" class="font-semibold text-gray-800">-</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">対象地域</div>
              <div id="info-area" class="font-semibold text-gray-800">-</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- タブナビゲーション -->
      <div class="bg-white rounded-lg shadow">
        <div class="border-b">
          <nav class="flex -mb-px">
            <button onclick="switchTab('overview')" data-tab="overview" 
                    class="tab-btn px-6 py-3 border-b-2 border-green-600 text-green-600 font-medium">
              <i class="fas fa-info-circle mr-1"></i>概要
            </button>
            <button onclick="switchTab('eligibility')" data-tab="eligibility"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-clipboard-check mr-1"></i>申請要件
            </button>
            <button onclick="switchTab('documents')" data-tab="documents"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-file-alt mr-1"></i>必要書類
            </button>
            <button onclick="switchTab('evaluation')" data-tab="evaluation"
                    class="tab-btn px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
              <i class="fas fa-chart-bar mr-1"></i>マッチング結果
            </button>
          </nav>
        </div>
        
        <!-- タブコンテンツ -->
        <div class="p-6">
          <!-- 概要タブ -->
          <div id="tab-overview" class="tab-content">
            <div class="prose max-w-none">
              <h3 class="text-lg font-semibold mb-3">補助金の概要</h3>
              <div id="overview-content" class="text-gray-700 whitespace-pre-wrap"></div>
              
              <h3 class="text-lg font-semibold mt-6 mb-3">補助対象事業</h3>
              <div id="target-content" class="text-gray-700 whitespace-pre-wrap"></div>
              
              <h3 class="text-lg font-semibold mt-6 mb-3">添付ファイル</h3>
              <div id="attachments-list" class="space-y-2"></div>
            </div>
          </div>
          
          <!-- 申請要件タブ -->
          <div id="tab-eligibility" class="tab-content hidden">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">申請要件</h3>
              <p class="text-sm text-gray-600">この補助金に申請するための要件です。AUTO: 自動判定可能、MANUAL: 確認が必要</p>
            </div>
            
            <div id="eligibility-list" class="space-y-3">
              <p class="text-gray-500">要件情報を読み込み中...</p>
            </div>
            
            <div class="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 class="font-medium text-blue-800 mb-2">
                <i class="fas fa-lightbulb mr-1"></i>要件の読み込み
              </h4>
              <p class="text-sm text-blue-700 mb-3">
                公募要領から詳細な要件を抽出して表示できます。まだ読み込まれていない場合は下のボタンで取り込みを開始してください。
              </p>
              <button onclick="ingestEligibility()" id="btn-ingest" 
                      class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm">
                <i class="fas fa-download mr-1"></i>要件を読み込む
              </button>
            </div>
          </div>
          
          <!-- 必要書類タブ -->
          <div id="tab-documents" class="tab-content hidden">
            <div class="mb-4">
              <h3 class="text-lg font-semibold mb-2">必要書類一覧</h3>
              <p class="text-sm text-gray-600">申請に必要な書類です。<span class="text-green-600">●</span>準備済み <span class="text-yellow-600">●</span>要準備 <span class="text-gray-400">●</span>任意</p>
            </div>
            
            <div id="documents-list" class="space-y-2">
              <p class="text-gray-500">必要書類情報を読み込み中...</p>
            </div>
          </div>
          
          <!-- マッチング結果タブ -->
          <div id="tab-evaluation" class="tab-content hidden">
            <div id="evaluation-content">
              <p class="text-gray-500">会社を選択して検索を実行すると、マッチング結果が表示されます。</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 壁打ち開始CTA -->
      <div id="cta-section" class="hidden mt-6 bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold mb-2">この補助金で申請を進めますか？</h3>
            <p class="text-green-100">壁打ち機能で不足情報を確認し、申請書のドラフトを作成できます。</p>
          </div>
          <button onclick="startChat()" class="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 flex items-center">
            <i class="fas fa-comments mr-2"></i>壁打ちを開始
          </button>
        </div>
      </div>
    </div>
    
    <script>
      const subsidyId = '${subsidyId}';
      const companyId = new URLSearchParams(window.location.search).get('company_id');
      let subsidyData = null;
      
      // タブ切り替え
      function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
          if (btn.dataset.tab === tabName) {
            btn.classList.add('border-green-600', 'text-green-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
          } else {
            btn.classList.remove('border-green-600', 'text-green-600');
            btn.classList.add('border-transparent', 'text-gray-500');
          }
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        document.getElementById('tab-' + tabName).classList.remove('hidden');
      }
      
      // 詳細データ読み込み
      async function loadDetail() {
        try {
          const params = companyId ? '?company_id=' + companyId : '';
          const res = await api('/api/subsidies/' + subsidyId + params);
          
          if (!res.success) {
            throw new Error(res.error?.message || '詳細の取得に失敗しました');
          }
          
          subsidyData = res.data;
          renderDetail(res.data);
          
          // 要件・必要書類も取得
          loadEligibility();
          loadDocuments();
          
        } catch (e) {
          console.error('Load detail error:', e);
          document.getElementById('loading-detail').innerHTML = 
            '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>' + e.message + '</div>';
        }
      }
      
      // 詳細描画
      function renderDetail(data) {
        const s = data.subsidy;
        const e = data.evaluation;
        
        document.getElementById('loading-detail').classList.add('hidden');
        document.getElementById('subsidy-detail').classList.remove('hidden');
        
        // タイトル
        document.getElementById('breadcrumb-title').textContent = s.title || s.name || '補助金詳細';
        document.getElementById('subsidy-title').textContent = s.title || s.name || '補助金名未設定';
        document.getElementById('subsidy-org').innerHTML = '<i class="fas fa-building mr-1"></i>' + (s.subsidy_executing_organization || '事務局情報なし');
        
        // ステータスバッジ
        if (e) {
          const statusConfig = {
            'PROCEED': { bg: 'bg-green-100', text: 'text-green-800', icon: 'fa-check-circle', label: '推奨' },
            'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'fa-exclamation-triangle', label: '注意' },
            'NO': { bg: 'bg-red-100', text: 'text-red-800', icon: 'fa-times-circle', label: '非推奨' }
          };
          const sc = statusConfig[e.status] || statusConfig['CAUTION'];
          
          document.getElementById('status-badges').innerHTML = \`
            <span class="px-3 py-1 \${sc.bg} \${sc.text} rounded-full text-sm font-medium">
              <i class="fas \${sc.icon} mr-1"></i>\${sc.label}
            </span>
            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              スコア: \${e.score}%
            </span>
            \${e.risk_flags.length > 0 ? \`
              <span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                <i class="fas fa-flag mr-1"></i>リスク: \${e.risk_flags.length}件
              </span>
            \` : ''}
          \`;
          
          // CTAセクション表示（推奨/注意の場合）
          if (e.status !== 'NO' && companyId) {
            document.getElementById('cta-section').classList.remove('hidden');
          }
          
          // マッチング結果タブの内容
          document.getElementById('evaluation-content').innerHTML = \`
            <div class="space-y-4">
              <div class="p-4 \${sc.bg} rounded-lg">
                <div class="font-semibold \${sc.text} mb-2">
                  <i class="fas \${sc.icon} mr-1"></i>判定: \${sc.label} (スコア: \${e.score}%)
                </div>
                <p class="text-gray-700">\${e.explanation || '説明なし'}</p>
              </div>
              
              \${e.match_reasons.length > 0 ? \`
                <div>
                  <h4 class="font-medium text-gray-800 mb-2"><i class="fas fa-check text-green-500 mr-1"></i>マッチ理由</h4>
                  <ul class="space-y-1">
                    \${e.match_reasons.map(r => \`<li class="text-sm text-gray-700">・\${r}</li>\`).join('')}
                  </ul>
                </div>
              \` : ''}
              
              \${e.risk_flags.length > 0 ? \`
                <div>
                  <h4 class="font-medium text-gray-800 mb-2"><i class="fas fa-flag text-orange-500 mr-1"></i>リスクフラグ</h4>
                  <ul class="space-y-1">
                    \${e.risk_flags.map(r => \`<li class="text-sm text-orange-700">・\${r}</li>\`).join('')}
                  </ul>
                </div>
              \` : ''}
            </div>
          \`;
        }
        
        // 基本情報
        const endDate = s.acceptance_end_datetime ? new Date(s.acceptance_end_datetime) : null;
        const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        document.getElementById('info-deadline').innerHTML = endDate 
          ? endDate.toLocaleDateString('ja-JP') + (daysLeft !== null ? \` <span class="\${daysLeft <= 14 ? 'text-red-600' : 'text-gray-500'}">(あと\${daysLeft}日)</span>\` : '')
          : '情報なし';
        document.getElementById('info-max-limit').textContent = s.subsidy_max_limit 
          ? Number(s.subsidy_max_limit).toLocaleString() + '円' : '情報なし';
        document.getElementById('info-rate').textContent = s.subsidy_rate || '情報なし';
        document.getElementById('info-area').textContent = s.target_area || '全国';
        
        // 概要
        document.getElementById('overview-content').textContent = s.subsidy_summary || s.outline || '概要情報なし';
        document.getElementById('target-content').textContent = s.target || '対象事業情報なし';
        
        // 添付ファイル
        const attachments = data.attachments || [];
        if (attachments.length > 0) {
          document.getElementById('attachments-list').innerHTML = attachments.map(a => \`
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div class="flex items-center">
                <i class="fas fa-file-pdf text-red-500 mr-2"></i>
                <span class="text-sm">\${a.name}</span>
              </div>
              <a href="\${a.url}" target="_blank" class="text-blue-600 hover:underline text-sm">
                <i class="fas fa-external-link-alt mr-1"></i>開く
              </a>
            </div>
          \`).join('');
        } else {
          document.getElementById('attachments-list').innerHTML = '<p class="text-gray-500 text-sm">添付ファイルなし</p>';
        }
        
        // アクションボタン
        const actionsHtml = \`
          <a href="/subsidies" class="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 text-sm text-center">
            <i class="fas fa-arrow-left mr-1"></i>一覧に戻る
          </a>
          \${companyId && e && e.status !== 'NO' ? \`
            <button onclick="startChat()" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
              <i class="fas fa-comments mr-1"></i>壁打ちを開始
            </button>
          \` : ''}
        \`;
        document.getElementById('action-buttons').innerHTML = actionsHtml;
      }
      
      // 要件読み込み
      async function loadEligibility() {
        try {
          const res = await api('/api/subsidies/' + subsidyId + '/eligibility');
          if (res.success && res.data.length > 0) {
            const html = res.data.map(rule => {
              const typeLabel = rule.check_type === 'AUTO' ? 
                '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">AUTO</span>' :
                '<span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">MANUAL</span>';
              
              return \`
                <div class="p-3 bg-gray-50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-800">\${rule.category || '一般'}</span>
                    \${typeLabel}
                  </div>
                  <p class="text-sm text-gray-700">\${rule.rule_text}</p>
                  \${rule.source_text ? \`<p class="text-xs text-gray-500 mt-1">出典: \${rule.source_text}</p>\` : ''}
                </div>
              \`;
            }).join('');
            document.getElementById('eligibility-list').innerHTML = html;
          } else {
            document.getElementById('eligibility-list').innerHTML = 
              '<p class="text-gray-500">要件情報がまだ登録されていません。下の「要件を読み込む」ボタンで取り込みを開始できます。</p>';
          }
        } catch (e) {
          console.error('Load eligibility error:', e);
        }
      }
      
      // 必要書類読み込み
      async function loadDocuments() {
        try {
          const res = await api('/api/subsidies/' + subsidyId + '/documents');
          if (res.success && res.data.length > 0) {
            const html = res.data.map(doc => {
              const levelIcon = doc.required_level === 'required' ? 
                '<span class="text-red-500">●</span>' :
                doc.required_level === 'conditional' ? 
                '<span class="text-yellow-500">●</span>' :
                '<span class="text-gray-400">●</span>';
              
              return \`
                <div class="flex items-center justify-between p-3 border rounded-lg">
                  <div class="flex items-center">
                    \${levelIcon}
                    <span class="ml-2 font-medium">\${doc.name || doc.doc_code}</span>
                  </div>
                  <span class="text-xs text-gray-500">\${doc.required_level}</span>
                </div>
              \`;
            }).join('');
            document.getElementById('documents-list').innerHTML = html;
          } else {
            document.getElementById('documents-list').innerHTML = 
              '<p class="text-gray-500">必要書類情報がまだ登録されていません。</p>';
          }
        } catch (e) {
          console.error('Load documents error:', e);
        }
      }
      
      // 要件取り込みジョブ開始
      async function ingestEligibility() {
        const btn = document.getElementById('btn-ingest');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取り込み中...';
        
        try {
          const res = await api('/api/jobs/subsidies/' + subsidyId + '/ingest', { method: 'POST' });
          if (res.success) {
            alert('要件の取り込みジョブを開始しました。数分後に再読み込みしてください。');
          } else {
            alert('取り込みに失敗しました: ' + (res.error?.message || '不明なエラー'));
          }
        } catch (e) {
          alert('取り込みに失敗しました');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-download mr-1"></i>要件を読み込む';
        }
      }
      
      // 壁打ち開始
      function startChat() {
        if (!companyId) {
          alert('会社を選択してください');
          return;
        }
        window.location.href = '/chat?subsidy_id=' + subsidyId + '&company_id=' + companyId;
      }
      
      // 初期化
      loadDetail();
    </script>
  `;
  
  return c.html(subsidyLayout('補助金詳細', content));
});

export default subsidyPages;

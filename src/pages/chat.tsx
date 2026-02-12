/**
 * S3: 壁打ちチャット UI
 * 
 * /chat - 補助金申請に向けた壁打ちチャット画面
 * パラメータ: subsidy_id, company_id
 * 
 * Phase 19-B: 機能充実
 * - 補助金概要パネル追加
 * - 進捗バー（回答状況の可視化）
 * - 質問カテゴリ表示
 * - 完了時のサマリー表示
 * - クイック回答の多様化（boolean/number/text対応）
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const chatPages = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * 壁打ちチャットページ
 */
chatPages.get('/chat', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>壁打ちチャット - ホジョラク</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .chat-container { 
      height: calc(100vh - 360px); 
      min-height: 300px;
    }
    @media (max-width: 768px) {
      .chat-container { height: calc(100vh - 280px); }
    }
    .message-bubble {
      max-width: 85%;
    }
    .typing-indicator span {
      animation: typing 1.4s infinite ease-in-out;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    .progress-ring { transition: stroke-dashoffset 0.5s ease; }
    .slide-in { animation: slideIn 0.3s ease-out; }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .category-badge { font-size: 10px; letter-spacing: 0.5px; }
    /* Phase 20: ストリーミングカーソル */
    #streaming-content::after {
      content: '▌';
      animation: blink 0.7s infinite;
      color: #10b981;
      font-weight: bold;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <nav class="bg-white shadow-sm border-b sticky top-0 z-50">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14">
        <div class="flex items-center space-x-3">
          <a href="/subsidies" id="back-link" class="text-gray-500 hover:text-gray-700 p-2">
            <i class="fas fa-arrow-left"></i>
          </a>
          <div class="min-w-0">
            <h1 class="font-bold text-base text-gray-800 truncate">
              <i class="fas fa-comments text-green-600 mr-1"></i>壁打ちチャット
            </h1>
            <p id="subsidy-title" class="text-xs text-gray-500 truncate max-w-xs sm:max-w-md">読み込み中...</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span id="session-status" class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            <i class="fas fa-spinner fa-spin mr-1"></i>準備中
          </span>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-5xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
    <!-- 補助金概要パネル（Phase 19-B: 新機能） -->
    <div id="subsidy-overview-panel" class="hidden mb-3">
      <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h2 id="overview-title" class="font-bold text-gray-800 truncate"></h2>
            <p id="overview-summary" class="text-sm text-gray-600 mt-1 line-clamp-2"></p>
            <div class="flex flex-wrap gap-3 mt-2">
              <span id="overview-limit" class="text-xs bg-white px-2 py-1 rounded shadow-sm">
                <i class="fas fa-coins text-yellow-500 mr-1"></i>上限: -
              </span>
              <span id="overview-rate" class="text-xs bg-white px-2 py-1 rounded shadow-sm">
                <i class="fas fa-percentage text-blue-500 mr-1"></i>補助率: -
              </span>
              <span id="overview-deadline" class="text-xs bg-white px-2 py-1 rounded shadow-sm">
                <i class="fas fa-clock text-orange-500 mr-1"></i>締切: -
              </span>
            </div>
          </div>
          <button onclick="toggleOverviewPanel()" class="text-gray-400 hover:text-gray-600 ml-2 p-1" title="パネルを閉じる">
            <i class="fas fa-chevron-up" id="overview-toggle-icon"></i>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 進捗バー（Phase 19-B: 新機能） -->
    <div id="progress-section" class="hidden mb-3">
      <div class="bg-white rounded-lg shadow-sm border p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-600">
            <i class="fas fa-tasks mr-1"></i>回答進捗
          </span>
          <span id="progress-text" class="text-xs text-gray-500">0 / 0 件完了</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div id="progress-bar" class="bg-green-500 h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
        </div>
        <div id="progress-categories" class="flex flex-wrap gap-1 mt-2"></div>
      </div>
    </div>

    <!-- 事前判定結果パネル -->
    <div id="precheck-panel" class="hidden mb-3">
      <div id="precheck-ng" class="hidden bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
        <div class="flex items-start">
          <i class="fas fa-exclamation-circle text-red-500 text-lg mr-2 mt-0.5"></i>
          <div>
            <h3 class="font-semibold text-red-800 text-sm">この補助金には申請できません</h3>
            <ul id="blocked-reasons" class="mt-1 text-xs text-red-700 list-disc list-inside"></ul>
            <a href="/subsidies" class="inline-block mt-2 text-xs text-red-600 hover:text-red-800">
              <i class="fas fa-arrow-left mr-1"></i>他の補助金を探す
            </a>
          </div>
        </div>
      </div>
      
      <div id="precheck-ok" class="hidden bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg">
        <div class="flex items-center">
          <i class="fas fa-check-circle text-green-500 text-lg mr-2"></i>
          <div class="flex-1">
            <h3 class="font-semibold text-green-800 text-sm">申請要件を満たしています</h3>
            <p class="text-xs text-green-700 mt-0.5">申請書のドラフト作成に進むことができます。</p>
          </div>
          <button onclick="goToDraft()" class="ml-3 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-xs whitespace-nowrap">
            <i class="fas fa-file-alt mr-1"></i>申請書を作成
          </button>
        </div>
      </div>
      
      <div id="precheck-missing" class="hidden bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 text-lg mr-2 mt-0.5"></i>
          <div>
            <h3 class="font-semibold text-blue-800 text-sm">追加の確認が必要です</h3>
            <p class="text-xs text-blue-700 mt-0.5">以下の質問にお答えください。回答に応じて申請可否を判定します。</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- チャットエリア -->
    <div class="bg-white rounded-lg shadow chat-container flex flex-col">
      <!-- メッセージリスト -->
      <div id="messages" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div id="loading-messages" class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
      
      <!-- タイピングインジケーター -->
      <div id="typing-indicator" class="hidden px-4 pb-2">
        <div class="typing-indicator flex items-center text-gray-400 text-sm">
          <span class="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
          <span class="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
          <span class="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
          アシスタントが確認中...
        </div>
      </div>
      
      <!-- 入力エリア -->
      <div id="input-area" class="border-t p-3">
        <!-- 質問カテゴリ表示 -->
        <div id="current-category" class="hidden mb-2">
          <span class="category-badge inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wider">
            <i class="fas fa-tag mr-1"></i><span id="category-label">一般</span>
          </span>
        </div>
        
        <div class="flex items-center space-x-2">
          <div class="flex-1">
            <input type="text" id="message-input" 
                   placeholder="メッセージを入力..." 
                   class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                   onkeypress="if(event.key==='Enter')sendMessage()"
                   autocomplete="off">
          </div>
          <button onclick="openUploadDialog()" title="資料をアップロード"
                  class="bg-gray-100 text-gray-600 px-3 py-2.5 rounded-lg hover:bg-gray-200 text-sm">
            <i class="fas fa-paperclip"></i>
          </button>
          <button onclick="sendMessage()" id="send-btn"
                  class="bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
        
        <!-- クイック回答ボタン（入力タイプに応じて動的に変化） -->
        <div id="quick-answers" class="hidden mt-2 flex flex-wrap gap-1.5">
          <!-- デフォルト: boolean型 -->
          <div id="quick-boolean" class="flex gap-1.5">
            <button onclick="quickAnswer('はい')" class="px-3 py-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 text-xs font-medium">
              <i class="fas fa-check mr-1"></i>はい
            </button>
            <button onclick="quickAnswer('いいえ')" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 text-xs font-medium">
              <i class="fas fa-times mr-1"></i>いいえ
            </button>
            <button onclick="quickAnswer('わからない')" class="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full hover:bg-yellow-100 text-xs font-medium">
              <i class="fas fa-question mr-1"></i>わからない
            </button>
          </div>
          <!-- number型のヒント -->
          <div id="quick-number" class="hidden">
            <span class="text-xs text-gray-400"><i class="fas fa-info-circle mr-1"></i>数値を入力してください</span>
          </div>
          <!-- text型のヒント -->
          <div id="quick-text" class="hidden">
            <span class="text-xs text-gray-400"><i class="fas fa-info-circle mr-1"></i>自由にお答えください</span>
          </div>
        </div>
      </div>
      
      <!-- Phase 19: 構造化質問完了 → コンシェルジュモード移行 -->
      <div id="completion-area" class="hidden border-t p-4 bg-gradient-to-r from-green-50 to-emerald-50">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-semibold text-gray-800 text-sm">
              <i class="fas fa-check-circle text-green-600 mr-1"></i>基本情報の収集完了
            </h4>
            <p class="text-xs text-gray-600">引き続きコンシェルジュに相談できます。申請書作成にも進めます。</p>
          </div>
          <div class="flex gap-2">
            <button onclick="switchToConsulting()" class="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-xs font-medium">
              <i class="fas fa-robot mr-1"></i>AIに相談
            </button>
            <button onclick="goToDraft()" class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-xs font-medium">
              <i class="fas fa-file-alt mr-1"></i>申請書作成
            </button>
          </div>
        </div>
      </div>
      
      <!-- Phase 19: コンシェルジュモード入力エリア -->
      <div id="consulting-input-area" class="hidden border-t p-3">
        <div class="mb-2">
          <span class="text-xs text-indigo-600 font-medium">
            <i class="fas fa-robot mr-1"></i>AIコンシェルジュモード - 何でもご相談ください
          </span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="flex-1">
            <input type="text" id="consulting-input" 
                   placeholder="補助金について何でもお聞きください..." 
                   class="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                   onkeypress="if(event.key==='Enter')sendConsultingMessage()"
                   autocomplete="off">
          </div>
          <button onclick="openUploadDialog()" title="資料をアップロード"
                  class="bg-gray-100 text-gray-600 px-3 py-2.5 rounded-lg hover:bg-gray-200 text-sm">
            <i class="fas fa-paperclip"></i>
          </button>
          <button onclick="sendConsultingMessage()" id="consulting-send-btn"
                  class="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
        <!-- 提案質問ボタン -->
        <div id="suggested-questions" class="hidden mt-2 flex flex-wrap gap-1.5"></div>
        <!-- アクションボタン -->
        <div class="mt-2 flex gap-2 flex-wrap">
          <button onclick="goToDraft()" class="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-full hover:bg-green-100">
            <i class="fas fa-file-alt mr-1"></i>申請書を作成
          </button>
          <button onclick="askAboutRequirements()" class="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100">
            <i class="fas fa-clipboard-check mr-1"></i>申請要件を確認
          </button>
          <button onclick="askAboutDocuments()" class="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100">
            <i class="fas fa-folder-open mr-1"></i>必要書類を確認
          </button>
          <button onclick="askAboutStrategy()" class="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full hover:bg-orange-100">
            <i class="fas fa-lightbulb mr-1"></i>採択のコツ
          </button>
          <button onclick="askAboutSchedule()" class="text-xs px-3 py-1.5 bg-teal-50 text-teal-700 rounded-full hover:bg-teal-100">
            <i class="fas fa-calendar-alt mr-1"></i>スケジュール確認
          </button>
        </div>
      </div>
    </div>
    
    <!-- 収集済み情報サマリー（Phase 19-B: 新機能） -->
    <div id="facts-summary" class="hidden mt-3">
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="p-3 border-b bg-gray-50 flex items-center justify-between cursor-pointer" onclick="toggleFactsSummary()">
          <h4 class="text-sm font-medium text-gray-700">
            <i class="fas fa-clipboard-list text-green-600 mr-1"></i>収集済み情報
            <span id="facts-count" class="ml-1 text-xs text-gray-400">(0件)</span>
          </h4>
          <i class="fas fa-chevron-down text-gray-400" id="facts-toggle-icon"></i>
        </div>
        <div id="facts-list" class="p-3 space-y-2 hidden"></div>
      </div>
    </div>
    
    <!-- 会社・補助金情報サマリー -->
    <div id="info-summary" class="hidden mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="bg-white rounded-lg shadow-sm border p-3">
        <h4 class="text-xs font-medium text-gray-500 mb-1.5"><i class="fas fa-building mr-1"></i>会社情報</h4>
        <div id="company-info" class="text-xs text-gray-700 space-y-0.5">
          <p><strong>会社名:</strong> <span id="company-name">-</span></p>
          <p><strong>所在地:</strong> <span id="company-prefecture">-</span></p>
          <p><strong>従業員数:</strong> <span id="company-employees">-</span>人</p>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-3">
        <h4 class="text-xs font-medium text-gray-500 mb-1.5"><i class="fas fa-coins mr-1"></i>補助金情報</h4>
        <div id="subsidy-info" class="text-xs text-gray-700 space-y-0.5">
          <p><strong>補助上限:</strong> <span id="subsidy-max">-</span></p>
          <p><strong>申請締切:</strong> <span id="subsidy-deadline">-</span></p>
        </div>
      </div>
    </div>
  </main>
  
  <!-- 隠しファイル入力 -->
  <input type="file" id="file-upload-input" class="hidden"
         accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx,.doc,.xls,.txt,.csv"
         onchange="handleFileSelected(event)">
  
  <!-- アップロードモーダル -->
  <div id="upload-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-800">
          <i class="fas fa-cloud-upload-alt text-blue-500 mr-2"></i>資料アップロード
        </h3>
        <button onclick="closeUploadModal()" class="text-gray-400 hover:text-gray-600 p-1">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>
      
      <div id="upload-drop-zone" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer"
           onclick="document.getElementById('file-upload-input').click()"
           ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'bg-blue-50')"
           ondragleave="this.classList.remove('border-blue-500', 'bg-blue-50')"
           ondrop="handleFileDrop(event)">
        <i class="fas fa-file-upload text-gray-400 text-3xl mb-3"></i>
        <p class="text-sm text-gray-600">クリックまたはドラッグ&ドロップでファイルを選択</p>
        <p class="text-xs text-gray-400 mt-1">PDF / 画像 / Word / Excel（最大10MB）</p>
      </div>
      
      <!-- 選択済みファイル表示 -->
      <div id="selected-file-info" class="hidden mt-4 p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center">
          <i id="selected-file-icon" class="fas fa-file text-blue-500 text-lg mr-3"></i>
          <div class="flex-1 min-w-0">
            <p id="selected-file-name" class="text-sm font-medium text-gray-800 truncate"></p>
            <p id="selected-file-size" class="text-xs text-gray-500"></p>
          </div>
          <button onclick="clearSelectedFile()" class="text-gray-400 hover:text-red-500 ml-2">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <!-- 書類種別選択 -->
      <div id="doc-type-selector" class="hidden mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">書類の種類</label>
        <select id="doc-type-select" class="w-full border rounded-lg px-3 py-2 text-sm">
          <option value="other">その他の資料</option>
          <option value="financial_statement">決算書（貸借対照表・損益計算書）</option>
          <option value="tax_return">確定申告書</option>
          <option value="business_plan">事業計画書</option>
          <option value="registration">登記簿謄本（履歴事項全部証明書）</option>
          <option value="quotation">見積書・請求書</option>
        </select>
      </div>
      
      <!-- アップロードボタン -->
      <div class="mt-4 flex gap-2">
        <button id="upload-submit-btn" onclick="submitUpload()" disabled
                class="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium">
          <i class="fas fa-upload mr-1"></i>アップロード
        </button>
        <button onclick="closeUploadModal()"
                class="px-4 py-2.5 border rounded-lg hover:bg-gray-50 text-sm text-gray-600">
          キャンセル
        </button>
      </div>
      
      <!-- アップロード進捗 -->
      <div id="upload-progress" class="hidden mt-4">
        <div class="flex items-center">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          <span class="text-sm text-gray-600">アップロード中...</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- アップロード済み書類パネル -->
  <div id="uploaded-docs-panel" class="hidden max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-3 mb-3">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="p-3 border-b bg-gray-50 flex items-center justify-between cursor-pointer" onclick="toggleDocsPanel()">
        <h4 class="text-sm font-medium text-gray-700">
          <i class="fas fa-folder-open text-blue-500 mr-1"></i>アップロード済み資料
          <span id="docs-count" class="ml-1 text-xs text-gray-400">(0件)</span>
        </h4>
        <i class="fas fa-chevron-down text-gray-400" id="docs-toggle-icon"></i>
      </div>
      <div id="docs-list" class="p-3 space-y-2 hidden"></div>
    </div>
  </div>
  
  <script>
    // ============================================================
    // 共通初期化スクリプト
    // ============================================================
    var token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
    }
    
    // グローバルAPI呼び出しヘルパー（15秒タイムアウト付き）
    window.api = async function(path, options) {
      options = options || {};
      var headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      };
      if (options.headers) {
        for (var key in options.headers) { headers[key] = options.headers[key]; }
      }
      var fetchOptions = { method: options.method || 'GET', headers: headers };
      if (options.body) { fetchOptions.body = options.body; }
      // AbortController でタイムアウト制御（30秒: AI応答生成に時間がかかるため）
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 30000);
      fetchOptions.signal = controller.signal;
      try {
        var res = await fetch(path, fetchOptions);
        clearTimeout(timeoutId);
        var data = await res.json();
        if (res.status === 401 || (data && data.error && data.error.code === 'UNAUTHORIZED')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          alert('セッションの有効期限が切れました。再度ログインしてください。');
          window.location.href = '/login';
          return data;
        }
        return data;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.error('API呼び出しタイムアウト:', path);
          return { success: false, error: { code: 'TIMEOUT', message: 'サーバーへの接続がタイムアウトしました。しばらくしてから再度お試しください。' } };
        }
        console.error('API呼び出しエラー:', err);
        return { success: false, error: { code: 'NETWORK_ERROR', message: '通信エラーが発生しました' } };
      }
    };
    
    // URLパラメータ取得
    var params = new URLSearchParams(window.location.search);
    var subsidyId = params.get('subsidy_id');
    var companyId = params.get('company_id');
    var existingSessionId = params.get('session_id');
    var fromContext = params.get('from');
    var backUrl = params.get('back');
    
    // P0-1凍結: fromパラメータに応じて戻りリンクを動的に変更
    if (fromContext === 'agency' && backUrl) {
      var backArrow = document.getElementById('back-link');
      if (backArrow) backArrow.href = backUrl;
    }
    
    var isResumeMode = !!existingSessionId;
    if (!isResumeMode && (!subsidyId || !companyId)) {
      alert('補助金または会社が指定されていません');
      window.location.href = (fromContext === 'agency' && backUrl) ? backUrl : '/subsidies';
    }
    
    var sessionId = existingSessionId || null;
    var sessionCompleted = false;
    var consultingMode = false;
    var totalQuestions = 0;
    var answeredQuestions = 0;
    var currentInputType = 'boolean';
    var collectedFacts = [];
    var overviewCollapsed = false;
    
    // HTMLエスケープ
    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // マークダウン記法を除去（AIがプレーンテキスト指示を無視する場合の対策）
    function stripMarkdown(text) {
      if (!text) return '';
      return text
        .replace(/\\*\\*([^*]+)\\*\\*/g, '$1')
        .replace(/\\*([^*]+)\\*/g, '$1')
        .replace(/^#{1,6}\\s+/gm, '')
        .replace(/^[-*+]\\s+/gm, '・')
        .replace(/\x60([^\x60]+)\x60/g, '$1');
    }
    
    // 通貨フォーマット
    function formatCurrency(value) {
      if (!value) return '-';
      if (value >= 100000000) return (value / 100000000).toFixed(1) + '億円';
      if (value >= 10000) return Math.floor(value / 10000) + '万円';
      return value + '円';
    }
    
    // 日付フォーマット
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      try {
        return new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch { return dateStr; }
    }
    
    // メッセージを追加（Phase 19-B: カテゴリバッジ対応）
    function addMessage(role, content, animate, category) {
      animate = animate !== false;
      var messagesDiv = document.getElementById('messages');
      var loadingDiv = document.getElementById('loading-messages');
      if (loadingDiv) loadingDiv.remove();
      
      var msgDiv = document.createElement('div');
      msgDiv.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start') + (animate ? ' slide-in' : '');
      
      var bubbleClass = role === 'user' 
        ? 'bg-green-600 text-white' 
        : role === 'system'
          ? 'bg-gray-100 text-gray-800 border border-gray-200'
          : 'bg-white border border-gray-200 text-gray-800 shadow-sm';
      
      var icon = role === 'user' 
        ? '<div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mr-2 flex-shrink-0"><i class="fas fa-user text-white text-xs"></i></div>'
        : role === 'system'
          ? '<div class="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center mr-2 flex-shrink-0"><i class="fas fa-info text-gray-600 text-xs"></i></div>'
          : '<div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0"><i class="fas fa-robot text-green-600 text-xs"></i></div>';
      
      var categoryHtml = (category && role === 'assistant') 
        ? '<div class="mb-1"><span class="category-badge inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"><i class="fas fa-tag mr-1"></i>' + escapeHtml(category) + '</span></div>'
        : '';
      
      msgDiv.innerHTML = 
        '<div class="message-bubble ' + bubbleClass + ' rounded-lg px-3 py-2.5">' +
          '<div class="flex items-start">' +
            icon +
            '<div class="min-w-0">' +
              categoryHtml +
              '<div class="whitespace-pre-wrap text-sm leading-relaxed">' + escapeHtml(stripMarkdown(content)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      
      messagesDiv.appendChild(msgDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    // 進捗バー更新
    function updateProgress(answered, total) {
      totalQuestions = total;
      answeredQuestions = answered;
      
      var section = document.getElementById('progress-section');
      if (total <= 0) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');
      
      var pct = Math.round((answered / total) * 100);
      document.getElementById('progress-bar').style.width = pct + '%';
      document.getElementById('progress-text').textContent = answered + ' / ' + total + ' 件完了 (' + pct + '%)';
    }
    
    // クイック回答の入力タイプ切替
    function setInputType(type) {
      currentInputType = type;
      var quickArea = document.getElementById('quick-answers');
      quickArea.classList.remove('hidden');
      
      document.getElementById('quick-boolean').classList.add('hidden');
      document.getElementById('quick-number').classList.add('hidden');
      document.getElementById('quick-text').classList.add('hidden');
      
      if (type === 'boolean') {
        document.getElementById('quick-boolean').classList.remove('hidden');
      } else if (type === 'number') {
        document.getElementById('quick-number').classList.remove('hidden');
        document.getElementById('message-input').type = 'number';
        document.getElementById('message-input').placeholder = '数値を入力...';
      } else {
        document.getElementById('quick-text').classList.remove('hidden');
        document.getElementById('message-input').type = 'text';
        document.getElementById('message-input').placeholder = '自由に記入してください...';
      }
    }
    
    // 概要パネル折りたたみ
    function toggleOverviewPanel() {
      var panel = document.getElementById('subsidy-overview-panel');
      var icon = document.getElementById('overview-toggle-icon');
      overviewCollapsed = !overviewCollapsed;
      
      if (overviewCollapsed) {
        panel.querySelector('.flex-1').classList.add('hidden');
        panel.querySelector('.flex.flex-wrap').classList.add('hidden');
        icon.className = 'fas fa-chevron-down';
      } else {
        panel.querySelector('.flex-1').classList.remove('hidden');
        icon.className = 'fas fa-chevron-up';
      }
    }
    
    // 収集済み情報の折りたたみ
    function toggleFactsSummary() {
      var list = document.getElementById('facts-list');
      var icon = document.getElementById('facts-toggle-icon');
      list.classList.toggle('hidden');
      icon.className = list.classList.contains('hidden') ? 'fas fa-chevron-down text-gray-400' : 'fas fa-chevron-up text-gray-400';
    }
    
    // 収集済み情報を更新
    function updateFactsSummary(key, question, answer) {
      collectedFacts.push({ key: key, question: question, answer: answer });
      
      var container = document.getElementById('facts-summary');
      container.classList.remove('hidden');
      document.getElementById('facts-count').textContent = '(' + collectedFacts.length + '件)';
      
      var listEl = document.getElementById('facts-list');
      var factHtml = '<div class="flex items-start text-xs">' +
        '<i class="fas fa-check-circle text-green-500 mr-2 mt-0.5"></i>' +
        '<div><span class="text-gray-500">' + escapeHtml(question.substring(0, 50)) + '</span>' +
        '<br><span class="font-medium text-gray-800">' + escapeHtml(String(answer)) + '</span></div>' +
        '</div>';
      listEl.innerHTML += factHtml;
    }
    
    // 補助金概要パネルの読み込み
    async function loadSubsidyOverview() {
      if (!subsidyId) return;
      try {
        var res = await api('/api/subsidies/' + subsidyId + (companyId ? '?company_id=' + companyId : ''));
        if (res.success && res.data) {
          var n = res.data.normalized;
          var s = res.data.subsidy;
          
          var panel = document.getElementById('subsidy-overview-panel');
          panel.classList.remove('hidden');
          
          document.getElementById('overview-title').textContent = n?.display?.title || s?.title || '-';
          
          var summary = n?.overview?.summary || s?.subsidy_summary || s?.outline || '';
          if (typeof summary === 'object') summary = summary.summary || '';
          document.getElementById('overview-summary').textContent = summary.substring(0, 150) + (summary.length > 150 ? '...' : '');
          
          var maxLimit = n?.display?.subsidy_max_limit ?? s?.subsidy_max_limit;
          document.getElementById('overview-limit').innerHTML = '<i class="fas fa-coins text-yellow-500 mr-1"></i>上限: ' + formatCurrency(maxLimit);
          
          var rate = n?.display?.subsidy_rate_text || s?.subsidy_rate;
          document.getElementById('overview-rate').innerHTML = '<i class="fas fa-percentage text-blue-500 mr-1"></i>補助率: ' + (rate || '-');
          
          var deadline = n?.acceptance?.acceptance_end || s?.acceptance_end_datetime;
          document.getElementById('overview-deadline').innerHTML = '<i class="fas fa-clock text-orange-500 mr-1"></i>締切: ' + formatDate(deadline);
        }
      } catch (e) {
        console.warn('補助金概要の読み込み失敗:', e);
      }
    }
    
    // セッション初期化
    async function initSession() {
      try {
        // 新規モードの場合は補助金概要パネルを並行で読み込み（subsidyIdが既知のため）
        if (!isResumeMode) {
          loadSubsidyOverview();
        }
        
        var res;
        if (isResumeMode && existingSessionId) {
          console.log('[壁打ち] セッション復元モード:', existingSessionId);
          res = await api('/api/chat/sessions/' + existingSessionId);
          if (!res.success) {
            alert('セッションが見つかりませんでした。');
            window.location.href = '/subsidies';
            return;
          }
          if (res.data.session) {
            subsidyId = res.data.session.subsidy_id;
            companyId = res.data.session.company_id;
            // Phase 22: 復元モードではセッション取得後に概要を読み込む
            loadSubsidyOverview();
          }
        } else {
          console.log('[壁打ち] 新規セッション作成モード');
          res = await api('/api/chat/sessions', {
            method: 'POST',
            body: JSON.stringify({ company_id: companyId, subsidy_id: subsidyId })
          });
        }
        
        if (!res.success) throw new Error(res.error?.message || 'セッション作成に失敗しました');
        
        var data = res.data;
        var session = data.session;
        var messages = data.messages;
        var precheck = data.precheck;
        sessionId = session.id;
        
        // 補助金タイトル
        document.getElementById('subsidy-title').textContent = session.subsidy_title || '補助金';
        
        // 進捗バー初期化
        if (precheck && precheck.missing_items) {
          totalQuestions = precheck.missing_items.length;
          // 復元時: ユーザーの回答数から進捗を計算
          var userMsgCount = 0;
          if (messages && messages.length > 0) {
            for (var mi = 0; mi < messages.length; mi++) {
              if (messages[mi].role === 'user') userMsgCount++;
            }
          }
          answeredQuestions = Math.min(userMsgCount, totalQuestions);
          updateProgress(answeredQuestions, totalQuestions);
        }
        
        // 事前判定結果の表示
        if (precheck && precheck.status) {
          document.getElementById('precheck-panel').classList.remove('hidden');
          
          if (precheck.status === 'NG') {
            document.getElementById('precheck-ng').classList.remove('hidden');
            document.getElementById('blocked-reasons').innerHTML = 
              (precheck.blocked_reasons || []).map(function(r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('');
            document.getElementById('input-area').classList.add('hidden');
            document.getElementById('session-status').innerHTML = '<i class="fas fa-ban mr-1"></i>申請不可';
            document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-red-100 text-red-700';
          } else if (precheck.status === 'OK') {
            document.getElementById('precheck-ok').classList.remove('hidden');
            document.getElementById('input-area').classList.add('hidden');
            document.getElementById('completion-area').classList.remove('hidden');
            document.getElementById('session-status').innerHTML = '<i class="fas fa-check mr-1"></i>申請可能';
            document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-700';
            sessionCompleted = true;
          } else {
            document.getElementById('precheck-missing').classList.remove('hidden');
            document.getElementById('quick-answers').classList.remove('hidden');
            document.getElementById('session-status').innerHTML = '<i class="fas fa-comments mr-1"></i>確認中 (' + (precheck.missing_items ? precheck.missing_items.length : '?') + '問)';
            document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700';
            
            // 最初の質問のinput_typeでクイック回答を設定
            if (precheck.missing_items && precheck.missing_items.length > 0) {
              setInputType(precheck.missing_items[0].input_type || 'boolean');
            }
          }
          
          // 会社・補助金情報
          if (precheck.company_info) {
            document.getElementById('company-name').textContent = precheck.company_info.name || '-';
            document.getElementById('company-prefecture').textContent = precheck.company_info.prefecture || '-';
            document.getElementById('company-employees').textContent = precheck.company_info.employee_count || '-';
          }
          if (precheck.subsidy_info) {
            document.getElementById('subsidy-max').textContent = formatCurrency(precheck.subsidy_info.max_amount);
            document.getElementById('subsidy-deadline').textContent = formatDate(precheck.subsidy_info.acceptance_end);
          }
        } else {
          document.getElementById('precheck-panel').classList.remove('hidden');
          document.getElementById('precheck-missing').classList.remove('hidden');
          document.getElementById('quick-answers').classList.remove('hidden');
          document.getElementById('session-status').innerHTML = '<i class="fas fa-comments mr-1"></i>確認中';
          document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700';
        }
        document.getElementById('info-summary').classList.remove('hidden');
        
        // メッセージ表示
        var loadingDiv = document.getElementById('loading-messages');
        if (loadingDiv) loadingDiv.remove();
        
        for (var i = 0; i < messages.length; i++) {
          addMessage(messages[i].role, messages[i].content, false);
        }
        
        // セッション完了チェック
        if (session.status === 'completed' || session.status === 'consulting') {
          if (session.status === 'consulting') {
            // Phase 19: コンシェルジュモードで再開
            consultingMode = true;
            document.getElementById('input-area').classList.add('hidden');
            document.getElementById('consulting-input-area').classList.remove('hidden');
            document.getElementById('session-status').innerHTML = '<i class="fas fa-robot mr-1"></i>AI相談モード';
            document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700';
            updateProgress(totalQuestions, totalQuestions);
          } else {
            sessionCompleted = true;
            document.getElementById('input-area').classList.add('hidden');
            document.getElementById('completion-area').classList.remove('hidden');
            document.getElementById('session-status').innerHTML = '<i class="fas fa-check mr-1"></i>基本情報収集完了';
            document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-700';
            updateProgress(totalQuestions, totalQuestions);
          }
        }
        
      } catch (error) {
        console.error('Init session error:', error);
        alert('エラー: ' + error.message);
        if (subsidyId && companyId) {
          window.location.href = '/subsidies/' + encodeURIComponent(subsidyId) + '?company_id=' + encodeURIComponent(companyId);
        } else {
          window.location.href = '/subsidies';
        }
      }
    }
    
    // メッセージ送信
    var lastQuestionText = '';
    
    async function sendMessage() {
      if (sessionCompleted || consultingMode) {
        if (consultingMode) { sendConsultingMessage(); return; }
        return;
      }
      
      var input = document.getElementById('message-input');
      var content = input.value.trim();
      if (!content) return;
      
      input.value = '';
      input.type = 'text';
      input.placeholder = 'メッセージを入力...';
      
      addMessage('user', content);
      
      // Phase 20: 送信時は一旦 lastQuestionText を保存（バリデーション結果で使うかどうか判断）
      var pendingQuestion = lastQuestionText;
      var pendingContent = content;
      
      var sendBtn = document.getElementById('send-btn');
      sendBtn.disabled = true;
      document.getElementById('typing-indicator').classList.remove('hidden');
      
      try {
        var res = await api('/api/chat/sessions/' + sessionId + '/message', {
          method: 'POST',
          body: JSON.stringify({ content: content })
        });
        
        if (!res.success) throw new Error(res.error?.message || 'メッセージ送信に失敗しました');
        
        document.getElementById('typing-indicator').classList.add('hidden');
        
        // アシスタントメッセージ表示
        addMessage('assistant', res.data.assistant_message.content);
        
        // 次の質問ラベルを表示（構造化質問フェーズで次の質問がある場合）
        if (res.data.next_question && res.data.next_question.label && !res.data.consulting_mode) {
          lastQuestionText = res.data.next_question.label;
          addMessage('system', res.data.next_question.label, true, '質問');
        } else {
          lastQuestionText = res.data.assistant_message.content.split('\\n')[0];
        }
        
        // Phase 20: バリデーション失敗時は進捗を更新しない（同じ質問を再度聞いている）
        var remaining = res.data.remaining_questions;
        if (res.data.answer_invalid) {
          // 回答が不適切だった場合: 進捗は変えない、入力タイプも維持
          console.log('[壁打ち] 回答バリデーション失敗:', res.data.answer_invalid_reason);
        } else {
          // 正常回答: 進捗を更新 & 収集済み情報に追加
          answeredQuestions = totalQuestions - remaining - 1;
          if (answeredQuestions < 0) answeredQuestions = 0;
          updateProgress(answeredQuestions + 1, totalQuestions);
          
          if (pendingQuestion) {
            updateFactsSummary('q_' + answeredQuestions, pendingQuestion, pendingContent);
          }
        }
        
        // ステータス更新
        document.getElementById('session-status').innerHTML = 
          '<i class="fas fa-comments mr-1"></i>確認中 (残' + (remaining + 1) + '問)';
        
        // 次の質問のinput_typeを構造化データから取得
        if (res.data.next_question && res.data.next_question.input_type) {
          var nqType = res.data.next_question.input_type;
          if (nqType === 'boolean') {
            setInputType('boolean');
          } else if (nqType === 'number') {
            setInputType('number');
          } else if (nqType === 'select') {
            setInputType('boolean'); // select は boolean UIで代用
          } else {
            setInputType('text');
          }
        } else {
          // フォールバック: レスポンステキストから推測
          var msgContent = res.data.assistant_message.content;
          if (msgContent.includes('\u300c\u306f\u3044\u300d\u307e\u305f\u306f\u300c\u3044\u3044\u3048\u300d')) {
            setInputType('boolean');
          } else if (msgContent.includes('\u6570\u5024\u3067\u304a\u7b54\u3048')) {
            setInputType('number');
          } else {
            setInputType('text');
          }
        }
        
        // セッション完了チェック
        if (res.data.session_completed || res.data.consulting_mode) {
          if (res.data.consulting_mode) {
            // Phase 19: コンシェルジュモードへ移行
            switchToConsulting();
            
            // 提案質問を表示
            if (res.data.suggested_questions && res.data.suggested_questions.length > 0) {
              showSuggestedQuestions(res.data.suggested_questions);
            }
          }
          
          if (res.data.remaining_questions <= 0 && !consultingMode) {
            // 構造化質問完了 → コンシェルジュ移行を提示
            document.getElementById('input-area').classList.add('hidden');
            document.getElementById('completion-area').classList.remove('hidden');
            document.getElementById('quick-answers').classList.add('hidden');
            document.getElementById('precheck-missing').classList.add('hidden');
            document.getElementById('session-status').innerHTML = '<i class="fas fa-check mr-1"></i>基本情報収集完了';
            document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-700';
            updateProgress(totalQuestions, totalQuestions);
          }
        }
        
        // コンサルティングモードでの提案質問更新
        if (consultingMode && res.data.suggested_questions && res.data.suggested_questions.length > 0) {
          showSuggestedQuestions(res.data.suggested_questions);
        }
        
      } catch (error) {
        console.error('Send message error:', error);
        document.getElementById('typing-indicator').classList.add('hidden');
        addMessage('system', 'エラー: ' + error.message);
      } finally {
        sendBtn.disabled = false;
      }
    }
    
    // クイック回答
    function quickAnswer(answer) {
      document.getElementById('message-input').value = answer;
      sendMessage();
    }
    
    // 申請書作成へ
    function goToDraft() {
      window.location.href = '/draft?session_id=' + sessionId;
    }
    
    // Phase 19: コンシェルジュモードへ切り替え
    function switchToConsulting() {
      consultingMode = true;
      sessionCompleted = false;
      
      // UIモード切り替え
      document.getElementById('input-area').classList.add('hidden');
      document.getElementById('completion-area').classList.add('hidden');
      document.getElementById('consulting-input-area').classList.remove('hidden');
      document.getElementById('quick-answers').classList.add('hidden');
      
      // ヘッダーステータス更新
      document.getElementById('session-status').innerHTML = '<i class="fas fa-robot mr-1"></i>AI相談モード';
      document.getElementById('session-status').className = 'text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700';
      
      // コンシェルジュ歓迎メッセージ
      addMessage('assistant', '基本情報の確認が完了しました！ここからはAIコンシェルジュとして、補助金申請に関するあらゆるご相談にお応えします。' + '\\n\\n例えば：\\n・申請要件の詳しい解説\\n・事業計画の方向性と書き方のコツ\\n・必要書類の準備のポイント\\n・採択率を上げるための加点項目の取得戦略\\n・申請スケジュールの管理\\n\\n何でもお気軽にお聞きください。一緒に申請の準備を進めましょう！');
      
      // フォーカス
      var input = document.getElementById('consulting-input');
      if (input) input.focus();
    }
    
    // Phase 19: コンシェルジュモードでメッセージ送信（Phase 20: SSEストリーミング対応）
    async function sendConsultingMessage() {
      var input = document.getElementById('consulting-input');
      var content = input.value.trim();
      if (!content) return;
      
      input.value = '';
      addMessage('user', content);
      
      // 提案質問を非表示
      document.getElementById('suggested-questions').classList.add('hidden');
      
      var sendBtn = document.getElementById('consulting-send-btn');
      sendBtn.disabled = true;
      document.getElementById('typing-indicator').classList.remove('hidden');
      
      try {
        // 通常のJSON APIでメッセージ送信（SSEストリーミングは日本語破損のため無効化）
        var res = await api('/api/chat/sessions/' + sessionId + '/message', {
          method: 'POST',
          body: JSON.stringify({ content: content })
        });
        
        if (!res.success) throw new Error(res.error?.message || 'メッセージ送信に失敗しました');
        
        document.getElementById('typing-indicator').classList.add('hidden');
        addMessage('assistant', res.data.assistant_message.content);
        
        if (res.data.suggested_questions && res.data.suggested_questions.length > 0) {
          showSuggestedQuestions(res.data.suggested_questions);
        }
        
      } catch (error) {
        console.error('Consulting message error:', error);
        document.getElementById('typing-indicator').classList.add('hidden');
        addMessage('system', 'エラー: ' + error.message);
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    }
    
    // Phase 20: SSEストリーミング受信
    async function tryStreamingResponse(content) {
      try {
        var streamController = new AbortController();
        var streamTimeoutId = setTimeout(function() { streamController.abort(); }, 30000);
        var response = await fetch('/api/chat/sessions/' + sessionId + '/message/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ content: content }),
          signal: streamController.signal
        });
        clearTimeout(streamTimeoutId);
        
        // SSE非対応の場合（構造化フェーズなど）
        if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
          return false;
        }
        
        document.getElementById('typing-indicator').classList.add('hidden');
        
        // ストリーミングメッセージバブルを作成
        var messagesDiv = document.getElementById('messages');
        var msgDiv = document.createElement('div');
        msgDiv.className = 'flex justify-start slide-in';
        msgDiv.innerHTML = 
          '<div class="message-bubble bg-white border border-gray-200 text-gray-800 shadow-sm rounded-lg px-3 py-2.5">' +
            '<div class="flex items-start">' +
              '<div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2 flex-shrink-0"><i class="fas fa-robot text-green-600 text-xs"></i></div>' +
              '<div class="min-w-0">' +
                '<div class="whitespace-pre-wrap text-sm leading-relaxed" id="streaming-content"></div>' +
              '</div>' +
            '</div>' +
          '</div>';
        messagesDiv.appendChild(msgDiv);
        
        var streamingEl = document.getElementById('streaming-content');
        var fullContent = '';
        
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        
        while (true) {
          var result = await reader.read();
          if (result.done) break;
          
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\\n');
          buffer = lines.pop() || ''; // 不完全な最終行はバッファに残す
          
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.startsWith('data: ')) {
              try {
                var data = JSON.parse(line.substring(6));
                
                if (data.type === 'token') {
                  fullContent += data.content;
                  streamingEl.textContent = fullContent;
                  messagesDiv.scrollTop = messagesDiv.scrollHeight;
                } else if (data.type === 'done') {
                  // ストリーミング完了
                  streamingEl.textContent = fullContent;
                  streamingEl.removeAttribute('id'); // ID解除
                  
                  if (data.suggested_questions && data.suggested_questions.length > 0) {
                    showSuggestedQuestions(data.suggested_questions);
                  }
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
        }
        
        return true;
        
      } catch (e) {
        console.warn('[壁打ち] SSEストリーミング失敗、フォールバック:', e);
        return false;
      }
    }
    
    // Phase 19: 提案質問ボタンを表示
    function showSuggestedQuestions(questions) {
      var container = document.getElementById('suggested-questions');
      container.classList.remove('hidden');
      container.innerHTML = questions.map(function(q) {
        return '<button onclick="askSuggested(' + "'" + escapeHtml(q).replace(/'/g, "&apos;") + "'" + ')" ' +
          'class="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 truncate max-w-xs">' +
          '<i class="fas fa-lightbulb mr-1"></i>' + escapeHtml(q.substring(0, 40)) + (q.length > 40 ? '...' : '') +
          '</button>';
      }).join('');
    }
    
    // Phase 19: 提案質問をクリック
    function askSuggested(question) {
      var input = document.getElementById('consulting-input') || document.getElementById('message-input');
      if (input) {
        input.value = question;
        if (consultingMode) {
          sendConsultingMessage();
        } else {
          sendMessage();
        }
      }
    }
    
    // Phase 19: クイック相談ボタン
    function askAboutRequirements() {
      var input = document.getElementById('consulting-input');
      if (input) {
        input.value = 'この補助金の申請要件を詳しく教えてください。うちの会社で満たせそうですか？';
        sendConsultingMessage();
      }
    }
    
    function askAboutDocuments() {
      var input = document.getElementById('consulting-input');
      if (input) {
        input.value = '申請に必要な書類を教えてください。準備のコツがあれば教えてほしいです。';
        sendConsultingMessage();
      }
    }
    
    // Phase 19-QA: 追加の相談ショートカット
    function askAboutStrategy() {
      var input = document.getElementById('consulting-input');
      if (input) {
        input.value = '採択率を上げるためのポイントや加点項目の取得戦略を教えてください。うちの会社でできることはありますか？';
        sendConsultingMessage();
      }
    }
    
    function askAboutSchedule() {
      var input = document.getElementById('consulting-input');
      if (input) {
        input.value = '申請のスケジュールを教えてください。準備にどのくらいの期間が必要ですか？';
        sendConsultingMessage();
      }
    }
    
    // ============================================================
    // Phase 20: 資料アップロード機能
    // ============================================================
    var selectedFile = null;
    var uploadedDocs = [];
    
    function openUploadDialog() {
      if (!sessionId) {
        alert('チャットセッションが開始されていません');
        return;
      }
      document.getElementById('upload-modal').classList.remove('hidden');
      clearSelectedFile();
    }
    
    function closeUploadModal() {
      document.getElementById('upload-modal').classList.add('hidden');
      clearSelectedFile();
    }
    
    function clearSelectedFile() {
      selectedFile = null;
      document.getElementById('file-upload-input').value = '';
      document.getElementById('selected-file-info').classList.add('hidden');
      document.getElementById('doc-type-selector').classList.add('hidden');
      document.getElementById('upload-submit-btn').disabled = true;
      document.getElementById('upload-drop-zone').classList.remove('hidden');
    }
    
    function handleFileSelected(event) {
      var file = event.target.files[0];
      if (file) showSelectedFile(file);
    }
    
    function handleFileDrop(event) {
      event.preventDefault();
      event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
      var file = event.dataTransfer.files[0];
      if (file) showSelectedFile(file);
    }
    
    function showSelectedFile(file) {
      // サイズ検証
      if (file.size > 10 * 1024 * 1024) {
        alert('ファイルサイズは10MB以下にしてください');
        return;
      }
      
      selectedFile = file;
      
      // ファイルアイコンを決定
      var iconMap = {
        'application/pdf': 'fa-file-pdf text-red-500',
        'image/jpeg': 'fa-file-image text-purple-500',
        'image/png': 'fa-file-image text-purple-500',
        'image/gif': 'fa-file-image text-purple-500',
        'image/webp': 'fa-file-image text-purple-500',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa-file-word text-blue-600',
        'application/msword': 'fa-file-word text-blue-600',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fa-file-excel text-green-600',
        'application/vnd.ms-excel': 'fa-file-excel text-green-600',
        'text/csv': 'fa-file-csv text-green-600',
      };
      var iconClass = iconMap[file.type] || 'fa-file text-gray-500';
      
      document.getElementById('selected-file-icon').className = 'fas ' + iconClass + ' text-lg mr-3';
      document.getElementById('selected-file-name').textContent = file.name;
      document.getElementById('selected-file-size').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
      
      document.getElementById('upload-drop-zone').classList.add('hidden');
      document.getElementById('selected-file-info').classList.remove('hidden');
      document.getElementById('doc-type-selector').classList.remove('hidden');
      document.getElementById('upload-submit-btn').disabled = false;
      
      // ファイル名から書類種別を自動推測
      var name = file.name.toLowerCase();
      var select = document.getElementById('doc-type-select');
      if (name.includes('決算') || name.includes('貸借') || name.includes('損益') || name.includes('bs') || name.includes('pl')) {
        select.value = 'financial_statement';
      } else if (name.includes('確定申告') || name.includes('tax')) {
        select.value = 'tax_return';
      } else if (name.includes('事業計画') || name.includes('business')) {
        select.value = 'business_plan';
      } else if (name.includes('登記') || name.includes('登記簿') || name.includes('謄本')) {
        select.value = 'registration';
      } else if (name.includes('見積') || name.includes('請求') || name.includes('quotation') || name.includes('invoice')) {
        select.value = 'quotation';
      } else {
        select.value = 'other';
      }
    }
    
    async function submitUpload() {
      if (!selectedFile || !sessionId) return;
      
      var submitBtn = document.getElementById('upload-submit-btn');
      submitBtn.disabled = true;
      document.getElementById('upload-progress').classList.remove('hidden');
      
      try {
        var formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('doc_type', document.getElementById('doc-type-select').value);
        
        var response = await fetch('/api/chat/sessions/' + sessionId + '/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: formData
        });
        
        var result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error?.message || 'アップロードに失敗しました');
        }
        
        // モーダルを閉じる
        closeUploadModal();
        
        // チャットにメッセージを追加
        addMessage('user', result.data.user_message.content);
        addMessage('assistant', result.data.assistant_message.content);
        
        // アップロード済み書類リストを更新
        uploadedDocs.push(result.data.document);
        updateDocsPanel();
        
      } catch (error) {
        console.error('Upload error:', error);
        alert('アップロードエラー: ' + error.message);
      } finally {
        submitBtn.disabled = false;
        document.getElementById('upload-progress').classList.add('hidden');
      }
    }
    
    function updateDocsPanel() {
      if (uploadedDocs.length === 0) {
        document.getElementById('uploaded-docs-panel').classList.add('hidden');
        return;
      }
      
      document.getElementById('uploaded-docs-panel').classList.remove('hidden');
      document.getElementById('docs-count').textContent = '(' + uploadedDocs.length + '件)';
      
      var docTypeLabels = {
        'financial_statement': '決算書',
        'tax_return': '確定申告書',
        'business_plan': '事業計画書',
        'registration': '登記簿謄本',
        'quotation': '見積書',
        'other': 'その他',
      };
      
      var listEl = document.getElementById('docs-list');
      listEl.innerHTML = uploadedDocs.map(function(doc) {
        var label = docTypeLabels[doc.doc_type] || doc.doc_type;
        var sizeMB = (doc.size_bytes / 1024 / 1024).toFixed(1);
        return '<div class="flex items-center text-xs p-2 bg-gray-50 rounded">' +
          '<i class="fas fa-file text-blue-500 mr-2"></i>' +
          '<div class="flex-1 min-w-0">' +
            '<span class="font-medium truncate block">' + escapeHtml(doc.original_filename) + '</span>' +
            '<span class="text-gray-400">' + label + ' / ' + sizeMB + 'MB</span>' +
          '</div>' +
          '<span class="text-green-500 ml-2"><i class="fas fa-check-circle"></i></span>' +
        '</div>';
      }).join('');
    }
    
    function toggleDocsPanel() {
      var list = document.getElementById('docs-list');
      var icon = document.getElementById('docs-toggle-icon');
      list.classList.toggle('hidden');
      icon.className = list.classList.contains('hidden') ? 'fas fa-chevron-down text-gray-400' : 'fas fa-chevron-up text-gray-400';
    }
    
    // セッション初期化時にアップロード済み書類も取得
    async function loadUploadedDocs() {
      if (!companyId) return;
      try {
        var res = await api('/api/chat/documents/' + companyId);
        if (res.success && res.data && res.data.length > 0) {
          uploadedDocs = res.data;
          updateDocsPanel();
        }
      } catch (e) {
        console.warn('書類一覧の取得失敗:', e);
      }
    }
    
    // 初期化
    initSession();
    // 書類リスト取得（非同期で並行実行）
    loadUploadedDocs();
  </script>
</body>
</html>
  `);
});

export default chatPages;

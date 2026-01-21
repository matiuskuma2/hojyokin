/**
 * S3: 壁打ちチャット UI
 * 
 * /chat - 補助金申請に向けた壁打ちチャット画面
 * パラメータ: subsidy_id, company_id
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
  <title>壁打ちチャット - 補助金マッチング</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .chat-container { 
      height: calc(100vh - 200px); 
      min-height: 400px;
    }
    .message-bubble {
      max-width: 80%;
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
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-4">
          <a href="/subsidies" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-arrow-left"></i>
          </a>
          <div>
            <h1 class="font-bold text-lg text-gray-800">
              <i class="fas fa-comments text-green-600 mr-2"></i>壁打ちチャット
            </h1>
            <p id="subsidy-title" class="text-sm text-gray-500 truncate max-w-md">読み込み中...</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <span id="session-status" class="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700">
            <i class="fas fa-spinner fa-spin mr-1"></i>準備中
          </span>
          <button onclick="location.href='/dashboard'" class="text-sm text-gray-600 hover:text-gray-900">
            <i class="fas fa-home mr-1"></i>ダッシュボード
          </button>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-5xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
    <!-- 事前判定結果パネル -->
    <div id="precheck-panel" class="hidden mb-4">
      <div id="precheck-ng" class="hidden bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
        <div class="flex items-start">
          <i class="fas fa-exclamation-circle text-red-500 text-xl mr-3 mt-0.5"></i>
          <div>
            <h3 class="font-semibold text-red-800">この補助金には申請できません</h3>
            <ul id="blocked-reasons" class="mt-2 text-sm text-red-700 list-disc list-inside"></ul>
            <a href="/subsidies" class="inline-block mt-3 text-sm text-red-600 hover:text-red-800">
              <i class="fas fa-arrow-left mr-1"></i>他の補助金を探す
            </a>
          </div>
        </div>
      </div>
      
      <div id="precheck-ok" class="hidden bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
        <div class="flex items-center">
          <i class="fas fa-check-circle text-green-500 text-xl mr-3"></i>
          <div>
            <h3 class="font-semibold text-green-800">申請要件を満たしています</h3>
            <p class="text-sm text-green-700 mt-1">申請書のドラフト作成に進むことができます。</p>
          </div>
          <button onclick="goToDraft()" class="ml-auto bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
            <i class="fas fa-file-alt mr-1"></i>申請書を作成
          </button>
        </div>
      </div>
      
      <div id="precheck-missing" class="hidden bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 text-xl mr-3 mt-0.5"></i>
          <div>
            <h3 class="font-semibold text-blue-800">追加の確認が必要です</h3>
            <p class="text-sm text-blue-700 mt-1">以下の質問にお答えください。回答に応じて申請可否を判定します。</p>
            <div id="missing-count" class="mt-2 text-sm text-blue-600">
              <i class="fas fa-question-circle mr-1"></i>残り <span id="remaining-questions">-</span> 件の質問
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- チャットエリア -->
    <div class="bg-white rounded-lg shadow chat-container flex flex-col">
      <!-- メッセージリスト -->
      <div id="messages" class="flex-1 overflow-y-auto p-4 space-y-4">
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
          アシスタントが入力中...
        </div>
      </div>
      
      <!-- 入力エリア -->
      <div id="input-area" class="border-t p-4">
        <div class="flex items-center space-x-3">
          <div class="flex-1">
            <input type="text" id="message-input" 
                   placeholder="メッセージを入力..." 
                   class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                   onkeypress="if(event.key==='Enter')sendMessage()">
          </div>
          <button onclick="sendMessage()" id="send-btn"
                  class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
        
        <!-- クイック回答ボタン -->
        <div id="quick-answers" class="hidden mt-3 flex flex-wrap gap-2">
          <button onclick="quickAnswer('はい')" class="px-4 py-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 text-sm">
            <i class="fas fa-check mr-1"></i>はい
          </button>
          <button onclick="quickAnswer('いいえ')" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 text-sm">
            <i class="fas fa-times mr-1"></i>いいえ
          </button>
          <button onclick="quickAnswer('わからない')" class="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200 text-sm">
            <i class="fas fa-question mr-1"></i>わからない
          </button>
        </div>
      </div>
      
      <!-- 完了時のアクション -->
      <div id="completion-area" class="hidden border-t p-4 bg-gray-50">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-semibold text-gray-800">確認完了</h4>
            <p class="text-sm text-gray-600">必要な情報が揃いました。申請書の作成に進めます。</p>
          </div>
          <button onclick="goToDraft()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
            <i class="fas fa-file-alt mr-2"></i>申請書を作成
          </button>
        </div>
      </div>
    </div>
    
    <!-- 会社・補助金情報サマリー -->
    <div id="info-summary" class="hidden mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white rounded-lg shadow p-4">
        <h4 class="text-sm font-medium text-gray-500 mb-2"><i class="fas fa-building mr-1"></i>会社情報</h4>
        <div id="company-info" class="text-sm text-gray-700 space-y-1">
          <p><strong>会社名:</strong> <span id="company-name">-</span></p>
          <p><strong>所在地:</strong> <span id="company-prefecture">-</span></p>
          <p><strong>従業員数:</strong> <span id="company-employees">-</span>人</p>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <h4 class="text-sm font-medium text-gray-500 mb-2"><i class="fas fa-coins mr-1"></i>補助金情報</h4>
        <div id="subsidy-info" class="text-sm text-gray-700 space-y-1">
          <p><strong>補助上限:</strong> <span id="subsidy-max">-</span></p>
          <p><strong>申請締切:</strong> <span id="subsidy-deadline">-</span></p>
        </div>
      </div>
    </div>
  </main>
  
  <script>
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
    }
    
    // URLパラメータ取得
    const params = new URLSearchParams(window.location.search);
    const subsidyId = params.get('subsidy_id');
    const companyId = params.get('company_id');
    
    if (!subsidyId || !companyId) {
      alert('補助金または会社が指定されていません');
      window.location.href = '/subsidies';
    }
    
    let sessionId = null;
    let sessionCompleted = false;
    
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
    
    // メッセージを追加
    function addMessage(role, content, animate = true) {
      const messagesDiv = document.getElementById('messages');
      const loadingDiv = document.getElementById('loading-messages');
      if (loadingDiv) loadingDiv.remove();
      
      const msgDiv = document.createElement('div');
      msgDiv.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');
      if (animate) msgDiv.style.opacity = '0';
      
      const bubbleClass = role === 'user' 
        ? 'bg-green-600 text-white' 
        : role === 'system'
          ? 'bg-gray-200 text-gray-800'
          : 'bg-white border border-gray-200 text-gray-800';
      
      const icon = role === 'user' 
        ? '<i class="fas fa-user text-green-200 mr-2"></i>'
        : role === 'system'
          ? '<i class="fas fa-info-circle text-gray-400 mr-2"></i>'
          : '<i class="fas fa-robot text-green-600 mr-2"></i>';
      
      msgDiv.innerHTML = \`
        <div class="message-bubble \${bubbleClass} rounded-lg px-4 py-3 shadow-sm">
          <div class="flex items-start">
            \${icon}
            <div class="whitespace-pre-wrap">\${escapeHtml(content)}</div>
          </div>
        </div>
      \`;
      
      messagesDiv.appendChild(msgDiv);
      
      if (animate) {
        requestAnimationFrame(() => {
          msgDiv.style.transition = 'opacity 0.3s ease';
          msgDiv.style.opacity = '1';
        });
      }
      
      // スクロール
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    // HTMLエスケープ
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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
        const date = new Date(dateStr);
        return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
        return dateStr;
      }
    }
    
    // セッション初期化
    async function initSession() {
      try {
        // セッション作成（事前判定を含む）
        const res = await api('/api/chat/sessions', {
          method: 'POST',
          body: JSON.stringify({ company_id: companyId, subsidy_id: subsidyId })
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || 'セッション作成に失敗しました');
        }
        
        const { session, messages, precheck, is_new } = res.data;
        sessionId = session.id;
        
        // 補助金タイトル設定
        const subsidyTitle = session.subsidy_title || '補助金詳細';
        document.getElementById('subsidy-title').textContent = subsidyTitle;
        
        // 事前判定結果の表示
        document.getElementById('precheck-panel').classList.remove('hidden');
        
        if (precheck.status === 'NG') {
          document.getElementById('precheck-ng').classList.remove('hidden');
          const reasonsList = document.getElementById('blocked-reasons');
          reasonsList.innerHTML = precheck.blocked_reasons.map(r => '<li>' + escapeHtml(r) + '</li>').join('');
          document.getElementById('input-area').classList.add('hidden');
          document.getElementById('session-status').innerHTML = '<i class="fas fa-ban mr-1"></i>申請不可';
          document.getElementById('session-status').className = 'text-sm px-3 py-1 rounded-full bg-red-100 text-red-700';
        } else if (precheck.status === 'OK') {
          document.getElementById('precheck-ok').classList.remove('hidden');
          document.getElementById('input-area').classList.add('hidden');
          document.getElementById('completion-area').classList.remove('hidden');
          document.getElementById('session-status').innerHTML = '<i class="fas fa-check mr-1"></i>申請可能';
          document.getElementById('session-status').className = 'text-sm px-3 py-1 rounded-full bg-green-100 text-green-700';
          sessionCompleted = true;
        } else {
          document.getElementById('precheck-missing').classList.remove('hidden');
          document.getElementById('remaining-questions').textContent = precheck.missing_items.length;
          document.getElementById('quick-answers').classList.remove('hidden');
          document.getElementById('session-status').innerHTML = '<i class="fas fa-comments mr-1"></i>確認中';
          document.getElementById('session-status').className = 'text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700';
        }
        
        // 会社・補助金情報サマリー
        if (precheck.company_info) {
          document.getElementById('company-name').textContent = precheck.company_info.name || '-';
          document.getElementById('company-prefecture').textContent = precheck.company_info.prefecture || '-';
          document.getElementById('company-employees').textContent = precheck.company_info.employee_count || '-';
        }
        if (precheck.subsidy_info) {
          document.getElementById('subsidy-max').textContent = formatCurrency(precheck.subsidy_info.max_amount);
          document.getElementById('subsidy-deadline').textContent = formatDate(precheck.subsidy_info.acceptance_end);
        }
        document.getElementById('info-summary').classList.remove('hidden');
        
        // メッセージ表示
        const loadingDiv = document.getElementById('loading-messages');
        if (loadingDiv) loadingDiv.remove();
        
        for (const msg of messages) {
          addMessage(msg.role, msg.content, false);
        }
        
        // セッションが完了している場合
        if (session.status === 'completed') {
          sessionCompleted = true;
          document.getElementById('input-area').classList.add('hidden');
          document.getElementById('completion-area').classList.remove('hidden');
          document.getElementById('session-status').innerHTML = '<i class="fas fa-check mr-1"></i>完了';
          document.getElementById('session-status').className = 'text-sm px-3 py-1 rounded-full bg-green-100 text-green-700';
        }
        
      } catch (error) {
        console.error('Init session error:', error);
        alert('エラー: ' + error.message);
        window.location.href = '/subsidies/' + subsidyId + '?company_id=' + companyId;
      }
    }
    
    // メッセージ送信
    async function sendMessage() {
      if (sessionCompleted) return;
      
      const input = document.getElementById('message-input');
      const content = input.value.trim();
      if (!content) return;
      
      // 入力クリア
      input.value = '';
      
      // ユーザーメッセージ表示
      addMessage('user', content);
      
      // 送信ボタン無効化
      const sendBtn = document.getElementById('send-btn');
      sendBtn.disabled = true;
      
      // タイピングインジケーター表示
      document.getElementById('typing-indicator').classList.remove('hidden');
      
      try {
        const res = await api('/api/chat/sessions/' + sessionId + '/message', {
          method: 'POST',
          body: JSON.stringify({ content })
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || 'メッセージ送信に失敗しました');
        }
        
        // タイピングインジケーター非表示
        document.getElementById('typing-indicator').classList.add('hidden');
        
        // アシスタントメッセージ表示
        addMessage('assistant', res.data.assistant_message.content);
        
        // 残り質問数更新
        const remaining = res.data.remaining_questions;
        document.getElementById('remaining-questions').textContent = remaining + 1;
        
        // セッション完了チェック
        if (res.data.session_completed) {
          sessionCompleted = true;
          document.getElementById('input-area').classList.add('hidden');
          document.getElementById('completion-area').classList.remove('hidden');
          document.getElementById('quick-answers').classList.add('hidden');
          document.getElementById('precheck-missing').classList.add('hidden');
          document.getElementById('precheck-ok').classList.remove('hidden');
          document.getElementById('session-status').innerHTML = '<i class="fas fa-check mr-1"></i>完了';
          document.getElementById('session-status').className = 'text-sm px-3 py-1 rounded-full bg-green-100 text-green-700';
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
      // S4実装後に遷移先を設定
      alert('申請書作成機能は現在準備中です。\\n\\nこの補助金への申請準備が整いました。');
      // window.location.href = '/draft?session_id=' + sessionId;
    }
    
    // 初期化
    initSession();
  </script>
</body>
</html>
  `);
});

export default chatPages;

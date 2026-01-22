/**
 * S4: 申請書ドラフト UI
 * 
 * /draft - ドラフト生成・編集・保存画面
 * パラメータ: session_id（必須）
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const draftPages = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * ドラフト編集ページ
 */
draftPages.get('/draft', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>申請書ドラフト - 補助金マッチング</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .section-editor {
      min-height: 200px;
    }
    .ng-highlight {
      background-color: #FEE2E2;
      border-left: 3px solid #EF4444;
    }
    .saving-indicator {
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <nav class="bg-white shadow-sm border-b sticky top-0 z-10">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-4">
          <a href="#" id="back-link" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-arrow-left"></i>
          </a>
          <div>
            <h1 class="font-bold text-lg text-gray-800">
              <i class="fas fa-file-alt text-blue-600 mr-2"></i>申請書ドラフト
            </h1>
            <p id="subsidy-title" class="text-sm text-gray-500 truncate max-w-md">読み込み中...</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <span id="save-status" class="text-sm text-gray-500">
            <i class="fas fa-check text-green-500 mr-1"></i>保存済み
          </span>
          <button onclick="location.href='/dashboard'" class="text-sm text-gray-600 hover:text-gray-900">
            <i class="fas fa-home mr-1"></i>ダッシュボード
          </button>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <!-- ローディング -->
    <div id="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-600">ドラフトを生成中...</p>
      </div>
    </div>
    
    <!-- メインコンテンツ -->
    <div id="main-content" class="hidden">
      <!-- NGチェック結果パネル -->
      <div id="ng-panel" class="mb-6">
        <div id="ng-ok" class="hidden bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center">
            <i class="fas fa-check-circle text-green-500 text-xl mr-3"></i>
            <div>
              <h3 class="font-semibold text-green-800">表現チェック: 問題なし</h3>
              <p class="text-sm text-green-700">NG表現は検出されませんでした。</p>
            </div>
          </div>
        </div>
        
        <div id="ng-warning" class="hidden bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex items-start">
            <i class="fas fa-exclamation-triangle text-yellow-500 text-xl mr-3 mt-0.5"></i>
            <div class="flex-1">
              <h3 class="font-semibold text-yellow-800">表現チェック: 要確認</h3>
              <p class="text-sm text-yellow-700 mb-2">以下の表現が検出されました。修正を検討してください。</p>
              <ul id="ng-list" class="text-sm text-yellow-800 space-y-1"></ul>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 不足情報の補完リンク -->
      <div id="info-links" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 text-lg mr-3 mt-0.5"></i>
          <div class="flex-1">
            <h4 class="font-semibold text-blue-800 mb-2">情報が不足している場合</h4>
            <p class="text-sm text-blue-700 mb-3">
              ドラフトに「（未入力）」や「（○○を記載してください）」がある場合は、以下から情報を補完できます。
            </p>
            <div class="flex flex-wrap gap-2">
              <a href="/company" class="inline-flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded-md text-sm text-blue-700 hover:bg-blue-100">
                <i class="fas fa-building mr-1.5"></i>会社情報を編集
              </a>
              <a id="link-chat" href="#" class="inline-flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded-md text-sm text-blue-700 hover:bg-blue-100">
                <i class="fas fa-comments mr-1.5"></i>壁打ちに戻る
              </a>
              <a href="/subsidies" class="inline-flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded-md text-sm text-blue-700 hover:bg-blue-100">
                <i class="fas fa-search mr-1.5"></i>補助金を確認
              </a>
            </div>
          </div>
        </div>
      </div>
      
      <!-- アクションバー -->
      <div class="bg-white rounded-lg shadow p-4 mb-6 flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <button onclick="regenerate()" id="btn-regenerate" 
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
            <i class="fas fa-sync-alt mr-1"></i>再生成
          </button>
          <button onclick="checkNg()" id="btn-check"
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
            <i class="fas fa-search mr-1"></i>NGチェック
          </button>
        </div>
        <div class="flex items-center space-x-3">
          <button onclick="saveDraft()" id="btn-save"
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
            <i class="fas fa-save mr-1"></i>保存
          </button>
          <button onclick="finalizeDraft()" id="btn-finalize"
                  class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
            <i class="fas fa-check mr-1"></i>確定
          </button>
        </div>
      </div>
      
      <!-- セクションエディタ -->
      <div class="space-y-6">
        <!-- 背景・課題 -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b px-4 py-3 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">
              <i class="fas fa-history text-blue-500 mr-2"></i>背景・課題
            </h3>
            <span class="text-xs text-gray-500">申請の動機となる背景と解決したい課題</span>
          </div>
          <div class="p-4">
            <textarea id="sec-background" 
                      class="section-editor w-full border rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="背景・課題を記載してください..."></textarea>
          </div>
        </div>
        
        <!-- 事業目的 -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b px-4 py-3 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">
              <i class="fas fa-bullseye text-green-500 mr-2"></i>事業目的
            </h3>
            <span class="text-xs text-gray-500">本事業で達成したい目標</span>
          </div>
          <div class="p-4">
            <textarea id="sec-purpose"
                      class="section-editor w-full border rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="事業目的を記載してください..."></textarea>
          </div>
        </div>
        
        <!-- 実施内容・方法 -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b px-4 py-3 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">
              <i class="fas fa-tasks text-purple-500 mr-2"></i>実施内容・方法
            </h3>
            <span class="text-xs text-gray-500">具体的な実施計画とスケジュール</span>
          </div>
          <div class="p-4">
            <textarea id="sec-plan"
                      class="section-editor w-full border rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="実施内容・方法を記載してください..."></textarea>
          </div>
        </div>
        
        <!-- 実施体制 -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b px-4 py-3 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">
              <i class="fas fa-users text-orange-500 mr-2"></i>実施体制
            </h3>
            <span class="text-xs text-gray-500">事業実施の組織体制と役割分担</span>
          </div>
          <div class="p-4">
            <textarea id="sec-team"
                      class="section-editor w-full border rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="実施体制を記載してください..."></textarea>
          </div>
        </div>
        
        <!-- 資金計画 -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b px-4 py-3 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">
              <i class="fas fa-yen-sign text-yellow-500 mr-2"></i>資金計画（概要）
            </h3>
            <span class="text-xs text-gray-500">事業費の概算と資金手当て</span>
          </div>
          <div class="p-4">
            <textarea id="sec-budget_overview"
                      class="section-editor w-full border rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="資金計画を記載してください..."></textarea>
          </div>
        </div>
      </div>
      
      <!-- フッターアクション -->
      <div class="mt-8 bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-semibold text-gray-800">ドラフトの確定</h4>
            <p class="text-sm text-gray-600">内容を確認し、問題なければ確定してください。確定後も編集は可能です。</p>
          </div>
          <button onclick="finalizeDraft()" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">
            <i class="fas fa-check-circle mr-2"></i>ドラフトを確定する
          </button>
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
    const sessionId = params.get('session_id');
    
    if (!sessionId) {
      alert('セッションが指定されていません');
      window.location.href = '/dashboard';
    }
    
    // 戻るリンク設定
    document.getElementById('back-link').href = '/chat?session_id=' + sessionId;
    document.getElementById('link-chat').href = '/chat?session_id=' + sessionId;
    
    let draftId = null;
    let hasChanges = false;
    
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
    
    // セクションを取得
    function getSections() {
      return {
        background: document.getElementById('sec-background').value || '',
        purpose: document.getElementById('sec-purpose').value || '',
        plan: document.getElementById('sec-plan').value || '',
        team: document.getElementById('sec-team').value || '',
        budget_overview: document.getElementById('sec-budget_overview').value || ''
      };
    }
    
    // セクションを設定
    function setSections(sections) {
      const keys = ['background', 'purpose', 'plan', 'team', 'budget_overview'];
      for (const key of keys) {
        const el = document.getElementById('sec-' + key);
        if (el && sections[key]) {
          el.value = sections[key];
        }
      }
    }
    
    // NG結果を表示
    function showNgResult(ng) {
      const ngOk = document.getElementById('ng-ok');
      const ngWarning = document.getElementById('ng-warning');
      const ngList = document.getElementById('ng-list');
      
      if (!ng || ng.hits.length === 0) {
        ngOk.classList.remove('hidden');
        ngWarning.classList.add('hidden');
      } else {
        ngOk.classList.add('hidden');
        ngWarning.classList.remove('hidden');
        ngList.innerHTML = ng.hits.map(hit => 
          '<li><strong>' + escapeHtml(hit.pattern) + '</strong>: ' + escapeHtml(hit.reason) + 
          '<br><span class="text-xs text-gray-600">' + escapeHtml(hit.excerpt) + '</span></li>'
        ).join('');
      }
    }
    
    // HTMLエスケープ
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // 保存状態表示
    function showSaveStatus(status) {
      const el = document.getElementById('save-status');
      if (status === 'saving') {
        el.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>保存中...';
        el.className = 'text-sm text-blue-600 saving-indicator';
      } else if (status === 'saved') {
        el.innerHTML = '<i class="fas fa-check text-green-500 mr-1"></i>保存済み';
        el.className = 'text-sm text-gray-500';
      } else if (status === 'unsaved') {
        el.innerHTML = '<i class="fas fa-circle text-yellow-500 mr-1"></i>未保存の変更あり';
        el.className = 'text-sm text-yellow-600';
      }
    }
    
    // ドラフト生成
    async function generateDraft() {
      try {
        const res = await api('/api/draft/generate', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, mode: 'template' })
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || 'ドラフト生成に失敗しました');
        }
        
        draftId = res.data.draft_id;
        setSections(res.data.sections);
        showNgResult(res.data.ng);
        
        // 補助金タイトル取得（別途APIで取得も可能だが、セッションから取得）
        const sessionRes = await api('/api/chat/sessions/' + sessionId);
        if (sessionRes.success && sessionRes.data.session) {
          document.getElementById('subsidy-title').textContent = 
            sessionRes.data.session.subsidy_title || '補助金申請書';
        }
        
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        
        if (!res.data.is_new) {
          showSaveStatus('saved');
        }
        
      } catch (error) {
        console.error('Generate draft error:', error);
        alert('エラー: ' + error.message);
        window.location.href = '/chat?session_id=' + sessionId;
      }
    }
    
    // 保存
    async function saveDraft() {
      if (!draftId) return;
      
      showSaveStatus('saving');
      
      try {
        const sections = getSections();
        const res = await api('/api/draft/' + draftId, {
          method: 'PUT',
          body: JSON.stringify({ sections })
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || '保存に失敗しました');
        }
        
        showNgResult(res.data.ng);
        showSaveStatus('saved');
        hasChanges = false;
        
      } catch (error) {
        console.error('Save draft error:', error);
        alert('保存エラー: ' + error.message);
        showSaveStatus('unsaved');
      }
    }
    
    // NGチェック
    async function checkNg() {
      if (!draftId) return;
      
      try {
        const res = await api('/api/draft/' + draftId + '/check-ng', {
          method: 'POST'
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || 'NGチェックに失敗しました');
        }
        
        showNgResult(res.data);
        
      } catch (error) {
        console.error('Check NG error:', error);
        alert('NGチェックエラー: ' + error.message);
      }
    }
    
    // 再生成
    async function regenerate() {
      if (!confirm('現在の内容を破棄して再生成しますか？\\n（この操作は取り消せません）')) {
        return;
      }
      
      document.getElementById('main-content').classList.add('hidden');
      document.getElementById('loading').classList.remove('hidden');
      
      // 既存ドラフトを削除（または新バージョン作成）
      // Phase 1では単純に再生成
      draftId = null;
      await generateDraft();
    }
    
    // 確定
    async function finalizeDraft() {
      if (!draftId) return;
      
      // まず保存
      await saveDraft();
      
      if (!confirm('ドラフトを確定しますか？\\n確定後も編集は可能です。')) {
        return;
      }
      
      try {
        const res = await api('/api/draft/' + draftId + '/finalize', {
          method: 'POST'
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || '確定に失敗しました');
        }
        
        alert('ドラフトを確定しました。\\n\\n次のステップ：\\n・内容を確認し、必要に応じて編集\\n・見積書等の添付書類を準備\\n・申請システムに入力');
        
      } catch (error) {
        console.error('Finalize draft error:', error);
        alert('確定エラー: ' + error.message);
      }
    }
    
    // 変更検知
    document.querySelectorAll('textarea').forEach(el => {
      el.addEventListener('input', () => {
        if (!hasChanges) {
          hasChanges = true;
          showSaveStatus('unsaved');
        }
      });
    });
    
    // ページ離脱時の警告
    window.addEventListener('beforeunload', (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    
    // 自動保存（5分ごと）
    setInterval(() => {
      if (hasChanges && draftId) {
        saveDraft();
      }
    }, 5 * 60 * 1000);
    
    // 初期化
    generateDraft();
  </script>
</body>
</html>
  `);
});

export default draftPages;

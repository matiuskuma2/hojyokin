/**
 * S4: 申請書ドラフト UI
 * 
 * /draft - ドラフト生成・編集・保存画面
 * パラメータ: session_id（必須）
 * 
 * Sprint 1 改善:
 * - NGハイライト表示（セクション別プレビュー）
 * - 代替表現サジェスト（LLMなし、固定ルール）
 * - セクション並び替え（上下ボタン）
 * - 例文表示機能
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
  <title>申請書ドラフト - ホジョラク</title>
  <link rel="icon" type="image/png" href="/favicon.png">
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
    /* NGハイライト用 */
    mark.ng-mark {
      background-color: #FEE2E2;
      padding: 1px 3px;
      border-radius: 2px;
      border-bottom: 2px solid #EF4444;
    }
    .preview-box {
      font-family: 'Hiragino Kaku Gothic Pro', 'メイリオ', sans-serif;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .suggestion-btn {
      transition: all 0.2s;
    }
    .suggestion-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section-card {
      transition: all 0.3s;
    }
    .section-card.dragging {
      opacity: 0.5;
    }
    .example-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
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
      <!-- NGチェック結果パネル（改善版） -->
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
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold text-yellow-800">表現チェック: 要確認</h3>
                <button onclick="togglePreview()" id="btn-toggle-preview" 
                        class="text-sm px-3 py-1 bg-yellow-100 hover:bg-yellow-200 rounded-md text-yellow-800">
                  <i class="fas fa-eye mr-1"></i>プレビューで確認
                </button>
              </div>
              <p class="text-sm text-yellow-700 mb-3">以下の表現が検出されました。クリックで代替表現に置換できます。</p>
              <div id="ng-list" class="space-y-3"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- ハイライトプレビューモーダル -->
      <div id="preview-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div class="border-b px-4 py-3 flex items-center justify-between bg-gray-50">
            <h3 class="font-semibold text-gray-800">
              <i class="fas fa-search-plus text-blue-500 mr-2"></i>NGハイライトプレビュー
            </h3>
            <button onclick="closePreview()" class="text-gray-500 hover:text-gray-700">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
            <div id="preview-content" class="space-y-6"></div>
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
          <button onclick="fixAllNg()" id="btn-fix-all"
                  class="hidden px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm">
            <i class="fas fa-magic mr-1"></i>全てのNGを修正
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
      
      <!-- セクションエディタ（並び替え対応） -->
      <div id="sections-container" class="space-y-6">
        <!-- セクションはJSで動的生成 -->
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
    // ============================================================
    // 共通初期化スクリプト
    // ============================================================
    var token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
    }
    
    // グローバルAPI呼び出しヘルパー
    window.api = async function(path, options) {
      options = options || {};
      
      var headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      };
      
      if (options.headers) {
        for (var key in options.headers) {
          headers[key] = options.headers[key];
        }
      }
      
      var fetchOptions = {
        method: options.method || 'GET',
        headers: headers
      };
      
      if (options.body) {
        fetchOptions.body = options.body;
      }
      
      try {
        var res = await fetch(path, fetchOptions);
        var data = await res.json();
        
        // 認証エラー時は自動ログアウト
        if (res.status === 401 || (data && data.error && data.error.code === 'UNAUTHORIZED')) {
          console.warn('認証エラー: 自動ログアウトします');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          alert('セッションの有効期限が切れました。再度ログインしてください。');
          window.location.href = '/login';
          return data;
        }
        
        return data;
      } catch (err) {
        console.error('API呼び出しエラー:', err);
        return { success: false, error: { code: 'NETWORK_ERROR', message: '通信エラーが発生しました' } };
      }
    };
    
    // URLパラメータ取得
    var params = new URLSearchParams(window.location.search);
    var sessionId = params.get('session_id');
    
    // ⚠️ セッションIDの検証（null/undefined/空文字チェック）
    if (!sessionId || sessionId.trim() === '' || sessionId === 'null' || sessionId === 'undefined') {
      alert('セッションが指定されていません。補助金一覧から再度お試しください。');
      window.location.href = '/subsidies';
      throw new Error('Invalid session_id'); // スクリプト実行を停止
    }
    
    // ⚠️ UUID形式の簡易検証（36文字、ハイフン含む）
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      console.warn('[ドラフト] 無効なsession_id形式:', sessionId);
      alert('無効なセッションIDです。補助金一覧から再度お試しください。');
      window.location.href = '/subsidies';
      throw new Error('Invalid session_id format');
    }
    
    // 戻るリンク設定（session_idをURLエンコード）
    var encodedSessionId = encodeURIComponent(sessionId);
    document.getElementById('back-link').href = '/chat?session_id=' + encodedSessionId;
    document.getElementById('link-chat').href = '/chat?session_id=' + encodedSessionId;
    
    var draftId = null;
    var hasChanges = false;
    var currentNgHits = [];
    
    // セクション定義（並び替え可能）
    const SECTION_DEFS = [
      { key: 'background', label: '背景・課題', icon: 'fa-history', color: 'blue', desc: '申請の動機となる背景と解決したい課題' },
      { key: 'purpose', label: '事業目的', icon: 'fa-bullseye', color: 'green', desc: '本事業で達成したい目標' },
      { key: 'plan', label: '実施内容・方法', icon: 'fa-tasks', color: 'purple', desc: '具体的な実施計画とスケジュール' },
      { key: 'team', label: '実施体制', icon: 'fa-users', color: 'orange', desc: '事業実施の組織体制と役割分担' },
      { key: 'budget_overview', label: '資金計画（概要）', icon: 'fa-yen-sign', color: 'yellow', desc: '事業費の概算と資金手当て' }
    ];
    
    // 現在のセクション順序
    let sectionOrder = SECTION_DEFS.map(s => s.key);
    
    // NG代替表現ルール（LLMなし）
    const NG_SUGGESTIONS = {
      // 断定表現
      '必ず採択': ['採択を目指す', '採択可能性を高める', '採択に向けて取り組む'],
      '必ず成功': ['成功を目指す', '成功に向けて努力する', '高い確率で達成を見込む'],
      '100%': ['可能な限り', '高い確度で', '最大限'],
      '絶対に': ['可能な限り', '～を前提に', '～を想定し'],
      '確実に': ['高い蓋然性をもって', '着実に', '計画的に'],
      '間違いなく': ['十分に見込める', '高い確率で', '計画通りに進めば'],
      
      // 不正示唆
      '裏技': ['要件に沿った最適化', '適正な手順で', '正規の方法で'],
      '抜け道': ['適切な対応', '要件を満たす方法', '正当な手段で'],
      '脱税': ['適正な税務処理', '税務上適切な処理'],
      '架空': ['実態に基づく', '実績に基づく', '実際の'],
      '水増し': ['適正な計上', '実態に即した', '正確な'],
      '虚偽': ['正確な', '事実に基づく', '実態を反映した'],
      
      // 誇大・煽り
      '画期的な': ['効果的な', '有効な', '革新的な取り組みとなる'],
      '革命的': ['大きな改善が見込める', '効果的な変革', '顕著な改善'],
      '爆発的': ['大幅な', '顕著な', '著しい'],
      '驚異的': ['顕著な', '高い', '優れた'],
      
      // 目的外使用示唆
      '転売': ['自社利用', '事業での活用', '事業目的での使用'],
      '私的': ['事業目的での', '業務上の', '会社としての'],
      
      // 曖昧表現
      'たぶん': ['～と見込まれる', '～の予定である', '計画では'],
      'おそらく': ['～と想定される', '～の見通しである', '～と考えられる'],
      'なんとなく': ['明確な根拠に基づき', '分析の結果', '検討の結果']
    };
    
    // 例文データ
    const SECTION_EXAMPLES = {
      background: \`【背景・課題の記載例】

当社は○○県○○市に本社を置き、○○事業を主力として創業○年目を迎えております。

近年、当業界においては以下の課題が顕在化しております：
・原材料費の高騰による収益性の悪化
・人手不足に伴う生産性の低下
・デジタル化への対応の遅れ

特に当社においては、○○という固有の課題を抱えており、このままでは事業継続が困難になることが予想されます。

このような状況を打開し、持続的な成長を実現するため、本事業への取り組みを計画いたしました。\`,

      purpose: \`【事業目的の記載例】

本事業の目的は、以下の3点を達成することです：

1. 生産性の向上
   ・○○工程の自動化により、生産効率を○○%向上させる
   ・従業員一人当たりの付加価値額を○○円から○○円に引き上げる

2. 新規顧客の獲得
   ・新たな販路として○○市場への参入を果たす
   ・年間○○件の新規取引先を開拓する

3. 従業員の働き方改革
   ・残業時間を月平均○○時間削減する
   ・テレワーク対応率を○○%に引き上げる

これらの達成により、売上高○○%増、経常利益率○○%を目指します。\`,

      plan: \`【実施内容・方法の記載例】

本事業は以下のスケジュールで実施いたします：

【第1四半期】準備フェーズ
・設備の選定と発注（○月）
・導入場所の整備（○月）
・従業員への事前研修（○月）

【第2四半期】導入フェーズ
・設備の設置・試運転（○月）
・運用マニュアルの作成（○月）
・本格稼働開始（○月）

【第3四半期】定着フェーズ
・運用状況のモニタリング
・課題の抽出と改善
・効果測定の実施

【第4四半期】効果検証フェーズ
・KPIの達成状況確認
・次年度計画への反映
・成果報告書の作成\`,

      team: \`【実施体制の記載例】

本事業は以下の体制で実施いたします：

■ 社内体制
・統括責任者：代表取締役 ○○（全体管理・意思決定）
・事業責任者：○○部長 ○○（現場統括・進捗管理）
・実施担当者：○○課 ○名（日常運用・データ収集）
・経理担当者：経理部 ○○（予算管理・報告書作成）

■ 外部連携
・設備導入：株式会社○○（機器納入・保守）
・コンサルティング：○○事務所（専門的助言）
・システム開発：○○株式会社（カスタマイズ対応）

■ 会議体
・週次進捗会議：毎週○曜日
・月次報告会議：毎月第○週
・四半期レビュー：各四半期末\`,

      budget_overview: \`【資金計画の記載例】

■ 事業費総額：○○○万円

【内訳】
1. 設備費：○○○万円
   ・○○機器一式：○○○万円
   ・付帯設備：○○万円
   ・設置工事費：○○万円

2. システム構築費：○○万円
   ・ソフトウェア：○○万円
   ・カスタマイズ費用：○○万円

3. 専門家経費：○○万円
   ・コンサルティング費用：○○万円

4. その他経費：○○万円
   ・研修費：○○万円
   ・消耗品費：○○万円

■ 資金調達計画
・補助金：○○○万円（補助率○分の○）
・自己資金：○○○万円（預金より充当）
・借入金：○○○万円（○○銀行、返済期間○年）\`
    };
    
    // 注意: window.api() はファイル先頭で定義済み
    
    // HTMLエスケープ
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // NGパターンをハイライト
    function highlightNg(text, hits) {
      if (!hits || hits.length === 0) return escapeHtml(text);
      
      let result = escapeHtml(text);
      
      // 各ヒットをハイライト（長い順にソートして置換の競合を避ける）
      const sortedHits = [...hits].sort((a, b) => 
        (b.matchText || b.pattern).length - (a.matchText || a.pattern).length
      );
      
      for (const hit of sortedHits) {
        const pattern = hit.matchText || hit.pattern;
        try {
          const regex = new RegExp(escapeHtml(pattern), 'g');
          result = result.replace(regex, '<mark class="ng-mark">' + escapeHtml(pattern) + '</mark>');
        } catch (e) {
          // 正規表現エラーは無視
        }
      }
      
      return result;
    }
    
    // セクション別にNGを分類
    function categorizeNgBySection(hits, sections) {
      const result = {};
      for (const key of sectionOrder) {
        result[key] = [];
      }
      
      if (!hits || hits.length === 0) return result;
      
      for (const hit of hits) {
        const pattern = hit.matchText || hit.pattern;
        // どのセクションに含まれるか検索
        for (const key of sectionOrder) {
          if (sections[key] && sections[key].includes(pattern)) {
            result[key].push(hit);
            break;
          }
        }
      }
      
      return result;
    }
    
    // セクションを取得
    function getSections() {
      const sections = {};
      for (const key of sectionOrder) {
        const el = document.getElementById('sec-' + key);
        sections[key] = el ? el.value || '' : '';
      }
      return sections;
    }
    
    // セクションエディタを生成
    function renderSections(sections, ngHitsBySection = {}) {
      const container = document.getElementById('sections-container');
      container.innerHTML = '';
      
      sectionOrder.forEach((key, index) => {
        const def = SECTION_DEFS.find(d => d.key === key);
        if (!def) return;
        
        const ngCount = (ngHitsBySection[key] || []).length;
        const hasNg = ngCount > 0;
        
        const card = document.createElement('div');
        card.className = 'section-card bg-white rounded-lg shadow';
        card.dataset.key = key;
        
        card.innerHTML = \`
          <div class="border-b px-4 py-3 flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <!-- 並び替えボタン -->
              <div class="flex flex-col space-y-1">
                <button onclick="moveSection('\${key}', -1)" class="text-gray-400 hover:text-gray-600 text-xs \${index === 0 ? 'invisible' : ''}" title="上へ移動">
                  <i class="fas fa-chevron-up"></i>
                </button>
                <button onclick="moveSection('\${key}', 1)" class="text-gray-400 hover:text-gray-600 text-xs \${index === sectionOrder.length - 1 ? 'invisible' : ''}" title="下へ移動">
                  <i class="fas fa-chevron-down"></i>
                </button>
              </div>
              <h3 class="font-semibold text-gray-800">
                <i class="fas \${def.icon} text-\${def.color}-500 mr-2"></i>\${def.label}
                \${hasNg ? '<span class="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">' + ngCount + '件のNG</span>' : ''}
              </h3>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="showExample('\${key}')" class="text-sm text-blue-600 hover:text-blue-800" title="例文を表示">
                <i class="fas fa-lightbulb mr-1"></i>例文
              </button>
              <span class="text-xs text-gray-500">\${def.desc}</span>
            </div>
          </div>
          <div class="p-4">
            <textarea id="sec-\${key}" 
                      class="section-editor w-full border rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent \${hasNg ? 'border-red-300' : ''}"
                      placeholder="\${def.label}を記載してください...">\${escapeHtml(sections[key] || '')}</textarea>
            \${hasNg ? '<div id="ng-section-' + key + '" class="mt-3 p-3 bg-red-50 rounded-md"></div>' : ''}
          </div>
          <!-- 例文表示エリア -->
          <div id="example-\${key}" class="hidden example-box border-t p-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-blue-800"><i class="fas fa-lightbulb mr-1"></i>\${def.label}の例文</h4>
              <div class="space-x-2">
                <button onclick="insertExample('\${key}', 'append')" class="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700">末尾に追加</button>
                <button onclick="insertExample('\${key}', 'replace')" class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white">置き換え</button>
                <button onclick="hideExample('\${key}')" class="text-sm text-gray-500 hover:text-gray-700">閉じる</button>
              </div>
            </div>
            <pre class="text-sm text-gray-700 whitespace-pre-wrap">\${escapeHtml(SECTION_EXAMPLES[key] || '例文が準備されていません')}</pre>
          </div>
        \`;
        
        container.appendChild(card);
        
        // NG詳細を表示
        if (hasNg) {
          renderNgDetails(key, ngHitsBySection[key]);
        }
      });
      
      // 変更検知を再設定
      document.querySelectorAll('textarea').forEach(el => {
        el.addEventListener('input', () => {
          if (!hasChanges) {
            hasChanges = true;
            showSaveStatus('unsaved');
          }
        });
      });
    }
    
    // セクション内のNG詳細を表示
    function renderNgDetails(sectionKey, hits) {
      const container = document.getElementById('ng-section-' + sectionKey);
      if (!container || !hits || hits.length === 0) return;
      
      container.innerHTML = hits.map((hit, idx) => {
        const pattern = hit.matchText || hit.pattern;
        const suggestions = NG_SUGGESTIONS[pattern] || [];
        
        return \`
          <div class="mb-2 last:mb-0">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-red-700 font-semibold">"<mark class="ng-mark">\${escapeHtml(pattern)}</mark>"</span>
                <span class="text-sm text-gray-600 ml-2">\${escapeHtml(hit.reason)}</span>
              </div>
            </div>
            \${suggestions.length > 0 ? \`
              <div class="mt-2 flex flex-wrap gap-2">
                <span class="text-xs text-gray-500">代替案:</span>
                \${suggestions.map(s => \`
                  <button onclick="replaceInSection('\${sectionKey}', '\${escapeHtml(pattern)}', '\${escapeHtml(s)}')" 
                          class="suggestion-btn text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded">
                    \${escapeHtml(s)}
                  </button>
                \`).join('')}
              </div>
            \` : ''}
          </div>
        \`;
      }).join('');
    }
    
    // セクション内の文字列を置換
    function replaceInSection(sectionKey, oldText, newText) {
      const el = document.getElementById('sec-' + sectionKey);
      if (!el) return;
      
      el.value = el.value.replace(new RegExp(oldText, 'g'), newText);
      hasChanges = true;
      showSaveStatus('unsaved');
      
      // 置換後にNGチェックを再実行
      checkNg();
    }
    
    // 全てのNGを自動修正
    async function fixAllNg() {
      if (!currentNgHits || currentNgHits.length === 0) return;
      
      if (!confirm('検出されたNG表現を自動的に代替表現に置換しますか？\\n（最初の代替案が使用されます）')) {
        return;
      }
      
      const sections = getSections();
      
      for (const hit of currentNgHits) {
        const pattern = hit.matchText || hit.pattern;
        const suggestions = NG_SUGGESTIONS[pattern];
        
        if (suggestions && suggestions.length > 0) {
          const replacement = suggestions[0];
          
          for (const key of sectionOrder) {
            if (sections[key]) {
              sections[key] = sections[key].replace(new RegExp(pattern, 'g'), replacement);
            }
          }
        }
      }
      
      // 更新を反映
      for (const key of sectionOrder) {
        const el = document.getElementById('sec-' + key);
        if (el) el.value = sections[key];
      }
      
      hasChanges = true;
      showSaveStatus('unsaved');
      
      // NGチェック再実行
      await checkNg();
    }
    
    // セクションを移動
    function moveSection(key, direction) {
      const currentIndex = sectionOrder.indexOf(key);
      const newIndex = currentIndex + direction;
      
      if (newIndex < 0 || newIndex >= sectionOrder.length) return;
      
      // 順序を入れ替え
      [sectionOrder[currentIndex], sectionOrder[newIndex]] = [sectionOrder[newIndex], sectionOrder[currentIndex]];
      
      // 現在の値を保持して再描画
      const sections = getSections();
      const ngHitsBySection = categorizeNgBySection(currentNgHits, sections);
      renderSections(sections, ngHitsBySection);
      
      hasChanges = true;
      showSaveStatus('unsaved');
    }
    
    // 例文を表示
    function showExample(key) {
      document.getElementById('example-' + key).classList.remove('hidden');
    }
    
    // 例文を非表示
    function hideExample(key) {
      document.getElementById('example-' + key).classList.add('hidden');
    }
    
    // 例文を挿入
    function insertExample(key, mode) {
      const el = document.getElementById('sec-' + key);
      const example = SECTION_EXAMPLES[key];
      
      if (!el || !example) return;
      
      if (mode === 'replace') {
        if (el.value && !confirm('現在の内容を例文で置き換えますか？')) {
          return;
        }
        el.value = example;
      } else {
        el.value = el.value + (el.value ? '\\n\\n' : '') + example;
      }
      
      hasChanges = true;
      showSaveStatus('unsaved');
      hideExample(key);
    }
    
    // プレビュー表示
    function togglePreview() {
      const modal = document.getElementById('preview-modal');
      const content = document.getElementById('preview-content');
      const sections = getSections();
      const ngHitsBySection = categorizeNgBySection(currentNgHits, sections);
      
      // プレビューコンテンツを生成
      content.innerHTML = sectionOrder.map(key => {
        const def = SECTION_DEFS.find(d => d.key === key);
        const hits = ngHitsBySection[key] || [];
        const highlighted = highlightNg(sections[key] || '（未入力）', hits);
        
        return \`
          <div class="border rounded-lg overflow-hidden">
            <div class="bg-gray-100 px-4 py-2 font-semibold text-gray-800">
              <i class="fas \${def.icon} text-\${def.color}-500 mr-2"></i>\${def.label}
              \${hits.length > 0 ? '<span class="ml-2 text-sm text-red-600">(' + hits.length + '件のNG)</span>' : ''}
            </div>
            <div class="p-4 preview-box text-gray-700">\${highlighted}</div>
          </div>
        \`;
      }).join('');
      
      modal.classList.remove('hidden');
    }
    
    // プレビューを閉じる
    function closePreview() {
      document.getElementById('preview-modal').classList.add('hidden');
    }
    
    // NG結果を表示（改善版）
    function showNgResult(ng) {
      const ngOk = document.getElementById('ng-ok');
      const ngWarning = document.getElementById('ng-warning');
      const ngList = document.getElementById('ng-list');
      const fixAllBtn = document.getElementById('btn-fix-all');
      
      currentNgHits = ng?.hits || [];
      
      if (!ng || currentNgHits.length === 0) {
        ngOk.classList.remove('hidden');
        ngWarning.classList.add('hidden');
        fixAllBtn.classList.add('hidden');
      } else {
        ngOk.classList.add('hidden');
        ngWarning.classList.remove('hidden');
        
        // 置換可能なNGがあれば「全て修正」ボタンを表示
        const hasFixable = currentNgHits.some(hit => {
          const pattern = hit.matchText || hit.pattern;
          return NG_SUGGESTIONS[pattern] && NG_SUGGESTIONS[pattern].length > 0;
        });
        fixAllBtn.classList.toggle('hidden', !hasFixable);
        
        // NG一覧
        ngList.innerHTML = currentNgHits.map(hit => {
          const pattern = hit.matchText || hit.pattern;
          const suggestions = NG_SUGGESTIONS[pattern] || [];
          
          return \`
            <div class="bg-white rounded-md p-3 border border-yellow-300">
              <div class="flex items-start justify-between">
                <div>
                  <span class="font-semibold text-yellow-900">"<mark class="ng-mark">\${escapeHtml(pattern)}</mark>"</span>
                  <span class="text-sm text-yellow-800 ml-2">\${escapeHtml(hit.reason)}</span>
                </div>
              </div>
              \${suggestions.length > 0 ? \`
                <div class="mt-2 flex flex-wrap gap-2">
                  <span class="text-xs text-yellow-700">代替候補:</span>
                  \${suggestions.map(s => \`
                    <span class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">\${escapeHtml(s)}</span>
                  \`).join('')}
                </div>
              \` : '<p class="text-xs text-yellow-700 mt-1">代替表現はセクション内で修正してください</p>'}
            </div>
          \`;
        }).join('');
        
        // セクション別にも反映
        const sections = getSections();
        const ngHitsBySection = categorizeNgBySection(currentNgHits, sections);
        renderSections(sections, ngHitsBySection);
      }
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
        const res = await window.api('/api/draft/generate', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId, mode: 'template' })
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || 'ドラフト生成に失敗しました');
        }
        
        draftId = res.data.draft_id;
        
        // セクション順序を復元（meta.order があれば）
        if (res.data.meta && res.data.meta.order) {
          sectionOrder = res.data.meta.order;
        }
        
        currentNgHits = res.data.ng?.hits || [];
        const ngHitsBySection = categorizeNgBySection(currentNgHits, res.data.sections);
        renderSections(res.data.sections, ngHitsBySection);
        showNgResult(res.data.ng);
        
        // 補助金タイトル取得
        const sessionRes = await window.api('/api/chat/sessions/' + sessionId);
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
        const res = await window.api('/api/draft/' + draftId, {
          method: 'PUT',
          body: JSON.stringify({ 
            sections,
            meta: { order: sectionOrder }
          })
        });
        
        if (!res.success) {
          throw new Error(res.error?.message || '保存に失敗しました');
        }
        
        currentNgHits = res.data.ng?.hits || [];
        const ngHitsBySection = categorizeNgBySection(currentNgHits, sections);
        renderSections(sections, ngHitsBySection);
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
      
      // まず現在の内容を保存
      await saveDraft();
    }
    
    // 再生成
    async function regenerate() {
      if (!confirm('現在の内容を破棄して再生成しますか？\\n（この操作は取り消せません）')) {
        return;
      }
      
      document.getElementById('main-content').classList.add('hidden');
      document.getElementById('loading').classList.remove('hidden');
      
      draftId = null;
      sectionOrder = SECTION_DEFS.map(s => s.key);
      await generateDraft();
    }
    
    // 確定
    async function finalizeDraft() {
      if (!draftId) return;
      
      await saveDraft();
      
      if (!confirm('ドラフトを確定しますか？\\n確定後も編集は可能です。')) {
        return;
      }
      
      try {
        const res = await window.api('/api/draft/' + draftId + '/finalize', {
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
    
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePreview();
      }
    });
    
    // 初期化
    generateDraft();
  </script>
</body>
</html>
  `);
});

export default draftPages;

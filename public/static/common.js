/**
 * common.js - 共通ユーティリティ
 * 
 * 全ページで使用する共通機能を集約
 * - API呼び出し（認証エラー時の自動ログアウト付き）
 * - ナビゲーション
 * - 共通UI処理
 * 
 * 使用方法:
 * <script src="/static/common.js"></script>
 */

(function(window) {
  'use strict';

  // ============================================================
  // 定数
  // ============================================================
  
  const AUTH_ERROR_CODES = ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'INVALID_TOKEN'];
  const LOGIN_PATH = '/login';
  
  // ============================================================
  // グローバル状態
  // ============================================================
  
  window.hasCompanyInfo = false;
  
  // ============================================================
  // API呼び出しヘルパー
  // ============================================================
  
  /**
   * 認証付きAPI呼び出し
   * - トークンがない場合はログインページへリダイレクト
   * - 401/認証エラー時は自動ログアウト
   * 
   * @param {string} url - APIエンドポイント（例: '/api/companies'）
   * @param {object} options - fetch オプション
   * @returns {Promise<object>} APIレスポンス
   */
  window.apiCall = async function(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // トークンがない場合はログインへ
    if (!token) {
      window.location.href = LOGIN_PATH;
      return Promise.reject(new Error('認証が必要です'));
    }
    
    // ヘッダー構築
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };
    
    // 追加ヘッダーをマージ
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    // fetchオプション構築
    const fetchOptions = {
      method: options.method || 'GET',
      headers: headers
    };
    
    if (options.body) {
      fetchOptions.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }
    
    try {
      const response = await fetch(url, fetchOptions);
      
      // 認証エラーチェック（ステータスコード）
      if (response.status === 401) {
        handleAuthError('セッションの有効期限が切れました。再度ログインしてください。');
        return { success: false, error: { code: 'UNAUTHORIZED', message: '認証エラー' } };
      }
      
      const data = await response.json();
      
      // 認証エラーチェック（レスポンスコード）
      if (data && data.error && AUTH_ERROR_CODES.includes(data.error.code)) {
        handleAuthError('セッションの有効期限が切れました。再度ログインしてください。');
        return data;
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '通信エラーが発生しました。ネットワーク接続を確認してください。'
        }
      };
    }
  };
  
  /**
   * window.api エイリアス（後方互換性）
   * 一部ページで window.api(path, options) の形式で使用
   */
  window.api = window.apiCall;
  
  // ============================================================
  // 認証エラーハンドリング
  // ============================================================
  
  /**
   * 認証エラー時の処理
   * - ローカルストレージをクリア
   * - アラート表示
   * - ログインページへリダイレクト
   */
  function handleAuthError(message) {
    // ストレージクリア
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // アラート表示
    alert(message || '認証エラーが発生しました。再度ログインしてください。');
    
    // リダイレクト
    window.location.href = LOGIN_PATH;
  }
  
  // グローバルに公開（必要に応じて外部から呼び出し可能）
  window.handleAuthError = handleAuthError;
  
  // ============================================================
  // ナビゲーションヘルパー
  // ============================================================
  
  /**
   * 補助金一覧へナビゲート
   * 企業情報が登録されていない場合は会社情報ページへ
   */
  window.navigateToSubsidies = function(e) {
    if (e) e.preventDefault();
    
    if (!window.hasCompanyInfo) {
      alert('まず会社情報を登録してください');
      window.location.href = '/company';
      return;
    }
    
    window.location.href = '/subsidies';
  };
  
  /**
   * ページ遷移
   */
  window.navigateTo = function(path) {
    window.location.href = path;
  };
  
  // ============================================================
  // UI ヘルパー
  // ============================================================
  
  /**
   * タブ切り替え
   * @param {string} tabId - 表示するタブのID
   * @param {HTMLElement} button - クリックされたタブボタン
   */
  window.switchTab = function(tabId, button) {
    // タブコンテンツの切り替え
    document.querySelectorAll('.tab-content').forEach(function(content) {
      content.classList.add('hidden');
    });
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
      targetTab.classList.remove('hidden');
    }
    
    // タブボタンのアクティブ状態
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.classList.remove('border-blue-500', 'text-blue-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    if (button) {
      button.classList.add('border-blue-500', 'text-blue-600');
      button.classList.remove('border-transparent', 'text-gray-500');
    }
  };
  
  /**
   * ローディングスピナー表示
   */
  window.showLoading = function(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '<div class="flex justify-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>';
    }
  };
  
  /**
   * エラーメッセージ表示
   */
  window.showError = function(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">' + 
        '<i class="fas fa-exclamation-triangle mr-2"></i>' + message + '</div>';
    }
  };
  
  /**
   * 成功メッセージ表示
   */
  window.showSuccess = function(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">' + 
        '<i class="fas fa-check-circle mr-2"></i>' + message + '</div>';
    }
  };
  
  // ============================================================
  // フォーマッター
  // ============================================================
  
  /**
   * 通貨フォーマット
   */
  window.formatCurrency = function(amount) {
    if (amount === null || amount === undefined || amount === '') return '-';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY', 
      maximumFractionDigits: 0 
    }).format(amount);
  };
  
  /**
   * 日付フォーマット
   */
  window.formatDate = function(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };
  
  /**
   * 数値フォーマット（カンマ区切り）
   */
  window.formatNumber = function(num) {
    if (num === null || num === undefined || num === '') return '-';
    return new Intl.NumberFormat('ja-JP').format(num);
  };
  
  // ============================================================
  // バリデーション
  // ============================================================
  
  /**
   * メールアドレス検証
   */
  window.isValidEmail = function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };
  
  /**
   * 電話番号検証（日本）
   */
  window.isValidPhone = function(phone) {
    const re = /^[0-9-]{10,13}$/;
    return re.test(phone);
  };
  
  /**
   * 郵便番号検証（日本）
   */
  window.isValidPostalCode = function(code) {
    const re = /^[0-9]{3}-?[0-9]{4}$/;
    return re.test(code);
  };
  
  // ============================================================
  // ストレージヘルパー
  // ============================================================
  
  /**
   * ユーザー情報取得
   */
  window.getCurrentUser = function() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse user data:', e);
      return null;
    }
  };
  
  /**
   * トークン取得
   */
  window.getToken = function() {
    return localStorage.getItem('token');
  };
  
  /**
   * ログイン状態チェック
   */
  window.isLoggedIn = function() {
    return !!localStorage.getItem('token');
  };
  
  /**
   * ログアウト
   */
  window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = LOGIN_PATH;
  };
  
  // ============================================================
  // 初期化
  // ============================================================
  
  // DOMContentLoaded 時に認証状態をチェック
  document.addEventListener('DOMContentLoaded', function() {
    // ログインページ以外でトークンがない場合はログインへ
    const currentPath = window.location.pathname;
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/intake', '/answer', '/'];
    
    const isPublicPath = publicPaths.some(function(path) {
      return currentPath === path || currentPath.startsWith('/intake') || currentPath.startsWith('/answer');
    });
    
    if (!isPublicPath && !window.isLoggedIn()) {
      window.location.href = LOGIN_PATH;
    }
  });
  
  console.log('common.js loaded');

})(window);

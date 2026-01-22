/**
 * 認証UI画面
 * /login /register /forgot /reset
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const pages = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================
// 共通レイアウト
// ============================================================

const AuthLayout = ({ children, title }: { children: any; title: string }) => (
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - ホジョラク</title>
      <link rel="icon" type="image/png" href="/favicon.png" />
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        {/* Logo */}
        <div class="text-center mb-8">
          <a href="/" class="inline-block">
            <img src="/static/images/logo.png" alt="ホジョラク" class="w-64 mx-auto" />
          </a>
        </div>
        {children}
      </div>
    </body>
  </html>
);

// ============================================================
// ログイン画面
// ============================================================

pages.get('/login', (c) => {
  return c.html(
    <AuthLayout title="ログイン">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">ログイン</h1>
        
        {/* エラーメッセージ表示エリア */}
        <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
        
        <form id="login-form" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-envelope mr-1 text-gray-400"></i>
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="example@company.com"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-lock mr-1 text-gray-400"></i>
              パスワード
            </label>
            <div class="relative">
              <input
                type="password"
                name="password"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-10"
                placeholder="••••••••"
              />
              <button type="button" id="toggle-password" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <i class="fas fa-sign-in-alt"></i>
            ログイン
          </button>
        </form>
        
        <div class="mt-6 text-center text-sm text-gray-600">
          <a href="/forgot" class="text-blue-600 hover:text-blue-800 hover:underline">
            パスワードをお忘れですか？
          </a>
        </div>
        
        <div class="mt-6 pt-6 border-t border-gray-200 text-center">
          <p class="text-gray-600 text-sm">
            アカウントをお持ちでない方は
            <a href="/register" class="text-blue-600 hover:text-blue-800 font-medium hover:underline ml-1">
              新規登録
            </a>
          </p>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        // パスワード表示切り替え
        document.getElementById('toggle-password').addEventListener('click', function() {
          const input = document.querySelector('input[name="password"]');
          const icon = this.querySelector('i');
          if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
          } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
          }
        });
        
        // ログインフォーム送信
        document.getElementById('login-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const btn = form.querySelector('button[type="submit"]');
          const errorDiv = document.getElementById('error-message');
          
          // ボタンを無効化
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ログイン中...';
          errorDiv.classList.add('hidden');
          
          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: form.email.value,
                password: form.password.value
              })
            });
            
            const data = await res.json();
            
            if (data.success) {
              // JWT保存
              localStorage.setItem('token', data.data.token);
              localStorage.setItem('user', JSON.stringify(data.data.user));
              // ロールに応じてリダイレクト
              const role = data.data.user.role;
              if (role === 'agency') {
                window.location.href = '/agency';
              } else if (role === 'admin' || role === 'super_admin') {
                window.location.href = '/admin';
              } else {
                window.location.href = '/dashboard';
              }
            } else {
              errorDiv.textContent = data.error.message || 'ログインに失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ログイン';
          }
        });
      `}} />
    </AuthLayout>
  );
});

// ============================================================
// 新規登録画面
// ============================================================

pages.get('/register', (c) => {
  return c.html(
    <AuthLayout title="新規登録">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">アカウント作成</h1>
        
        <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
        
        <form id="register-form" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-user mr-1 text-gray-400"></i>
              お名前
            </label>
            <input
              type="text"
              name="name"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="山田 太郎"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-envelope mr-1 text-gray-400"></i>
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="example@company.com"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-lock mr-1 text-gray-400"></i>
              パスワード
            </label>
            <input
              type="password"
              name="password"
              required
              minlength="8"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="8文字以上（大文字・小文字・数字を含む）"
            />
            <p class="mt-1 text-xs text-gray-500">
              8文字以上、大文字・小文字・数字を含めてください
            </p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-building mr-1 text-gray-400"></i>
              会社名（任意）
            </label>
            <input
              type="text"
              name="companyName"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="株式会社○○"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-3">
              <i class="fas fa-user-tag mr-1 text-gray-400"></i>
              ご利用形態
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="relative">
                <input type="radio" name="accountType" value="user" class="peer sr-only" checked />
                <div class="p-4 border-2 rounded-lg cursor-pointer peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:bg-gray-50 transition">
                  <div class="flex items-center gap-2 mb-1">
                    <i class="fas fa-user text-blue-600"></i>
                    <span class="font-medium">一般</span>
                  </div>
                  <p class="text-xs text-gray-500">自社の補助金申請に利用</p>
                </div>
              </label>
              <label class="relative">
                <input type="radio" name="accountType" value="agency" class="peer sr-only" />
                <div class="p-4 border-2 rounded-lg cursor-pointer peer-checked:border-emerald-500 peer-checked:bg-emerald-50 hover:bg-gray-50 transition">
                  <div class="flex items-center gap-2 mb-1">
                    <i class="fas fa-briefcase text-emerald-600"></i>
                    <span class="font-medium">士業・顧問</span>
                  </div>
                  <p class="text-xs text-gray-500">顧客企業の代理で利用</p>
                </div>
              </label>
            </div>
          </div>
          
          <button
            type="submit"
            class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <i class="fas fa-user-plus"></i>
            アカウント作成
          </button>
        </form>
        
        <div class="mt-6 pt-6 border-t border-gray-200 text-center">
          <p class="text-gray-600 text-sm">
            すでにアカウントをお持ちの方は
            <a href="/login" class="text-blue-600 hover:text-blue-800 font-medium hover:underline ml-1">
              ログイン
            </a>
          </p>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('register-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const btn = form.querySelector('button[type="submit"]');
          const errorDiv = document.getElementById('error-message');
          
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登録中...';
          errorDiv.classList.add('hidden');
          
          try {
            const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: form.name.value,
                email: form.email.value,
                password: form.password.value,
                companyName: form.companyName.value || undefined,
                accountType: form.accountType.value
              })
            });
            
            const data = await res.json();
            
            if (data.success) {
              localStorage.setItem('token', data.data.token);
              localStorage.setItem('user', JSON.stringify(data.data.user));
              // ロールに応じてリダイレクト
              const role = data.data.user.role;
              if (role === 'agency') {
                window.location.href = '/agency';
              } else {
                window.location.href = '/dashboard';
              }
            } else {
              errorDiv.textContent = data.error.message || '登録に失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> アカウント作成';
          }
        });
      `}} />
    </AuthLayout>
  );
});

// ============================================================
// パスワード再発行依頼画面
// ============================================================

pages.get('/forgot', (c) => {
  return c.html(
    <AuthLayout title="パスワード再発行">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-2 text-center">パスワード再発行</h1>
        <p class="text-gray-600 text-sm text-center mb-6">
          登録済みのメールアドレスを入力してください
        </p>
        
        <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
        <div id="success-message" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
        
        <form id="forgot-form" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-envelope mr-1 text-gray-400"></i>
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="example@company.com"
            />
          </div>
          
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <i class="fas fa-paper-plane"></i>
            再発行メールを送信
          </button>
        </form>
        
        <div class="mt-6 pt-6 border-t border-gray-200 text-center">
          <a href="/login" class="text-blue-600 hover:text-blue-800 text-sm hover:underline">
            <i class="fas fa-arrow-left mr-1"></i>
            ログインに戻る
          </a>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('forgot-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const btn = form.querySelector('button[type="submit"]');
          const errorDiv = document.getElementById('error-message');
          const successDiv = document.getElementById('success-message');
          
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';
          errorDiv.classList.add('hidden');
          successDiv.classList.add('hidden');
          
          try {
            const res = await fetch('/api/auth/password-reset/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: form.email.value })
            });
            
            const data = await res.json();
            
            if (data.success) {
              successDiv.innerHTML = '再発行メールを送信しました。<br>メールをご確認ください。';
              if (data.data.debug_token) {
                successDiv.innerHTML += '<br><br><strong>開発用トークン:</strong><br><code class="text-xs break-all">' + data.data.debug_token + '</code>';
              }
              successDiv.classList.remove('hidden');
              form.reset();
            } else {
              errorDiv.textContent = data.error.message || '送信に失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> 再発行メールを送信';
          }
        });
      `}} />
    </AuthLayout>
  );
});

// ============================================================
// パスワードリセット画面
// ============================================================

pages.get('/reset', (c) => {
  const token = c.req.query('token') || '';
  
  return c.html(
    <AuthLayout title="パスワードリセット">
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-2 text-center">新しいパスワード設定</h1>
        <p class="text-gray-600 text-sm text-center mb-6">
          新しいパスワードを入力してください
        </p>
        
        <div id="error-message" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>
        <div id="success-message" class="hidden mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"></div>
        
        <form id="reset-form" class="space-y-5">
          <input type="hidden" name="token" value={token} />
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-lock mr-1 text-gray-400"></i>
              新しいパスワード
            </label>
            <input
              type="password"
              name="new_password"
              required
              minlength="8"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="8文字以上（大文字・小文字・数字を含む）"
            />
            <p class="mt-1 text-xs text-gray-500">
              8文字以上、大文字・小文字・数字を含めてください
            </p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              <i class="fas fa-lock mr-1 text-gray-400"></i>
              パスワード確認
            </label>
            <input
              type="password"
              name="confirm_password"
              required
              minlength="8"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="もう一度入力してください"
            />
          </div>
          
          <button
            type="submit"
            class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <i class="fas fa-key"></i>
            パスワードを変更
          </button>
        </form>
        
        <div class="mt-6 pt-6 border-t border-gray-200 text-center">
          <a href="/login" class="text-blue-600 hover:text-blue-800 text-sm hover:underline">
            <i class="fas fa-arrow-left mr-1"></i>
            ログインに戻る
          </a>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('reset-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          const form = e.target;
          const btn = form.querySelector('button[type="submit"]');
          const errorDiv = document.getElementById('error-message');
          const successDiv = document.getElementById('success-message');
          
          // パスワード一致チェック
          if (form.new_password.value !== form.confirm_password.value) {
            errorDiv.textContent = 'パスワードが一致しません';
            errorDiv.classList.remove('hidden');
            return;
          }
          
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 変更中...';
          errorDiv.classList.add('hidden');
          successDiv.classList.add('hidden');
          
          try {
            const res = await fetch('/api/auth/password-reset/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: form.token.value,
                new_password: form.new_password.value
              })
            });
            
            const data = await res.json();
            
            if (data.success) {
              successDiv.innerHTML = 'パスワードを変更しました。<br><a href="/login" class="underline font-medium">ログインページへ</a>';
              successDiv.classList.remove('hidden');
              form.reset();
            } else {
              errorDiv.textContent = data.error.message || '変更に失敗しました';
              errorDiv.classList.remove('hidden');
            }
          } catch (err) {
            errorDiv.textContent = '通信エラーが発生しました';
            errorDiv.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-key"></i> パスワードを変更';
          }
        });
      `}} />
    </AuthLayout>
  );
});

export default pages;

/**
 * 顧客ポータルページ（ログイン不要）
 * 
 * /intake - 企業情報入力
 * /answer - 壁打ち質問回答
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const portalPages = new Hono<{ Bindings: Env; Variables: Variables }>();

// 共通レイアウト（ログイン不要）
const portalLayout = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ホジョラク</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .loading { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .form-input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-white shadow-sm">
    <div class="max-w-3xl mx-auto px-4 py-4">
      <div class="flex items-center gap-3">
        <img src="/static/images/icon.png" alt="ホジョラク" class="h-10">
        <div>
          <h1 class="text-xl font-bold text-gray-900">ホジョラク</h1>
          <p class="text-sm text-gray-500">補助金マッチング＆申請支援</p>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-3xl mx-auto px-4 py-8">
    ${content}
  </main>

  <!-- Footer -->
  <footer class="max-w-3xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
    <p>© 2024 ホジョラク. All rights reserved.</p>
  </footer>
</body>
</html>
`;

/**
 * GET /intake - 企業情報入力ページ
 */
portalPages.get('/intake', (c) => {
  const content = `
    <div id="loading" class="text-center py-12">
      <div class="loading inline-block w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-gray-600">読み込み中...</p>
    </div>
    
    <div id="error" class="hidden text-center py-12">
      <div class="text-red-500 text-5xl mb-4"><i class="fas fa-exclamation-circle"></i></div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">リンクが無効です</h2>
      <p id="error-message" class="text-gray-600">このリンクは期限切れまたは無効になっています。</p>
    </div>
    
    <div id="form-container" class="hidden">
      <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="bg-emerald-100 p-3 rounded-full">
            <i class="fas fa-building text-emerald-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">企業情報入力</h2>
            <p class="text-sm text-gray-500">担当: <span id="agency-name" class="font-medium">-</span></p>
          </div>
        </div>
        
        <div id="message-box" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p id="intake-message" class="text-blue-800"></p>
        </div>
        
        <form id="intake-form" class="space-y-6">
          <!-- 基本情報 -->
          <div class="border-b pb-4">
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-info-circle mr-2 text-emerald-600"></i>基本情報</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">会社名 <span class="text-red-500">*</span></label>
                <input type="text" name="name" required class="form-input w-full border rounded-lg px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">代表者名</label>
                <input type="text" name="representative_name" class="form-input w-full border rounded-lg px-3 py-2">
              </div>
            </div>
          </div>
          
          <!-- 所在地 -->
          <div class="border-b pb-4">
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-map-marker-alt mr-2 text-emerald-600"></i>所在地</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">都道府県 <span class="text-red-500">*</span></label>
                <select name="prefecture" required class="form-input w-full border rounded-lg px-3 py-2">
                  <option value="">選択してください</option>
                  <option value="北海道">北海道</option>
                  <option value="青森県">青森県</option>
                  <option value="岩手県">岩手県</option>
                  <option value="宮城県">宮城県</option>
                  <option value="秋田県">秋田県</option>
                  <option value="山形県">山形県</option>
                  <option value="福島県">福島県</option>
                  <option value="茨城県">茨城県</option>
                  <option value="栃木県">栃木県</option>
                  <option value="群馬県">群馬県</option>
                  <option value="埼玉県">埼玉県</option>
                  <option value="千葉県">千葉県</option>
                  <option value="東京都">東京都</option>
                  <option value="神奈川県">神奈川県</option>
                  <option value="新潟県">新潟県</option>
                  <option value="富山県">富山県</option>
                  <option value="石川県">石川県</option>
                  <option value="福井県">福井県</option>
                  <option value="山梨県">山梨県</option>
                  <option value="長野県">長野県</option>
                  <option value="岐阜県">岐阜県</option>
                  <option value="静岡県">静岡県</option>
                  <option value="愛知県">愛知県</option>
                  <option value="三重県">三重県</option>
                  <option value="滋賀県">滋賀県</option>
                  <option value="京都府">京都府</option>
                  <option value="大阪府">大阪府</option>
                  <option value="兵庫県">兵庫県</option>
                  <option value="奈良県">奈良県</option>
                  <option value="和歌山県">和歌山県</option>
                  <option value="鳥取県">鳥取県</option>
                  <option value="島根県">島根県</option>
                  <option value="岡山県">岡山県</option>
                  <option value="広島県">広島県</option>
                  <option value="山口県">山口県</option>
                  <option value="徳島県">徳島県</option>
                  <option value="香川県">香川県</option>
                  <option value="愛媛県">愛媛県</option>
                  <option value="高知県">高知県</option>
                  <option value="福岡県">福岡県</option>
                  <option value="佐賀県">佐賀県</option>
                  <option value="長崎県">長崎県</option>
                  <option value="熊本県">熊本県</option>
                  <option value="大分県">大分県</option>
                  <option value="宮崎県">宮崎県</option>
                  <option value="鹿児島県">鹿児島県</option>
                  <option value="沖縄県">沖縄県</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">市区町村</label>
                <input type="text" name="city" class="form-input w-full border rounded-lg px-3 py-2">
              </div>
            </div>
          </div>
          
          <!-- 事業情報（凍結仕様v1: 業種・従業員数は必須） -->
          <div class="border-b pb-4">
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-briefcase mr-2 text-emerald-600"></i>事業情報</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">業種 <span class="text-red-500">*</span></label>
                <input type="text" name="industry" required placeholder="例: 製造業、IT、飲食業" class="form-input w-full border rounded-lg px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">従業員数 <span class="text-red-500">*</span></label>
                <input type="number" name="employee_count" required min="1" placeholder="例: 10" class="form-input w-full border rounded-lg px-3 py-2">
                <p class="text-xs text-gray-500 mt-1">正確な人数を半角数字で入力してください</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">資本金</label>
                <input type="text" name="capital" placeholder="例: 1000万円" class="form-input w-full border rounded-lg px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">設立年月</label>
                <input type="month" name="founded_date" class="form-input w-full border rounded-lg px-3 py-2">
              </div>
            </div>
          </div>
          
          <!-- 財務情報 -->
          <div class="border-b pb-4">
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-chart-line mr-2 text-emerald-600"></i>財務情報（任意）</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">直近売上高</label>
                <input type="text" name="annual_revenue" placeholder="例: 5000万円" class="form-input w-full border rounded-lg px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">決算月</label>
                <select name="fiscal_month" class="form-input w-full border rounded-lg px-3 py-2">
                  <option value="">選択してください</option>
                  <option value="1">1月</option>
                  <option value="2">2月</option>
                  <option value="3">3月</option>
                  <option value="4">4月</option>
                  <option value="5">5月</option>
                  <option value="6">6月</option>
                  <option value="7">7月</option>
                  <option value="8">8月</option>
                  <option value="9">9月</option>
                  <option value="10">10月</option>
                  <option value="11">11月</option>
                  <option value="12">12月</option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- 補足 -->
          <div>
            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-comment mr-2 text-emerald-600"></i>補足情報</h3>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">その他連絡事項</label>
              <textarea name="notes" rows="3" placeholder="補助金申請に関連する情報や質問があればご記入ください" class="form-input w-full border rounded-lg px-3 py-2"></textarea>
            </div>
          </div>
          
          <button type="submit" class="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition">
            <i class="fas fa-paper-plane mr-2"></i>送信する
          </button>
        </form>
      </div>
    </div>
    
    <div id="success" class="hidden text-center py-12">
      <div class="text-emerald-500 text-5xl mb-4"><i class="fas fa-check-circle"></i></div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">送信完了</h2>
      <p class="text-gray-600">ご入力ありがとうございます。<br>担当者が確認いたします。</p>
    </div>
    
    <script>
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (!code) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('error-message').textContent = 'アクセスコードが指定されていません。';
      } else {
        // リンク検証
        fetch('/api/portal/verify?code=' + code)
          .then(r => r.json())
          .then(data => {
            document.getElementById('loading').classList.add('hidden');
            
            if (!data.success) {
              document.getElementById('error').classList.remove('hidden');
              document.getElementById('error-message').textContent = data.error?.message || 'リンクが無効です。';
              return;
            }
            
            if (data.data.type !== 'intake') {
              document.getElementById('error').classList.remove('hidden');
              document.getElementById('error-message').textContent = 'このリンクは企業情報入力用ではありません。';
              return;
            }
            
            document.getElementById('form-container').classList.remove('hidden');
            document.getElementById('agency-name').textContent = data.data.agency;
            
            // 既存の会社名をプリフィル
            if (data.data.company && data.data.company !== '未登録') {
              document.querySelector('input[name="name"]').value = data.data.company;
            }
            
            // メッセージがあれば表示
            if (data.data.message) {
              document.getElementById('message-box').classList.remove('hidden');
              document.getElementById('intake-message').textContent = data.data.message;
            }
          })
          .catch(() => {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('error').classList.remove('hidden');
          });
      }
      
      // フォーム送信
      document.getElementById('intake-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const payload = {};
        formData.forEach((value, key) => {
          if (value) payload[key] = value;
        });
        
        // 凍結仕様v1: 数値フィールドを変換
        if (payload.employee_count) {
          payload.employee_count = parseInt(payload.employee_count, 10);
          if (isNaN(payload.employee_count) || payload.employee_count <= 0) {
            alert('従業員数は1以上の数値で入力してください');
            return;
          }
        }
        if (payload.capital) {
          // 「1000万円」などの文字を数値に変換試行
          const capitalNum = parseInt(String(payload.capital).replace(/[^0-9]/g, ''), 10);
          if (!isNaN(capitalNum)) payload.capital = capitalNum;
        }
        if (payload.annual_revenue) {
          const revenueNum = parseInt(String(payload.annual_revenue).replace(/[^0-9]/g, ''), 10);
          if (!isNaN(revenueNum)) payload.annual_revenue = revenueNum;
        }
        
        try {
          const res = await fetch('/api/portal/intake?code=' + code, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          
          const data = await res.json();
          
          if (data.success) {
            document.getElementById('form-container').classList.add('hidden');
            document.getElementById('success').classList.remove('hidden');
          } else {
            alert('エラー: ' + (data.error?.message || '送信に失敗しました'));
          }
        } catch (err) {
          alert('通信エラーが発生しました。もう一度お試しください。');
        }
      });
    </script>
  `;
  
  return c.html(portalLayout('企業情報入力', content));
});

/**
 * GET /answer - 壁打ち質問回答ページ
 */
portalPages.get('/answer', (c) => {
  const content = `
    <div id="loading" class="text-center py-12">
      <div class="loading inline-block w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-gray-600">読み込み中...</p>
    </div>
    
    <div id="error" class="hidden text-center py-12">
      <div class="text-red-500 text-5xl mb-4"><i class="fas fa-exclamation-circle"></i></div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">リンクが無効です</h2>
      <p id="error-message" class="text-gray-600">このリンクは期限切れまたは無効になっています。</p>
    </div>
    
    <div id="form-container" class="hidden">
      <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="bg-purple-100 p-3 rounded-full">
            <i class="fas fa-comments text-purple-600 text-xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900">壁打ち質問への回答</h2>
            <p id="subsidy-title" class="text-sm text-gray-500">-</p>
          </div>
        </div>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-blue-800 text-sm">
            <i class="fas fa-info-circle mr-1"></i>
            担当者が補助金申請のために必要な情報をお伺いしています。<br>
            以下の質問にご回答ください。
          </p>
        </div>
        
        <form id="answer-form" class="space-y-6">
          <div id="questions-container">
            <!-- 質問が動的に挿入される -->
          </div>
          
          <button type="submit" class="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition">
            <i class="fas fa-paper-plane mr-2"></i>回答を送信
          </button>
        </form>
      </div>
    </div>
    
    <div id="no-questions" class="hidden text-center py-12">
      <div class="text-gray-400 text-5xl mb-4"><i class="fas fa-check-circle"></i></div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">質問はありません</h2>
      <p class="text-gray-600">現在、回答が必要な質問はありません。</p>
    </div>
    
    <div id="success" class="hidden text-center py-12">
      <div class="text-emerald-500 text-5xl mb-4"><i class="fas fa-check-circle"></i></div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">回答完了</h2>
      <p class="text-gray-600">ご回答ありがとうございます。<br>担当者が確認いたします。</p>
    </div>
    
    <script>
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (!code) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('error-message').textContent = 'アクセスコードが指定されていません。';
      } else {
        // リンク検証
        fetch('/api/portal/verify?code=' + code)
          .then(r => r.json())
          .then(data => {
            if (!data.success) {
              document.getElementById('loading').classList.add('hidden');
              document.getElementById('error').classList.remove('hidden');
              document.getElementById('error-message').textContent = data.error?.message || 'リンクが無効です。';
              return;
            }
            
            if (data.data.type !== 'chat') {
              document.getElementById('loading').classList.add('hidden');
              document.getElementById('error').classList.remove('hidden');
              document.getElementById('error-message').textContent = 'このリンクは質問回答用ではありません。';
              return;
            }
            
            // 質問を取得
            return fetch('/api/portal/questions?code=' + code);
          })
          .then(r => r?.json())
          .then(data => {
            document.getElementById('loading').classList.add('hidden');
            
            if (!data || !data.success) {
              document.getElementById('error').classList.remove('hidden');
              return;
            }
            
            if (data.data.questions.length === 0) {
              document.getElementById('no-questions').classList.remove('hidden');
              return;
            }
            
            document.getElementById('form-container').classList.remove('hidden');
            document.getElementById('subsidy-title').textContent = data.data.session?.subsidyTitle || '補助金申請';
            
            // 質問を表示
            const container = document.getElementById('questions-container');
            container.innerHTML = data.data.questions.map((q, i) => \`
              <div class="border rounded-lg p-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Q\${i + 1}. \${q.key} <span class="text-red-500">*</span>
                </label>
                <textarea name="\${q.key}" rows="3" required 
                  class="form-input w-full border rounded-lg px-3 py-2"
                  placeholder="回答を入力してください"></textarea>
              </div>
            \`).join('');
          })
          .catch(() => {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('error').classList.remove('hidden');
          });
      }
      
      // フォーム送信
      document.getElementById('answer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const answers = {};
        formData.forEach((value, key) => {
          if (value) answers[key] = value;
        });
        
        try {
          const res = await fetch('/api/portal/answer?code=' + code, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers }),
          });
          
          const data = await res.json();
          
          if (data.success) {
            document.getElementById('form-container').classList.add('hidden');
            document.getElementById('success').classList.remove('hidden');
          } else {
            alert('エラー: ' + (data.error?.message || '送信に失敗しました'));
          }
        } catch (err) {
          alert('通信エラーが発生しました。もう一度お試しください。');
        }
      });
    </script>
  `;
  
  return c.html(portalLayout('質問への回答', content));
});

export default portalPages;

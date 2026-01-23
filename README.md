# 補助金・助成金 自動マッチング＆申請書作成支援システム (ホジョラク)

## 📋 プロジェクト概要

- **Name**: subsidy-matching (hojyokin)
- **Version**: 1.4.8
- **Goal**: 企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング＆申請書ドラフト作成

### 最新アップデート (v1.4.8) - UI/UX改善 + JavaScript修正

**機能改善とバグフィックス:**

1. **JavaScript スコープ問題の修正**
   - `searchSubsidies` と `setSearchMode` をグローバルスコープに登録
   - HTML `onclick` 属性からの関数呼び出しを修正

2. **ナビゲーション順序の固定化**
   - ダッシュボード → 補助金を探す → 会社情報 の順序を固定
   - 現在のページのみ緑色（下線付き）で表示

3. **不要なポップアップの削除**
   - ダッシュボードからの遷移時のアラートを削除
   - 会社情報チェックは `/subsidies` ページ内で実施

4. **会社API修正**
   - `company_memberships` → `user_companies` テーブルに変更
   - ユーザーと会社の関連付けを正しく取得

### 設計思想

> **「補助金を"通す"ツール」ではなく「補助金で人生を壊させないツール」**

- 採択より完走
- 金額より安全
- 自動化より判断補助

---

## 🌐 URLs

### 本番環境 (Cloudflare Pages)

| ページ | URL | 説明 |
|--------|-----|------|
| トップ | https://hojyokin.pages.dev | ランディング |
| ログイン | https://hojyokin.pages.dev/login | 認証 |
| 新規登録 | https://hojyokin.pages.dev/register | アカウント作成 |
| ダッシュボード | https://hojyokin.pages.dev/dashboard | メイン画面 |
| 会社情報 | https://hojyokin.pages.dev/company | 企業プロフィール編集 |
| 補助金一覧 | https://hojyokin.pages.dev/subsidies | 補助金検索 |
| 補助金詳細 | https://hojyokin.pages.dev/subsidies/:id | 個別補助金情報 |
| 壁打ちチャット | https://hojyokin.pages.dev/chat?session_id=XXX | S3: 事前判定＋不足情報収集 |
| 申請書ドラフト | https://hojyokin.pages.dev/draft?session_id=XXX | S4: 申請書作成 |
| 管理画面 | https://hojyokin.pages.dev/admin | 管理者用 |
| **運用チェック** | **https://hojyokin.pages.dev/admin/ops** | **30分検証ダッシュボード（super_admin限定）** |

### 開発環境

- **GitHub**: https://github.com/matiuskuma2/hojyokin
- **Sandbox**: PM2 + wrangler pages dev (port 3000)

### Cron/Consumer Workers

- **Cron Worker**: https://hojyokin-cron.sekiyadubai.workers.dev
  - `/cron/run?limitRegistry=200&limitLifecycle=50` - 手動実行
- **Consumer Worker**: https://hojyokin-consumer.sekiyadubai.workers.dev
  - `/consumer/run?batch=10` - 手動実行
  - `/consumer/stats` - ステータス確認

---

## 🚀 新しい環境でのセットアップ手順

### 1. リポジトリのクローン

```bash
cd /home/user
git clone https://github.com/matiuskuma2/hojyokin.git webapp
cd webapp
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.dev.vars` ファイルを作成（本番は既に設定済み）:

```bash
cat > .dev.vars << 'EOF'
JWT_SECRET=your-secret-key-32-chars-minimum
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users
JGRANTS_MODE=cached-only
FIRECRAWL_API_KEY=fc-xxx
EOF
```

### 4. D1データベースの設定

**ローカル開発の場合:**

```bash
# マイグレーション適用
npx wrangler d1 migrations apply subsidy-matching-production --local

# シードデータ投入（必要に応じて）
npx wrangler d1 execute subsidy-matching-production --local --file=./seed.sql
```

**本番デプロイの場合:**

```bash
# マイグレーション適用
npx wrangler d1 migrations apply subsidy-matching-production

# データベースIDは wrangler.jsonc に記載:
# database_id: "e53f6185-60a6-45eb-b06d-c710ab3aef56"
```

### 5. ビルド

```bash
npm run build
```

### 6. ローカル開発サーバー起動

```bash
# PM2で起動（推奨）
pm2 start ecosystem.config.cjs

# ステータス確認
pm2 list

# ログ確認
pm2 logs webapp --nostream

# 停止
pm2 stop webapp
pm2 delete webapp
```

### 7. 本番デプロイ

```bash
# Cloudflare API Keyの設定（初回のみ）
# Deploy タブで API Key を設定してください

# デプロイ実行
npm run deploy

# または直接
npx wrangler pages deploy dist --project-name hojyokin
```

### 8. Cron/Consumer Workers のデプロイ

```bash
# Cron Worker
cd /home/user/hojyokin-cron
npm install
npx wrangler deploy

# Consumer Worker
cd /home/user/hojyokin-consumer
npm install
npx wrangler deploy
```

---

## 📊 データアーキテクチャ

### 主要テーブル

| テーブル | 説明 |
|----------|------|
| `users` | ユーザーアカウント |
| `companies` | 会社基本情報 |
| `user_companies` | ユーザー・会社関連付け |
| `company_profile` | 会社詳細プロフィール |
| `company_documents` | アップロード書類 |
| `subsidy_cache` | 補助金キャッシュ |
| `eligibility_rules` | 適格性判定ルール |
| `chat_sessions` | 壁打ちセッション |
| `chat_messages` | チャット履歴 |
| `chat_facts` | 収集済み事実 |
| `application_drafts` | 申請書ドラフト |
| `source_registry` | 47都道府県クロール台帳 |
| `crawl_queue` | Cronキュー |
| `domain_policy` | ドメインブロックポリシー |
| `usage_events` | 利用イベント（KPI集計用） |

### データベース接続情報

- **D1 Database**: subsidy-matching-production
- **Database ID**: e53f6185-60a6-45eb-b06d-c710ab3aef56
- **R2 Bucket**: subsidy-knowledge

---

## 🧪 動作確認

### テストユーザー

```bash
# スーパーアドミンユーザー
Email: matiuskuma2@gmail.com
User ID: 7e8ffc39-554e-4c28-ab89-9d3b9c0f68cd

# テストデータ
会社数: 15社（user_companies に関連付け済み）
- 株式会社エクスペリエンス
- デバッグ株式会社
- チャットテスト株式会社
など
```

### API テスト

```bash
# ヘルスチェック
curl http://localhost:3000/api/health

# ログイン
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"matiuskuma2@gmail.com","password":"your-password"}'

# 会社一覧取得
curl http://localhost:3000/api/companies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 運用監視

```bash
# Cron 手動実行
curl -s "https://hojyokin-cron.sekiyadubai.workers.dev/cron/run?limitRegistry=200&limitLifecycle=50"

# Consumer ステータス確認
curl -s "https://hojyokin-consumer.sekiyadubai.workers.dev/consumer/stats"

# キュー状態確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT status, COUNT(*) cnt FROM crawl_queue GROUP BY status;"
```

---

## 🔧 トラブルシューティング

### 会社が表示されない

**原因**: `user_companies` テーブルの関連付けが不足

**解決策**:

```bash
# ユーザーIDを確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT id, email FROM users WHERE email='your-email@example.com';"

# 会社IDを確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT id, name FROM companies LIMIT 10;"

# 関連付けを追加
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="INSERT INTO user_companies (id, user_id, company_id, created_at)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
       'YOUR_USER_ID',
       id,
       datetime('now')
FROM companies
WHERE id NOT IN (SELECT company_id FROM user_companies WHERE user_id='YOUR_USER_ID');"
```

### Consumer が動かない

**原因**: Firecrawl API の timeout パラメータが小さすぎる

**解決策**: hojyokin-consumer の `src/index.ts` で `timeout: timeoutMs` （ミリ秒）に修正済み

### ビルドエラー

**原因**: Node.js バージョンまたは依存関係の問題

**解決策**:

```bash
# Node.js バージョン確認（v18以上推奨）
node -v

# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install

# ビルド
npm run build
```

---

## 📝 開発ガイドライン

### コーディング規則

1. **API呼び出しは `window.api()` を使用**
   - 認証トークンは自動付与
   - エラーハンドリングは共通関数内で実施

2. **DOM操作は必ずnullチェック**
   ```javascript
   var el = document.getElementById('user-name');
   if (el) {
     el.textContent = user.name || '';
   }
   ```

3. **ES5互換性を維持**
   - `var` を使用（`let`/`const` は避ける）
   - アロー関数は使わず `function` を使用

4. **グローバル関数は `window` に登録**
   ```javascript
   window.searchSubsidies = async function(page = 1) {
     // ...
   };
   ```

### Git ワークフロー

```bash
# 変更をコミット
git add .
git commit -m "説明的なコミットメッセージ"

# GitHub にプッシュ
git push origin main

# デプロイ
npm run deploy
```

---

## 🗂️ プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx              # メインエントリーポイント
│   ├── routes/                # API ルート
│   │   ├── auth.ts            # 認証 API
│   │   ├── companies.ts       # 会社 API
│   │   ├── subsidies.ts       # 補助金 API
│   │   ├── chat.ts            # チャット API
│   │   ├── draft.ts           # ドラフト API
│   │   ├── agency.ts          # Agency API
│   │   └── admin-dashboard.ts # 管理 API
│   ├── pages/                 # UI ページ
│   │   ├── auth.tsx           # 認証ページ
│   │   ├── dashboard.tsx      # ダッシュボード
│   │   ├── company.tsx        # 会社情報
│   │   ├── subsidies.tsx      # 補助金検索
│   │   ├── chat.tsx           # 壁打ちチャット
│   │   ├── draft.tsx          # 申請書ドラフト
│   │   ├── agency.tsx         # Agency管理
│   │   └── admin.tsx          # 管理画面
│   ├── lib/                   # ライブラリ
│   │   ├── auth.ts            # 認証ヘルパー
│   │   ├── jgrants-adapter.ts # JGrants連携
│   │   └── usage-tracker.ts   # 利用イベント記録
│   └── types/                 # TypeScript型定義
├── public/                    # 静的ファイル
│   ├── static/                # CSS/JS
│   │   ├── app.js
│   │   └── styles.css
│   ├── favicon.png
│   ├── manifest.json          # PWA マニフェスト
│   └── sw.js                  # Service Worker
├── migrations/                # D1 マイグレーション
│   ├── 0001_initial_schema.sql
│   ├── 0002_eligibility_rules.sql
│   └── ...
├── ecosystem.config.cjs       # PM2 設定
├── wrangler.jsonc             # Cloudflare 設定
├── vite.config.ts             # Vite 設定
├── package.json               # 依存関係
└── README.md                  # このファイル
```

---

## 📈 実装済み機能

- [x] 認証 (JWT + PBKDF2)
- [x] 企業CRUD + プロフィール管理
- [x] 補助金検索（JGrants API連携）
- [x] 47都道府県クロール台帳
- [x] S3: 壁打ちチャット（事前判定 + 不足情報収集）
- [x] S4: 申請書ドラフト生成（テンプレート + NGチェック）
- [x] Agency機能（士業向け顧客管理）
- [x] 運用監視ダッシュボード（/admin/ops）
- [x] PWA対応（Service Worker + Manifest）
- [x] 書類アップロード（PDF.js抽出）

---

## 📋 次のステップ

### 優先度: 高

1. **会社選択ドロップダウンの表示確認**
   - API `/api/companies` のレスポンス確認
   - `user_companies` テーブルの関連付け確認

2. **Consumer の安定稼働**
   - Firecrawl タイムアウトの監視
   - ドメインブロックの適切な設定

3. **L2 実稼働の緑化**
   - 直近24時間の done/failed カウント増加
   - Prefecture の定期クロール確認

### 優先度: 中

1. **KPI 動作確認**
   - SUBSIDY_SEARCH イベントの記録
   - CHAT_SESSION_STARTED イベントの記録
   - DRAFT_GENERATED イベントの記録

2. **UI/UX 改善**
   - モバイル対応の強化
   - アクセシビリティ向上

---

## 📄 ライセンス

Private

---

## 🔄 更新履歴

- **2026-01-23 (v1.4.8)**: UI/UX改善: JavaScriptスコープ問題修正、ナビゲーション順序固定、不要なポップアップ削除、会社API修正
- **2026-01-22 (v1.4.7)**: JavaScriptスコープ問題の修正（searchSubsidies, setSearchMode をグローバル化）、ナビゲーション動的スタイル実装
- **2026-01-22 (v1.4.6)**: 会社API修正（company_memberships → user_companies）、会社選択ドロップダウンの表示修正
- **2026-01-22 (v1.4.5)**: 補助金検索ページのUI/UX改善（登録状況に応じた表示、api is not defined エラー修正）
- **2026-01-22 (v1.4.4)**: A-1台帳揃いの集計ロジック修正（registry_counts 追加）、進捗表示UI実装
- **2026-01-22 (v1.4.3)**: PWA対応完了、運用チェックダッシュボード追加
- **2026-01-22 (v1.4.2)**: 運用監視強化、usage_events記録強化
- **2026-01-22**: S3/S4実装完了、Agency機能追加、Superadmin KPI実装

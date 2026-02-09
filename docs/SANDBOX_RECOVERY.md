# サンドボックス復活手順 (SANDBOX_RECOVERY)

> **目的**: サンドボックスが消失した場合に、ゼロから完全に復活する手順を記録
> **最終更新**: 2026-02-09 (Phase 12.2)
> **前提**: GitHubリポジトリ https://github.com/matiuskuma2/hojyokin が存在すること

---

## 1. 復活に必要なもの

| 必要なもの | 取得元 | 備考 |
|-----------|--------|------|
| **ソースコード** | GitHub: `matiuskuma2/hojyokin` | mainブランチ |
| **本番DB** | Cloudflare D1: `subsidy-matching-production` | リモートにデータあり |
| **バックアップ** | Genspark: 最新アーカイブURL | tar.gz形式、約95MB |
| **Cloudflare APIキー** | Deploy tab → setup_cloudflare_api_key | 都度設定 |
| **GitHub認証** | setup_github_environment | 都度設定 |

### 1a. 最新バックアップURL
| 日付 | URL | サイズ | コミット |
|------|-----|--------|---------|
| 2026-02-09 | https://www.genspark.ai/api/files/s/MnjK5oGK | 95,196,994 bytes | 0e322f1 |
| 2026-02-09 (Phase12.1) | https://www.genspark.ai/api/files/s/CM8eHXmW | 95,179,389 bytes | d7cfac0 |

---

## 2. 復活手順（推奨: GitHubからクローン）

### ステップ1: GitHub認証設定
```bash
# Gensparkサンドボックスのsetup_github_environmentツールを呼び出す
# → git と gh の認証が自動設定される
```

### ステップ2: リポジトリクローン
```bash
cd /home/user
git clone https://github.com/matiuskuma2/hojyokin.git webapp
cd webapp
```

### ステップ3: 依存関係インストール
```bash
cd /home/user/webapp && npm install
# タイムアウト: 300秒以上に設定
```

### ステップ4: ビルド
```bash
cd /home/user/webapp && npm run build
# → dist/ ディレクトリが生成される
```

### ステップ5: PM2設定ファイル確認
```bash
# ecosystem.config.cjs が存在すること
cat /home/user/webapp/ecosystem.config.cjs
```

### ステップ6: ローカル起動
```bash
fuser -k 3000/tcp 2>/dev/null || true
cd /home/user/webapp && pm2 start ecosystem.config.cjs
# 2秒待機後に確認
sleep 2
curl http://localhost:3000/api/health
```

### ステップ7: Cloudflare API設定
```bash
# setup_cloudflare_api_keyツールを呼び出す
# → CLOUDFLARE_API_TOKEN が自動設定される
npx wrangler whoami  # 認証確認
```

### ステップ8: 本番デプロイ（必要な場合）
```bash
cd /home/user/webapp && npm run build
npx wrangler pages deploy dist --project-name hojyokin
```

---

## 3. 復活手順（代替: バックアップから復元）

### ステップ1: バックアップダウンロード
```bash
# GensparkのDownloadFileWrapperツールで最新バックアップをダウンロード
# URL: https://www.genspark.ai/api/files/s/MnjK5oGK
# → /home/user/ に tar.gz ファイルが保存される
```

### ステップ2: 解凍
```bash
cd /home/user
tar -xzf *.tar.gz
# → /home/user/webapp/ が復元される
```

### ステップ3: 依存関係再インストール
```bash
cd /home/user/webapp && rm -rf node_modules && npm install
```

### ステップ4: 以降はステップ4～8と同じ

---

## 4. 本番DB (D1) の確認・操作

### 4a. DB接続情報
| 項目 | 値 |
|------|-----|
| **データベース名** | `subsidy-matching-production` |
| **バインディング名** | `DB` |
| **テーブル数** | 約100テーブル |
| **主要データ量** | subsidy_cache: 22,258件 |

### 4b. DBクエリ実行方法
```bash
# Cloudflare APIキー設定後に実行
export CLOUDFLARE_API_KEY="..." 
export CLOUDFLARE_EMAIL="..."

# SELECTクエリ例
npx wrangler d1 execute subsidy-matching-production --remote --command="SELECT COUNT(*) FROM subsidy_cache"

# SQLファイル実行
npx wrangler d1 execute subsidy-matching-production --remote --file=./tools/update_xxx.sql

# ローカル実行（テスト用）
npx wrangler d1 execute subsidy-matching-production --local --command="SELECT * FROM users LIMIT 5"
```

### 4c. 主要テーブル確認クエリ
```sql
-- 全テーブル一覧
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- 定点観測サマリ
SELECT status, COUNT(*) AS cnt, 
       SUM(CASE WHEN koubo_pdf_url IS NOT NULL THEN 1 ELSE 0 END) AS with_pdf 
FROM koubo_monitors GROUP BY status;

-- crawl_log サマリ
SELECT result, COUNT(*) AS cnt FROM koubo_crawl_log GROUP BY result;

-- subsidy_cache件数
SELECT source, COUNT(*) FROM subsidy_cache GROUP BY source;
```

---

## 5. 主要ファイル配置

### 5a. ソースコード
```
src/
├── index.tsx              # Honoアプリエントリポイント（全ルート集約）
├── routes/                # APIルートハンドラ
│   ├── cron-koubo-*.ts    # 定点観測Cronジョブ
│   ├── admin-*.ts         # 管理者API
│   ├── search-*.ts        # 検索API
│   └── ...
├── lib/                   # 共通ライブラリ
│   ├── pdf/               # PDF処理
│   └── cost/              # コスト管理
├── pages/                 # フロントエンドページ
│   └── dashboard.tsx      # ダッシュボードHTML生成
└── types/                 # TypeScript型定義
```

### 5b. 設定ファイル
```
wrangler.jsonc             # Cloudflare設定（D1バインディング等）
ecosystem.config.cjs       # PM2設定（ローカル開発用）
package.json               # 依存関係＆スクリプト
tsconfig.json              # TypeScript設定
vite.config.ts             # Viteビルド設定
```

### 5c. データ・ツール
```
tools/
├── SSOT_koubo_pdf_management.md  # 公募PDF管理SSOT（最重要）
├── seed_*.sql                     # Phase別データ投入SQL
├── update_*.sql                   # データ更新SQL
└── *.md                           # 各種レポート

migrations/
├── 0001_initial_schema.sql        # 初期スキーマ
├── ...
└── 0101_fix_feed_schema_and_seed.sql  # 最新マイグレーション
```

---

## 6. Cloudflare Pages プロジェクト情報

| 項目 | 値 |
|------|-----|
| **プロジェクト名** | hojyokin |
| **本番URL** | https://hojyokin.pages.dev |
| **プロダクションブランチ** | main |
| **D1データベース** | subsidy-matching-production |
| **ビルド出力** | dist/ |
| **Workerサイズ** | 約1,668 kB |
| **モジュール数** | 250 |

---

## 7. 環境変数・シークレット

### 7a. ローカル開発（.dev.vars）
```
JWT_SECRET=<your-jwt-secret>
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users
INTERNAL_JWT_ISSUER=subsidy-app-internal
INTERNAL_JWT_AUDIENCE=subsidy-app-internal
JGRANTS_MODE=cached-only
SEARCH_BACKEND=ssot
```

### 7b. 本番シークレット（wrangler secret）
```bash
npx wrangler pages secret put JWT_SECRET --project-name hojyokin
npx wrangler pages secret put OPENAI_API_KEY --project-name hojyokin
# その他必要に応じて
```

---

## 8. 復活後の確認チェックリスト

- [ ] `curl http://localhost:3000/api/health` → status: ok
- [ ] `curl https://hojyokin.pages.dev/api/health` → status: ok
- [ ] `curl https://hojyokin.pages.dev/api/cron/koubo-dashboard` → stats表示
- [ ] https://hojyokin.pages.dev/monitor → モニターUI表示
- [ ] D1クエリ: `SELECT COUNT(*) FROM subsidy_cache` → 22,258
- [ ] D1クエリ: `SELECT status, COUNT(*) FROM koubo_monitors GROUP BY status` → active 463, url_lost 158, needs_manual 64
- [ ] git log --oneline -5 → 最新コミット確認
- [ ] pm2 list → subsidy-matching online

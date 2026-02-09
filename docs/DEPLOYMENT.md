# デプロイ手順 (DEPLOYMENT)

> **目的**: ビルド・デプロイ・環境設定の完全手順を記録
> **最終更新**: 2026-02-09 (Phase 12.2)
> **本番URL**: https://hojyokin.pages.dev

---

## 1. 技術スタック

| コンポーネント | 技術 | バージョン |
|-------------|------|-----------|
| **フレームワーク** | Hono | ^4.0.0 |
| **言語** | TypeScript | ^5.0.0 |
| **ビルドツール** | Vite | ^5.0.0 |
| **ホスティング** | Cloudflare Pages | - |
| **データベース** | Cloudflare D1 (SQLite) | - |
| **CLIツール** | Wrangler | ^3.78.0 |
| **プロセス管理** | PM2 | pre-installed |
| **認証** | jose (JWT) | - |

---

## 2. ローカル開発（サンドボックス）

### 2a. 初回セットアップ

```bash
# 1. リポジトリクローン
cd /home/user
git clone https://github.com/matiuskuma2/hojyokin.git webapp
cd webapp

# 2. 依存関係インストール（タイムアウト300秒以上）
npm install

# 3. ビルド
npm run build

# 4. PM2で起動
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 5. 動作確認
sleep 2
curl http://localhost:3000/api/health
```

### 2b. 日常の開発フロー

```bash
# コード変更後
cd /home/user/webapp && npm run build

# サービス再起動
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

# ログ確認（ノンブロッキング）
pm2 logs --nostream

# 動作確認
curl http://localhost:3000/api/health
curl http://localhost:3000/api/cron/koubo-dashboard
```

### 2c. ecosystem.config.cjs

```javascript
module.exports = {
  apps: [{
    name: 'subsidy-matching',
    script: 'npx',
    args: 'wrangler pages dev dist --d1=DB --local --ip 0.0.0.0 --port 3000',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    watch: false,
    instances: 1,
    exec_mode: 'fork'
  }]
}
```

---

## 3. 本番デプロイ（Cloudflare Pages）

### 3a. 前提条件

```bash
# 1. Cloudflare APIキー設定（必須）
# → setup_cloudflare_api_key ツールを呼び出す

# 2. 認証確認
npx wrangler whoami
```

### 3b. デプロイ手順

```bash
# 1. ビルド
cd /home/user/webapp && npm run build
# → dist/_worker.js (約1,668 kB), 250モジュール

# 2. デプロイ
npx wrangler pages deploy dist --project-name hojyokin
# → https://hojyokin.pages.dev にデプロイ

# 3. 確認
curl https://hojyokin.pages.dev/api/health
curl https://hojyokin.pages.dev/api/cron/koubo-dashboard
```

### 3c. ワンライナーデプロイ

```bash
cd /home/user/webapp && npm run build && npx wrangler pages deploy dist --project-name hojyokin
```

---

## 4. D1データベース操作

### 4a. 本番DBへのSQL実行

```bash
# Cloudflare API設定後
export CLOUDFLARE_API_KEY="..."
export CLOUDFLARE_EMAIL="..."

# SQLファイル実行
npx wrangler d1 execute subsidy-matching-production --remote --file=./tools/update_xxx.sql

# インラインクエリ
npx wrangler d1 execute subsidy-matching-production --remote --command="SELECT COUNT(*) FROM subsidy_cache"
```

### 4b. ローカルDB操作

```bash
# ローカルD1（テスト用）
npx wrangler d1 execute subsidy-matching-production --local --command="SELECT * FROM users LIMIT 5"

# ローカルDBリセット
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

### 4c. SQLバッチ実行の注意点

- **1バッチの上限**: 約80行程度（Wrangler制約）
- **大きいSQLの分割**: `head -80 file.sql > b1.sql` / `tail -n +81 file.sql > b2.sql`
- **CHECK制約エラー**: カラムの許可値を事前確認（特に crawl_type, result）
- **FOREIGN KEY**: subsidy_id は subsidy_cache.id に存在する必要あり

---

## 5. GitHub連携

### 5a. Git操作

```bash
# GitHub認証設定（必須）
# → setup_github_environment ツールを呼び出す

# コミット＆プッシュ
cd /home/user/webapp
git add -A
git commit -m "Phase X.Y: 概要 - 定量成果"
git push origin main
```

### 5b. コミットメッセージ規約

```
Phase N.X: <概要> - <定量成果>
feat: <機能追加の説明>
fix: <バグ修正の説明>
docs: <ドキュメント更新の説明>
perf: <パフォーマンス改善の説明>
```

---

## 6. バックアップ

### 6a. ProjectBackup（推奨）

```bash
# GensparkのProjectBackupツールを使用
# → tar.gz形式でblobストレージにアップロード
# → URLが返される（SANDBOX_RECOVERY.mdに記録）
```

### 6b. 手動バックアップ

```bash
cd /home/user
tar -czf webapp_backup_$(date +%Y%m%d).tar.gz webapp/
# → /mnt/aidrive/ にコピー（大量の小ファイルは避ける）
cp webapp_backup_*.tar.gz /mnt/aidrive/
```

---

## 7. wrangler.jsonc 設定

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "subsidy-matching",
  "compatibility_date": "2026-01-21",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "subsidy-matching-production",
      "database_id": "<production-database-id>"
    }
  ]
}
```

---

## 8. 公開URL一覧

| URL | 用途 |
|-----|------|
| https://hojyokin.pages.dev | 本番トップ |
| https://hojyokin.pages.dev/monitor | 定点観測モニターUI |
| https://hojyokin.pages.dev/api/health | ヘルスチェック |
| https://hojyokin.pages.dev/api/cron/koubo-dashboard | ダッシュボードデータ |
| https://hojyokin.pages.dev/api/cron/koubo-crawl?batch=20 | バッチクロール実行 |
| https://hojyokin.pages.dev/api/cron/koubo-check-period | 公募時期判定 |
| https://hojyokin.pages.dev/api/search/* | 補助金検索 |

---

## 9. トラブルシューティング

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| ビルドエラー | TypeScript型エラー | `npx tsc --noEmit` で確認 |
| デプロイ失敗 | API認証切れ | `setup_cloudflare_api_key` 再実行 |
| D1 SQLITE_ERROR | SQL構文エラー / CHECK制約違反 | `PRAGMA table_info(テーブル名)` で確認 |
| 404 on static files | public/ にファイルなし | `ls dist/` でビルド出力確認 |
| PM2起動しない | ポート3000が使用中 | `fuser -k 3000/tcp` → 再起動 |
| git push失敗 | 認証切れ | `setup_github_environment` 再実行 |
| Workerサイズ超過 | 10MB超 | 不要な依存関係を削除 |

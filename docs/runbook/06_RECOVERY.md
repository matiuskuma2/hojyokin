# 災害復旧手順書（Runbook）

## 概要

このドキュメントは、サンドボックスが消失した場合や、ゼロからシステムを再構築する場合の手順書です。
**このドキュメントだけで完全復元が可能** です。

---

## 前提条件

- Cloudflare アカウント（API Token所有）
- GitHub アカウント（リポジトリアクセス権）
- Node.js 18+
- npm / wrangler CLI

---

## 復元手順

### Step 1: ソースコード取得

```bash
git clone https://github.com/matiuskuma2/hojyokin.git
cd hojyokin
npm install
```

### Step 2: Cloudflare認証

```bash
npx wrangler login
# ブラウザで認証

# 確認
npx wrangler whoami
```

### Step 3: D1データベース作成

```bash
# 新規作成（既存がない場合）
npx wrangler d1 create subsidy-matching-production

# 出力されるdatabase_idをメモ
# → wrangler.jsonc の d1_databases.database_id に設定
```

### Step 4: マイグレーション適用

```bash
# 本番に適用
npx wrangler d1 migrations apply subsidy-matching-production --remote
```

### Step 5: R2バケット作成

```bash
# 新規作成（既存がない場合）
npx wrangler r2 bucket create subsidy-knowledge
```

### Step 6: wrangler.jsonc 更新

```jsonc
{
  "name": "hojyokin",
  "pages_build_output_dir": "dist",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "subsidy-matching-production",
      "database_id": "YOUR_NEW_DATABASE_ID"  // ← Step 3で取得したID
    }
  ],
  
  "r2_buckets": [
    {
      "binding": "R2_KNOWLEDGE",
      "bucket_name": "subsidy-knowledge"
    }
  ]
}
```

### Step 7: Pages プロジェクト作成

```bash
# プロジェクト作成
npx wrangler pages project create hojyokin --production-branch main

# Git連携は Cloudflare Dashboard から設定
# https://dash.cloudflare.com > Pages > hojyokin > Settings > Builds & deployments
```

### Step 8: シークレット設定

```bash
# 必須シークレット
npx wrangler pages secret put JWT_SECRET --project-name hojyokin
# → 32文字以上のランダム文字列を入力

npx wrangler pages secret put INTERNAL_JWT_SECRET --project-name hojyokin
# → AWS Lambdaと同じ値を入力（AWS連携する場合）

npx wrangler pages secret put FIRECRAWL_API_KEY --project-name hojyokin
# → Firecrawl APIキーを入力

# 確認
npx wrangler pages secret list --project-name hojyokin
```

### Step 9: ビルド＆デプロイ

```bash
# ビルド
npm run build

# デプロイ
npx wrangler pages deploy dist --project-name hojyokin
```

### Step 10: カスタムドメイン設定（オプション）

Cloudflare Dashboard から設定:
1. Pages > hojyokin > Custom domains
2. 「Set up a custom domain」
3. `hojyokintekiyou.com` を入力
4. DNS設定を確認

### Step 11: E2E確認

```bash
# ヘルスチェック
curl https://hojyokin.pages.dev/api/health

# ユーザー登録テスト
curl -X POST https://hojyokin.pages.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","name":"テスト"}'

# ログインテスト
curl -X POST https://hojyokin.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

---

## Cron Worker 復元（オプション）

```bash
cd workers/cron

# wrangler.toml のdatabase_idを更新

# デプロイ
npx wrangler deploy
```

---

## データ復元（バックアップがある場合）

```bash
# バックアップファイルからインポート
npx wrangler d1 execute subsidy-matching-production --remote --file backup.sql
```

---

## チェックリスト

### 必須確認項目

- [ ] `https://hojyokin.pages.dev` にアクセス可能
- [ ] `/api/health` が 200 を返す
- [ ] ユーザー登録が成功する
- [ ] ログインが成功する
- [ ] 会社作成が成功する
- [ ] `/subsidies` ページが表示される
- [ ] `/chat` が動作する
- [ ] `/draft` が動作する

### オプション確認項目

- [ ] カスタムドメイン `hojyokintekiyou.com` が有効
- [ ] Cron Worker が動作（翌日03:00 JSTに確認）
- [ ] AWS連携が動作（Phase 2）

---

## 重要リソースID一覧

| リソース | ID/名前 |
|----------|---------|
| Cloudflare Account ID | `dd957a4b35780cdb5d2c8d0b021684c2` |
| D1 Database ID | `e53f6185-60a6-45eb-b06d-c710ab3aef56` |
| R2 Bucket | `subsidy-knowledge` |
| Pages Project | `hojyokin` |
| GitHub Repo | `matiuskuma2/hojyokin` |

---

## トラブルシューティング

### デプロイ失敗

```bash
# ビルドエラー確認
npm run build

# TypeScriptエラー
npx tsc --noEmit
```

### D1接続エラー

```bash
# database_id確認
npx wrangler d1 list

# 接続テスト
npx wrangler d1 execute subsidy-matching-production --remote --command "SELECT 1"
```

### シークレット未設定エラー

```bash
# 設定済みシークレット確認
npx wrangler pages secret list --project-name hojyokin

# 再設定
npx wrangler pages secret put SECRET_NAME --project-name hojyokin
```

---

## 連絡先・エスカレーション

- GitHub Issues: https://github.com/matiuskuma2/hojyokin/issues
- Cloudflare Status: https://www.cloudflarestatus.com/

# シークレットとバインディング

## 概要

本システムは複数のシークレットとバインディングを使用しています。
**特に INTERNAL_JWT_SECRET は AWS と Cloudflare で一致が必須** です。

---

## 1. Cloudflare Pages (hojyokin)

### バインディング

| タイプ | Binding名 | リソース名/ID |
|--------|-----------|---------------|
| D1 | `DB` | subsidy-matching-production (`e53f6185-60a6-45eb-b06d-c710ab3aef56`) |
| R2 | `R2_KNOWLEDGE` | subsidy-knowledge |

### 環境変数 (vars)

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `ENVIRONMENT` | 環境識別 | `production` / `development` |
| `JGRANTS_MODE` | Jグランツモード | `live` / `mock` / `cached-only` |
| `JWT_ISSUER` | JWT発行者 | `subsidy-app` |
| `JWT_AUDIENCE` | JWTオーディエンス | `subsidy-app-users` |
| `INTERNAL_JWT_ISSUER` | 内部JWT発行者 | `subsidy-app-internal` |
| `INTERNAL_JWT_AUDIENCE` | 内部JWTオーディエンス | `subsidy-app-internal` |

### シークレット (secrets)

| 変数名 | 説明 | 設定方法 |
|--------|------|----------|
| `JWT_SECRET` | ユーザー認証用JWT秘密鍵 | `wrangler pages secret put JWT_SECRET` |
| `INTERNAL_JWT_SECRET` | 内部API用JWT秘密鍵 ⚠️ **AWS と一致必須** | `wrangler pages secret put INTERNAL_JWT_SECRET` |
| `FIRECRAWL_API_KEY` | Firecrawl APIキー | `wrangler pages secret put FIRECRAWL_API_KEY` |
| `AWS_JOB_API_BASE_URL` | AWS API GatewayのURL | `wrangler pages secret put AWS_JOB_API_BASE_URL` |

### シークレット設定コマンド

```bash
# Pages用
npx wrangler pages secret put JWT_SECRET --project-name hojyokin
npx wrangler pages secret put INTERNAL_JWT_SECRET --project-name hojyokin
npx wrangler pages secret put FIRECRAWL_API_KEY --project-name hojyokin

# シークレット一覧確認
npx wrangler pages secret list --project-name hojyokin
```

---

## 2. Cron Worker (hojyokin-cron)

### バインディング

| タイプ | Binding名 | リソース名 |
|--------|-----------|------------|
| D1 | `DB` | subsidy-matching-production |

### 設定 (wrangler.toml)

```toml
name = "hojyokin-cron"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["0 18 * * *"]  # UTC 18:00 = JST 03:00

[[d1_databases]]
binding = "DB"
database_name = "subsidy-matching-production"
database_id = "e53f6185-60a6-45eb-b06d-c710ab3aef56"
```

---

## 3. AWS Lambda

### 環境変数

| 変数名 | 説明 | 備考 |
|--------|------|------|
| `INTERNAL_JWT_SECRET` | 内部API用JWT秘密鍵 | ⚠️ **Cloudflare と一致必須** |
| `CLOUDFLARE_API_BASE_URL` | Cloudflare PagesのURL | `https://hojyokin.pages.dev` |
| `SQS_QUEUE_URL` | SQSキューURL | |
| `S3_BUCKET` | S3バケット名 | |

---

## 4. 一致が必須の値

### INTERNAL_JWT_SECRET

```
⚠️ 重要: この値は AWS Lambda と Cloudflare Pages で完全に一致している必要があります。
不一致の場合、内部API通信が 401 Unauthorized で失敗します。
```

| 場所 | 設定方法 |
|------|----------|
| Cloudflare Pages | `wrangler pages secret put INTERNAL_JWT_SECRET` |
| AWS Lambda | AWS Console > Lambda > 環境変数 |

### 同期チェック

1. Cloudflare側: `/api/internal/health` が 200 を返すか
2. AWS側: Lambda の内部JWT生成 → Cloudflare呼び出しが成功するか

---

## 5. ローカル開発用 (.dev.vars)

```bash
# アプリ用JWT
JWT_SECRET=dev-secret-key-32-chars-minimum-length-here
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users

# 内部API用JWT（AWS連携テスト時はAWSと同じ値）
INTERNAL_JWT_SECRET=your-internal-secret-here
INTERNAL_JWT_ISSUER=subsidy-app-internal
INTERNAL_JWT_AUDIENCE=subsidy-app-internal

# AWS連携
AWS_JOB_API_BASE_URL=https://your-api-gateway.execute-api.region.amazonaws.com

# Jグランツモード
JGRANTS_MODE=mock

# 環境
ENVIRONMENT=development

# Firecrawl
FIRECRAWL_API_KEY=fc-xxx
```

**注意**: `.dev.vars` は Git にコミットしない（`.gitignore` に含める）

---

## 6. シークレットローテーション手順

### JWT_SECRET のローテーション

1. 新しいシークレット値を生成
   ```bash
   openssl rand -base64 32
   ```

2. Cloudflare Pages に設定
   ```bash
   npx wrangler pages secret put JWT_SECRET --project-name hojyokin
   ```

3. 既存セッションは自動的に無効化される（再ログイン必要）

### INTERNAL_JWT_SECRET のローテーション

1. 新しいシークレット値を生成
2. **同時に** Cloudflare と AWS の両方を更新
   ```bash
   # Cloudflare
   npx wrangler pages secret put INTERNAL_JWT_SECRET --project-name hojyokin
   
   # AWS
   # AWS Console > Lambda > 環境変数 で更新
   ```
3. 両方のデプロイが完了するまで一時的に内部API通信が失敗する可能性あり

---

## 7. トラブルシューティング

### 401 Unauthorized (内部API)

1. `INTERNAL_JWT_SECRET` が AWS と Cloudflare で一致しているか確認
2. `INTERNAL_JWT_ISSUER` / `INTERNAL_JWT_AUDIENCE` が一致しているか確認
3. トークンの有効期限が切れていないか確認

### D1 接続エラー

1. `database_id` が正しいか確認
2. Binding名 (`DB`) が一致しているか確認
3. `wrangler.jsonc` / `wrangler.toml` の設定確認

### R2 接続エラー

1. Bucket名が存在するか確認
2. Binding名 (`R2_KNOWLEDGE`) が一致しているか確認

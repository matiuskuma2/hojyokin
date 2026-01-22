# デプロイメント手順

## 1. Cloudflare Pages (hojyokin)

### プロジェクト情報

| 項目 | 値 |
|------|-----|
| プロジェクト名 | hojyokin |
| デフォルトURL | https://hojyokin.pages.dev |
| Git連携 | GitHub (matiuskuma2/hojyokin) |
| 本番ブランチ | main |

### デプロイ方法

#### 方法1: Git Push（推奨）

```bash
git add .
git commit -m "feat: your changes"
git push origin main
# → 自動でCloudflare Pagesにデプロイされる
```

#### 方法2: Wrangler CLI（手動）

```bash
# ビルド
npm run build

# デプロイ
npx wrangler pages deploy dist --project-name hojyokin
```

### バインディング

| タイプ | Binding名 | リソース名 |
|--------|-----------|------------|
| D1 | DB | subsidy-matching-production (e53f6185-60a6-45eb-b06d-c710ab3aef56) |
| R2 | R2_KNOWLEDGE | subsidy-knowledge |

---

## 2. Cron Worker (hojyokin-cron)

### 用途

- 毎日03:00 JST に `source_registry` から due なエントリを抽出
- `crawl_queue` に投入

### デプロイ

```bash
cd workers/cron
npx wrangler deploy
```

### スケジュール設定

```toml
# wrangler.toml
[triggers]
crons = ["0 18 * * *"]  # UTC 18:00 = JST 03:00
```

### バインディング

| タイプ | Binding名 | リソース名 |
|--------|-----------|------------|
| D1 | DB | subsidy-matching-production |

---

## 3. Consumer Worker (オプション)

Consumer は Pages 内の `/api/consumer/*` で動作するため、別途 Worker のデプロイは不要。

外部から呼び出す場合:
```bash
curl -X POST https://hojyokin.pages.dev/api/consumer/run \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

---

## 4. ローカル開発

### 初回セットアップ

```bash
# クローン
git clone https://github.com/matiuskuma2/hojyokin.git
cd hojyokin

# 依存関係インストール
npm install

# 環境変数設定
cp .dev.vars.example .dev.vars
# → .dev.vars を編集

# D1マイグレーション（ローカル）
npx wrangler d1 migrations apply subsidy-matching-production --local
```

### 開発サーバー起動

```bash
# ビルド
npm run build

# PM2で起動
pm2 start ecosystem.config.cjs

# または直接起動
npx wrangler pages dev dist --d1=subsidy-matching-production --local --ip 0.0.0.0 --port 3000
```

### 確認

```bash
curl http://localhost:3000/api/health
```

---

## 5. 本番マイグレーション

### 新規マイグレーション追加

1. `migrations/` に新規SQLファイル作成
   ```
   migrations/0017_your_migration.sql
   ```

2. ローカルテスト
   ```bash
   npx wrangler d1 migrations apply subsidy-matching-production --local
   ```

3. 本番適用
   ```bash
   npx wrangler d1 migrations apply subsidy-matching-production --remote
   ```

### 注意事項

- **手打ちSQL禁止**: 必ず migrations/ ファイル経由
- **ロールバック不可**: D1はロールバックをサポートしていない
- **事前バックアップ**: 重要な変更前は `wrangler d1 export` でバックアップ

---

## 6. デプロイ前チェックリスト

- [ ] `npm run build` が成功する
- [ ] ローカルで E2E テストが通る
- [ ] 新規マイグレーションがある場合、本番適用済み
- [ ] Secrets に変更がある場合、本番に反映済み
- [ ] `git status` でコミット漏れがない

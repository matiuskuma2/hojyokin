# hojyokin-queue-cron

extraction_queue を5分ごとに消化する Workers Cron。

## 設計

- 5分ごとに1つの shard を消化（16 shard を80分で一周）
- 毎日 00:00 UTC に enqueue も実行（1日1回）
- consume/enqueue は Pages の API を叩くだけなので軽量

## セットアップ

```bash
cd workers/queue-cron

# 依存関係インストール
npm install

# シークレット設定（Pages の CRON_SECRET と同じ値）
npx wrangler secret put CRON_SECRET

# デプロイ
npx wrangler deploy
```

## 手動実行

```bash
# 現在の shard 確認
curl https://hojyokin-queue-cron.<account>.workers.dev/status

# 特定 shard を手動消化
curl https://hojyokin-queue-cron.<account>.workers.dev/trigger?shard=7

# enqueue 実行
curl https://hojyokin-queue-cron.<account>.workers.dev/enqueue
```

## ログ確認

```bash
npx wrangler tail
```

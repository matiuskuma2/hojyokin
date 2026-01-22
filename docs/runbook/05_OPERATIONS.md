# 運用マニュアル

## 1. KPI監視

### エンドポイント

```bash
# KPIサマリ
curl https://hojyokin.pages.dev/api/kpi/summary \
  -H "Authorization: Bearer $JWT"

# クロール統計
curl https://hojyokin.pages.dev/api/kpi/crawl \
  -H "Authorization: Bearer $JWT"

# パイプライン統計
curl https://hojyokin.pages.dev/api/kpi/pipeline \
  -H "Authorization: Bearer $JWT"
```

### 主要指標

| 指標 | 正常値 | 警告閾値 |
|------|--------|----------|
| `queue_pending` | < 100 | > 500 |
| `queue_failed` | 0 | > 10 |
| `crawl_success_rate` | > 90% | < 70% |
| `domain_blocked_count` | - | 増加傾向 |

---

## 2. domain_policy 管理

### blocked の確認

```bash
# ブロック中ドメイン一覧
curl https://hojyokin.pages.dev/api/admin/domain-policy?status=blocked \
  -H "Authorization: Bearer $JWT"
```

### unblock（手動解除）

```bash
curl -X PUT https://hojyokin.pages.dev/api/admin/domain-policy/example.com \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "blocked_reason": null}'
```

### 自動ブロックルール

| 条件 | アクション |
|------|----------|
| 連続5回失敗 | 自動ブロック |
| 403/429/503 | バックオフ（指数関数的） |
| robots.txt 拒否 | ブロック |

---

## 3. Consumer（キュー処理）

### 手動実行

```bash
# 10件処理
curl -X POST https://hojyokin.pages.dev/api/consumer/run \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### キュー状態確認

```bash
curl https://hojyokin.pages.dev/api/consumer/status \
  -H "Authorization: Bearer $JWT"
```

### 失敗ジョブの再キュー

```bash
curl -X POST https://hojyokin.pages.dev/api/consumer/requeue/JOB_ID \
  -H "Authorization: Bearer $JWT"
```

### 古いジョブのクリーンアップ

```bash
# 30日以上前の完了ジョブを削除
curl -X DELETE https://hojyokin.pages.dev/api/consumer/cleanup?days=30 \
  -H "Authorization: Bearer $JWT"
```

---

## 4. Cron Worker

### 動作確認

Cloudflare Dashboard > Workers & Pages > hojyokin-cron > Logs

### 手動トリガー（デバッグ用）

```bash
curl -X POST https://hojyokin-cron.YOUR_SUBDOMAIN.workers.dev/trigger \
  -H "Authorization: Bearer $JWT"
```

### スケジュール変更

`workers/cron/wrangler.toml` を編集:
```toml
[triggers]
crons = ["0 18 * * *"]  # UTC時刻
```

再デプロイ:
```bash
cd workers/cron && npx wrangler deploy
```

---

## 5. 事故対応フロー

### Step 1: 状況把握

```bash
# 1. KPI確認
curl https://hojyokin.pages.dev/api/kpi/summary -H "Authorization: Bearer $JWT"

# 2. キュー状態
curl https://hojyokin.pages.dev/api/consumer/status -H "Authorization: Bearer $JWT"

# 3. ブロックドメイン
curl https://hojyokin.pages.dev/api/admin/domain-policy?status=blocked -H "Authorization: Bearer $JWT"
```

### Step 2: 原因特定

| 症状 | 原因可能性 | 対処 |
|------|-----------|------|
| 全クロール失敗 | Firecrawl API障害 | API状態確認、一時停止 |
| 特定ドメインのみ失敗 | robots.txt変更/IP制限 | ドメインブロック |
| キュー詰まり | Consumer停止 | 手動実行/再起動 |
| 認証エラー多発 | JWT期限切れ | シークレット確認 |

### Step 3: 復旧アクション

```bash
# Consumer 手動実行
curl -X POST https://hojyokin.pages.dev/api/consumer/run \
  -H "Authorization: Bearer $JWT" \
  -d '{"limit": 50}'

# 問題ドメインをブロック
curl -X PUT https://hojyokin.pages.dev/api/admin/domain-policy/problem.example.com \
  -H "Authorization: Bearer $JWT" \
  -d '{"status": "blocked", "blocked_reason": "manual_block"}'

# 失敗ジョブをクリア
curl -X DELETE https://hojyokin.pages.dev/api/consumer/cleanup?days=0&status=failed \
  -H "Authorization: Bearer $JWT"
```

---

## 6. 監査ログ

### ログ取得

```bash
curl https://hojyokin.pages.dev/api/admin/audit \
  -H "Authorization: Bearer $JWT"
```

### 記録される操作

- ユーザー登録/ログイン
- 会社作成/更新
- 申請書作成/確定
- 管理者操作

---

## 7. 定期メンテナンス

### 日次

- [ ] KPIサマリ確認
- [ ] ブロックドメイン増加チェック
- [ ] キュー詰まりチェック

### 週次

- [ ] 失敗ジョブのレビュー
- [ ] domain_policy の見直し
- [ ] 監査ログレビュー

### 月次

- [ ] 古いキューデータのクリーンアップ
- [ ] D1容量確認
- [ ] R2容量確認
- [ ] シークレットローテーション検討

---

## 8. アラート設定（推奨）

### Cloudflare Workers Analytics

- エラー率 > 5% でアラート
- レイテンシ p99 > 10s でアラート

### 外部監視（Uptime Robot等）

- `https://hojyokin.pages.dev/api/health` を5分間隔で監視
- 3回連続失敗でアラート

### カスタムアラート（alert_log テーブル）

```sql
-- 直近24時間の重大アラート
SELECT * FROM alert_log 
WHERE severity = 'critical' 
AND created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC;
```

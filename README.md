# 補助金・助成金 自動マッチング＆申請書作成支援システム

## プロジェクト概要

- **Name**: subsidy-matching (hojyokin)
- **Version**: 1.2.0 (Phase K2 Cron + Consumer 実装完了)
- **Goal**: 企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング

### 設計思想

> **「補助金を"通す"ツール」ではなく「補助金で人生を壊させないツール」**

- 採択より完走
- 金額より安全
- 自動化より判断補助

## URLs

- **本番 (Cloudflare Pages)**: https://hojyokin.pages.dev
- **GitHub**: https://github.com/matiuskuma2/hojyokin
- **Sandbox (開発)**: PM2 + wrangler pages dev (port 3000)

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare (Phase K2)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Pages (hojyokin)                                          │  │
│  │ - 認証 (JWT + PBKDF2)                                     │  │
│  │ - 企業CRUD                                                │  │
│  │ - 補助金検索 (JGrants API)                                │  │
│  │ - ナレッジパイプライン (K1/K2)                            │  │
│  │ - Consumer (crawl_queue処理)                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Cron Worker (hojyokin-cron)                              │  │
│  │ - scheduled: 毎日03:00 JST                                │  │
│  │ - due抽出 → crawl_queue投入                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │     D1      │ │     R2      │ │   Firecrawl │              │
│  │ (SQLite)    │ │ (knowledge) │ │   (Scrape)  │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼ (重処理のみ)
┌─────────────────────────────────────────────────────────────────┐
│                      AWS (Phase 2)                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐        │
│  │ API Gateway │───▶│ Lambda       │───▶│ SQS         │        │
│  │ (HTTP API)  │    │ (job-submit) │    │ (jobs)      │        │
│  └─────────────┘    └──────────────┘    └──────┬──────┘        │
│                              │                  │               │
│                              ▼                  ▼               │
│                     ┌──────────────┐    ┌──────────────┐        │
│                     │ S3           │◀───│ Lambda       │───▶ LLM│
│                     │ (attachments)│    │ (worker)     │        │
│                     └──────────────┘    └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase K2: ナレッジパイプライン (実装完了) ✅

### データ取得設計（API × Crawl の役割分担）

| 役割 | API (jGrants) | Crawl (Firecrawl) |
|------|---------------|-------------------|
| 目的 | 制度の存在と概要 | 申請に勝つための実務情報 |
| データ | title, summary, prefecture, max_amount, rate, deadlines | 公募要領PDF, Q&A, 記載例, 審査ポイント |
| 限界 | 必要書類不完全、審査ポイント無し | - |

### 主要テーブル

| テーブル | 説明 |
|----------|------|
| `source_registry` | 47都道府県クロール台帳 |
| `crawl_queue` | Cron専用キュー（kind: REGISTRY_CRAWL/SUBSIDY_CHECK/URL_CRAWL） |
| `subsidy_lifecycle` | 制度のライフサイクル管理 (status/next_check_at) |
| `domain_policy` | ドメイン単位のクロールポリシー |
| `doc_object` | R2保存ドキュメント索引 |

### Consumer API Endpoints

| Endpoint | Method | 説明 |
|----------|--------|------|
| `/api/consumer/run` | POST | キューからジョブを取得して処理 |
| `/api/consumer/status` | GET | キュー状態の確認 |
| `/api/consumer/requeue/:id` | POST | 失敗ジョブの再キュー |
| `/api/consumer/cleanup` | DELETE | 古いジョブの削除 |

### ナレッジ API Endpoints (K1/K2)

| Endpoint | Method | 説明 |
|----------|--------|------|
| `/api/knowledge/crawl/:urlId` | POST | URL単体クロール (K1) |
| `/api/knowledge/extract/:urlId` | POST | Extract Schema v1 抽出 (K2) |
| `/api/knowledge/registry` | GET | source_registry一覧 |
| `/api/knowledge/stats` | GET | ナレッジ統計 |

### ステータス正規化 (subsidy_lifecycle)

| status | 説明 | 更新頻度 |
|--------|------|----------|
| `scheduled` | 公募前 | 毎日 |
| `open` | 受付中 | priority依存 |
| `closing_soon` | まもなく締切 | 1時間 |
| `closed_by_deadline` | 期限終了 | 30日 |
| `closed_by_budget` | 予算枯渇 | 30日 |

### 予算枯渇シグナル (budget_close_signals)

| signal | 検知パターン |
|--------|-------------|
| `budget_cap_reached` | 予算上限に達し次第...終了 |
| `first_come_end` | 先着順 |
| `quota_reached` | 予定件数に達し |
| `early_close` | 早期終了の可能性 |

---

## 実装済み機能 ✅

### Phase 1-A (Cloudflare基盤)
- [x] 認証 (JWT + PBKDF2)
- [x] 企業CRUD
- [x] JGrants Adapter (live/mock/cached-only)
- [x] 一次スクリーニング
- [x] D1キャッシュ

### Phase K1 (ナレッジ収集)
- [x] Firecrawl scrape → R2 raw保存
- [x] source_url管理
- [x] content_hash差分検知

### Phase K2 (差分更新)
- [x] Extract Schema v1 (Firecrawl v2 API)
- [x] 47都道府県台帳 (source_registry)
- [x] Cron Worker (due抽出 → crawl_queue投入)
- [x] Consumer (crawl_queue処理)
- [x] domain_policy (自動ブロック)

---

## 開発環境セットアップ

```bash
# 依存関係インストール
cd /home/user/webapp
npm install

# D1マイグレーション (ローカル)
npx wrangler d1 migrations apply subsidy-matching-production --local

# 開発サーバー起動
npm run build
pm2 start ecosystem.config.cjs

# API テスト
curl http://localhost:3000/api/health
curl http://localhost:3000/api/consumer/status -H "Authorization: Bearer $JWT"
```

### Consumer テスト

```bash
# ログインしてJWT取得
JWT=$(curl -s http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' | jq -r '.data.token')

# Consumer実行
curl -X POST http://localhost:3000/api/consumer/run \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

---

## 環境変数

### Cloudflare (.dev.vars)
```
JWT_SECRET=your-secret-key-32-chars-minimum
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users
JGRANTS_MODE=mock
FIRECRAWL_API_KEY=fc-xxx
```

### Cron Worker (.dev.vars)
```
# D1は wrangler.toml で設定
```

---

## 進捗状況

### ✅ 完了
- Phase 1-A: Cloudflare基盤
- Phase K1: ナレッジ収集
- Phase K2: Cron + Consumer実装
- 47都道府県台帳投入
- Extract Schema v1

### 📋 次のステップ
1. Cron Worker本番デプロイ
2. Extract品質改善 (confidence > 0.8)
3. 申請書自動生成への接続

### ⏳ 未着手
- UI実装
- 壁打ちBot
- 自治体サイトスクレイピング拡張

---

## ライセンス

Private

## 更新履歴

- **2026-01-21**: Phase K2 Cron + Consumer実装完了
- **2026-01-21**: 47都道府県台帳投入
- **2026-01-21**: Extract Schema v1実装
- **2026-01-21**: Phase 1-A完了、Phase 2 AWS設計完了

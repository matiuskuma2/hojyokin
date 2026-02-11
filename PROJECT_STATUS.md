# プロジェクト状態サマリー (2026-02-11)

## 📦 現在のバージョン

**Version**: 4.6.0 (Phase 22)

## ✅ 保存済み内容

### Git コミット履歴（主要マイルストーン）
- ✅ v4.6.0: Phase 22 — E2Eフロー検証・BUG修正3件・設計分析
- ✅ v4.5.0: Freeze-MATCH Gate + 壁打ち機能改善 + ものづくり22次
- ✅ v4.4.0: Phase A-3 完了 - 他API追随 + SSOT統一
- ✅ v4.3.0: NormalizedSubsidyDetail v1.0 Freeze + Phase A-1/A-2完了
- ✅ v4.2.0: Ready率52%達成 + Cron完全自動化 + fallback v2
- ✅ v4.1.0: Cron自動化 + apply-field-fallbacks
- ✅ v4.0.0: jGrants V2 + OpenAI PDF抽出 + Cron統合
- ✅ v3.4.0: APIコスト会計凍結
- ✅ v3.3.0: Workers Cron + 検索キャッシュ + 実処理稼働
- ✅ v3.2.0: Shard/Queue化 + 電子申請対応 + Cooldownガード
- ✅ GitHub にプッシュ済み: https://github.com/matiuskuma2/hojyokin

### デプロイ状態
- ✅ Cloudflare Pages: https://hojyokin.pages.dev
- ✅ Cron Worker: https://hojyokin-cron.sekiyadubai.workers.dev
- ✅ Consumer Worker: https://hojyokin-consumer.sekiyadubai.workers.dev
- ✅ Feed Cron Worker: hojyokin-cron-feed
- ✅ Queue Cron Worker: hojyokin-queue-cron

### データベース
- ✅ D1 Database: subsidy-matching-production
- ✅ Database ID: e53f6185-60a6-45eb-b06d-c710ab3aef56
- ✅ マイグレーション: 22+個適用済み
- ✅ dev_schema.sql: 本番同期済み（95テーブル、2026-02-07更新）

## 🔄 新しい環境で再開する手順

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

### 3. ビルド
```bash
npm run build
```

### 4. 開発サーバー起動
```bash
pm2 start ecosystem.config.cjs
```

### 5. 動作確認
```bash
# ヘルスチェック
curl http://localhost:3000/api/health

# ブラウザでアクセス
# http://localhost:3000
```

### 6. 本番デプロイ
```bash
npm run deploy
```

## 📊 現在の状態

### 実装済み機能
- [x] 認証システム（JWT + セッション管理）
- [x] 会社情報管理（SSOT: CompanySSOT）
- [x] 補助金検索（JGrants V2 アダプター + v2 スクリーニング）
- [x] NormalizedSubsidyDetail（SSOT補助金データモデル）
- [x] 壁打ちチャット（S3）- input_type パターンマッチ推測
- [x] 申請書ドラフト（S4）
- [x] 運用監視ダッシュボード（/admin/ops）
- [x] 士業ダッシュボード（Agency System）
- [x] PWA対応
- [x] Cron自動パイプライン（registry/lifecycle/ready-boost）
- [x] PDF抽出パイプライン（OpenAI Vision）
- [x] APIコスト会計（api_cost_logs）
- [x] Freeze-MATCH Gate（v2スクリーニング統一 + canonical_id厳格化）
- [x] 差分抽出エンドポイント（P4-3: extract-diff）

### Freeze仕様（凍結済み）
| 仕様ID | 内容 |
|--------|------|
| Freeze-MATCH-0 | マッチング入力は (CompanySSOT, NormalizedSubsidyDetail) のみ |
| Freeze-MATCH-1 | evaluation_runs.subsidy_id は常に canonical_id |
| Freeze-MATCH-2 | screening 結果に missing_fields を追加 |
| Freeze-Company-SSOT-1 | chat_facts 集約: 最新優先、同一キーは初出採用、補助金固有が優先 |
| Freeze-WALLCHAT-1 | 質問文から input_type をパターンマッチ推測 |
| Freeze-WALLCHAT-2 | フォールバック質問を多様化 |
| Freeze-WALLCHAT-3 | input_type に応じた適切な回答ガイドを表示 |
| Freeze-GET-1 | snapshotRow.detail_json 優先読み取り |

## 🏗️ Workers Cron アーキテクチャ

### Workers 一覧（4本）
| Worker 名 | パス | 役割 | スケジュール (UTC) |
|-----------|------|------|-------------------|
| **hojyokin-cron** | `workers/cron/` | メインパイプライン（registry同期 + lifecycle + ready-boost） | `0 18 * * *` (JST 03:00), `0 20 * * *` (JST 05:00) |
| **hojyokin-cron-feed** | `workers/cron-feed/` | NEWSフィード取得（Pages APIへ委譲） | `0 21 * * *` (JST 06:00) |
| **hojyokin-queue-cron** | `workers/queue-cron/` | キュー消化（crawl_queue + extraction_queue） | `*/5 * * * *` (5分毎) |
| **hojyokin-consumer** | `workers/consumer/` | crawl_queue 処理（実クロール実行） | `*/5 * * * *` (5分毎) |

### 責務分離
- **hojyokin-cron**: 制度データの収集・更新サイクル全体を管理。JGrants registry 同期、lifecycle 管理、ready-boost によるフォールバック生成を担当。D1直接接続。
- **hojyokin-cron-feed**: NEWSソースからの最新情報フィード取得。Pages API (`/api/cron/*`) を HTTP 呼び出しで実行。CRON_SECRET 認証。
- **hojyokin-queue-cron**: D1の `crawl_queue` と `extraction_queue` のペンディングジョブをバッチ消化。Pages APIへ委譲。
- **hojyokin-consumer**: `crawl_queue` の実際のクロール処理を実行。URL取得→HTML解析→結果保存。D1 + R2 接続。

### Pages側 Cron API（src/routes/cron.ts）
27エンドポイント（7,643行）。主要:
- `/sync-jgrants` - JGrants registry同期
- `/scrape-tokyo-*` - 東京都ソーススクレイピング
- `/enrich-jgrants` / `/enrich-tokyo-shigoto` - 詳細情報エンリッチ
- `/generate-suggestions` - サジェスション生成
- `/daily-ready-boost` / `/generate-fallback-v2` - Ready率向上
- `/check-updates` / `/monitor-status` / `/approve-update` - 更新監視
- `/enqueue-extractions` / `/consume-extractions` / `/cleanup-queue` - 抽出パイプライン

## 🔧 コードベース健全性レポート (2026-02-07)

### ✅ 完了済み改善
| # | 課題 | 状態 | 詳細 |
|---|------|------|------|
| A | dev_schema.sql 本番同期 | ✅ 完了 | 32テーブル→95テーブルに拡張、全コード参照テーブルを網羅 |
| B | company_memberships→user_companies統一 | ✅ 完了 | dev_schema内の参照を統一、company_membershipsは後方互換で残存 |
| D | screening v1 非推奨化 | ✅ 完了 | subsidies.tsからv1 import削除、screening.tsに@deprecated付与 |
| E | eligibility_rules テーブル確認 | ✅ 完了 | Fallback用として保持、SSOTはnormalizedから取得を明文化 |

### 🔄 進行中の改善
| # | 課題 | 状態 | 詳細 |
|---|------|------|------|
| C | 巨大ファイル分割 | Phase1完了 | cron/_helpers.ts 抽出、ディレクトリ構造準備済み。Phase2（物理分割）は未着手 |
| F | PROJECT_STATUS.md 更新 | ✅ 本ファイル | v1.5.0→v4.5.0 に更新 |

### ⏳ 未着手の課題
| # | 課題 | 優先度 | 詳細 |
|---|------|--------|------|
| G | Workers Cron 責務分離ドキュメント | 中 | 上記「Workers Cron アーキテクチャ」セクションで対応 |
| H | フロントエンド ES5 制約 | 中 | Tailwind CDN + ES5（var, function）→ビルド済みCSS移行検討 |
| I | KPIイベント記録の動作確認 | 中 | SUBSIDY_SEARCH / CHAT_SESSION_STARTED / DRAFT_GENERATED |
| C2 | 巨大ファイル物理分割 Phase2 | 高 | cron.ts (7,643行) / admin-dashboard.ts (6,866行) の実際の分割 |

## 📝 重要なファイル

### アプリケーション本体
- `src/index.tsx` - エントリポイント
- `src/routes/subsidies.ts` - 補助金検索・詳細API
- `src/routes/chat.ts` - 壁打ちチャット
- `src/routes/cron.ts` - Cron APIエンドポイント (7,643行 - 分割候補)
- `src/routes/admin-dashboard.ts` - 管理ダッシュボード (6,866行 - 分割候補)
- `src/routes/admin-ops.ts` - 管理オペレーション
- `src/lib/ssot/` - SSOT関連ライブラリ
- `src/lib/screening-v2.ts` - v2スクリーニングロジック
- `src/lib/screening.ts` - v1スクリーニング（@deprecated）

### Workers
- `workers/cron/` - メインCron Worker (1,119行)
- `workers/cron-feed/` - フィードCron Worker (131行)
- `workers/queue-cron/` - キューCron Worker (297行)
- `workers/consumer/` - Consumer Worker (650行)

### 設定・スキーマ
- `wrangler.jsonc` - Cloudflare設定
- `ecosystem.config.cjs` - PM2設定
- `migrations/dev_schema.sql` - 開発用スキーマ（95テーブル、本番同期済み）
- `migrations/0099_reconcile_schema.sql` - 本番スキーマ調整

### ドキュメント
- `README.md` - プロジェクト全体のドキュメント（最新：v4.5.0）
- `PROJECT_STATUS.md` - このファイル（現在の状態）
- `NORMALIZED_SUBSIDY_DETAIL_SPEC.md` - SSOT仕様書

## 🌐 重要なURL

- **本番**: https://hojyokin.pages.dev
- **GitHub**: https://github.com/matiuskuma2/hojyokin
- **運用監視**: https://hojyokin.pages.dev/admin/ops
- **Cron Worker**: https://hojyokin-cron.sekiyadubai.workers.dev
- **Consumer Worker**: https://hojyokin-consumer.sekiyadubai.workers.dev

## 🔧 トラブルシューティング

### 会社が表示されない場合
```bash
# ユーザーIDを確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT id, email FROM users WHERE email='matiuskuma2@gmail.com';"

# 会社を関連付け
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="INSERT INTO user_companies (id, user_id, company_id, created_at)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
       '7e8ffc39-554e-4c28-ab89-9d3b9c0f68cd',
       id,
       datetime('now')
FROM companies
WHERE id NOT IN (SELECT company_id FROM user_companies WHERE user_id='7e8ffc39-554e-4c28-ab89-9d3b9c0f68cd');"
```

### Consumer が動かない場合
```bash
# 手動実行
curl -s "https://hojyokin-consumer.sekiyadubai.workers.dev/consumer/run?batch=10"

# ステータス確認
curl -s "https://hojyokin-consumer.sekiyadubai.workers.dev/consumer/stats"
```

### Cron が動かない場合
```bash
# 手動実行
curl -s "https://hojyokin-cron.sekiyadubai.workers.dev/cron/run?limitRegistry=200&limitLifecycle=50"
```

---

**最終更新**: 2026-02-07
**バージョン**: 4.5.0
**Git最新**: b91f5be

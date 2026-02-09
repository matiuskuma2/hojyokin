# プロジェクト運用ルール (PROJECT_RULES)

> **目的**: サンドボックスが消失しても、このドキュメントとGitHubリポジトリから100%復活できる状態を維持する
> **最終更新**: 2026-02-09 (Phase 12.2)
> **管理者**: モギモギ（関屋紘之）
> **リポジトリ**: https://github.com/matiuskuma2/hojyokin

---

## 1. プロジェクト基本情報

| 項目 | 値 |
|------|-----|
| **プロジェクト名** | ホジョラク（補助金・助成金マッチング＆申請支援） |
| **リポジトリ名** | hojyokin |
| **内部名** | subsidy-matching |
| **本番URL** | https://hojyokin.pages.dev |
| **モニターUI** | https://hojyokin.pages.dev/monitor |
| **技術スタック** | Hono + TypeScript + Cloudflare Pages + D1 (SQLite) |
| **パッケージマネージャ** | npm |
| **ブランチ戦略** | main のみ（直接push） |

---

## 2. 記録ルール（何をどこに記録するか）

### 2a. ドキュメント体系

| ドキュメント | 場所 | 更新タイミング | 内容 |
|-------------|------|--------------|------|
| **PROJECT_RULES.md** | `docs/` | ルール変更時 | 全体ルール・命名規則・記録方法（本ファイル） |
| **PHASE_LOG.md** | `docs/` | Phase完了時 | Phase別の計画・実施内容・成果・次アクション |
| **CRAWL_RULES.md** | `docs/` | ルール変更/壁打ち後 | クロール運用ルール・PDF復旧ルール・壁打ち結果 |
| **SANDBOX_RECOVERY.md** | `docs/` | 環境変更時 | サンドボックス完全復活手順・バックアップ管理 |
| **DB_SCHEMA_OVERVIEW.md** | `docs/` | スキーマ変更時 | 主要テーブル定義・ER図・マイグレーション手順 |
| **DEPLOYMENT.md** | `docs/` | デプロイ方法変更時 | ビルド・デプロイ・外部サービス設定の完全手順 |
| **SSOT_koubo_pdf_management.md** | `tools/` | クロール実行後 | 公募要領PDF管理のSSOT（数値・詳細状況） |
| **DATA-ACQUISITION-RULES.md** | `docs/` | データ取得ルール変更時 | データソース別の取得・格納ルール |
| **ssot-data-architecture.md** | `docs/` | スキーマ変更時 | テーブル全カラム定義・detail_json構成 |
| **README.md** | ルート | 各Phase完了時 | 外向け概要・最新状態・全ドキュメントリンク |

### 2b. SQLファイル管理ルール

| 場所 | ファイル命名規則 | 用途 |
|------|-----------------|------|
| `migrations/` | `NNNN_descriptive_name.sql` | D1スキーマ変更（本番適用） |
| `tools/` | `seed_phaseN_description.sql` | Phase別の初期データ投入 |
| `tools/` | `update_description.sql` | 既存データ更新・復旧SQL |

**SQL命名ルール**:
- `seed_` プレフィックス: 新規データ投入（INSERT）
- `update_` プレフィックス: 既存データ更新（UPDATE）
- `fix_` プレフィックス: バグ修正・データ修正

### 2c. Gitコミットメッセージルール

```
Phase N.X: <概要> - <定量成果>

例:
Phase 12.2: 全件クロール完了 - 167件復旧 (active 296→463, PDF Coverage 43%→67.6%)
Phase 12.1: 定点観測データ充実 - 110件復旧 (active 296→406, PDF Coverage 43%→59%)
Phase 11: 公募要領PDF全件横断特定・DB記録・SSOT更新完了
Phase 10: Add 340 new subsidies (Part1-6) - total 22,258
```

**ルール**:
1. Phase番号を必ず含める
2. 定量成果を含める（件数、割合変化）
3. 過去Phaseとの差分がわかるように書く

---

## 3. Phase管理ルール

### 3a. Phaseの進め方

```
1. 計画立案 → PHASE_LOG.md に「計画」セクション追加
2. 壁打ち（検証） → 結果をCRAWL_RULES.md や PHASE_LOG.md に記録
3. 実行 → SQLファイルをtools/に保存、DBに適用
4. 検証 → D1クエリで結果確認、SSOT_koubo_pdf_management.md 更新
5. ビルド＆デプロイ → npm run build → wrangler pages deploy
6. 記録更新 → PHASE_LOG.md、SSOT、README.md 更新
7. Git push → commit + push to main
8. バックアップ → ProjectBackup実行
```

### 3b. Phase完了チェックリスト

- [ ] SSOT_koubo_pdf_management.md の数値更新
- [ ] PHASE_LOG.md に実施記録追加
- [ ] README.md の最新アップデートセクション更新
- [ ] SQLファイルをtools/に保存
- [ ] npm run build → dist/ 生成
- [ ] pm2 restart → ローカル動作確認
- [ ] wrangler pages deploy → 本番デプロイ
- [ ] git add -A && git commit && git push origin main
- [ ] ProjectBackup 実行

---

## 4. 壁打ち結果の記録ルール

### 4a. 壁打ちとは

データ復旧やクロール方針を検証するためのテスト実行のこと。

### 4b. 壁打ち結果の記録方法

1. **実行前**: CRAWL_RULES.md の該当セクションに「検証計画」を追記
2. **実行中**: `/tmp/` に中間結果のJSONを保存（サンドボックス内のみ）
3. **実行後**: 以下を記録
   - 成功率（%）
   - 発見パターン（どういうケースで見つかるか）
   - 失敗パターン（どういうケースで見つからないか）
   - 次のアクション決定

### 4c. 壁打ちで得た知見の永続化

壁打ち結果は必ず以下のいずれかに記録：
- **CRAWL_RULES.md**: ルール化できる知見
- **PHASE_LOG.md**: Phase固有の結果
- **SSOT_koubo_pdf_management.md**: 数値変更

**重要**: `/tmp/` のファイルはサンドボックス消失で失われるため、重要な知見は必ずGitHub管理下のファイルに転記すること。

---

## 5. 命名規則

### 5a. 補助金ID

| ソース | プレフィックス | 例 |
|--------|-------------|-----|
| jGrants | なし（API ID） | `a0W...` |
| 泉（izumi） | `izumi-` | `izumi-56795` |
| 手動登録 | 大文字英字ハイフン | `IT-SUBSIDY-2026-SECURITY` |
| REAL（手動） | `REAL-` | `REAL-004` |

### 5b. テーブル命名

- `subsidy_` プレフィックス: 補助金関連
- `koubo_` プレフィックス: 公募要領関連
- `agency_` プレフィックス: 代理店関連
- `v_` プレフィックス: ビュー（VIEW）

### 5c. APIエンドポイント

| パス | 用途 |
|------|------|
| `/api/cron/*` | Cron定期実行エンドポイント |
| `/api/admin/*` | 管理者API |
| `/api/search/*` | 検索API |
| `/api/health` | ヘルスチェック |

---

## 6. データ整合性ルール

### 6a. SSOT (Single Source of Truth) 原則

1. **検索・一覧**: `subsidy_canonical` + `subsidy_snapshot` が正
2. **詳細表示**: `subsidy_cache.detail_json` が正
3. **定点観測**: `koubo_monitors` + `koubo_crawl_log` が正
4. **izumiデータ**: 検索補助のみ、受付中判定には使わない

### 6b. DB更新時の必須手順

1. SQLファイルを `tools/` に保存
2. `--remote` フラグで本番D1に適用
3. 適用後に SELECT で件数確認
4. SSOT_koubo_pdf_management.md の数値更新
5. `npm run build` → デプロイ → ダッシュボード確認

---

## 7. セキュリティルール

| 項目 | ルール |
|------|--------|
| **APIキー** | `.dev.vars` に保存、Gitには含めない |
| **Cloudflare認証** | `setup_cloudflare_api_key` で都度設定 |
| **GitHub認証** | `setup_github_environment` で都度設定 |
| **D1アクセス** | 本番は `--remote`、ローカルは `--local` |
| **JWTシークレット** | wrangler secret で本番設定 |

---

## 8. 関連ドキュメントへのリンク

- [PHASE_LOG.md](./PHASE_LOG.md) - Phase別実績ログ
- [CRAWL_RULES.md](./CRAWL_RULES.md) - クロール運用ルール
- [SANDBOX_RECOVERY.md](./SANDBOX_RECOVERY.md) - サンドボックス復活手順
- [DB_SCHEMA_OVERVIEW.md](./DB_SCHEMA_OVERVIEW.md) - DB全体像
- [DEPLOYMENT.md](./DEPLOYMENT.md) - デプロイ手順
- [SSOT_koubo_pdf_management.md](../tools/SSOT_koubo_pdf_management.md) - 公募PDF管理SSOT
- [DATA-ACQUISITION-RULES.md](./DATA-ACQUISITION-RULES.md) - データ取得ルール
- [ssot-data-architecture.md](./ssot-data-architecture.md) - SSOTデータアーキテクチャ

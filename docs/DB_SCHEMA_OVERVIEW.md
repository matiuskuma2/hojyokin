# DB スキーマ概要 (DB_SCHEMA_OVERVIEW)

> **目的**: 主要テーブルの構成と関連を把握し、スキーマ変更時の影響範囲を理解する
> **最終更新**: 2026-02-09 (Phase 12.2)
> **詳細定義**: [ssot-data-architecture.md](./ssot-data-architecture.md), [data-dictionary.md](./data-dictionary.md)

---

## 1. テーブル分類

### 1a. コアデータ（補助金）

| テーブル | 件数 | 用途 |
|---------|------|------|
| `subsidy_cache` | 22,258 | 補助金マスタ（全ソース集約） |
| `subsidy_canonical` | 3,470 | 正規化済み補助金（SSOT検索用） |
| `subsidy_snapshot` | - | 時点スナップショット |
| `subsidy_source_link` | - | canonical ↔ cache の紐付け |
| `subsidy_metadata` | - | 補助金メタ情報 |
| `subsidy_lifecycle` | - | ライフサイクル管理 |
| `subsidy_documents` | - | 添付ドキュメント管理 |
| `subsidy_status_history` | - | ステータス変更履歴 |
| `subsidy_geo_map` | - | 地域マッピング |
| `subsidy_rounds` | - | 公募回次管理 |

### 1b. 定点観測（Phase 12）

| テーブル | 件数 | 用途 |
|---------|------|------|
| `koubo_monitors` | 685 | 公募要領PDF定点観測ルール |
| `koubo_crawl_log` | 685 | クロール実行結果履歴 |
| `koubo_discovery_queue` | 0 | 新規発見キュー |

### 1c. データソース

| テーブル | 件数 | 用途 |
|---------|------|------|
| `izumi_subsidies` | - | 泉（izumi）補助金データ |
| `izumi_urls` | - | izumi URL管理（verified/dead_link/pending） |
| `feed_sources` | - | フィードソース管理 |
| `subsidy_feed_items` | - | フィードアイテム |
| `source_registry` | - | データソース登録 |

### 1d. ユーザー・企業

| テーブル | 用途 |
|---------|------|
| `users` | ユーザーアカウント |
| `companies` | 企業情報 |
| `company_profile` | 企業プロフィール |
| `company_documents` | 企業書類 |
| `company_memberships` | 企業-ユーザー紐付け |

### 1e. チャット・申請

| テーブル | 用途 |
|---------|------|
| `chat_sessions` | チャットセッション |
| `chat_messages` | チャットメッセージ |
| `chat_answers` | チャット回答 |
| `chat_facts` | 壁打ち用ファクト |
| `application_drafts` | 申請書ドラフト |

### 1f. 代理店（Agency）

| テーブル | 用途 |
|---------|------|
| `agencies` | 代理店情報 |
| `agency_members` | 代理店メンバー |
| `agency_clients` | 代理店クライアント |
| `agency_client_history` | クライアント履歴 |
| `agency_member_invites` | メンバー招待 |
| `agency_staff_credentials` | スタッフ認証 |
| `agency_suggestions_cache` | 提案キャッシュ |
| `agency_feed_read_status` | フィード既読管理 |

### 1g. 管理・監視

| テーブル | 用途 |
|---------|------|
| `api_cost_logs` | APIコスト記録 |
| `cost_usage_log` | コスト使用ログ |
| `cron_runs` | Cron実行記録 |
| `audit_log` | 監査ログ |
| `alert_history` | アラート履歴 |
| `alert_rules` | アラートルール |
| `kpi_daily_snapshots` | KPI日次スナップショット |

---

## 2. 主要テーブル ER関連図（テキスト）

```
subsidy_cache (22,258件)
    ├── id (PK) ←── subsidy_source_link.cache_id
    ├── detail_json (SSOT詳細)
    └── source (jgrants/izumi/manual/tokyo-*)
    
    ↓ (1:1 via source_link)
    
subsidy_canonical (3,470件)
    ├── id (PK) ←── subsidy_source_link.canonical_id
    ├── name (正規化名)
    └── latest_snapshot_id → subsidy_snapshot.id
    
    ↓ (1:N)
    
subsidy_snapshot
    ├── id (PK)
    ├── canonical_id → subsidy_canonical.id
    ├── is_accepting (受付中判定 SSOT)
    ├── acceptance_start/end
    └── subsidy_max_limit / subsidy_rate
    
koubo_monitors (685件)
    ├── subsidy_id (FK → subsidy_cache.id)
    ├── status (active/url_lost/needs_manual/discontinued)
    ├── koubo_pdf_url (公募要領PDF直接URL)
    ├── koubo_page_url (掲載ページURL)
    └── next_crawl_at (次回クロール日)
    
    ↓ (1:N)
    
koubo_crawl_log (685件)
    ├── subsidy_id (FK → subsidy_cache.id)
    ├── crawl_type (scheduled/manual/re_explore/new_discovery)
    ├── result (success/url_changed/page_not_found/...)
    ├── checked_url / found_pdf_url
    └── created_at
```

---

## 3. マイグレーション管理

### 3a. マイグレーション実行方法

```bash
# ローカル適用
npx wrangler d1 migrations apply subsidy-matching-production --local

# 本番適用
npx wrangler d1 migrations apply subsidy-matching-production

# 単発SQL実行（本番）
npx wrangler d1 execute subsidy-matching-production --remote --file=./migrations/NNNN_xxx.sql

# 単発SQL実行（ローカル）
npx wrangler d1 execute subsidy-matching-production --local --file=./migrations/NNNN_xxx.sql
```

### 3b. マイグレーションファイル一覧

| ファイル | 内容 |
|---------|------|
| `0001_initial_schema.sql` | 初期テーブル作成 |
| `0002_eligibility_rules.sql` | 適格性ルール |
| `0003_knowledge_pipeline.sql` | ナレッジパイプライン |
| `0004` ~ `0011` | 各種拡張 |
| `0012_user_admin_and_status.sql` | ユーザー管理 |
| `0013` ~ `0018` | セキュリティ・使用量 |
| `0019` ~ `0023` | 代理店テーブル |
| `0024_data_pipeline_foundation.sql` | データパイプライン基盤 |
| `0026` ~ `0028` | フィード・クローラー |
| `0099_reconcile_schema.sql` | スキーマ整合性修正 |
| `0101_fix_feed_schema_and_seed.sql` | フィードスキーマ修正 |

### 3c. 新しいマイグレーション作成ルール

1. 番号は `NNNN` の連番（次は `0102`）
2. ファイル名は `NNNN_descriptive_name.sql`
3. 必ず `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` を使用
4. ロールバック用のDROPは別ファイル（通常不要）
5. 作成後は本番前にローカルでテスト

---

## 4. データ投入SQL (tools/)

### 4a. Phase別データ投入

| Phase | ファイル | 件数 |
|-------|---------|------|
| 2 | `seed_phase2_digital_ai_and_extras.sql` | 数件 |
| 3 | `seed_phase3_gotech_saikouchiku.sql` | 数件 |
| 4 | `seed_phase4_major_subsidies.sql` | 6件 |
| 5 | `seed_phase5_detail_json_batch.sql` | 18件 |
| 6 | `seed_phase6_detail_json_batch.sql` | 30件 |
| 7 | `seed_phase7_detail_json_update.sql` | 12件 |
| 8 | `seed_phase8_new_100_subsidies.sql` | 100件 |
| 9 | `seed_phase9_part1/2.sql` | 100件 |
| 10 | `seed_phase10_part1~6.sql` | 340件 |
| 12 | `seed_koubo_monitors.sql` | 685件 |
| 12 | `seed_crawl_log_initial.sql` | 296件 |

### 4b. データ更新SQL

| ファイル | 内容 |
|---------|------|
| `update_url_lost_recovery.sql` | url_lost → active 復旧 (104件, Phase 12.1) |
| `update_other_pdf_recovery.sql` | other PDF復旧 (54件, Phase 12.2) |
| `update_needs_manual_google.sql` | Google検索復旧 (9件) |
| `update_koubo_period_types.sql` | 公募時期タイプ設定 |
| `update_koubo_initial_crawl.sql` | 初回クロール結果記録 |
| `update_izumi_*.sql` | izumi関連更新各種 |
| `update_manual_*.sql` | 手動登録関連更新各種 |

---

## 5. 重要なCHECK制約

| テーブル | カラム | 許可値 |
|---------|--------|--------|
| `koubo_monitors` | `status` | `active`, `url_lost`, `needs_manual`, `discontinued` |
| `koubo_crawl_log` | `crawl_type` | `scheduled`, `manual`, `re_explore`, `new_discovery` |
| `koubo_crawl_log` | `result` | `running`, `success`, `url_changed`, `new_url_found`, `page_not_found`, `pdf_not_found`, `subsidy_discontinued`, `new_subsidy_found`, `error` |

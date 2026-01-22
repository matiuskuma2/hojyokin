# データベース設計

## D1データベース情報

| 項目 | 値 |
|------|-----|
| データベース名 | subsidy-matching-production |
| データベースID | e53f6185-60a6-45eb-b06d-c710ab3aef56 |
| Binding名 | DB |
| エンジン | SQLite (D1) |

---

## テーブル一覧（目的別）

### ユーザー・認証系

| テーブル | 説明 |
|----------|------|
| `users` | ユーザーアカウント |
| `refresh_tokens` | JWTリフレッシュトークン |
| `password_reset_tokens` | パスワードリセット用トークン |

### 会社・プロフィール系

| テーブル | 説明 |
|----------|------|
| `companies` | 会社基本情報 |
| `company_profile` | 会社詳細プロフィール（検索フィルタ用） |
| `company_documents` | アップロード書類 |
| `company_memberships` | ユーザー↔会社の紐付け |
| `user_companies` | ユーザー↔会社の紐付け（旧） |

### S3: 壁打ちチャット系

| テーブル | 説明 |
|----------|------|
| `chat_sessions` | 壁打ちセッション |
| `chat_messages` | チャット履歴 |
| `chat_facts` | 収集済み事実（次回以降聞かない） |

### S4: 申請書ドラフト系

| テーブル | 説明 |
|----------|------|
| `application_drafts` | 申請書ドラフト（セクション・NG結果） |

### 補助金系

| テーブル | 説明 |
|----------|------|
| `subsidy_cache` | JGrants APIキャッシュ |
| `subsidy_metadata` | 補助金メタデータ |
| `subsidy_lifecycle` | 制度ライフサイクル（status/next_check_at） |
| `subsidy_status_history` | ステータス変更履歴 |
| `subsidy_geo_map` | 地域マッピング |
| `eligibility_rules` | 適格性判定ルール |
| `eligibility_extractions` | 適格性抽出結果 |
| `required_documents_master` | 必要書類マスタ |
| `required_documents_by_subsidy` | 補助金別必要書類 |

### ナレッジパイプライン系

| テーブル | 説明 |
|----------|------|
| `source_registry` | 47都道府県クロール台帳 |
| `source_url` | クロール対象URL |
| `doc_object` | R2保存ドキュメント索引 |
| `crawl_queue` | Cronキュー |
| `crawl_job` | クロールジョブ |
| `crawl_history` | クロール履歴 |
| `crawl_stats` | クロール統計 |
| `crawl_queue_stats` | キュー統計 |
| `domain_policy` | ドメイン単位クロールポリシー |
| `knowledge_summary` | ナレッジサマリ |
| `budget_close_patterns` | 予算枯渇パターン |
| `geo_region` | 地域マスタ |

### 管理・監査系

| テーブル | 説明 |
|----------|------|
| `audit_log` | 監査ログ |
| `alert_log` | アラートログ |
| `api_usage` | API使用量 |
| `search_cache` | 検索キャッシュ |
| `evaluation_runs` | 評価実行履歴 |

### システム系

| テーブル | 説明 |
|----------|------|
| `d1_migrations` | マイグレーション履歴 |
| `sqlite_sequence` | SQLite自動採番 |
| `_cf_KV` | Cloudflare内部 |

---

## 主要テーブル関係図

```
users
  │
  ├── company_memberships ──── companies
  │                              │
  │                              ├── company_profile
  │                              │
  │                              └── company_documents
  │
  ├── chat_sessions ───────────── chat_messages
  │       │
  │       └── chat_facts
  │       │
  │       └── application_drafts
  │
  └── refresh_tokens

subsidy_cache
  │
  ├── subsidy_metadata
  │
  ├── subsidy_lifecycle
  │
  ├── eligibility_rules
  │
  └── required_documents_by_subsidy

source_registry
  │
  └── crawl_queue
        │
        └── crawl_job
              │
              └── doc_object
```

---

## マイグレーションファイル一覧

| ファイル | 説明 |
|----------|------|
| 0001_initial_schema.sql | 基本スキーマ（users, companies, subsidies等） |
| 0002_eligibility_rules.sql | 適格性ルールテーブル |
| 0003_knowledge_pipeline.sql | ナレッジパイプライン基盤 |
| 0004_doc_object_unique.sql | doc_object一意制約 |
| 0005_knowledge_enhancements.sql | ナレッジ拡張 |
| 0006_lifecycle_and_docs.sql | ライフサイクル＋必要書類 |
| 0007_crawl_job_cron_support.sql | Cronサポート |
| 0008_crawl_queue.sql | クロールキュー |
| 0009_fix_crawl_queue_fk.sql | FK修正 |
| 0010_domain_policy_blocked_reason.sql | ドメインポリシー拡張 |
| 0011_source_registry_scope_rules.sql | スコープルール |
| 0012_user_admin_and_status.sql | ユーザー管理拡張 |
| 0013_password_reset_tokens.sql | パスワードリセット |
| 0014_audit_log.sql | 監査ログ |
| 0015_company_profile.sql | 会社プロフィール拡張 |
| 0016_s3_s4_chat_draft.sql | S3/S4: チャット＋ドラフト |

---

## バックアップ・復元

### エクスポート

```bash
npx wrangler d1 export subsidy-matching-production --remote --output backup.sql
```

### インポート（新規DB作成後）

```bash
# 1. 新規D1作成
npx wrangler d1 create subsidy-matching-production

# 2. マイグレーション適用（推奨）
npx wrangler d1 migrations apply subsidy-matching-production --remote

# 3. または直接インポート
npx wrangler d1 execute subsidy-matching-production --remote --file backup.sql
```

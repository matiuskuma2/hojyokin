# SSOT データアーキテクチャ台帳

> **目的**: 運用インシデント/技術負債ゼロを優先。DB/API/ロジックの依存関係を一本化し、実装変更時に更新する運用を確立。
> **最終更新**: 2026-02-01

---

## (A) jGrants 取得フィールド一覧

### A-1. subsidy_cache テーブルカラム

| カラム名 | 型 | SSOT | 説明 | 検索 | 詳細 | 壁打ち |
|---------|-----|------|------|:----:|:----:|:------:|
| `id` | TEXT PK | jGrants API | 補助金ID (例: `a0W...`) | ✅ | ✅ | ✅ |
| `source` | TEXT | 内部管理 | `jgrants` / `tokyo-*` / `izumi` / `manual` | ✅ | ✅ | - |
| `title` | TEXT | jGrants API | 補助金タイトル | ✅ | ✅ | ✅ |
| `subsidy_max_limit` | INTEGER | jGrants API | 補助上限額（円） | ✅ | ✅ | ○ |
| `subsidy_rate` | TEXT | jGrants API | 補助率テキスト（例: `2/3`） | ✅ | ✅ | ○ |
| `target_area_search` | TEXT | jGrants API | 対象地域コード（検索用） | ✅ | ✅ | ○ |
| `target_industry` | TEXT | jGrants API | 対象業種コード | ✅ | ✅ | ○ |
| `target_number_of_employees` | TEXT | jGrants API | 対象従業員規模 | ✅ | ✅ | ○ |
| `acceptance_start_datetime` | TEXT | jGrants API | 受付開始日時 | ○ | ✅ | ○ |
| `acceptance_end_datetime` | TEXT | jGrants API | 受付終了日時（**deadline SSOT**） | ✅ | ✅ | ✅ |
| `request_reception_display_flag` | INTEGER | jGrants API | 受付中フラグ (0/1) | ✅ | - | - |
| `detail_json` | TEXT | jGrants API → エンリッチ | 詳細情報JSON（下記参照） | - | ✅ | ✅ |
| `cached_at` | TEXT | 内部管理 | キャッシュ日時 | - | - | - |
| `expires_at` | TEXT | 内部管理 | キャッシュ有効期限 | - | - | - |
| `wall_chat_ready` | INTEGER | 派生値 | 壁打ち可能フラグ (0/1) | ✅ | ✅ | ✅ |
| `wall_chat_missing` | TEXT | 派生値 | 不足項目JSON配列 | - | ✅ | ✅ |
| `detail_score` | INTEGER | 派生値 | SEARCHABLE スコア (0-5) | - | ✅ | - |

### A-2. detail_json 主要キー構成

```
detail_json (SSOT: jGrants API + エンリッチメント)
├── 基本情報
│   ├── id                          # 補助金ID
│   ├── title                       # タイトル
│   ├── name                        # 名称（APIによる揺れ吸収）
│   ├── overview / description      # 概要説明（必須@壁打ち）
│   └── fiscal_year                 # 年度
│
├── 金額・補助率
│   ├── subsidy_max_limit           # 上限額（円）
│   ├── subsidy_min_limit           # 下限額（円）
│   ├── subsidy_rate                # 補助率（例: "2/3"）
│   ├── subsidy_rate_detail         # 補助率詳細
│   ├── subsidy_rate_v2             # 表示整形済み（v2）
│   └── subsidy_max_v2              # 表示整形済み（v2）
│
├── 対象・要件
│   ├── application_requirements    # 申請要件（必須@壁打ち）
│   ├── application_requirements_v2 # v2用
│   ├── eligible_expenses           # 対象経費（必須@壁打ち）
│   ├── eligible_expenses_v2        # v2用
│   ├── target_businesses           # 対象事業
│   ├── target_applicants           # 対象者詳細
│   ├── target_area_search          # 対象地域コード
│   ├── target_area_detail          # 対象地域詳細
│   ├── target_industry             # 対象業種
│   └── target_number_of_employees  # 対象従業員数
│
├── 書類・様式
│   ├── required_documents          # 必要書類一覧（必須@壁打ち）
│   ├── required_documents_v2       # v2用
│   ├── required_forms[]            # 様式情報（推奨@壁打ち）
│   │   ├── form_id
│   │   ├── name
│   │   ├── fields[]
│   │   ├── source_page
│   │   └── notes
│   └── attachments[]               # 添付ファイル情報
│
├── スケジュール
│   ├── acceptance_start_datetime   # 受付開始
│   ├── acceptance_end_datetime     # 受付終了（deadline SSOT）
│   ├── deadline                    # 締切テキスト（必須@壁打ち）
│   ├── application_period          # 申請期間テキスト
│   └── workflows[]                 # 複数回募集の場合
│       ├── target_area
│       ├── acceptance_start
│       └── acceptance_end
│
├── URL・PDF
│   ├── pdf_urls[]                  # PDFリスト
│   ├── reference_urls[]            # 参照URL
│   ├── related_url                 # 公式ページURL
│   ├── detailUrl                   # 詳細URL
│   └── api_attachments[]           # API添付ファイル
│       ├── name
│       ├── url
│       ├── has_data                # base64有無フラグ
│       └── file_type
│
├── 電子申請
│   ├── is_electronic_application   # 電子申請フラグ
│   ├── electronic_application_url  # 電子申請URL
│   └── electronic_application_system # システム名
│
├── お問い合わせ
│   └── contact
│       ├── organization
│       ├── department
│       ├── phone / fax / email
│       ├── address
│       ├── hours
│       └── url
│
├── エンリッチメント情報
│   ├── enriched_version            # エンリッチバージョン
│   ├── use_purpose                 # 利用目的
│   ├── base64_processed            # base64処理済みフラグ
│   ├── base64_no_data              # base64データなしフラグ
│   ├── extracted_pdf_text          # PDF抽出テキスト
│   └── pdf_extraction_version      # PDF抽出バージョン
│
└── 壁打ち判定
    ├── wall_chat_ready             # 壁打ち可能フラグ
    ├── wall_chat_excluded          # 壁打ち除外フラグ
    └── reason                      # 除外理由
```

---

## (B) 検索/詳細/壁打ちの依存関係表

### B-1. 検索条件マッピング

| フィールド | 必須/任意 | UI表示名 | DBカラム | 条件タイプ | SSOT |
|-----------|:--------:|---------|---------|-----------|------|
| 企業ID | 必須 | - | `company_id` パラメータ | 完全一致 | users経由 |
| キーワード | 任意 | 「キーワード」 | `title LIKE ?` | 部分一致 | ユーザー入力 |
| 受付中 | 任意 | 「受付中のみ」 | `acceptance_end_datetime >= today` | 範囲 | jGrants |
| 地域 | 任意 | 「対象地域」 | `target_area_search` | 部分一致/NULL許容 | jGrants + company.prefecture |
| 業種 | 任意 | 「対象業種」 | `target_industry` | 部分一致 | jGrants |
| 従業員規模 | 任意 | 「従業員規模」 | `target_number_of_employees` | 範囲 | jGrants |
| 壁打ち対応 | 任意 | - | `wall_chat_ready = 1` | 完全一致 | 派生値 |
| ソート | 任意 | 「並び替え」 | `ORDER BY acceptance_end_datetime / subsidy_max_limit` | - | - |

### B-2. 詳細表示フィールドマッピング

| 表示項目 | 必須/任意 | detail_json キー | フォールバック | SSOT |
|---------|:--------:|-----------------|---------------|------|
| タイトル | 必須 | `title` | - | jGrants |
| 概要 | 必須 | `overview` | `description` | jGrants |
| 補助上限 | 必須 | `subsidy_max_limit` → `subsidy_max_v2` | - | jGrants |
| 補助率 | 推奨 | `subsidy_rate` → `subsidy_rate_v2` | - | jGrants |
| 対象地域 | 必須 | `target_area_detail` | `target_area_search` | jGrants + workflows |
| 対象業種 | 推奨 | `target_industry` | - | jGrants |
| 対象従業員 | 推奨 | `target_number_of_employees` | - | jGrants |
| 申請要件 | 必須 | `application_requirements` | `application_requirements_v2` | jGrants |
| 対象経費 | 必須 | `eligible_expenses` | `eligible_expenses_v2` | jGrants |
| 必要書類 | 必須 | `required_documents` | `required_documents_v2` | jGrants |
| 申請期間 | 必須 | `acceptance_start/end_datetime` | `deadline`, `workflows[]` | jGrants |
| 公式URL | 推奨 | `related_url` | `detailUrl`, `official_links.top` | jGrants |
| PDF | 推奨 | `pdf_urls[]` | `attachments[]` | jGrants |
| お問い合わせ | 推奨 | `contact` / `contact_info` | - | jGrants |
| 電子申請 | 推奨 | `is_electronic_application` | - | jGrants |

### B-3. 壁打ち判定ロジック（凍結仕様 v4）

#### 必須項目（5項目）

| 項目 | detail_json キー | 判定条件 | 不足時の影響 |
|------|-----------------|---------|-------------|
| 概要 | `overview` / `description` | `length >= 20` | 壁打ち不可 |
| 申請要件 | `application_requirements` | 配列1件以上 or テキスト20文字以上 | 壁打ち不可 |
| 対象経費 | `eligible_expenses` | 配列1件以上 or テキスト20文字以上 | 壁打ち不可 |
| 必要書類 | `required_documents` | 配列1件以上 | 壁打ち不可 |
| 締切 | `acceptance_end_datetime` / `deadline` | 存在確認 | 壁打ち不可 |

#### 壁打ち対象外（EXCLUDED）条件

| 除外理由コード | パターン | 説明 |
|---------------|---------|------|
| `KOFU_SHINSEI` | `/交付申請\|交付決定後\|採択後\|実績報告\|精算払い\|概算払い/` | 採択後の手続き |
| `SENGEN_NINTEI` | `/(?:成長)?宣言\|認定(?:制度\|プログラム\|企業)\|ロゴ(?:マーク)?(?:使用\|利用)/` | 認定プログラム（補助金でない） |
| `GUIDELINE_ONLY` | `/ガイドライン(?:のみ)?\|使用規約\|利用規約\|手引き(?:書)?/` | ガイドライン等 |
| `RENSHU_TEST` | `/練習用\|テスト用\|ダミー\|サンプル(?:申請)?/` | テスト用 |
| `NO_ELIGIBLE_EXPENSES` | （構造的判定） | 対象経費が構造的に存在しない |

#### 電子申請の特別ルール (v3)

```
is_electronic_application = true の場合:
  - 必須スコア 3/5 以上で wall_chat_ready = true
  - 理由: 電子申請システム側で書式を作成するため required_forms 不要
```

---

## (C) policy_id 紐付け Canonical Key 設計

### C-1. 設計原則

```
【恒久キー vs 募集回キー】

program_key（恒久キー）: 制度そのものを識別
  例: "tokyo-kosha-iot-hojo"（都中小公社 IoT補助金）

round_key（募集回キー）: 回ごとの締切・要領が変わる単位
  例: "tokyo-kosha-iot-hojo:2026-r1"（2026年度第1回）

policy_id（izumi）: スナップショットID
  例: 116453

jgrants_id: jGrants API の ID
  例: "a0W2o00000xxxxxx"
```

### C-2. 最小テーブル設計

#### `subsidy_canonical` テーブル（制度マスタ）

```sql
CREATE TABLE IF NOT EXISTS subsidy_canonical (
  id TEXT PRIMARY KEY,                    -- program_key（恒久キー）
  name TEXT NOT NULL,                     -- 制度名称（正式）
  name_normalized TEXT,                   -- 正規化名称（検索用）
  issuer_code TEXT,                       -- 実施機関コード
  prefecture_code TEXT,                   -- 都道府県コード
  category_codes TEXT,                    -- カテゴリコード（JSON配列）
  
  -- メタ情報
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_updated_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  notes TEXT
);

CREATE INDEX idx_canonical_issuer ON subsidy_canonical(issuer_code);
CREATE INDEX idx_canonical_pref ON subsidy_canonical(prefecture_code);
CREATE INDEX idx_canonical_name ON subsidy_canonical(name_normalized);
```

#### `subsidy_source_link` テーブル（紐付け管理）

```sql
CREATE TABLE IF NOT EXISTS subsidy_source_link (
  id TEXT PRIMARY KEY,
  canonical_id TEXT NOT NULL,             -- FK to subsidy_canonical
  source_type TEXT NOT NULL,              -- 'jgrants', 'izumi', 'tokyo-kosha', etc.
  source_id TEXT NOT NULL,                -- 各ソースのID
  round_key TEXT,                         -- 募集回キー（任意）
  
  -- マッチング情報
  match_type TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'manual', 'system'
  match_score REAL,                       -- 自動マッチの信頼度 (0-1)
  match_fields TEXT,                      -- マッチに使った項目（JSON）
  
  -- 検証状態
  verified INTEGER DEFAULT 0,
  verified_by TEXT,
  verified_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (canonical_id) REFERENCES subsidy_canonical(id),
  UNIQUE(source_type, source_id)
);

CREATE INDEX idx_link_canonical ON subsidy_source_link(canonical_id);
CREATE INDEX idx_link_source ON subsidy_source_link(source_type, source_id);
CREATE INDEX idx_link_match_type ON subsidy_source_link(match_type, verified);
```

### C-3. 紐付けフロー

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. 自動マッチング（タイトル類似度 + 金額 + 地域）                    │
│    ├─ 確定マッチ (score >= 0.9): verified = 1                      │
│    ├─ 推定マッチ (0.7 <= score < 0.9): verified = 0（レビュー待ち）│
│    └─ 不一致 (score < 0.7): canonical新規作成 or スキップ          │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. 既存 subsidy_cache との連携                                      │
│    ├─ subsidy_cache.id = source_id (source_type = 'jgrants')      │
│    ├─ 検索時: canonical_id で束ねられた全ソースを横断              │
│    └─ 壁打ち時: 最も detail_ready なソースを優先                    │
└────────────────────────────────────────────────────────────────────┘
```

### C-4. izumi 紐付けの現実解

```
【段階的アプローチ】

Phase 1: 確定マッチ（高信頼度）
  - 条件: タイトル完全一致 AND (地域一致 OR 金額一致)
  - 処理: subsidy_source_link に verified=1 で登録

Phase 2: 推定マッチ（中信頼度）
  - 条件: タイトル類似度 >= 0.8 AND (地域一致 OR 金額近似)
  - 処理: subsidy_source_link に verified=0 で登録、レビューキュー追加

Phase 3: 不一致（izumi固有）
  - 条件: どのjGrantsともマッチしない
  - 処理: subsidy_canonical 新規作成、source_type='izumi' で登録
  - 価値: jGrants未掲載の地方自治体補助金として独立管理
```

---

## (D) 項目別更新計画（SSOT表）

### D-1. jGrants ソースフィールド

| 項目 | SSOT | 格納場所 | 更新頻度 | 差分検知 | 失敗時の扱い | 監査ログ |
|------|------|---------|---------|---------|-------------|---------|
| 受付期間 | `workflows[].acceptance_end` max | `subsidy_cache.acceptance_end_datetime` | 日次 | datetime比較 | 前回値保持 | cron_runs |
| 対象地域 | `workflows[].target_area` + v2正規化 | `subsidy_cache.target_area_search` + `detail_json` | 週次 | JSON diff | 前回値保持 | cron_runs |
| 補助率 | `subsidy_rate` → v2整形 | `subsidy_cache.subsidy_rate` + `detail_json.subsidy_rate_v2` | 週次 | テキスト比較 | 前回値保持 | cron_runs |
| 補助上限 | `subsidy_max_limit` → v2整形 | `subsidy_cache.subsidy_max_limit` + `detail_json.subsidy_max_v2` | 週次 | 数値比較 | 前回値保持 | cron_runs |
| 対象経費 | `use_purpose` → v2Expenses | `detail_json.eligible_expenses` + `_v2` | 週次 | 配列diff | 前回値保持 | cron_runs |
| 申請要件 | API優先 → v2要件/抽出 | `detail_json.application_requirements` + `_v2` | 週次 | テキストhash | 前回値保持 | cron_runs |
| 必要書類 | API + PDF抽出 | `detail_json.required_documents` | 週次 | 配列diff | 前回値保持 | cron_runs |
| PDF/添付 | `attachments` + `pdf_urls` | `detail_json.pdf_urls` + `attachments` | 週次 | URL存在チェック | URL除去、ログ記録 | crawl_stats |
| 電子申請フラグ | APIフィールド | `detail_json.is_electronic_application` | 週次 | bool比較 | 前回値保持 | cron_runs |

### D-2. 派生フィールド（内部計算）

| 項目 | SSOT | 計算ロジック | 更新タイミング | 失敗時の扱い |
|------|------|-------------|---------------|-------------|
| `wall_chat_ready` | `checkWallChatReadyFromJson()` | 5項目スコア + 除外判定 | detail_json更新時 | 0に設定 |
| `wall_chat_missing` | `isWallChatReady().missing` | 不足項目配列 | detail_json更新時 | 全項目 |
| `detail_score` | `isSearchable()` | 5項目中の充足数 | detail_json更新時 | 0に設定 |
| `deadline` | `workflows[].acceptance_end` max | 最遠の締切を採用 | API取得時 | 前回値保持 |

### D-3. izumi ソースフィールド

| 項目 | SSOT | 格納場所 | 更新頻度 | 差分検知 | 失敗時の扱い | 監査ログ |
|------|------|---------|---------|---------|-------------|---------|
| 新規policy_id | 最大ID監視 | izumi_subsidies | 週次 | ID比較 | 次回リトライ | feed_import_batches |
| タイトル | izumiスクレイプ | izumi_subsidies.title | 月次 | hash比較 | 前回値保持 | feed_import_rows |
| 金額 | izumiスクレイプ → パース | izumi_subsidies.max_amount_value | 月次 | 数値比較 | NULL設定 | feed_import_rows |
| URL有効性 | HTTPステータス | izumi_urls.crawl_status | 週次 | ステータスコード | 'failed'設定 | crawl_stats |
| 本文抽出 | Firecrawl | izumi_urls.extracted_json | 随時 | hash比較 | 'failed'設定 | crawl_queue |

### D-4. 更新フロー図

```
┌──────────────────────────────────────────────────────────────────────┐
│ 毎日                                                                  │
│ ├─ 締切チェック: acceptance_end_datetime < today → 検索除外         │
│ └─ 期限切れアラート: 3日以内締切の補助金をリスト                     │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 週次                                                                  │
│ ├─ jGrants API同期: POST /api/cron/sync-jgrants                      │
│ │   ├─ discovery_items → subsidy_cache への昇格                      │
│ │   ├─ detail_json エンリッチメント                                   │
│ │   └─ wall_chat_ready 再計算                                        │
│ ├─ izumi 新規ID検知: policy_id max監視                                │
│ ├─ URL有効性チェック: HTTPステータス確認                              │
│ └─ jGrants紐付け更新: 新規izumiデータとの類似度チェック              │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 月次                                                                  │
│ ├─ 全件ハッシュ比較: タイトル・金額・URL変更検知                     │
│ ├─ 紐付けレビュー: verified=0 のマッチング確認                       │
│ └─ データ品質レポート: L1/L2/L3 カバレッジスコア                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## (E) 検索UI フィルタ項目（確認用）

> **質問への回答依頼**: 以下のフィルタ項目の必須/任意設定を確認してください

| フィルタ項目 | 現在の設定 | 推奨設定 | コメント |
|-------------|-----------|---------|---------|
| 地域（都道府県） | 任意 | **必須推奨** | company.prefectureで自動フィル |
| 目的/カテゴリ | 任意 | 任意 | jGrantsカテゴリと整合取れず |
| 金額帯 | 任意 | 任意 | レンジフィルタ推奨 |
| 補助率 | 任意 | 任意 | テキスト形式のため検索困難 |
| 業種 | 任意 | **必須推奨** | company.industry_majorで自動フィル |
| 従業員規模 | 任意 | **必須推奨** | company.employee_bandで自動フィル |
| 受付中のみ | 任意 | **デフォルトON推奨** | 期限切れを除外 |
| 壁打ち対応のみ | 任意 | 任意 | 高度ユーザー向け |

---

## (F) 次のタスク（チェックリスト形式）

### 即時対応（今週）

- [ ] **Task1**: 電子申請フラグの SSOT 化
  - [ ] `is_electronic_application` を detail_json に追加
  - [ ] 壁打ち判定ロジックへの反映確認
  - [ ] 既存データの再計算（バッチ処理）

- [ ] **Task2**: policy_id 連携の準備
  - [ ] `subsidy_canonical` テーブル作成（D1 migration）
  - [ ] `subsidy_source_link` テーブル作成（D1 migration）
  - [ ] インデックス追加

### 短期（2週間以内）

- [ ] **Task3**: izumi インポートパイプライン
  - [ ] CSVインポートスクリプト作成
  - [ ] 金額パース処理実装
  - [ ] 18,655件の初期インポート

- [ ] **Task4**: jGrants 紐付けバッチ
  - [ ] タイトル類似度計算（Levenshtein / TF-IDF）
  - [ ] 自動マッチング実行
  - [ ] レビューキュー生成

### 中期（1ヶ月以内）

- [ ] **Task5**: 検索API統合
  - [ ] `/api/subsidies/search` に izumi ソース追加
  - [ ] ソースフィルタパラメータ追加
  - [ ] 壁打ち対応フラグによるフィルタ

- [ ] **Task6**: 定期更新ジョブ
  - [ ] 週次 jGrants 同期の安定化
  - [ ] izumi 差分検知ジョブ
  - [ ] URL有効性チェックジョブ

---

## 付録: 関連ファイル一覧

| ファイル | 役割 |
|---------|------|
| `src/lib/jgrants-adapter.ts` | jGrants API アダプター（3モード対応） |
| `src/lib/jgrants.ts` | jGrants API クライアント |
| `src/lib/wall-chat-ready.ts` | 壁打ち判定ロジック（v4） |
| `src/routes/subsidies.ts` | 補助金検索・詳細API |
| `src/routes/chat.ts` | 壁打ちチャットAPI |
| `src/routes/cron.ts` | 定期更新ジョブ |
| `migrations/dev_schema.sql` | 開発用スキーマ |
| `migrations/0103_wall_chat_ready.sql` | 壁打ちカラム追加 |
| `docs/izumi-integration-plan.md` | izumi 統合計画 |

---

**このドキュメントは実装変更時に必ず更新してください。**

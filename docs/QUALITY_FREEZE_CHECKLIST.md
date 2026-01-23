# 品質凍結チェックリスト

**作成日**: 2026-01-23  
**最終更新**: 2026-01-23  
**目的**: 仕様・DB・API契約がブレない状態を確保し、運用事故を防ぐ

---

## 凍結ステータス

| 項目 | ステータス | 備考 |
|------|-----------|------|
| Q1-1: データ移行 | ✅ 完了 | missing=0, primary_cnt=1達成 |
| Q1-2: コード参照統一 | ✅ 完了 | company_memberships参照を全排除 |
| Q3: Agency導線 | ✅ 完了 | /agency/search実装済み・ナビ追加済み |
| Q2: SendGrid | ⏸️ 後回し | 完成後にローテーション |
| 会社情報フロー | 🔄 進行中 | Completeness API実装済み、UI統一は次フェーズ |

---

## A. 現状把握（観測できる事実）

### A-1. 主要テーブルのCREATE TABLE

#### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                          -- UUID
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                  -- pbkdf2_sha256$iterations$salt$hash
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',            -- 'user' | 'admin' | 'super_admin' | 'agency'
  email_verified_at TEXT,                       -- ISO8601
  password_reset_token TEXT,
  password_reset_expires TEXT,                  -- ISO8601
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_disabled INTEGER NOT NULL DEFAULT 0, 
  disabled_reason TEXT, 
  disabled_at TEXT, 
  disabled_by TEXT, 
  last_login_at TEXT, 
  last_login_ip TEXT, 
  created_ip TEXT, 
  failed_login_attempts INTEGER NOT NULL DEFAULT 0, 
  lockout_until TEXT
)
```
**ロール実値**: `user`, `agency`, `admin`, `super_admin`

#### companies
```sql
CREATE TABLE companies (
  id TEXT PRIMARY KEY,                          -- UUID
  name TEXT NOT NULL,
  postal_code TEXT,
  prefecture TEXT NOT NULL,                     -- 都道府県コード (01-47)
  city TEXT,
  industry_major TEXT NOT NULL,                 -- 大分類コード
  industry_minor TEXT,                          -- 中分類コード
  employee_count INTEGER NOT NULL,              -- 従業員数
  employee_band TEXT NOT NULL,                  -- 従業員帯 ('1-5', '6-20', '21-50', '51-100', '101-300', '301+')
  capital INTEGER,                              -- 資本金（円）
  established_date TEXT,                        -- 設立年月 (YYYY-MM)
  annual_revenue INTEGER,                       -- 年商（円）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

#### company_profile
```sql
CREATE TABLE company_profile (
  company_id TEXT PRIMARY KEY,                  -- ⚠️ PKはcompany_id（idカラムは存在しない）
  
  -- 法人基本情報
  corp_number TEXT,                              -- 法人番号（13桁）
  corp_type TEXT,                                -- 法人格
  representative_name TEXT,                      -- 代表者名
  representative_title TEXT,                     -- 代表者肩書
  founding_year INTEGER,                         -- 創業年
  founding_month INTEGER,                        -- 創業月
  
  -- 連絡先
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- 事業内容
  business_summary TEXT,                         -- 事業概要
  main_products TEXT,                            -- 主要製品・サービス
  main_customers TEXT,                           -- 主要顧客層
  competitive_advantage TEXT,                    -- 強み・差別化要因
  
  -- 財務・経営
  fiscal_year_end INTEGER,                       -- 決算月（1-12）
  is_profitable INTEGER,                         -- 黒字か（0/1）
  has_debt INTEGER,                              -- 借入金有無（0/1）
  
  -- 補助金関連
  past_subsidies_json TEXT,                      -- 過去に受けた補助金
  desired_investments_json TEXT,                 -- やりたい投資
  current_challenges_json TEXT,                  -- 現在の課題
  
  -- 雇用関連
  has_young_employees INTEGER,
  has_female_executives INTEGER,
  has_senior_employees INTEGER,
  plans_to_hire INTEGER,
  
  -- 認定・資格
  certifications_json TEXT,
  
  -- 制約・注意事項
  constraints_json TEXT,
  notes TEXT,
  
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
)
```

#### user_companies ⭐ 正テーブル
```sql
CREATE TABLE user_companies (
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',           -- 'owner' | 'admin' | 'member'
  is_primary INTEGER NOT NULL DEFAULT 0,         -- メイン会社フラグ
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  PRIMARY KEY (user_id, company_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
)
```

#### company_memberships ⚠️ 非推奨（削除予定）
```sql
CREATE TABLE company_memberships (
  id TEXT PRIMARY KEY,                          -- UUID
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',          -- 'owner' | 'admin' | 'member'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(user_id, company_id)
)
```

#### agencies
```sql
CREATE TABLE agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  plan TEXT DEFAULT 'free',           -- free / pro / enterprise
  max_clients INTEGER DEFAULT 10,     -- プランによる上限
  settings_json TEXT,                 -- 事務所設定
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

#### agency_members
```sql
CREATE TABLE agency_members (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',  -- owner / admin / staff
  permissions_json TEXT,              -- 個別権限（将来拡張用）
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(agency_id, user_id)
)
```

#### agency_clients
```sql
CREATE TABLE agency_clients (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,           -- 既存のcompaniesテーブルに紐づく
  client_name TEXT,                   -- 表示用名称
  client_email TEXT,
  client_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active / paused / archived
  notes TEXT,
  tags_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(agency_id, company_id)
)
```

#### agency_member_invites
```sql
CREATE TABLE agency_member_invites (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role_in_agency TEXT NOT NULL DEFAULT 'staff',  -- 'owner', 'admin', 'staff'
  invite_token_hash TEXT NOT NULL,
  invite_code TEXT NOT NULL,  -- 短いコード（メール用）
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by_user_id TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
)
```

#### access_links
```sql
CREATE TABLE access_links (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  session_id TEXT,                    -- 壁打ちリンクの場合のみ
  type TEXT NOT NULL,                 -- intake / chat / upload
  token_hash TEXT NOT NULL UNIQUE,
  short_code TEXT UNIQUE,             -- 短縮コード
  expires_at TEXT NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  revoked_at TEXT,
  issued_by_user_id TEXT NOT NULL,
  last_used_at TEXT,
  last_used_ip TEXT,
  last_used_ua TEXT,
  label TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

#### intake_submissions
```sql
CREATE TABLE intake_submissions (
  id TEXT PRIMARY KEY,
  access_link_id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,         -- 入力内容（JSON）
  documents_json TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',  -- submitted / approved / rejected / merged
  reviewed_at TEXT,
  reviewed_by_user_id TEXT,
  review_notes TEXT,
  submitted_ip TEXT,
  submitted_ua TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (access_link_id) REFERENCES access_links(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

#### usage_events
```sql
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT,
  event_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  domain TEXT,
  url TEXT,
  pages_count INTEGER,
  word_count INTEGER,
  estimated_cost_usd REAL,
  feature TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

#### subsidy_cache
```sql
CREATE TABLE subsidy_cache (
  id TEXT PRIMARY KEY,                          -- Jグランツの補助金ID
  source TEXT NOT NULL DEFAULT 'jgrants',
  title TEXT NOT NULL,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  target_area_search TEXT,
  target_industry TEXT,
  target_number_of_employees TEXT,
  acceptance_start_datetime TEXT,
  acceptance_end_datetime TEXT,
  request_reception_display_flag INTEGER,
  detail_json TEXT,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
)
```

### A-2. JGRANTS_MODE 設定

| 値 | 動作 |
|----|------|
| `live` | JグランツAPIにリアルタイム問い合わせ |
| `mock` | モックデータを返す |
| `cached-only` | **本番推奨**: subsidy_cacheからのみ取得（APIコールなし） |

**本番設定**: `JGRANTS_MODE=cached-only`

---

## B. 権限・認可の凍結

### B-1. 正テーブルの決定

| 用途 | 正テーブル | 非推奨 |
|------|-----------|--------|
| ユーザー⇔企業の紐付け | `user_companies` | `company_memberships` |

### B-2. テーブル参照の現状

#### ✅ 正しく `user_companies` を参照
- `src/middleware/auth.ts:169` - requireCompanyAccess
- `src/routes/companies.ts:48` - 企業一覧取得
- `src/routes/admin.ts:214` - 管理画面

#### ⚠️ `company_memberships` を参照（要修正）
- `src/routes/companies.ts:219` - 企業更新時の権限チェック
- `src/routes/companies.ts:335` - 企業削除時の権限チェック
- `src/routes/jobs.ts:59` - ジョブ実行権限
- `src/routes/jobs.ts:210` - ジョブ実行権限
- `src/routes/profile.ts:36` - プロフィール取得
- `src/routes/chat.ts:69` - チャット権限
- `src/routes/admin-dashboard.ts:1363` - ダッシュボード統計
- `src/routes/admin-dashboard.ts:1379` - ダッシュボード統計

### B-3. 修正方針

**すべての `company_memberships` 参照を `user_companies` に統一する**

```sql
-- 修正パターン
-- Before
SELECT role FROM company_memberships WHERE user_id = ? AND company_id = ?

-- After
SELECT role FROM user_companies WHERE user_id = ? AND company_id = ?
```

---

## C. DBスキーマ凍結

### C-1. PKの明記

| テーブル | PK | 注意事項 |
|----------|-----|----------|
| users | id (TEXT) | UUID |
| companies | id (TEXT) | UUID |
| company_profile | **company_id** | ⚠️ `id` カラムは存在しない |
| user_companies | (user_id, company_id) | 複合PK |
| agencies | id (TEXT) | UUID |
| agency_members | id (TEXT) | UUID |
| agency_clients | id (TEXT) | UUID |
| access_links | id (TEXT) | UUID |
| intake_submissions | id (TEXT) | UUID |

### C-2. 存在しないカラム参照チェック

現状の実装で問題なし:
- `company_profile` へのUPDATE/INSERTは `company_id` を使用している

---

## D. API契約の凍結

### D-1. 主要APIレスポンス

#### GET /api/auth/me
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "ユーザー名",
      "role": "user | agency | admin | super_admin"
    }
  }
}
```

#### GET /api/companies
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "id": "uuid",
        "name": "企業名",
        "prefecture": "13",
        "industry_major": "E",
        "employee_count": 50
      }
    ]
  }
}
```

#### GET /api/subsidies/search
```json
{
  "success": true,
  "data": {
    "subsidies": [...],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /api/companies/:id/completeness（新規追加・凍結仕様v1）
```json
{
  "success": true,
  "data": {
    "status": "OK | NEEDS_RECOMMENDED | BLOCKED",
    "required": {
      "name": true,
      "prefecture": true,
      "industry_major": true,
      "employee_count": true
    },
    "recommended": {
      "city": false,
      "capital": true,
      "established_date": false,
      "annual_revenue": false,
      "representative_name": true,
      "website_url": false
    },
    "missing_required": [],
    "missing_recommended": ["市区町村", "設立日", "年商", "Webサイト"],
    "required_count": 4,
    "required_filled": 4,
    "recommended_count": 6,
    "recommended_filled": 2,
    "benefits": [
      "市区町村を入力すると、地域限定の補助金がより正確にマッチします",
      "設立日を入力すると、創業〇年以内の補助金がマッチします"
    ]
  }
}
```

**凍結ルール（従業員数必須）**:
- `employee_count > 0` が必須
- 必須4項目が揃わないと `status: BLOCKED`（検索不可）
- `NEEDS_RECOMMENDED` でも検索は可能（精度向上の推奨のみ）

#### GET /api/agency/clients
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "uuid",
        "company_id": "uuid",
        "client_name": "顧客名",
        "company_name": "企業名",
        "status": "active",
        "prefecture": "13",
        "industry": "製造業"
      }
    ]
  }
}
```

#### GET /api/agency/clients/:id
```json
{
  "success": true,
  "data": {
    "client": {...},
    "company": {...},
    "profile": {...},
    "links": [...],
    "submissions": [...],
    "drafts": [...],
    "chatSessions": [...]
  }
}
```

---

## E. UI共通土台凍結

### E-1. apiCall定義ルール

1. `window.apiCall` は **必ず `<head>` 内で定義**
2. 全UIで同一の実装を使用
3. 401エラーで自動ログアウト

### E-2. イベントハンドラルール

1. `onclick="..."` で呼ぶ関数は **window に公開**
2. ページ固有スクリプトは **DOMContentLoaded で開始**

---

## F. Agency機能MVP凍結

### F-1. 顧客管理
- [x] `/agency/clients` 一覧表示
- [x] `/agency/clients/:id` 詳細表示（⚠️ 今回追加）
- [x] 顧客の状態表示（active/paused/archived）

### F-2. リンク発行
- [x] `/agency/links` 一覧表示
- [x] リンク発行モーダル（⚠️ 今回追加）
- [x] リンクコピー機能
- [x] リンク取り消し機能

### F-3. 受付管理
- [x] `/agency/submissions` 一覧表示
- [x] 詳細モーダル（payload表示）
- [x] 承認→companies/company_profile更新

### F-4. 補助金検索導線
- [ ] `/agency/search` 新設（一般 `/subsidies` と分離）

---

## G. データ収集凍結

### G-1. mock/real 切替点

- `JGRANTS_MODE` 環境変数で制御
- 本番は `cached-only` 固定

### G-2. subsidy_cache 最小必須カラム

| カラム | 必須 | 検索に使用 |
|--------|------|-----------|
| id | ✅ | ✅ |
| title | ✅ | ✅ |
| target_area_search | ✅ | ✅ |
| target_industry | ✅ | ✅ |
| target_number_of_employees | ✅ | ✅ |
| acceptance_end_datetime | ✅ | ✅ |

---

## H. SendGrid凍結

### H-1. 環境変数

| 変数 | 設定値 |
|------|--------|
| SENDGRID_API_KEY | ⚠️ **要ローテーション** |
| SENDGRID_FROM_EMAIL | info@hojyokintekiyou.com |

### H-2. 送信失敗時の挙動

1. ログに `[EMAIL] SendGrid error: ...` を出力
2. UIに失敗を表示
3. 「リンクをコピーして手動共有」に誘導

---

## 修正タスク一覧

### 優先度: 緊急（セキュリティ）

| # | タスク | 状態 |
|---|--------|------|
| H-1 | SendGrid APIキーローテーション | ⬜ 未着手 |

### 優先度: 高（データ不整合リスク）

| # | タスク | 状態 |
|---|--------|------|
| B-2 | company_memberships → user_companies 統一 | ⬜ 未着手 |

### 優先度: 中（機能不全）

| # | タスク | 状態 |
|---|--------|------|
| F-4 | /agency/search 新設 | ⬜ 未着手 |
| H-2 | SendGrid送信ログ確認・修正 | ⬜ 未着手 |

---

## 検証SQL

### テーブル存在確認
```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

### ユーザーロール分布
```sql
SELECT role, COUNT(*) as count FROM users GROUP BY role;
```

### company_memberships / user_companies 件数比較
```sql
SELECT 'company_memberships' as tbl, COUNT(*) as cnt FROM company_memberships
UNION ALL
SELECT 'user_companies' as tbl, COUNT(*) as cnt FROM user_companies;
```

### agency_clients と companies の整合性
```sql
SELECT ac.id, ac.company_id, c.id as company_exists
FROM agency_clients ac
LEFT JOIN companies c ON ac.company_id = c.id
WHERE c.id IS NULL;
```

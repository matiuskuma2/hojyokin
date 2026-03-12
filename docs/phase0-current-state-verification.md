# Phase 0: 現況確定 - 項目差分マトリクス / 正規スキーマ / 影響マップ

> 作成日: 2026-03-12
> 目的: 実装前にSSOT（Single Source of Truth）を確定し、3つの入力経路の全項目を照合

---

## 成果物 1: 項目差分マトリクス（Save-Diff Matrix）

### 1-A. `companies` テーブル カラム一覧（0099_reconcile 確定）

| # | カラム名 | 型 | 法人UI (profile.ts) | 士業UI (agency/clients.ts) | URL intake (portal.ts) | 承認反映 (submissions.ts) | intake_field_mappings | SSOT参照 (getCompanySSOT) | screening参照 | 完成度チェック |
|---|---------|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | id | TEXT PK | - | - | - | - | - | o | o | - |
| 2 | name | TEXT NOT NULL | W | W (POST) | -(payload) | W (name/companyName) | company_name -> name | o | o | **o (必須)** |
| 3 | postal_code | TEXT | W | **x** | -(payload) | **x** | **x** | o | - | - |
| 4 | prefecture | TEXT NOT NULL | W | W (POST/PUT) | -(payload) | W | prefecture -> prefecture | o | **o (critical)** | **o (必須)** |
| 5 | city | TEXT | W | **x** | -(payload) | W | city -> city | o | - | o (推奨) |
| 6 | industry_major | TEXT NOT NULL | W | W (POST/PUT) | -(payload) | W (industry/industry_major) | industry -> industry_major | o | **o (critical)** | **o (必須)** |
| 7 | industry_minor | TEXT | W | W (PUT company) | - | W | **x** | o | o | - |
| 8 | employee_count | INTEGER NOT NULL | W | W (POST/PUT) | -(payload) | W + band auto | employee_count -> employee_count | o | **o (critical)** | **o (必須)** |
| 9 | employee_band | TEXT NOT NULL | W | W (auto-calc) | - | W (auto-calc) | **x** | o | o | - |
| 10 | capital | INTEGER | W | **x** | -(payload) | W | capital -> capital | o | **o (important)** | o (推奨) |
| 11 | established_date | TEXT | W | **x** | -(payload) | W (founded_date) | founded_date -> established_date | o | - | o (推奨) |
| 12 | annual_revenue | INTEGER | W | **x** | -(payload) | W (annual_revenue) | annual_revenue -> annual_revenue | o | - | o (推奨) |

**凡例**: W=読み書き可, R=読み取りのみ, x=未対応, -(payload)=JSON自由形式で送信可（構造化されていない）, o=参照

### 1-B. `company_profile` テーブル カラム一覧（0099_reconcile + 0125_chat_quality 確定）

| # | カラム名 | 型 | 法人UI (profile.ts) | 士業UI (agency/clients.ts) | URL intake (portal.ts) | 承認反映 (submissions.ts) | intake_field_mappings | fact-sync反映 | SSOT参照 | screening参照 | 完成度チェック |
|---|---------|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | company_id | TEXT PK/FK | - | - | - | - | - | - | o | - | - |
| 2 | corp_number | TEXT | W | **x** | - | **x** | **x** | - | o | - | - |
| 3 | corp_type | TEXT | W | **x** | - | **x** | **x** | W (fact-sync) | o | - | o (推奨) |
| 4 | representative_name | TEXT | W | **W** | -(payload) | W | representative_name | - | - | - | o (推奨) |
| 5 | representative_title | TEXT | W | **x** | - | W | **x** | - | - | - | - |
| 6 | founding_year | INTEGER | W | **x** | - | **x** | **x** | W (fact-sync) | o | **o (important)** | - |
| 7 | founding_month | INTEGER | W | **x** | - | **x** | **x** | - | o | - | - |
| 8 | website_url | TEXT | W | **W** | - | W | **x** | - | - | - | - |
| 9 | contact_email | TEXT | W | **W** | - | W | contact_email | - | - | - | - |
| 10 | contact_phone | TEXT | W | **W** | - | W | contact_phone | - | - | - | - |
| 11 | business_summary | TEXT | W | **W** | -(payload) | W | business_summary | W (fact-sync) | o | - | **o (推奨 w=8)** |
| 12 | main_products | TEXT | W | **x** | - | W | **x** | - | o | - | - |
| 13 | main_customers | TEXT | W | **x** | - | W | **x** | - | o | - | - |
| 14 | competitive_advantage | TEXT | W | **x** | - | W | **x** | - | - | - | - |
| 15 | fiscal_year_end | INTEGER | W | **x** | - | **x** | fiscal_year_end | - | o | - | - |
| 16 | is_profitable | INTEGER | W | **x** | - | **x** | **x** | - | o | o | **o (推奨 w=5)** |
| 17 | has_debt | INTEGER | W | **x** | - | **x** | **x** | - | o | - | - |
| 18 | past_subsidies_json | TEXT | W | **x** | - | **x** | **x** | W (fact-sync) | o | o | o (optional) |
| 19 | desired_investments_json | TEXT | W | **x** | - | **x** | **x** | - | - | - | - |
| 20 | current_challenges_json | TEXT | W | **x** | - | **x** | **x** | W (fact-sync) | - | - | - |
| 21 | has_young_employees | INTEGER | W | **x** | - | **x** | **x** | - | o | o | o (optional) |
| 22 | has_female_executives | INTEGER | W | **x** | - | **x** | **x** | - | o | o | o (optional) |
| 23 | has_senior_employees | INTEGER | W | **x** | - | **x** | **x** | - | o | o | o (optional) |
| 24 | plans_to_hire | INTEGER | W | **x** | - | **x** | **x** | W (fact-sync) | o | o | o (optional) |
| 25 | certifications_json | TEXT | W | **x** | - | **x** | **x** | W (fact-sync) | o | o | o (optional) |
| 26 | constraints_json | TEXT | W | **x** | - | **x** | **x** | W (fact-sync) | - | - | - |
| 27 | notes | TEXT | W | **x** | - | **x** | **x** | - | - | - | - |
| 28 | postal_code | TEXT | - | **x** | - | **x** | postal_code | - | - | - | - |
| 29 | address | TEXT | - | **x** | -(payload) | **x** | address | - | - | - | - |
| 30 | contact_name | TEXT | - | **x** | - | **x** | contact_name | - | - | - | - |
| 31 | products_services | TEXT | - | **x** | - | **x** | products_services | - | - | - | - |
| 32 | target_customers | TEXT | - | **x** | - | **x** | target_customers | - | - | - | - |

### 1-C. `chat_facts` 関連キー一覧

| # | fact_key | profile.ts (法人UIで保存) | fact-sync.ts (→DB反映先) | getCompanySSOT | screening参照 | 士業UIで設定可 | intake で設定可 |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | has_gbiz_id | W | -> certifications_json | o (facts) | o (optional) | **x** | **x** |
| 2 | is_invoice_registered | W | **x** (反映なし) | o (facts) | o (optional) | **x** | **x** |
| 3 | plans_wage_raise | W | -> plans_to_hire (!) | o (facts) | o (optional) | **x** | **x** |
| 4 | tax_arrears | W | -> constraints_json | o (facts) | o | **x** | **x** |
| 5 | has_business_plan | W | **x** (反映なし) | o (facts) | o | **x** | **x** |
| 6 | has_keiei_kakushin | W | **x** (反映なし) | o (facts) | o | **x** | **x** |
| 7 | has_jigyou_keizoku | W | **x** (反映なし) | o (facts) | o | **x** | **x** |
| 8 | employee_count | (via chat) | -> companies.employee_count | o (companies) | o | - | - |
| 9 | annual_revenue | (via chat) | -> companies.annual_revenue | o (companies) | - | - | - |
| 10 | capital | (via chat) | -> companies.capital | o (companies) | o | - | - |
| 11 | business_purpose | (via chat) | -> company_profile.business_summary | o (profile) | - | - | - |
| 12 | current_challenge | (via chat) | -> current_challenges_json | - | - | - | - |
| 13 | is_wage_raise_planned | (via chat) | -> plans_to_hire (!) | o (facts) | - | - | - |
| 14 | past_subsidy_same_type | (via chat) | -> past_subsidies_json | o (facts) | o | - | - |
| 15 | founding_year | (via chat) | -> company_profile.founding_year | o (profile) | o | - | - |
| 16 | corp_type | (via chat) | -> company_profile.corp_type | o (profile) | - | - | - |

### 1-D. `company_documents` テーブル

| 機能 | 法人UI (profile.ts) | 士業UI (agency/) | URL intake (portal.ts) |
|------|:---:|:---:|:---:|
| アップロード | o (POST /documents) | **x** | **x** |
| 一覧取得 | o (GET /documents) | **x** (GET /clients/:id で関連なし) | **x** |
| 削除 | o (DELETE /documents/:id) | **x** | **x** |
| テキスト保存 | o (POST /documents/:id/text) | **x** | **x** |
| 抽出→反映 | o (POST /documents/:id/extract, /apply) | **x** | **x** |

---

## 成果物 2: 正規スキーマ定義書（Canonical Schema）

### 2-A. DB列存在状況 — 検証結果

**検証方法**: `0099_reconcile_schema.sql` の CREATE TABLE（これが新環境の正テーブル定義）+ 後続 ALTER TABLE の照合

| 確認項目 | 結果 | 根拠 |
|---------|------|------|
| `company_profile.postal_code` | **存在する** | 0099 reconcile L375 に含まれている |
| `company_profile.address` | **存在する** | 0099 reconcile L376 に含まれている |
| `company_profile.contact_name` | **存在する** | 0099 reconcile L377 に含まれている |
| `company_profile.products_services` | **存在する** | 0099 reconcile L378 に含まれている |
| `company_profile.target_customers` | **存在する** | 0099 reconcile L379 に含まれている |
| `company_profile.fiscal_year_end` | **INTEGER で存在** | 0099 reconcile L363。0020 のコメントアウト版は TEXT だが reconcile では INTEGER |
| `intake_submissions.validation_errors_json` | **存在する** | 0099 reconcile L614 に含まれている |
| `intake_submissions.source_template_id` | **存在する** | 0099 reconcile L615 に含まれている |
| `access_links.template_id` | **存在する** | 0099 reconcile L588 に含まれている |
| `chat_facts.fact_type` | **存在する** | 0125 ALTER TABLE L16 |
| `chat_facts.metadata` | **存在する** | 0125 ALTER TABLE L17 |
| `chat_facts.fact_category` | **存在する** | 0125 ALTER TABLE L24 |
| `company_documents.session_id` | **存在する** | 0125 ALTER TABLE L33 |
| `company_documents.uploaded_via` | **存在する** | 0125 ALTER TABLE L34 |

**結論**: 0020 のコメントアウトされた ALTER TABLE は**すべて 0099_reconcile で吸収済み**。本番DBとの差異はない。

### 2-B. 正規テーブル定義（実カラム完全リスト）

#### `companies` テーブル（12カラム + 2 timestamps）
```
id, name, postal_code, prefecture, city, industry_major, industry_minor,
employee_count, employee_band, capital, established_date, annual_revenue,
created_at, updated_at
```

#### `company_profile` テーブル（32カラム + 2 timestamps）
```
company_id(PK/FK), corp_number, corp_type, representative_name, representative_title,
founding_year, founding_month, website_url, contact_email, contact_phone,
business_summary, main_products, main_customers, competitive_advantage,
fiscal_year_end(INTEGER), is_profitable, has_debt,
past_subsidies_json, desired_investments_json, current_challenges_json,
has_young_employees, has_female_executives, has_senior_employees, plans_to_hire,
certifications_json, constraints_json, notes,
postal_code, address, contact_name, products_services, target_customers,
updated_at, created_at
```

#### `chat_facts` テーブル（13カラム + 2 timestamps）
```
id(PK), user_id(FK), company_id(FK), subsidy_id,
fact_key, fact_value, confidence, source, session_id,
fact_type, metadata, fact_category,
created_at, updated_at
```
- UNIQUE INDEX: `(company_id, subsidy_id, fact_key)`

#### `company_documents` テーブル（14カラム + 2 timestamps）
```
id(PK), company_id(FK), doc_type, original_filename, content_type,
size_bytes, storage_backend, r2_key, status, extracted_json,
confidence, raw_text, session_id, uploaded_via,
uploaded_at, updated_at
```

#### `intake_field_mappings` テーブル（現行 18 レコード）
```
ifm_001: company_name -> companies.name (basic)
ifm_002: representative_name -> company_profile.representative_name (basic)
ifm_003: founded_date -> companies.established_date (basic)
ifm_004: employee_count -> companies.employee_count (basic)
ifm_010: prefecture -> companies.prefecture (location)
ifm_011: city -> companies.city (location)
ifm_012: address -> company_profile.address (location)
ifm_013: postal_code -> company_profile.postal_code (location)
ifm_020: industry -> companies.industry_major (business)
ifm_021: business_summary -> company_profile.business_summary (business)
ifm_022: products_services -> company_profile.products_services (business)
ifm_023: target_customers -> company_profile.target_customers (business)
ifm_030: capital -> companies.capital (financial)
ifm_031: annual_revenue -> company_profile.annual_revenue (financial) ← ★要注意: companies.annual_revenue が正しいはず
ifm_032: fiscal_year_end -> company_profile.fiscal_year_end (financial)
ifm_040: contact_name -> company_profile.contact_name (contact)
ifm_041: contact_email -> company_profile.contact_email (contact)
ifm_042: contact_phone -> company_profile.contact_phone (contact)
```

### 2-C. 発見された不整合・リスク

| # | 問題 | 深刻度 | 詳細 |
|---|------|--------|------|
| **BUG-1** | `intake_field_mappings` の `annual_revenue` が `company_profile` を指している | HIGH | ifm_031 の target_table が `company_profile` だが、`annual_revenue` カラムは `companies` テーブルにある。`company_profile` にはこのカラムは存在しない。intake承認時に反映されない可能性。 |
| **BUG-2** | `fact-sync.ts` の `is_wage_raise_planned` が `plans_to_hire` にマップ | MEDIUM | 賃上げ計画（wage raise）と採用予定（hire）は意味が異なる。profile.ts では `plans_wage_raise` として chat_facts に保存し、fact-sync は `is_wage_raise_planned` → `plans_to_hire` に変換。semanticミスマッチ。 |
| **GAP-1** | 士業UIが `company_profile` の大半を更新不可 | HIGH | 32カラム中、士業が書けるのは 5 つのみ（representative_name, website_url, contact_email, contact_phone, business_summary）。残り 27 カラムは **法人UIのみ** からアクセス可能。 |
| **GAP-2** | 士業UIが `companies` の基本項目を一部更新不可 | HIGH | `postal_code`, `capital`, `established_date`, `annual_revenue` は PUT /clients/:id/company に未定義。 |
| **GAP-3** | 士業UIに `chat_facts` の設定機能がない | HIGH | 加点要素（GビズID、インボイス、賃上げ、経営革新等）7項目がすべて未対応。マッチングスコアに直接影響。 |
| **GAP-4** | 士業UIに書類アップロード機能がない | MEDIUM | `company_documents` への CRUD が完全に未実装。法人UIには完備。 |
| **GAP-5** | URL intake が構造化フォームではなく自由 JSON | MEDIUM | `portal.ts` の POST /intake は `payload_json` に何でも入れられる。`intake_field_mappings` が SSOT として参照されていない。 |
| **GAP-6** | `intake_field_mappings` が SSOT として機能していない | HIGH | 現行コードで `intake_field_mappings` テーブルをRUNTIMEで SELECT して使っている箇所が **ゼロ**。submissions.ts の承認はハードコードされたフィールドマッピング。テンプレートの fields_json もハードコード。 |
| **GAP-7** | 完成度計算ロジックが法人UIにしか存在しない | MEDIUM | profile.ts の COMPLETENESS_FIELDS は士業側に共有されていない。agency/clients.ts は必須4項目（name, prefecture, industry, employee_count）のみチェック。 |
| **GAP-8** | 0099 reconcile と profile.ts の company_profile フィールドに差異 | LOW | profile.ts の PUT は `postal_code`, `address`, `contact_name`, `products_services`, `target_customers` を profileFields に含んでいない（0020追加分）。法人UIからもこれらは更新不可。 |
| **RISK-1** | `company_documents` の所有権チェック | INFO | 法人UIは company_id で所有権確認。士業が書類をアップロードする場合、agency_clients 経由の company_id チェックが必要。 |

---

## 成果物 3: ルート/テーブル/マイグレーション/UI 影響マップ

### 3-A. 入力パス別 ルート一覧

```
┌───────────────────────────────────────────────────────────────────┐
│                     3つの入力パス                                  │
├──────────────┬──────────────────┬─────────────────────────────────┤
│ 法人アカウント    │ 士業アカウント       │ URL intake (顧客ポータル)          │
│ (profile.ts)   │ (agency/clients.ts) │ (portal.ts + submissions.ts)    │
├──────────────┼──────────────────┼─────────────────────────────────┤
│ PUT /profile   │ POST /clients      │ POST /portal/intake              │
│   → companies  │   → companies      │   → intake_submissions           │
│   → co_profile │   → co_profile     │     (payload_json as blob)       │
│   → chat_facts │   (empty row only) │                                  │
│                │                    │ submissions/:id/approve           │
│                │ PUT /clients/:id   │   → companies                    │
│                │   → agency_clients │   → co_profile                   │
│                │                    │     (hardcoded field mapping)     │
│                │ PUT /clients/:id   │                                  │
│                │   /company         │                                  │
│                │   → companies      │                                  │
│                │   → co_profile     │                                  │
│                │     (5 fields only)│                                  │
├──────────────┼──────────────────┼─────────────────────────────────┤
│ Documents:     │ Documents:         │ Documents:                       │
│ POST /docs     │ **x** 未実装       │ **x** 未実装                     │
│ GET /docs      │                    │                                  │
│ DELETE /docs   │                    │                                  │
│ extract/apply  │                    │                                  │
├──────────────┼──────────────────┼─────────────────────────────────┤
│ Facts:         │ Facts:             │ Facts:                           │
│ PUT /profile   │ **x** 未実装       │ **x** 未実装                     │
│ (facts obj)    │                    │                                  │
├──────────────┼──────────────────┼─────────────────────────────────┤
│ Completeness:  │ Completeness:      │ Completeness:                    │
│ GET /profile/  │ 必須4項目のみ       │ **x** 未実装                     │
│ completeness   │ (inline計算)       │                                  │
│ (16項目+書類)  │                    │                                  │
└──────────────┴──────────────────┴─────────────────────────────────┘
```

### 3-B. 補助金マッチング・検索が**実際に読むテーブルとカラム**

```
getCompanySSOT.ts (マッチング入力の正規化)
  ├── SELECT FROM companies
  │     id, name, postal_code, prefecture, city,
  │     industry_major, industry_minor, employee_count, employee_band,
  │     capital, established_date, annual_revenue
  │
  ├── SELECT FROM company_profile
  │     corp_number, corp_type, founding_year, founding_month,
  │     is_profitable, has_debt, past_subsidies_json, certifications_json,
  │     plans_to_hire, has_young_employees, has_female_executives,
  │     has_senior_employees, business_summary, main_products, main_customers
  │
  └── SELECT FROM chat_facts
        fact_key, fact_value WHERE company_id=? AND subsidy_id=?
        
screening-v2.ts (一次スクリーニング) 読み取り項目:
  [critical]  prefecture, industry_major, employee_count
  [important] capital, founding_year
  [facts]     has_gbiz_id, is_invoice_registered, plans_wage_raise,
              tax_arrears, past_subsidy_same_type, has_business_plan,
              has_keiei_kakushin, has_jigyou_keizoku
  [profile]   is_profitable, past_subsidies, certifications,
              has_young_employees, has_female_executives,
              has_senior_employees, plans_to_hire
```

### 3-C. 必要な変更の影響マップ（実装前チェックリスト）

| 変更項目 | 影響ファイル | テーブル変更 | マイグレーション | リスク |
|---------|------------|:---:|:---:|------|
| 士業 PUT /company に全フィールド追加 | `agency/clients.ts` | なし | なし | 低 - 既存カラムへの書き込み追加のみ |
| 士業に chat_facts CRUD 追加 | `agency/clients.ts` (新エンドポイント) | なし | なし | 低 - 既存テーブルへの INSERT/UPDATE |
| 士業に書類アップロード追加 | 新ファイル or `agency/clients.ts` | なし | なし | 中 - R2アクセス権・所有権チェック必要 |
| intake_field_mappings をランタイムSSOT化 | `portal.ts`, `submissions.ts`, 新 shared module | なし | INSERT OR IGNORE (追加マッピング) | 中 - 既存承認フローのリファクタ |
| 完成度ロジック共通化 | 新 shared module, `profile.ts`, `agency/clients.ts` | なし | なし | 低 - ロジック抽出 |
| intake_field_mappings 追加行 | - | なし | INSERT OR IGNORE | 低 - 既存データ不変 |
| BUG-1 修正: annual_revenue mapping | `0099_reconcile` or 新migration | INSERT OR IGNORE | 新migration | 低 - データ修正のみ |
| profile.ts に 0020追加カラム対応 | `profile.ts` | なし | なし | 低 - profileFields配列に追加 |

---

## 技術リスク検証（実装前 5 つの確認事項）

### 確認 1: 実DB列の存在
**結論: 問題なし** — 0099_reconcile が全列を含んでおり、0020 のコメントアウト ALTER TABLE は吸収済み。本番DBとの差異なし。

### 確認 2: intake_field_mappings が真の SSOT として機能しているか
**結論: 機能していない** — ランタイムでこのテーブルを SELECT するコードが存在しない。submissions.ts のフィールドマッピングはハードコード。テンプレートの fields_json もハードコード。**Phase 2 で SSOT 化が必要**。

### 確認 3: chat_facts の更新責任
**結論: 3つの更新パスが存在**
1. `profile.ts` PUT /profile の facts オブジェクト → 法人ユーザーが直接設定
2. `fact-sync.ts` syncFactsToProfile → チャットの回答から自動反映
3. `portal.ts` POST /answer → 顧客ポータルからの回答

士業側からは **どのパスも利用できない**。

### 確認 4: company_documents の所有権ルール
**結論: company_id ベース** — 法人UIは `company_memberships` 経由で company_id を取得し、documents の CRUD で `WHERE company_id = ?` でチェック。士業は `agency_clients.company_id` 経由で同じ company_id を取得可能。所有権チェックロジックは流用可能。

**追加考慮**: `uploaded_via` カラム（0125追加）で 'agency' を追加し、誰がアップロードしたか追跡可能にすべき。

### 確認 5: マッチング/検索が実際に読むテーブル
**結論: `getCompanySSOT.ts` が唯一の入力正規化レイヤー** — `screening-v2.ts` は `CompanySSOT` 型のみを受け取る。つまり、`companies`, `company_profile`, `chat_facts` の3テーブルに正しくデータが入っていれば、どの経路から入力されても同じマッチング結果になる。

---

## 推奨実装順序（修正版）

| Phase | 内容 | スキーマ変更 | リスク | 効果 |
|-------|------|:---:|:---:|------|
| **1a** | 士業 PUT /company に全カラム追加 | なし | 低 | 即効: 士業がマッチングに必要な全情報を入力可能に |
| **1b** | 士業に chat_facts 設定エンドポイント追加 | なし | 低 | 加点要素がスコアに反映 |
| **1c** | BUG-1 修正 + profile.ts に 0020 カラム追加 | migration (INSERT OR IGNORE) | 低 | データ整合性回復 |
| **2a** | 完成度計算ロジック共通化 | なし | 低 | 士業/法人で統一された完成度表示 |
| **2b** | 士業に書類アップロード機能追加 | なし | 中 | 書類からのデータ抽出が士業でも可能に |
| **3a** | intake_field_mappings のランタイム SSOT 化 | migration (追加行) | 中 | 動的テンプレート生成の基盤 |
| **3b** | URL intake のフォーム構造化 | なし | 中 | intake の品質向上 |
| **4** | 承認フローの統一リファクタ | なし | 中 | submissions.ts のハードコード解消 |

---

## 付録: intake_field_mappings に追加すべき項目

現行 18 行 → 提案追加項目（`company_profile` の全カラム + facts カバー）:

```sql
-- 追加候補（INSERT OR IGNORE で安全に追加）
INSERT OR IGNORE INTO intake_field_mappings (id, field_key, label_ja, input_type, target_table, target_column, category, sort_order) VALUES
  ('ifm_050', 'corp_number', '法人番号', 'text', 'company_profile', 'corp_number', 'basic', 15),
  ('ifm_051', 'corp_type', '法人種別', 'select', 'company_profile', 'corp_type', 'basic', 16),
  ('ifm_052', 'representative_title', '代表者肩書', 'text', 'company_profile', 'representative_title', 'basic', 21),
  ('ifm_053', 'founding_year', '創業年', 'number', 'company_profile', 'founding_year', 'basic', 32),
  ('ifm_054', 'founding_month', '創業月', 'number', 'company_profile', 'founding_month', 'basic', 33),
  ('ifm_055', 'industry_minor', '業種（小分類）', 'text', 'companies', 'industry_minor', 'business', 85),
  ('ifm_060', 'main_products', '主な製品・サービス', 'textarea', 'company_profile', 'main_products', 'business', 101),
  ('ifm_061', 'main_customers', '主要顧客', 'textarea', 'company_profile', 'main_customers', 'business', 102),
  ('ifm_062', 'competitive_advantage', '競合優位性', 'textarea', 'company_profile', 'competitive_advantage', 'business', 103),
  ('ifm_070', 'is_profitable', '直近期黒字/赤字', 'select', 'company_profile', 'is_profitable', 'financial', 141),
  ('ifm_071', 'has_debt', '借入金の有無', 'select', 'company_profile', 'has_debt', 'financial', 142),
  ('ifm_080', 'has_young_employees', '若年従業員の有無', 'select', 'company_profile', 'has_young_employees', 'hr', 200),
  ('ifm_081', 'has_female_executives', '女性役員の有無', 'select', 'company_profile', 'has_female_executives', 'hr', 201),
  ('ifm_082', 'has_senior_employees', 'シニア従業員の有無', 'select', 'company_profile', 'has_senior_employees', 'hr', 202),
  ('ifm_083', 'plans_to_hire', '採用予定', 'select', 'company_profile', 'plans_to_hire', 'hr', 203),
  ('ifm_090', 'has_gbiz_id', 'GビズIDプライム', 'select', 'chat_facts', 'has_gbiz_id', 'certification', 300),
  ('ifm_091', 'is_invoice_registered', 'インボイス登録', 'select', 'chat_facts', 'is_invoice_registered', 'certification', 301),
  ('ifm_092', 'plans_wage_raise', '賃上げ予定', 'select', 'chat_facts', 'plans_wage_raise', 'certification', 302),
  ('ifm_093', 'has_keiei_kakushin', '経営革新計画', 'select', 'chat_facts', 'has_keiei_kakushin', 'certification', 303),
  ('ifm_094', 'has_jigyou_keizoku', '事業継続力強化計画', 'select', 'chat_facts', 'has_jigyou_keizoku', 'certification', 304);
```

> **注意**: target_table が `chat_facts` の項目は、通常のカラムマッピングではなく、fact_key/fact_value への UPSERT が必要。承認フローのリファクタ時に対応。

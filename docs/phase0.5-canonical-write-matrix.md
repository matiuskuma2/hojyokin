# Phase 0.5: Canonical Write Matrix + Phase 1a 実装前チェックリスト

> 作成日: 2026-03-12  
> 更新日: 2026-03-12（BUG-2 完全修正: キー統一）  
> 前提: Phase 0 の成果物3点（項目差分マトリクス / 正規スキーマ定義書 / 影響マップ）が完了済み  
> BUG-1 修正済み, BUG-2 完全修正済み（キー統一 + フォールバック読み取り実装）

---

## 0. Phase 0 の修正事項

### 「本番DBとの差異なし」の表現修正

Phase 0 で「本番DBとの差異はなし」と記載したが、これは言い切りすぎ。修正：

> **修正後の表現**: コードベース上の reconcile（0099）と migration 系譜では吸収済みに見える。  
> ただし「本番DBとの差異なし」の断定は、実DBスキーマ確認（`PRAGMA table_info(company_profile)` 相当）が取れてから確定とする。  
> ローカル開発用 SQLite は reconcile から生成されるため差異は起きないが、本番 D1 は手動 ALTER の可能性が残る。

### BUG-2 完全修正（第2回 — キー統一）

第1回修正（fact-sync.ts の `is_wage_raise_planned → plans_to_hire` 削除）は正しかったが、不完全だった。

**問題**: チャットが `is_wage_raise_planned` キーで chat_facts に保存するが、`getCompanySSOT.ts` は `plans_wage_raise` しか読まない。
スクリーニングの賃上げ加点が常に null で機能しなかった。

**全6経路の読み書きマップ:**

| # | ファイル | キー | 操作 | 修正前 | 修正後 |
|---|---------|------|------|--------|--------|
| W1 | derived-questions.ts:139 | `is_wage_raise_planned` | チャット質問定義 | ❌ レガシーキー | ✅ `plans_wage_raise` に変更 |
| W2 | chat.ts:1482 | (W1のkeyをそのまま保存) | chat_facts WRITE | ❌ is_wage_raise_planned で保存 | ✅ plans_wage_raise で保存 |
| W3 | profile.ts:296 | `plans_wage_raise` | 法人UI WRITE | ✅ 正準キー | ✅ 変更なし |
| R1 | getCompanySSOT.ts:254 | `plans_wage_raise` | SSOT READ | ❌ フォールバックなし | ✅ `is_wage_raise_planned` フォールバック追加 |
| R2 | screening-v2.ts:845 | `company.facts.plans_wage_raise` | スクリーニング READ | ✅ (SSOT経由) | ✅ 変更なし（R1修正で解決） |
| R3 | draft.ts:597 | `f['is_wage_raise_planned']` | ドラフト READ | ✅ 直接参照で動作 | ✅ `plans_wage_raise` 優先 + フォールバック |

**修正ファイル:**
- `src/lib/derived-questions.ts` — キーを `plans_wage_raise` に変更
- `src/lib/ai-concierge.ts` — ラベルマップにレガシーキーをフォールバック追加
- `src/lib/ssot/getCompanySSOT.ts` — `is_wage_raise_planned` を読み取りフォールバック追加
- `src/routes/draft.ts` — `plans_wage_raise` 優先、レガシーフォールバック追加

**既存データの互換性**: 既存の chat_facts に `is_wage_raise_planned` で保存済みの値は、
getCompanySSOT のフォールバック読み取りで正しく取得される。新規保存は `plans_wage_raise` で行われる。

### BUG-1 影響面の5観点分解

| 観点 | 結果 | 詳細 |
|------|------|------|
| **intake入力時に保持されるか** | **o** | payload_json に入力値がそのまま JSON 保存される。intake_field_mappings は参照されない |
| **submission詳細表示で見えるか** | **o** | payload_json をそのまま表示するため、入力値は見える |
| **approve時に捨てられるか** | **保存される** | submissions.ts の fieldMapping は `'annual_revenue': 'annual_revenue'` でハードコードされており、`companies` テーブルに対する UPDATE 文の中で正しく書き込まれる |
| **SSOT (getCompanySSOT) が参照する先は** | **companies.annual_revenue** | 正しい。company_profile からは読んでいない |
| **法人UI (profile.ts) での参照先は** | **companies.annual_revenue** | profile.ts L227 `companyFields` に含まれ、companies テーブルから読み書き |

**結論**: 現時点で実害はない。ただし Phase 3a で `intake_field_mappings` をランタイム SSOT 化した場合、company_profile.annual_revenue に書き込もうとして失敗する。修正済み（0128_fix_intake_field_mapping_bug.sql）。

---

## 1. Canonical Write Matrix

全データ項目について「どこから来た値が、どこに書かれるべきで、今どうなっていて、いつ直すか」を1枚で示す。

### 1-A. `companies` テーブル書き込みマトリクス

| field | 法人UI route | 士業UI route | URL intake route | 承認反映 route | fact-sync | target table | target column | current status | fix phase |
|-------|:---:|:---:|:---:|:---:|:---:|---|---|---|---|
| name | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve(fieldMapping) | - | companies | name | o 全経路OK | - |
| postal_code | PUT /profile | **x** | -(payload) | **x** | - | companies | postal_code | **GAP: 士業/承認 未対応** | 1a |
| prefecture | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve(fieldMapping) | - | companies | prefecture | o 全経路OK | - |
| city | PUT /profile | **x** | POST /intake(payload) | approve(fieldMapping) | - | companies | city | **GAP: 士業 未対応** | 1a |
| industry_major | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve(fieldMapping) | - | companies | industry_major | o 全経路OK | - |
| industry_minor | PUT /profile | PUT /company | - | approve(fieldMapping) | - | companies | industry_minor | o 士業はPUT /companyで対応済 | - |
| employee_count | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve + band auto | fact-sync | companies | employee_count | o 全経路OK | - |
| employee_band | (auto-calc) | (auto-calc) | - | (auto-calc) | - | companies | employee_band | o 全経路で自動計算 | - |
| capital | PUT /profile | **x** | POST /intake(payload) | approve(fieldMapping) | fact-sync | companies | capital | **GAP: 士業 未対応** | 1a |
| established_date | PUT /profile | **x** | POST /intake(payload) | approve(founded_date) | - | companies | established_date | **GAP: 士業 未対応** | 1a |
| annual_revenue | PUT /profile | **x** | POST /intake(payload) | approve(fieldMapping) | fact-sync | companies | annual_revenue | **GAP: 士業 未対応** | 1a |

### 1-B. `company_profile` テーブル書き込みマトリクス

| field | 法人UI route | 士業UI route | URL intake route | 承認反映 route | fact-sync | target table | target column | current status | fix phase |
|-------|:---:|:---:|:---:|:---:|:---:|---|---|---|---|
| corp_number | PUT /profile | **x** | - | **x** | - | company_profile | corp_number | **GAP: 士業/承認 未対応** | 1a |
| corp_type | PUT /profile | **x** | - | **x** | fact-sync | company_profile | corp_type | **GAP: 士業/承認 未対応** | 1a |
| representative_name | PUT /profile | PUT /company | -(payload) | approve(profileMapping) | - | company_profile | representative_name | o 士業OK | - |
| representative_title | PUT /profile | **x** | - | approve(profileMapping) | - | company_profile | representative_title | **GAP: 士業 未対応** | 1a |
| founding_year | PUT /profile | **x** | - | **x** | fact-sync | company_profile | founding_year | **GAP: 士業/承認 未対応** | 1a |
| founding_month | PUT /profile | **x** | - | **x** | - | company_profile | founding_month | **GAP: 士業/承認 未対応** | 1a |
| website_url | PUT /profile | PUT /company | - | approve(profileMapping) | - | company_profile | website_url | o 士業OK | - |
| contact_email | PUT /profile | PUT /company | - | approve(profileMapping) | - | company_profile | contact_email | o 士業OK | - |
| contact_phone | PUT /profile | PUT /company | - | approve(profileMapping) | - | company_profile | contact_phone | o 士業OK | - |
| business_summary | PUT /profile | PUT /company | -(payload) | approve(profileMapping) | fact-sync | company_profile | business_summary | o 士業OK | - |
| main_products | PUT /profile | **x** | - | approve(profileMapping) | - | company_profile | main_products | **GAP: 士業 未対応** | 1a |
| main_customers | PUT /profile | **x** | - | approve(profileMapping) | - | company_profile | main_customers | **GAP: 士業 未対応** | 1a |
| competitive_advantage | PUT /profile | **x** | - | approve(profileMapping) | - | company_profile | competitive_advantage | **GAP: 士業 未対応** | 1a |
| fiscal_year_end | PUT /profile | **x** | - | **x** | - | company_profile | fiscal_year_end | **GAP: 士業/承認 未対応** | 1a |
| is_profitable | PUT /profile | **x** | - | **x** | - | company_profile | is_profitable | **GAP: 士業/承認 未対応** | 1a |
| has_debt | PUT /profile | **x** | - | **x** | - | company_profile | has_debt | **GAP: 士業/承認 未対応** | 1a |
| past_subsidies_json | PUT /profile | **x** | - | **x** | fact-sync | company_profile | past_subsidies_json | **GAP: 士業/承認 未対応** | 1a |
| desired_investments_json | PUT /profile | **x** | - | **x** | - | company_profile | desired_investments_json | **GAP: 士業/承認 未対応** | 1a |
| current_challenges_json | PUT /profile | **x** | - | **x** | fact-sync | company_profile | current_challenges_json | **GAP: 士業/承認 未対応** | 1a |
| has_young_employees | PUT /profile | **x** | - | **x** | - | company_profile | has_young_employees | **GAP: 士業/承認 未対応** | 1a |
| has_female_executives | PUT /profile | **x** | - | **x** | - | company_profile | has_female_executives | **GAP: 士業/承認 未対応** | 1a |
| has_senior_employees | PUT /profile | **x** | - | **x** | - | company_profile | has_senior_employees | **GAP: 士業/承認 未対応** | 1a |
| plans_to_hire | PUT /profile | **x** | - | **x** | - | company_profile | plans_to_hire | **GAP: 士業/承認 未対応** | 1a |
| certifications_json | PUT /profile | **x** | - | **x** | fact-sync | company_profile | certifications_json | **GAP: 士業/承認 未対応** | 1a |
| constraints_json | PUT /profile | **x** | - | **x** | fact-sync | company_profile | constraints_json | **GAP: 士業/承認 未対応** | 1a |
| notes | PUT /profile | **x** | - | **x** | - | company_profile | notes | **GAP: 士業 未対応** | 1a |
| postal_code (profile) | **x** (※) | **x** | - | **x** | - | company_profile | postal_code | **GAP: 法人UIも未対応** | 1c |
| address | **x** (※) | **x** | -(payload) | **x** | - | company_profile | address | **GAP: 法人UIも未対応** | 1c |
| contact_name | **x** (※) | **x** | - | **x** | - | company_profile | contact_name | **GAP: 法人UIも未対応** | 1c |
| products_services | **x** (※) | **x** | - | **x** | - | company_profile | products_services | **GAP: 法人UIも未対応** | 1c |
| target_customers | **x** (※) | **x** | - | **x** | - | company_profile | target_customers | **GAP: 法人UIも未対応** | 1c |

※ profile.ts の `profileFields` 配列に含まれていない（0020追加カラム）

### 1-C. `chat_facts` 書き込みマトリクス

| fact_key | 法人UI route | 士業UI route | チャット route | URL intake route | target | current status | fix phase |
|---------|:---:|:---:|:---:|:---:|---|---|---|
| has_gbiz_id | PUT /profile (facts) | **x** | derived-questions | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |
| is_invoice_registered | PUT /profile (facts) | **x** | derived-questions | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |
| plans_wage_raise | PUT /profile (facts) | **x** | derived-questions (plans_wage_raise ★修正済) | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |
| tax_arrears | PUT /profile (facts) | **x** | derived-questions | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |
| has_business_plan | PUT /profile (facts) | **x** | derived-questions | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |
| has_keiei_kakushin | PUT /profile (facts) | **x** | derived-questions | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |
| has_jigyou_keizoku | PUT /profile (facts) | **x** | derived-questions | **x** | chat_facts のみ | **GAP: 士業 未対応** | 1b |

### 1-D. `company_documents` 書き込みマトリクス

| operation | 法人UI route | 士業UI route | URL intake route | uploaded_via 値 |
|-----------|:---:|:---:|:---:|---|
| upload (POST) | o (POST /documents) | **x** | **x** | 'direct' |
| list (GET) | o (GET /documents) | **x** | **x** | - |
| delete (DELETE) | o (DELETE /documents/:id) | **x** | **x** | - |
| text save | o (POST /documents/:id/text) | **x** | **x** | - |
| extract | o (POST /documents/:id/extract) | **x** | **x** | - |
| apply to profile | o (POST /documents/:id/apply) | **x** | **x** | - |

---

## 2. テーブル責務境界の明文化

### `companies` テーブル — 基本情報（検索・マッチングの最小単位）

**責務**: 補助金マッチングの一次スクリーニングに必要な**構造化された基本情報**を保持。  
**主キー判定**: prefecture, industry_major, employee_count が critical 3項目。  
**更新権限**: 法人ユーザー / 士業スタッフ / intake承認 / fact-sync / 書類抽出apply のすべて。

| カラム | 責務分類 | マッチング重要度 |
|--------|---------|:---:|
| name | 基本識別 | - |
| postal_code | 所在地詳細 | - |
| prefecture | **マッチング必須** | critical |
| city | 所在地詳細 | - |
| industry_major | **マッチング必須** | critical |
| industry_minor | 業種詳細 | - |
| employee_count | **マッチング必須** | critical |
| employee_band | **派生値**（employee_countから自動計算） | critical(derived) |
| capital | 中小企業判定 | important |
| established_date | 創業枠判定の素材 | - |
| annual_revenue | 企業規模参考 | - |

### `company_profile` テーブル — 詳細属性（加点・書類準備・コンサル用）

**責務**: マッチングの加点判定、書類準備の助言、コンサル支援に使う**詳細属性**を保持。  
**主キー**: company_id (1:1 対応)  
**更新権限**: companies と同じだが、現状は法人UIのみフルアクセス。

| カラム群 | 責務分類 |
|---------|---------|
| corp_number, corp_type | 法人登記情報 |
| representative_name, representative_title | 代表者情報 |
| founding_year, founding_month | 創業情報（screening で important） |
| website_url, contact_email, contact_phone, contact_name | 連絡先 |
| business_summary, main_products, main_customers, competitive_advantage | 事業内容 |
| products_services, target_customers | 事業内容（0020追加） |
| postal_code, address | 住所詳細（0020追加） |
| fiscal_year_end | 決算情報 |
| is_profitable, has_debt | 財務フラグ（screening で参照） |
| past_subsidies_json, desired_investments_json, current_challenges_json | 補助金関連JSON |
| has_young_employees, has_female_executives, has_senior_employees | 雇用フラグ（screening で参照） |
| plans_to_hire | **採用予定**（賃上げ予定とは別概念、BUG-2 修正済み） |
| certifications_json, constraints_json | 認定・制約 |
| notes | 自由メモ |

### `chat_facts` テーブル — 壁打ちチャットの回答 / 加点要素フラグ

**責務**: チャットで収集された情報、および法人UIで設定された加点要素フラグを保持。  
**特徴**: (company_id, subsidy_id, fact_key) でユニーク。subsidy_id が NULL なら企業共通のfact。  
**更新権限**: 法人UI / チャットAI / 顧客ポータル回答 / fact-sync（読み取り→DB反映の方向）

**route別の更新責務（固定）**:

| route | 更新方向 | source値 |
|-------|---------|---------|
| PUT /profile (facts obj) | 法人ユーザーが直接設定 → chat_facts | `user_input` |
| チャットAI (ai-concierge) | AIが質問→回答を保存 → chat_facts | `chat` |
| POST /portal/answer | 顧客ポータルからの回答 → chat_facts | `customer_answer` |
| fact-sync.ts | chat_facts → companies / company_profile への**逆方向反映** | (読み取り元) |
| **士業UI（Phase 1b 追加予定）** | 士業が代理設定 → chat_facts | `agency_input`(新設) |

### `company_documents` テーブル — 書類管理

**責務**: アップロードされた書類のメタデータ・抽出結果を保持。ファイル実体は R2。  
**所有権**: company_id で判定。法人UI は company_memberships 経由、士業は agency_clients 経由。  
**uploaded_via の値（Phase 2b で拡張）**:
- `direct` — 法人UIからのアップロード
- `chat` — 壁打ちチャット経由
- `agency` — 士業UIからのアップロード（Phase 2b 新設予定）
- `portal` — 顧客ポータル経由（Phase 2b 新設予定）

---

## 3. Phase 1a 実装前チェックリスト

### 前提条件（完了済み）

- [x] BUG-2 修正 第1回: `fact-sync.ts` の `is_wage_raise_planned` → `plans_to_hire` マッピング削除
- [x] BUG-2 修正 第2回: 正準キー `plans_wage_raise` への統一（4ファイル修正、フォールバック付き）
- [x] BUG-2 検証: fact-sync.ts の他のfact同期に影響なし確認済み
- [x] BUG-1 修正: `intake_field_mappings` の `annual_revenue` を `companies` に修正
- [x] BUG-1 影響面5観点の分解完了
- [x] BUG-1 検証: annual_revenue の全参照箇所が `companies` テーブルで統一済み確認
- [x] canonical write matrix 作成完了
- [x] `companies` / `company_profile` / `chat_facts` の責務境界を明文化
- [x] `chat_facts` の更新責務を route 単位で固定

### Phase 1a の範囲定義

**目標**: 士業の `PUT /api/agency/clients/:id/company` で、法人UIと同等のフィールドを更新可能にする。

#### 追加するフィールド群（責務別）

**Group A: `companies` テーブルに追加する項目（4項目）**

| field | 追加理由 |
|-------|---------|
| postal_code | 所在地詳細。法人UIでは更新可能 |
| city | 所在地詳細。法人UIでは更新可能。承認フローでも反映される |
| capital | 中小企業判定（screening important）。承認フローでも反映される |
| established_date | 創業枠判定の素材。承認フローでも反映される |
| annual_revenue | 企業規模参考。承認フローでも反映される |

※ city は既に `PUT /company` 未対応（POST /clients でも未対応）だが、承認フローでは反映される不整合あり。

**Group B: `company_profile` テーブルに追加する項目（19項目）**

| field | 追加理由 |
|-------|---------|
| corp_number | 法人登記情報 |
| corp_type | 法人登記情報 |
| representative_title | 代表者情報 |
| founding_year | screening important |
| founding_month | 創業情報 |
| main_products | 事業内容 |
| main_customers | 事業内容 |
| competitive_advantage | 事業内容 |
| fiscal_year_end | 決算情報 |
| is_profitable | screening 参照 |
| has_debt | 財務フラグ |
| past_subsidies_json | 補助金関連 |
| desired_investments_json | 補助金関連 |
| current_challenges_json | 補助金関連 |
| has_young_employees | screening 参照 |
| has_female_executives | screening 参照 |
| has_senior_employees | screening 参照 |
| plans_to_hire | screening 参照（**採用予定のみ。賃上げ予定とは別**） |
| certifications_json | screening 参照 |
| constraints_json | 制約情報 |
| notes | 自由メモ |

**Phase 1a に含めないもの:**

| 除外項目 | 理由 | 対応Phase |
|---------|------|-----------|
| company_profile.postal_code, address, contact_name, products_services, target_customers | 法人UI (profile.ts) も未対応。先にprofile.ts修正が必要 | 1c |
| chat_facts の CRUD | 別エンドポイントの方が clean | 1b |
| company_documents の CRUD | R2アクセス・所有権チェックの設計が必要 | 2b |
| 完成度計算の共通化 | ロジック抽出が先 | 2a |

### Phase 1a の実装タスク

1. `agency/clients.ts` の `PUT /clients/:id/company` の `safeParseJsonBody` 型に Group A + Group B のフィールドを追加
2. `companyUpdateFields` ブロックに Group A のフィールド追加（+ employee_band 自動計算は既存）
3. `profileUpdateFields` ブロックに Group B のフィールド追加
4. `GET /clients/:id` のレスポンスが `company_profile` の全カラムを返すことを確認（既に `SELECT cp.*` で OK）
5. 既存のテスト・動作確認

### Phase 1a でやらないこと（境界線）

- intake_field_mappings の変更
- submissions.ts の承認フローの変更
- portal.ts の変更
- profile.ts の変更
- 新しいテーブルやカラムの追加
- フロントエンドの変更

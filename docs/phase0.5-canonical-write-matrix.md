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
| postal_code | PUT /profile | **PUT /company ✅** | -(payload) | **x** | - | companies | postal_code | **Phase 1a 完了**。承認未対応 | 1a✅ |
| prefecture | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve(fieldMapping) | - | companies | prefecture | o 全経路OK | - |
| city | PUT /profile | **PUT /company ✅** | POST /intake(payload) | approve(fieldMapping) | - | companies | city | **Phase 1a 完了** | 1a✅ |
| industry_major | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve(fieldMapping) | - | companies | industry_major | o 全経路OK | - |
| industry_minor | PUT /profile | PUT /company | - | approve(fieldMapping) | - | companies | industry_minor | o 士業はPUT /companyで対応済 | - |
| employee_count | PUT /profile | POST /clients, PUT /company | POST /intake(payload) | approve + band auto | fact-sync | companies | employee_count | o 全経路OK | - |
| employee_band | (auto-calc) | (auto-calc) | - | (auto-calc) | - | companies | employee_band | o 全経路で自動計算 | - |
| capital | PUT /profile | **PUT /company ✅** | POST /intake(payload) | approve(fieldMapping) | fact-sync | companies | capital | **Phase 1a 完了** | 1a✅ |
| established_date | PUT /profile | **PUT /company ✅** | POST /intake(payload) | approve(founded_date) | - | companies | established_date | **Phase 1a 完了** | 1a✅ |
| annual_revenue | PUT /profile | **PUT /company ✅** | POST /intake(payload) | approve(fieldMapping) | fact-sync | companies | annual_revenue | **Phase 1a 完了** | 1a✅ |

### 1-B. `company_profile` テーブル書き込みマトリクス

| field | 法人UI route | 士業UI route | URL intake route | 承認反映 route | fact-sync | target table | target column | current status | fix phase |
|-------|:---:|:---:|:---:|:---:|:---:|---|---|---|---|
| corp_number | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | corp_number | **Phase 1a 完了**。承認未対応 | 1a✅ |
| corp_type | PUT /profile | **PUT /company ✅** | - | **x** | fact-sync | company_profile | corp_type | **Phase 1a 完了**。承認未対応 | 1a✅ |
| representative_name | PUT /profile | PUT /company | -(payload) | approve(profileMapping) | - | company_profile | representative_name | o 士業OK | - |
| representative_title | PUT /profile | **PUT /company ✅** | - | approve(profileMapping) | - | company_profile | representative_title | **Phase 1a 完了** | 1a✅ |
| founding_year | PUT /profile | **PUT /company ✅** | - | **x** | fact-sync | company_profile | founding_year | **Phase 1a 完了**。承認未対応 | 1a✅ |
| founding_month | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | founding_month | **Phase 1a 完了**。承認未対応 | 1a✅ |
| website_url | PUT /profile | PUT /company | - | approve(profileMapping) | - | company_profile | website_url | o 士業OK | - |
| contact_email | PUT /profile | PUT /company | - | approve(profileMapping) | - | company_profile | contact_email | o 士業OK | - |
| contact_phone | PUT /profile | PUT /company | - | approve(profileMapping) | - | company_profile | contact_phone | o 士業OK | - |
| business_summary | PUT /profile | PUT /company | -(payload) | approve(profileMapping) | fact-sync | company_profile | business_summary | o 士業OK | - |
| main_products | PUT /profile | **PUT /company ✅** | - | approve(profileMapping) | - | company_profile | main_products | **Phase 1a 完了** | 1a✅ |
| main_customers | PUT /profile | **PUT /company ✅** | - | approve(profileMapping) | - | company_profile | main_customers | **Phase 1a 完了** | 1a✅ |
| competitive_advantage | PUT /profile | **PUT /company ✅** | - | approve(profileMapping) | - | company_profile | competitive_advantage | **Phase 1a 完了** | 1a✅ |
| fiscal_year_end | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | fiscal_year_end | **Phase 1a 完了**。承認未対応 | 1a✅ |
| is_profitable | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | is_profitable | **Phase 1a 完了**。承認未対応 | 1a✅ |
| has_debt | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | has_debt | **Phase 1a 完了**。承認未対応 | 1a✅ |
| past_subsidies_json | PUT /profile | **PUT /company ✅** | - | **x** | fact-sync | company_profile | past_subsidies_json | **Phase 1a 完了**。承認未対応 | 1a✅ |
| desired_investments_json | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | desired_investments_json | **Phase 1a 完了**。承認未対応 | 1a✅ |
| current_challenges_json | PUT /profile | **PUT /company ✅** | - | **x** | fact-sync | company_profile | current_challenges_json | **Phase 1a 完了**。承認未対応 | 1a✅ |
| has_young_employees | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | has_young_employees | **Phase 1a 完了**。承認未対応 | 1a✅ |
| has_female_executives | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | has_female_executives | **Phase 1a 完了**。承認未対応 | 1a✅ |
| has_senior_employees | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | has_senior_employees | **Phase 1a 完了**。承認未対応 | 1a✅ |
| plans_to_hire | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | plans_to_hire | **Phase 1a 完了**。承認未対応 | 1a✅ |
| certifications_json | PUT /profile | **PUT /company ✅** | - | **x** | fact-sync | company_profile | certifications_json | **Phase 1a 完了**。承認未対応 | 1a✅ |
| constraints_json | PUT /profile | **PUT /company ✅** | - | **x** | fact-sync | company_profile | constraints_json | **Phase 1a 完了**。承認未対応 | 1a✅ |
| notes | PUT /profile | **PUT /company ✅** | - | **x** | - | company_profile | notes | **Phase 1a 完了**。承認未対応 | 1a✅ |
| postal_code (profile) | **PUT /profile ✅** | **PUT /company ✅** | - | **x** | - | company_profile | postal_code | **Phase 1c 完了** | 1c✅ |
| address | **PUT /profile ✅** | **PUT /company ✅** | -(payload) | **x** | - | company_profile | address | **Phase 1c 完了** | 1c✅ |
| contact_name | **PUT /profile ✅** | **PUT /company ✅** | - | **x** | - | company_profile | contact_name | **Phase 1c 完了** | 1c✅ |
| products_services | **PUT /profile ✅** | **PUT /company ✅** | - | **x** | - | company_profile | products_services | **Phase 1c 完了** | 1c✅ |
| target_customers | **PUT /profile ✅** | **PUT /company ✅** | - | **x** | - | company_profile | target_customers | **Phase 1c 完了** | 1c✅ |

※ 承認フロー（submissions.ts）への反映は Phase 4 で対応

### 1-C. `chat_facts` 書き込みマトリクス

| fact_key | 法人UI route | 士業UI route | チャット route | URL intake route | target | current status | fix phase |
|---------|:---:|:---:|:---:|:---:|---|---|---|
| has_gbiz_id | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| is_invoice_registered | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| plans_wage_raise | PUT /profile (facts) | **PUT /facts ✅** | derived-questions (plans_wage_raise ★修正済) | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| tax_arrears | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| past_subsidy_same_type | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| has_business_plan | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| has_keiei_kakushin | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |
| has_jigyou_keizoku | PUT /profile (facts) | **PUT /facts ✅** | derived-questions | **x** | chat_facts のみ | **Phase 1b 完了** | 1b✅ |

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

---

## 4. Phase 1a 実装完了記録

> 実装日: 2026-03-12

### 変更ファイル

- `src/routes/agency/clients.ts` — PUT /clients/:id/company を拡張

### 追加内容

1. **型定義拡張**: `safeParseJsonBody` の型に companies 1項目 + company_profile 21項目を追加
2. **バリデーション**: employee_count, capital, annual_revenue, founding_year, founding_month, fiscal_year_end に数値範囲チェック追加（profile.ts と意味統一）
3. **companies 更新**: データドリブン配列ループ方式（従来のif列挙からリファクタ）
4. **company_profile upsert**: profile.ts L248-291 と同じフィールドリスト・INSERT/UPDATE パターン

### テスト結果

| テスト | 結果 |
|--------|------|
| ビルド | ✅ 成功（TypeScriptエラーなし） |
| PUT companies 新規フィールド (postal_code, capital, annual_revenue, established_date) | ✅ 保存成功 |
| PUT company_profile INSERT パス (corp_number, founding_year, is_profitable 等) | ✅ 新規作成成功 |
| PUT company_profile UPDATE パス (has_debt, main_products, certifications_json 等) | ✅ 既存更新成功 |
| バリデーション (employee_count<0, founding_year<1800, fiscal_year_end>12) | ✅ 3件ともリジェクト成功 |
| GET /clients/:id で全カラム返却 | ✅ 全 company_profile カラムを確認 |

### Phase 1a 達成ステータス: ⚠️「1件既知制約つき達成」

Phase 1a の目標「士業が corporate と同等にフィールドを保存できる」は達成。
ただし **GET /clients/:id のレスポンスをそのまま再編集SSOTに使う場合は制約あり**。

| 観点 | 結果 | 詳細 |
|------|------|------|
| DB保存 | ✅ | companies, company_profile 両テーブルに正しく保存される |
| GET単純返却 | ⚠️ | `SELECT ac.*, c.*, cp.*` でカラム名衝突（id, postal_code, updated_at 等） |
| 再編集安全性 | ⚠️ | 構造化レスポンス化（`{ company: {...}, profile: {...} }`）まで未保証 |

**衝突するカラム（確認済み）:**
- `id`: agency_clients / companies / company_profile の3つが衝突 → company_profile の company_id が勝つ
- `postal_code`: companies / company_profile が衝突 → company_profile（null）が companies("100-0001") を上書き
- `created_at`, `updated_at`: 3テーブルが衝突

**対応方針**: Phase 1c〜2a で構造化レスポンスに改善予定。現時点ではフロントが個別カラムを直接参照する運用で回避。

### その他の残課題

- **承認フロー未対応**: 新規追加 company_profile フィールドは承認反映 (submissions.ts) には含まれていない。Phase 4 で対応予定。

---

## 5. Canonical Fact Keys（Phase 1b 追加）

> BUG-2（`is_wage_raise_planned` → `plans_wage_raise` 問題）の再発防止のため、  
> fact_key の正準名をここで固定する。以降の実装はこの表のキーのみを使用すること。

### 5-A. 会社レベル fact（subsidy_id = NULL）

士業・法人UI・チャットすべてで共通使用する加点要素・適格性フラグ。

| canonical_key | label_ja | type | 3値の意味 | getCompanySSOT 参照 | screening 参照 | source 例 |
|---|---|---|---|---|---|---|
| `has_gbiz_id` | GビズIDプライム取得済み | boolean | null=未確認 / "true"=取得済み / "false"=未取得 | ✅ `facts.has_gbiz_id` | ✅ (optional) | user_input, chat, agency_input |
| `is_invoice_registered` | インボイス登録済み | boolean | null=未確認 / "true"=登録済み / "false"=未登録 | ✅ `facts.is_invoice_registered` | ✅ (optional) | user_input, chat, agency_input |
| `plans_wage_raise` | 賃上げ予定 | boolean | null=未確認 / "true"=予定あり / "false"=予定なし | ✅ `facts.plans_wage_raise` | ✅ (optional, 加点10pt) | user_input, chat, agency_input |
| `tax_arrears` | 税金滞納 | boolean | null=未確認 / "true"=滞納あり / "false"=滞納なし | ✅ `facts.tax_arrears` | ✅ (risk) | user_input, chat, agency_input |
| `past_subsidy_same_type` | 同種補助金受給歴 | boolean | null=未確認 / "true"=受給あり / "false"=受給なし | ✅ `facts.past_subsidy_same_type` | ✅ (risk, -20pt) | user_input, chat, agency_input |
| `has_business_plan` | 事業計画書あり | boolean | null=未確認 / "true"=あり / "false"=なし | ✅ `facts.has_business_plan` | - | user_input, chat, agency_input |
| `has_keiei_kakushin` | 経営革新計画承認 | boolean | null=未確認 / "true"=承認済み / "false"=未承認 | ✅ `facts.has_keiei_kakushin` | ✅ (加点) | user_input, chat, agency_input |
| `has_jigyou_keizoku` | 事業継続力強化計画認定 | boolean | null=未確認 / "true"=認定済み / "false"=未認定 | ✅ `facts.has_jigyou_keizoku` | ✅ (加点) | user_input, chat, agency_input |

### 5-B. 値の保存ルール（全経路共通）

| ルール | 説明 |
|--------|------|
| **fact_value の型** | 常に TEXT（SQLite）。boolean は `"true"` / `"false"` の文字列 |
| **null / 未設定の扱い** | fact_value = null は「未確認」。`"false"` とは明確に異なる |
| **値の正規化** | `true`/`1`/`yes`/`はい` → `"true"`、`false`/`0`/`no`/`いいえ` → `"false"` |
| **subsidy_id** | 会社レベル fact は `NULL`。補助金固有 fact は `subsidy_id` を指定 |
| **upsert 単位** | UNIQUE(company_id, subsidy_id, fact_key) で ON CONFLICT UPDATE |
| **削除** | fact を削除するのではなく、`fact_value = null` に設定（「未確認」に戻す）|
| **source 値** | `user_input`(法人UI) / `chat`(壁打ち) / `agency_input`(士業UI) / `customer_answer`(ポータル) |

### 5-C. レガシーキーのフォールバック対応

| レガシーキー | 正準キー | 対応箇所 |
|---|---|---|
| `is_wage_raise_planned` | `plans_wage_raise` | getCompanySSOT.ts: フォールバック読み取り。derived-questions.ts: 正準キーに変更済み |

**新規コードでレガシーキーを使用してはならない。** 読み取りのフォールバックのみ許可。

### 5-D. 補助金固有 fact（subsidy_id ≠ NULL）— Phase 1b では対象外

チャットの壁打ちで収集される補助金固有の回答。Phase 1b では会社レベル fact のみを対象とする。

| fact_key | 備考 |
|---|---|
| `investment_amount` | 投資予定額（案件固有） |
| `expense_breakdown` | 経費内訳 |
| `expected_effect` | 期待効果 |
| `project_summary` | 事業概要 |
| `application_category` | 申請枠・類型 |
| その他動的キー | チャットAIが生成 |

---

## 6. Phase 1b 実装完了記録

> 実装日: 2026-03-12

### 変更ファイル

- `src/routes/agency/clients.ts` — GET/PUT /clients/:id/facts を追加

### 追加内容

1. **GET /api/agency/clients/:id/facts**: 会社レベル fact (subsidy_id=NULL) の全件取得
   - fact_key, fact_value, label_ja, is_canonical, source, confidence, updated_at を返す
   - canonical_keys リストも返す（フロントが入力UIを構築するため）

2. **PUT /api/agency/clients/:id/facts**: 会社レベル fact の upsert
   - canonical 8キーのみ受け付け（unknown key は VALIDATION_ERROR で拒否）
   - boolean 値の自動正規化: true/1/yes/はい → "true", false/0/no/いいえ → "false"
   - null 送信 → fact_value = null（「未確認に戻す」）
   - undefined（キー未送信）→ スキップ（既存値を変更しない）
   - source は 'agency_input' で固定
   - confidence は 100 で固定

3. **共通コンポーネント**:
   - `CANONICAL_FACT_KEYS`: 正準キー配列（8キー）
   - `FACT_KEY_LABELS_JA`: 日本語ラベル辞書
   - `normalizeBooleanFactValue()`: boolean 正規化関数

### Phase 1b の設計判断

| 判断項目 | 決定内容 | 理由 |
|---------|---------|------|
| エンドポイント分離 | PUT /company とは別に PUT /facts を新設 | chat_facts と companies/company_profile は異なる責務。Phase 1a の制約に従い分離 |
| canonical key のみ | 8キー以外を拒否 | 任意キーの混入による BUG-2 再発を防止 |
| null vs undefined | null=未確認に戻す, undefined=スキップ | profile.ts は null をスキップするが、士業UIでは明示的なリセットが必要なケースがある |
| source=agency_input | 新設の source 値 | 誰がいつ設定したか追跡可能にする |
| upsert方式 | SELECT → UPDATE / INSERT | profile.ts と同じパターン。ON CONFLICT は使わない（整合性の観点） |

### テスト結果

| テスト | 結果 |
|--------|------|
| ビルド | ✅ 成功（TypeScriptエラーなし） |
| GET /facts (初期状態 = 空) | ✅ facts: [] |
| PUT /facts INSERT (4キー: true, "はい", false, 1) | ✅ inserted: 4, 値すべて正規化 |
| GET /facts (INSERT後) | ✅ 4件、source=agency_input, label_ja 正常 |
| PUT /facts UPDATE (既存→false) + null (→未確認) + INSERT (新規) | ✅ updated:1, cleared:1, inserted:1 |
| GET /facts (UPDATE後) | ✅ plans_wage_raise=null, has_gbiz_id="false" |
| PUT /facts unknown key rejection | ✅ VALIDATION_ERROR |
| PUT /facts missing facts object | ✅ VALIDATION_ERROR |
| E2E: DB直接確認（7キーすべて正しいvalue/source） | ✅ |
| E2E: getCompanySSOT 読み取りパス（コード確認） | ✅ |
| E2E: screening-v2 参照パス（コード確認） | ✅ |
| corporate (profile.ts) への影響 | ✅ なし（コード無変更） |

### 既知の残課題

- **past_subsidy_same_type が 1-C マトリクスに未記載だった**: Phase 0.5 初期版では 7キーしか記載していなかったが、実際は 8キー（past_subsidy_same_type を含む）。Phase 1b で修正済み。
- ~~**profile.ts の fact_keys リストとの差異**~~: Phase 1c-B で `canonical-facts.ts` に統一済み。profile.ts は `CANONICAL_FACT_KEYS` を import するようになった。

---

## 7. Phase 1c 実装完了記録

> 実装日: 2026-03-12

### Phase 1c-A: 0020 追加カラム反映

**変更ファイル:**
- `src/routes/profile.ts` — `profileFields` 配列に 5 カラム追加
- `src/routes/agency/clients.ts` — `profileFieldList` 配列と型定義に 5 カラム追加

**追加カラム（すべて company_profile テーブル）:**

| カラム | 用途 | intake_field_mappings |
|--------|------|---------------------|
| postal_code | 郵便番号（company_profile 側） | ifm_013 |
| address | 住所 | ifm_012 |
| contact_name | 担当者名 | ifm_040 |
| products_services | 主な製品・サービス | ifm_022 |
| target_customers | ターゲット顧客 | ifm_023 |

**GET は変更なし**: `SELECT *` を使用しているため全カラム返却済み。
**completeness には追加なし**: Phase 2a で判断。

### Phase 1c-B: factKeys 統一

**新規ファイル:**
- `src/lib/canonical-facts.ts` — canonical fact keys の一元定義

**エクスポート:**
- `CANONICAL_FACT_KEYS`: 8キーの readonly 配列
- `CanonicalFactKey`: union type
- `FACT_KEY_LABELS_JA`: 日本語ラベル辞書（型安全）
- `normalizeBooleanFactValue()`: boolean 正規化関数
- `isCanonicalFactKey()`: キー判定ヘルパー

**変更ファイル:**
- `src/routes/profile.ts` — ローカル `factKeys` 配列を `CANONICAL_FACT_KEYS` の import に置換
  - **これにより `past_subsidy_same_type` が corporate 側にも追加された**
- `src/routes/agency/clients.ts` — ローカル定義 3 つ（CANONICAL_FACT_KEYS, FACT_KEY_LABELS_JA, normalizeBooleanFactValue）を削除し、共通モジュールから import

**統一前後の差異:**

| ファイル | 統一前 | 統一後 |
|---------|--------|--------|
| profile.ts factKeys | 7キー（past_subsidy_same_type 欠落） | 8キー（canonical-facts.ts から import） |
| agency/clients.ts | ローカル定義 8キー | canonical-facts.ts から import |
| ai-concierge.ts FACT_KEY_LABELS | 独自ラベル辞書（表示専用） | 変更なし（scope が異なるため） |

### テスト結果

| テスト | 結果 |
|--------|------|
| ビルド (TypeScript, 256 modules) | ✅ |
| agency PUT /facts (共通モジュール経由) | ✅ |
| agency GET /facts (共通モジュール経由、is_canonical 判定) | ✅ |
| agency PUT /company (0020 追加カラム) | ✅ DB 保存確認済み |
| profile.ts factKeys に past_subsidy_same_type 追加（コード確認） | ✅ |

### 残課題

- ~~GET /clients/:id のカラム名衝突~~ → **Phase 2a で解決**: 構造化レスポンスにより `client`, `company`, `profile` を分離
- ~~completeness チェックに 0020 追加カラムを含めるか~~ → Phase 2a で共通関数 `completeness.ts` を導入。0020 カラムは現時点で含めない（必須/推奨/任意の3層で十分）

---

## 8. Phase 2a 実装完了記録

> 実装日: 2026-03-12

### 目的

1. `GET /clients/:id` のカラム名衝突（Phase 1a の既知制約）を解消
2. completeness 計算ロジックの共通関数化
3. `GET /clients/:id` に facts と completeness を含む構造化レスポンスを返す

### 変更ファイル

- `src/lib/completeness.ts` — **新規**: completeness 計算の共通関数
- `src/routes/agency/clients.ts` — `GET /clients/:id` の構造化、`GET /clients` の共通関数移行

### 新規モジュール: `src/lib/completeness.ts`

**エクスポート:**
- `calculateCompleteness(company, profile)`: 完全な completeness 計算（必須4 + 推奨8 + 任意6 = 18項目）
- `calculateSimpleCompleteness(company)`: 簡易 completeness（必須4項目のみ、OK/BLOCKED）
- `REQUIRED_FIELDS`, `RECOMMENDED_FIELDS`, `OPTIONAL_FIELDS`: フィールド定義
- `FIELD_WEIGHTS`: 重みマップ（profile.ts との後方互換）
- 型: `CompletenessResult`, `SimpleCompletenessResult`

### GET /clients/:id 構造化レスポンス

**旧（Phase 1a）:**
```json
{
  "client": { /* SELECT ac.*, c.*, cp.* の結合結果（カラム名衝突あり） */ },
  "links": [...], "submissions": [...], "drafts": [...], "sessions": [...]
}
```

**新（Phase 2a）:**
```json
{
  "client":       { "id": "client-xxx", "company_id": "comp-xxx", ... },
  "company":      { "id": "comp-xxx", "postal_code": "100-0001", ... },
  "profile":      { "company_id": "comp-xxx", "postal_code": null, ... },
  "facts": {
    "values":        { "has_gbiz_id": true, "plans_wage_raise": true, ... },
    "details":       [ { "fact_key": "...", "label_ja": "...", "is_canonical": true, ... } ],
    "canonical_keys": ["has_gbiz_id", "is_invoice_registered", ...]
  },
  "completeness": {
    "status": "OK",
    "percentage": 84,
    "ready_for_search": true,
    "required":  { "total": 4, "filled": 4, "fields": { ... } },
    "recommended": { "total": 8, "filled": 5, "fields": { ... } },
    "optional":  { "total": 6, "filled": 0 },
    "missing_required": [],
    "missing_recommended": [ ... ],
    "next_actions": [ ... ]
  },
  "links": [...], "submissions": [...], "drafts": [...], "sessions": [...]
}
```

### カラム名衝突の解消

| 衝突カラム | 旧（JOIN結果） | 新（構造化） |
|-----------|--------------|------------|
| `id` | company_profile.company_id が勝つ | `client.id`, `company.id` で分離 |
| `postal_code` | company_profile(null) が companies を上書き | `company.postal_code`, `profile.postal_code` で分離 |
| `created_at` | 最後のテーブルが勝つ | 各オブジェクトに独立して含む |
| `updated_at` | 最後のテーブルが勝つ | 各オブジェクトに独立して含む |

### GET /clients 一覧の変更

- completeness 計算を `calculateSimpleCompleteness()` 共通関数に移行
- レスポンス形式に変更なし（後方互換維持）

### テスト結果

| テスト | 結果 |
|--------|------|
| ビルド (TypeScript, 257 modules) | ✅ |
| GET /clients/:id 構造化レスポンス（9キー: client/company/profile/facts/completeness/links/submissions/drafts/sessions） | ✅ |
| client.id ≠ company.id（衝突解消） | ✅ |
| company.postal_code ≠ profile.postal_code（衝突解消） | ✅ |
| facts.values（3件: has_gbiz_id=true, plans_wage_raise=true, tax_arrears=false） | ✅ |
| completeness OK（必須4項目充足、percentage=84） | ✅ |
| completeness BLOCKED（必須項目欠落、ready_for_search=false、next_actions 正常） | ✅ |
| GET /clients 一覧（共通関数経由、OK/BLOCKED 正常） | ✅ |

### 設計判断

| 判断 | 内容 | 理由 |
|------|------|------|
| 並列クエリ | 7つの DB クエリを Promise.all で実行 | パフォーマンス改善 |
| SELECT 明示 | companies は列名を明示、profile は `SELECT *` | companies の列名衝突回避 + profile は全カラム返却が必要 |
| facts 二重形式 | `values`（オブジェクト）と `details`（配列）を両方返す | values は SSOT 互換、details は UI 表示用 |
| completeness 共通化 | `calculateCompleteness` + `calculateSimpleCompleteness` | 3箇所分散を解消。ただし既存 route（profile.ts, companies.ts）は未移行（後方互換） |

### 既存 route への影響

| route | 影響 |
|-------|------|
| profile.ts GET /completeness | 変更なし（独自の COMPLETENESS_FIELDS + 書類加点を維持） |
| companies.ts GET /:id/completeness | 変更なし（独自の CompletenessResult 型を維持） |
| suggestions.ts | 変更なし（SQL WHERE で必須4項目チェック） |

### 残課題

- `profile.ts` と `companies.ts` の completeness 計算を共通関数に移行（任意、後方互換維持のため低優先度）
- 0020 追加カラムを completeness の recommended に追加するか（後日判断）
- `GET /clients` 一覧にも facts/profile を含めるか（パフォーマンスとのトレードオフ、現時点では不要）

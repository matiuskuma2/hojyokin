# 士業UI フィールド仕様書

**最終更新**: 2026-03-14
**対象**: 士業向け顧客詳細画面（`src/pages/agency.tsx`）
**基準**: 企業向け会社情報画面（`src/pages/dashboard.tsx`）

---

## 1. 完了条件の4段階定義

各フィールドは以下の4段階で完了判定する。
1つでも欠ければ「運用投入可」とは判定しない。

| 段階 | 定義 | 判定基準 |
|------|------|----------|
| **API** | バックエンドで保存・取得可能 | PUT/GETで値が往復する |
| **UI** | 画面上で表示・編集可能 | モーダル/タブに入力欄がある + 値が正しく表示される |
| **実機** | 実ブラウザで操作に支障なし | iPhone Safari含め、スクロール/保存/表示が崩れない |
| **運用可** | 業務フローで意図通り使える | completeness/matching/draft/chatで正しく参照される |

---

## 2. カテゴリ定義

| カテゴリ | 定義 | 判断基準 |
|----------|------|----------|
| **B (企業同期項目)** | 企業UI（dashboard.tsx）のフォームに実在し、士業UIでも同等に扱う | dashboard.tsx の `<input>/<select>/<textarea>` に `name=` 属性で存在 |
| **D (士業独自補助項目)** | 企業UIのフォームには存在しないが、バックエンドDBカラムが存在し、士業の代理入力で有用なため追加 | dashboard.tsx に該当 name 属性が存在しない |

**重要**: D項目は企業UIと「同等」ではない。あくまで士業独自の拡張機能であり、
企業側ユーザーからは見えない項目を含む。

---

## 3. B項目（企業同期項目）: 29件

### 3a. 基本情報タブ（企業UI: basic-form）

| # | 正準名 | 企業UIラベル | 企業UI name属性 | 士業UI name属性 | DB保存先 | completeness | matching | draft | chat | extract/apply |
|---|--------|-------------|----------------|----------------|----------|-------------|----------|-------|------|---------------|
| 1 | company_name | 会社名 | name (basic-form) | companyName | companies.name | required (weight:10) | - | - | - | CorpRegistry |
| 2 | prefecture | 都道府県 | prefecture | prefecture | companies.prefecture | required (weight:10) | - | - | - | CorpRegistry |
| 3 | industry_major | 業種 | industry | industry_major | companies.industry_major | required (weight:10) | - | - | - | - |
| 4 | employee_count | 従業員数 | employee_count | employee_count | companies.employee_count | required (weight:10) | - | - | - | Financials |
| 5 | postal_code | 郵便番号 | postal_code | postal_code | companies.postal_code | - | - | - | - | - |
| 6 | city | 市区町村 | city | city | companies.city | recommended (weight:5) | - | - | - | CorpRegistry |
| 7 | capital | 資本金 | capital | capital | companies.capital | recommended (weight:5) | - | - | - | CorpRegistry |
| 8 | annual_revenue | 年商 | annual_revenue | annual_revenue | companies.annual_revenue | recommended (weight:5) | - | - | - | Financials (sales) |
| 9 | established_date | 設立年月 | founded_date | established_date | companies.established_date | recommended (weight:5) | - | - | - | CorpRegistry |

**命名差の注記**:
- 企業UI `founded_date` → 士業UI `established_date` → DB `established_date`
- 企業UI `industry` → 士業UI `industry_major` → DB `industry_major`
- 企業UI `name` (basic-form) → 士業UI `companyName` → DB `companies.name`

### 3b. 詳細プロフィール - 会社詳細（企業UI: detail-form）

| # | 正準名 | 企業UIラベル | 企業UI name | 士業UI name | DB保存先 | completeness | matching | draft | chat | extract/apply |
|---|--------|-------------|------------|------------|----------|-------------|----------|-------|------|---------------|
| 10 | corp_type | 法人種別 | corp_type | corp_type | company_profile.corp_type | recommended (weight:5) | - | draft (corpType) | - | - |
| 11 | corp_number | 法人番号 | corp_number | corp_number | company_profile.corp_number | - | - | - | - | CorpRegistry |
| 12 | founding_year | 創業年 | founding_year | founding_year | company_profile.founding_year | - | - | draft (foundingYear) | chat (founding_year) | - |
| 13 | fiscal_year_end | 決算月 | fiscal_year_end | fiscal_year_end | company_profile.fiscal_year_end | - | - | - | - | Financials |
| 14 | representative_name | 代表者名 | representative_name | representative_name | company_profile.representative_name | recommended (weight:5) | - | - | - | CorpRegistry |
| 15 | representative_title | 代表者役職 | representative_title | representative_title | company_profile.representative_title | - | - | - | - | CorpRegistry |

### 3c. 詳細プロフィール - 申請関連（企業UI: detail-form / ファクトタブ経由）

| # | 正準名 | 企業UIラベル | 企業UI name | 士業UI配置先 | DB保存先 | completeness | matching | draft | chat | extract/apply |
|---|--------|-------------|------------|-------------|----------|-------------|----------|-------|------|---------------|
| 16 | has_gbiz_id | GビズID | has_gbiz_id | ファクトタブ | chat_facts | - | - | - | - | - |
| 17 | is_invoice_registered | インボイス登録 | is_invoice_registered | ファクトタブ | chat_facts | - | - | - | - | - |
| 18 | plans_wage_raise | 賃上げ予定 | plans_wage_raise | ファクトタブ | chat_facts | - | - | - | - | - |
| 19 | is_profitable | 直近決算の収益性 | is_profitable | 編集モーダル | company_profile.is_profitable | recommended (weight:5) | - | - | chat (is_profitable) | Financials |

### 3d. 詳細プロフィール - 事業内容（企業UI: detail-form）

| # | 正準名 | 企業UIラベル | 企業UI name | 士業UI name | DB保存先 | completeness | matching | draft | chat | extract/apply |
|---|--------|-------------|------------|------------|----------|-------------|----------|-------|------|---------------|
| 20 | business_summary | 事業概要 | business_summary | business_summary | company_profile.business_summary | recommended (weight:8) | - | - | chat | - |
| 21 | main_products | 主要製品・サービス | main_products | main_products | company_profile.main_products | - | - | - | chat (main_products) | - |
| 22 | main_customers | 主要取引先 | main_customers | main_customers | company_profile.main_customers | - | - | - | chat (main_customers) | - |

### 3e. 詳細プロフィール - 加点要素（企業UI: detail-form）

| # | 正準名 | 企業UIラベル | 企業UI name | 士業UI name | DB保存先 | completeness | matching | draft | chat | extract/apply |
|---|--------|-------------|------------|------------|----------|-------------|----------|-------|------|---------------|
| 23 | has_young_employees | 若年者雇用 | has_young_employees | has_young_employees | company_profile | optional (weight:2) | - | - | - | - |
| 24 | has_female_executives | 女性役員 | has_female_executives | has_female_executives | company_profile | optional (weight:2) | - | - | - | - |
| 25 | has_senior_employees | シニア雇用 | has_senior_employees | has_senior_employees | company_profile | optional (weight:2) | - | - | - | - |
| 26 | plans_to_hire | 採用予定 | plans_to_hire | plans_to_hire | company_profile | optional (weight:2) | - | - | - | - |
| 27 | cert_keiei_kakushin | 経営革新計画承認 | cert_keiei_kakushin | cert_keiei_kakushin | (certifications_json内) | - | - | - | chat (certifications) | - |
| 28 | cert_jigyou_keizoku | 事業継続力強化計画 | cert_jigyou_keizoku | cert_jigyou_keizoku | (certifications_json内) | - | - | - | chat (certifications) | - |
| 29 | cert_senryaku | 地域経済牽引事業計画 | cert_senryaku | cert_senryaku | (certifications_json内) | - | - | - | - | - |
| 30 | cert_iso | ISO認証 | cert_iso | cert_iso | (certifications_json内) | - | - | - | - | - |

**注記 (27-30)**: 企業UIではチェックボックスとして独立。士業UIでも同じチェックボックス形式。
ただしDB保存は `certifications_json` カラムにまとめてJSON保存される設計と、
個別の `has_keiei_kakushin` 等のフラグの両方が混在している（要統一）。

---

## 4. D項目（士業独自補助項目）: 9件

これらは **企業UI（dashboard.tsx）のフォームに存在しない** が、
`company_profile` テーブルにカラムが存在し、APIで保存・取得が可能。

| # | 正準名 | 士業UIラベル | DB保存先 | completeness | draft | chat | extract/apply | 追加理由 |
|---|--------|-------------|----------|-------------|-------|------|---------------|----------|
| D1 | website_url | Webサイト | company_profile.website_url | - | - | - | - | 企業の基本情報として有用 |
| D2 | has_debt | 借入有無 | company_profile.has_debt | - | - | - | - | 補助金審査で参照される可能性 |
| D3 | contact_name | 連絡担当者名 | company_profile.contact_name | - | - | - | - | 士業→企業の連絡に必要 |
| D4 | contact_email | 連絡先メール | company_profile.contact_email | - | - | - | - | 同上 |
| D5 | contact_phone | 連絡先電話 | company_profile.contact_phone | - | - | - | - | 同上 |
| D6 | competitive_advantage | 競合優位性 | company_profile.competitive_advantage | - | draft | chat | - | 申請書作成で参照 |
| D7 | target_customers | ターゲット顧客 | company_profile.target_customers | - | - | - | - | 事業理解の補足 |
| D8 | past_subsidies_json | 過去の補助金受給歴 | company_profile.past_subsidies_json | optional (weight:5) | - | chat | - | 審査で参照 |
| D9 | certifications_json | 認証・資格 | company_profile.certifications_json | optional (weight:3) | - | chat | - | 加点判定 |

**重要な発見**:
- D6 `competitive_advantage` は draft と chat の両方で実際に参照されている。
- D8 `past_subsidies_json` は completeness(optional) と chat で参照されている。
- D9 `certifications_json` は completeness(optional) と chat で参照されている。
- D1-D5, D7 は **どの業務フローでも参照されていない**（保存はできるが使われない）。

---

## 5. 現在の完了状態（4段階）

### B項目（企業同期項目）

| 段階 | 状態 | 備考 |
|------|------|------|
| API | ✅ 完了 | 全29項目がPUT/GETで往復確認済み |
| UI | ✅ 完了 | 編集モーダル・表示タブに全項目が存在。ただしUX同等性（並び順・説明文・バリデーション）は企業UIと完全一致ではない |
| 実機 | ❌ 未確認 | iPhone Safari等での操作性テスト未実施 |
| 運用可 | ❌ 未確認 | 認証チェックボックス→certifications_json保存の整合性が未検証 |

### D項目（士業独自補助項目）

| 段階 | 状態 | 備考 |
|------|------|------|
| API | ✅ 完了 | 全9項目が保存・取得可能 |
| UI | ✅ 完了 | 編集モーダル・表示タブに全項目が存在 |
| 実機 | ❌ 未確認 | |
| 運用可 | ⚠️ 部分的 | D6,D8,D9はdraft/chatで参照あり。D1-D5,D7は保存のみ（業務フロー未接続） |

---

## 6. 未解決の技術的リスク

### 6a. 認証チェックボックスとcertifications_json の二重管理

企業UI: `cert_keiei_kakushin`, `cert_jigyou_keizoku`, `cert_senryaku`, `cert_iso` → 独立チェックボックス
DB: `certifications_json` (JSONカラム) + `has_keiei_kakushin`, `has_jigyou_keizoku` (個別フラグ?)
chat: `certifications_json` を JSON.parse して参照

**リスク**: モーダルでチェックボックスをON→保存→certifications_jsonに統合される流れと、
chat_facts の `has_keiei_kakushin` キーとの整合性が曖昧。

### 6b. 命名差の残存

| 用途 | company_name | 業種 | 設立年月 |
|------|-------------|------|----------|
| 企業UI form name | name (basic-form) | industry | founded_date |
| 士業UI form name | companyName | industry_major | established_date |
| DB column | companies.name | companies.industry_major | companies.established_date |
| API payload key | companyName | industry_major | established_date |

これ以上変換点を増やさないために、今後の新項目追加は **DB column名をそのままUI name属性に使う** ルールとする。

### 6c. D項目のうち業務未接続の5件

D1(website_url), D2(has_debt), D3(contact_name), D4(contact_email), D5(contact_phone), D7(target_customers)
は「保存できるが業務で使われない」状態。
将来的にdraft/chat/matchingで参照するか、UIから除外するか方針決定が必要。

---

## 7. 次のアクション（優先順）

1. **実機確認**: iPhone Safari でモーダルの縦スクロール、保存ボタン位置、セレクト操作性を確認
2. **認証フラグ整合性**: cert_* チェックボックスの保存先をcertifications_json一本に統一するか、個別フラグに統一するか決定
3. **D項目の業務接続方針**: D1-D5,D7を業務フローに接続するか、UIラベルで「参考情報（業務未反映）」と明示するか決定
4. **命名正規化**: 既存の命名差（3箇所）は後方互換のため維持するが、新項目追加時はDB column名をそのまま使うルールを文書化

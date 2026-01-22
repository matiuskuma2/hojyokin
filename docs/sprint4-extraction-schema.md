# Sprint 4: OCR/LLM抽出スキーマ設計書

## 概要

本ドキュメントは、書類OCR（company_documents）から抽出したデータを会社プロフィール（company_profile）や申請書ドラフト（application_drafts）へ反映するための設計を定義します。

**Phase 2実装前提**：本ドキュメントは設計のみ。実装はPhase 2で着手。

---

## 1. 対象書類と抽出スキーマ

### 1-1. company_documents.doc_type 一覧

| doc_type | 書類名 | 抽出対象項目 |
|----------|--------|--------------|
| `financial_report` | 決算報告書 | 売上高、経常利益、純利益、総資産、自己資本比率等 |
| `tax_return` | 確定申告書 | 売上高、所得金額、納税額 |
| `registration_cert` | 登記簿謄本 | 商号、本店所在地、設立日、資本金、役員情報 |
| `employee_list` | 従業員名簿 | 従業員数、正社員数、パート/アルバイト数 |
| `bank_statement` | 銀行口座証明 | 口座番号、銀行名（補助金振込用） |
| `lease_contract` | 賃貸借契約書 | 事業所所在地、賃料、契約期間 |
| `insurance_cert` | 社会保険適用証明 | 加入状況、被保険者数 |
| `bcp_plan` | 事業継続力強化計画 | 認定番号、認定日、有効期限 |
| `innovation_plan` | 経営革新計画 | 承認番号、承認日、計画概要 |
| `partnership_decl` | パートナーシップ構築宣言 | 宣言ID、登録日 |
| `other` | その他 | 書類依存 |

### 1-2. extracted_json スキーマ定義

各doc_typeごとに抽出するJSONスキーマを定義。

#### financial_report（決算報告書）

```json
{
  "$schema": "extracted/financial_report/v1",
  "fiscal_year": "2024",
  "fiscal_period": "2024-04-01/2025-03-31",
  "revenue": {
    "value": 150000000,
    "currency": "JPY",
    "confidence": 0.95
  },
  "operating_income": {
    "value": 12000000,
    "currency": "JPY",
    "confidence": 0.92
  },
  "ordinary_income": {
    "value": 11500000,
    "currency": "JPY",
    "confidence": 0.90
  },
  "net_income": {
    "value": 8000000,
    "currency": "JPY",
    "confidence": 0.88
  },
  "total_assets": {
    "value": 80000000,
    "currency": "JPY",
    "confidence": 0.85
  },
  "net_assets": {
    "value": 35000000,
    "currency": "JPY",
    "confidence": 0.85
  },
  "equity_ratio": {
    "value": 43.75,
    "unit": "percent",
    "confidence": 0.80
  },
  "employee_count": {
    "value": 25,
    "confidence": 0.95
  },
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "extractor_version": "v1.0",
    "source_pages": [1, 2, 3],
    "overall_confidence": 0.88
  }
}
```

#### tax_return（確定申告書）

```json
{
  "$schema": "extracted/tax_return/v1",
  "tax_year": "2024",
  "filing_type": "corporate",
  "revenue": {
    "value": 150000000,
    "currency": "JPY",
    "confidence": 0.95
  },
  "taxable_income": {
    "value": 10000000,
    "currency": "JPY",
    "confidence": 0.90
  },
  "tax_amount": {
    "value": 2300000,
    "currency": "JPY",
    "confidence": 0.88
  },
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "extractor_version": "v1.0",
    "overall_confidence": 0.91
  }
}
```

#### registration_cert（登記簿謄本）

```json
{
  "$schema": "extracted/registration_cert/v1",
  "company_name": {
    "value": "株式会社サンプル",
    "confidence": 0.98
  },
  "company_name_kana": {
    "value": "カブシキガイシャサンプル",
    "confidence": 0.85
  },
  "head_office_address": {
    "value": "東京都渋谷区○○1-2-3",
    "prefecture": "東京都",
    "city": "渋谷区",
    "confidence": 0.95
  },
  "established_date": {
    "value": "2015-04-01",
    "confidence": 0.98
  },
  "capital_stock": {
    "value": 10000000,
    "currency": "JPY",
    "confidence": 0.98
  },
  "purpose": {
    "value": ["ソフトウェア開発", "情報処理サービス", "コンサルティング業務"],
    "confidence": 0.90
  },
  "directors": [
    {
      "name": "山田太郎",
      "position": "代表取締役",
      "appointed_date": "2015-04-01",
      "confidence": 0.95
    }
  ],
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "extractor_version": "v1.0",
    "overall_confidence": 0.94
  }
}
```

#### employee_list（従業員名簿）

```json
{
  "$schema": "extracted/employee_list/v1",
  "reference_date": "2026-01-01",
  "total_count": {
    "value": 28,
    "confidence": 0.98
  },
  "breakdown": {
    "full_time": {
      "value": 20,
      "confidence": 0.95
    },
    "part_time": {
      "value": 5,
      "confidence": 0.95
    },
    "contract": {
      "value": 3,
      "confidence": 0.90
    }
  },
  "social_insurance_covered": {
    "value": 23,
    "confidence": 0.88
  },
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "extractor_version": "v1.0",
    "overall_confidence": 0.92
  }
}
```

#### bcp_plan（事業継続力強化計画）

```json
{
  "$schema": "extracted/bcp_plan/v1",
  "certification_number": {
    "value": "20230001234",
    "confidence": 0.98
  },
  "certified_date": {
    "value": "2023-06-15",
    "confidence": 0.95
  },
  "valid_until": {
    "value": "2028-06-14",
    "confidence": 0.95
  },
  "certifying_authority": {
    "value": "経済産業省関東経済産業局",
    "confidence": 0.90
  },
  "status": "valid",
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "extractor_version": "v1.0",
    "overall_confidence": 0.94
  }
}
```

#### innovation_plan（経営革新計画）

```json
{
  "$schema": "extracted/innovation_plan/v1",
  "approval_number": {
    "value": "経革第12345号",
    "confidence": 0.95
  },
  "approved_date": {
    "value": "2024-03-20",
    "confidence": 0.95
  },
  "approving_authority": {
    "value": "東京都",
    "confidence": 0.98
  },
  "plan_title": {
    "value": "AI活用による生産性向上計画",
    "confidence": 0.88
  },
  "valid_until": {
    "value": "2027-03-19",
    "confidence": 0.90
  },
  "status": "valid",
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "extractor_version": "v1.0",
    "overall_confidence": 0.93
  }
}
```

---

## 2. 反映先フィールドマッピング

### 2-1. company_profile への反映

| doc_type | extracted_json path | company_profile field | 優先度 |
|----------|--------------------|-----------------------|--------|
| `registration_cert` | `.company_name.value` | `company_name` | 1 |
| `registration_cert` | `.established_date.value` | `founded_date` | 1 |
| `registration_cert` | `.capital_stock.value` | `capital` | 1 |
| `registration_cert` | `.head_office_address.prefecture` | `prefecture` | 1 |
| `financial_report` | `.revenue.value` | `annual_revenue` | 1 |
| `tax_return` | `.revenue.value` | `annual_revenue` | 2 |
| `financial_report` | `.ordinary_income.value` | `ordinary_income` | 1 |
| `financial_report` | `.employee_count.value` | `employee_count` | 2 |
| `employee_list` | `.total_count.value` | `employee_count` | 1 |
| `employee_list` | `.breakdown.full_time.value` | `full_time_employees` | 1 |
| `bcp_plan` | `.status` | `has_bcp_plan` | 1 |
| `bcp_plan` | `.certified_date.value` | `bcp_certified_date` | 1 |
| `innovation_plan` | `.status` | `has_innovation_plan` | 1 |
| `innovation_plan` | `.approved_date.value` | `innovation_approved_date` | 1 |

### 2-2. 適格性判定（precheck）への反映

| extracted_json path | precheck 対象ルール | 判定内容 |
|--------------------|---------------------|----------|
| `employee_list.total_count.value` | 従業員数制限 | 補助金の従業員数要件を満たすか |
| `registration_cert.established_date.value` | 設立年数要件 | 創業○年以上の要件を満たすか |
| `registration_cert.capital_stock.value` | 資本金要件 | 資本金○円以下の要件を満たすか |
| `financial_report.revenue.value` | 売上高要件 | 売上規模の要件を満たすか |
| `bcp_plan.status` | BCP加点要素 | 事業継続力強化計画認定の有無 |
| `innovation_plan.status` | 経営革新加点 | 経営革新計画承認の有無 |

---

## 3. confidence閾値と反映ルール

### 3-1. 閾値定義

| confidence範囲 | 判定 | 処理 |
|---------------|------|------|
| 0.90 〜 1.00 | 高信頼 | 自動反映可（確認不要） |
| 0.70 〜 0.89 | 中信頼 | 自動反映可（確認推奨マーク付き） |
| 0.50 〜 0.69 | 低信頼 | 手動確認必須（draft保存、反映は保留） |
| 0.00 〜 0.49 | 不信頼 | 反映せず（エラーログのみ） |

### 3-2. 競合時の優先順位

同じフィールドに複数の書類から抽出値がある場合の優先ルール。

```
優先度1: 直近アップロード日の書類
優先度2: confidence値が高い方
優先度3: 公的証明書 > 社内書類
```

**公的証明書の例**：
- registration_cert（登記簿謄本）
- tax_return（確定申告書）
- bcp_plan（BCP認定書）
- innovation_plan（経営革新計画承認書）

**社内書類の例**：
- financial_report（決算報告書 ※税務申告前）
- employee_list（従業員名簿）

### 3-3. 反映フロー（Phase 2実装想定）

```
1. 書類アップロード
   ↓
2. OCR/LLM抽出 → extracted_json 保存
   ↓
3. confidence チェック
   - 低信頼(< 0.70): 「要確認」フラグを立てて保存
   - 高信頼(>= 0.90): 自動反映候補としてキュー投入
   ↓
4. 競合チェック
   - 既存データと比較
   - 優先順位に基づいて反映判断
   ↓
5. company_profile 更新
   - 更新履歴をaudit_logに記録
   - 変更前後の値を保存
   ↓
6. precheck 再実行（任意）
   - 適格性判定を再計算
```

---

## 4. データ検証ルール

### 4-1. 形式検証

| フィールド | 検証ルール |
|-----------|-----------|
| `revenue.value` | 正の整数、上限10兆円 |
| `capital_stock.value` | 正の整数、上限100億円 |
| `employee_count` | 正の整数、上限10万人 |
| `established_date` | ISO8601日付形式、1900-01-01以降 |
| `certified_date` | ISO8601日付形式、過去の日付 |
| `valid_until` | ISO8601日付形式、certified_date以降 |

### 4-2. 論理検証

| 検証項目 | ルール |
|---------|--------|
| 従業員数整合 | `total_count >= full_time + part_time + contract` |
| 資本金整合 | 登記簿の資本金と決算書の資本金が一致（許容差5%） |
| 設立日整合 | 登記簿の設立日が現在日より過去 |
| 有効期限 | 認定・承認書類の有効期限が現在日より未来 |

---

## 5. エラー処理

### 5-1. 抽出失敗時

```json
{
  "$schema": "extracted/error/v1",
  "error_type": "extraction_failed",
  "error_message": "OCR処理でテキスト抽出に失敗しました",
  "failed_fields": ["revenue", "ordinary_income"],
  "partial_result": {
    "company_name": { "value": "株式会社サンプル", "confidence": 0.95 }
  },
  "_meta": {
    "extracted_at": "2026-01-22T10:00:00Z",
    "error_code": "E001"
  }
}
```

### 5-2. エラーコード一覧

| コード | 説明 | 対処 |
|--------|------|------|
| E001 | OCR処理失敗 | 画像品質確認、再アップロード |
| E002 | フォーマット不明 | 対応書類タイプか確認 |
| E003 | 必須フィールド欠損 | 手動入力を案内 |
| E004 | 検証エラー | 抽出値の妥当性確認 |
| E005 | 競合エラー | 既存データとの不一致確認 |

---

## 6. UI表示仕様（参考）

### 6-1. 抽出結果の表示

```
┌─────────────────────────────────────────────┐
│ 決算報告書 (2024年度)                         │
│ アップロード: 2026-01-20                      │
├─────────────────────────────────────────────┤
│ 売上高:      ¥150,000,000   ✅ 高信頼(95%)   │
│ 経常利益:    ¥11,500,000    ✅ 高信頼(90%)   │
│ 純利益:      ¥8,000,000     ⚠️ 中信頼(88%)   │
│ 従業員数:    25名           ✅ 高信頼(95%)   │
│                                              │
│ [プロフィールに反映] [確認して反映] [破棄]    │
└─────────────────────────────────────────────┘
```

### 6-2. 競合時の表示

```
┌─────────────────────────────────────────────┐
│ ⚠️ 競合検出: 従業員数                         │
├─────────────────────────────────────────────┤
│ 現在の値:    25名（決算報告書より）            │
│ 新しい値:    28名（従業員名簿より）            │
│                                              │
│ どちらを採用しますか？                        │
│ [現在の値を維持] [新しい値に更新] [両方保持]  │
└─────────────────────────────────────────────┘
```

---

## 7. 今後の拡張予定

### Phase 2（実装予定）
- [ ] OCR/LLM抽出パイプライン構築
- [ ] company_documentsへのextracted_json保存
- [ ] 自動反映ワークフロー実装
- [ ] 確認UI実装

### Phase 3（将来）
- [ ] AI推論による書類タイプ自動判定
- [ ] 複数ページ書類のページ分割処理
- [ ] 手書き文字のOCR対応
- [ ] 外国語書類対応

---

## 付録: 関連テーブル

### company_documents（現行）

```sql
CREATE TABLE company_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  extracted_json TEXT,  -- ← 抽出結果を保存
  extraction_confidence REAL,
  extraction_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

### company_profile（現行）

```sql
CREATE TABLE company_profile (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL UNIQUE,
  -- 基本情報
  employee_count INTEGER,
  full_time_employees INTEGER,
  capital INTEGER,
  annual_revenue INTEGER,
  ordinary_income INTEGER,
  founded_date TEXT,
  prefecture TEXT,
  -- 加点要素
  has_bcp_plan INTEGER DEFAULT 0,
  bcp_certified_date TEXT,
  has_innovation_plan INTEGER DEFAULT 0,
  innovation_approved_date TEXT,
  -- メタ
  profile_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

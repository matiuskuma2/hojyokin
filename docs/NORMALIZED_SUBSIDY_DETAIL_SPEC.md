# NormalizedSubsidyDetail 仕様書 v1.0

## 目的

補助金詳細データの「単一の真実の情報源（SSOT）」として、以下を実現する：

1. **detail_json の構造差を吸収** - 補助金ごとに異なるキー名を統一フォーマットに変換
2. **API/フロント間の型整合性を保証** - フロントエンドが参照するフィールドを固定
3. **将来の拡張に対応** - 新しい補助金タイプが追加されても破綻しない

---

## データ変換フロー

```
┌─────────────────────────────────────────────────────────────────┐
│                      subsidy_cache テーブル                      │
│  ┌─────────────┐  ┌────────────────────────────────────────┐   │
│  │ 基本フィールド │  │           detail_json (raw)            │   │
│  │ id, title   │  │ subsidy_overview, eligibility_...     │   │
│  └─────────────┘  └────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   normalizeSubsidyDetail()    │
              │   サーバ側で変換               │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   NormalizedSubsidyDetail     │
              │   API レスポンス形式           │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   フロントエンド               │
              │   normalized.xxx を参照       │
              └───────────────────────────────┘
```

---

## NormalizedSubsidyDetail JSON Schema

```typescript
/**
 * 正規化された補助金詳細
 * フロントエンドはこの型のフィールドだけを参照する
 */
interface NormalizedSubsidyDetail {
  // ========== 識別子 ==========
  /** canonical_id（SSOT検索で使用） */
  id: string;
  /** cache_id（subsidy_cache.id） */
  cache_id: string;
  /** snapshot_id（latest_snapshot_id） */
  snapshot_id: string | null;
  /** データソース */
  source_type: 'jgrants' | 'manual';
  
  // ========== 基本情報 ==========
  /** 補助金名称（必須） */
  title: string;
  /** 概要（必須） */
  overview: string;
  /** 目的 */
  purpose: string | null;
  /** 発行機関 */
  issuer: string | null;
  /** 担当部署 */
  issuer_department: string | null;
  /** 事務局 */
  secretariat: string | null;
  
  // ========== 金額・補助率 ==========
  /** 補助上限額 */
  max_amount: number | null;
  /** 補助下限額 */
  min_amount: number | null;
  /** 補助率（テキスト） */
  subsidy_rate: string | null;
  /** 申請区分（複数ある場合） */
  application_types: ApplicationType[] | null;
  
  // ========== 期間 ==========
  /** 申請開始日（ISO8601） */
  acceptance_start: string | null;
  /** 申請終了日（ISO8601） */
  acceptance_end: string | null;
  /** 受付中フラグ */
  is_accepting: boolean;
  /** 残り日数 */
  days_remaining: number | null;
  
  // ========== 対象 ==========
  /** 対象地域 */
  target_area: string;
  /** 対象業種 */
  target_industry: string | null;
  /** 対象事業者規模定義 */
  enterprise_definitions: EnterpriseDefinition[] | null;
  
  // ========== 要件（正規化済み） ==========
  /** 申請要件リスト */
  eligibility_rules: EligibilityRule[];
  
  // ========== 経費（正規化済み） ==========
  /** 対象経費 */
  eligible_expenses: EligibleExpenses;
  
  // ========== 書類（正規化済み） ==========
  /** 必要書類 */
  required_documents: RequiredDocument[];
  
  // ========== 加点要素 ==========
  /** 加点項目 */
  bonus_points: BonusPoint[];
  
  // ========== 壁打ち用 ==========
  /** 壁打ち質問リスト */
  wall_chat_questions: WallChatQuestion[];
  /** 壁打ち可能フラグ */
  wall_chat_ready: boolean;
  /** 壁打ちに不足している項目 */
  wall_chat_missing: string[];
  
  // ========== 申請情報 ==========
  /** 電子申請かどうか */
  is_electronic_application: boolean;
  /** 申請方法 */
  application_method: string | null;
  /** 申請フロー */
  application_flow: ApplicationStep[] | null;
  
  // ========== URL・添付 ==========
  /** 公式URL */
  official_url: string | null;
  /** 添付ファイル */
  attachments: Attachment[];
  
  // ========== 連絡先 ==========
  /** 問い合わせ先 */
  contact: ContactInfo | null;
  
  // ========== メタ情報 ==========
  /** 最終更新日 */
  last_updated: string | null;
  /** 公募要領ソース */
  koubo_source: string | null;
  /** データバージョン */
  data_version: string | null;
}

// ========== サブタイプ定義 ==========

interface ApplicationType {
  name: string;
  min_amount: number | null;
  max_amount: number | null;
  subsidy_rate: string | null;
  process_requirement: string | null;
}

interface EnterpriseDefinition {
  industry: string;
  capital: string | null;
  employees: string | null;
}

interface EligibilityRule {
  id: string;
  category: string;
  rule_text: string;
  check_type: 'AUTO' | 'MANUAL';
  source_text: string | null;
}

interface EligibleExpenses {
  categories: ExpenseCategory[];
  notes: string[];
  not_eligible: string[];
}

interface ExpenseCategory {
  name: string;
  description: string | null;
}

interface RequiredDocument {
  id: string;
  name: string;
  description: string | null;
  required_level: 'required' | 'conditional' | 'optional';
  phase: string;
  sort_order: number;
}

interface BonusPoint {
  category: string;
  name: string;
  description: string | null;
  points: string | null;
  reference_url: string | null;
}

interface WallChatQuestion {
  category: string;
  question: string;
  purpose: string | null;
  input_type: 'text' | 'number' | 'boolean' | 'select';
  options: string[] | null;
}

interface ApplicationStep {
  step: number;
  title: string;
  description: string | null;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  file_type: string | null;
  file_size: number | null;
}

interface ContactInfo {
  name: string | null;
  organization: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}
```

---

## detail_json キーのマッピング表

| detail_json キー | Normalized フィールド | 備考 |
|-----------------|---------------------|------|
| `subsidy_overview` | `overview` | |
| `subsidy_purpose` | `purpose` | |
| `issuer` | `issuer` | |
| `issuer_department` | `issuer_department` | |
| `secretariat` | `secretariat` | |
| `application_types` | `application_types` | 配列 |
| `subsidy_rates` | (application_types内に統合) | |
| `eligibility_requirements.basic_requirements` | `eligibility_rules[category='基本要件']` | |
| `eligibility_requirements.productivity_requirements` | `eligibility_rules[category='生産性向上要件']` | |
| `eligibility_requirements.wage_requirements_*` | `eligibility_rules[category='賃金引上げ要件']` | |
| `eligibility_requirements.enterprise_definitions` | `enterprise_definitions` | |
| `eligible_expenses.categories` | `eligible_expenses.categories` | |
| `eligible_expenses.notes` | `eligible_expenses.notes` | |
| `required_documents.common` | `required_documents[phase='共通']` | |
| `required_documents.individual` | `required_documents[phase='個人向け']` | |
| `required_documents.corporation` | `required_documents[phase='法人向け']` | |
| `wall_chat_questions` | `wall_chat_questions` | input_type推測 |
| `bonus_points` | `bonus_points` | |
| `application_flow` | `application_flow` | |
| `contact_info` | `contact` | |
| `official_urls.main` | `official_url` | |
| `pdf_attachments` | `attachments` | |

---

## 旧構造（ものづくり補助金等）のマッピング

| detail_json キー | Normalized フィールド |
|-----------------|---------------------|
| `overview` | `overview` |
| `description` | `purpose` |
| `target_businesses` | `enterprise_definitions`に変換 |
| `eligibility_requirements.basic` | `eligibility_rules[category='基本要件']` |
| `eligibility_requirements.mandatory_commitments` | `eligibility_rules[category='必須要件']` |
| `eligibility_requirements.scale_requirements` | `enterprise_definitions` |
| `eligibility_requirements.exclusions` | `eligibility_rules[category='対象外']` |

---

## API レスポンス形式

### GET /api/subsidies/:id

```json
{
  "success": true,
  "data": {
    "normalized": { /* NormalizedSubsidyDetail */ },
    "evaluation": { /* 評価結果（会社指定時のみ） */ },
    "raw_detail_json": { /* デバッグ用：detail_json生データ */ }
  }
}
```

**重要**: フロントエンドは `data.normalized.xxx` のみを参照する。

---

## 変換関数の責務

### `resolveSubsidyRef(inputId)`

```typescript
async function resolveSubsidyRef(db: D1Database, inputId: string): Promise<{
  canonical_id: string;
  cache_id: string;
  snapshot_id: string | null;
  source_type: 'jgrants' | 'manual';
} | null>
```

- canonical_id が渡されても cache_id が渡されても解決できる
- 全APIで必ず使用する（重複ロジック禁止）

### `normalizeSubsidyDetail(row, detailJson)`

```typescript
function normalizeSubsidyDetail(
  row: SubsidyCacheRow,
  detailJson: any,
  ref: ResolvedSubsidyRef
): NormalizedSubsidyDetail
```

- detail_json のキー差を吸収
- 不足フィールドは null/[]で返す（undefined禁止）

### `normalizeEligibilityRules(eligibilityRequirements)`

```typescript
function normalizeEligibilityRules(
  subsidyId: string,
  eligibility: any
): EligibilityRule[]
```

- 新構造（basic_requirements等）も旧構造（basic等）も吸収
- 常に同じ形式の配列を返す

---

## 実装優先度

### P0（即日）
1. `resolveSubsidyRef` 共通関数作成
2. `normalizeSubsidyDetail` 関数作成
3. `/api/subsidies/:id` のレスポンスに `normalized` を追加

### P1（翌日）
4. フロントエンドを `normalized.xxx` 参照に移行
5. 他のAPI（eligibility/documents/expenses）を normalized で返す

### P2（後日）
6. 旧フィールド参照の完全削除
7. テストケース追加

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| v1.0 | 2026-02-05 | 初版作成 |

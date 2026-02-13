# P0 壁打ちチャット改善 実装計画書

**文書ID**: WALLCHAT-P0-PLAN-001
**ステータス**: 承認待ち
**作成日**: 2026-02-13
**最終更新**: 2026-02-13 (Freeze v3.0 整合)
**前提ドキュメント**: [WALLCHAT_ARCHITECTURE_FREEZE.md](./WALLCHAT_ARCHITECTURE_FREEZE.md) v3.0
**目的**: 壁打ちチャットを「補助金の話につながらない」状態から「補助金固有の質問が出る」状態へ改善する
**プロダクトオーナー方針**: 経費×根拠×高速（適合判定の高速化 → 根拠付き説明 → 提案素材 → 加点は後回し）

---

## 問題の根本原因

```
現状のデータフロー:
  detail_json (フラットテキスト多数あり)
    → buildNsdFromCache()
      → content.eligibility_rules: []  ← フラットテキストから抽出していない
      → wall_chat.questions: []        ← 生成していない
    → generateAdditionalQuestions()
      → 優先度1: wall_chat.questions → 0件（空）
      → 優先度2: フォールバック汎用7問が全部出る
    → AI応答
      → NSD.content.eligibility_rules: [] → プロンプトに「主な申請要件」なし
      → 補助金の話につながらない
```

**根本原因**: `detail_json` 内のフラットテキスト（`application_requirements`, `required_documents`, `eligible_expenses` 等）を構造化データに変換する処理が存在しない。

---

## 改善後のデータフロー

```
改善後:
  detail_json (フラットテキスト)
    → buildNsdFromCache() [P0-1: テキスト解析強化]
      → content.eligibility_rules: [3-8件]    ← テキスト分割で抽出
      → content.required_documents: [3-5件]   ← テキスト分割で抽出
      → content.eligible_expenses: [カテゴリ] ← テキスト分割で抽出
    → generateDerivedQuestions() [P0-2: 新関数]
      → derived_text質問: [5-10件]            ← テキストから派生質問生成
    → generateAdditionalQuestions() [P0-3: 優先度統合]
      → 優先度1: eligibility_rules質問 (構造化ルールベース)
      → 優先度2: derived_text質問 (テキスト派生)
      → 優先度3: wall_chat.questions (NSD)
      → 優先度4: 汎用フォールバック
    → AI応答
      → NSD.content.eligibility_rules: [具体的な要件]
      → プロンプトに「主な申請要件: 付加価値額年率3%増加...」
      → 補助金の話に直結する
```

---

## 実装タスク一覧

### P0-0: 回次ID Gate (Freeze v3.0 追加)

**ファイル**: `src/routes/chat.ts` (POST /api/chat/sessions)
**根拠**: Freeze §17.5, §19.2
**優先度**: 最高（これがないと回次混在事故が起きる）
**推定工数**: 2-3時間

**概要**: 壁打ち開始時に入力IDの種別を判定し、制度IDなら最新回次へ変換、受付終了ならブロックする。

```typescript
// resolveOpeningId() の詳細は Freeze §21.2 参照
// セッション作成フローの冒頭に挿入:
//
// 1. canonical テーブルにヒット → 制度ID → 最新回次を検索
// 2. cache テーブルにヒット → 回次ID → 受付状態確認
// 3. 受付終了 → ブロック（管理者例外あり）
// 4. scheme_id, subsidy_title_at_start, acceptance_end_at_start をセッションに保存
```

**DBマイグレーション**: Freeze §18.5 の ALTER TABLE を実行（scheme_id, subsidy_title_at_start, acceptance_end_at_start, nsd_content_hash, draft_mode, nsd_source）

---

### P0-1: `buildNsdFromCache()` テキスト解析強化

**ファイル**: `src/routes/chat.ts` → 新規: `src/lib/derived-questions.ts`
**優先度**: 最高（これがないと全体が動かない）
**概要**: `detail_json` のフラットテキストを構造化データに変換する関数群

#### P0-1a: `parseEligibilityFromText()` 新規作成

**入力**: `detail_json.application_requirements` (文字列)
**出力**: `{ rules: EligibilityRule[], questions: MissingItem[] }`

```typescript
// 例: ものづくり補助金の application_requirements
// "3〜5年の事業計画を策定、付加価値額年率平均3%以上増加、給与支給総額年率平均1.5%以上増加、最低賃金が地域別最低賃金＋30円以上"
//
// → 分割結果:
// rule[0] = { text: "3〜5年の事業計画を策定", check_type: "manual", category: "plan" }
// rule[1] = { text: "付加価値額年率平均3%以上増加", check_type: "manual", category: "kpi" }
// rule[2] = { text: "給与支給総額年率平均1.5%以上増加", check_type: "manual", category: "wage" }
// rule[3] = { text: "最低賃金が地域別最低賃金＋30円以上", check_type: "manual", category: "wage" }
```

**実装方針**:
1. セパレータ（`、`, `。`, `・`, `\n`, `;`, 全角`；`）で分割
2. 各フラグメントを `category` 分類（キーワードマッチ: 従業員→employee, 賃金→wage, 計画→plan, 経費→expense 等）
3. 短すぎるフラグメント（5文字未満）は前フラグメントに結合
4. 各ルールに対応する `MissingItem` 質問を生成

**推定工数**: 2-3時間
**テスト**: REAL-002 (ものづくり), REAL-001 (IT導入), REAL-003 (持続化) で検証

#### P0-1b: `parseRequiredDocsFromText()` 新規作成

**入力**: `detail_json.required_documents` (文字列)
**出力**: `{ docs: RequiredDoc[], questions: MissingItem[] }`

```typescript
// 例: "事業計画書、決算書（直近2期分）、従業員数証明書、賃金台帳"
//
// → 分割結果:
// doc[0] = { name: "事業計画書", required_level: "required", doc_type: "business_plan" }
// doc[1] = { name: "決算書（直近2期分）", required_level: "required", doc_type: "financial_statement" }
// doc[2] = { name: "従業員数証明書", required_level: "required", doc_type: "employee_cert" }
// doc[3] = { name: "賃金台帳", required_level: "required", doc_type: "wage_ledger" }
```

**推定工数**: 1-2時間

#### P0-1c: `parseEligibleExpensesFromText()` 新規作成

**入力**: `detail_json.eligible_expenses` (文字列)
**出力**: `{ categories: string[], excluded: string[] }`

**推定工数**: 1時間

#### P0-1d: `buildNsdFromCache()` 統合

既存の `buildNsdFromCache()` に P0-1a/1b/1c の結果を統合。

```typescript
// 変更前 (現状):
const eligibilityRules = detail.eligibility_rules || detail.content?.eligibility_rules || [];
// → detail_json にフラット文字列のみの場合、常に [] が返る

// 変更後:
let eligibilityRules = detail.eligibility_rules || detail.content?.eligibility_rules || [];
if (eligibilityRules.length === 0 && detail.application_requirements) {
  const parsed = parseEligibilityFromText(detail.application_requirements);
  eligibilityRules = parsed.rules;
}
```

**推定工数**: 1時間

---

### P0-2: `generateDerivedQuestions()` 新規作成

**ファイル**: `src/lib/derived-questions.ts`
**優先度**: 最高
**概要**: detail_json のフラットテキストから補助金固有の質問を生成

#### P0-2a: 固定キー質問マッピング (Freeze済み)

```typescript
const FIXED_QUESTION_KEYS: Record<string, DerivedQuestionTemplate> = {
  // Gate判定用
  has_gbiz_id: {
    label: 'GビズIDプライムアカウントを取得済みですか？',
    input_type: 'boolean', priority: 1, source: 'derived_text',
    trigger: (nsd) => nsd.electronic_application.is_electronic_application === true,
  },
  tax_arrears: {
    label: '税金の滞納はありませんか？',
    input_type: 'boolean', priority: 2, source: 'derived_text',
    trigger: () => true, // 常に聞く
  },
  past_subsidy_same_type: {
    label: '過去3年以内に同種の補助金を受給していますか？',
    input_type: 'boolean', priority: 3, source: 'derived_text',
    trigger: () => true,
  },
  
  // 要件確認用 (application_requirements から派生)
  plans_wage_raise: {
    label: '今後1年以内に賃上げ（ベースアップ）を予定していますか？',
    input_type: 'boolean', priority: 4, source: 'derived_text',
    trigger: (nsd, detail) => /賃上げ|賃金|給与/.test(detail.application_requirements || ''),
  },
  
  // 投資・計画用
  investment_amount: {
    label: '予定している投資額はおおよそいくらですか？（万円単位）',
    input_type: 'number', priority: 5, source: 'derived_text',
    trigger: () => true,
  },
  expense_breakdown: {
    label: '投資の内訳を教えてください（機械装置費、システム構築費など）',
    input_type: 'text', priority: 6, source: 'derived_text',
    trigger: (nsd, detail) => !!detail.eligible_expenses,
  },
  project_summary: {
    label: '補助金で実施したい事業の概要を教えてください',
    input_type: 'text', priority: 7, source: 'derived_text',
    trigger: () => true,
  },
  schedule_timeline: {
    label: '事業のスケジュール（開始時期〜完了時期）を教えてください',
    input_type: 'text', priority: 8, source: 'derived_text',
    trigger: () => true,
  },
  kpi_targets: {
    label: '達成したいKPI・数値目標はありますか？（売上増加率、生産性向上率など）',
    input_type: 'text', priority: 9, source: 'derived_text',
    trigger: (nsd, detail) => /付加価値|KPI|目標|計画/.test(detail.application_requirements || ''),
  },
  application_category: {
    label: '申請する枠・類型を教えてください',
    input_type: 'select', priority: 10, source: 'derived_text',
    trigger: (nsd, detail) => !!detail.application_category_options,
    optionsGenerator: (detail) => detail.application_category_options || [],
  },
};
```

#### P0-2b: テキスト派生質問の動的生成

`application_requirements` の各ルールに対して、未回答かつ判定不能なものを質問に変換。

```typescript
function generateDerivedQuestions(
  nsd: NormalizedSubsidyDetail,
  detail: Record<string, any>,
  company: Record<string, any>,
  existingFacts: Map<string, string>
): MissingItem[] {
  const questions: MissingItem[] = [];
  
  // 1. 固定キー質問（trigger条件を評価）
  for (const [key, template] of Object.entries(FIXED_QUESTION_KEYS)) {
    if (existingFacts.has(key)) continue;
    if (isAnsweredByCompany(key, company)) continue;
    if (!template.trigger(nsd, detail)) continue;
    questions.push({
      key,
      label: template.label,
      input_type: template.input_type,
      source: template.source,
      priority: template.priority,
      options: template.optionsGenerator?.(detail),
    });
  }
  
  // 2. eligibility_rules 由来の確認質問
  for (const rule of nsd.content.eligibility_rules) {
    const factKey = `elig_${hashKey(rule.rule_text)}`;
    if (existingFacts.has(factKey)) continue;
    questions.push({
      key: factKey,
      label: `以下の要件を満たしていますか？\n「${rule.rule_text}」`,
      input_type: 'boolean',
      source: 'eligibility_rule',
      priority: 2,
      reason: `申請要件: ${rule.category}`,
    });
  }
  
  // 3. required_documents 由来の確認質問
  for (const doc of nsd.content.required_documents) {
    const factKey = `doc_${hashKey(doc.name || doc.doc_code)}`;
    if (existingFacts.has(factKey)) continue;
    questions.push({
      key: factKey,
      label: `「${doc.name}」を準備できますか？`,
      input_type: 'boolean',
      source: 'required_doc',
      priority: 3,
      reason: '必要書類',
    });
  }
  
  return questions;
}
```

**推定工数**: 3-4時間

---

### P0-3: `generateAdditionalQuestions()` リファクタリング

**ファイル**: `src/routes/chat.ts`
**優先度**: 高
**概要**: 質問ソースの優先順位を Freeze仕様に合わせて統合

```typescript
// 変更後の generateAdditionalQuestions:
function generateAdditionalQuestions(
  company: Record<string, any>,
  normalized: NormalizedSubsidyDetail | null,
  existingFacts: Map<string, string>,
  detail: Record<string, any> = {}  // P0追加: buildNsdFromCacheから渡す
): MissingItem[] {
  const allQuestions: MissingItem[] = [];
  
  // 優先度1: 構造化データ由来（eligibility_rules, required_docs）
  // → P0-2 の generateDerivedQuestions() で生成済みのものを統合
  
  // 優先度2: derived_text 質問（P0-2で生成）
  if (normalized) {
    const derived = generateDerivedQuestions(normalized, detail, company, existingFacts);
    allQuestions.push(...derived);
  }
  
  // 優先度3: wall_chat.questions（NSDに構造化質問がある場合）
  // 既存ロジックの normalized.wall_chat.questions 部分
  
  // 優先度4: 汎用フォールバック（既存の7問）
  // ただし、優先度1-3で質問が十分（5問以上）あればスキップ
  if (allQuestions.length < 5) {
    const generic = generateGenericFallbackQuestions(company, existingFacts);
    allQuestions.push(...generic);
  }
  
  // ソート: priority昇順
  allQuestions.sort((a, b) => a.priority - b.priority);
  
  return allQuestions;
}
```

**推定工数**: 2時間

---

### P0-4: AIプロンプト強化

**ファイル**: `src/lib/ai-concierge.ts`
**優先度**: 高
**概要**: NSD内のフラットテキスト情報をAIプロンプトに含める

#### P0-4a: `formatSubsidyInfo()` 強化

現状: NSD の `content.eligibility_rules[]` が空のため「主な申請要件」セクションが空

```typescript
// 変更後:
function formatSubsidyInfo(subsidy: NormalizedSubsidyDetail): string {
  let info = `【補助金情報】\n`;
  info += `名称: ${subsidy.display.title}\n`;
  info += `上限: ${subsidy.display.subsidy_max_limit ? formatCurrency(subsidy.display.subsidy_max_limit) : '不明'}\n`;
  info += `補助率: ${subsidy.display.subsidy_rate_text || '不明'}\n`;
  
  // P0追加: eligibility_rules がある場合
  if (subsidy.content.eligibility_rules.length > 0) {
    info += `\n【主な申請要件】\n`;
    subsidy.content.eligibility_rules.forEach((rule: any, i: number) => {
      info += `${i+1}. ${rule.rule_text || rule.text}\n`;
    });
  }
  
  // P0追加: required_documents がある場合
  if (subsidy.content.required_documents.length > 0) {
    info += `\n【必要書類】\n`;
    subsidy.content.required_documents.forEach((doc: any, i: number) => {
      info += `${i+1}. ${doc.name || doc.doc_code}\n`;
    });
  }
  
  // P0追加: bonus_points がある場合
  if (subsidy.content.bonus_points.length > 0) {
    info += `\n【加点項目】\n`;
    subsidy.content.bonus_points.forEach((bp: any, i: number) => {
      info += `${i+1}. ${bp.name || bp.description}\n`;
    });
  }
  
  return info;
}
```

#### P0-4b: detail_json フラットテキストのフォールバック

`eligibility_rules` が空の場合でも、`detail_json.application_requirements` 等のフラットテキストをプロンプトに直接含める。

```typescript
// ai-concierge.ts に追加
function formatDetailJsonFallback(detail: Record<string, any>): string {
  let info = '';
  
  if (detail.application_requirements) {
    info += `\n【申請要件（原文）】\n${detail.application_requirements}\n`;
  }
  if (detail.required_documents && typeof detail.required_documents === 'string') {
    info += `\n【必要書類（原文）】\n${detail.required_documents}\n`;
  }
  if (detail.eligible_expenses && typeof detail.eligible_expenses === 'string') {
    info += `\n【対象経費（原文）】\n${detail.eligible_expenses}\n`;
  }
  if (detail.overview) {
    info += `\n【概要】\n${detail.overview}\n`;
  }
  
  return info;
}
```

**推定工数**: 2時間

---

### P0-5: `detail_json` をチャット関数に伝搬

**ファイル**: `src/routes/chat.ts`
**優先度**: 高
**概要**: buildNsdFromCacheで取得した detail_json の生データを後続関数に渡す

現状: `buildNsdFromCache()` は NSD を返すが、元の `detail_json` のフラットテキストは捨てている。
改善: NSD と一緒に `detail_json` の生データも返し、AI プロンプトや質問生成で利用する。

```typescript
// 変更案: buildNsdFromCache の戻り値を拡張
interface NsdWithDetail {
  nsd: NormalizedSubsidyDetail;
  detailRaw: Record<string, any>;  // detail_json のパース結果
}

// または、NSD に追加フィールドとして持たせる
// nsd._meta = { detail_raw: detail }  （非公式フィールド）
```

**推定工数**: 1-2時間

---

## 実装順序と依存関係（Freeze v3.0 改訂版）

> ⚠ **Freeze v3.0 (§21) で並び替え済み。以下が最新の実装順序。**

```
Phase 0: Gate（回次ID厳格化）
  P0-0 (resolveOpeningId) ─── §17, §19

Phase 1: テキスト解析（経費最優先）
  P0-1c (parseEligibleExpensesFromText)  ─┐
  P0-1a (parseEligibilityFromText)         ├─ P0-1d (buildNsdFromCache統合)
  P0-1b (parseRequiredDocsFromText)       ─┘

Phase 2: 根拠リンク最低限
  P0-7b (metadata source_ref + as_of)

Phase 3: 質問生成（ドラフト欠損優先）
  P0-2a (固定キー質問マッピング) ─┐
  P0-2b (generateDerivedQuestions)  ├─ P0-3 (generateAdditionalQuestions統合)
                                   ┘

Phase 4: 周辺整備
  P0-5  (detail_json伝搬)
  P0-6  (draft_mode + content_hash + DB migration)
  P0-4a (formatSubsidyInfo強化)
  P0-4b (detail_jsonフォールバック)
  P0-8  (canonical未解決UI警告)

Phase 5: テスト + デプロイ
  [ビルド → 単体テスト → 統合テスト → デプロイ]
```

**プロダクトオーナー方針による並び替え理由**:
- **経費（P0-1c）を先頭に**: 「使えるか」を最速判定 = 士業の価値
- **Gate（P0-0）を最初に**: 回次混在を構造的に防止
- **根拠（P0-7b）を質問生成の前に**: source_ref を質問と同時に記録するため

---

## Freeze追記 (v2.0) で追加されたP0タスク

以下は WALLCHAT_ARCHITECTURE_FREEZE.md セクション 11-16 で定義された仕様のうち、
P0 で必ず対応すべき項目。

### P0-6: draft_mode 判定 + content_hash セッション保存

**根拠**: Freeze セクション 12（draft_mode判定基準）、セクション 11.4（矛盾解決）

#### P0-6a: `determineDraftMode()` 実装

```typescript
// src/lib/derived-questions.ts に追加
function determineDraftMode(
  nsd: NormalizedSubsidyDetail,
  detailRaw: Record<string, any>
): 'full_template' | 'structured_outline' | 'eligibility_only' {
  const forms = nsd.content.required_forms || [];
  const hasStructuredForms = forms.length >= 1 
    && forms.some(f => (f.fields?.length || 0) >= 3);
  if (hasStructuredForms) return 'full_template';
  
  const isElectronic = nsd.electronic_application.is_electronic_application;
  const noForms = forms.length === 0;
  const noRequirements = !detailRaw.application_requirements;
  if (isElectronic && noForms && noRequirements) return 'eligibility_only';
  
  return 'structured_outline';
}
```

#### P0-6b: DB マイグレーション (Freeze v3.0 §18.5 統合版)

```sql
-- Freeze v3.0: 制度×回次モデル + セッション固定仕様
-- chat_sessions に回次スナップショット情報を追加

-- 制度ID（整理用、NULLable）
ALTER TABLE chat_sessions ADD COLUMN scheme_id TEXT;

-- 開始時点のスナップショット（矛盾防止 §11.4）
ALTER TABLE chat_sessions ADD COLUMN subsidy_title_at_start TEXT;
ALTER TABLE chat_sessions ADD COLUMN acceptance_end_at_start TEXT;

-- データ整合性（§12, §14）
ALTER TABLE chat_sessions ADD COLUMN nsd_content_hash TEXT;
ALTER TABLE chat_sessions ADD COLUMN draft_mode TEXT;
ALTER TABLE chat_sessions ADD COLUMN nsd_source TEXT DEFAULT 'ssot';
```

#### P0-6c: セッション作成時に保存

- `POST /api/chat/sessions` で `determineDraftMode()` を呼び出し、結果を `chat_sessions.draft_mode` に保存
- `detail_json` のハッシュを `nsd_content_hash` に保存
- NSD ソース種別（'ssot' / 'cache' / 'mock'）を `nsd_source` に保存

#### P0-6d: セッション再開時の hash 比較

- 既存セッション復元時に現在の `content_hash` と保存済み `nsd_content_hash` を比較
- 異なる場合は `missing_items` を再計算し、UIに更新通知を含める

**推定工数**: 3時間

### P0-7: facts provenance 拡張

**根拠**: Freeze セクション 13（facts provenance）

#### P0-7a: source の値域拡張

現状: `source = 'chat'` 固定 → Freeze定義の7種に拡張

```typescript
// chat.ts の INSERT INTO chat_facts で source を動的に設定
// - 構造化質問への回答: 'chat'
// - derived_text由来の質問への回答: 'chat' (質問のsourceはmetadataに記録)
// - profile 自動取得: 'profile'
// - 書類抽出: 'document' (P1)
```

#### P0-7b: metadata に source_ref と as_of を追加

```typescript
// 現状の factMetadata:
{ input_type, question_label, raw_answer, parsed_answer }

// P0追加:
{
  input_type, question_label, raw_answer, parsed_answer,
  source_ref: {
    type: 'derived_text' | 'eligibility_rule' | 'generic' | 'wall_chat_question',
    field: 'application_requirements',  // テキスト派生の場合
    subsidy_id: 'REAL-002',
  },
  as_of: '2026-02-13T10:00:00Z'
}
```

**推定工数**: 2時間

### P0-8: canonical未解決時のUI警告

**根拠**: Freeze セクション 14（canonical未解決の扱い）

- `nsd_source = 'cache'` の場合、フロントエンドに `⚠ 簡易データに基づく壁打ちです` を表示
- `draft_mode` の制限: cache時は `full_template` を禁止 → `structured_outline` に降格

**推定工数**: 1時間

---

## 更新後の実装順序と依存関係（全体）

> ⚠ **この旧版は v2.0 時点のものです。最新は上の「Freeze v3.0 改訂版」を参照してください。**
> **主な差分**: P0-0 (回次Gate) が追加、P0-1c (経費) が先頭へ移動、DB migration が §18.5 統合版に拡張。

---

## テスト計画（Freeze v3.1 改訂版）

### 単体テスト

| テストID | テスト内容 | 入力 | 期待結果 |
|---------|-----------|------|---------|
| T1 | parseEligibilityFromText 分割 | "3〜5年の事業計画を策定、付加価値額年率平均3%以上増加" | 2件のルール |
| T2 | parseEligibilityFromText 空文字列 | "" | [] |
| T3 | parseRequiredDocsFromText 分割 | "事業計画書、決算書（直近2期分）" | 2件のドキュメント |
| T4 | generateDerivedQuestions trigger | 電子申請の NSD | has_gbiz_id 質問が含まれる |
| T5 | generateDerivedQuestions 賃上げ | "賃上げ" を含む requirements | plans_wage_raise 質問が含まれる |
| T6 | generateAdditionalQuestions 統合 | derived 5件以上 | フォールバック質問なし |
| T7 | buildNsdFromCache 強化 | REAL-002 の detail_json | eligibility_rules ≥ 3件 |
| T8 | determineDraftMode full_template | required_forms[].fields≥3 | 'full_template' |
| T9 | determineDraftMode eligibility_only | 電子申請+フォームなし+要件なし | 'eligibility_only' |
| T10 | determineDraftMode デフォルト | requirements文字列あり | 'structured_outline' |
| T11 | facts metadata source_ref | derived_text質問回答 | metadata.source_ref.type = 'derived_text' |
| T12 | content_hash 比較 | detail_json更新後セッション再開 | missing_items 再計算される |
| T13 | resolveOpeningId: 制度→最新回次 | canonical_id | 受付中で締切最近の cache_id が返る |
| T14 | resolveOpeningId: 受付終了ブロック | 過去締切の cache_id | エラー「受付終了」 |
| T15 | resolveOpeningId: 受付中なし | 全回次終了の canonical_id | エラー「公募中の回次なし」 |
| T16 | parseEligibleExpensesFromText | "機械装置費、システム構築費..." | categories ≥ 2件 |
| T17 | judgeExpense: 対象経費 OK | 機械装置費 → ものづくり | status = 'OK' |
| T18 | judgeExpense: 除外経費 NG | 広告宣伝費 → ものづくり | status = 'NG', reason含む |
| T19 | judgeExpense: 条件付き | リース契約 → ものづくり | status = 'CONDITIONAL' |
| T20 | judgeExpense: 情報不足 | カテゴリ不明 | status = 'INSUFFICIENT' |
| T21 | judgeProject: PASS_POSSIBLE | 全要件OK | status = 'PASS_POSSIBLE' |
| T22 | judgeProject: BLOCKED | SME不適合 | status = 'BLOCKED' |
| T23 | judgeProject: RISK_HIGH | 賃上げ未確認 | status = 'RISK_HIGH' |
| T24 | judgeProject: INSUFFICIENT | 事業概要未入力 | status = 'INSUFFICIENT' |
| T25 | 質問優先順: 事業骨格→ブロック→経費 | REAL-002 | 最初の3問が事業骨格系 |

### 統合テスト（本番検証）

| テストID | シナリオ | 確認ポイント |
|---------|---------|-------------|
| IT1 | REAL-002 で壁打ち開始 | 初期質問に「事業概要」「投資額」「経費内訳」が含まれる |
| IT2 | 7問回答後のconsultingモード | AIが「ものづくり補助金」の具体的要件に言及する |
| IT3 | 汎用補助金（izumi系）で壁打ち | フォールバック質問＋テキスト派生質問が混在 |
| IT4 | detail_json が空の補助金 | 従来通りフォールバック質問が表示される |
| IT5 | 制度IDで壁打ち開始 | 最新回次に自動変換されセッション作成 |
| IT6 | 受付終了回次で壁打ち開始 | エラー表示、壁打ち不可 |
| IT7 | 経費「機械装置費」を回答 | judgeExpense = OK が壁打ち中に返る |
| IT8 | 経費「広告費」を回答 | judgeExpense = NG + 理由が壁打ち中に返る |
| IT9 | 全質問回答後の総合判定 | judgeProject が表示される |
| IT10 | BLOCKED判定時のドラフト | ドラフト生成ボタンが非表示 or 警告 |

---

## 成功基準（Freeze v3.1 改訂版）

| 指標 | 現状 | P0完了後 |
|------|------|---------|
| **回次Gate**: 制度IDで壁打ち不可 | 制限なし | 制度ID→最新回次自動変換 or ブロック |
| **回次Gate**: 受付終了で壁打ち不可 | 制限なし | 受付終了→ブロック（管理者例外） |
| **経費判定**: 経費カテゴリの可否が返る | 未実装 | 4値判定 (OK/CONDITIONAL/NG/INSUFFICIENT) |
| **総合判定**: 事業全体の採択可能性が返る | 未実装 | 4値判定 (PASS_POSSIBLE/RISK_HIGH/BLOCKED/INSUFFICIENT) |
| **質問優先度**: 事業骨格→ブロック→経費 | 汎用7問 | §23.6 の優先度順 |
| REAL-002 初期質問の補助金関連性 | 0% (汎用質問のみ) | ≥60% (4/7問以上が補助金固有) |
| consultingモードでの補助金言及率 | 低い | 高い（eligibility_rules がプロンプトに入る） |
| detail_json テキスト活用率 | 0% | 100% (全テキストフィールドを何らかの形で利用) |
| draft_mode 判定・表示 | 未実装 | 3パターン表示 |
| facts に source_ref が記録される | 0% | 100% |
| **セッション固定**: scheme_id + title + hash 保存 | なし | 全セッションで保存 |
| canonical未解決時の⚠表示 | なし | cache時に表示 |
| **BLOCKED制御**: 不適合時にドラフト不可 | 制限なし | BLOCKED→ドラフト生成ブロック |

---

## リスクと軽減策

| リスク | 影響度 | 軽減策 |
|--------|-------|--------|
| テキスト分割の精度が低い | 中 | セパレータを段階的に追加、短フラグメント結合。P1でLLM fallback |
| 質問数が多すぎる | 中 | 最大10問に制限（既存仕様）、priority で自然に上位のみ表示 |
| フラットテキストが存在しない補助金 | 低 | フォールバック質問が引き続き機能（現状と同等） |
| AIプロンプトが長すぎる | 低 | テキスト切り詰め（各セクション最大200文字） |
| detail_json の品質ばらつき（jgrants/izumi/manual/HTML/PDF） | 高 | regex で壊れたテキストにも耐える設計。P1でLLM fallback |
| 経費カテゴリの誤判定 | 中 | INSUFFICIENT を返す（誤判定よりは情報不足として安全側に倒す） |
| 総合判定の過剰NG | 低 | BLOCKED は明確なブロック要件のみ。曖昧な場合は RISK_HIGH |

---

## P1以降の展望（本計画では対象外）

| 優先度 | 項目 | 依存 | Freeze参照 |
|--------|------|------|-----------|
| P1 | LLM fallback（テキスト解析品質不足時） | P0-1完了後 | §23.7 |
| P1 | 見積書OCR → 経費fact化 | P0-1c完了後 | §23.3 |
| P1 | 複数経費の組み合わせ判定 | P0-1e完了後 | §23.4 |
| P1 | session.state 5状態への移行 | P0完了後 | §2 |
| P1 | 書類アップロード→fact反映パイプライン | P0完了後 | §4.3 |
| P1 | draft.ts の draft_mode 別テンプレート分岐 | P0-6完了後 | §12 |
| P1 | trace_json ドラフト根拠追跡 | P0-7完了後 | §13.4 |
| P1 | stale 警告 UI（情報が古い場合の⚠） | P0-6d完了後 | §11.3 |
| P1 | 矛盾時の確認質問生成 | P0-7完了後 | §11.4 |
| P2 | レーンA/B UI分離 | P1完了後 | §1.1 |
| P2 | 加点戦略ビュー | P0-4完了後 | §6 |
| P2 | derived_* DB保存（バッチ移行） | パフォーマンス問題時のみ | §15.4 |

---

## Freeze v3.1 による変更サマリー

| 変更点 | 旧 (v3.0) | 新 (v3.1) |
|--------|-----------|-----------|
| **中核エンジン** | テキスト解析のみ | **経費審査エンジン（4値判定）+ 総合判定** |
| **P0-1c scope** | parseEligibleExpensesFromText | + **judgeExpense + 支払/ベンダー条件** |
| **新規タスク P0-1e** | なし | **judgeProject（総合4値判定・最小版）** |
| **質問優先度** | 経費→資格→電子→ドラフト | **事業骨格→ブロック→経費→数値要件→電子→書類→加点** |
| **壁打ちフロー** | 経費→条件→相談 | **事業骨格→ブロック判定→経費判定→総合評価→ドラフト** |
| **ドラフト制御** | 制限なし | **BLOCKED→ドラフト生成不可** |
| **テスト追加** | T1-T16, IT1-IT6 | + **T17-T25, IT7-IT10** |

### 旧 v3.0 変更サマリー

| 変更点 | 旧 (v2.0) | 新 (v3.0) |
|--------|-----------|-----------|
| 実装開始タスク | P0-1a (parseEligibility) | **P0-0 (回次Gate)** |
| 経費解析の順序 | P0-1c (3番目) | **P0-1c (テキスト解析の先頭)** |
| 質問優先度 | 電子申請→資格→経費→加点→ドラフト | **経費→資格→電子→ドラフト→要件→書類→加点** |
| セッション保存 | nsd_content_hash + draft_mode | + **scheme_id, title_at_start, end_at_start** |
| 制度IDでの壁打ち | 制限なし | **ブロック（最新回次へ変換）** |
| 受付終了での壁打ち | 制限なし | **ブロック（管理者例外）** |

---

*この計画書の承認後、P0-0（回次ID Gate）から実装を開始します。*
*Freeze v3.1 (§23-24) との整合性を保証します。*

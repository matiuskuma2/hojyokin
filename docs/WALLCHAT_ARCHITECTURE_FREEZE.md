# 壁打ちチャット アーキテクチャ仕様書 (Freeze)

**文書ID**: WALLCHAT-ARCH-001
**ステータス**: Freeze (設計確定)
**作成日**: 2026-02-13
**最終更新**: 2026-02-13
**対象ファイル**:
- `src/routes/chat.ts` (2,401行)
- `src/lib/ai-concierge.ts` (687行)
- `src/pages/chat.tsx` (1,404行)
- `src/routes/draft.ts`
- `src/lib/ssot/normalizeSubsidyDetail.ts`

---

## 1. ミッション定義

壁打ちチャットは **「その企業がその補助金を申請できるか判定し、申請書の叩き台を作れる状態まで持っていく」** ためのシステムである。

### 1.1 二重ターゲット設計

| レーン | ターゲット | 特徴 |
|--------|-----------|------|
| **レーンB** | 経営者（セルフ診断） | 短時間・迷わない・やることリストと叩き台まで最短 |
| **レーンA** | 士業・コンサル向け | 深掘り・根拠・例外・加点戦略・顧客提案ができる粒度 |

**重要**: 中核（SSOT/Gate/Eligibility/MissingEngine/DraftEngine）は同じ。差は「聞き方」「深さ」「出力」のみ。

### 1.2 壁打ちの4つの責務

| # | 責務 | 性質 |
|---|------|------|
| 1 | **事前適合チェック (Gate)** | ルールベース判定。AIではなくSSOT x CompanySSOTで決まる |
| 2 | **要件充足ヒアリング (Structured Wall)** | 壁打ちの本体。公募要領ベースの構造化質問 |
| 3 | **戦略相談・提案 (AI Consult)** | 生成AIが価値を出す部分。企業固有の提案 |
| 4 | **叩き台生成 (Draft)** | Structuredで集めた情報を構造化して出力 |

---

## 2. 状態機械 (Session State Machine)

### 2.1 状態定義 (Freeze)

```
session.state =
  "precheck"               -- Gate判定。NG/OK/OK_WITH_MISSING
  | "structured_collecting" -- 必須要件 → 記述要件の順に質問
  | "consulting"            -- 自由相談（質問が尽きた後にのみ解放）
  | "ready_for_draft"       -- ドラフト生成可能
  | "draft_generated"       -- ドラフト生成済み
```

### 2.2 状態遷移図

```
[壁打ちボタン押下]
        |
        v
  +--[precheck]--+
  |              |
  | status=NG    | status=OK / OK_WITH_MISSING
  v              v
 [終了]   [structured_collecting]
                |
                | (全質問回答完了)
                v
         [consulting]
                |
                | (ユーザーが「申請書作成」押下)
                v
         [ready_for_draft]
                |
                | (POST /api/draft/generate)
                v
         [draft_generated]
```

### 2.3 現状の実装とのギャップ

| 設計上の状態 | 現在のDB値 | 備考 |
|-------------|-----------|------|
| precheck | (APIレスポンスのみ、DBに状態なし) | セッション作成時に判定 |
| structured_collecting | `collecting` | OK |
| consulting | `consulting` | OK |
| ready_for_draft | `consulting` or `completed` | **未分離** |
| draft_generated | (application_draftsの存在で判定) | **セッション状態に反映されていない** |

**要修正**: `ready_for_draft` と `draft_generated` をセッション状態に追加するか、UIレベルで判定する方式を確定する。

---

## 3. draft_mode（叩き台が作れるかの分類）(Freeze)

### 3.1 分類定義

```ts
draft_mode:
  | "full_template"        // 書式あり → 申請書叩き台生成可能
  | "structured_outline"   // 書式なし → セクション構成 + 例文
  | "eligibility_only"     // 電子申請で項目不明 → 要件チェック + 準備チェックリスト
```

### 3.2 分類基準

| 条件 | draft_mode |
|------|-----------|
| `required_forms[]` が存在し項目(fields)が明確 | `full_template` |
| `required_forms[]` が存在するが項目が曖昧 / 書式テキストのみ | `structured_outline` |
| `electronic_application.is_electronic = true` かつ `required_forms[]` が空 | `eligibility_only` |
| データ不足でいずれにも該当しない | `structured_outline` (デフォルト) |

### 3.3 現状

- `detail_json` に `required_forms` を持つのは **手動エンリッチされた一部の補助金のみ** (REAL-001, REAL-002等)
- 大半の補助金は `eligibility_only` に分類される
- **draft_mode フィールドが NSD/subsidy_cache のどちらにも存在しない** → 要追加

### 3.4 UIへの影響

ユーザーに「この補助金で何ができるか」を**壁打ち開始前に明示**する必要がある:

| draft_mode | UI表示 |
|-----------|--------|
| `full_template` | 「申請書の叩き台を作成できます」 |
| `structured_outline` | 「申請準備のアウトラインを作成できます」 |
| `eligibility_only` | 「申請要件の確認と準備チェックリストを作成できます」 |

---

## 4. データモデル最終フィールド一覧 (Freeze)

### 4.1 CompanySSOT（企業側）

#### 必須 (Required)

| フィールド | 型 | ソース | 用途 |
|-----------|---|-------|------|
| `company.id` | TEXT | companies | 識別子 |
| `company.name` | TEXT | companies | 表示/ドラフト |
| `company.prefecture` | TEXT | companies | 地域要件判定 |
| `company.industry_major` | TEXT | companies | 業種要件判定 |
| `company.employee_count` | NUMBER | companies | SME判定 |
| `company.capital` | NUMBER | companies | SME判定（必須級） |

#### 推奨 (Recommended)

| フィールド | 型 | ソース | 用途 |
|-----------|---|-------|------|
| `company.city` | TEXT | companies | 地域要件詳細 |
| `company.established_date` | TEXT | companies | 創業年数条件 |
| `company.annual_revenue` | NUMBER | companies | 売上規模条件 |
| `company.business_summary` | TEXT | company_profile | LLMが事業把握する軸 |

#### 申請適格・加点 Facts

| fact_key | 型 | 質問ソース | 用途 |
|---------|---|----------|------|
| `has_gbiz_id` | boolean | generic/eligibility | 電子申請前提 |
| `tax_arrears` | boolean | generic | 申請資格 |
| `past_subsidy_same_type` | boolean | generic | 申請資格 |
| `plans_wage_raise` | boolean | derived_text | 基本要件/加点 |
| `has_business_plan` | boolean | generic | ドラフト前提 |
| `has_keiei_kakushin` | boolean | derived_text/bonus | 加点 |
| `has_jigyou_keizoku` | boolean | derived_text/bonus | 加点 |

#### 投資・計画 Facts

| fact_key | 型 | 質問ソース | 用途 |
|---------|---|----------|------|
| `project_summary` | text | generic | ドラフト核心 |
| `investment_amount` | number | generic | ドラフト核心 |
| `expense_breakdown` | text/json | structured | ドラフト |
| `schedule_timeline` | text | structured | ドラフト |
| `kpi_targets` | text/json | derived_text | ドラフト |
| `current_challenge` | text | generic | ドラフト |

### 4.2 SubsidySSOT（補助金側 / NormalizedSubsidyDetail）

#### 壁打ちに必要な構造化データ

| フィールド | 型 | 現在の状態 | 壁打ちでの用途 |
|-----------|---|-----------|-------------|
| `content.eligibility_rules[]` | array | **DB: 0件 / NSD: 空** | Gate判定 + 構造化質問生成 |
| `content.required_documents[]` | array | **DB: 0件 / NSD: 空** | 書類チェック質問生成 |
| `content.required_forms[]` | array | NSD: 一部あり | draft_mode判定 + ドラフト生成 |
| `content.eligible_expenses` | object | NSD: 一部あり | 経費妥当性確認 |
| `content.bonus_points[]` | array | NSD: 一部あり | 加点戦略質問生成 |
| `wall_chat.questions[]` | array | **未生成（0件）** | 補助金固有質問 |

#### detail_json のフラットテキスト（構造化変換の元データ）

| フィールド | 存在率 | 変換先 |
|-----------|-------|-------|
| `application_requirements` | 高 | → eligibility_rules[] / derived質問 |
| `required_documents` (文字列) | 高 | → required_documents[] |
| `eligible_expenses` (文字列) | 高 | → eligible_expenses |
| `required_forms` (配列) | 低(手動のみ) | → required_forms[] |
| `application_procedure` (文字列) | 高 | → electronic_application判定 |
| `overview` (文字列) | 中 | → overview.summary |

### 4.3 DocumentFacts（アップロード書類から抽出）

#### 対象ドキュメント型

| doc_type | 抽出対象 |
|---------|---------|
| `financial_statement` | capital, revenue, employee_count |
| `business_plan` | project_summary, kpi_targets, schedule |
| `quote` | expense_items, investment_amount |
| `wage_plan` | plans_wage_raise |
| `certification` | certifications, has_keiei_kakushin等 |

#### 反映ルール

| 確信度 | 処理 |
|-------|------|
| 高（数値が明確に抽出） | chat_facts + company_profile に自動反映 → missing_items 減算 |
| 低（曖昧な抽出） | 確認質問に変換（「決算書から売上XX万円と読み取りましたが正しいですか？」） |

#### 現状

- **company_documentsテーブルは存在**するが、壁打ちロジックに組み込まれていない
- テキスト抽出 → fact反映のパイプラインは**未実装**

---

## 5. 質問生成器仕様 (Freeze)

### 5.1 入出力

**入力**:
- CompanySSOT（企業情報 + company_profile）
- SubsidySSOT（NSD / detail_json）
- 既存facts（chat_facts + company_profile反映済み）
- DocumentFacts（アップロード書類から抽出済みの場合）

**出力**:
- `missing_items[]`（優先順位付き）
- `next_question`（key / label / input_type / options / priority / source / reason）

### 5.2 質問ソース優先順位 (Freeze)

```
優先度1: 補助金固有の構造化データ
  ├─ eligibility_rules[] (DB)          ← 現在0件
  ├─ required_documents_by_subsidy (DB) ← 現在0件
  ├─ NSD.content.required_forms[]      ← 一部あり
  └─ NSD.content.bonus_points[]        ← 一部あり

優先度2: detail_jsonフラットテキストからの派生（derived_text）  ← P0で実装必須
  ├─ application_requirements → ルールベース質問変換
  ├─ required_documents (文字列) → 書類確認質問変換
  └─ eligible_expenses (文字列) → 経費確認質問変換

優先度3: NSD.wall_chat.questions[]  ← 現在未生成
  └─ normalizeWallChatQuestions() で変換

優先度4: 汎用フォールバック質問 (generic)
  └─ generateAdditionalQuestions() の7問
```

### 5.3 質問の属性 (Freeze)

各質問は必ず以下を持つ:

```ts
interface MissingItem {
  key: string;           // fact_key (chat_factsのキー)
  label: string;         // 質問本文
  input_type: 'boolean' | 'number' | 'text' | 'select';
  options?: string[];    // selectの場合の選択肢
  priority: number;      // 表示順序
  source: 'eligibility_rule' | 'required_doc' | 'required_form'
        | 'bonus_point' | 'derived_text' | 'generic' | 'document_fact';
  reason?: string;       // 何の判定/ドラフト項目に必要か
  provenance_url?: string; // 根拠URL（士業レーン用）
}
```

### 5.4 質問の優先順序 (Freeze)

| 優先度 | カテゴリ | 具体例 |
|-------|---------|-------|
| 1 | 電子申請の前提 | GビズID取得状況 |
| 2 | 申請資格（即NG判定） | SME/地域/業種/税滞納/過去受給 |
| 3 | 対象経費の成立 | 何を買うか・見積あるか |
| 4 | 加点要素 | 賃上げ/各種認定 |
| 5 | ドラフト必須（事業記述） | 事業内容/投資額/スケジュール/KPI |
| 6 | 推奨（任意だが精度向上） | 強み/課題の詳細 |

### 5.5 AIの責務ルール (Freeze / 絶対ルール)

1. **AIは質問を作らない**
2. **AIはユーザー回答に対するリアクションと補足のみ**
3. **質問本文は `next_question.label` としてUIが表示する**
4. **consulting モードでも、未回答の重要項目があれば自然に聞く**（プロンプト内の `detectMissingCriticalInfo` で制御）

---

## 6. draft_mode別 ドラフト出力テンプレート (Freeze)

### 6.1 full_template（書式あり → 叩き台生成可能）

| セクション | 入力元 |
|-----------|-------|
| 事業名・概要 | CompanySSOT + plan.project_summary |
| 背景・課題 | plan.current_challenge + company.business_summary |
| 目的 | SubsidySSOT.overview.purpose |
| 実施内容 | plan.project_summary + eligible_expenses |
| 経費内訳 | plan.expense_breakdown + quote items |
| スケジュール | plan.schedule_timeline + acceptance_end |
| KPI | plan.kpi_targets + 要件由来KPI |
| 体制 | contact + 役割 |
| 添付書類チェックリスト | required_documents + uploaded |
| 加点戦略 | bonus_points + facts |

### 6.2 structured_outline（書式曖昧 → 構成+例文）

- 上記と同じセクション構成
- 各セクションに「例文」「埋めるべき空欄」「NG注意」を付与
- 士業に渡せる品質

### 6.3 eligibility_only（電子申請で項目不明 → チェックリスト）

| 出力物 | 内容 |
|-------|------|
| 申請資格チェック | Yes/Noと根拠 |
| 必要準備リスト | GビズID、税、見積、認定等 |
| 経費整合チェック | 対象/非対象の警告 |
| 提出前チェックリスト | 全書類の準備状況 |
| コピペ短文集 | 電子申請の入力欄に貼れる文章群 |

---

## 7. 現状と設計のギャップ一覧

### 7.1 致命的ギャップ (P0)

| # | 項目 | 設計 | 現状 | 影響 |
|---|------|------|------|------|
| G1 | eligibility_rules DB | 補助金ごとに構造化ルール | **0件** | Gate判定が機能しない |
| G2 | required_documents_by_subsidy DB | 補助金ごとに書類リスト | **0件** | 書類チェック質問が出ない |
| G3 | wall_chat_questions | 補助金固有質問 | **未生成** | 汎用7問で終わる |
| G4 | detail_json → 質問変換 | フラットテキストから派生質問 | **未実装** | 補助金の話につながらない |
| G5 | draft_mode 分類 | full/outline/eligibility | **未定義** | ユーザー期待値が崩壊 |

### 7.2 重要ギャップ (P1)

| # | 項目 | 設計 | 現状 | 影響 |
|---|------|------|------|------|
| G6 | session.state 5状態 | precheck→collecting→consulting→ready→generated | 3状態のみ(collecting/consulting/completed) | 遷移が曖昧 |
| G7 | 書類アップロード→fact反映 | OCR→抽出→facts→missing減算 | 保存のみ | 書類の価値が出ない |
| G8 | 質問のsource/reason | 出典と理由を各質問に付与 | **未実装** | 士業レーン不可 |
| G9 | レーンA/B UI分離 | 2レーン表示 | 単一UI | ターゲット最適化不可 |

### 7.3 改善ギャップ (P2)

| # | 項目 | 設計 | 現状 | 影響 |
|---|------|------|------|------|
| G10 | 加点戦略ビュー | 未達要件と取得難易度 | なし | 戦略提案が弱い |
| G11 | セクション完成度メーター | ドラフトの各セクション進捗 | なし | 経営者の達成感 |
| G12 | 書類テンプレート提供 | ダウンロード可能な書式 | なし | 利便性 |

---

## 8. コードアーキテクチャマップ

### 8.1 バックエンド

```
src/routes/chat.ts (2,401行)
  ├─ buildNsdFromCache()          -- キャッシュフォールバック (2026-02-13追加)
  ├─ POST /precheck               -- Gate判定
  │   └─ performPrecheck()        -- 判定ロジック
  │       ├─ evaluateAutoRule()    -- 自動判定 (employee/capital/industry/region)
  │       ├─ [eligibility_rules]   -- DB参照 → 現在0件
  │       ├─ [required_docs]       -- DB参照 → 現在0件
  │       └─ generateAdditionalQuestions() -- wall_chat.questions → フォールバック7問
  ├─ POST /sessions               -- セッション作成
  │   ├─ 既存セッション復元
  │   └─ 新規作成 + 初期メッセージ + 最初の質問
  ├─ POST /sessions/:id/message   -- メッセージ処理
  │   ├─ fact保存 (chat_facts)
  │   ├─ remaining計算
  │   ├─ structured mode → AIリアクション + next_question
  │   └─ consulting mode → AI自由回答 (generateAIResponse)
  └─ POST /sessions/:id/message/stream -- SSEストリーミング

src/lib/ai-concierge.ts (687行)
  ├─ buildSystemPrompt()           -- モード別プロンプト生成
  │   ├─ structured: リアクションのみ (質問禁止)
  │   └─ free: コンシェルジュ (detectMissingCriticalInfo含む)
  ├─ generateAIResponse()          -- OpenAI API呼び出し
  ├─ generateAIResponseStream()    -- ストリーミング版
  └─ generateFallbackResponse()    -- APIキーなし時のルールベース応答

src/routes/draft.ts
  ├─ POST /generate               -- ドラフト生成
  │   ├─ company + profile取得
  │   ├─ chat_facts取得
  │   ├─ NSD取得
  │   └─ セクション生成 (テンプレート/LLM)
  └─ GET /:id                     -- ドラフト取得
```

### 8.2 フロントエンド

```
src/pages/chat.tsx (1,404行)
  ├─ initSession()                 -- セッション初期化
  │   ├─ POST /api/chat/sessions
  │   ├─ precheck結果表示 (NG/OK/OK_WITH_MISSING)
  │   └─ 最初の質問表示 + input_type設定
  ├─ sendMessage()                 -- 構造化質問フェーズ
  │   ├─ POST /api/chat/sessions/:id/message
  │   ├─ next_question.label を質問表示
  │   ├─ input_type に応じてUI切替
  │   └─ remaining === 0 → switchToConsulting()
  ├─ switchToConsulting()          -- コンシェルジュモード移行
  ├─ sendConsultingMessage()       -- SSE自由会話
  └─ goToDraft()                   -- ドラフト生成画面へ遷移
```

---

## 9. データフロー全体図

```
[ユーザーアクション]                     [データソース]
       |                                    |
  壁打ちボタン押下                     subsidy_cache
       |                              detail_json
       v                              (eligibility_rules: 0件)
  POST /api/chat/sessions             (required_docs: 0件)
       |                              (wall_chat_questions: 未生成)
       v                                    |
  performPrecheck()  <------------------+   |
       |                                    |
       | missing_items生成                   |
       | ソース1: eligibility_rules → 0件    |
       | ソース2: required_docs → 0件        |
       | ソース3: wall_chat.questions → 0件  |
       | ソース4: generateAdditionalQuestions |
       |          → 汎用フォールバック7問     |
       v                                    |
  初期メッセージ + 最初の質問                 |
       |                                    |
       v                                    |
  ユーザー回答 → chat_facts保存              |
       |                                    |
       v                                    |
  remaining計算 → 7問終了 → consulting移行   |
       |                                    |
       v                                    |
  AI自由回答 (プロンプトにNSD情報)            |
       |    ↑                               |
       |    NSD.content.eligibility_rules: []|
       |    → プロンプトに「主な申請要件」なし |
       |    → 補助金の話につながらない        |
       v                                    |
  ドラフト生成 (facts が薄い)               |
       |                                    |
       v                                    |
  品質の低い叩き台                           |
```

---

## 10. 受け入れ基準 (Acceptance Criteria)

### 10.1 経営者向け (レーンB)

- [ ] 質問に答えるだけで「叩き台」または「アウトライン」が出る
- [ ] 「何を答えればいいかわからない」が起きない（常にnext_questionが明示）
- [ ] 書類アップロードで質問数が減る
- [ ] 壁打ち開始時に「この補助金で何ができるか」(draft_mode)が表示される
- [ ] 補助金固有の質問が出る（汎用質問だけにならない）

### 10.2 士業向け (レーンA)

- [ ] 根拠（出典URL）が各質問/判定に付与されている
- [ ] 加点・枠・戦略の提案が出せる
- [ ] 顧客提案に転用できる要約が出る
- [ ] セクションごとの完成度が見える

---

## 付録A: 本番DB実態 (2026-02-13時点)

| テーブル | レコード数 | 備考 |
|---------|-----------|------|
| subsidy_cache | ~22,000 | 検索用。wall_chat_ready=1が19,530件 |
| subsidy_canonical | 3,470 | ID正規化済み |
| eligibility_rules | **0** | テーブルは存在するがデータなし |
| required_documents_by_subsidy | **0** | テーブルは存在するがデータなし |
| required_documents_master | 0 | 同上 |
| chat_sessions | あり | 運用中 |
| chat_messages | あり | 運用中 |
| chat_facts | あり | 運用中 |
| application_drafts | あり | 運用中 |
| company_documents | あり | アップロードのみ、fact抽出なし |

## 付録B: REAL-002 (ものづくり補助金) detail_json 構造

```json
{
  "id": "REAL-002",
  "title": "令和6年度補正 ものづくり...",
  "description": "中小企業...",
  "subsidy_max_limit": 12500000,
  "subsidy_rate": "1/2〜2/3",
  "application_requirements": "3〜5年の事業計画を策定、付加価値額年率平均3%以上増加...",
  "eligible_expenses": "機械装置・システム構築費、技術導入費...",
  "required_documents": "事業計画書、決算書（直近2期分）...",
  "application_procedure": "電子申請（GビズIDプライム必須）",
  "required_forms": [
    { "name": "交付申請書（様式第1号）", "fields": [...] },
    { "name": "事業計画書", "fields": [...] },
    { "name": "経費明細表", "fields": [...] }
  ],
  "overview": "...",
  "overview_source": "manual_enrich_v1"
}
```

**注意**: `wall_chat_questions` フィールドは存在しない。`application_requirements` 等はフラット文字列のみ。

---

*このドキュメントはFreeze（設計確定）版です。実装時に仕様変更が必要な場合は、このドキュメントを先に更新してからコードに反映してください。*

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

## 11. データ鮮度・バージョン・矛盾解決ポリシー (Freeze)

### 11.1 データソース優先順位 (Conflict Policy)

壁打ちの各判定・質問生成・ドラフト作成において、同一フィールドが複数ソースに存在する場合、以下の順序で「勝つ」ほうを採用する。

```
優先順位（高→低）:
  1. 公式PDF抽出（pdf_hash一致 + 抽出日が最新）
  2. 公式URL HTML抽出（content_hash一致 + last_crawled_at最新）
  3. subsidy_snapshot（構造化済み + snapshot_id 特定可能）
  4. subsidy_cache.detail_json（不完全な可能性あり）
  5. derived_text（テキスト分割・LLM推定）
  6. 汎用ルール（generic fallback）
```

### 11.2 鮮度管理フィールド (Freeze)

| フィールド | 保持場所 | 用途 |
|-----------|---------|------|
| `provenance.last_normalized_at` | NSD | この NSD が生成された日時 |
| `provenance.pdf_hashes[].last_seen_at` | NSD | 公式PDFの最終確認日 |
| `subsidy_cache.updated_at` | DB | cache行の最終更新日 |
| `subsidy_cache.content_hash` | DB | detail_json 全体のハッシュ（変更検知用） |
| `koubo_monitors.last_crawled_at` | DB | 公募要領の最終クロール日 |

### 11.3 鮮度判定ルール (Freeze)

壁打ちセッション開始時に以下を評価する:

| 条件 | 判定 | UI表示 |
|------|------|--------|
| `last_normalized_at` < 30日前 | stale | ⚠️「情報が古い可能性があります（最終更新: XX日前）」 |
| `pdf_hashes` が空 | no_source | ⚠️「公募要領PDFが未取得のため、情報が不完全な可能性があります」 |
| `content_hash` が前回セッション時と異なる | updated | ℹ️「前回の壁打ち以降、補助金情報が更新されています」 |
| 上記いずれにも該当しない | fresh | （表示なし） |

### 11.4 矛盾発生時の解決ルール (Freeze)

1. **検索一覧（cache fast）と詳細画面（ssot precise）の乖離**:
   - 一覧は cache の簡易データ → 「概算」表記
   - 詳細は NSD の精査データ → 「確定値」表記
   - 乖離がある場合、詳細画面に「検索一覧の表示と異なる場合があります」を表示

2. **壁打ち中のデータ更新**:
   - セッション開始時に NSD の `content_hash` をセッションに保存
   - セッション中はそのスナップショットを使い続ける（途中で変わらない）
   - セッション再開時に hash が変わっていたら、missing_items を再計算

3. **facts の矛盾（ユーザー回答 vs 書類抽出）**:
   - 書類抽出（confidence高）が ユーザー回答と矛盾する場合 → 確認質問を生成
   - ユーザーが明示的に訂正した場合 → ユーザー回答が勝つ（source='user_override'）

### 11.5 現状との差分

| 項目 | 設計 | 現状 | 要対応 |
|------|------|------|--------|
| content_hash をセッションに保存 | する | **していない** | P0で追加 |
| stale 警告 UI | 出す | **ない** | P1 |
| 矛盾時の確認質問 | 生成する | **ない** | P1 |
| セッション再開時の hash 比較 | する | **していない** | P0で追加 |

---

## 12. draft_mode 判定基準 (Freeze)

### 12.1 判定フローチャート

```
START: NSD を取得
  │
  ├─ NSD.content.required_forms[] が存在し、
  │  かつ各 form に fields[] が 3件以上
  │  → draft_mode = "full_template"
  │
  ├─ NSD.content.required_forms[] が存在するが、
  │  fields[] が曖昧（2件以下 or テキストのみ）
  │  → draft_mode = "structured_outline"
  │
  ├─ detail_json に application_requirements が存在する
  │  → draft_mode = "structured_outline"
  │
  ├─ electronic_application.is_electronic = true かつ
  │  required_forms[] が空
  │  → draft_mode = "eligibility_only"
  │
  └─ 上記いずれにも該当しない
     → draft_mode = "structured_outline" (デフォルト)
```

### 12.2 判定関数の仕様 (Freeze)

```typescript
function determineDraftMode(
  nsd: NormalizedSubsidyDetail,
  detailRaw: Record<string, any>
): 'full_template' | 'structured_outline' | 'eligibility_only' {
  const forms = nsd.content.required_forms || [];
  
  // full_template: 構造化フォームが十分
  const hasStructuredForms = forms.length >= 1 
    && forms.some(f => (f.fields?.length || 0) >= 3);
  if (hasStructuredForms) return 'full_template';
  
  // eligibility_only: 電子申請でフォーム情報なし
  const isElectronic = nsd.electronic_application.is_electronic_application;
  const noForms = forms.length === 0;
  const noRequirements = !detailRaw.application_requirements;
  if (isElectronic && noForms && noRequirements) return 'eligibility_only';
  
  // structured_outline: それ以外（デフォルト）
  return 'structured_outline';
}
```

### 12.3 UI への影響 (Freeze)

セッション開始時（POST /api/chat/sessions レスポンス）に `draft_mode` を含め、フロントエンドで以下を表示:

| draft_mode | ヘッダー表示 | 完了ボタンラベル |
|-----------|-------------|----------------|
| `full_template` | 「申請書の叩き台を作成できます」 | 「申請書を作成する」 |
| `structured_outline` | 「申請準備のアウトラインを作成できます」 | 「アウトラインを作成する」 |
| `eligibility_only` | 「申請要件の確認と準備リストを作成できます」 | 「チェックリストを作成する」 |

### 12.4 データ保持

- `chat_sessions.draft_mode` カラムを追加（TEXT, nullable）
- セッション作成時に `determineDraftMode()` で判定し保存
- ドラフト生成時にこの値を参照して出力テンプレートを決定

### 12.5 現状との差分

| 項目 | 設計 | 現状 | 要対応 |
|------|------|------|--------|
| draft_mode カラム | chat_sessions | **存在しない** | P0 migration |
| determineDraftMode() | 関数 | **存在しない** | P0 実装 |
| UI表示分岐 | 3パターン | **単一表示** | P0 フロント |
| draft.ts での分岐 | mode別テンプレート | **単一テンプレート** | P1 |

---

## 13. facts provenance（根拠追跡）(Freeze)

### 13.1 chat_facts テーブル拡張

既存カラム: `confidence REAL`, `source TEXT`, `metadata`（JSON文字列）
→ `source` と `metadata` を活用して provenance を保持する（新カラム追加不要）

### 13.2 source の値域 (Freeze)

| source 値 | 意味 | 信頼度デフォルト |
|-----------|------|----------------|
| `chat` | ユーザーがチャットで回答 | 0.9 |
| `user_override` | ユーザーが明示的に訂正 | 1.0 |
| `profile` | company_profile から自動取得 | 0.8 |
| `document` | アップロード書類から OCR/AI 抽出 | confidence依存 |
| `derived_text` | detail_json テキストから推定 | 0.5 |
| `subsidy_rule` | eligibility_rules から自動生成 | 0.7 |
| `system` | システムが自動生成（日時等） | 1.0 |

### 13.3 metadata の構造 (Freeze)

```json
{
  "input_type": "boolean",
  "question_label": "GビズIDを取得済みですか？",
  "raw_answer": "はい",
  "parsed_answer": "true",
  "source_ref": {
    "type": "detail_json_field",
    "field": "application_requirements",
    "subsidy_id": "REAL-002",
    "content_hash": "abc123..."
  },
  "as_of": "2026-02-13T10:00:00Z"
}
```

### 13.4 ドラフトの根拠追跡 (Freeze)

`application_drafts.trace_json` に以下を保持:

```json
{
  "generated_at": "2026-02-13T12:00:00Z",
  "nsd_version": {
    "content_hash": "abc123...",
    "last_normalized_at": "2026-02-10T12:32:59Z",
    "source_type": "cache"
  },
  "facts_used": [
    { "fact_key": "investment_amount", "fact_value": "500", "source": "chat", "confidence": 0.9 },
    { "fact_key": "plans_wage_raise", "fact_value": "true", "source": "derived_text", "confidence": 0.5 }
  ],
  "sections": [
    {
      "name": "事業概要",
      "fact_keys_used": ["project_summary", "business_purpose"],
      "subsidy_fields_used": ["application_requirements", "overview"]
    }
  ]
}
```

### 13.5 現状との差分

| 項目 | 設計 | 現状 | 要対応 |
|------|------|------|--------|
| source の値域 | 7種類 | `chat` のみ | P0で拡張 |
| metadata.source_ref | 根拠ドキュメント参照 | `question_label` のみ | P0で拡張 |
| trace_json の活用 | ドラフト根拠追跡 | **カラム存在するが空** | P1 |
| as_of 記録 | facts に日時根拠 | **なし** | P0で metadata に追加 |

---

## 14. canonical 未解決の扱い (Freeze)

### 14.1 背景

`subsidy_cache` に 22,000件あるが、`subsidy_canonical` は 3,470件のみ。
canonical に紐付いていない補助金（主に izumi 系 18,000件超）で壁打ちを許可するかの判定が必要。

### 14.2 Gate 判定 (Freeze)

```
壁打ち開始時の判定フロー:

  1. resolveSubsidyRef(subsidy_id)
     ├─ 成功: canonical_id 解決 → getNormalizedSubsidyDetail → NSD取得
     │   → 通常フロー
     │
     └─ 失敗: canonical 未解決
         ├─ buildNsdFromCache(subsidy_id) 
         │   ├─ 成功: cache NSD 構築 → 壁打ち許可（制限付き）
         │   │   └─ UIに「⚠ 簡易データに基づく壁打ちです」表示
         │   │
         │   └─ 失敗: cache にもない → 壁打ち不可
         │       └─ エラー: 「この補助金の壁打ちはまだ準備中です」
         │
         └─ getMockSubsidyDetail(subsidy_id) → 最終フォールバック
             └─ モック → テスト用のみ（本番では到達しないはず）
```

### 14.3 制限付き壁打ちの制約

| 項目 | canonical 解決済み | cache フォールバック |
|------|-------------------|---------------------|
| Gate 判定精度 | 高（構造化ルール） | 低（テキスト派生のみ） |
| 質問の補助金固有度 | 高 | 中（derived_text 依存） |
| ドラフト生成 | full_template 可 | structured_outline まで |
| 出典表示 | PDF URL あり | なし（⚠表示） |
| セッション保存 | 通常 | `nsd_source = 'cache'` 記録 |

### 14.4 検索→壁打ちの ID 連携 (Freeze)

検索結果の `subsidy.id` は常に `subsidy_cache.id`（cache_id）。
壁打ち開始時に `resolveSubsidyRef` が `cache_id → canonical_id` の変換を試みる。

```
検索結果クリック → /chat?subsidy_id=<cache_id>&company_id=<company_id>
  → POST /api/chat/sessions { subsidy_id: cache_id }
    → resolveSubsidyRef(cache_id)
      → 成功: canonical_id で NSD 取得
      → 失敗: buildNsdFromCache(cache_id) で cache NSD
```

### 14.5 現状との差分

| 項目 | 設計 | 現状 | 要対応 |
|------|------|------|--------|
| 3層フォールバック | resolve → cache → mock | **実装済み** ✅ | - |
| nsd_source 記録 | セッションに記録 | **していない** | P0で追加 |
| UI警告表示 | cache時に⚠表示 | **していない** | P0で追加 |
| draft_mode 制限 | cache時は outline まで | **制限なし** | P0で追加 |

---

## 15. derived_text の生成タイミングと保存先 (Freeze)

### 15.1 生成タイミング

derived_text（detail_json のフラットテキストから構造化データへの変換）は **リアルタイム生成** とする。

```
生成タイミング:
  ❌ バッチ事前生成（Cronで全件変換して保存）
     → 22,000件 × 変換 = 工数・保守コスト大、更新追随が必要
  
  ✅ リアルタイム生成（壁打ち開始時に on-the-fly で変換）
     → buildNsdFromCache() の中でテキスト分割を実行
     → 生成結果はセッション単位でキャッシュ（DB保存しない）
```

**理由**:
1. テキスト分割はCPU軽量（正規表現ベース、LLM不使用）→ CF Workers の 10ms 制限内
2. detail_json が更新されたら自動的に最新テキストが反映される（鮮度問題なし）
3. 22,000件を事前変換する保守コストが不要

### 15.2 保存先とキャッシュ戦略

| データ | 保存先 | ライフサイクル |
|--------|--------|--------------|
| `detail_json` (元テキスト) | subsidy_cache.detail_json | 永続（Cronで更新） |
| `parsed eligibility_rules[]` | NSD オブジェクト（メモリ） | セッション開始時に生成、リクエスト内で利用 |
| `derived questions[]` | NSD オブジェクト（メモリ） | 同上 |
| `missing_items[]` (質問リスト) | chat_sessions.missing_items | セッション作成時に永続化 |
| `facts` (回答) | chat_facts | 永続 |

### 15.3 再利用パターン

```
同一セッション内:
  → missing_items は DB に保存済み → セッション再開時にそのまま使う
  → NSD はリクエストごとに再生成（軽量なので問題なし）

別セッション（同一補助金・同一企業）:
  → chat_facts は company_id + subsidy_id で永続 → 既回答はスキップ
  → missing_items は新セッション作成時に再計算（最新 detail_json を反映）
```

### 15.4 将来のバッチ移行条件

リアルタイム生成でパフォーマンス問題が出た場合（例: テキスト分割に 50ms 以上かかる）:

```
移行先: subsidy_cache に derived_* カラムを追加
  - derived_eligibility_rules_json TEXT
  - derived_required_documents_json TEXT  
  - derived_at DATETIME
  - derived_version TEXT

生成タイミング: Cron（daily-ready-boost の一部として）
```

ただし現時点では不要（正規表現ベースの分割は 1ms 以下）。

### 15.5 現状との差分

| 項目 | 設計 | 現状 | 要対応 |
|------|------|------|--------|
| テキスト分割関数 | parseEligibilityFromText() 等 | **存在しない** | P0で新規作成 |
| 生成タイミング | buildNsdFromCache 内 | - | P0で統合 |
| missing_items 再計算 | セッション再開時 | **一度だけ** | P0で改善 |
| derived_* DB保存 | 不要（将来オプション） | - | - |

---

## 16. 既存実装の矛盾ポイント チェックリスト

P0実装時に必ず確認し、矛盾がないことを検証すべき箇所。

### 16.1 企業情報系

| # | チェック項目 | ファイル | 確認内容 |
|---|-------------|---------|---------|
| C1 | company_profile と companies の分割 | profile.ts, companies.ts | 質問生成の `isAnsweredByCompany()` で両方を参照しているか |
| C2 | profile 保存時のバリデーション | profile.ts | 数値フィールド（employee_count, capital）の型チェック |
| C3 | facts→profile 同期 | chat.ts (syncFactsToProfile) | 同期対象フィールドと質問キーの一致 |

### 16.2 補助金データ系

| # | チェック項目 | ファイル | 確認内容 |
|---|-------------|---------|---------|
| C4 | 検索結果の id 型 | subsidies.ts | cache_id が壁打ちで resolve できるか |
| C5 | NSD と cache の乖離 | normalizeSubsidyDetail.ts | 同一補助金で NSD と cache の表示値が異なる場合の優先ルール |
| C6 | detail_json の型の揺れ | buildNsdFromCache | required_documents が string の場合と array の場合の両方に対応 |
| C7 | eligibility_rules の二重ソース | chat.ts (performPrecheck) | DB (0件) と NSD (テキスト派生) が共存した場合のマージルール |

### 16.3 壁打ちフロー系

| # | チェック項目 | ファイル | 確認内容 |
|---|-------------|---------|---------|
| C8 | セッション再開時の missing_items | chat.ts (POST /sessions) | 既存セッション復元時に missing_items を再計算しているか |
| C9 | consulting モードへの遷移条件 | chat.ts (POST /sessions/:id/message) | remaining === 0 の判定が derived 質問も含んでいるか |
| C10 | fact の UPSERT 競合 | chat.ts (INSERT INTO chat_facts) | company_id + subsidy_id + fact_key の UNIQUE 制約 |
| C11 | AI プロンプトの NSD 参照 | ai-concierge.ts | eligibility_rules が空の場合に detail_json フラットテキストがプロンプトに入るか |

### 16.4 ドラフト系

| # | チェック項目 | ファイル | 確認内容 |
|---|-------------|---------|---------|
| C12 | draft_mode によるセクション分岐 | draft.ts | 現在は単一テンプレート → P1 で分岐追加 |
| C13 | trace_json の活用 | draft.ts | 現在は空 → P1 で根拠追跡 |
| C14 | ドラフト再生成時の fact 最新反映 | draft.ts | セッション完了後に fact が更新された場合 |

---

*このドキュメントはFreeze（設計確定）版です。実装時に仕様変更が必要な場合は、このドキュメントを先に更新してからコードに反映してください。*
*v2.0: 2026-02-13 - セクション11-16追加（鮮度/draft_mode/provenance/canonical/derived_text/チェックリスト）*

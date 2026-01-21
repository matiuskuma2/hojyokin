# プロンプト＆JSONスキーマ確定版

## 概要

本ドキュメントは、LLMに渡すプロンプトとその入出力JSONスキーマを定義します。

---

## 1. 要件抽出プロンプト（Eligibility Extraction）

### 1-1. 目的

公募要領（PDFをMarkdown化したテキスト）から、判定・壁打ち・申請書作成に使えるEligibility JSONを生成する。

### 1-2. プロンプト（確定版）

```text
あなたは補助金の公募要領を構造化して、要件判定と申請書作成に使えるJSONを作る専門家です。

## 入力
1. subsidy_detail: 補助金の基本情報（JSON）
2. attachment_text: 公募要領のMarkdown化テキスト
3. data_key_dictionary: 使用可能なdata_keyの一覧

## 出力
以下のスキーマに従ったJSONのみを出力してください。説明文は禁止です。

## 重要ルール

### 1. evidence（根拠）は必須
- 各要件に対して、本文中の該当箇所を短く抜粋（最大120文字）
- 可能なら見出し名やページ番号も含める
- 根拠が見つからない場合は need_check に入れる

### 2. 断定できない場合は must に入れない
- 曖昧な表現や判断が必要な場合は need_check に入れる
- 「原則として」「場合によっては」などは need_check
- 数値が明確でない場合も need_check

### 3. data_key は指定辞書から選ぶ
- 新しいキーは勝手に作らない
- 必要な情報で辞書にないものは missing_keys に入れる

### 4. 数値や期限は正規化
- 日付: YYYY-MM-DD形式
- 金額: 整数円
- 補助率: "1/2", "2/3" などの文字列

### 5. 対象外条件（must_not）は最優先で抜く
- 対象外業種、対象外経費、禁止事項は確実に抽出
- 見落とすと返還リスクに直結

### 6. リスクフラグを検出する
- リース共同申請、賃上げ要件、分社化リスクなどを検出
- 該当する場合は risk_flags に追加

## operator 一覧
- IN: 値が配列に含まれる
- NOT_IN: 値が配列に含まれない
- ==: 等しい
- !=: 等しくない
- <=: 以下
- >=: 以上
- BETWEEN: 範囲内 [min, max]
- CONTAINS: 配列に値が含まれる
- NOT_CONTAINS: 配列に値が含まれない
- EXISTS: 値が存在する
- NOT_EXISTS: 値が存在しない
- NOT_ONLY: 指定値のみで構成されていない

## 出力JSONスキーマ

{
  "subsidy_id": "string",
  "workflow_id": "string | null",
  "extracted_at": "ISO8601 datetime",
  "basic": {
    "target_area": {
      "type": "national | pref | city | region",
      "values": ["string"],
      "raw": "原文抜粋"
    },
    "target_industry": {
      "values": ["string"],
      "excluded": ["string"],
      "raw": "原文抜粋"
    },
    "target_size": {
      "employees_max": "number | null",
      "capital_max": "number | null",
      "raw": "原文抜粋"
    },
    "subsidy_rate": "string",
    "max_amount": "number",
    "min_amount": "number | null",
    "acceptance_period": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "implementation_period": {
      "start": "YYYY-MM-DD | null",
      "end": "YYYY-MM-DD | null"
    }
  },
  "eligibility": {
    "must": [
      {
        "id": "E001",
        "question": "判定質問文",
        "data_key": "string",
        "operator": "string",
        "value": "any",
        "evidence": "原文抜粋（見出し・ページ付き）"
      }
    ],
    "any_of": [
      {
        "group_id": "A01",
        "description": "いずれかを満たす必要がある",
        "items": [
          {
            "id": "E010",
            "question": "判定質問文",
            "data_key": "string",
            "operator": "string",
            "value": "any",
            "evidence": "原文抜粋"
          }
        ]
      }
    ],
    "must_not": [
      {
        "id": "N001",
        "question": "該当してはいけない条件",
        "data_key": "string",
        "operator": "string",
        "value": "any",
        "evidence": "原文抜粋"
      }
    ],
    "need_check": [
      {
        "id": "NC001",
        "question": "確認が必要な条件",
        "data_key": "string",
        "hint": "確認のヒント",
        "evidence": "原文抜粋"
      }
    ],
    "bonus": [
      {
        "id": "B001",
        "question": "加点要素",
        "data_key": "string",
        "operator": "string",
        "value": "any",
        "points": "number | null",
        "evidence": "原文抜粋"
      }
    ]
  },
  "expenses": {
    "eligible_categories": ["string"],
    "eligible_items": [
      {
        "category": "string",
        "examples": ["string"],
        "notes": "string | null"
      }
    ],
    "ineligible_items": [
      {
        "item": "string",
        "reason": "string | null"
      }
    ],
    "rules": [
      {
        "id": "X001",
        "rule": "ルール説明",
        "evidence": "原文抜粋"
      }
    ]
  },
  "documents": {
    "required": [
      {
        "name": "書類名",
        "description": "説明",
        "form_attachment_id": "string | null"
      }
    ],
    "optional": ["string"],
    "forms": [
      {
        "name": "様式名",
        "attachment_id": "string"
      }
    ]
  },
  "review": {
    "criteria": [
      {
        "name": "審査項目名",
        "weight": "number | null",
        "description": "説明"
      }
    ],
    "tips": ["string"]
  },
  "risk_flags": [
    {
      "type": "FINANCING | ORGANIZATION | EXPENSE | BUSINESS_MODEL | COMPLIANCE | SCHEDULE | DOCUMENT",
      "level": "HIGH | MEDIUM | LOW",
      "message": "リスク説明",
      "trigger": "検出条件の説明"
    }
  ],
  "missing_keys": ["string"]
}

---

それでは、以下の入力に基づいてJSONを生成してください。

### subsidy_detail
{subsidy_detail_json}

### attachment_text
{attachment_text_markdown}

### data_key_dictionary
{data_key_list}
```

### 1-3. フォールバック処理

抽出失敗時の対応：

| 状況 | 対応 |
|------|------|
| PDFが崩れている | 見出しベースで部分抽出 |
| 要件が読み取れない | need_check を増やして構造は出す |
| 全く抽出できない | missing_keys と need_check のみ返す |

---

## 2. 壁打ちBotプロンプト（Conversation）

### 2-1. 目的

企業情報と補助金要件に基づき、不足情報を収集し、申請書作成に必要なデータを構造化して取得する。

### 2-2. システムプロンプト（確定版）

```text
あなたは補助金申請をサポートするアシスタントです。
企業が補助金を申請するために必要な情報を収集し、申請書の作成を支援します。

## あなたの役割

1. **情報収集**: 申請に必要な情報を順番に質問して収集する
2. **危険検知**: リスクの高い状況を検出したら警告する
3. **根拠提示**: 質問の理由を公募要領から引用して説明する
4. **構造化保存**: 回答を指定のdata_keyに紐付けて保存する

## 重要ルール

### 1. 会社情報は再度聞かない
以下の情報は既に取得済みです：
- 所在地（都道府県・市区町村）
- 業種（大分類・中分類）
- 従業員数
- 資本金
- 設立年月

### 2. 一度に聞く質問は1〜2個まで
ユーザーの負担を減らすため、一度に多くの質問をしない。

### 3. 回答は必ず構造化
自由回答でも、対応するdata_keyに紐付けて保存できる形に整理する。

### 4. 危険を検知したら最優先で警告
以下のリスクを検出したら、申請を進める前に警告する：
- リース共同申請
- 分社化予定
- 賃上げ要件未達の可能性
- 対象外業種・経費の可能性

### 5. 根拠を必ず示す
質問する際は、なぜその情報が必要かを公募要領から引用して説明する。

## 会話の進め方

1. まず、事業内容を確認（project_summary）
2. 現状の課題を確認（current_issues）
3. 取り組みテーマを確認（project_theme）
4. 期待効果を確認（expected_effects_quant, expected_effects_qual）
5. 実施スケジュールを確認（project_start_date, project_end_date）
6. 経費内訳を確認（expenses）
7. 危険チェック項目を確認（必要な場合のみ）
8. 書類準備状況を確認（quotes_ready, financial_docs_ready）

## 出力形式

各返答では以下の形式で出力してください：

{
  "response_text": "ユーザーへの返答文",
  "saved_answers": {
    "data_key": "保存する値"
  },
  "next_questions": [
    {
      "data_key": "次に聞くdata_key",
      "question": "質問文",
      "evidence": "根拠（公募要領からの引用）"
    }
  ],
  "risk_detected": {
    "type": "リスクタイプ | null",
    "level": "HIGH | MEDIUM | LOW | null",
    "message": "警告メッセージ | null"
  },
  "progress": {
    "completed": ["完了したdata_key"],
    "remaining": ["未取得のdata_key"]
  },
  "ready_for_draft": "boolean"
}
```

### 2-3. 危険検知プロンプト（追加）

危険な状況を検知した場合の追加質問：

```text
## リース共同申請検知時

この補助金は、リース会社が補助金返還義務を負う仕組みです。
以下の点を確認させてください：

1. すでに取引のあるリース会社はありますか？
2. 直近の決算は黒字ですか？
3. 賃上げ要件を確実に達成できますか？

※いずれかに不安がある場合、この申請は推奨されません。
リース会社の再審査で否決された場合、補助金を辞退しなければならなくなります。

## 分社化検知時

今後3〜5年の間に、以下の予定はありますか？
- 分社化
- M&A（買収・売却）
- 事業譲渡

→ はいの場合、この補助金は返還リスクが高まります。
賃上げ要件は、分社化後の従業員数・賃金で再計算されるためです。

## 対象外経費検知時

入力された経費に、対象外となる可能性のある項目があります：

- {対象外経費項目}

この経費は補助対象外となる可能性があります。
理由：{理由}

この経費を除いて申請を進めますか？
```

---

## 3. 申請書たたき生成プロンプト（Draft Generation）

### 3-1. 目的

収集した情報を基に、審査を通過しやすい申請書のドラフトを生成する。

### 3-2. システムプロンプト（確定版）

```text
あなたは補助金申請書の作成を支援する専門家です。
収集した情報を基に、審査を通過しやすい申請書のドラフトを作成します。

## 入力情報
1. company_profile: 企業情報
2. eligibility_json: 補助金の要件情報
3. conversation_answers: 壁打ちで収集した回答
4. review_criteria: 審査基準

## 出力形式
以下の固定キーで構成されたJSONを出力してください。

## 重要ルール

### 1. 断定しない
- 不確定な情報は「【未確定】」と明記
- 数値が仮置きの場合は「【仮置き：○○】」と明記
- 要確認事項は「【要確認】」と明記

### 2. 根拠を必ず付ける
- 各セクションで重要な主張には根拠を付ける
- 根拠は evidence_map に保存

### 3. NG表現を検出する
- 禁止表現を検出したら risk_flags に追加
- 代替表現を提案

### 4. 審査基準に沿って構成
- review_criteria で示された審査項目を意識して文章を構成
- 採択率を上げるためのポイントを反映

### 5. 未完成でも出力
- 情報が不足していても、分かる範囲で出力
- 不足部分は open_questions に追加

## セクション構成

1. overview: 事業概要（200-400字）
2. current_issues: 現状の課題（具体的に、できれば数値で）
3. project_plan: 事業内容・導入内容（具体的に何を行うか）
4. necessity: 事業の必要性（なぜこの取り組みが必要か）
5. expected_effects: 期待される効果（定量・定性）
6. implementation_structure: 実施体制（担当者・役割）
7. schedule: スケジュール（開始〜完了のマイルストーン）
8. budget_breakdown: 経費内訳（対象/対象外の判定付き）
9. document_checklist: 添付書類チェックリスト
10. notes_and_risks: 注意事項・リスク

## 文章作成のコツ

- 審査員は多くの申請書を読む。冒頭で要点を伝える
- 数値で効果を示す（○%削減、○時間短縮など）
- 「なぜ御社がやるのか」の必然性を示す
- 専門用語は避け、平易な言葉で説明
- 1文は短く、読みやすく

## 出力JSONスキーマ

{
  "content": {
    "overview": "string",
    "current_issues": "string",
    "project_plan": "string",
    "necessity": "string",
    "expected_effects": {
      "quantitative": "string",
      "qualitative": "string"
    },
    "implementation_structure": "string",
    "schedule": [
      {
        "period": "YYYY-MM",
        "milestone": "string"
      }
    ],
    "budget_breakdown": [
      {
        "category": "string",
        "item": "string",
        "amount": "number",
        "eligibility": "ELIGIBLE | INELIGIBLE | NEEDS_CHECK",
        "note": "string | null"
      }
    ],
    "document_checklist": [
      {
        "name": "string",
        "status": "READY | NOT_READY | NA",
        "note": "string | null"
      }
    ],
    "notes_and_risks": ["string"]
  },
  "evidence_map": {
    "section_key": [
      {
        "quote": "引用文（120字以内）",
        "source": "出典（公募要領 p.X）"
      }
    ]
  },
  "open_questions": [
    {
      "data_key": "string",
      "question": "追加で聞くべき質問",
      "reason": "なぜ必要か"
    }
  ],
  "risk_flags": [
    {
      "type": "NG_EXPRESSION | MISSING_INFO | ELIGIBILITY_RISK",
      "severity": "HIGH | MEDIUM | LOW",
      "location": "セクション名",
      "original_text": "問題のある表現",
      "suggestion": "修正案",
      "reason": "理由"
    }
  ],
  "metadata": {
    "completeness_score": "0-100",
    "review_readiness": "READY | NEEDS_WORK | NOT_READY",
    "primary_concerns": ["string"]
  }
}
```

### 3-3. NG表現検出ルール

```text
## NG表現チェックリスト

### 外販・販売関連（HIGH）
- "将来的に販売" → "自社の業務効率化に活用"
- "横展開する" → "自社内での展開"
- "他社に提供" → 削除または表現変更
- "まずは自社で使い、将来" → "自社専用として継続利用"

### 革新性関連（MEDIUM）
- "業界標準として" → "当社独自の取り組みとして"
- "一般的に" → "当社では初めて"
- "よくある" → 削除
- "普通の" → "高機能な"/"専用の"

### 計画の曖昧さ（MEDIUM）
- "一式" → 具体的な内訳を記載
- "詳細は後日" → 現時点で分かる範囲で記載
- "検討中" → "予定"/"計画"
- "未定" → 仮でも具体的に記載
- "約○○" → 具体的な数値

### 効果の不明確さ（LOW）
- "期待される" → "実現する"/"達成する"
- "〜と思われる" → "〜である"/"〜となる"
- "可能性がある" → "〜する"
- "努力する" → "実施する"/"達成する"
```

---

## 4. data_key 辞書（完全版）

### 4-1. 会社情報（固定・壁打ちで再取得しない）

```json
{
  "hq_postal_code": "郵便番号",
  "hq_prefecture": "都道府県",
  "hq_city": "市区町村",
  "industry_main": "業種（大分類）",
  "industry_sub": "業種（中分類）",
  "employees": "従業員数",
  "capital": "資本金",
  "founded_at": "設立年月"
}
```

### 4-2. 案件情報（壁打ちで回収）

```json
{
  "project_title": {
    "description": "事業名・プロジェクト名",
    "type": "string",
    "required": true
  },
  "project_summary": {
    "description": "事業概要（200-400字）",
    "type": "string",
    "required": true
  },
  "current_issues": {
    "description": "現状の課題",
    "type": "string",
    "required": true
  },
  "project_theme": {
    "description": "取り組みテーマ",
    "type": "array",
    "items": "string",
    "enum": ["DX", "AUTOMATION", "PRODUCTIVITY", "NEW_PRODUCT", "MARKET_EXPANSION", "GREEN", "SUCCESSION", "BCP", "HUMAN_RESOURCE", "WAGE_UP", "FACILITY", "R_AND_D", "OTHER"],
    "required": true
  },
  "project_start_date": {
    "description": "事業開始予定日",
    "type": "string",
    "format": "date",
    "required": true
  },
  "project_end_date": {
    "description": "事業完了予定日",
    "type": "string",
    "format": "date",
    "required": true
  },
  "implementation_structure": {
    "description": "実施体制（担当者・役割）",
    "type": "string",
    "required": false
  },
  "expected_effects_quant": {
    "description": "期待効果（定量）",
    "type": "string",
    "required": true
  },
  "expected_effects_qual": {
    "description": "期待効果（定性）",
    "type": "string",
    "required": false
  },
  "wage_up": {
    "description": "賃上げ計画の有無",
    "type": "boolean",
    "required": false
  },
  "wage_up_details": {
    "description": "賃上げ計画の詳細",
    "type": "string",
    "required": false
  },
  "sales_trend": {
    "description": "売上推移",
    "type": "string",
    "required": false
  },
  "expenses": {
    "description": "経費内訳",
    "type": "array",
    "items": {
      "category": "string",
      "name": "string",
      "amount": "number",
      "vendor": "string",
      "date": "string"
    },
    "required": true
  },
  "quotes_ready": {
    "description": "見積書の準備状況",
    "type": "boolean",
    "required": false
  },
  "financial_docs_ready": {
    "description": "決算書の準備状況",
    "type": "boolean",
    "required": false
  },
  "other_constraints": {
    "description": "その他の制約事項",
    "type": "string",
    "required": false
  }
}
```

### 4-3. 危険チェック項目

```json
{
  "sme_definition_check": {
    "description": "中小企業定義の確認",
    "type": "boolean",
    "trigger": "規模要件が曖昧な場合"
  },
  "area_detail_check": {
    "description": "地域詳細の確認",
    "type": "string",
    "trigger": "市区町村レベルの条件がある場合"
  },
  "eligibility_special_check": {
    "description": "特殊要件の確認",
    "type": "string",
    "trigger": "特殊な適格条件がある場合"
  },
  "division_planned": {
    "description": "分社化予定",
    "type": "boolean",
    "trigger": "賃上げ要件がある補助金"
  },
  "lease_joint_application": {
    "description": "リース共同申請",
    "type": "boolean",
    "trigger": "リースを利用する場合"
  },
  "ma_planned": {
    "description": "M&A・事業譲渡予定",
    "type": "boolean",
    "trigger": "継続要件がある補助金"
  },
  "parent_company_large": {
    "description": "大企業の子会社",
    "type": "boolean",
    "trigger": "中小企業要件がある場合"
  },
  "past_subsidy_history": {
    "description": "過去の補助金採択歴",
    "type": "string",
    "trigger": "重複不可の補助金"
  },
  "pre_order_warning": {
    "description": "交付決定前発注の有無",
    "type": "boolean",
    "trigger": "必ず確認"
  }
}
```

---

## 5. API Request/Response スキーマ

### 5-1. 壁打ち開始

**Request: POST /conversations/start**
```json
{
  "company_id": "uuid",
  "subsidy_id": "string"
}
```

**Response**
```json
{
  "conversation": {
    "id": "uuid",
    "company_id": "uuid",
    "subsidy_id": "string",
    "created_at": "ISO8601",
    "messages": [],
    "extracted_answers": {},
    "missing_keys": ["project_summary", "current_issues", "project_theme", "..."]
  },
  "initial_message": {
    "role": "assistant",
    "content": "こんにちは！...",
    "next_questions": [
      {
        "data_key": "project_summary",
        "question": "今回の補助金で実施する事業内容を教えてください。",
        "evidence": "公募要領 p.5「事業概要の記載について」"
      }
    ]
  }
}
```

### 5-2. メッセージ送信

**Request: POST /conversations/{id}/message**
```json
{
  "message": "string"
}
```

**Response**
```json
{
  "message": {
    "role": "assistant",
    "content": "ありがとうございます。...",
    "saved_answers": {
      "project_summary": "在庫管理システムを導入し..."
    },
    "next_questions": [
      {
        "data_key": "current_issues",
        "question": "現在どのような課題がありますか？",
        "evidence": "..."
      }
    ],
    "risk_detected": null
  },
  "progress": {
    "completed": ["project_summary"],
    "remaining": ["current_issues", "project_theme", "..."],
    "completion_rate": 10
  },
  "ready_for_draft": false
}
```

### 5-3. 危険検知時のResponse

```json
{
  "message": {
    "role": "assistant",
    "content": "重要な確認事項があります。...",
    "risk_detected": {
      "type": "FINANCING",
      "level": "HIGH",
      "message": "リース共同申請は採択後に変更不可です。リース会社の再審査否決時は辞退リスクがあります。",
      "questions": [
        "すでに取引のあるリース会社はありますか？",
        "直近決算は黒字ですか？",
        "賃上げ要件を確実に達成できますか？"
      ],
      "actions": [
        {"label": "理解して続ける", "action": "continue"},
        {"label": "詳細を確認", "action": "show_detail"},
        {"label": "この補助金をやめる", "action": "cancel"}
      ]
    }
  }
}
```

### 5-4. ドラフト生成

**Request: POST /drafts/generate**
```json
{
  "company_id": "uuid",
  "subsidy_id": "string",
  "conversation_id": "uuid"
}
```

**Response**
```json
{
  "draft": {
    "id": "uuid",
    "company_id": "uuid",
    "subsidy_id": "string",
    "version": 1,
    "created_at": "ISO8601",
    "content": {
      "overview": "本事業は、当社の在庫管理業務にITツールを導入し...",
      "current_issues": "現在、当社では在庫管理をExcelで行っており...",
      "project_plan": "専用の在庫管理システムを導入し...",
      "necessity": "当社は創業以来、手作業での在庫管理を...",
      "expected_effects": {
        "quantitative": "在庫管理工数を【未確定：○%】削減",
        "qualitative": "リアルタイムな在庫把握により..."
      },
      "implementation_structure": "代表取締役○○が責任者として...",
      "schedule": [
        {"period": "2026-04", "milestone": "システム選定・契約"},
        {"period": "2026-05", "milestone": "導入・設定"},
        {"period": "2026-06", "milestone": "運用開始・効果測定"}
      ],
      "budget_breakdown": [
        {
          "category": "SOFTWARE",
          "item": "在庫管理SaaS（年額×3年）",
          "amount": 1200000,
          "eligibility": "ELIGIBLE",
          "note": null
        },
        {
          "category": "OUTSOURCING",
          "item": "導入支援費",
          "amount": 600000,
          "eligibility": "ELIGIBLE",
          "note": null
        },
        {
          "category": "EQUIPMENT",
          "item": "PC購入",
          "amount": 150000,
          "eligibility": "INELIGIBLE",
          "note": "汎用PCは対象外"
        }
      ],
      "document_checklist": [
        {"name": "決算書（直近1期）", "status": "READY", "note": null},
        {"name": "見積書（相見積2社）", "status": "READY", "note": null},
        {"name": "事業計画書", "status": "NOT_READY", "note": "作成が必要"},
        {"name": "賃上げ計画書", "status": "NOT_READY", "note": "賃上げ枠の場合必要"}
      ],
      "notes_and_risks": [
        "効果の数値（削減率等）を具体的に記載してください",
        "賃上げ要件の達成見込みを確認してください"
      ]
    },
    "evidence_map": {
      "overview": [
        {"quote": "事業概要は、第三者が読んで...", "source": "公募要領 p.8"}
      ]
    },
    "open_questions": [
      {
        "data_key": "expected_effects_quant",
        "question": "効果の具体的な数値（例：工数○時間削減）を教えてください",
        "reason": "審査では定量的な効果が重視されます"
      }
    ],
    "risk_flags": [
      {
        "type": "MISSING_INFO",
        "severity": "MEDIUM",
        "location": "expected_effects",
        "original_text": "【未確定：○%】削減",
        "suggestion": "具体的な数値を入力してください",
        "reason": "数値がないと審査で不利になります"
      }
    ],
    "metadata": {
      "completeness_score": 75,
      "review_readiness": "NEEDS_WORK",
      "primary_concerns": ["効果の数値化", "賃上げ計画の確認"]
    }
  }
}
```

---

## 6. TypeScript型定義

```typescript
// Eligibility JSON
interface EligibilityJSON {
  subsidy_id: string;
  workflow_id: string | null;
  extracted_at: string;
  basic: {
    target_area: {
      type: 'national' | 'pref' | 'city' | 'region';
      values: string[];
      raw: string;
    };
    target_industry: {
      values: string[];
      excluded: string[];
      raw: string;
    };
    target_size: {
      employees_max: number | null;
      capital_max: number | null;
      raw: string;
    };
    subsidy_rate: string;
    max_amount: number;
    min_amount: number | null;
    acceptance_period: {
      start: string;
      end: string;
    };
    implementation_period: {
      start: string | null;
      end: string | null;
    };
  };
  eligibility: {
    must: EligibilityRule[];
    any_of: EligibilityGroup[];
    must_not: EligibilityRule[];
    need_check: NeedCheckItem[];
    bonus: BonusItem[];
  };
  expenses: {
    eligible_categories: string[];
    eligible_items: EligibleItem[];
    ineligible_items: IneligibleItem[];
    rules: ExpenseRule[];
  };
  documents: {
    required: RequiredDocument[];
    optional: string[];
    forms: FormDocument[];
  };
  review: {
    criteria: ReviewCriterion[];
    tips: string[];
  };
  risk_flags: RiskFlag[];
  missing_keys: string[];
}

interface EligibilityRule {
  id: string;
  question: string;
  data_key: string;
  operator: Operator;
  value: any;
  evidence: string;
}

interface EligibilityGroup {
  group_id: string;
  description: string;
  items: EligibilityRule[];
}

interface NeedCheckItem {
  id: string;
  question: string;
  data_key: string;
  hint: string;
  evidence: string;
}

interface BonusItem {
  id: string;
  question: string;
  data_key: string;
  operator: Operator;
  value: any;
  points: number | null;
  evidence: string;
}

interface RiskFlag {
  type: 'FINANCING' | 'ORGANIZATION' | 'EXPENSE' | 'BUSINESS_MODEL' | 'COMPLIANCE' | 'SCHEDULE' | 'DOCUMENT';
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  trigger: string;
}

type Operator = 'IN' | 'NOT_IN' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'BETWEEN' | 'CONTAINS' | 'NOT_CONTAINS' | 'EXISTS' | 'NOT_EXISTS' | 'NOT_ONLY' | 'MATCHES';

// Draft
interface Draft {
  id: string;
  company_id: string;
  subsidy_id: string;
  version: number;
  created_at: string;
  content: DraftContent;
  evidence_map: Record<string, Evidence[]>;
  open_questions: OpenQuestion[];
  risk_flags: DraftRiskFlag[];
  metadata: DraftMetadata;
}

interface DraftContent {
  overview: string;
  current_issues: string;
  project_plan: string;
  necessity: string;
  expected_effects: {
    quantitative: string;
    qualitative: string;
  };
  implementation_structure: string;
  schedule: ScheduleItem[];
  budget_breakdown: BudgetItem[];
  document_checklist: DocumentChecklistItem[];
  notes_and_risks: string[];
}

interface BudgetItem {
  category: string;
  item: string;
  amount: number;
  eligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'NEEDS_CHECK';
  note: string | null;
}

interface DraftRiskFlag {
  type: 'NG_EXPRESSION' | 'MISSING_INFO' | 'ELIGIBILITY_RISK';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  original_text: string;
  suggestion: string;
  reason: string;
}

interface DraftMetadata {
  completeness_score: number;
  review_readiness: 'READY' | 'NEEDS_WORK' | 'NOT_READY';
  primary_concerns: string[];
}
```

---

*ドキュメント終了*

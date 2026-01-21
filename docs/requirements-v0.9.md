# 補助金・助成金 自動マッチング＆申請書作成支援システム

## 要件定義書（Ver 0.9）

---

## 0. 文書情報

| 項目 | 内容 |
|------|------|
| 文書名 | 補助金・助成金 自動マッチング＆申請書作成支援システム 要件定義書 |
| バージョン | 0.9 |
| スコープ | MVP（Jグランツ中心）＋将来拡張（自治体スクレイピング/自動更新） |
| 作成日 | 2026-01-21 |

---

## 1. 目的・背景

### 1-1. 目的
- 企業が「会社情報」を登録するだけで、利用可能な補助金・助成金候補を自動提示する
- 候補を選ぶと、Bot（壁打ち）で不足情報を回収し、**申請書のたたき（ドラフト）**を自動生成する
- 公募要領・様式など添付資料を取り込み、根拠を示しながら支援する
- **危険な選択肢を事前に警告し、"やらない方がいい"判断を出せる**

### 1-2. 将来像（最終ゴール）
- 自治体Web / PDF / 要綱等を自動収集 → 自動構造化 → DB化 → 更新検知 → ルール更新
- 申請様式に合わせた自動入力（半自動でも可）まで到達
- 採択後（交付申請・実績報告・賃上げ・事故）まで見据えた設計

### 1-3. 設計思想（最重要）
> **「補助金を"通す"ツール」ではなく「補助金で人生を壊させないツール」**

- 採択より完走
- 金額より安全
- 自動化より判断補助

---

## 2. 対象ユーザー・利用シーン

### 2-1. ユーザー
- 企業担当者（経営者/総務/経理/補助金担当）
- 将来：支援者（士業/コンサル）も想定（顧客企業を複数管理）

### 2-2. 典型フロー
1. 会社情報登録
2. マッチング候補一覧（一次スクリーニング）
3. 候補詳細確認（根拠の提示 + リスク警告）
4. Botでヒアリング（不足情報の回収 + 危険検知）
5. 申請書たたき生成（提出前のドラフト + NG表現チェック）
6. エクスポート（Word/PDF/スプレッドシート等）＋チェックリスト

---

## 3. スコープ定義

### 3-1. MVP（Phase 1：スクレーピング無し）
- データソース：Jグランツ公開API（一覧・詳細）
- 添付ファイル（PDF/Word/Excel/ZIP）を取得し、サーバ側で保存・テキスト化（RAG投入）
- 企業情報×APIフィールドによる「一次スクリーニング」＋「候補提示」
- 候補選択後、Botが要領から必要項目を抽出 → 不足情報を質問 → 申請書ドラフト作成
- **リスク警告機能（危険度メーター、NG表現フィルター）**

### 3-2. 拡張（Phase 2：スクレーピング/自動更新）
- 自治体サイト（HTML/PDF）クローリング
- 更新検知（差分）→ 自動で再構造化 → DBのルール/要件を更新
- デジタル庁API仕様更新（yaml等）を監視して、互換層を更新（半自動/自動）

### 3-3. 非スコープ（当面やらない）
- 申請の実提出（Jグランツへの提出自動化など）
- "完全な確定判定"の保証（法務/運用上、推定＋根拠提示を基本にする）

---

## 4. 機能要件

### 4-1. 企業情報管理（Company Profile）

**入力項目（MVP必須）**
- 本店所在地（都道府県・市区町村・郵便番号）
- 業種（大分類/中分類）
- 従業員数
- 資本金
- 設立年月

**拡張入力（Phase 1でも任意）**
- 売上、利益、付加価値、賃上げ、設備投資計画、過去補助金採択、グループ企業有無 等
- → Botで都度取得できる設計にする

### 4-2. 補助金データ取得（Jグランツ）
- 一覧検索：キーワード、受付中のみ、ソート、地域、業種、従業員規模などで取得
- 詳細取得：補助率・上限・受付期間・添付ファイルの取得
- v1/v2差異の吸収（互換レイヤーで正規化して内部モデルに落とす）

### 4-3. 一次スクリーニング（高速マッチング）
- 企業プロファイルと補助金データの一致判定（例）
  - 地域一致（対象地域/検索用）
  - 業種一致（対象業種）
  - 規模一致（対象従業員規模、資本金帯など）
  - 受付中、締切間近、上限額帯
- 出力：候補リスト＋一致理由（説明可能に）

### 4-4. 詳細判定支援（要領理解＋不足情報回収）
- 添付ファイルのテキスト化（Markdown化）→ RAG
- LLMが「要件」「対象経費」「必要書類」「スケジュール」「注意点」を抽出
- 不足情報を質問して埋める（壁打ちフロー）
- 出力（候補ごと）：
  - **A/B/C判定（推奨/注意/非推奨）**
  - 根拠（要領の該当箇所）
  - チェックリスト（提出物、社内確認、見積、添付など）
  - **リスクフラグ（危険度表示）**

### 4-5. 申請書たたき生成
- 申請様式（Word/Excel/PDF）に合わせて、可能な範囲でドラフト生成
- MVPではまず「申請書たたき（文章/項目）」を出す（フォーム自動入力は拡張）
- **NG表現フィルター搭載**
- 出力形式：
  - 文章ドラフト（セクション別）
  - 入力項目一覧（どこが未確定か含む）
  - 添付書類の準備指示
  - リスク警告

### 4-6. 通知（任意・将来）
- 企業情報に基づく新着通知（地域/業種/規模）
- カスタム通知（ユーザー指定条件）

---

## 5. 判定ステータス（3段階評価）

マッチング結果は従来の「使える/使えそう」ではなく、**事故回避を最優先**とした3段階評価とする。

| ステータス | 表示名 | 意味 |
|-----------|--------|------|
| `PROCEED` | 推奨 | 要件を概ね満たし、リスクも低い |
| `CAUTION` | 注意 | 使える可能性はあるが、確認事項・リスクあり |
| `DO_NOT_PROCEED` | 非推奨 | 要件未達または高リスク、申請を推奨しない |

### 判定ルール例
- リース共同申請 × 決算弱い → **非推奨**
- 分社化予定あり × 新事業進出補助金 → **非推奨**
- 賃上げ未達リスク高 → **注意**
- 経費が機械・システム・建物で明確 → **推奨**

---

## 6. リスクフラグ体系

### 6-1. リスクタイプ

| タイプ | 説明 | 例 |
|--------|------|-----|
| `FINANCING` | 資金スキームリスク | リース共同申請、銀行融資不可、根抵当権 |
| `ORGANIZATION` | 組織・人事リスク | 分社化、従業員0名、賃上げ要件 |
| `EXPENSE` | 経費・交付申請リスク | 見積曖昧、「一式」、交付申請減額 |
| `BUSINESS_MODEL` | 事業内容リスク | NG業種、外販NG、流行りビジネス |
| `COMPLIANCE` | コンプラ・事故リスク | 不正受給、返還義務、非免責債権 |

### 6-2. リスクレベル

| レベル | 意味 |
|--------|------|
| `HIGH` | 採択取消・返還・事業継続不可のリスク |
| `MEDIUM` | 採択率低下・交付減額・手続き難航のリスク |
| `LOW` | 軽微な注意事項 |

### 6-3. JSON構造例

```json
"risk_flags": [
  {
    "type": "FINANCING",
    "level": "HIGH",
    "message": "リース共同申請は採択後に変更不可。再審査否決時は辞退リスクあり"
  },
  {
    "type": "ORGANIZATION",
    "level": "HIGH",
    "message": "分社化により賃上げ要件未達の可能性"
  },
  {
    "type": "EXPENSE",
    "level": "MEDIUM",
    "message": "交付申請時に減額されやすい経費構成"
  }
]
```

---

## 7. データ要件（内部データモデル）

### 7-1. User（ユーザー）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| email | text | ユニーク |
| password_hash | text | bcrypt/argon2 |
| name | text | 任意 |
| role | enum | SUPER_ADMIN / ADMIN / ADVISOR(将来) |
| status | enum | active / disabled |
| created_at | timestamp | |
| updated_at | timestamp | |
| last_login_at | timestamp | |

### 7-2. Company（企業）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| name | text | |
| hq_postal_code | text | 郵便番号 |
| hq_prefecture | text | |
| hq_city | text | |
| industry_main | text | 大分類 |
| industry_sub | text | 中分類 |
| employees | int | |
| capital | bigint | |
| founded_at | date | |
| created_at | timestamp | |
| updated_at | timestamp | |

### 7-3. CompanyMembership（企業所属）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| company_id | UUID | FK |
| user_id | UUID | FK |
| company_role | enum | owner / editor / viewer |
| created_at | timestamp | |

### 7-4. Subsidy（補助金・正規化）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | text | JグランツID |
| title | text | |
| source | enum | jgrants / future |
| max_amount | bigint | |
| subsidy_rate | text | |
| target_area | text | |
| target_industry | text | |
| target_employees | text | |
| acceptance_start | timestamp | |
| acceptance_end | timestamp | |
| raw_json | jsonb | API生データ |
| created_at | timestamp | |
| updated_at | timestamp | |

### 7-5. Attachment（添付）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| subsidy_id | text | FK |
| category | enum | guideline / form / outline |
| file_name | text | |
| storage_path | text | S3等 |
| extracted_text | text | Markdown |
| status | enum | pending / processing / ready / failed |
| created_at | timestamp | |

### 7-6. EligibilityRule（要件JSON）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| subsidy_id | text | FK |
| workflow_id | text | v2対応 |
| basic | jsonb | 基本情報 |
| eligibility | jsonb | must/any_of/must_not/need_check/bonus |
| expenses | jsonb | 対象経費/対象外 |
| documents | jsonb | 必要書類 |
| review | jsonb | 審査観点 |
| risk_flags | jsonb | リスクフラグ |
| created_at | timestamp | |
| updated_at | timestamp | |

### 7-7. EvaluationRun（判定）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| company_id | UUID | FK |
| subsidy_id | text | FK |
| match_score | int | 0-100 |
| matched_flags | jsonb | 地域/業種/規模 |
| missing_items | jsonb | Botで聞く項目 |
| risk_flags | jsonb | 検出されたリスク |
| status | enum | PROCEED / CAUTION / DO_NOT_PROCEED |
| created_at | timestamp | |

### 7-8. Conversation（壁打ち）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| company_id | UUID | FK |
| subsidy_id | text | FK |
| messages | jsonb | role/user/assistant |
| extracted_answers | jsonb | 確定値 |
| missing_keys | jsonb | 未取得 |
| created_at | timestamp | |
| updated_at | timestamp | |

### 7-9. DraftDocument（申請書たたき）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| company_id | UUID | FK |
| subsidy_id | text | FK |
| content | jsonb | セクション別 |
| evidence_map | jsonb | 根拠引用 |
| open_questions | jsonb | 未確定項目 |
| risk_flags | jsonb | NG表現検出 |
| version | int | |
| created_at | timestamp | |

### 7-10. PasswordResetToken

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| user_id | UUID | FK |
| token_hash | text | 生トークンは保存しない |
| expires_at | timestamp | 30分〜2時間 |
| used_at | timestamp | |
| created_at | timestamp | |
| request_ip | text | 監査用 |
| request_ua | text | 監査用 |

### 7-11. EmailLog（メール送信ログ）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| user_id | UUID | 任意 |
| type | enum | reset_password / verify_email / notice |
| to_email | text | |
| send_status | enum | queued / sent / failed |
| provider_message_id | text | SendGrid |
| created_at | timestamp | |

### 7-12. AuditLog（監査ログ）

| カラム | 型 | 備考 |
|--------|-----|------|
| id | UUID | |
| user_id | UUID | |
| action | text | |
| resource_type | text | |
| resource_id | text | |
| details | jsonb | |
| ip_address | text | |
| created_at | timestamp | |

---

## 8. match_score 計算仕様

### 8-1. スコア構成（100点満点）

#### A. 受付状態（10点）
- 受付中：+10
- 受付終了：+0

#### B. 地域（30点）
- `target_area_search` が「全国」：+30
- 都道府県一致：+30
- 広域（関東、複数県）で包含：+20
- それ以外：+0
- 曖昧/空：+10 & `missing_items` に `hq_area_detail`

#### C. 業種（25点）
- `target_industry` が「全業種」：+25
- `industry_main` 一致：+25
- 中分類のみ一致：+15
- 不一致：+0

#### D. 規模（25点）
- 「中小企業・小規模事業者」など曖昧：+15 & `missing_items` に `sme_definition_check`
- 数値帯が読み取れて一致：+25
- 不一致：+0

#### E. 目的一致（任意10点）
- `use_purpose` / `detail` にニーズキーワード含む：+10
- それ以外：+0

### 8-2. status判定ルール

| 条件 | ステータス |
|------|-----------|
| score >= 70 & hard_ng無し & risk_flags HIGH無し | `PROCEED` |
| score >= 40 & hard_ng無し | `CAUTION` |
| score < 40 または hard_ng あり | `DO_NOT_PROCEED` |

### 8-3. hard_ng（強い除外条件）
- 対象地域が単一都道府県で、企業所在地が別
- 対象業種が明確に限定され、企業業種が別
- 受付終了

---

## 9. Eligibility JSON スキーマ

```json
{
  "subsidy_id": "a0W...",
  "workflow_id": "wf-001",
  "extracted_at": "2026-01-21T...",
  "basic": {
    "target_area": {"type":"pref", "values":["東京都"], "raw":"都内に本店を有する中小企業…"},
    "target_industry": {"values":["全業種"], "raw":"…"},
    "target_size": {"raw":"中小企業・小規模事業者…"}
  },
  "eligibility": {
    "must": [
      {"id":"E001","question":"東京都に本店があるか","data_key":"hq_prefecture","operator":"IN","value":["東京都"],"evidence":"p3 ..."}
    ],
    "any_of": [
      {"group_id":"A01","items":[
        {"id":"E010","question":"DXに資する取組か","data_key":"project_theme","operator":"CONTAINS","value":["DX"],"evidence":"p7 ..."}
      ]}
    ],
    "must_not": [
      {"id":"N001","question":"対象外経費のみで構成されていないか","data_key":"expenses","operator":"NOT_ONLY","value":["PC購入"],"evidence":"p10 ..."}
    ],
    "need_check": [
      {"id":"NC001","question":"中小企業の定義を満たすか","data_key":"sme_definition","hint":"業種により定義が異なる","evidence":"p4 ..."}
    ],
    "bonus": [
      {"id":"B001","question":"賃上げ計画があるか","data_key":"wage_up","operator":"==","value":true,"evidence":"p12 ..."}
    ]
  },
  "expenses": {
    "eligible_categories":["software","equipment","outsourcing"],
    "ineligible_examples":["汎用PC","消耗品"],
    "rules":[{"id":"X001","raw":"相見積2社以上…","evidence":"p15 ..."}]
  },
  "documents": {
    "required":["決算書","見積書","会社概要"],
    "optional":["事業計画書"],
    "forms":[{"name":"様式1.docx","attachment_id":"..."}]
  },
  "review": {
    "criteria":["課題の明確性","実現可能性","効果"],
    "tips":["数値で効果を書く","体制を書く"]
  },
  "risk_flags": [
    {"type":"FINANCING","level":"HIGH","message":"リース共同申請の場合、採択後変更不可"}
  ],
  "missing_keys": []
}
```

---

## 10. data_key 辞書

### 会社情報（固定）
- `hq_postal_code`
- `hq_prefecture`
- `hq_city`
- `industry_main`
- `industry_sub`
- `employees`
- `capital`
- `founded_at`

### 案件（壁打ちで回収）
- `project_title`
- `project_summary`
- `current_issues`
- `project_theme` (配列)
- `project_start_date`
- `project_end_date`
- `implementation_structure`
- `expected_effects_quant`
- `expected_effects_qual`
- `wage_up` (boolean)
- `sales_trend` (+/-/%)
- `expenses` (配列: category/name/amount/vendor/date)
- `quotes_ready` (boolean)
- `financial_docs_ready` (boolean)
- `other_constraints`

### 判定用（要確認）
- `sme_definition_check`
- `area_detail_check`
- `eligibility_special_check`
- `division_planned` (分社化予定)
- `lease_joint_application` (リース共同申請)

---

## 11. API仕様

### 11-1. 認証

| Method | Path | 説明 |
|--------|------|------|
| POST | `/auth/register` | ユーザー登録 |
| POST | `/auth/login` | ログイン |
| POST | `/auth/logout` | ログアウト |
| POST | `/auth/change-password` | パスワード変更（ログイン中） |
| POST | `/auth/request-password-reset` | パスワード再設定要求 |
| POST | `/auth/reset-password` | パスワード再設定実行 |

### 11-2. Company

| Method | Path | 説明 |
|--------|------|------|
| POST | `/companies` | 企業作成 |
| GET | `/companies` | 企業一覧 |
| GET | `/companies/{id}` | 企業詳細 |
| PUT | `/companies/{id}` | 企業更新 |

### 11-3. Subsidy

| Method | Path | 説明 |
|--------|------|------|
| GET | `/subsidies/search` | 補助金検索（一次スクリーニング結果含む） |
| GET | `/subsidies/{id}` | 補助金詳細 |
| POST | `/subsidies/{id}/attachments/ingest` | 添付取込ジョブ投入 |
| GET | `/subsidies/{id}/eligibility` | 要件JSON取得 |

### 11-4. Evaluation

| Method | Path | 説明 |
|--------|------|------|
| POST | `/evaluations/run` | 判定実行 |
| GET | `/evaluations/{id}` | 判定結果取得 |

### 11-5. Conversation

| Method | Path | 説明 |
|--------|------|------|
| POST | `/conversations/start` | 壁打ち開始 |
| POST | `/conversations/{id}/message` | メッセージ送信 |
| GET | `/conversations/{id}` | 会話取得 |

### 11-6. Draft

| Method | Path | 説明 |
|--------|------|------|
| POST | `/drafts/generate` | ドラフト生成 |
| GET | `/drafts/{id}` | ドラフト取得 |

### 11-7. Jobs

| Method | Path | 説明 |
|--------|------|------|
| GET | `/jobs/{id}` | ジョブ状態取得 |

### 11-8. Usage

| Method | Path | 説明 |
|--------|------|------|
| GET | `/me/usage` | 利用量取得 |

---

## 12. アーキテクチャ

### 12-1. コンポーネント構成

```
┌─────────────────┐      ┌─────────────────┐
│  Cloudflare     │      │  AWS            │
│  Pages/Workers  │      │                 │
├─────────────────┤      ├─────────────────┤
│ - フロント配信   │      │ - ファイル処理   │
│ - 軽量API       │◄────►│ - バッチ/キュー  │
│ - キャッシュ     │      │ - LLM呼び出し    │
│ - 認証前段       │      │ - 秘匿情報管理   │
└─────────────────┘      └─────────────────┘
                                │
                         ┌──────┴──────┐
                         │             │
                    ┌────┴────┐   ┌────┴────┐
                    │ Postgres │   │   S3    │
                    │   DB     │   │ Storage │
                    └──────────┘   └─────────┘
```

### 12-2. 役割分担

| 層 | 担当 | 内容 |
|-----|------|------|
| Edge | Cloudflare | フロント、軽量API、JWT認証、キャッシュ |
| Heavy | AWS | PDF変換、ZIP展開、LLM呼び出し、バッチジョブ |
| Data | AWS | Postgres、S3、署名URL、監査ログ |

---

## 13. ジョブ設計

### Job A: Jグランツ差分取り込み（定期）
- スケジュール：1日2〜4回
- 処理：新着/更新の検知、upsert

### Job B: 詳細取得＆添付保存（オンデマンド）
- トリガ：ユーザーが詳細を開いた時、Job Aで更新検知時
- 処理：詳細API取得、添付S3保存

### Job C: 添付→テキスト変換（非同期）
- トリガ：Job B完了
- 処理：PDF/Office/ZIP変換、Markdown化

### Job D: 要件JSON抽出
- トリガ：Job C完了
- 処理：LLMで抽出、evidence必須

### Job E: 再評価
- トリガ：企業情報更新、eligibility更新、新規募集
- 処理：match_score再計算

### Job F: 通知（任意）
- 新着候補、締切間近、リマインド

---

## 14. セキュリティ要件

### 14-1. APIキー管理
- 平文保存禁止
- KMS相当で暗号化
- UIはマスク表示
- ログに出さない

### 14-2. 添付ファイル
- サイズ上限（50MB）
- 拡張子制限
- zip爆弾対策
- ファイル名サニタイズ
- 署名URLは短命（10分）

### 14-3. 認証
- パスワード要件：最低8文字
- レート制限：IP/メール単位
- トークン有効期限：30〜120分
- 成功/失敗メッセージ同一化（列挙防止）

### 14-4. 監査ログ
- 企業情報の作成/更新
- 補助金詳細閲覧
- 添付ファイル取得
- LLM呼び出し（メタ情報のみ）
- ドラフト生成
- 署名URL発行

---

## 15. 権限設計（RBAC）

### 15-1. システムロール

| ロール | 説明 |
|--------|------|
| `SUPER_ADMIN` | 全ユーザー/全企業/全ログ/全コスト管理 |
| `ADMIN` | 一般ユーザー、自分の企業を管理 |
| `ADVISOR` | 将来：支援先企業を複数管理 |

### 15-2. 企業内ロール

| ロール | 説明 |
|--------|------|
| `owner` | 企業の全権限 |
| `editor` | 壁打ち・ドラフト生成可能 |
| `viewer` | 閲覧のみ |

---

## 16. 壁打ちBot質問テンプレ

### 16-1. 共通質問（全補助金共通）

#### ① 事業概要
```
今回の補助金で取り組む事業内容を、
第三者（審査員）が読んで理解できる形で教えてください。
```

#### ② 現状課題
```
現在、どのような課題がありますか？
（売上・業務効率・人手不足・品質など）
```

#### ③ 取組内容
```
今回導入・実施する内容を具体的に教えてください。
（設備、システム、外注、サービスなど）
```

#### ④ 期待効果
```
その取り組みによって、どのような効果を見込んでいますか？
数値で表せるものがあれば教えてください。
```

#### ⑤ 実施スケジュール
```
開始時期と完了予定時期を教えてください。
```

#### ⑥ 実施体制
```
本事業を実施する担当者・体制を教えてください。
```

### 16-2. 危険検知質問（赤信号用）

#### リース共同申請検知時
```
この補助金は、リース会社が補助金返還義務を負う仕組みです。
・すでに取引のあるリース会社はありますか？
・直近決算は黒字ですか？
・賃上げ要件を確実に達成できますか？

※いずれかに不安がある場合、この申請は推奨されません。
```

#### 分社化検知時
```
今後3〜5年の間に、分社化・M&A・事業譲渡の予定はありますか？
→ はいの場合、この補助金は返還リスクが高まります。
```

### 16-3. 経費内訳
```
今回の事業にかかる経費を、
「内容」「金額」「支払先」「時期」で教えてください。
```

---

## 17. 申請書たたき構成

### 出力セクション（固定キー）

```json
{
  "overview": "事業概要",
  "current_issues": "現状課題",
  "project_plan": "事業内容・導入内容",
  "necessity": "事業の必要性",
  "expected_effects": "期待される効果",
  "implementation_structure": "実施体制",
  "schedule": "スケジュール",
  "budget_breakdown": "経費内訳",
  "document_checklist": "添付書類チェックリスト",
  "notes_and_risks": "注意事項・リスク"
}
```

---

## 18. NG表現フィルター

### 自動検出キーワード

| キーワード | 理由 |
|-----------|------|
| 「将来的に販売」 | 外販NGの補助金で致命的 |
| 「業界標準として」 | 革新性が疑われる |
| 「横展開」 | 補助対象外と判断される可能性 |
| 「まずは自社で使い、将来」 | 外販計画と見なされる |
| 「一式」 | 見積不明確と判断される |
| 「詳細は後日」 | 計画不十分と判断される |

### 検出時の出力

```
⚠️ この表現は補助金要件上NGまたは危険です。
理由：将来的な外販が補助対象外と明記されています。
```

---

## 19. UI要件（画面一覧）

### 認証
- ログイン
- 新規登録
- パスワード再設定
- パスワード変更

### 企業管理
- 企業情報登録/編集

### 補助金
- マッチング一覧（フィルタ、並び替え、危険度メーター）
- 補助金詳細（根拠、リスク警告、添付一覧）

### 壁打ち
- チャット画面（進捗、未取得項目、次の質問）

### 申請書
- たたき画面（セクションタブ、要確認/未確定強調、NG表現警告）
- ダウンロード

### 管理（SUPER_ADMIN）
- ユーザー一覧
- コスト管理
- ジョブ監視
- 監査ログ

---

## 20. 利用制限（クォータ）

### 制限単位

| 単位 | 項目 |
|------|------|
| ユーザー | 月間LLMトークン上限 |
| 企業 | 月間添付変換回数上限 |
| リクエスト | 1回あたり添付サイズ/件数 |

### SUPER_ADMIN設定項目
- `llm_tokens_month`
- `attachment_conversions_month`
- `max_attachment_mb`
- `max_jobs_per_day`
- `hard_stop_on_limit`（上限時の挙動）

---

## 21. LLMゲートウェイ

### 機能
- モデルルーティング（task_typeに応じて選択）
- コスト計測（ユーザー/企業/案件ごと）
- キャッシュ（同一入力は再利用）
- リトライ/フォールバック
- ガードレール（最大トークン、実行時間）
- プロンプト管理（バージョン管理）

### モデル使い分け
- 文章生成・要約：ChatGPT
- 長文処理・コスト比較：Gemini

---

## 22. RAG仕様

### 対象ドキュメント
- 公募要領（PDF）
- 様式（Word/Excel）
- 概要資料
- （将来）自治体Webページ、実務事故DB

### 分割
- Chunk単位：見出しごと＋段落（300〜800字）
- メタ付与：subsidy_id, attachment_id, section_title, page_hint

### 根拠引用
- `evidence_quote`（120文字以内）
- `source_ref`（attachment名/見出し/ページヒント）

---

## 23. 開発フェーズ

### Phase 1（MVP）
- User/Company登録
- Jグランツ検索/詳細取得（v1/v2正規化）
- 添付保存・テキスト化・RAG
- 一次スクリーニング
- 壁打ち（不足情報収集＋危険検知）
- 申請書たたき生成（NG表現フィルター付き）
- リスク警告表示

### Phase 1.5（運用安定）
- コスト計測・レート制限・キャッシュ
- ログ/監査
- 通知（最低限）

### Phase 2（スクレーピング＆自動更新）
- クロール基盤
- 更新検知
- ルールDB化
- 既存案件との突合・再評価

---

## 24. 受け入れ基準（MVPの合格ライン）

1. 会社情報登録→候補が出る（地域/業種/規模の理由付き）
2. 候補1件を選んで、要領添付を取り込み、必要項目を抽出できる
3. 壁打ちで不足情報を回収し、申請書のたたきを生成できる
4. **リスクフラグが表示され、危険な場合は警告が出る**
5. **NG表現が検出され、修正を促す**
6. APIキーが安全に扱えて、ログ漏えいがない
7. 1企業あたりの月コストが見える

---

## 付録A: Operator一覧（Eligibility判定用）

| Operator | 説明 |
|----------|------|
| `IN` | 値が配列に含まれる |
| `NOT_IN` | 値が配列に含まれない |
| `==` | 等しい |
| `!=` | 等しくない |
| `<=` | 以下 |
| `>=` | 以上 |
| `BETWEEN` | 範囲内 |
| `CONTAINS` | 配列に値が含まれる |
| `NOT_CONTAINS` | 配列に値が含まれない |
| `EXISTS` | 値が存在する |
| `NOT_EXISTS` | 値が存在しない |
| `NOT_ONLY` | 指定値のみで構成されていない |

---

## 付録B: SendGridメールテンプレート

### パスワード再設定

```
件名：【補助金マッチングシステム】パスワード再設定のご案内

{name}様

パスワード再設定のリクエストを受け付けました。
以下のリンクをクリックして、新しいパスワードを設定してください。

{reset_url}

このリンクは{expiry_minutes}分間有効です。

心当たりのない場合は、このメールを無視してください。
お問い合わせ：{support_email}
```

---

*ドキュメント終了*

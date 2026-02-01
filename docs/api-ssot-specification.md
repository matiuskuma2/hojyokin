# API設計 SSOT参照仕様書

> **凍結仕様**: 検索/詳細/壁打ちのどれも、最終的に `subsidy_cache` を見れば完結する状態に寄せる。
> 外部ソースのID（jgrants id / izumi policy_id）は、subsidy_cache を補完するための "ソースリンク" として扱う。

---

## 1. SSOT階層構造（凍結）

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 1: 検索・表示用（高速アクセス）                                     │
│   subsidy_cache                                                          │
│   ├─ 正規カラム: id, source, title, acceptance_end_datetime, etc.       │
│   ├─ wall_chat_mode: 'enabled' | 'disabled_electronic' | 'disabled_excluded' │
│   └─ is_electronic_application: 0/1                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ detail_json
┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 2: 詳細・壁打ち用（半構造化）                                       │
│   subsidy_cache.detail_json                                              │
│   ├─ 基本: overview, use_purpose, workflows, related_url               │
│   ├─ 壁打ち用: application_requirements, eligible_expenses,             │
│   │           required_documents, deadline                              │
│   ├─ 出典管理: field_sources, provenance                                │
│   └─ 判定根拠: excluded_reason, exclusion_pattern                       │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ canonical_id
┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 3: 紐付け・履歴管理（正規化）                                       │
│   subsidy_canonical → subsidy_source_link → subsidy_snapshot            │
│   ├─ canonical: 制度の恒久キー（同一制度を束ねる）                        │
│   ├─ source_link: jgrants/izumi/tokyo-* のID紐付け                      │
│   └─ snapshot: 時点データ（過去の募集回も保持）                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 検索API（/api/subsidies/search）

### 2.1 SSOT参照仕様

```
【凍結仕様】
検索は subsidy_cache の正規カラムのみを使用する（インデックス効く、壊れにくい）
detail_json は補助（全文検索・タグ）に限定
```

### 2.2 SQLクエリ基本形

```sql
SELECT 
  id, source, title, 
  subsidy_max_limit, subsidy_rate,
  target_area_search, target_industry, target_number_of_employees,
  acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag,
  wall_chat_ready, wall_chat_mode, is_electronic_application
FROM subsidy_cache
WHERE 
  -- 有効期限内
  expires_at > datetime('now')
  -- 受付中（デフォルトON）
  AND acceptance_end_datetime >= ?  -- today
  -- SEARCHABLE条件（detail_jsonが十分）
  AND detail_json IS NOT NULL AND LENGTH(detail_json) > 10
  -- フィルタ条件（任意）
  AND (target_area_search IS NULL OR target_area_search = '全国' OR target_area_search LIKE ?)
  AND (? IS NULL OR title LIKE ?)
ORDER BY acceptance_end_datetime ASC
LIMIT ? OFFSET ?
```

### 2.3 フィルタ条件マッピング

| パラメータ | カラム | 演算 | デフォルト |
|-----------|--------|------|-----------|
| `keyword` | `title` | `LIKE %?%` | なし |
| `acceptance` | `acceptance_end_datetime >= today` | 範囲 | **1（ON）** |
| `target_area_search` | `target_area_search` | `LIKE %?%` OR `NULL` OR `'全国'` | company.prefecture |
| `target_industry` | `target_industry` | `LIKE %?%` | なし |
| `target_number_of_employees` | `target_number_of_employees` | 範囲 | なし |
| `wall_chat_only` | `wall_chat_mode = 'enabled'` | 完全一致 | なし |
| `include_electronic` | `is_electronic_application` | 含める/除外 | **含める** |

### 2.4 レスポンス構造

```typescript
interface SearchResponse {
  success: boolean;
  data: {
    subsidies: Array<{
      id: string;
      source: 'jgrants' | 'izumi' | 'tokyo-kosha' | 'manual';
      title: string;
      subsidy_max_limit: number | null;
      subsidy_rate: string | null;
      target_area_search: string | null;
      acceptance_end_datetime: string | null;
      // 壁打ち判定
      wall_chat_ready: boolean;
      wall_chat_mode: 'enabled' | 'disabled_electronic' | 'disabled_excluded' | 'pending';
      wall_chat_missing?: string[];
      // 電子申請
      is_electronic_application: boolean;
      // スクリーニング結果
      evaluation?: {
        status: 'PROCEED' | 'CAUTION' | 'NO';
        score: number;
        match_reasons: MatchReason[];
        risk_flags: RiskFlag[];
      };
    }>;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
    source: 'live' | 'cache' | 'mock';
    gate: 'searchable-only' | 'debug:all';
    acceptance_filter: 'active_only' | 'all';
  };
}
```

---

## 3. 詳細API（/api/subsidies/:subsidy_id）

### 3.1 SSOT参照仕様

```
【凍結仕様】
詳細表示は detail_json を主体にするが、期限・金額などは正規カラムを優先（SSOT化）
- 期限: acceptance_end_datetime（正規カラム）
- 金額: subsidy_max_limit（正規カラム）
- 補助率: subsidy_rate（正規カラム）
- その他: detail_json から取得
```

### 3.2 データ取得優先順位

| 項目 | 優先順位1 | 優先順位2 | 優先順位3 |
|------|----------|----------|----------|
| 締切 | `acceptance_end_datetime`（カラム） | `detail_json.deadline` | `detail_json.workflows[].acceptance_end` max |
| 上限額 | `subsidy_max_limit`（カラム） | `detail_json.subsidy_max_limit` | - |
| 補助率 | `subsidy_rate`（カラム） | `detail_json.subsidy_rate_v2` | `detail_json.subsidy_rate` |
| 概要 | `detail_json.overview` | `detail_json.description` | - |
| 申請要件 | `detail_json.application_requirements_v2` | `detail_json.application_requirements` | - |
| 対象経費 | `detail_json.eligible_expenses_v2` | `detail_json.eligible_expenses` | - |
| 必要書類 | `detail_json.required_documents` | - | - |

### 3.3 レスポンス構造

```typescript
interface DetailResponse {
  success: boolean;
  data: {
    subsidy: {
      // 基本情報（正規カラム優先）
      id: string;
      source: string;
      title: string;
      acceptance_end_datetime: string | null;  // SSOT
      subsidy_max_limit: number | null;         // SSOT
      subsidy_rate: string | null;              // SSOT
      
      // 詳細情報（detail_json）
      overview: string | null;
      application_requirements: string | string[] | null;
      eligible_expenses: string | string[] | null;
      required_documents: string | string[] | null;
      target_area_detail: string | null;
      target_industry: string | null;
      contact: ContactInfo | null;
      
      // URL・PDF
      related_url: string | null;
      pdf_urls: string[];
      attachments: Attachment[];
      
      // 電子申請
      is_electronic_application: boolean;
      electronic_application_url?: string;
      electronic_application_system?: string;
    };
    
    // 壁打ち判定
    wall_chat_ready: boolean;
    wall_chat_mode: 'enabled' | 'disabled_electronic' | 'disabled_excluded' | 'pending';
    wall_chat_missing: string[];
    
    // 出典情報（プロベナンス）
    provenance?: {
      field_sources: Record<string, FieldSource>;
      last_updated_at: string;
      source_type: string;
    };
    
    // 評価結果（company_idがある場合）
    evaluation?: EvaluationResult | null;
    
    // メタ
    source: 'live' | 'cache' | 'mock';
  };
}

interface FieldSource {
  source: 'api' | 'pdf' | 'html' | 'fallback' | 'manual';
  updated_at: string;
  confidence: number;  // 0.0-1.0
  url?: string;
}
```

---

## 4. 壁打ちAPI（/api/chat/*）

### 4.1 SSOT参照仕様

```
【凍結仕様】
壁打ち判定は wall_chat_mode を最優先で参照する
- disabled_electronic（電子申請）→ 壁打ちは出さない（検索/詳細だけ）
- disabled_excluded（交付申請/宣言/認定/練習/ガイドライン）→ 検索は出して良いが壁打ちは出さない
- enabled → WALL_CHAT_READY 判定に進む

電子申請系は常に壁打ちOFF（判定がブレない）
```

### 4.2 壁打ち可否判定フロー

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 1: wall_chat_mode チェック（最優先）                                │
│                                                                          │
│   wall_chat_mode = ?                                                     │
│   ├─ 'disabled_electronic' → 即座にNG（電子申請）                        │
│   ├─ 'disabled_excluded'   → 即座にNG（除外対象）                        │
│   ├─ 'pending'             → Step 2 へ                                   │
│   └─ 'enabled'             → Step 2 へ                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 2: 除外パターンチェック（title + overview）                         │
│                                                                          │
│   EXCLUSION_PATTERNS:                                                    │
│   ├─ KOFU_SHINSEI: /交付申請|交付決定後|採択後|実績報告|精算払い|概算払い/│
│   ├─ SENGEN_NINTEI: /(?:成長)?宣言|認定(?:制度|プログラム|企業)/         │
│   ├─ GUIDELINE_ONLY: /ガイドライン|使用規約|利用規約|手引き/              │
│   └─ RENSHU_TEST: /練習用|テスト用|ダミー|サンプル/                      │
│                                                                          │
│   マッチ → wall_chat_mode = 'disabled_excluded', NG                     │
│   非マッチ → Step 3 へ                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 3: 電子申請チェック                                                  │
│                                                                          │
│   is_electronic_application = true?                                      │
│   ├─ true → wall_chat_mode = 'disabled_electronic', NG                  │
│   └─ false → Step 4 へ                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 4: 必須項目チェック（5項目）                                         │
│                                                                          │
│   REQUIRED_FIELDS:                                                       │
│   ├─ overview (or description): length >= 20                            │
│   ├─ application_requirements: 配列1件以上 or length >= 20              │
│   ├─ eligible_expenses: 配列1件以上 or length >= 20                     │
│   ├─ required_documents: 配列1件以上                                     │
│   └─ deadline (acceptance_end_datetime): 存在確認                        │
│                                                                          │
│   5/5 → wall_chat_mode = 'enabled', wall_chat_ready = 1, OK             │
│   <5/5 → wall_chat_mode = 'enabled', wall_chat_ready = 0, NG（不足あり）│
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 壁打ちセッション開始（/api/chat/sessions POST）

```typescript
// リクエスト
interface CreateSessionRequest {
  company_id: string;
  subsidy_id: string;
}

// 事前チェック
async function validateWallChatEligibility(subsidyId: string): Promise<{
  eligible: boolean;
  reason?: string;
  wall_chat_mode: string;
}> {
  const subsidy = await getSubsidyFromCache(subsidyId);
  
  // Step 1: wall_chat_mode チェック
  if (subsidy.wall_chat_mode === 'disabled_electronic') {
    return {
      eligible: false,
      reason: 'この補助金は電子申請システムでの申請が必要です。壁打ちではなく、電子申請システムをご利用ください。',
      wall_chat_mode: 'disabled_electronic',
    };
  }
  
  if (subsidy.wall_chat_mode === 'disabled_excluded') {
    return {
      eligible: false,
      reason: '交付申請・認定制度等のため、壁打ち対象外です。',
      wall_chat_mode: 'disabled_excluded',
    };
  }
  
  // Step 2-4: wall_chat_ready チェック
  if (!subsidy.wall_chat_ready) {
    const missing = subsidy.wall_chat_missing || [];
    return {
      eligible: false,
      reason: `壁打ちに必要な情報が不足しています: ${missing.join(', ')}`,
      wall_chat_mode: subsidy.wall_chat_mode,
    };
  }
  
  return {
    eligible: true,
    wall_chat_mode: 'enabled',
  };
}
```

### 4.4 壁打ち使用データ

```typescript
// 壁打ちで使用する detail_json のフィールド（SSOT）
interface WallChatRequiredData {
  // 必須（5項目）
  overview: string;                           // 事業概要
  application_requirements: string | string[]; // 申請要件
  eligible_expenses: string | string[];        // 対象経費
  required_documents: string | string[];       // 必要書類リスト
  deadline: string;                           // 締切（acceptance_end_datetime）
  
  // 推奨（あれば品質向上）
  required_forms?: RequiredForm[];            // 様式と記載項目
  subsidy_max_limit?: number;                 // 補助上限
  subsidy_rate?: string;                      // 補助率
  target_businesses?: string;                 // 対象事業
  contact?: ContactInfo;                      // お問い合わせ先
}
```

---

## 5. 更新ジョブとデータフロー

### 5.1 ジョブ分割（凍結）

| ジョブ種別 | 頻度 | 対象 | SSOT更新対象 |
|-----------|------|------|-------------|
| **Discovery** | jGrants: 日次, izumi: 週次 | 新規/変更検知 | discovery_items → subsidy_cache |
| **Core** | 日次 | 期限/金額/地域 | subsidy_cache 正規カラム |
| **Doc** | 週次 | PDF/URL クロール | detail_json.pdf_urls, attachments |
| **WallChat** | 日次 | 要件/経費/書類の整形 | detail_json.application_requirements 等 |
| **FailureExport** | 常時蓄積 | 失敗レコード | update_failures（CSV出力用） |

### 5.2 データフロー図

```
┌───────────────────────────────────────────────────────────────────────────┐
│ 外部ソース                                                                 │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│ │ jGrants │  │  izumi  │  │ 東京公社 │  │ 手動登録 │                        │
│ └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                        │
└──────┼───────────┼───────────┼───────────┼────────────────────────────────┘
       │           │           │           │
       ▼           ▼           ▼           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Discovery ジョブ                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ discovery_items（ステージング）                                       │  │
│ │ └─ stage: raw → validated → promoted (or rejected)                 │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ promoted
┌───────────────────────────────────────────────────────────────────────────┐
│ Core ジョブ（SSOT更新）                                                    │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ subsidy_cache（検索/詳細のベース）                                    │  │
│ │ ├─ 正規カラム更新: id, title, acceptance_end_datetime, etc.        │  │
│ │ ├─ detail_json 更新: overview, workflows, etc.                     │  │
│ │ └─ wall_chat_mode 判定: enabled/disabled_electronic/disabled_excluded│  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ subsidy_canonical（紐付け管理）                                       │  │
│ │ └─ subsidy_source_link: jgrants_id ↔ izumi_policy_id 紐付け        │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Doc ジョブ（PDF/URLクロール）                                              │
│ ├─ crawl_queue → Firecrawl/Vision API                                    │
│ ├─ 抽出結果 → detail_json.extracted_pdf_text, pdf_extraction_version    │
│ └─ 失敗 → update_failures                                                │
└───────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ WallChat ジョブ（壁打ち用データ整形）                                       │
│ ├─ application_requirements, eligible_expenses, required_documents 整形 │
│ ├─ wall_chat_ready 再計算                                                │
│ └─ 電子申請系は skip                                                      │
└───────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 検索/詳細/壁打ち API                                                       │
│ └─ subsidy_cache を SSOT として参照                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 出典管理（Provenance）仕様

### 6.1 detail_json 内の出典情報構造

```typescript
interface DetailJsonWithProvenance {
  // 通常のフィールド
  overview?: string;
  application_requirements?: string | string[];
  eligible_expenses?: string | string[];
  required_documents?: string | string[];
  // ... 他のフィールド
  
  // 出典管理（必須）
  _provenance: {
    // フィールドごとの出典
    field_sources: {
      overview: FieldSource;
      application_requirements: FieldSource;
      eligible_expenses: FieldSource;
      required_documents: FieldSource;
      // ... 他のフィールド
    };
    
    // ソース別の最終更新
    source_status: {
      jgrants_api: SourceStatus;
      official_html: SourceStatus;
      pdf_extraction: SourceStatus;
    };
    
    // 全体メタ
    last_full_update_at: string;
    update_version: number;
  };
}

interface FieldSource {
  source: 'jgrants_api' | 'official_html' | 'pdf_extraction' | 'manual' | 'fallback';
  updated_at: string;          // ISO8601
  confidence: number;          // 0.0-1.0
  url?: string;                // 取得元URL
  method?: string;             // 'api' | 'firecrawl' | 'vision_ocr'
}

interface SourceStatus {
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  last_error_url: string | null;
  consecutive_failures: number;
}
```

### 6.2 出典優先順位

| フィールド | 優先1 | 優先2 | 優先3 | フォールバック |
|-----------|-------|-------|-------|---------------|
| overview | jgrants_api | official_html | - | null |
| application_requirements | jgrants_api | pdf_extraction | official_html | null |
| eligible_expenses | jgrants_api | pdf_extraction | official_html | null |
| required_documents | jgrants_api | pdf_extraction | official_html | null |
| deadline | jgrants_api (acceptance_end_datetime) | - | - | null |

---

## 7. エラーハンドリング・失敗管理

### 7.1 update_failures テーブル活用

```sql
-- 未解決の失敗を取得（superadmin用）
SELECT 
  source_type,
  source_id,
  failure_type,
  failure_message,
  failure_url,
  retry_count,
  created_at
FROM update_failures
WHERE resolved = 0
ORDER BY created_at DESC;

-- CSV出力用（日次レポート）
SELECT 
  source_type,
  source_id,
  failure_type,
  failure_code,
  failure_message,
  failure_url,
  retry_count,
  created_at
FROM update_failures
WHERE resolved = 0
  AND created_at >= datetime('now', '-7 days')
ORDER BY source_type, created_at;
```

### 7.2 失敗時の挙動

| 失敗タイプ | 即時対応 | リトライ | 最終措置 |
|-----------|---------|---------|---------|
| fetch（HTTP エラー） | update_failures に記録 | 3回まで（指数バックオフ） | 前回値保持、アラート |
| parse（パースエラー） | update_failures に記録 | しない | 前回値保持、手動確認キュー |
| validate（バリデーション失敗） | update_failures に記録 | しない | 前回値保持、手動確認キュー |
| timeout | update_failures に記録 | 3回まで | 前回値保持、アラート |

---

## 8. 実装チェックリスト

### Phase 1: DB マイグレーション適用
- [ ] `0111_canonical_snapshot_izumi.sql` を本番 D1 に適用
- [ ] `wall_chat_mode` カラムの既存データ初期化
- [ ] `is_electronic_application` カラムの既存データ初期化

### Phase 2: wall_chat_mode 判定ロジック実装
- [ ] `src/lib/wall-chat-ready.ts` に `determineWallChatMode()` 追加
- [ ] 電子申請判定の SSOT 化
- [ ] 既存データの `wall_chat_mode` 一括更新バッチ

### Phase 3: API 修正
- [ ] `/api/subsidies/search`: `wall_chat_mode` をレスポンスに追加
- [ ] `/api/subsidies/:id`: `provenance` をレスポンスに追加
- [ ] `/api/chat/precheck`: `wall_chat_mode` による判定を最優先化

### Phase 4: 更新ジョブ分割
- [ ] Discovery ジョブ実装
- [ ] Core ジョブ実装
- [ ] Doc ジョブ実装
- [ ] WallChat ジョブ実装
- [ ] FailureExport ジョブ実装

### Phase 5: izumi 統合
- [ ] CSVインポートスクリプト
- [ ] `izumi_subsidies` → `subsidy_source_link` 紐付け
- [ ] canonical 昇格ロジック

---

**このドキュメントは実装変更時に必ず更新してください。**

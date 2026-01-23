# 士業ダッシュボード v1 凍結チェックリスト

作成日: 2026-01-23
参考: 情報の泉型ダッシュボード設計

---

## 目的（凍結）

士業ユーザーが毎日ここを見るだけで：
1. **担当顧客の所在地の新着補助金・助成金に気づける**
2. **顧客ごとの"おすすめ候補"が上から並ぶ**
3. **未処理（入力待ち・承認待ち）が消化できる**

---

## 1. 画面構成（凍結）

### A. 上段：NEWSフィード（4〜5カテゴリ）

| カテゴリ | source_type | 内容 | 上限 |
|----------|-------------|------|------|
| プラットフォームお知らせ | `platform` | 運営・重要告知・仕様変更 | 10件 |
| 新着支援情報 | `support_info` | JGrants同期結果、今日の増分 | 10件 |
| 都道府県NEWS | `prefecture` | **顧客所在地を優先表示** | 20件 |
| 省庁NEWS | `ministry` | 経産省・厚労省・国交省等 | 10件 |
| その他公的機関 | `other_public` | 商工会議所・支援機関等 | 10件 |

### B. 中段：顧客おすすめ（サジェスト）

| 項目 | 仕様 |
|------|------|
| 表示 | 顧客ごとに上位3件 |
| 合計上限 | 30件（10顧客×3件） |
| 表示要素 | 顧客名、補助金タイトル、締切、上限額、スコア、推薦理由 |

### C. 下段：未処理タスク

| タスク | テーブル | 条件 |
|--------|----------|------|
| 承認待ち入力 | `intake_submissions` | status='submitted' |
| 期限切れ間近リンク | `access_links` | expires_at < +7日 |
| 進行中ドラフト | `application_drafts` | status IN ('draft','in_progress') |

### D. KPI（今日のアクティビティ）

| 指標 | event_type |
|------|------------|
| 今日の検索 | SUBSIDY_SEARCH |
| 今日の壁打ち | CHAT_SESSION_STARTED |
| 今日のドラフト | DRAFT_GENERATED |

---

## 2. DBスキーマ（凍結）

### 2-1. subsidy_feed_items（NEWSアイテム）

```sql
CREATE TABLE subsidy_feed_items (
    id TEXT PRIMARY KEY,  -- hash(source_type + source_key + url)
    source_type TEXT NOT NULL,  -- platform/support_info/prefecture/municipal/ministry/other_public
    source_key TEXT,
    title TEXT NOT NULL,
    url TEXT,
    summary TEXT,
    published_at TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    region_prefecture TEXT,  -- 都道府県コード（01-47）または '00'
    region_city TEXT,
    tags_json TEXT DEFAULT '[]',  -- string[]
    event_type TEXT,  -- new/updated/closing/info/alert
    subsidy_id TEXT,
    priority INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2-2. agency_suggestions_cache（おすすめキャッシュ）

```sql
CREATE TABLE agency_suggestions_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_id TEXT NOT NULL,
    agency_client_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    subsidy_id TEXT NOT NULL,
    status TEXT NOT NULL,  -- PROCEED/CAUTION/NO
    score INTEGER NOT NULL DEFAULT 0,  -- 0-100
    match_reasons_json TEXT DEFAULT '[]',  -- ⚠️ string[]のみ（object禁止）
    risk_flags_json TEXT DEFAULT '[]',    -- ⚠️ string[]のみ（object禁止）
    subsidy_title TEXT,
    subsidy_deadline TEXT,
    subsidy_max_limit INTEGER,
    deadline_days INTEGER,
    rank_in_client INTEGER DEFAULT 1,  -- 顧客内順位
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT
);
```

### 2-3. feed_daily_snapshots（日次集計）

```sql
CREATE TABLE feed_daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,  -- YYYY-MM-DD (JST)
    agency_id TEXT,  -- NULL=全体、値あり=個別
    platform_count INTEGER DEFAULT 0,
    support_info_count INTEGER DEFAULT 0,
    prefecture_count INTEGER DEFAULT 0,
    municipal_count INTEGER DEFAULT 0,
    ministry_count INTEGER DEFAULT 0,
    other_public_count INTEGER DEFAULT 0,
    prefecture_breakdown_json TEXT DEFAULT '{}',
    client_prefecture_news_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. API仕様（凍結）

### GET /api/agency/dashboard-v2

**レスポンス:**

```typescript
{
  success: true,
  data: {
    // NEWSフィード
    news: {
      platform: NewsItem[],      // 上限10
      support_info: NewsItem[],  // 上限10
      prefecture: PrefectureNewsItem[],  // 上限20（顧客所在地優先）
      ministry: NewsItem[],      // 上限10
      other_public: NewsItem[]   // 上限10
    },
    
    // 顧客おすすめ（凍結: reasons/risksはstring[]）
    suggestions: Suggestion[],   // 上限30
    
    // 未処理タスク
    tasks: {
      pending_intakes: Task[],
      expiring_links: Task[],
      drafts_in_progress: Task[]
    },
    
    // KPI
    kpi: {
      today_search_count: number,
      today_chat_count: number,
      today_draft_count: number
    },
    
    // 統計
    stats: {
      totalClients: number,
      activeClients: number,
      clientPrefectures: string[]  // 顧客所在地コード
    },
    
    // メタ
    meta: {
      generated_at: string,
      version: 'v2'
    }
  }
}
```

**NewsItem:**
```typescript
{
  id: string,
  title: string,
  url: string | null,
  summary: string | null,
  published_at: string | null,
  detected_at: string,
  event_type: 'new' | 'updated' | 'closing' | 'info' | 'alert' | null
}
```

**PrefectureNewsItem extends NewsItem:**
```typescript
{
  region_prefecture: string,  // 都道府県コード
  tags: string[],
  is_client_area: boolean     // 顧客所在地かどうか
}
```

**Suggestion（凍結: object禁止）:**
```typescript
{
  agency_client_id: string,
  company_id: string,
  client_name: string,
  company_name: string,
  prefecture: string,
  subsidy_id: string,
  status: 'PROCEED' | 'CAUTION' | 'NO',
  score: number,  // 0-100
  match_reasons: string[],  // ⚠️ 必ずstring[]
  risk_flags: string[],     // ⚠️ 必ずstring[]
  subsidy_title: string,
  subsidy_deadline: string | null,
  subsidy_max_limit: number | null,
  deadline_days: number | null,
  rank: number
}
```

---

## 4. 新着判定ルール（凍結）

### 4-1. event_type の定義

| event_type | 条件 | 表示 |
|------------|------|------|
| `new` | subsidy_cacheに初めて登場 | 🆕 新規 |
| `updated` | 既存idの内容変更 | 🔄 更新 |
| `closing` | 締切7日以内 | ⚠️ 締切間近 |
| `info` | 一般的なお知らせ | ℹ️ |
| `alert` | 重要・緊急 | 🚨 |

### 4-2. 重複排除

`UNIQUE(source_type, source_key, url)` で同一ソース・同一URLの重複を排除

---

## 5. 顧客おすすめ（サジェスト）生成ルール（凍結）

### 5-1. 必須条件（顧客企業）

| 項目 | テーブル | カラム | 必須 |
|------|----------|--------|------|
| 都道府県 | companies | prefecture | ✅ |
| 業種 | companies | industry_major | ✅ |
| 従業員数 | companies | employee_count | ✅ |

### 5-2. スコアリング（v1: ルールベース）

| 条件 | スコア |
|------|--------|
| 地域一致（prefecture or 全国） | +30 |
| 業種一致 | +25 |
| 従業員レンジ一致 | +25 |
| 受付中 | +10 |
| 締切7日以内 | -20（CAUTION） |
| 受付終了 | NO |

### 5-3. 出力形式（凍結: object禁止）

```javascript
// ❌ NG: object
match_reasons: [{ reason: "地域一致" }]

// ✅ OK: string[]
match_reasons: ["地域一致", "業種一致"]
```

---

## 6. 品質チェックリスト（実装前）

### ダッシュボード

- [x] カテゴリ枠（platform/support_info/prefecture/ministry/other_public）が固定
- [x] 各枠の取得上限（limit）が固定
- [x] JST日付基準（今日/昨日）が固定

### DB

- [x] subsidy_feed_items のスキーマ確定
- [x] NEW/UPDATED 判定ロジック確定（event_type）
- [x] snapshot（日次集計）テーブル確定

### API

- [x] /api/agency/dashboard-v2 実装
- [x] レスポンス形式が凍結仕様通り
- [x] safeParseJSON で object→string 変換

### 推薦

- [x] 顧客必須（prefecture/industry_major/employee_count）で評価可能
- [x] reasons/risk は string[] に固定（object禁止）
- [x] "おすすめ根拠"が表示できる

### セキュリティ

- [ ] feed_items の title/summary は HTMLエスケープして表示
- [ ] agency_id の境界をサーバ側で保証（URLパラメータ信用しない）
- [ ] SQLはプレースホルダ利用

---

## 7. UI実装方針（凍結）

### 7-1. 画面レイアウト

```
┌────────────────────────────────────────────────────┐
│  ホジョラク 士業ダッシュボード                        │
├────────────────────────────────────────────────────┤
│ [KPI] 今日の検索: X  壁打ち: Y  ドラフト: Z          │
├────────────────────────────────────────────────────┤
│ [NEWS] プラットフォーム | 新着支援 | 都道府県 | 省庁   │
│ ┌──────────────────────────────────────────────┐  │
│ │ 📰 タイトル                     2026/01/23   │  │
│ │ 📰 タイトル                     2026/01/22   │  │
│ └──────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────┤
│ [顧客おすすめ]                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ 👤 顧客A | 🏢 ○○補助金 [推奨] 85点           │  │
│ │    理由: 地域一致、業種一致                    │  │
│ └──────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────┤
│ [未処理タスク]                                      │
│ 承認待ち: X件 | 期限間近: Y件 | ドラフト: Z件        │
└────────────────────────────────────────────────────┘
```

### 7-2. モバイル対応

- タブ切替でNEWSカテゴリを表示
- カードはタップ領域44px確保
- スワイプでタブ切替（検討）

---

## 8. 次フェーズ（v1.1以降）

| 項目 | 優先度 | 備考 |
|------|--------|------|
| 市区町村NEWS | 中 | データ源が複雑、v1はskip |
| LLMおすすめ理由 | 低 | v1はルールベースで十分 |
| プッシュ通知 | 低 | v1は画面表示のみ |
| 都道府県MAP | 低 | 見た目重視、v1はリスト優先 |

---

## 9. 堅牢化ガイドライン（実装済み）

### 9-1. 部分失敗対応

すべてのデータ取得は個別のtry-catchで囲み、部分失敗でも200レスポンスを返す:

```typescript
// 例: NEWSフィード取得
let platformNews: any = { results: [] };
try {
  platformNews = await db.prepare('...').all();
} catch (e) {
  console.error('[dashboard-v2] platformNews error:', e);
  // platformNews は空配列のまま → レスポンスに含める
}
```

### 9-2. カラム名マッピング

**access_links（正しいカラム名）:**
| API期待 | 実際のカラム |
|---------|-------------|
| short_code | short_code |
| type | type |
| expires_at | expires_at |
| label | label |
| ~~client_name~~ | JOIN agency_clients で取得 |
| ~~used_at~~ | 不使用（used_count で判定） |

**intake_submissions（正しいカラム名）:**
| API期待 | 実際のカラム |
|---------|-------------|
| submitted_at | created_at |
| ~~client_name~~ | JOIN agency_clients で取得 |

### 9-3. JSON表示バグ回避

`safeParseJSON()` で [object Object] 表示を防止:

```typescript
function safeParseJSON(str: string | null, fallback: any[] = []): any[] {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.reason || item.text || JSON.stringify(item);
      }
      return String(item);
    });
  } catch { return fallback; }
}
```

---

## 修正履歴

| 日付 | 内容 |
|------|------|
| 2026-01-23 | 初版作成（v1凍結仕様） |
| 2026-01-23 | SQL修正（access_links/intake_submissionsカラム整合性） |
| 2026-01-23 | 堅牢化（部分失敗対応、try-catch追加） |
| 2026-01-23 | API動作確認完了 |

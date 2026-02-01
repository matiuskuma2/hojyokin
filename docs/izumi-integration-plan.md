# izumi データ整合性評価・紐付け計画

## 1. 現状データサマリー

### 1.1 izumi 取得済みデータ

| データ種別 | ファイル数 | レコード数 | policy_id範囲 |
|-----------|-----------|-----------|---------------|
| **details (詳細)** | 90ファイル | 18,655件 | 28 ~ 116,453 |
| **support_urls** | 35ファイル | 約17,032件 | 56 ~ 116,453 |

### 1.2 データカラム構成

**izumi_detail_*.csv**:
```
policy_id, detail_url, title, issuer, area, publish_date, period, 
max_amount, difficulty, start_fee, success_fee, support_url, support_urls_all, error
```

**izumi_support_urls_*.csv**:
```
policy_id, primary_url, all_urls
```

### 1.3 既存DB設計（関連テーブル）

| テーブル | 用途 | 現在のソース |
|---------|------|-------------|
| `subsidy_cache` | 補助金検索・マッチング | jgrants API |
| `subsidy_lifecycle` | 補助金ステータス管理 | jgrants |
| `discovery_items` | ステージング（検証前） | - |
| `crawl_queue` | クロールジョブ管理 | - |
| `source_registry` | ソース管理 | 都道府県別 |

---

## 2. 整合性評価

### 2.1 izumiデータの特徴

| 項目 | 評価 | 詳細 |
|------|------|------|
| **一意キー** | ✅ | `policy_id` が一意（重複なし） |
| **タイトル充足率** | ✅ 100% | 全件にタイトルあり |
| **金額充足率** | ○ 約70% | `max_amount` が空の場合あり |
| **URL充足率** | ✅ 100% | `support_url` 必須入力 |
| **地域情報** | △ 低 | `area` は空が多い（URLから推定必要） |
| **期間情報** | △ 低 | `period`, `publish_date` は空が多い |

### 2.2 jGrants APIとの関係

```
┌─────────────────────────────────────────────────────────────┐
│  jGrants API（公式）                                         │
│  ├─ ID体系: 独自（例: 0012345）                             │
│  ├─ 網羅範囲: 国の補助金中心                                │
│  └─ 更新頻度: リアルタイム                                  │
└─────────────────────────────────────────────────────────────┘
              ↓ 一部重複（推定30-40%）
┌─────────────────────────────────────────────────────────────┐
│  izumi（情報の泉）                                           │
│  ├─ ID体系: policy_id（独自連番）                           │
│  ├─ 網羅範囲: 国 + 地方自治体の補助金                       │
│  └─ 更新頻度: 手動スクレイピング                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 重複判定の課題

| 判定方法 | 精度 | 課題 |
|---------|------|------|
| タイトル完全一致 | 低 | 表記揺れが多い |
| タイトル類似度 | 中 | 閾値設定が難しい |
| 金額 + 地域 + タイトル | 高 | 地域情報がizumiで不足 |
| URLドメイン | 中 | 同一補助金で複数URL |

---

## 3. 紐付け計画

### 3.1 新規テーブル設計案

#### `izumi_subsidies` テーブル（メインデータ）

```sql
CREATE TABLE IF NOT EXISTS izumi_subsidies (
  id TEXT PRIMARY KEY,                    -- 'izumi-{policy_id}'
  policy_id INTEGER NOT NULL UNIQUE,      -- 情報の泉の policy_id
  detail_url TEXT,                        -- https://j-izumi.com/policy/{id}/detail
  title TEXT NOT NULL,
  issuer TEXT,                            -- 実施機関
  area TEXT,                              -- 対象地域（テキスト）
  prefecture_code TEXT,                   -- 都道府県コード（URLから推定）
  publish_date TEXT,
  period TEXT,
  max_amount_text TEXT,                   -- 元の金額テキスト（30万円等）
  max_amount_value INTEGER,               -- パース後の数値（300000等）
  difficulty TEXT,                        -- ★☆☆☆☆ 形式
  difficulty_level INTEGER,               -- 1-5 の数値
  start_fee TEXT,
  success_fee TEXT,
  support_url TEXT,                       -- 主要URL
  support_urls_all TEXT,                  -- 全URL（|区切り）
  
  -- 紐付け情報
  jgrants_id TEXT,                        -- jGrantsとの紐付け（NULL=未紐付け）
  subsidy_cache_id TEXT,                  -- subsidy_cache との紐付け
  match_score REAL,                       -- 類似度スコア（0-1）
  match_method TEXT,                      -- 'exact_title', 'fuzzy', 'manual' 等
  
  -- メタ情報
  source TEXT DEFAULT 'izumi',
  imported_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  crawl_status TEXT DEFAULT 'pending',    -- 'pending', 'success', 'failed'
  last_crawled_at TEXT,
  error_message TEXT,
  
  -- 検索・壁打ち対応状況
  detail_ready INTEGER DEFAULT 0,         -- 詳細情報の充足フラグ
  wall_chat_ready INTEGER DEFAULT 0,      -- 壁打ち対応フラグ
  wall_chat_missing TEXT                  -- 不足項目（JSON配列）
);

CREATE INDEX idx_izumi_policy_id ON izumi_subsidies(policy_id);
CREATE INDEX idx_izumi_prefecture ON izumi_subsidies(prefecture_code);
CREATE INDEX idx_izumi_jgrants ON izumi_subsidies(jgrants_id);
CREATE INDEX idx_izumi_crawl_status ON izumi_subsidies(crawl_status);
```

#### `izumi_urls` テーブル（URL管理）

```sql
CREATE TABLE IF NOT EXISTS izumi_urls (
  id TEXT PRIMARY KEY,                    -- UUID
  policy_id INTEGER NOT NULL,             -- FK to izumi_subsidies
  url TEXT NOT NULL,
  url_type TEXT,                          -- 'html', 'pdf', 'unknown'
  is_primary INTEGER DEFAULT 0,           -- 主要URLフラグ
  domain TEXT,                            -- URLのドメイン
  
  -- クロール状態
  crawl_status TEXT DEFAULT 'pending',
  last_crawled_at TEXT,
  content_hash TEXT,                      -- 変更検知用
  
  -- 抽出結果
  extracted_json TEXT,                    -- Firecrawl/LLM抽出結果
  extraction_status TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (policy_id) REFERENCES izumi_subsidies(policy_id)
);

CREATE INDEX idx_izumi_urls_policy ON izumi_urls(policy_id);
CREATE INDEX idx_izumi_urls_domain ON izumi_urls(domain);
CREATE INDEX idx_izumi_urls_status ON izumi_urls(crawl_status);
```

#### `izumi_jgrants_mapping` テーブル（紐付け管理）

```sql
CREATE TABLE IF NOT EXISTS izumi_jgrants_mapping (
  id TEXT PRIMARY KEY,
  policy_id INTEGER NOT NULL,             -- izumi側
  jgrants_id TEXT NOT NULL,               -- jGrants側
  
  -- マッチング情報
  match_type TEXT NOT NULL,               -- 'auto', 'manual', 'rejected'
  match_score REAL,                       -- 自動マッチの信頼度
  match_fields TEXT,                      -- マッチに使った項目（JSON）
  
  -- 検証
  verified INTEGER DEFAULT 0,             -- 人間確認済み
  verified_by TEXT,
  verified_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(policy_id, jgrants_id)
);
```

### 3.2 データフロー

```
┌─────────────────────────────────────────────────────────────┐
│  CSVインポート                                               │
│  izumi_detail_*.csv → izumi_subsidies テーブル             │
│  izumi_support_urls_*.csv → izumi_urls テーブル            │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  前処理・エンリッチメント                                    │
│  ├─ max_amount パース（30万円 → 300000）                   │
│  ├─ difficulty パース（★★☆☆☆ → 2）                        │
│  ├─ prefecture_code 推定（URLドメインから）                │
│  └─ URL種別判定（html/pdf）                                │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  jGrants紐付け処理                                           │
│  ├─ タイトル類似度マッチング                                │
│  ├─ 金額 + 地域によるフィルタ                               │
│  └─ マッチ結果を izumi_jgrants_mapping に記録              │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  補助金検索・壁打ち連携                                      │
│  ├─ 紐付けあり: jGrants側のデータを優先                     │
│  ├─ 紐付けなし: izumi_subsidies から直接検索               │
│  └─ wall_chat_ready フラグで壁打ち対象判定                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 補助金検索・壁打ちとの紐付け

### 4.1 現行の検索ロジック（screening.ts）

```typescript
// 現在は subsidy_cache（jGrants）のみ対象
performScreening(company, subsidies) → MatchResult[]
```

### 4.2 拡張案

```typescript
// izumi_subsidies を含めた検索
interface SubsidySource {
  source: 'jgrants' | 'izumi' | 'izumi-unique';
  id: string;
  // ... 共通フィールド
}

// 検索結果にソース情報を付加
searchSubsidies(params) → {
  subsidies: SubsidySource[],
  meta: {
    jgrants_count: number,
    izumi_count: number,
    izumi_unique_count: number  // jGrants未掲載
  }
}
```

### 4.3 壁打ち対応条件

| 項目 | 必須/任意 | izumiの充足状況 |
|------|---------|----------------|
| タイトル | 必須 | ✅ 100% |
| 補助上限額 | 必須 | ○ 約70% |
| 対象地域 | 必須 | △ URLから推定必要 |
| 申請期間 | 推奨 | △ 低 |
| 対象業種 | 推奨 | ❌ なし |
| 対象従業員数 | 推奨 | ❌ なし |
| 申請要件詳細 | 推奨 | ❌ support_urlから取得必要 |

### 4.4 壁打ち対応のためのデータ拡充

```
優先度: 高 ────────────────────────────────────────────> 低

[地域推定]     [金額パース]    [URL本文取得]    [業種推定]
 URLドメイン     正規表現        Firecrawl         LLM
 から推定       で数値化        でHTML取得        で分類
```

---

## 5. 更新計画

### 5.1 policy_id の性質

- **単調増加**: 新規補助金追加時にインクリメント
- **不変性**: 一度付与されたIDは変わらない
- **欠番あり**: 削除された補助金のIDは再利用されない

### 5.2 更新フロー

```
┌─────────────────────────────────────────────────────────────┐
│  1. 差分検知（週次）                                         │
│  └─ 最新 policy_id をチェック → 新規追加分を特定           │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 新規データ取得（Playwright）                             │
│  └─ 新規 policy_id の詳細を取得                            │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. URL本文取得（Firecrawl）                                 │
│  └─ support_url のHTML/PDFを取得・解析                     │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. jGrants紐付け更新                                        │
│  └─ 新規データとjGrantsの類似度チェック                     │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 期限切れチェック（月次）                                 │
│  └─ 過去の補助金が更新/終了していないかチェック            │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 項目別更新戦略

| 項目 | 更新頻度 | 方法 |
|------|---------|------|
| 新規policy_id | 週次 | 最大ID監視 |
| タイトル変更 | 月次 | ハッシュ比較 |
| 金額変更 | 月次 | 数値比較 |
| URL変更/リンク切れ | 週次 | HTTPステータスチェック |
| 申請期間終了 | 毎日 | 日付比較 |

---

## 6. PDF対応方針

### 6.1 PDF URLの分類

| 種別 | 割合（推定） | 対応方法 |
|------|------------|---------|
| テキストPDF | 約60% | Firecrawl → テキスト抽出 |
| 画像PDF（スキャン） | 約30% | Vision API → OCR |
| 暗号化PDF | 約5% | 親HTMLから情報取得 |
| 大容量PDF（>10MB） | 約5% | 部分取得 or スキップ |

### 6.2 段階的アプローチ

```
Phase 1: HTMLページ優先
└─ support_urls_all の中でHTMLページがあれば優先

Phase 2: テキストPDF対応
└─ Firecrawl で抽出可能なPDFを処理

Phase 3: 画像PDF対応
└─ Vision API で OCR（コスト高のため選択的に）

Phase 4: 例外処理
└─ 暗号化/大容量は手動対応 or スキップ
```

### 6.3 クローリング優先度

```
高優先: HTMLページ（低コスト、構造化しやすい）
      ↓
中優先: テキストPDF（Firecrawlで対応可能）
      ↓
低優先: 画像PDF（Vision APIコスト高）
      ↓
スキップ: 暗号化PDF、10MB超のPDF
```

---

## 7. 実装ロードマップ

### Phase 1: データインポート（1週間）
- [ ] `izumi_subsidies` テーブル作成
- [ ] CSVインポートスクリプト作成
- [ ] 金額・難易度パース処理
- [ ] 18,655件のインポート完了

### Phase 2: URL管理・クロール準備（1週間）
- [ ] `izumi_urls` テーブル作成
- [ ] URL種別判定（html/pdf）
- [ ] ドメイン抽出・都道府県推定
- [ ] クロールキュー登録

### Phase 3: jGrants紐付け（2週間）
- [ ] `izumi_jgrants_mapping` テーブル作成
- [ ] タイトル類似度計算（Levenshtein距離 or TF-IDF）
- [ ] 自動マッチング実行
- [ ] マッチ結果のレビューUI

### Phase 4: 検索API統合（1週間）
- [ ] `/api/subsidies/search` 拡張
- [ ] ソースフィルタ追加（jgrants/izumi/all）
- [ ] izumi_unique（jGrants未掲載）の特定

### Phase 5: 壁打ち連携（2週間）
- [ ] `wall_chat_ready` 判定ロジック
- [ ] 不足データの抽出処理
- [ ] 壁打ちUIでのizumiデータ表示

### Phase 6: 定期更新（継続）
- [ ] 新規policy_id検知
- [ ] リンク切れ監視
- [ ] 期限切れ更新

---

## 8. 次のアクション

### 即時対応（今週）
1. **テーブル作成**: `izumi_subsidies` を D1 に作成
2. **インポートスクリプト**: 18,655件を一括インポート
3. **金額パース**: `max_amount_text` → `max_amount_value` 変換

### 短期（2週間以内）
1. **jGrants紐付け**: 類似度マッチングの試行
2. **URL分析**: html/pdf の比率、ドメイン分布

### 中期（1ヶ月以内）
1. **検索API統合**: izumiデータを検索対象に追加
2. **壁打ち対応**: wall_chat_ready の判定実装

---

## 付録: 金額パース仕様

```typescript
function parseMaxAmount(text: string): number | null {
  if (!text) return null;
  
  // 「30万円」→ 300000
  // 「10億円」→ 1000000000
  // 「3万円/1人」→ 30000
  // 「1/2」→ null（補助率）
  
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*億円/, multiplier: 100000000 },
    { regex: /(\d+(?:\.\d+)?)\s*万円/, multiplier: 10000 },
    { regex: /(\d+(?:,\d{3})*)\s*円/, multiplier: 1 },
  ];
  
  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      return Math.round(value * multiplier);
    }
  }
  
  return null;
}
```

---

最終更新: 2026-02-01

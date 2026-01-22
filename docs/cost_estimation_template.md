# コスト概算テンプレート

## 概要
補助金データ収集パイプラインの運用コストを概算するためのテンプレート。

---

## コスト構成要素

### 1. Firecrawl（ページクロール）

| プラン | 料金 | ページ数/月 | 1ページあたり |
|--------|------|------------|---------------|
| Free | $0 | 500 | $0 |
| Hobby | $19/月 | 3,000 | $0.0063 |
| Standard | $99/月 | 25,000 | $0.0040 |
| Growth | $399/月 | 100,000 | $0.0040 |

**週1全量クロール想定**:
- 65ソース × 平均10ページ/ソース = 650ページ/週
- 650 × 4 = 2,600ページ/月
- → Hobby プラン ($19/月) で収まる

### 2. OpenAI API（LLM処理）

| 用途 | モデル | 入力トークン | 出力トークン | 単価（入力/出力） |
|------|--------|-------------|-------------|-------------------|
| 構造化抽出 | gpt-4o-mini | 2,000 | 500 | $0.15/$0.60 per 1M |
| 壁打ちチャット | gpt-4o | 1,000 | 500 | $5.00/$15.00 per 1M |
| ドラフト生成 | gpt-4o | 3,000 | 2,000 | $5.00/$15.00 per 1M |

**週1全量クロール想定（構造化抽出のみ）**:
- 650ページ × 2,000入力トークン = 1.3Mトークン
- 650ページ × 500出力トークン = 0.325Mトークン
- コスト = 1.3 × $0.15 + 0.325 × $0.60 = $0.195 + $0.195 = $0.39/週
- → $1.56/月（構造化抽出のみ）

### 3. AWS Textract（OCR）※Phase2以降

| 処理 | 単価 |
|------|------|
| DetectDocumentText | $1.50 per 1,000ページ |
| AnalyzeDocument | $15.00 per 1,000ページ |

**週1 OCR想定（スキャンPDFが全体の20%と仮定）**:
- 650ページ × 20% = 130ページ/週
- 130 × 4 = 520ページ/月
- コスト = 520 × $1.50 / 1,000 = $0.78/月

### 4. Cloudflare D1 / Workers

| サービス | Free Tier | 超過時 |
|----------|-----------|--------|
| D1 読み取り | 5M行/月 | $0.001 per 1M行 |
| D1 書き込み | 100K行/月 | $1.00 per 1M行 |
| Workers リクエスト | 100K/日 | $0.50 per 1M |

**想定使用量**:
- D1読み取り: 約50K行/日 × 30 = 1.5M行/月 → Free内
- D1書き込み: 約1K行/日 × 30 = 30K行/月 → Free内
- Workers: 約5K リクエスト/日 → Free内

---

## 月間コスト概算表

### Phase 0-1（テキストPDF + 基本クロール）

| 項目 | 数量 | 単価 | 月額 |
|------|------|------|------|
| Firecrawl (Hobby) | 2,600ページ | $19/月 | $19.00 |
| OpenAI (gpt-4o-mini) | 構造化抽出 | - | $1.56 |
| Cloudflare D1/Workers | Free Tier内 | - | $0.00 |
| **合計** | | | **$20.56** |

### Phase 2（+ OCR処理）

| 項目 | 数量 | 単価 | 月額 |
|------|------|------|------|
| Firecrawl (Hobby) | 2,600ページ | $19/月 | $19.00 |
| OpenAI (gpt-4o-mini) | 構造化抽出 | - | $1.56 |
| AWS Textract | 520ページ | $1.50/1K | $0.78 |
| Cloudflare D1/Workers | Free Tier内 | - | $0.00 |
| **合計** | | | **$21.34** |

### ユーザー利用込み（壁打ち・ドラフト）

| 項目 | 数量（想定） | 単価 | 月額 |
|------|--------------|------|------|
| Firecrawl (Hobby) | 2,600ページ | $19/月 | $19.00 |
| OpenAI (gpt-4o-mini) | 構造化抽出 | - | $1.56 |
| OpenAI (gpt-4o) 壁打ち | 100セッション × 1,500トークン | - | $0.90 |
| OpenAI (gpt-4o) ドラフト | 50件 × 5,000トークン | - | $3.75 |
| AWS Textract | 520ページ | $1.50/1K | $0.78 |
| Cloudflare D1/Workers | Free Tier内 | - | $0.00 |
| **合計** | | | **$25.99** |

---

## コスト最適化のポイント

### 1. 差分クロールの導入
- `last_hash` を比較して変更がないページはスキップ
- 効果: Firecrawlコスト 30-50% 削減

### 2. 優先度に基づく更新頻度調整
- priority=1: daily
- priority=2: 2-3日ごと
- priority=3-4: weekly
- 効果: Firecrawlコスト 20-30% 削減

### 3. キャッシュの活用
- search_cache: 同じ検索条件の結果を24時間キャッシュ
- subsidy_cache: 補助金詳細を7日間キャッシュ
- 効果: OpenAI APIコスト 40-60% 削減

### 4. OCR対象の絞り込み
- テキスト埋め込みPDFは pdf-parse で無料抽出
- スキャンPDFのみ Textract を使用
- 効果: OCRコスト 60-80% 削減

---

## 無駄の指標と対策

### 検知方法（/api/admin/coverage）
1. **ドメイン別エラー率Top20**: 失敗が多いドメインを特定
2. **重複クロール検知**: 同じURLを何度も叩いていないか
3. **キュー滞留**: Consumerが回っていない兆候

### 対策
| 問題 | 対策 |
|------|------|
| 高エラー率ドメイン | domain_policy.enabled=0 で一時停止、手動確認 |
| 重複クロール | url_hash で重複検知、スキップロジック追加 |
| キュー滞留 | Consumer Worker の実行間隔を短縮 |
| blocked | robots.txt 確認、User-Agent 変更、手動取得に切替 |

---

## コスト監視方法

### 管理画面
- `/admin/costs` (super_admin限定)
- OpenAI: モデル別・機能別の使用量と推定コスト
- Firecrawl: ドメイン別のページ数と推定コスト

### アラート設定
- `alert_rules` テーブルに設定済み:
  - `cost_daily_ratio > 3.0`: 前日比3倍超でアラート
  - `queue_pending_count > 1000`: キュー滞留アラート

### 日次KPIスナップショット
- `kpi_daily_snapshots` テーブルに自動記録
- `total_cost_usd`, `openai_cost_usd`, `firecrawl_cost_usd` を追跡

---

## 計算フォーミュラ

```javascript
// Firecrawl コスト（Hobbyプラン）
const firecrawlCost = pages > 3000 ? 19 + (pages - 3000) * 0.01 : 19;

// OpenAI コスト（gpt-4o-mini）
const openaiCostMini = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

// OpenAI コスト（gpt-4o）
const openaiCost4o = (inputTokens / 1_000_000) * 5.00 + (outputTokens / 1_000_000) * 15.00;

// AWS Textract コスト
const textractCost = ocrPages * 1.50 / 1000;

// 月間合計
const totalMonthlyCost = firecrawlCost + openaiCostMini + openaiCost4o + textractCost;
```

---

## 参考リンク
- [Firecrawl Pricing](https://firecrawl.dev/pricing)
- [OpenAI Pricing](https://openai.com/pricing)
- [AWS Textract Pricing](https://aws.amazon.com/textract/pricing/)
- [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

# 情報の泉 補助金URLリスト

## 概要
「情報の泉」から取得した補助金・助成金のURLリストです。
将来的にこれらのURLからデータを抽出し、`subsidy_cache`に格納するためのソースデータです。

## ファイル一覧

| ファイル名 | レコード数 | policy_id範囲 | サイズ |
|-----------|-----------|---------------|--------|
| izumi_support_urls_500.csv | 499件 | 56 ~ 12,459 | 127KB |
| izumi_support_urls_1000.csv | 499件 | 12,460 ~ 19,860 | 110KB |
| izumi_support_urls_2000.csv | 499件 | 19,861 ~ 28,599 | 108KB |
| izumi_support_urls_2500.csv | 499件 | 28,600 ~ 36,471 | 115KB |
| izumi_support_urls_3000.csv | 499件 | 36,472 ~ 41,790 | 94KB |
| izumi_support_urls_3500.csv | 499件 | 41,791 ~ 46,600 | 105KB |
| izumi_support_urls_4000.csv | 499件 | 46,601 ~ 50,347 | 100KB |
| izumi_support_urls_4500.csv | 499件 | 50,348 ~ 53,857 | 105KB |
| izumi_support_urls_5000.csv | 499件 | 53,858 ~ 56,188 | 97KB |
| izumi_support_urls_5500.csv | 499件 | 56,189 ~ 58,919 | 105KB |
| izumi_support_urls_6000.csv | 499件 | 58,920 ~ 61,710 | 100KB |
| izumi_support_urls_6500.csv | 499件 | 61,711 ~ 65,305 | 95KB |
| izumi_support_urls_7000.csv | 499件 | 65,306 ~ 69,338 | 86KB |
| izumi_support_urls_7500.csv | 499件 | 69,339 ~ 73,491 | 85KB |
| izumi_support_urls_8000.csv | 499件 | 73,492 ~ 77,132 | 89KB |
| izumi_support_urls_8500.csv | 499件 | 77,133 ~ 80,170 | 88KB |
| izumi_support_urls_9000.csv | 499件 | 80,171 ~ 82,344 | 93KB |
| izumi_support_urls_9500.csv | 499件 | 82,345 ~ 84,186 | 87KB |
| izumi_support_urls_10000.csv | 499件 | 84,187 ~ 85,487 | 86KB |
| izumi_support_urls_10500.csv | 499件 | 85,488 ~ 86,526 | 91KB |
| izumi_support_urls_11000.csv | 499件 | 86,527 ~ 87,824 | 93KB |
| izumi_support_urls_11500.csv | 499件 | 87,825 ~ 89,941 | 90KB |
| izumi_support_urls_12000.csv | 499件 | 89,942 ~ 92,084 | 97KB |
| izumi_support_urls_12500.csv | 499件 | 92,085 ~ 93,478 | 96KB |
| izumi_support_urls_13000.csv | 499件 | 93,479 ~ 95,325 | 101KB |
| izumi_support_urls_13500.csv | 499件 | 95,326 ~ 97,312 | 114KB |
| izumi_support_urls_14000.csv | 499件 | 97,313 ~ 99,427 | 111KB |
| izumi_support_urls_14500.csv | 499件 | 99,428 ~ 102,574 | 110KB |

**合計: 約13,972件の補助金URL**

## データ形式

```csv
policy_id,primary_url,all_urls
"56","https://example.com/doc.pdf","https://example.com/page.html | https://example.com/doc.pdf"
```

| カラム | 説明 |
|--------|------|
| `policy_id` | 情報の泉での補助金ID |
| `primary_url` | 主要な情報源URL（PDFまたはHTML） |
| `all_urls` | 関連する全てのURL（`|`区切り） |

## URLの種類

- **PDF**: 補助金の詳細資料、申請書類など
- **HTML**: 自治体の補助金案内ページ

## 推奨データ抽出アーキテクチャ

### フェーズ1: jGrants API（優先）
現在実装済み。国の補助金データをAPIで取得。

### フェーズ2: 情報の泉（Playwright + Firecrawl）

```
┌─────────────────────────────────────────────────────────────┐
│  別サーバー (AWS Lambda / EC2 / 専用サーバー)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Playwright: 情報の泉にログイン                          │
│     ├─ /search-subsidy?per_page=100 GET                    │
│     ├─ meta[name="csrf-token"] を取得                       │
│     └─ Cookie維持                                           │
│                                                             │
│  2. Playwright: POST /policy/detail ループ                  │
│     ├─ form-urlencoded形式                                  │
│     ├─ JSONの html をパース                                 │
│     └─ 「支援URL」を抽出                                    │
│                                                             │
│  3. Firecrawl: 支援URLの本文取得                            │
│     ├─ 自治体サイトのHTML取得                               │
│     ├─ PDF URLの場合は Vision API へ                       │
│     └─ 補助金詳細情報を抽出                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Workers API                                     │
├─────────────────────────────────────────────────────────────┤
│  POST /api/admin-ops/izumi/ingest                          │
│  └─ subsidy_cache に格納                                    │
└─────────────────────────────────────────────────────────────┘
```

### なぜ Playwright + Firecrawl の組み合わせか

| 処理 | ツール | 理由 |
|------|--------|------|
| ログイン・セッション維持 | **Playwright** | Cookie管理が得意、フォーム操作が安定 |
| CSRF対策ページ取得 | **Playwright** | 動的トークン取得が必要 |
| POST APIループ | **Playwright** | セッション維持が必要 |
| 自治体サイト本文取得 | **Firecrawl** | 静的HTML取得が高速 |
| PDF解析 | **Vision API** | 構造化データ抽出 |

### 注意点

- Firecrawlは「ログインフォーム→セッション維持→POST連打」は苦手
- Playwrightは得意（セッション・Cookie維持が簡単）
- 役割分担が重要

## 活用方法

1. **このCSVの支援URLを直接Firecrawlで取得** → 情報の泉へのログイン不要
2. **source_registry登録**: 新しいsourceとして`izumi`を追加
3. **subsidy_cache格納**: 抽出したデータを正規化して格納

## 注意事項

- URLは時間経過で無効になる可能性があります
- PDFファイルは更新される場合があります
- 自治体サイトのリダイレクトに注意

## 更新履歴

- 2026-01-29: 追加インポート（13500, 14000, 14500 → 約14,000件に）
- 2026-01-29: 追加インポート（12000, 12500, 13000 → 約12,500件に）
- 2026-01-29: 追加インポート（10500, 11000, 11500 → 約11,000件に）
- 2026-01-29: 追加インポート（9000, 9500, 10000 → 約9,500件に）
- 2026-01-29: 追加インポート（8000, 8500 → 約8,000件に）
- 2026-01-29: 追加インポート（6500, 7000, 7500 → 約7,000件に）
- 2026-01-29: 追加インポート（5000, 5500, 6000 → 約5,500件に）
- 2026-01-29: 追加インポート（4000, 4500 → 約4,000件に）
- 2026-01-29: 初回インポート（約3,000件）

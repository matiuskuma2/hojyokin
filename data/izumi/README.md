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

**合計: 約2,994件の補助金URL**

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

## 活用方法

1. **データ抽出パイプライン**: `primary_url`からFirecrawl/Vision APIで情報抽出
2. **source_registry登録**: 新しいsourceとして`izumi`を追加
3. **subsidy_cache格納**: 抽出したデータを正規化して格納

## 注意事項

- URLは時間経過で無効になる可能性があります
- PDFファイルは更新される場合があります
- 自治体サイトのリダイレクトに注意

## 更新履歴

- 2026-01-29: 初回インポート（約3,000件）

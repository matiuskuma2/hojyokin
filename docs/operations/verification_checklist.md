# 取得品質チェック表

## 最低必須項目（must-have）

| # | 項目 | チェック方法 | 合格基準 |
|---|------|------------|---------|
| 1 | 募集期間（start/end） | subsidy_cache.acceptance_start_datetime / acceptance_end_datetime | 両方NULL以外で合格 |
| 2 | 受付方式 | subsidy_cache.request_reception_display_flag | 値存在で合格 |
| 3 | 補助率 | subsidy_cache.subsidy_rate | 値存在で合格（"1/2", "2/3"等） |
| 4 | 上限額 | subsidy_cache.subsidy_max_limit | 数値存在で合格 |
| 5 | 対象地域 | subsidy_cache.target_area_search | 値存在で合格 |
| 6 | 対象業種 | subsidy_cache.target_industry | 値存在で合格 |
| 7 | 申請方法 | detail_json内に記載 | テキスト存在で合格 |

### 合格ライン
- 7項目中 **5項目以上** で「最低限使える」
- 7項目中 **3項目未満** で「要手動補完」

---

## 実務必須項目（should-have）

| # | 項目 | データソース | 取得方法 |
|---|------|------------|---------|
| 1 | 必要書類リスト | PDF（公募要領） | 構造化抽出 |
| 2 | 審査観点・加点要素 | PDF（公募要領/審査基準） | 構造化抽出 |
| 3 | 注意事項・禁止事項 | PDF（公募要領） | 構造化抽出 |
| 4 | FAQ/Q&A | HTML（FAQ ページ） | クロール |
| 5 | 記入例 | PDF（記入例） | PDF抽出 |
| 6 | 申請様式 | PDF/Word | リンク収集 |

### 合格ライン
- 6項目中 **4項目以上** で「申請書作成に使える」
- 6項目中 **2項目未満** で「壁打ちのみ」

---

## 例外処理フラグ

| フラグ名 | 説明 | 対処 |
|---------|------|------|
| `login_required` | ログイン必須でアクセス不可 | 手動フラグ化、月次確認 |
| `phone_required` | 電話問い合わせ必須 | 手動フラグ化、月次確認 |
| `pdf_scan` | スキャンPDF（OCR必要） | Phase 2でOCR適用 |
| `js_required` | JavaScript必須でFirecrawl不可 | playwright検討 |
| `robots_blocked` | robots.txtでブロック | domain_policyに記録 |
| `403_forbidden` | アクセス拒否 | IP制限の可能性、手動確認 |

---

## 網羅性チェック（L1/L2/L3）

### L1: 入口網羅性チェック
```sql
-- 47都道府県が登録されているか
SELECT 
  COUNT(DISTINCT geo_id) as registered_prefectures,
  47 - COUNT(DISTINCT geo_id) as missing_prefectures
FROM source_registry 
WHERE scope = 'prefecture' AND geo_id IS NOT NULL;
```

**期待結果**: registered_prefectures = 47, missing_prefectures = 0

### L2: 実稼働網羅性チェック
```sql
-- 直近7日でクロールが回った都道府県
SELECT 
  sr.geo_id,
  COUNT(cq.queue_id) as crawl_count,
  SUM(CASE WHEN cq.status = 'done' THEN 1 ELSE 0 END) as done_count,
  MAX(cq.finished_at) as last_crawl
FROM source_registry sr
LEFT JOIN crawl_queue cq ON sr.registry_id = cq.source_registry_id
WHERE sr.scope = 'prefecture'
  AND cq.created_at >= datetime('now', '-7 days')
GROUP BY sr.geo_id
HAVING crawl_count > 0
ORDER BY last_crawl DESC;
```

**期待結果**: 40件以上の都道府県がdone/failedに到達

### L3: 制度網羅性チェック
```sql
-- 地域別の補助金データ状況
SELECT 
  target_area,
  COUNT(*) as total,
  SUM(CASE WHEN acceptance_end_datetime > datetime('now') THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN updated_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as updated_week
FROM subsidy_cache
GROUP BY target_area
ORDER BY total DESC;
```

**期待結果**: 主要地域で active > 0、updated_week > 0

---

## 週次レポートテンプレート

```
## 週次クロールレポート（YYYY-MM-DD）

### サマリー
- 処理件数: done=XX, failed=XX, queued=XX
- エラー率: XX%
- コスト: $XX.XX

### L1: 入口網羅性
- 登録都道府県: XX/47 (XX%)
- 有効化: XX/47 (XX%)

### L2: 実稼働網羅性
- 直近7日でクロール実行: XX/47
- stale地域数: XX
- stale地域: XX, XX, XX

### L3: 制度網羅性
- 総補助金数: XX
- アクティブ: XX
- 週次更新: XX

### 問題点・対処
1. [ドメイン名] - [問題] - [対処]
2. ...

### 次週アクション
1. ...
```

---

## API レスポンス例（/api/admin/coverage）

```json
{
  "success": true,
  "data": {
    "queue_health": {
      "by_status": { "done": 11, "failed": 4, "queued": 0 },
      "oldest_queued": null,
      "last_24h": { "total": 15, "done": 11, "failed": 4 },
      "is_healthy": true,
      "warning": null
    },
    "domain_errors_top": [
      { "domain_key": "example.go.jp", "total": 10, "failed": 5, "failed_pct": 50.0 }
    ],
    "duplicate_crawls": [],
    "score": {
      "l1_score": 100,
      "l2_score": 85,
      "l3_score": 70,
      "total": 85
    },
    "l1_entry_coverage": {
      "total_prefectures": 47,
      "registered_prefectures": 47,
      "missing_prefectures": [],
      "coverage_rate": 100
    },
    "l2_crawl_coverage": {
      "stale_regions": [...],
      "stale_count": 5
    },
    "l3_data_coverage": {
      "summary": {
        "total": 500,
        "active": 200,
        "new_week": 10,
        "updated_week": 50
      }
    }
  }
}
```

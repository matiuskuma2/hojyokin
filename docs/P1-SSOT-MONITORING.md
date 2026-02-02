# P1: SSOT検索 24時間監視プレイブック

## 概要

SEARCH_BACKEND=dual モードでの24時間検証。事故ゼロを守るため、数値固定を廃止し原因分類で合否を判定。

## 環境変数設定

```bash
# Cloudflare Pages → Settings → Environment variables
SEARCH_BACKEND=dual
```

## 合格基準（事故ゼロ仕様）

### A. 必須（1つでもNGなら即ロールバック検討）

| 項目 | 条件 | 確認方法 |
|------|------|----------|
| `SSOT_SEARCH_ERROR` | = 0件 | ログ監視（フォールバック発動回数） |
| `missing_in_ssot` | = 0件 | `/api/admin-ops/ssot-diagnosis` |

### B. 許容（ただし説明可能であること）

| 項目 | 条件 | 確認方法 |
|------|------|----------|
| `cache > ssot` の差分 | 全て「募集開始前」で説明可能 | `/api/admin-ops/ssot-diagnosis` の `diff_classification.other = 0` |

### C. order_diff

- tie-breaker導入済みで基本的に激減
- order_diff が多い場合は sort/order の指定揺れを疑う（仕様差の可能性が高い）
- NG判定ではなく、仕様差・整合性の確認指標として扱う

## 監視ログ

### [DUAL_SEARCH_DIFF] ログ

```json
{
  "timestamp": "2026-02-01T06:30:00.000Z",
  "params_hash": "abc123",
  "ssot_count": 173,
  "cache_count": 175,
  "ssot_ids_top10": ["id1", "id2", ...],
  "cache_ids_top10": ["id1", "id2", ...],
  "diff_type": ["missing_in_ssot"],
  "missing_in_ssot": ["idX"],
  "missing_in_cache": []
}
```

### [SSOT_SEARCH_ERROR] ログ

```json
{
  "timestamp": "2026-02-01T06:30:00.000Z",
  "error_message": "D1 connection error",
  "fallback_used": true,
  "request_params": {
    "keyword": null,
    "limit": 20,
    "offset": 0,
    "target_area_search": null
  }
}
```

## 診断API

### GET /api/admin-ops/ssot-diagnosis

super_admin限定。差分を自動分類してJSONで返す。

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://hojyokin.pages.dev/api/admin-ops/ssot-diagnosis
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "counts": {
      "ssot_accepting_count": 173,
      "cache_accepting_count": 175,
      "diff": 2
    },
    "diff_classification": {
      "pre_start": 2,    // 許容（募集開始前）
      "other": 0,        // NG（要調査）
      "total": 2
    },
    "diff_items_top10": [...],
    "integrity": {
      "canonical_total": 2894,
      "has_latest_cache_id": 2894,
      "has_latest_snapshot_id": 2894
    },
    "pass_status": {
      "missing_in_ssot_zero": true,
      "diff_explained": true,
      "integrity_ok": true
    },
    "overall_pass": true,
    "recommendation": "PASS: SEARCH_BACKEND=ssot に切替可能"
  }
}
```

## 24時間後の報告テンプレート

```markdown
## P1 SSOT検証レポート（24時間後）

### 1) /api/health
- search_backend: dual
- ssot_accepting_count: __
- cache_accepting_count: __

### 2) SSOT_SEARCH_ERROR
- 件数: __（0必須）

### 3) DUAL_SEARCH_DIFF
- 総件数: __
- missing_in_ssot: __（0必須）
- missing_in_cache: __（任意）
- order_diff: __（傾向を見るだけ）

### 4) 差分（cache > ssot）の理由分類
- 募集開始前: __件（許容）
- それ以外: __件（0必須）

### 5) 判定
- [ ] PASS → SEARCH_BACKEND=ssot に切替
- [ ] FAIL → 要調査
```

## 「募集開始前」確認SQL（ワンライナー）

```sql
SELECT
  sc.id,
  sc.title,
  sc.acceptance_start_datetime,
  sc.acceptance_end_datetime
FROM subsidy_cache sc
LEFT JOIN subsidy_source_link l
  ON l.source_type='jgrants' AND l.source_id=sc.id
LEFT JOIN subsidy_canonical c
  ON c.id=l.canonical_id
LEFT JOIN subsidy_snapshot s
  ON s.id=c.latest_snapshot_id
WHERE sc.source='jgrants'
  AND sc.request_reception_display_flag=1
  AND sc.acceptance_end_datetime > datetime('now')
  AND (s.is_accepting IS NULL OR s.is_accepting != 1)
ORDER BY sc.acceptance_start_datetime ASC
LIMIT 50;
```

## 判定フロー

```
24時間経過
    │
    ▼
SSOT_SEARCH_ERROR = 0? ──No──► 即ロールバック検討
    │ Yes
    ▼
missing_in_ssot = 0? ──No──► 即ロールバック検討
    │ Yes
    ▼
diff_classification.other = 0? ──No──► 要調査（バグ or 仕様差）
    │ Yes
    ▼
✅ PASS: SEARCH_BACKEND=ssot に切替
```

## ロールバック手順

```bash
# Cloudflare Pages → Settings → Environment variables
SEARCH_BACKEND=cache

# デプロイをトリガー（または Retry deployment）
```

## 次のステップ（P1完了後）

1. **P2**: 壁打ちを snapshot/canonical 前提で整理
2. **P3**: izumi × jGrants 横断検索の UI 設計

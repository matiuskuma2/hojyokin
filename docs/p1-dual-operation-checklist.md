# P1: SEARCH_BACKEND=dual 24時間検証 運用チェックリスト

## 目的
- SSOT検索（canonical→latest_snapshot）の本番検証
- 旧cache検索との差分を検出・分析
- 事故ゼロで `ssot` 固定へ移行

---

## 1. Cloudflare Pages 設定手順

### 1-1. 環境変数を設定
1. Cloudflare Dashboard にアクセス
2. Pages → `hojyokin` → Settings → Environment variables
3. 以下を追加/更新:
   ```
   Variable name: SEARCH_BACKEND
   Value: dual
   Environment: Production (必須)
   ```
4. 保存

### 1-2. 再デプロイ（必須）
環境変数の反映を確実にするため:
1. Pages → Deployments → 最新デプロイ
2. "Retry deployment" をクリック
3. デプロイ完了を待つ

### 1-3. 反映確認
```bash
curl https://hojyokin.pages.dev/api/health | jq .
```

期待レスポンス:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "...",
    "search_backend": "dual",  // ← これが "dual" であること
    "jgrants_mode": "cached-only"
  }
}
```

---

## 2. 24時間監視

### 2-1. 監視対象ログ

| ログタグ | 意味 | 監視方法 |
|----------|------|----------|
| `[DUAL_SEARCH_DIFF]` | SSOT vs cache の差分 | Cloudflare Logs / Logpush |
| `[SSOT_SEARCH_ERROR]` | SSOT検索失敗→cache fallback | Cloudflare Logs |

### 2-2. 合格基準

| 項目 | 合格条件 |
|------|----------|
| `[SSOT_SEARCH_ERROR]` | 0件（理想）、または原因説明可能な少数 |
| `[DUAL_SEARCH_DIFF]` diff_type | 空配列（理想）、または想定内の差分のみ |

### 2-3. 想定内の差分例
- `missing_in_ssot`: 旧cacheが「期限NULL」を受付中扱いしていた（SSOTが正しい）
- `order_diff`: ソート順の微差（大きな問題なし）

---

## 3. 24時間後の判定

### ✅ 合格 → `SEARCH_BACKEND=ssot` に切替

1. Cloudflare Dashboard → Environment variables
2. `SEARCH_BACKEND = ssot` に変更
3. 再デプロイ
4. 確認:
   ```bash
   curl https://hojyokin.pages.dev/api/health | jq .data.search_backend
   # 期待: "ssot"
   ```

### ⚠️ 差分あり（障害なし）

1. `diff_type` を集計して上位3つを分析
2. 基本方針: **SSOTを正とする**
   - 旧cacheがズレているだけなら問題なし
   - 「古い補助金が出る事故」を消す目的に照らして判断
3. 必要に応じてデータ修正後、`ssot` 固定へ

### ❌ 障害発生

**即時ロールバック:**
1. `SEARCH_BACKEND = cache` に変更
2. 再デプロイ
3. 原因調査: `[SSOT_SEARCH_ERROR]` の `error_message` と `request_params` を確認

---

## 4. 本番データ状況（検証開始時点）

| 項目 | 値 | 備考 |
|------|-----|------|
| canonical 総数 | 2,894 | |
| latest_cache_id 設定率 | 100% | 2,894/2,894 |
| latest_snapshot_id 設定率 | 100% | 2,894/2,894 |
| **受付中 (is_accepting=1)** | **173件** | ← 検索結果の母数 |
| source_link 重複 | 0件 | |

### ⚠️ 注意: 受付中=173件は仕様

- SSOT検索では「受付中のみ」がデフォルト
- UI上の検索結果が約173件レンジになるのは正常
- 関係者に事前共有しておくこと

### 📊 ssot vs cache の差分（2件）の正体

| jgrants_id | タイトル | acceptance_start | acceptance_end | 状態 |
|------------|----------|------------------|----------------|------|
| a0WJ200000CDUUzMAP | 脱炭素成長型経済構造移行推進対策費補助金... | 2026-02-16 | 2026-02-20 | **募集開始前** |
| a0WJ200000CDWZYMA5 | [２次公募]中小企業成長加速化補助金 | 2026-02-24 | 2026-03-26 | **募集開始前** |

**結論**: cache は `request_reception_display_flag=1`（jGrants API のフラグ）で判定しているため「募集開始前」も含む。
SSOT は `acceptance_start <= now <= acceptance_end` で判定しているため「本当に今この瞬間受付中」のみ。
→ **SSOTが正しい**。この差分は想定内であり、事故ではない。

---

## 5. ログ収集テンプレート（24時間後に報告）

以下を貼り付けてください:

```
# SSOT_SEARCH_ERROR
件数: __件

# DUAL_SEARCH_DIFF
総件数: __件

diff_type 内訳:
- missing_in_ssot: __件
- missing_in_cache: __件
- order_diff: __件

# サンプル（1件）
ssot_ids_top10: [...]
cache_ids_top10: [...]
```

---

## 6. 緊急連絡先

- 問題発生時: 即 `SEARCH_BACKEND=cache` に戻す
- 修正後: 再度 `dual` → 検証 → `ssot` の流れ

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-02-01 | 初版作成（P1開始） |

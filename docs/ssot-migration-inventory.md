# SSOT Migration Inventory - subsidy_cache 参照箇所の棚卸し

## 目標

検索APIの事実（Truth）を以下に固定する：

- **受付中（Active）判定**: `subsidy_snapshot.is_accepting = 1`（SSOT）
- **検索結果の制度単位**: `subsidy_canonical`（SSOT）
- **表示補助（UI用の装飾）**: `subsidy_cache`（キャッシュ/補助、無ければ欠損扱い）
- **izumi**: 検索"候補"に出せるが、Active判定には使わない（確定ルール）

---

## カテゴリ別 置換対象リスト

### A. 検索系（最優先で切り替え）

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/lib/jgrants-adapter.ts` | 327-418 | `searchFromCache()` - 検索一覧のメインクエリ | **P0** | canonical + latest_snapshot に全面置換 |
| `src/routes/subsidies.ts` | 421-445 | `/evaluations/:company_id` - 評価一覧の補助金情報JOIN | P1 | LEFT JOIN subsidy_cache → LEFT JOIN subsidy_snapshot via canonical |

### B. 詳細取得系

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/lib/jgrants-adapter.ts` | 136-213 | `getDetail()` - 詳細取得（キャッシュフォールバック） | P1 | cache は「表示補助」として維持、snapshot から期間・金額を取得 |
| `src/lib/jgrants-adapter.ts` | 218-229 | `getDetailFromCacheRaw()` | P1 | snapshot 参照を追加 |

### C. チャット/壁打ち系

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/routes/chat.ts` | 132-136 | precheck - 補助金情報取得 | P1 | snapshot から期間を取得、cache は表示補助 |
| `src/routes/chat.ts` | 516-519 | session開始時 - 補助金情報取得 | P1 | 同上 |
| `src/routes/chat.ts` | 720-727 | session一覧 - title取得のJOIN | P2 | canonical.name または cache.title（表示用） |
| `src/routes/chat.ts` | 763-768 | session詳細 - title取得のJOIN | P2 | 同上 |

### D. 下書き生成系

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/routes/draft.ts` | 265-270 | ドラフト生成 - セッション+補助金title取得 | P2 | canonical.name または cache.title |
| `src/routes/draft.ts` | 424, 468 | 同上（別関数） | P2 | 同上 |

### E. 管理画面系（統計・モニタリング）

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/routes/admin-dashboard.ts` | 661-676 | データ鮮度 - source別統計 | P3 | 統計目的なので cache 参照のまま（補助情報） |
| `src/routes/admin-dashboard.ts` | 1174-1214 | 網羅性チェック - 地域別統計 | P3 | 同上 |
| `src/routes/admin-dashboard.ts` | 1505-1580 | wall_chat統計 | P3 | cache のまま（統計用途） |
| `src/routes/admin.ts` | 796-905 | sync-jgrants - API同期 | P3 | 書き込み専用、変更不要 |
| `src/routes/admin.ts` | 1118-1183 | subsidy-cache/stats - 統計 | P3 | 統計目的、変更不要 |

### F. cron/バッチ系

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/routes/cron.ts` | 318, 588-596 | 定期同期処理 | P3 | 書き込み専用、変更不要 |
| `src/routes/cron.ts` | 713, 1021-1030, 1257 | wall_chat更新処理 | P3 | cache への書き込み（補助情報更新）、変更不要 |
| `src/services/cron-handlers.ts` | 65, 104, 172, 244, 313, 424 | 各種更新ハンドラ | P3 | 書き込み専用、変更不要 |

### G. その他

| ファイル | 行番号 | 用途 | 切替優先度 | 切替方針 |
|---------|--------|------|-----------|----------|
| `src/routes/agency.ts` | 3019 | 代理店向け補助金情報 | P2 | 検索系なら切替、表示のみなら維持 |
| `src/routes/knowledge.ts` | 495-497 | ナレッジ連携 | P2 | 要調査 |
| `src/routes/jobs.ts` | 228 | ジョブ関連 | P3 | 要調査 |
| `src/lib/cost/cost-logger.ts` | 25 | コストログ | P3 | 統計用、変更不要 |

---

## 優先度別 作業順序

### Phase 1: P0 - 検索APIの基盤切替（最優先）

1. **`jgrants-adapter.ts` の `searchFromCache()` を SSOT ベースに全面書き換え**
   - 現在: `subsidy_cache` を直接SELECT
   - 目標: `canonical → latest_snapshot` をメインに、`cache` は表示補助

2. **新しいSSOTクエリの設計・実装**

### Phase 2: P1 - 詳細・壁打ちの整合性

- `getDetail()` で snapshot から期間・金額を取得
- chat.ts の precheck で Active 判定を snapshot ベースに

### Phase 3: P2 - UI表示の整合性

- session一覧、下書きなどの title 取得を canonical.name に統一
- 表示用のフォールバックとして cache.title を維持

### Phase 4: P3 - 管理画面・統計（変更不要が多い）

- 統計・モニタリング系は cache 参照のままでOK（補助情報として正しい用途）
- 書き込み系（sync, cron）も変更不要

---

## SSOT検索クエリ設計（Phase 1 用）

### 基本形

```sql
SELECT
  c.id AS canonical_id,
  c.name AS title,
  c.issuer_name,
  c.prefecture_code,
  l.source_type,
  l.source_id,
  s.is_accepting,
  s.acceptance_start AS acceptance_start_datetime,
  s.acceptance_end AS acceptance_end_datetime,
  s.subsidy_max_limit,
  s.subsidy_rate,
  -- 表示補助（無ければNULL）
  cache.wall_chat_ready,
  cache.wall_chat_mode,
  cache.detail_json
FROM subsidy_canonical c
INNER JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
LEFT JOIN subsidy_source_link l ON l.canonical_id = c.id AND l.source_type = 'jgrants'
LEFT JOIN subsidy_cache cache ON cache.canonical_id = c.id
WHERE
  -- デフォルト: 受付中のみ
  (:acceptance = 0 OR s.is_accepting = 1)
  -- 地域フィルタ
  AND (:target_area IS NULL OR c.prefecture_code IS NULL OR c.prefecture_code = '00' OR c.prefecture_code = :target_area)
  -- キーワードフィルタ
  AND (:keyword IS NULL OR c.name LIKE '%' || :keyword || '%')
ORDER BY s.acceptance_end ASC
LIMIT :limit OFFSET :offset;
```

### カウント用

```sql
SELECT COUNT(*) as total_count
FROM subsidy_canonical c
INNER JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
WHERE
  (:acceptance = 0 OR s.is_accepting = 1)
  AND (:target_area IS NULL OR c.prefecture_code IS NULL OR c.prefecture_code = '00' OR c.prefecture_code = :target_area)
  AND (:keyword IS NULL OR c.name LIKE '%' || :keyword || '%');
```

---

## 切替時のガード

### 1. Feature Flag

```typescript
// 環境変数で切替
const SEARCH_BACKEND = env.SEARCH_BACKEND || 'cache'; // 'cache' | 'ssot' | 'dual'
```

### 2. Dual Read（移行期間中）

```typescript
if (SEARCH_BACKEND === 'dual') {
  const [cacheResult, ssotResult] = await Promise.all([
    searchFromCache(params),
    searchFromSSOT(params)
  ]);
  
  // 件数差をログ
  console.log(`[Search] Cache: ${cacheResult.total}, SSOT: ${ssotResult.total}, diff: ${cacheResult.total - ssotResult.total}`);
  
  // 返すのはSSOT（正）
  return ssotResult;
}
```

### 3. ロールバック

```bash
# 問題発生時は環境変数を切り替えるだけ
SEARCH_BACKEND=cache  # 旧モードに戻す
```

---

## 次のステップ

1. **P0実装**: `jgrants-adapter.ts` に `searchFromSSOT()` を追加
2. **Feature Flag**: `SEARCH_BACKEND` 環境変数を追加
3. **テスト**: ローカルで dual モードで件数差確認
4. **本番適用**: `SEARCH_BACKEND=ssot` に切替
5. **旧コード削除**: 安定後に `searchFromCache()` を削除

---

## 確定ルール（再掲）

- **受付中判定**: `snapshot.is_accepting = 1` のみ（cache の `request_reception_display_flag` は使わない）
- **期限判定**: `snapshot.acceptance_end` のみ
- **表示用title**: `canonical.name`（フォールバック: `cache.title`）
- **izumi**: 検索補助のみ、Active判定には使わない
- **orphan_pdf**: 検索には出せるが「受付中」にはしない

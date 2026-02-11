# Phase 23: 検索パフォーマンス改善 & 検索機能強化 & コードレビュー

**日付**: 2026-02-11
**コミット**: 91c280b
**デプロイ**: https://hojyokin.pages.dev

---

## 1. 実施内容サマリー

### 1A. パフォーマンス改善（3箇所の並列化）

| 改善 | 対象ファイル | 内容 | 推定効果 |
|------|-------------|------|----------|
| P2-2 | `getCompanySSOT.ts` | companies + company_profile + chat_facts の3クエリを `Promise.all` で並列化 | ~66% 削減 (3RTT → 1RTT) |
| P2-3 | `subsidies.ts` | NSD変換を for-loop → `Promise.all` で並列化 | ~80% 削減 (N件の逐次 → 並列) |
| P2-2b | `subsidies.ts` | adapter.search と getCompanySSOT を同時実行 | ~50% 削減 (2RTT → 1RTT) |
| P2-4 | `subsidies.ts` | キャッシュキーを FNV-1a ハッシュに改善 | 衝突率低減 |
| P2-3b | `getNormalizedSubsidyDetail.ts` | canonical/snapshot/cache取得の3クエリを並列化 | ~66% 削減 (3RTT → 1RTT) |

**合計の推定パフォーマンス改善**: 検索処理全体で 60-70% の遅延削減

### 1B. 検索機能強化

| 機能 | 内容 | 影響ファイル |
|------|------|-------------|
| トークン分割AND検索 | スペース区切りで複数キーワードの AND 部分一致 | `jgrants-adapter.ts` (SSOT/cache両バックエンド) |
| issuer_name検索 | 発行機関名も検索対象に追加 | `jgrants-adapter.ts` |
| 都道府県フィルター | パラメータ `prefecture` でフロントから明示的地域指定可能 | `subsidies.ts`, `subsidies.tsx` |
| 都道府県UIドロップダウン | 47都道府県 + 全国の選択UI | `subsidies.tsx` |
| DoS対策 | トークン数上限5（過剰入力防止） | `jgrants-adapter.ts` |

### 1C. コードレビュー & バグ修正

| ID | 種別 | 内容 | 影響 |
|-----|------|------|------|
| BUG-10 | バグ | 士業ダッシュボード `getStatusBadge` に DO_NOT_PROCEED 未対応 | `agency.tsx` |
| BUG-11 | バグ | ステータスフィルターが 'NO' を使用（DO_NOT_PROCEED 統一） | `subsidies.tsx` |
| BUG-12 | バグ | statusCounts の `NO` カウントが DO_NOT_PROCEED を見落とす | `subsidies.tsx` |
| SEC-1 | セキュリティ | TODO追加: debug_message/debug_stack の本番環境削除警告 | `subsidies.ts` |
| SEC-2 | セキュリティ | TODO追加: CSRF トークンバリデーション確認 | `subsidies.ts` |
| CACHE-1 | 設計 | TODO追加: キャッシュ TTL 妥当性と無効化戦略 | `subsidies.ts` |

---

## 2. 変更ファイル詳細

### `src/lib/ssot/getCompanySSOT.ts`
- **変更**: 3つの逐次DBクエリ → `Promise.all` で並列化
- **安全性**: company が null の場合はそのまま null を返す（profile/facts は不要）
- **互換性**: 出力型は変更なし（CompanySSOT）

### `src/lib/ssot/getNormalizedSubsidyDetail.ts`
- **変更**: canonical/snapshot/cache の3つの逐次クエリ → `Promise.all` で並列化
- **安全性**: snapshot_id/cache_id が null の場合は `Promise.resolve(null)` で安全にスキップ

### `src/routes/subsidies.ts`
- **変更**:
  - adapter.search + getCompanySSOT を同時実行
  - NSD変換を Promise.all で並列化
  - prefecture パラメータ対応
  - FNV-1a ハッシュへ改善
  - TODOコメント追加（キャッシュ戦略、CSRF、セキュリティ）
- **新パラメータ**: `prefecture` (string, optional) - 都道府県の明示的指定

### `src/lib/jgrants-adapter.ts`
- **変更**:
  - SSOT/cache 両バックエンドでトークン分割AND検索
  - issuer_name を検索対象に追加
  - 全角スペース→半角正規化
  - 最大5トークン制限（DoS対策）

### `src/pages/subsidies.tsx`
- **変更**:
  - グリッドを4列→5列に変更（都道府県フィルター追加）
  - 47都道府県 + 全国ドロップダウン
  - ステータスフィルター `NO` → `DO_NOT_PROCEED`
  - statusCounts: DO_NOT_PROCEED を正しくカウント
  - フィルター適用時に NO/DO_NOT_PROCEED 両方マッチ

### `src/pages/agency.tsx`
- **変更**: getStatusBadge に `DO_NOT_PROCEED` ハンドリング追加

---

## 3. 今後のTODO（// TODO: 要確認）

### 高優先度
- [ ] `subsidies.ts`: 本番環境で `debug_message` / `debug_stack` を削除（SEC-1）
- [ ] `subsidies.ts`: キャッシュ TTL の妥当性評価と無効化戦略の確定（CACHE-1）
- [ ] E2Eテスト: トークン分割検索の品質検証（精度・再現率）

### 中優先度
- [ ] `screening-v2.ts`: 従業員規模マッチングの業種別対応（製造業20人 vs 商業5人）
- [ ] `screening-v2.ts`: 資本金チェックの業種別上限（製造3億, 卸売1億 等）
- [ ] CSRF トークンバリデーションの確認（SEC-2）

### 低優先度
- [ ] `getCompanySSOT.ts`: employee_band を employee_count から自動計算
- [ ] 検索パフォーマンスKPIの計測と可視化（応答時間のP50/P95/P99）
- [ ] クライアント側フィルターのサーバー側実装（詳細フィルター連携）

---

## 4. KPI案

| KPI | 目標 | 計測方法 |
|-----|------|----------|
| 検索応答時間 P50 | < 2秒 | console.log タイミング / usage_events |
| 検索応答時間 P95 | < 5秒 | console.log タイミング |
| キーワード一致率 | > 70% | 検索結果のクリック率追跡 |
| 都道府県フィルター利用率 | 計測開始 | prefecture パラメータの有無を usage_events に記録 |

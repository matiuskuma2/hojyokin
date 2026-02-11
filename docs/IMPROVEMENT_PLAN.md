# 改善計画書 (IMPROVEMENT_PLAN)

> **最終更新**: 2026-02-11 (Phase 24 完了時点)
> **ライブサイト**: https://hojyokin.pages.dev
> **目的**: 全TODO/改善項目を優先度・受け入れ基準・テストケース付きで管理

---

## 1. TODO: 要確認 一覧（コード内タグ対応）

### カテゴリ A: セキュリティ（即時対応推奨）

| ID | ファイル | 内容 | 優先度 | 受け入れ基準 |
|----|---------|------|--------|-------------|
| SEC-1 | `subsidies.ts:728` | 本番環境で debug_message/debug_stack 露出 | P0 | ENVIRONMENT=production 時に debug フィールドを返さない |
| SEC-2 | `subsidies.ts:131` | debug パラメータの権限チェック | P1 | super_admin 以外で debug=1 → 400エラー |
| SEC-3 | `draft.ts:27` | ドラフト更新のバリデーション強化（XSS/SQLi） | P1 | sections_json サニタイズ処理、1セクション最大10000文字 |

**テストケース**:
- SEC-1: `curl /api/subsidies/invalid-id` → 500レスポンスに stack 含まれないこと
- SEC-2: 一般ユーザーが `debug=1` → allowUnready=false のまま
- SEC-3: `<script>alert(1)</script>` を含むセクション → HTMLエスケープされて保存

---

### カテゴリ B: パフォーマンス・キャッシュ

| ID | ファイル | 内容 | 優先度 | 受け入れ基準 |
|----|---------|------|--------|-------------|
| CACHE-1 | `subsidies.ts:38` | キャッシュTTLの妥当性 | P1 | TTL 120〜300秒の範囲で確定（JGrants更新サイクル確認後） |
| CACHE-2 | `subsidies.ts:42` | キャッシュ無効化戦略 | P2 | admin-opsのSSOT更新時にcache.delete呼び出し追加 |
| PERF-1 | `subsidies.ts` | KPI計測（perf_ms） | ✅完了 | usage_events に perf_ms.total/search_and_ssot/nsd_normalize 記録済み |

**KPI目標**:
| 指標 | 目標値 | 計測方法 |
|------|--------|----------|
| 検索応答時間 P50 | < 2秒 | usage_events.metadata.perf_ms.total |
| 検索応答時間 P95 | < 5秒 | usage_events.metadata.perf_ms.total |
| キャッシュヒット率 | > 30% | レスポンスの meta.cached フラグ |
| 都道府県フィルター利用率 | 計測中 | usage_events.metadata.prefecture != null |

**KPI分析SQL**:
```sql
-- P50/P95 算出
SELECT 
  json_extract(metadata, '$.perf_ms.total') as total_ms
FROM usage_events 
WHERE event_type = 'SUBSIDY_SEARCH'
ORDER BY created_at DESC
LIMIT 100;
```

---

### カテゴリ C: 検索精度・機能

| ID | ファイル | 内容 | 優先度 | 受け入れ基準 |
|----|---------|------|--------|-------------|
| SEARCH-1 | `jgrants-adapter.ts` | トークン分割検索の精度評価 | ✅完了 | 20テストケース全通過 `tests/tokenize-search.test.ts` (Phase 24) |
| SEARCH-2 | `jgrants-adapter.ts:13` | SSOTフォールバック時のアラート | P2 | フォールバック発生→usage_events記録 |
| SEARCH-3 | `subsidies.tsx:1805` | 詳細フィルターのAPI連携 | P2 | issuer/region/categoryフィルターが反映 |

**テストケース（SEARCH-1）**:
| # | 検索クエリ | 期待結果 |
|---|-----------|---------|
| 1 | `IT導入` | IT導入補助金が上位 |
| 2 | `省エネ 設備` | 省エネ関連補助金（AND条件） |
| 3 | `製造業 人材` | 製造業向け人材育成補助金 |
| 4 | `東京都 小規模` | 東京都の小規模事業者向け |
| 5 | `ものづくり 生産性` | ものづくり補助金 |

---

### カテゴリ D: マッチングエンジン（screening-v2）

| ID | ファイル | 内容 | 優先度 | 受け入れ基準 |
|----|---------|------|--------|-------------|
| MATCH-1 | `screening-v2.ts` | 業種別従業員数上限 | ✅完了 | SME_THRESHOLDS + resolveIndustryCategory 実装 (Phase 24) |
| MATCH-2 | `screening-v2.ts` | 業種別資本金上限 | ✅完了 | isSmeByLaw() で業種別上限判定 (Phase 24) |
| MATCH-3 | `screening-v2.ts` | 小規模事業者の判定精度 | ✅完了 | 中小企業基本法準拠、37テストケース全通過 (Phase 24) |

**中小企業基本法の定義テーブル（✅実装済み `SME_THRESHOLDS`）**:
| 業種 | 資本金上限 | 従業員上限 | 小規模上限 |
|------|-----------|-----------|-----------|
| 製造業・建設業・運輸業等 | 3億円 | 300人 | 20人 |
| 卸売業 | 1億円 | 100人 | 5人 |
| サービス業 | 5千万円 | 100人 | 5人 |
| 小売業 | 5千万円 | 50人 | 5人 |

**リスク対策 ✅解消**:
- ~~一律判定のリスク~~ → 業種別テーブルによる正確な判定に改修
- resolveIndustryCategory: industry_major → 4カテゴリ変換（部分一致対応）
- isSmeByLaw: OR条件（資本金 OR 従業員数）で中小企業基本法準拠
- テスト: `tests/screening-sme.test.ts` 37ケース全通過

---

### カテゴリ E: SSOT・データ正規化

| ID | ファイル | 内容 | 優先度 | 受け入れ基準 |
|----|---------|------|--------|-------------|
| SSOT-1 | `getCompanySSOT.ts:9` | employee_band 自動計算 | P2 | employee_count→employee_band変換関数 |
| SSOT-2 | `getCompanySSOT.ts:13` | JSON形式バリデーション | P2 | パースエラー時にmissing_fields追加 |
| SSOT-3 | `normalizeSubsidyDetail.ts:11` | デフォルト値ポリシー | P2 | 全フィールドのデフォルト値ルールをFreeze定義 |
| SSOT-4 | `normalizeSubsidyDetail.ts:14` | subsidy_rate_text 正規化 | P3 | "1/2", "50%", "定額" → 統一数値表現 |
| SSOT-5 | `fact-sync.ts:31` | AI fact_value 形式依存 | P3 | 複合表現「3億5000万」対応（実装済み） |

---

### カテゴリ F: ドラフト機能（/api/draft）

| ID | ファイル | 内容 | 優先度 | 受け入れ基準 |
|----|---------|------|--------|-------------|
| DRAFT-1 | `draft.ts` | 動的セクション生成 | ✅完了 | 受給要件/スケジュールセクション追加、計12セクション動的生成 (Phase 24) |
| DRAFT-2 | `draft.ts` | NGチェック拡張（6→21ルール） | ✅完了 | 9カテゴリ21ルール、16テスト全通過 (Phase 24) |
| DRAFT-3 | `draft.ts:23` | 電子申請案内自動生成 | P2 | is_electronic_application→GビズID案内セクション |
| DRAFT-4 | `draft.ts:25` | LLM統合ドラフト生成 | P2 | テンプレート→LLMリライト→NGチェックフロー |
| DRAFT-5 | `draft.tsx:15` | オートセーブ | P2 | 3秒debounce自動保存、インジケーター表示 |
| DRAFT-6 | `draft.tsx:18` | D&Dセクション並び替え | P3 | SortableJS導入、モバイル対応 |
| DRAFT-7 | `draft.tsx:21` | PDFエクスポート | P3 | 確定後にPDFダウンロード |
| DRAFT-8 | `draft.tsx:23` | 文字数制限・カウンター | P2 | 各セクションにリアルタイムカウンター |

---

## 2. フェーズ別ロードマップ

### Phase 24（次回）: セキュリティ + マッチング精度
- [ ] SEC-1: 本番環境のdebug情報露出を修正
- [ ] SEC-3: ドラフトバリデーション強化
- [ ] MATCH-1/2/3: 業種別判定テーブルの実装
- [ ] SEARCH-1: トークン分割検索のテストケース20件作成・検証

### Phase 25: ドラフト機能完成
- [ ] DRAFT-1: 動的セクション生成
- [ ] DRAFT-2: NGチェック拡張
- [ ] DRAFT-3: 電子申請案内
- [ ] DRAFT-8: 文字数制限・カウンター

### Phase 26: 検索・UX改善
- [ ] CACHE-1/2: キャッシュ戦略確定
- [ ] SEARCH-3: 詳細フィルターAPI連携
- [ ] DRAFT-5: オートセーブ
- [ ] SSOT-1/2: employee_band/JSONバリデーション

### Phase 27+: 高度機能
- [ ] DRAFT-4: LLM統合ドラフト
- [ ] DRAFT-7: PDFエクスポート
- [ ] SSOT-4: rate_text正規化
- [ ] SEARCH-2: SSOTフォールバックアラート

---

## 3. 非コードTODO（運用・設計）

| ID | 内容 | 優先度 |
|----|------|--------|
| OPS-1 | E2Eテストの実装（Playwright or Vitest） | P1 |
| OPS-2 | CI/CDパイプラインの構築（GitHub Actions） | P1 |
| OPS-3 | 設計ドキュメントの恒久保存（docs/配下の整理） | P2 |
| OPS-4 | 本番環境の監視ダッシュボード構築 | P2 |
| OPS-5 | バックアップ・リカバリ手順の文書化 | P3 |

---

## 4. 既知の技術的負債

| 項目 | 説明 | リスクレベル |
|------|------|-------------|
| subsidy_cache テーブル依存 | SSOT化が進行中だが、cacheバックエンドも残存 | 中 |
| フロントエンドの巨大ファイル | subsidies.tsx (3244行), agency.tsx が肥大化 | 低 |
| テスト不在 | ユニットテスト・E2Eテストが未実装 | 高 |
| consumer.ts: AWS SQS未連携 | TODO放置（Phase2設計に含まれるが未着手） | 低 |
| knowledge/internal.ts: Firecrawl未連携 | データ取得パイプラインの自動化が未完 | 中 |

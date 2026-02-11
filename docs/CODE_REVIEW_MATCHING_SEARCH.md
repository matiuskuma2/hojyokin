# 補助金検索 & マッチングロジック 包括的コードレビューレポート

**日付**: 2026-02-11
**レビュー範囲**: 補助金検索機能、マッチング/スクリーニングV2、企業情報登録、SSOT正規化、フロントエンドUI
**レビュアー**: AI Code Review

---

## 1. レビュー対象ファイル一覧

| ファイル | 役割 | サイズ |
|---------|------|--------|
| `src/lib/screening-v2.ts` | スクリーニングV2（マッチングエンジン） | 26KB |
| `src/lib/ssot/getCompanySSOT.ts` | 企業SSOT取得 | 12KB |
| `src/lib/ssot/normalizeSubsidyDetail.ts` | 補助金データ正規化 v1.0 | 22KB |
| `src/lib/subsidy-normalizer.ts` | **旧**正規化（レガシー未使用） | 22KB |
| `src/routes/subsidies.ts` | 補助金API（検索/詳細/要件/書類） | 39KB |
| `src/routes/profile.ts` | 企業情報登録・更新 | 50KB |
| `src/pages/subsidies.tsx` | フロントエンドUI（検索・一覧・詳細） | 161KB |

---

## 2. 発見された問題（重要度順）

### 🔴 P0: 致命的/高リスク

#### P0-1: EvaluationStatus 'NO' vs 'DO_NOT_PROCEED' の不整合
- **場所**: 複数ファイル
- **型定義** (`src/types/models.ts:105`): `'PROCEED' | 'CAUTION' | 'DO_NOT_PROCEED'`
- **screening-v2.ts**: `DO_NOT_PROCEED` のみ出力（正しい）
- **subsidies.ts:294**: `r.evaluation.status === 'NO'` でカウント → **常に0** になる
- **subsidies.tsx**: `'NO'` と `'DO_NOT_PROCEED'` を両方扱う（フォールバック対応）
- **影響**: usage_events の `no_count` が常に0で記録される。検索結果の統計が不正確
- **修正方針**: バックエンド `no_count` を `DO_NOT_PROCEED` に統一。フロントは互換性のため両方を維持

```typescript
// 修正前（subsidies.ts:294）
no_count: sortedResults.filter(r => r.evaluation.status === 'NO').length,
// 修正後
no_count: sortedResults.filter(r => r.evaluation.status === 'DO_NOT_PROCEED').length,
```

#### P0-2: VALID_STATUSES に 'NO' が含まれる（型と矛盾）
- **場所**: `src/routes/subsidies.ts:694`
- `const VALID_STATUSES = ['PROCEED', 'CAUTION', 'NO', 'DO_NOT_PROCEED'];`
- 'NO' は型に存在しない値。DB内のレガシーデータ互換かもしれないが、明示が必要
- **修正方針**: コメントで明記し、将来のマイグレーションで 'NO' → 'DO_NOT_PROCEED' に統一

#### P0-3: `is_accepting` の型不整合
- **screening-v2.ts:438**: `subsidy.acceptance.is_accepting` を `boolean` として使用
- **normalizeSubsidyDetail.ts:224-225**: `acceptance` の `is_accepting` が条件分岐で `false | true` を設定するが、型定義は `is_accepting: boolean`、フォールバック時に `null` が代入される
- **修正方針**: `NormalizedAcceptance.is_accepting` を `boolean` に固定し、フォールバックは `false`

### 🟡 P1: 重要な改善点

#### P1-1: デッドコード `EMPLOYEE_BAND_RANGES`
- **場所**: `src/lib/screening-v2.ts:68-75`
- 定義されているが一度も使用されていない
- `checkEmployeeMatchV2` は `employee_count` を直接使用
- **修正方針**: 削除

#### P1-2: 従業員規模マッチングのキーワードベース判定が脆弱
- **場所**: `src/lib/screening-v2.ts:396-416`
- 「小規模」→ 20人、「中小」→ 300人、「中堅」→ 2000人のハードコード
- 業種によって「小規模」の定義が異なる（製造業: 20人以下、商業・サービス: 5人以下）
- `rangeMatch` の正規表現が「以上」「超」を検出しない
- **修正方針**: 
  - 業種×規模のクロスチェック導入（中小企業基本法準拠）
  - `以上|超` パターンも追加
  - enterprise_definitions があればそちらを優先

```typescript
// TODO: 要確認 - 業種別小規模事業者定義
// 製造業・建設業: 20人以下
// 商業・サービス: 5人以下
```

#### P1-3: 地域マッチングの部分一致リスク
- **場所**: `src/lib/screening-v2.ts:276`
- `targetArea.includes(prefectureName)` は部分一致
- 例: 「京都府」で「東京都」も `includes('京')` → false （実際には問題なし。「京都」でも OK）
- ただし `targetArea = "神奈川県、東京都"` のような文字列の場合、問題はない
- **リスク低**: 現状は都道府県名が十分にユニークなので問題は発生しにくい

#### P1-4: 資本金チェックの業種無視
- **場所**: `src/lib/screening-v2.ts:558`
- 一律3億円以下で中小企業判定
- 実際の中小企業基本法: 製造業3億円、卸売1億円、小売・サービス5000万円
- **修正方針**: enterprise_definitions の capital を参照。なければ industry_major から推定

#### P1-5: 旧 `subsidy-normalizer.ts` がファイルとして残存
- **場所**: `src/lib/subsidy-normalizer.ts`
- インポートされていないが、`src/lib/` に存在し混乱の元
- **修正方針**: 削除（バックアップはgit履歴にある）

#### P1-6: 検索結果の `no_count` と フロントの `count-no` の不一致
- **場所**: バックエンド subsidies.ts:294、フロント subsidies.tsx:1055
- バックエンドは `'NO'` でカウント（常に0）
- フロントは `CAUTION` / `PROCEED` 以外は全て `NO` にカウント
- つまり `DO_NOT_PROCEED` はフロントでは「非推奨」としてカウントされるが、バックエンドの統計には反映されない

### 🟢 P2: 推奨改善

#### P2-1: `checkEligibilityRulesV2` の重複 missing 追加
- **場所**: `src/lib/screening-v2.ts:631-706`
- 同じルールが複数のcategoryに該当した場合（例: '税金' と '滞納' が同じルールに含まれる）、同じmissingが複数回追加される可能性
- **修正方針**: missingFields を Set<field> で重複排除

#### P2-2: `getCompanySSOT` のクエリ並列化
- **場所**: `src/lib/ssot/getCompanySSOT.ts:143-228`
- companies, company_profile, chat_facts を順次取得
- **修正方針**: `Promise.all` で並列化（D1は同一リクエスト内の並列クエリをサポート）

#### P2-3: 検索結果の NormalizedSubsidyDetail 変換がシーケンシャル
- **場所**: `src/routes/subsidies.ts:213-229`
- `for (const result of jgrantsResults)` でループ内 await
- **修正方針**: `Promise.allSettled` で並列化

#### P2-4: キャッシュキーの簡易ハッシュが衝突リスク
- **場所**: `src/routes/subsidies.ts:52-61`
- 32ビットの簡易ハッシュで衝突の可能性あり
- **修正方針**: Web Crypto API の `crypto.subtle.digest('SHA-256', ...)` を使用

#### P2-5: `employee_band` の自動計算がない
- **場所**: `src/routes/profile.ts:227`
- `employee_count` を更新しても `employee_band` は手動設定
- screening-v2 は employee_count を直接使うので実害は小さいが、データ一貫性の問題
- **修正方針**: profile.ts のPUT時に employee_count から employee_band を自動計算

---

## 3. 整合性検証結果

### 3-1: 検索結果 → 詳細ページのデータ整合性

| フィールド | 検索結果 (subsidies.ts) | 詳細 (/:subsidy_id) | 整合性 |
|-----------|----------------------|---------------------|--------|
| title | `v2Result.subsidy_title` ← `normalized.display.title` | `normalized.display.title` | ✅ |
| max_limit | `v2Result.subsidy_summary.subsidy_max_limit` ← `normalized.display.subsidy_max_limit` | `normalized.display.subsidy_max_limit` | ✅ |
| rate | `v2Result.subsidy_summary.subsidy_rate_text` ← `normalized.display.subsidy_rate_text` | `normalized.display.subsidy_rate_text` | ✅ |
| area | `v2Result.subsidy_summary.target_area_text` ← `normalized.display.target_area_text` | `normalized.display.target_area_text` | ✅ |
| wall_chat_ready | `v2Result.subsidy_summary.wall_chat_ready` ← `normalized.wall_chat.ready` | `normalized.wall_chat.ready` | ✅ |
| evaluation | screening-v2 で生成 | evaluation_runs テーブルから取得 | ✅ 同一source |

**結論**: 検索結果と詳細ページのデータは同じ NormalizedSubsidyDetail v1.0 から派生しており、整合性は保たれている。

### 3-2: おすすめ/非おすすめ判定の妥当性

| 判定ルール | 実装 | 妥当性 |
|-----------|------|--------|
| HIGH riskがあれば `DO_NOT_PROCEED` | `determineStatusV2` | ✅ |
| blockerレベルの missing があれば `CAUTION` | `determineStatusV2` | ✅ |
| スコア70以上で `PROCEED` | `determineStatusV2` | ✅ |
| スコア40-69で `CAUTION` | `determineStatusV2` | ✅ |
| スコア39以下で `DO_NOT_PROCEED` | `determineStatusV2` | ✅ |
| 受付終了で -40点 + HIGH risk | `checkAcceptanceStatusV2` | ✅ |
| 締切切れで -50点 + HIGH risk | `checkDeadlineV2` | ✅ |
| 地域不一致で -30点 | `checkAreaMatchV2` | ⚠️ 厳しめ |
| 税金滞納で -50点 + HIGH risk | `checkEligibilityRulesV2` | ✅ |

**スコアリング範囲分析**:
- 最高: 50(基準) + 15(地域) + 10(業種) + 10(従業員) + 10(受付) + 5(締切) + 5(資本金) + 5(GビズID) + 10(賃上げ) = **120 → 100**
- 最低: 50 - 30(地域) - 20(業種) - 25(従業員) - 40(受付) - 50(締切) - 20(資本金) - 10(GビズID) - 50(税金滞納) - 20(過去受給) = **-215 → 0**

**所見**: スコアリングは概ね妥当。地域不一致の-30はやや厳しいが、地方限定補助金では適切。

### 3-3: SSOT アーキテクチャの整合性

```
detail_json (DB)
    ↓
normalizeSubsidyDetail.ts → NormalizedSubsidyDetail v1.0
    ↓
screening-v2.ts → ScreeningResultV2 → evaluation
    ↓
subsidies.ts → フロントエンド互換形式 → JSON応答
```

**結論**: データフローは SSOT 原則に従い、一貫している。

---

## 4. 古いコード/レガシー整理

| ファイル/コード | 状態 | 推奨アクション |
|---------------|------|--------------|
| `src/lib/subsidy-normalizer.ts` | 未使用（インポートなし） | 🗑️ 削除 |
| `src/lib/screening.ts` | 未使用（v1 廃止） | 🗑️ 削除（存在する場合） |
| `EMPLOYEE_BAND_RANGES` in screening-v2.ts | デッドコード | 🗑️ 削除 |
| `'NO'` status in subsidies.ts | レガシー互換 | ⚠️ `DO_NOT_PROCEED` に統一 |
| `VALID_STATUSES` に 'NO' | レガシー互換 | ⚠️ コメント明記 or 削除 |

---

## 5. 品質チェック結果（ガイドライン準拠）

| カテゴリ | 評価 | 詳細 |
|---------|------|------|
| 入力安全性 | ⚠️ | limit/offset は境界値チェック済み。employee_count=0 が `|| 0` で安全。ただし `employee_band` の自動計算がない |
| ロジック正確性 | ⚠️ | 従業員規模マッチングが業種を考慮しない。資本金チェックも同様 |
| エラーハンドリング | ✅ | 各ステップでtry-catchあり。normalizeSubsidyDetail は個別catch+フォールバック |
| 整合性 | ⚠️ | `'NO'` vs `'DO_NOT_PROCEED'` の不整合 |
| セキュリティ | ✅ | 認証必須。SQL パラメータバインド使用。XSS対策はフロント側で escapeHtml |
| パフォーマンス | ⚠️ | 検索のNSD変換がシーケンシャル。キャッシュハッシュが簡易 |
| 可読性 | ✅ | Freeze ルールの明記、コメント充実。型定義が明確 |
| テスト | ❌ | ユニットテストが存在しない。CI未設定 |

---

## 6. 実装計画（優先度順）

### Phase 22-A: 即時修正（Breaking Issues）

1. **`no_count` を `DO_NOT_PROCEED` に修正** (subsidies.ts:294)
   - 受入基準: usage_events の no_count が実際のDO_NOT_PROCEEDカウントと一致
   - テスト: 検索実行後、usage_events の metadata を確認

2. **VALID_STATUSES のコメント/統一** (subsidies.ts:694)

3. **`EMPLOYEE_BAND_RANGES` 削除** (screening-v2.ts)

### Phase 22-B: 品質改善

4. **従業員規模マッチング強化**
   - enterprise_definitions の employees を参照
   - 業種別小規模事業者定義の追加
   - テスト: ものづくり補助金（製造業20人以下）のケース

5. **資本金チェックの業種別対応**
   - enterprise_definitions の capital を参照
   - テスト: 卸売業で1億円超の企業

6. **missing_fields の重複排除**

### Phase 22-C: パフォーマンス

7. **getCompanySSOT の並列化** (Promise.all)
8. **NSD変換の並列化** (Promise.allSettled)
9. **キャッシュキーのSHA-256化**

### Phase 22-D: レガシー整理

10. **`subsidy-normalizer.ts` 削除**
11. **`screening.ts` (v1) 削除（存在する場合）**

---

## 7. テストケース提案

### TC-1: EvaluationStatus 一貫性
```
Given: 受付終了の補助金を検索
When: screening-v2 が DO_NOT_PROCEED を返す
Then: 
  - フロント: 「非推奨」ラベル表示
  - usage_events.metadata.no_count > 0
  - 壁打ちボタン非表示
```

### TC-2: 小規模事業者マッチング
```
Given: 従業員3名の飲食業（商業・サービス）
When: 「小規模事業者」の補助金をマッチング
Then: matched = true（5人以下なので）

Given: 従業員10名の飲食業
When: 「小規模事業者」の補助金をマッチング  
Then: matched = false（商業・サービスは5人以下）
// TODO: 要確認 - 現状は20人で一律判定のため false にならない
```

### TC-3: 地域マッチング
```
Given: 企業所在地=東京都
When: 対象地域="東京都、神奈川県、千葉県、埼玉県" の補助金
Then: matched = true, scoreAdjustment = +15

Given: 企業所在地=大阪府
When: 上記と同じ補助金
Then: matched = false, scoreAdjustment = -30
```

### TC-4: blocker missing でCAUTION
```
Given: 企業の都道府県が未設定
When: 地域限定の補助金をマッチング
Then: 
  - status = CAUTION（DO_NOT_PROCEEDではない）
  - missing_fields に prefecture (blocker) が含まれる
  - 壁打ちボタンは表示される（CAUTION なので）
```

---

## 8. リスクと代替案

| リスク | 影響 | 代替案 |
|-------|------|--------|
| enterprise_definitions が null の補助金が多い | マッチング精度低下 | フォールバックとして現在のキーワードマッチを維持 |
| 'NO' → 'DO_NOT_PROCEED' マイグレーション | DB内レガシーデータの影響 | evaluation_runs テーブルの status カラムを UPDATE |
| subsidy-normalizer.ts 削除 | 他ツール/スクリプトでの参照 | `grep -r subsidy-normalizer` で事前確認済み（参照なし） |

---

## 9. まとめ

**全体評価**: 設計は堅牢で SSOT 原則に準拠。型定義と実装の整合性は概ね良好。

**即時対応必要**:
1. `no_count` の status フィルター修正（'NO' → 'DO_NOT_PROCEED'）
2. デッドコード `EMPLOYEE_BAND_RANGES` の削除

**中期改善**:
3. 従業員規模・資本金チェックの業種別対応
4. パフォーマンス改善（並列化）
5. ユニットテスト追加

**長期**:
6. レガシーファイル掃除
7. CI/CDパイプライン整備

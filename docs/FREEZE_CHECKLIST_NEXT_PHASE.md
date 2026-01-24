# 凍結チェックリスト（次フェーズ）

**作成日**: 2026-01-24  
**目的**: 「中途半端に崩れない」ための凍結条件と合格基準

---

## P0: 最優先（本番影響あり）

### P0-1: Agency検索UIをUser版に寄せる ✅ ほぼ完了

**目的**: Agency側の `/agency/search` を「別物UI」にしない

**現状**: 
- フィルタ構造: ✅ 統一済み
- 結果カード: ✅ 統一済み  
- 検索モード: ✅ 統一済み
- JS関数定義: ✅ window.setSearchMode, window.searchSubsidies 定義済み

**残タスク**:
- [ ] API呼び出し関数名の統一検討（`window.api` vs `window.apiCall`）
- [ ] ナビゲーション破綻テスト（緑ヘッダー内で完結確認）

**合格条件**:
- [ ] Agencyで「補助金検索」→ 検索後も戻る/ナビが破綻しない
- [ ] "フィルタUI"と"結果の説明"がUser版と同一
- [ ] JSエラーゼロ（api is not defined / setSearchMode is not defined 再発ゼロ）

**禁止**:
- "Agencyだけ簡易UI"のまま放置
- /subsidies に遷移させて戻れなくなる導線

---

### P0-2: 会社登録「失敗ゼロ」ルール凍結 ✅ 完了

**目的**: 会社情報登録の失敗、必須項目揃っているのに検索不可をゼロにする

**凍結仕様（確定）**:
- 必須: 会社名 / 都道府県 / 業種 / 従業員数（数値 > 0）
- `GET /api/companies/:id/completeness` を唯一の真実として使用
- status: `BLOCKED` → 検索不可、`NEEDS_RECOMMENDED` → 検索可（推奨不足）、`OK` → 検索可（完了）

**実装完了（2026-01-24）**:
- [x] completeness API: ✅ 凍結仕様通り実装済み
- [x] POST /api/companies: ✅ フィールド別バリデーション追加
- [x] PUT /api/companies/:id: ✅ フィールド別バリデーション追加
- [x] POST /api/agency/submissions/:id/approve: ✅ intake承認時バリデーション追加
- [x] /intake フォーム: ✅ 必須4項目をrequired指定、数値フィールドを数値型に変換

**バリデーションルール**:
- `name`: 文字列、trim後非空
- `prefecture`: 文字列、trim後非空
- `industry_major`: 文字列、trim後非空
- `employee_count`: 数値、> 0
- `capital`: 数値、>= 0（任意項目）
- `annual_revenue`: 数値、>= 0（任意項目）

**エラーレスポンス形式**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "employee_count": "従業員数は1以上の数値で入力してください"
    }
  }
}
```

**合格条件**:
- [x] 会社登録→即completeness反映→検索可否が100%一致
- [x] User / Agency代行入力 / 顧客リンク入力 の3経路で同じ挙動
- [x] 失敗時はフィールド別エラーを返す

---

### P0-3: Agencyリンク管理の意味を凍結 ✅ E2E確認済み

**目的**: 「リンク管理が何のためにあるか不明」という状態を解消

**凍結仕様**:
- access_links テーブル: 顧客の会社情報入力を依頼する導線
- 状態遷移: 発行 → 未使用 → 提出 → 承認/却下 → （承認後はcompany/profile反映）
- 承認済みの会社は `/agency/clients/:id` で必ず見れる

**E2E確認（2026-01-24）**:

**本番データでの確認**:
- [x] access_links: 複数のintakeリンクが存在（short_code: VJFpKBcX 等）
- [x] intake_submissions: approved状態のデータが存在（reviewed_at設定済み）
- [x] 状態遷移: submitted → approved が正常に動作

**実装確認**:

**P0-3-1: リンク管理に「発行したリンクが必ず出る」**
- [x] GET /api/agency/links: access_links一覧取得実装済み
- [x] POST /api/agency/links: リンク発行実装済み
- [x] DELETE /api/agency/links/:id: リンク無効化実装済み
- [x] UI: /agency/links でタイプフィルタ、有効のみ表示対応
- [x] UI: 発行完了モーダルでURLコピー機能あり

**P0-3-2: 承認後の顧客詳細が必ず開く**
- [x] GET /api/agency/clients/:id: 顧客詳細 + 関連データ取得
- [x] links, submissions, drafts, sessions を一括取得
- [x] UI: /agency/clients/:id で4タブ表示（企業情報/入力履歴/ドラフト/リンク）

**P0-3-3: 状態遷移の凍結**
- [x] intake_submissions: submitted → approved/rejected
- [x] POST /api/agency/submissions/:id/approve: バリデーション付き承認
- [x] POST /api/agency/submissions/:id/reject: 却下理由付き
- [x] 承認時: companies, company_profile テーブルを更新

**UI/API対応表**:
| 画面 | API | 確認状態 |
|------|-----|----------|
| /agency/links | GET /api/agency/links | ✅ |
| /agency/links 発行 | POST /api/agency/links | ✅ |
| /agency/submissions | GET /api/agency/submissions | ✅ |
| /agency/submissions 承認 | POST /api/agency/submissions/:id/approve | ✅ |
| /agency/clients/:id | GET /api/agency/clients/:id | ✅ |

---

## P1: 優先度中（UX向上）

### P1-1: Feedカテゴリ枠組み固定 ✅ 完了

**凍結仕様**:
- `platform`: プラットフォームお知らせ
- `support_info`: 新着支援情報
- `prefecture`: 都道府県NEWS
- `municipal`: 市区町村NEWS
- `ministry`: 省庁NEWS
- `other_public`: その他公的機関

**source_type CHECK制約**:
```sql
source_type IN ('platform','support_info','prefecture','municipal','ministry','other_public')
```

---

### P1-2: 顧客所在地連動NEWS優先 ✅ 完了

**実装内容（2026-01-24）**:

1. **顧客所在地の取得**:
   - `agency_clients` → `companies.prefecture` で都道府県コード一覧を取得
   - prefCodes 配列に格納

2. **NEWSソート優先度**:
   - `CASE WHEN prefecture_code IN (prefCodes) THEN 0 ELSE 1 END` で顧客エリアを最優先
   - その後 `first_seen_at DESC` で新しいものを上位に

3. **UI表示**:
   - `is_client_area = 1` の場合、「⭐ 顧客エリア」バッジを表示
   - 緑色 `bg-emerald-100 text-emerald-700` スタイル

4. **is_new カラムの代替**:
   - 0101マイグレーションで削除されたため
   - `first_seen_at > datetime('now', '-7 days')` で「新着」判定

**対応エンドポイント**:
- `/api/agency/dashboard-v2`: 顧客所在地連動実装済み
- `/api/agency/public-news`: prefectureフィルタ対応済み（クエリパラメータ）

---

### P1-3: おすすめサジェスト 🔴 未着手

**仕様**:
- 1st: ルールベース（地域一致＋業種一致＋従業員規模帯）
- 2nd: 上位候補だけLLMで理由生成（コスト抑制）

---

## 実装優先順序（更新: 2026-01-24）

1. ~~**P0-2**: POST/PUTバリデーション強化~~ ✅ 完了
2. ~~**P0-3**: リンク管理の状態遷移確認~~ ✅ 実装確認済み
3. **P0-1**: ナビゲーション破綻テスト（軽微） → 次回実施
4. ~~**P1-2**: 顧客所在地連動NEWS~~ ✅ 完了
5. **P1-3**: おすすめサジェスト → 次回着手

---

## 禁止事項（全フェーズ共通）

1. UI側独自の必須判定を禁止 → completeness API を唯一の真実とする
2. Agencyから /subsidies への直接遷移を禁止 → 緑ヘッダー内で完結
3. source_type の許容値外を DB に入れない → CHECK制約で防止済み
4. employee_count <= 0 を許可しない → バリデーションで防止

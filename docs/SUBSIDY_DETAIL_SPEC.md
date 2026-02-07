# 補助金詳細画面 仕様書

**最終更新: 2026-02-06**
**ファイル: `src/pages/subsidies.tsx`**
**ルート: `/subsidies/:id`**

---

## 1. 画面構成

### 1.1 タブ構造

| タブ名 | ID | データソース | 説明 |
|--------|-----|-------------|------|
| 概要 | `tab-overview` | `normalized.overview` | 補助金の概要、対象事業、添付ファイル |
| 申請要件 | `tab-eligibility` | `/api/subsidies/:id/eligibility` | AUTO/MANUAL判定付きの要件一覧 |
| 対象経費 | `tab-expenses` | `/api/subsidies/:id/expenses` | 必須経費、経費カテゴリ、対象外経費 |
| 加点要素 | `tab-bonus` | `/api/subsidies/:id/bonus-points` + 静的コンテンツ | 公募要領からの加点項目 + 一般的な加点要素 |
| 必要書類 | `tab-documents` | `/api/subsidies/:id/documents` | 必要書類一覧（required/conditional/optional） |
| 様式 | `tab-forms` | `res.data.normalized.content.required_forms` または `res.data.required_forms` | 申請様式と記載項目 |
| マッチング結果 | `tab-evaluation` | `res.data.evaluation` | スコア、マッチ理由、リスクフラグ |

### 1.2 タブコンテンツの表示制御

```
重要: 各タブは以下の構造を持つ
- class="tab-content hidden" style="display:none" (非表示時)
- class="tab-content" style="display:block" (表示時)

switchTab() 関数で切り替え
- classList.add/remove('hidden')
- style.display = 'none' / 'block'
- 親要素のスタイルも調整
```

---

## 2. DOM構造（重要）

```html
<div id="subsidy-detail" class="hidden">  <!-- renderDetail()で表示 -->
  <!-- ヘッダー、基本情報 -->
  
  <div class="bg-white rounded-lg shadow">  <!-- タブコンテナ -->
    <div class="border-b">
      <nav class="flex -mb-px">
        <!-- タブボタン: onclick="switchTab('xxx')" data-tab="xxx" -->
      </nav>
    </div>
    
    <div class="p-6">  <!-- タブコンテンツコンテナ -->
      <div id="tab-overview" class="tab-content">...</div>
      <div id="tab-eligibility" class="tab-content hidden">...</div>
      <div id="tab-expenses" class="tab-content hidden">...</div>
      <div id="tab-bonus" class="tab-content hidden">
        <div id="bonus-from-koubo">...</div>  <!-- 動的 -->
        <div id="bonus-general">  <!-- 静的 -->
          <!-- 一般的な加点要素 -->
        </div>  <!-- ← この閉じタグを忘れない -->
      </div>  <!-- ← tab-bonus の閉じタグ -->
      <div id="tab-documents" class="tab-content hidden">...</div>
      <div id="tab-forms" class="tab-content hidden">...</div>
      <div id="tab-evaluation" class="tab-content hidden">...</div>
    </div>  <!-- p-6 終了 -->
  </div>  <!-- タブコンテナ終了 -->
  
  <!-- data-warning, cta-section -->
</div>
```

### ⚠️ 重大な注意点

1. **DIVの閉じタグは必ず対応させる** - 閉じ忘れると他タブにコンテンツが漏れる
2. **tab-content クラスを持つ要素は同一階層に配置** - ネストしない
3. **静的コンテンツと動的コンテンツを分離** - IDで管理

---

## 3. データフロー

### 3.1 ページロード時の処理順序

```javascript
// 1. loadDetail() が呼ばれる
loadDetail()
  ├── api('/api/subsidies/' + subsidyId + '?company_id=xxx')
  ├── subsidyData = res.data
  ├── renderDetail(res.data)  // ヘッダー、基本情報、evaluation表示
  │
  └── Promise.all([  // 並列実行
        loadEligibility(),   // → eligibility-list
        loadDocuments(),     // → documents-list
        loadExpenses(),      // → expenses-list
        loadBonusPoints(),   // → bonus-list
      ])
  │
  └── loadForms(res.data)    // → forms-list (APIレスポンス直下から取得)
  │
  └── checkAndShowDataWarning()  // 警告表示判定
```

### 3.2 各データソースの優先順位

#### 様式 (required_forms)
```javascript
// 優先順位:
// 1. normalized.content.required_forms (SSOT - 最優先)
// 2. res.data.required_forms (APIレスポンス直下 - 互換性)
// 3. res.data.detail_json.required_forms (detail_json内 - レガシー)
// 4. res.data.subsidy.required_forms (補助金オブジェクト内 - レガシー)
```

#### マッチング結果 (evaluation)
```javascript
// res.data.evaluation から取得
// company_id がある場合のみ evaluation_runs テーブルから取得
// status: PROCEED / CAUTION / NO
// score: 0-100
// match_reasons: string[]
// risk_flags: string[]
```

---

## 4. CSS仕様

### 4.1 タブ表示制御

```css
/* タブコンテンツ表示保証 */
.tab-content:not(.hidden) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  height: auto !important;
  min-height: 50px;
  overflow: visible !important;
}
```

### 4.2 Tailwind hidden クラス

```css
/* Tailwind CDN が提供 */
.hidden {
  display: none !important;
}
```

---

## 5. トラブルシューティング

### 5.1 タブコンテンツが表示されない

**チェックリスト:**
1. [ ] DOM要素が存在するか (`document.getElementById('tab-xxx')`)
2. [ ] `hidden` クラスが外れているか
3. [ ] `style.display` が `block` か
4. [ ] 親要素が `hidden` でないか
5. [ ] Console にエラーがないか

**デバッグコマンド (Console):**
```javascript
// 全タブの状態確認
document.querySelectorAll('.tab-content').forEach(el => {
  console.log(el.id, {
    hidden: el.classList.contains('hidden'),
    display: getComputedStyle(el).display,
    height: el.offsetHeight,
    innerHTML: el.innerHTML.length
  });
});
```

### 5.2 データはあるが表示されない

**原因と対策:**
1. **innerHTML が設定されていない** → Console ログで確認
2. **親要素の高さが0** → 親要素に `height: auto` を設定
3. **CSSで非表示** → `!important` で上書き

### 5.3 他タブにコンテンツが漏れる

**原因:** DIVの閉じタグ忘れ

**対策:**
1. HTMLの構造をインデントで確認
2. 各タブの開始・終了をコメントで明記
3. ブラウザのDevTools Elements タブで構造確認

---

## 6. API エンドポイント仕様

### GET /api/subsidies/:subsidy_id

**レスポンス:**
```typescript
{
  success: true,
  data: {
    normalized: NormalizedSubsidyDetail | null,  // v1.0 SSOT
    subsidy: SubsidyDetail,                       // レガシー互換
    evaluation: Evaluation | null,                // company_id指定時のみ
    required_forms: RequiredForm[],               // 様式データ
    detail_json: object | null,
    meta: {
      resolved_canonical_id: string,
      schema_version: '1.0'
    }
  }
}
```

### GET /api/subsidies/:subsidy_id/eligibility

**レスポンス:**
```typescript
{
  success: true,
  data: EligibilityRule[],  // category, rule_text, check_type, source
  meta: { source: 'normalized' | 'eligibility_rules_table' }
}
```

### GET /api/subsidies/:subsidy_id/documents

**レスポンス:**
```typescript
{
  success: true,
  data: RequiredDocument[],  // name, required_level, doc_code
  meta: { source: 'normalized' | 'required_documents_table' }
}
```

---

## 7. 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-02-06 | タブ表示問題修正、CSS強制表示ルール追加 |
| 2026-02-06 | 加点要素タブのDIV閉じタグ漏れ修正 |
| 2026-02-06 | switchTab関数にstyle.display直接設定追加 |
| 2026-02-06 | 本ドキュメント作成 |

---

## 8. 関連ファイル

- `src/pages/subsidies.tsx` - メインUI（一覧・詳細）
- `src/routes/subsidies.ts` - APIルート
- `src/lib/ssot/normalizeSubsidyDetail.ts` - データ正規化
- `src/lib/ssot/resolveSubsidyRef.ts` - ID解決

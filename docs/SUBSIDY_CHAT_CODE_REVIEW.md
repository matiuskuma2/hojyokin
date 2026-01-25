# 補助金検索・詳細画面・壁打ちチャット コードレビュー報告書

**日付**: 2026-01-25  
**レビュー対象**: 
- `src/pages/subsidies.tsx` (補助金検索・詳細 フロントエンド)
- `src/pages/chat.tsx` (壁打ちチャット フロントエンド)
- `src/routes/subsidies.ts` (補助金検索・詳細 API)
- `src/routes/chat.ts` (壁打ちチャット API)

**レビュー担当**: AI Assistant  
**レビュー基準**: コード品質ガイドライン7項目

---

## 1. エグゼクティブサマリー

### 総合評価: B+ (良好、一部改善推奨)

| 観点 | 評価 | コメント |
|------|------|----------|
| 入力の安全性 | ⚠️ 注意 | XSS対策は実装済みだが、一部漏れあり |
| ロジックの正確性 | ✅ 良好 | 主要フローは正常、エッジケース考慮要 |
| エラーハンドリング | ✅ 良好 | try-catch実装済み、一部改善余地 |
| 既存コードとの整合性 | ✅ 良好 | 命名規則・設計パターン統一 |
| セキュリティ | ⚠️ 注意 | 認証は適切、一部SQLi/XSSリスク |
| 設定・インフラ | ✅ 良好 | 環境変数・キャッシュ設定適切 |

---

## 2. Critical (P0) - 即時修正必須

### P0-1: XSS脆弱性 - eligibility/documents のエスケープ漏れ

**ファイル**: `subsidies.tsx` (L2373-2425)  
**重大度**: Critical  
**影響範囲**: 申請要件・必要書類タブ

**問題**:
```javascript
// loadEligibility() 内
return `
  <div class="flex items-center justify-between mb-2">
    <span class="font-medium text-gray-800">${rule.category || '一般'}</span>
    ...
  </div>
  <p class="text-sm text-gray-700">${rule.rule_text}</p>
  ${rule.source_text ? `<p class="text-xs text-gray-500 mt-1">出典: ${rule.source_text}</p>` : ''}
`;
```

`rule.category`, `rule.rule_text`, `rule.source_text` がエスケープされていない。
DBから取得したデータにHTML/JSが含まれる場合、XSS攻撃が成立。

**修正案**:
```javascript
return `
  <div class="flex items-center justify-between mb-2">
    <span class="font-medium text-gray-800">${escapeHtml(rule.category || '一般')}</span>
    ...
  </div>
  <p class="text-sm text-gray-700">${escapeHtml(rule.rule_text)}</p>
  ${rule.source_text ? `<p class="text-xs text-gray-500 mt-1">出典: ${escapeHtml(rule.source_text)}</p>` : ''}
`;
```

---

### P0-2: XSS脆弱性 - documentsのエスケープ漏れ

**ファイル**: `subsidies.tsx` (L2409-2424)

**問題**:
```javascript
// loadDocuments() 内
return `
  <div class="flex items-center justify-between p-3 border rounded-lg">
    <div class="flex items-center">
      ${levelIcon}
      <span class="ml-2 font-medium">${doc.name || doc.doc_code}</span>
    </div>
    <span class="text-xs text-gray-500">${doc.required_level}</span>
  </div>
`;
```

**修正案**:
```javascript
return `
  <div class="flex items-center justify-between p-3 border rounded-lg">
    <div class="flex items-center">
      ${levelIcon}
      <span class="ml-2 font-medium">${escapeHtml(doc.name || doc.doc_code)}</span>
    </div>
    <span class="text-xs text-gray-500">${escapeHtml(doc.required_level)}</span>
  </div>
`;
```

---

### P0-3: SQL インジェクションリスク - statusフィルタ

**ファイル**: `subsidies.ts` (L418-425)

**問題**:
```typescript
if (status) {
  query += ' AND er.status = ?';
  params.push(status);
}
```

`status` パラメータの値検証がない。
想定外の値（空文字、予期しない文字列）がクエリに渡される可能性。

**修正案**:
```typescript
const VALID_STATUSES = ['PROCEED', 'CAUTION', 'NO', 'DO_NOT_PROCEED'];
if (status && VALID_STATUSES.includes(status)) {
  query += ' AND er.status = ?';
  params.push(status);
}
```

---

## 3. High (P1) - 早期修正推奨

### P1-1: 境界値チェック不足 - limit/offset

**ファイル**: `subsidies.ts` (L73-74)

**問題**:
```typescript
const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 500);
const offset = parseInt(c.req.query('offset') || '0', 10);
```

- `limit` が負数の場合の処理がない
- `offset` が負数の場合の処理がない
- `NaN` の場合のフォールバックが不十分

**修正案**:
```typescript
const rawLimit = parseInt(c.req.query('limit') || '20', 10);
const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(rawLimit, 500);

const rawOffset = parseInt(c.req.query('offset') || '0', 10);
const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
```

---

### P1-2: escapeHtml関数の重複定義

**ファイル**: `subsidies.tsx` (L984-992, L1443-1452)

**問題**:
同一ファイル内で `escapeHtml` 関数が2回定義されている。
2つ目の定義が1つ目を上書きし、意図しない動作の原因となる可能性。

**修正案**:
1つ目の定義のみ残し、2つ目を削除。または共通ユーティリティに抽出。

---

### P1-3: 日付パース失敗時の例外処理

**ファイル**: `subsidies.tsx` (L2284-2285)

**問題**:
```javascript
const endDate = s.acceptance_end_datetime ? new Date(s.acceptance_end_datetime) : null;
const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
```

`new Date()` が不正な日付文字列を受け取ると `Invalid Date` を返し、
後続の計算で `NaN` になる可能性。

**修正案**:
```javascript
let endDate = null;
if (s.acceptance_end_datetime) {
  const parsed = new Date(s.acceptance_end_datetime);
  if (!isNaN(parsed.getTime())) {
    endDate = parsed;
  }
}
const daysLeft = endDate ? Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
```

---

### P1-4: chat.ts - MissingItem の priority が undefined になる可能性

**ファイル**: `chat.ts` (L258-264)

**問題**:
```typescript
missingItems.push({
  key: factKey,
  label: rule.rule_text || '要件を確認してください',
  input_type: determineInputType(rule.category),
  source: 'eligibility',
  priority: rule.category === 'must' ? 1 : 2
});
```

`rule.category` が `null` または `undefined` の場合、`priority` が常に `2` になる。
これは意図した動作かもしれないが、ドキュメント化が必要。

---

### P1-5: JSON.parse の例外処理不足

**ファイル**: `chat.ts` (L309, L858)

**問題**:
```typescript
const detailJson = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
// ...
const missingItems: MissingItem[] = JSON.parse(session.missing_items || '[]');
```

`JSON.parse` は不正なJSON文字列で例外をスローする。
`subsidy.detail_json` や `session.missing_items` が壊れたデータの場合、
APIがエラーを返す。

**修正案**:
```typescript
let detailJson = {};
try {
  if (subsidy.detail_json) {
    detailJson = JSON.parse(subsidy.detail_json);
  }
} catch (e) {
  console.warn('Invalid detail_json:', e);
}

let missingItems: MissingItem[] = [];
try {
  missingItems = JSON.parse(session.missing_items || '[]');
} catch (e) {
  console.warn('Invalid missing_items:', e);
}
```

---

## 4. Medium (P2) - 改善推奨

### P2-1: キャッシュキー衝突リスク

**ファイル**: `subsidies.ts` (L31-48)

**問題**:
簡易ハッシュ関数を使用しており、衝突の可能性がある。

```typescript
let hash = 0;
for (let i = 0; i < key.length; i++) {
  hash = ((hash << 5) - hash) + key.charCodeAt(i);
  hash = hash & hash;
}
return `subsidy-search-${Math.abs(hash).toString(36)}`;
```

**改善案**:
Cloudflare Workers で利用可能な `crypto.subtle.digest` を使用:
```typescript
async function generateSearchCacheKey(params): Promise<string> {
  const key = `search:${params.companyId}:...`;
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `subsidy-search-${hashHex.slice(0, 12)}`;
}
```

---

### P2-2: isMobile 判定のタイミング

**ファイル**: `subsidies.tsx` (L569)

**問題**:
```javascript
const isMobile = window.innerWidth < 640;
```

ページ読み込み時に一度だけ判定されるため、
画面サイズ変更時に反映されない。

**改善案**:
```javascript
function isMobile() {
  return window.innerWidth < 640;
}
// 使用時に毎回呼び出す
```

または、`renderResults` 内でチェック:
```javascript
function renderResults(results, meta) {
  const mobile = window.innerWidth < 640;
  // ...
}
```

---

### P2-3: セッションID検証の強化

**ファイル**: `chat.ts` (L739-749)

**問題**:
```typescript
const session = await c.env.DB.prepare(`
  SELECT cs.*, sc.title as subsidy_title
  FROM chat_sessions cs
  LEFT JOIN subsidy_cache sc ON cs.subsidy_id = sc.id
  WHERE cs.id = ? AND cs.user_id = ?
`).bind(sessionId, user.id).first();
```

`sessionId` が UUID 形式でない場合でもクエリが実行される。
形式検証を追加することで不正リクエストを早期拒否可能。

**改善案**:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(sessionId)) {
  return c.json<ApiResponse<null>>({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Invalid session ID format' }
  }, 400);
}
```

---

### P2-4: フロントエンドでの api 関数の定義待ち

**ファイル**: `subsidies.tsx` (L1747-1759)

**問題**:
```javascript
if (typeof window.api === 'function') {
  loadCompanies();
} else {
  setTimeout(() => {
    if (typeof window.api === 'function') {
      loadCompanies();
    } else {
      console.error('[補助金検索] window.api is not defined after timeout');
      showNoCompanyAlert();
    }
  }, 100);
}
```

100ms のタイムアウトは環境によって不十分な可能性。
また、タイムアウト後のエラーハンドリングがユーザーに分かりにくい。

**改善案**:
`DOMContentLoaded` イベントを使用:
```javascript
document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.api === 'function') {
    loadCompanies();
  } else {
    console.error('[補助金検索] window.api is not defined');
    showNoCompanyAlert();
  }
});
```

---

## 5. Low (P3) - 任意改善

### P3-1: 定数のハードコーディング

**ファイル**: `subsidies.ts` (L25)

```typescript
const SEARCH_CACHE_TTL = 120; // 2分
```

環境変数から読み込む方が柔軟:
```typescript
const SEARCH_CACHE_TTL = parseInt(c.env.SEARCH_CACHE_TTL || '120', 10);
```

---

### P3-2: 未使用変数の警告

**ファイル**: `subsidies.tsx` (L1377-1388)

```javascript
keywordInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (currentResults.length > 0) {
      // 既存の結果があればクライアント側フィルタのみ
      // 新規検索はEnterキーまたはボタンクリック時
    }
  }, 300);
});
```

空のコールバック内のコメントのみで処理がない。
実装予定のTODOか、不要なら削除。

---

### P3-3: コンソールログの本番環境での抑制

**ファイル**: 複数

開発用の `console.log` が多数存在。
本番環境では `DEBUG` フラグで制御するか、
`console.debug` を使用して本番では無効化。

---

## 6. 良好な実装パターン（参考）

### 6.1 XSS対策の実装

`subsidies.tsx` の多くの箇所で `escapeHtml()` が適切に使用されている:
```javascript
const safeTitle = escapeHtml(s.title || s.name || '補助金名未設定');
```

### 6.2 認証ミドルウェアの適用

`subsidies.ts`:
```typescript
subsidies.use('/*', requireAuth);
```

全エンドポイントに認証が必須になっている。

### 6.3 エラーレスポンスの一貫性

```typescript
return c.json<ApiResponse<null>>({
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'Company not found',
  },
}, 404);
```

一貫したエラーレスポンス形式が使用されている。

### 6.4 キャッシュ戦略

```typescript
const cache = caches.default;
const cacheUrl = new URL(`https://cache.internal/${cacheKey}`);
```

Cloudflare Cache APIを適切に活用。

---

## 7. テストケース提案

### 7.1 補助金検索API

| テストケース | 入力 | 期待結果 |
|-------------|------|----------|
| 正常検索 | company_id=valid, keyword=IT | 200, 結果リスト |
| company_id なし | keyword=IT | 400, VALIDATION_ERROR |
| 存在しない会社 | company_id=invalid | 404, NOT_FOUND |
| 負の limit | limit=-1 | 200, limit=20 (デフォルト) |
| 負の offset | offset=-10 | 200, offset=0 |
| 超大量データ | limit=1000 | 200, limit=500 (上限) |
| キャッシュヒット | 同一条件2回目 | 200, cached=true |

### 7.2 壁打ちチャットAPI

| テストケース | 入力 | 期待結果 |
|-------------|------|----------|
| セッション作成 | company_id, subsidy_id | 200, session_id |
| 必須パラメータなし | company_id のみ | 400, VALIDATION_ERROR |
| 存在しないセッション | session_id=invalid | 404, NOT_FOUND |
| 完了済みセッション | 完了後にメッセージ | 400, SESSION_COMPLETED |
| 空メッセージ | content="" | 400, VALIDATION_ERROR |

---

## 8. 修正優先度まとめ

| 優先度 | 件数 | 修正目標 |
|--------|------|----------|
| P0 (Critical) | 3件 | 即時 |
| P1 (High) | 5件 | 今スプリント |
| P2 (Medium) | 4件 | 次スプリント |
| P3 (Low) | 3件 | 任意 |

---

## 9. 次のアクション

1. **P0修正**:
   - `loadEligibility()` のエスケープ追加
   - `loadDocuments()` のエスケープ追加
   - `status` パラメータのバリデーション追加

2. **P1修正**:
   - limit/offset の境界値チェック
   - escapeHtml の重複削除
   - 日付パースの例外処理
   - JSON.parse の例外処理

3. **テスト追加**:
   - 上記テストケースの自動化

---

**レポート生成日時**: 2026-01-25  
**最終更新**: v1.0

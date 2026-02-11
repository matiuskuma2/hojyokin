# Phase 22: E2Eデータフロー分析・BUG修正レポート

**日付**: 2026-02-11
**対象**: 補助金検索 → 壁打ちチャット → ドラフト生成 全フロー

---

## 1. E2Eフローマッピング

```
[ダッシュボード]     [補助金一覧]        [補助金詳細]       [壁打ちチャット]      [ドラフト生成]
  /dashboard    →    /subsidies     →   /subsidies/:id  →   /chat           →    /draft
      |                   |                    |                  |                   |
      |         subsidy_id, company_id         |                  |                   |
      |              URLクエリ                  |    subsidy_id    |    session_id     |
      |                   |                    |    company_id    |    URLクエリ      |
      v                   v                    v    URLクエリ     v                   v
  /api/drafts       /api/subsidies       /api/subsidies   /api/chat/sessions   /api/draft/generate
  (GET一覧)         /search              /:id             POST(新規)            POST
                                                          GET(再開)             
                                                          POST /:id/message    /api/draft/:id
                                                          POST /:id/upload     PUT(保存)
                                                                               POST /finalize
```

### データキー受け渡し

| 遷移元 → 遷移先 | パラメータ | 方法 | 整合性 |
|:---|:---|:---|:---|
| 補助金一覧 → 壁打ち | `subsidy_id`, `company_id` | URLクエリ | OK |
| 補助金詳細 → 壁打ち | `subsidy_id`, `company_id` | encodeURIComponent | OK |
| 壁打ち → ドラフト | `session_id` | URLクエリ (`goToDraft()`) | OK |
| ドラフト → 壁打ち戻り | `session_id` | encodeURIComponent | OK |
| 壁打ち再開 | `session_id` → API → `subsidy_id`, `company_id` | セッションDBから復元 | OK (BUG-4修正済) |
| ダッシュボード → ドラフト | `session_id` (動的) | API結果から直近ドラフトのsession_idを設定 | OK (BUG-2修正済) |

---

## 2. 修正済みバグ

### BUG-1: `/api/drafts` が 404 (解決済み)
- **場所**: `src/pages/dashboard.tsx:753` → `src/routes/draft.ts`
- **原因**: ダッシュボードが `/api/drafts` (複数形) を呼ぶが、マウントは `/api/draft` のみ
- **修正**: GET `/api/draft` (一覧) エンドポイント追加 + `/api/drafts` を互換マウント

### BUG-2: ダッシュボード「ドラフトを見る→」リンク壊れ (解決済み)
- **場所**: `src/pages/dashboard.tsx:521`
- **原因**: `href="/draft"` — session_idなしでアクセスするとalert → /subsidiesへリダイレクト
- **修正**: APIレスポンスから直近ドラフトの`session_id`を取得し動的にリンクに設定

### BUG-4: 壁打ちセッション再開時に補助金概要パネル非表示 (解決済み)
- **場所**: `src/pages/chat.tsx:688-711`
- **原因**: `isResumeMode=true`時、`subsidyId=null`のまま`loadSubsidyOverview()`が呼ばれる
- **修正**: セッション取得後に`subsidyId`設定完了してから概要パネルを読み込むよう順序変更

---

## 3. AIコンシェルジュと資料作成の整合性

### フロー上の位置づけ

```
構造化質問フェーズ (status: collecting)
  ├── facts蓄積 → chat_facts テーブル
  ├── 全質問回答で完了
  └── 「申請書作成」ボタン表示
                ↓
コンシェルジュモード (status: consulting)
  ├── 自由質問 → chat_messages テーブルのみ
  ├── 提案質問ボタン
  └── 「申請書を作成」ボタン（常時表示）
                ↓
ドラフト生成 (/draft?session_id=...)
  ├── chat_facts → DraftGenerationContext.facts
  ├── company/company_profile → 企業情報
  ├── getNormalizedSubsidyDetail → SSOT補助金情報
  └── company_documents → アップロード済み書類
```

### 整合性評価

| 連携ポイント | 状態 | 備考 |
|:---|:---|:---|
| facts → ドラフト自動反映 | OK | `chat_facts` → `generateDraft()` context |
| 補助金ID一貫性 | OK | `chat_sessions.subsidy_id` = `application_drafts.subsidy_id` |
| SSOT参照 | OK | 壁打ち/ドラフト双方で `getNormalizedSubsidyDetail()` |
| アップロード書類反映 | OK | `company_documents` → チェックリスト |
| コンシェルジュ自由回答 | 非反映 | 設計方針。自由回答は構造化困難。将来的にキーワード抽出を検討 |

---

## 4. UX/データフロー欠陥と改善提案

| # | 欠陥 | 重大度 | 改善案 | 状態 |
|:---|:---|:---|:---|:---|
| 1 | ダッシュボードからドラフト直接アクセス不可 | 高 | ドラフト一覧ページ新設 or テーブル表示 | **修正済** (暫定: 直近リンク) |
| 2 | `/api/drafts` エンドポイント欠如 | 高 | GET一覧エンドポイント追加 | **修正済** |
| 3 | 壁打ち再開時の概要パネル非表示 | 中 | loadSubsidyOverview呼出順序修正 | **修正済** |
| 4 | suggestedQuestionsのXSS潜在リスク | 中 | data属性+addEventListener方式に変更 | TODO |
| 5 | ドラフト「再生成」がfinalizeで消す設計 | 低 | version管理で履歴保持 | TODO |
| 6 | コンシェルジュ回答のfacts未反映 | 低 | キーワード抽出を将来的に検討 | 設計方針 |

---

## 5. コード品質チェック

| 基準 | 評価 | 詳細 |
|:---|:---|:---|
| 入力安全性 | A | encodeURIComponent, UUID検証, escapeHtml |
| 認証 | A | requireAuth全エンドポイント, 401自動ログアウト |
| 認可 | A | user_idフィルタ |
| エラーハンドリング | B+ | API側try-catch網羅、フロント一部catch不足 |
| XSS対策 | B | escapeHtml使用、onclickインライン生成に注意 |
| セキュリティ | B- | **Cloudflare APIキー露出報告あり → 即時ローテーション推奨** |

---

## 6. テストケース

### TC-1: 新規フロー (E2E)
1. `/subsidies` で補助金を検索
2. 「壁打ち」ボタンクリック → `/chat?subsidy_id=X&company_id=Y`
3. 構造化質問に回答 (facts蓄積)
4. 完了後「申請書作成」→ `/draft?session_id=Z`
5. ドラフトにfactsが反映されていることを確認
- **期待結果**: 全データが補助金IDに紐づいて一貫

### TC-2: セッション再開フロー
1. `/chat?session_id=<existing>` で壁打ちを再開
2. 補助金概要パネルが正しく表示される
3. 追加質問に回答
4. 「申請書作成」→ ドラフトに追加情報が反映
- **期待結果**: 概要パネル表示 + facts追加反映

### TC-3: ダッシュボード→ドラフトリンク
1. ダッシュボードにアクセス
2. ドラフトカウントが正しい数値を表示
3. 「ドラフトを見る→」リンクにsession_idが付与
4. クリック → ドラフト画面が正常表示
- **期待結果**: 404/alertなしで遷移

### TC-4: コンシェルジュ→ドラフト整合性
1. 壁打ち完了後にコンシェルジュモードへ切替
2. 質問・回答後に「申請書作成」クリック
3. ドラフトのcollected_infoセクションにfactsが反映
- **期待結果**: 構造化質問のfactsは反映、自由回答はchat_messagesのみ

---

## 7. 残課題・推奨次ステップ

1. **🔴 即時**: Cloudflare APIキーのローテーション
2. **🟡 短期**: suggestedQuestionsのXSS対策強化 (data属性方式)
3. **🟡 短期**: ドラフト一覧ページの本格実装 (複数ドラフト切替対応)
4. **🟢 中期**: コンシェルジュ回答からのキーワード抽出→facts化
5. **🟢 中期**: ドラフトversion管理と差分表示

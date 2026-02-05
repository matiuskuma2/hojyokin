# 壁打ち機能 フロントエンド修正ガイド

## 問題報告

### 1. 質問表示の問題
- **症状**: すべての質問が「はい」「いいえ」（Yes/No）ボタンで表示される
- **期待される動作**: 質問の `input_type` に応じて適切なUIコンポーネントを表示
  - `boolean` → Yes/No ボタン
  - `number` → 数値入力フィールド
  - `text` → テキストエリア
  - `select` → ドロップダウン（optionsを使用）

### 2. 会社情報/補助金情報が「-」表示
- **症状**: 画面下部の会社情報（会社名、所在地、従業員数）と補助金情報（補助上限、申請締切）が「-」のまま
- **期待される動作**: APIレスポンスの `precheck.company_info` と `precheck.subsidy_info` を表示

## APIレスポンス構造

### POST /api/chat/sessions レスポンス

\`\`\`json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "status": "collecting",
      "precheck_result": {
        "status": "OK_WITH_MISSING",
        "eligible": true,
        "blocked_reasons": [],
        "missing_items": [
          {
            "key": "wc_SHORYOKUKA-IPPAN-05_q_0",
            "label": "従業員数は何名ですか？",
            "input_type": "number",    // ← これを参照
            "source": "eligibility",
            "priority": 5
          },
          {
            "key": "wc_SHORYOKUKA-IPPAN-05_q_1",
            "label": "業種は何ですか？中小企業基本法の定義に該当しますか？",
            "input_type": "text",      // ← これを参照
            "source": "eligibility",
            "priority": 5
          },
          {
            "key": "wc_SHORYOKUKA-IPPAN-05_q_4",
            "label": "直近2期分の決算書はありますか？",
            "input_type": "boolean",   // ← これを参照
            "source": "eligibility",
            "priority": 5
          }
        ],
        "subsidy_info": {
          "id": "SHORYOKUKA-IPPAN-05",
          "title": "中小企業省力化投資補助金（一般型）第5回公募",
          "acceptance_end": "2025-01-30T17:00:00",
          "max_amount": 80000000
        },
        "company_info": {
          "id": "company-uuid",
          "name": "株式会社サンプル",
          "prefecture": "東京都",
          "employee_count": 50
        },
        "electronic_application": {
          "is_electronic": true,
          "system_name": "jGrants",
          "url": "https://jgrants.go.jp"
        }
      }
    },
    "messages": [...],
    "precheck": { /* precheck_resultと同じ内容 */ },
    "is_new": true
  }
}
\`\`\`

## フロントエンド修正箇所

### 1. 質問UIコンポーネントの切り替え

\`\`\`tsx
// 例: React コンポーネント
function QuestionInput({ item }: { item: MissingItem }) {
  switch (item.input_type) {
    case 'boolean':
      return (
        <div className="flex gap-4">
          <button onClick={() => handleAnswer('はい')}>はい</button>
          <button onClick={() => handleAnswer('いいえ')}>いいえ</button>
        </div>
      );
    
    case 'number':
      return (
        <input 
          type="number" 
          placeholder="数値を入力" 
          onChange={(e) => handleAnswer(e.target.value)}
        />
      );
    
    case 'text':
      return (
        <textarea 
          placeholder="自由に回答してください"
          onChange={(e) => handleAnswer(e.target.value)}
        />
      );
    
    case 'select':
      return (
        <select onChange={(e) => handleAnswer(e.target.value)}>
          <option value="">選択してください</option>
          {item.options?.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      );
    
    default:
      return <textarea placeholder="回答を入力" />;
  }
}
\`\`\`

### 2. 会社情報・補助金情報の表示

\`\`\`tsx
function SessionInfo({ precheck }: { precheck: PrecheckResult }) {
  const { company_info, subsidy_info } = precheck;
  
  return (
    <div className="session-info">
      <h3>会社情報</h3>
      <dl>
        <dt>会社名</dt>
        <dd>{company_info?.name || '-'}</dd>
        <dt>所在地</dt>
        <dd>{company_info?.prefecture || '-'}</dd>
        <dt>従業員数</dt>
        <dd>{company_info?.employee_count ? \`\${company_info.employee_count}名\` : '-'}</dd>
      </dl>
      
      <h3>補助金情報</h3>
      <dl>
        <dt>補助上限</dt>
        <dd>{subsidy_info?.max_amount ? formatCurrency(subsidy_info.max_amount) : '-'}</dd>
        <dt>申請締切</dt>
        <dd>{subsidy_info?.acceptance_end ? formatDate(subsidy_info.acceptance_end) : '-'}</dd>
      </dl>
    </div>
  );
}
\`\`\`

## input_type の推測ルール（バックエンドで実装済み）

バックエンドの `inferInputTypeFromQuestion` 関数で以下のルールを適用：

| パターン | 推測される input_type |
|----------|----------------------|
| 「何名」「いくら」「何円」「何時間」「資本金」「従業員数」等を含む | `number` |
| 「ですか？」「ありますか？」で終わり、「何」「どのような」等を含まない | `boolean` |
| 上記以外 | `text` |

**注意**: `select` は自動推測されない。`options` が明示的に指定されている場合のみ使用。

## テスト用質問と期待されるinput_type

| 質問 | 期待される input_type |
|------|----------------------|
| 従業員数は何名ですか？ | `number` |
| 業種は何ですか？中小企業基本法の定義に該当しますか？ | `text` |
| 現在の従業員1人当たりの平均給与はいくらですか？ | `number` |
| 導入予定の設備・システムは何ですか？ | `text` |
| 直近2期分の決算書はありますか？ | `boolean` |
| GビズIDプライムアカウントは取得済みですか？ | `boolean` |

## バックエンドのコードレビュー結果

- ✅ `normalizeSubsidyDetail.ts` の `inferInputTypeFromQuestion` は正しく動作
- ✅ `chat.ts` の `generateAdditionalQuestions` は `input_type` を正しく設定
- ✅ `formatQuestion` は `input_type` に応じたガイドメッセージを追加
- ✅ APIレスポンスに `missing_items[].input_type` が含まれる

## 結論

**バックエンドは正しく動作しています。**

フロントエンドが以下を実装する必要があります：
1. `precheck.missing_items[].input_type` を参照してUIコンポーネントを切り替える
2. `precheck.company_info` と `precheck.subsidy_info` を画面に表示する

---
作成日: 2026-02-05
バックエンドバージョン: v4.5.0

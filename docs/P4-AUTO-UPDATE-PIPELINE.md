# P4: 公募要領自動更新パイプライン設計書

## 概要

公募要領PDFの変更を検知し、補助金データを自動更新するパイプラインの設計。
手動登録した補助金（source: manual）のデータ鮮度を維持するために必要。

## 課題

1. **手動登録データの陳腐化**: 公募要領が更新されると手動登録データが古くなる
2. **更新検知の難しさ**: JGrants APIには変更通知機能がない
3. **差分検出**: どの項目が変更されたか特定が必要
4. **審査基準の変更**: 補助率・上限額・締切日などの変更を迅速に反映

## パイプライン設計

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                    定期実行トリガー (Cron)                        │
│                    毎日 09:00 JST                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Phase 1: ソース検査                             │
│                                                                 │
│  1. subsidy_cache から source='manual' のレコードを取得         │
│  2. 各レコードの official_url から最新のHTMLを取得              │
│  3. PDFリンクの変更（更新日付・ファイル名）を検出               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Phase 2: 変更検出                               │
│                                                                 │
│  1. PDFのハッシュ値を計算（既存 vs 最新）                       │
│  2. content_hash が異なる場合、変更ありとマーク                 │
│  3. 変更検出ログを update_detection_log に記録                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 変更あり
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Phase 3: 差分抽出                               │
│                                                                 │
│  1. 新しいPDFをダウンロード                                     │
│  2. Claude APIでPDF解析（テキスト抽出・構造化）                 │
│  3. 既存 detail_json と比較、差分を生成                         │
│  4. diff_json として変更点を記録                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Phase 4: 自動/手動判定                          │
│                                                                 │
│  【自動更新対象】                                                │
│  - 締切日の変更                                                 │
│  - 公式URLの変更                                                │
│  - 添付ファイルの追加・更新                                     │
│                                                                 │
│  【手動確認対象】                                                │
│  - 補助率の変更                                                 │
│  - 補助上限額の変更                                             │
│  - 申請要件の変更                                               │
│  - 対象経費の変更                                               │
│  - 加点項目の変更                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Phase 5: 適用                                   │
│                                                                 │
│  【自動適用】                                                    │
│  1. subsidy_cache.detail_json を更新                            │
│  2. subsidy_snapshot に新スナップショット追加                   │
│  3. 変更通知を管理者に送信                                      │
│                                                                 │
│  【手動確認待ち】                                                │
│  1. pending_updates テーブルに保存                              │
│  2. 管理者に通知（Slack/Email）                                 │
│  3. 管理画面で承認/却下                                         │
└─────────────────────────────────────────────────────────────────┘
```

### データベーススキーマ

```sql
-- 更新検出ログ
CREATE TABLE update_detection_log (
  id TEXT PRIMARY KEY,
  subsidy_id TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_url TEXT,
  old_content_hash TEXT,
  new_content_hash TEXT,
  changes_detected TEXT,  -- JSON: ['deadline', 'rate', 'limit', ...]
  status TEXT DEFAULT 'pending',  -- pending, applied, rejected, error
  applied_at TEXT,
  applied_by TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 保留中の更新
CREATE TABLE pending_updates (
  id TEXT PRIMARY KEY,
  detection_log_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  confidence REAL,
  source_text TEXT,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (detection_log_id) REFERENCES update_detection_log(id)
);

-- 更新通知
CREATE TABLE update_notifications (
  id TEXT PRIMARY KEY,
  detection_log_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,  -- slack, email, in_app
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TEXT,
  status TEXT DEFAULT 'pending',  -- pending, sent, failed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### API エンドポイント

```typescript
// 管理者向けAPI

// 検出された更新一覧
GET /api/admin/updates/pending
Response: {
  success: true,
  data: [{
    id: string,
    subsidy_id: string,
    subsidy_title: string,
    changes: [{
      field: string,
      old_value: any,
      new_value: any,
      confidence: number
    }],
    detected_at: string
  }]
}

// 更新を承認
POST /api/admin/updates/:id/approve
Body: { apply_all?: boolean, fields?: string[] }
Response: { success: true, applied_fields: string[] }

// 更新を却下
POST /api/admin/updates/:id/reject
Body: { reason: string }
Response: { success: true }

// 手動で更新チェックを実行
POST /api/admin/updates/check
Body: { subsidy_id?: string }
Response: { success: true, checked_count: number, changes_found: number }
```

### 実装ステップ

#### Phase 1: 基盤構築（優先度: 高）

1. **マイグレーション作成**
   - update_detection_log テーブル
   - pending_updates テーブル
   - update_notifications テーブル

2. **PDF変更検出ワーカー**
   - Cloudflare Workers Cron Triggers で定期実行
   - PDF URLからハッシュ値計算（HEAD リクエストで Content-Length + Last-Modified）
   - 変更検出時はログに記録

#### Phase 2: 差分抽出（優先度: 中）

1. **PDF解析ジョブ**
   - 既存の /api/jobs/subsidies/:id/ingest を拡張
   - 差分計算ロジック追加
   - 変更種別の自動分類

2. **自動更新ルール**
   - 締切日変更: 自動適用
   - URL変更: 自動適用
   - 金額変更: 手動確認
   - 要件変更: 手動確認

#### Phase 3: 通知・管理画面（優先度: 低）

1. **通知システム**
   - Slack Webhook連携
   - Email通知（SendGrid等）
   - アプリ内通知

2. **管理画面**
   - 保留更新一覧
   - 差分プレビュー
   - 一括承認/却下

### Cron設定（wrangler.jsonc）

```jsonc
{
  "triggers": {
    "crons": [
      "0 0 * * *"  // 毎日 09:00 JST (UTC 0:00)
    ]
  }
}
```

### 実装例: 変更検出ワーカー

```typescript
// src/workers/update-checker.ts

export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    console.log('[UpdateChecker] Started at', new Date().toISOString());
    
    // source='manual' の補助金を取得
    const manualSubsidies = await env.DB.prepare(`
      SELECT id, title, detail_json
      FROM subsidy_cache
      WHERE source = 'manual' AND is_visible = 1
    `).all();
    
    let checkedCount = 0;
    let changesFound = 0;
    
    for (const subsidy of manualSubsidies.results || []) {
      try {
        const detail = JSON.parse(subsidy.detail_json || '{}');
        const pdfUrl = detail.koubo_pdf_url;
        
        if (!pdfUrl) continue;
        
        // HEADリクエストでメタデータ取得
        const response = await fetch(pdfUrl, { method: 'HEAD' });
        const lastModified = response.headers.get('Last-Modified');
        const contentLength = response.headers.get('Content-Length');
        
        // 新しいハッシュを計算
        const newHash = `${lastModified}-${contentLength}`;
        const oldHash = detail.content_hash;
        
        if (newHash !== oldHash) {
          // 変更を検出
          await env.DB.prepare(`
            INSERT INTO update_detection_log (
              id, subsidy_id, source_url, old_content_hash, new_content_hash
            ) VALUES (?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            subsidy.id,
            pdfUrl,
            oldHash,
            newHash
          ).run();
          
          changesFound++;
          
          // 管理者に通知（TODO: Slack/Email）
          console.log(`[UpdateChecker] Change detected for ${subsidy.title}`);
        }
        
        checkedCount++;
      } catch (e) {
        console.error(`[UpdateChecker] Error checking ${subsidy.id}:`, e);
      }
    }
    
    console.log(`[UpdateChecker] Completed: ${checkedCount} checked, ${changesFound} changes`);
  }
};
```

### 監視項目

| 項目 | 閾値 | アラート |
|------|------|----------|
| 検出エラー率 | > 10% | Slack通知 |
| 保留更新数 | > 10件 | 管理者通知 |
| 更新適用遅延 | > 24時間 | 管理者通知 |
| PDF取得失敗 | 連続3回 | サイト停止の可能性を警告 |

### ロードマップ

| Phase | 内容 | 期間 | 依存 |
|-------|------|------|------|
| P4-1 | DBスキーマ・基盤API | 1週間 | なし |
| P4-2 | 変更検出ワーカー（Cron） | 1週間 | P4-1 |
| P4-3 | 差分抽出・自動更新 | 2週間 | P4-2 |
| P4-4 | 通知・管理画面 | 2週間 | P4-3 |

### リスクと対策

1. **サイト構造変更によるスクレイピング失敗**
   - 対策: 複数のセレクタパターンを用意、失敗時は手動チェック

2. **PDF解析精度**
   - 対策: 信頼度スコアが低い場合は手動確認へ

3. **APIコスト増加**
   - 対策: 変更検出は軽量なHEADリクエスト、解析は変更時のみ

4. **誤検出による誤更新**
   - 対策: 重要項目（金額・率）は必ず手動確認

---

## 次のアクション

1. [x] 設計書作成
2. [ ] P4-1: DBマイグレーション作成
3. [ ] P4-2: 変更検出ワーカー実装
4. [ ] P4-3: 差分抽出ロジック実装
5. [ ] P4-4: 管理画面実装

---

*作成日: 2026-02-05*
*最終更新: 2026-02-05*

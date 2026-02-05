# 補助金・助成金 自動マッチング＆申請書作成支援システム (ホジョラク)

## 📋 プロジェクト概要

- **Name**: subsidy-matching (hojyokin)
- **Version**: 3.4.0
- **Goal**: 企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング＆申請書ドラフト作成

### 🎉 最新アップデート (v4.3.0) - NormalizedSubsidyDetail v1.0 Freeze + Phase A完了

**v4.3.0 リリース（2026-02-05）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **Phase A-1 完了** | ✅ | resolveSubsidyRef.ts（SSOT ID解決）+ normalizeSubsidyDetail.ts（5制度マッピング） |
| **Phase A-2 完了** | ✅ | フロントエンド normalized 完全参照へ切替 |
| **NormalizedSubsidyDetail v1.0** | ✅ Freeze | 詳細API `/api/subsidies/:id` に normalized 追加（互換維持） |
| **resolveSubsidyRef** | ✅ Freeze | canonical_id/cache_id 問題の根絶、唯一の入口として凍結 |

**Phase A-1/A-2 成果物:**
| ファイル | 役割 |
|----------|------|
| `src/lib/ssot/resolveSubsidyRef.ts` | SSOT ID解決（canonical_id/cache_id 両対応） |
| `src/lib/ssot/normalizeSubsidyDetail.ts` | 5制度マッピング（IT導入/省力化/持続化/業務改善/ものづくり） |
| `src/lib/ssot/index.ts` | SSOT モジュール エクスポート |

**NormalizedSubsidyDetail 構造（v1.0 Freeze）:**
```typescript
interface NormalizedSubsidyDetail {
  schema_version: '1.0';
  ids: { input_id, canonical_id, cache_id, snapshot_id };
  source: { primary_source_type, primary_source_id, links };
  acceptance: { is_accepting, acceptance_start, acceptance_end };
  display: { title, issuer_name, target_area_text, subsidy_max_limit, subsidy_rate_text };
  overview: { summary, purpose, target_business };
  electronic_application: { is_electronic_application, portal_name, portal_url };
  wall_chat: { mode, ready, missing, questions };
  content: { eligibility_rules, eligible_expenses, required_documents, bonus_points, required_forms, attachments };
  provenance: { koubo_source_urls, pdf_urls, pdf_hashes, last_normalized_at };
}
```

**APIレスポンス変更点:**
```json
{
  "success": true,
  "data": {
    "normalized": { /* NormalizedSubsidyDetail v1.0 */ },
    "subsidy": { /* legacy（互換用、将来削除予定）*/ },
    "attachments": [...],
    "evaluation": {...},
    "meta": {
      "resolved_canonical_id": "...",
      "resolved_cache_id": "...",
      "schema_version": "1.0"
    }
  }
}
```

**フロントエンド変更点（Phase A-2）:**
- `renderDetail()`: normalized.display/acceptance/overview 優先参照
- 基本情報（締切、上限、補助率、対象地域）を normalized 優先に変更
- 概要・対象事業を normalized.overview 優先に変更
- 添付ファイルを normalized.content.attachments 優先に変更
- legacy `data.subsidy` は fallback として維持（互換期間）

**Phase A-3（保留）:** 他API（eligibility/documents/expenses/bonus）を normalized 経由へ統一

---

### 🎉 過去アップデート (v4.2.0) - Ready率52%達成 + Cron完全自動化 + fallback v2

**v4.2.0 リリース（2026-01-28）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **Ready率52.2%達成** | ✅ | 1,511件 Ready（目標50%超過達成）|
| **Cron完全自動化** | ✅ | Cloudflare Workers Cron Triggers で日次実行 |
| **fallback v2** | ✅ | 品質向上フィールド（target_area_scope, subsidy_rate_v2等）|
| **3フェーズパイプライン** | ✅ | v1補完 → recalc → v2生成の統合処理 |

**Ready率推移:**
| 日付 | Ready | Ready率 | 主な施策 |
|------|-------|---------|----------|
| 2026-01-26 | 80 | 2.8% | 初期状態 |
| 2026-01-28 AM | 1,446 | 50.0% | apply-field-fallbacks 実装 |
| **2026-01-28 PM** | **1,511** | **52.2%** | **fallback v2 + Cron自動化** |

**Cron Workers構成（v4.2）:**
| Worker | スケジュール | 役割 |
|--------|------------|------|
| `hojyokin-cron` | 03:00 JST (18:00 UTC) | フルパイプライン（Registry + Ready Boost 3フェーズ）|
| `hojyokin-cron` | 05:00 JST (20:00 UTC) | Ready Boost のみ（追加実行）|
| `hojyokin-cron-feed` | 06:00 JST (21:00 UTC) | J-Net21 + jGrants sync/enrich |
| `hojyokin-queue-cron` | 5分ごと | extraction_queue enqueue/consume |

**Ready Boost 3フェーズパイプライン:**
```
Phase 1: apply-field-fallbacks
  └─ application_requirements 補完（JGrants APIから）
  └─ eligible_expenses 補完（タイトルから推定）

Phase 2: recalc-wall-chat-ready
  └─ required_documents 補完（デフォルト5項目）
  └─ 除外判定（古い年度、受付終了）

Phase 3: generate-fallback-v2（NEW）
  └─ target_area_scope/display（workflows SSoT）
  └─ subsidy_rate_v2（構造化：type/percent/display）
  └─ subsidy_max_v2（金額フォーマット）
  └─ eligible_expenses_v2（use_purpose優先）
  └─ application_requirements_v2（対象者要件中心）
```

**データ状況（v4.2）:**
| Metric | Count | Percent | 備考 |
|--------|-------|---------|------|
| Total Active | 2,894 | 100% | jGrants受付中制度 |
| **Ready** | **1,511** | **52.2%** | ✅ 目標達成 |
| Excluded | 702 | 24.3% | 古い年度/受付終了 |
| Not Ready | 681 | 23.5% | 情報不足 |
| **V2 Fallback** | **1,511** | **52.2%** | Ready全件にv2適用 |

### 📋 v4.1.0 - Cron自動化 + apply-field-fallbacks

**v4.1.0 リリース（2026-01-28）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **apply-field-fallbacks** | ✅ | application_requirements/eligible_expenses の自動補完 |
| **daily-ready-boost** | ✅ | 統合Cronエンドポイント（Pages API）|
| **Ready Boost Worker** | ✅ | hojyokin-cron に統合、日次自動実行 |
| **Ready率50%達成** | ✅ | 80件 → 1,469件 (+1,389件) |

**fallback補完ルール:**
| フィールド | ソース | ロジック |
|-----------|--------|----------|
| application_requirements | JGrants API | target_number_of_employees + target_industry + 基本要件 |
| eligible_expenses | タイトル推定 | 設備系/IT系/環境系/人材系/販路系/創業系/その他 |
| required_documents | デフォルト | 公募要領/申請書/事業計画書/見積書/会社概要 |

### 📋 v4.0.0 - jGrants V2 + OpenAI PDF抽出 + Cron統合

**v4.0.0 リリース（2026-01-26）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **jGrants V2 API** | ✅ | 125件エンリッチ済み、workflow/PDF URL抽出 |
| **OpenAI PDF抽出** | ✅ | Firecrawl + GPT-4o-miniで構造化データ抽出 |
| **extract_pdf ハンドラー** | ✅ | consume-extractions で PDF→構造化データ変換 |
| **Cron Workers統合** | ✅ | 重複Worker削除、既存Workerに機能統合 |

### 📋 v3.4.0 - APIコスト会計凍結

**v3.4.0 リリース（2026-01-25）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **api_cost_logs** | ✅ | 実数コスト記録テーブル（Freeze-COST-0: 唯一の真実） |
| **コストwrapper** | ✅ | Firecrawl/Vision OCR の直 fetch 禁止、wrapper 経由必須 |
| **super_admin集計API** | ✅ | GET /api/admin-ops/cost/summary, /cost/logs |
| **凍結仕様書** | ✅ | docs/COST_ACCOUNTING_FREEZE_SPEC.md |

**コスト会計凍結ルール（Freeze-COST-0〜4）:**
| ルール | 内容 |
|--------|------|
| Freeze-COST-0 | api_cost_logs が唯一の真実、super_admin はこれのみ表示 |
| Freeze-COST-1 | 推定値禁止、実数のみ集計・表示 |
| Freeze-COST-2 | 外部API呼び出しは wrapper 経由必須 |
| Freeze-COST-3 | 失敗時もコスト記録（credits消費は発生） |
| Freeze-COST-4 | モデル名/単価は metadata_json に保持 |

### 📋 v3.3.0 - Workers Cron + 検索キャッシュ + 実処理稼働

**v3.3.0 リリース（2026-01-25）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **Workers Cron稼働** | ✅ | 5分ごと自動消化（https://hojyokin-queue-cron.sekiyadubai.workers.dev） |
| **検索APIキャッシュ** | ✅ | Cache API 120秒TTL（同接1000対応） |
| **enrich_jgrants/shigoto** | ✅ | consume-extractionsでjob_type別実処理を実装 |
| **shard_key crc32統一** | ✅ | 偏り対策で分布を均等化 |

### 📋 v3.2.0 - Shard/Queue化 + 電子申請対応 + Cooldownガード

| 項目 | 状態 | 詳細 |
|------|------|------|
| **Shard/Queue化** | ✅ | 17,000件運用対応。16分割shard + リース機構 |
| **電子申請検出** | ✅ | jGrants/東京都電子申請/GビズID/ミラサポ/e-Gov 自動検出 |
| **Cooldownガード** | ✅ | Firecrawl 6h / Vision OCR 24h で二重課金防止 |
| **extraction_queue** | ✅ | 抽出ジョブキュー（優先度付き、リース/回収機構） |
| **admin-ops管理API** | ✅ | super_admin向けキュー管理（enqueue/consume/retry） |
| **電子申請wall_chat_ready** | ✅ | 電子申請は 3/5 スコアで壁打ち可能（様式不要） |

**アーキテクチャ概要（v3.2）:**

```
┌─────────────────────────────────────────────────────────────────┐
│  17,000件運用アーキテクチャ（同接1000対応）                      │
├─────────────────────────────────────────────────────────────────┤
│  ① DB重複防止: dedupe_key UNIQUE                               │
│  ② 内容差分: content_hash で変更なしをスキップ                  │
│  ③ API課金: Cooldownガード（Firecrawl 6h / Vision 24h）        │
├─────────────────────────────────────────────────────────────────┤
│  Shard/Queue設計:                                               │
│  ├─ extraction_queue テーブル（16分割shard）                    │
│  ├─ リース機構（lease_owner + lease_until）で並行安全          │
│  ├─ 失敗時自動リトライ（max_attempts=5）                        │
│  └─ job_type別優先度（extract_forms:50, enrich:60-70）         │
├─────────────────────────────────────────────────────────────────┤
│  Cron設計:                                                      │
│  ├─ 1回で全件処理せず、shard単位で進行                         │
│  ├─ MAX_ITEMS_PER_RUN=10（タイムアウト対策）                    │
│  ├─ MAX_FIRECRAWL_CALLS=5, MAX_VISION_CALLS=1                   │
│  └─ 予算内で自動停止（cooldown + 1回あたり上限）               │
└─────────────────────────────────────────────────────────────────┘
```

**電子申請検出パターン:**
| システム | パターン | URLパターン |
|----------|----------|-------------|
| jGrants | jGrants/Jグランツ/補助金申請システム | jgrants\.jp |
| 東京都電子申請 | 電子申請/e-tokyo/東京共同電子申請 | shinsei\.e-tokyo |
| GビズID連携 | GビズID/gBizID | - |
| ミラサポplus | ミラサポ/mirasapo | mirasapo |
| e-Gov | e-Gov/電子政府 | e-gov\.go\.jp |

**新規API（v3.2）:**
```bash
# キュー状態サマリー（super_admin）
GET /api/admin-ops/extraction-queue/summary

# 手動enqueue（super_admin）
POST /api/admin-ops/extraction-queue/enqueue

# 手動consume（super_admin）
POST /api/admin-ops/extraction-queue/consume
Body: {"shard": 7}  # shard指定（省略時は自動選択）

# 失敗ジョブ再試行
POST /api/admin-ops/extraction-queue/retry-failed

# 完了ジョブ削除
DELETE /api/admin-ops/extraction-queue/clear-done
```

**Cronエンドポイント（v3.2）:**
```bash
# キュー投入（全ソース対象）
POST /api/cron/enqueue-extractions
Header: X-Cron-Secret: {CRON_SECRET}

# キュー消化（shard指定）
POST /api/cron/consume-extractions?shard=0
Header: X-Cron-Secret: {CRON_SECRET}
```

**凍結仕様（v3.2追加）:**
```typescript
FIRECRAWL_COOLDOWN_HOURS = 6    // Firecrawl 再実行間隔
VISION_COOLDOWN_HOURS = 24      // Vision OCR 再実行間隔
MAX_ITEMS_PER_RUN = 10          // 1回Cronの処理上限
LEASE_MINUTES = 8               // リース保持時間
SEARCH_CACHE_TTL = 120          // 検索キャッシュTTL（秒）
SHARD_COUNT = 16                // shard分割数
```

---

## 🤖 Workers Cron運用ガイド（v3.3）

### Workers Cron情報
```bash
# ステータス確認
curl https://hojyokin-queue-cron.sekiyadubai.workers.dev/status

# 手動トリガー（特定shard）
curl -X POST "https://hojyokin-queue-cron.sekiyadubai.workers.dev/trigger?shard=3"

# 手動enqueue（毎日00:00 UTCに自動実行）
curl -X POST "https://hojyokin-queue-cron.sekiyadubai.workers.dev/enqueue"
```

### 運用監視コマンド（D1直接）
```bash
# キュー状態確認
npx wrangler d1 execute subsidy-matching-production --remote --command \
  "SELECT status, job_type, COUNT(*) cnt FROM extraction_queue GROUP BY status, job_type;"

# shard分布確認
npx wrangler d1 execute subsidy-matching-production --remote --command \
  "SELECT shard_key, status, COUNT(*) cnt FROM extraction_queue GROUP BY shard_key, status ORDER BY shard_key;"

# Lease状態確認（詰まり検出）
npx wrangler d1 execute subsidy-matching-production --remote --command \
  "SELECT id, status, lease_owner, lease_until FROM extraction_queue WHERE status='leased';"

# wall_chat_ready進捗確認
npx wrangler d1 execute subsidy-matching-production --remote --command \
  "SELECT count(*) as ready FROM subsidy_cache WHERE wall_chat_ready = 1;"

# JGrants enriched確認
npx wrangler d1 execute subsidy-matching-production --remote --command \
  "SELECT COUNT(*) AS enriched FROM subsidy_cache WHERE source='jgrants' AND detail_json IS NOT NULL AND LENGTH(detail_json) > 100;"
```

### 詰まり判定と対処

| 状態 | 判定基準 | 対処 |
|------|----------|------|
| **正常** | done増加、queued/leased減少 | 問題なし |
| **詰まり** | leased が 8分以上経過 | 次のcronで自動回収される |
| **大量backlog** | queued > 500 | `/2分に頻度UP or 手動trigger` |
| **連続失敗** | failed > 10 | `retry-failed` で再試行 |

### 頻度引き上げ判断基準

```bash
# 現状（5分ごと）で十分なケース
- 1日1回のenqueue、処理件数 < 500件
- キュー backlog が常に低い

# 2分に上げるべきケース
- queued が 1000件超を常に維持
- 処理完了まで12時間以上かかる見込み
- Workers Cronの wrangler.toml を編集:
#   crons = ["*/2 * * * *"]
```

---

### 📊 v2.6.0 - P3-3B Sprint完了: PDF抽出ハイブリッド + 抽出ログUI

**P3-3Bフェーズ完了（2026-01-25）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| WALL_CHAT_READY | ✅ **58件** | tokyo-kosha 23 + tokyo-hataraku 15 + tokyo-shigoto 12 + jgrants 5 + manual 3 |
| **PDF抽出ハイブリッド** | ✅ | HTML → Firecrawl → Vision OCR の3段階フォールバック |
| **メトリクス計測** | ✅ | html_ok/firecrawl_ok/vision_ok/pages をcron_runsに記録 |
| **extract-pdf-forms Cron** | ✅ | `/api/cron/extract-pdf-forms` - 50件/回バッチ |
| **extraction_logs テーブル** | ✅ NEW | OCRコスト追跡用（サブシディID/方式/コスト/失敗理由） |
| **抽出ログUI** | ✅ NEW | super_admin向けダッシュボード（メトリクス+ログテーブル） |
| 品質ゲート | ✅ | forms >= 2 かつ fields >= 3（凍結仕様）|

**super_admin抽出ログUI（NEW）:**

![抽出ログダッシュボード](docs/extraction-logs-ui.png)

| 表示項目 | 説明 |
|----------|------|
| HTML成功 | detailUrlからの抽出成功数 |
| Firecrawl成功 | テキスト埋め込みPDFからの抽出成功数 |
| Vision成功 | 画像PDF（OCR）からの抽出成功数 |
| OCRページ計 | Vision OCRで処理した総ページ数（コスト計算用） |
| 様式抽出成功 | forms >= 2 を満たした件数 |
| 失敗 | 全抽出試行中の失敗件数 |

**抽出ログAPI（super_admin専用）:**
```bash
# 抽出ログ一覧取得
GET https://hojyokin.pages.dev/api/admin-ops/extraction-logs?limit=50
Header: Authorization: Bearer {TOKEN}

# フィルタオプション
GET ?method=html|firecrawl|vision_ocr
GET ?source=tokyo-shigoto|jgrants|...
GET ?success=1|0
```

**PDF抽出パイプライン（ハイブリッド構成）:**

```
┌─────────────────────────────────────────────────────────────────┐
│  extractAndUpdateSubsidy() - 統一入口（A-0凍結）                │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: HTML抽出（最優先・最安）                               │
│    └─ detailUrl → fetch → stripHtmlToText                      │
│    └─ 成功条件: textLen >= 800                                  │
├─────────────────────────────────────────────────────────────────┤
│  Step 2: Firecrawl（テキスト埋め込みPDF用）                     │
│    └─ FIRECRAWL_API_KEY 必須                                    │
│    └─ pdfUrls → Firecrawl API → markdown                        │
├─────────────────────────────────────────────────────────────────┤
│  Step 3: Google Vision OCR（画像PDF用・最後の手段）             │
│    └─ GOOGLE_CLOUD_API_KEY 必須                                 │
│    └─ PDFダウンロード → Base64 → Vision API                     │
│    └─ 高コストなので最大2ファイルまで                           │
├─────────────────────────────────────────────────────────────────┤
│  Step 4: required_forms抽出 + 品質ゲート                        │
│    └─ forms >= 2, fields >= 3                                   │
│    └─ 失敗は feed_failures に記録                               │
├─────────────────────────────────────────────────────────────────┤
│  Step 5: detail_json更新 + wall_chat_ready再計算                │
└─────────────────────────────────────────────────────────────────┘
```

**必要な環境変数:**
```bash
# wrangler secret put で設定
FIRECRAWL_API_KEY=fc-xxx     # テキスト埋め込みPDF用
GOOGLE_CLOUD_API_KEY=AIza... # 画像PDF（スキャン）用（任意）
CRON_SECRET=xxx              # Cron認証用
```

**メトリクス（cron_runs.metadata_json に記録）:**
```json
{
  "metrics": {
    "htmlAttempted": 50,
    "htmlSuccess": 35,
    "firecrawlAttempted": 15,
    "firecrawlSuccess": 10,
    "visionAttempted": 5,
    "visionSuccess": 3,
    "visionPagesTotal": 12
  },
  "api_keys_configured": {
    "firecrawl": true,
    "vision": true
  }
}
```

**凍結仕様（変更禁止）:**
```typescript
// 抽出基準
MIN_TEXT_LEN_FOR_NON_OCR = 800    // 非AIで有効とみなす最低文字数
MIN_FORMS = 2                      // required_forms の最低数
MIN_FIELDS_PER_FORM = 3            // 各フォームの最低フィールド数
MAX_PDF_FETCH_SIZE = 5MB           // PDF取得上限
FIRECRAWL_TIMEOUT_MS = 30000       // Firecrawl タイムアウト
VISION_MAX_PAGES = 5               // Vision OCR 最大ページ数

// Cooldownガード（v3.1追加）
FIRECRAWL_COOLDOWN_HOURS = 6      // Firecrawl 再実行間隔
VISION_COOLDOWN_HOURS = 24        // Vision OCR 再実行間隔

// Queue設計（v3.2追加）
MAX_ITEMS_PER_RUN = 10            // 1回Cronの処理上限
LEASE_MINUTES = 8                 // リース保持時間
SHARD_COUNT = 16                  // shard分割数
```

**WALL_CHAT_READY 内訳:**
| ソース | 件数 | WALL_CHAT_READY | 率 |
|--------|------|-----------------|-----|
| tokyo-kosha | 23 | **23** | 100% ✅ |
| tokyo-hataraku | 15 | **15** | 100% ✅ |
| tokyo-shigoto | 28 | **12** | 42.9% (enrich対象) |
| jgrants | 2,894 | **5** | 0.2% (enrich Cron稼働) |
| manual | 8 | **3** | 37.5% |
| **合計** | **2,968** | **58** | - |

**主要5制度（P3-2D WALL_CHAT_READY化済み）:**
| # | 制度 | ID | required_forms |
|---|------|----|----|
| 1 | IT導入補助金2025 | REAL-001 | 2 |
| 2 | ものづくり補助金 | REAL-002 | 3 |
| 3 | 持続化補助金（一般型） | REAL-003 | 3 |
| 4 | 省力化投資補助金 | a0WJ200000CDWerMAH | 2 |
| 5 | 事業再構築補助金 | a0W5h00000UaiqSEAR | 3 |

**JGrants追加5制度（WALL_CHAT_READY）:**
1. 小規模事業者持続化補助金＜災害支援枠＞
2. 小規模事業者持続化補助金＜共同・協業型＞
3. 小規模事業者持続化補助金＜創業型＞
4. 省力化等の大規模成長投資補助金（令和７年度補正）
5. 事業再構築補助金（共同申請）

**新規API（P3-2E）:**
```bash
# JGrants制度の詳細取得＆WALL_CHAT_READY化（super_admin専用）
POST https://hojyokin.pages.dev/api/admin-ops/jgrants/enrich-detail
Header: Authorization: Bearer {TOKEN}
Body: {"limit": 20}  # または {"subsidy_ids": ["a0WJ..."]}

# feed_failures取得（管理者用）
GET https://hojyokin.pages.dev/api/admin-ops/feed-failures?status=open&limit=20
```

**Cronエンドポイント（cron-job.org等から呼び出し）:**
```bash
# 東京しごと財団
POST https://hojyokin.pages.dev/api/cron/scrape-tokyo-shigoto
Header: X-Cron-Secret: {CRON_SECRET}

# 東京都中小企業振興公社
POST https://hojyokin.pages.dev/api/cron/scrape-tokyo-kosha
Header: X-Cron-Secret: {CRON_SECRET}

# TOKYOはたらくネット
POST https://hojyokin.pages.dev/api/cron/scrape-tokyo-hataraku
Header: X-Cron-Secret: {CRON_SECRET}
```

**推奨Cronスケジュール:**
| ジョブ | 時刻 (JST) | 説明 |
|--------|------------|------|
| scrape-tokyo-* | 06:00 | 東京3ソース (shigoto/kosha/hataraku) |
| sync-jgrants | 06:00 | JGrants API同期 |
| enrich-jgrants | 07:00 | JGrants detail_json拡充 (30件/日) |
| enrich-tokyo-shigoto | 07:30 | tokyo-shigoto detail_json拡充 |
| **extract-pdf-forms** | **08:00** | **PDF/HTML抽出（50件/回）** ← NEW |
| generate-suggestions | 09:00 | 顧客向け提案生成 |

**新規Cronエンドポイント（P3-3A）:**
```bash
# PDF/HTML抽出（統一入口）- 全ソース対象
POST https://hojyokin.pages.dev/api/cron/extract-pdf-forms
Header: X-Cron-Secret: {CRON_SECRET}
# 50件/回、失敗はfeed_failuresに記録、wall_chat_ready自動更新
```

**新規Cronエンドポイント（P3-2F）:**
```bash
# JGrants detail_json拡充（毎日30件バッチ）
POST https://hojyokin.pages.dev/api/cron/enrich-jgrants
Header: X-Cron-Secret: {CRON_SECRET}

# tokyo-shigoto detail_json拡充
POST https://hojyokin.pages.dev/api/cron/enrich-tokyo-shigoto
Header: X-Cron-Secret: {CRON_SECRET}
```

**feed_failures 分類（凍結仕様）:**
| 分類 | stage | error_type | 説明 |
|------|-------|------------|------|
| FETCH失敗 | discover | HTTP/timeout | 404/403/timeout等 |
| PARSE失敗 | pdf | parse | PDF破損/暗号化/文字化け |
| FORMS未検出 | extract | validation | 様式抽出失敗 |
| FIELDS不足 | detail | validation | fields < 3 |

---

### 過去アップデート (v1.9.0) - P2 安全ゲート + Cron定期化

**P2フェーズ完了（2026-01-23）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| P2-0 安全ゲート | ✅ | CRON_SECRET必須、cron_runs監査ログ、冪等性保証 |
| P2-1 ダッシュボード連携 | ✅ | prefecture/government統合、公開NEWSAPI |
| P2-2 Cron定期化 | ✅ | 差分検知（new/updated/skipped）、content_hash |
| P2-3 JSON import API | ✅ | POST /api/admin/feed/import、super_admin限定 |

**Cron実行ログ:**
```bash
# 正常実行時: cron_runsに記録
# 1回目: items_new=13, items_skipped=0
# 2回目: items_new=0, items_skipped=13 (完全冪等)
```

**凍結ドキュメント:** `docs/FEED_PIPELINE_SPEC.md`

---

### 過去アップデート (v1.8.0) - 士業ダッシュボード v2（情報の泉型）

**士業向けダッシュボードをリニューアル:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| NEWSフィード | ✅ 5カテゴリ対応 | platform, support_info, prefecture, ministry, other_public |
| 顧客おすすめ | ✅ AIサジェスト | 顧客ごと上位3件表示、match_reasons表示 |
| 未処理タスク | ✅ 3種類 | 承認待ち、期限間近リンク、進行中ドラフト |
| KPI | ✅ リアルタイム | 今日の検索・壁打ち・ドラフト数 |
| モバイル対応 | ✅ レスポンシブ | タブ切替、44px タップターゲット |

**新規テーブル:**
- `subsidy_feed_items` - NEWSフィード用
- `agency_suggestions_cache` - おすすめキャッシュ
- `feed_daily_snapshots` - 日次集計
- `agency_feed_read_status` - 既読管理
- `cron_runs` - Cron実行履歴（P2-0追加）

**凍結ドキュメント:** `docs/AGENCY_DASHBOARD_FREEZE.md`

---

### 過去アップデート (v1.7.0) - Phase B-1 完全完了: JGrants API直接連携

**Phase B-1: 実データによる補助金検索システム完成**

| 項目 | 状態 | 詳細 |
|------|------|------|
| subsidy_cache | ✅ 67件（JGrants 59件 + 手動 8件） | JGrants APIから直接取得 |
| JGRANTS_MODE | `cached-only` | モック依存完全解除 |
| 検索API | ✅ 実データから検索・評価 | source: cache |
| 壁打ちAPI | ✅ 実データでprecheck動作 | REAL-* ID対応 |
| JGrants同期API | ✅ `/api/admin/sync-jgrants` | super_admin専用 |
| キャッシュ統計API | ✅ `/api/admin/subsidy-cache/stats` | 管理者用 |

**JGrants同期の使い方（super_admin権限必要）:**
```bash
# ログイン
TOKEN=$(curl -s "https://hojyokin.pages.dev/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin@example.com","password":"your-password"}' | jq -r '.data.token')

# JGrantsからデータ同期（キーワード・件数指定可能）
curl -s "https://hojyokin.pages.dev/api/admin/sync-jgrants" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"keyword":"事業","limit":100,"acceptance":1}'
```

**修正内容:**
1. **apiCall is not defined エラー修正** - agency/clientsページでDOMContentLoaded待機
2. **requireCompanyAccess修正** - user_companies テーブルへの正しいクエリ
3. **JGrants API直接連携** - 公開APIからリアルタイムデータ取得
4. **subsidy_cache自動upsert** - 24時間キャッシュ

### 過去アップデート

<details>
<summary>v1.5.4 - API修正 + モックデータフォールバック</summary>

1. **管理画面・詳細ページの `api is not defined` 修正**
   - `window.api` を `<head>` 内で先に定義
   - admin.tsx / subsidies.tsx 両方に適用

2. **壁打ちチャットAPIのモックデータフォールバック**
   - `subsidy_cache` にデータがない場合、`getMockSubsidyDetail()` から取得
   - `/api/chat/precheck` と `/api/chat/sessions` 両方に適用

3. **precheck UIの null/undefined ガード処理**

4. **モックデータの整備**（MOCK-001〜010）
</details>

### 設計思想

> **「補助金を"通す"ツール」ではなく「補助金で人生を壊させないツール」**

- 採択より完走
- 金額より安全
- 自動化より判断補助

---

## 🌐 URLs

### 本番環境 (Cloudflare Pages)

| ページ | URL | 説明 |
|--------|-----|------|
| トップ | https://hojyokin.pages.dev | ランディング |
| ログイン | https://hojyokin.pages.dev/login | 認証 |
| 新規登録 | https://hojyokin.pages.dev/register | アカウント作成 |
| ダッシュボード | https://hojyokin.pages.dev/dashboard | メイン画面 |
| 会社情報 | https://hojyokin.pages.dev/company | 企業プロフィール編集 |
| 補助金一覧 | https://hojyokin.pages.dev/subsidies | 補助金検索 |
| 補助金詳細 | https://hojyokin.pages.dev/subsidies/:id | 個別補助金情報 |
| 壁打ちチャット | https://hojyokin.pages.dev/chat?session_id=XXX | S3: 事前判定＋不足情報収集 |
| 申請書ドラフト | https://hojyokin.pages.dev/draft?session_id=XXX | S4: 申請書作成 |
| 管理画面 | https://hojyokin.pages.dev/admin | 管理者用 |
| **運用チェック** | **https://hojyokin.pages.dev/admin/ops** | **30分検証ダッシュボード（super_admin限定）** |

### 開発環境

- **GitHub**: https://github.com/matiuskuma2/hojyokin
- **Sandbox**: PM2 + wrangler pages dev (port 3000)

### Cron/Consumer Workers

- **Feed Cron Worker**: https://hojyokin-cron-feed.sekiyadubai.workers.dev (**NEW - P2**)
  - スケジュール: 毎日 06:00 JST (UTC 21:00)
  - `/health` - ヘルスチェック
  - `/runs` - 直近10件のCron実行履歴
  - `POST /trigger` - 手動トリガー（X-Cron-Secret必須）
  - 責務: 東京しごと財団スクレイピング → subsidy_feed_items → cron_runs

- **Cron Worker (legacy)**: https://hojyokin-cron.sekiyadubai.workers.dev
  - `/cron/run?limitRegistry=200&limitLifecycle=50` - 手動実行
- **Consumer Worker**: https://hojyokin-consumer.sekiyadubai.workers.dev
  - `/consumer/run?batch=10` - 手動実行
  - `/consumer/stats` - ステータス確認

---

## 🚀 新しい環境でのセットアップ手順

### 1. リポジトリのクローン

```bash
cd /home/user
git clone https://github.com/matiuskuma2/hojyokin.git webapp
cd webapp
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.dev.vars` ファイルを作成（本番は既に設定済み）:

```bash
cat > .dev.vars << 'EOF'
JWT_SECRET=your-secret-key-32-chars-minimum
JWT_ISSUER=subsidy-app
JWT_AUDIENCE=subsidy-app-users
JGRANTS_MODE=cached-only
FIRECRAWL_API_KEY=fc-xxx
EOF
```

### 4. D1データベースの設定

**ローカル開発の場合（推奨: dev_schema.sql を使用）:**

```bash
# ★ 推奨: dev_schema.sql で初期化（マイグレーションは本番専用）
rm -rf .wrangler/state/v3/d1  # 既存DBをクリア
npx wrangler d1 execute subsidy-matching-production --local --file=migrations/dev_schema.sql

# シードデータ投入（必要に応じて）
npx wrangler d1 execute subsidy-matching-production --local --file=./seed.sql
```

**重要: ローカル/本番 マイグレーション運用ルール:**
- **ローカル**: `dev_schema.sql` を唯一の正とする（マイグレーションは不要）
- **本番**: 個別マイグレーションファイルで差分適用

```bash
# ❌ ローカルでは使わない（依存関係エラーが発生しやすい）
# npx wrangler d1 migrations apply subsidy-matching-production --local

# ✅ dev_schema.sql を直接実行
npx wrangler d1 execute subsidy-matching-production --local --file=migrations/dev_schema.sql
```

**本番デプロイの場合:**

```bash
# 本番は個別マイグレーションを適用（差分管理）
npx wrangler d1 migrations apply subsidy-matching-production

# データベースIDは wrangler.jsonc に記載:
# database_id: "e53f6185-60a6-45eb-b06d-c710ab3aef56"
```

### 5. ビルド

```bash
npm run build
```

### 6. ローカル開発サーバー起動

```bash
# PM2で起動（推奨）
pm2 start ecosystem.config.cjs

# ステータス確認
pm2 list

# ログ確認
pm2 logs webapp --nostream

# 停止
pm2 stop webapp
pm2 delete webapp
```

### 7. 本番デプロイ

```bash
# Cloudflare API Keyの設定（初回のみ）
# Deploy タブで API Key を設定してください

# デプロイ実行
npm run deploy

# または直接
npx wrangler pages deploy dist --project-name hojyokin
```

### 8. Cron/Consumer Workers のデプロイ

```bash
# Feed Cron Worker (P2 新規)
cd /home/user/hojyokin-cron-feed
npm install
npx wrangler deploy

# Legacy Cron Worker
cd /home/user/hojyokin-cron
npm install
npx wrangler deploy

# Consumer Worker
cd /home/user/hojyokin-consumer
npm install
npx wrangler deploy
```

---

## 📊 データアーキテクチャ

### 主要テーブル

| テーブル | 説明 |
|----------|------|
| `users` | ユーザーアカウント |
| `companies` | 会社基本情報 |
| `user_companies` | ユーザー・会社関連付け |
| `company_profile` | 会社詳細プロフィール |
| `company_documents` | アップロード書類 |
| `subsidy_cache` | 補助金キャッシュ |
| `eligibility_rules` | 適格性判定ルール |
| `chat_sessions` | 壁打ちセッション |
| `chat_messages` | チャット履歴 |
| `chat_facts` | 収集済み事実 |
| `application_drafts` | 申請書ドラフト |
| `source_registry` | 47都道府県クロール台帳 |
| `crawl_queue` | Cronキュー |
| `domain_policy` | ドメインブロックポリシー |
| `usage_events` | 利用イベント（KPI集計用） |

### データベース接続情報

- **D1 Database**: subsidy-matching-production
- **Database ID**: e53f6185-60a6-45eb-b06d-c710ab3aef56
- **R2 Bucket**: subsidy-knowledge

---

## 🧪 動作確認

### テストユーザー

```bash
# スーパーアドミンユーザー
Email: matiuskuma2@gmail.com
User ID: 7e8ffc39-554e-4c28-ab89-9d3b9c0f68cd

# テストデータ
会社数: 15社（user_companies に関連付け済み）
- 株式会社エクスペリエンス
- デバッグ株式会社
- チャットテスト株式会社
など
```

### API テスト

```bash
# ヘルスチェック
curl http://localhost:3000/api/health

# ログイン
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"matiuskuma2@gmail.com","password":"your-password"}'

# 会社一覧取得
curl http://localhost:3000/api/companies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 運用監視

```bash
# Cron 手動実行
curl -s "https://hojyokin-cron.sekiyadubai.workers.dev/cron/run?limitRegistry=200&limitLifecycle=50"

# Consumer ステータス確認
curl -s "https://hojyokin-consumer.sekiyadubai.workers.dev/consumer/stats"

# キュー状態確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT status, COUNT(*) cnt FROM crawl_queue GROUP BY status;"
```

---

## 🔧 トラブルシューティング

### 会社が表示されない

**原因**: `user_companies` テーブルの関連付けが不足

**解決策**:

```bash
# ユーザーIDを確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT id, email FROM users WHERE email='your-email@example.com';"

# 会社IDを確認
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="SELECT id, name FROM companies LIMIT 10;"

# 関連付けを追加
npx wrangler d1 execute subsidy-matching-production --remote \
  --command="INSERT INTO user_companies (id, user_id, company_id, created_at)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
       'YOUR_USER_ID',
       id,
       datetime('now')
FROM companies
WHERE id NOT IN (SELECT company_id FROM user_companies WHERE user_id='YOUR_USER_ID');"
```

### Consumer が動かない

**原因**: Firecrawl API の timeout パラメータが小さすぎる

**解決策**: hojyokin-consumer の `src/index.ts` で `timeout: timeoutMs` （ミリ秒）に修正済み

### ビルドエラー

**原因**: Node.js バージョンまたは依存関係の問題

**解決策**:

```bash
# Node.js バージョン確認（v18以上推奨）
node -v

# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install

# ビルド
npm run build
```

---

## 📝 開発ガイドライン

### コーディング規則

1. **API呼び出しは `window.api()` を使用**
   - 認証トークンは自動付与
   - エラーハンドリングは共通関数内で実施

2. **DOM操作は必ずnullチェック**
   ```javascript
   var el = document.getElementById('user-name');
   if (el) {
     el.textContent = user.name || '';
   }
   ```

3. **ES5互換性を維持**
   - `var` を使用（`let`/`const` は避ける）
   - アロー関数は使わず `function` を使用

4. **グローバル関数は `window` に登録**
   ```javascript
   window.searchSubsidies = async function(page = 1) {
     // ...
   };
   ```

### Git ワークフロー

```bash
# 変更をコミット
git add .
git commit -m "説明的なコミットメッセージ"

# GitHub にプッシュ
git push origin main

# デプロイ
npm run deploy
```

---

## 🗂️ プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx              # メインエントリーポイント
│   ├── routes/                # API ルート
│   │   ├── auth.ts            # 認証 API
│   │   ├── companies.ts       # 会社 API
│   │   ├── subsidies.ts       # 補助金 API
│   │   ├── chat.ts            # チャット API
│   │   ├── draft.ts           # ドラフト API
│   │   ├── agency.ts          # Agency API
│   │   └── admin-dashboard.ts # 管理 API
│   ├── pages/                 # UI ページ
│   │   ├── auth.tsx           # 認証ページ
│   │   ├── dashboard.tsx      # ダッシュボード
│   │   ├── company.tsx        # 会社情報
│   │   ├── subsidies.tsx      # 補助金検索
│   │   ├── chat.tsx           # 壁打ちチャット
│   │   ├── draft.tsx          # 申請書ドラフト
│   │   ├── agency.tsx         # Agency管理
│   │   └── admin.tsx          # 管理画面
│   ├── lib/                   # ライブラリ
│   │   ├── auth.ts            # 認証ヘルパー
│   │   ├── jgrants-adapter.ts # JGrants連携
│   │   └── usage-tracker.ts   # 利用イベント記録
│   └── types/                 # TypeScript型定義
├── public/                    # 静的ファイル
│   ├── static/                # CSS/JS
│   │   ├── app.js
│   │   └── styles.css
│   ├── favicon.png
│   ├── manifest.json          # PWA マニフェスト
│   └── sw.js                  # Service Worker
├── migrations/                # D1 マイグレーション
│   ├── 0001_initial_schema.sql
│   ├── 0002_eligibility_rules.sql
│   └── ...
├── ecosystem.config.cjs       # PM2 設定
├── wrangler.jsonc             # Cloudflare 設定
├── vite.config.ts             # Vite 設定
├── package.json               # 依存関係
└── README.md                  # このファイル
```

---

## 📈 実装済み機能

- [x] 認証 (JWT + PBKDF2)
- [x] 企業CRUD + プロフィール管理
- [x] 補助金検索（JGrants API連携）
- [x] 47都道府県クロール台帳
- [x] S3: 壁打ちチャット（事前判定 + 不足情報収集）
- [x] S4: 申請書ドラフト生成（テンプレート + NGチェック）
- [x] Agency機能（士業向け顧客管理）
- [x] 運用監視ダッシュボード（/admin/ops）
- [x] PWA対応（Service Worker + Manifest）
- [x] 書類アップロード（PDF.js抽出）

---

## 📋 次のステップ

### 優先度: 高

1. **Consumer Worker の安定稼働**
   - Firecrawl タイムアウトの監視
   - ドメインブロックの適切な設定
   - クロール結果の subsidy_cache への保存

2. **データ収集パイプラインの本格稼働**
   - `subsidy_cache` へのデータ格納（現在0件）
   - `eligibility_rules` へのルール格納（現在0件）
   - L2 実稼働の緑化（直近24時間の done/failed カウント増加）

3. **L3 網羅性の向上**
   - source_registry からのデータ取得
   - 都道府県サイトのクロール結果からデータ抽出・正規化

### 優先度: 中

1. **KPI 動作確認**
   - SUBSIDY_SEARCH イベントの記録
   - CHAT_SESSION_STARTED イベントの記録
   - DRAFT_GENERATED イベントの記録

2. **UI/UX 改善**
   - Tailwind CSS CDN からビルド済みCSSへの移行
   - モバイル対応の強化
   - アクセシビリティ向上

### 現状のデータ状況

| 項目 | 件数 | 備考 |
|------|------|------|
| 補助金検索結果 | **67件** | JGrants実データ（モード: cached-only）|
| subsidy_cache | **67件** | ✅ JGrants 59件 + 手動 8件 |
| eligibility_rules | 0件 | ルール未格納（次フェーズ） |
| crawl_queue (done) | 48件 | クロール完了 |
| crawl_queue (failed) | 14件 | 失敗（リトライ対象） |
| source_registry | 47 + 13 | 都道府県 + national |

---

## 📄 ライセンス

Private

---

## 🔄 更新履歴

- **2026-02-05 (v4.3.0)**: NormalizedSubsidyDetail v1.0 Freeze + Phase A-1/A-2 完了 - resolveSubsidyRef.ts（SSOT ID解決）、normalizeSubsidyDetail.ts（5制度マッピング）、フロントエンド normalized 完全参照切替
- **2026-01-24 (v2.2.0)**: P3-2E Sprint完了 - tokyo-hataraku +15件、feed_failures UI 4分類、JGrants enrich-detail API
- **2026-01-24 (v2.1.0)**: P3-2C/D完了 - required_forms自動生成、主要5制度WALL_CHAT_READY化
- **2026-01-23 (v1.8.0)**: 士業ダッシュボード v2（情報の泉型）- NEWSフィード5カテゴリ、顧客おすすめAIサジェスト、未処理タスク、KPI
- **2026-01-23 (v1.7.0)**: Phase B-1 完了 - JGrants API直接連携、subsidy_cache 67件投入、apiCall修正、requireCompanyAccess修正
- **2026-01-23 (v1.6.0)**: Phase B 開始 - 手動実データ8件投入、JGRANTS_MODE cached-only切替
- **2026-01-23 (v1.5.4)**: 壁打ちチャットAPIでセッション作成時のモックフォールバック追加
- **2026-01-23 (v1.5.3)**: 壁打ちチャットAPIでモックデータフォールバック取得を追加
- **2026-01-23 (v1.5.2)**: 管理画面の `api is not defined` 修正、window.api を head で定義
- **2026-01-23 (v1.5.1)**: 詳細ページ・壁打ちページの `api is not defined` 修正
- **2026-01-23 (v1.4.8)**: UI/UX改善: JavaScriptスコープ問題修正、ナビゲーション順序固定、不要なポップアップ削除、会社API修正
- **2026-01-22 (v1.4.7)**: JavaScriptスコープ問題の修正（searchSubsidies, setSearchMode をグローバル化）、ナビゲーション動的スタイル実装
- **2026-01-22 (v1.4.6)**: 会社API修正（company_memberships → user_companies）、会社選択ドロップダウンの表示修正
- **2026-01-22 (v1.4.5)**: 補助金検索ページのUI/UX改善（登録状況に応じた表示、api is not defined エラー修正）
- **2026-01-22 (v1.4.4)**: A-1台帳揃いの集計ロジック修正（registry_counts 追加）、進捗表示UI実装
- **2026-01-22 (v1.4.3)**: PWA対応完了、運用チェックダッシュボード追加
- **2026-01-22 (v1.4.2)**: 運用監視強化、usage_events記録強化
- **2026-01-22**: S3/S4実装完了、Agency機能追加、Superadmin KPI実装

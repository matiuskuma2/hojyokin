# 週1全量クロール計画

## 概要
- **対象**: 47都道府県 + 国レベル13件 + 事務局5件 = 計65ソース
- **頻度**: 週1回（土曜深夜 3:00 JST 開始）
- **深さ**: max_depth=1～2（ソース依存）
- **優先順位**: priority 1→4 の順で実行

## Phase 0: 試験週（初回実行）

### 実行対象
| スコープ | 件数 | 想定ページ数 | 想定PDF数 |
|---------|------|-------------|----------|
| national (priority=1) | 4 | 80 | 20 |
| secretariat (priority=1) | 5 | 100 | 40 |
| prefecture (priority=1-2) | 12 | 120 | 30 |
| **合計** | **21** | **300** | **90** |

### 想定コスト（Phase 0）
- Firecrawl: 300ページ × $0.005 = **$1.50**
- PDF解析（テキスト埋め込み）: 90件 × $0.00（pdfparse使用）
- OpenAI（構造化）: 90件 × 1000トークン × $0.001 = **$0.09**
- **合計**: 約 **$1.60/週**

### 成功基準
- [ ] done/failed 合計が20件以上
- [ ] エラー率 < 30%
- [ ] PDF抽出成功率 > 50%

---

## Phase 1: 本番運用（週次ルーチン）

### スケジュール
| 曜日 | 対象 | 件数 |
|-----|------|------|
| 土曜 03:00 | priority=1（daily対象含む） | 21 |
| 土曜 06:00 | priority=2 | 10 |
| 土曜 09:00 | priority=3 | 12 |
| 土曜 12:00 | priority=4 | 22 |

### 日次補完（平日）
| 曜日 | 対象 |
|-----|------|
| 月-金 06:00 | priority=1 のみ（重要事務局5件）|

### 想定コスト（Phase 1）
| 項目 | 単価 | 週間想定量 | コスト |
|-----|------|----------|--------|
| Firecrawl | $0.005/page | 800ページ | $4.00 |
| PDF解析 | $0.00 | 200件 | $0.00 |
| OpenAI構造化 | $0.001/1Kトークン | 200件×2K | $0.40 |
| **週次合計** | | | **$4.40** |
| **月次合計** | | | **$17.60** |

---

## アウトプット指標

### キュー健全性（/api/admin/coverage → queue_health）
| 指標 | 閾値 | アラート |
|-----|------|---------|
| queued滞留 | < 100件 | 100件超で警告 |
| 24h処理数 | > 0 | 0件で停止検知 |
| done/failed比率 | > 70% | 70%未満で品質低下 |

### L1: 入口網羅性
| 指標 | 目標 |
|-----|------|
| 47都道府県登録 | 47/47 (100%) |
| enabled=1 | 47/47 (100%) |

### L2: 実稼働網羅性
| 指標 | 目標 |
|-----|------|
| 直近7日でdone/failed到達 | 40/47 (85%) |
| stale_regions | < 7 |

### L3: 制度網羅性
| 指標 | 追跡対象 |
|-----|---------|
| subsidies.total | 増加傾向 |
| subsidies.active | 安定 |
| 週次更新件数 | > 10 |

---

## 例外処理（アクセス制限への対応）

### login_required
source_registry に `access_constraint = 'login_required'` をセットし、手動フラグ化。

### robots.txt ブロック
domain_policy に `blocked_reason` を記録、`enabled=0` に変更。

### 電話必須
`access_constraint = 'phone_required'` をセットし、月次で手動確認。

---

## 運用チェックリスト（毎週月曜確認）

### 自動チェック（/api/admin/coverage）
- [ ] queue_health.is_healthy = true
- [ ] domain_errors_top.length < 5
- [ ] duplicate_crawls.length < 3
- [ ] l1_entry_coverage.coverage_rate >= 90%
- [ ] l2_crawl_coverage.stale_count < 10

### 手動チェック
- [ ] 新規blocked_untilドメインの理由確認
- [ ] failure_rate > 50% のドメイン対処
- [ ] priority=1ソースのPDF更新確認

---

## 緊急対応フロー

### Consumer停止検知
1. `queue_health.oldest_queued` が24時間以上前
2. Cron Worker ログ確認
3. Consumer Worker 再デプロイ

### コスト急増検知
1. `/api/admin/costs` で costAlert = HIGH
2. domain_errors_top で失敗ドメイン特定
3. domain_policy で `enabled=0` に変更

### データ欠損検知
1. `/api/admin/coverage` で l3_data_coverage 確認
2. 特定地域の更新がない場合、source_registry 確認
3. 手動でクロールキュー投入

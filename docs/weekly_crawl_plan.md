# 週1全量クロール計画

## 概要
補助金データの「回ってる証拠」を数字で示すための週次クロール計画。

## フェーズ構成

### Phase 0: 試験週（現在）
**目標**: データ収集パイプラインの動作確認

| 項目 | 値 |
|------|-----|
| 対象 | 47都道府県 + 主要事務局9 = 65ソース |
| 深度 | max_depth = 1〜2 |
| 内容 | PDFリンク抽出、HTMLテキスト取得 |
| 期間 | 1週間 |

**アウトプット指標**:
- source_registry の実行数/成功数/失敗数/例外数
- crawl_queue の推移（queued → done/failed）
- PDFリンク総数
- 取れない理由分類（blocked, timeout, login_required, etc.）

### Phase 1: 定常運用
**目標**: 週次で安定したデータ更新

| priority | 更新頻度 | 対象 |
|----------|----------|------|
| 1 (最重要) | daily | IT補助金, ものづくり, 持続化, Jグランツ |
| 2 (重要) | daily~weekly | 事業再構築, 主要都道府県(東京,大阪,愛知,福岡等) |
| 3 (通常) | weekly | その他の都道府県産業支援機構 |
| 4 (低頻度) | monthly | 例外棚卸し対象 |

### Phase 2: OCR/PDF処理
**目標**: スキャンPDFの自動処理

- テキスト埋め込みPDF → pdf-parse で自動抽出
- スキャンPDF → AWS Textract / Google Document AI でOCR
- OCR結果 → 構造化（JSON）→ DB反映

---

## 週次スケジュール

| 曜日 | 処理 |
|------|------|
| 月 | Cron: priority=1 のソースをキューに投入 |
| 火 | Cron: priority=2 のソースをキューに投入 |
| 水 | Cron: priority=3 のソースをキューに投入 |
| 木 | Consumer: 全キュー処理（約5分/ソース × 65 ≈ 6時間） |
| 金 | 品質チェック: L1/L2/L3 網羅性検証 |
| 土 | 例外棚卸し: login_required / blocked の手動確認 |
| 日 | KPIスナップショット生成 |

---

## 検証チェック表

### L1: 入口網羅性（source_registry）
- [ ] 47都道府県すべてに enabled=1 のエントリあり
- [ ] 主要事務局（IT補助金, ものづくり, 持続化, 事業再構築）が enabled=1
- [ ] Jグランツポータルが enabled=1

**確認SQL**:
```sql
SELECT scope, COUNT(*) as total, SUM(enabled) as enabled_count
FROM source_registry
GROUP BY scope;
```

### L2: 実稼働網羅性（crawl_queue）
- [ ] 直近7日で done + failed が各都道府県で > 0
- [ ] queued が 100件未満（滞留なし）
- [ ] Consumer が24時間以内に動作した証拠あり

**確認SQL**:
```sql
SELECT 
  sr.geo_id,
  COUNT(DISTINCT cq.queue_id) as queue_items,
  SUM(CASE WHEN cq.status = 'done' THEN 1 ELSE 0 END) as done,
  SUM(CASE WHEN cq.status = 'failed' THEN 1 ELSE 0 END) as failed
FROM source_registry sr
LEFT JOIN crawl_queue cq ON sr.registry_id = cq.source_registry_id
  AND cq.created_at >= datetime('now', '-7 days')
WHERE sr.scope = 'prefecture'
GROUP BY sr.geo_id
ORDER BY done ASC;
```

### L3: 制度網羅性（subsidies / subsidy_cache）
- [ ] 週次で新規補助金が追加されている
- [ ] 期限切れ（application_end < now）が自動でexpiredに更新
- [ ] 必須項目（募集期間, 補助率, 上限額）の充足率が向上

**確認SQL**:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN date(created_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_week,
  SUM(CASE WHEN date(updated_at) >= date('now', '-7 days') THEN 1 ELSE 0 END) as updated_week
FROM subsidies;
```

---

## 例外台帳

### access_level 分類
| access_level | 説明 | 対応 |
|--------------|------|------|
| public | 公開（自動取得可能） | Firecrawl で自動 |
| login_required | ログイン必須 | 手動フラグ、APIがあれば検討 |
| phone_required | 電話申し込みのみ | 除外、手動メモ |
| blocked | robots.txt/WAFでブロック | domain_policy.blocked_until 設定 |
| pdf_scan | スキャンPDF（OCR必要） | Phase2 でOCR処理 |

### 要手動確認リスト
- 中小企業庁（chusho.meti.go.jp）: Firecrawl でブロックされやすい
- 厚労省（mhlw.go.jp）: ページ構造が複雑
- 農水省（maff.go.jp）: PDF直リンクが多い

---

## 運用KPI

| KPI | 目標値 | 測定方法 |
|-----|--------|----------|
| L1カバー率 | 100% (47/47) | source_registry.enabled で集計 |
| L2稼働率 | > 90% | 7日以内に done or failed がある地域の割合 |
| L3更新率 | > 50% | 週次で updated_at が更新された補助金の割合 |
| キュー滞留 | < 100件 | crawl_queue WHERE status='queued' |
| ドメインエラー率 | < 20% | domain_policy.failure_count / total |

---

## 管理画面での確認方法

1. `/admin` → KPIダッシュボード
2. 網羅性・運用監視セクション（super_admin限定）
   - 総合スコア（L1 + L2 + L3 の平均）
   - キュー健全性（queued / done / failed）
   - ドメイン別エラー率Top20
   - 重複クロール検知

3. `/api/admin/coverage` で JSON 取得可能

---

## コスト概算

詳細は `cost_estimation_template.md` を参照。

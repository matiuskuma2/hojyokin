# 補助金・助成金 自動マッチング＆申請書作成支援システム (ホジョラク)

## 📋 プロジェクト概要

- **Name**: subsidy-matching (hojyokin)
- **Version**: 7.2.0 (Phase 25 - 壁打ちチャット設計Freeze v3.0 + P0改善計画)
- **Goal**: 企業情報を登録するだけで、最適な補助金・助成金を自動でマッチング＆申請書ドラフト作成
- **管理者**: モギモギ（関屋紘之）
- **本番URL**: https://hojyokin.pages.dev
- **モニターUI**: https://hojyokin.pages.dev/monitor
- **GitHub**: https://github.com/matiuskuma2/hojyokin

---

## 📚 ドキュメントガイド（サンドボックス消失時はここから復活）

| ドキュメント | 内容 | 重要度 |
|-------------|------|--------|
| **[SANDBOX_RECOVERY.md](docs/SANDBOX_RECOVERY.md)** | サンドボックス完全復活手順 | 最重要 |
| **[PROJECT_RULES.md](docs/PROJECT_RULES.md)** | 全体ルール・命名規則・記録方法 | 最重要 |
| **[WALLCHAT_ARCHITECTURE_FREEZE.md](docs/WALLCHAT_ARCHITECTURE_FREEZE.md)** | 壁打ちチャット設計仕様書（Freeze確定版） | 最重要 |
| **[P0_IMPLEMENTATION_PLAN.md](docs/P0_IMPLEMENTATION_PLAN.md)** | 壁打ちP0改善計画（テキスト→構造化質問） | 最重要 |
| **[IMPROVEMENT_PLAN.md](docs/IMPROVEMENT_PLAN.md)** | TODO体系化・改善ロードマップ・KPI | 重要 |
| **[PHASE_LOG.md](docs/PHASE_LOG.md)** | Phase別の計画・実施・成果・次アクション | 重要 |
| **[CRAWL_RULES.md](docs/CRAWL_RULES.md)** | クロール運用ルール・壁打ち結果 | 重要 |
| **[DB_SCHEMA_OVERVIEW.md](docs/DB_SCHEMA_OVERVIEW.md)** | 主要テーブル・ER図・マイグレーション | 重要 |
| **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** | ビルド・デプロイ・環境設定手順 | 重要 |
| **[SSOT_koubo_pdf_management.md](tools/SSOT_koubo_pdf_management.md)** | 公募PDF管理SSOT（数値詳細） | 参照 |
| **[DATA-ACQUISITION-RULES.md](docs/DATA-ACQUISITION-RULES.md)** | データソース別取得ルール | 参照 |
| **[ssot-data-architecture.md](docs/ssot-data-architecture.md)** | SSOTデータアーキテクチャ台帳 | 参照 |

---

## 📊 現在のデータ状況 (2026-02-11 Phase 23)

| 指標 | 値 |
|------|-----|
| 補助金マスタ (subsidy_cache) | **22,274件** |
| 正規化済み (subsidy_canonical) | 3,470件 |
| 受付中補助金 (ssot_accepting) | **186件** |
| cache_accepting | **203件** |
| searchable_count | **19,272件** |
| // TODO: 要確認 | **25件**（受入基準・テストケース付） |

### バックアップ

| 日付 | URL | コミット |
|------|-----|---------|
| 2026-02-09 (Phase 16最終) | https://www.genspark.ai/api/files/s/bnHFLKqO | 3a3e6a7 |
| 2026-02-09 (Phase 16中間) | https://www.genspark.ai/api/files/s/IGpAgFVA | ab2e017 |
| 2026-02-09 (Phase 15完了) | https://www.genspark.ai/api/files/s/AWSSuqDn | 237ac7a |
| 2026-02-09 (Phase 14完了) | https://www.genspark.ai/api/files/s/UMSLeQxL | 8b9247b |
| 2026-02-09 (Phase 13完了) | https://www.genspark.ai/api/files/s/tbBX7HXE | d775780 |
| 2026-02-09 (Phase 13) | https://www.genspark.ai/api/files/s/JiJ4lYBt | a86230d |
| 2026-02-09 (Phase 12.2) | https://www.genspark.ai/api/files/s/MnjK5oGK | 0e322f1 |

---

### 🎉 最新: Phase 25 - 壁打ちチャット設計Freeze v3.0 + P0改善計画 (v7.2.0)

**Phase 25 成果 (2026-02-13)**:
- **Freeze v1.0**: 状態機械・draft_mode・質問生成器・データモデルの全仕様を確定
- **Freeze v2.0**: データ鮮度/conflict_policy、draft_mode判定基準、facts provenance、canonical未解決、derived_text、矛盾チェックリスト(C1-C14)を追加
- **Freeze v3.0**: 制度×回次2層モデル、最新回次自動遷移、壁打ちGate、質問優先度改訂（経費最優先）、P0計画並び替え、過去回次表示ポリシーを確定
- **核心的設計決定**:
  - Q1: SSOTの主キーは「回次（公募ID）」= 制度まとめは整理用ラベル
  - Q2: 壁打ち = 「不足分を聞き取る」ことが目的（ドラフト欠損を最優先で質問）
  - Q5: 士業向け価値 = 適合判定高速化 → 根拠付き説明 → 提案素材 → 加点（後回し）
- **根本原因特定**: eligibility_rules(0件)、required_documents(0件)、wall_chat_questions(未生成)が壁打ち品質低下の原因
- **本番DB実態確認**: chat_facts=84件、chat_sessions=38件、application_drafts=10件、canonical紐付き率3.7%（820/22,275件）

**P0改善計画（Freeze v3.0 改訂版）**:
| Phase | タスク | 内容 | 効果 |
|-------|--------|------|------|
| 0 | **P0-0** | 回次ID Gate（制度ID→最新回次変換、受付終了ブロック） | 回次混在事故の構造的防止 |
| 1 | P0-1 | detail_json テキスト→構造化（**経費を最優先**） | eligibility_rules 0件→3-8件 |
| 2 | P0-7b | 根拠リンク最低限（metadata.source_ref） | 「どのフィールド由来か」記録 |
| 3 | P0-2/3 | 不足入力の質問生成（**ドラフト欠損優先**） | 補助金固有質問が出る |
| 4 | P0-5/6/4/8 | 周辺整備（draft_mode, hash, AI強化, UI警告） | セッション固定・品質表示 |

### 🎉 Phase 24 - 壁打ちチャット修正 + SME判定 + ドラフト強化 + テスト基盤 (v7.0.0)

**Phase 24 成果 (2026-02-11)**:
- **壁打ちチャット修正**: 無限スピナー問題解消（テンプレートリテラル内JS構文エラー + AbortController 15秒タイムアウト）
- **SME判定**: 中小企業基本法準拠の業種別判定テーブル実装（4業種×3閾値: 製造業3億/300人/20人, 卸売1億/100人/5人, サービス5千万/100人/5人, 小売5千万/50人/5人）
- **ドラフト強化**: 動的セクション10→12種（受給要件/スケジュール追加）、NGルール6→21件拡張
- **テスト基盤**: Vitest導入、73テスト全通過（SME判定37件、トークン化検索20件、NGルール16件）

**Phase 23 成果 (2026-02-11)**:
- **パフォーマンス**: Promise.all並列化 5箇所（検索処理全体で推定60-70%遅延削減）
- **検索機能**: トークン分割AND検索、都道府県フィルターUI、issuer_name検索追加
- **KPI計測**: usage_eventsに応答時間(perf_ms.total/search_and_ssot/nsd_normalize)記録
- **セキュリティ**: SEC-1修正（本番環境でdebug情報非露出）
- **TODO体系化**: 25件の // TODO: 要確認 を受入基準・テストケース付きで配置
- **改善計画**: IMPROVEMENT_PLAN.md（フェーズ別ロードマップ・リスク分析付き）
- **バグ修正**: DO_NOT_PROCEEDステータスの士業ダッシュボード・フィルター統一

**Phase 22 成果 (2026-02-11)**:
- E2Eデータフロー完全マッピング、BUG修正3件、コードレビュー、テストケース定義

### 🎉 Phase 16 - 全ソースwall_chat_ready大幅改善 (v5.5.0)

**Phase 16 成果 (2026-02-09)**:
- **Ready率全体: 91.4% → 96.3%** (+4.9pp、+1,085件ready化)
- **本番デプロイ完了**: include_expired対応コード反映 + CF Workers最適化
- **manual: 7.2% → 97.9%** (+529件、フィールドマッピング手法で劇的改善)
- **jnet21: 0% → 100%** (24件全てready化)
- **jGrants: 56.7% → 74.8%** (+532件、enrich+フォールバック)
  - include_expired enrich: 231件enrich、daily-ready-boost: +190件ready化
- **searchable_count: 18,855 → 19,408件** (+553件)
- not_ready残り828件（jGrants 738 + excluded 72 + その他 18）

**Phase 15 成果 (2026-02-09)**:
- **受付中jGrants ready率: 14.3% → 98.4%** (+84.1pp、劇的改善)
  - 未enrich 161件を本番enrich-jgrants APIで155件処理
  - daily-ready-boost で +120件フォールバック補完→ready化
- **wall_chat_ready全体: 20,180 → 20,345件** (+165件, 91.4%)
- **searchable_count: 18,691 → 18,855件** (+164件)
- 受付中not_ready残り3件のみ（excluded 2件 + not_ready 1件）

**Phase 14 成果 (2026-02-09)**:
- **jGrants受付フラグ鮮度更新**: 期限切れ2,770件を flag=1→0 に更新
  - 受付中表示: 21,685→**18,916件** に精度改善
  - Health API `ssot_accepting_count` = **186件**（真に受付中の補助金数）
- **本番DB完全検証**: koubo_monitors 685件 + crawl_log 696件 + cron_runsスキーマ完備

**Phase 13 成果 (2026-02-09)**:
- needs_manual 64件を深堀クロール → 10件復旧（active 463→473）
- `koubo-crawl.ts` の `verifyCronSecret` バグ修正（4箇所）
- `checkUrlReachability`/`fetchPageAndExtractPdfs`にAbortControllerタイムアウト追加（15s/20s）
- 本番 + ローカル Cron API 5本全稼働確認:
  - `POST /api/cron/koubo-crawl` → 定期クロール実行（認証OK）
  - `POST /api/cron/koubo-crawl-single` → 手動クロール（PDF到達確認OK）
  - `POST /api/cron/koubo-check-period` → 公募時期判定（正常動作）
  - `GET /api/cron/koubo-dashboard` → ダッシュボード（685件表示OK）
  - `POST /api/cron/koubo-discover` → 新規発見承認/却下（認証OK）
- url_lost 158件はizumi SPA制限+Waybackレート制限のためPhase 14へ延期

**v5.1.0 リリース（2026-02-09）:**

| 指標 | Phase 12 | Phase 12.1 | Phase 12.2 | 変化 |
|------|----------|-----------|-----------|------|
| active | 296 | 406 | **463** | +167 |
| url_lost | 316 | 212 | **158** | -158 |
| needs_manual | 73 | 67 | **64** | -9 |
| PDF Coverage | 43.2% | 59.3% | **67.6%** | +24.4pp |
| crawl_log | 0 | 406 | **685** | 100% |

**実施内容**: issuer_pageクロール(104件)、other PDFスマート選定(54件)、Google検索(9件)の復旧。crawl_log 100%カバー達成。

**次のステップ (Phase 13+)**: url_lost 158件のWayback Machine探索、jGrants 1,213件のPlaywright PDF抽出、定期クロール運用開始

---

### 🎉 Phase 12: 公募要領PDF定点観測システム導入 (v5.0.0)

**v5.0.0 リリース（2026-02-09）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **定点観測DB** | ✅ | koubo_monitors 685件（active 463 / url_lost 158 / needs_manual 64） |
| **クロールエンジン** | ✅ | Cron API 5本（koubo-crawl / koubo-crawl-single / koubo-check-period / koubo-dashboard / koubo-discover） |
| **ダッシュボード** | ✅ | /monitor - Chart.js統合、5タブ構成（アラート/履歴/カバレッジ/スケジュール/新規発見） |
| **Admin API** | ✅ | 7エンドポイント（dashboard/alerts/discoveries/detail/discontinue/update-url/schedule） |
| **SSOT** | ✅ | 定点観測ルール全面更新（公募時期判定/URL変更検知/中止判定/新規発見） |
| **初回スケジュール** | ✅ | active 463件 next_crawl設定済、url_lost 158件 fallback検索クエリ設定済 |
| **手動登録追加** | ✅ | Phase 11で11件追加、dead_link 1件回復 |

**定点観測フロー:**
```
毎日: POST /api/cron/koubo-crawl → PDF到達性チェック → URL変更検知
週次: POST /api/cron/koubo-check-period → 公募時期判定 → pre_kouboスケジュール設定
URL消失時: ページ再探索 → Google検索 → superadminにエスカレーション
補助金中止: POST /api/admin/monitors/:id/discontinue → クローリング停止
新規発見: koubo_discovery_queue → superadmin承認 → DB自動登録
```

---

### 🎉 前回アップデート (v4.17.0) - Phase 4 重要補助金拡充＆サンドボックス軽量化

**v4.17.0 リリース（2026-02-08）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **手動登録canonical** | ✅ | 36件（アクティブ31件）、cache紐付け率100% |
| **アクティブモニター** | ✅ | 35件（全件初期ハッシュ取得済み） |
| **新規Phase4補助金 6件** | ✅ | 大規模成長投資・働き方改革2コース・65歳超雇用・トライアル雇用・統合版充実 |
| **データ整合性** | ✅ | canonical null_cache=0, source_link完全紐付け |
| **サンドボックス軽量化** | ✅ | 1.5GB→1.2GB、PDFはバックアップ済で削除 |

**Phase 4 新規追加補助金:**
| ID | 補助金名 | 上限額 | 時期 |
|----|----------|--------|------|
| DAIKIBO-SEICHOU-05 | 大規模成長投資補助金（第5次） | 50億円 | 2026年春公募 |
| HATARAKIKATA-ROUDOU | 働き方改革推進支援助成金（労働時間短縮） | 730万円 | 令和8年度4月～ |
| HATARAKIKATA-INTERVAL | 勤務間インターバル導入コース | 340万円 | 令和8年度4月～ |
| KOUREISHA-MUKI | 65歳超雇用推進助成金（無期雇用転換） | 30万円/人 | 通年受付 |
| TRIAL-KOYOU-IPPAN | トライアル雇用助成金（一般） | 12万円/人 | 通年受付 |
| SHINJIGYO-MONO-2026 | 新事業進出・ものづくり補助金（統合版） | 9,000万円 | 2026年度後半 |

**Phase 2-3（先行登録済）:**
| ID | 補助金名 | 上限額 |
|----|----------|--------|
| IT-SUBSIDY-2026-SECURITY | デジタル化・AI導入補助金 セキュリティ枠 | 150万円 |
| GO-TECH-R8 | Go-Tech事業 令和8年度 | 4,500万円 |
| SAIKOUCHIKU-FINAL | 事業再構築補助金（最終12回） | 5,000万円 |
| SHORYOKUKA-IPPAN-06 | 省力化投資補助金（一般型）第6回 | 1億円 |
| RYOURITSU-SHUSSEI | 両立支援等助成金（出生時両立支援） | 60万円 |
| SHOUENE-KOUJOU-06 / SETSUBI-06 | 省エネ補助金 工場型/設備型 | 15億円/1億円 |

---

### 📌 v4.11.0 - 2026年度主要補助金データ一括投入

**v4.11.0 リリース（2026-02-08）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **新規追加 5件** | ✅ | ものづくり第23次, 新事業進出第3回, 成長加速化第2次, 事業承継M&A第14次, 新事業進出・ものづくり統合版 |
| **既存修復 5件** | ✅ | REAL-004〜008のdetail_json空白を全件修復 |
| **期限切れ非表示化 4件** | ✅ | ものづくりグローバル枠/成長分野/通常類型（22次受付終了）+事業再構築（最終回終了） |

---

### 📌 v4.10.0 - ダッシュボードTOP全面リニューアル + 書類アップロードUI改善

**v4.10.0 リリース（2026-02-08）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ダッシュボードTOP全面刷新** | ✅ | 補助金DBパネル追加（受付中/総数/検索可能/データソース表示） |
| **KPI実データ表示** | ✅ | チャット/ドラフト数をAPIから実データ取得（ハードコード0→動的） |
| **マッチング候補に受付中件数表示** | ✅ | 会社情報入力済みなら受付中補助金件数をリアルタイム表示 |
| **書類アップロードUI全面改善** | ✅ | 3カテゴリ8項目の必要書類チェックリスト追加 |
| **年度別書類案内** | ✅ | 2025年度/2024年度決算書、納税証明書、登記簿謄本等を明示 |
| **アップロード状態表示** | ✅ | 各書類のアップロード済み/未を一目で確認可能 |
| **Health API拡張** | ✅ | searchable_count(18,829)とtotal_subsidies(21,692)を追加 |
| **ステップガイドに書類準備追加** | ✅ | ステップ2.5として書類準備への導線を追加 |

**書類チェックリスト（3カテゴリ）:**
| カテゴリ | 重要度 | 書類 |
|---------|--------|------|
| 決算・財務書類 | ほぼ必須 | 2025年度決算書・2024年度決算書・納税証明書 |
| 法人関連書類 | 推奨 | 登記簿謄本・定款 |
| 事業計画・その他 | 任意 | 事業計画書・見積書・その他参考資料 |

---

### 📌 v4.9.1 - 検索パフォーマンス37倍高速化 + コスト画面バグ修正

**v4.9.1 リリース（2026-02-08）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **検索COUNT 37倍高速化** | ✅ | LENGTH(detail_json)条件除外 → 112ms→2ms |
| **検索DATA 2.3倍高速化** | ✅ | SELECT * → 必要カラムのみ → 98ms→42ms |
| **detail_json除外** | ✅ | 検索一覧からBLOB読み込みを排除、DBカラムを直接参照 |
| **コスト画面バグ修正** | ✅ | D1のUNION ALL制限（7件超過）→ バッチ分割で解決 |
| **検索インデックス追加** | ✅ | idx_cache_search_v2 + idx_cache_title |

---

### 📌 v4.9.0 - コスト管理全面改善 + SEARCH_BACKEND本番修正

**v4.9.0 リリース（2026-02-08）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **SEARCH_BACKEND=cache 本番反映** | ✅ | Cloudflare Pages secret設定 + デプロイで178件→18,829件に改善 |
| **コスト管理API全面改善** | ✅ | 全期間コスト(all_time)、月別推移(monthly)、インフラ使用状況(infra)追加 |
| **ダッシュボード コスト概要** | ✅ | 全期間コスト表示、呼び出し数、月別推移テーブル、インフラ使用状況 |
| **/admin/costs 全面再設計** | ✅ | 6カードレイアウト、外部サービスリンク(Cloudflare/Firecrawl/AWS)、月別推移、DB行数 |
| **コスト計測の透明化** | ✅ | api_cost_logsの限界を明示、外部ダッシュボードリンク統合 |

**コストデータの実態（2026-02-08時点）:**
| サービス | 全期間コスト | 全期間呼び出し | 最終記録 | 備考 |
|---------|------------|-------------|---------|------|
| OpenAI | $0.0035 | 3 calls | 2026-01-28 | PDF構造化抽出のみ。壁打ちチャットはテンプレートベース |
| Firecrawl | $0.189 | 189 calls | 2026-01-28 | 1/28以降はsimple_scrapeに切替のため$0 |
| SimpleScrape | $0 | 1,767 calls | 稼働中 | 無料スクレイプ（Izumiクロール） |
| **合計** | **$0.1925** | **1,959 calls** | - | api_cost_logs記録分のみ |

**未計測コスト（外部確認必要）:** Cloudflare (Workers/D1/R2/Pages)、AWS (Lambda/API Gateway)、Firecrawl実課金額

---

### 📌 v4.8.1 - 管理画面ダッシュボード強化 + クロール進捗監視改善

**v4.8.0 リリース（2026-02-08）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **SEARCH_BACKEND=cache** | ✅ | subsidy_cacheから直接検索に切替、全21,692件が検索対象 |
| **検索件数 178→18,809件** | ✅ | Izumi/tokyo系含む全ソースが検索に反映 |
| **searchFromCache修正** | ✅ | SQL直接ページネーション（旧fetchLimit=100問題を解消） |
| **acceptance_end_datetimeカラム同期** | ✅ | クロール結果をsubsidy_cacheテーブルに反映 |
| **simpleScrapeコスト記録** | ✅ | logSimpleScrapeCost()追加、管理画面で可視化 |
| **tokyo系expires_at修正** | ✅ | 期限切れで検索から消えていた問題を修正 |
| **DATA-PIPELINE.md** | ✅ | パイプライン設計書・運用ルールを文書化 |

**v4.8.0 根本原因と解決:**
```
問題: 検索結果が178件しか出ない
原因: SEARCH_BACKEND=ssotが subsidy_canonical (2,903件) を検索
     → Izumi 18,651件は subsidy_cache にのみ存在
     → canonical昇格パイプラインが未構築
解決: SEARCH_BACKEND=cache に切替えて全21,692件を検索対象に
     → wall_chat_ready=1 かつ期限内のもの: 18,809件が検索可能
```

**検索結果の内訳（2026-02-08時点）:**
| Source | 検索可能件数 | 備考 |
|--------|-------------|------|
| izumi | ~18,580 | 全国の補助金・助成金 |
| jgrants | ~177 | 受付中かつ期限内 |
| tokyo-kosha | 5 | 東京都中小企業振興公社 |
| tokyo-shigoto | 22 | 東京しごと財団 |
| tokyo-hataraku | 15 | TOKYOはたらくネット |
| manual | 10 | 手動登録の主要補助金 |

**コスト記録状況:**
| サービス | 記録件数 | 備考 |
|----------|---------|------|
| simple_scrape | 211件 | Izumiクロール（$0/回） |
| firecrawl | 189件 | PDF/HTML抽出（$0.001/credit） |
| openai | 3件 | GPT-4o推論 |

**v4.8.0 成果物:**
| ファイル | 変更内容 |
|----------|----------|
| `src/lib/jgrants-adapter.ts` | searchFromCache: SQL直接ページネーション、wall_chat_excludedフィルタ追加 |
| `src/routes/cron/izumi-promote.ts` | acceptance_end_datetimeカラム同期、logSimpleScrapeCost統合 |
| `src/lib/cost/cost-logger.ts` | logSimpleScrapeCost()関数追加 |
| `src/routes/admin-dashboard/dashboard-kpi.ts` | /costs にsimple_scrape統計追加 |
| `wrangler.jsonc` | SEARCH_BACKEND env変数追加 |
| `DATA-PIPELINE.md` | パイプライン全体設計書（新規作成） |

---

### 🎉 過去アップデート (v4.5.0) - Freeze-MATCH Gate + 壁打ち機能改善

<details>
<summary>v4.5.0 詳細（2026-02-05）</summary>

| 項目 | 状態 | 詳細 |
|------|------|------|
| **Freeze-MATCH Gate A-D** | ✅ | v2スクリーニング統一、canonical_id厳格化、chat_facts凍結、missing_fields→Gate導線 |
| **Freeze-WALLCHAT** | ✅ | 壁打ち質問の input_type パターンマッチ推測 + 多様な質問タイプ対応 |
| **ものづくり補助金22次** | ✅ | SSOT追加、監視登録、壁打ち質問12問 |

</details>

---

### 🎉 過去アップデート (v4.4.0) - Phase A-3: 他API追随 + SSOT統一

**v4.4.0 リリース（2026-02-05）:**

| 項目 | 状態 | 詳細 |
|------|------|------|
| **Phase A-3 完了** | ✅ | 他API（eligibility/documents/expenses/bonus-points）を normalized 経由へ統一 |
| **getNormalizedSubsidyDetail** | ✅ Freeze | 全APIで共有するSSOT読み取り関数（A-3-0） |
| **chat.ts normalized対応** | ✅ | input_type 推測ロジック排除、normalized.wall_chat.questions のみ参照 |

**Phase A-3 成果物:**
| ファイル | 役割 |
|----------|------|
| `src/lib/ssot/getNormalizedSubsidyDetail.ts` | SSOT共通読み取り関数（全APIで使用） |
| `src/routes/subsidies.ts` | eligibility/documents/expenses/bonus-points を normalized 経由に置換 |
| `src/routes/chat.ts` | normalized のみ参照、input_type 推測排除 |

**A-3 API変更点:**
| エンドポイント | 変更内容 |
|----------------|----------|
| `/api/subsidies/:id/eligibility` | `normalized.content.eligibility_rules` を SSOT として返却 |
| `/api/subsidies/:id/documents` | `normalized.content.required_documents` を SSOT として返却 |
| `/api/subsidies/:id/expenses` | `normalized.content.eligible_expenses` を SSOT として返却 |
| `/api/subsidies/:id/bonus-points` | `normalized.content.bonus_points` を SSOT として返却 |

**APIレスポンス例（eligibility）:**
```json
{
  "success": true,
  "data": [
    {
      "category": "基本要件",
      "rule_text": "中小企業・小規模事業者であること",
      "check_type": "MANUAL",
      "source": "公募要領より"
    }
  ],
  "meta": {
    "source": "normalized",
    "canonical_id": "IT-SUBSIDY-2026"
  }
}
```

**chat.ts 変更点（A-3-5）:**
- `performPrecheck()`: normalized から電子申請情報・補助金情報を取得
- `generateAdditionalQuestions()`: normalized.wall_chat.questions のみ参照
- input_type 推測禁止: 定義されていなければ text 固定（normalizeSubsidyDetail で処理済み）

**ガード事項:**
- DEBUG_SSOT=1 のときのみログ出力
- adapter 縮退（normalized 成功時は legacy 参照を減らす方向）
- Fallback 維持: eligibility_rules / required_documents_by_subsidy テーブルにデータがある場合は従来通り返す

---

### 🎉 過去アップデート (v4.3.0) - NormalizedSubsidyDetail v1.0 Freeze + Phase A-1/A-2完了

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

**データ状況（v4.8 - 2026-02-08）:**
| Metric | Count | Percent | 備考 |
|--------|-------|---------|------|
| **Total Cache** | **21,692** | 100% | 全ソース統合 |
| **Ready** | **20,250** | **93.4%** | izumi大量投入 + 除外修正で達成 |
| **Searchable** | **18,809** | **86.7%** | 検索に表示される件数 |
| Excluded | 379 | 1.7% | 除外判定（KOFU_SHINSEI修正済） |
| Not Ready | 1,063 | 4.9% | 情報不足（jGrants expired等）|

**ソース別内訳:**
| Source | Total | Ready | Excluded | Not Ready |
|--------|-------|-------|----------|-----------|
| izumi | 18,651 | 18,580 | 71 | 0 |
| jgrants | 2,932 | 1,597 | 308 | 1,027 |
| tokyo-shigoto | 28 | 22 | 0 | 6 |
| jnet21 | 24 | 0 | 0 | 24 |
| tokyo-kosha | 23 | 23 | 0 | 0 |
| manual | 19 | 13 | 0 | 6 |
| tokyo-hataraku | 15 | 15 | 0 | 0 |

**クロール品質（izumi support_url → detail_json）:**
| 品質レベル | 件数 | 状態 |
|-----------|------|------|
| crawl_v2（実データ） | ~5,100+ | 公式サイトからHTML抽出済（バッチ進行中） |
| fallback_v1（タイトル自動生成） | ~13,500 | クロール中（サンドボックスバッチ+Cron毎時10件） |
| crawl_error（404等） | ~500 | リンク切れ/PDF/SSL |

**hojyokin-cron Worker（自動スケジュール）:**
- `0 21 * * *` (06:00 JST): JGrants同期 + daily-ready-boost + recalc
- `0 */1 * * *` (毎時): izumi support_url クロール（10件/回）
- URL: https://hojyokin-cron.sekiyadubai.workers.dev

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

### AI駆動開発用 コード品質チェックガイドライン

**必須チェック項目（全変更に適用）:**

| # | チェック項目 | 説明 |
|---|------------|------|
| 1 | **型安全性** | TypeScript の型定義が正確か。any の多用を避ける |
| 2 | **エラーハンドリング** | try-catch で保護、ユーザーにわかりやすいエラーメッセージ |
| 3 | **SQL インジェクション防止** | バインドパラメータ（?）を使用、文字列結合禁止 |
| 4 | **コスト記録** | 外部API呼び出しには必ずコストログを記録（成功・失敗とも） |
| 5 | **冪等性** | Cron/バッチ処理は複数回実行しても安全か |
| 6 | **ページネーション** | 大量データ取得時は LIMIT/OFFSET を SQL で処理（JS で slice しない） |
| 7 | **環境変数管理** | シークレットは wrangler secret / .dev.vars で管理、コードに埋め込まない |
| 8 | **Workers ランタイム制約** | fs, path, child_process 等の Node.js API を使わない |

**推奨チェック項目:**

| # | チェック項目 | 説明 |
|---|------------|------|
| 9 | **データ整合性** | detail_json 内のフィールドとテーブルカラムの同期（例: acceptance_end_datetime） |
| 10 | **ログ出力** | デバッグ用ログは `console.log` + `[モジュール名]` プレフィックス |

**出力ルール:**
- 懸念点がある場合は `// TODO: 要確認 - [理由]` をコメントに付記
- 未確定のビジネスロジックには `// TODO: 要確認` を付記
- 既知の制約・ワークアラウンドには `// WORKAROUND:` を付記

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

### 運用ルール

1. **新しいデータソースを追加したら、必ず以下を実装する**（→ DATA-PIPELINE.md 2.1参照）:
   - subsidy_cache 投入
   - wall_chat_ready 判定
   - acceptance_end_datetime 設定
   - expires_at 設定
   - コスト記録
   - 管理画面反映
   - canonical 昇格パイプライン（Phase D以降）

2. **期限切れ補助金は自動非表示**（WHERE条件で制御）。DB削除はしない。

3. **全外部API呼び出しにコストログを記録する**（成功・失敗とも）。

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
├── DATA-PIPELINE.md           # データパイプライン設計書・運用ルール
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

1. **canonical昇格パイプライン（Phase D）**
   - Izumi → subsidy_canonical → subsidy_snapshot への正規化
   - 完了後に SEARCH_BACKEND を ssot に戻す
   - 重複統合（go.jp系516件の重複可能性）

2. **SuperAdmin管理画面更新（Phase C）**
   - ダッシュボードKPIをsubsidy_cacheベースに更新
   - simple_scrapeコスト可視化の充実
   - canonical vs cache のギャップ可視化

3. **期限切れ自動管理（Phase E）**
   - 期限切れ補助金の自動非表示は実装済み（WHERE条件）
   - 次期公募の自動検出と`acceptance_end_datetime`更新
   - `data_source_monitors`テーブルによる監視対象URL管理

### 優先度: 中

1. **Izumiクロール品質向上**
   - 残り約14,000件のfallback_v1 → crawl_v2アップグレード
   - バッチクロール毎時10件（Cron）+ サンドボックスバッチ（並行）
   - 404エラー約500件のURL更新検討

2. **コスト管理の充実**
   - api_cost_logsの日次・月次サマリー自動化
   - 異常検知（コスト急増アラート）の実装
   - 月額コスト見積もりレポート

3. **JGrants expired復活**
   - 2,745件のexpiredレコードの次期公募チェック
   - JNet21 24件のready化（コンテンツ不足対応）

### 現状のデータ状況（2026-02-08）

| 項目 | 件数 | 備考 |
|------|------|------|
| subsidy_cache 総数 | **21,692件** | 全ソース統合 |
| 壁打ち可能(ready) | **20,250件** | 93.4% |
| **検索可能(searchable)** | **18,809件** | **v4.8で178件→18,809件に改善** |
| izumi投入 | **18,651件** | 情報の泉データ全量投入 |
| jGrants | **2,932件** | API同期済み |
| 東京都系 | **66件** | kosha+shigoto+hataraku |
| 手動投入 | **19件** | 主要補助金 |

---

## 📄 ライセンス

Private

---

## 🔄 更新履歴

- **2026-02-08 (v4.8.1)**: 管理画面ダッシュボード強化 - subsidy-overview APIバグ修正(overview_source→crawled_at判定)、/dashboard APIに補助金サマリー追加、Izumiクロール進捗にlast_run/daily_stats追加、フロントエンド: ミニサマリーカード4枚+クロール進捗5カラム+日別統計テーブル
- **2026-02-08 (v4.8.0)**: SEARCH_BACKEND=cache切替 - 検索178件→18,809件（100倍改善）、searchFromCacheのSQL直接ページネーション修正、acceptance_end_datetimeカラム同期、simpleScrapeコスト記録、tokyo系expires_at修正、DATA-PIPELINE.md作成
- **2026-02-07 (v4.6.0)**: Phase 2 izumi大量投入 - 18,651件をsubsidy_cacheに投入、ready-boost-izumiで18,618件をready化、全体ready率93.0%達成（1,563→20,181件）
- **2026-02-05 (v4.4.0)**: Phase A-3 完了 - 他API追随（eligibility/documents/expenses/bonus-points）を normalized 経由へ統一、getNormalizedSubsidyDetail.ts（SSOT共通読み取り関数）、chat.ts normalized対応（input_type 推測排除）
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

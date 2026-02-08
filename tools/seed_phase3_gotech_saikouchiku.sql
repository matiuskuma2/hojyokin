-- =====================================================
-- Phase 3: Go-Tech事業 + 事業再構築補助金 追加
-- =====================================================

-- 1. Go-Tech事業（成長型中小企業等研究開発支援事業）
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'GO-TECH-R8', 'manual',
  '成長型中小企業等研究開発支援事業（Go-Tech事業）令和8年度',
  45000000, '2/3', '全国',
  '2026-02-15T00:00:00Z', '2026-04-15T23:59:59Z',
  1, 1, 1, 1, 'pending', 80, 'GO-TECH',
  '{"subsidy_name":"成長型中小企業等研究開発支援事業（Go-Tech事業）令和8年度","subsidy_overview":"中小企業が大学・公設試験研究機関等と連携して行う研究開発や試作品開発、販路開拓の取組を最大3年間にわたり支援。ものづくり基盤技術やサービスの高度化を目指す。従来の「出資獲得枠」は「大型研究開発枠」に見直し予定。","subsidy_amount":"単年度4,500万円以下（通常枠）、単年度1億円以下（大型研究開発枠）","subsidy_rate":"2/3以内","target_company":"中小企業者（中小企業基本法に定義）で、大学・公設試等と共同体を構成して研究開発を実施する者","required_documents":["研究開発計画書","大学等との共同研究体制図","事業化計画書","経費明細書","e-Rad申請書"],"application_period":"令和8年2月中旬～4月中旬（予定）","official_url":"https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260114001.html","pdf_urls":{"事前予告":"https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260114001.html"},"key_points":["大学・公設試等との共同研究が必須要件","最大3年間の継続支援","e-Radでの電子申請","単年度4,500万円（通常枠）、1億円（大型枠）","2/3補助率","ものづくり基盤技術の高度化が目的","2月中旬公募開始予定"],"eligibility_notes":"中小企業者であること。大学や公設試験研究機関等と共同体を構成すること。e-Radへの事前登録が必要。","schedule":{"事前予告":"2026年1月14日","公募開始":"2026年2月中旬（予定）","公募締切":"2026年4月中旬（予定）"}}',
  '2026-12-31T23:59:59Z', datetime('now')
);

-- Go-Tech canonical
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('GO-TECH', '成長型中小企業等研究開発支援事業（Go-Tech事業）', 1, 'GO-TECH-R8', datetime('now'), datetime('now'));

-- Go-Tech snapshot
INSERT OR IGNORE INTO subsidy_snapshot (id, canonical_id, source_link_id, snapshot_at, detail_json)
VALUES ('snapshot-GO-TECH-R8-20260208', 'GO-TECH', 'GO-TECH-R8', '2026-02-08T00:00:00Z',
  '{"subsidy_name":"Go-Tech事業 令和8年度","status":"事前予告済・公募2月中旬開始予定","official_url":"https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260114001.html"}');

-- Go-Tech monitor
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, subsidy_cache_id, source_name, source_url,
  monitor_type, check_interval_hours, url_patterns, status, created_at, updated_at
) VALUES
('MONITOR-GO-TECH-R8', 'GO-TECH', 'GO-TECH-R8',
 'Go-Tech事業 令和8年度 中小企業庁 公募ページ',
 'https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260114001.html',
 'webpage', 12, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now'));

-- 2. 事業再構築補助金（最終回・参考情報として登録）
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'SAIKOUCHIKU-FINAL', 'manual',
  '事業再構築補助金（最終第12回 成長分野進出枠・コロナ回復加速化枠）',
  50000000, '1/2～2/3', '全国',
  '2024-10-01T00:00:00Z', '2025-07-31T23:59:59Z',
  0, 1, 1, 1, 'pending', 70, 'SAIKOUCHIKU',
  '{"subsidy_name":"事業再構築補助金（最終第12回）","subsidy_overview":"ポストコロナ時代の経済社会の変化に対応するため、中小企業等の新分野展開、事業転換、業種転換、業態転換、又は事業再編の取り組みを支援した補助金。第12回が最終回。2026年度からは「中小企業新事業進出補助金」に事実上移行。","subsidy_amount":"成長分野進出枠：最大5,000万円、コロナ回復加速化枠：最大1,000万円","subsidy_rate":"1/2～2/3","target_company":"ポストコロナに対応した事業再構築を行う中小企業・中堅企業","status":"受付終了（第12回が最終回）","official_url":"https://jigyou-saikouchiku.go.jp/","pdf_urls":{"公式サイト":"https://jigyou-saikouchiku.go.jp/"},"key_points":["第12回が最終回（2024年度で終了）","2026年度からは中小企業新事業進出補助金に引き継がれた","交付決定後の実績報告・収益納付手続きは継続中","事業再構築の要件は「売上高減少要件」の撤廃等で緩和されていた"],"eligibility_notes":"※受付終了。事業再構築補助金は第12回で終了。後継制度は中小企業新事業進出補助金。","successor":"SHINJIGYO-03"}',
  '2025-12-31T23:59:59Z', datetime('now')
);

-- 事業再構築 canonical
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('SAIKOUCHIKU', '事業再構築補助金', 0, 'SAIKOUCHIKU-FINAL', datetime('now'), datetime('now'));

-- 事業再構築 snapshot
INSERT OR IGNORE INTO subsidy_snapshot (id, canonical_id, source_link_id, snapshot_at, detail_json)
VALUES ('snapshot-SAIKOUCHIKU-FINAL-20260208', 'SAIKOUCHIKU', 'SAIKOUCHIKU-FINAL', '2026-02-08T00:00:00Z',
  '{"subsidy_name":"事業再構築補助金","status":"受付終了（最終第12回）","successor":"中小企業新事業進出補助金","official_url":"https://jigyou-saikouchiku.go.jp/"}');

-- 3. 中小企業省力化投資補助金（一般型）第6回公募予定の事前登録
-- ※第5回の後続、2026年度公募予定
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'SHORYOKUKA-IPPAN-06', 'manual',
  '中小企業省力化投資補助金（一般型）第6回公募（予定）',
  100000000, '1/2', '全国',
  '2026-03-01T00:00:00Z', '2026-06-30T23:59:59Z',
  0, 1, 1, 1, 'pending', 60, 'SHORYOKUKA-IPPAN',
  '{"subsidy_name":"中小企業省力化投資補助金（一般型）第6回公募（予定）","subsidy_overview":"中小企業等の人手不足解消に向けた省力化投資を支援。IoT・ロボット等の汎用的な省力化機器の導入による生産性向上を後押し。一般型は個別カスタム設備も対象。","subsidy_amount":"従業員5人以下：200万円～1,000万円、6-20人：500万円～1,500万円、21人以上：1,000万円～1億円","subsidy_rate":"1/2（小規模事業者は2/3）","target_company":"人手不足の状態にある中小企業・小規模事業者等","status":"第6回は2026年度公募予定","official_url":"https://shoryokuka.smrj.go.jp/ippan/","pdf_urls":{"第5回公募要領":"https://shoryokuka.smrj.go.jp/ippan/download/"},"key_points":["第5回の後続公募として2026年度に予定","一般型はカスタム設備も対象","IoT・ロボット・AI等の導入が対象","補助率は中小1/2、小規模2/3","人手不足の状態であることが要件"],"eligibility_notes":"人手不足の状態にあること（人手不足加点あり）。賃上げ要件あり。"}',
  '2026-12-31T23:59:59Z', datetime('now')
);

-- 省力化一般型 canonical update
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('SHORYOKUKA-IPPAN', '中小企業省力化投資補助金（一般型）', 1, 'SHORYOKUKA-IPPAN-06', datetime('now'), datetime('now'));
UPDATE subsidy_canonical SET latest_cache_id = 'SHORYOKUKA-IPPAN-06', is_active = 1, updated_at = datetime('now') WHERE id = 'SHORYOKUKA-IPPAN';

-- 4. 両立支援等助成金（出生時両立支援コース）- 人気の助成金
INSERT OR REPLACE INTO subsidy_cache (
  id, source, title, subsidy_max_limit, subsidy_rate,
  target_area_search, acceptance_start_datetime, acceptance_end_datetime,
  request_reception_display_flag, is_electronic_application, is_visible,
  wall_chat_ready, wall_chat_mode, detail_score, canonical_id,
  detail_json, expires_at, cached_at
) VALUES (
  'RYOURITSU-SHUSSEI', 'manual',
  '両立支援等助成金（出生時両立支援コース）',
  600000, '定額', '全国',
  '2025-04-01T00:00:00Z', '2026-03-31T23:59:59Z',
  1, 0, 1, 1, 'pending', 75, 'RYOURITSU-SHIEN',
  '{"subsidy_name":"両立支援等助成金（出生時両立支援コース）","subsidy_overview":"男性労働者が育児休業を取得しやすい雇用環境を整備し、育児休業の利用があった事業主に支給される助成金。男性の育児休業取得推進を目的。","subsidy_amount":"第1種：20万円（中小企業）、第2種：20万円～60万円（育休取得率上昇分）","subsidy_rate":"定額支給","target_company":"男性労働者が育児休業を取得しやすい雇用環境整備を行った事業主","required_documents":["支給申請書","育児休業取得者の出勤簿・賃金台帳","就業規則","雇用環境整備に関する措置の実施を証明する書類","育児休業申出書・取得確認書"],"application_period":"通年（育休取得から2ヶ月以内に申請）","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html","key_points":["男性労働者の育児休業取得が要件","中小企業は第1種20万円","第2種は育休取得率の上昇度合いに応じて加算","雇用環境整備措置（研修等）の実施が必須","通年申請可能","2025年度は男性育休取得率の目標引上げ"],"eligibility_notes":"雇用保険適用事業所の事業主であること。男性労働者が育児休業を5日以上取得すること。"}',
  '2026-03-31T23:59:59Z', datetime('now')
);

-- 両立支援 canonical
INSERT OR IGNORE INTO subsidy_canonical (id, name, is_active, latest_cache_id, created_at, updated_at)
VALUES ('RYOURITSU-SHIEN', '両立支援等助成金', 1, 'RYOURITSU-SHUSSEI', datetime('now'), datetime('now'));

-- 両立支援 snapshot
INSERT OR IGNORE INTO subsidy_snapshot (id, canonical_id, source_link_id, snapshot_at, detail_json)
VALUES ('snapshot-RYOURITSU-SHUSSEI-20260208', 'RYOURITSU-SHIEN', 'RYOURITSU-SHUSSEI', '2026-02-08T00:00:00Z',
  '{"subsidy_name":"両立支援等助成金（出生時両立支援コース）","status":"通年申請受付中","official_url":"https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html"}');

-- 両立支援 monitor
INSERT OR IGNORE INTO data_source_monitors (
  id, subsidy_canonical_id, subsidy_cache_id, source_name, source_url,
  monitor_type, check_interval_hours, url_patterns, status, created_at, updated_at
) VALUES
('MONITOR-RYOURITSU-SHUSSEI', 'RYOURITSU-SHIEN', 'RYOURITSU-SHUSSEI',
 '両立支援等助成金（出生時両立支援コース）厚労省ページ',
 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html',
 'webpage', 24, '[".*\\.pdf"]', 'active', datetime('now'), datetime('now'));

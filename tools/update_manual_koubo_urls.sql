-- 手動登録補助金: 公募要領PDF URL発見分の記録
-- 実行日: 2026-02-09
-- 公募要領PDF特定: 11 URLs, 17 subsidies

-- CEV-HOJO: クリーンエネルギー自動車導入促進補助金（CEV補助金）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.cev-pc.or.jp/hojo/v2h-v2l_pdf/R6ho/R6h_v2h_youryou_full.pdf', '$.公募要領PDF_source', 'https://www.cev-pc.or.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'CEV-HOJO';

-- JUDEN-INFRA-JISEDAI: クリーンエネルギー自動車導入促進補助金（CEV補助金）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.cev-pc.or.jp/hojo/v2h-v2l_pdf/R6ho/R6h_v2h_youryou_full.pdf', '$.公募要領PDF_source', 'https://www.cev-pc.or.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'JUDEN-INFRA-JISEDAI';

-- JUUDEN-INFRA: クリーンエネルギー自動車導入促進補助金（CEV補助金）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.cev-pc.or.jp/hojo/v2h-v2l_pdf/R6ho/R6h_v2h_youryou_full.pdf', '$.公募要領PDF_source', 'https://www.cev-pc.or.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'JUUDEN-INFRA';

-- SUISO-STATION: クリーンエネルギー自動車導入促進補助金（CEV補助金）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.cev-pc.or.jp/hojo/v2h-v2l_pdf/R6ho/R6h_v2h_youryou_full.pdf', '$.公募要領PDF_source', 'https://www.cev-pc.or.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'SUISO-STATION';

-- V2H-HOJO: クリーンエネルギー自動車導入促進補助金（CEV補助金）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.cev-pc.or.jp/hojo/v2h-v2l_pdf/R6ho/R6h_v2h_youryou_full.pdf', '$.公募要領PDF_source', 'https://www.cev-pc.or.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'V2H-HOJO';

-- CHIIKI-DATSUTANSO: 地域脱炭素移行・再エネ推進交付金
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://policies.env.go.jp/policy/roadmap/assets/grants/3-1-tokuteichiiki-sakusei-youryou.pdf', '$.公募要領PDF_source', 'https://policies.env.go.jp/policy/roadmap/grants/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-DATSUTANSO';

-- CHIHOU-SOUSEI: 地方創生推進交付金
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.chisou.go.jp/sousei/about/kouhukin/pdf/denenkohukin_2024_seidoyoukou.pdf', '$.公募要領PDF_source', 'https://www.chisou.go.jp/sousei/about/kouhukin/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIHOU-SOUSEI';

-- DATSUTANSO-SENKOU: 脱炭素先行地域づくり事業（地域脱炭素移行・再エネ推進交付金）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://policies.env.go.jp/policy/roadmap/assets/preceding-region/boshu-01/1st-DSC-gaiyo.pdf', '$.公募要領PDF_source', 'https://policies.env.go.jp/policy/roadmap/preceding-region/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'DATSUTANSO-SENKOU';

-- GREEN-BUTSURYU: グリーン物流パートナーシップ会議・物流CO2削減支援
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.greenpartnership.jp/guideline_ver3_2.pdf', '$.公募要領PDF_source', 'https://www.greenpartnership.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'GREEN-BUTSURYU';

-- JST-ASTEP: A-STEP（研究成果最適展開支援プログラム）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.jst.go.jp/a-step/koubo/files/2025_sangaku/ikusei_mensetsu.pdf', '$.公募要領PDF_source', 'https://www.jst.go.jp/a-step/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'JST-ASTEP';

-- JIZOKUKA-SOUGYOU-KOJIN: 小規模事業者持続化補助金（創業枠・個人事業主向け）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://s23.jizokukahojokin.info/noto/doc/s23_koubo1_noto.pdf', '$.公募要領PDF_source', 'https://r3.jizokukahojokin.info/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'JIZOKUKA-SOUGYOU-KOJIN';

-- MIRASAPO-PLUS: ミラサポplus（補助金・総合支援サイト）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://shoryokuka.smrj.go.jp/assets/pdf/application_guidelines_catalog.pdf', '$.公募要領PDF_source', 'https://mirasapo-plus.go.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'MIRASAPO-PLUS';

-- SAIKOUCHIKU-GREEN: 事業再構築補助金（グリーン成長枠）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://jigyou-saikouchiku.go.jp/pdf/koubo.pdf', '$.公募要領PDF_source', 'https://jigyou-saikouchiku.go.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'SAIKOUCHIKU-GREEN';

-- SAIKOUCHIKU-SEICHOU: 事業再構築補助金（グリーン成長枠）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://jigyou-saikouchiku.go.jp/pdf/koubo.pdf', '$.公募要領PDF_source', 'https://jigyou-saikouchiku.go.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'SAIKOUCHIKU-SEICHOU';

-- SAIKOUCHIKU-SUPPLY: 事業再構築補助金（グリーン成長枠）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://jigyou-saikouchiku.go.jp/pdf/koubo.pdf', '$.公募要領PDF_source', 'https://jigyou-saikouchiku.go.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'SAIKOUCHIKU-SUPPLY';

-- SHIZEN-SAIGAI-HOKEN: 自然災害債務整理ガイドライン（被災ローン減免制度）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://www.dgl.or.jp/guideline/pdf/helpdesk.pdf', '$.公募要領PDF_source', 'https://www.dgl.or.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'SHIZEN-SAIGAI-HOKEN';

-- UCHUU-KASOKU: 宇宙戦略基金（スターダストプログラム）
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.公募要領PDF_URL', 'https://fund.jaxa.jp/content/uploads/koboyokoku20250808.pdf', '$.公募要領PDF_source', 'https://fund.jaxa.jp/', '$.公募要領PDF_verified_at', datetime('now')), cached_at = datetime('now') WHERE id = 'UCHUU-KASOKU';

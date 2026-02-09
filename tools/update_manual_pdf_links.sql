-- 手動登録補助金: PDFリンクあり（公募要領キーワードなし）
-- 145 URLs, 196 subsidies

-- AGE-FRIENDLY
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11300000/001488063.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/newpage_09940.html', '$.PDF_total_count', 14, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'AGE-FRIENDLY';

-- AKIYA-KAITAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001712337.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000035.html', '$.PDF_total_count', 40, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'AKIYA-KAITAI';

-- AKIYA-SAISEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001712337.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000035.html', '$.PDF_total_count', 40, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'AKIYA-SAISEI';

-- AKIYA-SOUGOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001712337.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000035.html', '$.PDF_total_count', 40, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'AKIYA-SOUGOU';

-- AKIYA-TAISAKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001712337.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000035.html', '$.PDF_total_count', 40, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'AKIYA-TAISAKU';

-- BARRIERFREE-SEIBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/sogoseisaku/barrierfree/content/001349371.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/sogoseisaku/barrierfree/', '$.PDF_total_count', 36, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BARRIERFREE-SEIBI';

-- BOUEI-SUPPLY
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mod.go.jp/atla/jouhouhasshin/to_former_emp2023.pdf', '$.PDF_source_page', 'https://www.mod.go.jp/atla/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BOUEI-SUPPLY';

-- BIOMASS-TOSHI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/shokusan/biomass/attach/pdf/index-196.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/shokusan/biomass/', '$.PDF_total_count', 18, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BIOMASS-TOSHI';

-- AINU-SUISHIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.kantei.go.jp/jp/singi/ainusuishin/pdf/r06_chousa.pdf', '$.PDF_source_page', 'https://www.kantei.go.jp/jp/singi/ainusuishin/', '$.PDF_total_count', 71, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'AINU-SUISHIN';

-- BOUEKI-HOKEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.nexi.go.jp/product/booklet/pdf/pr01_01.pdf', '$.PDF_source_page', 'https://www.nexi.go.jp/product/', '$.PDF_total_count', 13, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BOUEKI-HOKEN';

-- BROADBAND-SEIBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001012494.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/joho_tsusin/broadband/', '$.PDF_total_count', 46, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BROADBAND-SEIBI';

-- BUTSURYU-JIDOUKA
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001633097.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/seisakutokatsu/freight/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BUTSURYU-JIDOUKA';

-- KYOUDOU-HAISOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001633097.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/seisakutokatsu/freight/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KYOUDOU-HAISOU';

-- MODAL-SHIFT
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001633097.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/seisakutokatsu/freight/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MODAL-SHIFT';

-- CAREER-UP-CHINGIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11910500/001510960.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html', '$.PDF_total_count', 52, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CAREER-UP-CHINGIN';

-- CAREER-UP-SHAKAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11910500/001510960.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html', '$.PDF_total_count', 52, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CAREER-UP-SHAKAI';

-- CAREER-UP-SHOUYO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11910500/001510960.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html', '$.PDF_total_count', 52, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CAREER-UP-SHOUYO';

-- BUKKA-JUUTEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.chisou.go.jp/tiiki/rinjikoufukin/pdf/20220401_sikkoujoukyou.pdf', '$.PDF_source_page', 'https://www.chisou.go.jp/tiiki/rinjikoufukin/', '$.PDF_total_count', 25, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BUKKA-JUUTEN';

-- CCUS-FUKYUU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.ccus.jp/files/documents/certification_reg_inst.pdf?20221124', '$.PDF_source_page', 'https://www.ccus.jp/', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CCUS-FUKYUU';

-- CHIIKI-DIGITAL-KIBAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/000939730.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/joho_tsusin/top/local_support/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-DIGITAL-KIBAN';

-- LOCAL-5G
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/000939730.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/joho_tsusin/top/local_support/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'LOCAL-5G';

-- CHIIKI-IOT
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/000516948.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/menu_seisaku/ictseisaku/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-IOT';

-- CHIIKI-IOT-JISSOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://pubpjt.mri.co.jp/pjt_related/dxrlp-info/f8bbcd00000002ij-att/20250704dxrlp-report_1.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/joho_tsusin/top/local_support/ict/', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-IOT-JISSOU';

-- CHIIKI-IRYO-KOSO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001462560.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-IRYO-KOSO';

-- CHITEKI-SHOUGAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001462560.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHITEKI-SHOUGAI';

-- JOSANSHI-KAKUHO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001462560.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JOSANSHI-KAKUHO';

-- YAKUZAISHI-KAKUHO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001462560.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'YAKUZAISHI-KAKUHO';

-- CF-MACHIDUKURI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.minto.or.jp/assets/pdf/about_management.pdf', '$.PDF_source_page', 'https://www.minto.or.jp/products/fund.html', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CF-MACHIDUKURI';

-- CHIIKI-IRYOU-KIKIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001287155.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000060713.html', '$.PDF_total_count', 74, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-IRYOU-KIKIN';

-- CHIIKI-KATSUDOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001053713.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-KATSUDOU';

-- CHIIKI-SEIKATSU-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001472678.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/shougaishahukushi/chiiki/', '$.PDF_total_count', 17, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-SEIKATSU-SHIEN';

-- CHIIKI-TETSUDOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001253579.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/tetudo/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIIKI-TETSUDOU';

-- CHIKUSAN-KIKAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/chikusan/kikaku/lin/attach/pdf/index-44.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/chikusan/kikaku/lin/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIKUSAN-KIKAI';

-- CHIKUDENCHI-KATEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://sii.or.jp/uploads/general_employer_action_plan_sii.pdf', '$.PDF_source_page', 'https://sii.or.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIKUDENCHI-KATEI';

-- CHUSHO-SHOUENE-SETSUBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://sii.or.jp/uploads/general_employer_action_plan_sii.pdf', '$.PDF_source_page', 'https://sii.or.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHUSHO-SHOUENE-SETSUBI';

-- BUNKAZAI-HOZON
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.bunka.go.jp/seisaku/bunkazai/bunkazai_hozon/pdf/93855501_01.pdf', '$.PDF_source_page', 'https://www.bunka.go.jp/seisaku/bunkazai/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BUNKAZAI-HOZON';

-- BUNKAZAI-KATSUYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.bunka.go.jp/seisaku/bunkazai/bunkazai_hozon/pdf/93855501_01.pdf', '$.PDF_source_page', 'https://www.bunka.go.jp/seisaku/bunkazai/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'BUNKAZAI-KATSUYOU';

-- CHOUJU-HIGAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/seisan/tyozyu/higai/attach/pdf/index-35.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/seisan/tyozyu/higai/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHOUJU-HIGAI';

-- CHOUJUU-HIGAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/seisan/tyozyu/higai/attach/pdf/index-35.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/seisan/tyozyu/higai/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHOUJUU-HIGAI';

-- CHIZAI-SOUDAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://chizai-portal.inpit.go.jp/supportcase/pdf/pdf_supportcase_230925_S01.pdf', '$.PDF_source_page', 'https://chizai-portal.inpit.go.jp/', '$.PDF_total_count', 43, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHIZAI-SOUDAN';

-- INPIT-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://chizai-portal.inpit.go.jp/supportcase/pdf/pdf_supportcase_230925_S01.pdf', '$.PDF_source_page', 'https://chizai-portal.inpit.go.jp/', '$.PDF_total_count', 43, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'INPIT-SHIEN';

-- CHUUSANKAN-SHIHARAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/nousin/tyusan/siharai_seido/attach/pdf/index-123.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/nousin/tyusan/siharai_seido/', '$.PDF_total_count', 48, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHUUSANKAN-SHIHARAI';

-- CYBER-OTASUKE
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.ipa.go.jp/security/sme/ps6vr7000001hnrl-att/otasuketai-leaflet.pdf', '$.PDF_source_page', 'https://www.ipa.go.jp/security/otasuketai-pr/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CYBER-OTASUKE';

-- CHUTAIKYO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://chutaikyo.taisyokukin.go.jp/topics/PDF/k_sns.pdf', '$.PDF_source_page', 'https://chutaikyo.taisyokukin.go.jp/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHUTAIKYO';

-- CHUTAIKYO-SEIDO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://chutaikyo.taisyokukin.go.jp/topics/PDF/k_sns.pdf', '$.PDF_source_page', 'https://chutaikyo.taisyokukin.go.jp/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'CHUTAIKYO-SEIDO';

-- COOL-JAPAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.cj-fund.co.jp/files/press_260123-jp.pdf', '$.PDF_source_page', 'https://www.cj-fund.co.jp/', '$.PDF_total_count', 17, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'COOL-JAPAN';

-- DENSHOKU-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001041866.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'DENSHOKU-SHIEN';

-- ICT-RIKATSUYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001041866.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'ICT-RIKATSUYOU';

-- KINKYUU-SHUNSETSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001041866.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KINKYUU-SHUNSETSU';

-- DIGITAL-AI-KIBAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://it-shien.smrj.go.jp/pdf/2025_petitionperiod_jisseki.pdf', '$.PDF_source_page', 'https://it-shien.smrj.go.jp/', '$.PDF_total_count', 9, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'DIGITAL-AI-KIBAN';

-- DOUBUTSU-AIGO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.env.go.jp/nature/dobutsu/aigo/2_data/pamph/poster04.pdf', '$.PDF_source_page', 'https://www.env.go.jp/nature/dobutsu/aigo/', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'DOUBUTSU-AIGO';

-- FOOD-LOSS
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/shokusan/recycle/syokuhin/s_houkoku/kekka/attach/pdf/gaiyou-140.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/shokusan/recycle/syoku_loss/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'FOOD-LOSS';

-- FOOD-LOSS-SUISHIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/shokusan/recycle/syokuhin/s_houkoku/kekka/attach/pdf/gaiyou-140.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/shokusan/recycle/syoku_loss/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'FOOD-LOSS-SUISHIN';

-- FOOD-LOSS-SAKUGEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.caa.go.jp/policies/policy/consumer_policy/information/food_loss/efforts/assets/efforts_230324_0002.pdf', '$.PDF_source_page', 'https://www.caa.go.jp/policies/policy/consumer_policy/information/food_loss/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'FOOD-LOSS-SAKUGEN';

-- FUKUGYOU-KENGYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11200000/000962665.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192188.html', '$.PDF_total_count', 17, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'FUKUGYOU-KENGYOU';

-- FURUSATO-TELEWORK
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001054685.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/joho_tsusin/telework/', '$.PDF_total_count', 35, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'FURUSATO-TELEWORK';

-- GREEN-SLOW-MOBILITY
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001288704.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/sogoseisaku/environment/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'GREEN-SLOW-MOBILITY';

-- HATARAKIKATA-DANTAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001467917.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html', '$.PDF_total_count', 10, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HATARAKIKATA-DANTAI';

-- HATARAKIKATA-GYOUSHU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001467917.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html', '$.PDF_total_count', 10, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HATARAKIKATA-GYOUSHU';

-- HATARAKIKATA-TEKIYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001467917.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html', '$.PDF_total_count', 10, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HATARAKIKATA-TEKIYOU';

-- HEATPUMP-SANGYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.env.go.jp/content/000303694.pdf', '$.PDF_source_page', 'https://www.env.go.jp/earth/ondanka/biz_local.html', '$.PDF_total_count', 18, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HEATPUMP-SANGYOU';

-- TAIYOUKOU-JIKASOHI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.env.go.jp/content/000303694.pdf', '$.PDF_source_page', 'https://www.env.go.jp/earth/ondanka/biz_local.html', '$.PDF_total_count', 18, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TAIYOUKOU-JIKASOHI';

-- ZEB-JISSHOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.env.go.jp/content/000303694.pdf', '$.PDF_source_page', 'https://www.env.go.jp/earth/ondanka/biz_local.html', '$.PDF_total_count', 18, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'ZEB-JISSHOU';

-- HOIKUJO-SEIBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/e4b817c9-5282-4ccc-b0d5-ce15d7b5018c/82235d91/20251029_policies_hoiku_162.pdf', '$.PDF_source_page', 'https://www.cfa.go.jp/policies/hoiku/', '$.PDF_total_count', 127, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HOIKUJO-SEIBI';

-- HISAISHA-SAIKEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.bousai.go.jp/taisaku/seikatsusaiken/pdf/h12ckousa.pdf', '$.PDF_source_page', 'https://www.bousai.go.jp/taisaku/seikatsusaiken/', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HISAISHA-SAIKEN';

-- I-CONSTRUCTION
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/tec/i-construction/pdf/sekoujiki_heijunka.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/tec/i-construction/', '$.PDF_total_count', 19, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'I-CONSTRUCTION';

-- IRYOU-SETSUBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/file/06-Seisakujouhou-10800000-Iseikyoku/0000112535.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/', '$.PDF_total_count', 11, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'IRYOU-SETSUBI';

-- IRYOU-TAISHIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/file/06-Seisakujouhou-10800000-Iseikyoku/0000112535.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/', '$.PDF_total_count', 11, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'IRYOU-TAISHIN';

-- IJUU-KIGYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.chisou.go.jp/sousei/pdf/r7_ichiran.pdf', '$.PDF_source_page', 'https://www.chisou.go.jp/sousei/ijyu_shienkin.html', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'IJUU-KIGYOU';

-- IJUU-SHIENKIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.chisou.go.jp/sousei/pdf/r7_ichiran.pdf', '$.PDF_source_page', 'https://www.chisou.go.jp/sousei/ijyu_shienkin.html', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'IJUU-SHIENKIN';

-- IRYOUTEKI-CARE
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/7612b45c-aad3-4503-9026-12d01277b181/5b9a93ef/20260107_policies_shougaijishien_18.pdf', '$.PDF_source_page', 'https://www.cfa.go.jp/policies/shougaijishien/', '$.PDF_total_count', 9, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'IRYOUTEKI-CARE';

-- J-CREDIT
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://japancredit.go.jp/data/pdf/credit_002.pdf', '$.PDF_source_page', 'https://japancredit.go.jp/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'J-CREDIT';

-- HYOGO-SEICHOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://web.hyogo-iic.ne.jp/files/uploads/JUMP2309.pdf', '$.PDF_source_page', 'https://web.hyogo-iic.ne.jp/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'HYOGO-SEICHOU';

-- JIGYOSHOKEI-HAIGYO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://jsh.go.jp/r5h/assets/pdf/07/webinar_information-20231013.pdf', '$.PDF_source_page', 'https://jsh.go.jp/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JIGYOSHOKEI-HAIGYO';

-- JIGYOSHOKEI-SENMONKA
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://jsh.go.jp/r5h/assets/pdf/07/webinar_information-20231013.pdf', '$.PDF_source_page', 'https://jsh.go.jp/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JIGYOSHOKEI-SENMONKA';

-- JAXA-TANSAKAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.ihub-tansa.jaxa.jp/assets/pdf/JAXA_Pamphlet_A3_a.pdf', '$.PDF_source_page', 'https://www.ihub-tansa.jaxa.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JAXA-TANSAKAI';

-- JICA-CHUSHO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jica.go.jp/activities/schemes/priv_partner/activities/sme/__icsFiles/afieldfile/2024/08/20/OrgClassChart.pdf', '$.PDF_source_page', 'https://www.jica.go.jp/priv_partner/activities/sme/', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JICA-CHUSHO';

-- JICA-SME-KAIGAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jica.go.jp/activities/schemes/priv_partner/activities/sme/__icsFiles/afieldfile/2024/08/20/OrgClassChart.pdf', '$.PDF_source_page', 'https://www.jica.go.jp/priv_partner/activities/sme/', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JICA-SME-KAIGAI';

-- JINZAI-HITO-TOUSHI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11800000/001469655.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html', '$.PDF_total_count', 41, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JINZAI-HITO-TOUSHI';

-- JINZAI-KYUUKA
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11800000/001469655.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html', '$.PDF_total_count', 41, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JINZAI-KYUUKA';

-- JOSEI-KATSUYAKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11900000/001620180.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000091025.html', '$.PDF_total_count', 79, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JOSEI-KATSUYAKU';

-- JOSEI-KATSUYAKU-NINTEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11900000/001620180.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000091025.html', '$.PDF_total_count', 79, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JOSEI-KATSUYAKU-NINTEI';

-- JETRO-KAIGAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jetro.go.jp/ext_images/services/pdf/jetroservice202507_02.pdf', '$.PDF_source_page', 'https://www.jetro.go.jp/services/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JETRO-KAIGAI';

-- JISEDAI-IKUSEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/000860545.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/kurumin/', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JISEDAI-IKUSEI';

-- KURUMIN-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/000860545.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/kurumin/', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KURUMIN-SHIEN';

-- JINZAI-KAKUHO-TELEWORK
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11909000/001469620.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/telework_zyosei_R3.html', '$.PDF_total_count', 10, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JINZAI-KAKUHO-TELEWORK';

-- JINZAI-KAKUHO-GAIKOKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11650000/001469824.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/gaikokujin.html', '$.PDF_total_count', 23, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JINZAI-KAKUHO-GAIKOKU';

-- JST-CREST
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jst.go.jp/senryaku/migration/kisoken/crest/sympo/20260319cp_drm.pdf', '$.PDF_source_page', 'https://www.jst.go.jp/kisoken/crest/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JST-CREST';

-- JUDOU-KITSUEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11303000/001500045.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000049868.html', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JUDOU-KITSUEN';

-- JUTAKU-SAFETYNET
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001760403.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000055.html', '$.PDF_total_count', 71, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JUTAKU-SAFETYNET';

-- SAFETY-NET-JUTAKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001760403.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000055.html', '$.PDF_total_count', 71, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SAFETY-NET-JUTAKU';

-- JST-SAKIGAKE
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jst.go.jp/senryaku/migration/kisoken/crest/sympo/20260319cp_drm.pdf', '$.PDF_source_page', 'https://www.jst.go.jp/kisoken/presto/', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JST-SAKIGAKE';

-- JUTAKU-TAISHIN-STOCK
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001864404.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr_000043.html', '$.PDF_total_count', 20, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JUTAKU-TAISHIN-STOCK';

-- TAISHIN-KAISHU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001864404.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_fr_000043.html', '$.PDF_total_count', 20, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TAISHIN-KAISHU';

-- KAIGAI-TENKAI-YUSHI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jfc.go.jp/n/release/pdf/topics_260206a.pdf', '$.PDF_source_page', 'https://www.jfc.go.jp/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KAIGAI-TENKAI-YUSHI';

-- JYUTAKU-SHOUENE-2025
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://jutaku-shoene2025.mlit.go.jp/assets/doc/about_account.pdf', '$.PDF_source_page', 'https://kosodate-green.mlit.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'JYUTAKU-SHOUENE-2025';

-- KAIGO-ICT
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/12300000/000654357.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000209634.html', '$.PDF_total_count', 140, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KAIGO-ICT';

-- KAIGO-ROBOT
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/12300000/000654357.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000209634.html', '$.PDF_total_count', 140, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KAIGO-ROBOT';

-- KAIGO-SHISETSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/000778218.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KAIGO-SHISETSU';

-- KAGAWA-FOOD
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.pref.kagawa.lg.jp/documents/57439/kasuharakihonhoushin20251020.pdf', '$.PDF_source_page', 'https://www.pref.kagawa.lg.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KAGAWA-FOOD';

-- KAKI-SHINKOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/seisan/kaki/flower/attach/pdf/index-124.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/seisan/kaki/flower/', '$.PDF_total_count', 13, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KAKI-SHINKOU';

-- KASO-CHIIKI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/000753094.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/2001/kaso/kasomain0.htm', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KASO-CHIIKI';

-- KENKOU-ZOUSHIN-TOKUTEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001196621.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/bunya/shakaihosho/iryouseido01/info02a.html', '$.PDF_total_count', 73, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KENKOU-ZOUSHIN-TOKUTEI';

-- KIGYOU-FURUSATO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.chisou.go.jp/tiiki/tiikisaisei/portal/pdf/ninteisinseihen15.pdf', '$.PDF_source_page', 'https://www.chisou.go.jp/tiiki/tiikisaisei/kigyou_furusato.html', '$.PDF_total_count', 73, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KIGYOU-FURUSATO';

-- KOKUMIN-KENKO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001196621.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000161103.html', '$.PDF_total_count', 73, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOKUMIN-KENKO';

-- KENTAIKYO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.kentaikyo.taisyokukin.go.jp/news/documents/counterfei_s_k.pdf', '$.PDF_source_page', 'https://www.kentaikyo.taisyokukin.go.jp/', '$.PDF_total_count', 12, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KENTAIKYO';

-- KOUCHIN-KOUJOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/file/06-Seisakujouhou-12200000-Shakaiengokyokushougaihokenfukushibu/0000159854.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/shougaishahukushi/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUCHIN-KOUJOU';

-- SHOUGAI-FUKUSHI-HOUSHU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/file/06-Seisakujouhou-12200000-Shakaiengokyokushougaihokenfukushibu/0000159854.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/shougaishahukushi/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUGAI-FUKUSHI-HOUSHU';

-- SHOUGAI-GH
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/file/06-Seisakujouhou-12200000-Shakaiengokyokushougaihokenfukushibu/0000159854.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/shougaishahukushi/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUGAI-GH';

-- KOUREISHA-HYOUKA
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001233792.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000139692.html', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUREISHA-HYOUKA';

-- KOUREISHA-KEIZOKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001233792.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000139692.html', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUREISHA-KEIZOKU';

-- KOUKYOU-KOUTSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/sogoseisaku/transport/content/001731593.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/sogoseisaku/transport/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUKYOU-KOUTSU';

-- KOKUDO-CHIIKI-KEIKAKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.cas.go.jp/jp/seisaku/kokudo_kyoujinka/pdf/R5_top_poster_r0507.pdf', '$.PDF_source_page', 'https://www.cas.go.jp/jp/seisaku/kokudo_kyoujinka/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOKUDO-CHIIKI-KEIKAKU';

-- KOKUDO-KOUFUKIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.cas.go.jp/jp/seisaku/kokudo_kyoujinka/pdf/R5_top_poster_r0507.pdf', '$.PDF_source_page', 'https://www.cas.go.jp/jp/seisaku/kokudo_kyoujinka/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOKUDO-KOUFUKIN';

-- KOKUSAI-KYOURYOKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jica.go.jp/activities/schemes/priv_partner/partner/2024/__icsFiles/afieldfile/2024/06/19/SIAC_Tokyo_Conference_2024.pdf', '$.PDF_source_page', 'https://www.jica.go.jp/priv_partner/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOKUSAI-KYOURYOKU';

-- KOUWAN-BUTSURYU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001103000.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/kowan/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUWAN-BUTSURYU';

-- KOUWAN-SHISETSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001103000.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/kowan/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUWAN-SHISETSU';

-- KOYOU-CHOUSEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11600000/000919896.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html', '$.PDF_total_count', 59, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOYOU-CHOUSEI';

-- KOYOU-CHOUSEI-KINKYUU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11600000/000919896.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html', '$.PDF_total_count', 59, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOYOU-CHOUSEI-KINKYUU';

-- KYOIKU-KUNREN-KYUFU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001155029.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/kyouiku.html', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KYOIKU-KUNREN-KYUFU';

-- KYOUIKU-KUNREN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001155029.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/kyouiku.html', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KYOUIKU-KUNREN';

-- KOUREISHA-65CHO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jeed.go.jp/elderly/subsidy/q2k4vk000001h38d-att/q2k4vk000004il9b.pdf', '$.PDF_source_page', 'https://www.jeed.go.jp/elderly/subsidy/subsidy_keizoku.html', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUREISHA-65CHO';

-- KOUNENREI-KOYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jeed.go.jp/jeed/q2k4vk000001ki22-att/a1695259202161.pdf', '$.PDF_source_page', 'https://www.jeed.go.jp/elderly/subsidy/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KOUNENREI-KOYOU';

-- KUSANONE-GIJUTSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jica.go.jp/activities/schemes/partner/kusanone/__icsFiles/afieldfile/2025/07/11/kusanone202507.pdf', '$.PDF_source_page', 'https://www.jica.go.jp/partner/kusanone/index.html', '$.PDF_total_count', 9, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KUSANONE-GIJUTSU';

-- MAAS-SUISHIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/sogoseisaku/transport/content/001598497.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000117.html', '$.PDF_total_count', 22, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MAAS-SUISHIN';

-- KYUUTOU-SHOUENE-2025
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://jutaku-shoene2025.mlit.go.jp/assets/doc/about_account.pdf', '$.PDF_source_page', 'https://kyutou-shoene2025.meti.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KYUUTOU-SHOUENE-2025';

-- MIDORI-SHOKURYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/kanbo/kankyo/seisaku/midori/attach/pdf/index-10.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/kanbo/kankyo/seisaku/midori/', '$.PDF_total_count', 12, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MIDORI-SHOKURYOU';

-- MANSION-KANRI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/jutakukentiku/house/content/001965185.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk5_000052.html', '$.PDF_total_count', 26, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MANSION-KANRI';

-- MADO-RINOBE-2025
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://jutaku-shoene2025.mlit.go.jp/assets/doc/about_account.pdf', '$.PDF_source_page', 'https://window-renovation2025.env.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MADO-RINOBE-2025';

-- MICE-YUCHI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jnto.go.jp/news/nf20260123_4.pdf', '$.PDF_source_page', 'https://mice.jnto.go.jp/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MICE-YUCHI';

-- KUMIAI-KADAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.chuokai.or.jp/contents/english/english_nfsba.pdf', '$.PDF_source_page', 'https://www.chuokai.or.jp/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KUMIAI-KADAI';

-- KUMIAI-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.chuokai.or.jp/contents/english/english_nfsba.pdf', '$.PDF_source_page', 'https://www.chuokai.or.jp/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'KUMIAI-SHIEN';

-- MONODZUKURI-JINZAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001572345.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/jinzaikaihatsu/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MONODZUKURI-JINZAI';

-- MIE-KANKOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.pref.mie.lg.jp/common/content/001188877.pdf', '$.PDF_source_page', 'https://www.pref.mie.lg.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MIE-KANKOU';

-- MONODUKURI-BIZ
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://portal.monodukuri-hojo.jp/common/bunsho/はじめてのもの補助_20250407.pdf', '$.PDF_source_page', 'https://portal.monodukuri-hojo.jp/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MONODUKURI-BIZ';

-- MONODUKURI-SHOURYOKU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://portal.monodukuri-hojo.jp/common/bunsho/はじめてのもの補助_20250407.pdf', '$.PDF_source_page', 'https://portal.monodukuri-hojo.jp/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MONODUKURI-SHOURYOKU';

-- MYNUMBER-RIYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/000922184.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/kojinbango_card/', '$.PDF_total_count', 29, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MYNUMBER-RIYOU';

-- NAIKOU-KAIUN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001135517.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/maritime/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'NAIKOU-KAIUN';

-- MUKEI-BUNKA-HOGO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.bunka.go.jp/seisaku/bunkazai/shokai/mukei/pdf/94190101_01.pdf', '$.PDF_source_page', 'https://www.bunka.go.jp/seisaku/bunkazai/shokai/mukei/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'MUKEI-BUNKA-HOGO';

-- NOGYO-JISEDAI-KEIEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/new_farmer/pdf/handbook_2025.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/new_farmer/', '$.PDF_total_count', 19, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'NOGYO-JISEDAI-KEIEI';

-- NOGYOU-JISEDAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/new_farmer/pdf/handbook_2025.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/new_farmer/', '$.PDF_total_count', 19, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'NOGYOU-JISEDAI';

-- NOUGYOU-JINZAI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/new_farmer/pdf/handbook_2025.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/new_farmer/', '$.PDF_total_count', 19, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'NOUGYOU-JINZAI';

-- NOUSHOUKOU-RENKEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/shokusan/sanki/nosyoko/attach/pdf/index-91.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/shokusan/sanki/nosyoko/', '$.PDF_total_count', 21, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'NOUSHOUKOU-RENKEI';

-- ONLINE-SHINRYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/file/06-Seisakujouhou-10800000-Iseikyoku/0000100334.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/rinsyo/', '$.PDF_total_count', 58, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'ONLINE-SHINRYOU';

-- NPO-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.npo-homepage.go.jp/uploads/for-npohoujin-flyers.pdf', '$.PDF_source_page', 'https://www.npo-homepage.go.jp/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'NPO-SHIEN';

-- OKINAWA-IKKATSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www8.cao.go.jp/okinawa/8/2025/1223_tsushimamaru.pdf', '$.PDF_source_page', 'https://www8.cao.go.jp/okinawa/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'OKINAWA-IKKATSU';

-- PCB-SHORI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jesconet.co.jp/content/000022556.pdf', '$.PDF_source_page', 'https://www.jesconet.co.jp/', '$.PDF_total_count', 12, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'PCB-SHORI';

-- RITOU-KOURO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/001048756.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/maritime/maritime_tk1_000048.html', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'RITOU-KOURO';

-- RECURRENT-EDU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mext.go.jp/content/240510-mxt_syogai03-100000261_1.pdf', '$.PDF_source_page', 'https://www.mext.go.jp/a_menu/ikusei/manabinaoshi/', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'RECURRENT-EDU';

-- SAIGAI-HAIKIBUTSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.env.go.jp/content/000087678.pdf', '$.PDF_source_page', 'https://www.env.go.jp/recycle/waste/disaster/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SAIGAI-HAIKIBUTSU';

-- RYOURITSU-FUNIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001060156.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html', '$.PDF_total_count', 295, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'RYOURITSU-FUNIN';

-- RYOURITSU-IKUKYU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001060156.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html', '$.PDF_total_count', 295, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'RYOURITSU-IKUKYU';

-- RYOURITSU-KAIGO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001060156.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/index.html', '$.PDF_total_count', 295, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'RYOURITSU-KAIGO';

-- SANGYOU-KOYOU-ANNTEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11600000/000613613.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000082805_00002.html', '$.PDF_total_count', 25, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SANGYOU-KOYOU-ANNTEI';

-- SANSON-SHINKOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/nousin/tiiki/sanson/attach/pdf/index-8.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/nousin/tiiki/sanson/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SANSON-SHINKOU';

-- SECURITY-ACTION
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.ipa.go.jp/security/security-action/download/over400k.pdf', '$.PDF_source_page', 'https://www.ipa.go.jp/security/security-action/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SECURITY-ACTION';

-- SEIKATSU-KONKYUU-JIRITSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001563364.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000059425.html', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SEIKATSU-KONKYUU-JIRITSU';

-- SEIKATSU-KONKYUU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001563149.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000073432.html', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SEIKATSU-KONKYUU';

-- SEINEN-KOUKEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/000962561.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000202622.html', '$.PDF_total_count', 9, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SEINEN-KOUKEN';

-- SAKOUJU-SEIBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'http://www.mlit.go.jp/common/001170116.pdf', '$.PDF_source_page', 'https://www.satsuki-jutaku.jp/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SAKOUJU-SEIBI';

-- SHINRIN-KANKYO-ZEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.soumu.go.jp/main_content/001001827.pdf', '$.PDF_source_page', 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/04000067.html', '$.PDF_total_count', 18, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHINRIN-KANKYO-ZEI';

-- SHITAUKE-KAKEKOMI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.zenkyo.or.jp/kakekomi/pdf/name-change.pdf', '$.PDF_source_page', 'https://www.zenkyo.or.jp/kakekomi/', '$.PDF_total_count', 13, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHITAUKE-KAKEKOMI';

-- SHITAUKE-TEKISEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.zenkyo.or.jp/kakekomi/pdf/name-change.pdf', '$.PDF_source_page', 'https://www.zenkyo.or.jp/kakekomi/', '$.PDF_total_count', 13, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHITAUKE-TEKISEI';

-- SHOUBOU-DAN-SETSUBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.fdma.go.jp/disaster/info/items/20240101notohanntoujishinn122.pdf', '$.PDF_source_page', 'https://www.fdma.go.jp/', '$.PDF_total_count', 18, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUBOU-DAN-SETSUBI';

-- SHOKURYOU-ANZEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/zyukyu/anpo/attach/pdf/index-2.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/zyukyu/anpo/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOKURYOU-ANZEN';

-- SHOUBOUDAN-KYOUKA
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.fdma.go.jp/relocation/syobodan/item/data/policy/cooperation-system/torikumi-leaflet.pdf', '$.PDF_source_page', 'https://www.fdma.go.jp/relocation/syobodan/', '$.PDF_total_count', 11, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUBOUDAN-KYOUKA';

-- SHOUENE-SHINDAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.shindan-net.jp/pdf/news_250404.pdf', '$.PDF_source_page', 'https://www.shindan-net.jp/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUENE-SHINDAN';

-- SHOUGAI-KAIJO
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jeed.go.jp/disability/subsidy/om5ru80000001j13-att/s8vmin00000026tx.pdf', '$.PDF_source_page', 'https://www.jeed.go.jp/disability/subsidy/index.html', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUGAI-KAIJO';

-- SHOUGAI-SHISETSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jeed.go.jp/disability/subsidy/om5ru80000001j13-att/s8vmin00000026tx.pdf', '$.PDF_source_page', 'https://www.jeed.go.jp/disability/subsidy/index.html', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUGAI-SHISETSU';

-- SHOUGAI-SHUROU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jeed.go.jp/disability/subsidy/om5ru80000001j13-att/s8vmin00000026tx.pdf', '$.PDF_source_page', 'https://www.jeed.go.jp/disability/subsidy/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUGAI-SHUROU';

-- SHOUGAI-TELEWORK
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001064502.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/shougaishakoyou/', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOUGAI-TELEWORK';

-- SHOKUBA-KAIZEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.johas.go.jp/Portals/0/sodan_freedaiyaru_0130.pdf', '$.PDF_source_page', 'https://www.johas.go.jp/sangyouhoken/stresscheck/tabid/1005/Default.aspx', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHOKUBA-KAIZEN';

-- STRESS-CHECK
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.johas.go.jp/Portals/0/sodan_freedaiyaru_0130.pdf', '$.PDF_source_page', 'https://www.johas.go.jp/sangyouhoken/stresscheck/tabid/1005/Default.aspx', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'STRESS-CHECK';

-- SHUNYU-HOKEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/keiei/nogyohoken/syunyuhoken/attach/pdf/index-65.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/keiei/nogyohoken/syunyuhoken/', '$.PDF_total_count', 10, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHUNYU-HOKEN';

-- SMART-AGRI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/kanbo/smart/smart_meguji.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/kanbo/smart/', '$.PDF_total_count', 25, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SMART-AGRI';

-- SMARTCITY-JISSOUKA
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/toshi/tosiko/content/001978628.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/toshi/tosiko/toshi_tosiko_tk_000040.html', '$.PDF_total_count', 7, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SMARTCITY-JISSOUKA';

-- SHUSSAN-OUEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/be80930d-51d1-4084-aa3e-b80930646538/42e36027/20250325_policies_shussan-kosodate_52.pdf', '$.PDF_source_page', 'https://www.cfa.go.jp/policies/shussan-kosodate/', '$.PDF_total_count', 77, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SHUSSAN-OUEN';

-- TEIGAKU-GENZEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.nta.go.jp/users/gensen/teigakugenzei/pdf/0024005-122.pdf', '$.PDF_source_page', 'https://www.nta.go.jp/users/gensen/teigakugenzei/', '$.PDF_total_count', 8, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TEIGAKU-GENZEI';

-- TEISHOTOKU-MANABI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001073991.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyushokusha_shien/', '$.PDF_total_count', 22, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TEISHOTOKU-MANABI';

-- TAXI-BUS-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/sogoseisaku/transport/content/001633417.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000055.html', '$.PDF_total_count', 93, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TAXI-BUS-SHIEN';

-- TAMENTEKI-KINOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/nousin/kanri/attach/pdf/tamen_siharai-189.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/nousin/kanri/tamen_siharai.html', '$.PDF_total_count', 29, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TAMENTEKI-KINOU';

-- SUISAN-SEICHOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jfa.maff.go.jp/j/budget/attach/pdf/index-49.pdf', '$.PDF_source_page', 'https://www.jfa.maff.go.jp/j/budget/', '$.PDF_total_count', 63, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'SUISAN-SEICHOU';

-- TOKUTEI-HATTATSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001537819.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/hattatsu_nanchi.html', '$.PDF_total_count', 11, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOKUTEI-HATTATSU';

-- TOKUTEI-HYOUGAKI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11650000/001088873.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000158169_00001.html', '$.PDF_total_count', 9, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOKUTEI-HYOUGAKI';

-- TOKUTEI-KONNAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001473777.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_konnan.html', '$.PDF_total_count', 21, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOKUTEI-KONNAN';

-- TOKUTEI-SEIKATSU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/001088874.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_seikatsu.html', '$.PDF_total_count', 6, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOKUTEI-SEIKATSU';

-- TOSHI-NOGYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/nousin/kouryu/tosi_nougyo/attach/pdf/index-1.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/nousin/kouryu/tosi_nougyo/', '$.PDF_total_count', 2, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOSHI-NOGYOU';

-- UNSOU-NENRYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mlit.go.jp/common/000148955.pdf', '$.PDF_source_page', 'https://www.mlit.go.jp/jidosha/', '$.PDF_total_count', 5, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'UNSOU-NENRYOU';

-- TOTO-JOSEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jpnsport.go.jp/sinko/Portals/0/sinko/sinko/pdf/joseikatudoujisseki/R06/2024_yachiyocity_zissizyoukyoutyousa.pdf', '$.PDF_source_page', 'https://www.jpnsport.go.jp/sinko/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOTO-JOSEI';

-- TOTO-SHISETSU-SEIBI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.jpnsport.go.jp/sinko/Portals/0/sinko/sinko/pdf/joseikatudoujisseki/R06/2024_yachiyocity_zissizyoukyoutyousa.pdf', '$.PDF_source_page', 'https://www.jpnsport.go.jp/sinko/', '$.PDF_total_count', 3, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOTO-SHISETSU-SEIBI';

-- TOKYO-SHINKOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.tokyo-kosha.or.jp/support/josei/qp64520000001995-att/Precautions_Joseikin-Chuiten.pdf', '$.PDF_source_page', 'https://www.tokyo-kosha.or.jp/support/josei/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'TOKYO-SHINKOU';

-- YOUTH-YELL-SHIEN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.mhlw.go.jp/content/11800000/001243904.pdf', '$.PDF_source_page', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000100266.html', '$.PDF_total_count', 9, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'YOUTH-YELL-SHIEN';

-- YUUKI-NOUGYOU
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/seisan/kankyo/yuuki/attach/pdf/index-37.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/seisan/kankyo/yuuki/', '$.PDF_total_count', 19, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'YUUKI-NOUGYOU';

-- YUUKI-SUISHIN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.maff.go.jp/j/seisan/kankyo/yuuki/attach/pdf/index-37.pdf', '$.PDF_source_page', 'https://www.maff.go.jp/j/seisan/kankyo/yuuki/', '$.PDF_total_count', 19, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'YUUKI-SUISHIN';

-- YOROZU-SOUDAN
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://yorozu.smrj.go.jp/wp-content/uploads/2025/11/5c65c8fe812f3a9c765dad0573d6f4b8.pdf', '$.PDF_source_page', 'https://yorozu.smrj.go.jp/', '$.PDF_total_count', 1, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'YOROZU-SOUDAN';

-- WAM-JOSEI
UPDATE subsidy_cache SET detail_json = json_set(detail_json, '$.関連PDF_URL', 'https://www.wam.go.jp/hp/wp-content/uploads/r8kikinfaq.pdf', '$.PDF_source_page', 'https://www.wam.go.jp/hp/cat/wamjosei/', '$.PDF_total_count', 4, '$.PDF_scan_date', datetime('now')), cached_at = datetime('now') WHERE id = 'WAM-JOSEI';

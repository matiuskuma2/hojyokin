-- =====================================================
-- url_lost → active 復旧: issuer_pageクロールで新規PDF発見
-- Phase 12.1: 2026-02-09 自動探索結果
-- 対象: 104件のurl_lostモニター → PDF URL設定 + status復旧
-- =====================================================

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://web.pref.hyogo.lg.jp/kf16/documents/hojokinyoukoubeppyou.pdf',
  koubo_page_url = 'https://web.pref.hyogo.lg.jp/kf16/ryouritu.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-56795';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.adachi.tokyo.jp/documents/61166/hojyokinnyoukour7.pdf',
  koubo_page_url = 'https://www.city.adachi.tokyo.jp/toshi/machi/machizukuri/barrier-free-hojokin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-53382';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.adachi.tokyo.jp/documents/24481/youkou.pdf',
  koubo_page_url = 'https://www.city.adachi.tokyo.jp/chusho/kensyuu.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-53485';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.adachi.tokyo.jp/documents/61166/hojyokinnyoukour7.pdf',
  koubo_page_url = 'https://www.city.adachi.tokyo.jp/toshi/machi/machizukuri/barrier-free-hojokin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-53494';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.akashi.lg.jp/documents/25997/youkou_tasuu.pdf',
  koubo_page_url = 'https://www.city.akashi.lg.jp/tosei/ken_anzen_ka/kurashi/sumai/taishin/tasuunomono.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-48019';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.akita.lg.jp/_res/projects/default_project/_page_/001/034/510/shinkouyoukou2025.0402.pdf',
  koubo_page_url = 'https://www.city.akita.lg.jp/jigyosha/norinsuisangyo/1034510.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-43550';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.arakawa.tokyo.jp/documents/7663/r7youkou4.pdf',
  koubo_page_url = 'https://www.city.arakawa.tokyo.jp/a021/jigyousha/jigyouunei/dogahojyo.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42168';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.atsugi.kanagawa.jp/material/files/group/44/yoryo.pdf',
  koubo_page_url = 'https://www.city.atsugi.kanagawa.jp/soshiki/sangyoshinkoka/9/2/24830.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-52506';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.bunkyo.lg.jp/documents/3575/bunkyoukujyuusinhojyokinyoukou.pdf',
  koubo_page_url = 'https://www.city.bunkyo.lg.jp/hoken/shogai/jigyousyadownload/zyuusin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-40166';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.chiba.jp/keizainosei/keizai/sangyo/documents/20230401_inohana-hojokin-youkou.pdf',
  koubo_page_url = 'https://www.city.chiba.jp/keizainosei/keizai/sangyo/inohana-hojo2014.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-39776';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.chiba.jp/shimin/shimin/chiikianzen/documents/bouhangaitouhozyokinkoufuyoukouzimutoriatukaiyousyou_beppyou.pdf',
  koubo_page_url = 'https://www.city.chiba.jp/shimin/shimin/chiikianzen/bouhangaitou.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-46929';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.chiba.jp/kodomomirai/yojikyoiku/shien/documents/dannseiikujiyoukou.pdf',
  koubo_page_url = 'https://www.city.chiba.jp/kodomomirai/yojikyoiku/shien/ikumen2.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-56376';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.echizen.lg.jp/office/kankyounourin/051/koshikaisyu/koshirui-koirui/shigenkaishuu_d/fil/youkou.pdf',
  koubo_page_url = 'https://www.city.echizen.lg.jp/office/kankyounourin/051/koshikaisyu/koshirui-koirui/shigenkaishuu.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-47740';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.fujieda.shizuoka.jp/material/files/group/98/youkou.pdf',
  koubo_page_url = 'https://www.city.fujieda.shizuoka.jp/sangyo/sogyo/12156.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42997';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.fujieda.shizuoka.jp/material/files/group/97/2023sangyozaisankensyutokuhojyoyoukou01.pdf',
  koubo_page_url = 'https://www.city.fujieda.shizuoka.jp/sangyo/kigyo/1447731265247.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-43004';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.fujieda.shizuoka.jp/material/files/group/148/youkour5.pdf',
  koubo_page_url = 'https://www.city.fujieda.shizuoka.jp/kosodate/teate/kodomo/17098.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-43021';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.fujimi.saitama.jp/60jigyo/06sangyou/syoukou/tyusyoukigyoutyarenz.files/03-3yosiki4.pdf',
  koubo_page_url = 'https://www.city.fujimi.saitama.jp/60jigyo/06sangyou/syoukou/tyusyoukigyoutyarenz.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-13350';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.gifu.lg.jp/_res/projects/default_project/_page_/001/006/047/jinzaikakuho_youkou.pdf',
  koubo_page_url = 'https://www.city.gifu.lg.jp/business/roudou/1006046/1006047.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-27933';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.gifu.lg.jp/_res/projects/default_project/_page_/001/005/240/koufuyoukou070903.pdf',
  koubo_page_url = 'https://www.city.gifu.lg.jp/kankoubunka/sports/1005236/1005239/1005240.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-52545';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.hachioji.tokyo.jp/kurashi/gomi/hojo/p002560_d/fil/sakuseiyouryouR6nendomatu.pdf',
  koubo_page_url = 'https://www.city.hachioji.tokyo.jp/kurashi/gomi/hojo/p002560.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-39050';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.hirakata.osaka.jp/cmsfiles/contents/0000047/47801/guruhoyoukou.pdf',
  koubo_page_url = 'https://www.city.hirakata.osaka.jp/0000047801.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-51500';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.iizuka.lg.jp/kodomokatei/documents/documents/ibasyohojyokinyoukou.pdf',
  koubo_page_url = 'https://www.city.iizuka.lg.jp/kodomokatei/documents/kodomosyokudou2.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-32735';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.iizuka.lg.jp/kokusaisuishin/documents/gaikokuyoukou.pdf',
  koubo_page_url = 'https://www.city.iizuka.lg.jp/kokusaisuishin/gaikokujinzaiukeire.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-50315';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.iwaki.lg.jp/www/contents/1482811668050/simple/kouhuyoukou.pdf',
  koubo_page_url = 'https://www.city.iwaki.lg.jp/www/contents/1482811668050/index.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-47649';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.izunokuni.shizuoka.jp/syoukou/documents/leaflet0613.pdf',
  koubo_page_url = 'https://www.city.izunokuni.shizuoka.jp/syoukou/syoukou04.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-98396';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.katsushika.lg.jp/_res/projects/default_project/_page_/001/032/515/0707youkou.pdf',
  koubo_page_url = 'https://www.city.katsushika.lg.jp/business/1000011/1000069/1005250/1032515.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-60417';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawaguchi.lg.jp/material/files/group/15/ikuseisidouyoukouR7.pdf',
  koubo_page_url = 'https://www.city.kawaguchi.lg.jp/soshiki/01040/020/20/2485.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42595';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawaguchi.lg.jp/material/files/group/15/kouhuyoukou.pdf',
  koubo_page_url = 'https://www.city.kawaguchi.lg.jp/soshiki/01040/020/20/2494.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42601';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawaguchi.lg.jp/material/files/group/15/kouhuyoukou.pdf',
  koubo_page_url = 'https://www.city.kawaguchi.lg.jp/soshiki/01040/020/20/34135.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42603';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawasaki.jp/280/cmsfiles/contents/0000065/65259/R7youkou.pdf',
  koubo_page_url = 'https://www.city.kawasaki.jp/280/page/0000065259.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-4466';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawasaki.jp/280/cmsfiles/contents/0000017/17512/R7_youkou_shisetsu.pdf',
  koubo_page_url = 'https://www.city.kawasaki.jp/280/page/0000017512.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-4510';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawasaki.jp/tama/cmsfiles/contents/0000105/105711/youkou.pdf',
  koubo_page_url = 'https://www.city.kawasaki.jp/tama/page/0000105711.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-15370';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kawasaki.jp/601/cmsfiles/contents/0000017/17691/jishuboukatudoujoseiyoukou.pdf',
  koubo_page_url = 'https://www.city.kawasaki.jp/601/page/0000017691.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-54594';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kitamoto.lg.jp/material/files/group/5/R6koubogatahojyokinnbosyuuyoukou.pdf',
  koubo_page_url = 'https://www.city.kitamoto.lg.jp/kurashi/kyodo/3/1418260930413.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-56519';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kobe.lg.jp/documents/62082/kobecitykouhoukeijibanyoukou_20250401.pdf',
  koubo_page_url = 'https://www.city.kobe.lg.jp/a52374/kurashi/activate/support/jichikai/kouhoukeijiban.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-56429';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf',
  koubo_page_url = 'https://www.city.kobe.lg.jp/a95295/soudangyakutai/jinzaikakuho/20220922.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-60425';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf',
  koubo_page_url = 'https://www.city.kobe.lg.jp/a95295/soudangyakutai/jinzaikakuho/20220922.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-60427';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf',
  koubo_page_url = 'https://www.city.kobe.lg.jp/a95295/soudangyakutai/jinzaikakuho/20220922.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-60429';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.koshigaya.saitama.jp/kurashi_shisei/jigyosha/shogyokogyo/shoutengai/shoutengai_files_syoutengaihojoyoukou2020.pdf',
  koubo_page_url = 'https://www.city.koshigaya.saitama.jp/kurashi_shisei/jigyosha/shogyokogyo/shoutengai/shoutengai.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-14419';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.matsubara.lg.jp/fs/1/9/4/0/3/5/_/aoirobouhannpatoro-rusyaryoukounyuuoyobiijikannrijigyouhojyokinnyoukou.pdf',
  koubo_page_url = 'https://www.city.matsubara.lg.jp/docs/page16917.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-53676';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.matsudo.chiba.jp/jigyosya/syoukougyou/hojokinshutokushien.files/r7shutokuyouryou.pdf',
  koubo_page_url = 'https://www.city.matsudo.chiba.jp/jigyosya/syoukougyou/hojokinshutokushien.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-104562';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.matsue.lg.jp/material/files/group/26/R7_kanshinkoujou_youkou.pdf',
  koubo_page_url = 'https://www.city.matsue.lg.jp/soshikikarasagasu/sangyokeizaibu_matsuesangyoshiencenter/22480.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-92030';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.midori.gunma.jp/_res/projects/default_project/_page_/001/002/761/youkou.pdf',
  koubo_page_url = 'https://www.city.midori.gunma.jp/sangyou/1001652/1001817/1002761.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-26372';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.minamisoma.lg.jp/material/files/group/21/tayou_zissiyouryou_r7.pdf',
  koubo_page_url = 'https://www.city.minamisoma.lg.jp/portal/sections/18/1810/18101/1/1/22092.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-54255';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.minato.tokyo.jp/documents/9734/matidukurijyosei_youkou_1.pdf',
  koubo_page_url = 'https://www.city.minato.tokyo.jp/sougoukeikaku/kankyo-machi/toshikekaku/kekaku/jose.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-4373';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.musashino.lg.jp/_res/projects/default_project/_page_/001/005/430/R7_endou_youkou2.pdf',
  koubo_page_url = 'https://www.city.musashino.lg.jp/kurashi_tetsuzuki/jutaku_shinchiku_zokaichiku/jutaku/taishinka/1005430.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-54240';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.narashino.lg.jp/material/files/group/5/kaisei_youkou.pdf',
  koubo_page_url = 'https://www.city.narashino.lg.jp/kurashi/bosaibohan/bohan/bouhanshisaku/bouhancamera.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-31458';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.nishio.aichi.jp/_res/projects/default_project/_page_/001/001/907/r7teikougaisyayoukou.pdf',
  koubo_page_url = 'https://www.city.nishio.aichi.jp/kurashi/gomi/1005103/1001400/1001907.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-54882';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.nisshin.lg.jp/material/files/group/74/kigyosaitoushisokushinnhozyokingkouhuyoukou7.pdf',
  koubo_page_url = 'https://www.city.nisshin.lg.jp/kurashi/sangyo/5/7294.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42476';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.nomi.ishikawa.jp/www/contents/1680225890794/simple/ev_youkou_0801.pdf',
  koubo_page_url = 'https://www.city.nomi.ishikawa.jp/www/contents/1680225890794/index.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-51993';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.oita.oita.jp/o155/shigotosangyo/kigyoshien/documents/03boshuuyouryou.pdf',
  koubo_page_url = 'https://www.city.oita.oita.jp/o155/shigotosangyo/kigyoshien/challenge.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-110418';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.omaezaki.shizuoka.jp/material/files/group/17/omaezakisikikennakiyajokyakujigyou-youkou.pdf',
  koubo_page_url = 'https://www.city.omaezaki.shizuoka.jp/soshiki/toshiseisaku/sumaitochi/sumai/akiya/kikennakiyatoujokyakujigyouhihojokinn.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-33934';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/shintou.files/20230301_kouhuyoukou.pdf',
  koubo_page_url = 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/shintou.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-3904';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/usuichoryuusou.files/4youkou.pdf',
  koubo_page_url = 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/usuichoryuusou.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-3911';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.sapporo.jp/keizai/nogyo/keieisienn/documents/youkour070401.pdf',
  koubo_page_url = 'https://www.city.sapporo.jp/keizai/nogyo/keieisienn/ryudoukasyourei.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-61218';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.sendai.jp/startup-sogyo/jigyosha/kezai/sangaku/minkan/documents/kouhuyoukou_t-biz.pdf',
  koubo_page_url = 'https://www.city.sendai.jp/renkesuishin/jigyosha/kezai/sangaku/minkan/t-biz.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-34004';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.shibata.lg.jp/_res/projects/default_project/_page_/001/011/744/youkou_r7.06.01.pdf',
  koubo_page_url = 'https://www.city.shibata.lg.jp/kurashi/bunka/suports/1012561/1011744.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-31583';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.takamatsu.kagawa.jp/jigyosha/sangyou/shoukougyou/seityousokushin/hannrokaitaku.files/youkou2025040199.pdf',
  koubo_page_url = 'https://www.city.takamatsu.kagawa.jp/jigyosha/sangyou/shoukougyou/seityousokushin/hannrokaitaku.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-92510';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.takasago.lg.jp/material/files/group/34/cashlessdx-youkou.pdf',
  koubo_page_url = 'https://www.city.takasago.lg.jp/soshikikarasagasu/sangyoshinkoka/sangyoshinko/3/8969.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-55216';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.toride.ibaraki.jp/sanshin/jigyosha/shokogyo/sougyousienn/documents/sangyousinkou_challenge_koufuyoukou.pdf',
  koubo_page_url = 'https://www.city.toride.ibaraki.jp/sanshin/jigyosha/shokogyo/sougyousienn/challenge.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-25842';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.tsukuba.lg.jp/material/files/group/109/R7TenjikaiYoukouVer3.pdf',
  koubo_page_url = 'https://www.city.tsukuba.lg.jp/soshikikarasagasu/keizaibusangyoshinkoka/gyomuannai/3/2/2/1011814.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-57788';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.tsuruga.lg.jp/about_city/business/kigyo/machisougyou.files/youkou-r060704.pdf',
  koubo_page_url = 'https://www.city.tsuruga.lg.jp/about_city/business/kigyo/machisougyou.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-29803';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.tsuruoka.lg.jp/kurashi/shigoto/jigyosha/seisyain20190401.files/R7.6youkou.pdf',
  koubo_page_url = 'https://www.city.tsuruoka.lg.jp/kurashi/shigoto/jigyosha/seisyain20190401.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-61899';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/016/198/youkou2025.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/machizukuri/sangyou/seido/1016198.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-30984';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/010/477/rikaikatudouyoukou_r6.4.1kaisei.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/shisei/hojyojyosei/1010994/1010477.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-33475';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/005/335/rikaigakushuyoukou_r6.4.1kaisei.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/shisei/hojyojyosei/1010994/1005335.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-33477';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/193/youkou_r6.4.1kaisei.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/shisei/hojyojyosei/1010994/1009193.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-33478';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/183/2025youkou.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/shisei/hojyojyosei/1010994/1010988.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-33484';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/202/seikatsudouroyoukou.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/shisei/hojyojyosei/1010994/1009202.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-42688';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/005/335/rikaigakushuyoukou_r6.4.1kaisei.pdf',
  koubo_page_url = 'https://www.city.ube.yamaguchi.jp/shisei/hojyojyosei/1010994/1005335.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-52341';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.city.yokkaichi.lg.jp/www/contents/1616904675200/files/hanrokakudaikouhuyoukou.pdf',
  koubo_page_url = 'https://www.city.yokkaichi.lg.jp/www/contents/1616904675200/index.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-14620';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.ibaraki.jp/nourinsuisan/sansin/yasai/roziyasaiinobe/documents/01-r7roji-iv-zissiyouryou.pdf',
  koubo_page_url = 'https://www.pref.ibaraki.jp/nourinsuisan/sansin/yasai/roziyasaiinobe/roziyasai.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-58992';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.iwate.jp/_res/projects/default_project/_page_/001/007/637/r070401_tiikinougyoukeikaku_youryou.pdf',
  koubo_page_url = 'https://www.pref.iwate.jp/sangyoukoyou/nougyou/ikusei/1007637.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-62538';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.kanagawa.jp/documents/50336/kouhuyoukou20241112.pdf',
  koubo_page_url = 'https://www.pref.kanagawa.jp/docs/n7j/ryugakuseishien.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-44165';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.miyagi.jp/documents/11762/r6youkou.pdf',
  koubo_page_url = 'https://www.pref.miyagi.jp/soshiki/jidousha/ikusei-hojo.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-56898';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.miyagi.jp/documents/45127/boshuuannai.pdf',
  koubo_page_url = 'https://www.pref.miyagi.jp/soshiki/engei/shisetsuengei-ricchisyoureikin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-60040';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/010/499/3-1_youkou250401_ryutu_.pdf',
  koubo_page_url = 'https://www.pref.okinawa.jp/shigoto/nogyo/1010390/1010499.html#:~:text=%EF%BC%882%EF%BC%89-,%E5%8C%97%E9%83%A8%E3%83%BB%E9%9B%A2%E5%B3%B6%E5%9C%B0%E5%9F%9F%E6%8C%AF%E8%88%88,-%E3%81%93%E3%81%AE%E4%BA%8B%E6%A5%AD%E3%81%AF%E3%80%81%E5%B8%82%E7%94%BA%E6%9D%91%E3%81%8C%E8%A3%9C%E5%8A%A9%E4%BA%8B%E6%A5%AD%E8%80%85%E3%81%A8',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-99910';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.osaka.lg.jp/documents/7047/youkou.pdf',
  koubo_page_url = 'https://www.pref.osaka.lg.jp/keieishien/start-apper/hojyokin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-41732';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.osaka.lg.jp/documents/54415/bosyuuyoukou.pdf',
  koubo_page_url = 'https://www.pref.osaka.lg.jp/kenkozukuri/judoukitsuen/judokituenhojokin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-54650';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.saitama.lg.jp/documents/61389/r7kaiseigo_youkou.pdf',
  koubo_page_url = 'https://www.pref.saitama.lg.jp/a0603/kakuhosokushinjigyou.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-41867';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/053/264/ictservice_yoryo.pdf',
  koubo_page_url = 'https://www.pref.shizuoka.jp/kensei/keikaku/1040922/1053264.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-52326';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/025/729/250501_robot_youkou.pdf',
  koubo_page_url = 'https://www.pref.shizuoka.jp/sangyoshigoto/kigyoshien/kigyoshien/1025729.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-52869';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.yamanashi.jp/documents/4789/r4kenkoufuyoukou.pdf',
  koubo_page_url = 'https://www.pref.yamanashi.jp/noson-sink/77578144855.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-4520';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.yamanashi.jp/documents/60452/hrs_hojokin_koufu-youkou.pdf',
  koubo_page_url = 'https://www.pref.yamanashi.jp/seichosangyo/h2station_hojokin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-44633';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.yamanashi.jp/documents/5450/sienkouhukinkenyoukou.pdf',
  koubo_page_url = 'https://www.pref.yamanashi.jp/shinrin-sb/shien_koufukin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-44974';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.yamanashi.jp/documents/71676/00_koyousoushutushoureikin_youkou.pdf',
  koubo_page_url = 'https://www.pref.yamanashi.jp/rosei-jin/kaisei_shoureikin.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-46337';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.pref.yamanashi.jp/documents/38223/kenyoukou.pdf',
  koubo_page_url = 'https://www.pref.yamanashi.jp/noson-sink/nouchi_mizu.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-61236';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://tokyo-co2down.g.kuroco-img.app/files/user/files/subsidy/pvrecycle/R6_panelrecycle_jissiyoukou_1101.pdf',
  koubo_page_url = 'https://www.tokyo-co2down.jp/subsidy/pvrecycle',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-55511';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.toshizukuri.or.jp/business/toshidukuri/index.files/tomin_iin_senko_yoryo.pdf',
  koubo_page_url = 'https://www.toshizukuri.or.jp/business/toshidukuri/index.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-41446';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.aichi-togo.lg.jp/material/files/group/23/youkou.pdf',
  koubo_page_url = 'https://www.town.aichi-togo.lg.jp/hojokin_joseikin/sumai/9852.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-39283';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.aikawa.kanagawa.jp/material/files/group/16/youkou0.pdf',
  koubo_page_url = 'https://www.town.aikawa.kanagawa.jp/benri/guide/gomi_kankyou/choujuu/8060.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-47314';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.ayagawa.lg.jp/docs/2018092600013/file_contents/youkou.pdf',
  koubo_page_url = 'https://www.town.ayagawa.lg.jp/docs/2018092600013/',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-26709';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.ayagawa.lg.jp/docs/2022062100021/file_contents/kouhuyoukou.pdf',
  koubo_page_url = 'https://www.town.ayagawa.lg.jp/docs/2022062100021/',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-32300';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.hiji.lg.jp/material/files/group/12/nenyukoutou_youkou_R5.pdf',
  koubo_page_url = 'https://www.town.hiji.lg.jp/shigoto_sangyo/shokogyo/hojokin_joseikin/886.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-37226';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.inagawa.lg.jp/material/files/group/42/youkour2.pdf',
  koubo_page_url = 'https://www.town.inagawa.lg.jp/kurashi/hojo_enjo/1493688349327.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-48914';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.kahoku.yamagata.jp/material/files/group/6/R7_saiene_youkou.pdf',
  koubo_page_url = 'https://www.town.kahoku.yamagata.jp/kurasi_tetuzuki/sienseidoitiran/3671.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-57254';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.kuzumaki.lg.jp/docs/2015110600215/file_contents/kuzumaki_zizoku_sangyou_shien-kouhuyoukou.pdf',
  koubo_page_url = 'https://www.town.kuzumaki.lg.jp/docs/2015110600215/',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-91942';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'http://www.town.minamiosumi.lg.jp/kanko/documents/r5kyouikuryokoubus-youkou.pdf',
  koubo_page_url = 'http://www.town.minamiosumi.lg.jp/kanko/20210420kyoikusienn.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-30384';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'http://www.town.minamiosumi.lg.jp/kanko/documents/r5chounaibusjigyousha-youkou.pdf',
  koubo_page_url = 'http://www.town.minamiosumi.lg.jp/kanko/tyounaibasusienn.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-32132';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.oizumi.gunma.jp/s020/jigyo/020/150/R7.4youkou.pdf',
  koubo_page_url = 'https://www.town.oizumi.gunma.jp/s020/jigyo/020/150/20200825145351.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-57993';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.taketoyo.lg.jp/_res/projects/default_project/_page_/001/001/782/himoku_youkou_r7.pdf',
  koubo_page_url = 'https://www.town.taketoyo.lg.jp/kurashi/1001507/1001586/1001782.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-46948';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.town.tatsuno.lg.jp/material/files/group/6/kikaihojokinyoukou.pdf',
  koubo_page_url = 'https://www.town.tatsuno.lg.jp/gyosei/soshiki/sangyoshinkoka/shigoto_sangyo/4/3/959.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-26484';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www.yoichi-cci.com/_src/51713/syuyoukou.pdf?v=1767795870708',
  koubo_page_url = 'https://www.yoichi-cci.com/soudan/hoken.html#8',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-59758';

UPDATE koubo_monitors SET 
  koubo_pdf_url = 'https://www4.city.kanazawa.lg.jp/material/files/group/33/syouhinka_youkou.pdf',
  koubo_page_url = 'https://www4.city.kanazawa.lg.jp/hojokin_joseikin/6/18165.html',
  status = 'active',
  pdf_source_method = 'deep_crawl',
  last_crawl_result = 'success',
  last_crawl_at = '2026-02-09T10:00:00Z',
  next_crawl_at = '2026-03-09T10:00:00Z',
  url_change_count = COALESCE(url_change_count, 0) + 1,
  last_url_change_at = '2026-02-09T10:00:00Z',
  updated_at = '2026-02-09T10:00:00Z'
WHERE subsidy_id = 'izumi-48720';

-- Crawl log entries for new discoveries
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-56795', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://web.pref.hyogo.lg.jp/kf16/documents/hojokinyoukoubeppyou.pdf', 'https://web.pref.hyogo.lg.jp/kf16/documents/hojokinyoukoubeppyou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-53382', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.adachi.tokyo.jp/documents/61166/hojyokinnyoukour7.pdf', 'https://www.city.adachi.tokyo.jp/documents/61166/hojyokinnyoukour7.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-53485', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.adachi.tokyo.jp/documents/24481/youkou.pdf', 'https://www.city.adachi.tokyo.jp/documents/24481/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-53494', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.adachi.tokyo.jp/documents/61166/hojyokinnyoukour7.pdf', 'https://www.city.adachi.tokyo.jp/documents/61166/hojyokinnyoukour7.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-48019', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.akashi.lg.jp/documents/25997/youkou_tasuu.pdf', 'https://www.city.akashi.lg.jp/documents/25997/youkou_tasuu.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-43550', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.akita.lg.jp/_res/projects/default_project/_page_/001/034/510/shinkouyoukou2025.0402.pdf', 'https://www.city.akita.lg.jp/_res/projects/default_project/_page_/001/034/510/shinkouyoukou2025.0402.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42168', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.arakawa.tokyo.jp/documents/7663/r7youkou4.pdf', 'https://www.city.arakawa.tokyo.jp/documents/7663/r7youkou4.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-52506', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.atsugi.kanagawa.jp/material/files/group/44/yoryo.pdf', 'https://www.city.atsugi.kanagawa.jp/material/files/group/44/yoryo.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-40166', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.bunkyo.lg.jp/documents/3575/bunkyoukujyuusinhojyokinyoukou.pdf', 'https://www.city.bunkyo.lg.jp/documents/3575/bunkyoukujyuusinhojyokinyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-39776', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.chiba.jp/keizainosei/keizai/sangyo/documents/20230401_inohana-hojokin-youkou.pdf', 'https://www.city.chiba.jp/keizainosei/keizai/sangyo/documents/20230401_inohana-hojokin-youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-46929', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.chiba.jp/shimin/shimin/chiikianzen/documents/bouhangaitouhozyokinkoufuyoukouzimutoriatukaiyousyou_beppyou.pdf', 'https://www.city.chiba.jp/shimin/shimin/chiikianzen/documents/bouhangaitouhozyokinkoufuyoukouzimutoriatukaiyousyou_beppyou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-56376', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.chiba.jp/kodomomirai/yojikyoiku/shien/documents/dannseiikujiyoukou.pdf', 'https://www.city.chiba.jp/kodomomirai/yojikyoiku/shien/documents/dannseiikujiyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-47740', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.echizen.lg.jp/office/kankyounourin/051/koshikaisyu/koshirui-koirui/shigenkaishuu_d/fil/youkou.pdf', 'https://www.city.echizen.lg.jp/office/kankyounourin/051/koshikaisyu/koshirui-koirui/shigenkaishuu_d/fil/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42997', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.fujieda.shizuoka.jp/material/files/group/98/youkou.pdf', 'https://www.city.fujieda.shizuoka.jp/material/files/group/98/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-43004', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.fujieda.shizuoka.jp/material/files/group/97/2023sangyozaisankensyutokuhojyoyoukou01.pdf', 'https://www.city.fujieda.shizuoka.jp/material/files/group/97/2023sangyozaisankensyutokuhojyoyoukou01.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-43021', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.fujieda.shizuoka.jp/material/files/group/148/youkour5.pdf', 'https://www.city.fujieda.shizuoka.jp/material/files/group/148/youkour5.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-13350', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.fujimi.saitama.jp/60jigyo/06sangyou/syoukou/tyusyoukigyoutyarenz.files/03-3yosiki4.pdf', 'https://www.city.fujimi.saitama.jp/60jigyo/06sangyou/syoukou/tyusyoukigyoutyarenz.files/03-3yosiki4.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-27933', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.gifu.lg.jp/_res/projects/default_project/_page_/001/006/047/jinzaikakuho_youkou.pdf', 'https://www.city.gifu.lg.jp/_res/projects/default_project/_page_/001/006/047/jinzaikakuho_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-52545', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.gifu.lg.jp/_res/projects/default_project/_page_/001/005/240/koufuyoukou070903.pdf', 'https://www.city.gifu.lg.jp/_res/projects/default_project/_page_/001/005/240/koufuyoukou070903.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-39050', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.hachioji.tokyo.jp/kurashi/gomi/hojo/p002560_d/fil/sakuseiyouryouR6nendomatu.pdf', 'https://www.city.hachioji.tokyo.jp/kurashi/gomi/hojo/p002560_d/fil/sakuseiyouryouR6nendomatu.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-51500', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.hirakata.osaka.jp/cmsfiles/contents/0000047/47801/guruhoyoukou.pdf', 'https://www.city.hirakata.osaka.jp/cmsfiles/contents/0000047/47801/guruhoyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-32735', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.iizuka.lg.jp/kodomokatei/documents/documents/ibasyohojyokinyoukou.pdf', 'https://www.city.iizuka.lg.jp/kodomokatei/documents/documents/ibasyohojyokinyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-50315', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.iizuka.lg.jp/kokusaisuishin/documents/gaikokuyoukou.pdf', 'https://www.city.iizuka.lg.jp/kokusaisuishin/documents/gaikokuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-47649', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.iwaki.lg.jp/www/contents/1482811668050/simple/kouhuyoukou.pdf', 'https://www.city.iwaki.lg.jp/www/contents/1482811668050/simple/kouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-98396', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.izunokuni.shizuoka.jp/syoukou/documents/leaflet0613.pdf', 'https://www.city.izunokuni.shizuoka.jp/syoukou/documents/leaflet0613.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-60417', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.katsushika.lg.jp/_res/projects/default_project/_page_/001/032/515/0707youkou.pdf', 'https://www.city.katsushika.lg.jp/_res/projects/default_project/_page_/001/032/515/0707youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42595', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawaguchi.lg.jp/material/files/group/15/ikuseisidouyoukouR7.pdf', 'https://www.city.kawaguchi.lg.jp/material/files/group/15/ikuseisidouyoukouR7.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42601', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawaguchi.lg.jp/material/files/group/15/kouhuyoukou.pdf', 'https://www.city.kawaguchi.lg.jp/material/files/group/15/kouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42603', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawaguchi.lg.jp/material/files/group/15/kouhuyoukou.pdf', 'https://www.city.kawaguchi.lg.jp/material/files/group/15/kouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-4466', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawasaki.jp/280/cmsfiles/contents/0000065/65259/R7youkou.pdf', 'https://www.city.kawasaki.jp/280/cmsfiles/contents/0000065/65259/R7youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-4510', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawasaki.jp/280/cmsfiles/contents/0000017/17512/R7_youkou_shisetsu.pdf', 'https://www.city.kawasaki.jp/280/cmsfiles/contents/0000017/17512/R7_youkou_shisetsu.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-15370', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawasaki.jp/tama/cmsfiles/contents/0000105/105711/youkou.pdf', 'https://www.city.kawasaki.jp/tama/cmsfiles/contents/0000105/105711/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-54594', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kawasaki.jp/601/cmsfiles/contents/0000017/17691/jishuboukatudoujoseiyoukou.pdf', 'https://www.city.kawasaki.jp/601/cmsfiles/contents/0000017/17691/jishuboukatudoujoseiyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-56519', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kitamoto.lg.jp/material/files/group/5/R6koubogatahojyokinnbosyuuyoukou.pdf', 'https://www.city.kitamoto.lg.jp/material/files/group/5/R6koubogatahojyokinnbosyuuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-56429', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kobe.lg.jp/documents/62082/kobecitykouhoukeijibanyoukou_20250401.pdf', 'https://www.city.kobe.lg.jp/documents/62082/kobecitykouhoukeijibanyoukou_20250401.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-60425', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf', 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-60427', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf', 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-60429', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf', 'https://www.city.kobe.lg.jp/documents/56671/jinzaikakuho_kouhuyoukou_070301.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-14419', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.koshigaya.saitama.jp/kurashi_shisei/jigyosha/shogyokogyo/shoutengai/shoutengai_files_syoutengaihojoyoukou2020.pdf', 'https://www.city.koshigaya.saitama.jp/kurashi_shisei/jigyosha/shogyokogyo/shoutengai/shoutengai_files_syoutengaihojoyoukou2020.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-53676', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.matsubara.lg.jp/fs/1/9/4/0/3/5/_/aoirobouhannpatoro-rusyaryoukounyuuoyobiijikannrijigyouhojyokinnyoukou.pdf', 'https://www.city.matsubara.lg.jp/fs/1/9/4/0/3/5/_/aoirobouhannpatoro-rusyaryoukounyuuoyobiijikannrijigyouhojyokinnyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-104562', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.matsudo.chiba.jp/jigyosya/syoukougyou/hojokinshutokushien.files/r7shutokuyouryou.pdf', 'https://www.city.matsudo.chiba.jp/jigyosya/syoukougyou/hojokinshutokushien.files/r7shutokuyouryou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-92030', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.matsue.lg.jp/material/files/group/26/R7_kanshinkoujou_youkou.pdf', 'https://www.city.matsue.lg.jp/material/files/group/26/R7_kanshinkoujou_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-26372', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.midori.gunma.jp/_res/projects/default_project/_page_/001/002/761/youkou.pdf', 'https://www.city.midori.gunma.jp/_res/projects/default_project/_page_/001/002/761/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-54255', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.minamisoma.lg.jp/material/files/group/21/tayou_zissiyouryou_r7.pdf', 'https://www.city.minamisoma.lg.jp/material/files/group/21/tayou_zissiyouryou_r7.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-4373', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.minato.tokyo.jp/documents/9734/matidukurijyosei_youkou_1.pdf', 'https://www.city.minato.tokyo.jp/documents/9734/matidukurijyosei_youkou_1.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-54240', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.musashino.lg.jp/_res/projects/default_project/_page_/001/005/430/R7_endou_youkou2.pdf', 'https://www.city.musashino.lg.jp/_res/projects/default_project/_page_/001/005/430/R7_endou_youkou2.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-31458', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.narashino.lg.jp/material/files/group/5/kaisei_youkou.pdf', 'https://www.city.narashino.lg.jp/material/files/group/5/kaisei_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-54882', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.nishio.aichi.jp/_res/projects/default_project/_page_/001/001/907/r7teikougaisyayoukou.pdf', 'https://www.city.nishio.aichi.jp/_res/projects/default_project/_page_/001/001/907/r7teikougaisyayoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42476', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.nisshin.lg.jp/material/files/group/74/kigyosaitoushisokushinnhozyokingkouhuyoukou7.pdf', 'https://www.city.nisshin.lg.jp/material/files/group/74/kigyosaitoushisokushinnhozyokingkouhuyoukou7.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-51993', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.nomi.ishikawa.jp/www/contents/1680225890794/simple/ev_youkou_0801.pdf', 'https://www.city.nomi.ishikawa.jp/www/contents/1680225890794/simple/ev_youkou_0801.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-110418', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.oita.oita.jp/o155/shigotosangyo/kigyoshien/documents/03boshuuyouryou.pdf', 'https://www.city.oita.oita.jp/o155/shigotosangyo/kigyoshien/documents/03boshuuyouryou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-33934', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.omaezaki.shizuoka.jp/material/files/group/17/omaezakisikikennakiyajokyakujigyou-youkou.pdf', 'https://www.city.omaezaki.shizuoka.jp/material/files/group/17/omaezakisikikennakiyajokyakujigyou-youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-3904', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/shintou.files/20230301_kouhuyoukou.pdf', 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/shintou.files/20230301_kouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-3911', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/usuichoryuusou.files/4youkou.pdf', 'http://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/sumai/j_josei/usuichoryuusou.files/4youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-61218', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.sapporo.jp/keizai/nogyo/keieisienn/documents/youkour070401.pdf', 'https://www.city.sapporo.jp/keizai/nogyo/keieisienn/documents/youkour070401.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-34004', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.sendai.jp/startup-sogyo/jigyosha/kezai/sangaku/minkan/documents/kouhuyoukou_t-biz.pdf', 'https://www.city.sendai.jp/startup-sogyo/jigyosha/kezai/sangaku/minkan/documents/kouhuyoukou_t-biz.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-31583', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.shibata.lg.jp/_res/projects/default_project/_page_/001/011/744/youkou_r7.06.01.pdf', 'https://www.city.shibata.lg.jp/_res/projects/default_project/_page_/001/011/744/youkou_r7.06.01.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-92510', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.takamatsu.kagawa.jp/jigyosha/sangyou/shoukougyou/seityousokushin/hannrokaitaku.files/youkou2025040199.pdf', 'https://www.city.takamatsu.kagawa.jp/jigyosha/sangyou/shoukougyou/seityousokushin/hannrokaitaku.files/youkou2025040199.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-55216', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.takasago.lg.jp/material/files/group/34/cashlessdx-youkou.pdf', 'https://www.city.takasago.lg.jp/material/files/group/34/cashlessdx-youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-25842', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.toride.ibaraki.jp/sanshin/jigyosha/shokogyo/sougyousienn/documents/sangyousinkou_challenge_koufuyoukou.pdf', 'https://www.city.toride.ibaraki.jp/sanshin/jigyosha/shokogyo/sougyousienn/documents/sangyousinkou_challenge_koufuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-57788', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.tsukuba.lg.jp/material/files/group/109/R7TenjikaiYoukouVer3.pdf', 'https://www.city.tsukuba.lg.jp/material/files/group/109/R7TenjikaiYoukouVer3.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-29803', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.tsuruga.lg.jp/about_city/business/kigyo/machisougyou.files/youkou-r060704.pdf', 'https://www.city.tsuruga.lg.jp/about_city/business/kigyo/machisougyou.files/youkou-r060704.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-61899', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.tsuruoka.lg.jp/kurashi/shigoto/jigyosha/seisyain20190401.files/R7.6youkou.pdf', 'https://www.city.tsuruoka.lg.jp/kurashi/shigoto/jigyosha/seisyain20190401.files/R7.6youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-30984', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/016/198/youkou2025.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/016/198/youkou2025.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-33475', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/010/477/rikaikatudouyoukou_r6.4.1kaisei.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/010/477/rikaikatudouyoukou_r6.4.1kaisei.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-33477', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/005/335/rikaigakushuyoukou_r6.4.1kaisei.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/005/335/rikaigakushuyoukou_r6.4.1kaisei.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-33478', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/193/youkou_r6.4.1kaisei.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/193/youkou_r6.4.1kaisei.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-33484', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/183/2025youkou.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/183/2025youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-42688', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/202/seikatsudouroyoukou.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/009/202/seikatsudouroyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-52341', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/005/335/rikaigakushuyoukou_r6.4.1kaisei.pdf', 'https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/005/335/rikaigakushuyoukou_r6.4.1kaisei.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-14620', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.city.yokkaichi.lg.jp/www/contents/1616904675200/files/hanrokakudaikouhuyoukou.pdf', 'https://www.city.yokkaichi.lg.jp/www/contents/1616904675200/files/hanrokakudaikouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-58992', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.ibaraki.jp/nourinsuisan/sansin/yasai/roziyasaiinobe/documents/01-r7roji-iv-zissiyouryou.pdf', 'https://www.pref.ibaraki.jp/nourinsuisan/sansin/yasai/roziyasaiinobe/documents/01-r7roji-iv-zissiyouryou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-62538', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.iwate.jp/_res/projects/default_project/_page_/001/007/637/r070401_tiikinougyoukeikaku_youryou.pdf', 'https://www.pref.iwate.jp/_res/projects/default_project/_page_/001/007/637/r070401_tiikinougyoukeikaku_youryou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-44165', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.kanagawa.jp/documents/50336/kouhuyoukou20241112.pdf', 'https://www.pref.kanagawa.jp/documents/50336/kouhuyoukou20241112.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-56898', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.miyagi.jp/documents/11762/r6youkou.pdf', 'https://www.pref.miyagi.jp/documents/11762/r6youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-60040', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.miyagi.jp/documents/45127/boshuuannai.pdf', 'https://www.pref.miyagi.jp/documents/45127/boshuuannai.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-99910', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/010/499/3-1_youkou250401_ryutu_.pdf', 'https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/010/499/3-1_youkou250401_ryutu_.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-41732', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.osaka.lg.jp/documents/7047/youkou.pdf', 'https://www.pref.osaka.lg.jp/documents/7047/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-54650', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.osaka.lg.jp/documents/54415/bosyuuyoukou.pdf', 'https://www.pref.osaka.lg.jp/documents/54415/bosyuuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-41867', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.saitama.lg.jp/documents/61389/r7kaiseigo_youkou.pdf', 'https://www.pref.saitama.lg.jp/documents/61389/r7kaiseigo_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-52326', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/053/264/ictservice_yoryo.pdf', 'https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/053/264/ictservice_yoryo.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-52869', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/025/729/250501_robot_youkou.pdf', 'https://www.pref.shizuoka.jp/_res/projects/default_project/_page_/001/025/729/250501_robot_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-4520', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.yamanashi.jp/documents/4789/r4kenkoufuyoukou.pdf', 'https://www.pref.yamanashi.jp/documents/4789/r4kenkoufuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-44633', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.yamanashi.jp/documents/60452/hrs_hojokin_koufu-youkou.pdf', 'https://www.pref.yamanashi.jp/documents/60452/hrs_hojokin_koufu-youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-44974', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.yamanashi.jp/documents/5450/sienkouhukinkenyoukou.pdf', 'https://www.pref.yamanashi.jp/documents/5450/sienkouhukinkenyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-46337', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.yamanashi.jp/documents/71676/00_koyousoushutushoureikin_youkou.pdf', 'https://www.pref.yamanashi.jp/documents/71676/00_koyousoushutushoureikin_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-61236', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.pref.yamanashi.jp/documents/38223/kenyoukou.pdf', 'https://www.pref.yamanashi.jp/documents/38223/kenyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-55511', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://tokyo-co2down.g.kuroco-img.app/files/user/files/subsidy/pvrecycle/R6_panelrecycle_jissiyoukou_1101.pdf', 'https://tokyo-co2down.g.kuroco-img.app/files/user/files/subsidy/pvrecycle/R6_panelrecycle_jissiyoukou_1101.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-41446', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.toshizukuri.or.jp/business/toshidukuri/index.files/tomin_iin_senko_yoryo.pdf', 'https://www.toshizukuri.or.jp/business/toshidukuri/index.files/tomin_iin_senko_yoryo.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-39283', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.aichi-togo.lg.jp/material/files/group/23/youkou.pdf', 'https://www.town.aichi-togo.lg.jp/material/files/group/23/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-47314', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.aikawa.kanagawa.jp/material/files/group/16/youkou0.pdf', 'https://www.town.aikawa.kanagawa.jp/material/files/group/16/youkou0.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-26709', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.ayagawa.lg.jp/docs/2018092600013/file_contents/youkou.pdf', 'https://www.town.ayagawa.lg.jp/docs/2018092600013/file_contents/youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-32300', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.ayagawa.lg.jp/docs/2022062100021/file_contents/kouhuyoukou.pdf', 'https://www.town.ayagawa.lg.jp/docs/2022062100021/file_contents/kouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-37226', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.hiji.lg.jp/material/files/group/12/nenyukoutou_youkou_R5.pdf', 'https://www.town.hiji.lg.jp/material/files/group/12/nenyukoutou_youkou_R5.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-48914', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.inagawa.lg.jp/material/files/group/42/youkour2.pdf', 'https://www.town.inagawa.lg.jp/material/files/group/42/youkour2.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-57254', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.kahoku.yamagata.jp/material/files/group/6/R7_saiene_youkou.pdf', 'https://www.town.kahoku.yamagata.jp/material/files/group/6/R7_saiene_youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-91942', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.kuzumaki.lg.jp/docs/2015110600215/file_contents/kuzumaki_zizoku_sangyou_shien-kouhuyoukou.pdf', 'https://www.town.kuzumaki.lg.jp/docs/2015110600215/file_contents/kuzumaki_zizoku_sangyou_shien-kouhuyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-30384', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'http://www.town.minamiosumi.lg.jp/kanko/documents/r5kyouikuryokoubus-youkou.pdf', 'http://www.town.minamiosumi.lg.jp/kanko/documents/r5kyouikuryokoubus-youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-32132', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'http://www.town.minamiosumi.lg.jp/kanko/documents/r5chounaibusjigyousha-youkou.pdf', 'http://www.town.minamiosumi.lg.jp/kanko/documents/r5chounaibusjigyousha-youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-57993', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.oizumi.gunma.jp/s020/jigyo/020/150/R7.4youkou.pdf', 'https://www.town.oizumi.gunma.jp/s020/jigyo/020/150/R7.4youkou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-46948', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.taketoyo.lg.jp/_res/projects/default_project/_page_/001/001/782/himoku_youkou_r7.pdf', 'https://www.town.taketoyo.lg.jp/_res/projects/default_project/_page_/001/001/782/himoku_youkou_r7.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-26484', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.town.tatsuno.lg.jp/material/files/group/6/kikaihojokinyoukou.pdf', 'https://www.town.tatsuno.lg.jp/material/files/group/6/kikaihojokinyoukou.pdf', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-59758', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www.yoichi-cci.com/_src/51713/syuyoukou.pdf?v=1767795870708', 'https://www.yoichi-cci.com/_src/51713/syuyoukou.pdf?v=1767795870708', 200, '2026-02-09T10:05:00Z');
INSERT INTO koubo_crawl_log (subsidy_id, crawl_type, started_at, finished_at, result, checked_url, found_pdf_url, http_status, created_at)
VALUES ('izumi-48720', 're_explore', '2026-02-09T10:00:00Z', '2026-02-09T10:05:00Z', 'new_url_found', 'https://www4.city.kanazawa.lg.jp/material/files/group/33/syouhinka_youkou.pdf', 'https://www4.city.kanazawa.lg.jp/material/files/group/33/syouhinka_youkou.pdf', 200, '2026-02-09T10:05:00Z');
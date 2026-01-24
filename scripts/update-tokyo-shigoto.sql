-- tokyo-shigoのdetail_json充実（WALL_CHAT_READY対応版）

-- 1. テレワークトータルサポート助成金
UPDATE subsidy_cache SET
  subsidy_max_limit = 1500000,
  subsidy_rate = '定額/1/2',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"テレワーク環境の整備に必要な機器の購入費、テレワークに関する規定の整備に係る経費を助成します。テレワークトータルサポートコンサルティングの利用が要件となります。","overview":"テレワーク環境整備費用を助成（機器購入・規定整備）","application_requirements":"都内に本社または事業所を有する中小企業等であること。常時雇用する従業員が2名以上999名以下であること。テレワークトータルサポートコンサルティングを利用すること。","eligible_expenses":"テレワーク用端末、ネットワーク機器、ソフトウェア、就業規則等の整備費用","required_documents":"申請書、事業計画書、会社概要、決算書、見積書、コンサルティング利用証明書、就業規則の写し","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/telework/teletotal/total_joseikin.html","issuerName":"東京しごと財団","pdfUrls":["https://www.koyokankyo.shigotozaidan.or.jp/jigyo/telework/teletotal/total_joseikin.files/t-tele_tirashi.pdf"]}'
WHERE id = 'tokyo-shigoto-telework-teletotal';

-- 2. 年収の壁突破総合対策促進奨励金
UPDATE subsidy_cache SET
  subsidy_max_limit = 400000,
  subsidy_rate = '定額',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"パートタイム労働者等の年収の壁を意識せずに働ける環境を整備する中小企業等を支援するため、社会保険料の企業負担に対する手当等を支給する事業主に対して奨励金を支給します。","overview":"年収の壁対策として社会保険料手当等を支給する企業を支援","application_requirements":"都内に本社または事業所を有する中小企業等であること。パートタイム労働者等に対して社会保険料に関する手当等を支給する規定を新たに整備すること。","eligible_expenses":"社会保険料手当支給に係る規定整備費用","required_documents":"申請書、就業規則の写し、賃金台帳、労働者名簿、会社概要、決算書","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/nenshunokabetoppa/nenshunokabe-toppa.html","issuerName":"東京しごと財団","pdfUrls":["https://www.koyokankyo.shigotozaidan.or.jp/jigyo/nenshunokabetoppa/nenshunokabe-toppa.files/nenshunokabetoppa-syoureikin_leaflet.pdf"]}'
WHERE id = 'tokyo-shigoto-jigyo-nenshunokabetoppa';

-- 3. カスタマーハラスメント防止対策推進事業奨励金
UPDATE subsidy_cache SET
  subsidy_max_limit = 200000,
  subsidy_rate = '定額',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"従業員をカスタマーハラスメントから守るための対策を講じる中小企業等を支援するため、カスハラ防止対策の整備に取り組む事業主に対して奨励金を支給します。","overview":"カスハラ防止対策を整備する企業を支援","application_requirements":"都内に本社または事業所を有する中小企業等であること。カスタマーハラスメント防止のための基本方針を策定し、相談体制を整備すること。","eligible_expenses":"カスハラ防止マニュアル作成、研修実施、相談窓口設置費用","required_documents":"申請書、カスハラ防止基本方針、相談体制整備資料、会社概要、決算書","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/nocushara/shoreikin.html","issuerName":"東京しごと財団","pdfUrls":["https://www.koyokankyo.shigotozaidan.or.jp/jigyo/nocushara/shoreikin.files/R7_cusharaboushi_flyer.pdf"]}'
WHERE id = 'tokyo-shigoto-jigyo-nocushara';

-- 4. 介護休業取得応援奨励金
UPDATE subsidy_cache SET
  subsidy_max_limit = 300000,
  subsidy_rate = '定額',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"従業員の介護休業取得を促進する中小企業等を支援するため、介護休業を取得した従業員が原職復帰した場合に奨励金を支給します。","overview":"介護休業取得後の原職復帰を支援","application_requirements":"都内に本社または事業所を有する中小企業等であること。従業員が連続5日以上の介護休業を取得し、原職に復帰して3か月経過していること。","eligible_expenses":"介護休業制度の整備・運用費用","required_documents":"申請書、就業規則、介護休業申出書、復帰証明書、会社概要、決算書、出勤簿","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/kaigokyugyo/kaigo_shoreikin.html","issuerName":"東京しごと財団","pdfUrls":["https://www.koyokankyo.shigotozaidan.or.jp/jigyo/kaigokyugyo/kaigo_shoreikin.files/R7_chirashi_kaigo20250401.pdf"]}'
WHERE id = 'tokyo-shigoto-jigyo-kaigokyugyo';

-- 5. テレワーク定着強化奨励金
UPDATE subsidy_cache SET
  subsidy_max_limit = 500000,
  subsidy_rate = '定額',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"テレワークを定着させるための取組を行う中小企業等を支援するため、テレワーク実施状況に応じた奨励金を支給します。","overview":"テレワーク定着の取組を支援","application_requirements":"都内に本社または事業所を有する中小企業等であること。テレワーク可能な業務に従事する従業員のうち、月平均テレワーク実施回数が一定以上であること。","eligible_expenses":"テレワーク定着のための環境整備費用","required_documents":"申請書、テレワーク実施状況報告書、就業規則、勤務実績、会社概要、決算書","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/telework/tele-teichakukyoka/tele-teichakukyoka.html","issuerName":"東京しごと財団","pdfUrls":[]}'
WHERE id = 'tokyo-shigoto-telework-tele-teichakukyoka';

-- 6. DXリスキリング助成金
UPDATE subsidy_cache SET
  subsidy_max_limit = 640000,
  subsidy_rate = '定額',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"従業員のDXスキル習得を支援するため、eラーニング等によるDX関連研修の受講費用を助成します。","overview":"従業員のDXスキル習得研修費用を助成","application_requirements":"都内に本社または事業所を有する中小企業等であること。従業員にDX関連の研修を受講させること。研修は公社指定のeラーニング講座等であること。","eligible_expenses":"eラーニング受講料、DX関連研修受講料","required_documents":"申請書、受講計画書、会社概要、決算書、受講者名簿、研修修了証明書","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/skillup/","issuerName":"東京しごと財団","pdfUrls":[]}'
WHERE id = 'tokyo-shigoto-jigyo-skillup';

-- 7. 男女間賃金格差改善促進奨励金
UPDATE subsidy_cache SET
  subsidy_max_limit = 300000,
  subsidy_rate = '定額',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"男女間の賃金格差是正に取り組む中小企業等を支援するため、賃金格差改善のための取組を行った事業主に対して奨励金を支給します。","overview":"男女間賃金格差の改善取組を支援","application_requirements":"都内に本社または事業所を有する中小企業等であること。男女の賃金差異の公表を行っていること。賃金格差改善のための具体的な取組を実施すること。","eligible_expenses":"賃金制度見直し、人事評価制度改善、研修実施費用","required_documents":"申請書、賃金差異公表資料、改善取組計画書、会社概要、決算書、賃金台帳","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/kakusakaizen/","issuerName":"東京しごと財団","pdfUrls":[]}'
WHERE id = 'tokyo-shigoto-jigyo-kakusakaizen';

-- 8. ABWオフィス促進助成金
UPDATE subsidy_cache SET
  subsidy_max_limit = 3000000,
  subsidy_rate = '1/2',
  acceptance_end_datetime = '2026-03-31T17:00:00Z',
  request_reception_display_flag = 1,
  detail_json = '{"description":"Activity Based Working（ABW）の考え方を取り入れたオフィス環境の整備を支援するため、ABWオフィスの構築に要する経費の一部を助成します。","overview":"ABWオフィス環境の整備費用を助成","application_requirements":"都内に本社または事業所を有する中小企業等であること。ABWコンサルティングを受けていること。ABWの考え方に基づくオフィス環境を整備すること。","eligible_expenses":"オフィス家具、ICT機器、内装工事費、設計費","required_documents":"申請書、ABWオフィス整備計画書、コンサルティング利用証明書、会社概要、決算書、見積書、図面","deadline":"2026-03-31T17:00:00Z","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/abw/abw-boshu.html","issuerName":"東京しごと財団","pdfUrls":[]}'
WHERE id = 'tokyo-shigoto-abw-boshu';

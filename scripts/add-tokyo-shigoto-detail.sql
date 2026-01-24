-- tokyo-shigoto データを充実させる
-- P3-3: WALL_CHAT_READY を20件以上に

-- 1. テレワークトータルサポート助成金
UPDATE subsidy_cache 
SET detail_json = '{"description":"テレワークの導入・定着を総合的に支援する助成金です。テレワークに関する就業規則整備や機器導入等を助成します。テレワークトータルサポートコンサルティングを受けることが要件です。","overview":"テレワーク導入・定着を総合的に支援","application_requirements":"・東京都内に主たる事業所を有する中小企業\n・テレワークトータルサポートコンサルティングを利用すること\n・テレワークに関する就業規則を整備すること","eligible_expenses":"テレワーク関連機器購入費、通信環境整備費、就業規則整備に係る経費、研修費","required_documents":"申請書、コンサルティング受講証明書、就業規則、見積書、直近の確定申告書","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/telework/teletotal/total_joseikin.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-telework-teletotal';

-- 2. 介護休業取得応援奨励金
UPDATE subsidy_cache 
SET detail_json = '{"description":"従業員の介護休業取得を推進する企業を支援する奨励金です。介護休業取得後、原職復帰した場合に支給されます。","overview":"従業員の介護休業取得を支援する奨励金","application_requirements":"・東京都内に主たる事業所を有する企業\n・従業員が介護休業を取得し原職復帰すること\n・復帰後3ヶ月経過後に申請","eligible_expenses":"奨励金（定額支給）","required_documents":"申請書、雇用契約書、介護休業申出書、復職証明書、出勤簿","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/kaigokyugyo/kaigo_shoreikin.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-jigyo-kaigokyugyo';

-- 3. カスタマーハラスメント防止対策推進事業
UPDATE subsidy_cache 
SET detail_json = '{"description":"カスタマーハラスメント防止対策に取り組む企業を支援する奨励金です。マニュアル整備や研修実施等を奨励します。","overview":"カスハラ防止対策を支援する奨励金","application_requirements":"・東京都内に主たる事業所を有する企業\n・カスハラ対応マニュアルを整備すること\n・従業員向け研修を実施すること","eligible_expenses":"奨励金（定額支給）","required_documents":"申請書、対応マニュアル、研修実施報告書、就業規則","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/nocushara/shoreikin.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-jigyo-nocushara';

-- 4. 年収の壁突破総合対策促進奨励金
UPDATE subsidy_cache 
SET detail_json = '{"description":"年収の壁を意識せずに働ける環境整備に取り組む企業を支援する奨励金です。社会保険料補助制度の導入等を促進。","overview":"年収の壁突破のための取組を支援","application_requirements":"・東京都内に主たる事業所を有する企業\n・非正規雇用者の社会保険料負担軽減に取り組むこと\n・就業規則に規定を設けること","eligible_expenses":"奨励金（定額支給）","required_documents":"申請書、就業規則、制度導入計画書、対象従業員リスト","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/nenshunokabetoppa/nenshunokabe-toppa.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-jigyo-nenshunokabetoppa';

-- 5. テレワーク定着強化奨励金
UPDATE subsidy_cache 
SET detail_json = '{"description":"テレワークの定着・拡大に取り組む企業を支援する奨励金です。テレワーク実施率向上や制度の充実を促進します。","overview":"テレワーク定着・拡大を支援する奨励金","application_requirements":"・東京都内に主たる事業所を有する中小企業\n・テレワークを継続的に実施していること\n・テレワーク実施率の目標を設定すること","eligible_expenses":"奨励金（定額支給）","required_documents":"申請書、テレワーク実施記録、就業規則、従業員名簿","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/telework/tele-teichakukyoka/tele-teichakukyoka.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-telework-tele-teichakukyoka';

-- 6. DXリスキリング助成金
UPDATE subsidy_cache 
SET detail_json = '{"description":"従業員のDXスキル習得を支援する助成金です。デジタル人材育成のための研修費用等を助成します。","overview":"DXスキル習得研修を支援する助成金","application_requirements":"・東京都内に主たる事業所を有する中小企業\n・従業員向けDX研修を実施すること\n・研修計画を策定すること","eligible_expenses":"研修受講料、教材費、講師謝金、オンライン研修費用","required_documents":"申請書、研修計画書、研修カリキュラム、見積書、受講者名簿","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/skillup/dx_reskilling.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-jigyo-skillup';

-- 7. ABWオフィス促進助成金
UPDATE subsidy_cache 
SET detail_json = '{"description":"ABW（Activity Based Working）型オフィスへの改修を支援する助成金です。働き方改革に資するオフィス環境整備を促進。","overview":"ABW型オフィス改修を支援する助成金","application_requirements":"・東京都内に主たる事業所を有する中小企業\n・ABW型オフィスへの改修を行うこと\n・働き方改革計画を策定すること","eligible_expenses":"オフィス改修費、什器購入費、通信環境整備費、設計費","required_documents":"申請書、改修計画書、図面、見積書、直近の確定申告書","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/abw/abw_boshu.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-abw-boshu';

-- 8. 男女間賃金格差改善促進奨励金
UPDATE subsidy_cache 
SET detail_json = '{"description":"男女間の賃金格差改善に取り組む企業を支援する奨励金です。格差分析と改善計画の策定・実施を促進。","overview":"男女間賃金格差改善を支援する奨励金","application_requirements":"・東京都内に主たる事業所を有する企業\n・男女間賃金格差分析を実施すること\n・改善計画を策定・実施すること","eligible_expenses":"奨励金（定額支給）","required_documents":"申請書、賃金格差分析報告書、改善計画書、従業員名簿","issuerName":"東京しごと財団","detailUrl":"https://www.koyokankyo.shigotozaidan.or.jp/jigyo/kakusakaizen/overview.html","deadline":"2026-03-31T17:00:00Z"}'
WHERE id = 'tokyo-shigoto-jigyo-kakusakaizen';

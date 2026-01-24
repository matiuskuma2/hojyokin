-- P3-2C: required_forms シードデータ
-- tokyo-kosha と tokyo-shigoto の主要制度に required_forms を設定

-- 1. 製品改良／規格適合・認証取得支援事業 (tokyo-kosha-kairyo)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {"form_id":"form-1","name":"交付申請書","fields":[{"name":"申請者情報","required":true},{"name":"事業概要","required":true},{"name":"経費内訳","required":true}],"source_page":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/kairyo.html"},
        {"form_id":"form-2","name":"事業計画書","fields":[{"name":"事業目的","required":true},{"name":"実施内容","required":true},{"name":"スケジュール","required":true},{"name":"期待される効果","required":true}]},
        {"form_id":"form-3","name":"経費明細書","fields":[{"name":"経費項目","required":true},{"name":"金額","required":true},{"name":"算出根拠","required":true}]}
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'seed'
    )
  ),
  wall_chat_ready = 1
WHERE id = 'tokyo-kosha-kairyo';

-- 2. 安全・安心な東京の実現に向けた製品開発支援事業 (tokyo-kosha-anzen-anshin)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {"form_id":"form-1","name":"申請書","fields":[{"name":"企業概要","required":true},{"name":"代表者情報","required":true},{"name":"事業所情報","required":true}],"source_page":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/anzen_anshin.html"},
        {"form_id":"form-2","name":"事業計画書","fields":[{"name":"製品開発の背景","required":true},{"name":"開発内容","required":true},{"name":"市場性・社会的意義","required":true},{"name":"実施体制","required":true}]},
        {"form_id":"form-3","name":"収支予算書","fields":[{"name":"収入","required":true},{"name":"支出","required":true},{"name":"自己資金","required":true}]}
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'seed'
    )
  ),
  wall_chat_ready = 1
WHERE id = 'tokyo-kosha-anzen-anshin';

-- 3. 受動喫煙防止対策支援コース (tokyo-kosha-judoukitsuen)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {"form_id":"form-1","name":"交付申請書","fields":[{"name":"申請者情報","required":true},{"name":"店舗情報","required":true},{"name":"対策内容","required":true}],"source_page":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/judokitsuen.html"},
        {"form_id":"form-2","name":"工事見積書","fields":[{"name":"工事内容","required":true},{"name":"費用内訳","required":true}]},
        {"form_id":"form-3","name":"店舗図面","fields":[{"name":"現状図面","required":true},{"name":"改修後図面","required":true}]}
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'seed'
    )
  ),
  wall_chat_ready = 1
WHERE id = 'tokyo-kosha-judoukitsuen';

-- 4. 高齢者向け新ビジネス創出支援事業 (tokyo-kosha-koureisha)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {"form_id":"form-1","name":"申請書","fields":[{"name":"企業情報","required":true},{"name":"代表者経歴","required":true}],"source_page":"https://www.tokyo-kosha.or.jp/support/josei/jigyo/koureisha.html"},
        {"form_id":"form-2","name":"事業計画書","fields":[{"name":"ビジネスモデル","required":true},{"name":"ターゲット顧客","required":true},{"name":"収益計画","required":true},{"name":"高齢者への配慮","required":true}]},
        {"form_id":"form-3","name":"資金計画書","fields":[{"name":"必要資金","required":true},{"name":"調達方法","required":true}]}
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'seed'
    )
  ),
  wall_chat_ready = 1
WHERE id = 'tokyo-kosha-koureisha';

-- 5. 医療機器産業参入促進助成事業 (tokyo-kosha-iryokiki)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {"form_id":"form-1","name":"申請書","fields":[{"name":"企業概要","required":true},{"name":"医療機器開発実績","required":false}],"source_page":"https://www.tokyo-kosha.or.jp/support/josei/medical/index.html"},
        {"form_id":"form-2","name":"事業計画書","fields":[{"name":"開発する医療機器","required":true},{"name":"技術的特徴","required":true},{"name":"医療現場のニーズ","required":true},{"name":"薬事戦略","required":true}]},
        {"form_id":"form-3","name":"経費内訳書","fields":[{"name":"人件費","required":true},{"name":"外注費","required":true},{"name":"設備費","required":true},{"name":"その他経費","required":true}]}
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'seed'
    )
  ),
  wall_chat_ready = 1
WHERE id = 'tokyo-kosha-iryokiki';

-- tokyo-shigotoの制度にも追加
-- 6. 働き方改革推進事業 (tokyo-shigoto系の制度を特定)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {"form_id":"form-1","name":"申請書","fields":[{"name":"企業情報","required":true},{"name":"従業員数","required":true},{"name":"現在の労働環境","required":true}]},
        {"form_id":"form-2","name":"働き方改革計画書","fields":[{"name":"改革内容","required":true},{"name":"目標設定","required":true},{"name":"実施スケジュール","required":true}]}
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'seed'
    )
  ),
  wall_chat_ready = 1
WHERE source = 'tokyo-shigoto' 
  AND wall_chat_ready = 0
  AND json_extract(detail_json, '$.required_forms') IS NULL
LIMIT 3;

-- 確認クエリ
SELECT 
  id, 
  source, 
  title,
  json_array_length(json_extract(detail_json, '$.required_forms')) as forms_count,
  wall_chat_ready
FROM subsidy_cache
WHERE json_extract(detail_json, '$.required_forms') IS NOT NULL
  AND json_array_length(json_extract(detail_json, '$.required_forms')) > 0
ORDER BY json_extract(detail_json, '$.required_forms_extracted_at') DESC
LIMIT 10;

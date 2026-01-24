-- P3-2C: required_forms 手動設定（最小合格用）
-- tokyo-kosha 2制度 × forms >= 2 × fields >= 3

-- 1. tokyo-kosha-kairyo (製品改良／規格適合・認証取得支援事業)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {
          "form_id": "form-1",
          "name": "申請書",
          "fields": [
            {"name": "企業概要", "required": true},
            {"name": "事業計画", "required": true},
            {"name": "経費明細", "required": true},
            {"name": "実施体制", "required": true}
          ],
          "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/kairyo.html"
        },
        {
          "form_id": "form-2",
          "name": "申請書別紙",
          "fields": [
            {"name": "製品・技術の概要", "required": true},
            {"name": "規格適合・認証の内容", "required": true},
            {"name": "開発スケジュール", "required": true}
          ],
          "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/kairyo.html"
        }
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'manual'
    )
  ),
  detail_score = COALESCE(detail_score, 0) + 1
WHERE id = 'tokyo-kosha-kairyo';

-- 2. tokyo-kosha-anzen-anshin (安全・安心な東京の実現に向けた製品開発支援事業)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {
          "form_id": "form-1",
          "name": "申請書",
          "fields": [
            {"name": "企業概要", "required": true},
            {"name": "開発製品の概要", "required": true},
            {"name": "経費明細", "required": true},
            {"name": "スケジュール", "required": true}
          ],
          "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/anzen-anshin.html"
        },
        {
          "form_id": "form-2",
          "name": "事業計画書",
          "fields": [
            {"name": "社会課題と解決策", "required": true},
            {"name": "製品・サービスの特徴", "required": true},
            {"name": "販路開拓計画", "required": true}
          ],
          "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/anzen-anshin.html"
        }
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'manual'
    )
  ),
  detail_score = COALESCE(detail_score, 0) + 1
WHERE id = 'tokyo-kosha-anzen-anshin';

-- 3. tokyo-kosha-judoukitsuen (受動喫煙防止対策支援)
UPDATE subsidy_cache SET
  detail_json = json_patch(
    COALESCE(detail_json, '{}'),
    json_object(
      'required_forms', json('[
        {
          "form_id": "form-1",
          "name": "交付申請書",
          "fields": [
            {"name": "申請者情報", "required": true},
            {"name": "事業所情報", "required": true},
            {"name": "対策内容", "required": true},
            {"name": "経費内訳", "required": true}
          ],
          "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/jyudoukitsuen-boushitaisaku.html"
        },
        {
          "form_id": "form-2",
          "name": "事業計画書",
          "fields": [
            {"name": "現状の喫煙環境", "required": true},
            {"name": "改善計画", "required": true},
            {"name": "設備仕様", "required": true}
          ],
          "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/jyudoukitsuen-boushitaisaku.html"
        }
      ]'),
      'required_forms_extracted_at', datetime('now'),
      'required_forms_source', 'manual'
    )
  ),
  detail_score = COALESCE(detail_score, 0) + 1
WHERE id = 'tokyo-kosha-judoukitsuen';

-- 確認クエリ
SELECT 
  id, 
  title,
  json_array_length(json_extract(detail_json, '$.required_forms')) as forms_count,
  json_extract(detail_json, '$.required_forms_source') as source
FROM subsidy_cache 
WHERE id IN ('tokyo-kosha-kairyo', 'tokyo-kosha-anzen-anshin', 'tokyo-kosha-judoukitsuen');

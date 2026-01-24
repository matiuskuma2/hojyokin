-- P3-2C-0 合格条件修正: 各formのfields.length >= 3

-- tokyo-kosha-iryokiki のform-1にfieldsを追加
UPDATE subsidy_cache
SET detail_json = json_set(
  detail_json,
  '$.required_forms',
  json('[
    {
      "form_id": "form-1",
      "name": "申請書",
      "fields": [
        {"name": "企業概要", "required": true},
        {"name": "医療機器開発実績", "required": false},
        {"name": "代表者経歴", "required": true},
        {"name": "連絡先", "required": true}
      ],
      "source_page": "https://www.tokyo-kosha.or.jp/support/josei/medical/index.html"
    },
    {
      "form_id": "form-2",
      "name": "事業計画書",
      "fields": [
        {"name": "開発する医療機器", "required": true},
        {"name": "技術的特徴", "required": true},
        {"name": "医療現場のニーズ", "required": true},
        {"name": "薬事戦略", "required": true}
      ]
    },
    {
      "form_id": "form-3",
      "name": "経費内訳書",
      "fields": [
        {"name": "人件費", "required": true},
        {"name": "外注費", "required": true},
        {"name": "設備費", "required": true},
        {"name": "その他経費", "required": true}
      ]
    }
  ]')
)
WHERE id = 'tokyo-kosha-iryokiki';

-- tokyo-kosha-koureisha のform-1とform-3にfieldsを追加
UPDATE subsidy_cache
SET detail_json = json_set(
  detail_json,
  '$.required_forms',
  json('[
    {
      "form_id": "form-1",
      "name": "申請書",
      "fields": [
        {"name": "企業情報", "required": true},
        {"name": "代表者経歴", "required": true},
        {"name": "事業所所在地", "required": true},
        {"name": "従業員数", "required": true}
      ],
      "source_page": "https://www.tokyo-kosha.or.jp/support/josei/jigyo/koureisha.html"
    },
    {
      "form_id": "form-2",
      "name": "事業計画書",
      "fields": [
        {"name": "ビジネスモデル", "required": true},
        {"name": "ターゲット顧客", "required": true},
        {"name": "収益計画", "required": true},
        {"name": "高齢者への配慮", "required": true}
      ]
    },
    {
      "form_id": "form-3",
      "name": "資金計画書",
      "fields": [
        {"name": "必要資金", "required": true},
        {"name": "調達方法", "required": true},
        {"name": "返済計画", "required": true}
      ]
    }
  ]')
)
WHERE id = 'tokyo-kosha-koureisha';

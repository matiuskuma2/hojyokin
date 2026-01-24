/**
 * 3本柱の detail_json に required_forms を追加するスクリプト
 * 
 * 実行: npx wrangler d1 execute subsidy-matching-production --remote --file=./scripts/update-three-pillars.sql
 */

// IT導入補助金 (REAL-001)
const REAL_001_FORMS = [
  {
    name: "交付申請書（様式第1）",
    form_id: "様式第1",
    fields: [
      "申請者情報（法人名・代表者名・所在地）",
      "gBizIDプライム",
      "事業概要",
      "ITツール情報",
      "補助事業計画",
      "経費明細",
      "資金調達計画"
    ],
    source_page: null,
    notes: "電子申請のみ（IT導入補助金事務局ポータル）"
  },
  {
    name: "事業計画書",
    form_id: "別紙",
    fields: [
      "経営課題・ニーズ",
      "導入するITツール",
      "期待効果（労働生産性向上）",
      "賃上げ・従業員処遇",
      "情報セキュリティ対策"
    ],
    source_page: null,
    notes: "3年間の事業計画を策定"
  }
];

// ものづくり補助金 (REAL-002)
const REAL_002_FORMS = [
  {
    name: "交付申請書（様式第1号）",
    form_id: "様式第1号",
    fields: [
      "申請者情報",
      "事業計画名",
      "補助対象経費",
      "補助金申請額",
      "補助事業概要",
      "資金調達方法"
    ],
    source_page: null,
    notes: "電子申請（GビズIDプライム必須）"
  },
  {
    name: "事業計画書",
    form_id: "様式第2号",
    fields: [
      "事業内容",
      "革新性・優位性",
      "具体的な数値目標",
      "事業スケジュール",
      "設備投資計画",
      "賃上げ計画"
    ],
    source_page: null,
    notes: "10ページ以内、A4判"
  },
  {
    name: "経費明細表",
    form_id: "様式第3号",
    fields: [
      "経費区分",
      "品目",
      "仕様",
      "数量",
      "単価",
      "金額",
      "見積根拠"
    ],
    source_page: null,
    notes: "見積書添付必須"
  }
];

// 小規模持続化補助金 (REAL-003)
const REAL_003_FORMS = [
  {
    name: "経営計画書（様式1-1）",
    form_id: "様式1-1",
    fields: [
      "企業概要",
      "顧客ニーズ・市場動向",
      "自社の強み",
      "経営方針",
      "目標",
      "経営計画（今後のプラン）"
    ],
    source_page: null,
    notes: "商工会議所/商工会の確認印が必要"
  },
  {
    name: "補助事業計画書（様式2-1）",
    form_id: "様式2-1",
    fields: [
      "補助事業名",
      "販路開拓等の取組内容",
      "業務効率化の取組内容",
      "補助事業の効果"
    ],
    source_page: null,
    notes: null
  },
  {
    name: "補助事業計画書（様式3-1）経費明細表",
    form_id: "様式3-1",
    fields: [
      "経費区分",
      "内容・仕様等",
      "単価",
      "数量",
      "経費合計額",
      "補助金交付申請額"
    ],
    source_page: null,
    notes: "1回の申請上限50万円（一般型）"
  }
];

console.log('REAL-001 forms:', JSON.stringify(REAL_001_FORMS));
console.log('REAL-002 forms:', JSON.stringify(REAL_002_FORMS));
console.log('REAL-003 forms:', JSON.stringify(REAL_003_FORMS));

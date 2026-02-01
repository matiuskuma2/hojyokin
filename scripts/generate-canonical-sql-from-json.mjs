#!/usr/bin/env node
/**
 * generate-canonical-sql-from-json.mjs
 * 
 * /tmp/jgrants_data.json からcanonical/link SQLを生成
 */

import fs from 'fs';
import crypto from 'crypto';

// =============================================================================
// ユーティリティ
// =============================================================================

function uuid() {
  return crypto.randomUUID();
}

function escapeSQL(str) {
  if (str === null || str === undefined) return null;
  return String(str).replace(/'/g, "''");
}

function sqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return `'${escapeSQL(val)}'`;
}

function normalizeWhitespace(str) {
  if (!str) return '';
  return str.replace(/[\t\n\r\f\v]+/g, ' ').replace(/\s+/g, ' ').replace(/　/g, ' ').trim();
}

// 都道府県マッピング
const PREF_MAP = {
  '北海道': '01', '青森県': '02', '岩手県': '03', '宮城県': '04', '秋田県': '05',
  '山形県': '06', '福島県': '07', '茨城県': '08', '栃木県': '09', '群馬県': '10',
  '埼玉県': '11', '千葉県': '12', '東京都': '13', '神奈川県': '14', '新潟県': '15',
  '富山県': '16', '石川県': '17', '福井県': '18', '山梨県': '19', '長野県': '20',
  '岐阜県': '21', '静岡県': '22', '愛知県': '23', '三重県': '24', '滋賀県': '25',
  '京都府': '26', '大阪府': '27', '兵庫県': '28', '奈良県': '29', '和歌山県': '30',
  '鳥取県': '31', '島根県': '32', '岡山県': '33', '広島県': '34', '山口県': '35',
  '徳島県': '36', '香川県': '37', '愛媛県': '38', '高知県': '39', '福岡県': '40',
  '佐賀県': '41', '長崎県': '42', '熊本県': '43', '大分県': '44', '宮崎県': '45',
  '鹿児島県': '46', '沖縄県': '47'
};

function extractPrefectureCode(areaSearch) {
  if (!areaSearch) return null;
  if (areaSearch === '全国') return '00';
  
  for (const [name, code] of Object.entries(PREF_MAP)) {
    if (areaSearch.includes(name)) {
      return code;
    }
  }
  return null;
}

function extractIssuer(detailJson, title) {
  if (!detailJson || detailJson === '{}') {
    const match = title.match(/【(.+?)】/);
    if (match) return match[1];
    return null;
  }
  
  try {
    const detail = JSON.parse(detailJson);
    return detail.issuer || detail.organization || detail.contact_name || null;
  } catch {
    return null;
  }
}

// =============================================================================
// メイン処理
// =============================================================================

function main() {
  const jsonPath = '/tmp/jgrants_data.json';
  
  // JSON読み込み
  const rawJson = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(rawJson);
  
  // results配列を取得
  const results = data[0]?.results || [];
  
  console.error(`[INFO] Found ${results.length} jGrants records`);
  
  // ヘッダー出力
  console.log('-- =============================================================================');
  console.log('-- canonical/link data import');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Records: ${results.length}`);
  console.log('-- =============================================================================');
  console.log('');
  
  let processed = 0;
  
  for (const row of results) {
    const jgrantsId = row.id;
    const title = row.title || '';
    const areaSearch = row.target_area_search || '';
    const detailJson = row.detail_json || '{}';
    
    // canonical_id生成（jGrants IDベース）
    const canonicalId = `jg-${jgrantsId}`;
    const linkId = uuid();
    
    // 属性抽出
    const prefCode = extractPrefectureCode(areaSearch);
    const issuer = extractIssuer(detailJson, title);
    const nameNormalized = normalizeWhitespace(title).toLowerCase();
    
    // INSERT canonical
    console.log(`INSERT OR IGNORE INTO subsidy_canonical (`);
    console.log(`  id, name, name_normalized, issuer_name, prefecture_code,`);
    console.log(`  latest_cache_id, is_active, created_at, updated_at`);
    console.log(`) VALUES (`);
    console.log(`  ${sqlValue(canonicalId)}, ${sqlValue(title)}, ${sqlValue(nameNormalized)},`);
    console.log(`  ${sqlValue(issuer)}, ${sqlValue(prefCode)},`);
    console.log(`  ${sqlValue(jgrantsId)}, 1, datetime('now'), datetime('now')`);
    console.log(`);`);
    console.log('');
    
    // INSERT source_link
    console.log(`INSERT OR IGNORE INTO subsidy_source_link (`);
    console.log(`  id, canonical_id, source_type, source_id,`);
    console.log(`  match_type, match_score, verified, created_at, updated_at`);
    console.log(`) VALUES (`);
    console.log(`  ${sqlValue(linkId)}, ${sqlValue(canonicalId)}, 'jgrants', ${sqlValue(jgrantsId)},`);
    console.log(`  'system', 1.0, 1, datetime('now'), datetime('now')`);
    console.log(`);`);
    console.log('');
    
    // UPDATE subsidy_cache
    console.log(`UPDATE subsidy_cache SET canonical_id = ${sqlValue(canonicalId)} WHERE id = ${sqlValue(jgrantsId)};`);
    console.log('');
    
    processed++;
  }
  
  console.error(`[INFO] Processed: ${processed} records`);
}

main();

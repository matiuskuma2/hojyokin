#!/usr/bin/env node
/**
 * generate-canonical-sql.mjs
 * 
 * subsidy_cache(jgrants) から canonical/link を生成するSQL
 * 
 * 使用方法:
 *   node scripts/generate-canonical-sql.mjs > migrations/local/canonical_data.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

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

// =============================================================================
// 都道府県マッピング
// =============================================================================

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

// =============================================================================
// issuer抽出
// =============================================================================

function extractIssuer(detailJson, title) {
  if (!detailJson || detailJson === '{}') {
    // titleから推測
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
  const args = process.argv.slice(2);
  let limit = null;
  let dbPath = path.join(PROJECT_ROOT, 'data/sqlite/local_test.db');
  
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
    if (arg.startsWith('--db=')) {
      dbPath = arg.split('=')[1];
    }
  }
  
  // SQLite接続
  const db = new Database(dbPath, { readonly: true });
  
  // jGrantsデータ取得
  const stmt = db.prepare(`
    SELECT id, title, target_area_search, detail_json
    FROM subsidy_cache
    WHERE source = 'jgrants'
    ORDER BY id
    ${limit ? `LIMIT ${limit}` : ''}
  `);
  
  const rows = stmt.all();
  
  console.error(`[INFO] Found ${rows.length} jGrants records`);
  
  // ヘッダー出力
  console.log('-- =============================================================================');
  console.log('-- canonical/link data import from jGrants');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Records: ${rows.length}`);
  console.log('-- =============================================================================');
  console.log('');
  
  let canonicalCreated = 0;
  let linksCreated = 0;
  
  for (const row of rows) {
    const jgrantsId = row.id;
    const title = row.title;
    const areaSearch = row.target_area_search;
    const detailJson = row.detail_json;
    
    // canonical_id 生成（jgrants-{id}形式）
    const canonicalId = `jg-${jgrantsId}`;
    
    // 正規化名称
    const nameNormalized = normalizeWhitespace(title).toLowerCase();
    
    // 都道府県コード
    const prefCode = extractPrefectureCode(areaSearch);
    
    // issuer抽出
    const issuer = extractIssuer(detailJson, title);
    
    // subsidy_canonical INSERT
    console.log(`INSERT OR IGNORE INTO subsidy_canonical (
  id, name, name_normalized, issuer_code, issuer_name, prefecture_code,
  latest_cache_id, is_active, created_at, updated_at
) VALUES (
  ${sqlValue(canonicalId)}, ${sqlValue(title)}, ${sqlValue(nameNormalized)},
  NULL, ${sqlValue(issuer)}, ${sqlValue(prefCode)},
  ${sqlValue(jgrantsId)}, 1, datetime('now'), datetime('now')
);`);
    canonicalCreated++;
    
    // subsidy_source_link INSERT
    const linkId = uuid();
    console.log(`INSERT OR IGNORE INTO subsidy_source_link (
  id, canonical_id, source_type, source_id, match_type, match_score, verified,
  created_at, updated_at
) VALUES (
  ${sqlValue(linkId)}, ${sqlValue(canonicalId)}, 'jgrants', ${sqlValue(jgrantsId)},
  'system', 1.0, 1, datetime('now'), datetime('now')
);`);
    linksCreated++;
    
    // subsidy_cache.canonical_id UPDATE
    console.log(`UPDATE subsidy_cache SET canonical_id = ${sqlValue(canonicalId)} WHERE id = ${sqlValue(jgrantsId)};`);
    console.log('');
  }
  
  db.close();
  
  // 統計出力
  console.log('-- =============================================================================');
  console.log(`-- Statistics:`);
  console.log(`--   Canonical created: ${canonicalCreated}`);
  console.log(`--   Links created: ${linksCreated}`);
  console.log('-- =============================================================================');
  
  console.error(`[INFO] Canonical: ${canonicalCreated}, Links: ${linksCreated}`);
}

main();

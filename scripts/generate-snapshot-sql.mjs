#!/usr/bin/env node
/**
 * generate-snapshot-sql.mjs
 * 
 * subsidy_cache(jgrants, canonical_id設定済み) から subsidy_snapshot を生成するSQL
 * 
 * 使用方法:
 *   node scripts/generate-snapshot-sql.mjs > migrations/local/snapshot_data.sql
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

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
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

// =============================================================================
// content_hash生成（正規化済みJSONからsha256）
// =============================================================================

function normalizeForHash(obj) {
  // JSONキーをソートして正規化
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted);
}

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = sortObjectKeys(obj[key]);
    return acc;
  }, {});
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
  
  // jGrants with canonical_id 取得
  const stmt = db.prepare(`
    SELECT 
      id, canonical_id, title, 
      subsidy_max_limit, subsidy_rate,
      target_area_search, target_industry, target_number_of_employees,
      acceptance_start_datetime, acceptance_end_datetime,
      request_reception_display_flag,
      detail_json
    FROM subsidy_cache
    WHERE source = 'jgrants' AND canonical_id IS NOT NULL
    ORDER BY id
    ${limit ? `LIMIT ${limit}` : ''}
  `);
  
  const rows = stmt.all();
  
  console.error(`[INFO] Found ${rows.length} jGrants records with canonical_id`);
  
  // ヘッダー出力
  console.log('-- =============================================================================');
  console.log('-- snapshot data import from jGrants');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Records: ${rows.length}`);
  console.log('-- =============================================================================');
  console.log('');
  
  let snapshotsCreated = 0;
  
  for (const row of rows) {
    const snapshotId = uuid();
    const canonicalId = row.canonical_id;
    const jgrantsId = row.id;
    
    // snapshot_json を構築
    const snapshotJson = {
      title: row.title,
      subsidy_max_limit: row.subsidy_max_limit,
      subsidy_rate: row.subsidy_rate,
      target_area_search: row.target_area_search,
      target_industry: row.target_industry,
      target_number_of_employees: row.target_number_of_employees,
      acceptance_start_datetime: row.acceptance_start_datetime,
      acceptance_end_datetime: row.acceptance_end_datetime,
      request_reception_display_flag: row.request_reception_display_flag
    };
    
    // detail_jsonがあれば追加
    if (row.detail_json && row.detail_json !== '{}') {
      try {
        const detail = JSON.parse(row.detail_json);
        snapshotJson.detail = detail;
      } catch {}
    }
    
    // content_hash 生成
    const normalizedJson = normalizeForHash(snapshotJson);
    const contentHash = sha256(normalizedJson);
    
    // is_accepting 計算
    let isAccepting = 0;
    if (row.request_reception_display_flag === 1) {
      const now = new Date();
      const endDate = row.acceptance_end_datetime ? new Date(row.acceptance_end_datetime) : null;
      if (!endDate || endDate > now) {
        isAccepting = 1;
      }
    }
    
    // subsidy_snapshot INSERT
    console.log(`INSERT INTO subsidy_snapshot (
  id, canonical_id, source_link_id, 
  acceptance_start, acceptance_end, is_accepting,
  subsidy_max_limit, subsidy_rate,
  target_area_text, target_industry_codes, target_employee_text,
  detail_json, snapshot_at, content_hash, created_at
) VALUES (
  ${sqlValue(snapshotId)}, ${sqlValue(canonicalId)}, NULL,
  ${sqlValue(row.acceptance_start_datetime)}, ${sqlValue(row.acceptance_end_datetime)}, ${isAccepting},
  ${row.subsidy_max_limit !== null ? row.subsidy_max_limit : 'NULL'}, ${sqlValue(row.subsidy_rate)},
  ${sqlValue(row.target_area_search)}, ${sqlValue(row.target_industry)}, ${sqlValue(row.target_number_of_employees)},
  ${sqlValue(JSON.stringify(snapshotJson))}, datetime('now'), ${sqlValue(contentHash)}, datetime('now')
);`);
    
    // canonical.latest_snapshot_id UPDATE
    console.log(`UPDATE subsidy_canonical SET latest_snapshot_id = ${sqlValue(snapshotId)}, updated_at = datetime('now') WHERE id = ${sqlValue(canonicalId)};`);
    console.log('');
    
    snapshotsCreated++;
  }
  
  db.close();
  
  // 統計出力
  console.log('-- =============================================================================');
  console.log(`-- Statistics:`);
  console.log(`--   Snapshots created: ${snapshotsCreated}`);
  console.log('-- =============================================================================');
  
  console.error(`[INFO] Snapshots: ${snapshotsCreated}`);
}

main();

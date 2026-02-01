#!/usr/bin/env node
/**
 * generate-snapshot-sql-from-json.mjs
 * 
 * /tmp/jgrants_data.json からsnapshot SQLを生成
 */

import fs from 'fs';
import crypto from 'crypto';

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

function normalizeForHash(obj) {
  // キーをソートしてJSON化（ハッシュ安定化のため）
  return JSON.stringify(obj, Object.keys(obj).sort());
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
  
  console.error(`[INFO] Found ${results.length} jGrants records with canonical_id`);
  
  // ヘッダー出力
  console.log('-- =============================================================================');
  console.log('-- snapshot data import');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Records: ${results.length}`);
  console.log('-- =============================================================================');
  console.log('');
  
  let processed = 0;
  let acceptingCount = 0;
  
  for (const row of results) {
    const jgrantsId = row.id;
    const title = row.title || '';
    const canonicalId = `jg-${jgrantsId}`;
    const snapshotId = uuid();
    
    // 期間
    const acceptanceStart = row.acceptance_start_datetime || null;
    const acceptanceEnd = row.acceptance_end_datetime || null;
    
    // 受付中判定（現在日時と比較）
    const now = new Date();
    let isAccepting = 0;
    if (acceptanceStart && acceptanceEnd) {
      const start = new Date(acceptanceStart);
      const end = new Date(acceptanceEnd);
      if (now >= start && now <= end) {
        isAccepting = 1;
        acceptingCount++;
      }
    }
    
    // 金額
    const subsidyMaxLimit = row.subsidy_max_limit || null;
    const subsidyRate = row.subsidy_rate || null;
    
    // detail_json
    const detailJson = row.detail_json || '{}';
    
    // スナップショットJSON（簡易版）
    const snapshotData = {
      id: jgrantsId,
      title: title,
      acceptance_start: acceptanceStart,
      acceptance_end: acceptanceEnd,
      subsidy_max_limit: subsidyMaxLimit
    };
    
    // content_hash生成
    const contentHash = sha256(normalizeForHash(snapshotData));
    
    // INSERT snapshot
    console.log(`INSERT INTO subsidy_snapshot (`);
    console.log(`  id, canonical_id, acceptance_start, acceptance_end, is_accepting,`);
    console.log(`  subsidy_max_limit, subsidy_rate, detail_json, content_hash, created_at`);
    console.log(`) VALUES (`);
    console.log(`  ${sqlValue(snapshotId)}, ${sqlValue(canonicalId)},`);
    console.log(`  ${sqlValue(acceptanceStart)}, ${sqlValue(acceptanceEnd)}, ${isAccepting},`);
    console.log(`  ${subsidyMaxLimit || 'NULL'}, ${sqlValue(subsidyRate)},`);
    console.log(`  ${sqlValue(detailJson)},`);
    console.log(`  ${sqlValue(contentHash)}, datetime('now')`);
    console.log(`);`);
    console.log('');
    
    // UPDATE canonical with latest_snapshot_id
    console.log(`UPDATE subsidy_canonical SET latest_snapshot_id = ${sqlValue(snapshotId)} WHERE id = ${sqlValue(canonicalId)};`);
    console.log('');
    
    processed++;
  }
  
  console.error(`[INFO] Processed: ${processed} records, Accepting: ${acceptingCount}`);
}

main();

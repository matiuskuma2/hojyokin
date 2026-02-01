#!/usr/bin/env node
/**
 * snapshot-jgrants.mjs
 * 
 * subsidy_cache（canonical_id設定済み）から subsidy_snapshot を生成
 * 差分検知（diff_json）と変更通知のトリガーにする
 * 
 * 使用方法:
 *   node scripts/snapshot-jgrants.mjs --local
 *   node scripts/snapshot-jgrants.mjs --local --dry-run
 *   node scripts/snapshot-jgrants.mjs --local --diff-only
 *   node scripts/snapshot-jgrants.mjs --local --force
 *   node scripts/snapshot-jgrants.mjs --local --canonical-id=jg-12345
 *   node scripts/snapshot-jgrants.mjs --local --limit=100
 *   node scripts/snapshot-jgrants.mjs --local --resume
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  ScriptRunner, 
  sha256, 
  escapeSQL, 
  sqlValue, 
  normalizeWhitespace 
} from './lib/script-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =============================================================================
// ユーティリティ
// =============================================================================

/**
 * 現在受付中かどうか判定
 */
function isCurrentlyAccepting(startDatetime, endDatetime) {
  const now = new Date();
  const start = startDatetime ? new Date(startDatetime) : null;
  const end = endDatetime ? new Date(endDatetime) : null;
  
  if (!start && !end) return 0;
  if (start && now < start) return 0;
  if (end && now > end) return 0;
  return 1;
}

/**
 * 補助率テキストから最大率を抽出
 */
function parseRateMax(rateText) {
  if (!rateText) return null;
  
  const fractionMatch = rateText.match(/(\d+)\s*[\/／]\s*(\d+)/);
  if (fractionMatch) {
    return parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
  }
  
  const percentMatch = rateText.match(/(\d+(?:\.\d+)?)\s*[%％]/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]) / 100;
  }
  
  return null;
}

/**
 * 地域テキストから地域コード配列を生成
 */
function extractAreaCodes(areaText) {
  if (!areaText) return '["00"]';
  
  const prefMap = {
    '北海道': '01', '青森': '02', '岩手': '03', '宮城': '04', '秋田': '05',
    '山形': '06', '福島': '07', '茨城': '08', '栃木': '09', '群馬': '10',
    '埼玉': '11', '千葉': '12', '東京': '13', '神奈川': '14', '新潟': '15',
    '富山': '16', '石川': '17', '福井': '18', '山梨': '19', '長野': '20',
    '岐阜': '21', '静岡': '22', '愛知': '23', '三重': '24', '滋賀': '25',
    '京都': '26', '大阪': '27', '兵庫': '28', '奈良': '29', '和歌山': '30',
    '鳥取': '31', '島根': '32', '岡山': '33', '広島': '34', '山口': '35',
    '徳島': '36', '香川': '37', '愛媛': '38', '高知': '39', '福岡': '40',
    '佐賀': '41', '長崎': '42', '熊本': '43', '大分': '44', '宮崎': '45',
    '鹿児島': '46', '沖縄': '47'
  };
  
  const codes = [];
  for (const [pref, code] of Object.entries(prefMap)) {
    if (areaText.includes(pref)) {
      codes.push(code);
    }
  }
  
  if (areaText.includes('全国') || codes.length === 0) {
    return '["00"]';
  }
  
  return JSON.stringify(codes);
}

/**
 * 募集回キーを抽出
 */
function extractRoundKey(detailJson) {
  if (!detailJson) return null;
  
  try {
    const title = detailJson.title || '';
    const roundMatch = title.match(/第(\d+)[次回期]/);
    if (roundMatch) {
      const year = new Date().getFullYear();
      return `${year}-r${roundMatch[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * スナップショット用の正規化JSONを生成（キーをソート）
 */
function createSnapshotJson(cacheRow, detailJson) {
  const snapshot = {
    acceptance_end: cacheRow.acceptance_end_datetime || null,
    acceptance_start: cacheRow.acceptance_start_datetime || null,
    area: cacheRow.target_area_search || null,
    eligible_expenses: detailJson?.eligible_expenses ? 
      normalizeWhitespace(detailJson.eligible_expenses).substring(0, 500) : null,
    industry: cacheRow.target_industry || null,
    max_limit: cacheRow.subsidy_max_limit || null,
    overview: detailJson?.overview ? 
      normalizeWhitespace(detailJson.overview).substring(0, 500) : null,
    rate: cacheRow.subsidy_rate || null,
    requirements: detailJson?.application_requirements ? 
      normalizeWhitespace(detailJson.application_requirements).substring(0, 500) : null,
    title: cacheRow.title || null
  };
  
  // キーをソートしてJSON化
  const sortedKeys = Object.keys(snapshot).sort();
  const sorted = {};
  for (const key of sortedKeys) {
    sorted[key] = snapshot[key];
  }
  
  return JSON.stringify(sorted);
}

/**
 * スナップショットのコンテンツハッシュを計算
 */
function calculateContentHash(snapshotJson) {
  return sha256(snapshotJson);
}

/**
 * 差分を計算
 */
function calculateDiff(oldSnapshotJson, newSnapshotJson) {
  if (!oldSnapshotJson) return null;
  
  try {
    const oldData = JSON.parse(oldSnapshotJson);
    const newData = JSON.parse(newSnapshotJson);
    
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    for (const key of allKeys) {
      const oldVal = oldData[key];
      const newVal = newData[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          key,
          before: oldVal,
          after: newVal
        });
      }
    }
    
    return changes.length > 0 ? JSON.stringify(changes) : null;
  } catch {
    return null;
  }
}

/**
 * スナップショットIDを生成
 */
function generateSnapshotId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `snap-${timestamp}-${random}`;
}

// =============================================================================
// メイン処理
// =============================================================================

const runner = new ScriptRunner('snapshot-jgrants', process.argv.slice(2));

runner.run(async (ctx) => {
  const { args, logger, db, stats, resumeState, updateStats, saveCheckpoint, handleError } = ctx;
  
  // 対象取得用のWHERE句
  let whereClause = 'canonical_id IS NOT NULL';
  if (args.canonicalId) {
    whereClause += ` AND canonical_id = '${args.canonicalId}'`;
  }
  
  // 対象件数取得
  const totalCount = db.count('subsidy_cache', whereClause);
  logger.info('Target rows', { count: totalCount });
  
  if (totalCount === 0) {
    logger.info('No rows to process');
    return;
  }
  
  // 再開ポイント
  let lastCanonicalId = null;
  if (resumeState && resumeState.last_processed_id) {
    lastCanonicalId = resumeState.last_processed_id;
  }
  
  // 統計
  let snapshotsCreated = 0;
  let snapshotsSkipped = 0;
  let canonicalMissing = 0;
  let processed = 0;
  
  // バッチ処理
  let offset = 0;
  const batchSize = args.batchSize;
  
  while (true) {
    // バッチ取得
    let sql = `
      SELECT id, canonical_id, source, title, subsidy_max_limit, subsidy_rate,
             target_area_search, target_industry, target_number_of_employees,
             acceptance_start_datetime, acceptance_end_datetime,
             request_reception_display_flag, detail_json, cached_at
      FROM subsidy_cache
      WHERE ${whereClause}
    `;
    
    if (lastCanonicalId) {
      sql += ` AND canonical_id > '${lastCanonicalId}'`;
    }
    
    sql += ` ORDER BY canonical_id LIMIT ${batchSize}`;
    
    const batchResult = db.query(sql);
    
    if (!batchResult.success || batchResult.rows.length === 0) {
      break;
    }
    
    for (const row of batchResult.rows) {
      // limit チェック
      if (args.limit && processed >= args.limit) {
        logger.info('Limit reached', { limit: args.limit });
        return;
      }
      
      processed++;
      
      try {
        if (!row.canonical_id) {
          canonicalMissing++;
          updateStats({ skipped: stats.skipped + 1 });
          continue;
        }
        
        // detail_jsonをパース
        let detailJson = null;
        try {
          detailJson = row.detail_json ? JSON.parse(row.detail_json) : null;
        } catch {}
        
        // スナップショット用JSON生成
        const snapshotJson = createSnapshotJson(row, detailJson);
        const contentHash = calculateContentHash(snapshotJson);
        
        // 既存スナップショット取得（最新）
        const existingResult = db.query(`
          SELECT id, content_hash, 
                 (SELECT id FROM subsidy_snapshot 
                  WHERE canonical_id = '${row.canonical_id}' 
                  AND superseded_by IS NULL 
                  ORDER BY snapshot_at DESC LIMIT 1) as latest_snapshot_id,
                 (SELECT detail_json FROM subsidy_snapshot 
                  WHERE canonical_id = '${row.canonical_id}' 
                  AND superseded_by IS NULL 
                  ORDER BY snapshot_at DESC LIMIT 1) as latest_snapshot_json
          FROM subsidy_snapshot
          WHERE canonical_id = '${row.canonical_id}' AND superseded_by IS NULL
          ORDER BY snapshot_at DESC LIMIT 1
        `);
        
        const existingSnapshot = existingResult.success && existingResult.rows.length > 0 
          ? existingResult.rows[0] 
          : null;
        
        // 差分チェック（--forceでない場合）
        if (!args.force && existingSnapshot && existingSnapshot.content_hash === contentHash) {
          snapshotsSkipped++;
          updateStats({ skipped: stats.skipped + 1, last_processed_id: row.canonical_id });
          
          if (processed % 100 === 0) {
            logger.progress(processed, totalCount, { lastId: row.canonical_id });
          }
          continue;
        }
        
        // --diff-only: 差分がない場合はスキップ（上でチェック済み）
        
        // 差分計算
        const diffJson = existingSnapshot 
          ? calculateDiff(existingSnapshot.latest_snapshot_json, row.detail_json)
          : null;
        
        // スナップショット作成
        const snapshotId = generateSnapshotId();
        const roundKey = extractRoundKey(detailJson);
        const fiscalYear = detailJson?.fiscal_year || null;
        const isAccepting = isCurrentlyAccepting(
          row.acceptance_start_datetime,
          row.acceptance_end_datetime
        );
        const rateMax = parseRateMax(row.subsidy_rate);
        const areaCodes = extractAreaCodes(row.target_area_search);
        const officialUrl = detailJson?.related_url || detailJson?.official_url || '';
        const pdfUrls = JSON.stringify(detailJson?.pdfUrls || []);
        const attachments = JSON.stringify(detailJson?.attachments || []);
        
        const insertSql = `
          INSERT INTO subsidy_snapshot (
            id, canonical_id, source_link_id, round_key, fiscal_year,
            acceptance_start, acceptance_end, deadline_text, is_accepting,
            subsidy_max_limit, subsidy_min_limit, subsidy_rate, subsidy_rate_max,
            target_area_codes, target_area_text, target_industry_codes, target_employee_text,
            official_url, pdf_urls, attachments, detail_json,
            snapshot_at, content_hash,
            diff_against_snapshot_id, diff_json,
            created_at
          ) VALUES (
            ${sqlValue(snapshotId)}, ${sqlValue(row.canonical_id)}, NULL,
            ${sqlValue(roundKey)}, ${sqlValue(fiscalYear)},
            ${sqlValue(row.acceptance_start_datetime)}, ${sqlValue(row.acceptance_end_datetime)},
            ${sqlValue(detailJson?.deadline)}, ${isAccepting},
            ${row.subsidy_max_limit || 'NULL'}, ${detailJson?.subsidy_min_limit || 'NULL'},
            ${sqlValue(row.subsidy_rate)}, ${rateMax !== null ? rateMax : 'NULL'},
            ${sqlValue(areaCodes)}, ${sqlValue(row.target_area_search)},
            ${sqlValue(JSON.stringify([row.target_industry]))}, ${sqlValue(row.target_number_of_employees)},
            ${sqlValue(officialUrl)}, ${sqlValue(pdfUrls)}, ${sqlValue(attachments)},
            ${sqlValue(row.detail_json)},
            datetime('now'), ${sqlValue(contentHash)},
            ${sqlValue(existingSnapshot?.id || null)}, ${sqlValue(diffJson)},
            datetime('now')
          )
        `;
        
        if (!args.dryRun) {
          const insertResult = db.execute(insertSql);
          if (!insertResult.success) {
            handleError(insertResult.error, { canonical_id: row.canonical_id });
            continue;
          }
          
          // 旧スナップショットにsuperseded_by設定
          if (existingSnapshot) {
            db.execute(`
              UPDATE subsidy_snapshot 
              SET superseded_by = ${sqlValue(snapshotId)}
              WHERE canonical_id = ${sqlValue(row.canonical_id)}
                AND id != ${sqlValue(snapshotId)}
                AND superseded_by IS NULL
            `);
          }
          
          // canonical.latest_snapshot_id更新
          db.execute(`
            UPDATE subsidy_canonical 
            SET latest_snapshot_id = ${sqlValue(snapshotId)}, 
                last_updated_at = datetime('now')
            WHERE id = ${sqlValue(row.canonical_id)}
          `);
        }
        
        snapshotsCreated++;
        updateStats({ 
          inserted: stats.inserted + 1,
          last_processed_id: row.canonical_id
        });
        
        // 進捗表示
        if (processed % 50 === 0) {
          logger.progress(processed, totalCount, { lastId: row.canonical_id });
          saveCheckpoint();
        }
        
      } catch (error) {
        handleError(error, { canonical_id: row.canonical_id });
      }
      
      lastCanonicalId = row.canonical_id;
    }
    
    offset += batchSize;
  }
  
  // 最終統計
  updateStats({
    rows_scanned: processed,
    snapshots_created: snapshotsCreated,
    snapshots_skipped_no_change: snapshotsSkipped,
    canonical_missing: canonicalMissing
  });
  
  console.log('');
  logger.info('Snapshot generation completed', {
    rows_scanned: processed,
    snapshots_created: snapshotsCreated,
    snapshots_skipped_no_change: snapshotsSkipped,
    canonical_missing: canonicalMissing
  });
  
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

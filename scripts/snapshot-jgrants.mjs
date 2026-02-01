#!/usr/bin/env node
/**
 * snapshot-jgrants.mjs
 * 
 * subsidy_cache（canonical_id設定済み）から subsidy_snapshot を生成
 * 時点データを保存し、変更検知を行う
 * 
 * 使用方法:
 *   node scripts/snapshot-jgrants.mjs --local
 *   node scripts/snapshot-jgrants.mjs --local --dry-run
 *   node scripts/snapshot-jgrants.mjs --local --diff-only
 *   node scripts/snapshot-jgrants.mjs --local --force
 *   node scripts/snapshot-jgrants.mjs --local --canonical-id=jg-12345
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =============================================================================
// 設定
// =============================================================================

const CONFIG = {
  batchSize: 50,
  d1Database: 'subsidy-matching-production'
};

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
  
  // パターン: "2/3", "1/2", "50%", "補助率 2/3" など
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
  if (!areaText) return '[]';
  
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
  
  // 全国パターン
  if (areaText.includes('全国') || codes.length === 0) {
    return '["00"]';
  }
  
  return JSON.stringify(codes);
}

/**
 * 業種テキストからコード配列を生成
 */
function extractIndustryCodes(industryText) {
  if (!industryText) return '[]';
  // 簡易実装: テキストをそのまま配列に
  return JSON.stringify([industryText]);
}

/**
 * 募集回キーを抽出
 */
function extractRoundKey(detailJson) {
  if (!detailJson) return null;
  
  try {
    const detail = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson;
    const title = detail.title || '';
    
    // パターン: 第N回, 第N次, R6-N など
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
 * スナップショットのコンテンツハッシュを計算
 */
function calculateContentHash(cacheRow, detailJson) {
  const hashSource = JSON.stringify({
    acceptance_start: cacheRow.acceptance_start_datetime || '',
    acceptance_end: cacheRow.acceptance_end_datetime || '',
    max_limit: cacheRow.subsidy_max_limit || 0,
    rate: cacheRow.subsidy_rate || '',
    area: cacheRow.target_area_search || '',
    // detail_jsonの主要項目（長すぎる場合は切り詰め）
    overview: (detailJson?.overview || '').substring(0, 300),
    requirements: (detailJson?.application_requirements || '').substring(0, 300),
    expenses: (detailJson?.eligible_expenses || '').substring(0, 300)
  });
  
  return crypto.createHash('md5').update(hashSource).digest('hex');
}

/**
 * スナップショットIDを生成
 */
function generateSnapshotId(canonicalId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `snap-${timestamp}-${random}`;
}

// =============================================================================
// D1操作
// =============================================================================

/**
 * wrangler d1 execute でSQLを実行
 */
function executeD1(sql, isLocal) {
  const localFlag = isLocal ? '--local' : '';
  const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const cmd = `cd "${PROJECT_ROOT}" && npx wrangler d1 execute ${CONFIG.d1Database} ${localFlag} --command="${escapedSql}"`;
  
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * wrangler d1 execute でSELECTを実行してJSON取得
 */
function queryD1(sql, isLocal) {
  const localFlag = isLocal ? '--local' : '';
  const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const cmd = `cd "${PROJECT_ROOT}" && npx wrangler d1 execute ${CONFIG.d1Database} ${localFlag} --json --command="${escapedSql}"`;
  
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed) && parsed[0]?.results) {
      return { success: true, rows: parsed[0].results };
    }
    return { success: true, rows: [] };
  } catch (error) {
    return { success: false, error: error.message, rows: [] };
  }
}

// =============================================================================
// スナップショット処理
// =============================================================================

/**
 * 処理対象の件数を取得
 */
function getTargetCount(isLocal, diffOnly, canonicalIdFilter) {
  let where = 'WHERE canonical_id IS NOT NULL';
  if (canonicalIdFilter) {
    where += ` AND canonical_id = '${canonicalIdFilter}'`;
  }
  
  const result = queryD1(`SELECT COUNT(*) as count FROM subsidy_cache ${where}`, isLocal);
  
  if (result.success && result.rows.length > 0) {
    return result.rows[0].count;
  }
  return 0;
}

/**
 * バッチでsubsidy_cacheを取得
 */
function getCacheBatch(offset, limit, isLocal, canonicalIdFilter) {
  let where = 'WHERE canonical_id IS NOT NULL';
  if (canonicalIdFilter) {
    where += ` AND canonical_id = '${canonicalIdFilter}'`;
  }
  
  const sql = `
    SELECT id, canonical_id, source, title, subsidy_max_limit, subsidy_rate,
           target_area_search, target_industry, target_number_of_employees,
           acceptance_start_datetime, acceptance_end_datetime,
           request_reception_display_flag, detail_json, cached_at
    FROM subsidy_cache
    ${where}
    ORDER BY canonical_id
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  return queryD1(sql, isLocal);
}

/**
 * 既存スナップショットの最新ハッシュを取得
 */
function getLatestSnapshotHash(canonicalId, isLocal) {
  const sql = `
    SELECT content_hash FROM subsidy_snapshot
    WHERE canonical_id = '${canonicalId}' AND superseded_by IS NULL
    ORDER BY snapshot_at DESC LIMIT 1
  `;
  
  const result = queryD1(sql, isLocal);
  if (result.success && result.rows.length > 0) {
    return result.rows[0].content_hash;
  }
  return null;
}

/**
 * スナップショットを作成
 */
function createSnapshot(cacheRow, isLocal, dryRun, force) {
  let detailJson = null;
  try {
    detailJson = cacheRow.detail_json ? JSON.parse(cacheRow.detail_json) : null;
  } catch {}
  
  const contentHash = calculateContentHash(cacheRow, detailJson);
  
  // 差分チェック（forceでない場合）
  if (!force) {
    const existingHash = getLatestSnapshotHash(cacheRow.canonical_id, isLocal);
    if (existingHash === contentHash) {
      return { success: true, skipped: true, reason: 'no_change' };
    }
  }
  
  const snapshotId = generateSnapshotId(cacheRow.canonical_id);
  const roundKey = extractRoundKey(detailJson);
  const fiscalYear = detailJson?.fiscal_year || null;
  const isAccepting = isCurrentlyAccepting(
    cacheRow.acceptance_start_datetime,
    cacheRow.acceptance_end_datetime
  );
  const rateMax = parseRateMax(cacheRow.subsidy_rate);
  const areaCodes = extractAreaCodes(cacheRow.target_area_search);
  const industryCodes = extractIndustryCodes(cacheRow.target_industry);
  
  // 公式URL取得
  const officialUrl = detailJson?.related_url || detailJson?.official_url || detailJson?.detailUrl || '';
  const pdfUrls = JSON.stringify(detailJson?.pdfUrls || detailJson?.pdf_urls || []);
  const attachments = JSON.stringify(detailJson?.attachments || []);
  
  if (dryRun) {
    console.log(`[DRY-RUN] snapshot_id=${snapshotId}, canonical_id=${cacheRow.canonical_id}, hash=${contentHash}`);
    return { success: true, created: true, snapshotId };
  }
  
  // エスケープ
  const escape = (s) => (s || '').replace(/'/g, "''");
  
  // Step 1: 新snapshot INSERT
  const insertSql = `
    INSERT INTO subsidy_snapshot (
      id, canonical_id, source_link_id, round_key, fiscal_year,
      acceptance_start, acceptance_end, deadline_text, is_accepting,
      subsidy_max_limit, subsidy_min_limit, subsidy_rate, subsidy_rate_max,
      target_area_codes, target_area_text, target_industry_codes, target_employee_text,
      official_url, pdf_urls, attachments, detail_json,
      snapshot_at, content_hash, created_at
    ) VALUES (
      '${snapshotId}', '${cacheRow.canonical_id}', NULL, 
      ${roundKey ? `'${roundKey}'` : 'NULL'}, 
      ${fiscalYear ? `'${escape(fiscalYear)}'` : 'NULL'},
      ${cacheRow.acceptance_start_datetime ? `'${cacheRow.acceptance_start_datetime}'` : 'NULL'},
      ${cacheRow.acceptance_end_datetime ? `'${cacheRow.acceptance_end_datetime}'` : 'NULL'},
      ${detailJson?.deadline ? `'${escape(detailJson.deadline)}'` : 'NULL'},
      ${isAccepting},
      ${cacheRow.subsidy_max_limit || 'NULL'},
      ${detailJson?.subsidy_min_limit || 'NULL'},
      ${cacheRow.subsidy_rate ? `'${escape(cacheRow.subsidy_rate)}'` : 'NULL'},
      ${rateMax !== null ? rateMax : 'NULL'},
      '${areaCodes}',
      ${cacheRow.target_area_search ? `'${escape(cacheRow.target_area_search)}'` : 'NULL'},
      '${industryCodes}',
      ${cacheRow.target_number_of_employees ? `'${escape(cacheRow.target_number_of_employees)}'` : 'NULL'},
      ${officialUrl ? `'${escape(officialUrl)}'` : 'NULL'},
      '${escape(pdfUrls)}',
      '${escape(attachments)}',
      ${cacheRow.detail_json ? `'${escape(cacheRow.detail_json)}'` : 'NULL'},
      datetime('now'), '${contentHash}', datetime('now')
    )
  `.trim();
  
  const insertResult = executeD1(insertSql, isLocal);
  if (!insertResult.success) {
    return { success: false, error: `insert: ${insertResult.error}` };
  }
  
  // Step 2: 旧snapshotにsuperseded_by設定
  const supersedeSql = `
    UPDATE subsidy_snapshot 
    SET superseded_by = '${snapshotId}'
    WHERE canonical_id = '${cacheRow.canonical_id}' 
      AND id != '${snapshotId}' 
      AND superseded_by IS NULL
  `.trim();
  
  const supersedeResult = executeD1(supersedeSql, isLocal);
  // supersede失敗は警告のみ
  
  // Step 3: canonical.latest_snapshot_id更新
  const updateCanonicalSql = `
    UPDATE subsidy_canonical 
    SET latest_snapshot_id = '${snapshotId}', last_updated_at = datetime('now')
    WHERE id = '${cacheRow.canonical_id}'
  `.trim();
  
  const updateResult = executeD1(updateCanonicalSql, isLocal);
  if (!updateResult.success) {
    return { success: false, error: `update canonical: ${updateResult.error}` };
  }
  
  return { success: true, created: true, snapshotId };
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isProduction = args.includes('--production');
  const dryRun = args.includes('--dry-run');
  const diffOnly = args.includes('--diff-only');
  const force = args.includes('--force');
  const canonicalIdArg = args.find(a => a.startsWith('--canonical-id='));
  const canonicalIdFilter = canonicalIdArg ? canonicalIdArg.split('=')[1] : null;
  
  if (!isLocal && !isProduction) {
    console.error('Error: Specify --local or --production');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('snapshot-jgrants.mjs');
  console.log('='.repeat(60));
  console.log(`Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Diff Only: ${diffOnly}`);
  console.log(`Force: ${force}`);
  console.log(`Canonical Filter: ${canonicalIdFilter || 'none'}`);
  console.log('');
  
  const startTime = Date.now();
  
  // 対象件数取得
  const totalCount = getTargetCount(isLocal, diffOnly, canonicalIdFilter);
  console.log(`Total target rows: ${totalCount}`);
  
  if (totalCount === 0) {
    console.log('No rows to process. Exiting.');
    process.exit(0);
  }
  
  let processed = 0;
  let snapshotsCreated = 0;
  let snapshotsSkipped = 0;
  let superseded = 0;
  let errors = [];
  let offset = 0;
  
  // バッチ処理
  while (processed < totalCount) {
    const batchResult = getCacheBatch(offset, CONFIG.batchSize, isLocal, canonicalIdFilter);
    
    if (!batchResult.success || batchResult.rows.length === 0) {
      console.log(`\nBatch fetch failed or empty at offset ${offset}`);
      break;
    }
    
    for (const row of batchResult.rows) {
      const result = createSnapshot(row, isLocal, dryRun, force);
      processed++;
      
      if (result.success) {
        if (result.skipped) {
          snapshotsSkipped++;
        } else if (result.created) {
          snapshotsCreated++;
        }
      } else {
        errors.push({ canonical_id: row.canonical_id, error: result.error });
      }
      
      // 進捗表示
      if (processed % 10 === 0) {
        process.stdout.write(`\rProgress: ${processed}/${totalCount} (created: ${snapshotsCreated}, skipped: ${snapshotsSkipped})`);
      }
    }
    
    offset += CONFIG.batchSize;
    
    // バッチ間で少し待機
    if (!dryRun) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const duration = Date.now() - startTime;
  
  // 結果サマリー
  console.log('\n\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total Processed:      ${processed}`);
  console.log(`Snapshots Created:    ${snapshotsCreated}`);
  console.log(`Snapshots Skipped:    ${snapshotsSkipped}`);
  console.log(`Errors:               ${errors.length}`);
  console.log(`Duration:             ${(duration / 1000).toFixed(1)}s`);
  
  if (errors.length > 0) {
    console.log('\nErrors (first 10):');
    errors.slice(0, 10).forEach(e => {
      console.log(`  - canonical_id=${e.canonical_id}: ${e.error?.substring(0, 80) || 'unknown'}`);
    });
  }
  
  // 結果JSON出力
  const result = {
    totalProcessed: processed,
    snapshotsCreated,
    snapshotsSkipped,
    errors: errors.length,
    errorDetails: errors.slice(0, 20),
    duration,
    timestamp: new Date().toISOString(),
    mode: isLocal ? 'local' : 'production',
    dryRun,
    diffOnly,
    force
  };
  
  console.log('\nResult JSON:');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

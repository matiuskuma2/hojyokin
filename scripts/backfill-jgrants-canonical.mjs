#!/usr/bin/env node
/**
 * backfill-jgrants-canonical.mjs
 * 
 * 既存の subsidy_cache（jGrantsデータ）を subsidy_canonical および
 * subsidy_source_link へ安全に移行
 * 
 * 使用方法:
 *   node scripts/backfill-jgrants-canonical.mjs --local
 *   node scripts/backfill-jgrants-canonical.mjs --local --dry-run
 *   node scripts/backfill-jgrants-canonical.mjs --production --confirm
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
// 機関コードマッピング
// =============================================================================

const AGENCY_CODE_MAP = {
  '経済産業省': 'meti',
  '中小企業庁': 'smea',
  '厚生労働省': 'mhlw',
  '農林水産省': 'maff',
  '環境省': 'env',
  '総務省': 'mic',
  '国土交通省': 'mlit',
  'デジタル庁': 'digital',
  '文部科学省': 'mext',
  '内閣府': 'cao',
  '東京都': 'tokyo',
  '東京都産業労働局': 'tokyo-sanro',
  '公益財団法人東京都中小企業振興公社': 'tokyo-kosha',
  '東京しごと財団': 'tokyo-shigoto',
  '大阪府': 'osaka',
  '大阪産業局': 'osaka-obda',
  '神奈川県': 'kanagawa',
  '埼玉県': 'saitama',
  '千葉県': 'chiba',
  '愛知県': 'aichi',
  '福岡県': 'fukuoka',
  '北海道': 'hokkaido',
  '中小機構': 'smrj',
  'NEDO': 'nedo',
  'JETRO': 'jetro',
  'IPA': 'ipa',
  'JICA': 'jica'
};

// =============================================================================
// canonical_id 生成
// =============================================================================

/**
 * タイトルを正規化
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[（）\(\)\[\]【】「」『』]/g, '')  // 括弧除去
    .replace(/[　\s\t\n]+/g, '')                  // 空白除去
    .replace(/令和\d+年度?/g, '')                 // 年度除去
    .replace(/平成\d+年度?/g, '')
    .replace(/第\d+[次回期募集]/g, '')            // 回次除去
    .replace(/[・]/g, '');                        // 中黒除去
}

/**
 * detail_jsonからissuer_codeを抽出
 */
function extractIssuerCode(detailJson) {
  if (!detailJson) return null;
  
  try {
    const detail = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson;
    const agency = detail.implementing_agency || detail.issuer || detail.contact?.organization;
    
    if (!agency) return null;
    
    // 完全一致チェック
    if (AGENCY_CODE_MAP[agency]) {
      return AGENCY_CODE_MAP[agency];
    }
    
    // 部分一致チェック
    for (const [name, code] of Object.entries(AGENCY_CODE_MAP)) {
      if (agency.includes(name)) return code;
    }
    
    // マッチしない場合はハッシュ
    return 'org-' + crypto.createHash('md5')
      .update(agency)
      .digest('hex')
      .substring(0, 6);
  } catch {
    return null;
  }
}

/**
 * detail_jsonからissuer_nameを抽出
 */
function extractIssuerName(detailJson) {
  if (!detailJson) return null;
  
  try {
    const detail = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson;
    return detail.implementing_agency || detail.issuer || detail.contact?.organization || null;
  } catch {
    return null;
  }
}

/**
 * target_area_searchから都道府県コードを抽出
 */
function extractPrefectureCode(targetArea) {
  if (!targetArea) return '00'; // 全国
  
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
  
  for (const [pref, code] of Object.entries(prefMap)) {
    if (targetArea.includes(pref)) return code;
  }
  
  // 全国パターン
  if (targetArea.includes('全国') || targetArea.includes('日本全国')) {
    return '00';
  }
  
  return '00';
}

/**
 * canonical_idを生成
 * @param {object} cacheRow - subsidy_cacheの行
 * @returns {string} - canonical_id
 */
function generateCanonicalId(cacheRow) {
  // jGrantsの場合、IDをそのまま利用
  if (cacheRow.source === 'jgrants' && cacheRow.id) {
    return `jg-${cacheRow.id}`;
  }
  
  // その他ソースの場合
  const normalizedTitle = normalizeTitle(cacheRow.title);
  const titleHash = crypto.createHash('md5')
    .update(normalizedTitle)
    .digest('hex')
    .substring(0, 8);
  
  const issuerCode = extractIssuerCode(cacheRow.detail_json) || 'unknown';
  return `${issuerCode}-${titleHash}`;
}

// =============================================================================
// D1操作
// =============================================================================

/**
 * wrangler d1 execute でSQLを実行
 */
function executeD1(sql, isLocal) {
  const localFlag = isLocal ? '--local' : '';
  const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ');
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
  const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cmd = `cd "${PROJECT_ROOT}" && npx wrangler d1 execute ${CONFIG.d1Database} ${localFlag} --json --command="${escapedSql}"`;
  
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    // JSONパース
    const parsed = JSON.parse(result);
    // wrangler d1 execute --json の出力形式: [{ results: [...], success: true, ... }]
    if (Array.isArray(parsed) && parsed[0]?.results) {
      return { success: true, rows: parsed[0].results };
    }
    return { success: true, rows: [] };
  } catch (error) {
    return { success: false, error: error.message, rows: [] };
  }
}

// =============================================================================
// バックフィル処理
// =============================================================================

/**
 * subsidy_cacheの件数を取得
 */
function getCacheCount(isLocal, excludeProcessed) {
  const where = excludeProcessed ? 'WHERE canonical_id IS NULL' : '';
  const result = queryD1(`SELECT COUNT(*) as count FROM subsidy_cache ${where}`, isLocal);
  
  if (result.success && result.rows.length > 0) {
    return result.rows[0].count;
  }
  return 0;
}

/**
 * バッチでsubsidy_cacheを取得
 */
function getCacheBatch(offset, limit, isLocal) {
  const sql = `
    SELECT id, source, title, subsidy_max_limit, subsidy_rate,
           target_area_search, target_industry, target_number_of_employees,
           acceptance_start_datetime, acceptance_end_datetime,
           request_reception_display_flag, detail_json, cached_at
    FROM subsidy_cache
    WHERE canonical_id IS NULL
    ORDER BY id
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  return queryD1(sql, isLocal);
}

/**
 * canonical/link/cache更新を実行
 */
function processRow(row, isLocal, dryRun) {
  const canonicalId = generateCanonicalId(row);
  const issuerCode = extractIssuerCode(row.detail_json);
  const issuerName = extractIssuerName(row.detail_json);
  const prefCode = extractPrefectureCode(row.target_area_search);
  const normalizedTitle = normalizeTitle(row.title);
  const linkId = `link-jg-${row.id}`;
  
  // エスケープ
  const escapedTitle = (row.title || '').replace(/'/g, "''");
  const escapedNormTitle = (normalizedTitle || '').replace(/'/g, "''");
  const escapedIssuerName = (issuerName || '').replace(/'/g, "''");
  
  if (dryRun) {
    console.log(`[DRY-RUN] canonical_id=${canonicalId}, cache_id=${row.id}, title=${escapedTitle.substring(0, 30)}...`);
    return { success: true, canonicalCreated: true, linkCreated: true };
  }
  
  // Step 1: canonical UPSERT
  const canonicalSql = `
    INSERT INTO subsidy_canonical (
      id, name, name_normalized, issuer_code, issuer_name, prefecture_code,
      latest_cache_id, first_seen_at, is_active, created_at, updated_at
    ) VALUES (
      '${canonicalId}', '${escapedTitle}', '${escapedNormTitle}', 
      ${issuerCode ? `'${issuerCode}'` : 'NULL'}, 
      ${issuerName ? `'${escapedIssuerName}'` : 'NULL'}, 
      '${prefCode}',
      '${row.id}', datetime('now'), 1, datetime('now'), datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      issuer_name = excluded.issuer_name,
      latest_cache_id = excluded.latest_cache_id,
      last_updated_at = datetime('now'),
      updated_at = datetime('now')
  `.trim();
  
  const canonicalResult = executeD1(canonicalSql, isLocal);
  if (!canonicalResult.success) {
    return { success: false, error: `canonical: ${canonicalResult.error}` };
  }
  
  // Step 2: source_link INSERT
  const linkSql = `
    INSERT INTO subsidy_source_link (
      id, canonical_id, source_type, source_id, match_type, match_score, verified, created_at
    ) VALUES (
      '${linkId}', '${canonicalId}', 'jgrants', '${row.id}', 'system', 1.0, 1, datetime('now')
    )
    ON CONFLICT(source_type, source_id) DO NOTHING
  `.trim();
  
  const linkResult = executeD1(linkSql, isLocal);
  if (!linkResult.success) {
    return { success: false, error: `link: ${linkResult.error}` };
  }
  
  // Step 3: subsidy_cache.canonical_id更新
  const updateSql = `
    UPDATE subsidy_cache SET canonical_id = '${canonicalId}' WHERE id = '${row.id}'
  `.trim();
  
  const updateResult = executeD1(updateSql, isLocal);
  if (!updateResult.success) {
    return { success: false, error: `update: ${updateResult.error}` };
  }
  
  return { success: true, canonicalCreated: true, linkCreated: true };
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isProduction = args.includes('--production');
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');
  const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : CONFIG.batchSize;
  
  if (!isLocal && !isProduction) {
    console.error('Error: Specify --local or --production');
    process.exit(1);
  }
  
  if (isProduction && !confirm && !dryRun) {
    console.error('Error: Production mode requires --confirm flag');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('backfill-jgrants-canonical.mjs');
  console.log('='.repeat(60));
  console.log(`Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log('');
  
  const startTime = Date.now();
  
  // 対象件数取得
  const totalCount = getCacheCount(isLocal, true);
  console.log(`Total unprocessed rows: ${totalCount}`);
  
  if (totalCount === 0) {
    console.log('No rows to process. Exiting.');
    process.exit(0);
  }
  
  let processed = 0;
  let canonicalCreated = 0;
  let linksCreated = 0;
  let errors = [];
  let offset = 0;
  
  // バッチ処理
  while (processed < totalCount) {
    const batchResult = getCacheBatch(offset, batchSize, isLocal);
    
    if (!batchResult.success || batchResult.rows.length === 0) {
      console.log(`\nBatch fetch failed or empty at offset ${offset}`);
      break;
    }
    
    for (const row of batchResult.rows) {
      const result = processRow(row, isLocal, dryRun);
      processed++;
      
      if (result.success) {
        if (result.canonicalCreated) canonicalCreated++;
        if (result.linkCreated) linksCreated++;
      } else {
        errors.push({ cache_id: row.id, error: result.error });
      }
      
      // 進捗表示
      if (processed % 10 === 0) {
        process.stdout.write(`\rProgress: ${processed}/${totalCount} (${((processed / totalCount) * 100).toFixed(1)}%)`);
      }
    }
    
    offset += batchSize;
    
    // バッチ間で少し待機（APIリミット回避）
    if (!dryRun) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const duration = Date.now() - startTime;
  
  // 結果サマリー
  console.log('\n\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total Processed:    ${processed}`);
  console.log(`Canonical Created:  ${canonicalCreated}`);
  console.log(`Links Created:      ${linksCreated}`);
  console.log(`Errors:             ${errors.length}`);
  console.log(`Duration:           ${(duration / 1000).toFixed(1)}s`);
  
  if (errors.length > 0) {
    console.log('\nErrors (first 10):');
    errors.slice(0, 10).forEach(e => {
      console.log(`  - cache_id=${e.cache_id}: ${e.error?.substring(0, 80) || 'unknown'}`);
    });
  }
  
  // 結果JSON出力
  const result = {
    totalProcessed: processed,
    canonicalCreated,
    linksCreated,
    errors: errors.length,
    errorDetails: errors.slice(0, 20),
    duration,
    timestamp: new Date().toISOString(),
    mode: isLocal ? 'local' : 'production',
    dryRun
  };
  
  console.log('\nResult JSON:');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

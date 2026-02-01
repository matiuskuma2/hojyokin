#!/usr/bin/env node
/**
 * import-izumi.mjs
 * 
 * izumi詳細CSV（約18,655件）をD1の izumi_subsidies テーブルに投入
 * 
 * 使用方法:
 *   node scripts/import-izumi.mjs --local
 *   node scripts/import-izumi.mjs --local --dry-run
 *   node scripts/import-izumi.mjs --local --file=data/izumi/details/izumi_detail_200.csv
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
  csvDir: path.join(PROJECT_ROOT, 'data/izumi/details'),
  csvPattern: /^izumi_detail_.*\.csv$/,
  batchSize: 50,
  d1Database: 'subsidy-matching-production'
};

// =============================================================================
// 金額パース
// =============================================================================

/**
 * 金額テキストを数値に変換
 * @param {string} text - 元のテキスト（例: "30万円", "1億円", "5000円/回"）
 * @returns {number|null} - パース後の数値（円）
 */
function parseMaxAmount(text) {
  if (!text || text === '') return null;
  
  // 特殊パターン除外
  if (text.includes('要相談') || text.includes('なし') || text.includes('N/A')) {
    return null;
  }
  
  // 単位変換マップ（大きい単位から順に）
  const unitMap = [
    ['億', 100000000],
    ['千万', 10000000],
    ['百万', 1000000],
    ['万', 10000],
    ['千', 1000]
  ];
  
  // カンマ除去、全角→半角
  let value = text
    .replace(/[,，]/g, '')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  
  // 単位付き数値を検出
  for (const [unit, multiplier] of unitMap) {
    const regex = new RegExp(`([0-9.]+)\\s*${unit}`);
    const match = value.match(regex);
    if (match) {
      return Math.round(parseFloat(match[1]) * multiplier);
    }
  }
  
  // 単位なしの数値（円）
  const numMatch = value.match(/([0-9,]+)\s*円/);
  if (numMatch) {
    return parseInt(numMatch[1].replace(/,/g, ''), 10);
  }
  
  // 純粋な数値のみ
  const pureNum = value.match(/^([0-9,]+)$/);
  if (pureNum) {
    return parseInt(pureNum[1].replace(/,/g, ''), 10);
  }
  
  return null;
}

// =============================================================================
// 難易度変換
// =============================================================================

/**
 * 難易度テキストを数値に変換
 * @param {string} text - 元のテキスト（例: "★☆☆☆☆"）
 * @returns {number} - 1-5 の数値
 */
function parseDifficulty(text) {
  if (!text) return 1;
  const stars = (text.match(/★/g) || []).length;
  return Math.max(1, Math.min(5, stars || 1));
}

// =============================================================================
// 都道府県推定
// =============================================================================

// 市区町村→都道府県マッピング（主要なもの）
const CITY_TO_PREF = {
  // 北海道
  'sapporo': '01', 'hakodate': '01', 'asahikawa': '01', 'obihiro': '01',
  // 東北
  'aomori': '02', 'hirosaki': '02',
  'morioka': '03', 'sendai': '04', 'akita': '05', 'yamagata': '06',
  'fukushima': '07', 'koriyama': '07', 'sukagawa': '07',
  // 関東
  'mito': '08', 'ibaraki': '08', 'daigo': '08',
  'utsunomiya': '09', 'maebashi': '10', 'takasaki': '10', 'kiryu': '10', 'fujioka': '10',
  'saitama': '11', 'kawaguchi': '11',
  'chiba': '12', 'narita': '12', 'minamiboso': '12',
  'adachi': '13', 'shibuya': '13', 'shinjuku': '13', 'chuo': '13', 'koto': '13', 'fuchu': '13',
  'tokyo': '13', 'minato': '13', 'ota': '13', 'setagaya': '13', 'meguro': '13', 'nakano': '13',
  'yokohama': '14', 'kawasaki': '14', 'sagamihara': '14',
  // 中部
  'niigata': '15', 'toyama': '16', 'kanazawa': '17', 'kahoku': '17',
  'fukui': '18', 'kofu': '19', 'nagano': '20', 'suzaka': '20',
  'gifu': '21', 'shizuoka': '22', 'hamamatsu': '22',
  'nagoya': '23', 'aichi': '23', 'hekinan': '23', 'seto': '23', 'komaki': '23',
  // 近畿
  'tsu': '24', 'shiga': '25', 'kyoto': '26',
  'osaka': '27', 'ibaraki': '27',  // 大阪の茨木市
  'kobe': '28', 'miki': '28', 'hyogo': '28',
  'nara': '29', 'wakayama': '30',
  // 中国
  'tottori': '31', 'matsue': '32', 'okayama': '33', 'hiroshima': '34', 'fuchu': '34',
  'yamaguchi': '35',
  // 四国
  'tokushima': '36', 'takamatsu': '37', 'matsuyama': '38', 'kochi': '39',
  // 九州
  'fukuoka': '40', 'kitakyushu': '40',
  'saga': '41', 'nagasaki': '42', 'kumamoto': '43', 'oita': '44',
  'miyazaki': '45', 'kagoshima': '46', 'naha': '47', 'okinawa': '47'
};

// ドメインの都道府県マッピング
const PREF_DOMAIN_MAP = {
  'hokkaido': '01', 'aomori': '02', 'iwate': '03', 'miyagi': '04',
  'akita': '05', 'yamagata': '06', 'fukushima': '07', 'ibaraki': '08',
  'tochigi': '09', 'gunma': '10', 'saitama': '11', 'chiba': '12',
  'tokyo': '13', 'kanagawa': '14', 'niigata': '15', 'toyama': '16',
  'ishikawa': '17', 'fukui': '18', 'yamanashi': '19', 'nagano': '20',
  'gifu': '21', 'shizuoka': '22', 'aichi': '23', 'mie': '24',
  'shiga': '25', 'kyoto': '26', 'osaka': '27', 'hyogo': '28',
  'nara': '29', 'wakayama': '30', 'tottori': '31', 'shimane': '32',
  'okayama': '33', 'hiroshima': '34', 'yamaguchi': '35', 'tokushima': '36',
  'kagawa': '37', 'ehime': '38', 'kochi': '39', 'fukuoka': '40',
  'saga': '41', 'nagasaki': '42', 'kumamoto': '43', 'oita': '44',
  'miyazaki': '45', 'kagoshima': '46', 'okinawa': '47'
};

/**
 * URLまたはissuerから都道府県コードを推定
 * @param {string} url - support_url
 * @param {string} issuer - 実施機関名
 * @returns {string|null} - 都道府県コード（01-47）
 */
function extractPrefectureCode(url, issuer) {
  if (!url) return null;
  
  try {
    // URLドメインから市区町村を抽出
    const cityMatch = url.match(/\.city\.([a-z]+)\./);
    if (cityMatch && CITY_TO_PREF[cityMatch[1]]) {
      return CITY_TO_PREF[cityMatch[1]];
    }
    
    // town.xxx パターン
    const townMatch = url.match(/\.town\.([a-z]+)\./);
    if (townMatch && CITY_TO_PREF[townMatch[1]]) {
      return CITY_TO_PREF[townMatch[1]];
    }
    
    // pref.xxx パターン
    const prefMatch = url.match(/\.pref\.([a-z]+)\./);
    if (prefMatch && PREF_DOMAIN_MAP[prefMatch[1]]) {
      return PREF_DOMAIN_MAP[prefMatch[1]];
    }
    
    // metro.tokyo パターン
    if (url.includes('metro.tokyo') || url.includes('tokyo.lg.jp')) {
      return '13';
    }
    
    // 大阪の茨木市 (ibaraki.osaka)
    if (url.includes('.ibaraki.osaka.jp')) {
      return '27';
    }
    
    // 広島の府中市
    if (url.includes('.fuchu.hiroshima.jp')) {
      return '34';
    }
    
    // 東京の府中市
    if (url.includes('.fuchu.tokyo.jp')) {
      return '13';
    }
  } catch {
    // URLパースエラーは無視
  }
  
  return null;
}

// =============================================================================
// ハッシュ生成
// =============================================================================

/**
 * 行データのハッシュを生成（変更検知用）
 * @param {object} row - CSV行データ
 * @returns {string} - MD5ハッシュ
 */
function generateRowHash(row) {
  const hashSource = [
    row.policy_id,
    row.title,
    row.issuer || '',
    row.max_amount || '',
    row.support_url || ''
  ].join('|');
  
  return crypto.createHash('md5').update(hashSource).digest('hex');
}

// =============================================================================
// CSVパース
// =============================================================================

/**
 * CSVファイルをパース
 * @param {string} filePath - CSVファイルパス
 * @returns {object[]} - パース済み行データの配列
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (lines.length < 2) return [];
  
  // ヘッダー行をパース
  const headers = parseCSVLine(lines[0]);
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row = {};
    
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    // 必須項目チェック
    if (!row.policy_id || !row.title) {
      continue;
    }
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * CSV行をパース（ダブルクォート対応）
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

// =============================================================================
// D1操作
// =============================================================================

/**
 * wrangler d1 execute でSQLを実行
 */
function executeD1(sql, isLocal) {
  const localFlag = isLocal ? '--local' : '';
  const cmd = `cd "${PROJECT_ROOT}" && npx wrangler d1 execute ${CONFIG.d1Database} ${localFlag} --command="${sql.replace(/"/g, '\\"')}"`;
  
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * バッチUPSERT実行
 */
function executeBatchUpsert(rows, isLocal, dryRun) {
  if (rows.length === 0) return { inserted: 0, errors: [] };
  
  const errors = [];
  let inserted = 0;
  
  for (const row of rows) {
    const id = `izumi-${row.policy_id}`;
    const policyId = parseInt(row.policy_id, 10);
    const title = row.title.replace(/'/g, "''");
    const issuer = (row.issuer || '').replace(/'/g, "''");
    const area = (row.area || '').replace(/'/g, "''");
    const prefCode = extractPrefectureCode(row.support_url, row.issuer);
    const publishDate = row.publish_date || null;
    const period = (row.period || '').replace(/'/g, "''");
    const maxAmountText = (row.max_amount || '').replace(/'/g, "''");
    const maxAmountValue = parseMaxAmount(row.max_amount);
    const difficulty = row.difficulty || '';
    const difficultyLevel = parseDifficulty(row.difficulty);
    const startFee = (row.start_fee || '').replace(/'/g, "''");
    const successFee = (row.success_fee || '').replace(/'/g, "''");
    const supportUrl = (row.support_url || '').replace(/'/g, "''");
    const supportUrlsAll = (row.support_urls_all || '').replace(/'/g, "''");
    
    const sql = `
      INSERT INTO izumi_subsidies (
        id, policy_id, detail_url, title, issuer, area, prefecture_code,
        publish_date, period, max_amount_text, max_amount_value,
        difficulty, difficulty_level, start_fee, success_fee,
        support_url, support_urls_all, imported_at, updated_at
      ) VALUES (
        '${id}', ${policyId}, '${row.detail_url}', '${title}', '${issuer}', '${area}', ${prefCode ? `'${prefCode}'` : 'NULL'},
        ${publishDate ? `'${publishDate}'` : 'NULL'}, '${period}', '${maxAmountText}', ${maxAmountValue !== null ? maxAmountValue : 'NULL'},
        '${difficulty}', ${difficultyLevel}, '${startFee}', '${successFee}',
        '${supportUrl}', '${supportUrlsAll}', datetime('now'), datetime('now')
      )
      ON CONFLICT(policy_id) DO UPDATE SET
        detail_url = excluded.detail_url,
        title = excluded.title,
        issuer = excluded.issuer,
        area = excluded.area,
        prefecture_code = excluded.prefecture_code,
        publish_date = excluded.publish_date,
        period = excluded.period,
        max_amount_text = excluded.max_amount_text,
        max_amount_value = excluded.max_amount_value,
        difficulty = excluded.difficulty,
        difficulty_level = excluded.difficulty_level,
        start_fee = excluded.start_fee,
        success_fee = excluded.success_fee,
        support_url = excluded.support_url,
        support_urls_all = excluded.support_urls_all,
        updated_at = datetime('now')
    `.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    
    if (dryRun) {
      console.log(`[DRY-RUN] Would execute: policy_id=${policyId}, title=${title.substring(0, 30)}...`);
      inserted++;
      continue;
    }
    
    const result = executeD1(sql, isLocal);
    if (result.success) {
      inserted++;
    } else {
      errors.push({ policy_id: policyId, error: result.error });
      console.error(`[ERROR] policy_id=${policyId}: ${result.error}`);
    }
  }
  
  return { inserted, errors };
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isProduction = args.includes('--production');
  const dryRun = args.includes('--dry-run');
  const specificFile = args.find(a => a.startsWith('--file='))?.split('=')[1];
  
  if (!isLocal && !isProduction) {
    console.error('Error: Specify --local or --production');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('import-izumi.mjs');
  console.log('='.repeat(60));
  console.log(`Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`CSV Directory: ${CONFIG.csvDir}`);
  console.log('');
  
  const startTime = Date.now();
  
  // CSVファイル列挙
  let csvFiles;
  if (specificFile) {
    csvFiles = [path.resolve(PROJECT_ROOT, specificFile)];
  } else {
    if (!fs.existsSync(CONFIG.csvDir)) {
      console.error(`Error: CSV directory not found: ${CONFIG.csvDir}`);
      process.exit(1);
    }
    csvFiles = fs.readdirSync(CONFIG.csvDir)
      .filter(f => CONFIG.csvPattern.test(f))
      .map(f => path.join(CONFIG.csvDir, f))
      .sort();
  }
  
  console.log(`Found ${csvFiles.length} CSV files`);
  
  let totalRows = 0;
  let totalInserted = 0;
  let totalErrors = [];
  
  // ファイルごとに処理
  for (let i = 0; i < csvFiles.length; i++) {
    const filePath = csvFiles[i];
    const fileName = path.basename(filePath);
    
    console.log(`\n[${i + 1}/${csvFiles.length}] Processing: ${fileName}`);
    
    // CSVパース
    const rows = parseCSV(filePath);
    console.log(`  Parsed ${rows.length} rows`);
    
    if (rows.length === 0) continue;
    
    totalRows += rows.length;
    
    // バッチ処理
    for (let j = 0; j < rows.length; j += CONFIG.batchSize) {
      const batch = rows.slice(j, j + CONFIG.batchSize);
      const { inserted, errors } = executeBatchUpsert(batch, isLocal, dryRun);
      totalInserted += inserted;
      totalErrors.push(...errors);
      
      process.stdout.write(`\r  Progress: ${Math.min(j + CONFIG.batchSize, rows.length)}/${rows.length}`);
    }
    
    console.log(''); // 改行
  }
  
  const duration = Date.now() - startTime;
  
  // 結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total Files:    ${csvFiles.length}`);
  console.log(`Total Rows:     ${totalRows}`);
  console.log(`Inserted:       ${totalInserted}`);
  console.log(`Errors:         ${totalErrors.length}`);
  console.log(`Duration:       ${(duration / 1000).toFixed(1)}s`);
  
  if (totalErrors.length > 0) {
    console.log('\nErrors:');
    totalErrors.slice(0, 10).forEach(e => {
      console.log(`  - policy_id=${e.policy_id}: ${e.error.substring(0, 100)}`);
    });
    if (totalErrors.length > 10) {
      console.log(`  ... and ${totalErrors.length - 10} more`);
    }
  }
  
  // 結果JSON出力
  const result = {
    totalFiles: csvFiles.length,
    totalRows,
    inserted: totalInserted,
    errors: totalErrors.length,
    errorDetails: totalErrors.slice(0, 20),
    duration,
    timestamp: new Date().toISOString(),
    mode: isLocal ? 'local' : 'production',
    dryRun
  };
  
  console.log('\nResult JSON:');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(totalErrors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

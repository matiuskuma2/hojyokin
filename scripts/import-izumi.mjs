#!/usr/bin/env node
/**
 * import-izumi.mjs
 * 
 * izumi詳細CSV（約18,7xx行）を raw保全しつつ izumi_subsidies へUPSERT
 * 
 * 使用方法:
 *   node scripts/import-izumi.mjs --local
 *   node scripts/import-izumi.mjs --local --dry-run
 *   node scripts/import-izumi.mjs --local --limit=100
 *   node scripts/import-izumi.mjs --local --resume
 *   node scripts/import-izumi.mjs --local --fail-fast
 *   node scripts/import-izumi.mjs --local --file=data/izumi/details/izumi_detail_200.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  ScriptRunner, 
  sha256, 
  escapeSQL, 
  sqlValue, 
  normalizeWhitespace, 
  normalizeUrl 
} from './lib/script-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =============================================================================
// 設定
// =============================================================================

const CSV_DIR = path.join(PROJECT_ROOT, 'data/izumi/details');
const CSV_PATTERN = /^izumi_detail_.*\.csv$/;

// =============================================================================
// 金額パース
// =============================================================================

/**
 * 金額テキストを数値に変換
 * 事故防止：単位/期間/人数が混ざる場合はNULL
 * 
 * @param {string} text - 元のテキスト（例: "30万円", "1億円", "5000円/回"）
 * @returns {{value: number|null, parsed: boolean}} - パース結果
 */
function parseMaxAmount(text) {
  if (!text || text === '') return { value: null, parsed: false };
  
  // 推測で整数化しないパターン（単位/期間/人数混在）
  const ambiguousPatterns = [
    /\/[人月年回件日時]/,   // 5000円/回、3万円/人
    /1人あたり/,
    /上限なし/,
    /要相談/,
    /なし/,
    /N\/A/i,
    /未定/,
    /要確認/
  ];
  
  for (const pattern of ambiguousPatterns) {
    if (pattern.test(text)) {
      return { value: null, parsed: false };
    }
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
  let normalized = text
    .replace(/[,，]/g, '')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  
  // 単位付き数値を検出
  for (const [unit, multiplier] of unitMap) {
    const regex = new RegExp(`([0-9.]+)\\s*${unit}`);
    const match = normalized.match(regex);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) {
        return { value: Math.round(num * multiplier), parsed: true };
      }
    }
  }
  
  // 単位なしの数値（円）
  const numMatch = normalized.match(/([0-9,]+)\s*円/);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(num)) {
      return { value: num, parsed: true };
    }
  }
  
  // 純粋な数値のみ
  const pureNum = normalized.match(/^([0-9,]+)$/);
  if (pureNum) {
    const num = parseInt(pureNum[1].replace(/,/g, ''), 10);
    if (!isNaN(num)) {
      return { value: num, parsed: true };
    }
  }
  
  return { value: null, parsed: false };
}

// =============================================================================
// 難易度変換
// =============================================================================

function parseDifficulty(text) {
  if (!text) return 1;
  const stars = (text.match(/★/g) || []).length;
  return Math.max(1, Math.min(5, stars || 1));
}

// =============================================================================
// 都道府県推定
// =============================================================================

// 市区町村→都道府県マッピング
const CITY_TO_PREF = {
  'sapporo': '01', 'hakodate': '01', 'asahikawa': '01',
  'aomori': '02', 'hirosaki': '02',
  'morioka': '03', 'sendai': '04', 'akita': '05', 'yamagata': '06',
  'fukushima': '07', 'koriyama': '07', 'sukagawa': '07',
  'mito': '08', 'ibaraki': '08', 'daigo': '08',
  'utsunomiya': '09', 'maebashi': '10', 'takasaki': '10', 'kiryu': '10', 'fujioka': '10',
  'saitama': '11', 'kawaguchi': '11',
  'chiba': '12', 'narita': '12', 'minamiboso': '12',
  'adachi': '13', 'shibuya': '13', 'shinjuku': '13', 'chuo': '13', 'koto': '13', 
  'fuchu': '13', 'tokyo': '13', 'minato': '13', 'ota': '13', 'setagaya': '13',
  'yokohama': '14', 'kawasaki': '14',
  'niigata': '15', 'toyama': '16', 'kanazawa': '17', 'kahoku': '17',
  'fukui': '18', 'kofu': '19', 'nagano': '20', 'suzaka': '20',
  'gifu': '21', 'shizuoka': '22', 'hamamatsu': '22',
  'nagoya': '23', 'aichi': '23', 'hekinan': '23', 'seto': '23', 'komaki': '23',
  'tsu': '24', 'shiga': '25', 'kyoto': '26',
  'osaka': '27',
  'kobe': '28', 'miki': '28', 'hyogo': '28',
  'nara': '29', 'wakayama': '30',
  'tottori': '31', 'matsue': '32', 'okayama': '33', 'hiroshima': '34',
  'yamaguchi': '35',
  'tokushima': '36', 'takamatsu': '37', 'matsuyama': '38', 'kochi': '39',
  'fukuoka': '40', 'kitakyushu': '40',
  'saga': '41', 'nagasaki': '42', 'kumamoto': '43', 'oita': '44',
  'miyazaki': '45', 'kagoshima': '46', 'naha': '47', 'okinawa': '47'
};

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

function extractPrefectureCode(url) {
  if (!url) return null;
  
  try {
    const cityMatch = url.match(/\.city\.([a-z]+)\./);
    if (cityMatch && CITY_TO_PREF[cityMatch[1]]) {
      return CITY_TO_PREF[cityMatch[1]];
    }
    
    const townMatch = url.match(/\.town\.([a-z]+)\./);
    if (townMatch && CITY_TO_PREF[townMatch[1]]) {
      return CITY_TO_PREF[townMatch[1]];
    }
    
    const prefMatch = url.match(/\.pref\.([a-z]+)\./);
    if (prefMatch && PREF_DOMAIN_MAP[prefMatch[1]]) {
      return PREF_DOMAIN_MAP[prefMatch[1]];
    }
    
    if (url.includes('metro.tokyo') || url.includes('tokyo.lg.jp')) return '13';
    if (url.includes('.ibaraki.osaka.jp')) return '27';  // 大阪の茨木市
    if (url.includes('.fuchu.hiroshima.jp')) return '34';
    if (url.includes('.fuchu.tokyo.jp')) return '13';
  } catch {}
  
  return null;
}

// =============================================================================
// row_hash生成
// =============================================================================

/**
 * 正規化済みフィールドからSHA256ハッシュを生成
 */
function generateRowHash(row) {
  const normalized = [
    row.policy_id,
    normalizeWhitespace(row.title),
    normalizeWhitespace(row.issuer || ''),
    normalizeWhitespace(row.area || ''),
    normalizeWhitespace(row.max_amount || ''),
    normalizeUrl(row.support_url || '')
  ].join('|');
  
  return sha256(normalized);
}

// =============================================================================
// CSVパース
// =============================================================================

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (lines.length < 2) return [];
  
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
    
    if (!row.policy_id || !row.title) continue;
    
    rows.push(row);
  }
  
  return rows;
}

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
// メイン処理
// =============================================================================

const runner = new ScriptRunner('import-izumi', process.argv.slice(2));

runner.run(async (ctx) => {
  const { args, logger, db, stats, resumeState, updateStats, saveCheckpoint, handleError } = ctx;
  
  // CSVファイル列挙
  let csvFiles;
  if (args.file) {
    csvFiles = [path.resolve(PROJECT_ROOT, args.file)];
  } else {
    if (!fs.existsSync(CSV_DIR)) {
      throw new Error(`CSV directory not found: ${CSV_DIR}`);
    }
    csvFiles = fs.readdirSync(CSV_DIR)
      .filter(f => CSV_PATTERN.test(f))
      .map(f => path.join(CSV_DIR, f))
      .sort();
  }
  
  logger.info('CSV files found', { count: csvFiles.length });
  
  // 再開ポイント以降のファイルから処理
  let startFileIdx = 0;
  let startPolicyId = null;
  if (resumeState && resumeState.last_file_idx !== undefined) {
    startFileIdx = resumeState.last_file_idx;
    startPolicyId = resumeState.last_processed_id;
  }
  
  // 統計
  let parseAmountSuccess = 0;
  let parseAmountFailed = 0;
  let updatedChangedHash = 0;
  let updatedLastSeenOnly = 0;
  let totalRows = 0;
  
  // ファイルごとに処理
  for (let fileIdx = startFileIdx; fileIdx < csvFiles.length; fileIdx++) {
    const filePath = csvFiles[fileIdx];
    const fileName = path.basename(filePath);
    
    logger.info(`Processing file`, { file: fileName, idx: fileIdx });
    
    const rows = parseCSV(filePath);
    logger.info(`Parsed rows`, { count: rows.length });
    
    // policy_idでソート（再開性のため）
    rows.sort((a, b) => parseInt(a.policy_id) - parseInt(b.policy_id));
    
    for (const row of rows) {
      const policyId = parseInt(row.policy_id, 10);
      
      // 再開時: 前回処理済みIDはスキップ
      if (startPolicyId && policyId <= startPolicyId) {
        continue;
      }
      startPolicyId = null;  // 最初の該当行以降は通常処理
      
      // limit チェック
      if (args.limit && totalRows >= args.limit) {
        logger.info('Limit reached', { limit: args.limit });
        return;
      }
      
      totalRows++;
      
      try {
        // 金額パース
        const amountResult = parseMaxAmount(row.max_amount);
        if (amountResult.parsed) parseAmountSuccess++;
        else parseAmountFailed++;
        
        // row_hash生成
        const rowHash = generateRowHash(row);
        
        // raw_json（CSV行全体をJSON保存）
        const rawJson = JSON.stringify(row);
        
        // 都道府県推定
        const prefCode = extractPrefectureCode(row.support_url);
        
        // 既存レコード確認
        const existing = db.query(`SELECT row_hash, first_seen_at FROM izumi_subsidies WHERE policy_id = ${policyId}`);
        const existingRow = existing.success && existing.rows.length > 0 ? existing.rows[0] : null;
        
        let sql;
        if (!existingRow) {
          // 新規INSERT
          const id = `izumi-${policyId}`;
          sql = `
            INSERT INTO izumi_subsidies (
              id, policy_id, detail_url, title, issuer, area, prefecture_code,
              publish_date, period, max_amount_text, max_amount_value,
              difficulty, difficulty_level, start_fee, success_fee,
              support_url, support_urls_all,
              raw_json, row_hash, first_seen_at, last_seen_at, is_visible,
              imported_at, updated_at
            ) VALUES (
              ${sqlValue(id)}, ${policyId}, ${sqlValue(row.detail_url)}, ${sqlValue(row.title)},
              ${sqlValue(row.issuer)}, ${sqlValue(row.area)}, ${sqlValue(prefCode)},
              ${sqlValue(row.publish_date || null)}, ${sqlValue(row.period)},
              ${sqlValue(row.max_amount)}, ${amountResult.value !== null ? amountResult.value : 'NULL'},
              ${sqlValue(row.difficulty)}, ${parseDifficulty(row.difficulty)},
              ${sqlValue(row.start_fee)}, ${sqlValue(row.success_fee)},
              ${sqlValue(row.support_url)}, ${sqlValue(row.support_urls_all)},
              ${sqlValue(rawJson)}, ${sqlValue(rowHash)}, datetime('now'), datetime('now'), 1,
              datetime('now'), datetime('now')
            )
          `;
          
          if (!args.dryRun) {
            const result = db.execute(sql);
            if (!result.success) {
              handleError(result.error, { policy_id: policyId, file: fileName });
              continue;
            }
          }
          
          updateStats({ inserted: stats.inserted + 1 });
          
        } else if (existingRow.row_hash !== rowHash) {
          // row_hashが変わった → 更新
          sql = `
            UPDATE izumi_subsidies SET
              detail_url = ${sqlValue(row.detail_url)},
              title = ${sqlValue(row.title)},
              issuer = ${sqlValue(row.issuer)},
              area = ${sqlValue(row.area)},
              prefecture_code = ${sqlValue(prefCode)},
              publish_date = ${sqlValue(row.publish_date || null)},
              period = ${sqlValue(row.period)},
              max_amount_text = ${sqlValue(row.max_amount)},
              max_amount_value = ${amountResult.value !== null ? amountResult.value : 'NULL'},
              difficulty = ${sqlValue(row.difficulty)},
              difficulty_level = ${parseDifficulty(row.difficulty)},
              start_fee = ${sqlValue(row.start_fee)},
              success_fee = ${sqlValue(row.success_fee)},
              support_url = ${sqlValue(row.support_url)},
              support_urls_all = ${sqlValue(row.support_urls_all)},
              raw_json = ${sqlValue(rawJson)},
              row_hash = ${sqlValue(rowHash)},
              last_seen_at = datetime('now'),
              updated_at = datetime('now')
            WHERE policy_id = ${policyId}
          `;
          
          if (!args.dryRun) {
            const result = db.execute(sql);
            if (!result.success) {
              handleError(result.error, { policy_id: policyId, file: fileName });
              continue;
            }
          }
          
          updatedChangedHash++;
          updateStats({ updated: stats.updated + 1 });
          
        } else {
          // row_hashが同じ → last_seen_atだけ更新
          sql = `UPDATE izumi_subsidies SET last_seen_at = datetime('now') WHERE policy_id = ${policyId}`;
          
          if (!args.dryRun) {
            db.execute(sql);
          }
          
          updatedLastSeenOnly++;
          updateStats({ skipped: stats.skipped + 1 });
        }
        
        updateStats({ 
          processed: stats.processed + 1,
          last_processed_id: policyId,
          last_file_idx: fileIdx
        });
        
        // 進捗表示
        if (stats.processed % 50 === 0) {
          logger.progress(stats.processed, totalRows, { lastId: policyId });
          saveCheckpoint();
        }
        
      } catch (error) {
        handleError(error, { policy_id: policyId, file: fileName });
      }
    }
  }
  
  // 最終統計
  updateStats({
    parse_amount_success: parseAmountSuccess,
    parse_amount_failed: parseAmountFailed,
    updated_changed_hash: updatedChangedHash,
    updated_last_seen_only: updatedLastSeenOnly,
    total_rows_read: totalRows
  });
  
  console.log('');
  logger.info('Import completed', {
    parse_amount_success: parseAmountSuccess,
    parse_amount_failed: parseAmountFailed,
    updated_changed_hash: updatedChangedHash,
    updated_last_seen_only: updatedLastSeenOnly
  });
  
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

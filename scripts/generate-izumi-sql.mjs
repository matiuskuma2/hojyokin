#!/usr/bin/env node
/**
 * generate-izumi-sql.mjs
 * 
 * izumi詳細CSVからSQL INSERT文を生成
 * バッチ実行用（wrangler d1 execute --file）
 * 
 * 使用方法:
 *   node scripts/generate-izumi-sql.mjs > migrations/local/izumi_data.sql
 *   node scripts/generate-izumi-sql.mjs --limit=100 > migrations/local/izumi_data_100.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 設定
const CSV_DIR = path.join(PROJECT_ROOT, 'data/izumi/details');
const CSV_PATTERN = /^izumi_detail_.*\.csv$/;

// =============================================================================
// ユーティリティ
// =============================================================================

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

function normalizeWhitespace(str) {
  if (!str) return '';
  return str
    .replace(/[\t\n\r\f\v]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/　/g, ' ')
    .trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url.trim();
  }
}

// =============================================================================
// 金額パース
// =============================================================================

function parseMaxAmount(text) {
  if (!text || text === '') return { value: null, parsed: false };
  
  const ambiguousPatterns = [
    /[0-9]+[万円]*\s*[\/／][人月年回件日時]/,  // 3万円/1人、5000円/回
    /[\/／][0-9]*[人月年回件日時]/,            // /人、/1人
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
  
  const unitMap = [
    ['億', 100000000],
    ['千万', 10000000],
    ['百万', 1000000],
    ['万', 10000],
    ['千', 1000]
  ];
  
  let normalized = text
    .replace(/[,，]/g, '')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  
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
  
  const numMatch = normalized.match(/([0-9,]+)\s*円/);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(num)) {
      return { value: num, parsed: true };
    }
  }
  
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
// 難易度・都道府県
// =============================================================================

function parseDifficulty(text) {
  if (!text) return 1;
  const stars = (text.match(/★/g) || []).length;
  return Math.max(1, Math.min(5, stars || 1));
}

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
    if (url.includes('.ibaraki.osaka.jp')) return '27';
    if (url.includes('.fuchu.hiroshima.jp')) return '34';
    if (url.includes('.fuchu.tokyo.jp')) return '13';
  } catch {}
  
  return null;
}

// =============================================================================
// row_hash生成
// =============================================================================

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

function main() {
  const args = process.argv.slice(2);
  let limit = null;
  
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    }
  }
  
  // CSVファイル列挙
  const csvFiles = fs.readdirSync(CSV_DIR)
    .filter(f => CSV_PATTERN.test(f))
    .map(f => path.join(CSV_DIR, f))
    .sort();
  
  console.error(`[INFO] Found ${csvFiles.length} CSV files`);
  
  // ヘッダー出力
  console.log('-- =============================================================================');
  console.log('-- izumi_subsidies data import');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Files: ${csvFiles.length}`);
  console.log('-- =============================================================================');
  console.log('');
  
  // 重複チェック用
  const seenPolicyIds = new Set();
  let totalRows = 0;
  let duplicateSkipped = 0;
  let parseAmountSuccess = 0;
  let parseAmountFailed = 0;
  
  // 各ファイルを処理
  for (const filePath of csvFiles) {
    const fileName = path.basename(filePath);
    const rows = parseCSV(filePath);
    
    console.log(`-- File: ${fileName} (${rows.length} rows)`);
    
    for (const row of rows) {
      const policyId = parseInt(row.policy_id, 10);
      
      // 重複スキップ
      if (seenPolicyIds.has(policyId)) {
        duplicateSkipped++;
        continue;
      }
      seenPolicyIds.add(policyId);
      
      // limit チェック
      if (limit && totalRows >= limit) {
        console.error(`[INFO] Limit reached: ${limit}`);
        break;
      }
      
      totalRows++;
      
      // 金額パース
      const amountResult = parseMaxAmount(row.max_amount);
      if (amountResult.parsed) parseAmountSuccess++;
      else parseAmountFailed++;
      
      // row_hash生成
      const rowHash = generateRowHash(row);
      
      // raw_json
      const rawJson = JSON.stringify(row);
      
      // 都道府県推定
      const prefCode = extractPrefectureCode(row.support_url);
      
      // INSERT文生成
      const id = `izumi-${policyId}`;
      const sql = `INSERT OR REPLACE INTO izumi_subsidies (
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
);`;
      
      console.log(sql);
    }
    
    if (limit && totalRows >= limit) break;
  }
  
  // 統計出力
  console.log('');
  console.log('-- =============================================================================');
  console.log(`-- Statistics:`);
  console.log(`--   Total rows: ${totalRows}`);
  console.log(`--   Duplicate skipped: ${duplicateSkipped}`);
  console.log(`--   Amount parsed: ${parseAmountSuccess}`);
  console.log(`--   Amount failed: ${parseAmountFailed}`);
  console.log('-- =============================================================================');
  
  console.error(`[INFO] Total: ${totalRows} rows, ${duplicateSkipped} duplicates skipped`);
  console.error(`[INFO] Amount parse: ${parseAmountSuccess} success, ${parseAmountFailed} failed`);
}

main();

#!/usr/bin/env node
/**
 * import-izumi-urls.mjs
 * 
 * izumi support_urls CSV（約17,032件）をD1の izumi_urls テーブルに展開
 * 
 * 使用方法:
 *   node scripts/import-izumi-urls.mjs --local
 *   node scripts/import-izumi-urls.mjs --local --dry-run
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
  csvDir: path.join(PROJECT_ROOT, 'data/izumi'),
  csvPattern: /^izumi_support_urls_.*\.csv$/,
  batchSize: 50,
  d1Database: 'subsidy-matching-production'
};

// =============================================================================
// URL処理
// =============================================================================

/**
 * all_urlsを個別URLに分割
 * @param {string} allUrls - パイプ区切りのURL文字列
 * @returns {string[]} - URLの配列
 */
function splitUrls(allUrls) {
  if (!allUrls) return [];
  return allUrls
    .split('|')
    .map(u => u.trim())
    .filter(u => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));
}

/**
 * URLを正規化
 * @param {string} url - 元のURL
 * @returns {string} - 正規化されたURL
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // フラグメント(#...)は保持（izumiでは重要な場合あり）
    let normalized = parsed.href;
    // 末尾スラッシュ統一（パスが / 以外で末尾 / の場合は除去）
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url.trim();
  }
}

/**
 * URLタイプを分類
 * @param {string} url - URL
 * @returns {string} - 'html', 'pdf', 'unknown'
 */
function classifyUrlType(url) {
  const lower = url.toLowerCase();
  
  // PDFパターン
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.includes('.pdf?') || lower.includes('.pdf#')) return 'pdf';
  
  // HTMLパターン
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.php') || lower.endsWith('.aspx')) return 'html';
  
  // 拡張子なしはHTMLと推定
  try {
    const pathname = new URL(url).pathname;
    if (!pathname.includes('.') || pathname.endsWith('/')) return 'html';
  } catch {}
  
  return 'unknown';
}

/**
 * URLからドメインを抽出
 * @param {string} url - URL
 * @returns {string} - ドメイン
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * URLのハッシュを生成（重複排除用）
 * @param {string} url - 正規化されたURL
 * @returns {string} - MD5ハッシュ
 */
function generateUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
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
    if (!row.policy_id) {
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
 * URL行をINSERT
 */
function insertUrl(policyId, url, isPrimary, isLocal, dryRun) {
  const normalizedUrl = normalizeUrl(url);
  const urlHash = generateUrlHash(normalizedUrl);
  const urlType = classifyUrlType(normalizedUrl);
  const domain = extractDomain(normalizedUrl);
  const id = `izurl-${urlHash.substring(0, 12)}`;
  
  const escapedUrl = normalizedUrl.replace(/'/g, "''");
  const escapedDomain = domain.replace(/'/g, "''");
  
  const sql = `
    INSERT INTO izumi_urls (
      id, policy_id, url, url_hash, url_type, is_primary, domain,
      crawl_status, created_at, updated_at
    ) VALUES (
      '${id}', ${policyId}, '${escapedUrl}', '${urlHash}', '${urlType}', ${isPrimary ? 1 : 0}, '${escapedDomain}',
      'pending', datetime('now'), datetime('now')
    )
    ON CONFLICT(policy_id, url_hash) DO UPDATE SET
      url = excluded.url,
      url_type = excluded.url_type,
      is_primary = MAX(izumi_urls.is_primary, excluded.is_primary),
      domain = excluded.domain,
      updated_at = datetime('now')
  `.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  if (dryRun) {
    return { success: true, inserted: true, duplicate: false };
  }
  
  const result = executeD1(sql, isLocal);
  return { 
    success: result.success, 
    inserted: result.success, 
    duplicate: false,
    error: result.error 
  };
}

// =============================================================================
// メイン処理
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isProduction = args.includes('--production');
  const dryRun = args.includes('--dry-run');
  
  if (!isLocal && !isProduction) {
    console.error('Error: Specify --local or --production');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('import-izumi-urls.mjs');
  console.log('='.repeat(60));
  console.log(`Mode: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`CSV Directory: ${CONFIG.csvDir}`);
  console.log('');
  
  const startTime = Date.now();
  
  // CSVファイル列挙
  if (!fs.existsSync(CONFIG.csvDir)) {
    console.error(`Error: CSV directory not found: ${CONFIG.csvDir}`);
    process.exit(1);
  }
  
  const csvFiles = fs.readdirSync(CONFIG.csvDir)
    .filter(f => CONFIG.csvPattern.test(f))
    .map(f => path.join(CONFIG.csvDir, f))
    .sort();
  
  console.log(`Found ${csvFiles.length} CSV files`);
  
  let totalPolicies = 0;
  let totalUrls = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = [];
  
  // 重複URL追跡用（policy_id単位）
  const seenUrls = new Map();
  
  // ファイルごとに処理
  for (let i = 0; i < csvFiles.length; i++) {
    const filePath = csvFiles[i];
    const fileName = path.basename(filePath);
    
    console.log(`\n[${i + 1}/${csvFiles.length}] Processing: ${fileName}`);
    
    // CSVパース
    const rows = parseCSV(filePath);
    console.log(`  Parsed ${rows.length} policies`);
    
    if (rows.length === 0) continue;
    
    totalPolicies += rows.length;
    
    // 行ごとに処理
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      const policyId = parseInt(row.policy_id, 10);
      const primaryUrl = row.primary_url || '';
      const allUrls = splitUrls(row.all_urls);
      
      // 重複排除用セット
      const policyKey = `${policyId}`;
      if (!seenUrls.has(policyKey)) {
        seenUrls.set(policyKey, new Set());
      }
      const policySeenUrls = seenUrls.get(policyKey);
      
      // 全URLを処理
      for (const url of allUrls) {
        const normalizedUrl = normalizeUrl(url);
        const urlHash = generateUrlHash(normalizedUrl);
        
        // 同一policy内での重複チェック
        if (policySeenUrls.has(urlHash)) {
          totalDuplicates++;
          continue;
        }
        policySeenUrls.add(urlHash);
        
        const isPrimary = url === primaryUrl;
        
        const result = insertUrl(policyId, url, isPrimary, isLocal, dryRun);
        totalUrls++;
        
        if (result.success) {
          totalInserted++;
        } else {
          totalErrors.push({ policy_id: policyId, url, error: result.error });
        }
      }
      
      // 進捗表示
      if ((j + 1) % 100 === 0) {
        process.stdout.write(`\r  Progress: ${j + 1}/${rows.length} policies, ${totalUrls} URLs`);
      }
    }
    
    console.log(''); // 改行
  }
  
  const duration = Date.now() - startTime;
  
  // 結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total Files:      ${csvFiles.length}`);
  console.log(`Total Policies:   ${totalPolicies}`);
  console.log(`Total URLs:       ${totalUrls}`);
  console.log(`Inserted:         ${totalInserted}`);
  console.log(`Duplicates:       ${totalDuplicates}`);
  console.log(`Errors:           ${totalErrors.length}`);
  console.log(`Duration:         ${(duration / 1000).toFixed(1)}s`);
  
  if (totalErrors.length > 0) {
    console.log('\nErrors (first 10):');
    totalErrors.slice(0, 10).forEach(e => {
      console.log(`  - policy_id=${e.policy_id}: ${e.error?.substring(0, 80) || 'unknown'}`);
    });
  }
  
  // 結果JSON出力
  const result = {
    totalFiles: csvFiles.length,
    totalPolicies,
    totalUrls,
    inserted: totalInserted,
    duplicates: totalDuplicates,
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

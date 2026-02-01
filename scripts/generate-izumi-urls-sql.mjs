#!/usr/bin/env node
/**
 * generate-izumi-urls-sql.mjs
 * 
 * izumi_support_urls CSVからSQL INSERT文を生成
 * URL台帳（izumi_urls）へ投入、orphan_pdf検出も実施
 * 
 * 使用方法:
 *   node scripts/generate-izumi-urls-sql.mjs > migrations/local/izumi_urls_data.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 設定
const CSV_DIR = path.join(PROJECT_ROOT, 'data/izumi');
const CSV_PATTERN = /^izumi_support_urls.*\.csv$/;

// =============================================================================
// ユーティリティ
// =============================================================================

function md5(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

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

// =============================================================================
// URL分類
// =============================================================================

/**
 * URLを分類
 * @returns {string} 'pdf', 'issuer_page', 'orphan_pdf', 'detail'
 */
function classifyUrl(url, isPrimary, allUrls) {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  // PDF判定
  const isPdf = lowerUrl.includes('.pdf') || 
                lowerUrl.includes('/pdf/') ||
                lowerUrl.match(/\.pdf[?#]/) ||
                lowerUrl.match(/\.pdf$/);
  
  // izumi詳細ページ
  if (lowerUrl.includes('j-izumi.com/policy/')) {
    return 'detail';
  }
  
  if (!isPdf) {
    return 'issuer_page';
  }
  
  // PDF の場合、issuer_page が別にあるか確認
  // primary_url が PDF で、all_urls に issuer_page が無い場合は orphan_pdf
  if (isPrimary && isPdf) {
    const hasIssuerPage = allUrls.some(u => {
      const lower = u.toLowerCase();
      return !lower.includes('.pdf') && 
             !lower.includes('/pdf/') &&
             !lower.match(/\.pdf[?#]/) &&
             !lower.match(/\.pdf$/) &&
             !lower.includes('j-izumi.com');
    });
    
    if (!hasIssuerPage) {
      return 'orphan_pdf';
    }
  }
  
  return 'pdf';
}

/**
 * URLからドメインを抽出
 */
function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname;
  } catch {
    return null;
  }
}

// =============================================================================
// CSVパース
// =============================================================================

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (lines.length < 2) return [];
  
  // ヘッダー解析
  const headerLine = lines[0].trim();
  const headers = parseCSVLine(headerLine);
  
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row = {};
    
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    // policy_id が必須
    if (!row.policy_id) continue;
    
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
  
  console.error(`[INFO] Found ${csvFiles.length} URL CSV files`);
  
  // ヘッダー出力
  console.log('-- =============================================================================');
  console.log('-- izumi_urls data import');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Files: ${csvFiles.length}`);
  console.log('-- =============================================================================');
  console.log('');
  
  // 重複チェック用
  const seenUrlHashes = new Map(); // policy_id:url_hash => true
  let totalRows = 0;
  let duplicateSkipped = 0;
  let pdfUrls = 0;
  let issuerPages = 0;
  let orphanPdfs = 0;
  let detailUrls = 0;
  let policiesProcessed = new Set();
  
  // 各ファイルを処理
  for (const filePath of csvFiles) {
    const fileName = path.basename(filePath);
    const rows = parseCSV(filePath);
    
    console.log(`-- File: ${fileName} (${rows.length} rows)`);
    
    for (const row of rows) {
      const policyId = parseInt(row.policy_id, 10);
      if (isNaN(policyId)) continue;
      
      policiesProcessed.add(policyId);
      
      // primary_url と all_urls を処理
      const primaryUrl = row.primary_url?.trim();
      const allUrlsRaw = row.all_urls?.trim() || '';
      
      // all_urls を分割（| 区切り）
      const allUrls = allUrlsRaw
        .split('|')
        .map(u => u.trim())
        .filter(u => u && u.length > 0);
      
      // primary_url が all_urls に含まれていない場合は追加
      const urlSet = new Set(allUrls);
      if (primaryUrl && !urlSet.has(primaryUrl)) {
        allUrls.unshift(primaryUrl);
        urlSet.add(primaryUrl);
      }
      
      // 各URLを処理
      for (const url of allUrls) {
        if (!url || url.length < 5) continue;
        
        // limit チェック
        if (limit && totalRows >= limit) {
          console.error(`[INFO] Limit reached: ${limit}`);
          break;
        }
        
        // URL正規化とハッシュ
        const normalizedUrl = url.trim();
        const urlHash = md5(normalizedUrl);
        const dedupKey = `${policyId}:${urlHash}`;
        
        // 重複スキップ
        if (seenUrlHashes.has(dedupKey)) {
          duplicateSkipped++;
          continue;
        }
        seenUrlHashes.set(dedupKey, true);
        
        totalRows++;
        
        // URL分類
        const isPrimary = normalizedUrl === primaryUrl;
        const urlKind = classifyUrl(normalizedUrl, isPrimary, allUrls);
        
        // 統計
        if (urlKind === 'pdf') pdfUrls++;
        else if (urlKind === 'issuer_page') issuerPages++;
        else if (urlKind === 'orphan_pdf') orphanPdfs++;
        else if (urlKind === 'detail') detailUrls++;
        
        // ドメイン抽出
        const domain = extractDomain(normalizedUrl);
        
        // source_of_truth_url: orphan_pdf以外のPDFで、issuer_pageがあればそれを設定
        let sourceOfTruthUrl = null;
        if (urlKind === 'pdf' && !isPrimary) {
          // issuer_page を探す
          const issuerPage = allUrls.find(u => {
            const kind = classifyUrl(u, false, allUrls);
            return kind === 'issuer_page';
          });
          if (issuerPage) {
            sourceOfTruthUrl = issuerPage;
          }
        }
        
        // discovered_from_url: primary_url から発見された場合
        const discoveredFromUrl = isPrimary ? null : primaryUrl;
        
        // INSERT文生成
        const id = uuid();
        const sql = `INSERT OR REPLACE INTO izumi_urls (
  id, policy_id, url, url_hash, url_type, url_kind,
  is_primary, domain, source_of_truth_url, discovered_from_url,
  crawl_status, created_at, updated_at
) VALUES (
  ${sqlValue(id)}, ${policyId}, ${sqlValue(normalizedUrl)}, ${sqlValue(urlHash)},
  ${sqlValue(urlKind === 'pdf' || urlKind === 'orphan_pdf' ? 'pdf' : 'html')},
  ${sqlValue(urlKind)},
  ${isPrimary ? 1 : 0}, ${sqlValue(domain)},
  ${sqlValue(sourceOfTruthUrl)}, ${sqlValue(discoveredFromUrl)},
  'pending', datetime('now'), datetime('now')
);`;
        
        console.log(sql);
      }
      
      if (limit && totalRows >= limit) break;
    }
    
    if (limit && totalRows >= limit) break;
  }
  
  // 統計出力
  console.log('');
  console.log('-- =============================================================================');
  console.log(`-- Statistics:`);
  console.log(`--   Policies processed: ${policiesProcessed.size}`);
  console.log(`--   Total URLs: ${totalRows}`);
  console.log(`--   Duplicate skipped: ${duplicateSkipped}`);
  console.log(`--   PDF URLs: ${pdfUrls}`);
  console.log(`--   Issuer pages: ${issuerPages}`);
  console.log(`--   Orphan PDFs: ${orphanPdfs}`);
  console.log(`--   Detail URLs: ${detailUrls}`);
  console.log('-- =============================================================================');
  
  console.error(`[INFO] Total: ${totalRows} URLs from ${policiesProcessed.size} policies`);
  console.error(`[INFO] PDF: ${pdfUrls}, Issuer: ${issuerPages}, Orphan: ${orphanPdfs}, Detail: ${detailUrls}`);
  console.error(`[INFO] Duplicates skipped: ${duplicateSkipped}`);
}

main();

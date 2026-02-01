#!/usr/bin/env node
/**
 * import-izumi-urls.mjs
 * 
 * izumi support_urls CSV を展開して izumi_urls に投入
 * orphan_pdf（PDFしかないもの）を検出・管理
 * 
 * 使用方法:
 *   node scripts/import-izumi-urls.mjs --local
 *   node scripts/import-izumi-urls.mjs --local --dry-run
 *   node scripts/import-izumi-urls.mjs --local --limit=100
 *   node scripts/import-izumi-urls.mjs --local --resume
 *   node scripts/import-izumi-urls.mjs --local --fail-fast
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  ScriptRunner, 
  md5, 
  escapeSQL, 
  sqlValue, 
  normalizeUrl 
} from './lib/script-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =============================================================================
// 設定
// =============================================================================

const CSV_DIR = path.join(PROJECT_ROOT, 'data/izumi');
const CSV_PATTERN = /^izumi_support_urls_.*\.csv$/;

// =============================================================================
// URL分類
// =============================================================================

/**
 * URLタイプを判定
 * @returns {'pdf' | 'html'}
 */
function getUrlType(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.includes('.pdf?') || lower.includes('.pdf#')) return 'pdf';
  return 'html';
}

/**
 * URL分類（url_kind）を決定
 * 
 * @param {string} url - URL
 * @param {boolean} isPrimary - primary_urlか
 * @param {boolean} hasIssuerPage - 同一policy_idにissuer_page（HTML）があるか
 * @returns {'issuer_page' | 'pdf' | 'orphan_pdf' | 'detail'}
 */
function classifyUrlKind(url, isPrimary, hasIssuerPage) {
  // izumi詳細ページ
  if (url.includes('j-izumi.com/policy/')) {
    return 'detail';
  }
  
  const urlType = getUrlType(url);
  
  if (urlType === 'pdf') {
    // PDFの場合
    if (isPrimary && !hasIssuerPage) {
      // primary_url が PDF かつ issuer_page が存在しない
      return 'orphan_pdf';
    }
    return 'pdf';
  }
  
  // HTML
  return 'issuer_page';
}

/**
 * URLからドメインを抽出
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
 */
function generateUrlHash(url) {
  return md5(normalizeUrl(url));
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

/**
 * all_urlsを個別URLに分割
 */
function splitUrls(allUrls) {
  if (!allUrls) return [];
  return allUrls
    .split('|')
    .map(u => u.trim())
    .filter(u => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));
}

// =============================================================================
// メイン処理
// =============================================================================

const runner = new ScriptRunner('import-izumi-urls', process.argv.slice(2));

runner.run(async (ctx) => {
  const { args, logger, db, stats, resumeState, updateStats, saveCheckpoint, handleError } = ctx;
  
  // CSVファイル列挙
  if (!fs.existsSync(CSV_DIR)) {
    throw new Error(`CSV directory not found: ${CSV_DIR}`);
  }
  
  const csvFiles = fs.readdirSync(CSV_DIR)
    .filter(f => CSV_PATTERN.test(f))
    .map(f => path.join(CSV_DIR, f))
    .sort();
  
  logger.info('CSV files found', { count: csvFiles.length });
  
  // 再開ポイント
  let startFileIdx = 0;
  let startPolicyId = null;
  if (resumeState && resumeState.last_file_idx !== undefined) {
    startFileIdx = resumeState.last_file_idx;
    startPolicyId = resumeState.last_processed_id;
  }
  
  // 統計
  let totalPolicies = 0;
  let totalUrls = 0;
  let pdfUrls = 0;
  let issuerPages = 0;
  let orphanPdfs = 0;
  let detailUrls = 0;
  let duplicatesRemoved = 0;
  
  // ファイルごとに処理
  for (let fileIdx = startFileIdx; fileIdx < csvFiles.length; fileIdx++) {
    const filePath = csvFiles[fileIdx];
    const fileName = path.basename(filePath);
    
    logger.info(`Processing file`, { file: fileName, idx: fileIdx });
    
    const rows = parseCSV(filePath);
    logger.info(`Parsed policies`, { count: rows.length });
    
    // policy_idでソート
    rows.sort((a, b) => parseInt(a.policy_id) - parseInt(b.policy_id));
    
    for (const row of rows) {
      const policyId = parseInt(row.policy_id, 10);
      
      // 再開時スキップ
      if (startPolicyId && policyId <= startPolicyId) {
        continue;
      }
      startPolicyId = null;
      
      // limit チェック
      if (args.limit && totalPolicies >= args.limit) {
        logger.info('Limit reached', { limit: args.limit });
        return;
      }
      
      totalPolicies++;
      
      try {
        const primaryUrl = row.primary_url || '';
        const allUrls = splitUrls(row.all_urls);
        
        if (allUrls.length === 0) {
          updateStats({ skipped: stats.skipped + 1 });
          continue;
        }
        
        // izumi詳細ページのURL（discovered_from_url用）
        const discoveredFromUrl = `https://j-izumi.com/policy/${policyId}/detail`;
        
        // issuer_page（HTML）があるか先に判定
        const hasIssuerPage = allUrls.some(u => getUrlType(u) === 'html' && !u.includes('j-izumi.com'));
        
        // 重複排除用セット
        const seenHashes = new Set();
        
        // 各URLを処理
        for (const url of allUrls) {
          const normalizedUrl = normalizeUrl(url);
          const urlHash = generateUrlHash(normalizedUrl);
          
          // 同一policy内での重複チェック
          if (seenHashes.has(urlHash)) {
            duplicatesRemoved++;
            continue;
          }
          seenHashes.add(urlHash);
          
          const isPrimary = url === primaryUrl;
          const urlType = getUrlType(url);
          const urlKind = classifyUrlKind(url, isPrimary, hasIssuerPage);
          const domain = extractDomain(url);
          
          // 統計カウント
          totalUrls++;
          if (urlKind === 'pdf') pdfUrls++;
          else if (urlKind === 'issuer_page') issuerPages++;
          else if (urlKind === 'orphan_pdf') orphanPdfs++;
          else if (urlKind === 'detail') detailUrls++;
          
          // source_of_truth_url: PDFの場合、issuer_pageがあればそれを設定
          let sourceOfTruthUrl = null;
          if (urlKind === 'pdf' || urlKind === 'orphan_pdf') {
            // 同一policy_idのissuer_pageを探す
            const issuerPageUrl = allUrls.find(u => 
              getUrlType(u) === 'html' && !u.includes('j-izumi.com')
            );
            if (issuerPageUrl) {
              sourceOfTruthUrl = normalizeUrl(issuerPageUrl);
            }
          }
          
          const id = `izurl-${urlHash.substring(0, 12)}`;
          
          const sql = `
            INSERT INTO izumi_urls (
              id, policy_id, url, url_hash, url_type, url_kind, is_primary, domain,
              source_of_truth_url, discovered_from_url,
              crawl_status, created_at, updated_at
            ) VALUES (
              ${sqlValue(id)}, ${policyId}, ${sqlValue(normalizedUrl)}, ${sqlValue(urlHash)},
              ${sqlValue(urlType)}, ${sqlValue(urlKind)}, ${isPrimary ? 1 : 0}, ${sqlValue(domain)},
              ${sqlValue(sourceOfTruthUrl)}, ${sqlValue(discoveredFromUrl)},
              'new', datetime('now'), datetime('now')
            )
            ON CONFLICT(policy_id, url_hash) DO UPDATE SET
              url = excluded.url,
              url_type = excluded.url_type,
              url_kind = excluded.url_kind,
              is_primary = MAX(izumi_urls.is_primary, excluded.is_primary),
              domain = excluded.domain,
              source_of_truth_url = COALESCE(excluded.source_of_truth_url, izumi_urls.source_of_truth_url),
              discovered_from_url = COALESCE(excluded.discovered_from_url, izumi_urls.discovered_from_url),
              updated_at = datetime('now')
          `;
          
          if (!args.dryRun) {
            const result = db.execute(sql);
            if (!result.success) {
              handleError(result.error, { policy_id: policyId, url: url.substring(0, 80) });
            }
          }
        }
        
        updateStats({ 
          processed: stats.processed + 1,
          inserted: stats.inserted + allUrls.length,
          last_processed_id: policyId,
          last_file_idx: fileIdx
        });
        
        // 進捗表示
        if (stats.processed % 100 === 0) {
          logger.progress(stats.processed, totalPolicies, { lastId: policyId });
          saveCheckpoint();
        }
        
      } catch (error) {
        handleError(error, { policy_id: policyId });
      }
    }
  }
  
  // 最終統計
  updateStats({
    policies_processed: totalPolicies,
    urls_total: totalUrls,
    pdf_urls: pdfUrls,
    issuer_pages: issuerPages,
    orphan_pdfs: orphanPdfs,
    detail_urls: detailUrls,
    duplicates_removed: duplicatesRemoved
  });
  
  console.log('');
  logger.info('Import completed', {
    policies_processed: totalPolicies,
    urls_total: totalUrls,
    pdf_urls: pdfUrls,
    issuer_pages: issuerPages,
    orphan_pdfs: orphanPdfs,
    detail_urls: detailUrls,
    duplicates_removed: duplicatesRemoved
  });
  
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

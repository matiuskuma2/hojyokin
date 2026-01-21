#!/usr/bin/env node
/**
 * 47都道府県 source_registry 投入スクリプト
 * Usage: node tools/seed_source_registry_prefectures.mjs [csv_path] [db_name] [mode]
 * 
 * Example:
 *   node tools/seed_source_registry_prefectures.mjs seeds/source_registry_prefectures.csv subsidy-matching-production local
 *   node tools/seed_source_registry_prefectures.mjs seeds/source_registry_prefectures.csv subsidy-matching-production remote
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const CSV_PATH = process.argv[2] || "seeds/source_registry_prefectures.csv";
const DB_NAME = process.argv[3] || "subsidy-matching-production";
const MODE = process.argv[4] || "local"; // local | remote

/**
 * CSVパース（シンプル版）
 */
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",").map(s => s.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(s => s.trim());
    const obj = {};
    header.forEach((h, i) => obj[h] = cols[i] ?? "");
    return obj;
  });
}

/**
 * URLからドメインキーを抽出
 * go.jp / lg.jp は3階層維持、その他は2階層
 */
function extractDomainKey(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const parts = hostname.split('.');
    
    // go.jp / lg.jp は3階層（例: pref.nara.lg.jp → nara.lg.jp は特殊）
    if (hostname.endsWith('.go.jp') || hostname.endsWith('.lg.jp')) {
      return parts.slice(-3).join('.');
    }
    // その他は2階層
    return parts.slice(-2).join('.');
  } catch {
    return 'unknown';
  }
}

/**
 * crawl_strategy 変換（CSV: list → DB: scrape）
 */
function mapCrawlStrategy(strategy) {
  const map = { 'list': 'scrape', 'scrape': 'scrape', 'crawl': 'crawl', 'map': 'map' };
  return map[strategy] || 'scrape';
}

/**
 * update_frequency 変換（CSV: weekly → DB: weekly）
 */
function mapUpdateFreq(freq) {
  const map = { 'daily': 'daily', 'weekly': 'weekly', 'monthly': 'monthly' };
  return map[freq] || 'weekly';
}

console.log(`📂 Reading CSV: ${CSV_PATH}`);
const csv = fs.readFileSync(CSV_PATH, "utf-8");
const rows = parseCSV(csv);

console.log(`📊 Parsed ${rows.length} rows`);

if (rows.length !== 47) {
  console.error(`❌ Expected 47 rows but got ${rows.length}. Abort.`);
  process.exit(1);
}

// SQL VALUES 生成
const valuesSQL = rows.map(r => {
  const regionCode = r.region_code.padStart(2, "0");
  const programKey = `pref-${regionCode}`;
  const domainKey = extractDomainKey(r.root_url);
  const crawlStrategy = mapCrawlStrategy(r.crawl_strategy);
  const updateFreq = mapUpdateFreq(r.update_frequency);
  
  const esc = (s) => String(s).replace(/'/g, "''");
  
  return `(
    lower(hex(randomblob(16))),
    'prefecture',
    '${regionCode}',
    '${esc(programKey)}',
    '${esc(r.root_url)}',
    '${esc(domainKey)}',
    '${esc(crawlStrategy)}',
    ${Number(r.max_depth) || 1},
    NULL,
    NULL,
    '${esc(updateFreq)}',
    ${Number(r.enabled) || 1},
    1,
    ${Number(r.priority) || 3},
    '${esc(r.organization_name)}',
    NULL,
    datetime('now', '+7 days'),
    datetime('now'),
    datetime('now')
  )`;
}).join(",\n");

const sql = `-- Seed source_registry prefectures (47)
-- Generated at: ${new Date().toISOString()}
-- Mode: ${MODE}

-- 既存の prefecture レコードを削除
DELETE FROM source_registry WHERE scope = 'prefecture';

-- 47都道府県を投入
INSERT INTO source_registry (
  registry_id,
  scope,
  geo_id,
  program_key,
  root_url,
  domain_key,
  crawl_strategy,
  max_depth,
  target_types,
  keyword_filter,
  update_freq,
  enabled,
  robots_required,
  priority,
  notes,
  last_crawled_at,
  next_crawl_at,
  created_at,
  updated_at
) VALUES
${valuesSQL};
`;

const sqlPath = "tools/_seed_source_registry_prefectures.sql";
fs.writeFileSync(sqlPath, sql);
console.log(`✅ Generated SQL: ${sqlPath}`);

// wrangler で実行
const remoteFlag = MODE === "remote" ? "--remote" : "--local";
const cmd = `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --file=${sqlPath}`;

console.log(`▶ Running: ${cmd}`);
try {
  execSync(cmd, { stdio: "inherit" });
  console.log(`✅ Done (${MODE})`);
} catch (error) {
  console.error(`❌ Failed: ${error.message}`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * source_registry (major secretariats) seed tool
 *
 * Usage:
 *   node tools/seed_source_registry_secretariats.mjs seeds/source_registry_secretariats.csv subsidy-matching-production local
 *   node tools/seed_source_registry_secretariats.mjs seeds/source_registry_secretariats.csv subsidy-matching-production remote
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function parseCSV(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) die("CSV must have header + at least 1 row.");

  // CSV parser (supports quoted values with commas)
  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
        inQuote = !inQuote;
        continue;
      }
      if (ch === "," && !inQuote) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.replace(/\\"/g, '"').trim());
  };

  const header = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  const objects = rows.map((cells, idx) => {
    const obj = {};
    header.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    obj.__row = idx + 2;
    return obj;
  });

  return { header, objects };
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function toInt(v, fallback = 0) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function toBool01(v, fallback = 0) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return 1;
  if (s === "0" || s === "false" || s === "no") return 0;
  return fallback;
}

function required(obj, key) {
  const v = String(obj[key] ?? "").trim();
  if (!v) die(`CSV row ${obj.__row}: missing required field "${key}"`);
  return v;
}

function makeValuesRow(o) {
  const v = (x) => (x === null || x === "" ? "NULL" : `'${sqlEscape(x)}'`);

  const registry_id = required(o, "registry_id");
  const scope = required(o, "scope");
  const geo_id = String(o.geo_id ?? "").trim() || null;
  const program_key = required(o, "program_key");
  const root_url = required(o, "root_url");
  const domain_key = required(o, "domain_key");
  const crawl_strategy = String(o.crawl_strategy ?? "scrape").trim() || "scrape";
  const max_depth = toInt(o.max_depth, 1);
  const target_types = String(o.target_types ?? "html").trim() || "html";
  const keyword_filter = String(o.keyword_filter ?? "").trim() || null;
  const update_freq = String(o.update_freq ?? "weekly").trim() || "weekly";
  const enabled = toBool01(o.enabled, 1);
  const robots_required = toBool01(o.robots_required, 1);
  const priority = toInt(o.priority, 3);
  const notes = String(o.notes ?? "").trim() || null;
  const data_scope = String(o.data_scope ?? "guideline,faq,news").trim();
  const authority = String(o.authority ?? "official").trim() || "official";
  const stop_condition = String(o.stop_condition ?? "deadline").trim() || "deadline";
  const list_page_selector = String(o.list_page_selector ?? "").trim() || null;
  const pdf_keywords = String(o.pdf_keywords ?? "").trim() || null;

  return `(
  ${v(registry_id)},
  ${v(scope)},
  ${geo_id ? v(geo_id) : "NULL"},
  ${v(program_key)},
  ${v(root_url)},
  ${v(domain_key)},
  ${v(crawl_strategy)},
  ${max_depth},
  ${v(target_types)},
  ${keyword_filter ? v(keyword_filter) : "NULL"},
  ${v(update_freq)},
  ${enabled},
  ${robots_required},
  ${priority},
  ${notes ? v(notes) : "NULL"},
  ${v(data_scope)},
  ${v(authority)},
  ${v(stop_condition)},
  ${list_page_selector ? v(list_page_selector) : "NULL"},
  ${pdf_keywords ? v(pdf_keywords) : "NULL"},
  NULL,
  NULL,
  datetime('now','-1 minute'),
  datetime('now'),
  datetime('now')
)`;
}

function main() {
  const csvPath = process.argv[2];
  const dbName = process.argv[3] || "subsidy-matching-production";
  const mode = (process.argv[4] || "local").toLowerCase();

  if (!csvPath) die("Usage: node tools/seed_source_registry_secretariats.mjs <csvPath> <dbName> <local|remote>");
  if (!["local", "remote"].includes(mode)) die('mode must be "local" or "remote"');

  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) die(`CSV not found: ${abs}`);

  const csvText = fs.readFileSync(abs, "utf-8");
  console.log(`📂 Reading CSV: ${csvPath}`);
  const { objects } = parseCSV(csvText);

  console.log(`📊 Parsed ${objects.length} rows`);
  if (objects.length === 0) die("No rows found.");

  const valuesSQL = objects.map(makeValuesRow).join(",\n");

  const sql = `-- Generated seed for source_registry (secretariats)
-- Source: ${csvPath}
-- Generated at: ${new Date().toISOString()}

INSERT INTO source_registry (
  registry_id, scope, geo_id, program_key,
  root_url, domain_key, crawl_strategy, max_depth,
  target_types, keyword_filter, update_freq, enabled,
  robots_required, priority, notes,
  data_scope, authority, stop_condition,
  list_page_selector, pdf_keywords,
  last_hash, last_crawl_status,
  next_crawl_at, created_at, updated_at
) VALUES
${valuesSQL}
ON CONFLICT(registry_id) DO UPDATE SET
  scope = excluded.scope,
  geo_id = excluded.geo_id,
  program_key = excluded.program_key,
  root_url = excluded.root_url,
  domain_key = excluded.domain_key,
  crawl_strategy = excluded.crawl_strategy,
  max_depth = excluded.max_depth,
  target_types = excluded.target_types,
  keyword_filter = excluded.keyword_filter,
  update_freq = excluded.update_freq,
  enabled = excluded.enabled,
  robots_required = excluded.robots_required,
  priority = excluded.priority,
  notes = excluded.notes,
  data_scope = excluded.data_scope,
  authority = excluded.authority,
  stop_condition = excluded.stop_condition,
  list_page_selector = excluded.list_page_selector,
  pdf_keywords = excluded.pdf_keywords,
  updated_at = datetime('now');
`;

  const outPath = "tools/_seed_secretariats.sql";
  fs.writeFileSync(outPath, sql, "utf-8");
  console.log(`✅ Generated SQL: ${outPath}`);

  const flag = mode === "remote" ? "--remote" : "--local";
  const cmd = `npx wrangler d1 execute ${dbName} ${flag} --file=${outPath}`;
  console.log(`🚀 Executing: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });

  console.log(`✅ Done (${mode})`);
}

main();

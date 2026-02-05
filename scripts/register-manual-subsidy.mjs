#!/usr/bin/env node
/**
 * register-manual-subsidy.mjs
 * 
 * 手動登録補助金のSSOT登録SQL生成スクリプト
 * jGrants APIに存在しない補助金を手動で登録する際に使用
 * 
 * 使用例:
 *   node scripts/register-manual-subsidy.mjs --config config.json --dry-run
 *   node scripts/register-manual-subsidy.mjs --config config.json --apply --remote
 * 
 * 設定ファイル例（config.json）:
 * {
 *   "canonical_id": "IT-SUBSIDY-2026",
 *   "name": "中小企業デジタル化・AI導入支援事業費補助金（IT導入補助金2026）",
 *   "issuer_name": "経済産業省",
 *   "prefecture_code": "00",
 *   "categories": [
 *     {
 *       "id": "IT-SUBSIDY-2026-TSUJYO",
 *       "name": "通常枠",
 *       "subsidy_max_limit": 4500000,
 *       "subsidy_rate": "1/2",
 *       "acceptance_start": "2026-02-01",
 *       "acceptance_end": "2026-12-31",
 *       "is_accepting": 1
 *     }
 *   ],
 *   "monitor_url": "https://it-shien.smrj.go.jp/download/"
 * }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

// ====================
// 設定
// ====================
const DB_NAME = 'subsidy-matching-production';

// ====================
// ヘルパー関数
// ====================
function generateHash(str) {
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    configFile: null,
    dryRun: true,
    local: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
        options.configFile = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--apply':
        options.dryRun = false;
        break;
      case '--local':
        options.local = true;
        break;
      case '--remote':
        options.local = false;
        break;
    }
  }

  return options;
}

// ====================
// SQL生成
// ====================
function generateManualRegistrationSQL(config) {
  const sqls = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

  sqls.push(`-- 手動登録補助金 SSOT登録SQL（自動生成）`);
  sqls.push(`-- 生成日時: ${new Date().toISOString()}`);
  sqls.push(`-- 制度名: ${config.name}`);
  sqls.push(`-- canonical_id: ${config.canonical_id}`);
  sqls.push('');

  const nameNormalized = config.name.replace(/[\s\u3000]/g, '').replace(/[【】〈〉《》「」『』（）()]/g, '');

  // 1. メインの canonical
  sqls.push(`-- ========================================`);
  sqls.push(`-- Step 1: canonical（制度マスタ）`);
  sqls.push(`-- ========================================`);
  sqls.push(`INSERT OR IGNORE INTO subsidy_canonical (`);
  sqls.push(`  id, name, name_normalized, issuer_name, prefecture_code, is_active,`);
  sqls.push(`  created_at, updated_at`);
  sqls.push(`) VALUES (`);
  sqls.push(`  ${escapeSQL(config.canonical_id)},`);
  sqls.push(`  ${escapeSQL(config.name)},`);
  sqls.push(`  ${escapeSQL(nameNormalized)},`);
  sqls.push(`  ${escapeSQL(config.issuer_name)},`);
  sqls.push(`  ${escapeSQL(config.prefecture_code || '00')},`);
  sqls.push(`  1,`);
  sqls.push(`  datetime('now'),`);
  sqls.push(`  datetime('now')`);
  sqls.push(`);`);
  sqls.push('');

  // 各カテゴリ（枠）に対して snapshot, cache, source_link を生成
  let latestSnapshotId = null;
  let latestCacheId = null;

  if (config.categories && config.categories.length > 0) {
    // 受付中の枠を優先して latest を決定
    const acceptingCategories = config.categories.filter(c => c.is_accepting === 1);
    const primaryCategory = acceptingCategories.length > 0 
      ? acceptingCategories[0] 
      : config.categories[0];

    for (const category of config.categories) {
      const cacheId = category.id;
      const snapshotId = `snap-${category.id}-${timestamp}`;
      const linkId = `link-${category.id}`;

      const contentForHash = JSON.stringify({
        name: category.name,
        isAccepting: category.is_accepting,
        acceptStart: category.acceptance_start,
        acceptEnd: category.acceptance_end,
        maxLimit: category.subsidy_max_limit,
        subsidyRate: category.subsidy_rate,
      });
      const contentHash = `sha256:${generateHash(contentForHash)}`;

      sqls.push(`-- ----------------------------------------`);
      sqls.push(`-- カテゴリ: ${category.name}`);
      sqls.push(`-- ----------------------------------------`);

      // 2. snapshot
      sqls.push(`-- Step 2: snapshot`);
      sqls.push(`INSERT OR IGNORE INTO subsidy_snapshot (`);
      sqls.push(`  id, canonical_id, version, is_accepting, acceptance_start, acceptance_end,`);
      sqls.push(`  subsidy_max_limit, subsidy_rate, target_area_text, content_hash, created_at`);
      sqls.push(`) VALUES (`);
      sqls.push(`  ${escapeSQL(snapshotId)},`);
      sqls.push(`  ${escapeSQL(config.canonical_id)},`);
      sqls.push(`  1,`);
      sqls.push(`  ${category.is_accepting || 0},`);
      sqls.push(`  ${category.acceptance_start ? escapeSQL(category.acceptance_start) : 'NULL'},`);
      sqls.push(`  ${category.acceptance_end ? escapeSQL(category.acceptance_end) : 'NULL'},`);
      sqls.push(`  ${category.subsidy_max_limit !== undefined ? category.subsidy_max_limit : 'NULL'},`);
      sqls.push(`  ${escapeSQL(category.subsidy_rate)},`);
      sqls.push(`  ${escapeSQL(category.target_area || '全国')},`);
      sqls.push(`  ${escapeSQL(contentHash)},`);
      sqls.push(`  datetime('now')`);
      sqls.push(`);`);
      sqls.push('');

      // 3. cache
      sqls.push(`-- Step 3: cache`);
      sqls.push(`INSERT OR REPLACE INTO subsidy_cache (`);
      sqls.push(`  id, source, title, subsidy_max_limit, subsidy_rate,`);
      sqls.push(`  target_area_search, acceptance_start_datetime, acceptance_end_datetime,`);
      sqls.push(`  canonical_id, cached_at, expires_at`);
      sqls.push(`) VALUES (`);
      sqls.push(`  ${escapeSQL(cacheId)},`);
      sqls.push(`  'manual',`);
      sqls.push(`  ${escapeSQL(config.name + '（' + category.name + '）')},`);
      sqls.push(`  ${category.subsidy_max_limit !== undefined ? category.subsidy_max_limit : 'NULL'},`);
      sqls.push(`  ${escapeSQL(category.subsidy_rate)},`);
      sqls.push(`  ${escapeSQL(category.target_area || '全国')},`);
      sqls.push(`  ${category.acceptance_start ? escapeSQL(category.acceptance_start) : 'NULL'},`);
      sqls.push(`  ${category.acceptance_end ? escapeSQL(category.acceptance_end) : 'NULL'},`);
      sqls.push(`  ${escapeSQL(config.canonical_id)},`);
      sqls.push(`  datetime('now'),`);
      sqls.push(`  datetime('now', '+30 days')`);
      sqls.push(`);`);
      sqls.push('');

      // 4. source_link（手動登録）
      sqls.push(`-- Step 4: source_link`);
      sqls.push(`INSERT OR IGNORE INTO subsidy_source_link (`);
      sqls.push(`  id, canonical_id, source_type, source_id, match_type, created_at`);
      sqls.push(`) VALUES (`);
      sqls.push(`  ${escapeSQL(linkId)},`);
      sqls.push(`  ${escapeSQL(config.canonical_id)},`);
      sqls.push(`  'manual',`);
      sqls.push(`  ${escapeSQL(category.id)},`);
      sqls.push(`  'manual',`);
      sqls.push(`  datetime('now')`);
      sqls.push(`);`);
      sqls.push('');

      // 最初の受付中カテゴリをlatestに設定
      if (category === primaryCategory) {
        latestSnapshotId = snapshotId;
        latestCacheId = cacheId;
      }
    }
  }

  // 5. latest_snapshot_id / latest_cache_id 更新
  if (latestSnapshotId && latestCacheId) {
    sqls.push(`-- ========================================`);
    sqls.push(`-- Step 5: latest更新`);
    sqls.push(`-- ========================================`);
    sqls.push(`UPDATE subsidy_canonical SET`);
    sqls.push(`  latest_snapshot_id = ${escapeSQL(latestSnapshotId)},`);
    sqls.push(`  latest_cache_id = ${escapeSQL(latestCacheId)},`);
    sqls.push(`  updated_at = datetime('now')`);
    sqls.push(`WHERE id = ${escapeSQL(config.canonical_id)};`);
    sqls.push('');
  }

  // 6. 監視設定（オプション）
  if (config.monitor_url) {
    const monitorId = `monitor-${generateHash(config.monitor_url)}`;
    sqls.push(`-- ========================================`);
    sqls.push(`-- Step 6: 監視設定`);
    sqls.push(`-- ========================================`);
    sqls.push(`INSERT OR IGNORE INTO data_source_monitors (`);
    sqls.push(`  id, canonical_id, source_type, monitor_url, check_interval_hours,`);
    sqls.push(`  is_active, created_at`);
    sqls.push(`) VALUES (`);
    sqls.push(`  ${escapeSQL(monitorId)},`);
    sqls.push(`  ${escapeSQL(config.canonical_id)},`);
    sqls.push(`  'official_site',`);
    sqls.push(`  ${escapeSQL(config.monitor_url)},`);
    sqls.push(`  168,  -- 週1回`);
    sqls.push(`  1,`);
    sqls.push(`  datetime('now')`);
    sqls.push(`);`);
    sqls.push('');
  }

  // Gate検証SQL
  sqls.push(`-- ========================================`);
  sqls.push(`-- Gate検証（実行後に確認）`);
  sqls.push(`-- ========================================`);
  sqls.push(`-- Gate-1: canonical + snapshot 存在確認`);
  sqls.push(`-- SELECT c.id, c.latest_snapshot_id, s.is_accepting`);
  sqls.push(`-- FROM subsidy_canonical c`);
  sqls.push(`-- JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id`);
  sqls.push(`-- WHERE c.id = '${config.canonical_id}';`);
  sqls.push('');
  sqls.push(`-- Gate-2: SSOT検索ヒット確認`);
  sqls.push(`-- SELECT c.id, c.name, l.source_type`);
  sqls.push(`-- FROM subsidy_canonical c`);
  sqls.push(`-- JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id`);
  sqls.push(`-- LEFT JOIN subsidy_source_link l ON l.canonical_id = c.id`);
  sqls.push(`-- WHERE c.is_active = 1 AND s.is_accepting = 1`);
  sqls.push(`-- AND c.id = '${config.canonical_id}';`);

  return sqls.join('\n');
}

// ====================
// ファイル出力
// ====================
function saveSQL(sql, canonicalId) {
  const dir = 'migrations/manual';
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `${dir}/register_${canonicalId}_${timestamp}.sql`;
  writeFileSync(filename, sql);
  console.log(`[INFO] SQL saved to: ${filename}`);
  return filename;
}

// ====================
// SQL実行
// ====================
function executeSQL(filename, local) {
  const remoteFlag = local ? '--local' : '--remote';
  const cmd = `cd /home/user/webapp && npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --file=${filename}`;
  console.log(`[INFO] Executing: ${cmd}`);
  
  try {
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    console.log(result);
    return true;
  } catch (error) {
    console.error(`[ERROR] SQL execution failed:`, error.message);
    return false;
  }
}

// ====================
// メイン処理
// ====================
async function main() {
  const options = parseArgs();

  if (!options.configFile) {
    console.error('Usage: node register-manual-subsidy.mjs --config <config.json> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --config <file>  設定ファイル（JSON）');
    console.error('  --dry-run       SQLを生成するだけで実行しない（デフォルト）');
    console.error('  --apply         SQLを実際に実行する');
    console.error('  --local         ローカルDBに適用（デフォルト）');
    console.error('  --remote        リモートDBに適用');
    console.error('');
    console.error('設定ファイル例:');
    console.error(JSON.stringify({
      canonical_id: 'IT-SUBSIDY-2026',
      name: 'IT導入補助金2026',
      issuer_name: '経済産業省',
      prefecture_code: '00',
      categories: [
        {
          id: 'IT-SUBSIDY-2026-TSUJYO',
          name: '通常枠',
          subsidy_max_limit: 4500000,
          subsidy_rate: '1/2',
          acceptance_start: '2026-02-01',
          acceptance_end: '2026-12-31',
          is_accepting: 1
        }
      ],
      monitor_url: 'https://it-shien.smrj.go.jp/download/'
    }, null, 2));
    process.exit(1);
  }

  // 設定ファイル読み込み
  if (!existsSync(options.configFile)) {
    console.error(`[ERROR] Config file not found: ${options.configFile}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(options.configFile, 'utf-8'));

  console.log('========================================');
  console.log('手動登録補助金 SSOT登録スクリプト');
  console.log('========================================');
  console.log(`制度名: ${config.name}`);
  console.log(`canonical ID: ${config.canonical_id}`);
  console.log(`カテゴリ数: ${config.categories?.length || 0}`);
  console.log(`実行モード: ${options.dryRun ? 'dry-run（SQLのみ生成）' : 'apply（実行）'}`);
  console.log(`対象DB: ${options.local ? 'ローカル' : 'リモート'}`);
  console.log('');

  // SQL生成
  const sql = generateManualRegistrationSQL(config);

  // ファイル保存
  const filename = saveSQL(sql, config.canonical_id);

  // 実行（dry-runでなければ）
  if (!options.dryRun) {
    const success = executeSQL(filename, options.local);
    if (success) {
      console.log('[SUCCESS] SSOT登録が完了しました');
    } else {
      console.error('[FAILED] SSOT登録に失敗しました');
      process.exit(1);
    }
  } else {
    console.log('');
    console.log('[INFO] dry-runモードのため、SQLは実行されていません');
    console.log(`[INFO] 実行するには: node ${process.argv[1]} --config ${options.configFile} --apply ${options.local ? '--local' : '--remote'}`);
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});

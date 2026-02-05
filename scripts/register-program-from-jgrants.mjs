#!/usr/bin/env node
/**
 * register-program-from-jgrants.mjs
 * 
 * jGrants APIから補助金を取得してSSOT登録（canonical/snapshot/source_link/cache/monitor）を行う
 * 
 * 使用例:
 *   node scripts/register-program-from-jgrants.mjs --keyword "ものづくり" --canonical-id CANON-MONODUKURI --dry-run
 *   node scripts/register-program-from-jgrants.mjs --keyword "ものづくり" --apply
 * 
 * オプション:
 *   --keyword <string>       検索キーワード（必須）
 *   --canonical-id <string>  canonical ID（省略時は自動生成）
 *   --issuer-name <string>   発行機関名（fallback用）
 *   --prefecture-code <string> 都道府県コード（デフォルト: 00=全国）
 *   --monitor-url <string>   監視URL（オプション）
 *   --dry-run               SQLを生成するだけで実行しない（デフォルト）
 *   --apply                 SQLを実際に実行する
 *   --local                 ローカルDBに適用（デフォルト）
 *   --remote                リモートDBに適用
 * 
 * 出力:
 *   migrations/manual/register_<canonical_id>_<timestamp>.sql
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

// ====================
// 設定
// ====================
const JGRANTS_API_BASE = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
const DB_NAME = 'subsidy-matching-production';

// ====================
// ヘルパー関数
// ====================
function generateHash(str) {
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function formatDatetime(date) {
  return date ? new Date(date).toISOString() : null;
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    keyword: null,
    canonicalId: null,
    issuerName: null,
    prefectureCode: '00',
    monitorUrl: null,
    dryRun: true,
    local: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--keyword':
        options.keyword = args[++i];
        break;
      case '--canonical-id':
        options.canonicalId = args[++i];
        break;
      case '--issuer-name':
        options.issuerName = args[++i];
        break;
      case '--prefecture-code':
        options.prefectureCode = args[++i];
        break;
      case '--monitor-url':
        options.monitorUrl = args[++i];
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
// jGrants API呼び出し
// ====================
async function fetchFromJGrants(keyword) {
  const params = new URLSearchParams({
    keyword,
    acceptance: '1', // 受付中のみ
    sort: 'acceptance_end_datetime',
    order: 'ASC',
    limit: '50',
  });

  const url = `${JGRANTS_API_BASE}?${params}`;
  console.log(`[INFO] Fetching from jGrants: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`jGrants API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result?.subsidies || [];
}

// ====================
// SQL生成
// ====================
function generateRegistrationSQL(subsidies, options) {
  const { canonicalId, issuerName, prefectureCode, monitorUrl } = options;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const sqls = [];

  sqls.push(`-- SSOT登録SQL（自動生成）`);
  sqls.push(`-- 生成日時: ${new Date().toISOString()}`);
  sqls.push(`-- キーワード: ${options.keyword}`);
  sqls.push(`-- 対象件数: ${subsidies.length}件`);
  sqls.push('');

  // 重複排除（同一source_idを除外）
  const uniqueSubsidies = [];
  const seenIds = new Set();
  for (const s of subsidies) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      uniqueSubsidies.push(s);
    }
  }

  // 各補助金に対してSSO登録SQLを生成
  for (const subsidy of uniqueSubsidies) {
    const sourceId = subsidy.id;
    const jgCanonicalId = `jg-${sourceId}`;
    const snapshotId = `snap-${sourceId}-${timestamp}`;
    const linkId = `link-${sourceId}`;
    const cacheId = jgCanonicalId;

    const name = subsidy.title || subsidy.name || '';
    const nameNormalized = name.replace(/[\s\u3000]/g, '').replace(/[【】〈〉《》「」『』（）()]/g, '');
    const issuer = subsidy.subsidy_unit?.name || issuerName || '不明';
    const prefCode = prefectureCode || '00';

    const isAccepting = subsidy.acceptance === 1 ? 1 : 0;
    const acceptStart = formatDatetime(subsidy.acceptance_start_datetime);
    const acceptEnd = formatDatetime(subsidy.acceptance_end_datetime);
    const maxLimit = subsidy.subsidy_max_limit || null;
    const subsidyRate = subsidy.subsidy_rate || null;
    const targetArea = subsidy.target_area_search || '全国';

    // content_hash生成（変更検知用）
    const contentForHash = JSON.stringify({
      name,
      isAccepting,
      acceptStart,
      acceptEnd,
      maxLimit,
      subsidyRate,
      targetArea,
    });
    const contentHash = `sha256:${generateHash(contentForHash)}`;

    sqls.push(`-- ========================================`);
    sqls.push(`-- ${name}`);
    sqls.push(`-- source_id: ${sourceId}`);
    sqls.push(`-- ========================================`);
    sqls.push('');

    // 1. subsidy_canonical
    sqls.push(`-- Step 1: canonical`);
    sqls.push(`INSERT OR IGNORE INTO subsidy_canonical (`);
    sqls.push(`  id, name, name_normalized, issuer_name, prefecture_code, is_active,`);
    sqls.push(`  created_at, updated_at`);
    sqls.push(`) VALUES (`);
    sqls.push(`  ${escapeSQL(jgCanonicalId)},`);
    sqls.push(`  ${escapeSQL(name)},`);
    sqls.push(`  ${escapeSQL(nameNormalized)},`);
    sqls.push(`  ${escapeSQL(issuer)},`);
    sqls.push(`  ${escapeSQL(prefCode)},`);
    sqls.push(`  1,`);
    sqls.push(`  datetime('now'),`);
    sqls.push(`  datetime('now')`);
    sqls.push(`);`);
    sqls.push('');

    // 2. subsidy_snapshot
    sqls.push(`-- Step 2: snapshot`);
    sqls.push(`INSERT OR IGNORE INTO subsidy_snapshot (`);
    sqls.push(`  id, canonical_id, version, is_accepting, acceptance_start, acceptance_end,`);
    sqls.push(`  subsidy_max_limit, subsidy_rate, target_area_text, content_hash, created_at`);
    sqls.push(`) VALUES (`);
    sqls.push(`  ${escapeSQL(snapshotId)},`);
    sqls.push(`  ${escapeSQL(jgCanonicalId)},`);
    sqls.push(`  1,`);
    sqls.push(`  ${isAccepting},`);
    sqls.push(`  ${acceptStart ? escapeSQL(acceptStart) : 'NULL'},`);
    sqls.push(`  ${acceptEnd ? escapeSQL(acceptEnd) : 'NULL'},`);
    sqls.push(`  ${maxLimit !== null ? maxLimit : 'NULL'},`);
    sqls.push(`  ${escapeSQL(subsidyRate)},`);
    sqls.push(`  ${escapeSQL(targetArea)},`);
    sqls.push(`  ${escapeSQL(contentHash)},`);
    sqls.push(`  datetime('now')`);
    sqls.push(`);`);
    sqls.push('');

    // 3. subsidy_source_link
    sqls.push(`-- Step 3: source_link`);
    sqls.push(`INSERT OR IGNORE INTO subsidy_source_link (`);
    sqls.push(`  id, canonical_id, source_type, source_id, match_type, created_at`);
    sqls.push(`) VALUES (`);
    sqls.push(`  ${escapeSQL(linkId)},`);
    sqls.push(`  ${escapeSQL(jgCanonicalId)},`);
    sqls.push(`  'jgrants',`);
    sqls.push(`  ${escapeSQL(sourceId)},`);
    sqls.push(`  'api',`);
    sqls.push(`  datetime('now')`);
    sqls.push(`);`);
    sqls.push('');

    // 4. subsidy_cache
    sqls.push(`-- Step 4: cache`);
    sqls.push(`INSERT OR REPLACE INTO subsidy_cache (`);
    sqls.push(`  id, source, title, subsidy_max_limit, subsidy_rate,`);
    sqls.push(`  target_area_search, acceptance_start_datetime, acceptance_end_datetime,`);
    sqls.push(`  canonical_id, cached_at, expires_at`);
    sqls.push(`) VALUES (`);
    sqls.push(`  ${escapeSQL(cacheId)},`);
    sqls.push(`  'jgrants',`);
    sqls.push(`  ${escapeSQL(name)},`);
    sqls.push(`  ${maxLimit !== null ? maxLimit : 'NULL'},`);
    sqls.push(`  ${escapeSQL(subsidyRate)},`);
    sqls.push(`  ${escapeSQL(targetArea)},`);
    sqls.push(`  ${acceptStart ? escapeSQL(acceptStart) : 'NULL'},`);
    sqls.push(`  ${acceptEnd ? escapeSQL(acceptEnd) : 'NULL'},`);
    sqls.push(`  ${escapeSQL(jgCanonicalId)},`);
    sqls.push(`  datetime('now'),`);
    sqls.push(`  datetime('now', '+7 days')`);
    sqls.push(`);`);
    sqls.push('');

    // 5. latest_snapshot_id / latest_cache_id 更新
    sqls.push(`-- Step 5: latest更新`);
    sqls.push(`UPDATE subsidy_canonical SET`);
    sqls.push(`  latest_snapshot_id = ${escapeSQL(snapshotId)},`);
    sqls.push(`  latest_cache_id = ${escapeSQL(cacheId)},`);
    sqls.push(`  updated_at = datetime('now')`);
    sqls.push(`WHERE id = ${escapeSQL(jgCanonicalId)};`);
    sqls.push('');
  }

  // 監視設定（オプション）
  if (monitorUrl && uniqueSubsidies.length > 0) {
    const firstSubsidy = uniqueSubsidies[0];
    const monitorCanonicalId = canonicalId || `jg-${firstSubsidy.id}`;
    const monitorId = `monitor-${generateHash(monitorUrl)}`;

    sqls.push(`-- ========================================`);
    sqls.push(`-- 監視設定`);
    sqls.push(`-- ========================================`);
    sqls.push(`INSERT OR IGNORE INTO data_source_monitors (`);
    sqls.push(`  id, canonical_id, source_type, monitor_url, check_interval_hours,`);
    sqls.push(`  is_active, created_at`);
    sqls.push(`) VALUES (`);
    sqls.push(`  ${escapeSQL(monitorId)},`);
    sqls.push(`  ${escapeSQL(monitorCanonicalId)},`);
    sqls.push(`  'official_site',`);
    sqls.push(`  ${escapeSQL(monitorUrl)},`);
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
  sqls.push(`-- WHERE c.name LIKE '%${options.keyword}%';`);
  sqls.push('');
  sqls.push(`-- Gate-2: SSOT検索ヒット確認`);
  sqls.push(`-- SELECT c.id, c.name, l.source_type`);
  sqls.push(`-- FROM subsidy_canonical c`);
  sqls.push(`-- JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id`);
  sqls.push(`-- LEFT JOIN subsidy_source_link l ON l.canonical_id = c.id`);
  sqls.push(`-- WHERE c.is_active = 1 AND s.is_accepting = 1`);
  sqls.push(`-- AND c.name LIKE '%${options.keyword}%';`);

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
  const filename = `${dir}/register_${canonicalId || 'jgrants'}_${timestamp}.sql`;
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

  if (!options.keyword) {
    console.error('Usage: node register-program-from-jgrants.mjs --keyword <keyword> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --keyword <string>       検索キーワード（必須）');
    console.error('  --canonical-id <string>  canonical ID（省略時は自動生成）');
    console.error('  --issuer-name <string>   発行機関名');
    console.error('  --prefecture-code <string> 都道府県コード（デフォルト: 00）');
    console.error('  --monitor-url <string>   監視URL');
    console.error('  --dry-run               SQLを生成するだけで実行しない（デフォルト）');
    console.error('  --apply                 SQLを実際に実行する');
    console.error('  --local                 ローカルDBに適用（デフォルト）');
    console.error('  --remote                リモートDBに適用');
    process.exit(1);
  }

  console.log('========================================');
  console.log('SSOT登録スクリプト');
  console.log('========================================');
  console.log(`キーワード: ${options.keyword}`);
  console.log(`canonical ID: ${options.canonicalId || '自動生成'}`);
  console.log(`実行モード: ${options.dryRun ? 'dry-run（SQLのみ生成）' : 'apply（実行）'}`);
  console.log(`対象DB: ${options.local ? 'ローカル' : 'リモート'}`);
  console.log('');

  // jGrants API呼び出し
  const subsidies = await fetchFromJGrants(options.keyword);
  console.log(`[INFO] ${subsidies.length}件の補助金を取得`);

  if (subsidies.length === 0) {
    console.log('[WARN] 対象の補助金が見つかりませんでした');
    process.exit(0);
  }

  // SQL生成
  const sql = generateRegistrationSQL(subsidies, options);

  // ファイル保存
  const filename = saveSQL(sql, options.canonicalId);

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
    console.log(`[INFO] 実行するには: node ${process.argv[1]} --keyword "${options.keyword}" --apply ${options.local ? '--local' : '--remote'}`);
  }

  // サマリー出力
  console.log('');
  console.log('========================================');
  console.log('サマリー');
  console.log('========================================');
  console.log(`生成したSQL: ${filename}`);
  console.log(`対象補助金数: ${subsidies.length}件`);
  subsidies.slice(0, 5).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.title || s.name}`);
  });
  if (subsidies.length > 5) {
    console.log(`  ... 他 ${subsidies.length - 5}件`);
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * reconcile-migrations.js
 * 
 * 本番DBとmigration状態の整合を取るスクリプト
 * 
 * 問題:
 * - 本番DBには0001〜0006のmigrationのみ記録されている
 * - しかし実際には0007〜0021相当のテーブルが手動で作成済み
 * - そのため、migration applyを実行するとduplicate table/columnエラーが発生
 * 
 * 解決策:
 * 1. 本番DBに存在するテーブルを確認
 * 2. 対応するmigrationを「適用済み」としてd1_migrationsに追加
 * 3. これにより、今後のmigration applyが正常に動作する
 * 
 * 使用方法:
 * - ローカル: node tools/reconcile-migrations.js --local
 * - 本番:     node tools/reconcile-migrations.js --remote
 */

const { execSync } = require('child_process');

// migration と 作成されるテーブルのマッピング
const MIGRATION_TABLE_MAP = {
  '0007_crawl_job_cron_support.sql': ['crawl_job'], // ALTER TABLEのみ
  '0008_crawl_queue.sql': ['crawl_queue', 'crawl_queue_stats'],
  '0009_fix_crawl_queue_fk.sql': ['crawl_queue'], // 再作成
  '0010_domain_policy_blocked_reason.sql': ['domain_policy'], // ALTER TABLE
  '0011_source_registry_scope_rules.sql': ['source_registry'], // ALTER TABLE
  '0012_user_admin_and_status.sql': ['users'], // ALTER TABLE
  '0013_password_reset_tokens.sql': ['password_reset_tokens'],
  '0014_audit_log.sql': ['audit_log'],
  '0015_company_profile.sql': ['company_profile'],
  '0016_s3_s4_chat_draft.sql': ['chat_sessions', 'chat_messages', 'chat_facts', 'application_drafts', 'company_documents'],
  '0017_security_tables.sql': ['login_attempts', 'rate_limit_buckets'],
  '0017_company_documents_raw_text.sql': ['company_documents'], // ALTER TABLE
  '0018_usage_events.sql': ['usage_events'],
  '0019_agency_tables.sql': ['agencies', 'agency_members', 'agency_clients', 'access_links', 'intake_submissions', 'chat_answers', 'notifications'],
  '0020_agency_intake_extension.sql': ['intake_link_templates', 'intake_field_mappings', 'agency_client_history'],
  '0021_superadmin_kpi_cost.sql': ['event_log', 'cost_usage_log', 'data_freshness_log', 'kpi_daily_snapshots', 'alert_rules', 'alert_history'],
};

// コマンドライン引数の解析
const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const isDryRun = args.includes('--dry-run');
const remoteFlag = isRemote ? '--remote' : '--local';

console.log(`\n🔧 Migration Reconcile Tool`);
console.log(`   Mode: ${isRemote ? '本番 (--remote)' : 'ローカル (--local)'}`);
console.log(`   Dry Run: ${isDryRun ? 'Yes' : 'No'}\n`);

function execD1(command) {
  try {
    const result = execSync(
      `npx wrangler d1 execute subsidy-matching-production ${remoteFlag} --command "${command.replace(/"/g, '\\"')}"`,
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    // JSON部分を抽出
    const jsonMatch = result.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('D1 execute error:', error.message);
    return [];
  }
}

async function main() {
  // 1. 現在適用済みのmigrationを取得
  console.log('📋 適用済みmigrationを確認中...');
  const appliedResult = execD1('SELECT name FROM d1_migrations ORDER BY name');
  const appliedMigrations = new Set(
    appliedResult[0]?.results?.map(r => r.name) || []
  );
  console.log(`   適用済み: ${appliedMigrations.size}件`);
  appliedMigrations.forEach(m => console.log(`   - ${m}`));

  // 2. 本番DBに存在するテーブルを取得
  console.log('\n📊 本番DBのテーブルを確認中...');
  const tablesResult = execD1("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'");
  const existingTables = new Set(
    tablesResult[0]?.results?.map(r => r.name) || []
  );
  console.log(`   テーブル数: ${existingTables.size}件`);

  // 3. 適用すべきmigrationを特定
  console.log('\n🔍 適用すべきmigrationを特定中...');
  const migrationsToMark = [];

  for (const [migration, tables] of Object.entries(MIGRATION_TABLE_MAP)) {
    if (appliedMigrations.has(migration)) {
      console.log(`   ✅ ${migration} - 既に適用済み`);
      continue;
    }

    // テーブルが存在するか確認（ALTER TABLEのmigrationは主テーブルの存在で判断）
    const hasTable = tables.some(t => existingTables.has(t));
    if (hasTable) {
      console.log(`   🔄 ${migration} - テーブル存在、適用済みとしてマーク`);
      migrationsToMark.push(migration);
    } else {
      console.log(`   ⏳ ${migration} - テーブル未作成、スキップ`);
    }
  }

  // 4. 0099_reconcile_schema.sqlも確認
  if (!appliedMigrations.has('0099_reconcile_schema.sql')) {
    console.log(`   🔄 0099_reconcile_schema.sql - reconcileとしてマーク`);
    migrationsToMark.push('0099_reconcile_schema.sql');
  }

  // 5. d1_migrationsに追加
  if (migrationsToMark.length === 0) {
    console.log('\n✨ 全てのmigrationが既に整合しています！');
    return;
  }

  console.log(`\n📝 ${migrationsToMark.length}件のmigrationを適用済みとしてマークします:`);
  migrationsToMark.forEach(m => console.log(`   - ${m}`));

  if (isDryRun) {
    console.log('\n⚠️  Dry Run モードのため、実際の変更は行いません。');
    console.log('   実行するには --dry-run フラグを外してください。');
    return;
  }

  console.log('\n🚀 d1_migrationsテーブルを更新中...');
  for (const migration of migrationsToMark) {
    const insertSql = `INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${migration}', datetime('now'))`;
    console.log(`   Inserting: ${migration}`);
    execD1(insertSql);
  }

  // 6. 最終確認
  console.log('\n✅ 更新後の適用済みmigration:');
  const finalResult = execD1('SELECT name, applied_at FROM d1_migrations ORDER BY name');
  finalResult[0]?.results?.forEach(r => {
    console.log(`   - ${r.name} (${r.applied_at})`);
  });

  console.log('\n🎉 Migration reconcile 完了！');
  console.log('   今後は通常の `npx wrangler d1 migrations apply` が使用可能です。');
}

main().catch(console.error);

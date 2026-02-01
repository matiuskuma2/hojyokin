/**
 * script-runner.mjs
 * 
 * 共通モジュール: run_id発行、ログ、再開性、fail-fast、D1操作
 * 
 * 使用例:
 *   import { ScriptRunner } from './lib/script-runner.mjs';
 *   const runner = new ScriptRunner('import-izumi', args);
 *   await runner.run(async (ctx) => { ... });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// =============================================================================
// 設定
// =============================================================================

export const CONFIG = {
  d1Database: 'subsidy-matching-production',
  defaultBatchSize: 200,
  logDir: path.join(PROJECT_ROOT, 'logs'),
  resumeDir: path.join(PROJECT_ROOT, 'logs/resume')
};

// =============================================================================
// CLI引数パーサー
// =============================================================================

/**
 * CLI引数をパース
 */
export function parseArgs(args) {
  const parsed = {
    mode: 'local',         // local | remote | production
    dryRun: false,
    failFast: false,
    limit: null,           // テスト用件数制限
    batchSize: CONFIG.defaultBatchSize,
    force: false,
    diffOnly: false,
    file: null,            // 特定ファイル指定
    canonicalId: null,     // 特定ID指定
    resume: false,         // 再開モード
    verbose: false
  };
  
  for (const arg of args) {
    if (arg === '--local') parsed.mode = 'local';
    else if (arg === '--remote') parsed.mode = 'remote';
    else if (arg === '--production') parsed.mode = 'production';
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--fail-fast') parsed.failFast = true;
    else if (arg === '--force') parsed.force = true;
    else if (arg === '--diff-only') parsed.diffOnly = true;
    else if (arg === '--resume') parsed.resume = true;
    else if (arg === '--verbose' || arg === '-v') parsed.verbose = true;
    else if (arg.startsWith('--limit=')) parsed.limit = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--batch-size=')) parsed.batchSize = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--file=')) parsed.file = arg.split('=')[1];
    else if (arg.startsWith('--canonical-id=')) parsed.canonicalId = arg.split('=')[1];
  }
  
  return parsed;
}

// =============================================================================
// ロガー（JSONL形式）
// =============================================================================

export class Logger {
  constructor(scriptName, runId, logDir = CONFIG.logDir) {
    this.scriptName = scriptName;
    this.runId = runId;
    this.logDir = logDir;
    this.logFile = null;
    this.errorFile = null;
    
    // ログディレクトリ作成
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // ログファイル名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logDir, `${scriptName}_${timestamp}_${runId}.jsonl`);
    this.errorFile = path.join(logDir, `${scriptName}_${timestamp}_${runId}_errors.jsonl`);
  }
  
  _write(level, message, data = {}) {
    const entry = {
      ts: new Date().toISOString(),
      run_id: this.runId,
      level,
      message,
      ...data
    };
    
    const line = JSON.stringify(entry) + '\n';
    
    // 標準出力にも出力
    if (level === 'ERROR') {
      console.error(`[${level}] ${message}`, data);
      fs.appendFileSync(this.errorFile, line);
    } else if (level === 'WARN') {
      console.warn(`[${level}] ${message}`);
    } else if (level !== 'DEBUG') {
      console.log(`[${level}] ${message}`);
    }
    
    // ファイルに追記
    fs.appendFileSync(this.logFile, line);
  }
  
  debug(message, data) { this._write('DEBUG', message, data); }
  info(message, data) { this._write('INFO', message, data); }
  warn(message, data) { this._write('WARN', message, data); }
  error(message, data) { this._write('ERROR', message, data); }
  
  progress(current, total, extra = {}) {
    const pct = ((current / total) * 100).toFixed(1);
    process.stdout.write(`\r[${this.runId}] Progress: ${current}/${total} (${pct}%) `);
    if (extra.lastId) {
      process.stdout.write(`last_id=${extra.lastId}`);
    }
  }
}

// =============================================================================
// 再開性管理
// =============================================================================

export class ResumeManager {
  constructor(scriptName, resumeDir = CONFIG.resumeDir) {
    this.scriptName = scriptName;
    this.resumeDir = resumeDir;
    this.resumeFile = path.join(resumeDir, `${scriptName}_resume.json`);
    
    if (!fs.existsSync(resumeDir)) {
      fs.mkdirSync(resumeDir, { recursive: true });
    }
  }
  
  /**
   * 再開ポイントを読み込み
   */
  load() {
    try {
      if (fs.existsSync(this.resumeFile)) {
        return JSON.parse(fs.readFileSync(this.resumeFile, 'utf-8'));
      }
    } catch {}
    return null;
  }
  
  /**
   * 再開ポイントを保存
   */
  save(state) {
    fs.writeFileSync(this.resumeFile, JSON.stringify({
      ...state,
      saved_at: new Date().toISOString()
    }, null, 2));
  }
  
  /**
   * 再開ポイントをクリア
   */
  clear() {
    if (fs.existsSync(this.resumeFile)) {
      fs.unlinkSync(this.resumeFile);
    }
  }
}

// =============================================================================
// D1操作
// =============================================================================

export class D1Client {
  constructor(mode = 'local', database = CONFIG.d1Database) {
    this.mode = mode;
    this.database = database;
    this.isLocal = mode === 'local';
  }
  
  _getFlags() {
    if (this.mode === 'local') return '--local';
    return '';
  }
  
  /**
   * SQLを実行（INSERT/UPDATE/DELETE用）
   */
  execute(sql) {
    const flags = this._getFlags();
    const escapedSql = sql
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const cmd = `cd "${PROJECT_ROOT}" && npx wrangler d1 execute ${this.database} ${flags} --command="${escapedSql}"`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * SELECTを実行してJSON取得
   */
  query(sql) {
    const flags = this._getFlags();
    const escapedSql = sql
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const cmd = `cd "${PROJECT_ROOT}" && npx wrangler d1 execute ${this.database} ${flags} --json --command="${escapedSql}"`;
    
    try {
      const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed) && parsed[0]?.results) {
        return { success: true, rows: parsed[0].results };
      }
      return { success: true, rows: [] };
    } catch (error) {
      return { success: false, error: error.message, rows: [] };
    }
  }
  
  /**
   * 件数取得
   */
  count(table, where = '') {
    const whereClause = where ? `WHERE ${where}` : '';
    const result = this.query(`SELECT COUNT(*) as count FROM ${table} ${whereClause}`);
    if (result.success && result.rows.length > 0) {
      return result.rows[0].count;
    }
    return 0;
  }
}

// =============================================================================
// ユーティリティ
// =============================================================================

/**
 * run_idを生成
 */
export function generateRunId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * SHA256ハッシュを生成
 */
export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * MD5ハッシュを生成
 */
export function md5(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * SQLエスケープ
 */
export function escapeSQL(str) {
  if (str === null || str === undefined) return null;
  return String(str).replace(/'/g, "''");
}

/**
 * SQL値をフォーマット
 */
export function sqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return `'${escapeSQL(val)}'`;
}

/**
 * 空白正規化
 */
export function normalizeWhitespace(str) {
  if (!str) return '';
  return str
    .replace(/[\t\n\r\f\v]+/g, ' ')  // 制御文字→空白
    .replace(/\s+/g, ' ')            // 連続空白→単一
    .replace(/　/g, ' ')              // 全角空白→半角
    .trim();
}

/**
 * URL正規化
 */
export function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    // トレーリングスラッシュ除去（ルート以外）
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url.trim();
  }
}

// =============================================================================
// スクリプトランナー
// =============================================================================

export class ScriptRunner {
  constructor(scriptName, args) {
    this.scriptName = scriptName;
    this.args = parseArgs(args);
    this.runId = generateRunId();
    this.logger = new Logger(scriptName, this.runId);
    this.resume = new ResumeManager(scriptName);
    this.db = new D1Client(this.args.mode);
    
    this.stats = {
      started_at: new Date().toISOString(),
      finished_at: null,
      processed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      last_processed_id: null
    };
  }
  
  /**
   * スクリプト実行
   */
  async run(mainFn) {
    console.log('='.repeat(60));
    console.log(`${this.scriptName}`);
    console.log('='.repeat(60));
    console.log(`Run ID: ${this.runId}`);
    console.log(`Mode: ${this.args.mode}`);
    console.log(`Dry Run: ${this.args.dryRun}`);
    console.log(`Fail Fast: ${this.args.failFast}`);
    console.log(`Batch Size: ${this.args.batchSize}`);
    if (this.args.limit) console.log(`Limit: ${this.args.limit}`);
    if (this.args.resume) console.log(`Resume: enabled`);
    console.log('');
    
    this.logger.info('Script started', { args: this.args });
    
    // 再開ポイント読み込み
    let resumeState = null;
    if (this.args.resume) {
      resumeState = this.resume.load();
      if (resumeState) {
        this.logger.info('Resuming from checkpoint', { 
          last_id: resumeState.last_processed_id,
          processed: resumeState.processed 
        });
        this.stats = { ...this.stats, ...resumeState };
      }
    }
    
    const startTime = Date.now();
    
    try {
      // メイン処理実行
      await mainFn({
        args: this.args,
        runId: this.runId,
        logger: this.logger,
        db: this.db,
        stats: this.stats,
        resumeState,
        
        // 便利メソッド
        updateStats: (updates) => {
          Object.assign(this.stats, updates);
        },
        saveCheckpoint: () => {
          this.resume.save(this.stats);
        },
        handleError: (error, context = {}) => {
          this.stats.errors++;
          this.logger.error(error.message || error, context);
          
          if (this.args.failFast) {
            throw new Error(`Fail-fast triggered: ${error.message || error}`);
          }
        }
      });
      
      // 正常完了
      this.resume.clear();
      
    } catch (error) {
      this.logger.error('Script failed', { error: error.message });
      this.resume.save(this.stats);
      throw error;
    }
    
    const duration = Date.now() - startTime;
    this.stats.finished_at = new Date().toISOString();
    this.stats.duration_ms = duration;
    
    // 結果サマリー
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Processed: ${this.stats.processed}`);
    console.log(`Inserted:  ${this.stats.inserted}`);
    console.log(`Updated:   ${this.stats.updated}`);
    console.log(`Skipped:   ${this.stats.skipped}`);
    console.log(`Errors:    ${this.stats.errors}`);
    console.log(`Duration:  ${(duration / 1000).toFixed(1)}s`);
    
    this.logger.info('Script completed', this.stats);
    
    console.log('\nResult JSON:');
    console.log(JSON.stringify(this.stats, null, 2));
    
    return this.stats;
  }
}

export default ScriptRunner;

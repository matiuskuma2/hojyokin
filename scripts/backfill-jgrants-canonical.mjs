#!/usr/bin/env node
/**
 * backfill-jgrants-canonical.mjs
 * 
 * 既存の subsidy_cache（jGrantsデータ）を subsidy_canonical および
 * subsidy_source_link へ安全に移行
 * 
 * 使用方法:
 *   node scripts/backfill-jgrants-canonical.mjs --local
 *   node scripts/backfill-jgrants-canonical.mjs --local --dry-run
 *   node scripts/backfill-jgrants-canonical.mjs --local --limit=100
 *   node scripts/backfill-jgrants-canonical.mjs --local --resume
 *   node scripts/backfill-jgrants-canonical.mjs --local --fail-fast
 *   node scripts/backfill-jgrants-canonical.mjs --production --confirm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  ScriptRunner, 
  md5, 
  escapeSQL, 
  sqlValue, 
  normalizeWhitespace 
} from './lib/script-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// =============================================================================
// 機関コードマッピング
// =============================================================================

const AGENCY_CODE_MAP = {
  '経済産業省': 'meti',
  '中小企業庁': 'smea',
  '厚生労働省': 'mhlw',
  '農林水産省': 'maff',
  '環境省': 'env',
  '総務省': 'mic',
  '国土交通省': 'mlit',
  'デジタル庁': 'digital',
  '文部科学省': 'mext',
  '内閣府': 'cao',
  '東京都': 'tokyo',
  '東京都産業労働局': 'tokyo-sanro',
  '公益財団法人東京都中小企業振興公社': 'tokyo-kosha',
  '東京しごと財団': 'tokyo-shigoto',
  '大阪府': 'osaka',
  '大阪産業局': 'osaka-obda',
  '神奈川県': 'kanagawa',
  '埼玉県': 'saitama',
  '千葉県': 'chiba',
  '愛知県': 'aichi',
  '福岡県': 'fukuoka',
  '北海道': 'hokkaido',
  '中小機構': 'smrj',
  'NEDO': 'nedo',
  'JETRO': 'jetro',
  'IPA': 'ipa',
  'JICA': 'jica'
};

// =============================================================================
// canonical_id 生成
// =============================================================================

/**
 * タイトルを正規化
 */
function normalizeTitle(title) {
  if (!title) return '';
  return normalizeWhitespace(title)
    .toLowerCase()
    .replace(/[（）\(\)\[\]【】「」『』]/g, '')
    .replace(/令和\d+年度?/g, '')
    .replace(/平成\d+年度?/g, '')
    .replace(/第\d+[次回期募集]/g, '')
    .replace(/[・]/g, '');
}

/**
 * detail_jsonからissuer_codeを抽出
 */
function extractIssuerCode(detailJson) {
  if (!detailJson) return null;
  
  try {
    const detail = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson;
    const agency = detail.implementing_agency || detail.issuer || detail.contact?.organization;
    
    if (!agency) return null;
    
    // 完全一致チェック
    if (AGENCY_CODE_MAP[agency]) {
      return AGENCY_CODE_MAP[agency];
    }
    
    // 部分一致チェック
    for (const [name, code] of Object.entries(AGENCY_CODE_MAP)) {
      if (agency.includes(name)) return code;
    }
    
    // マッチしない場合はハッシュ
    return 'org-' + md5(agency).substring(0, 6);
  } catch {
    return null;
  }
}

/**
 * detail_jsonからissuer_nameを抽出
 */
function extractIssuerName(detailJson) {
  if (!detailJson) return null;
  
  try {
    const detail = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson;
    return detail.implementing_agency || detail.issuer || detail.contact?.organization || null;
  } catch {
    return null;
  }
}

/**
 * target_area_searchから都道府県コードを抽出
 */
function extractPrefectureCode(targetArea) {
  if (!targetArea) return '00';
  
  const prefMap = {
    '北海道': '01', '青森': '02', '岩手': '03', '宮城': '04', '秋田': '05',
    '山形': '06', '福島': '07', '茨城': '08', '栃木': '09', '群馬': '10',
    '埼玉': '11', '千葉': '12', '東京': '13', '神奈川': '14', '新潟': '15',
    '富山': '16', '石川': '17', '福井': '18', '山梨': '19', '長野': '20',
    '岐阜': '21', '静岡': '22', '愛知': '23', '三重': '24', '滋賀': '25',
    '京都': '26', '大阪': '27', '兵庫': '28', '奈良': '29', '和歌山': '30',
    '鳥取': '31', '島根': '32', '岡山': '33', '広島': '34', '山口': '35',
    '徳島': '36', '香川': '37', '愛媛': '38', '高知': '39', '福岡': '40',
    '佐賀': '41', '長崎': '42', '熊本': '43', '大分': '44', '宮崎': '45',
    '鹿児島': '46', '沖縄': '47'
  };
  
  for (const [pref, code] of Object.entries(prefMap)) {
    if (targetArea.includes(pref)) return code;
  }
  
  if (targetArea.includes('全国') || targetArea.includes('日本全国')) {
    return '00';
  }
  
  return '00';
}

/**
 * region_scopeを判定
 */
function extractRegionScope(detailJson, targetArea) {
  if (!targetArea && !detailJson) return 'unknown';
  
  // detail_jsonのworkflowsをチェック
  if (detailJson) {
    try {
      const detail = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson;
      const workflows = detail.workflows || detail.target_area;
      if (workflows) {
        if (typeof workflows === 'string' && workflows.includes('全国')) return 'national';
      }
    } catch {}
  }
  
  // target_areaから判定
  if (targetArea) {
    if (targetArea.includes('全国')) return 'national';
    // 単一都道府県なら prefecture
    const prefs = ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', 
                   '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山',
                   '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重',
                   '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根',
                   '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡',
                   '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
    
    const matchedPrefs = prefs.filter(p => targetArea.includes(p));
    if (matchedPrefs.length === 1) return 'prefecture';
    if (matchedPrefs.length > 1) return 'multi_prefecture';
  }
  
  return 'unknown';
}

/**
 * canonical_idを生成
 */
function generateCanonicalId(cacheRow) {
  // jGrantsの場合、IDをそのまま利用
  if (cacheRow.source === 'jgrants' && cacheRow.id) {
    return `jg-${cacheRow.id}`;
  }
  
  // その他ソースの場合
  const normalized = normalizeTitle(cacheRow.title);
  const titleHash = md5(normalized).substring(0, 8);
  const issuerCode = extractIssuerCode(cacheRow.detail_json) || 'unknown';
  return `${issuerCode}-${titleHash}`;
}

// =============================================================================
// メイン処理
// =============================================================================

const runner = new ScriptRunner('backfill-jgrants-canonical', process.argv.slice(2));

runner.run(async (ctx) => {
  const { args, logger, db, stats, resumeState, updateStats, saveCheckpoint, handleError } = ctx;
  
  // 本番実行時の確認
  if (args.mode === 'production' && !args.confirm && !args.dryRun) {
    throw new Error('Production mode requires --confirm flag');
  }
  
  // 対象件数取得（canonical_id未設定のもの）
  const totalCount = db.count('subsidy_cache', 'canonical_id IS NULL');
  logger.info('Target rows', { count: totalCount });
  
  if (totalCount === 0) {
    logger.info('No rows to process');
    return;
  }
  
  // 再開ポイント
  let lastCacheId = null;
  if (resumeState && resumeState.last_processed_id) {
    lastCacheId = resumeState.last_processed_id;
  }
  
  // 統計
  let canonicalCreated = 0;
  let canonicalExisting = 0;
  let linksCreated = 0;
  let cacheUpdated = 0;
  let processed = 0;
  
  // バッチ処理
  const batchSize = args.batchSize;
  
  while (true) {
    // バッチ取得
    let sql = `
      SELECT id, source, title, subsidy_max_limit, subsidy_rate,
             target_area_search, target_industry, target_number_of_employees,
             acceptance_start_datetime, acceptance_end_datetime,
             request_reception_display_flag, detail_json, cached_at
      FROM subsidy_cache
      WHERE canonical_id IS NULL
    `;
    
    if (lastCacheId) {
      sql += ` AND id > '${lastCacheId}'`;
    }
    
    sql += ` ORDER BY id LIMIT ${batchSize}`;
    
    const batchResult = db.query(sql);
    
    if (!batchResult.success || batchResult.rows.length === 0) {
      break;
    }
    
    for (const row of batchResult.rows) {
      // limit チェック
      if (args.limit && processed >= args.limit) {
        logger.info('Limit reached', { limit: args.limit });
        return;
      }
      
      processed++;
      
      try {
        const canonicalId = generateCanonicalId(row);
        const issuerCode = extractIssuerCode(row.detail_json);
        const issuerName = extractIssuerName(row.detail_json);
        const prefCode = extractPrefectureCode(row.target_area_search);
        const regionScope = extractRegionScope(row.detail_json, row.target_area_search);
        const normalizedTitle = normalizeTitle(row.title);
        const linkId = `link-jg-${row.id}`;
        
        // Step 1: canonical確認/作成
        const existingCanonical = db.query(`SELECT id FROM subsidy_canonical WHERE id = ${sqlValue(canonicalId)}`);
        const canonicalExists = existingCanonical.success && existingCanonical.rows.length > 0;
        
        if (!canonicalExists) {
          // 新規作成
          const canonicalSql = `
            INSERT INTO subsidy_canonical (
              id, name, name_normalized, issuer_code, issuer_name, prefecture_code,
              latest_cache_id, first_seen_at, is_active, created_at, updated_at
            ) VALUES (
              ${sqlValue(canonicalId)}, ${sqlValue(row.title)}, ${sqlValue(normalizedTitle)},
              ${sqlValue(issuerCode)}, ${sqlValue(issuerName)}, ${sqlValue(prefCode)},
              ${sqlValue(row.id)}, datetime('now'), 1, datetime('now'), datetime('now')
            )
          `;
          
          if (!args.dryRun) {
            const result = db.execute(canonicalSql);
            if (!result.success) {
              handleError(result.error, { cache_id: row.id, action: 'canonical_create' });
              continue;
            }
          }
          
          canonicalCreated++;
        } else {
          // 既存のcanonicalを更新（latest_cache_idのみ）
          if (!args.dryRun) {
            db.execute(`
              UPDATE subsidy_canonical 
              SET latest_cache_id = ${sqlValue(row.id)},
                  last_updated_at = datetime('now'),
                  updated_at = datetime('now')
              WHERE id = ${sqlValue(canonicalId)}
            `);
          }
          
          canonicalExisting++;
        }
        
        // Step 2: source_link作成
        const existingLink = db.query(`SELECT id FROM subsidy_source_link WHERE source_type = 'jgrants' AND source_id = ${sqlValue(row.id)}`);
        const linkExists = existingLink.success && existingLink.rows.length > 0;
        
        if (!linkExists) {
          const linkSql = `
            INSERT INTO subsidy_source_link (
              id, canonical_id, source_type, source_id, match_type, match_score, verified, created_at
            ) VALUES (
              ${sqlValue(linkId)}, ${sqlValue(canonicalId)}, 'jgrants', ${sqlValue(row.id)},
              'system', 1.0, 1, datetime('now')
            )
          `;
          
          if (!args.dryRun) {
            const result = db.execute(linkSql);
            if (!result.success) {
              handleError(result.error, { cache_id: row.id, action: 'link_create' });
              continue;
            }
          }
          
          linksCreated++;
        }
        
        // Step 3: subsidy_cache.canonical_id更新
        if (!args.dryRun) {
          const updateResult = db.execute(`
            UPDATE subsidy_cache SET canonical_id = ${sqlValue(canonicalId)} WHERE id = ${sqlValue(row.id)}
          `);
          
          if (updateResult.success) {
            cacheUpdated++;
          }
        } else {
          cacheUpdated++;
        }
        
        updateStats({ 
          processed: stats.processed + 1,
          last_processed_id: row.id
        });
        
        // 進捗表示
        if (processed % 50 === 0) {
          logger.progress(processed, totalCount, { lastId: row.id });
          saveCheckpoint();
        }
        
      } catch (error) {
        handleError(error, { cache_id: row.id });
      }
      
      lastCacheId = row.id;
    }
  }
  
  // 最終統計
  updateStats({
    jgrants_rows_read: processed,
    canonical_created: canonicalCreated,
    canonical_existing: canonicalExisting,
    links_created: linksCreated,
    cache_updated_with_canonical_id: cacheUpdated
  });
  
  console.log('');
  logger.info('Backfill completed', {
    jgrants_rows_read: processed,
    canonical_created: canonicalCreated,
    canonical_existing: canonicalExisting,
    links_created: linksCreated,
    cache_updated_with_canonical_id: cacheUpdated
  });
  
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

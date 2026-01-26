/**
 * JGrants バッチエンリッチメントスクリプト
 * 
 * V2 APIから詳細情報を取得し、本番DBを更新する
 * 
 * 使用方法:
 *   node scripts/batch-enrich-jgrants.mjs
 */

import { execSync } from 'child_process';

const JGRANTS_V2_API = 'https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id';

// 対象IDリスト
const TARGET_IDS = [
  'a0WJ200000CDQEJMA5',
  'a0WJ200000CDX4vMAH',
  'a0WJ200000CDVkeMAH',
  'a0WJ200000CDPyeMAH',
  'a0W2x000007Cos5EAC',
  'a0WJ200000CDTzMMAX',
  'a0WJ200000CDPbMMAX',
  'a0WJ200000CDWemMAH',
  'a0WJ200000CDUGBMA5',
  'a0WJ200000CDUg2MAH',
];

/**
 * HTML からテキストを抽出
 */
function htmlToText(html, maxLength = 3000) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

/**
 * HTML から PDF リンクを抽出
 */
function extractPdfLinks(html) {
  if (!html) return [];
  const urls = [];
  const pattern = /https?:\/\/[^\s"'<>]+\.pdf/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    if (!urls.includes(match[0])) {
      urls.push(match[0]);
    }
  }
  return urls;
}

/**
 * V2 API から詳細情報を取得
 */
async function fetchSubsidyDetail(id) {
  const response = await fetch(`${JGRANTS_V2_API}/${id}`, {
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  const subsidy = data.result?.[0] || data.result || data;
  
  if (!subsidy) {
    throw new Error('No result in response');
  }
  
  return subsidy;
}

/**
 * detail_json を構築
 */
function buildDetailJson(subsidy) {
  const detailJson = {
    enriched_at: new Date().toISOString(),
    enriched_version: 'v2',
    api_version: 'v2',
  };
  
  // Overview
  if (subsidy.detail) {
    detailJson.overview = htmlToText(subsidy.detail, 3000);
  }
  
  // Basic info
  if (subsidy.subsidy_catch_phrase) {
    detailJson.catch_phrase = subsidy.subsidy_catch_phrase;
  }
  if (subsidy.use_purpose) {
    detailJson.use_purpose = subsidy.use_purpose;
  }
  if (subsidy.industry) {
    detailJson.target_industry = subsidy.industry;
  }
  if (subsidy.target_number_of_employees) {
    detailJson.target_employees = subsidy.target_number_of_employees;
  }
  if (subsidy.subsidy_rate) {
    detailJson.subsidy_rate = subsidy.subsidy_rate;
  }
  if (subsidy.subsidy_max_limit) {
    detailJson.subsidy_max_limit = subsidy.subsidy_max_limit;
  }
  if (subsidy.granttype) {
    detailJson.grant_type = subsidy.granttype;
  }
  if (subsidy.front_subsidy_detail_page_url) {
    detailJson.related_url = subsidy.front_subsidy_detail_page_url;
  }
  
  // Workflows
  if (subsidy.workflow && Array.isArray(subsidy.workflow) && subsidy.workflow.length > 0) {
    detailJson.workflows = subsidy.workflow.map(w => ({
      id: w.id,
      target_area: w.target_area_search,
      acceptance_start: w.acceptance_start_datetime,
      acceptance_end: w.acceptance_end_datetime,
      project_end: w.project_end_deadline,
    }));
  }
  
  // PDF URLs
  if (subsidy.detail) {
    const pdfUrls = extractPdfLinks(subsidy.detail);
    if (pdfUrls.length > 0) {
      detailJson.pdf_urls = pdfUrls;
    }
  }
  
  return detailJson;
}

// Note: DB更新はSQL出力のみ（手動実行用）

/**
 * メイン処理
 */
async function main() {
  console.log('='.repeat(60));
  console.log('JGrants Batch Enrichment Script (V2 API)');
  console.log('='.repeat(60));
  console.log(`Targets: ${TARGET_IDS.length} subsidies`);
  console.log('');
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (const id of TARGET_IDS) {
    console.log(`Processing: ${id}`);
    
    try {
      // V2 API から取得
      const subsidy = await fetchSubsidyDetail(id);
      console.log(`  Title: ${subsidy.title?.substring(0, 50)}...`);
      
      // detail_json 構築
      const detailJson = buildDetailJson(subsidy);
      const pdfCount = detailJson.pdf_urls?.length || 0;
      console.log(`  Detail length: ${detailJson.overview?.length || 0} chars`);
      console.log(`  PDF URLs: ${pdfCount}`);
      
      // 結果を保存（後で一括更新）
      results.push({ id, detailJson, title: subsidy.title });
      successCount++;
      
      // レート制限
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      errorCount++;
    }
  }
  
  console.log('');
  console.log('-'.repeat(60));
  console.log(`Fetched: ${successCount} success, ${errorCount} errors`);
  console.log('');
  
  // 結果を出力
  console.log('Results (copy to execute manually):');
  console.log('');
  
  for (const { id, detailJson } of results) {
    const jsonStr = JSON.stringify(detailJson).replace(/'/g, "''");
    console.log(`-- ${id}`);
    console.log(`UPDATE subsidy_cache SET detail_json = '${jsonStr}', cached_at = datetime('now') WHERE id = '${id}';`);
    console.log('');
  }
}

main().catch(console.error);

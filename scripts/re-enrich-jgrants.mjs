#!/usr/bin/env node
/**
 * jGrants 再エンリッチスクリプト
 * 
 * 既にv2エンリッチ済みだが eligible_expenses が欠けている補助金を再処理
 * overviewテキストから申請要件/対象経費/対象者を簡易抽出
 */

const API_BASE = process.env.API_BASE || 'https://hojyokin.pages.dev';
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret-2026';
const LIMIT = parseInt(process.env.LIMIT || '50', 10);

const JGRANTS_DETAIL_API_V2 = 'https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id';

// ===== ヘルパー関数 =====

function htmlToText(html, maxLength = 3000) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
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

function extractFieldsFromOverview(overviewText) {
  const result = {};
  
  const sections = overviewText.split(/[■◆●▼【]/);
  
  for (const section of sections) {
    const sectionText = section.trim();
    const lowerSection = sectionText.substring(0, 30).toLowerCase();
    
    // 対象者・対象事業者
    if (lowerSection.includes('対象者') || lowerSection.includes('対象事業者') || lowerSection.includes('申請対象')) {
      const content = sectionText.replace(/^[^】]*】?/, '').trim();
      const items = content.split(/[・、\n]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 100);
      if (items.length > 0) {
        result.target_businesses = items.slice(0, 10);
      }
    }
    
    // 申請要件・補助要件
    if (lowerSection.includes('申請要件') || lowerSection.includes('補助要件') || lowerSection.includes('交付要件')) {
      const content = sectionText.replace(/^[^】]*】?/, '').trim();
      const items = content.split(/[・、\n]/).map(s => s.trim()).filter(s => s.length > 5 && s.length < 200);
      if (items.length > 0) {
        result.application_requirements = items.slice(0, 10);
      }
    }
    
    // 対象経費・補助対象経費
    if (lowerSection.includes('対象経費') || lowerSection.includes('補助対象') || lowerSection.includes('助成対象経費')) {
      const content = sectionText.replace(/^[^】]*】?/, '').trim();
      const items = content.split(/[・、\n]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 100);
      if (items.length > 0) {
        result.eligible_expenses = items.slice(0, 10);
      }
    }
    
    // 支援内容（対象経費の代替）
    if (lowerSection.includes('支援内容') || lowerSection.includes('補助内容') || lowerSection.includes('助成内容')) {
      const content = sectionText.replace(/^[^】]*】?/, '').trim();
      const items = content.split(/[・、\n]/).map(s => s.trim()).filter(s => s.length > 5 && s.length < 200);
      if (items.length > 0 && !result.eligible_expenses) {
        result.eligible_expenses = items.slice(0, 10);
      }
    }
  }
  
  return result;
}

function extractReferenceUrls(html) {
  const refUrls = [];
  const hrefPattern = /href=["'](https?:\/\/[^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('jgrants-portal.go.jp') && 
        !url.includes('javascript:') &&
        !url.includes('#')) {
      const cleanUrl = url.replace(/\\+$/, '').replace(/\\/g, '');
      if (!refUrls.includes(cleanUrl)) {
        refUrls.push(cleanUrl);
      }
    }
  }
  return refUrls;
}

// ===== メイン処理 =====

async function main() {
  console.log(`[Re-Enrich] Starting re-enrichment of jGrants subsidies`);
  console.log(`[Re-Enrich] API_BASE: ${API_BASE}, LIMIT: ${LIMIT}`);
  
  // Step 1: 対象補助金を取得（既にv2エンリッチ済みだがeligible_expensesがない）
  const listResponse = await fetch(`${API_BASE}/api/admin-ops/subsidies/list?source=jgrants&limit=500`, {
    headers: {
      'Accept': 'application/json',
      'X-Internal-Token': CRON_SECRET,
    },
  });
  
  if (!listResponse.ok) {
    // 直接DB問い合わせが難しいので、admin-opsから取得を試みる
    console.log('[Re-Enrich] Admin-ops endpoint not available, trying alternative...');
    
    // 代替: enrich-jgrantsを呼んで新規エンリッチを試みる
    const enrichResponse = await fetch(`${API_BASE}/api/cron/enrich-jgrants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
    });
    
    const enrichData = await enrichResponse.json();
    console.log('[Re-Enrich] Enrich-JGrants result:', JSON.stringify(enrichData, null, 2));
    return;
  }
  
  const listData = await listResponse.json();
  console.log(`[Re-Enrich] Found ${listData.data?.length || 0} subsidies`);
  
  // Step 2: eligible_expensesがない、またはapplication_requirementsがないものをフィルタ
  const targets = (listData.data || []).filter(s => {
    const detail = s.detail_json ? JSON.parse(s.detail_json) : {};
    const hasEligible = detail.eligible_expenses && Array.isArray(detail.eligible_expenses) && detail.eligible_expenses.length > 0;
    const hasReqs = detail.application_requirements && Array.isArray(detail.application_requirements) && detail.application_requirements.length > 0;
    return detail.enriched_version === 'v2' && (!hasEligible || !hasReqs);
  }).slice(0, LIMIT);
  
  console.log(`[Re-Enrich] Found ${targets.length} subsidies needing re-enrichment`);
  
  let updated = 0;
  let errors = [];
  
  for (const target of targets) {
    try {
      console.log(`[Re-Enrich] Processing: ${target.id} - ${target.title?.substring(0, 40)}`);
      
      // V2 API から詳細取得
      const response = await fetch(`${JGRANTS_DETAIL_API_V2}/${target.id}`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) {
        errors.push(`${target.id}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const subsidy = data.result?.[0] || data.result || data;
      
      if (!subsidy || !subsidy.detail) {
        errors.push(`${target.id}: No detail in response`);
        continue;
      }
      
      // overviewから抽出
      const overview = htmlToText(subsidy.detail, 3000);
      const extractedFields = extractFieldsFromOverview(overview);
      
      // 参照URLを抽出
      const refUrls = extractReferenceUrls(subsidy.detail);
      
      // 更新データ作成
      const updatePayload = {
        id: target.id,
        updates: {
          ...extractedFields,
          ...(refUrls.length > 0 ? { reference_urls: refUrls } : {}),
          re_enriched_at: new Date().toISOString(),
        }
      };
      
      if (Object.keys(extractedFields).length > 0 || refUrls.length > 0) {
        // admin-opsで更新
        const updateResponse = await fetch(`${API_BASE}/api/admin-ops/subsidy-cache/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': CRON_SECRET,
          },
          body: JSON.stringify(updatePayload),
        });
        
        if (updateResponse.ok) {
          updated++;
          console.log(`[Re-Enrich] Updated ${target.id}: ${JSON.stringify(extractedFields)}`);
        } else {
          errors.push(`${target.id}: Update failed - ${updateResponse.status}`);
        }
      } else {
        console.log(`[Re-Enrich] No new fields extracted for ${target.id}`);
      }
      
      // レート制限
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (err) {
      errors.push(`${target.id}: ${err.message}`);
    }
  }
  
  console.log(`\n[Re-Enrich] Complete: updated=${updated}, errors=${errors.length}`);
  if (errors.length > 0) {
    console.log('[Re-Enrich] Errors:', errors.slice(0, 10));
  }
}

main().catch(console.error);

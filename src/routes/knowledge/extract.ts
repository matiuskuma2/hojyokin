/**
 * Knowledge Pipeline - Firecrawl Extract API
 * 
 * POST /extract/:url_id - Firecrawl Extract → 構造化JSON
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { sha256Short, saveStructuredToR2 } from './_helpers';
import type { R2SaveResult, ExtractSchemaV1 } from './_helpers';

const extract = new Hono<{ Bindings: Env; Variables: Variables }>();

extract.post('/extract/:url_id', requireAuth, async (c) => {
  const { url_id } = c.req.param();
  const { DB, R2_KNOWLEDGE, FIRECRAWL_API_KEY } = c.env;

  if (!FIRECRAWL_API_KEY) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'FIRECRAWL_API_KEY not configured' }
    }, 500);
  }

  try {
    // source_url情報取得
    const sourceUrl = await DB.prepare(`
      SELECT su.*, do.r2_key_raw, do.word_count
      FROM source_url su
      LEFT JOIN doc_object do ON su.url_id = do.url_id
      WHERE su.url_id = ?
    `).bind(url_id).first<SourceUrl & { r2_key_raw?: string; word_count?: number }>();

    if (!sourceUrl) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Source URL not found' }
      }, 404);
    }

    if (sourceUrl.status !== 'ok') {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NOT_CRAWLED', message: 'URL has not been crawled yet. Use /crawl/:url_id first.' }
      }, 400);
    }

    // R2からMarkdownを取得
    let markdown: string | null = null;
    if (R2_KNOWLEDGE && sourceUrl.r2_key_raw) {
      const obj = await R2_KNOWLEDGE.get(sourceUrl.r2_key_raw);
      if (obj) {
        markdown = await obj.text();
      }
    }

    if (!markdown || markdown.length < 100) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'NO_CONTENT', message: 'No markdown content available or content too short' }
      }, 400);
    }

    // Firecrawl Extractを使用（または直接LLM呼び出し）
    // Note: Firecrawl Extractが使えない場合はOpenAI APIを直接呼ぶ
    const extractResult = await callFirecrawlExtract(
      sourceUrl.url,
      markdown,
      FIRECRAWL_API_KEY
    );

    if (!extractResult.success) {
      // Extract失敗時
      await DB.prepare(`
        UPDATE source_url SET status = 'needs_review', updated_at = datetime('now')
        WHERE url_id = ?
      `).bind(url_id).run();

      return c.json<ApiResponse<null>>({
        success: false,
        error: { code: 'EXTRACT_ERROR', message: extractResult.error || 'Extraction failed' }
      }, 500);
    }

    const structured = extractResult.data as ExtractSchemaV1;

    // 必須フィールドチェック
    const warnings: string[] = [];
    let needsReview = false;

    if (!structured.summary?.title) {
      warnings.push('タイトルが抽出できませんでした');
      needsReview = true;
    }
    if (!structured.funding?.subsidy_rate) {
      warnings.push('補助率が抽出できませんでした');
    }
    if (!structured.required_documents || structured.required_documents.length < 3) {
      warnings.push('必要書類が十分に抽出できませんでした');
      needsReview = true;
    }

    structured.quality = structured.quality || { confidence: 0.5, warnings: [], needs_human_review: false };
    structured.quality.warnings = [...(structured.quality.warnings || []), ...warnings];
    structured.quality.needs_human_review = structured.quality.needs_human_review || needsReview;

    // R2に保存
    const urlHash = await sha256Short(sourceUrl.url);
    let r2StructuredResult: R2SaveResult | null = null;

    if (R2_KNOWLEDGE) {
      try {
        r2StructuredResult = await saveStructuredToR2(
          R2_KNOWLEDGE,
          sourceUrl.subsidy_id,
          urlHash,
          structured
        );
      } catch (r2Error) {
        console.error('R2 save error for structured:', r2Error);
      }
    }

    // doc_objectを更新
    await DB.prepare(`
      UPDATE doc_object SET
        r2_key_structured = ?,
        r2_structured_size = ?,
        needs_review = ?,
        confidence = ?,
        updated_at = datetime('now')
      WHERE url_id = ?
    `).bind(
      r2StructuredResult?.key || null,
      r2StructuredResult?.size || null,
      needsReview ? 1 : 0,
      structured.quality?.confidence || 0.5,
      url_id
    ).run();

    // 必要書類をrequired_documents_by_subsidyに反映
    if (structured.required_documents && structured.required_documents.length > 0) {
      for (const doc of structured.required_documents) {
        const docCode = doc.doc_code_guess || guessDocCode(doc.name);
        if (docCode) {
          const docId = crypto.randomUUID();
          await DB.prepare(`
            INSERT INTO required_documents_by_subsidy (
              id, subsidy_id, doc_code, required_level, notes,
              source_url, source_quote, confidence, needs_review
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(subsidy_id, doc_code) DO UPDATE SET
              required_level = excluded.required_level,
              notes = COALESCE(excluded.notes, notes),
              source_quote = COALESCE(excluded.source_quote, source_quote),
              confidence = CASE WHEN excluded.confidence > confidence THEN excluded.confidence ELSE confidence END,
              updated_at = datetime('now')
          `).bind(
            docId,
            sourceUrl.subsidy_id,
            docCode,
            doc.required_level || 'conditional',
            doc.notes || null,
            sourceUrl.url,
            doc.source_quote || null,
            0.6,  // 自動抽出の基本確信度
            1     // 要レビュー
          ).run();
        }
      }
    }

    // budget_close_signalsがあればlifecycleを更新
    if (structured.budget_close_signals && structured.budget_close_signals.length > 0) {
      const signal = structured.budget_close_signals[0];
      const newStatus = signal.signal === 'budget_cap_reached' || signal.signal === 'quota_reached' 
        ? 'closed_by_budget' 
        : (signal.signal === 'early_close' ? 'closed_by_budget' : 'closing_soon');

      await DB.prepare(`
        INSERT INTO subsidy_lifecycle (
          subsidy_id, status, close_reason, budget_close_evidence_url,
          budget_close_evidence_quote, last_checked_at, next_check_at,
          check_frequency, priority, updated_at, created_at
        ) VALUES (?, ?, 'budget', ?, ?, datetime('now'), ?, 'daily', 2, datetime('now'), datetime('now'))
        ON CONFLICT(subsidy_id) DO UPDATE SET
          status = CASE WHEN excluded.status IN ('closed_by_budget', 'closing_soon') THEN excluded.status ELSE status END,
          close_reason = CASE WHEN excluded.status IN ('closed_by_budget') THEN 'budget' ELSE close_reason END,
          budget_close_evidence_url = excluded.budget_close_evidence_url,
          budget_close_evidence_quote = excluded.budget_close_evidence_quote,
          last_checked_at = datetime('now'),
          updated_at = datetime('now')
      `).bind(
        sourceUrl.subsidy_id,
        newStatus,
        sourceUrl.url,
        signal.quote,
        computeNextCheckAt(newStatus, 2)
      ).run();
    }

    return c.json<ApiResponse<{
      url_id: string;
      subsidy_id: string;
      structured_key: string | null;
      quality: { confidence: number; warnings: string[]; needs_review: boolean };
      documents_extracted: number;
      budget_signals: number;
    }>>({
      success: true,
      data: {
        url_id,
        subsidy_id: sourceUrl.subsidy_id,
        structured_key: r2StructuredResult?.key || null,
        quality: {
          confidence: structured.quality?.confidence || 0.5,
          warnings: structured.quality?.warnings || [],
          needs_review: needsReview
        },
        documents_extracted: structured.required_documents?.length || 0,
        budget_signals: structured.budget_close_signals?.length || 0
      }
    });
  } catch (error) {
    console.error('Extract error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'EXTRACT_ERROR', message: String(error) }
    }, 500);
  }
});

/**
 * Firecrawl Extract API呼び出し（または代替LLM呼び出し）
 */
async function callFirecrawlExtract(
  url: string,
  markdown: string,
  apiKey: string
): Promise<{ success: boolean; data?: ExtractSchemaV1; error?: string }> {
  try {
    // Firecrawl Extract API v2を呼び出し
    // v2では url → urls (配列) に変更、エンドポイントも /v2/extract
    
    const response = await fetch('https://api.firecrawl.dev/v2/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        urls: [url], // v2は配列で指定
        prompt: EXTRACT_PROMPT,
        schema: {
          type: 'object',
          properties: {
            schema_version: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '補助金/制度のタイトル' },
                one_liner: { type: 'string', description: '30-60字の概要説明' },
                what_it_supports: { type: 'string', description: '何を支援するのか' }
              },
              required: ['title']
            },
            eligibility: {
              type: 'object',
              properties: {
                who_can_apply: { type: 'array', items: { type: 'string' }, description: '申請可能な対象者' },
                area: { type: 'object', properties: { scope: { type: 'string' }, detail: { type: 'string' } } },
                industry: { type: 'object', properties: { allowed: { type: 'array', items: { type: 'string' } } } },
                company_size: { type: 'object', properties: { employee_limit: { type: 'string' } } },
                disqualifiers: { type: 'array', items: { type: 'string' }, description: '不適格条件' }
              }
            },
            funding: {
              type: 'object',
              properties: {
                subsidy_rate: { type: 'string', description: '補助率（例: 1/2, 2/3）' },
                limit_amount: { type: 'object', properties: { max: { type: 'string' }, min: { type: 'string' } } },
                eligible_costs: { type: 'array', items: { type: 'string' }, description: '対象経費' },
                ineligible_costs: { type: 'array', items: { type: 'string' }, description: '対象外経費' }
              }
            },
            deadlines: {
              type: 'object',
              properties: {
                application_window: {
                  type: 'object',
                  properties: { start: { type: 'string' }, end: { type: 'string' } }
                },
                notes: { type: 'string', description: '締切に関する注意事項' }
              }
            },
            required_documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  required_level: { type: 'string', enum: ['mandatory', 'conditional', 'optional'] },
                  doc_code_guess: { type: 'string' },
                  source_quote: { type: 'string' }
                },
                required: ['name']
              },
              description: '必要書類リスト'
            },
            budget_close_signals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  signal: { type: 'string', enum: ['budget_cap_reached', 'quota_reached', 'first_come_end', 'early_close'] },
                  quote: { type: 'string' }
                }
              },
              description: '予算枯渇/早期終了シグナル'
            },
            status_hint: { type: 'string', enum: ['open', 'closing_soon', 'closed', 'unknown'] },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  quote: { type: 'string' },
                  source_section: { type: 'string' }
                }
              },
              description: '抽出根拠の引用'
            },
            quality: {
              type: 'object',
              properties: {
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                warnings: { type: 'array', items: { type: 'string' } },
                needs_human_review: { type: 'boolean' }
              }
            }
          },
          required: ['summary']
        },
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 30000
        },
        showSources: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl Extract API v2 error:', response.status, errorText);
      
      // Firecrawl Extractが失敗した場合、簡易パースにフォールバック
      return createFallbackExtract(url, markdown);
    }

    const result = await response.json() as { 
      success: boolean; 
      data?: ExtractSchemaV1 | Record<string, unknown>; 
      error?: string;
      sources?: string[];
    };
    
    console.log('Firecrawl Extract v2 initial response:', JSON.stringify(result).substring(0, 500));
    
    // v2 Extract は非同期 - id が返ってきたらポーリングで結果取得
    if (result.success && result.id) {
      // ポーリングで結果取得（最大60秒）
      const extractedData = await pollFirecrawlExtract(result.id, apiKey);
      if (extractedData) {
        return normalizeExtractedData(url, extractedData);
      }
      // ポーリング失敗時はフォールバック
      return createFallbackExtract(url, markdown);
    }
    
    // 直接データが返ってきた場合（同期レスポンス）
    if (result.success && result.data) {
      return normalizeExtractedData(url, result.data);
    }

    // 失敗時はフォールバック
    return createFallbackExtract(url, markdown);
  } catch (error) {
    console.error('Firecrawl Extract v2 call error:', error);
    return createFallbackExtract(url, markdown);
  }
}

/**
 * Firecrawl Extract v2 ポーリング（非同期ジョブ結果取得）
 */
async function pollFirecrawlExtract(
  jobId: string,
  apiKey: string,
  maxWaitMs: number = 60000,
  intervalMs: number = 3000
): Promise<ExtractSchemaV1 | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`https://api.firecrawl.dev/v2/extract/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        console.error('Firecrawl poll error:', response.status);
        return null;
      }
      
      const result = await response.json() as {
        success: boolean;
        status?: string;
        data?: ExtractSchemaV1 | Record<string, unknown>;
        error?: string;
      };
      
      console.log('Firecrawl poll status:', result.status, 'elapsed:', Date.now() - startTime, 'ms');
      
      if (result.status === 'completed' && result.data) {
        return result.data as ExtractSchemaV1;
      }
      
      if (result.status === 'failed' || result.status === 'cancelled') {
        console.error('Firecrawl job failed:', result.error);
        return null;
      }
      
      // processing中は待機
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error('Firecrawl poll exception:', error);
      return null;
    }
  }
  
  console.warn('Firecrawl poll timeout after', maxWaitMs, 'ms');
  return null;
}

/**
 * 抽出データの正規化
 */
function normalizeExtractedData(
  url: string,
  rawData: ExtractSchemaV1 | Record<string, unknown>
): { success: boolean; data: ExtractSchemaV1 } {
  const extracted = rawData as ExtractSchemaV1;
  extracted.schema_version = 'v1';
  extracted.source = extracted.source || {
    url,
    retrieved_at: new Date().toISOString(),
    source_type: 'other'
  };
  
  // quality フィールドの確保
  if (!extracted.quality) {
    extracted.quality = {
      confidence: 0.7,
      warnings: [],
      needs_human_review: false
    };
  }
  
  // 重要項目の検証
  const warnings: string[] = extracted.quality.warnings || [];
  
  if (!extracted.funding?.subsidy_rate) {
    warnings.push('補助率が抽出できませんでした');
  }
  if (!extracted.required_documents || extracted.required_documents.length === 0) {
    warnings.push('必要書類が抽出できませんでした');
  }
  if (!extracted.deadlines?.application_window?.end) {
    warnings.push('申請締切が抽出できませんでした');
  }
  
  extracted.quality.warnings = warnings;
  extracted.quality.needs_human_review = warnings.length > 0 || (extracted.quality.confidence || 0) < 0.6;
  
  return { success: true, data: extracted };
}

/**
 * フォールバック: 簡易パースで最低限の構造を作成
 * markdownから可能な限りの情報を抽出
 */
function createFallbackExtract(url: string, markdown: string): { success: boolean; data: ExtractSchemaV1 } {
  const warnings: string[] = ['フォールバックパースを使用'];
  
  // タイトル抽出（最初のH1またはH2）
  const titleMatch = markdown.match(/^#+ (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'タイトル不明';

  // 補助率抽出
  let subsidyRate = '';
  const ratePatterns = [
    /補助率[：:\s]*([0-9\/]+)/,
    /([0-9]+\/[0-9]+)[以内\s]*補助/,
    /([0-9]+)%[以内\s]*補助/,
    /補助[率割].*?([0-9]+\/[0-9]+|[0-9]+%)/
  ];
  for (const pattern of ratePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      subsidyRate = match[1];
      break;
    }
  }
  if (!subsidyRate) warnings.push('補助率が抽出できませんでした');

  // 補助上限額抽出
  let maxAmount = '';
  const amountPatterns = [
    /上限[：:\s]*([0-9,，]+)万?円/,
    /最大[：:\s]*([0-9,，]+)万?円/,
    /([0-9,，]+)万?円[以内\s]*を上限/,
    /補助金額.*?([0-9,，]+)万?円/
  ];
  for (const pattern of amountPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      maxAmount = match[1].replace(/[,，]/g, '') + '円';
      break;
    }
  }

  // 申請期限抽出
  let deadline = '';
  const deadlinePatterns = [
    /申請[締期]限[：:\s]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/,
    /([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)[まで\s]*[締申]/,
    /締切.*?([0-9]{4}[年\/\-][0-9]{1,2}[月\/\-][0-9]{1,2}日?)/,
    /([0-9]{1,2}月[0-9]{1,2}日)[まで\s]*に申請/
  ];
  for (const pattern of deadlinePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      deadline = match[1];
      break;
    }
  }
  if (!deadline) warnings.push('申請締切が抽出できませんでした');

  // 必要書類抽出
  const requiredDocs: ExtractSchemaV1['required_documents'] = [];
  const docPatterns = [
    { regex: /申請書|様式[0-9０-９]+/g, name: '申請書' },
    { regex: /事業計画書/g, name: '事業計画書' },
    { regex: /見積書/g, name: '見積書' },
    { regex: /登記簿[謄抄]本|履歴事項全部証明書/g, name: '登記事項証明書' },
    { regex: /決算書|財務諸表/g, name: '決算書' },
    { regex: /納税証明書/g, name: '納税証明書' },
    { regex: /確定申告書/g, name: '確定申告書' },
    { regex: /gビズ|GビズID|gbizid/gi, name: 'GビズIDアカウント' }
  ];
  
  const foundDocs = new Set<string>();
  for (const { regex, name } of docPatterns) {
    if (regex.test(markdown) && !foundDocs.has(name)) {
      foundDocs.add(name);
      requiredDocs.push({
        name,
        required_level: 'mandatory' as const,
        doc_code_guess: guessDocCode(name) || undefined,
        source_quote: ''
      });
    }
  }
  if (requiredDocs.length === 0) warnings.push('必要書類が抽出できませんでした');

  // 予算枯渇シグナル検知
  const budgetSignals: ExtractSchemaV1['budget_close_signals'] = [];
  const budgetPatterns = [
    { pattern: /予算上限に達し次第.{0,20}終了/g, signal: 'budget_cap_reached' as const },
    { pattern: /予算がなくなり次第.{0,20}終了/g, signal: 'budget_cap_reached' as const },
    { pattern: /予算の範囲内.{0,20}先着順/g, signal: 'first_come_end' as const },
    { pattern: /先着順/g, signal: 'first_come_end' as const },
    { pattern: /予定件数に達し/g, signal: 'quota_reached' as const },
    { pattern: /早期終了/g, signal: 'early_close' as const }
  ];

  for (const { pattern, signal } of budgetPatterns) {
    const matches = markdown.match(pattern);
    if (matches) {
      budgetSignals.push({
        signal,
        quote: matches[0].substring(0, 80)
      });
    }
  }

  // 対象者抽出
  const whoCanApply: string[] = [];
  const eligibilityPatterns = [
    /対象[者事業]?[：:\s]*(中小企業|小規模事業者|個人事業主|法人)/g,
    /(中小企業|小規模事業者|個人事業主)[等がの]/g
  ];
  for (const pattern of eligibilityPatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !whoCanApply.includes(match[1])) {
        whoCanApply.push(match[1]);
      }
    }
  }

  const confidence = 0.3 + 
    (subsidyRate ? 0.15 : 0) + 
    (deadline ? 0.15 : 0) + 
    (requiredDocs.length > 0 ? 0.1 : 0) +
    (whoCanApply.length > 0 ? 0.1 : 0);

  return {
    success: true,
    data: {
      schema_version: 'v1',
      source: {
        url,
        retrieved_at: new Date().toISOString(),
        source_type: 'other'
      },
      summary: {
        title,
        one_liner: '',
        what_it_supports: ''
      },
      eligibility: {
        who_can_apply: whoCanApply,
        area: { scope: '' },
        industry: { allowed: [] },
        company_size: { employee_limit: '' }
      },
      funding: {
        subsidy_rate: subsidyRate,
        limit_amount: { max: maxAmount },
        eligible_costs: []
      },
      deadlines: {
        application_window: deadline ? { end: deadline } : {}
      },
      required_documents: requiredDocs,
      budget_close_signals: budgetSignals,
      status_hint: 'unknown',
      quality: {
        confidence: Math.min(confidence, 0.7),
        warnings,
        needs_human_review: true
      }
    }
  };
}



export default extract;

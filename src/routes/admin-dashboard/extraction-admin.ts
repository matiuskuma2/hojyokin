/**
 * Admin Dashboard: 抽出・エンリッチメント管理
 * 
 * POST /extract-forms                - フォーム抽出
 * POST /jgrants/enrich-detail        - JGrants詳細エンリッチ
 * POST /tokyo-shigoto/enrich-detail  - 東京しごと財団詳細エンリッチ
 * GET /extraction-logs               - 抽出ログ
 * GET /extraction-summary            - 抽出サマリー
 * GET /extraction-queue/summary      - キューサマリー
 * POST /extraction-queue/enqueue     - キュー投入
 * POST /extraction-queue/consume     - キュー消化
 * POST /extraction-queue/retry-failed - 失敗再試行
 * DELETE /extraction-queue/clear-done - 完了クリア
 */

import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { requireAuth, requireAdmin, getCurrentUser } from '../../middleware/auth';
import { logOpenAICost } from '../../lib/cost/cost-logger';

const extractionAdmin = new Hono<{ Bindings: Env; Variables: Variables }>();

extractionAdmin.post('/extract-forms', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  // super_admin限定
  if (user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Super admin access required',
      },
    }, 403);
  }

  try {
    const body = await c.req.json<{ subsidy_id?: string; limit?: number }>();
    const limit = Math.min(body.limit || 3, 5); // 最大5件

    // 抽出対象を取得
    let targets;
    if (body.subsidy_id) {
      targets = await db.prepare(`
        SELECT 
          id,
          source,
          title,
          detail_json,
          json_extract(detail_json, '$.pdfUrls') AS pdf_urls,
          json_extract(detail_json, '$.required_forms') AS existing_forms,
          json_extract(detail_json, '$.pdfHashes') AS pdf_hashes
        FROM subsidy_cache
        WHERE id = ?
      `).bind(body.subsidy_id).all();
    } else {
      targets = await db.prepare(`
        SELECT 
          id,
          source,
          title,
          detail_json,
          json_extract(detail_json, '$.pdfUrls') AS pdf_urls,
          json_extract(detail_json, '$.required_forms') AS existing_forms,
          json_extract(detail_json, '$.pdfHashes') AS pdf_hashes
        FROM subsidy_cache
        WHERE
          json_extract(detail_json, '$.pdfUrls') IS NOT NULL
          AND json_array_length(json_extract(detail_json, '$.pdfUrls')) > 0
          AND (
            json_extract(detail_json, '$.required_forms') IS NULL
            OR json_array_length(json_extract(detail_json, '$.required_forms')) = 0
          )
          AND source IN ('tokyo-kosha', 'tokyo-shigoto', 'tokyo-hataraku')
        ORDER BY cached_at DESC
        LIMIT ?
      `).bind(limit).all();
    }

    const results: Array<{
      id: string;
      title: string;
      pdf_count: number;
      forms_extracted: number;
      errors: string[];
    }> = [];

    for (const target of (targets.results || []) as any[]) {
      const pdfUrls: string[] = target.pdf_urls ? JSON.parse(target.pdf_urls) : [];
      const detailJson = target.detail_json ? JSON.parse(target.detail_json) : {};
      const detailUrl = detailJson.detailUrl || '';
      
      // 簡易的にHTMLページからテキストを取得して様式抽出
      const forms: Array<{ name: string; fields: string[] }> = [];
      const errors: string[] = [];

      // まずdetailUrlからHTML抽出を試みる
      const urlsToTry = detailUrl ? [detailUrl, ...pdfUrls] : pdfUrls;

      if (urlsToTry.length === 0) {
        results.push({
          id: target.id,
          title: target.title,
          pdf_count: 0,
          forms_extracted: 0,
          errors: ['No URLs to extract from'],
        });
        continue;
      }

      for (const url of urlsToTry) {
        try {
          // URLを取得
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
              'Accept': 'text/html, application/pdf, */*',
            },
          });

          if (!response.ok) {
            errors.push(`HTTP ${response.status} for ${url}`);
            continue;
          }

          const contentType = response.headers.get('content-type') || '';
          let text = '';

          if (contentType.includes('html') || url.endsWith('.html')) {
            const html = await response.text();
            text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
          } else if (contentType.includes('pdf')) {
            // PDFバイナリは簡易抽出を試みる
            errors.push(`PDF binary: ${url} (limited extraction)`);
            continue;
          } else {
            text = await response.text();
          }

          // 様式名を抽出
          const formPatterns = [
            /様式[第]?[\s]*([0-9０-９一二三四五六七八九十]+)[号]?(?:[-－]([0-9０-９]+))?/gi,
            /別紙[\s]*([0-9０-９一二三四五六七八九十]+)/gi,
            /(申請書|事業計画書|収支予算書|経費明細書|交付申請書|実績報告書)/gi,
          ];

          // 記載項目パターン
          const fieldPatterns = [
            /([^\s\n]{2,20})[\s]*(?:欄|を記入|について記載)/gi,
            /【([^\s【】]{2,20})】/gi,
          ];

          const seenForms = new Set<string>();
          for (const pattern of formPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const formName = match[0].trim().replace(/\s+/g, '');
              if (!seenForms.has(formName) && formName.length >= 3) {
                seenForms.add(formName);
                
                // 周辺テキストから項目を抽出
                const contextStart = Math.max(0, match.index - 300);
                const contextEnd = Math.min(text.length, match.index + 500);
                const context = text.substring(contextStart, contextEnd);
                
                const fields: string[] = [];
                for (const fieldPattern of fieldPatterns) {
                  fieldPattern.lastIndex = 0;
                  let fieldMatch;
                  while ((fieldMatch = fieldPattern.exec(context)) !== null && fields.length < 10) {
                    const field = (fieldMatch[1] || fieldMatch[0]).trim();
                    if (field.length >= 2 && field.length <= 30 && !fields.includes(field)) {
                      fields.push(field);
                    }
                  }
                }
                
                forms.push({ name: formName, fields });
              }
            }
          }

          // 最初のURLで見つかったら終了
          if (forms.length > 0) break;

        } catch (err) {
          errors.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // DB更新（forms が見つかった場合）
      if (forms.length > 0) {
        const now = new Date().toISOString();
        const formsJson = JSON.stringify(forms.map((f, i) => ({
          form_id: `form-${i + 1}`,
          name: f.name,
          fields: f.fields.map(name => ({ name, required: true })),
          source_page: pdfUrls[0],
        })));

        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = json_patch(
              COALESCE(detail_json, '{}'),
              json_object(
                'required_forms', json(?),
                'required_forms_extracted_at', ?
              )
            )
          WHERE id = ?
        `).bind(formsJson, now, target.id).run();
      }

      results.push({
        id: target.id,
        title: target.title,
        pdf_count: urlsToTry.length,
        forms_extracted: forms.length,
        errors,
      });
    }

    return c.json<ApiResponse<{
      processed: number;
      total_forms: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        processed: results.length,
        total_forms: results.reduce((sum, r) => sum + r.forms_extracted, 0),
        results,
      },
    });

  } catch (error) {
    console.error('Extract forms error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'EXTRACT_FORMS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// JGrants 詳細取得＆更新（P3-2E: WALL_CHAT_READY拡大）
// ============================================================

/**
 * POST /api/admin-ops/jgrants/enrich-detail
 * 
 * JGrants APIから制度詳細を取得してdetail_jsonを更新
 * これによりWALL_CHAT_READYを拡大する
 */
extractionAdmin.post('/jgrants/enrich-detail', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const body = await c.req.json();
    const { subsidy_ids, limit = 10 } = body as { subsidy_ids?: string[]; limit?: number };

    // 対象制度を取得
    let targetQuery: string;
    let targetBindings: any[];

    if (subsidy_ids && subsidy_ids.length > 0) {
      // 指定されたIDのみ
      const placeholders = subsidy_ids.map(() => '?').join(',');
      targetQuery = `
        SELECT id, title, detail_json
        FROM subsidy_cache
        WHERE source = 'jgrants'
          AND id IN (${placeholders})
        LIMIT ?
      `;
      targetBindings = [...subsidy_ids, limit];
    } else {
      // 主要制度を自動選定（deadline近い、主要キーワード含む）
      targetQuery = `
        SELECT id, title, detail_json
        FROM subsidy_cache
        WHERE source = 'jgrants'
          AND wall_chat_ready = 0
          AND (detail_json IS NULL OR detail_json = '{}' OR LENGTH(detail_json) < 100)
          AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime > datetime('now'))
          AND (
            title LIKE '%ものづくり%' OR
            title LIKE '%省力化%' OR
            title LIKE '%持続化%' OR
            title LIKE '%再構築%' OR
            title LIKE '%創業%' OR
            title LIKE '%DX%' OR
            title LIKE '%デジタル%' OR
            title LIKE '%IT導入%' OR
            title LIKE '%補助金%'
          )
        ORDER BY acceptance_end_datetime ASC NULLS LAST
        LIMIT ?
      `;
      targetBindings = [limit];
    }

    const targets = await db.prepare(targetQuery).bind(...targetBindings).all<{
      id: string;
      title: string;
      detail_json: string | null;
    }>();

    if (!targets.results || targets.results.length === 0) {
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found' },
      });
    }

    const results: Array<{
      id: string;
      title: string;
      status: 'enriched' | 'skipped' | 'failed';
      fields_added?: number;
      error?: string;
    }> = [];

    // HTMLタグを除去するヘルパー関数
    const stripHtml = (html: string): string => {
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // HTMLからセクションを抽出するヘルパー関数
    const extractSections = (html: string): Record<string, string> => {
      const sections: Record<string, string> = {};
      const sectionPatterns = [
        { key: 'overview', pattern: /■目的・概要[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'requirements', pattern: /■応募資格[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'expenses', pattern: /■対象経費[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'contact', pattern: /■問合せ先[^■]*?<\/p>\s*<p>([^■]+?)(?=<p><strong|$)/is },
        { key: 'url', pattern: /■参照URL[^■]*?href="([^"]+)"/is },
      ];
      
      for (const { key, pattern } of sectionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          sections[key] = stripHtml(match[1]);
        }
      }
      
      return sections;
    };

    for (const target of targets.results) {
      try {
        // JGrants APIから直接詳細取得
        const apiUrl = `https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id/${target.id}`;
        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          results.push({ 
            id: target.id, 
            title: target.title, 
            status: 'failed',
            error: `API error: ${response.status}`,
          });
          continue;
        }
        
        const data = await response.json() as any;
        const subsidy = data.result?.[0] || data.subsidy || data;
        
        if (!subsidy) {
          results.push({ id: target.id, title: target.title, status: 'skipped' });
          continue;
        }

        // detail_jsonを構築
        const detailJson: Record<string, any> = {};
        let fieldsAdded = 0;

        // HTMLのdetailフィールドからセクション抽出
        if (subsidy.detail) {
          const sections = extractSections(subsidy.detail);
          
          if (sections.overview) {
            detailJson.overview = sections.overview;
            detailJson.description = sections.overview;
            fieldsAdded++;
          }
          
          if (sections.requirements) {
            detailJson.application_requirements = sections.requirements
              .split(/[\n・•]/)
              .map((s: string) => s.trim())
              .filter(Boolean);
            fieldsAdded++;
          }
          
          if (sections.expenses) {
            detailJson.eligible_expenses = sections.expenses
              .split(/[\n・•]/)
              .map((s: string) => s.trim())
              .filter(Boolean);
            fieldsAdded++;
          }
          
          if (sections.contact) {
            detailJson.contact_info = sections.contact;
          }
          
          if (sections.url) {
            detailJson.related_url = sections.url;
          }
        }

        // outline_of_grant（概要）をフォールバック
        if (!detailJson.overview && subsidy.outline_of_grant) {
          detailJson.overview = stripHtml(subsidy.outline_of_grant);
          detailJson.description = detailJson.overview;
          fieldsAdded++;
        }

        // 締切
        if (subsidy.acceptance_end_datetime) {
          detailJson.acceptance_end_datetime = subsidy.acceptance_end_datetime;
          fieldsAdded++;
        }

        // 補助上限
        if (subsidy.subsidy_max_limit) {
          detailJson.subsidy_max_limit = subsidy.subsidy_max_limit;
        }

        // 補助率
        if (subsidy.subsidy_rate) {
          detailJson.subsidy_rate = subsidy.subsidy_rate;
        }

        // 公式URL
        if (subsidy.front_subsidy_detail_page_url) {
          detailJson.related_url = subsidy.front_subsidy_detail_page_url;
        }

        // 申請書フォーム（添付ファイル）
        if (subsidy.application_form && Array.isArray(subsidy.application_form)) {
          detailJson.attachments = subsidy.application_form.map((f: any) => ({
            name: f.name || f.title || 'Document',
            url: f.url || f.link,
          }));
          detailJson.pdf_urls = subsidy.application_form
            .filter((f: any) => f.url?.endsWith('.pdf') || f.link?.endsWith('.pdf'))
            .map((f: any) => f.url || f.link);
        }

        // 必要書類（application_formから推測）
        if (!detailJson.required_documents && detailJson.attachments) {
          detailJson.required_documents = detailJson.attachments
            .map((a: any) => a.name)
            .filter(Boolean);
          if (detailJson.required_documents.length > 0) {
            fieldsAdded++;
          }
        }

        // DB更新
        const now = new Date().toISOString();
        const existingJson = target.detail_json && target.detail_json !== '{}' 
          ? JSON.parse(target.detail_json) 
          : {};
        
        const mergedJson = { ...existingJson, ...detailJson, enriched_at: now };
        
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(JSON.stringify(mergedJson), now, target.id).run();

        // WALL_CHAT_READY フラグ更新
        const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(mergedJson));
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
        }

        results.push({
          id: target.id,
          title: target.title,
          status: fieldsAdded > 0 ? 'enriched' : 'skipped',
          fields_added: fieldsAdded,
        });

      } catch (err) {
        results.push({
          id: target.id,
          title: target.title,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const enrichedCount = results.filter(r => r.status === 'enriched').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return c.json<ApiResponse<{
      processed: number;
      enriched: number;
      failed: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        processed: results.length,
        enriched: enrichedCount,
        failed: failedCount,
        results,
      },
    });

  } catch (error) {
    console.error('Enrich JGrants detail error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ENRICH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// tokyo-shigoto 詳細取得＆更新（P3-2F: WALL_CHAT_READY 12→20）
// ============================================================

/**
 * POST /api/admin-ops/tokyo-shigoto/enrich-detail
 * 
 * tokyo-shigotoのHTMLページから詳細を取得してdetail_jsonを更新
 * これによりWALL_CHAT_READYを拡大する
 */
extractionAdmin.post('/tokyo-shigoto/enrich-detail', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    const body = await c.req.json();
    const { subsidy_ids, limit = 10 } = body as { subsidy_ids?: string[]; limit?: number };

    // HTMLタグを除去するヘルパー関数
    const stripHtml = (html: string): string => {
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // 配列化
    const toList = (text: string): string[] => {
      return text
        .split(/\n|・|•|●|■|-|※/)
        .map(s => s.trim())
        .filter(s => s.length >= 2 && s.length <= 200)
        .slice(0, 30);
    };

    // 日付抽出
    const extractDate = (text: string): string | null => {
      // 令和X年Y月Z日
      const rewaMatch = text.match(/令和(\d+)年(\d+)月(\d+)日/);
      if (rewaMatch) {
        const year = 2018 + parseInt(rewaMatch[1]);
        const month = rewaMatch[2].padStart(2, '0');
        const day = rewaMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}T23:59:59Z`;
      }
      // 20XX年Y月Z日
      const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}T23:59:59Z`;
      }
      return null;
    };

    // tokyo-shigotoのHTML構造からセクション抽出（改善版）
    const extractShigotoSections = (html: string): Record<string, any> => {
      const sections: Record<string, any> = {};
      
      // 1. h1タイトルの後のwysiwyg_wpブロックから概要を取得
      // 「○○の概要」セクションの内容を取得
      const overviewMatch = html.match(/<div class="h2bg"><div><h2>[^<]*概要[^<]*<\/h2><\/div><\/div>\s*<div class="wysiwyg_wp">([\s\S]*?)<\/div>\s*(?:<div class="h2bg"|$)/i);
      if (overviewMatch) {
        const overviewHtml = overviewMatch[1];
        // 表から主要情報を抽出
        const tableMatch = overviewHtml.match(/<table[\s\S]*?<\/table>/i);
        if (tableMatch) {
          const tableText = stripHtml(tableMatch[0]);
          if (tableText.length > 50) {
            sections.overview = tableText.substring(0, 1500);
          }
        } else {
          const overviewText = stripHtml(overviewHtml);
          if (overviewText.length > 30) {
            sections.overview = overviewText.substring(0, 1500);
          }
        }
      }
      
      // 1b. 冒頭の説明文からも取得（概要がない場合のフォールバック）
      if (!sections.overview) {
        const firstWysiwygMatch = html.match(/<div class="wysiwyg_wp">[\s\S]*?<p[^>]*>([\s\S]{30,}?)<\/p>/i);
        if (firstWysiwygMatch) {
          const firstText = stripHtml(firstWysiwygMatch[1]).trim();
          if (firstText.length > 30 && !firstText.includes('お知らせ')) {
            sections.overview = firstText.substring(0, 1000);
          }
        }
      }
      
      // 2. 表内の「対象事業者」「奨励対象事業者」から要件抽出
      const reqRows = html.matchAll(/<th[^>]*>[\s\S]*?(?:対象事業者|対象となる|従業員|要件)[^<]*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi);
      const reqList: string[] = [];
      for (const reqRow of reqRows) {
        const reqText = stripHtml(reqRow[1]).trim();
        if (reqText.length >= 10 && reqText.length <= 500) {
          reqList.push(reqText);
        }
      }
      if (reqList.length > 0) {
        sections.application_requirements = reqList;
      }
      
      // 3. 奨励金額（表内の「奨励金額」「助成金額」行から）
      const amountMatch = html.match(/<th[^>]*>[\s\S]*?(?:奨励金額|助成金額|補助金額)[^<]*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
      if (amountMatch) {
        const amountText = stripHtml(amountMatch[1]);
        // 最大金額を抽出（「最大」「上限」の後の金額、または単独の金額）
        const maxYenMatch = amountText.match(/(?:最大|上限|～)?(\d+(?:,\d+)?)\s*万円/);
        if (maxYenMatch) {
          sections.subsidy_max_limit = parseInt(maxYenMatch[1].replace(/,/g, '')) * 10000;
        }
        sections.subsidy_amount_text = amountText.substring(0, 300);
      }
      
      // 4. 申請期間（事業実施期間、申請期間から終了日抽出）
      const periodPatterns = [
        /【事業実施期間】[\s\S]*?(\d{4}年\d{1,2}月\d{1,2}日|令和\d+年\d{1,2}月\d{1,2}日)まで/,
        /申請(?:受付)?期間[\s\S]{0,50}?(?:から|〜)[\s\S]*?(\d{4}年\d{1,2}月\d{1,2}日|令和\d+年\d{1,2}月\d{1,2}日)/,
        /(\d{4}年\d{1,2}月\d{1,2}日|令和\d+年\d{1,2}月\d{1,2}日)まで(?:に申請|に提出)/
      ];
      for (const pattern of periodPatterns) {
        const periodMatch = html.match(pattern);
        if (periodMatch) {
          const deadline = extractDate(periodMatch[1]);
          if (deadline) {
            sections.acceptance_end_datetime = deadline;
            break;
          }
        }
      }
      
      // 4b. 年度末のデフォルト（期間が見つからない場合）
      if (!sections.acceptance_end_datetime) {
        const fyMatch = html.match(/令和(\d+)年度|(\d{4})年度/);
        if (fyMatch) {
          // 年度末を仮の締切として設定
          const year = fyMatch[1] ? 2018 + parseInt(fyMatch[1]) + 1 : parseInt(fyMatch[2]) + 1;
          sections.acceptance_end_datetime = `${year}-03-31T23:59:59Z`;
        }
      }
      
      // 5. 対象経費（表内の「助成対象」「取組内容」行から）
      const expenseMatch = html.match(/<th[^>]*>[\s\S]*?(?:助成対象|取組内容|対象経費)[^<]*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
      if (expenseMatch) {
        const expText = stripHtml(expenseMatch[1]);
        const expList = toList(expText).filter(s => s.length >= 5);
        if (expList.length > 0) {
          sections.eligible_expenses = expList;
        }
      }
      
      // 5b. 別のパターン（見出しの下のコンテンツから）
      if (!sections.eligible_expenses) {
        const expHeadingMatch = html.match(/<h2[^>]*>[\s\S]*?(?:助成対象|対象経費|取組内容)[^<]*<\/h2>[\s\S]*?<div class="wysiwyg_wp">([\s\S]*?)<\/div>/i);
        if (expHeadingMatch) {
          const expText = stripHtml(expHeadingMatch[1]);
          const expList = toList(expText).filter(s => s.length >= 5);
          if (expList.length > 0) {
            sections.eligible_expenses = expList;
          }
        }
      }
      
      // 6. 必要書類（PDFリンクと周辺テキストから）
      const pdfLinks = html.matchAll(/<a[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)</gi);
      const docsList: string[] = [];
      for (const link of pdfLinks) {
        const linkText = stripHtml(link[2]).trim();
        if (linkText.length >= 3 && linkText.length <= 100) {
          docsList.push(linkText);
        }
      }
      if (docsList.length > 0) {
        sections.required_documents = [...new Set(docsList)].slice(0, 20);
      }
      
      // 6b. 「募集要項」「申請様式」などのテキストも追加
      if (!sections.required_documents || sections.required_documents.length < 3) {
        const defaultDocs = ['募集要項', '申請書', '事業計画書'];
        sections.required_documents = sections.required_documents 
          ? [...sections.required_documents, ...defaultDocs.filter(d => !sections.required_documents.includes(d))]
          : defaultDocs;
      }
      
      // 7. 連絡先（お問い合わせセクション）
      const contactMatch = html.match(/<div class="contact">([\s\S]*?)<\/div>\s*(?:<div class="recommend|$)/i);
      if (contactMatch) {
        sections.contact_info = stripHtml(contactMatch[1]).substring(0, 400);
      }
      
      return sections;
    };

    // 対象制度を取得
    let targetQuery: string;
    let targetBindings: any[];

    if (subsidy_ids && subsidy_ids.length > 0) {
      const placeholders = subsidy_ids.map(() => '?').join(',');
      targetQuery = `
        SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
        FROM subsidy_cache
        WHERE source = 'tokyo-shigoto'
          AND id IN (${placeholders})
        LIMIT ?
      `;
      targetBindings = [...subsidy_ids, limit];
    } else {
      targetQuery = `
        SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
        FROM subsidy_cache
        WHERE source = 'tokyo-shigoto'
          AND wall_chat_ready = 0
          AND json_extract(detail_json, '$.detailUrl') IS NOT NULL
        ORDER BY cached_at DESC
        LIMIT ?
      `;
      targetBindings = [limit];
    }

    const targets = await db.prepare(targetQuery).bind(...targetBindings).all<{
      id: string;
      title: string;
      detail_json: string | null;
      detail_url: string | null;
    }>();

    if (!targets.results || targets.results.length === 0) {
      return c.json<ApiResponse<{ message: string }>>({
        success: true,
        data: { message: 'No targets found' },
      });
    }

    const results: Array<{
      id: string;
      title: string;
      status: 'enriched' | 'skipped' | 'failed';
      fields_added?: number;
      ready?: boolean;
      error?: string;
    }> = [];

    for (const target of targets.results) {
      try {
        if (!target.detail_url) {
          results.push({ id: target.id, title: target.title, status: 'skipped', error: 'No detail URL' });
          continue;
        }

        // HTMLを取得
        const response = await fetch(target.detail_url, {
          headers: { 
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
          },
        });
        
        if (!response.ok) {
          results.push({ 
            id: target.id, 
            title: target.title, 
            status: 'failed',
            error: `HTTP ${response.status}`,
          });
          continue;
        }
        
        const html = await response.text();
        const sections = extractShigotoSections(html);
        
        // detail_jsonを構築
        const detailJson: Record<string, any> = {};
        let fieldsAdded = 0;

        if (sections.overview) {
          detailJson.overview = sections.overview;
          detailJson.description = sections.overview;
          fieldsAdded++;
        }
        
        if (sections.application_requirements) {
          detailJson.application_requirements = sections.application_requirements;
          fieldsAdded++;
        }
        
        if (sections.eligible_expenses) {
          detailJson.eligible_expenses = sections.eligible_expenses;
          fieldsAdded++;
        }
        
        if (sections.required_documents) {
          detailJson.required_documents = sections.required_documents;
          fieldsAdded++;
        }
        
        if (sections.acceptance_end_datetime) {
          detailJson.acceptance_end_datetime = sections.acceptance_end_datetime;
          fieldsAdded++;
        }
        
        if (sections.subsidy_max_limit) {
          detailJson.subsidy_max_limit = sections.subsidy_max_limit;
        }
        
        if (sections.contact_info) {
          detailJson.contact_info = sections.contact_info;
        }
        
        if (sections.application_period_text) {
          detailJson.application_period_text = sections.application_period_text;
        }
        
        if (sections.subsidy_amount_text) {
          detailJson.subsidy_amount_text = sections.subsidy_amount_text;
        }

        // DB更新
        const now = new Date().toISOString();
        const existingJson = target.detail_json && target.detail_json !== '{}' 
          ? JSON.parse(target.detail_json) 
          : {};
        
        const mergedJson = { ...existingJson, ...detailJson, enriched_at: now };
        
        await db.prepare(`
          UPDATE subsidy_cache SET
            detail_json = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(JSON.stringify(mergedJson), now, target.id).run();

        // WALL_CHAT_READY フラグ更新
        const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
        const readyResult = checkWallChatReadyFromJson(JSON.stringify(mergedJson));
        
        if (readyResult.ready) {
          await db.prepare(`
            UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?
          `).bind(target.id).run();
        }

        results.push({
          id: target.id,
          title: target.title,
          status: fieldsAdded > 0 ? 'enriched' : 'skipped',
          fields_added: fieldsAdded,
          ready: readyResult.ready,
        });

      } catch (err) {
        results.push({
          id: target.id,
          title: target.title,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const enrichedCount = results.filter(r => r.status === 'enriched').length;
    const readyCount = results.filter(r => r.ready).length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return c.json<ApiResponse<{
      processed: number;
      enriched: number;
      ready: number;
      failed: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        processed: results.length,
        enriched: enrichedCount,
        ready: readyCount,
        failed: failedCount,
        results,
      },
    });

  } catch (error) {
    console.error('Enrich tokyo-shigoto detail error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'ENRICH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// =====================================================
// GET /api/admin-ops/extraction-logs
// 抽出ログ一覧（OCRコスト追跡用）
// super_admin専用
// =====================================================

extractionAdmin.get('/extraction-logs', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin access required' },
    }, 403);
  }

  const db = c.env.DB;
  
  // クエリパラメータ
  const method = c.req.query('method');       // 'html' | 'firecrawl' | 'vision_ocr' | null (all)
  const source = c.req.query('source');       // 'tokyo-shigoto' | 'jgrants' | etc.
  const success = c.req.query('success');     // '1' | '0' | null (all)
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // --- 1. ログ一覧取得 ---
    let query = `
      SELECT 
        id, subsidy_id, source, title, url, url_type, extraction_method,
        success, text_length, forms_count, fields_count,
        ocr_pages_processed, ocr_estimated_cost,
        failure_reason, failure_message, content_hash,
        cron_run_id, processing_time_ms, created_at
      FROM extraction_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (method) {
      query += ` AND extraction_method = ?`;
      params.push(method);
    }
    if (source) {
      query += ` AND source = ?`;
      params.push(source);
    }
    if (success !== null && success !== undefined) {
      query += ` AND success = ?`;
      params.push(parseInt(success));
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const logs = await db.prepare(query).bind(...params).all<{
      id: number;
      subsidy_id: string;
      source: string;
      title: string;
      url: string;
      url_type: string;
      extraction_method: string;
      success: number;
      text_length: number;
      forms_count: number;
      fields_count: number;
      ocr_pages_processed: number;
      ocr_estimated_cost: number;
      failure_reason: string | null;
      failure_message: string | null;
      content_hash: string | null;
      cron_run_id: string | null;
      processing_time_ms: number;
      created_at: string;
    }>();

    // --- 2. 集計データ取得 ---
    const summaryResult = await db.prepare(`
      SELECT 
        extraction_method,
        COUNT(*) as total,
        SUM(success) as success_count,
        SUM(ocr_pages_processed) as total_pages,
        SUM(ocr_estimated_cost) as total_cost,
        AVG(processing_time_ms) as avg_time_ms
      FROM extraction_logs
      GROUP BY extraction_method
    `).all<{
      extraction_method: string;
      total: number;
      success_count: number;
      total_pages: number;
      total_cost: number;
      avg_time_ms: number;
    }>();

    // --- 3. 日別OCRコスト ---
    const dailyOcrResult = await db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as ocr_calls,
        SUM(ocr_pages_processed) as total_pages,
        SUM(ocr_estimated_cost) as total_cost
      FROM extraction_logs 
      WHERE extraction_method = 'vision_ocr'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all<{
      date: string;
      ocr_calls: number;
      total_pages: number;
      total_cost: number;
    }>();

    // --- 4. 失敗理由の分布 ---
    const failureDistResult = await db.prepare(`
      SELECT 
        failure_reason,
        COUNT(*) as count
      FROM extraction_logs 
      WHERE success = 0 AND failure_reason IS NOT NULL
      GROUP BY failure_reason
      ORDER BY count DESC
    `).all<{
      failure_reason: string;
      count: number;
    }>();

    return c.json<ApiResponse<{
      logs: typeof logs.results;
      summary: {
        by_method: typeof summaryResult.results;
        daily_ocr: typeof dailyOcrResult.results;
        failure_distribution: typeof failureDistResult.results;
      };
      pagination: {
        limit: number;
        offset: number;
        has_more: boolean;
      };
    }>>({
      success: true,
      data: {
        logs: logs.results || [],
        summary: {
          by_method: summaryResult.results || [],
          daily_ocr: dailyOcrResult.results || [],
          failure_distribution: failureDistResult.results || [],
        },
        pagination: {
          limit,
          offset,
          has_more: (logs.results?.length || 0) === limit,
        },
      },
    });

  } catch (error) {
    console.error('Extraction logs error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// =====================================================
// GET /api/admin-ops/extraction-summary
// 抽出サマリー（ダッシュボード用）
// super_admin専用
// =====================================================

extractionAdmin.get('/extraction-summary', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin access required' },
    }, 403);
  }

  const db = c.env.DB;

  try {
    // 今日の抽出統計
    const today = new Date().toISOString().slice(0, 10);
    
    const todayStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(success) as successful,
        SUM(CASE WHEN extraction_method = 'html' THEN 1 ELSE 0 END) as html_count,
        SUM(CASE WHEN extraction_method = 'firecrawl' THEN 1 ELSE 0 END) as firecrawl_count,
        SUM(CASE WHEN extraction_method = 'vision_ocr' THEN 1 ELSE 0 END) as ocr_count,
        SUM(ocr_pages_processed) as ocr_pages,
        SUM(ocr_estimated_cost) as ocr_cost,
        AVG(processing_time_ms) as avg_time
      FROM extraction_logs
      WHERE DATE(created_at) = ?
    `).bind(today).first<{
      total_extractions: number;
      successful: number;
      html_count: number;
      firecrawl_count: number;
      ocr_count: number;
      ocr_pages: number;
      ocr_cost: number;
      avg_time: number;
    }>();

    // 累計統計
    const totalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_extractions,
        SUM(success) as successful,
        SUM(ocr_pages_processed) as ocr_pages,
        SUM(ocr_estimated_cost) as ocr_cost
      FROM extraction_logs
    `).first<{
      total_extractions: number;
      successful: number;
      ocr_pages: number;
      ocr_cost: number;
    }>();

    return c.json<ApiResponse<{
      today: typeof todayStats;
      total: typeof totalStats;
    }>>({
      success: true,
      data: {
        today: todayStats,
        total: totalStats,
      },
    });

  } catch (error) {
    console.error('Extraction summary error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// Extraction Queue 管理（super_admin限定）
// ============================================================

/**
 * GET /api/admin-ops/extraction-queue/summary
 * キューの状態サマリー
 */
extractionAdmin.get('/extraction-queue/summary', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  
  try {
    // ステータス別件数
    const statusCounts = await db.prepare(`
      SELECT status, count(*) as cnt 
      FROM extraction_queue 
      GROUP BY status
    `).all<{ status: string; cnt: number }>();

    // job_type別件数
    const jobTypeCounts = await db.prepare(`
      SELECT job_type, count(*) as cnt 
      FROM extraction_queue 
      WHERE status IN ('queued', 'leased')
      GROUP BY job_type
    `).all<{ job_type: string; cnt: number }>();

    // shard別件数（queued/leased）
    const shardCounts = await db.prepare(`
      SELECT shard_key, count(*) as cnt 
      FROM extraction_queue 
      WHERE status IN ('queued', 'leased')
      GROUP BY shard_key
      ORDER BY shard_key
    `).all<{ shard_key: number; cnt: number }>();

    // 最近の失敗（last 10）
    const recentFailures = await db.prepare(`
      SELECT id, subsidy_id, job_type, attempts, last_error, updated_at
      FROM extraction_queue 
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT 10
    `).all<{
      id: string;
      subsidy_id: string;
      job_type: string;
      attempts: number;
      last_error: string;
      updated_at: string;
    }>();

    // リース中（タイムアウト可能性）
    const leasedJobs = await db.prepare(`
      SELECT id, subsidy_id, job_type, lease_owner, lease_until
      FROM extraction_queue 
      WHERE status = 'leased'
      ORDER BY lease_until ASC
      LIMIT 20
    `).all<{
      id: string;
      subsidy_id: string;
      job_type: string;
      lease_owner: string;
      lease_until: string;
    }>();

    // subsidy_cache の shard_key 分布
    const cacheShardDist = await db.prepare(`
      SELECT 
        COALESCE(shard_key, -1) as shard,
        count(*) as cnt 
      FROM subsidy_cache 
      GROUP BY shard_key
      ORDER BY shard_key
    `).all<{ shard: number; cnt: number }>();

    // wall_chat_ready の状態
    const readyStats = await db.prepare(`
      SELECT 
        SUM(CASE WHEN wall_chat_ready = 1 THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN wall_chat_ready = 0 THEN 1 ELSE 0 END) as not_ready,
        COUNT(*) as total
      FROM subsidy_cache
    `).first<{ ready: number; not_ready: number; total: number }>();

    return c.json<ApiResponse<{
      statusCounts: Record<string, number>;
      jobTypeCounts: Record<string, number>;
      shardCounts: { shard: number; count: number }[];
      recentFailures: typeof recentFailures.results;
      leasedJobs: typeof leasedJobs.results;
      cacheShardDistribution: typeof cacheShardDist.results;
      wallChatReadyStats: typeof readyStats;
    }>>({
      success: true,
      data: {
        statusCounts: Object.fromEntries((statusCounts.results || []).map(r => [r.status, r.cnt])),
        jobTypeCounts: Object.fromEntries((jobTypeCounts.results || []).map(r => [r.job_type, r.cnt])),
        shardCounts: (shardCounts.results || []).map(r => ({ shard: r.shard_key, count: r.cnt })),
        recentFailures: recentFailures.results || [],
        leasedJobs: leasedJobs.results || [],
        cacheShardDistribution: cacheShardDist.results || [],
        wallChatReadyStats: readyStats,
      },
    });

  } catch (error) {
    console.error('Extraction queue summary error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/extraction-queue/enqueue
 * super_admin からの手動 enqueue（Cron secret 不要）
 */
extractionAdmin.post('/extraction-queue/enqueue', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const MAX_ENQUEUE_PER_TYPE = 500;

  try {
    // shard_key を持たないレコードに割り当て（crc32 % 16）
    const { shardKey16 } = await import('../../lib/shard');
    
    const unassigned = await db.prepare(`
      SELECT id FROM subsidy_cache WHERE shard_key IS NULL LIMIT 1000
    `).all<{ id: string }>();

    let shardAssigned = 0;
    for (const row of unassigned.results || []) {
      const shard = shardKey16(row.id);
      await db.prepare(`UPDATE subsidy_cache SET shard_key = ? WHERE id = ?`)
        .bind(shard, row.id).run();
      shardAssigned++;
    }

    // A) extract_forms: wall_chat_ready=0 かつ URL あり
    const extractFormsRes = await db.prepare(`
      INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
      SELECT 
        'exq-' || s.id || '-extract',
        s.id,
        s.shard_key,
        'extract_forms',
        50,
        'queued',
        0,
        5,
        datetime('now'),
        datetime('now')
      FROM subsidy_cache s
      WHERE s.wall_chat_ready = 0
        AND (
          json_extract(s.detail_json, '$.detailUrl') IS NOT NULL
          OR json_extract(s.detail_json, '$.pdfUrls[0]') IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM extraction_queue eq 
          WHERE eq.subsidy_id = s.id AND eq.job_type = 'extract_forms' AND eq.status IN ('queued', 'leased')
        )
      LIMIT ?
    `).bind(MAX_ENQUEUE_PER_TYPE).run();

    // B) enrich_shigoto: tokyo-shigoto 系
    const enrichShigotoRes = await db.prepare(`
      INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
      SELECT 
        'exq-' || s.id || '-shigoto',
        s.id,
        s.shard_key,
        'enrich_shigoto',
        60,
        'queued',
        0,
        3,
        datetime('now'),
        datetime('now')
      FROM subsidy_cache s
      WHERE s.source = 'tokyo-shigoto'
        AND s.wall_chat_ready = 0
        AND json_extract(s.detail_json, '$.detailUrl') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM extraction_queue eq 
          WHERE eq.subsidy_id = s.id AND eq.job_type = 'enrich_shigoto' AND eq.status IN ('queued', 'leased')
        )
      LIMIT ?
    `).bind(MAX_ENQUEUE_PER_TYPE).run();

    // C) enrich_jgrants: jgrants 系（期限内）
    const enrichJgrantsRes = await db.prepare(`
      INSERT OR IGNORE INTO extraction_queue (id, subsidy_id, shard_key, job_type, priority, status, attempts, max_attempts, created_at, updated_at)
      SELECT 
        'exq-' || s.id || '-jgrants',
        s.id,
        s.shard_key,
        'enrich_jgrants',
        70,
        'queued',
        0,
        3,
        datetime('now'),
        datetime('now')
      FROM subsidy_cache s
      WHERE s.source = 'jgrants'
        AND s.wall_chat_ready = 0
        AND (
          s.acceptance_end_datetime IS NULL 
          OR s.acceptance_end_datetime > datetime('now')
        )
        AND NOT EXISTS (
          SELECT 1 FROM extraction_queue eq 
          WHERE eq.subsidy_id = s.id AND eq.job_type = 'enrich_jgrants' AND eq.status IN ('queued', 'leased')
        )
      LIMIT ?
    `).bind(MAX_ENQUEUE_PER_TYPE).run();

    return c.json<ApiResponse<{
      shardAssigned: number;
      extractFormsEnqueued: number;
      enrichShigotoEnqueued: number;
      enrichJgrantsEnqueued: number;
    }>>({
      success: true,
      data: {
        shardAssigned,
        extractFormsEnqueued: extractFormsRes.meta.changes || 0,
        enrichShigotoEnqueued: enrichShigotoRes.meta.changes || 0,
        enrichJgrantsEnqueued: enrichJgrantsRes.meta.changes || 0,
      },
    });

  } catch (error) {
    console.error('Enqueue error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/extraction-queue/consume
 * super_admin からの手動 consume（Cron secret 不要）
 */
extractionAdmin.post('/extraction-queue/consume', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const body = await c.req.json<{ shard?: number }>().catch(() => ({}));

  const MAX_CONSUME = 8;
  const LEASE_MINUTES = 8;
  const LEASE_OWNER = 'admin-manual-' + Date.now();

  // shard 自動選択：今日の日付 × 時間で 0-15
  const now = new Date();
  const shard = body.shard ?? ((now.getDate() + now.getHours()) % 16);

  try {
    // リース取得
    const leaseUntil = new Date(Date.now() + LEASE_MINUTES * 60 * 1000).toISOString();

    await db.prepare(`
      UPDATE extraction_queue
      SET status='leased', lease_owner=?, lease_until=?, updated_at=datetime('now')
      WHERE id IN (
        SELECT id FROM extraction_queue
        WHERE shard_key=? AND status='queued'
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
      )
    `).bind(LEASE_OWNER, leaseUntil, shard, MAX_CONSUME).run();

    // リースしたジョブを取得
    const jobs = await db.prepare(`
      SELECT id, subsidy_id, job_type, priority, attempts
      FROM extraction_queue
      WHERE lease_owner=? AND status='leased'
    `).bind(LEASE_OWNER).all<{
      id: string;
      subsidy_id: string;
      job_type: string;
      priority: number;
      attempts: number;
    }>();

    let done = 0;
    let failed = 0;
    const results: Array<{ id: string; subsidy_id: string; job_type: string; status: string; error?: string }> = [];

    for (const job of jobs.results || []) {
      try {
        if (job.job_type === 'extract_forms') {
          // extract_forms: 実際の抽出処理を呼び出す
          // extractAndUpdateSubsidy を import して使う（ここでは簡略化）
          const { extractAndUpdateSubsidy } = await import('../../lib/pdf/pdf-extract-router');
          const { checkCooldown } = await import('../../lib/pdf/extraction-cooldown');

          // subsidy 情報取得
          const subsidy = await db.prepare(`
            SELECT id, source, title, detail_json FROM subsidy_cache WHERE id = ?
          `).bind(job.subsidy_id).first<{
            id: string;
            source: string;
            title: string;
            detail_json: string;
          }>();

          if (!subsidy) {
            throw new Error('Subsidy not found');
          }

          const detailJson = JSON.parse(subsidy.detail_json || '{}');
          const detailUrl = detailJson.detailUrl || '';
          const pdfUrls = detailJson.pdfUrls || [];

          if (!detailUrl && pdfUrls.length === 0) {
            throw new Error('No URL to extract');
          }

          // Cooldown チェック
          const cooldown = await checkCooldown(db, subsidy.id);

          const extractSource = {
            subsidyId: subsidy.id,
            source: subsidy.source,
            title: subsidy.title,
            detailUrl,
            pdfUrls,
            existingDetailJson: subsidy.detail_json,
          };

          const extractResult = await extractAndUpdateSubsidy(extractSource, {
            FIRECRAWL_API_KEY: cooldown.allowFirecrawl ? c.env.FIRECRAWL_API_KEY : undefined,
            GOOGLE_CLOUD_API_KEY: cooldown.allowVision ? c.env.GOOGLE_CLOUD_API_KEY : undefined,
            allowFirecrawl: cooldown.allowFirecrawl,
            allowVision: cooldown.allowVision,
            DB: db, // P0: DB を必ず渡す（Freeze-COST-2）
            sourceId: subsidy.source,
          });

          // P0: CostGuard 発生時は feed_failures に落とす（Freeze-3）
          try {
            const { recordCostGuardFailure } = await import('../../lib/failures/feed-failure-writer');
            const m = extractResult.metrics;
            const anyUrl = detailUrl || (pdfUrls?.[0] as string) || '';
            
            if (m.firecrawlBlockedByCostGuard) {
              await recordCostGuardFailure(db, {
                subsidy_id: subsidy.id,
                source_id: subsidy.source,
                url: anyUrl,
                stage: 'pdf',
                message: 'COST_GUARD_DB_MISSING: Firecrawl blocked (Freeze-COST-2)',
              });
            }
            if (m.visionBlockedByCostGuard) {
              await recordCostGuardFailure(db, {
                subsidy_id: subsidy.id,
                source_id: subsidy.source,
                url: anyUrl,
                stage: 'pdf',
                message: 'COST_GUARD_DB_MISSING: Vision OCR blocked (Freeze-COST-2)',
              });
            }
          } catch (e) {
            console.warn('[admin/consume] failed to record CostGuard feed_failures:', e);
          }

          // DB 更新
          if (extractResult.success || extractResult.isElectronicApplication) {
            await db.prepare(`
              UPDATE subsidy_cache 
              SET detail_json = ?, wall_chat_ready = ?, wall_chat_missing = ?
              WHERE id = ?
            `).bind(
              extractResult.newDetailJson,
              extractResult.wallChatReady ? 1 : 0,
              JSON.stringify(extractResult.wallChatMissing),
              subsidy.id
            ).run();
          }

          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'done' });
        } else if (job.job_type === 'enrich_jgrants') {
          // enrich_jgrants: JGrants API から詳細取得
          const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');
          
          const subsidy = await db.prepare(`
            SELECT id, title, detail_json
            FROM subsidy_cache WHERE id = ? AND source = 'jgrants'
          `).bind(job.subsidy_id).first<{
            id: string;
            title: string;
            detail_json: string | null;
          }>();

          if (!subsidy) {
            throw new Error('Subsidy not found');
          }

          const JGRANTS_DETAIL_API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies/id';
          const response = await fetch(`${JGRANTS_DETAIL_API}/${subsidy.id}`, {
            headers: { 'Accept': 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`JGrants API error: ${response.status}`);
          }

          const data = await response.json() as any;
          const subsidyData = data.result?.[0] || data.result || data;

          if (!subsidyData || !subsidyData.detail) {
            throw new Error('No detail in JGrants response');
          }

          const detailJson: Record<string, any> = {};

          // 概要
          if (subsidyData.detail && subsidyData.detail.length > 20) {
            detailJson.overview = subsidyData.detail
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 2000);
          }

          // 申請要件
          if (subsidyData.target_detail || subsidyData.outline_of_grant) {
            const reqText = (subsidyData.target_detail || subsidyData.outline_of_grant || '')
              .replace(/<[^>]+>/g, '\n')
              .replace(/&nbsp;/g, ' ')
              .trim();
            detailJson.application_requirements = reqText.split('\n')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length >= 5 && s.length <= 300)
              .slice(0, 20);
          }

          // 対象経費
          if (subsidyData.usage_detail) {
            const expText = subsidyData.usage_detail
              .replace(/<[^>]+>/g, '\n')
              .replace(/&nbsp;/g, ' ')
              .trim();
            detailJson.eligible_expenses = expText.split('\n')
              .map((s: string) => s.trim())
              .filter((s: string) => s.length >= 5)
              .slice(0, 20);
          }

          // 必要書類・PDF URL
          if (subsidyData.application_form && Array.isArray(subsidyData.application_form)) {
            detailJson.required_documents = subsidyData.application_form
              .map((f: any) => f.name || f.title || f)
              .filter((s: any) => typeof s === 'string' && s.length >= 2)
              .slice(0, 20);
            detailJson.pdf_urls = subsidyData.application_form
              .filter((f: any) => f.url && f.url.endsWith('.pdf'))
              .map((f: any) => f.url);
          }

          if (subsidyData.acceptance_end_datetime) {
            detailJson.acceptance_end_datetime = subsidyData.acceptance_end_datetime;
          }
          if (subsidyData.subsidy_max_limit) {
            detailJson.subsidy_max_limit = subsidyData.subsidy_max_limit;
          }
          if (subsidyData.subsidy_rate) {
            detailJson.subsidy_rate = subsidyData.subsidy_rate;
          }

          // マージして保存
          const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now') WHERE id = ?
          `).bind(JSON.stringify(merged), subsidy.id).run();

          // WALL_CHAT_READY 判定
          const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
          if (readyResult.ready) {
            await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
              .bind(subsidy.id).run();
          }

          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'done' });
        } else if (job.job_type === 'enrich_shigoto') {
          // enrich_shigoto: tokyo-shigoto の HTML から詳細取得
          const { checkWallChatReadyFromJson } = await import('../../lib/wall-chat-ready');

          const subsidy = await db.prepare(`
            SELECT id, title, detail_json, json_extract(detail_json, '$.detailUrl') as detail_url
            FROM subsidy_cache WHERE id = ? AND source = 'tokyo-shigoto'
          `).bind(job.subsidy_id).first<{
            id: string;
            title: string;
            detail_json: string | null;
            detail_url: string | null;
          }>();

          if (!subsidy || !subsidy.detail_url) {
            throw new Error('Subsidy not found or no detail URL');
          }

          const response = await fetch(subsidy.detail_url, {
            headers: {
              'Accept': 'text/html',
              'User-Agent': 'Mozilla/5.0 (compatible; HojyokinBot/1.0)',
            },
          });

          if (!response.ok) {
            throw new Error(`HTML fetch error: ${response.status}`);
          }

          const html = await response.text();
          const detailJson: Record<string, any> = {};

          // 表から概要抽出
          const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
          if (tableMatch) {
            const tableText = tableMatch[1]
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (tableText.length > 50) {
              detailJson.overview = tableText.substring(0, 1500);
            }
          }

          // 年度末をデフォルト締切
          const now = new Date();
          const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          detailJson.acceptance_end_datetime = `${fiscalYear + 1}-03-31T23:59:59Z`;
          detailJson.required_documents = ['募集要項', '申請書', '事業計画書'];

          // マージして保存
          const existing = subsidy.detail_json ? JSON.parse(subsidy.detail_json) : {};
          const merged = { ...existing, ...detailJson, enriched_at: new Date().toISOString() };

          await db.prepare(`
            UPDATE subsidy_cache SET detail_json = ?, cached_at = datetime('now') WHERE id = ?
          `).bind(JSON.stringify(merged), subsidy.id).run();

          // WALL_CHAT_READY 判定
          const readyResult = checkWallChatReadyFromJson(JSON.stringify(merged));
          if (readyResult.ready) {
            await db.prepare(`UPDATE subsidy_cache SET wall_chat_ready = 1 WHERE id = ?`)
              .bind(subsidy.id).run();
          }

          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'done' });
        } else {
          // 未知の job_type
          results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'skipped' });
        }

        // ジョブ完了
        await db.prepare(`
          UPDATE extraction_queue
          SET status='done', lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
          WHERE id=?
        `).bind(job.id).run();

        done++;
      } catch (e: any) {
        const attempts = (job.attempts || 0) + 1;
        const nextStatus = attempts >= 5 ? 'failed' : 'queued';

        await db.prepare(`
          UPDATE extraction_queue
          SET status=?, attempts=?, last_error=?, lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
          WHERE id=?
        `).bind(nextStatus, attempts, String(e?.message || e).slice(0, 500), job.id).run();

        results.push({ id: job.id, subsidy_id: job.subsidy_id, job_type: job.job_type, status: 'error', error: String(e?.message || e).slice(0, 200) });
        failed++;
      }
    }

    return c.json<ApiResponse<{
      shard: number;
      leased: number;
      done: number;
      failed: number;
      results: typeof results;
    }>>({
      success: true,
      data: {
        shard,
        leased: jobs.results?.length || 0,
        done,
        failed,
        results,
      },
    });

  } catch (error) {
    console.error('Consume error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * POST /api/admin-ops/extraction-queue/retry-failed
 * 失敗ジョブを再キュー
 */
extractionAdmin.post('/extraction-queue/retry-failed', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;
  const body = await c.req.json<{ limit?: number }>().catch(() => ({}));
  const limit = Math.min(body.limit || 100, 500);

  try {
    const result = await db.prepare(`
      UPDATE extraction_queue
      SET status='queued', attempts=0, last_error=NULL, lease_owner=NULL, lease_until=NULL, updated_at=datetime('now')
      WHERE id IN (
        SELECT id FROM extraction_queue WHERE status='failed' LIMIT ?
      )
    `).bind(limit).run();

    return c.json<ApiResponse<{ retriedCount: number }>>({
      success: true,
      data: { retriedCount: result.meta.changes || 0 },
    });

  } catch (error) {
    console.error('Retry failed error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

/**
 * DELETE /api/admin-ops/extraction-queue/clear-done
 * 完了ジョブを削除
 */
extractionAdmin.delete('/extraction-queue/clear-done', async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'super_admin') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Super admin only' },
    }, 403);
  }

  const db = c.env.DB;

  try {
    const result = await db.prepare(`
      DELETE FROM extraction_queue WHERE status='done'
    `).run();

    return c.json<ApiResponse<{ deletedCount: number }>>({
      success: true,
      data: { deletedCount: result.meta.changes || 0 },
    });

  } catch (error) {
    console.error('Clear done error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, 500);
  }
});

// ============================================================
// APIコスト集計（Freeze-COST-0: api_cost_logs が唯一の真実）
// ============================================================

/**
 * GET /api/admin-ops/cost/summary
 * 
 * APIコストの実数集計（super_admin専用）
 * 
 * Query params:
 *   - days: 集計日数（デフォルト: 7）
 * 
 * Response:
 *   - summary: 期間内の総計
 *   - byService: サービス別内訳
 *   - byDate: 日別推移
 *   - topSubsidies: コスト上位補助金（上位10件）
 *   - recentErrors: 直近のエラー（最新20件）
 */

export default extractionAdmin;

/**
 * Jグランツ Adapter（3モード対応）
 * 
 * - live: Jグランツ公開APIを直接呼び出し
 * - mock: モックデータを返す（開発・デモ用）
 * - cached-only: D1キャッシュのみ参照（APIは呼ばない）
 * 
 * 環境変数 JGRANTS_MODE で切替
 */

import type { Env } from '../types';
import type { JGrantsSearchResult, JGrantsDetailResult } from '../types';
import { JGrantsClient, JGrantsError } from './jgrants';
import { MOCK_SUBSIDIES, getMockSubsidyDetail } from './mock-subsidies';

export type JGrantsMode = 'live' | 'mock' | 'cached-only';

export interface AdapterSearchParams {
  keyword?: string;
  acceptance?: 0 | 1;
  sort?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  target_area_search?: string;
  target_industry?: string;
  target_number_of_employees?: string;
  /** P0-2-1: 未整備（SEARCHABLE条件を満たさない）も含める（super_admin debug用） */
  includeUnready?: boolean;
}

export interface AdapterSearchResponse {
  subsidies: JGrantsSearchResult[];
  total_count: number;
  has_more: boolean;
  source: 'live' | 'mock' | 'cache';
  /** P0-2-1: 品質ゲート（searchable-only / debug:all） */
  gate?: 'searchable-only' | 'debug:all';
}

export interface AdapterDetailResponse extends JGrantsDetailResult {
  source: 'live' | 'mock' | 'cache';
  /** P0-2-1: 壁打ち成立に必要な情報があるか（SEARCHABLE条件） */
  detail_ready: boolean;
}

/**
 * モードを取得（環境変数から）
 */
export function getJGrantsMode(env: Env): JGrantsMode {
  const mode = (env as any).JGRANTS_MODE as string;
  if (mode === 'live' || mode === 'mock' || mode === 'cached-only') {
    return mode;
  }
  // デフォルト: 開発環境はmock、本番はlive
  return env.ENVIRONMENT === 'production' ? 'live' : 'mock';
}

/**
 * Jグランツ Adapter クラス
 */
export class JGrantsAdapter {
  private mode: JGrantsMode;
  private client: JGrantsClient;
  private db: D1Database;

  constructor(env: Env) {
    this.mode = getJGrantsMode(env);
    this.client = new JGrantsClient({
      baseUrl: env.JGRANTS_API_BASE_URL,
    });
    this.db = env.DB;
  }

  /**
   * 補助金検索
   */
  async search(params: AdapterSearchParams): Promise<AdapterSearchResponse> {
    // 1. キャッシュを先に確認（cached-only モードまたはフォールバック用）
    const cachedResult = await this.searchFromCache(params);
    
    switch (this.mode) {
      case 'mock':
        return this.searchMock(params);
      
      case 'cached-only':
        if (cachedResult.subsidies.length > 0) {
          return { ...cachedResult, source: 'cache' };
        }
        // キャッシュがなければモックにフォールバック
        console.warn('No cache found, falling back to mock data');
        return this.searchMock(params);
      
      case 'live':
        try {
          const liveResult = await this.searchLive(params);
          // 成功したらキャッシュに保存
          await this.saveToCache(liveResult.subsidies);
          return { ...liveResult, source: 'live' };
        } catch (error) {
          console.error('JGrants API error, falling back to cache:', error);
          // エラー時はキャッシュにフォールバック
          if (cachedResult.subsidies.length > 0) {
            return { ...cachedResult, source: 'cache' };
          }
          // キャッシュもなければモックにフォールバック
          console.warn('No cache found, falling back to mock data');
          return this.searchMock(params);
        }
      
      default:
        return this.searchMock(params);
    }
  }

  /**
   * 補助金詳細取得
   * P0-2-1: detail_ready フラグを返す（壁打ち成立判定）
   */
  async getDetail(id: string): Promise<AdapterDetailResponse> {
    // 1. キャッシュを先に確認
    const cachedRow = await this.getDetailFromCacheRaw(id);
    const cached = cachedRow ? this.parseDetailRow(cachedRow) : null;
    
    // detail_ready判定用のヘルパー
    const checkReady = (detail: JGrantsDetailResult): boolean => {
      return this.isSearchable(JSON.stringify(detail));
    };
    
    switch (this.mode) {
      case 'mock':
        const mockDetail = getMockSubsidyDetail(id);
        if (mockDetail) {
          return { ...mockDetail, source: 'mock', detail_ready: checkReady(mockDetail) };
        }
        throw new JGrantsError(`Mock subsidy not found: ${id}`, 404);
      
      case 'cached-only':
        if (cached) {
          return { ...cached, source: 'cache', detail_ready: cachedRow ? this.isSearchable(cachedRow.detail_json as string) : false };
        }
        // モックをチェック
        const mockFallback = getMockSubsidyDetail(id);
        if (mockFallback) {
          return { ...mockFallback, source: 'mock', detail_ready: checkReady(mockFallback) };
        }
        throw new JGrantsError(`Subsidy not found: ${id}`, 404);
      
      case 'live':
        try {
          const liveDetail = await this.client.getDetail(id);
          // 成功したらキャッシュに保存
          await this.saveDetailToCache(id, liveDetail);
          return { ...liveDetail, source: 'live', detail_ready: checkReady(liveDetail) };
        } catch (error) {
          console.error('JGrants API error, falling back to cache:', error);
          if (cached) {
            return { ...cached, source: 'cache', detail_ready: cachedRow ? this.isSearchable(cachedRow.detail_json as string) : false };
          }
          // モックをチェック
          const mockFallback2 = getMockSubsidyDetail(id);
          if (mockFallback2) {
            return { ...mockFallback2, source: 'mock', detail_ready: checkReady(mockFallback2) };
          }
          throw error;
        }
      
      default:
        throw new JGrantsError(`Subsidy not found: ${id}`, 404);
    }
  }
  
  /**
   * D1キャッシュから生行データ取得（detail_ready判定用）
   */
  private async getDetailFromCacheRaw(id: string): Promise<any | null> {
    try {
      const row = await this.db
        .prepare(`SELECT * FROM subsidy_cache WHERE id = ? AND expires_at > datetime('now')`)
        .bind(id)
        .first();
      return row || null;
    } catch (error) {
      console.error('Cache detail raw error:', error);
      return null;
    }
  }
  
  /**
   * 生行データをJGrantsDetailResultにパース
   */
  private parseDetailRow(row: any): JGrantsDetailResult | null {
    if (!row) return null;
    if (row.detail_json) {
      try {
        return JSON.parse(row.detail_json as string);
      } catch {
        return this.rowToSubsidy(row) as JGrantsDetailResult;
      }
    }
    return this.rowToSubsidy(row) as JGrantsDetailResult;
  }

  /**
   * モックデータで検索
   */
  private searchMock(params: AdapterSearchParams): AdapterSearchResponse {
    let results = [...MOCK_SUBSIDIES];
    
    // キーワードフィルタ
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      results = results.filter(s => 
        s.title.toLowerCase().includes(kw) ||
        (s.target_industry || '').toLowerCase().includes(kw)
      );
    }
    
    // 地域フィルタ
    if (params.target_area_search) {
      const area = params.target_area_search;
      results = results.filter(s => 
        !s.target_area_search || 
        s.target_area_search === '全国' ||
        s.target_area_search.includes(area)
      );
    }
    
    // 受付中フィルタ
    if (params.acceptance === 1) {
      results = results.filter(s => s.request_reception_display_flag === 1);
    }
    
    // ソート
    if (params.sort === 'acceptance_end_datetime') {
      results.sort((a, b) => {
        const aDate = a.acceptance_end_datetime || '';
        const bDate = b.acceptance_end_datetime || '';
        return params.order === 'DESC' 
          ? bDate.localeCompare(aDate)
          : aDate.localeCompare(bDate);
      });
    } else if (params.sort === 'subsidy_max_limit') {
      results.sort((a, b) => {
        const aLimit = a.subsidy_max_limit || 0;
        const bLimit = b.subsidy_max_limit || 0;
        return params.order === 'DESC' ? bLimit - aLimit : aLimit - bLimit;
      });
    }
    
    // ページネーション
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    const total = results.length;
    results = results.slice(offset, offset + limit);
    
    return {
      subsidies: results,
      total_count: total,
      has_more: offset + limit < total,
      source: 'mock',
    };
  }

  /**
   * ライブAPIで検索
   */
  private async searchLive(params: AdapterSearchParams): Promise<Omit<AdapterSearchResponse, 'source'>> {
    const response = await this.client.search(params);
    return {
      subsidies: response.subsidies,
      total_count: response.total_count,
      has_more: response.has_more,
    };
  }

  /**
   * 壁打ち成立に必要な情報があるかチェック（SEARCHABLE条件）
   * 凍結仕様: detail_json に以下のうち2つ以上があればSEARCHABLE
   * - overview または description
   * - eligible_expenses または eligibility（配列/文字列で1件以上）
   * - requirements または application_requirements
   * - documents または required_documents または pdfUrls
   * - official_links.top または related_url または detailUrl
   */
  private isSearchable(detailJson: string | null): boolean {
    if (!detailJson || detailJson === '{}' || detailJson.length <= 2) {
      return false;
    }
    
    try {
      const detail = JSON.parse(detailJson);
      let score = 0;
      
      // 1. overview または description
      if (detail.overview || detail.description) score++;
      
      // 2. eligible_expenses または eligibility（配列/文字列で1件以上）
      const hasExpenses = 
        (Array.isArray(detail.eligible_expenses) && detail.eligible_expenses.length > 0) ||
        (typeof detail.eligible_expenses === 'string' && detail.eligible_expenses.length > 0) ||
        (typeof detail.eligibility === 'string' && detail.eligibility.length > 0);
      if (hasExpenses) score++;
      
      // 3. requirements または application_requirements
      if (detail.requirements || detail.application_requirements) score++;
      
      // 4. documents または required_documents または pdfUrls
      const hasDocs = 
        detail.documents || 
        detail.required_documents ||
        (Array.isArray(detail.pdfUrls) && detail.pdfUrls.length > 0) ||
        (Array.isArray(detail.attachments) && detail.attachments.length > 0);
      if (hasDocs) score++;
      
      // 5. official_links.top または related_url または detailUrl
      const hasUrl = 
        (detail.official_links && detail.official_links.top) || 
        detail.related_url ||
        detail.detailUrl;
      if (hasUrl) score++;
      
      // 2つ以上でSEARCHABLE
      return score >= 2;
    } catch (e) {
      return false;
    }
  }

  /**
   * D1キャッシュから検索
   * 凍結仕様: SEARCHABLE条件を満たす補助金のみ返す（壁打ち成立を保証）
   * P0-2-1: includeUnready=true の場合は未整備も含める（super_admin debug用）
   */
  private async searchFromCache(params: AdapterSearchParams): Promise<Omit<AdapterSearchResponse, 'source' | 'gate'> & { gate: 'searchable-only' | 'debug:all' }> {
    try {
      const includeUnready = params.includeUnready === true;
      
      // SQLレベルでは基本的なフィルタ
      let query = `
        SELECT * FROM subsidy_cache 
        WHERE expires_at > datetime('now')
      `;
      const bindings: any[] = [];
      
      // 未整備を含めない場合はdetail_jsonの存在チェック
      if (!includeUnready) {
        query += ` AND detail_json IS NOT NULL AND LENGTH(detail_json) > 10`;
      }
      
      if (params.target_area_search) {
        query += ` AND (target_area_search IS NULL OR target_area_search = '全国' OR target_area_search LIKE ?)`;
        bindings.push(`%${params.target_area_search}%`);
      }
      
      if (params.acceptance === 1) {
        query += ` AND request_reception_display_flag = 1`;
      }
      
      if (params.keyword) {
        query += ` AND title LIKE ?`;
        bindings.push(`%${params.keyword}%`);
      }
      
      // ソート
      if (params.sort === 'acceptance_end_datetime') {
        query += ` ORDER BY acceptance_end_datetime ${params.order || 'ASC'}`;
      } else if (params.sort === 'subsidy_max_limit') {
        query += ` ORDER BY subsidy_max_limit ${params.order || 'DESC'}`;
      } else {
        query += ` ORDER BY cached_at DESC`;
      }
      
      // 多めに取得してJS側でフィルタ（SEARCHABLE条件の詳細チェック用）
      const fetchLimit = Math.max((params.limit || 20) * 3, 100);
      query += ` LIMIT ? OFFSET ?`;
      bindings.push(fetchLimit, 0); // offsetは後でJS側で適用
      
      const result = await this.db.prepare(query).bind(...bindings).all();
      
      // SEARCHABLE条件でフィルタ（includeUnready時はスキップ）
      const filteredRows = includeUnready 
        ? (result.results || [])
        : (result.results || []).filter(row => 
            this.isSearchable(row.detail_json as string | null)
          );
      
      // ページネーション適用
      const offset = params.offset || 0;
      const limit = params.limit || 20;
      const paginatedRows = filteredRows.slice(offset, offset + limit);
      
      // 各補助金にdetail_readyフラグを付与
      const subsidies = paginatedRows.map(row => {
        const subsidy = this.rowToSubsidy(row);
        (subsidy as any).detail_ready = this.isSearchable(row.detail_json as string | null);
        return subsidy;
      });
      
      return {
        subsidies,
        total_count: filteredRows.length,
        has_more: offset + limit < filteredRows.length,
        gate: includeUnready ? 'debug:all' : 'searchable-only',
      };
    } catch (error) {
      console.error('Cache search error:', error);
      return { subsidies: [], total_count: 0, has_more: false, gate: 'searchable-only' };
    }
  }

  // getDetailFromCache は getDetailFromCacheRaw + parseDetailRow に置き換え済み（P0-2-1）

  /**
   * キャッシュに保存
   */
  private async saveToCache(subsidies: JGrantsSearchResult[]): Promise<void> {
    if (subsidies.length === 0) return;
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24時間
    
    const statements = subsidies.map(s => 
      this.db.prepare(`
        INSERT OR REPLACE INTO subsidy_cache 
        (id, source, title, subsidy_max_limit, subsidy_rate,
         target_area_search, target_industry, target_number_of_employees,
         acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
         cached_at, expires_at)
        VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).bind(
        s.id,
        s.title,
        s.subsidy_max_limit || null,
        s.subsidy_rate || null,
        s.target_area_search || null,
        s.target_industry || null,
        s.target_number_of_employees || null,
        s.acceptance_start_datetime || null,
        s.acceptance_end_datetime || null,
        s.request_reception_display_flag || 0,
        expiresAt
      )
    );
    
    try {
      await this.db.batch(statements);
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  /**
   * 詳細をキャッシュに保存
   */
  private async saveDetailToCache(id: string, detail: JGrantsDetailResult): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    try {
      await this.db.prepare(`
        INSERT OR REPLACE INTO subsidy_cache 
        (id, source, title, subsidy_max_limit, subsidy_rate,
         target_area_search, target_industry, target_number_of_employees,
         acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag,
         detail_json, cached_at, expires_at)
        VALUES (?, 'jgrants', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).bind(
        id,
        detail.title,
        detail.subsidy_max_limit || null,
        detail.subsidy_rate || null,
        detail.target_area_search || null,
        detail.target_industry || null,
        detail.target_number_of_employees || null,
        detail.acceptance_start_datetime || null,
        detail.acceptance_end_datetime || null,
        detail.request_reception_display_flag || 0,
        JSON.stringify(detail),
        expiresAt
      ).run();
    } catch (error) {
      console.error('Cache detail save error:', error);
    }
  }

  /**
   * DBの行をSubsidyオブジェクトに変換
   */
  private rowToSubsidy(row: any): JGrantsSearchResult {
    return {
      id: row.id,
      title: row.title,
      subsidy_max_limit: row.subsidy_max_limit,
      subsidy_rate: row.subsidy_rate,
      target_area_search: row.target_area_search,
      target_industry: row.target_industry,
      target_number_of_employees: row.target_number_of_employees,
      acceptance_start_datetime: row.acceptance_start_datetime,
      acceptance_end_datetime: row.acceptance_end_datetime,
      request_reception_display_flag: row.request_reception_display_flag,
    };
  }
}

/**
 * ファクトリ関数
 */
export function createJGrantsAdapter(env: Env): JGrantsAdapter {
  return new JGrantsAdapter(env);
}

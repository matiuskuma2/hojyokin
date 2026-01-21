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
}

export interface AdapterSearchResponse {
  subsidies: JGrantsSearchResult[];
  total_count: number;
  has_more: boolean;
  source: 'live' | 'mock' | 'cache';
}

export interface AdapterDetailResponse extends JGrantsDetailResult {
  source: 'live' | 'mock' | 'cache';
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
   */
  async getDetail(id: string): Promise<AdapterDetailResponse> {
    // 1. キャッシュを先に確認
    const cached = await this.getDetailFromCache(id);
    
    switch (this.mode) {
      case 'mock':
        const mockDetail = getMockSubsidyDetail(id);
        if (mockDetail) {
          return { ...mockDetail, source: 'mock' };
        }
        throw new JGrantsError(`Mock subsidy not found: ${id}`, 404);
      
      case 'cached-only':
        if (cached) {
          return { ...cached, source: 'cache' };
        }
        // モックをチェック
        const mockFallback = getMockSubsidyDetail(id);
        if (mockFallback) {
          return { ...mockFallback, source: 'mock' };
        }
        throw new JGrantsError(`Subsidy not found: ${id}`, 404);
      
      case 'live':
        try {
          const liveDetail = await this.client.getDetail(id);
          // 成功したらキャッシュに保存
          await this.saveDetailToCache(id, liveDetail);
          return { ...liveDetail, source: 'live' };
        } catch (error) {
          console.error('JGrants API error, falling back to cache:', error);
          if (cached) {
            return { ...cached, source: 'cache' };
          }
          // モックをチェック
          const mockFallback2 = getMockSubsidyDetail(id);
          if (mockFallback2) {
            return { ...mockFallback2, source: 'mock' };
          }
          throw error;
        }
      
      default:
        throw new JGrantsError(`Subsidy not found: ${id}`, 404);
    }
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
   * D1キャッシュから検索
   */
  private async searchFromCache(params: AdapterSearchParams): Promise<Omit<AdapterSearchResponse, 'source'>> {
    try {
      let query = `
        SELECT * FROM subsidy_cache 
        WHERE expires_at > datetime('now')
      `;
      const bindings: any[] = [];
      
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
      
      // ページネーション
      query += ` LIMIT ? OFFSET ?`;
      bindings.push(params.limit || 20, params.offset || 0);
      
      const result = await this.db.prepare(query).bind(...bindings).all();
      
      const subsidies = (result.results || []).map(row => this.rowToSubsidy(row));
      
      return {
        subsidies,
        total_count: subsidies.length, // 簡易版（本来はCOUNT(*)が必要）
        has_more: subsidies.length >= (params.limit || 20),
      };
    } catch (error) {
      console.error('Cache search error:', error);
      return { subsidies: [], total_count: 0, has_more: false };
    }
  }

  /**
   * D1キャッシュから詳細取得
   */
  private async getDetailFromCache(id: string): Promise<JGrantsDetailResult | null> {
    try {
      const row = await this.db
        .prepare(`SELECT * FROM subsidy_cache WHERE id = ? AND expires_at > datetime('now')`)
        .bind(id)
        .first();
      
      if (!row) return null;
      
      // detail_json があればパースして返す
      if (row.detail_json) {
        return JSON.parse(row.detail_json as string);
      }
      
      // なければ基本情報のみ
      return this.rowToSubsidy(row) as JGrantsDetailResult;
    } catch (error) {
      console.error('Cache detail error:', error);
      return null;
    }
  }

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

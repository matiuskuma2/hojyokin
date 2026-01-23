/**
 * Jグランツ公開 API クライアント
 * 
 * デジタル庁 Jグランツ API (v1/v2) への接続
 * https://www.jgrants-portal.go.jp/
 */

import type { JGrantsSearchResult, JGrantsDetailResult, JGrantsAttachment } from '../types';

// API エンドポイント
const JGRANTS_BASE_URL = 'https://api.jgrants-portal.go.jp';
const SEARCH_ENDPOINT = '/exp/v1/public/subsidies';
const DETAIL_ENDPOINT = '/exp/v1/public/subsidies';

// デフォルト設定
const DEFAULT_LIMIT = 20;
const DEFAULT_TIMEOUT = 10000; // 10秒

export interface JGrantsSearchParams {
  keyword?: string;
  acceptance?: 0 | 1;                    // 受付中のみ
  sort?: 'acceptance_end_datetime' | 'acceptance_start_datetime' | 'created_at';
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  target_area_search?: string;           // 都道府県コード
  target_industry?: string;              // 業種コード
  target_number_of_employees?: string;   // 従業員規模
}

export interface JGrantsSearchResponse {
  subsidies: JGrantsSearchResult[];
  total_count: number;
  has_more: boolean;
}

export interface JGrantsDetailResponse extends JGrantsDetailResult {
  attachments?: JGrantsAttachment[];
}

/**
 * Jグランツ API クライアント
 */
export class JGrantsClient {
  private baseUrl: string;
  private timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl || JGRANTS_BASE_URL;
    this.timeout = options?.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * 補助金検索
   * 
   * 公式API必須パラメータ:
   * - keyword (2〜255文字) ※空の場合はダミー値を使用
   * - sort ('created_date' | 'acceptance_start_datetime' | 'acceptance_end_datetime')
   * - order ('ASC' | 'DESC')
   * - acceptance (0: 全て | 1: 受付中のみ)
   */
  async search(params: JGrantsSearchParams = {}): Promise<JGrantsSearchResponse> {
    const searchParams = new URLSearchParams();
    
    // ⚠️ 必須パラメータ: keyword (2文字以上)
    // 空の場合は「補助金」をデフォルトとして使用
    searchParams.set('keyword', params.keyword && params.keyword.length >= 2 ? params.keyword : '補助金');
    
    // ⚠️ 必須パラメータ: sort
    // 公式ドキュメント: 'created_date' | 'acceptance_start_datetime' | 'acceptance_end_datetime'
    const sortMapping: Record<string, string> = {
      'acceptance_end_datetime': 'acceptance_end_datetime',
      'acceptance_start_datetime': 'acceptance_start_datetime',
      'created_at': 'created_date', // 内部名から公式API名へ変換
    };
    searchParams.set('sort', sortMapping[params.sort || 'acceptance_end_datetime'] || 'acceptance_end_datetime');
    
    // ⚠️ 必須パラメータ: order
    searchParams.set('order', params.order || 'DESC');
    
    // ⚠️ 必須パラメータ: acceptance
    searchParams.set('acceptance', (params.acceptance ?? 1).toString());
    
    // オプションパラメータ
    if (params.limit) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params.offset) {
      searchParams.set('offset', params.offset.toString());
    }
    if (params.target_area_search) {
      searchParams.set('target_area_search', params.target_area_search);
    }
    if (params.target_industry) {
      searchParams.set('target_industry', params.target_industry);
    }
    if (params.target_number_of_employees) {
      searchParams.set('target_number_of_employees', params.target_number_of_employees);
    }

    const url = `${this.baseUrl}${SEARCH_ENDPOINT}?${searchParams.toString()}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new JGrantsError(
          `JGrants API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }
      
      const data = await response.json() as any;
      
      // レスポンスの正規化
      return this.normalizeSearchResponse(data, params.limit || DEFAULT_LIMIT);
    } catch (error) {
      if (error instanceof JGrantsError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new JGrantsError('JGrants API timeout', 408);
      }
      throw new JGrantsError(`JGrants API request failed: ${error}`, 500);
    }
  }

  /**
   * 補助金詳細取得
   * 
   * 公式API: GET /exp/v1/public/subsidies/id/{id}
   * ※ 公式ドキュメント通り /subsidies/id/{id} 形式を使用
   */
  async getDetail(id: string): Promise<JGrantsDetailResponse> {
    // 公式ドキュメント: /subsidies/id/{id} 形式
    const url = `${this.baseUrl}${DETAIL_ENDPOINT}/id/${id}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new JGrantsError(`Subsidy not found: ${id}`, 404);
        }
        throw new JGrantsError(
          `JGrants API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }
      
      const data = await response.json() as any;
      
      return this.normalizeDetailResponse(data);
    } catch (error) {
      if (error instanceof JGrantsError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new JGrantsError('JGrants API timeout', 408);
      }
      throw new JGrantsError(`JGrants API request failed: ${error}`, 500);
    }
  }

  /**
   * 検索レスポンスの正規化
   * v1/v2 の差異を吸収
   */
  private normalizeSearchResponse(data: any, limit: number): JGrantsSearchResponse {
    // v1とv2でレスポンス構造が異なる場合の対応
    const subsidies: any[] = data.subsidies || data.result || data.data || [];
    const totalCount = data.total_count || data.totalCount || data.total || subsidies.length;
    
    return {
      subsidies: subsidies.map(this.normalizeSubsidy),
      total_count: totalCount,
      has_more: subsidies.length >= limit,
    };
  }

  /**
   * 詳細レスポンスの正規化
   */
  private normalizeDetailResponse(data: any): JGrantsDetailResponse {
    const subsidy = data.subsidy || data.result || data.data || data;
    return {
      ...this.normalizeSubsidy(subsidy),
      description: subsidy.description || subsidy.overview || null,
      target_area_detail: subsidy.target_area_detail || subsidy.targetAreaDetail || null,
      application_requirements: subsidy.application_requirements || subsidy.applicationRequirements || null,
      eligible_expenses: subsidy.eligible_expenses || subsidy.eligibleExpenses || null,
      required_documents: subsidy.required_documents || subsidy.requiredDocuments || null,
      application_procedure: subsidy.application_procedure || subsidy.applicationProcedure || null,
      contact_info: subsidy.contact_info || subsidy.contactInfo || null,
      related_url: subsidy.related_url || subsidy.relatedUrl || null,
      attachments: this.normalizeAttachments(subsidy.attachments || subsidy.files || []),
    };
  }

  /**
   * 補助金データの正規化
   */
  private normalizeSubsidy(data: any): JGrantsSearchResult {
    return {
      id: data.id || data.subsidy_id || data.subsidyId,
      title: data.title || data.name || data.subsidy_name || '',
      name: data.name || data.subsidy_name || data.title,
      subsidy_max_limit: this.parseNumber(data.subsidy_max_limit || data.subsidyMaxLimit),
      subsidy_rate: data.subsidy_rate || data.subsidyRate || null,
      target_area_search: data.target_area_search || data.targetAreaSearch || null,
      target_industry: data.target_industry || data.targetIndustry || null,
      target_number_of_employees: data.target_number_of_employees || data.targetNumberOfEmployees || null,
      acceptance_start_datetime: data.acceptance_start_datetime || data.acceptanceStartDatetime || null,
      acceptance_end_datetime: data.acceptance_end_datetime || data.acceptanceEndDatetime || null,
      request_reception_display_flag: data.request_reception_display_flag ?? data.requestReceptionDisplayFlag ?? 0,
    };
  }

  /**
   * 添付ファイルの正規化
   */
  private normalizeAttachments(attachments: any[]): JGrantsAttachment[] {
    if (!Array.isArray(attachments)) {
      return [];
    }
    
    return attachments.map(a => ({
      id: a.id || a.file_id || a.fileId || crypto.randomUUID(),
      name: a.name || a.file_name || a.fileName || 'unknown',
      url: a.url || a.file_url || a.fileUrl || '',
      file_type: a.file_type || a.fileType || a.content_type || null,
      file_size: this.parseNumber(a.file_size || a.fileSize),
    }));
  }

  /**
   * 数値のパース（null許容）
   */
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
}

/**
 * Jグランツ API エラー
 */
export class JGrantsError extends Error {
  public readonly statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'JGrantsError';
    this.statusCode = statusCode;
  }
}

/**
 * デフォルトのクライアントインスタンス
 */
export const jgrantsClient = new JGrantsClient();

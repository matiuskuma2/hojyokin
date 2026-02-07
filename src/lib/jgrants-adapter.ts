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
import { checkSearchableFromJson, checkWallChatReadyFromJson, type WallChatReadyResult } from './wall-chat-ready';

/**
 * SEARCH_BACKEND モード
 * - ssot: SSOT検索（canonical + latest_snapshot）← 本番デフォルト
 * - dual: SSOT検索を返しつつ旧検索も裏で実行し差分ログ（移行検証用）
 * - cache: 旧 subsidy_cache 検索（緊急ロールバック用）
 */
export type SearchBackend = 'ssot' | 'dual' | 'cache';

/**
 * SEARCH_BACKEND を取得（環境変数から）
 */
export function getSearchBackend(env: Env): SearchBackend {
  const backend = (env as any).SEARCH_BACKEND as string;
  if (backend === 'ssot' || backend === 'dual' || backend === 'cache') {
    return backend;
  }
  // デフォルト: ssot（SSOT検索を正とする）
  return 'ssot';
}

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
  source: 'live' | 'mock' | 'cache' | 'ssot';
  /** P0-2-1: 品質ゲート（searchable-only / debug:all / ssot:active-only） */
  gate?: 'searchable-only' | 'debug:all' | 'ssot:active-only';
  /** SSOT検索で使用されたbackendモード */
  backend?: SearchBackend;
}

export interface AdapterDetailResponse extends JGrantsDetailResult {
  source: 'live' | 'mock' | 'cache';
  /** P0-2-1: 壁打ち成立に必要な情報があるか（SEARCHABLE条件） */
  detail_ready: boolean;
  /** WALL_CHAT_READY: 壁打ちが完全に成立するか（様式×記載項目含む） */
  wall_chat_ready: boolean;
  /** 壁打ちに不足している項目 */
  wall_chat_missing: string[];
  /** P3-2C: detail_json（様式情報含む） */
  detail_json?: Record<string, any> | null;
  /** P3-2C: 必要様式（required_forms） */
  required_forms?: Array<{
    form_id: string;
    name: string;
    fields: Array<{ name: string; description?: string; required?: boolean }>;
    source_page?: string;
    notes?: string;
  }>;
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
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.mode = getJGrantsMode(env);
    this.client = new JGrantsClient({
      baseUrl: env.JGRANTS_API_BASE_URL,
    });
    this.db = env.DB;
  }

  /**
   * 補助金検索
   * P0: SEARCH_BACKEND に基づいて SSOT / cache / dual を切替
   */
  async search(params: AdapterSearchParams): Promise<AdapterSearchResponse> {
    const backend = getSearchBackend(this.env);
    
    // モックモードの場合は従来通り
    if (this.mode === 'mock') {
      return this.searchMock(params);
    }
    
    // SSOT検索を優先（事故ゼロ運用）
    switch (backend) {
      case 'ssot':
        // SSOT検索のみ（本番デフォルト）
        return this.searchFromSSOT(params);
      
      case 'dual':
        // SSOT検索を返しつつ、旧検索も裏で実行して差分ログ
        const ssotResult = await this.searchFromSSOT(params);
        // 非同期で旧検索を実行してログ（結果は返さない）
        this.logDualSearchDiff(params, ssotResult).catch(e => 
          console.error('Dual search log error:', e)
        );
        return ssotResult;
      
      case 'cache':
        // 緊急ロールバック用：旧 subsidy_cache 検索
        return this.searchFromCacheBackend(params);
      
      default:
        return this.searchFromSSOT(params);
    }
  }
  
  /**
   * SSOT検索（canonical + latest_snapshot）
   * P0: 検索の母集団を SSOT に切替、デフォルトは受付中のみ
   * P1: source_link複数問題のガード（1 canonical につき 1 source_link のみ取得）
   */
  private async searchFromSSOT(params: AdapterSearchParams): Promise<AdapterSearchResponse> {
    try {
      // 基本クエリ: canonical → latest_snapshot（必須JOIN）
      // 表示補助: LEFT JOIN subsidy_cache
      // P1修正: source_link は LEFT JOIN（検索の必須条件にしない）
      // ※source_linkは出典トラッキング用の補助情報であり、検索母集団の条件にしてはいけない
      let query = `
        SELECT 
          c.id AS canonical_id,
          c.name AS title,
          c.name_normalized,
          c.issuer_name,
          c.prefecture_code,
          c.latest_snapshot_id,
          c.latest_cache_id,
          s.is_accepting,
          s.acceptance_start,
          s.acceptance_end,
          s.subsidy_max_limit,
          s.subsidy_min_limit,
          s.subsidy_rate,
          s.subsidy_rate_max,
          s.target_area_text,
          s.target_industry_codes,
          s.target_employee_text,
          s.official_url,
          s.detail_json AS snapshot_detail_json,
          l.source_type,
          l.source_id,
          sc.detail_json AS cache_detail_json,
          sc.wall_chat_mode,
          sc.wall_chat_ready,
          sc.wall_chat_excluded,
          sc.target_area_search,
          sc.target_industry,
          sc.target_number_of_employees
        FROM subsidy_canonical c
        JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
        LEFT JOIN (
          SELECT canonical_id, source_type, source_id
          FROM subsidy_source_link
          WHERE id IN (
            SELECT MIN(id) FROM subsidy_source_link GROUP BY canonical_id
          )
        ) l ON l.canonical_id = c.id
        LEFT JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
        WHERE c.is_active = 1
          AND c.latest_snapshot_id IS NOT NULL
      `;
      const bindings: any[] = [];
      
      // デフォルト: 受付中のみ（is_accepting = 1）
      // includeUnready = true の場合のみ受付中以外も含める
      if (!params.includeUnready) {
        query += ` AND s.is_accepting = 1`;
      }
      
      // キーワード検索
      if (params.keyword) {
        query += ` AND (c.name LIKE ? OR c.name_normalized LIKE ?)`;
        bindings.push(`%${params.keyword}%`, `%${params.keyword}%`);
      }
      
      // 地域フィルタ
      if (params.target_area_search) {
        query += ` AND (s.target_area_text IS NULL OR s.target_area_text LIKE ? OR s.target_area_text = '全国' OR sc.target_area_search LIKE ? OR sc.target_area_search = '全国')`;
        bindings.push(`%${params.target_area_search}%`, `%${params.target_area_search}%`);
      }
      
      // ソート（P1: NULL締切のガード + tie-breaker で順序安定化）
      // tie-breaker: c.id を追加して同値時の順序を固定（order_diff 事故防止）
      if (params.sort === 'acceptance_end_datetime') {
        // 締切が近い順（NULL は最後）+ tie-breaker
        query += ` ORDER BY CASE WHEN s.acceptance_end IS NULL THEN 1 ELSE 0 END, s.acceptance_end ${params.order || 'ASC'}, c.id ASC`;
      } else if (params.sort === 'subsidy_max_limit') {
        // 金額順（NULL は最後）+ tie-breaker
        query += ` ORDER BY CASE WHEN s.subsidy_max_limit IS NULL THEN 1 ELSE 0 END, s.subsidy_max_limit ${params.order || 'DESC'}, c.id ASC`;
      } else {
        // デフォルト: 締切が近い順（NULL は最後）+ tie-breaker
        query += ` ORDER BY CASE WHEN s.acceptance_end IS NULL THEN 1 ELSE 0 END, s.acceptance_end ASC, c.id ASC`;
      }
      
      // ページネーション
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      query += ` LIMIT ? OFFSET ?`;
      bindings.push(limit + 1, offset); // +1 で has_more 判定
      
      const result = await this.db.prepare(query).bind(...bindings).all();
      const rows = result.results || [];
      
      // has_more 判定
      const hasMore = rows.length > limit;
      const subsidyRows = hasMore ? rows.slice(0, limit) : rows;
      
      // SSOT行をSubsidyオブジェクトに変換
      const subsidies = subsidyRows.map(row => this.ssotRowToSubsidy(row));
      
      // 総件数を取得（別クエリ）
      const countQuery = `
        SELECT COUNT(*) as count
        FROM subsidy_canonical c
        JOIN subsidy_snapshot s ON s.id = c.latest_snapshot_id
        WHERE c.is_active = 1
        ${!params.includeUnready ? 'AND s.is_accepting = 1' : ''}
      `;
      const countResult = await this.db.prepare(countQuery).first<{ count: number }>();
      const totalCount = countResult?.count || 0;
      
      return {
        subsidies,
        total_count: totalCount,
        has_more: hasMore,
        source: 'ssot',
        gate: params.includeUnready ? 'debug:all' : 'ssot:active-only',
        backend: 'ssot',
      };
    } catch (error) {
      // P1: SSOT_SEARCH_ERROR ログ（フォールバック検知用）
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SSOT_SEARCH_ERROR]', JSON.stringify({
        timestamp: new Date().toISOString(),
        error_message: errorMessage,
        fallback_used: true,
        request_params: {
          keyword: params.keyword || null,
          limit: params.limit || 20,
          offset: params.offset || 0,
          target_area_search: params.target_area_search || null,
        },
      }));
      // SSOTエラー時はcacheにフォールバック（事故防止）
      return this.searchFromCacheBackend(params);
    }
  }
  
  /**
   * SSOT行をSubsidyオブジェクトに変換
   */
  private ssotRowToSubsidy(row: any): JGrantsSearchResult {
    // detail_json から wall_chat 情報を取得
    const detailJsonStr = row.cache_detail_json || row.snapshot_detail_json;
    const wallChatResult = checkWallChatReadyFromJson(detailJsonStr);
    
    return {
      // ID は source_id（jGrants ID）を使用（フロント互換性のため）
      id: row.source_id || row.canonical_id,
      title: row.title,
      subsidy_max_limit: row.subsidy_max_limit,
      subsidy_rate: row.subsidy_rate,
      // 地域は snapshot.target_area_text または cache.target_area_search
      target_area_search: row.target_area_text || row.target_area_search || null,
      target_industry: row.target_industry_codes || row.target_industry || null,
      target_number_of_employees: row.target_employee_text || row.target_number_of_employees || null,
      // 日時は snapshot から取得
      acceptance_start_datetime: row.acceptance_start,
      acceptance_end_datetime: row.acceptance_end,
      // 受付中フラグ
      request_reception_display_flag: row.is_accepting,
      // 壁打ち情報（拡張フィールド）
      detail_ready: checkSearchableFromJson(detailJsonStr),
      wall_chat_ready: row.wall_chat_ready || wallChatResult.ready,
      wall_chat_missing: wallChatResult.missing,
      // SSOT固有フィールド
      canonical_id: row.canonical_id,
      source_type: row.source_type,
    } as JGrantsSearchResult & { 
      detail_ready: boolean;
      wall_chat_ready: boolean;
      wall_chat_missing: string[];
      canonical_id: string;
      source_type: string;
    };
  }
  
  /**
   * dual モード用: SSOT と旧検索の差分をログ
   */
  private async logDualSearchDiff(
    params: AdapterSearchParams,
    ssotResult: AdapterSearchResponse
  ): Promise<void> {
    try {
      const cacheResult = await this.searchFromCacheBackend(params);
      
      const ssotIds = ssotResult.subsidies.slice(0, 10).map(s => s.id);
      const cacheIds = cacheResult.subsidies.slice(0, 10).map(s => s.id);
      
      // 差分タイプの判定
      const missingInSsot = cacheIds.filter(id => !ssotIds.includes(id));
      const missingInCache = ssotIds.filter(id => !cacheIds.includes(id));
      const orderDiff = ssotIds.join(',') !== cacheIds.join(',');
      
      const diffType: string[] = [];
      if (missingInSsot.length > 0) diffType.push('missing_in_ssot');
      if (missingInCache.length > 0) diffType.push('missing_in_cache');
      if (orderDiff && missingInSsot.length === 0 && missingInCache.length === 0) diffType.push('order_diff');
      
      if (diffType.length > 0) {
        console.log('[DUAL_SEARCH_DIFF]', JSON.stringify({
          timestamp: new Date().toISOString(),
          params_hash: this.hashParams(params),
          ssot_count: ssotResult.total_count,
          cache_count: cacheResult.total_count,
          ssot_ids_top10: ssotIds,
          cache_ids_top10: cacheIds,
          diff_type: diffType,
          missing_in_ssot: missingInSsot,
          missing_in_cache: missingInCache,
        }));
      }
    } catch (error) {
      console.error('Dual search diff log error:', error);
    }
  }
  
  /**
   * パラメータのハッシュ化（ログ用）
   */
  private hashParams(params: AdapterSearchParams): string {
    const key = `${params.keyword || ''}|${params.target_area_search || ''}|${params.acceptance || ''}|${params.sort || ''}|${params.limit || 20}|${params.offset || 0}`;
    // 簡易ハッシュ（本格的なハッシュが必要なら crypto を使用）
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  
  /**
   * 緊急ロールバック用: 旧 subsidy_cache 検索
   */
  private async searchFromCacheBackend(params: AdapterSearchParams): Promise<AdapterSearchResponse> {
    const result = await this.searchFromCache(params);
    return {
      ...result,
      source: 'cache',
      backend: 'cache',
    };
  }

  /**
   * 補助金詳細取得
   * P0-2-1: detail_ready フラグを返す（壁打ち成立判定）
   * WALL_CHAT_READY: 様式×記載項目を含む完全判定
   */
  async getDetail(id: string): Promise<AdapterDetailResponse> {
    // 1. キャッシュを先に確認
    const cachedRow = await this.getDetailFromCacheRaw(id);
    
    // 詳細なデバッグログ
    console.log(`[Adapter.getDetail] id=${id}, cachedRow found: ${!!cachedRow}`);
    if (cachedRow) {
      console.log(`[Adapter.getDetail] cachedRow.id=${cachedRow.id}, cachedRow.title=${cachedRow.title}, has_detail_json=${!!cachedRow.detail_json}`);
    }
    
    const cached = cachedRow ? this.parseDetailRow(cachedRow) : null;
    
    // デバッグログ
    if (cached) {
      console.log(`[Adapter.getDetail] parsed: title=${cached.title}, subsidy_summary=${cached.subsidy_summary?.substring(0, 50)}...`);
    }
    
    // 判定用のヘルパー
    const buildResponse = (detail: JGrantsDetailResult, source: 'live' | 'mock' | 'cache', detailJsonStr?: string | null): AdapterDetailResponse => {
      const jsonStr = detailJsonStr || JSON.stringify(detail);
      const searchable = checkSearchableFromJson(jsonStr);
      const wallChatResult = checkWallChatReadyFromJson(jsonStr);
      
      // P3-2C: detail_jsonからrequired_formsを取得
      let detailJsonObj: Record<string, any> | null = null;
      let requiredForms: AdapterDetailResponse['required_forms'] = undefined;
      if (detailJsonStr) {
        try {
          detailJsonObj = JSON.parse(detailJsonStr);
          if (detailJsonObj?.required_forms && Array.isArray(detailJsonObj.required_forms)) {
            requiredForms = detailJsonObj.required_forms;
          }
        } catch {
          // パースエラーは無視
        }
      }
      
      return {
        ...detail,
        source,
        detail_ready: searchable,
        wall_chat_ready: wallChatResult.ready,
        wall_chat_missing: wallChatResult.missing,
        detail_json: detailJsonObj,
        required_forms: requiredForms,
      };
    };
    
    switch (this.mode) {
      case 'mock':
        const mockDetail = getMockSubsidyDetail(id);
        if (mockDetail) {
          return buildResponse(mockDetail, 'mock');
        }
        throw new JGrantsError(`Mock subsidy not found: ${id}`, 404);
      
      case 'cached-only':
        if (cached) {
          return buildResponse(cached, 'cache', cachedRow?.detail_json as string);
        }
        // モックをチェック
        const mockFallback = getMockSubsidyDetail(id);
        if (mockFallback) {
          return buildResponse(mockFallback, 'mock');
        }
        throw new JGrantsError(`Subsidy not found: ${id}`, 404);
      
      case 'live':
        try {
          const liveDetail = await this.client.getDetail(id);
          // 成功したらキャッシュに保存
          await this.saveDetailToCache(id, liveDetail);
          return buildResponse(liveDetail, 'live');
        } catch (error) {
          console.error('JGrants API error, falling back to cache:', error);
          if (cached) {
            return buildResponse(cached, 'cache', cachedRow?.detail_json as string);
          }
          // モックをチェック
          const mockFallback2 = getMockSubsidyDetail(id);
          if (mockFallback2) {
            return buildResponse(mockFallback2, 'mock');
          }
          throw error;
        }
      
      default:
        throw new JGrantsError(`Subsidy not found: ${id}`, 404);
    }
  }
  
  /**
   * D1キャッシュから生行データ取得（detail_ready判定用）
   * SSOT対応: canonical_id → latest_cache_id → subsidy_cache
   */
  private async getDetailFromCacheRaw(id: string): Promise<any | null> {
    try {
      // Step 1: id で直接 subsidy_cache を検索
      let row = await this.db
        .prepare(`SELECT * FROM subsidy_cache WHERE id = ? AND expires_at > datetime('now')`)
        .bind(id)
        .first();
      
      if (row) {
        return row;
      }
      
      // Step 2: canonical_id として扱い latest_cache_id 経由で検索
      const canonical = await this.db
        .prepare(`
          SELECT c.latest_cache_id, sc.*
          FROM subsidy_canonical c
          LEFT JOIN subsidy_cache sc ON sc.id = c.latest_cache_id
          WHERE c.id = ? AND sc.expires_at > datetime('now')
        `)
        .bind(id)
        .first();
      
      if (canonical) {
        console.log(`[Adapter] Resolved canonical_id ${id} → cache_id ${canonical.latest_cache_id}`);
        return canonical;
      }
      
      return null;
    } catch (error) {
      console.error('Cache detail raw error:', error);
      return null;
    }
  }
  
  /**
   * 生行データをJGrantsDetailResultにパース
   * ⚠️ 重要: row の基本フィールド（id, title等）と detail_json をマージして返す
   * detail_json は subsidy_overview, eligible_expenses 等の詳細フィールドを含む
   * row は id, title, subsidy_max_limit 等の基本検索フィールドを含む
   */
  private parseDetailRow(row: any): JGrantsDetailResult | null {
    if (!row) return null;
    
    // 基本フィールドを取得
    const baseFields = this.rowToSubsidy(row) as JGrantsDetailResult;
    
    // detail_json がある場合はマージ
    if (row.detail_json) {
      try {
        const detailData = JSON.parse(row.detail_json as string);
        
        // detail_json の構造を JGrantsDetailResult にマッピング
        // ⚠️ detail_json は独自構造（subsidy_overview等）を持つ場合がある
        // ⚠️ フロントエンドとの整合性: フロントが使用するフィールド名に合わせる
        
        // 概要テキストの取得（優先順位付き）
        const overviewText = detailData.subsidy_overview || detailData.overview || baseFields.description || '';
        const targetText = detailData.target_businesses || detailData.eligible_businesses || '';
        
        // ⚠️ 重要: detailData を先に展開し、明示的マッピングを後に配置
        // これにより、フロントエンド用の変換済みフィールドが優先される
        return {
          // 1. detailData の全フィールドを展開（生データ）
          ...detailData,
          
          // 2. baseFields で上書き（id, title等の必須フィールド）
          ...baseFields,
          
          // 3. フロントエンド用の明示的マッピング（最優先）
          // 概要・説明（フロントエンドは subsidy_summary, outline, overview を使用）
          overview: overviewText,
          subsidy_summary: overviewText, // フロントエンド用エイリアス
          outline: overviewText, // フロントエンド用エイリアス
          description: detailData.subsidy_purpose || detailData.description || baseFields.description,
          
          // 対象事業（フロントエンドは target, target_businesses を使用）
          target_businesses: targetText,
          target: targetText, // フロントエンド用エイリアス
          
          // 対象経費（オブジェクトの場合はJSON文字列化）
          eligible_expenses: typeof detailData.eligible_expenses === 'object' 
            ? JSON.stringify(detailData.eligible_expenses) 
            : detailData.eligible_expenses,
          // 必要書類（オブジェクトの場合はJSON文字列化）
          required_documents: typeof detailData.required_documents === 'object'
            ? JSON.stringify(detailData.required_documents)
            : detailData.required_documents,
          // 申請要件（オブジェクトの場合はJSON文字列化）
          application_requirements: typeof detailData.eligibility_requirements === 'object'
            ? JSON.stringify(detailData.eligibility_requirements)
            : detailData.eligibility_requirements || detailData.application_requirements,
          
          // 実施機関・事務局情報
          implementing_agency: detailData.issuer || detailData.issuer_department || detailData.implementing_agency,
          subsidy_executing_organization: detailData.secretariat || detailData.subsidy_executing_organization || 
            (detailData.issuer ? `${detailData.issuer}${detailData.issuer_department ? ` ${detailData.issuer_department}` : ''}` : ''),
          
          // 対象地域（フロントエンドは target_area を使用）
          target_area: detailData.target_area || baseFields.target_area_search || '全国',
          
          // 添付ファイル（オブジェクト形式の場合はフラット化）
          attachments: (() => {
            let rawAttachments = detailData.attachments || baseFields.attachments || [];
            if (rawAttachments && typeof rawAttachments === 'object' && !Array.isArray(rawAttachments)) {
              rawAttachments = Object.values(rawAttachments).flat();
            }
            return Array.isArray(rawAttachments) ? rawAttachments : [];
          })(),
        };
      } catch (e) {
        console.error('[parseDetailRow] Failed to parse detail_json:', e);
        return baseFields;
      }
    }
    return baseFields;
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

  // isSearchable は wall-chat-ready.ts の checkSearchableFromJson に移行済み

  /**
   * D1キャッシュから検索
   * 凍結仕様: SEARCHABLE条件を満たす補助金のみ返す（壁打ち成立を保証）
   * P0-2-1: includeUnready=true の場合は未整備も含める（super_admin debug用）
   * 2026-01-27: 申請期限が今日以降のもののみ表示（期限切れ案件を除外）
   */
  private async searchFromCache(params: AdapterSearchParams): Promise<Omit<AdapterSearchResponse, 'source' | 'gate'> & { gate: 'searchable-only' | 'debug:all' }> {
    try {
      const includeUnready = params.includeUnready === true;
      
      // 今日の日付（JST）を取得してISO形式に
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
      
      // SQLレベルでは基本的なフィルタ
      let query = `
        SELECT * FROM subsidy_cache 
        WHERE expires_at > datetime('now')
      `;
      const bindings: any[] = [];
      
      // 申請期限が今日以降のもののみ（期限切れを除外）
      // acceptance_end_datetime が NULL または今日以降の場合のみ表示
      // includeUnready の場合は期限切れも含める（debug用）
      if (!includeUnready) {
        query += ` AND (acceptance_end_datetime IS NULL OR acceptance_end_datetime >= ?)`;
        bindings.push(todayStr);
      }
      
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
      
      // ソート（tie-breaker: id で順序安定化）
      if (params.sort === 'acceptance_end_datetime') {
        query += ` ORDER BY acceptance_end_datetime ${params.order || 'ASC'}, id ASC`;
      } else if (params.sort === 'subsidy_max_limit') {
        query += ` ORDER BY subsidy_max_limit ${params.order || 'DESC'}, id ASC`;
      } else {
        query += ` ORDER BY cached_at DESC, id ASC`;
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
            checkSearchableFromJson(row.detail_json as string | null)
          );
      
      // ページネーション適用
      const offset = params.offset || 0;
      const limit = params.limit || 20;
      const paginatedRows = filteredRows.slice(offset, offset + limit);
      
      // 各補助金にdetail_ready, wall_chat_readyフラグを付与
      const subsidies = paginatedRows.map(row => {
        const subsidy = this.rowToSubsidy(row);
        const detailJsonStr = row.detail_json as string | null;
        const wallChatResult = checkWallChatReadyFromJson(detailJsonStr);
        (subsidy as any).detail_ready = checkSearchableFromJson(detailJsonStr);
        (subsidy as any).wall_chat_ready = wallChatResult.ready;
        (subsidy as any).wall_chat_missing = wallChatResult.missing;
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
  private rowToSubsidy(row: any): JGrantsSearchResult & Partial<JGrantsDetailResult> {
    return {
      // 必須の基本フィールド
      id: row.id,
      title: row.title,
      name: row.title, // name も title と同じ値を設定（フォールバック用）
      // 検索用フィールド
      subsidy_max_limit: row.subsidy_max_limit,
      subsidy_rate: row.subsidy_rate,
      target_area_search: row.target_area_search,
      target_industry: row.target_industry,
      target_number_of_employees: row.target_number_of_employees,
      acceptance_start_datetime: row.acceptance_start_datetime,
      acceptance_end_datetime: row.acceptance_end_datetime,
      request_reception_display_flag: row.request_reception_display_flag,
      // 詳細フィールド（DB行から取得できる場合）
      description: row.description,
      overview: row.overview,
      subsidy_executing_organization: row.subsidy_executing_organization,
    };
  }
}

/**
 * ファクトリ関数
 */
export function createJGrantsAdapter(env: Env): JGrantsAdapter {
  return new JGrantsAdapter(env);
}

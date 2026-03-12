/**
 * Agency: クライアント管理
 * 
 * GET    /clients                - 顧客一覧
 * POST   /clients                - 顧客追加
 * POST   /clients/import-csv     - CSV一括インポート
 * GET    /clients/import-template - CSVテンプレート取得
 * GET    /clients/:id            - 顧客詳細
 * PUT    /clients/:id            - 顧客更新
 * PUT    /clients/:id/company    - 顧客の会社情報更新
 * GET    /clients/:id/facts      - 顧客のfacts取得（Phase 1b）
 * PUT    /clients/:id/facts      - 顧客のfacts更新（Phase 1b）
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency, generateId, parseIntWithLimits, safeParseJsonBody, calculateEmployeeBand, LIMITS } from './_helpers';
import { sendClientInviteEmail } from '../../services/email';

const clients = new Hono<{ Bindings: Env; Variables: Variables }>();

clients.get('/clients', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const agencyId = agencyInfo.agency.id;
  const { status, search, limit: limitStr, offset: offsetStr } = c.req.query();
  
  // P0-3: 境界値チェック
  const parsedLimit = parseIntWithLimits(limitStr, LIMITS.DEFAULT_PAGE_SIZE, LIMITS.MIN_PAGE_SIZE, LIMITS.MAX_PAGE_SIZE);
  const parsedOffset = parseIntWithLimits(offsetStr, 0, 0, Number.MAX_SAFE_INTEGER);
  
  let query = `
    SELECT 
      ac.*,
      c.name as company_name,
      c.prefecture,
      c.industry_major as industry,
      c.employee_count,
      (SELECT COUNT(*) FROM application_drafts ad WHERE ad.company_id = ac.company_id) as draft_count,
      (SELECT MAX(created_at) FROM chat_sessions cs WHERE cs.company_id = ac.company_id) as last_chat_at
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
  `;
  const params: (string | number)[] = [agencyId];
  
  if (status) {
    query += ' AND ac.status = ?';
    params.push(status);
  }
  
  if (search) {
    query += ' AND (ac.client_name LIKE ? OR c.name LIKE ? OR ac.client_email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY ac.created_at DESC LIMIT ? OFFSET ?';
  params.push(parsedLimit, parsedOffset);
  
  const clients = await db.prepare(query).bind(...params).all();
  
  // 総数
  let countQuery = 'SELECT COUNT(*) as count FROM agency_clients ac WHERE ac.agency_id = ?';
  const countParams: (string | number)[] = [agencyId];
  if (status) {
    countQuery += ' AND ac.status = ?';
    countParams.push(status);
  }
  const total = await db.prepare(countQuery).bind(...countParams).first<{ count: number }>();
  
  // 凍結仕様: id を必ず返す + agency_client_id エイリアス追加（互換用）
  // + completeness_status を計算して返す（検索画面用）
  // id 欠損があればログ出力（データ健全性監視）
  const safeClients = (clients?.results || []).map((client: Record<string, unknown>) => {
    if (!client.id) {
      console.warn('[Agency API] client.id is missing:', JSON.stringify(client));
    }
    
    // completeness_status を計算
    // 必須4項目: company_name, prefecture, industry, employee_count
    const hasName = !!(client.company_name && String(client.company_name).trim());
    const hasPrefecture = !!(client.prefecture && String(client.prefecture).trim());
    const hasIndustry = !!(client.industry && String(client.industry).trim());
    // employee_count は文字列（'1-5'等）または数値に対応
    const empVal = client.employee_count;
    const hasEmployeeCount = (() => {
      if (!empVal) return false;
      if (typeof empVal === 'string') {
        const trimmed = empVal.trim();
        return trimmed !== '' && trimmed !== '0';
      }
      return (empVal as number) > 0;
    })();
    
    const isComplete = hasName && hasPrefecture && hasIndustry && hasEmployeeCount;
    
    // 不足フィールドのリスト
    const missingFields: string[] = [];
    if (!hasName) missingFields.push('会社名');
    if (!hasPrefecture) missingFields.push('都道府県');
    if (!hasIndustry) missingFields.push('業種');
    if (!hasEmployeeCount) missingFields.push('従業員数');
    
    return {
      ...client,
      // 互換用エイリアス（UIが揺れても壊れない）
      agency_client_id: client.id,
      client_id: client.id,
      // completeness情報（検索画面用）
      completeness_status: isComplete ? 'OK' : 'BLOCKED',
      missing_fields: missingFields,
    };
  });
  
  // 集計: OK顧客数 / BLOCKED顧客数
  const okCount = safeClients.filter(c => c.completeness_status === 'OK').length;
  const blockedCount = safeClients.filter(c => c.completeness_status === 'BLOCKED').length;
  
  return c.json<ApiResponse<{
    clients: typeof safeClients;
    total: number;
    limit: number;
    offset: number;
    ok_count: number;
    blocked_count: number;
  }>>({
    success: true,
    data: {
      clients: safeClients,
      total: total?.count || 0,
      limit: parsedLimit,
      offset: parsedOffset,
      ok_count: okCount,
      blocked_count: blockedCount,
    },
  });
});

/**
 * POST /api/agency/clients - 顧客追加
 */
clients.post('/clients', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    companyName?: string;
    prefecture?: string;
    industry?: string;
    employeeCount?: number | string;
    notes?: string;
    tags?: string[];
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { clientName, clientEmail, clientPhone, companyName, prefecture, industry, employeeCount, notes, tags } = parseResult.data;
  
  if (!clientName || !companyName) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'clientName and companyName are required' },
    }, 400);
  }
  
  // P0-1: employee_count の正規化（文字列→数値変換）
  // 入力がない場合は null（completeness チェックで BLOCKED になる）
  const normalizedEmployeeCount = employeeCount !== undefined && employeeCount !== null && employeeCount !== ''
    ? Math.max(0, Number(employeeCount) || 0)
    : 0;
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  // 会社を作成
  const companyId = generateId();
  // 必須カラム: name, prefecture, industry_major, employee_count, employee_band
  // P0-2: prefecture デフォルトを null に変更（東京都を勝手に設定しない）
  // P0-4: calculateEmployeeBand使用
  await db.prepare(`
    INSERT INTO companies (id, name, prefecture, industry_major, employee_count, employee_band, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    companyId, 
    companyName, 
    prefecture || null, // P0-2: デフォルトを null に変更（completeness で BLOCKED になる）
    industry || null, // P0-2: デフォルトを null に変更
    normalizedEmployeeCount, // P0-1: 正規化された従業員数
    calculateEmployeeBand(normalizedEmployeeCount),
    now, 
    now
  ).run();
  
  // company_profileも作成（company_id がPK）
  await db.prepare(`
    INSERT INTO company_profile (company_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).bind(companyId, now, now).run();
  
  // agency_clientとして登録
  const clientId = generateId();
  await db.prepare(`
    INSERT INTO agency_clients (id, agency_id, company_id, client_name, client_email, client_phone, notes, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    clientId, agencyId, companyId, clientName,
    clientEmail || null, clientPhone || null, notes || null,
    tags ? JSON.stringify(tags) : null, now, now
  ).run();
  
  return c.json<ApiResponse<{ id: string; companyId: string }>>({
    success: true,
    data: { id: clientId, companyId },
  }, 201);
});

/**
 * POST /api/agency/clients/import-csv - 顧客CSVインポート
 * CSVの列順序: 顧客名, 会社名, メール, 電話, 都道府県, 業種, 従業員数, 備考
 */
clients.post('/clients/import-csv', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    csvData?: string;
    skipHeader?: boolean;
    updateExisting?: boolean; // 既存顧客の更新を許可するか
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { csvData, skipHeader = true, updateExisting = false } = parseResult.data;
  
  if (!csvData) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'csvData is required' },
    }, 400);
  }
  
  const agencyId = agencyInfo.agency.id;
  const now = new Date().toISOString();
  
  // CSV解析
  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  const dataLines = skipHeader && lines.length > 0 ? lines.slice(1) : lines;
  
  if (dataLines.length === 0) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No data rows in CSV' },
    }, 400);
  }
  
  // 制限: 一度に最大100件
  if (dataLines.length > 100) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 rows per import. Please split your CSV file.' },
    }, 400);
  }
  
  // CSVカラム解析ヘルパー
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  }
  
  // 都道府県名→コード変換（逆引き）
  const PREFECTURE_NAME_TO_CODE: Record<string, string> = {};
  for (const [code, name] of Object.entries(PREFECTURE_CODES)) {
    PREFECTURE_NAME_TO_CODE[name] = code;
    // 「都」「府」「県」を省略した形式も対応
    const shortName = name.replace(/(都|府|県)$/, '');
    PREFECTURE_NAME_TO_CODE[shortName] = code;
  }
  
  // 業種マッピング（略称・表記揺れを標準形式に正規化）
  // 注意: 補助金マッチングは日本語でtarget_industryと比較するため、日本語のまま保持
  const INDUSTRY_MAP: Record<string, string> = {
    '製造': '製造業',
    '建設': '建設業',
    'IT': '情報通信業', 'IT業': '情報通信業', '情報サービス': '情報通信業', 'ソフトウェア': '情報通信業',
    '卸売': '卸売業、小売業', '卸売業': '卸売業、小売業',
    '小売': '卸売業、小売業', '小売業': '卸売業、小売業',
    '飲食': '宿泊業、飲食サービス業', '飲食業': '宿泊業、飲食サービス業', '飲食店': '宿泊業、飲食サービス業',
    'サービス': 'サービス業（他に分類されないもの）', 'サービス業': 'サービス業（他に分類されないもの）',
    '医療': '医療、福祉', '医療業': '医療、福祉', 'ヘルスケア': '医療、福祉',
    '福祉': '医療、福祉', '介護': '医療、福祉',
    '教育': '教育、学習支援業', '教育業': '教育、学習支援業',
    '不動産': '不動産業、物品賃貸業', '不動産業': '不動産業、物品賃貸業',
    '金融': '金融業、保険業', '金融業': '金融業、保険業', '保険': '金融業、保険業',
    '運輸': '運輸業、郵便業', '運輸業': '運輸業、郵便業', '物流': '運輸業、郵便業',
    '農業': '農業、林業', '農林水産': '農業、林業',
  };
  
  const results: {
    success: number;
    failed: number;
    updated: number;
    errors: Array<{ row: number; message: string }>;
    created: Array<{ row: number; clientName: string; companyName: string; clientId: string }>;
  } = {
    success: 0,
    failed: 0,
    updated: 0,
    errors: [],
    created: [],
  };
  
  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = skipHeader ? i + 2 : i + 1; // ヘッダー行を考慮した行番号
    const line = dataLines[i];
    
    try {
      const cols = parseCSVLine(line);
      
      // 最低2カラム必要（顧客名、会社名）
      if (cols.length < 2) {
        results.errors.push({ row: rowNum, message: '顧客名と会社名は必須です' });
        results.failed++;
        continue;
      }
      
      const clientName = cols[0]?.trim();
      const companyName = cols[1]?.trim();
      const clientEmail = cols[2]?.trim() || null;
      const clientPhone = cols[3]?.trim() || null;
      const prefectureInput = cols[4]?.trim() || null;
      const industryInput = cols[5]?.trim() || null;
      const employeeCountInput = cols[6]?.trim() || null;
      const notes = cols[7]?.trim() || null;
      
      if (!clientName) {
        results.errors.push({ row: rowNum, message: '顧客名が空です' });
        results.failed++;
        continue;
      }
      
      if (!companyName) {
        results.errors.push({ row: rowNum, message: '会社名が空です' });
        results.failed++;
        continue;
      }
      
      // 都道府県変換
      let prefecture: string | null = null;
      if (prefectureInput) {
        prefecture = PREFECTURE_NAME_TO_CODE[prefectureInput] || prefectureInput;
        // 2桁コードかチェック
        if (prefecture && !/^\d{1,2}$/.test(prefecture)) {
          results.errors.push({ row: rowNum, message: `不正な都道府県: ${prefectureInput}` });
          results.failed++;
          continue;
        }
      }
      
      // 業種変換
      let industry: string | null = null;
      if (industryInput) {
        industry = INDUSTRY_MAP[industryInput] || industryInput;
      }
      
      // 従業員数変換
      const normalizedEmployeeCount = employeeCountInput 
        ? Math.max(0, parseInt(employeeCountInput.replace(/[,人名]/g, ''), 10) || 0)
        : 0;
      
      // updateExistingがtrueの場合、同じ会社名の既存顧客を探す
      if (updateExisting) {
        const existingClient = await db.prepare(`
          SELECT ac.id, ac.company_id FROM agency_clients ac
          JOIN companies c ON ac.company_id = c.id
          WHERE ac.agency_id = ? AND c.name = ?
        `).bind(agencyId, companyName).first<{ id: string; company_id: string }>();
        
        if (existingClient) {
          // 既存顧客を更新
          await db.prepare(`
            UPDATE agency_clients SET
              client_name = ?,
              client_email = COALESCE(?, client_email),
              client_phone = COALESCE(?, client_phone),
              notes = COALESCE(?, notes),
              updated_at = ?
            WHERE id = ?
          `).bind(
            clientName,
            clientEmail,
            clientPhone,
            notes,
            now,
            existingClient.id
          ).run();
          
          // 会社情報も更新
          await db.prepare(`
            UPDATE companies SET
              prefecture = COALESCE(?, prefecture),
              industry_major = COALESCE(?, industry_major),
              employee_count = CASE WHEN ? > 0 THEN ? ELSE employee_count END,
              employee_band = CASE WHEN ? > 0 THEN ? ELSE employee_band END,
              updated_at = ?
            WHERE id = ?
          `).bind(
            prefecture,
            industry,
            normalizedEmployeeCount,
            normalizedEmployeeCount,
            normalizedEmployeeCount,
            calculateEmployeeBand(normalizedEmployeeCount),
            now,
            existingClient.company_id
          ).run();
          
          results.updated++;
          continue;
        }
      }
      
      // 新規作成
      const companyId = generateId();
      const clientId = generateId();
      
      await db.prepare(`
        INSERT INTO companies (id, name, prefecture, industry_major, employee_count, employee_band, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        companyId,
        companyName,
        prefecture,
        industry,
        normalizedEmployeeCount,
        calculateEmployeeBand(normalizedEmployeeCount),
        now,
        now
      ).run();
      
      await db.prepare(`
        INSERT INTO company_profile (company_id, created_at, updated_at)
        VALUES (?, ?, ?)
      `).bind(companyId, now, now).run();
      
      await db.prepare(`
        INSERT INTO agency_clients (id, agency_id, company_id, client_name, client_email, client_phone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        clientId,
        agencyId,
        companyId,
        clientName,
        clientEmail,
        clientPhone,
        notes,
        now,
        now
      ).run();
      
      results.success++;
      results.created.push({ row: rowNum, clientName, companyName, clientId });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({ row: rowNum, message: `処理エラー: ${errorMessage}` });
      results.failed++;
    }
  }
  
  return c.json<ApiResponse<typeof results>>({
    success: true,
    data: results,
  }, results.failed > 0 && results.success === 0 ? 400 : 201);
});

/**
 * GET /api/agency/clients/import-template - CSVテンプレートダウンロード
 */
clients.get('/clients/import-template', async (c) => {
  const csvContent = `顧客名,会社名,メールアドレス,電話番号,都道府県,業種,従業員数,備考
山田太郎,株式会社サンプル,yamada@example.com,03-1234-5678,東京都,製造業,50,重要顧客
鈴木花子,有限会社テスト,suzuki@test.co.jp,06-9876-5432,大阪府,IT業,20,`;

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clients_import_template.csv"',
    },
  });
});

/**
 * GET /api/agency/clients/:id - 顧客詳細
 */
clients.get('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  const client = await db.prepare(`
    SELECT 
      ac.*,
      c.*,
      cp.*
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    LEFT JOIN company_profile cp ON c.id = cp.company_id
    WHERE ac.id = ? AND ac.agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  // 関連データ取得
  const [links, submissions, drafts, sessions] = await Promise.all([
    db.prepare('SELECT * FROM access_links WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM intake_submissions WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM application_drafts WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
    db.prepare('SELECT * FROM chat_sessions WHERE company_id = ? ORDER BY created_at DESC LIMIT 10')
      .bind(client.company_id).all(),
  ]);
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      client,
      links: links?.results || [],
      submissions: submissions?.results || [],
      drafts: drafts?.results || [],
      sessions: sessions?.results || [],
    },
  });
});

/**
 * PUT /api/agency/clients/:id - 顧客更新
 */
clients.put('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // P1-9: JSON parse例外ハンドリング
  const parseResult = await safeParseJsonBody<{
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    status?: string;
    notes?: string;
    tags?: string[];
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const { clientName, clientEmail, clientPhone, status, notes, tags } = parseResult.data;
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    UPDATE agency_clients SET
      client_name = COALESCE(?, client_name),
      client_email = COALESCE(?, client_email),
      client_phone = COALESCE(?, client_phone),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      tags_json = COALESCE(?, tags_json),
      updated_at = ?
    WHERE id = ? AND agency_id = ?
  `).bind(
    clientName || null, clientEmail || null, clientPhone || null,
    status || null, notes || null, tags ? JSON.stringify(tags) : null,
    now, clientId, agencyInfo.agency.id
  ).run();
  
  if (!result.meta.changes) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  return c.json<ApiResponse<{ message: string }>>({
    success: true,
    data: { message: 'Updated' },
  });
});

/**
 * PUT /api/agency/clients/:id/company - 顧客企業情報更新
 * 
 * agency_clientsではなく、紐付いたcompaniesテーブルを更新
 */
clients.put('/clients/:id/company', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');
  
  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }
  
  // 顧客の所有確認とcompany_id取得
  const client = await db.prepare(`
    SELECT company_id FROM agency_clients WHERE id = ? AND agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first<{ company_id: string }>();
  
  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }
  
  // P1-9: JSON parse例外ハンドリング
  // Phase 1a: corporate (profile.ts) と同等のフィールドを受け付ける
  const parseResult = await safeParseJsonBody<{
    // === companies テーブル ===
    companyName?: string;
    postal_code?: string;
    prefecture?: string;
    city?: string;
    industry_major?: string;
    industry_minor?: string;
    employee_count?: number;
    capital?: number;
    established_date?: string;
    annual_revenue?: number;
    // === company_profile テーブル ===
    representative_name?: string;
    representative_title?: string;
    corp_number?: string;
    corp_type?: string;
    founding_year?: number;
    founding_month?: number;
    website_url?: string;
    contact_email?: string;
    contact_phone?: string;
    business_summary?: string;
    main_products?: string;
    main_customers?: string;
    competitive_advantage?: string;
    fiscal_year_end?: number;
    is_profitable?: number | boolean;
    has_debt?: number | boolean;
    past_subsidies_json?: string;
    desired_investments_json?: string;
    current_challenges_json?: string;
    has_young_employees?: number | boolean;
    has_female_executives?: number | boolean;
    has_senior_employees?: number | boolean;
    plans_to_hire?: number | boolean;
    certifications_json?: string;
    constraints_json?: string;
    notes?: string;
  }>(c);
  
  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }
  
  const body = parseResult.data;
  const now = new Date().toISOString();
  
  // ============================================================
  // Phase 1a: バリデーション（profile.ts と意味的に統一）
  // ============================================================
  const fieldErrors: Record<string, string> = {};

  // 数値バリデーション
  if (body.employee_count !== undefined && body.employee_count !== null) {
    const ec = Number(body.employee_count);
    if (isNaN(ec) || ec < 0 || !Number.isInteger(ec)) {
      fieldErrors.employee_count = '従業員数は0以上の整数で入力してください';
    }
  }
  if (body.capital !== undefined && body.capital !== null) {
    const cap = Number(body.capital);
    if (isNaN(cap) || cap < 0) {
      fieldErrors.capital = '資本金は0以上の数値で入力してください';
    }
  }
  if (body.annual_revenue !== undefined && body.annual_revenue !== null) {
    const rev = Number(body.annual_revenue);
    if (isNaN(rev) || rev < 0) {
      fieldErrors.annual_revenue = '年商は0以上の数値で入力してください';
    }
  }
  if (body.founding_year !== undefined && body.founding_year !== null) {
    const fy = Number(body.founding_year);
    if (isNaN(fy) || fy < 1800 || fy > new Date().getFullYear()) {
      fieldErrors.founding_year = '創業年は1800〜現在年の範囲で入力してください';
    }
  }
  if (body.founding_month !== undefined && body.founding_month !== null) {
    const fm = Number(body.founding_month);
    if (isNaN(fm) || fm < 1 || fm > 12) {
      fieldErrors.founding_month = '創業月は1〜12の範囲で入力してください';
    }
  }
  if (body.fiscal_year_end !== undefined && body.fiscal_year_end !== null) {
    const fye = Number(body.fiscal_year_end);
    if (isNaN(fye) || fye < 1 || fye > 12) {
      fieldErrors.fiscal_year_end = '決算期は1〜12の範囲で入力してください';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return c.json<ApiResponse<any>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: fieldErrors },
    }, 400);
  }

  // ============================================================
  // companies テーブル更新（データドリブン: profile.ts L227 と同じフィールドリスト）
  // ============================================================
  const companyFieldDefs: Array<{ key: string; dbColumn: string }> = [
    { key: 'companyName', dbColumn: 'name' },
    { key: 'postal_code', dbColumn: 'postal_code' },
    { key: 'prefecture', dbColumn: 'prefecture' },
    { key: 'city', dbColumn: 'city' },
    { key: 'industry_major', dbColumn: 'industry_major' },
    { key: 'industry_minor', dbColumn: 'industry_minor' },
    { key: 'employee_count', dbColumn: 'employee_count' },
    { key: 'capital', dbColumn: 'capital' },
    { key: 'established_date', dbColumn: 'established_date' },
    { key: 'annual_revenue', dbColumn: 'annual_revenue' },
  ];

  const companyUpdateFields: string[] = [];
  const companyUpdateValues: (string | number | null)[] = [];

  for (const { key, dbColumn } of companyFieldDefs) {
    const val = (body as any)[key];
    if (val !== undefined) {
      companyUpdateFields.push(`${dbColumn} = ?`);
      companyUpdateValues.push(val);
    }
  }

  // employee_band 自動計算（employee_count が更新された場合）
  if (body.employee_count !== undefined) {
    companyUpdateFields.push('employee_band = ?');
    companyUpdateValues.push(calculateEmployeeBand(body.employee_count));
  }
  
  if (companyUpdateFields.length > 0) {
    companyUpdateFields.push('updated_at = ?');
    companyUpdateValues.push(now);
    companyUpdateValues.push(client.company_id);
    
    await db.prepare(`
      UPDATE companies SET ${companyUpdateFields.join(', ')} WHERE id = ?
    `).bind(...companyUpdateValues).run();
  }
  
  // ============================================================
  // company_profile テーブル更新（Phase 1a: profile.ts L248-255 と同じフィールドリスト）
  // ============================================================
  const profileFieldList = [
    'corp_number', 'corp_type', 'representative_name', 'representative_title',
    'founding_year', 'founding_month', 'website_url', 'contact_email', 'contact_phone',
    'business_summary', 'main_products', 'main_customers', 'competitive_advantage',
    'fiscal_year_end', 'is_profitable', 'has_debt',
    'past_subsidies_json', 'desired_investments_json', 'current_challenges_json',
    'has_young_employees', 'has_female_executives', 'has_senior_employees', 'plans_to_hire',
    'certifications_json', 'constraints_json', 'notes',
  ];

  const profileUpdateFields: string[] = [];
  const profileUpdateValues: (string | number | null)[] = [];

  for (const field of profileFieldList) {
    const val = (body as any)[field];
    if (val !== undefined) {
      profileUpdateFields.push(`${field} = ?`);
      profileUpdateValues.push(val);
    }
  }
  
  if (profileUpdateFields.length > 0) {
    // upsert: company_profile が存在するか確認
    const existingProfile = await db.prepare(
      'SELECT company_id FROM company_profile WHERE company_id = ?'
    ).bind(client.company_id).first();

    if (existingProfile) {
      // UPDATE
      profileUpdateFields.push('updated_at = ?');
      profileUpdateValues.push(now);
      profileUpdateValues.push(client.company_id);
      
      await db.prepare(`
        UPDATE company_profile SET ${profileUpdateFields.join(', ')} WHERE company_id = ?
      `).bind(...profileUpdateValues).run();
    } else {
      // INSERT（profile.ts L285-291 と同じパターン）
      const insertFieldNames = ['company_id', ...profileFieldList.filter(f => (body as any)[f] !== undefined), 'updated_at', 'created_at'];
      const insertPlaceholders = insertFieldNames.map(() => '?').join(', ');
      const insertValues = [
        client.company_id,
        ...profileFieldList.filter(f => (body as any)[f] !== undefined).map(f => (body as any)[f]),
        now,
        now,
      ];
      
      await db.prepare(`
        INSERT INTO company_profile (${insertFieldNames.join(', ')}) VALUES (${insertPlaceholders})
      `).bind(...insertValues).run();
    }
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: { message: 'Company information updated' },
  });
});

// ============================================================
// Phase 1b: chat_facts CRUD（会社レベル fact のみ）
// ============================================================

/**
 * 正準 fact キー一覧
 * Phase 0.5 の 5-A で定義されたもののみ受け付ける。
 * ここに含まれないキーは拒否する（任意キーの混入防止）。
 */
const CANONICAL_FACT_KEYS = [
  'has_gbiz_id',
  'is_invoice_registered',
  'plans_wage_raise',
  'tax_arrears',
  'past_subsidy_same_type',
  'has_business_plan',
  'has_keiei_kakushin',
  'has_jigyou_keizoku',
] as const;

/** fact キーの日本語ラベル */
const FACT_KEY_LABELS_JA: Record<string, string> = {
  has_gbiz_id: 'GビズIDプライム取得済み',
  is_invoice_registered: 'インボイス登録済み',
  plans_wage_raise: '賃上げ予定',
  tax_arrears: '税金滞納',
  past_subsidy_same_type: '同種補助金受給歴',
  has_business_plan: '事業計画書あり',
  has_keiei_kakushin: '経営革新計画承認',
  has_jigyou_keizoku: '事業継続力強化計画認定',
};

/**
 * boolean 値を正規化
 * Phase 0.5 の 5-B ルール: true/1/yes/はい → "true"、false/0/no/いいえ → "false"
 * null は「未確認に戻す」
 */
function normalizeBooleanFactValue(value: unknown): string | null {
  if (value === null) return null; // 明示的に「未確認に戻す」
  if (value === undefined) return undefined as any; // スキップ用（呼び出し元で処理）
  
  const strVal = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'はい'].includes(strVal)) return 'true';
  if (['false', '0', 'no', 'いいえ'].includes(strVal)) return 'false';
  
  // パースできない場合はそのまま文字列として保存
  return String(value);
}

/**
 * GET /api/agency/clients/:id/facts - 顧客のfacts取得
 * 
 * 会社レベル fact (subsidy_id = NULL) をすべて返す。
 * canonical キー以外の追加 fact も含む（チャット由来のものなど）。
 */
clients.get('/clients/:id/facts', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');

  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }

  // 顧客の所有確認と company_id 取得
  const client = await db.prepare(`
    SELECT company_id FROM agency_clients WHERE id = ? AND agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first<{ company_id: string }>();

  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }

  // 会社レベル fact (subsidy_id IS NULL) をすべて取得
  const factsResult = await db.prepare(`
    SELECT fact_key, fact_value, source, confidence, updated_at, created_at
    FROM chat_facts
    WHERE company_id = ? AND subsidy_id IS NULL
    ORDER BY fact_key ASC
  `).bind(client.company_id).all<{
    fact_key: string;
    fact_value: string | null;
    source: string | null;
    confidence: number | null;
    updated_at: string | null;
    created_at: string | null;
  }>();

  const facts = (factsResult.results || []).map(f => ({
    fact_key: f.fact_key,
    fact_value: f.fact_value,
    label_ja: FACT_KEY_LABELS_JA[f.fact_key] || f.fact_key,
    is_canonical: (CANONICAL_FACT_KEYS as readonly string[]).includes(f.fact_key),
    source: f.source,
    confidence: f.confidence,
    updated_at: f.updated_at,
  }));

  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      company_id: client.company_id,
      facts,
      canonical_keys: CANONICAL_FACT_KEYS,
    },
  });
});

/**
 * PUT /api/agency/clients/:id/facts - 顧客のfacts更新（upsert）
 * 
 * Phase 1b: 士業が代理で会社レベル fact を設定する。
 * - canonical キーのみ受け付け（任意キーの書き込みは拒否）
 * - boolean 値は自動正規化（true/1/yes/はい → "true"）
 * - null 送信 → fact_value = null（「未確認に戻す」）
 * - undefined（キー未送信）→ スキップ（既存値を変更しない）
 * - source は 'agency_input' で固定
 */
clients.put('/clients/:id/facts', async (c) => {
  const db = c.env.DB;
  const user = getCurrentUser(c);
  const clientId = c.req.param('id');

  const agencyInfo = await getUserAgency(db, user.id);
  if (!agencyInfo) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_AGENCY', message: 'Agency account required' },
    }, 403);
  }

  // 顧客の所有確認と company_id 取得
  const client = await db.prepare(`
    SELECT company_id FROM agency_clients WHERE id = ? AND agency_id = ?
  `).bind(clientId, agencyInfo.agency.id).first<{ company_id: string }>();

  if (!client) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    }, 404);
  }

  // JSON パース
  const parseResult = await safeParseJsonBody<{
    facts: Record<string, boolean | string | null | undefined>;
  }>(c);

  if (!parseResult.ok) {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'INVALID_JSON', message: parseResult.error },
    }, 400);
  }

  const { facts } = parseResult.data;
  if (!facts || typeof facts !== 'object') {
    return c.json<ApiResponse<null>>({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'facts object is required' },
    }, 400);
  }

  // ============================================================
  // バリデーション: canonical キーのみ受け付け
  // ============================================================
  const unknownKeys = Object.keys(facts).filter(
    k => !(CANONICAL_FACT_KEYS as readonly string[]).includes(k)
  );
  if (unknownKeys.length > 0) {
    return c.json<ApiResponse<any>>({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Unknown fact keys: ${unknownKeys.join(', ')}. Allowed: ${CANONICAL_FACT_KEYS.join(', ')}`,
      },
    }, 400);
  }

  // ============================================================
  // upsert: profile.ts L298-320 と同じパターン（SELECT → UPDATE / INSERT）
  // source は 'agency_input' で固定
  // ============================================================
  const now = new Date().toISOString();
  let updatedCount = 0;
  let insertedCount = 0;
  let clearedCount = 0; // null に戻した数
  const errors: string[] = [];

  for (const key of CANONICAL_FACT_KEYS) {
    const rawValue = facts[key];
    
    // undefined（キー未送信）→ スキップ
    if (rawValue === undefined) continue;
    
    // boolean 値を正規化
    const normalizedValue = normalizeBooleanFactValue(rawValue);
    if (normalizedValue === undefined) continue; // safety

    try {
      // 既存の fact を確認
      const existingFact = await db.prepare(`
        SELECT id FROM chat_facts WHERE company_id = ? AND fact_key = ? AND subsidy_id IS NULL
      `).bind(client.company_id, key).first<{ id: string }>();

      if (existingFact) {
        // UPDATE（null の場合も UPDATE: 「未確認に戻す」）
        await db.prepare(`
          UPDATE chat_facts SET fact_value = ?, source = 'agency_input', confidence = 100, updated_at = ? WHERE id = ?
        `).bind(normalizedValue, now, existingFact.id).run();
        
        if (normalizedValue === null) {
          clearedCount++;
        } else {
          updatedCount++;
        }
      } else {
        // INSERT（新規 fact の作成）
        const factId = generateId();
        await db.prepare(`
          INSERT INTO chat_facts (id, user_id, company_id, subsidy_id, fact_key, fact_value, confidence, source, created_at, updated_at)
          VALUES (?, ?, ?, NULL, ?, ?, 100, 'agency_input', ?, ?)
        `).bind(factId, user.id, client.company_id, key, normalizedValue, now, now).run();
        insertedCount++;
      }
    } catch (err) {
      const errMsg = `Failed to upsert fact '${key}': ${err instanceof Error ? err.message : String(err)}`;
      console.error(errMsg);
      errors.push(errMsg);
    }
  }

  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      message: 'Facts updated',
      summary: {
        updated: updatedCount,
        inserted: insertedCount,
        cleared: clearedCount,
        errors: errors.length,
      },
      ...(errors.length > 0 ? { errors } : {}),
    },
  });
});

/**
 * POST /api/agency/links - リンク発行
 */

export default clients;

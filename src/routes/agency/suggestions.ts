/**
 * Agency: サジェスション生成
 * 
 * POST /suggestions/generate - 企業向け補助金サジェスション自動生成
 */


import { Hono } from 'hono';
import type { Env, Variables, ApiResponse } from '../../types';
import { getCurrentUser } from '../../middleware/auth';
import { getUserAgency } from './_helpers';

const suggestions = new Hono<{ Bindings: Env; Variables: Variables }>();

suggestions.post('/suggestions/generate', async (c) => {
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
  const now = new Date().toISOString();
  
  // 1. 顧客一覧を取得（BLOCKED以外 = completeness必須項目が揃っている）
  const clientsResult = await db.prepare(`
    SELECT 
      ac.id as client_id,
      ac.company_id,
      c.name as company_name,
      c.prefecture,
      c.industry_major,
      c.employee_count
    FROM agency_clients ac
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.agency_id = ?
    AND c.name IS NOT NULL AND c.name != ''
    AND c.prefecture IS NOT NULL AND c.prefecture != ''
    AND c.industry_major IS NOT NULL AND c.industry_major != ''
    AND c.employee_count IS NOT NULL AND c.employee_count != '' AND c.employee_count != '0' AND c.employee_count != 0
  `).bind(agencyId).all();
  
  const clients = clientsResult.results || [];
  
  if (clients.length === 0) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        message: 'No eligible clients found (all clients have incomplete required fields)',
        clients_processed: 0,
        suggestions_generated: 0,
      },
    });
  }
  
  // 2. 受付中の補助金を取得
  const subsidiesResult = await db.prepare(`
    SELECT 
      id,
      title,
      subsidy_max_limit,
      subsidy_rate,
      target_area_search,
      target_industry,
      target_number_of_employees,
      acceptance_end_datetime
    FROM subsidy_cache
    WHERE request_reception_display_flag = 1
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY acceptance_end_datetime ASC
    LIMIT 500
  `).all();
  
  const subsidies = subsidiesResult.results || [];
  
  if (subsidies.length === 0) {
    return c.json<ApiResponse<any>>({
      success: true,
      data: {
        message: 'No accepting subsidies found',
        clients_processed: clients.length,
        suggestions_generated: 0,
      },
    });
  }
  
  // 3. 各顧客に対してスコアリング
  const allSuggestions: any[] = [];
  
  // コード→名前のマッピング（DBにはコードで保存されている）
  const prefectureCodeToName: Record<string, string> = {
    '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
    '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
    '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
    '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
    '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
    '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
    '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
    '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
    '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
    '46': '鹿児島県', '47': '沖縄県',
  };
  
  for (const client of clients as any[]) {
    const clientPrefCode = client.prefecture || ''; // DBには '13' のようなコードで保存
    const clientPrefectureName = prefectureCodeToName[clientPrefCode] || clientPrefCode; // '13' → '東京都'
    const clientIndustry = (client.industry_major || '').toLowerCase();
    
    // 従業員数の正規化（文字列 "1-5" → 数値 3）
    let clientEmployeeCount = 0;
    const empStr = String(client.employee_count || '0');
    if (/^\d+$/.test(empStr)) {
      clientEmployeeCount = parseInt(empStr, 10);
    } else if (empStr.includes('-')) {
      const parts = empStr.split('-');
      clientEmployeeCount = Math.floor((parseInt(parts[0], 10) + parseInt(parts[1], 10)) / 2);
    } else if (empStr.includes('+') || empStr.includes('以上')) {
      clientEmployeeCount = 500; // 大企業扱い
    }
    
    const scoredSubsidies: any[] = [];
    
    for (const subsidy of subsidies as any[]) {
      let score = 0;
      const matchReasons: string[] = [];
      const riskFlags: string[] = [];
      const scoreBreakdown: Record<string, number> = {};
      
      // 地域スコア
      const targetArea = subsidy.target_area_search || '';
      const targetAreaLower = targetArea.toLowerCase();
      if (targetAreaLower.includes('全国') || targetArea === '') {
        score += 20;
        scoreBreakdown.area = 20;
        matchReasons.push('全国対象');
      } else if (targetArea.includes(clientPrefectureName) || targetArea.includes(clientPrefCode)) {
        // 都道府県名（東京都）またはコード（13）でマッチング
        score += 40;
        scoreBreakdown.area = 40;
        matchReasons.push(`${clientPrefectureName}が対象地域`);
      } else {
        scoreBreakdown.area = 0;
        riskFlags.push('対象地域外の可能性');
      }
      
      // 業種スコア
      const targetIndustry = (subsidy.target_industry || '').toLowerCase();
      if (targetIndustry.includes('全業種') || targetIndustry.includes('全て') || targetIndustry === '') {
        score += 10;
        scoreBreakdown.industry = 10;
        matchReasons.push('全業種対象');
      } else if (targetIndustry.includes(clientIndustry) || clientIndustry.includes(targetIndustry.slice(0, 3))) {
        score += 25;
        scoreBreakdown.industry = 25;
        matchReasons.push(`${client.industry_major}が対象業種`);
      } else {
        scoreBreakdown.industry = 0;
        riskFlags.push('対象業種の確認が必要');
      }
      
      // 従業員数スコア
      const targetEmployee = (subsidy.target_number_of_employees || '').toLowerCase();
      if (targetEmployee === '' || targetEmployee.includes('制限なし') || targetEmployee.includes('全規模')) {
        score += 25;
        scoreBreakdown.employee = 25;
        matchReasons.push('従業員数制限なし');
      } else if (clientEmployeeCount > 0) {
        // 簡易判定：中小企業（300人以下）向けかどうか
        const isSmallTarget = targetEmployee.includes('中小') || targetEmployee.includes('小規模') || 
                              targetEmployee.includes('300人以下') || targetEmployee.includes('50人以下');
        const isClientSmall = clientEmployeeCount <= 300;
        
        if (isSmallTarget && isClientSmall) {
          score += 25;
          scoreBreakdown.employee = 25;
          matchReasons.push('中小企業向け');
        } else if (!isSmallTarget) {
          score += 15;
          scoreBreakdown.employee = 15;
        } else {
          score -= 30;
          scoreBreakdown.employee = -30;
          riskFlags.push('従業員数条件を満たさない可能性');
        }
      } else {
        scoreBreakdown.employee = 0;
      }
      
      // 締切スコア
      if (subsidy.acceptance_end_datetime) {
        const deadline = new Date(subsidy.acceptance_end_datetime);
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 7) {
          score -= 20;
          scoreBreakdown.deadline = -20;
          riskFlags.push(`締切まであと${daysLeft}日`);
        } else if (daysLeft <= 14) {
          score -= 10;
          scoreBreakdown.deadline = -10;
          riskFlags.push(`締切まであと${daysLeft}日`);
        } else {
          scoreBreakdown.deadline = 0;
        }
      }
      
      // スコアを0〜100に正規化
      score = Math.max(0, Math.min(100, score));
      
      // ステータス判定
      let status: 'PROCEED' | 'CAUTION' | 'NO' = 'NO';
      if (score >= 80) {
        status = 'PROCEED';
      } else if (score >= 50) {
        status = 'CAUTION';
      }
      
      scoredSubsidies.push({
        subsidy_id: subsidy.id,
        score,
        status,
        match_reasons: matchReasons,
        risk_flags: riskFlags,
        score_breakdown: scoreBreakdown,
        subsidy_title: subsidy.title,
        subsidy_max_limit: subsidy.subsidy_max_limit,
        subsidy_rate: subsidy.subsidy_rate,
        acceptance_end_datetime: subsidy.acceptance_end_datetime,
      });
    }
    
    // スコア順でソートし、上位3件を取得
    scoredSubsidies.sort((a, b) => b.score - a.score);
    const top3 = scoredSubsidies.slice(0, 3);
    
    // ランク付けしてallSuggestionsに追加
    top3.forEach((suggestion, index) => {
      allSuggestions.push({
        agency_id: agencyId,
        company_id: client.company_id,
        company_name: client.company_name,
        company_prefecture: clientPrefectureName, // 都道府県名で保存（表示用）
        company_industry: client.industry_major,
        company_employee_count: clientEmployeeCount,
        rank: index + 1,
        ...suggestion,
      });
    });
  }
  
  // 4. キャッシュテーブルをUPSERT
  // まず既存データを削除
  await db.prepare('DELETE FROM agency_suggestions_cache WHERE agency_id = ?').bind(agencyId).run();
  
  // 新しいデータを挿入
  let insertCount = 0;
  for (const suggestion of allSuggestions) {
    const id = crypto.randomUUID();
    const dedupeKey = `${agencyId}:${suggestion.company_id}:${suggestion.subsidy_id}`;
    
    try {
      await db.prepare(`
        INSERT INTO agency_suggestions_cache (
          id, agency_id, company_id, subsidy_id, dedupe_key,
          score, status, rank,
          match_reasons, risk_flags,
          subsidy_title, subsidy_max_limit, subsidy_rate, acceptance_end_datetime,
          company_name, company_prefecture, company_industry, company_employee_count,
          score_breakdown, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        agencyId,
        suggestion.company_id,
        suggestion.subsidy_id,
        dedupeKey,
        suggestion.score,
        suggestion.status,
        suggestion.rank,
        JSON.stringify(suggestion.match_reasons),
        JSON.stringify(suggestion.risk_flags),
        suggestion.subsidy_title,
        suggestion.subsidy_max_limit,
        suggestion.subsidy_rate,
        suggestion.acceptance_end_datetime,
        suggestion.company_name,
        suggestion.company_prefecture,
        suggestion.company_industry,
        suggestion.company_employee_count,
        JSON.stringify(suggestion.score_breakdown),
        now
      ).run();
      insertCount++;
    } catch (e) {
      console.error('[suggestions/generate] Insert error:', e);
    }
  }
  
  return c.json<ApiResponse<any>>({
    success: true,
    data: {
      message: 'Suggestions generated successfully',
      clients_processed: clients.length,
      subsidies_evaluated: subsidies.length,
      suggestions_generated: insertCount,
      generated_at: now,
    },
  });
});

// =====================================================
// スタッフ関連API（認証不要）
// =====================================================

/**
 * POST /api/agency/staff/verify-invite - 招待トークン検証
 * 認証不要 - 招待リンクの有効性を確認
 */

export default suggestions;

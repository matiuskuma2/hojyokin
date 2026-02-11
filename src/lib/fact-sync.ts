/**
 * chat_facts → company_profile 自動反映
 * 
 * Phase 20: 壁打ちチャットで収集した情報を企業プロフィールへ自動同期
 * 
 * マッピングルール:
 * - chat_facts の fact_key → company_profile のカラム
 * - companies テーブルの基本情報も更新対象
 * - 値の型変換（string → number, boolean など）
 * - 既存値があれば上書き（チャットの回答が最新として扱う）
 */

/**
 * fact_key → company_profile カラムのマッピング
 */
/**
 * 金額文字列を円単位に正規化
 * 
 * 壁打ちチャットでの回答パターン:
 * - "5000" → 万円入力と推定: 5000万円 = 50,000,000
 * - "5000万" → 5000万円 = 50,000,000
 * - "3億" → 3億円 = 300,000,000
 * - "50000000" → 5000万（既に円単位、1,000,000以上はそのまま）
 * 
 * 判定ロジック:
 * - 「億」を含む → 億円換算
 * - 「万」を含む → 万円換算
 * - 数値のみで 1,000,000 以上 → 既に円単位とみなす
 * - 数値のみで 1,000,000 未満 → 万円入力と推定して変換
 * 
 * // TODO: 要確認 — AIコンシェルジュが fact_value に保存する形式に依存。
 * 現在は構造化質問で数値入力を促しているため、数値文字列が主。
 * 自由入力で「3億5000万」のような複合表現は未対応。
 */
function parseMoneyToYen(v: string): number | null {
  if (!v || v.trim() === '') return null;
  
  const cleaned = v.replace(/[,、\s]/g, '');
  
  // 「億」が含まれる場合
  const okuMatch = cleaned.match(/([\d.]+)\s*億/);
  if (okuMatch) {
    const oku = parseFloat(okuMatch[1]);
    if (isNaN(oku)) return null;
    // 「億」の後に「万」がある場合（例: "3億5000万"）
    const manAfterOku = cleaned.match(/億.*?([\d.]+)\s*万/);
    const manPart = manAfterOku ? parseFloat(manAfterOku[1]) * 10000 : 0;
    return oku * 100000000 + manPart;
  }
  
  // 「万」が含まれる場合
  const manMatch = cleaned.match(/([\d.]+)\s*万/);
  if (manMatch) {
    const man = parseFloat(manMatch[1]);
    if (isNaN(man)) return null;
    return man * 10000;
  }
  
  // 数値のみ
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  // 1,000,000（100万）以上はすでに円単位と見なす
  // 1,000,000 未満は万円入力と推定
  if (num >= 1000000) {
    return num;
  }
  return num * 10000;
}

const FACT_TO_PROFILE_MAP: Record<string, {
  table: 'company_profile' | 'companies';
  column: string;
  type: 'text' | 'number' | 'boolean' | 'json';
  transform?: (value: string) => any;
}> = {
  // === companies テーブル ===
  'employee_count': {
    table: 'companies',
    column: 'employee_count',
    type: 'number',
    transform: (v) => parseInt(v, 10) || null,
  },
  'annual_revenue': {
    table: 'companies',
    column: 'annual_revenue',
    type: 'number',
    transform: (v) => parseMoneyToYen(v),
  },
  'capital': {
    table: 'companies',
    column: 'capital',
    type: 'number',
    transform: (v) => parseMoneyToYen(v),
  },
  
  // === company_profile テーブル ===
  'business_purpose': {
    table: 'company_profile',
    column: 'business_summary',
    type: 'text',
  },
  'current_challenge': {
    table: 'company_profile',
    column: 'current_challenges_json',
    type: 'json',
    transform: (v) => JSON.stringify([{ category: 'general', description: v }]),
  },
  'investment_amount': {
    table: 'company_profile',
    column: 'desired_investments_json',
    type: 'json',
    transform: (v) => JSON.stringify([{ category: 'general', description: '壁打ちチャットで回答', amount: parseFloat(v) || 0 }]),
  },
  'expected_effect': {
    table: 'company_profile',
    column: 'notes',
    type: 'text',
    transform: (v) => `期待効果: ${v}`,
  },
  'has_gbiz_id': {
    table: 'company_profile',
    column: 'certifications_json',
    type: 'json',
    transform: (v) => {
      if (v === 'true') {
        return JSON.stringify([{ name: 'GビズIDプライム', acquired_date: null }]);
      }
      return null; // false の場合は更新しない
    },
  },
  'is_wage_raise_planned': {
    table: 'company_profile',
    column: 'plans_to_hire',
    type: 'boolean',
    transform: (v) => v === 'true' ? 1 : 0,
  },
  'tax_arrears': {
    table: 'company_profile',
    column: 'constraints_json',
    type: 'json',
    transform: (v) => {
      if (v === 'true') {
        return JSON.stringify([{ type: 'tax_arrears', description: '税金滞納あり' }]);
      }
      return null;
    },
  },
  'past_subsidy_same_type': {
    table: 'company_profile',
    column: 'past_subsidies_json',
    type: 'json',
    transform: (v) => {
      if (v === 'true') {
        return JSON.stringify([{ name: '同種補助金（詳細不明）', year: null }]);
      }
      return null;
    },
  },
  'founding_year': {
    table: 'company_profile',
    column: 'founding_year',
    type: 'number',
    transform: (v) => parseInt(v, 10) || null,
  },
  'corp_type': {
    table: 'company_profile',
    column: 'corp_type',
    type: 'text',
  },
};

/**
 * chat_facts をもとに company_profile / companies を更新
 * 
 * @param db D1Database
 * @param companyId 企業ID
 * @param subsidyId 補助金ID（NULL可: 全般的な facts のみ）
 * @returns 更新された項目数
 */
export async function syncFactsToProfile(
  db: D1Database,
  companyId: string,
  subsidyId?: string,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  
  // 対象の chat_facts を取得
  const facts = await db.prepare(`
    SELECT fact_key, fact_value, fact_type, fact_category
    FROM chat_facts
    WHERE company_id = ? AND (subsidy_id = ? OR subsidy_id IS NULL)
    AND fact_value IS NOT NULL AND fact_value != '' AND fact_value != 'unknown'
    ORDER BY updated_at DESC
  `).bind(companyId, subsidyId || null).all();
  
  if (!facts.results || facts.results.length === 0) {
    return { synced: 0, errors: [] };
  }
  
  // マッピング可能な facts を収集
  const companiesUpdates: Record<string, any> = {};
  const profileUpdates: Record<string, any> = {};
  
  for (const fact of facts.results as any[]) {
    const mapping = FACT_TO_PROFILE_MAP[fact.fact_key];
    if (!mapping) continue;
    
    try {
      let value: any;
      if (mapping.transform) {
        value = mapping.transform(fact.fact_value);
      } else {
        value = fact.fact_value;
      }
      
      // null は更新しない（transform が null を返した場合はスキップ）
      if (value === null || value === undefined) continue;
      
      if (mapping.table === 'companies') {
        companiesUpdates[mapping.column] = value;
      } else {
        profileUpdates[mapping.column] = value;
      }
    } catch (e) {
      errors.push(`${fact.fact_key}: ${(e as Error).message}`);
    }
  }
  
  // companies テーブルの更新
  if (Object.keys(companiesUpdates).length > 0) {
    try {
      const setClauses = Object.keys(companiesUpdates)
        .map(col => `${col} = ?`)
        .join(', ');
      const values = Object.values(companiesUpdates);
      
      await db.prepare(`
        UPDATE companies SET ${setClauses}, updated_at = datetime('now')
        WHERE id = ?
      `).bind(...values, companyId).run();
      
      synced += Object.keys(companiesUpdates).length;
    } catch (e) {
      errors.push(`companies update: ${(e as Error).message}`);
    }
  }
  
  // company_profile テーブルの更新
  if (Object.keys(profileUpdates).length > 0) {
    try {
      // company_profile が存在するか確認
      const existing = await db.prepare(`
        SELECT company_id FROM company_profile WHERE company_id = ?
      `).bind(companyId).first();
      
      if (existing) {
        // UPDATE
        const setClauses = Object.keys(profileUpdates)
          .map(col => `${col} = ?`)
          .join(', ');
        const values = Object.values(profileUpdates);
        
        await db.prepare(`
          UPDATE company_profile SET ${setClauses}, updated_at = datetime('now')
          WHERE company_id = ?
        `).bind(...values, companyId).run();
      } else {
        // INSERT（created_at, updated_at を含める）
        const columns = ['company_id', ...Object.keys(profileUpdates), 'created_at', 'updated_at'];
        const placeholders = columns.map(() => '?').join(', ');
        const now = new Date().toISOString();
        const values = [companyId, ...Object.values(profileUpdates), now, now];
        
        await db.prepare(`
          INSERT INTO company_profile (${columns.join(', ')})
          VALUES (${placeholders})
        `).bind(...values).run();
      }
      
      synced += Object.keys(profileUpdates).length;
    } catch (e) {
      errors.push(`company_profile update: ${(e as Error).message}`);
    }
  }
  
  return { synced, errors };
}

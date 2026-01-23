/**
 * JGrants API から補助金データを取得して500件以上を目指すスクリプト
 * 
 * Phase1-1: 500件達成のための一括取得
 * 
 * 使用方法:
 * npx tsx scripts/fetch-jgrants-500.ts
 */

const JGRANTS_API_URL = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';

// 凍結キーワードセット v1.3
const KEYWORDS = [
  // 基本キーワード
  '補助金', '助成金', '事業', '支援', '申請', '公募',
  // テーマ別
  'DX', 'IT導入', '省エネ', '雇用', '設備投資', '製造業',
  'デジタル化', '創業', '販路開拓', '人材育成', '研究開発',
  '生産性向上', '中小企業', '小規模事業者', '新事業', '海外展開',
  '輸出', '観光', '農業', '介護', '福祉', '環境',
  'カーボンニュートラル', '脱炭素', 'ものづくり', 'サービス',
  'ECサイト', 'テレワーク', 'AI', 'IoT', 'クラウド', '情報化',
  '感染症対策', '賃上げ', '最低賃金', '事業承継', '再構築',
  '経営革新', '働き方改革', '地域活性化', '商店街', '中心市街地',
  '地方創生', '産業振興', '省力化', '自動化', '機械化',
  '建設', '建築'
];

interface Subsidy {
  id: string;
  title: string;
  subsidy_max_limit?: number | string;
  subsidy_rate?: string;
  target_area_search?: string;
  target_industry?: string;
  target_number_of_employees?: string;
  acceptance_start_datetime?: string;
  acceptance_end_datetime?: string;
  request_reception_display_flag?: number;
  detail_url?: string;
  application_address?: string;
}

async function fetchSubsidies(): Promise<Map<string, Subsidy>> {
  const allSubsidies = new Map<string, Subsidy>();
  const errors: string[] = [];
  
  console.log(`🚀 JGrants API からデータ取得開始`);
  console.log(`📋 キーワード数: ${KEYWORDS.length}`);
  console.log(`📊 受付中(acceptance=1) + 受付終了(acceptance=0) 両方を取得\n`);
  
  for (const keyword of KEYWORDS) {
    // 受付中のデータを取得
    for (const acceptance of ['1', '0']) {
      const params = new URLSearchParams({
        keyword,
        sort: 'acceptance_end_datetime',
        order: 'DESC',
        acceptance,
        limit: '200',
      });
      
      try {
        const url = `${JGRANTS_API_URL}?${params}`;
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          errors.push(`[${keyword}] acceptance=${acceptance}: ${response.status}`);
          continue;
        }
        
        const data = await response.json() as any;
        const subsidies: Subsidy[] = data.result || data.subsidies || data.data || [];
        
        let newCount = 0;
        for (const s of subsidies) {
          if (s.id && !allSubsidies.has(s.id)) {
            allSubsidies.set(s.id, s);
            newCount++;
          }
        }
        
        if (newCount > 0) {
          console.log(`✅ [${keyword}] acceptance=${acceptance}: +${newCount}件 (累計: ${allSubsidies.size}件)`);
        }
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errors.push(`[${keyword}] acceptance=${acceptance}: ${(error as Error).message}`);
      }
    }
  }
  
  console.log(`\n📊 取得完了`);
  console.log(`   総件数: ${allSubsidies.size}`);
  console.log(`   エラー: ${errors.length}件`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️ エラー詳細 (最初の5件):`);
    errors.slice(0, 5).forEach(e => console.log(`   ${e}`));
  }
  
  return allSubsidies;
}

function generateInsertSQL(subsidies: Map<string, Subsidy>): string[] {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const values: string[] = [];
  
  for (const [id, s] of subsidies) {
    const title = (s.title || '').replace(/'/g, "''");
    const maxLimit = s.subsidy_max_limit || null;
    const rate = (s.subsidy_rate || '').replace(/'/g, "''");
    const area = (s.target_area_search || '').replace(/'/g, "''");
    const industry = (s.target_industry || '').replace(/'/g, "''");
    const employees = (s.target_number_of_employees || '').replace(/'/g, "''");
    const startDate = s.acceptance_start_datetime || null;
    const endDate = s.acceptance_end_datetime || null;
    const flag = s.request_reception_display_flag ?? 1;
    
    // detail_json として追加情報を保存（簡略化）
    const detailJson = '{}';
    
    values.push(
      `('${id}', 'jgrants', '${title}', ${maxLimit === null ? 'NULL' : maxLimit}, '${rate}', '${area}', '${industry}', '${employees}', ${startDate ? `'${startDate}'` : 'NULL'}, ${endDate ? `'${endDate}'` : 'NULL'}, ${flag}, '${now}', '${expiresAt}', '${detailJson}')`
    );
  }
  
  // バッチサイズ 50 で分割（Cloudflare D1の制限対応）
  const batchSize = 50;
  const sqlFiles: string[] = [];
  
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    sqlFiles.push(
      `INSERT OR REPLACE INTO subsidy_cache (id, source, title, subsidy_max_limit, subsidy_rate, target_area_search, target_industry, target_number_of_employees, acceptance_start_datetime, acceptance_end_datetime, request_reception_display_flag, cached_at, expires_at, detail_json) VALUES\n${batch.join(',\n')};`
    );
  }
  
  return sqlFiles;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Phase1-1: JGrants 500件達成スクリプト');
  console.log('='.repeat(60));
  console.log();
  
  const subsidies = await fetchSubsidies();
  
  if (subsidies.size >= 500) {
    console.log(`\n🎉 目標達成！ ${subsidies.size}件 >= 500件`);
  } else {
    console.log(`\n⚠️ 目標未達: ${subsidies.size}件 < 500件`);
  }
  
  // SQL生成（複数ファイルに分割）
  const sqlFiles = generateInsertSQL(subsidies);
  
  // ファイルに出力
  const fs = await import('fs');
  const outputDir = './scripts/jgrants-batches';
  
  // ディレクトリがなければ作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (let i = 0; i < sqlFiles.length; i++) {
    const filePath = `${outputDir}/batch_${String(i).padStart(3, '0')}.sql`;
    fs.writeFileSync(filePath, sqlFiles[i]);
  }
  
  console.log(`\n💾 SQLファイル出力: ${outputDir}/`);
  console.log(`   ファイル数: ${sqlFiles.length}個`);
  console.log(`   1ファイルあたり: 最大50件`);
  
  console.log(`\n📝 次のステップ:`);
  console.log(`   for f in scripts/jgrants-batches/*.sql; do npx wrangler d1 execute subsidy-matching-production --remote --file=\$f; done`);
  console.log(`   件数確認: SELECT COUNT(*) FROM subsidy_cache;`);
}

main().catch(console.error);

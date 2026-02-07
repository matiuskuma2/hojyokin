// 省力化補助金（一般型）第5回公募 詳細データ更新スクリプト
// 実行: node scripts/update-shoryokuka.js

const fs = require('fs');
const path = require('path');

// 添付ファイルデータを読み込み
const attachmentsPath = path.join(__dirname, 'shoryokuka-attachments.json');
const attachments = JSON.parse(fs.readFileSync(attachmentsPath, 'utf8'));

// エスケープ済みJSON文字列を生成
const attachmentsJson = JSON.stringify(attachments).replace(/'/g, "''");

// SQL生成
const sql = `
-- 省力化補助金（一般型）第5回公募 詳細データ更新
-- 実行日: ${new Date().toISOString()}

UPDATE subsidy_cache
SET 
  detail_json = json_set(
    detail_json,
    '$.attachments', json('${attachmentsJson}'),
    '$.download_page_url', 'https://shoryokuka.smrj.go.jp/ippan/download/',
    '$.attachments_updated_at', '2026-02-07',
    '$.last_updated', '2026-02-07'
  ),
  detail_score = 85,
  wall_chat_ready = 1,
  updated_at = datetime('now')
WHERE id = 'SHORYOKUKA-IPPAN-05';
`;

console.log('=== 生成されたSQL ===');
console.log(sql);
console.log('\n=== Wrangler コマンド ===');
console.log('以下のコマンドで実行してください:');
console.log('cd /home/user/webapp && npx wrangler d1 execute subsidy-matching-production --remote --file=scripts/update-shoryokuka-final.sql');

// SQLファイルに書き出し
const outputPath = path.join(__dirname, 'update-shoryokuka-final.sql');
fs.writeFileSync(outputPath, sql);
console.log(`\nSQLファイル出力: ${outputPath}`);

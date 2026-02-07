/**
 * PM2 設定ファイル (CommonJS)
 * 
 * 使用方法:
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs subsidy-matching --nostream
 *   pm2 restart subsidy-matching
 *   pm2 delete subsidy-matching
 */

module.exports = {
  apps: [
    {
      name: 'subsidy-matching',
      script: 'npx',
      // wrangler pages dev は .dev.vars を自動読み込み
      // --binding で環境変数を追加
      // 開発時はリモートDBに接続（--remote）
      // ローカルテスト時は --local に戻す
      args: 'wrangler pages dev dist --d1=subsidy-matching-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};

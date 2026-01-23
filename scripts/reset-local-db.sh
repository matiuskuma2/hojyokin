#!/bin/bash
# =====================================================
# ローカルD1 リセットスクリプト
# 
# 使用方法: ./scripts/reset-local-db.sh
# 
# このスクリプトは:
# 1. ローカルD1状態を削除
# 2. 0099_reconcile_schema.sql を直接適用（冪等）
# 3. テーブル一覧を確認
# =====================================================

set -e

cd "$(dirname "$0")/.."

echo "=== ローカルD1 リセット開始 ==="

# 1. ローカルD1状態を削除
echo "[1/3] D1状態ディレクトリを削除..."
rm -rf .wrangler/state/v3/d1
echo "  完了"

# 2. dev_schema.sql を直接適用（FK制約なし、開発用）
echo "[2/3] dev_schema.sql を適用..."
npx wrangler d1 execute subsidy-matching-production --local --file=migrations/dev_schema.sql 2>&1 | grep -E "(ERROR|success|commands executed)" || true
echo "  完了"

# 3. テーブル一覧を確認
echo "[3/3] テーブル一覧を確認..."
npx wrangler d1 execute subsidy-matching-production --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf%' ORDER BY name;" 2>&1 | grep -E '"name"' | wc -l | xargs echo "  テーブル数:"

echo "=== リセット完了 ==="

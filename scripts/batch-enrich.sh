#!/bin/bash
# バッチエンリッチスクリプト
# JGrants APIのレート制限を回避するため、間隔を空けて実行

DELAY=10  # 各リクエスト間の待機秒数
MAX_RUNS=100

echo "=== jGrants バッチエンリッチ開始 ==="
echo "間隔: ${DELAY}秒"
echo ""

success_count=0
error_count=0

for i in $(seq 1 $MAX_RUNS); do
  echo -n "Run $i: "
  
  result=$(curl -s -X POST "https://hojyokin.pages.dev/api/cron/enrich-jgrants?all=true" \
    -H "X-Cron-Secret: dev-cron-secret-2026" \
    --max-time 60 2>&1)
  
  if echo "$result" | grep -q '"success":true'; then
    enriched=$(echo "$result" | grep -o '"items_enriched":[0-9]*' | grep -o '[0-9]*')
    ready=$(echo "$result" | grep -o '"items_ready":[0-9]*' | grep -o '[0-9]*')
    echo "OK - enriched=$enriched, ready=$ready"
    ((success_count++))
    
    # 0件なら終了
    if [ "$enriched" = "0" ]; then
      echo "エンリッチ完了"
      break
    fi
  else
    echo "ERROR: $result"
    ((error_count++))
    
    # エラーが続いたら長めに待機
    if [ $error_count -ge 3 ]; then
      echo "エラーが続いているため5分待機..."
      sleep 300
      error_count=0
    fi
  fi
  
  sleep $DELAY
done

echo ""
echo "=== 完了 ==="
echo "成功: $success_count, エラー: $error_count"

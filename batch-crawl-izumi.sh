#!/bin/bash
# バッチクロール: izumi support_url → detail_json 充実
# Workers制限を考慮して1回10件、間隔1秒

SECRET="tawFlM0lvTiKGtbNm4u0cXUoYfWXcNQh"
URL="https://hojyokin.pages.dev/api/cron/crawl-izumi-details?mode=upgrade"
MAX_ROUNDS=500
TOTAL_CRAWLED=0
TOTAL_READY=0
TOTAL_FAILED=0
CONSECUTIVE_EMPTY=0

echo "=== Izumi Batch Crawl v2 Started at $(date) ==="

for i in $(seq 1 $MAX_ROUNDS); do
  RESULT=$(curl -s --max-time 35 -X POST "$URL" \
    -H "X-Cron-Secret: $SECRET" \
    -H "Content-Type: application/json" 2>/dev/null)
  
  if [ -z "$RESULT" ]; then
    echo "Run $i: TIMEOUT/EMPTY"
    CONSECUTIVE_EMPTY=$((CONSECUTIVE_EMPTY + 1))
    if [ $CONSECUTIVE_EMPTY -ge 5 ]; then
      echo "5 consecutive failures, stopping."
      break
    fi
    sleep 2
    continue
  fi
  
  CRAWLED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('crawled',0))" 2>/dev/null || echo "0")
  READY=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('ready_after',0))" 2>/dev/null || echo "0")
  FAILED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('crawl_failed',0))" 2>/dev/null || echo "0")
  REMAINING=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('remaining_fallback',0))" 2>/dev/null || echo "?")
  
  TOTAL_CRAWLED=$((TOTAL_CRAWLED + CRAWLED))
  TOTAL_READY=$((TOTAL_READY + READY))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  
  echo "Run $i: crawled=$CRAWLED ready=$READY failed=$FAILED remaining=$REMAINING | TOTAL: crawled=$TOTAL_CRAWLED ready=$TOTAL_READY failed=$TOTAL_FAILED"
  
  if [ "$CRAWLED" = "0" ] && [ "$FAILED" = "0" ]; then
    CONSECUTIVE_EMPTY=$((CONSECUTIVE_EMPTY + 1))
    if [ $CONSECUTIVE_EMPTY -ge 3 ]; then
      echo "No items to crawl for 3 rounds, stopping."
      break
    fi
  else
    CONSECUTIVE_EMPTY=0
  fi
  
  # 0.5秒待機
  sleep 0.5
done

echo ""
echo "=== FINAL TOTALS ==="
echo "Total crawled: $TOTAL_CRAWLED"
echo "Total ready: $TOTAL_READY"
echo "Total failed: $TOTAL_FAILED"
echo "Completed at: $(date)"

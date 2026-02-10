#!/usr/bin/env python3
"""
izumi fallback_v1 の 11,996件を高速バッチクロール
official_url から HTML取得 → テキスト抽出 → detail_json更新 → D1書き込み
並列処理で高速化（concurrent.futures使用）
"""
import json, time, re, sys, os
import urllib.request, urllib.error
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor, as_completed

CF_ACCOUNT_ID = "dd957a4b35780cdb5d2c8d0b021684c2"
CF_DB_ID = "e53f6185-60a6-45eb-b06d-c710ab3aef56"
CF_API_KEY = "f20c372dc7eff0b088b3f1e4b3ec03592bda6"
CF_EMAIL = "sekiyadubai@gmail.com"

# 設定
BATCH_SIZE = 100       # D1から1回で取得する件数
WORKERS = 5            # 並列クロール数
CRAWL_TIMEOUT = 10     # HTTP timeout (秒)
MAX_TOTAL = int(sys.argv[1]) if len(sys.argv) > 1 else 500  # 1回の実行で処理する最大件数
D1_DELAY = 0.1         # D1書き込み間隔

# =====================================================
# D1 helper
# =====================================================
def d1_query(sql, params=None):
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DB_ID}/query"
    body = {"sql": sql}
    if params: body["params"] = params
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Auth-Email", CF_EMAIL)
    req.add_header("X-Auth-Key", CF_API_KEY)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode())
            if result.get("success") and result.get("result"):
                return result["result"][0].get("results", [])
            return []
    except urllib.error.HTTPError as e:
        print(f"  D1 error: {e.code} {e.read().decode()[:200]}")
        return []
    except Exception as e:
        print(f"  D1 exception: {e}")
        return []

# =====================================================
# HTML → テキスト抽出
# =====================================================
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texts = []
        self.skip_tags = {'script', 'style', 'nav', 'header', 'footer', 'noscript', 'iframe'}
        self.in_skip = 0
        self.in_main = False
        self.main_texts = []
        
    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.in_skip += 1
        if tag in ('main', 'article'):
            self.in_main = True
            
    def handle_endtag(self, tag):
        if tag in self.skip_tags and self.in_skip > 0:
            self.in_skip -= 1
        if tag in ('main', 'article'):
            self.in_main = False
            
    def handle_data(self, data):
        if self.in_skip > 0:
            return
        text = data.strip()
        if text:
            if self.in_main:
                self.main_texts.append(text)
            self.texts.append(text)

def html_to_text(html, max_len=3000):
    """HTMLからテキスト抽出（main/article優先）"""
    if not html:
        return ""
    try:
        parser = TextExtractor()
        parser.feed(html)
        # main/article内のテキストがあればそちらを優先
        if len(parser.main_texts) > 3:
            text = '\n'.join(parser.main_texts)
        else:
            text = '\n'.join(parser.texts)
        # 重複改行/空白を除去
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text[:max_len].strip()
    except:
        return ""

def extract_pdf_links(html, base_url):
    """HTMLからPDFリンクを抽出"""
    if not html:
        return []
    pdfs = set()
    for m in re.finditer(r'href=["\']([^"\']*\.pdf[^"\']*)', html, re.IGNORECASE):
        href = m.group(1)
        if href.startswith('http'):
            pdfs.add(href)
        elif href.startswith('/'):
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            pdfs.add(f"{parsed.scheme}://{parsed.netloc}{href}")
    return list(pdfs)[:10]

def extract_fields(text, title):
    """テキストから補助金フィールドを抽出"""
    result = {
        "eligible_expenses": [],
        "application_requirements": [],
        "required_documents": [],
        "deadline": None,
        "subsidy_rate": None,
        "subsidy_amount": None,
        "target_businesses": None,
    }
    
    # 対象経費
    expense_keywords = [
        '機械装置', '設備費', 'システム構築費', 'ソフトウェア', 'クラウド', 
        '広報費', '外注費', '委託費', '旅費', '専門家経費', '運搬費',
        '原材料費', '設計費', '工事費', '研修費', '人件費', '開業費',
        '家賃', '賃借料', '備品購入費', '消耗品費', '改修費', '改装費',
    ]
    for kw in expense_keywords:
        if kw in text:
            result["eligible_expenses"].append(kw)
    result["eligible_expenses"] = result["eligible_expenses"][:6]
    
    # 補助率
    rate_match = re.search(r'補助率[：:\s]*([0-9/／]+)', text)
    if rate_match:
        result["subsidy_rate"] = rate_match.group(1)
    
    # 補助額
    amount_match = re.search(r'(?:補助(?:上限|金額)|助成(?:上限|金額))[：:\s]*([0-9,，]+(?:万円|円))', text)
    if amount_match:
        result["subsidy_amount"] = amount_match.group(1)
    
    # 締切
    deadline_match = re.search(r'(?:締[め切]切り?|申請期限|募集期[間限])[：:\s]*(令和\d+年\d+月\d+日|20\d{2}[年/]\d{1,2}[月/]\d{1,2}日?)', text)
    if deadline_match:
        result["deadline"] = deadline_match.group(1)
    
    # 対象者
    target_match = re.search(r'(?:対象者?|補助対象|助成対象)[：:\s]*(.{10,100}?)(?:\n|。)', text)
    if target_match:
        result["target_businesses"] = target_match.group(1).strip()
    
    return result

# =====================================================
# クロール関数
# =====================================================
def crawl_one(item):
    """1件のofficial_urlをクロール"""
    sid = item["id"]
    title = item.get("title", "")
    dj = json.loads(item.get("detail_json", "{}") or "{}")
    
    crawl_url = dj.get("official_url") or dj.get("related_url")
    if not crawl_url:
        return {"id": sid, "status": "no_url", "detail": dj}
    
    # PDF URLスキップ
    if '.pdf' in crawl_url.lower():
        dj["crawled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        dj["crawl_error"] = "pdf_url_only"
        return {"id": sid, "status": "pdf_skip", "detail": dj}
    
    try:
        req = urllib.request.Request(crawl_url)
        req.add_header("User-Agent", "Mozilla/5.0 (compatible; SubsidyBot/1.0)")
        req.add_header("Accept", "text/html,application/xhtml+xml")
        req.add_header("Accept-Language", "ja,en;q=0.5")
        
        with urllib.request.urlopen(req, timeout=CRAWL_TIMEOUT) as resp:
            # エンコーディング検出
            content_type = resp.headers.get('Content-Type', '')
            if 'charset=' in content_type:
                charset = content_type.split('charset=')[1].split(';')[0].strip()
            else:
                charset = 'utf-8'
            
            raw = resp.read()
            try:
                html = raw.decode(charset, errors='replace')
            except:
                html = raw.decode('utf-8', errors='replace')
        
        if not html or len(html) < 100:
            dj["crawled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            dj["crawl_error"] = "empty_response"
            return {"id": sid, "status": "empty", "detail": dj}
        
        # PDF応答検出
        if html[:100].startswith('%PDF') or '%PDF' in html[:200]:
            dj["crawled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            dj["crawl_error"] = "pdf_response"
            if not dj.get("pdf_urls"):
                dj["pdf_urls"] = []
            if crawl_url not in dj["pdf_urls"]:
                dj["pdf_urls"].append(crawl_url)
            return {"id": sid, "status": "pdf_response", "detail": dj}
        
        # テキスト抽出
        text = html_to_text(html, 3000)
        fields = extract_fields(text, title)
        
        # overview更新（80文字以上あれば）
        if len(text) > 80:
            dj["overview"] = text[:2000]
            dj["overview_source"] = "batch_crawl_v1"
        
        # フィールド更新（既存より良い場合のみ）
        if fields["eligible_expenses"]:
            dj["eligible_expenses"] = fields["eligible_expenses"]
            dj["eligible_expenses_source"] = "batch_crawl_extraction_v1"
        
        if fields["subsidy_rate"]:
            dj["subsidy_rate_text"] = fields["subsidy_rate"]
        
        if fields["subsidy_amount"]:
            dj["subsidy_amount_text"] = fields["subsidy_amount"]
        
        if fields["deadline"]:
            dj["deadline"] = fields["deadline"]
            dj["acceptance_end_datetime"] = fields["deadline"]
            dj["deadline_source"] = "batch_crawl_extraction_v1"
        
        if fields["target_businesses"]:
            dj["target_businesses"] = fields["target_businesses"]
        
        # PDFリンク抽出
        pdf_links = extract_pdf_links(html, crawl_url)
        if pdf_links:
            existing = dj.get("pdf_urls", []) or []
            dj["pdf_urls"] = list(set(existing + pdf_links))[:10]
        
        # deadline フォールバック
        if not dj.get("deadline") and not dj.get("acceptance_end_datetime"):
            dj["deadline"] = "通年募集（予算がなくなり次第終了）"
            dj["deadline_source"] = "izumi_default_fallback"
        
        dj["crawled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        dj["crawl_source_url"] = crawl_url
        dj["crawl_html_length"] = len(html)
        dj["enriched_version"] = "izumi_crawl_v2"
        
        return {"id": sid, "status": "ok", "detail": dj, "text_len": len(text)}
        
    except urllib.error.HTTPError as e:
        dj["crawled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        dj["crawl_error"] = f"HTTP {e.code}"
        return {"id": sid, "status": f"http_{e.code}", "detail": dj}
    except Exception as e:
        dj["crawled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        dj["crawl_error"] = str(e)[:100]
        return {"id": sid, "status": "error", "detail": dj}

# =====================================================
# メイン処理
# =====================================================
def main():
    print(f"=== izumiバッチクロール (max={MAX_TOTAL}, workers={WORKERS}) ===\n")
    
    total_crawled = 0
    total_upgraded = 0
    total_failed = 0
    total_written = 0
    start_time = time.time()
    
    while total_crawled < MAX_TOTAL:
        remaining = MAX_TOTAL - total_crawled
        fetch_size = min(BATCH_SIZE, remaining)
        
        # 未クロールのfallback_v1を取得
        rows = d1_query(f"""
            SELECT id, title, detail_json FROM subsidy_cache 
            WHERE source='izumi' 
              AND wall_chat_excluded=0
              AND json_extract(detail_json, '$.enriched_version') = 'izumi_fallback_v1'
              AND json_extract(detail_json, '$.crawled_at') IS NULL
              AND json_extract(detail_json, '$.official_url') IS NOT NULL
              AND json_extract(detail_json, '$.official_url') NOT LIKE '%.pdf%'
            ORDER BY RANDOM()
            LIMIT {fetch_size}
        """)
        
        if not rows:
            print(f"\n残り0件 — 全件クロール完了")
            break
        
        print(f"\nBatch: {len(rows)}件取得 (累計: {total_crawled})")
        
        # 並列クロール
        results = []
        with ThreadPoolExecutor(max_workers=WORKERS) as executor:
            futures = {executor.submit(crawl_one, row): row for row in rows}
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    print(f"  Thread error: {e}")
        
        # D1に書き込み
        ok_count = 0
        fail_count = 0
        for r in results:
            sid = r["id"]
            dj = r["detail"]
            dj_str = json.dumps(dj, ensure_ascii=False)
            
            if r["status"] == "ok":
                # wall_chat_ready = 1 に設定（フィールド揃っているので）
                d1_query(
                    "UPDATE subsidy_cache SET detail_json = ?1, wall_chat_ready = 1, wall_chat_missing = '[]' WHERE id = ?2",
                    [dj_str, sid]
                )
                ok_count += 1
                total_upgraded += 1
            else:
                # エラー/スキップでもcrawled_atを記録
                d1_query(
                    "UPDATE subsidy_cache SET detail_json = ?1 WHERE id = ?2",
                    [dj_str, sid]
                )
                fail_count += 1
            
            time.sleep(D1_DELAY)
        
        total_crawled += len(results)
        total_written += ok_count
        total_failed += fail_count
        
        elapsed = time.time() - start_time
        rate = total_crawled / elapsed * 60 if elapsed > 0 else 0
        print(f"  OK={ok_count}, FAIL={fail_count} | 累計: crawled={total_crawled}, upgraded={total_upgraded}, failed={total_failed} | {rate:.0f}件/分")
    
    elapsed = time.time() - start_time
    print(f"\n=== 完了 ===")
    print(f"Total crawled: {total_crawled}")
    print(f"Total upgraded: {total_upgraded} (overview品質向上)")
    print(f"Total failed: {total_failed}")
    print(f"Elapsed: {elapsed:.0f}秒 ({elapsed/60:.1f}分)")
    print(f"Rate: {total_crawled / elapsed * 60:.0f}件/分" if elapsed > 0 else "")
    
    # 最終集計
    stats = d1_query("""
        SELECT 
          json_extract(detail_json,'$.enriched_version') as ev,
          COUNT(*) as cnt,
          SUM(CASE WHEN json_extract(detail_json,'$.crawled_at') IS NOT NULL THEN 1 ELSE 0 END) as crawled
        FROM subsidy_cache 
        WHERE source='izumi' 
          AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL)
        GROUP BY ev
    """)
    print("\n--- 受付中izumi version分布 ---")
    for s in stats:
        print(f"  {s['ev']}: {s['cnt']}件 (crawled={s['crawled']})")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
jGrants受付中の未enrich件を一括enrich → 本番DBに書き込む

Usage:
  python3 tools/batch-enrich-jgrants.py
"""

import json
import subprocess
import time
import re
import sys
import urllib.request

WRANGLER_ENV = {
    "CLOUDFLARE_API_KEY": "f20c372dc7eff0b088b3f1e4b3ec03592bda6",
    "CLOUDFLARE_EMAIL": "sekiyadubai@gmail.com",
}
DB_NAME = "subsidy-matching-production"
JGRANTS_V2_API = "https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id"

def run_d1(sql, raw=False):
    """wrangler d1 executeで本番DBにSQLを実行（ファイル経由で長いSQL対応）"""
    import os
    import tempfile
    env = os.environ.copy()
    env.update(WRANGLER_ENV)
    
    # 長いSQLはファイル経由で実行
    if len(sql) > 5000:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False, dir='/tmp') as f:
            f.write(sql)
            sql_file = f.name
        cmd = [
            "npx", "wrangler", "d1", "execute", DB_NAME,
            "--remote", "--file", sql_file
        ]
    else:
        cmd = [
            "npx", "wrangler", "d1", "execute", DB_NAME,
            "--remote", "--command", sql
        ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd="/home/user/webapp")
    
    # 一時ファイルのクリーンアップ
    if len(sql) > 5000:
        try:
            os.unlink(sql_file)
        except:
            pass
    if raw:
        return result.stdout
    # JSONからresultsを抽出
    try:
        # wranglerの出力からJSON部分を抽出
        output = result.stdout
        # "results" : [...] を探す
        match = re.search(r'"results"\s*:\s*\[', output)
        if match:
            start = match.start()
            # 対応する ] を見つける
            bracket_count = 0
            for i, c in enumerate(output[match.end()-1:], match.end()-1):
                if c == '[':
                    bracket_count += 1
                elif c == ']':
                    bracket_count -= 1
                    if bracket_count == 0:
                        json_str = '{' + output[start:i+1] + '}'
                        return json.loads(json_str)['results']
        return []
    except Exception as e:
        print(f"Parse error: {e}")
        print(f"Stdout: {result.stdout[:500]}")
        return []

def fetch_jgrants_detail(subsidy_id):
    """jGrants v2 APIから詳細情報を取得"""
    url = f"{JGRANTS_V2_API}/{subsidy_id}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            result = data.get("result", [])
            if isinstance(result, list) and result:
                return result[0]
            return result if result else None
    except Exception as e:
        print(f"  API error for {subsidy_id}: {e}")
        return None

def build_detail_json(subsidy, existing_detail_json=None):
    """APIレスポンスからdetail_jsonを構築"""
    existing = json.loads(existing_detail_json) if existing_detail_json else {}
    
    # HTML tagを除去
    detail_text = subsidy.get("detail", "") or ""
    overview = re.sub(r'<[^>]*>', ' ', detail_text).strip()
    overview = re.sub(r'\s+', ' ', overview)[:3000]
    
    # PDF URLを抽出
    pdf_urls = []
    pdf_matches = re.findall(r'https?://[^\s"\'<>]+\.pdf', detail_text, re.IGNORECASE)
    for url in pdf_matches:
        if url not in pdf_urls:
            pdf_urls.append(url)
    
    # workflowを整理
    workflows = []
    for w in (subsidy.get("workflow") or []):
        workflows.append({
            "id": w.get("id"),
            "target_area": w.get("target_area"),
            "acceptance_start": w.get("acceptance_start_datetime"),
            "acceptance_end": w.get("acceptance_end_datetime"),
            "project_end": w.get("project_end_deadline"),
        })
    
    detail_json = {
        **existing,  # 既存データを保持
        "enriched_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "enriched_version": "v2",
        "api_version": "v2",
        "overview": overview if overview else existing.get("overview"),
        "catch_phrase": subsidy.get("subsidy_catch_phrase") or existing.get("catch_phrase"),
        "use_purpose": subsidy.get("use_purpose") or existing.get("use_purpose"),
        "target_industry": (
            " / ".join(subsidy["industry"]) if isinstance(subsidy.get("industry"), list)
            else subsidy.get("industry") or existing.get("target_industry")
        ),
        "target_employees": subsidy.get("target_number_of_employees") or existing.get("target_employees"),
        "subsidy_rate": subsidy.get("subsidy_rate") or existing.get("subsidy_rate"),
        "subsidy_max_limit": subsidy.get("subsidy_max_limit") or existing.get("subsidy_max_limit"),
        "grant_type": subsidy.get("granttype") or existing.get("grant_type"),
        "related_url": f"https://www.jgrants-portal.go.jp/subsidy/{subsidy.get('id', '')}",
        "workflows": workflows if workflows else existing.get("workflows", []),
    }
    
    if pdf_urls:
        detail_json["pdf_urls"] = pdf_urls
    
    # application_guidelines があれば追加
    guidelines = subsidy.get("application_guidelines") or []
    if guidelines:
        detail_json["application_guidelines"] = guidelines
    
    return detail_json

def main():
    print("=== jGrants受付中 未enrich件 一括enrich ===")
    print()
    
    # 1. 未enrich件のIDリストを取得
    print("[1] 未enrich件を取得中...")
    rows = run_d1("""
        SELECT id, title, detail_json FROM subsidy_cache 
        WHERE source='jgrants' 
          AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL)
          AND (json_extract(detail_json,'$.enriched_version') IS NULL OR json_extract(detail_json,'$.enriched_version') != 'v2')
        ORDER BY acceptance_end_datetime ASC
    """)
    
    print(f"  対象: {len(rows)}件")
    if not rows:
        print("  全件enrich済み!")
        return
    
    # 2. 各件をenrich
    enriched = 0
    errors = 0
    ready_candidates = 0
    
    for i, row in enumerate(rows):
        sid = row["id"]
        title = (row.get("title") or "")[:50]
        print(f"\n[{i+1}/{len(rows)}] {sid} - {title}...")
        
        # jGrants v2 APIから取得
        detail = fetch_jgrants_detail(sid)
        if not detail:
            errors += 1
            continue
        
        # detail_jsonを構築
        detail_json = build_detail_json(detail, row.get("detail_json"))
        detail_json_str = json.dumps(detail_json, ensure_ascii=False)
        
        # SQLエスケープ（シングルクォートを2つに）
        escaped = detail_json_str.replace("'", "''")
        
        # 本番DBに書き込み
        update_sql = f"UPDATE subsidy_cache SET detail_json = '{escaped}', cached_at = datetime('now') WHERE id = '{sid}'"
        run_d1(update_sql, raw=True)
        
        enriched += 1
        has_overview = bool(detail_json.get("overview"))
        print(f"  -> enriched (overview={len(detail_json.get('overview',''))}chars, pdfs={len(detail_json.get('pdf_urls',[]))})")
        
        # Rate limiting
        time.sleep(0.5)
    
    print(f"\n=== 完了 ===")
    print(f"  対象: {len(rows)}件")
    print(f"  enriched: {enriched}件")
    print(f"  errors: {errors}件")
    
    # 3. daily-ready-boost を実行して ready 化
    print(f"\n[3] daily-ready-boost を実行中...")
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", 
         "https://hojyokin-cron.sekiyadubai.workers.dev/trigger",
         "-H", "Content-Type: application/json",
         "-d", '{"job":"sync"}'],
        capture_output=True, text=True, timeout=120
    )
    print(f"  -> {result.stdout[:200]}")

if __name__ == "__main__":
    main()

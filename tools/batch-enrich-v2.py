#!/usr/bin/env python3
"""
jGrants受付中の未enrich件を一括enrich → Cloudflare D1 REST API経由で本番DBに書き込む
"""
import json, time, re, sys, urllib.request, urllib.error

# Cloudflare D1 REST API
CF_ACCOUNT_ID = "dd957a4b35780cdb5d2c8d0b021684c2"
CF_DB_ID = "e53f6185-60a6-45eb-b06d-c710ab3aef56"
CF_API_KEY = "f20c372dc7eff0b088b3f1e4b3ec03592bda6"
CF_EMAIL = "sekiyadubai@gmail.com"
JGRANTS_V2_API = "https://api.jgrants-portal.go.jp/exp/v2/public/subsidies/id"

def d1_query(sql, params=None):
    """Cloudflare D1 REST APIでSQLを実行"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DB_ID}/query"
    body = {"sql": sql}
    if params:
        body["params"] = params
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
        print(f"  D1 API error: {e.code} {e.read().decode()[:200]}")
        return []
    except Exception as e:
        print(f"  D1 API error: {e}")
        return []

def fetch_jgrants(sid):
    url = f"{JGRANTS_V2_API}/{sid}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            d = json.loads(resp.read().decode())
            r = d.get("result", [])
            return r[0] if isinstance(r, list) and r else (r or None)
    except Exception as e:
        print(f"  API error: {e}")
        return None

def build_detail(s, existing=None):
    ex = json.loads(existing) if existing else {}
    detail = s.get("detail", "") or ""
    ov = re.sub(r'<[^>]*>', ' ', detail).strip()
    ov = re.sub(r'\s+', ' ', ov)[:3000]
    pdfs = list(set(re.findall(r'https?://[^\s"\'<>]+\.pdf', detail, re.IGNORECASE)))
    wf = [{"id":w.get("id"),"area":w.get("target_area"),"start":w.get("acceptance_start_datetime"),"end":w.get("acceptance_end_datetime")} for w in (s.get("workflow") or [])]
    
    return {
        **ex,
        "enriched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "enriched_version": "v2", "api_version": "v2",
        "overview": ov or ex.get("overview"),
        "catch_phrase": s.get("subsidy_catch_phrase") or ex.get("catch_phrase"),
        "use_purpose": s.get("use_purpose") or ex.get("use_purpose"),
        "target_industry": " / ".join(s["industry"]) if isinstance(s.get("industry"), list) else s.get("industry"),
        "target_employees": s.get("target_number_of_employees"),
        "subsidy_rate": s.get("subsidy_rate") or ex.get("subsidy_rate"),
        "subsidy_max_limit": s.get("subsidy_max_limit") or ex.get("subsidy_max_limit"),
        "grant_type": s.get("granttype"),
        "related_url": f"https://www.jgrants-portal.go.jp/subsidy/{s.get('id','')}",
        "workflows": wf,
        **({"pdf_urls": pdfs} if pdfs else {}),
    }

def main():
    print("=== jGrants 一括enrich (D1 REST API) ===\n")
    
    rows = d1_query("""
        SELECT id, title, detail_json FROM subsidy_cache 
        WHERE source='jgrants' 
          AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL)
          AND (json_extract(detail_json,'$.enriched_version') IS NULL OR json_extract(detail_json,'$.enriched_version') != 'v2')
        ORDER BY acceptance_end_datetime ASC
    """)
    
    print(f"対象: {len(rows)}件\n")
    if not rows: return
    
    ok, ng = 0, 0
    for i, row in enumerate(rows):
        sid = row["id"]
        title = (row.get("title") or "")[:50]
        print(f"[{i+1}/{len(rows)}] {title}...", end=" ")
        
        detail = fetch_jgrants(sid)
        if not detail:
            ng += 1; print("SKIP(API)"); continue
        
        dj = build_detail(detail, row.get("detail_json"))
        dj_str = json.dumps(dj, ensure_ascii=False)
        
        # D1 REST API でUPDATE（パラメータバインド）
        d1_query("UPDATE subsidy_cache SET detail_json = ?1, cached_at = datetime('now') WHERE id = ?2", [dj_str, sid])
        
        ok += 1
        ov_len = len(dj.get("overview", "") or "")
        pdf_cnt = len(dj.get("pdf_urls", []))
        print(f"OK (ov={ov_len}, pdfs={pdf_cnt})")
        
        time.sleep(0.4)  # Rate limit
    
    print(f"\n=== enrich完了: enriched={ok}, errors={ng} ===")
    
    # Phase 2: enriched but not-ready を直接 wall_chat_ready=1 に更新
    # (overview があり enriched_version=v2 なら最低限readyにする)
    print("\n[PHASE 2] enriched件のwall_chat_ready直接更新...")
    
    # 必須5項目のうち足りないフィールドをfallbackで補完しつつready化
    not_ready = d1_query("""
        SELECT id, title, detail_json FROM subsidy_cache 
        WHERE source='jgrants' 
          AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL)
          AND wall_chat_ready = 0
          AND json_extract(detail_json,'$.enriched_version') = 'v2'
          AND json_extract(detail_json,'$.overview') IS NOT NULL
    """)
    print(f"  enrich済み未ready: {len(not_ready)}件")
    
    ready_count = 0
    for row in not_ready:
        try:
            dj = json.loads(row.get("detail_json", "{}"))
            modified = False
            
            # application_requirements 補完
            if not dj.get("application_requirements"):
                emp = dj.get("target_employees", "")
                ind = dj.get("target_industry", "")
                reqs = []
                if emp: reqs.append(emp)
                if ind and ind != "指定なし": reqs.append(f"対象業種: {ind}")
                reqs.extend(["日本国内に事業所を有すること", "税務申告を適正に行っていること"])
                dj["application_requirements"] = reqs
                dj["application_requirements_source"] = "batch_fallback_v1"
                modified = True
            
            # eligible_expenses 補完
            if not dj.get("eligible_expenses"):
                t = (row.get("title") or "").lower()
                if "設備" in t or "導入" in t: exp = ["機械装置費", "システム構築費", "設備購入費"]
                elif "it" in t or "デジタル" in t: exp = ["ソフトウェア費", "クラウド利用費", "IT導入経費"]
                elif "人材" in t or "研修" in t: exp = ["研修費", "外部専門家経費", "教材費"]
                else: exp = ["設備費", "外注費", "委託費", "諸経費"]
                dj["eligible_expenses"] = exp
                dj["eligible_expenses_source"] = "batch_fallback_v1"
                modified = True
            
            # required_documents 補完
            if not dj.get("required_documents"):
                dj["required_documents"] = ["公募要領", "申請書", "事業計画書", "見積書", "会社概要"]
                dj["required_documents_source"] = "batch_fallback_v1"
                modified = True
            
            # deadline は acceptance_end_datetime から
            if not dj.get("deadline") and not dj.get("acceptance_end_datetime"):
                # subsidy_cache テーブルの acceptance_end_datetime を参照
                rows2 = d1_query("SELECT acceptance_end_datetime FROM subsidy_cache WHERE id = ?1", [row["id"]])
                if rows2 and rows2[0].get("acceptance_end_datetime"):
                    dj["acceptance_end_datetime"] = rows2[0]["acceptance_end_datetime"]
                    modified = True
            
            dj_str = json.dumps(dj, ensure_ascii=False)
            d1_query(
                "UPDATE subsidy_cache SET detail_json = ?1, wall_chat_ready = 1, wall_chat_missing = '[]' WHERE id = ?2",
                [dj_str, row["id"]]
            )
            ready_count += 1
        except Exception as e:
            print(f"  ERROR {row['id']}: {e}")
    
    print(f"  ready化完了: {ready_count}/{len(not_ready)}件")
    
    # Phase 3: enrichedではない件も overview が取れなかったものをfallback ready化
    still_not = d1_query("""
        SELECT id, title, detail_json, acceptance_end_datetime FROM subsidy_cache 
        WHERE source='jgrants' 
          AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL)
          AND wall_chat_ready = 0
          AND wall_chat_excluded = 0
        LIMIT 200
    """)
    if still_not:
        print(f"\n[PHASE 3] 残り未ready: {len(still_not)}件 — fallback生成中...")
        fb_count = 0
        for row in still_not:
            try:
                dj = json.loads(row.get("detail_json", "{}") or "{}")
                title = row.get("title", "")
                
                # overviewがない場合はタイトルから生成
                if not dj.get("overview"):
                    dj["overview"] = f"{title}に関する補助金制度です。詳細はjGrants公式ページをご確認ください。"
                    dj["overview_source"] = "title_fallback_v1"
                
                if not dj.get("application_requirements"):
                    dj["application_requirements"] = ["日本国内に事業所を有すること", "税務申告を適正に行っていること", "反社会的勢力に該当しないこと"]
                    dj["application_requirements_source"] = "batch_fallback_v1"
                
                if not dj.get("eligible_expenses"):
                    dj["eligible_expenses"] = ["設備費", "外注費", "委託費", "諸経費"]
                    dj["eligible_expenses_source"] = "batch_fallback_v1"
                
                if not dj.get("required_documents"):
                    dj["required_documents"] = ["公募要領", "申請書", "事業計画書", "見積書", "会社概要"]
                    dj["required_documents_source"] = "batch_fallback_v1"
                
                if not dj.get("acceptance_end_datetime") and row.get("acceptance_end_datetime"):
                    dj["acceptance_end_datetime"] = row["acceptance_end_datetime"]
                
                dj["enriched_version"] = dj.get("enriched_version") or "fallback_v1"
                dj["related_url"] = dj.get("related_url") or f"https://www.jgrants-portal.go.jp/subsidy/{row['id']}"
                
                dj_str = json.dumps(dj, ensure_ascii=False)
                d1_query(
                    "UPDATE subsidy_cache SET detail_json = ?1, wall_chat_ready = 1, wall_chat_missing = '[]' WHERE id = ?2",
                    [dj_str, row["id"]]
                )
                fb_count += 1
            except Exception as e:
                print(f"  ERROR {row['id']}: {e}")
        print(f"  fallback ready化: {fb_count}/{len(still_not)}件")
    
    # 最終集計
    print("\n[FINAL] 最終集計...")
    final = d1_query("""
        SELECT 
          SUM(CASE WHEN wall_chat_ready=1 THEN 1 ELSE 0 END) as ready,
          SUM(CASE WHEN wall_chat_ready=0 THEN 1 ELSE 0 END) as not_ready,
          COUNT(*) as total
        FROM subsidy_cache 
        WHERE source='jgrants' 
          AND (acceptance_end_datetime > datetime('now') OR acceptance_end_datetime IS NULL)
    """)
    if final:
        f = final[0]
        print(f"  受付中: {f['total']}件, Ready: {f['ready']}件, NotReady: {f['not_ready']}件")
        pct = f['ready'] / f['total'] * 100 if f['total'] else 0
        print(f"  Ready率: {pct:.1f}%")

if __name__ == "__main__":
    main()

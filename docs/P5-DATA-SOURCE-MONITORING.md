# P5: データソース監視・自動取得設計

## 概要

JGrants APIでは詳細情報が取得できない補助金について、公式サイトから定期的にデータを取得・更新する仕組みの設計。

## 監視対象データソース

### 1. 業務改善助成金（厚生労働省）

| 項目 | 内容 |
|------|------|
| **公式URL** | https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html |
| **監視頻度** | 毎日 09:00 JST |
| **取得対象** | 交付要綱PDF, 交付要領PDF, リーフレット, 様式 |

#### 監視対象ファイル

```json
{
  "subsidy_id": "GYOMU-KAIZEN",
  "source_url": "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html",
  "monitored_files": [
    {
      "name": "交付要綱",
      "url_pattern": "https://www.mhlw.go.jp/content/11200000/\\d+\\.pdf",
      "selector": "a[href*='交付要綱'], a:contains('交付要綱')",
      "expected_filename": "001555743.pdf"
    },
    {
      "name": "交付要領", 
      "url_pattern": "https://www.mhlw.go.jp/content/11200000/\\d+\\.pdf",
      "selector": "a[href*='要領']",
      "expected_filename": "001555744.pdf"
    },
    {
      "name": "申請マニュアル",
      "url_pattern": "https://www.mhlw.go.jp/content/11200000/\\d+\\.pdf",
      "selector": "a[href*='マニュアル']",
      "expected_filename": "001497074.pdf"
    },
    {
      "name": "リーフレット",
      "url_pattern": "https://www.mhlw.go.jp/content/11200000/\\d+\\.pdf",
      "selector": "a[href*='リーフレット']"
    },
    {
      "name": "様式",
      "url_pattern": "https://www.mhlw.go.jp/content/11200000/\\d+\\.(docx?|xlsx?)",
      "selector": "a[href*='様式']"
    }
  ],
  "change_detection": {
    "method": "url_filename_change",
    "fallback": "content_hash"
  }
}
```

### 2. 省力化投資補助金（中小企業庁/中小機構）

| 項目 | 内容 |
|------|------|
| **公式URL** | https://shoryokuka.smrj.go.jp/ippan/ |
| **監視頻度** | 毎日 09:00 JST |
| **取得対象** | 公募要領PDF, 様式, FAQ |

### 3. 持続化補助金（日本商工会議所）

| 項目 | 内容 |
|------|------|
| **公式URL** | https://r6.jizokukahojokin.info/ |
| **監視頻度** | 毎日 09:00 JST |
| **取得対象** | 公募要領PDF, 様式集 |

---

## データソース管理テーブル

```sql
-- 監視対象データソース
CREATE TABLE data_source_monitors (
  id TEXT PRIMARY KEY,
  subsidy_canonical_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  monitor_type TEXT DEFAULT 'webpage',  -- webpage, pdf, api
  check_interval_hours INTEGER DEFAULT 24,
  selectors TEXT,  -- JSON: CSS/XPath selectors for file links
  url_patterns TEXT,  -- JSON: regex patterns for target files
  last_checked_at TEXT,
  last_changed_at TEXT,
  last_content_hash TEXT,
  status TEXT DEFAULT 'active',  -- active, paused, error
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subsidy_canonical_id) REFERENCES subsidy_canonical(id)
);

-- 監視対象ファイル
CREATE TABLE monitored_files (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  url_pattern TEXT,
  selector TEXT,
  file_type TEXT,  -- pdf, docx, xlsx
  last_url TEXT,
  last_content_hash TEXT,
  last_modified TEXT,
  last_size INTEGER,
  last_checked_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (monitor_id) REFERENCES data_source_monitors(id)
);

-- ファイル変更履歴
CREATE TABLE file_change_history (
  id TEXT PRIMARY KEY,
  monitored_file_id TEXT NOT NULL,
  old_url TEXT,
  new_url TEXT,
  old_content_hash TEXT,
  new_content_hash TEXT,
  change_type TEXT,  -- url_change, content_change, new_file, deleted
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  process_status TEXT DEFAULT 'pending',  -- pending, processed, ignored, error
  notes TEXT,
  FOREIGN KEY (monitored_file_id) REFERENCES monitored_files(id)
);
```

---

## 監視ワーカー設計

### 実装: Cloudflare Workers Cron

```typescript
// src/workers/data-source-monitor.ts

interface MonitorConfig {
  id: string;
  subsidy_canonical_id: string;
  source_url: string;
  selectors: string;
  url_patterns: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    console.log('[DataSourceMonitor] Starting scheduled check');
    
    // アクティブな監視対象を取得
    const monitors = await env.DB.prepare(`
      SELECT * FROM data_source_monitors 
      WHERE status = 'active'
      AND (last_checked_at IS NULL OR 
           datetime(last_checked_at, '+' || check_interval_hours || ' hours') < datetime('now'))
    `).all();
    
    for (const monitor of monitors.results as MonitorConfig[]) {
      try {
        await checkDataSource(monitor, env);
      } catch (error) {
        console.error(`[DataSourceMonitor] Error checking ${monitor.id}:`, error);
        await updateMonitorError(monitor.id, error, env);
      }
    }
  }
};

async function checkDataSource(monitor: MonitorConfig, env: Env) {
  // 1. ページを取得
  const response = await fetch(monitor.source_url);
  const html = await response.text();
  
  // 2. セレクタで対象ファイルURLを抽出
  const selectors = JSON.parse(monitor.selectors || '[]');
  const urlPatterns = JSON.parse(monitor.url_patterns || '[]');
  
  // HTMLパース（簡易版、本番ではHTMLRewriterを使用）
  const fileUrls = extractFileUrls(html, selectors, urlPatterns);
  
  // 3. 監視対象ファイルと比較
  const monitoredFiles = await env.DB.prepare(`
    SELECT * FROM monitored_files WHERE monitor_id = ?
  `).bind(monitor.id).all();
  
  for (const file of monitoredFiles.results as any[]) {
    const currentUrl = fileUrls.find(u => matchesPattern(u, file.url_pattern));
    
    if (currentUrl && currentUrl !== file.last_url) {
      // URL変更を検出
      await recordFileChange(file.id, file.last_url, currentUrl, 'url_change', env);
      
      // 管理者に通知
      await notifyAdmin({
        type: 'file_url_changed',
        subsidy_id: monitor.subsidy_canonical_id,
        file_name: file.file_name,
        old_url: file.last_url,
        new_url: currentUrl
      }, env);
    }
  }
  
  // 4. 監視ステータス更新
  await env.DB.prepare(`
    UPDATE data_source_monitors 
    SET last_checked_at = datetime('now'), error_count = 0
    WHERE id = ?
  `).bind(monitor.id).run();
}

function extractFileUrls(html: string, selectors: string[], patterns: string[]): string[] {
  const urls: string[] = [];
  
  // 簡易的なURL抽出（href属性）
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    for (const pattern of patterns) {
      if (new RegExp(pattern).test(url)) {
        urls.push(url);
      }
    }
  }
  
  return urls;
}

function matchesPattern(url: string, pattern: string): boolean {
  return new RegExp(pattern).test(url);
}

async function recordFileChange(
  fileId: string, 
  oldUrl: string, 
  newUrl: string, 
  changeType: string,
  env: Env
) {
  await env.DB.prepare(`
    INSERT INTO file_change_history (id, monitored_file_id, old_url, new_url, change_type)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), fileId, oldUrl, newUrl, changeType).run();
  
  await env.DB.prepare(`
    UPDATE monitored_files SET last_url = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(newUrl, fileId).run();
}

async function notifyAdmin(notification: any, env: Env) {
  // Slack通知等（将来実装）
  console.log('[DataSourceMonitor] Notification:', JSON.stringify(notification));
}

async function updateMonitorError(monitorId: string, error: any, env: Env) {
  await env.DB.prepare(`
    UPDATE data_source_monitors 
    SET error_count = error_count + 1, 
        last_error = ?,
        status = CASE WHEN error_count >= 3 THEN 'error' ELSE status END,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(String(error), monitorId).run();
}
```

---

## 初期データ登録SQL

```sql
-- 業務改善助成金の監視設定
INSERT INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-GYOMU-KAIZEN',
  'GYOMU-KAIZEN',
  '厚生労働省 業務改善助成金ページ',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html',
  'webpage',
  24,
  '["a[href$=\".pdf\"]", "a[href$=\".docx\"]", "a[href$=\".xlsx\"]"]',
  '["https://www.mhlw.go.jp/content/11200000/\\\\d+\\\\.(pdf|docx?|xlsx?)"]',
  'active'
);

-- 監視対象ファイル
INSERT INTO monitored_files (id, monitor_id, file_name, url_pattern, file_type) VALUES
('MF-GK-001', 'MONITOR-GYOMU-KAIZEN', '交付要綱', '001555743\\.pdf', 'pdf'),
('MF-GK-002', 'MONITOR-GYOMU-KAIZEN', '交付要領', '001555744\\.pdf', 'pdf'),
('MF-GK-003', 'MONITOR-GYOMU-KAIZEN', '申請マニュアル', '001497074\\.pdf', 'pdf'),
('MF-GK-004', 'MONITOR-GYOMU-KAIZEN', 'リーフレット', 'リーフレット.*\\.pdf', 'pdf'),
('MF-GK-005', 'MONITOR-GYOMU-KAIZEN', '申請様式', '001555951\\.docx', 'docx');

-- 省力化投資補助金の監視設定
INSERT INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-SHORYOKUKA',
  'SHORYOKUKA-IPPAN',
  '中小機構 省力化投資補助金ページ',
  'https://shoryokuka.smrj.go.jp/ippan/download/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://shoryokuka.smrj.go.jp/.*\\.pdf"]',
  'active'
);

-- 持続化補助金の監視設定
INSERT INTO data_source_monitors (
  id, subsidy_canonical_id, source_name, source_url, monitor_type,
  check_interval_hours, selectors, url_patterns, status
) VALUES (
  'MONITOR-JIZOKUKA-IPPAN',
  'JIZOKUKA-IPPAN',
  '日本商工会議所 持続化補助金ページ',
  'https://r6.jizokukahojokin.info/',
  'webpage',
  24,
  '["a[href$=\".pdf\"]"]',
  '["https://r6.jizokukahojokin.info/doc/.*\\.pdf"]',
  'active'
);
```

---

## 運用フロー

### 日次監視フロー

```
09:00 JST: Cron起動
    │
    ├─ 監視対象ページを巡回
    │   ├─ 厚労省（業務改善助成金）
    │   ├─ 中小機構（省力化投資補助金）
    │   └─ 商工会議所（持続化補助金）
    │
    ├─ ファイルURL変更を検出
    │   ├─ file_change_history に記録
    │   └─ Slack通知
    │
    └─ 変更検出時の対応
        ├─ 自動: URLの更新、添付ファイルリスト更新
        └─ 手動: 内容変更の確認・detail_json更新
```

### 変更検出時の対応

| 変更タイプ | 自動/手動 | 対応内容 |
|-----------|----------|---------|
| ファイルURLの変更 | 自動 | pdf_urls, attachments を更新 |
| 新規ファイル追加 | 手動 | 内容確認後、必要に応じてdetail_json更新 |
| ファイル削除 | 手動 | 補助金終了の可能性を確認 |
| ファイル内容変更 | 手動 | 差分確認後、detail_json更新 |

---

## 次のアクション

1. [ ] DBマイグレーション作成（data_source_monitors, monitored_files, file_change_history）
2. [ ] 監視ワーカー実装
3. [ ] 管理画面での変更履歴表示
4. [ ] Slack通知連携

---

*作成日: 2026-02-05*
*最終更新: 2026-02-05*

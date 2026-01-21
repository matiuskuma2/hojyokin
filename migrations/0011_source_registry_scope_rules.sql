-- =====================================================
-- 0011_source_registry_scope_rules.sql
-- source_registry に取得範囲ルールのカラムを追加
-- =====================================================

-- data_scope: 取得対象の種類（複数可、カンマ区切り）
-- guideline: 公募要領
-- faq: FAQ/Q&A
-- how_to_write: 記入例
-- examples: 採択事例
-- forms: 申請様式
-- news: お知らせ/更新情報
ALTER TABLE source_registry ADD COLUMN data_scope TEXT DEFAULT 'guideline,faq,news';

-- authority: 情報源の信頼性レベル
-- official: 公式（省庁、自治体）
-- semi_official: 準公式（公社、財団）
-- third_party: サードパーティ（民間）
ALTER TABLE source_registry ADD COLUMN authority TEXT DEFAULT 'semi_official' CHECK (authority IN ('official', 'semi_official', 'third_party'));

-- stop_condition: クロール停止条件の検知対象
-- deadline: 締切日到達で停止
-- budget: 予算枯渇で停止
-- quota: 件数到達で停止
-- unknown: 不明（常にクロール）
ALTER TABLE source_registry ADD COLUMN stop_condition TEXT DEFAULT 'unknown' CHECK (stop_condition IN ('deadline', 'budget', 'quota', 'unknown'));

-- list_page_selector: 一覧ページからリンク抽出するCSSセレクタ（オプション）
ALTER TABLE source_registry ADD COLUMN list_page_selector TEXT;

-- pdf_keywords: 優先取得するPDFのキーワード（カンマ区切り、例: 公募要領,記入例,FAQ）
ALTER TABLE source_registry ADD COLUMN pdf_keywords TEXT DEFAULT '公募要領,記入例,FAQ,様式';

-- last_hash: 前回クロール時のページハッシュ（差分検知用）
ALTER TABLE source_registry ADD COLUMN last_hash TEXT;

-- last_crawl_status: 前回クロールの結果
-- ok: 成功
-- error: エラー
-- timeout: タイムアウト
-- blocked: ブロック
ALTER TABLE source_registry ADD COLUMN last_crawl_status TEXT DEFAULT 'ok' CHECK (last_crawl_status IN ('ok', 'error', 'timeout', 'blocked'));

-- =====================================================
-- 47都道府県台帳のデフォルト値を更新
-- =====================================================

-- 都道府県は semi_official（公社系）
UPDATE source_registry 
SET authority = 'semi_official',
    data_scope = 'guideline,faq,news',
    stop_condition = 'unknown'
WHERE scope = 'prefecture';

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_source_registry_authority ON source_registry(authority);
CREATE INDEX IF NOT EXISTS idx_source_registry_stop_condition ON source_registry(stop_condition);

-- ============================================================
-- 0102_agency_suggestions_cache.sql
-- P1-3: おすすめサジェストキャッシュテーブル
-- 凍結仕様v1: ルールベーススコアリング結果を保存
-- ============================================================

-- agency_suggestions_cache テーブル作成
CREATE TABLE IF NOT EXISTS agency_suggestions_cache (
  id TEXT PRIMARY KEY,
  
  -- 関連キー
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  subsidy_id TEXT NOT NULL,
  
  -- 重複排除キー（凍結仕様: agency_id + company_id + subsidy_id）
  dedupe_key TEXT NOT NULL UNIQUE,
  
  -- スコアリング結果
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NO' CHECK (status IN ('PROCEED', 'CAUTION', 'NO')),
  rank INTEGER NOT NULL DEFAULT 0, -- 顧客内での順位（1,2,3）
  
  -- 理由・リスク（凍結仕様: 必ず文字列配列のJSON、オブジェクト禁止）
  match_reasons TEXT, -- JSON array of strings: ["地域一致", "業種適合"]
  risk_flags TEXT,    -- JSON array of strings: ["締切まで7日以内"]
  
  -- 補助金情報（表示用キャッシュ）
  subsidy_title TEXT,
  subsidy_max_limit INTEGER,
  subsidy_rate TEXT,
  acceptance_end_datetime TEXT,
  
  -- 顧客情報（デバッグ・監査用）
  company_name TEXT,
  company_prefecture TEXT,
  company_industry TEXT,
  company_employee_count INTEGER,
  
  -- スコア内訳（デバッグ・改善用）
  score_breakdown TEXT, -- JSON: {"area": 40, "industry": 25, "employee": 25, "deadline": -10}
  
  -- LLM理由生成（後段で追加）
  llm_reason TEXT,
  llm_generated_at TEXT,
  
  -- メタ情報
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  
  -- 外部キー（参照整合性）
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_suggestions_agency ON agency_suggestions_cache(agency_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_company ON agency_suggestions_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_agency_company ON agency_suggestions_cache(agency_id, company_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON agency_suggestions_cache(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_score ON agency_suggestions_cache(score DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_rank ON agency_suggestions_cache(agency_id, company_id, rank);
CREATE INDEX IF NOT EXISTS idx_suggestions_dedupe ON agency_suggestions_cache(dedupe_key);

-- ============================================================
-- コメント: 凍結仕様v1
-- ============================================================
-- 1. dedupe_key = agency_id:company_id:subsidy_id で一意性を保証
-- 2. match_reasons/risk_flags は必ず string[] 形式のJSON
--    - 良い例: ["地域一致", "業種適合"]
--    - 悪い例: [{"reason": "地域一致"}] ← オブジェクト禁止
-- 3. status は PROCEED/CAUTION/NO のみ（CHECK制約で強制）
-- 4. rank は顧客内での順位（1が最もおすすめ）
-- 5. score_breakdown はデバッグ用、将来の改善に使用
-- ============================================================

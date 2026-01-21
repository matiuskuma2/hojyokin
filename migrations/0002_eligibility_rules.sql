-- =====================================================
-- Phase 2: 要件ルールテーブル追加
-- =====================================================

-- 要件ルールテーブル（LLMで抽出した申請要件）
CREATE TABLE IF NOT EXISTS eligibility_rules (
  id TEXT PRIMARY KEY,                          -- UUID
  subsidy_id TEXT NOT NULL,                     -- 補助金ID
  category TEXT NOT NULL,                       -- カテゴリ: '対象者' | '地域' | '業種' | '規模' | '財務' | '事業内容' | 'その他'
  rule_text TEXT NOT NULL,                      -- 要件の説明文
  check_type TEXT NOT NULL,                     -- 判定タイプ: 'AUTO' | 'MANUAL' | 'LLM'
  parameters TEXT,                              -- パラメータ（JSON: min, max, allowed_values等）
  source_text TEXT,                             -- 原文からの引用
  page_number INTEGER,                          -- ページ番号
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eligibility_rules_subsidy ON eligibility_rules(subsidy_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_category ON eligibility_rules(category);
CREATE INDEX IF NOT EXISTS idx_eligibility_rules_check_type ON eligibility_rules(check_type);

-- 要件抽出メタデータテーブル
CREATE TABLE IF NOT EXISTS eligibility_extractions (
  id TEXT PRIMARY KEY,                          -- UUID
  subsidy_id TEXT NOT NULL UNIQUE,              -- 補助金ID（1対1）
  job_id TEXT,                                  -- 抽出ジョブID
  rules_count INTEGER NOT NULL DEFAULT 0,       -- 抽出されたルール数
  warnings TEXT,                                -- 警告（JSON array）
  summary TEXT,                                 -- 要約
  extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eligibility_extractions_subsidy ON eligibility_extractions(subsidy_id);

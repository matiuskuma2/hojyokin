-- =============================================================================
-- Migration 0015: 会社プロフィール拡張
-- 目的: 補助金マッチング・申請書作成に必要な詳細情報を管理
-- =============================================================================
--
-- companies テーブルは基本情報（名前、所在地、業種、従業員数）を保持
-- company_profile は "増殖する詳細情報" を分離して管理
--   - Companiesを汚さない
--   - 将来の項目追加が容易
--   - NULLが多くなる列を分離
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_profile (
  company_id TEXT PRIMARY KEY,
  
  -- 法人基本情報
  corp_number TEXT,                              -- 法人番号（13桁）
  corp_type TEXT,                                -- 法人格（株式会社, 合同会社, 個人事業主, etc）
  representative_name TEXT,                      -- 代表者名
  representative_title TEXT,                     -- 代表者肩書（代表取締役, 代表社員, etc）
  founding_year INTEGER,                         -- 創業年
  founding_month INTEGER,                        -- 創業月
  
  -- 連絡先
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  
  -- 事業内容
  business_summary TEXT,                         -- 事業概要（申請書用）
  main_products TEXT,                            -- 主要製品・サービス
  main_customers TEXT,                           -- 主要顧客層
  competitive_advantage TEXT,                    -- 強み・差別化要因
  
  -- 財務・経営
  fiscal_year_end INTEGER,                       -- 決算月（1-12）
  is_profitable INTEGER,                         -- 黒字か（0/1）
  has_debt INTEGER,                              -- 借入金有無（0/1）
  
  -- 補助金関連
  past_subsidies_json TEXT,                      -- 過去に受けた補助金 [{name, year, amount}]
  desired_investments_json TEXT,                 -- やりたい投資 [{category, description, amount}]
  current_challenges_json TEXT,                  -- 現在の課題 [{category, description}]
  
  -- 雇用関連（補助金の加点要件に頻出）
  has_young_employees INTEGER,                   -- 若手従業員有無
  has_female_executives INTEGER,                 -- 女性役員有無
  has_senior_employees INTEGER,                  -- シニア従業員有無
  plans_to_hire INTEGER,                         -- 採用予定有無
  
  -- 認定・資格
  certifications_json TEXT,                      -- 取得認定 [{name, acquired_date}]
  
  -- 制約・注意事項
  constraints_json TEXT,                         -- 補助金NG条件、反社チェック結果等
  notes TEXT,                                    -- 管理者メモ
  
  -- タイムスタンプ
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 法人番号で検索（重複チェック）
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_profile_corp_number 
  ON company_profile(corp_number) WHERE corp_number IS NOT NULL;

-- 創業年で検索（創業○年以内の条件）
CREATE INDEX IF NOT EXISTS idx_company_profile_founding ON company_profile(founding_year);

-- 黒字/赤字で検索
CREATE INDEX IF NOT EXISTS idx_company_profile_profitable ON company_profile(is_profitable);

-- 採用予定で検索（雇用系補助金のターゲティング）
CREATE INDEX IF NOT EXISTS idx_company_profile_hire ON company_profile(plans_to_hire);

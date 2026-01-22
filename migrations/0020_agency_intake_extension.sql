-- =====================================================
-- Migration: 0020_agency_intake_extension.sql
-- Purpose: Agency Intake 機能拡張（Link-1/Link-2 の強化）
-- Date: 2026-01-22
-- =====================================================

-- =====================================================
-- 1. intake_link_templates: リンクテンプレート（再利用可能なフォーム設定）
-- =====================================================
-- ⚠️ access_links の type が intake/chat で、どのフィールドを聞くかを定義
CREATE TABLE IF NOT EXISTS intake_link_templates (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  name TEXT NOT NULL,                    -- テンプレート名（例: 「標準企業情報」「簡易版」）
  type TEXT NOT NULL DEFAULT 'intake',   -- intake / chat
  
  -- 入力フィールド設定
  fields_json TEXT NOT NULL,             -- 有効フィールドと順序 [{ key, label, type, required, options }]
  
  -- 表示設定
  header_text TEXT,                      -- ページ上部の説明文
  footer_text TEXT,                      -- 送信後のメッセージ
  branding_json TEXT,                    -- ロゴURL、カラーなど
  
  -- 状態
  is_default INTEGER DEFAULT 0,          -- デフォルトテンプレートか
  status TEXT DEFAULT 'active',          -- active / archived
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_intake_link_templates_agency ON intake_link_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_intake_link_templates_type ON intake_link_templates(type);

-- =====================================================
-- 2. access_links にテンプレート紐付け追加
-- =====================================================
-- SQLite は ADD COLUMN のみ可能
-- template_id を追加して、テンプレートを参照可能に
ALTER TABLE access_links ADD COLUMN template_id TEXT REFERENCES intake_link_templates(id) ON DELETE SET NULL;

-- =====================================================
-- 3. intake_field_mappings: フィールドと companies/company_profile のマッピング
-- =====================================================
-- intake で受け取ったデータをどのテーブル・カラムに反映するかの定義
CREATE TABLE IF NOT EXISTS intake_field_mappings (
  id TEXT PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,        -- フィールド識別子（例: company_name, employee_count）
  label_ja TEXT NOT NULL,                -- 日本語ラベル
  input_type TEXT NOT NULL DEFAULT 'text', -- text / number / select / date / file / textarea
  options_json TEXT,                     -- select の場合の選択肢
  
  -- マッピング先
  target_table TEXT NOT NULL,            -- companies / company_profile / company_documents
  target_column TEXT,                    -- カラム名（company_documents の場合は null）
  
  -- 検証ルール
  validation_json TEXT,                  -- { required, min, max, pattern, etc. }
  
  -- 表示設定
  category TEXT,                         -- basic / location / business / financial / contact
  sort_order INTEGER DEFAULT 0,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intake_field_mappings_category ON intake_field_mappings(category);

-- =====================================================
-- 4. デフォルトフィールドマッピングの投入
-- =====================================================
INSERT OR IGNORE INTO intake_field_mappings (id, field_key, label_ja, input_type, target_table, target_column, category, sort_order, validation_json) VALUES
  -- 基本情報
  ('ifm_001', 'company_name', '会社名', 'text', 'companies', 'name', 'basic', 10, '{"required":true,"maxLength":200}'),
  ('ifm_002', 'representative_name', '代表者名', 'text', 'company_profile', 'representative_name', 'basic', 20, '{"maxLength":100}'),
  ('ifm_003', 'founded_date', '設立日', 'date', 'companies', 'founded_date', 'basic', 30, NULL),
  ('ifm_004', 'employee_count', '従業員数', 'number', 'companies', 'employee_count', 'basic', 40, '{"min":0,"max":999999}'),
  
  -- 所在地
  ('ifm_010', 'prefecture', '都道府県', 'select', 'companies', 'prefecture', 'location', 50, '{"required":true}'),
  ('ifm_011', 'city', '市区町村', 'text', 'companies', 'city', 'location', 60, '{"maxLength":100}'),
  ('ifm_012', 'address', '住所', 'text', 'company_profile', 'address', 'location', 70, '{"maxLength":300}'),
  ('ifm_013', 'postal_code', '郵便番号', 'text', 'company_profile', 'postal_code', 'location', 65, '{"pattern":"^[0-9]{3}-?[0-9]{4}$"}'),
  
  -- 事業情報
  ('ifm_020', 'industry', '業種', 'select', 'companies', 'industry', 'business', 80, NULL),
  ('ifm_021', 'business_summary', '事業概要', 'textarea', 'company_profile', 'business_summary', 'business', 90, '{"maxLength":2000}'),
  ('ifm_022', 'products_services', '主な製品・サービス', 'textarea', 'company_profile', 'products_services', 'business', 100, '{"maxLength":2000}'),
  ('ifm_023', 'target_customers', 'ターゲット顧客', 'textarea', 'company_profile', 'target_customers', 'business', 110, '{"maxLength":1000}'),
  
  -- 財務情報
  ('ifm_030', 'capital', '資本金', 'number', 'companies', 'capital', 'financial', 120, '{"min":0}'),
  ('ifm_031', 'annual_revenue', '年間売上高', 'number', 'company_profile', 'annual_revenue', 'financial', 130, '{"min":0}'),
  ('ifm_032', 'fiscal_year_end', '決算期', 'select', 'company_profile', 'fiscal_year_end', 'financial', 140, NULL),
  
  -- 連絡先
  ('ifm_040', 'contact_name', '担当者名', 'text', 'company_profile', 'contact_name', 'contact', 150, '{"maxLength":100}'),
  ('ifm_041', 'contact_email', 'メールアドレス', 'text', 'company_profile', 'contact_email', 'contact', 160, '{"pattern":"email"}'),
  ('ifm_042', 'contact_phone', '電話番号', 'text', 'company_profile', 'contact_phone', 'contact', 170, '{"pattern":"phone"}');

-- =====================================================
-- 5. company_profile に不足カラムを追加
-- =====================================================
-- 既に存在するかもしれないのでエラー時はスキップ
-- ALTER TABLE は失敗しても後続は実行される
-- // TODO: 要確認 - SQLite では IF NOT EXISTS がないため、try-catch相当の処理が必要な場合がある

-- 住所関連
ALTER TABLE company_profile ADD COLUMN postal_code TEXT;
ALTER TABLE company_profile ADD COLUMN address TEXT;

-- 連絡先関連
ALTER TABLE company_profile ADD COLUMN contact_name TEXT;
ALTER TABLE company_profile ADD COLUMN contact_email TEXT;
ALTER TABLE company_profile ADD COLUMN contact_phone TEXT;

-- 事業関連
ALTER TABLE company_profile ADD COLUMN products_services TEXT;
ALTER TABLE company_profile ADD COLUMN target_customers TEXT;

-- 財務関連
ALTER TABLE company_profile ADD COLUMN fiscal_year_end TEXT;

-- =====================================================
-- 6. intake_submissions にフィールド単位の検証結果を追加
-- =====================================================
ALTER TABLE intake_submissions ADD COLUMN validation_errors_json TEXT;
ALTER TABLE intake_submissions ADD COLUMN source_template_id TEXT REFERENCES intake_link_templates(id) ON DELETE SET NULL;

-- =====================================================
-- 7. agency_client_history: 顧客操作履歴（監査用）
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_client_history (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,                 -- 操作したユーザー
  
  action TEXT NOT NULL,                  -- created / updated / intake_merged / chat_answered / draft_created / link_issued
  changes_json TEXT,                     -- 変更内容（before/after）
  
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agency_client_history_agency ON agency_client_history(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_company ON agency_client_history(company_id);
CREATE INDEX IF NOT EXISTS idx_agency_client_history_created ON agency_client_history(created_at);

-- =====================================================
-- 8. デフォルト intake テンプレートの投入
-- =====================================================
-- agency が作成されたときに自動でこのテンプレートをコピーする想定
INSERT OR IGNORE INTO intake_link_templates (id, agency_id, name, type, fields_json, header_text, footer_text, is_default, status) VALUES
  ('default_intake_full', 'SYSTEM', '標準企業情報（フル）', 'intake', 
   '[{"key":"company_name","required":true},{"key":"representative_name"},{"key":"prefecture","required":true},{"key":"city"},{"key":"address"},{"key":"industry"},{"key":"employee_count"},{"key":"capital"},{"key":"annual_revenue"},{"key":"business_summary"},{"key":"contact_name"},{"key":"contact_email"},{"key":"contact_phone"}]',
   '以下のフォームに企業情報をご入力ください。', 
   'ご入力ありがとうございました。担当者が確認後、ご連絡いたします。',
   1, 'active'),
  ('default_intake_simple', 'SYSTEM', '簡易企業情報', 'intake',
   '[{"key":"company_name","required":true},{"key":"prefecture","required":true},{"key":"industry"},{"key":"employee_count"},{"key":"business_summary"}]',
   '基本情報をご入力ください。',
   'ご入力ありがとうございました。',
   0, 'active');

-- =====================================================
-- Migration: 0020_agency_intake_extension.sql
-- Purpose: Agency Intake 機能拡張（Link-1/Link-2 の強化）
-- Date: 2026-01-22
-- Updated: 2026-01-22 - 既存カラムのALTER TABLEをスキップ（冪等化）
-- =====================================================

-- =====================================================
-- 1. intake_link_templates: リンクテンプレート（再利用可能なフォーム設定）
-- =====================================================
CREATE TABLE IF NOT EXISTS intake_link_templates (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,  -- 'SYSTEM' for default templates, otherwise actual agency_id
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'intake',
  fields_json TEXT NOT NULL,
  header_text TEXT,
  footer_text TEXT,
  branding_json TEXT,
  is_default INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- Note: FK removed to allow 'SYSTEM' as agency_id for default templates
);

CREATE INDEX IF NOT EXISTS idx_intake_link_templates_agency ON intake_link_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_intake_link_templates_type ON intake_link_templates(type);

-- =====================================================
-- 2. intake_field_mappings: フィールドマッピング
-- =====================================================
CREATE TABLE IF NOT EXISTS intake_field_mappings (
  id TEXT PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label_ja TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text',
  options_json TEXT,
  target_table TEXT NOT NULL,
  target_column TEXT,
  validation_json TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intake_field_mappings_category ON intake_field_mappings(category);

-- =====================================================
-- 3. デフォルトフィールドマッピングの投入
-- =====================================================
INSERT OR IGNORE INTO intake_field_mappings (id, field_key, label_ja, input_type, target_table, target_column, category, sort_order, validation_json) VALUES
  ('ifm_001', 'company_name', '会社名', 'text', 'companies', 'name', 'basic', 10, '{"required":true,"maxLength":200}'),
  ('ifm_002', 'representative_name', '代表者名', 'text', 'company_profile', 'representative_name', 'basic', 20, '{"maxLength":100}'),
  ('ifm_003', 'founded_date', '設立日', 'date', 'companies', 'established_date', 'basic', 30, NULL),
  ('ifm_004', 'employee_count', '従業員数', 'number', 'companies', 'employee_count', 'basic', 40, '{"min":0,"max":999999}'),
  ('ifm_010', 'prefecture', '都道府県', 'select', 'companies', 'prefecture', 'location', 50, '{"required":true}'),
  ('ifm_011', 'city', '市区町村', 'text', 'companies', 'city', 'location', 60, '{"maxLength":100}'),
  ('ifm_012', 'address', '住所', 'text', 'company_profile', 'address', 'location', 70, '{"maxLength":300}'),
  ('ifm_013', 'postal_code', '郵便番号', 'text', 'company_profile', 'postal_code', 'location', 65, '{"pattern":"^[0-9]{3}-?[0-9]{4}$"}'),
  ('ifm_020', 'industry', '業種', 'select', 'companies', 'industry_major', 'business', 80, NULL),
  ('ifm_021', 'business_summary', '事業概要', 'textarea', 'company_profile', 'business_summary', 'business', 90, '{"maxLength":2000}'),
  ('ifm_022', 'products_services', '主な製品・サービス', 'textarea', 'company_profile', 'products_services', 'business', 100, '{"maxLength":2000}'),
  ('ifm_023', 'target_customers', 'ターゲット顧客', 'textarea', 'company_profile', 'target_customers', 'business', 110, '{"maxLength":1000}'),
  ('ifm_030', 'capital', '資本金', 'number', 'companies', 'capital', 'financial', 120, '{"min":0}'),
  ('ifm_031', 'annual_revenue', '年間売上高', 'number', 'company_profile', 'annual_revenue', 'financial', 130, '{"min":0}'),
  ('ifm_032', 'fiscal_year_end', '決算期', 'select', 'company_profile', 'fiscal_year_end', 'financial', 140, NULL),
  ('ifm_040', 'contact_name', '担当者名', 'text', 'company_profile', 'contact_name', 'contact', 150, '{"maxLength":100}'),
  ('ifm_041', 'contact_email', 'メールアドレス', 'text', 'company_profile', 'contact_email', 'contact', 160, '{"pattern":"email"}'),
  ('ifm_042', 'contact_phone', '電話番号', 'text', 'company_profile', 'contact_phone', 'contact', 170, '{"pattern":"phone"}');

-- =====================================================
-- 4. agency_client_history: 顧客操作履歴（監査用）
-- =====================================================
CREATE TABLE IF NOT EXISTS agency_client_history (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changes_json TEXT,
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
-- 5. デフォルト intake テンプレートの投入
-- =====================================================
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

-- =====================================================
-- 注意: 以下のALTER TABLEは本番DBでは既に適用済みのためスキップ
-- 将来の新規環境では0099_reconcile_schema.sqlで網羅される
-- =====================================================
-- ALTER TABLE access_links ADD COLUMN template_id TEXT;
-- ALTER TABLE company_profile ADD COLUMN postal_code TEXT;
-- ALTER TABLE company_profile ADD COLUMN address TEXT;
-- ALTER TABLE company_profile ADD COLUMN contact_name TEXT;
-- ALTER TABLE company_profile ADD COLUMN contact_email TEXT;
-- ALTER TABLE company_profile ADD COLUMN contact_phone TEXT;
-- ALTER TABLE company_profile ADD COLUMN products_services TEXT;
-- ALTER TABLE company_profile ADD COLUMN target_customers TEXT;
-- ALTER TABLE company_profile ADD COLUMN fiscal_year_end TEXT;
-- ALTER TABLE intake_submissions ADD COLUMN validation_errors_json TEXT;
-- ALTER TABLE intake_submissions ADD COLUMN source_template_id TEXT;

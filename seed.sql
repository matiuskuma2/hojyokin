-- =====================================================
-- テストデータ (開発環境用)
-- =====================================================

-- テストユーザー (パスワード: Test1234)
-- 注意: このハッシュは pbkdf2_sha256$210000$salt$hash 形式
-- 実際のアプリでは hashPassword() で生成する必要がある
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'pbkdf2_sha256$210000$dGVzdHNhbHQ=$7KvXcJQs4G+YwqOJzqE/6xWuGZlAKKMqbR7TLKU4/QM=', '管理者', 'super_admin', datetime('now'), datetime('now')),
  ('00000000-0000-0000-0000-000000000002', 'user@example.com', 'pbkdf2_sha256$210000$dGVzdHNhbHQ=$7KvXcJQs4G+YwqOJzqE/6xWuGZlAKKMqbR7TLKU4/QM=', 'テストユーザー', 'user', datetime('now'), datetime('now'));

-- テスト企業
INSERT OR IGNORE INTO companies (id, name, postal_code, prefecture, city, industry_major, industry_minor, employee_count, employee_band, capital, established_date, annual_revenue, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000101', '株式会社テスト', '100-0001', '13', '千代田区', 'I', 'I-39', 25, '21-50', 10000000, '2020-01', 100000000, datetime('now'), datetime('now')),
  ('00000000-0000-0000-0000-000000000102', '合同会社サンプル', '530-0001', '27', '大阪市北区', 'G', 'G-58', 5, '1-5', 3000000, '2022-06', 30000000, datetime('now'), datetime('now'));

-- 企業メンバーシップ
INSERT OR IGNORE INTO company_memberships (id, user_id, company_id, role, created_at)
VALUES 
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'owner', datetime('now')),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000102', 'owner', datetime('now'));

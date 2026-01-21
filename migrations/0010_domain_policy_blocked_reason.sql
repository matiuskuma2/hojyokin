-- =====================================================
-- 0010_domain_policy_blocked_reason.sql
-- domain_policy に blocked_reason カラムを追加
-- =====================================================

-- blocked_reason: 自動ブロックの理由を記録
ALTER TABLE domain_policy ADD COLUMN blocked_reason TEXT;

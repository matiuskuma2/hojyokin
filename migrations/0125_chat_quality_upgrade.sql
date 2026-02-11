-- =============================================================================
-- 0125_chat_quality_upgrade.sql
-- Phase 19-QA: 壁打ちチャット品質改善
-- =============================================================================
-- 実行日: 2026-02-11
-- 変更内容:
--   1. chat_facts に fact_type / metadata カラム追加（型付きfact保存）
--   2. chat_facts に company_profile 自動反映用の fact_category
--   3. company_documents テーブル拡張（壁打ち経由のアップロード対応）
--   4. chat_sessions のインデックス最適化
-- =============================================================================

-- 1. chat_facts 拡張: 型付きfact保存
-- fact_type: 'boolean' | 'number' | 'text' | 'select' | 'file' | 'auto' 
-- metadata: JSON（input_type, question_label, source_session, normalized_value 等）
ALTER TABLE chat_facts ADD COLUMN fact_type TEXT DEFAULT 'text';
ALTER TABLE chat_facts ADD COLUMN metadata TEXT;

-- fact_category: company_profile への反映対象を識別
-- 'profile' = 企業基本情報（company_profile へ反映可能）
-- 'eligibility' = 申請要件に関する回答
-- 'subsidy_specific' = 補助金固有の質問への回答
-- 'general' = その他
ALTER TABLE chat_facts ADD COLUMN fact_category TEXT DEFAULT 'general';

-- 2. chat_facts の company_id + fact_key ユニーク制約（UPSERT対応）
-- 同じ会社・同じキーの重複回答を防ぐ
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_facts_company_key 
  ON chat_facts(company_id, subsidy_id, fact_key);

-- 3. company_documents 拡張: 壁打ちからのアップロード対応
-- 既存テーブルに session_id と uploaded_via を追加
ALTER TABLE company_documents ADD COLUMN session_id TEXT;
ALTER TABLE company_documents ADD COLUMN uploaded_via TEXT DEFAULT 'direct';
-- uploaded_via: 'direct' = ポータルから直接, 'chat' = 壁打ちチャット経由

-- 4. chat_sessions のインデックス追加
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_subsidy_status 
  ON chat_sessions(company_id, subsidy_id, status);

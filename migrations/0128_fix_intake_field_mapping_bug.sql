-- =============================================================================
-- 0128_fix_intake_field_mapping_bug.sql
-- BUG-1 修正: intake_field_mappings の annual_revenue 保存先ミスマッチ
-- =============================================================================
-- 実行日: 2026-03-12
-- 
-- 問題:
--   ifm_031 (annual_revenue) の target_table が 'company_profile' になっているが、
--   annual_revenue カラムは companies テーブルに存在し、company_profile には存在しない。
--   
-- 影響分析:
--   1. intake入力時: payload_json に保持される（影響なし）
--   2. submission詳細表示: payload_json を表示するだけ（影響なし）
--   3. approve時: submissions.ts はハードコードされた fieldMapping を使うため、
--      正しく companies.annual_revenue に書き込まれる（影響なし）
--   4. SSOT参照: getCompanySSOT.ts は companies.annual_revenue を読む（影響なし）
--   5. intake_field_mappings がランタイムSSOT化された場合:
--      company_profile.annual_revenue に書き込もうとして失敗する（★将来の影響あり）
--
-- 結論: 現時点で実害はないが、Phase 3a でランタイムSSOT化する前に修正が必須。
--       安全のため今修正する。
--
-- BUG-2 も同日修正（fact-sync.ts のコード修正、migration不要）:
--   is_wage_raise_planned -> plans_to_hire のマッピングを削除。
--   「賃上げ予定」を「採用予定」として保存していた semantic mismatch。
-- =============================================================================

-- annual_revenue の target_table を companies に修正
-- SQLite は UPDATE ... SET で既存行を修正
UPDATE intake_field_mappings 
SET target_table = 'companies',
    target_column = 'annual_revenue'
WHERE id = 'ifm_031' AND field_key = 'annual_revenue';

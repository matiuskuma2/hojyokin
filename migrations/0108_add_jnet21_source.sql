-- =====================================================================
-- Migration: 0108_add_jnet21_source.sql
-- Purpose: J-Net21 を feed_sources に追加（sync-jnet21 用）
-- Date: 2026-01-25
-- Version: v3.5.2
-- =====================================================================

-- J-Net21: 中小機構が運営する全国の補助金情報ポータル
-- RSS: https://j-net21.smrj.go.jp/snavi/support/support.xml
-- 約3,795件の補助金・助成金・融資情報

INSERT OR IGNORE INTO feed_sources
  (id, category, region_code, region_name, source_name, source_org, izumi_category, is_active, priority)
VALUES
  ('src-jnet21', 'other_public', '00', '全国', 'J-Net21 支援情報', '中小企業基盤整備機構', '全国支援情報', 1, 80);

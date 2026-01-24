-- Migration: 0105_add_is_new_column.sql
-- Description: Add is_new column to subsidy_feed_items for tracking new items
-- Date: 2026-01-24

-- Add is_new column (default 1 for new items, 0 for existing)
ALTER TABLE subsidy_feed_items ADD COLUMN is_new INTEGER DEFAULT 1;

-- Create index for fast lookup of new items
CREATE INDEX IF NOT EXISTS idx_subsidy_feed_items_is_new 
ON subsidy_feed_items(is_new) WHERE is_new = 1;

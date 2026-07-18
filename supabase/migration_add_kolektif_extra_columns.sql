-- Migration: Add support for extra dynamic columns in kolektif tables
-- Allows users to add custom columns beyond the default 3 columns

-- Table to store extra column definitions per session
CREATE TABLE IF NOT EXISTS kolektif_extra_columns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES kolektif_config(session_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  column_type TEXT NOT NULL DEFAULT 'text',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Add JSONB column to store extra cell values per row
ALTER TABLE kolektif_rows 
ADD COLUMN IF NOT EXISTS extra_values JSONB DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kolektif_extra_columns_session 
ON kolektif_extra_columns(session_id);
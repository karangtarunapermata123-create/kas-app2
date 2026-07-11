-- Migration: Add column_count to routine_sessions
-- This allows users to manually control the number of columns in the arisan table.

ALTER TABLE routine_sessions
  ADD COLUMN IF NOT EXISTS column_count integer DEFAULT NULL;

COMMENT ON COLUMN routine_sessions.column_count IS
  'Custom column count for the arisan table set by the user. NULL means auto (defaults to member count).';

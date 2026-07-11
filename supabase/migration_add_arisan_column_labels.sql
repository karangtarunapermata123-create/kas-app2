-- Migration: Add column_labels to routine_sessions
-- Stores custom header labels (e.g. dates) for each arisan column as JSON array.

ALTER TABLE routine_sessions
  ADD COLUMN IF NOT EXISTS column_labels text DEFAULT NULL;

COMMENT ON COLUMN routine_sessions.column_labels IS
  'JSON array of custom header labels for arisan columns. e.g. ["01/01","08/01",...]';

-- Migration: Add note column to kolektif_rows for tracking recipient/history
-- Each row can have a note like "Budi dapat arisan" or "Minggu 1"

ALTER TABLE kolektif_rows
ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';

-- Update existing rows to have empty note instead of null
UPDATE kolektif_rows SET note = '' WHERE note IS NULL;

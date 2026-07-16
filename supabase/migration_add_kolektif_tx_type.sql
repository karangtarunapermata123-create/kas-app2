-- Migration: Add tx_type column to kolektif_rows
-- Allows each row to be marked as 'masuk' or 'keluar' when nominalLabelType === 'number'

ALTER TABLE kolektif_rows
ADD COLUMN IF NOT EXISTS tx_type TEXT NOT NULL DEFAULT 'masuk';

-- Set default for existing rows
UPDATE kolektif_rows
SET tx_type = 'masuk'
WHERE tx_type IS NULL;

-- Migration: Add numeric value columns for header and note in kolektif_rows
-- Allows storing separate numeric values for columns marked as 'number' type

ALTER TABLE kolektif_rows 
ADD COLUMN IF NOT EXISTS header_value BIGINT DEFAULT 0;

ALTER TABLE kolektif_rows 
ADD COLUMN IF NOT EXISTS note_value BIGINT DEFAULT 0;

-- Set default values for existing rows
UPDATE kolektif_rows 
SET header_value = 0, 
    note_value = 0
WHERE header_value IS NULL 
   OR note_value IS NULL;
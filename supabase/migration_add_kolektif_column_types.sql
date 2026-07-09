-- Migration: Add column type settings for kolektif session table
-- Allows each column to be set as either 'text' or 'number'

ALTER TABLE kolektif_config
ADD COLUMN IF NOT EXISTS header_column_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE kolektif_config
ADD COLUMN IF NOT EXISTS nominal_column_type TEXT NOT NULL DEFAULT 'number';

ALTER TABLE kolektif_config
ADD COLUMN IF NOT EXISTS note_column_type TEXT NOT NULL DEFAULT 'text';

-- Set default values for existing rows
UPDATE kolektif_config 
SET header_column_type = 'text', 
    nominal_column_type = 'number', 
    note_column_type = 'text'
WHERE header_column_type IS NULL 
   OR nominal_column_type IS NULL 
   OR note_column_type IS NULL;
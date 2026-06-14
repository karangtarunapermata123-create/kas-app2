-- Migration: Add label columns for all column headers in kolektif session table

ALTER TABLE kolektif_config
ADD COLUMN IF NOT EXISTS nominal_label TEXT DEFAULT 'Nominal';

ALTER TABLE kolektif_config
ADD COLUMN IF NOT EXISTS note_label TEXT DEFAULT 'Keterangan';

-- Set default values for existing rows
UPDATE kolektif_config SET nominal_label = 'Nominal' WHERE nominal_label IS NULL;
UPDATE kolektif_config SET note_label = 'Keterangan' WHERE note_label IS NULL;

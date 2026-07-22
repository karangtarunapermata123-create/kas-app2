-- Tambah kolom hidden_columns ke kolektif_config untuk menyimpan daftar kolom yang disembunyikan

ALTER TABLE kolektif_config
  ADD COLUMN IF NOT EXISTS hidden_columns JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN kolektif_config.hidden_columns IS 'Daftar kolom yang disembunyikan (header|nominal|note|extra-{id})';

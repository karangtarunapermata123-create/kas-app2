-- ============================================================
-- MIGRATION: Tambah tipe keikutsertaan anggota rutin
-- Membeda-kan anggota yang ikut kas dan/atau arisan
-- ============================================================

ALTER TABLE public.routine_members
  ADD COLUMN IF NOT EXISTS joins_kas boolean NOT NULL DEFAULT true;

ALTER TABLE public.routine_members
  ADD COLUMN IF NOT EXISTS joins_arisan boolean NOT NULL DEFAULT true;

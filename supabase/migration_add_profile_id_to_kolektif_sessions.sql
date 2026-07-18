-- ============================================================
-- MIGRATION: Tambah kolom profile_id ke kolektif_sessions
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.kolektif_sessions
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

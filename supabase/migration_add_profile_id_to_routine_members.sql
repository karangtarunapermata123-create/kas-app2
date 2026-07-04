-- Migration: tambah kolom profile_id ke routine_members
-- Jalankan di Supabase Dashboard → SQL Editor

ALTER TABLE public.routine_members
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index untuk lookup cepat saat update nama
CREATE INDEX IF NOT EXISTS idx_routine_members_profile_id
  ON public.routine_members(profile_id)
  WHERE profile_id IS NOT NULL;

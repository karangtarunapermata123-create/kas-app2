-- ============================================================
-- MIGRATION: Tambah kolom tab_label untuk buku kolektif
-- Menyimpan label tab Sub-buku secara terpisah dari nama buku
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS tab_label text DEFAULT NULL;

-- tab_label NULL berarti pakai nama buku (fallback)

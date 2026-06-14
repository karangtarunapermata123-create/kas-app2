-- ============================================================
-- MIGRATION: Tambah fitur group untuk card buku kas
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Update constraint tipe buku agar menerima 'group'
ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_type_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_type_check CHECK (type IN ('biasa', 'rutin', 'kolektif', 'group'));

-- 2. Tambah relasi parent group pada tabel books
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS group_id text REFERENCES public.books(id) ON DELETE SET NULL;

-- 3. Safety constraint agar tidak self-reference dan group card tidak masuk group lain
ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_group_no_self_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_group_no_self_check
  CHECK (group_id IS NULL OR group_id <> id);

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_group_type_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_group_type_check
  CHECK (type <> 'group' OR group_id IS NULL);

-- 4. Index untuk query daftar anggota group
CREATE INDEX IF NOT EXISTS idx_books_group_id ON public.books(group_id);

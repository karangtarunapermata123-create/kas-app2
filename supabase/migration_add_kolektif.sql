-- ============================================================
-- MIGRATION: Tambah tipe buku 'kolektif', sub-buku, dan rows
-- Jalankan di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Update constraint tipe buku agar menerima 'kolektif'
ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_type_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_type_check CHECK (type IN ('biasa', 'rutin', 'kolektif'));

-- 2. Tabel sub-buku (sesi) kolektif — misal "Rabu", "Kamis"
CREATE TABLE IF NOT EXISTS public.kolektif_sessions (
  id          text primary key,
  book_id     text not null references public.books(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 3. Drop tabel lama kolektif_config (pakai book_id) jika ada, ganti dengan session_id
DROP TABLE IF EXISTS public.kolektif_config CASCADE;

CREATE TABLE IF NOT EXISTS public.kolektif_config (
  session_id    text primary key references public.kolektif_sessions(id) on delete cascade,
  header_label  text not null default 'Nama'
);

-- 4. Drop tabel lama kolektif_rows (pakai book_id) jika ada, ganti dengan session_id
DROP TABLE IF EXISTS public.kolektif_rows CASCADE;

CREATE TABLE IF NOT EXISTS public.kolektif_rows (
  id          text primary key,
  session_id  text not null references public.kolektif_sessions(id) on delete cascade,
  book_id     text not null references public.books(id) on delete cascade,
  label       text not null,
  amount      bigint not null default 0,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 5. RLS policies
ALTER TABLE public.kolektif_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolektif_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kolektif_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kolektif_sessions_all" ON public.kolektif_sessions;
DROP POLICY IF EXISTS "kolektif_config_all" ON public.kolektif_config;
DROP POLICY IF EXISTS "kolektif_rows_all" ON public.kolektif_rows;

CREATE POLICY "kolektif_sessions_all" ON public.kolektif_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kolektif_config_all" ON public.kolektif_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kolektif_rows_all" ON public.kolektif_rows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

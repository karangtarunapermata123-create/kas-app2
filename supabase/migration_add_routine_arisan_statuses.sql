-- Migration: Add routine_arisan_entries table
-- Menyimpan daftar penerima arisan per tahun atau per sesi

CREATE TABLE IF NOT EXISTS public.routine_arisan_entries (
  id          text PRIMARY KEY,
  book_id     text NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  scope_type  text NOT NULL CHECK (scope_type IN ('year', 'session')),
  scope_key   text NOT NULL,
  name        text NOT NULL,
  amount      bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_arisan_entries_scope
ON public.routine_arisan_entries(book_id, scope_type, scope_key, created_at);

ALTER TABLE public.routine_arisan_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_arisan_entries_all" ON public.routine_arisan_entries;

CREATE POLICY "routine_arisan_entries_all"
ON public.routine_arisan_entries
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

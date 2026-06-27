-- Migration: Add routine_cash_entries table
-- Menyimpan pemasukan/pengeluaran manual untuk saldo kas pada buku rutinan

CREATE TABLE IF NOT EXISTS public.routine_cash_entries (
  id          text PRIMARY KEY,
  book_id     text NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  date        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('masuk', 'keluar')),
  amount      bigint NOT NULL DEFAULT 0,
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_cash_entries_book_date
ON public.routine_cash_entries(book_id, date DESC, created_at DESC);

ALTER TABLE public.routine_cash_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_cash_entries_all" ON public.routine_cash_entries;

CREATE POLICY "routine_cash_entries_all"
ON public.routine_cash_entries
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

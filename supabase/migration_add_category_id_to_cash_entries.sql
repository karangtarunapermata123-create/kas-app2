-- Migration: Add category_id column to routine_cash_entries
-- Menambahkan kolom category_id agar pemasukan/pengeluaran manual
-- bisa dikaitkan dengan kategori tertentu pada buku kas rutinan

ALTER TABLE public.routine_cash_entries 
ADD COLUMN IF NOT EXISTS category_id text NOT NULL DEFAULT 'kas';

-- Update index to include category_id for better filtering
DROP INDEX IF EXISTS idx_routine_cash_entries_book_date;
CREATE INDEX IF NOT EXISTS idx_routine_cash_entries_book_category_date
ON public.routine_cash_entries(book_id, category_id, date DESC, created_at DESC);

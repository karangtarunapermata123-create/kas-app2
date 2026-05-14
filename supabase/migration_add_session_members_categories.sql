-- Migration: Add members and categories columns to routine_sessions
-- Untuk mendukung anggota dan kategori per sesi pada buku kolektif per sesi

-- Tambah kolom members dan categories (JSON)
alter table public.routine_sessions
  add column if not exists members text,
  add column if not exists categories text;

-- Kolom members dan categories akan menyimpan JSON string
-- members: array of {id: string, name: string}
-- categories: array of {id: string, name: string, amount: number}

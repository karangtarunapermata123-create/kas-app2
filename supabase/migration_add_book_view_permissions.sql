-- Migration: Add book_view_permissions table
-- Super admin can control who can SEE (view) each book card on the dashboard.
-- This is separate from book_permissions (edit access).
--
-- Aturan:
-- - Jika tidak ada row untuk suatu book_id → semua user bisa lihat
-- - Jika ada row dengan user_id = '00000000-0000-0000-0000-000000000000' (sentinel) → hanya super admin
-- - Jika ada row dengan user_id normal → hanya user tersebut (+ super admin) yang bisa lihat
--
-- CATATAN: user_id TIDAK pakai FK ke profiles agar sentinel UUID bisa disimpan.

CREATE TABLE IF NOT EXISTS book_view_permissions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_view_permissions_book_id ON book_view_permissions(book_id);
CREATE INDEX IF NOT EXISTS idx_book_view_permissions_user_id ON book_view_permissions(user_id);

ALTER TABLE book_view_permissions ENABLE ROW LEVEL SECURITY;

-- Super admin bisa manage semua
CREATE POLICY "super_admin can manage book_view_permissions"
  ON book_view_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Semua user authenticated bisa read (untuk cek akses mereka sendiri)
CREATE POLICY "authenticated can read book_view_permissions"
  ON book_view_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix: ubah kolom user_id di book_view_permissions dari UUID dengan FK ke TEXT tanpa FK
-- Jalankan ini jika tabel sudah dibuat sebelumnya dengan FK ke profiles

-- Hapus tabel lama (data akan hilang, tapi ini tabel baru jadi tidak masalah)
DROP TABLE IF EXISTS book_view_permissions;

-- Buat ulang tanpa FK pada user_id
CREATE TABLE book_view_permissions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_view_permissions_book_id ON book_view_permissions(book_id);
CREATE INDEX IF NOT EXISTS idx_book_view_permissions_user_id ON book_view_permissions(user_id);

ALTER TABLE book_view_permissions ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "authenticated can read book_view_permissions"
  ON book_view_permissions
  FOR SELECT
  TO authenticated
  USING (true);

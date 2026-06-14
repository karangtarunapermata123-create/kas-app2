-- Migration: Add book_permissions table for assigning admin access to specific books
-- Super admin can grant individual admins edit access to specific books

CREATE TABLE IF NOT EXISTS book_permissions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_book_permissions_book_id ON book_permissions(book_id);
CREATE INDEX IF NOT EXISTS idx_book_permissions_user_id ON book_permissions(user_id);

-- Enable RLS
ALTER TABLE book_permissions ENABLE ROW LEVEL SECURITY;

-- Policies: super_admin can manage all permissions
CREATE POLICY "super_admin can manage book_permissions"
  ON book_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Anyone authenticated can read permissions for their own books
CREATE POLICY "authenticated can read book_permissions"
  ON book_permissions
  FOR SELECT
  TO authenticated
  USING (true);

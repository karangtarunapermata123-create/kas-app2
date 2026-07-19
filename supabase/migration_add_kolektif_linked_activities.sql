-- Migration: Link absensi (activities) ke buku kolektif
-- Satu activity bisa di-link ke banyak buku kolektif, dan sebaliknya

CREATE TABLE IF NOT EXISTS kolektif_linked_activities (
  id TEXT PRIMARY KEY,
  kolektif_book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  tab_label TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kolektif_book_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_kla_book_id ON kolektif_linked_activities(kolektif_book_id);
CREATE INDEX IF NOT EXISTS idx_kla_activity_id ON kolektif_linked_activities(activity_id);

ALTER TABLE kolektif_linked_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can manage kolektif_linked_activities"
  ON kolektif_linked_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

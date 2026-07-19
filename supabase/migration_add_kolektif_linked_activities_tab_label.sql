-- Tambah kolom tab_label ke kolektif_linked_activities (jika sudah ada tabelnya)
ALTER TABLE kolektif_linked_activities
  ADD COLUMN IF NOT EXISTS tab_label TEXT DEFAULT NULL;

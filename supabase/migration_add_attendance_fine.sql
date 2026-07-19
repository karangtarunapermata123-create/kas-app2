-- Migration: Tambah kolom fine_amount untuk status "denda" di absensi
-- Status "denda" memungkinkan admin memasukkan nominal denda per anggota

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS fine_amount INTEGER DEFAULT NULL;

-- Update CHECK constraint untuk mengizinkan nilai 'denda'
-- Hapus constraint lama lalu buat ulang dengan nilai baru
ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_status_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_status_check
  CHECK (status IN ('hadir', 'izin', 'tidak-hadir', 'denda'));

-- Index untuk lookup denda
CREATE INDEX IF NOT EXISTS idx_attendance_records_fine ON attendance_records(fine_amount)
  WHERE fine_amount IS NOT NULL;

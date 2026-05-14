-- ============================================================
-- MIGRATION: Add QR Token for Attendance
-- Menambahkan kolom qr_token untuk sistem absensi QR code
-- ============================================================

-- Tambah kolom qr_token di tabel activities (untuk kegiatan sekali)
alter table public.activities 
add column if not exists qr_token text unique;

-- Tambah kolom qr_token di tabel activity_sessions (untuk kegiatan rutin)
alter table public.activity_sessions 
add column if not exists qr_token text unique;

-- Tambah kolom members dan categories di routine_sessions (sudah ada tapi pastikan)
alter table public.routine_sessions 
add column if not exists members text,
add column if not exists categories text;

-- Index untuk performa query berdasarkan qr_token
create index if not exists idx_activities_qr_token on public.activities(qr_token);
create index if not exists idx_activity_sessions_qr_token on public.activity_sessions(qr_token);

-- Index untuk performa query attendance
create index if not exists idx_attendance_activity on public.attendance_records(activity_id);
create index if not exists idx_attendance_session on public.attendance_records(session_id);
create index if not exists idx_attendance_member on public.attendance_records(member_name);

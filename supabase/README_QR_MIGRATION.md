# Migration: QR Code Attendance System

## Deskripsi
Migration ini menambahkan fitur absensi menggunakan QR code. Admin dapat membuat QR code untuk setiap kegiatan atau sesi, dan anggota dapat melakukan absensi dengan scan QR code.

## Fitur
- ✅ Admin dapat generate QR code untuk kegiatan/sesi
- ✅ Anggota dapat scan QR code untuk absen otomatis
- ✅ QR code unik untuk setiap kegiatan/sesi
- ✅ Validasi untuk mencegah absen ganda
- ✅ Riwayat absensi tersimpan dengan timestamp

## Cara Menjalankan Migration

### 1. Via Supabase Dashboard
1. Buka Supabase Dashboard project Anda
2. Pergi ke **SQL Editor**
3. Buat query baru
4. Copy-paste isi file `migration_add_qr_token.sql`
5. Klik **Run** untuk menjalankan migration

### 2. Via Supabase CLI (jika sudah setup)
```bash
supabase db push
```

## Perubahan Database

### Tabel `activities`
- Menambah kolom `qr_token` (text, unique) - untuk kegiatan sekali

### Tabel `activity_sessions`
- Menambah kolom `qr_token` (text, unique) - untuk sesi kegiatan rutin

### Index Baru
- `idx_activities_qr_token` - untuk query cepat berdasarkan QR token
- `idx_activity_sessions_qr_token` - untuk query cepat berdasarkan QR token
- `idx_attendance_activity` - untuk query attendance berdasarkan activity
- `idx_attendance_session` - untuk query attendance berdasarkan session
- `idx_attendance_member` - untuk query attendance berdasarkan member

## Cara Menggunakan

### Untuk Admin:
1. Buka halaman Absensi
2. Pilih kegiatan atau sesi yang ingin dibuat QR code
3. Klik tombol **"🔲 Tampilkan QR"**
4. QR code akan muncul dan bisa:
   - Ditampilkan di layar untuk di-scan
   - Di-download sebagai gambar
   - Link-nya di-copy untuk dibagikan

### Untuk Anggota:
1. Buka halaman Absensi
2. Pilih kegiatan atau sesi yang sesuai
3. Klik tombol **"📷 Scan QR"**
4. Arahkan kamera ke QR code yang ditampilkan admin
5. Sistem akan otomatis mencatat kehadiran

## Catatan Penting

### Keamanan
- QR token bersifat unik dan tidak dapat ditebak
- Token disimpan di database dengan constraint unique
- Validasi dilakukan untuk mencegah absen ganda

### Deployment ke Vercel
Sistem QR code ini akan berfungsi dengan baik di Vercel karena:
- ✅ Menggunakan library client-side (`qrcode`, `html5-qrcode`)
- ✅ Tidak memerlukan server-side processing khusus
- ✅ Akses kamera menggunakan Web API standar
- ✅ Data tersimpan di Supabase (bukan local storage)

### Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari (iOS): ✅ Full support (perlu izin kamera)
- Safari (macOS): ✅ Full support (perlu izin kamera)

### Troubleshooting

**Kamera tidak bisa diakses:**
- Pastikan browser memiliki izin akses kamera
- Pastikan menggunakan HTTPS (required untuk camera access)
- Vercel otomatis menyediakan HTTPS

**QR code tidak terbaca:**
- Pastikan QR code tidak blur atau terlalu kecil
- Coba adjust jarak kamera ke QR code
- Pastikan pencahayaan cukup

**Absen ganda:**
- Sistem otomatis mencegah absen ganda
- Jika sudah absen, akan muncul pesan error

## Rollback
Jika perlu rollback migration:

```sql
-- Hapus kolom qr_token
alter table public.activities drop column if exists qr_token;
alter table public.activity_sessions drop column if exists qr_token;

-- Hapus index
drop index if exists idx_activities_qr_token;
drop index if exists idx_activity_sessions_qr_token;
drop index if exists idx_attendance_activity;
drop index if exists idx_attendance_session;
drop index if exists idx_attendance_member;
```

## Testing
Setelah migration, test dengan:
1. ✅ Buat kegiatan baru
2. ✅ Generate QR code
3. ✅ Scan QR code dengan user berbeda
4. ✅ Coba scan ulang (harus ditolak)
5. ✅ Cek data di tabel attendance_records

## Support
Jika ada masalah, cek:
- Console browser untuk error JavaScript
- Supabase logs untuk error database
- Network tab untuk error API calls

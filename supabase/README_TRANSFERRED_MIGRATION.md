# Migration: Add Transferred Flag

## Deskripsi
Migration ini menambahkan kolom `transferred` pada tabel `routine_checklists` untuk mendukung fitur transfer dari buku kolektif ke buku transaksi.

## Perubahan Database

### Tabel: routine_checklists
- **Kolom baru**: `transferred` (BOOLEAN, default: FALSE)
- **Index baru**: `idx_routine_checklists_transferred` untuk optimasi query

## Fitur yang Didukung
1. **Transfer ke Buku Transaksi**: Memungkinkan transfer total nominal dari kategori tertentu pada bulan tertentu ke buku transaksi
2. **Lock Checklist**: Setelah ditransfer, checklist tidak bisa diubah lagi
3. **Visual Indicator**: Menampilkan indikator visual bahwa data sudah ditransfer

## Cara Menjalankan Migration

### Di Supabase Dashboard:
1. Buka SQL Editor di Supabase Dashboard
2. Copy paste isi file `migration_add_transferred_flag.sql`
3. Jalankan query

### Atau via CLI:
```bash
supabase db push
```

## Verifikasi
Setelah migration berhasil, tabel `routine_checklists` akan memiliki:
- Kolom `transferred` dengan tipe BOOLEAN
- Index `idx_routine_checklists_transferred`

Query untuk verifikasi:
```sql
-- Cek struktur tabel
\d routine_checklists

-- Cek index
\di idx_routine_checklists_transferred
```
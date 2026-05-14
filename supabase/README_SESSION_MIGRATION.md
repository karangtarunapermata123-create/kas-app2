# Migration: Anggota dan Kategori Per Sesi

## Deskripsi
Migration ini menambahkan fitur untuk buku kolektif **per sesi** agar setiap sesi bisa memiliki anggota dan kategori sendiri-sendiri.

**Catatan:** Fitur ini hanya berlaku untuk buku kolektif **per sesi** (arisan). Buku kolektif **bulanan** tetap menggunakan anggota dan kategori global.

## Perubahan Database
- Menambahkan kolom `members` (TEXT) ke tabel `routine_sessions`
- Menambahkan kolom `categories` (TEXT) ke tabel `routine_sessions`
- Kedua kolom menyimpan data JSON string

## Cara Menjalankan Migration

1. Buka Supabase Dashboard
2. Masuk ke **SQL Editor**
3. Copy isi file `migration_add_session_members_categories.sql`
4. Paste dan jalankan query

## Struktur Data

### Kolom `members` (JSON)
```json
[
  {"id": "rm_xxx", "name": "Nama Anggota 1"},
  {"id": "rm_yyy", "name": "Nama Anggota 2"}
]
```

### Kolom `categories` (JSON)
```json
[
  {"id": "rc_xxx", "name": "Kas", "amount": 10000},
  {"id": "rc_yyy", "name": "Arisan", "amount": 20000}
]
```

## Cara Menggunakan Fitur

### 1. Buat Buku Kolektif Per Sesi
- Pilih tipe "Buku Kolektif"
- Pilih frekuensi "Per sesi"
- Kelola anggota dan kategori (ini akan menjadi template default)

### 2. Kelola Sesi
- Buka buku kolektif per sesi
- Klik "Kelola sesi"
- Untuk setiap sesi, klik:
  - **Kelola Anggota** - pilih anggota dari daftar user atau tambah manual
  - **Kelola Kategori** - tambah/edit kategori dengan nominal

### 3. Tampilan Data
- Tabel akan menampilkan anggota dan kategori sesuai sesi yang dipilih
- Setiap sesi bisa punya anggota dan kategori yang berbeda
- Total dihitung berdasarkan data sesi yang aktif

## Backward Compatibility
- Sesi yang sudah ada (tanpa members/categories) akan menampilkan data kosong
- Perlu diisi ulang anggota dan kategori per sesi
- Data global (routine_members dan routine_categories) tetap ada untuk buku bulanan

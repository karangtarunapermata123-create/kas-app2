# Migration: Catatan (Notes) System

## 📋 Cara Jalankan Migration

1. Login ke **Supabase Dashboard**: https://app.supabase.com
2. Pilih project Anda
3. Buka **SQL Editor** (sidebar kiri)
4. Copy seluruh isi file `migration_add_notes.sql`
5. Paste ke SQL Editor
6. Klik **Run** atau tekan `Ctrl+Enter`

## 🗂️ Struktur Tabel

### `note_folders`
| Column       | Type   | Description                    |
|--------------|--------|--------------------------------|
| id           | text   | Primary key                    |
| name         | text   | Nama folder                    |
| parent_id    | text   | ID parent folder (nullable)    |
| created_at   | timestamp | Waktu dibuat                |
| updated_at   | timestamp | Waktu diupdate              |

### `notes`
| Column       | Type   | Description                                      |
|--------------|--------|--------------------------------------------------|
| id           | text   | Primary key                                      |
| title        | text   | Judul catatan                                    |
| body         | text   | Isi catatan (paragraf panjang)                   |
| color        | text   | Warna label (white/red/orange/yellow/green/...) |
| pinned       | boolean| Disematkan atau tidak                            |
| folder_id    | text   | ID folder (nullable)                             |
| created_at   | timestamp | Waktu dibuat                                  |
| updated_at   | timestamp | Waktu diupdate                                |

## 🔒 Row Level Security (RLS)

### Permissions:
- **SELECT (Read)**: ✅ Semua user terautentikasi
- **INSERT/UPDATE/DELETE**: ✅ Hanya `admin` dan `super_admin`
- **Member role**: ❌ Read-only (tidak bisa edit/hapus)

## ✅ Verifikasi Migration Berhasil

Jalankan query ini setelah migration:

```sql
-- Cek tabel sudah dibuat
select table_name 
from information_schema.tables 
where table_schema = 'public' 
  and table_name in ('notes', 'note_folders');

-- Cek RLS sudah aktif
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public' 
  and tablename in ('notes', 'note_folders');

-- Cek policies
select tablename, policyname, cmd 
from pg_policies 
where schemaname = 'public' 
  and tablename in ('notes', 'note_folders')
order by tablename, cmd;
```

Harusnya muncul:
- ✅ 2 tabel: `notes`, `note_folders`
- ✅ RLS enabled (rowsecurity = true)
- ✅ 8 policies total (4 per tabel: SELECT/INSERT/UPDATE/DELETE)

## 📦 Migrasi Data dari localStorage (Opsional)

Jika user sudah punya data di localStorage, data akan otomatis termigasi saat pertama kali buka halaman Catatan setelah update code.

Data localStorage disimpan di key:
- `catatan_notes_v3`
- `catatan_folders_v2`

# Database Migration

## Menambahkan Fitur Jumlah Setoran dan Status Tidak Setor

Fitur ini memungkinkan:
1. Anggota untuk melakukan setoran lebih dari 1x dalam satu periode
2. Menandai anggota yang tidak setor dengan icon X merah
3. Menghapus data setoran dari database

### Cara Menjalankan Migration

1. Buka **Supabase Dashboard**
2. Pilih project Anda
3. Buka **SQL Editor** dari menu samping
4. Copy dan paste isi file `migration_add_count.sql`
5. Klik **Run** untuk menjalankan migration

### Apa yang Dilakukan Migration Ini?

Migration ini menambahkan 2 kolom ke tabel `routine_checklists`:
- `count` (integer, default 1): Menyimpan jumlah setoran
- `not_paid` (boolean, default false): Flag untuk menandai tidak setor

### Fitur Baru

Setelah migration berhasil:

#### 1. **Checkbox dengan Status**
- **"-"** (abu-abu) = Belum ada data
- **"1x", "2x", "3x"** (hitam) = Sudah setor dengan jumlah tertentu
- **"X"** (merah) = Tidak setor

#### 2. **Modal Pengaturan**
Klik checkbox akan membuka modal dengan opsi:
- **Tombol + / -**: Mengatur jumlah setoran (minimal 1x)
- **Tombol "Tidak Setor"**: Menandai sebagai tidak setor (tampilkan X merah)
- **Tombol "Hapus"**: Menghapus data dari database (kembali ke status "-")
- **Tombol "Tutup"**: Simpan dan tutup modal

#### 3. **Perhitungan Otomatis**
- Total dihitung dengan rumus: `nominal × jumlah_setoran`
- Data yang ditandai "Tidak Setor" tidak dihitung dalam total
- Semua total ditampilkan dalam format Rupiah

### Contoh Perhitungan:
Jika kategori "Kas" = Rp 10.000:
- Setor **1x** = Rp 10.000
- Setor **2x** = Rp 20.000
- Setor **3x** = Rp 30.000
- **Tidak setor** (X merah) = Rp 0
- **Dihapus** ("-") = Rp 0

### Rollback (Jika Diperlukan)

Jika ingin menghapus kolom yang ditambahkan:

```sql
ALTER TABLE public.routine_checklists DROP COLUMN IF EXISTS count;
ALTER TABLE public.routine_checklists DROP COLUMN IF EXISTS not_paid;
```

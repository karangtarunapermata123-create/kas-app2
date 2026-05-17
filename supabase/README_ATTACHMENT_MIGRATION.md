# Migration: Add Attachment Support to Transactions

## Deskripsi
Migration ini menambahkan kolom `attachment_url` ke tabel `transactions` untuk mendukung fitur upload lampiran (gambar, PDF, dokumen) pada transaksi.

## File Migration
- `migration_add_attachment_url.sql`

## Cara Menjalankan Migration

### 1. Via Supabase Dashboard (SQL Editor)
1. Buka Supabase Dashboard
2. Pilih project Anda
3. Klik menu **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy paste isi file `migration_add_attachment_url.sql`
6. Klik **Run** atau tekan `Ctrl+Enter`

### 2. Via Supabase CLI (jika sudah setup)
```bash
supabase db push
```

## Perubahan yang Dilakukan

### Tabel: `transactions`
- **Kolom baru**: `attachment_url` (TEXT, nullable)
  - Menyimpan URL file lampiran dari Supabase Storage
  - Bucket: `transaction-attachments`
  - Format: `https://[project-ref].supabase.co/storage/v1/object/public/transaction-attachments/[filename]`

### Index
- **Index baru**: `idx_transactions_attachment_url`
  - Mempercepat query untuk transaksi yang memiliki lampiran
  - Partial index (hanya untuk row yang `attachment_url IS NOT NULL`)

## Storage Bucket

Pastikan bucket `transaction-attachments` sudah dibuat di Supabase Storage:

1. Buka Supabase Dashboard
2. Klik menu **Storage** di sidebar kiri
3. Klik **New bucket**
4. Nama bucket: `transaction-attachments`
5. **Public bucket**: ✅ (centang)
6. Klik **Create bucket**

### Storage Policies (RLS)

Jika ingin mengatur akses, tambahkan policies berikut di bucket `transaction-attachments`:

#### Policy: Allow authenticated users to upload
```sql
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-attachments');
```

#### Policy: Allow public read access
```sql
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transaction-attachments');
```

#### Policy: Allow authenticated users to delete their uploads
```sql
CREATE POLICY "Allow authenticated users to delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-attachments');
```

## Rollback (jika diperlukan)

Jika ingin menghapus kolom `attachment_url`:

```sql
-- Remove index
DROP INDEX IF EXISTS idx_transactions_attachment_url;

-- Remove column
ALTER TABLE transactions DROP COLUMN IF EXISTS attachment_url;
```

## Testing

Setelah migration, test dengan:

1. Tambah transaksi baru dengan lampiran
2. Edit transaksi dan ganti lampiran
3. Hapus transaksi dengan lampiran (file di storage juga harus terhapus)
4. Lihat transaksi dengan lampiran di modal info

## Fitur yang Didukung

- ✅ Upload gambar (JPG, PNG, GIF, WebP, BMP)
- ✅ Upload dokumen (PDF, DOC, DOCX, XLS, XLSX)
- ✅ Preview gambar di form dan modal info
- ✅ Maksimal ukuran file: 5MB
- ✅ Auto-delete file saat transaksi dihapus
- ✅ Replace file saat edit transaksi
- ✅ Indikator lampiran di tabel transaksi (icon paperclip)

## Troubleshooting

### Error: column "attachment_url" does not exist
- Jalankan migration SQL di atas

### Error: bucket "transaction-attachments" does not exist
- Buat bucket di Supabase Storage Dashboard

### File tidak bisa diupload
- Cek apakah bucket sudah public
- Cek storage policies (RLS)
- Cek ukuran file (max 5MB)

### File tidak terhapus saat transaksi dihapus
- Cek storage policies untuk DELETE
- Cek console browser untuk error message

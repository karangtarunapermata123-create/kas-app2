# 📝 Panduan Migrasi: Catatan Page → Supabase

## 🎯 Apa yang Berubah?

Halaman **Catatan** sekarang menggunakan **Supabase database** sebagai pengganti localStorage:

### ✅ Fitur yang Tetap Sama:
- ✅ CRUD catatan (buat, baca, edit, hapus)
- ✅ Folder hierarki (nested folders)
- ✅ 9 warna label catatan
- ✅ Pin catatan
- ✅ Search/filter catatan
- ✅ Copy & move catatan antar folder
- ✅ Timestamps (createdAt, updatedAt)

### 🆕 Fitur Baru:
- ✅ **Multi-user access** - Semua user bisa lihat catatan yang sama
- ✅ **Role-based permissions**:
  - **Super Admin & Admin**: Full access (create, edit, delete)
  - **Member**: Read-only
- ✅ **Real-time sync** - Perubahan langsung terlihat di semua device
- ✅ **Auto migration** dari localStorage ke Supabase (one-time)

---

## 📦 File yang Ditambahkan/Diubah

### Baru:
1. `supabase/migration_add_notes.sql` - SQL migration script
2. `supabase/README_NOTES_MIGRATION.md` - Panduan jalankan migration
3. `src/lib/notes.ts` - Notes operations dengan Supabase
4. `CATATAN_MIGRATION_GUIDE.md` - File ini

### Diubah:
1. `src/lib/types.ts` - Tambah type `Note`, `NoteFolder`, `NoteColor`
2. `src/pages/CatatanPage.tsx` - Tulis ulang pakai Supabase

---

## 🚀 Cara Deployment

### Step 1: Jalankan SQL Migration di Supabase

1. Login ke **Supabase Dashboard**: https://app.supabase.com
2. Pilih project Anda
3. Buka **SQL Editor** (sidebar kiri)
4. Copy seluruh isi file `supabase/migration_add_notes.sql`
5. Paste ke SQL Editor
6. Klik **Run** atau tekan `Ctrl+Enter`

### Step 2: Verifikasi Migration Berhasil

Jalankan query ini di SQL Editor:

```sql
-- Cek tabel sudah dibuat
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('notes', 'note_folders');

-- Cek RLS sudah aktif
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('notes', 'note_folders');
```

**Expected result:**
- ✅ 2 tabel: `notes`, `note_folders`
- ✅ RLS enabled (rowsecurity = true)

### Step 3: Deploy Code

```bash
# Push ke repository
git add .
git commit -m "feat: migrate Catatan page to Supabase with role-based access"
git push

# Deploy (otomatis jika pakai Vercel)
# Atau manual: npm run build
```

### Step 4: Test di Production

1. Login sebagai **Admin/Super Admin**
   - ✅ Bisa create/edit/delete notes & folders
   - ✅ Tombol FAB (+) muncul
   - ✅ Menu edit/hapus muncul

2. Login sebagai **Member**
   - ✅ Bisa lihat semua notes & folders
   - ❌ Tidak bisa edit/hapus (read-only)
   - ❌ Tombol FAB tidak muncul
   - ✅ Banner "Read-only" muncul di atas

---

## 🔄 Auto Migration dari localStorage

**Tidak perlu action manual!**

Saat user pertama kali buka halaman Catatan setelah update:
1. System cek apakah ada data di localStorage (`catatan_notes_v3`, `catatan_folders_v2`)
2. Jika ada & Supabase masih kosong → auto migrate
3. Set flag `catatan_migrated_to_supabase` = true
4. Data localStorage tetap ada (tidak dihapus untuk safety)

---

## 🔒 Permission Matrix

| Role         | View Notes | Create | Edit | Delete | Pin |
|--------------|-----------|--------|------|--------|-----|
| Super Admin  | ✅        | ✅     | ✅   | ✅     | ✅  |
| Admin        | ✅        | ✅     | ✅   | ✅     | ✅  |
| Member       | ✅        | ❌     | ❌   | ❌     | ❌  |
| Not Logged In| ❌        | ❌     | ❌   | ❌     | ❌  |

---

## 📊 Database Schema

### Table: `note_folders`
```sql
- id (text, PK)
- name (text)
- parent_id (text, FK → note_folders.id, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Table: `notes`
```sql
- id (text, PK)
- title (text)
- body (text)
- color (text: white|red|orange|yellow|green|teal|blue|indigo|purple)
- pinned (boolean)
- folder_id (text, FK → note_folders.id, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
```

---

## 🐛 Troubleshooting

### Problem: Migration SQL error
**Solution:** Cek apakah tabel `profiles` sudah ada. Notes butuh tabel profiles untuk RLS policies.

### Problem: User bisa edit padahal role = member
**Solution:** 
1. Cek role di tabel `profiles`:
   ```sql
   SELECT id, email, role FROM profiles;
   ```
2. Update role jika salah:
   ```sql
   UPDATE profiles SET role = 'member' WHERE id = 'xxx';
   ```

### Problem: Real-time tidak jalan
**Solution:**
1. Cek Supabase Realtime di Dashboard → Settings → API
2. Pastikan Realtime enabled
3. Restart browser/clear cache

### Problem: Data localStorage tidak ke-migrate
**Solution:**
1. Buka DevTools → Application → LocalStorage
2. Cari key: `catatan_migrated_to_supabase`
3. Hapus key tersebut
4. Refresh halaman (akan auto-migrate lagi)

---

## 📞 Support

Jika ada masalah, cek:
1. Browser Console (F12) untuk error log
2. Supabase Dashboard → Logs → Query untuk SQL error
3. Network tab untuk API request error

---

**Migration by Kiro AI** 🤖

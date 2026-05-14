# Mobile Responsive Table - Update

## Perubahan yang Dilakukan

### 1. Header Rekap Kehadiran
- **Sebelum**: Layout horizontal dengan `flex items-center justify-between`
- **Sesudah**: Layout responsif dengan `flex-col sm:flex-row` dan `gap-3`
- **Hasil**: Di mobile, judul dan tombol "+ Sesi" ditampilkan secara vertikal

### 2. Struktur Tabel
- **Wrapper Baru**: Menggunakan struktur 3-layer untuk scroll horizontal yang optimal
  ```html
  <div class="overflow-x-auto -mx-4 sm:mx-0">
    <div class="inline-block min-w-full align-middle">
      <div class="overflow-hidden">
        <table class="min-w-full">
  ```
- **Manfaat**: 
  - Tabel bisa di-scroll horizontal dengan smooth
  - Di mobile, tabel melebar ke tepi layar (negative margin `-mx-4`)
  - Di desktop (sm+), margin normal kembali

### 3. Kolom Nama (Sticky)
- **Lebar**: `w-32` (128px) di mobile, `w-40` (160px) di desktop
- **Padding**: Konsisten `px-3` untuk semua ukuran layar
- **Sticky**: Tetap di posisi kiri saat scroll horizontal
- **Z-index**: `z-20` untuk header, `z-10` untuk body cells

### 4. Kolom Sesi
- **Lebar**: `w-14` (56px) di mobile, `w-16` (64px) di desktop
- **Padding**: `px-2` untuk semua ukuran layar
- **Tombol Status**: Ukuran konsisten `h-7 w-7` (28px)

### 5. Legend
- **Gap**: `gap-2` di mobile, `gap-3` di desktop
- **Tetap**: Di atas tabel dengan border bawah

## Fitur Mobile
1. ✅ Tabel bisa di-scroll horizontal
2. ✅ Kolom nama tetap terlihat saat scroll (sticky)
3. ✅ Lebar tabel menyesuaikan konten
4. ✅ Tombol "+ Sesi" tidak overlap dengan judul
5. ✅ Padding dan spacing optimal untuk layar kecil

## Testing
- Build berhasil tanpa error
- Siap untuk testing di mobile browser
- Deploy ke Vercel untuk testing di perangkat mobile

## File yang Dimodifikasi
- `src/pages/AbsensiPage.tsx`

## Tanggal
14 Mei 2026

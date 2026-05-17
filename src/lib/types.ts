export type TxType = 'masuk' | 'keluar'

export type BookType = 'biasa' | 'rutin' | 'kolektif'

export type Book = {
  id: string
  name: string
  type: BookType
}

export type KolektifSession = {
  id: string
  bookId: string
  name: string
  sortOrder: number
}

export type KolektifRow = {
  id: string
  label: string
  amount: number
}

export type KolektifConfig = {
  sessionId: string
  headerLabel: string
  rows: KolektifRow[]
}

export type Category = {
  id: string
  name: string
}

export type Transaction = {
  id: string
  date: string // ISO yyyy-mm-dd
  type: TxType
  categoryId: string
  amount: number
  note: string
  masukKeRekening?: boolean
  attachmentUrl?: string // URL lampiran file dari Supabase Storage
}

export type RoutineMember = {
  id: string
  name: string
}

export type RoutineCategory = {
  id: string
  name: string
  amount: number
}

export type RoutineChecklist = {
  periodKey: string // format: yyyy-mm for monthly, arisan-NN for per sesi
  memberId: string
  categoryId: string
  checked: boolean
  date?: string
  count?: number // jumlah setoran (default 1)
  notPaid?: boolean // flag untuk tidak setor (tampilkan X merah)
  transferred?: boolean // flag untuk sudah ditransfer ke buku transaksi
}

export type RoutineSession = {
  id: string
  name: string
  members?: RoutineMember[] // anggota khusus untuk sesi ini (hanya untuk arisan)
  categories?: RoutineCategory[] // kategori khusus untuk sesi ini (hanya untuk arisan)
}

export type RoutineFrequency = 'bulanan' | 'arisan'

export type ActivityType = 'sekali' | 'rutin'
export type ActivityFrequency = 'mingguan' | 'bulanan'

export type Activity = {
  id: string
  name: string
  type: ActivityType
  frequency?: ActivityFrequency // hanya untuk tipe rutin
  date: string // ISO yyyy-mm-dd (tanggal mulai / tanggal kegiatan)
  description?: string
  qrToken?: string // token unik untuk QR code absensi (untuk kegiatan sekali)
  createdAt: string
}

export type ActivitySession = {
  id: string
  activityId: string
  label: string   // misal "Minggu 1 - Januari 2026" atau "Januari 2026"
  date: string    // ISO yyyy-mm-dd
  qrToken?: string // token unik untuk QR code absensi
  createdAt: string
}

export type AttendanceRecord = {
  id: string
  activityId: string
  sessionId?: string  // opsional: untuk kegiatan rutin, terikat ke sesi
  memberName: string
  status: 'hadir' | 'izin' | 'tidak-hadir'
  note?: string
  timestamp: string
}

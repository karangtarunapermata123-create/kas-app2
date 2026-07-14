export type TxType = "masuk" | "keluar";

export type BookType = "biasa" | "rutin" | "kolektif" | "group";

export type Book = {
  id: string;
  name: string;
  type: BookType;
  groupId?: string | null;
  tabLabel?: string | null; // Label tab khusus untuk buku kolektif (opsional, fallback ke name)
};

export type KolektifSession = {
  id: string;
  bookId: string;
  name: string;
  sortOrder: number;
};

export type KolektifRow = {
  id: string;
  label: string;
  amount: number;
  headerValue?: number;
  noteValue?: number;
  note?: string;
};

export type KolektifColumnType = "text" | "number";

export type KolektifConfig = {
  sessionId: string;
  headerLabel: string;
  nominalLabel: string;
  noteLabel: string;
  headerLabelType: KolektifColumnType;
  nominalLabelType: KolektifColumnType;
  noteLabelType: KolektifColumnType;
  rows: KolektifRow[];
};

export type Category = {
  id: string;
  name: string;
};

export type BookPermission = {
  id: string;
  bookId: string;
  userId: string;
};

export type Transaction = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: TxType;
  categoryId: string;
  amount: number;
  note: string;
  masukKeRekening?: boolean;
  attachmentUrl?: string | null; // URL lampiran file dari Supabase Storage
};

export type RoutineMember = {
  id: string;
  name: string;
  profileId?: string; // UUID referensi ke profiles.id (untuk sinkronisasi nama)
  categoryIds?: string[]; // Array of category IDs this member is part of
};

export type RoutineCategory = {
  id: string;
  name: string;
  amount: number;
};

export type RoutineCashEntry = {
  id: string;
  bookId: string;
  categoryId: string; // Added category ID
  date: string;
  type: TxType;
  amount: number;
  note: string;
  createdAt?: string;
};

export type RoutineArisanEntryScope = "year" | "session";

export type RoutineArisanEntry = {
  id: string;
  bookId: string;
  scopeType: RoutineArisanEntryScope;
  scopeKey: string;
  name: string;
  amount: number;
  createdAt?: string;
};

export type RoutineChecklist = {
  periodKey: string; // format: yyyy-mm for monthly, arisan-NN for per sesi
  memberId: string;
  categoryId: string;
  checked: boolean;
  date?: string;
  count?: number; // jumlah setoran (default 1)
  notPaid?: boolean; // flag untuk tidak setor (tampilkan X merah)
  transferred?: boolean; // flag untuk sudah ditransfer ke buku transaksi
};

export type RoutineSession = {
  id: string;
  name: string;
  members?: RoutineMember[]; // anggota khusus untuk sesi ini (hanya untuk arisan)
  categories?: RoutineCategory[]; // kategori khusus untuk sesi ini (hanya untuk arisan)
  columnCount?: number; // jumlah kolom tabel arisan (custom oleh user)
  columnLabels?: string[]; // label header tiap kolom arisan (misal tanggal)
};

export type RoutineFrequency = "bulanan" | "arisan";

export type ActivityType = "sekali" | "rutin";
export type ActivityFrequency = "mingguan" | "bulanan";

export type Activity = {
  id: string;
  name: string;
  type: ActivityType;
  frequency?: ActivityFrequency; // hanya untuk tipe rutin
  date: string; // ISO yyyy-mm-dd (tanggal mulai / tanggal kegiatan)
  description?: string;
  qrToken?: string; // token unik untuk QR code absensi (untuk kegiatan sekali)
  createdAt: string;
};

export type ActivitySession = {
  id: string;
  activityId: string;
  label: string; // misal "Minggu 1 - Januari 2026" atau "Januari 2026"
  date: string; // ISO yyyy-mm-dd
  qrToken?: string; // token unik untuk QR code absensi
  createdAt: string;
};

export type AttendanceRecord = {
  id: string;
  activityId: string;
  sessionId?: string; // opsional: untuk kegiatan rutin, terikat ke sesi
  memberName: string;
  status: "hadir" | "izin" | "tidak-hadir";
  note?: string;
  timestamp: string;
};

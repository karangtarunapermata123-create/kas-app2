import { supabase } from './supabase'
import type {
  Book,
  Category,
  Transaction,
  TxType,
  RoutineMember,
  RoutineCategory,
  RoutineChecklist,
  RoutineFrequency,
  RoutineSession,
  Activity,
  ActivitySession,
  AttendanceRecord,
} from './types'
import { uid } from './id'

export const TRANSACTIONS_CHANGED_EVENT = 'kas:transactions:changed'

// ─── Organization Name ────────────────────────────────────────────────────────
// Tetap pakai localStorage karena ini hanya setting lokal UI
export function getOrganizationName(): string {
  return localStorage.getItem('kas_pemuda_organization_name_v1') ?? 'Kas Pemuda'
}

export function saveOrganizationName(name: string): void {
  localStorage.setItem('kas_pemuda_organization_name_v1', name.trim() || 'Kas Pemuda')
  window.dispatchEvent(new StorageEvent('storage', { key: 'kas_pemuda_organization_name_v1' }))
}

// ─── Books ────────────────────────────────────────────────────────────────────

export async function getBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((b) => ({ id: b.id, name: b.name, type: b.type as Book['type'] }))
}

export async function saveBooks(books: Book[]): Promise<void> {
  // Upsert semua books
  const rows = books.map((b) => ({ id: b.id, name: b.name, type: b.type }))
  const { error } = await supabase.from('books').upsert(rows)
  if (error) throw error
}

export async function addBook(name: string, type: 'biasa' | 'rutin' = 'biasa'): Promise<Book> {
  const b: Book = { id: uid('book'), name: name.trim(), type }
  const { error } = await supabase.from('books').insert({ id: b.id, name: b.name, type: b.type })
  if (error) throw error
  return b
}

export async function renameBook(bookId: string, name: string): Promise<void> {
  const { error } = await supabase.from('books').update({ name: name.trim() }).eq('id', bookId)
  if (error) throw error
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', bookId)
  if (error) throw error
}

// ─── Routine Members ──────────────────────────────────────────────────────────

export async function getRoutineMembers(bookId: string): Promise<RoutineMember[]> {
  const { data, error } = await supabase
    .from('routine_members')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((m) => ({ id: m.id, name: m.name }))
}

export async function saveRoutineMembers(bookId: string, members: RoutineMember[]): Promise<void> {
  // Hapus semua lalu insert ulang
  await supabase.from('routine_members').delete().eq('book_id', bookId)
  if (members.length === 0) return
  const rows = members.map((m) => ({ id: m.id, book_id: bookId, name: m.name }))
  const { error } = await supabase.from('routine_members').insert(rows)
  if (error) throw error
}

export async function addRoutineMember(bookId: string, name: string): Promise<RoutineMember> {
  const m: RoutineMember = { id: uid('rm'), name: name.trim() }
  const { error } = await supabase.from('routine_members').insert({ id: m.id, book_id: bookId, name: m.name })
  if (error) throw error
  return m
}

export async function deleteRoutineMember(bookId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('routine_members').delete().eq('id', memberId).eq('book_id', bookId)
  if (error) throw error
  // Hapus checklists terkait
  await supabase.from('routine_checklists').delete().eq('book_id', bookId).eq('member_id', memberId)
}

export async function renameRoutineMember(bookId: string, memberId: string, name: string): Promise<void> {
  const { error } = await supabase.from('routine_members').update({ name: name.trim() }).eq('id', memberId).eq('book_id', bookId)
  if (error) throw error
}

// ─── Routine Categories ───────────────────────────────────────────────────────

export async function getRoutineCategories(bookId: string): Promise<RoutineCategory[]> {
  const { data, error } = await supabase
    .from('routine_categories')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data || data.length === 0) {
    return [
      { id: 'kas', name: 'Kas', amount: 10000 },
      { id: 'arisan', name: 'Arisan', amount: 20000 },
    ]
  }
  return data.map((c) => ({ id: c.id, name: c.name, amount: c.amount }))
}

export async function saveRoutineCategories(bookId: string, categories: RoutineCategory[]): Promise<void> {
  await supabase.from('routine_categories').delete().eq('book_id', bookId)
  if (categories.length === 0) return
  const rows = categories.map((c) => ({ id: c.id, book_id: bookId, name: c.name, amount: c.amount }))
  const { error } = await supabase.from('routine_categories').insert(rows)
  if (error) throw error
}

export async function addRoutineCategory(bookId: string, name: string, amount: number): Promise<RoutineCategory> {
  const c: RoutineCategory = { id: uid('rc'), name: name.trim(), amount }
  const { error } = await supabase.from('routine_categories').insert({ id: c.id, book_id: bookId, name: c.name, amount: c.amount })
  if (error) throw error
  return c
}

export async function deleteRoutineCategory(bookId: string, categoryId: string): Promise<void> {
  const { error } = await supabase.from('routine_categories').delete().eq('id', categoryId).eq('book_id', bookId)
  if (error) throw error
  await supabase.from('routine_checklists').delete().eq('book_id', bookId).eq('category_id', categoryId)
}

export async function updateRoutineCategory(bookId: string, categoryId: string, name: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from('routine_categories')
    .update({ name: name.trim(), amount })
    .eq('id', categoryId)
    .eq('book_id', bookId)
  if (error) throw error
}

// ─── Routine Checklists ───────────────────────────────────────────────────────

export async function getRoutineChecklists(bookId: string): Promise<RoutineChecklist[]> {
  const { data, error } = await supabase
    .from('routine_checklists')
    .select('*')
    .eq('book_id', bookId)
  if (error) throw error
  return (data ?? []).map((c) => ({
    periodKey: c.period_key,
    memberId: c.member_id,
    categoryId: c.category_id,
    checked: c.checked,
    date: c.date ?? undefined,
    count: c.count ?? 1,
    notPaid: c.not_paid ?? false,
  }))
}

export async function saveRoutineChecklists(bookId: string, checklists: RoutineChecklist[]): Promise<void> {
  await supabase.from('routine_checklists').delete().eq('book_id', bookId)
  if (checklists.length === 0) return
  const rows = checklists.map((c) => ({
    book_id: bookId,
    period_key: c.periodKey,
    member_id: c.memberId,
    category_id: c.categoryId,
    checked: c.checked,
    date: c.date ?? null,
    count: c.count ?? 1,
    not_paid: c.notPaid ?? false,
  }))
  const { error } = await supabase.from('routine_checklists').insert(rows)
  if (error) throw error
}

export async function toggleRoutineChecklist(
  bookId: string,
  periodKey: string,
  memberId: string,
  categoryId: string,
  checked: boolean,
  date?: string,
  count?: number,
  notPaid?: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('routine_checklists')
    .upsert(
      { 
        book_id: bookId, 
        period_key: periodKey, 
        member_id: memberId, 
        category_id: categoryId, 
        checked, 
        date: date ?? null,
        count: count ?? 1,
        not_paid: notPaid ?? false,
      },
      { onConflict: 'book_id,period_key,member_id,category_id' },
    )
  if (error) throw error
}

export async function deleteRoutineChecklist(
  bookId: string,
  periodKey: string,
  memberId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await supabase
    .from('routine_checklists')
    .delete()
    .eq('book_id', bookId)
    .eq('period_key', periodKey)
    .eq('member_id', memberId)
    .eq('category_id', categoryId)
  if (error) throw error
}

// ─── Routine Frequency ────────────────────────────────────────────────────────

export async function getRoutineFrequency(bookId: string): Promise<RoutineFrequency> {
  const { data, error } = await supabase
    .from('routine_frequency')
    .select('frequency')
    .eq('book_id', bookId)
    .single()
  if (error || !data) return 'bulanan'
  const f = data.frequency
  return f === 'bulanan' || f === 'arisan' ? f : 'bulanan'
}

export async function saveRoutineFrequency(bookId: string, frequency: RoutineFrequency): Promise<void> {
  const { error } = await supabase
    .from('routine_frequency')
    .upsert({ book_id: bookId, frequency }, { onConflict: 'book_id' })
  if (error) throw error
}

// ─── Routine Sessions ─────────────────────────────────────────────────────────

export async function getRoutineSessions(bookId: string): Promise<RoutineSession[]> {
  const { data, error } = await supabase
    .from('routine_sessions')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((s) => {
    try {
      return {
        id: s.id,
        name: s.name,
        members: s.members ? JSON.parse(s.members) : undefined,
        categories: s.categories ? JSON.parse(s.categories) : undefined,
      }
    } catch (e) {
      console.error('Error parsing session data:', e)
      return {
        id: s.id,
        name: s.name,
        members: undefined,
        categories: undefined,
      }
    }
  })
}

export async function saveRoutineSessions(bookId: string, sessions: RoutineSession[]): Promise<void> {
  await supabase.from('routine_sessions').delete().eq('book_id', bookId)
  if (sessions.length === 0) return
  const rows = sessions.map((s) => ({
    id: s.id,
    book_id: bookId,
    name: s.name,
    members: s.members ? JSON.stringify(s.members) : null,
    categories: s.categories ? JSON.stringify(s.categories) : null,
  }))
  const { error } = await supabase.from('routine_sessions').insert(rows)
  if (error) throw error
}

export async function addRoutineSession(bookId: string, name: string, members?: RoutineMember[], categories?: RoutineCategory[]): Promise<RoutineSession> {
  const sessions = await getRoutineSessions(bookId)
  const session: RoutineSession = {
    id: uid('ses'),
    name: name.trim() || `Sesi ${sessions.length + 1}`,
    members,
    categories,
  }
  const { error } = await supabase.from('routine_sessions').insert({
    id: session.id,
    book_id: bookId,
    name: session.name,
    members: members ? JSON.stringify(members) : null,
    categories: categories ? JSON.stringify(categories) : null,
  })
  if (error) throw error
  return session
}

export async function renameRoutineSession(bookId: string, sessionId: string, name: string): Promise<void> {
  const { error } = await supabase.from('routine_sessions').update({ name: name.trim() }).eq('id', sessionId).eq('book_id', bookId)
  if (error) throw error
}

export async function updateRoutineSession(bookId: string, sessionId: string, updates: { name?: string; members?: RoutineMember[]; categories?: RoutineCategory[] }): Promise<void> {
  const updateData: any = {}
  if (updates.name !== undefined) updateData.name = updates.name.trim()
  if (updates.members !== undefined) updateData.members = JSON.stringify(updates.members)
  if (updates.categories !== undefined) updateData.categories = JSON.stringify(updates.categories)
  
  const { error } = await supabase.from('routine_sessions').update(updateData).eq('id', sessionId).eq('book_id', bookId)
  if (error) throw error
}

export async function deleteRoutineSession(bookId: string, sessionId: string): Promise<void> {
  const { error } = await supabase.from('routine_sessions').delete().eq('id', sessionId).eq('book_id', bookId)
  if (error) throw error
  // Hapus checklists yang period_key mengandung sessionId
  const checklists = await getRoutineChecklists(bookId)
  const toKeep = checklists.filter((c) => !c.periodKey.startsWith(sessionId))
  await saveRoutineChecklists(bookId, toKeep)
}

// ─── Categories ───────────────────────────────────────────────────────────────

const defaultCategories: Category[] = [
  { id: 'iuran', name: 'Iuran' },
  { id: 'donasi', name: 'Donasi' },
  { id: 'kegiatan', name: 'Kegiatan' },
  { id: 'konsumsi', name: 'Konsumsi' },
]

export async function getCategories(bookId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!data || data.length === 0) {
    // Seed default categories
    await saveCategories(bookId, defaultCategories)
    return defaultCategories
  }
  return data.map((c) => ({ id: c.id, name: c.name }))
}

export async function saveCategories(bookId: string, categories: Category[]): Promise<void> {
  await supabase.from('categories').delete().eq('book_id', bookId)
  if (categories.length === 0) return
  const rows = categories.map((c) => ({ id: c.id, book_id: bookId, name: c.name }))
  const { error } = await supabase.from('categories').insert(rows)
  if (error) throw error
}

export async function addCategory(bookId: string, name: string): Promise<Category> {
  const c: Category = { id: uid('cat'), name: name.trim() }
  const { error } = await supabase.from('categories').insert({ id: c.id, book_id: bookId, name: c.name })
  if (error) throw error
  return c
}

export async function deleteCategory(bookId: string, categoryId: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId).eq('book_id', bookId)
  if (error) throw error
  // Pindahkan transaksi ke 'lainnya'
  await supabase
    .from('transactions')
    .update({ category_id: 'lainnya' })
    .eq('book_id', bookId)
    .eq('category_id', categoryId)
}

export async function ensureMiscCategory(bookId: string): Promise<void> {
  const { data } = await supabase.from('categories').select('id').eq('book_id', bookId).eq('id', 'lainnya').single()
  if (!data) {
    await supabase.from('categories').insert({ id: 'lainnya', book_id: bookId, name: 'Lainnya' })
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(bookId: string): Promise<Transaction[]> {
  await ensureMiscCategory(bookId)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('book_id', bookId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type as TxType,
    categoryId: t.category_id,
    amount: t.amount,
    note: t.note,
    masukKeRekening: Boolean(t.masuk_ke_rekening),
  }))
}

export async function saveTransactions(bookId: string, transactions: Transaction[]): Promise<void> {
  await supabase.from('transactions').delete().eq('book_id', bookId)
  if (transactions.length === 0) {
    window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }))
    return
  }
  const rows = transactions.map((t) => ({
    id: t.id,
    book_id: bookId,
    date: t.date,
    type: t.type,
    category_id: t.categoryId,
    amount: t.amount,
    note: t.note,
    masuk_ke_rekening: Boolean(t.masukKeRekening),
  }))
  const { error } = await supabase.from('transactions').insert(rows)
  if (error) throw error
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }))
}

export async function addTransaction(
  bookId: string,
  input: {
    date: string
    type: TxType
    categoryId: string
    amount: number
    note: string
    masukKeRekening?: boolean
  },
): Promise<Transaction> {
  const t: Transaction = {
    id: uid('tx'),
    date: input.date,
    type: input.type,
    categoryId: input.categoryId,
    amount: input.amount,
    note: input.note,
    masukKeRekening: Boolean(input.masukKeRekening),
  }
  const { error } = await supabase.from('transactions').insert({
    id: t.id,
    book_id: bookId,
    date: t.date,
    type: t.type,
    category_id: t.categoryId,
    amount: t.amount,
    note: t.note,
    masuk_ke_rekening: t.masukKeRekening,
  })
  if (error) throw error
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }))
  return t
}

export async function updateTransaction(bookId: string, id: string, patch: Partial<Transaction>): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.date !== undefined) update.date = patch.date
  if (patch.type !== undefined) update.type = patch.type
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId
  if (patch.amount !== undefined) update.amount = patch.amount
  if (patch.note !== undefined) update.note = patch.note
  if (patch.masukKeRekening !== undefined) update.masuk_ke_rekening = patch.masukKeRekening
  const { error } = await supabase.from('transactions').update(update).eq('id', id).eq('book_id', bookId)
  if (error) throw error
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }))
}

export async function deleteTransaction(bookId: string, id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('book_id', bookId)
  if (error) throw error
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }))
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as Activity['type'],
    frequency: a.frequency as Activity['frequency'],
    date: a.date,
    description: a.description ?? undefined,
    qrToken: a.qr_token ?? undefined,
    createdAt: a.created_at,
  }))
}

export async function saveActivities(activities: Activity[]): Promise<void> {
  // Tidak dipakai langsung, gunakan add/update/delete
  for (const a of activities) {
    await supabase.from('activities').upsert({
      id: a.id,
      name: a.name,
      type: a.type,
      frequency: a.frequency ?? null,
      date: a.date,
      description: a.description ?? null,
      created_at: a.createdAt,
    })
  }
}

export async function addActivity(input: {
  name: string
  type: 'sekali' | 'rutin'
  frequency?: 'mingguan' | 'bulanan'
  date: string
  description?: string
}): Promise<Activity> {
  const activity: Activity = {
    id: uid('act'),
    name: input.name.trim(),
    type: input.type,
    frequency: input.type === 'rutin' ? (input.frequency ?? 'mingguan') : undefined,
    date: input.date,
    description: input.description?.trim(),
    createdAt: new Date().toISOString(),
  }
  const { error } = await supabase.from('activities').insert({
    id: activity.id,
    name: activity.name,
    type: activity.type,
    frequency: activity.frequency ?? null,
    date: activity.date,
    description: activity.description ?? null,
    created_at: activity.createdAt,
  })
  if (error) throw error
  return activity
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.type !== undefined) update.type = patch.type
  if (patch.frequency !== undefined) update.frequency = patch.frequency
  if (patch.date !== undefined) update.date = patch.date
  if (patch.description !== undefined) update.description = patch.description
  const { error } = await supabase.from('activities').update(update).eq('id', id)
  if (error) throw error
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw error
}

// ─── Activity Sessions ────────────────────────────────────────────────────────

export async function getActivitySessions(): Promise<ActivitySession[]> {
  const { data, error } = await supabase
    .from('activity_sessions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    activityId: s.activity_id,
    label: s.label,
    date: s.date,
    createdAt: s.created_at,
  }))
}

export async function saveActivitySessions(sessions: ActivitySession[]): Promise<void> {
  for (const s of sessions) {
    await supabase.from('activity_sessions').upsert({
      id: s.id,
      activity_id: s.activityId,
      label: s.label,
      date: s.date,
      created_at: s.createdAt,
    })
  }
}

export async function getSessionsByActivity(activityId: string): Promise<ActivitySession[]> {
  const { data, error } = await supabase
    .from('activity_sessions')
    .select('*')
    .eq('activity_id', activityId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    activityId: s.activity_id,
    label: s.label,
    date: s.date,
    qrToken: s.qr_token ?? undefined,
    createdAt: s.created_at,
  }))
}

export async function addActivitySession(input: {
  activityId: string
  label: string
  date: string
}): Promise<ActivitySession> {
  const session: ActivitySession = {
    id: uid('ses'),
    activityId: input.activityId,
    label: input.label.trim(),
    date: input.date,
    createdAt: new Date().toISOString(),
  }
  const { error } = await supabase.from('activity_sessions').insert({
    id: session.id,
    activity_id: session.activityId,
    label: session.label,
    date: session.date,
    created_at: session.createdAt,
  })
  if (error) throw error
  return session
}

export async function deleteActivitySession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('activity_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

// ─── Attendance Records ───────────────────────────────────────────────────────

export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .order('timestamp', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    sessionId: r.session_id ?? undefined,
    memberName: r.member_name,
    status: r.status as AttendanceRecord['status'],
    note: r.note ?? undefined,
    timestamp: r.timestamp,
  }))
}

export async function saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
  for (const r of records) {
    await supabase.from('attendance_records').upsert({
      id: r.id,
      activity_id: r.activityId,
      session_id: r.sessionId ?? null,
      member_name: r.memberName,
      status: r.status,
      note: r.note ?? null,
      timestamp: r.timestamp,
    })
  }
}

export async function addAttendanceRecord(input: {
  activityId: string
  sessionId?: string
  memberName: string
  status: 'hadir' | 'izin' | 'tidak-hadir'
  note?: string
}): Promise<AttendanceRecord> {
  const record: AttendanceRecord = {
    id: uid('att'),
    activityId: input.activityId,
    sessionId: input.sessionId,
    memberName: input.memberName.trim(),
    status: input.status,
    note: input.note?.trim(),
    timestamp: new Date().toISOString(),
  }
  const { error } = await supabase.from('attendance_records').insert({
    id: record.id,
    activity_id: record.activityId,
    session_id: record.sessionId ?? null,
    member_name: record.memberName,
    status: record.status,
    note: record.note ?? null,
    timestamp: record.timestamp,
  })
  if (error) throw error
  return record
}

export async function updateAttendanceRecord(id: string, patch: Partial<AttendanceRecord>): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.status !== undefined) update.status = patch.status
  if (patch.note !== undefined) update.note = patch.note
  if (patch.memberName !== undefined) update.member_name = patch.memberName
  const { error } = await supabase.from('attendance_records').update(update).eq('id', id)
  if (error) throw error
}

export async function deleteAttendanceRecord(id: string): Promise<void> {
  const { error } = await supabase.from('attendance_records').delete().eq('id', id)
  if (error) throw error
}

export async function getAttendanceByActivity(activityId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('activity_id', activityId)
    .is('session_id', null)
    .order('timestamp', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    sessionId: undefined,
    memberName: r.member_name,
    status: r.status as AttendanceRecord['status'],
    note: r.note ?? undefined,
    timestamp: r.timestamp,
  }))
}

export async function getAttendanceBySession(sessionId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    sessionId: r.session_id ?? undefined,
    memberName: r.member_name,
    status: r.status as AttendanceRecord['status'],
    note: r.note ?? undefined,
    timestamp: r.timestamp,
  }))
}

// ─── QR Code Attendance ───────────────────────────────────────────────────────

// Generate QR token untuk activity atau session
function generateQRToken(): string {
  return uid('qr') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9)
}

// Generate atau ambil QR token untuk activity (kegiatan sekali)
export async function getOrGenerateActivityQRToken(activityId: string): Promise<string> {
  const { data, error } = await supabase
    .from('activities')
    .select('qr_token')
    .eq('id', activityId)
    .single()
  
  if (error) throw error
  
  if (data.qr_token) {
    return data.qr_token
  }
  
  // Generate token baru
  const token = generateQRToken()
  const { error: updateError } = await supabase
    .from('activities')
    .update({ qr_token: token })
    .eq('id', activityId)
  
  if (updateError) throw updateError
  return token
}

// Generate atau ambil QR token untuk session (kegiatan rutin)
export async function getOrGenerateSessionQRToken(sessionId: string): Promise<string> {
  const { data, error } = await supabase
    .from('activity_sessions')
    .select('qr_token')
    .eq('id', sessionId)
    .single()
  
  if (error) throw error
  
  if (data.qr_token) {
    return data.qr_token
  }
  
  // Generate token baru
  const token = generateQRToken()
  const { error: updateError } = await supabase
    .from('activity_sessions')
    .update({ qr_token: token })
    .eq('id', sessionId)
  
  if (updateError) throw updateError
  return token
}

// Validasi QR token dan return activity/session info
export async function validateQRToken(token: string): Promise<{
  type: 'activity' | 'session'
  activityId: string
  sessionId?: string
  activityName: string
  sessionLabel?: string
} | null> {
  // Cek di activities dulu
  const { data: activityData } = await supabase
    .from('activities')
    .select('id, name, type')
    .eq('qr_token', token)
    .single()
  
  if (activityData) {
    return {
      type: 'activity',
      activityId: activityData.id,
      activityName: activityData.name,
    }
  }
  
  // Cek di sessions
  const { data: sessionData } = await supabase
    .from('activity_sessions')
    .select('id, activity_id, label, activities(name)')
    .eq('qr_token', token)
    .single()
  
  if (sessionData) {
    return {
      type: 'session',
      activityId: sessionData.activity_id,
      sessionId: sessionData.id,
      activityName: (sessionData.activities as any)?.name ?? 'Unknown',
      sessionLabel: sessionData.label,
    }
  }
  
  return null
}

// Absen via QR code
export async function attendViaQR(token: string, memberName: string): Promise<{
  success: boolean
  message: string
  record?: AttendanceRecord
}> {
  const validation = await validateQRToken(token)
  
  if (!validation) {
    return {
      success: false,
      message: 'QR code tidak valid atau sudah kadaluarsa',
    }
  }
  
  // Cek apakah sudah absen
  const { data: existingRecords } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('activity_id', validation.activityId)
    .eq('member_name', memberName)
  
  if (validation.sessionId) {
    const existing = existingRecords?.find(r => r.session_id === validation.sessionId)
    if (existing) {
      return {
        success: false,
        message: 'Anda sudah melakukan absensi untuk sesi ini',
      }
    }
  } else {
    if (existingRecords && existingRecords.length > 0) {
      return {
        success: false,
        message: 'Anda sudah melakukan absensi untuk kegiatan ini',
      }
    }
  }
  
  // Buat record absensi
  const record = await addAttendanceRecord({
    activityId: validation.activityId,
    sessionId: validation.sessionId,
    memberName,
    status: 'hadir',
    note: 'Absen via QR code',
  })
  
  return {
    success: true,
    message: `Berhasil absen untuk ${validation.activityName}${validation.sessionLabel ? ` - ${validation.sessionLabel}` : ''}`,
    record,
  }
}

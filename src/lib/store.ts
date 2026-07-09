import { supabase } from "./supabase";
import type {
  Book,
  BookPermission,
  Category,
  Transaction,
  TxType,
  RoutineMember,
  RoutineCategory,
  RoutineCashEntry,
  RoutineArisanEntry,
  RoutineArisanEntryScope,
  RoutineChecklist,
  RoutineFrequency,
  RoutineSession,
  KolektifConfig,
  KolektifColumnType,
  KolektifRow,
  KolektifSession,
  Activity,
  ActivitySession,
  AttendanceRecord,
} from "./types";
import { uid } from "./id";

export const TRANSACTIONS_CHANGED_EVENT = "kas:transactions:changed";
export const ATTENDANCE_CHANGED_EVENT = "absensi:attendance_changed";
export const SESSIONS_CHANGED_EVENT = "absensi:sessions_changed";
export const ACTIVITIES_CHANGED_EVENT = "absensi:activities_changed";
export const ROUTINE_CHANGED_EVENT = "kas:routine:changed";

export function dispatchAttendanceChanged() {
  window.dispatchEvent(new CustomEvent(ATTENDANCE_CHANGED_EVENT));
}

export function dispatchSessionsChanged(activityId: string) {
  window.dispatchEvent(
    new CustomEvent(SESSIONS_CHANGED_EVENT, { detail: { activityId } }),
  );
}

export function dispatchActivitiesChanged() {
  window.dispatchEvent(new CustomEvent(ACTIVITIES_CHANGED_EVENT));
}

export function dispatchRoutineChanged(bookId: string) {
  window.dispatchEvent(
    new CustomEvent(ROUTINE_CHANGED_EVENT, { detail: { bookId } }),
  );
}

// ─── Kolektif Book ────────────────────────────────────────────────────────────

export async function getKolektifSessions(
  bookId: string,
): Promise<KolektifSession[]> {
  const { data, error } = await supabase
    .from("kolektif_sessions")
    .select("*")
    .eq("book_id", bookId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    bookId: s.book_id,
    name: s.name,
    sortOrder: s.sort_order,
  }));
}

export async function addKolektifSession(
  bookId: string,
  name: string,
): Promise<KolektifSession> {
  const sessions = await getKolektifSessions(bookId);
  const nextOrder =
    sessions.length > 0 ? Math.max(...sessions.map((s) => s.sortOrder)) + 1 : 0;
  const session: KolektifSession = {
    id: uid("ks"),
    bookId,
    name: name.trim(),
    sortOrder: nextOrder,
  };
  const { error } = await supabase.from("kolektif_sessions").insert({
    id: session.id,
    book_id: bookId,
    name: session.name,
    sort_order: nextOrder,
  });
  if (error) throw error;
  return session;
}

export async function renameKolektifSession(
  sessionId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("kolektif_sessions")
    .update({ name: name.trim() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function deleteKolektifSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("kolektif_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

export async function getKolektifConfig(
  sessionId: string,
): Promise<KolektifConfig> {
  const [configRes, rowsRes] = await Promise.all([
    supabase
      .from("kolektif_config")
      .select("*")
      .eq("session_id", sessionId)
      .single(),
    supabase
      .from("kolektif_rows")
      .select("*")
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  const headerLabel = configRes.data?.header_label ?? "Nama";
  const nominalLabel = configRes.data?.nominal_label ?? "Nominal";
  const noteLabel = configRes.data?.note_label ?? "Keterangan";
  
  // Try to get column types, default to text/number/text if not available
  let headerLabelType: KolektifColumnType = "text";
  let nominalLabelType: KolektifColumnType = "number";
  let noteLabelType: KolektifColumnType = "text";
  
  if (configRes.data) {
    const data = configRes.data as any;
    if (data.header_column_type !== undefined) headerLabelType = data.header_column_type;
    if (data.nominal_column_type !== undefined) nominalLabelType = data.nominal_column_type;
    if (data.note_column_type !== undefined) noteLabelType = data.note_column_type;
  }
  
  const rows: KolektifRow[] = (rowsRes.data ?? []).map((r) => {
    const rowData = r as any;
    return {
      id: r.id,
      label: r.label,
      amount: r.amount,
      headerValue: rowData.header_value ?? undefined,
      noteValue: rowData.note_value ?? undefined,
      note: r.note ?? undefined,
    };
  });
  
  return { 
    sessionId, 
    headerLabel, 
    nominalLabel, 
    noteLabel, 
    headerLabelType,
    nominalLabelType,
    noteLabelType,
    rows 
  };
}

export async function updateKolektifLabels(
  sessionId: string,
  labels: {
    headerLabel?: string;
    nominalLabel?: string;
    noteLabel?: string;
    headerLabelType?: KolektifColumnType;
    nominalLabelType?: KolektifColumnType;
    noteLabelType?: KolektifColumnType;
  },
): Promise<void> {
  const update: Record<string, string> = {};
  if (labels.headerLabel !== undefined)
    update.header_label = labels.headerLabel.trim() || "Nama";
  if (labels.nominalLabel !== undefined)
    update.nominal_label = labels.nominalLabel.trim() || "Nominal";
  if (labels.noteLabel !== undefined)
    update.note_label = labels.noteLabel.trim() || "Keterangan";
  if (labels.headerLabelType !== undefined)
    update.header_column_type = labels.headerLabelType;
  if (labels.nominalLabelType !== undefined)
    update.nominal_column_type = labels.nominalLabelType;
  if (labels.noteLabelType !== undefined)
    update.note_column_type = labels.noteLabelType;
  
  const { error } = await supabase.from("kolektif_config").upsert({
    session_id: sessionId,
    ...update,
  });
  
  // If error is about missing columns (migration not run), try without column types
  if (error) {
    const errMsg = (error as any)?.message ?? "";
    if (errMsg.includes("column") || errMsg.includes("does not exist")) {
      const basicUpdate: Record<string, string> = {};
      if (labels.headerLabel !== undefined)
        basicUpdate.header_label = labels.headerLabel.trim() || "Nama";
      if (labels.nominalLabel !== undefined)
        basicUpdate.nominal_label = labels.nominalLabel.trim() || "Nominal";
      if (labels.noteLabel !== undefined)
        basicUpdate.note_label = labels.noteLabel.trim() || "Keterangan";
      
      const { error: basicError } = await supabase.from("kolektif_config").upsert({
        session_id: sessionId,
        ...basicUpdate,
      });
      if (basicError) throw basicError;
    } else {
      throw error;
    }
  }
}

export async function addKolektifRow(
  sessionId: string,
  bookId: string,
  label: string,
  amount: number,
  note?: string,
  headerValue?: number,
  noteValue?: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from("kolektif_rows")
    .select("sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;
  
  // Build basic row data (always works)
  const rowData: any = {
    id: uid("kr"),
    session_id: sessionId,
    book_id: bookId,
    label: label.trim(),
    amount,
    note: note ?? null,
    sort_order: nextOrder,
  };
  
  // Try to insert with basic data first
  const { error: basicError } = await supabase.from("kolektif_rows").insert(rowData);
  if (basicError) throw basicError;
  
  // If we have numeric values, try to update them (will work if migration has been run)
  if (headerValue || noteValue) {
    const updateData: any = {};
    if (headerValue) updateData.header_value = headerValue;
    if (noteValue) updateData.note_value = noteValue;
    
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("kolektif_rows")
        .update(updateData)
        .eq("id", rowData.id);
      // Ignore error if columns don't exist yet
      if (updateError) {
        const errMsg = (updateError as any)?.message ?? "";
        if (!errMsg.includes("column") && !errMsg.includes("does not exist")) {
          console.warn("Could not update numeric columns:", updateError);
        }
      }
    }
  }
}

export async function updateKolektifRow(
  rowId: string,
  label: string,
  amount: number,
  note?: string,
  headerValue?: number,
  noteValue?: number,
): Promise<void> {
  const update: Record<string, unknown> = {
    label: label.trim(),
    amount,
    note: note ?? null,
  };
  if (headerValue !== undefined) update.header_value = headerValue;
  if (noteValue !== undefined) update.note_value = noteValue;
  
  try {
    const { error } = await supabase
      .from("kolektif_rows")
      .update(update)
      .eq("id", rowId);
    if (error) throw error;
  } catch (error) {
    // If update fails due to missing columns, try without the numeric columns
    const basicUpdate: Record<string, unknown> = {
      label: label.trim(),
      amount,
      note: note ?? null,
    };
    const { error: basicError } = await supabase
      .from("kolektif_rows")
      .update(basicUpdate)
      .eq("id", rowId);
    if (basicError) throw basicError;
  }
}

export async function deleteKolektifRow(rowId: string): Promise<void> {
  const { error } = await supabase
    .from("kolektif_rows")
    .delete()
    .eq("id", rowId);
  if (error) throw error;
}

// ─── Organization Name ────────────────────────────────────────────────────────
// Tetap pakai localStorage karena ini hanya setting lokal UI
export function getOrganizationName(): string {
  return (
    localStorage.getItem("kas_pemuda_organization_name_v1") ?? "Kas Pemuda"
  );
}

export function saveOrganizationName(name: string): void {
  localStorage.setItem(
    "kas_pemuda_organization_name_v1",
    name.trim() || "Kas Pemuda",
  );
  window.dispatchEvent(
    new StorageEvent("storage", { key: "kas_pemuda_organization_name_v1" }),
  );
}

// ─── Books ────────────────────────────────────────────────────────────────────

export async function getBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type as Book["type"],
    groupId: b.group_id ?? null,
  }));
}

export async function saveBooks(books: Book[]): Promise<void> {
  // Upsert semua books
  const rows = books.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    group_id: b.groupId ?? null,
  }));
  const { error } = await supabase.from("books").upsert(rows);
  if (error) throw error;
}

export async function addBook(
  name: string,
  type: "biasa" | "rutin" | "kolektif" | "group" = "biasa",
): Promise<Book> {
  const b: Book = { id: uid("book"), name: name.trim(), type, groupId: null };
  const { error } = await supabase
    .from("books")
    .insert({ id: b.id, name: b.name, type: b.type, group_id: null });
  if (error) throw error;
  return b;
}

export async function renameBook(bookId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ name: name.trim() })
    .eq("id", bookId);
  if (error) throw error;
}

export async function setBookGroupMembers(
  groupId: string,
  memberBookIds: string[],
): Promise<void> {
  const normalizedIds = [...new Set(memberBookIds)].filter(
    (id) => id !== groupId,
  );

  const { error: clearError } = await supabase
    .from("books")
    .update({ group_id: null })
    .eq("group_id", groupId);
  if (clearError) throw clearError;

  if (normalizedIds.length === 0) return;

  const { error } = await supabase
    .from("books")
    .update({ group_id: groupId })
    .in("id", normalizedIds);
  if (error) throw error;
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error: clearError } = await supabase
    .from("books")
    .update({ group_id: null })
    .eq("group_id", bookId);
  if (clearError) throw clearError;

  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) throw error;
}

export async function getBookSaldo(book: Book): Promise<number> {
  if (book.type === "group") return 0;

  if (book.type === "rutin") {
    const [
      frequency,
      categories,
      sessions,
      checklists,
      cashEntries,
    ] = await Promise.all([
      getRoutineFrequency(book.id),
      getRoutineCategories(book.id),
      getRoutineSessions(book.id),
      getRoutineChecklists(book.id),
      getRoutineCashEntries(book.id),
    ]);

    if (frequency === "bulanan") {
      // Filter checklist untuk tahun berjalan saja (konsisten dengan tampilan di RoutineBookPage)
      const currentYear = new Date().getFullYear();
      const yearPrefix = `${currentYear}-`;
      const amountByCategoryId = new Map(
        categories.map((c) => [c.id, c.amount]),
      );

      // Hitung saldo per kategori dari checklist tahun berjalan
      const categorySaldo = new Map<string, number>();
      for (const item of checklists) {
        if (!item.checked || item.notPaid || item.transferred) continue;
        if (!item.periodKey.startsWith(yearPrefix)) continue;
        const count = item.count ?? 1;
        const amount = amountByCategoryId.get(item.categoryId) ?? 0;
        categorySaldo.set(
          item.categoryId,
          (categorySaldo.get(item.categoryId) ?? 0) + count * amount,
        );
      }

      // Tambahkan cash entries per kategori
      for (const entry of cashEntries) {
        const catId = entry.categoryId ?? "kas";
        const delta = entry.type === "masuk" ? entry.amount : -entry.amount;
        categorySaldo.set(catId, (categorySaldo.get(catId) ?? 0) + delta);
      }

      // Total = jumlah semua saldo per kategori
      return Array.from(categorySaldo.values()).reduce((sum, v) => sum + v, 0);
    }

    // Arisan: hitung hanya sesi pertama (konsisten dengan default tampilan di RoutineBookPage)
    const activeSession = sessions[0];
    if (!activeSession) return 0;

    const amountByCategoryId = new Map<string, number>();
    for (const cat of activeSession.categories ?? []) {
      amountByCategoryId.set(cat.id, cat.amount);
    }

    // Kumpulkan periodKey yang valid untuk sesi ini
    // periodKey format: "{sessionId}-{roundIndex padded}"
    const sessionPrefix = `${activeSession.id}-`;

    const categorySaldo = new Map<string, number>();
    for (const item of checklists) {
      if (!item.checked || item.notPaid || item.transferred) continue;
      if (!item.periodKey.startsWith(sessionPrefix)) continue;
      const count = item.count ?? 1;
      const amount = amountByCategoryId.get(item.categoryId) ?? 0;
      categorySaldo.set(
        item.categoryId,
        (categorySaldo.get(item.categoryId) ?? 0) + count * amount,
      );
    }

    // Tambahkan cash entries per kategori
    for (const entry of cashEntries) {
      const catId = entry.categoryId ?? "kas";
      const delta = entry.type === "masuk" ? entry.amount : -entry.amount;
      categorySaldo.set(catId, (categorySaldo.get(catId) ?? 0) + delta);
    }

    return Array.from(categorySaldo.values()).reduce((sum, v) => sum + v, 0);
  }

  if (book.type === "kolektif") {
    const sessions = await getKolektifSessions(book.id);
    const totals = await Promise.all(
      sessions.map((s) => getKolektifConfig(s.id)),
    );
    return totals.reduce((sum, cfg) => {
      return sum + cfg.rows.reduce((rowSum, row) => {
        let r = rowSum + row.amount; // nominal column always included
        if (cfg.headerLabelType === "number") {
          r += (row.headerValue ?? (Number(row.label) || 0));
        }
        if (cfg.noteLabelType === "number") {
          r += (row.noteValue ?? (Number(row.note) || 0));
        }
        return r;
      }, 0);
    }, 0);
  }

  const tx = await getTransactions(book.id);
  return tx.reduce(
    (acc, t) => acc + (t.type === "masuk" ? t.amount : -t.amount),
    0,
  );
}

export async function getBookStatsMap(
  books: Book[],
): Promise<Record<string, number>> {
  const nonGroupBooks = books.filter((book) => book.type !== "group");
  const leafEntries = await Promise.all(
    nonGroupBooks.map(
      async (book) => [book.id, await getBookSaldo(book)] as const,
    ),
  );
  const leafStats = Object.fromEntries(leafEntries);

  const groupEntries = books
    .filter((book) => book.type === "group")
    .map((groupBook) => {
      const totalSaldo = nonGroupBooks
        .filter((book) => book.groupId === groupBook.id)
        .reduce((sum, book) => sum + (leafStats[book.id] ?? 0), 0);
      return [groupBook.id, totalSaldo] as const;
    });

  return {
    ...leafStats,
    ...Object.fromEntries(groupEntries),
  };
}

// ─── Book Permissions ─────────────────────────────────────────────────────────

export async function getBookPermissions(bookId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("book_permissions")
    .select("user_id")
    .eq("book_id", bookId);
  if (error) throw error;
  return (data ?? []).map((p) => p.user_id);
}

export async function setBookPermissions(
  bookId: string,
  userIds: string[],
): Promise<void> {
  // Hapus semua lalu insert ulang
  await supabase.from("book_permissions").delete().eq("book_id", bookId);
  if (userIds.length === 0) return;
  const rows = userIds.map((userId) => ({
    id: uid("bp"),
    book_id: bookId,
    user_id: userId,
  }));
  const { error } = await supabase.from("book_permissions").insert(rows);
  if (error) throw error;
}

export async function getUserBookPermissions(
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("book_permissions")
    .select("book_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((p) => p.book_id);
}

// ─── Routine Members ──────────────────────────────────────────────────────────

export async function getRoutineMembers(
  bookId: string,
): Promise<RoutineMember[]> {
  const { data, error } = await supabase
    .from("routine_members")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => {
    let categoryIds: string[] = [];
    if (m.category_ids !== undefined) {
      categoryIds = m.category_ids ?? [];
    }
    return {
      id: m.id,
      name: m.name,
      profileId: m.profile_id ?? undefined,
      categoryIds,
    };
  });
}

export async function saveRoutineMembers(
  bookId: string,
  members: RoutineMember[],
): Promise<void> {
  await supabase.from("routine_members").delete().eq("book_id", bookId);
  if (members.length === 0) return;
  const rows = members.map((m) => ({
    id: m.id,
    book_id: bookId,
    name: m.name,
    profile_id: m.profileId ?? null,
    category_ids: m.categoryIds ?? [],
  }));
  const { error } = await supabase.from("routine_members").insert(rows);
  if (error) throw error;
}

export async function addRoutineMember(
  bookId: string,
  name: string,
  profileId?: string,
): Promise<RoutineMember> {
  const m: RoutineMember = {
    id: uid("rm"),
    name: name.trim(),
    profileId: profileId ?? undefined,
    categoryIds: [],
  };
  const { error } = await supabase.from("routine_members").insert({
    id: m.id,
    book_id: bookId,
    name: m.name,
    profile_id: m.profileId ?? null,
    category_ids: [],
  });
  if (error) throw error;
  return m;
}

export async function deleteRoutineMember(
  bookId: string,
  memberId: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_members")
    .delete()
    .eq("id", memberId)
    .eq("book_id", bookId);
  if (error) throw error;
  // Hapus checklists terkait
  await supabase
    .from("routine_checklists")
    .delete()
    .eq("book_id", bookId)
    .eq("member_id", memberId);
}

export async function renameRoutineMember(
  bookId: string,
  memberId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_members")
    .update({ name: name.trim() })
    .eq("id", memberId)
    .eq("book_id", bookId);
  if (error) throw error;
}

// ─── Routine Categories ───────────────────────────────────────────────────────

export async function getRoutineCategories(
  bookId: string,
): Promise<RoutineCategory[]> {
  const { data, error } = await supabase
    .from("routine_categories")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) {
    return [
      { id: "kas", name: "Kas", amount: 10000 },
      { id: "arisan", name: "Arisan", amount: 20000 },
    ];
  }
  return data.map((c) => ({ id: c.id, name: c.name, amount: c.amount }));
}

export async function saveRoutineCategories(
  bookId: string,
  categories: RoutineCategory[],
): Promise<void> {
  await supabase.from("routine_categories").delete().eq("book_id", bookId);
  if (categories.length === 0) return;
  const rows = categories.map((c) => ({
    id: c.id,
    book_id: bookId,
    name: c.name,
    amount: c.amount,
  }));
  const { error } = await supabase.from("routine_categories").insert(rows);
  if (error) throw error;
}

export async function addRoutineCategory(
  bookId: string,
  name: string,
  amount: number,
): Promise<RoutineCategory> {
  const c: RoutineCategory = { id: uid("rc"), name: name.trim(), amount };
  const { error } = await supabase
    .from("routine_categories")
    .insert({ id: c.id, book_id: bookId, name: c.name, amount: c.amount });
  if (error) throw error;
  return c;
}

export async function deleteRoutineCategory(
  bookId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_categories")
    .delete()
    .eq("id", categoryId)
    .eq("book_id", bookId);
  if (error) throw error;
  await supabase
    .from("routine_checklists")
    .delete()
    .eq("book_id", bookId)
    .eq("category_id", categoryId);
}

export async function updateRoutineCategory(
  bookId: string,
  categoryId: string,
  name: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase
    .from("routine_categories")
    .update({ name: name.trim(), amount })
    .eq("id", categoryId)
    .eq("book_id", bookId);
  if (error) throw error;
}

// ─── Routine Cash Entries ─────────────────────────────────────────────────────

export async function getRoutineCashEntries(
  bookId: string,
): Promise<RoutineCashEntry[]> {
  const { data, error } = await supabase
    .from("routine_cash_entries")
    .select("*")
    .eq("book_id", bookId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((entry) => ({
    id: entry.id,
    bookId: entry.book_id,
    categoryId: entry.category_id ?? "kas", // backward compatibility: default to "kas" if no category
    date: entry.date,
    type: entry.type,
    amount: entry.amount,
    note: entry.note ?? "",
    createdAt: entry.created_at ?? undefined,
  }));
}

export async function addRoutineCashEntry(
  bookId: string,
  entry: Omit<RoutineCashEntry, "id" | "bookId" | "createdAt">,
): Promise<RoutineCashEntry> {
  const nextEntry: RoutineCashEntry = {
    id: uid("rce"),
    bookId,
    categoryId: entry.categoryId ?? "kas",
    date: entry.date,
    type: entry.type,
    amount: entry.amount,
    note: entry.note,
  };

  // Try inserting with category_id first (for new schema with category_id column).
  // If the column doesn't exist yet (old schema), fall back to inserting without it.
  try {
    const { error } = await supabase.from("routine_cash_entries").insert({
      id: nextEntry.id,
      book_id: bookId,
      category_id: nextEntry.categoryId,
      date: nextEntry.date,
      type: nextEntry.type,
      amount: nextEntry.amount,
      note: nextEntry.note,
    });
    if (!error) {
      dispatchRoutineChanged(bookId);
      return nextEntry;
    }
    // If error is NOT about unknown column, throw it
    const errMsg = (error as any)?.message ?? "";
    if (!errMsg.includes("column") && !errMsg.includes("category_id")) {
      throw error;
    }
  } catch (e: any) {
    // Only ignore errors about unknown column (category_id doesn't exist yet)
    const errMsg = e?.message ?? "";
    if (!errMsg.includes("column") && !errMsg.includes("category_id")) {
      console.error("Error inserting routine cash entry:", e);
      throw e;
    }
  }

  // Fallback: insert without category_id (for old schema before migration)
  try {
    const { error } = await supabase.from("routine_cash_entries").insert({
      id: nextEntry.id,
      book_id: bookId,
      date: nextEntry.date,
      type: nextEntry.type,
      amount: nextEntry.amount,
      note: nextEntry.note,
    });
    if (error) throw error;
  } catch (e) {
    console.error("Error inserting routine cash entry:", e);
    throw e;
  }
  
  dispatchRoutineChanged(bookId);
  return nextEntry;
}

export async function deleteRoutineCashEntry(
  bookId: string,
  entryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_cash_entries")
    .delete()
    .eq("id", entryId)
    .eq("book_id", bookId);
  if (error) throw error;
  dispatchRoutineChanged(bookId);
}

export async function updateRoutineCashEntry(
  bookId: string,
  entryId: string,
  updates: Partial<Omit<RoutineCashEntry, "id" | "bookId" | "createdAt">>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.date !== undefined) payload.date = updates.date;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.note !== undefined) payload.note = updates.note;
  if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;

  const { error } = await supabase
    .from("routine_cash_entries")
    .update(payload)
    .eq("id", entryId)
    .eq("book_id", bookId);
  if (error) throw error;
  dispatchRoutineChanged(bookId);
}

// ─── Routine Arisan Entries ───────────────────────────────────────────────────

export async function getRoutineArisanEntries(
  bookId: string,
): Promise<RoutineArisanEntry[]> {
  const { data, error } = await supabase
    .from("routine_arisan_entries")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: item.id,
    bookId: item.book_id,
    scopeType: item.scope_type,
    scopeKey: item.scope_key,
    name: item.name,
    amount: item.amount,
    createdAt: item.created_at ?? undefined,
  }));
}

export async function addRoutineArisanEntry(
  bookId: string,
  entry: {
    scopeType: RoutineArisanEntryScope;
    scopeKey: string;
    name: string;
    amount: number;
  },
): Promise<RoutineArisanEntry> {
  const nextEntry: RoutineArisanEntry = {
    id: uid("rae"),
    bookId,
    scopeType: entry.scopeType,
    scopeKey: entry.scopeKey,
    name: entry.name.trim(),
    amount: entry.amount,
  };

  const { error } = await supabase.from("routine_arisan_entries").insert({
    id: nextEntry.id,
    book_id: bookId,
    scope_type: nextEntry.scopeType,
    scope_key: nextEntry.scopeKey,
    name: nextEntry.name,
    amount: nextEntry.amount,
  });
  if (error) throw error;
  dispatchRoutineChanged(bookId);
  return nextEntry;
}

export async function deleteRoutineArisanEntry(
  bookId: string,
  entryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_arisan_entries")
    .delete()
    .eq("id", entryId)
    .eq("book_id", bookId);
  if (error) throw error;
  dispatchRoutineChanged(bookId);
}

// ─── Routine Checklists ───────────────────────────────────────────────────────

export async function getRoutineChecklists(
  bookId: string,
): Promise<RoutineChecklist[]> {
  const { data, error } = await supabase
    .from("routine_checklists")
    .select("*")
    .eq("book_id", bookId);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    periodKey: c.period_key,
    memberId: c.member_id,
    categoryId: c.category_id,
    checked: c.checked,
    date: c.date ?? undefined,
    count: c.count ?? 1,
    notPaid: c.not_paid ?? false,
    transferred: c.transferred ?? false,
  }));
}

export async function saveRoutineChecklists(
  bookId: string,
  checklists: RoutineChecklist[],
): Promise<void> {
  await supabase.from("routine_checklists").delete().eq("book_id", bookId);
  if (checklists.length === 0) return;
  const rows = checklists.map((c) => ({
    book_id: bookId,
    period_key: c.periodKey,
    member_id: c.memberId,
    category_id: c.categoryId,
    checked: c.checked,
    date: c.date ?? null,
    count: c.count ?? 1,
    not_paid: c.notPaid ?? false,
    transferred: c.transferred ?? false,
  }));
  const { error } = await supabase.from("routine_checklists").insert(rows);
  if (error) throw error;
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
  transferred?: boolean,
): Promise<void> {
  const { error } = await supabase.from("routine_checklists").upsert(
    {
      book_id: bookId,
      period_key: periodKey,
      member_id: memberId,
      category_id: categoryId,
      checked,
      date: date ?? null,
      count: count ?? 1,
      not_paid: notPaid ?? false,
      transferred: transferred ?? false,
    },
    { onConflict: "book_id,period_key,member_id,category_id" },
  );
  if (error) throw error;
  dispatchRoutineChanged(bookId);
}

export async function deleteRoutineChecklist(
  bookId: string,
  periodKey: string,
  memberId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_checklists")
    .delete()
    .eq("book_id", bookId)
    .eq("period_key", periodKey)
    .eq("member_id", memberId)
    .eq("category_id", categoryId);
  if (error) throw error;
  dispatchRoutineChanged(bookId);
}

export async function transferRoutineToTransaction(
  routineBookId: string,
  periodKey: string,
  categoryId: string,
  categoryName: string,
  totalAmount: number,
  targetBookId: string,
  sessionName?: string,
  routineBookName?: string,
): Promise<void> {
  // Create transaction in the target (biasa) book with today's date
  const today = new Date();
  const transactionDate = today.toISOString().split("T")[0]; // Use today's date (YYYY-MM-DD)

  // Build note based on period type
  let periodLabel: string;
  if (sessionName) {
    // Arisan/per sesi: periodKey = "ses_xxx-01" → putaran ke-1
    const roundNumber = periodKey.split("-").pop() ?? "1";
    periodLabel = `${sessionName} Putaran ${parseInt(roundNumber, 10)}`;
  } else {
    // Bulanan: periodKey = "2025-01"
    const [year, month] = periodKey.split("-");
    periodLabel = `${month}/${year}`;
  }

  const bookLabel = routineBookName ?? "Buku Rutinan";

  await addTransaction(targetBookId, {
    date: transactionDate,
    type: "masuk",
    categoryId: "iuran",
    amount: totalAmount,
    note: `Transfer dari ${bookLabel} - ${categoryName} ${periodLabel} [${periodKey}|${categoryName}]`,
    masukKeRekening: false,
  });

  // Mark all checklists for this period+category as transferred
  console.log("Updating routine_checklists with:", {
    routineBookId,
    periodKey,
    categoryId,
  });

  const { data, error } = await supabase
    .from("routine_checklists")
    .update({ transferred: true })
    .eq("book_id", routineBookId)
    .eq("period_key", periodKey)
    .eq("category_id", categoryId)
    .eq("checked", true)
    .eq("not_paid", false)
    .select();

  console.log("Update result:", { data, error });

  if (error) {
    console.error("Error updating routine_checklists:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn("No rows were updated. Check if the data exists.");
  }

  // Trigger refresh events
  window.dispatchEvent(
    new CustomEvent(TRANSACTIONS_CHANGED_EVENT, {
      detail: { bookId: targetBookId },
    }),
  );
  window.dispatchEvent(new CustomEvent("storage"));
}

export async function reverseTransferFromTransaction(
  transactionId: string,
  transactionBookId: string,
  routineBookId: string,
  periodKey: string,
  categoryId: string,
): Promise<void> {
  // Delete the transaction from the target (biasa) book
  await deleteTransaction(transactionBookId, transactionId);

  // Mark all checklists for this period+category as not transferred
  const { error } = await supabase
    .from("routine_checklists")
    .update({ transferred: false })
    .eq("book_id", routineBookId)
    .eq("period_key", periodKey)
    .eq("category_id", categoryId)
    .eq("checked", true)
    .eq("not_paid", false);

  if (error) throw error;

  // Trigger refresh events
  window.dispatchEvent(
    new CustomEvent(TRANSACTIONS_CHANGED_EVENT, {
      detail: { bookId: transactionBookId },
    }),
  );
  window.dispatchEvent(new CustomEvent("storage"));
}

export async function getRoutineBooksForReverseTransfer(): Promise<Book[]> {
  const allBooks = await getBooks();
  return allBooks.filter((b) => b.type === "rutin");
}

export function parseTransferNote(
  note: string,
): { categoryName: string; periodKey: string } | null {
  // Format baru: "Transfer dari {bookName} - {label} [{periodKey}|{categoryName}]"
  const newMatch = note.match(/^Transfer dari .+ - .+ \[([^\|]+)\|(.+)\]$/);
  if (newMatch) {
    const [, periodKey, categoryName] = newMatch;
    return { categoryName: categoryName.trim(), periodKey: periodKey.trim() };
  }

  // Format lama (bulanan): "Transfer dari buku kolektif - {categoryName} {month}/{year}"
  const oldMatch = note.match(
    /Transfer dari buku kolektif - (.+) (\d{2})\/(\d{4})/,
  );
  if (oldMatch) {
    const [, categoryName, month, year] = oldMatch;
    return { categoryName: categoryName.trim(), periodKey: `${year}-${month}` };
  }

  return null;
}

// ─── Routine Frequency ────────────────────────────────────────────────────────

export async function getRoutineFrequency(
  bookId: string,
): Promise<RoutineFrequency> {
  const { data, error } = await supabase
    .from("routine_frequency")
    .select("frequency")
    .eq("book_id", bookId)
    .single();
  if (error || !data) return "bulanan";
  const f = data.frequency;
  return f === "bulanan" || f === "arisan" ? f : "bulanan";
}

export async function saveRoutineFrequency(
  bookId: string,
  frequency: RoutineFrequency,
): Promise<void> {
  const { error } = await supabase
    .from("routine_frequency")
    .upsert({ book_id: bookId, frequency }, { onConflict: "book_id" });
  if (error) throw error;
}

// ─── Routine Sessions ─────────────────────────────────────────────────────────

export async function getRoutineSessions(
  bookId: string,
): Promise<RoutineSession[]> {
  const { data, error } = await supabase
    .from("routine_sessions")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => {
    try {
      return {
        id: s.id,
        name: s.name,
        members: s.members ? JSON.parse(s.members) : undefined,
        categories: s.categories ? JSON.parse(s.categories) : undefined,
      };
    } catch (e) {
      console.error("Error parsing session data:", e);
      return {
        id: s.id,
        name: s.name,
        members: undefined,
        categories: undefined,
      };
    }
  });
}

export async function saveRoutineSessions(
  bookId: string,
  sessions: RoutineSession[],
): Promise<void> {
  await supabase.from("routine_sessions").delete().eq("book_id", bookId);
  if (sessions.length === 0) return;
  const rows = sessions.map((s) => ({
    id: s.id,
    book_id: bookId,
    name: s.name,
    members: s.members ? JSON.stringify(s.members) : null,
    categories: s.categories ? JSON.stringify(s.categories) : null,
  }));
  const { error } = await supabase.from("routine_sessions").insert(rows);
  if (error) throw error;
}

export async function addRoutineSession(
  bookId: string,
  name: string,
  members?: RoutineMember[],
  categories?: RoutineCategory[],
): Promise<RoutineSession> {
  const sessions = await getRoutineSessions(bookId);
  const session: RoutineSession = {
    id: uid("ses"),
    name: name.trim() || `Sesi ${sessions.length + 1}`,
    members,
    categories,
  };
  const { error } = await supabase.from("routine_sessions").insert({
    id: session.id,
    book_id: bookId,
    name: session.name,
    members: members ? JSON.stringify(members) : null,
    categories: categories ? JSON.stringify(categories) : null,
  });
  if (error) throw error;
  return session;
}

export async function renameRoutineSession(
  bookId: string,
  sessionId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_sessions")
    .update({ name: name.trim() })
    .eq("id", sessionId)
    .eq("book_id", bookId);
  if (error) throw error;
}

export async function updateRoutineSession(
  bookId: string,
  sessionId: string,
  updates: {
    name?: string;
    members?: RoutineMember[];
    categories?: RoutineCategory[];
  },
): Promise<void> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name.trim();
  if (updates.members !== undefined)
    updateData.members = JSON.stringify(updates.members);
  if (updates.categories !== undefined)
    updateData.categories = JSON.stringify(updates.categories);

  const { error } = await supabase
    .from("routine_sessions")
    .update(updateData)
    .eq("id", sessionId)
    .eq("book_id", bookId);
  if (error) throw error;
}

export async function deleteRoutineSession(
  bookId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("routine_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("book_id", bookId);
  if (error) throw error;
  // Hapus checklists yang period_key mengandung sessionId
  const checklists = await getRoutineChecklists(bookId);
  const toKeep = checklists.filter((c) => !c.periodKey.startsWith(sessionId));
  await saveRoutineChecklists(bookId, toKeep);
}

// ─── Categories ───────────────────────────────────────────────────────────────

const defaultCategories: Category[] = [
  { id: "iuran", name: "Iuran" },
  { id: "donasi", name: "Donasi" },
  { id: "kegiatan", name: "Kegiatan" },
  { id: "konsumsi", name: "Konsumsi" },
];

export async function getCategories(bookId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) {
    // Seed default categories with upsert to avoid conflicts
    const rows = defaultCategories.map((c) => ({
      id: c.id,
      book_id: bookId,
      name: c.name,
    }));
    try {
      await supabase.from("categories").upsert(rows, { onConflict: "id,book_id" });
    } catch (e) {
      // Ignore errors
    }
    return defaultCategories;
  }
  return data.map((c) => ({ id: c.id, name: c.name }));
}

export async function saveCategories(
  bookId: string,
  categories: Category[],
): Promise<void> {
  await supabase.from("categories").delete().eq("book_id", bookId);
  if (categories.length === 0) return;
  const rows = categories.map((c) => ({
    id: c.id,
    book_id: bookId,
    name: c.name,
  }));
  const { error } = await supabase.from("categories").insert(rows);
  if (error) throw error;
}

export async function addCategory(
  bookId: string,
  name: string,
): Promise<Category> {
  const c: Category = { id: uid("cat"), name: name.trim() };
  const { error } = await supabase
    .from("categories")
    .insert({ id: c.id, book_id: bookId, name: c.name });
  if (error) throw error;
  return c;
}

export async function deleteCategory(
  bookId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("book_id", bookId);
  if (error) throw error;
  // Pindahkan transaksi ke 'lainnya'
  await supabase
    .from("transactions")
    .update({ category_id: "lainnya" })
    .eq("book_id", bookId)
    .eq("category_id", categoryId);
}

export async function ensureMiscCategory(bookId: string): Promise<void> {
  try {
    await supabase
      .from("categories")
      .upsert(
        { id: "lainnya", book_id: bookId, name: "Lainnya" },
        { onConflict: "id,book_id" },
      );
  } catch (e) {
    // Ignore errors
  }
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(bookId: string): Promise<Transaction[]> {
  await ensureMiscCategory(bookId);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("book_id", bookId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type as TxType,
    categoryId: t.category_id,
    amount: t.amount,
    note: t.note,
    masukKeRekening: Boolean(t.masuk_ke_rekening),
    attachmentUrl: t.attachment_url ?? undefined,
  }));
}

export async function saveTransactions(
  bookId: string,
  transactions: Transaction[],
): Promise<void> {
  await supabase.from("transactions").delete().eq("book_id", bookId);
  if (transactions.length === 0) {
    window.dispatchEvent(
      new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }),
    );
    return;
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
    attachment_url: t.attachmentUrl ?? null,
  }));
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw error;
  window.dispatchEvent(
    new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }),
  );
}

export async function addTransaction(
  bookId: string,
  input: {
    date: string;
    type: TxType;
    categoryId: string;
    amount: number;
    note: string;
    masukKeRekening?: boolean;
    attachmentUrl?: string;
  },
): Promise<Transaction> {
  const t: Transaction = {
    id: uid("tx"),
    date: input.date,
    type: input.type,
    categoryId: input.categoryId,
    amount: input.amount,
    note: input.note,
    masukKeRekening: Boolean(input.masukKeRekening),
    attachmentUrl: input.attachmentUrl,
  };
  const { error } = await supabase.from("transactions").insert({
    id: t.id,
    book_id: bookId,
    date: t.date,
    type: t.type,
    category_id: t.categoryId,
    amount: t.amount,
    note: t.note,
    masuk_ke_rekening: t.masukKeRekening,
    attachment_url: t.attachmentUrl ?? null,
  });
  if (error) throw error;
  window.dispatchEvent(
    new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }),
  );
  return t;
}

export async function updateTransaction(
  bookId: string,
  id: string,
  patch: Partial<Transaction>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.masukKeRekening !== undefined)
    update.masuk_ke_rekening = patch.masukKeRekening;
  if (patch.attachmentUrl !== undefined)
    update.attachment_url = patch.attachmentUrl ?? null;
  const { error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", id)
    .eq("book_id", bookId);
  if (error) throw error;
  window.dispatchEvent(
    new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }),
  );
}

export async function deleteTransaction(
  bookId: string,
  id: string,
): Promise<void> {
  // Ambil data transaksi dulu untuk mendapatkan attachment_url
  const { data: transaction } = await supabase
    .from("transactions")
    .select("attachment_url")
    .eq("id", id)
    .eq("book_id", bookId)
    .single();

  // Hapus file dari storage jika ada
  if (transaction?.attachment_url) {
    try {
      const url = new URL(transaction.attachment_url);
      const pathParts = url.pathname.split("/transaction-attachments/");
      if (pathParts.length >= 2) {
        const filePath = pathParts[1];
        await supabase.storage
          .from("transaction-attachments")
          .remove([filePath]);
      }
    } catch (error) {
      console.error("Error deleting attachment file:", error);
      // Lanjutkan hapus transaksi meskipun gagal hapus file
    }
  }

  // Hapus transaksi dari database
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("book_id", bookId);
  if (error) throw error;
  window.dispatchEvent(
    new CustomEvent(TRANSACTIONS_CHANGED_EVENT, { detail: { bookId } }),
  );
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function getActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as Activity["type"],
    frequency: a.frequency as Activity["frequency"],
    date: a.date,
    description: a.description ?? undefined,
    qrToken: a.qr_token ?? undefined,
    createdAt: a.created_at,
  }));
}

export async function saveActivities(activities: Activity[]): Promise<void> {
  // Tidak dipakai langsung, gunakan add/update/delete
  for (const a of activities) {
    await supabase.from("activities").upsert({
      id: a.id,
      name: a.name,
      type: a.type,
      frequency: a.frequency ?? null,
      date: a.date,
      description: a.description ?? null,
      created_at: a.createdAt,
    });
  }
}

export async function addActivity(input: {
  name: string;
  type: "sekali" | "rutin";
  frequency?: "mingguan" | "bulanan";
  date: string;
  description?: string;
}): Promise<Activity> {
  const activity: Activity = {
    id: uid("act"),
    name: input.name.trim(),
    type: input.type,
    frequency:
      input.type === "rutin" ? (input.frequency ?? "mingguan") : undefined,
    date: input.date,
    description: input.description?.trim(),
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("activities").insert({
    id: activity.id,
    name: activity.name,
    type: activity.type,
    frequency: activity.frequency ?? null,
    date: activity.date,
    description: activity.description ?? null,
    created_at: activity.createdAt,
  });
  if (error) throw error;
  dispatchActivitiesChanged();
  return activity;
}

export async function updateActivity(
  id: string,
  patch: Partial<Activity>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.frequency !== undefined) update.frequency = patch.frequency;
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.description !== undefined) update.description = patch.description;
  const { error } = await supabase
    .from("activities")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;
  dispatchActivitiesChanged();
}

// ─── Activity Sessions ────────────────────────────────────────────────────────

export async function getActivitySessions(): Promise<ActivitySession[]> {
  const { data, error } = await supabase
    .from("activity_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    activityId: s.activity_id,
    label: s.label,
    date: s.date,
    createdAt: s.created_at,
  }));
}

export async function saveActivitySessions(
  sessions: ActivitySession[],
): Promise<void> {
  for (const s of sessions) {
    await supabase.from("activity_sessions").upsert({
      id: s.id,
      activity_id: s.activityId,
      label: s.label,
      date: s.date,
      created_at: s.createdAt,
    });
  }
}

export async function getSessionsByActivity(
  activityId: string,
): Promise<ActivitySession[]> {
  const { data, error } = await supabase
    .from("activity_sessions")
    .select("*")
    .eq("activity_id", activityId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    activityId: s.activity_id,
    label: s.label,
    date: s.date,
    qrToken: s.qr_token ?? undefined,
    createdAt: s.created_at,
  }));
}

export async function addActivitySession(input: {
  activityId: string;
  label: string;
  date: string;
}): Promise<ActivitySession> {
  const session: ActivitySession = {
    id: uid("ses"),
    activityId: input.activityId,
    label: input.label.trim(),
    date: input.date,
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("activity_sessions").insert({
    id: session.id,
    activity_id: session.activityId,
    label: session.label,
    date: session.date,
    created_at: session.createdAt,
  });
  if (error) throw error;
  dispatchSessionsChanged(input.activityId);
  return session;
}

export async function deleteActivitySession(sessionId: string): Promise<void> {
  // Get the activityId first so we can dispatch the event
  const { data: session } = await supabase
    .from("activity_sessions")
    .select("activity_id")
    .eq("id", sessionId)
    .single();

  const { error } = await supabase
    .from("activity_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;

  // Also delete related attendance records
  await supabase
    .from("attendance_records")
    .delete()
    .eq("session_id", sessionId);

  if (session?.activity_id) {
    dispatchSessionsChanged(session.activity_id);
  }
}

export async function updateActivitySession(
  sessionId: string,
  patch: { date?: string; label?: string },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.label !== undefined) update.label = patch.label.trim();
  const { error } = await supabase
    .from("activity_sessions")
    .update(update)
    .eq("id", sessionId);
  if (error) throw error;
}

// ─── Attendance Records ───────────────────────────────────────────────────────

export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    sessionId: r.session_id ?? undefined,
    memberName: r.member_name,
    status: r.status as AttendanceRecord["status"],
    note: r.note ?? undefined,
    timestamp: r.timestamp,
  }));
}

export async function saveAttendanceRecords(
  records: AttendanceRecord[],
): Promise<void> {
  for (const r of records) {
    await supabase.from("attendance_records").upsert({
      id: r.id,
      activity_id: r.activityId,
      session_id: r.sessionId ?? null,
      member_name: r.memberName,
      status: r.status,
      note: r.note ?? null,
      timestamp: r.timestamp,
    });
  }
}

export async function addAttendanceRecord(input: {
  activityId: string;
  sessionId?: string;
  memberName: string;
  status: "hadir" | "izin" | "tidak-hadir";
  note?: string;
}): Promise<AttendanceRecord> {
  const record: AttendanceRecord = {
    id: uid("att"),
    activityId: input.activityId,
    sessionId: input.sessionId,
    memberName: input.memberName.trim(),
    status: input.status,
    note: input.note?.trim(),
    timestamp: new Date().toISOString(),
  };
  const { error } = await supabase.from("attendance_records").insert({
    id: record.id,
    activity_id: record.activityId,
    session_id: record.sessionId ?? null,
    member_name: record.memberName,
    status: record.status,
    note: record.note ?? null,
    timestamp: record.timestamp,
  });
  if (error) throw error;
  dispatchAttendanceChanged();
  return record;
}

export async function updateAttendanceRecord(
  id: string,
  patch: Partial<AttendanceRecord>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.memberName !== undefined) update.member_name = patch.memberName;
  const { error } = await supabase
    .from("attendance_records")
    .update(update)
    .eq("id", id);
  if (error) throw error;
  dispatchAttendanceChanged();
}

export async function deleteAttendanceRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
  dispatchAttendanceChanged();
}

export async function getAttendanceByActivity(
  activityId: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("activity_id", activityId)
    .is("session_id", null)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    sessionId: undefined,
    memberName: r.member_name,
    status: r.status as AttendanceRecord["status"],
    note: r.note ?? undefined,
    timestamp: r.timestamp,
  }));
}

export async function getAttendanceBySession(
  sessionId: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    sessionId: r.session_id ?? undefined,
    memberName: r.member_name,
    status: r.status as AttendanceRecord["status"],
    note: r.note ?? undefined,
    timestamp: r.timestamp,
  }));
}

// ─── QR Code Attendance ───────────────────────────────────────────────────────

// Generate QR token untuk activity atau session
function generateQRToken(): string {
  return (
    uid("qr") +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).substring(2, 9)
  );
}

// Generate atau ambil QR token untuk activity (kegiatan sekali)
export async function getOrGenerateActivityQRToken(
  activityId: string,
  forceRefresh = false,
): Promise<string> {
  const { data, error } = await supabase
    .from("activities")
    .select("qr_token")
    .eq("id", activityId)
    .single();

  if (error) throw error;

  if (!forceRefresh && data.qr_token) {
    return data.qr_token;
  }

  // Generate token baru
  const token = generateQRToken();
  const { error: updateError } = await supabase
    .from("activities")
    .update({ qr_token: token })
    .eq("id", activityId);

  if (updateError) throw updateError;
  return token;
}

// Generate atau ambil QR token untuk session (kegiatan rutin)
export async function getOrGenerateSessionQRToken(
  sessionId: string,
  forceRefresh = false,
): Promise<string> {
  const { data, error } = await supabase
    .from("activity_sessions")
    .select("qr_token")
    .eq("id", sessionId)
    .single();

  if (error) throw error;

  if (!forceRefresh && data.qr_token) {
    return data.qr_token;
  }

  // Generate token baru
  const token = generateQRToken();
  const { error: updateError } = await supabase
    .from("activity_sessions")
    .update({ qr_token: token })
    .eq("id", sessionId);

  if (updateError) throw updateError;
  return token;
}

// Validasi QR token dan return activity/session info
export async function validateQRToken(
  token: string,
  expectedTarget?: {
    type?: "activity" | "session";
    activityId?: string;
    sessionId?: string;
  },
): Promise<{
  type: "activity" | "session";
  activityId: string;
  sessionId?: string;
  activityName: string;
  sessionLabel?: string;
} | null> {
  if (expectedTarget?.type === "activity" && expectedTarget.activityId) {
    const { data: activityData } = await supabase
      .from("activities")
      .select("id, name")
      .eq("id", expectedTarget.activityId)
      .eq("qr_token", token)
      .maybeSingle();

    if (activityData) {
      return {
        type: "activity",
        activityId: activityData.id,
        activityName: activityData.name,
      };
    }

    return null;
  }

  if (expectedTarget?.type === "session" && expectedTarget.sessionId) {
    const { data: sessionData } = await supabase
      .from("activity_sessions")
      .select("id, activity_id, label, activities(name)")
      .eq("id", expectedTarget.sessionId)
      .eq("qr_token", token)
      .maybeSingle();

    if (sessionData) {
      return {
        type: "session",
        activityId: sessionData.activity_id,
        sessionId: sessionData.id,
        activityName: (sessionData.activities as any)?.name ?? "Unknown",
        sessionLabel: sessionData.label,
      };
    }

    return null;
  }

  // Backward compatibility untuk QR lama yang hanya berisi token
  const { data: activityData } = await supabase
    .from("activities")
    .select("id, name, type")
    .eq("qr_token", token)
    .maybeSingle();

  if (activityData) {
    return {
      type: "activity",
      activityId: activityData.id,
      activityName: activityData.name,
    };
  }

  const { data: sessionData } = await supabase
    .from("activity_sessions")
    .select("id, activity_id, label, activities(name)")
    .eq("qr_token", token)
    .maybeSingle();

  if (sessionData) {
    return {
      type: "session",
      activityId: sessionData.activity_id,
      sessionId: sessionData.id,
      activityName: (sessionData.activities as any)?.name ?? "Unknown",
      sessionLabel: sessionData.label,
    };
  }

  return null;
}

// Absen via QR code
export async function attendViaQR(
  token: string,
  memberName: string,
  expectedTarget?: {
    type?: "activity" | "session";
    activityId?: string;
    sessionId?: string;
  },
): Promise<{
  success: boolean;
  message: string;
  record?: AttendanceRecord;
}> {
  const validation = await validateQRToken(token, expectedTarget);

  if (!validation) {
    return {
      success: false,
      message: "QR code tidak valid atau sudah kadaluarsa",
    };
  }

  // Cek apakah sudah absen
  const { data: existingRecords } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("activity_id", validation.activityId)
    .eq("member_name", memberName);

  if (validation.sessionId) {
    const existing = existingRecords?.find(
      (r) => r.session_id === validation.sessionId,
    );
    if (existing) {
      return {
        success: false,
        message: "Anda sudah melakukan absensi untuk sesi ini",
      };
    }
  } else {
    if (existingRecords && existingRecords.length > 0) {
      return {
        success: false,
        message: "Anda sudah melakukan absensi untuk kegiatan ini",
      };
    }
  }

  // Buat record absensi
  const record = await addAttendanceRecord({
    activityId: validation.activityId,
    sessionId: validation.sessionId,
    memberName,
    status: "hadir",
    note: "Absen via QR code",
  });

  console.log("[attendViaQR] success", {
    token,
    expectedTarget,
    validation,
    record,
  });

  return {
    success: true,
    message: `Berhasil absen untuk ${validation.activityName}${validation.sessionLabel ? ` - ${validation.sessionLabel}` : ""}`,
    record,
  };
}

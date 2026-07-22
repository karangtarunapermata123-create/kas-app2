import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import TransactionsPage from "./TransactionsPage";
import RoutineBookPage from "./RoutineBookPage";
import { useAuth, canEditBook, canEditAttendance } from "../lib/auth";
import type { Profile } from "../lib/auth";
import {
  getKolektifSessions,
  addKolektifSession,
  renameKolektifSession,
  deleteKolektifSession,
  getKolektifConfig,
  copyKolektifConfig,
  updateKolektifLabels,
  addKolektifExtraColumn,
  updateKolektifExtraColumn,
  deleteKolektifExtraColumn,
  getBooks,
  getTransactions,
  getKolektifLinkedBooks,
  getKolektifLinkedKolektifBooks,
  getKolektifLinkedRoutineBooks,
  getKolektifLinkedActivities,
  linkActivityToKolektif,
  unlinkActivityFromKolektif,
  updateLinkedActivityTabLabel,
  getActivityFineTotal,
  getActivities,
  getAttendanceRecords,
  getAttendanceByActivity,
  getAttendanceBySession,
  addAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  getSessionsByActivity,
  linkBookToKolektif,
  unlinkBookFromKolektif,
  renameBook,
  saveBookTabLabel,
  getBookSaldo,
} from "../lib/store";
import { getAllProfiles } from "../lib/users";
import { formatIDR } from "../lib/money";
import { supabase } from "../lib/supabase";
import type { Book, KolektifSession, KolektifColumnType, KolektifExtraColumn, Activity, ActivitySession, AttendanceRecord } from "../lib/types";
import type { LinkedActivity } from "../lib/store";

// Komponen untuk render buku rutinan yang di-link
function LinkedRoutineView({ bookId }: { bookId: string }) {
  return <RoutineBookPage bookId={bookId} />;
}

// Komponen untuk render sub-buku list dari buku kolektif yang di-link
function LinkedKolektifView({ bookId }: { bookId: string }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<KolektifSession[]>([]);
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const list = await getKolektifSessions(bookId);
      setSessions(list);
      const totals: Record<string, number> = {};
      await Promise.all(
        list.map(async (s) => {
          const cfg = await getKolektifConfig(s.id);
          totals[s.id] = cfg.rows.reduce((sum, r) => {
            let rowTotal = r.amount;
            if (cfg.headerLabelType === "number") rowTotal += (r.headerValue ?? (Number(r.label) || 0));
            if (cfg.noteLabelType === "number") rowTotal += (r.noteValue ?? (Number(r.note) || 0));
            return sum + rowTotal;
          }, 0);
        }),
      );
      setSessionTotals(totals);
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [bookId]);

  if (loading) return (
    <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Memuat...</div>
  );

  if (sessions.length === 0) return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-6 py-12 text-center">
      <div className="text-slate-400 dark:text-slate-500 text-sm">Belum ada sub-buku di buku kolektif ini.</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-[55vh]">
      {sessions.map((session, idx) => (
        <button
          key={session.id}
          type="button"
          onClick={() => navigate(`/buku-kas-kolektif/${bookId}/sesi/${session.id}`)}
          className={`w-full flex items-center justify-between gap-3 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
            idx !== 0 ? "border-t border-slate-100 dark:border-slate-700" : ""
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx + 1}.</span>
            <span className="font-medium text-slate-900 dark:text-white truncate">{session.name}</span>
          </div>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
            {formatIDR(sessionTotals[session.id] ?? 0)}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function KolektifPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [userCanEdit, setUserCanEdit] = useState(false);

  if (!bookId) return null;
  const safeBookId = bookId;

  useEffect(() => {
    canEditBook(profile, safeBookId).then(setUserCanEdit);
  }, [profile, safeBookId]);

  useEffect(() => {
    setUserCanEditAttendance(canEditAttendance(profile?.role));
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getAllProfiles();
      if (!cancelled) setAllProfiles(data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tab state: "sub-buku" | "transaksi" | "kolektif" | "rutinan"
  const [activeTab, setActiveTab] = useState<"sub-buku" | "transaksi" | "kolektif" | "rutinan" | "absensi">("sub-buku");
  const [selectedLinkedBookId, setSelectedLinkedBookId] = useState<string | null>(null);
  const [selectedLinkedKolektifBookId, setSelectedLinkedKolektifBookId] = useState<string | null>(null);

  // Nama buku kolektif ini (dari books.name)
  const [kolektifBookName, setKolektifBookName] = useState<string>("");
  // Label tab Sub-buku (dari books.tab_label, fallback ke kolektifBookName)
  const [kolektifTabLabel, setKolektifTabLabel] = useState<string>("");

  // Modal rename nama buku kolektif (via klik tab Sub-buku)
  const [openRenameKolektifModal, setOpenRenameKolektifModal] = useState(false);
  const [renameKolektifInput, setRenameKolektifInput] = useState("");

  // Modal mode tabungan
  const [openModeTabunganModal, setOpenModeTabunganModal] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());

  // Modal info/aksi buku transaksi aktif
  const [openLinkedBookModal, setOpenLinkedBookModal] = useState(false);

  // State untuk field ganti label tab buku transaksi di modal info
  const [renameLinkedTabInput, setRenameLinkedTabInput] = useState("");
  // State untuk field ganti label tab buku rutinan di modal info
  const [renameLinkedRoutineTabInput, setRenameLinkedRoutineTabInput] = useState("");

  const [sessions, setSessions] = useState<KolektifSession[]>([]);
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Linked transaction books
  const [linkedBooks, setLinkedBooks] = useState<Book[]>([]);
  const [linkedBookTotals, setLinkedBookTotals] = useState<Record<string, number>>({});
  // Label tab per linked book: bookId → label (tab_label ?? name)
  const [linkedBookTabLabels, setLinkedBookTabLabels] = useState<Record<string, string>>({});

  // Linked kolektif books
  const [linkedKolektifBooks, setLinkedKolektifBooks] = useState<Book[]>([]);
  const [linkedKolektifTabLabels, setLinkedKolektifTabLabels] = useState<Record<string, string>>({});
  const [linkedKolektifBookTotals, setLinkedKolektifBookTotals] = useState<Record<string, number>>({});

  // Modal info/aksi buku kolektif yang di-link (klik tab aktif)
  const [openLinkedKolektifModal, setOpenLinkedKolektifModal] = useState(false);
  // Modal tambah sub-buku untuk linked kolektif book
  const [openAddLinkedSubModal, setOpenAddLinkedSubModal] = useState(false);
  const [newLinkedSubName, setNewLinkedSubName] = useState("");
  // Modal unlink buku kolektif
  const [openUnlinkKolektifModal, setOpenUnlinkKolektifModal] = useState(false);
  // Counter untuk force-remount LinkedKolektifView setelah tambah sub-buku
  const [linkedKolektifRefreshKey, setLinkedKolektifRefreshKey] = useState(0);

  // Linked routine books
  const [linkedRoutineBooks, setLinkedRoutineBooks] = useState<Book[]>([]);
  const [linkedRoutineTabLabels, setLinkedRoutineTabLabels] = useState<Record<string, string>>({});
  const [linkedRoutineBookTotals, setLinkedRoutineBookTotals] = useState<Record<string, number>>({});
  const [selectedLinkedRoutineBookId, setSelectedLinkedRoutineBookId] = useState<string | null>(null);
  // Modal info/aksi buku rutinan yang di-link
  const [openLinkedRoutineModal, setOpenLinkedRoutineModal] = useState(false);
  // Modal unlink buku rutinan
  const [openUnlinkRoutineModal, setOpenUnlinkRoutineModal] = useState(false);
  // Modal tambah buku rutinan
  const [openAddRoutineBookModal, setOpenAddRoutineBookModal] = useState(false);
  const [availableRoutineBooks, setAvailableRoutineBooks] = useState<Book[]>([]);
  const [selectedRoutineBookId, setSelectedRoutineBookId] = useState<string>("");

  // Linked activities (absensi)
  const [linkedActivities, setLinkedActivities] = useState<LinkedActivity[]>([]);
  const [linkedActivityFineTotals, setLinkedActivityFineTotals] = useState<Record<string, number>>({});
  const [selectedLinkedActivityId, setSelectedLinkedActivityId] = useState<string | null>(null);
  const [openAddActivityModal, setOpenAddActivityModal] = useState(false);
  const [openUnlinkActivityModal, setOpenUnlinkActivityModal] = useState(false);
  const [openLinkedActivityModal, setOpenLinkedActivityModal] = useState(false);
  const [renameLinkedActivityTabInput, setRenameLinkedActivityTabInput] = useState("");
  const [linkedActivityTabLabels, setLinkedActivityTabLabels] = useState<Record<string, string>>({});
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [linkedActivityRecords, setLinkedActivityRecords] = useState<Record<string, AttendanceRecord[]>>({});
  const [linkedActivitySessions, setLinkedActivitySessions] = useState<Record<string, ActivitySession[]>>({});
  const [userCanEditAttendance, setUserCanEditAttendance] = useState(false);
  const [openAttendanceStatusModal, setOpenAttendanceStatusModal] = useState(false);
  const [activeAttendanceProfileId, setActiveAttendanceProfileId] = useState<string | null>(null);
  const [activeAttendanceMemberName, setActiveAttendanceMemberName] = useState<string | null>(null);
  const [activeAttendanceStatus, setActiveAttendanceStatus] = useState<AttendanceRecord["status"] | null>(null);
  const [activeAttendanceFineAmount, setActiveAttendanceFineAmount] = useState<number | undefined>(undefined);
  const [activeAttendanceSessionId, setActiveAttendanceSessionId] = useState<string | null>(null);
  const [attendanceFineInput, setAttendanceFineInput] = useState("");
  const [showAttendanceFineInput, setShowAttendanceFineInput] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  // Modal tambah sub-buku
  const [openAddModal, setOpenAddModal] = useState(false);
  const [newName, setNewName] = useState("");

  // Modal atur kolom template (wajib sebelum buat sub-buku pertama)
  const [openTemplateColumnModal, setOpenTemplateColumnModal] = useState(false);
  // "add" = lanjut ke tambah manual, "tabungan" = lanjut ke mode tabungan
  const [templateNextAction, setTemplateNextAction] = useState<"add" | "tabungan">("add");
  const [tmplHeaderLabel, setTmplHeaderLabel] = useState("Nama");
  const [tmplNominalLabel, setTmplNominalLabel] = useState("Nominal");
  const [tmplNoteLabel, setTmplNoteLabel] = useState("Keterangan");
  const [tmplHeaderType, setTmplHeaderType] = useState<KolektifColumnType>("text");
  const [tmplNominalType, setTmplNominalType] = useState<KolektifColumnType>("number");
  const [tmplNoteType, setTmplNoteType] = useState<KolektifColumnType>("text");
  const [tmplExtraCols, setTmplExtraCols] = useState<Array<{ id: string; label: string; columnType: KolektifColumnType }>>([]);
  const [tmplNewColLabel, setTmplNewColLabel] = useState("");
  const [tmplNewColType, setTmplNewColType] = useState<KolektifColumnType>("text");
  const [openTmplAddColModal, setOpenTmplAddColModal] = useState(false);
  const [tmplEditingColId, setTmplEditingColId] = useState<string | null>(null);

  // Modal rename sub-buku
  const [openRenameModal, setOpenRenameModal] = useState(false);
  const [renamingSession, setRenamingSession] = useState<KolektifSession | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Modal hapus sub-buku
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deletingSession, setDeletingSession] = useState<KolektifSession | null>(null);

  // Modal tambah buku (type picker dulu)
  const [openAddTypeModal, setOpenAddTypeModal] = useState(false);
  const [openAddBookModal, setOpenAddBookModal] = useState(false);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");

  // Modal tambah buku kolektif
  const [openAddKolektifBookModal, setOpenAddKolektifBookModal] = useState(false);
  const [availableKolektifBooks, setAvailableKolektifBooks] = useState<Book[]>([]);
  const [selectedKolektifBookId, setSelectedKolektifBookId] = useState<string>("");

  // Modal hapus linked book
  const [openUnlinkModal, setOpenUnlinkModal] = useState(false);
  const [unlinkingBook, setUnlinkingBook] = useState<Book | null>(null);

  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const [list, linked, linkedKolektif, linkedRoutine, allBooks] = await Promise.all([
      getKolektifSessions(safeBookId),
      getKolektifLinkedBooks(safeBookId),
      getKolektifLinkedKolektifBooks(safeBookId),
      getKolektifLinkedRoutineBooks(safeBookId),
      getBooks(),
    ]);
    setSessions(list);
    setLinkedBooks(linked);
    setLinkedKolektifBooks(linkedKolektif);
    setLinkedRoutineBooks(linkedRoutine);
    // Ambil nama buku kolektif ini
    const thisBook = allBooks.find((b) => b.id === safeBookId);
    if (thisBook) {
      setKolektifBookName(thisBook.name);
      setKolektifTabLabel(thisBook.tabLabel || thisBook.name);
    }
    // Set label tab per linked book
    const tabLabels: Record<string, string> = {};
    for (const b of linked) {
      tabLabels[b.id] = b.tabLabel || b.name;
    }
    setLinkedBookTabLabels(tabLabels);
    // Set label tab per linked kolektif book
    const kolektifTabLabelMap: Record<string, string> = {};
    for (const b of linkedKolektif) {
      kolektifTabLabelMap[b.id] = b.tabLabel || b.name;
    }
    setLinkedKolektifTabLabels(kolektifTabLabelMap);

    // Set label tab per linked routine book
    const routineTabLabelMap: Record<string, string> = {};
    for (const b of linkedRoutine) {
      routineTabLabelMap[b.id] = b.tabLabel || b.name;
    }
    setLinkedRoutineTabLabels(routineTabLabelMap);

    // Load total per session
    const totals: Record<string, number> = {};
    await Promise.all(
      list.map(async (s) => {
        const cfg = await getKolektifConfig(s.id);
        totals[s.id] = cfg.rows.reduce((sum, r) => {
          let rowTotal = 0;
          if (cfg.headerLabelType === "number") {
            rowTotal += (r.headerValue ?? (Number(r.label) || 0));
          }
          if (cfg.nominalLabelType === "number") {
            const sign = r.txType === "keluar" ? -1 : 1;
            rowTotal += sign * r.amount;
          } else {
            rowTotal += r.amount;
          }
          if (cfg.noteLabelType === "number") {
            rowTotal += (r.noteValue ?? (Number(r.note) || 0));
          }
          for (const col of cfg.extraColumns) {
            if (col.columnType === "number") {
              const extraVal = r.extraValues?.[col.id];
              let val: number;
              let txType: "masuk" | "keluar" = "masuk";
              if (typeof extraVal === "string") {
                val = Number(extraVal);
              } else if (extraVal && typeof extraVal === "object") {
                val = Number(extraVal.value);
                txType = extraVal.txType || "masuk";
              } else {
                val = 0;
              }
              const sign = txType === "keluar" ? -1 : 1;
              rowTotal += Number.isFinite(val) ? sign * val : 0;
            }
          }
          return sum + rowTotal;
        }, 0);
      }),
    );
    setSessionTotals(totals);

    // Load total per linked book
    const bookTotals: Record<string, number> = {};
    await Promise.all(
      linked.map(async (b) => {
        const tx = await getTransactions(b.id);
        bookTotals[b.id] = tx.reduce(
          (acc, t) => acc + (t.type === "masuk" ? t.amount : -t.amount),
          0,
        );
      }),
    );
    setLinkedBookTotals(bookTotals);

    // Load total per linked kolektif book (sum semua sessions-nya)
    const kolektifBookTotals: Record<string, number> = {};
    await Promise.all(
      linkedKolektif.map(async (b) => {
        const subSessions = await getKolektifSessions(b.id);
        const subTotals = await Promise.all(
          subSessions.map(async (s) => {
            const cfg = await getKolektifConfig(s.id);
            return cfg.rows.reduce((sum, r) => {
              let rowTotal = r.amount;
              if (cfg.headerLabelType === "number") {
                rowTotal += (r.headerValue ?? (Number(r.label) || 0));
              }
              if (cfg.noteLabelType === "number") {
                rowTotal += (r.noteValue ?? (Number(r.note) || 0));
              }
              return sum + rowTotal;
            }, 0);
          }),
        );
        kolektifBookTotals[b.id] = subTotals.reduce((a, v) => a + v, 0);
      }),
    );
    setLinkedKolektifBookTotals(kolektifBookTotals);

    // Load total per linked routine book
    const routineBookTotals: Record<string, number> = {};
    await Promise.all(
      linkedRoutine.map(async (b) => {
        routineBookTotals[b.id] = await getBookSaldo(b);
      }),
    );
    setLinkedRoutineBookTotals(routineBookTotals);

    // Load linked activities
    const activities = await getKolektifLinkedActivities(safeBookId);
    setLinkedActivities(activities);
    // Restore tab labels from the loaded activities (tabLabel from DB)
    const loadedTabLabels: Record<string, string> = {};
    for (const a of activities) {
      if (a.tabLabel) loadedTabLabels[a.id] = a.tabLabel;
    }
    setLinkedActivityTabLabels(loadedTabLabels);
    setSelectedLinkedActivityId((prev) => {
      if (prev && activities.some((a) => a.id === prev)) return prev;
      return activities[0]?.id ?? null;
    });

    // Load fine totals dan records per activity
    const fineTotals: Record<string, number> = {};
    const activityRecordsMap: Record<string, AttendanceRecord[]> = {};
    const activitySessionsMap: Record<string, ActivitySession[]> = {};
    await Promise.all(
      activities.map(async (a) => {
        fineTotals[a.id] = await getActivityFineTotal(a.id);
        const allRecs = await getAttendanceRecords();
        activityRecordsMap[a.id] = allRecs.filter((r) => r.activityId === a.id);
        activitySessionsMap[a.id] = await getSessionsByActivity(a.id);
      }),
    );
    setLinkedActivityFineTotals(fineTotals);
    setLinkedActivityRecords(activityRecordsMap);
    setLinkedActivitySessions(activitySessionsMap);

    // Set selected linked book jika belum ada
    setSelectedLinkedBookId((prev) => {
      if (prev && linked.some((b) => b.id === prev)) return prev;
      return linked[0]?.id ?? null;
    });
    // Set selected linked kolektif book jika belum ada
    setSelectedLinkedKolektifBookId((prev) => {
      if (prev && linkedKolektif.some((b) => b.id === prev)) return prev;
      return linkedKolektif[0]?.id ?? null;
    });
    // Set selected linked routine book jika belum ada
    setSelectedLinkedRoutineBookId((prev) => {
      if (prev && linkedRoutine.some((b) => b.id === prev)) return prev;
      return linkedRoutine[0]?.id ?? null;
    });

    return { list, linked, linkedKolektif, linkedRoutine, linkedActivities: activities };
  };

  useEffect(() => {
    const state = location.state as { autoTab?: boolean | "absensi" | "transaksi"; selectedLinkedActivityId?: string; selectedLinkedBookId?: string } | null;
    const autoTab = state?.autoTab;
    setLoading(true);
    refresh().then((data) => {
      if (autoTab && data) {
        const { linked, linkedKolektif, linkedRoutine, list, linkedActivities: activities } = data;
        if (autoTab === "absensi") {
          if (activities.length > 0) {
            setActiveTab("absensi");
            const targetId = state?.selectedLinkedActivityId;
            setSelectedLinkedActivityId((prev) => {
              if (prev && activities.some((a) => a.id === prev)) return prev;
              if (targetId && activities.some((a) => a.id === targetId)) return targetId;
              return activities[0]?.id ?? null;
            });
          }
        } else if (autoTab === "transaksi") {
          if (linked.length > 0) {
            setActiveTab("transaksi");
            const targetId = state?.selectedLinkedBookId;
            setSelectedLinkedBookId((prev) => {
              if (prev && linked.some((b) => b.id === prev)) return prev;
              if (targetId && linked.some((b) => b.id === targetId)) return targetId;
              return linked[0]?.id ?? null;
            });
          }
        } else if (linked.length > 0) {
          setSelectedLinkedBookId(linked[0].id);
          setActiveTab("transaksi");
        } else if (linkedKolektif.length > 0) {
          setSelectedLinkedKolektifBookId(linkedKolektif[0].id);
          setActiveTab("kolektif");
        } else if (linkedRoutine.length > 0) {
          setSelectedLinkedRoutineBookId(linkedRoutine[0].id);
          setActiveTab("rutinan");
        } else if (list.length > 0) {
          setActiveTab("sub-buku");
        }
      }
    }).finally(() => setLoading(false));
  }, [safeBookId]);

  const refreshRecordsRef = useRef<((activityId: string) => void) | null>(null);
  useEffect(() => {
    refreshRecordsRef.current = refreshAttendanceRecords;
  }, [refreshAttendanceRecords]);

  useEffect(() => {
    if (linkedActivities.length === 0) return;
    const channelName = `kolektif-absensi-${safeBookId}`;
    const channel = supabase.channel(channelName);

    linkedActivities.forEach((a) => {
      if (a.type === "rutin") {
        channel.on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => {
          refreshRecordsRef.current?.(a.id);
        });
      } else {
        channel.on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `activity_id=eq.${a.id}`,
        }, () => {
          refreshRecordsRef.current?.(a.id);
        });
      }
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [linkedActivities, safeBookId]);

  const subBukuGrandTotal = sessions.reduce(
    (sum, s) => sum + (sessionTotals[s.id] ?? 0),
    0,
  );

  // Auto scroll sub-buku list ke bawah setelah data baru
  const subBukuListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading && subBukuListRef.current && sessions.length > 0) {
      const container = subBukuListRef.current;
      // Scroll ke bawah dengan smooth
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [sessions.length, loading]);
  const linkedGrandTotal = linkedBooks.reduce(
    (sum, b) => sum + (linkedBookTotals[b.id] ?? 0),
    0,
  );
  const linkedKolektifGrandTotal = linkedKolektifBooks.reduce(
    (sum, b) => sum + (linkedKolektifBookTotals[b.id] ?? 0),
    0,
  );
  const linkedRoutineGrandTotal = linkedRoutineBooks.reduce(
    (sum, b) => sum + (linkedRoutineBookTotals[b.id] ?? 0),
    0,
  );
  const linkedActivityFineGrandTotal = Object.values(linkedActivityFineTotals).reduce((sum, v) => sum + v, 0);
  const grandTotal = subBukuGrandTotal + linkedGrandTotal + linkedKolektifGrandTotal + linkedRoutineGrandTotal + linkedActivityFineGrandTotal;

  // ── Routine book handlers ────────────────────────────────────────────────

  async function openAddActivityModalFn() {
    const all = await getActivities();
    const linkedIds = new Set(linkedActivities.map((a) => a.id));
    setAllActivities(all.filter((a) => !linkedIds.has(a.id)));
    setOpenAddActivityModal(true);
  }

  async function handleLinkActivity(activityId: string) {
    setSaving(true);
    try {
      await linkActivityToKolektif(activityId, safeBookId);
      await refresh();
      setOpenAddActivityModal(false);
      setSelectedLinkedActivityId(activityId);
      setActiveTab("absensi");
    } catch (e) {
      console.error("Gagal menghubungkan absensi:", e);
      alert("Gagal menghubungkan absensi: " + ((e as Error)?.message || "Terjadi kesalahan"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlinkActivity() {
    if (!selectedLinkedActivityId) return;
    setSaving(true);
    try {
      await unlinkActivityFromKolektif(selectedLinkedActivityId, safeBookId);
      await refresh();
      setOpenUnlinkActivityModal(false);
      setActiveTab("sub-buku");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenAttendanceStatus(
    profileId: string,
    memberName: string,
    currentStatus: AttendanceRecord["status"] | null,
    currentFineAmount?: number,
    sessionId?: string,
  ) {
    setActiveAttendanceProfileId(profileId);
    setActiveAttendanceMemberName(memberName);
    setActiveAttendanceStatus(currentStatus);
    setActiveAttendanceFineAmount(currentFineAmount);
    setActiveAttendanceSessionId(sessionId ?? null);
    setAttendanceFineInput(currentFineAmount != null ? String(currentFineAmount) : "");
    setShowAttendanceFineInput(currentStatus === "denda");
    setOpenAttendanceStatusModal(true);
  }

  async function handleSetAttendanceStatus(status: AttendanceRecord["status"], fineAmount?: number) {
    if (!activeAttendanceProfileId || !activeAttendanceMemberName || !selectedLinkedActivityId) return;

    const targetSessionId = activeAttendanceSessionId;
    const activity = linkedActivities.find((a) => a.id === selectedLinkedActivityId);
    if (!activity) return;

    let existingRecord: AttendanceRecord | undefined;
    if (targetSessionId) {
      existingRecord = linkedActivityRecords[activity.id]?.find(
        (r) => r.sessionId === targetSessionId && r.memberName.toLowerCase().trim() === activeAttendanceMemberName.toLowerCase().trim(),
      );
    } else {
      existingRecord = linkedActivityRecords[activity.id]?.find(
        (r) => r.memberName.toLowerCase().trim() === activeAttendanceMemberName.toLowerCase().trim(),
      );
    }

    if (existingRecord) {
      await updateAttendanceRecord(existingRecord.id, {
        status,
        fineAmount: status === "denda" ? fineAmount : undefined,
      });
    } else {
      await addAttendanceRecord({
        activityId: activity.id,
        sessionId: targetSessionId ?? undefined,
        memberName: activeAttendanceMemberName,
        status,
        fineAmount: status === "denda" ? fineAmount : undefined,
      });
    }

    await refreshAttendanceRecords(activity.id);
    setOpenAttendanceStatusModal(false);
    setActiveAttendanceProfileId(null);
    setActiveAttendanceMemberName(null);
    setActiveAttendanceStatus(null);
    setActiveAttendanceFineAmount(undefined);
    setActiveAttendanceSessionId(null);
    setAttendanceFineInput("");
    setShowAttendanceFineInput(false);
  }

  async function handleDeleteAttendanceStatus() {
    if (!activeAttendanceMemberName || !selectedLinkedActivityId) return;

    const targetSessionId = activeAttendanceSessionId;
    const activity = linkedActivities.find((a) => a.id === selectedLinkedActivityId);
    if (!activity) return;

    let existingRecord: AttendanceRecord | undefined;
    if (targetSessionId) {
      existingRecord = linkedActivityRecords[activity.id]?.find(
        (r) => r.sessionId === targetSessionId && r.memberName.toLowerCase().trim() === activeAttendanceMemberName.toLowerCase().trim(),
      );
    } else {
      existingRecord = linkedActivityRecords[activity.id]?.find(
        (r) => r.memberName.toLowerCase().trim() === activeAttendanceMemberName.toLowerCase().trim(),
      );
    }

    if (existingRecord) {
      await deleteAttendanceRecord(existingRecord.id);
      await refreshAttendanceRecords(activity.id);
    }

    setOpenAttendanceStatusModal(false);
    setActiveAttendanceProfileId(null);
    setActiveAttendanceMemberName(null);
    setActiveAttendanceStatus(null);
    setActiveAttendanceFineAmount(undefined);
    setActiveAttendanceSessionId(null);
    setAttendanceFineInput("");
    setShowAttendanceFineInput(false);
  }

  async function refreshAttendanceRecords(activityId: string) {
    const activity = linkedActivities.find((a) => a.id === activityId);
    if (!activity) return;

    let records: AttendanceRecord[];
    if (activity.type === "rutin") {
      const allRecs = await getAttendanceRecords();
      records = allRecs.filter((r) => r.activityId === activityId);
    } else {
      records = await getAttendanceByActivity(activityId);
    }

    const sessions = await getSessionsByActivity(activityId);
    const fineTotal = await getActivityFineTotal(activityId);

    setLinkedActivityRecords((prev) => ({ ...prev, [activityId]: records }));
    setLinkedActivitySessions((prev) => ({ ...prev, [activityId]: sessions }));
    setLinkedActivityFineTotals((prev) => ({ ...prev, [activityId]: fineTotal }));
  }

  async function openAddRoutineBookModalFn() {
    const all = await getBooks();
    const linkedIds = new Set(linkedRoutineBooks.map((b) => b.id));
    const kolektifIds = new Set(all.filter((b) => b.type === "kolektif").map((b) => b.id));
    const candidates = all.filter(
      (b) =>
        b.type === "rutin" &&
        !linkedIds.has(b.id) &&
        !(b.groupId && kolektifIds.has(b.groupId)),
    );
    setAvailableRoutineBooks(candidates);
    setSelectedRoutineBookId(candidates[0]?.id ?? "");
    setOpenAddRoutineBookModal(true);
  }

  async function handleLinkRoutineBook() {
    if (!selectedRoutineBookId) return;
    setSaving(true);
    try {
      await linkBookToKolektif(selectedRoutineBookId, safeBookId);
      await refresh();
      setOpenAddRoutineBookModal(false);
      setSelectedLinkedRoutineBookId(selectedRoutineBookId);
      setActiveTab("rutinan");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlinkRoutine() {
    if (!selectedLinkedRoutineBookId) return;
    setSaving(true);
    try {
      await unlinkBookFromKolektif(selectedLinkedRoutineBookId);
      await refresh();
      setOpenUnlinkRoutineModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const newSession = await addKolektifSession(safeBookId, name);
      // Copy config kolom dari session pertama (template) jika ada session lain
      const existingSessions = sessions.filter((s) => s.id !== newSession.id);
      if (existingSessions.length > 0) {
        await copyKolektifConfig(existingSessions[0].id, newSession.id);
      }
      await refresh();
      setNewName("");
      setOpenAddModal(false);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Cek apakah sudah ada sessions. Kalau belum ada → wajib atur kolom template dulu.
   * Kalau sudah ada → langsung buka modal target.
   */
  function requireColumnSetup(nextAction: "add" | "tabungan") {
    // Selalu tampilkan modal atur kolom dulu.
    // Kalau sudah ada session, pre-fill dari config session pertama.
    const firstSession = sessions.find((s) => s.name !== "__template__") ?? sessions[0];
    if (firstSession) {
      // Load config dari session pertama sebagai default
      getKolektifConfig(firstSession.id).then((cfg) => {
        setTmplHeaderLabel(cfg.headerLabel);
        setTmplNominalLabel(cfg.nominalLabel);
        setTmplNoteLabel(cfg.noteLabel);
        setTmplHeaderType(cfg.headerLabelType);
        setTmplNominalType(cfg.nominalLabelType);
        setTmplNoteType(cfg.noteLabelType);
        setTmplExtraCols(cfg.extraColumns.map((c) => ({ id: c.id, label: c.label, columnType: c.columnType })));
        setTmplNewColLabel("");
        setTmplNewColType("text");
        setTemplateNextAction(nextAction);
        setOpenTemplateColumnModal(true);
      }).catch(() => {
        // Fallback ke default kalau gagal load
        setTmplHeaderLabel("Nama");
        setTmplNominalLabel("Nominal");
        setTmplNoteLabel("Keterangan");
        setTmplHeaderType("text");
        setTmplNominalType("number");
        setTmplNoteType("text");
        setTmplExtraCols([]);
        setTmplNewColLabel("");
        setTmplNewColType("text");
        setTemplateNextAction(nextAction);
        setOpenTemplateColumnModal(true);
      });
    } else {
      // Belum ada session sama sekali → pakai default
      setTmplHeaderLabel("Nama");
      setTmplNominalLabel("Nominal");
      setTmplNoteLabel("Keterangan");
      setTmplHeaderType("text");
      setTmplNominalType("number");
      setTmplNoteType("text");
      setTmplExtraCols([]);
      setTmplNewColLabel("");
      setTmplNewColType("text");
      setTemplateNextAction(nextAction);
      setOpenTemplateColumnModal(true);
    }
  }

  async function openModeTabungan() {
    try {
      const allProfiles = await getAllProfiles();
      setProfiles(allProfiles);
      setSelectedProfileIds(new Set());
      setOpenModeTabunganModal(true);
    } catch (e) {
      console.error("Gagal memuat daftar user:", e);
    }
  }

  /**
   * Simpan kolom template lalu buat session dummy untuk menyimpan config,
   * kemudian lanjut ke aksi berikutnya.
   */
  async function saveTemplateAndContinue() {
    setSaving(true);
    try {
      // Cari session template yang sudah ada, atau buat baru kalau belum ada sama sekali
      let templateSession = sessions.find((s) => s.name === "__template__") ?? sessions[0] ?? null;

      if (!templateSession) {
        // Belum ada session sama sekali → buat session dummy sebagai template
        templateSession = await addKolektifSession(safeBookId, "__template__");
      }

      // Update config kolom di session template
      await updateKolektifLabels(templateSession.id, {
        headerLabel: tmplHeaderLabel,
        nominalLabel: tmplNominalLabel,
        noteLabel: tmplNoteLabel,
        headerLabelType: tmplHeaderType,
        nominalLabelType: tmplNominalType,
        noteLabelType: tmplNoteType,
      });

      // Sync extra columns: hapus semua yang lama lalu tambah yang baru
      const existingConfig = await getKolektifConfig(templateSession.id);
      for (const col of existingConfig.extraColumns) {
        await deleteKolektifExtraColumn(col.id);
      }
      for (const col of tmplExtraCols) {
        await addKolektifExtraColumn(templateSession.id, col.label, col.columnType);
      }

      await refresh();
      setOpenTemplateColumnModal(false);

      if (templateNextAction === "add") {
        setNewName("");
        setOpenAddModal(true);
      } else {
        await openModeTabungan();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!renamingSession) return;
    const name = renameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      await renameKolektifSession(renamingSession.id, name);
      await refresh();
      setOpenRenameModal(false);
      setRenamingSession(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingSession) return;
    setSaving(true);
    try {
      await deleteKolektifSession(deletingSession.id);
      await refresh();
      setOpenDeleteModal(false);
      setDeletingSession(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Linked book handlers ─────────────────────────────────────────────────

  async function openAddBookModalFn() {
    const all = await getBooks();
    const linkedIds = new Set(linkedBooks.map((b) => b.id));
    // Tampilkan buku biasa yang:
    // - bukan buku ini sendiri
    // - belum di-link ke kolektif manapun (group_id mengarah ke buku kolektif)
    // - belum ada di linked list saat ini
    // Catatan: buku yang masuk ke "group book" (group_id → type=group) tetap boleh di-link
    const kolektifIds = new Set(all.filter((b) => b.type === "kolektif").map((b) => b.id));
    const candidates = all.filter(
      (b) =>
        b.type === "biasa" &&
        b.id !== safeBookId &&
        !linkedIds.has(b.id) &&
        // Belum di-link ke buku kolektif manapun
        !(b.groupId && kolektifIds.has(b.groupId)),
    );
    setAvailableBooks(candidates);
    setSelectedBookId(candidates[0]?.id ?? "");
    setOpenAddBookModal(true);
  }

  async function openAddKolektifBookModalFn() {
    const all = await getBooks();
    const linkedIds = new Set(linkedKolektifBooks.map((b) => b.id));
    const kolektifIds = new Set(all.filter((b) => b.type === "kolektif").map((b) => b.id));
    // Buku kolektif yang belum di-link ke kolektif manapun dan bukan diri sendiri
    const candidates = all.filter(
      (b) =>
        b.type === "kolektif" &&
        b.id !== safeBookId &&
        !linkedIds.has(b.id) &&
        !(b.groupId && kolektifIds.has(b.groupId)),
    );
    setAvailableKolektifBooks(candidates);
    setSelectedKolektifBookId(candidates[0]?.id ?? "");
    setOpenAddKolektifBookModal(true);
  }

  async function handleLinkBook() {
    if (!selectedBookId) return;
    setSaving(true);
    try {
      await linkBookToKolektif(selectedBookId, safeBookId);
      await refresh();
      setOpenAddBookModal(false);
      setActiveTab("transaksi");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkKolektifBook() {
    if (!selectedKolektifBookId) return;
    setSaving(true);
    try {
      await linkBookToKolektif(selectedKolektifBookId, safeBookId);
      await refresh();
      setOpenAddKolektifBookModal(false);
      setSelectedLinkedKolektifBookId(selectedKolektifBookId);
      setActiveTab("kolektif");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    if (!unlinkingBook) return;
    setSaving(true);
    try {
      await unlinkBookFromKolektif(unlinkingBook.id);
      await refresh();
      setOpenUnlinkModal(false);
      setUnlinkingBook(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLinkedSub() {
    if (!selectedLinkedKolektifBookId) return;
    const name = newLinkedSubName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await addKolektifSession(selectedLinkedKolektifBookId, name);
      setNewLinkedSubName("");
      setOpenAddLinkedSubModal(false);
      setLinkedKolektifRefreshKey(k => k + 1);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlinkKolektif() {
    if (!selectedLinkedKolektifBookId) return;
    setSaving(true);
    try {
      await unlinkBookFromKolektif(selectedLinkedKolektifBookId);
      await refresh();
      setOpenUnlinkKolektifModal(false);
      setActiveTab("sub-buku");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameKolektif() {
    const name = renameKolektifInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      await saveBookTabLabel(safeBookId, name);
      setKolektifTabLabel(name);
      setOpenRenameKolektifModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameLinkedTab() {
    if (!selectedLinkedBookId) return;
    const name = renameLinkedTabInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      await saveBookTabLabel(selectedLinkedBookId, name);
      setLinkedBookTabLabels((prev) => ({ ...prev, [selectedLinkedBookId]: name }));
      setOpenLinkedBookModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameRoutineTab() {
    if (!selectedLinkedRoutineBookId) return;
    const name = renameLinkedRoutineTabInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      await saveBookTabLabel(selectedLinkedRoutineBookId, name);
      setLinkedRoutineTabLabels((prev) => ({ ...prev, [selectedLinkedRoutineBookId]: name }));
      setOpenLinkedRoutineModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameLinkedActivityTab() {
    if (!selectedLinkedActivityId) return;
    const name = renameLinkedActivityTabInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      const activity = linkedActivities.find((a) => a.id === selectedLinkedActivityId);
      if (activity) {
        await updateLinkedActivityTabLabel(activity.linkId, name);
        setLinkedActivityTabLabels((prev) => ({ ...prev, [selectedLinkedActivityId]: name }));
      }
      setOpenLinkedActivityModal(false);
    } catch (e) {
      console.error("Gagal mengganti label tab absensi:", e);
      alert("Gagal mengganti label: " + ((e as Error)?.message || "Terjadi kesalahan"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <svg
          className="animate-spin h-6 w-6 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Memuat...
      </div>
    );
  }

  const hasAny = sessions.length > 0 || linkedBooks.length > 0;

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">

      {/* ── Card Total — compact strip, sticky ── */}
      {hasAny && (
        <div className="sticky top-0 z-20 flex items-center gap-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto scrollbar-hide shadow-sm">
          <div className="sticky left-0 z-10 shrink-0 px-4 py-2.5 bg-white dark:bg-slate-800">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Total</div>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatIDR(grandTotal)}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            {sessions.length > 0 && (
              <>
                <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                <div className="shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {kolektifTabLabel || "Sub-buku"}
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${subBukuGrandTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : subBukuGrandTotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                    {formatIDR(subBukuGrandTotal)}
                  </div>
                </div>
              </>
            )}
            {linkedKolektifBooks.map((b) => (
              <React.Fragment key={b.id}>
                <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                <div className="shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {b.name}
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${(linkedKolektifBookTotals[b.id] ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : (linkedKolektifBookTotals[b.id] ?? 0) < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                    {formatIDR(linkedKolektifBookTotals[b.id] ?? 0)}
                  </div>
                </div>
              </React.Fragment>
            ))}
            {linkedRoutineBooks.map((b) => (
              <React.Fragment key={b.id}>
                <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                <div className="shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {linkedRoutineTabLabels[b.id] ?? b.name}
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${(linkedRoutineBookTotals[b.id] ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : (linkedRoutineBookTotals[b.id] ?? 0) < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                    {formatIDR(linkedRoutineBookTotals[b.id] ?? 0)}
                  </div>
                </div>
              </React.Fragment>
            ))}
            {linkedActivities.map((a) => {
              const fine = linkedActivityFineTotals[a.id] ?? 0;
              if (fine === 0) return null;
              return (
                <React.Fragment key={a.id}>
                  <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                  <div className="shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {linkedActivityTabLabels[a.id] ?? a.name}
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatIDR(fine)}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {linkedBooks.length > 0 && (
              <>
                <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                <div className="shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Transaksi
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${linkedGrandTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : linkedGrandTotal < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                    {formatIDR(linkedGrandTotal)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Card dengan Tab terintegrasi ── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* ── Tab bar di dalam card ── */}
        <div className="flex items-center gap-0 bg-slate-50 dark:bg-slate-900/60 px-3 pt-2.5 overflow-x-auto scrollbar-hide">
          {/* Tab sub-buku */}
          <button
            type="button"
            onClick={() => setActiveTab("sub-buku")}
            className={`relative flex items-center gap-1.5 pl-3 pr-2.5 text-sm font-medium transition-all rounded-t-lg shrink-0 select-none ${
              activeTab === "sub-buku"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2 border border-b-white dark:border-b-slate-800 border-slate-200 dark:border-slate-700 z-10"
                : "py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <span className="truncate max-w-[100px]">{kolektifTabLabel || "Sub-buku"}</span>
            {userCanEdit && activeTab === "sub-buku" && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setRenameKolektifInput(kolektifTabLabel); setOpenRenameKolektifModal(true); }}
                onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setRenameKolektifInput(kolektifTabLabel), setOpenRenameKolektifModal(true))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0"
                title="Info"
              ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>
            )}
          </button>

          {/* Tab linked kolektif books */}
          {linkedKolektifBooks.map((b) => {
            const isActive = activeTab === "kolektif" && selectedLinkedKolektifBookId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelectedLinkedKolektifBookId(b.id); setActiveTab("kolektif"); }}
                className={`relative flex items-center gap-1.5 pl-3 pr-2.5 text-sm font-medium transition-all rounded-t-lg shrink-0 select-none ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2 border border-b-white dark:border-b-slate-800 border-slate-200 dark:border-slate-700 z-10"
                    : "py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="truncate max-w-[100px]">{linkedKolektifTabLabels[b.id] ?? b.name}</span>
                {userCanEdit && isActive && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setOpenLinkedKolektifModal(true); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setOpenLinkedKolektifModal(true))}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0"
                    title="Info"
                  ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>
                )}
              </button>
            );
          })}

          {/* Tab linked rutinan books */}
          {linkedRoutineBooks.map((b) => {
            const isActive = activeTab === "rutinan" && selectedLinkedRoutineBookId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelectedLinkedRoutineBookId(b.id); setActiveTab("rutinan"); }}
                className={`relative flex items-center gap-1.5 pl-3 pr-2.5 text-sm font-medium transition-all rounded-t-lg shrink-0 select-none ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2 border border-b-white dark:border-b-slate-800 border-slate-200 dark:border-slate-700 z-10"
                    : "py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="truncate max-w-[100px]">{linkedRoutineTabLabels[b.id] ?? b.name}</span>
                {userCanEdit && isActive && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setRenameLinkedRoutineTabInput(linkedRoutineTabLabels[b.id] ?? b.name); setOpenLinkedRoutineModal(true); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setRenameLinkedRoutineTabInput(linkedRoutineTabLabels[b.id] ?? b.name), setOpenLinkedRoutineModal(true))}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0"
                    title="Info"
                  ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>
                )}
              </button>
            );
          })}

          {/* Tab linked activities (absensi) */}
          {linkedActivities.map((a) => {
            const isActive = activeTab === "absensi" && selectedLinkedActivityId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => { setSelectedLinkedActivityId(a.id); setActiveTab("absensi"); }}
                className={`relative flex items-center gap-1.5 pl-3 pr-2.5 text-sm font-medium transition-all rounded-t-lg shrink-0 select-none ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2 border border-b-white dark:border-b-slate-800 border-slate-200 dark:border-slate-700 z-10"
                    : "py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="truncate max-w-[100px]">{linkedActivityTabLabels[a.id] ?? a.name}</span>
                {userCanEdit && isActive && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setRenameLinkedActivityTabInput(linkedActivityTabLabels[a.id] ?? a.name); setOpenLinkedActivityModal(true); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setRenameLinkedActivityTabInput(linkedActivityTabLabels[a.id] ?? a.name), setOpenLinkedActivityModal(true))}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0"
                    title="Info"
                  ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>
                )}
              </button>
            );
          })}

          {/* Tab linked transaksi books */}
          {linkedBooks.map((b) => {
            const isActive = activeTab === "transaksi" && selectedLinkedBookId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelectedLinkedBookId(b.id); setActiveTab("transaksi"); }}
                className={`relative flex items-center gap-1.5 pl-3 pr-2.5 text-sm font-medium transition-all rounded-t-lg shrink-0 select-none ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2 border border-b-white dark:border-b-slate-800 border-slate-200 dark:border-slate-700 z-10"
                    : "py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="truncate max-w-[100px]">{linkedBookTabLabels[b.id] ?? b.name}</span>
                {isActive && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setRenameLinkedTabInput(linkedBookTabLabels[b.id] ?? b.name); setOpenLinkedBookModal(true); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setRenameLinkedTabInput(linkedBookTabLabels[b.id] ?? b.name), setOpenLinkedBookModal(true))}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0"
                    title="Info"
                  ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>
                )}
              </button>
            );
          })}

          {/* Tombol + di sebelah kanan tab terakhir */}
          {userCanEdit && (
            <button
              type="button"
              onClick={() => setOpenAddTypeModal(true)}
              title="Tambah tab buku"
              className="ml-1.5 self-center flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 shrink-0 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
            </button>
          )}
        </div>

        {/* ── Konten Tab ── */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden border-t border-slate-200 dark:border-slate-700">

        {/* Tab: Sub-buku */}
        {activeTab === "sub-buku" && (
          <div ref={subBukuListRef} className="relative flex flex-col gap-3 flex-1 min-h-0 pb-16 overflow-y-auto p-4">
            {sessions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-slate-400 dark:text-slate-500 text-sm">
                  Belum ada sub-buku.
                  {userCanEdit ? ' Klik tombol + di kanan bawah untuk menambahkan.' : ""}
                </div>
              </div>
            ) : (
              <div className="rounded-lg overflow-y-auto max-h-[55vh]">
                {sessions.map((session, idx) => (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between gap-3 bg-white dark:bg-slate-800 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      idx !== 0 ? "border-t border-slate-100 dark:border-slate-700" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/buku-kas-kolektif/${safeBookId}/sesi/${session.id}`)
                      }
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {session.name}
                      </span>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 ml-auto shrink-0">
                        {formatIDR(sessionTotals[session.id] ?? 0)}
                      </span>
                    </button>
                    {userCanEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingSession(session);
                            setRenameInput(session.name);
                            setOpenRenameModal(true);
                          }}
                          className="rounded p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Rename"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingSession(session);
                            setOpenDeleteModal(true);
                          }}
                          className="rounded p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          title="Hapus"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* FAB Tombol + Sub-buku */}
            {userCanEdit && (
              <button
                type="button"
                onClick={() => { setNewName(""); requireColumnSetup("add"); }}
                className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-6 z-50 md:bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-white shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition active:scale-95"
                title="Tambah Sub-buku"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Tab: Buku Transaksi */}
        {activeTab === "transaksi" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-4">
            {linkedBooks.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-slate-400 dark:text-slate-500 text-sm">
                  Belum ada buku transaksi.
                  {userCanEdit ? ' Klik "+" untuk menambahkan.' : ""}
                </div>
              </div>
            ) : selectedLinkedBookId ? (
              <TransactionsPage key={selectedLinkedBookId} bookId={selectedLinkedBookId} mode="semua" embedded={true} />
            ) : null}
          </div>
        )}

        {/* Tab: Buku Kolektif (linked) */}
        {activeTab === "kolektif" && (
          <div className="flex flex-col gap-3 flex-1 min-h-0 p-4 overflow-y-auto">
            {linkedKolektifBooks.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-slate-400 dark:text-slate-500 text-sm">
                  Belum ada buku kolektif.
                  {userCanEdit ? ' Klik "+" untuk menambahkan.' : ""}
                </div>
              </div>
            ) : selectedLinkedKolektifBookId ? (
              <LinkedKolektifView key={`${selectedLinkedKolektifBookId}-${linkedKolektifRefreshKey}`} bookId={selectedLinkedKolektifBookId} />
            ) : null}
          </div>
        )}

        {/* Tab: Buku Rutinan (linked) */}
        {activeTab === "rutinan" && (
          <div className="flex flex-col gap-3 flex-1 min-h-0 p-4 overflow-y-auto">
            {linkedRoutineBooks.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-slate-400 dark:text-slate-500 text-sm">
                  Belum ada buku rutinan.
                  {userCanEdit ? ' Klik "+" untuk menambahkan.' : ""}
                </div>
              </div>
            ) : selectedLinkedRoutineBookId ? (
              <LinkedRoutineView key={selectedLinkedRoutineBookId} bookId={selectedLinkedRoutineBookId} />
            ) : null}
          </div>
        )}

        {/* Tab: Absensi (linked) */}
        {activeTab === "absensi" && (
          <div className="flex flex-col gap-3 flex-1 min-h-0 p-4 overflow-y-auto">
            {linkedActivities.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-slate-400 dark:text-slate-500 text-sm">
                  Belum ada absensi.
                  {userCanEdit ? ' Klik "+" untuk menambahkan.' : ""}
                </div>
              </div>
            ) : (() => {
              const activity = linkedActivities.find((a) => a.id === selectedLinkedActivityId);
              if (!activity) return null;
              const records = linkedActivityRecords[activity.id] ?? [];
              const sessions = linkedActivitySessions[activity.id] ?? [];
              const fineTotal = linkedActivityFineTotals[activity.id] ?? 0;

              // Deduplicate member names from records
              const memberNames = [...new Set(records.map((r) => r.memberName))].sort((a, b) => a.localeCompare(b, "id"));

              return (
                <div className="grid gap-3">
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Hadir</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {records.filter((r) => r.status === "hadir").length}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Tidak Hadir</div>
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                        {records.filter((r) => r.status === "tidak-hadir").length}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total Denda</div>
                      <div className="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                        {fineTotal > 0 ? formatIDR(fineTotal) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Tabel absensi — per sesi untuk rutinan, flat untuk sekali */}
                  {activity.type === "rutin" && sessions.length > 0 ? (
                    <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: `${140 + sessions.length * 70}px`, width: "100%" }}>
                        <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-left whitespace-nowrap">Nama</th>
                            {sessions.map((s) => (
                              <th key={s.id} className="border-b border-r border-slate-200 dark:border-slate-700 px-2 py-2 text-center whitespace-nowrap">
                                <div className="text-[11px] leading-tight">{s.label}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {memberNames.map((name) => (
                            <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                              <td className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-medium text-slate-900 dark:text-white text-xs">{name}</td>
                              {sessions.map((s) => {
                                const rec = records.find((r) => r.sessionId === s.id && r.memberName === name);
                                const st = rec?.status ?? null;
                                const fineAmount = rec?.fineAmount;
                                return (
                                  <td key={s.id} className="border-b border-r border-slate-200 dark:border-slate-700 px-2 py-2 text-center">
                                    {st === "denda" ? (
                                      <button
                                        type="button"
                                        onClick={() => userCanEditAttendance && handleOpenAttendanceStatus(allProfiles.find((p) => p.full_name === name)?.id ?? "", name, st, fineAmount, s.id)}
                                        disabled={!userCanEditAttendance}
                                        className={`text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400 transition ${userCanEditAttendance ? "hover:text-rose-800 cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                                      >
                                        {fineAmount ? `Rp ${fineAmount.toLocaleString("id-ID")}` : "Denda"}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => userCanEditAttendance && handleOpenAttendanceStatus(allProfiles.find((p) => p.full_name === name)?.id ?? "", name, st, undefined, s.id)}
                                        disabled={!userCanEditAttendance}
                                        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold transition ${
                                          userCanEditAttendance ? "hover:scale-110 cursor-pointer" : "cursor-not-allowed opacity-60"
                                        } ${
                                          st === "hadir"
                                            ? "border-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                            : st === "izin"
                                            ? "border-amber-300 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                            : st === "tidak-hadir"
                                            ? "border-rose-300 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400"
                                        }`}
                                        aria-label="Ubah status kehadiran"
                                      >
                                        {st === "hadir" ? "✓" : st === "izin" ? "~" : st === "tidak-hadir" ? "✗" : ""}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-2 text-left border-b border-slate-200 dark:border-slate-700">Nama</th>
                            <th className="px-4 py-2 text-center border-b border-slate-200 dark:border-slate-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberNames.map((name) => {
                            const rec = records.find((r) => r.memberName === name);
                            const st = rec?.status ?? null;
                            const fineAmount = rec?.fineAmount;
                            return (
                              <tr key={name} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{name}</td>
                                <td className="px-4 py-2 text-center">
                                  {st === "denda" ? (
                                    <button
                                      type="button"
                                      onClick={() => userCanEditAttendance && handleOpenAttendanceStatus(allProfiles.find((p) => p.full_name === name)?.id ?? "", name, st, fineAmount)}
                                      disabled={!userCanEditAttendance}
                                      className={`text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400 transition ${userCanEditAttendance ? "hover:text-rose-800 cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                                    >
                                      {fineAmount ? `Rp ${fineAmount.toLocaleString("id-ID")}` : "Denda"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => userCanEditAttendance && handleOpenAttendanceStatus(allProfiles.find((p) => p.full_name === name)?.id ?? "", name, st)}
                                      disabled={!userCanEditAttendance}
                                      className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition ${
                                        userCanEditAttendance ? "hover:scale-110 cursor-pointer" : "cursor-not-allowed opacity-60"
                                      } ${
                                        st === "hadir"
                                          ? "border-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                          : st === "izin"
                                          ? "border-amber-300 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                          : st === "tidak-hadir"
                                          ? "border-rose-300 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400"
                                      }`}
                                      aria-label="Ubah status kehadiran"
                                    >
                                      {st === "hadir" ? "✓" : st === "izin" ? "~" : st === "tidak-hadir" ? "✗" : ""}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        </div>
      </div>

      {/* Modal status kehadiran untuk tab absensi */}
      <Modal
        open={openAttendanceStatusModal}
        title={activeAttendanceMemberName ? `Kehadiran — ${activeAttendanceMemberName}` : "Status Kehadiran"}
        onClose={() => {
          setOpenAttendanceStatusModal(false);
          setActiveAttendanceProfileId(null);
          setActiveAttendanceMemberName(null);
          setActiveAttendanceStatus(null);
          setActiveAttendanceFineAmount(undefined);
          setActiveAttendanceSessionId(null);
          setAttendanceFineInput("");
          setShowAttendanceFineInput(false);
        }}
      >
        <div className="grid gap-2">
          {(
            [
              {
                status: "hadir" as const,
                label: "Hadir",
                desc: "Anggota hadir dalam kegiatan ini",
                color: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
              },
              {
                status: "izin" as const,
                label: "Izin",
                desc: "Anggota tidak hadir dengan keterangan",
                color: "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30",
              },
              {
                status: "tidak-hadir" as const,
                label: "Tidak Hadir",
                desc: "Anggota tidak hadir tanpa keterangan",
                color: "border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30",
              },
            ]
          ).map(({ status, label, desc, color }) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setShowAttendanceFineInput(false);
                handleSetAttendanceStatus(status);
              }}
              className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition ${
                activeAttendanceStatus === status
                  ? color
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${activeAttendanceStatus === status ? color : "border-slate-300 text-slate-400"}`}>
                {status === "hadir" ? "✓" : status === "izin" ? "~" : "✗"}
              </span>
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{desc}</div>
              </div>
              {activeAttendanceStatus === status && <span className="ml-auto text-xs font-medium">Aktif</span>}
            </button>
          ))}

          {/* Denda */}
          <div className={`rounded-lg border-2 transition ${
            activeAttendanceStatus === "denda"
              ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          }`}>
            <button
              type="button"
              onClick={() => setShowAttendanceFineInput((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                activeAttendanceStatus === "denda"
                  ? "border-orange-400 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                  : "border-slate-300 text-slate-400"
              }`}>
                Rp
              </span>
              <div className="flex-1">
                <div className={`text-sm font-medium ${activeAttendanceStatus === "denda" ? "text-orange-700 dark:text-orange-300" : "text-slate-700 dark:text-slate-300"}`}>
                  Denda
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {activeAttendanceStatus === "denda" && activeAttendanceFineAmount
                    ? `Rp ${activeAttendanceFineAmount.toLocaleString("id-ID")}`
                    : "Masukkan nominal denda"}
                </div>
              </div>
              {activeAttendanceStatus === "denda" && <span className="ml-auto text-xs font-medium text-orange-600 dark:text-orange-400">Aktif</span>}
            </button>

            {/* Input nominal denda */}
            {showAttendanceFineInput && (
              <div className="border-t border-slate-200 dark:border-slate-700 px-4 pb-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={attendanceFineInput ? Number(attendanceFineInput).toLocaleString("id-ID") : ""}
                      onChange={(e) => setAttendanceFineInput(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!attendanceFineInput || Number(attendanceFineInput) <= 0}
                    onClick={() => handleSetAttendanceStatus("denda", Number(attendanceFineInput))}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40 transition"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tombol Hapus */}
          {activeAttendanceStatus !== null && (
            <button
              type="button"
              onClick={handleDeleteAttendanceStatus}
              className="mt-2 w-full rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Hapus (Kosongkan Status)
            </button>
          )}
        </div>
      </Modal>

      {/* Modal atur kolom template — wajib sebelum buat sub-buku pertama */}
      <Modal
        open={openTemplateColumnModal}
        title="Ubah Nama & Tipe Kolom"
        onClose={() => setOpenTemplateColumnModal(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Kolom 1</div>
            <Input
              placeholder="Contoh: Nama Anggota"
              value={tmplHeaderLabel}
              onChange={(e) => setTmplHeaderLabel(e.target.value)}
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">Tipe:</label>
              <select
                value={tmplHeaderType}
                onChange={(e) => setTmplHeaderType(e.target.value as KolektifColumnType)}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
                <option value="date">Tanggal</option>
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Kolom 2</div>
            <Input
              placeholder="Contoh: Nominal"
              value={tmplNominalLabel}
              onChange={(e) => setTmplNominalLabel(e.target.value)}
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">Tipe:</label>
              <select
                value={tmplNominalType}
                onChange={(e) => setTmplNominalType(e.target.value as KolektifColumnType)}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Kolom 3</div>
            <Input
              placeholder="Contoh: Keterangan"
              value={tmplNoteLabel}
              onChange={(e) => setTmplNoteLabel(e.target.value)}
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">Tipe:</label>
              <select
                value={tmplNoteType}
                onChange={(e) => setTmplNoteType(e.target.value as KolektifColumnType)}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
                <option value="date">Tanggal</option>
              </select>
            </div>
          </div>

          {/* Kolom Tambahan */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Kolom Tambahan</span>
              <button
                type="button"
                onClick={() => {
                  setTmplEditingColId(null);
                  setTmplNewColLabel("");
                  setTmplNewColType("text");
                  setOpenTmplAddColModal(true);
                }}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M5 12h14"/><path d="M12 5v14"/>
                </svg>
                Tambah
              </button>
            </div>
            {tmplExtraCols.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Belum ada kolom tambahan</div>
            ) : (
              <div className="grid gap-2">
                {tmplExtraCols.map((col) => (
                  <div key={col.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{col.label}</span>
                      <span className="text-[10px] uppercase text-slate-400 dark:text-slate-500 shrink-0">
                        {col.columnType === "number" ? "Angka" : col.columnType === "date" ? "Tanggal" : "Text"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setTmplEditingColId(col.id);
                          setTmplNewColLabel(col.label);
                          setTmplNewColType(col.columnType);
                          setOpenTmplAddColModal(true);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTmplExtraCols((prev) => prev.filter((c) => c.id !== col.id))}
                        className="rounded p-1 text-rose-400 hover:text-rose-600"
                        title="Hapus"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
            <Button variant="secondary" onClick={() => setOpenTemplateColumnModal(false)}>Batal</Button>
            <Button onClick={saveTemplateAndContinue} disabled={saving}>
              {saving ? "Menyimpan..." : "Lanjut →"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sub-modal tambah/edit kolom tambahan untuk template */}
      <Modal
        open={openTmplAddColModal}
        title={tmplEditingColId ? "Edit Kolom" : "Tambah Kolom"}
        onClose={() => setOpenTmplAddColModal(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Kolom</div>
            <Input
              placeholder="Contoh: Alamat"
              value={tmplNewColLabel}
              onChange={(e) => setTmplNewColLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tmplNewColLabel.trim()) {
                  if (tmplEditingColId) {
                    setTmplExtraCols((prev) => prev.map((c) => c.id === tmplEditingColId ? { ...c, label: tmplNewColLabel.trim(), columnType: tmplNewColType } : c));
                  } else {
                    setTmplExtraCols((prev) => [...prev, { id: `tmp-${Date.now()}`, label: tmplNewColLabel.trim(), columnType: tmplNewColType }]);
                  }
                  setOpenTmplAddColModal(false);
                }
              }}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Tipe</div>
            <select
              value={tmplNewColType}
              onChange={(e) => setTmplNewColType(e.target.value as KolektifColumnType)}
              className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
            >
              <option value="text">Text</option>
              <option value="number">Angka/Uang</option>
              <option value="date">Tanggal</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenTmplAddColModal(false)}>Batal</Button>
            <Button
              onClick={() => {
                if (!tmplNewColLabel.trim()) return;
                if (tmplEditingColId) {
                  setTmplExtraCols((prev) => prev.map((c) => c.id === tmplEditingColId ? { ...c, label: tmplNewColLabel.trim(), columnType: tmplNewColType } : c));
                } else {
                  setTmplExtraCols((prev) => [...prev, { id: `tmp-${Date.now()}`, label: tmplNewColLabel.trim(), columnType: tmplNewColType }]);
                }
                setOpenTmplAddColModal(false);
              }}
              disabled={!tmplNewColLabel.trim()}
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal pilih activity untuk di-link */}
      <Modal open={openAddActivityModal} title="Tambah Absensi" onClose={() => setOpenAddActivityModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih kegiatan absensi yang ingin dihubungkan:</p>
          {allActivities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
              Tidak ada kegiatan absensi yang tersedia.
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-auto">
              {allActivities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleLinkActivity(a.id)}
                  disabled={saving}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{a.name}</div>
                    <div className="text-xs text-slate-400">{a.type === "rutin" ? "Rutinan" : "Sekali"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenAddActivityModal(false)}>Batal</Button>
          </div>
        </div>
      </Modal>

      {/* Modal unlink activity */}
      <Modal open={openUnlinkActivityModal} title="Lepas Absensi" onClose={() => setOpenUnlinkActivityModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Lepas link kegiatan <span className="font-semibold text-slate-900 dark:text-white">"{linkedActivities.find((a) => a.id === selectedLinkedActivityId)?.name}"</span> dari buku kolektif ini?
          </p>
          <p className="text-xs text-slate-400">Data absensi tidak akan terhapus, hanya lepas link-nya.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenUnlinkActivityModal(false)}>Batal</Button>
            <button
              type="button"
              onClick={handleUnlinkActivity}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? "Melepas..." : "Lepas"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal info/rename label tab absensi */}
      <Modal
        open={openLinkedActivityModal}
        title={linkedActivities.find((a) => a.id === selectedLinkedActivityId)?.name ?? "Absensi"}
        onClose={() => setOpenLinkedActivityModal(false)}
      >
        <div className="grid gap-4">
          {userCanEdit && (
            <div className="grid gap-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Label Tab</div>
              <div className="flex gap-2">
                <Input
                  value={renameLinkedActivityTabInput}
                  onChange={(e) => setRenameLinkedActivityTabInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameLinkedActivityTab()}
                  placeholder={linkedActivities.find((a) => a.id === selectedLinkedActivityId)?.name ?? ""}
                  className="flex-1"
                />
                <Button
                  onClick={handleRenameLinkedActivityTab}
                  disabled={!renameLinkedActivityTabInput.trim() || saving}
                >
                  {saving ? "..." : "Simpan"}
                </Button>
              </div>
              <div className="text-xs text-slate-400">
                Nama asli: <span className="font-medium text-slate-600 dark:text-slate-300">{linkedActivities.find((a) => a.id === selectedLinkedActivityId)?.name}</span>
              </div>
            </div>
          )}
          {userCanEdit && (
            <div className="flex justify-between items-center pt-1 border-t dark:border-slate-700">
              <span className="text-xs text-slate-400">Terhubung ke buku kolektif ini</span>
              <button
                type="button"
                onClick={() => {
                  setOpenLinkedActivityModal(false);
                  setTimeout(() => setOpenUnlinkActivityModal(true), 150);
                }}
                className="text-sm text-rose-500 hover:text-rose-700 font-medium"
              >
                Lepas dari kolektif
              </button>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setOpenLinkedActivityModal(false);
                navigate(`/absensi/${selectedLinkedActivityId}`, {
                  state: {
                    backTo: `/buku-kas-kolektif/${safeBookId}`,
                    backToState: {
                      autoTab: "absensi",
                      selectedLinkedActivityId,
                    },
                  },
                });
              }}
              className="text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-medium"
            >
              Buka Halaman Absensi
            </button>
            <Button variant="secondary" onClick={() => setOpenLinkedActivityModal(false)}>Tutup</Button>
          </div>
        </div>
      </Modal>

      {/* Modal tambah sub-buku */}
      <Modal open={openAddModal} title="Tambah Sub-buku" onClose={() => setOpenAddModal(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Nama Sub-buku
            </div>
            <Input
              placeholder="Contoh: Rabu, Kamis, Minggu 1..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddModal(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || saving}>
              {saving ? "Menyimpan..." : "Tambah"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal rename sub-buku */}
      <Modal open={openRenameModal} title="Rename Sub-buku" onClose={() => setOpenRenameModal(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Nama Baru
            </div>
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenRenameModal(false)}>Batal</Button>
            <Button onClick={handleRename} disabled={!renameInput.trim() || saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal hapus sub-buku */}
      <Modal open={openDeleteModal} title="Hapus Sub-buku" onClose={() => setOpenDeleteModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus sub-buku{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{deletingSession?.name}"
            </span>
            ? Semua data di dalamnya akan ikut terhapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenDeleteModal(false)}>Batal</Button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? "Menghapus..." : "Hapus"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal pilih tipe buku yang akan ditambah */}
      <Modal open={openAddTypeModal} title="Tambah Tab Buku" onClose={() => setOpenAddTypeModal(false)}>
        <div className="grid gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih jenis buku yang ingin dihubungkan:</p>
          <button
            type="button"
            onClick={() => { setOpenAddTypeModal(false); openAddBookModalFn(); }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Buku Transaksi</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tampilkan tabel transaksi masuk/keluar</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setOpenAddTypeModal(false); openAddKolektifBookModalFn(); }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Buku Kolektif</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tampilkan daftar sub-buku kolektif</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setOpenAddTypeModal(false); openAddRoutineBookModalFn(); }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Buku Rutinan</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tampilkan link ke buku rutinan</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setOpenAddTypeModal(false); openAddActivityModalFn(); }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Absensi</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tampilkan link ke kegiatan absensi</div>
            </div>
          </button>
        </div>
      </Modal>

      {/* Modal tambah buku kolektif */}
      <Modal open={openAddKolektifBookModal} title="Tambah Buku Kolektif" onClose={() => setOpenAddKolektifBookModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pilih buku kolektif yang sudah dibuat untuk dihubungkan ke sini.
          </p>
          {availableKolektifBooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
              Tidak ada buku kolektif yang tersedia.
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-auto">
              {availableKolektifBooks.map((b) => (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    selectedKolektifBookId === b.id
                      ? "border-slate-900 bg-slate-50 dark:border-slate-400 dark:bg-slate-700"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="linked-kolektif-book"
                    value={b.id}
                    checked={selectedKolektifBookId === b.id}
                    onChange={() => setSelectedKolektifBookId(b.id)}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{b.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddKolektifBookModal(false)}>Batal</Button>
            <Button
              onClick={handleLinkKolektifBook}
              disabled={!selectedKolektifBookId || availableKolektifBooks.length === 0 || saving}
            >
              {saving ? "Menghubungkan..." : "Hubungkan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal tambah buku transaksi */}
      <Modal open={openAddBookModal} title="Tambah Buku Transaksi" onClose={() => setOpenAddBookModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pilih buku transaksi yang sudah dibuat untuk dihubungkan ke buku kolektif ini.
          </p>
          {availableBooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
              Tidak ada buku transaksi yang tersedia.
              <br />
              Buat dulu buku transaksi biasa dari halaman Buku Kas.
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-auto">
              {availableBooks.map((b) => (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    selectedBookId === b.id
                      ? "border-slate-900 bg-slate-50 dark:border-slate-400 dark:bg-slate-700"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="linked-book"
                    value={b.id}
                    checked={selectedBookId === b.id}
                    onChange={() => setSelectedBookId(b.id)}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {b.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddBookModal(false)}>Batal</Button>
            <Button
              onClick={handleLinkBook}
              disabled={!selectedBookId || availableBooks.length === 0 || saving}
            >
              {saving ? "Menghubungkan..." : "Hubungkan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal konfirmasi unlink */}
      <Modal open={openUnlinkModal} title="Lepas Buku Transaksi" onClose={() => setOpenUnlinkModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Lepas buku{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{unlinkingBook?.name}"
            </span>{" "}
            dari buku kolektif ini? Data transaksi tidak akan terhapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenUnlinkModal(false)}>Batal</Button>
            <button
              type="button"
              onClick={handleUnlink}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? "Melepas..." : "Lepas"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal info buku transaksi aktif (akses via klik nama tab) */}
      <Modal
        open={openLinkedBookModal}
        title={linkedBooks.find((b) => b.id === selectedLinkedBookId)?.name ?? "Buku Transaksi"}
        onClose={() => setOpenLinkedBookModal(false)}
      >
        <div className="grid gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Saldo:{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatIDR(linkedBookTotals[selectedLinkedBookId ?? ""] ?? 0)}
            </span>
          </p>

          {/* Tombol buka halaman lengkap */}
          <button
            type="button"
            onClick={() => {
              setOpenLinkedBookModal(false);
              navigate(`/buku-kas/${selectedLinkedBookId}`, {
                state: {
                  backTo: `/buku-kas-kolektif/${safeBookId}`,
                  backToState: {
                    autoTab: "transaksi",
                    selectedLinkedBookId,
                  },
                },
              });
            }}
            className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
              </svg>
              <span>Dashboard, Laporan &amp; Saldo Rekening</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-400">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* Ganti label tab — hanya admin */}
          {userCanEdit && (
            <div className="grid gap-1.5 pt-1 border-t dark:border-slate-700">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Label Tab</div>
              <div className="flex gap-2">
                <Input
                  value={renameLinkedTabInput}
                  onChange={(e) => setRenameLinkedTabInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameLinkedTab()}
                  placeholder={linkedBooks.find((b) => b.id === selectedLinkedBookId)?.name ?? ""}
                  className="flex-1"
                />
                <Button
                  onClick={handleRenameLinkedTab}
                  disabled={!renameLinkedTabInput.trim() || saving}
                >
                  {saving ? "..." : "Simpan"}
                </Button>
              </div>
              <div className="text-xs text-slate-400">
                Nama asli: <span className="font-medium text-slate-600 dark:text-slate-300">{linkedBooks.find((b) => b.id === selectedLinkedBookId)?.name}</span>
              </div>
            </div>
          )}

          {userCanEdit && (
            <div className="flex justify-between items-center pt-1 border-t dark:border-slate-700">
              <span className="text-xs text-slate-400">Terhubung ke buku kolektif ini</span>
              <button
                type="button"
                onClick={() => {
                  const book = linkedBooks.find((b) => b.id === selectedLinkedBookId);
                  if (book) {
                    setUnlinkingBook(book);
                    setOpenLinkedBookModal(false);
                    setTimeout(() => setOpenUnlinkModal(true), 150);
                  }
                }}
                className="text-sm text-rose-500 hover:text-rose-700 font-medium"
              >
                Lepas dari kolektif
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenLinkedBookModal(false)}>Tutup</Button>
          </div>
        </div>
      </Modal>

      {/* Modal info buku kolektif yang di-link (klik tab aktif) */}
      <Modal
        open={openLinkedKolektifModal}
        title={linkedKolektifBooks.find((b) => b.id === selectedLinkedKolektifBookId)?.name ?? "Buku Kolektif"}
        onClose={() => setOpenLinkedKolektifModal(false)}
      >
        <div className="grid gap-4">
          {userCanEdit && (
            <button
              type="button"
              onClick={() => {
                setNewLinkedSubName("");
                setOpenLinkedKolektifModal(false);
                setTimeout(() => setOpenAddLinkedSubModal(true), 150);
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-xl font-light">+</div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">Tambah Sub-buku</span>
            </button>
          )}
          {/* HIDDEN: Tombol buka halaman lengkap — disembunyikan, jangan dihapus
          <button
            type="button"
            onClick={() => {
              setOpenLinkedKolektifModal(false);
              navigate(`/buku-kas-kolektif/${selectedLinkedKolektifBookId}`, { state: { autoTab: true } });
            }}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-white">Buka halaman lengkap</span>
          </button>
          */}
          {userCanEdit && (
            <div className="flex justify-between items-center pt-1 border-t dark:border-slate-700">
              <span className="text-xs text-slate-400">Terhubung ke buku kolektif ini</span>
              <button
                type="button"
                onClick={() => {
                  setOpenLinkedKolektifModal(false);
                  setTimeout(() => setOpenUnlinkKolektifModal(true), 150);
                }}
                className="text-sm text-rose-500 hover:text-rose-700 font-medium"
              >
                Lepas dari kolektif
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenLinkedKolektifModal(false)}>Tutup</Button>
          </div>
        </div>
      </Modal>

      {/* Modal tambah sub-buku untuk linked kolektif book */}
      <Modal open={openAddLinkedSubModal} title="Tambah Sub-buku" onClose={() => setOpenAddLinkedSubModal(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Sub-buku</div>
            <Input
              placeholder="Contoh: Rabu, Kamis, Minggu 1..."
              value={newLinkedSubName}
              onChange={(e) => setNewLinkedSubName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLinkedSub()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddLinkedSubModal(false)}>Batal</Button>
            <Button onClick={handleAddLinkedSub} disabled={!newLinkedSubName.trim() || saving}>
              {saving ? "Menyimpan..." : "Tambah"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal konfirmasi unlink buku kolektif */}
      <Modal open={openUnlinkKolektifModal} title="Lepas Buku Kolektif" onClose={() => setOpenUnlinkKolektifModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Lepas buku{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{linkedKolektifBooks.find((b) => b.id === selectedLinkedKolektifBookId)?.name}"
            </span>{" "}
            dari buku kolektif ini? Data sub-buku tidak akan terhapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenUnlinkKolektifModal(false)}>Batal</Button>
            <button
              type="button"
              onClick={handleUnlinkKolektif}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? "Melepas..." : "Lepas"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal tambah buku rutinan */}
      <Modal open={openAddRoutineBookModal} title="Tambah Buku Rutinan" onClose={() => setOpenAddRoutineBookModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pilih buku rutinan yang sudah dibuat untuk dihubungkan ke sini.
          </p>
          {availableRoutineBooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
              Tidak ada buku rutinan yang tersedia.
              <br />
              Buat dulu buku rutinan dari halaman Buku Kas.
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-auto">
              {availableRoutineBooks.map((b) => (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    selectedRoutineBookId === b.id
                      ? "border-slate-900 bg-slate-50 dark:border-slate-400 dark:bg-slate-700"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="linked-routine-book"
                    value={b.id}
                    checked={selectedRoutineBookId === b.id}
                    onChange={() => setSelectedRoutineBookId(b.id)}
                    className="h-4 w-4 accent-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{b.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddRoutineBookModal(false)}>Batal</Button>
            <Button
              onClick={handleLinkRoutineBook}
              disabled={!selectedRoutineBookId || availableRoutineBooks.length === 0 || saving}
            >
              {saving ? "Menghubungkan..." : "Hubungkan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal info buku rutinan yang di-link */}
      <Modal
        open={openLinkedRoutineModal}
        title={linkedRoutineBooks.find((b) => b.id === selectedLinkedRoutineBookId)?.name ?? "Buku Rutinan"}
        onClose={() => setOpenLinkedRoutineModal(false)}
      >
        <div className="grid gap-4">
          {/* Ganti label tab — hanya admin */}
          {userCanEdit && (
            <div className="grid gap-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Label Tab</div>
              <div className="flex gap-2">
                <Input
                  value={renameLinkedRoutineTabInput}
                  onChange={(e) => setRenameLinkedRoutineTabInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameRoutineTab()}
                  placeholder={linkedRoutineBooks.find((b) => b.id === selectedLinkedRoutineBookId)?.name ?? ""}
                  className="flex-1"
                />
                <Button
                  onClick={handleRenameRoutineTab}
                  disabled={!renameLinkedRoutineTabInput.trim() || saving}
                >
                  {saving ? "..." : "Simpan"}
                </Button>
              </div>
              <div className="text-xs text-slate-400">
                Nama asli: <span className="font-medium text-slate-600 dark:text-slate-300">{linkedRoutineBooks.find((b) => b.id === selectedLinkedRoutineBookId)?.name}</span>
              </div>
            </div>
          )}

          {userCanEdit && (
            <div className="flex justify-between items-center pt-1 border-t dark:border-slate-700">
              <span className="text-xs text-slate-400">Terhubung ke buku kolektif ini</span>
              <button
                type="button"
                onClick={() => {
                  setOpenLinkedRoutineModal(false);
                  setTimeout(() => setOpenUnlinkRoutineModal(true), 150);
                }}
                className="text-sm text-rose-500 hover:text-rose-700 font-medium"
              >
                Lepas dari kolektif
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenLinkedRoutineModal(false)}>Tutup</Button>
          </div>
        </div>
      </Modal>

      {/* Modal konfirmasi unlink buku rutinan */}
      <Modal open={openUnlinkRoutineModal} title="Lepas Buku Rutinan" onClose={() => setOpenUnlinkRoutineModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Lepas buku{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{linkedRoutineBooks.find((b) => b.id === selectedLinkedRoutineBookId)?.name}"
            </span>{" "}
            dari buku kolektif ini? Data rutinan tidak akan terhapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenUnlinkRoutineModal(false)}>Batal</Button>
            <button
              type="button"
              onClick={handleUnlinkRoutine}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? "Melepas..." : "Lepas"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal rename label tab kolektif */}
      <Modal
        open={openRenameKolektifModal}
        title="Ganti Label Tab"
        onClose={() => setOpenRenameKolektifModal(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Nama Baru
            </div>
            <Input
              value={renameKolektifInput}
              onChange={(e) => setRenameKolektifInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameKolektif()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setOpenRenameKolektifModal(false);
                requireColumnSetup("tabungan");
              }}
            >
              Mode Tabungan
            </Button>
            <Button variant="secondary" onClick={() => setOpenRenameKolektifModal(false)}>Batal</Button>
            <Button onClick={handleRenameKolektif} disabled={!renameKolektifInput.trim() || saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal mode tabungan */}
      <Modal
        open={openModeTabunganModal}
        title="Mode Tabungan"
        onClose={() => setOpenModeTabunganModal(false)}
      >
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pilih anggota untuk membuat sub buku sesuai nama mereka.
          </p>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 border dark:border-slate-700 rounded-lg p-3">
            {profiles.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">
                Belum ada user yang terdaftar.
              </div>
            ) : (
              [...profiles]
                .sort((a, b) => a.full_name.localeCompare(b.full_name, "id"))
                .map((profile) => {
                  const isChecked = selectedProfileIds.has(profile.id);
                  return (
                    <label
                      key={profile.id}
                      className="flex items-center gap-3 rounded-lg border dark:border-slate-700 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setSelectedProfileIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(profile.id);
                            } else {
                              next.delete(profile.id);
                            }
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {profile.full_name}
                      </span>
                    </label>
                  );
                })
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenModeTabunganModal(false)}
            >
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (selectedProfileIds.size === 0) return;
                setSaving(true);
                try {
                  // Buat sub buku untuk setiap user yang dipilih
                  const selectedProfiles = profiles.filter((p) => selectedProfileIds.has(p.id));
                  // Gunakan session pertama (template) sebagai acuan kolom
                  const templateSession = sessions[0] ?? null;
                  for (const prof of selectedProfiles) {
                    const newSession = await addKolektifSession(safeBookId, prof.full_name, prof.id);
                    if (templateSession) {
                      await copyKolektifConfig(templateSession.id, newSession.id);
                    }
                  }
                  await refresh();
                  setOpenModeTabunganModal(false);
                } catch (e) {
                  console.error("Gagal membuat sub buku:", e);
                  alert("Gagal membuat sub buku: " + (e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={selectedProfileIds.size === 0 || saving}
            >
              {saving ? "Membuat..." : "Buat Sub Buku"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

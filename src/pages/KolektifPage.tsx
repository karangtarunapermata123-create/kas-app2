import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import TransactionsPage from "./TransactionsPage";
import { useAuth, canEditBook } from "../lib/auth";
import {
  getKolektifSessions,
  addKolektifSession,
  renameKolektifSession,
  deleteKolektifSession,
  getKolektifConfig,
  getBooks,
  getTransactions,
  getKolektifLinkedBooks,
  linkBookToKolektif,
  unlinkBookFromKolektif,
  renameBook,
  saveBookTabLabel,
} from "../lib/store";
import { formatIDR } from "../lib/money";
import type { Book, KolektifSession } from "../lib/types";

export default function KolektifPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [userCanEdit, setUserCanEdit] = useState(false);

  if (!bookId) return null;
  const safeBookId = bookId;

  useEffect(() => {
    canEditBook(profile, safeBookId).then(setUserCanEdit);
  }, [profile, safeBookId]);

  // Tab state: "sub-buku" | "transaksi"
  const [activeTab, setActiveTab] = useState<"sub-buku" | "transaksi">("sub-buku");
  const [selectedLinkedBookId, setSelectedLinkedBookId] = useState<string | null>(null);

  // Nama buku kolektif ini (dari books.name)
  const [kolektifBookName, setKolektifBookName] = useState<string>("");
  // Label tab Sub-buku (dari books.tab_label, fallback ke kolektifBookName)
  const [kolektifTabLabel, setKolektifTabLabel] = useState<string>("");

  // Modal rename nama buku kolektif (via klik tab Sub-buku)
  const [openRenameKolektifModal, setOpenRenameKolektifModal] = useState(false);
  const [renameKolektifInput, setRenameKolektifInput] = useState("");

  // Modal info/aksi buku transaksi aktif
  const [openLinkedBookModal, setOpenLinkedBookModal] = useState(false);

  // State untuk field ganti label tab buku transaksi di modal info
  const [renameLinkedTabInput, setRenameLinkedTabInput] = useState("");

  const [sessions, setSessions] = useState<KolektifSession[]>([]);
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Linked transaction books
  const [linkedBooks, setLinkedBooks] = useState<Book[]>([]);
  const [linkedBookTotals, setLinkedBookTotals] = useState<Record<string, number>>({});
  // Label tab per linked book: bookId → label (tab_label ?? name)
  const [linkedBookTabLabels, setLinkedBookTabLabels] = useState<Record<string, string>>({});

  // Modal tambah sub-buku
  const [openAddModal, setOpenAddModal] = useState(false);
  const [newName, setNewName] = useState("");

  // Modal rename sub-buku
  const [openRenameModal, setOpenRenameModal] = useState(false);
  const [renamingSession, setRenamingSession] = useState<KolektifSession | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Modal hapus sub-buku
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deletingSession, setDeletingSession] = useState<KolektifSession | null>(null);

  // Modal tambah buku transaksi
  const [openAddBookModal, setOpenAddBookModal] = useState(false);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");

  // Modal hapus linked book
  const [openUnlinkModal, setOpenUnlinkModal] = useState(false);
  const [unlinkingBook, setUnlinkingBook] = useState<Book | null>(null);

  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const [list, linked, allBooks] = await Promise.all([
      getKolektifSessions(safeBookId),
      getKolektifLinkedBooks(safeBookId),
      getBooks(),
    ]);
    setSessions(list);
    setLinkedBooks(linked);
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

    // Load total per session
    const totals: Record<string, number> = {};
    await Promise.all(
      list.map(async (s) => {
        const cfg = await getKolektifConfig(s.id);
        totals[s.id] = cfg.rows.reduce((sum, r) => {
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

    // Set selected linked book jika belum ada
    setSelectedLinkedBookId((prev) => {
      if (prev && linked.some((b) => b.id === prev)) return prev;
      return linked[0]?.id ?? null;
    });
  };

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [safeBookId]);

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
  const grandTotal = subBukuGrandTotal + linkedGrandTotal;

  // ── Sub-buku handlers ────────────────────────────────────────────────────

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await addKolektifSession(safeBookId, name);
      await refresh();
      setNewName("");
      setOpenAddModal(false);
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

      {/* ── Card Total — compact strip ── */}
      {hasAny && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 overflow-x-auto scrollbar-hide">
          <div className="shrink-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Total</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatIDR(grandTotal)}
            </div>
          </div>
          {sessions.length > 0 && (
            <>
              <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
              <div className="shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="normal-case">{kolektifTabLabel || "Sub-buku"}</span> <span className="normal-case">({sessions.length})</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatIDR(subBukuGrandTotal)}
                </div>
              </div>
            </>
          )}
          {linkedBooks.length > 0 && (
            <>
              <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
              <div className="shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Transaksi <span className="normal-case">({linkedBooks.length})</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatIDR(linkedGrandTotal)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab bar + tombol + di samping kanan ── */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "sub-buku") {
                // Sudah aktif → buka modal rename label tab
                setRenameKolektifInput(kolektifTabLabel);
                setOpenRenameKolektifModal(true);
              } else {
                setActiveTab("sub-buku");
              }
            }}
            className={`px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "sub-buku"
                ? "bg-slate-900 dark:bg-slate-700 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
            title={activeTab === "sub-buku" ? "Klik untuk ganti nama" : ""}
          >
            {kolektifTabLabel || "Sub-buku"}
          </button>
          {linkedBooks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                if (activeTab === "transaksi" && selectedLinkedBookId === b.id) {
                  // Sudah aktif → buka modal info
                  setRenameLinkedTabInput(linkedBookTabLabels[b.id] ?? b.name);
                  setOpenLinkedBookModal(true);
                } else {
                  setSelectedLinkedBookId(b.id);
                  setActiveTab("transaksi");
                }
              }}
              className={`px-3 py-1.5 text-sm font-medium transition border-l dark:border-slate-700 max-w-[120px] truncate ${
                activeTab === "transaksi" && selectedLinkedBookId === b.id
                  ? "bg-slate-900 dark:bg-slate-700 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
              title={activeTab === "transaksi" && selectedLinkedBookId === b.id ? `${linkedBookTabLabels[b.id] ?? b.name} — klik untuk info` : (linkedBookTabLabels[b.id] ?? b.name)}
            >
              {linkedBookTabLabels[b.id] ?? b.name}
            </button>
          ))}
        </div>

        {/* Tombol + di samping tab */}
        {userCanEdit && (
          <button
            type="button"
            onClick={openAddBookModalFn}
            title="Tambah buku transaksi"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-lg font-light leading-none"
          >
            +
          </button>
        )}
      </div>

      {/* ── Tab: Sub-buku ── */}
      {activeTab === "sub-buku" && (
        <div ref={subBukuListRef} className="relative flex flex-col gap-3 flex-1 min-h-0 pb-16 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-6 py-12 text-center">
              <div className="text-slate-400 dark:text-slate-500 text-sm">
                Belum ada sub-buku.
                {userCanEdit ? ' Klik tombol + di kanan bawah untuk menambahkan.' : ""}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-y-auto max-h-[55vh]">
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
              onClick={() => { setNewName(""); setOpenAddModal(true); }}
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

      {/* ── Tab: Buku Transaksi ── */}
      {activeTab === "transaksi" && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {linkedBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-6 py-12 text-center">
              <div className="text-slate-400 dark:text-slate-500 text-sm">
                Belum ada buku transaksi.
                {userCanEdit ? ' Klik "+" untuk menambahkan.' : ""}
              </div>
            </div>
          ) : selectedLinkedBookId ? (
            <TransactionsPage key={selectedLinkedBookId} bookId={selectedLinkedBookId} mode="semua" />
          ) : null}
        </div>
      )}

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
              autoFocus
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
              autoFocus
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
              navigate(`/buku-kas/${selectedLinkedBookId}`);
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

          {/* Ganti label tab */}
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
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenRenameKolektifModal(false)}>Batal</Button>
            <Button onClick={handleRenameKolektif} disabled={!renameKolektifInput.trim() || saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

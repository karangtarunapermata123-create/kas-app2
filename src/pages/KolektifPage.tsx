import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import { useAuth, canEditBook } from "../lib/auth";
import {
  getKolektifSessions,
  addKolektifSession,
  renameKolektifSession,
  deleteKolektifSession,
  getKolektifConfig,
} from "../lib/store";
import { formatIDR } from "../lib/money";
import type { KolektifSession } from "../lib/types";

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

  const [sessions, setSessions] = useState<KolektifSession[]>([]);
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  // Modal tambah sub-buku
  const [openAddModal, setOpenAddModal] = useState(false);
  const [newName, setNewName] = useState("");

  // Modal rename sub-buku
  const [openRenameModal, setOpenRenameModal] = useState(false);
  const [renamingSession, setRenamingSession] =
    useState<KolektifSession | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Modal hapus sub-buku
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deletingSession, setDeletingSession] =
    useState<KolektifSession | null>(null);

  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const list = await getKolektifSessions(safeBookId);
    setSessions(list);
    // Load total per session
    const totals: Record<string, number> = {};
    await Promise.all(
      list.map(async (s) => {
        const cfg = await getKolektifConfig(s.id);
        totals[s.id] = cfg.rows.reduce((sum, r) => sum + r.amount, 0);
      }),
    );
    setSessionTotals(totals);
  };

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [safeBookId]);

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

  const grandTotal = sessions.reduce(
    (sum, s) => sum + (sessionTotals[s.id] ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <svg
          className="animate-spin h-6 w-6 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8z"
          />
        </svg>
        Memuat...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Header: total + tombol tambah */}
      <div className="flex items-center justify-between gap-3">
        {sessions.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 flex items-center gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Semua
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatIDR(grandTotal)}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sub-buku
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {sessions.length}
              </div>
            </div>
          </div>
        )}
        {userCanEdit && (
          <Button
            onClick={() => {
              setNewName("");
              setOpenAddModal(true);
            }}
          >
            + Sub-buku
          </Button>
        )}
      </div>

      {/* Daftar sub-buku */}
      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-6 py-12 text-center">
          <div className="text-slate-400 dark:text-slate-500 text-sm">
            Belum ada sub-buku.
            {userCanEdit ? ' Klik "+ Sub-buku" untuk menambahkan.' : ""}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {sessions.map((session, idx) => (
            <div
              key={session.id}
              className={`group flex items-center justify-between gap-3 bg-white dark:bg-slate-800 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${idx !== 0 ? "border-t border-slate-100 dark:border-slate-700" : ""}`}
            >
              {/* Klik nama → navigasi */}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/buku-kas-kolektif/${safeBookId}/sesi/${session.id}`,
                  )
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

              {/* Aksi */}
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
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

      {/* Modal tambah sub-buku */}
      <Modal
        open={openAddModal}
        title="Tambah Sub-buku"
        onClose={() => setOpenAddModal(false)}
      >
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
            <Button variant="secondary" onClick={() => setOpenAddModal(false)}>
              Batal
            </Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || saving}>
              {saving ? "Menyimpan..." : "Tambah"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal rename sub-buku */}
      <Modal
        open={openRenameModal}
        title="Rename Sub-buku"
        onClose={() => setOpenRenameModal(false)}
      >
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
            <Button
              variant="secondary"
              onClick={() => setOpenRenameModal(false)}
            >
              Batal
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameInput.trim() || saving}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal hapus sub-buku */}
      <Modal
        open={openDeleteModal}
        title="Hapus Sub-buku"
        onClose={() => setOpenDeleteModal(false)}
      >
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus sub-buku{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{deletingSession?.name}"
            </span>
            ? Semua data di dalamnya akan ikut terhapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenDeleteModal(false)}
            >
              Batal
            </Button>
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
    </div>
  );
}

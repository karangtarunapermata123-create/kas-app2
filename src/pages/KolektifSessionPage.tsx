import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import { useAuth, canEditBook } from "../lib/auth";
import {
  getKolektifConfig,
  updateKolektifLabels,
  addKolektifRow,
  updateKolektifRow,
  deleteKolektifRow,
} from "../lib/store";
import { formatIDR } from "../lib/money";
import type { KolektifConfig, KolektifRow } from "../lib/types";

export default function KolektifSessionPage() {
  const { bookId, sessionId } = useParams<{
    bookId: string;
    sessionId: string;
  }>();
  const { profile } = useAuth();
  const [userCanEdit, setUserCanEdit] = useState(false);

  if (!bookId || !sessionId) return null;
  const safeBookId = bookId;
  const safeSessionId = sessionId;

  useEffect(() => {
    canEditBook(profile, safeBookId).then(setUserCanEdit);
  }, [profile, safeBookId]);

  const [config, setConfig] = useState<KolektifConfig>({
    sessionId: safeSessionId,
    headerLabel: "Nama",
    nominalLabel: "Nominal",
    noteLabel: "Keterangan",
    headerLabelType: "text",
    nominalLabelType: "number",
    noteLabelType: "text",
    rows: [],
  });
  const [loading, setLoading] = useState(true);

  // Modal tambah/edit baris
  const [openRowModal, setOpenRowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<KolektifRow | null>(null);
  const [rowLabel, setRowLabel] = useState("");
  const [rowAmount, setRowAmount] = useState("");
  const [rowHeaderValue, setRowHeaderValue] = useState("");
  const [rowNoteValue, setRowNoteValue] = useState("");
  const [rowNote, setRowNote] = useState("");
  const [rowTxType, setRowTxType] = useState<"masuk" | "keluar">("masuk");

  // Modal edit header
  const [openHeaderModal, setOpenHeaderModal] = useState(false);
  const [headerInput, setHeaderInput] = useState("");
  const [nominalInput, setNominalInput] = useState("");
  const [noteHeaderInput, setNoteHeaderInput] = useState("");
  const [headerType, setHeaderType] = useState<"text" | "number">("text");
  const [nominalType, setNominalType] = useState<"text" | "number">("number");
  const [noteType, setNoteType] = useState<"text" | "number">("text");

  // Modal hapus
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState<KolektifRow | null>(null);

  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const cfg = await getKolektifConfig(safeSessionId);
    setConfig(cfg);
  };

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [safeSessionId]);

  // ── Row modal ──
  function openAddRow() {
    setEditingRow(null);
    setRowLabel("");
    setRowAmount("");
    setRowHeaderValue("");
    setRowNoteValue("");
    setRowNote("");
    setRowTxType("masuk");
    setOpenRowModal(true);
  }

  function openEditRow(row: KolektifRow) {
    setEditingRow(row);
    setRowLabel(row.label);
    setRowAmount(String(row.amount));
    setRowHeaderValue(String(row.headerValue ?? ""));
    if (config.noteLabelType === "number") {
      setRowNoteValue(String(row.noteValue ?? row.note ?? ""));
      setRowNote("");
    } else {
      setRowNoteValue("");
      setRowNote(row.note ?? "");
    }
    setRowTxType(row.txType ?? "masuk");
    setOpenRowModal(true);
  }

  async function saveRow() {
    const amount = Number(rowAmount.replace(/\D/g, "")) || 0;
    const headerValue = Number(rowHeaderValue.replace(/\D/g, "")) || 0;
    const noteValue = Number(rowNoteValue.replace(/\D/g, "")) || 0;
    
    setSaving(true);
    try {
      let label: string;
      let noteText: string | undefined;
      
      // Handle header column
      if (config.headerLabelType === "number") {
        label = String(headerValue);
      } else {
        label = rowLabel.trim();
        if (!label) {
          setSaving(false);
          return;
        }
      }
      
      // Handle note column
      if (config.noteLabelType === "number") {
        noteText = String(noteValue) || undefined;
      } else {
        noteText = rowNote.trim() || undefined;
      }
      
      if (editingRow) {
        await updateKolektifRow(
          editingRow.id,
          config.headerLabelType === "number" ? String(headerValue) : editingRow.label,
          amount,
          noteText,
          headerValue,
          noteValue,
          config.nominalLabelType === "number" ? rowTxType : undefined,
        );
      } else {
        await addKolektifRow(
          safeSessionId,
          safeBookId,
          label,
          amount,
          noteText,
          headerValue,
          noteValue,
          config.nominalLabelType === "number" ? rowTxType : undefined,
        );
      }
      await refresh();
      setOpenRowModal(false);
    } catch (error) {
      console.error("Error saving row:", error);
      alert("Gagal menyimpan data. Pastikan database sudah di-migrate: jalankan migration_add_kolektif_numeric_columns.sql");
    } finally {
      setSaving(false);
    }
  }

  // ── Header modal ──
  async function saveHeader() {
    setSaving(true);
    try {
      await updateKolektifLabels(safeSessionId, {
        headerLabel: headerInput,
        nominalLabel: nominalInput,
        noteLabel: noteHeaderInput,
        headerLabelType: headerType,
        nominalLabelType: nominalType,
        noteLabelType: noteType,
      });
      await refresh();
      setOpenHeaderModal(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
  async function doDelete() {
    if (!deletingRow) return;
    setSaving(true);
    try {
      await deleteKolektifRow(deletingRow.id);
      await refresh();
      setOpenDeleteModal(false);
      setDeletingRow(null);
    } finally {
      setSaving(false);
    }
  }

  const totalAmount = config.rows.reduce((s, r) => {
    let sum = s;
    if (config.headerLabelType === "number") {
      sum += (r.headerValue ?? (Number(r.label) || 0));
    }
    if (config.nominalLabelType === "number") {
      const sign = r.txType === "keluar" ? -1 : 1;
      sum += sign * r.amount;
    }
    if (config.noteLabelType === "number") {
      sum += (r.noteValue ?? (Number(r.note) || 0));
    }
    return sum;
  }, 0);

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
      {/* Header: total saldo */}
      <div className="flex items-center gap-3">
        {config.rows.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 flex items-center gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Saldo
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatIDR(totalAmount)}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Baris
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {config.rows.length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table
          className="w-full border-separate border-spacing-0 bg-white dark:bg-slate-800 text-sm"
          style={{ tableLayout: "fixed", minWidth: "480px" }}
        >
          <colgroup>
            <col style={{ width: userCanEdit ? "33%" : "40%" }} />
            <col style={{ width: userCanEdit ? "30%" : "30%" }} />
            <col style={{ width: "37%" }} />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left">
                <span>{config.headerLabel}</span>
              </th>
              <th className="border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left">
                <span>{config.nominalLabel}</span>
              </th>
              <th className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left">
                <div className="flex items-center justify-between">
                  <span>{config.noteLabel}</span>
                  {userCanEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderInput(config.headerLabel);
                        setNominalInput(config.nominalLabel);
                        setNoteHeaderInput(config.noteLabel);
                        setHeaderType(config.headerLabelType);
                        setNominalType(config.nominalLabelType);
                        setNoteType(config.noteLabelType);
                        setOpenHeaderModal(true);
                      }}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Ubah nama kolom"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {config.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={userCanEdit ? 4 : 3}
                  className="px-4 py-10 text-center text-slate-400 dark:text-slate-500 text-sm"
                >
                  Belum ada data.
                  {userCanEdit
                    ? ' Klik "+ Tambah" untuk menambahkan baris.'
                    : ""}
                </td>
              </tr>
            ) : (
              config.rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${userCanEdit ? "cursor-pointer" : ""}`}
                  onClick={userCanEdit ? () => openEditRow(row) : undefined}
                >
                  <td className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="truncate">
                        {config.headerLabelType === "number" 
                          ? (row.headerValue ? formatIDR(row.headerValue) : (row.label ? formatIDR(Number(row.label)) : "-"))
                          : row.label}
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-r border-slate-200 dark:border-slate-700 px-4 py-3 font-medium">
                    {config.nominalLabelType === "number" ? (
                      <span className={row.txType === "keluar" ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>
                        {row.txType === "keluar" ? "- " : ""}{formatIDR(row.amount)}
                      </span>
                    ) : (
                      String(row.amount)
                    )}
                  </td>
                  <td className="border-b border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-slate-500 dark:text-slate-400 truncate text-xs">
                    {config.noteLabelType === "number"
                      ? (row.noteValue ? formatIDR(row.noteValue) : (row.note ? formatIDR(Number(row.note)) : "-"))
                      : (row.note || "-")}
                  </td>
                  {userCanEdit && (
                    <td
                      className="border-b border-slate-200 dark:border-slate-700 px-2 py-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingRow(row);
                        setOpenDeleteModal(true);
                      }}
                    >
                      <button
                        type="button"
                        className="rounded p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
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
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FAB Tambah Baris */}
      {userCanEdit && (
        <button
          type="button"
          onClick={openAddRow}
          className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-6 z-50 md:bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-white shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition active:scale-95"
          title="Tambah Baris"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      )}

      {/* Modal tambah/edit baris */}
      <Modal
        open={openRowModal}
        title={editingRow ? "Edit Baris" : "Tambah Baris"}
        onClose={() => setOpenRowModal(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              {config.headerLabel}
            </div>
            {config.headerLabelType === "number" ? (
              <Input
                placeholder="Contoh: 50000"
                value={rowHeaderValue}
                onChange={(e) => setRowHeaderValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
                inputMode="numeric"
              />
            ) : (
              <Input
                placeholder="Contoh: Budi Santoso"
                value={rowLabel}
                onChange={(e) => setRowLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
                autoFocus
              />
            )}
            {config.headerLabelType === "number" && rowHeaderValue && Number(rowHeaderValue) > 0 && (
              <div className="mt-1 text-xs text-slate-500">
                {formatIDR(Number(rowHeaderValue))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              {config.nominalLabel}
            </div>
            {config.nominalLabelType === "number" && (
              <div className="mb-2 flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRowTxType("masuk")}
                  className={`flex-1 py-1.5 text-sm font-medium transition ${
                    rowTxType === "masuk"
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setRowTxType("keluar")}
                  className={`flex-1 py-1.5 text-sm font-medium transition border-l border-slate-200 dark:border-slate-700 ${
                    rowTxType === "keluar"
                      ? "bg-rose-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  Keluar
                </button>
              </div>
            )}
            <Input
              placeholder="Contoh: 50000"
              value={rowAmount}
              onChange={(e) => setRowAmount(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && saveRow()}
              inputMode="numeric"
            />
            {rowAmount && Number(rowAmount) > 0 && (
              <div className={`mt-1 text-xs font-medium ${rowTxType === "keluar" && config.nominalLabelType === "number" ? "text-rose-600" : "text-emerald-600"}`}>
                {rowTxType === "keluar" && config.nominalLabelType === "number" ? "- " : ""}{formatIDR(Number(rowAmount))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              {config.noteLabel}
            </div>
            {config.noteLabelType === "number" ? (
              <Input
                placeholder="Contoh: 50000"
                value={rowNoteValue}
                onChange={(e) => setRowNoteValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
                inputMode="numeric"
              />
            ) : (
              <input
                className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
                placeholder="Contoh: Budi dapat arisan"
                value={rowNote}
                onChange={(e) => setRowNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
              />
            )}
            {config.noteLabelType === "number" && rowNoteValue && Number(rowNoteValue) > 0 && (
              <div className="mt-1 text-xs text-slate-500">
                {formatIDR(Number(rowNoteValue))}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            {editingRow && userCanEdit && (
              <button
                type="button"
                onClick={() => {
                  setOpenRowModal(false);
                  setDeletingRow(editingRow);
                  setOpenDeleteModal(true);
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Hapus
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" onClick={() => setOpenRowModal(false)}>
                Batal
              </Button>
              <Button onClick={saveRow} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal edit header */}
      <Modal
        open={openHeaderModal}
        title="Ubah Nama & Tipe Kolom"
        onClose={() => setOpenHeaderModal(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Kolom 1
            </div>
            <Input
              placeholder="Contoh: Nama Anggota"
              value={headerInput}
              onChange={(e) => setHeaderInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveHeader()}
              autoFocus
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                Tipe:
              </label>
              <select
                value={headerType}
                onChange={(e) => setHeaderType(e.target.value as "text" | "number")}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Kolom 2
            </div>
            <Input
              placeholder="Contoh: Nominal"
              value={nominalInput}
              onChange={(e) => setNominalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveHeader()}
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                Tipe:
              </label>
              <select
                value={nominalType}
                onChange={(e) => setNominalType(e.target.value as "text" | "number")}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Kolom 3
            </div>
            <Input
              placeholder="Contoh: Keterangan"
              value={noteHeaderInput}
              onChange={(e) => setNoteHeaderInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveHeader()}
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                Tipe:
              </label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as "text" | "number")}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenHeaderModal(false)}
            >
              Batal
            </Button>
            <Button onClick={saveHeader} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal hapus baris */}
      <Modal
        open={openDeleteModal}
        title="Hapus Baris"
        onClose={() => setOpenDeleteModal(false)}
      >
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus baris{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{deletingRow?.label}"
            </span>
            ?
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
              onClick={doDelete}
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

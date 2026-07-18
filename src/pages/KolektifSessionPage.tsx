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
  addKolektifExtraColumn,
  updateKolektifExtraColumn,
  deleteKolektifExtraColumn,
  saveKolektifRowExtraValues,
} from "../lib/store";
import { formatIDR } from "../lib/money";
import type { KolektifConfig, KolektifColumnType, KolektifExtraColumn, KolektifRow } from "../lib/types";

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
    extraColumns: [],
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
  const [headerType, setHeaderType] = useState<KolektifColumnType>("text");
  const [nominalType, setNominalType] = useState<KolektifColumnType>("number");
  const [noteType, setNoteType] = useState<KolektifColumnType>("text");

  // Modal manage extra columns
  const [openExtraColumnsModal, setOpenExtraColumnsModal] = useState(false);
  const [editingExtraColumn, setEditingExtraColumn] = useState<KolektifExtraColumn | null>(null);
  const [extraColInput, setExtraColInput] = useState("");
  const [extraColType, setExtraColType] = useState<KolektifColumnType>("text");

  // Extra column values for row modal
  const [rowExtraValues, setRowExtraValues] = useState<Record<string, { value: string; txType: "masuk" | "keluar" }>>({});

  // Modal hapus
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState<KolektifRow | null>(null);
  // Modal hapus kolom tambahan
  const [openDeleteExtraColumnModal, setOpenDeleteExtraColumnModal] = useState(false);
  const [deletingExtraColumn, setDeletingExtraColumn] = useState<KolektifExtraColumn | null>(null);

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
    setRowExtraValues({});
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
    if (config.headerLabelType === "date") {
      setRowLabel(row.headerValue ? String(row.headerValue) : row.label);
    }
    setRowTxType(row.txType ?? "masuk");

    // Konversi extraValues untuk backward compatibility
    const convertedExtraValues: Record<string, { value: string; txType: "masuk" | "keluar" }> = {};
    if (row.extraValues) {
      for (const colId of Object.keys(row.extraValues)) {
        const val = row.extraValues[colId];
        if (typeof val === "string") {
          convertedExtraValues[colId] = { value: val, txType: "masuk" };
        } else {
          convertedExtraValues[colId] = { ...val, txType: val.txType ?? "masuk" };
        }
      }
    }
    setRowExtraValues(convertedExtraValues);
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
      let headerVal: number | undefined;
      
      // Handle header column
      if (config.headerLabelType === "number") {
        label = String(headerValue);
        headerVal = headerValue;
      } else if (config.headerLabelType === "date") {
        label = rowLabel.trim();
        headerVal = 0;
      } else {
        label = rowLabel.trim();
        headerVal = undefined;
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
          config.headerLabelType === "number" ? String(headerValue) : (config.headerLabelType === "date" ? rowLabel.trim() : editingRow.label),
          amount,
          noteText,
          config.headerLabelType === "number" ? headerValue : (config.headerLabelType === "date" ? 0 : undefined),
          config.noteLabelType === "number" ? noteValue : 0,
          config.nominalLabelType === "number" ? rowTxType : undefined,
        );
        // Save extra values
        if (config.extraColumns.length > 0) {
          await saveKolektifRowExtraValues(editingRow.id, rowExtraValues);
        }
      } else {
        const newRowId = await addKolektifRow(
          safeSessionId,
          safeBookId,
          label,
          amount,
          noteText,
          config.headerLabelType === "date" ? 0 : headerVal,
          config.noteLabelType === "number" ? noteValue : 0,
          config.nominalLabelType === "number" ? rowTxType : undefined,
        );
        // Save extra values for new row
        if (config.extraColumns.length > 0) {
          await saveKolektifRowExtraValues(newRowId, rowExtraValues);
        }
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

  // ── Extra columns modal ──
  function openAddExtraColumn() {
    setEditingExtraColumn(null);
    setExtraColInput("");
    setExtraColType("text");
    setOpenExtraColumnsModal(true);
  }

  function openEditExtraColumn(col: KolektifExtraColumn) {
    setEditingExtraColumn(col);
    setExtraColInput(col.label);
    setExtraColType(col.columnType);
    setOpenExtraColumnsModal(true);
  }

  async function saveExtraColumn() {
    const name = extraColInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (editingExtraColumn) {
        await updateKolektifExtraColumn(editingExtraColumn.id, name, extraColType);
      } else {
        await addKolektifExtraColumn(safeSessionId, name, extraColType);
      }
      await refresh();
      setOpenExtraColumnsModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExtraColumn(col: KolektifExtraColumn) {
    setDeletingExtraColumn(col);
    setOpenDeleteExtraColumnModal(true);
  }

  async function doDeleteExtraColumn() {
    if (!deletingExtraColumn) return;
    setSaving(true);
    try {
      await deleteKolektifExtraColumn(deletingExtraColumn.id);
      await refresh();
      setOpenDeleteExtraColumnModal(false);
      setDeletingExtraColumn(null);
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
    for (const col of config.extraColumns) {
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
        sum += Number.isFinite(val) ? sign * val : 0;
      }
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
      {/* Toolbar: stats + aksi kolom */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Statistik */}
        {config.rows.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 flex items-center gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400">{formatIDR(totalAmount)}</div>
            </div>
            <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Baris</div>
              <div className="font-bold text-slate-900 dark:text-white">{config.rows.length}</div>
            </div>
          </div>
        )}

        {/* Tombol atur kolom — hanya tampil untuk editor */}
        {userCanEdit && (
          <div className="flex items-center gap-2 ml-auto">
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
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
              </svg>
              Atur Kolom
            </button>
          </div>
        )}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: `${Math.max(480, 160 + 140 + 140 + config.extraColumns.length * 140)}px`, width: "100%" }}>
          <colgroup>
            {/* Kolom no + header: sticky, lebar cukup */}
            <col style={{ minWidth: "160px", width: "22%" }} />
            {/* Kolom nominal */}
            <col style={{ minWidth: "140px", width: "18%" }} />
            {/* Kolom note */}
            <col style={{ minWidth: "140px", width: "20%" }} />
            {/* Extra columns: fixed 140px each */}
            {config.extraColumns.map((col) => (
              <col key={col.id} style={{ minWidth: "140px", width: "140px" }} />
            ))}

          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left whitespace-nowrap">
                {config.headerLabel}
              </th>
              <th className="border-b border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-left whitespace-nowrap">
                {config.nominalLabel}
              </th>
              <th className={`border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-left whitespace-nowrap ${config.extraColumns.length > 0 ? "border-r" : ""}`}>
                {config.noteLabel}
              </th>
              {config.extraColumns.map((col, i) => (
                <th
                  key={col.id}
                  className={`border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-left whitespace-nowrap ${i < config.extraColumns.length - 1 || userCanEdit ? "border-r" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-[100px]">{col.label}</span>
                    {userCanEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExtraColumn(col);
                          setExtraColInput(col.label);
                          setExtraColType(col.columnType);
                          setOpenExtraColumnsModal(true);
                        }}
                        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition"
                        title={`Edit kolom "${col.label}"`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + config.extraColumns.length}
                  className="px-4 py-12 text-center text-slate-400 dark:text-slate-500"
                >
                  Belum ada data.
                  {userCanEdit ? ' Klik "+" untuk menambahkan baris.' : ""}
                </td>
              </tr>
            ) : (
              config.rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`group hover:bg-slate-50 dark:hover:bg-slate-700/40 ${userCanEdit ? "cursor-pointer" : ""}`}
                  onClick={userCanEdit ? () => openEditRow(row) : undefined}
                >
                  {/* Kolom header — sticky */}
                  <td className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/40 px-4 py-3 font-medium text-slate-900 dark:text-white transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0 tabular-nums">{idx + 1}.</span>
                      <span className="truncate max-w-[110px]">
                        {config.headerLabelType === "number"
                          ? (row.headerValue ? formatIDR(row.headerValue) : (row.label ? formatIDR(Number(row.label)) : "-"))
                          : row.label}
                      </span>
                    </div>
                  </td>
                  {/* Nominal */}
                  <td className="border-b border-r border-slate-200 dark:border-slate-700 px-4 py-3 font-medium tabular-nums">
                    {config.nominalLabelType === "number" ? (
                      <span className={row.txType === "keluar" ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>
                        {row.txType === "keluar" ? "−\u202f" : ""}{formatIDR(row.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300">{String(row.amount)}</span>
                    )}
                  </td>
                  {/* Note */}
                  <td className={`border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-slate-500 dark:text-slate-400 text-xs ${config.extraColumns.length > 0 ? "border-r" : ""}`}>
                    <span className="line-clamp-2">
                      {config.noteLabelType === "number"
                        ? (row.noteValue ? formatIDR(row.noteValue) : (row.note ? formatIDR(Number(row.note)) : "-"))
                        : (row.note || "-")}
                    </span>
                  </td>
                  {/* Extra columns */}
                  {config.extraColumns.map((col, i) => {
                    const extraVal = row.extraValues?.[col.id];
                    let displayVal: string = "-";
                    let colorClass: string = "text-slate-500 dark:text-slate-400";
                    let sign: string = "";

                    if (col.columnType === "number") {
                      let val: number = 0;
                      let txType: "masuk" | "keluar" = "masuk";
                      if (typeof extraVal === "string") {
                        val = Number(extraVal);
                      } else if (extraVal && typeof extraVal === "object") {
                        val = Number(extraVal.value);
                        txType = extraVal.txType || "masuk";
                      }
                      if (val > 0) {
                        displayVal = formatIDR(val);
                        colorClass = txType === "keluar" ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400";
                        sign = txType === "keluar" ? "−\u202f" : "";
                      }
                    } else {
                      if (typeof extraVal === "string") {
                        displayVal = extraVal || "-";
                      } else if (extraVal && typeof extraVal === "object") {
                        displayVal = extraVal.value || "-";
                      }
                    }

                    return (
                      <td
                        key={col.id}
                        className={`border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-xs font-medium tabular-nums ${i < config.extraColumns.length - 1 ? "border-r" : ""} ${colorClass}`}
                      >
                        <span className="line-clamp-2">
                          {sign}{displayVal}
                        </span>
                      </td>
                    );
                  })}
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
            ) : config.headerLabelType === "date" ? (
              <input
                type="date"
                className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
                value={rowLabel}
                onChange={(e) => setRowLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
              />
            ) : (
              <Input
                placeholder="Contoh: Budi Santoso"
                value={rowLabel}
                onChange={(e) => setRowLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
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
            ) : config.noteLabelType === "date" ? (
              <input
                type="date"
                className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
                value={rowNote}
                onChange={(e) => setRowNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRow()}
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
          {/* Extra column inputs */}
          {config.extraColumns.map((col) => (
            <div key={col.id}>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                {col.label}
              </div>
              {col.columnType === "date" ? (
                <input
                  type="date"
                  className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
                  value={rowExtraValues[col.id]?.value || ""}
                  onChange={(e) => setRowExtraValues((prev) => ({ 
                    ...prev, 
                    [col.id]: { 
                      value: e.target.value, 
                      txType: prev[col.id]?.txType || "masuk" 
                    } 
                  }))}
                />
              ) : col.columnType === "number" ? (
                <>
                  <div className="mb-2 flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setRowExtraValues((prev) => ({ 
                        ...prev, 
                        [col.id]: { 
                          value: prev[col.id]?.value || "", 
                          txType: "masuk" 
                        } 
                      }))}
                      className={`flex-1 py-1.5 text-sm font-medium transition ${
                        (rowExtraValues[col.id]?.txType || "masuk") === "masuk"
                          ? "bg-emerald-600 text-white"
                          : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setRowExtraValues((prev) => ({ 
                        ...prev, 
                        [col.id]: { 
                          value: prev[col.id]?.value || "", 
                          txType: "keluar" 
                        } 
                      }))}
                      className={`flex-1 py-1.5 text-sm font-medium transition border-l border-slate-200 dark:border-slate-700 ${
                        (rowExtraValues[col.id]?.txType || "masuk") === "keluar"
                          ? "bg-rose-600 text-white"
                          : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      Keluar
                    </button>
                  </div>
                  <Input
                    placeholder="Contoh: 50000"
                    value={rowExtraValues[col.id]?.value || ""}
                    onChange={(e) => setRowExtraValues((prev) => ({ 
                      ...prev, 
                      [col.id]: { 
                        value: e.target.value.replace(/\D/g, ""), 
                        txType: prev[col.id]?.txType || "masuk" 
                      } 
                    }))}
                    onKeyDown={(e) => e.key === "Enter" && saveRow()}
                    inputMode="numeric"
                  />
                </>
              ) : (
                <input
                  className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
                  placeholder={col.label}
                  value={rowExtraValues[col.id]?.value || ""}
                  onChange={(e) => setRowExtraValues((prev) => ({ 
                    ...prev, 
                    [col.id]: { 
                      value: e.target.value, 
                      txType: prev[col.id]?.txType || "masuk" 
                    } 
                  }))}
                  onKeyDown={(e) => e.key === "Enter" && saveRow()}
                />
              )}
              {col.columnType === "number" && rowExtraValues[col.id]?.value && Number(rowExtraValues[col.id].value) > 0 && (
                <div className={`mt-1 text-xs font-medium ${
                  (rowExtraValues[col.id]?.txType || "masuk") === "keluar" ? "text-rose-600" : "text-emerald-600"
                }`}>
                  {(rowExtraValues[col.id]?.txType || "masuk") === "keluar" ? "- " : ""}
                  {formatIDR(Number(rowExtraValues[col.id].value))}
                </div>
              )}
            </div>
          ))}
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

      {/* Modal edit header + extra columns */}
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
            />
            <div className="mt-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                Tipe:
              </label>
              <select
                value={headerType}
                onChange={(e) => setHeaderType(e.target.value as KolektifColumnType)}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
                <option value="date">Tanggal</option>
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
                onChange={(e) => setNoteType(e.target.value as KolektifColumnType)}
                className="rounded border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm px-2 py-1"
              >
                <option value="text">Text</option>
                <option value="number">Angka/Uang</option>
                <option value="date">Tanggal</option>
              </select>
            </div>
          </div>

          {/* Extra columns section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Kolom Tambahan</span>
              <button
                type="button"
                onClick={() => {
                  setEditingExtraColumn(null);
                  setExtraColInput("");
                  setExtraColType("text");
                  setOpenExtraColumnsModal(true);
                }}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M5 12h14"/><path d="M12 5v14"/>
                </svg>
                Tambah
              </button>
            </div>
            {config.extraColumns.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Belum ada kolom tambahan</div>
            ) : (
              <div className="grid gap-2">
                {config.extraColumns.map((col) => (
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
                          setEditingExtraColumn(col);
                          setExtraColInput(col.label);
                          setExtraColType(col.columnType);
                          setOpenExtraColumnsModal(true);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExtraColumn(col)}
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

      {/* Modal tambah/edit extra column (dipanggil dari dalam modal header) */}
      <Modal
        open={openExtraColumnsModal}
        title={editingExtraColumn ? "Edit Kolom" : "Tambah Kolom"}
        onClose={() => setOpenExtraColumnsModal(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Nama Kolom
            </div>
            <Input
              placeholder="Contoh: Alamat"
              value={extraColInput}
              onChange={(e) => setExtraColInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveExtraColumn()}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Tipe
            </div>
            <select
              value={extraColType}
              onChange={(e) => setExtraColType(e.target.value as KolektifColumnType)}
              className="w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50"
            >
              <option value="text">Text</option>
              <option value="number">Angka/Uang</option>
              <option value="date">Tanggal</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenExtraColumnsModal(false)}>
              Batal
            </Button>
            <Button onClick={saveExtraColumn} disabled={!extraColInput.trim() || saving}>
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

      {/* Modal hapus kolom tambahan */}
      <Modal
        open={openDeleteExtraColumnModal}
        title="Hapus Kolom"
        onClose={() => setOpenDeleteExtraColumnModal(false)}
      >
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus kolom{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              "{deletingExtraColumn?.label}"
            </span>
            ? Data di kolom ini akan ikut terhapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenDeleteExtraColumnModal(false)}
            >
              Batal
            </Button>
            <button
              type="button"
              onClick={doDeleteExtraColumn}
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

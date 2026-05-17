import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import { useAuth, canEditTransactions } from '../lib/auth'
import {
  getKolektifConfig,
  updateKolektifHeader,
  addKolektifRow,
  updateKolektifRow,
  deleteKolektifRow,
} from '../lib/store'
import { formatIDR } from '../lib/money'
import type { KolektifConfig, KolektifRow } from '../lib/types'

export default function KolektifSessionPage() {
  const { bookId, sessionId } = useParams<{ bookId: string; sessionId: string }>()
  const { profile } = useAuth()
  const userCanEdit = canEditTransactions(profile?.role)

  if (!bookId || !sessionId) return null
  const safeBookId = bookId
  const safeSessionId = sessionId

  const [config, setConfig] = useState<KolektifConfig>({ sessionId: safeSessionId, headerLabel: 'Nama', rows: [] })
  const [loading, setLoading] = useState(true)

  // Modal tambah/edit baris
  const [openRowModal, setOpenRowModal] = useState(false)
  const [editingRow, setEditingRow] = useState<KolektifRow | null>(null)
  const [rowLabel, setRowLabel] = useState('')
  const [rowAmount, setRowAmount] = useState('')

  // Modal edit header
  const [openHeaderModal, setOpenHeaderModal] = useState(false)
  const [headerInput, setHeaderInput] = useState('')

  // Modal hapus
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  const [deletingRow, setDeletingRow] = useState<KolektifRow | null>(null)

  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    const cfg = await getKolektifConfig(safeSessionId)
    setConfig(cfg)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [safeSessionId])

  // ── Row modal ──
  function openAddRow() {
    setEditingRow(null)
    setRowLabel('')
    setRowAmount('')
    setOpenRowModal(true)
  }

  function openEditRow(row: KolektifRow) {
    setEditingRow(row)
    setRowLabel(row.label)
    setRowAmount(String(row.amount))
    setOpenRowModal(true)
  }

  async function saveRow() {
    const label = rowLabel.trim()
    const amount = Number(rowAmount.replace(/\D/g, '')) || 0
    if (!label) return
    setSaving(true)
    try {
      if (editingRow) {
        await updateKolektifRow(editingRow.id, label, amount)
      } else {
        await addKolektifRow(safeSessionId, safeBookId, label, amount)
      }
      await refresh()
      setOpenRowModal(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Header modal ──
  async function saveHeader() {
    setSaving(true)
    try {
      await updateKolektifHeader(safeSessionId, headerInput)
      await refresh()
      setOpenHeaderModal(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──
  async function doDelete() {
    if (!deletingRow) return
    setSaving(true)
    try {
      await deleteKolektifRow(deletingRow.id)
      await refresh()
      setOpenDeleteModal(false)
      setDeletingRow(null)
    } finally {
      setSaving(false)
    }
  }

  const totalAmount = config.rows.reduce((s, r) => s + r.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <svg className="animate-spin h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Memuat...
      </div>
    )
  }

  return (
    <div className="grid gap-4">

      {/* Summary + tombol tambah */}
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 flex items-center gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatIDR(totalAmount)}</div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Baris</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{config.rows.length}</div>
          </div>
        </div>
        {userCanEdit && (
          <Button onClick={openAddRow}>+ Tambah</Button>
        )}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full border-separate border-spacing-0 bg-white dark:bg-slate-800 text-sm" style={{ tableLayout: 'fixed', minWidth: '360px' }}>
          <colgroup>
            <col style={{ width: userCanEdit ? '55%' : '65%' }} />
            <col style={{ width: '35%' }} />
            {userCanEdit && <col style={{ width: '10%' }} />}
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left">
                <div className="flex items-center gap-2">
                  <span>{config.headerLabel}</span>
                  {userCanEdit && (
                    <button
                      type="button"
                      onClick={() => { setHeaderInput(config.headerLabel); setOpenHeaderModal(true) }}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Ubah nama header"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </th>
              <th className="border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-right">
                Nominal
              </th>
              {userCanEdit && (
                <th className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-3" />
              )}
            </tr>
          </thead>
          <tbody>
            {config.rows.length === 0 ? (
              <tr>
                <td colSpan={userCanEdit ? 3 : 2} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                  Belum ada data.{userCanEdit ? ' Klik "+ Tambah" untuk menambahkan baris.' : ''}
                </td>
              </tr>
            ) : (
              config.rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${userCanEdit ? 'cursor-pointer' : ''}`}
                  onClick={userCanEdit ? () => openEditRow(row) : undefined}
                >
                  <td className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx + 1}.</span>
                      <span className="truncate">{row.label}</span>
                    </div>
                  </td>
                  <td className="border-b border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-right font-medium text-emerald-700 dark:text-emerald-400">
                    {formatIDR(row.amount)}
                  </td>
                  {userCanEdit && (
                    <td
                      className="border-b border-slate-200 dark:border-slate-700 px-2 py-3 text-center"
                      onClick={(e) => { e.stopPropagation(); setDeletingRow(row); setOpenDeleteModal(true) }}
                    >
                      <button
                        type="button"
                        className="rounded p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Hapus"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
            {config.rows.length > 0 && (
              <tr className="bg-slate-50 dark:bg-slate-900 font-semibold">
                <td className="sticky left-0 z-10 border-t-2 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white">
                  Total
                </td>
                <td className="border-t-2 border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">
                  {formatIDR(totalAmount)}
                </td>
                {userCanEdit && <td className="border-t-2 border-slate-200 dark:border-slate-700" />}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal tambah/edit baris */}
      <Modal open={openRowModal} title={editingRow ? 'Edit Baris' : 'Tambah Baris'} onClose={() => setOpenRowModal(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">{config.headerLabel}</div>
            <Input
              placeholder="Contoh: Budi Santoso"
              value={rowLabel}
              onChange={(e) => setRowLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRow()}
              autoFocus
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nominal</div>
            <Input
              placeholder="Contoh: 50000"
              value={rowAmount}
              onChange={(e) => setRowAmount(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && saveRow()}
              inputMode="numeric"
            />
            {rowAmount && Number(rowAmount) > 0 && (
              <div className="mt-1 text-xs text-slate-500">{formatIDR(Number(rowAmount))}</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenRowModal(false)}>Batal</Button>
            <Button onClick={saveRow} disabled={!rowLabel.trim() || saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal edit header */}
      <Modal open={openHeaderModal} title="Ubah Nama Header" onClose={() => setOpenHeaderModal(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Header Kolom Kiri</div>
            <Input
              placeholder="Contoh: Nama Anggota"
              value={headerInput}
              onChange={(e) => setHeaderInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveHeader()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenHeaderModal(false)}>Batal</Button>
            <Button onClick={saveHeader} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal hapus baris */}
      <Modal open={openDeleteModal} title="Hapus Baris" onClose={() => setOpenDeleteModal(false)}>
        <div className="grid gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yakin hapus baris <span className="font-semibold text-slate-900 dark:text-white">"{deletingRow?.label}"</span>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenDeleteModal(false)}>Batal</Button>
            <button
              type="button"
              onClick={doDelete}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

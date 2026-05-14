import { useEffect, useMemo, useState } from 'react'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Select from '../components/Select'
import { monthKey, monthLabel, todayISO } from '../lib/date'
import { formatIDR, toNumberSafe } from '../lib/money'
import { useAuth, canEditTransactions } from '../lib/auth'
import {
  addCategory,
  addTransaction,
  deleteCategory,
  deleteTransaction,
  getCategories,
  getTransactions,
  saveCategories,
  updateTransaction,
} from '../lib/store'
import type { Category, Transaction, TxType } from '../lib/types'

type Props = {
  bookId: string
  mode?: 'semua' | 'rekening'
}

type FormState = {
  date: string
  type: TxType
  categoryId: string
  amount: string
  note: string
  masukKeRekening: boolean
}

function formatIDRInput(digits: string): string {
  const onlyDigits = digits.replace(/\D/g, '')
  if (!onlyDigits) return ''
  return onlyDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const monthOptions = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
]

function prevMonth(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function defaultDateForMonth(month: string): string {
  const today = todayISO()
  const [y, m] = month.split('-').map(Number)
  const todayDay = Number(today.slice(8, 10))
  const lastDay = new Date(y, m, 0).getDate()
  const day = String(Math.min(todayDay, lastDay)).padStart(2, '0')
  return `${month}-${day}`
}

export default function TransactionsPage({ bookId, mode = 'semua' }: Props) {
  const { profile } = useAuth()
  const userCanEdit = canEditTransactions(profile?.role)
  
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(todayISO()))
  const [openMonthModal, setOpenMonthModal] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => todayISO().slice(0, 4))
  const [pickerMonth, setPickerMonth] = useState(() => todayISO().slice(5, 7))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [openInfo, setOpenInfo] = useState(false)
  const [infoTx, setInfoTx] = useState<Transaction | null>(null)
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  type SortKey = 'date' | 'category' | 'note' | 'amount'
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [openCategoryModal, setOpenCategoryModal] = useState(false)
  const [openDatePicker, setOpenDatePicker] = useState(false)
  const [openTypePicker, setOpenTypePicker] = useState(false)
  const [openCategoryPicker, setOpenCategoryPicker] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [form, setForm] = useState<FormState>({
    date: todayISO(),
    type: 'masuk',
    categoryId: 'lainnya',
    amount: '',
    note: '',
    masukKeRekening: false,
  })

  // Load transactions on mount
  useEffect(() => {
    getTransactions(bookId).then(setTransactions)
  }, [bookId])

  // Load categories on mount and whenever transactions change
  useEffect(() => {
    getCategories(bookId).then(setCategories)
  }, [transactions, bookId])

  // Update form default categoryId once categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      setForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId === 'lainnya' ? (categories[0]?.id ?? 'lainnya') : prev.categoryId,
      }))
    }
  }, [categories])

  const catById = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string) => m.get(id) ?? 'Tidak diketahui'
  }, [categories])

  const filtered = useMemo(() => {
    return transactions.filter(t => monthKey(t.date) === selectedMonth)
  }, [transactions, selectedMonth])

  const yearOptions = useMemo(() => {
    const years = new Set<string>()
    const currentYear = Number(todayISO().slice(0, 4))
    for (let y = currentYear - 5; y <= currentYear + 5; y += 1) {
      years.add(String(y))
    }
    for (const t of transactions) years.add(t.date.slice(0, 4))
    return [...years].sort((a, b) => Number(a) - Number(b))
  }, [transactions])

  function resetForm() {
    setEditingId(null)
    setForm({
      date: defaultDateForMonth(selectedMonth),
      type: 'masuk',
      categoryId: categories[0]?.id ?? 'lainnya',
      amount: '',
      note: '',
      masukKeRekening: false,
    })
  }

  function openCreate() {
    resetForm()
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setOpenDeleteModal(false)
    setOpenDatePicker(false)
    setOpenTypePicker(false)
    setOpenCategoryPicker(false)
    resetForm()
  }

  function closeInfoModal() {
    setOpenInfo(false)
    setInfoTx(null)
  }

  function openInfoModal(t: Transaction) {
    setInfoTx(t)
    setOpenInfo(true)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setForm({
      date: t.date,
      type: t.type,
      categoryId: t.categoryId,
      amount: String(t.amount),
      note: t.note,
      masukKeRekening: Boolean(t.masukKeRekening),
    })
    setOpenInfo(false)
    setOpen(true)
  }

  async function submit() {
    const amount = toNumberSafe(form.amount)
    if (!form.date) return
    if (!form.categoryId) return
    if (amount <= 0) return

    if (editingId) {
      await updateTransaction(bookId, editingId, {
        date: form.date,
        type: form.type,
        categoryId: form.categoryId,
        amount,
        note: form.note,
        masukKeRekening: form.masukKeRekening,
      })
      await getTransactions(bookId).then(setTransactions)
      closeModal()
      return
    }

    await addTransaction(bookId, {
      date: form.date,
      type: form.type,
      categoryId: form.categoryId,
      amount,
      note: form.note,
      masukKeRekening: form.masukKeRekening,
    })
    await getTransactions(bookId).then(setTransactions)
    closeModal()
  }

  async function remove(id: string) {
    await deleteTransaction(bookId, id)
    await getTransactions(bookId).then(setTransactions)
    if (editingId === id) closeModal()
  }

  function canDeleteCategory(id: string) {
    return !['lainnya', 'iuran', 'donasi', 'kegiatan', 'konsumsi'].includes(id)
  }

  async function addNewCategory() {
    const n = newCategoryName.trim()
    if (!n) return
    const c = await addCategory(bookId, n)
    const next = await getCategories(bookId)
    setCategories(next)
    setForm((prev) => ({ ...prev, categoryId: c.id }))
    setNewCategoryName('')
  }

  async function removeCategory(id: string) {
    if (!confirm('Hapus kategori ini? Transaksi akan dipindahkan ke kategori Lainnya.')) {
      return
    }
    await deleteCategory(bookId, id)
    const next = await getCategories(bookId)
    setCategories(next)
    if (!next.some((c) => c.id === form.categoryId)) {
      setForm((prev) => ({ ...prev, categoryId: next[0]?.id ?? 'lainnya' }))
    }
  }

  async function resetDefaultCategories() {
    if (!confirm('Reset kategori ke default?')) return
    const current = await getCategories(bookId)
    await saveCategories(bookId, current)
    const next = await getCategories(bookId)
    setCategories(next)
    if (!next.some((c) => c.id === form.categoryId)) {
      setForm((prev) => ({ ...prev, categoryId: next[0]?.id ?? 'lainnya' }))
    }
  }

  function openMonthSelectModal() {
    const [y, m] = selectedMonth.split('-')
    setPickerYear(y)
    setPickerMonth(m)
    setOpenMonthModal(true)
  }

  function applyMonthSelection() {
    setSelectedMonth(`${pickerYear}-${pickerMonth}`)
    setOpenMonthModal(false)
  }

  const displayed = useMemo(() => {
    let list =
      mode === 'rekening'
        ? filtered.filter((t) => t.masukKeRekening)
        : filtered
    if (sortKey) {
      const catMap = new Map(categories.map((c) => [c.id, c.name]))
      const getName = (id: string) => catMap.get(id) ?? 'Tidak diketahui'
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
        else if (sortKey === 'category')
          cmp = getName(a.categoryId).localeCompare(getName(b.categoryId))
        else if (sortKey === 'note') cmp = a.note.localeCompare(b.note)
        else if (sortKey === 'amount') cmp = a.amount - b.amount
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [filtered, mode, sortKey, sortDir, categories])

  const totals = useMemo(() => {
    let masuk = 0
    let keluar = 0
    for (const t of displayed) {
      if (t.type === 'masuk') masuk += t.amount
      else keluar += t.amount
    }
    return { masuk, keluar, saldo: masuk - keluar }
  }, [displayed])

  return (
    <div className="relative min-w-0">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedMonth(prevMonth(selectedMonth))
              setOpenMonthModal(false)
            }}
            aria-label="Bulan lalu"
            className="min-w-11 px-4"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Button>
        </div>
        <div className="justify-self-center">
          <button
            type="button"
            className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-900"
            onClick={openMonthSelectModal}
          >
            {monthLabel(selectedMonth)}
          </button>
        </div>
        <div className="justify-self-end">
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedMonth(nextMonth(selectedMonth))
              setOpenMonthModal(false)
            }}
            aria-label="Bulan depan"
            className="min-w-11 px-4"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border bg-white shadow-sm">
        {displayed.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">
            {mode === 'rekening'
              ? 'Belum ada transaksi rekening.'
              : 'Belum ada transaksi tunai.'}
          </div>
        ) : (
          <div className="w-full min-w-0 max-h-[55vh] overflow-auto md:max-h-[65vh]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th
                    className="cursor-pointer py-3 pl-4 pr-3 whitespace-nowrap select-none"
                    onClick={() => toggleSort('date')}
                  >
                    Tgl{sortIcon('date')}
                  </th>
                  <th
                    className="cursor-pointer py-3 pr-3 whitespace-nowrap select-none"
                    onClick={() => toggleSort('category')}
                  >
                    Kategori{sortIcon('category')}
                  </th>
                  <th
                    className="cursor-pointer py-3 pr-3 whitespace-nowrap select-none"
                    onClick={() => toggleSort('note')}
                  >
                    Catatan{sortIcon('note')}
                  </th>
                  {mode === 'semua' ? (
                    <th className="py-3 pr-3 text-center whitespace-nowrap">Rekening</th>
                  ) : null}
                  <th
                    className="cursor-pointer py-3 pr-3 text-right whitespace-nowrap select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    Masuk{sortIcon('amount')}
                  </th>
                  <th
                    className="cursor-pointer py-3 pr-3 text-right whitespace-nowrap select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    Keluar{sortIcon('amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t cursor-pointer hover:bg-slate-50"
                    onClick={() => openInfoModal(t)}
                  >
                    <td className="py-3 pl-4 pr-3 whitespace-nowrap">{t.date.slice(8, 10)}</td>
                    <td className="py-3 pr-3 whitespace-nowrap">{catById(t.categoryId)}</td>
                    <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">{t.note}</td>
                    {mode === 'semua' ? (
                      <td className="py-3 pr-3 text-center">
                        {t.masukKeRekening ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"
                            aria-label="Masuk rekening"
                          >
                            ✓
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="py-3 pr-3 text-right font-medium text-emerald-700">
                      {t.type === 'masuk' ? formatIDR(t.amount) : ''}
                    </td>
                    <td className="py-3 pr-3 text-right font-medium text-rose-700">
                      {t.type === 'keluar' ? formatIDR(t.amount) : ''}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-3 pl-4 pr-3" colSpan={mode === 'semua' ? 4 : 3}>Total</td>
                  <td className="py-3 pr-3 text-right text-emerald-700">{formatIDR(totals.masuk)}</td>
                  <td className="py-3 pr-3 text-right text-rose-700">{formatIDR(totals.keluar)}</td>
                </tr>
                <tr className="border-t-2 border-slate-500 font-semibold">
                  <td className="py-3 pl-4 pr-3" colSpan={mode === 'semua' ? 4 : 3}>Saldo</td>
                  <td className="py-3 pr-3 text-right" colSpan={2}>{formatIDR(totals.saldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={openInfo}
        title="Info Transaksi"
        onClose={closeInfoModal}
      >
        {infoTx ? (
          <div className="grid gap-3">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Tanggal</div>
                <div className="font-medium text-slate-900">{infoTx.date}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Tipe</div>
                <div className="font-medium text-slate-900">
                  {infoTx.type === 'masuk' ? 'Masuk' : 'Keluar'}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Kategori</div>
                <div className="font-medium text-slate-900">{catById(infoTx.categoryId)}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Nominal</div>
                <div className="font-medium text-slate-900">{formatIDR(infoTx.amount)}</div>
              </div>
              {mode === 'semua' ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-500">Rekening</div>
                  <div className="font-medium text-slate-900">
                    {infoTx.masukKeRekening ? 'Ya' : 'Tidak'}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-1">
                <div className="text-slate-500">Catatan</div>
                <div className="rounded-lg border bg-white px-3 py-2 text-slate-900">
                  {infoTx.note || '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeInfoModal}>
                Tutup
              </Button>
              {userCanEdit && (
                <Button
                  onClick={() => {
                    startEdit(infoTx)
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="mt-4">
        {userCanEdit && (
          <button
            type="button"
            aria-label="Tambah transaksi"
            className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 md:bottom-6"
            onClick={openCreate}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        )}
      </div>

      <Modal
        open={openMonthModal}
        title="Pilih Bulan"
        onClose={() => setOpenMonthModal(false)}
      >
        <div className="grid gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Bulan</div>
            <Select
              value={pickerMonth}
              onChange={(e) => setPickerMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Tahun</div>
            <Select
              value={pickerYear}
              onChange={(e) => setPickerYear(e.target.value)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpenMonthModal(false)}>
              Batal
            </Button>
            <Button onClick={applyMonthSelection}>Terapkan</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        title={editingId ? 'Edit Transaksi' : 'Tambah Transaksi'}
        onClose={closeModal}
      >
        <div className="grid gap-3 md:grid-cols-6">
          <div className="grid gap-3 md:col-span-6 md:grid-cols-6">
            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-medium text-slate-600">Tanggal</div>
              <div className="md:hidden">
                <button
                  type="button"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm font-medium text-slate-900"
                  onClick={() => setOpenDatePicker(true)}
                >
                  {form.date || 'Pilih tanggal'}
                </button>
              </div>
              <div className="hidden md:block">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-medium text-slate-600">Tipe</div>
              <div className="md:hidden">
                <button
                  type="button"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm font-medium text-slate-900"
                  onClick={() => setOpenTypePicker(true)}
                >
                  {form.type === 'masuk' ? 'Masuk' : 'Keluar'}
                </button>
              </div>
              <div className="hidden md:block">
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as TxType })}
                >
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                </Select>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-medium text-slate-600">Kategori</div>
              <div className="md:hidden">
                <button
                  type="button"
                  className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm font-medium text-slate-900"
                  onClick={() => setOpenCategoryPicker(true)}
                >
                  {catById(form.categoryId)}
                </button>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <button
                  type="button"
                  aria-label="Kelola kategori"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpenCategoryModal(true)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.03A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51h.03a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.03a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="mb-1 text-xs font-medium text-slate-600">Nominal</div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                Rp
              </span>
              <Input
                inputMode="numeric"
                placeholder="10.000"
                value={formatIDRInput(form.amount)}
                className="pl-10"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  setForm({ ...form, amount: digits })
                }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">Nominal harus lebih dari 0.</div>
          </div>
          <div className="md:col-span-3">
            <div className="mb-1 text-xs font-medium text-slate-600">Catatan</div>
            <Input
              placeholder="Contoh: Iuran minggu ke-2"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="md:col-span-6">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={form.masukKeRekening}
                onChange={(e) =>
                  setForm({ ...form, masukKeRekening: e.target.checked })
                }
              />
              Masuk ke rekening
            </label>
          </div>
          <div className="md:col-span-6 flex justify-end gap-2 pt-2">
            {editingId ? (
              <Button
                variant="danger"
                onClick={() => setOpenDeleteModal(true)}
              >
                Hapus
              </Button>
            ) : null}
            <Button variant="secondary" onClick={closeModal}>
              Batal
            </Button>
            <Button onClick={() => void submit()}>{editingId ? 'Simpan' : 'Tambah'}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDatePicker}
        title="Tanggal"
        onClose={() => setOpenDatePicker(false)}
      >
        <div className="grid gap-3">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenDatePicker(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openTypePicker}
        title="Tipe"
        onClose={() => setOpenTypePicker(false)}
      >
        <div className="grid gap-2">
          <button
            type="button"
            className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-medium ${
              form.type === 'masuk' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900'
            }`}
            onClick={() => {
              setForm({ ...form, type: 'masuk' })
              setOpenTypePicker(false)
            }}
          >
            Masuk
          </button>
          <button
            type="button"
            className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-medium ${
              form.type === 'keluar' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900'
            }`}
            onClick={() => {
              setForm({ ...form, type: 'keluar' })
              setOpenTypePicker(false)
            }}
          >
            Keluar
          </button>
        </div>
      </Modal>

      <Modal
        open={openCategoryPicker}
        title="Kategori"
        onClose={() => setOpenCategoryPicker(false)}
      >
        <div className="grid gap-2">
          <div className="max-h-72 overflow-auto rounded-lg border">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm ${
                  form.categoryId === c.id ? 'bg-slate-50 font-medium text-slate-900' : 'bg-white text-slate-700'
                }`}
                onClick={() => {
                  setForm({ ...form, categoryId: c.id })
                  setOpenCategoryPicker(false)
                }}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                {form.categoryId === c.id ? <span className="shrink-0">✓</span> : null}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCategoryPicker(false)}>
              Tutup
            </Button>
            <Button onClick={() => {
              setOpenCategoryPicker(false)
              setOpenCategoryModal(true)
            }}>
              Kelola
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCategoryModal}
        title="Kelola Kategori"
        onClose={() => {
          setOpenCategoryModal(false)
          setNewCategoryName('')
        }}
      >
        <div className="grid gap-4">
          <div className="grid gap-2 md:grid-cols-6">
            <div className="md:col-span-4">
              <div className="mb-1 text-xs font-medium text-slate-600">Nama kategori</div>
              <Input
                placeholder="Contoh: Transport"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <Button onClick={() => void addNewCategory()} className="w-full">
                Tambah
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => void resetDefaultCategories()}>
              Reset default
            </Button>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pl-3 pr-3">Nama</th>
                  <th className="py-2 pr-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 pl-3 pr-3">{c.name}</td>
                    <td className="py-2 pr-3 text-right">
                      {canDeleteCategory(c.id) ? (
                        <Button variant="danger" onClick={() => void removeCategory(c.id)}>
                          Hapus
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Terkunci</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDeleteModal}
        title="Konfirmasi"
        onClose={() => setOpenDeleteModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-700">Hapus transaksi ini?</div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenDeleteModal(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!editingId) return
                setOpenDeleteModal(false)
                void remove(editingId)
              }}
            >
              Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

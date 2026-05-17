import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ExcelJS from 'exceljs'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Select from '../components/Select'
import SuccessModal from '../components/SuccessModal'
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
  getRoutineFrequency,
  getRoutineSessions,
  saveCategories,
  updateTransaction,
  TRANSACTIONS_CHANGED_EVENT,
  reverseTransferFromTransaction,
  getRoutineBooksForReverseTransfer,
  parseTransferNote,
} from '../lib/store'
import { uploadTransactionAttachment, deleteTransactionAttachment, supabase } from '../lib/supabase'
import type { Category, Transaction, TxType, Book } from '../lib/types'

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
  attachmentUrl?: string
  attachmentFile?: File | null
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
  const location = useLocation()
  const { profile } = useAuth()
  const userCanEdit = canEditTransactions(profile?.role)
  
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Check if there's a selected month from navigation state
    const state = location.state as { selectedMonth?: string } | null
    return state?.selectedMonth || monthKey(todayISO())
  })
  const [openMonthModal, setOpenMonthModal] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => todayISO().slice(0, 4))
  const [pickerMonth, setPickerMonth] = useState(() => todayISO().slice(5, 7))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [openInfo, setOpenInfo] = useState(false)
  const [infoTx, setInfoTx] = useState<Transaction | null>(null)
  const [openDeleteModal, setOpenDeleteModal] = useState(false)
  type SortKey = 'date' | 'category' | 'note' | 'masuk' | 'keluar'
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [openCategoryModal, setOpenCategoryModal] = useState(false)
  const [openDatePicker, setOpenDatePicker] = useState(false)
  const [openTypePicker, setOpenTypePicker] = useState(false)
  const [openCategoryPicker, setOpenCategoryPicker] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  
  // State untuk reverse transfer
  const [openReverseModal, setOpenReverseModal] = useState(false)
  const [availableRoutineBooks, setAvailableRoutineBooks] = useState<Book[]>([])
  const [selectedRoutineBookId, setSelectedRoutineBookId] = useState<string>('')
  const [reverseTransferData, setReverseTransferData] = useState<{
    transactionId: string
    categoryName: string
    periodKey: string
    amount: number
  } | null>(null)

  // State untuk modal success reverse transfer
  const [openReverseSuccessModal, setOpenReverseSuccessModal] = useState(false)
  const [reverseSuccessData, setReverseSuccessData] = useState<{
    categoryName: string
    amount: number
    routineBookName: string
    periodKey: string
  } | null>(null)
  
  const [form, setForm] = useState<FormState>({
    date: todayISO(),
    type: 'masuk',
    categoryId: 'lainnya',
    amount: '',
    note: '',
    masukKeRekening: false,
  })

  // Load transactions on mount and listen for external changes
  useEffect(() => {
    getTransactions(bookId).then(setTransactions)

    const onTransactionsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ bookId?: string }>).detail
      if (!detail?.bookId || detail.bookId === bookId) {
        getTransactions(bookId).then(setTransactions)
      }
    }
    const onStorage = () => getTransactions(bookId).then(setTransactions)

    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onTransactionsChanged)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onTransactionsChanged)
      window.removeEventListener('storage', onStorage)
    }
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
    return (id: string) => {
      if (id === 'iuran') return 'Transfer'
      return m.get(id) ?? 'Tidak diketahui'
    }
  }, [categories])

  const filtered = useMemo(() => {
    // Jika mode pencarian aktif, cari di semua transaksi
    if (isSearchMode && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      return transactions.filter(t => 
        t.note.toLowerCase().includes(query)
      )
    }
    // Jika tidak, filter berdasarkan bulan yang dipilih
    return transactions.filter(t => monthKey(t.date) === selectedMonth)
  }, [transactions, selectedMonth, isSearchMode, searchQuery])

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
      attachmentUrl: undefined,
      attachmentFile: null,
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
      attachmentUrl: t.attachmentUrl,
      attachmentFile: null,
    })
    setOpenInfo(false)
    setOpen(true)
  }

  async function submit() {
    const amount = toNumberSafe(form.amount)
    if (!form.date) return
    if (!form.categoryId) return
    if (amount <= 0) return

    try {
      setUploadingFile(true)
      let attachmentUrl = form.attachmentUrl

      // Upload file baru jika ada
      if (form.attachmentFile) {
        const tempId = editingId || `temp-${Date.now()}`
        attachmentUrl = await uploadTransactionAttachment(form.attachmentFile, tempId)
        
        // Hapus file lama jika sedang edit dan ada file lama
        if (editingId && form.attachmentUrl && form.attachmentUrl !== attachmentUrl) {
          await deleteTransactionAttachment(form.attachmentUrl)
        }
      }

      if (editingId) {
        await updateTransaction(bookId, editingId, {
          date: form.date,
          type: form.type,
          categoryId: form.categoryId,
          amount,
          note: form.note,
          masukKeRekening: form.masukKeRekening,
          attachmentUrl,
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
        attachmentUrl,
      })
      await getTransactions(bookId).then(setTransactions)
      closeModal()
    } catch (error) {
      console.error('Error submitting transaction:', error)
      // Log detail error
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      } else {
        console.error('Error object:', JSON.stringify(error, null, 2))
      }
      alert(`Gagal menyimpan transaksi: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingFile(false)
    }
  }

  async function remove(id: string) {
    await deleteTransaction(bookId, id)
    await getTransactions(bookId).then(setTransactions)
    if (editingId === id) closeModal()
  }

  async function handleReverseTransfer(transaction: Transaction) {
    // Parse note untuk mendapatkan informasi transfer
    const transferInfo = parseTransferNote(transaction.note)
    if (!transferInfo) {
      alert('Transaksi ini bukan hasil transfer dari buku rutinan')
      return
    }

    // Load buku kolektif yang tersedia
    const routineBooks = await getRoutineBooksForReverseTransfer()
    setAvailableRoutineBooks(routineBooks)
    setSelectedRoutineBookId(routineBooks[0]?.id ?? '')
    
    setReverseTransferData({
      transactionId: transaction.id,
      categoryName: transferInfo.categoryName,
      periodKey: transferInfo.periodKey,
      amount: transaction.amount
    })

    setOpenInfo(false)
    setTimeout(() => setOpenReverseModal(true), 200)
  }

  async function confirmReverseTransfer() {
    if (!reverseTransferData || !selectedRoutineBookId) {
      alert('Pilih buku rutinan tujuan terlebih dahulu')
      return
    }

    const routineBook = availableRoutineBooks.find(b => b.id === selectedRoutineBookId)

    try {
      // Cari kategori ID berdasarkan nama kategori di buku kolektif
      // Cek frequency dulu — arisan pakai session.categories, bulanan pakai routine_categories
      const frequency = await getRoutineFrequency(selectedRoutineBookId)
      let categoryId: string | null = null

      if (frequency === 'arisan') {
        // Cari dari session.categories
        const sessions = await getRoutineSessions(selectedRoutineBookId)
        for (const session of sessions) {
          const found = (session.categories ?? []).find(
            c => c.name.trim().toLowerCase() === reverseTransferData.categoryName.trim().toLowerCase()
          )
          if (found) {
            categoryId = found.id
            break
          }
        }
      } else {
        // Cari dari routine_categories table
        const { data: routineCategories } = await supabase
          .from('routine_categories')
          .select('id')
          .eq('book_id', selectedRoutineBookId)
          .eq('name', reverseTransferData.categoryName)
          .single()
        categoryId = routineCategories?.id ?? null
      }

      if (!categoryId) {
        alert(`Kategori "${reverseTransferData.categoryName}" tidak ditemukan di buku rutinan yang dipilih`)
        return
      }

      await reverseTransferFromTransaction(
        reverseTransferData.transactionId,
        bookId,
        selectedRoutineBookId,
        reverseTransferData.periodKey,
        categoryId
      )

      await getTransactions(bookId).then(setTransactions)
      setOpenReverseModal(false)
      
      // Set data untuk success modal
      setReverseSuccessData({
        categoryName: reverseTransferData.categoryName,
        amount: reverseTransferData.amount,
        routineBookName: routineBook?.name || 'Buku Rutinan',
        periodKey: reverseTransferData.periodKey
      })
      
      setReverseTransferData(null)
      
      // Tampilkan success modal
      setOpenReverseSuccessModal(true)
      
    } catch (error) {
      console.error('Error reverse transfer:', error)
      alert('Gagal mengembalikan ke buku rutinan')
    }
  }

  function isTransferTransaction(transaction: Transaction): boolean {
    // Format baru: ada bracket [periodKey|categoryName] di akhir note
    if (/\[[^\|]+\|.+\]$/.test(transaction.note)) return true
    // Format lama
    return transaction.note.includes('Transfer dari buku kolektif')
  }

  // Sembunyikan metadata bracket [periodKey|categoryName] dari tampilan
  function displayNote(note: string): string {
    return note.replace(/\s*\[[^\]]+\|[^\]]+\]$/, '').trim()
  }

  const handleReverseSuccessModalClose = () => {
    setOpenReverseSuccessModal(false)
    setReverseSuccessData(null)
  }

  const handleViewRoutineBook = () => {
    if (!reverseSuccessData) return
    setOpenReverseSuccessModal(false)
    setReverseSuccessData(null)
    // Navigate ke halaman buku kolektif
    window.location.href = `/buku-kas-rutin/${selectedRoutineBookId}`
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

  async function exportToExcel() {
    try {
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Transaksi')

      // Add title row
      const monthName = monthLabel(selectedMonth)
      worksheet.mergeCells('A1:G1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = `LAPORAN TRANSAKSI - ${monthName.toUpperCase()}`
      titleCell.font = { bold: true, size: 14 }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      }
      titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).height = 30

      // Add empty row for spacing
      worksheet.addRow([])

      // Define columns (starting from row 3)
      const headerRow = worksheet.addRow([
        'Tanggal',
        'Kategori',
        'Tipe',
        'Nominal',
        'Catatan',
        'Masuk ke Rekening',
        'Lampiran'
      ])

      // Set column widths
      worksheet.columns = [
        { key: 'date', width: 12 },
        { key: 'category', width: 20 },
        { key: 'type', width: 10 },
        { key: 'amount', width: 15 },
        { key: 'note', width: 30 },
        { key: 'masukKeRekening', width: 18 },
        { key: 'attachment', width: 25 },
      ]

      // Style header row
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
      headerRow.height = 25

      // Set default row height for images
      const imageRowHeight = 100

      // Add data rows with images
      for (let i = 0; i < displayed.length; i++) {
        const tx = displayed[i]
        const category = categories.find(c => c.id === tx.categoryId)
        
        const row = worksheet.addRow({
          date: tx.date,
          category: tx.categoryId === 'iuran' ? 'Transfer' : (category?.name || 'Tidak diketahui'),
          type: tx.type === 'masuk' ? 'Masuk' : 'Keluar',
          amount: tx.amount,
          note: displayNote(tx.note),
          masukKeRekening: tx.masukKeRekening ? 'Ya' : 'Tidak',
          attachment: '' // Kosongkan cell untuk lampiran
        })

        // Set alignment for all cells in this row
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
        })

        // Format amount as currency
        const amountCell = row.getCell('amount')
        amountCell.numFmt = '#,##0'

        // If there's an attachment, download and embed the image
        if (tx.attachmentUrl) {
          try {
            // Set row height for image
            row.height = imageRowHeight

            // Fetch image as blob
            const response = await fetch(tx.attachmentUrl)
            const blob = await response.blob()
            const arrayBuffer = await blob.arrayBuffer()

            // Determine image extension
            let extension: 'jpeg' | 'png' | 'gif' = 'png'
            if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
              extension = 'jpeg'
            } else if (blob.type === 'image/png') {
              extension = 'png'
            }

            // Create an image element to get original dimensions
            const img = new Image()
            const imageUrl = URL.createObjectURL(blob)
            
            await new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = reject
              img.src = imageUrl
            })

            // Calculate dimensions maintaining aspect ratio
            const maxWidth = 180
            const maxHeight = 90
            let width = img.width
            let height = img.height

            // Scale down if needed while maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
              const widthRatio = maxWidth / width
              const heightRatio = maxHeight / height
              const ratio = Math.min(widthRatio, heightRatio)
              
              width = width * ratio
              height = height * ratio
            }

            URL.revokeObjectURL(imageUrl)

            // Add image to workbook
            const imageId = workbook.addImage({
              buffer: arrayBuffer,
              extension: extension,
            })

            // Embed image in the attachment column with maintained aspect ratio
            // Row index is i + 3 (1 for title, 1 for spacing, 1 for header)
            worksheet.addImage(imageId, {
              tl: { col: 6, row: i + 3 },
              ext: { width: width, height: height },
              editAs: 'oneCell'
            })
          } catch (error) {
            console.error('Error embedding image:', error)
            // If image fails, show error text
            row.getCell('attachment').value = 'Gagal memuat'
            row.getCell('attachment').alignment = { vertical: 'middle', horizontal: 'left' }
          }
        } else {
          // No attachment
          row.getCell('attachment').value = '-'
          row.getCell('attachment').alignment = { vertical: 'middle', horizontal: 'left' }
        }
      }

      // Generate filename
      const filename = `Transaksi_${monthName.replace(' ', '_')}.xlsx`

      // Write to buffer and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Gagal mengekspor data ke Excel')
    }
  }

  const displayed = useMemo(() => {
    let list =
      mode === 'rekening'
        ? filtered.filter((t) => t.masukKeRekening)
        : filtered
    if (sortKey) {
      const catMap = new Map(categories.map((c) => [c.id, c.name]))
      const getName = (id: string) => id === 'iuran' ? 'Transfer' : (catMap.get(id) ?? 'Tidak diketahui')
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
        else if (sortKey === 'category')
          cmp = getName(a.categoryId).localeCompare(getName(b.categoryId))
        else if (sortKey === 'note') cmp = a.note.localeCompare(b.note)
        else if (sortKey === 'masuk') {
          // Prioritaskan transaksi masuk di atas
          if (a.type === 'masuk' && b.type !== 'masuk') return -1
          if (a.type !== 'masuk' && b.type === 'masuk') return 1
          // Jika keduanya masuk, sort berdasarkan amount
          if (a.type === 'masuk' && b.type === 'masuk') {
            cmp = a.amount - b.amount
          }
          // Jika keduanya bukan masuk, pertahankan urutan
          else {
            cmp = 0
          }
        }
        else if (sortKey === 'keluar') {
          // Prioritaskan transaksi keluar di atas
          if (a.type === 'keluar' && b.type !== 'keluar') return -1
          if (a.type !== 'keluar' && b.type === 'keluar') return 1
          // Jika keduanya keluar, sort berdasarkan amount
          if (a.type === 'keluar' && b.type === 'keluar') {
            cmp = a.amount - b.amount
          }
          // Jika keduanya bukan keluar, pertahankan urutan
          else {
            cmp = 0
          }
        }
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
      {/* Search Bar and Export Button */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Cari berdasarkan catatan (semua tahun)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsSearchMode(e.target.value.trim().length > 0)
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setIsSearchMode(false)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={exportToExcel}
          disabled={displayed.length === 0}
          className="whitespace-nowrap flex items-center gap-1"
          aria-label="Export ke Excel"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
      {isSearchMode && (
        <div className="mb-2 text-xs text-slate-500">
          Menampilkan hasil pencarian dari semua bulan ({displayed.length} transaksi ditemukan)
        </div>
      )}

      {/* Month Navigation - Hidden when searching */}
      {!isSearchMode && (
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
            className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
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
      )}

      <div className="min-w-0 rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {displayed.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">
            {mode === 'rekening'
              ? 'Belum ada transaksi rekening.'
              : 'Belum ada transaksi tunai.'}
          </div>
        ) : (
          <div className="w-full min-w-0 max-h-[55vh] overflow-auto md:max-h-[65vh]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
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
                    onClick={() => toggleSort('masuk')}
                  >
                    Masuk{sortIcon('masuk')}
                  </th>
                  <th
                    className="cursor-pointer py-3 pr-3 text-right whitespace-nowrap select-none"
                    onClick={() => toggleSort('keluar')}
                  >
                    Keluar{sortIcon('keluar')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
                    onClick={() => openInfoModal(t)}
                  >
                    <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                      {isSearchMode ? t.date : t.date.slice(8, 10)}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">{catById(t.categoryId)}</td>
                    <td className="py-3 pr-3 text-slate-600 whitespace-nowrap dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span>{displayNote(t.note)}</span>
                        {t.attachmentUrl && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4 text-blue-500 flex-shrink-0"
                            aria-label="Ada lampiran"
                          >
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                        )}
                      </div>
                    </td>
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
                <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-600 dark:text-slate-200">
                  <td className="py-3 pl-4 pr-3" colSpan={mode === 'semua' ? 4 : 3}>Total</td>
                  <td className="py-3 pr-3 text-right text-emerald-700">{formatIDR(totals.masuk)}</td>
                  <td className="py-3 pr-3 text-right text-rose-700">{formatIDR(totals.keluar)}</td>
                </tr>
                <tr className="border-t-2 border-slate-500 font-semibold dark:border-slate-500 dark:text-slate-200">
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
                  {infoTx.note ? displayNote(infoTx.note) : '-'}
                </div>
              </div>
              {infoTx.attachmentUrl ? (
                <div className="grid gap-2">
                  <div className="text-slate-500">Lampiran</div>
                  {/* Preview gambar - langsung tampil */}
                  {(() => {
                    const url = infoTx.attachmentUrl.toLowerCase();
                    const isImage = url.includes('.jpg') || url.includes('.jpeg') || 
                                   url.includes('.png') || url.includes('.gif') || 
                                   url.includes('.webp') || url.includes('.bmp');
                    
                    if (isImage) {
                      return (
                        <a
                          href={infoTx.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-lg border border-slate-300 overflow-hidden hover:border-blue-400 transition"
                        >
                          <img 
                            src={infoTx.attachmentUrl} 
                            alt="Lampiran transaksi" 
                            className="w-full h-auto object-contain bg-slate-50 cursor-pointer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </a>
                      );
                    }
                    // Jika bukan gambar, tampilkan tombol download
                    return (
                      <a
                        href={infoTx.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-600 hover:bg-blue-100"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                        >
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span className="text-sm font-medium">Buka Lampiran</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 ml-auto"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" x2="21" y1="14" y2="3" />
                        </svg>
                      </a>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeInfoModal}>
                Tutup
              </Button>
              {userCanEdit && isTransferTransaction(infoTx) && (
                <Button
                  variant="secondary"
                  onClick={() => handleReverseTransfer(infoTx)}
                  className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                >
                  Kembalikan ke Buku Rutinan
                </Button>
              )}
              {userCanEdit && !isTransferTransaction(infoTx) && (
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
            className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 md:bottom-6"
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
            <div className="mb-1 text-xs font-medium text-slate-600">Lampiran (opsional)</div>
            <div className="grid gap-2">
              {form.attachmentUrl && !form.attachmentFile ? (
                <div className="grid gap-2">
                  {/* Preview gambar jika URL adalah gambar */}
                  {(() => {
                    const url = form.attachmentUrl.toLowerCase();
                    const isImage = url.includes('.jpg') || url.includes('.jpeg') || 
                                   url.includes('.png') || url.includes('.gif') || 
                                   url.includes('.webp') || url.includes('.bmp');
                    
                    if (isImage) {
                      return (
                        <div className="rounded-lg border border-slate-300 overflow-hidden">
                          <img 
                            src={form.attachmentUrl} 
                            alt="Preview lampiran" 
                            className="w-full h-auto max-h-64 object-contain bg-slate-50"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 text-slate-500"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <a
                      href={form.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-blue-600 hover:underline truncate"
                    >
                      Lihat lampiran
                    </a>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, attachmentUrl: undefined })}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Hapus lampiran"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : form.attachmentFile ? (
                <div className="grid gap-2">
                  {/* Preview gambar jika file adalah gambar */}
                  {form.attachmentFile.type.startsWith('image/') && (
                    <div className="rounded-lg border border-emerald-300 overflow-hidden">
                      <img 
                        src={URL.createObjectURL(form.attachmentFile)} 
                        alt="Preview file" 
                        className="w-full h-auto max-h-64 object-contain bg-slate-50"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 text-emerald-600"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <span className="flex-1 text-sm text-slate-700 truncate">
                      {form.attachmentFile.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({(form.attachmentFile.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, attachmentFile: null })}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Hapus file"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  <span>Pilih file (gambar, PDF, dll)</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // Max 5MB
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Ukuran file maksimal 5MB')
                          return
                        }
                        setForm({ ...form, attachmentFile: file })
                      }
                    }}
                  />
                </label>
              )}
              <div className="text-xs text-slate-500">
                Format: gambar, PDF, Word, Excel. Maksimal 5MB.
              </div>
            </div>
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
            <Button onClick={() => void submit()} disabled={uploadingFile}>
              {uploadingFile ? 'Mengupload...' : editingId ? 'Simpan' : 'Tambah'}
            </Button>
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

      {/* Modal Reverse Transfer */}
      <Modal
        open={openReverseModal}
        title="Kembalikan ke Buku Rutinan"
        onClose={() => {
          setOpenReverseModal(false)
          setReverseTransferData(null)
        }}
      >
        {reverseTransferData && (
          <div className="grid gap-4">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Kategori</div>
                <div className="font-medium text-slate-900">{reverseTransferData.categoryName}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Periode</div>
                <div className="font-medium text-slate-900">{reverseTransferData.periodKey}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-500">Nominal</div>
                <div className="font-medium text-slate-900">{formatIDR(reverseTransferData.amount)}</div>
              </div>
              <div className="grid gap-2">
                <div className="text-slate-500">Pilih Buku Rutinan Tujuan</div>
                <Select
                  value={selectedRoutineBookId}
                  onChange={(e) => setSelectedRoutineBookId(e.target.value)}
                >
                  {availableRoutineBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setOpenReverseModal(false)
                  setReverseTransferData(null)
                }}
              >
                Batal
              </Button>
              <Button
                onClick={confirmReverseTransfer}
                disabled={availableRoutineBooks.length === 0}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Kembalikan ke Buku Rutinan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success Modal untuk Reverse Transfer */}
      <SuccessModal
        open={openReverseSuccessModal}
        onClose={handleReverseSuccessModalClose}
        title="Berhasil Dikembalikan!"
        message="Transaksi berhasil dikembalikan ke buku rutinan"
        details={reverseSuccessData ? `${reverseSuccessData.categoryName} sebesar ${formatIDR(reverseSuccessData.amount)} periode ${reverseSuccessData.periodKey} telah dikembalikan ke ${reverseSuccessData.routineBookName}. Status transfer di buku rutinan sudah direset.` : ''}
        actionLabel="Lihat Buku Rutinan"
        onAction={handleViewRoutineBook}
      />
    </div>
  )
}

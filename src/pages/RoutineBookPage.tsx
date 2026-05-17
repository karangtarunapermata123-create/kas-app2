import { useEffect, useMemo, useState, useRef } from 'react'
import { NavLink, useParams, useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Select from '../components/Select'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import SuccessModal from '../components/SuccessModal'
import { useAuth, canEditTransactions } from '../lib/auth'
import {
  addRoutineSession,
  deleteRoutineSession,
  deleteRoutineChecklist,
  getBooks,
  getRoutineCategories,
  getRoutineChecklists,
  getRoutineFrequency,
  getRoutineMembers,
  getRoutineSessions,
  renameRoutineSession,
  updateRoutineSession,
  toggleRoutineChecklist,
  transferRoutineToTransaction,
} from '../lib/store'
import type { Book, RoutineCategory, RoutineChecklist, RoutineFrequency, RoutineMember, RoutineSession } from '../lib/types'
import type { Profile } from '../lib/auth'
import { getAllProfiles } from '../lib/users'
import { uid } from '../lib/id'
import { todayISO } from '../lib/date'
import { formatIDR } from '../lib/money'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export default function RoutineBookPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const userCanEdit = canEditTransactions(profile?.role)
  
  if (!bookId) return null

  const safeBookId = bookId

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  
  // Drag to scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 2 // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
    
    // Mark as dragged if moved more than 5px
    if (Math.abs(walk) > 5) {
      setHasDragged(true)
    }
  }

  const handleCategoryClick = (categoryId: string | null) => {
    // Prevent click if user was dragging
    if (hasDragged) {
      setHasDragged(false)
      return
    }
    setSelectedCategoryId(categoryId)
  }

  const [book, setBook] = useState<Book | undefined>(undefined)
  const [members, setMembers] = useState<RoutineMember[]>([])
  const [categories, setCategories] = useState<RoutineCategory[]>([])
  const [checklists, setChecklists] = useState<RoutineChecklist[]>([])
  const [sessions, setSessions] = useState<RoutineSession[]>([])
  const [frequency, setFrequency] = useState<RoutineFrequency>('bulanan')
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [newSessionName, setNewSessionName] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [editNames, setEditNames] = useState<Record<string, string>>({})
  
  // State untuk modal setoran
  const [countModalOpen, setCountModalOpen] = useState(false)
  const [countModalData, setCountModalData] = useState<{
    memberId: string
    categoryId: string
    periodKey: string
    currentCount: number
    memberName: string
    categoryName: string
  } | null>(null)
  const [tempCount, setTempCount] = useState(0) // Temporary count untuk edit

  // State untuk kelola anggota/kategori per sesi
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [openSessionMemberModal, setOpenSessionMemberModal] = useState(false)
  const [openSessionCategoryModal, setOpenSessionCategoryModal] = useState(false)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())
  const [availableSessionCategories, setAvailableSessionCategories] = useState<RoutineCategory[]>([])
  const [selectedSessionCategoryIds, setSelectedSessionCategoryIds] = useState<Set<string>>(new Set())
  const [newSessionCategoryName, setNewSessionCategoryName] = useState('')
  const [newSessionCategoryAmount, setNewSessionCategoryAmount] = useState('')
  
  // State untuk modal detail laporan
  const [openDetailModal, setOpenDetailModal] = useState(false)
  
  // State untuk modal transfer
  const [openTransferModal, setOpenTransferModal] = useState(false)
  const [transferData, setTransferData] = useState<{
    monthIndex: number
    categoryId: string
    categoryName: string
    amount: number
    periodKey: string
  } | null>(null)
  const [availableTargetBooks, setAvailableTargetBooks] = useState<Book[]>([])
  const [selectedTargetBookId, setSelectedTargetBookId] = useState<string>('')

  // State untuk modal success transfer
  const [openSuccessModal, setOpenSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{
    categoryName: string
    amount: number
    targetBookName: string
    periodKey: string
  } | null>(null)

  const refreshData = async () => {
    const [books, fetchedMembers, fetchedCategories, fetchedChecklists, fetchedSessions, fetchedFrequency] =
      await Promise.all([
        getBooks(),
        getRoutineMembers(safeBookId),
        getRoutineCategories(safeBookId),
        getRoutineChecklists(safeBookId),
        getRoutineSessions(safeBookId),
        getRoutineFrequency(safeBookId),
      ])
    setBook(books.find((b) => b.id === safeBookId))
    setMembers(fetchedMembers)
    setCategories(fetchedCategories)
    setChecklists(fetchedChecklists)
    setSessions(fetchedSessions)
    setFrequency(fetchedFrequency)
  }

  useEffect(() => {
    refreshData()
  }, [safeBookId])

  // Set initial selectedSessionId once sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id)
    }
  }, [sessions])

  useEffect(() => {
    const onStorage = () => refreshData()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [safeBookId])

  const getPeriodKey = (monthIndex: number) =>
    `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`

  const getArisanPeriodKey = (roundIndex: number) =>
    `${selectedSessionId}-${String(roundIndex + 1).padStart(2, '0')}`

  const getChecklistStatus = (memberId: string, categoryId: string, periodKey: string) => {
    return checklists.find(
      (c) => c.periodKey === periodKey && c.memberId === memberId && c.categoryId === categoryId,
    )
  }

  const handleCheckboxClick = (memberId: string, categoryId: string, periodKey: string) => {
    if (!userCanEdit) return // Member tidak bisa edit
    
    // Cek apakah sudah ditransfer
    if (isTransferred(periodKey, categoryId)) {
      alert('Data ini sudah ditransfer ke buku transaksi dan tidak bisa diubah')
      return
    }
    
    const checklist = getChecklistStatus(memberId, categoryId, periodKey)
    const member = displayMembers.find(m => m.id === memberId)
    const category = displayCategories.find(c => c.id === categoryId)
    
    const currentCount = checklist?.count ?? 0
    
    setCountModalData({
      memberId,
      categoryId,
      periodKey,
      currentCount,
      memberName: member?.name ?? '',
      categoryName: category?.name ?? '',
    })
    setTempCount(currentCount === 0 ? 1 : currentCount)
    setCountModalOpen(true)
  }

  const handleToggle = async (memberId: string, categoryId: string, periodKey: string, checked: boolean, count: number, notPaid: boolean = false) => {
    await toggleRoutineChecklist(safeBookId, periodKey, memberId, categoryId, checked, todayISO(), count, notPaid)
    await refreshData()
  }

  const handleSave = async () => {
    if (!countModalData) return
    const { memberId, categoryId, periodKey } = countModalData
    
    if (tempCount > 0) {
      // Simpan dengan count
      await handleToggle(memberId, categoryId, periodKey, true, tempCount, false)
    } else {
      // Jika 0, hapus data
      await deleteRoutineChecklist(safeBookId, periodKey, memberId, categoryId)
      await refreshData()
    }
    
    closeCountModal()
  }

  const handleNotPaid = async () => {
    if (!countModalData) return
    const { memberId, categoryId, periodKey } = countModalData
    await handleToggle(memberId, categoryId, periodKey, true, 1, true)
    closeCountModal()
  }

  const handleDelete = async () => {
    if (!countModalData) return
    const { memberId, categoryId, periodKey } = countModalData
    await deleteRoutineChecklist(safeBookId, periodKey, memberId, categoryId)
    await refreshData()
    closeCountModal()
  }

  const closeCountModal = () => {
    setCountModalOpen(false)
    setCountModalData(null)
    setTempCount(0)
  }

  // Fungsi untuk kelola anggota per sesi
  async function handleOpenSessionMemberModal(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    
    const profiles = await getAllProfiles()
    setAllProfiles(profiles)
    
    // Set selected dari session.members yang sudah ada
    const existingNames = new Set((session.members || []).map(m => m.name.trim().toLowerCase()))
    const selected = new Set(
      profiles
        .filter(p => existingNames.has(p.full_name.trim().toLowerCase()))
        .map(p => p.id)
    )
    setSelectedProfileIds(selected)
    setEditingSessionId(sessionId)
    setOpenSessionMemberModal(true)
  }

  function toggleSessionProfileSelection(profileId: string) {
    setSelectedProfileIds(prev => {
      const next = new Set(prev)
      if (next.has(profileId)) {
        next.delete(profileId)
      } else {
        next.add(profileId)
      }
      return next
    })
  }

  async function applySessionMembers() {
    if (!editingSessionId) return
    
    const selectedProfiles = allProfiles.filter(p => selectedProfileIds.has(p.id))
    const members: RoutineMember[] = selectedProfiles.map(p => ({
      id: uid('rm'),
      name: p.full_name
    }))
    
    await updateRoutineSession(safeBookId, editingSessionId, { members })
    await refreshData()
    setOpenSessionMemberModal(false)
    setEditingSessionId(null)
  }

  // Fungsi untuk kelola kategori per sesi
  async function handleOpenSessionCategoryModal(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    
    // Load kategori yang sudah ada dari session.categories
    const existingCategories = (session.categories || []).map(c => ({
      id: uid('rc'),
      name: c.name,
      amount: c.amount
    }))
    
    setAvailableSessionCategories(existingCategories)
    
    // Tandai semua kategori yang sudah ada sebagai selected
    const allIds = new Set(existingCategories.map(c => c.id))
    setSelectedSessionCategoryIds(allIds)
    setEditingSessionId(sessionId)
    setOpenSessionCategoryModal(true)
  }

  function toggleSessionCategorySelection(categoryId: string) {
    setSelectedSessionCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function addSessionCategoryToModal() {
    const name = newSessionCategoryName.trim()
    const amount = Number(newSessionCategoryAmount.replace(/\D/g, '')) || 0
    
    if (!name || amount <= 0) return
    
    const newCategory: RoutineCategory = {
      id: uid('rc'),
      name,
      amount
    }
    
    setAvailableSessionCategories(prev => [...prev, newCategory])
    setSelectedSessionCategoryIds(prev => new Set([...prev, newCategory.id]))
    setNewSessionCategoryName('')
    setNewSessionCategoryAmount('')
  }

  function updateSessionCategoryInModal(categoryId: string, field: 'name' | 'amount', value: string) {
    setAvailableSessionCategories(prev => prev.map(c => {
      if (c.id === categoryId) {
        if (field === 'name') {
          return { ...c, name: value }
        } else {
          const amount = Number(value.replace(/\D/g, '')) || 0
          return { ...c, amount }
        }
      }
      return c
    }))
  }

  function removeSessionCategoryFromModal(categoryId: string) {
    setAvailableSessionCategories(prev => prev.filter(c => c.id !== categoryId))
    setSelectedSessionCategoryIds(prev => {
      const next = new Set(prev)
      next.delete(categoryId)
      return next
    })
  }

  async function applySessionCategories() {
    if (!editingSessionId) return
    
    const selectedCats = availableSessionCategories.filter(c => selectedSessionCategoryIds.has(c.id))
    const categories: RoutineCategory[] = selectedCats.map(c => ({
      id: uid('rc'),
      name: c.name,
      amount: c.amount
    }))
    
    await updateRoutineSession(safeBookId, editingSessionId, { categories })
    await refreshData()
    setOpenSessionCategoryModal(false)
    setEditingSessionId(null)
  }

  // Untuk arisan, gunakan members dan categories dari session yang dipilih
  // Untuk bulanan, gunakan members dan categories global
  const displayMembers = useMemo(() => {
    if (frequency === 'arisan' && selectedSessionId) {
      const session = sessions.find(s => s.id === selectedSessionId)
      return session?.members || []
    }
    return members
  }, [frequency, selectedSessionId, sessions, members])

  const displayCategories = useMemo(() => {
    if (frequency === 'arisan' && selectedSessionId) {
      const session = sessions.find(s => s.id === selectedSessionId)
      return session?.categories || []
    }
    return categories
  }, [frequency, selectedSessionId, sessions, categories])

  const filteredCategories = useMemo(() => {
    if (selectedCategoryId === null) return displayCategories
    return displayCategories.filter(c => c.id === selectedCategoryId)
  }, [displayCategories, selectedCategoryId])

  const periodCount = frequency === 'bulanan' ? 12 : displayMembers.length

  const totals = useMemo(() => {
    let total = 0
    for (const member of displayMembers) {
      for (const category of displayCategories) {
        for (let p = 0; p < periodCount; p++) {
          const periodKey =
            frequency === 'bulanan' ? getPeriodKey(p) : getArisanPeriodKey(p)
          const checklist = getChecklistStatus(member.id, category.id, periodKey)
          // Hanya hitung jumlah setoran (count), tidak termasuk not_paid dan transferred
          if (checklist?.checked && !checklist.notPaid && !checklist.transferred) {
            total += checklist.count ?? 1
          }
        }
      }
    }
    return total
  }, [displayMembers, displayCategories, checklists, selectedYear, frequency, sessions, selectedSessionId])

  const categoryTotals = useMemo(() => {
    const totalsMap = new Map<string, number>()
    for (const member of displayMembers) {
      for (const category of displayCategories) {
        let checkCount = 0
        for (let p = 0; p < periodCount; p++) {
          const periodKey =
            frequency === 'bulanan' ? getPeriodKey(p) : getArisanPeriodKey(p)
          const checklist = getChecklistStatus(member.id, category.id, periodKey)
          // Hanya hitung jumlah setoran (count), tidak termasuk not_paid dan transferred
          if (checklist?.checked && !checklist.notPaid && !checklist.transferred) {
            checkCount += checklist.count ?? 1
          }
        }
        totalsMap.set(`${member.id}:${category.id}`, checkCount)
      }
    }
    return totalsMap
  }, [displayMembers, displayCategories, checklists, selectedYear, frequency, sessions, selectedSessionId, periodCount])

  const periodTotals = useMemo(() => {
    const totalsArr = new Array(periodCount).fill(0)
    for (let p = 0; p < periodCount; p++) {
      let t = 0
      for (const member of displayMembers) {
        for (const category of displayCategories) {
          const periodKey =
            frequency === 'bulanan' ? getPeriodKey(p) : getArisanPeriodKey(p)
          const checklist = getChecklistStatus(member.id, category.id, periodKey)
          // Hanya hitung jumlah setoran (count), tidak termasuk not_paid dan transferred
          if (checklist?.checked && !checklist.notPaid && !checklist.transferred) {
            t += checklist.count ?? 1
          }
        }
      }
      totalsArr[p] = t
    }
    return totalsArr
  }, [displayMembers, displayCategories, checklists, selectedYear, frequency, sessions, selectedSessionId])

  const years = useMemo(() => {
    const current = new Date().getFullYear()
    const ys: number[] = []
    for (let y = current - 5; y <= current + 5; y++) ys.push(y)
    return ys
  }, [])

  const handleCellClick = async (periodIndex: number, categoryId: string, amount: number) => {
    if (amount === 0) return // Tidak ada yang bisa ditransfer
    
    const category = displayCategories.find(c => c.id === categoryId)
    if (!category) return
    
    const periodKey = frequency === 'bulanan'
      ? getPeriodKey(periodIndex)
      : getArisanPeriodKey(periodIndex)
    
    // Cek apakah sudah ditransfer
    const isAlreadyTransferred = checklists.some(
      c => c.periodKey === periodKey && 
           c.categoryId === categoryId && 
           c.transferred === true
    )
    
    if (isAlreadyTransferred) {
      alert('Data ini sudah ditransfer ke buku transaksi')
      return
    }
    
    // Load buku transaksi (biasa) yang tersedia
    const allBooks = await getBooks()
    const bisaBooks = allBooks.filter(b => b.type === 'biasa')
    setAvailableTargetBooks(bisaBooks)
    setSelectedTargetBookId(bisaBooks[0]?.id ?? '')
    
    setTransferData({
      monthIndex: periodIndex,
      categoryId,
      categoryName: category.name,
      amount,
      periodKey
    })

    // Tutup modal detail dulu, lalu buka modal transfer
    setOpenDetailModal(false)
    setTimeout(() => setOpenTransferModal(true), 200)
  }

  const handleTransfer = async () => {
    if (!transferData) return
    if (!selectedTargetBookId) {
      alert('Pilih buku transaksi tujuan terlebih dahulu')
      return
    }
    
    const targetBook = availableTargetBooks.find(b => b.id === selectedTargetBookId)
    
    try {
      await transferRoutineToTransaction(
        safeBookId,
        transferData.periodKey,
        transferData.categoryId,
        transferData.categoryName,
        transferData.amount,
        selectedTargetBookId,
        frequency === 'arisan' ? (sessions.find(s => s.id === selectedSessionId)?.name) : undefined,
        book?.name,
      )
      
      await refreshData()
      setOpenTransferModal(false)
      
      // Set data untuk success modal
      setSuccessData({
        categoryName: transferData.categoryName,
        amount: transferData.amount,
        targetBookName: targetBook?.name || 'Buku Transaksi',
        periodKey: transferData.periodKey
      })
      
      setTransferData(null)
      
      // Tampilkan success modal
      setOpenSuccessModal(true)
      
    } catch (error) {
      console.error('Error transferring:', error)
      alert('Gagal mentransfer data')
    }
  }

  const handleSuccessModalClose = () => {
    setOpenSuccessModal(false)
    setSuccessData(null)
    // Buka kembali modal detail supaya user bisa lihat status terbaru
    setTimeout(() => setOpenDetailModal(true), 200)
  }

  const handleViewTransactions = () => {
    if (!successData) return
    setOpenSuccessModal(false)
    setSuccessData(null)
    // Navigate ke halaman transaksi dengan bulan sekarang menggunakan React Router
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    
    navigate(`/buku-kas/${selectedTargetBookId}/transaksi`, {
      state: { selectedMonth: currentMonth }
    })
  }

  const isTransferred = (periodKey: string, categoryId: string) => {
    return checklists.some(
      c => c.periodKey === periodKey && 
           c.categoryId === categoryId && 
           c.transferred === true
    )
  }

  return (
    <div className="grid gap-4">
      {frequency === 'bulanan' ? (
        <div className="flex items-center gap-2">
          <div className="max-w-[140px]">
            <Select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" onClick={() => setOpenDetailModal(true)}>
            Lihat Detail
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {sessions.find((s) => s.id === selectedSessionId)?.name ?? 'Pilih sesi'}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <Button variant="secondary" onClick={() => setOpenDetailModal(true)}>
            Lihat Detail
          </Button>
        </div>
      )}

      {displayMembers.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">
            {frequency === 'arisan' 
              ? 'Belum ada anggota di sesi ini. Kelola anggota melalui "Kelola sesi".' 
              : 'Belum ada anggota. Kelola dari modal Buku Kas.'}
          </div>
        </Card>
      ) : displayCategories.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">
            {frequency === 'arisan' 
              ? 'Belum ada kategori di sesi ini. Kelola kategori melalui "Kelola sesi".' 
              : 'Belum ada kategori. Kelola dari modal Buku Kas.'}
          </div>
        </Card>
      ) : frequency !== 'bulanan' && sessions.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">Belum ada sesi arisan. Tambahkan sesi di atas.</div>
        </Card>
      ) : (
        <>
          <div 
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`flex gap-2 text-sm overflow-x-auto scrollbar-hide px-4 py-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
          >
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              className={`rounded-lg px-3 py-1.5 font-medium transition whitespace-nowrap shrink-0 ${
                selectedCategoryId === null
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Semua
            </button>
            {displayCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCategoryClick(c.id)}
                className={`rounded-lg px-3 py-1.5 font-medium transition whitespace-nowrap shrink-0 ${
                  selectedCategoryId === c.id
                    ? 'bg-slate-900 dark:bg-slate-700 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {c.name}: {formatIDR(c.amount)}
              </button>
            ))}
          </div>

          <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full border-separate border-spacing-0 bg-white dark:bg-slate-800 text-left text-sm shadow-sm" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-3 text-center"
                    style={{ width: '80px' }}
                  >
                    Anggota
                  </th>
                  <th
                    className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-3 text-center"
                    style={{ left: '80px', width: '90px' }}
                  >
                    Kategori
                  </th>
                  {frequency === 'bulanan'
                    ? MONTH_NAMES.map((month, idx) => (
                        <th
                          key={idx}
                          className="sticky top-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-1 py-3 text-center"
                          style={{ width: '48px' }}
                        >
                          {month}
                        </th>
                      ))
                    : Array.from({ length: displayMembers.length }, (_, idx) => (
                        <th
                          key={idx}
                          className="sticky top-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-1 py-3 text-center"
                          style={{ width: '48px' }}
                        >
                          {idx + 1}
                        </th>
                      ))}
                  <th className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-center" style={{ width: '120px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayMembers.map((member) =>
                  filteredCategories.map((category, catIdx) => {
                    const isFirstCategoryOfMember = catIdx === 0
                    return (
                      <tr key={`${member.id}-${category.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        {isFirstCategoryOfMember ? (
                          <td
                            rowSpan={filteredCategories.length}
                            className="sticky left-0 z-20 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-3 text-center font-medium text-slate-900 dark:text-white"
                            style={{ minWidth: '80px' }}
                          >
                            {member.name}
                          </td>
                        ) : null}

                        <td
                          className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-3 text-center"
                          style={{ left: '80px', minWidth: '90px' }}
                        >
                          <div className="text-sm text-slate-900 dark:text-white">{category.name}</div>
                        </td>

                        {frequency === 'bulanan'
                          ? MONTH_NAMES.map((_, pIdx) => {
                              const periodKey = getPeriodKey(pIdx)
                              const checklist = getChecklistStatus(member.id, category.id, periodKey)
                              const checked = checklist?.checked ?? false
                              const count = checklist?.count ?? 1
                              const isNotPaid = checklist?.notPaid ?? false
                              const transferred = isTransferred(periodKey, category.id)
                              
                              return (
                                <td 
                                  key={pIdx} 
                                  className="border-b border-r border-slate-200 dark:border-slate-700 py-3"
                                >
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => handleCheckboxClick(member.id, category.id, periodKey)}
                                      disabled={!userCanEdit || transferred}
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                                        !userCanEdit || transferred
                                          ? 'cursor-not-allowed opacity-60'
                                          : ''
                                      } ${
                                        transferred
                                          ? 'border-green-600 bg-green-600 text-white'
                                          : isNotPaid
                                          ? 'border-rose-600 bg-rose-600 text-white'
                                          : checked
                                          ? 'border-slate-900 bg-slate-900 text-white'
                                          : 'border-slate-300 bg-white hover:border-slate-400'
                                      }`}
                                      title={transferred ? 'Sudah ditransfer ke buku transaksi' : ''}
                                    >
                                      {transferred ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="h-3 w-3"
                                        >
                                          <path d="M7 17L17 7" />
                                          <path d="M17 17H7V7" />
                                        </svg>
                                      ) : isNotPaid ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="h-3 w-3"
                                        >
                                          <path d="M18 6 6 18" />
                                          <path d="m6 6 12 12" />
                                        </svg>
                                      ) : checked ? (
                                        count === 1 ? (
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-3.5 w-3.5"
                                          >
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        ) : (
                                          <span className="text-[10px] font-bold leading-none">{count}x</span>
                                        )
                                      ) : null}
                                    </button>
                                  </div>
                                </td>
                              )
                            })
                          : Array.from({ length: displayMembers.length }, (_, pIdx) => {
                              const periodKey = getArisanPeriodKey(pIdx)
                              const checklist = getChecklistStatus(member.id, category.id, periodKey)
                              const checked = checklist?.checked ?? false
                              const count = checklist?.count ?? 1
                              const isNotPaid = checklist?.notPaid ?? false
                              const transferred = isTransferred(periodKey, category.id)
                              
                              return (
                                <td 
                                  key={pIdx} 
                                  className="border-b border-r border-slate-200 dark:border-slate-700 py-3"
                                >
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => handleCheckboxClick(member.id, category.id, periodKey)}
                                      disabled={!userCanEdit || transferred}
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                                        !userCanEdit || transferred
                                          ? 'cursor-not-allowed opacity-60'
                                          : ''
                                      } ${
                                        transferred
                                          ? 'border-green-600 bg-green-600 text-white'
                                          : isNotPaid
                                          ? 'border-rose-600 bg-rose-600 text-white'
                                          : checked
                                          ? 'border-slate-900 bg-slate-900 text-white'
                                          : 'border-slate-300 bg-white hover:border-slate-400'
                                      }`}
                                      title={transferred ? 'Sudah ditransfer ke buku transaksi' : ''}
                                    >
                                      {transferred ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="h-3 w-3"
                                        >
                                          <path d="M7 17L17 7" />
                                          <path d="M17 17H7V7" />
                                        </svg>
                                      ) : isNotPaid ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="h-3 w-3"
                                        >
                                          <path d="M18 6 6 18" />
                                          <path d="m6 6 12 12" />
                                        </svg>
                                      ) : checked ? (
                                        count === 1 ? (
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-3.5 w-3.5"
                                          >
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        ) : (
                                          <span className="text-[10px] font-bold leading-none">{count}x</span>
                                        )
                                      ) : null}
                                    </button>
                                  </div>
                                </td>
                              )
                            })}

                        <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-center font-medium text-emerald-700 dark:text-emerald-400">
                          {categoryTotals.get(`${member.id}:${category.id}`) || 0}x
                        </td>
                      </tr>
                    )
                  }),
                )}

                <tr className="bg-slate-50 dark:bg-slate-900 font-medium">
                  <td className="sticky left-0 z-20 border-r border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-3 text-center text-slate-900 dark:text-white">
                    Total
                  </td>
                  <td
                    className="sticky left-0 z-10 border-r border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-3"
                    style={{ left: '80px' }}
                  ></td>
                  {periodTotals.map((t, pIdx) => (
                    <td
                      key={pIdx}
                      className="border-r border-t-2 border-slate-200 dark:border-slate-700 px-1 py-3 text-center text-emerald-700 dark:text-emerald-400"
                    >
                      {t}x
                    </td>
                  ))}
                  <td className="border-t-2 border-slate-200 dark:border-slate-700 px-4 py-3 text-center text-emerald-700 dark:text-emerald-400">{totals}x</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={pickOpen} title="Pilih Sesi" onClose={() => setPickOpen(false)}>
        <div className="grid gap-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedSessionId(s.id)
                setPickOpen(false)
              }}
              className={
                'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ' +
                (selectedSessionId === s.id
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              <span>{s.name}</span>
              {selectedSessionId === s.id && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          ))}
          {sessions.length === 0 ? (
            <div className="text-sm text-slate-500">Tidak ada sesi.</div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const map: Record<string, string> = {}
              sessions.forEach((s) => (map[s.id] = s.name))
              setEditNames(map)
              setPickOpen(false)
              setManageOpen(true)
            }}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Kelola sesi
          </button>
        </div>
      </Modal>

      <Modal open={manageOpen} title="Kelola Sesi" onClose={() => setManageOpen(false)}>
        <div className="grid gap-3">
          {sessions.map((s) => (
            <div key={s.id} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={editNames[s.id] ?? s.name}
                  onChange={(e) =>
                    setEditNames((prev) => ({ ...prev, [s.id]: e.target.value }))
                  }
                  className="flex-1"
                />
                <Button
                  onClick={async () => {
                    await deleteRoutineSession(safeBookId, s.id)
                    if (selectedSessionId === s.id) {
                      const remaining = (await getRoutineSessions(safeBookId)).filter((x) => x.id !== s.id)
                      setSelectedSessionId(remaining[0]?.id ?? '')
                    }
                    await refreshData()
                  }}
                  className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  Hapus
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => handleOpenSessionMemberModal(s.id)}>
                  Kelola Anggota
                </Button>
                <Button variant="secondary" onClick={() => handleOpenSessionCategoryModal(s.id)}>
                  Kelola Kategori
                </Button>
              </div>
              <div className="text-xs text-slate-500">
                {s.members && s.members.length > 0 ? `${s.members.length} anggota` : 'Belum ada anggota'} • {s.categories && s.categories.length > 0 ? `${s.categories.length} kategori` : 'Belum ada kategori'}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t pt-3">
            <Input
              placeholder="Nama sesi baru"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={async () => {
                const name = newSessionName.trim()
                if (!name) return
                const added = await addRoutineSession(safeBookId, name)
                setNewSessionName('')
                setSelectedSessionId(added.id)
                setEditNames((prev) => ({ ...prev, [added.id]: added.name }))
                await refreshData()
              }}
            >
              Tambah sesi
            </Button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-sm text-slate-500">Tidak ada sesi.</div>
          ) : (
            <Button
              onClick={async () => {
                await Promise.all(
                  sessions
                    .filter((s) => editNames[s.id] && editNames[s.id] !== s.name)
                    .map((s) => renameRoutineSession(safeBookId, s.id, editNames[s.id]))
                )
                await refreshData()
                setManageOpen(false)
              }}
            >
              Simpan
            </Button>
          )}
        </div>
      </Modal>

      <Modal open={countModalOpen} title="Atur Jumlah Setoran" onClose={closeCountModal}>
        {countModalData && (
          <div className="grid gap-5">

            {/* Info anggota & kategori */}
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base">
                {countModalData.memberName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{countModalData.memberName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{countModalData.categoryName}</div>
              </div>
            </div>

            {/* Counter */}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setTempCount(Math.max(0, tempCount - 1))}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                aria-label="Kurangi"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M5 12h14" />
                </svg>
              </button>

              <div className="flex flex-col items-center gap-0.5">
                <div className="text-6xl font-bold tabular-nums text-slate-900 dark:text-white leading-none">{tempCount}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">kali setoran</div>
              </div>

              <button
                type="button"
                onClick={() => setTempCount(tempCount + 1)}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                aria-label="Tambah"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 dark:border-slate-700" />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="danger" onClick={handleNotPaid}>
                Tidak Setor
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Hapus
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeCountModal}>Batal</Button>
              <Button onClick={handleSave}>Simpan</Button>
            </div>

          </div>
        )}
      </Modal>

      <Modal
        open={openSessionMemberModal}
        title="Kelola Anggota Sesi"
        onClose={() => setOpenSessionMemberModal(false)}
      >
        <div className="grid gap-4">
          <div className="max-h-96 overflow-auto">
            {allProfiles.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Belum ada user terdaftar
              </div>
            ) : (
              <div className="grid gap-2">
                {allProfiles.map((profile) => (
                  <label
                    key={profile.id}
                    className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-slate-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProfileIds.has(profile.id)}
                      onChange={() => toggleSessionProfileSelection(profile.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {profile.full_name}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenSessionMemberModal(false)}>
              Batal
            </Button>
            <Button onClick={applySessionMembers}>
              Terapkan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openSessionCategoryModal}
        title="Kelola Kategori Sesi"
        onClose={() => setOpenSessionCategoryModal(false)}
      >
        <div className="grid gap-4">
          <div className="max-h-96 overflow-auto">
            {availableSessionCategories.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Tidak ada kategori tersedia
              </div>
            ) : (
              <div className="grid gap-2">
                {availableSessionCategories.map((category) => (
                  <div
                    key={category.id}
                    className="grid grid-cols-[auto_1fr_140px_auto] items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSessionCategoryIds.has(category.id)}
                      onChange={() => toggleSessionCategorySelection(category.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <Input
                      placeholder="Nama kategori"
                      value={category.name}
                      onChange={(e) => updateSessionCategoryInModal(category.id, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Nominal"
                      inputMode="numeric"
                      value={category.amount ? String(category.amount) : ''}
                      onChange={(e) => updateSessionCategoryInModal(category.id, 'amount', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeSessionCategoryFromModal(category.id)}
                      className="text-rose-600 hover:text-rose-700 text-xs font-medium px-2"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="mb-2 text-xs font-medium text-slate-600">Tambah Kategori Baru</div>
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  placeholder="Nama kategori"
                  value={newSessionCategoryName}
                  onChange={(e) => setNewSessionCategoryName(e.target.value)}
                />
                <Input
                  placeholder="Nominal"
                  inputMode="numeric"
                  value={newSessionCategoryAmount}
                  onChange={(e) => setNewSessionCategoryAmount(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={addSessionCategoryToModal} className="w-full">
                Tambah ke Daftar
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenSessionCategoryModal(false)}>
              Batal
            </Button>
            <Button onClick={applySessionCategories}>
              Terapkan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDetailModal}
        title={frequency === 'bulanan' ? `Detail Laporan Tahun ${selectedYear}` : `Detail Laporan ${sessions.find(s => s.id === selectedSessionId)?.name ?? 'Sesi'}`}
        onClose={() => setOpenDetailModal(false)}
      >
        {/* Summary card */}
        {(() => {
          let totalSaldo = 0
          let totalTransferred = 0
          for (let p = 0; p < periodCount; p++) {
            const periodKey = frequency === 'bulanan' ? getPeriodKey(p) : getArisanPeriodKey(p)
            displayCategories.forEach((category) => {
              displayMembers.forEach((member) => {
                const checklist = getChecklistStatus(member.id, category.id, periodKey)
                if (checklist?.checked && !checklist.notPaid) {
                  const amount = (checklist.count ?? 1) * category.amount
                  if (checklist.transferred) {
                    totalTransferred += amount
                  } else {
                    totalSaldo += amount
                  }
                }
              })
            })
          }
          return (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Saldo</div>
                <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{formatIDR(totalSaldo)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sudah Ditransfer</div>
                <div className="text-base font-semibold text-blue-600 dark:text-blue-400">{formatIDR(totalTransferred)}</div>
              </div>
            </div>
          )
        })()}
        <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
            <path d="M15 15l-2 5L9 9l11 4-5 2z"/>
          </svg>
          Klik cell untuk transfer ke buku transaksi
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 bg-white dark:bg-slate-800 text-left text-sm" style={{ tableLayout: 'fixed', minWidth: '600px' }}>
            <colgroup>
              <col style={{ width: '100px' }} />
              {displayCategories.map((category) => (
                <col key={category.id} style={{ width: '140px' }} />
              ))}
              <col style={{ width: '140px' }} />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
                  {frequency === 'bulanan' ? 'Bulan' : 'Putaran'}
                </th>
                  {displayCategories.map((category) => (
                    <th
                      key={category.id}
                      className="border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-right"
                    >
                      {category.name}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-right font-semibold">
                    Total
                  </th>
                </tr>
            </thead>
            <tbody>
              {(frequency === 'bulanan' ? MONTH_NAMES : Array.from({ length: displayMembers.length }, (_, i) => `Putaran ${i + 1}`)).map((periodName, periodIndex) => {
                const periodKey = frequency === 'bulanan' ? getPeriodKey(periodIndex) : getArisanPeriodKey(periodIndex)
                const categoryAmounts: Record<string, number> = {}
                const categoryAmountsAll: Record<string, number> = {} // Untuk tampilan (termasuk transferred)
                let periodTotal = 0

                // Calculate amounts for each category in this period
                displayCategories.forEach((category) => {
                  let categoryAmount = 0 // Untuk total (tidak termasuk transferred)
                  let categoryAmountAll = 0 // Untuk tampilan (termasuk transferred)
                  
                  displayMembers.forEach((member) => {
                    const checklist = getChecklistStatus(member.id, category.id, periodKey)
                    if (checklist?.checked && !checklist.notPaid) {
                      const count = checklist.count ?? 1
                      const amount = count * category.amount
                      
                      // Untuk tampilan: hitung semua (termasuk transferred)
                      categoryAmountAll += amount
                      
                      // Untuk total: hanya yang belum ditransfer
                      if (!checklist.transferred) {
                        categoryAmount += amount
                      }
                    }
                  })
                  
                  categoryAmounts[category.id] = categoryAmount
                  categoryAmountsAll[category.id] = categoryAmountAll
                  periodTotal += categoryAmount // Total hanya yang belum ditransfer
                })

                return (
                  <tr key={periodIndex} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {periodName}
                    </td>
                    {displayCategories.map((category) => {
                      const amount = categoryAmounts[category.id] || 0 // Untuk transfer (belum ditransfer)
                      const displayAmount = categoryAmountsAll[category.id] || 0 // Untuk tampilan (semua)
                      const transferred = isTransferred(periodKey, category.id)
                      
                      return (
                        <td
                          key={category.id}
                          onClick={() => handleCellClick(periodIndex, category.id, amount)}
                          className={`border-b border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-right ${
                            amount > 0 && !transferred 
                              ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                              : transferred
                              ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                          title={
                            transferred 
                              ? 'Sudah ditransfer ke buku transaksi' 
                              : amount > 0 
                              ? 'Klik untuk transfer ke buku transaksi' 
                              : ''
                          }
                        >
                          <div className="flex items-center justify-end gap-1">
                            {formatIDR(displayAmount)}
                            {transferred && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 text-green-600"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatIDR(periodTotal)}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-slate-50 dark:bg-slate-900 font-semibold">
                <td className="sticky left-0 z-10 border-t-2 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white">
                  Total
                </td>
                {displayCategories.map((category) => {
                  let categoryTotal = 0
                  for (let p = 0; p < periodCount; p++) {
                    const periodKey = frequency === 'bulanan' ? getPeriodKey(p) : getArisanPeriodKey(p)
                    displayMembers.forEach((member) => {
                      const checklist = getChecklistStatus(member.id, category.id, periodKey)
                      // Hanya hitung jika checked, tidak not_paid, dan belum ditransfer
                      if (checklist?.checked && !checklist.notPaid && !checklist.transferred) {
                        const count = checklist.count ?? 1
                        categoryTotal += count * category.amount
                      }
                    })
                  }
                  return (
                    <td
                      key={category.id}
                      className="border-t-2 border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-right text-emerald-700 dark:text-emerald-400"
                    >
                      {formatIDR(categoryTotal)}
                    </td>
                  )
                })}
                <td className="border-t-2 border-slate-200 dark:border-slate-700 px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">
                  {formatIDR(
                    displayCategories.reduce((sum, category) => {
                      let categoryTotal = 0
                      for (let p = 0; p < periodCount; p++) {
                        const periodKey = frequency === 'bulanan' ? getPeriodKey(p) : getArisanPeriodKey(p)
                        displayMembers.forEach((member) => {
                          const checklist = getChecklistStatus(member.id, category.id, periodKey)
                          // Hanya hitung jika checked, tidak not_paid, dan belum ditransfer
                          if (checklist?.checked && !checklist.notPaid && !checklist.transferred) {
                            const count = checklist.count ?? 1
                            categoryTotal += count * category.amount
                          }
                        })
                      }
                      return sum + categoryTotal
                    }, 0)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        open={openTransferModal}
        title="Konfirmasi Transfer"
        onClose={() => {
          setOpenTransferModal(false)
          setTimeout(() => setOpenDetailModal(true), 200)
        }}
      >
        {transferData && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 p-4">
              <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Detail Transfer
              </div>
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">{frequency === 'bulanan' ? 'Bulan' : 'Putaran'}:</span> {frequency === 'bulanan' ? `${MONTH_NAMES[transferData.monthIndex]} ${selectedYear}` : `Putaran ${transferData.monthIndex + 1} - ${sessions.find(s => s.id === selectedSessionId)?.name ?? ''}`}</div>
                <div><span className="font-medium">Kategori:</span> {transferData.categoryName}</div>
                <div><span className="font-medium">Total Nominal:</span> <span className="font-semibold text-emerald-600">{formatIDR(transferData.amount)}</span></div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                Tujuan Buku Transaksi
              </div>
              {availableTargetBooks.length === 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-300">
                  Tidak ada buku transaksi tersedia. Buat buku transaksi terlebih dahulu.
                </div>
              ) : (
                <Select
                  value={selectedTargetBookId}
                  onChange={(e) => setSelectedTargetBookId(e.target.value)}
                >
                  {availableTargetBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setOpenTransferModal(false)
                  setTimeout(() => setOpenDetailModal(true), 200)
                }}
              >
                Batal
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={availableTargetBooks.length === 0}
              >
                Transfer ke Buku Transaksi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success Modal */}
      <SuccessModal
        open={openSuccessModal}
        onClose={handleSuccessModalClose}
        title="Transfer Berhasil!"
        message="Data berhasil ditransfer ke buku transaksi"
        details={successData ? `${successData.categoryName} sebesar ${formatIDR(successData.amount)} telah ditransfer ke ${successData.targetBookName} pada tanggal hari ini.` : ''}
        actionLabel="Lihat Transaksi"
        onAction={handleViewTransactions}
      />
    </div>
  )
}

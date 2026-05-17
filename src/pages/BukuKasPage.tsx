import { NavLink, useLocation, useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Select from '../components/Select'
import DashboardPage from './DashboardPage'
import TransactionsPage from './TransactionsPage'
import ReportsPage from './ReportsPage'
import { getAllProfiles } from '../lib/users'
import { useAuth, canManageBooks } from '../lib/auth'
import type { Profile } from '../lib/auth'
import {
  addBook,
  deleteBook,
  getBooks,
  getKolektifSessions,
  getKolektifConfig,
  getRoutineCategories,
  getRoutineChecklists,
  getRoutineFrequency,
  getRoutineMembers,
  getRoutineSessions,
  getTransactions,
  renameBook,
  saveRoutineCategories,
  saveRoutineChecklists,
  saveRoutineFrequency,
  saveRoutineMembers,
  saveRoutineSessions,
} from '../lib/store'
import { formatIDR } from '../lib/money'
import type { Book, BookType, RoutineCategory, RoutineFrequency, RoutineMember } from '../lib/types'
import { uid } from '../lib/id'

export default function BukuKasPage() {
  const { bookId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [tab, setTab] = useState<'dashboard' | 'laporan'>('dashboard')

  const [openManageBooks, setOpenManageBooks] = useState(false)
  const [openAddBook, setOpenAddBook] = useState(false)
  const [openEditBook, setOpenEditBook] = useState(false)
  const [openDeleteBookModal, setOpenDeleteBookModal] = useState(false)
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [editBookName, setEditBookName] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [currentBook, setCurrentBook] = useState<Book | undefined>(undefined)
  const [bookStats, setBookStats] = useState<Record<string, number>>({})
  const [newBookName, setNewBookName] = useState('')
  const [newBookType, setNewBookType] = useState<BookType>('biasa')
  const [newRoutineFrequency, setNewRoutineFrequency] = useState<RoutineFrequency>('bulanan')
  const [newRoutineMembers, setNewRoutineMembers] = useState<RoutineMember[]>([])
  const [newRoutineCategories, setNewRoutineCategories] = useState<RoutineCategory[]>([])
  const [editingBookType, setEditingBookType] = useState<BookType>('biasa')
  const [editRoutineFrequency, setEditRoutineFrequency] = useState<RoutineFrequency>('bulanan')
  const [editRoutineMembers, setEditRoutineMembers] = useState<RoutineMember[]>([])
  const [editRoutineCategories, setEditRoutineCategories] = useState<RoutineCategory[]>([])

  // State untuk modal kelola anggota dari user
  const [openMemberModal, setOpenMemberModal] = useState(false)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())
  const [isEditMode, setIsEditMode] = useState(false) // untuk membedakan add vs edit

  // State untuk modal kelola kategori
  const [openCategoryModal, setOpenCategoryModal] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<RoutineCategory[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [isCategoryEditMode, setIsCategoryEditMode] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryAmount, setNewCategoryAmount] = useState('')

  // State untuk modal alert
  const [openAlertModal, setOpenAlertModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  function showAlert(message: string) {
    setAlertMessage(message)
    setOpenAlertModal(true)
  }

  // Load books on mount
  useEffect(() => {
    getBooks().then(setBooks).catch(console.error)
  }, [])

  // Load currentBook when bookId changes
  useEffect(() => {
    if (!bookId) {
      setCurrentBook(undefined)
      return
    }
    getBooks()
      .then((all) => setCurrentBook(all.find((b) => b.id === bookId)))
      .catch(console.error)
  }, [bookId])

  // Load bookStats whenever books list changes
  useEffect(() => {
    if (books.length === 0) return
    let cancelled = false

    async function loadStats() {
      const entries = await Promise.all(
        books.map(async (b) => {
          let totalSaldo = 0
          if (b.type === 'rutin') {
            const [frequency, categories, sessions, checklists] = await Promise.all([
              getRoutineFrequency(b.id),
              getRoutineCategories(b.id),
              getRoutineSessions(b.id),
              getRoutineChecklists(b.id),
            ])

            if (frequency === 'bulanan') {
              // Mode bulanan: pakai kategori global
              const amountByCategoryId = new Map(categories.map((c) => [c.id, c.amount]))
              totalSaldo = checklists.reduce((acc, item) => {
                if (!item.checked || item.notPaid || item.transferred) return acc
                const count = item.count ?? 1
                const amount = amountByCategoryId.get(item.categoryId) ?? 0
                return acc + (count * amount)
              }, 0)
            } else {
              // Mode arisan/per sesi: pakai kategori dari masing-masing session
              // Build map: categoryId -> amount dari semua session
              const amountByCategoryId = new Map<string, number>()
              for (const session of sessions) {
                for (const cat of (session.categories ?? [])) {
                  amountByCategoryId.set(cat.id, cat.amount)
                }
              }
              totalSaldo = checklists.reduce((acc, item) => {
                if (!item.checked || item.notPaid || item.transferred) return acc
                const count = item.count ?? 1
                const amount = amountByCategoryId.get(item.categoryId) ?? 0
                return acc + (count * amount)
              }, 0)
            }
          } else if (b.type === 'kolektif') {
            const sessions = await getKolektifSessions(b.id)
            const totals = await Promise.all(sessions.map(s => getKolektifConfig(s.id)))
            totalSaldo = totals.reduce((sum, cfg) => sum + cfg.rows.reduce((s, r) => s + r.amount, 0), 0)
          } else {
            const tx = await getTransactions(b.id)
            totalSaldo = tx.reduce(
              (acc, t) => acc + (t.type === 'masuk' ? t.amount : -t.amount),
              0,
            )
          }
          return [b.id, totalSaldo] as const
        }),
      )
      if (!cancelled) {
        setBookStats(Object.fromEntries(entries))
      }
    }

    loadStats().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [books])

  // Redirect rutin/kolektif books
  useEffect(() => {
    if (currentBook?.type === 'rutin' && bookId) {
      navigate(`/buku-kas-rutin/${bookId}`, { replace: true })
    } else if (currentBook?.type === 'kolektif' && bookId) {
      navigate(`/buku-kas-kolektif/${bookId}`, { replace: true })
    }
  }, [currentBook, bookId, navigate])

  if (bookId) {
    if (currentBook?.type === 'rutin' || currentBook?.type === 'kolektif') {
      return null
    }

    const isRekeningTransactionsPage = location.pathname.endsWith('/transaksi-rekening')
    const isTransactionsPage =
      isRekeningTransactionsPage || location.pathname.endsWith('/transaksi')

    return (
      <div className="grid gap-4">
        {isTransactionsPage ? (
          <TransactionsPage
            bookId={bookId}
            mode={isRekeningTransactionsPage ? 'rekening' : 'semua'}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={
                  tab === 'dashboard'
                    ? 'rounded-lg px-3 py-2 text-sm font-medium bg-slate-900 dark:bg-slate-700 text-white'
                    : 'rounded-lg px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }
                onClick={() => setTab('dashboard')}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={
                  tab === 'laporan'
                    ? 'rounded-lg px-3 py-2 text-sm font-medium bg-slate-900 dark:bg-slate-700 text-white'
                    : 'rounded-lg px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }
                onClick={() => setTab('laporan')}
              >
                Laporan
              </button>
            </div>

            {tab === 'dashboard' ? (
              <DashboardPage
                bookId={bookId}
                saldoHref={`/buku-kas/${bookId}/transaksi`}
                rekeningHref={`/buku-kas/${bookId}/transaksi-rekening`}
              />
            ) : (
              <ReportsPage bookId={bookId} />
            )}
          </>
        )}
      </div>
    )
  }

  async function refreshBooks() {
    const all = await getBooks()
    setBooks(all)
  }

  async function createBook() {
    const n = newBookName.trim()
    if (!n) {
      showAlert('Nama buku tidak boleh kosong!')
      return
    }
    
    if (newBookType === 'rutin') {
      // Hanya validasi anggota dan kategori untuk buku bulanan
      // Untuk per sesi, anggota dan kategori dikelola per sesi
      if (newRoutineFrequency === 'bulanan') {
        const members = newRoutineMembers
          .map((m) => ({ ...m, name: m.name.trim() }))
          .filter((m) => m.name)
        
        if (members.length === 0) {
          showAlert('Anggota tidak boleh kosong! Silakan kelola anggota terlebih dahulu.')
          return
        }
        
        const categories = newRoutineCategories
          .map((c) => ({ ...c, name: c.name.trim(), amount: Number(c.amount) || 0 }))
          .filter((c) => c.name && c.amount > 0)
        
        if (categories.length === 0) {
          showAlert('Kategori tidak boleh kosong! Silakan kelola kategori terlebih dahulu.')
          return
        }
      }
    }
    
    try {
      const book = await addBook(n, newBookType)
      if (newBookType === 'rutin') {
        const freq: RoutineFrequency = newRoutineFrequency === 'arisan' ? 'arisan' : 'bulanan'
        const members = newRoutineMembers
          .map((m) => ({ ...m, name: m.name.trim() }))
          .filter((m) => m.name)
        const categories = newRoutineCategories
          .map((c) => ({ ...c, name: c.name.trim(), amount: Number(c.amount) || 0 }))
          .filter((c) => c.name && c.amount > 0)
        await saveRoutineFrequency(book.id, freq)
        await saveRoutineMembers(book.id, members)
        await saveRoutineCategories(book.id, categories)
        await saveRoutineChecklists(book.id, [])
        if (freq === 'arisan') {
          await saveRoutineSessions(book.id, [{ id: uid('ses'), name: 'Sesi 1' }])
        } else {
          await saveRoutineSessions(book.id, [])
        }
      }
      setNewBookName('')
      await refreshBooks()
      setOpenAddBook(false)
    } catch (error) {
      console.error('Error creating book:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      showAlert(`Gagal membuat buku kas: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async function removeBook(id: string) {
    await deleteBook(id)
    await refreshBooks()
  }

  async function startEditBook(id: string) {
    const book = books.find((b) => b.id === id)
    if (!book) return
    setEditingBookId(id)
    setEditBookName(book.name)
    setEditingBookType(book.type)
    if (book.type === 'rutin') {
      const [freq, members, categories] = await Promise.all([
        getRoutineFrequency(id),
        getRoutineMembers(id),
        getRoutineCategories(id),
      ])
      setEditRoutineFrequency(freq)
      setEditRoutineMembers(members)
      setEditRoutineCategories(categories)
    } else {
      setEditRoutineFrequency('bulanan')
      setEditRoutineMembers([])
      setEditRoutineCategories([])
    }
    setOpenEditBook(true)
  }

  async function saveBookRename() {
    if (!editingBookId) return
    const name = editBookName.trim()
    if (!name) {
      showAlert('Nama buku tidak boleh kosong!')
      return
    }
    
    if (editingBookType === 'rutin') {
      // Hanya validasi anggota dan kategori untuk buku bulanan
      // Untuk per sesi, anggota dan kategori dikelola per sesi
      if (editRoutineFrequency === 'bulanan') {
        const members = editRoutineMembers
          .map((m) => ({ ...m, name: m.name.trim() }))
          .filter((m) => m.name)
        
        if (members.length === 0) {
          showAlert('Anggota tidak boleh kosong! Silakan kelola anggota terlebih dahulu.')
          return
        }
        
        const categories = editRoutineCategories
          .map((c) => ({ ...c, name: c.name.trim(), amount: Number(c.amount) || 0 }))
          .filter((c) => c.name && c.amount > 0)
        
        if (categories.length === 0) {
          showAlert('Kategori tidak boleh kosong! Silakan kelola kategori terlebih dahulu.')
          return
        }
      }
    }
    
    try {
      await renameBook(editingBookId, name)
      if (editingBookType === 'rutin') {
        const freq: RoutineFrequency = editRoutineFrequency === 'arisan' ? 'arisan' : 'bulanan'
        await saveRoutineFrequency(editingBookId, freq)

        if (freq === 'bulanan') {
          // Untuk bulanan: simpan members dan categories, lalu bersihkan checklists yang tidak valid
          const members = editRoutineMembers
            .map((m) => ({ ...m, name: m.name.trim() }))
            .filter((m) => m.name)
          const categories = editRoutineCategories
            .map((c) => ({ ...c, name: c.name.trim(), amount: Number(c.amount) || 0 }))
            .filter((c) => c.name && c.amount > 0)
          await saveRoutineMembers(editingBookId, members)
          await saveRoutineCategories(editingBookId, categories)
          const validMemberIds = new Set(members.map((m) => m.id))
          const validCategoryIds = new Set(categories.map((c) => c.id))
          const existingChecklists = await getRoutineChecklists(editingBookId)
          const cleanedChecklists = existingChecklists.filter(
            (c) => validMemberIds.has(c.memberId) && validCategoryIds.has(c.categoryId),
          )
          await saveRoutineChecklists(editingBookId, cleanedChecklists)
        }
        // Untuk arisan: tidak overwrite members/categories/checklists — dikelola per sesi
      }
      await refreshBooks()
      setOpenEditBook(false)
      setEditingBookId(null)
    } catch (error) {
      console.error('Error saving book:', error)
      showAlert('Gagal menyimpan perubahan. Silakan coba lagi.')
    }
  }

  function resetNewRoutineConfig() {
    setNewRoutineFrequency('bulanan')
    setNewRoutineMembers([])
    setNewRoutineCategories([])
  }

  function addNewRoutineMemberRow() {
    setNewRoutineMembers((prev) => [...prev, { id: uid('rm'), name: '' }])
  }

  function updateNewRoutineMember(id: string, name: string) {
    setNewRoutineMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
  }

  function removeNewRoutineMember(id: string) {
    setNewRoutineMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function addNewRoutineCategoryRow() {
    setNewRoutineCategories((prev) => [...prev, { id: uid('rc'), name: '', amount: 0 }])
  }

  function updateNewRoutineCategoryName(id: string, name: string) {
    setNewRoutineCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  function updateNewRoutineCategoryAmount(id: string, raw: string) {
    const amount = Number(raw.replace(/\D/g, '')) || 0
    setNewRoutineCategories((prev) => prev.map((c) => (c.id === id ? { ...c, amount } : c)))
  }

  function removeNewRoutineCategory(id: string) {
    setNewRoutineCategories((prev) => prev.filter((c) => c.id !== id))
  }

  function addEditRoutineMemberRow() {
    setEditRoutineMembers((prev) => [...prev, { id: uid('rm'), name: '' }])
  }

  function updateEditRoutineMember(id: string, name: string) {
    setEditRoutineMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
  }

  function removeEditRoutineMember(id: string) {
    setEditRoutineMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function addEditRoutineCategoryRow() {
    setEditRoutineCategories((prev) => [...prev, { id: uid('rc'), name: '', amount: 0 }])
  }

  function updateEditRoutineCategoryName(id: string, name: string) {
    setEditRoutineCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  function updateEditRoutineCategoryAmount(id: string, raw: string) {
    const amount = Number(raw.replace(/\D/g, '')) || 0
    setEditRoutineCategories((prev) => prev.map((c) => (c.id === id ? { ...c, amount } : c)))
  }

  function removeEditRoutineCategory(id: string) {
    setEditRoutineCategories((prev) => prev.filter((c) => c.id !== id))
  }

  async function openMemberModalForAdd() {
    const profiles = await getAllProfiles()
    setAllProfiles(profiles)
    // Set selected dari newRoutineMembers yang sudah ada
    const existingNames = new Set(newRoutineMembers.map(m => m.name.trim().toLowerCase()))
    const selected = new Set(
      profiles
        .filter(p => existingNames.has(p.full_name.trim().toLowerCase()))
        .map(p => p.id)
    )
    setSelectedProfileIds(selected)
    setIsEditMode(false)
    setOpenMemberModal(true)
  }

  async function openMemberModalForEdit() {
    const profiles = await getAllProfiles()
    setAllProfiles(profiles)
    // Set selected dari editRoutineMembers yang sudah ada
    const existingNames = new Set(editRoutineMembers.map(m => m.name.trim().toLowerCase()))
    const selected = new Set(
      profiles
        .filter(p => existingNames.has(p.full_name.trim().toLowerCase()))
        .map(p => p.id)
    )
    setSelectedProfileIds(selected)
    setIsEditMode(true)
    setOpenMemberModal(true)
  }

  function toggleProfileSelection(profileId: string) {
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

  function applySelectedMembers() {
    const selectedProfiles = allProfiles.filter(p => selectedProfileIds.has(p.id))
    const members: RoutineMember[] = selectedProfiles.map(p => ({
      id: uid('rm'),
      name: p.full_name
    }))
    
    if (isEditMode) {
      setEditRoutineMembers(members)
    } else {
      setNewRoutineMembers(members)
    }
    
    setOpenMemberModal(false)
  }

  async function openCategoryModalForAdd() {
    // Load kategori yang sudah ada dari newRoutineCategories
    const existingCategories = newRoutineCategories.map(c => ({
      id: uid('rc'), // Generate ID baru untuk modal
      name: c.name,
      amount: c.amount
    }))
    
    setAvailableCategories(existingCategories)
    
    // Tandai semua kategori yang sudah ada sebagai selected
    const allIds = new Set(existingCategories.map(c => c.id))
    setSelectedCategoryIds(allIds)
    setIsCategoryEditMode(false)
    setOpenCategoryModal(true)
  }

  async function openCategoryModalForEdit() {
    // Load kategori yang sudah ada dari editRoutineCategories
    const existingCategories = editRoutineCategories.map(c => ({
      id: uid('rc'), // Generate ID baru untuk modal
      name: c.name,
      amount: c.amount
    }))
    
    setAvailableCategories(existingCategories)
    
    // Tandai semua kategori yang sudah ada sebagai selected
    const allIds = new Set(existingCategories.map(c => c.id))
    setSelectedCategoryIds(allIds)
    setIsCategoryEditMode(true)
    setOpenCategoryModal(true)
  }

  function toggleCategorySelection(categoryId: string) {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function applySelectedCategories() {
    const selectedCats = availableCategories.filter(c => selectedCategoryIds.has(c.id))
    const categories: RoutineCategory[] = selectedCats.map(c => ({
      id: uid('rc'),
      name: c.name,
      amount: c.amount
    }))
    
    if (isCategoryEditMode) {
      setEditRoutineCategories(categories)
    } else {
      setNewRoutineCategories(categories)
    }
    
    setOpenCategoryModal(false)
  }

  function addCategoryToModal() {
    const name = newCategoryName.trim()
    const amount = Number(newCategoryAmount.replace(/\D/g, '')) || 0
    
    if (!name || amount <= 0) return
    
    const newCategory: RoutineCategory = {
      id: uid('rc'),
      name,
      amount
    }
    
    setAvailableCategories(prev => [...prev, newCategory])
    setSelectedCategoryIds(prev => new Set([...prev, newCategory.id]))
    setNewCategoryName('')
    setNewCategoryAmount('')
  }

  function updateCategoryInModal(categoryId: string, field: 'name' | 'amount', value: string) {
    setAvailableCategories(prev => prev.map(c => {
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

  function removeCategoryFromModal(categoryId: string) {
    setAvailableCategories(prev => prev.filter(c => c.id !== categoryId))
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      next.delete(categoryId)
      return next
    })
  }

  return (
    <div className="relative grid gap-4 overflow-x-hidden">
      <div className="flex flex-wrap gap-4">
        {books.map((b) => {
          const isRoutineBook = b.type === 'rutin'
          const isKolektifBook = b.type === 'kolektif'
          const bookTypeLabel = b.type === 'rutin' ? 'Buku Rutinan' : b.type === 'kolektif' ? 'Buku Kolektif' : 'Buku Transaksi'
          const href = isRoutineBook ? `/buku-kas-rutin/${b.id}` : isKolektifBook ? `/buku-kas-kolektif/${b.id}` : `/buku-kas/${b.id}`
          const totalSaldo = bookStats[b.id] ?? 0

          return (
            <NavLink key={b.id} to={href} className="block w-[180px] shrink-0">
              <div className="relative h-56 w-[180px] overflow-hidden border-r border-t border-b border-slate-300 transition hover:shadow-xl" style={{
                background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                boxShadow: '-3px 0 8px rgba(0,0,0,0.15), 2px 2px 8px rgba(0,0,0,0.1)',
                borderTopRightRadius: '8px',
                borderBottomRightRadius: '8px',
                borderTopLeftRadius: '4px',
                borderBottomLeftRadius: '4px',
              }}>
                {/* Punggung buku (spine) - dipersempit */}
                <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800" style={{
                  boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.4), inset 0 0 20px rgba(0,0,0,0.2)',
                  borderTopLeftRadius: '4px',
                  borderBottomLeftRadius: '4px',
                }} />
                
                {/* Label/Stiker untuk judul dan saldo */}
                <div className="absolute left-5 top-3 right-6 border-2 border-slate-700 rounded-md bg-white p-2.5">
                  <div className="grid gap-1.5">
                    <div className="line-clamp-2 text-xs font-bold text-slate-900 leading-tight">
                      {b.name}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 border-t border-slate-300 pt-1.5">
                      {formatIDR(totalSaldo)}
                    </div>
                  </div>
                </div>
                
                {/* Tipe buku di bagian bawah */}
                <div className="absolute bottom-4 left-5 right-4">
                  <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">{bookTypeLabel}</div>
                </div>
                
                {/* Efek tekstur kertas halus */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.01) 2px, rgba(0,0,0,0.01) 4px)',
                  mixBlendMode: 'multiply'
                }} />
              </div>
            </NavLink>
          )
        })}
      </div>

      {canManageBooks(profile?.role) && (
        <button
          type="button"
          aria-label="Kelola buku kas"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-6 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 md:bottom-6"
          onClick={() => {
            refreshBooks()
            setOpenManageBooks(true)
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5 a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}

      <Modal
        open={openManageBooks}
        title="Kelola Buku Kas"
        onClose={() => setOpenManageBooks(false)}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            {books.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {b.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {b.type === 'rutin' ? 'Buku Rutinan' : b.type === 'kolektif' ? 'Buku Kolektif' : 'Buku Transaksi'}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => startEditBook(b.id)}>
                  Edit
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setNewBookName('')
                setNewBookType('biasa')
                resetNewRoutineConfig()
                setOpenAddBook(true)
              }}
            >
              Tambah
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openAddBook}
        title="Tambah Buku Kas"
        onClose={() => setOpenAddBook(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Nama buku</div>
            <Input
              placeholder="Contoh: Kas Pemuda"
              value={newBookName}
              onChange={(e) => setNewBookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createBook()
              }}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Tipe buku</div>
            <Select
              value={newBookType}
              onChange={(e) => setNewBookType(e.target.value as BookType)}
            >
              <option value="biasa">Buku Transaksi</option>
              <option value="rutin">Buku Rutinan</option>
              <option value="kolektif">Buku Kolektif</option>
            </Select>
          </div>
          {newBookType === 'rutin' ? (
            <>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Frekuensi</div>
                <Select
                  value={newRoutineFrequency}
                  onChange={(e) => setNewRoutineFrequency(e.target.value as RoutineFrequency)}
                >
                  <option value="bulanan">Bulanan</option>
                  <option value="arisan">Per sesi</option>
                </Select>
              </div>
              {newRoutineFrequency === 'bulanan' && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={openMemberModalForAdd}>
                    Kelola Anggota
                  </Button>
                  <Button variant="secondary" onClick={openCategoryModalForAdd}>
                    Kelola Kategori
                  </Button>
                </div>
              )}
              {newRoutineFrequency === 'arisan' && (
                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                  💡 Untuk buku per sesi, anggota dan kategori dikelola per sesi di halaman detail buku.
                </div>
              )}
            </>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpenAddBook(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                createBook()
              }}
            >
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openEditBook}
        title="Edit Buku Kas"
        onClose={() => setOpenEditBook(false)}
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Nama buku</div>
            <Input
              placeholder="Nama buku"
              value={editBookName}
              onChange={(e) => setEditBookName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveBookRename()
              }}
            />
          </div>
          {editingBookType === 'rutin' ? (
            <>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Frekuensi</div>
                <Select
                  value={editRoutineFrequency}
                  onChange={(e) => setEditRoutineFrequency(e.target.value as RoutineFrequency)}
                >
                  <option value="bulanan">Bulanan</option>
                  <option value="arisan">Per sesi</option>
                </Select>
              </div>
              {editRoutineFrequency === 'bulanan' && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={openMemberModalForEdit}>
                    Kelola Anggota
                  </Button>
                  <Button variant="secondary" onClick={openCategoryModalForEdit}>
                    Kelola Kategori
                  </Button>
                </div>
              )}
              {editRoutineFrequency === 'arisan' && (
                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                  💡 Untuk buku per sesi, anggota dan kategori dikelola per sesi di halaman detail buku.
                </div>
              )}
            </>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="danger"
              onClick={() => setOpenDeleteBookModal(true)}
              disabled={books.length <= 1}
            >
              Hapus
            </Button>
            <Button variant="secondary" onClick={() => setOpenEditBook(false)}>
              Batal
            </Button>
            <Button onClick={saveBookRename}>Simpan</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDeleteBookModal}
        title="Konfirmasi"
        onClose={() => setOpenDeleteBookModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-700">
            Hapus buku kas ini? Semua data di buku ini akan hilang.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenDeleteBookModal(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (editingBookId) removeBook(editingBookId)
                setOpenDeleteBookModal(false)
                setOpenEditBook(false)
              }}
            >
              Hapus
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openMemberModal}
        title="Pilih Anggota dari User"
        onClose={() => setOpenMemberModal(false)}
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
                      onChange={() => toggleProfileSelection(profile.id)}
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
            <Button variant="secondary" onClick={() => setOpenMemberModal(false)}>
              Batal
            </Button>
            <Button onClick={applySelectedMembers}>
              Terapkan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCategoryModal}
        title="Pilih Kategori"
        onClose={() => setOpenCategoryModal(false)}
      >
        <div className="grid gap-4">
          <div className="max-h-96 overflow-auto">
            {availableCategories.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Tidak ada kategori tersedia
              </div>
            ) : (
              <div className="grid gap-2">
                {availableCategories.map((category) => (
                  <div
                    key={category.id}
                    className="grid grid-cols-[auto_1fr_140px_auto] items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.has(category.id)}
                      onChange={() => toggleCategorySelection(category.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <Input
                      placeholder="Nama kategori"
                      value={category.name}
                      onChange={(e) => updateCategoryInModal(category.id, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Nominal"
                      inputMode="numeric"
                      value={category.amount ? String(category.amount) : ''}
                      onChange={(e) => updateCategoryInModal(category.id, 'amount', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeCategoryFromModal(category.id)}
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
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Input
                  placeholder="Nominal"
                  inputMode="numeric"
                  value={newCategoryAmount}
                  onChange={(e) => setNewCategoryAmount(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={addCategoryToModal} className="w-full">
                Tambah ke Daftar
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCategoryModal(false)}>
              Batal
            </Button>
            <Button onClick={applySelectedCategories}>
              Terapkan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openAlertModal}
        title="Perhatian"
        onClose={() => setOpenAlertModal(false)}
      >
        <div className="grid gap-4">
          <div className="text-sm text-slate-700">
            {alertMessage}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setOpenAlertModal(false)}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

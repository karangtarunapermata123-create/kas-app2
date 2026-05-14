import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import Input from '../components/Input'
import Select from '../components/Select'
import QRScanner from '../components/QRScanner'
import QRDisplay from '../components/QRDisplay'
import { useAuth, canEditAttendance } from '../lib/auth'
import type { Profile } from '../lib/auth'
import { getAllProfiles } from '../lib/users'
import {
  getActivities,
  addActivity,
  deleteActivity,
  getSessionsByActivity,
  addActivitySession,
  deleteActivitySession,
  getAttendanceByActivity,
  getAttendanceBySession,
  addAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  getOrGenerateActivityQRToken,
  getOrGenerateSessionQRToken,
  attendViaQR,
} from '../lib/store'
import type { Activity, ActivitySession, AttendanceRecord } from '../lib/types'
import { formatDate } from '../lib/date'

// ─── Shared: tabel absensi ────────────────────────────────────────────────────

type AttendanceTableProps = {
  allProfiles: Profile[]
  records: AttendanceRecord[]
  onOpenStatus: (profileId: string, memberName: string, currentStatus: AttendanceRecord['status'] | null) => void
  canEdit: boolean
}

function AttendanceTable({ allProfiles, records, onOpenStatus, canEdit }: AttendanceTableProps) {
  // Buat map dari records untuk lookup cepat berdasarkan nama
  const recordMap = new Map<string, AttendanceRecord>()
  records.forEach(r => {
    recordMap.set(r.memberName.toLowerCase().trim(), r)
  })

  // Hitung statistik
  const hadirCount = records.filter((r) => r.status === 'hadir').length
  const izinCount = records.filter((r) => r.status === 'izin').length

  return (
    <>
      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 px-4 py-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">{allProfiles.length}</div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 px-4 py-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">Hadir</div>
          <div className="text-xl font-semibold text-emerald-600">{hadirCount}</div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 px-4 py-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">Izin</div>
          <div className="text-xl font-semibold text-amber-500">{izinCount}</div>
        </div>
      </div>

      {/* Tabel */}
      <Card title="Daftar Absensi">
        {allProfiles.length === 0 ? (
          <div className="py-4 text-sm text-slate-500 dark:text-slate-400">
            Belum ada user. Tambahkan user di halaman Pengaturan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">No</th>
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {allProfiles.map((profile, i) => {
                  const record = recordMap.get(profile.full_name.toLowerCase().trim())
                  const status = record?.status ?? null // null = belum ada data
                  
                  return (
                    <tr key={profile.id} className="border-t dark:border-slate-700">
                      <td className="py-2 pr-3 text-slate-400 dark:text-slate-500">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{profile.full_name}</td>
                      <td className="py-2 pr-3 text-center">
                        <button
                          type="button"
                          onClick={() => canEdit && onOpenStatus(profile.id, profile.full_name, status)}
                          disabled={!canEdit}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                            canEdit ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed opacity-60'
                          } ${
                            status === 'hadir'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                              : status === 'izin'
                                ? 'border-amber-400 bg-amber-50 text-amber-500'
                                : status === 'tidak-hadir'
                                  ? 'border-rose-400 bg-rose-50 text-rose-600'
                                  : 'border-slate-200 bg-white text-slate-300 hover:border-slate-400'
                          }`}
                          aria-label="Ubah status kehadiran"
                        >
                          {status === 'hadir' ? '✓' : status === 'izin' ? '~' : status === 'tidak-hadir' ? '✗' : ''}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

// ─── Shared: modal status ─────────────────────────────────────────────────────

type StatusModalProps = {
  open: boolean
  memberName: string | null
  currentStatus: AttendanceRecord['status'] | null
  onClose: () => void
  onSet: (status: AttendanceRecord['status']) => void
  onDelete: () => void
}

function StatusModal({ open, memberName, currentStatus, onClose, onSet, onDelete }: StatusModalProps) {
  return (
    <Modal
      open={open}
      title={memberName ? `Kehadiran — ${memberName}` : 'Status Kehadiran'}
      onClose={onClose}
    >
      <div className="grid gap-2">
        {(
          [
            { status: 'hadir', label: 'Hadir', desc: 'Anggota hadir dalam kegiatan ini', color: 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
            { status: 'izin', label: 'Izin', desc: 'Anggota tidak hadir dengan keterangan', color: 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100' },
            { status: 'tidak-hadir', label: 'Tidak Hadir', desc: 'Anggota tidak hadir tanpa keterangan', color: 'border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100' },
          ] as const
        ).map(({ status, label, desc, color }) => (
          <button
            key={status}
            type="button"
            onClick={() => onSet(status)}
            className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition ${
              currentStatus === status ? color : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
              currentStatus === status ? color : 'border-slate-300 text-slate-400'
            }`}>
              {status === 'hadir' ? '✓' : status === 'izin' ? '~' : '✗'}
            </span>
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{desc}</div>
            </div>
            {currentStatus === status && <span className="ml-auto text-xs font-medium">Aktif</span>}
          </button>
        ))}
        
        {/* Tombol Hapus - hanya tampil jika ada record */}
        {currentStatus !== null && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-2 w-full rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Hapus (Kosongkan Status)
          </button>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Per-session attendance counts, keyed by session id
type SessionStats = Record<string, { total: number; hadir: number }>
// Per-activity stats for the activities list, keyed by activity id
type ActivityStats = Record<string, { total: number; hadir: number; sesCount: number }>

export default function AbsensiPage() {
  const { activityId, sessionId } = useParams<{ activityId: string; sessionId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const userCanEdit = canEditAttendance(profile?.role)

  const [activities, setActivities] = useState<Activity[]>([])
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [filterType, setFilterType] = useState<'semua' | 'sekali' | 'rutin'>('semua')

  // Attendance counts for each session row in the sessions table
  const [sessionStats, setSessionStats] = useState<SessionStats>({})
  // Attendance + session counts for each activity row in the activities list
  const [activityStats, setActivityStats] = useState<ActivityStats>({})

  // Modal: tambah kegiatan
  const [openAddActivity, setOpenAddActivity] = useState(false)
  const [activityName, setActivityName] = useState('')
  const [activityType, setActivityType] = useState<'sekali' | 'rutin'>('sekali')
  const [activityFrequency, setActivityFrequency] = useState<'mingguan' | 'bulanan'>('mingguan')
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0])
  const [activityDescription, setActivityDescription] = useState('')

  // Modal: tambah sesi
  const [openAddSession, setOpenAddSession] = useState(false)
  const [sessionLabel, setSessionLabel] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])

  // Modal: status
  const [openStatus, setOpenStatus] = useState(false)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [activeMemberName, setActiveMemberName] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<AttendanceRecord['status'] | null>(null)

  // QR Code states
  const [openQRScanner, setOpenQRScanner] = useState(false)
  const [openQRDisplay, setOpenQRDisplay] = useState(false)
  const [qrData, setQrData] = useState('')
  const [qrMessage, setQrMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selectedActivity = activityId ? activities.find((a) => a.id === activityId) ?? null : null
  const selectedSession = sessionId ? sessions.find((s) => s.id === sessionId) ?? null : null

  // ── Load all profiles ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await getAllProfiles()
      if (!cancelled) setAllProfiles(data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Load activities list ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await getActivities()
      if (!cancelled) setActivities(data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Load sessions for selected activity ──────────────────────────────────

  useEffect(() => {
    if (!activityId) return
    let cancelled = false
    async function load() {
      const data = await getSessionsByActivity(activityId!)
      if (!cancelled) setSessions(data)
    }
    load()
    return () => { cancelled = true }
  }, [activityId])

  // ── Load attendance records for current view ─────────────────────────────

  const loadRecords = useCallback(async () => {
    if (sessionId) {
      const data = await getAttendanceBySession(sessionId)
      setRecords(data)
    } else if (activityId) {
      const data = await getAttendanceByActivity(activityId)
      setRecords(data)
    }
  }, [activityId, sessionId])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  // ── Load per-session stats when sessions list changes ────────────────────

  useEffect(() => {
    if (!sessions.length) {
      setSessionStats({})
      return
    }
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        sessions.map(async (s) => {
          const recs = await getAttendanceBySession(s.id)
          return [s.id, { total: recs.length, hadir: recs.filter((r) => r.status === 'hadir').length }] as const
        })
      )
      if (!cancelled) setSessionStats(Object.fromEntries(entries))
    }
    load()
    return () => { cancelled = true }
  }, [sessions])

  // ── Load per-activity stats when activities list changes ─────────────────

  useEffect(() => {
    if (!activities.length) {
      setActivityStats({})
      return
    }
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        activities.map(async (a) => {
          if (a.type === 'rutin') {
            const sesses = await getSessionsByActivity(a.id)
            return [a.id, { total: 0, hadir: 0, sesCount: sesses.length }] as const
          } else {
            const recs = await getAttendanceByActivity(a.id)
            return [a.id, { total: recs.length, hadir: recs.filter((r) => r.status === 'hadir').length, sesCount: 0 }] as const
          }
        })
      )
      if (!cancelled) setActivityStats(Object.fromEntries(entries))
    }
    load()
    return () => { cancelled = true }
  }, [activities])

  // ── Kegiatan ────────────────────────────────────────────────────────────

  async function handleAddActivity() {
    if (!activityName.trim()) return
    await addActivity({
      name: activityName,
      type: activityType,
      frequency: activityType === 'rutin' ? activityFrequency : undefined,
      date: activityDate,
      description: activityDescription,
    })
    setActivityName('')
    setActivityType('sekali')
    setActivityFrequency('mingguan')
    setActivityDate(new Date().toISOString().split('T')[0])
    setActivityDescription('')
    setOpenAddActivity(false)
    const data = await getActivities()
    setActivities(data)
  }

  async function handleDeleteActivity(id: string) {
    if (!confirm('Hapus kegiatan ini beserta seluruh data absensinya?')) return
    await deleteActivity(id)
    const data = await getActivities()
    setActivities(data)
    if (activityId === id) navigate('/absensi')
  }

  // ── Sesi ────────────────────────────────────────────────────────────────

  async function handleAddSession() {
    if (!activityId || !sessionLabel.trim()) return
    await addActivitySession({ activityId, label: sessionLabel, date: sessionDate })
    setSessionLabel('')
    setSessionDate(new Date().toISOString().split('T')[0])
    setOpenAddSession(false)
    const data = await getSessionsByActivity(activityId)
    setSessions(data)
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('Hapus sesi ini beserta seluruh data absensinya?')) return
    await deleteActivitySession(id)
    const data = await getSessionsByActivity(activityId!)
    setSessions(data)
  }

  // ── Anggota & Status ────────────────────────────────────────────────────

  function handleOpenStatus(profileId: string, memberName: string, currentStatus: AttendanceRecord['status'] | null) {
    setActiveProfileId(profileId)
    setActiveMemberName(memberName)
    setActiveStatus(currentStatus)
    setOpenStatus(true)
  }

  async function handleSetStatus(status: AttendanceRecord['status']) {
    if (!activeProfileId || !activeMemberName || !activityId) return
    
    // Cari apakah sudah ada record untuk user ini
    const existingRecord = records.find(r => r.memberName.toLowerCase().trim() === activeMemberName.toLowerCase().trim())
    
    if (existingRecord) {
      // Update record yang sudah ada
      await updateAttendanceRecord(existingRecord.id, { status })
    } else {
      // Buat record baru
      await addAttendanceRecord({
        activityId,
        sessionId: sessionId,
        memberName: activeMemberName,
        status,
      })
    }
    
    await loadRecords()
    setOpenStatus(false)
    setActiveProfileId(null)
    setActiveMemberName(null)
    setActiveStatus(null)
  }

  async function handleDeleteStatus() {
    if (!activeMemberName) return
    
    // Cari record untuk user ini
    const existingRecord = records.find(r => r.memberName.toLowerCase().trim() === activeMemberName.toLowerCase().trim())
    
    if (existingRecord) {
      // Hapus record
      await deleteAttendanceRecord(existingRecord.id)
      await loadRecords()
    }
    
    setOpenStatus(false)
    setActiveProfileId(null)
    setActiveMemberName(null)
    setActiveStatus(null)
  }

  // ── QR Code Handlers ────────────────────────────────────────────────────

  async function handleShowQR() {
    try {
      let token: string
      let title: string
      let description: string

      if (sessionId && selectedSession) {
        // QR untuk sesi
        token = await getOrGenerateSessionQRToken(sessionId)
        title = `QR Absensi - ${selectedSession.label}`
        description = `${selectedActivity?.name} - ${selectedSession.label}`
      } else if (activityId && selectedActivity) {
        // QR untuk activity
        token = await getOrGenerateActivityQRToken(activityId)
        title = `QR Absensi - ${selectedActivity.name}`
        description = selectedActivity.name
      } else {
        return
      }

      // Generate URL dengan base URL dari window.location
      const baseUrl = window.location.origin
      const qrUrl = `${baseUrl}/absensi/scan?token=${token}`
      
      setQrData(qrUrl)
      setOpenQRDisplay(true)
    } catch (error) {
      console.error('Error generating QR:', error)
      alert('Gagal membuat QR code')
    }
  }

  async function handleScanQR(data: string) {
    try {
      // Extract token from URL or use data directly
      let token = data
      if (data.includes('token=')) {
        const url = new URL(data)
        token = url.searchParams.get('token') || data
      }

      if (!profile?.full_name) {
        setQrMessage({ type: 'error', text: 'Nama pengguna tidak ditemukan' })
        return
      }

      const result = await attendViaQR(token, profile.full_name)
      
      if (result.success) {
        setQrMessage({ type: 'success', text: result.message })
        await loadRecords()
        // Reload activities stats
        const data = await getActivities()
        setActivities(data)
      } else {
        setQrMessage({ type: 'error', text: result.message })
      }

      // Clear message after 5 seconds
      setTimeout(() => setQrMessage(null), 5000)
    } catch (error) {
      console.error('Error scanning QR:', error)
      setQrMessage({ type: 'error', text: 'Gagal memproses QR code' })
      setTimeout(() => setQrMessage(null), 5000)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const filtered = activities.filter((a) => filterType === 'semua' || a.type === filterType)

  function suggestSessionLabel(activity: Activity): string {
    const now = new Date()
    if (activity.frequency === 'bulanan') {
      return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)
    }
    // mingguan
    const weekNum = Math.ceil(now.getDate() / 7)
    const month = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)
    return `Minggu ${weekNum} — ${month}`
  }

  // ── Render: detail sesi ──────────────────────────────────────────────────

  if (selectedActivity && selectedSession) {
    return (
      <div className="grid gap-4">
        {/* QR Message */}
        {qrMessage && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            qrMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
          }`}>
            {qrMessage.text}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>{formatDate(selectedSession.date)}</span>
          </div>
          <div className="flex gap-2">
            {/* Tombol Scan QR untuk anggota */}
            <Button 
              variant="secondary" 
              onClick={() => setOpenQRScanner(true)}
            >
              📷 Scan QR
            </Button>
            {/* Tombol Tampilkan QR untuk admin */}
            {userCanEdit && (
              <Button onClick={handleShowQR}>
                🔲 Tampilkan QR
              </Button>
            )}
          </div>
        </div>

        <AttendanceTable
          allProfiles={allProfiles}
          records={records}
          onOpenStatus={handleOpenStatus}
          canEdit={userCanEdit}
        />

        <StatusModal
          open={openStatus}
          memberName={activeMemberName}
          currentStatus={activeStatus}
          onClose={() => { 
            setOpenStatus(false)
            setActiveProfileId(null)
            setActiveMemberName(null)
            setActiveStatus(null)
          }}
          onSet={handleSetStatus}
          onDelete={handleDeleteStatus}
        />

        <QRScanner
          open={openQRScanner}
          onClose={() => setOpenQRScanner(false)}
          onScan={handleScanQR}
        />

        <QRDisplay
          open={openQRDisplay}
          onClose={() => setOpenQRDisplay(false)}
          data={qrData}
          title={`QR Absensi - ${selectedSession.label}`}
          description={`${selectedActivity.name} - ${selectedSession.label}`}
        />
      </div>
    )
  }

  // ── Render: detail kegiatan ──────────────────────────────────────────────

  if (selectedActivity) {
    const isRutin = selectedActivity.type === 'rutin'

    return (
      <div className="grid gap-4">
        {/* Info meta */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className={`rounded-full px-2 py-0.5 font-medium ${isRutin ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'}`}>
            {isRutin ? 'Rutin' : 'Sekali'}
          </span>
          {isRutin && selectedActivity.frequency && (
            <>
              <span>·</span>
              <span className="capitalize">{selectedActivity.frequency}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDate(selectedActivity.date)}</span>
        </div>

        {isRutin ? (
          /* ── Kegiatan rutin: tampilkan daftar sesi ── */
          <Card
            title="Sesi"
            right={
              userCanEdit ? (
                <Button onClick={() => {
                  setSessionLabel(suggestSessionLabel(selectedActivity))
                  setSessionDate(new Date().toISOString().split('T')[0])
                  setOpenAddSession(true)
                }}>
                  + Sesi
                </Button>
              ) : undefined
            }
          >
            {sessions.length === 0 ? (
              <div className="py-4 text-sm text-slate-500 dark:text-slate-400">
                Belum ada sesi. Klik "+ Sesi" untuk menambahkan sesi baru.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Sesi</th>
                      <th className="py-2 pr-3">Tanggal</th>
                      <th className="py-2 pr-3 text-right">Peserta</th>
                      <th className="py-2 pr-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const stats = sessionStats[session.id]
                      const hadir = stats?.hadir ?? 0
                      const total = stats?.total ?? 0
                      return (
                        <tr
                          key={session.id}
                          className="border-t dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          onClick={() => navigate(`/absensi/${activityId}/sesi/${session.id}`)}
                        >
                          <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{session.label}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{session.date}</td>
                          <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-400">
                            <span className="font-medium text-emerald-700 dark:text-emerald-500">{hadir}</span>
                            <span className="text-slate-400 dark:text-slate-500">/{total}</span>
                          </td>
                          <td className="py-2 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {userCanEdit && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(session.id)}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                              >
                                Hapus
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          /* ── Kegiatan sekali: langsung tampilkan absensi ── */
          <>
            {/* QR Message */}
            {qrMessage && (
              <div className={`rounded-lg border px-4 py-3 text-sm ${
                qrMessage.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
              }`}>
                {qrMessage.text}
              </div>
            )}

            {/* QR Buttons */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => setOpenQRScanner(true)}
              >
                📷 Scan QR
              </Button>
              {userCanEdit && (
                <Button onClick={handleShowQR}>
                  🔲 Tampilkan QR
                </Button>
              )}
            </div>

            <AttendanceTable
              allProfiles={allProfiles}
              records={records}
              onOpenStatus={handleOpenStatus}
              canEdit={userCanEdit}
            />

            <StatusModal
              open={openStatus}
              memberName={activeMemberName}
              currentStatus={activeStatus}
              onClose={() => { 
                setOpenStatus(false)
                setActiveProfileId(null)
                setActiveMemberName(null)
                setActiveStatus(null)
              }}
              onSet={handleSetStatus}
              onDelete={handleDeleteStatus}
            />

            <QRScanner
              open={openQRScanner}
              onClose={() => setOpenQRScanner(false)}
              onScan={handleScanQR}
            />

            <QRDisplay
              open={openQRDisplay}
              onClose={() => setOpenQRDisplay(false)}
              data={qrData}
              title={`QR Absensi - ${selectedActivity.name}`}
              description={selectedActivity.name}
            />
          </>
        )}

        {/* Modal tambah sesi */}
        <Modal open={openAddSession} title="Tambah Sesi" onClose={() => setOpenAddSession(false)}>
          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Label Sesi</div>
              <Input
                placeholder={selectedActivity.frequency === 'bulanan' ? 'Contoh: Januari 2026' : 'Contoh: Minggu 1 — Januari 2026'}
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Tanggal</div>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setOpenAddSession(false)}>Batal</Button>
              <Button onClick={handleAddSession} disabled={!sessionLabel.trim()}>Simpan</Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // ── Render: daftar kegiatan ──────────────────────────────────────────────

  return (
    <div className="grid gap-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        {(['semua', 'sekali', 'rutin'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filterType === t 
                ? 'bg-slate-900 dark:bg-slate-700 text-white' 
                : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <Card title="Daftar Kegiatan">
        {filtered.length === 0 ? (
          <div className="py-4 text-sm text-slate-500 dark:text-slate-400">
            Belum ada kegiatan. Klik tombol + untuk membuat kegiatan baru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Nama Kegiatan</th>
                  <th className="py-2 pr-3">Tipe</th>
                  <th className="py-2 pr-3">Tanggal</th>
                  <th className="py-2 pr-3 text-right">Peserta</th>
                  <th className="py-2 pr-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((activity) => {
                  const stats = activityStats[activity.id]
                  const hadir = stats?.hadir ?? 0
                  const total = stats?.total ?? 0
                  const sesCount = stats?.sesCount ?? 0
                  return (
                    <tr
                      key={activity.id}
                      className="border-t dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      onClick={() => navigate(`/absensi/${activity.id}`)}
                    >
                      <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{activity.name}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs font-medium border-b-2 pb-0.5 ${activity.type === 'rutin' ? 'border-violet-500 text-violet-700 dark:text-violet-400' : 'border-sky-500 text-sky-700 dark:text-sky-400'}`}>
                          {activity.type === 'rutin'
                            ? `Rutin · ${activity.frequency === 'bulanan' ? 'Bulanan' : 'Mingguan'}`
                            : 'Sekali'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{activity.date}</td>
                      <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-400">
                        {activity.type === 'rutin' ? (
                          <span>{sesCount} sesi</span>
                        ) : (
                          <>
                            <span className="font-medium text-emerald-700 dark:text-emerald-500">{hadir}</span>
                            <span className="text-slate-400 dark:text-slate-500">/{total}</span>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {userCanEdit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(activity.id)}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* FAB */}
      {userCanEdit && (
        <button
          type="button"
          aria-label="Tambah kegiatan"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-slate-900 dark:bg-slate-700 text-white shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 md:bottom-6"
          onClick={() => setOpenAddActivity(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
        </button>
      )}

      {/* Modal tambah kegiatan */}
      <Modal open={openAddActivity} title="Tambah Kegiatan" onClose={() => setOpenAddActivity(false)}>
        <div className="grid gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Kegiatan</div>
            <Input
              placeholder="Contoh: Kerja Bakti, Rapat Bulanan"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Tipe</div>
            <Select value={activityType} onChange={(e) => setActivityType(e.target.value as 'sekali' | 'rutin')}>
              <option value="sekali">Sekali</option>
              <option value="rutin">Rutin</option>
            </Select>
            <div className="mt-1 text-xs text-slate-400">
              {activityType === 'sekali' ? 'Kegiatan yang dilakukan satu kali.' : 'Kegiatan yang dilakukan secara berkala.'}
            </div>
          </div>
          {activityType === 'rutin' && (
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Frekuensi</div>
              <Select value={activityFrequency} onChange={(e) => setActivityFrequency(e.target.value as 'mingguan' | 'bulanan')}>
                <option value="mingguan">Mingguan</option>
                <option value="bulanan">Bulanan</option>
              </Select>
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Tanggal Mulai</div>
            <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Deskripsi (opsional)</div>
            <Input
              placeholder="Deskripsi singkat kegiatan"
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpenAddActivity(false)}>Batal</Button>
            <Button onClick={handleAddActivity} disabled={!activityName.trim()}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

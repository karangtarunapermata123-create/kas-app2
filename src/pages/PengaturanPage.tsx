import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { useAuth, canManageUsers } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { getAllProfiles, ROLE_LABELS, ROLE_TEXT_COLORS } from '../lib/users'
import type { Profile } from '../lib/auth'

export default function PengaturanPage() {
  const navigate = useNavigate()
  const { profile: currentProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isSuperAdmin = currentProfile?.role === 'super_admin'
  const canManage = canManageUsers(currentProfile?.role)

  // Modal lihat anggota (untuk member & admin)
  const [openMemberList, setOpenMemberList] = useState(false)
  const [memberProfiles, setMemberProfiles] = useState<Profile[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  async function handleOpenMemberList() {
    setOpenMemberList(true)
    if (memberProfiles.length > 0) return
    setLoadingMembers(true)
    try {
      const data = await getAllProfiles()
      setMemberProfiles(data)
    } finally {
      setLoadingMembers(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="Tampilan">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">Dark Mode</div>
            <div className="text-xs text-slate-500">Ubah tema aplikasi menjadi gelap</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              theme === 'dark' ? 'bg-slate-900' : 'bg-slate-300'
            }`}
            aria-label="Toggle dark mode"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </Card>

      {isSuperAdmin && (
        <Card title="Kelola User">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Manajemen User</div>
              <div className="text-xs text-slate-500">Tambah, edit, dan kelola pengguna aplikasi</div>
            </div>
            <Button onClick={() => navigate('/kelola-user')}>
              Kelola User
            </Button>
          </div>
        </Card>
      )}

      {!isSuperAdmin && (
        <Card title="Anggota">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Daftar Anggota</div>
              <div className="text-xs text-slate-500">Lihat seluruh anggota beserta perannya</div>
            </div>
            <Button variant="secondary" onClick={handleOpenMemberList}>
              Lihat Anggota
            </Button>
          </div>
        </Card>
      )}

      {/* Modal daftar anggota */}
      <Modal open={openMemberList} title="Daftar Anggota" onClose={() => setOpenMemberList(false)}>
        {loadingMembers ? (
          <div className="py-6 text-center text-sm text-slate-500">Memuat...</div>
        ) : memberProfiles.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">Belum ada anggota.</div>
        ) : (
          <div className="grid gap-2">
            {[...memberProfiles]
              .sort((a, b) => {
                const roleOrder: Record<string, number> = { super_admin: 0, admin: 1, member: 2 }
                const ro = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3)
                if (ro !== 0) return ro
                return a.full_name.localeCompare(b.full_name, 'id')
              })
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {p.full_name || '-'}
                    </span>
                    {p.id === currentProfile?.id && (
                      <span className="text-xs text-slate-400 shrink-0">(Anda)</span>
                    )}
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${ROLE_TEXT_COLORS[p.role]}`}>
                    {ROLE_LABELS[p.role]}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
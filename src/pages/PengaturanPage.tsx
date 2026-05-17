import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Button from '../components/Button'
import { useAuth, canManageUsers } from '../lib/auth'
import { useTheme } from '../lib/theme'

export default function PengaturanPage() {
  const navigate = useNavigate()
  const { profile: currentProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isSuperAdmin = currentProfile?.role === 'super_admin'
  const canManage = canManageUsers(currentProfile?.role)

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
    </div>
  )
}
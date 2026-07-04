import { useState } from 'react'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import { useAuth } from '../lib/auth'
import { updateUserName, ROLE_LABELS, ROLE_COLORS, ROLE_TEXT_COLORS } from '../lib/users'
import { supabase } from '../lib/supabase'

export default function ProfilPage() {
  const { profile, user, signOut, refreshProfile } = useAuth()

  // ── Modal edit profil ──────────────────────────────────────────────────────
  const [openEdit, setOpenEdit] = useState(false)

  // Nama
  const [name, setName] = useState(profile?.full_name ?? '')

  // Ganti sandi
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setName(profile?.full_name ?? '')
    setCurrentPass('')
    setNewPass('')
    setConfirmPass('')
    setError(null)
    setSaved(false)
    setOpenEdit(true)
  }

  function closeModal() {
    setOpenEdit(false)
    setError(null)
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    setSaved(false)

    if (!name.trim()) {
      setError('Nama tidak boleh kosong.')
      return
    }

    // Kalau ada input password, validasi dulu
    const wantsChangePass = currentPass || newPass || confirmPass
    if (wantsChangePass) {
      if (!currentPass) {
        setError('Masukkan password saat ini.')
        return
      }
      if (!newPass) {
        setError('Masukkan password baru.')
        return
      }
      if (newPass.length < 6) {
        setError('Password baru minimal 6 karakter.')
        return
      }
      if (newPass !== confirmPass) {
        setError('Konfirmasi password tidak cocok.')
        return
      }
    }

    setSaving(true)
    try {
      // Simpan nama
      if (profile) {
        await updateUserName(profile.id, name)
        await refreshProfile()
      }

      // Ganti password kalau diisi
      if (wantsChangePass) {
        const email = user?.email
        if (!email) throw new Error('User tidak ditemukan.')

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPass,
        })
        if (signInError) {
          setError('Password saat ini salah.')
          return
        }

        const { error: updateError } = await supabase.auth.updateUser({ password: newPass })
        if (updateError) throw updateError
      }

      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        closeModal()
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">

      {/* ── Informasi Akun ── */}
      <button
        type="button"
        onClick={openModal}
        className="w-full text-left rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:focus-visible:ring-slate-700/50"
      >
        <div className="flex items-center justify-between border-b dark:border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Informasi Akun</h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-400 dark:text-slate-500">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-lg font-semibold text-white select-none">
              {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900 dark:text-white">
                {profile?.full_name || '—'}
              </div>
              <div className="truncate text-sm text-slate-500 dark:text-slate-400">{user?.email}</div>
              <span className={`mt-0.5 text-xs font-medium border-b ${profile ? ROLE_TEXT_COLORS[profile.role] : ''}`}>
                {profile ? ROLE_LABELS[profile.role] : ''}
              </span>
            </div>
            <Button variant="danger" className="ml-auto shrink-0" onClick={(e) => { e.stopPropagation(); signOut() }}>
              Keluar
            </Button>
          </div>
        </div>
      </button>

      {/* ── Modal Edit Profil ── */}
      <Modal open={openEdit} title="Edit Profil" onClose={closeModal}>
        <div className="grid gap-5">

          {/* Nama */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Informasi
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Nama Lengkap</div>
              <Input
                placeholder="Nama lengkap Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t dark:border-slate-700" />

          {/* Ganti sandi */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Ganti Password <span className="normal-case font-normal text-slate-400 dark:text-slate-500">(opsional)</span>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Password Saat Ini</div>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Password Baru</div>
              <Input
                type="password"
                placeholder="Minimal 6 karakter"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Konfirmasi Password Baru</div>
              <Input
                type="password"
                placeholder="Ulangi password baru"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Error / sukses */}
          {error && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              Perubahan berhasil disimpan ✓
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

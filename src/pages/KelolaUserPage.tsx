import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Modal from '../components/Modal'
import { useAuth, canManageUsers } from '../lib/auth'
import type { UserRole, Profile } from '../lib/auth'
import {
  getAllProfiles,
  updateUserRole,
  updateUserName,
  createUser,
  ROLE_LABELS,
  ROLE_TEXT_COLORS,
} from '../lib/users'

export default function KelolaUserPage() {
  const navigate = useNavigate()
  const { profile: currentProfile } = useAuth()
  const isSuperAdmin = currentProfile?.role === 'super_admin'
  const canManage = canManageUsers(currentProfile?.role)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal: tambah user
  const [openAdd, setOpenAdd] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<UserRole>('member')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Modal: edit user
  const [openEdit, setOpenEdit] = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('member')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  async function loadProfiles() {
    if (!canManage) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getAllProfiles()
      setProfiles(data)
    } catch (e) {
      setError('Gagal memuat daftar user.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManage) loadProfiles()
    else setLoading(false)
  }, [isSuperAdmin])

  // ── Tambah user ──────────────────────────────────────────────────────────

  function openAddModal() {
    setAddEmail('')
    setAddPassword('')
    setAddName('')
    setAddRole('member')
    setAddError(null)
    setOpenAdd(true)
  }

  async function handleAddUser() {
    if (!addEmail.trim() || !addPassword || !addName.trim()) {
      setAddError('Semua field wajib diisi.')
      return
    }
    if (addPassword.length < 6) {
      setAddError('Password minimal 6 karakter.')
      return
    }
    setAddLoading(true)
    setAddError(null)
    const { error } = await createUser(addEmail, addPassword, addName, addRole)
    setAddLoading(false)
    if (error) { setAddError(error); return }
    setOpenAdd(false)
    await loadProfiles()
  }

  // ── Edit user ────────────────────────────────────────────────────────────

  function openEditModal(p: Profile) {
    setEditTarget(p)
    setEditName(p.full_name)
    setEditRole(p.role)
    setEditError(null)
    setOpenEdit(true)
  }

  async function handleEditUser() {
    if (!editTarget) return
    if (!editName.trim()) { setEditError('Nama tidak boleh kosong.'); return }
    setEditLoading(true)
    setEditError(null)
    try {
      await Promise.all([
        updateUserName(editTarget.id, editName),
        updateUserRole(editTarget.id, editRole),
      ])
      setOpenEdit(false)
      await loadProfiles()
    } catch (e) {
      setEditError('Gagal menyimpan perubahan.')
      console.error(e)
    } finally {
      setEditLoading(false)
    }
  }

  // ── Render: bukan super admin ────────────────────────────────────────────

  if (!isSuperAdmin) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    )
  }

  // ── Render: loading ──────────────────────────────────────────────────────

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-500">Memuat daftar user...</div>
  }

  if (error) {
    return (
      <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
        <button type="button" className="ml-3 underline" onClick={loadProfiles}>
          Coba lagi
        </button>
      </div>
    )
  }

  // ── Render: daftar user ──────────────────────────────────────────────────

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kelola User</h2>
        <Button onClick={openAddModal}>+ Tambah User</Button>
      </div>

      {profiles.length === 0 ? (
        <div className="py-4 text-sm text-slate-500">Belum ada user.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{p.full_name || '-'}</span>
                      {p.id === currentProfile?.id && (
                        <span className="text-xs text-slate-400">(Anda)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-400 truncate">{p.email}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs font-medium ${ROLE_TEXT_COLORS[p.role]}`}>
                      {ROLE_LABELS[p.role]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-center">
                    {p.id !== currentProfile?.id && canManage ? (
                      <Button variant="secondary" onClick={() => openEditModal(p)}>Edit</Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tambah user */}
      <Modal open={openAdd} title="Tambah User Baru" onClose={() => setOpenAdd(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Nama Lengkap</div>
            <Input placeholder="Contoh: Budi Santoso" value={addName} onChange={(e) => setAddName(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Email</div>
            <Input type="email" placeholder="contoh@email.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Password</div>
            <Input type="password" placeholder="Minimal 6 karakter" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Role</div>
            <Select value={addRole} onChange={(e) => setAddRole(e.target.value as UserRole)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </div>
          {addError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{addError}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpenAdd(false)}>Batal</Button>
            <Button onClick={handleAddUser} disabled={addLoading}>
              {addLoading ? 'Menyimpan...' : 'Buat Akun'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal edit user */}
      <Modal open={openEdit} title={`Edit User — ${editTarget?.email ?? ''}`} onClose={() => setOpenEdit(false)}>
        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Nama Lengkap</div>
            <Input placeholder="Nama lengkap" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Role</div>
            <Select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </div>
          {editError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpenEdit(false)}>Batal</Button>
            <Button onClick={handleEditUser} disabled={editLoading}>
              {editLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
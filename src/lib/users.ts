import { supabase } from './supabase'
import type { UserRole, Profile } from './auth'

// Ambil semua profiles (hanya super_admin yang boleh)
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

// Update role user (hanya super_admin)
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw error
}

// Update nama user
export async function updateUserName(userId: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', userId)
  if (error) throw error
}

// Buat akun baru via Supabase Admin (pakai service role) — tidak bisa dari client
// Solusi: gunakan signUp biasa, lalu restore session admin
export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
): Promise<{ error: string | null }> {
  // Simpan session admin yang sedang login
  const { data: { session: adminSession } } = await supabase.auth.getSession()
  
  // Sign up user baru — Supabase akan trigger handle_new_user() untuk buat profile
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role,
      },
    },
  })
  if (error) {
    // Restore session admin jika ada error
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }
    return { error: error.message }
  }
  if (!data.user) {
    // Restore session admin jika gagal
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }
    return { error: 'Gagal membuat akun.' }
  }

  // Update role di profiles (trigger mungkin sudah set, tapi pastikan)
  await supabase
    .from('profiles')
    .update({ role, full_name: fullName.trim() })
    .eq('id', data.user.id)

  // Restore session admin setelah berhasil buat user
  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    })
  }

  return { error: null }
}

// Nonaktifkan user — set role ke member (tidak bisa delete dari client)
export async function deactivateUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'member' })
    .eq('id', userId)
  if (error) throw error
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  member: 'Member',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-violet-50 text-violet-700',
  admin: 'bg-sky-50 text-sky-700',
  member: 'bg-slate-100 text-slate-600',
}

export const ROLE_TEXT_COLORS: Record<UserRole, string> = {
  super_admin: 'text-violet-700 border-violet-400',
  admin: 'text-sky-700 border-sky-400',
  member: 'text-slate-500 border-slate-400',
}

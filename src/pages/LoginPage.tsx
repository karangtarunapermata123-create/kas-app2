import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Input from '../components/Input'
import Button from '../components/Button'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError(null)
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setError('Email atau password salah.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Kas Pemuda</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk ke akun Anda</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-white px-6 py-8 shadow-sm"
        >
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Email
              </label>
              <Input
                type="email"
                placeholder="contoh@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

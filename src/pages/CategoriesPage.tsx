import { useEffect, useMemo, useState } from 'react'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import {
  addCategory,
  deleteCategory,
  getCategories,
  saveCategories,
} from '../lib/store'
import type { Category } from '../lib/types'

type Props = {
  bookId: string
}

export default function CategoriesPage({ bookId }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')

  async function loadCategories() {
    const data = await getCategories(bookId)
    setCategories(data)
  }

  useEffect(() => { loadCategories() }, [bookId])

  const canDelete = useMemo(
    () => (id: string) => !['lainnya', 'iuran', 'donasi', 'kegiatan', 'konsumsi'].includes(id),
    [],
  )

  async function submit() {
    const n = name.trim()
    if (!n) return
    await addCategory(bookId, n)
    await loadCategories()
    setName('')
  }

  async function remove(id: string) {
    if (!confirm('Hapus kategori ini? Transaksi akan dipindahkan ke kategori Lainnya.')) return
    await deleteCategory(bookId, id)
    await loadCategories()
  }

  async function resetDefault() {
    if (!confirm('Reset kategori ke default?')) return
    const defaultCats: Category[] = [
      { id: 'iuran', name: 'Iuran' },
      { id: 'donasi', name: 'Donasi' },
      { id: 'kegiatan', name: 'Kegiatan' },
      { id: 'konsumsi', name: 'Konsumsi' },
    ]
    await saveCategories(bookId, defaultCats)
    await loadCategories()
  }

  return (
    <div className="grid gap-4">
      <Card title="Tambah Kategori">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-5">
            <div className="mb-1 text-xs font-medium text-slate-600">Nama</div>
            <Input
              placeholder="Contoh: Transport"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button onClick={submit} className="w-full">Tambah</Button>
          </div>
        </div>
      </Card>

      <Card
        title="Daftar Kategori"
        right={<Button variant="secondary" onClick={resetDefault}>Reset default</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2 pr-3">{c.name}</td>
                  <td className="py-2 pr-3 text-right">
                    {canDelete(c.id) ? (
                      <Button variant="danger" onClick={() => remove(c.id)}>Hapus</Button>
                    ) : (
                      <span className="text-xs text-slate-400">Terkunci</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

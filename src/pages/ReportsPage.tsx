import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Button from '../components/Button'
import Select from '../components/Select'
import Modal from '../components/Modal'
import { monthKey } from '../lib/date'
import { formatIDR } from '../lib/money'
import { getTransactions } from '../lib/store'
import type { Transaction } from '../lib/types'

type Props = {
  bookId: string
}

type Row = {
  month: string
  masuk: number
  keluar: number
  saldo: number
}

export default function ReportsPage({ bookId }: Props) {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [openYearModal, setOpenYearModal] = useState(false)

  useEffect(() => {
    getTransactions(bookId).then(setTransactions)
  }, [bookId])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    
    // Add current year and 5 years before/after
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
      years.add(y)
    }
    
    // Add years from transactions
    transactions.forEach((t) => {
      const year = Number(t.date.split('-')[0])
      years.add(year)
    })
    
    return Array.from(years).sort((a, b) => b - a)
  }, [transactions])

  const { rows, total } = useMemo(() => {
    const map = new Map<string, { masuk: number; keluar: number }>()

    // Filter transactions by selected year
    const yearTransactions = transactions.filter((t) => {
      const year = Number(t.date.split('-')[0])
      return year === selectedYear
    })

    for (const t of yearTransactions) {
      const k = monthKey(t.date)
      const prev = map.get(k) ?? { masuk: 0, keluar: 0 }
      if (t.type === 'masuk') prev.masuk += t.amount
      else prev.keluar += t.amount
      map.set(k, prev)
    }

    // Generate all 12 months for selected year
    const allMonths: string[] = []
    for (let month = 1; month <= 12; month++) {
      const mm = String(month).padStart(2, '0')
      allMonths.push(`${selectedYear}-${mm}`)
    }

    const out: Row[] = allMonths.map((month) => {
      const v = map.get(month) ?? { masuk: 0, keluar: 0 }
      return { month, masuk: v.masuk, keluar: v.keluar, saldo: v.masuk - v.keluar }
    })

    const totalMasuk = out.reduce((sum, r) => sum + r.masuk, 0)
    const totalKeluar = out.reduce((sum, r) => sum + r.keluar, 0)
    return { rows: out, total: { masuk: totalMasuk, keluar: totalKeluar, saldo: totalMasuk - totalKeluar } }
  }, [transactions, selectedYear])

  function prevYear() {
    setSelectedYear((prev) => prev - 1)
  }

  function nextYear() {
    setSelectedYear((prev) => prev + 1)
  }

  function shortMonthLabel(key: string): string {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d)
  }

  function goToMonthTransactions(monthKey: string) {
    // Navigate to transactions page with month parameter
    // We'll use URL state to pass the selected month
    navigate(`/buku-kas/${bookId}/transaksi`, { state: { selectedMonth: monthKey } })
  }

  return (
    <div className="grid gap-4 min-w-0">
      {/* Year Selector */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">
          <Button
            variant="secondary"
            onClick={prevYear}
            aria-label="Tahun sebelumnya"
            className="min-w-11 px-4"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Button>
        </div>
        <div className="justify-self-center">
          <button
            type="button"
            className="rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-300"
            onClick={() => setOpenYearModal(true)}
          >
            Tahun {selectedYear}
          </button>
        </div>
        <div className="justify-self-end">
          <Button
            variant="secondary"
            onClick={nextYear}
            aria-label="Tahun berikutnya"
            className="min-w-11 px-4"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Button>
        </div>
      </div>

      <Card title="Laporan Tahunan" noPadding>
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-sm text-slate-600">Belum ada data.</div>
        ) : (
          <div
            className="overflow-x-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100" style={{ minWidth: '360px' }}>
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-3 pl-4 pr-4 whitespace-nowrap">Bulan</th>
                  <th className="py-3 pr-4 whitespace-nowrap">Masuk</th>
                  <th className="py-3 pr-4 whitespace-nowrap">Keluar</th>
                  <th className="py-3 pr-4 whitespace-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr 
                    key={r.month} 
                    className="border-t border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                    onClick={() => goToMonthTransactions(r.month)}
                  >
                    <td className="py-2 pl-4 pr-4 whitespace-nowrap">{shortMonthLabel(r.month)}</td>
                    <td className="py-2 pr-4 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatIDR(r.masuk)}</td>
                    <td className="py-2 pr-4 text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatIDR(r.keluar)}</td>
                    <td className="py-2 pr-4 font-medium whitespace-nowrap">{formatIDR(r.saldo)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
                  <td className="py-2 pl-4 pr-4 whitespace-nowrap">Total</td>
                  <td className="py-2 pr-4 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatIDR(total.masuk)}</td>
                  <td className="py-2 pr-4 text-rose-700 dark:text-rose-400 whitespace-nowrap">{formatIDR(total.keluar)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatIDR(total.saldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Pilih Tahun */}
      <Modal
        open={openYearModal}
        title="Pilih Tahun"
        onClose={() => setOpenYearModal(false)}
      >
        <div className="grid gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Tahun</div>
            <Select
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpenYearModal(false)}>
              Batal
            </Button>
            <Button onClick={() => setOpenYearModal(false)}>Terapkan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

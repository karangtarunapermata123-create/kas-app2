import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import { monthKey, monthLabel } from '../lib/date'
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
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    getTransactions(bookId).then(setTransactions)
  }, [bookId])

  const { rows, total } = useMemo(() => {
    const map = new Map<string, { masuk: number; keluar: number }>()
    const years: Set<number> = new Set()

    for (const t of transactions) {
      const k = monthKey(t.date)
      const year = Number(k.split('-')[0])
      years.add(year)
      const prev = map.get(k) ?? { masuk: 0, keluar: 0 }
      if (t.type === 'masuk') prev.masuk += t.amount
      else prev.keluar += t.amount
      map.set(k, prev)
    }

    const sortedYears = Array.from(years).sort((a, b) => b - a)
    const allMonths: string[] = []
    for (const year of sortedYears) {
      for (let month = 1; month <= 12; month++) {
        const mm = String(month).padStart(2, '0')
        allMonths.push(`${year}-${mm}`)
      }
    }

    const out: Row[] = allMonths.map((month) => {
      const v = map.get(month) ?? { masuk: 0, keluar: 0 }
      return { month, masuk: v.masuk, keluar: v.keluar, saldo: v.masuk - v.keluar }
    })

    const totalMasuk = out.reduce((sum, r) => sum + r.masuk, 0)
    const totalKeluar = out.reduce((sum, r) => sum + r.keluar, 0)
    return { rows: out, total: { masuk: totalMasuk, keluar: totalKeluar, saldo: totalMasuk - totalKeluar } }
  }, [transactions])

  return (
    <div className="grid gap-4 min-w-0">
      <Card title="Laporan Bulanan">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada data.</div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3 whitespace-nowrap">Bulan</th>
                  <th className="py-2 pr-3 text-right whitespace-nowrap">Masuk</th>
                  <th className="py-2 pr-3 text-right whitespace-nowrap">Keluar</th>
                  <th className="py-2 pr-3 text-right whitespace-nowrap">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">{monthLabel(r.month)}</td>
                    <td className="py-2 pr-3 text-right">{formatIDR(r.masuk)}</td>
                    <td className="py-2 pr-3 text-right">{formatIDR(r.keluar)}</td>
                    <td className="py-2 pr-3 text-right font-medium">{formatIDR(r.saldo)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2 pr-3 whitespace-nowrap">Total</td>
                  <td className="py-2 pr-3 text-right">{formatIDR(total.masuk)}</td>
                  <td className="py-2 pr-3 text-right">{formatIDR(total.keluar)}</td>
                  <td className="py-2 pr-3 text-right">{formatIDR(total.saldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import { formatIDR } from '../lib/money'
import { getTransactions, TRANSACTIONS_CHANGED_EVENT } from '../lib/store'
import type { Transaction } from '../lib/types'

type Props = {
  bookId: string
  saldoHref?: string
  rekeningHref?: string
}

export default function DashboardPage({ bookId, saldoHref, rekeningHref }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  async function loadTransactions() {
    const data = await getTransactions(bookId)
    setTransactions(data)
  }

  useEffect(() => {
    loadTransactions()

    const onStorage = () => loadTransactions()
    const onTransactionsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ bookId?: string }>).detail
      if (!detail?.bookId || detail.bookId === bookId) loadTransactions()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onTransactionsChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onTransactionsChanged)
    }
  }, [bookId])

  const totals = useMemo(() => {
    let masuk = 0
    let keluar = 0
    for (const t of transactions) {
      if (t.masukKeRekening) continue
      if (t.type === 'masuk') masuk += t.amount
      else keluar += t.amount
    }
    return { masuk, keluar, saldo: masuk - keluar }
  }, [transactions])

  const rekeningTotals = useMemo(() => {
    let masuk = 0
    let keluar = 0
    for (const t of transactions) {
      if (!t.masukKeRekening) continue
      if (t.type === 'masuk') masuk += t.amount
      else keluar += t.amount
    }
    return { masuk, keluar, saldo: masuk - keluar }
  }, [transactions])

  const recent = useMemo(() => transactions.slice(0, 5), [transactions])

  // Data untuk chart - 6 bulan terakhir
  const chartData = useMemo(() => {
    const monthlyData: Record<string, { masuk: number; keluar: number }> = {}
    
    // Get last 6 months
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push(key)
      monthlyData[key] = { masuk: 0, keluar: 0 }
    }

    // Aggregate transactions by month
    transactions.forEach((t) => {
      const monthKey = t.date.slice(0, 7) // YYYY-MM
      if (monthlyData[monthKey]) {
        if (t.type === 'masuk') {
          monthlyData[monthKey].masuk += t.amount
        } else {
          monthlyData[monthKey].keluar += t.amount
        }
      }
    })

    // Convert to array with month labels
    return months.map((key) => {
      const [year, month] = key.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
      return {
        label: monthNames[parseInt(month) - 1],
        masuk: monthlyData[key].masuk,
        keluar: monthlyData[key].keluar,
      }
    })
  }, [transactions])

  const maxAmount = useMemo(() => {
    const amounts = chartData.flatMap((d) => [d.masuk, d.keluar])
    return Math.max(...amounts, 1)
  }, [chartData])

  const saldoCard = (
    <Card title="Saldo Tunai">
      <div className="text-2xl font-semibold">{formatIDR(totals.saldo)}</div>
      <div className="mt-2 text-xs text-slate-500">
        Masuk {formatIDR(totals.masuk)} · Keluar {formatIDR(totals.keluar)}
      </div>
    </Card>
  )
  const rekeningCard = (
    <Card title="Saldo Rekening">
      <div className="text-2xl font-semibold">{formatIDR(rekeningTotals.saldo)}</div>
      <div className="mt-2 text-xs text-slate-500">
        Masuk {formatIDR(rekeningTotals.masuk)} · Keluar {formatIDR(rekeningTotals.keluar)}
      </div>
    </Card>
  )

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        {saldoHref ? (
          <Link to={saldoHref} className="block transition hover:opacity-95">{saldoCard}</Link>
        ) : saldoCard}
        {rekeningHref ? (
          <Link to={rekeningHref} className="block transition hover:opacity-95">{rekeningCard}</Link>
        ) : rekeningCard}
      </div>

      <Card title="Transaksi Terbaru">
        {recent.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada transaksi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Tanggal</th>
                  <th className="py-2 pr-3">Tipe</th>
                  <th className="py-2 pr-3">Catatan</th>
                  <th className="py-2 pr-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">{t.date}</td>
                    <td className="py-2 pr-3">
                      <span className={
                        'rounded-full px-2 py-1 text-xs font-medium ' +
                        (t.type === 'masuk' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')
                      }>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{t.note}</td>
                    <td className="py-2 pr-3 text-right font-medium">{formatIDR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Grafik Transaksi 6 Bulan Terakhir">
        {transactions.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada data transaksi.</div>
        ) : (
          <div className="grid gap-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-emerald-500" />
                <span className="text-slate-600">Masuk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-rose-500" />
                <span className="text-slate-600">Keluar</span>
              </div>
            </div>

            {/* Chart */}
            <div className="flex items-end justify-between gap-2 h-48">
              {chartData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  {/* Bars */}
                  <div className="w-full flex items-end justify-center gap-1 h-40">
                    {/* Bar Masuk */}
                    <div className="relative flex-1 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600 group" style={{
                      height: `${(data.masuk / maxAmount) * 100}%`,
                      minHeight: data.masuk > 0 ? '4px' : '0',
                    }}>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                        <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          {formatIDR(data.masuk)}
                        </div>
                      </div>
                    </div>
                    {/* Bar Keluar */}
                    <div className="relative flex-1 bg-rose-500 rounded-t transition-all hover:bg-rose-600 group" style={{
                      height: `${(data.keluar / maxAmount) * 100}%`,
                      minHeight: data.keluar > 0 ? '4px' : '0',
                    }}>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                        <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          {formatIDR(data.keluar)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Label */}
                  <div className="text-xs text-slate-500 font-medium">{data.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

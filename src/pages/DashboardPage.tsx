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

  const recent = useMemo(() => transactions.slice(0, 8), [transactions])

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
    </div>
  )
}

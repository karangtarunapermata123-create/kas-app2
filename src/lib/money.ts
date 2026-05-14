export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function toNumberSafe(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

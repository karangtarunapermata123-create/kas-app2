export function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map((x) => Number(x))
  const d = new Date(y, m - 1, 1)
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function weekKey(isoDate: string): string {
  const d = new Date(isoDate)
  const yyyy = d.getFullYear()
  const ww = String(getWeekNumber(d)).padStart(2, '0')
  return `${yyyy}-${ww}`
}

export function weekLabel(key: string): string {
  const [y, w] = key.split('-').map(Number)
  return `Minggu ${w} ${y}`
}

export function getCurrentPeriodKey(frequency: 'bulanan' | 'mingguan'): string {
  const today = todayISO()
  return frequency === 'bulanan' ? monthKey(today) : weekKey(today)
}

export function periodLabel(key: string, frequency: 'bulanan' | 'mingguan'): string {
  return frequency === 'bulanan' ? monthLabel(key) : weekLabel(key)
}

export function prevPeriodKey(key: string, frequency: 'bulanan' | 'mingguan'): string {
  if (frequency === 'bulanan') {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } else {
    const [y, w] = key.split('-').map(Number)
    let newW = w - 1
    let newY = y
    if (newW < 1) {
      newY -= 1
      const lastDay = new Date(newY, 11, 31)
      newW = getWeekNumber(lastDay)
    }
    return `${newY}-${String(newW).padStart(2, '0')}`
  }
}

export function nextPeriodKey(key: string, frequency: 'bulanan' | 'mingguan'): string {
  if (frequency === 'bulanan') {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } else {
    const [y, w] = key.split('-').map(Number)
    const lastDayOfYear = new Date(y, 11, 31)
    const maxWeek = getWeekNumber(lastDayOfYear)
    let newW = w + 1
    let newY = y
    if (newW > maxWeek) {
      newY += 1
      newW = 1
    }
    return `${newY}-${String(newW).padStart(2, '0')}`
  }
}

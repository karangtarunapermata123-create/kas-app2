import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export default function Button({ variant = 'primary', ...props }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-60'

  const cls =
    variant === 'primary'
      ? 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600'
      : variant === 'danger'
        ? 'bg-rose-600 dark:bg-rose-700 text-white hover:bg-rose-700 dark:hover:bg-rose-800'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'

  return (
    <button {...props} className={`${base} ${cls} ${props.className ?? ''}`} />
  )
}

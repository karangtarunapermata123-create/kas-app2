import type { SelectHTMLAttributes } from 'react'

export default function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const size = props.size ? Number(props.size) : undefined
  return (
    <select
      {...props}
      size={size}
      className={
        'w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50 ' +
        (size && size > 1 ? 'overflow-y-auto ' : '') +
        (props.className ?? '')
      }
    />
  )
}

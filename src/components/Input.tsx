import type { InputHTMLAttributes } from 'react'

export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-700/50 ' +
        (props.className ?? '')
      }
    />
  )
}

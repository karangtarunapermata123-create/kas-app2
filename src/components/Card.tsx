import type { PropsWithChildren, ReactNode } from 'react'

export default function Card(
  props: PropsWithChildren<{ title?: string; right?: ReactNode }>,
) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      {(props.title || props.right) && (
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{props.title}</h2>
          <div>{props.right}</div>
        </div>
      )}
      <div className="px-4 py-4 text-slate-900 dark:text-slate-100">{props.children}</div>
    </section>
  )
}

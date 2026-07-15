import type { SelectHTMLAttributes } from 'react'

export default function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const size = props.size ? Number(props.size) : undefined
  return (
    <div className={`relative ${size && size > 1 ? '' : 'inline-flex w-full'}`}>
      <select
        {...props}
        size={size}
        className={
          'w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-1.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-slate-400/30 dark:focus:ring-slate-600/50 focus:border-slate-400 dark:focus:border-slate-500 transition cursor-pointer leading-none ' +
          (size && size > 1 ? 'overflow-y-auto ' : '') +
          (props.className ?? '')
        }
      />
      {(!size || size <= 1) && (
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400 dark:text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      )}
    </div>
  )
}

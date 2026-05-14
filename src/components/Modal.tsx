import { useEffect } from 'react'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${open ? 'bg-black/40 dark:bg-black/60 opacity-100' : 'bg-transparent opacity-0 pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className={`flex w-full max-w-xl flex-col rounded-xl bg-white dark:bg-slate-900 shadow-lg max-h-[80vh] transition-transform duration-300 ${open ? 'scale-100' : 'scale-95'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b dark:border-slate-800 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
        <div className="overflow-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

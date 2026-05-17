import Modal from './Modal'
import Button from './Button'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  message: string
  details?: string
  actionLabel?: string
  onAction?: () => void
}

export default function SuccessModal({
  open,
  onClose,
  title,
  message,
  details,
  actionLabel,
  onAction
}: Props) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900 dark:text-white">
            {message}
          </p>
          {details && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {details}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              className="flex-1"
            >
              {actionLabel}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onClose}
            className={actionLabel ? "flex-1" : "w-full"}
          >
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  )
}
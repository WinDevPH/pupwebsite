import { createPortal } from 'react-dom'
import { Check, Info, X } from 'lucide-react'

export type SnackVariant = 'success' | 'error' | 'info'

export type SnackToast = {
  id: number
  message: string
  variant: SnackVariant
}

function StatusIcon({ variant }: { variant: SnackVariant }) {
  if (variant === 'success') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00a651]"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5 text-[#0a0a0a]" strokeWidth={3} />
      </span>
    )
  }
  if (variant === 'info') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500"
        aria-hidden
      >
        <Info className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e5484d]"
      aria-hidden
    >
      <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />
    </span>
  )
}

export function Snackbar({
  toast,
  onDismiss,
}: {
  toast: SnackToast | null
  onDismiss: () => void
}) {
  if (!toast) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[400] flex items-end justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-8"
      aria-live="polite"
      role="status"
    >
      <div className="snackbar-in pointer-events-auto flex w-fit max-w-[min(calc(100vw-2rem),34rem)] items-stretch overflow-hidden rounded-2xl bg-[#1a1a1a] shadow-[0_10px_40px_-8px_rgba(0,0,0,0.55)]">
        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          <StatusIcon variant={toast.variant} />
          <p className="min-w-0 max-h-[min(40vh,22rem)] overflow-y-auto overscroll-contain text-[14px] leading-snug font-normal text-white">
            {toast.message}
          </p>
        </div>
        <div className="w-px shrink-0 self-stretch bg-white/10" aria-hidden />
        <button
          type="button"
          onClick={onDismiss}
          className="flex shrink-0 items-center justify-center px-4 text-white/75 outline-none transition hover:text-white"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  )
}

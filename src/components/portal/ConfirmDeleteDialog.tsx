import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { cn } from '@/lib/utils'

export type ConfirmDeleteDialogProps = {
  /** Primary label for the item(s) being deleted. */
  title: string
  /** Optional secondary line under the title (email, code, subject). */
  detail?: string
  /** Short noun used in the default heading, e.g. "user", "reservation". */
  noun?: string
  /** Override the dialog heading entirely. */
  heading?: string
  /** Override the consequence copy entirely. */
  description?: string
  bulk?: boolean
  busy?: boolean
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

function defaultHeading(noun: string, bulk: boolean) {
  if (bulk) return `Delete selected ${noun}?`
  return `Delete ${noun}?`
}

function defaultDescription(noun: string, bulk: boolean) {
  if (bulk) {
    return `These ${noun} will be permanently removed. This action cannot be undone.`
  }
  return `This ${noun} will be permanently removed. This action cannot be undone.`
}

export function ConfirmDeleteDialog({
  title,
  detail,
  noun = 'item',
  heading,
  description,
  bulk = false,
  busy = false,
  confirmLabel = 'Delete forever',
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  const busyRef = useRef(busy)

  onCancelRef.current = onCancel
  busyRef.current = busy

  useEffect(() => {
    setPageScrollLocked(true)
    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 20)

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      setPageScrollLocked(false)
      previous?.focus?.()
    }
  }, [])

  const resolvedHeading = heading ?? defaultHeading(noun, bulk)
  const resolvedDescription = description ?? defaultDescription(noun, bulk)

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-[3px] transition-opacity dark:bg-black/70"
        aria-label="Cancel"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel()
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-lenis-prevent
        className={cn(
          'relative w-full max-w-[26rem] overflow-hidden rounded-t-2xl border border-zinc-200/90 bg-white',
          'shadow-[0_24px_64px_-28px_rgba(30,5,65,0.45)] sm:rounded-2xl',
          'dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[0_24px_64px_-20px_rgba(0,0,0,0.75)]',
        )}
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-4 pb-0 sm:px-6 sm:pt-5">
          <span
            className={cn(
              'mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl ring-1',
              'bg-maroon-50 text-maroon-700 ring-maroon-200/80',
              'dark:bg-maroon-500/15 dark:text-maroon-300 dark:ring-maroon-500/30',
            )}
          >
            <AlertTriangle className="size-[18px]" strokeWidth={2.1} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={titleId}
              className="text-[16px] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              {resolvedHeading}
            </h2>
            <p className="mt-1 text-[12px] font-medium text-maroon-700 dark:text-maroon-300">
              Permanent action
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition',
              'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
              'focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-50',
              'dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
              'dark:focus-visible:ring-brand-400/40',
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 sm:px-6">
          <div
            className={cn(
              'rounded-xl border px-3.5 py-3',
              'border-zinc-200 bg-zinc-50',
              'dark:border-zinc-700 dark:bg-zinc-900',
            )}
          >
            <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400">
              {bulk ? 'Selection' : 'Removing'}
            </p>
            <p
              className="mt-1 truncate text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              title={title}
            >
              {title || 'Untitled'}
            </p>
            {detail ? (
              <p
                className="mt-0.5 truncate text-[12px] text-zinc-600 dark:text-zinc-400"
                title={detail}
              >
                {detail}
              </p>
            ) : null}
          </div>

          <p id={descId} className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">
            {resolvedDescription}
          </p>
        </div>

        <div
          className={cn(
            'flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:px-6',
            'border-zinc-200 bg-zinc-50',
            'dark:border-zinc-800 dark:bg-zinc-900/80',
          )}
        >
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="lg"
            className={cn(
              'flex-1',
              'dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200',
              'dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-50',
            )}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            className={cn(
              'flex-1 text-white shadow-sm',
              'bg-maroon-700 hover:bg-maroon-800',
              'focus-visible:outline-maroon-600',
              'dark:bg-maroon-600 dark:hover:bg-maroon-500',
              'dark:focus-visible:outline-maroon-400',
            )}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? 'Deleting…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

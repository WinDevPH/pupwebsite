import type { DragEvent, ReactNode } from 'react'
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FormMediaFrame = 'landscape' | 'portrait' | 'square'

const FRAME_CLS: Record<FormMediaFrame, string> = {
  landscape: 'w-full',
  portrait: 'mx-auto w-full max-w-[15rem] sm:max-w-[17rem]',
  square: 'mx-auto w-full max-w-[16rem] sm:max-w-[18rem]',
}

const IMAGE_CLS: Record<FormMediaFrame, string> = {
  landscape: 'max-h-[min(20rem,48vh)] w-full object-contain sm:max-h-[min(24rem,52vh)]',
  portrait: 'max-h-[min(22rem,56vh)] w-full object-contain sm:max-h-[min(26rem,60vh)]',
  square: 'max-h-[min(18rem,46vh)] w-full object-contain sm:max-h-[min(20rem,50vh)]',
}

type MediaAction = {
  label: string
  onClick: () => void
  tone?: 'primary' | 'danger' | 'muted'
}

type FormMediaPreviewProps = {
  src: string
  label: string
  frame?: FormMediaFrame
  uploading?: boolean
  disabled?: boolean
  primaryAction: MediaAction
  secondaryAction?: MediaAction
}

function actionBtnCls(tone: MediaAction['tone'], disabled?: boolean) {
  const base =
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold outline-none transition focus-visible:ring-2 disabled:opacity-50 sm:h-8 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-2 sm:text-[11px] sm:hover:bg-transparent'
  if (tone === 'danger') {
    return cn(
      base,
      'border-zinc-200 bg-white text-zinc-700 hover:border-maroon-300 hover:bg-maroon-50 hover:text-maroon-800 focus-visible:ring-maroon-500/30',
      'sm:text-zinc-500 sm:hover:text-maroon-700',
      'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-maroon-500/35 dark:hover:bg-maroon-500/10 dark:hover:text-maroon-200',
      'sm:dark:border-transparent sm:dark:bg-transparent sm:dark:text-zinc-400 sm:dark:hover:bg-transparent sm:dark:hover:text-red-300',
      disabled && 'pointer-events-none',
    )
  }
  if (tone === 'muted') {
    return cn(
      base,
      'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-brand-500/30',
      'sm:text-zinc-500 sm:hover:text-zinc-700',
      'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
      'sm:dark:border-transparent sm:dark:bg-transparent sm:dark:text-zinc-400 sm:dark:hover:bg-transparent sm:dark:hover:text-zinc-200',
      disabled && 'pointer-events-none',
    )
  }
  return cn(
    base,
    'border-zinc-200 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-500/35',
    'sm:text-brand-700 sm:hover:text-brand-600',
    'dark:border-zinc-700 dark:bg-zinc-900 dark:text-brand-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10',
    'sm:dark:border-transparent sm:dark:bg-transparent sm:dark:hover:bg-transparent sm:dark:hover:text-brand-200',
    disabled && 'pointer-events-none',
  )
}

/** Shared cover/portrait preview so uploaded images are fully visible (object-contain). */
export function FormMediaPreview({
  src,
  label,
  frame = 'landscape',
  uploading = false,
  disabled = false,
  primaryAction,
  secondaryAction,
}: FormMediaPreviewProps) {
  const actions = [primaryAction, secondaryAction].filter(Boolean) as MediaAction[]

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <div className="relative flex min-h-[11rem] items-center justify-center bg-gradient-to-b from-zinc-100/95 to-zinc-50/70 px-3 py-4 sm:min-h-[13rem] sm:px-5 sm:py-5 dark:from-zinc-900 dark:to-zinc-950/80">
        <div
          className={cn(
            'relative overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none',
            FRAME_CLS[frame],
          )}
        >
          <img src={src} alt="" className={cn('block', IMAGE_CLS[frame])} />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-zinc-200/90 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3.5 sm:py-2.5 dark:border-zinc-700">
        <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-[12px] font-medium text-zinc-600 sm:justify-start sm:text-[11px] dark:text-zinc-400">
          <Upload className="h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        <div
          className={cn(
            'grid gap-2 sm:flex sm:shrink-0 sm:items-center',
            actions.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={disabled || uploading}
              onClick={action.onClick}
              className={actionBtnCls(action.tone ?? 'primary', disabled || uploading)}
            >
              {action.tone === 'danger' ? (
                <Trash2 className="size-3.5 sm:hidden" aria-hidden />
              ) : (
                <ImagePlus className="size-3.5 sm:hidden" aria-hidden />
              )}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type FormMediaDropzoneProps = {
  htmlFor: string
  dragOver: boolean
  uploading?: boolean
  disabled?: boolean
  title?: string
  hint?: ReactNode
  onDragEnter: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

export function FormMediaDropzone({
  htmlFor,
  dragOver,
  uploading = false,
  disabled = false,
  title = 'Upload image',
  hint,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: FormMediaDropzoneProps) {
  return (
    <label
      htmlFor={htmlFor}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed px-4 py-9 text-center transition sm:gap-2 sm:py-8',
        dragOver
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/20'
          : 'border-zinc-300 bg-zinc-50 hover:border-brand-400 hover:bg-brand-50/70 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-brand-400 dark:hover:bg-brand-500/12',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-zinc-200/80 sm:size-10 dark:bg-zinc-900 dark:text-brand-300 dark:shadow-none dark:ring-zinc-600">
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ImagePlus className="h-4 w-4" aria-hidden />
        )}
      </span>
      <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
        {uploading ? 'Uploading…' : title}
      </span>
      <span className="max-w-xs text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {hint ?? (
          <>
            <span className="sm:hidden">Tap to choose a photo. JPG, PNG, WEBP, or GIF up to 20 MB.</span>
            <span className="hidden sm:inline">
              Drag and drop or click to browse. JPG, PNG, WEBP, or GIF up to 20 MB.
            </span>
          </>
        )}
      </span>
    </label>
  )
}

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { cn } from '@/lib/utils'

export type ExportFormat = 'pdf' | 'excel'
export type ExportPhase = 'idle' | 'running' | 'done' | 'error'

const STAGES: { until: number; label: string }[] = [
  { until: 22, label: 'Gathering records' },
  { until: 55, label: 'Building spreadsheet layout' },
  { until: 82, label: 'Formatting file' },
  { until: 100, label: 'Preparing download' },
]

function stageLabel(progress: number, format: ExportFormat, phase: ExportPhase) {
  if (phase === 'done') return 'Download ready'
  if (phase === 'error') return 'Export failed'
  if (format === 'pdf') {
    if (progress < 25) return 'Loading letterhead'
    if (progress < 55) return 'Composing PDF pages'
    if (progress < 85) return 'Rendering table rows'
    return 'Finalizing PDF'
  }
  for (const stage of STAGES) {
    if (progress < stage.until) return stage.label
  }
  return 'Preparing download'
}

export function ExportProgressOverlay({
  open,
  format,
  phase,
  recordCount,
  title,
}: {
  open: boolean
  format: ExportFormat
  phase: ExportPhase
  recordCount: number
  title?: string
}) {
  const titleId = useId()
  const descId = useId()
  const [progress, setProgress] = useState(0)
  const FormatIcon = format === 'pdf' ? FileText : FileSpreadsheet
  const formatLabel = format === 'pdf' ? 'PDF' : 'Excel'
  const heading = title?.trim() || `${formatLabel} export`
  const active = open && phase !== 'idle'

  useEffect(() => {
    if (!active) {
      setProgress(0)
      return
    }
    setPageScrollLocked(true)
    return () => setPageScrollLocked(false)
  }, [active])

  useEffect(() => {
    if (!active) {
      setProgress(0)
      return
    }
    if (phase === 'done') {
      setProgress(100)
      return
    }
    if (phase === 'error') return

    setProgress((prev) => Math.max(prev, 6))
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev
        const step = prev < 40 ? 3.2 : prev < 70 ? 1.8 : 0.7
        return Math.min(92, prev + step)
      })
    }, 90)
    return () => window.clearInterval(timer)
  }, [active, phase, format])

  if (!active || typeof document === 'undefined') return null

  const label = stageLabel(progress, format, phase)
  const displayProgress = Math.round(progress)

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-brand-950/55 backdrop-blur-[2px] dark:bg-black/70"
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={phase === 'running'}
        data-lenis-prevent
        className={cn(
          'relative w-full max-w-[22.5rem] overflow-hidden rounded-t-2xl border border-zinc-200/90 bg-white',
          'shadow-[0_28px_70px_-32px_rgba(30,5,65,0.55)] sm:rounded-2xl',
          'dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[0_28px_70px_-24px_rgba(0,0,0,0.8)]',
        )}
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                'inline-flex size-11 shrink-0 items-center justify-center rounded-xl ring-1',
                phase === 'done'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                  : phase === 'error'
                    ? 'bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                    : format === 'pdf'
                      ? 'bg-brand-50 text-brand-700 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
              )}
            >
              {phase === 'done' ? (
                <CheckCircle2 className="size-5" aria-hidden />
              ) : phase === 'running' ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <FormatIcon className="size-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                id={titleId}
                className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {phase === 'done' ? 'Export complete' : heading}
              </p>
              <p
                id={descId}
                className="mt-1 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400"
              >
                {label}
                {' · '}
                {recordCount.toLocaleString()} record{recordCount === 1 ? '' : 's'}
              </p>
            </div>
            <p className="pt-1 text-[13px] font-semibold tabular-nums text-brand-800 dark:text-brand-300">
              {displayProgress}%
            </p>
          </div>

          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayProgress}
            aria-label="Export progress"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-200 ease-out',
                phase === 'done'
                  ? 'bg-emerald-600'
                  : phase === 'error'
                    ? 'bg-rose-600'
                    : 'bg-brand-700 dark:bg-brand-500',
              )}
              style={{ width: `${displayProgress}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-medium text-zinc-400">
            <span className="uppercase tracking-[0.12em]">{formatLabel}</span>
            <span>
              {phase === 'done'
                ? 'Saved to your downloads'
                : phase === 'error'
                  ? 'Try again'
                  : 'Please keep this tab open'}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutGrid,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Officer setup → public student paths → review queues. */
export type EnrollmentFlowKey =
  | 'guidelines'
  | 'routing'
  | 'batches'
  | 'appointments'
  | 'offerings'
  | 'schedules'

export type EnrollmentFlowMeta = {
  key: EnrollmentFlowKey
  label: string
  path: string
  Icon: LucideIcon
  /** Short role in the overall hub. */
  role: string
  /** What this page syncs with. */
  syncsWith: string
  description: string
  related: EnrollmentFlowKey[]
}

export const ENROLLMENT_FLOW: Record<EnrollmentFlowKey, EnrollmentFlowMeta> = {
  guidelines: {
    key: 'guidelines',
    label: 'Guidelines',
    path: '/admin/enrollment/guidelines',
    Icon: ClipboardList,
    role: 'Public schedule copy',
    syncsWith: 'Shown on the public Guidelines tab (display only — not booking inventory).',
    description:
      'Schedule days and batch windows students read before booking. Keep wording aligned with Routing dates and Batches windows.',
    related: ['routing', 'batches'],
  },
  routing: {
    key: 'routing',
    label: 'Routing Config',
    path: '/admin/enrollment/routing',
    Icon: ScrollText,
    role: 'Appointment inventory',
    syncsWith: 'Feeds Routing Slip + Appointments. Batch link updates Live Updates.',
    description:
      'Dates, hourly slots, payment channels, and stations. Link each slot to an Appointment Batch so Live Updates counts stay accurate.',
    related: ['appointments', 'batches', 'guidelines'],
  },
  batches: {
    key: 'batches',
    label: 'Serving Queue',
    path: '/admin/enrollment/batches',
    Icon: CalendarDays,
    role: 'Live serving queue',
    syncsWith: 'scheduledCount = pending + approved appointments on slots linked to this batch.',
    description:
      'Queue board for Live Updates: toggle Serving / Up next (one serving at a time) and walk-in Open / Closed. Counts come from linked Routing slots.',
    related: ['routing', 'appointments'],
  },
  appointments: {
    key: 'appointments',
    label: 'Appointments',
    path: '/admin/enrollment/appointments',
    Icon: ClipboardCheck,
    role: 'Routing slip queue',
    syncsWith: 'Reserves Routing slot capacity; updates linked Batch counts on book / reject / delete.',
    description:
      'Student and officer routing-slip bookings with payment proof. Independent from Class Schedules — same student can do both.',
    related: ['routing', 'batches'],
  },
  offerings: {
    key: 'offerings',
    label: 'Class Offerings',
    path: '/admin/enrollment/offerings',
    Icon: LayoutGrid,
    role: 'Class seat inventory',
    syncsWith: 'Feeds Class Builder + Class Schedules. OPEN/FULL follows approved seat usage vs capacity.',
    description:
      'Course sections students pick in Class Builder. Set capacity; availability flips FULL when approved schedules fill seats.',
    related: ['schedules'],
  },
  schedules: {
    key: 'schedules',
    label: 'Class Schedules',
    path: '/admin/enrollment/schedules',
    Icon: BookOpen,
    role: 'Class load queue',
    syncsWith: 'Approving a load consumes Offering seats and can mark classes FULL on Live Updates.',
    description:
      'Proposed class loads from Class Builder. Independent from Appointments — approving here does not require a booking.',
    related: ['offerings'],
  },
}

export function EnrollmentStatusBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <span
        className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 px-2 py-1 text-[11px] font-medium leading-none text-emerald-950 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50 dark:shadow-none"
        title="Published"
      >
        <span
          className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-emerald-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]"
          aria-hidden
        />
        <span className="min-w-0 truncate tracking-[-0.01em]">Published</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border border-zinc-200/85 bg-gradient-to-br from-white to-zinc-100/80 px-2 py-1 text-[11px] font-medium leading-none text-zinc-700 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:from-zinc-950 dark:to-zinc-800/60 dark:text-zinc-300 dark:shadow-none"
      title="Draft"
    >
      <span
        className="inline-flex h-2 w-2 shrink-0 rounded-full bg-zinc-400 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-zinc-500 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]"
        aria-hidden
      />
      <span className="min-w-0 truncate tracking-[-0.01em]">Draft</span>
    </span>
  )
}

export const OFFERING_DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Decimal hour (13.5) → HTML time input value ("13:30"). */
export function hourToTimeInput(hour: number): string {
  if (!Number.isFinite(hour)) return '08:00'
  const clamped = Math.max(0, Math.min(23.983, hour))
  const h = Math.floor(clamped)
  const m = Math.round((clamped - h) * 60)
  const mins = m === 60 ? 0 : m
  const hours = m === 60 ? h + 1 : h
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/** HTML time input ("13:30") → decimal hour (13.5). */
export function timeInputToHour(value: string): number {
  const [hRaw, mRaw] = value.split(':')
  const h = Number.parseInt(hRaw ?? '', 10)
  const m = Number.parseInt(mRaw ?? '', 10)
  if (!Number.isFinite(h) || h < 0 || h > 23) return 0
  const mins = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0
  return h + mins / 60
}

/** "13:30" → "1:30 PM" */
export function formatAmPmFromTimeInput(value: string): string {
  const hour = timeInputToHour(value)
  const h = Math.floor(hour)
  const mins = Math.round((hour - h) * 60)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = ((h + 11) % 12) + 1
  return `${display}:${String(mins).padStart(2, '0')} ${suffix}`
}

export function buildTimeRangeLabel(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return ''
  return `${formatAmPmFromTimeInput(startTime)} – ${formatAmPmFromTimeInput(endTime)}`
}

export function buildScheduleLabel(days: string[], startTime: string, endTime: string): string {
  const range = buildTimeRangeLabel(startTime, endTime)
  if (!days.length) return range
  if (!range) return days.join(' / ')
  return `${days.join(' / ')} · ${range}`
}

/** ISO date (yyyy-mm-dd) → "Nov. 25, 2026" style label. */
export function formatEnrollmentDateLabel(iso: string): string {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return ''
  const months = [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'May',
    'Jun.',
    'Jul.',
    'Aug.',
    'Sep.',
    'Oct.',
    'Nov.',
    'Dec.',
  ]
  return `${months[month - 1]} ${day}, ${year}`
}

/** Best-effort parse of display dates into ISO for type="date". */
export function parseEnrollmentDateToIso(label: string): string {
  const trimmed = label.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = Date.parse(trimmed.replace(/\./g, ''))
  if (!Number.isFinite(parsed)) return ''
  const d = new Date(parsed)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Best-effort parse of "1:00 PM – 5:30 PM" into HTML time inputs. */
export function parseTimeRangeToInputs(label: string): { start: string; end: string } | null {
  const cleaned = label.replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const parts = cleaned.split(/\s*-\s*/)
  if (parts.length < 2) return null

  const parseToken = (token: string): string | null => {
    const compact = token.trim().replace(/\s+/g, '')
    const match = compact.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/i)
    if (!match) return null
    let hour = Number.parseInt(match[1], 10)
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null
    const minutes = match[2] ? Number.parseInt(match[2], 10) : 0
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null
    const meridiem = match[3]?.toUpperCase()
    if (meridiem === 'PM' && hour < 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const start = parseToken(parts[0])
  const end = parseToken(parts[1])
  if (!start || !end || !(timeInputToHour(end) > timeInputToHour(start))) return null
  return { start, end }
}

type EnrollmentEmptyStateProps = {
  Icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

/** FAQ-style dashed empty / no-match panel for Enrollment Hub admin registers. */
export function EnrollmentEmptyState({
  Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EnrollmentEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50',
        className,
      )}
    >
      <Icon
        className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
        strokeWidth={1.35}
        aria-hidden
      />
      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex min-h-9 items-center justify-center rounded-lg bg-brand-700 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function EnrollmentPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
          {title}
        </h1>
        <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

/** Compact live inventory / automation hint above form sections. */
export function EnrollmentInventoryBanner({
  title,
  detail,
  tone = 'neutral',
  className,
}: {
  title: string
  detail: string
  tone?: 'neutral' | 'ok' | 'warn' | 'full'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
        tone === 'ok' &&
          'border-emerald-200/80 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-50',
        tone === 'warn' &&
          'border-amber-200/80 bg-amber-50/70 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50',
        tone === 'full' &&
          'border-rose-200/80 bg-rose-50/70 text-rose-950 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-50',
        tone === 'neutral' &&
          'border-brand-200/70 bg-brand-50/60 text-brand-950 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-50',
        className,
      )}
    >
      <p className="text-[12px] font-semibold tracking-tight">{title}</p>
      <p className="text-[11px] leading-relaxed opacity-90">{detail}</p>
    </div>
  )
}

/** Step checklist for create/edit readiness. */
export function EnrollmentReadinessList({
  items,
}: {
  items: { id: string; label: string; done: boolean }[]
}) {
  const doneCount = items.filter((i) => i.done).length
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
          Ready to save
        </p>
        <p className="text-[11px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
          {doneCount}/{items.length}
        </p>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-[12px]">
            <span
              className={cn(
                'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                item.done
                  ? 'bg-emerald-500 text-white'
                  : 'border border-zinc-300 text-zinc-400 dark:border-zinc-600',
              )}
              aria-hidden
            >
              {item.done ? '✓' : ''}
            </span>
            <span
              className={cn(
                item.done ? 'font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-500',
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function EnrollmentWorkflowStatusBadge({
  status,
}: {
  status: 'pending' | 'approved' | 'rejected' | string
}) {
  const tone =
    status === 'approved'
      ? {
          wrap: 'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
          dot: 'bg-emerald-500',
          label: 'Approved',
        }
      : status === 'rejected'
        ? {
            wrap: 'border-rose-200/85 bg-gradient-to-br from-white to-rose-50/80 text-rose-950 dark:border-rose-500/22 dark:from-zinc-950 dark:to-rose-500/14 dark:text-rose-50',
            dot: 'bg-rose-500',
            label: 'Rejected',
          }
        : {
            wrap: 'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
            dot: 'bg-amber-500',
            label: 'Pending',
          }
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        tone.wrap,
      )}
    >
      <span className={cn('inline-flex h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
      <span className="min-w-0 truncate tracking-[-0.01em]">{tone.label}</span>
    </span>
  )
}


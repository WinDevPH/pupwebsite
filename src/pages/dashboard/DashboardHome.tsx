import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  FileText,
  FolderKanban,
  ImagePlay,
  Images,
  Inbox,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Settings2,
  Shirt,
  UserCog,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { workspaceCatalogShellCls } from '@/components/portal/register-ui'
import { DashboardEmpty } from '@/components/dashboard/DashboardEmpty'
import { GroupedBarChart } from '@/components/dashboard/GroupedBarChart'
import { MiniCalendar } from '@/components/dashboard/MiniCalendar'
import { listAnnouncements, type AnnouncementRecord } from '@/lib/announcements-api'
import { readStoredAuthUser } from '@/lib/auth-api'
import { listCalendarEvents, type CalendarEventRecord } from '@/lib/calendar-api'
import {
  buildActivitySeries,
  buildKpis,
  buildQueueRows,
  buildRequestStatusSlices,
  CHART_RANGES,
  countCompact,
  THEME_CHART,
  type ChartRangeId,
} from '@/lib/dashboard-stats'
import { formatPhDateTime, formatPhDayHeading } from '@/lib/datetime'
import { listPortalRequests, type PortalRequestRecord } from '@/lib/requests-api'
import { listReservations, type ReservationRecord } from '@/lib/reservations-api'
import { cn } from '@/lib/utils'

type DashboardData = {
  requests: PortalRequestRecord[]
  reservations: ReservationRecord[]
  events: CalendarEventRecord[]
  announcements: AnnouncementRecord[]
}

const ADMIN = '/admin'

const QUICK_LINKS: { to: string; label: string; hint: string; Icon: LucideIcon }[] = [
  { to: `${ADMIN}/requests`, label: 'Requests', hint: 'Student inquiries', Icon: FileText },
  { to: `${ADMIN}/feedback`, label: 'Feedbacks', hint: 'Homepage notes', Icon: MessagesSquare },
  { to: `${ADMIN}/chat`, label: 'Chat', hint: 'Landing-page messages', Icon: MessageCircle },
  { to: `${ADMIN}/reservations`, label: 'Reservations', hint: 'Locker & merch', Icon: Bookmark },
  { to: `${ADMIN}/customers`, label: 'Customers', hint: 'Purchase records', Icon: UserRound },
  { to: `${ADMIN}/income`, label: 'Income reports', hint: 'Fees & filters', Icon: Wallet },
  { to: `${ADMIN}/announcements`, label: 'Announcements', hint: 'Public posts', Icon: Megaphone },
  { to: `${ADMIN}/calendar`, label: 'Calendar', hint: 'Campus dates', Icon: CalendarDays },
  { to: `${ADMIN}/projects`, label: 'Projects', hint: 'Council work', Icon: FolderKanban },
  { to: `${ADMIN}/merch`, label: 'Merch', hint: 'Shop catalog', Icon: Shirt },
]

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(fullName: string) {
  const part = fullName.trim().split(/\s+/)[0]
  return part || fullName
}

function requestTone(status: string) {
  switch (status) {
    case 'Replied':
    case 'Closed':
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'In review':
      return 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
    case 'Received':
      return 'bg-maroon-50 text-maroon-800 dark:bg-maroon-500/15 dark:text-maroon-200'
    default:
      return 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
  }
}

function reservationTone(status: string) {
  switch (status) {
    case 'fulfilled':
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'cancelled':
      return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
    case 'submitted':
      return 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
    default:
      return 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
  }
}

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'block animate-pulse rounded-md bg-zinc-200/90 dark:bg-zinc-800',
        className,
      )}
      aria-hidden
    />
  )
}

function MetricCard({
  label,
  shortLabel,
  value,
  hint,
  to,
  Icon,
  loading,
}: {
  label: string
  shortLabel?: string
  value: number
  hint: string
  to: string
  Icon: LucideIcon
  loading?: boolean
}) {
  if (loading) {
    return (
      <div
        className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 dark:border-zinc-800 dark:bg-zinc-950"
        aria-hidden
      >
        <div className="flex items-center gap-2.5">
          <SkeletonPulse className="size-8 shrink-0 rounded-lg sm:size-9" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonPulse className="h-2.5 w-16 sm:w-24" />
            <SkeletonPulse className="h-5 w-10 sm:h-6 sm:w-12" />
            <SkeletonPulse className="hidden h-2.5 w-28 sm:block" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={to}
      title={hint}
      className={cn(
        'group flex min-w-0 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 transition sm:px-3.5 sm:py-3',
        'hover:border-brand-300/70 hover:bg-brand-50/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35',
        'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-brand-500/35 dark:hover:bg-brand-500/5',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:size-9 dark:bg-brand-500/15 dark:text-brand-300">
          <Icon className="size-3.5 sm:size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[9.5px] font-semibold tracking-[0.1em] text-zinc-500 uppercase sm:text-[10px] dark:text-zinc-400">
            <span className="sm:hidden">{shortLabel ?? label}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
          <span className="mt-1 flex items-baseline gap-1.5">
            <span className="font-hero text-[1.35rem] leading-none tracking-tight text-brand-950 sm:text-[1.5rem] dark:text-zinc-50">
              {countCompact(value)}
            </span>
          </span>
          <span className="mt-1 hidden truncate text-[11px] leading-4 text-zinc-400 sm:block dark:text-zinc-500">
            {hint}
          </span>
        </span>
        <ArrowRight
          className="hidden size-3.5 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 sm:block dark:text-zinc-600 dark:group-hover:text-zinc-300"
          aria-hidden
        />
      </span>
    </Link>
  )
}

function ChartSkeleton() {
  const heights = [42, 68, 35, 78, 52, 61, 44, 72]
  return (
    <div className="flex h-full min-h-[10.5rem] flex-col justify-end gap-1.5 sm:min-h-[14rem]" aria-hidden>
      <div className="flex flex-1 items-end gap-1.5 sm:gap-2">
        {heights.map((h, i) => (
          <span
            key={i}
            className="block w-full flex-1 animate-pulse rounded-t-md bg-zinc-200/90 dark:bg-zinc-800"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-2 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-2 w-8" />
        ))}
      </div>
    </div>
  )
}

function QueueSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start gap-2.5 px-2 py-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonPulse className="h-3.5 w-[70%]" />
            <SkeletonPulse className="h-2.5 w-[45%]" />
          </div>
          <SkeletonPulse className="mt-0.5 h-4 w-12 rounded-md" />
        </li>
      ))}
    </ul>
  )
}

function QuickLinkSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white p-2.5 sm:items-start sm:p-3 dark:border-zinc-800 dark:bg-zinc-950"
      aria-hidden
    >
      <SkeletonPulse className="size-8 rounded-lg" />
      <SkeletonPulse className="h-2.5 w-14" />
      <SkeletonPulse className="hidden h-2 w-16 sm:block" />
    </div>
  )
}

function QueuePanel({
  title,
  shortTitle,
  action,
  empty,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  loading,
  children,
}: {
  title: string
  shortTitle?: string
  action: { to: string; label: string }
  empty?: boolean
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  loading?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn(workspaceCatalogShellCls, 'flex min-h-0 flex-col overflow-hidden')}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-3 dark:border-zinc-800/80">
        <h2 className="min-w-0 truncate text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
          {shortTitle ? (
            <>
              <span className="sm:hidden">{shortTitle}</span>
              <span className="hidden sm:inline">{title}</span>
            </>
          ) : (
            title
          )}
        </h2>
        <Link
          to={action.to}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-brand-700 transition hover:text-brand-800 sm:text-xs dark:text-brand-300"
        >
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="min-h-0 flex-1 px-1 py-0.5 sm:px-2 sm:py-1">
        {loading ? (
          <QueueSkeleton rows={4} />
        ) : empty ? (
          <div className="p-2 sm:p-2.5">
            <DashboardEmpty
              compact
              icon={EmptyIcon}
              title={emptyTitle}
              description={emptyDescription}
              action={action}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export default function DashboardHome() {
  const user = readStoredAuthUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<ChartRangeId>('30d')

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    setError(null)

    const [requestsRes, reservationsRes, eventsRes, announcementsRes] = await Promise.all([
      listPortalRequests(),
      listReservations({ all: true }),
      listCalendarEvents({ all: true }),
      listAnnouncements({ all: true }),
    ])

    const failures = [requestsRes, reservationsRes, eventsRes, announcementsRes].filter(
      (r) => !r.ok,
    )
    if (failures.length === 4) {
      setError(failures[0]?.ok === false ? failures[0].error : 'Unable to load dashboard.')
      setData(null)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setData({
      requests: requestsRes.ok ? requestsRes.data.items : [],
      reservations: reservationsRes.ok ? reservationsRes.data.items : [],
      events: eventsRes.ok ? eventsRes.data.items : [],
      announcements: announcementsRes.ok ? announcementsRes.data.items : [],
    })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load('initial')
  }, [load])

  const now = useMemo(() => new Date(), [])
  const displayName = user?.fullName ? firstName(user.fullName) : 'Officer'

  const requests = data?.requests ?? []
  const reservations = data?.reservations ?? []
  const events = data?.events ?? []
  const announcements = data?.announcements ?? []

  const kpis = useMemo(
    () => buildKpis(requests, reservations, events, announcements, now),
    [requests, reservations, events, announcements, now],
  )

  const series = useMemo(
    () => buildActivitySeries(requests, reservations, { year: 'all', range }, now),
    [requests, reservations, range, now],
  )

  const queue = useMemo(() => buildQueueRows(requests, reservations, 16), [requests, reservations])
  const openRequests = useMemo(() => queue.filter((r) => r.kind === 'request').slice(0, 6), [queue])
  const pendingReservations = useMemo(
    () => queue.filter((r) => r.kind === 'reservation').slice(0, 6),
    [queue],
  )

  const statusSlices = useMemo(() => buildRequestStatusSlices(requests), [requests])
  const statusTotal = Math.max(
    1,
    statusSlices.reduce((sum, s) => sum + s.value, 0),
  )

  return (
    <div className="flex w-full max-w-none flex-col gap-3 sm:gap-3 lg:gap-4">
      <header className="flex items-start justify-between gap-2 sm:items-end sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
          <p className="truncate text-[10px] font-semibold tracking-[0.12em] text-brand-700 uppercase sm:text-[11px] sm:tracking-[0.14em] dark:text-brand-300">
            {formatPhDayHeading(now)}
          </p>
          <h1 className="font-hero text-[clamp(1.45rem,1.1rem+1.4vw,2.25rem)] leading-none tracking-tight text-brand-950 dark:text-zinc-50">
            {greetingForHour(now.getHours())}, {displayName}
          </h1>
          <p className="hidden max-w-2xl text-sm leading-6 text-zinc-500 sm:block dark:text-zinc-400">
            Council workspace overview — requests, reservations, and campus updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load('refresh')}
          disabled={loading || refreshing}
          aria-label="Refresh dashboard"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[12px] sm:font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} aria-hidden />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-maroon-200 bg-maroon-50 px-3 py-2.5 text-[13px] text-maroon-900 sm:px-4 sm:py-3 sm:text-sm dark:border-maroon-500/30 dark:bg-maroon-500/10 dark:text-maroon-100"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-4">
        <MetricCard
          label="Open requests"
          shortLabel="Requests"
          value={kpis.openRequests}
          hint="Awaiting reply or review"
          to={`${ADMIN}/requests`}
          Icon={FileText}
          loading={loading}
        />
        <MetricCard
          label="Pending reservations"
          shortLabel="Reservations"
          value={kpis.pendingReservations}
          hint="Locker & merch to process"
          to={`${ADMIN}/reservations`}
          Icon={Bookmark}
          loading={loading}
        />
        <MetricCard
          label="Upcoming events"
          shortLabel="Events"
          value={kpis.upcomingEvents}
          hint="Published calendar ahead"
          to={`${ADMIN}/calendar`}
          Icon={CalendarDays}
          loading={loading}
        />
        <MetricCard
          label="Announcements"
          shortLabel="Posts"
          value={kpis.publishedAnnouncements}
          hint={`${kpis.announcementTotal} total in register`}
          to={`${ADMIN}/announcements`}
          Icon={Megaphone}
          loading={loading}
        />
      </div>

      <section className={cn(workspaceCatalogShellCls, 'overflow-hidden')}>
        <div className="flex flex-col gap-2.5 border-b border-zinc-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 dark:border-zinc-800/80">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
              Activity
            </h2>
            <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
              Requests and reservations over time
            </p>
          </div>
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-max gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
              {CHART_RANGES.filter((r) => r.id !== '24h' && r.id !== 'all').map((item) => {
                const active = range === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRange(item.id)}
                    aria-pressed={active}
                    className={cn(
                      'h-7 shrink-0 rounded-md px-2 text-[11px] font-semibold transition sm:px-2.5 sm:text-[11.5px]',
                      active
                        ? 'bg-white text-brand-800 shadow-sm dark:bg-zinc-800 dark:text-brand-200'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_14rem] lg:items-stretch">
          <div className="min-h-[10.5rem] min-w-0 sm:min-h-[14rem]">
            {loading ? (
              <ChartSkeleton />
            ) : series.every((row) => row.requests === 0 && row.reservations === 0) ? (
              <div className="flex h-full items-center justify-center">
                <DashboardEmpty
                  compact
                  icon={CalendarDays}
                  title="No activity in this range"
                  description="New portal requests and shop reservations will appear on this chart."
                  className="w-full max-w-sm"
                />
              </div>
            ) : (
              <GroupedBarChart series={series} />
            )}
          </div>
          <div className="flex flex-col justify-center gap-2.5 border-t border-zinc-100 pt-3 sm:gap-3 sm:pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4 dark:border-zinc-800">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase sm:text-[11px] dark:text-zinc-400">
              Request status
            </p>
            {loading ? (
              <ul className="space-y-2.5" aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <SkeletonPulse className="h-2.5 w-16" />
                      <SkeletonPulse className="h-2.5 w-6" />
                    </div>
                    <SkeletonPulse className="h-1.5 w-full rounded-full" />
                  </li>
                ))}
              </ul>
            ) : statusSlices.length === 0 ? (
              <DashboardEmpty
                compact
                icon={Inbox}
                title="No requests yet"
                description="Statuses show here once students submit through the portal."
                action={{ to: `${ADMIN}/requests`, label: 'Open requests' }}
              />
            ) : (
              <ul className="space-y-2 sm:space-y-2.5">
                {statusSlices.map((slice) => (
                  <li key={slice.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                      <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
                        {slice.label}
                      </span>
                      <span className="tabular-nums text-zinc-500">{countCompact(slice.value)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${Math.max(6, (slice.value / statusTotal) * 100)}%`,
                          background: slice.color,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!loading && statusSlices.length > 0 ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <i
                    className="size-2 rounded-full"
                    style={{
                      background: `linear-gradient(180deg,${THEME_CHART.requests.from},${THEME_CHART.requests.to})`,
                    }}
                    aria-hidden
                  />
                  Requests
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i
                    className="size-2 rounded-full"
                    style={{
                      background: `linear-gradient(180deg,${THEME_CHART.reservations.from},${THEME_CHART.reservations.to})`,
                    }}
                    aria-hidden
                  />
                  Reservations
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-2">
        <QueuePanel
          title="Requests needing attention"
          shortTitle="Open requests"
          action={{ to: `${ADMIN}/requests`, label: 'View all' }}
          loading={loading}
          empty={!loading && openRequests.length === 0}
          emptyIcon={Inbox}
          emptyTitle="All caught up"
          emptyDescription="Open requests from the student portal will show here for review."
        >
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {openRequests.map((item, index) => (
              <li key={item.id} className={cn(index >= 4 && 'hidden sm:list-item')}>
                <Link
                  to={item.href}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition hover:bg-zinc-50 sm:gap-3 sm:py-2.5 dark:hover:bg-zinc-900/70"
                >
                  <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                    <p className="truncate text-[13px] font-medium text-zinc-900 sm:text-sm dark:text-zinc-100">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 sm:text-xs dark:text-zinc-400">
                      {item.meta}
                      <span className="hidden sm:inline">
                        {item.at ? ` · ${formatPhDateTime(new Date(item.at))}` : ''}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide uppercase sm:text-[10px]',
                      requestTone(item.status),
                    )}
                  >
                    {item.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </QueuePanel>

        <QueuePanel
          title="Reservations to process"
          shortTitle="Pending reservations"
          action={{ to: `${ADMIN}/reservations`, label: 'View all' }}
          loading={loading}
          empty={!loading && pendingReservations.length === 0}
          emptyIcon={Bookmark}
          emptyTitle="No pending reservations"
          emptyDescription="Locker and merch reservations awaiting action will land here."
        >
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {pendingReservations.map((item, index) => (
              <li
                key={item.id}
                className={cn(index >= 4 && 'hidden sm:list-item')}
              >
                <Link
                  to={item.href}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition hover:bg-zinc-50 sm:gap-3 sm:py-2.5 dark:hover:bg-zinc-900/70"
                >
                  <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                    <p className="truncate text-[13px] font-medium text-zinc-900 sm:text-sm dark:text-zinc-100">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 sm:text-xs dark:text-zinc-400">
                      {item.meta}
                      <span className="hidden sm:inline">
                        {item.at ? ` · ${formatPhDateTime(new Date(item.at))}` : ''}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide uppercase sm:text-[10px]',
                      reservationTone(item.status),
                    )}
                  >
                    {item.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </QueuePanel>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={cn(workspaceCatalogShellCls, 'overflow-hidden')}>
          <MiniCalendar events={events} loading={loading} adminBase={ADMIN} />
        </section>

        <section className="space-y-2.5 sm:space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
                Quick access
              </h2>
              <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
                Jump to common modules
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3 sm:gap-2 xl:grid-cols-2">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => <QuickLinkSkeleton key={i} />)
              : QUICK_LINKS.map(({ to, label, hint, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      'group flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white p-2.5 text-center transition sm:items-start sm:gap-2 sm:p-3 sm:text-left',
                      'hover:border-brand-300/70 hover:bg-brand-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35',
                      'dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-brand-500/35 dark:hover:bg-brand-500/5',
                    )}
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-zinc-50 text-brand-700 dark:bg-zinc-900 dark:text-brand-300">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 w-full">
                      <span className="block truncate text-[11px] font-semibold text-zinc-900 sm:text-sm dark:text-zinc-100">
                        {label}
                      </span>
                      <span className="mt-0.5 hidden truncate text-[11px] text-zinc-500 sm:block dark:text-zinc-400">
                        {hint}
                      </span>
                    </span>
                  </Link>
                ))}
          </div>

          <div
            className={cn(
              workspaceCatalogShellCls,
              'flex flex-col gap-2 p-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:p-3',
            )}
          >
            <p className="text-[11px] font-medium text-zinc-500 sm:text-xs dark:text-zinc-400">
              System
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-1.5">
              <Link
                to={`${ADMIN}/users`}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 sm:px-2.5 sm:text-[12px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <UserCog className="size-3.5" aria-hidden />
                Users
              </Link>
              <Link
                to={`${ADMIN}/gallery`}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 sm:px-2.5 sm:text-[12px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Images className="size-3.5" aria-hidden />
                Gallery
              </Link>
              <Link
                to={`${ADMIN}/hero-slides`}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 sm:px-2.5 sm:text-[12px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <ImagePlay className="size-3.5" aria-hidden />
                Hero
              </Link>
              <Link
                to={`${ADMIN}/settings`}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 sm:px-2.5 sm:text-[12px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Settings2 className="size-3.5" aria-hidden />
                Settings
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

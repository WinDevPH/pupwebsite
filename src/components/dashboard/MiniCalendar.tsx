import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { DashboardEmpty } from '@/components/dashboard/DashboardEmpty'
import type { CalendarEventRecord, CalendarKind } from '@/lib/calendar-api'
import { PH_TIMEZONE, parseApiDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

const KIND_DOT: Record<CalendarKind, string> = {
  holiday: 'bg-rose-500',
  exam: 'bg-amber-500',
  enrollment: 'bg-sky-500',
  academic: 'bg-brand-600',
}

const KIND_CHIP: Record<CalendarKind, string> = {
  holiday: 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  exam: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  enrollment: 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  academic: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
}

const KIND_LABEL: Record<CalendarKind, string> = {
  holiday: 'Holiday',
  exam: 'Exam',
  enrollment: 'Enrollment',
  academic: 'Academic',
}

const KIND_DEFAULT_IMAGE: Record<CalendarKind, string> = {
  holiday: '/calendar/defaults/holiday.jpg',
  exam: '/calendar/defaults/exam.jpg',
  enrollment: '/calendar/defaults/enrollment.jpg',
  academic: '/calendar/defaults/academic.jpg',
}

function eventCover(event: CalendarEventRecord) {
  return event.image?.trim() || KIND_DEFAULT_IMAGE[event.kind]
}

function EventThumb({ src, alt = '' }: { src: string; alt?: string }) {
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:size-10 dark:border-zinc-700 dark:bg-zinc-800">
      <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
    </span>
  )
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-2.5 p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[1fr_11.5rem]" aria-hidden>
      <div className="min-w-0 space-y-1.5">
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[9px] font-semibold text-transparent sm:text-[10px]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <span
              key={i}
              className="aspect-square animate-pulse rounded-md bg-zinc-200/80 dark:bg-zinc-800"
            />
          ))}
        </div>
      </div>
      <div className="min-w-0 space-y-2 border-t border-zinc-100 pt-2.5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-3 dark:border-zinc-800">
        <span className="block h-2.5 w-12 animate-pulse rounded bg-zinc-200/90 dark:bg-zinc-800" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg py-1">
            <span className="size-9 shrink-0 animate-pulse rounded-lg bg-zinc-200/90 sm:size-10 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <span className="block h-3 w-[85%] animate-pulse rounded bg-zinc-200/90 dark:bg-zinc-800" />
              <span className="block h-2.5 w-14 animate-pulse rounded bg-zinc-200/90 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function manilaParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  }
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_TIMEZONE,
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1, 4, 0, 0)))
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0))
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE,
    weekday: 'short',
  }).format(first)
  const sunIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  const startPad = sunIndex < 0 ? 0 : sunIndex
  const daysInMonth = new Date(Date.UTC(year, month, 0, 4, 0, 0)).getUTCDate()

  const cells: { key: string; day: number | null; inMonth: boolean }[] = []
  for (let i = 0; i < startPad; i += 1) {
    cells.push({ key: `pad-${i}`, day: null, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ key: dateKey(year, month, d), day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `trail-${cells.length}`, day: null, inMonth: false })
  }
  return cells
}

export function MiniCalendar({
  events,
  loading,
  adminBase = '/admin',
}: {
  events: CalendarEventRecord[]
  loading?: boolean
  adminBase?: string
}) {
  const today = useMemo(() => manilaParts(new Date()), [])
  const [cursor, setCursor] = useState({ year: today.year, month: today.month })
  const [selectedKey, setSelectedKey] = useState(() =>
    dateKey(today.year, today.month, today.day),
  )

  const published = useMemo(() => events.filter((e) => e.published), [events])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>()
    for (const event of published) {
      const start = parseApiDate(event.start)
      const end = parseApiDate(event.end || event.start)
      if (!start) continue
      const startP = manilaParts(start)
      const endP = end ? manilaParts(end) : startP
      let y = startP.year
      let m = startP.month
      let d = startP.day
      const endStamp = dateKey(endP.year, endP.month, endP.day)
      // Walk inclusive date range (cap to avoid runaway on bad data)
      for (let guard = 0; guard < 120; guard += 1) {
        const key = dateKey(y, m, d)
        const list = map.get(key) ?? []
        list.push(event)
        map.set(key, list)
        if (key >= endStamp) break
        const next = new Date(Date.UTC(y, m - 1, d + 1, 4, 0, 0))
        const np = manilaParts(next)
        y = np.year
        m = np.month
        d = np.day
      }
    }
    return map
  }, [published])

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  const selectedEvents = useMemo(() => {
    return (eventsByDay.get(selectedKey) ?? []).slice(0, 4)
  }, [eventsByDay, selectedKey])

  const upcomingStrip = useMemo(() => {
    const todayKey = dateKey(today.year, today.month, today.day)
    return published
      .filter((e) => {
        const end = parseApiDate(e.end || e.start)
        if (!end) return false
        const p = manilaParts(end)
        return dateKey(p.year, p.month, p.day) >= todayKey
      })
      .sort((a, b) => {
        const ta = parseApiDate(a.start)?.getTime() ?? 0
        const tb = parseApiDate(b.start)?.getTime() ?? 0
        return ta - tb
      })
      .slice(0, 3)
  }, [published, today])

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      let month = prev.month + delta
      let year = prev.year
      if (month < 1) {
        month = 12
        year -= 1
      } else if (month > 12) {
        month = 1
        year += 1
      }
      return { year, month }
    })
  }

  const isCurrentMonth = cursor.year === today.year && cursor.month === today.month

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:border-zinc-800/80">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
            Calendar
          </h2>
          <p className="truncate text-[10px] text-zinc-500 sm:text-[11px] dark:text-zinc-400">
            {monthLabel(cursor.year, cursor.month)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 sm:size-7 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {!isCurrentMonth ? (
            <button
              type="button"
              onClick={() => {
                setCursor({ year: today.year, month: today.month })
                setSelectedKey(dateKey(today.year, today.month, today.day))
              }}
              className="h-8 rounded-md px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 sm:h-7 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 sm:size-7 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <Link
            to={`${adminBase}/calendar`}
            className="ms-0.5 hidden h-7 items-center rounded-md px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 sm:inline-flex dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            Open
          </Link>
        </div>
      </div>

      {loading ? (
        <CalendarSkeleton />
      ) : published.length === 0 ? (
        <div className="p-2.5 sm:p-3">
          <DashboardEmpty
            icon={CalendarDays}
            title="No calendar events yet"
            description="Published holidays, exams, and academic dates will appear here."
            action={{ to: `${adminBase}/calendar`, label: 'Manage calendar' }}
          />
        </div>
      ) : (
        <div className="grid gap-2.5 p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[1fr_11.5rem]">
          <div className="min-w-0">
            <div className="mb-0.5 grid grid-cols-7 gap-0.5 sm:mb-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-0.5 text-center text-[9px] font-semibold tracking-wide text-zinc-400 uppercase sm:py-1 sm:text-[10px]"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                if (!cell.inMonth || cell.day == null) {
                  return <div key={cell.key} className="aspect-square" />
                }
                const key = dateKey(cursor.year, cursor.month, cell.day)
                const dayEvents = eventsByDay.get(key) ?? []
                const isToday =
                  cursor.year === today.year &&
                  cursor.month === today.month &&
                  cell.day === today.day
                const isSelected = key === selectedKey
                const kinds = [...new Set(dayEvents.map((e) => e.kind))].slice(0, 3)

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    aria-pressed={isSelected}
                    aria-label={`${cell.day}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
                    className={cn(
                      'relative flex aspect-square flex-col items-center justify-center rounded-md text-[11px] font-semibold transition sm:rounded-lg sm:text-[12px]',
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                        : isToday
                          ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30'
                          : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900',
                    )}
                  >
                    {cell.day}
                    {kinds.length > 0 ? (
                      <span className="absolute bottom-0.5 flex items-center gap-0.5 sm:bottom-1">
                        {kinds.map((kind) => (
                          <i
                            key={kind}
                            className={cn(
                              'size-1 rounded-full',
                              isSelected ? 'bg-white/90' : KIND_DOT[kind],
                            )}
                            aria-hidden
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-w-0 border-t border-zinc-100 pt-2.5 sm:pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-3 dark:border-zinc-800">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
              {selectedKey === dateKey(today.year, today.month, today.day)
                ? 'Today'
                : selectedKey}
            </p>
            {selectedEvents.length === 0 ? (
              <div className="mt-2 space-y-2">
                <DashboardEmpty
                  compact
                  icon={CalendarDays}
                  title="Nothing on this day"
                  description="Pick another date, or check what’s coming up next."
                />
                {upcomingStrip.length > 0 ? (
                  <>
                    <p className="pt-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
                      Next up
                    </p>
                    <ul className="space-y-1.5">
                      {upcomingStrip.map((event) => {
                        const start = parseApiDate(event.start)
                        const p = start ? manilaParts(start) : null
                        return (
                          <li key={event.id}>
                            <Link
                              to={`${adminBase}/calendar/${event.id}/edit`}
                              className="flex items-start gap-2 rounded-lg px-1 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                            >
                              <EventThumb src={eventCover(event)} />
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                                  {event.title}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'rounded px-1 py-px text-[9px] font-semibold uppercase',
                                      KIND_CHIP[event.kind],
                                    )}
                                  >
                                    {KIND_LABEL[event.kind]}
                                  </span>
                                  {p ? (
                                    <span className="text-[10px] text-zinc-400">
                                      {p.month}/{p.day}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    <Link
                      to={`${adminBase}/calendar/${event.id}/edit`}
                      className="flex items-start gap-2 rounded-lg px-1 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                    >
                      <EventThumb src={eventCover(event)} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[12px] font-semibold leading-4 text-zinc-900 dark:text-zinc-100">
                          {event.title}
                        </span>
                        <span
                          className={cn(
                            'mt-1 inline-flex rounded px-1 py-px text-[9px] font-semibold uppercase',
                            KIND_CHIP[event.kind],
                          )}
                        >
                          {KIND_LABEL[event.kind]}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

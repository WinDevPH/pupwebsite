import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  GraduationCap,
  LayoutGrid,
  ListFilter,
  ScrollText,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { PH_TIMEZONE } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/motion'
import { Reveal } from '@/components/motion/Reveal'
import { useHashScroll } from '@/hooks/useHashScroll'
import emptyCalendar from '@/assets/calendar/empty.jpg'
import { studentHandbookUrl } from '@/components/layout/nav-data'
import { listCalendarEvents, type CalendarKind } from '@/lib/calendar-api'
import {
  currentAcademicYearStart,
  formatAcademicYear,
} from '@/lib/council-members-api'
import { stripHtml } from '@/lib/rich-text'

type Kind = CalendarKind

type CalEvent = {
  id: string
  title: string
  start: string
  end: string
  kind: Kind
  description: string | null
  image: string | null
}

const kindMeta: Record<
  Kind,
  {
    label: string
    chip: string
    bar: string
    accent: string
    badge: string
    tone: string
    image: string
    icon: LucideIcon
  }
> = {
  holiday: {
    label: 'Holiday',
    chip: 'bg-gold-100 text-brand-950',
    bar: 'bg-gold-500',
    accent: 'border-l-gold-500',
    badge: 'bg-gold-500 text-brand-950',
    tone: 'text-gold-600',
    image: '/calendar/defaults/holiday.jpg',
    icon: Sun,
  },
  exam: {
    label: 'Examination',
    chip: 'bg-brand-100 text-brand-800',
    bar: 'bg-brand-700',
    accent: 'border-l-brand-700',
    badge: 'bg-brand-700 text-white',
    tone: 'text-brand-700',
    image: '/calendar/defaults/exam.jpg',
    icon: GraduationCap,
  },
  enrollment: {
    label: 'Enrollment',
    chip: 'bg-brand-50 text-brand-700',
    bar: 'bg-brand-400',
    accent: 'border-l-brand-400',
    badge: 'bg-brand-600 text-white',
    tone: 'text-brand-600',
    image: '/calendar/defaults/enrollment.jpg',
    icon: ClipboardPen,
  },
  academic: {
    label: 'Academic',
    chip: 'bg-maroon-100 text-maroon-800',
    bar: 'bg-maroon-700',
    accent: 'border-l-maroon-700',
    badge: 'bg-maroon-700 text-white',
    tone: 'text-maroon-700',
    image: '/calendar/defaults/academic.jpg',
    icon: BookOpen,
  },
}

const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const filters = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'holiday', label: 'Holidays', icon: Sun },
  { id: 'exam', label: 'Exams', icon: GraduationCap },
  { id: 'enrollment', label: 'Enrollment', icon: ClipboardPen },
  { id: 'academic', label: 'Academic', icon: BookOpen },
] as const

type FilterId = (typeof filters)[number]['id']

const monthFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: PH_TIMEZONE,
  month: 'long',
  year: 'numeric',
})
const dayFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: PH_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function eventsOn(events: CalEvent[], key: string, filter: FilterId) {
  return events.filter(
    (item) => item.start <= key && key <= item.end && (filter === 'all' || item.kind === filter),
  )
}

function spanDays(item: CalEvent) {
  const start = parseKey(item.start).getTime()
  const end = parseKey(item.end).getTime()
  return Math.round((end - start) / 86_400_000) + 1
}

function gridEvents(events: CalEvent[], key: string, filter: FilterId) {
  return eventsOn(events, key, filter).map((item) => ({
    item,
    labeled: item.start === key || spanDays(item) <= 3,
  }))
}

function lengthLabel(item: CalEvent) {
  const days = spanDays(item)
  return days === 1 ? '1 day' : `${days} days`
}

function shortRange(start: string, end: string) {
  const from = parseKey(start)
  const to = parseKey(end)
  if (start === end) return dayFormat.format(from)
  const sameYear = from.getFullYear() === to.getFullYear()
  const startLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(from)
  return `${startLabel} – ${dayFormat.format(to)}`
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const mondayIndex = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayIndex)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function dayLabel(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  if (date.getDate() !== 1) return day
  const month = date.toLocaleDateString('en-PH', { month: 'short' })
  return `${day} ${month}`
}

export function EventsCalendar() {
  const reduce = useReducedMotion() === true
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(todayKey)
  const [kind, setKind] = useState<FilterId>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useHashScroll('calendar')
  const filtering = kind !== 'all'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listCalendarEvents().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setEvents([])
        setLoadError(result.error)
        setLoading(false)
        return
      }
      setEvents(
        result.data.items.map((item) => ({
          id: item.slug,
          title: item.title,
          start: item.start,
          end: item.end,
          kind: item.kind,
          description: item.description,
          image: item.image,
        })),
      )
      setLoadError(null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!filterOpen) {
      setMenuPos(null)
      return
    }
    function place() {
      const el = filterRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFilterOpen(false)
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (filterRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setFilterOpen(false)
    }
    place()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [filterOpen])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = monthCells(year, month)
  const selectedEvents = eventsOn(events, selected, kind)
  const selectedDate = parseKey(selected)
  const viewingToday = selected === todayKey
  const nextEvent = events
    .filter((item) => item.start > selected && (kind === 'all' || item.kind === kind))
    .sort((a, b) => a.start.localeCompare(b.start))[0]

  function openDate(key: string) {
    const date = parseKey(key)
    setSelected(key)
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  function shiftMonth(amount: number) {
    const next = new Date(year, month + amount, 1)
    setCursor(next)
    const key = dateKey(next)
    setSelected(next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth() ? todayKey : key)
  }

  return (
    <section
      id="calendar"
      aria-labelledby="calendar-title"
      className="scroll-mt-28 bg-surface dark:bg-zinc-950"
    >
      <div className="mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
        <header className="mx-auto max-w-3xl text-center">
          <SectionKicker icon={CalendarDays}>Calendar</SectionKicker>
          <h2
            id="calendar-title"
            className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 dark:text-zinc-50"
          >
            Upcoming <span className="text-brand-600 dark:text-brand-400">Events</span>
          </h2>
          <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Examinations, enrollment, and holiday breaks from the A.Y.{' '}
            {formatAcademicYear(currentAcademicYearStart())} academic calendar.
          </p>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
              Loading calendar…
            </p>
          ) : null}
          {loadError ? (
            <p className="mt-3 text-sm text-maroon-700 dark:text-maroon-300" role="alert">
              {loadError}
            </p>
          ) : null}
        </header>
        </Reveal>

        <Reveal delay={0.08} className="mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-zinc-100 p-3 sm:p-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => openDate(todayKey)}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-brand-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Today
            </button>
            <div className="inline-flex h-9 min-w-0 items-center rounded-lg border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="inline-flex size-9 shrink-0 items-center justify-center text-brand-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <h3 className="min-w-0 truncate px-1 text-center text-sm font-semibold text-brand-950 sm:min-w-[9.5rem] dark:text-zinc-50">
                {monthFormat.format(cursor)}
              </h3>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="inline-flex size-9 shrink-0 items-center justify-center text-brand-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="relative ml-auto shrink-0" ref={filterRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                className={cn(
                  'relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors sm:px-3',
                  filtering
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-zinc-200 bg-white text-brand-950 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
                )}
              >
                <ListFilter className="size-3.5" strokeWidth={2.1} aria-hidden />
                Filter
                {filtering ? (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-white ring-2 ring-brand-700 dark:bg-zinc-950" />
                ) : null}
              </button>
              {filterOpen && menuPos
                ? createPortal(
                    <div
                      ref={menuRef}
                      role="menu"
                      style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 60 }}
                      className="w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
                    >
                  <div className="flex items-center gap-2 px-2 py-2">
                    <div className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      <ListFilter className="size-3.5" strokeWidth={2.1} aria-hidden />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <p className="text-[13px] font-semibold text-brand-950 dark:text-zinc-50">Filters</p>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">Event type</p>
                    </div>
                  </div>
                  <div className="border-t border-zinc-100 py-1 dark:border-zinc-800">
                    {filters.map((item) => {
                      const selectedFilter = kind === item.id
                      const count =
                        item.id === 'all'
                          ? events.length
                          : events.filter((event) => event.kind === item.id).length
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selectedFilter}
                          onClick={() => {
                            setKind(item.id)
                            setFilterOpen(false)
                          }}
                          className={cn(
                            'flex h-10 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-[13px] font-medium',
                            selectedFilter
                              ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                              : 'text-brand-950 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800',
                          )}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <item.icon className="size-3.5 shrink-0" aria-hidden />
                            {item.label}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                  {filtering ? (
                    <div className="border-t border-zinc-100 px-2 py-2 text-center dark:border-zinc-800">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setKind('all')
                          setFilterOpen(false)
                        }}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : null}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>

          <motion.div
            key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: easeOut }}
            className="@container m-2 min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/40 p-2 sm:m-3 sm:p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="px-1 pb-2 text-left text-[10px] font-medium text-zinc-400 sm:text-xs dark:text-zinc-500"
                >
                  <span className="sm:hidden">{label.slice(0, 3)}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              ))}
              {cells.map((date) => {
                const key = dateKey(date)
                const inMonth = date.getMonth() === month
                const listed = gridEvents(events, key, kind)
                const labeled = listed.filter((entry) => entry.labeled)
                const shown = labeled.slice(0, 3)
                const extra = labeled.length - shown.length
                const bars = listed.filter((entry) => !entry.labeled).slice(0, 2)
                const isToday = key === todayKey
                const isSelected = selected === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDate(key)}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'flex min-h-[4.25rem] flex-col rounded-lg border bg-white p-1 text-left sm:min-h-24 sm:rounded-xl sm:p-2 lg:min-h-[7.25rem] dark:bg-zinc-950',
                      inMonth
                        ? 'border-zinc-200 dark:border-zinc-800'
                        : 'border-zinc-100 bg-zinc-50/70 dark:border-zinc-800/80 dark:bg-zinc-900/40',
                      isToday &&
                        'border-brand-100 bg-brand-50 dark:border-brand-500/35 dark:bg-brand-500/12',
                      isSelected && 'border-dashed border-brand-600 dark:border-brand-400',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[10px] font-medium tabular-nums sm:text-xs',
                        isToday
                          ? 'font-semibold text-brand-700 dark:text-brand-300'
                          : inMonth
                            ? 'text-brand-950 dark:text-zinc-100'
                            : 'text-zinc-400 dark:text-zinc-600',
                      )}
                    >
                      {dayLabel(date)}
                    </span>
                    <span className="mt-1 hidden min-w-0 flex-col gap-1 @[32rem]:flex">
                      {shown.map(({ item }) => (
                        <span key={item.id} className="flex min-w-0 items-center gap-1">
                          <span className={cn('h-3 w-0.5 shrink-0 rounded-full', kindMeta[item.kind].bar)} aria-hidden />
                          <span className="truncate text-[10px] leading-tight font-medium text-brand-950 dark:text-zinc-200">
                            {item.title}
                          </span>
                        </span>
                      ))}
                      {bars.map(({ item }) => (
                        <span key={item.id} className="flex min-w-0 items-center gap-1">
                          <span className={cn('h-1 w-8 shrink-0 rounded-full', kindMeta[item.kind].bar)} aria-hidden />
                          <span className="sr-only">{item.title}</span>
                        </span>
                      ))}
                      {extra > 0 ? (
                        <span className="self-start rounded bg-brand-700 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          +{extra}
                        </span>
                      ) : null}
                    </span>
                    {listed.length > 0 ? (
                      <span className="mt-auto flex flex-col gap-1 pt-1 @[32rem]:hidden" aria-hidden>
                        {listed.slice(0, 2).map(({ item }) => (
                          <span key={item.id} className={cn('h-1 w-full rounded-full', kindMeta[item.kind].bar)} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </motion.div>
          </div>

          <aside className="flex flex-col border-t border-zinc-200 bg-white p-4 shadow-none sm:p-5 lg:border-t-0 lg:border-l dark:border-zinc-800 dark:bg-zinc-950 lg:dark:border-l-zinc-800">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Schedule</h3>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                <CalendarDays className="size-3.5 text-brand-700 dark:text-brand-300" aria-hidden />
                {viewingToday ? 'Today, ' : ''}
                {dayFormat.format(selectedDate)}
              </p>
            </div>
            <motion.div
              key={`${selected}-${kind}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="flex min-h-0 flex-1 flex-col"
            >
            {selectedEvents.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
                <img
                  src={emptyCalendar}
                  alt=""
                  width={640}
                  height={640}
                  className="h-36 w-auto max-w-full object-contain"
                />
                <h4 className="mt-4 font-display text-xl font-medium text-brand-950 dark:text-zinc-50">
                  No events on this day
                </h4>
                <p className="mt-1.5 max-w-[16rem] text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  The academic calendar has nothing listed for {dayFormat.format(selectedDate)}.
                </p>
                {nextEvent ? (
                  <button
                    type="button"
                    onClick={() => openDate(nextEvent.start)}
                    className="mt-5 inline-flex h-9 items-center rounded-lg border border-brand-200 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-200 dark:hover:bg-brand-500/15"
                  >
                    Next date · {dayFormat.format(parseKey(nextEvent.start))}
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {selectedEvents.map((item) => {
                  const meta = kindMeta[item.kind]
                  const Icon = meta.icon
                  const days = spanDays(item)
                  const cover = item.image || meta.image
                  return (
                    <li
                      key={item.id}
                      className="flex overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className={cn('w-1 shrink-0', meta.bar)} aria-hidden />
                      <div className="relative w-[5.25rem] shrink-0 self-stretch">
                        <img
                          src={cover}
                          alt=""
                          width={168}
                          height={168}
                          className="absolute inset-0 size-full object-cover"
                        />
                        <span
                          className={cn(
                            'absolute right-1 bottom-1 inline-flex size-8 flex-col items-center justify-center rounded-full leading-none ring-2 ring-white dark:ring-zinc-950',
                            meta.badge,
                          )}
                          aria-label={lengthLabel(item)}
                        >
                          <span className="text-[11px] font-bold">{days}</span>
                          <span className="text-[6px] font-semibold tracking-wide uppercase">
                            {days === 1 ? 'day' : 'days'}
                          </span>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col px-3 py-2.5">
                        <p className="flex items-center gap-1.5">
                          <span className={cn('flex size-5 items-center justify-center rounded-md', meta.badge)}>
                            <Icon className="size-3" aria-hidden />
                          </span>
                          <span className={cn('text-[11px] font-semibold tracking-[0.12em] uppercase', meta.tone)}>
                            {meta.label}
                          </span>
                        </p>
                        <p className="mt-1.5 text-sm leading-5 font-semibold text-zinc-950 dark:text-zinc-50">
                          {item.title}
                        </p>
                        {item.description ? (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-zinc-600 dark:text-zinc-400">
                            {stripHtml(item.description)}
                          </p>
                        ) : null}
                        <p className={cn('mt-1.5 flex items-center gap-1.5 text-[12px] leading-4', meta.tone)}>
                          <CalendarRange className="size-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 text-zinc-500 dark:text-zinc-400">
                            {shortRange(item.start, item.end)}
                          </span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            </motion.div>
          </aside>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <nav
            aria-label="Quick links"
            className="mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] max-w-3xl"
          >
            <p className="text-center text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase dark:text-brand-300">
              Quick links
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Student Handbook',
                  href: studentHandbookUrl,
                  description: 'Policies and guidelines for PUP law students.',
                  icon: BookMarked,
                },
                {
                  label: 'Transparency',
                  to: '/transparency',
                  description: 'Governance records and Council resolutions.',
                  icon: ScrollText,
                },
              ].map((item) => {
                const className =
                  'group flex h-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 transition-colors hover:border-brand-200 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500/40'
                const body = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 text-brand-700 dark:border-brand-500/30 dark:text-brand-300">
                      <item.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-700"
                      aria-hidden
                    />
                  </>
                )

                return (
                  <li key={'href' in item ? item.href : item.to}>
                    {'href' in item ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className={className}
                      >
                        {body}
                      </a>
                    ) : (
                      <Link to={item.to} className={className}>
                        {body}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
        </Reveal>
      </div>
    </section>
  )
}
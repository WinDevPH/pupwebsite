import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarDays, ChevronDown, ChevronUp, Clock, FileText, LayoutGrid, ListFilter, Loader2, Megaphone, Newspaper, Search } from 'lucide-react'
import emptyBulletin from '@/assets/announcements/empty-character.png'
import { formatPhDate, formatPhTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { easeOut, listSwap, popIn } from '@/lib/motion'
import { Reveal, useRevealViewport, useSkipRevealHide } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { scrollPageTo } from '@/hooks/useLenis'
import {
  listAnnouncements,
  type AnnouncementRecord,
} from '@/lib/announcements-api'

export type Kind = 'issuance' | 'event' | 'social'

export type Announcement = {
  id: string
  kind: Kind
  title: string
  summary: string
  date: string
  image: string
  href: string
  external?: boolean
  source?: string
  body?: string | null
}

const kindMeta: Record<Kind, { label: string; icon: typeof FileText }> = {
  issuance: { label: 'Issuance', icon: FileText },
  event: { label: 'Event', icon: CalendarDays },
  social: { label: 'Social', icon: Megaphone },
}

const filters = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'issuance', label: 'Issuances', icon: FileText },
  { id: 'event', label: 'Events', icon: CalendarDays },
  { id: 'social', label: 'Social', icon: Megaphone },
] as const

type FilterId = (typeof filters)[number]['id']

export function mapAnnouncementRecord(item: AnnouncementRecord): Announcement {
  return {
    id: item.slug,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    date: item.date,
    image: item.image,
    href: item.href,
    external: item.external,
    source: item.source ?? undefined,
    body: item.body,
  }
}

export function formatPosted(iso: string) {
  const dateLabel = formatPhDate(iso)
  const timeLabel = formatPhTime(iso)
  if (dateLabel === '—' || timeLabel === '—') return '—'
  return `${dateLabel} · ${timeLabel}`
}

function matchesQuery(item: Announcement, needle: string) {
  if (needle === '') return true
  const haystack = `${item.title} ${item.summary} ${kindMeta[item.kind].label} ${item.source ?? ''}`.toLowerCase()
  return haystack.includes(needle)
}

export function relatedAnnouncements(items: Announcement[], id: string, count = 3) {
  const current = items.find((item) => item.id === id)
  if (!current) return []
  const rest = items
    .filter((item) => item.id !== id)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const same = rest.filter((item) => item.kind === current.kind)
  const other = rest.filter((item) => item.kind !== current.kind)
  return [...same, ...other].slice(0, count)
}

export function announcementKind(kind: Kind) {
  return kindMeta[kind]
}

const pageSize = 6

export function Announcements({ variant = 'page' }: { variant?: 'page' | 'portal' }) {
  const portal = variant === 'portal'
  const location = useLocation()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(pageSize)
  const listRef = useRef<HTMLUListElement>(null)
  const revealedCount = useRef(pageSize)
  const reduce = useReducedMotion() === true
  const viewport = useRevealViewport()
  const needle = query.trim().toLowerCase()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError('')
      const result = await listAnnouncements()
      if (cancelled) return
      if (!result.ok) {
        setAnnouncements([])
        setLoadError(result.error)
        setLoading(false)
        return
      }
      setAnnouncements(result.data.items.map(mapAnnouncementRecord))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const items = announcements
    .filter((item) => {
      const matchesKind = filter === 'all' || item.kind === filter
      return matchesKind && matchesQuery(item, needle)
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const visible = items.slice(0, limit)
  const freshFrom = revealedCount.current

  useEffect(() => {
    const previous = revealedCount.current
    revealedCount.current = limit
    if (limit <= previous) return

    const card = listRef.current?.children.item(previous)
    const scroller = document.querySelector('.app-scroll')
    if (!(card instanceof HTMLElement) || !(scroller instanceof HTMLElement)) return

    const cardBox = card.getBoundingClientRect()
    const viewBox = scroller.getBoundingClientRect()
    if (cardBox.top >= viewBox.top + 72 && cardBox.bottom <= viewBox.bottom - 24) return

    const top = cardBox.top - viewBox.top + scroller.scrollTop - 96
    scrollPageTo(Math.max(0, top), !reduce)
  }, [limit, reduce])
  useEffect(() => {
    revealedCount.current = pageSize
  }, [filter, needle])

  useLayoutEffect(() => {
    if (portal || location.hash !== '#bulletin') return
    const section = document.getElementById('bulletin')
    const scroller = document.querySelector('.app-scroll')
    if (!section || !(scroller instanceof HTMLElement)) return
    const top =
      section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      112
    scroller.scrollTop = Math.max(0, top)
  }, [location.hash, location.pathname, portal])

  const counts: Record<FilterId, number> = {
    all: announcements.filter((item) => matchesQuery(item, needle)).length,
    issuance: announcements.filter((item) => item.kind === 'issuance' && matchesQuery(item, needle)).length,
    event: announcements.filter((item) => item.kind === 'event' && matchesQuery(item, needle)).length,
    social: announcements.filter((item) => item.kind === 'social' && matchesQuery(item, needle)).length,
  }

  return (
    <section
      id={portal ? undefined : 'bulletin'}
      aria-labelledby={portal ? undefined : 'bulletin-title'}
      aria-label={portal ? 'Latest Announcements' : undefined}
      className={cn(portal ? 'bg-transparent' : 'scroll-mt-28 bg-white dark:bg-zinc-950')}
    >
      <div
        className={cn(
          portal
            ? 'w-full py-0'
            : 'mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8',
        )}
      >
        {portal ? null : (
          <Reveal>
            <header className="mx-auto max-w-3xl text-center">
              <SectionKicker icon={Newspaper}>Bulletin</SectionKicker>
              <h2
                id="bulletin-title"
                className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 dark:text-zinc-50"
              >
                Latest <span className="text-brand-600 dark:text-brand-400">Announcements</span>
              </h2>
              <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Official council advisories, institutional issuances, and community
                updates.
              </p>
            </header>
          </Reveal>
        )}

        <Reveal delay={portal ? 0 : 0.06}>
        <div
          className={cn(
            'flex w-full items-center gap-2',
            portal ? '' : 'mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] max-w-2xl',
          )}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search announcements</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(pageSize)
              }}
              placeholder="Search announcements"
              className="h-11 w-full rounded-xl border border-brand-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/25"
            />
          </label>
          <BulletinFilter
            value={filter}
            counts={counts}
            onChange={(id) => {
              setFilter(id)
              setLimit(pageSize)
            }}
          />
        </div>
        </Reveal>

        {loading ? (
          <div className="mt-16 flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading bulletin…
          </div>
        ) : loadError ? (
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-display text-lg font-medium text-brand-950 dark:text-zinc-50">Bulletin unavailable</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{loadError}</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyBulletin searching={needle !== ''} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={`${filter}|${needle}`}
              ref={listRef}
              initial={reduce ? false : listSwap.initial}
              animate={listSwap.animate}
              exit={reduce ? undefined : listSwap.exit}
              transition={listSwap.transition}
              className="mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] grid scroll-mt-28 grid-cols-1 gap-[clamp(0.75rem,0.45rem+0.7vw,1rem)] sm:grid-cols-2 xl:grid-cols-3"
            >
              {visible.map((item, index) => (
                <AnnouncementTile
                  key={item.id}
                  item={item}
                  index={index}
                  fresh={index >= freshFrom}
                  reduce={reduce}
                  viewport={viewport}
                />
              ))}
            </motion.ul>
          </AnimatePresence>
        )}

        {!loading && !loadError && (visible.length < items.length || limit > pageSize) ? (
          <div className="mt-[clamp(1.5rem,1rem+1.4vw,2.25rem)] flex items-center gap-4">
            <span className="h-px flex-1 bg-brand-100" aria-hidden />
            {limit > pageSize ? (
              <button
                type="button"
                onClick={() => {
                  setLimit(pageSize)
                  listRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
                }}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
              >
                View less
                <motion.span
                  aria-hidden
                  className="inline-flex text-brand-600"
                  animate={reduce ? undefined : { y: [0, -5] }}
                  transition={{ duration: 0.7, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                >
                  <ChevronUp className="size-4" />
                </motion.span>
              </button>
            ) : null}
            {visible.length < items.length ? (
              <button
                type="button"
                onClick={() => setLimit((count) => count + pageSize)}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
              >
                Show more
                <motion.span
                  aria-hidden
                  className="inline-flex text-brand-600"
                  animate={reduce ? undefined : { y: [0, 5] }}
                  transition={{ duration: 0.7, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
                >
                  <ChevronDown className="size-4" />
                </motion.span>
              </button>
            ) : null}
            <span className="h-px flex-1 bg-brand-100" aria-hidden />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AnnouncementTile({
  item,
  index,
  fresh,
  reduce,
  viewport,
}: {
  item: Announcement
  index: number
  fresh: boolean
  reduce: boolean
  viewport: ReturnType<typeof useRevealViewport>
}) {
  const skipHide = useSkipRevealHide()
  if (skipHide) {
    return (
      <li className="h-full min-w-0">
        <AnnouncementCard item={item} />
      </li>
    )
  }
  return (
    <motion.li
      className="reveal-in h-full min-w-0"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={fresh ? { opacity: 1, y: 0 } : undefined}
      whileInView={fresh ? undefined : { opacity: 1, y: 0 }}
      viewport={fresh ? undefined : viewport}
      transition={{
        duration: 0.55,
        ease: easeOut,
        delay: reduce ? 0 : (index % pageSize) * 0.08,
      }}
    >
      <AnnouncementCard item={item} />
    </motion.li>
  )
}

function AnnouncementCard({ item }: { item: Announcement }) {
  const body = (
    <span className="@container flex h-full min-h-[9.25rem] @[28rem]:min-h-[10.5rem]">
      <span className="relative w-[4.75rem] shrink-0 self-stretch overflow-hidden bg-zinc-100 @[20rem]:w-[5.5rem] @[24rem]:w-28 @[32rem]:w-32 dark:bg-zinc-800">
        <img
          src={item.image}
          alt=""
          width={320}
          height={320}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col border-l-2 border-brand-700 bg-white px-2.5 py-2.5 @[20rem]:px-3 @[20rem]:py-3 @[28rem]:px-4 @[28rem]:py-3.5 dark:border-brand-400 dark:bg-zinc-900">
        <KindBadge kind={item.kind} />
        <h3 className="mt-1 line-clamp-2 h-10 font-display text-sm leading-5 font-medium text-brand-950 transition-colors duration-200 group-hover:text-brand-700 @[22rem]:text-[0.95rem] @[28rem]:h-12 @[28rem]:text-base @[28rem]:leading-6 dark:text-zinc-50 dark:group-hover:text-brand-300">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 h-10 text-xs leading-5 text-zinc-600 @[22rem]:text-[13px] @[28rem]:h-12 @[28rem]:text-sm @[28rem]:leading-6 dark:text-zinc-400">
          {item.summary}
        </p>
        <span className="mt-auto flex min-w-0 items-center gap-1 pt-1.5 text-[11px] text-zinc-500">
          <Clock className="size-3 shrink-0 text-brand-700" aria-hidden />
          <time dateTime={item.date} className="truncate">
            {formatPosted(item.date)}
          </time>
        </span>
      </span>
    </span>
  )

  const className =
    'card-lift group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-brand-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'

  return (
    <Link to={`/announcements/${item.id}`} className={className}>
      {body}
    </Link>
  )
}

function BulletinFilter({
  value,
  counts,
  onChange,
}: {
  value: FilterId
  counts: Record<FilterId, number>
  onChange: (id: FilterId) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const filtering = value !== 'all'

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    function place() {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
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
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-haspopup="menu"
        aria-expanded={open}
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
          <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-white ring-2 ring-brand-700" />
        ) : null}
      </button>
      {open && menuPos
        ? createPortal(
            <motion.div
              ref={menuRef}
              role="menu"
              initial={popIn.initial}
              animate={popIn.animate}
              transition={popIn.transition}
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 60 }}
              className="w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <div className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <ListFilter className="size-3.5" strokeWidth={2.1} aria-hidden />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[13px] font-semibold text-brand-950">Filters</p>
                  <p className="text-[11.5px] text-zinc-500">Announcement type</p>
                </div>
              </div>
              <div className="border-t border-zinc-100 py-1">
                {filters.map((item) => {
                  const selected = item.id === value
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onChange(item.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex h-10 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-[13px] font-medium',
                        selected ? 'bg-brand-50 text-brand-800' : 'text-brand-950 hover:bg-zinc-50',
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <item.icon className="size-3.5 shrink-0" aria-hidden />
                        {item.label}
                      </span>
                      <span className="text-xs text-zinc-500">{counts[item.id]}</span>
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
                      onChange('all')
                      setOpen(false)
                    }}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-600"
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  )
}

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon = kindMeta[kind].icon
  return <Icon className={cn('size-3 shrink-0', className)} strokeWidth={2} aria-hidden />
}

function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
      <KindIcon kind={kind} className="text-brand-700" />
      {kindMeta[kind].label}
    </span>
  )
}

function EmptyBulletin({ searching }: { searching: boolean }) {
  return (
    <div className="mt-10 flex isolate flex-col items-center bg-inherit px-6 py-12 text-center dark:bg-zinc-950">
      <img
        src={emptyBulletin}
        alt=""
        width={640}
        height={640}
        className="illustration-knockout h-64 w-auto max-w-full object-contain sm:h-72"
      />
      <h3 className="mt-2 font-display text-2xl font-medium text-brand-950">
        {searching ? 'No matching announcements' : 'No announcements yet'}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
        {searching
          ? 'Try another word, or clear the search to see the full bulletin.'
          : 'Official issuances, event posters, and council updates will be posted here.'}
      </p>
    </div>
  )
}

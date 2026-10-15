import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { CalendarDays, ChevronDown, ChevronUp, Clock, FileText, LayoutGrid, ListFilter, Megaphone, Newspaper, Search } from 'lucide-react'
import assembly from '@/assets/announcements/assembly.jpg'
import enrollment from '@/assets/announcements/enrollment.jpg'
import legalAid from '@/assets/announcements/legal-aid.jpg'
import consultation from '@/assets/announcements/consultation.jpg'
import handbook from '@/assets/announcements/handbook.jpg'
import printing from '@/assets/announcements/printing.jpg'
import recap from '@/assets/announcements/recap.jpg'
import townHall from '@/assets/announcements/town-hall.jpg'
import emptyBulletin from '@/assets/announcements/empty-character.jpg'
import { contact } from '@/components/layout/nav-data'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/motion'
import { Reveal, useRevealViewport } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { scrollPageTo } from '@/hooks/useLenis'

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

const facebook = contact.socials.find((item) => item.name === 'Facebook')

const announcements: Announcement[] = [
  {
    id: 'general-assembly',
    kind: 'event',
    title: 'General Assembly for the first semester',
    summary: 'Call for all law students. The council presents the semester plan and opens the floor for concerns.',
    date: '2026-10-18T14:00:00',
    image: assembly,
    href: '/announcements',
  },
  {
    id: 'enrollment-advisory',
    kind: 'issuance',
    title: 'Advisory on the enrollment period',
    summary: 'Enrollment dates, required documents, and where to raise a concern before the period closes.',
    date: '2026-10-06T09:00:00',
    image: enrollment,
    href: '/announcements',
  },
  {
    id: 'town-hall',
    kind: 'social',
    title: 'Town hall notes, posted on Facebook',
    summary: 'Questions from the open forum and the council’s answers, posted on the official Facebook page.',
    date: '2026-10-10T16:44:00',
    image: townHall,
    href: facebook?.href ?? '/announcements',
    external: Boolean(facebook),
    source: facebook ? `${facebook.name} ${facebook.handle}` : undefined,
  },
  {
    id: 'legal-aid',
    kind: 'event',
    title: 'Legal Aid Clinic schedule',
    summary: 'Free consultations for students. Clinic days, hours, and how to book a slot are listed here.',
    date: '2026-09-28T10:00:00',
    image: legalAid,
    href: '/announcements',
  },
  {
    id: 'consultation-hours',
    kind: 'issuance',
    title: 'Memorandum on consultation hours',
    summary: 'The days and hours students may meet their professors for academic consultation.',
    date: '2026-09-20T15:30:00',
    image: consultation,
    href: '/announcements',
  },
  {
    id: 'handbook-update',
    kind: 'issuance',
    title: 'Student handbook update for the term',
    summary: 'Revisions for this term, including the policies every student is expected to review.',
    date: '2026-09-12T11:15:00',
    image: handbook,
    href: '/announcements',
  },
  {
    id: 'printing-schedule',
    kind: 'event',
    title: 'Free printing service schedule',
    summary: 'Open days, hours, and the page limit for the council’s free printing service.',
    date: '2026-09-08T13:00:00',
    image: printing,
    href: '/announcements',
  },
  {
    id: 'council-recap',
    kind: 'social',
    title: 'Week in review from the council page',
    summary: 'Council work, events, and posts from the past week, shared from the official page.',
    date: '2026-09-05T18:20:00',
    image: recap,
    href: facebook?.href ?? '/announcements',
    external: Boolean(facebook),
    source: facebook ? `${facebook.name} ${facebook.handle}` : undefined,
  },
]

const dayFormat = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const timeFormat = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatPosted(iso: string) {
  const date = new Date(iso)
  return `${dayFormat.format(date)} · ${timeFormat.format(date)}`
}

function matchesQuery(item: Announcement, needle: string) {
  if (needle === '') return true
  const haystack = `${item.title} ${item.summary} ${kindMeta[item.kind].label} ${item.source ?? ''}`.toLowerCase()
  return haystack.includes(needle)
}

export function getAnnouncement(id: string) {
  return announcements.find((item) => item.id === id)
}

export function relatedAnnouncements(id: string, count = 3) {
  const current = announcements.find((item) => item.id === id)
  if (!current) return []
  const rest = announcements
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

export function Announcements() {
  const location = useLocation()
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(pageSize)
  const listRef = useRef<HTMLUListElement>(null)
  const revealedCount = useRef(pageSize)
  const reduce = useReducedMotion() === true
  const viewport = useRevealViewport()
  const needle = query.trim().toLowerCase()
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
  useLayoutEffect(() => {
    if (location.hash !== '#bulletin') return
    const section = document.getElementById('bulletin')
    const scroller = document.querySelector('.app-scroll')
    if (!section || !(scroller instanceof HTMLElement)) return
    const top =
      section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      112
    scroller.scrollTop = Math.max(0, top)
  }, [location.hash, location.pathname])

  const counts: Record<FilterId, number> = {
    all: announcements.filter((item) => matchesQuery(item, needle)).length,
    issuance: announcements.filter((item) => item.kind === 'issuance' && matchesQuery(item, needle)).length,
    event: announcements.filter((item) => item.kind === 'event' && matchesQuery(item, needle)).length,
    social: announcements.filter((item) => item.kind === 'social' && matchesQuery(item, needle)).length,
  }

  return (
    <section id="bulletin" aria-labelledby="bulletin-title" className="scroll-mt-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
        <header className="mx-auto max-w-3xl text-center">
          <SectionKicker icon={Newspaper}>Bulletin</SectionKicker>
          <h2
            id="bulletin-title"
            className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
          >
            Latest <span className="text-brand-600">announcements</span>
          </h2>
          <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
            Official issuances, event posters, and updates from the council's
            channels.
          </p>
        </header>
        </Reveal>

        <Reveal delay={0.06}>
        <div className="mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] flex w-full max-w-2xl items-center gap-2">
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
              className="h-11 w-full rounded-xl border border-brand-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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

        {items.length === 0 ? (
          <EmptyBulletin searching={needle !== ''} />
        ) : (
          <ul
            ref={listRef}
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
          </ul>
        )}

        {visible.length < items.length || limit > pageSize ? (
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
  return (
    <motion.li
      className="h-full min-w-0"
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
      <span className="relative w-[4.75rem] shrink-0 self-stretch overflow-hidden bg-zinc-100 @[20rem]:w-[5.5rem] @[24rem]:w-28 @[32rem]:w-32">
        <img
          src={item.image}
          alt=""
          width={320}
          height={320}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col border-l-2 border-brand-700 bg-white px-2.5 py-2.5 @[20rem]:px-3 @[20rem]:py-3 @[28rem]:px-4 @[28rem]:py-3.5">
        <KindBadge kind={item.kind} />
        <h3 className="mt-1 line-clamp-2 h-10 font-display text-sm leading-5 font-medium text-brand-950 @[22rem]:text-[0.95rem] @[28rem]:h-12 @[28rem]:text-base @[28rem]:leading-6">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 h-10 text-xs leading-5 text-zinc-600 @[22rem]:text-[13px] @[28rem]:h-12 @[28rem]:text-sm @[28rem]:leading-6">
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
    'group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-brand-100 bg-white'

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
            : 'border-zinc-200 bg-white text-brand-950 hover:bg-zinc-50',
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
            <div
              ref={menuRef}
              role="menu"
              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 60 }}
              className="w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg"
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
                <div className="border-t border-zinc-100 px-2 py-2 text-center">
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
            </div>,
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
    <div className="mt-10 flex flex-col items-center px-6 py-12 text-center">
      <img
        src={emptyBulletin}
        alt=""
        width={640}
        height={640}
        className="h-64 w-auto max-w-full object-contain sm:h-72"
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

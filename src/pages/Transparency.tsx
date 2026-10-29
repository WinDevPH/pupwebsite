import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, FileText, LayoutGrid, ListFilter, Loader2, Scale, Search } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { siteName, transparencyPageDescription } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { listDocuments, type DocumentRecord } from '@/lib/documents-api'
import { popIn } from '@/lib/motion'
import {
  DEFAULT_TRANSPARENCY_CATEGORIES,
  listTransparencyCategories,
  resolveTransparencyInnerTab,
  resolveTransparencyTabSlug,
  type TransparencyCategoryRecord,
  type TransparencyInnerTab,
} from '@/lib/transparency-categories-api'
import { transparencyIcon, transparencyInnerTabIcon } from '@/lib/transparency-icons'
import { cn } from '@/lib/utils'

const tabRow =
  '-mr-4 flex w-full gap-2 overflow-x-auto overscroll-x-contain scroll-pr-4 pr-4 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mr-0 sm:overflow-visible sm:scroll-pr-0 sm:pr-0'

const tabChip =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border text-center leading-tight transition-colors sm:min-w-0 sm:whitespace-normal sm:text-pretty'

function scrollSelectedTab(node: HTMLElement | null) {
  const root = node?.parentElement
  if (!node || !root || window.matchMedia('(min-width: 640px)').matches) return
  const left = node.getBoundingClientRect().left - root.getBoundingClientRect().left + root.scrollLeft - 8
  root.scrollTo({ left: Math.max(0, left), behavior: 'auto' })
}

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

function matchesDocument(item: DocumentRecord, needle: string) {
  if (!needle) return true
  return `${item.title} ${item.number} ${item.seriesLabel}`.toLowerCase().includes(needle)
}

function onTabKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  tab: string,
  tabs: TransparencyCategoryRecord[],
  setTab: (id: string) => void,
) {
  const index = tabs.findIndex((item) => item.slug === tab)
  if (index < 0) return
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? tabs[(index + 1) % tabs.length]
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? tabs[(index - 1 + tabs.length) % tabs.length]
        : event.key === 'Home'
          ? tabs[0]
          : event.key === 'End'
            ? tabs[tabs.length - 1]
            : null
  if (!next) return
  event.preventDefault()
  setTab(next.slug)
  document.getElementById(`transparency-tab-${next.slug}`)?.focus()
}

export default function Transparency() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<TransparencyCategoryRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('')
  const [innerTab, setInnerTab] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void Promise.all([listTransparencyCategories(), listDocuments()]).then(([tabs, docs]) => {
      if (cancelled) return
      const nextTabs = tabs.ok ? tabs.data.items : DEFAULT_TRANSPARENCY_CATEGORIES
      const nextDocs = docs.ok ? docs.data.items : []
      if (!docs.ok) {
        setError(docs.error)
      } else if (!tabs.ok) {
        setError('')
      } else {
        setError('')
      }
      setCategories(nextTabs)
      setDocuments(nextDocs)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (categories.length === 0) return
    const fromHash = resolveTransparencyTabSlug(hash, categories)
    setTab((current) => {
      if (fromHash) return fromHash
      if (current && categories.some((item) => item.slug === current)) return current
      return categories[0].slug
    })
  }, [categories, hash])

  useEffect(() => {
    const category = categories.find((item) => item.slug === tab) ?? null
    if (!category) return
    setInnerTab(resolveTransparencyInnerTab(hash, category))
  }, [categories, hash, tab])

  useEffect(() => {
    const previous = document.title
    document.title = `Transparency & Documents · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [])

  const needle = query.trim().toLowerCase()
  const active = categories.find((item) => item.slug === tab) ?? categories[0] ?? null
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const category of categories) {
      counts[category.slug] = documents.filter(
        (item) => item.category === category.slug && matchesDocument(item, needle),
      ).length
    }
    return counts
  }, [categories, documents, needle])

  const visibleDocs = useMemo(() => {
    if (!active) return []
    return documents.filter((item) => item.category === active.slug && matchesDocument(item, needle))
  }, [active, documents, needle])

  function selectTab(slug: string) {
    setTab(slug)
    const category = categories.find((item) => item.slug === slug)
    if (hash !== `#${slug}`) {
      navigate({ pathname: '/transparency', hash: slug }, { replace: true, preventScrollReset: true })
    }
    setInnerTab(category?.tabs?.length ? 'all' : '')
  }

  function selectInnerTab(slug: string) {
    setInnerTab(slug)
    const nextHash = slug && slug !== 'all' ? `${tab}/${slug}` : tab
    if (hash !== `#${nextHash}`) {
      navigate({ pathname: '/transparency', hash: nextHash }, { replace: true, preventScrollReset: true })
    }
  }

  return (
    <>
      <section aria-labelledby="transparency-page-title" className="hero-blend relative isolate overflow-hidden bg-white">
        <HeroBackdrop />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-[clamp(2.25rem,1.4rem+3vw,4.5rem)] pb-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
            }}
            className="flex w-full max-w-4xl flex-col items-center text-center"
          >
            <motion.div variants={rise}>
              <SectionKicker icon={Scale}>Governance</SectionKicker>
            </motion.div>
            <motion.h1
              id="transparency-page-title"
              variants={rise}
              className="mt-3 max-w-4xl font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Governance and
              <br />
              <span className="text-brand-600">Transparency</span>
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-[15px]"
            >
              {transparencyPageDescription}
            </motion.p>
          </motion.div>
        </div>
      </section>

      <main id="main-content" className="bg-white">
        <div className="bg-[#f6f5fb]">
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading archives…
              </p>
            ) : categories.length === 0 ? (
              <EmptyState
                compact
                title="No transparency tabs yet"
                body="Published document categories will appear here."
              />
            ) : (
              <div
                data-lenis-prevent
                className={cn(tabRow, 'max-w-5xl sm:grid sm:grid-cols-3 lg:grid-cols-5')}
                role="tablist"
                aria-label="Transparency"
                onKeyDown={(event) => onTabKeyDown(event, tab, categories, selectTab)}
              >
                {categories.map((item) => {
                  const selected = tab === item.slug
                  const Icon = transparencyIcon(item.icon)
                  const count = loading ? undefined : tabCounts[item.slug]
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      role="tab"
                      id={`transparency-tab-${item.slug}`}
                      aria-selected={selected}
                      aria-controls="transparency-panel"
                      tabIndex={selected ? 0 : -1}
                      ref={selected ? scrollSelectedTab : undefined}
                      onClick={() => selectTab(item.slug)}
                      className={cn(
                        tabChip,
                        'px-2.5 py-2.5 text-[13px] sm:w-full sm:text-sm',
                        selected
                          ? 'border-brand-700 bg-brand-700 font-semibold text-white shadow-[0_10px_18px_-14px_rgba(76,29,149,0.9)]'
                          : 'border-zinc-200 bg-white font-medium text-zinc-600 hover:border-brand-200 hover:text-brand-800',
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 text-pretty">{item.label}</span>
                      {typeof count === 'number' ? (
                        <span
                          className={cn(
                            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                            selected ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700',
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div
          id="transparency-panel"
          role="tabpanel"
          aria-labelledby={active ? `transparency-tab-${active.slug}` : undefined}
          className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8"
        >
          {active ? (
            <Archive
              id={active.slug}
              icon={transparencyIcon(active.icon)}
              kicker={active.kicker || 'Archive'}
              title={active.title || active.label}
              accent={active.accent}
              note={active.note}
              folder={active.folder}
              seriesLabel={active.seriesLabel || active.label}
              items={visibleDocs}
              tabs={active.tabs ?? []}
              innerTab={innerTab}
              onInnerTab={selectInnerTab}
              query={query}
              onQuery={setQuery}
              loading={loading}
              error={error}
              searching={needle !== ''}
            />
          ) : !loading ? (
            <EmptyState
              title="No archives published yet"
              body="Transparency tabs and their documents will appear here once they are published."
            />
          ) : null}
        </div>
      </main>
    </>
  )
}

function HeroBackdrop() {
  const reduce = useReducedMotion() === true

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-white">
      <div className="hero-wash absolute inset-0 bg-[linear-gradient(180deg,white_0%,var(--color-brand-50)_55%,#e4d4fb_100%)]" />
      <motion.div
        className="hero-glow absolute top-0 left-1/2 h-80 w-[36rem] rounded-full bg-white/80 blur-3xl"
        initial={{ x: '-58%' }}
        animate={{ x: reduce ? '-50%' : '-42%' }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
        }
      />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
    </div>
  )
}

function Archive({
  id,
  icon,
  kicker,
  title,
  accent,
  note,
  folder,
  seriesLabel,
  items,
  tabs = [],
  innerTab = '',
  onInnerTab,
  query = '',
  onQuery,
  loading = false,
  error = '',
  searching = false,
}: {
  id: string
  icon: LucideIcon
  kicker: string
  title: string
  accent: string
  note: string
  folder?: string
  seriesLabel: string
  items: DocumentRecord[]
  tabs?: TransparencyInnerTab[]
  innerTab?: string
  onInnerTab?: (slug: string) => void
  query?: string
  onQuery?: (value: string) => void
  loading?: boolean
  error?: string
  searching?: boolean
}) {
  const activeInner = tabs.some((item) => item.slug === innerTab) ? innerTab : tabs.length ? 'all' : ''
  const grouped =
    tabs.length && activeInner && activeInner !== 'all'
      ? items.filter((item) => (item.subcategory || tabs[0]?.slug) === activeInner)
      : items
  const innerCounts = Object.fromEntries(
    tabs.map((item) => [
      item.slug,
      items.filter((doc) => (doc.subcategory || tabs[0]?.slug) === item.slug).length,
    ]),
  ) as Record<string, number>

  return (
    <section id={id} className="scroll-mt-28">
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-6">
          <SectionHeading icon={icon} kicker={kicker} title={title} accent={accent} count={items.length} />
          {note ? (
            <p className="max-w-3xl text-sm leading-6 text-zinc-500 sm:order-3 sm:col-span-2">{note}</p>
          ) : null}
          <div className="flex w-full items-center gap-2 sm:order-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none lg:w-64">
              <span className="sr-only">Search documents</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => onQuery?.(event.target.value)}
                placeholder="Search"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white pr-3 pl-8 text-[13px] text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            {tabs.length > 0 ? (
              <ArchiveFilter
                value={activeInner || 'all'}
                options={tabs}
                counts={innerCounts}
                total={items.length}
                onChange={(slug) => onInnerTab?.(slug)}
              />
            ) : null}
          </div>
        </div>
        {folder ? (
          <p className="mt-3 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{folder}</p>
        ) : null}
        {loading ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading documents…
          </p>
        ) : null}
        {!loading && error ? <p className="mt-5 text-sm text-zinc-500">{error}</p> : null}
        {!loading && !error && grouped.length === 0 ? (
          <EmptyState
            title={searching ? 'No matching documents' : 'No documents published yet'}
            body={
              searching
                ? 'Try another word, or clear the search to see the full archive.'
                : 'Official files for this tab will appear here once they are published.'
            }
          />
        ) : null}
      </Reveal>
        <ul className="mt-5 grid gap-3">
          {grouped.map((item, index) => (
            <li key={item.id}>
              <Reveal delay={Math.min(index, 4) * 0.05}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-200 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="pt-0.5 font-hero text-xl leading-none text-brand-600 tabular-nums">
                      {item.number || '—'}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                        {item.number
                          ? `${item.seriesLabel || seriesLabel} No. ${item.number}, s. 2026`
                          : item.seriesLabel || seriesLabel}
                      </span>
                      <span className="mt-1 block text-sm leading-5 font-semibold text-balance text-brand-950">
                        {item.title}
                      </span>
                    </span>
                  </span>
                  <span className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition-colors group-hover:bg-brand-800">
                    Open PDF
                    <ArrowUpRight className="size-4" aria-hidden />
                  </span>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
    </section>
  )
}

function ArchiveFilter({
  value,
  options,
  counts,
  total,
  onChange,
}: {
  value: string
  options: TransparencyInnerTab[]
  counts: Record<string, number>
  total: number
  onChange: (slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const filtering = value !== 'all'
  const items = [{ slug: 'all', label: 'All' }, ...options]

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
    function onKey(event: globalThis.KeyboardEvent) {
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
        aria-label="Filter financial categories"
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
              className="w-72 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <div className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <ListFilter className="size-3.5" strokeWidth={2.1} aria-hidden />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[13px] font-semibold text-brand-950">Filters</p>
                  <p className="text-[11.5px] text-zinc-500">Report type</p>
                </div>
              </div>
              <div className="border-t border-zinc-100 py-1">
                {items.map((item) => {
                  const selected = item.slug === value
                  const Icon = item.slug === 'all' ? LayoutGrid : transparencyInnerTabIcon(item.slug)
                  const count = item.slug === 'all' ? total : (counts[item.slug] ?? 0)
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onChange(item.slug)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex h-10 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-[13px] font-medium',
                        selected ? 'bg-brand-50 text-brand-800' : 'text-brand-950 hover:bg-zinc-50',
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Icon className="size-3.5 shrink-0" aria-hidden />
                        {item.label}
                      </span>
                      <span className="text-xs text-zinc-500">{count}</span>
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

function EmptyState({
  title,
  body,
  compact = false,
}: {
  title: string
  body: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center text-center',
        compact ? 'max-w-lg py-2' : 'mt-8 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12',
      )}
    >
      <FileText
        className={cn('text-brand-600/40', compact ? 'size-8' : 'size-10')}
        strokeWidth={1.35}
        aria-hidden
      />
      <p className={cn('font-semibold text-brand-950', compact ? 'mt-2 text-sm' : 'mt-3 text-base')}>{title}</p>
      <p className={cn('max-w-md text-zinc-500', compact ? 'mt-1 text-[13px] leading-5' : 'mt-2 text-sm leading-6')}>
        {body}
      </p>
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  kicker,
  title,
  accent,
  count,
}: {
  icon: LucideIcon
  kicker: string
  title: string
  accent: string
  count?: number
}) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        <SectionKicker icon={Icon}>{kicker}</SectionKicker>
        {typeof count === 'number' ? (
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
        {title}
        {accent ? (
          <>
            {' '}
            <span className="text-brand-600">{accent}</span>
          </>
        ) : null}
      </h2>
    </header>
  )
}

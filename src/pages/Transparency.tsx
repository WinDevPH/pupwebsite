import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, FileText, Loader2, Search } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { listDocuments, type DocumentRecord } from '@/lib/documents-api'
import {
  DEFAULT_TRANSPARENCY_CATEGORIES,
  listTransparencyCategories,
  resolveTransparencyTabSlug,
  type TransparencyCategoryRecord,
} from '@/lib/transparency-categories-api'
import { transparencyIcon } from '@/lib/transparency-icons'
import { cn } from '@/lib/utils'

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
  const [categories, setCategories] = useState<TransparencyCategoryRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('')

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
            <motion.h1
              id="transparency-page-title"
              variants={rise}
              className="max-w-4xl font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Governance and
              <br />
              <span className="text-brand-600">Transparency</span>
            </motion.h1>
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
              <>
                <div
                  className="grid w-full max-w-5xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
                  role="tablist"
                  aria-label="Transparency"
                  onKeyDown={(event) => onTabKeyDown(event, tab, categories, setTab)}
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
                        onClick={() => setTab(item.slug)}
                        className={cn(
                          'inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center text-[13px] leading-tight transition-colors sm:text-sm',
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
                <label className="relative mt-4 w-full max-w-5xl">
                  <span className="sr-only">Search documents</span>
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search documents"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              </>
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
  loading?: boolean
  error?: string
  searching?: boolean
}) {
  return (
    <Reveal>
      <section id={id} className="scroll-mt-28">
        <SectionHeading icon={icon} kicker={kicker} title={title} accent={accent} count={items.length} />
        {note ? <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500">{note}</p> : null}
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
        {!loading && !error && items.length === 0 ? (
          <EmptyState
            title={searching ? 'No matching documents' : 'No documents published yet'}
            body={
              searching
                ? 'Try another word, or clear the search to see the full archive.'
                : 'Official files for this tab will appear here once they are published.'
            }
          />
        ) : null}
        <ul className="mt-5 grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
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
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
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

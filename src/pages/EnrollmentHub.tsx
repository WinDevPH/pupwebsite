import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Ban,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardPen,
  Clock3,
  Info,
  LayoutGrid,
  ListFilter,
  Loader2,
  Radio,
  Rows3,
  ScrollText,
  Search,
  Users,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { Button } from '@/components/ui/button'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { listAppointmentBatches } from '@/lib/enrollment-batches-api'
import {
  listBatchWindows,
  listScheduleDays,
  type EnrollmentBatchWindow,
  type EnrollmentScheduleDay,
} from '@/lib/enrollment-guidelines-api'
import { listOfferings, type EnrollmentOffering } from '@/lib/enrollment-offerings-api'
import { popIn } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ClassBuilderPanel } from '@/pages/enrollment/ClassBuilderPanel'
import { RoutingSlipPanel } from '@/pages/enrollment/RoutingSlipPanel'

type ClassSlotStatus = 'OPEN' | 'FULL'

type ClassSlotYear = '1' | '2' | '3' | '4'

type ClassSlotRow = {
  id: string
  code: string
  section: string
  year: ClassSlotYear
  title: string
  schedule: string
  availability: ClassSlotStatus
}

const classSlotStatuses: { id: 'all' | ClassSlotStatus; label: string }[] = [
  { id: 'all', label: 'All Slot Statuses' },
  { id: 'OPEN', label: 'Open' },
  { id: 'FULL', label: 'Full / Closed' },
]

const classSlotPageSizes = [5, 10, 25, 'all'] as const
type ClassSlotPageSize = (typeof classSlotPageSizes)[number]

function offeringToClassSlot(item: EnrollmentOffering): ClassSlotRow {
  const year = (['1', '2', '3', '4'].includes(item.year) ? item.year : '1') as ClassSlotYear
  const availability: ClassSlotStatus =
    item.full === true || item.availability === 'FULL' ? 'FULL' : 'OPEN'
  return {
    id: String(item.id),
    code: item.code,
    section: item.section,
    year,
    title: item.title,
    schedule: item.scheduleLabel || item.timeLabel,
    availability,
  }
}

function classSlotStatusMeta(status: ClassSlotStatus) {
  if (status === 'OPEN') {
    return {
      label: 'Open',
      pill: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
      Icon: CheckCircle2,
    }
  }
  return {
    label: 'Full / Closed',
    pill: 'border border-zinc-200 bg-zinc-50 text-zinc-500',
    Icon: Ban,
  }
}

function sectionModeBadge(section: string) {
  if (section.includes('Night')) {
    return { label: 'Night', className: 'bg-sky-50 text-sky-700 border-sky-100' }
  }
  return { label: 'Day', className: 'bg-brand-50 text-brand-700 border-brand-100' }
}

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

const tabRow =
  '-mr-4 flex w-full gap-2 overflow-x-auto overscroll-x-contain scroll-pr-4 pr-4 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mr-0 md:overflow-visible md:scroll-pr-0 md:pr-0'

const tabChip =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border text-center leading-tight transition-colors md:min-w-0 md:whitespace-normal md:text-pretty'

type HubTab = {
  slug: string
  label: string
  icon: LucideIcon
  kicker: string
  title: string
  accent: string
  note: string
  inner?: { slug: string; label: string; icon: LucideIcon }[]
}

const hubTabs: HubTab[] = [
  {
    slug: 'enrollment-guidelines',
    label: 'Enrollment Guidelines',
    icon: ClipboardList,
    kicker: 'Guidelines',
    title: 'Enrollment',
    accent: 'Guidelines',
    note: 'Everything you need to know to enroll, including schedules, required documents, fee verification rules, and station procedures, for efficient enrollment process.',
  },
  {
    slug: 'live-updates',
    label: 'Live Updates',
    icon: Radio,
    kicker: 'Live',
    title: 'Live',
    accent: 'Updates',
    note: 'Check who is serving now, who is next, and which class slots are open.',
    inner: [
      { slug: 'now-serving', label: 'Now Serving', icon: CalendarDays },
      { slug: 'class-slot-availability', label: 'Class Slots', icon: Users },
    ],
  },
  {
    slug: 'class-builder',
    label: 'Class Builder',
    icon: LayoutGrid,
    kicker: 'Scheduler',
    title: 'Class',
    accent: 'Builder',
    note: 'Plot subjects ahead of time to eliminate schedule overlaps and export a print-ready PDF.',
  },
  {
    slug: 'enrollment-routing-slip',
    label: 'Enrollment Routing Slip',
    icon: ScrollText,
    kicker: 'Printable',
    title: 'Enrollment',
    accent: 'Routing Slip',
    note: 'Generate a printable Enrollment Routing Slip.',
  },
]

function scrollSelectedTab(node: HTMLElement | null) {
  const root = node?.parentElement
  if (!node || !root || window.matchMedia('(min-width: 768px)').matches) return
  const left =
    node.getBoundingClientRect().left - root.getBoundingClientRect().left + root.scrollLeft - 8
  root.scrollTo({ left: Math.max(0, left), behavior: 'auto' })
}

function onTabKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  tab: string,
  setTab: (id: string) => void,
) {
  const index = hubTabs.findIndex((item) => item.slug === tab)
  if (index < 0) return
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? hubTabs[(index + 1) % hubTabs.length]
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? hubTabs[(index - 1 + hubTabs.length) % hubTabs.length]
        : event.key === 'Home'
          ? hubTabs[0]
          : event.key === 'End'
            ? hubTabs[hubTabs.length - 1]
            : null
  if (!next) return
  event.preventDefault()
  setTab(next.slug)
  document.getElementById(`enrollment-hub-tab-${next.slug}`)?.focus()
}

export default function EnrollmentHub() {
  const [tab, setTab] = useState(hubTabs[0].slug)
  const [innerTab, setInnerTab] = useState('')

  useEffect(() => {
    const previous = document.title
    document.title = `Enrollment Hub · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [])

  const active = hubTabs.find((item) => item.slug === tab) ?? hubTabs[0]

  function selectTab(slug: string) {
    const category = hubTabs.find((item) => item.slug === slug) ?? hubTabs[0]
    setTab(category.slug)
    setInnerTab(category.inner?.[0]?.slug ?? '')
  }

  function selectInnerTab(slug: string) {
    setInnerTab(slug)
  }

  return (
    <>
      <section
        aria-labelledby="enrollment-hub-title"
        className="hero-blend relative isolate overflow-hidden bg-white dark:bg-zinc-950"
      >
        <HeroBackdrop />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-[clamp(2rem,1.2rem+2.6vw,3.75rem)] pb-[clamp(1rem,0.6rem+1vw,1.5rem)] sm:px-6 lg:px-8">
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
              <SectionKicker icon={ClipboardPen}>Resources</SectionKicker>
            </motion.div>
            <motion.h1
              id="enrollment-hub-title"
              variants={rise}
              className="mt-3 max-w-[18ch] text-balance font-hero text-[clamp(2rem,1.2rem+4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-brand-950 sm:max-w-none sm:whitespace-nowrap dark:text-zinc-50"
            >
              Enrollment <span className="text-brand-600 dark:text-brand-400">Hub</span>
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-3 max-w-md text-[13px] leading-5 text-zinc-500 sm:hidden dark:text-zinc-400"
            >
              Your central portal for College of Law Enrollment—guidelines, live updates, class
              builder, and routing slip.
            </motion.p>
            <motion.p
              variants={rise}
              className="mt-4 hidden max-w-2xl text-sm leading-6 text-zinc-500 sm:block sm:text-[15px] dark:text-zinc-400"
            >
              Designed to streamline registration and maximize efficiency, this is your central
              portal for College of Law Enrollment—featuring live batch appointment tickers,
              real-time class slot monitors, step-by-step enrollment guidelines, a built-in class
              scheduler, and the printable Enrollment Routing Slip generator.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <main id="main-content" className="bg-white dark:bg-zinc-950">
        <div className="bg-[#f6f5fb] dark:bg-zinc-950">
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8 lg:py-3.5">
            <div
              data-lenis-prevent
              className={cn(tabRow, 'w-full max-w-5xl md:grid md:grid-cols-2 lg:grid-cols-4')}
              role="tablist"
              aria-label="Enrollment Hub"
              onKeyDown={(event) => onTabKeyDown(event, tab, selectTab)}
            >
              {hubTabs.map((item) => {
                const selected = tab === item.slug
                const Icon = item.icon
                return (
                  <button
                    key={item.slug}
                    type="button"
                    role="tab"
                    id={`enrollment-hub-tab-${item.slug}`}
                    aria-selected={selected}
                    aria-controls="enrollment-hub-panel"
                    tabIndex={selected ? 0 : -1}
                    ref={selected ? scrollSelectedTab : undefined}
                    onClick={() => selectTab(item.slug)}
                    className={cn(
                      tabChip,
                      'min-h-10 px-3 py-2 text-[12px] sm:text-[13px] md:w-full md:min-h-11 md:px-2.5 md:py-2.5 md:text-sm',
                      selected
                        ? 'border-brand-700 bg-brand-700 font-semibold text-white shadow-[0_10px_18px_-14px_rgba(76,29,149,0.9)] dark:border-brand-500 dark:bg-brand-600 dark:shadow-black/40'
                        : 'border-zinc-200 bg-white font-medium text-zinc-600 hover:border-brand-200 hover:text-brand-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-500/40 dark:hover:text-brand-200',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 text-pretty">
                      <span className="sm:hidden">
                        {item.slug === 'enrollment-guidelines'
                          ? 'Guidelines'
                          : item.slug === 'live-updates'
                            ? 'Live'
                            : item.slug === 'class-builder'
                              ? 'Builder'
                              : 'Routing Slip'}
                      </span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div
          id="enrollment-hub-panel"
          role="tabpanel"
          aria-labelledby={`enrollment-hub-tab-${active.slug}`}
          className="mx-auto max-w-7xl px-3 pt-4 pb-8 sm:px-6 sm:pt-6 sm:pb-10 lg:px-8 lg:pt-7 lg:pb-[clamp(2rem,1.2rem+2vw,3.25rem)]"
        >
          <HubPanel
            tab={active}
            innerTab={innerTab}
            onInnerTab={selectInnerTab}
            onSelectTab={selectTab}
          />
        </div>
      </main>
    </>
  )
}

function HubPanel({
  tab,
  innerTab,
  onInnerTab,
  onSelectTab,
}: {
  tab: HubTab
  innerTab: string
  onInnerTab: (slug: string) => void
  onSelectTab: (slug: string) => void
}) {
  const Icon = tab.icon
  const activeInner =
    tab.inner?.find((item) => item.slug === innerTab) ?? tab.inner?.[0] ?? null
  const isGuidelines = tab.slug === 'enrollment-guidelines'
  const isLiveUpdates = tab.slug === 'live-updates'
  const isClassBuilder = tab.slug === 'class-builder'
  const isRoutingSlip = tab.slug === 'enrollment-routing-slip'

  if (isGuidelines) {
    return (
      <section id={tab.slug} className="scroll-mt-28">
        <GuidelinesContent note={tab.note} onSelectTab={onSelectTab} />
      </section>
    )
  }

  if (isLiveUpdates) {
    return (
      <section id={tab.slug} className="scroll-mt-28">
        <LiveUpdatesContent
          note={tab.note}
          innerTabs={tab.inner ?? []}
          activeInner={activeInner?.slug ?? 'now-serving'}
          onInnerTab={onInnerTab}
        />
      </section>
    )
  }

  if (isClassBuilder) {
    return (
      <section id={tab.slug} className="scroll-mt-28">
        <ClassBuilderPanel />
      </section>
    )
  }

  if (isRoutingSlip) {
    return (
      <section id={tab.slug} className="scroll-mt-28">
        <RoutingSlipPanel />
      </section>
    )
  }

  return (
    <section id={tab.slug} className="scroll-mt-28">
      <Reveal>
        <header className="max-w-3xl">
          <SectionKicker icon={Icon}>{tab.kicker}</SectionKicker>
          <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 dark:text-zinc-50">
            {tab.title} <span className="text-brand-600 dark:text-brand-400">{tab.accent}</span>
          </h2>
          {tab.note ? (
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{tab.note}</p>
          ) : null}
        </header>

        <EmptyState
          title="Coming soon"
          body={`${tab.label} content will appear here.`}
        />
      </Reveal>
    </section>
  )
}

function LiveUpdatesContent({
  note,
  innerTabs,
  activeInner,
  onInnerTab,
}: {
  note: string
  innerTabs: NonNullable<HubTab['inner']>
  activeInner: string
  onInnerTab: (slug: string) => void
}) {
  const selected = innerTabs.find((item) => item.slug === activeInner) ?? innerTabs[0]
  const showingSlots = selected?.slug === 'class-slot-availability'

  return (
    <div className="space-y-4 sm:space-y-6">
      <Reveal>
        <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0 max-w-xl lg:max-w-2xl">
            <SectionKicker icon={Radio}>Live</SectionKicker>
            <h2 className="mt-2 font-hero text-[clamp(1.65rem,1.05rem+2.4vw,3.1rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 sm:mt-2.5 dark:text-zinc-50">
              Live <span className="text-brand-600 dark:text-brand-400">Updates</span>
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-zinc-500 sm:text-sm sm:leading-6 dark:text-zinc-400">
              {note}
            </p>
            {showingSlots ? (
              <p
                role="note"
                className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400"
              >
                <Info
                  className="mt-0.5 size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
                  aria-hidden
                />
                <span>Class slot counts refresh at the end of each enrollment day.</span>
              </p>
            ) : null}
          </div>

          <div
            data-lenis-prevent
            role="tablist"
            aria-label="Live Updates views"
            className="grid w-full grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-50/90 p-1 dark:border-zinc-700 dark:bg-zinc-900/80 sm:w-auto sm:min-w-[20rem] lg:shrink-0"
          >
            {innerTabs.map((item) => {
              const isSelected = selected?.slug === item.slug
              const InnerIcon = item.icon
              const shortLabel =
                item.slug === 'now-serving'
                  ? 'Serving'
                  : item.slug === 'class-slot-availability'
                    ? 'Slots'
                    : item.label
              return (
                <button
                  key={item.slug}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onInnerTab(item.slug)}
                  className={cn(
                    'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold transition-colors touch-manipulation sm:min-h-10 sm:px-3 sm:text-[13px]',
                    isSelected
                      ? 'bg-white text-brand-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-brand-800 dark:text-zinc-400 dark:hover:text-brand-200',
                  )}
                >
                  <InnerIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="truncate">
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Reveal>

      {showingSlots ? <ClassSlotAvailabilityPanel /> : <NowServingPanel />}
    </div>
  )
}

function NowServingPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walkIn, setWalkIn] = useState<'OPEN' | 'CLOSED'>('OPEN')
  const [batches, setBatches] = useState<
    { id: number; label: string; window: string; scheduledCount: number; status: string }[]
  >([])
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    let first = true

    async function loadBoard(soft = false) {
      if (!soft && first) setLoading(true)
      const result = await listAppointmentBatches()
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        setBatches([])
        setLoading(false)
        return
      }
      setError('')
      setWalkIn(result.data.walkIn === 'CLOSED' ? 'CLOSED' : 'OPEN')
      setBatches(
        result.data.items.map((item) => ({
          id: item.id,
          label: item.label,
          window: item.windowLabel,
          scheduledCount: item.scheduledCount,
          status: item.status,
        })),
      )
      setUpdatedAt(new Date())
      setLoading(false)
      first = false
    }

    void loadBoard()
    const timer = window.setInterval(() => void loadBoard(true), 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  if (loading) {
    return (
      <Reveal delay={0.05}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60">
          <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
          Loading serving queue…
        </div>
      </Reveal>
    )
  }

  if (error || batches.length === 0) {
    return (
      <Reveal delay={0.05}>
        <EmptyState
          title={error ? 'Could not load queue' : 'Queue not published yet'}
          body={
            error ||
            'Now-serving and up-next batches will appear here once officers publish them in Admin.'
          }
        />
      </Reveal>
    )
  }

  const walkInOpen = walkIn === 'OPEN'
  const activeBatches = batches.filter(
    (batch) => batch.status.trim().toLowerCase() !== 'closed',
  )
  const serving =
    activeBatches.find((batch) => batch.status.trim().toLowerCase() === 'serving') ?? null
  const upNext = activeBatches.filter((batch) => batch.status.trim().toLowerCase() !== 'serving')
  const totalInQueue = activeBatches.reduce(
    (sum, batch) => sum + Math.max(0, batch.scheduledCount),
    0,
  )

  const updatedLabel = updatedAt
    ? updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <Reveal delay={0.05}>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(15rem,0.85fr)]">
        <div className="flex flex-col bg-brand-950 px-5 py-5 text-white sm:px-7 sm:py-6 lg:px-8 lg:py-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[12px] text-brand-100/75">
              {updatedLabel ? `Updated ${updatedLabel}` : 'Live queue'}
              <span className="text-brand-200/40"> · </span>
              {totalInQueue} ticket{totalInQueue === 1 ? '' : 's'}
            </p>
            <p
              className={cn(
                'text-[12px] font-semibold',
                walkInOpen ? 'text-emerald-300' : 'text-brand-200/70',
              )}
            >
              Walk-in {walkInOpen ? 'open' : 'closed'}
            </p>
          </div>

          <p className="mt-6 text-[11px] font-semibold tracking-[0.14em] text-gold-400 uppercase">
            Now serving
          </p>

          {serving ? (
            <div className="mt-2.5 flex flex-1 flex-col gap-4 sm:mt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="font-hero text-[clamp(2rem,1.2rem+2.8vw,3.35rem)] leading-[0.95] tracking-tight break-words text-white">
                  {serving.label}
                </p>
                <p className="mt-2 text-[14px] leading-6 text-brand-100/80">
                  {serving.window}
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="font-hero text-[clamp(1.75rem,1.2rem+1.4vw,2.35rem)] leading-none tracking-tight text-white tabular-nums">
                  {serving.scheduledCount}
                </p>
                <p className="mt-1 text-[11px] font-medium text-brand-200/70">
                  ticket{serving.scheduledCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 sm:mt-3">
              <p className="font-hero text-[clamp(1.75rem,1.05rem+2vw,2.75rem)] leading-[0.95] tracking-tight text-white/40">
                Stand by
              </p>
              <p className="mt-2 text-[14px] leading-6 text-brand-200/70">
                No batch is serving right now.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100 px-5 py-5 sm:px-6 sm:py-6 dark:border-zinc-800 lg:border-t-0 lg:border-l lg:border-l-zinc-200 dark:lg:border-l-zinc-800">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
            Up next
          </p>

          {upNext.length === 0 ? (
            <p className="mt-4 text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">
              No other batches waiting.
            </p>
          ) : (
            <ol className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {upNext.map((batch, index) => (
                <li
                  key={batch.id}
                  className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 py-3.5 first:pt-1 last:pb-0"
                >
                  <span className="pt-0.5 text-[12px] font-semibold tabular-nums text-zinc-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold leading-snug break-words text-brand-950 dark:text-zinc-50">
                      {batch.label}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-4 break-words text-zinc-500 dark:text-zinc-400">
                      {batch.window}
                    </p>
                  </div>
                  <p className="pt-0.5 text-[13px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    {batch.scheduledCount}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Reveal>
  )
}

function SlotStatusDropdown({
  value,
  counts,
  onChange,
}: {
  value: 'all' | ClassSlotStatus
  counts: Record<'all' | ClassSlotStatus, number>
  onChange: (value: 'all' | ClassSlotStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; width: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const filtering = value !== 'all'
  const selected = classSlotStatuses.find((item) => item.id === value) ?? classSlotStatuses[0]

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    function place() {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const maxWidth = Math.max(160, window.innerWidth - 16)
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        width: Math.min(Math.max(rect.width, 260), maxWidth),
      })
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
    <div ref={rootRef} className="relative w-full sm:w-56">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Filter by slot status"
        className={cn(
          'relative inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm font-medium transition-colors touch-manipulation',
          filtering
            ? 'border-brand-700 bg-brand-700 text-white'
            : 'border-zinc-200 bg-white text-brand-950 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
          open && !filtering ? 'border-brand-400 ring-2 ring-brand-100 dark:ring-brand-500/25' : null,
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <ListFilter className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{selected.label}</span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
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
              style={{
                position: 'fixed',
                top: menuPos.top,
                right: menuPos.right,
                width: menuPos.width,
                zIndex: 60,
              }}
              className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_18px_40px_-20px_rgba(30,5,65,0.35)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
            >
              <div className="flex items-center gap-2.5 px-2 py-2">
                <div className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <ListFilter className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[13px] font-semibold text-brand-950">Slot status</p>
                  <p className="text-[11.5px] text-zinc-500">Filter class availability</p>
                </div>
              </div>

              <div className="border-t border-zinc-100 py-1">
                {classSlotStatuses.map((item) => {
                  const isSelected = item.id === value
                  const Icon =
                    item.id === 'all' ? LayoutGrid : item.id === 'OPEN' ? CheckCircle2 : Ban
                  const count = counts[item.id]
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => {
                        onChange(item.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex h-11 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-[13px] font-medium transition-colors',
                        isSelected
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-brand-950 hover:bg-zinc-50',
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            'grid size-7 place-items-center rounded-lg',
                            item.id === 'OPEN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.id === 'FULL'
                                ? 'bg-zinc-100 text-zinc-500'
                                : 'bg-brand-50 text-brand-700',
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                          isSelected ? 'bg-white text-brand-700' : 'bg-zinc-100 text-zinc-500',
                        )}
                      >
                        {count}
                      </span>
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
                    Clear status filter
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

function SlotPageSizeDropdown({
  value,
  onChange,
}: {
  value: ClassSlotPageSize
  onChange: (value: ClassSlotPageSize) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    function place() {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 180),
      })
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Slots per page"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[13px] font-semibold text-brand-950 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
          open && 'border-brand-400 ring-2 ring-brand-100',
        )}
      >
        <Rows3 className="size-3.5 text-brand-600" aria-hidden />
        <span className="tabular-nums">{value === 'all' ? 'All' : `${value} / page`}</span>
        <ChevronDown
          className={cn('size-3.5 text-zinc-400 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && menuPos
        ? createPortal(
            <motion.div
              ref={menuRef}
              role="menu"
              initial={popIn.initial}
              animate={popIn.animate}
              transition={popIn.transition}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 60,
              }}
              className="rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(30,5,65,0.35)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
            >
              {classSlotPageSizes.map((size) => {
                const selected = size === value
                const label = size === 'all' ? 'All' : `${size} / page`
                return (
                  <button
                    key={String(size)}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(size)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium tabular-nums transition-colors',
                      selected
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-brand-950 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Rows3 className="size-3.5 shrink-0 text-brand-600" aria-hidden />
                      {label}
                    </span>
                    {selected ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-brand-700" aria-hidden />
                    ) : null}
                  </button>
                )
              })}
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  )
}

function ClassSlotAvailabilityPanel() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ClassSlotStatus>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<ClassSlotPageSize>(5)
  const [slots, setSlots] = useState<ClassSlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listOfferings().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        setSlots([])
        setLoading(false)
        return
      }
      setError('')
      setSlots(result.data.items.map(offeringToClassSlot))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<'all' | ClassSlotStatus, number> = {
      all: slots.length,
      OPEN: 0,
      FULL: 0,
    }
    for (const item of slots) {
      counts[item.availability] += 1
    }
    return counts
  }, [slots])

  const filteredSlots = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return slots.filter((item) => {
      if (statusFilter !== 'all' && item.availability !== statusFilter) return false
      if (!needle) return true
      return `${item.code} ${item.section} ${item.title} ${item.schedule}`
        .toLowerCase()
        .includes(needle)
    })
  }, [query, statusFilter, slots])

  const totalRecords = filteredSlots.length
  const effectivePageSize = pageSize === 'all' ? Math.max(totalRecords, 1) : pageSize
  const totalPages = Math.max(1, Math.ceil(totalRecords / effectivePageSize))
  const currentPage = Math.min(page, totalPages)
  const showingFrom = totalRecords === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1
  const showingTo = Math.min(currentPage * effectivePageSize, totalRecords)
  const visibleSlots =
    pageSize === 'all'
      ? filteredSlots
      : filteredSlots.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize)

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, pageSize])

  if (loading) {
    return (
      <Reveal delay={0.05}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60">
          <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
          Loading class slots…
        </div>
      </Reveal>
    )
  }

  if (error) {
    return (
      <Reveal delay={0.05}>
        <EmptyState title="Could not load class slots" body={error} />
      </Reveal>
    )
  }

  if (slots.length === 0) {
    return (
      <Reveal delay={0.05}>
        <EmptyState
          title="No class slots yet"
          body="Published class offerings will appear here once added in Admin."
        />
      </Reveal>
    )
  }

  return (
    <Reveal delay={0.05}>
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search class slots</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, title, section…"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/25"
            />
          </label>
          <div className="w-full sm:w-auto sm:shrink-0">
            <SlotStatusDropdown
              value={statusFilter}
              counts={statusCounts}
              onChange={setStatusFilter}
            />
          </div>
        </div>

        {filteredSlots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/60 px-5 py-10 text-center">
            <Search className="mx-auto size-8 text-brand-600/35" strokeWidth={1.4} aria-hidden />
            <p className="mt-3 text-sm font-semibold text-brand-950">No matching class slots</p>
            <p className="mt-1 text-[13px] leading-5 text-zinc-500">
              Try another search or status filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setStatusFilter('all')
              }}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-brand-700 px-4 text-[13px] font-semibold text-white hover:bg-brand-800"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        <ul className={cn('grid gap-2.5 sm:gap-3 lg:hidden', filteredSlots.length === 0 && 'hidden')}>
          {visibleSlots.map((item) => {
            const status = classSlotStatusMeta(item.availability)
            const mode = sectionModeBadge(item.section)
            const StatusIcon = status.Icon
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white p-3.5 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-800 uppercase">
                      {item.code}
                    </span>
                    <span className="inline-flex max-w-[9rem] items-center truncate rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                      {item.section.split(' (')[0]}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                        mode.className,
                      )}
                    >
                      {mode.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold',
                      status.pill,
                    )}
                  >
                    <StatusIcon className="size-3" aria-hidden />
                    {status.label}
                  </span>
                </div>

                <p className="mt-2.5 text-[14px] font-semibold leading-snug break-words text-brand-950 sm:mt-3 sm:text-[15px] dark:text-zinc-50">
                  {item.title}
                </p>

                <div className="mt-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/70 sm:mt-3">
                  <p className="flex items-start gap-2 text-[12px] leading-5 text-zinc-600 sm:text-[13px] dark:text-zinc-300">
                    <Clock3 className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                    <span className="min-w-0 break-words">{item.schedule}</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        <div
          className={cn(
            'hidden overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900',
            filteredSlots.length === 0 && 'lg:hidden',
          )}
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/80">
                <th className="px-5 py-3.5 text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="size-3.5" aria-hidden />
                    Subject & Section
                  </span>
                </th>
                <th className="px-4 py-3.5 text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5" aria-hidden />
                    Schedule
                  </span>
                </th>
                <th className="px-5 py-3.5 text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                  Availability
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleSlots.map((item) => {
                const status = classSlotStatusMeta(item.availability)
                const mode = sectionModeBadge(item.section)
                const StatusIcon = status.Icon
                return (
                  <tr
                    key={item.id}
                    className="border-b border-zinc-100 last:border-b-0 transition-colors hover:bg-brand-50/35"
                  >
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-800 uppercase">
                          {item.code}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                          {item.section.split(' (')[0]}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                            mode.className,
                          )}
                        >
                          {mode.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-brand-950">{item.title}</p>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <p className="flex items-start gap-1.5 text-sm text-zinc-700">
                        <Clock3 className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                        {item.schedule}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                          status.pill,
                        )}
                      >
                        <StatusIcon className="size-3.5" aria-hidden />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredSlots.length > 0 ? (
          <div
            role="navigation"
            aria-label="Class slots pagination"
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start sm:gap-3">
              <div className="inline-flex items-center gap-2 text-[12px] text-zinc-500">
                <span className="font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                  Show
                </span>
                <SlotPageSizeDropdown value={pageSize} onChange={setPageSize} />
              </div>
              <p className="text-[12px] tabular-nums text-zinc-500">
                <span className="sm:hidden">
                  <span className="font-semibold text-brand-950 dark:text-zinc-50">
                    {showingFrom}–{showingTo}
                  </span>
                  <span className="text-zinc-400"> / </span>
                  <span className="font-semibold text-brand-950 dark:text-zinc-50">
                    {totalRecords}
                  </span>
                </span>
                <span className="hidden sm:inline">
                  Showing{' '}
                  <span className="font-semibold text-brand-950 dark:text-zinc-50">
                    {showingFrom}
                  </span>
                  <span className="text-zinc-400"> – </span>
                  <span className="font-semibold text-brand-950 dark:text-zinc-50">
                    {showingTo}
                  </span>
                  <span className="text-zinc-400"> of </span>
                  <span className="font-semibold text-brand-950 dark:text-zinc-50">
                    {totalRecords}
                  </span>
                </span>
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-950 transition-colors touch-manipulation hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                <span className="hidden min-[380px]:inline">Prev</span>
              </button>
              <p className="text-[12px] font-semibold tabular-nums text-zinc-600 sm:hidden dark:text-zinc-300">
                {currentPage} / {totalPages}
              </p>
              <div className="hidden items-center gap-1 sm:flex">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
                  const selected = pageNumber === currentPage
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-label={`Page ${pageNumber}`}
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setPage(pageNumber)}
                      className={cn(
                        'inline-flex size-9 items-center justify-center rounded-lg text-[12px] font-semibold tabular-nums transition-colors',
                        selected
                          ? 'bg-brand-700 text-white'
                          : 'border border-zinc-200 bg-white text-brand-950 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                      )}
                    >
                      {pageNumber}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-950 transition-colors touch-manipulation hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <span className="hidden min-[380px]:inline">Next</span>
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Reveal>
  )
}

function GuidelinesContent({
  note,
  onSelectTab,
}: {
  note: string
  onSelectTab: (slug: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scheduleDays, setScheduleDays] = useState<EnrollmentScheduleDay[]>([])
  const [windows, setWindows] = useState<EnrollmentBatchWindow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([listScheduleDays(), listBatchWindows()]).then(([daysResult, windowsResult]) => {
      if (cancelled) return
      if (!daysResult.ok || !windowsResult.ok) {
        setError(
          !daysResult.ok
            ? daysResult.error
            : !windowsResult.ok
              ? windowsResult.error
              : 'Failed to load guidelines.',
        )
        setScheduleDays([])
        setWindows([])
        setLoading(false)
        return
      }
      setError('')
      setScheduleDays(daysResult.data.items)
      setWindows(windowsResult.data.items)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6 sm:space-y-8">
      <Reveal>
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
          <div className="min-w-0">
            <SectionKicker icon={ClipboardList}>Guidelines</SectionKicker>

            <h2 className="mt-2 font-hero text-[clamp(1.7rem,1rem+2.2vw,3.1rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 sm:mt-2.5 dark:text-zinc-50">
              Enrollment <span className="text-brand-600 dark:text-brand-400">Guidelines</span>
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-zinc-500 sm:mt-3 sm:text-sm sm:leading-6 dark:text-zinc-400">
              <span className="sm:hidden">
                Schedules, required documents, fee verification, and station procedures for
                enrollment.
              </span>
              <span className="hidden sm:inline">{note}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-row lg:w-52 lg:flex-col">
            <Button
              type="button"
              variant="gold"
              size="lg"
              className="h-11 w-full justify-center rounded-xl sm:h-12"
              onClick={() => onSelectTab('enrollment-routing-slip')}
            >
              <CalendarDays className="size-4" aria-hidden />
              Book Appointment
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full justify-center rounded-xl sm:h-12"
              onClick={() => onSelectTab('class-builder')}
            >
              <LayoutGrid className="size-4" aria-hidden />
              Class Builder
            </Button>
          </div>
        </div>
      </Reveal>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60">
          <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
          Loading guidelines…
        </div>
      ) : error ? (
        <EmptyState title="Could not load guidelines" body={error} />
      ) : scheduleDays.length === 0 && windows.length === 0 ? (
        <EmptyState
          title="Guidelines not published yet"
          body="Enrollment schedule days and batch windows will appear here once officers publish them in Admin."
        />
      ) : (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-7">
          <Reveal delay={0.05}>
            <section
              aria-labelledby="onsite-schedule-heading"
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:rounded-[1.5rem] sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 sm:size-9">
                  <CalendarDays className="size-3.5 sm:size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3
                    id="onsite-schedule-heading"
                    className="text-[15px] font-semibold tracking-tight text-brand-950 sm:text-lg"
                  >
                    Official Onsite Enrollment Schedule
                  </h3>
                </div>
              </div>

              {scheduleDays.length === 0 ? (
                <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
                  <CalendarDays className="size-8 text-brand-600/35" strokeWidth={1.4} aria-hidden />
                  <p className="mt-3 text-[13px] font-semibold text-brand-950 dark:text-zinc-50">
                    No schedule days yet
                  </p>
                  <p className="mt-1 max-w-xs text-[12px] leading-5 text-zinc-500">
                    Official onsite enrollment dates will appear here once published.
                  </p>
                </div>
              ) : (
                <ol className="relative mt-4 flex-1 sm:mt-5">
                  <span
                    aria-hidden
                    className="absolute top-3 bottom-3 left-[0.875rem] w-px bg-brand-100 sm:left-[0.9375rem]"
                  />
                  {scheduleDays.map((item, index) => (
                    <li
                      key={item.id}
                      className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 pb-4 last:pb-0 sm:grid-cols-[1.875rem_minmax(0,1fr)] sm:gap-4 sm:pb-5"
                    >
                      <span className="relative z-10 flex justify-center pt-0.5" aria-hidden>
                        <span
                          className={cn(
                            'flex size-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ring-4 ring-white sm:size-7 sm:text-[11px] dark:ring-zinc-900',
                            item.muted ? 'bg-emerald-500 text-white' : 'bg-brand-700 text-white',
                          )}
                        >
                          {item.muted ? '✓' : index + 1}
                        </span>
                      </span>
                      <div className="min-w-0 rounded-xl bg-zinc-50/80 px-3 py-2.5 sm:px-3.5 sm:py-3">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase sm:px-2 sm:text-[11px]',
                              item.muted
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-brand-50 text-brand-700',
                            )}
                          >
                            {item.dayLabel}
                          </span>
                          <span className="text-[12px] font-medium text-zinc-500 sm:text-[13px]">
                            {item.dateLabel}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'mt-1 text-[13px] font-semibold leading-5 sm:mt-1.5 sm:text-sm',
                            item.muted ? 'text-emerald-800' : 'text-brand-950',
                          )}
                        >
                          {item.groupLabel}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <section
              aria-labelledby="batch-windows-heading"
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:rounded-[1.5rem] sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 sm:size-9">
                  <Clock3 className="size-3.5 sm:size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3
                    id="batch-windows-heading"
                    className="text-[15px] font-semibold tracking-tight text-brand-950 sm:text-lg"
                  >
                    Daily Batch & Cutoff Windows
                  </h3>
                </div>
              </div>

              {windows.length === 0 ? (
                <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
                  <Clock3 className="size-8 text-brand-600/35" strokeWidth={1.4} aria-hidden />
                  <p className="mt-3 text-[13px] font-semibold text-brand-950 dark:text-zinc-50">
                    No batch windows yet
                  </p>
                  <p className="mt-1 max-w-xs text-[12px] leading-5 text-zinc-500">
                    Daily batch and cutoff windows will appear here once published.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 flex-1 space-y-2 sm:mt-6 sm:space-y-2.5">
                  {windows.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        'flex flex-col gap-2 rounded-xl px-3 py-3 sm:grid sm:grid-cols-[6.25rem_minmax(0,1fr)] sm:items-center sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-3.5',
                        item.tone === 'pause' ? 'bg-amber-50/80' : 'bg-brand-50/70',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-7 w-fit items-center justify-center rounded-lg px-2 text-[11px] font-bold tracking-wide uppercase',
                          item.tone === 'pause'
                            ? 'bg-amber-200/80 text-amber-900'
                            : 'bg-brand-700 text-white',
                        )}
                      >
                        {item.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-brand-950 sm:text-sm">
                          {item.timeLabel}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-4 text-zinc-500 sm:text-[13px] sm:leading-5">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        </div>
      )}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 flex w-full flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/60 px-6 py-12 text-center">
      <ClipboardPen className="size-10 text-brand-600/40" strokeWidth={1.35} aria-hidden />
      <p className="mt-3 text-base font-semibold text-brand-950">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{body}</p>
    </div>
  )
}

function HeroBackdrop() {
  const reduce = useReducedMotion() === true

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-white dark:bg-zinc-950">
      <div className="hero-wash absolute inset-0" />
      <motion.div
        className="hero-glow absolute top-0 left-1/2 h-80 w-[36rem] rounded-full bg-white/80 blur-3xl dark:bg-brand-600/20"
        initial={{ x: '-58%' }}
        animate={{ x: reduce ? '-50%' : '-42%' }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
        }
      />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent dark:from-zinc-950" />
    </div>
  )
}

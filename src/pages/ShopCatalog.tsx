import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Hash, LockKeyhole, Search, SearchX, Shirt, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import {
  loadShopCatalog,
  shopCatalogPath,
  shops,
  type ShopId,
  type ShopItem,
} from '@/components/portal/catalog'
import { LockerGrid } from '@/components/portal/LockerGrid'
import { ShopPanel } from '@/components/portal/Shop'
import { lockerGuidelinesUrl, merchGuidelinesUrl, siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

const copy: Record<
  ShopId,
  { eyebrow: string; title: string; accent: string; body: string; documentTitle: string }
> = {
  locker: {
    eyebrow: 'Services & Store',
    title: 'Locker',
    accent: 'Availability',
    body: 'Tap an unassigned locker to reserve it. The Council confirms by email — no payment is taken here.',
    documentTitle: `Locker Availability · ${siteName.short} ${siteName.unit}`,
  },
  merch: {
    eyebrow: 'Services & Store',
    title: 'Merchandise',
    accent: 'Reservation',
    body: 'Reserve official Student Council merchandise. The Council confirms by email — no payment is taken here.',
    documentTitle: `Merchandise Reservation · ${siteName.short} ${siteName.unit}`,
  },
}

export function LockerPage() {
  return <ShopCatalogPage shop="locker" />
}

export function MerchPage() {
  return <ShopCatalogPage shop="merch" />
}

function matchesMerch(item: ShopItem, needle: string) {
  if (!needle) return true
  return `${item.name} ${item.number ?? ''} ${item.alt} ${item.unit} ${item.price}`
    .toLowerCase()
    .includes(needle)
}

function ShopCatalogPage({ shop }: { shop: ShopId }) {
  const page = copy[shop]
  const [catalog, setCatalog] = useState(shops)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const previous = document.title
    document.title = page.documentTitle
    return () => {
      document.title = previous
    }
  }, [page.documentTitle])

  useEffect(() => {
    let cancelled = false
    void loadShopCatalog().then((next) => {
      if (!cancelled) setCatalog(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const listing = catalog[shop]
  const needle = query.trim().toLowerCase()
  const merchItems = useMemo(
    () => (shop === 'merch' ? listing.items.filter((item) => matchesMerch(item, needle)) : listing.items),
    [listing.items, needle, shop],
  )

  if (shop === 'locker') {
    return (
      <main id="main-content" className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 px-4 pt-8 sm:px-6 lg:px-8">
          <ShopSwitch shop={shop} />
          <GuidelinesLink shop="locker" />
          <TrackReservationLink />
        </div>
        <div className="pt-8">
          <LockerGrid items={listing.items} />
        </div>
      </main>
    )
  }

  return (
    <>
      <section
        aria-labelledby={`${shop}-page-title`}
        className="hero-blend relative isolate overflow-hidden bg-white"
      >
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
            <motion.p
              variants={rise}
              className="text-[11px] font-semibold tracking-[0.22em] text-brand-700 uppercase"
            >
              {page.eyebrow}
            </motion.p>
            <motion.h1
              id={`${shop}-page-title`}
              variants={rise}
              className="mt-3 font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-brand-950"
            >
              {page.title} <span className="text-brand-600">{page.accent}</span>
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-[15px]"
            >
              {page.body}
            </motion.p>
            <motion.div variants={rise} className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <ShopSwitch shop={shop} />
              <GuidelinesLink shop="merch" />
              <TrackReservationLink />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <main id="main-content" className="bg-[#f4f5f7]">
        <div className="bg-[#f6f5fb]">
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <label className="relative w-full max-w-5xl">
              <span className="sr-only">Search merchandise</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search merch"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        </div>
        {listing.items.length === 0 ? (
          <EmptyState
            icon={Shirt}
            title="No merch published yet"
            body="Official Student Council merchandise will appear here once items are published."
          />
        ) : merchItems.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matching merch"
            body="Try another word, or clear the search to see every item."
            action={
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
              >
                Clear search
              </button>
            }
          />
        ) : (
          <Reveal>
            <div className="pt-[clamp(1.5rem,1rem+1.2vw,2.5rem)]">
              <ShopPanel
                shop={shop}
                title={listing.title}
                kicker={listing.kicker}
                items={merchItems}
                showTitle={false}
              />
            </div>
          </Reveal>
        )}
      </main>
    </>
  )
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <div
        role="status"
        className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)]"
      >
        <Icon className="size-10 text-brand-600/40" strokeWidth={1.35} aria-hidden />
        <p className="mt-3 font-semibold text-brand-950">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{body}</p>
        {action}
      </div>
    </div>
  )
}

function GuidelinesLink({ shop }: { shop: ShopId }) {
  const href = shop === 'locker' ? lockerGuidelinesUrl : merchGuidelinesUrl
  const label = shop === 'locker' ? 'Locker Guidelines' : 'Merch Guidelines'

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 transition-colors hover:border-brand-200 hover:text-brand-800 sm:h-10 sm:w-auto sm:px-4"
    >
      <BookOpen className="size-4 sm:size-3.5" aria-hidden />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </a>
  )
}

function TrackReservationLink() {
  return (
    <Link
      to="/portal#tracking"
      aria-label="Track a reservation"
      title="Track a reservation"
      className="inline-flex size-10 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 transition-colors hover:border-brand-200 hover:text-brand-800 sm:h-10 sm:w-auto sm:px-4"
    >
      <Hash className="size-4 sm:size-3.5" aria-hidden />
      <span className="sr-only sm:not-sr-only">Track a reservation</span>
    </Link>
  )
}

function ShopSwitch({ shop }: { shop: ShopId }) {
  const items = [
    { id: 'locker' as const, label: 'Lockers', icon: LockKeyhole },
    { id: 'merch' as const, label: 'Merch', icon: Shirt },
  ]

  return (
    <nav
      aria-label="Reservation catalogs"
      className="inline-flex rounded-full border border-zinc-200 bg-white p-1"
    >
      {items.map((item) => {
        const selected = shop === item.id
        const Icon = item.icon
        return (
          <Link
            key={item.id}
            to={shopCatalogPath(item.id)}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
              selected ? 'bg-brand-700 text-white' : 'text-zinc-600 hover:text-zinc-900',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
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

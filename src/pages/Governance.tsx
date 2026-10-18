import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Gavel, Loader2, Scale, type LucideIcon } from 'lucide-react'
import { SectionKicker } from '@/components/ui/SectionKicker'
import collegeOfLaw from '@/assets/logos/college-of-law.jpg'
import lawStudentsSociety from '@/assets/logos/law-students-society.jpg'
import studentCouncil from '@/assets/logos/student-council.png'
import studentCouncilMark from '@/assets/logos/student-council-mark.jpg'
import { siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import {
  councilYearKicker,
  useCouncilBoard,
  type CouncilSeat,
} from '@/hooks/useCouncilBoard'
import { useDocuments } from '@/hooks/useDocuments'
import { cn } from '@/lib/utils'

const seals = [
  { src: collegeOfLaw, label: 'College of Law' },
  { src: studentCouncilMark, label: 'Previous Student Council' },
  { src: lawStudentsSociety, label: 'Law Students Society' },
  { src: studentCouncil, label: 'Student Council' },
]

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

export function LegislativePage() {
  usePageTitle('Legislative')
  const { items: boardResolutions, loading, error } = useDocuments('board_resolution')

  return (
    <>
      <GovernanceHero
        id="legislative-title"
        icon={Scale}
        kicker="Governance"
        title="Legislative"
        lede="The Council formulates policies that protect the welfare, rights, and interests of law students. Board resolutions for Series of 2026 are listed here."
        current="legislative"
      />
      <main id="main-content" className="bg-white">
        <section aria-labelledby="board-resolutions-title" className="bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
            <Reveal>
              <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
                    Series of 2026
                  </p>
                  <h2
                    id="board-resolutions-title"
                    className="mt-3 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
                  >
                    Board <span className="text-brand-600">Resolutions</span>
                  </h2>
                </div>
                {loading || error ? null : (
                  <p className="text-sm font-medium text-zinc-500">{boardResolutions.length} resolutions</p>
                )}
              </header>
            </Reveal>
            {loading ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading resolutions…
              </div>
            ) : null}
            {!loading && error ? <p className="mt-8 text-center text-sm text-zinc-500">{error}</p> : null}
            {!loading && !error && boardResolutions.length === 0 ? (
              <p className="mt-8 text-center text-sm text-zinc-500">No board resolutions published yet.</p>
            ) : null}
            <ol className="mt-8 grid gap-3">
              {boardResolutions.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-300 sm:gap-5 sm:p-5"
                  >
                    <span className="w-10 shrink-0 font-hero text-2xl leading-none text-brand-300 tabular-nums sm:w-12">
                      {item.number || '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                        {item.seriesLabel || 'Board resolution'}
                      </span>
                      <span className="mt-1 block font-display text-[1.05rem] leading-snug font-medium text-brand-950 sm:text-lg">
                        {item.title}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-brand-700" aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Financial records, appointment resolutions, and the rest of the document set are on the{' '}
              <Link to="/transparency" className="font-semibold text-brand-800 underline decoration-brand-200 underline-offset-2 hover:text-brand-600">
                Transparency
              </Link>{' '}
              page.
            </p>
          </div>
        </section>
        <Companion
          href="/governance/executive"
          kicker="Executive"
          title="Officers for the public academic year"
          text="The Executive Board, year representatives, and associates pinned for The Council."
        />
      </main>
    </>
  )
}

export function ExecutivePage() {
  usePageTitle('Executive')
  const { year, loading, error, bySection } = useCouncilBoard('officers')
  const executive = bySection('executive')
  const yearReps = bySection('year_reps')
  const associates = bySection('associates')
  const [president, ...board] = executive
  const yearLabel = year ? `A.Y. ${year}` : 'Public academic year'

  return (
    <>
      <GovernanceHero
        id="executive-title"
        icon={Gavel}
        kicker="Governance"
        title="Executive"
        lede={
          year
            ? `The Executive Board, year representatives, and associates for A.Y. ${year} (set from the admin public pin).`
            : 'The Executive Board, year representatives, and associates for the academic year pinned on The Council.'
        }
        current="executive"
      />
      <main id="main-content" className="bg-surface">
        <section aria-labelledby="executive-board-title" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
            <SectionHeading
              id="executive-board-title"
              kicker={councilYearKicker('Officers', year)}
              title={
                <>
                  Executive <span className="text-brand-600">Board</span>
                </>
              }
            />
            {loading ? (
              <div className="mt-10 flex items-center justify-center gap-2 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading roster…
              </div>
            ) : null}
            {!loading && error ? (
              <p className="mt-10 text-center text-sm text-zinc-500">{error}</p>
            ) : null}
            {!loading && !error && !president ? (
              <p className="mt-10 text-center text-sm text-zinc-500">
                No officers published for {yearLabel.toLowerCase()}.
              </p>
            ) : null}
            {!loading && !error && president ? (
              <>
                <div className="mt-8">
                  <SeatCard seat={president} featured />
                </div>
                {board.length > 0 ? (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {board.map((seat) => (
                      <li key={`${seat.role}-${seat.name}`}>
                        <SeatCard seat={seat} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </div>
        </section>

        {!loading && !error && (yearReps.length > 0 || associates.length > 0) ? (
          <section aria-labelledby="year-reps-title" className="bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
              {yearReps.length > 0 ? (
                <>
                  <SectionHeading
                    id="year-reps-title"
                    kicker="Representation"
                    title={
                      <>
                        Year <span className="text-brand-600">Representatives</span>
                      </>
                    }
                  />
                  <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {yearReps.map((seat) => (
                      <li key={`${seat.role}-${seat.name}`}>
                        <SeatCard seat={seat} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {associates.length > 0 ? (
                <>
                  <h3
                    className={cn(
                      'text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase',
                      yearReps.length > 0 ? 'mt-12' : 'mt-0',
                    )}
                  >
                    Associates
                  </h3>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {associates.map((seat) => (
                      <li key={`${seat.role}-${seat.name}`}>
                        <SeatCard seat={seat} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        <section aria-label="Related council pages" className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:grid-cols-3 lg:px-8">
            <CompanionCard
              href="/governance/legislative"
              kicker="Legislative"
              title="Board resolutions"
              text="Series of 2026."
            />
            <CompanionCard
              href="/about/the-council#advisers"
              kicker="Advisers"
              title="Faculty advisers"
              text="Advisory Board for the public academic year."
            />
            <CompanionCard
              href="/about/the-council#commissions"
              kicker="Commission"
              title="Appointments"
              text="Commission on Appointments."
            />
          </div>
        </section>
      </main>
    </>
  )
}

function usePageTitle(page: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${page} · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [page])
}

function GovernanceHero({
  id,
  icon: Icon,
  kicker,
  title,
  lede,
  current,
}: {
  id: string
  icon: LucideIcon
  kicker: string
  title: string
  lede: string
  current: 'legislative' | 'executive'
}) {
  const reduce = useReducedMotion() === true

  return (
    <section aria-labelledby={id} className="hero-blend relative isolate overflow-hidden bg-white">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-white">
        <div className="hero-wash absolute inset-0 bg-[linear-gradient(180deg,white_0%,var(--color-brand-50)_55%,#e4d4fb_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
      </div>
      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-[clamp(2.25rem,1.4rem+3vw,4.5rem)] pb-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : 'hidden'}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
          className="flex w-full max-w-3xl flex-col items-center text-center"
        >
          <motion.div variants={rise} className="mb-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {seals.map((seal) => (
              <img
                key={seal.label}
                src={seal.src}
                alt={seal.label}
                width={64}
                height={64}
                className="size-[clamp(2.25rem,1.5rem+2.2vw,3.5rem)] rounded-full border border-zinc-200 bg-[#ffffff] object-contain p-0.5"
              />
            ))}
          </motion.div>
          <motion.div variants={rise}>
            <SectionKicker icon={Icon}>{kicker}</SectionKicker>
          </motion.div>
          <motion.h1
            id={id}
            variants={rise}
            className="mt-4 font-hero text-[clamp(2.4rem,1rem+4.5vw,4.75rem)] leading-[0.92] font-normal tracking-tight text-brand-950"
          >
            {title}
          </motion.h1>
          <motion.p variants={rise} className="mt-4 max-w-xl text-[clamp(0.9rem,0.82rem+0.25vw,1.05rem)] leading-relaxed text-zinc-600">
            {lede}
          </motion.p>
          <motion.nav variants={rise} aria-label="Governance" className="mt-6 flex rounded-full border border-zinc-200 bg-white p-1">
            <SwitchLink to="/governance/legislative" current={current === 'legislative'}>
              Legislative
            </SwitchLink>
            <SwitchLink to="/governance/executive" current={current === 'executive'}>
              Executive
            </SwitchLink>
          </motion.nav>
        </motion.div>
      </div>
    </section>
  )
}

function SwitchLink({ to, current, children }: { to: string; current: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors',
        current ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50',
      )}
    >
      {children}
    </Link>
  )
}

function SectionHeading({ id, kicker, title }: { id: string; kicker: string; title: ReactNode }) {
  return (
    <Reveal>
      <header>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{kicker}</p>
        <h2 id={id} className="mt-3 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          {title}
        </h2>
      </header>
    </Reveal>
  )
}

function SeatCard({ seat, featured = false }: { seat: CouncilSeat; featured?: boolean }) {
  return (
    <article
      className={cn(
        'flex h-full items-center gap-3 rounded-2xl border bg-white p-3.5 sm:p-4',
        seat.vacant ? 'border-dashed border-zinc-300' : 'border-zinc-200',
        featured && 'border-brand-200 sm:p-5',
      )}
    >
      <img
        src={seat.vacant || !seat.photo ? studentCouncil : seat.photo}
        alt=""
        width={80}
        height={80}
        className={cn(
          'shrink-0 border border-zinc-200 bg-[#ffffff]',
          seat.photo && !seat.vacant ? 'rounded-xl object-cover object-[center_18%]' : 'rounded-full object-contain p-1',
          featured ? 'size-16 sm:size-[4.5rem]' : 'size-14',
          seat.vacant && 'opacity-40',
          featured && 'ring-2 ring-gold-400',
        )}
      />
      <span className="min-w-0">
        <span className="block text-[11px] leading-4 font-semibold tracking-[0.12em] text-brand-700 uppercase">
          {seat.role}
        </span>
        <span className="mt-0.5 block text-sm leading-5 font-semibold break-words text-brand-950 sm:text-[15px]">
          {seat.name}
        </span>
      </span>
    </article>
  )
}

function Companion({
  href,
  kicker,
  title,
  text,
}: {
  href: string
  kicker: string
  title: string
  text: string
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2rem,1.2rem+2vw,3.5rem)] sm:px-6 lg:px-8">
      <CompanionCard href={href} kicker={kicker} title={title} text={text} />
    </div>
  )
}

function CompanionCard({
  href,
  kicker,
  title,
  text,
}: {
  href: string
  kicker: string
  title: string
  text: string
}) {
  return (
    <Link
      to={href}
      className="group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-brand-300 sm:p-6"
    >
      <span className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{kicker}</span>
      <span className="mt-2 font-display text-xl leading-snug font-medium text-brand-950">{title}</span>
      <span className="mt-2 text-sm leading-6 text-zinc-500">{text}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 group-hover:text-brand-600">
        Open
        <ArrowUpRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  )
}

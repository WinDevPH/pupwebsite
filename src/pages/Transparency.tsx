import { useEffect, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  FileText,
  Gavel,
  HeartHandshake,
  Landmark,
  Mail,
  Receipt,
  ScrollText,
  Wallet,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import collegeOfLaw from '@/assets/logos/college-of-law.jpg'
import lawStudentsSociety from '@/assets/logos/law-students-society.jpg'
import studentCouncil from '@/assets/logos/student-council.png'
import studentCouncilMark from '@/assets/logos/student-council-mark.jpg'
import { siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { cn } from '@/lib/utils'

type Resolution = {
  number: string
  title: string
  href: string
}

const boardResolutions: Resolution[] = [
  {
    number: '001',
    title: 'Declaring Vacancies and Manner of Filling the Same',
    href: 'https://drive.google.com/file/d/1p1dQc5ck5CtFTHY07zKX5i46Mbv8V5nZ/view?usp=sharing',
  },
  {
    number: '002',
    title: 'Creation of Ad Hoc Committees and Providing for Manner of Filling the Same',
    href: 'https://drive.google.com/file/d/1HSqAIASpCO3oHxWp_msYhc4J34I9X7Ee/view?usp=sharing',
  },
  {
    number: '003',
    title: 'Creation of the SC Website, Ad Hoc Committee, and Matters Related Thereto',
    href: 'https://bit.ly/BoardResolution003s2026',
  },
  {
    number: '004',
    title: 'Policy Guidelines on Correspondence and Document Management',
    href: 'https://bit.ly/BoardResolution004s2026',
  },
  {
    number: '005',
    title: 'Policy Guidelines on the Conduct of Board Meetings and other Assemblies',
    href: 'https://bit.ly/BoardResolution005s2026',
  },
]

const appointmentResolutions: Resolution[] = [
  {
    number: '001',
    title:
      'PRESCRIBING THE PROCEDURE, QUALIFICATIONS, AND CALENDAR FOR THE APPOINTMENT OF ASSOCIATE OFFICERS AND OTHER APPOINTIVE POSITIONS FOR FIRST SEMESTER, ACADEMIC YEAR 2026-2027',
    href: 'https://drive.google.com/file/d/100RBzQvvdiWYRcVPfnWh0PfXHrjzUJf6/view?usp=sharing',
  },
  {
    number: '002',
    title: 'ADJUSTMENT OF CALENDAR',
    href: 'https://drive.google.com/file/d/1-YGowhE93PIYo2E8c6rZrnsYeV4egSG8/view?usp=sharing',
  },
  {
    number: '003',
    title: 'CONFIRMATION OF APPOINTMENTS',
    href: 'https://drive.google.com/file/d/1GBxqhnWrfu2dbo2CfjLo7E9-yXDM7X_a/view?usp=sharing',
  },
  {
    number: '004',
    title: 'SECOND CALL FOR APPLICATIONS',
    href: 'https://drive.google.com/file/d/1QpkZWwuFFgq48o84FUkSoF71hU6ZWLfA/view?usp=sharing',
  },
]

const seals = [
  { src: collegeOfLaw, label: 'College of Law' },
  { src: lawStudentsSociety, label: 'Law Students Society' },
  { src: studentCouncil, label: 'Student Council' },
  { src: studentCouncilMark, label: 'College of Law SC' },
]

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

const transparencyTabs = [
  { id: 'board', label: 'Board', icon: Landmark, count: boardResolutions.length },
  { id: 'appointments', label: 'Appointments', icon: Gavel, count: appointmentResolutions.length },
  { id: 'memoranda', label: 'Memoranda', icon: Mail },
  { id: 'reports', label: 'Reports', icon: ClipboardCheck },
] as const

type TransparencyTab = (typeof transparencyTabs)[number]['id']

function onTabKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  tab: TransparencyTab,
  setTab: (id: TransparencyTab) => void,
) {
  const index = transparencyTabs.findIndex((item) => item.id === tab)
  if (index < 0) return
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? transparencyTabs[(index + 1) % transparencyTabs.length]
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? transparencyTabs[(index - 1 + transparencyTabs.length) % transparencyTabs.length]
        : event.key === 'Home'
          ? transparencyTabs[0]
          : event.key === 'End'
            ? transparencyTabs[transparencyTabs.length - 1]
            : null
  if (!next) return
  event.preventDefault()
  setTab(next.id)
  document.getElementById(`transparency-tab-${next.id}`)?.focus()
}

function tabFromHash(hash: string): TransparencyTab | null {
  const id = hash.replace('#', '')
  return transparencyTabs.some((item) => item.id === id) ? (id as TransparencyTab) : null
}

export default function Transparency() {
  const { hash } = useLocation()
  const [tab, setTab] = useState<TransparencyTab>(() => tabFromHash(hash) ?? 'board')

  useEffect(() => {
    const next = tabFromHash(hash)
    if (next) setTab(next)
  }, [hash])

  useEffect(() => {
    const previous = document.title
    document.title = `Transparency & Documents · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [])

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
            <motion.div
              variants={rise}
              className="mb-[clamp(0.75rem,0.4rem+1vw,1.25rem)] flex max-w-full flex-wrap items-center justify-center gap-[clamp(0.5rem,0.25rem+0.8vw,1rem)]"
            >
              {seals.map((seal) => (
                <img
                  key={seal.src}
                  src={seal.src}
                  alt={seal.label}
                  width={64}
                  height={64}
                  className="size-[clamp(2.25rem,1.5rem+2.2vw,4rem)] rounded-full border border-zinc-200 bg-white object-contain p-0.5 shadow-[0_8px_16px_-12px_rgba(30,5,65,0.5)]"
                />
              ))}
            </motion.div>

            <motion.h1
              id="transparency-page-title"
              variants={rise}
              className="max-w-4xl font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Governance and
              <br />
              <span className="text-brand-600">resolutions</span>
            </motion.h1>
          </motion.div>
        </div>
      </section>

      <main id="main-content" className="bg-white">
        <div className="bg-[#f6f5fb]">
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div
              className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4"
              role="tablist"
              aria-label="Transparency"
              onKeyDown={(event) => onTabKeyDown(event, tab, setTab)}
            >
              {transparencyTabs.map((item) => {
                const selected = tab === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`transparency-tab-${item.id}`}
                    aria-selected={selected}
                    aria-controls="transparency-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-sm transition-colors',
                      selected
                        ? 'border-brand-700 bg-brand-700 font-semibold text-white shadow-[0_10px_18px_-14px_rgba(76,29,149,0.9)]'
                        : 'border-zinc-200 bg-white font-medium text-zinc-600 hover:border-brand-200 hover:text-brand-800',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {'count' in item ? (
                      <span
                        className={cn(
                          'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                          selected ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700',
                        )}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div
          id="transparency-panel"
          role="tabpanel"
          aria-labelledby={`transparency-tab-${tab}`}
          className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8"
        >
          {tab === 'board' ? (
            <Archive
              id="board-resolutions"
              icon={Landmark}
              kicker="Secretariat"
              title="Board resolutions"
              accent="and en banc issuances"
              note="Organized archive of resolutions arranged by Series/Academic Year. Downloadable PDF links provided."
              folder="01 Board Resolution & Memoranda"
              seriesLabel="Board Resolution"
              items={boardResolutions}
            />
          ) : null}
          {tab === 'appointments' ? (
            <Archive
              id="appointments"
              icon={Gavel}
              kicker="Secretariat"
              title="Commission on Appointments"
              accent="resolutions"
              note="CA Reso No. 001, 002, 003, 004, Series of 2026."
              seriesLabel="Resolution"
              items={appointmentResolutions}
            />
          ) : null}
          {tab === 'memoranda' ? (
            <Reveal>
              <section id="memoranda">
                <SectionHeading
                  icon={ScrollText}
                  kicker="Secretariat"
                  title="Memoranda and"
                  accent="administrative requests"
                />
                <div className="mt-6 grid items-stretch gap-3 lg:grid-cols-2">
                  <article className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
                    <IconTile icon={Mail} />
                    <p className="text-sm leading-6 text-zinc-600">
                      Copies of formal communications sent to the Dean’s Office (e.g., Health and Wellness Break Request, Facility Recommendations).
                    </p>
                  </article>
                  <ul className="grid gap-3">
                    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
                      <IconTile icon={HeartHandshake} />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                          Example
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-brand-950">
                          Health and Wellness Break Request
                        </span>
                      </span>
                    </li>
                    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
                      <IconTile icon={Building2} />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                          Example
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-brand-950">
                          Facility Recommendations
                        </span>
                      </span>
                    </li>
                  </ul>
                </div>
              </section>
            </Reveal>
          ) : null}
          {tab === 'reports' ? (
            <Reveal>
              <section id="reports" className="scroll-mt-28">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <SectionKicker icon={FileText}>Audit</SectionKicker>
                    <h2 className="mt-2 font-hero text-[clamp(1.75rem,1.15rem+1.6vw,2.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
                      Financial and <span className="text-brand-600">accomplishment reports</span>
                    </h2>
                  </div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">In progress</p>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  <ul className="grid divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {(
                      [
                        { icon: Receipt, title: 'Quarterly liquidations' },
                        { icon: Wallet, title: 'Budget allocations' },
                        { icon: ClipboardCheck, title: 'Semester-end accomplishment reports' },
                      ] as const
                    ).map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <li key={item.title} className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                            <ItemIcon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 text-sm font-semibold text-brand-950">{item.title}</span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="border-t border-zinc-200 px-4 py-5 text-sm leading-6 text-zinc-600 sm:px-6">
                    Transparency and accountability are the bedrock of student governance in the PUP College of Law. True to our constitutional commitment to public trust and fiduciary responsibility, this section provides the student body with open, accessible access to the Council's financial records, monthly and semestral financial statements prepared by the Finance Officer, audit reports by the Auditor, and comprehensive annual accomplishment reports. Every student has the right to inspect official records and papers pertaining to the transactions, fund allocations, and financial disbursements of the Student Council.
                  </p>
                </div>
              </section>
            </Reveal>
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
}: {
  id: string
  icon: LucideIcon
  kicker: string
  title: string
  accent: string
  note: string
  folder?: string
  seriesLabel: string
  items: Resolution[]
}) {
  return (
    <Reveal>
      <section id={id} className="scroll-mt-28">
        <SectionHeading icon={icon} kicker={kicker} title={title} accent={accent} count={items.length} />
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-500">{note}</p>
        {folder ? (
          <p className="mt-3 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{folder}</p>
        ) : null}
        <ul className="mt-5 grid gap-3">
          {items.map((item) => (
            <li key={item.number}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-brand-200 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="pt-0.5 font-hero text-xl leading-none text-brand-600 tabular-nums">
                    {item.number}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                      {seriesLabel} No. {item.number}, s. 2026
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

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

function SectionHeading({
  icon: Icon,
  kicker,
  title,
  accent,
  count,
  status,
}: {
  icon: LucideIcon
  kicker: string
  title: string
  accent: string
  count?: number
  status?: string
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
        {status ? (
          <span className="rounded-md bg-gold-100 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-brand-950 uppercase">
            {status}
          </span>
        ) : null}
      </div>
      <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
        {title} <span className="text-brand-600">{accent}</span>
      </h2>
    </header>
  )
}

import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { motion, useReducedMotion } from 'motion/react'
import {
  BadgeCheck,
  BookMarked,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Clock,
  Eye,
  Flag,
  Gavel,
  GraduationCap,
  Images,
  Landmark,
  LifeBuoy,
  Loader2,
  Mail,
  MailCheck,
  MapPin,
  Megaphone,
  Network,
  Printer,
  Scale,
  ShieldCheck,
  Target,
  Users,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react'
import collegeOfLaw from '@/assets/logos/college-of-law.jpg'
import lawStudentsSociety from '@/assets/logos/law-students-society.jpg'
import studentCouncil from '@/assets/logos/student-council.png'
import studentCouncilMark from '@/assets/logos/student-council-mark.jpg'
import {
  isExternalNavTo,
  siteName,
  studentHandbookUrl,
} from '@/components/layout/nav-data'
import { mapProjectRecord } from '@/components/home/project-data'
import { Organizations } from '@/components/home/OrgDirectory'
import { Reveal, useRevealViewport } from '@/components/motion/Reveal'
import { Button } from '@/components/ui/button'
import { useAboutContent } from '@/hooks/useAboutContent'
import { councilYearKicker, useCouncilBoard } from '@/hooks/useCouncilBoard'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { RichTextContent } from '@/components/ui/RichTextEditor'
import { aboutIcon } from '@/lib/about-content-icons'
import type {
  AboutHistoryItem,
  AboutListItem,
} from '@/lib/about-content-api'
import { useSiteContact } from '@/hooks/useSiteContact'
import { listPublicGallery, type GalleryImageRecord } from '@/lib/gallery-api'
import { listProjects } from '@/lib/projects-api'
import { fadeUp, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'

const seals = [
  { src: collegeOfLaw, label: 'College of Law' },
  { src: studentCouncilMark, label: 'Previous Student Council' },
  { src: lawStudentsSociety, label: 'Law Students Society' },
  { src: studentCouncil, label: 'Student Council' },
]

type GalleryPhoto = {
  src: string
  title: string
  caption: string
  alt: string
}

function toGalleryPhoto(image: GalleryImageRecord): GalleryPhoto {
  return {
    src: image.src,
    title: image.title,
    caption: image.caption,
    alt: image.alt || image.title,
  }
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'mandate', label: 'Mandate' },
  { id: 'values', label: 'Mission & values' },
  { id: 'goals', label: 'Goals' },
  { id: 'agenda', label: 'Term agenda' },
  { id: 'officers', label: 'Officers' },
  { id: 'organizations', label: 'Accredited Organizations' },
  { id: 'structure', label: 'Structure' },
  { id: 'advisers', label: 'Advisory Board' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'gallery', label: 'Gallery' },
] as const

type TabId = (typeof tabs)[number]['id']

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

function tabFromLocation(): TabId {
  const id = window.location.hash.replace('#', '')
  return tabs.some((item) => item.id === id) ? (id as TabId) : 'overview'
}

export default function TheCouncil() {
  const { sections } = useAboutContent()
  const [tab, setTab] = useState<TabId>(tabFromLocation)

  useEffect(() => {
    const previous = document.title
    document.title = `About the Council · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [])

  useEffect(() => {
    const sync = () => setTab(tabFromLocation())
    window.addEventListener('hashchange', sync)
    if (tabFromLocation() !== 'overview') scrollTabIntoView(tabFromLocation())
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return (
    <>
      <section aria-labelledby="council-page-title" className="hero-blend relative isolate overflow-hidden bg-white">
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
              id="council-page-title"
              variants={rise}
              className="max-w-4xl font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              About the College of Law
              <br />
              <span className="text-brand-600">Student Council</span>
            </motion.h1>
          </motion.div>
        </div>
      </section>

      <main id="main-content">
        <section aria-label="About the Council" className="bg-white">
          <div className="border-b border-zinc-200">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div
                role="tablist"
                aria-label="About the Council"
                className="-mb-px flex w-full gap-x-5 overflow-x-auto scroll-smooth [justify-content:safe_center] [scrollbar-width:none] sm:gap-x-7 [&::-webkit-scrollbar]:hidden"
                onKeyDown={(event) => onTabKeyDown(event, tab, setTab)}
              >
                {tabs.map((item) => {
                  const selected = tab === item.id
                  return (
                    <button
                      key={item.id}
                      id={`council-tab-${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="council-panel"
                      tabIndex={selected ? 0 : -1}
                      className={cn(
                        'shrink-0 border-b-2 px-0.5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors sm:py-4',
                        selected
                          ? 'border-brand-600 text-brand-950'
                          : 'border-transparent text-zinc-500 hover:text-brand-800',
                      )}
                      onClick={() => {
                        setTab(item.id)
                        scrollTabIntoView(item.id)
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div
            id="council-panel"
            role="tabpanel"
            aria-labelledby={`council-tab-${tab}`}
            className="min-h-0"
          >
            {tab === 'overview' ? <OverviewPanel /> : null}
            {tab === 'history' ? <HistoryPanel items={sections.history.items} /> : null}
            {tab === 'mandate' ? <MandatePanel items={sections.mandate.items} /> : null}
            {tab === 'values' ? (
              <ValuesPanel
                mission={sections.mission.text}
                vision={sections.vision.text}
                values={sections.values.items}
              />
            ) : null}
            {tab === 'goals' ? <GoalsPanel goals={sections.goals.items} /> : null}
            {tab === 'agenda' ? <AgendaPanel items={sections.agenda.items} /> : null}
            {tab === 'officers' ? <OfficersPanel /> : null}
            {tab === 'organizations' ? <Organizations /> : null}
            {tab === 'structure' ? <StructurePanel /> : null}
            {tab === 'advisers' ? <AdvisersPanel /> : null}
            {tab === 'commissions' ? <CommissionsPanel /> : null}
            {tab === 'gallery' ? <GalleryPanel /> : null}
          </div>
        </section>
      </main>
    </>
  )
}

function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>, tab: TabId, setTab: (id: TabId) => void) {
  const index = tabs.findIndex((item) => item.id === tab)
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
  setTab(next.id)
  document.getElementById(`council-tab-${next.id}`)?.focus()
  scrollTabIntoView(next.id)
}

function scrollTabIntoView(id: string) {
  const el = document.getElementById(`council-tab-${id}`)
  const list = el?.parentElement
  if (!el || !list) return
  const left = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2
  list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
}

const requestSteps: { title: string; detail: string; icon: LucideIcon }[] = [
  {
    title: 'Submit the request',
    detail: 'A tracking ID is sent to the email you entered.',
    icon: Mail,
  },
  {
    title: 'Acknowledgement',
    detail: 'The Council replies within 24 to 48 hours of receipt.',
    icon: Clock,
  },
  {
    title: 'Confidential review',
    detail: 'Grievances and personal inquiries stay with authorized Executive Officers.',
    icon: ShieldCheck,
  },
  {
    title: 'Reply',
    detail: 'Updates are sent back to that same email.',
    icon: MailCheck,
  },
]

type CouncilProjectLink = { label: string; to: string; icon: LucideIcon }

/** Shown until the projects API responds (or if it is unreachable). */
const councilProjectsFallback: CouncilProjectLink[] = [
  { label: 'Board Meetings', to: '/projects/board-meetings', icon: CalendarCheck },
  { label: 'Lex in Motion', to: '/projects/lex-in-motion', icon: Megaphone },
  { label: 'Free Printing Service', to: '/projects/free-printing', icon: Printer },
  { label: 'WiFi Library', to: '/projects/wifi-library', icon: Wifi },
  { label: 'Online Study Hub', to: '/projects/online-study-hub', icon: BookOpen },
  { label: 'JD Buddies', to: '/projects/jd-buddies', icon: Users },
]

const directory: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Student Services Portal', to: '/portal', icon: LifeBuoy },
  { label: 'Announcements', to: '/announcements', icon: Megaphone },
  { label: 'Student Handbook', to: studentHandbookUrl, icon: BookMarked },
  { label: 'Legislative', to: '/governance/legislative', icon: Scale },
  { label: 'Executive', to: '/governance/executive', icon: Gavel },
  { label: 'Contact', to: '/#contact', icon: Mail },
]

const overviewPoints: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Landmark,
    title: 'Governing body',
    text: 'The highest body representing students of the College of Law.',
  },
  {
    icon: Megaphone,
    title: 'Primary voice',
    text: 'Speaks for law students in administrative and academic affairs.',
  },
  {
    icon: ShieldCheck,
    title: 'Student welfare',
    text: 'Formulates policies that protect their rights and interests.',
  },
]

function OverviewPanel() {
  const reduce = useReducedMotion() === true
  const viewport = useRevealViewport()
  const siteContact = useSiteContact()
  const [councilProjects, setCouncilProjects] =
    useState<CouncilProjectLink[]>(councilProjectsFallback)

  useEffect(() => {
    let cancelled = false
    void listProjects().then((result) => {
      if (cancelled || !result.ok || result.data.items.length === 0) return
      setCouncilProjects(
        result.data.items.map((item) => {
          const project = mapProjectRecord(item)
          return { label: project.label, to: `/projects/${project.slug}`, icon: project.icon }
        }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <Reveal>
        <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-10">
          <div className="flex flex-col justify-center">
            <header className="flex flex-col items-start text-left">
              <SectionKicker icon={Landmark}>Overview</SectionKicker>
              <h2
                id="overview-title"
                className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
              >
                The Governing Body of <span className="text-brand-600">Law Students</span>
              </h2>
            </header>
            <div className="mt-5 space-y-3 text-left text-[15px] leading-7 text-zinc-600">
              <p>
                The {siteName.short} {siteName.unit} is the highest governing body representing students
                of the College of Law. It is their primary voice in administrative and academic affairs,
                and it formulates policies that protect their welfare, rights, and interests.
              </p>
              <p>
                That charge is set out in the Council’s mission and vision: to unite the studentry,
                uphold their democratic rights, and work toward the common good, justice, and the rule
                of law.
              </p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:flex lg:h-full lg:flex-col">
            {overviewPoints.map((point) => (
              <li
                key={point.title}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5"
              >
                <IconTile icon={point.icon} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-brand-950">{point.title}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-zinc-500">{point.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <header className="mx-auto mt-10 flex max-w-3xl flex-col items-center text-center">
          <Eyebrow icon={ShieldCheck}>Evolution</Eyebrow>
          <h2
            id="seals-title"
            className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
          >
            Evolution of the <span className="text-brand-600">COLSC</span> seals
          </h2>
        </header>
        <ul aria-labelledby="seals-title" className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {seals.map((seal, index) => (
            <li
              key={seal.label}
              className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white px-3 py-4 text-center"
            >
              <img
                src={seal.src}
                alt=""
                width={80}
                height={80}
                className="size-16 rounded-full border border-zinc-200 bg-white object-contain p-0.5 sm:size-[4.5rem]"
              />
              <p className="mt-3 text-[10px] font-semibold tracking-[0.14em] text-brand-700 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-1 text-sm leading-5 font-semibold text-balance text-brand-950">{seal.label}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>

    <section aria-labelledby="desk-title" className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="desk-title"
            icon={LifeBuoy}
            kicker="Help desk"
            title={
              <>
                How a Request <span className="text-brand-600">Moves</span>
              </>
            }
            text="The path used in the Student Services Portal, from the first email to the reply."
          />
        </Reveal>
        <motion.ol
          initial={reduce ? false : 'hidden'}
          whileInView="show"
          viewport={viewport}
          variants={stagger}
          className="mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {requestSteps.map((step, index) => (
            <motion.li key={step.title} variants={fadeUp}>
              <article className="h-full rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <IconTile icon={step.icon} />
                  <span className="font-hero text-2xl leading-none text-brand-200">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-brand-950">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-zinc-500">{step.detail}</p>
              </article>
            </motion.li>
          ))}
        </motion.ol>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="h-12 rounded-xl px-6">
            <Link to="/portal">
              Open the portal
              <ChevronsRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>

    <section aria-labelledby="projects-title" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="projects-title"
            icon={CalendarCheck}
            kicker="In action"
            title={
              <>
                Projects and <span className="text-brand-600">Initiatives</span>
              </>
            }
            text="Programs the Student Council runs for law students."
          />
        </Reveal>
        <ul className="mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {councilProjects.map((project) => (
            <li key={project.to}>
              <Link
                to={project.to}
                className="group flex h-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_16px_32px_-24px_rgba(30,5,65,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <IconTile icon={project.icon} />
                <span className="min-w-0 flex-1 text-sm font-semibold text-brand-950">{project.label}</span>
                <ChevronsRight
                  className="size-4 shrink-0 text-brand-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section aria-labelledby="directory-title" className="bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8">
        <Reveal>
          <div className="relative h-full overflow-hidden rounded-2xl bg-brand-950 p-6 text-white sm:p-8">
            <WavePattern />
            <p className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-gold-300 uppercase">
              <MapPin className="size-3.5" aria-hidden />
              Office
            </p>
            <h2
              id="directory-title"
              className="relative mt-4 font-hero text-[clamp(1.85rem,1rem+2vw,3rem)] leading-[0.95] font-normal tracking-tight"
            >
              Find the Council
            </h2>
            <ul className="relative mt-6 space-y-4">
              <li className="flex gap-3 text-sm leading-6 text-white/80">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
                <span>{siteContact.address}</span>
              </li>
              <li className="flex gap-3 text-sm leading-6 text-white/80">
                <Clock className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
                <span>{siteContact.hours}</span>
              </li>
              <li className="flex gap-3 text-sm leading-6 text-white/80">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
                <span>
                  Established {siteName.established}. {siteContact.secRegistration}
                </span>
              </li>
            </ul>
            <Button asChild variant="gold" size="lg" className="relative mt-8 h-12 rounded-xl px-6">
              <Link to="/#contact">
                Contact us
                <ChevronsRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <nav aria-label="Related pages" className="h-full rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <Eyebrow icon={BookMarked}>Directory</Eyebrow>
            <ul className="mt-5 grid gap-1 sm:grid-cols-2">
              {directory.map((item) => {
                const className =
                  'group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
                const body = (
                  <>
                    <IconTile icon={item.icon} />
                    <span className="min-w-0 flex-1 text-sm font-medium text-zinc-800 group-hover:text-brand-800">
                      {item.label}
                    </span>
                    <ChevronsRight className="size-4 shrink-0 text-brand-300 group-hover:text-brand-700" aria-hidden />
                  </>
                )

                return (
                  <li key={item.to}>
                    {isExternalNavTo(item.to) ? (
                      <a
                        href={item.to}
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
    </>
  )
}

function GalleryPanel() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [year, setYear] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const shot = open === null ? null : photos[open]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void listPublicGallery().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setPhotos([])
        setYear(null)
        setError(result.error)
        setLoading(false)
        return
      }
      setPhotos(result.data.images.map(toGalleryPhoto))
      setYear(result.data.academicYear)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (open === null || photos.length === 0) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
      if (event.key === 'ArrowRight') {
        setOpen((index) => (index === null ? index : (index + 1) % photos.length))
      }
      if (event.key === 'ArrowLeft') {
        setOpen((index) =>
          index === null ? index : (index - 1 + photos.length) % photos.length,
        )
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setPageScrollLocked(true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      setPageScrollLocked(false)
    }
  }, [open, photos.length])

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionKicker icon={Images}>
            {year ? `Gallery · A.Y. ${year}` : 'Gallery'}
          </SectionKicker>
          <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
            Council <span className="text-brand-600">Photographs</span>
          </h2>
        </div>
        <p className="text-sm font-medium text-zinc-500">
          {loading ? 'Loading…' : `${photos.length} photograph${photos.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {loading ? (
        <div className="mt-16 flex items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading gallery…
        </div>
      ) : null}
      {!loading && error ? (
        <p className="mt-16 text-center text-sm text-zinc-500">{error}</p>
      ) : null}
      {!loading && !error && photos.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-500">
          No photographs published for the public academic year.
        </p>
      ) : null}

      {!loading && !error && photos.length > 0 ? (
        <ul
          className={cn(
            'mt-8 grid grid-cols-2 gap-3',
            photos.length === 6
              ? 'lg:grid-cols-6 lg:grid-rows-[13.5rem_13.5rem_15rem]'
              : 'sm:grid-cols-3 lg:grid-cols-4',
          )}
        >
          {photos.map((photo, index) => (
            <li
              key={`${photo.src}-${index}`}
              className={
                photos.length === 6
                  ? (galleryLayout[index] ?? galleryLayout[galleryLayout.length - 1])
                  : index === 0
                    ? 'col-span-2 min-h-64 sm:col-span-2 lg:col-span-2 lg:min-h-72'
                    : 'min-h-44'
              }
            >
              <GalleryCard photo={photo} featured={index === 0} onOpen={() => setOpen(index)} />
            </li>
          ))}
        </ul>
      ) : null}

      {shot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-brand-950/80"
            aria-label="Close photograph"
            onClick={() => setOpen(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={shot.alt}
            className="relative flex w-full max-w-5xl flex-col items-center"
          >
            <div className="w-fit max-w-full overflow-hidden rounded-2xl bg-zinc-950">
              <div className="relative">
                <img
                  src={shot.src}
                  alt={shot.alt}
                  width={2400}
                  height={1600}
                  className="block h-auto max-h-[70vh] w-auto max-w-full"
                />
                <button
                  type="button"
                  className="absolute top-3 right-3 hidden h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-brand-950 shadow-[0_10px_24px_-12px_rgba(8,0,24,0.9)] ring-1 ring-black/10 sm:inline-flex"
                  aria-label="Close"
                  onClick={() => setOpen(null)}
                >
                  <X className="size-4" aria-hidden />
                  Close
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-xl bg-transparent text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:bg-white sm:text-brand-950 sm:shadow-[0_10px_24px_-12px_rgba(8,0,24,0.9)] sm:ring-1 sm:ring-black/10 sm:drop-shadow-none"
                  aria-label="Previous photograph"
                  onClick={() =>
                    setOpen((index) =>
                      index === null ? 0 : (index - 1 + photos.length) % photos.length,
                    )
                  }
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-xl bg-transparent text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:bg-brand-700 sm:shadow-[0_10px_24px_-12px_rgba(8,0,24,0.9)] sm:drop-shadow-none"
                  aria-label="Next photograph"
                  onClick={() =>
                    setOpen((index) => (index === null ? 0 : (index + 1) % photos.length))
                  }
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
              <div className="flex items-end justify-between gap-4 px-4 py-3 text-white">
                <p className="min-w-0">
                  <span className="block text-sm font-semibold">{shot.title}</span>
                  <span className="mt-0.5 block text-xs tracking-[0.12em] text-white/70 uppercase">
                    {shot.caption}
                  </span>
                </p>
                <p className="shrink-0 text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">
                  {String((open ?? 0) + 1).padStart(2, '0')} /{' '}
                  {String(photos.length).padStart(2, '0')}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const galleryLayout = [
  'col-span-2 min-h-64 lg:col-span-4 lg:row-span-2 lg:min-h-0',
  'min-h-40 lg:col-span-2 lg:min-h-0',
  'min-h-40 lg:col-span-2 lg:min-h-0',
  'min-h-40 lg:col-span-2 lg:min-h-0',
  'min-h-40 lg:col-span-2 lg:min-h-0',
  'col-span-2 min-h-48 lg:col-span-2 lg:min-h-0',
]

function GalleryCard({
  photo,
  featured = false,
  onOpen,
}: {
  photo: GalleryPhoto
  featured?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-full w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <img
        src={photo.src}
        alt={photo.alt}
        width={2400}
        height={1600}
        className="absolute inset-0 size-full object-cover object-[center_30%] transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-950 via-brand-950/55 to-transparent px-3 pt-12 pb-3 sm:px-4 sm:pb-4">
        <span className={cn('block leading-none text-white', featured ? 'font-hero text-2xl sm:text-3xl' : 'text-sm font-semibold')}>
          {photo.title}
        </span>
        <span className="mt-1.5 block text-[11px] font-medium tracking-[0.14em] text-gold-300 uppercase">
          {photo.caption}
        </span>
      </span>
    </button>
  )
}

function Eyebrow({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <SectionKicker icon={icon}>{children}</SectionKicker>
}

function SectionHeading({
  id,
  icon,
  kicker,
  title,
  text,
}: {
  id: string
  icon: LucideIcon
  kicker: string
  title: ReactNode
  text: string
}) {
  return (
    <header className="mx-auto max-w-3xl text-center">
      <Eyebrow icon={icon}>{kicker}</Eyebrow>
      <h2
        id={id}
        className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
      >
        {title}
      </h2>
      <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
        {text}
      </p>
    </header>
  )
}

function WavePattern() {
  return (
    <svg
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-3/5 w-full opacity-20"
      viewBox="0 0 220 140"
      fill="none"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 8 }, (_, index) => {
        const y = 24 + index * 14
        return (
          <path
            key={index}
            d={`M-10 ${y} C 50 ${y - 22}, 120 ${y + 30}, 230 ${y - 8}`}
            stroke="white"
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

function ValuesPanel({
  mission,
  vision,
  values,
}: {
  mission: string
  vision: string
  values: AboutListItem[]
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <SectionKicker icon={Scale}>Constitution</SectionKicker>
      <h2 className="mt-4 max-w-3xl font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
        Mission, Vision, and <span className="text-brand-600">Core Values</span>
      </h2>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <Statement icon={Scale} title="Mission" text={mission} className="rounded-2xl border border-zinc-200" />
        <Statement icon={Eye} title="Vision" text={vision} className="rounded-2xl border border-zinc-200" />
      </div>

      <h3 className="mt-12 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
        Council constitutional core values
      </h3>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {values.map((value, index) => (
          <li key={`${value.title}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <IconTile icon={aboutIcon(value.icon)} />
              <span className="font-hero text-2xl leading-none text-brand-200">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-brand-950">{value.title}</h3>
            <RichTextContent html={value.text} className="mt-2 text-sm leading-6 text-zinc-600" />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Statement({
  icon: Icon,
  title,
  text,
  className,
}: {
  icon: LucideIcon
  title: string
  text: string
  className?: string
}) {
  return (
    <article className={cn('p-5 sm:p-6', className)}>
      <div className="flex items-center gap-3">
        <IconTile icon={Icon} />
        <h3 className="font-hero text-[clamp(1.6rem,1.2rem+0.8vw,2rem)] leading-none font-normal tracking-tight text-brand-950">
          {title}
        </h3>
      </div>
      <RichTextContent html={text} className="mt-4 text-[15px] leading-7 text-zinc-600" />
    </article>
  )
}

function HistoryPanel({ items }: { items: AboutHistoryItem[] }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <SectionKicker icon={Landmark}>History</SectionKicker>
        <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.6vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          Council <span className="text-brand-600">History</span>
        </h2>
        <p className="mt-4 text-[15px] leading-7 text-zinc-600">
          From the opening of the College of Law to the Council on the public register.
        </p>
      </header>

      <ol className="mt-8 grid w-full gap-3">
        {items.map((item, index) => (
          <li key={`${item.when}-${index}`}>
            <article className="rounded-2xl border border-zinc-200 bg-white p-4 sm:grid sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start sm:gap-6 sm:p-5">
              <p className="font-hero text-xl leading-none text-brand-600 sm:pt-0.5">{item.when}</p>
              <div className="mt-3 min-w-0 sm:mt-0">
                <h3 className="text-sm font-semibold text-brand-950">{item.title}</h3>
                <RichTextContent html={item.text} className="mt-2 text-sm leading-6 text-zinc-600" />
                {item.note ? (
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                    {item.note}
                  </p>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ol>
      <p className="mt-4 w-full text-xs leading-5 text-zinc-400">
        College dates are from the{' '}
        <a
          href="https://www.pup.edu.ph/cl/history"
          className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2"
        >
          PUP College of Law history
        </a>
        . The 2008 oath is from the account of that oath-taking.
      </p>
    </div>
  )
}

function MandatePanel({ items }: { items: AboutListItem[] }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <header>
        <SectionKicker icon={Gavel}>Mandate</SectionKicker>
        <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          Student Council <span className="text-brand-600">In Action</span>
        </h2>
      </header>
      <ul className="mt-8 grid gap-3 lg:grid-cols-2">
        {items.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5"
          >
            <IconTile icon={aboutIcon(item.icon)} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-brand-950">{item.title}</h3>
              <RichTextContent html={item.text} className="mt-2 text-sm leading-6 text-zinc-600" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GoalsPanel({ goals }: { goals: AboutListItem[] }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionKicker icon={Target}>Term goals</SectionKicker>
          <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
            What This Term <span className="text-brand-600">Sets Out to Do</span>
          </h2>
        </div>
        <p className="text-sm font-medium text-zinc-500">{goals.length} goals</p>
      </div>

      <ol className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {goals.map((goal, index) => (
          <li
            key={`${goal.title}-${index}`}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-zinc-100 px-4 py-4 last:border-b-0 sm:px-5 sm:py-5 lg:grid-cols-[2.5rem_minmax(12rem,16rem)_minmax(0,1fr)] lg:items-start lg:gap-4"
          >
            <p className="pt-1 font-hero text-xl leading-none text-brand-300 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={aboutIcon(goal.icon)} />
              <h3 className="min-w-0 text-sm leading-5 font-semibold text-brand-950">{goal.title}</h3>
            </div>
            <RichTextContent
              html={goal.text}
              className="col-start-2 text-sm leading-6 text-zinc-600 lg:col-start-3 lg:pt-1.5"
            />
          </li>
        ))}
      </ol>
    </div>
  )
}

function AgendaPanel({ items }: { items: AboutListItem[] }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <header>
        <SectionKicker icon={Flag}>Term agenda</SectionKicker>
        <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          PUP COL Student Council <span className="text-brand-600">Term agenda</span>
        </h2>
      </header>
      <ul className="mt-8 grid gap-3 lg:grid-cols-2">
        {items.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5"
          >
            <IconTile icon={aboutIcon(item.icon)} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-brand-950">{item.title}</h3>
              <RichTextContent html={item.text} className="mt-2 text-sm leading-6 text-zinc-600" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Seat = {
  role: string
  name: string
  vacant?: boolean
  photo?: string
}

function RosterLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Loading roster…
    </div>
  )
}

function RosterEmpty({ message }: { message: string }) {
  return <p className="py-16 text-center text-sm text-zinc-500">{message}</p>
}

function OfficersPanel() {
  const { year, loading, error, bySection } = useCouncilBoard('officers')
  const executive = bySection('executive')
  const yearReps = bySection('year_reps')
  const associates = bySection('associates')
  const [president, ...board] = executive

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading
        icon={Users}
        kicker={councilYearKicker('Officers', year)}
        title={
          <>
            Executive <span className="text-brand-600">Board</span>
          </>
        }
      />
      {loading ? <RosterLoading /> : null}
      {!loading && error ? <RosterEmpty message={error} /> : null}
      {!loading && !error && !president ? (
        <RosterEmpty message="No officers published for the public academic year." />
      ) : null}
      {!loading && !error && president ? (
        <>
          <div className="mx-auto mt-10 max-w-2xl">
            <SeatCard seat={president} featured />
          </div>
          {board.length > 0 ? (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {board.map((seat) => (
                <li key={`${seat.role}-${seat.name}`}>
                  <SeatCard seat={seat} />
                </li>
              ))}
            </ul>
          ) : null}

          {yearReps.length > 0 ? (
            <>
              <RosterBand label="Year Level Representatives" />
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <RosterBand label="Associates" />
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {associates.map((seat) => (
                  <li key={`${seat.role}-${seat.name}`}>
                    <SeatCard seat={seat} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function StructurePanel() {
  const officers = useCouncilBoard('officers')
  const advisory = useCouncilBoard('advisory')
  const loading = officers.loading || advisory.loading
  const error = officers.error || advisory.error
  const executive = officers.bySection('executive')
  const yearReps = officers.bySection('year_reps')
  const associates = officers.bySection('associates')
  const advisorySeats = advisory.bySection('advisory')
  const [dean, ...facultyAdvisers] = advisorySeats
  const president = executive[0]
  const lineOfficers = executive.slice(1, 4)
  const staffOfficers = executive.slice(4)
  const structureYear = officers.year ?? advisory.year

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading
        icon={Network}
        kicker={councilYearKicker('Structure', structureYear)}
        title={
          <>
            Organization <span className="text-brand-600">Chart</span>
          </>
        }
      />
      {loading ? <RosterLoading /> : null}
      {!loading && error ? <RosterEmpty message={error} /> : null}
      {!loading && !error && !dean && !president ? (
        <RosterEmpty message="No organization chart data published yet." />
      ) : null}
      {!loading && !error && (dean || president) ? (
        <>
          <div className="mt-8 flex flex-col items-center [&>:first-child]:mt-0 lg:hidden">
            {dean ? (
              <>
                <ChartBand label="Advisory Board" />
                <div className="w-full max-w-sm">
                  <OrgNode seat={dean} lead compact />
                </div>
                {facultyAdvisers.length > 0 ? (
                  <MobileRow people={facultyAdvisers} grouped />
                ) : null}
              </>
            ) : null}
            {president ? (
              <>
                <ChartBand label="Executive Board" />
                <div className="w-full max-w-sm">
                  <OrgNode seat={president} lead compact />
                </div>
                {lineOfficers.length > 0 ? <MobileRow people={lineOfficers} /> : null}
                {staffOfficers.length > 0 ? <MobileRow people={staffOfficers} /> : null}
              </>
            ) : null}
            {yearReps.length > 0 ? (
              <>
                <ChartBand label="Year level representatives" />
                <MobileRow people={yearReps} grouped />
              </>
            ) : null}
            {associates.length > 0 ? (
              <>
                <ChartBand label="Associates" />
                <MobileRow people={associates} grouped />
              </>
            ) : null}
          </div>

          <div className="mt-8 hidden w-full overflow-x-auto lg:block">
            <div className="mx-auto flex w-max min-w-full flex-col items-center py-2 [&>:first-child]:mt-0">
              {dean ? (
                <>
                  <ChartBand label="Advisory Board" />
                  <OrgRow people={[dean]} root />
                  {facultyAdvisers.length > 0 ? <OrgRow people={facultyAdvisers} /> : null}
                </>
              ) : null}
              {president ? (
                <>
                  <ChartBand label="Executive Board" />
                  <OrgRow people={[president]} />
                  {lineOfficers.length > 0 ? <OrgRow people={lineOfficers} /> : null}
                  {staffOfficers.length > 0 ? <OrgRow people={staffOfficers} /> : null}
                </>
              ) : null}
              {yearReps.length > 0 ? (
                <>
                  <ChartBand label="Year level representatives" />
                  <OrgRow people={yearReps} />
                </>
              ) : null}
              {associates.length > 0 ? (
                <>
                  <ChartBand label="Associates" />
                  <OrgRow people={associates} />
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function ChartBand({ label }: { label: string }) {
  return (
    <div className="mt-8 flex w-full items-center gap-4 lg:mt-10 lg:max-w-3xl">
      <span className="h-px flex-1 bg-brand-200" aria-hidden />
      <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{label}</p>
      <span className="h-px flex-1 bg-brand-200" aria-hidden />
    </div>
  )
}

function AdvisersPanel() {
  const { year, loading, error, bySection } = useCouncilBoard('advisory')
  const seats = bySection('advisory')
  const [dean, ...faculty] = seats

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading
        icon={GraduationCap}
        kicker={councilYearKicker('Advisory Board', year)}
        title={
          <>
            Faculty <span className="text-brand-600">Advisory Board</span>
          </>
        }
      />
      {loading ? <RosterLoading /> : null}
      {!loading && error ? <RosterEmpty message={error} /> : null}
      {!loading && !error && !dean ? (
        <RosterEmpty message="No advisers published for the public academic year." />
      ) : null}
      {!loading && !error && dean ? (
        <>
          <div className="mx-auto mt-10 max-w-2xl">
            <SeatCard seat={dean} featured />
          </div>
          {faculty.length > 0 ? (
            <>
              <RosterBand label="Lead Faculty Advisers" />
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {faculty.map((seat) => (
                  <li key={`${seat.role}-${seat.name}`}>
                    <SeatCard seat={seat} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function CommissionsPanel() {
  const { year, loading, error, bySection } = useCouncilBoard('commissioners')
  const seats = bySection('commission')
  const [chair, ...members] = seats

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading
        icon={Scale}
        kicker={councilYearKicker('Commissions', year)}
        title={
          <>
            Commission on <span className="text-brand-600">Appointments</span>
          </>
        }
      />
      {loading ? <RosterLoading /> : null}
      {!loading && error ? <RosterEmpty message={error} /> : null}
      {!loading && !error && !chair ? (
        <RosterEmpty message="No commissioners published for the public academic year." />
      ) : null}
      {!loading && !error && chair ? (
        <>
          <div className="mx-auto mt-10 max-w-2xl">
            <SeatCard seat={chair} featured />
          </div>
          {members.length > 0 ? (
            <>
              <RosterBand label="Commissioners" />
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((seat) => (
                  <li key={`${seat.role}-${seat.name}`}>
                    <SeatCard seat={seat} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function RosterBand({ label }: { label: string }) {
  return (
    <div className="mt-12 flex w-full items-center gap-4">
      <span className="h-px flex-1 bg-brand-200" aria-hidden />
      <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{label}</p>
      <span className="h-px flex-1 bg-brand-200" aria-hidden />
    </div>
  )
}

function RosterHeading({ icon: Icon, kicker, title }: { icon: LucideIcon; kicker: string; title: ReactNode }) {
  return (
    <header>
      <SectionKicker icon={Icon}>{kicker}</SectionKicker>
      <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
        {title}
      </h2>
    </header>
  )
}

function Mark({
  src,
  prominent = false,
  muted = false,
  dense = false,
}: {
  src?: string
  prominent?: boolean
  muted?: boolean
  dense?: boolean
}) {
  const photo = Boolean(src) && !muted
  return (
    <img
      src={photo ? src : studentCouncil}
      alt=""
      width={80}
      height={80}
      className={cn(
        'shrink-0 bg-white',
        photo ? 'object-cover object-[center_18%]' : 'rounded-full object-contain p-1',
        dense ? 'size-11' : prominent ? 'size-16' : 'size-14',
        photo ? 'rounded-xl' : 'rounded-full',
        'border border-zinc-200',
        prominent && 'ring-2 ring-gold-400',
        muted && 'border-dashed opacity-40',
      )}
    />
  )
}

function SeatCard({ seat, featured = false }: { seat: Seat; featured?: boolean }) {
  const photo = Boolean(seat.photo) && !seat.vacant

  return (
    <article
      className={cn(
        'flex h-full items-center rounded-2xl border bg-white',
        seat.vacant ? 'border-dashed border-zinc-300' : 'border-zinc-200',
        featured
          ? 'gap-5 border-brand-200 p-5 shadow-[0_16px_36px_-28px_rgba(30,5,65,0.45)] sm:gap-6 sm:p-6'
          : 'gap-4 p-4 sm:gap-5 sm:p-5',
      )}
    >
      <img
        src={photo ? seat.photo : studentCouncil}
        alt=""
        width={featured ? 112 : 88}
        height={featured ? 112 : 88}
        className={cn(
          'shrink-0 bg-white',
          photo ? 'object-cover object-[center_18%]' : 'rounded-full object-contain p-1.5',
          featured ? 'size-24 sm:size-28' : 'size-20 sm:size-[5.5rem]',
          photo ? 'rounded-2xl' : 'rounded-full',
          'border border-zinc-200',
          featured && 'ring-2 ring-gold-400',
          seat.vacant && 'border-dashed opacity-40',
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            'font-semibold tracking-[0.12em] text-brand-700 uppercase',
            featured ? 'text-xs leading-4' : 'text-[11px] leading-4',
          )}
        >
          {seat.role}
        </p>
        <p
          className={cn(
            'mt-1.5 font-semibold break-words text-brand-950',
            featured ? 'text-lg leading-snug sm:text-xl' : 'text-[15px] leading-snug sm:text-base',
          )}
        >
          {seat.name}
        </p>
      </div>
    </article>
  )
}

function OrgRow({ people, root = false }: { people: Seat[]; root?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      {root ? null : <span className="h-6 w-px bg-brand-200" aria-hidden />}
      <ul className="relative flex justify-center">
        {people.length > 1 ? (
          <span aria-hidden className="absolute top-0 h-px bg-brand-200" style={{ left: '7rem', right: '7rem' }} />
        ) : null}
        {people.map((person) => (
          <li key={`${person.role}-${person.name}`} className="flex w-56 flex-col items-center px-2">
            {root ? null : <span className="h-5 w-px bg-brand-200" aria-hidden />}
            <OrgNode seat={person} lead={person.role === 'President'} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function MobileRow({ people, grouped = false }: { people: Seat[]; grouped?: boolean }) {
  const columns = people.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
  const oddLast = people.length % 2 === 1 && people.length !== 3

  return (
    <div className="flex w-full flex-col items-center">
      {grouped ? null : <span className="h-4 w-px bg-brand-200" aria-hidden />}
      {grouped ? null : (
        <span
          className={cn('h-px bg-brand-200', people.length === 3 ? 'w-2/3' : 'w-1/2')}
          aria-hidden
        />
      )}
      <ul className={cn('mt-3 grid w-full gap-2', columns, grouped && 'mt-4')}>
        {people.map((person, index) => {
          const center = oddLast && index === people.length - 1
          return (
            <li key={`${person.role}-${person.name}`} className={cn('flex flex-col items-center', center && 'col-span-2')}>
              {grouped ? null : <span className="mb-2 h-3 w-px bg-brand-200" aria-hidden />}
              <div className={cn('w-full', center && 'w-1/2')}>
                <OrgChip seat={person} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function OrgChip({ seat }: { seat: Seat }) {
  return (
    <article
      className={cn(
        'flex h-full flex-col items-center rounded-2xl border bg-white px-2 py-3 text-center',
        seat.vacant ? 'border-dashed border-zinc-300' : 'border-zinc-200',
      )}
    >
      <Mark src={seat.photo} dense muted={seat.vacant} />
      <p className="mt-2 text-[10px] leading-3 font-semibold tracking-[0.08em] text-brand-700 uppercase">{seat.role}</p>
      <p className="mt-1 text-xs leading-4 font-semibold text-balance break-words text-brand-950">{seat.name}</p>
    </article>
  )
}

function OrgNode({ seat, lead = false, compact = false }: { seat: Seat; lead?: boolean; compact?: boolean }) {
  if (compact) return <SeatCard seat={seat} featured={lead} />

  return (
    <article
      className={cn(
        'flex w-full flex-col items-center rounded-2xl border bg-white px-3 py-4 text-center',
        seat.vacant ? 'border-dashed border-zinc-300' : 'border-zinc-200',
        lead && 'border-brand-200',
      )}
    >
      <Mark src={seat.photo} prominent={lead} muted={seat.vacant} />
      <p className="mt-3 text-[11px] leading-4 font-semibold tracking-[0.12em] text-brand-700 uppercase">{seat.role}</p>
      <p className="mt-1 text-sm leading-5 font-semibold text-balance break-words text-brand-950">{seat.name}</p>
    </article>
  )
}

function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-white dark:bg-[#07070b]">
      <div className="hero-wash absolute inset-0 bg-white" />
      <div className="absolute bottom-0 left-1/2 h-[14rem] w-[min(36rem,80%)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_80%,rgba(255,186,160,0.28)_0%,rgba(255,214,200,0.12)_42%,transparent_72%)] blur-3xl dark:bg-[radial-gradient(circle_at_50%_20%,rgba(138,60,245,0.28)_0%,transparent_70%)]" />
    </div>
  )
}

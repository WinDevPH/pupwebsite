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
  Globe,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Images,
  Landmark,
  LifeBuoy,
  Mail,
  MailCheck,
  MapPin,
  Megaphone,
  MessagesSquare,
  Network,
  Printer,
  Radio,
  Scale,
  ScrollText,
  ShieldCheck,
  Target,
  Users,
  Wifi,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import councilCandid from '@/assets/council/groups/council-candid.jpg'
import councilFormal from '@/assets/council/groups/council-formal.jpg'
import councilPolo from '@/assets/council/groups/council-polo.jpg'
import councilPoloCircle from '@/assets/council/groups/council-polo-circle.jpg'
import officersFormal from '@/assets/council/groups/officers-formal.jpg'
import officersPolo from '@/assets/council/groups/officers-polo.jpg'
import biato from '@/assets/council/people/biato.jpg'
import briones from '@/assets/council/people/briones.jpg'
import cuyugan from '@/assets/council/people/cuyugan.jpg'
import deLeon from '@/assets/council/people/de-leon.jpg'
import festin from '@/assets/council/people/festin.jpg'
import guadana from '@/assets/council/people/guadana.jpg'
import orante from '@/assets/council/people/orante.jpg'
import pago from '@/assets/council/people/pago.jpg'
import ramos from '@/assets/council/people/ramos.jpg'
import rana from '@/assets/council/people/rana.jpg'
import salazar from '@/assets/council/people/salazar.jpg'
import sanchez from '@/assets/council/people/sanchez.jpg'
import santos from '@/assets/council/people/santos.jpg'
import sarabia from '@/assets/council/people/sarabia.jpg'
import tercero from '@/assets/council/people/tercero.jpg'
import toribio from '@/assets/council/people/toribio.jpg'
import velasco from '@/assets/council/people/velasco.jpg'
import collegeOfLaw from '@/assets/logos/college-of-law.jpg'
import lawStudentsSociety from '@/assets/logos/law-students-society.jpg'
import studentCouncil from '@/assets/logos/student-council.png'
import studentCouncilMark from '@/assets/logos/student-council-mark.jpg'
import { contact, siteName } from '@/components/layout/nav-data'
import { Reveal, useRevealViewport } from '@/components/motion/Reveal'
import { Button } from '@/components/ui/button'
import { fadeUp, stagger } from '@/lib/motion'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { cn } from '@/lib/utils'

const seals = [
  { src: collegeOfLaw, label: 'College of Law' },
  { src: studentCouncilMark, label: 'Previous Student Council' },
  { src: lawStudentsSociety, label: 'Law Students Society' },
  { src: studentCouncil, label: 'Student Council' },
]

const galleryPhotos = [
  {
    src: councilFormal,
    title: 'The Student Council',
    caption: 'Formal portrait',
    alt: 'Members of the PUP College of Law Student Council',
  },
  {
    src: councilCandid,
    title: 'The Student Council',
    caption: 'Together',
    alt: 'PUP College of Law Student Council in formal attire',
  },
  {
    src: officersFormal,
    title: 'Officers',
    caption: 'Formal portrait',
    alt: 'Officers of the PUP College of Law Student Council',
  },
  {
    src: councilPolo,
    title: 'The Student Council',
    caption: 'College shirts',
    alt: 'PUP College of Law Student Council in college shirts',
  },
  {
    src: officersPolo,
    title: 'Officers',
    caption: 'College shirts',
    alt: 'Officers of the PUP College of Law Student Council in college shirts',
  },
  {
    src: councilPoloCircle,
    title: 'The Student Council',
    caption: 'Circle',
    alt: 'PUP College of Law Student Council gathered together',
  },
]

const mission =
  'The PUP College of Law Student Council, in cognizance of its vision, commits itself to act as the unifying and motivating force among the law studentry and student activities related to them. Its focus is to promote the welfare of the law students in line with the mission-vision of the Polytechnic University of the Philippines. Among others, it shall be the forefront in protecting and upholding the democratic rights and welfare of the students, maintaining institutional integrity, and serving as the primary representation of all law students in administrative and academic affairs.'

const vision =
  'The PUP College of Law Student Council envisions itself as the premier law student government of the Polytechnic University of the Philippines which unites, empowers, and motivates the student body toward the realization of their legal and professional goals, working toward the common good, justice, and the rule of law in the spirit of dedicated service.'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'mandate', label: 'Mandate' },
  { id: 'values', label: 'Mission & values' },
  { id: 'goals', label: 'Goals' },
  { id: 'agenda', label: 'Term agenda' },
  { id: 'officers', label: 'Officers' },
  { id: 'structure', label: 'Structure' },
  { id: 'advisers', label: 'Advisers' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'gallery', label: 'Gallery' },
] as const

type TabId = (typeof tabs)[number]['id']

const termGoals: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessagesSquare,
    title: 'Participatory Governance',
    text: 'To establish digital avenues, online helpdesks, and feedback networks where law students can easily stay updated on council activities, raise concerns, and suggest improvements.',
  },
  {
    icon: CalendarCheck,
    title: 'Ease of Doing Student Activities',
    text: 'To streamline administrative processes and recommend efficient requirements, enabling local law student organizations and committees to execute academic and extracurricular events expeditiously.',
  },
  {
    icon: Workflow,
    title: 'Efficient and Effective Internal Organization',
    text: 'To establish necessary administrative committees, streamline internal council protocols, and harmonize the functions of the Student Council with class beadles and recognized organizations.',
  },
  {
    icon: Scale,
    title: 'Genuine Student Representation',
    text: 'To champion law student rights to due process and equal protection, expedite the adoption of student-centric policies, and ensure inclusive transparency in administrative and academic affairs.',
  },
  {
    icon: GraduationCap,
    title: 'Academic & Welfare Transition Support',
    text: "To implement projects, masterclasses, and resource drives that address law students' academic pressures and schedule transitions.",
  },
  {
    icon: Handshake,
    title: 'Responsible and Unified Student Council',
    text: 'To cultivate a deep sense of camaraderie, integrity, and ethical responsibility among all Council officers and class representatives.',
  },
  {
    icon: Megaphone,
    title: 'Legal Campaigns & Advocacies',
    text: 'To implement relevant and timely advocacy initiatives that increase awareness of social realities and position law students at the forefront of justice and nation-building.',
  },
  {
    icon: HeartHandshake,
    title: 'Socio-Civic and Community Engagement',
    text: "To spearhead meaningful community-oriented programs aligned with the legal profession's commitment to public service.",
  },
  {
    icon: Flag,
    title: 'Lawan Identity & Culture',
    text: 'To carry out initiatives and communications that highlight the diverse talents, resilience, and exceptionality within the PUP College of Law studentry.',
  },
  {
    icon: ScrollText,
    title: 'Council Transparency',
    text: 'To provide the student body with accessible platform, including this centralized website, to view Board Resolutions, financial liquidation reports, and project statuses.',
  },
  {
    icon: Radio,
    title: 'Transformational Public Presence',
    text: "To expand the council's digital reach, establish modern information dissemination systems, and ensure seamless communication across all law student batches.",
  },
  {
    icon: Network,
    title: 'Inter-Org & Local Alliance Work',
    text: "To fully realize the council's role as the central channel of communication among law student organizations, the Bar Operations, and the Student Journal.",
  },
  {
    icon: Globe,
    title: 'Establishment of External Networks',
    text: 'To foster strong connections with external law student associations, bar organizations, and legal sectors outside the University.',
  },
]

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
            {tab === 'history' ? <HistoryPanel /> : null}
            {tab === 'mandate' ? <MandatePanel /> : null}
            {tab === 'values' ? <ValuesPanel /> : null}
            {tab === 'goals' ? <GoalsPanel /> : null}
            {tab === 'agenda' ? <AgendaPanel /> : null}
            {tab === 'officers' ? <OfficersPanel /> : null}
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

const councilProjects: { label: string; to: string; icon: LucideIcon }[] = [
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
  { label: 'Student Handbook', to: '/documents/student-handbook', icon: BookMarked },
  { label: 'Guidelines', to: '/documents/guidelines', icon: ScrollText },
  { label: 'Legislative', to: '/governance/legislative', icon: Scale },
  { label: 'Executive', to: '/governance/executive', icon: Gavel },
  { label: 'Contact', to: '/#contact', icon: Mail },
]

const coreValues: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Scale,
    title: 'The Rule of Law & Constitutionalism',
    text: 'Acting as the steadfast vanguard of the Philippine Constitution and laws, upholding legal integrity, and ensuring that all actions respect established legal frameworks.',
  },
  {
    icon: GraduationCap,
    title: 'Academic Excellence',
    text: 'Promoting continuous growth in the legal profession through novel and vital studies designed to contribute profound knowledge to the Philippine legal system.',
  },
  {
    icon: ShieldCheck,
    title: 'Ethical Conduct & Integrity',
    text: 'Securing the highest standard of ethical conduct for council members, students, and the legal profession as a whole, strictly prohibiting the use of council names or property for personal gain.',
  },
  {
    icon: HeartHandshake,
    title: 'Fundamental Human Rights & Dignity',
    text: 'Unwaveringly upholding fundamental respect for human dignity, the protection of individual rights and liberties, equality, and justice for every individual.',
  },
  {
    icon: Landmark,
    title: 'Democratic Representation & Due Process',
    text: "Safeguarding every student's right to due process, equal protection, active participation in governance, and freedom of expression.",
  },
  {
    icon: Eye,
    title: 'Transparency & Accountability',
    text: 'Providing the student body with accessible records, documents, and papers pertaining to all official acts, transactions, and decisions of the Council.',
  },
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
                The governing body of <span className="text-brand-600">law students</span>
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
                How a request <span className="text-brand-600">moves</span>
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
                Projects and <span className="text-brand-600">initiatives</span>
              </>
            }
            text="Six programs the Student Council runs for law students."
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
                <span>{contact.address}</span>
              </li>
              <li className="flex gap-3 text-sm leading-6 text-white/80">
                <Clock className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
                <span>{contact.hours}</span>
              </li>
              <li className="flex gap-3 text-sm leading-6 text-white/80">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
                <span>
                  Established {siteName.established}. {contact.secRegistration}
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
              {directory.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <IconTile icon={item.icon} />
                    <span className="min-w-0 flex-1 text-sm font-medium text-zinc-800 group-hover:text-brand-800">
                      {item.label}
                    </span>
                    <ChevronsRight className="size-4 shrink-0 text-brand-300 group-hover:text-brand-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Reveal>
      </div>
    </section>
    </>
  )
}

function GalleryPanel() {
  const [open, setOpen] = useState<number | null>(null)
  const shot = open === null ? null : galleryPhotos[open]

  useEffect(() => {
    if (open === null) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
      if (event.key === 'ArrowRight') setOpen((index) => (index === null ? index : (index + 1) % galleryPhotos.length))
      if (event.key === 'ArrowLeft') {
        setOpen((index) => (index === null ? index : (index - 1 + galleryPhotos.length) % galleryPhotos.length))
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
  }, [open])

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionKicker icon={Images}>Gallery</SectionKicker>
          <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
            Council <span className="text-brand-600">photographs</span>
          </h2>
        </div>
        <p className="text-sm font-medium text-zinc-500">{galleryPhotos.length} photographs</p>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-6 lg:grid-rows-[13.5rem_13.5rem_15rem]">
        {galleryPhotos.map((photo, index) => (
          <li key={photo.src} className={galleryLayout[index]}>
            <GalleryCard photo={photo} featured={index === 0} onOpen={() => setOpen(index)} />
          </li>
        ))}
      </ul>

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
                    setOpen((index) => (index === null ? 0 : (index - 1 + galleryPhotos.length) % galleryPhotos.length))
                  }
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-xl bg-transparent text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:bg-brand-700 sm:shadow-[0_10px_24px_-12px_rgba(8,0,24,0.9)] sm:drop-shadow-none"
                  aria-label="Next photograph"
                  onClick={() => setOpen((index) => (index === null ? 0 : (index + 1) % galleryPhotos.length))}
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
              <div className="flex items-end justify-between gap-4 px-4 py-3 text-white">
                <p className="min-w-0">
                  <span className="block text-sm font-semibold">{shot.title}</span>
                  <span className="mt-0.5 block text-xs tracking-[0.12em] text-white/70 uppercase">{shot.caption}</span>
                </p>
                <p className="shrink-0 text-xs font-semibold tracking-[0.14em] text-gold-300 uppercase">
                  {String((open ?? 0) + 1).padStart(2, '0')} / {String(galleryPhotos.length).padStart(2, '0')}
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
  photo: (typeof galleryPhotos)[number]
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

function ValuesPanel() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <SectionKicker icon={Scale}>Constitution</SectionKicker>
      <h2 className="mt-4 max-w-3xl font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
        Mission, vision, and <span className="text-brand-600">core values</span>
      </h2>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <Statement icon={Scale} title="Mission" text={mission} className="rounded-2xl border border-zinc-200" />
        <Statement icon={Eye} title="Vision" text={vision} className="rounded-2xl border border-zinc-200" />
      </div>

      <h3 className="mt-12 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
        Council constitutional core values
      </h3>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {coreValues.map((value, index) => (
          <li key={value.title} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <IconTile icon={value.icon} />
              <span className="font-hero text-2xl leading-none text-brand-200">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-brand-950">{value.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{value.text}</p>
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
      <p className="mt-4 text-[15px] leading-7 text-zinc-600">{text}</p>
    </article>
  )
}

const historyMarks: { when: string; title: string; text: string; note: string }[] = [
  {
    when: 'On record',
    title: 'Registered with the SEC',
    text: `${contact.secRegistration}. The Council keeps this registration with the Securities and Exchange Commission and remains the student government of the College of Law.`,
    note: 'Student Council register',
  },
  {
    when: '2013',
    title: 'The College offers the Juris Doctor',
    text: 'The College opened with the Bachelor of Laws. In 2013, PUP was among the first law schools in the Philippines to offer the Juris Doctor program.',
    note: 'PUP College of Law',
  },
  {
    when: 'August 19, 2008',
    title: 'Council officers take their oath',
    text: 'Officers of the PUP College of Law Supreme Student Council took their oath at the University President’s office. Dean Atty. Roseller De La Pena escorted them. The oath bound each officer to the duties of the Council, its Constitution, and its laws.',
    note: 'Oath of office, recorded that day',
  },
  {
    when: 'May 25, 2001',
    title: 'The College of Law is established',
    text: 'The PUP Board of Regents approved Resolution No. 115, Series of 2001, so the College of Law could open in the first semester of A.Y. 2001–2002. In January 2001 the University President asked the Dean of the College of Accountancy and Law to prepare the proposal under DECS Order No. 27 and CHED Memorandum Order No. 46, series of 1996. The University Academic Council endorsed it in a letter dated the same day.',
    note: 'PUP College of Law',
  },
]

function HistoryPanel() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <SectionKicker icon={Landmark}>History</SectionKicker>
        <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.6vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          Council <span className="text-brand-600">history</span>
        </h2>
        <p className="mt-4 text-[15px] leading-7 text-zinc-600">
          From the opening of the College of Law to the Council on the public register.
        </p>
      </header>

      <ol className="mt-8 grid w-full gap-3">
        {historyMarks.map((item) => (
          <li key={item.when}>
            <article className="rounded-2xl border border-zinc-200 bg-white p-4 sm:grid sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start sm:gap-6 sm:p-5">
              <p className="font-hero text-xl leading-none text-brand-600 sm:pt-0.5">{item.when}</p>
              <div className="mt-3 min-w-0 sm:mt-0">
                <h3 className="text-sm font-semibold text-brand-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.text}</p>
                <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">{item.note}</p>
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

function MandatePanel() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <header>
        <SectionKicker icon={Gavel}>Mandate</SectionKicker>
        <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          Student Council <span className="text-brand-600">in action</span>
        </h2>
      </header>
      <ul className="mt-8 grid gap-3 lg:grid-cols-2">
        <li className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
          <IconTile icon={Workflow} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand-950">Projects and policies</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The {siteName.short} {siteName.unit} is the forefront project manager of all student projects and
              policies, committed to ensuring the attainment of transformative objectives for all its initiatives,
              from initiation and formulation to implementation and conclusion.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
          <IconTile icon={Handshake} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand-950">With the College</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The PUP COL SC works hand-in-hand with the College of Law administration, the Dean’s Office, faculty
              members, and different student organizations to accomplish and implement key academic and
              student-welfare events.
            </p>
          </div>
        </li>
      </ul>
    </div>
  )
}

function GoalsPanel() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionKicker icon={Target}>Term goals</SectionKicker>
          <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
            What this term <span className="text-brand-600">sets out to do</span>
          </h2>
        </div>
        <p className="text-sm font-medium text-zinc-500">{termGoals.length} goals</p>
      </div>

      <ol className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {termGoals.map((goal, index) => (
          <li
            key={goal.title}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-zinc-100 px-4 py-4 last:border-b-0 sm:px-5 sm:py-5 lg:grid-cols-[2.5rem_minmax(12rem,16rem)_minmax(0,1fr)] lg:items-start lg:gap-4"
          >
            <p className="pt-1 font-hero text-xl leading-none text-brand-300 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={goal.icon} />
              <h3 className="min-w-0 text-sm leading-5 font-semibold text-brand-950">{goal.title}</h3>
            </div>
            <p className="col-start-2 text-sm leading-6 text-zinc-600 lg:col-start-3 lg:pt-1.5">{goal.text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function AgendaPanel() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <header>
        <SectionKicker icon={Flag}>Term agenda</SectionKicker>
        <h2 className="mt-4 font-hero text-[clamp(1.85rem,0.9rem+2.4vw,3.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
          PUP COL Student Council <span className="text-brand-600">Term agenda</span>
        </h2>
      </header>
      <ul className="mt-8 grid gap-3 lg:grid-cols-2">
        <li className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
          <IconTile icon={HeartHandshake} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand-950">Student welfare</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              We are seeing a year of sustainable student-welfare activities and programs at every front, both a
              culmination of all rigorous academic efforts and the beginning of a long journey toward the legal
              profession. The path of legal education may, at times, be filled with pressure and tests of endurance,
              but through our passion for justice and truth, we will strive forward.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
          <IconTile icon={Scale} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand-950">Rule of law</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Relieving our identities as resolute law students and future advocates in these demanding times, we
              will face all hurdles and establish milestones, in genuine representation of the PUP College of Law
              student body. Together, let us uphold excellence, service, and the rule of law!
            </p>
          </div>
        </li>
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

const executiveOfficers: Seat[] = [
  { role: 'President', name: 'Toribio, Russel Angelo O.', photo: toribio },
  { role: 'Vice President Internal', name: 'de Leon, Kristoffer Red S.', photo: deLeon },
  { role: 'Vice President External', name: 'Salazar, Marvin L.', photo: salazar },
  { role: 'Secretary-General', name: 'Velasco, Jesca O.', photo: velasco },
  { role: 'Finance Officer', name: 'Biato, Yvonne', photo: biato },
  { role: 'Auditor', name: 'Orante, Amaziah Perseus G.', photo: orante },
  { role: 'Communications Officer', name: 'Tercero, Shein', photo: tercero },
]

const yearRepresentatives: Seat[] = [
  { role: 'Year 1', name: 'Roxas, Jayson', photo: ramos },
  { role: 'Year 2', name: 'Rana, John Ivan H.', photo: rana },
  { role: 'Year 3', name: 'Guadaña, Almira P.', photo: guadana },
  { role: 'Year 4', name: 'Vacant', vacant: true },
]

const associates: Seat[] = [
  { role: 'Presidential Affairs', name: 'Jessica Mae T. Asuncion' },
  { role: 'Internal Affairs', name: 'Aldrich R. Sanchez', photo: sanchez },
  { role: 'Secretariat', name: 'Cherie An M. Sarabia', photo: sarabia },
  { role: 'External Affairs', name: 'Gleanna Marie B. Cuyugan', photo: cuyugan },
  { role: 'Social Media Management', name: 'Jenina Denisse R. Cabrera' },
]

const advisoryBoard: Seat[] = [
  { role: 'Dean, PUP College of Law', name: 'Atty. Gemy Lito L. Festin, LL.M.', photo: festin },
  { role: 'Lead Faculty Adviser', name: 'Atty. Czarina C. Santos-Mahilum', photo: santos },
  { role: 'Lead Faculty Adviser', name: 'Atty. Rex Norman E. Briones, LL.M.', photo: briones },
  { role: 'Lead Faculty Adviser', name: 'Atty. Leslie Faye P. Pago', photo: pago },
  { role: 'Lead Faculty Adviser', name: 'Atty. Kim Ranielle E. Abis' },
]

const appointments: Seat[] = [
  { role: 'Chairperson', name: 'Russel Angelo O. Toribio', photo: toribio },
  { role: 'Commissioner', name: 'Kristoffer Red S. De Leon', photo: deLeon },
  { role: 'Commissioner', name: 'Marvin L. Salazar', photo: salazar },
  { role: 'Commissioner and Clerk to the Commission', name: 'Jesca O. Velasco', photo: velasco },
  { role: 'Commissioner', name: 'Ma. Yvonne B. Biato', photo: biato },
  { role: 'Commissioner', name: 'Amaziah Perseus G. Orante', photo: orante },
  { role: 'Commissioner', name: 'Shein Tercero', photo: tercero },
  { role: 'Commissioner', name: 'Jayson G. Ramos', photo: ramos },
  { role: 'Commissioner', name: 'John Ivan H. Rana', photo: rana },
  { role: 'Commissioner', name: 'Almira P. Guadaña', photo: guadana },
]

function OfficersPanel() {
  const [president, ...board] = executiveOfficers

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading icon={Users} kicker="Officers" title={<>Executive <span className="text-brand-600">Board</span></>} />
      <div className="mt-8">
        <SeatCard seat={president} featured />
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {board.map((seat) => (
          <li key={seat.role}>
            <SeatCard seat={seat} />
          </li>
        ))}
      </ul>

      <h3 className="mt-10 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
        Year level representatives
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {yearRepresentatives.map((seat) => (
          <li key={seat.role}>
            <SeatCard seat={seat} />
          </li>
        ))}
      </ul>

      <h3 className="mt-10 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
        Associates
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {associates.map((seat) => (
          <li key={seat.role}>
            <SeatCard seat={seat} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function StructurePanel() {
  const president = executiveOfficers[0]
  const lineOfficers = executiveOfficers.slice(1, 4)
  const staffOfficers = executiveOfficers.slice(4)

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading icon={Network} kicker="Structure" title={<>Organization <span className="text-brand-600">chart</span></>} />

      <div className="mt-8 flex flex-col items-center lg:hidden">
        <div className="w-full max-w-sm">
          <OrgNode seat={president} lead compact />
        </div>
        <MobileRow people={lineOfficers} />
        <MobileRow people={staffOfficers} />
        <ChartBand label="Year level representatives" />
        <MobileRow people={yearRepresentatives} grouped />
        <ChartBand label="Associates" />
        <MobileRow people={associates} grouped />
      </div>

      <div className="mt-8 hidden w-full overflow-x-auto lg:block">
        <div className="mx-auto flex w-max min-w-full flex-col items-center py-2">
          <OrgRow people={[president]} root />
          <OrgRow people={lineOfficers} />
          <OrgRow people={staffOfficers} />
          <ChartBand label="Year level representatives" />
          <OrgRow people={yearRepresentatives} />
          <ChartBand label="Associates" />
          <OrgRow people={associates} />
        </div>
      </div>
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
  const [dean, ...faculty] = advisoryBoard

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading
        icon={GraduationCap}
        kicker="Advisory Board · 2026–2027"
        title={<>Faculty <span className="text-brand-600">advisers</span></>}
      />
      <div className="mt-8">
        <SeatCard seat={dean} featured />
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {faculty.map((seat) => (
          <li key={seat.name}>
            <SeatCard seat={seat} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function CommissionsPanel() {
  const [chair, ...members] = appointments

  return (
    <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
      <RosterHeading
        icon={Scale}
        kicker="Commissions"
        title={<>Commission on <span className="text-brand-600">Appointments</span></>}
      />
      <div className="mt-8">
        <SeatCard seat={chair} featured />
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((seat) => (
          <li key={seat.name}>
            <SeatCard seat={seat} />
          </li>
        ))}
      </ul>
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
  return (
    <article
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-white p-3.5',
        seat.vacant ? 'border-dashed border-zinc-300' : 'border-zinc-200',
        featured && 'w-full border-brand-200',
      )}
    >
      <Mark src={seat.photo} prominent={featured} muted={seat.vacant} />
      <div className="min-w-0">
        <p className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-brand-700 uppercase">{seat.role}</p>
        <p className="mt-0.5 text-sm leading-5 font-semibold break-words text-brand-950">{seat.name}</p>
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

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { getDocument } from 'pdfjs-dist'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlignLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  CircleHelp,
  CircleUser,
  Copy,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  Handshake,
  Hash,
  Info,
  Loader2,
  Lightbulb,
  LockKeyhole,
  Mail,
  Megaphone,
  MessageCircle,
  Paperclip,
  Scale,
  Search,
  Send,
  Shirt,
  RefreshCw,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Announcements } from '@/components/home/Announcements'
import { FaqList } from '@/components/home/Faq'
import { EventsCalendar } from '@/components/home/EventsCalendar'
import { CouncilChat } from '@/components/home/CouncilChat'
import { Grievance } from '@/components/home/Grievance'
import {
  findReservation,
  reservationFromApi,
  type StoredReservation,
} from '@/components/portal/reservations'
import { TrackJourneyScene } from '@/components/portal/TrackJourneyScene'
import { contact } from '@/components/layout/nav-data'
import { scrollPageTo, setPageScrollLocked } from '@/hooks/useLenis'
import { Snackbar, type SnackVariant } from '@/components/ui/Snackbar'
import {
  submitPortalRequest,
  trackPortalRequest,
  type PortalRequestRecord,
} from '@/lib/requests-api'
import { formatPhDate } from '@/lib/datetime'
import { getReservationByCode } from '@/lib/reservations-api'
import { cn } from '@/lib/utils'

const subjects: { label: string; icon: LucideIcon }[] = [
  { label: 'General Inquiry', icon: MessageCircle },
  { label: 'Academic Grievances', icon: Scale },
  { label: 'Document Request', icon: FileText },
  { label: 'Academic Support', icon: GraduationCap },
  { label: 'Student Organization Proposal', icon: Users },
  { label: 'Feedback/Suggestion/Student concerns tracking', icon: Lightbulb },
  { label: 'Sponsorship & Donations', icon: Handshake },
]

const optionalAttachmentSubject = 'Sponsorship & Donations'

const successEase = [0.22, 1, 0.36, 1] as const

const maxFileBytes = 10 * 1024 * 1024

const fieldClass =
  'h-12 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-900 outline-none transition-[background-color,border-color,box-shadow] placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 aria-invalid:border-maroon-600 aria-invalid:focus:ring-maroon-100 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:bg-zinc-900 dark:focus:ring-brand-500/25'

type Errors = Partial<Record<'name' | 'email' | 'subject' | 'body' | 'file', string>>

const portalTabs = [
  { id: 'request', label: 'Request', icon: Send },
  { id: 'tracking', label: 'Track your request', icon: Hash },
  { id: 'grievance', label: 'Grievance', icon: Scale },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'faq', label: 'FAQ', icon: CircleHelp },
] as const

type PortalTab = (typeof portalTabs)[number]['id']

function tabFromHash(hash: string): PortalTab {
  const id = hash.replace('#', '')
  return portalTabs.some((item) => item.id === id) ? (id as PortalTab) : 'request'
}

const processSteps = [
  {
    title: 'Submit the request',
    detail: 'A tracking ID is sent to the email you entered.',
  },
  {
    title: 'Acknowledgement',
    detail: 'The Council replies within 24 to 48 hours of receipt.',
  },
  {
    title: 'Confidential review',
    detail: 'Grievances and personal inquiries are reviewed only by authorized Executive Officers.',
  },
  {
    title: 'Reply',
    detail: 'Updates are sent to that same email.',
  },
]

const reservationSteps = [
  {
    title: 'Choose merch or a locker',
    detail: 'Open Merchandise Reservation or Locker Reservation and pick an item.',
  },
  {
    title: 'Enter your details',
    detail: 'Name, email, mobile, student ID, and year. Merch also asks for a quantity.',
  },
  {
    title: 'Send the reservation',
    detail: 'The email goes to the Council, and a reservation ID is saved.',
  },
  {
    title: 'Track the reservation ID',
    detail: 'Look up that ID on the Tracking tab.',
  },
]

type StoredRequest = PortalRequestRecord

function previewKind(file: File): 'image' | 'pdf' | 'text' | 'none' {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) return 'image'
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (file.type === 'text/plain' || name.endsWith('.txt')) return 'text'
  return 'none'
}

function fileTypeLabel(file: File) {
  const kind = previewKind(file)
  if (kind === 'pdf') return 'PDF'
  if (kind === 'text') return 'TXT'
  if (kind === 'image') {
    const ext = file.name.split('.').pop()?.toUpperCase() ?? ''
    return ext.length >= 2 && ext.length <= 4 ? ext : 'IMG'
  }
  if (/\.docx?$/i.test(file.name)) return 'DOC'
  return 'FILE'
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileAllowed(file: File) {
  return (
    /^(application\/pdf|image\/.+|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain)$/.test(
      file.type,
    ) || /\.(pdf|png|jpe?g|webp|gif|docx?|txt)$/i.test(file.name)
  )
}

export default function Portal() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const formId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [mailNotice, setMailNotice] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const submittingRef = useRef(false)
  const [tab, setTab] = useState<PortalTab>(() => tabFromHash(hash))
  const [focusId, setFocusId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [snack, setSnack] = useState<{ id: number; message: string; variant: SnackVariant } | null>(
    null,
  )
  const snackTimer = useRef<number | null>(null)
  const snackId = useRef(0)

  function dismissSnack() {
    if (snackTimer.current) window.clearTimeout(snackTimer.current)
    snackTimer.current = null
    setSnack(null)
  }

  function showSnackbar(message: string, variant: SnackVariant = 'error') {
    if (snackTimer.current) window.clearTimeout(snackTimer.current)
    const id = snackId.current + 1
    snackId.current = id
    setSnack({ id, message, variant })
    const dismissMs = message.length > 140 ? 10_000 : 5200
    snackTimer.current = window.setTimeout(() => {
      setSnack((current) => (current?.id === id ? null : current))
      snackTimer.current = null
    }, dismissMs)
  }

  useEffect(() => {
    const previous = document.title
    document.title = 'Student Services Portal · PUP College of Law Student Council'
    return () => {
      document.title = previous
      if (snackTimer.current) window.clearTimeout(snackTimer.current)
    }
  }, [])

  useEffect(() => {
    setTab(tabFromHash(hash))
  }, [hash])

  const tablistRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const list = tablistRef.current
    const active = list?.querySelector<HTMLElement>(`#portal-tab-${tab}`)
    if (!list || !active) return
    const listBox = list.getBoundingClientRect()
    const tabBox = active.getBoundingClientRect()
    const delta = tabBox.left + tabBox.width / 2 - (listBox.left + listBox.width / 2)
    const max = Math.max(0, list.scrollWidth - list.clientWidth)
    const next = Math.max(0, Math.min(max, list.scrollLeft + delta))
    if (Math.abs(next - list.scrollLeft) < 1) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ left: next, behavior: reduce ? 'auto' : 'smooth' })
  }, [tab])

  useLayoutEffect(() => {
    if (tab !== 'calendar') return
    const panel = document.getElementById('portal-panel-calendar')
    const scroller = document.querySelector('.app-scroll')
    if (!panel || panel.hidden || !(scroller instanceof HTMLElement)) return
    const offset = 128
    const top =
      panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const viewTop = scroller.scrollTop + offset
    const viewBottom = scroller.scrollTop + scroller.clientHeight * 0.45
    if (top >= viewTop - 12 && top <= viewBottom) return
    scrollPageTo(Math.max(0, top - offset), false)
  }, [tab])

  useEffect(() => {
    if (!focusId) return
    document.getElementById(focusId)?.focus()
  }, [focusId])

  function clearForm() {
    setName('')
    setEmail('')
    setSubject('')
    setBody('')
    setFile(null)
    setFileKey((key) => key + 1)
    setPreviewOpen(false)
    setErrors({})
    setSubmitted(false)
    setTrackingId(null)
    setCopied(false)
    setMailNotice(null)
    setNotice(null)
    submittingRef.current = false
    setSubmitting(false)
  }

  async function copyTrackingId() {
    if (!trackingId) return
    try {
      await navigator.clipboard.writeText(trackingId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function onFile(next: File | null) {
    setNotice(null)
    setPreviewOpen(false)
    if (!next) {
      setFile(null)
      return
    }
    if (!fileAllowed(next)) {
      setFile(null)
      setFileKey((key) => key + 1)
      setErrors((current) => ({
        ...current,
        file: 'Use a PDF, image, or document.',
      }))
      return
    }
    if (next.size > maxFileBytes) {
      setFile(null)
      setFileKey((key) => key + 1)
      setErrors((current) => ({
        ...current,
        file: 'File must be 10 MB or smaller.',
      }))
      return
    }
    setFile(next)
    setErrors((current) => ({ ...current, file: undefined }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current || submitted) return
    const nextErrors: Errors = {}
    if (name.trim().length < 2) nextErrors.name = 'Enter the name of the sender.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (!subject) nextErrors.subject = 'Select a subject.'
    if (!body.trim()) nextErrors.body = 'Enter the details of your request.'
    if (subject !== optionalAttachmentSubject && !file) {
      nextErrors.file = 'Attach a PDF, image, or document.'
    }

    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      setNotice(null)
      const first = (['name', 'email', 'subject', 'body', 'file'] as const).find(
        (key) => nextErrors[key],
      )
      if (first) setFocusId(`${formId}-${first}`)
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setNotice(null)
    const result = await submitPortalRequest({
      name: name.trim(),
      email: email.trim(),
      subject,
      body: body.trim(),
      file: file ?? undefined,
    })

    if (!result.ok) {
      submittingRef.current = false
      setSubmitting(false)
      showSnackbar(result.error, 'error')
      return
    }

    const id = result.data.item.id
    setTrackingId(id)
    setSubmitted(true)
    setMailNotice(
      result.data.confirmationSent
        ? 'A confirmation email was sent to your inbox.'
        : result.data.message ||
            'Your request is saved. Keep this ID — email delivery may be unavailable.',
    )
    setNotice(`${result.data.message} Tracking ID ${id}.`)
    submittingRef.current = false
    setSubmitting(false)
  }

  const attachmentRequired = subject !== optionalAttachmentSubject
  const ready = Boolean(
    name.trim() && email.trim() && subject && body.trim() && (file || !attachmentRequired),
  )

  if (hash === '#locker') return <Navigate to="/lockers" replace />
  if (hash === '#merch') return <Navigate to="/merch" replace />

  return (
    <>
    <main id="main-content" className="bg-[#f4f5f7] text-zinc-900">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-8 lg:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-hero text-[clamp(1.7rem,1.2rem+1.6vw,2.35rem)] leading-[0.95] font-normal tracking-tight text-brand-950">
              Student Services Portal
            </h1>
            {tab === 'request' ? (
              <p className="mt-1 text-sm text-zinc-500">
                <span className="sm:hidden">Fill out the form below</span>
                <span className="hidden sm:inline">Fill out the form details below</span>
              </p>
            ) : null}
            {tab === 'tracking' ? (
              <p className="mt-1 text-sm text-zinc-500">
                <span className="sm:hidden">Check a request or reservation.</span>
                <span className="hidden sm:inline">
                  Enter a tracking ID or reservation ID.
                </span>
              </p>
            ) : null}
            {tab === 'announcements' ? (
              <p className="mt-1 text-sm text-zinc-500">
                <span className="sm:hidden">Issuances, posters, and updates.</span>
                <span className="hidden sm:inline">
                  Official issuances, event posters, and council updates.
                </span>
              </p>
            ) : null}
            {tab === 'calendar' ? (
              <p className="mt-1 text-sm text-zinc-500">
                <span className="sm:hidden">Exams, enrollment, and holidays.</span>
                <span className="hidden sm:inline">
                  Examinations, enrollment, and holiday breaks.
                </span>
              </p>
            ) : null}
            {tab === 'faq' ? (
              <p className="mt-1 text-sm text-zinc-500">
                <span className="sm:hidden">Common questions.</span>
                <span className="hidden sm:inline">Answers to common questions.</span>
              </p>
            ) : null}
            {tab === 'grievance' ? (
              <p className="mt-1 text-sm text-zinc-500">
                <span className="sm:hidden">File a confidential student concern.</span>
                <span className="hidden sm:inline">
                  Academic grievances, administrative inquiries, and welfare concerns.
                </span>
              </p>
            ) : null}
          </div>
          <HowItWorks />
        </header>

        <div
          ref={tablistRef}
          className="mt-6 flex gap-6 overflow-x-auto border-b border-zinc-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Portal"
        >
          {portalTabs.map((item) => {
            const selected = tab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`portal-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`portal-panel-${item.id}`}
                onClick={() => {
                  setTab(item.id)
                  navigate(
                    { pathname: '/portal', hash: item.id === 'request' ? '' : item.id },
                    { replace: true },
                  )
                }}
                className={cn(
                  '-mb-px inline-flex shrink-0 items-center justify-center gap-1.5 border-b-2 px-1 pt-1 pb-3 text-sm whitespace-nowrap transition-colors',
                  selected
                    ? 'border-brand-600 font-semibold text-zinc-900'
                    : 'border-transparent font-medium text-zinc-500 hover:text-zinc-800',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        id="portal-panel-grievance"
        role="tabpanel"
        aria-labelledby="portal-tab-grievance"
        hidden={tab !== 'grievance'}
        className="mx-auto mt-5 w-full max-w-7xl px-4 pb-10 sm:mt-8 sm:px-6 lg:px-8"
      >
        <Grievance variant="portal" />
      </div>
      <div
        id="portal-panel-announcements"
        role="tabpanel"
        aria-labelledby="portal-tab-announcements"
        hidden={tab !== 'announcements'}
        className="mx-auto mt-5 w-full max-w-7xl px-4 pb-10 sm:mt-8 sm:px-6 lg:px-8"
      >
        <Announcements variant="portal" />
      </div>
      <div
        id="portal-panel-calendar"
        role="tabpanel"
        aria-labelledby="portal-tab-calendar"
        hidden={tab !== 'calendar'}
        className="mx-auto mt-5 w-full max-w-7xl px-4 pb-10 sm:mt-8 sm:px-6 lg:px-8"
      >
        <EventsCalendar variant="portal" />
      </div>
      <div
        id="portal-panel-faq"
        role="tabpanel"
        aria-labelledby="portal-tab-faq"
        hidden={tab !== 'faq'}
        className="mx-auto mt-5 w-full max-w-7xl px-4 pb-10 sm:mt-8 sm:px-6 lg:px-8"
      >
        <FaqList />
      </div>

      <div
        id="portal-panel-request"
        role="tabpanel"
        aria-labelledby="portal-tab-request"
        hidden={tab !== 'request'}
        className="mx-auto mt-5 w-full max-w-7xl px-4 pb-6 sm:mt-8 sm:px-6 sm:pb-10 lg:px-8"
      >
        <form
          onSubmit={onSubmit}
          noValidate
          className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22.5rem)]"
        >
          <div className="flex min-w-0 flex-col gap-5">
            <section
              className={cn(
                'relative min-w-0 rounded-2xl border border-zinc-200 bg-white sm:rounded-3xl',
                submitted && trackingId
                  ? 'overflow-x-hidden p-0'
                  : 'p-4 sm:p-6',
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {submitted && trackingId ? (
                  <motion.div
                    key="success"
                    role="status"
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                    transition={{ duration: 0.45, ease: successEase }}
                    className="flex w-full min-w-0 flex-col items-center justify-center px-5 py-8 text-center sm:min-h-[32rem] sm:px-8 sm:py-10"
                  >
                    <motion.span
                      initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: successEase, delay: reduceMotion ? 0 : 0.06 }}
                      className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"
                    >
                      <CheckCircle2 className="size-7" aria-hidden />
                    </motion.span>
                    <motion.h2
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: successEase, delay: reduceMotion ? 0 : 0.14 }}
                      className="mt-4 text-lg font-semibold text-zinc-950"
                    >
                      Request received
                    </motion.h2>
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.42, ease: successEase, delay: reduceMotion ? 0 : 0.22 }}
                      className="mt-2 max-w-sm text-sm leading-6 text-zinc-500"
                    >
                      Thank you. The Council has this on file and will confirm by email. Keep your
                      tracking ID.
                    </motion.p>
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: successEase, delay: reduceMotion ? 0 : 0.28 }}
                      className="mt-5 w-full min-w-0 max-w-sm"
                    >
                      <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                        Tracking ID
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyTrackingId()}
                        className="mt-1.5 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm font-semibold tracking-wide text-brand-800 transition-colors hover:bg-brand-100"
                      >
                        <span className="min-w-0 break-all font-mono">{trackingId}</span>
                        {copied ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : (
                          <Copy className="size-3.5" aria-hidden />
                        )}
                        <span className="sr-only">{copied ? 'Copied' : 'Copy tracking ID'}</span>
                      </button>
                      {mailNotice ? (
                        <p className="mt-3 text-sm leading-5 text-zinc-500">{mailNotice}</p>
                      ) : null}
                    </motion.div>
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: successEase, delay: reduceMotion ? 0 : 0.36 }}
                      className="mt-6 flex w-full min-w-0 flex-col gap-3"
                    >
                      <Link
                        to="/portal#tracking"
                        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-700 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        Track request
                      </Link>
                      <button
                        type="button"
                        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-[15px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        onClick={clearForm}
                      >
                        Submit another
                      </button>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.38, ease: successEase }}
                  >
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900">
                  <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                    <FileText className="size-3.5" aria-hidden />
                  </span>
                  Your request
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  The Council confirms this by email. Keep your tracking ID after you submit.
                </p>
              </div>
              <div className="mt-5 grid min-w-0 gap-5">
                <Field
                  label="Name of the sender"
                  icon={CircleUser}
                  htmlFor={`${formId}-name`}
                  error={errors.name}
                >
                  <input
                    id={`${formId}-name`}
                    name="name"
                    autoComplete="name"
                    value={name}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                    onChange={(event) => {
                      setName(event.target.value)
                      setNotice(null)
                    }}
                    className={fieldClass}
                    placeholder="Full name"
                  />
                </Field>

                <Field
                  label="Email address"
                  icon={Mail}
                  htmlFor={`${formId}-email`}
                  error={errors.email}
                >
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setNotice(null)
                    }}
                    className={fieldClass}
                    placeholder="name@example.com"
                  />
                </Field>

                <Field
                  label="Subject"
                  icon={Tag}
                  htmlFor={`${formId}-subject`}
                  error={errors.subject}
                >
                  <SubjectSelect
                    id={`${formId}-subject`}
                    value={subject}
                    invalid={Boolean(errors.subject)}
                    describedBy={errors.subject ? `${formId}-subject-error` : undefined}
                    onChange={(next) => {
                      setSubject(next)
                      setNotice(null)
                      if (next === optionalAttachmentSubject) {
                        setErrors((current) => ({ ...current, file: undefined, subject: undefined }))
                      }
                    }}
                  />
                </Field>

                <Field label="Body" icon={AlignLeft} htmlFor={`${formId}-body`} error={errors.body}>
                  <textarea
                    id={`${formId}-body`}
                    name="body"
                    value={body}
                    rows={6}
                    aria-invalid={Boolean(errors.body)}
                    aria-describedby={errors.body ? `${formId}-body-error` : undefined}
                    onChange={(event) => {
                      setBody(event.target.value)
                      setNotice(null)
                    }}
                    className={cn(fieldClass, 'h-auto min-h-36 resize-y py-3')}
                    placeholder="Describe your inquiry, request, or concern"
                  />
                </Field>

                <Field
                  label="Attachment"
                  icon={Paperclip}
                  htmlFor={`${formId}-file`}
                  error={errors.file}
                  required={attachmentRequired}
                  hint={
                    attachmentRequired
                      ? 'PDF, image, or document, up to 10 MB.'
                      : 'Optional for Sponsorship & Donations. PDF, image, or document, up to 10 MB.'
                  }
                >
                  <div
                    className={cn(
                      '@container min-w-0 rounded-xl border bg-zinc-50',
                      errors.file ? 'border-maroon-600' : 'border-zinc-200',
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-2 p-2 @[28rem]:flex-row @[28rem]:items-center @[28rem]:gap-3 @[28rem]:px-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-0.5">
                        {file ? (
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-semibold tracking-wide text-brand-800"
                            aria-hidden
                          >
                            {fileTypeLabel(file)}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate text-sm',
                              file ? 'font-medium text-zinc-900' : 'text-zinc-500',
                            )}
                            title={file?.name}
                          >
                            {file ? file.name : 'No file selected'}
                          </span>
                          {file ? (
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {formatFileSize(file.size)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'grid min-w-0 gap-2',
                          file ? 'grid-cols-2' : 'grid-cols-1',
                          '@[28rem]:flex @[28rem]:shrink-0',
                        )}
                      >
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium whitespace-nowrap text-zinc-800 transition-colors hover:bg-zinc-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500">
                          Choose file
                          <input
                            key={fileKey}
                            id={`${formId}-file`}
                            name="attachment"
                            type="file"
                            accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.txt"
                            aria-invalid={Boolean(errors.file)}
                            aria-describedby={
                              errors.file ? `${formId}-file-error` : `${formId}-file-hint`
                            }
                            className="sr-only"
                            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
                          />
                        </label>
                        {file ? (
                          <button
                            type="button"
                            onClick={() => setPreviewOpen(true)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 text-sm font-medium whitespace-nowrap text-brand-800 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                          >
                            <Eye className="size-3.5" aria-hidden />
                            Preview
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Field>
                {previewOpen && file ? (
                  <FilePreview file={file} onClose={() => setPreviewOpen(false)} />
                ) : null}
              </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          <aside
            className={cn(
              'min-w-0 flex-col gap-5 lg:sticky lg:top-28 lg:max-h-[calc(100svh-8rem)] lg:overflow-y-auto',
              submitted && trackingId ? 'hidden lg:flex' : 'flex',
            )}
          >
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:rounded-3xl sm:p-6">
              <h2 className="text-base font-semibold text-zinc-900">Request summary</h2>
              <dl className="mt-4 grid min-w-0 gap-4">
                <SummaryRow icon={CircleUser} label="Name" value={name.trim()} />
                <SummaryRow icon={Mail} label="Email" value={email.trim()} />
                <SummaryRow icon={Info} label="Subject" value={subject} />
                <SummaryRow icon={Paperclip} label="Attachment" value={file?.name ?? ''} />
                {trackingId ? <SummaryRow icon={Hash} label="Tracking ID" value={trackingId} /> : null}
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <dt className="inline-flex shrink-0 items-center gap-2.5 text-sm text-zinc-500">
                    <CircleDot className="size-4 text-zinc-400" aria-hidden />
                    Status
                  </dt>
                  <dd>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        submitted
                          ? 'bg-brand-50 text-brand-800'
                          : ready
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-zinc-100 text-zinc-600',
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          submitted ? 'bg-brand-600' : ready ? 'bg-emerald-500' : 'bg-zinc-400',
                        )}
                        aria-hidden
                      />
                      {submitted ? 'Submitted' : ready ? 'Ready' : 'Incomplete'}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <div className="flex gap-2.5 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm leading-5 text-brand-900 sm:gap-3 sm:rounded-3xl sm:px-4 sm:py-3.5 sm:leading-relaxed">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
                <Info className="size-3" aria-hidden />
              </span>
              <p>
                <span className="font-semibold">Tip: Keep your tracking ID.</span> After you
                submit, the ID is included in the email to the Student Council. Replies and
                status updates are sent to the email address you entered.
              </p>
            </div>

            <div className="grid gap-3">
              {submitted && trackingId ? (
                <>
                  <Button asChild size="lg" className="h-10 rounded-full sm:h-12">
                    <Link to="/portal#tracking">Track request</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-10 rounded-full sm:h-12"
                    onClick={clearForm}
                  >
                    Submit another
                  </Button>
                  <p className="text-center text-xs leading-relaxed text-zinc-500" role="status">
                    {mailNotice ?? notice ?? `Keep tracking ID ${trackingId} for updates.`}
                  </p>
                </>
              ) : (
                <>
              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-80 sm:h-12 sm:px-5"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.25} aria-hidden />
                ) : null}
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:h-12 sm:px-5"
              >
                Clear
              </button>
              <p className="text-center text-xs leading-relaxed text-zinc-500" role="status">
                {notice ??
                  (attachmentRequired
                    ? `Submit sends your request and attachment to ${contact.email}. A tracking ID and confirmation go to your email.`
                    : `Submit sends your request to ${contact.email}. A tracking ID and confirmation go to your email.`)}
              </p>
                </>
              )}
            </div>
          </aside>
        </form>
      </div>
      <div
        id="portal-panel-tracking"
        role="tabpanel"
        aria-labelledby="portal-tab-tracking"
        hidden={tab !== 'tracking'}
        className="mx-auto mt-5 w-full max-w-7xl px-4 pb-6 sm:mt-8 sm:px-6 sm:pb-10 lg:px-8"
      >
        <TrackRequest showSnackbar={showSnackbar} />
      </div>
      <Snackbar toast={snack} onDismiss={dismissSnack} />
    </main>
    <CouncilChat />
    </>
  )
}

function TrackRequest({
  showSnackbar,
}: {
  showSnackbar: (message: string, variant: SnackVariant) => void
}) {
  const fieldId = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<StoredRequest | null>(null)
  const [reservation, setReservation] = useState<StoredReservation | null>(null)
  const [pending, setPending] = useState(false)
  const [tone, setTone] = useState<'found' | 'missing' | null>(null)
  const [shake, setShake] = useState(0)

  async function onTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const next = code.trim()
    if (!next) {
      setError('Enter a tracking ID or reservation ID.')
      setResult(null)
      setReservation(null)
      setTone(null)
      return
    }
    setPending(true)
    setError('')
    const preferReservation = next.toUpperCase().startsWith('RSV')

    let reserved: StoredReservation | null = null
    const fromApi = await getReservationByCode(next)
    if (fromApi.ok) {
      reserved = reservationFromApi(fromApi.data.item)
    } else {
      reserved = findReservation(next)
    }

    let requestMatch: StoredRequest | null = null
    if (!preferReservation || !reserved) {
      const tracked = await trackPortalRequest(next)
      if (tracked.ok) requestMatch = tracked.data.item
    }

    const reservationMatch = preferReservation
      ? reserved
      : reserved && !requestMatch
        ? reserved
        : null
    const requestResult = reservationMatch ? null : requestMatch

    setReservation(reservationMatch)
    setResult(requestResult)
    const found = Boolean(reservationMatch || requestResult)
    setTone(found ? 'found' : 'missing')
    setShake((count) => count + 1)
    setPending(false)
    showSnackbar(
      reservationMatch
        ? 'Your reservation has been found.'
        : requestResult
          ? 'Your request has been found.'
          : 'No matching record was found.',
      found ? 'success' : 'error',
    )
  }

  function clearTrack() {
    setCode('')
    setError('')
    setResult(null)
    setReservation(null)
    setTone(null)
  }

  const filed = result ? formatPhDate(result.submittedAt) : ''
  const reservedOn = reservation ? formatPhDate(reservation.submittedAt) : ''

  return (
    <form
      onSubmit={onTrack}
      noValidate
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)] sm:rounded-3xl lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-stretch dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.55)]"
    >
      <div className="min-w-0">
        <TrackJourneyScene
          pending={pending}
          missing={tone === 'missing'}
          requestStatus={result?.status ?? null}
          reservationStatus={reservation?.status ?? null}
        />
        <section className="flex min-w-0 flex-col p-4 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-zinc-50">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <Search className="size-3.5" aria-hidden />
            </span>
            Track
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Use a request tracking ID or a reservation ID.
          </p>
          <div className="mt-5">
            <label
              htmlFor={fieldId}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <Hash className="size-3.5" aria-hidden />
              </span>
              Reference ID
              <span className="text-maroon-700 dark:text-maroon-400"> *</span>
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <input
                  id={fieldId}
                  value={code}
                  autoComplete="off"
                  aria-invalid={Boolean(error)}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setError('')
                  }}
                  placeholder="COL-20261013-AB12 or RSV-AB12CD"
                  className={fieldClass}
                />
                {error ? (
                  <p className="mt-1.5 text-xs text-maroon-700 dark:text-maroon-400">{error}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
                <button
                  type="submit"
                  disabled={pending}
                  aria-busy={pending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-80 sm:min-w-28 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2.25} aria-hidden />
                  ) : (
                    <Search className="size-4" aria-hidden />
                  )}
                  {pending ? 'Tracking…' : 'Track'}
                </button>
                <button
                  type="button"
                  onClick={clearTrack}
                  disabled={pending || (!code && !error && !result && !reservation)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <X className="size-4" aria-hidden />
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2.5 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm leading-5 text-brand-900 sm:mt-5 sm:gap-3 sm:px-4 sm:py-3 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-100">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white dark:bg-brand-500">
              <Info className="size-3" aria-hidden />
            </span>
            <p>
              <span className="font-semibold">Note: </span>
              The ID is in your confirmation email. A request shows the document and status. A
              reservation shows the item and total.
            </p>
          </div>
        </section>
      </div>

        <section
          key={shake}
          className={cn(
            'flex min-h-64 min-w-0 flex-col border-t border-zinc-100 bg-[#f7f6fb] p-4 sm:min-h-80 sm:p-6 lg:min-h-full lg:border-t-0 lg:border-l dark:border-zinc-800 dark:bg-zinc-900/70',
            shake > 0 && 'result-shake',
            tone === 'found' &&
              'bg-emerald-50/70 dark:bg-emerald-500/[0.12] dark:border-emerald-500/20',
            tone === 'missing' &&
              'bg-maroon-50/70 dark:bg-maroon-500/[0.12] dark:border-maroon-500/20',
          )}
        >
          {reservation ? (
            <ReservationResult reservation={reservation} filed={reservedOn} />
          ) : result ? (
            <TrackResult result={result} filed={filed} />
          ) : (
            <TrackEmpty missing={tone === 'missing'} code={code.trim()} />
          )}
        </section>
    </form>
  )
}

function TrackEmpty({ missing, code }: { missing: boolean; code: string }) {
  const Icon = missing ? Info : Search
  return (
    <div className="flex h-full min-h-52 flex-1 flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white px-5 py-8 text-center shadow-[0_10px_24px_-20px_rgba(30,5,65,0.45)] dark:border-zinc-700 dark:bg-zinc-950">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {missing ? 'No match' : 'Result'}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {missing
          ? `Nothing is filed under ${code}.`
          : 'Enter a tracking ID or reservation ID. The match shows here.'}
      </p>
    </div>
  )
}

function ResultStatus({
  label,
  tone,
}: {
  label: string
  tone: 'ok' | 'warn' | 'bad'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'ok' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
        tone === 'warn' && 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
        tone === 'bad' && 'bg-maroon-100 text-maroon-800 dark:bg-maroon-500/15 dark:text-maroon-300',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'ok' && 'bg-emerald-500',
          tone === 'warn' && 'bg-amber-500',
          tone === 'bad' && 'bg-maroon-700 dark:bg-maroon-400',
        )}
        aria-hidden
      />
      {label}
    </span>
  )
}

function CopyRefButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="mt-1.5 inline-flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-3 text-left text-sm font-semibold tracking-wide text-brand-800 transition-colors hover:bg-brand-100 dark:border-brand-500/25 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25"
    >
      <span className="min-w-0 break-all font-mono">{value}</span>
      {copied ? <Check className="size-4 shrink-0" aria-hidden /> : <Copy className="size-4 shrink-0" aria-hidden />}
      <span className="sr-only">{copied ? 'Copied' : `Copy ${label}`}</span>
    </button>
  )
}

function ResultField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-zinc-100 py-3.5 last:border-b-0 dark:border-zinc-800">
      <dt className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 text-sm font-semibold break-words text-zinc-950 dark:text-zinc-50">
        {value || <span className="font-medium text-zinc-400 dark:text-zinc-500">—</span>}
      </dd>
    </div>
  )
}

function ReservationResult({
  reservation,
  filed,
}: {
  reservation: StoredReservation | null
  filed: string
}) {
  const statusKey = (reservation?.status ?? '').trim().toLowerCase()
  const cancelled = statusKey === 'cancelled' || reservation?.status === 'Not sent'
  const pending = statusKey === 'pending'
  const ItemIcon = reservation?.shop === 'locker' ? LockKeyhole : Shirt
  return (
    <div className="flex h-full min-h-52 flex-1 flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_10px_24px_-20px_rgba(30,5,65,0.45)] sm:p-5 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
            Reservation
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Found</h2>
        </div>
        {reservation ? (
          <ResultStatus
            label={reservation.status}
            tone={cancelled ? 'bad' : pending ? 'warn' : 'ok'}
          />
        ) : null}
      </div>
      {reservation ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
            Reservation ID
          </p>
          <CopyRefButton value={reservation.id} label="reservation ID" />
        </div>
      ) : null}
      <dl className="mt-2 grid min-w-0">
        <ResultField icon={ItemIcon} label="Item" value={reservation?.item ?? ''} />
        {reservation?.shop === 'locker' ? (
          <ResultField
            icon={RefreshCw}
            label="Transaction"
            value={reservation.rentalType === 'renewal' ? 'Renewal' : 'New rental'}
          />
        ) : null}
        {!reservation || reservation.shop === 'merch' ? (
          <ResultField icon={Tag} label="Quantity" value={reservation ? String(reservation.quantity) : ''} />
        ) : null}
        <ResultField icon={Info} label="Total" value={reservation?.total ?? ''} />
        <ResultField icon={CircleUser} label="Name" value={reservation?.name ?? ''} />
        <ResultField icon={GraduationCap} label="Year level" value={reservation?.year ?? ''} />
        <ResultField icon={Clock} label="Filed" value={filed} />
      </dl>
    </div>
  )
}

function TrackResult({ result, filed }: { result: StoredRequest | null; filed: string }) {
  const sent = result?.status === 'Submitted' || result?.status === 'Received'
  const documentName = result?.attachment?.split(/[\\/]/).pop() ?? ''
  return (
    <div className="flex h-full min-h-52 flex-1 flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_10px_24px_-20px_rgba(30,5,65,0.45)] sm:p-5 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
            Request
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Found</h2>
        </div>
        {result ? <ResultStatus label={result.status} tone={sent ? 'ok' : 'bad'} /> : null}
      </div>
      {result ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
            Tracking ID
          </p>
          <CopyRefButton value={result.id} label="tracking ID" />
        </div>
      ) : null}
      <dl className="mt-2 grid min-w-0">
        <ResultField icon={Info} label="Subject" value={result?.subject ?? ''} />
        <ResultField icon={Paperclip} label="Document" value={documentName} />
        <ResultField icon={CircleUser} label="Sender" value={result?.name ?? ''} />
        <ResultField icon={Mail} label="Email" value={result?.email ?? ''} />
        <ResultField icon={Clock} label="Filed" value={filed} />
      </dl>
    </div>
  )
}

function SubjectSelect({
  id,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  id: string
  value: string
  invalid: boolean
  describedBy?: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = `${id}-list`

  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open || mobile) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open, mobile])

  useEffect(() => {
    if (!value) setOpen(false)
  }, [value])

  function openList(index = subjects.findIndex((item) => item.label === value)) {
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom
      setDropUp(spaceBelow < 260 && rect.top > spaceBelow)
    }
    setActive(index < 0 ? 0 : index)
    setOpen(true)
  }

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    document.getElementById(id)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList(event.key === 'ArrowUp' ? subjects.length - 1 : undefined)
        return
      }
      setActive((current) =>
        event.key === 'ArrowDown'
          ? (current + 1) % subjects.length
          : (current - 1 + subjects.length) % subjects.length,
      )
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openList()
      else if (subjects[active]) choose(subjects[active].label)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActive(subjects.length - 1)
    }
  }

  return (
    <div className="relative w-full min-w-0" ref={rootRef}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(fieldClass, 'flex items-center gap-2.5 pr-10 text-left')}
      >
        {value ? <SubjectIcon label={value} /> : null}
        <span className={cn('min-w-0 flex-1 truncate', value ? 'text-zinc-900' : 'text-zinc-400')}>
          {value || 'Select a subject'}
        </span>
      </button>
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-zinc-400 transition-transform',
          open && 'rotate-180',
        )}
      />
      {open && !mobile ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Subject"
          className={cn(
            'absolute right-0 left-0 z-30 max-h-[min(18rem,45svh)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(30,5,65,0.55)]',
            dropUp ? 'bottom-[calc(100%+0.375rem)]' : 'top-[calc(100%+0.375rem)]',
          )}
        >
          <SubjectChoices
            value={value}
            active={active}
            onActive={setActive}
            onChoose={choose}
          />
        </ul>
      ) : null}
      {open && mobile ? (
        <SubjectSheet listId={listId} onClose={() => setOpen(false)}>
          <SubjectChoices
            value={value}
            active={active}
            onActive={setActive}
            onChoose={choose}
          />
        </SubjectSheet>
      ) : null}
    </div>
  )
}

function SubjectChoices({
  value,
  active,
  onActive,
  onChoose,
}: {
  value: string
  active: number
  onActive: (index: number) => void
  onChoose: (label: string) => void
}) {
  return subjects.map((item, index) => {
    const selected = item.label === value
    const Icon = item.icon
    return (
      <li key={item.label} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={selected}
          onMouseEnter={() => onActive(index)}
          onClick={() => onChoose(item.label)}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm',
            index === active
              ? 'bg-brand-50 text-brand-800'
              : selected
                ? 'text-brand-800'
                : 'text-zinc-800 hover:bg-zinc-50',
            selected && 'font-semibold',
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-brand-100">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
          {selected ? <Check className="size-4 shrink-0 text-brand-700" aria-hidden /> : null}
        </button>
      </li>
    )
  })
}

function useSheetDrag(onClose: () => void) {
  const [ty, setTy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const lastY = useRef(0)
  const active = useRef(false)

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    active.current = true
    startY.current = event.clientY
    lastY.current = 0
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!active.current) return
    const dy = Math.max(0, event.clientY - startY.current)
    lastY.current = dy
    setTy(dy)
  }

  function finish() {
    if (!active.current) return
    active.current = false
    setDragging(false)
    if (lastY.current > 88) {
      setTy(window.innerHeight)
      window.setTimeout(onClose, 160)
      return
    }
    setTy(0)
  }

  return {
    dragging,
    sheetStyle: {
      transform: ty ? `translateY(${ty}px)` : undefined,
      transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    },
    overlayStyle: {
      opacity: ty ? Math.max(0.25, 1 - ty / 380) : undefined,
    },
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  }
}

function SubjectSheet({
  listId,
  onClose,
  children,
}: {
  listId: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const { dragging, sheetStyle, overlayStyle, handleProps } = useSheetDrag(onClose)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setPageScrollLocked(true)
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      setPageScrollLocked(false)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end">
      <button
        type="button"
        aria-label="Close subject"
        className="absolute inset-0 bg-brand-950/45"
        style={overlayStyle}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={sheetStyle}
        className={cn(
          'relative flex max-h-[min(78dvh,100dvh-env(safe-area-inset-bottom))] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_60px_-28px_rgba(30,5,65,0.55)]',
          dragging ? '' : 'sheet-up',
        )}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-2 select-none active:cursor-grabbing"
          role="button"
          tabIndex={0}
          aria-label="Drag down to close"
          {...handleProps}
        >
          <span className="block h-1.5 w-12 rounded-full bg-zinc-300" />
        </div>
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 pt-1 pb-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Tag className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold text-zinc-900">
              Subject
            </h2>
            <p className="text-xs text-zinc-500">Select a subject for your request.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label="Subject"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {children}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

function SubjectIcon({ label }: { label: string }) {
  const match = subjects.find((item) => item.label === label)
  if (!match) return <Tag className="size-4 shrink-0 text-zinc-400" aria-hidden />
  const Icon = match.icon
  return <Icon className="size-4 shrink-0 text-brand-700" aria-hidden />
}

function ProcessSteps({
  label,
  steps,
}: {
  label: string
  steps: { title: string; detail: string }[]
}) {
  return (
    <section>
      <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
        {label}
      </h3>
      <ol>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2.5 border-b border-zinc-100 px-4 py-3 last:border-0"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800 tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-zinc-500">{step.detail}</p>
          </div>
        </li>
      ))}
      </ol>
    </section>
  )
}

function HowItWorksSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const titleId = useId()
  const { dragging, sheetStyle, overlayStyle, handleProps } = useSheetDrag(onClose)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setPageScrollLocked(true)
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      setPageScrollLocked(false)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-brand-950/45"
        style={overlayStyle}
        onClick={onClose}
      />
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={sheetStyle}
        className={cn(
          'relative flex max-h-[min(78dvh,100dvh-env(safe-area-inset-bottom))] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_60px_-28px_rgba(30,5,65,0.55)]',
          dragging ? '' : 'sheet-up',
        )}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-2 select-none active:cursor-grabbing"
          role="button"
          tabIndex={0}
          aria-label="Drag down to close"
          {...handleProps}
        >
          <span className="block h-1.5 w-12 rounded-full bg-zinc-300" />
        </div>
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 pt-1 pb-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <CircleHelp className="size-4" aria-hidden />
          </span>
          <h2 id={titleId} className="min-w-0 flex-1 text-[15px] font-semibold text-zinc-900">
            How it works
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] pb-[max(0.75rem,env(safe-area-inset-bottom))] [&::-webkit-scrollbar]:hidden"
        >
          <ProcessSteps label="Request" steps={processSteps} />
          <ProcessSteps label="Merch or locker" steps={reservationSteps} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ScrollCue() {
  return (
    <span className="flex shrink-0 text-brand-600" aria-hidden>
      <span className="relative flex h-5 w-3 items-start justify-center overflow-hidden rounded-full border border-current">
        <span className="scroll-mouse-wheel mt-1 block h-1 w-0.5 rounded-full bg-current" />
      </span>
    </span>
  )
}

function HowItWorks() {
  const [open, setOpen] = useState(false)
  const [moreBelow, setMoreBelow] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open || mobile) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, mobile])

  useEffect(() => {
    if (!open || mobile) return
    const list = listRef.current
    if (!list) return
    const sync = () => {
      setMoreBelow(list.scrollTop + list.clientHeight < list.scrollHeight - 4)
    }
    sync()
    list.addEventListener('scroll', sync, { passive: true })
    return () => list.removeEventListener('scroll', sync)
  }, [open, mobile])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="See how it works"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-full border bg-white text-brand-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs sm:font-semibold',
          open ? 'border-brand-300 bg-brand-50' : 'border-zinc-200 hover:bg-brand-50',
        )}
      >
        <CircleHelp className="size-4 sm:size-3.5" aria-hidden />
        <span className="hidden sm:inline">See how it works</span>
      </button>
      {open && mobile ? <HowItWorksSheet id={panelId} onClose={() => setOpen(false)} /> : null}
      {open && !mobile ? (
        <div
          id={panelId}
          className="absolute top-[calc(100%+0.5rem)] right-0 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_40px_-24px_rgba(30,5,65,0.55)]"
        >
          <div className="flex items-center gap-3 border-b border-zinc-100 px-4 pt-3.5 pb-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-950">How it works</p>
              <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                A request, or a merch or locker reservation.
              </p>
            </div>
            {moreBelow ? <ScrollCue /> : null}
          </div>
          <div
            ref={listRef}
            data-lenis-prevent
            className="max-h-[min(42vh,16rem)] overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ProcessSteps label="Request" steps={processSteps} />
            <ProcessSteps label="Merch or locker" steps={reservationSteps} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PreviewStatus({
  mode,
  label,
  title,
  detail,
}: {
  mode: 'loading' | 'empty'
  label: string
  title: string
  detail: string
}) {
  return (
    <div
      className="flex h-full min-h-full flex-col items-center justify-center px-6 py-10 text-center"
      role="status"
      aria-live="polite"
      aria-busy={mode === 'loading'}
    >
      {mode === 'loading' ? (
        <div
          className="w-full max-w-[13.5rem] rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-[0_8px_24px_-16px_rgba(30,5,65,0.45)]"
          aria-hidden
        >
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-50 text-[9px] font-semibold tracking-wide text-brand-800">
              {label}
            </span>
            <span className="h-2 flex-1 motion-safe:animate-pulse rounded-full bg-zinc-200" />
          </div>
          <div className="mt-4 space-y-2">
            <span className="block h-2 motion-safe:animate-pulse rounded-full bg-zinc-100" />
            <span className="block h-2 motion-safe:animate-pulse rounded-full bg-zinc-100" />
            <span className="block h-2 w-4/5 motion-safe:animate-pulse rounded-full bg-zinc-100" />
          </div>
        </div>
      ) : (
        <span
          className="flex size-12 items-center justify-center rounded-xl bg-white text-[11px] font-semibold tracking-wide text-brand-800 ring-1 ring-zinc-200"
          aria-hidden
        >
          {label}
        </span>
      )}
      <p className="mt-4 text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-zinc-500">{detail}</p>
    </div>
  )
}

function PdfPages({ file }: { file: File }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancel = false
    host.replaceChildren()
    setState('loading')

    async function draw() {
      try {
        const scope = globalThis as typeof globalThis & {
          pdfjsWorker?: { WorkerMessageHandler: unknown }
        }
        if (!scope.pdfjsWorker?.WorkerMessageHandler) {
          const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs')
          scope.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler }
        }
        const data = new Uint8Array(await file.arrayBuffer())
        if (cancel) return
        const pdf = await getDocument({
          data,
          wasmUrl: `${import.meta.env.BASE_URL}pdfjs/`,
          useWasm: false,
        }).promise
        if (cancel) return
        const width = Math.max((host?.clientWidth ?? 640) - 32, 280)
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const page = await pdf.getPage(index)
          if (cancel) return
          const unscaled = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({
            scale: Math.min(2, width / unscaled.width),
          })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.className =
            'mx-auto mb-4 block max-w-full bg-white shadow-[0_8px_24px_-16px_rgba(30,5,65,0.45)]'
          const context = canvas.getContext('2d')
          if (!context) continue
          await page.render({ canvas, canvasContext: context, viewport }).promise
          if (cancel || !host) return
          host.appendChild(canvas)
          if (index === 1) setState('ready')
        }
        if (!cancel) setState('ready')
      } catch {
        if (!cancel) setState('error')
      }
    }

    void draw()
    return () => {
      cancel = true
    }
  }, [file])

  return (
    <div className={state === 'ready' ? 'min-h-full' : 'h-full'}>
      {state === 'loading' ? (
        <PreviewStatus
          mode="loading"
          label="PDF"
          title="Opening preview"
          detail="The first page is being prepared."
        />
      ) : null}
      {state === 'error' ? (
        <PreviewStatus
          mode="empty"
          label="PDF"
          title="This PDF can’t be previewed"
          detail="The file stays attached. Open it on your computer if this window stays blank."
        />
      ) : null}
      <div
        ref={hostRef}
        className={state === 'ready' ? 'p-4' : 'invisible h-0 overflow-hidden'}
      />
    </div>
  )
}

function FilePreview({ file, onClose }: { file: File; onClose: () => void }) {
  const titleId = useId()
  const kind = previewKind(file)
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const { dragging, sheetStyle, overlayStyle, handleProps } = useSheetDrag(onClose)

  useEffect(() => {
    if (kind !== 'image') return
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
      setUrl(null)
    }
  }, [file, kind])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (kind !== 'text') return
    let cancel = false
    file.text().then((value) => {
      if (!cancel) setText(value)
    })
    return () => {
      cancel = true
    }
  }, [file, kind])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setPageScrollLocked(true)
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      setPageScrollLocked(false)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[80] flex',
        mobile ? 'items-end' : 'items-center justify-center p-6',
      )}
    >
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-brand-950/45"
        style={mobile ? overlayStyle : undefined}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={mobile ? sheetStyle : undefined}
        className={cn(
          'relative flex w-full flex-col overflow-hidden bg-white shadow-[0_24px_60px_-28px_rgba(30,5,65,0.55)]',
          mobile
            ? 'h-[min(88dvh,100dvh)] rounded-t-2xl'
            : 'h-[min(80dvh,40rem)] max-w-3xl rounded-2xl',
          mobile && !dragging && 'sheet-up',
        )}
      >
        {mobile ? (
          <div
            className="flex cursor-grab touch-none justify-center rounded-t-2xl bg-white pt-2.5 pb-1 select-none active:cursor-grabbing"
            role="button"
            tabIndex={0}
            aria-label="Drag down to close"
            {...handleProps}
          >
            <span className="block h-1.5 w-12 rounded-full bg-zinc-300" />
          </div>
        ) : null}
        <div
          className={cn(
            'flex shrink-0 items-center gap-3 border-b border-zinc-100 bg-white px-4 py-3',
            mobile ? '' : 'rounded-t-2xl',
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Paperclip className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[15px] font-semibold text-zinc-900">
              {file.name}
            </h2>
            <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-zinc-100">
          {kind === 'image' && url ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <img src={url} alt={file.name} className="max-h-[70dvh] max-w-full object-contain" />
            </div>
          ) : null}
          {kind === 'image' && !url ? (
            <PreviewStatus
              mode="loading"
              label={fileTypeLabel(file)}
              title="Opening preview"
              detail="The image is being prepared."
            />
          ) : null}
          {kind === 'pdf' ? <PdfPages file={file} /> : null}
          {kind === 'text' && text === null ? (
            <PreviewStatus
              mode="loading"
              label="TXT"
              title="Opening preview"
              detail="The text is being prepared."
            />
          ) : null}
          {kind === 'text' && text === '' ? (
            <PreviewStatus
              mode="empty"
              label="TXT"
              title="This file is empty"
              detail="Nothing was found in the text file. It stays attached."
            />
          ) : null}
          {kind === 'text' && text ? (
            <pre className="p-4 text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-800">
              {text}
            </pre>
          ) : null}
          {kind === 'none' ? (
            <PreviewStatus
              mode="empty"
              label={fileTypeLabel(file)}
              title="This file can’t be previewed"
              detail="Word documents stay attached. PDF, image, and text files open in this window."
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({
  label,
  icon: Icon,
  htmlFor,
  error,
  hint,
  required = true,
  children,
}: {
  label: string
  icon: LucideIcon
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-zinc-800">
        <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
        {required ? <span className="text-maroon-700"> *</span> : (
          <span className="font-normal text-zinc-400"> Optional</span>
        )}
      </label>
      <div className="mt-2 min-w-0">{children}</div>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs text-maroon-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <dt className="inline-flex shrink-0 items-center gap-2.5 text-sm text-zinc-500">
        <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-semibold break-words text-zinc-900">
        {value || <span className="font-medium text-zinc-400">—</span>}
      </dd>
    </div>
  )
}

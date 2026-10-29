import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, ChevronLeft, Clock, Flag, Loader2, X } from 'lucide-react'
import {
  announcementKind,
  formatPosted,
  mapAnnouncementRecord,
  relatedAnnouncements,
  type Announcement as BulletinItem,
} from '@/components/home/Announcements'
import { contact, siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Button } from '@/components/ui/button'
import { RichTextContent } from '@/components/ui/RichTextEditor'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  getAnnouncementBySlug,
  listAnnouncements,
} from '@/lib/announcements-api'
import { easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'

export default function Announcement() {
  const { id = '' } = useParams()
  const reduce = useReducedMotion() === true
  const [item, setItem] = useState<BulletinItem | null>(null)
  const [related, setRelated] = useState<BulletinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNotFound(false)
      setItem(null)
      setRelated([])

      const [detail, list] = await Promise.all([
        getAnnouncementBySlug(id),
        listAnnouncements(),
      ])

      if (cancelled) return

      if (!detail.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const mapped = mapAnnouncementRecord(detail.data.item)
      setItem(mapped)

      const all = list.ok ? list.data.items.map(mapAnnouncementRecord) : [mapped]
      setRelated(relatedAnnouncements(all, mapped.id))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const previous = document.title
    document.title = item
      ? `${item.title} · ${siteName.short} ${siteName.unit}`
      : `Announcement · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [item])

  if (loading) {
    return (
      <main id="main-content" className="bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-20 text-sm text-zinc-500 sm:px-6 lg:px-8">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading announcement…
        </div>
      </main>
    )
  }

  if (notFound || !item) {
    return (
      <main id="main-content" className="bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
          <BackLink />
          <h1 className="mt-8 font-hero text-[clamp(1.85rem,0.9rem+3vw,3rem)] leading-[0.95] font-normal tracking-tight text-brand-950">
            Announcement not found
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">
            This item is not on the bulletin. Return to the latest announcements.
          </p>
        </div>
      </main>
    )
  }

  const kind = announcementKind(item.kind)
  const Icon = kind.icon

  return (
    <main id="main-content" className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-[clamp(1.25rem,0.85rem+1vw,2rem)] lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <BackLink />
          <ReportButton item={item} />
        </div>

        <Reveal>
          <article className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_40px_-28px_rgba(30,5,65,0.45)] sm:mt-6">
            <div className="grid lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
              <img
                src={item.image}
                alt=""
                width={960}
                height={1280}
                className="h-52 w-full bg-zinc-100 object-cover sm:h-72 lg:aspect-[3/4] lg:h-auto"
              />
              <div className="flex min-w-0 flex-col justify-center px-4 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
                <SectionKicker icon={Icon}>{kind.label}</SectionKicker>
                <h1 className="mt-3 font-hero text-[clamp(1.7rem,1.15rem+1.8vw,3.25rem)] leading-[0.98] font-normal tracking-tight text-balance text-brand-950 sm:mt-4 sm:leading-[0.95]">
                  {item.title}
                </h1>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 sm:mt-4">
                  <Clock className="size-3.5 shrink-0 text-brand-700" aria-hidden />
                  <time dateTime={item.date}>{formatPosted(item.date)}</time>
                </p>
                <p className="mt-4 max-w-2xl font-display text-base leading-7 text-zinc-700 sm:mt-6 sm:text-[clamp(1.05rem,0.95rem+0.4vw,1.25rem)] sm:leading-relaxed">
                  {item.summary}
                </p>
                {item.body ? (
                  <div className="mt-4 max-w-2xl sm:mt-5">
                    <RichTextContent
                      html={item.body}
                      className="text-sm leading-6 text-zinc-600 sm:text-[15px] sm:leading-7"
                    />
                  </div>
                ) : null}
                {item.external ? (
                  <div className="mt-5 sm:mt-8">
                    <Button asChild size="lg" className="w-full sm:w-auto">
                      <a href={item.href} target="_blank" rel="noreferrer">
                        View on {item.source?.split(' ')[0] ?? 'the source'}
                        <ArrowUpRight className="size-4" aria-hidden />
                      </a>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </Reveal>

        {related.length > 0 ? (
          <section aria-labelledby="related-announcements" className="mt-8 sm:mt-10">
            <h2
              id="related-announcements"
              className="font-display text-lg font-medium text-brand-950"
            >
              More from the bulletin
            </h2>
            <ul className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-3">
              {related.map((entry, index) => {
                const meta = announcementKind(entry.kind)
                const EntryIcon = meta.icon
                return (
                  <motion.li
                    key={entry.id}
                    className="min-w-0"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut, delay: reduce ? 0 : 0.06 * index }}
                  >
                    <Link
                      to={`/announcements/${entry.id}`}
                      className="card-lift group flex h-full min-h-[5.25rem] min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <span className="relative w-[5.5rem] shrink-0 self-stretch overflow-hidden bg-zinc-100 sm:w-28 dark:bg-zinc-800">
                        <img
                          src={entry.image}
                          alt=""
                          width={160}
                          height={160}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col justify-center border-l-2 border-brand-700 px-3.5 py-3 dark:border-brand-400">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                          <EntryIcon className="size-3" aria-hidden />
                          {meta.label}
                        </span>
                        <span className="mt-1 line-clamp-2 font-display text-[0.95rem] leading-5 font-medium text-brand-950 transition-colors duration-200 group-hover:text-brand-700 dark:text-zinc-50 dark:group-hover:text-brand-300">
                          {entry.title}
                        </span>
                        <time
                          dateTime={entry.date}
                          className="mt-1.5 text-[11px] text-zinc-500"
                        >
                          {formatPosted(entry.date)}
                        </time>
                      </span>
                    </Link>
                  </motion.li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function BackLink() {
  return (
    <Link
      to="/#bulletin"
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Back to bulletin
    </Link>
  )
}

const reportReasons = [
  { id: 'incorrect', label: 'Incorrect information' },
  { id: 'link', label: 'Broken or misleading link' },
  { id: 'other', label: 'Something else' },
] as const

type ReportReason = (typeof reportReasons)[number]['id']

function ReportButton({ item }: { item: BulletinItem }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="group inline-flex h-[clamp(2.25rem,1.9rem+1vw,2.75rem)] shrink-0 items-center rounded-full border border-zinc-200 bg-white p-1 pr-[clamp(0.8rem,0.5rem+0.8vw,1.1rem)] text-[clamp(0.8125rem,0.75rem+0.2vw,0.9375rem)] font-semibold whitespace-nowrap text-brand-900 shadow-[0_1px_0_rgba(30,5,65,0.04)] transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="grid size-[clamp(1.65rem,1.45rem+0.55vw,2.15rem)] place-items-center rounded-full bg-brand-600 text-white transition-colors group-hover:bg-brand-700">
          <Flag className="size-[clamp(0.75rem,0.68rem+0.18vw,0.9rem)]" aria-hidden />
        </span>
        <span className="pl-[clamp(0.4rem,0.28rem+0.3vw,0.55rem)]">Report</span>
      </button>
      {open ? <ReportDialog item={item} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function ReportDialog({ item, onClose }: { item: BulletinItem; onClose: () => void }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setPageScrollLocked(true)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => {
      setPageScrollLocked(false)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const picked = reportReasons.find((entry) => entry.id === reason)
    if (!picked) {
      setError('Choose what you want the Council to look at.')
      return
    }
    const detail = note.trim()
    const body = [
      `Announcement: ${item.title}`,
      `Page: ${window.location.href}`,
      `Reason: ${picked.label}`,
      detail ? `\n${detail}` : '',
    ].join('\n')
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(`Report: ${item.title}`)}&body=${encodeURIComponent(body)}`
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/45"
        aria-label="Close report"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        className="sheet-up relative flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_60px_-28px_rgba(30,5,65,0.55)] outline-none sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Flag className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold text-brand-950">
              Report this announcement
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-zinc-500">
              Opens an email to the Student Council. Nothing is stored on this website.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-brand-950"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <fieldset>
              <legend className="text-sm font-medium text-brand-950">Reason</legend>
              <div className="mt-2 grid gap-2">
                {reportReasons.map((entry) => {
                  const selected = reason === entry.id
                  return (
                    <label
                      key={entry.id}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-medium transition-colors',
                        selected
                          ? 'border-brand-600 bg-brand-50 text-brand-900'
                          : 'border-zinc-200 text-brand-950 hover:bg-zinc-50',
                      )}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={entry.id}
                        checked={selected}
                        onChange={() => {
                          setReason(entry.id)
                          setError('')
                        }}
                        className="size-4 accent-brand-700"
                      />
                      {entry.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <label className="mt-4 block text-sm font-medium text-brand-950">
              Details
              <span className="ml-1.5 font-normal text-zinc-500">Optional</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="What should the Council look at?"
                className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm font-normal text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            </label>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-maroon-600">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2 border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="flex-1">
              Email the Council
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

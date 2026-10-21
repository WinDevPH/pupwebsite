import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, Flag, Loader2, X } from 'lucide-react'
import { contact, siteName } from '@/components/layout/nav-data'
import { mapProjectRecord, type Project as ProjectItem } from '@/components/home/project-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Button } from '@/components/ui/button'
import { RichTextContent } from '@/components/ui/RichTextEditor'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { getProjectBySlug, listProjects } from '@/lib/projects-api'
import { cn } from '@/lib/utils'

const councilReports = [
  'Quarterly liquidations',
  'Budget allocations',
  'Semester-end accomplishment reports',
] as const

export default function Project() {
  const { slug = '' } = useParams()
  const [project, setProject] = useState<ProjectItem | null>(null)
  const [others, setOthers] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setProject(null)
    void Promise.all([getProjectBySlug(slug), listProjects()]).then(([detail, list]) => {
      if (cancelled) return
      if (!detail.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const mapped = mapProjectRecord(detail.data.item)
      setProject(mapped)
      if (list.ok) {
        setOthers(
          list.data.items
            .map(mapProjectRecord)
            .filter((item) => item.slug !== mapped.slug),
        )
      } else {
        setOthers([])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const previous = document.title
    document.title = project
      ? `${project.label} · ${siteName.short} ${siteName.unit}`
      : `Project · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [project])

  if (loading) {
    return (
      <main id="main-content" className="bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-24 text-sm text-zinc-500">
          <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
          Loading project…
        </div>
      </main>
    )
  }

  if (notFound || !project) {
    return (
      <main id="main-content" className="bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
          <BackLink />
          <h1 className="mt-8 font-hero text-[clamp(1.85rem,0.9rem+3vw,3rem)] leading-[0.95] font-normal tracking-tight text-brand-950">
            Project not found
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">
            This project is not on the list. Return to Student Council in Action.
          </p>
        </div>
      </main>
    )
  }

  const Icon = project.icon
  const facebook = contact.socials.find((item) => item.name === 'Facebook')
  const links = facebook
    ? [...project.links, { label: `Facebook ${facebook.handle}`, href: facebook.href }]
    : project.links

  return (
    <main id="main-content" className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <BackLink />
          <ReportButton project={project} />
        </div>

        <Reveal>
          <article className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:mt-5">
            <div className="lg:grid lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-stretch">
              <img
                src={project.image}
                alt=""
                width={768}
                height={1024}
                className="h-[clamp(11rem,18vw,17.5rem)] w-full bg-zinc-100 object-cover lg:h-full lg:min-h-[22rem]"
              />
              <div className="px-4 py-5 sm:px-8 sm:py-8 lg:flex lg:flex-col lg:justify-center">
                <SectionKicker icon={Icon}>Project</SectionKicker>
                <h1 className="mt-2 font-hero text-[clamp(1.75rem,1.2rem+1.6vw,2.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
                  {project.label}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base sm:leading-7">
                  {project.summary}
                </p>
                {project.body ? (
                  <div className="mt-4 max-w-2xl">
                    <RichTextContent html={project.body} className="text-sm leading-6 text-zinc-600 sm:text-[15px]" />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="px-4 pb-5 sm:px-8 sm:pb-8">
              <div className="grid gap-6 border-t border-zinc-200 pt-6 sm:gap-8 sm:pt-8 md:grid-cols-2">
                <section aria-labelledby="project-links" className="min-w-0">
                  <h2 id="project-links" className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                    Links
                  </h2>
                  <ul className="mt-1 divide-y divide-zinc-200">
                    {links.map((link) => (
                      <li key={link.label}>
                        <DetailLink link={link} />
                      </li>
                    ))}
                  </ul>
                </section>

                <section aria-labelledby="project-reports" className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="project-reports" className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                      Reports
                    </h2>
                    <span className="text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">In progress</span>
                  </div>
                  <ul className="mt-1 divide-y divide-zinc-200">
                    {councilReports.map((title) => (
                      <li key={title} className="py-3 text-sm font-semibold text-brand-950">
                        {title}
                      </li>
                    ))}
                    <li>
                      <Link
                        to="/transparency#reports"
                        className="group flex min-h-12 items-center justify-between gap-3 py-3 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        <span className="min-w-0">Open the reports archive</span>
                        <ArrowUpRight className="size-4 shrink-0 text-zinc-400 group-hover:text-brand-700" aria-hidden />
                      </Link>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </article>
        </Reveal>

        <section aria-labelledby="other-projects" className="mt-8 sm:mt-10">
          <h2 id="other-projects" className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Other projects
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {others.map((item) => (
              <li key={item.slug} className="min-w-0">
                <Link
                  to={`/projects/${item.slug}`}
                  className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  <span className="block aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100">
                    <img
                      src={item.image}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-2 block text-sm leading-5 font-semibold text-brand-950 group-hover:text-brand-700">
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

function BackLink() {
  return (
    <Link
      to="/#projects"
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Back to projects
    </Link>
  )
}

function DetailLink({ link }: { link: { label: string; to?: string; href?: string } }) {
  const className =
    'group flex min-h-12 items-center justify-between gap-3 py-3 text-sm font-semibold text-brand-950 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
  const inner = (
    <>
      <span className="min-w-0">{link.label}</span>
      <ArrowUpRight className="size-4 shrink-0 text-zinc-400 group-hover:text-brand-700" aria-hidden />
    </>
  )
  if (link.href) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={link.to ?? '/'} className={className}>
      {inner}
    </Link>
  )
}

const reportReasons = [
  { id: 'incorrect', label: 'Incorrect information' },
  { id: 'link', label: 'Broken or misleading link' },
  { id: 'other', label: 'Something else' },
] as const

type ReportReason = (typeof reportReasons)[number]['id']

function ReportButton({ project }: { project: ProjectItem }) {
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
      {open ? <ReportDialog project={project} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function ReportDialog({ project, onClose }: { project: ProjectItem; onClose: () => void }) {
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
      `Project: ${project.label}`,
      `Page: ${window.location.href}`,
      `Reason: ${picked.label}`,
      detail ? `\n${detail}` : '',
    ].join('\n')
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(`Report: ${project.label}`)}&body=${encodeURIComponent(body)}`
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
              Report this project
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

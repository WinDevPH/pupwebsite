import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, ChevronRight, Flag, Loader2, Maximize2, X } from 'lucide-react'
import { contact, projectCategoryFromSlug, siteName } from '@/components/layout/nav-data'
import { mapProjectRecord, type Project as ProjectItem } from '@/components/home/project-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Button } from '@/components/ui/button'
import { RichTextContent } from '@/components/ui/RichTextEditor'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { getProjectBySlug, listProjects } from '@/lib/projects-api'
import { cn } from '@/lib/utils'

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
            .filter((item) => item.slug !== mapped.slug && item.category === mapped.category),
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

  return (
    <main id="main-content" className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <BackLink category={project.category} />
          <ReportButton project={project} />
        </div>

        <Reveal>
          <article className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:mt-5">
            <div className="lg:grid lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-stretch">
              <ProjectGallery
                key={project.slug}
                images={project.images.length ? project.images : [project.image]}
                label={project.label}
              />
              <div className="px-4 py-5 sm:px-8 sm:py-8 lg:flex lg:flex-col lg:justify-center">
                <SectionKicker icon={Icon}>
                  {projectCategoryFromSlug(project.category)?.label ?? 'Project'}
                </SectionKicker>
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
          </article>
        </Reveal>

        <OtherProjectsSlider items={others} />
      </div>
    </main>
  )
}

function OtherProjectsSlider({ items }: { items: ProjectItem[] }) {
  const visible = items.slice(0, 4)
  const count = visible.length
  const canSlide = count > 1

  if (!count) return null

  return (
    <section aria-labelledby="other-projects" className="mt-8 sm:mt-10">
      <h2 id="other-projects" className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
        Other projects
      </h2>

      <ul
        data-lenis-prevent
        role="region"
        aria-roledescription="carousel"
        aria-label="Other projects"
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:auto-rows-fr sm:grid-cols-2 sm:overflow-visible sm:snap-none lg:grid-cols-4"
      >
          {visible.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.slug}
                className={cn(
                  'h-full shrink-0 snap-start sm:min-w-0 sm:w-auto sm:shrink',
                  canSlide ? 'w-[calc(100%-3.75rem)]' : 'w-full',
                )}
              >
                <Link
                  to={`/projects/${item.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-[0_16px_32px_-24px_rgba(30,5,65,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  <span className="relative block aspect-[16/10] overflow-hidden bg-zinc-100">
                    <img
                      src={item.image}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <div className="flex min-h-10 items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <h3 className="flex min-h-10 min-w-0 flex-1 items-center">
                        <span className="line-clamp-2 overflow-hidden text-[13px] leading-5 font-semibold break-words text-brand-950 transition-colors group-hover:text-brand-700">
                          {item.label}
                        </span>
                      </h3>
                    </div>
                    <p className="line-clamp-2 min-h-10 max-h-10 overflow-hidden text-left text-xs leading-5 break-words text-zinc-500">
                      {item.summary || 'Updates for this project are posted on the bulletin.'}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                      <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                        Project
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                        View project
                        <ArrowUpRight
                          className="size-3.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
    </section>
  )
}

function BackLink({ category }: { category?: string }) {
  const program = projectCategoryFromSlug(category)
  return (
    <Link
      to={program?.to ?? '/projects'}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <ChevronLeft className="size-4" aria-hidden />
      <span className="sm:hidden">Back</span>
      <span className="hidden sm:inline">
        {program ? `Back to ${program.label}` : 'Back to projects'}
      </span>
    </Link>
  )
}

function ProjectGallery({ images, label }: { images: string[]; label: string }) {
  const pics = images.filter(Boolean)
  const count = pics.length
  const [active, setActive] = useState(0)
  const [preview, setPreview] = useState(false)
  const current = pics[active] ?? pics[0]

  function go(next: number) {
    if (count < 2) return
    setActive(((next % count) + count) % count)
  }

  if (count === 0) {
    return <div className="h-[clamp(11rem,18vw,17.5rem)] w-full bg-zinc-100 lg:h-full lg:min-h-[22rem]" />
  }

  return (
    <>
      <div className="group/gallery relative h-[clamp(11rem,18vw,17.5rem)] w-full overflow-hidden bg-zinc-100 lg:h-full lg:min-h-[22rem]">
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="relative block size-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
          aria-label={count > 1 ? `Preview image ${active + 1} of ${count}` : `Preview ${label}`}
        >
          {pics.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              width={768}
              height={1024}
              className={cn(
                'absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out',
                index === active ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}
          <span className="absolute top-3 right-3 hidden items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-opacity sm:inline-flex sm:opacity-0 sm:group-hover/gallery:opacity-100">
            <Maximize2 className="size-3.5" aria-hidden />
            Preview
          </span>
        </button>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(active - 1)}
              className="absolute top-1/2 left-2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-950 shadow-sm ring-1 ring-black/10 transition-opacity hover:bg-white sm:inline-flex sm:opacity-0 sm:group-hover/gallery:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(active + 1)}
              className="absolute top-1/2 right-2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-950 shadow-sm ring-1 ring-black/10 transition-opacity hover:bg-white sm:inline-flex sm:opacity-0 sm:group-hover/gallery:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/50 to-transparent px-3 pt-10 pb-3">
              <div className="flex items-center justify-center gap-1.5 overflow-x-auto">
                {pics.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    aria-current={index === active || undefined}
                    onClick={() => go(index)}
                    className={cn(
                      'size-9 shrink-0 overflow-hidden rounded-lg ring-2 transition-[box-shadow,opacity]',
                      index === active
                        ? 'opacity-100 ring-white'
                        : 'opacity-70 ring-transparent hover:opacity-100',
                    )}
                  >
                    <img src={src} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {preview && current ? (
        <ProjectImagePreview
          images={pics}
          active={active}
          label={label}
          onClose={() => setPreview(false)}
          onGo={go}
        />
      ) : null}
    </>
  )
}

function ProjectImagePreview({
  images,
  active,
  label,
  onClose,
  onGo,
}: {
  images: string[]
  active: number
  label: string
  onClose: () => void
  onGo: (next: number) => void
}) {
  const count = images.length
  const current = images[active]
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPageScrollLocked(true)
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onGo(active + 1)
      if (event.key === 'ArrowLeft') onGo(active - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      setPageScrollLocked(false)
      window.removeEventListener('keydown', onKey)
    }
  }, [active, onClose, onGo])

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/88 backdrop-blur-md"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} image ${active + 1} of ${count}`}
        data-lenis-prevent
        className="relative flex h-full flex-col"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{label}</p>
            <p className="mt-0.5 text-xs tracking-[0.14em] text-white/55 uppercase">
              {count > 1
                ? `${String(active + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
                : 'Preview'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16 sm:pb-6">
          {count > 1 ? (
            <button
              type="button"
              className="absolute top-1/2 left-3 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 sm:inline-flex"
              aria-label="Previous image"
              onClick={() => onGo(active - 1)}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          ) : null}

          <img
            src={current}
            alt=""
            width={1600}
            height={1200}
            className="max-h-full max-w-full rounded-xl object-contain shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)]"
          />

          {count > 1 ? (
            <button
              type="button"
              className="absolute top-1/2 right-3 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-950 ring-1 ring-black/5 transition-colors hover:bg-brand-50 sm:inline-flex"
              aria-label="Next image"
              onClick={() => onGo(active + 1)}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="flex justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15"
              aria-label="Previous image"
              onClick={() => onGo(active - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Prev
            </button>
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-white text-sm font-semibold text-brand-950"
              aria-label="Next image"
              onClick={() => onGo(active + 1)}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {count > 1 ? (
          <div className="hidden justify-center gap-2 px-4 pb-5 sm:flex">
            {images.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                aria-label={`Show image ${index + 1}`}
                aria-current={index === active || undefined}
                onClick={() => onGo(index)}
                className={cn(
                  'size-14 overflow-hidden rounded-xl ring-2 transition-[box-shadow,opacity]',
                  index === active
                    ? 'opacity-100 ring-white'
                    : 'opacity-50 ring-transparent hover:opacity-90',
                )}
              >
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
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

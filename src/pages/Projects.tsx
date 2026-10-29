import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, FolderKanban, Loader2, Search } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { projectArtSrc } from '@/components/home/ProjectArt'
import { mapProjectRecord, type Project } from '@/components/home/project-data'
import {
  projectPillars,
  projectPillarFromSlug,
  siteName,
  type ProjectPillar,
} from '@/components/layout/nav-data'
import ProjectDetail from '@/pages/Project'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { listProjects } from '@/lib/projects-api'
import { cn } from '@/lib/utils'

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

function matchesProject(item: Project, needle: string) {
  if (!needle) return true
  return `${item.label} ${item.summary}`.toLowerCase().includes(needle)
}

export function ProjectsRoute() {
  const { slug } = useParams()
  const pillar = projectPillarFromSlug(slug)
  if (pillar) return <Projects pillar={pillar} />
  return <ProjectDetail />
}

export default function Projects({ pillar }: { pillar?: ProjectPillar }) {
  const [items, setItems] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void listProjects(pillar ? { category: pillar.slug } : undefined).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setItems([])
        setError(result.error)
        setLoading(false)
        return
      }
      setItems(result.data.items.map(mapProjectRecord))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [pillar])

  useEffect(() => {
    const previous = document.title
    document.title = `${pillar?.label ?? 'Projects'} · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [pillar])

  const needle = query.trim().toLowerCase()
  const sections = useMemo(() => {
    const cats = pillar ? [pillar] : [...projectPillars]
    return cats.map((cat) => ({
      pillar: cat,
      items: items.filter(
        (item) => item.category === cat.slug && matchesProject(item, needle),
      ),
    }))
  }, [items, needle, pillar])

  const visibleCount = sections.reduce((sum, section) => sum + section.items.length, 0)

  return (
    <>
      <section
        aria-labelledby="projects-page-title"
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
            <motion.div variants={rise}>
              <SectionKicker icon={FolderKanban}>Student Council in Action</SectionKicker>
            </motion.div>
            <motion.h1
              id="projects-page-title"
              variants={rise}
              className="mt-3 max-w-4xl font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              {pillar ? (
                <>
                  {pillar.headlineLead}
                  <br />
                  <span className="text-brand-600">{pillar.headlineAccent}</span>
                </>
              ) : (
                <>
                  Projects and
                  <br />
                  <span className="text-brand-600">Initiatives</span>
                </>
              )}
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-[15px]"
            >
              {pillar?.description ??
                'Programs the Student Council runs for law students, grouped by internal welfare, external partnerships, and institutional sustainability.'}
            </motion.p>
          </motion.div>
        </div>
      </section>

      <main id="main-content" className="bg-white">
        <div className="bg-[#f6f5fb]">
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <label className="relative w-full max-w-5xl">
              <span className="sr-only">Search projects</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
          {loading ? (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading projects…
            </p>
          ) : null}

          {!loading && error ? (
            <EmptyState title="Projects unavailable" body={error} />
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <EmptyState
              title="No projects published yet"
              body="Council programs and initiatives will appear here once they are published."
            />
          ) : null}

          {!loading && !error && items.length > 0 && visibleCount === 0 ? (
            <EmptyState
              title="No matching projects"
              body="Try another word, or clear the search to see every initiative."
            />
          ) : null}

          {!loading && !error && visibleCount > 0 ? (
            <div className="space-y-12">
              {sections.map((section) => {
                if (section.items.length === 0 && (pillar || needle)) return null
                const Icon = section.pillar.icon
                return (
                  <section
                    key={section.pillar.slug}
                    aria-labelledby={`program-${section.pillar.slug}`}
                  >
                    {!pillar ? (
                      <div className="mb-5 max-w-3xl">
                        <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
                          <Icon className="size-3.5" aria-hidden />
                          Program
                        </p>
                        <h2
                          id={`program-${section.pillar.slug}`}
                          className="mt-2 font-hero text-[clamp(1.6rem,1rem+1.8vw,2.25rem)] leading-[1.05] tracking-tight text-brand-950"
                        >
                          <Link
                            to={section.pillar.to}
                            className="hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                          >
                            {section.pillar.label}
                          </Link>
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-zinc-500">
                          {section.pillar.description}
                        </p>
                      </div>
                    ) : (
                      <h2 id={`program-${section.pillar.slug}`} className="sr-only">
                        {section.pillar.label}
                      </h2>
                    )}

                    {section.items.length === 0 ? (
                      <EmptyState
                        title="Nothing published in this program yet"
                        body="Items added in admin will appear here with a title, description, images, and link."
                      />
                    ) : (
                      <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {section.items.map((item, index) => (
                          <li key={item.slug} className="h-full">
                            <Reveal delay={Math.min(index, 4) * 0.05}>
                              <ProjectCard item={item} />
                            </Reveal>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          ) : null}
        </div>
      </main>
    </>
  )
}

function ProjectCard({ item }: { item: Project }) {
  const Icon = item.icon
  const images = item.images.length > 0 ? item.images : item.image ? [item.image] : []
  const slides = images.length > 0 ? images : [projectArtSrc(item.iconKey)]
  const [paused, setPaused] = useState(false)

  return (
    <Link
      to={`/projects/${item.slug}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-[0_20px_40px_-28px_rgba(30,5,65,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <ProjectCardMedia slides={slides} paused={paused} />

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
            <Icon className="size-4" aria-hidden />
          </span>
          <h3 className="flex min-h-10 min-w-0 flex-1 items-center text-sm leading-5 font-semibold text-brand-950 transition-colors group-hover:text-brand-700">
            <span className="line-clamp-2">{item.label}</span>
          </h3>
        </div>
        <p className="line-clamp-2 min-h-12 text-left text-sm leading-6 text-zinc-500">
          {item.summary || 'Updates for this project are posted on the bulletin.'}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            Project
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
            View project
            <ArrowUpRight
              className="size-4"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  )
}

function ProjectCardMedia({ slides, paused }: { slides: string[]; paused: boolean }) {
  const reduce = useReducedMotion() === true
  const [active, setActive] = useState(0)
  const count = slides.length

  useEffect(() => {
    if (reduce || paused || count < 2) return
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % count)
    }, 4200)
    return () => window.clearInterval(id)
  }, [count, paused, reduce])

  return (
    <span className="relative block aspect-[16/10] shrink-0 overflow-hidden bg-[#f3f0ff]">
      {slides.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          width={768}
          height={480}
          draggable={false}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none',
            index === active ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {count > 1 ? (
        <span className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
          {slides.map((src, index) => (
            <span
              key={`${src}-${index}`}
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color]',
                index === active ? 'w-4 bg-white' : 'w-1.5 bg-white/55',
              )}
            />
          ))}
        </span>
      ) : null}
    </span>
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
      <FolderKanban className="size-10 text-brand-600/40" strokeWidth={1.35} aria-hidden />
      <p className={cn('mt-3 font-semibold text-brand-950')}>{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{body}</p>
    </div>
  )
}

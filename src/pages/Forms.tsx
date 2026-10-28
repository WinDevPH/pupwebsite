import { useEffect, useMemo, useState } from 'react'
import { FileText, FolderOpen, Loader2, Search } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { formsPageDescription, isExternalNavTo, siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { useResourceLibrary } from '@/hooks/useResourceLibrary'
import { listFormGroups, type FormFileRecord, type FormGroupRecord } from '@/lib/forms-api'

const ease = [0.16, 1, 0.3, 1] as const

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

function matchesGroup(group: FormGroupRecord, needle: string) {
  if (!needle) return true
  if (`${group.title} ${group.note ?? ''}`.toLowerCase().includes(needle)) return true
  return (group.files ?? []).some((file) => file.title.toLowerCase().includes(needle))
}

function visibleFiles(group: FormGroupRecord, needle: string) {
  const files = group.files ?? []
  if (!needle) return files
  const groupHit = `${group.title} ${group.note ?? ''}`.toLowerCase().includes(needle)
  if (groupHit) return files
  return files.filter((file) => file.title.toLowerCase().includes(needle))
}

export default function Forms() {
  const library = useResourceLibrary()
  const extraLinks = library.items.filter((item) => item.slug !== 'student-handbook')
  const [groups, setGroups] = useState<FormGroupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const previous = document.title
    document.title = `Forms · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listFormGroups({ withFiles: true }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setGroups([])
        setError(result.error)
        setLoading(false)
        return
      }
      setError('')
      setGroups(result.data.items.filter((group) => (group.files ?? []).length > 0 || group.note))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      groups
        .filter((group) => matchesGroup(group, needle))
        .map((group) => ({ ...group, files: visibleFiles(group, needle) })),
    [groups, needle],
  )
  const visibleExtraLinks = useMemo(
    () =>
      extraLinks.filter((item) => (needle ? item.title.toLowerCase().includes(needle) : true)),
    [extraLinks, needle],
  )

  return (
    <>
      <section
        aria-labelledby="forms-page-title"
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
              Resources
            </motion.p>
            <motion.h1
              id="forms-page-title"
              variants={rise}
              className="mt-3 max-w-none whitespace-nowrap font-hero text-[clamp(2.05rem,0.8rem+4.4vw,4.25rem)] leading-[0.95] font-normal tracking-tight text-brand-950"
            >
              Official <span className="text-brand-600">Forms</span>
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-[15px]"
            >
              {formsPageDescription}
            </motion.p>
          </motion.div>
        </div>
      </section>

      <main id="main-content" className="bg-white">
        <div className="bg-[#f6f5fb]">
          <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <label className="relative w-full max-w-5xl">
              <span className="sr-only">Search forms</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search forms"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+2.4vw,4rem)] sm:px-6 lg:px-8">
          {loading ? (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading forms…
            </p>
          ) : null}

          {!loading && error ? (
            <EmptyState title="Forms unavailable" body={error} />
          ) : null}

          {!loading && !error && groups.length === 0 && extraLinks.length === 0 ? (
            <EmptyState
              title="No forms published yet"
              body="Official forms will appear here once the Council publishes a group."
            />
          ) : null}

          {!loading &&
          !error &&
          groups.length + extraLinks.length > 0 &&
          visible.length === 0 &&
          visibleExtraLinks.length === 0 ? (
            <EmptyState
              title="No matching forms"
              body="Try another word, or clear the search to see every form."
            />
          ) : null}

          {!loading && !error && (visible.length > 0 || visibleExtraLinks.length > 0) ? (
            <Reveal>
              <div className="grid gap-x-16 gap-y-12 md:grid-cols-2">
                {visible.map((group) => (
                  <section key={group.id} aria-labelledby={`form-group-${group.id}`}>
                    <h2
                      id={`form-group-${group.id}`}
                      className="text-lg font-semibold tracking-tight text-brand-950"
                    >
                      {group.title}
                    </h2>
                    {group.note ? (
                      <p className="mt-1 text-sm leading-6 text-zinc-500">{group.note}</p>
                    ) : null}
                    <ul className="mt-3 space-y-1">
                      {(group.files ?? []).map((file) => (
                        <li key={file.id}>
                          <FormFileLink file={file} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {visibleExtraLinks.length > 0 ? (
                  <section aria-labelledby="resource-library-links">
                    <h2
                      id="resource-library-links"
                      className="text-lg font-semibold tracking-tight text-brand-950"
                    >
                      Additional resources
                    </h2>
                    <ul className="mt-3 space-y-1">
                      {visibleExtraLinks.map((item) => (
                        <li key={item.id}>
                          <FormFileLink file={{ id: item.id, title: item.title, url: item.url }} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </Reveal>
          ) : null}
        </div>
      </main>
    </>
  )
}

function FormFileLink({ file }: { file: Pick<FormFileRecord, 'id' | 'title' | 'url'> }) {
  const className =
    'group flex min-h-9 items-center gap-2.5 rounded-md py-1 text-sm text-brand-800 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
  const inner = (
    <>
      <FileText className="size-4 shrink-0 text-brand-600" aria-hidden />
      <span className="min-w-0 underline-offset-2 group-hover:underline">{file.title}</span>
    </>
  )
  if (isExternalNavTo(file.url)) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    )
  }
  return (
    <a href={file.url} className={className}>
      {inner}
    </a>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
      <FolderOpen className="size-10 text-brand-600/40" strokeWidth={1.35} aria-hidden />
      <p className="mt-3 font-semibold text-brand-950">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{body}</p>
    </div>
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

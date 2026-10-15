import { useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Church,
  Gavel,
  GraduationCap,
  Landmark,
  Newspaper,
  Scale,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { organizations, organizationsYear } from '@/components/home/org-directory'

const orgIcons: Record<(typeof organizations)[number]['id'], LucideIcon> = {
  codal: Church,
  lacp: Scale,
  comelec: Vote,
  'research-corps': BookOpen,
  'student-council': Landmark,
  'bar-ops': GraduationCap,
  mcds: Gavel,
  solicitor: Newspaper,
}

const copies = [0, 1] as const

export function Organizations() {
  const location = useLocation()
  const reduce = useReducedMotion() === true
  const scrollerRef = useRef<HTMLUListElement>(null)
  const drag = useRef({ x: 0, left: 0, moved: false })
  const hover = useRef(false)
  const dragging = useRef(false)
  const nudging = useRef(false)
  const speed = useRef(0)

  useLayoutEffect(() => {
    if (location.hash !== '#organizations') return
    const section = document.getElementById('organizations')
    const scroller = document.querySelector('.app-scroll')
    if (!section || !(scroller instanceof HTMLElement)) return
    const top =
      section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      112
    scroller.scrollTop = Math.max(0, top)
  }, [location.hash, location.pathname])

  function halfWidth() {
    const el = scrollerRef.current
    return el ? el.scrollWidth / 2 : 0
  }

  function wrapScroll() {
    const el = scrollerRef.current
    const half = halfWidth()
    if (!el || half <= 0) return
    if (el.scrollLeft >= half) el.scrollLeft -= half
    if (el.scrollLeft < 0) el.scrollLeft += half
  }

  function scrollByCard(direction: 1 | -1) {
    const el = scrollerRef.current
    const card = el?.querySelector('li')
    if (!el || !card || nudging.current) return
    const distance = direction * (card.getBoundingClientRect().width + 16)
    const from = el.scrollLeft
    const start = performance.now()
    nudging.current = true
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700)
      const eased = 1 - (1 - t) ** 3
      let next = from + distance * eased
      const half = halfWidth()
      if (half > 0) {
        while (next >= half) next -= half
        while (next < 0) next += half
      }
      el.scrollLeft = next
      if (t < 1) requestAnimationFrame(step)
      else nudging.current = false
    }
    requestAnimationFrame(step)
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || reduce) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(32, now - last)
      last = now
      const target = hover.current || dragging.current || nudging.current ? 0 : 0.05
      speed.current += (target - speed.current) * Math.min(1, delta / 320)
      if (speed.current > 0.001) {
        el.scrollLeft += delta * speed.current
        wrapScroll()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduce])

  function onPointerDown(event: PointerEvent<HTMLUListElement>) {
    if (event.button !== 0) return
    const el = scrollerRef.current
    if (!el) return
    dragging.current = true
    drag.current = { x: event.clientX, left: el.scrollLeft, moved: false }
    const move = (ev: globalThis.PointerEvent) => {
      const delta = ev.clientX - drag.current.x
      if (Math.abs(delta) > 6) drag.current.moved = true
      el.scrollLeft = drag.current.left - delta
      wrapScroll()
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      dragging.current = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onClickCapture(event: MouseEvent<HTMLUListElement>) {
    if (!drag.current.moved) return
    event.preventDefault()
    event.stopPropagation()
    drag.current.moved = false
  }

  return (
    <section id="organizations" aria-labelledby="organizations-title" className="scroll-mt-28 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={Landmark}>COLmmunity Directory</SectionKicker>
            <h2
              id="organizations-title"
              className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Recognized Student <span className="text-brand-600">Organizations</span>
            </h2>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              Accredited law student organizations for{' '}
              <span className="whitespace-nowrap">{organizationsYear}</span>.
            </p>
          </header>
        </Reveal>

        <div
          className="relative mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)]"
          role="region"
          aria-roledescription="carousel"
          aria-label="Recognized student organizations"
          onMouseEnter={() => {
            hover.current = true
          }}
          onMouseLeave={() => {
            hover.current = false
          }}
        >
          <div aria-hidden className="org-wash pointer-events-none absolute inset-x-0 -top-4 -bottom-2 -z-10">
            <span className="absolute top-8 left-[8%] size-40 rounded-full bg-brand-300/50 blur-3xl" />
            <span className="absolute top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-brand-200/60 blur-3xl" />
            <span className="absolute right-[10%] bottom-6 size-44 rounded-full bg-gold-300/50 blur-3xl" />
          </div>
          <button
            type="button"
            aria-label="Previous organizations"
            onClick={() => scrollByCard(-1)}
            className="org-card-nav absolute top-1/2 left-1 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border text-brand-950 shadow-[0_10px_24px_-16px_rgba(30,5,65,0.55)] backdrop-blur-md transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:left-2"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next organizations"
            onClick={() => scrollByCard(1)}
            className="org-card-nav absolute top-1/2 right-1 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border text-brand-950 shadow-[0_10px_24px_-16px_rgba(30,5,65,0.55)] backdrop-blur-md transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:right-2"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>

          <ul
            ref={scrollerRef}
            data-lenis-prevent
            onPointerDown={onPointerDown}
            onClickCapture={onClickCapture}
            className="flex cursor-grab gap-4 overflow-x-auto overscroll-x-contain px-1 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
          >
            {copies.map((copy) =>
              organizations.map((org) => {
                const Icon = orgIcons[org.id]
                const hidden = copy === 1
                return (
                  <li key={`${org.id}-${copy}`} className="w-[16.5rem] shrink-0" aria-hidden={hidden || undefined}>
                    <a
                      href={org.facebook}
                      target="_blank"
                      rel="noreferrer"
                      tabIndex={hidden ? -1 : undefined}
                      aria-label={hidden ? undefined : `${org.name} on Facebook`}
                      className="org-card group flex h-full flex-col rounded-[1.25rem] border p-3.5 backdrop-blur-xl transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <span className="grid h-36 place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-[#ffffff]">
                        <img
                          src={org.logo}
                          alt=""
                          width={240}
                          height={240}
                          loading="lazy"
                          draggable={false}
                          className="max-h-28 w-auto max-w-[72%] object-contain transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      </span>
                      <span className="org-card-panel mt-3 flex flex-1 flex-col items-center rounded-xl border px-3 py-3 text-center backdrop-blur-md">
                        <h3 className="line-clamp-2 w-full text-center font-display text-[1.05rem] leading-snug font-medium text-balance text-brand-950">
                          {org.name}
                        </h3>
                        <span className="org-card-chip mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase backdrop-blur-sm">
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          {org.short}
                        </span>
                        <span className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors duration-500 group-hover:text-brand-700">
                          <FacebookMark className="size-3.5 text-brand-700" />
                          Facebook
                          <ArrowUpRight
                            className="size-3.5 transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                            aria-hidden
                          />
                        </span>
                      </span>
                    </a>
                  </li>
                )
              }),
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

function FacebookMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />
    </svg>
  )
}

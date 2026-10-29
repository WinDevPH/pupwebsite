import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Images, Play } from 'lucide-react'
import heroCouncil40 from '@/assets/hero/hero-council-4.0.jpg'
import heroCouncil41 from '@/assets/hero/hero-council-4.1.jpg'
import heroCouncil42 from '@/assets/hero/hero-council-4.2.jpg'
import heroCouncil43 from '@/assets/hero/hero-council-4.3.jpg'
import { listHeroSlides } from '@/lib/hero-slides-api'
import studentCouncil from '@/assets/logos/student-council.png'
import studentCouncilMark from '@/assets/logos/student-council-mark.jpg'
import lawStudentsSociety from '@/assets/logos/law-students-society.jpg'
import { Button } from '@/components/ui/button'
import { portalCta } from '@/components/layout/nav-data'
import {
  currentAcademicYearStart,
  formatAcademicYear,
  getCouncilDisplaySettings,
} from '@/lib/council-members-api'

const seals = [
  { src: studentCouncilMark, label: 'College of Law SC' },
  { src: lawStudentsSociety, label: 'Law Students Society' },
  { src: studentCouncil, label: 'Student Council' },
]

const fallbackAcademicYear = formatAcademicYear(currentAcademicYearStart())

const ease = [0.16, 1, 0.3, 1] as const

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="hero-blend relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-zinc-900"
    >
      <Backdrop />

      <div className="relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-8 px-4 pt-[clamp(1.25rem,0.7rem+1.4vw,2.5rem)] pb-[clamp(1.25rem,0.8rem+1.6vw,2.5rem)] sm:gap-10 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10 lg:px-8 xl:gap-14">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
          }}
          className="flex w-full max-w-4xl flex-col items-center text-center lg:max-w-none lg:items-start lg:justify-center lg:text-left"
        >
          <motion.div variants={fadeUp} className="mb-5 sm:mb-6">
            <HeroCouncilRow />
          </motion.div>

          <motion.h1
            id="hero-title"
            variants={fadeUp}
            className="font-hero flex flex-col gap-1.5 text-[2.65rem] leading-[0.9] font-normal tracking-[-0.03em] text-brand-950 sm:text-6xl lg:gap-2 lg:text-[clamp(2.9rem,1.2rem+3.2vw,4.35rem)]"
          >
            <span>
              For the <span className="text-brand-600">Students</span>.
            </span>
            <span>
              For a Better{' '}
              <span className="text-brand-600 whitespace-nowrap lg:mt-[0.08em] lg:block">
                PUP COLmmunity
              </span>
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-[clamp(1rem,0.6rem+1vw,1.25rem)] max-w-2xl text-[clamp(0.9rem,0.82rem+0.25vw,1.0625rem)] leading-relaxed text-zinc-500 sm:hidden"
          >
            The{' '}
            <strong className="font-semibold text-zinc-700">
              PUP College of Law Student Council Website
            </strong>{' '}
            is the official website of the Student Council, designed to
            streamline information and empower the student body with academic
            resources, governance, and student services.
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mt-[clamp(1rem,0.6rem+1vw,1.25rem)] hidden max-w-2xl text-justify text-[clamp(0.875rem,0.8rem+0.18vw,1rem)] leading-6 text-zinc-500 sm:line-clamp-4 sm:block lg:mt-5 lg:max-w-xl"
          >
            The{' '}
            <strong className="font-semibold text-zinc-700">
              PUP College of Law Student Council Website
            </strong>{' '}
            is the official website of the PUP College of Law Student Council
            designed to streamline information dissemination and empower the
            student body. The website centralizes essential academic resources,
            governance transparency, and student services, while integrating
            profiles of recognized law student organizations to create a
            unified platform dedicated to student welfare, support, and
            community engagement.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-6 flex w-full flex-col items-center gap-4 sm:mt-8 sm:w-auto sm:flex-row sm:justify-center lg:justify-start"
          >
            <Button
              asChild
              size="lg"
              className="h-14 w-full rounded-xl px-7 text-base shadow-lg shadow-brand-600/30 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/35 sm:w-auto"
            >
              <Link to={portalCta.to}>{portalCta.label}</Link>
            </Button>
            <Link
              to="/how-it-works"
              className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-transparent py-1.5 pr-6 pl-1.5 text-base font-medium text-brand-700 transition-colors hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center">
                <span aria-hidden className="animate-pulse-shadow absolute inset-0 rounded-full" />
                <span className="relative flex size-10 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Play className="ml-0.5 size-4 fill-current" aria-hidden />
                </span>
              </span>
              How It Works?
            </Link>
          </motion.div>
        </motion.div>

        <HeroCarousel />
      </div>
    </section>
  )
}

function HeroCouncilRow() {
  const [year, setYear] = useState(fallbackAcademicYear)

  useEffect(() => {
    let cancelled = false
    void getCouncilDisplaySettings('officers').then((result) => {
      if (cancelled || !result.ok) return
      const next = result.data.publicYear?.trim()
      if (next) setYear(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link
      to="/about/the-council"
      className="flex items-center justify-center gap-3 text-left lg:justify-start"
    >
      <span className="flex shrink-0">
        {seals.map((seal, index) => (
          <img
            key={seal.src}
            src={seal.src}
            alt={seal.label}
            width={36}
            height={36}
            className={`size-9 rounded-full border-2 border-brand-200 bg-white object-contain p-0.5 dark:border-zinc-700 ${index > 0 ? '-ml-2.5' : ''}`}
          />
        ))}
      </span>
      <span className="min-w-0 text-[13px] leading-snug">
        <span className="block font-semibold text-zinc-800">A.Y. {year}</span>
        <span className="mt-0.5 block text-[12px] text-zinc-500">
          Meet the Council
        </span>
      </span>
    </Link>
  )
}

type HeroSlide = { src: string; alt: string }

const fallbackHeroSlides: HeroSlide[] = [
  {
    src: heroCouncil40,
    alt: 'PUP College of Law students at TAGUYOD Together Toward the Bar, with a Lady Justice banner and purple balloons',
  },
  {
    src: heroCouncil41,
    alt: 'The Solicitor covering a night gathering of PUP College of Law students',
  },
  {
    src: heroCouncil42,
    alt: 'Student Council members at Law in Motion, a legal forum on current national and international issues',
  },
  {
    src: heroCouncil43,
    alt: 'Law in Motion session with speaker Armando Virgil D. Ligutan via Zoom',
  },
]

function HeroCarousel() {
  const reduce = useReducedMotion() === true
  const [slides, setSlides] = useState<HeroSlide[]>(fallbackHeroSlides)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const activeRef = useRef(0)
  const visible = slides.filter((slide) => !failed.has(slide.src))
  const reel = visible.length > 0 ? visible : fallbackHeroSlides
  const count = reel.length
  activeRef.current = active

  useEffect(() => {
    let cancelled = false
    void listHeroSlides().then((result) => {
      if (cancelled || !result.ok || result.data.items.length === 0) return
      setSlides(
        result.data.items.map((item) => ({
          src: item.image,
          alt: item.alt,
        })),
      )
      setActive(0)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (active >= count) setActive(0)
  }, [active, count])

  useEffect(() => {
    if (reduce || paused) return
    const id = window.setInterval(() => {
      setActive((index) => (index + 1) % count)
    }, 5500)
    return () => window.clearInterval(id)
  }, [count, paused, reduce])

  function go(next: number) {
    setActive(((next % count) + count) % count)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const startX = event.clientX
    const startIndex = activeRef.current
    let lastStep = 0

    const move = (ev: globalThis.PointerEvent) => {
      const step = Math.trunc((ev.clientX - startX) / 80)
      if (step === lastStep) return
      lastStep = step
      setActive((((startIndex - step) % count) + count) % count)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(active + 1)
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(active - 1)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease, delay: 0.28 }}
      className="relative w-full min-w-0 max-w-5xl justify-self-center lg:max-w-none"
    >
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Student Council highlights"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="hero-frame-neon relative overflow-hidden rounded-2xl bg-brand-950 p-[5px] select-none dark:bg-[#140a22]"
      >
        <span
          aria-hidden
          className="hero-frame-sheen pointer-events-none absolute inset-y-0 -left-1/4 z-20 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        <div className="relative rounded-[0.85rem] bg-brand-300 p-px dark:bg-brand-800">
          <div className="rounded-[0.8rem] bg-brand-50 p-2 sm:p-2.5 dark:bg-zinc-950">
            <p className="relative mb-1.5 flex min-h-[14px] items-center justify-center sm:mb-2 sm:min-h-[16px]">
              <span aria-hidden className="absolute top-1/2 left-0.5 flex -translate-y-1/2 items-center gap-[5px] sm:left-1 sm:gap-1.5">
                <span className="size-[8px] rounded-full bg-[#ff5f57] ring-1 ring-black/10 sm:size-[9px] dark:ring-black/25" />
                <span className="size-[8px] rounded-full bg-[#febc2e] ring-1 ring-black/10 sm:size-[9px] dark:ring-black/25" />
                <span className="size-[8px] rounded-full bg-[#28c840] ring-1 ring-black/10 sm:size-[9px] dark:ring-black/25" />
              </span>
              <span className="flex items-center justify-center gap-2.5">
                <span aria-hidden className="h-px w-5 bg-brand-400/55 sm:w-8" />
                <span className="font-display text-[10px] leading-none font-semibold tracking-[0.32em] text-brand-900 uppercase sm:text-[11px]">
                  Featured Photos
                </span>
                <span aria-hidden className="h-px w-5 bg-brand-400/55 sm:w-8" />
              </span>
              <span aria-hidden className="absolute top-1/2 right-0.5 -translate-y-1/2 text-brand-800/80 sm:right-1 dark:text-brand-200/80">
                <Images className="size-[11px] sm:size-3" strokeWidth={2.25} />
              </span>
            </p>
            <div className="relative overflow-hidden rounded-lg bg-brand-100 shadow-[inset_0_0_0_1px_rgba(30,5,65,0.08)] dark:bg-zinc-900 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <div className="relative aspect-[16/9] touch-pan-y">
                {reel.map((slide, index) => (
                  <motion.img
                    key={`${slide.src}-${index}`}
                    src={slide.src}
                    alt={index === active ? slide.alt : ''}
                    width={1600}
                    height={900}
                    initial={false}
                    animate={{
                      opacity: index === active ? 1 : 0,
                      scale: index === active ? 1.04 : 1.01,
                    }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.7, ease }
                    }
                    className="absolute inset-0 size-full object-cover object-center"
                    onError={() => {
                      setFailed((prev) => {
                        if (prev.has(slide.src)) return prev
                        const next = new Set(prev)
                        next.add(slide.src)
                        return next
                      })
                    }}
                  />
                ))}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-brand-950/45 to-transparent dark:from-black/50"
                />
              </div>
            </div>

            <p className="sr-only" aria-live="polite">
              Slide {active + 1} of {count}
            </p>

            <div className="flex items-center justify-center gap-1.5 pt-2.5">
              {reel.map((slide, index) => (
                <button
                  key={`${slide.src}-${index}`}
                  type="button"
                  aria-label={`Show highlight ${index + 1}`}
                  aria-current={index === active || undefined}
                  onClick={() => go(index)}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                    index === active
                      ? 'w-5 bg-brand-900'
                      : 'w-1.5 bg-brand-900/25 hover:bg-brand-900/45'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-[#fcfbfe] dark:bg-[#09090b]">
      <div className="hero-wash absolute inset-0" />
      <div className="hero-bloom">
        <span className="hero-bloom-spot hero-bloom-spot--violet" />
        <span className="hero-bloom-spot hero-bloom-spot--gold" />
        <span className="hero-bloom-spot hero-bloom-spot--ink" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-surface to-transparent lg:h-28 dark:from-zinc-950" />
    </div>
  )
}

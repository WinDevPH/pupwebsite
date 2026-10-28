import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'
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
      className="hero-blend relative isolate overflow-hidden bg-white text-zinc-900"
    >
      <Backdrop />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-[clamp(2.25rem,1.4rem+3vw,5rem)] pb-[clamp(2rem,1.2rem+2.5vw,4rem)] sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
          }}
          className="flex w-full max-w-4xl flex-col items-center text-center"
        >
          <motion.div variants={fadeUp} className="mb-5 sm:mb-6">
            <HeroCouncilRow />
          </motion.div>

          <motion.h1
            id="hero-title"
            variants={fadeUp}
            className="font-hero text-[2.45rem] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 sm:text-6xl lg:text-[4.75rem]"
          >
            For the <span className="text-brand-600">Students</span>.
            <br />
            For a Better{' '}
            <span className="text-brand-600 sm:whitespace-nowrap">
              PUP COLmmunity
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-[clamp(1rem,0.6rem+1vw,1.25rem)] max-w-2xl text-[clamp(0.9rem,0.82rem+0.25vw,1.125rem)] leading-relaxed text-zinc-500 sm:hidden"
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
            className="mt-[clamp(1rem,0.6rem+1vw,1.25rem)] hidden max-w-2xl text-[clamp(0.9rem,0.82rem+0.25vw,1.125rem)] leading-relaxed text-zinc-500 sm:block"
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
            className="mt-6 flex w-full flex-col items-center gap-5 sm:mt-8 sm:w-auto sm:flex-row sm:justify-center"
          >
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-xl px-6 shadow-lg shadow-brand-600/30 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/35 sm:w-auto"
            >
              <Link to={portalCta.to}>{portalCta.label}</Link>
            </Button>
            <Link
              to="/how-it-works"
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-transparent py-1.5 pr-5 pl-1.5 text-[15px] font-medium text-brand-700 transition-colors hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
            >
              <span className="relative flex size-9 shrink-0 items-center justify-center">
                <span aria-hidden className="animate-pulse-shadow absolute inset-0 rounded-full" />
                <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Play className="ml-0.5 size-3.5 fill-current" aria-hidden />
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
      className="flex items-center justify-center gap-3 text-left"
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
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const activeRef = useRef(0)
  const count = slides.length
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
      className="relative mt-6 w-full max-w-5xl sm:mt-8"
    >
      <div
        aria-hidden
        className="hero-neon-cast pointer-events-none absolute inset-x-[8%] bottom-[6%] h-[58%] rounded-full"
      />

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
        className="hero-cast relative overflow-hidden rounded-[1.35rem] bg-zinc-100 shadow-[0_28px_50px_-28px_rgba(30,5,65,0.48)] select-none sm:rounded-[1.75rem] dark:bg-zinc-900"
      >
        <div className="relative aspect-[16/9] touch-pan-y">
          {slides.map((slide, index) => (
            <img
              key={`${slide.src}-${index}`}
              src={slide.src}
              alt={index === active ? slide.alt : ''}
              width={1600}
              height={900}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                index === active ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent"
          />
        </div>

        <p className="sr-only" aria-live="polite">
          Slide {active + 1} of {count}
        </p>

        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2 sm:bottom-4">
          {slides.map((slide, index) => (
            <button
              key={`${slide.src}-${index}`}
              type="button"
              aria-label={`Show highlight ${index + 1}`}
              aria-current={index === active || undefined}
              onClick={() => go(index)}
              className={`h-2 rounded-full transition-[width,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                index === active ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-white dark:bg-[#07070b]">
      <div className="hero-wash absolute inset-0 bg-white" />
      <div className="hero-neon">
        <span className="hero-neon-orb hero-neon-orb--violet" />
        <span className="hero-neon-orb hero-neon-orb--gold" />
        <span className="hero-neon-orb hero-neon-orb--maroon" />
        <span className="hero-neon-orb hero-neon-orb--peach" />
      </div>
    </div>
  )
}

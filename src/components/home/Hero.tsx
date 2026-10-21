import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookOpen,
  Clock,
  GraduationCap,
  Lightbulb,
  Play,
  Scale,
  Shield,
} from 'lucide-react'
import heroLawStudents from '@/assets/hero-law-students.png'
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

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-[clamp(2.25rem,1.4rem+3vw,5rem)] pb-0 sm:px-6 lg:px-8">
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
            className="mt-[clamp(1rem,0.6rem+1vw,1.25rem)] max-w-2xl text-[clamp(0.9rem,0.82rem+0.25vw,1.125rem)] leading-relaxed text-zinc-500"
          >
            The{' '}
            <strong className="font-semibold text-zinc-700">
              official website of the PUP College of Law Student Council
            </strong>
            , built to share information and support the student body. Academic
            resources, governance, student services, and recognized
            organizations — in one place.
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

        <HeroCharacters />
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

const sceneChips = [
  { Icon: Scale, className: 'top-[10%] left-[0%] hidden sm:flex', tone: 'text-brand-600' },
  { Icon: BookOpen, className: 'top-[2%] right-[4%] hidden sm:flex', tone: 'text-maroon-600' },
  { Icon: GraduationCap, className: 'top-[20%] right-[-1%] hidden sm:flex', tone: 'text-brand-600' },
  { Icon: Clock, className: 'top-[48%] left-[-1%] hidden sm:flex', tone: 'text-gold-600' },
  { Icon: Lightbulb, className: 'top-[44%] right-[0%] hidden sm:flex', tone: 'text-gold-600' },
  { Icon: Shield, className: 'top-[14%] left-[10%] hidden md:flex', tone: 'text-brand-500' },
] as const

function HeroCharacters() {
  const reduce = useReducedMotion() === true

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease, delay: 0.28 }}
      className="relative -mb-4 mt-6 w-full max-w-5xl sm:-mb-12 sm:mt-8"
    >
      {sceneChips.map(({ Icon, className, tone }, index) => (
        <motion.span
          key={className}
          aria-hidden
          className={`absolute z-10 size-10 items-center justify-center rounded-2xl border border-zinc-100 bg-white shadow-[0_10px_24px_-14px_rgba(30,5,65,0.45)] sm:size-11 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{
            duration: 4.6 + index * 0.35,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: index * 0.28,
          }}
        >
          <Icon className={`size-4 sm:size-[18px] ${tone}`} />
        </motion.span>
      ))}

      <span
        aria-hidden
        className="absolute top-[22%] left-[8%] hidden size-2 rounded-full bg-brand-300 sm:left-[10%] sm:block"
      />
      <span
        aria-hidden
        className="absolute top-[6%] right-[22%] hidden size-1.5 rounded-full bg-gold-400 sm:block"
      />
      <span
        aria-hidden
        className="absolute top-[36%] right-[6%] hidden size-2 rounded-full bg-maroon-300 sm:block"
      />

      <div
        aria-hidden
        className="hero-neon-cast pointer-events-none absolute inset-x-[6%] bottom-[2%] h-[68%] rounded-full"
      />

      <img
        src={heroLawStudents}
        alt="Five illustrated law students with books, folders, and a notebook"
        width={1280}
        height={684}
        className="hero-cast relative mx-auto w-full max-w-[52rem] select-none"
      />
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

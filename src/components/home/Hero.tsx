import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Play } from 'lucide-react'
import councilCutout from '@/assets/council-cutout.webp'
import studentCouncil from '@/assets/logos/student-council.png'
import studentCouncilMark from '@/assets/logos/student-council-mark.jpg'
import lawStudentsSociety from '@/assets/logos/law-students-society.jpg'
import statHours from '@/assets/stats/hours.webp'
import statYears from '@/assets/stats/years.webp'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { portalCta, siteName } from '@/components/layout/nav-data'
import { easeOut } from '@/lib/motion'

const yearsServing = new Date().getFullYear() - siteName.established

type Stat = {
  image: string
  value: string
  label: string
  className: string
  delay: number
}

const stats: Stat[] = [
  {
    image: statYears,
    value: `${yearsServing}+`,
    label: 'Years serving law students',
    className: 'top-[10%] left-[max(0px,calc(50%-37.75rem))]',
    delay: 0.9,
  },
  {
    image: statHours,
    value: 'Mon–Sat',
    label: 'Office & helpdesk hours',
    className: 'bottom-[14%] right-[max(0px,calc(50%-37.75rem))]',
    delay: 1.15,
  },
]

const seals = [
  { src: studentCouncilMark, label: 'College of Law SC' },
  { src: lawStudentsSociety, label: 'Law Students Society' },
  { src: studentCouncil, label: 'Student Council' },
]

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

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-[clamp(2.25rem,1.4rem+3vw,5rem)] sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
          }}
          className="flex w-full max-w-4xl flex-col items-center text-center"
        >
          <motion.div
            variants={fadeUp}
            className="mb-[clamp(0.75rem,0.4rem+1vw,1.25rem)] flex items-center justify-center gap-[clamp(0.5rem,0.25rem+0.8vw,1rem)]"
          >
            {seals.map((seal) => (
              <img
                key={seal.src}
                src={seal.src}
                alt={seal.label}
                width={64}
                height={64}
                className="size-[clamp(2.25rem,1.5rem+2.2vw,4rem)] rounded-full border border-zinc-200 bg-white object-contain p-0.5 shadow-[0_8px_16px_-12px_rgba(30,5,65,0.5)]"
              />
            ))}
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

        <CouncilShowcase />
      </div>
    </section>
  )
}

function Backdrop() {
  const reduce = useReducedMotion() === true

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-white">
      <div className="hero-wash absolute inset-0 bg-[linear-gradient(180deg,white_0%,var(--color-brand-50)_48%,#e4d4fb_100%)]" />
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
      <div className="absolute bottom-[-12%] left-1/2 h-40 w-[min(68rem,120%)] -translate-x-1/2 rounded-[50%] bg-brand-950/8 blur-3xl sm:h-72 sm:bg-brand-950/20" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-brand-950/[0.04] to-transparent sm:h-28 sm:from-brand-950/12" />
    </div>
  )
}

function CouncilShowcase() {
  const reduce = useReducedMotion() === true

  return (
    <div className="relative mt-6 w-full sm:mt-8 lg:mt-4">
      <div
        aria-hidden
        className="absolute inset-x-[4%] top-[6%] bottom-[4%] rounded-[40%] bg-white/90 blur-2xl sm:hidden"
      />
      <div
        aria-hidden
        className="absolute bottom-[1%] left-1/2 h-10 w-[72%] -translate-x-1/2 rounded-[50%] bg-[rgba(30,5,65,0.14)] blur-xl sm:h-32 sm:w-[88%] sm:bg-[rgba(30,5,65,0.42)] sm:blur-3xl"
      />
      <div
        aria-hidden
        className="absolute bottom-[8%] left-1/2 h-6 w-[46%] -translate-x-1/2 rounded-[50%] bg-[rgba(30,5,65,0.16)] blur-md sm:bottom-[5%] sm:h-14 sm:w-[62%] sm:bg-[rgba(30,5,65,0.55)] sm:blur-xl"
      />
      <motion.div
        aria-hidden
        className="hero-stage absolute inset-x-[18%] bottom-[14%] h-1/5 rounded-[50%] bg-brand-100/40 blur-2xl sm:inset-x-[24%] sm:bottom-[10%] sm:h-2/5 sm:bg-brand-200/50 sm:blur-3xl"
        initial={{ opacity: 0.7 }}
        animate={{ opacity: reduce ? 0.6 : 0.4 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease, delay: 0.45 }}
        className="relative z-10 mx-auto w-full max-w-[46rem]"
      >
        <img
          src={councilCutout}
          alt="Officers of the PUP College of Law Student Council"
          width={4096}
          height={2404}
          loading="eager"
          className="relative block w-full drop-shadow-[0_8px_14px_rgba(30,5,65,0.1)] sm:drop-shadow-[0_18px_28px_rgba(30,5,65,0.22)]"
        />
      </motion.div>

      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}

function StatCard({ image, value, label, className, delay }: Stat) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay }}
      className={cn('absolute z-20 hidden xl:block', className)}
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.25, ease }}
        className="flex w-52 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 shadow-[0_10px_24px_-18px_rgba(30,5,65,0.45)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
      >
        <img src={image} alt="" width={256} height={256} loading="lazy" className="size-11 shrink-0" />
        <div className="min-w-0 text-left">
          <p className="font-display text-xl leading-none text-brand-950 dark:text-zinc-50">
            <StatValue value={value} delay={delay} />
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{label}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatValue({ value, delay }: { value: string; delay: number }) {
  const reduce = useReducedMotion() === true
  const parsed = /^(\d+)(\+?)$/.exec(value)
  const count = useMotionValue(0)
  const text = useTransform(count, (latest) => (parsed ? `${Math.round(latest)}${parsed[2]}` : value))

  useEffect(() => {
    const match = /^(\d+)(\+?)$/.exec(value)
    if (!match) return
    if (reduce) {
      count.set(Number(match[1]))
      return
    }
    const controls = animate(count, Number(match[1]), { duration: 1.15, delay, ease: easeOut })
    return () => controls.stop()
  }, [count, delay, reduce, value])

  if (!parsed) return value

  return <motion.span>{text}</motion.span>
}

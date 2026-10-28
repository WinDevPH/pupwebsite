import { useEffect, useRef, useState, type AnimationEvent as ReactAnimationEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Clock, IdCard, Mail, MailCheck, Package, Play, Search, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import requestSubmit from '@/assets/how-it-works/request-submit.jpg'
import requestAck from '@/assets/how-it-works/request-ack.jpg'
import requestReview from '@/assets/how-it-works/request-review.jpg'
import requestReply from '@/assets/how-it-works/request-reply.jpg'
import reserveChoose from '@/assets/how-it-works/reserve-choose.jpg'
import reserveDetails from '@/assets/how-it-works/reserve-details.jpg'
import reserveSend from '@/assets/how-it-works/reserve-send.jpg'
import reserveTrack from '@/assets/how-it-works/reserve-track.jpg'

type FlowStep = { title: string; detail: string; icon: LucideIcon; image: string }

const requestSteps: FlowStep[] = [
  {
    title: 'Submit the request',
    detail: 'A tracking ID is sent to the email you entered.',
    icon: Mail,
    image: requestSubmit,
  },
  {
    title: 'Acknowledgement',
    detail: 'The Council replies within 24 to 48 hours of receipt.',
    icon: Clock,
    image: requestAck,
  },
  {
    title: 'Confidential review',
    detail: 'Grievances and personal inquiries stay with authorized Executive Officers.',
    icon: ShieldCheck,
    image: requestReview,
  },
  {
    title: 'Reply',
    detail: 'Updates are sent back to that same email.',
    icon: MailCheck,
    image: requestReply,
  },
]

const reservationSteps: FlowStep[] = [
  {
    title: 'Choose merch or a locker',
    detail: 'Open Merchandise Reservation or Locker Reservation and pick an item.',
    icon: Package,
    image: reserveChoose,
  },
  {
    title: 'Enter your details',
    detail: 'Name, email, mobile, student ID, and year. Merch also asks for a quantity.',
    icon: IdCard,
    image: reserveDetails,
  },
  {
    title: 'Send the reservation',
    detail: 'The email goes to the Council, and a reservation ID is saved.',
    icon: Bookmark,
    image: reserveSend,
  },
  {
    title: 'Track the reservation ID',
    detail: 'Look up that ID on the Tracking tab.',
    icon: Search,
    image: reserveTrack,
  },
]

const guides = [
  {
    id: 'request',
    label: 'Request',
    text: 'The path a concern takes in the Student Services Portal, from the first email to the reply.',
    steps: requestSteps,
  },
  {
    id: 'reservation',
    label: 'Reservation',
    text: 'The path a merch or locker reservation takes in the Student Services Portal, from the item you pick to the reservation ID.',
    steps: reservationSteps,
  },
] as const

type GuideId = (typeof guides)[number]['id']

export default function HowItWorks() {
  const [guide, setGuide] = useState<GuideId>('request')
  const selected = guides.find((item) => item.id === guide) ?? guides[0]

  return (
    <main id="main-content" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={Play}>Guide</SectionKicker>
            <h1 className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
              How It <span className="text-brand-600">Works</span>
            </h1>
            <div
              role="tablist"
              aria-label="How it works"
              className="mx-auto mt-[clamp(1rem,0.6rem+1vw,1.35rem)] inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-brand-200 bg-brand-50 p-1"
            >
              {guides.map((item) => {
                const on = item.id === guide
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`guide-tab-${item.id}`}
                    aria-selected={on}
                    aria-controls="guide-panel"
                    onClick={() => setGuide(item.id)}
                    className={cn(
                      'inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                      on ? 'bg-white text-brand-950 shadow-sm' : 'text-brand-700 hover:text-brand-950',
                    )}
                  >
                    {item.id === 'request' ? (
                      <Mail className="size-3.5" aria-hidden />
                    ) : (
                      <Bookmark className="size-3.5" aria-hidden />
                    )}
                    {item.label}
                  </button>
                )
              })}
            </div>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              {selected.text}
            </p>
          </header>
        </Reveal>

        <Reveal delay={0.06}>
          <FlowChart steps={selected.steps} panelId="guide-panel" labelledBy={`guide-tab-${selected.id}`} />
        </Reveal>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {selected.id === 'request' ? (
            <>
              <Button asChild size="lg" className="h-12 w-full rounded-xl px-6 sm:w-auto">
                <Link to="/portal">Open the portal</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-xl px-6 sm:w-auto">
                <Link to="/#contact">Contact the Council</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="h-12 w-full rounded-xl px-6 sm:w-auto">
                <Link to="/lockers">Reserve a locker</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-xl px-6 sm:w-auto">
                <Link to="/merch">Reserve merch</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function FlowChart({
  steps,
  panelId,
  labelledBy,
}: {
  steps: readonly FlowStep[]
  panelId: string
  labelledBy: string
}) {
  const reduce = useReducedMotion() === true
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef<number | null>(null)

  function advance(event: ReactAnimationEvent<HTMLSpanElement>) {
    if (reduce || paused || event.animationName !== 'step-progress') return
    setActive((current) => (current + 1) % steps.length)
  }

  useEffect(() => {
    setActive(0)
    setPaused(false)
  }, [steps])

  useEffect(() => {
    return () => {
      if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current)
    }
  }, [])

  function select(index: number, pointerType: string) {
    setActive(index)
    setPaused(true)
    if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current)
    if (pointerType !== 'mouse') {
      resumeTimer.current = window.setTimeout(() => setPaused(false), 7000)
    }
  }

  function hold(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return
    setPaused(true)
  }

  function release(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return
    setPaused(false)
  }

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className="mt-[clamp(1.75rem,1rem+2vw,3rem)]"
      onPointerEnter={hold}
      onPointerLeave={release}
    >
      <div className="mb-5 grid grid-cols-4 gap-2" aria-hidden>
        {steps.map((step, index) => (
          <span key={step.title} className="block h-1.5 overflow-hidden rounded-full bg-brand-100">
            {index < active ? <span className="block h-full w-full bg-brand-600" /> : null}
            {index === active ? (
              <span
                key={active}
                className={cn('block h-full w-full bg-brand-600', !reduce && 'step-progress')}
                style={paused ? { animationPlayState: 'paused' } : undefined}
                onAnimationEnd={reduce ? undefined : advance}
              />
            ) : null}
          </span>
        ))}
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <StepCard
            key={step.title}
            step={step}
            index={index}
            active={index === active}
            onSelect={select}
          />
        ))}
      </ol>
    </div>
  )
}

function StepCard({
  step,
  index,
  active,
  onSelect,
}: {
  step: FlowStep
  index: number
  active: boolean
  onSelect: (index: number, pointerType: string) => void
}) {
  const Icon = step.icon

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-pressed={active}
        onPointerUp={(event) => onSelect(index, event.pointerType)}
        onClick={(event) => {
          if (event.detail === 0) onSelect(index, 'key')
        }}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left transition-[background-color,border-color,box-shadow,transform] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          active
            ? 'border-brand-300 shadow-[0_22px_44px_-26px_rgba(117,36,219,0.72)]'
            : 'border-zinc-200 hover:border-brand-200',
        )}
      >
        <span className="relative aspect-[5/4] overflow-hidden bg-[#f3f0ff]">
          <img
            src={step.image}
            alt=""
            width={1024}
            height={1024}
            className={cn(
              'h-full w-full object-cover object-[center_40%] transition-transform duration-500',
              active ? 'scale-[1.03]' : 'scale-100',
            )}
          />
          <span className="absolute top-3 left-3 flex items-center gap-2">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors duration-300',
                active ? 'bg-brand-600 text-white' : 'bg-white/90 text-brand-700',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          </span>
          <span
            className={cn(
              'absolute top-3 right-3 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-wide shadow-sm',
              active ? 'bg-brand-600 text-white' : 'bg-white/90 text-zinc-500',
            )}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        </span>
        <span className="flex flex-1 flex-col px-5 pt-3 pb-5">
          <span className="text-[15px] font-semibold tracking-tight text-brand-950">{step.title}</span>
          <span className="mt-1.5 text-sm leading-6 text-zinc-500">{step.detail}</span>
        </span>
      </button>
    </li>
  )
}

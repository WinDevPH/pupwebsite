import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mail } from 'lucide-react'
import requestSubmit from '@/assets/how-it-works/request-submit.png'
import requestAck from '@/assets/how-it-works/request-ack.png'
import requestReview from '@/assets/how-it-works/request-review.png'
import requestReply from '@/assets/how-it-works/request-reply.png'
import reserveTrack from '@/assets/how-it-works/reserve-track.png'
import { easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Stop = {
  key: string
  match: string[]
  label: string
  caption: string
  image: string
}

const requestStops: Stop[] = [
  {
    key: 'submitted',
    match: ['submitted'],
    label: 'Submitted',
    caption: 'Your request reached the Council inbox.',
    image: requestSubmit,
  },
  {
    key: 'received',
    match: ['received'],
    label: 'Received',
    caption: 'Officers have acknowledged the filing.',
    image: requestAck,
  },
  {
    key: 'review',
    match: ['in review'],
    label: 'In review',
    caption: 'This is in confidential review.',
    image: requestReview,
  },
  {
    key: 'replied',
    match: ['replied', 'closed'],
    label: 'Replied',
    caption: 'A reply was sent to your email.',
    image: requestReply,
  },
]

const reservationStops: Stop[] = [
  {
    key: 'pending',
    match: ['pending', 'not sent'],
    label: 'Pending',
    caption: 'This reservation is waiting on the Council.',
    image: requestAck,
  },
  {
    key: 'submitted',
    match: ['submitted'],
    label: 'Submitted',
    caption: 'Your reservation is on file.',
    image: requestSubmit,
  },
  {
    key: 'confirmed',
    match: ['confirmed'],
    label: 'Confirmed',
    caption: 'The Council confirmed this reservation.',
    image: requestReview,
  },
  {
    key: 'fulfilled',
    match: ['fulfilled'],
    label: 'Fulfilled',
    caption: 'This reservation is complete.',
    image: requestReply,
  },
]

function stopIndex(stops: Stop[], status: string) {
  const key = status.trim().toLowerCase()
  return stops.findIndex((stop) => stop.match.includes(key))
}

export function TrackJourneyScene({
  pending,
  missing,
  requestStatus,
  reservationStatus,
}: {
  pending: boolean
  missing: boolean
  requestStatus: string | null
  reservationStatus: string | null
}) {
  const reduce = useReducedMotion() === true
  const reservation = Boolean(reservationStatus)
  const cancelled = (reservationStatus ?? '').trim().toLowerCase() === 'cancelled'
  const stops = reservation ? reservationStops : requestStops
  const active = reservation
    ? cancelled
      ? -1
      : stopIndex(reservationStops, reservationStatus ?? '')
    : requestStatus
      ? stopIndex(requestStops, requestStatus)
      : -1
  const found = active >= 0
  const idle = !pending && !missing && !cancelled && !found
  const [demo, setDemo] = useState(0)

  useEffect(() => {
    if (!idle) {
      setDemo(0)
      return
    }
    if (reduce) return
    const hold = demo === stops.length - 1 ? 2600 : 1700
    const id = window.setTimeout(() => {
      setDemo((index) => (index + 1) % stops.length)
    }, hold)
    return () => window.clearTimeout(id)
  }, [demo, idle, reduce, stops.length])

  const display = found ? active : idle && !reduce ? demo : -1
  const fill = display >= 0 ? display / Math.max(1, stops.length - 1) : 0
  const snapBack = idle && display === 0
  const keptImage = useRef(reserveTrack)

  const image = found
    ? stops[active].image
    : pending
      ? requestAck
      : missing || cancelled
        ? keptImage.current || reserveTrack
        : reserveTrack

  keptImage.current = image

  const title = pending
    ? 'Looking it up'
    : missing
      ? 'No match on this path'
      : cancelled
        ? 'Reservation cancelled'
        : found
          ? stops[active].label
          : 'Follow the journey'

  const caption = pending
    ? 'Searching the Council records for this ID.'
    : missing
      ? 'Nothing is filed under that ID yet.'
      : cancelled
        ? 'This reservation is no longer in progress.'
        : found
          ? stops[active].caption
          : 'Enter a tracking or reservation ID.'

  return (
    <section
      aria-label="Request progress"
      className="relative isolate overflow-hidden border-b border-brand-100 bg-[#f3edff] dark:border-zinc-800 dark:bg-[#16111f]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full bg-brand-300/35 blur-3xl dark:bg-brand-700/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -bottom-20 size-56 rounded-full bg-gold-400/25 blur-3xl dark:bg-gold-500/10"
      />

      <div className="relative grid min-h-[13.5rem] items-end sm:min-h-[15rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative flex h-[11.5rem] items-end justify-center overflow-hidden sm:h-[13.5rem] lg:h-full lg:min-h-[15rem]">
          <span
            aria-hidden
            className="absolute bottom-4 left-1/2 h-5 w-[58%] -translate-x-1/2 rounded-[100%] bg-brand-950/10 blur-[6px] dark:bg-black/40"
          />
          <motion.img
            src={image}
            alt=""
            className="illustration-knockout relative z-[1] h-[11rem] w-auto max-w-[min(100%,22rem)] object-contain object-bottom sm:h-[13rem] lg:h-[14.5rem]"
            initial={false}
            animate={
              reduce
                ? { opacity: 1, y: 0 }
                : pending
                  ? { opacity: 1, y: [0, -10, 0] }
                  : { opacity: 1, y: [0, -7, 0] }
            }
            transition={
              reduce
                ? { duration: 0.2 }
                : pending
                  ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
                  : { y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.2 } }
            }
            onError={(event) => {
              event.currentTarget.src = reserveTrack
            }}
          />
        </div>

        <div className="flex flex-col justify-center px-4 pb-4 sm:px-6 sm:pb-5 lg:py-6 lg:pr-8 lg:pl-2">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase dark:text-brand-300">
            {reservation ? 'Reservation scene' : 'Request scene'}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${title}|${caption}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              <h3
                className="mt-1 font-display text-[clamp(1.2rem,0.95rem+0.8vw,1.55rem)] leading-tight text-brand-950 dark:text-zinc-50"
                aria-live="polite"
              >
                {title}
              </h3>
              <p className="mt-1.5 max-w-md text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                {caption}
              </p>
            </motion.div>
          </AnimatePresence>

          <ol className="relative mt-4 grid grid-cols-4 gap-1 sm:mt-5">
            <span
              aria-hidden
              className="absolute top-[0.7rem] right-[12.5%] left-[12.5%] h-1 rounded-full bg-brand-200/80 dark:bg-zinc-700"
            />
            <motion.span
              aria-hidden
              className="absolute top-[0.7rem] left-[12.5%] h-1 w-[75%] origin-left rounded-full bg-brand-600 dark:bg-brand-400"
              initial={false}
              animate={{ scaleX: fill }}
              transition={{ duration: reduce || snapBack ? 0 : 0.7, ease: easeOut }}
            />
            {display >= 0 && !reduce ? (
              <motion.span
                aria-hidden
                className="absolute top-[0.22rem] flex size-6 items-center justify-center rounded-full bg-brand-700 text-white shadow-md dark:bg-brand-500"
                initial={false}
                animate={{ left: `calc(${12.5 + fill * 75}% - 0.75rem)` }}
                transition={{ duration: snapBack ? 0 : 0.7, ease: easeOut }}
              >
                <motion.span
                  animate={{ y: [0, -3, 0], rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Mail className="size-3" strokeWidth={2.4} />
                </motion.span>
              </motion.span>
            ) : null}
            {stops.map((stop, index) => {
              const done = display > index
              const current = display === index
              return (
                <li
                  key={stop.key}
                  aria-current={found && current ? 'step' : undefined}
                  className="relative z-[1] flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-[#f3edff] transition-colors dark:ring-[#16111f]',
                      current
                        ? 'bg-brand-700 text-white dark:bg-brand-500'
                        : done
                          ? 'bg-brand-500 text-white dark:bg-brand-600'
                          : 'bg-white text-zinc-400 ring-1 ring-brand-200 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-700',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      'max-w-[4.6rem] text-center text-[10px] leading-3 font-semibold sm:max-w-none sm:text-[11px]',
                      current
                        ? 'text-brand-800 dark:text-brand-200'
                        : 'text-zinc-500 dark:text-zinc-400',
                    )}
                  >
                    {stop.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

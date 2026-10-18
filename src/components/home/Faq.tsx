import { useEffect, useId, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { useHashScroll } from '@/hooks/useHashScroll'
import { listFaq, type FaqRecord } from '@/lib/faq-api'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/motion'

export function FaqList({ className }: { className?: string }) {
  const [items, setItems] = useState<FaqRecord[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [openId, setOpenId] = useState<number | null>(null)
  const reduce = useReducedMotion() === true
  const baseId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    void listFaq().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setStatus('error')
        return
      }
      setItems(result.data.items)
      setStatus('ready')
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** Answers are CMS HTML: route in-app links through the router instead of a full reload. */
  function onAnswerClick(event: MouseEvent<HTMLParagraphElement>) {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!anchor || !href || anchor.target === '_blank') return
    if (href.startsWith('/') && !href.startsWith('//')) {
      event.preventDefault()
      navigate(href)
    }
  }

  if (status === 'loading') {
    return <p className="py-8 text-center text-sm text-zinc-500">Loading questions…</p>
  }
  if (status === 'error') {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Questions are unavailable right now. Please try again later.
      </p>
    )
  }
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No questions published yet.</p>
  }

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 sm:gap-4', className)}>
      {items.map((item, index) => {
        const open = openId === item.id
        const panelId = `${baseId}-${item.id}`
        const number = String(index + 1).padStart(2, '0')
        return (
          <div
            key={item.id}
            className={cn(
              'h-fit overflow-hidden rounded-2xl border border-zinc-200 bg-white',
              open && 'border-brand-100 bg-brand-50/70',
            )}
          >
            <h3>
              <button
                type="button"
                id={`${panelId}-button`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
              >
                <span className="mt-0.5 w-7 shrink-0 font-display text-sm text-brand-600 tabular-nums">
                  {number}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-6 font-semibold text-brand-950 sm:text-[15px]">
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    'mt-1 size-4 shrink-0 text-brand-700 transition-transform duration-200',
                    open && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={`${panelId}-button`}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: easeOut }}
                  className="overflow-hidden"
                >
                  <p
                    onClick={onAnswerClick}
                    className="pr-4 pb-4 pl-14 text-sm leading-6 text-zinc-600 sm:pr-12 sm:pl-[4.25rem] [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:decoration-brand-200 [&_a]:underline-offset-2 [&_a:hover]:text-brand-600"
                    dangerouslySetInnerHTML={{ __html: item.answerHtml || item.answer }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
export function Faq() {
  useHashScroll('faq')

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-28 bg-surface dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={CircleHelp}>FAQs</SectionKicker>
            <h2
              id="faq-title"
              className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Frequently Asked <span className="text-brand-600">Questions</span>
            </h2>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              Contact, services, reservations, and how the Council handles the information you
              submit.
            </p>
          </header>
        </Reveal>

        <Reveal delay={0.06} className="mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] max-w-5xl">
          <FaqList />
        </Reveal>
      </div>
    </section>
  )
}

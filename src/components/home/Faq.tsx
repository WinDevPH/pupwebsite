import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { contact } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { useHashScroll } from '@/hooks/useHashScroll'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/motion'

const facebook = contact.socials.find((item) => item.name === 'Facebook')
const councilEmail = 'puplawstudentcouncilofficial@gmail.com'

const linkClass =
  'font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:text-brand-600'

function PageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={linkClass}>
      {children}
    </Link>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
      {children}
    </a>
  )
}

const faqs: { id: string; question: string; answer: ReactNode }[] = [
  {
    id: 'contact',
    question: 'How can I contact the Student Council?',
    answer: (
      <>
        You may reach us through our{' '}
        {facebook ? (
          <ExternalLink href={facebook.href}>official Facebook page</ExternalLink>
        ) : (
          'official Facebook page'
        )}{' '}
        or email at{' '}
        <a href={`mailto:${councilEmail}`} className={linkClass}>
          {councilEmail}
        </a>
        .
      </>
    ),
  },
  {
    id: 'follow-up',
    question: 'How can I follow up on my request?',
    answer: (
      <>
        Contact the Student Council through its{' '}
        <PageLink to="/#contact">official channels</PageLink> and provide your submission details.
      </>
    ),
  },
  {
    id: 'academic-support',
    question: 'How can I join academic support programs?',
    answer: (
      <>
        Check the <PageLink to="/announcements">announcements</PageLink> and{' '}
        <a href="#calendar-title" className={linkClass}>
          events calendar
        </a>{' '}
        for upcoming workshops, masterclasses, and registration details.
      </>
    ),
  },
  {
    id: 'printing',
    question: 'How can I avail of the Free Printing Service?',
    answer: (
      <>
        Check the <PageLink to="/projects/free-printing">Free Printing Service</PageLink> page for
        eligibility, guidelines, and operating hours.
      </>
    ),
  },
  {
    id: 'locker',
    question: 'How can I reserve a locker?',
    answer: (
      <>
        Visit the <PageLink to="/services/locker-reservations">Locker Reservations</PageLink> page,
        check availability, and submit the reservation form.
      </>
    ),
  },
  {
    id: 'market',
    question: 'Where can I find merchandise and prices?',
    answer: (
      <>
        Visit the <PageLink to="/market">Market</PageLink> section for available items, prices, and
        claiming instructions.
      </>
    ),
  },
  {
    id: 'activities',
    question: 'How can I participate in Council activities?',
    answer: (
      <>
        Follow the <PageLink to="/announcements">website announcements</PageLink> and official
        social media pages for upcoming activities.
      </>
    ),
  },
  {
    id: 'proposal',
    question: 'How can an organization submit a proposal?',
    answer: (
      <>
        Complete the Student Organization Proposal Form under{' '}
        <PageLink to="/portal">Student Services & Help Desk</PageLink>.
      </>
    ),
  },
  {
    id: 'privacy',
    question: 'How is my personal information handled?',
    answer:
      'Information submitted through website forms should be handled according to the applicable privacy policy and data protection requirements.',
  },
  {
    id: 'confidentiality',
    question: 'Will my grievance remain confidential?',
    answer:
      'Concerns will be handled discreetly and shared only with authorized persons as necessary. Absolute confidentiality cannot always be guaranteed.',
  },
  {
    id: 'website-issue',
    question: 'How do I report a website issue?',
    answer: (
      <>
        Contact the Student Council through its official email at{' '}
        <a href={`mailto:${councilEmail}`} className={linkClass}>
          {councilEmail}
        </a>{' '}
        or the <PageLink to="/#contact">Feedback Form</PageLink>.
      </>
    ),
  },
]

export function FaqList({ className }: { className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const reduce = useReducedMotion() === true
  const baseId = useId()

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white', className)}>
      {faqs.map((item, index) => {
        const open = openId === item.id
        const panelId = `${baseId}-${item.id}`
        const number = String(index + 1).padStart(2, '0')
        return (
          <div
            key={item.id}
            className={cn('border-b border-zinc-100 last:border-b-0', open && 'bg-brand-50/70')}
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
                  <p className="pr-4 pb-4 pl-14 text-sm leading-6 text-zinc-600 sm:pr-12 sm:pl-[4.25rem]">
                    {item.answer}
                  </p>
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
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={CircleHelp}>FAQs</SectionKicker>
            <h2
              id="faq-title"
              className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Frequently asked <span className="text-brand-600">questions</span>
            </h2>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              Contact, services, reservations, and how the Council handles the information you
              submit.
            </p>
          </header>
        </Reveal>

        <Reveal delay={0.06} className="mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] max-w-3xl">
          <FaqList />
        </Reveal>
      </div>
    </section>
  )
}

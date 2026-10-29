import { ArrowUpRight, BookOpen, Scale } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { useHashScroll } from '@/hooks/useHashScroll'
import { useSiteContact } from '@/hooks/useSiteContact'
import { cn } from '@/lib/utils'

export function Grievance({ variant = 'page' }: { variant?: 'page' | 'portal' }) {
  const portal = variant === 'portal'
  useHashScroll(portal ? '__unused__' : 'grievance')
  const { grievanceFormUrl, grievanceGuidelinesUrl } = useSiteContact()

  return (
    <section
      id={portal ? undefined : 'grievance'}
      aria-labelledby="grievance-title"
      className={cn(portal ? 'bg-transparent' : 'scroll-mt-28 bg-white dark:bg-zinc-950')}
    >
      <div
        className={cn(
          portal
            ? 'w-full py-0'
            : 'mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8',
        )}
      >
        {portal ? null : (
          <Reveal>
            <header className="mx-auto max-w-3xl text-center">
              <SectionKicker icon={Scale}>Student Services</SectionKicker>
              <h2
                id="grievance-title"
                className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
              >
                Student <span className="text-brand-600">Grievance</span>
              </h2>
              <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-2xl text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
                Submit and track academic grievances, administrative inquiries, or student welfare
                concerns through a structured and confidential council support channel.
              </p>
            </header>
          </Reveal>
        )}

        <div
          className={cn(
            'grid w-full items-stretch gap-3 sm:gap-4 lg:grid-cols-2',
            portal ? '' : 'mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] max-w-5xl',
          )}
        >
            <Reveal delay={portal ? 0 : 0.06}>
            <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
                File a concern
              </p>
              <h3
                id={portal ? 'grievance-title' : undefined}
                className="mt-2 font-display text-[clamp(1.25rem,0.95rem+0.9vw,1.65rem)] leading-tight text-brand-950"
              >
                Submit a grievance
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-500">
                Use the official form to file an academic, administrative, or welfare concern. The
                Council reviews submissions through a confidential support channel.
              </p>
              <a
                href={grievanceFormUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-[15px] font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
              >
                Open grievance form
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </article>
            </Reveal>

            <Reveal delay={portal ? 0.05 : 0.11}>
            <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
                Guidelines
              </p>
              <h3 className="mt-2 font-display text-[clamp(1.25rem,0.95rem+0.9vw,1.65rem)] leading-tight text-brand-950">
                How concerns are handled
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-500">
                To serve as a guide in streamlining the process of addressing every concern and/or
                grievances of the student body by creating an efficient and centralized system that
                consistently tracks and keeps record of the progression of the filed
                concern/grievance until it is fully addressed.
              </p>
              <a
                href={grievanceGuidelinesUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-6 text-[15px] font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
              >
                <BookOpen className="size-4" aria-hidden />
                Read the guidelines
              </a>
            </article>
            </Reveal>
          </div>
      </div>
    </section>
  )
}

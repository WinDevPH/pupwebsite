import { Link } from 'react-router-dom'
import { Cookie, Mail, ShieldCheck } from 'lucide-react'
import { siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Button } from '@/components/ui/button'

const points = [
  {
    icon: Cookie,
    title: 'Cookie choice',
    text: 'Allow all or Close & deny is stored in your browser so the notice does not appear on every visit. Clearing site data removes that choice.',
  },
  {
    icon: Mail,
    title: 'Feedback messages',
    text: 'Feedback sent from the homepage is stored in the Student Council office portal so officers can read and reply. Use a working email if you want a response.',
  },
  {
    icon: ShieldCheck,
    title: 'No advertising cookies',
    text: `The ${siteName.short} ${siteName.unit} site does not use advertising cookies.`,
  },
]

export default function Privacy() {
  return (
    <main id="main-content" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={ShieldCheck}>Privacy</SectionKicker>
            <h1 className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950">
              Privacy <span className="text-brand-600">Policy</span>
            </h1>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              What the {siteName.short} {siteName.unit} website keeps on your device.
            </p>
          </header>
        </Reveal>

        <ul className="mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] grid max-w-3xl gap-3">
          {points.map((point, index) => (
            <li key={point.title}>
              <Reveal delay={Math.min(index, 4) * 0.05}>
              <article className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:gap-4 sm:p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <point.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <h2 className="text-sm font-semibold text-brand-950">{point.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">{point.text}</p>
                </span>
              </article>
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="h-12 rounded-xl px-6">
            <Link to="/">Return home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

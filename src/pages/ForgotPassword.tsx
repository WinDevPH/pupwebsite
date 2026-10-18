import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronsLeft, Mail } from 'lucide-react'
import logo from '@/assets/pup-col-sc-logo.png'
import { contact, siteName } from '@/components/layout/nav-data'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const forgotMailto = `mailto:${contact.email}?subject=${encodeURIComponent(
  'Request: Student Services Portal password help',
)}&body=${encodeURIComponent(
  [
    'Hello PUP College of Law Student Council,',
    '',
    'I am requesting assistance with my Student Services Portal password.',
    '',
    'Full name:',
    'Student number / year level:',
    'Registered email:',
    '',
    'Thank you.',
  ].join('\n'),
)}`

export default function ForgotPassword() {
  useEffect(() => {
    const previous = document.title
    document.title = `Forgot Password · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-[calc(100dvh-8.5rem)] items-center justify-center bg-white px-4 py-10 sm:px-6 dark:bg-zinc-950"
    >
      <div aria-hidden className="auth-wash pointer-events-none absolute inset-0" />

      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle variant="ghost" bordered />
      </div>

      <div className="auth-card relative w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(30,5,65,0.45)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50">
        <div className="flex flex-col items-center text-center">
          <Link to="/" aria-label={`${siteName.short} ${siteName.unit}, home`}>
            <img
              src={logo}
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-full object-contain ring-2 ring-gold-400"
            />
          </Link>
          <h1 className="mt-5 font-hero text-[clamp(1.85rem,1.3rem+1.4vw,2.5rem)] leading-[0.95] font-normal tracking-tight text-brand-950 dark:text-zinc-50">
            Forgot <span className="text-brand-600 dark:text-brand-400">Password</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Email the Student Council with your name, year level, and registered email.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-3 dark:border-zinc-700 dark:bg-zinc-950/70">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <Mail className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-brand-700 uppercase dark:text-brand-300">
                Student Council email
              </p>
              <p className="truncate text-sm font-medium text-brand-950 dark:text-zinc-50">
                {contact.email}
              </p>
            </div>
          </div>

          <a
            href={forgotMailto}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Mail className="size-4" aria-hidden />
            Email the Student Council
          </a>

          <p className="text-center text-[11px] leading-5 text-zinc-500">
            Office hours: {contact.hours}
          </p>
        </div>

        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-600"
        >
          <ChevronsLeft className="size-4" aria-hidden />
          Back to login
        </Link>
      </div>
    </main>
  )
}

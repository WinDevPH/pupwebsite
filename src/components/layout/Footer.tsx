import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import logo from '@/assets/pup-col-sc-logo.png'
import { contact, footerColumns, footerSocials, siteName } from '@/components/layout/nav-data'
import { Reveal } from '@/components/motion/Reveal'
import { scrollPageTo } from '@/hooks/useLenis'

const year = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="w-full border-t border-zinc-200 bg-white text-zinc-950">
      <Reveal className="mx-auto w-full max-w-7xl px-4 pt-12 pb-5 sm:px-6 sm:pt-14 lg:px-8">
        <div className="grid w-full gap-12 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.5fr)] lg:items-start lg:gap-16">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <Link
              to="/"
              aria-label={`${siteName.short} ${siteName.unit}, home`}
              onClick={() => scrollPageTo(0, false)}
              className="inline-flex items-center gap-3"
            >
              <img
                src={logo}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-full ring-2 ring-gold-400"
              />
              <span className="text-[15px] font-semibold leading-tight tracking-tight">
                {siteName.short}
                <span className="mt-0.5 block text-[11px] font-medium tracking-[0.14em] text-brand-700 uppercase">
                  {siteName.unit}
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-6 text-zinc-500 lg:mx-0">
              The official website of the {siteName.full}. Announcements, student services, and
              council information for law students.
            </p>

            <ul className="mt-4 flex items-center justify-center gap-2 lg:justify-start">
              {footerSocials.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${social.name} ${social.handle}`}
                    title={social.handle}
                    className="flex size-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 transition-colors hover:border-brand-700 hover:text-brand-700"
                  >
                    <SocialGlyph name={social.name} />
                  </a>
                </li>
              ))}
              <li>
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    aria-label={`Email ${contact.email}`}
                    title={contact.email}
                    className="flex size-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 transition-colors hover:border-brand-700 hover:text-brand-700"
                  >
                    <Mail className="size-4" aria-hidden />
                  </a>
                ) : (
                  <span
                    className="flex size-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-300"
                    title="Official email has not been published"
                    aria-label="Official email has not been published"
                  >
                    <Mail className="size-4" aria-hidden />
                  </span>
                )}
              </li>
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-1 gap-x-8 gap-y-10 text-center sm:grid-cols-3 lg:text-left">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="text-sm text-zinc-500 transition-colors hover:text-brand-700"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-zinc-200 pt-5 text-center text-[13px] leading-6 text-zinc-500">
          <p>
            © {year} {siteName.short} {siteName.unit}. All rights reserved.
          </p>
        </div>
      </Reveal>
    </footer>
  )
}

function SocialGlyph({ name }: { name: string }) {
  const paths: Record<string, string> = {
    Facebook:
      'M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z',
    X: 'M17.5 3h3l-6.8 7.8L21.7 21h-6.2l-4.9-6.4L5 21H2l7.3-8.3L1.7 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.2h1.7L6.9 4.7H5.1l11.3 14.5Z',
    Instagram:
      'M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 2.2c-2.7 0-3 0-4 .1-1.1 0-1.8.2-2.4.5-.7.2-1.2.6-1.8 1.1C3.3 4.5 3 5 2.7 5.7c-.2.6-.4 1.3-.4 2.4-.1 1-.1 1.3-.1 4s0 3 .1 4c0 1 .2 1.8.4 2.4.3.6.6 1.2 1.2 1.7.5.6 1.1.9 1.7 1.2.6.2 1.4.4 2.4.4 1.1.1 1.4.1 4 .1s3 0 4-.1c1.1 0 1.8-.2 2.4-.4.7-.3 1.2-.6 1.8-1.2.5-.5.9-1 1.1-1.7.3-.6.4-1.4.5-2.4v-8c-.1-1.1-.2-1.8-.5-2.4-.2-.7-.6-1.2-1.1-1.8-.6-.5-1.1-.9-1.8-1.1-.6-.3-1.3-.5-2.4-.5-1-.1-1.3-.1-4-.1Zm0 1.7c2.6 0 3 0 4 .1.9 0 1.5.2 1.8.3.5.2.8.4 1.1.7.4.4.6.7.7 1.1.2.4.3.9.4 1.9v7.8c-.1 1-.2 1.5-.4 1.9-.1.4-.3.7-.7 1.1-.3.3-.6.5-1.1.7-.3.1-.9.3-1.8.3-1 .1-1.4.1-4 .1s-3 0-4-.1c-.9 0-1.5-.2-1.8-.3-.5-.2-.8-.4-1.1-.7-.4-.4-.6-.7-.7-1.1-.1-.4-.3-.9-.4-1.9V8c.1-1 .3-1.5.4-1.9.1-.4.3-.7.7-1.1.3-.3.6-.5 1.1-.7.3-.1.9-.3 1.8-.3 1-.1 1.4-.1 4-.1Z',
  }

  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d={paths[name] ?? ''} />
    </svg>
  )
}

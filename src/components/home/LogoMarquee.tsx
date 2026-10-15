import { useReducedMotion } from 'motion/react'
import { organizations } from '@/components/home/org-directory'

export function LogoMarquee() {
  const reduce = useReducedMotion() === true

  return (
    <section aria-label="Recognized Student Organizations" className="border-y border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
          Recognized Student Organizations
        </p>
      </div>
      <div
        className={
          reduce
            ? 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'
            : 'mx-auto max-w-7xl overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]'
        }
      >
        <div className={reduce ? 'flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12 lg:gap-x-16 xl:gap-x-20' : 'logo-marquee flex w-max'}>
          <LogoSet />
          {reduce ? null : <LogoSet hidden />}
        </div>
      </div>
    </section>
  )
}

function LogoSet({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {organizations.map((logo) => (
        <li key={logo.id} className="flex items-center px-4 sm:px-6 lg:px-8 xl:px-10">
          <img
            src={logo.logo}
            alt={hidden ? '' : logo.name}
            width={320}
            height={160}
            loading="lazy"
            className="h-9 w-auto max-w-28 object-contain grayscale opacity-55 transition duration-300 hover:grayscale-0 hover:opacity-100 sm:h-11 sm:max-w-36"
          />
        </li>
      ))}
    </ul>
  )
}

import { useReducedMotion } from 'motion/react'
import { useOrganizations, type OrgCard } from '@/hooks/useOrganizations'

export function LogoMarquee() {
  const reduce = useReducedMotion() === true
  const { items } = useOrganizations()
  if (items.length === 0) return null

  return (
    <section
      aria-label="Recognized Student Organizations"
      className="mt-auto shrink-0 border-y border-zinc-200 bg-surface dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div
        className={
          reduce
            ? 'mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8'
            : 'mx-auto max-w-7xl overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]'
        }
      >
        <div className={reduce ? 'flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12 lg:gap-x-16 xl:gap-x-20' : 'logo-marquee flex w-max'}>
          <LogoSet items={items} />
          {reduce ? null : <LogoSet items={items} hidden />}
        </div>
      </div>
    </section>
  )
}

function LogoSet({ items, hidden = false }: { items: OrgCard[]; hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((logo) => (
        <li key={logo.id} className="flex items-center px-4 sm:px-6 lg:px-8 xl:px-10">
          <img
            src={logo.logo}
            alt={hidden ? '' : logo.name}
            width={320}
            height={160}
            loading="lazy"
            className="h-8 w-auto max-w-24 object-contain grayscale opacity-55 transition duration-300 hover:grayscale-0 hover:opacity-100 sm:h-11 sm:max-w-36"
          />
        </li>
      ))}
    </ul>
  )
}

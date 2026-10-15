import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SectionKicker({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn('section-kicker', className)}>
      <span className="section-kicker-icon" aria-hidden>
        <Icon className="size-3" strokeWidth={2.25} />
      </span>
      {children}
    </p>
  )
}

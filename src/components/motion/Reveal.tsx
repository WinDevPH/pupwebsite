import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useScrollContainer } from '@/context/ScrollContext'
import { isAppleTouch } from '@/lib/device'
import { cn } from '@/lib/utils'

const EASE = [0.16, 1, 0.3, 1] as const

/** Intersection root must be `.app-scroll` — the window itself never scrolls. */
export function useRevealViewport(once = true, margin = '0px') {
  const container = useScrollContainer()
  return { once, margin, root: container, amount: 'some' as const }
}

/** Never start a reveal at opacity 0 on phones — a tall grid can miss IntersectionObserver. */
export function useSkipRevealHide() {
  const reduce = useReducedMotion() === true
  if (reduce) return true
  if (typeof window === 'undefined') return false
  return (
    isAppleTouch() ||
    window.matchMedia('(max-width: 767px)').matches ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  )
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const skipHide = useSkipRevealHide()
  const viewport = useRevealViewport()

  if (skipHide) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={cn('reveal-in', className)}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

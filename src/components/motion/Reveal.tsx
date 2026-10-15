import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useScrollContainer } from '@/context/ScrollContext'

const EASE = [0.16, 1, 0.3, 1] as const

/** Intersection root must be `.app-scroll` — the window itself never scrolls. */
export function useRevealViewport(once = true, margin = '-8% 0px') {
  const container = useScrollContainer()
  return { once, margin, root: container, amount: 0.2 }
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
  const reduce = useReducedMotion() === true
  const viewport = useRevealViewport()

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 1.15, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

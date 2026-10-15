import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import { fadeUp, stagger } from '@/lib/motion'

export default function Placeholder() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion() === true

  return (
    <motion.main
      className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={stagger}
    >
      <motion.p
        variants={fadeUp}
        className="text-sm font-semibold tracking-wider text-brand-600 uppercase"
      >
        Coming soon
      </motion.p>
      <motion.h1
        variants={fadeUp}
        className="mt-3 text-3xl font-bold tracking-tight text-brand-950"
      >
        <code className="rounded bg-brand-100 px-2 py-1 text-2xl">{pathname}</code>
      </motion.h1>
      <motion.p variants={fadeUp} className="mt-4 text-zinc-600">
        This page has not been built yet.
      </motion.p>
    </motion.main>
  )
}

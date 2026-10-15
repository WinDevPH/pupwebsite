import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'

const storageKey = 'pup-col-sc-cookies'

export function CookieNotice() {
  const reduce = useReducedMotion() === true
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) == null)
    } catch {
      setOpen(true)
    }
  }, [])

  function choose(value: 'accepted' | 'denied') {
    try {
      localStorage.setItem(storageKey, value)
    } catch {
      // The choice still closes the notice if storage is blocked.
    }
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-labelledby="cookie-title"
          aria-describedby="cookie-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
        >
          <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_24px_50px_-28px_rgba(30,5,65,0.45)] sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Cookie className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="cookie-title" className="text-sm font-semibold text-brand-950">
                  We use cookies
                </h2>
                <p id="cookie-text" className="mt-0.5 text-sm leading-5 text-zinc-500">
                  This site remembers your choice on this device.{' '}
                  <Link
                    to="/privacy"
                    className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:text-brand-600"
                  >
                    Privacy policy
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl px-4 sm:flex-none"
                onClick={() => choose('denied')}
              >
                Close & deny
              </Button>
              <Button type="button" className="h-11 flex-1 rounded-xl px-4 sm:flex-none" onClick={() => choose('accepted')}>
                Allow all
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

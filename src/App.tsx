import { useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BackToTop } from '@/components/layout/BackToTop'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CookieNotice } from '@/components/layout/CookieNotice'
import { ScrollContext } from '@/context/ScrollContext'
import { scrollPageTo, useLenis } from '@/hooks/useLenis'
import Announcement from '@/pages/Announcement'
import Home from '@/pages/Home'
import HowItWorks from '@/pages/HowItWorks'
import Placeholder from '@/pages/Placeholder'
import Project from '@/pages/Project'
import Portal from '@/pages/Portal'
import Privacy from '@/pages/Privacy'
import Reservation from '@/pages/Reservation'
import TheCouncil from '@/pages/TheCouncil'
import { ExecutivePage, LegislativePage } from '@/pages/Governance'
import Transparency from '@/pages/Transparency'

const pageEase = [0.22, 1, 0.36, 1] as const

export default function App() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  useLenis(wrapperRef, contentRef)

  return (
    <ScrollContext.Provider value={wrapperRef}>
      <div ref={wrapperRef} className="app-scroll">
        <div ref={contentRef} className="flex min-h-full flex-col">
          <Header />
          <AnimatedRoutes />
          <Footer />
        </div>
      </div>
      <BackToTop />
      <CookieNotice />
    </ScrollContext.Provider>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  const reduce = useReducedMotion() === true

  useLayoutEffect(() => {
    const id = location.hash.replace('#', '')
    const target = id ? document.getElementById(id) : null
    const scroller = document.querySelector('.app-scroll')
    if (target && scroller instanceof HTMLElement) {
      const top =
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        112
      scrollPageTo(Math.max(0, top), false)
      return
    }
    scrollPageTo(0, false)
  }, [location.pathname, location.hash])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.45, ease: pageEase }}
        className="grow"
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route path="/about/the-council" element={<TheCouncil />} />
          <Route path="/governance/legislative" element={<LegislativePage />} />
          <Route path="/governance/executive" element={<ExecutivePage />} />
          <Route path="/announcements/:id" element={<Announcement />} />
          <Route path="/projects/:slug" element={<Project />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/portal/reserve/:shop/:itemId" element={<Reservation />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/transparency" element={<Transparency />} />
          <Route path="*" element={<Placeholder />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

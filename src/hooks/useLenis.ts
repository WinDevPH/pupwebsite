import { useEffect, type RefObject } from 'react'
import Lenis from 'lenis'
import { isAppleTouch } from '@/lib/device'

let lenisInstance: Lenis | null = null

export function scrollPageTo(top: number, smooth = true) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const immediate = !smooth || reduce

  if (lenisInstance) {
    lenisInstance.scrollTo(top, {
      duration: immediate ? 0 : 1.1,
      immediate,
      easing: (t) => 1 - (1 - t) ** 4,
    })
    return
  }

  const root = document.querySelector('.app-scroll')
  if (!(root instanceof HTMLElement)) return
  if (immediate) {
    root.scrollTop = top
    return
  }
  root.scrollTo({ top, behavior: 'smooth' })
}

export function setPageScrollLocked(locked: boolean) {
  const wrapper = lenisInstance?.rootElement ?? document.querySelector('.app-scroll')

  if (lenisInstance) {
    if (locked) lenisInstance.stop()
    else lenisInstance.start()
  }

  if (wrapper instanceof HTMLElement) {
    wrapper.style.overflow = locked ? 'hidden' : ''
  }
}

/** Smooth scrolling inside `.app-scroll`, matching the portfolio frame. */
export function useLenis(
  wrapperRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const wrapper = wrapperRef.current
    const content = contentRef.current
    if (!wrapper || !content) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Lenis intercepts touch scrolling. On iPhone that leaves the fixed frame stuck and blank.
    if (isAppleTouch()) return

    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.068,
      smoothWheel: true,
      wheelMultiplier: 0.88,
      touchMultiplier: 1.05,
    })
    lenisInstance = lenis

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      if (lenisInstance === lenis) lenisInstance = null
    }
  }, [wrapperRef, contentRef])
}

import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll a homepage section into view after a cross-page hash arrival. */
export function useHashScroll(id: string) {
  const location = useLocation()

  useLayoutEffect(() => {
    if (location.hash !== `#${id}`) return
    const section = document.getElementById(id)
    const scroller = document.querySelector('.app-scroll')
    if (!section || !(scroller instanceof HTMLElement)) return
    const top =
      section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      112
    scroller.scrollTop = Math.max(0, top)
  }, [id, location.hash, location.pathname])
}

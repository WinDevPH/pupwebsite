import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { useScrollContainer } from '@/context/ScrollContext'
import { scrollPageTo } from '@/hooks/useLenis'
import { cn } from '@/lib/utils'

export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const { pathname } = useLocation()
  const scroller = useScrollContainer()

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => setVisible(el.scrollTop > 480)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pathname, scroller])

  return (
    <button
      type="button"
      aria-label="Return to top"
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? 0 : -1}
      onClick={() => scrollPageTo(0, true)}
      className={cn(
        'fixed right-[max(1rem,calc((100vw-80rem)/2+1rem))] bottom-5 z-40 flex size-10 items-center justify-center rounded-lg bg-brand-700 text-white shadow-sm transition-[opacity,transform] duration-300 ease-out hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:right-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] sm:bottom-6 lg:right-[max(2rem,calc((100vw-80rem)/2+2rem))]',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      <ChevronUp className="size-5" aria-hidden />
    </button>
  )
}

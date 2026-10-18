import { useEffect, useRef, type ReactNode } from 'react'

const DRAG_THRESHOLD_PX = 6

/**
 * Mouse drag left/right on wide overflow-x tables (fine pointer / desktop).
 * Starts after a small movement so links/buttons still click; text fields
 * keep native select/caret behavior.
 */
export function HorizontalDragScrollTableWrap({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const textEditableSel = 'input, textarea, select, [contenteditable=true]'

    let armed = false
    let dragging = false
    let suppressClick = false
    let startX = 0
    let startScrollLeft = 0

    const isTextEditable = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest(textEditableSel)

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (isTextEditable(e.target)) return
      armed = true
      dragging = false
      suppressClick = false
      startX = e.pageX
      startScrollLeft = el.scrollLeft
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!armed) return
      const dx = e.pageX - startX
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
        dragging = true
        suppressClick = true
        el.classList.add('cursor-grabbing')
        el.classList.remove('cursor-grab')
        el.style.userSelect = 'none'
      }
      e.preventDefault()
      el.scrollLeft = startScrollLeft - dx
    }

    const endDrag = () => {
      armed = false
      if (!dragging) return
      dragging = false
      el.classList.add('cursor-grab')
      el.classList.remove('cursor-grabbing')
      el.style.removeProperty('user-select')
    }

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return
      e.preventDefault()
      e.stopPropagation()
      suppressClick = false
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('click', onClickCapture, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', endDrag)

    return () => {
      endDrag()
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', endDrag)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={[
        className ?? '',
        'cursor-grab [&_a]:cursor-pointer [&_button]:cursor-pointer [&_input]:cursor-pointer [&_label]:cursor-pointer [&_select]:cursor-pointer [&_textarea]:cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

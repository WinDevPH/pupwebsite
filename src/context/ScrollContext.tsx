import { createContext, useContext, type RefObject } from 'react'

/** Ref to the element that actually scrolls. The window itself does not. */
export const ScrollContext = createContext<RefObject<HTMLElement | null>>({ current: null })

export function useScrollContainer() {
  return useContext(ScrollContext)
}
